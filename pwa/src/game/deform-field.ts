// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW AS A VOLUME — a deformable layer of snow a few metres round the
// player, a height a cell, that every ski, board and body MOVES rather than
// marks. Three-free and DOM-free, so the suite holds its arithmetic
// (`tests/deform_field_test.ts`); `deform-snow.ts` carries it to the GPU,
// where the ground draws it as a mesh a few centimetres a vertex and lights
// every pixel by it.
//
// TWO THINGS SHAPE IT, and snow is conserved through both:
//
//   * A PRESS (`press`): one capsule of `trail-stamp.ts` — the same line,
//     half-width, depth and edge tilt the trail map is drawn from, so the
//     two agree on where and how deep. Where the snow stands over the
//     tool's floor the excess is cut, and a press THROWS NOTHING: what it
//     cuts is COMPACTED, by the snow's density against what a ski packs it
//     to (`PACKED` — new snow at 80 kg/m³ is mostly air and is mostly
//     pressed away; the groomer at 480 has nothing left to give), and the
//     rest is PUSHED into a berm beside the cut: ahead of an edge that
//     slides, both sides of one that runs straight, heaped away from the
//     edge's tilt.
//   * A TAKE (`take`, `snow-takes.ts`): the snow the weighed spray threw
//     (`spray-mass-pool.ts`), at the weight it threw it. Its volume at the
//     snow's density is dug out of the strip under the edge (or the disc
//     under a landing or a body), and the berm the edge shoved is heaped
//     ahead of it. The kilograms dug are tallied (`thrown()`): the spray is
//     made of the snow that left the hole, one budget, never two.
//
// THE WALLS FALL TO THEIR REPOSE (`relax`). Wherever a cell stands over its
// neighbour by more than the snow's angle of repose allows, snow slides down
// until it does: a furrow in deep powder slumps into a trench, a crater's
// rim crumbles in, a skid's heap spills, while packed snow holds a wall near
// square. The angle is jittered a cell at a time (`DEFORM.jitter`), and a
// body's crater cut on a noisy radius, so a wall breaks along a ragged line
// rather than terracing into the grid's straight steps.
//
// THE WINDOW FOLLOWS THE PLAYER as a ring buffer anchored to the world in
// whole cells; moving it clears the cells that fall off one edge for the
// ground coming in at the other. Outside it the trail map is the record.

import { furrowProfile, type Stamp } from "./trail-stamp.ts";
import type { SnowProps } from "./snowpack.ts";
import type { SnowTake } from "./snow-takes.ts";

/** One stop's field: its cell, m (the mesh's vertex pitch too), its
 * half-extent, m, and the step its centre snaps to, m — a multiple of the
 * cell and of twice the ground's own level-0 spacing, so the field's rim
 * lies on the clipmap's grid lines and the two meet with no crack. */
export type DeformLook = { cell: number; half: number; snap: number };

/** What a ski packs loose snow to under it, kg/m³ — a skier's track floor,
 * and the density past which a cut has nothing left to compact. */
export const PACKED = 520;

export const DEFORM = {
  /** The steepest slope loose snow stands at (tan), and packed snow's. */
  reposeLoose: 0.8,
  reposeFirm: 3.2,
  /** Each cell's repose scaled by 1 ± this: walls that break ragged. Most
   * of it is value noise over `jitterCell` m and the rest the cell's own
   * hash — a cell's own alone set every column of a wall at a slope of its
   * own, and a crater's walls stood in vertical ribs a cell wide. */
  jitter: 0.3,
  jitterCell: 0.3,
  jitterOwn: 0.2,
  /** Relaxation passes a frame over what changed, and how much of a
   * cell's excess slides each pass. */
  passes: 4,
  slide: 0.45,
  /** A wall still moving more than this a pass, m, settles on next frame. */
  still: 2e-4,
  /** How far a berm reaches past a cut, as a share of its half-width, and
   * its least reach, m. */
  bermReach: 1.1,
  bermLeast: 0.05,
  /** An edge sliding across its line faster than this, m/s, heaps its berm
   * ahead of it. */
  slideFrom: 0.6,
  /** A body's crater: its radius scaled by 1 ± `rim` a cell (the hash's
   * value noise over `rimCell` m). */
  rim: 0.22,
  rimCell: 0.12,
  /** A tool's floor is packed to this firmness. */
  floorFirm: 0.85,
  /** The deepest the field holds, m, and the tallest heap. */
  deepest: 1.2,
  tallest: 0.5,
};

