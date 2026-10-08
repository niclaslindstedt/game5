// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI LODGE, BUILT — `cabin-shapes.ts`'s plan for the `afterski`
// kind (`defs/cabins.ts`), out of the same log builder's pieces, and the
// TERRACE across its front: what makes a log hall read as the place a ski
// area goes after the lifts close.
//
// HOW AN AFTERSKI LODGE IS LAID OUT, and so how this one is:
//   * A LONG HALL of logs, its ridge along its front so its long side faces
//     the snow; a storey and a half under a roof heavy with snow, big
//     windows (it is a room for a crowd, not a shelter) and a DOUBLE DOOR
//     in the middle of the front.
//   * A SIGN over the door — no words: a beer glass painted on a board,
//     its foam spilling over, readable from the piste.
//   * THE TERRACE: a deck of boards out across the whole front a step
//     below the floor, a railing round it open in the middle where the
//     steps come up from the snow, and on it trestle TABLES with BENCHES
//     either side, two of them under PARASOLS.
//   * STRING LIGHTS in swags from the eave out to the terrace's corner
//     posts and along the railing, every bulb lit at night (the GLOW mark).
//   * The racks the skis stand in are on the snow below the deck — they
//     follow the ground, so they are `lodge-yard.ts`'s, in the world.
//
// THE FRAME is the building's (`cabin-shapes.ts`): x across its front, y up
// from its floor, z toward its front.

import * as THREE from "three";

import { CABINS } from "@engine";

import {
  CABIN_PAINT as P,
  box,
  chimney,
  roofUnder,
  wallBox,
  type Roof,
  type Wall,
} from "./cabin-parts.ts";
import type { CabinLod, Plan } from "./cabin-shapes.ts";
import { DECK, DECK_END, GAP, TERRACE, TERRACE_TABLES as T } from "./lodge-measure.ts";
import type { Shape, V3 } from "./tree-mesh.ts";

const colour = (hex: number): THREE.Color => new THREE.Color(hex);

/** The lodge's own paints, sRGB. */
export const LODGE_PAINT = {
  /** The parasols' two panels, alternating. */
  canvas: [colour(0xb3302a), colour(0xf1ece0)],
  /** The bulbs of the string lights, warm, and their wire. */
  bulb: [colour(0xffcf7a), colour(0xffb25a), colour(0xfff0c0)],
  wire: colour(0x2b2622),
  /** The sign: its board, the beer and the foam. */
  sign: colour(0x3a2a1e),
  beer: colour(0xe2a72e),
  foam: colour(0xfbf6ea),
  /** The tables' tops, scrubbed. */
  table: colour(0x9c7a55),
};

export { DECK, GAP, TERRACE } from "./lodge-measure.ts";

/** A board laid on the deck from (x0, z0) to (x1, z1), `y0..y1` over it. */
function plank(
  s: Shape,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  y1: number,
  c: THREE.Color,
): void {
  box(s, x0, DECK.top + y0, z0, x1, DECK.top + y1, z1, c, c);
}

/** A TRESTLE TABLE at (x, z) along x, with a bench either side. */
function table(s: Shape, x: number, z: number, lod: CabinLod): void {
  const L = T.half;
  plank(s, x - L, z - T.top, x + L, z + T.top, T.height - 0.06, T.height, LODGE_PAINT.table);
  for (const dz of [-T.bench, T.bench])
    plank(s, x - L, z + dz - 0.17, x + L, z + dz + 0.17, T.seat - 0.05, T.seat, P.board[0]);
  if (lod) return;
  for (const dx of [-L + 0.2, L - 0.2]) {
    plank(s, x + dx - 0.05, z - 0.3, x + dx + 0.05, z + 0.3, 0, 0.7, P.board[1]);
    for (const dz of [-0.75, 0.75])
      plank(s, x + dx - 0.05, z + dz - 0.12, x + dx + 0.05, z + dz + 0.12, 0, 0.42, P.board[1]);
  }
}

/** A PARASOL over the table at (x, z): its pole and an eight-panel canopy
 * in two colours, a cap of snow on its crown. */
function parasol(s: Shape, x: number, z: number, lod: CabinLod): void {
  const y = DECK.top;
  s.tube([x, y, z], [x, y + 2.75, z], 0.035, 0.03, 4, P.iron);
  const sides = lod ? 6 : 8;
  const R = 1.55;
  const tip: V3 = [x, y + 2.85, z];
  const rim = (k: number): V3 => {
    const t = (k / sides) * Math.PI * 2;
    return [x + Math.cos(t) * R, y + 2.25, z + Math.sin(t) * R];
  };
  for (let k = 0; k < sides; k++) {
    const a = rim(k);
    const b = rim(k + 1);
    const c = LODGE_PAINT.canvas[k % 2];
    // Both faces: the top in the sky's light, the underside its own shade.
    s.tri(tip, b, a, c, [a[0] + b[0] - 2 * x, 1.2, a[2] + b[2] - 2 * z]);
    s.tri(tip, a, b, c.clone().multiplyScalar(0.7), [0, -1, 0]);
  }
  // The snow on its crown: a low cone over the upper half.
  const snow = (k: number): V3 => {
    const t = (k / sides) * Math.PI * 2;
    return [x + Math.cos(t) * R * 0.45, y + 2.62, z + Math.sin(t) * R * 0.45];
  };
  for (let k = 0; k < sides; k++) s.tri([x, y + 2.92, z], snow(k + 1), snow(k), P.snow, [0, 1, 0]);
}

