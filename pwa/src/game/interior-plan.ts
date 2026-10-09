// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROOMS INSIDE THE BUILDINGS, PLANNED — what stands on the ground floor
// of every building a skier can walk into (`docs/buildings.md`, "Inside"):
// the room each kind is lined as (its floor, walls and ceiling, the height
// it is lit to), the windows and doors cut through its walls (read off the
// building as it is drawn, so a pane inside is the pane outside), and the
// FURNITURE stood in it (`interior-layouts.ts`, a layout a kind), every
// piece dealt off the building's id and kept off the doors' way in.
//
// The frame is the building's own (`defs/cabins.ts`): x across its front,
// +z out of its front, y up from its floor. A piece is stood at (x, z),
// turned `yaw` (its own +z, its front, turned as the engine turns a
// heading: 0 = +z, clockwise from above), `w` across, `d` deep and `h`
// tall. Three-free and DOM-free: `interior-build.ts` makes it boxes.

import type { CabinKind } from "@engine";

import { FACADE, type FacadeLayer } from "./facade-paint.ts";

/** A wall by its name, as the log buildings name theirs (`wallsOf`): u runs
 * left to right seen from OUTSIDE it, 0 its middle. */
export type Face = "front" | "back" | "left" | "right";

/** An opening through a wall, in that wall's u and the floor's y. */
export type Hole = {
  face: Face;
  u: number;
  w: number;
  y0: number;
  y1: number;
  door: boolean;
};

/** A material and its tint. */
export type Skin = { layer: FacadeLayer; tint: number };

/** How a kind is lined inside: the ground floor's ceiling over its floor,
 * how thick its walls are (the lining stood that far in from the outer
 * face), and its floor, walls and ceiling. A kind with no row is never
 * furnished (the woodshed is open to the snow; the afterski lodge is a
 * room of its own, `afterski-interior.ts`). */
export type RoomDef = {
  /** The room's floor over the building's (the plinth's top it stands
   * on), m; and how much of the front is another room's (a church's
   * tower), m, its wall stood there with an arch through it. */
  raise?: number;
  front?: number;
  ceiling: number;
  wall: number;
  floor: Skin;
  walls: Skin;
  top: Skin;
  /** A dado: the lower walls in another skin to this height, or 0. */
  dado?: { h: number; skin: Skin };
};

const pine: Skin = { layer: FACADE.panelling, tint: 0xffffff };
const oldPine: Skin = { layer: FACADE.panelling, tint: 0xc89a70 };
const boards: Skin = { layer: FACADE.boards, tint: 0xc8a888 };
const oak: Skin = { layer: FACADE.timber, tint: 0xa0764e };
const render: Skin = { layer: FACADE.render, tint: 0xfaf6ee };
const white: Skin = { layer: FACADE.plain, tint: 0xeeeeea };
const concrete: Skin = { layer: FACADE.concrete, tint: 0xd8d8d4 };
const floorTile: Skin = { layer: FACADE.tile, tint: 0xd8cfc2 };
const terracotta: Skin = { layer: FACADE.tile, tint: 0xc07a58 };
const slate: Skin = { layer: FACADE.stone, tint: 0x9a9ea2 };
const logs: Skin = { layer: FACADE.logWall, tint: 0xffffff };
const lino: Skin = { layer: FACADE.plain, tint: 0x8a9aa4 };

export const ROOMS: Partial<Record<CabinKind, RoomDef>> = {
  restaurant: {
    ceiling: 3.4,
    wall: 0.32,
    floor: terracotta,
    walls: render,
    top: pine,
    dado: { h: 1.1, skin: pine },
  },
  ticket: { ceiling: 3.0, wall: 0.25, floor: lino, walls: white, top: white },
  rental: { ceiling: 3.0, wall: 0.3, floor: oak, walls: white, top: pine },
  school: { ceiling: 2.9, wall: 0.25, floor: boards, walls: pine, top: pine },
  firstAid: { raise: 0.3, ceiling: 3.1, wall: 0.3, floor: lino, walls: white, top: white },
  hotel: {
    ceiling: 3.4,
    wall: 0.35,
    floor: oak,
    walls: render,
    top: pine,
    dado: { h: 1.2, skin: oldPine },
  },
  garage: { raise: 0.8, ceiling: 6.0, wall: 0.25, floor: concrete, walls: concrete, top: concrete },
  pumpHouse: {
    raise: 0.4,
    ceiling: 3.8,
    wall: 0.3,
    floor: concrete,
    walls: concrete,
    top: concrete,
  },
  house: {
    raise: 0.2,
    ceiling: 2.5,
    wall: 0.35,
    floor: boards,
    walls: render,
    top: pine,
    dado: { h: 1.0, skin: pine },
  },
  apartments: { raise: 0.3, ceiling: 2.8, wall: 0.35, floor: floorTile, walls: render, top: white },
  shop: { raise: 0.15, ceiling: 3.3, wall: 0.3, floor: oak, walls: white, top: white },
  church: { raise: 0.4, front: 5, ceiling: 7.4, wall: 0.6, floor: slate, walls: render, top: pine },
  mountainHut: { ceiling: 3.4, wall: 0.45, floor: boards, walls: oldPine, top: oldPine },
  patrol: { ceiling: 2.6, wall: 0.15, floor: boards, walls: pine, top: pine },
  hut: { ceiling: 2.2, wall: 0.2, floor: boards, walls: logs, top: oldPine },
  cabin: { ceiling: 2.4, wall: 0.2, floor: boards, walls: logs, top: oldPine },
  chalet: {
    ceiling: 2.4,
    wall: 0.35,
    floor: boards,
    walls: render,
    top: oldPine,
    dado: { h: 1.0, skin: oldPine },
  },
};

