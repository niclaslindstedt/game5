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
// carries its UNLOAD RAMP: packed snow under the point a few metres short
// of the bullwheel where the rider stands up, falling from it on up the
// line, so he slides off the chair ahead of it and clear of it swinging
// round the wheel.
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
 * either side of the line, m; how fast it falls off the deck to its rim, m
 * per m. */
export type PadShape = {
  r: number;
  deck: number;
  lean: number;
};

/** The pad R26 cuts. */
export function padShape(): PadShape {
  const L = RR.lift;
  return { r: L.top.pad / 2, deck: L.top.deck, lean: L.top.lean };
}

/** A top station's pad: its middle (the top of the line), the level of its
 * deck, its shape, the way up the line (a unit vector), and — on a chair —
 * the unload point. */
export type StationPad = PadShape & {
  lift: string;
  kind: Lift["kind"];
  x: number;
  z: number;
  y: number;
  dx: number;
  dz: number;
  /** The line's plan length, m. */
  length: number;
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

/** A DRAG'S TOP as the ramps off it read it (R26): the ground a rider is
 * let go on, `lift.drag.rim` m round the point `lift.drag.letGo` m short of
 * its top wheel, at that ground's height (`height`) — never pressed, a
 * drag's top standing on ground level enough to step off onto
 * (`lift.drag.padGrade`). */
export function dragTop(
  l: { id: string; bottom: { x: number; z: number }; top: { x: number; z: number } },
  height: (x: number, z: number) => number,
): StationPad {
  const D = RR.lift.drag;
  const len = Math.max(1, hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z));
  const dx = (l.top.x - l.bottom.x) / len;
  const dz = (l.top.z - l.bottom.z) / len;
  const x = l.top.x - dx * D.letGo;
  const z = l.top.z - dz * D.letGo;
  return {
    r: D.rim,
    deck: D.rim,
    lean: 0,
    lift: l.id,
    kind: "drag",
    x,
    z,
    y: height(x, z),
    dx,
    dz,
    length: len - D.letGo,
    unload: null,
  };
}

/** Every drag's top a run leaves (`dragTop`). */
export function dragTopsOf(
  lifts: readonly {
    id: string;
    kind: Lift["kind"];
    bottom: { x: number; z: number };
    top: { x: number; z: number };
  }[],
  runs: readonly { from: string }[],
  height: (x: number, z: number) => number,
): StationPad[] {
  return lifts
    .filter((l) => !padded(l.kind) && runs.some((r) => r.from === l.id))
    .map((l) => dragTop(l, height));
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
      kind: l.kind,
      length: len,
      x,
      z,
      y,
      dx: (x - l.bottom.x) / len,
      dz: (z - l.bottom.z) / len,
      unload: l.kind === "chair" ? unloadPoint(l.bottom, l.top) : null,
    };
    levelPad(ground, pad);
    if (shape.lean > 0) cutApproach(ground, pad);
    pads.push(pad);
  }
  return pads;
}

/** R26 — THE APPROACH to a top: under the last
 * `lift.top.approach.length` metres of the line, from just past the unload
 * on back down it, the ground cut down below the rope's way in — a straight
 * line from the top's bullwheel (`approach.wheel` over the deck) to a tower
 * (`approach.tower` over the ground there) — by a carrier's hang and
 * `approach.clear` more, so the mountain falls away under the line and no
 * shoulder of it, nor the pad itself, stands up into the chairs as they come
 * in: a rider is carried over the snow, never dragged up through it. Only
 * ever cut, never filled, `half` metres either side of the line and eased
 * out over `blend` more; never over a run's snow (`onRun`). */
function cutApproach(
  ground: Heightfield,
  p: StationPad,
  onRun: ((x: number, z: number) => boolean) | null = null,
): void {
  const A = RR.lift.top.approach;
  const k = p.kind === "gondola" ? "gondola" : "chair";
  const reach = Math.min(A.length, p.length / 2);
  const half = A.half[k];
  const far = half + A.blend;
  const b0 = k === "chair" ? A.from.chair : A.from.gondola;
  const bx = p.x - p.dx * reach;
  const bz = p.z - p.dz * reach;
  // The rope's way in, wheel to tower, and what hangs under it.
  const wheel = p.y + A.wheel[k];
  const tower = sampleField(ground, bx, bz) + A.tower[k];
  const under = A.hang[k] + A.clear;
  const cell = ground.cell;
  const xs = [p.x, bx];
  const zs = [p.z, bz];
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - far - ground.originX) / cell));
  const c1 = Math.min(ground.cols - 1, Math.ceil((Math.max(...xs) + far - ground.originX) / cell));
  const r0 = Math.max(0, Math.floor((Math.min(...zs) - far - ground.originZ) / cell));
  const r1 = Math.min(ground.rows - 1, Math.ceil((Math.max(...zs) + far - ground.originZ) / cell));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const x = ground.originX + col * cell;
      const z = ground.originZ + row * cell;
      // Back down the line from the top, and across it.
      const back = (p.x - x) * p.dx + (p.z - z) * p.dz;
      const v = Math.abs((x - p.x) * p.dz - (z - p.z) * p.dx);
      if (back < b0 - A.ease || back > reach || v > far || (onRun && onRun(x, z))) continue;
      const rope = wheel + ((tower - wheel) * back) / reach;
      const w = (1 - smoothstep(half, far, v)) * smoothstep(b0 - A.ease, b0, back);
      const i = row * ground.cols + col;
      const cut = rope - under;
      if (ground.data[i] > cut) ground.data[i] -= (ground.data[i] - cut) * w;
    }
  }
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
  for (const p of pads) {
    levelPad(ground, p, onRun);
    if (p.lean > 0) cutApproach(ground, p, onRun);
  }
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
      if (p.unload) h += L.unload.height * unloadRise(p, p.unload, px, pz);
      ground.data[i] = h;
    }
  }
}

/** A chair's UNLOAD RAMP at (x, z), a share of its height: a RAMP — whole
 * under the chair and
 * the lane beside it up to the unload point, and falling from it on up the
 * line over `lift.unload.reach`, so a rider stood up there slides on ahead
 * of the chair and never back into the cut under its way in. */
function unloadRise(p: StationPad, at: { x: number; z: number }, x: number, z: number): number {
  const U = RR.lift.unload;
  const along = (x - at.x) * p.dx + (z - at.z) * p.dz;
  const across = Math.abs((x - at.x) * p.dz - (z - at.z) * p.dx);
  return (
    (1 - smoothstep(0, U.reach, along)) *
    (1 - smoothstep(U.half, U.half + U.edge, across)) *
    smoothstep(-U.back - U.edge, -U.back, along)
  );
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
