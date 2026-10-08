// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABINS, BUILT — every kind of log building the ski area keeps beside
// its runs (`defs/cabins.ts`), PROCEDURALLY, out of `cabin-parts.ts`'s
// pieces, at two cuts: the NEAR (every log, notch, pane and stone) and the
// FAR (the same silhouette as a handful of faces, its windows still lit at
// night). The measure is the engine's table; nothing here restates it.
//
// HOW A MOUNTAIN LOG CABIN IS BUILT, and so how this one is:
//   * THE WALLS are round logs laid in courses on a stone plinth, the two
//     walls of a corner half a course apart so each log rides in a SADDLE
//     NOTCH cut in the one under it, and every log runs on past the corner
//     so its sawn end shows — the crossed, stepped corner that is the first
//     thing an eye reads a log building by. The courses sit on their flats
//     with a pale line of CHINKING between them.
//   * THE GABLES are logged up to the roof, each course shorter than the
//     one under it, and the PURLINS — the logs the roof boards rest on —
//     run through them and out under the verges, their ends showing.
//   * THE ROOF is steep on a cabin that sheds its snow and shallow on a
//     chalet that keeps it, its eaves well out past the walls; the SNOW lies
//     on it as a blanket a third of a metre or more thick, curled over the
//     eave and cut square at the verge.
//   * THE OPENINGS are small (logs are short of span and the winter is
//     long): a casing, a cross of mullions, a sill with snow along it and
//     shutters folded back; a plank door with its ledges; and a porch or a
//     balcony to stand out of the snow on.
//   * THE CHIMNEY is stone: a stack through the roof, or on the cabin a
//     great stack built up outside its gable from the ground.
//   * THE PLINTH is dressed stone, a course or two above the snow: a
//     building on a slope is dug into it at the back and shows no more
//     than a metre of stone on the low side, and the snow is banked up
//     against it all round (the drift, `cabins-view.ts`) — so it sits IN
//     the snow, never up on a pedestal.
//
// THE FRAME is the building's: x across its front, y up from its floor, z
// toward its front (`defs/cabins.ts`).

import * as THREE from "three";

import { CABINS, type CabinKind } from "@engine";

import {
  CABIN_PAINT as P,
  box,
  cabinBench,
  chimney,
  doorIn,
  face,
  gableRoof,
  laid,
  logBar,
  roofSnow,
  roofUnder,
  stoneFace,
  wallBox,
  wallFace,
  wallsOf,
  windowIn,
  woodStack,
  type Opening,
  type Roof,
  type Wall,
} from "./cabin-parts.ts";
import { FACADE, type FacadeLayer } from "./facade-paint.ts";
import { DECK, TERRACE, lodgePlan } from "./lodge-shapes.ts";
import type { Shape, V3 } from "./tree-mesh.ts";

/** The two cuts: every log, or the silhouette. */
export type CabinLod = 0 | 1;

/** How far the plinth reaches down, m — past the most stone a site shows
 * (`CABIN_LAYOUT.plinth.most`), so no building ever floats. */
const PLINTH = 1.5;

/** A window or a door on a wall, by the wall's name. */
export type Hole = {
  wall: "front" | "back" | "left" | "right";
  u: number;
  w: number;
  y0: number;
  y1: number;
  door?: boolean;
};

/** One kind as built: its roof, the log radius and where the logs run,
 * its openings, and its extras. */
export type Plan = {
  roof: Roof;
  /** Which way the ridge runs: along z (the gable to the front) or x. */
  ridge: "z" | "x";
  /** The logs' radius, and the heights the log walls run between. */
  log: number;
  logs: [number, number];
  holes: Hole[];
  shutter: THREE.Color | null;
  snow: number;
  extras: (s: Shape, lod: CabinLod) => void;
};

/** A roof whose ridge runs along z (the gable to the front) or x. */
function roofOf(
  ridge: "z" | "x",
  a0: number,
  a1: number,
  span: number,
  plate: number,
  top: number,
  eave: number,
): Roof {
  const t = 0.16;
  return {
    a0,
    a1,
    span,
    plate,
    ridge: top - t,
    eave,
    t,
    at: ridge === "z" ? (a, b, y) => [b, y, a] : (a, b, y) => [a, y, b],
  };
}

