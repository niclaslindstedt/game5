// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAR RANGES' GROUND — the country round a map, out to the horizon, as
// heights: what `far-ranges-plan.ts` lays its rings over and the clipmap
// carries past the map's edge (`FAR_RIM_GLSL`).
//
// A map is one face of a mountain. The country round it is dealt here,
// never stored: a pure function of the map's seed on a salt of its own
// (`FAR_SALT`), read off the map's own frame — its valley floor, its
// vertical and its region — so the same seed always stands under the same
// skyline and nothing the engine deals or reads moves. On a REAL FACE the
// country is the real one, the elevation model baked coarsely round the
// face (`far-faces/`, `make far-faces`), and only where that is missing is
// it dealt in the face's region's character.
//
// WHAT THE RANGES ARE, by region (the numbers and their sources are in
// `docs/far-ranges.md`). Every map's +z runs down its fall line, so the
// summit ridge is the map's top edge (z = 0) and its valley floor the
// bottom (z = size): behind the ridge the main massif stands, its peaks
// higher than the map's own summit; across the valley the facing range;
// along it, both ways, the valley leads out between them. The relief is
// stated as multiples of the map's own vertical so the skyline keeps the
// proportions of the mountain the player skis:
//
//   alpine       jagged ridged crests 6.5 km apart, peaks to 1.9× the
//                map's vertical over the floor behind the summit, narrow
//                trough valleys, rock on every face too steep for snow
//   fell         low rounded fells 11 km apart, 0.2–0.55× — a long, low
//                horizon of plateaus and broad valleys
//   continental  broad massifs 10 km apart, 0.7–1.45×, wide valleys
//   maritime     steep ranges packed 4.2 km apart, 0.75–1.35×, deep narrow
//                valleys, snow held on all but the steepest walls
//
// Three-free and DOM-free; `tests/far_ranges_test.ts` reads all of it.

import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import type { Level, RegionId } from "@engine";

/** The far ranges' own salt: every draw here is a hash of the map's seed
 * and this, never `state.rng` and never the generator's streams. */
export const FAR_SALT = 0x4652_4e47;

/** How a region's far country is shaped. */
export type FarCharacter = {
  /** The peaks' height over the floor, × the map's vertical: across the
   * valley / along it (`[0]`) to behind the summit, the main massif (`[1]`). */
  readonly relief: readonly [number, number];
  /** How far apart the ridges stand, m. */
  readonly spacing: number;
  /** How sharp a crest is: the ridged noise's power — 2 and up a knife
   * edge, under 1 a rounded back. */
  readonly sharp: number;
  /** The main valley's half width at its floor, m. */
  readonly valley: number;
  /** How deep the side valleys cut, 0..1 of the relief. */
  readonly side: number;
  /** The valley floors' rise, m per km out from the map. */
  readonly rise: number;
};

export const FAR_CHARACTER: Readonly<Record<RegionId, FarCharacter>> = {
  alpine: { relief: [0.95, 1.9], spacing: 6500, sharp: 2.4, valley: 900, side: 0.7, rise: 9 },
  fell: { relief: [0.2, 0.55], spacing: 11000, sharp: 0.9, valley: 2500, side: 0.45, rise: 3 },
  continental: {
    relief: [0.7, 1.45],
    spacing: 10000,
    sharp: 1.7,
    valley: 1800,
    side: 0.55,
    rise: 6,
  },
  maritime: { relief: [0.75, 1.35], spacing: 4200, sharp: 2.0, valley: 700, side: 0.8, rise: 7 },
};

/** The map's own frame the far country is dealt in. */
export type FarFrame = {
  /** The map's side, m (the world is [0, size]²). */
  readonly size: number;
  /** The valley floor's height in the map's frame, m. */
  readonly floor: number;
  /** The map's vertical, m. */
  readonly vertical: number;
  /** The sea in the map's frame, m (a height's altitude is it less this). */
  readonly sea: number;
  /** The tree line in the map's frame, m. */
  readonly treeLine: number;
  readonly region: RegionId;
  /** The seed the country is dealt off (the map's, salted). */
  readonly seed: number;
};

/** The frame of `level`: off its published mountain, or a plain alpine one
 * standing on its lowest ground when it publishes none. */
