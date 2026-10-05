// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26 — THE RAMPS OFF A TOP AS GENERATOR v5 LAID THEM (`looseTops`), kept
// whole for the race maps pinned on v5 (`race-maps.ts`): a ramp from the
// pad's rim to a run's snow past its first `head` metres, met at the run's
// SHOULDER (at that ground's height), the shortest that falls no more than
// `grade` or the gentlest where none does — and one that must fall more
// running out at `gentle` and rolling over a LIP into a drop at `lip`. Only
// where one could be laid; a run with none was joined over the raw ground.
// v6 (`summit-ramps.ts`) lands every ramp on its run's own snow, falling all
// the way and evenly. Nothing here moves: a change is a change to maps
// already pinned.

import { hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { StationPad } from "./station-pad.ts";
import type { SummitRamp } from "./types.ts";

/** v5's ramp numbers: the rule book's, with the lip it rolled over (gone
 * from v6, whose ramps are even) and the cut under a chair's way in from
 * where v5 started it, and the reach it looked for a run within. */
const K = { ...RR.lift.top.ramp, far: 180, gentle: 0.12, lip: 0.65, knee: 3 };
const APPROACH_FROM = { chair: 11, gondola: RR.lift.top.approach.from.gondola };

/** How far down a ramp's length it has come, 0..1, as its height has, where
 * it falls evenly: eased off the pad over the first `ease` of it, even from
 * there on — the share of its whole fall made by `t` (0..1) along it. */
function evenFall(t: number): number {
  const a = K.ease;
  const u = Math.max(0, Math.min(1, t));
  const ramp = u < a ? (u * u) / (2 * a) : u - a / 2;
  return ramp / (1 - a / 2);
}

/** Where a ramp's LIP is, m along it, and its plan length: a ramp falling
 * no more than `grade` overall falls evenly and its lip is its foot, where
 * the run takes over; a steeper one runs out at `gentle` and rolls over
 * `knee` m into a drop at `lip` down to the run, its lip where the two meet
 * (at its rim where even that will not reach). */
export function lipOfV5(r: SummitRamp): { at: number; length: number } {
  const length = Math.max(1, hypot(r.to.x - r.from.x, r.to.z - r.from.z));
  const fall = r.from.y - r.to.y;
  if (fall <= K.grade * length) return { at: length, length };
  const at = (K.lip * length - fall) / (K.lip - K.gentle);
  return { at: Math.max(0, at), length };
}

/** How far a steep ramp has fallen `u` m along it, before it is trued to
 * its foot: `gentle` to its lip, then `lip`, the corner rounded over
 * `knee` m. */
function kneeFall(u: number, at: number): number {
  const w = K.knee;
  const soft = (x: number): number => (x > 30 ? x : Math.log1p(Math.exp(x)));
  return K.gentle * u + (K.lip - K.gentle) * w * (soft((u - at) / w) - soft(-at / w));
}

/** A ramp's surface at `t` (0..1) along it. */
export function heightOfV5(r: SummitRamp, t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const fall = r.from.y - r.to.y;
  const { at, length } = lipOfV5(r);
  if (at >= length) return r.from.y - fall * evenFall(u);
  // Trued so it meets the run at its foot exactly.
  const end = kneeFall(length, at);
  return r.from.y - kneeFall(u * length, at) * (fall / end);
}

/** Where (x, z) stands against a ramp: `t` along it from the rim (0) to the
 * run's head (1), `d` m off its line either side, and its length. */
function rampFrame(r: SummitRamp, x: number, z: number): { t: number; d: number; length: number } {
  const ex = r.to.x - r.from.x;
  const ez = r.to.z - r.from.z;
  const length = Math.max(1, hypot(ex, ez));
  const along = ((x - r.from.x) * ex + (z - r.from.z) * ez) / length;
  const d = Math.abs((x - r.from.x) * ez - (z - r.from.z) * ex) / length;
  return { t: along / length, d, length };
}

/** The ramps off every pad: one to each run leaving its top (`runs`, by
 * `from`) that is joined below its deck near enough — from any point of the
 * pad's rim toward a point of the run, ended where the line first meets the
 * run's snow (`onRun`), at that snow's height: the shortest such that falls
 * no more than `grade`, or the gentlest where none does. A line that meets
 * other snow first, or a station (`station`), is no ramp. */
function planRamps(
  pads: readonly StationPad[],
  runs: readonly {
    id: string;
    from: string;
    points: readonly { x: number; y: number; z: number; s: number; width: number }[];
  }[],
  height: (x: number, z: number) => number,
  onRun: (x: number, z: number) => boolean,
  station: (x: number, z: number) => boolean,
  head: (x: number, z: number) => boolean = () => false,
): Map<string, SummitRamp[]> {
  const out = new Map<string, SummitRamp[]>();
  for (const p of pads) {
    const ramps: SummitRamp[] = [];
    for (const r of runs) {
      if (r.from !== p.lift) continue;
      let best: { ramp: SummitRamp; length: number; grade: number } | null = null;
      for (let k = 0; k < r.points.length; k += AIM_EVERY) {
        const q = r.points[k];
        if (q.y > p.y - K.drop) continue;
        const d = hypot(q.x - p.x, q.z - p.z);
        if (d > K.far || d < p.r + K.least) continue;
        for (let a = 0; a < RIM; a++) {
          const ang = (a / RIM) * Math.PI * 2;
          const fx = p.x + Math.sin(ang) * p.r;
          const fz = p.z + Math.cos(ang) * p.r;
          // Out off the rim, never back across the pad, from a head clear.
          if ((q.x - fx) * (fx - p.x) + (q.z - fz) * (fz - p.z) <= 0 || head(fx, fz)) continue;
          const ramp = rampTo(p, r, fx, fz, q, height, onRun, station);
          if (!ramp || ramps.some((o) => overlaps(o, ramp))) continue;
          const length = hypot(ramp.to.x - ramp.from.x, ramp.to.z - ramp.from.z);
          if (length < K.least || ramp.to.y > ramp.from.y - K.drop / 2) continue;
          const grade = (ramp.from.y - ramp.to.y) / length;
          // Steeper than its lip's drop all the way down is no ramp.
          if (grade > K.lip * LIP_FIT) continue;
          const fits = grade <= K.grade;
          const better = !best
            ? true
            : fits !== best.grade <= K.grade
              ? fits
              : fits
                ? length < best.length
                : grade < best.grade;
          if (better) best = { ramp, length, grade };
        }
      }
      if (best) ramps.push(best.ramp);
    }
    if (ramps.length > 0) out.set(p.lift, ramps);
  }
  return out;
}

/** Whether two ramps' corridors would press the same ground: one's line
 * comes within both their half-widths and the blend of the other's. */
function overlaps(a: SummitRamp, b: SummitRamp): boolean {
  const room = (a.width + b.width) / 2 + K.blend;
  const len = hypot(b.to.x - b.from.x, b.to.z - b.from.z);
  for (let u = 0; u <= len; u += 3) {
    const k = u / len;
    const x = b.from.x + (b.to.x - b.from.x) * k;
    const z = b.from.z + (b.to.z - b.from.z) * k;
    const f = rampFrame(a, x, z);
    const past = f.t < 0 ? -f.t * f.length : f.t > 1 ? (f.t - 1) * f.length : 0;
    if (hypot(past, f.d) < room) return true;
  }
  return false;
}

/** The share of `lip` a ramp may fall at overall, leaving its gentle run
 * out off the pad and the knee room. */
const LIP_FIT = 0.75;

/** Every how many of a run's points a ramp is aimed at, and how many points
 * round the pad's rim it is tried from. */
const AIM_EVERY = 4;
const RIM = 24;

/** The ramp from (fx, fz) on pad `p`'s rim toward the run's point `q`,
 * ended where the line first meets a run's snow — null where that snow is
 * not this run's (another run lies between) or the line crosses a station
 * first. */
function rampTo(
  p: StationPad,
  run: { id: string; points: readonly { x: number; z: number; s: number }[] },
  fx: number,
  fz: number,
  q: { x: number; z: number },
  height: (x: number, z: number) => number,
  onRun: (x: number, z: number) => boolean,
  station: (x: number, z: number) => boolean,
): SummitRamp | null {
  const len = hypot(q.x - fx, q.z - fz);
  const ux = (q.x - fx) / len;
  const uz = (q.z - fz) / len;
  for (let u = 0; u <= len; u += 1.5) {
    const x = fx + ux * u;
    const z = fz + uz * u;
    if (station(x, z)) return null;
    if (!onRun(x, z)) continue;
    // The snow met is this run's: its line is no further off than the run
    // it is making for is wide.
    let near = Infinity;
    let s = 0;
    for (const a of run.points) {
      const e = hypot(a.x - x, a.z - z);
      if (e < near) {
        near = e;
        s = a.s;
      }
    }
    if (near > OWN || s < K.head) return null;
    return {
      run: run.id,
      from: { x: fx, y: height(fx, fz), z: fz },
      to: { x, y: height(x, z), z, s },
      width: K.width,
      lip: true,
    };
  }
  return null;
}

/** How far off a run's line its own snow reaches, m — its widest half. */
const OWN = 32 + R.track.shoulder.flat + R.berm.width + 1;

/** Every cell of `field` a ramp's corridor reaches, with its weight: whole
 * across the ramp, eased out over `blend` beside it and past its foot;
 * never inside its pad (the pad's own), on a run (`onRun`) or where `keep`
 * says. */
function eachCell(
  field: Heightfield,
  ramp: SummitRamp,
  pad: StationPad,
  onRun: (x: number, z: number) => boolean,
  keep: (x: number, z: number) => boolean,
  visit: (i: number, w: number, t: number) => void,
): void {
  const reach = ramp.width / 2 + K.blend;
  const cell = field.cell;
  const xs = [ramp.from.x, ramp.to.x];
  const zs = [ramp.from.z, ramp.to.z];
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - reach - field.originX) / cell));
  const c1 = Math.min(field.cols - 1, Math.ceil((Math.max(...xs) + reach - field.originX) / cell));
  const r0 = Math.max(0, Math.floor((Math.min(...zs) - reach - field.originZ) / cell));
  const r1 = Math.min(field.rows - 1, Math.ceil((Math.max(...zs) + reach - field.originZ) / cell));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const x = field.originX + col * cell;
      const z = field.originZ + row * cell;
      const f = rampFrame(ramp, x, z);
      if (f.t < 0 || hypot(x - pad.x, z - pad.z) < pad.r) continue;
      const past = Math.max(0, (f.t - 1) * f.length);
      const w = (1 - smoothstep(ramp.width / 2, reach, f.d)) * (1 - smoothstep(0, K.blend, past));
      if (w <= 0 || onRun(x, z) || keep(x, z)) continue;
      visit(row * field.cols + col, w, f.t);
    }
  }
}

