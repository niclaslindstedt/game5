// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S SCHEDULER — the half that reads the free ride's machine
// (`GameState.sled`) once a frame and steers its eight layers
// (`sled-voice.ts`), heard from where the player's skier is: stood on its
// boards it is under him and loud, the pipe behind him; left idling on the
// valley floor it is a two-stroke burbling away down the snow, losing its
// top to the air as he skis off. Shut down, it says nothing.
//
// The ear is the SKIER — as it is for every bed in the game — and the
// camera's rung only scales the whole machine (the listener's `machine`
// column), as it does the helicopter's.
//
// Built only on a run with a snowmobile (`state.sled`, the free ride's);
// anywhere else it builds nothing and costs nothing.

import { SLED, type GameState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";

import {
  SLED_GLIDE,
  SLED_LAYERS,
  revOf,
  sledHeard,
  sledTargets,
  type SledLayer,
  type SledVoice,
} from "./sled-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { SCREEN_TO_ENGINE } from "../input-model.ts";

/** How far across the machine is panned at the most, 0..1 of the ear. */
const PAN = 0.6;

/** THE SNOWMOBILE AGAINST THE EAR — its voice read off the state, and how
 * far from the skier it is, m, and on which side. */
export function sledVoiceOf(state: GameState): {
  voice: SledVoice;
  distance: number;
  pan: number;
} {
  const s = state.sled!;
  const c = state.skier;
  const dx = s.x - c.x;
  const dz = s.z - c.z;
  const distance = s.rider ? 0 : Math.hypot(dx, s.y - (c.y + 0.6), dz);
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const flat = Math.hypot(dx, dz);
  const across = flat > 1 && !s.rider ? (dx * fz - dz * fx) / flat : 0;
  // How much loose snow the paddles are in: none on the groomer.
  const loose = (1 - s.packed) * (s.contacts.some((k) => k.kind === "tread" && k.touching) ? 1 : 0);
  const grounded = !s.airborne;
  return {
    voice: {
      rpm: s.rpm,
      rev: revOf(s.rpm, SLED.idleRpm, SLED.maxRpm),
      throttle: s.controls.throttle,
      load: grounded ? s.controls.throttle : 0,
      treadSpeed: s.treadSpeed,
      slip: grounded ? s.slip : 0,
      loose,
    },
    distance,
    pan: across * SCREEN_TO_ENGINE * PAN,
  };
}

/** The snowmobile's bed, for the whole life of one app. */
export type SledBed = {
  /** Steer every layer. Call once per rendered frame with the live state;
   * builds nothing on a run with no snowmobile. `duck` scales it all. */
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
  live: () => number;
};

export function createSledBed(synth: Synth): SledBed {
  const rack: Rack<SledLayer> = createRack(synth, SLED_LAYERS, SLED_GLIDE);
  let listener: Listener = listenerFor("chase");
  let built = false;
  const hush = (): void => {
    rack.stop();
    built = false;
  };
  return {
    update(state, _dt, duck = 1) {
      const s = state.sled;
      if (!s) {
        if (built) hush();
        return;
      }
      if (synth.now() === null) return;
      const { voice, distance, pan } = sledVoiceOf(state);
      if (voice.rpm < 50 && !built) return;
      const heard = s.rider ? { gain: 1, bright: 1 } : sledHeard(distance);
      const machine = listener.machine * duck * heard.gain;
      const targets = sledTargets(voice, {
        engine: machine,
        // Stood on it, the pipe and the belt are behind and under him.
        exhaust: machine * (s.rider ? 0.85 : 1),
        tone: heard.bright,
      });
      for (const k of Object.keys(targets) as SledLayer[]) targets[k].pan = pan * listener.side;
      rack.apply(targets);
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
