import { describe, expect, it } from "vitest";

import { generateLevel, levelDigest } from "@engine";

// The attempt pool (`attempt-pool.ts`) builds a seed's attempts side by side
// and keeps the lowest one accepted. That is the search's own map only if an
// attempt built ALONE is the attempt the search builds after the ones before
// it: nothing one attempt does may reach the next.
describe("one attempt of the search, built alone", () => {
  it("is the map the search keeps, and a refused one says so", () => {
    const searched = generateLevel(7);
    expect(searched.attempt).toBe(2);
    const alone = generateLevel(7, { only: 2 });
    expect(alone.attempt).toBe(2);
    expect(levelDigest(alone)).toBe(levelDigest(searched));
    expect(() => generateLevel(7, { only: 1 })).toThrow(/attempt 1 refused/);
  }, 120_000);
});
