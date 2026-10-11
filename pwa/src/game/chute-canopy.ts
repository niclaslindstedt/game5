// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVER'S MAIN AS DRAWN (`chute-scene.ts` hangs it) — three-free, so
// the suite reads it. The paramotor's cloth (`para-canopy.ts`) on a sport
// main's numbers (`CHUTE.canopy`):
//
//   * THE PLANFORM is all but a rectangle — 6.5 m by 2.85 m on 18.6 m² (a
//     flat aspect ratio near 2.3, a sport main's 1.9–2.6), the tips keeping
//     most of the chord, the leading edge square across;
//   * THE ARC is flat — a sport main's spanwise anhedral takes only some
//     ten per cent off its span, its tips turned down some 35°, never the
//     speed wing's C;
//   * NINE CELLS, each SEWN AS TWO (a loaded rib every other rib, the
//     non-loaded one between carrying no line): the top skin pillows twice
//     across a cell, the trailing edge scalloped between every rib, the
//     NOSE OPEN right across the span (no closed tips), a deep section
//     (some 17 % of the chord) with its mouth under the leading edge;
//   * THE STABILIZERS are the fabric panels hung under each end rib that
//     the slider stops are sewn to;
//   * THE LINES run in four rows (A, B to the front riser, C, D to the
//     rear) off the ten loaded ribs, each quadrant's through one of the
//     SLIDER's four grommets, and the steering lines off the trailing edge
//     cascaded to the toggle on each rear riser.
//
// THE OPENING (`skyInflation`, `shapeSkyCanopy`): out of the bag the cloth
// is a bunched sheet held narrow by the slider; the CENTRE CELLS take the
// air first and fill outward to the end cells, the slider holds the span in
// until it is driven down the lines, the cells still empty flog in the
// relative wind and the span spreads as the slider comes down — and, full,
// the cloth breathes a little as it flies.

import { CHUTE } from "@engine";

import {
  canopyLayout,
  canopyPoint,
  cellU,
  ribAt,
  stationAt,
  type CanopyLayout,
  type WingShape,
} from "./para-canopy.ts";

/** THE SPORT MAIN's shape (`WingShape`): its size off `CHUTE.canopy`. */
export const SKY_WING: WingShape = {
  cells: CHUTE.canopy.cells,
  span: CHUTE.canopy.span,
  chord: CHUTE.canopy.chord,
  tip: 0.95,
  curl: 0.62,
  gather: 0.55,
  sweep: 0.1,
  thick: 0.17,
  camber: 0.03,
  pillow: 0.028,
  scallop: 0.045,
  mouth: [0.0, 0.08],
  closed: 0,
  stabilo: 0.55,
  brake: 0.85,
  brakeFrom: 0.5,
  strips: 4,
  stations: 12,
  sub: 2,
};

/** THE PAINT: a sport main's — the cells in three colours, the centre cell
 * and the end cells in their own, a band across the nose; the underside a
 * shade under; the cells' insides seen through the open nose. */
export const SKY_PAINT = {
  centre: [0.97, 0.79, 0.12],
  body: [0.1, 0.32, 0.72],
  ends: [0.94, 0.95, 0.96],
  nose: [0.08, 0.09, 0.12],
  under: 0.7,
  mouth: [0.03, 0.03, 0.04],
} as const;

/** The paint as the shader lays it off `aPaint` (`canopyLayout`'s: the
 * place along the span, along the chord, and the skin), restated by
 * `skyPaintAt` for the suite. `canopyPaint(p)` is the colour there. */
export const SKY_PAINT_GLSL = /* glsl */ `
vec3 canopyPaint(vec3 p) {
  float u = p.x;
  float s = p.y;
  bool under = p.z < 0.0;
  if (under && s < ${SKY_WING.mouth[1].toFixed(3)}) return vec3(${SKY_PAINT.mouth.join(", ")});
  float cell = floor((u + 1.0) * ${(SKY_WING.cells / 2).toFixed(1)});
  vec3 c = cell < 0.5 || cell > ${(SKY_WING.cells - 1.5).toFixed(1)} ? vec3(${SKY_PAINT.ends.join(", ")})
    : abs(cell - ${((SKY_WING.cells - 1) / 2).toFixed(1)}) < 0.5 ? vec3(${SKY_PAINT.centre.join(", ")})
    : vec3(${SKY_PAINT.body.join(", ")});
  if (!under && s < 0.07) c = vec3(${SKY_PAINT.nose.join(", ")});
  // The ribs' seams a shade darker, the loaded ones the more.
  float v = fract((u + 1.0) * ${(SKY_WING.cells / 2).toFixed(1)});
  if (v < 0.012 || v > 0.988) c *= 0.75;
  else if (abs(v - 0.5) < 0.01) c *= 0.88;
  return under ? c * ${SKY_PAINT.under.toFixed(2)} : c;
}
`;

