// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LOOKING ROUND FROM THE LIFT — the free look a rider has while he is
// carried (`lift-ride.ts`'s "ride" phase): a finger dragged over the glass
// on a phone, or the pointer held and dragged on a desktop, swings the lens
// about him — round to the valley behind the chair, down onto the run under
// it, up the rope to the top station — the way a rider turns in his seat.
// Nothing about the ride changes: the lift still has him, and the look is
// the lens's alone. It goes home as the lift lets him go (stood off at the
// top, or jumped off), eased back behind him over a beat rather than cut.
// Three-free, so the suite reads it (`tests/lift_gaze_test.ts`).
//
// The drag GRABS THE WORLD: the finger pulled right turns the view left, and
// pulled down tips it up, as a picture under a finger is moved.

import type { LiftRide } from "@engine";

export const LIFT_GAZE = {
  /** How far a drag the picture's height turns the look, as a share of the
   * lens's vertical fov: a little more than the fov, so a thumb's sweep
   * across a phone turns him well round. */
  turn: 1.3,
  /** How far the look tips, rad: down onto the snow under the chair
   * (positive) and up over his head (negative). */
  down: 1.0,
  up: 0.55,
  /** How briskly the look goes home once the lift lets him go, 1/s. */
  home: 5,
  /** A pointer's travel, px, before it is a look rather than a press — the
   * tuck lever's thumb is a press until it drags this far. */
  slop: 8,
  /** How high over his drawn point the lens is swung about, m: about his
   * chest, so the turn reads as his own. */
  pivot: 0.6,
  /** How close over the snow a swung lens may come, m. */
  clearance: 0.5,
} as const;

/** The look's offset from the lift's own lens: `yaw` rad turned (the
 * heading's sense, clockwise from above) and `pitch` rad tipped down. */
export type LiftGaze = { yaw: number; pitch: number };

export function createLiftGaze(): LiftGaze {
  return { yaw: 0, pitch: 0 };
}

/** Whether the lift has him on its rope — the one time he may look round. */
export function gazeAllowed(lift: LiftRide | null): boolean {
  return lift?.phase === "ride";
}

/** A drag of `dx`, `dy` px over a picture `height` px tall seen through a
 * vertical fov of `fov` deg: the world grabbed and moved with it. */
export function dragGaze(g: LiftGaze, dx: number, dy: number, height: number, fov: number): void {
  if (!(height > 0)) return;
  const perPx = (LIFT_GAZE.turn * fov * Math.PI) / 180 / height;
  g.yaw = wrap(g.yaw - dx * perPx);
  g.pitch = Math.max(-LIFT_GAZE.up, Math.min(LIFT_GAZE.down, g.pitch - dy * perPx));
}

/** One frame, `dt` s after the last: carried, the look stays where the
 * drags left it; off the lift it goes home behind him, the short way round. */
export function stepGaze(g: LiftGaze, lift: LiftRide | null, dt: number): void {
  if (gazeAllowed(lift)) return;
  const k = Math.exp(-LIFT_GAZE.home * dt);
  g.yaw = wrap(g.yaw) * k;
  g.pitch *= k;
  if (Math.abs(g.yaw) < 1e-3) g.yaw = 0;
  if (Math.abs(g.pitch) < 1e-3) g.pitch = 0;
}

/** Whether the look is anywhere but behind him. */
export function gazing(g: LiftGaze): boolean {
  return g.yaw !== 0 || g.pitch !== 0;
}

function wrap(a: number): number {
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
}

type P = { x: number; y: number; z: number };

/** The lens `eye` → `target` swung about `pivot` by the look: turned `yaw`
 * about the vertical, then tipped `pitch` about the level axis across the
 * turned look — the eye's distance from the pivot, and where in the frame
 * the pivot stands, both kept. */
export function swingLens(eye: P, target: P, pivot: P, g: LiftGaze): { eye: P; target: P } {
  const c = Math.cos(g.yaw);
  const s = Math.sin(g.yaw);
  const yawed = (p: P): P => {
    const x = p.x - pivot.x;
    const z = p.z - pivot.z;
    return { x: x * c + z * s, y: p.y - pivot.y, z: -x * s + z * c };
  };
  const e = yawed(eye);
  const t = yawed(target);
  // The level axis across the look: right of the eye-to-target line.
  const fx = t.x - e.x;
  const fz = t.z - e.z;
  const f = Math.hypot(fx, fz);
  if (f < 1e-6 || g.pitch === 0) {
    return {
      eye: { x: e.x + pivot.x, y: e.y + pivot.y, z: e.z + pivot.z },
      target: { x: t.x + pivot.x, y: t.y + pivot.y, z: t.z + pivot.z },
    };
  }
  // Right of a look along (fx, fz) is (fz, −fx) — the heading clockwise
  // from above — and a positive turn about it (Rodrigues) tips the look down.
  const ax = fz / f;
  const az = -fx / f;
  const cp = Math.cos(g.pitch);
  const sp = Math.sin(g.pitch);
  const tipped = (p: P): P => {
    // k × p with k = (ax, 0, az), and k·p.
    const cx = -az * p.y;
    const cy = az * p.x - ax * p.z;
    const cz = ax * p.y;
    const d = ax * p.x + az * p.z;
    return {
      x: p.x * cp + cx * sp + ax * d * (1 - cp) + pivot.x,
      y: p.y * cp + cy * sp + pivot.y,
      z: p.z * cp + cz * sp + az * d * (1 - cp) + pivot.z,
    };
  };
  return { eye: tipped(e), target: tipped(t) };
}

/** The look as the renderer keeps it: the drags handed in between frames
 * (`drag`, CSS px), and each frame (`frame`) the look stepped — the drags
 * taken while the lift carries him, home once it lets him go — and the
 * lift's lens swung by it about `at` (his drawn point), kept `clearance` m
 * over the snow, for a picture `height` px tall; null while the look is
 * behind him. */
export function createGazeRig() {
  const g = createLiftGaze();
  let dx = 0;
  let dy = 0;
  return {
    drag(x: number, y: number): void {
      dx += x;
      dy += y;
    },
    frame<L extends { eye: P; target: P; fov: number; roll: number }>(
      lens: L,
      at: P,
      lift: LiftRide | null,
      dt: number,
      height: number,
      level: { groundAt: (x: number, z: number) => number },
    ): L | null {
      if (gazeAllowed(lift)) dragGaze(g, dx, dy, height, lens.fov);
      dx = dy = 0;
      stepGaze(g, lift, Math.min(dt, 0.1));
      if (!gazing(g)) return null;
      const pivot = { x: at.x, y: at.y + LIFT_GAZE.pivot, z: at.z };
      const { eye, target } = swingLens(lens.eye, lens.target, pivot, g);
      eye.y = Math.max(eye.y, level.groundAt(eye.x, eye.z) + LIFT_GAZE.clearance);
      return { ...lens, eye, target, roll: 0 };
    },
  };
}