/** How far a ramp keeps off any lift's bottom station, m: its footprint,
 * level to build on; and off the first point of every run, m: its start
 * and its windrows. */
const STATION_KEEP = 14;

/** How far a ramp's line keeps off a lift's line, m: the towers and the
 * chairs over it, the ground under them a ramp only ever cuts; and how far
 * past the approach cut's own half-width it keeps off the way in to a top,
 * so the ramp's own ground, not the cut's eased edge, is under its line. */
const LINE_KEEP = 9;
const LINE_CUT = LINE_KEEP;
const APPROACH_KEEP = 5;
const APPROACH_HEAD = RR.lift.top.approach.blend + 2;

/** Whether (x, z) is too near the ground R26's approach cut away under the
 * way in to a pad's top for a ramp's line (`keep` m past the cut's own
 * half-width): a ramp's head, at the pad's rim, keeps off its eased edge
 * too (`APPROACH_HEAD`). */
function inApproach(
  pads: readonly StationPad[],
  x: number,
  z: number,
  keep = APPROACH_KEEP,
): boolean {
  const A = RR.lift.top.approach;
  for (const p of pads) {
    const k = p.kind === "gondola" ? "gondola" : "chair";
    const back = (p.x - x) * p.dx + (p.z - z) * p.dz;
    if (back < APPROACH_FROM[k] - A.ease || back > Math.min(A.length, p.length / 2)) continue;
    const v = Math.abs((x - p.x) * p.dz - (z - p.z) * p.dx);
    if (v < A.half[k] + keep) return true;
  }
  return false;
}