/** A tool's motion over the snow: the slide ACROSS its own line (+ to the
 * right of the way it runs, a to b), m/s, which way the slide carries the
 * snow ahead (a unit vector on the snow, the stamp's own right times the
 * slide's sign when left out), and whether it is a body. */
export type ToolMotion = {
  slide: number;
  body?: boolean;
  aheadX?: number;
  aheadZ?: number;
};

export type DeformField = {
  readonly look: DeformLook;
  /** Cells a side of the ring buffer (the texture's size). */
  readonly size: number;
  /** The window's centre, m. */
  readonly centre: { x: number; z: number };
  /** Heights over the untouched snow, m (− dug, + heaped), firmness 0..1,
   * and whether a cell has been touched this run — indexed by ring cell. */
  readonly h: Float32Array;
  readonly firm: Float32Array;
  readonly touched: Uint8Array;
  /** The same as a texture's half floats, four a cell — the height, the
   * touch, the firmness — kept as each cell changes, so an upload is a copy. */
  readonly rgba: Uint16Array;
  /** The ring rows and columns changed since the last `flush`. */
  readonly dirty: { r0: number; r1: number; c0: number; c1: number; any: boolean; all: boolean };
  /** Move the window to centre on (x, z), snapped; true if it moved. */
  follow(x: number, z: number): boolean;
  /** Press one tool into the snow; the volume it cut, m³. */
  press(stamp: Stamp, motion: ToolMotion, snow: SnowProps): number;
  /** Dig one take of the spray's out of the snow and heap its berm; the
   * kilograms thrown it dug (its own, or the share of it inside the window). */
  take(t: SnowTake): number;
  /** Let every wall changed since the last relax fall to its repose. */
  relax(passes?: number): void;
  /** The height over the untouched snow at a world point, m (0 outside). */
  heightAt(x: number, z: number): number;
  inside(x: number, z: number): boolean;
  clear(): void;
  flush(): void;
  /** What the field holds, m³: cut out and heaped up (both positive). */
  volume(): { dug: number; heaped: number };
  /** Kilograms of the spray's snow dug out since the last `clear`. */
  thrown(): number;
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** The relax's strides, cells, pass by pass (the last pass of a round is
 * always 1): long ones first, so a fresh wall slumps in a few frames. */
const STRIDES = [4, 2, 1];

