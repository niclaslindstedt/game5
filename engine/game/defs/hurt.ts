// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT AN INJURY COSTS THE SKIING, as numbers (`hurt.ts`). Only on a run
// that carries its injuries through a fall (the INJURIES switch,
// `GameState.gore`): there a reset stands him back up HURT rather than
// mended, and these say how much worse he skis for it.
//
// The model is a skier's own account of skiing hurt, not a medical one: a
// part's worst injury (its AIS rank) is a LOSS of what that part does, and
// each thing he does on his skis is the product of what the parts that do
// it have left. The legs carry the edge (how far over he can stand the
// skis, how fast he can tip them in, how hard it bites) and the landings;
// the arms the poles; the trunk the tuck and some of the push; the head
// and the neck how quickly he reads and answers a turn.

export const HURT = {
  /** A part's loss by the AIS rank of its worst injury: a minor sprain
   * is felt and little more; a serious one takes most of what the part
   * does; past that a part does next to nothing. */
  loss: [0, 0.08, 0.2, 0.4, 0.6, 0.75],
  /** How much of each loss reaches each thing he does, 0 … 1. */
  edge: { leg: 0.7, trunk: 0.25 },
  rate: { leg: 0.6, head: 0.5, trunk: 0.2 },
  grip: { leg: 0.55 },
  drive: { arm: 0.7, leg: 0.4, trunk: 0.3 },
  tuck: { leg: 0.5, trunk: 0.6 },
  landing: { leg: 0.65, trunk: 0.3 },
  /** Never less than this share of anything: hurt, he still skis. */
  floor: 0.25,
} as const;
