// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY'S LIGHT ON THE GROUND, as numbers — three-free, so the suite reads
// it (`tests/sky_light_test.ts`). Two things the physical sky
// (`atmosphere-model.ts`, read through `sky-atmosphere.ts`) says about the
// light a surface takes, beyond the one key and the one hemisphere three
// knows:
//
//   * THE SKY BY DIRECTION (`skyIrradiance(n)` in GLSL): the L2 harmonics of
//     the whole sphere round the lens — the sky over the horizon, the lit
//     snow under it — read on a surface's own normal. A face turned from a
//     low sun takes the blue of the sky over it and the Belt's pink after
//     sunset; a face turned to the sun takes the warm glow round it; a floor
//     under a lid takes the deck's grey. Three's hemisphere has two colours
//     and an up; this has the whole sky.
//   * THE SUN BY HEIGHT (`keyAtHeight(y)` in GLSL, `keyBandsFor` here): the
//     sun reaches a point through the air ABOVE it and down to its own
//     horizon, so a summit sees the sun for some minutes after the valley
//     floor has lost it — the horizon dips about √(2h/R) under the level —
//     and through less air, so whiter and brighter by day and still red
//     after the floor's sunset. That is ALPENGLOW's first half: the last
//     direct light on the peaks while the valley is blue. Its second half,
//     the pink the peaks take from the Belt of Venus once they too are in
//     Earth's shadow, is the first part's — the harmonics carry it. The key
//     three is handed is the brightest band's (`SkyLook.keyColour`,
//     `.keyIntensity`); every world material is told its own height's share
//     of it, colour by colour (`haze.ts`'s `lightsWithFade`).
//
// The table this reads is baked at the sea and at 3 km (`SKY_ALTITUDES`).
// Between them the transmittance is mixed in the logarithm at the same
// height of the sun OVER EACH ROW'S OWN HORIZON, so a band never steps when
// one row's sun sets before the other's (`sunAtHeight`).

import type { Rgb } from "./atmosphere-model.ts";
import { sunTransmittance } from "./sky-atmosphere.ts";
import { SKY_ALTITUDES } from "./sky-table-format.ts";

/** How many heights the key is reckoned at. */
export const KEY_BANDS = 4;

/** The planet's radius the horizon's dip is reckoned on, m. */
const EARTH_R = 6_360_000;

/** How far the horizon dips under the level seen from `h` m up, rad. */
export function horizonDipAt(h: number): number {
  return Math.sqrt((2 * Math.max(0, h)) / EARTH_R);
}

/** The floor a transmittance's logarithm is held to: under it, none. */
const T_FLOOR = 1e-9;

const T0: Rgb = [0, 0, 0];
const T1: Rgb = [0, 0, 0];

/**
 * THE SUN'S TRANSMITTANCE to a point `altitude` m over the sea with the sun
 * `elevation` rad up over the level: between the table's two altitudes,
 * each row read at the sun's height over ITS horizon equal to the point's
 * (`elevation + dip(altitude)`), and the two mixed in the logarithm by the
 * altitude — so the light fades smoothly to nothing as the point's own sun
 * sets and never steps. Over the table's top, the table's own reckoning
 * (`sunTransmittance`).
 */
export function sunAtHeight(elevation: number, altitude: number, out: Rgb = [0, 0, 0]): Rgb {
  const top = SKY_ALTITUDES[SKY_ALTITUDES.length - 1];
  const h = Math.max(0, altitude);
  if (h >= top) return sunTransmittance(elevation, h, out);
  const over = elevation + horizonDipAt(h);
  sunTransmittance(over - horizonDipAt(SKY_ALTITUDES[0]), SKY_ALTITUDES[0], T0);
  sunTransmittance(over - horizonDipAt(top), top, T1);
  const s = (h - SKY_ALTITUDES[0]) / (top - SKY_ALTITUDES[0]);
  for (let c = 0; c < 3; c++) {
    const a = Math.log(Math.max(T_FLOOR, T0[c]));
    const b = Math.log(Math.max(T_FLOOR, T1[c]));
    const v = Math.exp(a + (b - a) * s);
    out[c] = v <= T_FLOOR * 1.0001 ? 0 : v;
  }
  return out;
}

/** The map's heights the key is reckoned between: where the sea stands in
 * the map's frame and the lowest and highest snow's world heights, m. */
export type Relief = { sea: number; low: number; high: number };

/** THE KEY BY HEIGHT: the world heights of the bands (evenly from a little
 * under the floor to over the summit) and the sun's transmittance at each,
 * RGB a band (12) — unexposed. */
export type KeyBands = { y: number[]; sun: number[] };

/** How far under the floor and over the summit the bands reach, m. */
const BAND_PAD = { low: 60, high: 400 } as const;

/** The key's bands for a sun `elevation` rad up over `relief` (null: one
 * height, `altitude`, in every band). */
