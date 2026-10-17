// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK UNDERFOOT — a wall's rock skin (`rocks.ts`, drawn by
// `pwa/src/game/rock-shapes.ts`' `buildSkin`) made the SURFACE a body
// meets: `withRock` hands back the map with `groundAt` and `normalAt`
// answering off the skin wherever it stands proud of the snow, so a skier
// rides on the rock that is drawn rather than through it, a skier driven
// into a wall meets the facets it is drawn in, and the snowmobile, the
// ragdoll, the skis let go and every craft in the air come down on the
// same stone. `rockAt` says how much of the surface there is bare rock —
// none on a ledge the snow lies on — and the physics reads it as a hard,
// scraping, unforgiving surface (`snow.ts`' `onRock`, `rockDrag`,
// `body.ts`' `snowGive`).
//
// The skin is the drawing's to the corner: the same lattice
// (`ROCKS.skin.cell`), the same jitter off the same hashes, the same
// diagonal a cell, and each triangle SLICED ALONG THE SAME BEDS and laid
// at the same heights by the one function both read (`strata.ts`'
// `liftOf`, `bandOf`), so a ledge met is the ledge seen to the millimetre.
// (Only rock past 250–300 m of the lens, by the FOREST row, is drawn on a
// coarser lattice, a filtered copy of this one, its
// beds taken two or more at a time, out where nobody rides.)
//
// CHEAP: nothing is stored but how bare each lattice corner is, a byte a
// corner, a tile of corners at a time and only for a tile a body has
// asked about — a tile with no bare corner is one shared empty mark. A
// query on packed snow or off every wall reads that and the map itself.
// A pure function of the map, off hashes of `level.seed`; no wall stands
// where a run is skied or a bike trail ridden, so no digest moves.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { regionOf } from "../mapgen/regions.ts";
import type { Level } from "../mapgen/types.ts";
import { ROCKS } from "./defs/rocks.ts";
import { hashOf, rockShare, unit } from "./rocks.ts";
import {
  bandAround,
  bandOf,
  bareKept,
  bedCoord,
  ribOf,
  snowShare,
  STRIDE,
  strataOf,
  type SliceVerts,
  type Strata,
  type StrataCorner,
} from "./strata.ts";

/** The salt a wall's skin is dealt off (`hashOf(level.seed, SKIN_SALT)`),
 * the drawing's and the physics' alike. */
export const SKIN_SALT = 0x534b494e;

/** Corners a tile's side. */
const TILE = 32;
/** A corner's bareness as a byte: 0 where no rock is laid (`skin.from`). */
const Q = 255;
/** Below the snow by this much the skin is under a crust of snow, m: the
 * surface's share of rock fades out over it. */
const BURIED = 0.15;

/** What lies at a point of the surface. */
type Under = {
  /** The surface's height, m. */
  y: number;
  /** The rock's share of it: 1 on the skin, 0 on the snow. */
  on: number;
  /** Of that, how bare the rock is (a facet facing the sky holds snow). */
  bare: number;
  /** The facet's normal where it is on top. */
  nx: number;
  ny: number;
  nz: number;
};

type Skin = {
  readonly base: Level;
  readonly ground: (x: number, z: number) => number;
  readonly strata: Strata;
  readonly seed: number;
  readonly tiles: Map<number, Uint8Array | null>;
  /** The last point asked and its answer: a body asks `groundAt`,
   * `normalAt` and `rockAt` at one point in a row. */
  lastX: number;
  lastZ: number;
  readonly last: Under;
};

const EMPTY = null;

function tileOf(s: Skin, ti: number, tj: number): Uint8Array | null {
  const key = (ti + 2048) * 4096 + (tj + 2048);
  const had = s.tiles.get(key);
  if (had !== undefined) return had;
  const S = ROCKS.skin;
  const cell = S.cell;
  const out = new Uint8Array(TILE * TILE);
  let any = false;
  for (let b = 0; b < TILE; b++) {
    for (let a = 0; a < TILE; a++) {
      const i = ti * TILE + a;
      const j = tj * TILE + b;
      const h = hashOf(s.seed, i, j);
      const x = (i + (unit(h, 0) - 0.5) * 2 * S.jitter) * cell;
      const z = (j + (unit(h, 1) - 0.5) * 2 * S.jitter) * cell;
      const bare = rockShare(s.base, x, z);
      if (bare > S.from) {
        out[b * TILE + a] = Math.round(bareKept(bare) * Q);
        any = true;
      }
    }
  }
  const kept = any ? out : EMPTY;
  s.tiles.set(key, kept);
  return kept;
}

