// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FACE UNDER THE GOGGLES — what shows of him between the goggles'
// frame and the collar: the nose's bridge and tip with its wings, the
// cheekbones and the hollow under them, the upper and lower lip parted by
// the mouth's line, the groove under the lip, the chin and the jaw, and a
// brow under the frame. Low-poly on purpose: one grid laid over the front
// of the head's egg (the same egg `helmet-shape.ts` builds the head on,
// restated here so the helmet's sources and the Blender model built off
// them stay as they are), its columns crowded toward the middle and its
// rows onto the mouth so a few hundred triangles carry the features, each
// face pushed out along the egg's normal by the relief and painted in a
// shade of the skin — the lips, the cheeks and the nose's tip warmer, the
// nostrils, the mouth's line and the flanks of the jaw darker — so the
// face reads as one under the light rather than as a flat mask. The ears
// are under every helmet's ear covers and are not drawn.
//
// The frame is the head bone's: x across, y up, z ahead, m.

import type { Loom } from "./dress-loft.ts";

type V = [number, number, number];

/** `helmet-shape.ts`'s HEAD: the egg's radii and its middle. */
const EGG = { r: [0.077, 0.104, 0.097] as V, at: [0, -0.014, -0.006] as V };

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** The egg at `theta` up from the chin and `phi` round from ahead — the
 * jaw carried forward and squared to a chin, as the helmet's head is —
 * and the way out from it there. */
function eggAt(theta: number, phi: number): { p: V; n: V } {
  const s = Math.sin(theta);
  const d: V = [Math.sin(phi) * s, -Math.cos(theta), Math.cos(phi) * s];
  const fore = Math.max(0, d[2]);
  const low = smooth((-d[1] - 0.15) / 0.6);
  const p: V = [
    d[0] * EGG.r[0] - d[0] * 0.012 * low + EGG.at[0],
    d[1] * EGG.r[1] - 0.004 * low * fore + EGG.at[1],
    d[2] * EGG.r[2] + 0.03 * low * fore * fore + EGG.at[2],
  ];
  const n: V = [d[0] / EGG.r[0], d[1] / EGG.r[1], d[2] / EGG.r[2]];
  const l = Math.hypot(n[0], n[1], n[2]);
  return { p, n: [n[0] / l, n[1] / l, n[2] / l] };
}

/** The theta the egg's point is at height `y`. */
const thetaAt = (y: number) => Math.acos(Math.max(-1, Math.min(1, -(y - EGG.at[1]) / EGG.r[1])));

/** The rows, as heights: crowded onto the lips and the nose's foot. */
const ROWS = [
  -0.112, -0.102, -0.094, -0.087, -0.082, -0.0785, -0.075, -0.0705, -0.064, -0.056, -0.048, -0.038,
  -0.025, -0.01, 0.006,
];
/** The columns, as turns round from ahead: crowded onto the nose. */
const COLUMNS = 12;
const SPREAD = 1.25;

const bump = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
  Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);

/** How a man's face and a woman's differ, as shares of the man's relief. */
type Cast = { nose: number; jaw: number; chin: number; lips: number; brow: number };
const MAN: Cast = { nose: 1, jaw: 1, chin: 1, lips: 1, brow: 1 };
const WOMAN: Cast = { nose: 0.8, jaw: 0.45, chin: 0.75, lips: 1.3, brow: 0.6 };

/** THE NOSE: the bridge rising from under the frame to the tip, falling
 * away under it to the lip; the wings either side of the tip. */
function noseAt(x: number, y: number, c: Cast): number {
  const top = -0.012;
  const tip = -0.051 * (0.96 + 0.04 * c.nose);
  const k = smooth((top - y) / (top - tip));
  const rise = (0.005 + 0.021 * k ** 1.3) * c.nose;
  const fall = y < tip ? Math.exp(-(((y - tip) / 0.006) ** 2)) : 1;
  const wide = 0.0065 + 0.006 * k;
  const ridge = rise * fall * Math.exp(-((x / wide) ** 2));
  const wings = 0.0065 * c.nose * bump(Math.abs(x), y, 0.012, tip - 0.002, 0.006, 0.006);
  return y > top + 0.01 ? 0 : ridge + wings;
}