function planOf(kind: CabinKind): Plan {
  const d = CABINS[kind];
  const W = d.width;
  const D = d.depth;
  if (kind === "afterski") return lodgePlan(roofOf);
  if (kind === "hut") {
    const roof = roofOf(
      "z",
      -D / 2 - d.reach.back,
      D / 2 + d.reach.front,
      W / 2,
      d.walls,
      d.ridge,
      d.reach.side,
    );
    return {
      roof,
      ridge: "z",
      log: 0.15,
      logs: [0, d.walls],
      holes: [
        { wall: "front", u: 0, w: 0.9, y0: 0, y1: 1.9, door: true },
        { wall: "front", u: 1.35, w: 0.55, y0: 1.0, y1: 1.65 },
        { wall: "front", u: 0, w: 0.5, y0: 2.75, y1: 3.25 },
        { wall: "right", u: 0.4, w: 0.6, y0: 1.0, y1: 1.7 },
        { wall: "left", u: 0.7, w: 0.6, y0: 1.0, y1: 1.7 },
        { wall: "back", u: 0, w: 0.45, y0: 2.75, y1: 3.2 },
      ],
      shutter: P.shutter[0],
      snow: 0.36,
      extras: (s, lod) => {
        // The covered entry: the deck under the roof run on past the
        // gable, its step, and the two posts that carry the roof's end.
        const z0 = D / 2;
        const z1 = D / 2 + d.reach.front - 0.1;
        box(
          s,
          -W / 2,
          -0.22,
          z0,
          W / 2,
          0,
          z1,
          P.board[1],
          P.board[0],
          ["y-"],
          FACADE.timber,
          FACADE.boards,
        );
        box(
          s,
          -0.7,
          -0.5,
          z1,
          0.7,
          -0.26,
          z1 + 0.35,
          P.board[1],
          P.board[0],
          ["y-"],
          FACADE.timber,
          FACADE.boards,
        );
        for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) {
          const top = roofUnder(roof, Math.abs(x));
          s.tube([x, 0, z1 - 0.12], [x, top, z1 - 0.12], 0.09, 0.08, lod ? 4 : 6, P.log[0]);
        }
        chimney(s, -1.25, -0.7, -1.6, -1.05, roofUnder(roof, 1.25) - 0.1, d.ridge + 0.55);
        woodStack(s, wallsOf(W, D).right, -2.3, 0.0, 1.3, 0.42);
      },
    };
  }
  if (kind === "cabin") {
    const roof = roofOf("x", -W / 2 - 0.6, W / 2 + 0.6, D / 2, d.walls, d.ridge, d.reach.back);
    // The porch's lean-to, from under the main eave down over the deck.
    const porch: Roof = {
      a0: -W / 2 + 0.1,
      a1: W / 2 - 0.1,
      span: d.reach.front,
      plate: 2.0,
      ridge: 2.42,
      eave: 0.12,
      t: 0.12,
      at: (a, b, y) => [a, y, D / 2 + b],
    };
    return {
      roof,
      ridge: "x",
      log: 0.16,
      logs: [0, d.walls],
      holes: [
        { wall: "front", u: 0, w: 0.95, y0: 0, y1: 2.0, door: true },
        { wall: "front", u: -2.3, w: 0.7, y0: 1.0, y1: 1.85 },
        { wall: "front", u: 2.3, w: 0.7, y0: 1.0, y1: 1.85 },
        { wall: "back", u: -1.8, w: 0.7, y0: 1.0, y1: 1.85 },
        { wall: "back", u: 1.8, w: 0.7, y0: 1.0, y1: 1.85 },
        { wall: "right", u: 0, w: 0.7, y0: 1.0, y1: 1.85 },
        { wall: "right", u: 0, w: 0.55, y0: 3.55, y1: 4.15 },
        { wall: "left", u: 1.0, w: 0.55, y0: 3.55, y1: 4.15 },
      ],
      shutter: P.shutter[1],
      snow: 0.38,
      extras: (s, lod) => {
        gableRoof(s, porch, [1]);
        roofSnow(s, porch, 0.28, lod ? 1 : 2, 11, [1], true);
        const z1 = D / 2 + d.reach.front - 0.15;
        box(
          s,
          -W / 2 - 0.1,
          -0.22,
          D / 2,
          W / 2 + 0.1,
          0,
          z1 + 0.1,
          P.board[1],
          P.board[0],
          ["y-"],
          FACADE.timber,
          FACADE.boards,
        );
        box(
          s,
          -0.8,
          -0.5,
          z1 + 0.1,
          0.8,
          -0.26,
          z1 + 0.45,
          P.board[1],
          P.board[0],
          ["y-"],
          FACADE.timber,
          FACADE.boards,
        );
        for (const x of [-W / 2 + 0.2, -1.2, 1.2, W / 2 - 0.2]) {
          const top = roofUnder(porch, z1 - D / 2);
          s.tube([x, 0, z1 - 0.1], [x, top, z1 - 0.1], 0.1, 0.09, lod ? 4 : 6, P.log[0]);
        }
        // The great stack up the left gable, from the ground: broad to its
        // shoulder, then the flue to above the ridge.
        const x0 = -W / 2 - 0.85;
        const x1 = -W / 2 - 0.02;
        chimney(s, x0, x1, -1.7, -0.3, -PLINTH, 2.3);
        chimney(s, x0 + 0.12, x1 - 0.12, -1.35, -0.65, 2.3, d.ridge + 0.75);
        woodStack(s, wallsOf(W, D).right, 0.75, 2.45, 1.35, 0.42);
      },
    };
  }
  if (kind === "chalet") {
    const roof = roofOf(
      "z",
      -D / 2 - d.reach.back,
      D / 2 + d.reach.front,
      W / 2,
      d.walls,
      d.ridge,
      d.reach.side,
    );
    const floor = 2.5;
    return {
      roof,
      ridge: "z",
      log: 0.15,
      logs: [floor, d.walls],
      holes: [
        { wall: "front", u: -1.6, w: 0.95, y0: 0, y1: 2.05, door: true },
        { wall: "front", u: 0.6, w: 0.75, y0: 0.9, y1: 1.8 },
        { wall: "front", u: 2.2, w: 0.75, y0: 0.9, y1: 1.8 },
        { wall: "back", u: 0, w: 0.75, y0: 0.9, y1: 1.8 },
        { wall: "left", u: -1.8, w: 0.75, y0: 0.9, y1: 1.8 },
        { wall: "left", u: 1.8, w: 0.75, y0: 0.9, y1: 1.8 },
        { wall: "right", u: -1.8, w: 0.75, y0: 0.9, y1: 1.8 },
        { wall: "right", u: 1.8, w: 0.75, y0: 0.9, y1: 1.8 },
        { wall: "front", u: 0, w: 0.9, y0: floor + 0.15, y1: floor + 2.05, door: true },
        { wall: "front", u: -2.1, w: 0.7, y0: floor + 0.75, y1: floor + 1.6 },
        { wall: "front", u: 2.1, w: 0.7, y0: floor + 0.75, y1: floor + 1.6 },
        { wall: "left", u: -1.8, w: 0.7, y0: floor + 0.75, y1: floor + 1.6 },
        { wall: "left", u: 1.8, w: 0.7, y0: floor + 0.75, y1: floor + 1.6 },
        { wall: "right", u: -1.8, w: 0.7, y0: floor + 0.75, y1: floor + 1.6 },
        { wall: "right", u: 1.8, w: 0.7, y0: floor + 0.75, y1: floor + 1.6 },
        { wall: "back", u: 0, w: 0.7, y0: floor + 0.75, y1: floor + 1.6 },
        { wall: "front", u: 0, w: 0.5, y0: d.walls + 0.3, y1: d.walls + 0.85 },
      ],
      shutter: P.shutter[0],
      snow: 0.5,
      extras: (s) => {
        // The rendered stone floor, its corners laid in quoins.
        const walls = wallsOf(W, D);
        for (const [name, wall] of Object.entries(walls)) {
          const half = name === "front" || name === "back" ? W / 2 : D / 2;
          const holes = planHoles("chalet").filter((h) => h.wall === name && h.y1 <= floor);
          plate(s, wall, -half, half, 0, floor, 0, holes, P.white, FACADE.render);
          // The quoins: a strip of long and short stones up each corner, the
          // courses of one face against the other's half a pair up.
          const lift = name === "front" || name === "back" ? 0 : 0.5;
          const pair = floor / 3;
          for (const k of [-1, 1]) {
            const ua = k < 0 ? -half : half;
            const ub = ua - k * 0.6;
            face(
              s,
              on(wall, k < 0 ? ua : ub, 0, 0.025),
              on(wall, k < 0 ? ub : ua, 0, 0.025),
              on(wall, k < 0 ? ub : ua, floor, 0.025),
              on(wall, k < 0 ? ua : ub, floor, 0.025),
              k < 0
                ? [
                    [0, lift],
                    [1, lift],
                    [1, lift + floor / pair],
                    [0, lift + floor / pair],
                  ]
                : [
                    [1, lift],
                    [0, lift],
                    [0, lift + floor / pair],
                    [1, lift + floor / pair],
                  ],
              FACADE.quoins,
              P.white,
              [wall.nx, 0, wall.nz],
            );
          }
          // The floor's beam the logs stand on.
          wallBox(s, wall, -half - 0.05, half + 0.05, floor - 0.12, floor, -0.1, 0.06, P.log[1]);
        }
        // The balcony across the front gable, under the roof's run.
        const z0 = D / 2;
        const z1 = D / 2 + 1.35;
        const x = W / 2 + 0.25;
        box(
          s,
          -x,
          floor - 0.16,
          z0,
          x,
          floor,
          z1,
          P.board[1],
          P.board[0],
          ["y-"],
          FACADE.timber,
          FACADE.boards,
        );
        const rail: Wall[] = [
          { x: 0, z: z1, ux: 1, uz: 0, nx: 0, nz: 1 },
          { x: x, z: (z0 + z1) / 2, ux: 0, uz: -1, nx: 1, nz: 0 },
          { x: -x, z: (z0 + z1) / 2, ux: 0, uz: 1, nx: -1, nz: 0 },
        ];
        rail.forEach((w, i) => {
          const half = i === 0 ? x : (z1 - z0) / 2;
          wallBox(
            s,
            w,
            -half,
            half,
            floor + 0.95,
            floor + 1.05,
            -0.06,
            0.02,
            P.board[0],
            P.snow,
            FACADE.timber,
          );
          wallBox(
            s,
            w,
            -half,
            half,
            floor + 0.05,
            floor + 0.13,
            -0.05,
            0.01,
            P.board[1],
            P.board[1],
            FACADE.timber,
          );
          // The cut boards between, close set, a shape sawn out of every
          // other joint: painted on the panel's two faces.
          const n = Math.round((2 * half) / 1.04);
          for (const [o, sg] of [
            [-0.02, 1],
            [-0.05, -1],
          ] as const) {
            const ua = sg > 0 ? -half : half;
            const ub = -ua;
            face(
              s,
              on(w, ua, floor + 0.13, o),
              on(w, ub, floor + 0.13, o),
              on(w, ub, floor + 0.95, o),
              on(w, ua, floor + 0.95, o),
              [
                [0, 0],
                [n, 0],
                [n, 1],
                [0, 1],
              ],
              FACADE.balustrade,
              P.board[i % 2],
              [w.nx * sg, 0, w.nz * sg],
            );
          }
        });
        for (const xx of [-x + 0.2, x - 0.2]) {
          s.tube([xx, floor - 1.0, z0], [xx, floor - 0.12, z1 - 0.1], 0.07, 0.07, 4, P.log[1]);
        }
        chimney(s, 0.8, 1.45, -2.6, -1.95, roofUnder(roof, 0.8) - 0.1, d.ridge + 0.85);
      },
    };
  }
  // THE WOODSHED: boards on three sides under a lean-to, open to the front
  // and stacked with firewood.
  const roof: Roof = {
    a0: -W / 2 - d.reach.side,
    a1: W / 2 + d.reach.side,
    span: D + d.reach.front,
    plate: 1.6,
    ridge: d.walls + d.reach.front * ((d.walls - 1.6) / D),
    eave: d.reach.back,
    t: 0.1,
    at: (a, b, y) => [a, y, D / 2 + d.reach.front - b],
  };
  return {
    roof,
    ridge: "x",
    log: 0,
    logs: [0, 0],
    holes: [],
    shutter: null,
    snow: 0.3,
    extras: (s, lod) => {
      const hi = d.walls;
      const lo = 1.6;
      const yAt = (z: number): number => lo + ((z + D / 2) / D) * (hi - lo);
      // The walls' boards, painted: one face a wall, its top along the
      // roof's fall.
      const boards = (x0: number, z0: number, x1: number, z1: number, out: V3): void => {
        const L = Math.hypot(x1 - x0, z1 - z0) / 2.4;
        face(
          s,
          [x0, 0, z0],
          [x1, 0, z1],
          [x1, yAt(z1), z1],
          [x0, yAt(z0), z0],
          [
            [0, 0],
            [L, 0],
            [L, yAt(z1) / 2.4],
            [0, yAt(z0) / 2.4],
          ],
          FACADE.boards,
          P.white,
          out,
        );
      };
      boards(W / 2, -D / 2, -W / 2, -D / 2, [0, 0, -1]);
      boards(-W / 2, -D / 2, -W / 2, D / 2, [-1, 0, 0]);
      boards(W / 2, D / 2, W / 2, -D / 2, [1, 0, 0]);
      for (const [x, z] of [
        [-W / 2, D / 2],
        [W / 2, D / 2],
      ]) {
        box(s, x - 0.07, 0, z - 0.14, x + 0.07, hi, z, P.log[1], P.log[1], ["y-"], FACADE.timber);
      }
      box(
        s,
        -W / 2,
        hi - 0.16,
        D / 2 - 0.14,
        W / 2,
        hi,
        D / 2,
        P.log[1],
        P.log[1],
        ["y-"],
        FACADE.timber,
      );
      const front: Wall = { x: 0, z: D / 2 - 0.2, ux: 1, uz: 0, nx: 0, nz: 1 };
      woodStack(s, front, -W / 2 + 0.12, W / 2 - 0.12, 1.55, D - 0.5, -(D - 0.5));
      gableRoof(s, roof, [1]);
      roofSnow(s, roof, 0.3, lod ? 1 : 2, 17, [1], true);
    },
  };
}

