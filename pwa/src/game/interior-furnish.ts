// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROOMS' SHARED FURNISHING — the palettes and the groups of pieces
// more than one layout (`interior-layouts.ts`) stands: a table with its
// chairs, the lamps, pictures, a tiled stove in its corner, the corner
// bench, the hooks by the door. Three-free, on the planner
// (`interior-plan.ts`).

import { Planner, type Face, type Item } from "./interior-plan.ts";

export const WOODS = [0xc8965e, 0xa8784a, 0xd8b07c, 0x8a603e] as const;
export const CLOTH = [0xa83232, 0x3c6a46, 0x34507a, 0xc8962e, 0x7a6a8a, 0x8a4a2a] as const;
export const TILES = [0x5f8a6a, 0xe6dcc4, 0x5a7aa0, 0xc89a50, 0x8a3a30] as const;
export const JACKETS = [
  0xc0392b, 0x2e6da4, 0xf2c14e, 0x2f6a46, 0x1d1f24, 0xe07b39, 0x7a4b8c,
] as const;

/** A table with chairs round it (`seats` a side, one at each end when
 * `ends`), the table along x when `yaw` is 0. */
export function tableSet(
  p: Planner,
  x: number,
  z: number,
  yaw: number,
  w: number,
  d: number,
  seats: number,
  wood: number,
  ends = false,
  seat: Item = "chair",
): void {
  if (!p.put({ item: "table", x, z, yaw, w, d, h: 0.76, tint: wood })) return;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const at = (lx: number, lz: number) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  const cw = seat === "bench" ? w * 0.92 : 0.44;
  for (const side of [-1, 1]) {
    const n = seat === "bench" ? 1 : seats;
    for (let i = 0; i < n; i++) {
      const lx = seat === "bench" ? 0 : -w / 2 + (w * (i + 0.5)) / n;
      const q = at(lx, side * (d / 2 + 0.24));
      p.put({
        item: seat,
        ...q,
        yaw: yaw + (side > 0 ? Math.PI : 0),
        w: cw,
        d: seat === "bench" ? 0.34 : 0.44,
        h: seat === "bench" ? 0.46 : 0.9,
        tint: wood,
      });
    }
  }
  if (ends)
    for (const side of [-1, 1]) {
      const q = at(side * (w / 2 + 0.26), 0);
      p.put({
        item: "chair",
        ...q,
        yaw: yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
        w: 0.44,
        d: 0.44,
        h: 0.9,
        tint: wood,
      });
    }
}

/** A lamp hung over a point, its shade `h` under the ceiling. */
export function pendant(p: Planner, x: number, z: number, drop = 0.9, tint = 0xf4e2b8): void {
  const top = p.def.ceiling;
  p.put({ item: "pendant", x, z, yaw: 0, w: 0.42, d: 0.42, h: drop, y: top - drop, tint }, false);
}

/** Lamps over the room on a grid about `step` apart. */
export function lampGrid(p: Planner, step: number, drop = 0.9, tint?: number): void {
  const nx = Math.max(1, Math.round((p.x1 - p.x0) / step));
  const nz = Math.max(1, Math.round((p.z1 - p.z0) / step));
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++)
      pendant(
        p,
        p.x0 + ((p.x1 - p.x0) * (i + 0.5)) / nx,
        p.z0 + ((p.z1 - p.z0) * (j + 0.5)) / nz,
        drop,
        tint,
      );
}

/** A few pictures hung round the walls at eye height. */
export function pictures(
  p: Planner,
  n: number,
  faces: readonly Face[] = ["back", "left", "right"],
): void {
  for (let i = 0; i < n; i++) {
    const face = faces[i % faces.length];
    const [a, b] = p.span(face);
    const u = a + (b - a) * (0.2 + p.deal() * 0.6);
    const w = 0.5 + p.deal() * 0.5;
    p.hang(face, "picture", u, 1.45, w, w * 0.72, {
      tint: p.pick([0x2a2622, 0xb08850, 0xeeeeea]),
      alt: p.pick(CLOTH),
    });
  }
}

/** A tiled stove in the corner nearest (cx, cz), its bench round it. */
export function stoveCorner(p: Planner, right: boolean, back: boolean, w = 1.1, h = 1.9): void {
  const x = right ? p.x1 - w / 2 - 0.05 : p.x0 + w / 2 + 0.05;
  const z = back ? p.z0 + w / 2 + 0.05 : p.z1 - w / 2 - 0.05;
  if (
    !p.put({
      item: "stove",
      x,
      z,
      yaw: back ? 0 : Math.PI,
      w,
      d: w,
      h,
      tint: 0xe8e0d0,
      alt: p.pick(TILES),
    })
  )
    return;
  // The bench along its open side.
  const bx = right ? x - w / 2 - 0.22 : x + w / 2 + 0.22;
  p.put({
    item: "bench",
    x: bx,
    z,
    yaw: right ? Math.PI / 2 : -Math.PI / 2,
    w,
    d: 0.4,
    h: 0.46,
    tint: WOODS[0],
  });
}

/** A parlour's corner: benches with backs along two walls, the table
 * before them, chairs on its open sides. */
export function cornerBench(
  p: Planner,
  right: boolean,
  back: boolean,
  len = 2.2,
  wood: number = WOODS[0],
): void {
  const fx: Face = right ? "right" : "left";
  const fz: Face = back ? "back" : "front";
  const xs = right ? p.x1 : p.x0;
  const zs = back ? p.z0 : p.z1;
  const sx = right ? -1 : 1;
  const sz = back ? 1 : -1;
  const look = { tint: wood, alt: p.pick(CLOTH) };
  // Along the z wall (back or front), then down the x wall.
  const a = p.onWall(fz, 0, 0.5);
  p.put({
    item: "wallBench",
    x: xs + sx * (len / 2),
    z: a.z,
    yaw: a.yaw,
    w: len,
    d: 0.5,
    h: 0.95,
    ...look,
  });
  const b = p.onWall(fx, 0, 0.5);
  p.put({
    item: "wallBench",
    x: b.x,
    z: zs + sz * (0.5 + (len - 0.5) / 2),
    yaw: b.yaw,
    w: len - 0.5,
    d: 0.5,
    h: 0.95,
    ...look,
  });
  const tx = xs + sx * 1.15;
  const tz = zs + sz * 1.15;
  p.put({ item: "table", x: tx, z: tz, yaw: 0, w: 1.3, d: 0.9, h: 0.76, tint: wood });
  p.put({
    item: "chair",
    x: tx,
    z: tz + sz * 0.72,
    yaw: back ? Math.PI : 0,
    w: 0.44,
    d: 0.44,
    h: 0.9,
    tint: wood,
  });
  p.put({
    item: "chair",
    x: tx + sx * 0.92,
    z: tz,
    yaw: right ? Math.PI / 2 : -Math.PI / 2,
    w: 0.44,
    d: 0.44,
    h: 0.9,
    tint: wood,
  });
}

/** Coats and helmets on hooks by the first door. */
export function hooksByDoor(p: Planner): void {
  const door = p.holes.find((h) => h.door);
  if (!door) return;
  for (const s of [1.25, -1.25]) {
    const u = door.u + s * (door.w / 2 + 0.35);
    p.hang(door.face, "hooks", u, 1.55, 1.0, 0.5, { alt: p.pick(JACKETS) });
  }
}

// ---------------------------------------------------------------- kinds