/** Corner (i, j)'s bareness, 0 where no rock is laid. */
function bareOf(s: Skin, i: number, j: number): number {
  const ti = Math.floor(i / TILE);
  const tj = Math.floor(j / TILE);
  const t = tileOf(s, ti, tj);
  return t ? t[(j - tj * TILE) * TILE + (i - ti * TILE)] / Q : 0;
}

// The 4 × 4 corners round a point, each a corner of the beds
// (`strata.ts`), and whether it has been laid out yet.
const CK: StrataCorner[] = Array.from({ length: 16 }, () => ({
  x: 0,
  z: 0,
  g: 0,
  w: 0,
  bare: 0,
  rough: 0,
  rib: 0,
}));
const CS = new Uint8Array(16);

function cornerAt(s: Skin, i: number, j: number, k: number): void {
  const S = ROCKS.skin;
  const h = hashOf(s.seed, i, j);
  const c = CK[k];
  c.x = (i + (unit(h, 0) - 0.5) * 2 * S.jitter) * S.cell;
  c.z = (j + (unit(h, 1) - 0.5) * 2 * S.jitter) * S.cell;
  c.g = s.base.groundAt(c.x, c.z);
  c.w = bedCoord(s.strata, c.x, c.z, c.g);
  c.rough = unit(h, 2);
  c.rib = ribOf(s.strata, s.base, c.x, c.z);
  CS[k] = 1;
}

/** Barycentric weights of (x, z) in triangle `a`, `b`, `c` in plan into
 * `B`, or false when it lies outside. */
const B = [0, 0, 0];
function inTri(a: StrataCorner, b: StrataCorner, c: StrataCorner, x: number, z: number): boolean {
  const e1x = b.x - a.x;
  const e1z = b.z - a.z;
  const e2x = c.x - a.x;
  const e2z = c.z - a.z;
  const det = e1x * e2z - e2x * e1z;
  if (Math.abs(det) < 1e-9) return false;
  const px = x - a.x;
  const pz = z - a.z;
  const v = (px * e2z - e2x * pz) / det;
  const w = (e1x * pz - px * e1z) / det;
  const eps = -1e-7;
  if (v < eps || w < eps || v + w > 1 - eps) return false;
  B[0] = 1 - v - w;
  B[1] = v;
  B[2] = w;
  return true;
}

const F = STRIDE;
/** The rib of the facet `onTri` last found. */
let skinRib = 0;

/** Whether the triangle of slice vertices `a`, `b`, `c` (indices into
 * `v`, `STRIDE` numbers each) holds (x, z) in plan; if so its height and
 * up-facing normal into `u`. */
function onTri(
  v: SliceVerts,
  a: number,
  b: number,
  c: number,
  x: number,
  z: number,
  u: Under,
): boolean {
  const ax = v[F * a];
  const az = v[F * a + 2];
  const e1x = v[F * b] - ax;
  const e1z = v[F * b + 2] - az;
  const e2x = v[F * c] - ax;
  const e2z = v[F * c + 2] - az;
  const det = e1x * e2z - e2x * e1z;
  if (Math.abs(det) < 1e-12) return false;
  const px = x - ax;
  const pz = z - az;
  const p = (px * e2z - e2x * pz) / det;
  const q = (e1x * pz - px * e1z) / det;
  const eps = -1e-6;
  if (p < eps || q < eps || p + q > 1 - eps) return false;
  const e1y = v[F * b + 1] - v[F * a + 1];
  const e2y = v[F * c + 1] - v[F * a + 1];
  u.y = v[F * a + 1] + p * e1y + q * e2y;
  // e1 × e2, turned to face up.
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const l = hypot3(nx, ny, nz) || 1;
  u.nx = nx / l;
  u.ny = ny / l;
  u.nz = nz / l;
  // The facet's rib, as the drawing paints it: its corners' mean.
  skinRib = (v[F * a + 4] + v[F * b + 4] + v[F * c + 4]) / 3;
  return true;
}

const skinU: Under = { y: 0, on: 0, bare: 0, nx: 0, ny: 1, nz: 0 };
/** The bed coordinate of the point `onSlice` last stood on. */
let skinW = 0;
const around: [number, number] = [0, 0];
const slice: SliceVerts = [];

/** The skin over triangle `a`, `b`, `c` at (x, z), inside it in plan (its
 * weights in `B`): the slice of the beds there and the fan triangle of it
 * under the point, into `skinU`. */
