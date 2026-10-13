// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAR RANGES, PLANNED — the meshes the country round a map is drawn
// with, decided without three: the rings' vertices and their order, the
// coarse DISC of the map itself, every vertex's albedo (snow, woods under
// the tree line, rock on the faces too steep to hold snow, open water), the
// horizon each vertex sees toward the key light (so a range throws its
// shadow on the next and the peaks keep the sun after the valleys lose
// it), the light by altitude (`farKeys`: the sun through the air down to
// that height — the alpenglow, and Earth's shadow climbing the faces at
// dusk), and the RIM the clipmap carries past the map's edge.
//
// THE RINGS are one mesh a tier, polar round the map's middle: each spoke
// starts ON the map's square edge (its first ring is the edge itself, its
// heights the edge's own) and runs out in rings spaced in the logarithm of
// the radius — LOW 96 × 14 to 60 km, MEDIUM 192 × 30 to 80 km, HIGH 320 ×
// 46 to 100 km. They are drawn as the BACKDROP (`far-ranges.ts`): after the
// dome and before anything else, writing no depth, so everything nearer
// draws over them. Their triangles are ordered from the outermost ring in,
// a painter's order that is right from anywhere on the map.
//
// THE DISC is the map's own heightfield, coarse (24–64 a side), drawn at
// its real depth right after the rings: where the clipmap stops (the
// DISTANCE row's reach, its mist) the map's own mountain still stands in
// front of the ranges behind it.
//
// Three-free and DOM-free; `tests/far_ranges_test.ts` reads it.

import type { Level } from "@engine";

import { FAR_RADIUS } from "./horizon.ts";
import {
  beyondEdge,
  edgeHeight,
  farHeightAt,
  fbm,
  ringRadius,
  type FarFrame,
  type FarGrid,
} from "./far-ranges-field.ts";
import type { RegionLook } from "./region-look.ts";
import type { DistanceLevel, Tier } from "./settings-video.ts";

/** How each tier draws the far country. */
export type FarRings = {
  /** Spokes round the map, and rings out along each. */
  readonly bearings: number;
  readonly rows: number;
  /** How far out the last ring stands, m. */
  readonly outer: number;
  /** The map's own coarse disc, samples a side. */
  readonly disc: number;
};

export const FAR_RINGS: Readonly<Record<Tier, FarRings>> = {
  low: { bearings: 96, rows: 14, outer: 60_000, disc: 24 },
  medium: { bearings: 192, rows: 30, outer: 80_000, disc: 48 },
  high: { bearings: 320, rows: 46, outer: 100_000, disc: 64 },
};

/** The DISTANCE row's stop to the far ranges' tier: MAX draws HIGH's. */
export const FAR_TIER: Readonly<Record<DistanceLevel, Tier>> = {
  low: "low",
  medium: "medium",
  high: "high",
  max: "high",
};

/** THE MIST ON THE RANGES: the DISTANCE row's mist closes the map, but the
 * far country is no draw distance's — so a ring takes the mist only near
 * the map's edge, as much as the map's own last ground does there, and
 * less with every `FAR_MIST_FADE` m further out (2.5 km), the big ranges standing
 * clear over the mist that hides the near country. */
export const FAR_MIST_FADE = 2500;

/** THE AIR BETWEEN THE RANGES. The game's haze (`sky.ts`'s 1/6000 on a
 * clear day) is a depth cue sized to the map's few kilometres, thicker than
 * the air is: a clear winter day over the mountains sees 100–200 km (an
 * extinction of 1/25000–1/50000 per m, Rayleigh's 1/74000 and a little
 * aerosol). So a far range is hazed by the game's density over the first
 * `near` m of the way and by `thin` of it past that — 1/30000 on a clear
 * day: a range 30 km off keeps a fifth of its contrast, one at 100 km is
 * nearly sky. A weather's own thickening (a fall, a fog) carries through. */
export const FAR_AIR = { near: 4000, thin: 0.2 } as const;

/** How far past the edge the clipmap may reach (the DISTANCE row's longest
 * view, `TERRAIN_REACH`, from a lens on the edge) — the RIM's extent, m —
 * and the rim's spacing, m. */
export const FAR_RIM = { reach: 4000, cell: 50 } as const;

/** A drawable mesh: positions in the map's frame, unit normals, linear
 * albedo, and the triangles in the order they are to be drawn. */
