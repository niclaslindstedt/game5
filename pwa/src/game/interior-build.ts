// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A ROOM, BUILT — one building's ground floor as seen from inside it: the
// floor, the walls LINED a wall's thickness in from the outer face and cut
// round every window and door the building has outside (read off its own
// drawing, `holesOf`), each opening's reveal through the wall, the pane
// seen from within (lit by the day, dark at night) and the door's inner
// face, the ceiling, and the furniture its kind is furnished with
// (`interior-plan.ts`, `interior-layouts.ts`, `interior-pieces.ts`).
//
// THE GLOW MARK means two things in a room (`interiors-view.ts`): 1 a lamp
// (always on, brighter after dark), 2 a pane (the daylight through it).
//
// Three-free.

import { CABINS, type Cabin, type CabinKind, type Level } from "@engine";

import { FACADE } from "./facade-paint.ts";
import { FacadeKit, type Opening } from "./facade-kit.ts";
import { furnish } from "./interior-layouts.ts";
import { buildPiece } from "./interior-pieces.ts";
import {
  Planner,
  ROOMS,
  faceFrame,
  type Face,
  type Hole,
  type RoomPlan,
  type Skin,
} from "./interior-plan.ts";
import { buildResortBuilding } from "./village-build.ts";

/** The glow marks a room's faces carry. */
export const ROOM_GLOW = { lamp: 1, pane: 2 } as const;

/** Whether a kind has a room to furnish. */
export function hasRoom(kind: CabinKind): boolean {
  return ROOMS[kind] !== undefined;
}

/** What an inset stood on a wall is, as an opening: a pane, a door, or
 * nothing (a sign, a band). */
function openingOf(o: Opening, y0: number): "pane" | "door" | null {
  switch (o.layer) {
    case FACADE.window:
    case FACADE.glazing:
    case FACADE.casement:
      return "pane";
    case FACADE.door:
    case FACADE.plankDoor:
    case FACADE.shutter:
      return y0 < 0.6 ? "door" : "pane";
    case FACADE.plain:
      // A plain inset reaching the floor and a door's height is a door.
      return y0 < 0.5 && o.y1 - o.y0 > 1.8 ? "door" : null;
    default:
      return null;
  }
}

/** The openings of a building drawn on the facade kit, read back off its
 * own drawing in its frame: each inset's wall, u, width and heights. */
export function insetHoles(level: Level, c: Cabin): Hole[] {
  const kit = new FacadeKit();
  kit.openings = [];
  buildResortBuilding(kit, level, c);
  const d = CABINS[c.kind];
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const local = (p: readonly number[]): [number, number] => {
    const dx = p[0] - c.x;
    const dz = p[2] - c.z;
    // The inverse of the kit's turn: x along (cos, −sin), z along (sin, cos).
    return [dx * fz - dz * fx, dx * fx + dz * fz];
  };
  const out: Hole[] = [];
  for (const o of kit.openings) {
    const what = openingOf(o, o.y0 - c.y);
    if (!what) continue;
    const [ax, az] = local(o.a);
    const [bx, bz] = local(o.b);
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    const w = Math.hypot(bx - ax, bz - az);
    if (w < 0.2) continue;
    const y0 = o.y0 - c.y;
    const y1 = o.y1 - c.y;
    // Which wall it stands on: the face its middle is on, within a reach.
    const near = 0.4;
    let face: Face | null = null;
    if (Math.abs(mz - d.depth / 2) < near && Math.abs(az - bz) < 0.05) face = "front";
    else if (Math.abs(mz + d.depth / 2) < near && Math.abs(az - bz) < 0.05) face = "back";
    else if (Math.abs(mx - d.width / 2) < near && Math.abs(ax - bx) < 0.05) face = "right";
    else if (Math.abs(mx + d.width / 2) < near && Math.abs(ax - bx) < 0.05) face = "left";
    if (!face) continue;
    const f = faceFrame(face, d.width, d.depth);
    const u = (mx - f.x) * f.ux + (mz - f.z) * f.uz;
    out.push({ face, u, w, y0, y1, door: what === "door" });
  }
  return mergeHoles(out);
}

/** Openings that overlap on a wall made one (a door inside its glazed
 * surround, a shop window laid in two). */
