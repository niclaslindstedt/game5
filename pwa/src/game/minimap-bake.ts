// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MINIMAP'S GROUND — the whole map painted ONCE into a raster, the way
// the level lab draws it (`scripts/lib/level-draw.mjs`): snow shaded by
// height and hillshaded from the upper left, a contour every ten metres and
// a heavier one every fifty, ROCK where a face is too steep to hold snow (the
// region's own rock and slopes, `region-look.ts`, as the snow shader shows
// it), the packed snow of the track in the groomer's grey, the WOODS as a
// green mass over the ground they stand on, and every tree a dark dot its
// crown's size inside it, the village's STREETS (`villageOf`), and every
// CABIN (`cabinsOf`) as a roof the way a piste map marks a building — the
// country a skier reads off the plate, not only the runs drawn over it.
//
// ONCE PER MAP, AND OFF THE THREAD THE SNOW IS DRAWN ON. Nothing on the
// ground changes during a race — the trails are the snow's, not the map's —
// so the HUD never paints the country at all: it moves one picture about
// (`minimap.tsx`). The bake is millions of samples of the heightfield,
// which is why `minimap-worker.ts` runs it; this module is DOM-free and takes
// plain data (`MinimapSource`) so the worker and the tests can both call it.
//
// Pixel (i, j) is the cell centred on world x = (i + ½)·size/px,
// z = (j + ½)·size/px — row j runs along +z — so the picture laid at
// (0, 0, size, size) in world metres is the map, unrotated.

import {
  CABINS,
  besidePoint,
  cabinsOf,
  felledTrees,
  regionOf,
  sampleField,
  sampleFieldGradient,
  sideReach,
  villageOf,
  type CabinKind,
  type Heightfield,
  type Level,
} from "@engine";

import { regionLookOf, type Tone } from "./region-look.ts";

/** How many metres of snow one pixel of the bake may cover, at most, and
 * the bake's floor and ceiling in pixels. The minimap's closest window is
 * two hundred-odd metres across a plate a couple of hundred CSS pixels wide
 * — a metre or so a device pixel — so a pixel every metre and a half is
 * never magnified much past its own grain; a whole ski area three
 * kilometres across is baked at 2048, and the ceiling keeps the picture a
 * size every phone decodes. */
const MAP_METRES_PER_PX = 1.5;
const MAP_PX_MIN = 1024;
const MAP_PX_MAX = 2048;

/** How many pixels across a map of `size` metres is baked at — a multiple
 * of 256 inside the floor and the ceiling. */
export function mapPxFor(size: number): number {
  const want = Math.ceil(size / MAP_METRES_PER_PX / 256) * 256;
  return Math.min(MAP_PX_MAX, Math.max(MAP_PX_MIN, want));
}

/** How a bake is encoded where it is shown as an `<image>` — the start
 * card's chart (`seed-preview.tsx`). A JPEG: the ground is a smooth shaded
 * field with no transparency, and a PNG of it took ten times as long to
 * encode for a picture the eye cannot tell apart at the plate's size. */
export const MAP_TYPE = "image/jpeg";
export const MAP_QUALITY = 0.9;

/** Everything the bake reads, as plain data a worker can be posted. */
export type MinimapSource = {
  size: number;
  ground: Heightfield;
  packed: Heightfield | null;
  /** Every tree as (x, z, crown radius) triples, m. */
  trees: Float32Array;
  /** The region's rock through the snow — its tone (sRGB 0..255) and the
   * slopes (m per m) it starts showing at and is whole at — or null where
   * the snow holds on every face. */
  rock: { tone: [number, number, number]; from: number; to: number } | null;
  /** A wood's colour as a mass, sRGB 0..255. */
  wood: [number, number, number];
  /** Every cabin's roof as (x, z, half its width, half its depth, heading,
   * ridge) sextuples, m and radians — the roof's own centre, its reach in;
   * the ridge 1 across its front, 2 front to back, 0 a lean-to's none. */
  cabins: Float32Array;
  /** The village's streets, square and car park as (ax, az, bx, bz, half
   * its width) quintuples, m — every piece of every street's line, out to
   * the back of its sidewalks; empty where the map has no village. */
  streets: Float32Array;
};

type Rgb = [number, number, number];

/** A region look's linear tone as the sRGB a chart is painted in, darkened
 * by `k` — rock on a chart is drawn a shade darker than it stands in the
 * light, so it never reads as the groomer's grey. */
