// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MINIMAP'S GROUND — the whole map painted ONCE into a raster, the way
// the level lab draws it (`scripts/lib/level-draw.mjs`): snow shaded by
// height and hillshaded from the north-west, a contour every ten metres and
// a heavier one every fifty, the packed snow of the track in the groomer's
// grey, and every tree a dark dot its crown's size.
//
// ONCE PER MAP, AND OFF THE THREAD THE SNOW IS DRAWN ON. Nothing on the
// ground changes during a race — the trails are the snow's, not the map's —
// so the HUD never paints the country at all: it moves one picture about
// (`minimap.tsx`). The bake is a million samples of the heightfield, which
// is why `minimap-worker.ts` runs it; this module is DOM-free and takes
// plain data (`MinimapSource`) so the worker and the tests can both call it.
//
// Pixel (i, j) is the cell centred on world x = (i + ½)·size/px,
// z = (j + ½)·size/px — row j runs along +z — so the picture laid at
// (0, 0, size, size) in world metres is the map, unrotated.

import { sampleField, sampleFieldGradient, type Heightfield, type Level } from "@engine";

/** How many pixels across the map is baked at. 1.6 km at 1024 is a pixel
 * every 1.6 m — the minimap's closest window is two hundred-odd metres
 * across a plate a couple of hundred device pixels wide, so the picture is
 * never magnified much past its own grain, and the track, the checkpoints
 * and the skiers are drawn over it as vectors anyway. */
export const MAP_PX = 1024;

/** How the picture is encoded for the `<image>` that shows it. A JPEG: the
 * ground is a smooth shaded field with no transparency, and a PNG of it
 * took ten times as long to encode for a picture the eye cannot tell
 * apart at the plate's size. */
export const MAP_TYPE = "image/jpeg";
export const MAP_QUALITY = 0.9;

/** Everything the bake reads, as plain data a worker can be posted. */
export type MinimapSource = {
  size: number;
  ground: Heightfield;
  packed: Heightfield | null;
  /** Every tree as (x, z, crown radius) triples, m. */
  trees: Float32Array;
};

export function minimapSource(level: Level): MinimapSource {
  const trees = new Float32Array(level.trees.length * 3);
  level.trees.forEach((t, i) => {
    trees[i * 3] = t.x;
    trees[i * 3 + 1] = t.z;
    trees[i * 3 + 2] = t.crown;
  });
  return { size: level.size, ground: level.ground, packed: level.packed ?? null, trees };
}

/** The map's paint, sRGB 0..255. A cool blue-grey in the hollows to white on
 * the tops — the snow as a chart reads it, not as the shader lights it. */
const SNOW_LOW = [176, 196, 218];
const SNOW_HIGH = [250, 251, 255];
/** The groomed piste: a warm grey that no height of snow is, so the piste
 * reads through every shade the hills put on it. */
const PACKED = [150, 146, 150];
const CONTOUR = [70, 98, 136];
const TREE = [30, 70, 52];

/** Contour spacing, m, and every how many of them is drawn heavier. */
const CONTOUR_STEP = 10;
const CONTOUR_MAJOR = 5;

/** The light the hills are shaded by: from the north-west and forty degrees
 * up, the cartographer's convention (engine x, z; +z is north on the chart).
 * `SHADE` is how dark a face turned fully away gets, as a share. */
const LIGHT = normalise([-0.55, 0.9, 0.55]);
const SHADE = 0.42;
/** Relief exaggeration for the shading, so a rolling face still reads. */
const RELIEF = 2.2;

