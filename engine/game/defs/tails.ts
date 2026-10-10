// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TAILS — how far each pair's tail is turned up, the one number riding
// SWITCH reads (`switch.ts`'s `tailDug`): ridden tails first, the tail is
// the end that leads, and in loose snow a flat one dives under it where a
// turned-up one planes. On the groomer any tail runs backward.
//
// It is stated beside the catalog rather than in `SkiSpec` because
// `skis.ts` is one of the sources the modelled skis are stamped against
// (`make models`, `tests/models_test.ts`): a number the models do not draw
// should move no model.

import type { PairId, SkiSpec } from "./skis.ts";

/** HOW FAR THE TAIL IS TURNED UP, 0 (a race ski's flat tail, cut square)
 * … 1 (a twin-tip's, turned up as high as its tip): the race skis (the
 * ski-cross ski's among them) and the speed ski none, the all-mountain ski a little kick, the powder ski a
 * raised tail, the park ski and the big-air ski their twin tips, the mogul ski a low
 * kick, the aerials ski a lower one — and a twin snowboard's tail is its
 * nose, turned up as high. */
export const TAIL_RISE: Readonly<Record<PairId, number>> = {
  chamois: 0.3,
  swift: 0,
  chough: 0,
  falcon: 0,
  eagle: 0,
  wolverine: 0,
  peregrine: 0,
  marmot: 0.5,
  hare: 1,
  raven: 1,
  ibex: 0.2,
  kestrel: 0.12,
  lynx: 1,
};

/** The tail rise of the pair a spec is (a rider's restatement included). */
export function tailRiseOf(spec: SkiSpec): number {
  return TAIL_RISE[spec.id];
}
