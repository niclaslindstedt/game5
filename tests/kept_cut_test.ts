// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CACHE OF CUTS THAT LETS THE OLDEST GO (`kept-cut.ts`).
import { describe, expect, it } from "vitest";
import { KEPT, keptCut } from "../pwa/src/game/kept-cut.ts";

describe("a cache of cuts (kept-cut.ts)", () => {
  it("keeps the last KEPT asked for and lets the longest unasked go", () => {
    const cache = new Map<string, number>();
    let made = 0;
    const ask = (k: string): number => keptCut(cache, k, () => ++made);
    for (let i = 0; i < KEPT; i++) ask(`k${i}`);
    ask("k0"); // asked again: the newest now
    ask("fresh");
    expect(cache.size).toBe(KEPT);
    expect(cache.has("k0")).toBe(true);
    expect(cache.has("k1")).toBe(false);
    expect(ask("k0")).toBe(1);
  });
});
