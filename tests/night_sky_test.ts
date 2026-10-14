// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NIGHT (`pwa/src/game/night-sky.ts`, `starfield.ts`): the moon's true
// size off its distance, its phase law and its light by distance, the
// eye's gain, the faintest star a sky lets through, and the sphere of
// stars turned to the map's date and hour.

import { describe, expect, it } from "vitest";

import { SOUTH } from "@engine";

import {
  DARK_SKY,
  MOON,
  NIGHT,
  airglowShare,
  limitingMagnitude,
  moonDistance,
  moonLux,
  moonRadius,
  nightOf,
  phaseAngle,
  phaseLaw,
  surfaceMagnitude,
  surfaceSurge,
  type NightInput,
} from "../pwa/src/game/night-sky.ts";
import { GAL_CENTRE, skyTurnOf, turnBasis } from "../pwa/src/game/starfield.ts";

const DEG = Math.PI / 180;
const ARCMIN = DEG / 60;

/** A clear night with the moon `lit` lit at `elevation` degrees. */
function night(lit: number, elevation: number, distance = MOON.meanKm): NightInput {
  return {
    moon: { elevation: elevation * DEG, lit, distance },
    elevation: -40 * DEG,
    altitude: 800,
    zenith: 0,
    exposure: 1,
    domeMean: 1e-6,
    domeGain: 2.3,
    domeSpan: 0.5,
    night: 1,
  };
}

/** Level snow lit by the moon at `elevation` and the sky, as the snow
 * reads the two (`NIGHT.seen`). */
function snowOf(lit: number, elevation: number): number {
  const n = nightOf(night(lit, elevation));
  return n.key * Math.max(0, Math.sin(elevation * DEG)) + NIGHT.seen * n.ambient;
}

describe("the moon's size", () => {
  it("is 33.5′ across at perigee and 29.4′ at apogee, true in angle", () => {
    expect((2 * moonRadius(356_500)) / ARCMIN).toBeCloseTo(33.5, 1);
    expect((2 * moonRadius(406_700)) / ARCMIN).toBeCloseTo(29.4, 1);
  });

  it("is a moon's distance from the lens: an Earth's radius nearer overhead", () => {
    const level = { sun: { hour: 0, dayOfYear: 32, latitude: 46 } };
    const horizon = moonDistance(level, 0);
    const overhead = moonDistance(level, Math.PI / 2);
    expect(horizon - overhead).toBeGreaterThan(6000);
    expect(horizon - overhead).toBeLessThan(6500);
    // Over a year it swings between its perigee and its apogee.
    let near = Infinity;
    let far = 0;
    for (let d = 1; d <= 365; d += 1) {
      const km = moonDistance({ sun: { hour: 0, dayOfYear: d, latitude: 46 } }, 0);
      near = Math.min(near, km);
      far = Math.max(far, km);
    }
    expect(near).toBeGreaterThan(355_000);
    expect(near).toBeLessThan(362_000);
    expect(far).toBeGreaterThan(403_000);
    expect(far).toBeLessThan(408_000);
  });
});

describe("the moon's light", () => {
  it("follows the phase law: a half moon a tenth of a full one", () => {
    expect(phaseLaw(0)).toBe(1);
    expect(phaseLaw(90 * DEG)).toBeGreaterThan(0.08);
    expect(phaseLaw(90 * DEG)).toBeLessThan(0.11);
    // The opposition surge: the last ten degrees to full nearly a third.
    expect(phaseLaw(10 * DEG)).toBeLessThan(0.8);
    expect(phaseAngle(1)).toBeCloseTo(0, 6);
    expect(phaseAngle(0.5)).toBeCloseTo(Math.PI / 2, 6);
  });

  it("is a third of a lux at full and grows by the square of the distance", () => {
    expect(moonLux(0, MOON.meanKm)).toBeCloseTo(0.317, 3);
    expect(moonLux(0, 356_500) / moonLux(0, 406_700)).toBeCloseTo((406_700 / 356_500) ** 2, 6);
  });

  it("is spread over the lit disc: the surge lifts a full disc, a crescent's limb holds it", () => {
    expect(surfaceSurge(0)).toBeCloseTo(1, 2);
    expect(surfaceSurge(90 * DEG)).toBeLessThan(0.5);
    expect(surfaceSurge(90 * DEG)).toBeGreaterThan(0.1);
  });

  it("is reddened and dimmed by the air low down", () => {
    const high = nightOf(night(1, 50)).disc;
    const low = nightOf(night(1, 1)).disc;
    expect(low.pass).toBeLessThan(high.pass * 0.6);
    expect(low.tint[2]).toBeLessThan(low.tint[0] * 0.7);
    expect(high.tint[2]).toBeGreaterThan(0.7);
  });

  it("leaves earthshine on a crescent and none on a full disc", () => {
    expect(nightOf(night(0.1, 20)).disc.earthshine).toBeGreaterThan(0.01);
    expect(nightOf(night(1, 20)).disc.earthshine).toBe(0);
  });
});

