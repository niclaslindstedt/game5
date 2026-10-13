// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD FIELD — what cloud stands over a map, where, and how it moves:
// a pure function of the map and the run's clock, three-free, so the suite
// holds its numbers (`tests/cloud_field_test.ts`) and the shaders read the
// same field the light is reckoned off (`cloud-glsl.ts`, `clouds.ts`).
//
// EACH WEATHER R19 DEALS IS A STACK OF LAYERS at the heights the genus lives
// at over the valley floor — a fair day's heaps at 1.5–2 km, a flurry's
// towers higher and deeper with a mackerel sky over them, an overcast's
// stratocumulus deck under a grey altostratus, the snow's and the storm's
// nimbostratus with ragged scud under it, a high sky's ice streaks and the
// thin veil a halo shows in at 7–9 km. Every band (the base, the depth,
// the cover, the cell's size) is DEALT off the map's seed on a hash of its
// own — never `state.rng`, so nothing the engine steps can see it.
//
// THE SHAPE is one tileable 3D noise (`cloudNoise`: a value-noise fbm on a
// 64³ lattice, the bytes the GPU's texture holds and the CPU twin reads
// back), read twice at two scales; a layer's cover is a TRUE AREA SHARE,
// cut at the noise's own quantile. Where the noise passes the cut the
// column stands: a heap from a flat base up to a top that grows into the
// cell, a sheet thickening about the layer's middle.
//
// THE WIND ALOFT carries each layer: the map's mean wind (`windAt`'s, never
// its gusts — those are the air down here) grown with height on a log law
// and VEERING with it (clockwise in the north, the other way in the south,
// as the friction of the ground lets go), floored at the speed the genus
// is seen to move at. Its shape EVOLVES as it goes: the noise's third axis
// is time, so a cell is born, swells and dies over its genus's life — a
// heap's few minutes, a deck's quarter of an hour.

import { weatherOf, windFromOf, type Level, type WeatherKind } from "@engine";

/** The kinds of cloud a layer can be. */
export type CloudKind =
  | "cumulus"
  | "congestus"
  | "altocumulus"
  | "cirrus"
  | "veil"
  | "strato"
  | "altostratus"
  | "nimbo"
  | "fractus";

/** A layer as a weather deals it: every band [least, most]. */
type LayerDef = {
  kind: CloudKind;
  /** The base over the valley floor, m. */
  base: [number, number];
  /** The depth from base to top, m. */
  depth: [number, number];
  /** The share of the sky it covers. */
  cover: [number, number];
  /** One cell's span across the wind, m. */
  size: [number, number];
  /** How far a cell is drawn out along the wind. */
  stretch: number;
  /** 1 a heap (flat base, top grown into the cell), 0 a sheet. */
  dome: number;
  /** The optical depth a full column shows the eye. */
  opacity: number;
  /** The optical depth a full column takes off the sun on the snow — the
   * DIRECT key: a deck's sends much of its light on as the glow the lid's
   * skylight (`sky.ts`'s `LID_LIGHT`) carries. */
  tau: number;
  /** A cell's life, s. */
  life: number;
  /** The least speed the genus is seen to move at, m/s. */
  speed: number;
};

/** The most layers a sky stacks (the shaders' arrays). */
export const CLOUD_LAYERS = 3;

const CU: Omit<LayerDef, "base" | "depth" | "cover" | "size"> = {
  kind: "cumulus",
  stretch: 1.3,
  dome: 1,
  opacity: 28,
  tau: 2.4,
  life: 480,
  speed: 4,
};
const CI: Omit<LayerDef, "base" | "depth" | "cover" | "size"> = {
  kind: "cirrus",
  stretch: 5,
  dome: 0,
  opacity: 0.9,
  tau: 0.25,
  life: 1200,
  speed: 15,
};

/** THE STACK EACH WEATHER DEALS, top to bottom by nothing: the order is
 * the shaders' and the light's (`cloud-light.ts` sorts by height). The
 * heights are the genera's own over the ground the sky stands on; the
 * optical depths are tuned so a noon's mean key lands where an overcast's,
 * a fall's and a storm's lid always stood (`sky.ts`). */
