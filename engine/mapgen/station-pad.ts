// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26 — THE PAD a top station stands on, and a chair's UNLOAD RAMP on it.
//
// A lift's top is not a point on the face: it is an area cut and filled into
// the slope (`docs/summit-stations.md`), where a rider coming off a chair or
// out of a cabin gets his bearings and picks his way down. On a peak it is
// cut more than filled — a quarter of the fill a pad level with its middle
// would need — so the bank above it is a cut and its downhill edge a LIP:
// the pad's snow rolling over onto the face, the drop a skier pushes off
// over. Its DECK along the line — the wheel, the ramp and the way off — is
// level, and from the deck it LEANS off to both sides (`lift.top`), so a
// rider stood off the chair slides off it toward whichever run he picks,
// gathering speed on the way rather than poling across a flat. A chair's pad
// carries its UNLOAD RAMP: a mound of packed snow under the point a few
// metres short of the bullwheel where the rider stands up, falling off
// whichever way he turns, so he slides off the chair clear of it swinging
// round the wheel. (Generator v4's pads are level and smaller,
// `levelPads`.)
//
// Pressed into the ground BEFORE the runs are walked, so the pistes start
// off the pad's edges as the mountain now is (R12) and press their own
// surfaces over it; groomed once the crust is folded in. Every number is
// `RESORT_RULES.lift`'s.

import { hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import type { Lift } from "./types.ts";

/** What a pad is cut to: its radius, m; the half-width of its level deck
 * either side of the line, m; and how fast it falls off the deck to its
 * rim, m per m. */
export type PadShape = { r: number; deck: number; lean: number };

/** The pad a version cuts (`levelPads`: v4's, level and 30 m across). */
export function padShape(levelPads = false): PadShape {
  const L = RR.lift;
  return levelPads
    ? { r: L.pad / 2, deck: L.pad / 2, lean: 0 }
    : { r: L.top.pad / 2, deck: L.top.deck, lean: L.top.lean };
}

/** A top station's pad: its middle (the top of the line), the level of its
 * deck, its shape, the way up the line (a unit vector), and — on a chair —
 * the unload point. */
export type StationPad = PadShape & {
  lift: string;
  x: number;
  z: number;
  y: number;
  dx: number;
  dz: number;
  unload: { x: number; z: number } | null;
};

/** The pad's own surface at (x, z): the deck's level, less its lean past
 * the deck — held at the rim's beyond it, where the pad is eased into the
 * mountain. */
export function padSurface(p: StationPad, x: number, z: number): number {
  const v = Math.abs((x - p.x) * p.dz - (z - p.z) * p.dx);
  return p.y - p.lean * Math.max(0, Math.min(v, p.r) - p.deck);
}

/** The lifts whose tops stand on a pad: every gondola and chair — a drag's
 * top is a pad of its own, held by `lift.drag.padGrade`. */
export function padded(kind: Lift["kind"]): boolean {
  return kind !== "drag";
}

/** Where a chair's rider stands up: `lift.unload.at` metres short of its
 * top, down its line. */
export function unloadPoint(
  bottom: { x: number; z: number },
  top: { x: number; z: number },
): { x: number; z: number } {
  const len = Math.max(1, hypot(top.x - bottom.x, top.z - bottom.z));
  const back = RR.lift.unload.at / len;
  return { x: top.x + (bottom.x - top.x) * back, z: top.z + (bottom.z - top.z) * back };
}

/** R26 — press every padded top's pad (and a chair's ramp) into `ground`,
 * cut to `shape`. Pure over the plan: draws nothing from the stream. */
export function pressPads(
  ground: Heightfield,
  lifts: readonly {
    id: string;
    kind: Lift["kind"];
    bottom: { x: number; z: number };
    top: { x: number; z: number };
  }[],
  shape: PadShape,
): StationPad[] {
  const L = RR.lift;
  const { r } = shape;
  const pads: StationPad[] = [];
  for (const l of lifts) {
    if (!padded(l.kind)) continue;
    const { x, z } = l.top;
    // The level: the middle's height eased down toward the lowest of the
    // pad's rim by all but `padCut` of the fill it would need.
    const mid = sampleField(ground, x, z);
    let lo = mid;
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2;
      lo = Math.min(lo, sampleField(ground, x + Math.sin(t) * r, z + Math.cos(t) * r));
    }
    const y = lo + (mid - lo) * L.padCut;
    const len = Math.max(1, hypot(x - l.bottom.x, z - l.bottom.z));
    const pad: StationPad = {
      ...shape,
      lift: l.id,
      x,
      z,
      y,
      dx: (x - l.bottom.x) / len,
      dz: (z - l.bottom.z) / len,
      unload: l.kind === "chair" ? unloadPoint(l.bottom, l.top) : null,
    };
    levelPad(ground, pad);
    pads.push(pad);
  }
  return pads;
}

