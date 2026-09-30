// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R5–R8, R10 — THE PISTE: walked, measured, graded into the mountain.
//
// THE SHAPE IS A WALK DOWN THE FALL LINE. The line starts under the summit
// ridge (spawn.ts) and steps down the mountain two metres at a time, its
// heading bending either side of the fall line on a slow wave — an S of
// sweeping turns — with a few deliberate SWEEPS held across the face, and
// the untouched ground steering it: off any heading it would not fall
// along (a gully's far wall, a side ridge), and off any it would fall
// along too steeply (a headwall is crossed, never dropped). Because the
// heading never comes within a right angle of straight across, z grows
// with every step, which is what makes the line an open DESCENT: it can
// never cross itself, and every station is lower down the map than the one
// before it. A controller reads how much fall is left against how much
// length the walk aims at, and widens or narrows the wave to spend the one
// on the other, so a walk lands in its length band by construction rather
// than by luck. The turn rate is capped at what R6 allows, so no bend is
// ever tighter than the least radius.
//
// THE GRADING (R8) is two envelopes rather than a blur. The piste must
// NEVER climb — a skier has no engine — so the profile is first made
// monotone: the highest line under the country that falls at least
// `minGrade` every step (one forward sweep, which cuts through a roller's
// back) and the lowest line over it that does the same (one backward
// sweep, which fills a hollow), and their MEAN, which still falls at least
// `minGrade` everywhere. Then the steepness is bounded the same way: the
// fill that keeps every step under `maxGrade` from above and the cut that
// keeps it from below, and their mean — which keeps both bounds by
// construction. A light blur afterwards rounds the joins (a mean of
// shifted copies keeps both bounds too). The finish straight is then laid
// flat and eased into, the kickers (R9, kickers.ts) are added on top, and
// `stampCorridor` presses the finished line into the ground: level across
// the width (a little cross-fall kept on a traverse), the flat shoulder and
// the bench past it, the groomer's windrow along each edge on that bench
// (R18), a bank back into the mountain behind it, and the packed field of
// R10.

import {
  angleDiff,
  clamp,
  hypot,
  smoothstep,
  TAU,
} from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  createHeightfield,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { valueNoise } from "@niclaslindstedt/oss-game-framework/core/noise";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { LEVEL_RULES as R, bendFloor, bermCrest, bermProfile, inBand } from "./rules.ts";
import { fallAlong } from "./spawn.ts";
import { flankAt, type TerrainPlan } from "./terrain.ts";
import type { Spawn, TrackPoint } from "./types.ts";

/** The piste while the generator is still working on it. */
export type Piste = {
  points: TrackPoint[];
  /** The arc length of the last station, m. */
  length: number;
  /** The untouched mountain's height under each station, m. */
  raw: Float64Array;
  /** The cross-fall the corridor keeps at each station, m per m, positive
   * falling to the right of travel (R8's camber). */
  cross: Float64Array;
};

/** The line as the piste queries (`query.ts`) read one. */
export function trackOf(piste: Piste): { track: { points: TrackPoint[]; length: number } } {
  return { track: { points: piste.points, length: piste.length } };
}

/** A sweep: a traverse held `angle` rad off the fall line for `length`
 * metres from arc `at` — or a schuss, held at 0. */
type Sweep = { readonly at: number; readonly length: number; readonly angle: number };

/** How far either side of a sweep the heading eases into and out of it, m. */
const SWEEP_EASE = 40;

/** The wave's shape: |sin| to this power, signed — under one, so the walk
 * lingers near the wave's crests (the traverses) and turns through the
 * middle, as a piste does. */
const WAVE_SHAPE = 0.6;

/** The wave's mean cosine at amplitude `A` — how much of a wave's length is
 * spent going down the map — read off a quarter of it. */
function waveFall(A: number): number {
  let sum = 0;
  const n = 32;
  for (let i = 0; i < n; i++) {
    const phase = ((i + 0.5) / n) * (TAU / 4);
    sum += Math.cos(A * Math.sin(phase) ** WAVE_SHAPE);
  }
  return sum / n;
}

