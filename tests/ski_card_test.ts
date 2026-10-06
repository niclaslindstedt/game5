// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI CARD — what can be read of it without a browser: the spec sheet
// beside the pair (`ski-stats.ts`), the pick it writes into what the game
// remembers (`settings.ts`), and the link that names a pair for a visit
// (`url-params.ts`).

import { describe, expect, it } from "vitest";

import { SKIS, SKI_CATALOG, harshSpeedOf, skisById } from "@engine";

import { mergeSettings, freshSettings } from "../pwa/src/game/settings.ts";
import {
  carveOf,
  floatOf,
  forgivenessOf,
  quicknessOf,
  skisBars,
  speedCarveOf,
  fastCarveOf,
  bermCarveOf,
  bumpsOf,
  spinOf,
  skisFacts,
} from "../pwa/src/game/ski-stats.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

describe("the spec sheet", () => {
  it("quotes the catalog's own numbers as its figures", () => {
    for (const spec of SKI_CATALOG) {
      const facts = Object.fromEntries(skisFacts(spec).map((f) => [f.key, f.value]));
      expect(facts.length).toBeCloseTo(spec.length * 100, 6);
      expect(facts.waist).toBeCloseTo(spec.waist * 1000, 6);
      expect(facts.sidecut).toBe(spec.sidecut);
      expect(facts.weight).toBe(spec.gearMass);
      expect(facts.top).toBe(spec.topSpeed);
    }
  });

  it("draws every bar between the floor and full, and fills it for the best pair", () => {
    const keys = skisBars(SKIS).map((b) => b.key);
    for (const key of keys) {
      const values = SKI_CATALOG.map((s) => skisBars(s).find((b) => b.key === key)!.value);
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(0.3);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...values)).toBe(1);
      expect(Math.min(...values)).toBeCloseTo(0.3, 9);
    }
  });

  it("has no pair best everywhere, every specialist best at something, and the all-mountain in the middle of every band", () => {
    const keys = skisBars(SKIS).map((b) => b.key);
    for (const spec of SKI_CATALOG) {
      const bars = skisBars(spec);
      const wins = bars.filter((b) => b.value === 1).length;
      const losses = bars.filter((b) => b.value < 0.3 + 1e-9).length;
      expect(wins, `${spec.id} is best at everything`).toBeLessThan(keys.length);
      if (spec.id === SKIS.id) {
        expect(wins + losses, "the all-mountain is the middle of every band").toBe(0);
      } else {
        expect(wins, `${spec.id} is best at nothing`).toBeGreaterThan(0);
      }
    }
  });

  it("bills the powder ski best at floating, the slalom ski quickest and the park ski most forgiving — the catalog's own claim", () => {
    const by = (of: (s: (typeof SKI_CATALOG)[number]) => number): string[] =>
      [...SKI_CATALOG].sort((a, b) => of(b) - of(a)).map((s) => s.id);
    expect(by(floatOf)[0]).toBe("marmot");
    expect(by(quicknessOf)[0]).toBe("swift");
    expect(by(forgivenessOf)[0]).toBe("hare");
    // At a super-G's pace the giant slalom ski's arc asks more than its
    // edge holds and the downhill ski's asks less than its edge could:
    // the super-G ski carves the hardest bend clean there, the giant
    // slalom ski at race pace.
    expect(by(speedCarveOf)[0]).toBe("falcon");
    // ...and at a downhill's, every arc asks more than its edge holds but
    // the speed ski's, and the downhill ski's grip holds the most.
    expect(by(fastCarveOf)[0]).toBe("eagle");
    expect(by((s) => s.topSpeed)[0]).toBe("peregrine");
    expect(by((s) => carveOf(s))[0]).toBe("chough");
    // Round a ski cross's berm the slalom ski is at its grip and the giant
    // slalom ski's arc does not yet ask all of its own: the ski-cross
    // ski's arc asks all of a grip greater than the slalom ski's.
    expect(by(bermCarveOf)[0]).toBe("wolverine");
    // The big-air ski's legs fold the deepest: it takes the hardest landing
    // whole, where the softer park ski is the more forgiving.
    expect(by(harshSpeedOf)[0]).toBe("raven");
    // The mogul ski's short length on legs that fold quickest takes a
    // mogul line best.
    expect(by(bumpsOf)[0]).toBe("ibex");
    // The aerials ski, the shortest and lightest pair, swings the least
    // weight round a flip and a twist.
    expect(by(spinOf)[0]).toBe("kestrel");
    expect(floatOf(SKIS)).toBeCloseTo(1, 9);
    expect(quicknessOf(SKIS)).toBeCloseTo(1, 9);
    expect(forgivenessOf(SKIS)).toBeCloseTo(1, 9);
  });
});

describe("the pick", () => {
  it("skis the all-mountain pair on a first visit", () => {
    expect(freshSettings().skis).toBe("chamois");
  });

  it("keeps a stored pair the catalog carries, and drops one it does not", () => {
    expect(mergeSettings({ skis: "eagle" }).skis).toBe("eagle");
    // A stored pick the catalog does not carry falls back.
    expect(mergeSettings({ skis: "downhill" }).skis).toBe(SKIS.id);
    expect(mergeSettings({ skis: "snowboard" }).skis).toBe(SKIS.id);
    expect(mergeSettings({ skis: 3 }).skis).toBe(SKIS.id);
  });

  it("names a pair the catalog can hand back", () => {
    for (const spec of SKI_CATALOG) expect(skisById(spec.id)).toBe(spec);
  });
});

describe("the link", () => {
  it("reads ?skis= for the visit, and nothing it does not carry", () => {
    expect(readParams("?skis=swift").skis).toBe("swift");
    expect(readParams("?skis=snowboard").skis).toBe(null);
    expect(readParams("").skis).toBe(null);
  });

  it("opens on the ski card with ?menu=skis", () => {
    expect(readParams("?menu=skis")).toMatchObject({ menu: true, page: "skis" });
  });
});