describe("the snow by night", () => {
  it("is clearly brighter under a full moon than a quarter, and dark under none", () => {
    const full = snowOf(1, 45);
    const quarter = snowOf(0.5, 45);
    const none = snowOf(0, -30);
    expect(full / quarter).toBeGreaterThan(2.5);
    expect(full / quarter).toBeLessThan(5);
    expect(full / none).toBeGreaterThan(6);
    expect(full / none).toBeLessThan(14);
    // A full moon high in a clear sky is a quarter of a lux on the snow.
    const lux = nightOf(night(1, 45)).lux;
    expect(lux.key * Math.sin(45 * DEG) + lux.sky).toBeGreaterThan(0.15);
    expect(lux.key * Math.sin(45 * DEG) + lux.sky).toBeLessThan(0.35);
    expect(nightOf(night(0, -30)).lux.sky).toBeCloseTo(DARK_SKY.lux, 6);
  });
});

describe("the stars a sky lets through", () => {
  it("is 6.5 under a dark sky, four or five under a full moon's", () => {
    expect(limitingMagnitude(21.8)).toBeCloseTo(6.5, 1);
    expect(limitingMagnitude(19)).toBeCloseTo(4.8, 1);
    expect(surfaceMagnitude(DARK_SKY.zenith)).toBeCloseTo(21.8, 1);
    const dark = nightOf(night(0, -30));
    const moonlit = nightOf(night(1, 45));
    expect(dark.starLimit).toBeGreaterThan(6.2);
    expect(moonlit.starLimit).toBeLessThan(5.6);
    expect(moonlit.starLimit).toBeGreaterThan(4);
  });

  it("comes out as the twilight goes, not at a set elevation", () => {
    const dusk = nightOf({ ...night(0, -30), elevation: -7 * DEG, zenith: 2e-6 });
    const dark = nightOf({ ...night(0, -30), elevation: -18 * DEG, zenith: 1e-12 });
    expect(dusk.starLimit).toBeLessThan(3);
    expect(dark.starLimit).toBeGreaterThan(6);
  });

  it("glows at the horizon in an airglow band some fifteen degrees up", () => {
    expect(airglowShare(Math.PI / 2)).toBeCloseTo(1, 2);
    expect(airglowShare(15 * DEG)).toBeGreaterThan(1.3);
    expect(airglowShare(15 * DEG)).toBeGreaterThan(airglowShare(1 * DEG));
  });
});

describe("the sphere of stars", () => {
  /** The galactic centre's world elevation and heading on `day` at solar `hour`. */
  function centre(day: number, hour: number): { el: number; heading: number } {
    const m = turnBasis(skyTurnOf({ sun: { hour, dayOfYear: day, latitude: 46 } }));
    const [a, b, c] = GAL_CENTRE;
    const x = a * m[0] + b * m[3] + c * m[6];
    const y = a * m[1] + b * m[4] + c * m[7];
    const z = a * m[2] + b * m[5] + c * m[8];
    return { el: Math.asin(y) / DEG, heading: Math.atan2(x, z) };
  }

  it("stands the Milky Way's core low in the south on a summer midnight", () => {
    const { el, heading } = centre(196, 23);
    expect(el).toBeGreaterThan(8);
    expect(el).toBeLessThan(18);
    const off = Math.abs(((heading - SOUTH + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    expect(off / DEG).toBeLessThan(25);
  });

  it("and under the horizon on a winter midnight", () => {
    expect(centre(15, 0).el).toBeLessThan(-30);
  });
});
