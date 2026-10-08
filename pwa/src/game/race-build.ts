// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START'S BUILDINGS, BUILT — on the facade kit (`facade-kit.ts`), in
// the materials the real ones are built of (`docs/buildings.md`):
//
//   * THE START HUT at the top of every piste with no race's house over it:
//     the timer's hut a club race and a training course keep beside the
//     start — a timber box of vertical boards on a concrete footing, a
//     sliding window over a counter onto the piste, a ledged door at its
//     downhill end, a gable roof under snow and a stovepipe through it.
//   * A RACE'S START HOUSE (`start-house-plan.ts` says where and how big):
//     the walls and roof of the house over the top of the course — a timber
//     house standing on the slope, its back up the hill, a window in each
//     flank where the referee looks down the ramp, light boards inside and
//     a flat roof under a blanket of snow; across its front the tall
//     BILLBOARD WALL, panelled, wider than the house and braced behind its
//     wings by scaffold tubes; out of the door the START RAMP between two
//     low kickboards; and the TIMING BOX on the wand's post. The printed
//     faces (the band, the boards), the wand and the start clock are
//     `start-house.ts`'s.
//
// Three-free: the arrays are made a mesh by `facade-mesh.ts`.

import type { Level } from "@engine";

import { FACADE } from "./facade-paint.ts";
import { FacadeKit, type Tint, type V3 } from "./facade-kit.ts";
import { HOUSE } from "./start-house-plan.ts";

/** THE START HUT, m: its footprint and height, and where it stands — off
 * the line's left edge, `out` past the gate's edge and `ahead` down it. */
export const HUT = { width: 2.4, depth: 2.2, height: 2.1, out: 2.5, ahead: 1.5 };

/** The tints, sRGB: white leaves a layer as painted. */
const T = {
  as: 0xffffff,
  /** A ledged door, dark-stained; a frame's and a counter's dark timber. */
  door: 0x5a3c26,
  trim: 0x4a3524,
  /** The boards inside, unweathered. */
  inside: 0xe8dcc8,
  /** The roofs' standing seam, anthracite. */
  roof: 0x6a7076,
  /** The billboard's panels, the woods' green, and its back. */
  panel: 0x2f5a3c,
  back: 0xc9c4ba,
  /** The dark of a doorway and the timing box's housing. */
  dark: 0x1d2024,
  box: 0x3a3f46,
} as const;

const ROOF = { layer: FACADE.roof, tint: T.roof };
const BOARDS = { layer: FACADE.boards, tint: T.as };
const FASCIA = { layer: FACADE.boards, tint: 0xb89a7a };

/** A STRUT: a square tube of `r` from a to b in the kit's frame, its four
 * faces turned out — a scaffold tube, a brace, a rail. */
export function strut(
  kit: FacadeKit,
  a: V3,
  b: V3,
  r: number,
  layer = FACADE.steel,
  tint: Tint = T.as,
): void {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(d[0], d[1], d[2]);
  if (l < 1e-6) return;
  const ax: V3 = [d[0] / l, d[1] / l, d[2] / l];
  // Two axes square to it: the one off the vertical, unless it is upright.
  const ref: V3 = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(ax, ref));
  const v = cross(ax, u);
  const ring: V3[] = [0, 1, 2, 3].map((k) => {
    const c = Math.cos((k * Math.PI) / 2 + Math.PI / 4) * r;
    const s = Math.sin((k * Math.PI) / 2 + Math.PI / 4) * r;
    return [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s];
  });
  for (let k = 0; k < 4; k++) {
    const p = ring[k];
    const q = ring[(k + 1) % 4];
    const pa: V3 = [a[0] + p[0], a[1] + p[1], a[2] + p[2]];
    const qa: V3 = [a[0] + q[0], a[1] + q[1], a[2] + q[2]];
    const pb: V3 = [b[0] + p[0], b[1] + p[1], b[2] + p[2]];
    const qb: V3 = [b[0] + q[0], b[1] + q[1], b[2] + q[2]];
    // Wound so the face's normal points out along the middle of p and q.
    const out: V3 = [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
    const n = cross([qa[0] - pa[0], qa[1] - pa[1], qa[2] - pa[2]], d);
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0) kit.quad(pa, qa, qb, pb, layer, tint);
    else kit.quad(qa, pa, pb, qb, layer, tint);
  }
}

