// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE DRESSED SKIN IS CUT for a piece torn off (`engine/game/gore.ts`)
// — three-free, so the suite reads it.
//
// The skier is one skin skinned on the rig (`skier-dress.ts`). A piece torn
// off is drawn by taking its BONES out of the body's skin — each collapsed
// to nothing at the joint it tore at, so every vertex they carried is
// gathered into the stump — and drawing a second skin of the same outfit
// with everything BUT those bones collapsed the same way: the arm in its
// sleeve and glove, the shin in its pant leg and boot, the head in its
// helmet. Where the two skins meet, the cut, a stump is laid over the hole
// (`gore-shapes.ts`).

import { GORE, GORE_PIECES, type GorePiece } from "@engine";

import type { BoneFrame, SkierBone } from "./skier-rig.ts";
import type { V3 } from "./skier-pose.ts";

/** Each piece's measures: its stump's radius and the bone out of it, m,
 * and which of the engine's flows it bleeds as. */
export const PIECE_LOOK: Record<
  GorePiece,
  { r: number; bone: number; flow: keyof typeof GORE.blood.flow }
> = {
  head: { r: 0.075, bone: 0.035, flow: "head" },
  armL: { r: 0.08, bone: 0.05, flow: "arm" },
  armR: { r: 0.08, bone: 0.05, flow: "arm" },
  forearmL: { r: 0.065, bone: 0.04, flow: "forearm" },
  forearmR: { r: 0.065, bone: 0.04, flow: "forearm" },
  legL: { r: 0.11, bone: 0.07, flow: "leg" },
  legR: { r: 0.11, bone: 0.07, flow: "leg" },
  shinL: { r: 0.08, bone: 0.055, flow: "shin" },
  shinR: { r: 0.08, bone: 0.055, flow: "shin" },
  lower: { r: 0.17, bone: 0.045, flow: "waist" },
};

/** Every bone a piece takes with it. */
export const PIECE_BONES: Record<GorePiece, readonly SkierBone[]> = {
  head: ["head"],
  armL: ["upperarm_l", "upperarm_lo_l", "elbow_l", "forearm_l", "forearm_lo_l", "hand_l"],
  armR: ["upperarm_r", "upperarm_lo_r", "elbow_r", "forearm_r", "forearm_lo_r", "hand_r"],
  forearmL: ["forearm_l", "forearm_lo_l", "hand_l"],
  forearmR: ["forearm_r", "forearm_lo_r", "hand_r"],
  legL: ["thigh_l", "knee_l", "shin_l", "boot_l"],
  legR: ["thigh_r", "knee_r", "shin_r", "boot_r"],
  shinL: ["shin_l", "boot_l"],
  shinR: ["shin_r", "boot_r"],
  lower: [
    "pelvis",
    "hip_l",
    "hip_r",
    "thigh_l",
    "knee_l",
    "shin_l",
    "boot_l",
    "thigh_r",
    "knee_r",
    "shin_r",
    "boot_r",
  ],
};

/** The pieces that hold another: the one a body is cut at when both are
 * gone. */
const HOLDS: Partial<Record<GorePiece, readonly GorePiece[]>> = {
  armL: ["forearmL"],
  armR: ["forearmR"],
  legL: ["shinL"],
  legR: ["shinR"],
  lower: ["legL", "legR", "shinL", "shinR"],
};

/** WHERE a piece tears, in the pose's own frames: the neck for the head,
 * the waist for the body torn in two, else the head of the piece's first
 * bone (the shoulder, the elbow, the hip, the knee). And the way out of
 * the body along the cut — what a stump faces. */
export function cutOf(piece: GorePiece, frames: Record<SkierBone, BoneFrame>): { at: V3; out: V3 } {
  if (piece === "head") {
    const c = frames.chest;
    return {
      at: {
        x: c.head.x + c.y.x * c.length,
        y: c.head.y + c.y.y * c.length,
        z: c.head.z + c.y.z * c.length,
      },
      out: c.y,
    };
  }
  if (piece === "lower") {
    const c = frames.chest;
    return { at: c.head, out: { x: -c.y.x, y: -c.y.y, z: -c.y.z } };
  }
  const first = frames[PIECE_BONES[piece][0]];
  return { at: first.head, out: first.y };
}

