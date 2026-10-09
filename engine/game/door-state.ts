// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOORS IN MOTION, as a run keeps them (`doorway.ts`): every leaf
// swinging or held open, and the skier's move through a door. Everything
// is stored as the moments things began — never a clock stepped — so a
// leaf's angle and where the skier stands are pure functions of the run's
// own `t`, and nothing here is ever changed in place: a step that moves on
// writes new objects, so a run forked off this one keeps its own.

import type { DoorStuff, DoorSwingWay } from "./defs/building-walls.ts";

/** One LEAF that has been opened: its building's id and which of the
 * doorway's leaves (`leavesOf`: 0, or 1 the right of a pair as seen from
 * outside), the run's `t` it began to open, the `t` its closer began to
 * bring it back (−1 while it is held) and how far open it was then, 0..1. */
export type DoorSwing = {
  id: string;
  leaf: number;
  at: number;
  shut: number;
  from: number;
};

/** A KEYFRAME of the skier's move: by `t` s after the press he stands at
 * (u, w) in the door's frame (`doorPoint`: u to the right as seen from
 * outside, w out of the wall's middle) facing `heading`; `lin` when the
 * way to it is walked at a steady pace rather than eased in and out. */
export type DoorKey = { t: number; u: number; w: number; heading: number; lin?: boolean };

/** THE SKIER'S MOVE THROUGH A DOOR: the building's id, the leaf he opens,
 * the side he came from (1 outside, −1 inside), the run's `t` of the press,
 * the moment the leaf begins to move (`open`, s after the press) and the
 * move's keyframes — the last its end. `pull` when the leaf comes toward
 * him. */
export type DoorMove = {
  id: string;
  leaf: number;
  side: 1 | -1;
  start: number;
  open: number;
  pull: boolean;
  keys: readonly DoorKey[];
};

/** A run's doors in motion: the leaves open or closing, and the move he is
 * making through one, if any. */
export type Doorway = { swings: readonly DoorSwing[]; move: DoorMove | null };

/** A `door` event: a leaf set moving off its latch (`open`) or latched
 * shut by its closer (`shut`), where it is and what it is. */
export type DoorEvent = {
  kind: "door";
  t: number;
  phase: "open" | "shut";
  id: string;
  stuff: DoorStuff;
  swing: DoorSwingWay;
  x: number;
  y: number;
  z: number;
};