/** R26 — press the pads again at the levels they were cut to, everywhere
 * but on a run (`onRun`): a lane graded across the ground eased into a pad
 * cut its own surface there (R27), and its line is the one it was graded
 * to — the rest of the station's ground is the pad's. */
export function relevelPads(
  ground: Heightfield,
  pads: readonly StationPad[],
  onRun: (x: number, z: number) => boolean,
): void {
  for (const p of pads) levelPad(ground, p, onRun);
}

/** One pad eased into `ground` at its own surface, and a chair's ramp
 * raised on it. */
function levelPad(
  ground: Heightfield,
  p: StationPad,
  onRun: ((x: number, z: number) => boolean) | null = null,
): void {
  const L = RR.lift;
  const { r } = p;
  const reach = r + L.padBlend;
  const cell = ground.cell;
  const c0 = Math.max(0, Math.floor((p.x - reach - ground.originX) / cell));
  const c1 = Math.min(ground.cols - 1, Math.ceil((p.x + reach - ground.originX) / cell));
  const r0 = Math.max(0, Math.floor((p.z - reach - ground.originZ) / cell));
  const r1 = Math.min(ground.rows - 1, Math.ceil((p.z + reach - ground.originZ) / cell));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const px = ground.originX + col * cell;
      const pz = ground.originZ + row * cell;
      const d = hypot(px - p.x, pz - p.z);
      if (d >= reach || (onRun && onRun(px, pz))) continue;
      const i = row * ground.cols + col;
      const w = 1 - smoothstep(r, reach, d);
      let h = ground.data[i] * (1 - w) + padSurface(p, px, pz) * w;
      if (p.unload) {
        const du = hypot(px - p.unload.x, pz - p.unload.z);
        h += L.unload.height * (1 - smoothstep(0, L.unload.reach, du));
      }
      ground.data[i] = h;
    }
  }
}

/** R26 — groom every pad and the ground eased into it — up to a run's edge
 * and never over its snow (`onRun`): a run's surface is its own, drifts and
 * all (R17). */
export function groomPads(
  pads: readonly StationPad[],
  packed: Heightfield,
  onRun: (x: number, z: number) => boolean,
): void {
  const L = RR.lift;
  const cell = packed.cell;
  for (const p of pads) {
    const { r } = p;
    const reach = r + L.padBlend / 2;
    const far = reach;
    const c0 = Math.max(0, Math.floor((p.x - far - packed.originX) / cell));
    const c1 = Math.min(packed.cols - 1, Math.ceil((p.x + far - packed.originX) / cell));
    const r0 = Math.max(0, Math.floor((p.z - far - packed.originZ) / cell));
    const r1 = Math.min(packed.rows - 1, Math.ceil((p.z + far - packed.originZ) / cell));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const x = packed.originX + col * cell;
        const z = packed.originZ + row * cell;
        const groom = 1 - smoothstep(r, reach, hypot(x - p.x, z - p.z));
        const i = row * packed.cols + col;
        if (groom > packed.data[i] && !onRun(x, z)) packed.data[i] = groom;
      }
    }
  }
}
