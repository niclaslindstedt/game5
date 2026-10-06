// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R27 — THE RUNS, BUILT: each walked run graded into the mountain and
// pressed into it, in the order the runs were laid, so a run that merges
// into another is graded onto the other's finished surface.
//
// THE GRADING is R8's (`track.ts`'s `gradePiste`): the line made monotone
// by the cut from above and the fill from below and their mean, then held
// under the run's ceiling and its colour's (R23) the same way, blurred
// round the joins, the finish straight laid flat on a run that reaches the
// floor. What a resort adds is the JUNCTION. A run that merges into another
// is walked onto the other's line, and by the time it is graded the other
// is already pressed into the ground — so the ground under its last
// stretch IS the other's surface, and the grading is drawn back onto it
// there, eased in over the stretch before, and the cross-fall it keeps
// across its width is the one the other's surface already has.
//
// THE STAMP is R8, R10 and R18's (`stampCorridor`) over the run's own
// stretch of the grid, with one rule more: the CORE of every run pressed
// before — its width and its flat shoulders — is never touched by a run
// pressed after it. A merging run levels everything else its corridor
// reaches, the other's windrow and bank on the side it comes in from among
// them, so the windrow opens where a run joins; and where it runs inside
// the other, the other's surface is already the one it was graded to.

import { angleDiff, clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { bermCrest, bermProfile } from "./berm.ts";
import { driftAt } from "./drift.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { startGateArc } from "./spawn.ts";
import { blur, tightestBend } from "./track.ts";
import { WIDEST, type WalkedRun } from "./network.ts";
import type { Drift } from "./types.ts";

/** How far inside its colour's ceiling the grading holds every colour
 * window (`track.ts`'s, for the same reason). */
const COLOUR_MARGIN = 0.9;

/** How far inside its colour's start (R12) a run's first stretch is held,
 * and how far past the run out of the gate the hold reaches, m: the blurs
 * that round the line reach a dozen metres either way, twice. */
const START_MARGIN = 0.9;
const START_BLUR = 24;

/** How far past where their corridors' benches overlap a merging run's
 * line starts easing onto the other's surface, m across: close enough that
 * the ground between the two is the bank between them, not the mountain. */
const PIN_REACH = 14;

/** R8, R27 — grade a run's profile against the ground as it now lies: no
 * window steeper than `maxGrade`, no colour window steeper than `colour`
 * (the run's colour's ceiling; undefined on a black), the finish straight
 * flat on a run that reaches the floor, and on one that merges the line
 * drawn onto the other's surface from where its centre runs inside the
 * other's width. Writes `y`, `raw` and `cross`; returns a reason on a line
 * that cannot be graded inside `track.maxCut`. */
export function gradeRun(
  run: WalkedRun,
  ground: Heightfield,
  maxGrade: number,
  colour: number | undefined,
  onto: WalkedRun | null,
  pinned?: (x: number, z: number) => boolean,
): string | null {
  const T = R.track;
  const pts = run.points;
  const n = pts.length;
  const step = run.length / (n - 1);
  const raw = run.raw;
  for (let i = 0; i < n; i++) raw[i] = sampleField(ground, pts[i].x, pts[i].z);
  const least = T.minGrade * 1.1 * step;
  const most = maxGrade * 0.95 * step;
  const cut = Float64Array.from(raw);
  for (let i = 1; i < n; i++) cut[i] = Math.min(raw[i], cut[i - 1] - least);
  const fill = Float64Array.from(raw);
  for (let i = n - 2; i >= 0; i--) fill[i] = Math.max(raw[i], fill[i + 1] + least);
  let y: Float64Array<ArrayBuffer> = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = (cut[i] + fill[i]) / 2;
  const K = colour === undefined ? 0 : Math.max(1, Math.round(T.colourWindow / step));
  const mostK = colour === undefined ? Infinity : colour * COLOUR_MARGIN * K * step;
  // THE START (R12): off its top station a run opens no steeper than its
  // colour's start, held over the stretch a race's start line, its gate
  // and the run out of it stand on, and the blur's reach past that.
  const startN = Math.round((startGateArc() + R.spawn.run + T.gradeWindow + START_BLUR) / step);
  const startMost = Math.min(
    most,
    (run.startSlope ?? run.spec.row.spawn.maxSlope) * START_MARGIN * step,
  );
  const cap = (i: number): number => (i <= startN ? startMost : most);
  const held = Float64Array.from(y);
  for (let i = 1; i < n; i++) {
    held[i] = Math.max(held[i], held[i - 1] - cap(i));
    if (K > 0 && i >= K) held[i] = Math.max(held[i], held[i - K] - mostK);
  }
  const shaved = Float64Array.from(y);
  for (let i = n - 2; i >= 0; i--) {
    shaved[i] = Math.min(shaved[i], shaved[i + 1] + cap(i + 1));
    if (K > 0 && i + K < n) shaved[i] = Math.min(shaved[i], shaved[i + K] + mostK);
  }
  for (let i = 0; i < n; i++) y[i] = (held[i] + shaved[i]) / 2;
  const k = Math.round(12 / step);
  if (!run.into) {
    const flat = Math.max(0, n - 1 - Math.round(T.finish / step));
    for (let i = flat; i < n; i++) y[i] = y[flat];
    y = blur(blur(y, k), k);
    const ease = Math.round(T.runout / (2 * step));
    const eased = blur(y, ease);
    const from = Math.max(0, flat - Math.round((T.runout + 12) / step));
    for (let i = from; i < n; i++) {
      const w = smoothstep(from, Math.min(n - 1, from + ease), i);
      y[i] = y[i] + (eased[i] - y[i]) * w;
    }
  } else {
    y = blur(blur(y, k), k);
  }
  // THE JUNCTION: from where the corridors touch, onto the other's surface —
  // its line, and its camber carried out to under this run's centre — eased
  // in over the stretch before, so the two levelled surfaces are one plane
  // where they meet.
  const plane = onto ? planeOf(run, onto) : null;
  // ON ANOTHER'S SURFACE: where this run's line runs over the core of a run
  // pressed before it — two runs leaving one top station — the stamp will
  // leave that surface as it is, so the line is drawn onto it there, eased
  // in and out over `PIN_EASE` metres.
  const pin = pinned ? pinOf(run, pinned) : null;
  const pinW = plane ? plane.w : pin ? pin : null;
  if (plane && pin) {
    for (let i = 0; i < n; i++) {
      if (pin[i] > plane.w[i]) {
        plane.w[i] = pin[i];
        plane.y[i] = raw[i];
      }
    }
  }
  if (pinW) {
    for (let i = 0; i < n; i++) {
      const w = pinW[i];
      if (w > 0) y[i] = y[i] * (1 - w) + (plane ? plane.y[i] : raw[i]) * w;
    }
    // Off another's surface down the run (where it leaves the top or the
    // piste it branches off), the line never falls away from it steeper
    // than its ceiling: filled up after it where it would.
    for (let i = 1; i < n; i++) {
      if (pinW[i] < 1) y[i] = Math.max(y[i], y[i - 1] - most);
    }
    // From the junction back up the run, the line is held between never
    // climbing onto the other (filled up where the other's surface stands
    // above it) and never falling onto it steeper than its own ceiling or
    // its colour's (cut down over as long a stretch as that takes, where
    // the other lies far below it).
    const least = T.minGrade * step;
    for (let i = n - 2; i >= 0; i--) {
      const floor = y[i + 1] + least * (1 - pinW[i]);
      // On the other's surface it is the other's, however steep for its
      // colour (the course's colour is the steepest on it, R28) — never
      // past the run's own ceiling.
      let top = y[i + 1] + most;
      if (K > 0 && i + K < n && pinW[i] < 1) top = Math.min(top, y[i + K] + mostK);
      // Never climbing wins over the colour's cut.
      y[i] = Math.max(floor, Math.min(y[i], top));
    }
  }
  let deepest = 0;
  for (let i = 0; i < n; i++) {
    pts[i].y = y[i];
    deepest = Math.max(deepest, Math.abs(y[i] - raw[i]));
  }
  if (deepest > T.maxCut) return `a run has to be cut ${deepest.toFixed(1)} m into the mountain`;
  // R6 on the graded line: a junction's descent can steepen a bend past
  // what the walk read off the mountain for it.
  const bend = tightestBend(run, (i) => pts[i].y);
  if (bend.radius < bend.floor - 0.5) {
    return `a bend tightens to ${bend.radius.toFixed(0)} m on a ${(bend.grade * 100).toFixed(0)} % pitch`;
  }
  // R8 — the cross-fall the corridor keeps: read across the width on the
  // ground as it lies, carried as a running mean.
  const rawCross = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const reach = p.width / 2;
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const fall =
      (sampleField(ground, p.x + rx * reach, p.z + rz * reach) -
        sampleField(ground, p.x - rx * reach, p.z - rz * reach)) /
      p.width;
    rawCross[i] = clamp(fall, -T.camber, T.camber);
  }
  const cw = Math.round(40 / step);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - cw); j <= Math.min(n - 1, i + cw); j++) {
      sum += rawCross[j];
      count++;
    }
    run.cross[i] = sum / count;
    if (plane) run.cross[i] = run.cross[i] * (1 - plane.w[i]) + plane.cross[i] * plane.w[i];
  }
  if (!run.into) {
    const straight = Math.round(T.finish / step);
    const walked = n - straight - 1;
    for (let j = 1; j <= straight; j++) {
      run.cross[walked + j] = run.cross[walked] * (1 - smoothstep(0, 0.5, j / straight));
    }
  }
  return null;
}