export function mergeHoles(list: readonly Hole[]): Hole[] {
  const out: Hole[] = [];
  for (const h of list) {
    const hit = out.find(
      (o) =>
        o.face === h.face &&
        Math.abs(o.u - h.u) < (o.w + h.w) / 2 - 0.02 &&
        o.y0 < h.y1 - 0.02 &&
        h.y0 < o.y1 - 0.02,
    );
    if (!hit) {
      out.push({ ...h });
      continue;
    }
    const a = Math.min(hit.u - hit.w / 2, h.u - h.w / 2);
    const b = Math.max(hit.u + hit.w / 2, h.u + h.w / 2);
    hit.u = (a + b) / 2;
    hit.w = b - a;
    hit.y0 = Math.min(hit.y0, h.y0);
    hit.y1 = Math.max(hit.y1, h.y1);
    hit.door = hit.door || h.door;
  }
  return out;
}

/** The plan of a building's room: its box, its holes, its furniture. */
export function planRoom(c: Cabin, holes: readonly Hole[]): RoomPlan | null {
  const def = ROOMS[c.kind];
  if (!def) return null;
  const d = CABINS[c.kind];
  const oy = def.raise ?? 0;
  const cut = def.front ?? 0;
  const depth = d.depth - cut;
  const oz = -cut / 2;
  // Only the openings the ground floor shows, in the room's frame: up off
  // its raised floor and along off its middle; a front given to another
  // room is a wall with an arch through it.
  const own: Hole[] = [];
  for (const h of holes) {
    if (cut > 0 && h.face === "front") continue;
    const u = h.face === "left" ? h.u - oz : h.face === "right" ? h.u + oz : h.u;
    const y0 = h.y0 - oy;
    const y1 = h.y1 - oy;
    if (y0 < def.ceiling - 0.2 && y1 > 0.2) own.push({ ...h, u, y0, y1 });
  }
  if (cut > 0) own.push({ face: "front", u: 0, w: 1.6, y0: 0, y1: 2.9, door: true });
  const p = new Planner(c.id, d.width, depth, def, own);
  furnish(c.kind, p);
  return {
    def,
    oy,
    oz,
    width: d.width,
    depth,
    x0: p.x0,
    x1: p.x1,
    z0: p.z0,
    z1: p.z1,
    holes: own,
    pieces: p.pieces,
  };
}

/** One face of the lining, as the run along its inner side: where it
 * starts (t = 0 at its left seen from inside), which way it runs, and how
 * long it is. */
function liningOf(
  face: Face,
  plan: RoomPlan,
  width: number,
  depth: number,
): { sx: number; sz: number; rx: number; rz: number; len: number; t: (u: number) => number } {
  const f = faceFrame(face, width, depth);
  const wall = plan.def.wall;
  // Seen from inside, the run goes against the wall's own u.
  const rx = -f.ux;
  const rz = -f.uz;
  const len = face === "front" || face === "back" ? width - 2 * wall : depth - 2 * wall;
  const cx = f.x - f.nx * wall;
  const cz = f.z - f.nz * wall;
  return {
    sx: cx - rx * (len / 2),
    sz: cz - rz * (len / 2),
    rx,
    rz,
    len,
    t: (u) => len / 2 - u,
  };
}

