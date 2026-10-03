// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CI's test shards (`tests/support/shards.ts`): every file run exactly once
// across them, the same cut on every runner, and the weight spread evenly.
import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHT, SHARD_WEIGHTS, packShards, weightOf } from "./support/shards.ts";

const FILES = readdirSync("tests")
  .filter((name) => name.endsWith("_test.ts"))
  .map((name) => `tests/${name}`);

const weightIn = (paths: readonly string[]) => paths.reduce((sum, path) => sum + weightOf(path), 0);

describe("the test shards", () => {
  it("weighs only files that exist", () => {
    for (const path of Object.keys(SHARD_WEIGHTS)) expect(existsSync(path), path).toBe(true);
  });

  it("runs every file exactly once, whatever the count", () => {
    for (const count of [1, 2, 3, 6, 8]) {
      const cut = packShards(FILES, count);
      expect(cut).toHaveLength(count);
      expect(cut.flat().sort()).toEqual([...FILES].sort());
    }
  });

  it("cuts the same way whatever order the files arrive in", () => {
    expect(packShards([...FILES].reverse(), 6)).toEqual(packShards(FILES, 6));
  });

  it("spreads the weight: no shard carries more than its share and the heaviest file", () => {
    const heaviest = Math.max(...FILES.map(weightOf));
    for (const count of [2, 6, 8]) {
      const share = weightIn(FILES) / count;
      for (const shard of packShards(FILES, count)) {
        expect(weightIn(shard)).toBeLessThanOrEqual(share + heaviest);
      }
    }
  });

  it("starts each shard on its heaviest file", () => {
    for (const shard of packShards(FILES, 6)) {
      const weights = shard.map(weightOf);
      expect(weights).toEqual([...weights].sort((a, b) => b - a));
    }
  });

  it("counts an unweighed file at the default", () => {
    expect(weightOf("tests/not_a_file_test.ts")).toBe(DEFAULT_WEIGHT);
  });
});
