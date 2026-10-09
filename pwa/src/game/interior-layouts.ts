// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT STANDS IN EACH ROOM — a layout a kind of building, on the planner
// (`interior-plan.ts`), drawn from how such rooms are really furnished
// (`docs/buildings.md`, "Inside"):
//
//   * THE BASE LODGE: a self-service food hall — the servery along the
//     back wall (the tray rail, the hot counter under its glass, the
//     fridges of drinks, the stack of trays at its head), long tables
//     with benches in rows across the floor, pendant lamps over them, a
//     tiled stove in a corner, pictures of the mountain on the walls.
//   * THE TICKET OFFICE: the counter along the serving windows with its
//     screens, the cashiers' chairs, shelves of brochures and passes, a
//     cabinet, the board of the day's lifts.
//   * THE RENTAL: the boot wall along the back, racks of hire skis down
//     the sides, fitting benches in the middle, the service counter by
//     the door, the tuning bench, racks of jackets.
//   * THE SKI SCHOOL: the desk, lockers, benches, helmets on hooks, the
//     children's skis racked, the class board.
//   * FIRST AID: two treatment couches, the cabinets of dressings, the
//     desk with its radio, an akja (the rescue sled) on the floor.
//   * THE HOTEL: the lobby — the reception desk with the pigeonholes
//     behind it, sofas round a rug by the fireplace, plants, pictures.
//   * THE GARAGE: workbenches and tool boards along the back, shelves of
//     parts, oil drums, a stack of tyres, a compressor.
//   * THE PUMP HOUSE: the pumps in a row on their plinths, the air tank,
//     the switchboards along a wall.
//   * THE HOUSE and THE CHALET: a parlour — a tiled stove with its bench,
//     the corner bench and table, a sofa on a rug, the kitchen along the
//     back, coats on hooks by the door.
//   * THE FLATS: the entrance hall — mailboxes, the ski lockers, boot
//     dryers and a bench, the stairs up.
//   * THE SHOP: aisles of shelved goods, the till by the door, racks of
//     clothes along a wall.
//   * THE CHURCH: pews either side of an aisle, the altar on its step at
//     the far end, the lectern, candles, the cross on the wall.
//   * THE MOUNTAIN RESTAURANT: a parlour of panelled pine — tables and
//     corner benches, the bar with its stools, a tiled stove.
//   * THE PATROL HUT: the desk under the big window with its radios and
//     screen, the akja, the cabinet, rescue packs on hooks.
//   * THE LOG HUT and CABIN: an iron stove, the table and corner bench,
//     bunks, a shelf, a kitchen corner.
//
// Three-free: a layout only proposes; the planner keeps what fits.

import type { CabinKind } from "@engine";

import {
  WOODS,
  CLOTH,
  JACKETS,
  tableSet,
  pendant,
  lampGrid,
  pictures,
  stoveCorner,
  cornerBench,
  hooksByDoor,
} from "./interior-furnish.ts";
import { Planner, type Face, type Piece } from "./interior-plan.ts";

function restaurant(p: Planner): void {
  // The servery along the back wall: the tray rail, the counters, drinks.
  const [a, b] = p.span("back");
  const run = Math.min(14, (b - a) * 0.55);
  const u0 = -run / 2;
  p.alongWall("back", "servery", run, 1.4, 1.3, 0, { tint: 0xb08a62, alt: 0xd8d8d4 }, [
    u0,
    u0 + run + 0.2,
  ]);
  p.alongWall("back", "fridge", 1.2, 0.7, 2.0, 0.05, { tint: 0x2a2e33 }, [
    u0 + run + 0.4,
    u0 + run + 3.2,
  ]);
  const end = p.onWall("back", u0 - 0.6, 0.6);
  p.put({ item: "trays", ...end, w: 0.6, d: 0.5, h: 1.1, tint: 0x6a6e72, alt: 0xc8a050 });
  // Long tables with benches in rows, their ends to the front.
  const wood = p.pick(WOODS);
  const zTop = p.z0 + 3.0;
  const zBot = p.z1 - 0.6;
  const len = Math.min(3.6, zBot - zTop - 1.0);
  const cols = Math.floor((p.x1 - p.x0 - 1) / 2.4);
  for (let i = 0; i < cols; i++) {
    const x = p.x0 + 1.2 + ((p.x1 - p.x0 - 2.4) * (i + 0.5)) / cols;
    for (let j = 0; j < 2; j++) {
      const z = zTop + (j + 0.5) * ((zBot - zTop) / 2);
      tableSet(p, x, z, Math.PI / 2, len, 0.8, 4, wood, false, "bench");
    }
    pendant(p, x, (zTop + zBot) / 2, 0.9);
  }
  stoveCorner(p, true, true);
  pictures(p, 6, ["left", "right", "back"]);
}

