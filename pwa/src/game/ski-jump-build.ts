// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING HILL'S STRUCTURES, BUILT (R43): everything of the hill
// that is concrete, steel, boards and glass, on the facade kit
// (`facade-kit.ts`) in its painted materials — one geometry, one draw for
// the whole hill. Where each stands is `ski-jump-plan.ts`'s; this builds:
//
//   * THE IN-RUN TROUGH: its snow floor between the guard walls, the walls
//     (concrete, a steel rail on posts over them), the stair down its
//     right, the lamp posts down both walls (their heads lit after dark),
//     and the starting bar of every gate across it;
//   * THE START TOWER behind the deck (a concrete storey, a glazed one
//     over it, a flat roof and a mast) and the canopy over the top gates;
//   * THE TABLE'S EDGE: the concrete face it drops off to the knoll;
//   * THE LANDING HILL'S BOARD WALLS down both sides, the boards' posts,
//     the flagpoles and the anemometers' masts;
//   * THE JUDGES' TOWER (five glazed cabins stepped down the slope on a
//     concrete stalk), the COACHES' PLATFORMS on their scaffold and the
//     FLOODLIGHT MASTS (their lamp heads lit after dark).
//
// Three-free: the arrays are made a mesh by `facade-mesh.ts`.

import type { Level } from "@engine";

import { FACADE, type FacadeLayer } from "./facade-paint.ts";
import type { FacadeKit, V3 } from "./facade-kit.ts";
import { hillPoint } from "./ski-jump-frame.ts";
import { landingWidth, SJ_LOOK, type SkiJumpPlan } from "./ski-jump-plan.ts";

const CONCRETE = 0xd2d0cb;
const STEEL = 0x8f989f;
const DARK = 0x3a4048;
const BOARD = 0xf4f6f8;
const BLUE = 0x1f4f9a;
const RED = 0xc4202a;

/** The kit's frame on the hill: x across (to the jumper's right), y the
 * world's height, z along the line. */
function setFrame(kit: FacadeKit, plan: SkiJumpPlan): void {
  const f = plan.frame;
  kit.at(f.x, 0, f.z, f.heading);
}

/** The profile's height `d` m along, m. */
const yOf = (plan: SkiJumpPlan, d: number) => plan.frame.hill.yAt(d);

/** The snow's height under a point of the hill's frame, m. */
function groundOf(level: Level, plan: SkiJumpPlan, d: number, a: number): number {
  const p = hillPoint(plan.frame, d, a);
  return level.groundAt(p.x, p.z);
}

/** The places down the in-run a strip is cut at, m of plan: every metre,
 * the edge last. */
function inRunStations(plan: SkiJumpPlan): number[] {
  const out: number[] = [];
  for (let d = plan.inRun.from; d < plan.inRun.to; d += 1) out.push(d);
  out.push(plan.inRun.to);
  return out;
}

/** A strip along the hill between two offsets across, each station's
 * height `y(d, a)`: a run of quads, its face up. */
function strip(
  kit: FacadeKit,
  ds: readonly number[],
  a0: number,
  a1: number,
  y: (d: number, a: number) => number,
  layer: FacadeLayer,
  tint: number,
): void {
  for (let i = 0; i + 1 < ds.length; i++) {
    const d0 = ds[i];
    const d1 = ds[i + 1];
    // Counter-clockwise seen from above (+y): a0 → a1 at d0, then d1.
    kit.quad(
      [a1, y(d0, a1), d0],
      [a0, y(d0, a0), d0],
      [a0, y(d1, a0), d1],
      [a1, y(d1, a1), d1],
      layer,
      tint,
    );
  }
}

/** A wall along the hill at offset `a`, from `lo(d)` up to `hi(d)`,
 * facing toward +a (`toward` 1) or −a (−1). */
function sideWall(
  kit: FacadeKit,
  ds: readonly number[],
  a: number,
  lo: (d: number) => number,
  hi: (d: number) => number,
  toward: 1 | -1,
  layer: FacadeLayer,
  tint: number,
): void {
  for (let i = 0; i + 1 < ds.length; i++) {
    const d0 = ds[i];
    const d1 = ds[i + 1];
    // A face toward +x runs along −z (the kit's winding: run (dx, dz)
    // faces (−dz, dx)).
    const [p, q] = toward > 0 ? [d1, d0] : [d0, d1];
    const a0: V3 = [a, lo(p), p];
    const b0: V3 = [a, lo(q), q];
    kit.quad(a0, b0, [a, hi(q), q], [a, hi(p), p], layer, tint);
  }
}

