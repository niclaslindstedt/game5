// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CUT BY A LIFT'S ROPE — on a run that carries its injuries (`gore.ts`), a
// body that meets a rope going faster than `CABLE.cut.speed` across it is
// not stopped, thrown or put on it: the steel goes through him like a
// wire, and every bone it crosses is cut there. The skis he stands on are
// cut where it crosses them with him (`ski-cut.ts`), and everything it cut carries
// on at the speed it was going. Slower, the rope is the grind's and the
// straddle's (`cable.ts`), or a body passes it by as before; with the
// injuries off nothing here runs.
//
// THE CUT IS A PLANE. In the frame that moves with him, the rope is a line
// swept through his body by his own velocity: the plane it sweeps is the
// one the steel leaves him cut along. Seen down the rope, it is a point,
// and each bone of him (a limb's, the neck's, the trunk's) a segment going
// by it: a bone the point lies in the path of this step, within the bone's
// own thickness, is cut. Which piece goes is the bone's (`BONES` below): a
// shin off at the knee, a leg at the hip, a forearm at the elbow, an arm at
// the shoulder, the head at the neck, and the trunk in two at the waist,
// the chest or the belly opened where the rope went in.
//
// Nothing here is random, and nothing reads a clock but the run's.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { CABLE } from "./defs/cable.ts";
import { TUNING } from "./defs/tuning.ts";
import { bodyThrown, throwRider } from "./crash.ts";
import { boardBody } from "./board-crash.ts";
import { carryOn, sever } from "./gore.ts";
import { liftPlans, ropeAt, upRope } from "./lift-line.ts";
import type { LiftPlan } from "./lift-line.ts";
import { RAGDOLL as R } from "./ragdoll-points.ts";
import { cutSkis, skisCrossed } from "./ski-cut.ts";
import { letGo } from "./lone-skis.ts";
import type { GoreOpen, GorePiece } from "./gore-state.ts";
import type { GameEvent, GameState } from "./state.ts";

const C = CABLE.cut;
const dt = TUNING.dt;

/** The middle of the shoulders (−1) and of the hips (−2), as `gore.ts`
 * reads them. */
const NECK = -1;
const WAIST = -2;

/** EACH BONE THE ROPE CAN GO THROUGH: its two ends (ragdoll points, or the
 * neck's and the waist's middles), how thick it is, and what goes when it
 * is cut — in the order a cut takes them, the far piece before the one
 * that holds it, the trunk last. */
type Bone = {
  a: number;
  b: number;
  thick: number;
  piece: GorePiece | null;
  open: GoreOpen | null;
};

const BONES: readonly Bone[] = [
  { a: R.elbowL, b: R.handL, thick: C.limb, piece: "forearmL", open: null },
  { a: R.elbowR, b: R.handR, thick: C.limb, piece: "forearmR", open: null },
  { a: R.kneeL, b: R.footL, thick: C.limb, piece: "shinL", open: null },
  { a: R.kneeR, b: R.footR, thick: C.limb, piece: "shinR", open: null },
  { a: R.shoulderL, b: R.elbowL, thick: C.limb, piece: "armL", open: null },
  { a: R.shoulderR, b: R.elbowR, thick: C.limb, piece: "armR", open: null },
  { a: R.hipL, b: R.kneeL, thick: C.limb * 1.4, piece: "legL", open: null },
  { a: R.hipR, b: R.kneeR, thick: C.limb * 1.4, piece: "legR", open: null },
  { a: NECK, b: R.head, thick: C.limb, piece: "head", open: null },
  // Across the hips and across the shoulders: the rope come up the body's
  // middle, between the legs, opens what it goes into.
  { a: R.hipL, b: R.hipR, thick: C.trunk, piece: null, open: "abdomen" },
  { a: R.shoulderL, b: R.shoulderR, thick: C.trunk, piece: null, open: "chest" },
  // The spine: the body in two at the waist, opened where it went in.
  { a: WAIST, b: NECK, thick: C.trunk, piece: "lower", open: null },
];

/** A point of a body's points (`RAGDOLL` order, x y z each), or the
 * middle of its shoulders or its hips, into `out`. */
function at(P: readonly number[], i: number, out: number[]): number[] {
  if (i >= 0) {
    out[0] = P[3 * i];
    out[1] = P[3 * i + 1];
    out[2] = P[3 * i + 2];
    return out;
  }
  const l = 3 * (i === NECK ? R.shoulderL : R.hipL);
  const r = 3 * (i === NECK ? R.shoulderR : R.hipR);
  out[0] = (P[l] + P[r]) / 2;
  out[1] = (P[l + 1] + P[r + 1]) / 2;
  out[2] = (P[l + 2] + P[r + 2]) / 2;
  return out;
}

