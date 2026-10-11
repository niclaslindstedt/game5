// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT AS DRAWN — its numbers and its colours, three-free, so the
// suite holds them to the research (`docs/wingsuit.md`): a large modern
// three-wing suit on a 1.80 m flyer, two ARM WINGS and a LEG WING, each a
// ram-air wing of a top and a bottom skin with ribs running fore and aft
// between them, the arms and the legs its spars.
//
//   * THE ARM WING runs from the wrist (the grip in his fist) down the
//     arm's leading edge to the armpit, its root down the side of the body
//     past the hip and the outside of the thigh to the knee (a large
//     suit's: 0.9–1.2 m of root chord), its trailing edge nearly straight
//     from the wrist to the knee; 0.20–0.40 m of chord at the wrist; 8–15
//     cm thick inflated at about a quarter of the chord, the arm inside its
//     rounded nose, a sharp trailing edge; seven cells from the shoulder to
//     the wrist; a ram-air MOUTH under the leading edge by the armpit.
//   * THE LEG WING spans the legs from the crotch to past the heels (0.9–
//     1.1 m long, 0.55–0.80 m across the feet), 6–12 cm thick, six cells
//     across, two mouths under its front between the thighs, its trailing
//     edge a shallow V.
//   * THE PAINT: bold, high-contrast block panels — a dark or white base,
//     a vivid accent, a contrasting band along every leading edge, the
//     underside one bright colour, chevrons, panels or stripes across the
//     wings and the tips in a colour of their own (`SUIT_COLOURWAYS`).
//
// A suit is dealt off the flyer's outfit (`suitOf`), so a player wears the
// same suit every jump. Nothing here is any maker's: the numbers are the
// class's, the colourways the sport's habits.

import { outfitKey } from "./dress.ts";
import type { Outfit } from "./outfit.ts";

/** THE CUT, m (a 1.80 m flyer's). */
export const SUIT_CUT = {
  arm: {
    /** The arm's line inside the nose: how far behind the leading edge it
     * lies, and the nose's radius round it (the sleeve and the cloth). */
    nose: 0.07,
    sleeve: 0.07,
    /** The chord at the wrist, from the grip back. */
    tip: 0.3,
    /** How far down the outside of the thigh the root runs: a share of
     * the thigh from the hip to the knee (a large suit's, to the knee). */
    root: 0.92,
    /** The skin's half thickness at its thickest, at `at` of the chord,
     * inflated. */
    half: 0.06,
    at: 0.27,
    /** The section's camber, a share of the chord. */
    camber: 0.035,
    /** Cells from the shoulder to the wrist. */
    cells: 7,
  },
  leg: {
    /** How far past the heels the trailing edge reaches, and how much
     * further its middle does (the shallow V of the tail). */
    past: 0.16,
    tail: 0.07,
    /** How far down the inside of the thigh the front meets (the crotch),
     * m below the hip joints. */
    crotch: 0.1,
    half: 0.045,
    at: 0.3,
    camber: 0.025,
    cells: 6,
  },
} as const;

/** A SUIT'S PAINT, sRGB: the BASE (most of the top skin and the body), the
 * ACCENT (the panels, chevrons or stripes), the LEADING EDGE's band, the
 * UNDERSIDE, the TIPS, the body's DARK (the side panels, the booties, the
 * grips) and its pattern. */
export type SuitColourway = {
  id: string;
  base: number;
  accent: number;
  edge: number;
  under: number;
  tips: number;
  dark: number;
  pattern: "chevrons" | "panels" | "stripes";
};

/** THE COLOURWAYS a suit is dealt from. */
export const SUIT_COLOURWAYS: readonly SuitColourway[] = [
  {
    id: "ember",
    base: 0x1e2026,
    accent: 0xff5a10,
    edge: 0xf2f2ee,
    under: 0xff6a18,
    tips: 0xff5a10,
    dark: 0x111216,
    pattern: "chevrons",
  },
  {
    id: "volt",
    base: 0x172440,
    accent: 0xd8f21a,
    edge: 0xd8f21a,
    under: 0xd8f21a,
    tips: 0xf2f2ee,
    dark: 0x0f1626,
    pattern: "stripes",
  },
  {
    id: "glacier",
    base: 0xeef0f2,
    accent: 0x1c63f0,
    edge: 0x14161b,
    under: 0x1c63f0,
    tips: 0xe8312a,
    dark: 0x1a1c22,
    pattern: "panels",
  },
  {
    id: "orchid",
    base: 0x141519,
    accent: 0xff2e8c,
    edge: 0xff2e8c,
    under: 0xff2e8c,
    tips: 0xf2f2ee,
    dark: 0x0d0e11,
    pattern: "panels",
  },
  {
    id: "crimson",
    base: 0xd11f2a,
    accent: 0xf2f2ee,
    edge: 0x15161a,
    under: 0xd11f2a,
    tips: 0x15161a,
    dark: 0x15161a,
    pattern: "chevrons",
  },
];

