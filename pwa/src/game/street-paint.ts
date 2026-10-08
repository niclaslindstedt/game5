// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREETS, PAINTED IN CODE — the three textures the street
// surfaces (`street-plan.ts`) are laid in, as a mountain village's streets
// look in winter (`docs/buildings.md`, "The village and its streets"):
//
//   * ROAD — one lane and its kerbside strip across (u 0 the crown, ½ the
//     lane's edge, 1 the kerb), `TILE.road` m along: the packed snow white
//     and a little glazed, the two WHEEL RUTS of each lane pressed darker
//     and wetter where the tyres run, grit — brown-grey chippings — thrown
//     thickest in the ruts and thinned out of them, the crown a ridge of
//     whiter, looser snow between the lanes, the edge loose and white
//     where the plough left it;
//   * AREA — the car park's and the junctions' packed snow, tyre tracks
//     criss-crossing it, gritted;
//   * WALK — the sidewalk: granite setts showing through a skin of packed,
//     gritted snow; and the SQUARE's, the same setts under more snow, on a
//     wider tile so its pattern does not repeat across the open place.
//
// Every texture tiles (its noise is wrapped on its own period), so a
// street of any length is one ribbon. sRGB 0..255 RGBA, three-free.

import { TILE } from "./street-plan.ts";

/** A painted texture: its size in pixels and its RGBA bytes. */
export type Paint = { width: number; height: number; data: Uint8Array };

/** A hash of an integer lattice point to 0..1. */
function hash(i: number, j: number, salt: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise on a lattice `cell` px wide, wrapped every `wx` × `wy` px. */
function noise(x: number, y: number, cell: number, wx: number, wy: number, salt: number): number {
  const nx = Math.max(1, Math.round(wx / cell));
  const ny = Math.max(1, Math.round(wy / cell));
  const fx = x / cell;
  const fy = y / cell;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const at = (a: number, b: number) => hash(((a % nx) + nx) % nx, ((b % ny) + ny) % ny, salt);
  const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
  const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
  return a + (b - a) * sy;
}

/** Fractal noise: four octaves of `noise`, 0..1. */
function fbm(x: number, y: number, cell: number, wx: number, wy: number, salt: number): number {
  let sum = 0;
  let amp = 0.5;
  let c = cell;
  let total = 0;
  for (let o = 0; o < 4; o++) {
    sum += noise(x, y, c, wx, wy, salt + o * 17) * amp;
    total += amp;
    amp *= 0.5;
    c = Math.max(1, c / 2);
  }
  return sum / total;
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The colours, sRGB: the packed snow; the loose snow at a road's crown and
 * edge; a rut's pressed, wetted snow; the grit's chippings, dark and pale;
 * a granite sett and the joint between two. */
const PACKED = [226, 229, 234];
const LOOSE = [244, 246, 250];
const RUT = [178, 176, 176];
const GRIT_DARK = [96, 84, 74];
const GRIT_PALE = [150, 136, 118];
const SETT = [138, 138, 142];
const JOINT = [84, 82, 84];

function mix(a: readonly number[], b: readonly number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Lay grit over a pixel: chippings scattered at `density` (0..1), dark
 * and pale, a pixel or two across. */
function grit(c: number[], x: number, y: number, density: number, salt: number): number[] {
  // Chippings a few millimetres across are finer than a texel: a scatter
  // of faint specks, a few stronger, that read as a brownish dusting.
  const h = hash(x, y, salt);
  if (h > density * 0.22) return c;
  const pale = hash(x, y, salt + 3) < 0.5;
  const k = hash(x, y, salt + 5);
  return mix(c, pale ? GRIT_PALE : GRIT_DARK, 0.12 + 0.3 * k * k);
}

function put(d: Uint8Array, k: number, c: readonly number[]): void {
  d[k * 4] = Math.max(0, Math.min(255, c[0]));
  d[k * 4 + 1] = Math.max(0, Math.min(255, c[1]));
  d[k * 4 + 2] = Math.max(0, Math.min(255, c[2]));
  d[k * 4 + 3] = 255;
}

/** THE ROAD: `width` px across a lane and its strip, `height` px along
 * `TILE.road` m. Across, u 0..½ is a lane of some 3.2 m (its two ruts a
 * car's track apart, their middles 0.75 and 2.35 m out from the crown),
 * u ½..1 the strip to the kerb. */
export function paintRoad(width = 128, height = 512): Paint {
  const data = new Uint8Array(width * height * 4);
  const lane = 3.2;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const u = (i + 0.5) / width;
      // The ruts wander a little along the road, as each car's line does.
      const wob =
        (noise(0, j, 48, 1, height, 11) - 0.5) * 0.18 +
        (noise(0, j, 9, 1, height, 12) - 0.5) * 0.05;
      const tone = fbm(i, j, 24, width, height, 1);
      let c = mix(PACKED, LOOSE, 0.25 + 0.3 * tone);
      let g = 0.25;
      if (u < 0.5) {
        const m = (u / 0.5) * lane;
        // Two ruts, each a soft-edged band some 0.35 m wide.
        let rut = 0;
        for (const r of [0.75, 2.35]) {
          const d = Math.abs(m - r - wob);
          rut = Math.max(rut, 1 - smooth(0.12, 0.26, d));
        }
        // Pressed unevenly: polished in places, a skin of new snow in others.
        const press = rut * (0.55 + 0.45 * fbm(i, j, 14, width, height, 2));
        c = mix(c, RUT, press);
        // The ridge between the ruts and the crown: a little loose snow.
        const crown = 1 - smooth(0.05, 0.4, m);
        const ridge = 1 - smooth(0.1, 0.35, Math.abs(m - 1.55 - wob));
        c = mix(c, LOOSE, Math.max(crown * 0.7, ridge * 0.25));
        // The lane's edge loose where the plough feathered it.
        c = mix(c, LOOSE, smooth(2.9, 3.2, m) * 0.6);
        g = 0.35 + rut * 0.65;
        // A tyre's tread, faintly, in the ruts.
        if (rut > 0.5 && (j + Math.floor(m * 20)) % 6 === 0) c = mix(c, RUT, 0.25 * rut);
      } else {
        // The strip to the kerb: packed by parked cars, a tyre mark here and
        // there, loose snow growing to the kerb.
        const k = (u - 0.5) / 0.5;
        c = mix(c, LOOSE, smooth(0.5, 1, k) * 0.8);
        const mark = noise(i, j, 32, width, height, 7);
        if (mark > 0.62 && k < 0.7) c = mix(c, RUT, (mark - 0.62) * 1.2);
        g = 0.2 * (1 - k);
      }
      c = grit(c, i, j, g, 101);
      // A faint glaze: the sun's melt refrozen, a cool sheen.
      const glaze = smooth(0.6, 0.8, fbm(i, j, 40, width, height, 9)) * 0.08;
      c = mix(c, [205, 214, 226], glaze);
      put(data, j * width + i, c);
    }
  }
  return { width, height, data };
}

/** THE PACKED AREA: `size` px square over `TILE.area` m. */
export function paintArea(size = 256): Paint {
  const data = new Uint8Array(size * size * 4);
  const perM = size / TILE.area;
  // A handful of tyre tracks across the tile, each a pair of ruts on a
  // straight line wrapped round the tile.
  const tracks: { a: number; b: number; ang: number }[] = [];
  for (let t = 0; t < 6; t++) {
    tracks.push({
      a: hash(t, 1, 31) * size,
      b: hash(t, 2, 31) * size,
      ang: (Math.floor(hash(t, 3, 31) * 4) * Math.PI) / 4,
    });
  }
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const tone = fbm(i, j, 32, size, size, 21);
      let c = mix(PACKED, LOOSE, 0.2 + 0.35 * tone);
      let rut = 0;
      for (const tr of tracks) {
        // The distance across the track, wrapped so it tiles.
        const nx = Math.cos(tr.ang);
        const nz = Math.sin(tr.ang);
        let d = (i - tr.a) * nx + (j - tr.b) * nz;
        d = (((d % size) + size * 1.5) % size) - size / 2;
        for (const off of [-0.8, 0.8]) {
          rut = Math.max(rut, 1 - smooth(0.1 * perM, 0.2 * perM, Math.abs(d / perM - off) * perM));
        }
      }
      c = mix(c, RUT, rut * (0.35 + 0.35 * fbm(i, j, 10, size, size, 22)));
      c = grit(c, i, j, 0.3 + rut * 0.5, 202);
      put(data, j * size + i, c);
    }
  }
  return { width: size, height: size, data };
}

