// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START, AS TELEVISION SHOWS IT — two shots of the racer in the start
// house (`start-house-plan.ts`) and the move that takes the lens off them.
//
//   OVERHEAD for the first `START_CAM.over` seconds of the starter's word:
//   high over the door at an angle, looking down on him leaning out over
//   the wand, his poles planted on the snow beyond it.
//   BEHIND for the rest of it and until he goes: inside the house at his
//   back, looking out through the doorway past him and the wand's posts,
//   down the course — the shot he goes on. NO CUT between the two: over
//   `START_CAM.settle` seconds the lens drops back off the roof and swings
//   its aim up off his skis to the course, eased, and settles behind him
//   before GO.
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
  /** The overhead shot holds this long of the starter's word … */
  over: 2,
  /** … then the lens moves down behind him over this long — done before
   * the shortest starter's word (a slalom's 4 s) runs out. */
  settle: 1.4,
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
  // Into the word: the overhead shot, then the move down behind him; once
  // the word is out (or he has gone) the lens is behind him.
  const elapsed = m.lights - m.countdown;
  const settled =
    m.started || m.countdown <= 0 ? 1 : ease((elapsed - START_CAM.over) / START_CAM.settle);
  const pick = settleShot(plan.shots.over, plan.shots.behind, settled);
  const fov = lerp(START_SHOT.over.fov, START_SHOT.behind.fov, settled);
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

/** THE MOVE between the two shots, `k` of the way from `a` to `b`: the lens
 * carried along the line between them, and its aim SWUNG — the look's
 * direction turned from one to the other and its reach carried with it —
 * rather than the aim point dragged, which would whip the view round at the
 * end where the near aim gives way to the far one. */
export function settleShot(a: Aimed, b: Aimed, k: number): Aimed {
  const lens = mix(a.lens, b.lens, k);
  const da = sub(a.aim, a.lens);
  const db = sub(b.aim, b.lens);
  const ra = Math.hypot(da.x, da.y, da.z);
  const rb = Math.hypot(db.x, db.y, db.z);
  const look = mix(scale(da, 1 / ra), scale(db, 1 / rb), k);
  const reach = lerp(ra, rb, k) / (Math.hypot(look.x, look.y, look.z) || 1);
  return {
    lens,
    aim: { x: lens.x + look.x * reach, y: lens.y + look.y * reach, z: lens.z + look.z * reach },
  };
}

/** A shot: where its lens stands and the point it aims at. */
type Aimed = { lens: Vec3; aim: Vec3 };

const mix = (a: Vec3, b: Vec3, k: number): Vec3 => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
  z: lerp(a.z, b.z, k),
});
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });

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
