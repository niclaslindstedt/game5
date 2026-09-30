// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Root test runner config. Tests live in tests/ and follow the *_test.ts
// naming convention (OSS_GAME_SPEC §20.2/§20.3); they exercise the engine and
// the headless simulator — nothing here needs a DOM.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./engine/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*_test.ts"],
    environment: "node",
    // Vitest's 5 s default is a UNIT test's allowance, and little here is a
    // unit test: a case compiles whole levels, builds their sea and rides a
    // craft through them at 120 Hz. Sized to the work, not the failure —
    // several times the heaviest case, so a busy runner cannot decide a
    // result.
    testTimeout: 120_000,
  },
});