const STACKS: Record<WeatherKind, LayerDef[]> = {
  clear: [
    { ...CI, base: [7500, 8500], depth: [300, 500], cover: [0.03, 0.08], size: [3000, 5000] },
  ],
  fair: [
    { ...CU, base: [1500, 2000], depth: [500, 900], cover: [0.22, 0.36], size: [1300, 1900] },
    { ...CI, base: [7600, 8800], depth: [300, 600], cover: [0.02, 0.14], size: [3000, 5000] },
  ],
  flurries: [
    {
      ...CU,
      kind: "congestus",
      base: [1500, 1800],
      depth: [1300, 2000],
      cover: [0.32, 0.44],
      size: [1700, 2400],
      opacity: 40,
      tau: 3,
      life: 600,
    },
    {
      kind: "altocumulus",
      base: [3600, 4500],
      depth: [250, 450],
      cover: [0.15, 0.3],
      size: [600, 900],
      stretch: 1.6,
      dome: 0.6,
      opacity: 5,
      tau: 0.5,
      life: 900,
      speed: 8,
    },
  ],
  high: [
    { ...CI, base: [7500, 9000], depth: [400, 800], cover: [0.35, 0.5], size: [2500, 4000] },
    {
      ...CI,
      kind: "veil",
      base: [7000, 7800],
      depth: [600, 900],
      cover: [0.75, 0.92],
      size: [6000, 9000],
      stretch: 2.5,
      opacity: 0.35,
      tau: 0.2,
      life: 1800,
    },
  ],
  overcast: [
    {
      kind: "strato",
      base: [1700, 2100],
      depth: [450, 700],
      cover: [0.9, 0.97],
      size: [900, 1300],
      stretch: 1.5,
      dome: 0.35,
      opacity: 22,
      tau: 0.55,
      life: 900,
      speed: 5,
    },
    {
      kind: "altostratus",
      base: [3600, 4400],
      depth: [700, 1100],
      cover: [0.8, 0.9],
      size: [5000, 8000],
      stretch: 2,
      dome: 0,
      opacity: 4,
      tau: 0.18,
      life: 1500,
      speed: 9,
    },
  ],
  snow: [
    {
      kind: "nimbo",
      base: [1450, 1650],
      depth: [2200, 2800],
      cover: [0.99, 1],
      size: [3000, 4500],
      stretch: 1.6,
      dome: 0,
      opacity: 60,
      tau: 0.78,
      life: 1200,
      speed: 6,
    },
    {
      kind: "fractus",
      base: [900, 1200],
      depth: [150, 300],
      cover: [0.2, 0.32],
      size: [350, 600],
      stretch: 2,
      dome: 0.5,
      opacity: 5,
      tau: 0.15,
      life: 200,
      speed: 6,
    },
  ],
  storm: [
    {
      kind: "nimbo",
      base: [1400, 1600],
      depth: [3000, 4000],
      cover: [0.995, 1],
      size: [3000, 5000],
      stretch: 1.8,
      dome: 0,
      opacity: 90,
      tau: 1.15,
      life: 900,
      speed: 8,
    },
    {
      kind: "fractus",
      base: [700, 1000],
      depth: [200, 400],
      cover: [0.32, 0.46],
      size: [300, 550],
      stretch: 2.6,
      dome: 0.4,
      opacity: 7,
      tau: 0.2,
      life: 150,
      speed: 10,
    },
  ],
  // A valley fog is an inversion: clear air over it and a few ice streaks.
  // The fog itself is the SEA (`seaTop`), not a layer of this field.
  fog: [{ ...CI, base: [7500, 8800], depth: [300, 500], cover: [0.04, 0.12], size: [3000, 5000] }],
};

/** A layer as it stands over one map: every band dealt. */
export type CloudLayer = {
  kind: CloudKind;
  /** The base and the depth, m over the valley floor. */
  base: number;
  depth: number;
  cover: number;
  size: number;
  stretch: number;
  dome: number;
  opacity: number;
  tau: number;
  life: number;
  /** How fast and toward where the wind aloft carries it: m/s, and the
   * heading it moves TOWARD (rad, 0 along +z, clockwise from above). */
  speed: number;
  heading: number;
  /** The noise's cut for its cover (`coverCut`). */
  cut: number;
  /** Where in the noise this map's layer stands: x, z and time, periods. */
  ox: number;
  oz: number;
  ow: number;
};

/** THE WHOLE SKY's cloud over one map: its layers, and where the ground
 * they are measured from stands. */
export type CloudField = {
  layers: CloudLayer[];
  /** The valley floor's world height, m, and its altitude over the sea. */
  floorY: number;
  floorAltitude: number;
  /** THE VALLEY FOG'S TOP over the floor, m (0: no sea). */
  seaTop: number;
};

