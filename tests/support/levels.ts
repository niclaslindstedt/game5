// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A cache of generated maps, for the test files that assert a dozen
// separate rules over ONE corpus of them.
//
// Generating a map is the most expensive thing the engine does — the
// mountain baked over a 1501 × 1501 grid, a piste walked and graded, the
// corridor pressed in, a forest grown and an analysis run — and the R-rule
// suites are written the way rules read: one `it` per rule, each walking
// the same spread of seeds. Written literally that is the same maps built
// a dozen times over. The generator is deterministic per seed
// (`mapgen_test` asserts it first thing), so the second build of a seed can
// only return what the first one did. This hands out the first one.
//
// The bargain: what comes back is SHARED, so a test must treat it as
// read-only. A test that needs a map of its own — a determinism check that
// has to see two independent builds, or one that breaks a map on purpose —
// copies it or calls the engine directly.
import { analyzeLevel, generateLevel, type GeneratedLevel, type LevelAnalysis } from "@engine";

/** The corpus: a spread of seeds wide enough for a sweeping piste and a
 * twisting one, two kickers and six, woods and open bowls. Six, because a
 * three-kilometre mountain builds in about two seconds. */
export const LEVEL_SEEDS: readonly number[] = Array.from({ length: 6 }, (_, i) => i * 37 + 1);

const levels = new Map<number, GeneratedLevel>();
const analyses = new Map<number, LevelAnalysis>();

/** The map for a seed, built once. Read-only: several tests hold it. */
export function levelFor(seed: number): GeneratedLevel {
  let hit = levels.get(seed);
  if (hit === undefined) {
    hit = generateLevel(seed);
    levels.set(seed, hit);
  }
  return hit;
}

/** The analysis of a seed's map, run once. */
export function analysisFor(seed: number): LevelAnalysis {
  let hit = analyses.get(seed);
  if (hit === undefined) {
    hit = analyzeLevel(levelFor(seed));
    analyses.set(seed, hit);
  }
  return hit;
}