/** THE IN-RUN: the floor, the walls and their rails, the stair, the lamp
 * posts and the gates' bars. */
function buildInRun(kit: FacadeKit, plan: SkiJumpPlan): void {
  const L = SJ_LOOK;
  const ir = plan.inRun;
  const ds = inRunStations(plan);
  const y = (d: number) => yOf(plan, d);
  const half = ir.half;
  const out = half + L.wall.thick;
  // The floor: snow between the walls, a hair over the hill's own snow.
  strip(kit, ds, -half, half, (d) => y(d) + 0.012, FACADE.snow, 0xf4f7fa);
  for (const side of [-1, 1] as const) {
    const inner = side * half;
    const outer = side * out;
    // The wall's inner face, its top and its outer face (down into the
    // snow beside it).
    sideWall(
      kit,
      ds,
      inner,
      (d) => y(d) - 0.05,
      (d) => y(d) + L.wall.high,
      side > 0 ? -1 : 1,
      FACADE.concrete,
      CONCRETE,
    );
    strip(
      kit,
      ds,
      Math.min(inner, outer),
      Math.max(inner, outer),
      (d) => y(d) + L.wall.high,
      FACADE.concrete,
      0xe2e0dc,
    );
    sideWall(
      kit,
      ds,
      outer,
      (d) => y(d) - 0.4,
      (d) => y(d) + L.wall.high,
      side > 0 ? 1 : -1,
      FACADE.concrete,
      0xc6c4bf,
    );
    // The steel rail over the wall on posts every two metres.
    const railH = L.wall.high + 0.45;
    const railA = side * (half + L.wall.thick * 0.5);
    for (let d = ir.from; d <= ir.to; d += 2) {
      kit.box(
        railA - 0.03,
        y(d) + L.wall.high,
        d - 0.03,
        railA + 0.03,
        y(d) + railH,
        d + 0.03,
        FACADE.steel,
        STEEL,
        null,
      );
    }
    sideWall(
      kit,
      ds,
      railA + side * 0.03,
      (d) => y(d) + railH - 0.06,
      (d) => y(d) + railH,
      side > 0 ? 1 : -1,
      FACADE.steel,
      STEEL,
    );
    sideWall(
      kit,
      ds,
      railA - side * 0.03,
      (d) => y(d) + railH - 0.06,
      (d) => y(d) + railH,
      side > 0 ? -1 : 1,
      FACADE.steel,
      STEEL,
    );
    // The lamps: a post on the wall, its head leaning over the track.
    for (let d = ir.from + 4; d < ir.to - 2; d += L.lamp.every) {
      const base = y(d) + L.wall.high;
      kit.box(
        railA - 0.04,
        base,
        d - 0.04,
        railA + 0.04,
        base + L.lamp.high,
        d + 0.04,
        FACADE.steel,
        DARK,
        null,
      );
      const hx = railA - side * 0.25;
      kit.glow = 1;
      kit.box(
        hx - 0.22,
        base + L.lamp.high - 0.1,
        d - 0.12,
        hx + 0.22,
        base + L.lamp.high,
        d + 0.12,
        FACADE.plain,
        0xfff1d8,
        { layer: FACADE.plain, tint: DARK },
      );
      kit.glow = 0;
    }
  }
  // THE STAIR down the right of the wall: treads and risers on the slope,
  // and its handrail.
  const s0 = out;
  const s1 = out + L.stair.width;
  let d = ir.from;
  let tread = y(d) + 0.3;
  while (d < ir.to - 1) {
    // The next step: where the profile has fallen a rise under this tread.
    let e = d + 0.1;
    while (e < ir.to && y(e) + 0.3 > tread - L.stair.rise) e += 0.05;
    const next = tread - L.stair.rise;
    kit.quad(
      [s1, tread, d],
      [s0, tread, d],
      [s0, tread, e],
      [s1, tread, e],
      FACADE.concrete,
      0xd8d6d2,
    );
    kit.quad(
      [s0, next, e],
      [s1, next, e],
      [s1, tread, e],
      [s0, tread, e],
      FACADE.concrete,
      0xb9b7b2,
    );
    d = e;
    tread = next;
  }
  const hand = (dd: number) => y(dd) + 1.25;
  sideWall(kit, ds, s1, (dd) => hand(dd) - 0.05, hand, 1, FACADE.steel, STEEL);
  for (let dd = ir.from; dd <= ir.to; dd += 3) {
    kit.box(
      s1 - 0.03,
      y(dd) + 0.2,
      dd - 0.03,
      s1 + 0.03,
      hand(dd),
      dd + 0.03,
      FACADE.steel,
      STEEL,
      null,
    );
  }
  sideWall(
    kit,
    ds,
    s1,
    (dd) => y(dd) - 0.6,
    (dd) => y(dd) + 0.3,
    1,
    FACADE.concrete,
    0xc6c4bf,
  );
  // THE GATES: each a starting bar across the trough between its walls,
  // the bar a jumper sits on, its brackets on the walls.
  for (const g of plan.gates) {
    const gy = y(g.d) + 0.42;
    kit.box(-half, gy - 0.035, g.d - 0.035, half, gy + 0.035, g.d + 0.035, FACADE.steel, 0xd8dde2, {
      layer: FACADE.steel,
      tint: 0xd8dde2,
    });
    for (const side of [-1, 1]) {
      kit.box(
        side * half - 0.06,
        y(g.d),
        g.d - 0.08,
        side * half + 0.06,
        gy + 0.1,
        g.d + 0.08,
        FACADE.steel,
        DARK,
        null,
      );
    }
  }
}

