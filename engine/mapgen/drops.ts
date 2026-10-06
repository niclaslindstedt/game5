// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R24 — THE DROPS: cliff bands a black piste is built over, the air a black
// hands a skier that a kicker does not.
//
// A drop is R22's cliff laid ACROSS the line rather than beside it: the
// same profile (`cliffProfile` — a shelf climbing out of the ground, level
// with the line at its top; a face falling the whole lift over a couple of
// metres), added to the GRADED LINE by arc length, the way R9's kickers
// are, before the corridor is pressed into the ground — so the edge runs
// the whole width of the piste, its shoulders and its windrows, and the
// banks either side are the corridor's own.
//
// IT HAS NO APRON, on purpose. A skier leaves an edge taken along the line
// on a tangent, and whatever lies below it he comes down about the height
// of everything under that tangent: an apron built up over the line is
// height added to the fall, landed flat by anyone fast enough to overfly
// it. With the face falling straight back onto the line, the fall is the
// drop's and no more — √(2·g·drop) into a pitch going his way, the same at
// 8 m/s as at 30 — so the band is one the legs take whole, a black's air
// that asks for nerve and not for a speed only the bot could judge.
//
// WHERE: on a stretch that falls at least `drop.minFall` (a band of rock on
// a steep pitch, never a step on a flat), turns no more than
// `drop.straight` over its shelf, face and landing, and keeps the line
// falling over its shelf (R8 — a shelf is a flattening, never a climb: it
// is made long enough for that, or the stand is refused). Clear of the
// start gate by R12's gap, of the finish's run-out and of every GATE
// (R11), so the reset at a gate never stands a skier on
// a face; spaced along the piste. They are laid BEFORE the kickers (R9), which
// keep `drop.kickerClear` off them: a drop wants a steep straight pitch a
// long way from a gate, which is rarer than a roll.
//
// Dealt off a stream of their own (the attempt's sub-seed, salted), so a
// grade without drops draws nothing and a black's move nothing else the map
// draws.

import { angleDiff } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { cliffProfile } from "./cliffs.ts";
import type { GradeRow } from "./grades.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import { gateArcs, startGateArc } from "./spawn.ts";
import { finishFrom, type Piste } from "./track.ts";
import type { Cliff } from "./types.ts";

/** Salt on the attempt's sub-seed for the drops' own stream. */
const DROP_SALT = 0x0d7095e;

/** How many stands a drop is tried at before the dealer settles for the
 * drops it has. */
const TRIES = 90;

/** How much steeper than R8's floor the line must still fall over a
 * shelf's steepest rise, m per m: the blur and the corridor's stamp round
 * the shelf a little. */
const SHELF_SLACK = 0.04;

/** A drop as it is laid: the station of its edge and its profile, m. */
export type TrackDrop = {
  index: number;
  drop: number;
  shelf: number;
  face: number;
  apron: number;
  landing: number;
};

/** R24 — choose the drops across the piste and add them to the graded
 * profile, as many as the grade deals. Returns them in order down the
 * line. */
export function layDrops(
  sub: number,
  piste: Piste,
  grade: GradeRow,
  keepOff: readonly { from: number; to: number }[] = [],
): TrackDrop[] {
  if (grade.drops.max <= 0) return [];
  const D = R.drop;
  const rng = createRng((sub ^ DROP_SALT) >>> 0);
  const want = rng.int(grade.drops.min, grade.drops.max);
  const pts = piste.points;
  const n = pts.length;
  const step = piste.length / (n - 1);
  const gates = gateArcs(piste.length);
  const lo = startGateArc() + R.spawn.kickerGap + D.shelf.max;
  const hi = finishFrom(piste.length) - D.finishClear;
  const w = Math.max(1, Math.round(R.track.gradeWindow / step));
  /** The least fall over a grade window between two arcs, m per m. */
  const leastFall = (a: number, b: number): number => {
    let least = Infinity;
    const i0 = Math.max(0, Math.floor(a / step));
    const i1 = Math.min(n - 1 - w, Math.ceil(b / step));
    for (let i = i0; i <= i1; i++) least = Math.min(least, (pts[i].y - pts[i + w].y) / (w * step));
    return least;
  };
  const chosen: TrackDrop[] = [];
  for (let t = 0; t < want * TRIES && chosen.length < want && hi > lo; t++) {
    const index = Math.round(rng.range(lo, hi) / step);
    const drop = inBand(rng, D.drop);
    const s0 = pts[index].s;
    const apron = 0;
    const face = drop * R.cliff.face;
    const landing = D.landing;
    const top = drop;
    // A PITCH under it, and a shelf long enough that its steepest rise (a
    // smoothstep's, 1.5 × its height over its length) leaves the line
    // still falling: the shelf is sized off the pitch under the shortest
    // one, then the pitch read again under the shelf it came to.
    const shelfFor = (fall: number): number =>
      Math.max(D.shelf.min, (1.5 * top) / Math.max(1e-3, fall - R.track.minGrade - SHELF_SLACK));
    let fall = leastFall(s0 - D.shelf.min, s0 + face + landing);
    if (fall < D.minFall) continue;
    let shelf = shelfFor(fall);
    if (shelf > D.shelf.min) {
      fall = leastFall(s0 - shelf, s0 + face + landing);
      shelf = shelfFor(fall);
    }
    if (fall < D.minFall || shelf > D.shelf.max) continue;
    const from = s0 - shelf;
    const to = s0 + face + landing;
    // Straight over the whole of it.
    let lo2 = 0;
    let hi2 = 0;
    let turned = 0;
    for (let i = Math.floor(from / step); i < Math.ceil(to / step) && i + 1 < n; i++) {
      turned += angleDiff(pts[i].heading, pts[i + 1].heading);
      lo2 = Math.min(lo2, turned);
      hi2 = Math.max(hi2, turned);
    }
    if (hi2 - lo2 > D.straight) continue;
    // Off the gates and the other drops.
    if (gates.some((g) => g > from - D.gateClear && g < to + D.gateClear)) continue;
    if (chosen.some((d) => Math.abs(pts[d.index].s - s0) < D.spacing)) continue;
    if (keepOff.some((k) => from < k.to && to > k.from)) continue;
    chosen.push({ index, drop, shelf, face, apron, landing });
  }
  chosen.sort((a, b) => a.index - b.index);
  for (const d of chosen) {
    const s0 = pts[d.index].s;
    for (
      let i = Math.floor((s0 - d.shelf) / step);
      i <= Math.ceil((s0 + d.face + d.landing) / step);
      i++
    ) {
      const p = pts[i];
      if (p) p.y += cliffProfile(d, p.s - s0);
    }
  }
  return chosen;
}

/** Publish the drops against the finished line: `D1…` in the order they
 * are skied, each a cliff across the piste (`onTrack`). */
export function publishDrops(piste: Piste, drops: readonly TrackDrop[]): Cliff[] {
  return drops.map((d, k) => {
    const p = piste.points[d.index];
    return {
      id: `D${k + 1}`,
      x: p.x,
      z: p.z,
      y: p.y,
      heading: p.heading,
      drop: d.drop,
      face: d.face,
      apron: d.apron,
      landing: d.landing,
      shelf: d.shelf,
      width: p.width,
      onTrack: true,
      s: p.s,
    } satisfies Cliff;
  });
}
