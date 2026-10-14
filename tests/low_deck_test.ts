// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOW CLOUD DECK (`pwa/src/game/low-deck.ts`, dealt by `cloud-field.ts`
// and read against the eye's height by `sky.ts`): which days deal one and
// where it lies, the deck as the field's lowest layer, and the look eased
// smoothly from under its base, through it, to over its top — the sun out
// over it and the deck no longer dimming it.

import { afterEach, describe, expect, it } from "vitest";

import { withSky } from "@engine";
import { cloudFieldOf, forceLowDeck } from "../pwa/src/game/cloud-field.ts";
import { dealLowDeck, deckZone, LOW_DECK } from "../pwa/src/game/low-deck.ts";
import { skyLookAt } from "../pwa/src/game/sky.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

afterEach(() => forceLowDeck(undefined));

describe("dealLowDeck", () => {
  it("lays the valley fog on the floor, its own depth", () => {
    expect(dealLowDeck("fog", () => 0.9, 1500, 180)).toEqual({ base: 0, top: 180, fog: 0 });
  });

  it("deals only the weathers it fits, at their odds", () => {
    for (const kind of ["clear", "snow", "storm", "high", "flurries"])
      expect(dealLowDeck(kind, () => 0, 1500, 0)).toBeNull();
    let n = 0;
    const tries = 400;
    for (let i = 0; i < tries; i++) {
      const u0 = (i + 0.5) / tries;
      if (dealLowDeck("overcast", (k) => (k === 0 ? u0 : 0.5), 1500, 0)) n++;
    }
    expect(n / tries).toBeCloseTo(LOW_DECK.odds.overcast, 2);
    expect(dealLowDeck("fair", () => 0.99, 1500, 0)).toBeNull();
  });

  it("stands its top part way up the mountain, a stratus deck deep", () => {
    for (let a = 0; a <= 1; a += 0.25)
      for (let b = 0; b <= 1; b += 0.25) {
        const d = dealLowDeck("overcast", (k) => (k === 0 ? 0 : k === 1 ? a : b), 1500, 0);
        expect(d).not.toBeNull();
        if (!d) continue;
        expect(d.top).toBeGreaterThanOrEqual(1500 * LOW_DECK.top[0] - 1e-6);
        expect(d.top).toBeLessThanOrEqual(1500 * LOW_DECK.top[1] + 1e-6);
        expect(d.base === 0 || d.base >= LOW_DECK.least).toBe(true);
        if (d.base > 0) expect(d.top - d.base).toBeGreaterThanOrEqual(LOW_DECK.depth[0] - 1e-6);
      }
  });
});

describe("deckZone", () => {
  const deck = { base: 400, top: 800, fog: 0.85 };
  it("is under, inside and over, eased across each edge", () => {
    expect(deckZone(deck, 0)).toEqual({ inside: 0, over: 0 });
    expect(deckZone(deck, 600)).toEqual({ inside: 1, over: 0 });
    expect(deckZone(deck, 1200)).toEqual({ inside: 1, over: 1 });
    expect(deckZone(deck, 400).inside).toBeCloseTo(0.5, 6);
    expect(deckZone(deck, 800).over).toBeCloseTo(0.5, 6);
  });
  it("has no under when it lies on the floor", () => {
    expect(deckZone({ base: 0, top: 200, fog: 0 }, -50).inside).toBe(1);
  });
});

describe("the deck in the field and the look", () => {
  const level = levelFor(LEVEL_SEEDS[0]);
  const vertical = level.mountain?.vertical ?? 1500;
  const deck = { base: vertical * 0.55 - 320, top: vertical * 0.55, fog: LOW_DECK.fog };

  it("is the field's lowest layer, the overcast's only one", () => {
    forceLowDeck(deck);
    const over = cloudFieldOf(withSky(level, { weather: "overcast" }));
    expect(over.deck).toEqual(deck);
    expect(over.deckLayer).toBe(0);
    expect(over.layers).toHaveLength(1);
    expect(over.layers[0].base).toBeCloseTo(deck.base, 6);
    expect(over.layers[0].depth).toBeCloseTo(320, 6);
    const fair = cloudFieldOf(withSky(level, { weather: "fair" }));
    expect(fair.deckLayer).toBe(0);
    for (const l of fair.layers.slice(1)) expect(l.base).toBeGreaterThan(fair.layers[0].base);
    forceLowDeck(null);
    expect(cloudFieldOf(withSky(level, { weather: "overcast" })).deck).toBeNull();
  });

  it("eases the look smoothly from under it to over it", () => {
    forceLowDeck(deck);
    const sky = withSky(level, { weather: "overcast", hour: 12 });
    const floorY = level.mountain?.base.y ?? 0;
    let last = skyLookAt(sky, 0, 0, floorY + deck.base - 200);
    const under = last;
    for (let h = deck.base - 200; h <= deck.top + 200; h += 2) {
      const look = skyLookAt(sky, 0, 0, floorY + h);
      const step = Math.abs(look.keyIntensity - last.keyIntensity);
      expect(step).toBeLessThan(0.08 * Math.max(1, last.keyIntensity));
      expect(Math.abs(look.sea.k - last.sea.k)).toBeLessThan(0.003);
      last = look;
    }
    const over = last;
    expect(over.keyIntensity).toBeGreaterThan(under.keyIntensity * 1.5);
    expect(over.clouds.shade[0]).toBe(0);
    expect(under.clouds.shade[0]).toBe(1);
    expect(over.sea.k).toBeGreaterThan(0);
    // Inside, the view is closed: no sea seen from outside it.
    expect(skyLookAt(sky, 0, 0, floorY + (deck.base + deck.top) / 2).sea.k).toBe(0);
  });
});