function srgb(t: Tone, k = 1): Rgb {
  return [t[0], t[1], t[2]].map((c) => k * 255 * Math.pow(Math.max(0, c), 1 / 2.2)) as Rgb;
}

/** A wood on a piste map is a leaf green, never the near-black of its
 * needles in the shade: the region's needle lifted halfway to this. */
const CHART_LEAF: Rgb = [150, 205, 150];
const ROCK_DARKEN = 0.75;

function woodOf(needle: string): Rgb {
  const n = parseInt(needle.replace("#", ""), 16);
  const rgb: Rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return rgb.map((c, i) => c + (CHART_LEAF[i] - c) * 0.5) as Rgb;
}

export function minimapSource(level: Level): MinimapSource {
  const houses = cabinsOf(level);
  const gone = felledTrees(level);
  const trees = new Float32Array(level.trees.length * 3);
  level.trees.forEach((t, i) => {
    trees[i * 3] = t.x;
    trees[i * 3 + 1] = t.z;
    // A tree felled for the village or a building's site is no mark: no
    // crown.
    trees[i * 3 + 2] = gone[i] ? 0 : t.crown;
  });
  const look = regionLookOf(regionOf(level).id);
  const cabins = new Float32Array(houses.length * 6);
  houses.forEach((c, i) => {
    const d = CABINS[c.kind];
    // The roof's centre sits off the walls' by half the difference between
    // its reach to the front and to the back.
    const off = (d.reach.front - d.reach.back) / 2;
    cabins.set(
      [
        c.x + Math.sin(c.heading) * off,
        c.z + Math.cos(c.heading) * off,
        d.width / 2 + d.reach.side,
        d.depth / 2 + (d.reach.front + d.reach.back) / 2,
        c.heading,
        RIDGE[c.kind],
      ],
      i * 6,
    );
  });
  return {
    size: level.size,
    ground: level.ground,
    packed: level.packed ?? null,
    trees,
    rock: look.rock && {
      tone: srgb(look.rock.tone, ROCK_DARKEN),
      from: look.rock.from,
      to: look.rock.to,
    },
    wood: woodOf(look.needle),
    cabins,
    streets: streetsOf(level),
  };
}

