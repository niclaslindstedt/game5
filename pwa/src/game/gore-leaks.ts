// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE BLOOD COMES OUT OF HIS CLOTHES — three-free, for `gore-view.ts`.
// A part hit hard enough to split the skin (`engine/game/gore.ts`'s
// `bleedsOf`) bleeds under the clothes: the jacket, the pants, the gloves
// and the helmet hold it against him, it soaks through the cloth round the
// wound and runs down inside them, and it comes out only at a GAP — the
// collar, the jacket's hem, a sleeve's cuff, a trouser leg over the boot,
// from under the helmet — whichever of the part's gaps is lowest as he
// lies, the way the blood runs. A piece torn off has no cloth left to hold
// it: that wound bleeds where it is (`gore-view.ts`).

import { looseOf, packedUnder, type BodyPart, type GameState } from "@engine";

import type { BoneFrame, SkierBone } from "./skier-rig.ts";

type V3 = { x: number; y: number; z: number };
type Frames = Record<SkierBone, BoneFrame>;

/** The openings in his clothes the blood can run out of. */
export type Gap =
  | "face"
  | "nape"
  | "collarF"
  | "collarB"
  | "hemF"
  | "hemB"
  | "cuffL"
  | "cuffR"
  | "ankleL"
  | "ankleR";

/** A point `k` of the way along a bone, `d` m out along its front (z). */
const along = (b: BoneFrame, k: number, d = 0, side = 0): V3 => ({
  x: b.head.x + b.y.x * b.length * k + b.z.x * d + b.x.x * side,
  y: b.head.y + b.y.y * b.length * k + b.z.y * d + b.x.y * side,
  z: b.head.z + b.y.z * b.length * k + b.z.z * d + b.x.z * side,
});

/** Where each gap is on his frames. */
export function gapAt(gap: Gap, f: Frames): V3 {
  switch (gap) {
    // Out from under the helmet: down the face, or the nape.
    case "face":
      // The head's frame stands at his eyes: the face is below its origin.
      return along(f.head, -0.36, 0.09);
    case "nape":
      return along(f.head, 0.2, -0.08);
    // The jacket's collar round the neck.
    case "collarF":
      return along(f.chest, 1.12, 0.07);
    case "collarB":
      return along(f.chest, 1.12, -0.07);
    // The jacket's hem over the hips, in front and behind.
    case "hemF":
      return along(f.pelvis, -0.1, 0.13);
    case "hemB":
      return along(f.pelvis, -0.1, -0.13);
    // A sleeve's cuff over the glove at the wrist.
    case "cuffL":
      return along(f.hand_l, 0);
    case "cuffR":
      return along(f.hand_r, 0);
    // A trouser leg over the boot's top.
    case "ankleL":
      return along(f.shin_l, 0.88, 0.05);
    case "ankleR":
      return along(f.shin_r, 0.88, 0.05);
  }
}

/** A cheek under the helmet's rim, `side` −1 left or 1 right: where blood
 * off his face runs from when he lies on that side. */
export function cheekAt(f: Frames, side: number): V3 {
  return along(f.head, -0.25, 0.07, 0.055 * side);
}

/** Under his nose, below the goggles: where blood off his face starts. */
export function noseAt(f: Frames): V3 {
  return along(f.head, -0.1, 0.12);
}

/** The middle of a body part on his frames: where it is hurt. */
export function partAt(part: BodyPart, f: Frames): V3 {
  switch (part) {
    case "head":
      return along(f.head, 0.55, 0.02);
    case "neck":
      return along(f.chest, 1.3);
    case "chest":
      return along(f.chest, 0.6, 0.1);
    case "back":
      return along(f.chest, 0.4, -0.1);
    case "abdomen":
      return along(f.pelvis, 0.75, 0.1);
    case "pelvis":
      return along(f.pelvis, 0.15);
    case "shoulderL":
      return along(f.shoulder_l, 0);
    case "shoulderR":
      return along(f.shoulder_r, 0);
    case "armL":
      return along(f.forearm_l, 0.1);
    case "armR":
      return along(f.forearm_r, 0.1);
    case "handL":
      return along(f.hand_l, 0.6);
    case "handR":
      return along(f.hand_r, 0.6);
    case "thighL":
      return along(f.thigh_l, 0.5, 0.04);
    case "thighR":
      return along(f.thigh_r, 0.5, 0.04);
    case "kneeL":
      return along(f.shin_l, 0, 0.05);
    case "kneeR":
      return along(f.shin_r, 0, 0.05);
    case "shinL":
      return along(f.shin_l, 0.5, 0.04);
    case "shinR":
      return along(f.shin_r, 0.5, 0.04);
    case "footL":
      return along(f.boot_l, 0.4);
    case "footR":
      return along(f.boot_r, 0.4);
  }
}