/** How far either side of a stretch on another run's core the line eases
 * onto that surface, m. */
const PIN_EASE = 24;

/** How much of the ground as it lies each station takes (`gradeRun`'s
 * ON ANOTHER'S SURFACE): all of it where the station stands on a core
 * `pinned` names, easing to none `PIN_EASE` metres off one; null where no
 * station does. */
function pinOf(run: WalkedRun, pinned: (x: number, z: number) => boolean): Float64Array | null {
  const pts = run.points;
  const n = pts.length;
  // Never in the finish (R5): it is laid flat into the village beside the
  // others.
  const finish = run.into ? Infinity : run.length - R.track.finish - R.track.runout - PIN_EASE;
  const on: number[] = [];
  for (let i = 0; i < n; i++)
    if (pts[i].s < finish && pinned(pts[i].x, pts[i].z)) on.push(pts[i].s);
  if (on.length === 0) return null;
  const w = new Float64Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = pts[i].s;
    while (k + 1 < on.length && on[k + 1] <= s) k++;
    const d = Math.min(Math.abs(s - on[k]), k + 1 < on.length ? Math.abs(on[k + 1] - s) : Infinity);
    w[i] = pts[i].s < finish ? 1 - smoothstep(0, PIN_EASE, d) : 0;
  }
  return w;
}