export type FarMesh = {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly albedo: Float32Array;
  readonly index: Uint32Array;
};

/** How far from the map's middle the square's edge is along bearing `a`
 * (0 along +z), m. */
export function edgeRadius(size: number, a: number): number {
  return size / 2 / Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a)));
}

/** How much of the far country is wooded, 0..1, by region. */
const WOOD_COVER: Readonly<Record<string, number>> = {
  alpine: 0.72,
  fell: 0.45,
  continental: 0.8,
  maritime: 0.78,
};

/** How much steeper the ground is than the rings' and the disc's meshes
 * say, for the rock (`albedoAt`). */
export const FAR_STEEP = { rings: 1.8, disc: 1.25 } as const;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Fresh snow's albedo as the terrain lays it (its white under the glare
 * the snow shader lifts it by), linear. */
const SNOW: readonly [number, number, number] = [0.98, 1.0, 1.04];
/** Open water seen from afar, linear. */
const WATER: readonly [number, number, number] = [0.04, 0.06, 0.08];

/** THE ALBEDO of the far country at a point (`y` its height in the map's
 * frame, `ny` its normal's upward part), into `out`: snow; the woods under
 * the tree line, patchy, thinning up to it and gone on the steep; the
 * region's rock on the faces too steep to hold snow; water at the sea.
 * `steep` is how much steeper the real faces are than a coarse mesh's
 * (`FAR_STEEP`): a grid hundreds of metres apart flattens every crest. */
export function albedoAt(
  frame: FarFrame,
  look: RegionLook,
  x: number,
  y: number,
  z: number,
  ny: number,
  out: Float32Array,
  at: number,
  steep = 1,
): void {
  const slope = (steep * Math.sqrt(Math.max(0, 1 - ny * ny))) / Math.max(ny, 0.05);
  if (y - frame.sea < 1.5 && slope < 0.05) {
    out.set(WATER, at);
    return;
  }
  const patch = 0.55 + 0.6 * fbm(x, z, 1800, 2, frame.seed + 77);
  const line = frame.treeLine + 80 * fbm(x, z, 900, 2, frame.seed + 78);
  const wood =
    (WOOD_COVER[frame.region] ?? 0.7) *
    Math.min(1, Math.max(0, patch)) *
    (1 - smoothstep(line - 160, line + 30, y)) *
    (1 - smoothstep(0.75, 1.15, slope));
  // A wood seen from afar: its trees dark among the snow between them —
  // darker than the terrain's carried tint, which is mixed into the snow
  // already; a heavy load of snow on the boughs lightens it.
  const lift = Math.min(1, 0.2 * look.load);
  // The rock broken up: buttresses and gullies down a face, never a band.
  const rough = slope * (0.75 + 0.6 * Math.abs(fbm(x, z, 700, 3, frame.seed + 79)));
  const rock = look.rock
    ? smoothstep(look.rock.from, look.rock.to, rough)
    : 0.6 * smoothstep(1.4, 2.2, rough);
  for (let c = 0; c < 3; c++) {
    const tree = look.forestTint[c] * 0.38;
    const woods = tree + (SNOW[c] - tree) * lift;
    let v = SNOW[c] + (woods - SNOW[c]) * wood;
    const stone = look.rock ? look.rock.tone[c] : 0.24;
    v += (stone - v) * rock;
    out[at + c] = v;
  }
}

/** Normals of a grid of `cols` × `rows` positions, by central differences
 * (one-sided at the ends; `wrap` closes the columns round). */
function gridNormals(pos: Float32Array, cols: number, rows: number, wrap: boolean): Float32Array {
  const n = new Float32Array(pos.length);
  const p = (i: number, j: number, c: number): number => pos[(j * cols + i) * 3 + c];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const il = wrap ? (i - 1 + cols) % cols : Math.max(0, i - 1);
      const ir = wrap ? (i + 1) % cols : Math.min(cols - 1, i + 1);
      const jd = Math.max(0, j - 1);
      const ju = Math.min(rows - 1, j + 1);
      const ax = p(ir, j, 0) - p(il, j, 0);
      const ay = p(ir, j, 1) - p(il, j, 1);
      const az = p(ir, j, 2) - p(il, j, 2);
      const bx = p(i, ju, 0) - p(i, jd, 0);
      const by = p(i, ju, 1) - p(i, jd, 1);
      const bz = p(i, ju, 2) - p(i, jd, 2);
      let nx = ay * bz - az * by;
      let nyv = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      if (nyv < 0) {
        nx = -nx;
        nyv = -nyv;
        nz = -nz;
      }
      const l = Math.hypot(nx, nyv, nz) || 1;
      const k = (j * cols + i) * 3;
      n[k] = nx / l;
      n[k + 1] = nyv / l;
      n[k + 2] = nz / l;
    }
  }
  return n;
}

