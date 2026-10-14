// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER BURNING, AS HEARD — the bed under the `fire` event's one-shots
// (`fire-bank.ts`): read off `GameState.burn` once a frame, never an event.
//
//   * THE ROAR: a brown body and a pink tear over it, as hard as the flames
//     are (`burn-plan.ts`'s `fuelOf` and the climb up him, `frontOf`),
//     heaving on two beats of the engine's clock;
//   * THE HISS of the shell melting, high and thin, while it burns;
//   * THE CRACKLE: every fortieth of a second of the engine's clock is a
//     slot a pop may land in (`crackleAt`, a hash of the slot — never a
//     stream), as the burning helicopter's does — fewer once the flames are
//     dying, and a few still in the smoulder after.
//
// Nothing on a run kept safe for work (`burnShown`), and nothing without a
// burn: it builds nothing and costs nothing until his clothes catch.

import { FIRE_BURN, type GameState } from "@engine";

import type {
  LayerSpec,
  LayerTarget,
  Synth,
} from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";
import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";

import { burnShown, frontOf, fuelOf, sinceCaught, smoulderOf } from "../burn-plan.ts";
import { RUN_BANK } from "./bank.ts";
import { CRACKLE_SLOTS, crackleAt } from "./heli-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";

/** The most pops one frame raises. */
const MOST_POPS = 4;

export type BurnLayer = "roar" | "tear" | "hiss";

export const BURN_LAYERS: Record<BurnLayer, LayerSpec> = {
  roar: { kind: "noise", color: "brown", filter: { type: "lowpass", q: 0.8 } },
  tear: { kind: "noise", color: "pink", filter: { type: "bandpass", q: 0.6 } },
  hiss: { kind: "noise", color: "white", filter: { type: "highpass", q: 0.7 } },
};

const BURN_GLIDE: Record<BurnLayer, number> = { roar: 0.2, tear: 0.08, hiss: 0.3 };

/** HOW HARD HE BURNS AS HEARD, 0…1: the flames' fuel, grown as the fire
 * climbs him; and the smoulder after. Zero safe for work. */
export function burnVoiceOf(state: GameState): { fire: number; smoulder: number; t: number } {
  const burn = state.burn;
  if (!burn || !burnShown(state)) return { fire: 0, smoulder: 0, t: state.t };
  const since = sinceCaught(state);
  const climb = Math.min(1, frontOf(since));
  return {
    fire: fuelOf(burn) * (0.35 + 0.65 * climb),
    smoulder: smoulderOf(burn, since - FIRE_BURN.lasts),
    t: state.t,
  };
}

/** Where every layer should be, through the listener's `events` column. */
export function burnTargets(
  voice: { fire: number; t: number },
  gain: number,
): Record<BurnLayer, LayerTarget> {
  const f = Math.min(1, Math.max(0, voice.fire));
  const heave = 0.5 + 0.3 * Math.sin(voice.t * 2.3) + 0.2 * Math.sin(voice.t * 5.1 + 0.7);
  const tear = 0.5 + 0.3 * Math.sin(voice.t * 9.7) + 0.2 * Math.sin(voice.t * 16.1 + 1.3);
  return {
    roar: { level: gain * f * (0.09 + 0.03 * heave), cutoff: 260 + 300 * f + 160 * heave },
    tear: { level: gain * f * (0.035 + 0.015 * tear), cutoff: 700 + 500 * tear },
    hiss: { level: gain * f * 0.012, cutoff: 3800 },
  };
}

export type BurnBed = {
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
  /** How many layers are built and alive — for the tests. */
  live: () => number;
};

export function createBurnBed(synth: Synth): BurnBed {
  const rack: Rack<BurnLayer> = createRack(synth, BURN_LAYERS, BURN_GLIDE);
  let listener: Listener = listenerFor("chase");
  let built = false;
  // The last crackle slot heard (NaN before the fire).
  let slot = Number.NaN;
  const hush = (): void => {
    rack.stop();
    built = false;
  };
  return {
    update(state, _dt, duck = 1) {
      const voice = burnVoiceOf(state);
      if (voice.fire <= 0 && voice.smoulder <= 0) {
        if (built) hush();
        slot = Number.NaN;
        return;
      }
      if (synth.now() === null) return;
      const gain = listener.events * duck;
      rack.apply(burnTargets(voice, gain));
      built = true;
      // THE CRACKLE: the fire's, and a few embers' in the smoulder.
      const crackle = Math.max(voice.fire, 0.25 * voice.smoulder);
      const now = Math.floor(state.t * CRACKLE_SLOTS);
      const from = Number.isNaN(slot) || now < slot ? now - 1 : slot;
      let pops = 0;
      for (let s = Math.max(from + 1, now - CRACKLE_SLOTS); s <= now; s++) {
        const pop = crackleAt(s * 5 + 11, crackle);
        if (!pop) continue;
        if (++pops > MOST_POPS) break;
        playSound(synth, RUN_BANK, "heli_crackle", {
          gain: pop.size * gain * (0.5 + 0.5 * voice.fire),
          pitch: pop.pitch * 1.2 * listener.muffle,
        });
      }
      slot = now;
    },
    setView(view) {
      listener = listenerFor(view);
    },
    silence: hush,
    reset() {
      hush();
      slot = Number.NaN;
    },
    live: () => rack.live(),
  };
}
