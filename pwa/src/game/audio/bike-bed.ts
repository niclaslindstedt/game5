// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S SCHEDULER — the half that reads the summer free
// ride's bike (`GameState.bike`) once a frame and steers its seven layers
// (`bike-voice.ts`), heard from where the player is: ridden, it is under
// him; lying where he left it, it says nothing (nothing on it turns);
// hooked on a lift, it is carried in silence.
//
// The ear is the SKIER, as it is for every bed, and the camera's rung
// scales it as it scales a machine (the listener's `machine` column).
// Built only on a run with a bike; anywhere else it costs nothing.

import { summerGroundAt, type GameState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";

import {
  BIKE_GLIDE,
  BIKE_LAYERS,
  bikeTargets,
  type BikeLayer,
  type BikeVoice,
} from "./bike-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";

/** THE BIKE AGAINST THE EAR — its voice read off the state, or null when it
 * has nothing to say (not ridden, or carried up a lift). */
export function bikeVoiceOf(state: GameState): BikeVoice | null {
  const b = state.bike;
  if (!b || !b.onIt || b.mode !== "ridden") return null;
  const f = b.front;
  const r = b.rear;
  const touching = ((f.touching ? 1 : 0) + (r.touching ? 1 : 0)) / 2;
  const at = r.touching ? r : f;
  return {
    speed: b.speed,
    rearSpin: r.spin,
    pedalling: b.cadence > 0 && b.controls.pedal > 0.05,
    ground: summerGroundAt(state.level, at.x, at.z),
    touching,
    rough: Math.max(Math.abs(f.compRate), Math.abs(r.compRate)),
    slide: Math.max(0, Math.max(f.touching ? f.over : 0, r.touching ? r.over : 0) - 0.85) / 0.4,
    locked: (f.locked && f.touching) || (r.locked && r.touching),
    brake: Math.max(b.controls.front, b.controls.rear),
  };
}

/** The bike's bed, for the whole life of one app. */
export type BikeBed = {
  /** Steer every layer. Call once per rendered frame with the live state;
   * builds nothing on a run with no bike. `duck` scales it all. */
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
  live: () => number;
};

export function createBikeBed(synth: Synth): BikeBed {
  const rack: Rack<BikeLayer> = createRack(synth, BIKE_LAYERS, BIKE_GLIDE);
  let listener: Listener = listenerFor("chase");
  let built = false;
  const hush = (): void => {
    rack.stop();
    built = false;
  };
  return {
    update(state, _dt, duck = 1) {
      if (!state.bike) {
        if (built) hush();
        return;
      }
      if (synth.now() === null) return;
      const voice = bikeVoiceOf(state);
      if (!voice) {
        if (built) hush();
        return;
      }
      rack.apply(bikeTargets(voice, { bike: listener.machine * duck, tone: listener.tone }));
      built = true;
    },
    setView(view) {
      listener = listenerFor(view);
    },
    silence: hush,
    reset: hush,
    live: () => rack.live(),
  };
}
