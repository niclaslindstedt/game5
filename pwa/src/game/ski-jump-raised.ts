// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAISED IN-RUN AND THE START TOWER (R43), planned and built on the
// facade kit. A modern large hill's in-run is a STRUCTURE standing over the
// slope (`SKI_JUMP_RULE.raised`: the engine lays the ground under it, the
// deck the surface on the line): what holds it up is what gives a jumping
// hill its silhouette against the sky.
//
//   * THE DECK: the trough's concrete slab, its fascia and soffit, from the
//     tower to the table;
//   * THE TRUSS under it: two steel girders under the deck's two edges,
//     deepest where the deck stands highest, their chords, posts and
//     diagonals and the bracing between them;
//   * THE PIERS: concrete legs from the ground to the truss, tapered, each
//     under a cross-head — a few down the upper in-run where the deck
//     stands high over the ground;
//   * THE TAKE-OFF BLOCK: the lower in-run and the table on a concrete
//     substructure down to the ground, its face the edge, standing proud
//     of the knoll;
//   * THE START TOWER: its shaft from the ground up to the warming room at
//     the deck (`ski-jump-build.ts`'s storeys over it), a glazed ELEVATOR
//     shaft on its left and a steel STAIR TOWER on its right.
//
// What is solid of it to a lens is `raisedSolids` (`camera-clear.ts`).
// Three-free: the arrays are made a mesh by `facade-mesh.ts`.

import type { Level } from "@engine";

import { FACADE, type FacadeLayer } from "./facade-paint.ts";
import type { FacadeKit, V3 } from "./facade-kit.ts";
import { strut } from "./race-build.ts";
import { hillPoint } from "./ski-jump-frame.ts";
import { SJ_LOOK, type SkiJumpPlan } from "./ski-jump-plan.ts";

/** THE STRUCTURE'S SIZES (est., off photographs and drawings of large hills'
 * in-runs on steel and concrete), m: the deck slab under the trough's floor
 * (its depth under the floor); the truss (its depth as a share of the
 * deck's height over the ground and its least and most, the panel along,
 * the chords' and the web's radius); the piers (every so far down the
 * in-run, their foot and head across and along, the cross-head's depth);
 * the take-off block (how far up the in-run from the edge it reaches); the
 * tower's shaft (its half width, from and to along), the elevator shaft
 * and the stair tower beside it. */
export const RAISED_LOOK = {
  slab: { under: 1.1 },
  truss: { share: 0.14, least: 1.6, most: 4.2, panel: 4, chord: 0.14, web: 0.07 },
  pier: { every: 15, from: 8, foot: [2.4, 1.8], head: [1.5, 1.1], cap: 0.9 },
  block: 16,
  shaft: { half: 3.6, from: -8.2, to: -0.8 },
  lift: { wide: 2.4, from: -6.4, to: -3.6 },
  stair: { wide: 3.2, from: -7.6, to: -3.2, flight: 3.2 },
} as const;

const STEEL = 0x5f6f7e;
const CONCRETE = 0xcac8c2;
const DARK = 0x3a4048;

/** The deck's edges across the line, m: the trough's outer wall on the
 * left, the stair's outer edge on the right. */
export function deckSides(plan: SkiJumpPlan): { left: number; right: number } {
  const half = plan.inRun.half + SJ_LOOK.wall.thick;
  return { left: -half, right: half + SJ_LOOK.stair.width };
}

/** The ground under the deck's axis `d` m along, m. */
function groundUnder(level: Level, plan: SkiJumpPlan, d: number, a = 0): number {
  const p = hillPoint(plan.frame, d, a);
  return level.groundAt(p.x, p.z);
}

/** How high the deck's floor stands over the ground `d` m along, m. */
export function deckHeight(level: Level, plan: SkiJumpPlan, d: number): number {
  const s = deckSides(plan);
  const mid = (s.left + s.right) / 2;
  return plan.frame.hill.yAt(d) - groundUnder(level, plan, d, mid);
}

/** The truss's depth under the slab `d` m along, m. */
function trussDepth(level: Level, plan: SkiJumpPlan, d: number): number {
  const T = RAISED_LOOK.truss;
  return Math.min(T.most, Math.max(T.least, T.share * deckHeight(level, plan, d)));
}

/** Where the truss runs: from the tower to the take-off block, m of plan. */
function trussSpan(plan: SkiJumpPlan): [number, number] {
  return [0, plan.inRun.to - RAISED_LOOK.block];
}

/** The piers' places down the in-run, m of plan: where the deck stands high
 * enough over the ground for a leg under its truss. */