const cellX = (f: Heightfield, i: number): number => f.originX + (i % f.cols) * f.cell;
const cellZ = (f: Heightfield, i: number): number => f.originZ + Math.floor(i / f.cols) * f.cell;

/** How far (x, z) stands off a lift's line from bottom to top, m. */
function offLine(
  l: { bottom: { x: number; z: number }; top: { x: number; z: number } },
  x: number,
  z: number,
): number {
  const ex = l.top.x - l.bottom.x;
  const ez = l.top.z - l.bottom.z;
  const k = Math.max(
    0,
    Math.min(1, ((x - l.bottom.x) * ex + (z - l.bottom.z) * ez) / (ex * ex + ez * ez || 1)),
  );
  return hypot(x - (l.bottom.x + ex * k), z - (l.bottom.z + ez * k));
}

/** A run's own ground past its edge — the flat shoulder and the windrow's
 * bench (R7, R18) — that a ramp leaves as the run pressed it, m. */
const SHOULDER = R.track.shoulder.flat + R.berm.width + 1;

/** R26 — the ramps off every pad (`planRamps`), pressed into `ground` off a
 * run's snow (`onRun`) and every lift's bottom station. */
export function layRampsV5(
  ground: Heightfield,
  pads: readonly StationPad[],
  runs: Parameters<typeof planRamps>[1],
  onRun: (x: number, z: number, past: number) => boolean,
  lifts: readonly { bottom: { x: number; z: number }; top: { x: number; z: number } }[],
): Map<string, SummitRamp[]> {
  // A station's footprint, and every run's first `head` metres (its start,
  // its windrows).
  const heads = runs.flatMap((r) => r.points.filter((q) => q.s <= K.head));
  const station = (x: number, z: number, more = 0): boolean =>
    lifts.some((l) => hypot(x - l.bottom.x, z - l.bottom.z) < STATION_KEEP + more) ||
    heads.some((h) => hypot(x - h.x, z - h.z) < h.width / 2 + SHOULDER + more);
  // The line is kept a couple of cells further off than the pressing is,
  // so no cell it is read over is one left unpressed.
  const margin = ground.cell * 2;
  const height = (x: number, z: number): number => sampleField(ground, x, z);
  // Its line never down under a lift's, among the towers.
  const under = (x: number, z: number): boolean => lifts.some((l) => offLine(l, x, z) < LINE_KEEP);
  // A ramp meets a run where its shoulder starts: the run's own ground on.
  const meets = (x: number, z: number): boolean => onRun(x, z, SHOULDER);
  const ramps = planRamps(
    pads,
    runs,
    height,
    meets,
    (x, z) => station(x, z, margin) || under(x, z) || inApproach(pads, x, z),
    (x, z) => inApproach(pads, x, z, APPROACH_HEAD),
  );
  // Under a lift's line a ramp only ever cuts: never up into the rope.
  const lines = (x: number, z: number): boolean => lifts.some((l) => offLine(l, x, z) < LINE_CUT);
  pressRampsV5(ground, ramps, pads, meets, (x, z) => station(x, z), lines);
  return ramps;
}

