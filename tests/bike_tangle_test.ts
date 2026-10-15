// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HURT BY HIS OWN BIKE (`engine/game/bike-tangle.ts`): a rider thrown into
// the bike he came off is struck by its parts and can be caught in them; a
// limb caught in a turning wheel at speed is torn off on a run with its
// INJURIES on, and never on a safe one.

import { describe, expect, it } from "vitest";
import { stageTangle } from "./support/bike-tangles.ts";

describe("hurt by his own bike", () => {
  it("strikes him when he goes down with it", { timeout: 120_000 }, () => {
    const runs = Array.from({ length: 8 }, (_, k) => stageTangle("laid", 35, k));
    expect(runs.every((r) => r.thrown)).toBe(true);
    expect(runs.filter((r) => r.blows > 0).length).toBeGreaterThanOrEqual(6);
    expect(runs.some((r) => r.struck.length > 0)).toBe(true);
    expect(runs.some((r) => r.injuries.length > 0)).toBe(true);
  });

  it(
    "tears off a foot caught in the spokes at 65 km/h, with INJURIES on",
    { timeout: 60_000 },
    () => {
      const r = stageTangle("bars", 65, 12);
      expect(r.snags).toContain("rear");
      expect(r.yank).toBeGreaterThan(13);
      expect(r.torn).toEqual(["shinL"]);
    },
  );

  it("tears nothing off on a safe run", { timeout: 60_000 }, () => {
    for (const k of [12, 14]) {
      const r = stageTangle("bars", 65, k, { sfw: true });
      expect(r.snags).toContain("rear");
      expect(r.torn).toEqual([]);
      expect(r.died).toBe(false);
    }
  });

  it("is the same crash every time", { timeout: 60_000 }, () => {
    expect(stageTangle("bars", 50, 3)).toEqual(stageTangle("bars", 50, 3));
  });

  it("rarely catches a slow fall", { timeout: 120_000 }, () => {
    const runs = Array.from({ length: 8 }, (_, k) => stageTangle("bars", 20, k));
    expect(runs.filter((r) => r.snags.length > 0).length).toBeLessThanOrEqual(1);
    expect(runs.every((r) => r.torn.length === 0)).toBe(true);
  });
});