/** The amplitude whose wave spends `fall` of its length going down the
 * map, up to `track.swing`: the controller's inverse of `waveFall`. */
function amplitudeFor(fall: number): number {
  let lo = 0;
  let hi: number = R.track.swing;
  if (waveFall(hi) >= fall) return hi;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (waveFall(mid) > fall) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** How far ahead the walk reads the ground along a wanted heading, m:
 * long enough that a roller's back (which the grading cuts) is not read
 * as a climb. */
const LOOK = 30;

/** The heading the ground steers a wanted heading to at a point: toward
 * the fall line where the ground would not fall along it, off the fall
 * line where it would fall too steeply. */
function steer(ground: Heightfield, x: number, z: number, want: number, bend: number): number {
  const T = R.track;
  const w = T.gradeWindow;
  const fall = fallAlong(ground, x, z, want, LOOK);
  const mean =
    (sampleField(ground, x, z) -
      sampleField(ground, x + Math.sin(want) * LOOK, z + Math.cos(want) * LOOK)) /
    LOOK;
  if (mean >= T.minFall * 1.5 && fall.steepest <= T.steepest) return want;
  // The mountain's own fall line here, read over the window.
  const gx = (sampleField(ground, x + w, z) - sampleField(ground, x - w, z)) / (2 * w);
  const gz = (sampleField(ground, x, z + w) - sampleField(ground, x, z - w)) / (2 * w);
  const grade = hypot(gx, gz);
  const down = Math.atan2(-gx, -gz);
  if (fall.steepest > T.steepest && grade > T.steepest) {
    // A traverse: at least this far off the fall line to hold the grade.
    const theta = Math.acos(T.steepest / grade);
    const off = angleDiff(down, want);
    const side = Math.abs(off) < 1e-6 ? (bend >= 0 ? 1 : -1) : Math.sign(off);
    if (Math.abs(off) < theta) return down + side * theta;
    return want;
  }
  // Toward the fall line, a little at a time.
  return want + clamp(angleDiff(want, down), -0.6, 0.6);
}

/** R5 — walk the piste from the start: its line, its length, its width. */
export function drawPiste(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  start: Spawn,
): Piste | string {
  const T = R.track;
  const size = R.world.size;
  const step = T.step;
  // Everything drawn is drawn here, in this order; the walk itself draws
  // nothing.
  const aim = inBand(rng, T.aim);
  const bendSeed = rng.int(1, 1 << 30);
  const widthSeed = rng.int(1, 1 << 30);
  const period = inBand(rng, T.wander.scale);
  let phase = rng.range(0, TAU);
  const sweeps: Sweep[] = [];
  const nSweeps = rng.int(T.sweeps.count.min, T.sweeps.count.max);
  for (let i = 0; i < nSweeps; i++) {
    sweeps.push({
      at: rng.range(0.15, 0.8) * aim,
      length: inBand(rng, T.sweeps.length),
      angle: inBand(rng, T.sweeps.angle) * (rng.chance(0.5) ? 1 : -1),
    });
  }
  // THE SCHUSSES: the same hold, down the fall line.
  const nSchuss = rng.int(T.schuss.count.min, T.schuss.count.max);
  for (let i = 0; i < nSchuss; i++) {
    sweeps.push({ at: rng.range(0.15, 0.8) * aim, length: inBand(rng, T.schuss.length), angle: 0 });
  }
  const zEnd = size * T.finishZ;
  const edge = R.mountain.flank.inner - 120;
  const most = Math.ceil((T.length.max + 100) / step);
  const cross = new Float64Array(most + Math.round(T.finish / step) + 2);
  /** R7 — the width at a station: the noise's wander, narrowed where the
   * untouched face falls steeply across the line; and the cross-slope
   * read for it, kept for the camber (R8). */
  const widthAt = (p: TrackPoint, i: number): number => {
    const v = valueNoise(p.s, 0, T.widthScale, widthSeed);
    const wide = T.width.min + (T.width.max - T.width.min) * smoothstep(0.15, 0.85, v);
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const reach = wide / 2;
    const fall =
      (sampleField(ground, p.x + rx * reach, p.z + rz * reach) -
        sampleField(ground, p.x - rx * reach, p.z - rz * reach)) /
      wide;
    cross[i] = clamp(fall, -T.camber, T.camber);
    return wide - (wide - T.width.min) * smoothstep(T.narrow.min, T.narrow.max, Math.abs(fall));
  };
  /** R6 — the turn a step may make, rad: the least radius the pitch
   * allows (`bendFloor`), or the bench radius of a wide piste, whichever
   * is wider. */
  const turnFor = (width: number, grade: number): number =>
    (step / Math.max(bendFloor(grade), width / 2 + T.shoulder.flat + R.berm.width + 4)) * 0.85;
  /** The pitch under the walk: the raw ground's fall along the heading,
   * read `BEND_PITCH` ahead and behind, the steeper of the two — so the
   * turn budget tightens before a headwall and holds past it. */
  const pitchAt = (px: number, pz: number, heading: number): number => {
    const dx = Math.sin(heading) * BEND_PITCH;
    const dz = Math.cos(heading) * BEND_PITCH;
    const here = sampleField(ground, px, pz);
    const ahead = (here - sampleField(ground, px + dx, pz + dz)) / BEND_PITCH;
    const behind = (sampleField(ground, px - dx, pz - dz) - here) / BEND_PITCH;
    return Math.max(ahead, behind);
  };
  let x = start.x;
  let z = start.z;
  let h = start.heading;
  let s = 0;
  const points: TrackPoint[] = [{ x, z, y: 0, s, heading: h, width: 0 }];
  points[0].width = widthAt(points[0], 0);
  while (z < zEnd) {
    if (points.length > most) return "the piste runs out of length before the valley floor";
    let want = h;
    if (s >= T.hold) {
      // THE WAVE, its wavelength wandering, its amplitude the controller's.
      const vary = 1 + T.wander.vary * (valueNoise(s, 0, 500, bendSeed) * 2 - 1);
      phase += (TAU * step) / (period * vary);
      const need = clamp((zEnd - z) / Math.max(step, aim - s), 0.25, 1);
      const A = amplitudeFor(need);
      const wave = Math.sin(phase);
      let bend = A * Math.sign(wave) * Math.abs(wave) ** WAVE_SHAPE;
      // THE SWEEPS, eased into and out of.
      for (const sw of sweeps) {
        const into = s - sw.at;
        if (into <= -SWEEP_EASE || into >= sw.length + SWEEP_EASE) continue;
        const w =
          smoothstep(-SWEEP_EASE, 0, into) *
          (1 - smoothstep(sw.length, sw.length + SWEEP_EASE, into));
        bend = bend * (1 - w) + sw.angle * w;
      }
      // THE FINISH: turned to the fall line for the arena.
      bend *= 1 - smoothstep(zEnd - T.finishTurn, zEnd - 20, z);
      // THE FACE: turned back from the side ridges.
      const across = x - size / 2;
      const away = smoothstep(edge, edge + 120, Math.abs(across));
      bend = bend * (1 - away) + -Math.sign(across) * 0.8 * away;
      want = clamp(steer(ground, x, z, bend, bend), -T.swing, T.swing);
    }
    const maxTurn = turnFor(points[points.length - 1].width, pitchAt(x, z, h));
    h += clamp(angleDiff(h, want), -maxTurn, maxTurn);
    x += Math.sin(h) * step;
    z += Math.cos(h) * step;
    s += step;
    const p: TrackPoint = { x, z, y: 0, s, heading: h, width: 0 };
    p.width = widthAt(p, points.length);
    points.push(p);
  }
  // THE FINISH STRAIGHT, opening out into the arena.
  const arena = points[points.length - 1].width;
  const straight = Math.round(T.finish / step);
  for (let k = 1; k <= straight; k++) {
    x += Math.sin(h) * step;
    z += Math.cos(h) * step;
    s += step;
    const open = smoothstep(0, 0.5, k / straight);
    const p: TrackPoint = { x, z, y: 0, s, heading: h, width: 0 };
    cross[points.length] = clamp(cross[points.length - 1] * (1 - open), -T.camber, T.camber);
    p.width = arena + (T.width.max - arena) * open;
    points.push(p);
  }
  const length = s;
  if (length < T.length.min || length > T.length.max) {
    return `the piste comes out ${length.toFixed(0)} m long`;
  }
  smoothWalk(points, start);
  const walked = points.length - straight - 1;
  for (let i = 0; i <= walked; i++) points[i].width = widthAt(points[i], i);
  for (let k = 1; k <= straight; k++) {
    const open = smoothstep(0, 0.5, k / straight);
    points[walked + k].width = points[walked].width + (T.width.max - points[walked].width) * open;
    cross[walked + k] = cross[walked] * (1 - open);
  }
  // R8 — the camber varies slowly down the piste: the cross-fall is read
  // off the untouched face station by station, and the rollers flip it
  // from one station to the next; the corridor keeps a running mean of it
  // over `CAMBER_WINDOW`, so its edges do not corrugate.
  const cw = Math.round(CAMBER_WINDOW / step);
  const rawCross = cross.slice(0, points.length);
  for (let i = 0; i < points.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - cw); j <= Math.min(points.length - 1, i + cw); j++) {
      sum += rawCross[j];
      count++;
    }
    cross[i] = sum / count;
  }
  setHeadings(points);

  const n = points.length;
  const piste: Piste = { points, length, raw: new Float64Array(n), cross: cross.slice(0, n) };
  const bend = tightestBend(piste, (i) => sampleField(ground, points[i].x, points[i].z));
  if (bend.radius < bend.floor) {
    return `a bend tightens to ${bend.radius.toFixed(0)} m on a ${(bend.grade * 100).toFixed(0)} % pitch`;
  }
  const room = bendRoom(piste);
  if (room < 0) return `a bend folds the inside bench by ${(-room).toFixed(0)} m`;
  const gap = minSeparation(piste);
  if (gap < T.separation.plan) return `two stretches of the piste pass ${gap.toFixed(0)} m apart`;
  // R1, R2 — the whole corridor, bank and all, stays on the map and on
  // the face.
  const reach = T.width.max / 2 + T.shoulder.flat + R.berm.width + T.bank.max + 10;
  for (const p of points) {
    if (p.x < reach || p.x > size - reach || p.z < reach || p.z > size - reach) {
      return "the piste runs off the map";
    }
    const rx = Math.cos(p.heading) * reach;
    const rz = -Math.sin(p.heading) * reach;
    if (flankAt(plan, p.x + rx, p.z + rz) > 0.02 || flankAt(plan, p.x - rx, p.z - rz) > 0.02) {
      return "the piste runs up a side ridge";
    }
  }
  return piste;
}