/** R26 — press every ramp into `ground`, its pad's (`pads`, by lift). */
function pressRampsV5(
  ground: Heightfield,
  ramps: ReadonlyMap<string, readonly SummitRamp[]>,
  pads: readonly StationPad[],
  onRun: (x: number, z: number) => boolean,
  keep: (x: number, z: number) => boolean,
  cutOnly: (x: number, z: number) => boolean = () => false,
): void {
  for (const pad of pads) {
    for (const ramp of ramps.get(pad.lift) ?? []) {
      eachCell(ground, ramp, pad, onRun, keep, (i, w, t) => {
        const h = ground.data[i] * (1 - w) + heightOfV5(ramp, t) * w;
        if (h > ground.data[i] && cutOnly(cellX(ground, i), cellZ(ground, i))) return;
        ground.data[i] = h;
      });
    }
  }
}

/** R26 — groom every ramp, up to a run's edge and never over its snow. */
export function groomRampsV5(
  packed: Heightfield,
  ramps: ReadonlyMap<string, readonly SummitRamp[]>,
  pads: readonly StationPad[],
  onRun: (x: number, z: number) => boolean,
): void {
  for (const pad of pads) {
    for (const ramp of ramps.get(pad.lift) ?? []) {
      eachCell(
        packed,
        ramp,
        pad,
        onRun,
        () => false,
        (i, w) => {
          if (w > packed.data[i]) packed.data[i] = w;
        },
      );
    }
  }
}