/** `SKY_PAINT_GLSL` restated for the suite: the colour at `u`, `s` on a
 * skin (`side` 1 the top). */
export function skyPaintAt(u: number, s: number, side: number): readonly number[] {
  const P = SKY_PAINT;
  if (side < 0 && s < SKY_WING.mouth[1]) return P.mouth;
  const cell = Math.floor((u + 1) * (SKY_WING.cells / 2));
  let c: readonly number[] =
    cell < 1 || cell > SKY_WING.cells - 2
      ? P.ends
      : Math.abs(cell - (SKY_WING.cells - 1) / 2) < 0.5
        ? P.centre
        : P.body;
  if (side > 0 && s < 0.07) c = P.nose;
  return side < 0 ? c.map((x) => x * P.under) : c;
}

/** The mesh's layout for the sport main (`canopyLayout`). */
export function skyLayout(): CanopyLayout {
  return canopyLayout(SKY_WING);
}

/** HOW FAR OPEN THE CANOPY IS, out of the engine's deployment (`ChuteDeploy.spread`,
 * 0 out of the bag .. 1 full): `width` the share of its span the slider
 * lets it spread to, 0..1; `fill(u)` how full the cell at `u` (−1..1
 * along the span) is, 0..1 — the centre first, the end cells last. */
export type Inflation = { width: number; fill: (u: number) => number };

const smooth = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** THE OPENING's shape at `spread`. Below about a third of the way (the
 * snivel) the slider holds the cloth to a quarter of its span; the centre
 * cell is full by half way, the end cells by some 0.85. */
export function skyInflation(spread: number): Inflation {
  const p = Math.max(0, Math.min(1, spread));
  const width = 0.22 + 0.78 * smooth((p - 0.3) / 0.7);
  return { width, fill: (u) => smooth(p * 2.2 - Math.abs(u) * 0.95) };
}

/** What `shapeSkyCanopy` is handed: the toggles (left, right, 0..1), how
 * far open (`spread`), the seconds the canopy has been out (its flogging and
 * its breathing run on them), and how long it has been full, s (the breath
 * dies down over its first seconds). */
export type SkyShapeInput = {
  left: number;
  right: number;
  spread: number;
  t: number;
  full?: number;
};

const mean = new Float32Array(3);
const top = new Float32Array(3);

/** A POINT of the opening canopy into `out` at `o`: at `u` along the span,
 * `s` along the chord, on skin `side`, `v` across its cell, the trailing
 * edge pulled down `drop` m — gathered by the slider to `inf.width` of its
 * span, its cell `inf.fill` full (an empty cell flat, its tail crumpled
 * and flogging), at `t` s. */
export function skyPoint(
  u: number,
  s: number,
  side: number,
  v: number,
  drop: number,
  inf: Inflation,
  t: number,
  out: Float32Array | number[],
  o: number,
  breath = 0,
): void {
  const f = inf.fill(u);
  const w = inf.width;
  // Gathered: the rib laid where a narrower canopy would have it, and the
  // cloth between folded in pleats; an empty cell's tail crumpled forward.
  const ug = u * w;
  const sc = s * (0.55 + 0.45 * f);
  canopyPoint(ug, sc, 0, v, drop * f, mean, 0, SKY_WING);
  canopyPoint(ug, sc, side, v, drop * f, top, 0, SKY_WING);
  const k = (0.1 + 0.9 * f) * (1 + breath * 0.04 * Math.sin(t * 2.1 + u * 3));
  const loose = 1 - f;
  const bunch = 1 - w;
  // The pleats of cloth bunched by the slider, and the empty cells flogging
  // in the air rushing up past them.
  const pleat = bunch * 0.07 * Math.sin(u * SKY_WING.cells * Math.PI);
  const flog = loose * (0.06 + 0.14 * s) * Math.sin(t * 17 + u * 9 + s * 6);
  out[o] = mean[0] + (top[0] - mean[0]) * k + pleat;
  out[o + 1] = mean[1] + (top[1] - mean[1]) * k - bunch * 0.55 * Math.abs(u) + flog;
  out[o + 2] = mean[2] + (top[2] - mean[2]) * k + loose * 0.05 * Math.cos(t * 13 + u * 7);
}

