// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RACE COURSE PREPARED — what the organisers do to a built map's piste
// before a discipline is set on it (R31 the slalom, R32 the downhill): the
// piste's kickers on the course LEVELLED away, a START DROP cut out of the
// start house's door, the snow GROOMED hard from the house to the end of
// the run-out whatever drift lay across it, the relief under the course
// COMBED smooth of the short lips a steep face carries, and the trees CUT
// for the course and its finish arena. The rest of the mountain is the
// map's own.
//
// Each discipline hands its own numbers (`CoursePrep`, stated in
// `discipline-rules.ts`) and the stretch it is set on; the prepared map is
// kept per map and per discipline, so a slalom's two runs, or a restart,
// stand on the one prepared hill.

import {
  sampleField,
  sampleFieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { clamp, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { kickerProfile } from "./kickers.ts";
import { LEVEL_RULES } from "./rules.ts";
import { nearestTrackPoint, trackPointAt } from "./query.ts";
import type { Kicker, Level, TrackPoint, Vec3 } from "./types.ts";

/** The stretch of the piste a course is set on: the start gate's arc (the
 * wand) and the finish line's, m. */
export type Stretch = { from: number; to: number };

/** WHAT A DISCIPLINE ASKS OF THE HILL, every length in metres. */
export type CoursePrep = {
  /** How far either side of the stretch a kicker on the piste is levelled. */
  readonly clearance: number;
  /** The finish's run-out past the line, groomed with the course. */
  readonly outrunLength: number;
  /** How far above the wand's line the racer stands in the house. */
  readonly stand: number;
  /** The combing: over how far either side of each point the ground is
   * taken to its mean, and how far past the piste's edge it eases out. */
  readonly comb: { readonly reach: number; readonly ease: number };
  /** The start drop: level for `lip`, steepened to `grade` at its
   * steepest over the next `length` — never more than `most` deep — eased
   * back over `ease`, its banks `shoulder` wide either side of the piste. */
  readonly drop: {
    readonly lip: number;
    readonly length: number;
    readonly grade: number;
    readonly most: number;
    readonly ease: number;
    readonly shoulder: number;
  };
  /** Trees cleared within this of the piste's edge along the course, and
   * the finish arena's box past the line: along, back up, across. */
  readonly clear: number;
  readonly arena: { readonly past: number; readonly before: number; readonly half: number };
  /** THE CRESTS SHAVED (a speed event's): no crest down the course sharper
   * than this radius, m — the snow cut off the top of every knoll and lip
   * that is, so a racer flown off it at speed comes down on the slope
   * below it rather than on the flat past it. Left out, no crest is cut. */
  readonly crest?: number;
};

/** A cut down into the snow along the piste: how deep, m, `u` m down it
 * from `at`, between `from` and `to`, its banks `ease` m wide either side. */
type Cut = { at: number; from: number; to: number; ease: number; depth: (u: number) => number };

/** THE START DROP below `stretch`'s wand (`P.drop`): as deep as
 * steepens its first metres to the rule's grade, or null where the hill
 * is already that steep. */
function startDrop(level: Level, stretch: Stretch, P: CoursePrep): Cut | null {
  const D = P.drop;
  const top = trackPointAt(level, stretch.from + D.lip).y;
  const low = trackPointAt(level, stretch.from + D.lip + D.length).y;
  const natural = (top - low) / D.length;
  // A smoothstep's steepest is 1.5 times its mean.
  const deep = Math.min(D.most, (Math.max(0, D.grade - natural) * D.length) / 1.5);
  if (deep < 0.05) return null;
  const knee = D.lip + D.length;
  return {
    at: stretch.from,
    from: D.lip,
    to: knee + D.ease,
    ease: D.shoulder,
    depth: (u) =>
      u < knee
        ? deep * smoothstep(D.lip, knee, u)
        : deep * (1 - smoothstep(knee, knee + D.ease, u)),
  };
}

/** THE MAP WITH A COURSE PREPARED ON IT: every kicker on the piste
 * within `P.clearance` of the stretch LEVELLED — its profile taken back
 * out of the piste's line and the ground under it, across the piste and
 * eased out over the shoulders — so a racer meets the hill the piste was
 * graded on rather than a jump; the START DROP cut out of the door the
 * same way; the snow groomed hard; and the relief under the course COMBED
 * smooth (`combStretch`). The rest of the mountain is the map's own.
 * Kept per map, so both runs stand on one prepared hill. */
const prepared = new WeakMap<Level, Map<CoursePrep, Level>>();
export function prepareCourse(level: Level, stretch: Stretch, P: CoursePrep): Level {
  let mine = prepared.get(level);
  if (!mine) {
    mine = new Map();
    prepared.set(level, mine);
  }
  const known = mine.get(P);
  if (known) return known;
  const lo = stretch.from - P.clearance;
  const hi = stretch.to + P.clearance + P.outrunLength;
  const kept: Kicker[] = [];
  const cuts: Cut[] = [];
  for (const k of level.kickers ?? []) {
    const on = k.onTrack && k.s !== undefined && k.s + k.landing > lo && k.s - k.ramp < hi;
    if (!on) kept.push(k);
    else {
      cuts.push({
        at: k.s ?? 0,
        from: -k.ramp,
        to: k.landing,
        ease: 6,
        depth: (u) => kickerProfile(k.height, k.ramp, k.landing, u, k.shape),
      });
    }
  }
  const drop = startDrop(level, stretch, P);
  if (drop) cuts.push(drop);
  const packed = groomStretch(level, stretch, P);
  const snow = packed
    ? { packed, packedAt: (x: number, z: number) => sampleField(packed, x, z) }
    : {};
  const field = level.ground;
  const ground: Heightfield = { ...field, data: new Float32Array(field.data) };
  const points = level.track.points.map((p) => ({ ...p }));
  for (const cut of cuts) {
    for (const p of points) {
      const u = p.s - cut.at;
      if (u > cut.from && u < cut.to) p.y -= cut.depth(u);
    }
    // The ground under it, a cell at a time over the box round its line.
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let s = cut.at + cut.from; s <= cut.at + cut.to; s += 2) {
      const p = trackPointAt(level, s);
      const r = p.width / 2 + cut.ease + 2;
      x0 = Math.min(x0, p.x - r);
      x1 = Math.max(x1, p.x + r);
      z0 = Math.min(z0, p.z - r);
      z1 = Math.max(z1, p.z + r);
    }
    const c0 = clamp(Math.floor((x0 - field.originX) / field.cell), 0, field.cols - 1);
    const c1 = clamp(Math.ceil((x1 - field.originX) / field.cell), 0, field.cols - 1);
    const r0 = clamp(Math.floor((z0 - field.originZ) / field.cell), 0, field.rows - 1);
    const r1 = clamp(Math.ceil((z1 - field.originZ) / field.cell), 0, field.rows - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = field.originX + c * field.cell;
        const z = field.originZ + r * field.cell;
        const hit = nearestTrackPoint(level, x, z);
        const u = hit.s - cut.at;
        if (u <= cut.from || u >= cut.to) continue;
        const half = (level.track.points[hit.index]?.width ?? 0) / 2;
        const weight = 1 - smoothstep(half, half + cut.ease, hit.distance);
        if (weight <= 0) continue;
        ground.data[r * field.cols + c] -= weight * cut.depth(u);
      }
    }
  }
  combStretch(level, stretch, P, ground, points);
  if (P.crest !== undefined) shaveCrests(level, stretch, P, P.crest, ground, points);
  const scratch = new Float64Array(3);
  const out: Level = {
    ...level,
    ground,
    groundAt: (x, z) => sampleField(ground, x, z),
    normalAt: (x: number, z: number, n: Vec3) => {
      sampleFieldGradient(ground, x, z, scratch);
      const nx = -scratch[1];
      const nz = -scratch[2];
      const inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      n.x = nx * inv;
      n.y = inv;
      n.z = nz * inv;
    },
    track: { ...level.track, points },
    kickers: kept,
    ...snow,
  };
  mine.set(P, out);
  return out;
}

