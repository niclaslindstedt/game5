// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PHYSICAL SKY AT RUN TIME — the baked table (`sky-table.ts`, generated
// off `atmosphere-model.ts` by `make sky-table`) read for a sun at any
// elevation and a lens at any altitude: the sky's radiance grid, the sun's
// transmittance and the sky's irradiance harmonics, each interpolated
// between the baked rows (in the logarithm for a radiance, which falls by
// decades through the twilights). A few hundred multiplications a frame —
// the model itself never runs in one.
//
// Three-free and DOM-free: `sky.ts` builds every `SkyLook` on it, and the
// suite reads it (`tests/atmosphere_test.ts`).

import type { Rgb } from "./atmosphere-model.ts";
import { decodeRadiance, SKY_ALTITUDES, SKY_ELEVATIONS, SKY_GRID } from "./sky-table-format.ts";
import { SKY_TABLE_CODES, SKY_TABLE_SH } from "./sky-table.ts";

/** One row of the physical sky, unexposed: per unit of the sun's
 * illuminance at the top of the air. */
export type AtmosphereRow = {
  /** The radiance grid (`sky-table-format.ts`'s layout), RGB. */
  grid: Float32Array;
  /** The sun's transmittance to the lens. */
  sun: Rgb;
  /** The sky's irradiance harmonics in the SUN'S frame (27). */
  sh: number[];
};

// isolation:stateless: the sky table, decoded once (tests/support/isolation.ts).
let decoded: Float32Array | null = null;

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** The table's radiances, decoded once. */
function table(): Float32Array {
  if (decoded) return decoded;
  const s = SKY_TABLE_CODES;
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  const bytes = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i + 3 < s.length; i += 4) {
    const a = lookup[s.charCodeAt(i)];
    const b = lookup[s.charCodeAt(i + 1)];
    const c = lookup[s.charCodeAt(i + 2)];
    const d = lookup[s.charCodeAt(i + 3)];
    bytes[o++] = (a << 2) | (b >> 4);
    if (s[i + 2] !== "=") bytes[o++] = ((b & 15) << 4) | (c >> 2);
    if (s[i + 3] !== "=") bytes[o++] = ((c & 3) << 6) | d;
  }
  const n = o >> 1;
  // Kept as the natural LOGARITHM (−∞ for nothing), so a row is mixed with
  // one exponential a number.
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const x = decodeRadiance(bytes[2 * k] | (bytes[2 * k + 1] << 8));
    out[k] = x > 0 ? Math.log(x) : -Infinity;
  }
  decoded = out;
  return out;
}

const ROWS = SKY_ELEVATIONS.length * SKY_ALTITUDES.length;

/** Where `x` falls in the ascending list `at`: the index below and the
 * share toward the next. */
function bracket(at: readonly number[], x: number): [number, number] {
  if (x <= at[0]) return [0, 0];
  const last = at.length - 1;
  if (x >= at[last]) return [last - 1, 1];
  let i = 0;
  while (at[i + 1] < x) i++;
  return [i, (x - at[i]) / (at[i + 1] - at[i])];
}

/** Mix four logarithms of radiance bilinearly and return the radiance (a
 * straight line where any is nothing). */
function logMix4(a: number, b: number, c: number, d: number, s: number, t: number): number {
  if (a === -Infinity || b === -Infinity || c === -Infinity || d === -Infinity) {
    const lo = Math.exp(a) + (Math.exp(b) - Math.exp(a)) * s;
    const hi = Math.exp(c) + (Math.exp(d) - Math.exp(c)) * s;
    return lo + (hi - lo) * t;
  }
  const lo = a + (b - a) * s;
  return Math.exp(lo + (c + (d - c) * s - lo) * t);
}

/** THE PHYSICAL SKY for a sun `elevation` rad up seen from `altitude` m
 * over the sea. `out` is filled and returned (a row is reused frame to
 * frame: nothing is allocated). */
export function atmosphereRow(
  elevation: number,
  altitude: number,
  out: AtmosphereRow = {
    grid: new Float32Array(SKY_GRID),
    sun: [0, 0, 0],
    sh: new Array<number>(27).fill(0),
  },
): AtmosphereRow {
  const data = table();
  const [ie, te] = bracket(SKY_ELEVATIONS, (elevation * 180) / Math.PI);
  const [ia, ta] = bracket(SKY_ALTITUDES, altitude);
  const nE = SKY_ELEVATIONS.length;
  const row = (a: number, e: number): number => a * nE + e;
  const r00 = row(ia, ie);
  const r01 = row(ia, ie + 1);
  const r10 = row(ia + 1, ie);
  const r11 = row(ia + 1, ie + 1);
  const g = (r: number, k: number): number => data[r * SKY_GRID + k];
  for (let k = 0; k < SKY_GRID; k++)
    out.grid[k] = logMix4(g(r00, k), g(r01, k), g(r10, k), g(r11, k), te, ta);
  const sunAt = ROWS * SKY_GRID;
  const s = (r: number, c: number): number => data[sunAt + r * 3 + c];
  for (let c = 0; c < 3; c++)
    out.sun[c] = logMix4(s(r00, c), s(r01, c), s(r10, c), s(r11, c), te, ta);
  const h = (r: number, k: number): number => SKY_TABLE_SH[r * 27 + k];
  for (let k = 0; k < 27; k++) {
    const lo = h(r00, k) + (h(r01, k) - h(r00, k)) * te;
    const hi = h(r10, k) + (h(r11, k) - h(r10, k)) * te;
    out.sh[k] = lo + (hi - lo) * ta;
  }
  return out;
}