export function pierPlaces(level: Level, plan: SkiJumpPlan): number[] {
  const P = RAISED_LOOK.pier;
  const [, end] = trussSpan(plan);
  const out: number[] = [];
  for (let d = P.from; d < end - 4; d += P.every) {
    if (deckHeight(level, plan, d) - trussDepth(level, plan, d) > 3) out.push(d);
  }
  return out;
}

/** The tower's footprint: m along and across, and its foot (the lowest the
 * ground stands under it), m. */
function towerFoot(level: Level, plan: SkiJumpPlan): number {
  const S = RAISED_LOOK.shaft;
  let low = Infinity;
  for (const d of [S.from - 4, S.to])
    for (const a of [-S.half - 3, S.half + 4]) low = Math.min(low, groundUnder(level, plan, d, a));
  return low - 0.6;
}

/** A strip along the hill, face DOWN (a soffit): `strip`'s winding turned. */
function soffit(
  kit: FacadeKit,
  ds: readonly number[],
  a0: number,
  a1: number,
  y: (d: number) => number,
  layer: FacadeLayer,
  tint: number,
): void {
  for (let i = 0; i + 1 < ds.length; i++) {
    const d0 = ds[i];
    const d1 = ds[i + 1];
    kit.quad([a0, y(d0), d0], [a1, y(d0), d0], [a1, y(d1), d1], [a0, y(d1), d1], layer, tint);
  }
}

/** A face along the hill at `a`, from `lo(d)` to `hi(d)`, toward ±a. */
function face(
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
    const [p, q] = toward > 0 ? [ds[i + 1], ds[i]] : [ds[i], ds[i + 1]];
    kit.quad([a, lo(p), p], [a, lo(q), q], [a, hi(q), q], [a, hi(p), p], layer, tint);
  }
}

/** THE DECK, THE TRUSS, THE PIERS AND THE TAKE-OFF BLOCK. */
function buildDeck(kit: FacadeKit, level: Level, plan: SkiJumpPlan): void {
  const R = RAISED_LOOK;
  const y = (d: number) => plan.frame.hill.yAt(d);
  const { left, right } = deckSides(plan);
  const edge = plan.inRun.to;
  const ds: number[] = [];
  for (let d = 0; d < edge; d += 1) ds.push(d);
  ds.push(edge);
  const slab = (d: number) => y(d) - R.slab.under;
  // The slab: its fascia either side and its soffit.
  face(kit, ds, left, slab, (d) => y(d) - 0.38, -1, FACADE.concrete, CONCRETE);
  face(kit, ds, right, slab, (d) => y(d) - 0.58, 1, FACADE.concrete, CONCRETE);
  soffit(kit, ds, left, right, slab, FACADE.concrete, 0x9c9a95);
  // THE TAKE-OFF BLOCK: from the truss's end to the edge, walls down to the
  // ground either side, and the edge's face down to the knoll.
  const from = edge - R.block;
  const block = ds.filter((d) => d >= from);
  const foot = (a: number) => (d: number) => groundUnder(level, plan, d, a) - 0.4;
  face(kit, block, left, foot(left), slab, -1, FACADE.concrete, 0xbdbbb6);
  face(kit, block, right, foot(right), slab, 1, FACADE.concrete, 0xbdbbb6);
  kit.wall(
    left,
    from,
    right,
    from,
    groundUnder(level, plan, from) - 0.4,
    slab(from),
    FACADE.concrete,
    0xb2b0ab,
  );
  // THE TRUSS: two girders under the slab's edges.
  const [t0, t1] = trussSpan(plan);
  const T = R.truss;
  const panels: number[] = [];
  for (let d = t0; d < t1; d += T.panel) panels.push(d);
  panels.push(t1);
  const top = (d: number): number => slab(d) - 0.05;
  const low = (d: number): number => slab(d) - trussDepth(level, plan, d);
  const girders = [left + 0.25, right - 0.25];
  for (const a of girders) {
    for (let i = 0; i + 1 < panels.length; i++) {
      const d0 = panels[i];
      const d1 = panels[i + 1];
      strut(kit, [a, top(d0), d0], [a, top(d1), d1], T.chord, FACADE.steel, STEEL);
      strut(kit, [a, low(d0), d0], [a, low(d1), d1], T.chord, FACADE.steel, STEEL);
      // A diagonal each panel, leaning alternately: a Warren girder.
      const [p, q] = i % 2 === 0 ? [d0, d1] : [d1, d0];
      strut(kit, [a, top(p), p], [a, low(q), q], T.web, FACADE.steel, STEEL);
    }
    for (const d of panels) strut(kit, [a, top(d), d], [a, low(d), d], T.web, FACADE.steel, STEEL);
  }
  // The bracing between the girders: a beam at every panel point, and a
  // cross in every other panel under the bottom chords.
  const [ga, gb] = girders;
  for (let i = 0; i < panels.length; i++) {
    const d = panels[i];
    strut(kit, [ga, low(d), d], [gb, low(d), d], T.web, FACADE.steel, STEEL);
    if (i % 2 === 0 && i + 1 < panels.length) {
      const e = panels[i + 1];
      strut(kit, [ga, low(d), d], [gb, low(e), e], T.web * 0.8, FACADE.steel, STEEL);
      strut(kit, [gb, low(d), d], [ga, low(e), e], T.web * 0.8, FACADE.steel, STEEL);
    }
  }
  // THE PIERS: a tapered concrete leg each under a cross-head.
  const P = R.pier;
  const mid = (left + right) / 2;
  for (const d of pierPlaces(level, plan)) {
    const head = low(d) - 0.05;
    const base = groundUnder(level, plan, d, mid) - 0.8;
    const [fw, fl] = P.foot;
    const [hw, hl] = P.head;
    kit.frustum(
      [
        [mid - fw / 2, d - fl / 2],
        [mid + fw / 2, d - fl / 2],
        [mid + fw / 2, d + fl / 2],
        [mid - fw / 2, d + fl / 2],
      ],
      [
        [mid - hw / 2, d - hl / 2],
        [mid + hw / 2, d - hl / 2],
        [mid + hw / 2, d + hl / 2],
        [mid - hw / 2, d + hl / 2],
      ],
      base,
      head - P.cap,
      FACADE.concrete,
      CONCRETE,
      null,
    );
    kit.box(
      left - 0.2,
      head - P.cap,
      d - 0.6,
      right + 0.2,
      head,
      d + 0.6,
      FACADE.concrete,
      0xd6d4cf,
      {
        layer: FACADE.concrete,
        tint: 0xd6d4cf,
      },
    );
  }
}

