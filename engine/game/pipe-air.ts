// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR OFF A PIPE'S WALL (R39) — what a pipe skier's own body does
// between leaving the vert and meeting the wall again, which the air's
// levelling hands (`flight.ts`, made for a kicker's flight over a landing
// below) cannot: those level him to the WORLD, and the snow a pipe skier
// lands on stands at 70–80°.
//
// THE LIP. Off a wall standing at 83° the flight leaves nearly straight up,
// and a body carried by the snow's own line would drift a few metres out
// over the deck by the time it came down — as a real one would, did the
// skier not PUSH off the vert: his legs straighten along the wall's normal
// as he leaves it, into the pipe, by as much as brings him back down onto
// the wall `PIPE_AIR.landBelow` m under the coping (a pipe skier lands at
// about the height he left — `docs/freestyle.md` § *Halfpipe*), never more
// than `PIPE_AIR.popMost` m/s either way. And he stops turning with the
// transition: the rate the curve of the wall put into his body is taken
// out, so nothing he did not throw is read as a trick.
//
// THE TURN ROUND. Up the wall his skis point up it; down it, down it. A
// straight air turns him from the one to the other about the wall's
// normal — no trick, and no judge counts it. So while he is over the pipe
// and throws nothing (no stroke owed, `strokes.ts`), his body is turned
// toward THE LANDING'S OWN FRAME — his up the normal of the wall where the
// flight comes down, his skis along the way he will be going there (tails
// first if he is riding switch) — the rest of the turn spread over the
// flight left. It is a turn of the frame, never of the body's rates, so
// the strokes' and the score's count of what he threw is untouched.
//
// Pure of every stream; it runs only on a map with a pipe (`Level.pipe`).

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromAxisAngle,
  multiply,
  normalize,
  rotate,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { nearestAcross, pipeCoords, wallAt, wallShare, type PipeFrame } from "../mapgen/pipe.ts";
import type { Level, Vec3 } from "../mapgen/types.ts";
import type { GameState, PipeHit, SkierState } from "./state.ts";
import { TUNING } from "./defs/tuning.ts";

/** THE PIPE SKIER'S HANDS. */
export const PIPE_AIR = {
  /** Where on the wall the lip aims him back down, m under the coping. */
  landBelow: 1.2,
  /** The most the lip's push changes his way across the pipe, m/s. */
  popMost: 2.5,
  /** The flight traced ahead for the landing, s, and its step, s. */
  horizon: 4,
  step: 1 / 60,
  /** The least flight the turn round is spread over, s. */
  least: 0.12,
} as const;

/** WHERE THIS FLIGHT COMES DOWN ON THE PIPE: the time, s, where the CoG
 * comes back within its standing height of the surface, the CoG and its
 * velocity there and the snow's normal at the point nearest it; null if it
 * does not within the horizon or leaves the pipe first. */
export type PipeLanding = { t: number; at: Vec3; v: Vec3; n: Vec3 };

export function pipeLanding(level: Level, c: SkierState, fall: number): PipeLanding | null {
  const p = level.pipe;
  if (!p) return null;
  const stand = c.spec.cogHeight;
  let x = c.x;
  let y = c.y;
  let z = c.z;
  let vy = c.vy;
  const A = PIPE_AIR;
  for (let t = A.step; t <= A.horizon; t += A.step) {
    x += c.vx * A.step;
    z += c.vz * A.step;
    vy -= fall * A.step;
    y += vy * A.step;
    if (vy > 0) continue;
    const gap = surfaceGap(level, p, x, y, z);
    if (gap === null || gap > stand) continue;
    const n = { x: 0, y: 1, z: 0 };
    if (level.normalNear) level.normalNear(x, y, z, n);
    return { t, at: { x, y, z }, v: { x: c.vx, y: vy, z: c.vz }, n };
  }
  return null;
}

/** How far a point stands off the pipe's surface, m (negative inside the
 * snow); null off the pipe's walls, where the vertical gap is the answer. */
function surfaceGap(level: Level, p: PipeFrame, x: number, y: number, z: number): number | null {
  const { along, across } = pipeCoords(p, x, z);
  const s = p.section;
  if (wallShare(p, along) < 0.999 || Math.abs(across) > s.half + s.deck) {
    return y - level.groundAt(x, z);
  }
  const floor = p.yAt(along) - s.height;
  const w = y - floor;
  const near = nearestAcross(s, across, w);
  const h = wallAt(s, near).h;
  const d = hypot(near - across, h - w);
  return w < wallAt(s, across).h ? -d : d;
}

/** Whether `(x, z)` is over the pipe's full walls, and how far across. */
function overWalls(p: PipeFrame, x: number, z: number): { across: number } | null {
  const { along, across } = pipeCoords(p, x, z);
  if (wallShare(p, along) < 0.999) return null;
  if (Math.abs(across) > p.section.half + p.section.deck) return null;
  return { across };
}

/** THE PIPE'S HANDS on the step just taken: the lip on the step he leaves
 * a wall, the turn round every step he is in the air over the pipe. */
export function stepPipeAir(state: GameState, fall: number): void {
  const level = state.level;
  const p = level.pipe;
  const c = state.skier;
  if (!p || !c.airborne || c.thrown !== null) return;
  const over = overWalls(p, c.x, c.z);
  if (!over) return;
  const s = p.section;
  const dt = TUNING.dt;
  // THE LIP: the first step off a wall high on its transition.
  if (c.airTime <= dt * 1.5 && Math.abs(over.across) > s.flat + 0.5 * (s.arcEnd - s.flat)) {
    lip(c, p, over.across, fall);
  }
  // THE TURN ROUND, while nothing is thrown.
  const k = state.tricks;
  const busy = k.flipGoal !== 0 || k.flipDone !== 0 || k.spinGoal !== 0 || k.spinDone !== 0;
  if (busy) return;
  const down = pipeLanding(level, c, fall);
  if (!down) return;
  turnRound(c, down, dt / Math.max(PIPE_AIR.least, down.t));
}