const TRUNK: Gap[] = ["collarF", "collarB", "hemF", "hemB"];

/** The gaps a part's blood can run out of, inside the garment that holds
 * it: the helmet's for the head, the jacket's for the trunk and the arms,
 * the glove's cuff for a hand, the pants' for the legs, the boot's top for
 * a foot. */
export const GAPS: Record<BodyPart, readonly Gap[]> = {
  head: ["face", "nape"],
  neck: ["collarF", "collarB"],
  chest: TRUNK,
  back: TRUNK,
  abdomen: TRUNK,
  pelvis: ["hemF", "hemB", "ankleL", "ankleR"],
  shoulderL: [...TRUNK, "cuffL"],
  shoulderR: [...TRUNK, "cuffR"],
  armL: ["cuffL", "hemF", "hemB"],
  armR: ["cuffR", "hemF", "hemB"],
  handL: ["cuffL"],
  handR: ["cuffR"],
  thighL: ["ankleL", "hemF", "hemB"],
  thighR: ["ankleR", "hemF", "hemB"],
  kneeL: ["ankleL", "hemF", "hemB"],
  kneeR: ["ankleR", "hemF", "hemB"],
  shinL: ["ankleL"],
  shinR: ["ankleR"],
  footL: ["ankleL"],
  footR: ["ankleR"],
};

/** The gap a part's blood runs out of as he lies now: the lowest of its
 * gaps, `height` the world height of a point on his frames. */
export function lowestGap(part: BodyPart, f: Frames, height: (p: V3) => number): Gap {
  let best = GAPS[part][0];
  let low = Infinity;
  for (const g of GAPS[part]) {
    const h = height(gapAt(g, f));
    if (h < low) {
      low = h;
      best = g;
    }
  }
  return best;
}

/** THE SOAK INSIDE THE CLOTHES: points from the wound down to the gap it
 * runs out of, as far along as the blood held so far has reached
 * (`reach` 0 … 1), each `r` m across — the stain spreading from where he
 * was hit along the way it runs. */
export function soakPath(from: V3, to: V3, reach: number, r: number): { at: V3; r: number }[] {
  const out: { at: V3; r: number }[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    if (k > reach + 1e-6) break;
    out.push({
      at: {
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
        z: from.z + (to.z - from.z) * k,
      },
      // Widest at the wound, a narrower run down to the gap.
      r: r * (1 - 0.45 * k),
    });
  }
  return out;
}

/** The skin's bone each part lies on: a part whose bone went with a piece
 * torn off bleeds as that wound, not under clothes it no longer has. */
export const PART_BONE: Record<BodyPart, SkierBone> = {
  head: "head",
  neck: "head",
  chest: "chest",
  back: "chest",
  abdomen: "pelvis",
  pelvis: "pelvis",
  shoulderL: "upperarm_l",
  shoulderR: "upperarm_r",
  armL: "forearm_l",
  armR: "forearm_r",
  handL: "hand_l",
  handR: "hand_r",
  thighL: "thigh_l",
  thighR: "thigh_r",
  kneeL: "shin_l",
  kneeR: "shin_r",
  shinL: "shin_l",
  shinR: "shin_r",
  footL: "boot_l",
  footR: "boot_r",
};

/** How far a litre of blood spreads on the snow, m²: on the packed groomer
 * (it cannot sink in, so it runs out wide) and in loose snow (it drinks it
 * down) — thin snow spreads it further, a deep day's less. */
const SPREAD = { packed: 4.2, loose: 0.9 };

/** How far a litre of blood spreads on the snow at (x, z), m². */
export function spreadAt(state: GameState, x: number, z: number): number {
  const p = packedUnder(state.level.packedAt(x, z), state.fresh, looseOf(state));
  const deep = 0.55 + 0.45 * Math.max(0.3, state.snowDepth);
  return (SPREAD.loose + (SPREAD.packed - SPREAD.loose) * p) / deep;
}
