// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI CROSS'S START GATE, as a plan — where the start device stands over
// the top of a ski-cross course (R35, `level.skiCross`), where each of its
// doors is, and how far a door has fallen at a moment of the run.
// Three-free, so the suite reads it; `cross-gate.ts` draws it.
//
// WHAT A SKI CROSS'S START LOOKS LIKE: four racers abreast on a level
// PLATFORM at the top of a steep start ramp, each behind a DOOR of his own —
// a hinged panel at shin height between two steel posts, the posts carrying
// the HANDLES he grips and hauls himself out on. The doors are one machine:
// all held up by one latch, all released together, falling forward flat
// onto the ramp in a tenth of a second or so. Over the device a FRAME
// carries the start's banner; boards wall the platform's sides.
//
// The doors are where the course says (`SkiCrossCourse.from`), one a lane
// of the start gate (`level.grid`), and they fall at GO — a pure function
// of the run's clock, so a replay and a restart drop them the same.

import type { GameState, Level } from "@engine";

/** The start gate's measure, m. */
export const CROSS_GATE = {
  /** A DOOR: its height over the snow at its hinge, and the gap it leaves
   * either side to its posts. */
  door: { height: 0.55, gap: 0.08 },
  /** THE POSTS between the doors and at both ends, and the HANDLES on
   * them: a grip either side of a post a door's racer reaches, this high
   * over the snow, this long back up the platform toward him, this far
   * out from the post's centre. */
  post: { height: 1.0, radius: 0.045 },
  handle: { height: 0.92, reach: 0.32, out: 0.16 },
  /** THE FRAME over it: its two uprights this far out past the end posts,
   * its beam this high, and the banner under the beam this deep. */
  frame: { out: 0.9, height: 3.3, banner: 0.8 },
  /** THE PLATFORM'S WALLS: boards this high along both sides, this far
   * outside the platform's edge, from its back to the doors. */
  wall: { height: 0.45, out: 0.25 },
  /** HOW A DOOR FALLS: forward until it lies on the snow ahead of it (no
   * further than `most` rad from upright) in `fall` s, rocking back
   * `bounce` of it once on its stop. */
  drop: { most: 1.9, fall: 0.14, bounce: 0.08 },
} as const;

/** A door: its centre on the hinge line, its width, the snow under it, and
 * how far it falls, rad from upright — onto the snow ahead of it. */
export type CrossDoor = {
  x: number;
  y: number;
  z: number;
  across: number;
  width: number;
  open: number;
};

export type CrossGatePlan = {
  /** The middle of the doors' hinge line, on the snow. */
  x: number;
  y: number;
  z: number;
  /** The way down the course out of it, and its right, unit. */
  fx: number;
  fz: number;
  rx: number;
  rz: number;
  heading: number;
  /** Every door, left to right across the course. */
  doors: CrossDoor[];
  /** Every post's offset across the course from the middle, m, left to
   * right: one between each two doors and one at each end. */
  posts: number[];
  /** The platform's half-width and its length back up the course from the
   * doors, m. */
  half: number;
  back: number;
};

const plans = new WeakMap<Level, CrossGatePlan | null>();

/** THE START GATE of `level`'s ski cross, or null on a map with none. Kept
 * per map. */
export function crossGatePlan(level: Level): CrossGatePlan | null {
  if (plans.has(level)) return plans.get(level) ?? null;
  const xc = level.skiCross;
  const start = level.checkpoints[0];
  if (!xc || !start || level.grid.length === 0) {
    plans.set(level, null);
    return null;
  }
  // The hinge line across the course at the doors' arc: the track's own
  // station there, the way the start gate's checkpoint is laid.
  const pts = level.track.points;
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].s <= xc.from) i++;
  const a = pts[i];
  const b = pts[i + 1] ?? a;
  const k = b.s > a.s ? Math.min(1, Math.max(0, (xc.from - a.s) / (b.s - a.s))) : 0;
  const x = a.x + (b.x - a.x) * k;
  const z = a.z + (b.z - a.z) * k;
  const heading = start.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  // Each lane's door: the lane's offset across the course, its width the
  // lanes' spacing less a post.
  const lanes = level.grid.map((g) => (g.x - x) * rx + (g.z - z) * rz).sort((p, q) => p - q);
  const spacing =
    lanes.length > 1 ? (lanes[lanes.length - 1] - lanes[0]) / (lanes.length - 1) : 2.2;
  const width = spacing - 2 * (CROSS_GATE.post.radius + CROSS_GATE.door.gap);
  const H = CROSS_GATE.door.height;
  const doors: CrossDoor[] = lanes.map((across) => {
    const dx = x + rx * across;
    const dz = z + rz * across;
    const y = level.groundAt(dx, dz);
    // Down onto the snow its own height ahead, a hair over it.
    const fall = y - level.groundAt(dx + fx * H, dz + fz * H) - 0.03;
    const open = Math.min(CROSS_GATE.drop.most, Math.PI / 2 + Math.atan2(fall, H));
    return { x: dx, z: dz, y, across, width, open };
  });
  const posts = [lanes[0] - spacing / 2, ...lanes.map((l) => l + spacing / 2)];
  const plan: CrossGatePlan = {
    x,
    z,
    y: level.groundAt(x, z),
    fx,
    fz,
    rx,
    rz,
    heading,
    doors,
    posts,
    half: (start.width || spacing * lanes.length) / 2,
    back: xc.from,
  };
  plans.set(level, plan);
  return plan;
}

/** How long ago the doors dropped, s — negative under the starter's word.
 * GO comes when the run's lights have run out, its clock started at 0. */
export function sinceDrop(state: Pick<GameState, "phase" | "t" | "rules">): number {
  if (state.phase === "countdown") return -1;
  return state.t - state.rules.countdown;
}

/** HOW FAR A DOOR HAS FALLEN `t` s after the drop, rad forward of upright,
 * `open` the most it falls: thrown down by its spring and its weight,
 * rocking once on its stop. */
export function doorAngle(t: number, open: number): number {
  const D = CROSS_GATE.drop;
  if (t <= 0) return 0;
  if (t < D.fall) {
    // Falling from rest: the angle grows with the square of the time.
    const u = t / D.fall;
    return open * u * u;
  }
  // Off its stop and back down onto it, each bounce smaller.
  const after = t - D.fall;
  return open * (1 - D.bounce * Math.abs(Math.sin(after * 30)) * Math.exp(-after * 14));
}