/** THE ROPE'S FRAME: a point on it, its way along it (unit), and the two
 * ways square to it a point of him is seen in — `e1` level across it,
 * `e2` the rest. */
export type RopeFrame = {
  o: readonly number[];
  t: readonly number[];
  e1: readonly number[];
  e2: readonly number[];
};

/** The rope `side` of `plan` at `u` m up its line, as a frame. */
export function ropeFrame(plan: LiftPlan, side: 0 | 1, u: number): RopeFrame {
  const off = side === 0 ? upRope(plan) : -upRope(plan);
  const b = plan.lift.bottom;
  const o = [b.x + plan.dx * u + plan.dz * off, ropeAt(plan, u), b.z + plan.dz * u - plan.dx * off];
  const rise = ropeAt(plan, u + 0.5) - ropeAt(plan, u - 0.5);
  const n = hypot(1, rise);
  const t = [plan.dx / n, rise / n, plan.dz / n];
  // Level across it: the line's own right, (dz, 0, −dx).
  const e1 = [plan.dz, 0, -plan.dx];
  const e2 = [
    t[1] * e1[2] - t[2] * e1[1],
    t[2] * e1[0] - t[0] * e1[2],
    t[0] * e1[1] - t[1] * e1[0],
  ];
  return { o, t, e1, e2 };
}

/** A point seen down the rope: its two coordinates square to it, m. */
function seen(f: RopeFrame, p: readonly number[], out: number[]): number[] {
  const x = p[0] - f.o[0];
  const y = p[1] - f.o[1];
  const z = p[2] - f.o[2];
  out[0] = x * f.e1[0] + y * f.e1[1] + z * f.e1[2];
  out[1] = x * f.e2[0] + y * f.e2[1] + z * f.e2[2];
  return out;
}

/** How far the origin is from the segment a–b, in the plane. */
function toSegment(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const d = dx * dx + dy * dy;
  const k = d > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / d)) : 0;
  return hypot(ax + dx * k, ay + dy * k);
}

/** Which side of the line a→b the origin is on (the sign of the turn). */
function sideOf(ax: number, ay: number, bx: number, by: number): number {
  return Math.sign((bx - ax) * -ay - (by - ay) * -ax);
}

/** WHETHER THE ROPE WENT THROUGH a segment going from a0–b0 to a1–b1 this
 * step, seen down it (each a plane point): the rope's point inside the
 * strip the segment swept, or within `thick` m of it. */
export function sweptThrough(
  a0: readonly number[],
  b0: readonly number[],
  a1: readonly number[],
  b1: readonly number[],
  thick: number,
): boolean {
  const q = [a0, b0, b1, a1];
  let turn = 0;
  let near = Infinity;
  for (let k = 0; k < 4; k++) {
    const p = q[k];
    const n = q[(k + 1) % 4];
    near = Math.min(near, toSegment(p[0], p[1], n[0], n[1]));
    turn += sideOf(p[0], p[1], n[0], n[1]);
  }
  // Inside a quadrilateral swept by a segment, the origin is on one side
  // of every edge — all four turns one way.
  return near <= thick || Math.abs(turn) === 4;
}

const pa = [0, 0, 0];
const pb = [0, 0, 0];
const a0 = [0, 0];
const b0 = [0, 0];
const a1 = [0, 0];
const b1 = [0, 0];

/** The bones of a body going from `last` to `now` (points) the rope `f`
 * went through this step. */
export function bonesCut(f: RopeFrame, last: readonly number[], now: readonly number[]): Bone[] {
  const out: Bone[] = [];
  for (const bone of BONES) {
    seen(f, at(last, bone.a, pa), a0);
    seen(f, at(last, bone.b, pb), b0);
    seen(f, at(now, bone.a, pa), a1);
    seen(f, at(now, bone.b, pb), b1);
    if (sweptThrough(a0, b0, a1, b1, bone.thick)) out.push(bone);
  }
  return out;
}

/** A body's points a step back on velocity `v` (m/s): the rigid sweep of
 * one not yet thrown. */
function back(P: readonly number[], v: { x: number; y: number; z: number }): number[] {
  const out = P.slice();
  for (let i = 0; i < out.length; i += 3) {
    out[i] -= v.x * dt;
    out[i + 1] -= v.y * dt;
    out[i + 2] -= v.z * dt;
  }
  return out;
}