function normalise(v: number[]): number[] {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Paint the map. Returns `px × px` RGBA, row-major, row j along +z. */
export function bakeMinimap(
  src: MinimapSource,
  px: number = MAP_PX,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(px * px * 4);
  const step = src.size / px;
  const heights = new Float32Array(px * px);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < px; j++) {
    const z = (j + 0.5) * step;
    for (let i = 0; i < px; i++) {
      const h = sampleField(src.ground, (i + 0.5) * step, z);
      heights[j * px + i] = h;
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  const range = Math.max(1, hi - lo);
  const grad = new Float64Array(3);
  for (let j = 0; j < px; j++) {
    const z = (j + 0.5) * step;
    for (let i = 0; i < px; i++) {
      const x = (i + 0.5) * step;
      const k = j * px + i;
      const h = heights[k];
      sampleFieldGradient(src.ground, x, z, grad);
      // The surface normal of y = h(x, z), exaggerated, against the light.
      const nx = -grad[1] * RELIEF;
      const nz = -grad[2] * RELIEF;
      const lit = (nx * LIGHT[0] + LIGHT[1] + nz * LIGHT[2]) / Math.hypot(nx, 1, nz);
      const shade = 1 - SHADE + SHADE * Math.max(0, lit);
      const t = (h - lo) / range;
      let r = (SNOW_LOW[0] + (SNOW_HIGH[0] - SNOW_LOW[0]) * t) * shade;
      let g = (SNOW_LOW[1] + (SNOW_HIGH[1] - SNOW_LOW[1]) * t) * shade;
      let b = (SNOW_LOW[2] + (SNOW_HIGH[2] - SNOW_LOW[2]) * t) * shade;
      // A contour where this pixel and the next one over, or the one below,
      // stand in different bands — a line one pixel wide wherever it runs.
      const band = Math.floor(h / CONTOUR_STEP);
      const right = i + 1 < px ? Math.floor(heights[k + 1] / CONTOUR_STEP) : band;
      const below = j + 1 < px ? Math.floor(heights[k + px] / CONTOUR_STEP) : band;
      if (right !== band || below !== band) {
        const top = Math.max(band, right, below);
        const a = top % CONTOUR_MAJOR === 0 ? 0.5 : 0.22;
        r += (CONTOUR[0] - r) * a;
        g += (CONTOUR[1] - g) * a;
        b += (CONTOUR[2] - b) * a;
      }
      const p = src.packed ? sampleField(src.packed, x, z) : 0;
      if (p > 0.05) {
        const a = Math.min(1, p) * 0.85;
        r += (PACKED[0] * shade - r) * a;
        g += (PACKED[1] * shade - g) * a;
        b += (PACKED[2] * shade - b) * a;
      }
      out[k * 4] = r;
      out[k * 4 + 1] = g;
      out[k * 4 + 2] = b;
      out[k * 4 + 3] = 255;
    }
  }
  stampTrees(out, px, step, src.trees);
  return out;
}

/** Every tree, as a disc its crown's size — at least a pixel, so a sapling
 * is still a mark — blended over the snow so a wood reads as a density
 * rather than as a black blot. */
function stampTrees(out: Uint8ClampedArray, px: number, step: number, trees: Float32Array): void {
  for (let n = 0; n < trees.length; n += 3) {
    const cx = trees[n] / step - 0.5;
    const cz = trees[n + 1] / step - 0.5;
    const r = Math.max(0.7, (trees[n + 2] * 0.8) / step);
    const i0 = Math.max(0, Math.floor(cx - r));
    const i1 = Math.min(px - 1, Math.ceil(cx + r));
    const j0 = Math.max(0, Math.floor(cz - r));
    const j1 = Math.min(px - 1, Math.ceil(cz + r));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i - cx, j - cz);
        // Soft by half a pixel at the rim, so a dot is round at any size.
        const a = 0.78 * Math.min(1, Math.max(0, r + 0.5 - d));
        if (a <= 0) continue;
        const k = (j * px + i) * 4;
        out[k] += (TREE[0] - out[k]) * a;
        out[k + 1] += (TREE[1] - out[k + 1]) * a;
        out[k + 2] += (TREE[2] - out[k + 2]) * a;
      }
    }
  }
}
