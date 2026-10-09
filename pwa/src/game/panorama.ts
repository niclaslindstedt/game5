// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOUNTAIN AS A PISTE MAP PAINTS IT — the generated mountain rendered
// from out over the valley floor looking up the fall line, the way a ski
// area's painted panorama hangs at the foot of its lifts, and the courses
// laid over the picture as a schematic: every run in its colour, the course
// raced cased in white, the lifts as straight lines between two stations,
// the start and the finish, the kickers.
//
// THE CONVENTIONS ARE THE PAINTED MAP'S, because a skier already reads them:
//
//   - THE SUMMIT AT THE TOP and every run falling DOWN the picture. The view
//     looks along −z (the world's +z is the fall line), so the world's +x is
//     on the viewer's LEFT — the same left the start card's plan uses
//     (`seed-chart.ts`).
//   - A PARALLEL VIEW, not a lens: an orthographic camera tilted down onto
//     the face, the tilt chosen per map so the ski area fills a square
//     plate, and the relief raised a little. A painter flattens his
//     perspective the same way so the far runs are not shrunk to nothing,
//     and it keeps every column of the picture one slice of the world at
//     one x — which is what makes the march below exact and a tap on the
//     picture a point on the snow.
//   - THE LIGHT FROM THE UPPER LEFT and from in front, so the face is lit and
//     a ridge reads as a ridge; the shadows in the snow INDIGO rather than
//     grey; the woods a dark mass of small individual trees with snow on
//     their lit shoulders; the pistes the cleanest white on the mountain;
//     rock where it is too steep to hold snow; the far air hazed blue.
//   - THE SKI AREA'S OWN SLICE OF THE WORLD, edge to edge. The picture is
//     exactly as wide as the runs and lifts and a margin either side —
//     widened, where the mountain stands taller than that, only over ground
//     clear of the rim the map rises into at its sides — and cut off HARD
//     at all four edges, so it sits square in the plate's frame. The
//     summit ridge is the skyline (the ground behind its crest is never
//     painted); over it a clear blue sky with a few fair-weather clouds,
//     which may stand behind a peak; under the village the valley floor
//     runs on to the foot of the picture.
//
// HOW IT IS DRAWN: column by column, each column marched from the valley
// floor up the face with a running horizon (the lab's panorama does the
// same in perspective, `scripts/lib/resort-draw.mjs`), every pixel keeping
// the world z of the ground it shows. That depth buffer is what the trees
// are tested against, what the schematic asks to split each run into its
// seen and its hidden stretches, and — downsampled — the PICK GRID a tap is
// turned back into a point on the snow with.
//
// DOM-free and three-free: the start card's worker paints it
// (`seed-preview-worker.ts`) and the suite reads it (`tests/panorama_test.ts`).

import {
  gradeOf,
  sampleField,
  sampleFieldGradient,
  skiRoutesOf,
  type GeneratedLevel,
  type RunGrade,
  type RunKind,
  type Level,
  type TrackPoint,
} from "@engine";

import { runNumbers } from "./run-names.ts";
import type { ChartHouse, HouseSpot } from "./seed-chart.ts";

/** The square picture's side, px: the plate is a couple of hundred CSS
 * pixels on the card, so this is its own size on a two-times screen. */
export const PANORAMA_PX = 512;

/** The schematic's square user space, as the plan chart's (`CHART_VIEW`). */
export const PANORAMA_VIEW = 100;

/** The pick grid's side: a tap is a finger's width, and 128 cells over a
 * couple of hundred CSS pixels is finer than one. */
export const PICK_PX = 128;

/** How much the relief is raised, as a share: enough that a rolling face
 * still reads as one at this distance, not so much that a green looks like
 * a black. */
const RELIEF = 1.2;

/** The tilts the view may be laid at, down from the horizontal, rad. Below
 * the first the valley floor folds into a line; past the last the face is
 * seen from above and stops looking like a mountain. */
const TILT_MIN = (18 * Math.PI) / 180;
const TILT_MAX = (46 * Math.PI) / 180;

/** The room over the summit ridge and the valley floor under the village,
 * as shares of the ski area's height in the picture. */
const SKY = 0.07;
const FOOT = 0.05;

/** The margin the picture keeps either side of the ski area, as a share of
 * its width (and never less than `PAD_MIN`, m). */
const PAD = 0.08;
const PAD_MIN = 60;

/** How far in from the map's sides the ground is the mountain's, as a
 * share of the map's side: past it the terrain rises into the rim that
 * closes the map, which the picture never shows. */
const RIM = 0.09;

/** THE VIEW: an orthographic camera looking along −z, tilted down by
 * `tilt`. A world point (x, y, z) lands in the picture at column
 * `px/2 − (x − cx)·scale` and row `(top − up)·scale`, where `up` is
 * `y·relief·cos(tilt) − z·sin(tilt)` — how far UP the picture the point
 * stands, in metres. */