/** A SWAG of string lights from `a` to `b`, sagging `sag` m at its middle:
 * its wire and a bulb every half metre or so, every bulb lit at night. */
function swag(s: Shape, a: V3, b: V3, sag: number, lod: CabinLod, seed: number): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(2, Math.round(len / (lod ? 1.4 : 0.55)));
  const at = (t: number): V3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t),
    a[2] + (b[2] - a[2]) * t,
  ];
  if (lod === 0) {
    for (let i = 0; i < n; i++)
      s.tube(at(i / n), at((i + 1) / n), 0.008, 0.008, 3, LODGE_PAINT.wire);
  }
  s.mark("glow", 1);
  const r = lod ? 0.09 : 0.055;
  for (let i = 1; i < n; i++) {
    const p = at(i / n);
    const c = LODGE_PAINT.bulb[(i + seed) % 3];
    box(s, p[0] - r, p[1] - r * 2.2, p[2] - r, p[0] + r, p[1] - 0.01, p[2] + r, c, c, []);
  }
  s.mark("glow", 0);
}

/** THE SIGN over the door: a board with a beer glass painted on it — the
 * glass, its foam spilling over the rim and a handle — standing a hand
 * proud of the logs. */
function sign(s: Shape, w: Wall, y: number): void {
  const o = 0.06;
  wallBox(s, w, -1.05, 1.05, y, y + 0.85, -0.02, o, LODGE_PAINT.sign, P.snow);
  const face = o + 0.012;
  const n: V3 = [w.nx, 0, w.nz];
  const q = (u0: number, y0: number, u1: number, y1: number, c: THREE.Color): void =>
    s.quad(
      [w.x + w.ux * u0, y0, w.z + w.uz * u0 + w.nz * face],
      [w.x + w.ux * u1, y0, w.z + w.uz * u1 + w.nz * face],
      [w.x + w.ux * u1, y1, w.z + w.uz * u1 + w.nz * face],
      [w.x + w.ux * u0, y1, w.z + w.uz * u0 + w.nz * face],
      c,
      n,
    );
  s.mark("glow", 1);
  q(-0.24, y + 0.12, 0.2, y + 0.58, LODGE_PAINT.beer);
  q(-0.29, y + 0.56, 0.25, y + 0.72, LODGE_PAINT.foam);
  q(-0.12, y + 0.48, 0.0, y + 0.62, LODGE_PAINT.foam);
  q(0.2, y + 0.24, 0.36, y + 0.3, LODGE_PAINT.beer);
  q(0.3, y + 0.24, 0.36, y + 0.5, LODGE_PAINT.beer);
  q(0.2, y + 0.44, 0.36, y + 0.5, LODGE_PAINT.beer);
  s.mark("glow", 0);
}

/** THE TERRACE: the deck, its railing, the tables and parasols and the
 * string lights, out across the front of a lodge `W` wide and `D` deep. */