function onSlice(
  s: Skin,
  a: StrataCorner,
  b: StrataCorner,
  c: StrataCorner,
  x: number,
  z: number,
): boolean {
  const w = B[0] * a.w + B[1] * b.w + B[2] * c.w;
  skinW = w;
  bandAround(s.strata, a, b, c, w, around);
  bandOf(s.strata, s.ground, a, b, c, around[0], around[1], slice);
  const n = slice.length / STRIDE;
  for (let k = 2; k < n; k++) if (onTri(slice, 0, k - 1, k, x, z, skinU)) return true;
  return false;
}

/** The surface at (x, z) into `s.last`. */
function underOf(s: Skin, x: number, z: number): Under {
  const u = s.last;
  if (x === s.lastX && z === s.lastZ) return u;
  s.lastX = x;
  s.lastZ = z;
  const base = s.base;
  const ground = base.groundAt(x, z);
  u.y = ground;
  u.on = 0;
  u.bare = 0;
  // No facet stands over packed snow or a summer bike trail: no corner
  // within `ROCKS.skin.clear` of either is bare (`rocks.ts`' `rockShare`),
  // so a run, a trail and everything on them read the map alone — and the
  // rock the drawing lays is the rock met, to the corner.
  const cell = ROCKS.skin.cell;
  const i0 = Math.floor(x / cell) - 1;
  const j0 = Math.floor(z / cell) - 1;
  // The 4 × 4 corners lie in one to four tiles: none of them holding a
  // bare corner, no rock is near.
  const ti0 = Math.floor(i0 / TILE);
  const ti1 = Math.floor((i0 + 3) / TILE);
  const tj0 = Math.floor(j0 / TILE);
  const tj1 = Math.floor((j0 + 3) / TILE);
  if (
    tileOf(s, ti0, tj0) === EMPTY &&
    tileOf(s, ti1, tj0) === EMPTY &&
    tileOf(s, ti0, tj1) === EMPTY &&
    tileOf(s, ti1, tj1) === EMPTY
  ) {
    return u;
  }
  let any = false;
  for (let b = 0; b < 4; b++) {
    for (let a = 0; a < 4; a++) {
      const k = b * 4 + a;
      const v = bareOf(s, i0 + a, j0 + b);
      CK[k].bare = v;
      CS[k] = 0;
      if (v > 0) any = true;
    }
  }
  if (!any) return u;
  // The jittered cells that can hold the point: the one it is in and its
  // neighbours, each laid only where a corner of it is bare. Jittered,
  // two facets can overlap in plan; the higher is the one met.
  let found = false;
  let top = -Infinity;
  let tx = 0;
  let ty = 1;
  let tw = 0;
  let tz = 0;
  let tr = 0;
  for (let b = 0; b < 3; b++) {
    for (let a = 0; a < 3; a++) {
      const ka = b * 4 + a;
      const kb = ka + 1;
      const kc = ka + 5;
      const kd = ka + 4;
      if (CK[ka].bare + CK[kb].bare + CK[kc].bare + CK[kd].bare <= 0) continue;
      if (!CS[ka]) cornerAt(s, i0 + a, j0 + b, ka);
      if (!CS[kb]) cornerAt(s, i0 + a + 1, j0 + b, kb);
      if (!CS[kc]) cornerAt(s, i0 + a + 1, j0 + b + 1, kc);
      if (!CS[kd]) cornerAt(s, i0 + a, j0 + b + 1, kd);
      const split = unit(hashOf(s.seed, i0 + a, j0 + b, 7), 0) < 0.5;
      for (let t = 0; t < 2; t++) {
        // The cell's two triangles, split along its own diagonal (as drawn).
        const o = split || t === 0 ? CK[ka] : CK[kb];
        const q = split ? (t === 0 ? CK[kb] : CK[kc]) : t === 0 ? CK[kb] : CK[kc];
        const r = split ? (t === 0 ? CK[kc] : CK[kd]) : CK[kd];
        if (!inTri(o, q, r, x, z)) continue;
        if (onSlice(s, o, q, r, x, z) && skinU.y > top) {
          found = true;
          top = skinU.y;
          tx = skinU.nx;
          ty = skinU.ny;
          tz = skinU.nz;
          tw = skinW;
          tr = skinRib;
        }
      }
    }
  }
  if (!found) return u;
  const above = top - ground;
  u.on = Math.max(0, Math.min(1, 1 + above / BURIED));
  if (above > 0) {
    u.y = top;
    u.nx = tx;
    u.ny = ty;
    u.nz = tz;
  }
  // A facet facing the sky holds snow, a tread more, as it is painted.
  u.bare = 1 - snowShare(s.strata, tw, ty, tr);
  return u;
}