/** A hash of the map's seed and a salt to 0..1. */
export function cloudHash(seed: number, salt: number): number {
  let h = Math.imul((seed ^ Math.imul(salt, 0x27d4eb2d)) >>> 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const deal = (band: [number, number], u: number): number => band[0] + (band[1] - band[0]) * u;

/** THE WIND ALOFT at `h` m over the floor, from a surface mean of
 * `surface` m/s: the log law's growth with height, floored at the genus's
 * least and held under a jet's 45 m/s. */
export function windAloft(surface: number, h: number, least = 0): number {
  return Math.min(45, Math.max(least, surface * (1 + 1.2 * Math.log(1 + h / 600))));
}

/** How far the wind has turned by `h` m over the floor, rad: clockwise
 * (positive) in the north, the other way in the south. */
export function veerAloft(h: number, latitude: number): number {
  return Math.sign(latitude || 1) * 0.35 * Math.log(1 + h / 1000);
}

/** The layers a weather deals over the map of `seed` (`latitude` turns the
 * veer), its wind's mean `wind` m/s coming FROM `from`. */
export function cloudLayersFor(
  kind: WeatherKind,
  seed = 0,
  wind = 4,
  from = 0,
  latitude = 45,
): CloudLayer[] {
  return STACKS[kind].map((def, i) => {
    const u = (k: number): number => cloudHash(seed, 101 + i * 17 + k);
    const base = deal(def.base, u(0));
    const depth = deal(def.depth, u(1));
    const cover = deal(def.cover, u(2));
    const mid = base + depth / 2;
    return {
      kind: def.kind,
      base,
      depth,
      cover,
      size: deal(def.size, u(3)),
      stretch: def.stretch,
      dome: def.dome,
      opacity: def.opacity,
      tau: def.tau,
      life: def.life,
      speed: windAloft(wind, mid, def.speed),
      heading: from + Math.PI + veerAloft(mid, latitude),
      cut: coverCut(cover),
      ox: u(4),
      oz: u(5),
      ow: u(6),
    };
  });
}

/** The sea of a valley fog's top over the floor, m, for a fog of `fog`. */
export function seaTopOf(fog: number): number {
  return 220 + 380 * fog;
}

/** THE FIELD over `level`. */
export function cloudFieldOf(
  level: Pick<Level, "seed" | "weather" | "mountain" | "sun">,
): CloudField {
  const w = weatherOf(level);
  const m = level.mountain;
  return {
    layers: cloudLayersFor(w.kind, level.seed, w.wind, windFromOf(level), level.sun.latitude),
    floorY: m ? m.base.y : 0,
    floorAltitude: m ? m.base.y - m.sea : 400,
    seaTop: w.kind === "fog" ? seaTopOf(w.fog) : 0,
  };
}

/** Where a layer stands in the noise at world (`x`, `z`) and run time `t`:
 * along the wind, across it and its life — periods of the noise. */
export function layerCoords(layer: CloudLayer, x: number, z: number, t: number): Coords {
  const sx = Math.sin(layer.heading);
  const sz = Math.cos(layer.heading);
  const along = x * sx + z * sz - layer.speed * t;
  const across = x * sz - z * sx;
  const period = NOISE_CELLS * layer.size;
  return {
    u: along / (period * layer.stretch) + layer.ox,
    v: across / period + layer.oz,
    w: t / (NOISE_CELLS * layer.life) + layer.ow,
  };
}
type Coords = { u: number; v: number; w: number };

// THE NOISE.

/** The lattice's texels a side, and how many cells the base octave has a
 * period (a cell is one cloud). */
export const NOISE_SIZE = 64;
export const NOISE_CELLS = 4;
/** The two reads: the second's weight, scale, turn and offset. */
export const SECOND = { weight: 0.38, scale: 2.37, turn: 0.6, w: 1.7, off: [0.31, 0.57, 0.13] };

const lattice = (x: number, y: number, z: number, n: number, salt: number): number =>
  cloudHash((((x % n) + n) % n) | ((((y % n) + n) % n) << 8) | ((((z % n) + n) % n) << 16), salt);
const quintic = (f: number): number => f * f * f * (f * (f * 6 - 15) + 10);

function valueNoise(x: number, y: number, z: number, n: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = quintic(x - ix);
  const fy = quintic(y - iy);
  const fz = quintic(z - iz);
  let s = 0;
  for (let k = 0; k < 8; k++) {
    const dx = k & 1;
    const dy = (k >> 1) & 1;
    const dz = (k >> 2) & 1;
    const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
    s += w * lattice(ix + dx, iy + dy, iz + dz, n, salt);
  }
  return s;
}

let noise: Uint8Array | null = null;

/** THE NOISE, 64³ bytes (x fastest): three octaves of a tileable value
 * noise (4, 8 and 16 cells a period), stretched to the bytes' range. */
export function cloudNoise(): Uint8Array {
  if (noise) return noise;
  const N = NOISE_SIZE;
  const raw = new Float32Array(N * N * N);
  const octaves = [
    { cells: NOISE_CELLS, weight: 0.55 },
    { cells: NOISE_CELLS * 2, weight: 0.3 },
    { cells: NOISE_CELLS * 4, weight: 0.15 },
  ];
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let s = 0;
        for (const [o, { cells, weight }] of octaves.entries()) {
          const k = cells / N;
          s += weight * valueNoise(x * k, y * k, z * k, cells, 7 + o);
        }
        raw[(z * N + y) * N + x] = s;
      }
  const sorted = Float32Array.from(raw).sort();
  const lo = sorted[Math.floor(sorted.length * 0.005)];
  const hi = sorted[Math.floor(sorted.length * 0.995)];
  noise = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++)
    noise[i] = Math.round(255 * Math.min(1, Math.max(0, (raw[i] - lo) / (hi - lo))));
  return noise;
}

