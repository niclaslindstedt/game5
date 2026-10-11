// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT FLYER POSED (`skis-body.ts` hands him here on a wingsuit
// run): no skis, no boots, no poles — the figure stood, walked or flown in
// the frame of his own body, the suit's wings lofted on it.
//
// His body is laid off a stand (`party-pose.ts`'s `movePose`, the walk at
// its own pace — still, stood), the stage's limbs over it
// (`skier-wingsuit.ts`), and the whole of him turned past the skier's frame
// to the attitude the engine flies him at and banked about his length
// (`wingsuitTilt`).

import * as THREE from "three";

import { WINGSUIT } from "@engine";

import { movePose } from "./party-pose.ts";
import type { SkierPose } from "./skier-joints.ts";
import type { Dressed } from "./skier-dress.ts";
import type { BodyFrame } from "./skier-ragdoll.ts";
import type { SkierBone } from "./skier-rig.ts";
import type { V3 } from "./skier-vec.ts";
import { wingsuitPose, wingsuitTilt, type WingsuitShape } from "./skier-wingsuit.ts";
import type { WingsuitWings } from "./wingsuit-figure.ts";

/** How far below his centre the snow is put flying, m: his hips at his
 * centre of gravity. */
const AIR_SNOW = -0.95;

const ACROSS = new THREE.Vector3(1, 0, 0);
const ALONG = new THREE.Vector3(0, 1, 0);
const turn = new THREE.Quaternion();
const basis = new THREE.Matrix4();
const ax = new THREE.Vector3();
const ay = new THREE.Vector3();
const az = new THREE.Vector3();

/** What the flyer is posed with: the pair's root (already at the engine's
 * place and turn), his figure's group and its pose call, the frame the
 * stand is laid in, and the wings. */
export type Flyer = {
  root: THREE.Object3D;
  group: THREE.Object3D;
  lay(p: SkierPose): void;
  /** The dressed skin, for its feet folded away flying. */
  dressed: Dressed;
  frame: BodyFrame;
  wings: WingsuitWings | null;
};

/** The snow under the flyer's root, in its frame, m: under a stand the
 * ground (or a hovering helicopter's skid, `hover` — the engine holds him
 * `WINGSUIT.search.stand` over it), flying `AIR_SNOW`. */
export function flyerSnow(
  shape: WingsuitShape,
  rootY: number,
  ground: number | null,
  atY: number,
): number {
  if (!shape.foot) return AIR_SNOW;
  if (shape.hover) return atY - WINGSUIT.search.stand - rootY;
  return ground === null ? AIR_SNOW : ground - rootY;
}

/** POSE THE FLYER in `shape`, the snow `snow` m under his root; the
 * wings' flutter on the clock `t`. Returns the pose he was laid in. */
export function poseFlyer(o: Flyer, shape: WingsuitShape, snow: number, t: number): SkierPose {
  const tilt = wingsuitTilt(shape);
  if (tilt.pitch) o.root.quaternion.multiply(turn.setFromAxisAngle(ACROSS, tilt.pitch));
  // Banked about his length, right side down for a positive bank.
  if (tilt.bank) o.root.quaternion.multiply(turn.setFromAxisAngle(ALONG, -tilt.bank));
  const walking = shape.foot === "walk";
  const base = movePose(
    { kind: "walk", t: shape.strides, pace: walking ? shape.pace : 0 },
    snow,
    o.frame,
  );
  const f = o.frame;
  o.group.position.set(f.origin.x, f.origin.y, f.origin.z);
  basis.makeBasis(
    ax.set(f.x.x, f.x.y, f.x.z),
    ay.set(f.y.x, f.y.y, f.y.z),
    az.set(f.z.x, f.z.y, f.z.z),
  );
  o.group.quaternion.setFromRotationMatrix(basis);
  const p = wingsuitPose(base, shape);
  o.lay(p);
  // FLYING, the feet are in the leg wing's sleeves (its booties, painted
  // on it): the boots' liners — a foot square to the shin — folded away.
  if (!shape.foot) {
    const bones = new Map<SkierBone, V3>([
      ["boot_l", p.feet[0]],
      ["boot_r", p.feet[1]],
    ]);
    o.dressed.frames(o.dressed.last(), { bones });
  }
  o.wings?.pose(p, { pressure: shape.pressure, unzip: shape.unzip, t });
  return p;
}
