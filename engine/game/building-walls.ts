// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY BUILDING SOLID AS IT IS DRAWN — the walls of the log cabins, the
// afterski lodges, the ski area's own buildings and the village's town
// (`cabinsOf`), met by a skier as WALLS: a slab `BUILDING_WALLS.wall` thick
// standing inside each footprint, its outer face the footprint's edge, from
// the lowest snow under the building to over its ridge — and the terrace
// rails round a deck, the woodpiles and the stacks against a wall, the
// porch posts and the columns before a front (`attachedOf`), as the
// drawing stands them. A slab is a SEGMENT down its middle line with a
// half-thickness, so a skier slides along a wall rather than snagging on a
// row of posts, is held out of it at any speed (the path from where he was
// to where he is is asked as well as where he is — `holdOutOfWalls`) and
// is held IN by the same walls once he is inside.
//
// EVERY BUILDING WITH A DOOR HAS A DOORWAY in the wall the door is drawn in
// (`BUILDING_DOORS`), shut by the DOOR ITSELF — a segment of its own,
// solid while the door is shut. A run keeps which doors stand open
// (`GameState.doors`, by the building's id): `setDoor` opens and shuts
// one, `doorOpen` asks, and a door left open is a gap a walker passes
// through into the room (`buildingDoors` says where every door is, its
// middle on the wall's face and the way out of it).
//
// Everything that meets a solid as a CYLINDER — the skis let go, the
// snowmobile, the piste machine, the bots looking ahead — meets the same
// walls as a close row of posts (`cabinWalls`, in `posts.ts`' `solidsOf`),
// the door's posts flagged with its building so an open door lets them by.
//
// A pure function of the map (its cabins) and, for the doors, the run's own
// state — never the stream — so no digest moves for it.

import { cellKey, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import { cabinsOf, type Cabin } from "./cabins.ts";
import {
  BUILDING_DOORS,
  BUILDING_WALLS as B,
  TERRACES,
  type DoorStuff,
  type DoorSwingWay,
} from "./defs/building-walls.ts";
import { CABINS, type CabinKind } from "./defs/cabins.ts";
import { CHURCH_TOWER } from "./defs/resort-buildings.ts";
import type { GameState } from "./state.ts";
import type { Stuff, Upright } from "./upright-grid.ts";

/** A small hash of a building's id and a salt to 0..1 — the building's own
 * choices (which end of its front its door is at, which flank its woodpile
 * leans on, its colourway), never the engine's stream. The drawing reads
 * the same function (`resort-props.ts`'s `idHash`). */
export function buildingHash(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** One slab of wall as it is met: its middle line from (ax, az) to
 * (bx, bz) in the world, half its thickness, the snow under its foot and
 * its top (world heights, m), the building it is part of (an index into
 * `cabinsOf`), the building's id when it is a DOOR (solid only while the
 * door is shut), and what it is made of. */
export type WallSegment = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  half: number;
  y: number;
  top: number;
  cabin: number;
  door: string | null;
  stuff: Stuff;
};

/** A building's DOOR as a walker meets it: the building's id and index
 * into `cabinsOf`, its kind; the middle of the doorway on the wall's outer
 * face (x, z) at the floor (y), the heading OUT of it (the heading
 * convention: 0 = +z, clockwise), the doorway's clear width and the leaf's
 * height, m; and a point a metre OUTSIDE it and a metre INSIDE it, where a
 * walker stands to open it and where he stands once through; and how it
 * opens (`DoorDef`): which way, its leaves and each one's width, the jamb a
 * single leaf hangs on as seen from outside, what it is made of. */
export type BuildingDoor = {
  id: string;
  cabin: number;
  kind: CabinKind;
  x: number;
  z: number;
  y: number;
  heading: number;
  width: number;
  height: number;
  outside: { x: number; z: number };
  inside: { x: number; z: number };
  swing: DoorSwingWay;
  leaves: 1 | 2;
  leaf: number;
  hinge: "left" | "right";
  stuff: DoorStuff;
};

