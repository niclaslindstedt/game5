// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOUNTAIN'S OWN SHADOW — a ridge, a spur, a headwall shading the snow
// down-sun of it — as a HORIZON MAP baked once a map. Three-free and
// DOM-free, so `tests/terrain_shadow_test.ts` reads the whole model;
// `environment.ts` bakes it and hands it to the GPU, and `haze.ts` reads it
// back in every world material and in every caster's depth pass.
//
// WHY A HORIZON AND NOT A SHADOW MAP. The key light's shadow map covers a
// circle a SHADOWS row's reach round the lens (`shadow-box.ts`) at a few
// centimetres a texel, which is what a skier's shadow needs; a spur's
// shadow is a kilometre long and has to reach across the whole face. And
// drawing the clipmap into that map would be every vertex of the ground a
// second time a frame, with acne on every slope the low sun grazes. But the
// key stands STILL for the whole run (`sunAtRun` — the moon's the same),
// and so does the ground, so the question "can this point see the key?" has
// one answer a point for the whole run. The map stores, for every texel of
// a grid over the whole map, the HORIZON: the highest elevation angle the
// ground rises to seen from that point, looking along the key's bearing.
// A point is lit when the key stands over its horizon — and since the angle
// is stored rather than the verdict, the key's ELEVATION may change (a sky
// picked on a card, the evening's moon) without a new bake; only a new
// BEARING needs one.
//
// THE BAKE IS ONE SWEEP (Stewart's horizon by convex hull): the grid is
// walked in lines parallel to the key's bearing, each from the end nearest
// the key to the end furthest from it. The point on the ground that sets a
// point's horizon is always on the UPPER CONVEX HULL of the profile walked
// so far, and the hull is kept as a stack the monotone-chain way — every
// profile point is pushed once and popped at most once — so a line of `n`
// points costs `O(n)`, and the whole map a couple of passes over its texels,
// however long the shadows. The lines are then resampled onto the map's own
// grid.
//
// SOFT, AND AS WIDE AS THE SUN. The sun is a disc half a degree across, so
// a shadow's edge is a penumbra that widens with the distance to what casts
// it — which a fixed ANGULAR band round the horizon is: `band` either side,
// read per pixel off the interpolated angle, so the edge is smooth however
// coarse the texel. A key under a lid is a glow with no shadow worth the
// name, and that is already the key's own intensity (`sky.ts`): the map
// takes the direct light away and leaves the sky, the one shadow model the
// real-time map already draws — blue, because what fills it is the sky.

import type { Heightfield } from "@engine";

export const TERRAIN_SHADOW = {
  /** The most texels a side the horizon grid holds: the ground's own cell
   * doubled until it fits — four metres a texel on a three-kilometre map. */
  texels: 1024,
  /** Half the band the key crosses from shade to sun, rad: the sun's own
   * disc and a little over, so the penumbra reads as the soft edge of a
   * mountain's shadow and the grid's texels never show. */
  band: 0.012,
  /** How far the key may stand UNDER a point's horizon and still light it
   * half, rad: the ground's cell is coarser than the drawn snow, and a
   * slope the key grazes must not break into speckled shade. */
  bias: 0.006,
  /** How far the key's bearing may move, rad, before the map is baked again
   * (a sky picked by hand, the moon taking over from the sun). */
  rebake: 0.004,
  /** Past the map's edge the ground is the rim's own noise, which the bake
   * never saw: the shade fades out over this many metres beyond the edge. */
  rim: 60,
} as const;

/** A baked horizon: the grid (world origin of texel 0, its pitch, its
 * size), the key's bearing it was baked along, and each texel's horizon
 * elevation, rad (−π/2 where nothing rises toward the key). */
export type HorizonMap = {
  originX: number;
  originZ: number;
  cell: number;
  cols: number;
  rows: number;
  /** The key's plan bearing, rad — heading convention, 0 along +z. */
  bearing: number;
  data: Float32Array;
};

/** A direction toward the key light, world frame. */
export type KeyDir = { x: number; y: number; z: number };

/** The key's plan bearing, rad (heading convention: 0 = +z, clockwise). */
export function keyBearing(key: KeyDir): number {
  return Math.atan2(key.x, key.z);
}

/** The key's elevation over the horizon, rad. */
export function keyElevation(key: KeyDir): number {
  return Math.asin(Math.max(-1, Math.min(1, key.y)));
}