/** What a piece of furniture is: each a handful of boxes in
 * `interior-build.ts`, sized by the piece's `w`, `d`, `h`. */
export type Item =
  | "table"
  | "roundTable"
  | "chair"
  | "stool"
  | "bench"
  | "wallBench"
  | "stove"
  | "ironStove"
  | "fireplace"
  | "counter"
  | "bar"
  | "servery"
  | "shelf"
  | "goodsShelf"
  | "clothesRack"
  | "skiRack"
  | "bootWall"
  | "sofa"
  | "armchair"
  | "bed"
  | "bunk"
  | "cabinet"
  | "lockers"
  | "rug"
  | "plant"
  | "pendant"
  | "kitchen"
  | "fridge"
  | "screen"
  | "desk"
  | "couch"
  | "akja"
  | "workbench"
  | "toolboard"
  | "drum"
  | "tyres"
  | "pump"
  | "tank"
  | "switchboard"
  | "pew"
  | "altar"
  | "lectern"
  | "candles"
  | "cross"
  | "picture"
  | "hooks"
  | "bootDryer"
  | "mailboxes"
  | "stairs"
  | "trays"
  | "board";

/** One piece, in the building's frame. `tint` its main colour, `alt` its
 * second (a cushion, a stove's tiles, a jacket's), `seed` its own deal. */
export type Piece = {
  item: Item;
  x: number;
  z: number;
  /** How high its foot stands over the floor (a picture on a wall). */
  y: number;
  yaw: number;
  w: number;
  d: number;
  h: number;
  tint: number;
  alt: number;
  seed: number;
};

/** A room as built: where it stands in its building (its floor `oy` up
 * and its middle `oz` along, the walls' outer box `width` × `depth` round
 * it), its inner box, its openings, its pieces — all in the room's own
 * frame. */
export type RoomPlan = {
  def: RoomDef;
  oy: number;
  oz: number;
  width: number;
  depth: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  holes: readonly Hole[];
  pieces: Piece[];
};