const kept = new WeakMap<Level, Level>();

/** `level` with its walls' rock skin the surface — the map itself where
 * its region lays no rock. The same map is the same object. */
export function withRock(level: Level): Level {
  if (level.rockAt || !regionOf(level).rock) return level;
  const had = kept.get(level);
  if (had) return had;
  const s: Skin = {
    base: level,
    ground: (x, z) => level.groundAt(x, z),
    strata: strataOf(level),
    seed: hashOf(level.seed, SKIN_SALT),
    tiles: new Map(),
    lastX: NaN,
    lastZ: NaN,
    last: { y: 0, on: 0, bare: 0, nx: 0, ny: 1, nz: 0 },
  };
  const groundAt = (x: number, z: number): number => underOf(s, x, z).y;
  const normalAt = (x: number, z: number, out: Vec3): void => {
    const u = underOf(s, x, z);
    if (u.y > level.groundAt(x, z)) {
      out.x = u.nx;
      out.y = u.ny;
      out.z = u.nz;
    } else level.normalAt(x, z, out);
  };
  const rockAt = (x: number, z: number): number => underOf(s, x, z).on;
  const bareRockAt = (x: number, z: number): number => {
    const u = underOf(s, x, z);
    return u.on * u.bare;
  };
  const made: Level = { ...level, bedrock: level, groundAt, normalAt, rockAt, bareRockAt };
  kept.set(level, made);
  return made;
}

/** The map under its rock skin (`withRock`): what the rock is LAID off. */
export function bedrockOf(level: Level): Level {
  return level.bedrock ?? level;
}

const strikeN: Vec3 = { x: 0, y: 1, z: 0 };
/** The points a strike is felt at, out to its reach. */
const STRIKE_PROBES = 3;

/** HOW HARD A BODY MOVING AT (vx, vy, vz) RUNS INTO A WALL'S ROCK at
 * (x, z) out to `reach` m along its way (the hardest of a few points), m/s, as much of it as is bare: its
 * speed into the facet there — a step of stone rising against it faster
 * than anything sprung under it can lift it — or, driven UP a face of it
 * steeper than `climb` rad, its speed into the climb past that: skis and a
 * belt do not climb rock, they stop on it. Zero off the rock. */
export function rockStrike(
  level: Level,
  x: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  reach: number,
  climb: number,
): number {
  if (!level.bareRockAt) return 0;
  const plan = hypot(vx, vz);
  if (plan < 1) return 0;
  // Felt at a few points out to `reach`: a bed's riser is a narrow band of
  // stone in plan between two treads, and the one it runs into is the one
  // that throws it, wherever it stands in the reach.
  let most = 0;
  for (let k = 1; k <= STRIKE_PROBES; k++) {
    const d = (reach * k) / STRIKE_PROBES;
    const ax = x + (vx / plan) * d;
    const az = z + (vz / plan) * d;
    const bare = level.bareRockAt(ax, az);
    if (bare <= 0) continue;
    const n = strikeN;
    level.normalAt(ax, az, n);
    const into = -(vx * n.x + vy * n.y + vz * n.z);
    const rise = Math.atan(-((vx * n.x + vz * n.z) / plan) / Math.max(0.05, n.y));
    const up = rise > climb ? hypot3(vx, vy, vz) * Math.sin(rise - climb) : 0;
    most = Math.max(most, Math.max(0, into, up) * bare);
  }
  return most;
}

/**
 * A BODY THROWN INTO THE ROCK put back out of it: every point of `points`
 * (x, y, z triples, each `radius[i]` round) that stands inside a wall's skin
 * — a skier stood up a steep face, his feet a metre into it — moved out of
 * it WHOLE, along the facet's normal, its `last` moved alike so the shift is
 * a position corrected and never a speed. Lifted a point at a time instead,
 * straight up, a foot driven into a 70° facet would be thrown metres up it
 * and fling the body with it. Nothing moves off the rock, so no other throw
 * changes.
 */