/** THE MESH'S POSITIONS for the opening (or the open) canopy, into `out`
 * (`skyLayout`'s order): every cell gathered and filled as `skyInflation`
 * has it at `inp.spread`, the trailing edge pulled down by the toggles. */
export function shapeSkyCanopy(out: Float32Array, inp: SkyShapeInput): void {
  const w = SKY_WING;
  const inf = skyInflation(inp.spread);
  const breath = inp.full === undefined ? 0 : Math.exp(-inp.full / 3) * 0.6 + 0.4;
  const across = w.strips + 1;
  const along = w.stations + 1;
  const sub = w.sub ?? 1;
  let base = 0;
  for (let i = 0; i < w.cells; i++) {
    for (const side of [1, -1]) {
      for (let a = 0; a < across; a++) {
        const v = a / w.strips;
        const u = cellU(i, v, w);
        const outer = 0.35 + 0.65 * Math.abs(u);
        const drop = w.brake * outer * (u < 0 ? inp.left : inp.right);
        const tail = 1 - w.scallop * Math.sin(Math.PI * ((v * sub) % 1));
        for (let j = 0; j < along; j++) {
          const at = (base + a * along + j) * 3;
          skyPoint(u, stationAt(j, w) * tail, side, v, drop, inf, inp.t, out, at, breath);
        }
      }
      base += across * along;
    }
  }
  // THE STABILIZERS: the panel under each end rib, its point toward him.
  for (const u of [-1, 1]) {
    const r = ribAt(u * inf.width, w);
    skyPoint(u, 0.1, -1, 0, 0, inf, inp.t, out, base * 3);
    skyPoint(u, 0.9, -1, 0, 0, inf, inp.t, out, (base + 1) * 3);
    skyPoint(u, 0.5, -1, 0, 0, inf, inp.t, out, (base + 2) * 3);
    const d = w.stabilo * (0.3 + 0.7 * inf.fill(u));
    out[(base + 2) * 3] += -r.nx * d - Math.sign(u) * d * 0.2;
    out[(base + 2) * 3 + 1] += -r.ny * d;
    base += 3;
  }
}

/** A LINE of the sport main: its foot on the canopy's underside (`u` along
 * the span, `s` along the chord), the quadrant it runs through (the
 * slider's grommet and the riser: `side` −1 left, 1 right; `front` the A
 * and B rows' riser, the C and D rows' the rear), and whether it is a
 * steering line (to the toggle, through the rear grommet). */
export type SkyLine = { u: number; s: number; side: number; front: boolean; brake: boolean };

/** The rows along the chord, shares of it. */
export const SKY_ROWS = { A: 0.06, B: 0.32, C: 0.6, D: 0.88 } as const;

/** EVERY LINE: the four rows off the ten loaded ribs, and the steering
 * lines off the trailing edge's outer ribs and the end. */
export function skyLines(): SkyLine[] {
  const lines: SkyLine[] = [];
  for (let k = 0; k <= SKY_WING.cells; k++) {
    const u = cellU(k, 0, SKY_WING);
    const side = u < 0 ? -1 : 1;
    for (const [row, s] of Object.entries(SKY_ROWS)) {
      lines.push({ u, s, side, front: row === "A" || row === "B", brake: false });
    }
    if (Math.abs(u) > 0.3) lines.push({ u, s: 0.99, side, front: false, brake: true });
  }
  return lines;
}

/** WHERE THE SLIDER IS on the lines: each grommet `share` of the way from
 * its riser's top (0) up to its place pressed under the canopy (1), and
 * how far the slider is spread open, 0 bunched .. 1 flat — it opens as it
 * comes down and the lines through its grommets spread. */
export function sliderOf(share: number): { share: number; open: number } {
  const s = Math.max(0, Math.min(1, share));
  return { share: s, open: 0.35 + 0.65 * (1 - s) };
}
