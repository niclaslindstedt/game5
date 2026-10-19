// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE A ROUND MEETS HIS BODY (`gunfire.ts`): the body as a set of
// capsules round the ragdoll's thirteen points (`ragdoll-points.ts`) — a
// ball for the head, a thick capsule for the trunk, the limbs a clothed
// limb's thickness (`GUNFIRE.body`) — and the round's path this step a
// segment through them. The first capsule along the path is the part it
// strikes: the trunk's upper half the chest (or the back, struck from
// behind), its lower the belly; an upper arm near the shoulder the
// shoulder; a thigh near the knee the knee.
//
// On his skis the points are the body he would be thrown as, standing
// where he is (`crash.ts`' `bodyThrown`, as `cable-cut.ts` reads him);
// thrown, the ragdoll's own. Built only when a round comes within reach,
// so the rest of a run never pays for it.

import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { GUNFIRE } from "./defs/weapons.ts";
import { boardBody } from "./board-crash.ts";
import { bodyThrown } from "./crash.ts";
import { RAGDOLL as R } from "./ragdoll-points.ts";
import type { BodyPart } from "./defs/anatomy.ts";
import type { GameState } from "./state.ts";

const B = GUNFIRE.body;
const ZERO = { x: 0, y: 0, z: 0 };

/** THE BODY'S CENTRE a shooter aims at, world frame, m: the thrown body's
 * middle, or — on his skis, whose datum is his hips' height — the middle
 * of his trunk a little over it. */
export function bodyCentre(state: GameState): { x: number; y: number; z: number } {
  const c = state.skier;
  const b = c.thrown;
  return b ? { x: b.x, y: b.y, z: b.z } : { x: c.x, y: c.y + 0.25, z: c.z };
}

/** His body's points as a round sees them (x y z each, `RAGDOLL` order). */
export function bodyPoints(state: GameState): readonly number[] {
  const c = state.skier;
  if (c.thrown) return c.thrown.points;
  const v = { x: c.vx, y: c.vy, z: c.vz };
  return bodyThrown("wire", boardBody(c), c.x, c.y, c.z, v, ZERO, c.heading).points;
}

/** A segment p0 → p1 against the capsule a → b of radius r: the share
 * along p0 → p1 of the closest approach, or −1 when it passes wider. */
function capsuleHit(
  p: readonly number[],
  q: readonly number[],
  a: readonly number[],
  b: readonly number[],
  r: number,
  out: { s: number; u: number },
): boolean {
  const d1x = q[0] - p[0];
  const d1y = q[1] - p[1];
  const d1z = q[2] - p[2];
  const d2x = b[0] - a[0];
  const d2y = b[1] - a[1];
  const d2z = b[2] - a[2];
  const rx = p[0] - a[0];
  const ry = p[1] - a[1];
  const rz = p[2] - a[2];
  const A = d1x * d1x + d1y * d1y + d1z * d1z;
  const E = d2x * d2x + d2y * d2y + d2z * d2z;
  const F = d2x * rx + d2y * ry + d2z * rz;
  const C = d1x * rx + d1y * ry + d1z * rz;
  const Bm = d1x * d2x + d1y * d2y + d1z * d2z;
  let s: number;
  let u: number;
  if (E < 1e-9) {
    s = A > 1e-12 ? Math.min(1, Math.max(0, -C / A)) : 0;
    u = 0;
  } else {
    const den = A * E - Bm * Bm;
    s = den > 1e-12 ? Math.min(1, Math.max(0, (Bm * F - C * E) / den)) : 0;
    u = (Bm * s + F) / E;
    if (u < 0) {
      u = 0;
      s = A > 1e-12 ? Math.min(1, Math.max(0, -C / A)) : 0;
    } else if (u > 1) {
      u = 1;
      s = A > 1e-12 ? Math.min(1, Math.max(0, (Bm - C) / A)) : 0;
    }
  }
  const cx = p[0] + d1x * s - (a[0] + d2x * u);
  const cy = p[1] + d1y * s - (a[1] + d2y * u);
  const cz = p[2] + d1z * s - (a[2] + d2z * u);
  if (hypot3(cx, cy, cz) > r) return false;
  // Back off to where the path enters the capsule, near enough.
  const len = Math.sqrt(A);
  out.s = len > 1e-9 ? Math.max(0, s - r / len) : s;
  out.u = u;
  return true;
}

/** One bone: its two ends (a point index, or −1 the shoulders' middle, −2
 * the hips'), its radius and the part it is. */
type Bone = { a: number; b: number; r: number; part: (u: number, back: boolean) => BodyPart };

const side = (base: string, s: "L" | "R"): BodyPart => `${base}${s}` as BodyPart;

