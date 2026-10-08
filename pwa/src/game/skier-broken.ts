// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RIDING WITH A BROKEN ARM — what the figure does with an arm whose bone
// is broken through (`fracture: "break"` in `defs/anatomy.ts`), on a run
// that carries its injuries through a fall (the INJURIES switch: the reset
// stands him back up as hurt as he lay — `hurt.ts`). Three-free, so the
// suite reads it (`tests/broken_arms_test.ts`); presentation only — what a
// broken arm costs his push is `hurt.ts`'s `drive`, and nothing here is
// read by the engine.
//
// What a broken arm looks like, off the clinical picture: a shaft fracture
// of the upper arm has ABNORMAL MOBILITY at the break — the arm moves
// where there is no joint — the arm cannot be lifted and is held to the
// side, and the upper arm reads shorter; a fracture through both bones of
// the forearm angulates there and the hand and the wrist below it turn
// over (the pronators pull the far piece round); a broken wrist leaves
// the hand hanging off the end of the forearm. Nobody with any of these
// holds a ski pole in that hand:
//
//   * A BROKEN ARM DROPS ITS POLE (`SkierPose.dropped`): one arm broken,
//     he rides with the other pole alone; both, with none.
//   * THE UPPER ARM BROKEN (the humerus): the piece above the break is
//     held down along his side (he cannot raise it), and EVERYTHING BELOW
//     THE BREAK — the lower upper arm, the elbow, the forearm and the hand
//     — HANGS FROM THE BREAK, a loose two-link chain swinging at the break
//     and at the elbow.
//   * THE FOREARM BROKEN (the radius and the ulna): the upper arm held to
//     his side, the elbow bent, the near half of the forearm carried
//     forward across his belly — guarding it — and the far half and the
//     hand hanging from the break.
//   * THE WRIST BROKEN (the radius at the wrist): the arm guarded the
//     same way and the hand hanging off the wrist.
//
// THE HANGING PIECE IS A PENDULUM, swung by everything the skier's body
// does to it: each joint below the break a point mass (`Dangle`), stepped
// by Verlet integration in his body frame under THE GRAVITY THE ARM FEELS
// — g less his own acceleration, so it swings forward as he brakes, out
// of a turn as he carves and floats in the air (`stepArms`' `gravity`) —
// held to its bones' lengths, kept inside the cone the break and the
// elbow can turn through, and kept out of his trunk. A still (dt 0) is
// settled to rest under the gravity it is handed, so a screenshot shows
// the arm hanging.
//
// The skin follows: the rig splits the broken bone at the break
// (`skier-rig.ts`'s `upperarm_lo_*` and `forearm_lo_*`, the skin weighted
// to them past `BREAK`, `dress-loft.ts`) and the hand turns off the wrist.

import { INJURIES, type Injury } from "@engine";