/** Every window and door of a kind. */
function planHoles(kind: CabinKind): Hole[] {
  return planOf(kind).holes;
}

/** A point on a wall (`cabin-parts.ts`'s `on`, restated short). */
function on(w: Wall, u: number, y: number, o: number): V3 {
  return [w.x + w.ux * u + w.nx * o, y, w.z + w.uz * u + w.nz * o];
}

/** A flat face of a wall from `u0..u1` × `y0..y1` at `o`, cut round its
 * openings: the chinking behind the logs, or a chalet's render. */
function plate(
  s: Shape,
  w: Wall,
  u0: number,
  u1: number,
  y0: number,
  y1: number,
  o: number,
  holes: readonly Hole[],
  c: THREE.Color,
  layer: FacadeLayer = FACADE.matte,
): void {
  const n: V3 = [w.nx, 0, w.nz];
  const q = (a: number, b: number, ya: number, yb: number): void => {
    if (b - a < 1e-3 || yb - ya < 1e-3) return;
    laid(s, on(w, a, ya, o), on(w, b, ya, o), on(w, b, yb, o), on(w, a, yb, o), layer, c, n, a, ya);
  };
  const cut = holes
    .filter((h) => h.y1 > y0 && h.y0 < y1)
    .map((h) => ({
      a: h.u - h.w / 2,
      b: h.u + h.w / 2,
      ya: Math.max(y0, h.y0),
      yb: Math.min(y1, h.y1),
    }))
    .sort((p, r) => p.a - r.a);
  let u = u0;
  for (const h of cut) {
    q(u, h.a, y0, y1);
    q(h.a, h.b, y0, h.ya);
    q(h.a, h.b, h.yb, y1);
    u = h.b;
  }
  q(u, u1, y0, y1);
}