/** A door as `doorPlanOf` puts it on its building: its wall, its middle
 * along it, its doorway and how it opens, the hinge resolved. */
export type DoorPlan = {
  side: "front" | "back" | "left" | "right";
  at: number;
  width: number;
  height: number;
  swing: DoorSwingWay;
  leaves: 1 | 2;
  leaf: number;
  hinge: "left" | "right";
  stuff: DoorStuff;
};

/** A building's frame put into the world: a point (lx across its front,
 * lz out of it) at x = c.x + lx·cos h + lz·sin h, z = c.z − lx·sin h +
 * lz·cos h. */
function toWorld(c: Cabin, lx: number, lz: number): { x: number; z: number } {
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  return { x: c.x + lx * fz + lz * fx, z: c.z - lx * fx + lz * fz };
}

/** Where `c`'s door is in its own frame: the wall, its middle along it (x
 * on the front or back, z on a flank), the doorway's width and the leaf's
 * height, and how it opens — a single leaf hung on the jamb nearer the
 * corner it stands toward unless its row says — or null for a building
 * without one. */
export function doorPlanOf(c: Cabin): DoorPlan | null {
  const def = BUILDING_DOORS[c.kind];
  if (!def) return null;
  const at = def.dealt !== undefined && buildingHash(c.id, def.dealt) < 0.5 ? -def.at : def.at;
  // `at` runs along the frame's own axis (x on the front and back, z on a
  // flank); a wall's `u` runs to the LEFT of one stood outside facing it.
  const S = SIDES[def.side];
  const right = at * (S.ux + S.uz) < 0;
  return {
    side: def.side,
    at,
    width: def.width,
    height: def.height,
    swing: def.swing,
    leaves: def.leaves,
    leaf: def.leaf,
    hinge: def.hinge ?? (at === 0 ? "left" : right ? "right" : "left"),
    stuff: def.stuff,
  };
}

/** The outward normal and the along axis of a wall side, in the frame. */
const SIDES = {
  front: { nx: 0, nz: 1, ux: 1, uz: 0 },
  back: { nx: 0, nz: -1, ux: -1, uz: 0 },
  right: { nx: 1, nz: 0, ux: 0, uz: -1 },
  left: { nx: -1, nz: 0, ux: 0, uz: 1 },
} as const;

/** A box against or beside a building, in its frame: x0..x1 across, z0..z1
 * out, `top` m over the floor; or a post at (x, z) of radius `r`. */
type Attached =
  | { box: [number, number, number, number]; top: number }
  | { post: [number, number, number]; top: number };

/** WHAT STANDS AGAINST A BUILDING as the drawing stands it, from the snow:
 * the woodpiles and the stacks against its walls, the posts carrying a
 * porch's roof, the columns before a lodge's face. */
function attachedOf(c: Cabin): Attached[] {
  const d = CABINS[c.kind];
  const hw = d.width / 2;
  const hd = d.depth / 2;
  switch (c.kind) {
    case "hut": {
      // `cabin-shapes.ts`: the woodstack up the right flank, the entry's
      // two posts at the roof's end.
      const z = hd + d.reach.front - 0.22;
      return [
        { box: [hw + 0.02, 0, hw + 0.44, 2.3], top: 1.4 },
        { post: [-hw + 0.12, z, 0.09], top: d.walls },
        { post: [hw - 0.12, z, 0.09], top: d.walls },
      ];
    }
    case "cabin": {
      // The stack up the left gable, the woodstack on the right flank, the
      // porch's four posts.
      const z = hd + d.reach.front - 0.25;
      return [
        { box: [-hw - 0.85, -1.7, -hw, -0.3], top: d.ridge + 0.75 },
        { box: [hw + 0.02, -2.45, hw + 0.44, -0.75], top: 1.45 },
        ...[-hw + 0.2, -1.2, 1.2, hw - 0.2].map((x) => ({
          post: [x, z, 0.1] as [number, number, number],
          top: 2.4,
        })),
      ];
    }
    case "house": {
      // `village-town.ts`: the woodpile under the eaves of one flank.
      const side = buildingHash(c.id, 10) < 0.5 ? -1 : 1;
      const x0 = side * hw;
      const x1 = side * (hw + 0.7);
      return [{ box: [Math.min(x0, x1), -hd + 1, Math.max(x0, x1), hd - 2], top: 1.6 }];
    }
    case "restaurant": {
      // `village-build.ts`: the glulam columns down the face, none before
      // the doors.
      const out: Attached[] = [];
      for (let i = 0; i <= 6; i++) {
        const x = -hw + 0.3 + ((2 * hw - 0.6) * i) / 6;
        if (Math.abs(x) < 2.6) continue;
        out.push({ post: [x, hd + 0.175, 0.16], top: d.walls });
      }
      return out;
    }
    default:
      return [];
  }
}

