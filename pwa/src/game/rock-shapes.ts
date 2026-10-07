// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS BUILT — every outcrop (`rock-plan.ts`) as a knot of sharp,
// faceted SHARDS in the world frame: few triangles, all of them carrying
// the shape (no texture does it), flat-lit a facet at a time so the blades
// catch the sun on one side and go dark on the other.
//
// A SHARD is a slab stood on end: a base of four or five points on an
// ellipse long along the outcrop's strike and thin across it, each point
// sunk under the ground beneath IT (so a shard on a 40° face is buried on
// its uphill side, not perched), drawn up to a point leaned off plumb by
// the outcrop's dip. A tall one is broken half way up — a ring of its own,
// shoved in and out — so its faces kink the way split rock does. Five to
// fifteen triangles a shard.
//
// SNOW HOLDS ON A FACET THAT FACES UP: past `SNOW_HOLDS` of the sky the
// facet is painted snow, between it and `SNOW_SLIDES` a mix, the rest the
// region's rock in a shade of its own a shard. Three-free: plain arrays the
// draw (`rocks.ts`) hands the GPU and the suite counts.

import type { Level } from "@engine";

import { hashOf, unit, type Outcrop } from "./rock-plan.ts";

/** The share of standing shards that are blades. */
const BLADES = 0.3;
/** How dark a shard's foot is, of its own colour. */
const FOOT = 0.45;
/** Rubble shards a knot, for each of its standing ones. */
const RUBBLE = 1.5;

/** Linear 0..1 RGB, the way `region-look.ts` authors its tones. */
export type Tone = readonly [number, number, number];

/** The facet's up share (its normal's y) snow lies whole on, and the one
 * it slides off below. */
export const SNOW_HOLDS = 0.62;
export const SNOW_SLIDES = 0.42;
/** The region's rock tone as the crags paint it: the region's hue, warmed
 * a little and brought to one VALUE (`ROCK_VALUE`, linear luminance) —
 * the shader's tone is that rock seen through a skin of snow and
 * spindrift, and bare stone is a weathered grey-brown, never the
 * near-black a dark albedo under a blue sky turns to nor the beige a pale
 * one goes in flat light. */
const WARM: Tone = [1.08, 1.0, 0.88];
export const ROCK_VALUE = 0.27;
export function rockTone(tone: Tone): Tone {
  const r = tone[0] * WARM[0];
  const g = tone[1] * WARM[1];
  const b = tone[2] * WARM[2];
  const k = ROCK_VALUE / Math.max(1e-3, 0.2126 * r + 0.7152 * g + 0.0722 * b);
  return [r * k, g * k, b * k];
}
/** Snow on rock, linear — a shade under the open snow's glare, lying thin. */
const SNOW: Tone = [0.86, 0.89, 0.94];

/** The triangles a run of outcrops makes: positions, flat normals and
 * colours, three floats a vertex, three vertices a triangle. */
export type RockMesh = {
  readonly pos: number[];
  readonly nrm: number[];
  readonly col: number[];
};

type P = [number, number, number];

/** A triangle, wound so its normal points away from `inside`. */
function tri(
  m: RockMesh,
  a: P,
  b: P,
  c: P,
  inside: P,
  paint: (ny: number) => Tone,
  shadeAt: (p: P) => number,
): void {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const ez = b[2] - a[2];
  const fx = c[0] - a[0];
  const fy = c[1] - a[1];
  const fz = c[2] - a[2];
  let nx = ey * fz - ez * fy;
  let ny = ez * fx - ex * fz;
  let nz = ex * fy - ey * fx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  const mx = (a[0] + b[0] + c[0]) / 3 - inside[0];
  const my = (a[1] + b[1] + c[1]) / 3 - inside[1];
  const mz = (a[2] + b[2] + c[2]) / 3 - inside[2];
  let q = b;
  let r = c;
  if (nx * mx + ny * my + nz * mz < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
    q = c;
    r = b;
  }
  const col = paint(ny);
  for (const p of [a, q, r]) {
    const k = shadeAt(p);
    m.pos.push(p[0], p[1], p[2]);
    m.nrm.push(nx, ny, nz);
    m.col.push(col[0] * k, col[1] * k, col[2] * k);
  }
}

/** Append the shards of outcrop `o` to `m`, its rock `tone`. `share` 0..1
 * keeps that share of a knot's shards (the smallest dropped first), so a
 * cheaper picture keeps the crags' outline. */