/** Whether a plan point stands on the core of a run already pressed. */
export function onCore(
  shared: NetworkStamp,
  ground: Heightfield,
): (x: number, z: number) => boolean {
  return (x, z) => {
    const c = Math.round(x / ground.cell);
    const r = Math.round(z / ground.cell);
    if (c < 0 || r < 0 || c >= ground.cols || r >= ground.rows) return false;
    return shared.core[r * ground.cols + c] === CORE;
  };
}

/** The other run's surface under each station of a merging run: its line's
 * height at the nearest arc with its camber carried out to the station
 * (held level past its width, as its flat shoulder is), that camber turned
 * into this run's own frame, and how much of it the station takes (`w`):
 * all of it where this run's corridor overlaps the other's flat bench, none
 * once it stands `PIN_REACH` metres clear of that. The nearest arc only ever
 * moves on down the other run, as this one runs down onto it, and never
 * past the junction. */
function planeOf(
  run: WalkedRun,
  onto: WalkedRun,
): { y: Float64Array; cross: Float64Array; w: Float64Array } {
  const pts = run.points;
  const n = pts.length;
  const tp = onto.points;
  const y = new Float64Array(n);
  const cross = new Float64Array(n);
  const w = new Float64Array(n);
  const from = run.mergeStart - 20;
  // The other's stations up to a little past the junction: the nearest is
  // looked for among them from the last one on, the whole way — a walk
  // that only stepped while the next was nearer would stop in a hollow of
  // the distance where the other bends away and back.
  const step = onto.length / Math.max(1, tp.length - 1);
  const last = Math.min(tp.length - 1, Math.ceil(((run.into?.s ?? onto.length) + 20) / step));
  let j = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.s < from) continue;
    const d2 = (k: number): number => (tp[k].x - p.x) ** 2 + (tp[k].z - p.z) ** 2;
    let best = d2(j);
    for (let k = j + 1; k <= last; k++) {
      const d = d2(k);
      if (d < best) {
        best = d;
        j = k;
      }
    }
    const t = tp[j];
    const lateral = (p.x - t.x) * Math.cos(t.heading) - (p.z - t.z) * Math.sin(t.heading);
    const hw = t.width / 2;
    y[i] = t.y + onto.cross[j] * clamp(lateral, -hw, hw);
    cross[i] = onto.cross[j] * Math.cos(angleDiff(t.heading, p.heading));
    const touch = hw + BENCH_W + p.width / 2;
    w[i] = 1 - smoothstep(touch, touch + PIN_REACH, Math.abs(lateral));
  }
  return { y, cross, w };
}