/** THE START TOWER behind the deck, the canopy over the top gates and the
 * table's edge. */
function buildTowerAndEdge(kit: FacadeKit, plan: SkiJumpPlan): void {
  const t = plan.tower;
  const deck = yOf(plan, 0);
  const h = t.half;
  // The jumpers' storey at the deck, under the snow behind it; a glazed
  // storey over it; a parapet and the mast.
  kit.box(-h, deck - 4, t.from, h, deck + 3.2, t.to, FACADE.concrete, CONCRETE, null);
  kit.glow = 1;
  kit.wall(
    -h + 0.6,
    t.to + 0.02,
    h - 0.6,
    t.to + 0.02,
    deck + 0.4,
    deck + 2.8,
    FACADE.glazing,
    0xffffff,
  );
  kit.glow = 0;
  kit.box(
    -h - 0.3,
    deck + 3.2,
    t.from - 0.3,
    h + 0.3,
    deck + 3.5,
    t.to + 0.6,
    FACADE.concrete,
    0xe7e5e1,
    { layer: FACADE.snow, tint: 0xffffff },
  );
  kit.box(
    -h + 0.4,
    deck + 3.5,
    t.from + 0.4,
    h - 0.4,
    deck + 6.6,
    t.to,
    FACADE.cladding,
    0x3d6aa8,
    null,
  );
  kit.glow = 1;
  kit.wall(
    -h + 0.8,
    t.to + 0.02,
    h - 0.8,
    t.to + 0.02,
    deck + 3.9,
    deck + 6.3,
    FACADE.glazing,
    0xffffff,
  );
  kit.wall(
    h - 0.38,
    t.to - 0.8,
    h - 0.38,
    t.from + 1.2,
    deck + 3.9,
    deck + 6.3,
    FACADE.glazing,
    0xffffff,
  );
  kit.wall(
    -h + 0.38,
    t.from + 1.2,
    -h + 0.38,
    t.to - 0.8,
    deck + 3.9,
    deck + 6.3,
    FACADE.glazing,
    0xffffff,
  );
  kit.glow = 0;
  kit.box(-h, deck + 6.6, t.from, h, deck + 7.0, t.to + 0.3, FACADE.concrete, 0xe7e5e1, {
    layer: FACADE.snow,
    tint: 0xffffff,
  });
  kit.column(h - 1, (t.from + t.to) / 2, deck + 7, deck + 14, 0.08, FACADE.steel, STEEL, 6);
  // The canopy over the top gates: posts outside the walls, a roof of
  // ribbed sheet stepped down with the in-run.
  const top = plan.gates.at(-1)?.d ?? 8;
  const low = plan.gates[Math.max(0, plan.gates.length - 10)]?.d ?? top + 6;
  const span = plan.inRun.half + SJ_LOOK.wall.thick + 0.25;
  for (let d = 0; d <= low; d += 4) {
    for (const side of [-1, 1]) {
      kit.box(
        side * span - 0.07,
        yOf(plan, d),
        d - 0.07,
        side * span + 0.07,
        yOf(plan, d) + 2.9,
        d + 0.07,
        FACADE.steel,
        STEEL,
        null,
      );
    }
  }
  const ds: number[] = [];
  for (let d = 0; d <= low; d += 1) ds.push(d);
  strip(kit, ds, -span - 0.3, span + 0.3, (d) => yOf(plan, d) + 3.0, FACADE.roof, 0x6d7780);
  strip(kit, ds, -span - 0.3, span + 0.3, (d) => yOf(plan, d) + 3.12, FACADE.snow, 0xffffff);
  // THE EDGE: the concrete face the table ends in, across the whole cut,
  // from the table's lip down to the knoll under it — and its dark lip.
  const e = plan.inRun.to;
  const lip = yOf(plan, e);
  const foot = yOf(plan, e + 0.08);
  const across = plan.frame.hill.width / 2;
  kit.wall(-across, e + 0.01, across, e + 0.01, foot - 0.3, lip - 0.02, FACADE.concrete, 0xb8b6b1);
  kit.wall(
    -plan.inRun.half - 0.3,
    e + 0.02,
    plan.inRun.half + 0.3,
    e + 0.02,
    lip - 0.12,
    lip + 0.02,
    FACADE.plain,
    0x2a2d31,
  );
}