export function outOfRock(
  level: Level,
  points: number[],
  last: number[],
  radius: readonly number[],
): void {
  if (!level.rockAt) return;
  const n = { x: 0, y: 1, z: 0 };
  for (let pass = 0; pass < 4; pass++) {
    let most = 0;
    let mx = 0;
    let my = 0;
    let mz = 0;
    for (let i = 0; i < radius.length; i++) {
      const x = points[3 * i];
      const z = points[3 * i + 2];
      if (level.rockAt(x, z) <= 0) continue;
      const d = level.groundAt(x, z) + radius[i] - points[3 * i + 1];
      if (d <= 0) continue;
      level.normalAt(x, z, n);
      const out = d * n.y;
      if (out > most) {
        most = out;
        mx = n.x;
        my = n.y;
        mz = n.z;
      }
    }
    if (most <= 1e-4) return;
    for (let i = 0; i < radius.length; i++) {
      points[3 * i] += mx * most;
      points[3 * i + 1] += my * most;
      points[3 * i + 2] += mz * most;
      last[3 * i] += mx * most;
      last[3 * i + 1] += my * most;
      last[3 * i + 2] += mz * most;
    }
  }
}

const lifted = { x: 0, y: 1, z: 0 };

/** THE STEEP SNOW a lift straight up is corrected on as on rock
 * (`liftedOnto`): none of it on a face gentler than `from` (the cosine of
 * its slope, 40°), all of it past `to` (55°) — the cut wall under a lift's
 * pad, a headwall. A body on a skiable pitch keeps its lift as ever. */
const STEEP = { from: Math.cos((40 * Math.PI) / 180), to: Math.cos((55 * Math.PI) / 180) };

/**
 * A POINT LIFTED STRAIGHT UP by `d` m onto the surface at (`x`, `z`), as a
 * ragdoll's points and a lone ski's ends are put back on it: on a steep
 * facet most of that lift lies along it, and kept as speed (the point's
 * last position at `last[j..j+2]` left behind) it would fling the point up
 * the face — a body thrown against the cut under a lift's pad was shot tens
 * of metres into the air. That share is moved with it, so only the lift's
 * way out of the facet is the point's to keep: wholly on rock, and on snow
 * by how steep it is past a skiable pitch (`STEEP`).
 */
export function liftedOnto(
  level: Level,
  x: number,
  z: number,
  d: number,
  last: number[],
  j: number,
): void {
  if (d <= 0) return;
  level.normalAt(x, z, lifted);
  const n = lifted;
  const rock = level.rockAt ? level.rockAt(x, z) > 0 : false;
  const share = rock ? 1 : Math.min(1, Math.max(0, (STEEP.from - n.y) / (STEEP.from - STEEP.to)));
  if (share <= 0) return;
  const s = d * share;
  last[j] -= s * n.y * n.x;
  last[j + 1] += s * (1 - n.y * n.y);
  last[j + 2] -= s * n.y * n.z;
}

/**
 * A POINT OF A BODY LIFTED onto a STEEP facet of rock — a ledge's riser, a
 * wall's face, steeper than `ROCKS.skin.slides` — by `d` m from where it is
 * in `points[j..j+2]`: it ran into the stone, so it keeps only its way ALONG
 * the facet and loses its way into it, and nothing of the lift is kept as
 * speed. Lifted as `liftedOnto` does, the share of a metre's lift up a
 * riser kept as the way out of it would fling the body off the face faster
 * than it came. False, and nothing moved, off steep rock.
 */
export function stoppedOnRock(
  level: Level,
  points: number[],
  last: number[],
  j: number,
  d: number,
): boolean {
  const x = points[j];
  const z = points[j + 2];
  if (d <= 0 || !level.rockAt || level.rockAt(x, z) <= 0) return false;
  const n = lifted;
  level.normalAt(x, z, n);
  if (n.y > ROCKS.skin.slides) return false;
  const vx = x - last[j];
  const vy = points[j + 1] - last[j + 1];
  const vz = z - last[j + 2];
  const into = Math.min(0, vx * n.x + vy * n.y + vz * n.z);
  last[j] = x - (vx - into * n.x);
  last[j + 1] = points[j + 1] + d - (vy - into * n.y);
  last[j + 2] = z - (vz - into * n.z);
  return true;
}

/**
 * THE WAY LEFT AFTER RUNNING INTO ROCK: `v` with its part into the facet
 * `reach` m ahead of (`x`, `z`) along it taken out — the wall stops what was
 * driven into it, and the body thrown off the skis goes on along its face.
 */
export function alongRock(level: Level, x: number, z: number, v: Vec3, reach: number): Vec3 {
  const plan = hypot(v.x, v.z);
  if (plan < 1e-6) return v;
  const n = { x: 0, y: 1, z: 0 };
  level.normalAt(x + (v.x / plan) * reach, z + (v.z / plan) * reach, n);
  const into = v.x * n.x + v.y * n.y + v.z * n.z;
  if (into >= 0) return v;
  return { x: v.x - into * n.x, y: v.y - into * n.y, z: v.z - into * n.z };
}