export function buildOutcrop(m: RockMesh, level: Level, o: Outcrop, tone: Tone, share = 1): void {
  const sx = Math.sin(o.strike);
  const sz = Math.cos(o.strike);
  const lean = Math.tan(o.dip);
  const stone = rockTone(tone);
  const keep = Math.max(1, Math.round(o.shards * share));
  // THE RUBBLE round the knot's foot — low, broken teeth, so the ground
  // between the crags is uneven too; the first thing a cheap picture drops.
  const rubble = Math.round(o.shards * RUBBLE * share * share);
  for (let k = 0; k < keep + rubble; k++) {
    const h = hashOf(o.hash, 100 + k);
    const loose = k >= keep;
    // The first shard is the knot's tallest, at its middle; the rest
    // strung out along the strike, a little to either side of it; the
    // rubble scattered wider round them.
    const reach = loose ? o.spread * 1.5 : o.spread;
    const along = k === 0 ? 0 : (unit(h, 0) - 0.5) * 2 * reach;
    const across = k === 0 ? 0 : (unit(h, 1) - 0.5) * (loose ? 1.2 : 0.45) * reach;
    const cx = o.x + sx * along + sz * across;
    const cz = o.z + sz * along - sx * across;
    const height =
      k === 0 ? o.height : o.height * (loose ? 0.1 + 0.2 * unit(h, 2) : 0.28 + 0.6 * unit(h, 2));
    // A slab: long along the strike, thinner across it, and still twice
    // as tall as it is long — pointy, but rock, not an icicle.
    // A third of the standing ones are BLADES — a fin run out along the
    // strike, the shape a split bed of rock stands in.
    const blade = !loose && unit(h, 32) < BLADES ? 1.9 : 1;
    const long = height * (0.4 + 0.32 * unit(h, 3)) * blade;
    const thin = long * (0.5 + 0.35 * unit(h, 4));
    const sides = unit(h, 5) < 0.5 ? 4 : 5;
    const sink = 0.2 + height * 0.18;
    const ground = level.groundAt(cx, cz);
    const base: P[] = [];
    const turn = (unit(h, 6) - 0.5) * 0.5;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + turn + (unit(h, 10 + s) - 0.5) * (1.4 / sides);
      const r = 0.75 + 0.45 * unit(h, 20 + s);
      const u = Math.cos(a) * long * r;
      const v = Math.sin(a) * thin * r;
      const x = cx + sx * u + sz * v;
      const z = cz + sz * u - sx * v;
      base.push([x, level.groundAt(x, z) - sink, z]);
    }
    // The point, leaned off plumb along the dip and a hair off it.
    const off = Math.min(height * lean, long * 0.9);
    const tipX = cx + Math.sin(o.dipHeading) * off + (unit(h, 7) - 0.5) * long * 0.4;
    const tipZ = cz + Math.cos(o.dipHeading) * off + (unit(h, 8) - 0.5) * long * 0.4;
    const tip: P = [tipX, ground + height, tipZ];
    // The shard's own shade of the region's rock.
    const shade = 0.78 + 0.44 * unit(h, 9);
    const warm = (unit(h, 30) - 0.5) * 0.04;
    const paint = (ny: number): Tone => {
      const f = 0.8 + 0.4 * unit(h, 40 + Math.round(ny * 50));
      const rock: Tone = [
        stone[0] * shade * f * (1 + warm),
        stone[1] * shade * f,
        stone[2] * shade * f * (1 - warm),
      ];
      const snow = Math.max(0, Math.min(1, (ny - SNOW_SLIDES) / (SNOW_HOLDS - SNOW_SLIDES)));
      return [
        rock[0] + (SNOW[0] - rock[0]) * snow,
        rock[1] + (SNOW[1] - rock[1]) * snow,
        rock[2] + (SNOW[2] - rock[2]) * snow,
      ];
    };
    // THE FOOT IN SHADOW: the sky is hidden from the cracks a shard
    // stands in, so its colour darkens toward the snow it comes out of.
    const shadeAt = (p: P): number =>
      FOOT + (1 - FOOT) * Math.min(1, Math.max(0, (p[1] - ground + sink) / (height * 0.7 + sink)));
    const axis = (t: number): P => [
      cx + (tipX - cx) * t,
      ground + height * t,
      cz + (tipZ - cz) * t,
    ];
    if (height > 1.5) {
      // BROKEN half way up: a ring between the base and the point, each
      // corner shoved in or out, so the faces kink.
      const t = 0.4 + 0.2 * unit(h, 31);
      const mid = axis(t);
      const ring: P[] = base.map((b, s) => {
        const push = 0.75 + 0.55 * unit(h, 50 + s);
        return [
          mid[0] + (b[0] - cx) * (1 - t) * push,
          b[1] + (tip[1] - b[1]) * t,
          mid[2] + (b[2] - cz) * (1 - t) * push,
        ];
      });
      const low = axis(t * 0.5);
      const high = axis((1 + t) / 2);
      for (let s = 0; s < sides; s++) {
        const s1 = (s + 1) % sides;
        tri(m, base[s], base[s1], ring[s1], low, paint, shadeAt);
        tri(m, base[s], ring[s1], ring[s], low, paint, shadeAt);
        tri(m, ring[s], ring[s1], tip, high, paint, shadeAt);
      }
    } else {
      const inside = axis(0.3);
      for (let s = 0; s < sides; s++) {
        tri(m, base[s], base[(s + 1) % sides], tip, inside, paint, shadeAt);
      }
    }
  }
}

/** A fresh, empty mesh. */
export const rockMesh = (): RockMesh => ({ pos: [], nrm: [], col: [] });