/** A cell's hash, 0..1 — the same cell always the same. */
export function cellHash(i: number, j: number): number {
  let h = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise over world metres, 0..1, `scale` m a cell. */
function valueNoise(x: number, z: number, scale: number): number {
  const u = x / scale;
  const v = z / scale;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const su = fu * fu * (3 - 2 * fu);
  const sv = fv * fv * (3 - 2 * fv);
  const a = cellHash(i, j) + (cellHash(i + 1, j) - cellHash(i, j)) * su;
  const b = cellHash(i, j + 1) + (cellHash(i + 1, j + 1) - cellHash(i, j + 1)) * su;
  return a + (b - a) * sv;
}

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
/** A float as an IEEE half's bits (rounded; flushes what a half cannot hold). */
export function toHalf(v: number): number {
  f32[0] = v;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  const e = ((x >>> 23) & 0xff) - 127 + 15;
  if (e <= 0) return sign;
  if (e >= 31) return sign | 0x7c00;
  // The rounding bit carries into the exponent as a half's should.
  return ((sign | (e << 10) | ((x >>> 13) & 0x3ff)) + ((x >>> 12) & 1)) & 0xffff;
}

export function createDeformField(look: DeformLook): DeformField {
  const { cell, half } = look;
  const span = Math.round((2 * half) / cell);
  // The ring: the window's cells and a margin of four a side, so a moved
  // window and the relax's reach both land on cells of their own.
  const size = span + 8;
  const h = new Float32Array(size * size);
  const firm = new Float32Array(size * size);
  const touched = new Uint8Array(size * size);
  const rgba = new Uint16Array(size * size * 4);
  // Each cell's repose jitter, and a crater's ragged rim through it, fixed
  // to the world cell it holds (worked out once, as the cell is claimed).
  const rough = new Float32Array(size * size);
  const rimOf = new Float32Array(size * size);
  const put = (k: number) => {
    rgba[k * 4] = toHalf(h[k]);
    rgba[k * 4 + 1] = touched[k] ? 0x3c00 : 0;
    rgba[k * 4 + 2] = toHalf(firm[k]);
  };
  // The world cell each ring cell holds, so a moved window clears exactly
  // the cells it takes over.
  const ownI = new Int32Array(size * size).fill(-0x7fffffff);
  const ownJ = new Int32Array(size * size).fill(-0x7fffffff);
  const centre = { x: Number.NaN, z: Number.NaN };
  const dirty = { r0: 0, r1: -1, c0: 0, c1: -1, any: false, all: true };
  // The world box changed since the last relax, and the box still settling
  // from the frames before, in world cells.
  let rx0 = 0;
  let rx1 = -1;
  let rz0 = 0;
  let rz1 = -1;
  let sx0 = 0;
  let sx1 = -1;
  let sz0 = 0;
  let sz1 = -1;
  let lo = { i: 0, j: 0 }; // the world cell at the ring's corner
  let first = true;
  let kilos = 0;
  // Where a cell lies off a tool, written in place (no allocation a cell).
  const off = { d: 0, sd: 0 };

  const own = (k: number, i: number, j: number) => {
    ownI[k] = i;
    ownJ[k] = j;
    h[k] = 0;
    firm[k] = 0;
    touched[k] = 0;
    const lump = valueNoise(i * cell, j * cell, DEFORM.jitterCell);
    const grain = cellHash(i, j);
    rough[k] = 1 + DEFORM.jitter * (2 * (lump + DEFORM.jitterOwn * (grain - lump)) - 1);
    rimOf[k] = 1 / (1 + DEFORM.rim * (2 * valueNoise(i * cell, j * cell, DEFORM.rimCell) - 1));
    put(k);
  };
  const mark = (i: number, j: number) => {
    if (rx1 < rx0) {
      rx0 = rx1 = i;
      rz0 = rz1 = j;
      return;
    }
    rx0 = Math.min(rx0, i);
    rx1 = Math.max(rx1, i);
    rz0 = Math.min(rz0, j);
    rz1 = Math.max(rz1, j);
  };
  const markDirty = (a: number, b: number) => {
    if (!dirty.any) {
      dirty.any = true;
      dirty.c0 = dirty.c1 = a;
      dirty.r0 = dirty.r1 = b;
      return;
    }
    dirty.c0 = Math.min(dirty.c0, a);
    dirty.c1 = Math.max(dirty.c1, a);
    dirty.r0 = Math.min(dirty.r0, b);
    dirty.r1 = Math.max(dirty.r1, b);
  };
  /** A world cell's ring index, claiming (and clearing) it if it held
   * another; -1 outside the ring. */
  const at = (i: number, j: number): number => {
    if (i < lo.i || j < lo.j || i >= lo.i + size || j >= lo.j + size) return -1;
    const k = mod(j, size) * size + mod(i, size);
    if (ownI[k] !== i || ownJ[k] !== j) own(k, i, j);
    return k;
  };
  /** A crater's rim radius at a world cell, as a share of its own (its
   * value noise, cached while the cell is the ring's). */
  const rimAt = (i: number, j: number): number => {
    const k = at(i, j);
    if (k >= 0) return rimOf[k];
    return 1 / (1 + DEFORM.rim * (2 * valueNoise(i * cell, j * cell, DEFORM.rimCell) - 1));
  };
  const insideWindow = (i: number, j: number) =>
    i >= lo.i + 4 && j >= lo.j + 4 && i <= lo.i + 4 + span && j <= lo.j + 4 + span;
  /** A cell changed: its texel, the relax's box and the upload's rows. */
  const changed = (k: number, i: number, j: number) => {
    put(k);
    mark(i, j);
    markDirty(mod(i, size), mod(j, size));
  };
  const touch = (k: number, wall: number) => {
    if (!touched[k]) {
      touched[k] = 1;
      firm[k] = wall;
    }
  };

  let weights = new Float32Array(4096);
  /** Lay `volume` m³ over the cells of a band by their weights `weight(i,
   * j)` (0 off the band): + heaps, − digs; the volume actually moved inside
   * the window. */
  const spread = (
    i0: number,
    i1: number,
    j0: number,
    j1: number,
    volume: number,
    weight: (i: number, j: number) => number,
    wall: number,
  ): number => {
    // Spread over the whole band, laid where it is inside the window: the
    // share outside is the trail map's to keep. Each weight is asked once.
    const cols = i1 - i0 + 1;
    const n = cols * (j1 - j0 + 1);
    if (weights.length < n) weights = new Float32Array(n * 2);
    let sum = 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const w = weight(i, j);
        weights[(j - j0) * cols + (i - i0)] = w;
        sum += w;
      }
    }
    if (sum <= 0) return 0;
    const per = volume / (sum * cell * cell);
    let moved = 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const w = weights[(j - j0) * cols + (i - i0)];
        if (w <= 0 || !insideWindow(i, j)) continue;
        const k = at(i, j);
        if (k < 0) continue;
        touch(k, wall);
        const was = h[k];
        h[k] = Math.max(-DEFORM.deepest, Math.min(DEFORM.tallest, was + per * w));
        moved += h[k] - was;
        // A heap is loose, whatever it was cut from.
        if (volume > 0) firm[k] = Math.min(firm[k], 0.35);
        changed(k, i, j);
      }
    }
    return moved * cell * cell;
  };

  const field: DeformField = {
    look,
    size,
    centre,
    h,
    firm,
    touched,
    rgba,
    dirty,
    follow(x, z) {
      const cx = Math.round(x / look.snap) * look.snap;
      const cz = Math.round(z / look.snap) * look.snap;
      if (cx === centre.x && cz === centre.z) return false;
      centre.x = cx;
      centre.z = cz;
      const was = lo;
      lo = { i: Math.round(cx / cell) - span / 2 - 4, j: Math.round(cz / cell) - span / 2 - 4 };
      const di = lo.i - was.i;
      const dj = lo.j - was.j;
      // Clear only the columns and rows the window took over (the ring's
      // other cells still hold the world cells they held): at speed the
      // window moves every frame or two, and the whole ring is ten times
      // the work.
      if (!first && Math.abs(di) < size && Math.abs(dj) < size) {
        const claim = (k: number, i: number, j: number) => {
          if (ownI[k] !== i || ownJ[k] !== j) own(k, i, j);
        };
        const ci0 = di > 0 ? was.i + size : lo.i;
        const ci1 = di > 0 ? lo.i + size : was.i;
        for (let i = ci0; i < ci1; i++) {
          const a = mod(i, size);
          for (let b = 0; b < size; b++) claim(b * size + a, i, lo.j + mod(b - lo.j, size));
        }
        const cj0 = dj > 0 ? was.j + size : lo.j;
        const cj1 = dj > 0 ? lo.j + size : was.j;
        for (let j = cj0; j < cj1; j++) {
          const b = mod(j, size);
          for (let a = 0; a < size; a++) claim(b * size + a, lo.i + mod(a - lo.i, size), j);
        }
      } else {
        for (let b = 0; b < size; b++) {
          for (let a = 0; a < size; a++) {
            const i = lo.i + mod(a - lo.i, size);
            const j = lo.j + mod(b - lo.j, size);
            const k = b * size + a;
            if (ownI[k] !== i || ownJ[k] !== j) own(k, i, j);
          }
        }
      }
      first = false;
      dirty.all = true;
      return true;
    },
    press(stamp, motion, snow) {
      if (!(centre.x === centre.x)) return 0;
      const ax = stamp.ax;
      const az = stamp.az;
      const dx = stamp.bx - ax;
      const dz = stamp.bz - az;
      const l2 = dx * dx + dz * dz;
      const len = Math.sqrt(l2);
      // Right of the way it runs (heading 0 along +z, clockwise).
      const nx = len > 1e-6 ? dz / len : 1;
      const nz = len > 1e-6 ? -dx / len : 0;
      const halfW = Math.max(stamp.half, cell * 0.6);
      const depth = Math.min(DEFORM.deepest, stamp.depth);
      if (depth <= 1e-4) return 0;
      const wall = stamp.wall ?? snow.wall;
      const tilt = stamp.tilt ?? 0;
      const packs = Math.max(wall, DEFORM.floorFirm * Math.min(1, snow.density / PACKED));
      // A body's crater is cut on a ragged radius.
      const rim = motion.body ? 1 + DEFORM.rim : 1;
      const reach = Math.max(DEFORM.bermLeast, halfW * DEFORM.bermReach);
      const outer = halfW * rim + reach;
      const i0 = Math.floor((Math.min(ax, stamp.bx) - outer) / cell);
      const i1 = Math.ceil((Math.max(ax, stamp.bx) + outer) / cell);
      const j0 = Math.floor((Math.min(az, stamp.bz) - outer) / cell);
      const j1 = Math.ceil((Math.max(az, stamp.bz) + outer) / cell);
      const compact = Math.max(0, Math.min(0.85, 1 - snow.density / PACKED));
      const slide = Math.abs(motion.slide);
      const tx = motion.aheadX ?? nx * Math.sign(motion.slide || 1);
      const tz = motion.aheadZ ?? nz * Math.sign(motion.slide || 1);
      const side = slide > DEFORM.slideFrom ? Math.sign(tx * nx + tz * nz) : 0;
      /** Where a cell lies off the tool: its distance and signed offset. */
      const offOf = (i: number, j: number) => {
        const px = i * cell - ax;
        const pz = j * cell - az;
        const t = l2 > 1e-10 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / l2)) : 0;
        const rx = px - dx * t;
        const rz = pz - dz * t;
        let d = Math.sqrt(rx * rx + rz * rz);
        // The ragged rim: the radius read through value noise.
        if (motion.body) d *= rimAt(i, j);
        off.d = d;
        off.sd = len > 1e-6 ? rx * nx + rz * nz : d;
        return off;
      };
      const bermWeight = (d: number, sd: number) => {
        if (d < halfW || d > halfW + reach) return 0;
        const v = (d - halfW) / reach;
        const ahead =
          side === 0 ? Math.max(0, 1 - 0.8 * tilt * Math.sign(sd)) : sd * side > 0 ? 1 : 0.08;
        return Math.sin(Math.PI * Math.min(1, v)) * ahead;
      };
      /** A ski's cut at a cell, the profile AVERAGED over the cell's four
       * quarters: a groove a cell or two wide whose edge is drawn at the
       * share of the cell it covers, never stepped along the grid's
       * diagonals into a saw-tooth. */
      const skiPress = (i: number, j: number) => {
        let sum = 0;
        for (let q = 0; q < 4; q++) {
          const px = (i + (q & 1 ? 0.25 : -0.25)) * cell - ax;
          const pz = (j + (q & 2 ? 0.25 : -0.25)) * cell - az;
          const t = l2 > 1e-10 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / l2)) : 0;
          const rx = px - dx * t;
          const rz = pz - dz * t;
          if (rx * rx + rz * rz >= halfW * halfW) continue;
          sum += furrowProfile(len > 1e-6 ? rx * nx + rz * nz : 0, halfW, wall, halfW, tilt).press;
        }
        return sum / 4;
      };
      const edge = motion.body ? 0 : 0.36 * cell;
      let cut = 0;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (!insideWindow(i, j)) continue;
          const { d } = offOf(i, j);
          if (d > halfW + reach) continue;
          const k = at(i, j);
          if (k < 0) continue;
          // A body sinks as a rounded thing, never a flat-floored box.
          const press = d >= halfW + edge ? 0 : motion.body ? 1 - (d / halfW) ** 2 : skiPress(i, j);
          if (press > 0) {
            const floor = -depth * press;
            const was = touched[k];
            touch(k, wall);
            let moved = !was;
            if (h[k] > floor) {
              cut += h[k] - floor;
              h[k] = floor;
              moved = true;
            }
            // A ski packs its floor as firm as the snow pressed is dense; a
            // body only presses loose snow aside.
            const f0 = firm[k];
            if (motion.body) firm[k] = Math.min(f0, 0.15);
            else if (press > 0.2) firm[k] = Math.max(f0, packs * press);
            // Only what moved is the relax's and the upload's to look at:
            // a body lying still in its hole asks nothing more of either.
            if (moved || firm[k] !== f0) changed(k, i, j);
          } else if (!touched[k]) {
            // The band round the cut stands as the snow does; a body's
            // hole breaks its rim loose, so it slumps.
            touch(k, motion.body ? Math.min(wall, 0.15) : wall);
            changed(k, i, j);
          }
        }
      }
      if (cut <= 0) return 0;
      const volume = cut * cell * cell;
      // THE BERM: what was not compacted, heaped round the cut.
      const heap = volume * (1 - compact);
      if (heap > 0) {
        spread(
          i0,
          i1,
          j0,
          j1,
          heap,
          (i, j) => {
            const { d, sd } = offOf(i, j);
            return bermWeight(d, sd);
          },
          Math.min(wall, 0.3),
        );
      }
      return volume;
    },
    take(t) {
      if (!(centre.x === centre.x) || t.dug + t.berm <= 0) return 0;
      const dx = t.bx - t.ax;
      const dz = t.bz - t.az;
      const l2 = t.ring ? 0 : dx * dx + dz * dz;
      const half = Math.max(t.half, cell * 1.5);
      const dl = Math.hypot(t.dirX, t.dirZ);
      const reach = Math.max(DEFORM.bermLeast, half * DEFORM.bermReach);
      const outer = half + reach;
      const i0 = Math.floor((Math.min(t.ax, t.bx) - outer) / cell);
      const i1 = Math.ceil((Math.max(t.ax, t.bx) + outer) / cell);
      const j0 = Math.floor((Math.min(t.az, t.bz) - outer) / cell);
      const j1 = Math.ceil((Math.max(t.az, t.bz) + outer) / cell);
      const offOf = (i: number, j: number) => {
        const px = i * cell - t.ax;
        const pz = j * cell - t.az;
        const s = l2 > 1e-10 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / l2)) : 0;
        const rx = px - dx * s;
        const rz = pz - dz * s;
        // A ring's edge is ragged as a crater's is.
        const r = Math.sqrt(rx * rx + rz * rz) * (t.ring ? rimAt(i, j) : 1);
        off.d = r;
        off.sd = dl > 0 ? (rx * t.dirX + rz * t.dirZ) / dl : 0;
        return off;
      };
      // The hole: deepest under the strip's line, to nothing at its edge.
      const want = t.dug + t.berm;
      const dug = -spread(
        i0,
        i1,
        j0,
        j1,
        -want,
        (i, j) => {
          const r = offOf(i, j).d;
          if (r >= half) return 0;
          const c = Math.cos((0.5 * Math.PI * r) / half);
          return c * c;
        },
        0.4,
      );
      // The berm: ahead of the edge (both sides when it slid nowhere).
      if (t.berm > 0) {
        spread(
          i0,
          i1,
          j0,
          j1,
          (t.berm * dug) / want,
          (i, j) => {
            const { d: r, sd: ahead } = offOf(i, j);
            if (r < half || r > outer) return 0;
            const lay = dl > 0 ? (ahead > 0 ? 1 : 0.08) : 1;
            return Math.sin((Math.PI * (r - half)) / reach) * lay;
          },
          0.3,
        );
      }
      const kg = (t.kg * dug) / want;
      kilos += kg;
      return kg;
    },
    relax(passes = DEFORM.passes) {
      if (sx1 >= sx0) {
        mark(sx0, sz0);
        mark(sx1, sz1);
      }
      if (rx1 < rx0) return;
      // The box, held inside the window (every ring cell there is claimed,
      // so a cell's index is its ring row and column, no lookup).
      const wi0 = lo.i + 4;
      const wj0 = lo.j + 4;
      const wi1 = wi0 + span;
      const wj1 = wj0 + span;
      const i0 = Math.max(rx0 - 4, wi0);
      const i1 = Math.min(rx1 + 4, wi1);
      const j0 = Math.max(rz0 - 4, wj0);
      const j1 = Math.min(rz1 + 4, wj1);
      rx0 = 0;
      rx1 = -1;
      rz0 = 0;
      rz1 = -1;
      if (i1 < i0 || j1 < j0) return;
      // The box of the cells still moving more than `still` a pass: only
      // they settle on next frame, so the box does not grow down the whole
      // track behind a skier while one wall far back still creeps.
      let mi0 = Infinity;
      let mi1 = -Infinity;
      let mj0 = Infinity;
      let mj1 = -Infinity;
      const { reposeLoose, reposeFirm, slide } = DEFORM;
      const ring = (a: number, b: number) => mod(b, size) * size + mod(a, size);
      for (let pass = 0; pass < passes; pass++) {
        // Alternate the sweep so no direction is favoured.
        const flip = pass % 2 === 1;
        // THE STRIDE: the first passes of a round weigh a cell against the
        // one STRIDE cells off, so a fresh wall's snow runs out several
        // cells a pass instead of one — a crater's walls are down to their
        // repose in a few frames, not tens — and the last pass is always a
        // neighbour's, which smooths what the long ones left. Every move is
        // between a pair, so the snow is conserved whatever the stride.
        const last = pass === passes - 1;
        const stride = last ? 1 : STRIDES[Math.min(pass, STRIDES.length - 1)];
        // A pair needs both its cells in the window.
        const pi1 = Math.min(i1, wi1 - stride);
        const pj0 = Math.max(j0, wj0 + stride);
        const pj1 = Math.min(j1, wj1 - stride);
        const diag = cell * Math.SQRT2 * stride;
        const run0 = cell * stride;
        for (let jj = pj0; jj <= pj1; jj++) {
          const j = flip ? pj1 - (jj - pj0) : jj;
          const row = mod(j, size) * size;
          const up = mod(j + stride, size) * size;
          const down = mod(j - stride, size) * size;
          for (let ii = i0; ii <= pi1; ii++) {
            const i = flip ? pi1 - (ii - i0) : ii;
            const c = mod(i, size);
            const cr = mod(i + stride, size);
            const k = row + c;
            // To the right, the far side and both diagonals: each pair once.
            for (let n = 0; n < 4; n++) {
              const kn = n === 0 ? row + cr : n === 1 ? up + c : n === 2 ? up + cr : down + cr;
              const diff = h[k] - h[kn];
              const hi = diff > 0 ? k : kn;
              const low = diff > 0 ? kn : k;
              // The wall stands as firm as the snow at its top, ragged.
              const tan = (reposeLoose + (reposeFirm - reposeLoose) * firm[hi]) * rough[hi];
              const over = Math.abs(diff) - tan * (n < 2 ? run0 : diag);
              if (over <= 0) continue;
              const m = over * 0.5 * slide;
              if (m > DEFORM.still && last) {
                mi0 = Math.min(mi0, i);
                mi1 = Math.max(mi1, i + 1);
                mj0 = Math.min(mj0, j - 1);
                mj1 = Math.max(mj1, j + 1);
              }
              h[hi] -= m;
              h[low] += m;
              touched[low] = 1;
              // What slid down is loose.
              firm[low] = Math.min(firm[low], 0.4);
            }
          }
        }
      }
      // Every cell a move can have reached, written to its texel once.
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          put(ring(i, j));
          markDirty(mod(i, size), mod(j, size));
        }
      if (mi1 >= mi0) {
        sx0 = mi0;
        sx1 = mi1;
        sz0 = mj0;
        sz1 = mj1;
      } else {
        sx0 = 0;
        sx1 = -1;
      }
    },
    heightAt(x, z) {
      const i = Math.round(x / cell);
      const j = Math.round(z / cell);
      if (!insideWindow(i, j)) return 0;
      const k = mod(j, size) * size + mod(i, size);
      return ownI[k] === i && ownJ[k] === j ? h[k] : 0;
    },
    inside(x, z) {
      return (
        centre.x === centre.x && Math.abs(x - centre.x) < half && Math.abs(z - centre.z) < half
      );
    },
    clear() {
      h.fill(0);
      firm.fill(0);
      touched.fill(0);
      rgba.fill(0);
      sx0 = 0;
      sx1 = -1;
      kilos = 0;
      dirty.all = true;
    },
    flush() {
      dirty.any = false;
      dirty.all = false;
    },
    volume() {
      let dug = 0;
      let heaped = 0;
      for (let k = 0; k < h.length; k++) {
        if (h[k] < 0) dug -= h[k];
        else heaped += h[k];
      }
      return { dug: dug * cell * cell, heaped: heaped * cell * cell };
    },
    thrown: () => kilos,
  };
  return field;
}