/** The rope near (x, y, z) a body might be meeting: a lift's index and
 * side, and how far up its line. */
function ropesNear(
  run: GameState,
  x: number,
  y: number,
  z: number,
): { plan: LiftPlan; side: 0 | 1; u: number }[] {
  const out: { plan: LiftPlan; side: 0 | 1; u: number }[] = [];
  for (const plan of liftPlans(run.level)) {
    const b = plan.lift.bottom;
    const rx = x - b.x;
    const rz = z - b.z;
    const u = rx * plan.dx + rz * plan.dz;
    if (u < CABLE.ends || u > plan.length - CABLE.ends) continue;
    const v = rx * plan.dz - rz * plan.dx;
    for (const side of [0, 1] as const) {
      const off = side === 0 ? upRope(plan) : -upRope(plan);
      if (Math.abs(v - off) > C.near || Math.abs(y - ropeAt(plan, u)) > C.near) continue;
      out.push({ plan, side, u });
    }
  }
  return out;
}

/** THE CUT'S STEP, after the step has moved him: through any rope he met
 * too fast this step, every bone it crossed cut and him carried on through
 * it. Whether it cut him. */
export function stepCableCut(run: GameState, events: GameEvent[]): boolean {
  const c = run.skier;
  if (!run.gore || c.grind || c.lift || run.phase !== "racing") return false;
  const b = c.thrown;
  const v = b ? { x: b.vx, y: b.vy, z: b.vz } : { x: c.vx, y: c.vy, z: c.vz };
  if (hypot3(v.x, v.y, v.z) < C.speed) return false;
  const near = ropesNear(run, b ? b.x : c.x, b ? b.y : c.y, b ? b.z : c.z);
  if (!near.length) return false;
  // On his skis, the body he would be thrown as stands where he is.
  const now = b
    ? b.points
    : bodyThrown("wire", boardBody(c), c.x, c.y, c.z, v, ZERO, c.heading).points;
  const last = b ? b.last : back(now, v);
  // ...and the skis under him, a step back as he goes.
  const pair =
    b || c.spec.board ? null : letGo(run, c, 1, 0).map((ski) => ({ ...ski, last: ski.ends }));
  for (const { plan, side, u } of near) {
    const f = ropeFrame(plan, side, u);
    const bones = bonesCut(f, last, now);
    // A rope through the skis alone takes him off them, cut.
    const stood = pair ? skisCrossed(f, pair, v) : undefined;
    if (!bones.length && !stood?.some((k) => k !== null)) continue;
    const off = b ?? throwRider(run, "wire", v, events);
    // Nothing of him is stopped by it: all of him goes on as he was going.
    if (!b) carryOn(off, v);
    const skis = cutSkis(run, f, v, stood);
    const pieces: GorePiece[] = [];
    const open: GoreOpen[] = [];
    for (const bone of bones) {
      if (bone.piece) pieces.push(bone.piece);
      if (bone.open) open.push(bone.open);
    }
    // The trunk cut in two is opened where the steel went in: the belly
    // low on it, the chest high.
    const spine = bones.find((bone) => bone.piece === "lower");
    if (spine) open.push(spineOpen(f, last, now));
    // The steel heard once a cut: through what was already gone, silent.
    if (sever(run, pieces, open, events) || skis > 0 || !b) {
      events.push({ kind: "grind", t: run.t, id: plan.lift.id, phase: "cut" });
    }
    return true;
  }
  return false;
}

const ZERO = { x: 0, y: 0, z: 0 };

/** Where on the spine the rope went through: the belly below its middle,
 * the chest above. */
function spineOpen(f: RopeFrame, last: readonly number[], now: readonly number[]): GoreOpen {
  seen(f, at(now, WAIST, pa), a1);
  seen(f, at(now, NECK, pb), b1);
  seen(f, at(last, WAIST, pa), a0);
  seen(f, at(last, NECK, pb), b0);
  // The share up the spine the rope's point lies nearest, at the step's
  // middle.
  const ax = (a0[0] + a1[0]) / 2;
  const ay = (a0[1] + a1[1]) / 2;
  const dx = (b0[0] + b1[0]) / 2 - ax;
  const dy = (b0[1] + b1[1]) / 2 - ay;
  const d = dx * dx + dy * dy;
  const k = d > 0 ? -(ax * dx + ay * dy) / d : 0;
  return k < 0.5 ? "abdomen" : "chest";
}