/** The noise read as the GPU reads it: trilinear between texel centres,
 * wrapped. `u`, `v`, `w` in periods. */
export function noiseAt(u: number, v: number, w: number): number {
  const data = cloudNoise();
  const N = NOISE_SIZE;
  const x = u * N - 0.5;
  const y = v * N - 0.5;
  const z = w * N - 0.5;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const at = (a: number, b: number, c: number): number =>
    data[((((c % N) + N) % N) * N + (((b % N) + N) % N)) * N + (((a % N) + N) % N)];
  let s = 0;
  for (let k = 0; k < 8; k++) {
    const dx = k & 1;
    const dy = (k >> 1) & 1;
    const dz = (k >> 2) & 1;
    s +=
      (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz) * at(ix + dx, iy + dy, iz + dz);
  }
  return s / 255;
}

/** THE FIELD'S NOISE at a layer's coordinates: the two reads blended. */
export function fieldNoise(u: number, v: number, w: number): number {
  const c = Math.cos(SECOND.turn);
  const s = Math.sin(SECOND.turn);
  const u2 = (u * c - v * s) * SECOND.scale + SECOND.off[0];
  const v2 = (u * s + v * c) * SECOND.scale + SECOND.off[1];
  const w2 = w * SECOND.w + SECOND.off[2];
  return (1 - SECOND.weight) * noiseAt(u, v, w) + SECOND.weight * noiseAt(u2, v2, w2);
}

/** The noise's own spread, sampled once: what a cover is cut by. */
const SAMPLES = 2048;
let spread: Float32Array | null = null;
function noiseSpread(): Float32Array {
  if (spread) return spread;
  spread = new Float32Array(SAMPLES);
  for (let i = 0; i < SAMPLES; i++)
    spread[i] = fieldNoise(cloudHash(i, 1), cloudHash(i, 2), cloudHash(i, 3));
  spread.sort();
  return spread;
}

/** THE CUT a cover is drawn at: the noise's quantile that leaves `cover`
 * of the sky over it. */
export function coverCut(cover: number): number {
  const s = noiseSpread();
  if (cover <= 0) return 2;
  if (cover >= 1) return -1;
  const at = (1 - cover) * (SAMPLES - 1);
  const i = Math.floor(at);
  return s[i] + (s[Math.min(SAMPLES - 1, i + 1)] - s[i]) * (at - i);
}

/** How soft a cloud's edge is, in the noise's units. */
export const EDGE = 0.1;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** THE COLUMN a noise `n` stands up in a layer: its bottom and top, 0..1 of
 * the layer's depth — a heap from its base up to a top grown into the cell,
 * a sheet thickening about the middle. */
export function columnOf(layer: Pick<CloudLayer, "cut" | "dome">, n: number): [number, number] {
  const c = smooth(layer.cut, layer.cut + EDGE, n);
  const s = smooth(0, 0.25, c);
  const heapTop = Math.pow(c, 0.55);
  const bottom = (0.5 - 0.5 * s) * (1 - layer.dome);
  const top = (0.5 + 0.5 * s) * (1 - layer.dome) + heapTop * layer.dome;
  return [bottom, Math.max(bottom, top)];
}

/** The share of a layer's depth the column at world (`x`, `z`) fills at `t`. */
export function columnAt(layer: CloudLayer, x: number, z: number, t: number): number {
  const p = layerCoords(layer, x, z, t);
  const [b, top] = columnOf(layer, fieldNoise(p.u, p.v, p.w));
  return top - b;
}

/** THE SUN THROUGH ONE LAYER, its MEAN over the map, at a sun `sinE` up:
 * the share of the direct light the layer's columns let through, averaged
 * over the noise's own spread. */
export function layerPass(layer: CloudLayer, sinE: number): number {
  const s = noiseSpread();
  const k = layer.tau / Math.max(sinE, 0.08);
  let sum = 0;
  for (let i = 0; i < SAMPLES; i += 4) {
    const [b, top] = columnOf(layer, s[i]);
    sum += Math.exp(-(top - b) * k);
  }
  return sum / (SAMPLES / 4);
}

/** THE SUN THROUGH THE WHOLE STACK, its mean over the map. */
export function meanPass(layers: readonly CloudLayer[], sinE: number): number {
  let p = 1;
  for (const l of layers) p *= layerPass(l, sinE);
  return p;
}