/** Whether two bearings, rad, are one as far as a bake is concerned. */
export function sameBearing(a: number, b: number): boolean {
  let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d <= TERRAIN_SHADOW.rebake;
}

/** Whether a map baked along `map.bearing` still stands for `key`. */
export function bakedFor(map: HorizonMap | null, key: KeyDir): boolean {
  return map !== null && sameBearing(map.bearing, keyBearing(key));
}

/** The slope stored where nothing rises toward the key: steep enough to
 * read as straight down once it is an angle. */
const NO_SLOPE = -1e3;

/**
 * Bake the horizon over `ground` along the plan bearing `bearing` (toward
 * the key). `texels` caps the grid's side; the grid shares the ground's
 * origin and takes a whole multiple of its cell.
 */
export function bakeHorizon(
  ground: Heightfield,
  bearing: number,
  texels: number = TERRAIN_SHADOW.texels,
): HorizonMap {
  const { originX, originZ, cols: gc, rows: gr, data: h } = ground;
  const step = Math.max(1, Math.ceil((Math.max(gc, gr) - 1) / Math.max(1, texels - 1)));
  const cell = ground.cell * step;
  const cols = Math.floor((gc - 1) / step) + 1;
  const rows = Math.floor((gr - 1) / step) + 1;

  // The sweep's frame: `u` along the bearing (toward the key), `v` across
  // it, both about the map's centre so the numbers stay small.
  const ax = Math.sin(bearing);
  const az = Math.cos(bearing);
  const bx = az;
  const bz = -ax;
  const cx = originX + ((cols - 1) * cell) / 2;
  const cz = originZ + ((rows - 1) * cell) / 2;
  const hx = ((cols - 1) * cell) / 2;
  const hz = ((rows - 1) * cell) / 2;
  const uHalf = Math.abs(ax) * hx + Math.abs(az) * hz;
  const vHalf = Math.abs(bx) * hx + Math.abs(bz) * hz;
  const nu = Math.ceil((2 * uHalf) / cell) + 1;
  const nv = Math.ceil((2 * vHalf) / cell) + 1;
  const u0 = -uHalf;
  const v0 = -vHalf;

  // Each line's horizon as a SLOPE, rise over run, [line][point] — the
  // angle is taken once a texel, after the resample — and the hull as two
  // stacks. The ground is read bilinear and clamped to its edge, as
  // `sampleField` reads it, inlined: the sweep reads it a million times. A
  // line's ends past the map read the edge's own heights — a shelf as high
  // as the rim, never higher, so it shades nothing the rim itself would not.
  const maxC = gc - 1;
  const maxR = gr - 1;
  const inv = 1 / ground.cell;
  const lines = new Float32Array(nu * nv);
  const hullU = new Float64Array(nu);
  const hullH = new Float64Array(nu);
  for (let j = 0; j < nv; j++) {
    const v = v0 + j * cell;
    const lx = cx + v * bx;
    const lz = cz + v * bz;
    let top = 0;
    const row = j * nu;
    for (let i = nu - 1; i >= 0; i--) {
      const u = u0 + i * cell;
      let fx = (lx + u * ax - originX) * inv;
      let fz = (lz + u * az - originZ) * inv;
      fx = fx <= 0 ? 0 : fx >= maxC ? maxC : fx;
      fz = fz <= 0 ? 0 : fz >= maxR ? maxR : fz;
      const c0 = fx | 0;
      const r0 = fz | 0;
      const k = r0 * gc + c0;
      const dc = c0 < maxC ? 1 : 0;
      const dr = r0 < maxR ? gc : 0;
      const tx = fx - c0;
      const tz = fz - r0;
      const ha = h[k];
      const hb = h[k + dc];
      const hc = h[k + dr];
      const y = (ha + (hb - ha) * tx) * (1 - tz) + (hc + (h[k + dr + dc] - hc) * tx) * tz;
      // Pop what the new point sees past: a hull point on or under the
      // line from the new point to the one behind it.
      while (top >= 2) {
        const lu = hullU[top - 1] - u;
        const lh = hullH[top - 1] - y;
        const su = hullU[top - 2] - u;
        const sh = hullH[top - 2] - y;
        if (sh * lu >= lh * su) top--;
        else break;
      }
      lines[row + i] = top > 0 ? (hullH[top - 1] - y) / (hullU[top - 1] - u) : NO_SLOPE;
      hullU[top] = u;
      hullH[top] = y;
      top++;
    }
  }

  // Onto the map's own grid, bilinear between the lines.
  const data = new Float32Array(cols * rows);
  const lastU = nu - 1;
  const lastV = nv - 1;
  for (let r = 0; r < rows; r++) {
    const dz = originZ + r * cell - cz;
    for (let c = 0; c < cols; c++) {
      const dx = originX + c * cell - cx;
      let fi = (dx * ax + dz * az - u0) / cell;
      let fj = (dx * bx + dz * bz - v0) / cell;
      fi = fi <= 0 ? 0 : fi >= lastU ? lastU : fi;
      fj = fj <= 0 ? 0 : fj >= lastV ? lastV : fj;
      const i0 = Math.floor(fi);
      const j0 = Math.floor(fj);
      const i1 = i0 < lastU ? i0 + 1 : i0;
      const j1 = j0 < lastV ? j0 + 1 : j0;
      const ti = fi - i0;
      const tj = fj - j0;
      const a = lines[j0 * nu + i0];
      const b = lines[j0 * nu + i1];
      const d = lines[j1 * nu + i0];
      const e = lines[j1 * nu + i1];
      data[r * cols + c] = Math.atan((a + (b - a) * ti) * (1 - tj) + (d + (e - d) * ti) * tj);
    }
  }
  return { originX, originZ, cell, cols, rows, bearing, data };
}

