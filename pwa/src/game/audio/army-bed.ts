// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTERS, HEARD — every machine the engine flies after him
// (`army.ts`) as the free ride's helicopter is heard (`heli-voice.ts`'s
// eleven layers, one rack a machine), with the class's own voice laid
// over it:
//
//   * its ROTOR: four blades at its own rpm (`rotorsOf(ARMY_HELI)`), a
//     lower, heavier blade passage than the heli-ski machine's three, and
//     the THUMP under it half as loud again — a 14 m disc on a five-tonne
//     machine is felt in the chest from far off;
//   * its TWIN TURBINES: the whine a little lower (bigger turboshafts) and,
//     where the light machine's second layer is its harmonic, here a second
//     turbine a few cents off the first, so the two beat slowly against
//     each other as a twin's do.
//
// Distance is the whole mix, as it is for the heli: heard from the skier's
// head (the inverse law near, gentler far, the top taken off by the air),
// its pitch moved by the Doppler shift of its closing speed, panned across
// his heading. A wreck burns with the heli's fire layers.
//
// THE ARMY'S SNOWMOBILES (`army-sled.ts`) are heard by the free ride's
// sled's own engine bed (`sled-voice.ts`, read through `sled-bed.ts`'
// `sledVoiceOf`): one of its racks a machine, from where the skier is.
//
// Built only on a run whose hunt brought the army's air; anywhere else it
// builds nothing and costs nothing.

