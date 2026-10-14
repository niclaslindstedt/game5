// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER BURNING, DECIDED (`pwa/src/game/burn-plan.ts`): the fire climbs
// him from his boots to his crown, the patches catch in order of height,
// nothing is drawn without a burn or on a run kept safe for work, the
// flames die down over the burn's last share and the smoulder fades, and
// the char only deepens. And as heard (`burn-bed.ts`): silent with no burn
// and safe for work.

import { describe, expect, it } from "vitest";

import { FIRE_BURN, type GameState } from "@engine";

import {
  BURN_LOOK,
  BURN_SITES,
  BODY_SPAN,
  burnLight,
  burnShown,
  charAt,
  frontOf,
  fuelOf,
  heightShare,
  siteHeat,
  smoulderOf,
} from "../pwa/src/game/burn-plan.ts";
import { burnVoiceOf } from "../pwa/src/game/audio/burn-bed.ts";

const burning = (burnt: number) => ({ burning: true, burnt });

/** Just enough of a state for the plan's questions. */
function stateWith(burn: unknown, sfw = false, t = 3): GameState {
  return { t, burn, rules: { sfw } } as unknown as GameState;
}
const BURN = { fire: "C1", x: 0, y: 0, z: 0, t: 1, burning: true, burnt: 0.1, flux: 1 };

describe("the burn's front (burn-plan.ts)", () => {
  it("starts at his boots and climbs past his crown, never falling back", () => {
    expect(frontOf(0)).toBeCloseTo(BURN_LOOK.start, 6);
    let last = -1;
    for (let t = 0; t <= BURN_LOOK.climb + 2; t += 0.1) {
      const f = frontOf(t);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
    expect(frontOf(BURN_LOOK.climb)).toBeGreaterThan(1);
  });

  it("lays its patches from his boots to his head, lowest first", () => {
    expect(BODY_SPAN.crown).toBeGreaterThan(BODY_SPAN.foot + 1.2);
    for (let i = 1; i < BURN_SITES.length; i++) {
      expect(BURN_SITES[i].h).toBeGreaterThanOrEqual(BURN_SITES[i - 1].h);
    }
    expect(BURN_SITES[0].stuff).toBe("pants");
    expect(BURN_SITES[BURN_SITES.length - 1].stuff).toBe("helmet");
    expect(heightShare(BODY_SPAN.foot - 1)).toBe(0);
    expect(heightShare(BODY_SPAN.crown + 1)).toBe(1);
  });

  it("catches the patches in order of height as the front climbs", () => {
    const at = (t: number) => BURN_SITES.map((s) => siteHeat(s, frontOf(t), 1));
    const early = at(0.3);
    const late = at(BURN_LOOK.climb);
    // Some of his legs are alight early, his head is not.
    expect(early.some((h) => h > 0)).toBe(true);
    expect(early[early.length - 1]).toBe(0);
    // Every patch alight once the front has passed his crown.
    expect(late.every((h) => h > 0)).toBe(true);
  });
});

describe("what is drawn, and what is not (burn-plan.ts)", () => {
  it("draws nothing without a burn, or on a run kept safe for work", () => {
    expect(burnShown(stateWith(undefined))).toBe(false);
    expect(burnShown(stateWith(BURN, true))).toBe(false);
    expect(burnShown(stateWith(BURN))).toBe(true);
  });

  it("holds the flames at full, then dies them down to the burn's end", () => {
    expect(fuelOf(undefined)).toBe(0);
    expect(fuelOf({ burning: false, burnt: 0.2 })).toBe(0);
    expect(fuelOf(burning(0.1))).toBe(1);
    expect(fuelOf(burning(BURN_LOOK.fade.from))).toBe(1);
    expect(fuelOf(burning(0.75))).toBeLessThan(1);
    expect(fuelOf(burning(1))).toBeCloseTo(BURN_LOOK.fade.left, 6);
  });

  it("smoulders only once the flames are out, and fades", () => {
    expect(smoulderOf(burning(0.5), 1)).toBe(0);
    const out = { burning: false };
    expect(smoulderOf(out, 0)).toBe(1);
    expect(smoulderOf(out, BURN_LOOK.smoulder / 2)).toBeCloseTo(0.5, 6);
    expect(smoulderOf(out, BURN_LOOK.smoulder * 2)).toBe(0);
  });

  it("chars the cloth only behind the fire, deeper with time, within 0…1", () => {
    for (const n of [0, 0.5, 1]) {
      // Above the front, nothing.
      expect(charAt(0.9, 0.3, 2, n)).toBe(0);
      let last = 0;
      for (let t = 0; t <= 10; t += 0.5) {
        const c = charAt(0.2, frontOf(t), t, n);
        expect(c).toBeGreaterThanOrEqual(last - 1e-9);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
        last = c;
      }
      expect(last).toBeGreaterThan(0.7);
    }
  });

  it("lights him only while he burns", () => {
    expect(burnLight(0, 2)).toBe(0);
    expect(burnLight(1, 2)).toBeGreaterThan(0.5);
  });
});

describe("the burn as heard (burn-bed.ts)", () => {
  it("is silent with no burn and safe for work, and roars while he burns", () => {
    expect(burnVoiceOf(stateWith(undefined)).fire).toBe(0);
    expect(burnVoiceOf(stateWith(BURN, true)).fire).toBe(0);
    expect(burnVoiceOf(stateWith(BURN)).fire).toBeGreaterThan(0.5);
    const out = { ...BURN, burning: false, burnt: 1 };
    const after = burnVoiceOf(stateWith(out, false, BURN.t + FIRE_BURN.lasts + 5));
    expect(after.fire).toBe(0);
    expect(after.smoulder).toBeGreaterThan(0);
  });
});