/** THE HILL COMBED SMOOTH: no race is set on a mogul field.
 * Some faces — a black's, most of all — carry a lip every 5–7 m down the
 * piste, and at a slalom's pace each one throws a racer off the snow for a
 * fifth to a half of a second: a third of the course flown, no edge on the
 * snow to turn on, and a racer landed on his side out of a turn. So the
 * ground under the course and its banks, from the hut to halfway down the
 * run-out, is taken to its own mean over `P.comb.reach` metres either
 * side of each cell — a box twice a lip's length, so the lips go and the
 * pitch, a straight slope under any mean, stays — eased out over
 * `P.comb.ease` past the piste's edge and over its first and last
 * metres down it. The piste's own heights follow the ground under them.
 * Writes `ground` and `points`. */
function combStretch(
  level: Level,
  stretch: Stretch,
  P: CoursePrep,
  ground: Heightfield,
  points: TrackPoint[],
): void {
  const C = P.comb;
  const src = new Float32Array(ground.data);
  const reach = Math.max(1, Math.round(C.reach / ground.cell));
  const lo = stretch.from - P.stand;
  const hi = stretch.to + P.outrunLength / 2;
  const fade = C.ease;
  const seen = new Uint8Array(ground.data.length);
  // A box at a time down the stretch, so a long course on the skew never
  // walks the whole map's grid.
  const STEP = 16;
  for (let s0 = lo; s0 < hi; s0 += STEP) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let s = s0; s <= Math.min(hi, s0 + STEP); s += 2) {
      const p = trackPointAt(level, s);
      const r = p.width / 2 + C.ease + 2;
      x0 = Math.min(x0, p.x - r);
      x1 = Math.max(x1, p.x + r);
      z0 = Math.min(z0, p.z - r);
      z1 = Math.max(z1, p.z + r);
    }
    const c0 = clamp(
      Math.floor((x0 - ground.originX) / ground.cell),
      reach,
      ground.cols - 1 - reach,
    );
    const c1 = clamp(
      Math.ceil((x1 - ground.originX) / ground.cell),
      reach,
      ground.cols - 1 - reach,
    );
    const r0 = clamp(
      Math.floor((z0 - ground.originZ) / ground.cell),
      reach,
      ground.rows - 1 - reach,
    );
    const r1 = clamp(
      Math.ceil((z1 - ground.originZ) / ground.cell),
      reach,
      ground.rows - 1 - reach,
    );
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * ground.cols + c;
        if (seen[i] === 1) continue;
        seen[i] = 1;
        const hit = nearestTrackPoint(
          level,
          ground.originX + c * ground.cell,
          ground.originZ + r * ground.cell,
        );
        if (hit.s <= lo || hit.s >= hi) continue;
        const half = (level.track.points[hit.index]?.width ?? 0) / 2;
        const weight =
          (1 - smoothstep(half, half + C.ease, hit.distance)) *
          smoothstep(lo, lo + fade, hit.s) *
          (1 - smoothstep(hi - fade, hi, hit.s));
        if (weight <= 0) continue;
        let sum = 0;
        for (let dr = -reach; dr <= reach; dr++) {
          const row = (r + dr) * ground.cols + c;
          for (let dc = -reach; dc <= reach; dc++) sum += src[row + dc];
        }
        const mean = sum / ((2 * reach + 1) * (2 * reach + 1));
        ground.data[i] = src[i] + weight * (mean - src[i]);
      }
    }
  }
  const before: Heightfield = { ...ground, data: src };
  for (const p of points) {
    if (p.s <= lo || p.s >= hi) continue;
    p.y += sampleField(ground, p.x, p.z) - sampleField(before, p.x, p.z);
  }
}

