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
// heights over the ground and the same diagonal a cell, so what is met is
// what is seen. (The FOREST row's cheap picture draws a coarser lattice of
// the same rock; the physics is never a picture setting's.)
//
// CHEAP: nothing is stored but how bare each lattice corner is, a byte a
// corner, a tile of corners at a time and only for a tile a body has
// asked about — a tile with no bare corner is one shared empty mark. A
// query on packed snow or off every wall reads that and the map itself.
// A pure function of the map, off hashes of `level.seed`; no wall stands
// where a run is skied, so no digest moves.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { regionOf } from "../mapgen/regions.ts";
import type { Level } from "../mapgen/types.ts";
import { ROCKS } from "./defs/rocks.ts";
import { hashOf, rockShare, unit } from "./rocks.ts";

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
        out[b * TILE + a] = Math.max(1, Math.round(bare * Q));
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

// The 4 × 4 corners round a point: plan, height, bareness.
const CX = new Float64Array(16);
const CY = new Float64Array(16);
const CZ = new Float64Array(16);
const CB = new Float64Array(16);
const CS = new Uint8Array(16);

function cornerAt(s: Skin, i: number, j: number, k: number): void {
  const S = ROCKS.skin;
  const h = hashOf(s.seed, i, j);
  const x = (i + (unit(h, 0) - 0.5) * 2 * S.jitter) * S.cell;
  const z = (j + (unit(h, 1) - 0.5) * 2 * S.jitter) * S.cell;
  const ground = s.base.groundAt(x, z);
  const bare = CB[k];
  CX[k] = x;
  CZ[k] = z;
  CY[k] = bare > 0 ? ground + S.proud + S.rough * bare * unit(h, 2) : ground - S.sink;
  CS[k] = 1;
}

/** Whether the triangle of corners `a`, `b`, `c` holds (x, z) in plan; if
 * so its height and up-facing normal into `u`. */
function onTri(a: number, b: number, c: number, x: number, z: number, u: Under): boolean {
  const ax = CX[a];
  const az = CZ[a];
  const e1x = CX[b] - ax;
  const e1z = CZ[b] - az;
  const e2x = CX[c] - ax;
  const e2z = CZ[c] - az;
  const det = e1x * e2z - e2x * e1z;
  if (Math.abs(det) < 1e-9) return false;
  const px = x - ax;
  const pz = z - az;
  const v = (px * e2z - e2x * pz) / det;
  const w = (e1x * pz - px * e1z) / det;
  const eps = -1e-7;
  if (v < eps || w < eps || v + w > 1 - eps) return false;
  const e1y = CY[b] - CY[a];
  const e2y = CY[c] - CY[a];
  u.y = CY[a] + v * e1y + w * e2y;
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
  return true;
}

const skinU: Under = { y: 0, on: 0, bare: 0, nx: 0, ny: 1, nz: 0 };

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
  // A wall is never packed (`ROCKS.packed`): a run, and everything on it,
  // reads the map alone.
  if (base.packedAt(x, z) > 0.5) return u;
  const cell = ROCKS.skin.cell;
  const i0 = Math.floor(x / cell) - 1;
  const j0 = Math.floor(z / cell) - 1;
  let any = false;
  for (let b = 0; b < 4; b++) {
    for (let a = 0; a < 4; a++) {
      const k = b * 4 + a;
      const v = bareOf(s, i0 + a, j0 + b);
      CB[k] = v;
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
  let tz = 0;
  for (let b = 0; b < 3; b++) {
    for (let a = 0; a < 3; a++) {
      const ka = b * 4 + a;
      const kb = ka + 1;
      const kc = ka + 5;
      const kd = ka + 4;
      if (CB[ka] + CB[kb] + CB[kc] + CB[kd] <= 0) continue;
      if (!CS[ka]) cornerAt(s, i0 + a, j0 + b, ka);
      if (!CS[kb]) cornerAt(s, i0 + a + 1, j0 + b, kb);
      if (!CS[kc]) cornerAt(s, i0 + a + 1, j0 + b + 1, kc);
      if (!CS[kd]) cornerAt(s, i0 + a, j0 + b + 1, kd);
      const split = unit(hashOf(s.seed, i0 + a, j0 + b, 7), 0) < 0.5;
      for (let t = 0; t < 2; t++) {
        const hit = split
          ? t === 0
            ? onTri(ka, kb, kc, x, z, skinU)
            : onTri(ka, kc, kd, x, z, skinU)
          : t === 0
            ? onTri(ka, kb, kd, x, z, skinU)
            : onTri(kb, kc, kd, x, z, skinU);
        if (hit && skinU.y > top) {
          found = true;
          top = skinU.y;
          tx = skinU.nx;
          ty = skinU.ny;
          tz = skinU.nz;
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
  // A facet facing the sky holds snow, as it is painted.
  const S = ROCKS.skin;
  u.bare = 1 - Math.max(0, Math.min(1, (ty - S.slides) / (S.holds - S.slides)));
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

/** HOW HARD A BODY MOVING AT (vx, vy, vz) RUNS INTO A WALL'S ROCK at
 * (x, z) plus `reach` m along its way, m/s, as much of it as is bare: its
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
  const ax = x + (vx / plan) * reach;
  const az = z + (vz / plan) * reach;
  const bare = level.bareRockAt(ax, az);
  if (bare <= 0) return 0;
  const n = strikeN;
  level.normalAt(ax, az, n);
  const into = -(vx * n.x + vy * n.y + vz * n.z);
  const rise = Math.atan(-((vx * n.x + vz * n.z) / plan) / Math.max(0.05, n.y));
  const up = rise > climb ? hypot3(vx, vy, vz) * Math.sin(rise - climb) : 0;
  return Math.max(0, into, up) * bare;
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

/**
 * A POINT LIFTED STRAIGHT UP by `d` m onto the rock at (`x`, `z`), as a
 * ragdoll's points and a lone ski's ends are put back on the surface: on a
 * steep facet most of that lift lies along it, and kept as speed (the
 * point's last position at `last[j..j+2]` left behind) it would fling the
 * point up the face. That share is moved with it, so only the lift's way out
 * of the facet is the point's to keep. Nothing off the rock is touched.
 */
export function liftedOnRock(
  level: Level,
  x: number,
  z: number,
  d: number,
  last: number[],
  j: number,
): void {
  if (d <= 0 || !level.rockAt || level.rockAt(x, z) <= 0) return;
  level.normalAt(x, z, lifted);
  const n = lifted;
  last[j] -= d * n.y * n.x;
  last[j + 1] += d * (1 - n.y * n.y);
  last[j + 2] -= d * n.y * n.z;
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
