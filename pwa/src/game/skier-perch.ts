// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER ON A HELICOPTER'S SKID, ABOVE THE KNEES — what his body does
// while the machine flies him (`heli.ts`; the legs below the knees are
// `skier-dangle.ts`'s). Three-free, so the suite reads it; presentation
// only.
//
// A PASSENGER IS NOT A STATUE. Sat on the tube with nothing round him, he:
//
//   * SWAYS with what he feels — the machine banking, braking and pulling
//     up swings his trunk about his hips toward the gravity he feels (g
//     less the seat's acceleration, `Perch.gravity`), a damped spring of
//     about a second (the trunk's own sway, held by his back and belly,
//     which take back a share of it: `REACT.passive`);
//   * KEEPS HIS HEAD LEVEL — the righting reflex: his head rolls back
//     against the trunk's sway and part of the machine's own bank, so his
//     eyes stay nearer the horizon than his shoulders do (`REACT.head`);
//   * BRACES — the hands come off his thighs onto the tube beside his hips,
//     the arms locked, as the felt pull leans off his seat or goes light
//     under him (`REACT.brace`), and go back to the thighs once it settles;
//   * HANGS — slid off the seat (`HeliState.hung`), he hangs from both
//     hands on the tube over his head, the arms straight up, the shoulders
//     hauled up to his ears, the trunk and hips straight under them, the
//     knees a little bent, his poles flopping off their straps — and
//     STRUGGLES, the legs kicking (`skier-dangle.ts`'s `Perch.hung`).
//
// The engine swings his body under his hands (`hangFrame`): this only
// stands the figure in it.

import type { Perch } from "./skier-dangle.ts";
import type { SkierPose } from "./skier-joints.ts";
import { solveLimb } from "./skier-limbs.ts";
import { BODY, SHIN_ABOVE_CUFF, type Mounts } from "./skier-mounts.ts";
import type { V3 } from "./skier-vec.ts";

/** What the upper body is handed for a frame, in his body frame (x right,
 * y up, z forward). */
export type PerchFeel = {
  /** The gravity he feels, m/s²: g less the seat's acceleration. */
  gravity: V3;
  /** The world's up, unit. */
  up: V3;
  /** How far he hangs off the tube by his hands, 0..1, and the share of
   * his weight they carry. */
  hung: number;
  load: number;
};

/** What a perch hands the upper body (sat level and holding nothing where
 * it says nothing of it). */
export function feelOf(p: Perch): PerchFeel {
  return { gravity: p.gravity, up: p.up ?? UP, hung: p.hung ?? 0, load: p.load ?? 0 };
}

const UP: V3 = { x: 0, y: 1, z: 0 };

export const REACT = {
  /** The trunk's sway: its natural frequency, Hz, and damping ratio; the
   * share of the felt pull's lean he lets it take, and the most, rad. */
  sway: { hz: 1.1, zeta: 0.45, passive: 0.55, most: 0.45 },
  /** The head's righting: the share of the trunk's sway and of the
   * world's bank he takes back with it, and the most, rad. */
  head: { sway: 0.85, bank: 0.45, most: 0.5 },
  /** The brace: the felt pull's lean off his seat (a share of g) and how
   * light it goes under him (m/s², the seat's push) over which the hands
   * go to the tube, the load on them that holds them there, and how fast
   * they go and come back, /s. */
  brace: { lean: [0.18, 0.4], light: [6.5, 3.5], load: [0.05, 0.2], on: 7, off: 1.2 },
  /** Where his hands grip the tube braced, body frame from the seat's top,
   * m: out from his middle, over the tube, and fore-aft off his hips. */
  tube: { x: 0.3, y: 0.03, z: 0.0 },
  /** HUNG: his hands over his head on the tube (the engine's
   * `HELI.grip.hang.reach` over his middle), m apart; the shoulders hauled
   * up, m; the trunk's lean, rad; the knees bent forward, m off the
   * straight line; and the poles flung out off their straps. */
  hang: { reach: 1.1, grip: 0.42, shrug: 0.07, lean: 0.06, knee: 0.08, poleOut: 0.45 },
} as const;

/** The upper body's state between frames. */
export type PerchReact = { roll: number; pitch: number; vr: number; vp: number; brace: number };

export function createPerchReact(): PerchReact {
  return { roll: 0, pitch: 0, vr: 0, vp: 0, brace: 0 };
}