/** The relief off the egg at (x, y), m. */
function reliefAt(x: number, y: number, c: Cast): number {
  const ax = Math.abs(x);
  return (
    0.0015 +
    noseAt(x, y, c) +
    0.004 * c.brow * bump(ax, y, 0.03, 0.007, 0.024, 0.006) +
    0.006 * bump(ax, y, 0.045, -0.029, 0.016, 0.013) -
    0.003 * c.jaw * bump(ax, y, 0.044, -0.067, 0.012, 0.014) +
    0.0035 * c.lips * bump(x, y, 0, -0.0715, 0.021, 0.0055) -
    0.003 * bump(x, y, 0, -0.0785, 0.02, 0.0022) +
    0.004 * c.lips * bump(x, y, 0, -0.0845, 0.017, 0.0048) -
    0.002 * bump(x, y, 0, -0.093, 0.016, 0.0035) +
    0.007 * c.chin * bump(x, y, 0, -0.104, 0.017 * (0.8 + 0.2 * c.chin), 0.011) +
    0.003 * c.jaw * bump(ax, y, 0.056, -0.09, 0.01, 0.014)
  );
}

/** Two sRGB hex colours mixed, `k` of the way from `a` to `b`. */
function mix(a: number, b: number, k: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

const FLUSH = 0xd0604c;
const SHADE = 0x2a1410;

/** The skin's shade at (x, y), `h` the nose's height there. */
function shadeAt(skin: number, x: number, y: number, h: number, female: boolean): number {
  const ax = Math.abs(x);
  if (ax < 0.016 && Math.abs(y + 0.0785) < 0.0016) return mix(skin, SHADE, 0.55);
  const lip = bump(x, y, 0, -0.079, 0.019, 0.0072);
  if (lip > 0.4) return mix(skin, female ? 0xb04a52 : 0x9a4a40, female ? 0.45 : 0.3);
  if (ax > 0.005 && ax < 0.013 && y < -0.052 && y > -0.06) return mix(skin, SHADE, 0.35);
  if (h > 0.016) return mix(skin, FLUSH, 0.1);
  if (bump(ax, y, 0.046, -0.042, 0.02, 0.018) > 0.5) return mix(skin, FLUSH, female ? 0.16 : 0.1);
  if (y < -0.1 && ax > 0.03) return mix(skin, SHADE, 0.16);
  if (ax > 0.058) return mix(skin, SHADE, 0.12);
  return skin;
}

/** Every shade a face of `skin` is painted in (the suite's palette). */
export function faceShades(skin: number, female: boolean): number[] {
  const out = new Set<number>([skin]);
  for (let y = -0.12; y <= 0.01; y += 0.0005) {
    for (let x = -0.09; x <= 0.09; x += 0.001) {
      out.add(shadeAt(skin, x, y, 0, female));
      out.add(shadeAt(skin, x, y, 0.02, female));
    }
  }
  return [...out];
}

/** His face, laid on the head bone of `loom` in `skin`. */
export function cutFace(loom: Loom, skin: number, female: boolean): void {
  const cast = female ? WOMAN : MAN;
  const position: number[] = [];
  const at: { x: number; y: number; h: number }[] = [];
  for (const y of ROWS) {
    const theta = thetaAt(y);
    for (let i = 0; i <= COLUMNS; i++) {
      const t = (i / COLUMNS) * 2 - 1;
      const phi = SPREAD * Math.sign(t) * Math.abs(t) ** 1.6;
      const { p, n } = eggAt(theta, phi);
      const d = reliefAt(p[0], p[1], cast);
      position.push(p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d);
      at.push({ x: p[0], y: p[1], h: noseAt(p[0], p[1], cast) });
    }
  }
  const W = COLUMNS + 1;
  const index: number[] = [];
  const colours: number[] = [];
  for (let r = 0; r + 1 < ROWS.length; r++) {
    for (let i = 0; i < COLUMNS; i++) {
      const a = r * W + i;
      const b = a + 1;
      const c = a + W + 1;
      const d = a + W;
      const mid = [a, b, c, d].map((k) => at[k]);
      const x = mid.reduce((s, q) => s + q.x, 0) / 4;
      const y = mid.reduce((s, q) => s + q.y, 0) / 4;
      const h = mid.reduce((s, q) => s + q.h, 0) / 4;
      const colour = shadeAt(skin, x, y, h, female);
      // Wound to face out: rows go up, columns go round to his left.
      index.push(a, c, b, a, d, c);
      colours.push(colour, colour);
    }
  }
  loom.rigid("head", position, null, index, (tri) => colours[tri]);
}