/** Half-width of the window the walk's headings are smoothed over, in
 * stations: ten metres either side. */
const SMOOTH = 5;

/** Half-width of the running mean the camber (R8) is carried down the
 * piste with, m. */
const CAMBER_WINDOW = 40;

/** THE WALK SMOOTHED: its headings run through a triangular window and the
 * line laid again from the start along them. The walk turns a little more
 * one step than the next — the ground's steer switches regime, a sweep
 * eases in — and the corridor's height surface (`stampCorridor`) is only
 * consistent from one station's local circle to the next when the
 * curvature is smooth; on a line falling half a metre a metre the
 * difference is a windrow's height. A mean of headings never turns tighter
 * than the walk did, so R6 still holds; the held first stretch and the
 * finish straight are constant and stay straight. Writes `x`, `z` in
 * place; the widths are read again after it. */
function smoothWalk(points: TrackPoint[], start: Spawn): void {
  const n = points.length;
  const raw = points.map((p) => p.heading);
  const step = R.track.step;
  let x = start.x;
  let z = start.z;
  for (let i = 1; i < n; i++) {
    let sum = 0;
    let norm = 0;
    for (let j = -SMOOTH; j <= SMOOTH; j++) {
      const w = SMOOTH + 1 - Math.abs(j);
      sum += raw[clamp(i + j, 1, n - 1)] * w;
      norm += w;
    }
    const h = sum / norm;
    points[i].heading = h;
    x += Math.sin(h) * step;
    z += Math.cos(h) * step;
    points[i].x = x;
    points[i].z = z;
  }
}