export type PanoramaView = {
  size: number;
  px: number;
  /** Down from the horizontal, rad. */
  tilt: number;
  relief: number;
  /** Pixels a metre. */
  scale: number;
  /** The world x at the picture's centre column, m. */
  cx: number;
  /** The `up` of the picture's top edge, m. */
  top: number;
  /** The world x span the picture shows edge to edge, m — the ski area,
   * its margin and whatever width the square asked for beside it. */
  clip: [number, number];
};

/** What the painter reads off a map. */
export type PanoramaLevel = Pick<
  GeneratedLevel,
  | "seed"
  | "size"
  | "ground"
  | "packedAt"
  | "trees"
  | "track"
  | "grid"
  | "kickers"
  | "mountain"
  | "resort"
  | "grade"
>;

const upOf = (v: PanoramaView, y: number, z: number): number =>
  y * v.relief * Math.cos(v.tilt) - z * Math.sin(v.tilt);

/** A world point's pixel in the picture: [column, row], fractional. */
export function panoramaPixel(v: PanoramaView, x: number, y: number, z: number): [number, number] {
  return [v.px / 2 - (x - v.cx) * v.scale, (v.top - upOf(v, y, z)) * v.scale];
}

/** A world point in the schematic's user space. */
export function toPanorama(v: PanoramaView, x: number, y: number, z: number): [number, number] {
  const [c, r] = panoramaPixel(v, x, y, z);
  return [(c / v.px) * PANORAMA_VIEW, (r / v.px) * PANORAMA_VIEW];
}

/** The world x a column of the picture is a slice at. */
const xOfColumn = (v: PanoramaView, col: number): number => v.cx - (col - v.px / 2) / v.scale;

/** Every point the picture must hold: the runs, the lifts' stations, the
 * village and the summit — or, on a map with no ski area, its piste. */
function contentOf(level: PanoramaLevel): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  const lines = level.resort ? level.resort.runs.map((r) => r.points) : [level.track.points];
  for (const pts of lines) for (let i = 0; i < pts.length; i += 8) out.push(pts[i]);
  for (const l of level.resort?.lifts ?? []) out.push(l.bottom, l.top);
  if (level.resort) out.push(level.resort.village);
  out.push(level.mountain.summit);
  return out;
}

/** THE VIEW FITTED TO A MAP: the ski area across the picture with a margin,
 * the summit ridge behind it in frame, and the tilt the one that makes the
 * whole of it closest to the square the plate is. */
export function fitPanorama(level: PanoramaLevel, px: number = PANORAMA_PX): PanoramaView {
  const size = level.size;
  const content = contentOf(level);
  let xa = Infinity;
  let xb = -Infinity;
  let zTop = Infinity;
  for (const p of content) {
    xa = Math.min(xa, p.x);
    xb = Math.max(xb, p.x);
    zTop = Math.min(zTop, p.z);
  }
  const pad = Math.max(PAD_MIN, PAD * (xb - xa));
  const safe: [number, number] = [RIM * size, (1 - RIM) * size];
  xa = Math.max(safe[0], xa - pad);
  xb = Math.min(safe[1], xb + pad);
  // The ridge behind the top stations: it is the picture's skyline, so it
  // is fitted too.
  const ridge: { y: number; z: number }[] = [];
  for (let i = 0; i <= 32; i++) {
    const x = xa + ((xb - xa) * i) / 32;
    for (let z = 0; z <= zTop; z += 20) ridge.push({ y: sampleField(level.ground, x, z), z });
  }
  let width = xb - xa;
  let best: { tilt: number; lo: number; hi: number } | null = null;
  let bestErr = Infinity;
  for (let k = 0; k <= 28; k++) {
    const tilt = TILT_MIN + ((TILT_MAX - TILT_MIN) * k) / 28;
    const v = { tilt, relief: RELIEF } as PanoramaView;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of content) {
      const u = upOf(v, p.y, p.z);
      lo = Math.min(lo, u);
      hi = Math.max(hi, u);
    }
    for (const p of ridge) hi = Math.max(hi, upOf(v, p.y, p.z));
    const err = Math.abs(Math.log(((hi - lo) * (1 + SKY + FOOT)) / width));
    if (err < bestErr) {
      bestErr = err;
      best = { tilt, lo, hi };
    }
  }
  const { tilt, lo, hi } = best!;
  const spanU = (hi - lo) * (1 + SKY + FOOT);
  // A mountain taller than its ski area is wide is given the width the
  // square asks for, either side, over safe ground only.
  if (spanU > width) {
    const grow = spanU - width;
    const left = Math.min(grow / 2, xa - safe[0]);
    const right = Math.min(grow - left, safe[1] - xb);
    // What the right side could not take, the left takes if it can.
    const more = Math.min(grow - left - right, xa - safe[0] - left);
    xa -= left + more;
    xb += right;
    width = xb - xa;
  }
  // The picture is exactly the slice's width. The height left over goes
  // mostly to the sky; a mountain still too tall for it loses the valley
  // floor under the village first.
  const scale = px / width;
  const slack = width - spanU;
  const top = hi + (hi - lo) * SKY + Math.max(0, slack) * 0.7;
  return { size, px, tilt, relief: RELIEF, scale, cx: (xa + xb) / 2, top, clip: [xa, xb] };
}