/** THE PUSH OFF THE VERT: his way across the pipe set so the flight comes
 * back down onto the wall `landBelow` under the coping, within `popMost`;
 * and the wall's turn taken out of his body. */
function lip(c: SkierState, p: PipeFrame, across: number, fall: number): void {
  const s = p.section;
  const A = PIPE_AIR;
  const side = Math.sign(across) || 1;
  // Where he aims to come down: the wall's point `landBelow` under the
  // coping, and his CoG standing off it along its normal.
  const h = s.height - A.landBelow;
  const u = s.flat + Math.sqrt(Math.max(0, s.radius * s.radius - (s.radius - h) ** 2));
  const slope = wallAt(s, u).dh;
  const nh = slope / hypot(1, slope);
  const nv = 1 / hypot(1, slope);
  const stand = c.spec.cogHeight;
  const { along } = pipeCoords(p, c.x, c.z);
  const floor = p.yAt(along) - s.height;
  const yGoal = floor + h + stand * nv;
  const uGoal = u - stand * nh;
  // The flight's time to that height, on its way down.
  const dy = c.y - yGoal;
  const disc = c.vy * c.vy + 2 * fall * dy;
  if (disc <= 0) return;
  const T = (c.vy + Math.sqrt(disc)) / fall;
  if (T <= 0) return;
  // His way across now (out of the pipe positive) and the way he needs.
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const rx = fz;
  const rz = -fx;
  const now = (c.vx * rx + c.vz * rz) * side;
  const want = (uGoal - Math.abs(across)) / T;
  const push = clamp(want - now, -A.popMost, A.popMost);
  c.vx += push * side * rx;
  c.vz += push * side * rz;
  c.wx = 0;
  c.wy = 0;
  c.wz = 0;
}

/** A share `share` of the turn from the body's attitude to the landing's. */
function turnRound(c: SkierState, down: PipeLanding, share: number): void {
  const up = down.n;
  // The way he will be going there, along the snow.
  const vn = down.v.x * up.x + down.v.y * up.y + down.v.z * up.z;
  let fx = down.v.x - vn * up.x;
  let fy = down.v.y - vn * up.y;
  let fz = down.v.z - vn * up.z;
  const fl = hypot3(fx, fy, fz);
  if (fl < 1e-3) return;
  fx /= fl;
  fy /= fl;
  fz /= fl;
  // Tails first if he is riding switch now.
  const now = rotate(c.q, { x: 0, y: 0, z: 1 });
  const v = hypot3(c.vx, c.vy, c.vz) || 1;
  if ((now.x * c.vx + now.y * c.vy + now.z * c.vz) / v < -0.2) {
    fx = -fx;
    fy = -fy;
    fz = -fz;
  }
  // right = up × forward (the body's x = y × z).
  const rx = up.y * fz - up.z * fy;
  const ry = up.z * fx - up.x * fz;
  const rz = up.x * fy - up.y * fx;
  const target = fromBasis(rx, ry, rz, up.x, up.y, up.z, fx, fy, fz);
  // The error, world frame: target · q⁻¹, the shorter way round.
  const inv = { w: c.q.w, x: -c.q.x, y: -c.q.y, z: -c.q.z };
  let e = multiply(target, inv);
  if (e.w < 0) e = { w: -e.w, x: -e.x, y: -e.y, z: -e.z };
  const angle = 2 * Math.acos(clamp(e.w, -1, 1));
  const sin = Math.sqrt(Math.max(0, 1 - e.w * e.w));
  if (angle < 1e-4 || sin < 1e-6) return;
  const turn = fromAxisAngle(e.x / sin, e.y / sin, e.z / sin, angle * clamp(share, 0, 1));
  c.q = normalize(multiply(turn, c.q));
}

/** The attitude whose body axes are the given right, up and forward. */
function fromBasis(
  m00: number,
  m10: number,
  m20: number,
  m01: number,
  m11: number,
  m21: number,
  m02: number,
  m12: number,
  m22: number,
): { w: number; x: number; y: number; z: number } {
  // Columns are the body's x, y and z in the world: the rotation matrix.
  const tr = m00 + m11 + m22;
  let w: number;
  let x: number;
  let y: number;
  let z: number;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = s / 4;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = s / 4;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = s / 4;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = s / 4;
  }
  return normalize({ w, x, y, z });
}

/** THE HIT A FLIGHT MADE (`PipeHit`), filed as it lands: it left the snow
 * at `(fromX, fromZ)` and its CoG peaked at `peak`; the skier is where the
 * snow took him back. Null for a flight not off the pipe's walls. */
export function pipeHit(
  level: Level,
  c: SkierState,
  fromX: number,
  fromZ: number,
  peak: number,
): PipeHit | null {
  const p = level.pipe;
  if (!p) return null;
  const from = pipeCoords(p, fromX, fromZ);
  if (wallShare(p, from.along) < 0.5) return null;
  const s = p.section;
  const over = peak - p.yAt(from.along) - c.spec.cogHeight;
  const at = pipeCoords(p, c.x, c.z);
  const floor = p.yAt(at.along) - s.height;
  const near = Math.abs(nearestAcross(s, at.across, c.y - floor));
  const on = near >= s.half - 0.05 ? "deck" : near <= s.flat + 0.5 ? "flat" : "wall";
  return {
    side: Math.sign(from.across) || 1,
    over: Math.max(0, over),
    met: wallAt(s, near).h - s.height,
    on,
  };
}