/** Headings off the central difference down the line, one-sided at the
 * ends. */
export function setHeadings(points: TrackPoint[]): void {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    points[i].heading = Math.atan2(b.x - a.x, b.z - a.z);
  }
}

/** R6 — how far either side of a station the line's fall is read to set
 * the floor under its bend, m: the same reach the walk reads ahead of
 * itself (`LOOK`), so the walk and the check judge a bend on one pitch. */
const BEND_PITCH = LOOK;

/** The bend radius at station `i`: the circumradius of it and the stations
 * `k` either side, m — Infinity on a straight. */
function radiusAt(pts: readonly TrackPoint[], i: number, k: number): number {
  const a = pts[i - k];
  const b = pts[i];
  const c = pts[i + k];
  const ab = hypot(b.x - a.x, b.z - a.z);
  const bc = hypot(c.x - b.x, c.z - b.z);
  const ca = hypot(a.x - c.x, a.z - c.z);
  const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  if (area2 < 1e-9) return Infinity;
  return (ab * bc * ca) / (2 * area2);
}

/** R6 — the tightest bend on the piste: the circumradius of three stations
 * `track.turnWindow` apart, least over the line, m. */
export function minRadius(piste: { points: readonly TrackPoint[] }): number {
  const pts = piste.points;
  const n = pts.length;
  const k = Math.max(1, Math.round(R.track.turnWindow / 2 / R.track.step));
  let best = Infinity;
  for (let i = k; i + k < n; i++) {
    const r = radiusAt(pts, i, k);
    if (r < best) best = r;
  }
  return best;
}