import type { Kink, SkierPose } from "./skier-joints.ts";
import { BODY } from "./skier-mounts.ts";
import { add, dot, len, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** Which of an arm's bones is broken through, the nearest the shoulder
 * winning: the upper arm, the forearm, or the wrist. */
export type ArmBreak = Kink["bone"];

/** WHERE EACH BREAK IS, m from the joint above it: the upper arm's half
 * way down the humerus (the shaft's middle third is where it breaks), the
 * forearm's half way along both bones, and the wrist's the radius's end —
 * three quarters of the elbow-to-fist bone. The rig cuts the skin at the
 * same distances. */
export const BREAK = {
  upper: 0.5 * BODY.upperArm,
  fore: 0.5 * BODY.forearm,
  wrist: 0.75 * BODY.forearm,
} as const;

const RANK: Record<ArmBreak, number> = { wrist: 1, fore: 2, upper: 3 };

/** WHICH ARM IS BROKEN WHERE, off his injuries: a break of the humerus
 * the upper arm, of the radius and the ulna the forearm, of the radius
 * at the hand the wrist. A hairline crack holds; a broken hand's small
 * bones leave the wrist straight. Left, right. */
export function armBreaks(injuries: readonly Injury[]): [ArmBreak | null, ArmBreak | null] {
  const out: [ArmBreak | null, ArmBreak | null] = [null, null];
  for (const j of injuries) {
    const def = INJURIES[j.kind] as { fracture?: string; bones?: readonly string[] };
    if (def.fracture !== "break") continue;
    const side =
      j.part === "armL" || j.part === "handL"
        ? 0
        : j.part === "armR" || j.part === "handR"
          ? 1
          : -1;
    if (side < 0) continue;
    const bones = def.bones ?? [];
    const b: ArmBreak | null = j.part.startsWith("arm")
      ? bones.includes("humerus")
        ? "upper"
        : "fore"
      : bones.includes("radius")
        ? "wrist"
        : null;
    const was = out[side as 0 | 1];
    if (b && (!was || RANK[b] > RANK[was])) out[side as 0 | 1] = b;
  }
  return out;
}

/** HOW THE SOUND PART OF A BROKEN ARM IS HELD, in his trunk's frame (x
 * to his right, y up his spine, z out of his chest; `s` −1 left): the
 * piece of a broken humerus above the break pulled OUT and forward by the
 * shoulder's muscle (a shaft broken below the deltoid's insertion: the
 * near piece abducted), so the arm below it hangs off at an angle; the
 * upper arm over a broken forearm or wrist held to his side, a little
 * forward, and that forearm's near half carried forward level, guarded,
 * the far half dropping off it. */
const GUARD = {
  humerus: (s: number): V3 => ({ x: s * 0.75, y: -0.55, z: 0.42 }),
  arm: (s: number): V3 => ({ x: s * 0.22, y: -0.92, z: 0.3 }),
  forearm: (s: number): V3 => ({ x: s * 0.05, y: 0.08, z: 1 }),
};

/** THE PENDULUM'S NUMBERS: the damping of a relaxed, broken arm's swing,
 * 1/s (it swings a few times and settles), the step it is integrated at,
 * s, the most the hanging piece turns off the line of the piece above it
 * at the break, and at the elbow, rad, the trunk it is kept out of (a
 * capsule from the hips to the neck, m), and how long a still is settled
 * for, s. */
export const SWING = {
  damping: 3,
  step: 1 / 120,
  breakCone: 2.0,
  elbowCone: 2.5,
  trunk: 0.15,
  settle: 2,
  /** The most a moment's felt acceleration is taken as, m/s² — a reset or
   * a teleport is not a blow to the arm. */
  most: 15,
};

/** ONE ARM'S HANGING PIECE: its points below the break (the elbow and
 * the fist for the upper arm, the fist alone otherwise), now and a step
 * ago, in the body frame. */
export type ArmSwing = { kind: ArmBreak | null; cur: V3[]; prev: V3[] };
/** Both arms' hanging pieces. */
export type Dangle = [ArmSwing, ArmSwing];

export function createArmSwing(): Dangle {
  return [
    { kind: null, cur: [], prev: [] },
    { kind: null, cur: [], prev: [] },
  ];
}

/** The trunk's frame off a pose: across to his right, up his spine, out
 * of his chest. */
function trunkOf(p: SkierPose): { x: V3; y: V3; z: V3 } {
  const y = norm(sub(p.neck, p.hips));
  let x = sub(p.shoulders[1], p.shoulders[0]);
  x = norm(sub(x, scale(y, dot(x, y))));
  const z = { x: x.y * y.z - x.z * y.y, y: x.z * y.x - x.x * y.z, z: x.x * y.y - x.y * y.x };
  return { x, y, z };
}
const inTrunk = (f: { x: V3; y: V3; z: V3 }, v: V3): V3 =>
  norm(add(add(scale(f.x, v.x), scale(f.y, v.y)), scale(f.z, v.z)));

/** Turn `d` (a unit vector) toward `base` until it is no more than `most`
 * rad off it. */
function cone(d: V3, base: V3, most: number): V3 {
  const c = dot(d, base);
  if (c >= Math.cos(most)) return d;
  let perp = sub(d, scale(base, c));
  if (len(perp) < 1e-6) perp = { x: base.y, y: -base.x, z: 0.3 };
  perp = norm(perp);
  return add(scale(base, Math.cos(most)), scale(perp, Math.sin(most)));
}

/** Push `q` out of the capsule from `a` to `b` of radius `r`. */
function outOf(q: V3, a: V3, b: V3, r: number): V3 {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(q, a), ab) / dot(ab, ab)));
  const c = add(a, scale(ab, t));
  const d = sub(q, c);
  const l = len(d);
  return l >= r || l < 1e-6 ? q : add(c, scale(d, r / l));
}

/** The chain an arm hangs on: where it is pinned (the break, or the
 * wrist), the line of the piece above it, and its links' lengths. */
type Chain = { pin: V3; base: V3; lengths: number[]; shoulder: V3; elbow: V3 };