function ticket(p: Planner): void {
  // The counter under the serving windows along the front.
  p.alongWall("front", "counter", 2.4, 0.7, 1.05, 0, { tint: 0xc8a070, alt: 0xe8e4dc });
  for (const piece of [...p.pieces])
    if (piece.item === "counter") {
      const c = Math.cos(piece.yaw);
      const s = Math.sin(piece.yaw);
      p.put(
        {
          item: "screen",
          x: piece.x,
          z: piece.z,
          yaw: piece.yaw,
          w: 0.5,
          d: 0.2,
          h: 0.4,
          y: 1.05,
          tint: 0x1d1f24,
        },
        false,
      );
      p.put({
        item: "stool",
        x: piece.x - s * 0.8,
        z: piece.z - c * 0.8,
        yaw: piece.yaw,
        w: 0.45,
        d: 0.45,
        h: 0.75,
        tint: 0x2a2e33,
      });
    }
  p.alongWall("back", "goodsShelf", 1.2, 0.35, 1.9, 0.1, { tint: 0xe8e4dc });
  p.alongWall("left", "cabinet", 0.9, 0.5, 1.2, 0, { tint: 0x8a9096 });
  p.hang("back", "board", 0, 2.0, 1.6, 0.7, { tint: 0x1d2a35 });
  lampGrid(p, 3, 0.4, 0xf8f4ea);
}

function rental(p: Planner): void {
  // The boot wall, the racks of skis, the counter, the benches.
  p.alongWall("back", "bootWall", 2.4, 0.45, 2.3, 0, { tint: 0xe8e4dc });
  p.alongWall("left", "skiRack", 2.0, 0.55, 1.9, 0.2, { tint: 0x3a3d42, alt: p.pick(JACKETS) });
  p.alongWall("right", "clothesRack", 1.6, 0.6, 1.6, 0.3, { tint: 0x8a9096 });
  const door = p.holes.find((h) => h.door);
  const cx = door ? -Math.sign(door.u || 1) * 2.5 : 0;
  p.put({
    item: "counter",
    x: cx,
    z: p.z1 - 2.6,
    yaw: Math.PI,
    w: 3.0,
    d: 0.7,
    h: 1.05,
    tint: 0x2a2e33,
    alt: 0xb08a62,
  });
  p.put(
    {
      item: "screen",
      x: cx,
      z: p.z1 - 2.6,
      yaw: 0,
      w: 0.5,
      d: 0.2,
      h: 0.4,
      y: 1.05,
      tint: 0x1d1f24,
    },
    false,
  );
  for (const s of [-1, 1])
    p.put({
      item: "bench",
      x: s * 2.2,
      z: (p.z0 + p.z1) / 2 - 0.5,
      yaw: 0,
      w: 2.0,
      d: 0.45,
      h: 0.46,
      tint: 0xc8a070,
    });
  p.put({
    item: "workbench",
    ...p.onWall("left", p.span("left")[1] - 1.2, 0.7),
    w: 2.0,
    d: 0.7,
    h: 0.92,
    tint: 0x6a6e72,
  });
  lampGrid(p, 3.2, 0.5, 0xf8f4ea);
}