/** A building's walls in plan, in its frame: the corners of their middle
 * line `half` m in from the footprint's edge, round in order, and which
 * edge (from corner i to i + 1) the door is in. A box for every kind but
 * the church — its nave, and its tower standing out of the nave's front
 * (`CHURCH_TOWER`), the door in the tower's face. */
function outlineOf(c: Cabin, half: number): { pts: [number, number][]; doorEdge: number } {
  const d = CABINS[c.kind];
  const hw = d.width / 2 - half;
  const hd = d.depth / 2 - half;
  if (c.kind === "church") {
    const th = CHURCH_TOWER.side / 2 - half;
    const tf = d.depth / 2 - CHURCH_TOWER.side - half;
    return {
      pts: [
        [-th, hd],
        [th, hd],
        [th, tf],
        [hw, tf],
        [hw, -hd],
        [-hw, -hd],
        [-hw, tf],
        [-th, tf],
      ],
      doorEdge: 0,
    };
  }
  const door = BUILDING_DOORS[c.kind];
  const pts: [number, number][] = [
    [-hw, hd],
    [hw, hd],
    [hw, -hd],
    [-hw, -hd],
  ];
  const edges = { front: 0, right: 1, back: 2, left: 3 } as const;
  return { pts, doorEdge: door ? edges[door.side] : -1 };
}

type Walls = { segments: WallSegment[]; cells: Map<number, number[]>; reach: number };

const cache = new WeakMap<Level, Walls>();

/** EVERY WALL SEGMENT of `level`'s buildings, worked out once and hashed. */
export function wallSegmentsOf(level: Level): readonly WallSegment[] {
  return wallsOf(level).segments;
}

function wallsOf(level: Level): Walls {
  let walls = cache.get(level);
  if (walls) return walls;
  const segments: WallSegment[] = [];
  const cabins = cabinsOf(level);
  for (let k = 0; k < cabins.length; k++) addBuilding(level, cabins[k], k, segments);
  const cells = new Map<number, number[]>();
  let reach = 0;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    reach = Math.max(reach, s.half);
    const c0 = Math.floor((Math.min(s.ax, s.bx) - s.half) / B.cell);
    const c1 = Math.floor((Math.max(s.ax, s.bx) + s.half) / B.cell);
    const r0 = Math.floor((Math.min(s.az, s.bz) - s.half) / B.cell);
    const r1 = Math.floor((Math.max(s.az, s.bz) + s.half) / B.cell);
    for (let a = c0; a <= c1; a++) {
      for (let b = r0; b <= r1; b++) {
        const key = cellKey(a, b);
        const at = cells.get(key);
        if (at) at.push(i);
        else cells.set(key, [i]);
      }
    }
  }
  walls = { segments, cells, reach };
  cache.set(level, walls);
  return walls;
}

