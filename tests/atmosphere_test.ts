// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PHYSICAL ATMOSPHERE (`atmosphere-model.ts`, Hillaire's model), the
// table baked off it (`sky-table.ts`, read by `sky-atmosphere.ts`) and the
// look built on it (`sky.ts`) — held to physics anyone can check: a blue
// zenith over a white horizon at noon, the sun's transmittance at sea level,
// a reddened low sun, Earth's shadow darker than the Belt of Venus over it
// just after sunset, a blue twilight zenith, the snow's light blue in shade
// and warm in a low sun, and the table agreeing with the model it was baked
// from.

import { describe, expect, it } from "vitest";

import {
  createAtmosphere,
  EARTH,
  shIrradiance,
  shRotateY,
  skyIrradianceSh,
  skyRadiance,
  sunThrough,
  type Rgb,
} from "../pwa/src/game/atmosphere-model.ts";
import { atmosphereRow, exposureOf } from "../pwa/src/game/sky-atmosphere.ts";
import {
  decodeRadiance,
  encodeRadiance,
  SKY_ALTITUDES,
  SKY_ELEVATIONS,
  SKY_GRID,
  SKY_VIEW_AZ,
  SKY_VIEW_EL,
  viewDirection,
} from "../pwa/src/game/sky-table-format.ts";
import { SKY_TABLE_CODES, SKY_TABLE_SH } from "../pwa/src/game/sky-table.ts";
import { skyLookFor } from "../pwa/src/game/sky.ts";
import { colourTemperature } from "../pwa/src/tools/sky-eval.ts";

const atmo = createAtmosphere(EARTH);
const rad = (deg: number): number => (deg * Math.PI) / 180;
const lum = (c: Rgb): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const sunAt = (deg: number) => ({ x: 0, y: Math.sin(rad(deg)), z: Math.cos(rad(deg)) });
const along = (azDeg: number, elDeg: number) => ({
  x: Math.sin(rad(azDeg)) * Math.cos(rad(elDeg)),
  y: Math.sin(rad(elDeg)),
  z: Math.cos(rad(azDeg)) * Math.cos(rad(elDeg)),
});

describe("the physical atmosphere", () => {
  it("lets most of a high sun through at sea level, and reddens a low one", () => {
    const zenith = sunThrough(atmo, 0, rad(90));
    // Rayleigh's optical depth at sea level is ~0.03 red, ~0.07 green,
    // ~0.27 blue; the aerosol adds ~0.05 grey and ozone a little more.
    expect(zenith[0]).toBeGreaterThan(0.88);
    expect(zenith[0]).toBeLessThan(0.97);
    expect(zenith[2]).toBeGreaterThan(0.68);
    expect(zenith[2]).toBeLessThan(0.8);
    expect(zenith[0]).toBeGreaterThan(zenith[1]);
    expect(zenith[1]).toBeGreaterThan(zenith[2]);
    const low = sunThrough(atmo, 0, rad(3));
    expect(low[0] / low[2]).toBeGreaterThan(5);
    // Under the horizon the planet stands in front of it.
    expect(lum(sunThrough(atmo, 0, rad(-2)))).toBe(0);
    // Thinner air over a summit lets more through.
    expect(lum(sunThrough(atmo, 3000, rad(5)))).toBeGreaterThan(lum(sunThrough(atmo, 0, rad(5))));
  });

  it("is a blue zenith over a brighter, whiter horizon at noon", () => {
    const sun = sunAt(40);
    const zen = skyRadiance(atmo, 1000, { x: 0, y: 1, z: 0 }, sun);
    const hor = skyRadiance(atmo, 1000, along(90, 2), sun);
    expect(zen[2]).toBeGreaterThan(zen[0] * 2.5);
    expect(lum(hor)).toBeGreaterThan(lum(zen));
    expect(hor[2] / hor[0]).toBeLessThan(zen[2] / zen[0]);
    expect(colourTemperature(zen) ?? 0).toBeGreaterThan(12000);
  });

  it("stands Earth's shadow under the Belt of Venus just after sunset", () => {
    const sun = sunAt(-2);
    const shadow = skyRadiance(atmo, 1000, along(180, 1), sun);
    const belt = skyRadiance(atmo, 1000, along(180, 12), sun);
    expect(lum(belt)).toBeGreaterThan(lum(shadow) * 1.5);
    // The shadow blue-grey, the Belt pink (red over green).
    expect(shadow[2]).toBeGreaterThan(shadow[0]);
    expect(belt[0]).toBeGreaterThan(belt[1]);
  });

  it("keeps the twilight zenith blue, and darkens it by decades", () => {
    const sun = sunAt(-6);
    const zen = skyRadiance(atmo, 1000, { x: 0, y: 1, z: 0 }, sun);
    expect(zen[2]).toBeGreaterThan(zen[0]);
    const noon = skyRadiance(atmo, 1000, { x: 0, y: 1, z: 0 }, sunAt(30));
    expect(lum(zen)).toBeLessThan(lum(noon) * 1e-2);
    expect(lum(zen)).toBeGreaterThan(lum(noon) * 1e-5);
  });

  it("lights a face from the sky as the harmonics say, and turns with the sun", () => {
    const sh = skyIrradianceSh(atmo, 1000, rad(20), 12);
    const up = shIrradiance(sh, { x: 0, y: 1, z: 0 });
    // The sky's light on level snow is blue; the snow's bounce under it
    // brighter and near white.
    expect(up[2]).toBeGreaterThan(up[0] * 2);
    const down = shIrradiance(sh, { x: 0, y: -1, z: 0 });
    expect(lum(down)).toBeGreaterThan(lum(up));
    // A face toward the sun's side of the sky takes more than one away.
    const toward = shIrradiance(sh, { x: 0, y: 0, z: 1 });
    const away = shIrradiance(sh, { x: 0, y: 0, z: -1 });
    expect(lum(toward)).toBeGreaterThan(lum(away));
    // Turned to a sun at 90° (east), the bright side is east.
    const turned = shRotateY(sh, Math.PI / 2);
    const east = shIrradiance(turned, { x: 1, y: 0, z: 0 });
    expect(lum(east)).toBeCloseTo(lum(toward), 6);
  });
});