/** THE LOG WALLS of a footprint, the gables logged up under the roof, and
 * the purlins out through them. */
function logWalls(s: Shape, kind: CabinKind, plan: Plan): void {
  const d = CABINS[kind];
  const W = d.width;
  const D = d.depth;
  const r = plan.log;
  const [y0, y1] = plan.logs;
  const pitch = r * 1.732 + 0.028;
  const ov = 0.32 + r;
  const walls = wallsOf(W, D);
  const roof = plan.roof;
  const half = { front: W / 2, back: W / 2, left: D / 2, right: D / 2 } as const;
  // The walls the ridge runs ACROSS carry the gables.
  const gable = (name: keyof typeof half): boolean =>
    plan.ridge === "z" ? name === "front" || name === "back" : name === "left" || name === "right";
  let seed = 0;
  for (const name of ["front", "back", "left", "right"] as const) {
    const w = walls[name];
    const L = half[name];
    // Front and back courses at the half pitch, the sides a half course up.
    const lift = name === "front" || name === "back" ? 0.5 : 1;
    const holes = plan.holes.filter((h) => h.wall === name);
    const top = gable(name) ? roof.ridge : y1;
    plate(s, w, -L, L, y0, Math.min(y1 + 0.05, top), -r * 0.55, holes, P.chink);
    // The chinking under a gable's courses, up to the ridge.
    if (gable(name)) {
      s.tri(
        on(w, -L, y1, -r * 0.55),
        on(w, L, y1, -r * 0.55),
        on(w, 0, roof.ridge, -r * 0.55),
        P.chink,
        [w.nx, 0, w.nz],
      );
    }
    for (let k = 0; ; k++) {
      const y = y0 + pitch * (k + lift);
      if (y + r * 0.866 > top) break;
      let a = -L - ov;
      let b = L + ov;
      let caps = true;
      if (y > y1 - r * 0.5) {
        // A gable course: as long as the roof over it lets it be, sawn
        // under the boards.
        if (!gable(name)) break;
        const reach = (roof.span * (roof.ridge - (y + r * 0.866))) / (roof.ridge - roof.plate);
        if (reach < 0.25) break;
        a = -Math.min(L, reach);
        b = Math.min(L, reach);
        caps = false;
      }
      const o = -r;
      const tone = P.log[(k + seed++) % 3];
      const col = k === 0 ? P.logLow : tone;
      // Cut round the openings this course passes.
      const spans: [number, number][] = [];
      let u = a;
      for (const h of holes
        .filter((hh) => hh.y0 < y + r * 0.5 && hh.y1 > y - r * 0.5)
        .sort((p, q) => p.u - q.u)) {
        spans.push([u, h.u - h.w / 2 - 0.02]);
        u = h.u + h.w / 2 + 0.02;
      }
      spans.push([u, b]);
      // The top's flat is drawn only where no full course sits on it.
      const next = y + pitch;
      const flat = !(next <= y1 - r * 0.5 && next + r * 0.866 <= top);
      for (const [ua, ub] of spans) {
        if (ub - ua < 0.05) continue;
        logBar(
          s,
          on(w, ua, y, o),
          on(w, ub, y, o),
          r,
          col,
          caps && ua === a,
          caps && ub === b,
          flat,
        );
      }
    }
  }
  // The purlins and the ridge log, out to the verges.
  for (const b of [-roof.span * 0.5, 0, roof.span * 0.5]) {
    const y = roofUnder(roof, b) - r * 0.85;
    logBar(
      s,
      roof.at(roof.a0 + 0.05, b, y),
      roof.at(roof.a1 - 0.05, b, y),
      r * 0.95,
      P.log[1],
      true,
      true,
    );
  }
}