function addBuilding(level: Level, c: Cabin, k: number, out: WallSegment[]): void {
  const d = CABINS[c.kind];
  const stuff: Stuff = "log";
  const half = B.wall / 2;
  const top = c.y + d.ridge + B.over;
  const door = doorPlanOf(c);
  const push = (
    ax: number,
    az: number,
    bx: number,
    bz: number,
    h: number,
    y: number,
    t: number,
    shut: string | null,
  ): void => {
    const a = toWorld(c, ax, az);
    const b = toWorld(c, bx, bz);
    out.push({
      ax: a.x,
      az: a.z,
      bx: b.x,
      bz: b.z,
      half: h,
      y,
      top: t,
      cabin: k,
      door: shut,
      stuff,
    });
  };
  // THE WALLS: each edge of the outline down its middle line, the door's
  // edge broken at the doorway and the door laid across it.
  const { pts, doorEdge } = outlineOf(c, half);
  // The door's middle in the frame, on its wall's middle line.
  let dx = 0;
  let dz = 0;
  if (door) {
    const S = SIDES[door.side];
    const off = (door.side === "front" || door.side === "back" ? d.depth / 2 : d.width / 2) - half;
    dx = S.nx * off + (S.nz !== 0 ? door.at : 0);
    dz = S.nz * off + (S.nx !== 0 ? door.at : 0);
  }
  for (let e = 0; e < pts.length; e++) {
    const [ax, az] = pts[e];
    const [bx, bz] = pts[(e + 1) % pts.length];
    if (!door || e !== doorEdge) {
      push(ax, az, bx, bz, half, c.base, top, null);
      continue;
    }
    const len = hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    const at = (dx - ax) * ux + (dz - az) * uz;
    const pt = (u: number): [number, number] => [ax + ux * u, az + uz * u];
    const u0 = at - door.width / 2;
    const u1 = at + door.width / 2;
    // The jambs stand the wall's half-thickness into the doorway's edge, so
    // its clear width is the door's.
    if (u0 - half > 0) push(ax, az, ...pt(u0 - half), half, c.base, top, null);
    if (u1 + half < len) push(...pt(u1 + half), bx, bz, half, c.base, top, null);
    // The leaves across the middle, the fixed side lights either side of
    // them as solid as the wall.
    const span = Math.min(door.width, door.leaves * door.leaf) / 2;
    if (span < door.width / 2 - 0.01) {
      push(...pt(u0), ...pt(at - span), half, c.base, top, null);
      push(...pt(at + span), ...pt(u1), half, c.base, top, null);
    }
    push(...pt(at - span), ...pt(at + span), half, c.base, top, c.id);
  }
  // THE CHURCH'S PLINTH before its nave, either side of the tower: a step
  // of stone the full footprint wide, to `plinth` over the floor.
  if (c.kind === "church") {
    const r = B.rail / 2;
    const th = CHURCH_TOWER.side / 2;
    const hw = d.width / 2 - r;
    const hd = d.depth / 2 - r;
    const tf = d.depth / 2 - CHURCH_TOWER.side;
    const t = c.y + CHURCH_TOWER.plinth;
    for (const k of [-1, 1]) {
      push(k * th, hd, k * hw, hd, r, c.base, t, null);
      push(k * hw, hd, k * hw, tf, r, c.base, t, null);
    }
  }
  // THE TERRACE'S RAIL: round its two ends and along its front, broken at
  // the steps; its foot the lowest snow under the deck's corners.
  const T = TERRACES[c.kind];
  if (T) {
    const r = B.rail / 2;
    const z0 = d.depth / 2 + T.from;
    const z1 = d.depth / 2 + T.out - r;
    const x = d.width / 2 + T.end - r;
    let foot = c.base;
    for (const [lx, lz] of [
      [-x, z0],
      [x, z0],
      [-x, z1],
      [x, z1],
      [0, z1],
    ]) {
      const p = toWorld(c, lx, lz);
      foot = Math.min(foot, level.groundAt(p.x, p.z));
    }
    const t = c.y + T.deck + T.rail;
    push(-x, z0, -x, z1, r, foot, t, null);
    push(x, z0, x, z1, r, foot, t, null);
    push(-x, z1, -T.gap, z1, r, foot, t, null);
    push(T.gap, z1, x, z1, r, foot, t, null);
  }
  // WHAT STANDS AGAINST IT: each box as its four faces, each post as a
  // segment of no length.
  for (const a of attachedOf(c)) {
    const t = c.y + a.top;
    if ("post" in a) {
      const [px, pz, pr] = a.post;
      push(px, pz, px, pz, pr, c.base, t, null);
      continue;
    }
    const [x0, z0, x1, z1] = a.box;
    const r = Math.min(B.rail / 2, (x1 - x0) / 2, (z1 - z0) / 2);
    const [a0, b0, a1, b1] = [x0 + r, z0 + r, x1 - r, z1 - r];
    push(a0, b0, a1, b0, r, c.base, t, null);
    push(a1, b0, a1, b1, r, c.base, t, null);
    push(a1, b1, a0, b1, r, c.base, t, null);
    push(a0, b1, a0, b0, r, c.base, t, null);
  }
}