/** THE START TOWER's shaft, its elevator and its stair tower, from the
 * ground up to the warming room's storey at the deck. */
function buildTower(kit: FacadeKit, level: Level, plan: SkiJumpPlan): void {
  const R = RAISED_LOOK;
  const S = R.shaft;
  const deck = plan.frame.hill.yAt(0);
  const foot = towerFoot(level, plan);
  const top = deck - 4;
  if (top - foot < 2) return;
  // The shaft: concrete, a slit of glazing up its face every storey.
  kit.box(-S.half, foot, S.from, S.half, top + 0.2, S.to, FACADE.concrete, CONCRETE, null);
  for (let y = foot + 3; y + 1.6 < top; y += 3.6) {
    kit.glow = 1;
    kit.wall(-1, S.to + 0.02, 1, S.to + 0.02, y, y + 1.5, FACADE.glazing, 0xffffff);
    kit.wall(
      S.half + 0.02,
      S.to - 1,
      S.half + 0.02,
      S.from + 1,
      y,
      y + 1.5,
      FACADE.glazing,
      0xffffff,
    );
    kit.glow = 0;
  }
  // THE ELEVATOR on the left: a glazed shaft on a steel frame, to the deck.
  const L = R.lift;
  const lx1 = -S.half;
  const lx0 = lx1 - L.wide;
  kit.glow = 1;
  kit.wall(lx0, L.to, lx1, L.to, foot, deck + 3.2, FACADE.glazing, 0xd8e6f2);
  kit.wall(lx0, L.from, lx0, L.to, foot, deck + 3.2, FACADE.glazing, 0xd8e6f2);
  kit.wall(lx1, L.from, lx0, L.from, foot, deck + 3.2, FACADE.glazing, 0xd8e6f2);
  kit.glow = 0;
  for (const [x, z] of [
    [lx0, L.from],
    [lx0, L.to],
  ] as const)
    kit.box(x - 0.12, foot, z - 0.12, x + 0.12, deck + 3.4, z + 0.12, FACADE.steel, DARK, null);
  kit.box(lx0 - 0.15, deck + 3.2, L.from - 0.15, lx1, deck + 3.6, L.to + 0.15, FACADE.steel, DARK, {
    layer: FACADE.snow,
    tint: 0xffffff,
  });
  // THE STAIR TOWER on the right: four corner posts, a landing every
  // flight, and the flights between them zig-zagging up.
  const St = R.stair;
  const sx0 = S.half;
  const sx1 = sx0 + St.wide;
  const corners: [number, number][] = [
    [sx0 + 0.15, St.from],
    [sx1, St.from],
    [sx1, St.to],
    [sx0 + 0.15, St.to],
  ];
  for (const [x, z] of corners)
    strut(kit, [x, foot, z], [x, deck + 1.2, z], 0.1, FACADE.steel, STEEL);
  let k = 0;
  for (let y = foot + St.flight; y < deck; y += St.flight, k++) {
    kit.box(sx0 + 0.15, y - 0.12, St.from, sx1, y, St.to, FACADE.steel, 0x7d868e, {
      layer: FACADE.steel,
      tint: 0x9aa3ab,
    });
    const [z0, z1] = k % 2 === 0 ? [St.from + 0.3, St.to - 0.3] : [St.to - 0.3, St.from + 0.3];
    const mx = (sx0 + sx1) / 2;
    strut(
      kit,
      [mx, y - St.flight + 0.1, z0] as V3,
      [mx, y - 0.1, z1] as V3,
      0.18,
      FACADE.steel,
      0x8b949c,
    );
    // The rail round the landing.
    strut(kit, [sx1, y + 1, St.from], [sx1, y + 1, St.to], 0.03, FACADE.steel, STEEL);
  }
  // Cross-bracing on the stair tower's outer face, every other flight.
  for (let y = foot; y + St.flight * 2 < deck; y += St.flight * 2) {
    strut(kit, [sx1, y, St.from], [sx1, y + St.flight * 2, St.to], 0.05, FACADE.steel, STEEL);
    strut(kit, [sx1, y, St.to], [sx1, y + St.flight * 2, St.from], 0.05, FACADE.steel, STEEL);
  }
}

