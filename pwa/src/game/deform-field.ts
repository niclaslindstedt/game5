// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW AS A VOLUME — a deformable layer of snow a few metres round the
// player, a height a cell, where every ski, board and body that presses it
// MOVES snow rather than stamping a mark. Three-free and DOM-free, so the
// suite holds its arithmetic (`tests/deform_field_test.ts`); `deform-snow.ts`
// carries it to the GPU, where it is drawn as real geometry — a mesh a few
// centimetres a vertex laid over the ground's clipmap — and read by every
// pixel of the snow's shading.
//
// WHAT A TOOL DOES TO A CELL. A tool is one capsule of `trail-stamp.ts`
// (its line, its half-width, its drawn depth, its edge's tilt — the same
// decisions the trail map is drawn from, so the two agree on where and how
// deep). Where the snow stands above the tool's floor, the excess is CUT
// out — and a cut is a VOLUME, which goes three ways:
//
//   * COMPACTED, by the snow's density against what a ski packs it to
//     (`PACKED`): new snow at 80 kg/m³ is mostly air and the most of what a
//     ski cuts is simply pressed away; the groomer at 480 has nothing left
//     to give, and all it is cut of has to go somewhere.
//   * THROWN — the share an edge SLIDING across its own line flings off
//     (a hockey stop throws most of what its edges shave), and the share a
//     body ploughing loose snow at speed kicks up. That volume is handed
//     back as EJECTA (`DeformEjecta`): where it came from, how much and how
//     fast — the spray is made of the snow that left the hole.
//   * PUSHED aside, the rest, into a BERM beside the cut — ahead of an edge
//     that slides (the snow a skid bulldozes), both sides of one that runs
//     straight, heaped on the side away from an edge's tilt.
//
// THE WALLS FALL TO THEIR REPOSE (`relax`). Loose snow will not stand in a
// wall: wherever a cell stands above its neighbour by more than the snow's
// angle of repose allows, snow slides down from it until it does — so a
// furrow in deep powder slumps into a trench, a crater's rim crumbles in,
// and a berm a skid heaps up spills — while packed snow (a tool's floor,
// the groomer, a wind slab) holds a wall near square. Nothing is drawn
// round: every slope in the field is one the snow could stand at.
//
// THE WINDOW FOLLOWS THE PLAYER as a ring buffer: the field is anchored to
// the world in whole cells, and moving it re-uses the cells that fall off
// one edge for the ground coming in at the other, cleared. Outside it the
// trail map (`trail-map.ts`) is the record, as it always was.

import { furrowProfile, type Stamp } from "./trail-stamp.ts";
import type { SnowProps } from "./snowpack.ts";

/** One picture stop's field: its cell, m (the mesh's vertex pitch too), its
 * half-extent, m, and the step its centre snaps to, m — a multiple of the
 * cell and of twice the ground's own level-0 spacing, so the field's rim
 * lies on the clipmap's own grid lines and the two meet with no crack. */
export type DeformLook = { cell: number; half: number; snap: number };

/** What a ski packs loose snow to under it, kg/m³ — a skier's track floor,
 * and the density past which a cut has nothing left to compact. */
export const PACKED = 520;

export const DEFORM = {
  /** The steepest slope loose snow stands at (tan), and packed snow's. */
  reposeLoose: 0.8,
  reposeFirm: 3.2,
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
  /** THE THROW: an edge sliding across its line this fast, m/s, throws
   * nothing; at `slideFull` past it, `slideMost` of what it cuts. Loose
   * snow ploughed by a ski moving along it throws `plough` of its cut per
   * m/s of the ski's speed, up to `ploughMost`. */
  slideFrom: 0.6,
  slideFull: 4.5,
  slideMost: 0.92,
  plough: 0.04,
  ploughMost: 0.7,
  /** A body going in throws this share of what it moves. */
  body: 0.55,
  /** A tool's floor is packed to this firmness. */
  floorFirm: 0.85,
  /** The deepest the field holds, m, and the tallest heap. */
  deepest: 1.2,
  tallest: 0.5,
};

/** A tool's motion over the snow: its velocity, m/s, and the slide ACROSS
 * its own line (+ to the right of the way it runs, a to b), m/s. A body is
 * `body`: what it moves is thrown out of the hole about it, not ahead. */
export type ToolMotion = {
  vx: number;
  vy: number;
  vz: number;
  slide: number;
  body?: boolean;
  /** Which way a sliding edge flings what it shaves, on the snow (a unit
   * vector): across the SKI as it stands, which in a hockey stop is near
   * the way the stamp runs. The stamp's own right times the slide's sign
   * when left out. */
  throwX?: number;
  throwZ?: number;
};

