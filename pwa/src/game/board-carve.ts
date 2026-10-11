// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEGS IN A CARVE, solved SHIN FIRST (`boardPose` blends them in by
// how far he is on his toe edge or his heel edge). Three-free.
//
// What a rider on his toe edge does with his legs, read off photographs of
// carved toeside turns and the coaching that describes them: both ANKLES
// flexed forward into the soft boots — the shins laid out over the toe
// edge as far as the boot lets them (some 25–35° off the deck's normal) and
// never flat on the snow — both KNEES bent deep (70–100°, more the harder
// it is cut) and pointing DOWN THE TOE EDGE toward the snow, the rear one
// driven forward toward the front binding rather than left behind, and the
// hips LOW and sat back over the deck from the knees, with the trunk
// folded forward over them so the body is compact and quiet over the edge.
// Stood up tall on straight legs with the body one long line from the edge
// — what an inclination alone gives — is the beginner's toeside.
//
// On the HEEL edge the highback holds the shin: it leans forward of the
// deck's normal only as far as the highback's lean and a little give, so
// as the deck tips onto its heel edge the shins go over with it and the
// knees bend deep with the hips sat low behind them, as on a chair.
//
// So the shin's way is decided first (off the edge, the ankle's reach and
// the drive), the knee stands at the shin's length along it, and each thigh
// goes back from its knee at the knee's flexion; the hips are where the two
// thighs end, square to the board as the rest of the pose has them.

import { BODY, SHIN_ABOVE_CUFF } from "./skier-pose.ts";
import { solveLimb } from "./skier-limbs.ts";
import { add, dot, len, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** THE TOESIDE LEGS: the knees' flexion in a carve and cut hard (rad —
 * ~80° and ~100°), the least the shin lies to the snow (rad, ~11°: low,
 * never on it), the soft boot's forward flex, least and most (rad, ~16° to
 * ~35°), how far the rear shin is turned toward the front binding and the
 * front one toward the nose (rad), and how much deeper the rear knee is
 * asked to fold than the front, rad — it is the one a rider leaves straight
 * — and how much less both fold at a crawl, rad. */
export const TOE_LEGS = {
  knee: 1.3,
  cut: 0.3,
  shinSnow: 0.19,
  ankleLeast: 0.28,
  ankle: 0.62,
  drive: 0.3,
  front: 0.08,
  rear: 0.45,
  slow: 0.3,
};