/** One bend read against the floor its pitch sets (R6). */
export interface BendReading {
  /** The bend's radius, m. */
  radius: number;
  /** The least radius the pitch there allows, m (`bendFloor`). */
  floor: number;
  /** The line's fall there, m per m, over `BEND_PITCH` either side. */
  grade: number;
  /** Where along the piste, m. */
  s: number;
}

/** R6 — the bend that comes closest to breaking the rule: over every
 * station, the radius (as `minRadius` reads it) against `bendFloor` of the
 * line's grade there — its fall over `BEND_PITCH` either side, `yAt` the
 * height at a station — the one with the least radius for its floor.
 * A straight piste reads Infinity. */
export function tightestBend(
  piste: { points: readonly TrackPoint[] },
  yAt: (i: number) => number,
): BendReading {
  const pts = piste.points;
  const n = pts.length;
  const step = R.track.step;
  const k = Math.max(1, Math.round(R.track.turnWindow / 2 / step));
  const m = Math.max(1, Math.round(BEND_PITCH / step));
  let worst: BendReading = { radius: Infinity, floor: R.track.minRadius, grade: 0, s: 0 };
  let ratio = Infinity;
  for (let i = k; i + k < n; i++) {
    const r = radiusAt(pts, i, k);
    if (r === Infinity) continue;
    const a = Math.max(0, i - m);
    const b = Math.min(n - 1, i + m);
    const grade = (yAt(a) - yAt(b)) / Math.max(step, pts[b].s - pts[a].s);
    const floor = bendFloor(grade);
    if (r / floor < ratio) {
      ratio = r / floor;
      worst = { radius: r, floor, grade, s: pts[i].s };
    }
  }
  return worst;
}

/** R6 — how much room the inside bench has in the tightest bend: the least,
 * over the line, of a station's bend radius less its half-width, the flat
 * shoulder and the windrow's bench, m — negative where the bench folds
 * over itself. */