/** THE SIDEWALK: `size` px square over `TILE.walk` m — granite setts
 * some 0.2 m a side in courses, their joints dark, under a skin of packed
 * snow worn through in patches and gritted. u runs across the walk from
 * the kerb, v along it. */
export function paintWalk(size = 256, tile: number = TILE.walk, snow = 0.45): Paint {
  const data = new Uint8Array(size * size * 4);
  const perM = size / tile;
  const sett = 0.2 * perM;
  for (let j = 0; j < size; j++) {
    const row = Math.floor(j / sett);
    for (let i = 0; i < size; i++) {
      // Courses laid across the walk, each a half sett along from the last.
      const shift = (row % 2) * sett * 0.5;
      const ci = Math.floor((i + shift) / sett);
      const fx = ((i + shift) % sett) / sett;
      const fy = (j % sett) / sett;
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
      const own = hash(ci, row, 41);
      let stone = mix(SETT, [168, 164, 160], own);
      stone = mix(JOINT, stone, smooth(0.04, 0.12, edge));
      // The snow's skin: thick in most places, worn through where feet run.
      const skin = fbm(i, j, 28, size, size, 43);
      const cover = smooth(0.83 - snow, 0.97 - snow, skin);
      let c = mix(stone, mix(PACKED, LOOSE, fbm(i, j, 12, size, size, 44) * 0.5), cover);
      // Snow left in the joints where the stone shows.
      if (cover < 0.5 && edge < 0.08) c = mix(c, LOOSE, 0.5);
      c = grit(c, i, j, 0.55, 303);
      put(data, j * size + i, c);
    }
  }
  return { width: size, height: size, data };
}
