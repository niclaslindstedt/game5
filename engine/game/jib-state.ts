// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JIB'S SHAPES (`jib.ts`), stated beside `state.ts` — which re-exports
// them — so the state's file stays under its cap.

/** How a skier stands on a jib: a 50-50 (his skis along it, forward or
 * switch) or a SLIDE (across it). */
export type JibStance = "fifty" | "slide";

/** A JIB BEING RIDDEN (`jib.ts`, `SkierState.jib`): which of the map's
 * jibs, how far along it he is, m, and how fast he slides, m/s; his skis'
 * turn off its line, rad (0 a 50-50, ±π/2 a slide, π switch), clockwise
 * from above, and the turn they are going to; how he got on, how many
 * times he has swapped, the press he holds and for how long, s; whether the
 * edge was over last step (a swap is a TAP), the jump held last step (a pop
 * is its RELEASE), and the turn he leaves by once he has begun to (null
 * before). */
export type JibRide = {
  index: number;
  u: number;
  v: number;
  yaw: number;
  target: number;
  on: number;
  swaps: number;
  stances: JibStance[];
  press: "nose" | "tail" | null;
  pressed: number;
  tapped: boolean;
  loaded: boolean;
  out: number | null;
  /** The yaw he turned onto it with, rad — where the turn out is read
   * from. */
  start: number;
};

/** A JIB RIDDEN, filed when he leaves it (`TrickState.jibs`) — what a judge
 * reads: which feature, the degrees on and off (multiples of 90), every
 * stance held on it, the swaps, the press held longest and how long, s,
 * how far along it he rode, m, whether he rode it to its end, and when he
 * left it. */
export type JibRecord = {
  id: string;
  section: number;
  kind: "rail" | "box";
  on: number;
  off: number;
  stances: JibStance[];
  swaps: number;
  press: "nose" | "tail" | null;
  pressed: number;
  length: number;
  whole: boolean;
  t: number;
};