export function resetPerchReact(r: PerchReact): void {
  Object.assign(r, createPerchReact());
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Where the felt pull leans his trunk, rad: (roll to his right, pitch
 * forward) — the share of it he lets go. */
function leanOf(g: V3): { roll: number; pitch: number } {
  const S = REACT.sway;
  const down = Math.max(1, -g.y);
  return {
    roll: clamp(Math.atan2(g.x, down) * S.passive, -S.most, S.most),
    pitch: clamp(Math.atan2(g.z, down) * S.passive, -S.most, S.most),
  };
}

/** How far his hands want the tube for the felt pull `g` and the load. */
export function braceOf(f: PerchFeel): number {
  const B = REACT.brace;
  const n = Math.hypot(f.gravity.x, f.gravity.y, f.gravity.z) || 1;
  const lean = Math.hypot(f.gravity.x, f.gravity.z) / n;
  return Math.max(
    smooth(B.lean[0], B.lean[1], lean),
    smooth(B.light[0], B.light[1], -f.gravity.y),
    smooth(B.load[0], B.load[1], f.load),
    f.hung,
  );
}

/** STEP THE UPPER BODY by `dt` s: the trunk's sway toward the felt pull
 * and the hands toward the brace. A still (`dt` 0) is stood where the
 * pull has it, settled. */
export function stepPerchReact(r: PerchReact, f: PerchFeel, dt: number): void {
  const S = REACT.sway;
  const want = leanOf(f.gravity);
  const brace = braceOf(f);
  if (dt <= 0) {
    if (r.roll === 0 && r.pitch === 0 && r.brace === 0) {
      r.roll = want.roll;
      r.pitch = want.pitch;
      r.brace = brace;
    }
    return;
  }
  const w = 2 * Math.PI * S.hz;
  const n = Math.max(1, Math.ceil(Math.min(dt, 0.1) / (1 / 240)));
  const h = Math.min(dt, 0.1) / n;
  for (let k = 0; k < n; k++) {
    r.vr += (w * w * (want.roll - r.roll) - 2 * S.zeta * w * r.vr) * h;
    r.vp += (w * w * (want.pitch - r.pitch) - 2 * S.zeta * w * r.vp) * h;
    r.roll += r.vr * h;
    r.pitch += r.vp * h;
  }
  const B = REACT.brace;
  r.brace += clamp(brace - r.brace, -B.off * dt, B.on * dt);
}

function lerp(a: V3, b: V3, k: number): V3 {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

const mix = (a: readonly V3[], b: readonly V3[], k: number): [V3, V3] =>
  [lerp(a[0], b[0], k), lerp(a[1], b[1], k)] as [V3, V3];

/** The arms solved from the shoulders to `hands`, the elbows out and back. */
function elbowsTo(shoulders: readonly V3[], hands: readonly V3[], down: number): [V3, V3] {
  return [0, 1].map((i) =>
    solveLimb(shoulders[i], hands[i], BODY.upperArm, BODY.forearm, {
      x: i ? 1 : -1,
      y: down,
      z: -0.4,
    }),
  ) as [V3, V3];
}

/** HUNG FROM HIS HANDS, off the stood pose `stood`: upright under the
 * grips over his head, the knees solved to the boots where the skis are. */
function hangPose(stood: SkierPose, M: Mounts): SkierPose {
  const H = REACT.hang;
  const p = stood;
  const hips = { x: 0, y: M.hips.y, z: 0 };
  const back = p.pitch - H.lean;
  const c = Math.cos(back);
  const s = Math.sin(back);
  // The trunk stood up off its lean about the hips, and the hips under
  // the grips.
  const carry = (q: V3): V3 => {
    const y = q.y - p.hips.y;
    const z = q.z - p.hips.z;
    return { x: q.x, y: hips.y + y * c + z * s, z: hips.z + z * c - y * s };
  };
  const shrug = (q: V3): V3 => ({ x: q.x * 0.9, y: q.y + H.shrug, z: q.z - 0.02 });
  const hipJoints = [carry(p.hipJoints[0]), carry(p.hipJoints[1])] as [V3, V3];
  const shoulders = [shrug(carry(p.shoulders[0])), shrug(carry(p.shoulders[1]))] as [V3, V3];
  const knees = [0, 1].map((i) =>
    solveLimb(hipJoints[i], p.feet[i], BODY.thigh, SHIN_ABOVE_CUFF, {
      x: (i ? 1 : -1) * 0.1,
      y: 0,
      z: 1,
    }),
  ) as [V3, V3];
  // Straightened: the knees only `knee` off the line hip to boot.
  for (let i = 0; i < 2; i++) {
    const mid = lerp(hipJoints[i], p.feet[i], BODY.thigh / (BODY.thigh + SHIN_ABOVE_CUFF));
    const off = { x: knees[i].x - mid.x, y: knees[i].y - mid.y, z: knees[i].z - mid.z };
    const d = Math.hypot(off.x, off.y, off.z) || 1;
    const k = Math.min(1, H.knee / d);
    knees[i] = { x: mid.x + off.x * k, y: mid.y + off.y * k, z: mid.z + off.z * k };
  }
  const hands = [-1, 1].map((sx) => ({ x: (sx * H.grip) / 2, y: H.reach, z: 0 })) as [V3, V3];
  const elbows = elbowsTo(shoulders, hands, 0.2);
  const poles = p.poles
    ? (hands.map((h, i) => {
        const sx = i ? 1 : -1;
        const out = { x: sx * H.poleOut, y: -1, z: -0.15 };
        const n = Math.hypot(out.x, out.y, out.z);
        return {
          x: h.x + (out.x / n) * M.pole,
          y: h.y + (out.y / n) * M.pole,
          z: h.z + (out.z / n) * M.pole,
        };
      }) as [V3, V3])
    : null;
  return {
    ...p,
    hips,
    hipJoints,
    waist: carry(p.waist),
    neck: shrug(carry(p.neck)),
    head: carry(p.head),
    pitch: H.lean,
    roll: 0,
    knees,
    shoulders,
    elbows,
    hands,
    poles,
    look: 0,
  };
}

/**
 * THE SEATED POSE `sat` HELD ON THE SKID by the upper body's state `r`:
 * the trunk swayed about the hips, the head righted, the hands braced on
 * the tube — and hung from it by `f.hung`, blended toward the pose hung
 * off his hands (made off the stood pose `stood`). `seatY` is the tube's
 * top in his body frame, m. Applied before the legs' swing.
 */
export function perchPose(
  sat: SkierPose,
  stood: SkierPose,
  r: PerchReact,
  f: PerchFeel,
  seatY: number,
  M: Mounts,
): SkierPose {
  const R = REACT;
  const cr = Math.cos(r.roll);
  const sr = Math.sin(r.roll);
  const cp = Math.cos(r.pitch);
  const sp = Math.sin(r.pitch);
  const o = sat.hips;
  const carry = (q: V3): V3 => {
    const x0 = q.x - o.x;
    const y0 = q.y - o.y;
    const z0 = q.z - o.z;
    const y1 = y0 * cp - z0 * sp;
    const z1 = z0 * cp + y0 * sp;
    return { x: o.x + x0 * cr + y1 * sr, y: o.y + y1 * cr - x0 * sr, z: o.z + z1 };
  };
  const shoulders = [carry(sat.shoulders[0]), carry(sat.shoulders[1])] as [V3, V3];
  // The hands: on the thighs (where the seat put them), or on the tube.
  const tube = [-1, 1].map((sx) => ({
    x: sx * R.tube.x,
    y: seatY + R.tube.y,
    z: sat.hips.z + R.tube.z,
  }));
  const k = clamp(r.brace, 0, 1);
  const hands = mix(sat.hands, tube, k);
  const elbows = mix(
    [carry(sat.elbows[0]), carry(sat.elbows[1])],
    elbowsTo(shoulders, hands, -0.2),
    k,
  );
  // The head righted against the sway and part of the world's bank.
  const bank = -Math.atan2(f.up.x, f.up.y);
  const right = clamp(-(R.head.sway * r.roll + R.head.bank * bank), -R.head.most, R.head.most);
  const held: SkierPose = {
    ...sat,
    waist: carry(sat.waist),
    neck: carry(sat.neck),
    head: carry(sat.head),
    pitch: sat.pitch + r.pitch,
    roll: sat.roll + r.roll,
    headRoll: sat.headRoll + r.roll + right,
    shoulders,
    elbows,
    hands,
    // The poles carried with the hands that hold them.
    poles: sat.poles
      ? (sat.poles.map((q, i) => ({
          x: q.x + hands[i].x - sat.hands[i].x,
          y: q.y + hands[i].y - sat.hands[i].y,
          z: q.z + hands[i].z - sat.hands[i].z,
        })) as [V3, V3])
      : null,
  };
  const g = clamp(f.hung, 0, 1);
  if (g <= 0) return held;
  const hung = hangPose(stood, M);
  return {
    ...held,
    hips: lerp(held.hips, hung.hips, g),
    hipJoints: mix(held.hipJoints, hung.hipJoints, g),
    waist: lerp(held.waist, hung.waist, g),
    neck: lerp(held.neck, hung.neck, g),
    head: lerp(held.head, hung.head, g),
    pitch: held.pitch + (hung.pitch - held.pitch) * g,
    roll: held.roll * (1 - g),
    headRoll: held.headRoll * (1 - g),
    knees: mix(held.knees, hung.knees, g),
    shoulders: mix(held.shoulders, hung.shoulders, g),
    elbows: mix(held.elbows, hung.elbows, g),
    hands: mix(held.hands, hung.hands, g),
    poles: held.poles && hung.poles ? mix(held.poles, hung.poles, g) : held.poles,
    look: held.look * (1 - g),
  };
}
