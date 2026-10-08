// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON'S SCHEDULER — the half that reads the free ride's
// balloon (`GameState.balloon`) once a frame and steers its layers
// (`balloon-voice.ts`), heard from the skier: in the basket the burner is
// over his head; over the side, the balloon he left roars on as it flies
// away from him.
//
// TWO EDGES AND A CRACKLE, all read off the state, never an event:
//   * THE BLAST VALVE opened (`BalloonState.valve` false → true) is the
//     lever's clack and the whoomp of the gas lighting (`balloon_valve`);
//     shut, a smaller clack (`balloon_shut`) under the jet's hiss dying;
//   * THE FIRE: while the envelope burns, every fortieth of a second of the
//     ENGINE's clock since the last frame is a slot a pop may land in
//     (`crackleAt`, a hash of the slot — never a stream), as the burning
//     helicopter's does.
//
// Built only on a run with a balloon (`state.balloon`, the free ride's);
// anywhere else it builds nothing and costs nothing.

import { BALLOON, type GameState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";
import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";

import { RUN_BANK } from "./bank.ts";
import {
  BALLOON_GLIDE,
  BALLOON_LAYERS,
  balloonTargets,
  type BalloonLayer,
  type BalloonVoice,
} from "./balloon-voice.ts";
import { CRACKLE_SLOTS, HEARD_FAR, crackleAt, heliHeard } from "./heli-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";

/** The ear over the skier's boots, m. */
const EAR = 1.6;
/** The most pops one frame raises. */
const MOST_POPS = 4;
/** The envelope's excess over the air the vent's breath is full at, K. */
const HOT = 100;

export type BalloonBed = {
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
  /** How many layers are built and alive — for the tests. */
  live: () => number;
};

/** THE BALLOON AS HEARD at this step: its burner, pilot, vent and fire
 * against the skier's head. */
export function balloonVoiceOf(state: GameState): BalloonVoice | null {
  const b = state.balloon;
  if (!b) return null;
  const c = state.skier;
  const distance = b.aboard
    ? BALLOON.basket.burner - EAR
    : Math.hypot(b.x - c.x, b.y + BALLOON.basket.burner - (c.y + EAR), b.z - c.z);
  return {
    flame: b.flame,
    pilot: b.pilot && b.mode !== "down" ? 1 : 0,
    vent: b.vent,
    heat: Math.max(0, b.temp - b.ambient) / HOT,
    fire: b.burning ? Math.min(1, 0.4 + b.burnt * 2) * (1 - Math.max(0, b.burnt - 0.85) / 0.15) : 0,
    distance,
    t: state.t,
  };
}

export function createBalloonBed(synth: Synth): BalloonBed {
  const rack: Rack<BalloonLayer> = createRack(synth, BALLOON_LAYERS, BALLOON_GLIDE);
  let listener: Listener = listenerFor("chase");
  let built = false;
  // The valve as last heard (null before the first frame of a run), and the
  // last crackle slot heard (NaN before the fire).
  let valve: boolean | null = null;
  let slot = Number.NaN;
  const hush = (): void => {
    rack.stop();
    built = false;
  };
  const forget = (): void => {
    valve = null;
    slot = Number.NaN;
  };
  return {
    update(state, _dt, duck = 1) {
      const b = state.balloon;
      const voice = balloonVoiceOf(state);
      if (!b || !voice) {
        if (built) hush();
        forget();
        return;
      }
      if (synth.now() === null) return;
      const machine = listener.machine * duck;
      rack.apply(balloonTargets(voice, { machine }));
      built = true;
      const heard = heliHeard(Math.max(0, voice.distance - 2.4) * 2.5);
      // THE BLAST VALVE's edges.
      if (valve !== null && b.valve !== valve) {
        playSound(synth, RUN_BANK, b.valve ? "balloon_valve" : "balloon_shut", {
          gain: heard.gain * machine * listener.events,
          pitch: listener.muffle * (0.7 + 0.3 * heard.bright),
        });
      }
      valve = b.valve;
      // THE CRACKLE.
      if (voice.fire > 0 && voice.distance < HEARD_FAR) {
        const now = Math.floor(state.t * CRACKLE_SLOTS);
        const from = Number.isNaN(slot) || now < slot ? now - 1 : slot;
        let pops = 0;
        for (let s = Math.max(from + 1, now - CRACKLE_SLOTS); s <= now; s++) {
          const pop = crackleAt(s * 7 + 3, voice.fire);
          if (!pop) continue;
          if (++pops > MOST_POPS) break;
          playSound(synth, RUN_BANK, "heli_crackle", {
            gain: pop.size * heard.gain * machine * listener.events,
            pitch: pop.pitch * (0.6 + 0.4 * heard.bright) * listener.muffle,
          });
        }
        slot = now;
      } else slot = Number.NaN;
    },
    setView(view) {
      listener = listenerFor(view);
    },
    silence: hush,
    reset() {
      hush();
      forget();
    },
    live: () => rack.live(),
  };
}
