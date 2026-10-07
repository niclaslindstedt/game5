// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CLIFF'S ROCK WALL — the face of every rocky cliff (R22's `C…` bands off
// the piste, `rockyCliff`) clad whole in coarse, faceted rock from the lip
// to the foot: a skin of jittered corners laid over the face, its top row
// ON the lip so the rock is the edge of the hill rather than something
// peeking out half way down a snow slope, and its foot row sunk into the
// snow of the landing. The face it stands on is the generator's (a 68°
// wall a couple of metres deep, rounded by the 2 m grid it is sampled on);
// the skin is laid as a STRAIGHT, STEEP fall from the lip to the foot and
// always a little proud of the ground under it, so what reads is a flat,
// broken rock wall and no rounded snow behind it. Nobody rides up or down
// the face, so nothing here stands on snow a skier rides; the shelf behind
// the lip and the landing below it are left as they are.
//
// SOLID: a column (`Upright`) inside the wall at every few metres across
// it, so a skier slid along its foot or thrown into it meets rock
// (`wallSolids`, in `posts.ts`' `solidsOf` after the blocks). A pure function of the
// map, off hashes of `level.seed` and never the engine's stream, kept per
// map. The drawing is `pwa/src/game/rock-shapes.ts`' `buildWall`.

import { LEVEL_RULES } from "../mapgen/rules.ts";
import { regionOf } from "../mapgen/regions.ts";
import type { Cliff, Level } from "../mapgen/types.ts";
import { ROCKS } from "./defs/rocks.ts";
import { hashOf, rockyCliff, unit } from "./rocks.ts";
import type { Upright } from "./upright-grid.ts";

/** One cliff's rock skin: `rows` × `cols` corners, row 0 behind the lip
 * and the last at the foot, column 0 at the cliff's left end; `pos` three
 * floats a corner, row by row. */
export type CliffWall = {
  /** Its middle on the lip, for binning, m. */
  readonly x: number;
  readonly z: number;
  /** Down the face, the cliff's own heading, rad. */
  readonly heading: number;
  readonly rows: number;
  readonly cols: number;
  readonly pos: readonly number[];
  readonly hash: number;
};

const SALT = 0x57414c4c;

const walls = new WeakMap<Level, CliffWall[]>();

/** EVERY ROCKY CLIFF'S WALL of `level` (none where its region lays no
 * rock). Kept per map. */
export function cliffWalls(level: Level): readonly CliffWall[] {
  let list = walls.get(level);
  if (list) return list;
  list = regionOf(level).rock
    ? (level.cliffs ?? [])
        .filter(rockyCliff)
        .map((c, k) => cliffWall(level, c, hashOf(level.seed, SALT, k)))
    : [];
  walls.set(level, list);
  return list;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How tall the face stands `v` m across a cliff from its middle, of its
 * drop: whole over its width, sinking back into the country over the
 * generator's `edge` at either end (`stampCliff`'s blend). */
export function faceShare(c: Cliff, v: number): number {
  return 1 - smooth(c.width / 2, c.width / 2 + LEVEL_RULES.cliff.edge, Math.abs(v));
}