/** The colourway a flyer in outfit `o` is dealt: the same every jump. */
export function suitOf(o: Outfit, tone?: number): number {
  const key = outfitKey(o, tone);
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 104729;
  return h % SUIT_COLOURWAYS.length;
}

/** The colourway `i` (wrapped). */
export function colourwayOf(i: number): SuitColourway {
  const n = SUIT_COLOURWAYS.length;
  return SUIT_COLOURWAYS[((Math.round(i) % n) + n) % n];
}

/** sRGB hex to linear RGB, three decimals each, as GLSL reads them. */
function lin(hex: number): [number, number, number] {
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((x) => {
    const s = x / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return [c[0], c[1], c[2]];
}
const vec = (hex: number): string =>
  `vec3(${lin(hex)
    .map((x) => x.toFixed(4))
    .join(", ")})`;

/** THE PAINT AS THE SHADER LAYS IT, off each vertex's `aWing` (where it
 * lies on its wing u, v, which wing, which skin — `wingsuit-cloth.ts`'s
 * `suitLayout`): the base, the leading edge's band, the pattern in the
 * accent, the tips, the ribs' seams, the trailing edge's trim; under, the
 * underside's colour and the dark MOUTHS of the ram-air inlets — crisp at
 * any distance, as the canopies' are. `suitPaint(w)` is the colour there. */
export function suitPaintGlsl(c: SuitColourway): string {
  const pattern =
    c.pattern === "chevrons"
      ? `arm ? fract((u * 1.3 + v * 0.75) * 2.4) < 0.3 && u > 0.18 && u < 0.84
           : fract(v * 2.6 + abs(u - 0.5) * 1.6) < 0.28 && v > 0.12`
      : c.pattern === "stripes"
        ? `arm ? (abs(v - 0.42) < 0.06 || abs(v - 0.62) < 0.035) && u < 0.86
           : abs(u - 0.5) < 0.05 || abs(u - 0.32) < 0.025 || abs(u - 0.68) < 0.025`
        : `arm ? v > 0.56 && u > 0.12 && u < 0.84 && v < 0.93
           : abs(u - 0.5) < 0.2 && v > 0.22 && v < 0.93`;
  return /* glsl */ `
vec3 suitPaint(vec4 w) {
  float u = w.x;
  float v = w.y;
  bool arm = w.z < 1.5;
  bool under = w.w < 0.0;
  float cells = arm ? ${SUIT_CUT.arm.cells.toFixed(1)} : ${SUIT_CUT.leg.cells.toFixed(1)};
  float r = fract(u * cells);
  bool rib = r < 0.022 || r > 0.978;
  if (under) {
    bool mouth = arm ? (u > 0.07 && u < 0.3 && v > 0.13 && v < 0.2)
                     : (v > 0.1 && v < 0.17 && (abs(u - 0.38) < 0.07 || abs(u - 0.62) < 0.07));
    if (mouth) return vec3(0.012, 0.012, 0.014);
    vec3 c = ${vec(c.under)};
    if (arm && v < 0.1) c = ${vec(c.edge)};
    if (v > 0.95) c = ${vec(c.dark)};
    if (!arm && (u < 0.17 || u > 0.83) && v > 0.74) c = ${vec(c.dark)};
    return c * (rib ? 0.8 : 0.92);
  }
  vec3 c = ${vec(c.base)};
  if (${pattern}) c = ${vec(c.accent)};
  if (arm && u > 0.86) c = ${vec(c.tips)};
  if (arm ? v < 0.13 : (u < 0.07 || u > 0.93)) c = ${vec(c.edge)};
  if (v > 0.955) c = ${vec(c.dark)};
  // The booties: the leg wing's sleeves round the feet.
  if (!arm && (u < 0.17 || u > 0.83) && v > 0.74) c = ${vec(c.dark)};
  if (rib) c *= 0.7;
  return c;
}
`;
}