// ── The paint, sRGB 0..255 ───────────────────────────────────────────────

type RGB = [number, number, number];

const SKY_TOP: RGB = [52, 108, 190];
const SKY_LOW: RGB = [178, 206, 238];
const CLOUD_LIT: RGB = [255, 255, 255];
const CLOUD_SHADE: RGB = [188, 202, 226];
const SNOW_LIT: RGB = [252, 252, 249];
/** The shadowed snow: a blue with indigo in it, the painter's trick that
 * gives the snow its body. */
const SNOW_SHADE: RGB = [106, 124, 182];
const PISTE: RGB = [255, 255, 253];
const ROCK_LIT: RGB = [150, 138, 126];
const ROCK_SHADE: RGB = [62, 60, 70];
const HAZE: RGB = [196, 214, 238];
const TREE_LIT: RGB = [52, 98, 66];
const TREE_SHADE: RGB = [18, 44, 36];
const TREE_SNOW: RGB = [222, 232, 244];
const BARE: RGB = [104, 90, 84];
const WALL_LIT: RGB = [168, 104, 66];
const WALL_SHADE: RGB = [108, 62, 44];
const ROOF: RGB = [238, 241, 248];

/** Toward the light: the viewer's upper left (world +x), up, and from the
 * valley (+z). */