/** EVERY BUILDING'S DOOR of `level`, worked out once: where a walker
 * stands to open one, and where he is once through. */
export function buildingDoors(level: Level): readonly BuildingDoor[] {
  let list = doors.get(level);
  if (list) return list;
  list = [];
  const cabins = cabinsOf(level);
  for (let k = 0; k < cabins.length; k++) {
    const c = cabins[k];
    const door = doorPlanOf(c);
    if (!door) continue;
    const d = CABINS[c.kind];
    const S = SIDES[door.side];
    const off = door.side === "front" || door.side === "back" ? d.depth / 2 : d.width / 2;
    // The door's `at` is in the frame's own axis: x on the front and back,
    // z on the flanks.
    const lx = S.nx * off + (S.nz !== 0 ? door.at : 0);
    const lz = S.nz * off + (S.nx !== 0 ? door.at : 0);
    const mid = toWorld(c, lx, lz);
    const out = toWorld(c, lx + S.nx, lz + S.nz);
    const inn = toWorld(c, lx - S.nx * (1 + B.wall), lz - S.nz * (1 + B.wall));
    list.push({
      id: c.id,
      cabin: k,
      kind: c.kind,
      x: mid.x,
      z: mid.z,
      y: c.y,
      heading: Math.atan2(out.x - mid.x, out.z - mid.z),
      width: door.width,
      height: door.height,
      outside: out,
      inside: inn,
      swing: door.swing,
      leaves: door.leaves,
      leaf: door.leaf,
      hinge: door.hinge,
      stuff: door.stuff,
    });
  }
  doors.set(level, list);
  return list;
}

const doors = new WeakMap<Level, BuildingDoor[]>();

/** The door of the building with id `id` on `level`, or null. */
export function buildingDoorOf(level: Level, id: string): BuildingDoor | null {
  return buildingDoors(level).find((d) => d.id === id) ?? null;
}

/** The nearest door to (x, z) on `level` within `r` m of its middle, or
 * null. */
export function nearestDoor(level: Level, x: number, z: number, r: number): BuildingDoor | null {
  let best: BuildingDoor | null = null;
  let most = r;
  for (const d of buildingDoors(level)) {
    const at = hypot(d.x - x, d.z - z);
    if (at <= most) {
      most = at;
      best = d;
    }
  }
  return best;
}

/** The building whose walls (x, z) stands inside, as an index into
 * `cabinsOf(level)`, or −1 — inside its rooms, past its walls' slab. */
export function buildingAt(level: Level, x: number, z: number): number {
  const cabins = cabinsOf(level);
  for (let k = 0; k < cabins.length; k++) {
    const c = cabins[k];
    const d = CABINS[c.kind];
    const dx = x - c.x;
    const dz = z - c.z;
    if (Math.abs(dx) > d.width + d.depth || Math.abs(dz) > d.width + d.depth) continue;
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const lx = dx * fz - dz * fx;
    const lz = dx * fx + dz * fz;
    if (Math.abs(lx) < d.width / 2 && Math.abs(lz) < d.depth / 2) return k;
  }
  return -1;
}

/** Whether the door of the building `id` stands open on this run. */
export function doorOpen(state: GameState, id: string): boolean {
  return state.doors?.includes(id) ?? false;
}