/** The village's ground as the chart draws it (`MinimapSource.streets`). */
function streetsOf(level: Level): Float32Array {
  const v = villageOf(level);
  if (!v) return new Float32Array(0);
  const out: number[] = [];
  for (const st of v.streets) {
    const r0 = sideReach(st.section, 0);
    const r1 = sideReach(st.section, 1);
    // The line run down the middle of the whole width, off the
    // centreline by half the difference of its two sides.
    const lat = (r1 - r0) / 2;
    const half = (r0 + r1) / 2;
    for (let n = 1; n < st.points.length; n++) {
      const a = besidePoint(st.points[n - 1], lat);
      const b = besidePoint(st.points[n], lat);
      out.push(a.x, a.z, b.x, b.z, half);
    }
  }
  for (const a of v.areas) {
    const fx = Math.sin(a.heading);
    const fz = Math.cos(a.heading);
    out.push(
      a.x - fx * a.depth,
      a.z - fz * a.depth,
      a.x + fx * a.depth,
      a.z + fz * a.depth,
      a.half,
    );
  }
  return new Float32Array(out);
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
/** A cabin's roof on the chart: a dark timber brown under a rim darker
 * still, so it stands off the woods' green and the snow alike. */
const ROOF = [112, 66, 44];
/** A village street: a cool grey a shade darker than the piste's, so the
 * town reads as town under its roofs. */
const STREET = [128, 126, 134];
const ROOF_RIM = [52, 32, 24];
const ROOF_RIDGE = [214, 190, 170];
/** A roof is drawn this much larger than it stands, as a piste map marks a
 * building, and never less than `ROOF_LEAST` pixels from its centre to its
 * edge — a hut is a mark at any zoom. */
const ROOF_GROW = 1.5;
const ROOF_LEAST = 4.2;
/** Which way each kind's ridge runs (`MinimapSource.cabins`): a cabin's
 * along its front, a hut's and a chalet's gable to the front, a shed's
 * lean-to none, the afterski lodge's along its long front; the ski
 * area's own buildings' along their long fronts, the flat and mono-pitched
 * ones none. */
const RIDGE: Readonly<Record<CabinKind, number>> = {
  cabin: 1,
  hut: 2,
  chalet: 2,
  shed: 0,
  afterski: 1,
  restaurant: 1,
  ticket: 0,
  rental: 1,
  school: 1,
  firstAid: 1,
  hotel: 1,
  garage: 1,
  pumpHouse: 0,
  mountainHut: 1,
  patrol: 0,
  house: 2,
  apartments: 1,
  hall: 1,
  shop: 2,
  church: 2,
};
/** How strongly the woods' mass is laid over the snow at its thickest, and
 * how far round each tree it reaches, as a share of its crown — wide
 * enough that the trees of one clump run together into a wood, while a
 * lone tree is a faint ring round its dot. */
const WOOD_ALPHA = 0.62;
const WOOD_REACH = 3.4;

/** Contour spacing, m, and every how many of them is drawn heavier. */
const CONTOUR_STEP = 10;
const CONTOUR_MAJOR = 5;

/** The light the hills are shaded by (engine x, y, z, toward the light):
 * from −x and +z and forty degrees up — the upper left of a plate with +z up
 * the screen, which the heading-up minimap mostly is, skiing down the fall
 * line. A plate drawn the other way up hands its own (`seed-chart.ts`'s
 * `CHART_LIGHT`). `SHADE` is how dark a face turned fully away gets, as a
 * share. */
const LIGHT: readonly [number, number, number] = [-0.55, 0.9, 0.55];
const SHADE = 0.42;
/** Relief exaggeration for the shading, so a rolling face still reads. */
const RELIEF = 2.2;

function normalise(v: number[]): number[] {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Paint the map. Returns `px × px` RGBA, row-major, row j along +z. */
export function bakeMinimap(
  src: MinimapSource,
  px: number = mapPxFor(src.size),
  toward: readonly [number, number, number] = LIGHT,
): Uint8ClampedArray<ArrayBuffer> {
  const light = normalise([...toward]);
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
      const lit = (nx * light[0] + light[1] + nz * light[2]) / Math.hypot(nx, 1, nz);
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
      // Rock where the face is too steep to hold snow — never on the
      // groomer, which is snow by definition.
      const rock = src.rock
        ? smoothstep(src.rock.from, src.rock.to, Math.hypot(grad[1], grad[2])) *
          (1 - Math.min(1, p))
        : 0;
      if (rock > 0) {
        r += (src.rock!.tone[0] * shade - r) * rock;
        g += (src.rock!.tone[1] * shade - g) * rock;
        b += (src.rock!.tone[2] * shade - b) * rock;
      }
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
  stampWoods(out, px, step, src.trees, src.wood);
  stampTrees(out, px, step, src.trees);
  stampStreets(out, px, step, src.streets);
  stampCabins(out, px, step, src.cabins);
  return out;
}

/** THE WOODS AS A MASS: every tree's reach summed into a density over the
 * map, then the wood's colour laid over the ground by it — so a forest
 * reads as forest at any zoom, even where a single tree is smaller than a
 * pixel. */
function stampWoods(
  out: Uint8ClampedArray,
  px: number,
  step: number,
  trees: Float32Array,
  wood: readonly [number, number, number],
): void {
  const density = new Float32Array(px * px);
  for (let n = 0; n < trees.length; n += 3) {
    if (trees[n + 2] <= 0) continue;
    const cx = trees[n] / step - 0.5;
    const cz = trees[n + 1] / step - 0.5;
    const r = Math.max(1.5, (trees[n + 2] * WOOD_REACH) / step);
    const i0 = Math.max(0, Math.floor(cx - r));
    const i1 = Math.min(px - 1, Math.ceil(cx + r));
    const j0 = Math.max(0, Math.floor(cz - r));
    const j1 = Math.min(px - 1, Math.ceil(cz + r));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i - cx, j - cz) / r;
        if (d < 1) density[j * px + i] += 1 - d * d;
      }
    }
  }
  for (let k = 0; k < density.length; k++) {
    const dn = density[k];
    if (dn <= 0) continue;
    const a = WOOD_ALPHA * Math.min(1, dn);
    const o = k * 4;
    out[o] += (wood[0] - out[o]) * a;
    out[o + 1] += (wood[1] - out[o + 1]) * a;
    out[o + 2] += (wood[2] - out[o + 2]) * a;
  }
}

