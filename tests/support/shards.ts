// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// How CI's test shards are cut: by measured TIME, not by file count.
//
// Vitest's own `--shard` hashes each path and hands every slice the same
// NUMBER of files. That is fine while files cost about the same, and here
// they do not: four files build and ski whole mountains for most of a
// minute each while half the suite is over in a few milliseconds, so a hash
// that drops two of the heavy ones on one runner doubles that runner's time
// and the run waits on it. This packs the files instead — heaviest first,
// each onto the lightest shard so far (longest-processing-time, a greedy
// bin packer) — over the weights below, so every runner gets about the same
// seconds of work and no shard holds more than one of the heavy files while
// another holds none. Within a shard the heaviest file starts first, so the
// long one is never the file left running alone at the end.
//
// The weights are seconds a file took in a full local run, rounded, and
// they only steer the balance: a stale weight costs a few seconds of wall
// time on one runner, never a test. A file missing from the table counts as
// `DEFAULT_WEIGHT` — the cheap files are left out on purpose. Re-measure
// when a file gets much heavier or a heavy one is split:
//
//   npx vitest run --reporter=json --outputFile=previews/vitest.json
//
// and read each file's `endTime - startTime` out of `testResults`.
//
// The packing must come out the same on every runner, since each one cuts
// the whole list and keeps only its own slice: the files are put in path
// order before they are packed and every tie breaks on the path.
import { relative } from "node:path";
import { BaseSequencer, type TestSpecification } from "vitest/node";

/** Seconds a file takes, measured. Files under a second and a half are left
 * to `DEFAULT_WEIGHT`. */
export const SHARD_WEIGHTS: Readonly<Record<string, number>> = {
  "tests/resort_test.ts": 61,
  "tests/mapgen_test.ts": 57,
  "tests/race_maps_downhill_test.ts": 55,
  "tests/weather_test.ts": 54,
  "tests/birds_test.ts": 54,
  "tests/race_maps_test.ts": 48,
  "tests/race_maps_superg_test.ts": 40,
  "tests/simulation_test.ts": 37,
  "tests/region_test.ts": 29,
  "tests/analysis_test.ts": 29,
  "tests/benchmark_test.ts": 28,
  "tests/generator_version_test.ts": 27,
  "tests/replay_test.ts": 22,
  "tests/lift_ride_test.ts": 20,
  "tests/tricks_test.ts": 20,
  "tests/query_test.ts": 16,
  "tests/outfit_test.ts": 15,
  "tests/spectators_test.ts": 15,
  "tests/panorama_test.ts": 12,
  "tests/trick_maps_test.ts": 12,
  "tests/run_names_test.ts": 9,
  "tests/world_render_test.ts": 6,
  "tests/free_ride_card_test.ts": 6,
  "tests/trees_test.ts": 6,
  "tests/super_g_test.ts": 5,
  "tests/minimap_test.ts": 5,
  "tests/ghost_test.ts": 4,
  "tests/determinism_test.ts": 3,
  "tests/crash_test.ts": 3,
  "tests/free_ride_test.ts": 2,
  "tests/crowd_test.ts": 2,
  "tests/rivals_test.ts": 2,
  "tests/hud_test.ts": 2,
};

/** What a file the table does not name is taken to cost: the import alone
 * is most of a second on a busy runner. */
export const DEFAULT_WEIGHT = 1;

export function weightOf(path: string): number {
  return SHARD_WEIGHTS[path] ?? DEFAULT_WEIGHT;
}

/** Heaviest first; a tie on the path, so the order is the same everywhere. */
function heaviestFirst(a: string, b: string): number {
  return weightOf(b) - weightOf(a) || (a < b ? -1 : a > b ? 1 : 0);
}

/** The repo-relative paths cut into `count` shards of about equal weight,
 * each shard's files heaviest first. Every path lands in exactly one. */
export function packShards(paths: readonly string[], count: number): string[][] {
  const shards = Array.from({ length: count }, () => ({ weight: 0, paths: [] as string[] }));
  for (const path of [...paths].sort(heaviestFirst)) {
    let lightest = shards[0];
    for (const shard of shards) if (shard.weight < lightest.weight) lightest = shard;
    lightest.weight += weightOf(path);
    lightest.paths.push(path);
  }
  return shards.map((shard) => shard.paths);
}

/** Vitest's sequencer with the shard cut by `packShards` and every run's
 * files started heaviest first. */
export class WeightedSequencer extends BaseSequencer {
  private pathOf(spec: TestSpecification): string {
    return relative(this.ctx.config.root, spec.moduleId).replaceAll("\\", "/");
  }

  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (!shard) return files;
    const byPath = new Map(files.map((spec) => [this.pathOf(spec), spec]));
    const mine = packShards([...byPath.keys()], shard.count)[shard.index - 1] ?? [];
    return mine.map((path) => byPath.get(path)!);
  }

  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((a, b) => heaviestFirst(this.pathOf(a), this.pathOf(b)));
  }
}