export function keyBandsFor(
  elevation: number,
  relief: Relief | null,
  altitude: number,
  out: KeyBands = { y: new Array<number>(KEY_BANDS), sun: new Array<number>(KEY_BANDS * 3) },
): KeyBands {
  const t: Rgb = [0, 0, 0];
  for (let i = 0; i < KEY_BANDS; i++) {
    const y = relief
      ? relief.low -
        BAND_PAD.low +
        ((relief.high + BAND_PAD.high - (relief.low - BAND_PAD.low)) * i) / (KEY_BANDS - 1)
      : altitude + i;
    out.y[i] = y;
    sunAtHeight(elevation, relief ? y - relief.sea : altitude, t);
    for (let c = 0; c < 3; c++) out.sun[i * 3 + c] = t[c];
  }
  return out;
}

/** The brightest band (its index), by its brightest channel. */
export function brightestBand(bands: KeyBands): number {
  let best = 0;
  let most = -1;
  for (let i = 0; i < KEY_BANDS; i++) {
    const m = Math.max(bands.sun[i * 3], bands.sun[i * 3 + 1], bands.sun[i * 3 + 2]);
    if (m > most) {
      most = m;
      best = i;
    }
  }
  return best;
}

/** The share of three's key (`colour` × `intensity`) each band's height
 * takes, colour by colour (12): the band's own exposed key over the light's,
 * held to [0, `KEY_RATIO_MAX`] so a channel the sun has all but lost (the
 * blue of a red sun) does not divide nothing by nothing. Every band 1 when
 * the key is the moon's (`bySun` false). */
export const KEY_RATIO_MAX = 1.5;
export function keyRatios(
  bands: KeyBands,
  scale: number,
  colour: Rgb,
  intensity: number,
  bySun: boolean,
  out: number[] = new Array<number>(KEY_BANDS * 3),
): number[] {
  for (let i = 0; i < KEY_BANDS; i++)
    for (let c = 0; c < 3; c++) {
      const light = colour[c] * intensity;
      const own = bands.sun[i * 3 + c] * scale;
      out[i * 3 + c] = !bySun
        ? 1
        : light > 1e-6
          ? Math.min(KEY_RATIO_MAX, own / light)
          : own > 1e-6
            ? KEY_RATIO_MAX
            : 1;
    }
  return out;
}

/** A HEMISPHERE as irradiance harmonics: `sky` from straight above, `ground`
 * from straight under, mixed by the normal's height as three's hemisphere
 * light mixes them, times `k` — added onto `sh` (27, RGB a coefficient, the
 * basis `atmosphere-model.ts`'s `shBasis`: Y₀ = 0.282095, the up term
 * 0.488603·y). */
export function addHemisphere(sh: number[], sky: Rgb, ground: Rgb, k: number): number[] {
  for (let c = 0; c < 3; c++) {
    sh[c] += ((k * (sky[c] + ground[c])) / 2 / 0.282095) * 1;
    sh[2 * 3 + c] += (k * (sky[c] - ground[c])) / 2 / 0.488603;
  }
  return sh;
}

/** THE SKY'S LIGHT IN GLSL: `skyIrradiance(n)` — the harmonics
 * (`uSkySh`, world frame, exposed) on a world normal — and `keyAtHeight(y)`,
 * the share of the key a point at world height `y` takes (`uKeyBandY`,
 * `uKeyBand`). Every world material carries it (`haze.ts`). */
export const SKY_LIGHT_GLSL = /* glsl */ `
uniform vec3 uSkySh[9];
uniform vec4 uKeyBandY;
uniform vec3 uKeyBand[${KEY_BANDS}];
vec3 skyIrradiance(vec3 n) {
  vec3 e = uSkySh[0] * 0.282095
    + uSkySh[1] * (0.488603 * n.x)
    + uSkySh[2] * (0.488603 * n.y)
    + uSkySh[3] * (0.488603 * n.z)
    + uSkySh[4] * (1.092548 * n.x * n.z)
    + uSkySh[5] * (1.092548 * n.x * n.y)
    + uSkySh[6] * (1.092548 * n.y * n.z)
    + uSkySh[7] * (0.315392 * (3.0 * n.y * n.y - 1.0))
    + uSkySh[8] * (0.546274 * (n.x * n.x - n.z * n.z));
  return max(e, vec3(0.0));
}
vec3 keyAtHeight(float y) {
  if (y <= uKeyBandY.y) return mix(uKeyBand[0], uKeyBand[1], clamp((y - uKeyBandY.x) / max(uKeyBandY.y - uKeyBandY.x, 1e-3), 0.0, 1.0));
  if (y <= uKeyBandY.z) return mix(uKeyBand[1], uKeyBand[2], (y - uKeyBandY.y) / max(uKeyBandY.z - uKeyBandY.y, 1e-3));
  return mix(uKeyBand[2], uKeyBand[3], clamp((y - uKeyBandY.z) / max(uKeyBandY.w - uKeyBandY.z, 1e-3), 0.0, 1.0));
}
`;
