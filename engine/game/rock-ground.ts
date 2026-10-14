// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK UNDERFOOT — a wall's rock made the SURFACE a body meets:
// `withRock` hands back the map with `groundAt` and `normalAt` answering
// off the rock wherever the ground is a wall too steep for snow, so a skier
// rides on the rock that is drawn rather than through it, a skier driven
// into a wall meets the ledges it is drawn in, and the snowmobile, the
// ragdoll, the skis let go and every craft in the air come down on the
// same stone. `rockAt` says how much of the surface there is rock and
// `bareRockAt` how much of that is bare — none on a ledge the snow lies on
// — and the physics reads it as a hard, scraping, unforgiving surface
// (`snow.ts`' `onRock`, `rockDrag`, `body.ts`' `snowGive`).
//
// THE ROCK IS THE GROUND, RESHAPED: the map's height plus the rock's
// relief (`rock-relief.ts`' `reliefAt`: its beds, its joints, its ribs)
// as much as the ground there is rock (`rock-share.ts`' `rockMask`, off
// the heightfield's own nodes). The ground's shader draws the same
// function at its vertices, so what is met is what is seen — no skin over
// the snow, no seam at its edge.
//
// CHEAP: the only thing kept is the share at the heightfield's nodes, a
// tile at a time and only for a tile a body has asked about. A query on
// packed snow or off every wall reads that and the map itself. A pure
// function of the map, off hashes of `level.seed`; no wall stands where a
// run is skied or a bike trail ridden, so no digest moves.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { regionOf } from "../mapgen/regions.ts";
import type { Level } from "../mapgen/types.ts";
import { ROCKS } from "./defs/rocks.ts";
import { reliefAt, reliefParams, type ReliefParams } from "./rock-relief.ts";
import { rockMask } from "./rock-share.ts";

/** The salt a wall's rock is dealt off (`hashOf(level.seed, SKIN_SALT)`),
 * the cliffs' walls' too. */
export const SKIN_SALT = 0x534b494e;

/** THE LATTICE the rock is laid on, m: its relief is read at the corners
 * of `LATTICE` m squares and laid flat between them, each square split
 * along the diagonal from its +x corner to its +z corner — the ground's
 * finest clipmap level exactly (`terrain.ts`' `clipmapIndices`, a vertex
 * every quarter metre on the finest picture), so the rock a body meets is
 * the rock drawn, facet for facet, whatever the lens. */
export const ROCK_LATTICE = 0.25;

/** What lies at a point of the surface. */
type Under = {
  /** The surface's height, m. */
  y: number;
  /** The rock's share of it: 1 on the rock, 0 on the snow. */
  on: number;
  /** Of that, how bare the rock is (a ledge facing the sky holds snow). */
  bare: number;
  /** The surface's normal on the rock. */
  nx: number;
  ny: number;
  nz: number;
};

/** A corner of the lattice: the rock's share there and how far it lifts. */
type Corner = { i: number; j: number; m: number; r: number };

type Skin = {
  readonly base: Level;
  readonly relief: ReliefParams;
  /** The last point asked and its answer: a body asks `groundAt`,
   * `normalAt` and `rockAt` at one point in a row. */
  lastX: number;
  lastZ: number;
  readonly last: Under;
  /** The last few corners read, a body reads one square again and again. */
  readonly corners: Corner[];
  next: number;
  readonly n: Vec3;
};

/** The lattice corner (i, j): its share and its lift, m. */
function cornerOf(s: Skin, i: number, j: number): Corner {
  for (const c of s.corners) if (c.i === i && c.j === j) return c;
  const c = s.corners[s.next];
  s.next = (s.next + 1) % s.corners.length;
  const x = i * ROCK_LATTICE;
  const z = j * ROCK_LATTICE;
  c.i = i;
  c.j = j;
  c.m = rockMask(s.base, x, z);
  c.r = c.m > 0 ? c.m * reliefAt(s.relief, x, z, s.base.groundAt(x, z)) : 0;
  return c;
}

