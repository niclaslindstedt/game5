// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKI JUMPING'S LARGE HILLS (`pwa/src/game/jump-hills.ts`) rebuilt and held
// to their rows — the normal hills and the card are `jump_hills_test.ts`'s,
// split so neither file runs past a minute.

import { describe, it } from "vitest";

import { JUMP_HILLS } from "../pwa/src/game/jump-hills.ts";
import { checkHill } from "./support/jump-hills.ts";

describe("ski jumping's large hills", () => {
  for (const row of JUMP_HILLS.filter((h) => h.hill === "large")) {
    it(`${row.id} builds its map and its hill, and is jumped on its own day`, () => checkHill(row));
  }
});
