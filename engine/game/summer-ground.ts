// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER GROUND — what a point of the mountain IS in midsummer, once the
// snow has gone: a meadow, a grazed pasture, a ski run's grass corridor and
// the bare scars graded into it, the krummholz under the tree line, alpine
// turf or heath above it, scree, rock, a snow patch left lying in July, a
// cat track's gravel, the village's streets, a bog, a lake, the forest floor.
// The kinds, their surfaces to a tyre and the rules that place them are
// `defs/summer-ground.ts`'s; the research is `docs/summer.md`.
//
// A PURE FUNCTION OF THE MAP. Everything here reads the map's own fields
// (its ground, its runs, its trees, its water, its streets, its mountain)
// and hashes of its seed on salts of its own — never `state.rng` — so it
// moves no digest, and the physics and the picture read ONE answer: the
// FIELD (`summerFieldOf`) is baked once a map on a 4 m grid and memoized,
// the renderer uploads the very same bytes as two textures, and
// `summerGroundAt` classifies a point off them. What is not baked (the
// slope, the tree line, a trunk, the water, a street) is the map's own and
// the shader reads it off the map's own grids.

import { clamp, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { noiseField, sampleNoise } from "@niclaslindstedt/oss-game-framework/core/noise";
import type { Level } from "../mapgen/types.ts";
import { regionOf } from "../mapgen/regions.ts";
import { inWater } from "../mapgen/real-water.ts";
import { bikeTreadAt } from "../mapgen/bike-park-query.ts";
import { onStreet } from "./village.ts";
import { treesNear } from "./upright-grid.ts";
import { hashOf } from "./rocks.ts";
import {
  KIND_SURFACE,
  SUMMER_GROUND,
  SURFACES,
  type SummerKind,
  type SummerSurface,
} from "./defs/summer-ground.ts";

const G = SUMMER_GROUND;
/** The summer ground's own salt: every noise here is keyed off the map's
 * seed and this, so no other stream sees it. */
const SALT = 0x5a3e;

/** THE SUMMER FIELD of a map: two RGBA byte grids of `cols` × `rows` cells
 * of `cell` m from the world's origin, each byte a share 0..255.
 * - `a`: R the SNOW PATCH, G the BARE SCAR, B the ROAD (a cat track's
 *   gravel), A the SCREE;
 * - `b`: R the PISTE (a run's grass corridor), G the SCRUB, B the BOG,
 *   A PAVED OR WATER (a street of the village, a lake) — where no grass
 *   grows.
 * The renderer uploads both as they are (`summer-glsl.ts`). */
export type SummerField = {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly a: Uint8Array;
  readonly b: Uint8Array;
};

const fields = new WeakMap<Level, SummerField>();

/** The map's tree line as a height in its own frame, m (Infinity on a map
 * that publishes no mountain). */
export function treeLineY(level: Level): number {
  const m = level.mountain;
  return m ? m.treeLine + m.sea : Infinity;
}

/** THE SUMMER FIELD of `level`, baked once and kept. */
export function summerFieldOf(level: Level): SummerField {
  let f = fields.get(level);
  if (!f) fields.set(level, (f = bake(level)));
  return f;
}

/** One channel of a field grid at (x, z), bilinear, 0..1. */
export function summerShareAt(
  field: SummerField,
  grid: "a" | "b",
  channel: 0 | 1 | 2 | 3,
  x: number,
  z: number,
): number {
  const data = field[grid];
  const gx = clamp(x / field.cell - 0.5, 0, field.cols - 1);
  const gz = clamp(z / field.cell - 0.5, 0, field.rows - 1);
  const ix = Math.min(field.cols - 2, Math.floor(gx));
  const iz = Math.min(field.rows - 2, Math.floor(gz));
  const fx = gx - ix;
  const fz = gz - iz;
  const i = (iz * field.cols + ix) * 4 + channel;
  const r = field.cols * 4;
  const top = data[i] + (data[i + 4] - data[i]) * fx;
  const bot = data[i + r] + (data[i + r + 4] - data[i + r]) * fx;
  return (top + (bot - top) * fz) / 255;
}

const scratch: number[] = [];

/** WHAT (x, z) IS in midsummer — the first of these that holds: water,
 * a street, a cat track, a snow patch, bare rock (past `slope.rock`, or a
 * wall's rock skin), scree, a run's grass (or a bare scar on it), the
 * forest floor (a trunk within `forest` m), and the open ground by its
 * height and slope: heath or turf above the tree line, a bog, scrub in the
 * krummholz band, pasture on the steep, a meadow; a scar off the runs is
 * dirt. */
export function summerGroundAt(level: Level, x: number, z: number): SummerKind {
  if (inWater(level.water, x, z)) return "water";
  if (level.resort && onStreet(level, x, z)) return "street";
  if (level.bikePark) {
    const tread = bikeTreadAt(level, x, z);
    if (tread) return tread === "shoulder" ? "dirt" : tread;
  }
  const f = summerFieldOf(level);
  if (summerShareAt(f, "a", 2, x, z) > 0.5) return "road";
  if (summerShareAt(f, "a", 0, x, z) > 0.5) return "snow";
  const deg = slopeDeg(level, x, z);
  if (deg > G.slope.rock || (level.bareRockAt && level.bareRockAt(x, z) > 0.5)) return "rock";
  if (summerShareAt(f, "a", 3, x, z) > 0.5) return "scree";
  const scar = summerShareAt(f, "a", 1, x, z) > 0.5;
  if (summerShareAt(f, "b", 0, x, z) > 0.5) return scar ? "dirt" : "piste";
  if (scar) return "dirt";
  if (treesNear(level, x, z, G.forest, scratch).length > 0) return "forest";
  const y = level.groundAt(x, z);
  const line = treeLineY(level);
  if (y > line) {
    const wet = regionOf(level).id === "fell" || regionOf(level).id === "maritime";
    return wet ? "heath" : "turf";
  }
  if (summerShareAt(f, "b", 2, x, z) > 0.5) return "bog";
  if (summerShareAt(f, "b", 1, x, z) > 0.5) return "scrub";
  if (deg >= G.slope.pasture.from && deg <= G.slope.pasture.to) return "pasture";
  return "meadow";
}

/** WHAT (x, z) IS TO A TYRE in midsummer: its kind's surface. */
export function summerSurfaceAt(level: Level, x: number, z: number): SummerSurface {
  return SURFACES[KIND_SURFACE[summerGroundAt(level, x, z)]];
}

const normal = { x: 0, y: 1, z: 0 };

function slopeDeg(level: Level, x: number, z: number): number {
  level.normalAt(x, z, normal);
  return (Math.acos(clamp(normal.y, -1, 1)) * 180) / Math.PI;
}

/** The value at which `share` of `values` (the first `n`) lie above, read
 * off a histogram — an exact quantile is a sort of a million cells. */
function quantile(values: Float32Array, n: number, share: number): number {
  if (n === 0 || share <= 0) return Infinity;
  let hi = 0;
  for (let i = 0; i < n; i++) if (values[i] > hi) hi = values[i];
  if (hi <= 0) return Infinity;
  const BINS = 2048;
  const hist = new Uint32Array(BINS);
  for (let i = 0; i < n; i++) hist[Math.min(BINS - 1, Math.floor((values[i] / hi) * BINS))]++;
  const want = share * n;
  let above = 0;
  for (let b = BINS - 1; b >= 0; b--) {
    above += hist[b];
    if (above >= want) return (b / BINS) * hi;
  }
  return 0;
}

const toByte = (v: number): number => Math.round(clamp(v, 0, 1) * 255);

/** Stamp a disc of radius `r` (soft over one cell) into channel `ch` of
 * grid `out`, keeping the larger share. */
function stampDisc(
  out: Uint8Array,
  cols: number,
  rows: number,
  cell: number,
  ch: number,
  x: number,
  z: number,
  r: number,
): void {
  const reach = r + cell;
  const c0 = Math.max(0, Math.floor((x - reach) / cell));
  const c1 = Math.min(cols - 1, Math.floor((x + reach) / cell));
  const r0 = Math.max(0, Math.floor((z - reach) / cell));
  const r1 = Math.min(rows - 1, Math.floor((z + reach) / cell));
  for (let j = r0; j <= r1; j++) {
    const cz = (j + 0.5) * cell - z;
    for (let i = c0; i <= c1; i++) {
      const cx = (i + 0.5) * cell - x;
      const d = Math.sqrt(cx * cx + cz * cz);
      const v = toByte((r + cell / 2 - d) / cell);
      const k = (j * cols + i) * 4 + ch;
      if (v > out[k]) out[k] = v;
    }
  }
}

function bake(level: Level): SummerField {
  const cell = G.cell;
  const cols = Math.max(2, Math.ceil(level.size / cell));
  const rows = cols;
  const n = cols * rows;
  const a = new Uint8Array(n * 4);
  const b = new Uint8Array(n * 4);
  const region = regionOf(level).id;
  const seed = level.seed | 0;
  const key = (k: number): number => hashOf(seed, SALT, k) & 0x7fffffff;

  // The ground at every cell's middle, and its slope off the neighbours.
  const h = new Float32Array(n);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++)
      h[j * cols + i] = level.groundAt((i + 0.5) * cell, (j + 0.5) * cell);
  }
  const at = (i: number, j: number): number =>
    h[clamp(j, 0, rows - 1) * cols + clamp(i, 0, cols - 1)];

  // THE RUNS: every piste's corridor and every cat track, at their widths.
  const runs = level.resort?.runs ?? [];
  // A winter road is a lane graded across the hill: in summer its corridor
  // is a run's grass and only its tread the gravel of a cat track.
  for (const run of runs) {
    for (const p of run.points) {
      stampDisc(b, cols, rows, cell, 0, p.x, p.z, p.width / 2);
      if (run.kind === "road") {
        stampDisc(a, cols, rows, cell, 2, p.x, p.z, Math.min(p.width, G.road) / 2);
      }
    }
  }
  // A BIKE PARK's trails (R44, R45) are bare tread: stamped as a track so
  // no grass grows on them or their inner shoulders (the trails are drawn
  // over it by the renderer at their own width).
  for (const t of level.bikePark?.trails ?? []) {
    for (let k = 0; k < t.points.length; k += 2) {
      const p = t.points[k];
      stampDisc(a, cols, rows, cell, 2, p.x, p.z, p.width / 2 + 1.5);
    }
  }
  const pisted = runs.some((r) => r.kind === "piste");
  const village = level.resort !== undefined;

  const line = treeLineY(level);
  const m = level.mountain;
  const lowY = m ? m.base.y : 0;
  const highY = m ? Math.max(m.summit.y, lowY + 1) : 1;
  const facing = level.sun.facing ?? 0;

  const snowA = noiseField(G.snow.scales[0], key(1));
  const snowB = noiseField(G.snow.scales[1], key(2));
  const scarN = noiseField(G.scar.scale, key(3));
  const screeN = noiseField(G.scree.scale, key(4));
  const scrubN = noiseField(18, key(5));
  const bogN = noiseField(30, key(6));

  const snowW = new Float32Array(n);
  const scarW = new Float32Array(n);
  const reach = Math.max(1, Math.round(G.snow.reach / cell));
  const wet = region === "fell" || region === "maritime";
  const screeK = region === "continental" ? G.scree.continental : 1;
  // Candidate cells for each share's quantile, by index.
  const high: number[] = [];
  const pisteLow: number[] = [];
  const pisteHigh: number[] = [];
  const wild: number[] = [];

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const x = (i + 0.5) * cell;
      const z = (j + 0.5) * cell;
      const y = h[k];
      const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * cell);
      const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * cell);
      const grade = Math.sqrt(gx * gx + gz * gz);
      const deg = (Math.atan(grade) * 180) / Math.PI;
      const above = y > line;
      const piste = (pisted ? b[k * 4] : level.packedAt(x, z) > 0.5 ? 255 : 0) / 255;
      if (inWater(level.water, x, z) || (village && onStreet(level, x, z))) b[k * 4 + 3] = 255;
      if (!pisted) b[k * 4] = toByte(piste);

      // THE SNOW PATCHES: high, turned from the sun, in a hollow, scalloped.
      if (above) {
        high.push(k);
        const rel = (y - lowY) / (highY - lowY);
        const top = smoothstep(1 - G.snow.top, 1 - G.snow.top + 0.1, rel);
        // Downhill's compass bearing: north-facing ground holds its snow.
        const north = grade > 1e-3 ? Math.cos(Math.atan2(-gx, -gz) + facing) : 0;
        const aspect = 0.25 + 0.75 * (0.5 + 0.5 * north * smoothstep(0, 0.2, grade));
        const lap =
          (at(i - reach, j) + at(i + reach, j) + at(i, j - reach) + at(i, j + reach)) / 4 - y;
        const hollow = 1 + (G.snow.concave - 1) * smoothstep(-0.5, 1.5, lap);
        const steep = 1 - smoothstep(38, G.slope.rock, deg);
        const scallop = 0.65 * sampleNoise(snowA, x, z) + 0.35 * sampleNoise(snowB, x, z);
        snowW[k] = top * aspect * hollow * steep * (0.15 + scallop * scallop * 2);
      }

      // THE BARE SCARS: on a run, steeper the likelier; and a little off.
      const scarV = sampleNoise(scarN, x, z) * (0.7 + 0.3 * smoothstep(10, 30, deg));
      scarW[k] = scarV;
      if (piste > 0.5) (above ? pisteHigh : pisteLow).push(k);
      else if (!above && deg > 20) wild.push(k);

      // THE SCREE: above the tree line, on its slope band, in patches.
      if (above) {
        const band =
          smoothstep(G.slope.scree.from - 3, G.slope.scree.from + 2, deg) *
          (1 - smoothstep(G.slope.scree.to, G.slope.scree.to + 6, deg));
        const v = band * sampleNoise(screeN, x, z) * screeK;
        a[k * 4 + 3] = toByte((v - 0.45) / 0.1);
      }

      // THE SCRUB: krummholz patches in the band under the tree line.
      if (!above && y > line - G.scrub.band) {
        const under = smoothstep(line - G.scrub.band, line - G.scrub.band * 0.4, y);
        const v = sampleNoise(scrubN, x, z) * under;
        b[k * 4 + 1] = toByte((v - (1 - G.scrub.share) * 0.85) / 0.06);
      }

      // THE BOG: the flat wet ground of the fell and the maritime.
      if (wet && deg < G.slope.bog && piste < 0.5) {
        const v = sampleNoise(bogN, x, z) * (1 - deg / G.slope.bog);
        b[k * 4 + 2] = toByte((v - 0.55) / 0.08);
      }
    }
  }

  // The snow's share of the high ground is the region's cover.
  const snowCut = pick(snowW, high, G.snow.cover[region]);
  for (const k of high) a[k * 4] = toByte((snowW[k] - snowCut) / Math.max(1e-6, snowCut * 0.25));
  const cutLow = pick(scarW, pisteLow, G.scar.below);
  const cutHigh = pick(scarW, pisteHigh, G.scar.above);
  const cutWild = pick(scarW, wild, G.scar.wild * 4);
  for (const k of pisteLow) a[k * 4 + 1] = toByte((scarW[k] - cutLow) / 0.03);
  for (const k of pisteHigh) a[k * 4 + 1] = toByte((scarW[k] - cutHigh) / 0.03);
  for (const k of wild) a[k * 4 + 1] = toByte((scarW[k] - cutWild) / 0.03);
  return { cols, rows, cell, a, b };
}

/** The cut above which `share` of the cells `idx` lie in `w`. */
function pick(w: Float32Array, idx: readonly number[], share: number): number {
  const vals = new Float32Array(idx.length);
  for (let i = 0; i < idx.length; i++) vals[i] = w[idx[i]];
  return quantile(vals, vals.length, share);
}