const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A WALL STOOD ON THE SNOW: from (x0, z0) to (x1, z1) in plan (facing as
 * `wall` does), its foot `sink` m under the snow wherever the snow is, its
 * head level at `top`, in quads `step` m long. */
export function snowWall(
  kit: FacadeKit,
  snowAt: (x: number, z: number) => number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  top: number,
  layer: (typeof FACADE)[keyof typeof FACADE],
  tint: Tint,
  sink = 0.25,
  step = 0.6,
): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / step));
  for (let k = 0; k < n; k++) {
    const a = k / n;
    const b = (k + 1) / n;
    const xa = x0 + (x1 - x0) * a;
    const za = z0 + (z1 - z0) * a;
    const xb = x0 + (x1 - x0) * b;
    const zb = z0 + (z1 - z0) * b;
    const fa = snowAt(xa, za) - sink;
    const fb = snowAt(xb, zb) - sink;
    // The UVs run on along the wall and up from a level datum, so boards
    // stay upright and unbroken across the steps.
    kit.quad([xa, fa, za], [xb, fb, zb], [xb, top, zb], [xa, top, za], layer, tint, a * len, 0);
  }
}

/** Where the start hut stands: its foot's middle on the snow and its
 * heading (the piste's), or null where the start is a race's house or a
 * ski cross's gate of doors. */
export function startHutSpot(
  level: Level,
  house: boolean,
): { x: number; y: number; z: number; heading: number } | null {
  const cp = level.checkpoints[0];
  if (!cp || house || level.skiCross) return null;
  const rx = Math.cos(cp.heading);
  const rz = -Math.sin(cp.heading);
  const fx = Math.sin(cp.heading);
  const fz = Math.cos(cp.heading);
  const half = cp.width / 2 + 1;
  const x = cp.x - rx * (half + HUT.out) + fx * HUT.ahead;
  const z = cp.z - rz * (half + HUT.out) + fz * HUT.ahead;
  return { x, y: level.groundAt(x, z), z, heading: cp.heading };
}

/** THE START HUT at `spot`, into `kit` in world metres: x across the
 * piste's line (its window to +x, the piste), z down it. */
export function buildStartHut(
  kit: FacadeKit,
  level: Level,
  spot: { x: number; y: number; z: number; heading: number },
): void {
  kit.at(spot.x, spot.y, spot.z, spot.heading);
  const hw = HUT.width / 2;
  const hd = HUT.depth / 2;
  let lo = Infinity;
  let hi = -Infinity;
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      const w = kit.world([a * hw, 0, b * hd]);
      const g = level.groundAt(w[0], w[2]) - spot.y;
      lo = Math.min(lo, g);
      hi = Math.max(hi, g);
    }
  // The concrete footing from under the snow to a hand over its highest
  // corner; the boards on it; the eaves a man's reach over the floor.
  const floor = hi + 0.2;
  const eave = floor + HUT.height - 0.15;
  kit.box(-hw - 0.05, lo - 0.3, -hd - 0.05, hw + 0.05, floor, hd + 0.05, FACADE.concrete, T.as);
  kit.box(-hw, floor, -hd, hw, eave, hd, FACADE.boards, T.as, null);
  // The corner boards, dark.
  for (const [x, z] of [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ])
    kit.box(x - 0.06, floor, z - 0.06, x + 0.06, eave, z + 0.06, FACADE.boards, T.trim, null);
  // THE TIMER'S WINDOW onto the piste (+x), its counter under it, a
  // framed sliding window lit after dark; a second, small, looking up the
  // piste to the start (−z).
  kit.inset(hw, 0.8, hw, -0.8, floor + 0.95, floor + 1.75, 0.03, FACADE.window, T.as, true);
  kit.box(hw, floor + 0.86, -0.92, hw + 0.32, floor + 0.94, 0.92, FACADE.boards, T.trim, {
    layer: FACADE.boards,
    tint: T.trim,
  });
  for (const z of [-0.92, 0.82])
    kit.box(hw + 0.02, floor + 0.62, z, hw + 0.28, floor + 0.86, z + 0.1, FACADE.boards, T.trim);
  kit.inset(0.45, -hd, -0.35, -hd, floor + 1.05, floor + 1.65, 0.03, FACADE.window, T.as, true);
  // THE DOOR at its downhill end, a step of boards under it.
  kit.inset(-0.95, hd, -0.15, hd, floor, floor + 1.85, 0.03, FACADE.boards, T.door);
  kit.box(-1.0, floor - 0.25, hd, -0.1, floor - 0.05, hd + 0.4, FACADE.boards, T.trim, {
    layer: FACADE.boards,
    tint: 0xa08060,
  });
  // THE GABLE ROOF, its ridge along the piste, the eaves out over the
  // counter, under snow; the stove's pipe up through it.
  kit.gableRoof(hw, hd, eave, 0.75, 0.4, ROOF, BOARDS, FASCIA, 0.24);
  kit.column(-0.55, -0.45, eave, eave + 1.25, 0.07, FACADE.steel, 0x8a9096, 6);
  kit.box(-0.65, eave + 1.25, -0.55, -0.45, eave + 1.32, -0.35, FACADE.steel, 0x5a5f64);
}

