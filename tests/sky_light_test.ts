// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY ON THE SNOW, as numbers (`sky-light.ts`, read by `sky.ts`): the
// sun by height (the peaks keep a low sun after the valley has lost it, and
// keep it redder), the key's share a band, a hemisphere as harmonics, the
// sky's light on a shaded face blue by a low sun and grey under a lid, the
// lamps lost under a twilight sky and the whole light of the night, and the
// twilight's lift on the world's light smooth through the sunset.

import { weatherFor } from "@engine";
import { describe, expect, it } from "vitest";

import { shIrradiance, type Rgb } from "../pwa/src/game/atmosphere-model.ts";
import { sunTransmittance } from "../pwa/src/game/sky-atmosphere.ts";
import {
  addHemisphere,
  brightestBand,
  horizonDipAt,
  KEY_BANDS,
  KEY_RATIO_MAX,
  keyBandsFor,
  keyRatios,
  sunAtHeight,
} from "../pwa/src/game/sky-light.ts";
import { SKY_ALTITUDES } from "../pwa/src/game/sky-table-format.ts";
import { skyLookFor } from "../pwa/src/game/sky.ts";

const rad = (deg: number) => (deg * Math.PI) / 180;
const UP = { x: 0, y: 1, z: 0 };

describe("the sun by height", () => {
  it("the horizon dips about √(2h/R) under the level", () => {
    expect(horizonDipAt(0)).toBe(0);
    expect(horizonDipAt(3000)).toBeCloseTo(Math.sqrt(6000 / 6_360_000), 6);
  });

  it("agrees with the table at its own rows for a sun well up", () => {
    for (const deg of [10, 25, 50]) {
      const t: Rgb = [0, 0, 0];
      sunTransmittance(rad(deg), SKY_ALTITUDES[0], t);
      const a = sunAtHeight(rad(deg), SKY_ALTITUDES[0]);
      for (let c = 0; c < 3; c++) expect(a[c]).toBeCloseTo(t[c], 2);
    }
  });

  it("a low sun reaches a summit brighter and longer than the valley", () => {
    for (const deg of [2, 0, -0.8]) {
      let last = -1;
      for (const h of [500, 1200, 2000, 2800]) {
        const g = sunAtHeight(rad(deg), h)[1];
        expect(g).toBeGreaterThanOrEqual(last);
        last = g;
      }
    }
    // Just under the level's sunset the valley has none and the summit some.
    expect(sunAtHeight(rad(-2), 300)[0]).toBe(0);
    expect(sunAtHeight(rad(-2), 2900)[0]).toBeGreaterThan(0);
  });

  it("never steps as the sun sets", () => {
    let last = sunAtHeight(rad(3), 1500)[0];
    for (let deg = 3; deg >= -2; deg -= 0.05) {
      const r = sunAtHeight(rad(deg), 1500)[0];
      expect(Math.abs(r - last)).toBeLessThan(0.02);
      last = r;
    }
  });
});

describe("the key by height", () => {
  const relief = { sea: -1200, low: 0, high: 1500 };

  it("lays its bands from under the floor to over the summit", () => {
    const b = keyBandsFor(rad(20), relief, 0);
    expect(b.y.length).toBe(KEY_BANDS);
    expect(b.y[0]).toBeLessThan(relief.low);
    expect(b.y[KEY_BANDS - 1]).toBeGreaterThan(relief.high);
  });

  it("at sunset the top band is the brightest — alpenglow", () => {
    const b = keyBandsFor(rad(0.2), relief, 0);
    expect(brightestBand(b)).toBe(KEY_BANDS - 1);
    expect(b.sun[(KEY_BANDS - 1) * 3]).toBeGreaterThan(b.sun[0]);
  });

  it("the brightest band takes the key whole; the moon's key is the same everywhere", () => {
    const b = keyBandsFor(rad(3), relief, 0);
    const top = brightestBand(b);
    const k = 7;
    const colour: Rgb = [b.sun[top * 3], b.sun[top * 3 + 1], b.sun[top * 3 + 2]];
    const r = keyRatios(b, k, colour, k, true);
    for (let c = 0; c < 3; c++) expect(r[top * 3 + c]).toBeCloseTo(1, 6);
    for (const v of r) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(KEY_RATIO_MAX);
    }
    for (const v of keyRatios(b, k, colour, k, false)) expect(v).toBe(1);
  });
});

describe("the sky's light on a surface", () => {
  it("a hemisphere as harmonics reads its sky up and its ground down", () => {
    const sh = new Array<number>(27).fill(0);
    addHemisphere(sh, [1, 2, 3], [0.5, 0.25, 0.1], 2);
    const up = shIrradiance(sh, UP);
    const down = shIrradiance(sh, { x: 0, y: -1, z: 0 });
    expect(up[0]).toBeCloseTo(2, 4);
    expect(up[2]).toBeCloseTo(6, 4);
    expect(down[0]).toBeCloseTo(1, 4);
    expect(down[1]).toBeCloseTo(0.5, 4);
  });

  it("the open sky over a shaded floor is blue by a low sun, and warmer toward it", () => {
    const look = skyLookFor(0, rad(3));
    const up = shIrradiance(look.irradiance, UP);
    expect(up[2]).toBeGreaterThan(up[0] * 1.4);
    // The sun at azimuth 0 stands toward +z: a face turned to it takes the
    // warm glow round it, a face turned from it less red.
    const toward = shIrradiance(look.irradiance, { x: 0, y: 0.5, z: 0.866 });
    const away = shIrradiance(look.irradiance, { x: 0, y: 0.5, z: -0.866 });
    expect(toward[0] / toward[2]).toBeGreaterThan(away[0] / away[2]);
  });

  it("under a lid the light is grey", () => {
    const look = skyLookFor(0, rad(25), undefined, weatherFor("overcast"));
    const up = shIrradiance(look.irradiance, UP);
    expect(up[2] / up[0]).toBeGreaterThan(0.8);
    expect(up[2] / up[0]).toBeLessThan(1.35);
  });
});

describe("the lamps and the twilight", () => {
  it("a lamp is lost under the sunset's sky and is the whole light of the night", () => {
    expect(skyLookFor(0, rad(0)).lampLight).toBeLessThan(0.1);
    expect(skyLookFor(0, rad(-14)).lampLight).toBeCloseTo(1, 3);
  });

  it("the world's light moves smoothly through the sunset", () => {
    let last = skyLookFor(0, rad(8)).light;
    for (let deg = 8; deg >= -14; deg -= 0.1) {
      const l = skyLookFor(0, rad(deg)).light;
      expect(l / last).toBeLessThan(1.25);
      expect(last / l).toBeLessThan(1.25);
      last = l;
    }
  });
});
