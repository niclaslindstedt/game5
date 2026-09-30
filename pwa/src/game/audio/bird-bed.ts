// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRDS' SCHEDULER — the half that reads the live `GameState` once a
// frame and raises every cry the wood owes for the seconds since the last
// one. What a bird SAYS is `bird-voice.ts`; where the flocks ARE is
// `bird-plan.ts` — `birdPlanFor(level)`, the one plan the renderer draws
// from, kept against the level, so the ear and the eye agree without either
// being told about the other.
//
// A cry is a CUE, never an event: the engine has no idea a raven exists.
// Every frame this asks the plan which flocks are within earshot, how much
// of each is in the air, and draws each slot of the window since the last
// frame off the flock's own scatter — so the cries are as deterministic as
// the birds, and a replay cries them again.
//
// THE ONE MEMORY IS THE FLUSH, kept here as the renderer keeps its own:
// when a skier last put each covey up, decided by `flushAt`, the rule the
// plan states once for both. The grouse's whirr is the one sound the skier
// causes; everything else here the wood would have said anyway.

import type { GameState, Level } from "@engine";

import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";
import {
  activityAt,
  birdPlanFor,
  crossingPose,
  flightShare,
  flushAt,
  forEachCrossing,
  freshBirdPose,
  type BirdPlan,
} from "../bird-plan.ts";

import { RUN_BANK } from "./bank.ts";
import {
  BIRD_CALLS,
  FLUSH_CRIES,
  callRate,
  criesIn,
  cryPan,
  cryPitch,
  heardAt,
  type BirdCall,
} from "./bird-voice.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { playSound } from "@niclaslindstedt/oss-game-framework/audio/play";

/** The longest gap a frame is allowed to owe cries for, s. A tab that was
 * away for a minute does not come back to a minute of ravens at once. */
const LONGEST_WINDOW = 1;

/** A cry booked for a later frame — the flush's shouts, spread over the
 * second the covey takes to get up — held on the ENGINE's clock, so a pause
 * holds them with the race. */
type Booked = { due: number; sound: string; gain: number; pitch: number; pan: number };

export type BirdBed = {
  /** Raise every cry owed since the last frame. `duck` scales every cry,
   * as it scales the ride bed. */
  update: (state: GameState, dt: number, duck?: number) => void;
  setView: (view: string) => void;
  /** Nobody is hearing the race: forget the window, so the frame that
   * resumes does not owe the cries of the whole pause. */
  silence: () => void;
  /** A race ended: forget the flushes and the window. */
  reset: () => void;
};

export function createBirdBed(synth: Synth): BirdBed {
  let listener: Listener = listenerFor("chase");
  let level: Level | null = null;
  let plan: BirdPlan | null = null;
  let flushed = new Float64Array(0);
  /** The engine second the last window closed at, or NaN for none. */
  let lastT = NaN;
  const booked: Booked[] = [];
  const pose = freshBirdPose();

  const play = (sound: string, gain: number, pitch: number, pan: number, duck: number): void => {
    playSound(synth, RUN_BANK, sound, {
      gain: gain * listener.events * duck,
      pitch: pitch * listener.muffle,
      pan,
    });
  };

  /** A source at (`x`, `z`) heard by the player: how far, which side. */
  const from = (state: GameState, x: number, z: number): { d: number; pan: number } => {
    const s = state.skier;
    const dx = x - s.x;
    const dz = z - s.z;
    return { d: Math.hypot(dx, dz), pan: cryPan(Math.atan2(dx, dz), s.heading) };
  };

  return {
    update(state, _dt, duck = 1) {
      if (synth.now() === null) return;
      if (state.level !== level) {
        level = state.level;
        plan = birdPlanFor(level);
        flushed = new Float64Array(plan.flocks.length).fill(-Infinity);
        lastT = NaN;
        booked.length = 0;
      }
      if (plan === null || level === null) return;
      const t = state.t;
      // The first frame, or one after the clock went backwards (a race
      // restarted), only opens a window.
      if (!(t > lastT)) {
        lastT = t;
        return;
      }
      const t0 = Math.max(lastT, t - LONGEST_WINDOW);
      lastT = t;
      const activity = activityAt(level);
      const y = state.skier.y;

      plan.flocks.forEach((flock, f) => {
        const was = flushed[f];
        flushed[f] = flushAt(flock, state, was);
        const call: BirdCall | null = BIRD_CALLS[flock.species];
        if (!call) return;
        const air = flightShare(flock, t, activity, flushed[f]);
        // Heard from where the flock IS: its perch at rest, its beat in the
        // air, and the blend on the way — with the height in the distance.
        const home = from(state, flock.home.x, flock.home.z);
        const beat = from(state, flock.loop.x, flock.loop.z);
        const flat = home.d + (beat.d - home.d) * air;
        const up = flock.home.y + (flock.loop.altitude - flock.home.y) * air - y;
        const pan = home.pan + (beat.pan - home.pan) * air;
        const heard = heardAt(Math.hypot(flat, up), call);
        if (heard <= 0) return;
        if (flushed[f] !== was) {
          if (call.flush) play(call.flush, heard, 1, home.pan, duck);
          for (let k = 0; k < FLUSH_CRIES.count; k++) {
            booked.push({
              due: t + (k * FLUSH_CRIES.spread) / FLUSH_CRIES.count,
              sound: call.sound,
              gain: heard * FLUSH_CRIES.gain,
              pitch: cryPitch((k + 0.5) / FLUSH_CRIES.count),
              pan: home.pan,
            });
          }
        }
        const rate = callRate(call, air, activity);
        criesIn(flock.scatter, flock.count, rate, t0, t, (cry) => {
          play(call.sound, heard * (0.8 + 0.4 * cry.vary), cryPitch(cry.vary), pan, duck);
        });
      });

      // The skeins, heard from the leader, the height in the distance.
      forEachCrossing(plan, t, (crossing) => {
        const call = BIRD_CALLS[crossing.species];
        if (!call) return;
        crossingPose(crossing, 0, t, pose);
        const lead = from(state, pose.x, pose.z);
        const heard = heardAt(Math.hypot(lead.d, pose.y - y), call);
        if (heard <= 0) return;
        criesIn(crossing.scatter, crossing.count, call.airborne, t0, t, (cry) => {
          play(call.sound, heard * (0.8 + 0.4 * cry.vary), cryPitch(cry.vary), lead.pan, duck);
        });
      });

      for (let i = booked.length - 1; i >= 0; i--) {
        const b = booked[i];
        if (b.due > t) continue;
        play(b.sound, b.gain, b.pitch, b.pan, duck);
        booked.splice(i, 1);
      }
    },

    setView(view) {
      listener = listenerFor(view);
    },

    silence() {
      lastT = NaN;
    },

    reset() {
      lastT = NaN;
      booked.length = 0;
      flushed.fill(-Infinity);
    },
  };
}