/** THE RAISED IN-RUN and the tower's lower half, on `kit` in the hill's
 * frame (`ski-jump-build.ts` sets it). */
export function buildRaised(kit: FacadeKit, level: Level, plan: SkiJumpPlan): void {
  buildDeck(kit, level, plan);
  buildTower(kit, level, plan);
}

/** A box a lens keeps out of: the camera-clear module's `SolidBox`. */
export type RaisedSolid = {
  x: number;
  z: number;
  dx: number;
  dz: number;
  halfLength: number;
  halfWidth: number;
  base: number;
  top: number;
};

/** WHAT OF THE STRUCTURE IS SOLID TO A LENS: the deck and its truss in
 * stretches of ten metres (from the ground to the floor's top under the
 * walls), the take-off block, each pier and the tower with its elevator and
 * stair. The air over the trough is open — the chase boom rides down it. */
export function raisedSolids(level: Level, plan: SkiJumpPlan): RaisedSolid[] {
  const f = plan.frame;
  const { left, right } = deckSides(plan);
  const mid = (left + right) / 2;
  const half = (right - left) / 2;
  const out: RaisedSolid[] = [];
  const edge = plan.inRun.to;
  const along = (d0: number, d1: number, a: number, w: number, base: number, top: number) => {
    const p = hillPoint(f, (d0 + d1) / 2, a);
    out.push({
      x: p.x,
      z: p.z,
      dx: f.fx,
      dz: f.fz,
      halfLength: (d1 - d0) / 2,
      halfWidth: w,
      base,
      top,
    });
  };
  for (let d = 0; d < edge; d += 10) {
    const e = Math.min(edge, d + 10);
    const floor = Math.min(f.hill.yAt(d), f.hill.yAt(e));
    // Only the structure under the floor: from its lowest chord down.
    const lowest = floor - RAISED_LOOK.slab.under - trussDepth(level, plan, d);
    const base = d >= edge - RAISED_LOOK.block ? groundUnder(level, plan, d, mid) - 1 : lowest;
    along(d, e, mid, half, base, floor - 0.2);
  }
  for (const d of pierPlaces(level, plan)) {
    along(d - 1, d + 1, mid, 1.3, groundUnder(level, plan, d, mid) - 1, f.hill.yAt(d));
  }
  const S = RAISED_LOOK.shaft;
  const deck = f.hill.yAt(0);
  const xs = -S.half - RAISED_LOOK.lift.wide;
  const xe = S.half + RAISED_LOOK.stair.wide;
  along(
    plan.tower.from,
    plan.tower.to,
    (xs + xe) / 2,
    (xe - xs) / 2,
    towerFoot(level, plan),
    deck + 7,
  );
  return out;
}