/** Build one building's room onto `kit` in the world, if its kind has one. */
export function buildRoom(kit: FacadeKit, c: Cabin, holes: readonly Hole[]): RoomPlan | null {
  const plan = planRoom(c, holes);
  if (!plan) return null;
  const { def } = plan;
  const H = def.ceiling;
  // The room's own frame: the building's, raised to its floor and moved
  // along to its middle.
  kit.at(c.x, c.y, c.z, c.heading);
  const o = kit.world([0, plan.oy, plan.oz]);
  const home = () => kit.at(o[0], o[1], o[2], c.heading);
  home();
  const was = kit.glow;
  kit.glow = 0;
  const box: [number, number][] = [
    [plan.x0, plan.z0],
    [plan.x1, plan.z0],
    [plan.x1, plan.z1],
    [plan.x0, plan.z1],
  ];
  kit.cap(box, 0.012, def.floor.layer, def.floor.tint);
  kit.cap(box, H, def.top.layer, def.top.tint, true);
  for (const face of ["front", "back", "left", "right"] as const) {
    const L = liningOf(face, plan, plan.width, plan.depth);
    const at = (t: number): [number, number] => [L.sx + L.rx * t, L.sz + L.rz * t];
    const band = (t0: number, t1: number, y0: number, y1: number) => {
      if (t1 - t0 < 0.005 || y1 - y0 < 0.005) return;
      const [x0, z0] = at(t0);
      const [x1, z1] = at(t1);
      const split = def.dado ? def.dado.h : 0;
      const piece = (a: number, b: number, s: Skin): void => {
        if (b - a > 0.005) kit.wall(x0, z0, x1, z1, a, b, s.layer, s.tint, t0);
      };
      if (split > y0 && split < y1 && def.dado) {
        piece(y0, split, def.dado.skin);
        piece(split, y1, def.walls);
      } else piece(y0, y1, def.dado && y1 <= split ? def.dado.skin : def.walls);
    };
    const own = plan.holes
      .filter((h) => h.face === face)
      .map((h) => ({ h, t0: L.t(h.u) - h.w / 2, t1: L.t(h.u) + h.w / 2 }))
      .filter((o) => o.t1 > 0 && o.t0 < L.len)
      .sort((a, b) => a.t0 - b.t0);
    let t = 0;
    for (const o of own) {
      const t0 = Math.max(t, o.t0);
      const t1 = Math.min(L.len, o.t1);
      const y0 = Math.max(0, o.h.y0);
      const y1 = Math.min(H, o.h.y1);
      band(t, t0, 0, H);
      band(t0, t1, 0, y0);
      band(t0, t1, y1, H);
      opening(kit, at(t0), at(t1), y0, y1, L.rx, L.rz, def.wall, o.h.door);
      t = Math.max(t, t1);
    }
    band(t, L.len, 0, H);
    // A skirting board along the foot.
    const [x0, z0] = at(0);
    const [x1, z1] = at(L.len);
    const n = { x: -L.rz, z: L.rx };
    kit.wall(
      x0 + n.x * 0.015,
      z0 + n.z * 0.015,
      x1 + n.x * 0.015,
      z1 + n.z * 0.015,
      0,
      0.1,
      FACADE.timber,
      0x8a6a4a,
    );
  }
  for (const p of plan.pieces) {
    home();
    const w = kit.world([p.x, p.y, p.z]);
    kit.at(w[0], w[1], w[2], c.heading + p.yaw);
    buildPiece(kit, p);
  }
  kit.glow = was;
  home();
  return plan;
}

/** An opening's inside: the reveal round it through the wall, and the pane
 * or the door's inner face near the outer face. */
function opening(
  kit: FacadeKit,
  a: [number, number],
  b: [number, number],
  y0: number,
  y1: number,
  rx: number,
  rz: number,
  wall: number,
  door: boolean,
): void {
  if (y1 - y0 < 0.05) return;
  // Outward from the lining: to the right of the run seen from inside.
  const ox = rz;
  const oz = -rx;
  const deep = Math.max(0.05, wall - 0.07);
  const A: [number, number] = [a[0] + ox * deep, a[1] + oz * deep];
  const B: [number, number] = [b[0] + ox * deep, b[1] + oz * deep];
  const reveal = { layer: FACADE.plain, tint: 0xe8e4dc };
  // The jambs, the sill and the head, each facing into the opening.
  kit.wall(a[0], a[1], A[0], A[1], y0, y1, reveal.layer, reveal.tint);
  kit.wall(B[0], B[1], b[0], b[1], y0, y1, reveal.layer, reveal.tint);
  kit.quad(
    [a[0], y0, a[1]],
    [b[0], y0, b[1]],
    [B[0], y0, B[1]],
    [A[0], y0, A[1]],
    FACADE.timber,
    0xc8a888,
  );
  kit.quad(
    [A[0], y1, A[1]],
    [B[0], y1, B[1]],
    [b[0], y1, b[1]],
    [a[0], y1, a[1]],
    reveal.layer,
    reveal.tint,
  );
  // The pane or the door, facing in.
  const was = kit.glow;
  kit.glow = door ? 0 : ROOM_GLOW.pane;
  kit.wall(
    A[0],
    A[1],
    B[0],
    B[1],
    y0,
    y1,
    door ? FACADE.plankDoor : FACADE.window,
    door ? 0xc8a07a : 0xffffff,
  );
  kit.glow = was;
}
