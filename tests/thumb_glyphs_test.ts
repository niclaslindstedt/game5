// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE THUMBS SHOW (`pwa/src/game/thumb-glyphs.ts`): the skis on the
// snow, the downhill bike's handlebar on it, and in a wingsuit — which carries none — the suit, under its canopy
// the canopy, and down on his boots the boots; and the suit's planform
// swept and spread with the lever.

import { describe, expect, it } from "vitest";
import { TUNING, createGame, freshBike, skydiveAt, step, wingsuitInput } from "@engine";

import { leverSpread, padGlyphOf, suitPlanform } from "../pwa/src/game/thumb-glyphs.ts";
import { flatLevel } from "./support/synthetic.ts";

const SIZE = 4000;
const level = flatLevel({ size: SIZE });
const dt = TUNING.dt;

describe("padGlyphOf", () => {
  it("draws the skis on an ordinary ride", () => {
    expect(padGlyphOf(createGame({ level, mode: "free", crowd: 0, quiet: true }))).toBe("skis");
  });

  it("draws the suit, then the canopy, then the boots through a wingsuit's flight", () => {
    const s = createGame({ level, mode: "free", wingsuit: true, crowd: 0, quiet: true });
    skydiveAt(s, { x: SIZE / 2, z: 1500, agl: 800, mode: "freefall", suit: "wingsuit" });
    expect(padGlyphOf(s)).toBe("suit");
    const seen = new Set<string>();
    for (let i = 0; i < 400 / dt && s.chute?.mode !== "landed"; i++) {
      seen.add(padGlyphOf(s));
      step(s, wingsuitInput(s));
    }
    expect(seen.has("canopy")).toBe(true);
    expect(seen.has("skis")).toBe(false);
    expect(s.chute?.mode).toBe("landed");
    expect(padGlyphOf(s)).toBe("boots");
  });

  it("draws the handlebar on the downhill bike, and the boots walking beside it", () => {
    const s = createGame({ level, mode: "free", crowd: 0, quiet: true });
    const b = freshBike();
    s.bike = b;
    b.onIt = true;
    expect(padGlyphOf(s)).toBe("bike");
    b.onIt = false;
    b.afoot = { walked: 0, pace: 0, push: false };
    expect(padGlyphOf(s)).toBe("boots");
  });
});

describe("suitPlanform", () => {
  const span = (d: string): number => {
    const xs = [...d.matchAll(/[MLQ ]([\d.]+) ([\d.]+)/g)].map((m) => Number(m[1]));
    return Math.max(...xs) - Math.min(...xs);
  };

  it("sweeps the arms in for a tuck and spreads them for the back key, inside the box", () => {
    const swept = span(suitPlanform(leverSpread(1, 0)));
    const neutral = span(suitPlanform(0));
    const spread = span(suitPlanform(leverSpread(0, 1)));
    expect(swept).toBeLessThan(neutral);
    expect(spread).toBeGreaterThan(neutral);
    expect(spread).toBeLessThanOrEqual(100);
  });

  it("is symmetric about the spine", () => {
    const xs = [...suitPlanform(0.3).matchAll(/[MLQ ]([\d.]+) ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(100, 5);
  });
});
