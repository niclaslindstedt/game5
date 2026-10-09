// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROOMS INSIDE THE BUILDINGS (`interior-plan.ts`, `interior-layouts.ts`,
// `interior-build.ts`): every kind with a room gets one off its openings,
// furnished inside its walls, clear of its doors' way in, the same every
// time it is built; the ground is kept out of the nearest rooms.

import { describe, expect, it } from "vitest";

import { CABINS, cabinsOf, type Cabin, type CabinKind } from "@engine";

import { hasRoom, planRoom } from "../pwa/src/game/interior-build.ts";
import { faceFrame, ROOMS, type Piece, type RoomPlan } from "../pwa/src/game/interior-plan.ts";
import { holesOf, roomsGeometry } from "../pwa/src/game/interiors-view.ts";
import { ROOM_CUTS, roomCutUniforms, setRoomCuts } from "../pwa/src/game/room-cuts.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(38);
const KINDS = Object.keys(ROOMS) as CabinKind[];

/** The first building of each kind with a room on the map. */
const firsts = new Map<CabinKind, Cabin>();
for (const c of cabinsOf(level)) if (hasRoom(c.kind) && !firsts.has(c.kind)) firsts.set(c.kind, c);

const plans = new Map<CabinKind, RoomPlan>();
for (const [kind, c] of firsts) {
  const plan = planRoom(c, holesOf(level, c));
  if (plan) plans.set(kind, plan);
}

/** A piece's footprint in the room's frame. */
function boxOf(p: Piece): { x0: number; z0: number; x1: number; z1: number } {
  const c = Math.abs(Math.cos(p.yaw));
  const s = Math.abs(Math.sin(p.yaw));
  const hx = (p.w * c + p.d * s) / 2;
  const hz = (p.w * s + p.d * c) / 2;
  return { x0: p.x - hx, z0: p.z - hz, x1: p.x + hx, z1: p.z + hz };
}

describe("rooms", () => {
  it("covers every kind the catalog has a room for", () => {
    for (const kind of KINDS) {
      expect(CABINS[kind], kind).toBeDefined();
      expect(hasRoom(kind)).toBe(true);
    }
    // The map raises most of them: a ski area and its village.
    expect(plans.size).toBeGreaterThanOrEqual(12);
  });

  it("furnishes every room", () => {
    for (const [kind, plan] of plans) expect(plan.pieces.length, kind).toBeGreaterThanOrEqual(5);
  });

  it("keeps every piece inside the walls and under the ceiling", () => {
    for (const [kind, plan] of plans) {
      for (const p of plan.pieces) {
        const b = boxOf(p);
        const e = 0.02;
        expect(b.x0, `${kind} ${p.item}`).toBeGreaterThanOrEqual(plan.x0 - e);
        expect(b.x1, `${kind} ${p.item}`).toBeLessThanOrEqual(plan.x1 + e);
        expect(b.z0, `${kind} ${p.item}`).toBeGreaterThanOrEqual(plan.z0 - e);
        expect(b.z1, `${kind} ${p.item}`).toBeLessThanOrEqual(plan.z1 + e);
        expect(p.y + p.h, `${kind} ${p.item}`).toBeLessThanOrEqual(plan.def.ceiling + e);
      }
    }
  });

  it("leaves a door's way in clear", () => {
    for (const [kind, plan] of plans) {
      for (const h of plan.holes) {
        if (!h.door) continue;
        const f = faceFrame(h.face, plan.width, plan.depth);
        // A point a metre in from the door's middle, at a walker's knee.
        const x = f.x + f.ux * h.u - f.nx * (plan.def.wall + 1.0);
        const z = f.z + f.uz * h.u - f.nz * (plan.def.wall + 1.0);
        for (const p of plan.pieces) {
          if (p.y > 0.6 || p.item === "rug") continue;
          const b = boxOf(p);
          const inside = x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
          expect(inside, `${kind}: ${p.item} in the way of the ${h.face} door`).toBe(false);
        }
      }
    }
  });

  it("finds a door into the rooms people walk into", () => {
    for (const kind of [
      "restaurant",
      "shop",
      "house",
      "hotel",
      "mountainHut",
      "hut",
      "church",
    ] as const) {
      const plan = plans.get(kind);
      if (!plan) continue;
      expect(
        plan.holes.some((h) => h.door),
        kind,
      ).toBe(true);
    }
  });

  it("is the same room every time it is built", () => {
    for (const [kind, c] of firsts) {
      const again = planRoom(c, holesOf(level, c));
      expect(again?.pieces, kind).toEqual(plans.get(kind)?.pieces);
    }
  });

  it("builds the rooms into one geometry", () => {
    const geometry = roomsGeometry(level, [...firsts.values()]);
    const n = geometry.getAttribute("position").count;
    expect(n).toBeGreaterThan(3000);
    expect(geometry.getAttribute("glow")).toBeDefined();
    geometry.dispose();
  });
});

describe("the ground kept out of the rooms", () => {
  it("cuts the nearest rooms, never more than it has room for", () => {
    const list = Array.from({ length: ROOM_CUTS + 4 }, (_, i) => ({
      x: i,
      z: 0,
      heading: 0,
      hw: 4,
      hd: 3,
    }));
    setRoomCuts(list);
    expect(roomCutUniforms.uRoomCuts.value).toBe(ROOM_CUTS);
    // A little short of the walls' outer faces, so the snow meets them.
    const b = roomCutUniforms.uRoomCutB.value[0];
    expect(b.x).toBeLessThan(4);
    expect(b.x).toBeGreaterThan(3.8);
    setRoomCuts([]);
    expect(roomCutUniforms.uRoomCuts.value).toBe(0);
  });
});