/** How far a kind's deck runs out past its front wall, m: a porch's, a
 * lodge's terrace, or none. */
export function porchOf(kind: CabinKind): number {
  const d = CABINS[kind];
  if (kind === "afterski") return TERRACE;
  return kind === "hut" ? d.reach.front - 0.1 : kind === "cabin" ? d.reach.front - 0.05 : 0;
}

/** THE PLINTH: dressed stone round the footprint (and under a porch's
 * deck), carried down past any terrace. */
function plinth(s: Shape, kind: CabinKind): void {
  const d = CABINS[kind];
  const W = d.width + 0.12 + (kind === "afterski" ? 1.2 : 0);
  const front = porchOf(kind);
  const D = d.depth + 0.12 + front;
  // A lodge's site may fall further under its terrace: its stone runs down
  // the deeper.
  const deep = kind === "afterski" ? PLINTH + 2 : PLINTH;
  const cz = front / 2;
  const walls: Wall[] = [
    { x: 0, z: cz + D / 2, ux: 1, uz: 0, nx: 0, nz: 1 },
    { x: 0, z: cz - D / 2, ux: -1, uz: 0, nx: 0, nz: -1 },
    { x: W / 2, z: cz, ux: 0, uz: -1, nx: 1, nz: 0 },
    { x: -W / 2, z: cz, ux: 0, uz: 1, nx: -1, nz: 0 },
  ];
  walls.forEach((w, i) => {
    const half = i < 2 ? W / 2 : D / 2;
    const top = front > 0 ? (kind === "afterski" ? DECK.top - DECK.thick : -0.22) : 0;
    stoneFace(s, w, -half, half, -deep, top, 0);
  });
}

