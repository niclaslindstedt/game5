// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS'S INERTIA — a second-order follower, the camera operator's arm
// as a mass on a damped spring. Every reading a boom chases (its yaw, its
// height, the slope it leans to, the pitch of its look) goes through one of
// these rather than a first-order ease: a first-order ease starts moving at
// its fastest the instant the target jumps, which reads as a lens with no
// weight; a second-order one has to be ACCELERATED, so it gathers into a
// move and settles out of it, and that is what a heavy head on a crane
// looks like.
//
// THE POLES. Three numbers shape the response, and between them they place
// the system's two poles at s = ω(−ζ ± √(ζ² − 1)), ω = 2πf:
//
//   * `f`, the natural frequency, Hz — how quickly it answers at all;
//   * `zeta`, the damping ratio — under 1 it overshoots and swings back
//     (the horizon BREATHES after a landing), 1 is critically damped (the
//     quickest settle with no overshoot), over 1 it creeps in;
//   * `r`, the response — 0 starts from rest, 1 matches a step at once,
//     over 1 ANTICIPATES (leads the target, the way an operator swings into
//     a turn he sees coming), under 0 winds up against it first.
//
// Integrated semi-implicitly (the position, then the velocity) with the
// spring's mass kept above what the frame's `dt` can integrate stably, so a
// long frame on a slow phone is a slower lens, never an exploding one.
// Three-free and DOM-free; `tests/world_render_test.ts` holds it.

/** Where a follower's two poles stand (the header says what each does). */
export type Poles = { f: number; zeta: number; r: number };

/** One follower's memory: where it is, how fast it is moving, and the
 * target it was handed last frame (for the target's own velocity). */
export type Spring = { y: number; v: number; x: number };

export function createSpring(at = 0): Spring {
  return { y: at, v: 0, x: at };
}

/** Put the follower AT `at`, at rest — a new run, a reset. */
export function settle(s: Spring, at: number): number {
  s.y = at;
  s.v = 0;
  s.x = at;
  return at;
}

/** Advance `s` toward `x` by `dt` s under `poles`; returns where it is.
 * `xd` is the target's own velocity when the caller knows a better one
 * than the difference of two frames — a TREND, so `r` leads the drift and
 * not every bump in it (`r` = 2 then tracks a steady ramp with no lag). */
export function follow(s: Spring, poles: Poles, x: number, dt: number, xd?: number): number {
  return step(s, poles, x, xd ?? (dt <= 0 ? 0 : (x - s.x) / dt), dt);
}

/** `follow` for an ANGLE, rad: the target is taken the short way round,
 * and the follower is free to wind past ±π (read it through `sin`/`cos`). */
export function followAngle(s: Spring, poles: Poles, x: number, dt: number): number {
  const near = s.y + wrap(x - s.y);
  const xd = dt <= 0 ? 0 : wrap(x - s.x) / dt;
  return step(s, poles, near, xd, dt);
}

function step(s: Spring, p: Poles, x: number, xd: number, dt: number): number {
  s.x = x;
  if (dt <= 0) return s.y;
  const w = 2 * Math.PI * p.f;
  const k1 = (2 * p.zeta) / w;
  const k2 = 1 / (w * w);
  const k3 = (p.r * p.zeta) / w;
  // The mass the frame can carry: below it the integration rings and grows.
  const m = Math.max(k2, (dt * dt) / 2 + (dt * k1) / 2, dt * k1);
  s.y += dt * s.v;
  s.v += (dt * (s.x + k3 * xd - s.y - k1 * s.v)) / m;
  return s.y;
}

function wrap(a: number): number {
  let d = a % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