export function farFrame(
  level: Pick<Level, "size" | "seed" | "mountain" | "region" | "groundAt">,
): FarFrame {
  const m = level.mountain;
  const region = level.region ?? "alpine";
  if (m) {
    return {
      size: level.size,
      floor: Math.min(m.base.y, m.summit.y),
      vertical: Math.max(200, m.vertical),
      sea: m.sea,
      treeLine: m.treeLine + m.sea,
      region,
      seed: (level.seed ^ FAR_SALT) | 0,
    };
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      const y = level.groundAt((i / 8) * level.size, (j / 8) * level.size);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  return {
    size: level.size,
    floor: lo,
    vertical: Math.max(200, hi - lo),
    sea: lo - 10,
    treeLine: lo + 0.55 * Math.max(200, hi - lo),
    region,
    seed: (level.seed ^ FAR_SALT) | 0,
  };
}

// ── Noise ───────────────────────────────────────────────────────────────

/** Gradient noise, ~[-1, 1]: a unit gradient at each lattice corner off
 * `hash2`, blended on the quintic fade. */
function perlin(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const dot = (cx: number, cz: number): number => {
    const a = hash2(ix + cx, iz + cz, seed) * Math.PI * 2;
    return Math.cos(a) * (fx - cx) + Math.sin(a) * (fz - cz);
  };
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = dot(0, 0) + (dot(1, 0) - dot(0, 0)) * ux;
  const b = dot(0, 1) + (dot(1, 1) - dot(0, 1)) * ux;
  return (a + (b - a) * uz) * 1.4;
}

/** Fractal gradient noise, ~[-1, 1], its first period `scale` m. */
export function fbm(x: number, z: number, scale: number, octaves: number, seed: number): number {
  let sum = 0;
  let norm = 0;
  let amp = 1;
  let f = 1 / scale;
  for (let o = 0; o < octaves; o++) {
    sum += amp * perlin(x * f, z * f, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** RIDGED noise, 0..1: the crests where the noise crosses nought, sharpened
 * by `sharp`, each octave weighted by the one under it so the fine relief
 * gathers on the crests and the valleys stay smooth. */
export function ridged(
  x: number,
  z: number,
  scale: number,
  octaves: number,
  sharp: number,
  seed: number,
): number {
  let sum = 0;
  let norm = 0;
  let amp = 1;
  let weight = 1;
  let f = 1 / scale;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(perlin(x * f, z * f, seed + o * 131));
    n = Math.pow(Math.max(0, n), sharp) * weight;
    weight = Math.min(1, Math.max(0, n * 1.7));
    sum += n * amp;
    norm += amp;
    amp *= 0.48;
    f *= 2.1;
  }
  return sum / norm;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// ── The dealt country ───────────────────────────────────────────────────

/** THE DEALT COUNTRY's height at (`x`, `z`), m in the map's frame — the
 * region's ranges round the map, with no regard yet for the map's own
 * edge (`farHeightAt` blends the two). */
export function dealtHeight(frame: FarFrame, x: number, z: number): number {
  const ch = FAR_CHARACTER[frame.region];
  const { size: S, vertical: V, seed } = frame;
  const sp = ch.spacing;
  // The crests bent off straight lines, so no range runs on a ruler.
  const wx = x + 0.4 * sp * fbm(x, z, 2.2 * sp, 2, seed + 11);
  const wz = z + 0.4 * sp * fbm(x + 5e5, z, 2.2 * sp, 2, seed + 12);
  const crest = ridged(wx, wz, sp, 6, ch.sharp, seed + 1);
  // The big massifs and the gaps between them.
  const mass = 0.5 + 0.5 * fbm(x, z, 5 * sp, 2, seed + 2);
  // Behind the summit ridge (z < 0) the main massif stands highest.
  const behind = smoothstep(0.4 * S, -2 * sp, z);
  const t = Math.min(1, Math.max(0, 0.65 * mass + 0.55 * behind - 0.1));
  const relief = V * (ch.relief[0] + (ch.relief[1] - ch.relief[0]) * t);
  // THE MAIN VALLEY the map's foot opens onto: along x past the bottom
  // edge, meandering, leading out both ways.
  const mid = S + 0.3 * ch.valley + 0.5 * sp * fbm(x, -7e5, 6 * sp, 2, seed + 3);
  const across = Math.abs(z - mid);
  const trough = 1 - smoothstep(ch.valley, ch.valley + 0.8 * sp, across);
  // THE SIDE VALLEYS, where a slow noise crosses nought.
  const sv = fbm(wx, wz, 2.4 * sp, 3, seed + 4);
  const side = 1 - smoothstep(0, 0.16, Math.abs(sv));
  // The valley floors climb gently away from the map.
  const out = Math.hypot(x - S / 2, z - S / 2) - S / 2;
  const floor = frame.floor + V * 0.03 + Math.max(0, out) * (ch.rise / 1000);
  return floor + relief * crest * (1 - trough) * (1 - ch.side * side);
}

// ── The polar grid the country is kept on ───────────────────────────────

/** A country kept on a POLAR grid round the map's middle: `bearings`
 * spokes (0 along +z, turning toward +x), `rows` rings spaced evenly in
 * the logarithm of the radius from `inner` to `outer` m — as fine near the
 * map as far out it is in angle. `heights` row-major by ring, m in the
 * map's frame. */
export type FarGrid = {
  readonly bearings: number;
  readonly rows: number;
  readonly inner: number;
  readonly outer: number;
  readonly heights: Float32Array;
  /** Where the heights came from: dealt off the seed, or the real face's. */
  readonly source: "dealt" | "real";
};

/** The dealt grid's layout: 256 spokes by 48 rings out to 100 km. */
export const FAR_GRID = { bearings: 256, rows: 48, inner: 1500, outer: 100_000 } as const;

/** The radius of ring `j` of `g`, m. */
export function ringRadius(g: Pick<FarGrid, "rows" | "inner" | "outer">, j: number): number {
  return g.inner * Math.pow(g.outer / g.inner, j / (g.rows - 1));
}

/** The country dealt for `frame` on the polar layout. */
export function dealtGrid(frame: FarFrame): FarGrid {
  const { bearings, rows, inner, outer } = FAR_GRID;
  const heights = new Float32Array(bearings * rows);
  const c = frame.size / 2;
  for (let j = 0; j < rows; j++) {
    const r = ringRadius(FAR_GRID, j);
    for (let i = 0; i < bearings; i++) {
      const a = (i / bearings) * Math.PI * 2;
      heights[j * bearings + i] = dealtHeight(frame, c + r * Math.sin(a), c + r * Math.cos(a));
    }
  }
  return { bearings, rows, inner, outer, heights, source: "dealt" };
}

/** The grid's height at (`x`, `z`), bilinear in the bearing and the
 * logarithm of the radius; past its outer ring, the outer ring's. */
export function gridHeight(g: FarGrid, size: number, x: number, z: number): number {
  const dx = x - size / 2;
  const dz = z - size / 2;
  const r = Math.max(g.inner, Math.hypot(dx, dz));
  let a = Math.atan2(dx, dz) / (Math.PI * 2);
  if (a < 0) a += 1;
  const fi = a * g.bearings;
  const fj = Math.min(
    g.rows - 1,
    (Math.log(r / g.inner) / Math.log(g.outer / g.inner)) * (g.rows - 1),
  );
  const i0 = Math.floor(fi) % g.bearings;
  const i1 = (i0 + 1) % g.bearings;
  const j0 = Math.min(g.rows - 2, Math.floor(fj));
  const ti = fi - Math.floor(fi);
  const tj = fj - j0;
  const h = g.heights;
  const B = g.bearings;
  const lo = h[j0 * B + i0] + (h[j0 * B + i1] - h[j0 * B + i0]) * ti;
  const hi = h[(j0 + 1) * B + i0] + (h[(j0 + 1) * B + i1] - h[(j0 + 1) * B + i0]) * ti;
  return lo + (hi - lo) * tj;
}

/** How far past the map's edge (`x`, `z`) stands, m (0 on it or inside),
 * and the edge point nearest it. */
export function beyondEdge(
  size: number,
  x: number,
  z: number,
): { beyond: number; qx: number; qz: number } {
  const qx = Math.min(size, Math.max(0, x));
  const qz = Math.min(size, Math.max(0, z));
  return { beyond: Math.hypot(x - qx, z - qz), qx, qz };
}

/** How far out from the edge the map's own ground is blended into the
 * country round it, m. */
export function blendReach(frame: FarFrame): number {
  return Math.max(1500, 0.45 * FAR_CHARACTER[frame.region].spacing);
}

/** The ground the far country needs of the map: its height, and its edge's
 * height smoothed along the edge (so the edge's fine relief is not drawn
 * out across the country as streaks). */
export type FarGround = Pick<Level, "groundAt">;

/** The map's edge at (`qx`, `qz`), averaged over 160 m along it. */
export function edgeHeight(level: FarGround, size: number, qx: number, qz: number): number {
  const alongX = qz <= 0 || qz >= size;
  let sum = 0;
  for (let k = -2; k <= 2; k++) {
    const o = k * 40;
    const x = alongX ? Math.min(size, Math.max(0, qx + o)) : qx;
    const z = alongX ? qz : Math.min(size, Math.max(0, qz + o));
    sum += level.groundAt(x, z);
  }
  return sum / 5;
}

/** THE GROUND ANYWHERE, m in the map's frame: the map's own inside it;
 * past its edge the edge's height carried out and eased into the country
 * (`grid`) over `blendReach` — so the two meet with no step and no seam. */
export function farHeightAt(
  level: FarGround,
  frame: FarFrame,
  grid: FarGrid,
  x: number,
  z: number,
): number {
  const { beyond, qx, qz } = beyondEdge(frame.size, x, z);
  if (beyond <= 0) return level.groundAt(x, z);
  // A real country meets the real face it was baked round: little to ease.
  const reach = grid.source === "real" ? 400 : blendReach(frame);
  const far = gridHeight(grid, frame.size, x, z);
  if (beyond >= reach) return far;
  // The edge's own height at the edge, smoothed along it within 200 m out.
  const own = level.groundAt(qx, qz);
  const edge = own + (edgeHeight(level, frame.size, qx, qz) - own) * smoothstep(0, 200, beyond);
  return edge + (far - edge) * smoothstep(0, reach, beyond);
}
