// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S PARAMOTORS AND BALLOONS, HEARD (`engine/game/army-air.ts`) —
// each by the free ride's own voice for it, from where the skier is:
//
//   * A PARAMOTOR: the single-cylinder two-stroke on the soldier's back
//     (`para-bed.ts`' `paraEngine`), the nearest few a rack each, falling
//     off with distance as a snowmobile's engine does (`sledHeard`) — a
//     buzz circling him, rising as the pilot opens up to climb. Brought
//     down, the engine is cut.
//   * A BALLOON: its burner, its pilot light and its vent
//     (`balloon-voice.ts`, read the way `balloon-bed.ts` reads the free
//     ride's), heard from the skier — silent between burns, a roar overhead
//     as it fires.
//
// A rocket's launch and its burst are the gunfire's one-shots
// (`rocket_launch`, the blast's), raised off the gunfire's own events
// (`route.ts`). Built only on a run whose hunt brought the army's air;
// anywhere else it builds nothing and costs nothing.

import { BALLOON, armyBalloons, armyParas, type GameState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";

import {
  BALLOON_GLIDE,
  BALLOON_LAYERS,
  balloonTargets,
  type BalloonLayer,
  type BalloonVoice,
} from "./balloon-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { paraEngine } from "./para-bed.ts";
import { SLED_GLIDE, SLED_LAYERS, sledHeard, type SledLayer } from "./sled-voice.ts";
import { SCREEN_TO_ENGINE } from "../input-model.ts";

/** The ear over the skier's boots, m. */
const EAR = 1.6;
/** How far across a craft is panned at the most, 0..1 of the ear. */
const PAN = 0.6;
/** THE MOST HEARD AT ONCE — the nearest. */
export const MOST_AIR = { paras: 3, balloons: 2 } as const;
/** The envelope's excess over the air the vent's breath is full at, K. */
const HOT = 100;

export type ArmyAirBed = {
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
  /** How many layers are standing — for the tests. */
  live: () => number;
};

/** How far and how far across a point is from the skier's head. */
function heardFrom(state: GameState, x: number, y: number, z: number): { distance: number; pan: number } {
  const c = state.skier;
  const dx = x - c.x;
  const dz = z - c.z;
  const flat = Math.hypot(dx, dz);
  const across = flat > 1 ? (dx * Math.cos(c.heading) - dz * Math.sin(c.heading)) / flat : 0;
  return { distance: Math.hypot(dx, y - (c.y + EAR), dz), pan: across * SCREEN_TO_ENGINE * PAN };
}

export function createArmyAirBed(synth: Synth): ArmyAirBed {
  const paraRacks: (Rack<SledLayer> | null)[] = Array.from({ length: MOST_AIR.paras }, () => null);
  const paraSlots: (number | null)[] = Array.from({ length: MOST_AIR.paras }, () => null);
  const balloonRacks: (Rack<BalloonLayer> | null)[] = Array.from(
    { length: MOST_AIR.balloons },
    () => null,
  );
  const balloonSlots: (number | null)[] = Array.from({ length: MOST_AIR.balloons }, () => null);
  let listener: Listener = listenerFor("chase");

  const free = <L extends string>(racks: (Rack<L> | null)[], slots: (number | null)[], keep: Set<number>) => {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] !== null && !keep.has(slots[i]!)) {
        racks[i]?.stop();
        racks[i] = null;
        slots[i] = null;
      }
    }
  };
  const hush = (): void => {
    free(paraRacks, paraSlots, new Set());
    free(balloonRacks, balloonSlots, new Set());
  };

  return {
    update(state, _dt, duck = 1) {
      const ps = armyParas(state).filter((p) => p.mode === "fly" || p.mode === "leave");
      const bs = armyBalloons(state).filter((m) => m.mode === "fly" || m.mode === "leave");
      if (ps.length === 0 && bs.length === 0) {
        if (paraSlots.some((s) => s !== null) || balloonSlots.some((s) => s !== null)) hush();
        return;
      }
      if (synth.now() === null) return;
      // THE PARAMOTORS: the nearest few.
      const near = ps
        .map((p) => ({ p, ...heardFrom(state, p.x, p.y, p.z) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MOST_AIR.paras);
      free(paraRacks, paraSlots, new Set(near.map((n) => n.p.id)));
      for (const n of near) {
        let i = paraSlots.indexOf(n.p.id);
        if (i < 0) i = paraSlots.indexOf(null);
        if (i < 0) continue;
        paraSlots[i] = n.p.id;
        const rack = (paraRacks[i] ??= createRack(synth, SLED_LAYERS, SLED_GLIDE));
        const heard = sledHeard(n.distance);
        const machine = listener.machine * duck * heard.gain;
        const targets = paraEngine(n.p.wing, { engine: machine, exhaust: machine, tone: heard.bright });
        for (const k of Object.keys(targets) as SledLayer[]) targets[k].pan = n.pan * listener.side;
        rack.apply(targets);
      }
      // THE BALLOONS: the burner, from where he is.
      const nearB = bs
        .map((m) => ({ m, ...heardFrom(state, m.body.x, m.body.y + BALLOON.basket.burner, m.body.z) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MOST_AIR.balloons);
      free(balloonRacks, balloonSlots, new Set(nearB.map((n) => n.m.id)));
      for (const n of nearB) {
        let i = balloonSlots.indexOf(n.m.id);
        if (i < 0) i = balloonSlots.indexOf(null);
        if (i < 0) continue;
        balloonSlots[i] = n.m.id;
        const rack = (balloonRacks[i] ??= createRack(synth, BALLOON_LAYERS, BALLOON_GLIDE));
        const b = n.m.body;
        const voice: BalloonVoice = {
          flame: b.flame,
          pilot: b.pilot ? 1 : 0,
          vent: b.vent,
          heat: Math.max(0, b.temp - b.ambient) / HOT,
          fire: 0,
          distance: n.distance,
          t: state.t,
        };
        const targets = balloonTargets(voice, { machine: listener.machine * duck });
        for (const k of Object.keys(targets) as BalloonLayer[]) targets[k].pan = n.pan * listener.side;
        rack.apply(targets);
      }
    },
    setView(view) {
      listener = listenerFor(view);
    },
    silence: hush,
    reset: hush,
    live: () =>
      paraRacks.reduce((n, r) => n + (r ? r.live() : 0), 0) +
      balloonRacks.reduce((n, r) => n + (r ? r.live() : 0), 0),
  };
}