function school(p: Planner): void {
  p.put({
    item: "desk",
    x: p.x1 - 1.4,
    z: p.z0 + 1.0,
    yaw: 0,
    w: 1.6,
    d: 0.8,
    h: 0.76,
    tint: 0xc8a070,
  });
  p.put({
    item: "chair",
    x: p.x1 - 1.4,
    z: p.z0 + 0.45,
    yaw: 0,
    w: 0.48,
    d: 0.48,
    h: 0.95,
    tint: 0x2a2e33,
  });
  p.alongWall("left", "lockers", 1.8, 0.5, 1.9, 0.05, { tint: 0xc8392e });
  p.alongWall("back", "skiRack", 1.6, 0.5, 1.3, 0.1, { tint: 0x3a3d42, alt: 0xf2c14e }, [
    p.span("back")[0],
    0,
  ]);
  p.put({
    item: "bench",
    x: 0.3,
    z: (p.z0 + p.z1) / 2 + 0.2,
    yaw: 0,
    w: 2.4,
    d: 0.42,
    h: 0.42,
    tint: 0xd8b07c,
  });
  p.hang("back", "board", p.span("back")[1] - 2.8, 1.2, 1.6, 0.9, { tint: 0xf2f2ef });
  hooksByDoor(p);
  lampGrid(p, 3, 0.5);
}

function firstAid(p: Planner): void {
  for (const s of [-1, 1])
    p.put({
      item: "couch",
      x: s * (p.x1 - p.x0) * 0.22,
      z: p.z0 + 1.3,
      yaw: 0,
      w: 0.8,
      d: 2.0,
      h: 0.75,
      tint: 0x8a9096,
      alt: 0x4a8a9a,
    });
  p.alongWall("left", "cabinet", 0.9, 0.45, 2.0, 0.05, { tint: 0xeeeeea });
  p.alongWall("right", "goodsShelf", 1.2, 0.4, 2.0, 0.05, { tint: 0xeeeeea });
  p.put({
    item: "desk",
    x: 0,
    z: (p.z0 + p.z1) / 2 + 0.6,
    yaw: Math.PI,
    w: 1.6,
    d: 0.8,
    h: 0.76,
    tint: 0xd8d8d4,
  });
  p.put(
    {
      item: "screen",
      x: 0,
      z: (p.z0 + p.z1) / 2 + 0.6,
      yaw: Math.PI,
      w: 0.5,
      d: 0.2,
      h: 0.4,
      y: 0.76,
      tint: 0x1d1f24,
    },
    false,
  );
  p.put({
    item: "akja",
    x: p.x1 - 1.0,
    z: p.z1 - 2.6,
    yaw: 0,
    w: 0.75,
    d: 2.4,
    h: 0.45,
    tint: 0xc81e1e,
  });
  lampGrid(p, 3, 0.3, 0xf8f8f4);
}