/** The pieces gone, a bit each in `GORE_PIECES`' order, as the CUTS the
 * body is drawn with: the outermost cut that holds each lost bone. */
export function cutsOf(lost: number): GorePiece[] {
  const gone = GORE_PIECES.filter((_, i) => lost & (1 << i));
  return gone.filter((p) => !gone.some((q) => HOLDS[q]?.includes(p)));
}

/** THE BODY'S CUT: every bone a lost piece took, and the piece it went
 * with — its collapse point is that piece's `cutOf`. */
export function bodyHides(lost: number): Map<SkierBone, GorePiece> {
  const out = new Map<SkierBone, GorePiece>();
  for (const piece of cutsOf(lost)) for (const b of PIECE_BONES[piece]) out.set(b, piece);
  return out;
}

/** Whether `bone` is drawn on the skin of `piece` torn off. */
export function onPiece(piece: GorePiece, bone: SkierBone): boolean {
  return PIECE_BONES[piece].includes(bone);
}

/** A SKIN CUT: every bone taken out, collapsed to nothing at a point (the
 * skin's own frame) — and a crushed skull's flattening, 0 … 1, the head
 * bone squashed along its height and spread across. */
export type Collapse = { bones: Map<SkierBone, V3>; crush?: number };

/** THE BODY'S SKIN CUT for the pieces `lost` and a skull crushed `crush`,
 * off the pose's frames. */
export function bodyCollapse(
  lost: number,
  crush: number,
  frames: Record<SkierBone, BoneFrame>,
): Collapse {
  const bones = new Map<SkierBone, V3>();
  for (const [bone, piece] of bodyHides(lost)) bones.set(bone, cutOf(piece, frames).at);
  return { bones, crush };
}

/** A TORN PIECE'S SKIN CUT: every bone the piece did NOT take, collapsed at
 * its cut — so only the piece is drawn — and every bone of a piece it held
 * that tore off before it (`before`, a bit a piece), collapsed at THAT
 * piece's cut: an arm torn off after its forearm is the upper arm alone. */
export function pieceCollapse(
  piece: GorePiece,
  frames: Record<SkierBone, BoneFrame>,
  before = 0,
): Collapse {
  const at = cutOf(piece, frames).at;
  const bones = new Map<SkierBone, V3>();
  for (const name of Object.keys(frames) as SkierBone[]) {
    if (!onPiece(piece, name)) bones.set(name, at);
  }
  for (const held of HOLDS[piece] ?? []) {
    if (!(before & (1 << GORE_PIECES.indexOf(held)))) continue;
    const cut = cutOf(held, frames).at;
    for (const b of PIECE_BONES[held]) bones.set(b, cut);
  }
  return { bones };
}

/** The far end of a piece, off its own bones: where its stick ends. */
export function farEnd(piece: GorePiece, f: Record<SkierBone, BoneFrame>): V3 {
  const tail = (b: BoneFrame, k = 1): V3 => ({
    x: b.head.x + b.y.x * b.length * k,
    y: b.head.y + b.y.y * b.length * k,
    z: b.head.z + b.y.z * b.length * k,
  });
  switch (piece) {
    case "head":
      return tail(f.head, 1.6);
    case "armL":
    case "forearmL":
      return tail(f.hand_l);
    case "armR":
    case "forearmR":
      return tail(f.hand_r);
    case "legL":
    case "shinL":
      return f.boot_l.head;
    case "legR":
    case "shinR":
      return f.boot_r.head;
    case "lower": {
      const l = f.boot_l.head;
      const r = f.boot_r.head;
      return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2, z: (l.z + r.z) / 2 };
    }
  }
}

/** The ragdoll's points (`RAGDOLL`) as the skin's bones nearest them. */
export const POINT_BONE: SkierBone[] = [
  "pelvis",
  "pelvis",
  "upperarm_l",
  "upperarm_r",
  "head",
  "shin_l",
  "shin_r",
  "boot_l",
  "boot_r",
  "forearm_l",
  "forearm_r",
  "hand_l",
  "hand_r",
];