const limb = (s: "L" | "R"): Bone[] => [
  {
    a: s === "L" ? R.shoulderL : R.shoulderR,
    b: s === "L" ? R.elbowL : R.elbowR,
    r: B.upperArm,
    part: (u) => side(u < 0.25 ? "shoulder" : "arm", s),
  },
  {
    a: s === "L" ? R.elbowL : R.elbowR,
    b: s === "L" ? R.handL : R.handR,
    r: B.forearm,
    part: () => side("arm", s),
  },
  { a: s === "L" ? R.handL : R.handR, b: -3, r: B.hand, part: () => side("hand", s) },
  {
    a: s === "L" ? R.hipL : R.hipR,
    b: s === "L" ? R.kneeL : R.kneeR,
    r: B.thigh,
    part: (u) => side(u > 0.85 ? "knee" : "thigh", s),
  },
  {
    a: s === "L" ? R.kneeL : R.kneeR,
    b: s === "L" ? R.footL : R.footR,
    r: B.shin,
    part: () => side("shin", s),
  },
  { a: s === "L" ? R.footL : R.footR, b: -3, r: B.foot, part: () => side("foot", s) },
];

/** THE BONES a round is tested against: −3 for a ball (the end alone). */
const BONES: readonly Bone[] = [
  { a: R.head, b: -3, r: B.head, part: () => "head" },
  { a: -1, b: -4, r: B.neck, part: () => "neck" },
  {
    a: -1,
    b: -2,
    r: B.trunk,
    part: (u, back) => (u < 0.55 ? (back ? "back" : "chest") : "abdomen"),
  },
  { a: R.hipL, b: R.hipR, r: B.pelvis, part: () => "pelvis" },
  ...limb("L"),
  ...limb("R"),
];

const pa = [0, 0, 0];
const pb = [0, 0, 0];

/** Point `i` of `P` into `out`: a ragdoll point, the shoulders' middle
 * (−1), the hips' (−2), or two thirds of the way from the shoulders to the
 * head (−4, the neck's top). */
function at(P: readonly number[], i: number, out: number[]): number[] {
  if (i >= 0) {
    out[0] = P[3 * i];
    out[1] = P[3 * i + 1];
    out[2] = P[3 * i + 2];
    return out;
  }
  const l = i === -2 ? R.hipL : R.shoulderL;
  const r = i === -2 ? R.hipR : R.shoulderR;
  for (let k = 0; k < 3; k++) out[k] = (P[3 * l + k] + P[3 * r + k]) / 2;
  if (i === -4) for (let k = 0; k < 3; k++) out[k] += ((P[3 * R.head + k] - out[k]) * 2) / 3;
  return out;
}

/** Whether a round going `d` (world) strikes him from behind: along his
 * front, his right × up. */
function fromBehind(P: readonly number[], dx: number, dz: number): boolean {
  const rx = P[3 * R.shoulderR] - P[3 * R.shoulderL];
  const rz = P[3 * R.shoulderR + 2] - P[3 * R.shoulderL + 2];
  // The spine's rise, shoulders over hips: lying on his back or his front
  // it is near nothing and the sign of his front is the trunk's.
  const uy =
    (P[3 * R.shoulderL + 1] + P[3 * R.shoulderR + 1]) / 2 -
    (P[3 * R.hipL + 1] + P[3 * R.hipR + 1]) / 2;
  // right × up in plan, the right's rise and the spine's lean let go:
  // (rx, 0, rz) × (·, uy, ·) = (−rz·uy, ·, rx·uy).
  const fx = -rz * uy;
  const fz = rx * uy;
  return fx * dx + fz * dz > 0;
}

const hit = { s: 0, u: 0 };

/** THE FIRST PART the segment p → q strikes of the body at points `P`, and
 * how far along p → q (0..1), or null: it misses him. */
export function bodyHit(
  P: readonly number[],
  p: readonly number[],
  q: readonly number[],
): { part: BodyPart; s: number } | null {
  let best: { part: BodyPart; s: number } | null = null;
  const back = fromBehind(P, q[0] - p[0], q[2] - p[2]);
  for (const bone of BONES) {
    const a = at(P, bone.a, pa);
    const b = bone.b === -3 ? a : at(P, bone.b, pb);
    if (!capsuleHit(p, q, a, b, bone.r, hit)) continue;
    if (best && hit.s >= best.s) continue;
    best = { part: bone.part(hit.u, back), s: hit.s };
  }
  return best;
}

/** The nearest the segment p → q passes the point c, m. */
export function passDistance(
  p: readonly number[],
  q: readonly number[],
  c: { x: number; y: number; z: number },
): number {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const dz = q[2] - p[2];
  const L = dx * dx + dy * dy + dz * dz;
  const t =
    L > 1e-12
      ? Math.min(1, Math.max(0, ((c.x - p[0]) * dx + (c.y - p[1]) * dy + (c.z - p[2]) * dz) / L))
      : 0;
  return hypot3(p[0] + dx * t - c.x, p[1] + dy * t - c.y, p[2] + dz * t - c.z);
}
