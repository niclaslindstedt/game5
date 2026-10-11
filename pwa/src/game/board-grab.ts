// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER'S GRABS AS DRAWN — where each of the board's seven grabs
// (`BoardGrab`, picked by the engine's `boardGrabOf`) puts the hand on the
// board, how the board is TWEAKED under it, how far the knees draw it up and
// how the trunk folds to meet it; and the deck's pitch on the snow in a
// PRESS and in the load before an OLLIE or a NOLLIE. Three-free: the pose
// (`board-pose.ts`) reads it, and the suite and `make board-metrics` hold the
// hand to the board.
//
// From the project's snowboard research (§ Grabs, § What reads right): the
// knees are pulled up and the board kept level under the hips, and the GRAB
// HAND GOES DOWN TO THE BOARD — the board is not brought up to the hand —
// except in a METHOD, where the board is pulled up behind him with the knees
// bent and the heel edge turned up; the free arm is thrown out and up for
// balance and style. Each grab's hand and place:
//
//   indy       the rear hand, the toe edge between the feet
//   mute       the front hand, the toe edge between the feet
//   melon      the front hand, the heel edge between the feet
//   stalefish  the rear hand round BEHIND the rear leg, the heel edge
//   method     the front hand, the heel edge — the board kicked up behind
//   nose       the front hand on the nose
//   tail       the rear hand on the tail
//
// Everything is in the deck's own terms: `s` m along it from its middle
// toward the FRONT binding (the nose, `bindingsOf`), `edge` +1 the toe edge,
// −1 the heel edge, 0 an end.

import type { BoardGrab, TrickPose } from "@engine";

/** One grab as drawn. */
export type GrabLook = {
  /** Which hand holds the board. */
  hand: "front" | "rear";
  /** Where on the deck, m from its middle toward the front binding — as a
   * share of the half stance between the feet (±1 at a binding), or, for
   * an end grab, `end` (the nose +1, the tail −1). */
  at: number;
  end?: 1 | -1;
  /** Which edge: +1 the toes, −1 the heels, 0 an end (on its top). */
  edge: 1 | -1 | 0;
  /** THE TWEAK, rad: the heel edge turned up about the deck's length
   * (`roll`, positive the heels up), the nose pitched up (`pitch`), and
   * the board swung about his up (`yaw`, positive the nose toward his
   * toes). */
  roll: number;
  pitch: number;
  yaw: number;
  /** How far the knees draw the board up toward the hips, m, and across —
   * toward the toes positive, behind him (the heels) negative. */
  lift: number;
  across: number;
  /** The trunk's extra lean, rad, and the way it leans in his terms: `to`
   * +1 over the toes, −1 back over the heels; `fore` +1 toward the nose. */
  lean: number;
  to: number;
  fore: number;
  /** The shoulders turned toward the nose (+) or the tail (−), rad. */
  open: number;
  /** The knees' extra flexion, rad. */
  knee: number;
  /** The elbow pointed out to the side (`out`, +1) or back behind him (−1)
   * — a stalefish's arm goes round behind his leg. */
  elbow: number;
};