/** THE FAR CUT's walls: each one flat face painted as its courses of logs
 * (`FACADE.logWall`, the courses where the near cut's lie), and its
 * openings painted on it — the casements lit at night, their shutters
 * beside them, the plank doors. */
function farWalls(s: Shape, kind: CabinKind, plan: Plan): void {
  const d = CABINS[kind];
  const walls = wallsOf(d.width, d.depth);
  const half = { front: d.width / 2, back: d.width / 2, left: d.depth / 2, right: d.depth / 2 };
  const roof = plan.roof;
  const pitch = plan.log * 1.732 + 0.028;
  const [y0, y1] = plan.logs;
  for (const name of ["front", "back", "left", "right"] as const) {
    const w = walls[name];
    const L = half[name];
    const n: V3 = [w.nx, 0, w.nz];
    // The courses: four to the tile, centred where the near cut's are.
    const lift = name === "front" || name === "back" ? 0 : 0.5;
    const uv = (u: number, y: number): [number, number] => [
      (u + L) / 3,
      ((y - y0) / pitch - lift) / 4,
    ];
    const gable =
      plan.ridge === "z"
        ? name === "front" || name === "back"
        : name === "left" || name === "right";
    const p = (u: number, y: number): V3 => on(w, u, y, 0);
    face(
      s,
      p(-L, y0),
      p(L, y0),
      p(L, y1),
      p(-L, y1),
      [uv(-L, y0), uv(L, y0), uv(L, y1), uv(-L, y1)],
      FACADE.logWall,
      P.white,
      n,
    );
    if (gable) {
      face(
        s,
        p(-L, y1),
        p(L, y1),
        p(0, roof.ridge),
        p(0, roof.ridge),
        [uv(-L, y1), uv(L, y1), uv(0, roof.ridge), uv(0, roof.ridge)],
        FACADE.logWall,
        P.white,
        n,
      );
    }
    for (const h of plan.holes.filter((hh) => hh.wall === name)) {
      const u0 = h.u - h.w / 2;
      const u1 = h.u + h.w / 2;
      if (h.door) {
        wallFace(s, w, u0, u1, h.y0, h.y1, 0.02, FACADE.plankDoor, P.white);
        continue;
      }
      s.mark("glow", 1);
      wallFace(
        s,
        w,
        u0 - 0.09,
        u1 + 0.09,
        h.y0 - 0.09,
        h.y1 + 0.09,
        0.03,
        FACADE.casement,
        P.white,
      );
      s.mark("glow", 0);
      if (plan.shutter) {
        const sw = (u1 - u0) / 2 + 0.04;
        wallFace(
          s,
          w,
          u0 - 0.1 - sw,
          u0 - 0.1,
          h.y0 - 0.04,
          h.y1 + 0.04,
          0.06,
          FACADE.boardShutter,
          plan.shutter,
        );
        wallFace(
          s,
          w,
          u1 + 0.1,
          u1 + 0.1 + sw,
          h.y0 - 0.04,
          h.y1 + 0.04,
          0.06,
          FACADE.boardShutter,
          plan.shutter,
        );
      }
    }
  }
}