export function bendRoom(piste: { points: readonly TrackPoint[] }): number {
  const pts = piste.points;
  const n = pts.length;
  const k = Math.max(1, Math.round(R.track.turnWindow / 2 / R.track.step));
  const bench = R.track.shoulder.flat + R.berm.width;
  let least = Infinity;
  for (let i = k; i + k < n; i++) {
    const a = pts[i - k];
    const b = pts[i];
    const c = pts[i + k];
    const ab = hypot(b.x - a.x, b.z - a.z);
    const bc = hypot(c.x - b.x, c.z - b.z);
    const ca = hypot(a.x - c.x, a.z - c.z);
    const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    if (area2 < 1e-9) continue;
    const room = (ab * bc * ca) / (2 * area2) - (b.width / 2 + bench);
    if (room < least) least = room;
  }
  return least;
}

/** R5 — the least plan distance between two stations of the piste that are
 * more than `separation.along` apart along it, m. */
export function minSeparation(piste: { points: readonly TrackPoint[] }): number {
  const pts = piste.points;
  const n = pts.length;
  const cell = R.track.separation.plan;
  const cells = new Map<number, number[]>();
  const key = (c: number, r: number): number => c * 8192 + r;
  for (let i = 0; i < n; i++) {
    const k = key(Math.floor(pts[i].x / cell), Math.floor(pts[i].z / cell));
    const list = cells.get(k);
    if (list) list.push(i);
    else cells.set(k, [i]);
  }
  const along = R.track.separation.along;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const c = Math.floor(p.x / cell);
    const r = Math.floor(p.z / cell);
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const list = cells.get(key(c + dc, r + dr));
        if (!list) continue;
        for (const j of list) {
          if (j <= i) continue;
          if (Math.abs(pts[j].s - p.s) <= along) continue;
          const d = hypot(pts[j].x - p.x, pts[j].z - p.z);
          if (d < best) best = d;
        }
      }
    }
  }
  return best;
}

/** One box-blur pass down an open profile, half-window `k` stations: the
 * line carried on at its own grade above the start (a held value would
 * gentle the first window under R8's floor), and held past the end, where
 * the finish is flat. */
function blur(y: Float64Array, k: number): Float64Array<ArrayBuffer> {
  const n = y.length;
  const out = new Float64Array(n);
  const at = (i: number): number => (i < 0 ? y[0] + (y[0] - y[1]) * -i : i >= n ? y[n - 1] : y[i]);
  let sum = 0;
  for (let j = -k; j <= k; j++) sum += at(j);
  for (let i = 0; i < n; i++) {
    out[i] = sum / (2 * k + 1);
    sum += at(i + k + 1) - at(i - k);
  }
  return out;
}

/** The FALL over every `track.gradeWindow` of a profile, m per m, positive
 * downhill: the steepest and the gentlest (negative where the line climbs),
 * skipping windows the `skip` mask marks at either end. */
export function windowGrades(
  y: ArrayLike<number>,
  step: number,
  skip?: Uint8Array,
): { steepest: number; gentlest: number } {
  const n = y.length;
  const k = Math.max(1, Math.round(R.track.gradeWindow / step));
  let steepest = -Infinity;
  let gentlest = Infinity;
  for (let i = 0; i + k < n; i++) {
    const j = i + k;
    if (skip && (skip[i] || skip[j])) continue;
    const g = (y[i] - y[j]) / (k * step);
    if (g > steepest) steepest = g;
    if (g < gentlest) gentlest = g;
  }
  return { steepest, gentlest };
}

/** The stations from which the line is the finish's — the run-out and the
 * straight — where R8's floor on the grade does not apply. */
export function finishFrom(length: number): number {
  return length - R.track.finish - R.track.runout;
}

/** R8 — grade the piste's profile against the mountain under it. Writes
 * each station's `y` and `raw`; returns a reason on a line that cannot be
 * graded inside `track.maxCut`. */