/** SNOW THAT LEFT THE HOLE this frame: a volume, m³, from a point on the
 * snow, flying off at a velocity, m/s, its spread a share of that speed. */
export type DeformEjecta = {
  x: number;
  y: number;
  z: number;
  volume: number;
  vx: number;
  vy: number;
  vz: number;
  spread: number;
  /** How much of it is clumps (0 dust … 1 chunks), the snow's own, and
   * how loose the snow it came from was (0 the groomer … 1 powder). */
  clumps: number;
  loose: number;
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
  /** The ring rows changed since the last `flush` (inclusive), or none. */
  readonly dirty: { r0: number; r1: number; c0: number; c1: number; any: boolean; all: boolean };
  /** Move the window to centre on (x, z), snapped; true if it moved. */
  follow(x: number, z: number): boolean;
  /** Press one tool into the snow, handing what it throws to `out`. */
  press(
    stamp: Stamp,
    motion: ToolMotion,
    snow: SnowProps,
    surfaceY: number,
    out: DeformEjecta[],
  ): number;
  /** Let every wall changed since the last relax fall to its repose, over
   * `passes` sweeps (the frame's own when left out). */
  relax(passes?: number): void;
  /** The height over the untouched snow at a world point, m (0 outside). */
  heightAt(x: number, z: number): number;
  /** Whether a world point lies inside the window. */
  inside(x: number, z: number): boolean;
  /** Forget every cut (a new run). */
  clear(): void;
  /** Mark the dirty rows uploaded. */
  flush(): void;
  /** What the field holds, m³: cut out and heaped up (both positive). */
  volume(): { dug: number; heaped: number };
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

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
  // The ring: the window's cells and a margin, so a moved window and the
  // filter's reach both land on cells of their own.
  const size = span + 8;
  const h = new Float32Array(size * size);
  const firm = new Float32Array(size * size);
  const touched = new Uint8Array(size * size);
  const rgba = new Uint16Array(size * size * 4);
  /** Cell `k`'s texel brought up to date. */
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
  // The world box changed since the last relax, in world cells.
  let rx0 = 0;
  let rx1 = -1;
  let rz0 = 0;
  let rz1 = -1;
  // The box still settling from the frames before, in world cells.
  let sx0 = 0;
  let sx1 = -1;
  let sz0 = 0;
  let sz1 = -1;
  let lo = { i: 0, j: 0 }; // the world cell at the ring's window corner

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
    // a: ring column, b: ring row.
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
   * another; -1 outside the window. */
  const at = (i: number, j: number): number => {
    if (i < lo.i || j < lo.j || i >= lo.i + size || j >= lo.j + size) return -1;
    const a = mod(i, size);
    const b = mod(j, size);
    const k = b * size + a;
    if (ownI[k] !== i || ownJ[k] !== j) {
      ownI[k] = i;
      ownJ[k] = j;
      h[k] = 0;
      firm[k] = 0;
      touched[k] = 0;
      put(k);
    }
    return k;
  };
  const insideWindow = (i: number, j: number) =>
    i >= lo.i + 4 && j >= lo.j + 4 && i <= lo.i + 4 + span && j <= lo.j + 4 + span;

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
      lo = { i: Math.round(cx / cell) - span / 2 - 4, j: Math.round(cz / cell) - span / 2 - 4 };
      // Every ring cell that now stands for another world cell is cleared.
      for (let b = 0; b < size; b++) {
        for (let a = 0; a < size; a++) {
          const i = lo.i + mod(a - lo.i, size);
          const j = lo.j + mod(b - lo.j, size);
          const k = b * size + a;
          if (ownI[k] !== i || ownJ[k] !== j) {
            ownI[k] = i;
            ownJ[k] = j;
            h[k] = 0;
            firm[k] = 0;
            touched[k] = 0;
            put(k);
          }
        }
      }
      dirty.all = true;
      return true;
    },
    press(stamp, motion, snow, surfaceY, out) {
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
      const reach = Math.max(DEFORM.bermLeast, halfW * DEFORM.bermReach);
      const outer = halfW + reach;
      const i0 = Math.floor((Math.min(ax, stamp.bx) - outer) / cell);
      const i1 = Math.ceil((Math.max(ax, stamp.bx) + outer) / cell);
      const j0 = Math.floor((Math.min(az, stamp.bz) - outer) / cell);
      const j1 = Math.ceil((Math.max(az, stamp.bz) + outer) / cell);
      // What the snow does with what is cut.
      const compact = Math.max(0, Math.min(0.85, 1 - snow.density / PACKED));
      const speed = Math.hypot(motion.vx, motion.vz);
      const slide = Math.abs(motion.slide);
      const slideThrow =
        DEFORM.slideMost *
        Math.max(
          0,
          Math.min(1, (slide - DEFORM.slideFrom) / (DEFORM.slideFull - DEFORM.slideFrom)),
        );
      const plough = Math.min(DEFORM.ploughMost, DEFORM.plough * speed * snow.loose);
      const throwShare = motion.body ? DEFORM.body : Math.min(0.95, Math.max(slideThrow, plough));
      // Where the berm goes: ahead of a sliding edge, else both sides,
      // heaped away from the edge's tilt.
      const tx = motion.throwX ?? nx * Math.sign(motion.slide || 1);
      const tz = motion.throwZ ?? nz * Math.sign(motion.slide || 1);
      const side = slide > DEFORM.slideFrom ? Math.sign(tx * nx + tz * nz) : 0;
      let cut = 0;
      // The thrown snow's centre, weighted by what each cell gave.
      let ex = 0;
      let ez = 0;
      let ew = 0;
      let bermW = 0;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (!insideWindow(i, j)) continue;
          const px = i * cell - ax;
          const pz = j * cell - az;
          const t = l2 > 1e-10 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / l2)) : 0;
          const rx = px - dx * t;
          const rz = pz - dz * t;
          const d = Math.hypot(rx, rz);
          if (d > outer) continue;
          const sd = len > 1e-6 ? rx * nx + rz * nz : d;
          if (d < halfW) {
            // A body sinks as a rounded thing, never a flat-floored box.
            const u = d / halfW;
            const press = motion.body
              ? 1 - u * u
              : furrowProfile(sd, halfW, wall, halfW, tilt).press;
            const floor = -depth * press;
            const k = at(i, j);
            if (k < 0) continue;
            if (!touched[k]) {
              touched[k] = 1;
              firm[k] = wall;
            }
            if (h[k] > floor) {
              const gone = h[k] - floor;
              cut += gone;
              h[k] = floor;
              const w = gone;
              ex += i * cell * w;
              ez += j * cell * w;
              ew += w;
              mark(i, j);
              markDirty(mod(i, size), mod(j, size));
            }
            // A ski packs its floor; a body only presses loose snow aside.
            // As firm as the snow pressed is dense: a groomer's floor stands,
            // new snow's barely holds a wall.
            if (press > 0.2 && !motion.body) firm[k] = Math.max(firm[k], packs * press);
            else if (motion.body) firm[k] = Math.min(firm[k], 0.15);
            put(k);
          } else {
            // The band round the cut stands as the snow does.
            const k = at(i, j);
            if (k >= 0 && !touched[k]) {
              touched[k] = 1;
              // A body's hole breaks its rim: loose round it, so it slumps.
              firm[k] = motion.body ? Math.min(wall, 0.15) : wall;
              put(k);
              markDirty(mod(i, size), mod(j, size));
            }
            // The berm's band: how much of the heap lands here.
            const v = (d - halfW) / reach;
            const ahead =
              side === 0 ? Math.max(0, 1 - 0.8 * tilt * Math.sign(sd)) : sd * side > 0 ? 1 : 0.08;
            bermW += Math.sin(Math.PI * Math.min(1, v)) * ahead;
          }
        }
      }
      if (cut <= 0) return 0;
      const volume = cut * cell * cell;
      const thrown = volume * throwShare;
      const heap = (volume - thrown) * (1 - compact);
      // THE BERM: the heap laid over the band by the same weights.
      if (heap > 0 && bermW > 0) {
        const per = heap / (bermW * cell * cell);
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            if (!insideWindow(i, j)) continue;
            const px = i * cell - ax;
            const pz = j * cell - az;
            const t = l2 > 1e-10 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / l2)) : 0;
            const rx = px - dx * t;
            const rz = pz - dz * t;
            const d = Math.hypot(rx, rz);
            if (d < halfW || d > outer) continue;
            const sd = len > 1e-6 ? rx * nx + rz * nz : d;
            const v = (d - halfW) / reach;
            const ahead =
              side === 0 ? Math.max(0, 1 - 0.8 * tilt * Math.sign(sd)) : sd * side > 0 ? 1 : 0.08;
            const w = Math.sin(Math.PI * Math.min(1, v)) * ahead;
            if (w <= 0) continue;
            const k = at(i, j);
            if (k < 0) continue;
            if (!touched[k]) {
              touched[k] = 1;
              firm[k] = Math.min(wall, 0.3);
            }
            h[k] = Math.min(DEFORM.tallest, h[k] + per * w);
            // A heap is loose, whatever it was cut from.
            firm[k] = Math.min(firm[k], 0.35);
            put(k);
            mark(i, j);
            markDirty(mod(i, size), mod(j, size));
          }
        }
      }
      // THE EJECTA: from where the snow came out, at the tool's speed.
      if (thrown > 0 && ew > 0) {
        const x = ex / ew;
        const z = ez / ew;
        let vx: number;
        let vy: number;
        let vz: number;
        let spread: number;
        if (motion.body) {
          // Out of the hole every way, up off the blow.
          vx = motion.vx * 0.35;
          vz = motion.vz * 0.35;
          vy = 1.2 + Math.abs(motion.vy) * 0.45;
          spread = 0.9;
        } else if (slideThrow >= plough) {
          // Shaved by the sliding edge and PRESSED AHEAD of it: the snow
          // keeps most of the speed the ski was going and runs on forward
          // and down the slope from under the skis, low over the snow, a
          // little out the way the edge slides — never up off the blade.
          vx = motion.vx * 0.85 + tx * slide * 0.3;
          vz = motion.vz * 0.85 + tz * slide * 0.3;
          vy = 0.25 + slide * 0.12;
          spread = 0.3;
        } else {
          // Ploughed by a ski running through loose snow: pushed ahead of
          // the ski and down the slope, out over the snow in front of it.
          vx = motion.vx * 0.9 + tx * speed * 0.1;
          vz = motion.vz * 0.9 + tz * speed * 0.1;
          vy = 0.5 + speed * 0.08;
          spread = 0.45;
        }
        out.push({
          x,
          y: surfaceY,
          z,
          volume: thrown,
          vx,
          vy,
          vz,
          spread,
          clumps: snow.clumps,
          loose: Math.min(1, snow.loose),
        });
      }
      return volume;
    },
    relax(passes = DEFORM.passes) {
      // What changed this frame, and what was still settling from before.
      if (sx1 >= sx0) {
        mark(sx0, sz0);
        mark(sx1, sz1);
      }
      if (rx1 < rx0) return;
      const i0 = rx0 - 3;
      const i1 = rx1 + 3;
      const j0 = rz0 - 3;
      const j1 = rz1 + 3;
      let moved = 0;
      rx0 = 0;
      rx1 = -1;
      rz0 = 0;
      rz1 = -1;
      const { reposeLoose, reposeFirm, slide } = DEFORM;
      for (let pass = 0; pass < passes; pass++) {
        // Alternate the sweep so no direction is favoured.
        const flip = pass % 2 === 1;
        for (let jj = j0; jj <= j1; jj++) {
          const j = flip ? j1 - (jj - j0) : jj;
          for (let ii = i0; ii <= i1; ii++) {
            const i = flip ? i1 - (ii - i0) : ii;
            if (!insideWindow(i, j - 1) || !insideWindow(i + 1, j + 1)) continue;
            const k = at(i, j);
            if (k < 0) continue;
            // To the right and to the far neighbour: each pair once a pass.
            for (let n = 0; n < 4; n++) {
              const kn =
                n === 0
                  ? at(i + 1, j)
                  : n === 1
                    ? at(i, j + 1)
                    : n === 2
                      ? at(i + 1, j + 1)
                      : at(i + 1, j - 1);
              // A diagonal neighbour stands √2 cells off.
              const run = n < 2 ? cell : cell * Math.SQRT2;
              if (kn < 0) continue;
              const diff = h[k] - h[kn];
              const hi = diff > 0 ? k : kn;
              const lo2 = diff > 0 ? kn : k;
              // The wall stands as firm as the snow at its top.
              const tan = reposeLoose + (reposeFirm - reposeLoose) * firm[hi];
              const over = Math.abs(diff) - tan * run;
              if (over <= 0) continue;
              const m = over * 0.5 * slide;
              moved = Math.max(moved, m);
              h[hi] -= m;
              h[lo2] += m;
              touched[lo2] = 1;
              // What slid down is loose.
              firm[lo2] = Math.min(firm[lo2], 0.4);
              put(hi);
              put(lo2);
            }
          }
        }
      }
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          if (insideWindow(i, j)) markDirty(mod(i, size), mod(j, size));
        }
      // Still sliding: the next frame goes on settling this box.
      if (moved > DEFORM.still) {
        sx0 = i0 + 3;
        sx1 = i1 - 3;
        sz0 = j0 + 3;
        sz1 = j1 - 3;
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
  };
  return field;
}