/** THE RINGS for a tier: spoke `i`, ring `j` at index `j * bearings + i`;
 * ring 0 on the map's edge. The triangles run from the outermost ring in. */
export function ringMesh(
  level: Pick<Level, "groundAt">,
  frame: FarFrame,
  grid: FarGrid,
  look: RegionLook,
  rings: FarRings,
): FarMesh {
  const B = rings.bearings;
  const R = rings.rows;
  const outer = Math.min(rings.outer, grid.outer);
  const c = frame.size / 2;
  const positions = new Float32Array(B * R * 3);
  for (let i = 0; i < B; i++) {
    const a = (i / B) * Math.PI * 2;
    const r0 = edgeRadius(frame.size, a);
    for (let j = 0; j < R; j++) {
      const r = r0 * Math.pow(outer / r0, j / (R - 1));
      const x = c + r * Math.sin(a);
      const z = c + r * Math.cos(a);
      let y: number;
      if (j === 0) {
        const { qx, qz } = beyondEdge(frame.size, x, z);
        y = edgeHeight(level, frame.size, qx, qz);
      } else y = farHeightAt(level, frame, grid, x, z);
      positions.set([x, y, z], (j * B + i) * 3);
    }
  }
  const normals = gridNormals(positions, B, R, true);
  const albedo = new Float32Array(B * R * 3);
  for (let k = 0; k < B * R; k++) {
    albedoAt(
      frame,
      look,
      positions[k * 3],
      positions[k * 3 + 1],
      positions[k * 3 + 2],
      normals[k * 3 + 1],
      albedo,
      k * 3,
      FAR_STEEP.rings,
    );
  }
  const index = new Uint32Array(B * (R - 1) * 6);
  let o = 0;
  for (let j = R - 2; j >= 0; j--) {
    for (let i = 0; i < B; i++) {
      const i1 = (i + 1) % B;
      const a = j * B + i;
      const b = j * B + i1;
      const d = (j + 1) * B + i;
      const e = (j + 1) * B + i1;
      index.set([a, d, b, b, d, e], o);
      o += 6;
    }
  }
  return { positions, normals, albedo, index };
}

/** THE MAP'S OWN DISC: its heightfield on `n` × `n` samples (each the mean
 * of five reads, so the coarse grid does not alias the fine relief). */
export function discMesh(
  level: Pick<Level, "groundAt">,
  frame: FarFrame,
  look: RegionLook,
  n: number,
): FarMesh {
  const S = frame.size;
  const cell = S / (n - 1);
  const positions = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * cell;
      const z = j * cell;
      const q = cell * 0.3;
      const read = (u: number, v: number): number =>
        level.groundAt(Math.min(S, Math.max(0, u)), Math.min(S, Math.max(0, v)));
      const y =
        (2 * read(x, z) + read(x - q, z) + read(x + q, z) + read(x, z - q) + read(x, z + q)) / 6;
      positions.set([x, y, z], (j * n + i) * 3);
    }
  }
  const normals = gridNormals(positions, n, n, false);
  const albedo = new Float32Array(n * n * 3);
  for (let k = 0; k < n * n; k++) {
    const p = k * 3;
    albedoAt(
      frame,
      look,
      positions[p],
      positions[p + 1],
      positions[p + 2],
      normals[p + 1],
      albedo,
      p,
      FAR_STEEP.disc,
    );
  }
  const index = new Uint32Array((n - 1) * (n - 1) * 6);
  let o = 0;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      index.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], o);
      o += 6;
    }
  }
  return { positions, normals, albedo, index };
}

/** THE HORIZON a point sees along world heading `bearing`, rad over the
 * level: the steepest rise of the ground (`ground`) ahead of it out to
 * 100 km, the Earth's curve (the refracted sphere) taken off with the
 * distance. A key under it is behind the ranges. */
