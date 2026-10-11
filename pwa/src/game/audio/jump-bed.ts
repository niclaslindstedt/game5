// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMP'S BED (R43) — the half that reads the jump under way
// (`GameState.jump`) once a frame and steers its layers (`jump-voice.ts`):
// the skis in the tracks, the wind in the flight and the stadium's crowd,
// heard from where the jumper is, through the seat's columns. The ride bed
// stands its skis and its wind down while this one has them (`rideShares`)
// and takes them back in the out-run.
//
// Built only on a run with a jumping hill (`state.jump`); anywhere else it
// builds nothing and costs nothing.

import type { GameState } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import { createRack, type Rack } from "@niclaslindstedt/oss-game-framework/audio/rack";

import { jumpArenaPlan } from "../ski-jump-arena-plan.ts";
import { listenerFor, type Listener } from "./listener.ts";
import {
  crowdNear,
  crowdRoar,
  JUMP_GLIDE,
  JUMP_LAYERS,
  jumpTargets,
  type JumpLayer,
  type JumpVoice,
} from "./jump-voice.ts";

/** THE JUMP AGAINST THE EAR — a `JumpVoice` read off the state, or null on
 * a run with no jump. */
export function jumpVoiceOf(state: GameState): JumpVoice | null {
  const j = state.jump;
  const hill = state.level.skiJump;
  if (!j || !hill) return null;
  const c = state.skier;
  const r = j.record;
  const air = j.stage === "air";
  const tracks = j.stage === "tracks";
  const speed = tracks ? j.speed : air ? Math.hypot(j.va, j.vw, j.vy) : 0;
  // The crowd is heard from the jumper, by how far he is from the stadium.
  const arena = jumpArenaPlan(state.level)?.arena;
  const d = arena ? Math.hypot(c.x - arena.x, c.y - arena.y, c.z - arena.z) : Infinity;
  const marks = { p: hill.distanceAt(hill.p), k: hill.w, hs: hill.hs };
  const touched = r.landing !== null && j.edgeAt >= 0;
  const crowd = crowdRoar(
    marks,
    air ? hill.distanceAt(j.along) : null,
    touched
      ? {
          distance: r.distance,
          since: state.t - j.edgeAt - r.flightTime,
          fell: r.landing === "fall" || r.outcome === "fall",
        }
      : null,
  );
  return {
    tracks: tracks ? 1 : 0,
    air: air ? 1 : 0,
    speed,
    vee: air ? j.vee : 0,
    lay: air ? j.lay : 0,
    t: state.t,
    near: arena ? crowdNear(d) : 0,
    roar: crowd.roar,
    groan: crowd.groan,
  };
}

/** The ski jump's bed, for the whole life of one app. */
export type JumpBed = {
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  silence: () => void;
  reset: () => void;
};

export function createJumpBed(synth: Synth): JumpBed {
  const rack: Rack<JumpLayer> = createRack(synth, JUMP_LAYERS, JUMP_GLIDE);
  let listener: Listener = listenerFor("chase");
  let built = false;
  const hush = (): void => {
    rack.stop();
    built = false;
  };
  return {
    update(state, _dt, duck = 1) {
      const voice = jumpVoiceOf(state);
      if (!voice) {
        if (built) hush();
        return;
      }
      if (synth.now() === null) return;
      rack.apply(
        jumpTargets(voice, {
          wind: listener.wind * duck,
          snow: listener.snow * duck,
          events: listener.events * duck,
        }),
      );
      built = true;
    },
    setView(view) {
      listener = listenerFor(view);
    },
    silence: hush,
    reset: hush,
  };
}