function hotel(p: Planner): void {
  // Reception along the back to one side, pigeonholes behind it.
  const rx = p.x0 + (p.x1 - p.x0) * 0.25;
  p.put({
    item: "counter",
    x: rx,
    z: p.z0 + 1.6,
    yaw: 0,
    w: 3.6,
    d: 0.7,
    h: 1.1,
    tint: 0x6a4a32,
    alt: 0xd8c8a8,
  });
  p.put({
    item: "goodsShelf",
    ...p.onWall("back", -rx, 0.3),
    w: 2.4,
    d: 0.3,
    h: 2.0,
    tint: 0x6a4a32,
  });
  // The fireplace on the far wall, sofas round a rug before it.
  const fx = p.x1 - (p.x1 - p.x0) * 0.25;
  const fp = p.onWall("back", -fx, 0.7);
  p.put({ item: "fireplace", ...fp, w: 1.8, d: 0.7, h: p.def.ceiling, tint: 0xd8d0c4 });
  const rz = p.z0 + 3.2;
  p.put({ item: "rug", x: fx, z: rz, yaw: 0, w: 3.4, d: 2.4, h: 0.02, tint: p.pick(CLOTH) }, false);
  p.put({ item: "table", x: fx, z: rz, yaw: 0, w: 1.2, d: 0.6, h: 0.42, tint: 0x6a4a32 });
  const cloth = p.pick(CLOTH);
  p.put({ item: "sofa", x: fx, z: rz + 1.3, yaw: Math.PI, w: 2.2, d: 0.9, h: 0.85, tint: cloth });
  for (const s of [-1, 1])
    p.put({
      item: "armchair",
      x: fx + s * 1.5,
      z: rz,
      yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2,
      w: 0.9,
      d: 0.85,
      h: 0.85,
      tint: cloth,
    });
  for (const x of [p.x0 + 0.5, p.x1 - 0.5])
    p.put({
      item: "plant",
      x,
      z: p.z1 - 0.5,
      yaw: 0,
      w: 0.6,
      d: 0.6,
      h: 1.6,
      tint: 0x8a5a3a,
      alt: 0x3c6a3e,
    });
  // A table or two by the windows.
  tableSet(p, p.x0 + 2, p.z1 - 2.2, 0, 1.2, 0.8, 1, 0x8a603e, true);
  tableSet(p, p.x1 - 2, p.z1 - 2.2, 0, 1.2, 0.8, 1, 0x8a603e, true);
  lampGrid(p, 4, 0.8, 0xf4d8a0);
  pictures(p, 5);
}

function garage(p: Planner): void {
  p.alongWall("back", "workbench", 2.4, 0.8, 0.92, 0.4, { tint: 0x5a6066 }, [
    p.span("back")[0],
    -1,
  ]);
  for (const piece of [...p.pieces])
    if (piece.item === "workbench") {
      const u = -piece.x;
      p.hang("back", "toolboard", u, 1.15, 2.0, 1.1, { tint: 0x8a9096 });
    }
  p.alongWall("back", "shelf", 2.0, 0.6, 3.0, 0.1, { tint: 0x2e6da4, alt: 0x8a8a84 }, [
    0,
    p.span("back")[1],
  ]);
  p.alongWall("left", "drum", 0.62, 0.62, 0.9, 0.08, { tint: 0x2f6a46 }, [
    p.span("left")[0],
    p.span("left")[0] + 3,
  ]);
  p.alongWall("right", "tyres", 1.0, 1.0, 1.1, 0.3, { tint: 0x1d1f24 }, [
    p.span("right")[0] + 1,
    p.span("right")[0] + 4,
  ]);
  p.alongWall("right", "tank", 1.8, 0.8, 1.4, 0, { tint: 0xc8392e }, [-1, 2]);
  lampGrid(p, 6, 1.2, 0xf8f4ea);
}

function pumpHouse(p: Planner): void {
  const n = Math.max(2, Math.floor((p.x1 - p.x0 - 1) / 2.2));
  for (let i = 0; i < n; i++) {
    const x = p.x0 + 1 + ((p.x1 - p.x0 - 2) * (i + 0.5)) / n;
    p.put({
      item: "pump",
      x,
      z: p.z0 + 1.8,
      yaw: 0,
      w: 0.9,
      d: 2.2,
      h: 1.2,
      tint: 0x2e6da4,
      alt: 0x5a6066,
    });
  }
  p.put({
    item: "tank",
    x: (p.x0 + p.x1) / 2,
    z: p.z1 - 2.6,
    yaw: 0,
    w: 2.6,
    d: 1.0,
    h: 1.4,
    tint: 0xd8d8d4,
  });
  p.alongWall("left", "switchboard", 1.2, 0.5, 2.1, 0, { tint: 0xa8acb0 });
  lampGrid(p, 3.5, 0.6, 0xf8f8f4);
}

