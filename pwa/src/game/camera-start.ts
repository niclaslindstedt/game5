// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START, AS TELEVISION SHOWS IT — two shots of the racer in the start
// house (`start-house-plan.ts`) and the move that takes the lens off them.
//
//   OVERHEAD for the first `START_CAM.over` seconds of the starter's word:
//   high over the door at an angle, looking down on him leaning out over
//   the wand, his poles planted on the snow beyond it.
//   BEHIND for the rest of it and until he goes: inside the house at his
//   back, looking out through the doorway past him and the wand's posts,
//   down the course — the shot he goes on. A cut between the two, as a
//   broadcast cuts.
//
// When he opens the wand — which starts his clock (`run.ts`: on an interval
// start the clock waits for it), however long after GO that is — the lens
// follows him out of the door, aimed on him, and then flies onto the camera
// the player rides (`camera.ts`'s ladder), eased: from behind him onto the
// chase behind him, one move.
//
// A pure function of the run's clock and where the racer is — nothing is
// kept, so a restart, a replay and a pause all frame the same. On a map
// with no start house (anything but a slalom), there is no start shot.
// Three-free: it hands the renderer a `LensPose` to plant.

import type { GameState, Level } from "@engine";

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, Vec3 } from "./camera-rigs.ts";
import { START_SHOT, startHousePlan } from "./start-house-plan.ts";

/** The sequence's timing, s. */
export const START_CAM = {
  /** The overhead shot holds this long of the starter's word. */
  over: 2,
  /** Out of the door: the lens follows him this long … */
  follow: 0.7,
  /** … then flies to the player's camera over this long. */
  blend: 1.4,
  /** The lens's breath on its tripod: how far its aim drifts, m. */
  sway: 0.02,
} as const;

/** What the start shot reads off the run. */
export type StartMoment = {
  level: Level;
  /** The lights still to run, s (0 once GO has gone), and the run's own
   * countdown — how long the starter's word takes. */
  countdown: number;
  lights: number;
  /** Whether he has opened the wand, and the run clock — on a slalom it
   * starts at the wand, so it is how long he has been out. */
  started: boolean;
  time: number;
  /** The sim clock, for the tripod's breath. */
  t: number;
  /** Where the racer is, as drawn. */
  racer: Vec3;
};

const ease = (u: number): number => {
  const k = clamp(u, 0, 1);
  return k * k * (3 - 2 * k);
};

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** THE START SHOT this frame, or null when it has handed the lens back —
 * `ladder` is the player's camera as framed underneath, the lens it flies
 * to. */
export function frameStart(m: StartMoment, ladder: LensPose): LensPose | null {
  const plan = startHousePlan(m.level);
  if (!plan) return null;
  const out = m.started ? m.time : 0;
  if (out >= START_CAM.follow + START_CAM.blend) return null;
  const sway = (k: number): number => Math.sin(m.t * 0.9 + k) * START_CAM.sway;
  // Into the word: the overhead shot; from then on, from behind.
  const elapsed = m.lights - m.countdown;
  const overhead = !m.started && m.countdown > 0 && elapsed < START_CAM.over;
  const pick = overhead ? plan.shots.over : plan.shots.behind;
  const fov = overhead ? START_SHOT.over.fov : START_SHOT.behind.fov;
  // Out of the door: the aim comes onto him as he goes.
  const leaving = ease(out / START_CAM.follow);
  const target = {
    x: lerp(pick.aim.x, m.racer.x, leaving * 0.6) + sway(0),
    y: lerp(pick.aim.y, m.racer.y, leaving * 0.6) + sway(1.7),
    z: lerp(pick.aim.z, m.racer.z, leaving * 0.6) + sway(3.1),
  };
  const shot: LensPose = { eye: { ...pick.lens }, target, fov, roll: 0 };
  const fly = ease((out - START_CAM.follow) / START_CAM.blend);
  if (fly <= 0) return shot;
  return {
    eye: {
      x: lerp(shot.eye.x, ladder.eye.x, fly),
      y: lerp(shot.eye.y, ladder.eye.y, fly),
      z: lerp(shot.eye.z, ladder.eye.z, fly),
    },
    target: {
      x: lerp(shot.target.x, ladder.target.x, fly),
      y: lerp(shot.target.y, ladder.target.y, fly),
      z: lerp(shot.target.z, ladder.target.z, fly),
    },
    fov: lerp(shot.fov, ladder.fov, fly),
    roll: lerp(0, ladder.roll, fly),
  };
}

/** The start shot's reading of a run, the racer as drawn at `racer`. */
export function startMoment(state: GameState, racer: Vec3): StartMoment {
  return {
    level: state.level,
    countdown: state.phase === "countdown" ? state.countdown : 0,
    lights: state.rules.countdown,
    started: state.progress.started,
    time: state.progress.time,
    t: state.t,
    racer,
  };
}
