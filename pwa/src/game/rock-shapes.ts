// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS BUILT — every outcrop (the engine's `rocksOf`) as a knot of
// COARSE BLOCKS in the world frame: few triangles, all of them carrying
// the shape (no texture does it), flat-lit a facet at a time so a block
// catches the sun on one face and goes dark on the next.
//
// A BLOCK is broken rock, not a spike: where it stands and how big is the
// engine's (`rockBlock` — a skier meets the same block), the rest drawn
// here. A ring of four to six corners round its foot, on an ellipse long
// along the bedding and thinner across it, each sunk under the ground
// beneath IT (so a block on a steep face is buried on its uphill side, not
// perched); a SHOULDER ring a little under half way up, bulged out past
// the foot so the sides are steep and broken; a TOP ring, smaller and at
// uneven heights so the top is a few tilted facets; and a low hump over
// it. Fifteen to twenty-five triangles a block; the rubble round a knot's
// foot and a small block a ring fewer.
//
// SNOW HOLDS ON A FACET THAT FACES UP: past `SNOW_HOLDS` of the sky the
// facet is painted snow, between it and `SNOW_SLIDES` a mix, the rest the
// region's rock in a shade of its own a block. Three-free: plain arrays the
// draw (`rocks.ts`) hands the GPU and the suite counts.

import { rockDraw as unit, rockBlock, type Level, type Outcrop } from "@engine";

/** How dark a block's foot is, of its own colour. */
const FOOT = 0.45;
/** Rubble blocks a knot, for each of its standing ones. */
const RUBBLE = 1;
/** Under this tall, m, a block is built as rubble is, one ring fewer. */
const SMALL = 0.9;

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

/** Append the blocks of outcrop `o` to `m`, its rock `tone`. `share` 0..1
 * keeps that share of a knot's blocks (the rubble dropped first), so a
 * cheaper picture keeps the crags' outline. */
export function buildOutcrop(m: RockMesh, level: Level, o: Outcrop, tone: Tone, share = 1): void {
  const lean = Math.tan(o.dip);
  const sx = Math.sin(o.strike);
  const sz = Math.cos(o.strike);
  const stone = rockTone(tone);
  const keep = Math.max(1, Math.round(o.blocks * share));
  // THE RUBBLE round the knot's foot — low, broken lumps, so the ground
  // between the crags is uneven too; the first thing a cheap picture drops.
  const rubble = Math.round(o.blocks * RUBBLE * share * share);
  for (let k = 0; k < keep + rubble; k++) {
    const loose = k >= keep;
    // Where it stands and how big: the engine's layout, which a skier meets
    // (`rockBlock`); the rest of it — its facets, its paint — drawn here.
    const { x: cx, z: cz, height, long, thin, sink, hash: h } = rockBlock(o, k, loose);
    const sides = loose ? 4 : 4 + Math.floor(unit(h, 5) * 2);
    const ground = level.groundAt(cx, cz);
    // Never over the outcrop's own cap: a cliff's blocks stay under its lip.
    const cap = o.y + o.height;
    const top = Math.min(ground + height, cap);
    // The lean out of the face: the top of the block a little down the dip.
    const off = Math.min(height * lean, long * 0.3);
    const lx = Math.sin(o.dipHeading) * off;
    const lz = Math.cos(o.dipHeading) * off;
    const turn = (unit(h, 6) - 0.5) * 0.5;
    /** A ring of corners: `t` up the block (its share of the height), at
     * `size` of the foot's ellipse, each corner's own radius and height
     * jittered off draws from `n`. */
    const ring = (t: number, size: number, rough: number, lift: number, n: number): P[] => {
      const out: P[] = [];
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2 + turn + (unit(h, n + s) - 0.5) * (1.2 / sides);
        const r = size * (1 - rough / 2 + rough * unit(h, n + 10 + s));
        const u = Math.cos(a) * long * r;
        const v = Math.sin(a) * thin * r;
        const x = cx + sx * u + sz * v + lx * t;
        const z = cz + sz * u - sx * v + lz * t;
        const y =
          t === 0
            ? level.groundAt(x, z) - sink
            : Math.min(cap, ground + height * (t + (unit(h, n + 20 + s) - 0.5) * lift));
        out.push([x, y, z]);
      }
      return out;
    };
    // The block's own shade of the region's rock.
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
    // THE FOOT IN SHADOW: the sky is hidden from the cracks a block
    // stands in, so its colour darkens toward the snow it comes out of.
    const shadeAt = (p: P): number =>
      FOOT + (1 - FOOT) * Math.min(1, Math.max(0, (p[1] - ground + sink) / (height * 0.7 + sink)));
    const inside: P = [cx + lx * 0.4, ground + height * 0.4, cz + lz * 0.4];
    const band = (lo: P[], hi: P[]): void => {
      for (let s = 0; s < sides; s++) {
        const s1 = (s + 1) % sides;
        tri(m, lo[s], lo[s1], hi[s1], inside, paint, shadeAt);
        tri(m, lo[s], hi[s1], hi[s], inside, paint, shadeAt);
      }
    };
    const fan = (ring: P[], apex: P): void => {
      for (let s = 0; s < sides; s++)
        tri(m, ring[s], ring[(s + 1) % sides], apex, inside, paint, shadeAt);
    };
    const foot = ring(0, 1, 0.3, 0, 10);
    const hump: P = [
      cx + lx + (unit(h, 7) - 0.5) * long * 0.3,
      top,
      cz + lz + (unit(h, 8) - 0.5) * thin * 0.3,
    ];
    if (loose || height < SMALL) {
      // Rubble and a small block: a foot and a lumpy top.
      const crown = ring(0.7, 0.75, 0.4, 0.3, 50);
      band(foot, crown);
      fan(crown, hump);
    } else {
      // A block: steep, broken sides bulged at the shoulder, a top of a
      // few tilted facets and a low hump.
      const shoulder = ring(0.35 + 0.2 * unit(h, 31), 1.05, 0.4, 0.3, 50);
      const crown = ring(0.8, 0.62, 0.5, 0.3, 80);
      band(foot, shoulder);
      band(shoulder, crown);
      fan(crown, hump);
    }
  }
}

/** A fresh, empty mesh. */
export const rockMesh = (): RockMesh => ({ pos: [], nrm: [], col: [] });