/** THE START HOUSE's walls, roof, billboard wall, ramp and timing box, in
 * the house's own frame (x across to the racer's right, z down the course,
 * y up from the snow under the wand); `snowAt` the snow under a point of
 * that frame, `roof` the eaves' height and `top` the billboard's. */
export function buildStartHouse(
  kit: FacadeKit,
  snowAt: (x: number, z: number) => number,
  roof: number,
  top: number,
): void {
  kit.at(0, 0, 0, 0);
  const F = HOUSE.front;
  const D = HOUSE.door;
  const hw = HOUSE.width / 2;
  const back = -HOUSE.depth;
  const front = -0.14;
  // THE HOUSE: timber boards on the slope, out (the flanks and the back)
  // and in (lighter, unweathered — what the lens behind the racer sees).
  snowWall(kit, snowAt, -hw, back, -hw, front, roof, FACADE.boards, T.as);
  snowWall(kit, snowAt, hw, front, hw, back, roof, FACADE.boards, T.as);
  snowWall(kit, snowAt, hw, back, -hw, back, roof, FACADE.boards, T.as);
  const i = 0.1;
  snowWall(kit, snowAt, -hw + i, front, -hw + i, back + i, roof, FACADE.boards, T.inside);
  snowWall(kit, snowAt, hw - i, back + i, hw - i, front, roof, FACADE.boards, T.inside);
  snowWall(kit, snowAt, -hw + i, back + i, hw - i, back + i, roof, FACADE.boards, T.inside);
  // The corner posts, dark-stained.
  for (const [x, z] of [
    [-hw, back],
    [hw, back],
  ])
    kit.box(
      x - 0.07,
      snowAt(x, z) - 0.25,
      z - 0.07,
      x + 0.07,
      roof,
      z + 0.07,
      FACADE.boards,
      T.trim,
      null,
    );
  // A WINDOW in each flank, where the start referee looks down the ramp,
  // glazed both ways and lit after dark.
  for (const s of [-1, 1]) {
    const z0 = -1.3;
    const z1 = -2.25;
    const y0 = Math.max(snowAt(s * hw, z0), snowAt(s * hw, z1)) + 1.15;
    const y1 = Math.min(roof - 0.35, y0 + 0.8);
    if (s < 0) {
      kit.inset(-hw, z1, -hw, z0, y0, y1, 0.03, FACADE.window, T.as, true);
      kit.inset(-hw + i, z0, -hw + i, z1, y0, y1, 0.01, FACADE.window, T.as, true);
    } else {
      kit.inset(hw, z0, hw, z1, y0, y1, 0.03, FACADE.window, T.as, true);
      kit.inset(hw - i, z1, hw - i, z0, y0, y1, 0.01, FACADE.window, T.as, true);
    }
  }
  // THE ROOF: flat, its slab's edge in boards, a blanket of snow on it;
  // its front stops behind the billboard, its back and flanks run out.
  const over = 0.3;
  const hl = (front - 0.02 - back) / 2;
  kit.at(0, 0, back + hl - over / 2, 0);
  kit.flatRoof(hw, hl - over / 2, roof, 0.22, over, FASCIA, 0.3);
  kit.at(0, 0, 0, 0);

  // THE BILLBOARD WALL across the front: panels of the woods' green round
  // the doorway, from the snow at its foot, its back boarded; its ends and
  // top capped; the doorway's reveals dark.
  const fw = F.width / 2;
  const door = D.width / 2;
  const lintel = snowAt(0, 0) + D.height;
  const d = 0.14;
  snowWall(kit, snowAt, -fw, 0, -door, 0, top, FACADE.panel, T.panel);
  snowWall(kit, snowAt, door, 0, fw, 0, top, FACADE.panel, T.panel);
  kit.wall(-door, 0, door, 0, lintel, top, FACADE.panel, T.panel);
  snowWall(kit, snowAt, -door, -d, -fw, -d, top, FACADE.boards, T.inside);
  snowWall(kit, snowAt, fw, -d, door, -d, top, FACADE.boards, T.inside);
  kit.wall(door, -d, -door, -d, lintel, top, FACADE.boards, T.inside);
  kit.cap(
    [
      [-fw, -d],
      [fw, -d],
      [fw, 0],
      [-fw, 0],
    ],
    top,
    FACADE.snow,
    0xf2f6fa,
  );
  snowWall(kit, snowAt, -fw, -d, -fw, 0, top, FACADE.plain, T.back);
  snowWall(kit, snowAt, fw, 0, fw, -d, top, FACADE.plain, T.back);
  snowWall(kit, snowAt, -door, 0, -door, -d, lintel, FACADE.plain, T.dark);
  snowWall(kit, snowAt, door, -d, door, 0, lintel, FACADE.plain, T.dark);
  kit.quad(
    [-door, lintel, -d],
    [door, lintel, -d],
    [door, lintel, 0],
    [-door, lintel, 0],
    FACADE.plain,
    T.dark,
  );
  // Its scaffold behind the wings: an upright at each end and a raking
  // brace back to the snow, a ledger across to the house.
  for (const s of [-1, 1]) {
    const x = s * (fw - 0.2);
    const z = -d - 0.08;
    strut(kit, [x, snowAt(x, z) - 0.2, z], [x, top - 0.1, z], 0.035);
    const zb = -2.4;
    strut(kit, [x, top - 0.7, z], [x, snowAt(x, zb) - 0.1, zb], 0.03);
    const mid = (snowAt(x, z) + top) / 2;
    strut(kit, [s * hw, mid, z], [x, mid, z], 0.03);
    strut(kit, [s * hw, top - 0.4, z], [x, top - 0.4, z], 0.03);
  }

  // THE START RAMP out of the door, between two low kickboards on the
  // snow, outside the pole holes.
  const kick = HOUSE.holes.apart / 2 + HOUSE.holes.width / 2 + 0.35;
  for (const s of [-1, 1]) {
    const x = s * kick;
    for (let k = 0; k < 4; k++) {
      const za = 0.1 + k * 0.6;
      const zb = za + 0.6;
      const ya = snowAt(x, za);
      const yb = snowAt(x, zb);
      const lo: V3 = [x, ya - 0.1, za];
      const lo2: V3 = [x, yb - 0.1, zb];
      const hiA: V3 = [x, ya + 0.28, za];
      const hiB: V3 = [x, yb + 0.28, zb];
      const xo = x + s * 0.05;
      // Each face: the inner one to the ramp, the outer to the snow.
      if (s < 0) {
        kit.quad(lo2, lo, hiA, hiB, FACADE.boards, T.as, za);
        kit.quad(
          [xo, ya - 0.1, za],
          [xo, yb - 0.1, zb],
          [xo, yb + 0.28, zb],
          [xo, ya + 0.28, za],
          FACADE.boards,
          T.as,
        );
      } else {
        kit.quad(lo, lo2, hiB, hiA, FACADE.boards, T.as, za);
        kit.quad(
          [xo, yb - 0.1, zb],
          [xo, ya - 0.1, za],
          [xo, ya + 0.28, za],
          [xo, yb + 0.28, zb],
          FACADE.boards,
          T.as,
        );
      }
      const oa: V3 = [xo, ya + 0.28, za];
      const ob: V3 = [xo, yb + 0.28, zb];
      if (s < 0) kit.quad(oa, ob, hiB, hiA, FACADE.boards, 0xc8b090);
      else kit.quad(ob, oa, hiA, hiB, FACADE.boards, 0xc8b090);
    }
  }

  // THE TIMING BOX on the wand's left post: the housing the wand's switch
  // and the cable to the timer's hut are in.
  const px = -door + 0.12;
  const py = snowAt(px, 0.05) + HOUSE.wand.post;
  kit.box(px - 0.24, py - 0.05, 0.0, px - 0.06, py + 0.17, 0.14, FACADE.plain, T.box, {
    layer: FACADE.plain,
    tint: T.dark,
  });
}