/** THE SEVEN, tuned in `make skier ARGS="--skis=lynx --move=grab-…"`. */
export const GRAB_LOOKS: Readonly<Record<BoardGrab, GrabLook>> = {
  indy: {
    hand: "rear",
    at: -0.45,
    edge: 1,
    roll: -0.12,
    pitch: 0,
    yaw: 0,
    lift: 0.1,
    across: 0.02,
    lean: 0.75,
    to: 1,
    fore: -0.15,
    open: 0.1,
    knee: 0,
    elbow: 1,
  },
  mute: {
    hand: "front",
    at: 0.3,
    edge: 1,
    roll: -0.1,
    pitch: 0.05,
    yaw: 0,
    lift: 0.1,
    across: 0.02,
    lean: 0.85,
    to: 1,
    fore: 0.5,
    open: 0.25,
    knee: 0,
    elbow: 1,
  },
  melon: {
    hand: "front",
    at: 0.45,
    edge: -1,
    roll: 0.3,
    pitch: -0.06,
    yaw: 0,
    lift: 0.14,
    across: 0.04,
    lean: 0.6,
    to: 0.2,
    fore: 0.6,
    open: 0.35,
    knee: 0,
    elbow: 1,
  },
  stalefish: {
    hand: "rear",
    at: -0.6,
    edge: -1,
    roll: 0.3,
    pitch: 0.06,
    yaw: 0,
    lift: 0.14,
    across: 0.04,
    lean: 0.6,
    to: 0.2,
    fore: -0.6,
    open: -0.2,
    knee: 0,
    elbow: -1,
  },
  method: {
    hand: "front",
    at: 0.35,
    edge: -1,
    roll: 1.25,
    pitch: 0.1,
    yaw: 0,
    lift: 0.28,
    across: -0.3,
    lean: -0.05,
    to: -1,
    fore: 0,
    open: 0.45,
    knee: 0,
    elbow: 1,
  },
  nose: {
    hand: "front",
    at: 0,
    end: 1,
    edge: 0,
    roll: 0,
    pitch: 0.38,
    yaw: 0,
    lift: 0.1,
    across: 0,
    lean: 0.55,
    to: 0.3,
    fore: 1,
    open: 0.5,
    knee: 0,
    elbow: 1,
  },
  tail: {
    hand: "rear",
    at: 0,
    end: -1,
    edge: 0,
    roll: 0,
    pitch: -0.38,
    yaw: 0,
    lift: 0.1,
    across: 0,
    lean: 0.5,
    to: 0.3,
    fore: -1,
    open: -0.35,
    knee: 0,
    elbow: 1,
  },
};

/** Whether a grab the engine names is one of the board's. */
export function isBoardGrab(pose: TrickPose | null | undefined): pose is BoardGrab {
  return pose !== null && pose !== undefined && pose in GRAB_LOOKS;
}

/** How far in from the end an end grab's hand closes on it, m. */
export const END_IN = 0.08;
/** The fist's half thickness: the hand point stands this far off the edge
 * it closes over, m. */
export const FIST = 0.035;

/** How fast a grab is drawn in and let go, a share a second — a grab held
 * `poseHold` (0.35 s) is in by then. */
const GRAB_RATE = 5;

/** THE GRAB AS DRAWN, eased: the grab last asked for (kept while it is let
 * go) and how far into it, 0..1. */
export type GrabEase = { grab: BoardGrab | null; share: number };

/** `ease` stepped `dt` s toward `grab` (null: let go). A change of grab
 * lets the old one go before the new one is drawn in. */
export function easeGrab(ease: GrabEase, grab: BoardGrab | null, dt: number): GrabEase {
  const step = GRAB_RATE * Math.max(0, dt);
  if (grab !== null && (ease.grab === grab || ease.share <= 0)) {
    return { grab, share: Math.min(1, ease.share + step) };
  }
  const share = Math.max(0, ease.share - step);
  return { grab: share > 0 ? ease.grab : null, share };
}

/** THE PRESS and THE POP's LOAD, rad of the deck pitched nose up (+) on the
 * snow at their fullest: a press bends the board onto one end and lifts
 * the other a hand's breadth; loading an ollie sits him over the tail. */
export const PRESS = { most: 0.18, from: 0.45, to: 0.95, hips: 0.12 };
export const POP = { most: 0.1, hips: 0.08 };

/** The press a lean of `lean` (+1 back) holds on the snow, −1 … 1 (+ on
 * the tail), faded out as the edge comes on and at speed. */
export function pressOf(lean: number, edge: number, speed: number): number {
  const t = Math.min(1, Math.max(0, (Math.abs(lean) - PRESS.from) / (PRESS.to - PRESS.from)));
  const flat = Math.max(0, 1 - Math.abs(edge) / 0.35);
  const slow = Math.max(0, Math.min(1, (16 - speed) / 6));
  return Math.sign(lean) * t * t * (3 - 2 * t) * flat * slow;
}

/** The load before a pop, −1 … 1: + over the tail (the ollie), − over the
 * nose (the nollie, the lean carried forward — `popOf`'s). */
export function popLoad(load: number, lean: number): number {
  const l = Math.min(1, Math.max(0, load));
  return lean <= -0.5 ? -l : l;
}