const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** `v` turned `a` rad about the unit axis `k`. */
function turn(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

/** What the toeside solve is handed, in the body frame. */
export type ToeLegsInput = {
  /** Each leg's cuff top (where the figure's leg ends) — index 0 the left. */
  cuffs: readonly [V3, V3];
  /** The deck's normal, its way to the nose, and the way the rider's toes
   * point across it (in the deck's plane). */
  normal: V3;
  along: V3;
  toes: V3;
  /** Which leg is the front one, and the edge, rad (its size). */
  front: 0 | 1;
  edge: number;
  /** The pelvis's line, left to right (unit), square to the board. */
  pelvis: V3;
  /** Each knee's flexion, rad. */
  flex: readonly [number, number];
};

/** The hips, the hip joints and the knees of a toeside carve. */
export type ToeLegs = { hips: V3; hipJoints: [V3, V3]; knees: [V3, V3] };

/** THE SHIN'S FORWARD FLEX off the deck's normal at an edge, rad: as far
 * as lays it `TOE_LEGS.shinSnow` off the snow, inside the boot's reach. */
export function toeAnkle(edge: number): number {
  const want = Math.PI / 2 - Math.abs(edge) - TOE_LEGS.shinSnow;
  return Math.max(TOE_LEGS.ankleLeast, Math.min(TOE_LEGS.ankle, want));
}

/** THE HEELSIDE LEGS: the knees' flexion in a carve and cut hard (rad —
 * ~85° and ~95°, sat as on a chair), the shin's forward lean off the
 * deck's normal (rad, ~26°: the highback's lean and the boot's give — the
 * shin goes over with the deck onto the heel edge, never forward over the
 * toes while the deck is tipped back), the rear knee's drive toward the
 * front binding and the front one's toward the nose, and the rear knee's
 * extra fold, and how much less the knees fold at a crawl (rad). */
export const HEEL_LEGS = {
  knee: 1.45,
  cut: 0.15,
  ankle: 0.45,
  drive: 0.2,
  front: 0.05,
  rear: 0.2,
  slow: 0.4,
};

/** THE TOESIDE LEGS, solved shin first. */
export function toeLegs(input: ToeLegsInput): ToeLegs {
  return edgeLegs(input, toeAnkle(input.edge), TOE_LEGS.drive, TOE_LEGS.front);
}

/** THE HEELSIDE LEGS, solved shin first. */
export function heelLegs(input: ToeLegsInput): ToeLegs {
  return edgeLegs(input, HEEL_LEGS.ankle, HEEL_LEGS.drive, HEEL_LEGS.front);
}

/** The legs on an edge: each shin forward of the deck's normal by `a`
 * (toward the toes) and turned toward the nose by `drive` (the rear leg)
 * or `front`, the thighs back from the knees at their flexion. */
function edgeLegs(input: ToeLegsInput, a: number, drive: number, front: number): ToeLegs {
  const { normal, along, toes } = input;
  const shin = [0, 1].map((i) => {
    // Forward over the toes by the ankle's flex, then turned along the
    // deck: the rear knee driven toward the front binding.
    const fwd = norm(add(scale(normal, Math.cos(a)), scale(toes, Math.sin(a))));
    const d = i === input.front ? front : drive;
    return norm(add(scale(fwd, Math.cos(d)), scale(along, Math.sin(d))));
  });
  const knees0 = [0, 1].map((i) => add(input.cuffs[i], scale(shin[i], SHIN_ABOVE_CUFF)));
  // Each thigh back from its knee at the knee's flexion: the shin's way
  // turned back toward the heels.
  const joints = [0, 1].map((i) => {
    const axis = norm(cross(shin[i], scale(toes, -1)));
    const thigh = turn(shin[i], axis, input.flex[i]);
    return add(knees0[i], scale(thigh, BODY.thigh));
  });
  const hips = mix(joints[0], joints[1], 0.5);
  const hipJoints: [V3, V3] = [
    add(hips, scale(input.pelvis, -BODY.hip)),
    add(hips, scale(input.pelvis, BODY.hip)),
  ];
  // The knees re-solved to the joints, aimed where the shins put them.
  const knees = [0, 1].map((i) => {
    const mid = mix(hipJoints[i], input.cuffs[i], 0.5);
    const aim = sub(knees0[i], mid);
    const pole = len(aim) > 1e-6 ? norm(aim) : toes;
    return solveLimb(hipJoints[i], input.cuffs[i], BODY.thigh, SHIN_ABOVE_CUFF, pole);
  }) as [V3, V3];
  return { hips, hipJoints, knees };
}

/** What `onEdge` is handed besides the legs: which edge, the cuffs, the
 * deck, which way he faces (+1 regular), the front leg, the edge (rad),
 * the pelvis's line, how hard the turn is cut (0..1), the knees' fold
 * beyond the carve's (a hit, the tuck, rad) and his speed, m/s. */
export type EdgeAsk = {
  toe: boolean;
  cuffs: readonly [V3, V3];
  deck: { normal: V3; along: V3; right: V3 };
  face: number;
  front: 0 | 1;
  edge: number;
  pelvis: V3;
  bend: number;
  more: number;
  speed: number;
};

/** THE LEGS ON AN EDGE blended `share` of the way into `legs` (the hips,
 * the hip joints and the knees the stance set — made over in place). */
export function onEdge(legs: ToeLegs, share: number, ask: EdgeAsk): void {
  const L = ask.toe ? TOE_LEGS : HEEL_LEGS;
  // (a sideslip at a crawl stands taller than a carve's g asks of him)
  const k = Math.max(0, Math.min(1, (ask.speed - 2) / 6));
  const bend = L.knee + L.cut * ask.bend + ask.more - L.slow * (1 - k * k * (3 - 2 * k));
  const deep = bend + L.rear;
  const flex: [number, number] =
    ask.front === 0 ? [bend - L.rear / 2, deep] : [deep, bend - L.rear / 2];
  const c = (ask.toe ? toeLegs : heelLegs)({
    cuffs: ask.cuffs,
    normal: ask.deck.normal,
    along: ask.deck.along,
    toes: scale(ask.deck.right, ask.face),
    front: ask.front,
    edge: ask.edge,
    pelvis: ask.pelvis,
    flex,
  });
  legs.hips = mix(legs.hips, c.hips, share);
  for (let i = 0; i < 2; i++) {
    legs.hipJoints[i] = add(legs.hips, scale(ask.pelvis, (i === 0 ? -1 : 1) * BODY.hip));
    const mid = mix(legs.hipJoints[i], ask.cuffs[i], 0.5);
    const was = norm(sub(legs.knees[i], mid));
    const pole = norm(mix(was, norm(sub(c.knees[i], mid)), share));
    legs.knees[i] = solveLimb(legs.hipJoints[i], ask.cuffs[i], BODY.thigh, SHIN_ABOVE_CUFF, pole);
  }
}