function cliffWall(level: Level, c: Cliff, seed: number): CliffWall {
  const W = ROCKS.face;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  // Across: `stampCliff`'s v.
  const ax = fz;
  const az = -fx;
  const side = c.width / 2 + LEVEL_RULES.cliff.edge * W.ends;
  const cols = Math.max(2, Math.round((2 * side) / W.pitch) + 1);
  const shares = W.rows;
  const rows = shares.length + 3;
  const pos: number[] = [];
  const at = (u: number, v: number): [number, number] => [
    c.x + fx * u + ax * v,
    c.z + fz * u + az * v,
  ];
  for (let r = 0; r < rows; r++) {
    for (let j = 0; j < cols; j++) {
      const h = hashOf(seed, r, j);
      const end = j === 0 || j === cols - 1;
      const v =
        -side + (2 * side * j) / (cols - 1) + (end ? 0 : (unit(h, 0) - 0.5) * W.pitch * 0.6);
      const tall = c.drop * faceShare(c, v);
      // Where the face has sunk into the country the skin goes under the
      // snow with it, so its ends taper away rather than stop.
      const buried = end || tall < W.least;
      let u: number;
      let y: number;
      if (r === 0) {
        // Behind the lip, under the shelf's snow: the skin tucked in.
        u = -W.behind * (0.7 + 0.6 * unit(h, 1));
        const [x, z] = at(u, v);
        y = level.groundAt(x, z) - W.sink;
      } else if (r === rows - 1) {
        // The foot, sunk into the landing's snow.
        u = c.face + W.foot * (0.6 + 0.8 * unit(h, 1));
        const [x, z] = at(u, v);
        y = level.groundAt(x, z) - W.sink;
      } else {
        // The lip (row 1) and the face below it: a straight fall from the
        // ground at the lip to the ground at the foot, each corner pushed
        // out of the face a little and never under the ground it stands
        // over, so the rounded snow face is hidden behind it.
        const s = r === 1 ? 0 : shares[r - 2] + (unit(h, 2) - 0.5) * W.wobble;
        // The top of the hill is the shelf's own line carried out to the
        // lip: the grid the ground is sampled on rounds the lip off, and
        // the rock's top row stands at the lip as it is, not as the grid
        // rounds it.
        const [lx, lz] = at(-0.3, v);
        const [kx, kz] = at(-1.0, v);
        const [qx, qz] = at(-1.7, v);
        const [bx, bz] = at(c.face + 0.8, v);
        const back = level.groundAt(kx, kz);
        const top = Math.max(level.groundAt(lx, lz), 2 * back - level.groundAt(qx, qz));
        const bottom = level.groundAt(bx, bz);
        // A column stood out further than its neighbours is a buttress,
        // the corners between them the gully behind it.
        const butt = W.buttress * Math.max(0, (unit(hashOf(seed, 99, j), 0) - 0.4) / 0.6);
        const out =
          r === 1 ? W.crown * unit(h, 3) : W.out[0] + (W.out[1] - W.out[0]) * unit(h, 3) + butt;
        u = s * c.face + out;
        const [x, z] = at(u, v);
        y = top + (bottom - top) * s + (r === 1 ? W.crown * unit(h, 4) : 0);
        y = Math.max(y, level.groundAt(x, z) + (r === 1 ? 0.02 : W.proud));
        if (buried) y = Math.min(y, level.groundAt(x, z) - W.sink);
      }
      const [x, z] = at(u, v);
      pos.push(x, y, z);
    }
  }
  return { x: c.x, z: c.z, heading: c.heading, rows, cols, pos, hash: seed };
}

/** A WALL AS A SKIER MEETS IT: a column inside the face every `pitch` m
 * across it where it stands tall enough to strike, from the snow at its
 * middle to under the lip, no wider than the face is deep, so it never
 * stands out over the landing. Kept per map. */
const solids = new WeakMap<Level, Upright[]>();

export function wallSolids(level: Level): readonly Upright[] {
  const had = solids.get(level);
  if (had) return had;
  const out: Upright[] = [];
  solids.set(level, out);
  const W = ROCKS.face;
  for (const c of (level.cliffs ?? []).filter(rockyCliff)) {
    if (!regionOf(level).rock) break;
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const side = c.width / 2 + LEVEL_RULES.cliff.edge * W.ends;
    const n = Math.max(1, Math.floor((2 * side) / W.pitch));
    const radius = Math.min(ROCKS.widest, c.face * 0.4);
    for (let j = 0; j <= n; j++) {
      const v = -side + (2 * side * j) / n;
      const u = c.face * 0.45;
      const x = c.x + fx * u + fz * v;
      const z = c.z + fz * u - fx * v;
      const y = level.groundAt(x, z);
      const lip = level.groundAt(c.x - fx * 0.3 + fz * v, c.z - fz * 0.3 - fx * v);
      const height = lip - y - ROCKS.lip;
      if (c.drop * faceShare(c, v) < W.least || height < ROCKS.least) continue;
      out.push({ x, z, y, height, radius, stuff: "rock" });
    }
  }
  return out;
}
