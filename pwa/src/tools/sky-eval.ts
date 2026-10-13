// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY LAB'S NUMBERS — what a frame of the sky and the snow under it
// measures, so a change to the sky is argued with a table as well as a
// picture (`scripts/sky-preview.mjs --json` before, `--compare` after).
// DOM-free and three-free: it is handed a `SkyLook` (the model's own
// numbers) and the RGBA bytes of a drawn cell, and says
//
//   * the model's half — the sun's height, the dome's zenith and horizon
//     luminance and colour temperature, the sun's disc's, the key and the
//     hemisphere's strength;
//   * the picture's half — the sky as drawn at the top of the frame (its
//     luminance and temperature), and the snow: the LIT snow and the
//     SHADED snow read off the lower part of the frame as its brightest and
//     darkest fifth of snow-coloured pixels (low saturation, not near
//     black), their luminance ratio, how blue the shade is (b/r) and how
//     warm the light (r/b) — the numbers "blue shadows" and "the low warm
//     sun on fresh snow" are judged by.
//
// Luminance is relative (Rec. 709 weights on LINEAR light: the bytes are
// sRGB and are decoded first); colour temperature is McCamy's cubic off the
// CIE 1931 chromaticity, good from about 2000 K to 12 000 K and clamped to
// 1000..25 000 K outside that (a deep blue zenith reads as "very cold").

import type { Rgb, SkyLook } from "../game/sky.ts";

/** One frame's numbers. Null where the frame has nothing to read (no
 * snow in sun at night, a black sky). */
export type SkyEval = {
  /** The sun's elevation, °. */
  elev: number;
  zenL: number;
  horL: number;
  zenK: number | null;
  horK: number | null;
  sunK: number | null;
  keyI: number;
  amb: number;
  /** The drawn sky at the top of the frame. */
  skyL: number;
  skyK: number | null;
  /** The drawn snow: lit, shaded, their ratio, the shade's blue and the
   * light's warmth. */
  litL: number | null;
  shadeL: number | null;
  ratio: number | null;
  shadeBlue: number | null;
  litWarm: number | null;
  /** How long the frame took to draw, ms (the lab's own machine — under
   * software GL only comparable with itself). */
  ms: number;
};

const toLinear = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** Relative luminance of a linear colour. */
export function luminance(c: Rgb): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** McCamy's correlated colour temperature of a linear sRGB colour, K —
 * null for a colour too dark to have one. */
export function colourTemperature(c: Rgb): number | null {
  const X = 0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2];
  const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const Z = 0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2];
  const s = X + Y + Z;
  if (Y < 1e-4 || s <= 0) return null;
  const x = X / s;
  const y = Y / s;
  // Past the cubic's range: a chromaticity bluer than about 25 000 K reads
  // as the cap (the cubic turns back down out there).
  if (x < 0.25) return 25000;
  const n = (x - 0.332) / (0.1858 - y);
  const k = 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
  return Math.round(Math.min(25000, Math.max(1000, k)));
}

const r3 = (x: number): number => Math.round(x * 1000) / 1000;

/** The mean linear colour of a list. */
function meanOf(list: Rgb[]): Rgb {
  const m: Rgb = [0, 0, 0];
  for (const c of list) {
    m[0] += c[0];
    m[1] += c[1];
    m[2] += c[2];
  }
  const n = Math.max(1, list.length);
  return [m[0] / n, m[1] / n, m[2] / n];
}

/** Read a frame: `look` the model's sky, `rgba` the cell's bytes (row 0 at
 * the top), `w`×`h` its size, `ms` its draw time. */
export function evalFrame(
  look: SkyLook,
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  ms: number,
): SkyEval {
  const px = (x: number, y: number): Rgb => {
    const i = (y * w + x) * 4;
    return [toLinear(rgba[i]), toLinear(rgba[i + 1]), toLinear(rgba[i + 2])];
  };
  // The sky: the top tenth of the frame, its middle three fifths.
  const sky: Rgb[] = [];
  for (let y = 0; y < Math.max(1, Math.floor(h * 0.1)); y++)
    for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) sky.push(px(x, y));
  const skyMean = meanOf(sky);
  // The snow: the lower two fifths, pixels near grey (a skier's jacket and
  // the dark trunks left out), not near black.
  const snow: { c: Rgb; l: number }[] = [];
  for (let y = Math.floor(h * 0.6); y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = px(x, y);
      const l = luminance(c);
      const hi = Math.max(c[0], c[1], c[2]);
      const lo = Math.min(c[0], c[1], c[2]);
      if (hi < 0.02 || (hi - lo) / hi > 0.45) continue;
      snow.push({ c, l });
    }
  let lit: Rgb | null = null;
  let shade: Rgb | null = null;
  if (snow.length > 50) {
    snow.sort((a, b) => a.l - b.l);
    const fifth = Math.max(1, Math.floor(snow.length / 5));
    shade = meanOf(snow.slice(0, fifth).map((s) => s.c));
    lit = meanOf(snow.slice(snow.length - fifth).map((s) => s.c));
  }
  const litL = lit ? luminance(lit) : null;
  const shadeL = shade ? luminance(shade) : null;
  return {
    elev: Math.round(((look.elevation * 180) / Math.PI) * 10) / 10,
    zenL: r3(luminance(look.zenith)),
    horL: r3(luminance(look.horizon)),
    zenK: colourTemperature(look.zenith),
    horK: colourTemperature(look.horizon),
    sunK: look.elevation > -0.02 ? colourTemperature(look.sunColour) : null,
    keyI: r3(look.keyIntensity),
    amb: r3(look.ambient),
    skyL: r3(luminance(skyMean)),
    skyK: colourTemperature(skyMean),
    litL: litL === null ? null : r3(litL),
    shadeL: shadeL === null ? null : r3(shadeL),
    ratio: litL !== null && shadeL ? r3(litL / shadeL) : null,
    shadeBlue: shade && shade[0] > 1e-4 ? r3(shade[2] / shade[0]) : null,
    litWarm: lit && lit[2] > 1e-4 ? r3(lit[0] / lit[2]) : null,
    ms: Math.round(ms * 10) / 10,
  };
}

/** A linear sRGB colour in CIE L*a*b* (D65). */
function labOf(c: Rgb): Rgb {
  const X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047;
  const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** How far two cells' pictures are apart, in CIE76 ΔE (1 is about the
 * smallest step an eye sees side by side; 2–3 a step seen when looked for;
 * past 5 a different colour): the mean over the whole frame, over its sky
 * (the top two fifths), and the 95th percentile. */
export type FrameDiff = { dE: number; dSky: number; dE95: number };

export function frameDiff(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
): FrameDiff {
  const all: number[] = [];
  let sky = 0;
  let skyN = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const la = labOf([toLinear(a[i]), toLinear(a[i + 1]), toLinear(a[i + 2])]);
      const lb = labOf([toLinear(b[i]), toLinear(b[i + 1]), toLinear(b[i + 2])]);
      const d = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
      all.push(d);
      if (y < h * 0.4) {
        sky += d;
        skyN++;
      }
    }
  const mean = all.reduce((s, d) => s + d, 0) / Math.max(1, all.length);
  all.sort((p, q) => p - q);
  const r2 = (x: number): number => Math.round(x * 100) / 100;
  return {
    dE: r2(mean),
    dSky: r2(sky / Math.max(1, skyN)),
    dE95: r2(all[Math.floor(all.length * 0.95)] ?? 0),
  };
}
