// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR AMBULANCE'S CREW, POSED — every pose the four who carry the
// injured skier to the helicopter (`rescue-plan.ts`) are drawn between, as
// KEYS of a body in its boots (`party-pose.ts`'s `Key`, laid on the crowd's
// bodies by `civilian-moves.ts`' `keyPosed`), and the WEIGHTS a moment of
// the plan puts on them. Three-free, so the suite reads it.
//
// A stretcher is carried by four, one at each corner on its OUTSIDE, all
// facing the way they go, each with his INNER hand on the side rail — the
// left two with the right hand, the right two with the left — the other
// arm free. So every holding pose comes twice, once a hand: knelt beside it
// on the snow (`kneel`), stood with it held (`hold`), the four keys of a
// stride carrying it (`carry0..3`), and the hand raised a span (`raise`),
// which a bearer leans on, added over whatever else he is doing, to hold
// his corner level on a slope and to lift it onto the cabin's floor. And
// the stride with both hands free (`walk0..3`), boarding and walking clear.
//
// THE STRIDE IS PACED TO THE GROUND: in each key a foot on the snow stands
// where a LINEAR stance puts it (its four keys a quarter of a stride
// apart, the planted foot moved back a quarter of the stride's length
// between each), so the blend of two keys moves a planted foot back at
// exactly the walking speed and it never slides — `RESCUE_STRIDE` is the
// distance one cycle of the keys carries the body.
//
// The frame is the bearer's: x right, y up, z the way he faces, the floor
// at 0, as the civilians'.

import type { CrowdBody } from "@engine";

import type { Holding } from "./civilian-moves.ts";
import { keyPosed } from "./civilian-moves.ts";
import { CROWD_LOOKS, type Posed } from "./crowd-rig.ts";
import { ANKLE, STAND, blend, v, type Key } from "./party-pose.ts";

/** One stride (two steps) of the keys, m: a step of 0.55 m, as a skier
 * walks in his boots (`civilian-roles.ts`' `BOOT_GAIT`). */
export const RESCUE_STRIDE = 1.1;

/** Where a bearer's holding hand is on the reference man (1.8 m tall),
 * his own frame: out at his side, the arm all but straight, m. The rail
 * stands `GRIP` under the hand's point (the glove closed round it). */
export const HOLD_HAND = { x: 0.27, y: 0.76, z: 0.02 } as const;
export const GRIP = 0.035;
/** How far `raise` lifts the holding hand, m (the reference man's). */
export const RAISE = 0.15;
/** Where the rail is under a bearer KNELT beside the stretcher on the snow
 * (the board lying on it), his own frame, m. */
export const KNEEL_HAND = { x: 0.3, y: 0.105, z: 0.12 } as const;

/** KNELT FACING THE WORK on both knees, his two hands out ahead of him:
 * over the casualty (`tend`: on his chest and hip, `Near`, then pulled up
 * toward him rolling him onto his side, `Pull`) or on the board's near rail
 * (`push`: at hand, `Near`, then out at arm's length, `Far`, sliding it
 * under him). Where the hands are, his own frame, m. */
export const FACE_HANDS = {
  tendNear: { y: 0.3, z: 0.62 },
  tendPull: { y: 0.48, z: 0.38 },
  pushNear: { y: 0.16, z: 0.34 },
  pushFar: { y: 0.16, z: 0.8 },
} as const;
export type FaceKind = "tend" | "push";

/** The targets, in the order the morph targets and weights go in (the
 * stance, `STOOD`, is the base). */
export const CREW_POSES = [
  "kneelL",
  "kneelR",
  "holdL",
  "holdR",
  "raiseL",
  "raiseR",
  "carryL0",
  "carryL1",
  "carryL2",
  "carryL3",
  "carryR0",
  "carryR1",
  "carryR2",
  "carryR3",
  "walk0",
  "walk1",
  "walk2",
  "walk3",
  "tendNear",
  "tendPull",
  "pushNear",
  "pushFar",
] as const;
export type CrewTarget = (typeof CREW_POSES)[number];