function parlour(p: Planner, kitchen: boolean): void {
  const right = p.deal() < 0.5;
  stoveCorner(p, right, true);
  cornerBench(p, !right, true, 2.4);
  if (kitchen) {
    const back = p.span("back");
    const mid = (back[0] + back[1]) / 2;
    p.alongWall(
      "back",
      "kitchen",
      2.6,
      0.62,
      0.92,
      0,
      { tint: p.pick([0xeeeeea, 0xb08a62, 0x6a8a7a]) },
      [mid - 1.4, mid + 1.4],
    );
    p.alongWall("back", "fridge", 0.65, 0.65, 1.85, 0, { tint: 0xeeeeea }, [mid + 1.3, mid + 2.1]);
  }
  // A sofa on a rug toward the front, an armchair.
  const cloth = p.pick(CLOTH);
  const sx = right ? p.x0 + 1.6 : p.x1 - 1.6;
  const sz = p.z1 - 2.0;
  p.put(
    { item: "rug", x: sx, z: sz - 0.4, yaw: 0, w: 2.4, d: 1.8, h: 0.02, tint: p.pick(CLOTH) },
    false,
  );
  const side = p.onWall(right ? "left" : "right", 0, 0.9);
  p.put({
    item: "sofa",
    x: side.x,
    z: sz - 0.4,
    yaw: side.yaw,
    w: 2.0,
    d: 0.9,
    h: 0.85,
    tint: cloth,
  });
  p.put({
    item: "table",
    x: sx + (right ? 0.4 : -0.4),
    z: sz - 0.4,
    yaw: Math.PI / 2,
    w: 1.0,
    d: 0.55,
    h: 0.42,
    tint: WOODS[1],
  });
  p.put({
    item: "shelf",
    ...p.onWall("front", right ? 1.2 : -1.2, 0.35),
    w: 1.0,
    d: 0.35,
    h: 1.9,
    tint: WOODS[1],
    alt: 0x8a6a4a,
  });
  // A floor big enough for a household's day: the dining table in the
  // middle under its own lamp, a sideboard and armchairs by the windows,
  // a plant in a corner.
  const cx = (p.x0 + p.x1) / 2;
  const cz = (p.z0 + p.z1) / 2;
  if ((p.x1 - p.x0) * (p.z1 - p.z0) > 50) {
    tableSet(p, cx, cz, 0, 2.0, 0.95, 3, p.pick(WOODS), true);
    pendant(p, cx, cz, 0.9);
    for (const face of ["left", "right", "back"] as const) {
      const [a, b] = p.span(face);
      const u = (a + b) / 2 + (p.deal() - 0.5) * 2;
      if (p.clearOf(face, u - 0.8, u + 0.8, 1.0)) {
        p.put({
          item: "cabinet",
          ...p.onWall(face, u, 0.45),
          w: 1.6,
          d: 0.45,
          h: 0.85,
          tint: p.pick(WOODS),
        });
        break;
      }
    }
    const ax = right ? p.x1 - 1.4 : p.x0 + 1.4;
    for (const dz of [-0.6, 0.6])
      p.put({
        item: "armchair",
        x: ax,
        z: p.z1 - 2.2 + dz,
        yaw: right ? -Math.PI / 2 : Math.PI / 2,
        w: 0.85,
        d: 0.85,
        h: 0.85,
        tint: cloth,
      });
    p.put({
      item: "plant",
      x: right ? p.x1 - 0.5 : p.x0 + 0.5,
      z: p.z1 - 0.6,
      yaw: 0,
      w: 0.5,
      d: 0.5,
      h: 1.3,
      tint: 0x3a6a3a,
    });
  }
  hooksByDoor(p);
  pendant(p, (p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2 + 2.2, 0.6);
  pictures(p, 3);
}

function apartments(p: Planner): void {
  const door = p.holes.find((h) => h.door);
  const du = door?.u ?? 0;
  const dw = door?.w ?? 1;
  const mid = (p.z0 + p.z1) / 2;
  p.hang("front", "mailboxes", du - dw / 2 - 1.2, 1.0, 1.4, 0.8, { tint: 0x5a6066 });
  // The stairs up in the back corner furthest from the door, and the
  // reception desk at the back facing whoever comes in.
  const side = du > 0 ? -1 : 1;
  p.put({
    item: "stairs",
    x: side * (p.x1 - 0.75),
    z: p.z0 + 2.3,
    yaw: Math.PI / 2,
    w: 4.2,
    d: 1.3,
    h: p.def.ceiling,
    tint: 0xc8b8a0,
  });
  p.put({
    item: "counter",
    x: du,
    z: p.z0 + 1.6,
    yaw: 0,
    w: 2.6,
    d: 0.7,
    h: 1.05,
    tint: 0x8a6448,
    alt: 0x2a2e33,
  });
  p.put(
    {
      item: "screen",
      x: du + 0.6,
      z: p.z0 + 1.6,
      yaw: Math.PI,
      w: 0.45,
      d: 0.2,
      h: 0.35,
      y: 1.05,
      tint: 0x1d1f24,
    },
    false,
  );
  p.hang("back", "board", du, 1.5, 1.6, 0.9, { tint: 0x2c3a46 });
  // The guests' ski room: a row of lockers down both flanks and islands
  // of them back to back down the middle, a bench before each, boot
  // dryers along the back.
  p.alongWall("left", "lockers", 1.6, 0.6, 2.0, 0, { tint: 0xa8acb0 });
  p.alongWall("right", "lockers", 1.6, 0.6, 2.0, 0, { tint: 0xa8acb0 });
  p.alongWall("back", "bootDryer", 1.6, 0.4, 1.4, 0.2, { tint: 0x6a6e72 });
  const lane = 3.4;
  for (let x = p.x0 + 3.2; x < p.x1 - 3.0; x += lane) {
    if (Math.abs(x - du) < 1.8) continue;
    for (const z of [mid - 1.6, mid + 1.6]) {
      if (
        !p.put({ item: "lockers", x, z, yaw: Math.PI / 2, w: 2.6, d: 1.1, h: 1.9, tint: 0x9aa4ac })
      )
        continue;
      p.put({
        item: "bench",
        x: x + 1.15,
        z,
        yaw: Math.PI / 2,
        w: 2.0,
        d: 0.4,
        h: 0.44,
        tint: 0xd8b07c,
      });
    }
  }
  // A lounge by the door: a sofa, two armchairs on a rug, a plant.
  const lx = du - side * 3.2;
  const lz = p.z1 - 2.4;
  p.put({ item: "rug", x: lx, z: lz, yaw: 0, w: 3.0, d: 2.2, h: 0.02, tint: 0x7a4a3a }, false);
  p.put({ item: "sofa", x: lx, z: lz - 0.8, yaw: 0, w: 2.0, d: 0.85, h: 0.85, tint: 0x5a6a7a });
  for (const s of [-1, 1])
    p.put({
      item: "armchair",
      x: lx + s * 1.4,
      z: lz + 0.4,
      yaw: Math.PI + s * 0.5,
      w: 0.85,
      d: 0.85,
      h: 0.85,
      tint: 0x8a5a3a,
    });
  p.put({
    item: "plant",
    x: lx + side * 2.0,
    z: p.z1 - 0.8,
    yaw: 0,
    w: 0.5,
    d: 0.5,
    h: 1.4,
    tint: 0x3a6a3a,
  });
  lampGrid(p, 4, 0.2, 0xf8f4ea);
}

function shop(p: Planner): void {
  // Aisles of shelves running back from the front, the till by the door.
  const n = Math.floor((p.x1 - p.x0 - 2) / 2.2);
  for (let i = 0; i < n; i++) {
    const x = p.x0 + 1.5 + ((p.x1 - p.x0 - 3) * (i + 0.5)) / n;
    if (Math.abs(x) < 1.6) continue;
    p.put({
      item: "goodsShelf",
      x,
      z: p.z0 + 1.0 + 2.2,
      yaw: Math.PI / 2,
      w: 4.0,
      d: 0.8,
      h: 1.6,
      tint: 0xeeeeea,
      alt: 1,
    });
  }
  p.alongWall("back", "goodsShelf", 1.2, 0.45, 2.1, 0, { tint: 0xeeeeea });
  p.alongWall("left", "clothesRack", 1.6, 0.6, 1.6, 0.2, { tint: 0x8a9096 });
  p.alongWall("right", "goodsShelf", 1.2, 0.45, 2.1, 0, { tint: 0xeeeeea });
  p.put({
    item: "counter",
    x: 2.6,
    z: p.z1 - 1.9,
    yaw: Math.PI,
    w: 2.0,
    d: 0.7,
    h: 1.0,
    tint: 0xb08a62,
    alt: 0x2a2e33,
  });
  p.put(
    {
      item: "screen",
      x: 2.6,
      z: p.z1 - 1.9,
      yaw: 0,
      w: 0.45,
      d: 0.2,
      h: 0.35,
      y: 1.0,
      tint: 0x1d1f24,
    },
    false,
  );
  lampGrid(p, 3, 0.3, 0xf8f8f4);
}

function church(p: Planner): void {
  // The altar on its step at the back, the cross over it.
  p.put({
    item: "altar",
    x: 0,
    z: p.z0 + 1.6,
    yaw: 0,
    w: 2.6,
    d: 1.0,
    h: 1.0,
    tint: 0xeeeae0,
    alt: 0xb03030,
  });
  p.hang("back", "cross", 0, 2.6, 1.2, 2.0, { tint: 0x6a4a32 });
  p.put({
    item: "lectern",
    x: -2.4,
    z: p.z0 + 3.4,
    yaw: Math.PI,
    w: 0.6,
    d: 0.5,
    h: 1.2,
    tint: 0x6a4a32,
  });
  for (const s of [-1, 1])
    p.put({
      item: "candles",
      x: s * 1.6,
      z: p.z0 + 1.6,
      yaw: 0,
      w: 0.3,
      d: 0.3,
      h: 1.4,
      tint: 0xc8a050,
    });
  // Two blocks of pews, the aisle between them, from the step to the font.
  const aisle = 0.8;
  const w = (p.x1 - p.x0) / 2 - aisle - 0.4;
  for (let z = p.z0 + 4.6; z < p.z1 - 4.0; z += 1.0)
    for (const s of [-1, 1])
      p.put({
        item: "pew",
        x: s * (aisle + w / 2),
        z,
        yaw: Math.PI,
        w,
        d: 0.6,
        h: 0.95,
        tint: 0x8a603e,
      });
  p.put({ item: "candles", x: 1.4, z: p.z1 - 2.6, yaw: 0, w: 0.5, d: 0.5, h: 1.0, tint: 0xd8d0c4 });
  for (let i = 0; i < 4; i++) pendant(p, 0, p.z0 + 4 + ((p.z1 - p.z0 - 6) * i) / 3, 2.4, 0xf4d8a0);
  pictures(p, 4, ["left", "right"]);
}

function mountainHut(p: Planner): void {
  // The bar along the back to one side, its stools.
  const [a] = p.span("back");
  p.alongWall("back", "bar", 4.0, 0.9, 1.1, 0, { tint: 0x8a603e, alt: 0xc8a050 }, [
    a + 0.5,
    a + 5.0,
  ]);
  for (const piece of [...p.pieces])
    if (piece.item === "bar")
      for (let i = 0; i < 4; i++)
        p.put({
          item: "stool",
          x: piece.x - 1.5 + i,
          z: piece.z + 0.85,
          yaw: 0,
          w: 0.4,
          d: 0.4,
          h: 0.78,
          tint: 0x6a4a32,
        });
  stoveCorner(p, true, true, 1.2, 2.0);
  cornerBench(p, false, false, 2.6, WOODS[2]);
  cornerBench(p, true, false, 2.6, WOODS[2]);
  // Tables down the middle.
  const wood = WOODS[2];
  for (let x = p.x0 + 4.2; x < p.x1 - 4; x += 2.6)
    tableSet(p, x, (p.z0 + p.z1) / 2 + 0.6, Math.PI / 2, 1.8, 0.8, 2, wood);
  lampGrid(p, 3.2, 0.8, 0xf4d8a0);
  pictures(p, 4);
}

function patrol(p: Planner): void {
  // The desk under the big window, its radios and screen.
  const d = p.onWall("front", 0, 0.6);
  p.put({
    item: "desk",
    ...d,
    w: Math.min(3.2, p.x1 - p.x0 - 0.4),
    d: 0.6,
    h: 0.76,
    tint: 0xd8b07c,
  });
  p.put({ item: "screen", ...d, w: 0.5, d: 0.2, h: 0.4, y: 0.76, tint: 0x1d1f24 }, false);
  p.put({
    item: "chair",
    x: d.x + 0.6,
    z: d.z - 0.7,
    yaw: 0,
    w: 0.5,
    d: 0.5,
    h: 0.95,
    tint: 0x2a2e33,
  });
  p.alongWall("back", "akja", 2.2, 0.7, 0.45, 0, { tint: 0xc81e1e });
  p.alongWall("left", "cabinet", 0.8, 0.4, 1.9, 0, { tint: 0xeeeeea });
  p.hang("back", "hooks", 0, 1.5, 1.6, 0.6, { alt: 0xc81e1e });
  pendant(p, 0, 0, 0.4);
}

function logRoom(p: Planner, bunks: number): void {
  const right = p.deal() < 0.5;
  // The iron stove by the back wall, a bunk along a flank, the corner set.
  const st = p.onWall("back", right ? -0.6 : 0.6, 0.6);
  p.put({ item: "ironStove", ...st, w: 0.6, d: 0.55, h: 0.9, tint: 0x2a2a2c });
  for (let i = 0; i < bunks; i++) {
    const face: Face = right ? "left" : "right";
    const [a, b] = p.span(face);
    const u = i === 0 ? b - 1.05 : a + 1.05;
    p.put({
      item: "bunk",
      ...p.onWall(face, u, 0.9),
      w: 2.0,
      d: 0.9,
      h: 1.7,
      tint: WOODS[0],
      alt: p.pick(CLOTH),
    });
  }
  cornerBench(p, right, false, 1.8);
  p.alongWall("back", "shelf", 0.9, 0.3, 1.6, 0, { tint: WOODS[1], alt: 0x8a6a4a });
  p.alongWall("back", "kitchen", 1.2, 0.55, 0.9, 0, { tint: WOODS[1] });
  hooksByDoor(p);
  pendant(p, (p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, 0.45, 0xf4c890);
}

/** Furnish one kind's room on its planner. */
export function furnish(kind: CabinKind, p: Planner): Piece[] {
  switch (kind) {
    case "restaurant":
      restaurant(p);
      break;
    case "ticket":
      ticket(p);
      break;
    case "rental":
      rental(p);
      break;
    case "school":
      school(p);
      break;
    case "firstAid":
      firstAid(p);
      break;
    case "hotel":
      hotel(p);
      break;
    case "garage":
      garage(p);
      break;
    case "pumpHouse":
      pumpHouse(p);
      break;
    case "house":
    case "chalet":
      parlour(p, true);
      break;
    case "apartments":
      apartments(p);
      break;
    case "shop":
      shop(p);
      break;
    case "church":
      church(p);
      break;
    case "mountainHut":
      mountainHut(p);
      break;
    case "patrol":
      patrol(p);
      break;
    case "hut":
      logRoom(p, 1);
      break;
    case "cabin":
      logRoom(p, 2);
      break;
    default:
      break;
  }
  return p.pieces;
}