const LIGHT: RGB = (() => {
  const v = [0.5, 0.78, 0.4];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

/** The relief the light is shaded by, raised again, so a roll reads. */
const SHADE_RELIEF = 1.6;

/** How steep the snow lets go of the rock: the slope's cosine below which
 * rock shows, and the band it comes through over. */
const ROCK_NY = 0.8;
const ROCK_BAND = 0.1;

/** How much haze the far edge of the map is under, as a share. */
const HAZE_FAR = 0.3;

/** A tree is drawn this many times its height, so a wood reads as trees at
 * the plate's scale — the painter's licence. */
const TREE_LIFT = 2.1;

/** The grid the runs' corridors are kept on, m. A tree drawn
 * {@link TREE_LIFT} times its height would bury a cat track six metres
 * wide, so — the painter's other licence — no tree is painted over a run's
 * own snow, and every piste and lane shows its cut through the woods. (Not
 * the packed field: a region's wind crust is packed too, far from any run.) */
const CORRIDOR_CELL = 2;

/** How far down the face from the summit's row a column's crest is looked
 * for, m, and the step it is looked for at. */
const CREST_REACH = 600;
const CREST_STEP = 8;

/** The broadleaves, drawn bare. */
const BARE_KINDS = new Set(["birch", "aspen", "rowan", "alder", "willow", "beech", "maple", "ash"]);

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A hash of two integers and the seed, 0..1. */
function hash(a: number, b: number, seed: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The painted picture, opaque, and the world z of the ground behind every
 * pixel of it (NaN on the sky). */
export type PanoramaPicture = { rgba: Uint8ClampedArray<ArrayBuffer>; depth: Float32Array };

/** PAINT THE MOUNTAIN. */
export function renderPanorama(level: PanoramaLevel, v: PanoramaView): PanoramaPicture {
  const px = v.px;
  const rgba = new Uint8ClampedArray(px * px * 4);
  const depth = new Float32Array(px * px).fill(NaN);
  // Which pixels show a run's own snow — a piste or a lane — that no tree
  // is painted over (`stamp`).
  const groomed = new Uint8Array(px * px);
  const onRun = corridorOf(level);
  const crests = crestsOf(level, v);
  const grad = new Float64Array(3);
  const size = v.size;
  // A sample every half pixel of valley floor, which the face's own slope
  // only ever spreads over more rows.
  const dz = 0.5 / (v.scale * Math.sin(v.tilt));
  const foot = v.top - px / v.scale;
  for (let col = 0; col < px; col++) {
    const x = Math.min(size, Math.max(0, xOfColumn(v, col + 0.5)));
    const rowOf = (h: number, z: number): number =>
      Math.max(0, Math.ceil((v.top - upOf(v, h, z)) * v.scale));
    let free = px;
    // The march starts where the valley floor meets the foot of the
    // picture — past the map's near edge, where the field holds its edge
    // row, so the floor runs on flat — and stops at the column's crest:
    // the summit ridge is the skyline, and the ground behind it, falling
    // away to the map's far edge, is never painted.
    const edge = sampleField(level.ground, x, size);
    const start = Math.max(size, (edge * v.relief * Math.cos(v.tilt) - foot) / Math.sin(v.tilt));
    for (let z = start; z >= crests[col] && free > 0; z -= dz) {
      sampleFieldGradient(level.ground, x, z, grad);
      const row = rowOf(grad[0], z);
      if (row >= free) continue;
      const packed = level.packedAt(x, z);
      const c = groundColour(level, x, z, grad, packed);
      for (let r = row; r < free; r++) {
        const i = r * px + col;
        groomed[i] = onRun(x, z) ? 1 : 0;
        rgba[i * 4] = c[0];
        rgba[i * 4 + 1] = c[1];
        rgba[i * 4 + 2] = c[2];
        rgba[i * 4 + 3] = 255;
        depth[i] = z;
      }
      free = row;
    }
  }
  paintTrees(level, v, rgba, depth, groomed);
  paintVillage(level, v, rgba, depth);
  paintSky(rgba, depth, px, level.seed);
  return { rgba, depth };
}

/** Whether a plan point lies on a run's own snow: each run's (or, on a map
 * with no ski area, the piste's) width stamped along its line. */
function corridorOf(level: PanoramaLevel): (x: number, z: number) => boolean {
  const n = Math.ceil(level.size / CORRIDOR_CELL) + 1;
  const cells = new Uint8Array(n * n);
  const lines = level.resort ? level.resort.runs.map((r) => r.points) : [level.track.points];
  for (const pts of lines) {
    for (const p of pts) {
      const r = p.width / 2 / CORRIDOR_CELL;
      const c0 = p.x / CORRIDOR_CELL;
      const r0 = p.z / CORRIDOR_CELL;
      for (let j = Math.max(0, Math.floor(r0 - r)); j <= Math.min(n - 1, Math.ceil(r0 + r)); j++) {
        for (
          let i = Math.max(0, Math.floor(c0 - r));
          i <= Math.min(n - 1, Math.ceil(c0 + r));
          i++
        ) {
          if ((i - c0) ** 2 + (j - r0) ** 2 <= r * r) cells[j * n + i] = 1;
        }
      }
    }
  }
  return (x, z) => {
    const i = Math.round(x / CORRIDOR_CELL);
    const j = Math.round(z / CORRIDOR_CELL);
    return i >= 0 && j >= 0 && i < n && j < n && cells[j * n + i] === 1;
  };
}

/** Each column's crest: the z of the highest ground down its slice from
 * the map's far edge to a little past the summit's row. */
function crestsOf(level: PanoramaLevel, v: PanoramaView): Float32Array {
  const out = new Float32Array(v.px);
  const reach = Math.min(v.size, level.mountain.summit.z + CREST_REACH);
  for (let col = 0; col < v.px; col++) {
    const x = Math.min(v.size, Math.max(0, xOfColumn(v, col + 0.5)));
    let best = -Infinity;
    for (let z = 0; z <= reach; z += CREST_STEP) {
      const h = sampleField(level.ground, x, z);
      if (h > best) {
        best = h;
        out[col] = z;
      }
    }
  }
  return out;
}

/** A fair-weather cloud: puffs along a flat base, in pixels. */
type Cloud = { base: number; puffs: { x: number; y: number; r: number }[] };

/** THE SKY behind the mountain — a clear blue, deep overhead and pale at
 * the skyline, with a few fair-weather clouds dealt off the seed —
 * composited UNDER everything already painted, so a crown against the sky
 * keeps its soft edge and a cloud may stand behind a peak. */
function paintSky(rgba: Uint8ClampedArray, depth: Float32Array, px: number, seed: number): void {
  // The skyline's mean row: where the blue has paled to the horizon's.
  let horizon = 0;
  for (let c = 0; c < px; c++) {
    let r = 0;
    while (r < px && Number.isNaN(depth[r * px + c])) r++;
    horizon += r;
  }
  horizon = Math.max(1, horizon / px);
  const clouds = dealClouds(px, horizon, seed);
  for (let r = 0; r < px; r++) {
    const air = mix(SKY_TOP, SKY_LOW, clamp01(r / horizon) ** 0.9);
    for (let c = 0; c < px; c++) {
      const k = (r * px + c) * 4;
      const a = rgba[k + 3] / 255;
      if (a >= 1) continue;
      let sky = air;
      for (const cloud of clouds) {
        const [cover, lit] = cloudAt(cloud, c + 0.5, r + 0.5);
        if (cover > 0) sky = mix(sky, mix(CLOUD_SHADE, CLOUD_LIT, lit), cover);
      }
      rgba[k] = rgba[k] * a + sky[0] * (1 - a);
      rgba[k + 1] = rgba[k + 1] * a + sky[1] * (1 - a);
      rgba[k + 2] = rgba[k + 2] * a + sky[2] * (1 - a);
      rgba[k + 3] = 255;
    }
  }
}

/** Three to five clouds over the upper sky, each a row of puffs over a
 * flat base, wider than tall. */
function dealClouds(px: number, horizon: number, seed: number): Cloud[] {
  const out: Cloud[] = [];
  const n = 3 + Math.floor(hash(1, 0, seed) * 3);
  for (let i = 0; i < n; i++) {
    // Sized to the sky there is, and its crown kept inside the picture.
    const w = Math.min(px * (0.12 + 0.16 * hash(i, 1, seed)), horizon * 1.1);
    const cx = px * (0.06 + 0.88 * ((i + hash(i, 2, seed)) / n));
    const tallest = w * 0.27 * 1.55 + px * 0.015;
    const base = Math.max(tallest, horizon * (0.3 + 0.5 * hash(i, 3, seed)));
    const count = 5 + Math.floor(hash(i, 4, seed) * 4);
    const puffs: Cloud["puffs"] = [];
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) / count - 0.5;
      // Taller in the middle, low at the ends: a cumulus's dome.
      const r = w * (0.1 + 0.12 * (1 - Math.abs(u) * 1.6) + 0.05 * hash(i, 10 + j, seed));
      puffs.push({ x: cx + u * w, y: base - r * 0.55, r });
    }
    out.push({ base, puffs });
  }
  return out;
}

/** How much of a pixel a cloud covers, 0..1, and how lit it is there, 0..1:
 * the sun on its crown and its upper left, its flat base in shadow. */
function cloudAt(cloud: Cloud, x: number, y: number): [number, number] {
  if (y > cloud.base + 1.5) return [0, 0];
  let cover = 0;
  let height = 0;
  for (const p of cloud.puffs) {
    const d = Math.hypot(x - p.x, y - p.y);
    const t = clamp01(p.r + 0.75 - d);
    if (t > cover) {
      cover = t;
      height = clamp01(((p.y - y) / p.r) * 0.5 + 0.5 + ((p.x - x) / p.r) * 0.2);
    }
  }
  cover *= clamp01(cloud.base + 1.5 - y) * 0.92;
  return [cover, clamp01(0.3 + height * 0.8)];
}

/** The colour of the ground at a point, `grad` its height and slope. */
function groundColour(
  level: PanoramaLevel,
  x: number,
  z: number,
  grad: Float64Array,
  packed: number,
): RGB {
  const gx = grad[1];
  const gz = grad[2];
  const nx = -gx * SHADE_RELIEF;
  const nz = -gz * SHADE_RELIEF;
  const lit = clamp01((nx * LIGHT[0] + LIGHT[1] + nz * LIGHT[2]) / Math.hypot(nx, 1, nz));
  let c = mix(SNOW_SHADE, SNOW_LIT, lit * lit * (3 - 2 * lit));
  if (packed > 0.35) {
    // The groomed snow: lifted out of the shadow, the cleanest white there is.
    c = mix(c, mix(PISTE, SNOW_LIT, 1 - lit), clamp01((packed - 0.35) * 2) * 0.6);
  } else {
    const ny = 1 / Math.hypot(gx, 1, gz);
    const rock = clamp01((ROCK_NY - ny) / ROCK_BAND);
    // Snow caught on the ledges, streaked down the fall line.
    if (rock > 0 && hash(Math.floor(x / 5), Math.floor(z / 14), level.seed) > 0.3) {
      c = mix(c, mix(ROCK_SHADE, ROCK_LIT, lit), rock * 0.9);
    }
  }
  return mix(c, HAZE, HAZE_FAR * clamp01(1 - z / level.size));
}

/** Blend a colour into a pixel the ground there does not stand in front of
 * — and, given the `groomed` mask, that is not groomed snow. */
function stamp(
  rgba: Uint8ClampedArray,
  depth: Float32Array,
  groomed: Uint8Array | null,
  px: number,
  col: number,
  row: number,
  z: number,
  c: RGB,
  a: number,
): void {
  if (col < 0 || row < 0 || col >= px || row >= px || a <= 0) return;
  const i = row * px + col;
  // A tree hides behind the ground nearer the viewer than it (a larger z)
  // and stands in front of the rest; a pixel's span of z is the slack.
  if (depth[i] > z + 12 || groomed?.[i]) return;
  const k = i * 4;
  if (rgba[k + 3] === 0) {
    // Over nothing (a crown against the sky): the paint itself, as opaque
    // as the stroke.
    rgba[k] = c[0];
    rgba[k + 1] = c[1];
    rgba[k + 2] = c[2];
    rgba[k + 3] = a * 255;
    return;
  }
  rgba[k] += (c[0] - rgba[k]) * a;
  rgba[k + 1] += (c[1] - rgba[k + 1]) * a;
  rgba[k + 2] += (c[2] - rgba[k + 2]) * a;
  rgba[k + 3] = Math.max(rgba[k + 3], a * 255);
}

/** Every tree, far ones first: a small conifer with snow on its lit
 * shoulder, or a bare broadleaf, stood on the ground it grows from. */
function paintTrees(
  level: PanoramaLevel,
  v: PanoramaView,
  rgba: Uint8ClampedArray,
  depth: Float32Array,
  groomed: Uint8Array,
): void {
  const px = v.px;
  const order = level.trees.map((_, i) => i).sort((a, b) => level.trees[a].z - level.trees[b].z);
  for (const n of order) {
    const t = level.trees[n];
    const [c0, r0] = panoramaPixel(v, t.x, t.y, t.z);
    if (c0 < -4 || c0 > px + 4 || r0 < 0 || r0 > px + 10) continue;
    const haze = HAZE_FAR * clamp01(1 - t.z / level.size);
    const h = Math.min(10, Math.max(1.6, t.height * v.scale * TREE_LIFT));
    const bare = t.kind !== undefined && (BARE_KINDS.has(t.kind) || t.kind === "snag");
    const ci = Math.round(c0);
    if (bare) {
      const stalk = mix(BARE, HAZE, haze);
      for (let k = 0; k < h; k++)
        stamp(rgba, depth, groomed, px, ci, Math.round(r0 - k), t.z, stalk, 0.7);
      const crown = Math.max(1, h * 0.25);
      for (let k = Math.floor(h * 0.4); k < h; k++) {
        for (let d = -crown; d <= crown; d++) {
          stamp(rgba, depth, groomed, px, ci + Math.round(d), Math.round(r0 - k), t.z, stalk, 0.22);
        }
      }
      continue;
    }
    const lit = mix(TREE_LIT, HAZE, haze);
    const shade = mix(TREE_SHADE, HAZE, haze);
    const snow = mix(TREE_SNOW, HAZE, haze);
    const half = Math.max(0.7, h * 0.24);
    for (let k = 0; k < h; k++) {
      const w = half * (1 - k / h) + 0.35;
      const row = Math.round(r0 - k);
      for (let d = Math.floor(-w); d <= Math.ceil(w); d++) {
        const a = clamp01(w + 0.5 - Math.abs(d));
        const left = d < 0 || (d === 0 && c0 - ci < 0);
        let c = left ? lit : shade;
        if (left && k % 3 === 1 && hash(n, k, level.seed) > 0.45) c = snow;
        stamp(rgba, depth, groomed, px, ci + d, row, t.z, c, a);
      }
    }
  }
}

/** The village on the valley floor: a cluster of snow-roofed chalets. */
function paintVillage(
  level: PanoramaLevel,
  v: PanoramaView,
  rgba: Uint8ClampedArray,
  depth: Float32Array,
): void {
  const village = level.resort?.village;
  if (!village) return;
  const px = v.px;
  const houses: { x: number; z: number }[] = [];
  for (let n = 0; n < 28; n++) {
    houses.push({
      x: village.x + (hash(n, 1, level.seed) - 0.5) * 340,
      z: Math.min(level.size - 4, village.z - 40 + hash(n, 2, level.seed) * 60),
    });
  }
  houses.sort((a, b) => a.z - b.z);
  const w = Math.max(2, Math.round(14 * v.scale * 1.4));
  for (const hs of houses) {
    const y = sampleField(level.ground, hs.x, hs.z);
    const [c0, r0] = panoramaPixel(v, hs.x, y, hs.z);
    const ci = Math.round(c0);
    const ri = Math.round(r0);
    const tall = Math.max(2, Math.round(w * 0.6));
    for (let d = 0; d < w; d++) {
      for (let k = 0; k < tall; k++) {
        const c = d < w / 2 ? WALL_LIT : WALL_SHADE;
        stamp(rgba, depth, null, px, ci - (w >> 1) + d, ri - k, hs.z + 20, c, 1);
      }
      // The roof: a snowed gable over the walls.
      const peak = Math.round((1 - Math.abs((d + 0.5) / w - 0.5) * 2) * (w * 0.35));
      for (let k = 0; k <= peak; k++) {
        stamp(rgba, depth, null, px, ci - (w >> 1) + d, ri - tall - k, hs.z + 20, ROOF, 1);
      }
    }
  }
}

// ── The schematic laid over it ──────────────────────────────────────────

/** A run as the picture draws it: its stretches seen and hidden as two SVG
 * paths, and where its number goes (null: nowhere it is seen). */
export type PanoramaRun = {
  id: string;
  /** The number it is signed with (`runNumber`) — what its badge reads. */
  number: string;
  /** A piste, a lane, or a SKI ROUTE (R42). */
  kind: RunKind | "route";
  grade: RunGrade;
  /** One of the runs the course this map is raced on follows. */
  raced: boolean;
  seen: string;
  hidden: string;
  badge: [number, number] | null;
};

export type PanoramaLift = {
  id: string;
  kind: "gondola" | "chair" | "drag";
  from: [number, number];
  to: [number, number];
};

/** A mark at a point, pointing a way: an SVG `rotate` in degrees. */
export type PanoramaMark = { id: string; x: number; y: number; angle: number; onTrack: boolean };

/** Everything drawn over the picture, in `PANORAMA_VIEW` units. */
export type PanoramaSchematic = {
  runs: PanoramaRun[];
  lifts: PanoramaLift[];
  kickers: PanoramaMark[];
  /** Every house seen from the valley (`cabinsOf`), at its foot. */
  houses: ChartHouse[];
  /** The start line's first slot, and the finish line; null where hidden. */
  start: PanoramaMark | null;
  finish: [number, number] | null;
};

/** How many of a run's 2 m stations go into its drawn line. */
const RUN_STRIDE = 4;

/** Whether a point on the ground is seen: no ground in the picture there
 * nearer the viewer than it, within a pixel's span either way. */
function seenIn(v: PanoramaView, depth: Float32Array, x: number, y: number, z: number): boolean {
  const [c, r] = panoramaPixel(v, x, y, z);
  const ci = Math.floor(c);
  const ri = Math.floor(r);
  if (ci < 0 || ci >= v.px || ri < 0 || ri >= v.px) return false;
  const slack = 3 / (v.scale * Math.sin(v.tilt)) + 4;
  for (let k = -1; k <= 1; k++) {
    const rr = ri + k;
    if (rr < 0 || rr >= v.px) continue;
    if (!(depth[rr * v.px + ci] > z + slack)) return true;
  }
  return false;
}

const f1 = (n: number): string => n.toFixed(1);

/** An SVG path built a segment at a time, a segment that starts where the
 * last one ended carrying the line on rather than lifting the pen. */
function pathOf(): { add(a: [number, number], b: [number, number]): void; d(): string } {
  const parts: string[] = [];
  let end: [number, number] | null = null;
  return {
    add(a, b) {
      if (end !== a) parts.push(`M${f1(a[0])} ${f1(a[1])}`);
      parts.push(`L${f1(b[0])} ${f1(b[1])}`);
      end = b;
    },
    d: () => parts.join(" "),
  };
}

/** The SVG `rotate` of a mark drawn pointing up, set the way a heading
 * (clockwise from above, 0 along +z) points in the picture. */
function angleIn(v: PanoramaView, x: number, y: number, z: number, heading: number): number {
  const [ax, ay] = panoramaPixel(v, x, y, z);
  const [bx, by] = panoramaPixel(v, x + Math.sin(heading) * 10, y, z + Math.cos(heading) * 10);
  return (Math.atan2(bx - ax, -(by - ay)) * 180) / Math.PI;
}

/** THE SCHEMATIC, cut against the painted picture's depth. */
export function panoramaSchematic(
  level: PanoramaLevel,
  v: PanoramaView,
  depth: Float32Array,
  spots: readonly HouseSpot[] = [],
): PanoramaSchematic {
  const resort = level.resort;
  const raced = new Set(resort?.courses.find((c) => c.id === resort.course)?.runs ?? []);
  const lines: { id: string; kind: RunKind | "route"; grade: RunGrade; points: TrackPoint[] }[] =
    resort
      ? resort.runs.map((r) => ({ id: r.id, kind: r.kind, grade: r.grade, points: r.points }))
      : [{ id: "1", kind: "piste", grade: gradeOf(level), points: level.track.points }];
  for (const r of skiRoutesOf(level)) {
    lines.push({ id: r.id, kind: "route", grade: r.grade, points: r.points });
  }
  const badges: [number, number][] = [];
  const numbers = runNumbers(level as Level);
  const runs = lines.map((run): PanoramaRun => {
    const pts = run.points;
    const picked: number[] = [];
    for (let i = 0; i < pts.length; i += RUN_STRIDE) picked.push(i);
    if (picked.at(-1) !== pts.length - 1) picked.push(pts.length - 1);
    const at = picked.map((i) => toPanorama(v, pts[i].x, pts[i].y, pts[i].z));
    const is = picked.map((i) => seenIn(v, depth, pts[i].x, pts[i].y, pts[i].z));
    const seen = pathOf();
    const hidden = pathOf();
    for (let k = 1; k < at.length; k++) (is[k - 1] && is[k] ? seen : hidden).add(at[k - 1], at[k]);
    // The number goes where the run is first seen a little way down it,
    // clear of any number already placed.
    let badge: [number, number] | null = null;
    const length = pts.at(-1)?.s ?? 0;
    for (let k = 0; k < at.length && run.kind !== "road"; k++) {
      if (!is[k] || pts[picked[k]].s < 0.1 * length) continue;
      if (badges.some((b) => Math.hypot(b[0] - at[k][0], b[1] - at[k][1]) < 6)) continue;
      badge = at[k];
      badges.push(badge);
      break;
    }
    return {
      id: run.id,
      number: resort ? (numbers.get(run.id) ?? run.id) : "1",
      kind: run.kind,
      grade: run.grade,
      raced: resort ? raced.has(run.id) : true,
      seen: seen.d(),
      hidden: hidden.d(),
      badge,
    };
  });
  const lifts = (resort?.lifts ?? []).map((l) => ({
    id: l.id,
    kind: l.kind,
    from: toPanorama(v, l.bottom.x, l.bottom.y, l.bottom.z),
    to: toPanorama(v, l.top.x, l.top.y, l.top.z),
  }));
  const kickers: PanoramaMark[] = [];
  for (const k of level.kickers) {
    const y = sampleField(level.ground, k.x, k.z);
    if (!seenIn(v, depth, k.x, y, k.z)) continue;
    const [x, yy] = toPanorama(v, k.x, y, k.z);
    kickers.push({
      id: k.id,
      x,
      y: yy,
      angle: angleIn(v, k.x, y, k.z, k.heading),
      onTrack: k.onTrack,
    });
  }
  const houses: ChartHouse[] = [];
  for (const h of spots) {
    const y = sampleField(level.ground, h.x, h.z);
    if (!seenIn(v, depth, h.x, y, h.z)) continue;
    const [x, yy] = toPanorama(v, h.x, y, h.z);
    houses.push({ id: h.id, x, y: yy, kind: h.kind });
  }
  const g = level.grid[0];
  const gy = sampleField(level.ground, g.x, g.z);
  const [sx, sy] = toPanorama(v, g.x, gy, g.z);
  const start = seenIn(v, depth, g.x, gy, g.z)
    ? { id: "start", x: sx, y: sy, angle: angleIn(v, g.x, gy, g.z, g.heading), onTrack: true }
    : null;
  const end = level.track.points[level.track.points.length - 1];
  const finish = seenIn(v, depth, end.x, end.y, end.z) ? toPanorama(v, end.x, end.y, end.z) : null;
  return { runs, lifts, kickers, houses, start, finish };
}

// ── A tap, and a spot ───────────────────────────────────────────────────

/** The pick grid: the world z behind each cell of a `PICK_PX` square laid
 * over the picture (NaN on the sky), sampled at each cell's centre. */
export function pickGrid(v: PanoramaView, depth: Float32Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(PICK_PX * PICK_PX);
  for (let j = 0; j < PICK_PX; j++) {
    const r = Math.min(v.px - 1, Math.floor(((j + 0.5) * v.px) / PICK_PX));
    for (let i = 0; i < PICK_PX; i++) {
      const c = Math.min(v.px - 1, Math.floor(((i + 0.5) * v.px) / PICK_PX));
      out[j * PICK_PX + i] = depth[r * v.px + c];
    }
  }
  return out;
}

/** A point of the schematic as a point on the snow — null on the sky. The
 * column fixes x; the pick grid holds the z the ground there is seen at. */
export function fromPanorama(
  v: PanoramaView,
  pick: Float32Array,
  vx: number,
  vy: number,
): { x: number; z: number } | null {
  const i = Math.floor((vx / PANORAMA_VIEW) * PICK_PX);
  const j = Math.floor((vy / PANORAMA_VIEW) * PICK_PX);
  if (i < 0 || j < 0 || i >= PICK_PX || j >= PICK_PX) return null;
  const z = pick[j * PICK_PX + i];
  if (Number.isNaN(z)) return null;
  const x = xOfColumn(v, (vx / PANORAMA_VIEW) * v.px);
  return { x: Math.min(v.size, Math.max(0, x)), z };
}

/** Where a spot on the snow is seen in the schematic — the cell down its
 * column whose ground is nearest it — or null where the view does not see
 * it (behind a ridge, or off the picture). */
export function spotInPanorama(
  v: PanoramaView,
  pick: Float32Array,
  x: number,
  z: number,
): [number, number] | null {
  const [c] = panoramaPixel(v, x, 0, z);
  const i = Math.floor((c / v.px) * PICK_PX);
  if (i < 0 || i >= PICK_PX) return null;
  let best = -1;
  let gap = Infinity;
  for (let j = 0; j < PICK_PX; j++) {
    const d = Math.abs(pick[j * PICK_PX + i] - z);
    if (d < gap) {
      gap = d;
      best = j;
    }
  }
  if (best < 0 || gap > 4 / (v.scale * Math.sin(v.tilt) * (PICK_PX / v.px))) return null;
  return [((i + 0.5) / PICK_PX) * PANORAMA_VIEW, ((best + 0.5) / PICK_PX) * PANORAMA_VIEW];
}
