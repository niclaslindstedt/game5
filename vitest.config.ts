// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Root test runner config. Tests live in tests/ and follow the *_test.ts
// naming convention; they exercise the engine and
// the headless simulator — nothing here needs a DOM.
import { readdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { canShareWorker } from "./tests/support/isolation.ts";
import { WeightedSequencer } from "./tests/support/shards.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

// The files that may run one after another in a worker that keeps its
// modules (and so the corpus of maps it has built), and the rest, each in a
// fresh one — `tests/support/isolation.ts` reads which is which off the
// source.
const verdicts = new Map<string, boolean>();
const files = readdirSync(new URL("./tests", import.meta.url))
  .filter((name) => name.endsWith("_test.ts"))
  .map((name) => `tests/${name}`);
const shared = files.filter((path) => canShareWorker(`${root}${path}`, root, verdicts));
const isolated = files.filter((path) => !shared.includes(path));

export default defineConfig({
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./engine/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Vitest's 5 s default is a UNIT test's allowance, and little here is a
    // unit test: a case compiles whole levels, builds their sea and rides a
    // craft through them at 120 Hz. Sized to the work, not the failure —
    // several times the heaviest case, so a busy runner cannot decide a
    // result.
    testTimeout: 300_000,
    // CI's shards are cut by each file's measured time rather than by
    // vitest's hash of its path, and the heaviest files start first.
    sequence: { sequencer: WeightedSequencer },
    // Vitest keeps a core back for itself by default, which on a four-core
    // CI runner is a quarter of the machine idle: the main process only
    // hands out files and prints. Locally the default stands, so a run
    // leaves the machine usable.
    maxWorkers: process.env.CI ? availableParallelism() : undefined,
    projects: [
      { extends: true, test: { name: "shared", include: shared, isolate: false } },
      { extends: true, test: { name: "isolated", include: isolated } },
    ],
  },
});