/** Which hand a bearer holds his rail with: `L` his left (he walks on the
 * stretcher's right), `R` his right, or none. */
export type Hand = "L" | "R" | null;

/** STOOD IN BOOTS, the arms easy at his sides. */
const STOOD: Key = {
  ...blend(STAND, STAND, 0),
  hipY: 0.965,
  pitch: 0.03,
  hands: [v(-0.29, 0.83, 0.06), v(0.29, 0.83, 0.06)],
};

const copy = (k: Key): Key => blend(k, k, 0);
const side = (hand: "L" | "R"): 0 | 1 => (hand === "L" ? 0 : 1);
const sign = (hand: "L" | "R"): number => (hand === "L" ? -1 : 1);

/** `key` with the holding hand on the rail at `y` over the floor. */
function holding(key: Key, hand: Hand, y: number = HOLD_HAND.y): Key {
  const out = copy(key);
  if (hand) out.hands[side(hand)] = v(sign(hand) * HOLD_HAND.x, y, HOLD_HAND.z);
  return out;
}

/** KNELT beside the stretcher on the snow: down on the outer knee, the
 * inner foot set, the trunk bent over it, the holding hand on the rail and
 * the free one on the casualty's mattress. */
function kneel(hand: "L" | "R"): Key {
  const s = sign(hand);
  const i = side(hand);
  const key = copy(STOOD);
  key.hipY = 0.5;
  key.hipZ = -0.1;
  key.hipX = s * 0.03;
  key.pitch = 0.78;
  key.nod = -0.25;
  key.roll = s * 0.06;
  // The inner foot set flat ahead, the outer knee down behind it.
  key.feet[i] = v(s * 0.16, ANKLE, 0.24);
  key.feet[1 - i] = v(-s * 0.15, 0.12, -0.42);
  key.hands[i] = v(s * KNEEL_HAND.x, KNEEL_HAND.y, KNEEL_HAND.z);
  key.hands[1 - i] = v(s * 0.12, 0.3, 0.38);
  return key;
}

/** Knelt on both knees facing the work, sat back or leant out over it,
 * both hands at (`y`, `z`), a hand's breadth either side of his middle. */
function faceKneel(y: number, z: number, pitch: number, hipY: number, hipZ: number): Key {
  const key = copy(STOOD);
  key.hipY = hipY;
  key.hipZ = hipZ;
  key.hipX = 0;
  key.pitch = pitch;
  key.nod = -0.3;
  key.roll = 0;
  key.twist = 0;
  key.feet = [v(-0.15, 0.12, -0.42), v(0.15, 0.12, -0.42)];
  key.hands = [v(-0.17, y, z), v(0.17, y, z)];
  return key;
}

const FACE: Record<keyof typeof FACE_HANDS, Key> = {
  tendNear: faceKneel(FACE_HANDS.tendNear.y, FACE_HANDS.tendNear.z, 1.0, 0.52, -0.05),
  tendPull: faceKneel(FACE_HANDS.tendPull.y, FACE_HANDS.tendPull.z, 0.45, 0.55, -0.1),
  pushNear: faceKneel(FACE_HANDS.pushNear.y, FACE_HANDS.pushNear.z, 0.9, 0.4, -0.2),
  pushFar: faceKneel(FACE_HANDS.pushFar.y, FACE_HANDS.pushFar.z, 1.1, 0.5, 0.1),
};

/** THE STRIDE at its `q`th quarter (0..3): the left foot planted from
 * `q = 0` (set down ahead) through 1 to 2 (pushed off behind), swung
 * forward through 3; the right half a stride on. A planted foot stands
 * where a linear stance puts it, so the blend between keys never slides
 * it; the swinging foot is lifted a hand's breadth at mid-swing. */