/** THE LANDING HILL'S WALLS, the boards' posts, the flags' poles and the
 * anemometers. */
function buildLanding(kit: FacadeKit, level: Level, plan: SkiJumpPlan): void {
  const hill = plan.frame.hill;
  const L = SJ_LOOK;
  const ds: number[] = [];
  for (let d = hill.edge + 1; d <= hill.outrun; d += 2) ds.push(d);
  for (const side of [-1, 1] as const) {
    const a = (d: number) => (side * landingWidth(hill, d)) / 2;
    // The boards: white, a coloured band along their top, outward-facing
    // backs; each panel a quad between two stations.
    for (let i = 0; i + 1 < ds.length; i++) {
      const d0 = ds[i];
      const d1 = ds[i + 1];
      const g0 = groundOf(level, plan, d0, a(d0));
      const g1 = groundOf(level, plan, d1, a(d1));
      const inward: [V3, V3] =
        side > 0
          ? [
              [a(d0), 0, d0],
              [a(d1), 0, d1],
            ]
          : [
              [a(d1), 0, d1],
              [a(d0), 0, d0],
            ];
      const [p, q] = inward;
      const gp = p[2] === d0 ? g0 : g1;
      const gq = q[2] === d0 ? g0 : g1;
      const band =
        d0 >= hill.p && d0 < hill.k ? BLUE : d0 >= hill.k && d0 < hill.l ? RED : 0x2d6fb8;
      kit.quad(
        [p[0], gp - 0.1, p[2]],
        [q[0], gq - 0.1, q[2]],
        [q[0], gq + L.rail.high - 0.18, q[2]],
        [p[0], gp + L.rail.high - 0.18, p[2]],
        FACADE.plain,
        BOARD,
      );
      kit.quad(
        [p[0], gp + L.rail.high - 0.18, p[2]],
        [q[0], gq + L.rail.high - 0.18, q[2]],
        [q[0], gq + L.rail.high, q[2]],
        [p[0], gp + L.rail.high, p[2]],
        FACADE.plain,
        band,
      );
      const o = side * 0.08;
      kit.quad(
        [q[0] + o, gq - 0.1, q[2]],
        [p[0] + o, gp - 0.1, p[2]],
        [p[0] + o, gp + L.rail.high, p[2]],
        [q[0] + o, gq + L.rail.high, q[2]],
        FACADE.boards,
        0xc9ccd0,
      );
      kit.quad(
        [p[0], gp + L.rail.high, p[2]],
        [q[0], gq + L.rail.high, q[2]],
        [q[0] + o, gq + L.rail.high, q[2]],
        [p[0] + o, gp + L.rail.high, p[2]],
        FACADE.plain,
        0xe8eaec,
      );
    }
  }
  // The boards' posts, numbered and ticks alike.
  for (const b of plan.boards) {
    const a = b.side * (landingWidth(hill, b.d) / 2 + L.board.out);
    const g = groundOf(level, plan, b.d, a);
    const top = g + L.board.lift + (b.tick ? 0 : L.board.h * 0.2);
    kit.box(a - 0.03, g - 0.1, b.d - 0.03, a + 0.03, top, b.d + 0.03, FACADE.steel, DARK, null);
  }
  // The flagpoles, and the anemometers' masts with their crossarm.
  for (const fl of plan.flags) {
    const a = fl.side * (landingWidth(hill, fl.d) / 2 + L.flag.out);
    const g = groundOf(level, plan, fl.d, a);
    kit.column(a, fl.d, g - 0.1, g + L.flag.pole, 0.035, FACADE.steel, 0xdfe3e6, 5);
  }
  for (const m of plan.meters) {
    const a = m.side * (landingWidth(hill, m.d) / 2 + L.meter.out);
    const g = groundOf(level, plan, m.d, a);
    kit.column(a, m.d, g - 0.1, g + L.meter.pole, 0.06, FACADE.steel, STEEL, 6);
    kit.box(
      a - 0.5,
      g + L.meter.pole - 0.05,
      m.d - 0.04,
      a + 0.5,
      g + L.meter.pole + 0.03,
      m.d + 0.04,
      FACADE.steel,
      DARK,
      null,
    );
    kit.box(
      a - 0.12,
      g + L.meter.pole,
      m.d - 0.12,
      a + 0.12,
      g + L.meter.pole + 0.35,
      m.d + 0.12,
      FACADE.plain,
      0xe9ecee,
      { layer: FACADE.plain, tint: 0xe9ecee },
    );
  }
}

