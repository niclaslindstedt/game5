// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUILDINGS' SURFACES, PAINTED — every material a lift station, a
// start house or the finish arena is built of, painted IN CODE into one
// stack of square tiles (a texture array, `facade-material.ts` uploads it):
// the colour with its ROUGHNESS in the alpha, and a RELIEF — the height of
// a board, a rib, a seam or a mullion — turned into a tangent-space normal
// map, so a low-poly wall lit by the sun shows its boards' edges, a roof its
// seams and a curtain wall its frames, at a dozen triangles a wall.
//
// Each material is studied off what the real thing is (`docs/buildings.md`):
// vertical larch boards weathering brown to silver, a trapezoidal steel
// sheet's ribs, a standing-seam roof's seams half a metre apart, a terminal
// hood's composite panels, formwork concrete with its tie holes, a curtain
// wall's aluminium frames over a sky-reflecting glass, a roller door's
// slats. Every tile repeats seamlessly (its noise is periodic), and its
// size in metres is `FACADE_TILE`'s, so the builder hands it UVs in metres
// over that and a board is 15 cm wide on every wall. A tile marked `once`
// is laid once over its quad (a window, a door, a glazing band's height).
//
// Three-free and DOM-free: pure functions of the layer and the pixel, so the
// suite holds the stack (`tests/facade_test.ts`) and two loads of a page
// paint the same bytes.

/** The materials, one layer of the stack each. */
export const FACADE = {
  /** Flat white: the vertex colour alone (a red band, a dark underside). */
  plain: 0,
  /** Vertical timber boards with their gaps, weathered. */
  boards: 1,
  /** A trapezoidal steel sheet's ribs, light grey (tinted by the vertex
   * colour). */
  cladding: 2,
  /** A standing-seam metal roof, its seams running down the slope. */
  roof: 3,
  /** A terminal hood's composite panels and their recessed seams. */
  panel: 4,
  /** Formwork concrete: the panels' joints, the tie holes, the blotches. */
  concrete: 5,
  /** A curtain wall: aluminium mullions over glass, laid once up its band. */
  glazing: 6,
  /** A punched window in its frame, with a cross mullion and a sill. */
  window: 7,
  /** A roller door's slats in their guides. */
  shutter: 8,
  /** A glazed double door in its frame. */
  door: 9,
  /** Settled snow, soft and blue in its hollows. */
  snow: 10,
  /** Galvanised steel, mottled. */
  steel: 11,
  /** A machine room's louvred vent. */
  louvre: 12,
} as const;
export type FacadeLayer = (typeof FACADE)[keyof typeof FACADE];

/** How many layers the stack holds, and each tile's side in pixels. */
export const FACADE_LAYERS = 13;
export const FACADE_SIZE = 256;

/** Each layer's tile in metres, along (u) and up (v) — `once` where it is
 * laid once over its quad, whatever its size. */
export const FACADE_TILE: Readonly<Record<FacadeLayer, { u: number; v: number; once?: boolean }>> =
  {
    0: { u: 4, v: 4 },
    1: { u: 2.4, v: 2.4 },
    2: { u: 2, v: 2 },
    3: { u: 2, v: 2 },
    4: { u: 2.4, v: 1.2 },
    5: { u: 2.4, v: 2.4 },
    6: { u: 1.5, v: 1, once: true },
    7: { u: 1, v: 1, once: true },
    8: { u: 1, v: 1, once: true },
    9: { u: 1, v: 1, once: true },
    10: { u: 4, v: 4 },
    11: { u: 1, v: 1 },
    12: { u: 1, v: 0.6 },
  };

/** A glazing band is laid once UP its height but repeated ALONG it, a pane
 * every `FACADE_TILE[glazing].u` m. */
export function tiledAlong(layer: FacadeLayer): boolean {
  return layer === FACADE.glazing;
}

/** How hard each layer's relief is pressed into its normals. */
const RELIEF: Readonly<Record<FacadeLayer, number>> = {
  0: 0,
  1: 3,
  2: 5,
  3: 4,
  4: 3,
  5: 1.5,
  6: 4,
  7: 4,
  8: 3,
  9: 3,
  10: 1.2,
  11: 1,
  12: 5,
};

