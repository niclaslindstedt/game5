// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LAST RESORT BUILT. Every map of one resort is the same mountain, so
// the race maps on it and a lab's sweep of its courses build it
// once (`buildResort`), and a page can ask whether a seed's map would come
// off it in milliseconds rather than seconds (`levelIsCached`).

import { regionRow, type RegionId } from "./regions.ts";
import type { BuiltResort } from "./resort-build.ts";
import type { GeneratorVersion } from "./versions.ts";

let cache: { key: string; built: BuiltResort } | null = null;

/** What names a resort: its seed, its region, the attempts it may take and
 * the generator — every input a resort is built from. */
export function resortKey(
  seed: number,
  regionId: RegionId | undefined,
  attempts: number,
  version: GeneratorVersion,
): string {
  return `${seed}:${regionRow(regionId).id}:${attempts}:${version}`;
}

/** The resort kept under `key`, or null. */
export function cachedResort(key: string): BuiltResort | null {
  return cache !== null && cache.key === key ? cache.built : null;
}

/** Keep a resort just built, in place of the last. */
export function keepResort(key: string, built: BuiltResort): void {
  cache = { key, built };
}

/** Whether `buildResort` would answer this seed off the resort it built
 * last, without raising a mountain. */
export function resortCached(
  seed: number,
  regionId: RegionId | undefined,
  attempts: number,
  version: GeneratorVersion,
): boolean {
  return cachedResort(resortKey(seed, regionId, attempts, version)) !== null;
}

/** The last resort built, for a lab that reads what its build did. */
export function lastResort(): BuiltResort | null {
  return cache?.built ?? null;
}