/** A small integer hash of an id and a salt, 0..1 — the room's own deal. */
export function roomHash(id: string, salt: number): number {
  let h = 2166136261 ^ Math.imul(salt + 1, 0x9e3779b1);
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** The yaw that turns a piece's front into the room off a wall. */
export const INTO: Readonly<Record<Face, number>> = {
  back: 0,
  front: Math.PI,
  left: Math.PI / 2,
  right: -Math.PI / 2,
};

/** A point on a wall's OUTER face at `u` along it, the wall's outward
 * normal, and its run (`wallsOf`'s). */
export function faceFrame(
  face: Face,
  width: number,
  depth: number,
): { x: number; z: number; ux: number; uz: number; nx: number; nz: number } {
  switch (face) {
    case "front":
      return { x: 0, z: depth / 2, ux: 1, uz: 0, nx: 0, nz: 1 };
    case "back":
      return { x: 0, z: -depth / 2, ux: -1, uz: 0, nx: 0, nz: -1 };
    case "right":
      return { x: width / 2, z: 0, ux: 0, uz: -1, nx: 1, nz: 0 };
    default:
      return { x: -width / 2, z: 0, ux: 0, uz: 1, nx: -1, nz: 0 };
  }
}

/** A rectangle in plan. */
type Box = { x0: number; z0: number; x1: number; z1: number };

/** THE PLANNER a layout stands its pieces with: the room's box, its holes,
 * and what is already stood — a piece that would stand in another, in a
 * door's way or outside the walls is left out, so a layout can propose
 * freely and the room comes out tidy whatever the building. */
export class Planner {
  readonly pieces: Piece[] = [];
  private readonly taken: Box[] = [];
  private salt = 0;

  constructor(
    readonly id: string,
    readonly width: number,
    readonly depth: number,
    readonly def: RoomDef,
    readonly holes: readonly Hole[],
  ) {
    for (const h of holes) {
      if (!h.door) continue;
      // The way in: the door's width and a little either side, 1.8 m in.
      const f = faceFrame(h.face, width, depth);
      const cx = f.x + f.ux * h.u;
      const cz = f.z + f.uz * h.u;
      const half = h.w / 2 + 0.45;
      const reach = def.wall + 1.8;
      const ax = cx + f.ux * half;
      const az = cz + f.uz * half;
      const bx = cx - f.ux * half - f.nx * reach;
      const bz = cz - f.uz * half - f.nz * reach;
      this.taken.push({
        x0: Math.min(ax, bx),
        z0: Math.min(az, bz),
        x1: Math.max(ax, bx),
        z1: Math.max(az, bz),
      });
    }
  }

  /** The inner box: the walls' inner faces. */
  get x0(): number {
    return -this.width / 2 + this.def.wall;
  }
  get x1(): number {
    return this.width / 2 - this.def.wall;
  }
  get z0(): number {
    return -this.depth / 2 + this.def.wall;
  }
  get z1(): number {
    return this.depth / 2 - this.def.wall;
  }

  /** The next of this room's own numbers, 0..1. */
  deal(): number {
    return roomHash(this.id, this.salt++);
  }

  /** One of `list`, dealt. */
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.deal() * list.length) % list.length];
  }

  /** Stand a piece if it fits; whether it did. `solid` false lets it stand
   * over others (a rug under a table, a lamp over it, a picture on a wall
   * behind a bench) — it still keeps inside the walls. */
  put(p: Omit<Piece, "seed" | "y" | "tint" | "alt"> & Partial<Piece>, solid = true): boolean {
    const c = Math.abs(Math.cos(p.yaw));
    const s = Math.abs(Math.sin(p.yaw));
    const hx = (p.w * c + p.d * s) / 2;
    const hz = (p.w * s + p.d * c) / 2;
    const b: Box = { x0: p.x - hx, z0: p.z - hz, x1: p.x + hx, z1: p.z + hz };
    const e = 0.01;
    if (b.x0 < this.x0 - e || b.x1 > this.x1 + e || b.z0 < this.z0 - e || b.z1 > this.z1 + e)
      return false;
    if (solid) {
      for (const t of this.taken)
        if (b.x0 < t.x1 - e && b.x1 > t.x0 + e && b.z0 < t.z1 - e && b.z1 > t.z0 + e) return false;
      this.taken.push(b);
    }
    this.pieces.push({ y: 0, tint: 0xffffff, alt: 0xffffff, seed: this.deal(), ...p });
    return true;
  }

  /** Where a piece `d` deep stands with its back to `face`'s inner side
   * at `u`: its centre and the yaw that faces it in. */
  onWall(face: Face, u: number, d: number): { x: number; z: number; yaw: number } {
    const f = faceFrame(face, this.width, this.depth);
    const k = this.def.wall + d / 2;
    return { x: f.x + f.ux * u - f.nx * k, z: f.z + f.uz * u - f.nz * k, yaw: INTO[face] };
  }

  /** A wall's inner run, u from to u to. */
  span(face: Face): [number, number] {
    const half = (face === "front" || face === "back" ? this.width : this.depth) / 2;
    return [-half + this.def.wall, half - this.def.wall];
  }

  /** Whether a run of `face` from `a` to `b` is clear of its openings up
   * to `h` over the floor (a door at any height). */
  clearOf(face: Face, a: number, b: number, h: number): boolean {
    for (const o of this.holes) {
      if (o.face !== face) continue;
      if (!o.door && o.y0 >= h) continue;
      if (a < o.u + o.w / 2 + 0.1 && b > o.u - o.w / 2 - 0.1) return false;
    }
    return true;
  }

  /** Stand `item`s along `face` from `a` to `b`, `w` wide each and `gap`
   * apart, wherever the wall is clear of openings to `h`; how many stood. */
  alongWall(
    face: Face,
    item: Item,
    w: number,
    d: number,
    h: number,
    gap = 0,
    look: Partial<Piece> = {},
    range: [number, number] = this.span(face),
  ): number {
    let n = 0;
    for (let u = range[0] + 0.05; u + w <= range[1] - 0.05 + 1e-6;) {
      if (!this.clearOf(face, u, u + w, h)) {
        u += 0.2;
        continue;
      }
      const at = this.onWall(face, u + w / 2, d);
      if (this.put({ item, w, d, h, ...at, ...look })) {
        n++;
        u += w + gap;
      } else u += 0.2;
    }
    return n;
  }

  /** A wall-hung piece (a picture, hooks, a board): on `face` at `u`, its
   * foot `y` up, clear of the openings. */
  hang(
    face: Face,
    item: Item,
    u: number,
    y: number,
    w: number,
    h: number,
    look: Partial<Piece> = {},
  ): void {
    if (!this.clearOf(face, u - w / 2, u + w / 2, y + h + 0.1)) return;
    for (const o of this.holes)
      if (o.face === face && Math.abs(o.u - u) < (o.w + w) / 2 + 0.05 && o.y0 < y + h) return;
    const at = this.onWall(face, u, 0.06);
    this.put({ item, w, d: 0.06, h, y, ...at, ...look }, false);
  }
}
