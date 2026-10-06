// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SAVE, AS A BODY MAKES IT — what a skier does in the half second after
// something nearly threw him and did not (`SkierState.save`, kept by the
// engine's `crash.ts`): the shape his body is thrown into and the way he
// fights back out of it. Three-free, so the suite reads it; the view
// follows it on a spring (`skier-spring.ts`) and the pose lays it on top of
// everything else (`skier-pose.ts`).
//
//   * A HARD LANDING ridden out: sunk deep onto the legs, the trunk thrown
//     over the tips (or back onto the tails, the arms reaching forward to
//     haul him off them), rocked to the side it came down crooked on and
//     WOBBLING from side to side over the skis as it dies away, both arms
//     flung out and working for the balance — then stood back up.
//   * A TRUNK TAKEN ON THE SHOULDER: that shoulder knocked back and the
//     trunk turned round with it, the body rocked away from the tree and
//     back on its heels, the head ducked, the far arm flung out to catch
//     the balance.
//   * THE BODY DOWN AND BACK UP: leaned over to the side he went down on, a
//     hand put down to the snow there and pushed off it, the other arm up.
//   * AN EDGE THAT BIT: a wobble — the trunk thrown from side to side over
//     the skis, dying away, the arms working against it, sat back.
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
  /** Each arm flung out and up for the balance, 0..1 (left, right). */
  flingL: number;
  flingR: number;
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
  flingL: 0,
  flingR: 0,
  reachL: 0,
  reachR: 0,
  duck: 0,
};

export const JOLT_KEYS = Object.keys(NO_JOLT) as (keyof Jolt)[];

/** How long each save plays, s, and how long it takes to come on. */
const LENGTH = { landing: 1, tree: 0.75, body: 0.85, edge: 0.9, stake: 0.9 };
const RISE = 0.08;
/** The edge's wobble: its period, s — and a hard landing's, slower: the
 * whole body rocking over the skis rather than the trunk over the hips. */
const WOBBLE = 0.36;
const LAND_WOBBLE = 0.45;

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
  // The arm on the left (0) or the right (1) side of the body.
  const fling = (left: number, right: number) => {
    j.flingL = left * k;
    j.flingR = right * k;
  };
  switch (save.kind) {
    case "landing": {
      const fore = Math.max(-1, Math.min(1, save.fore));
      const w = Math.sin((2 * Math.PI * save.t) / LAND_WOBBLE);
      j.sink = 0.2 * k;
      j.lurch = (0.15 + 0.35 * fore) * k;
      j.sway = (0.3 * side + 0.22 * w) * k;
      j.duck = 0.3 * k;
      fling(0.75 + 0.25 * w, 0.75 - 0.25 * w);
      break;
    }
    case "tree":
      j.twist = 0.65 * side * k;
      j.sway = -0.32 * side * k;
      j.lurch = -0.22 * k;
      j.sink = 0.06 * k;
      j.duck = 0.7 * k;
      // The far arm thrown out; the near one drawn in against the blow.
      fling(side > 0 ? 1 : 0.2, side > 0 ? 0.2 : 1);
      break;
    case "body":
      j.sway = 0.3 * side * k;
      j.sink = 0.1 * k;
      j.reachL = side < 0 ? k : 0;
      j.reachR = side > 0 ? k : 0;
      fling(side > 0 ? 0.6 : 0, side < 0 ? 0.6 : 0);
      break;
    // A stake run through rocks him as an edge that bit does.
    case "stake":
    case "edge": {
      // Thrown toward the edge that bit, back over it and out again,
      // dying away.
      const w = Math.cos((2 * Math.PI * save.t) / WOBBLE);
      j.sway = 0.34 * side * w * k;
      j.lurch = -0.15 * k;
      j.sink = 0.05 * k;
      fling(0.55 + 0.3 * w * side, 0.55 - 0.3 * w * side);
      break;
    }
  }
  return j;
}

/** A fist moved by the save: flung out, up and a little ahead, or put
 * down to the snow beside the boots (`ground`, the snow's height in the
 * body frame). `side` is −1 for the left hand. */
export function joltHand(hand: V3, side: number, j: Jolt, ground: number): V3 {
  const fling = side < 0 ? j.flingL : j.flingR;
  const reach = side < 0 ? j.reachL : j.reachR;
  const out = {
    x: hand.x + side * 0.42 * fling,
    y: hand.y + 0.4 * fling,
    z: hand.z + 0.1 * fling,
  };
  return mix(out, { x: side * 0.62, y: ground + 0.12, z: 0.2 }, Math.min(1, reach));
}