/** How far down the run it merges into past the junction a merging run's
 * corridor may still reach, m. */
const OPEN_PAST = 24;
/** How far up and down the other run from the junction its stations are
 * searched for the nearest, stations. */
const OPEN_SEARCH = 150;
const OPEN_STRIDE = 4;

/** THE JUNCTION'S END: whether a ground cell by station `i` of a merging
 * run lies along the run it merges into further down than the junction —
 * the other's own bench and bank, where it bends back under the merging
 * run's corridor, and none of the junction's. Never for a run that reaches
 * the floor, nor a station before the two corridors touch. */
function pastJunction(
  run: WalkedRun,
  onto: WalkedRun | null,
): (i: number, x: number, z: number) => boolean {
  if (!onto || !run.into) return () => false;
  const tp = onto.points;
  const step = onto.length / Math.max(1, tp.length - 1);
  const at = run.into.s;
  const j = Math.round(at / step);
  const lo = Math.max(0, j - OPEN_SEARCH);
  const hi = Math.min(tp.length - 1, j + OPEN_SEARCH);
  const from = run.mergeFrom;
  const pts = run.points;
  return (i, x, z) => {
    if (pts[i].s < from) return false;
    // Every few stations, then the few round the nearest of those.
    let best = Infinity;
    let k = lo;
    for (let q = lo; q <= hi; q += OPEN_STRIDE) {
      const d = (tp[q].x - x) ** 2 + (tp[q].z - z) ** 2;
      if (d < best) {
        best = d;
        k = q;
      }
    }
    const k0 = Math.max(lo, k - OPEN_STRIDE);
    const k1 = Math.min(hi, k + OPEN_STRIDE);
    for (let q = k0; q <= k1; q++) {
      const d = (tp[q].x - x) ** 2 + (tp[q].z - z) ** 2;
      if (d < best) {
        best = d;
        k = q;
      }
    }
    return tp[k].s > at + OPEN_PAST;
  };
}

/** The furthest along its line a cell by a station is levelled to, m: a
 * station's stride and a half. */
const ARC_MOST = 1.5 * R.track.step;