export function gradePiste(piste: Piste, country: Heightfield): string | null {
  const T = R.track;
  const pts = piste.points;
  const n = pts.length;
  const step = piste.length / (n - 1);
  const raw = piste.raw;
  for (let i = 0; i < n; i++) raw[i] = sampleField(country, pts[i].x, pts[i].z);
  // Aim a little inside both bounds, so the blur and the window cannot tip
  // a stretch that sat exactly on one over it.
  const least = T.minGrade * 1.1 * step;
  const most = T.maxGrade * 0.95 * step;
  // NEVER CLIMBS: the cut from above and the fill from below, both falling
  // at least `least` a step, and their mean.
  const cut = Float64Array.from(raw);
  for (let i = 1; i < n; i++) cut[i] = Math.min(raw[i], cut[i - 1] - least);
  const fill = Float64Array.from(raw);
  for (let i = n - 2; i >= 0; i--) fill[i] = Math.max(raw[i], fill[i + 1] + least);
  let y: Float64Array<ArrayBuffer> = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = (cut[i] + fill[i]) / 2;
  // NEVER STEEPER THAN THE RULE: the fill that holds every step from
  // above and the cut that holds it from below, and their mean.
  const held = Float64Array.from(y);
  for (let i = 1; i < n; i++) held[i] = Math.max(held[i], held[i - 1] - most);
  const shaved = Float64Array.from(y);
  for (let i = n - 2; i >= 0; i--) shaved[i] = Math.min(shaved[i], shaved[i + 1] + most);
  for (let i = 0; i < n; i++) y[i] = (held[i] + shaved[i]) / 2;
  // THE FINISH STRAIGHT, flat, and the run-out eased into it.
  const flat = Math.max(0, n - 1 - Math.round(T.finish / step));
  for (let i = flat; i < n; i++) y[i] = y[flat];
  const k = Math.round(12 / step);
  y = blur(blur(y, k), k);
  const ease = Math.round(T.runout / (2 * step));
  const eased = blur(y, ease);
  const from = Math.max(0, flat - Math.round((T.runout + 12) / step));
  for (let i = from; i < n; i++) {
    const w = smoothstep(from, Math.min(n - 1, from + ease), i);
    y[i] = y[i] + (eased[i] - y[i]) * w;
  }
  let deepest = 0;
  for (let i = 0; i < n; i++) {
    pts[i].y = y[i];
    deepest = Math.max(deepest, Math.abs(y[i] - raw[i]));
  }
  if (deepest > T.maxCut) {
    return `the piste has to be cut ${deepest.toFixed(1)} m into the mountain`;
  }
  return null;
}

/** What the corridor stamp leaves behind besides the graded ground. */
export type Corridor = {
  /** R10 — 0 powder … 1 packed, on the ground's grid. */
  readonly packed: Heightfield;
  /** Per cell of that grid, the station starting the segment nearest it
   * (-1 where the corridor did not reach), and how far along that segment,
   * 0..1 — what lets R17 lay a drift and R20 a park by arc length. */
  readonly near: Int32Array;
  readonly along: Float32Array;
  /** Per cell, the plan distance to the piste's centreline, m (Infinity
   * past the corridor's reach) — how far the region's own snow keeps off
   * it (R21). */
  readonly dist: Float32Array;
};

/** R8, R10, R18 — press the finished line into the ground: level across the
 * width but for the camber, the flat shoulder and the bench past it, the
 * groomer's windrow on that bench, a bank back to the mountain behind it,
 * and the packed field. Writes `ground` in place. */
