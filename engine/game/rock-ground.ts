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
// The skin is the ROCK FIELD's (`rock-field.ts`): the field sampled every
// `ROCK_FIELD.fine` m and laid as the finest mesh of the drawing's adaptive
// triangulation (`rock-rtin.ts`), so the drawing's near cut — a coarsening
// of this very surface — stands within a few cm of what is met, and never
// over it by more than a hair.
//
// CHEAP: nothing is stored but how bare each corner of a 4 m lattice is, a
// byte a corner, a tile at a time and only where a body has asked; a query
// is three samples of the field. A query on packed snow or off every wall
// reads the map itself. A pure function of the map, off hashes of
// `level.seed`; no wall stands where a run is skied or a bike trail ridden,
// so no digest moves.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { regionOf } from "../mapgen/regions.ts";
import type { Level } from "../mapgen/types.ts";
import { ROCKS } from "./defs/rocks.ts";
import {
  ROCK_FIELD,
  fieldAt,
  noRockIn,
  rockFieldOf,
  type FieldPoint,
  type RockField,
} from "./rock-field.ts";
import { rockLeaf } from "./rock-rtin.ts";

/** The salt a wall's skin was once dealt off; kept for the drawing's cliff
 * walls and the labs that name it. */
export const SKIN_SALT = 0x534b494e;

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
  readonly field: RockField;
  /** The last point asked and its answer: a body asks `groundAt`,
   * `normalAt` and `rockAt` at one point in a row. */
  lastX: number;
  lastZ: number;
  readonly last: Under;
};

const LEAF = new Int32Array(6);
const P: FieldPoint = { y: 0, ground: 0, rock: 0, phi: 0, shade: 0, cavity: 0 };
const CELLS = ROCK_FIELD.tile / ROCK_FIELD.fine;

/** The surface at (x, z) into `s.last`: the FINEST triangle of the rock
 * field's adaptive mesh (`rock-rtin.ts`' `rockLeaf`) holding it, its three
 * samples the field's own — the surface the drawing's near cut stands
 * within a few cm of. */
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
  // No rock stands within `ROCKS.skin.clear` of packed snow or a summer bike
  // trail (`rocks.ts`' `rockShare`): a run, a trail and everything on them
  // read the map alone.
  const f = s.field;
  if (noRockIn(f, x - 1, z - 1, x + 1, z + 1)) return u;
  const T = ROCK_FIELD.tile;
  const step = ROCK_FIELD.fine;
  const ti = Math.floor(x / T);
  const tj = Math.floor(z / T);
  const ox = ti * T;
  const oz = tj * T;
  rockLeaf(CELLS, (x - ox) / step, (z - oz) / step, LEAF);
  const ax = ox + LEAF[0] * step;
  const az = oz + LEAF[1] * step;
  const bx = ox + LEAF[2] * step;
  const bz = oz + LEAF[3] * step;
  const cx = ox + LEAF[4] * step;
  const cz = oz + LEAF[5] * step;
  // The rock's three samples, lifted onto the snow where it is buried — the
  // drawing's own finest mesh, which its every cut stands within a hair of.
  let p = fieldAt(f, ax, az, P);
  const ay = Math.max(p.y, p.ground);
  let shows = p.y > p.ground;
  let laid = p.rock > 0;
  p = fieldAt(f, bx, bz, P);
  const by = Math.max(p.y, p.ground);
  shows ||= p.y > p.ground;
  laid ||= p.rock > 0;
  p = fieldAt(f, cx, cz, P);
  const cy = Math.max(p.y, p.ground);
  shows ||= p.y > p.ground;
  laid ||= p.rock > 0;
  // Where no rock is laid at all — everywhere off a crag — the snow is the
  // map's own, to the last bit.
  if (!laid) return u;
  const e1x = bx - ax;
  const e1y = by - ay;
  const e1z = bz - az;
  const e2x = cx - ax;
  const e2y = cy - ay;
  const e2z = cz - az;
  const det = e1x * e2z - e2x * e1z;
  const v = ((x - ax) * e2z - e2x * (z - az)) / det;
  const w = (e1x * (z - az) - (x - ax) * e1z) / det;
  const top = ay + v * e1y + w * e2y;
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const l = hypot3(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  // Rock under the foot only where a corner of it stands out of the snow;
  // elsewhere the mesh lies on the snow (within the ground's own bend over a
  // metre), and is snow.
  u.on = shows ? Math.max(0, Math.min(1, 1 + (top - ground) / ROCK_FIELD.under)) : 0;
  if (top > ground) {
    u.y = top;
    u.nx = nx;
    u.ny = ny;
    u.nz = nz;
  }
  // A facet facing the sky holds snow, as it is painted.
  const S = ROCKS.skin;
  u.bare = 1 - Math.max(0, Math.min(1, (ny - S.slides) / (S.holds - S.slides)));
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
    field: rockFieldOf(level),
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
 * A POINT OF A BODY LIFTED onto a STEEP facet of rock — a ledge's riser, a
 * wall's face, steeper than `ROCKS.skin.slides` — lifted by `d` m from
 * where it is in `points[j..j+2]`: it ran into the stone, so it keeps only
 * its way along the facet and loses its way into it; nothing of the lift is
 * kept as speed. Lifted as `liftedOnRock` does, the share of a lift of a
 * metre up a riser kept as the way out of it would fling the body off the
 * face faster than it came. False, and nothing moved, off steep rock.
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