import { ARMY, ARMY_HELI, armyHelis, armySleds, type ArmyHeli, type GameState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import type { LayerTarget } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";

import {
  HELI_GLIDE,
  HELI_LAYERS,
  dopplerOf,
  heliTargets,
  rotorsOf,
  slapOf,
  type HeliLayer,
  type HeliVoice,
} from "./heli-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { SLED_GLIDE, SLED_LAYERS, sledHeard, sledTargets, type SledLayer } from "./sled-voice.ts";
import { sledVoiceOf } from "./sled-bed.ts";
import { SCREEN_TO_ENGINE } from "../input-model.ts";

/** The class's own rotors, as the ear hears them. */
const ROTORS = rotorsOf(ARMY_HELI);
/** The ear over the skier's boots, m. */
const EAR = 1.6;
/** How far across a machine is panned at the most, 0..1 of the ear. */
const PAN = 0.6;
/** THE CLASS'S VOICE over the heli's: the thump's weight, the whine's
 * pitch, and the second turbine's offset from the first (a ratio — some
 * twenty cents) and its share of the first's level. */
export const ARMY_VOICE = { thump: 1.5, whine: 0.86, twin: 1.012, second: 0.8 } as const;
/** The most machines heard at once — the roster's most. */
const MOST = 3;
/** The wreck's fire, 0..1, while it burns (the engine's `ram.wreck`). */
const BURN = 0.8;

/** ONE MACHINE AGAINST THE EAR — a `HeliVoice` read off the engine's
 * machine: the spool it flies at, the collective a climb or a hard turn
 * pulls, the slap off its sink and its turn, no wash (it hunts well up). */
export function armyVoiceOf(state: GameState, h: ArmyHeli): HeliVoice {
  const c = state.skier;
  const dx = h.x - c.x;
  const dy = h.y + ARMY_HELI.rotor.hub - (c.y + EAR);
  const dz = h.z - c.z;
  const distance = Math.hypot(dx, dy, dz);
  const moving = h.phase === "hunt" || h.phase === "leave" || h.phase === "fall";
  const closing =
    moving && distance > 5
      ? -((h.vx - c.vx) * dx + (h.vy - c.vy) * dy + (h.vz - c.vz) * dz) / distance
      : 0;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const flat = Math.hypot(dx, dz);
  const across = flat > 1 ? (dx * fz - dz * fx) / flat : 0;
  const speed = Math.hypot(h.vx, h.vz);
  const pull = Math.hypot(h.ax, h.az) / 9.81;
  const collective = Math.min(1, 0.55 + 0.25 * Math.max(0, h.vy / 10) + 0.4 * pull);
  const burning =
    h.phase === "wreck"
      ? BURN * Math.min(1, h.t / 0.3) * Math.min(1, (ARMY.ram.wreck - h.t) / 2)
      : 0;
  return {
    spool: Math.max(0, h.spool),
    rise: 0,
    collective,
    slap: slapOf({ sink: -h.vy, speed, yawRate: h.yawRate, collective }),
    wash: 0,
    distance,
    doppler: dopplerOf(closing),
    pan: across * SCREEN_TO_ENGINE * PAN,
    fire: Math.max(0, burning),
    t: state.t,
  };
}

/** Where every layer should be for one army machine: the heli's, the
 * thump weighted, the whine lowered, and its second layer a second
 * turbine rather than a harmonic. */
export function armyTargets(voice: HeliVoice, machine: number): Record<HeliLayer, LayerTarget> {
  const t = heliTargets(voice, ROTORS, { machine });
  const V = ARMY_VOICE;
  t.thump.level *= V.thump;
  if (t.whine.hz) t.whine.hz *= V.whine;
  t.whine2 = {
    level: t.whine.level * V.second,
    hz: (t.whine.hz ?? 0) * V.twin,
    pan: t.whine.pan,
  };
  return t;
}

/** The army's helicopters' bed, for the whole life of one app. */
export type ArmyBed = {
  /** Steer every machine's layers. Once per rendered frame with the live
   * state; builds nothing on a run with no army in the air. */
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
  /** How many layers are standing — for the tests. */
  live: () => number;
};

export function createArmyBed(synth: Synth): ArmyBed {
  // One rack a slot; a machine keeps its slot while it is out.
  const racks: (Rack<HeliLayer> | null)[] = Array.from({ length: MOST }, () => null);
  const slots: (number | null)[] = Array.from({ length: MOST }, () => null);
  // THE SNOWMOBILES, heard as the free ride's is (`sled-bed.ts`): one of
  // its racks a machine, a slot each.
  const sledRacks: (Rack<SledLayer> | null)[] = Array.from({ length: MOST }, () => null);
  const sledSlots: (number | null)[] = Array.from({ length: MOST }, () => null);
  let listener: Listener = listenerFor("chase");

  const hushSleds = (): void => {
    for (let i = 0; i < MOST; i++) {
      sledRacks[i]?.stop();
      sledRacks[i] = null;
      sledSlots[i] = null;
    }
  };
  const hush = (): void => {
    for (let i = 0; i < MOST; i++) {
      racks[i]?.stop();
      racks[i] = null;
      slots[i] = null;
    }
    hushSleds();
  };

  /** Every army snowmobile out, its engine steered as the free ride's. */
  const sleds = (state: GameState, duck: number): void => {
    const out = armySleds(state).filter((m) => m.body.running);
    for (let i = 0; i < MOST; i++) {
      if (sledSlots[i] !== null && !out.some((m) => m.id === sledSlots[i])) {
        sledRacks[i]?.stop();
        sledRacks[i] = null;
        sledSlots[i] = null;
      }
    }
    for (const m of out) {
      let i = sledSlots.indexOf(m.id);
      if (i < 0) i = sledSlots.indexOf(null);
      if (i < 0) continue;
      sledSlots[i] = m.id;
      const rack = (sledRacks[i] ??= createRack(synth, SLED_LAYERS, SLED_GLIDE));
      const { voice, distance, pan } = sledVoiceOf(state, m.body);
      const heard = sledHeard(distance);
      const machine = listener.machine * duck * heard.gain;
      const targets = sledTargets(voice, { engine: machine, exhaust: machine, tone: heard.bright });
      for (const k of Object.keys(targets) as SledLayer[]) targets[k].pan = pan * listener.side;
      rack.apply(targets);
    }
  };

  return {
    update(state, _dt, duck = 1) {
      const helis = armyHelis(state);
      if (synth.now() !== null) sleds(state, duck);
      if (helis.length === 0) {
        if (racks.some((r) => r)) hush();
        return;
      }
      if (synth.now() === null) return;
      // Free the slots of machines no longer out.
      for (let i = 0; i < MOST; i++) {
        if (slots[i] !== null && !helis.some((h) => h.id === slots[i])) {
          racks[i]?.stop();
          racks[i] = null;
          slots[i] = null;
        }
      }
      for (const h of helis) {
        let i = slots.indexOf(h.id);
        if (i < 0) i = slots.indexOf(null);
        if (i < 0) continue;
        slots[i] = h.id;
        const rack = (racks[i] ??= createRack(synth, HELI_LAYERS, HELI_GLIDE));
        const voice = armyVoiceOf(state, h);
        voice.pan *= listener.side;
        rack.apply(armyTargets(voice, listener.machine * duck));
      }
    },
    setView(view) {
      listener = listenerFor(view);
    },
    silence: hush,
    reset: hush,
    live: () =>
      racks.reduce((n, r) => n + (r ? r.live() : 0), 0) +
      sledRacks.reduce((n, r) => n + (r ? r.live() : 0), 0),
  };
}