function terrace(s: Shape, roof: Roof, lod: CabinLod): void {
  const d = CABINS.afterski;
  const W = d.width;
  const D = d.depth;
  const x = W / 2 + DECK_END;
  const z0 = D / 2;
  const z1 = D / 2 + TERRACE;
  box(s, -x, DECK.top - DECK.thick, z0, x, DECK.top, z1, P.board[1], P.board[0]);
  if (lod === 0) {
    // The deck's boards, a dark line between each.
    for (let zz = z0 + 0.3; zz < z1; zz += 0.3) {
      s.quad(
        [-x, DECK.top + 0.004, zz + 0.02],
        [x, DECK.top + 0.004, zz + 0.02],
        [x, DECK.top + 0.004, zz - 0.02],
        [-x, DECK.top + 0.004, zz - 0.02],
        P.board[1].clone().multiplyScalar(0.75),
        [0, 1, 0],
      );
    }
  }
  // THE RAILING: the front in two runs either side of the steps, and the
  // two ends; posts every couple of metres, a top rail with snow on it.
  const front: Wall = { x: 0, z: z1 - 0.06, ux: 1, uz: 0, nx: 0, nz: 1 };
  const ends: Wall[] = [
    { x, z: (z0 + z1) / 2, ux: 0, uz: -1, nx: 1, nz: 0 },
    { x: -x, z: (z0 + z1) / 2, ux: 0, uz: 1, nx: -1, nz: 0 },
  ];
  const y = DECK.top;
  const rail = (w: Wall, u0: number, u1: number): void => {
    wallBox(s, w, u0, u1, y + 0.92, y + 1.02, -0.06, 0.02, P.log[1], P.snow);
    wallBox(s, w, u0, u1, y + 0.42, y + 0.5, -0.05, 0.01, P.log[2]);
    const n = Math.max(1, Math.round((u1 - u0) / (lod ? 3 : 1.6)));
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n;
      wallBox(s, w, u - 0.06, u + 0.06, y, y + 1.0, -0.08, 0.04, P.log[0]);
    }
  };
  rail(front, -x, -GAP);
  rail(front, GAP, x);
  for (const w of ends) rail(w, -TERRACE / 2, TERRACE / 2 - 0.05);
  // THE TABLES, in two rows either side of the way in, two under parasols.
  for (const tz of T.z) {
    for (const tx of T.x) table(s, tx, z0 + tz, lod);
  }
  parasol(s, T.x[1], z0 + T.z[1], lod);
  parasol(s, T.x[3], z0 + T.z[0], lod);
  // THE STRING LIGHTS: from under the eave out to the corner posts and
  // the posts by the steps, and along the front rail.
  const eave = roof.plate - 0.15;
  const tops: V3[] = [
    [-x + 0.06, y + 2.3, z1 - 0.06],
    [-GAP, y + 2.3, z1 - 0.06],
    [GAP, y + 2.3, z1 - 0.06],
    [x - 0.06, y + 2.3, z1 - 0.06],
  ];
  // Two tall posts at the corners and two by the steps carry them.
  for (const t of tops)
    s.tube([t[0], y, t[2]], [t[0], t[1], t[2]], 0.06, 0.05, lod ? 4 : 5, P.log[1]);
  const under: V3[] = [
    [-W / 2 + 0.4, eave, z0 + 0.25],
    [-1.6, eave, z0 + 0.25],
    [1.6, eave, z0 + 0.25],
    [W / 2 - 0.4, eave, z0 + 0.25],
  ];
  tops.forEach((t, i) => swag(s, under[i], t, 0.55, lod, i));
  swag(s, tops[0], tops[1], 0.35, lod, 5);
  swag(s, tops[2], tops[3], 0.35, lod, 7);
  swag(s, under[0], under[3], 0.25, lod, 2);
}

/** THE LODGE'S PLAN: `roofOf` is `cabin-shapes.ts`'s (a roof whose ridge
 * runs along x here). */
export function lodgePlan(
  roofOf: (
    ridge: "z" | "x",
    a0: number,
    a1: number,
    span: number,
    plate: number,
    top: number,
    eave: number,
  ) => Roof,
): Plan {
  const d = CABINS.afterski;
  const W = d.width;
  const D = d.depth;
  const roof = roofOf(
    "x",
    -W / 2 - d.reach.side,
    W / 2 + d.reach.side,
    D / 2,
    d.walls,
    d.ridge,
    1.2,
  );
  const win = (
    wall: Plan["holes"][number]["wall"],
    u: number,
    w = 1.25,
  ): Plan["holes"][number] => ({
    wall,
    u,
    w,
    y0: 0.75,
    y1: 2.55,
  });
  const front: Wall = { x: 0, z: D / 2, ux: 1, uz: 0, nx: 0, nz: 1 };
  return {
    roof,
    ridge: "x",
    log: 0.17,
    logs: [0, d.walls],
    holes: [
      { wall: "front", u: -0.48, w: 0.9, y0: 0, y1: 2.3, door: true },
      { wall: "front", u: 0.48, w: 0.9, y0: 0, y1: 2.3, door: true },
      win("front", -2.7),
      win("front", -5.1),
      win("front", 2.7),
      win("front", 5.1),
      win("back", -4.2),
      win("back", 0),
      win("back", 4.2),
      win("left", -1.9),
      win("left", 1.9),
      win("right", -1.9),
      win("right", 1.9),
      { wall: "left", u: 0, w: 0.9, y0: d.walls + 0.5, y1: d.walls + 1.5 },
      { wall: "right", u: 0, w: 0.9, y0: d.walls + 0.5, y1: d.walls + 1.5 },
    ],
    shutter: P.shutter[1],
    snow: 0.46,
    extras: (s, lod) => {
      terrace(s, roof, lod);
      sign(s, front, 2.6);
      chimney(s, -3.6, -2.9, -1.8, -1.1, roofUnder(roof, 1.1) - 0.1, d.ridge + 0.75, 11);
      if (lod === 0)
        chimney(s, 3.9, 4.5, -2.4, -1.8, roofUnder(roof, 1.8) - 0.1, d.ridge + 0.55, 12);
    },
  };
}