/** Every tree, as a disc its crown's size — at least a pixel, so a sapling
 * is still a mark — blended over the snow so a wood reads as a density
 * rather than as a black blot. */
function stampTrees(out: Uint8ClampedArray, px: number, step: number, trees: Float32Array): void {
  for (let n = 0; n < trees.length; n += 3) {
    if (trees[n + 2] <= 0) continue;
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

/** Every street as a band its width, soft by half a pixel at its edge and
 * never narrower than a pixel and a half, so a lane is a line at any
 * zoom. */
function stampStreets(
  out: Uint8ClampedArray,
  px: number,
  step: number,
  streets: Float32Array,
): void {
  const cover = new Float32Array(px * px);
  for (let n = 0; n < streets.length; n += 5) {
    const ax = streets[n] / step - 0.5;
    const az = streets[n + 1] / step - 0.5;
    const bx = streets[n + 2] / step - 0.5;
    const bz = streets[n + 3] / step - 0.5;
    const r = Math.max(0.75, streets[n + 4] / step);
    const ex = bx - ax;
    const ez = bz - az;
    const ee = Math.max(1e-9, ex * ex + ez * ez);
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
    const i1 = Math.min(px - 1, Math.ceil(Math.max(ax, bx) + r + 1));
    const j0 = Math.max(0, Math.floor(Math.min(az, bz) - r - 1));
    const j1 = Math.min(px - 1, Math.ceil(Math.max(az, bz) + r + 1));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const h = Math.max(0, Math.min(1, ((i - ax) * ex + (j - az) * ez) / ee));
        const d = Math.hypot(i - ax - ex * h, j - az - ez * h);
        const a = Math.min(1, Math.max(0, r + 0.5 - d));
        const k = j * px + i;
        if (a > cover[k]) cover[k] = a;
      }
    }
  }
  for (let k = 0; k < cover.length; k++) {
    const a = cover[k] * 0.9;
    if (a <= 0) continue;
    const o = k * 4;
    out[o] += (STREET[0] - out[o]) * a;
    out[o + 1] += (STREET[1] - out[o + 1]) * a;
    out[o + 2] += (STREET[2] - out[o + 2]) * a;
  }
}

/** Every cabin as its roof seen from above: the rectangle turned to its
 * heading, filled in the roof's brown inside a darker rim a pixel wide with
 * its ridge drawn light along it, soft by half a pixel at its edge. */
function stampCabins(out: Uint8ClampedArray, px: number, step: number, cabins: Float32Array): void {
  for (let n = 0; n < cabins.length; n += 6) {
    const cx = cabins[n] / step - 0.5;
    const cz = cabins[n + 1] / step - 0.5;
    const ridge = cabins[n + 5];
    // A woodshed (no ridge) is a mark smaller than the house beside it.
    const least = ridge === 0 ? ROOF_LEAST * 0.6 : ROOF_LEAST;
    const hw = Math.max(least, (cabins[n + 2] * ROOF_GROW) / step);
    const hd = Math.max(least, (cabins[n + 3] * ROOF_GROW) / step);
    const fx = Math.sin(cabins[n + 4]);
    const fz = Math.cos(cabins[n + 4]);
    const r = Math.hypot(hw, hd) + 1;
    const i0 = Math.max(0, Math.floor(cx - r));
    const i1 = Math.min(px - 1, Math.ceil(cx + r));
    const j0 = Math.max(0, Math.floor(cz - r));
    const j1 = Math.min(px - 1, Math.ceil(cz + r));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i - cx;
        const dz = j - cz;
        // Into the building's frame: x across its front, z the way it faces.
        const lx = Math.abs(dx * fz - dz * fx);
        const lz = Math.abs(dx * fx + dz * fz);
        const inside = Math.min(hw - lx, hd - lz);
        const a = Math.min(1, Math.max(0, inside + 0.5));
        if (a <= 0) continue;
        const onRidge = (ridge === 1 && lz < 0.95) || (ridge === 2 && lx < 0.95);
        const tone = inside < 1 ? ROOF_RIM : onRidge ? ROOF_RIDGE : ROOF;
        const k = (j * px + i) * 4;
        out[k] += (tone[0] - out[k]) * a;
        out[k + 1] += (tone[1] - out[k + 1]) * a;
        out[k + 2] += (tone[2] - out[k + 2]) * a;
      }
    }
  }
}