/** THE JUDGES' TOWER, THE COACHES' PLATFORMS AND THE FLOODLIGHT MASTS. */
function buildStands(kit: FacadeKit, level: Level, plan: SkiJumpPlan): void {
  const L = SJ_LOOK;
  const J = plan.judges;
  const a0 = J.side * J.off;
  // The cabins face the hill: the glazed face on the side toward the axis.
  const deep = L.judges.deep;
  const inner = a0 - (J.side * deep) / 2;
  const outer = a0 + (J.side * deep) / 2;
  const x0 = Math.min(inner, outer);
  const x1 = Math.max(inner, outer);
  let lowest = Infinity;
  J.d.forEach((d) => {
    const floor = yOf(plan, d) + L.judges.eye;
    const g = Math.min(groundOf(level, plan, d, x0), groundOf(level, plan, d, x1));
    lowest = Math.min(lowest, g);
    const c = L.judges.cabin / 2 - 0.05;
    // The stalk under it and the cabin itself.
    kit.box(
      x0 + 0.3,
      g - 0.5,
      d - c + 0.3,
      x1 - 0.3,
      floor,
      d + c - 0.3,
      FACADE.concrete,
      CONCRETE,
      null,
    );
    kit.box(x0, floor, d - c, x1, floor + 2.3, d + c, FACADE.cladding, 0xdfe3e8, {
      layer: FACADE.snow,
      tint: 0xffffff,
    });
    kit.glow = 1;
    const face = J.side < 0 ? x1 + 0.02 : x0 - 0.02;
    if (J.side < 0)
      kit.wall(
        face,
        d + c - 0.15,
        face,
        d - c + 0.15,
        floor + 0.8,
        floor + 2.1,
        FACADE.glazing,
        0xffffff,
      );
    else
      kit.wall(
        face,
        d - c + 0.15,
        face,
        d + c - 0.15,
        floor + 0.8,
        floor + 2.1,
        FACADE.glazing,
        0xffffff,
      );
    kit.glow = 0;
  });
  // The stair tower beside the cabins.
  const top = J.d[0] - L.judges.cabin / 2 - 1.6;
  const gTop = groundOf(level, plan, top, a0);
  kit.box(
    x0 + 0.3,
    gTop - 0.5,
    top - 0.7,
    x1 - 0.3,
    yOf(plan, J.d[0]) + L.judges.eye + 2.6,
    top + 0.7,
    FACADE.concrete,
    0xc2c0bb,
    { layer: FACADE.snow, tint: 0xffffff },
  );

  // THE COACHES' PLATFORMS: a scaffold deck with a rail.
  const C = L.coach;
  for (const c of plan.coaches) {
    const a = c.side * c.off;
    const xa = a - C.deep / 2;
    const xb = a + C.deep / 2;
    const g = Math.max(groundOf(level, plan, c.d, a), groundOf(level, plan, c.d - C.wide / 2, a));
    const deckY = g + C.deck;
    kit.box(
      xa,
      deckY - 0.15,
      c.d - C.wide / 2,
      xb,
      deckY,
      c.d + C.wide / 2,
      FACADE.steel,
      0x6f7a84,
      { layer: FACADE.boards, tint: 0xb59a76 },
    );
    for (const da of [-C.wide / 2, 0, C.wide / 2]) {
      for (const xx of [xa, xb]) {
        const gl = groundOf(level, plan, c.d + da, xx);
        kit.box(
          xx - 0.05,
          gl - 0.2,
          c.d + da - 0.05,
          xx + 0.05,
          deckY,
          c.d + da + 0.05,
          FACADE.steel,
          STEEL,
          null,
        );
      }
    }
    kit.box(
      xa,
      deckY + 1.0,
      c.d - C.wide / 2,
      xb,
      deckY + 1.06,
      c.d - C.wide / 2 + 0.06,
      FACADE.steel,
      STEEL,
      null,
    );
    kit.box(
      xa,
      deckY + 1.0,
      c.d + C.wide / 2 - 0.06,
      xb,
      deckY + 1.06,
      c.d + C.wide / 2,
      FACADE.steel,
      STEEL,
      null,
    );
    const back = c.side > 0 ? xb : xa;
    kit.box(
      back - 0.03,
      deckY + 1.0,
      c.d - C.wide / 2,
      back + 0.03,
      deckY + 1.06,
      c.d + C.wide / 2,
      FACADE.steel,
      STEEL,
      null,
    );
  }

  // THE FLOODLIGHT MASTS: a pole, a crossarm, the lamps (lit after dark).
  const f = plan.frame;
  for (const m of plan.masts) {
    // The mast's foot in the hill's frame.
    const dx = m.x - f.x;
    const dz = m.z - f.z;
    const d = dx * f.fx + dz * f.fz;
    const a = dx * f.rx + dz * f.rz;
    kit.column(a, d, m.y - 0.2, m.y + m.height + 0.3, 0.18, FACADE.steel, STEEL, 8);
    const arm = (m.lamps.length * 0.7) / 2 + 0.3;
    kit.box(
      a - 0.06,
      m.y + m.height + 0.2,
      d - arm,
      a + 0.06,
      m.y + m.height + 0.32,
      d + arm,
      FACADE.steel,
      STEEL,
      null,
    );
    for (const l of m.lamps) {
      const ld = (l.x - f.x) * f.fx + (l.z - f.z) * f.fz;
      // The housing, and its glass toward the hill's axis.
      kit.box(
        a - 0.2,
        m.y + m.height - 0.3,
        ld - 0.3,
        a + 0.2,
        m.y + m.height + 0.15,
        ld + 0.3,
        FACADE.plain,
        DARK,
        { layer: FACADE.plain, tint: DARK },
      );
      kit.glow = 1;
      const face = a - m.side * 0.21;
      if (m.side < 0)
        kit.wall(
          face,
          ld + 0.27,
          face,
          ld - 0.27,
          m.y + m.height - 0.27,
          m.y + m.height + 0.12,
          FACADE.plain,
          0xfff4dd,
        );
      else
        kit.wall(
          face,
          ld - 0.27,
          face,
          ld + 0.27,
          m.y + m.height - 0.27,
          m.y + m.height + 0.12,
          FACADE.plain,
          0xfff4dd,
        );
      kit.glow = 0;
    }
  }
}

/** THE HILL'S STRUCTURES on `kit`. */
export function buildSkiJump(kit: FacadeKit, level: Level, plan: SkiJumpPlan): void {
  setFrame(kit, plan);
  buildInRun(kit, plan);
  buildTowerAndEdge(kit, plan);
  buildLanding(kit, level, plan);
  buildStands(kit, level, plan);
}