/** A pixel: its colour 0..1 (sRGB), its roughness and its height 0..1. */
type Px = { r: number; g: number; b: number; rough: number; h: number };

// ---------------------------------------------------------------- noise

/** An integer hash to 0..1. */
function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise PERIODIC over `n` cells across the tile (so the tile wraps):
 * `u`, `v` 0..1 over the tile. */
function noise(u: number, v: number, nu: number, nv: number, s: number): number {
  const x = u * nu;
  const y = v * nv;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (i: number, j: number) => hash(((i % nu) + nu) % nu, ((j % nv) + nv) % nv, s);
  const a = w(x0, y0);
  const b = w(x0 + 1, y0);
  const c = w(x0, y0 + 1);
  const d = w(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal noise, 0..1, octaves doubling the cells. */
function fbm(u: number, v: number, nu: number, nv: number, s: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(u, v, nu << o, nv << o, s + o * 17);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** A hex colour to 0..1 channels. */
const hex = (c: number): [number, number, number] => [
  ((c >> 16) & 255) / 255,
  ((c >> 8) & 255) / 255,
  (c & 255) / 255,
];
const px = (c: [number, number, number], k: number, rough: number, h: number): Px => ({
  r: c[0] * k,
  g: c[1] * k,
  b: c[2] * k,
  rough,
  h,
});

/** Glass seen from outside: the ground's dark low in the pane, the sky's
 * light high in it, a soft diagonal sheen across — `v` 0..1 up the pane. */
function glass(u: number, v: number): Px {
  const low = hex(0x1d2a35);
  const high = hex(0x7d97ae);
  const t = smooth(0.15, 1, v) * 0.75;
  const sheen = Math.exp(-(((u * 0.8 + v - 0.75) / 0.12) ** 2)) * 0.18;
  return {
    r: mix(low[0], high[0], t) + sheen,
    g: mix(low[1], high[1], t) + sheen,
    b: mix(low[2], high[2], t) + sheen,
    rough: 0.08,
    h: 0.3,
  };
}

/** A frame's anthracite aluminium. */
const FRAME = hex(0x2c3035);

// ---------------------------------------------------------------- layers

/** One pixel of a layer, `u`, `v` 0..1 over its tile, `v` up. */
export function paintPixel(layer: FacadeLayer, u: number, v: number): Px {
  switch (layer) {
    case FACADE.boards: {
      // 16 boards of 15 cm across a 2.4 m tile, each its own weathering.
      const n = 16;
      const b = Math.floor(u * n);
      const s = u * n - b;
      const gap = s < 0.07;
      const tone = hash(b, 3, 11);
      const silver = hash(b, 5, 13) * 0.55;
      const brown = hex(0x8b6844);
      const grey = hex(0x8a8178);
      const base: [number, number, number] = [
        mix(brown[0], grey[0], silver),
        mix(brown[1], grey[1], silver),
        mix(brown[2], grey[2], silver),
      ];
      // The grain, long up the board; a butt joint somewhere on it.
      const grain = fbm(u, v, n * 4, 3, 21 + b, 3);
      const joint = Math.abs(v - hash(b, 7, 17)) < 0.006;
      const k = 0.72 + tone * 0.28 + (grain - 0.5) * 0.3;
      if (gap || joint) return px(hex(0x241a12), 1, 0.95, 0);
      return px(base, k, 0.82, 0.75 + 0.25 * Math.sin(Math.PI * s));
    }
    case FACADE.cladding: {
      // Ribs every 25 cm: a 6 cm crown, sloped webs, a wide pan.
      const s = (u * 8) % 1;
      const h = s < 0.24 ? 1 : s < 0.36 ? 1 - (s - 0.24) / 0.12 : s > 0.88 ? (s - 0.88) / 0.12 : 0;
      const streak = fbm(u, v, 24, 2, 31, 3);
      const lap = Math.abs(v - 0.5) < 0.004 ? 0.8 : 1;
      return px(hex(0xd0d4d7), (0.9 + streak * 0.1) * lap, 0.42, h);
    }
    case FACADE.roof: {
      // Standing seams every 50 cm, the pans between them faintly canned.
      const s = (u * 4) % 1;
      const seam = s < 0.035 ? 1 : 0;
      const pan = fbm(u, v, 8, 6, 41, 3);
      const streak = fbm(u, v, 40, 2, 43, 2);
      const k = seam ? 1.25 : 0.88 + streak * 0.18;
      return px(hex(0x3c4046), k, 0.5, seam ? 1 : 0.35 + pan * 0.12);
    }
    case FACADE.panel: {
      // 1.2 × 0.6 m panels, a 1.5 cm recessed seam round each.
      const su = (u * 2) % 1;
      const sv = (v * 2) % 1;
      const seam = su < 0.008 || su > 0.992 || sv < 0.016 || sv > 0.984;
      const p = Math.floor(u * 2) + Math.floor(v * 2) * 2;
      const k = 0.93 + hash(p, 1, 51) * 0.05 + (fbm(u, v, 6, 3, 53, 2) - 0.5) * 0.04;
      const rivet =
        (su < 0.03 || su > 0.97) && Math.abs(((sv * 4) % 1) - 0.5) < 0.04 && !seam ? 0.85 : 1;
      if (seam) return px(hex(0x5c6166), 1, 0.6, 0);
      return px(hex(0xf0f1f0), k * rivet, 0.32, 1);
    }
    case FACADE.concrete: {
      // Formwork panels 1.2 × 0.6 m, four tie holes each, blotched.
      const su = (u * 2) % 1;
      const sv = (v * 4) % 1;
      const joint = su < 0.006 || sv < 0.012;
      const hole =
        Math.hypot(((su * 2) % 1) - 0.5, (sv - 0.5) * 0.5) < 0.04 && Math.abs(su - 0.5) > 0.1;
      const blotch = fbm(u, v, 6, 6, 61, 4);
      const fine = noise(u, v, 128, 128, 63);
      const k = 0.62 + blotch * 0.16 + fine * 0.05;
      if (hole) return px(hex(0x4a4a48), 1, 0.95, 0.2);
      return px(hex(0xb9b6b0), joint ? k * 0.85 : k, 0.92, joint ? 0.4 : 0.6 + blotch * 0.2);
    }
    case FACADE.glazing: {
      // A pane between two mullions, the transoms at its foot and head.
      const mull = u < 0.035 || u > 0.965;
      const trans = v < 0.04 || v > 0.96;
      if (mull || trans) return px(FRAME, 1, 0.4, 1);
      return glass(u, v);
    }
    case FACADE.window: {
      const frame = u < 0.07 || u > 0.93 || v < 0.1 || v > 0.93;
      const cross = Math.abs(u - 0.5) < 0.025 || Math.abs(v - 0.55) < 0.025;
      if (v < 0.1) return px(hex(0x9da3a8), 1, 0.5, 1);
      if (frame) return px(FRAME, 1, 0.45, 0.85);
      if (cross) return px(FRAME, 1, 0.45, 0.8);
      return glass(u, v);
    }
    case FACADE.shutter: {
      const side = u < 0.04 || u > 0.96;
      if (side) return px(hex(0x6d7277), 1, 0.45, 1);
      if (v < 0.04) return px(hex(0x3a3e43), 1, 0.5, 0.8);
      const s = (v * 22) % 1;
      const h = 0.5 + 0.5 * Math.sin(Math.PI * s);
      return px(hex(0xc4c8cb), 0.86 + 0.14 * h, 0.45, h * 0.9);
    }
    case FACADE.door: {
      // Two leaves in a frame, a push bar across each, a kick plate under.
      const leaf = u < 0.5 ? u * 2 : (u - 0.5) * 2;
      const frame = u < 0.05 || u > 0.95 || v > 0.95 || Math.abs(u - 0.5) < 0.02;
      const stile = leaf < 0.1 || leaf > 0.9 || v < 0.22 || v > 0.9;
      const bar = Math.abs(v - 0.45) < 0.02 && leaf > 0.15 && leaf < 0.85;
      if (frame) return px(FRAME, 0.9, 0.45, 1);
      if (v < 0.2) return px(hex(0x8f959b), 1, 0.35, 0.9);
      if (stile) return px(FRAME, 1.05, 0.45, 0.85);
      if (bar) return px(hex(0xb0b6bb), 1, 0.3, 1);
      return glass(leaf, (v - 0.22) / 0.68);
    }
    case FACADE.snow: {
      const f = fbm(u, v, 4, 4, 71, 5);
      const k = 0.9 + f * 0.1;
      const blue = (1 - f) * 0.06;
      return { r: 0.97 * k - blue, g: 0.98 * k - blue * 0.5, b: 1.0 * k, rough: 0.8, h: f };
    }
    case FACADE.steel: {
      const spangle = noise(u, v, 24, 24, 81) * 0.6 + noise(u, v, 64, 64, 83) * 0.4;
      return px(hex(0xb4b9bd), 0.85 + spangle * 0.15, 0.45, 0.5 + spangle * 0.1);
    }
    case FACADE.louvre: {
      const side = u < 0.03 || u > 0.97;
      if (side) return px(FRAME, 1.1, 0.45, 1);
      const s = (v * 6) % 1;
      // Each blade falls outward: lit on its face, dark in the slot under it.
      const h = s < 0.75 ? s / 0.75 : 0;
      return px(hex(0x5a6066), 0.55 + h * 0.55, 0.5, h);
    }
    default:
      return { r: 1, g: 1, b: 1, rough: 0.6, h: 0.5 };
  }
}

const toByte = (x: number) => Math.round(clamp01(x) * 255);

/** THE STACK, painted: every layer's colour with its roughness in the
 * alpha, and its relief as a tangent-space normal (x along u, y up v, z out
 * of the wall), `FACADE_SIZE` square and `FACADE_LAYERS` deep, layer after
 * layer, row 0 the tile's foot (`v` 0). */
export function paintFacades(size = FACADE_SIZE): {
  albedo: Uint8Array;
  normal: Uint8Array;
} {
  const n = size * size;
  const albedo = new Uint8Array(n * 4 * FACADE_LAYERS);
  const normal = new Uint8Array(n * 4 * FACADE_LAYERS);
  const height = new Float32Array(n);
  for (let l = 0; l < FACADE_LAYERS; l++) {
    const layer = l as FacadeLayer;
    const off = l * n * 4;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = paintPixel(layer, (x + 0.5) / size, (y + 0.5) / size);
        const i = y * size + x;
        albedo[off + i * 4] = toByte(p.r);
        albedo[off + i * 4 + 1] = toByte(p.g);
        albedo[off + i * 4 + 2] = toByte(p.b);
        albedo[off + i * 4 + 3] = toByte(p.rough);
        height[i] = p.h;
      }
    }
    // The relief's slope by central differences, wrapped round the tile.
    const k = RELIEF[layer];
    const once = FACADE_TILE[layer].once;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const at = (xx: number, yy: number) =>
          once
            ? height[
                Math.min(size - 1, Math.max(0, yy)) * size + Math.min(size - 1, Math.max(0, xx))
              ]
            : height[((yy + size) % size) * size + ((xx + size) % size)];
        const dx = (at(x + 1, y) - at(x - 1, y)) * k;
        const dy = (at(x, y + 1) - at(x, y - 1)) * k;
        const l2 = Math.hypot(dx, dy, 1);
        const i = off + (y * size + x) * 4;
        normal[i] = toByte((-dx / l2) * 0.5 + 0.5);
        normal[i + 1] = toByte((-dy / l2) * 0.5 + 0.5);
        normal[i + 2] = toByte((1 / l2) * 0.5 + 0.5);
        normal[i + 3] = 255;
      }
    }
  }
  return { albedo, normal };
}
