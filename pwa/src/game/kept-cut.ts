// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CACHE OF CUTS THAT LETS THE OLDEST GO: a figure's meshes are cut once
// and shared, but a card browsed through every colour would otherwise keep
// every cut it stopped on (about a megabyte each) for the whole visit.

/** How many cuts a cache keeps: a start line, a night's enthusiasts and the
 * card's stage fit in it. */
export const KEPT = 12;

/** A cache's entry under `key`, made by `make` if it is not kept: the last
 * `KEPT` asked for are kept, the longest unasked let go (a figure drawn in
 * one keeps its own reference — a cut is never written to). */
export function keptCut<T>(cache: Map<string, T>, key: string, make: () => T): T {
  const known = cache.get(key);
  if (known !== undefined) {
    cache.delete(key);
    cache.set(key, known);
    return known;
  }
  const made = make();
  cache.set(key, made);
  while (cache.size > KEPT) cache.delete(cache.keys().next().value!);
  return made;
}