/** THE CRESTS SHAVED: the piste's profile down the course (its stations'
 * heights) held to bend over no crest tighter than `radius` m — every
 * station standing too high over the chord between its neighbours lowered
 * onto it, again and again until none does, which only ever cuts snow
 * away — and the ground under each station cut by as much, across the
 * piste and eased out over its shoulders, a box at a time down the course.
 * A knoll a racer would fly off onto the flat past it becomes a rounded
 * roll he flies off onto its own downslope. Writes `ground` and
 * `points`. */
function shaveCrests(
  level: Level,
  stretch: Stretch,
  P: CoursePrep,
  radius: number,
  ground: Heightfield,
  points: TrackPoint[],
): void {
  const lo = stretch.from;
  const hi = Math.min(level.track.length, stretch.to + P.outrunLength / 2);
  const idx: number[] = [];
  for (let i = 0; i < points.length; i++) if (points[i].s >= lo && points[i].s <= hi) idx.push(i);
  const n = idx.length;
  if (n < 3) return;
  const y = new Float64Array(n);
  for (let k = 0; k < n; k++) y[k] = points[idx[k]].y;
  const was = Float64Array.from(y);
  const h = (points[idx[n - 1]].s - points[idx[0]].s) / (n - 1);
  const lim = (h * h) / radius;
  for (let pass = 0; pass < 4000; pass++) {
    let moved = false;
    for (let k = 1; k < n - 1; k++) {
      if (y[k - 1] - 2 * y[k] + y[k + 1] < -lim - 1e-9) {
        y[k] = (y[k - 1] + y[k + 1] + lim) / 2;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const cut = new Float64Array(n);
  let any = false;
  for (let k = 0; k < n; k++) {
    cut[k] = was[k] - y[k];
    if (cut[k] > 1e-4) any = true;
    points[idx[k]].y = y[k];
  }
  if (!any) return;
  const s0 = points[idx[0]].s;
  const depthAt = (s: number): number => {
    const f = clamp((s - s0) / h, 0, n - 1);
    const k = Math.min(n - 2, Math.floor(f));
    return cut[k] + (cut[k + 1] - cut[k]) * (f - k);
  };
  const ease = P.comb.ease;
  const seen = new Uint8Array(ground.data.length);
  const STEP = 16;
  for (let a = lo; a < hi; a += STEP) {
    // A box of the course with nothing to cut in it is passed over.
    let deepest = 0;
    for (let s = a; s <= Math.min(hi, a + STEP); s += 2) deepest = Math.max(deepest, depthAt(s));
    if (deepest < 1e-3) continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let s = a; s <= Math.min(hi, a + STEP); s += 2) {
      const p = trackPointAt(level, s);
      const r = p.width / 2 + ease + 2;
      x0 = Math.min(x0, p.x - r);
      x1 = Math.max(x1, p.x + r);
      z0 = Math.min(z0, p.z - r);
      z1 = Math.max(z1, p.z + r);
    }
    const c0 = clamp(Math.floor((x0 - ground.originX) / ground.cell), 0, ground.cols - 1);
    const c1 = clamp(Math.ceil((x1 - ground.originX) / ground.cell), 0, ground.cols - 1);
    const r0 = clamp(Math.floor((z0 - ground.originZ) / ground.cell), 0, ground.rows - 1);
    const r1 = clamp(Math.ceil((z1 - ground.originZ) / ground.cell), 0, ground.rows - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * ground.cols + c;
        if (seen[i] === 1) continue;
        seen[i] = 1;
        const hit = nearestTrackPoint(
          level,
          ground.originX + c * ground.cell,
          ground.originZ + r * ground.cell,
        );
        if (hit.s < lo || hit.s > hi) continue;
        const half = (level.track.points[hit.index]?.width ?? 0) / 2;
        const weight = 1 - smoothstep(half, half + ease, hit.distance);
        if (weight <= 0) continue;
        ground.data[i] -= weight * depthAt(hit.s);
      }
    }
  }
}

/** THE COURSE PREPARED HARD: a race is run on a piste groomed and set
 * firm from the start hut to the end of the run-out, whatever drift (R17)
 * the wind laid across it — the packed field (R10) brought back to the
 * groomer's across the piste and its shoulders over that stretch, and the
 * rest of the mountain left as it lies. Null when the map carries no
 * packed field or the course already lies on the groomer. */
function groomStretch(level: Level, stretch: Stretch, P: CoursePrep): Heightfield | null {
  const field = level.packed;
  if (!field) return null;
  const fade = LEVEL_RULES.track.shoulder.packed;
  const lo = stretch.from - P.stand - 4;
  const hi = stretch.to + P.outrunLength;
  let data: Float32Array | null = null;
  // A box at a time down the stretch, so a long course on the skew never
  // walks the whole map's grid.
  const STEP = 16;
  for (let s0 = lo; s0 < hi; s0 += STEP) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let s = s0; s <= Math.min(hi, s0 + STEP); s += 2) {
      const p = trackPointAt(level, s);
      const r = p.width / 2 + fade + 1;
      x0 = Math.min(x0, p.x - r);
      x1 = Math.max(x1, p.x + r);
      z0 = Math.min(z0, p.z - r);
      z1 = Math.max(z1, p.z + r);
    }
    const c0 = clamp(Math.floor((x0 - field.originX) / field.cell), 0, field.cols - 1);
    const c1 = clamp(Math.ceil((x1 - field.originX) / field.cell), 0, field.cols - 1);
    const r0 = clamp(Math.floor((z0 - field.originZ) / field.cell), 0, field.rows - 1);
    const r1 = clamp(Math.ceil((z1 - field.originZ) / field.cell), 0, field.rows - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const hit = nearestTrackPoint(
          level,
          field.originX + c * field.cell,
          field.originZ + r * field.cell,
        );
        if (hit.s < lo || hit.s > hi) continue;
        const half = (level.track.points[hit.index]?.width ?? 0) / 2;
        const firm = 1 - smoothstep(half, half + fade, hit.distance);
        const i = r * field.cols + c;
        if (firm <= (data ?? field.data)[i]) continue;
        data ??= new Float32Array(field.data);
        data[i] = firm;
      }
    }
  }
  return data ? { ...field, data } : null;
}