/** THE SUN'S TRANSMITTANCE alone, to a point `altitude` m over the sea
 * with the sun `elevation` rad up there — what lights a cloud. Over the
 * table's top altitude the sun is reckoned as it stands for a point there
 * at the elevation lifted by the difference in the horizon's dip (a cloud
 * 8 km up keeps the sun a degree longer than one at 3 km), so high cloud
 * glows on after the snow's sunset. */
export function sunTransmittance(elevation: number, altitude: number, out: Rgb): Rgb {
  const data = table();
  const top = SKY_ALTITUDES[SKY_ALTITUDES.length - 1];
  const R = 6_360_000;
  const lift = altitude > top ? Math.sqrt((2 * altitude) / R) - Math.sqrt((2 * top) / R) : 0;
  const [ie, te] = bracket(SKY_ELEVATIONS, ((elevation + lift) * 180) / Math.PI);
  const [ia, ta] = bracket(SKY_ALTITUDES, Math.min(altitude, top));
  const nE = SKY_ELEVATIONS.length;
  const sunAt = ROWS * SKY_GRID;
  const s = (a: number, e: number, c: number): number => data[sunAt + (a * nE + e) * 3 + c];
  for (let c = 0; c < 3; c++)
    out[c] = logMix4(
      s(ia, ie, c),
      s(ia, ie + 1, c),
      s(ia + 1, ie, c),
      s(ia + 1, ie + 1, c),
      te,
      ta,
    );
  return out;
}

/** THE EYE'S ADAPTATION, as numbers. The physical sky spans ten decades
 * from noon to night; a picture spans two. So the look is EXPOSED by the
 * scene's own light — the global illuminance on the snow, the sun's and
 * the sky's — the way an eye (or a camera left on automatic) adapts: by
 * day only a little (a golden-hour slope facing the sun reads brighter
 * than noon's, a flat one darker), through the twilights much more (so
 * the blue hour and the Belt of Venus read as a lit sky, not black), and
 * no more than `cap` decades — past nautical twilight the night falls.
 * `key` sets the scale: the exposure that puts a sun 27° up at the key
 * light the game was tuned under. */
export const EXPOSURE = {
  /** Exposure at `ref`, three's light units per unit of the sun's
   * illuminance. */
  key: 2.8,
  /** The light the eye adapts to (`adaptingLight`) under a sun 27° up,
   * a share of the sun's at the top of the air. */
  ref: 0.45,
  /** How much the eye makes up for by day, and past the knee, in decades
   * of gain a decade of light. */
  day: 0.3,
  dusk: 0.38,
  /** Where the dusk's slope starts, decades under `ref` (the sun ~5° up). */
  knee: 1,
  /** The most gain, decades. */
  cap: 2.8,
} as const;

/** Soft plus, smooth over about `k` either side of nought. */
function softPlus(x: number, k = 0.3): number {
  return k * Math.log(1 + Math.exp(x / k));
}

/** THE LIGHT THE EYE ADAPTS TO under a sun with transmittance luminance
 * `sunLum` and `elevation`, and a sky lighting level snow with `skyLum`:
 * the sky's, and the sun's on a face part-turned to it — the slopes facing
 * a low sun are what the eye is looking at, so the sun is never counted
 * only by the level snow's sine. */
export function adaptingLight(sunLum: number, elevation: number, skyLum: number): number {
  return sunLum * (0.1 + 0.9 * Math.max(0, Math.sin(elevation))) + skyLum;
}

/** The exposure for an adapting light `E` (a share of the sun's at the
 * top of the air). */
export function exposureOf(E: number): number {
  const L = Math.log10(EXPOSURE.ref / Math.max(E, 1e-14));
  let gain = EXPOSURE.day * L + EXPOSURE.dusk * softPlus(L - EXPOSURE.knee);
  gain -= softPlus(gain - EXPOSURE.cap);
  return EXPOSURE.key * Math.pow(10, gain);
}

/** THE SNOW ROUND THE LENS: what fills a shadow is not only the sky over
 * it but every sunlit slope round it, which the model's level floor does
 * not see — so the sky's light on a surface is lifted by this much. */
export const AMBIENT_LIFT = 2;