/** The flat shoulder and the windrow's bench past a run's width, m. */
const BENCH_W = R.track.shoulder.flat + R.berm.width;

/** The shared mask's marks: a run's core (its width and flat shoulders),
 * and the bench its windrow stands on. */
const CORE = 2;
const BENCH_CELL = 1;

/** What every run's stamp shares: the mask of the cores pressed so far,
 * and every cell's distance to the nearest run, read from its edge as a
 * race piste's is from its line (`surface.ts`'s `CLEAR`). */
export type NetworkStamp = {
  readonly core: Uint8Array;
  readonly dist: Float32Array;
};

export function networkStamp(ground: Heightfield): NetworkStamp {
  const cells = ground.cols * ground.rows;
  return { core: new Uint8Array(cells), dist: new Float32Array(cells).fill(Infinity) };
}

/** R8, R10, R17, R18, R27 — press a graded run into the ground: level
 * across its width but for the camber, the flat shoulder and the bench, its
 * windrow on that bench, a bank back to the mountain behind it, the packed
 * field and its drifts — everywhere but the cores of the runs pressed
 * before it. Writes `ground` and `packed` in place, and the shared mask. */
export function stampRun(
  run: WalkedRun,
  ground: Heightfield,
  packed: Heightfield,
  shared: NetworkStamp,
  drifts: readonly Drift[],
  onto: WalkedRun | null = null,
): void {
  const T = R.track;
  const pts = run.points;
  const n = pts.length;
  const cell = ground.cell;
  const cols = ground.cols;
  const rows = ground.rows;
  const reachMax = WIDEST / 2 + T.shoulder.flat + R.berm.width + T.bank.max;
  // The run's own stretch of the grid.
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    z0 = Math.min(z0, p.z);
    z1 = Math.max(z1, p.z);
  }
  const c0 = Math.max(0, Math.floor((x0 - reachMax) / cell));
  const c1 = Math.min(cols - 1, Math.ceil((x1 + reachMax) / cell));
  const r0 = Math.max(0, Math.floor((z0 - reachMax) / cell));
  const r1 = Math.min(rows - 1, Math.ceil((z1 + reachMax) / cell));
  const bw = c1 - c0 + 1;
  const bh = r1 - r0 + 1;
  const local = bw * bh;
  const dist = new Float32Array(local).fill(Infinity);
  const near = new Int32Array(local).fill(-1);
  const along = new Float32Array(local);
  const endsInside = run.into !== null;
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
  const yAt = (s: number): number => {
    const u = (s / run.length) * (n - 1);
    const i = clamp(Math.floor(u), 0, n - 2);
    return pts[i].y + (pts[i + 1].y - pts[i].y) * (u - i);
  };
  const levelAt = (k: number, x: number, z: number, hw: number): number => {
    const P = pts[k];
    const vx = x - P.x;
    const vz = z - P.z;
    const a = vx * fx[k] + vz * fz[k];
    const lateral = vx * fz[k] - vz * fx[k];
    const c = kappa[k];
    let ds = a;
    if (Math.abs(c) > 1e-4) {
      const sgn = c > 0 ? 1 : -1;
      const radius = 1 / Math.abs(c);
      // Never past the station's own stride: on the inside of a tight bend
      // the bank reaches across the bend's centre, where the arc turns
      // through half a circle in a metre.
      ds = clamp(Math.atan2(a, radius - sgn * lateral) * radius, -ARC_MOST, ARC_MOST);
    }
    return yAt(P.s + ds) + run.cross[k] * clamp(lateral, -hw, hw);
  };
  for (let i = 0; i + 1 < n; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    // This segment's own reach: its width, the bench and the widest bank.
    const reach = Math.max(a.width, b.width) / 2 + T.shoulder.flat + R.berm.width + T.bank.max;
    const sc0 = Math.max(c0, Math.floor((Math.min(a.x, b.x) - reach) / cell));
    const sc1 = Math.min(c1, Math.ceil((Math.max(a.x, b.x) + reach) / cell));
    const sr0 = Math.max(r0, Math.floor((Math.min(a.z, b.z) - reach) / cell));
    const sr1 = Math.min(r1, Math.ceil((Math.max(a.z, b.z) + reach) / cell));
    for (let r = sr0; r <= sr1; r++) {
      const z = r * cell;
      for (let c = sc0; c <= sc1; c++) {
        const x = c * cell;
        let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
        // A run that merges ends inside the other: nothing of it past its
        // last station, where the other's surface runs on.
        if (endsInside && i === n - 2 && t > 1) continue;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - (a.x + dx * t);
        const ez = z - (a.z + dz * t);
        const o = (r - r0) * bw + (c - c0);
        const heldD = dist[o];
        if (ex * ex + ez * ez > heldD * heldD * (1 + 1e-5)) continue;
        const d = hypot(ex, ez);
        if (d < heldD) {
          dist[o] = d;
          near[o] = i;
          along[o] = t;
        }
      }
    }
  }
  const g = ground.data;
  const p = packed.data;
  const core = shared.core;
  const all = shared.dist;
  const past = pastJunction(run, onto);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const o = (r - r0) * bw + (c - c0);
      const d = dist[o];
      if (d === Infinity || d > reachMax) continue;
      const go = r * cols + c;
      const i = near[o];
      const t = along[o];
      const hw = (pts[i].width + (pts[i + 1].width - pts[i].width) * t) / 2;
      // The crust keeps off a run by its edge (R21): read as a race piste's
      // distance from its line, whatever this run's width.
      const edge = d - hw + R.track.width.max / 2;
      if (edge < all[go]) all[go] = edge;
      if (past(i, c * cell, r * cell)) {
        near[o] = -1;
        continue;
      }
      if (core[go] === CORE) {
        // Another run's surface: its levelling and its windrow are its own,
        // but the groomer runs on across the seam between the two.
        const pk = d <= hw ? 1 : 1 - smoothstep(hw, hw + T.shoulder.packed, d);
        if (pk > p[go]) p[go] = pk;
        continue;
      }
      const toe = hw + T.shoulder.flat;
      const flat = toe + R.berm.width;
      // Another run's windrow is levelled only by this one's own corridor
      // (a junction opens it), never by the bank behind it.
      if (core[go] === BENCH_CELL && d > flat) continue;
      const delta = levelAt(t < 0.5 ? i : i + 1, c * cell, r * cell, hw) - g[go];
      const bank = Math.min(T.bank.max, Math.max(T.bank.min, Math.abs(delta) / T.bank.slope));
      const w = d <= flat ? 1 : 1 - smoothstep(flat, flat + bank, d);
      g[go] += w * delta;
      const s = pts[i].s + (pts[i + 1].s - pts[i].s) * t;
      if (d > toe && d < flat) g[go] += bermProfile(bermCrest(s), d - toe);
      let pk = d <= hw ? 1 : 1 - smoothstep(hw, hw + T.shoulder.packed, d);
      if (pk > 0 && drifts.length > 0) {
        const wd = driftAt(drifts, s);
        if (wd > 0) pk *= 1 - (1 - R.drift.packed) * wd;
      }
      if (pk > p[go]) p[go] = pk;
    }
  }
  // Mark this run's core for every run pressed after it — a lane's but
  // never: a lane is pressed after every piste, and one crossing it is
  // levelled across it.
  if (run.spec.kind === "road") return;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const o = (r - r0) * bw + (c - c0);
      const o2 = r * cols + c;
      const i = near[o];
      if (i < 0) continue;
      const hw = (pts[i].width + (pts[i + 1].width - pts[i].width) * along[o]) / 2;
      if (dist[o] <= hw + T.shoulder.flat) core[o2] = CORE;
      else if (dist[o] <= hw + T.shoulder.flat + R.berm.width && core[o2] === 0) {
        core[o2] = BENCH_CELL;
      }
    }
  }
}
