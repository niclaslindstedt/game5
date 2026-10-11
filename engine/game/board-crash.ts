// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWBOARDER'S FALLS — what is a board's own in a wipeout (`crash.ts`),
// its numbers and their sources in `defs/board-moves.ts` (`TUNING.board`).
//
// THE CAUGHT DOWNHILL EDGE: the edge LEADING a slide across the board set
// down into it — at speed past `crash.boardDig` with the slide past
// `crash.catchSlip` (the fast catch, `crash.ts`'s `edgeCatching`), or at a
// crawl, the board let flat or onto it on a slow traverse or a sideslip let
// go, past `catch.dig` with the slide at `catch.slip` (`slowCatch`). The
// board stops dead across its slide and the body goes on over its edge:
// off the HEEL edge he is SLAMMED onto his back (`slam`), off the TOE edge
// thrown forward onto his knees, his hands and his face (`faceplant`) —
// two causes of their own, never a ski's `catch`, which twists a knee over
// a ski that bites (`body.ts`). Here the blows are the body's own meeting
// the snow: the seat, the hands put down behind or ahead of him, the back
// of the head or the face.
//
// THE BODY THROWN FACES THE TOE EDGE (`boardBody`): a rider stands across
// his board, so the ragdoll is stood up turned a quarter round from the
// skier's, its left foot over the nose under a regular rider.
//
// THE BOARD STAYS ON (`strapBoard`, `holdStance`): no binding lets go, so
// no board is lost — the feet are held their stance apart on the deck for
// the whole fall (`Thrown.board`), and he gets up where he lies, still
// strapped in.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromAxisAngle,
  multiply,
  rotate,
  type Quat,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { TUNING } from "./defs/tuning.ts";
import { edgeSideOf } from "./limits.ts";
import type { CrashCause, SkierState, Thrown } from "./state.ts";

/** The slide across a board (or a pair) toward its right edge, m/s. */
export function slideAcross(c: SkierState): number {
  return c.vx * Math.cos(c.heading) - c.vz * Math.sin(c.heading);
}

/** THE CAUGHT EDGE AT A CRAWL (`catch`): a board's edge leading its slide
 * set into it past `dig`, the slide `slip` m/s or more, out of a skid
 * (`crash.catchSkid`) and under `most` m/s — the fall a slow traverse or a
 * sideslip let go past flat ends in. Never on skis, and never bogged
 * (`trench.ts`): a board rocked in its hole is held by the hole's walls. */
export function slowCatch(c: SkierState): boolean {
  const C = TUNING.board.catch;
  if (!c.spec.board || c.airborne || c.thrown !== null || c.trench > 0) return false;
  if (c.skid >= TUNING.crash.catchSkid || c.speed > C.most) return false;
  const across = slideAcross(c);
  return Math.abs(across) >= C.slip && c.edge * Math.sign(across) > C.dig;
}

/** WHAT A CAUGHT EDGE THROWS HIM BY: on skis the `catch`; on a board the
 * edge leading the slide — the heel's a `slam` onto his back, the toe's a
 * `faceplant`. */
export function caughtCause(c: SkierState): CrashCause {
  if (!c.spec.board) return "catch";
  const lead = Math.sign(slideAcross(c)) || Math.sign(c.edge) || 1;
  return edgeSideOf(c.spec, lead) === "toe" ? "faceplant" : "slam";
}

/** The skier's frame the ragdoll is stood up in: on skis his own; on a
 * board turned a quarter round to face its TOE edge. */
export function boardBody(c: SkierState): Quat {
  const board = c.spec.board;
  if (!board) return c.q;
  const toe = board.lead === "regular" ? 1 : -1;
  return multiply(c.q, fromAxisAngle(0, 1, 0, (toe * Math.PI) / 2));
}

/** THE SLAM AND THE FACEPLANT: the body, going at `v0`, turning at `own`
 * (world frame), sent over the edge that caught — head first toward it, at
 * the slide's speed over his height (`slam.whip`, never under `.least`,
 * held to `crash.maxSpin`) — the way he leaves (`v`), the turn (`w`) and
 * the heading he goes over along. */
export function slamThrow(
  c: SkierState,
  cause: CrashCause,
  v0: Vec3,
  own: Vec3,
): { v: Vec3; w: Vec3; heading: number } {
  const S = TUNING.board.slam;
  const K = TUNING.crash;
  const across = slideAcross(c);
  const lead = Math.sign(across) || Math.sign(c.edge) || 1;
  const r = rotate(c.q, { x: lead, y: 0, z: 0 });
  const flat = hypot(r.x, r.z) || 1;
  const dx = r.x / flat;
  const dz = r.z / flat;
  const spin = clamp(S.whip * Math.abs(across), S.least, K.maxSpin);
  const up = Math.max(0, v0.y) * K.keep + (cause === "faceplant" ? S.up : 0);
  return {
    v: { x: v0.x * K.keep, y: up, z: v0.z * K.keep },
    w: {
      x: dz * spin + own.x * K.carry,
      y: own.y * K.carry,
      z: -dx * spin + own.z * K.carry,
    },
    heading: Math.atan2(dx, dz),
  };
}

/** The points of the body a strapped board holds. */
export type FeetPoints = { footL: number; footR: number; kneeL: number; kneeR: number };

/** THE BOARD KEPT ON A THROWN BODY: its feet spread to the board's stance
 * along the line they stand on (each knee with its foot, the motion kept),
 * and `Thrown.board` set — `back` for a fall onto his back. Nothing on skis. */
export function strapBoard(b: Thrown, c: SkierState, back: boolean, R: FeetPoints): void {
  const board = c.spec.board;
  if (!board) return;
  const P = b.points;
  const L = b.last;
  const l = 3 * R.footL;
  const r = 3 * R.footR;
  const ux = P[r] - P[l];
  const uy = P[r + 1] - P[l + 1];
  const uz = P[r + 2] - P[l + 2];
  const d = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
  const grow = (board.stance - d) / 2 / d;
  const shift = (i: number, s: number): void => {
    const j = 3 * i;
    P[j] += ux * grow * s;
    P[j + 1] += uy * grow * s;
    P[j + 2] += uz * grow * s;
    L[j] += ux * grow * s;
    L[j + 1] += uy * grow * s;
    L[j + 2] += uz * grow * s;
  };
  shift(R.footL, -1);
  shift(R.kneeL, -1);
  shift(R.footR, 1);
  shift(R.kneeR, 1);
  b.board = { stance: board.stance, back };
}

/** THE DECK BETWEEN THE FEET: points `a` and `b` (the two feet, of equal
 * weight) of `P` pulled back to `stance` m apart — one pass of the
 * ragdoll's bones, the board a bone between the ankles. */
export function holdStance(P: number[], a: number, b: number, stance: number): void {
  const i = 3 * a;
  const j = 3 * b;
  const dx = P[j] - P[i];
  const dy = P[j + 1] - P[i + 1];
  const dz = P[j + 2] - P[i + 2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
  const s = (d - stance) / d / 2;
  P[i] += dx * s;
  P[i + 1] += dy * s;
  P[i + 2] += dz * s;
  P[j] -= dx * s;
  P[j + 1] -= dy * s;
  P[j + 2] -= dz * s;
}
