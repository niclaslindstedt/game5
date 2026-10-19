// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Which test files share a worker's modules (`tests/support/isolation.ts`):
// a file that only reads the engine does, and a file that stubs a global or
// reaches a module holding state does not.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canShareWorker } from "./support/isolation.ts";

const root = resolve(".");
const shares = (path: string) => canShareWorker(resolve(root, path), root);

describe("the shared workers", () => {
  it("lets in a file that reads only the engine and the corpus", () => {
    expect(shares("tests/mapgen_test.ts")).toBe(true);
    expect(shares("tests/determinism_test.ts")).toBe(true);
  });

  it("keeps out a file that stubs a global or resets the modules", () => {
    expect(shares("tests/seed_maps_test.ts")).toBe(false);
    expect(shares("tests/edition_test.ts")).toBe(false);
    expect(shares("tests/ghost_store_test.ts")).toBe(false);
  });

  it("keeps out a module that registers with the engine on import, and every file that reaches it", () => {
    expect(shares("pwa/src/game/drawn-solids.ts")).toBe(false);
    expect(shares("tests/drawn_solids_test.ts")).toBe(false);
    expect(shares("tests/course_solids_test.ts")).toBe(false);
  });

  it("keeps out a module with a setter over its own state, and its readers", () => {
    expect(shares("pwa/src/game/sky-clock.ts")).toBe(false);
    expect(shares("tests/sky_clock_test.ts")).toBe(false);
    expect(shares("pwa/src/game/snow-skip.ts")).toBe(false);
  });

  it("takes a module's word that its only state is a memo", () => {
    expect(shares("pwa/src/game/sky-atmosphere.ts")).toBe(true);
  });
});