export function stampCorridor(piste: Piste, ground: Heightfield): Corridor {
  const T = R.track;
  const pts = piste.points;
  const n = pts.length;
  const cols = ground.cols;
  const rows = ground.rows;
  const cell = ground.cell;
  const cells = cols * rows;
  const dist = new Float32Array(cells).fill(Infinity);
  const near = new Int32Array(cells).fill(-1);
  const along = new Float32Array(cells);
  const target = new Float32Array(cells);
  const half = new Float32Array(cells);
  const reachMax = T.width.max / 2 + T.shoulder.flat + R.berm.width + T.bank.max;
  // THE HEIGHT A CELL IS LEVELLED TO is read off the line as a smooth
  // curve, not off the segment nearest the cell. On a piste falling half a
  // metre a metre round a bend of a few tens of metres, the cells on the
  // outside of the bend lie in the fan between two stations' perpendiculars,
  // and a height read off either segment's projection stands a half-metre
  // off the plane the neighbouring cells lie on — a staircase the two-metre
  // grid reads in place of the windrow (R18). So each cell takes its arc
  // length from the LOCAL CIRCLE of the nearest station (its heading and
  // its curvature): the angle the cell stands round that circle's centre
  // times the station's radius, which is the station's own perpendicular
  // at the centreline and a smooth fan out at the bench.
  const fx = new Float64Array(n);
  const fz = new Float64Array(n);
  const kappa = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    fx[i] = Math.sin(pts[i].heading);
    fz[i] = Math.cos(pts[i].heading);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    kappa[i] = angleDiff(a.heading, b.heading) / Math.max(1e-9, b.s - a.s);
  }
  /** The graded line's height `s` metres down it, carried on at its own
   * grade off either end. */
  const yAt = (s: number): number => {
    const u = (s / piste.length) * (n - 1);
    const i = clamp(Math.floor(u), 0, n - 2);
    return pts[i].y + (pts[i + 1].y - pts[i].y) * (u - i);
  };
  /** The height the corridor levels a cell to: the line's height at the
   * cell's arc length round the nearest station's local circle, with the
   * camber (R8) across the width. */
  const levelAt = (k: number, x: number, z: number, hw: number): number => {
    const P = pts[k];
    const vx = x - P.x;
    const vz = z - P.z;
    const along = vx * fx[k] + vz * fz[k];
    const lateral = vx * fz[k] - vz * fx[k];
    const c = kappa[k];
    let ds = along;
    if (Math.abs(c) > 1e-4) {
      const sgn = c > 0 ? 1 : -1;
      const radius = 1 / Math.abs(c);
      ds = Math.atan2(along, radius - sgn * lateral) * radius;
    }
    return yAt(P.s + ds) + piste.cross[k] * clamp(lateral, -hw, hw);
  };
  for (let i = 0; i + 1 < n; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reachMax) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((Math.max(a.x, b.x) + reachMax) / cell));
    const r0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - reachMax) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((Math.max(a.z, b.z) + reachMax) / cell));
    for (let r = r0; r <= r1; r++) {
      const z = r * cell;
      for (let c = c0; c <= c1; c++) {
        const x = c * cell;
        let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - (a.x + dx * t);
        const ez = z - (a.z + dz * t);
        const o = r * cols + c;
        // Most cells already hold a nearer segment: the square, with a
        // margin far wider than `hypot`'s rounding and the float32 store's,
        // turns those away before the dear `hypot` is paid for, and every
        // cell it lets through is decided by `hypot` exactly as before.
        const held = dist[o];
        if (ex * ex + ez * ez > held * held * (1 + 1e-5)) continue;
        const d = hypot(ex, ez);
        if (d < held) {
          dist[o] = d;
          near[o] = i;
          along[o] = t;
          const hw = (a.width + (b.width - a.width) * t) / 2;
          target[o] = levelAt(t < 0.5 ? i : i + 1, x, z, hw);
          half[o] = hw;
        }
      }
    }
  }
  const packed = createHeightfield(0, 0, cell, cols, rows);
  const g = ground.data;
  const p = packed.data;
  for (let o = 0; o < cells; o++) {
    const d = dist[o];
    if (d === Infinity) continue;
    const hw = half[o];
    // R18 — the bench the windrow stands on is level too; the bank starts
    // behind it.
    const toe = hw + T.shoulder.flat;
    const flat = toe + R.berm.width;
    const delta = target[o] - g[o];
    const bank = Math.min(T.bank.max, Math.max(T.bank.min, Math.abs(delta) / T.bank.slope));
    const w = d <= flat ? 1 : 1 - smoothstep(flat, flat + bank, d);
    g[o] += w * delta;
    if (d > toe && d < flat) g[o] += bermProfile(bermCrest((near[o] + along[o]) * T.step), d - toe);
    p[o] = d <= hw ? 1 : 1 - smoothstep(hw, hw + T.shoulder.packed, d);
  }
  return { packed, near, along, dist };
}
