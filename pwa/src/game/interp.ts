// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DRAWING BETWEEN TWO STEPS. The engine steps at 120 Hz and a display draws
// at whatever it draws at, so a frame usually falls part of the way through
// a step — the run loop hands that share over as `alpha`. The engine keeps
// no previous pose, so the renderer keeps its own: the pose it saw at the
// last frame and the step it was taken at. When the frame finds the state
// `k` steps further on, the step BEFORE the current one is estimated as a
// `1/k` share back along that line, and the frame is drawn `alpha` of the way
// from it to the current one — which is the textbook interpolation with the
// one missing sample reconstructed.
//
// Three-free, so the suite reads it (`tests/world_render_test.ts`).

import type { Quat, SkierState, Thrown } from "@engine";

export type Pose = {
  x: number;
  y: number;
  z: number;
  q: Quat;
};

export type PoseTrack = {
  /** The step the `curr` pose was read at; -1 before the first frame. */
  tick: number;
  curr: Pose;
  /** The estimated pose one step before `curr`. */
  prev: Pose;
};

function pose(): Pose {
  return { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
}

export function createTrack(): PoseTrack {
  return { tick: -1, curr: pose(), prev: pose() };
}

function copyPose(to: Pose, from: { x: number; y: number; z: number; q: Quat }): void {
  to.x = from.x;
  to.y = from.y;
  to.z = from.z;
  to.q.x = from.q.x;
  to.q.y = from.q.y;
  to.q.z = from.q.z;
  to.q.w = from.q.w;
}

/** Normalised linear blend of two quaternions along the short way. */
export function nlerp(a: Quat, b: Quat, t: number, out: Quat): Quat {
  const s = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w < 0 ? -1 : 1;
  out.x = a.x + (b.x * s - a.x) * t;
  out.y = a.y + (b.y * s - a.y) * t;
  out.z = a.z + (b.z * s - a.z) * t;
  out.w = a.w + (b.w * s - a.w) * t;
  const n = Math.hypot(out.x, out.y, out.z, out.w) || 1;
  out.x /= n;
  out.y /= n;
  out.z /= n;
  out.w /= n;
  return out;
}

/** A jump further than this between two frames is a reset, m — drawn as a
 * cut, never swept across the map. */
const CUT = 8;

/** Take in the skier as the state has it at `tick`. */
export function observe(track: PoseTrack, skier: SkierState, tick: number): void {
  if (tick === track.tick) return;
  const k = tick - track.tick;
  const jumped =
    track.tick < 0 ||
    k <= 0 ||
    Math.hypot(skier.x - track.curr.x, skier.y - track.curr.y, skier.z - track.curr.z) > CUT;
  if (jumped) {
    copyPose(track.prev, skier);
    copyPose(track.curr, skier);
  } else {
    // prev ← the pose one step before the new current, on the line from
    // the last one seen to it.
    const f = 1 - 1 / k;
    const c = track.curr;
    track.prev.x = c.x + (skier.x - c.x) * f;
    track.prev.y = c.y + (skier.y - c.y) * f;
    track.prev.z = c.z + (skier.z - c.z) * f;
    nlerp(c.q, skier.q, f, track.prev.q);
    copyPose(track.curr, skier);
  }
  track.tick = tick;
}

/** The pose to draw, `alpha` of a step on from `prev`. */
export function sample(track: PoseTrack, alpha: number, out: Pose): Pose {
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  const p = track.prev;
  const c = track.curr;
  out.x = p.x + (c.x - p.x) * a;
  out.y = p.y + (c.y - p.y) * a;
  out.z = p.z + (c.z - p.z) * a;
  nlerp(p.q, c.q, a, out.q);
  return out;
}

/** THE RIDER THROWN, drawn between two steps the same way: his centre, his
 * tumble and every point of his body. Under the death cam's slow motion a
 * step lands every few frames, and a body posed off the step alone would
 * visibly hop. */
export type BodyTrack = {
  tick: number;
  curr: Thrown | null;
  prev: { x: number; y: number; z: number; tumble: number; points: number[] };
  /** The body as last drawn, rewritten by `sampleBody`. */
  drawn: Thrown | null;
};

export function createBodyTrack(): BodyTrack {
  return {
    tick: -1,
    curr: null,
    prev: { x: 0, y: 0, z: 0, tumble: 0, points: [] },
    drawn: null,
  };
}

/** Take in the thrown body as the state has it at `tick` (null: on his skis). */
export function observeBody(track: BodyTrack, body: Thrown | null, tick: number): void {
  if (tick === track.tick) return;
  const k = tick - track.tick;
  const c = track.curr;
  const p = track.prev;
  if (!body || !c || k <= 0) {
    if (body) {
      p.x = body.x;
      p.y = body.y;
      p.z = body.z;
      p.tumble = body.tumble;
      p.points = body.points.slice();
    }
  } else {
    const f = 1 - 1 / k;
    p.x = c.x + (body.x - c.x) * f;
    p.y = c.y + (body.y - c.y) * f;
    p.z = c.z + (body.z - c.z) * f;
    p.tumble = c.tumble + (body.tumble - c.tumble) * f;
    for (let i = 0; i < body.points.length; i++) {
      p.points[i] = c.points[i] + (body.points[i] - c.points[i]) * f;
    }
  }
  // The state's arrays are stepped in place: keep copies.
  track.curr = body ? { ...body, points: body.points.slice(), last: [] } : null;
  track.tick = tick;
}

/** The body to draw, `alpha` of a step on (the track's `drawn`, rewritten),
 * or null when the skier is on his skis. */
export function sampleBody(track: BodyTrack, alpha: number): Thrown | null {
  const c = track.curr;
  if (!c) return null;
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  const p = track.prev;
  const out = (track.drawn ??= { ...c, points: c.points.slice() });
  const points = out.points;
  Object.assign(out, c);
  out.points = points;
  out.x = p.x + (c.x - p.x) * a;
  out.y = p.y + (c.y - p.y) * a;
  out.z = p.z + (c.z - p.z) * a;
  out.tumble = p.tumble + (c.tumble - p.tumble) * a;
  for (let i = 0; i < c.points.length; i++) {
    points[i] = p.points[i] + (c.points[i] - p.points[i]) * a;
  }
  return out;
}
