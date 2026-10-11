// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAIR A LAB RIDES: a harness page's `?skis=` (an id `isPairId` knows —
// `lynx` the snowboard) as the `createGame` option that stands the run up
// on it; nothing (the reference skis) when it is left out or unknown.

import { isPairId, pairById, type SkiSpec } from "@engine";

/** The pair named by `?skis=` on this page's link, or undefined. */
export function labPair(params: URLSearchParams): SkiSpec | undefined {
  const id = params.get("skis") ?? "";
  return isPairId(id) ? pairById(id) : undefined;
}

/** `createGame`'s `spec` for the pair `?skis=` names: `{}` when none. */
export function labPairOption(params: URLSearchParams): { spec?: SkiSpec } {
  const spec = labPair(params);
  return spec ? { spec } : {};
}