function chainOf(p: SkierPose, i: number, kind: ArmBreak): Chain {
  const s = i === 0 ? -1 : 1;
  const f = trunkOf(p);
  const shoulder = p.shoulders[i];
  if (kind === "upper") {
    const base = inTrunk(f, GUARD.humerus(s));
    return {
      pin: add(shoulder, scale(base, BREAK.upper)),
      base,
      lengths: [BODY.upperArm - BREAK.upper, BODY.forearm],
      shoulder,
      elbow: shoulder,
    };
  }
  const elbow = add(shoulder, scale(inTrunk(f, GUARD.arm(s)), BODY.upperArm));
  const base = inTrunk(f, GUARD.forearm(s));
  const at = kind === "fore" ? BREAK.fore : BREAK.wrist;
  return {
    pin: add(elbow, scale(base, at)),
    base,
    lengths: [BODY.forearm - at],
    shoulder,
    elbow,
  };
}

/** One step of an arm's hanging piece under `gravity` (body frame, m/s²). */
function stepChain(a: ArmSwing, c: Chain, gravity: V3, h: number, p: SkierPose): void {
  const keep = Math.exp(-SWING.damping * h);
  for (let k = 0; k < a.cur.length; k++) {
    const v = scale(sub(a.cur[k], a.prev[k]), keep);
    a.prev[k] = a.cur[k];
    a.cur[k] = add(add(a.cur[k], v), scale(gravity, h * h));
  }
  holdChain(a, c, p);
}

/** The chain held to its pin, its lengths, its cones and out of his trunk. */
function holdChain(a: ArmSwing, c: Chain, p: SkierPose): void {
  for (let it = 0; it < 4; it++) {
    let from = c.pin;
    let line = c.base;
    for (let k = 0; k < a.cur.length; k++) {
      let d = sub(a.cur[k], from);
      d = len(d) > 1e-6 ? norm(d) : line;
      d = cone(d, line, k === 0 ? SWING.breakCone : SWING.elbowCone);
      let q = add(from, scale(d, c.lengths[k]));
      q = outOf(q, p.hips, p.neck, SWING.trunk);
      a.cur[k] = q;
      from = q;
      line = d;
    }
  }
}

/**
 * THE POSE WITH ITS BROKEN ARMS: each broken arm's pole dropped, the
 * sound part held as `GUARD` holds it and the piece below the break swung
 * on (`dangle`, kept by the caller between frames) by `dt` s under the
 * `gravity` his arm feels in his body frame. A pose with no break comes
 * back as it was.
 */
export function breakArms(
  p: SkierPose,
  breaks: readonly [ArmBreak | null, ArmBreak | null],
  dangle: Dangle,
  dt: number,
  gravity: V3 = { x: 0, y: -9.81, z: 0 },
): SkierPose {
  if (!breaks[0] && !breaks[1]) {
    dangle[0].kind = dangle[1].kind = null;
    return p;
  }
  const g = gravity;
  const elbows: [V3, V3] = [p.elbows[0], p.elbows[1]];
  const hands: [V3, V3] = [p.hands[0], p.hands[1]];
  const kinks: [Kink | null, Kink | null] = [null, null];
  const dropped: [boolean, boolean] = [false, false];
  for (const i of [0, 1]) {
    const kind = breaks[i];
    if (!kind) {
      dangle[i].kind = null;
      continue;
    }
    const c = chainOf(p, i, kind);
    const a = dangle[i];
    let settle = 0;
    if (a.kind !== kind) {
      // Hung fresh, straight down the line of the piece above it, and let
      // swing to rest from there.
      a.kind = kind;
      a.cur = [];
      let at = c.pin;
      for (const l of c.lengths) {
        at = add(at, scale(c.base, l));
        a.cur.push(at);
      }
      a.prev = a.cur.slice();
      settle = SWING.settle;
    }
    const run = dt > 0 ? Math.min(dt, 0.1) : settle;
    for (let t = 0; t < run - 1e-9; t += SWING.step) stepChain(a, c, g, SWING.step, p);
    // Held to the pin as it stands now, even with no time passed.
    if (run <= 0) holdChain(a, c, p);
    dropped[i] = true;
    kinks[i] = { bone: kind, at: c.pin };
    if (kind === "upper") {
      elbows[i] = a.cur[0];
      hands[i] = a.cur[1];
    } else {
      elbows[i] = c.elbow;
      hands[i] = a.cur[0];
    }
  }
  return { ...p, elbows, hands, kinks, dropped };
}