describe("the baked sky table", () => {
  it("holds every row the format names (re-bake with make sky-table)", () => {
    const rows = SKY_ELEVATIONS.length * SKY_ALTITUDES.length;
    expect(SKY_TABLE_SH.length).toBe(rows * 27);
    // Two bytes a code, four base64 characters to three bytes.
    expect(Math.floor((SKY_TABLE_CODES.length * 3) / 4 / 2)).toBeGreaterThanOrEqual(
      rows * (SKY_GRID + 3),
    );
    expect(Math.floor((SKY_TABLE_CODES.length * 3) / 4 / 2)).toBeLessThanOrEqual(
      rows * (SKY_GRID + 3) + 1,
    );
  });

  it("packs a radiance to a thousandth of a stop", () => {
    for (const x of [1e-12, 3.3e-6, 0.0123, 0.5, 2]) {
      expect(Math.abs(decodeRadiance(encodeRadiance(x)) / x - 1)).toBeLessThan(0.001);
    }
    expect(decodeRadiance(encodeRadiance(0))).toBe(0);
  });

  it("agrees with the model it was baked from", () => {
    for (const deg of [-4, 3, 24]) {
      const row = atmosphereRow(rad(deg), 0);
      for (const [i, j] of [
        [0, 1],
        [SKY_VIEW_AZ - 1, 2],
        [3, SKY_VIEW_EL - 1],
      ]) {
        const L = skyRadiance(atmo, 0, viewDirection(i, j), sunAt(deg));
        const k = (j * SKY_VIEW_AZ + i) * 3;
        expect(row.grid[k + 2] / L[2]).toBeCloseTo(1, 2);
      }
      const T = sunThrough(atmo, 0, rad(deg));
      expect(row.sun[0]).toBeCloseTo(T[0], 3);
    }
  });
});

describe("the look built on it", () => {
  it("puts a warm key and a blue sky's light in the shade at a low sun", () => {
    const low = skyLookFor(Math.PI, rad(4));
    expect(colourTemperature(low.keyColour) ?? 0).toBeLessThan(3000);
    expect(low.skyLight[2]).toBeGreaterThan(low.skyLight[0]);
    const noon = skyLookFor(Math.PI, rad(30));
    const k = colourTemperature(noon.keyColour) ?? 0;
    expect(k).toBeGreaterThan(4500);
    expect(k).toBeLessThan(6500);
  });

  it("goes through golden hour warm and the blue hour blue", () => {
    for (const deg of [1, 3, 6]) {
      const K = colourTemperature(skyLookFor(Math.PI, rad(deg)).sunColour) ?? 0;
      expect(K).toBeGreaterThan(1500);
      expect(K).toBeLessThan(3600);
    }
    const blue = skyLookFor(Math.PI, rad(-5));
    expect(blue.zenith[2]).toBeGreaterThan(blue.zenith[0] * 1.3);
  });

  it("adapts the eye: a twilight still a lit sky, a night dark", () => {
    expect(exposureOf(1e-3)).toBeGreaterThan(exposureOf(0.4) * 10);
    const lumOf = (deg: number) => lum(skyLookFor(Math.PI, rad(deg)).zenith);
    expect(lumOf(-5)).toBeGreaterThan(lumOf(30) * 0.05);
    expect(lumOf(-5)).toBeLessThan(lumOf(30));
    expect(lumOf(-20)).toBeLessThan(lumOf(-5) * 0.4);
  });
});