export function strideKey(q: 0 | 1 | 2 | 3, hand: Hand): Key {
  const key = copy(STOOD);
  key.hipY = 0.945;
  key.pitch = 0.06;
  const half = RESCUE_STRIDE / 4;
  // Each foot's place by quarter: down ahead, under him, behind, swinging.
  const along = [half, 0, -half, 0];
  const lift = [0, 0, 0, 0.09];
  for (const i of [0, 1] as const) {
    const k = (q + 2 * i) % 4;
    key.feet[i] = { ...key.feet[i], y: ANKLE + lift[k], z: 0.02 + along[k] };
    // The free arm against its leg, a little.
    key.hands[i] = { ...key.hands[i], z: 0.06 - 0.5 * along[k] };
  }
  // The body low over a foot set down, high over the one it passes.
  key.hipY -= q % 2 === 0 ? 0.03 : 0;
  key.hipX = (q === 1 ? -1 : q === 3 ? 1 : 0) * 0.025;
  key.twist = (q === 0 ? 1 : q === 2 ? -1 : 0) * 0.06;
  return holding(key, hand);
}

/** A target's key. */
export function crewKey(target: CrewTarget | "stand"): Key {
  if (target === "stand") return STOOD;
  if (target in FACE) return FACE[target as keyof typeof FACE];
  const hand = /L/.test(target) ? "L" : "R";
  if (target.startsWith("kneel")) return kneel(hand);
  if (target.startsWith("hold")) return holding(STOOD, hand);
  if (target.startsWith("raise")) return holding(STOOD, hand, HOLD_HAND.y + RAISE);
  const q = Number(target.slice(-1)) as 0 | 1 | 2 | 3;
  if (target.startsWith("carry")) return strideKey(q, hand);
  return strideKey(q, null);
}

const EMPTY: Holding = { tool: "hold", tip: 0 };

/** The skeleton of every target of `body`, the stance first — what the
 * figure is built at (`civilian-shapes.ts`' `buildPosedFigure`). */
export function crewTargets(body: CrowdBody): { posed: Posed; holding: Holding }[] {
  const look = CROWD_LOOKS[body];
  return (["stand", ...CREW_POSES] as const).map((t) => ({
    posed: keyPosed(crewKey(t), look),
    holding: EMPTY,
  }));
}

/** What a bearer is doing at a moment, as the plan says it
 * (`rescue-plan.ts`' `CrewPose`). */
export type CrewMove = {
  /** Knelt by the stretcher (0) to stood holding it (1). */
  rise: number;
  /** How far along a stride he is, in strides (its fraction the phase),
   * and how much of him is striding (0 stood … 1 walking). */
  stride: number;
  walking: number;
  /** The hand on the rail, or none. */
  hand: Hand;
  /** The holding hand raised, in spans of `RAISE` (−1 … 1). */
  raise: number;
  /** Knelt facing the work (0 not … 1 wholly), which work, and how far
   * through it the hands are (0 `Near` … 1 `Pull` / `Far`). */
  face?: number;
  work?: FaceKind;
  reach?: number;
};

const AT = Object.fromEntries(CREW_POSES.map((k, i) => [k, i])) as Record<CrewTarget, number>;

/** THE WEIGHTS of a moment, one a target in `CREW_POSES`' order, written
 * into `out`: whole bodies that sum to one past the stance — the kneel,
 * the hold and the stride blended — and the raise ADDED over them (the
 * raise less the hold, so only the arm moves). */
export function crewDials(m: CrewMove, out: Float32Array): Float32Array {
  out.fill(0);
  const face = Math.max(0, Math.min(1, m.face ?? 0));
  const rest = 1 - face;
  const rise = Math.max(0, Math.min(1, m.rise));
  const walking = Math.max(0, Math.min(1, m.walking)) * rise;
  const x = (m.stride - Math.floor(m.stride)) * 4;
  const q = Math.floor(x) % 4;
  const f = x - Math.floor(x);
  const cyc = (name: string): void => {
    out[AT[`${name}${q}` as CrewTarget]] += (1 - f) * walking;
    out[AT[`${name}${(q + 1) % 4}` as CrewTarget]] += f * walking;
  };
  if (m.hand) {
    const h = m.hand;
    out[AT[`kneel${h}`]] += 1 - rise;
    out[AT[`hold${h}`]] += rise - walking;
    cyc(`carry${h}`);
    out[AT[`raise${h}`]] += m.raise * rise;
    out[AT[`hold${h}`]] -= m.raise * rise;
  } else {
    // Hands free: stood (the stance, the base) or walking.
    cyc("walk");
  }
  // Knelt facing the work, over whatever else is left of him.
  if (face > 0) {
    for (let i = 0; i < out.length; i++) out[i] *= rest;
    const r = Math.max(0, Math.min(1, m.reach ?? 0));
    const [a, b] =
      m.work === "push" ? (["pushNear", "pushFar"] as const) : (["tendNear", "tendPull"] as const);
    out[AT[a]] += face * (1 - r);
    out[AT[b]] += face * r;
  }
  return out;
}

