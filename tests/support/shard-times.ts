// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The time each test file holds a worker, printed at the end of a CI shard so
// `SHARD_WEIGHTS` (`shards.ts`) can be re-measured off the job's log.
//
// The default reporter's `✓ tests/<file> (N tests) <ms>ms` counts only the
// tests' own bodies. A file that builds its maps at the top or inside a
// `describe` spends that time importing, which the line leaves out — a file
// that showed 2 s held its worker for 80 — and weights read off it packed
// one shard twice as heavy as another. This prints the whole of it: the
// harness, the import and the suite callbacks, and the tests.
import { relative } from "node:path";
import type { Reporter, TestModule } from "vitest/node";

/** Files under this many seconds are left to `DEFAULT_WEIGHT`. */
const FLOOR = 1.5;

export class ShardTimes implements Reporter {
  onTestRunEnd(modules: ReadonlyArray<TestModule>): void {
    const rows = modules
      .map((m) => {
        const d = m.diagnostic();
        const seconds =
          (d.prepareDuration + d.collectDuration + d.setupDuration + d.duration) / 1000;
        return { path: relative(process.cwd(), m.moduleId).replaceAll("\\", "/"), seconds };
      })
      .filter((r) => r.seconds >= FLOOR)
      .sort((a, b) => b.seconds - a.seconds || a.path.localeCompare(b.path));
    for (const r of rows) console.log(`shard-weight ${r.path} ${Math.round(r.seconds)}`);
  }
}
