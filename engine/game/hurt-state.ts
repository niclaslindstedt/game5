// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A BLOW COSTS THE SKIING, as state: the skis' and the legs' damage
// (`damage.ts`) and what his injuries leave him (`hurt.ts`) — kept apart
// from `state.ts` so the state's shape stays under the size cap.

/** A part `damage.ts` keeps a figure for. */
export type DamagePart = "skiLeft" | "skiRight" | "legs";

/** WHAT THE SKIS AND THE LEGS HAVE TAKEN (`damage.ts`), each 0 sound … 1
 * wrecked: the two skis' edges (left, right) and the legs. Kept only on a
 * run that asked for damage (`GameState.damage`); all zero, and read as
 * nothing, otherwise. A reset does not mend it. */
export type SkierDamage = {
  ski: [number, number];
  legs: number;
};

/** What his injuries leave him: shares of what he can still do, 1 sound …
 * `HURT.floor`; the edge, the rate and the grip a leg each, left then
 * right. */
export type Hurt = {
  edge: [number, number];
  rate: [number, number];
  grip: [number, number];
  drive: number;
  tuck: number;
  landing: number;
};