/** The surface at (x, z) into `s.last`. */
function underOf(s: Skin, x: number, z: number): Under {
  const u = s.last;
  if (x === s.lastX && z === s.lastZ) return u;
  s.lastX = x;
  s.lastZ = z;
  const base = s.base;
  const fx = x / ROCK_LATTICE;
  const fz = z / ROCK_LATTICE;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const a = fx - i;
  const b = fz - j;
  // The square's facet the point is on: (i, j), (i+1, j), (i, j+1) under
  // the diagonal, (i+1, j+1), (i, j+1), (i+1, j) over it.
  const lo = a + b <= 1;
  // (Each corner read out at once: the next read may reuse its slot.)
  let c = lo ? cornerOf(s, i, j) : cornerOf(s, i + 1, j + 1);
  const m0 = c.m;
  const r0 = c.r;
  c = cornerOf(s, i + 1, j);
  const mx = c.m;
  const rx = c.r;
  c = cornerOf(s, i, j + 1);
  const mz = c.m;
  const rz = c.r;
  u.bare = 0;
  if (m0 <= 0 && mx <= 0 && mz <= 0) {
    u.on = 0;
    u.y = base.groundAt(x, z);
    return u;
  }
  // Laid out from the first corner toward the one along x and the one
  // along z: under the diagonal from (i, j), over it back from (i+1, j+1).
  const ka = lo ? a : 1 - a;
  const kb = lo ? b : 1 - b;
  const ma = lo ? mx : mz;
  const mb = lo ? mz : mx;
  const ra = lo ? rx : rz;
  const rb = lo ? rz : rx;
  u.on = m0 + (ma - m0) * ka + (mb - m0) * kb;
  u.y = base.groundAt(x, z) + r0 + (ra - r0) * ka + (rb - r0) * kb;
  // The facet's slope over the ground's own.
  const gx = (lo ? rx - r0 : r0 - rz) / ROCK_LATTICE;
  const gz = (lo ? rz - r0 : r0 - rx) / ROCK_LATTICE;
  const n = s.n;
  base.normalAt(x, z, n);
  const sx = -n.x / n.y + gx;
  const sz = -n.z / n.y + gz;
  const l = hypot3(sx, 1, sz);
  u.nx = -sx / l;
  u.ny = 1 / l;
  u.nz = -sz / l;
  // A ledge facing the sky holds snow, as it is painted.
  const S = ROCKS.skin;
  u.bare = 1 - Math.max(0, Math.min(1, (u.ny - S.slides) / (S.holds - S.slides)));
  return u;
}

const kept = new WeakMap<Level, Level>();

/** `level` with its walls' rock the surface — the map itself where its
 * region lays no rock. The same map is the same object. */
export function withRock(level: Level): Level {
  if (level.rockAt || !regionOf(level).rock) return level;
  const had = kept.get(level);
  if (had) return had;
  const s: Skin = {
    base: level,
    relief: reliefParams(level),
    lastX: NaN,
    lastZ: NaN,
    last: { y: 0, on: 0, bare: 0, nx: 0, ny: 1, nz: 0 },
    corners: Array.from({ length: 8 }, () => ({ i: NaN, j: NaN, m: 0, r: 0 })),
    next: 0,
    n: { x: 0, y: 1, z: 0 },
  };
  const groundAt = (x: number, z: number): number => underOf(s, x, z).y;
  const normalAt = (x: number, z: number, out: Vec3): void => {
    const u = underOf(s, x, z);
    if (u.on > 0) {
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
  // Read at a few points out to the reach, the hardest counting: the rock
  // is ledged, and a tip over a tread that holds snow is still a tip a
  // metre short of the riser above it.
  const n = strikeN;
  let most = 0;
  for (let k = 1; k <= STRIKE_READS; k++) {
    const d = (reach * k) / STRIKE_READS;
    const ax = x + (vx / plan) * d;
    const az = z + (vz / plan) * d;
    const bare = level.bareRockAt(ax, az);
    if (bare <= 0) continue;
    level.normalAt(ax, az, n);
    const into = -(vx * n.x + vy * n.y + vz * n.z);
    const rise = Math.atan(-((vx * n.x + vz * n.z) / plan) / Math.max(0.05, n.y));
    const up = rise > climb ? hypot3(vx, vy, vz) * Math.sin(rise - climb) : 0;
    most = Math.max(most, Math.max(0, into, up) * bare);
  }
  return most;
}

/** How many points out to the reach a strike is read at. */
const STRIKE_READS = 4;

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