/** Where a bearer's rail is in his own frame at a moment, m, for `body`:
 * on the snow beside him knelt, at his hand stood — what the plan stands
 * the stretcher on. */
export function railOf(body: CrowdBody, rise: number, raise: number): number {
  const k = CROWD_LOOKS[body].height / 1.8;
  const r = Math.max(0, Math.min(1, rise));
  const up = HOLD_HAND.y + RAISE * raise - GRIP;
  return k * (KNEEL_HAND.y - GRIP + (up - KNEEL_HAND.y + GRIP) * r);
}

/** The joints a bearer's figure is measured by: his hands, knees, ankles,
 * hips and middle. */
export const CREW_JOINTS = [
  "handL",
  "handR",
  "kneeL",
  "kneeR",
  "ankleL",
  "ankleR",
  "hipL",
  "hipR",
  "pelvis",
] as const;
export type CrewJoint = (typeof CREW_JOINTS)[number];

const skeletons = new Map<CrowdBody, Posed[]>();
const weights = new Float32Array(CREW_POSES.length);

/** WHERE HIS JOINTS ARE at a moment, his own frame, m: the stance and every
 * target blended by the weights the figure is drawn with (the morph
 * targets are the same blend of the same skeletons, near enough) — what
 * the suite holds against the stretcher. */
export function crewPoints(
  body: CrowdBody,
  m: CrewMove,
): Record<CrewJoint, [number, number, number]> {
  let sk = skeletons.get(body);
  if (!sk) {
    sk = crewTargets(body).map((t) => t.posed);
    skeletons.set(body, sk);
  }
  crewDials(m, weights);
  const out = {} as Record<CrewJoint, [number, number, number]>;
  for (const name of CREW_JOINTS) {
    const base = sk[0][name] as unknown as number[];
    const p: [number, number, number] = [base[0], base[1], base[2]];
    for (let k = 0; k < CREW_POSES.length; k++) {
      const w = weights[k];
      if (w === 0) continue;
      const q = sk[k + 1][name] as unknown as number[];
      for (let i = 0; i < 3; i++) p[i] += w * (q[i] - base[i]);
    }
    out[name] = p;
  }
  return out;
}

/** HIM, LYING (the casualty): stood straight in the stance's frame, legs
 * together and arms down at his sides, as he is laid on his back on the
 * board — the figure is turned to lie; and SPRAWLED as he was found, a knee
 * drawn up and an arm flung out, which the doctor straightens. */
const LIE: Key = {
  ...blend(STAND, STAND, 0),
  hipY: 0.965,
  pitch: 0,
  nod: 0,
  feet: [v(-0.09, ANKLE, 0), v(0.09, ANKLE, 0)],
  hands: [v(-0.25, 0.86, 0.02), v(0.25, 0.86, 0.02)],
};
const SPRAWL: Key = {
  ...blend(LIE, LIE, 0),
  hipX: 0.03,
  roll: 0.06,
  nod: 0.15,
  feet: [v(-0.16, ANKLE, 0.02), v(0.2, 0.42, 0.06)],
  hands: [v(-0.62, 1.36, 0.02), v(0.3, 0.92, 0.12)],
};

/** The casualty's skeletons: lying straight (the base), and sprawled. */
export function casualtyTargets(body: CrowdBody): { posed: Posed; holding: Holding }[] {
  const look = CROWD_LOOKS[body];
  return [LIE, SPRAWL].map((k) => ({ posed: keyPosed(k, look), holding: EMPTY }));
}