const cleared = new WeakMap<Level, Map<CoursePrep, Level["trees"]>>();

/** The woods with the course and its finish arena cut out of them. */
export function clearedTrees(level: Level, stretch: Stretch, P: CoursePrep): Level["trees"] {
  let mine = cleared.get(level);
  if (!mine) {
    mine = new Map();
    cleared.set(level, mine);
  }
  const known = mine.get(P);
  if (known) return known;
  const A = P.arena;
  const fin = trackPointAt(level, stretch.to);
  const fx = Math.sin(fin.heading);
  const fz = Math.cos(fin.heading);
  // The box round the course and its arena: a tree outside it is kept
  // without asking where the piste is.
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let s = stretch.from - 20; s <= stretch.to + A.past; s += 4) {
    const p = trackPointAt(level, s);
    const r = Math.max(p.width / 2 + P.clear, A.half) + 4;
    x0 = Math.min(x0, p.x - r);
    x1 = Math.max(x1, p.x + r);
    z0 = Math.min(z0, p.z - r);
    z1 = Math.max(z1, p.z + r);
  }
  const kept = level.trees.filter((t) => {
    if (t.x < x0 || t.x > x1 || t.z < z0 || t.z > z1) return true;
    const dx = t.x - fin.x;
    const dz = t.z - fin.z;
    const along = dx * fx + dz * fz;
    const side = dx * fz - dz * fx;
    if (along > -A.before && along < A.past && Math.abs(side) < A.half) return false;
    const hit = nearestTrackPoint(level, t.x, t.z);
    if (hit.s < stretch.from - 20 || hit.s > stretch.to + 10) return true;
    const width = level.track.points[hit.index]?.width ?? 20;
    return hit.distance > width / 2 + P.clear;
  });
  mine.set(P, kept);
  return kept;
}
