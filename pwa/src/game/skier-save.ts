// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SAVE, AS A BODY MAKES IT — what a skier does in the half second after
// something nearly threw him and did not (`SkierState.save`, kept by the
// engine's `crash.ts`): the shape his body is thrown into and the way he
// fights back out of it. Three-free, so the suite reads it; the view
// follows it on a spring (`skier-spring.ts`) and the pose lays it on top of
// everything else (`skier-pose.ts`).
//
//   * A HARD LANDING ridden out: sunk deep onto the legs, the trunk thrown
//     over the tips (or back onto the tails), rocked to the side it came
//     down crooked on, the head ducked — and the hands BRACED, brought
//     forward and a little wide where he can see them, held there while
//     the legs take it — then stood back up.
//   * A TRUNK TAKEN ON THE SHOULDER: that shoulder knocked back and the
//     trunk turned round with it, the body rocked away from the tree and
//     back on its heels, the head ducked, the far hand braced forward and
//     the near one drawn in against the blow.
//   * THE BODY DOWN AND BACK UP: leaned over to the side he went down on, a
//     hand put down to the snow there and pushed off it.
//   * AN EDGE THAT BIT: the trunk thrown toward the edge that caught and
//     brought back over the skis, sat back a little, both hands braced
//     forward.
//
// A professional rides these out SECURE: the arms are never flung up,
// swung or wheeled about for the balance — a skier who throws his arms
// about is a skier losing it. The hands go forward and stay quiet, the
// legs and the hips do the work, and the body is rocked ONCE and brought
// back, never wobbled from side to side.
//
// Each grows over `RISE` s and dies away over the rest of its own length,
// sized by how near it came (`Save.size`).

import type { Save } from "@engine";

import { smooth } from "./skier-stroke.ts";
import { mix, type V3 } from "./skier-vec.ts";

/** What a save does to the figure — every term 0 at rest. */
export type Jolt = {
  /** The trunk pitched over the tips (+) or thrown back (−), rad. */
  lurch: number;
  /** The trunk thrown off the legs to the right (+) or the left (−), rad. */
  sway: number;
  /** The shoulders turned, rad — positive takes the right shoulder back. */
  twist: number;
  /** The hips sunk toward the boots, m. */
  sink: number;
  /** Each hand braced forward and a little wide, 0..1 (left, right). */
  braceL: number;
  braceR: number;
  /** Each hand put down to the snow, 0..1 (left, right). */
  reachL: number;
  reachR: number;
  /** The head ducked down between the shoulders, 0..1. */
  duck: number;
};

export const NO_JOLT: Readonly<Jolt> = {
  lurch: 0,
  sway: 0,
  twist: 0,
  sink: 0,
  braceL: 0,
  braceR: 0,
  reachL: 0,
  reachR: 0,
  duck: 0,
};

export const JOLT_KEYS = Object.keys(NO_JOLT) as (keyof Jolt)[];

/** How long each save plays, s, and how long it takes to come on. */
const LENGTH = { landing: 1, tree: 0.75, body: 0.85, edge: 0.9, stake: 0.9 };
const RISE = 0.08;

/** How much of a save is showing `t` s into it, 0..1: on over `RISE`, off
 * smoothly by `length`. */
export function joltEnvelope(t: number, length: number): number {
  if (!(t >= 0) || t >= length) return 0;
  return smooth(t / RISE) * (1 - smooth((t - RISE) / (length - RISE)));
}

/** The shape a save throws the body into at its own moment (`Save.t`). */
export function joltOf(save: Save | null | undefined): Jolt {
  const j = { ...NO_JOLT };
  if (!save) return j;
  const k = joltEnvelope(save.t, LENGTH[save.kind]) * Math.min(1, Math.max(0, save.size));
  if (k <= 0) return j;
  const side = Math.sign(save.side);
  // The hand on the left (0) or the right (1) side of the body.
  const brace = (left: number, right: number) => {
    j.braceL = left * k;
    j.braceR = right * k;
  };
  switch (save.kind) {
    case "landing": {
      const fore = Math.max(-1, Math.min(1, save.fore));
      j.sink = 0.16 * k;
      j.lurch = (0.15 + 0.35 * fore) * k;
      j.sway = 0.24 * side * k;
      j.duck = 0.3 * k;
      brace(1, 1);
      break;
    }
    case "tree":
      j.twist = 0.65 * side * k;
      j.sway = -0.32 * side * k;
      j.lurch = -0.22 * k;
      j.sink = 0.06 * k;
      j.duck = 0.7 * k;
      // The far hand braced; the near one drawn in against the blow.
      brace(side > 0 ? 1 : 0.2, side > 0 ? 0.2 : 1);
      break;
    case "body":
      j.sway = 0.3 * side * k;
      j.sink = 0.1 * k;
      j.reachL = side < 0 ? k : 0;
      j.reachR = side > 0 ? k : 0;
      break;
    // A stake run through rocks him as an edge that bit does.
    case "stake":
    case "edge":
      // Thrown toward the edge that bit and brought back over the skis as
      // the save dies away — once, never wobbled.
      j.sway = 0.26 * side * k;
      j.lurch = -0.12 * k;
      j.sink = 0.06 * k;
      brace(0.8, 0.8);
      break;
  }
  return j;
}

/** A fist moved by the save: braced forward and a little wide, at the
 * height it rode at, or put down to the snow beside the boots (`ground`,
 * the snow's height in the body frame). `side` is −1 for the left hand. */
export function joltHand(hand: V3, side: number, j: Jolt, ground: number): V3 {
  const brace = side < 0 ? j.braceL : j.braceR;
  const reach = side < 0 ? j.reachL : j.reachR;
  const out = {
    x: hand.x + side * 0.12 * brace,
    y: hand.y + 0.04 * brace,
    z: hand.z + 0.2 * brace,
  };
  return mix(out, { x: side * 0.62, y: ground + 0.12, z: 0.2 }, Math.min(1, reach));
}
