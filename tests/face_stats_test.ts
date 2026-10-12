// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What the WHERE steps bill a real ski area with (`face-stats.ts`): the
// drop, the steepest pitch and the mean, read off its real pistes.

import { describe, expect, it } from "vitest";

import { areaStats, loadFaceStats } from "../pwa/src/game/face-stats.ts";

describe("a real face's figures", () => {
  it("reads a drop, a steepest pitch past the mean, and its pistes", async () => {
    const s = await loadFaceStats("alpine-1");
    expect(s).not.toBeNull();
    expect(s!.pistes).toBeGreaterThan(0);
    expect(s!.drop).toBeGreaterThan(300);
    expect(s!.drop).toBeLessThan(3000);
    expect(s!.mean!).toBeGreaterThan(0.05);
    expect(s!.mean!).toBeLessThan(0.6);
    expect(s!.steepest!).toBeGreaterThan(s!.mean!);
  });

  it("bills an area the biggest drop, the steepest pitch and every piste", async () => {
    const a = (await loadFaceStats("alpine-1"))!;
    const b = (await loadFaceStats("alpine-2"))!;
    const both = areaStats([a, b])!;
    expect(both.drop).toBe(Math.max(a.drop, b.drop));
    expect(both.steepest).toBe(Math.max(a.steepest!, b.steepest!));
    expect(both.pistes).toBe(a.pistes + b.pistes);
    expect(both.faces).toBe(2);
    expect(areaStats([])).toBeNull();
  });

  it("is null for no face", async () => {
    expect(await loadFaceStats("no-such-face")).toBeNull();
  });
});