/** OPEN (`open` true) or SHUT the door of the building `id` on this run: an
 * open door is no solid to anything, a shut one as solid as its walls.
 * The list is kept sorted, so two runs that open the same doors are the
 * same state. */
export function setDoor(state: GameState, id: string, open: boolean): void {
  const list = state.doors ?? [];
  const at = list.indexOf(id);
  // A new list every time, never the old one changed: a run forked off
  // this one (a replay's, a forecast's) keeps its own doors.
  if (open && at < 0) state.doors = [...list, id].sort();
  else if (!open && at >= 0) {
    const rest = list.filter((d) => d !== id);
    if (rest.length === 0) delete state.doors;
    else state.doors = rest;
  }
}

/** Whether a solid stands in the way on this run: anything but a door
 * left open. */
export function standing(state: GameState, t: Upright): boolean {
  return t.door === undefined || !doorOpen(state, t.door);
}

/** The worst wall a body point met in `holdOutOfWalls`: the way out of it
 * (a unit normal in plan, from the wall toward the body), how far the body
 * was pushed, m, and what the wall is made of. */
export type WallTouch = { nx: number; nz: number; depth: number; stuff: Stuff; met: boolean };

const near: number[] = [];

/**
 * HOLD A BODY OUT OF THE WALLS: a circle of radius `r` whose middle went
 * from (x0, z0) to `p` this step, at height `y`, is pushed out of every
 * wall slab it is in — and, if its way crossed a wall's middle line this
 * step (a body faster than a wall is thick), stood back on the side it
 * came from. `p` is moved in place; `touch` gets the deepest wall met.
 * `below`: how far the body reaches under `y` (a skier's boots under his
 * centre of gravity), so a low rail or a step is met by his legs. A move
 * longer than `jump` m (a skier stood somewhere else, not skied there)
 * asks only where he is.
 */
export function holdOutOfWalls(
  state: GameState,
  x0: number,
  z0: number,
  p: { x: number; z: number },
  y: number,
  r: number,
  touch: WallTouch,
  below = 0,
  jump = 3,
): void {
  touch.met = false;
  touch.depth = 0;
  const level = state.level;
  const walls = wallsOf(level);
  if (walls.segments.length === 0) return;
  const swept = hypot(p.x - x0, p.z - z0) < jump;
  const pad = r + walls.reach + (swept ? hypot(p.x - x0, p.z - z0) : 0);
  near.length = 0;
  const c0 = Math.floor((Math.min(p.x, x0) - pad) / B.cell);
  const c1 = Math.floor((Math.max(p.x, x0) + pad) / B.cell);
  const r0 = Math.floor((Math.min(p.z, z0) - pad) / B.cell);
  const r1 = Math.floor((Math.max(p.z, z0) + pad) / B.cell);
  for (let a = c0; a <= c1; a++) {
    for (let b = r0; b <= r1; b++) {
      const at = walls.cells.get(cellKey(a, b));
      if (!at) continue;
      for (const i of at) if (!near.includes(i)) near.push(i);
    }
  }
  if (near.length === 0) return;
  // Twice round, so a body pushed out of one wall into the next at a corner
  // is pushed out of that too.
  for (let pass = 0; pass < 2; pass++) {
    for (const i of near) {
      const s = walls.segments[i];
      if (y < s.y - 1 || y - below > s.top) continue;
      if (s.door !== null && doorOpen(state, s.door)) continue;
      const reach = r + s.half;
      const ex = s.bx - s.ax;
      const ez = s.bz - s.az;
      const len = hypot(ex, ez);
      const ux = len > 1e-9 ? ex / len : 1;
      const uz = len > 1e-9 ? ez / len : 0;
      // The line's normal, and which side of it the body was on and is.
      const nx = -uz;
      const nz = ux;
      if (swept && len > 1e-9 && pass === 0) {
        const s0 = (x0 - s.ax) * nx + (z0 - s.az) * nz;
        const s1 = (p.x - s.ax) * nx + (p.z - s.az) * nz;
        if (s0 * s1 < 0) {
          // Where the way crossed the line, along it.
          const f = s0 / (s0 - s1);
          const cx = x0 + (p.x - x0) * f;
          const cz = z0 + (p.z - z0) * f;
          const along = (cx - s.ax) * ux + (cz - s.az) * uz;
          if (along > -r && along < len + r) {
            const side = s0 > 0 ? 1 : -1;
            const move = side * reach - s1;
            p.x += nx * move;
            p.z += nz * move;
            note(touch, nx * side, nz * side, Math.abs(move), s.stuff);
            continue;
          }
        }
      }
      // Where he is: the nearest point of the slab's middle line.
      let t = len > 1e-9 ? ((p.x - s.ax) * ux + (p.z - s.az) * uz) / len : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = s.ax + ex * t;
      const qz = s.az + ez * t;
      const dx = p.x - qx;
      const dz = p.z - qz;
      const dist = hypot(dx, dz);
      if (dist >= reach) continue;
      let ox: number;
      let oz: number;
      if (dist > 1e-6) {
        ox = dx / dist;
        oz = dz / dist;
      } else {
        // Dead on the line: back the way he came.
        const back = (x0 - s.ax) * nx + (z0 - s.az) * nz >= 0 ? 1 : -1;
        ox = nx * back;
        oz = nz * back;
      }
      p.x = qx + ox * reach;
      p.z = qz + oz * reach;
      note(touch, ox, oz, reach - dist, s.stuff);
    }
  }
}