export function horizonToward(
  ground: (x: number, z: number) => number,
  x: number,
  y: number,
  z: number,
  bearing: number,
): number {
  const sx = Math.sin(bearing);
  const sz = Math.cos(bearing);
  let best = -0.5;
  for (let d = 90; d < 100_000; d *= 1.3) {
    const h = ground(x + sx * d, z + sz * d) - y - (d * d) / (2 * FAR_RADIUS);
    const e = Math.atan2(h, d);
    if (e > best) best = e;
  }
  return best;
}

/** The ground everywhere, as the horizon reads it: the map's own inside,
 * the far country past it. */
export function farGround(
  level: Pick<Level, "groundAt">,
  frame: FarFrame,
  grid: FarGrid,
): (x: number, z: number) => number {
  return (x, z) => farHeightAt(level, frame, grid, x, z);
}

/** The heights the light is reckoned at (`farKeys`), m in the map's frame:
 * the valley floor and up past the highest peaks. */
export function keyBands(frame: FarFrame): [number, number, number, number] {
  const f = frame.floor;
  const v = frame.vertical;
  return [f, f + 0.8 * v, f + 1.6 * v, f + 2.6 * v];
}

/** THE RIM the clipmap carries past the map's edge (`FAR_RIM_GLSL`): the
 * ground on a square grid `FAR_RIM.cell` m apart, from `FAR_RIM.reach` m
 * outside the map to as far outside the far side. `origin` its first
 * sample's plan position (x and z alike), `count` its samples a side;
 * `rise` / `drop` the most the rim stands over / under the edge it leaves. */
export type FarRimGrid = {
  readonly origin: number;
  readonly cell: number;
  readonly count: number;
  readonly heights: Float32Array;
  readonly rise: number;
  readonly drop: number;
};

export function rimGrid(
  level: Pick<Level, "groundAt">,
  frame: FarFrame,
  grid: FarGrid,
): FarRimGrid {
  const { reach, cell } = FAR_RIM;
  const origin = -reach;
  const count = Math.ceil((frame.size + 2 * reach) / cell) + 1;
  const heights = new Float32Array(count * count);
  let rise = 0;
  let drop = 0;
  for (let j = 0; j < count; j++) {
    for (let i = 0; i < count; i++) {
      const x = origin + i * cell;
      const z = origin + j * cell;
      const y = farHeightAt(level, frame, grid, x, z);
      heights[j * count + i] = y;
      const { beyond, qx, qz } = beyondEdge(frame.size, x, z);
      if (beyond > 0) {
        const d = y - edgeHeight(level, frame.size, qx, qz);
        rise = Math.max(rise, d);
        drop = Math.max(drop, -d);
      }
    }
  }
  return { origin, cell, count, heights, rise, drop };
}

/** The ring radii of a tier along bearing `a` — what the lab and the
 * suite read to check the spacing. */
export function ringRadii(size: number, rings: FarRings, outer: number, a: number): number[] {
  const r0 = edgeRadius(size, a);
  return Array.from({ length: rings.rows }, (_, j) =>
    ringRadius({ rows: rings.rows, inner: r0, outer }, j),
  );
}

/** THE RIM IN GLSL, for the clipmap's vertex shader (`snow-glsl.ts`): past
 * the map's edge the ground is the edge's own height plus the rim's rise
 * from it — the country the far ranges stand on, so the clipmap's last
 * ring and the rings past it agree. Off (`uFarRimBox.w` 0) it is the edge
 * carried flat. The rim is read with four exact fetches (a float texture
 * may not be filtered). */
export const FAR_RIM_GLSL = /* glsl */ `
uniform sampler2D uFarRim;
uniform vec4 uFarRimBox;
float farRimAt(vec2 p) {
  vec2 f = clamp((p - uFarRimBox.xy) / uFarRimBox.z, vec2(0.0), vec2(uFarRimBox.w - 1.001));
  ivec2 c = ivec2(floor(f));
  vec2 t = f - vec2(c);
  float a = texelFetch(uFarRim, c, 0).r;
  float b = texelFetch(uFarRim, c + ivec2(1, 0), 0).r;
  float d = texelFetch(uFarRim, c + ivec2(0, 1), 0).r;
  float e = texelFetch(uFarRim, c + ivec2(1, 1), 0).r;
  return mix(mix(a, b, t.x), mix(d, e, t.x), t.y);
}
float rimRise(vec2 p, vec2 q) {
  if (uFarRimBox.w < 2.0 || length(p - q) <= 0.0) return 0.0;
  return farRimAt(p) - farRimAt(q);
}
`;