/** THE BUILDING of `kind` at `lod`, in its own frame. */
export function buildCabin(kind: CabinKind, lod: CabinLod = 0): THREE.BufferGeometry {
  const s = cabinBench();
  const plan = planOf(kind);
  const d = CABINS[kind];
  const walls = wallsOf(d.width, d.depth);
  plinth(s, kind);
  if (plan.log > 0) {
    if (lod === 0) {
      logWalls(s, kind, plan);
      for (const h of plan.holes) {
        const op: Opening = {
          wall: walls[h.wall],
          u0: h.u - h.w / 2,
          u1: h.u + h.w / 2,
          y0: h.y0,
          y1: h.y1,
        };
        if (h.door) doorIn(s, op);
        else windowIn(s, op, plan.shutter);
      }
    } else {
      farWalls(s, kind, plan);
    }
  }
  plan.extras(s, lod);
  if (kind !== "shed") {
    gableRoof(s, plan.roof);
    roofSnow(s, plan.roof, plan.snow, lod ? 1 : 3, kind.length);
  }
  return s.geometry();
}

/** How many triangles each kind's cut is: the budget the lab prints. */
export function cabinTriangles(kind: CabinKind, lod: CabinLod): number {
  const g = buildCabin(kind, lod);
  const n = g.getAttribute("position").count / 3;
  g.dispose();
  return n;
}