function note(touch: WallTouch, nx: number, nz: number, depth: number, stuff: Stuff): void {
  if (touch.met && depth <= touch.depth) return;
  touch.met = true;
  touch.nx = nx;
  touch.nz = nz;
  touch.depth = depth;
  touch.stuff = stuff;
}

/** A fresh `WallTouch`. */
export function wallTouch(): WallTouch {
  return { nx: 0, nz: 0, depth: 0, stuff: "log", met: false };
}

const posts = new WeakMap<Level, Upright[]>();

/**
 * EVERY BUILDING'S WALLS as a row of posts, for everything that meets a
 * solid as a cylinder (`posts.ts`' `solidsOf`): down every wall slab, set
 * in by their radius so their outer face is the wall's, no further apart
 * than `post.gap` — the door's own posts carrying its building's id, so an
 * open door lets them by (`standing`). Flagged `wall`, so a skier and his
 * thrown body, who meet the slabs themselves, pass them over. Kept per map.
 */
export function cabinWalls(level: Level): readonly Upright[] {
  let list = posts.get(level);
  if (list) return list;
  list = [];
  const P = B.post;
  const cabins = cabinsOf(level);
  for (const s of wallSegmentsOf(level)) {
    const c = cabins[s.cabin];
    const ex = s.bx - s.ax;
    const ez = s.bz - s.az;
    const len = hypot(ex, ez);
    // A wall's posts stand with their outer face on the wall's outer face:
    // moved in from its middle line toward the building's middle.
    const radius = s.half >= B.wall / 2 ? P.radius : s.half;
    const inset = radius - s.half;
    let ix = 0;
    let iz = 0;
    if (len > 1e-9 && inset > 0) {
      let nx = -ez / len;
      let nz = ex / len;
      if ((c.x - s.ax) * nx + (c.z - s.az) * nz < 0) {
        nx = -nx;
        nz = -nz;
      }
      ix = nx * inset;
      iz = nz * inset;
    }
    const n = len > 1e-9 ? Math.max(1, Math.ceil(len / P.gap)) : 0;
    for (let i = 0; i <= n; i++) {
      const f = n === 0 ? 0 : i / n;
      list.push({
        x: s.ax + ex * f + ix,
        z: s.az + ez * f + iz,
        y: s.y,
        height: s.top - s.y,
        radius,
        stuff: s.stuff,
        wall: true,
        ...(s.door !== null ? { door: s.door } : {}),
      });
    }
  }
  posts.set(level, list);
  return list;
}