/** The horizon at a world point, rad: bilinear, clamped to the grid. */
export function horizonAt(map: HorizonMap, x: number, z: number): number {
  const maxC = map.cols - 1;
  const maxR = map.rows - 1;
  let fx = (x - map.originX) / map.cell;
  let fz = (z - map.originZ) / map.cell;
  fx = fx <= 0 ? 0 : fx >= maxC ? maxC : fx;
  fz = fz <= 0 ? 0 : fz >= maxR ? maxR : fz;
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fz);
  const c1 = c0 < maxC ? c0 + 1 : c0;
  const r1 = r0 < maxR ? r0 + 1 : r0;
  const tx = fx - c0;
  const tz = fz - r0;
  const d = map.data;
  const a = d[r0 * map.cols + c0];
  const b = d[r0 * map.cols + c1];
  const c = d[r1 * map.cols + c0];
  const e = d[r1 * map.cols + c1];
  return (a + (b - a) * tx) * (1 - tz) + (c + (e - c) * tx) * tz;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** How much of the key reaches a point whose horizon is `horizon` rad, the
 * key `elevation` rad up: 0 in the mountain's shade … 1 in the key. The
 * shader's `terrainLit` is this, per pixel. */
export function sunlitShare(horizon: number, elevation: number): number {
  const { band, bias } = TERRAIN_SHADOW;
  return smoothstep(-band, band, elevation - horizon + bias);
}

/** `sunlitShare` at a world point of a baked map. */
export function terrainLitAt(map: HorizonMap, x: number, z: number, key: KeyDir): number {
  return sunlitShare(horizonAt(map, x, z), keyElevation(key));
}

/** THE SAME ANSWER IN GLSL, for every world material (`haze.ts`) and every
 * caster's depth pass. `uTerrainShade` is the horizon map (R16F, linear);
 * `uTerrainShadeBox` maps a world plan point to its uv (the origin less
 * half a texel, and one over the grid's span); `uTerrainShadeOn.x` is 0
 * while there is no map, and every point is then lit. `uSunDir` is the
 * KEY's direction (`SKY_GLSL`). */
export const TERRAIN_SHADOW_GLSL = /* glsl */ `
uniform sampler2D uTerrainShade;
uniform vec4 uTerrainShadeBox;
uniform vec4 uTerrainShadeOn;
float terrainLit(vec3 world) {
  if (uTerrainShadeOn.x < 0.5) return 1.0;
  vec2 uv = (world.xz - uTerrainShadeBox.xy) * uTerrainShadeBox.zw;
  float horizon = texture2D(uTerrainShade, uv).r;
  float elevation = asin(clamp(uSunDir.y, -1.0, 1.0));
  float lit = smoothstep(-${TERRAIN_SHADOW.band.toFixed(4)}, ${TERRAIN_SHADOW.band.toFixed(4)},
    elevation - horizon + ${TERRAIN_SHADOW.bias.toFixed(4)});
  // Past the map's edge, the rim's own noise the bake never saw: lit.
  vec2 past = max(max(-uv, uv - 1.0), 0.0) / uTerrainShadeBox.zw;
  return mix(lit, 1.0, smoothstep(0.0, ${TERRAIN_SHADOW.rim.toFixed(1)}, length(past)));
}
`;
