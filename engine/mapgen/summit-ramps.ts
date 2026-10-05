// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26 — THE RAMPS OFF A TOP: from the rim of a top station's pad (`station-
// pad.ts`) down to the head of every run a rider can ski onto from it, a
// WIDE groomed ramp graded into the mountain, so the way from the lift to
// the slope is one smooth run-out rather than the raw face between them.
//
// A ramp leaves the pad's rim at the pad's own surface and comes down onto
// the run's own snow at that snow's height — onto its head where it can,
// the run's start being where a rider off the lift is going — cutting
// through the run's own shoulder on the way (a run's start is cut into the
// slope, and its shoulder there stands as high as the pad), never across
// another run's ground, a station, a lift's line or another ramp's. It
// FALLS at least `fall` all the way: a run's start is laid under its top by
// that much (R27), so a rider let go on the pad slides down to his run and
// never climbs to it. Every ramp is eased off the pad over its first `ease`
// share and EVEN from there on to its foot, the run's own head its LIP onto
// the run's pitch (`rampLip`) — never a knee to be thrown off — and falls
// no more than the run's colour: `grade` overall to a green or a blue,
// `steep` to a red or a black. Where the run is joined is its nearest point
// lying `drop` metres or more under the pad's deck within `far` metres of
// the top that a ramp reaches at no more than `grade` (the gentlest where
// none does) — a lane leaving up the contour above the pad is no run off
// it. Every number is
// `RESORT_RULES.lift.top.ramp`'s.
//
// Pressed once the runs are graded, everywhere but on a run's surface (a
// run's snow is its own, R27) and a station's footprint; groomed beside the
// pads; and published on the lift (`Lift.ramps`) — the woods, the off-piste
// kickers and the cliffs keep off it, the lead off a free ride's chair skis
// down it, and the lens holds its summit look until he leaves its foot.

import { hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { GRADES } from "./grades.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { padded, type StationPad } from "./station-pad.ts";
import type { SummitRamp } from "./types.ts";

const K = RR.lift.top.ramp;

/** How far down a ramp's length it has come, 0..1, as its height has, where
 * it falls evenly: eased off the pad over the first `ease` of it, even from
 * there on — the share of its whole fall made by `t` (0..1) along it. */
function evenFall(t: number): number {
  const a = K.ease;
  const u = Math.max(0, Math.min(1, t));
  const ramp = u < a ? (u * u) / (2 * a) : u - a / 2;
  return ramp / (1 - a / 2);
}

/** Where a ramp's LIP is, m along it, and its plan length: every ramp
 * falls evenly to its foot, where the run takes over — its lip, the run's
 * own head onto the run's pitch. */
export function rampLip(r: SummitRamp): { at: number; length: number } {
  const length = Math.max(1, hypot(r.to.x - r.from.x, r.to.z - r.from.z));
  return { at: length, length };
}

/** A ramp's surface at `t` (0..1) along it: eased off the pad, even on
 * down to its foot. */
export function rampHeight(r: SummitRamp, t: number): number {
  return r.from.y - (r.from.y - r.to.y) * evenFall(t);
}

/** Where (x, z) stands against a ramp: `t` along it from the rim (0) to the
 * run's head (1), `d` m off its line either side, and its length. */
export function rampFrame(
  r: SummitRamp,
  x: number,
  z: number,
): { t: number; d: number; length: number } {
  const ex = r.to.x - r.from.x;
  const ez = r.to.z - r.from.z;
  const length = Math.max(1, hypot(ex, ez));
  const along = ((x - r.from.x) * ex + (z - r.from.z) * ez) / length;
  const d = Math.abs((x - r.from.x) * ez - (z - r.from.z) * ex) / length;
  return { t: along / length, d, length };
}

/** How far (x, z) stands outside a ramp's corridor — its width and the
 * ground eased into it beside it — m; negative within it. */
export function offRamp(r: SummitRamp, x: number, z: number): number {
  const f = rampFrame(r, x, z);
  const past = f.t < 0 ? -f.t * f.length : f.t > 1 ? (f.t - 1) * f.length : 0;
  return hypot(past, Math.max(0, f.d - r.width / 2)) - K.blend;
}

/** Which run's ground (x, z) is on, by its place in the runs handed in —
 * its snow (`past` 0) or out to `past` m beyond its edge — or -1. */
export type RunCover = (x: number, z: number, past: number) => number;

/** The ramps off every pad: one to each run leaving its top (`runs`, by
 * `from`) that is joined below its deck near enough — from any point of the
 * pad's rim toward a point of the run, ended where the line first meets the
 * run's snow (`cover`), at the run's height there: the shortest such that
 * falls at least `fall` and no more than `grade`, or the gentlest where none
 * does. A line that crosses another run's ground or a station (`station`)
 * first is no ramp. */
export function planRamps(
  pads: readonly StationPad[],
  runs: readonly {
    id: string;
    from: string;
    row?: { steepest: { max: number } };
    points: readonly { x: number; y: number; z: number; s: number; width: number }[];
  }[],
  height: (x: number, z: number) => number,
  cover: RunCover,
  station: (x: number, z: number, run: string) => boolean,
  head: (x: number, z: number) => boolean = () => false,
): Map<string, SummitRamp[]> {
  const out = new Map<string, SummitRamp[]>();
  for (const p of pads) {
    const ramps: SummitRamp[] = [];
    runs.forEach((r, own) => {
      if (r.from !== p.lift) return;
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
          // Out off the rim, never back across the pad, from a head clear
          // and no higher than the middle a rider is let go on.
          if ((q.x - fx) * (fx - p.x) + (q.z - fz) * (fz - p.z) <= 0 || head(fx, fz)) continue;
          if (height(fx, fz) > p.y + RIM_RISE) continue;
          const ramp = rampTo(r, own, fx, fz, q, height, cover, station);
          if (!ramp || ramps.some((o) => overlaps(o, ramp))) continue;
          const length = hypot(ramp.to.x - ramp.from.x, ramp.to.z - ramp.from.z);
          if (length < K.least) continue;
          const grade = (ramp.from.y - ramp.to.y) / length;
          // Steeper than its lip's drop all the way down is no ramp, and
          // nor is one a rider let go at a crawl would not glide down.
          if (grade > steepest(r.row) || grade < K.fall) continue;
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
    });
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

/** How much higher than its top's middle a ramp's head on the rim may
 * stand, m: a rider let go there slides out to it. */
const RIM_RISE = 0.2;

/** The steepest a ramp down to a run of `row`'s colour falls overall: to a
 * green or a blue no more than `grade`, to a red or a black `steep` — a
 * rider headed for one never meets a pitch harder than it, and never a lip
 * to be thrown off. */
function steepest(row: { steepest: { max: number } } | undefined): number {
  return row && row.steepest.max <= BLUE ? K.grade : K.steep;
}
const BLUE = GRADES.blue.steepest.max;

/** Every how many of a run's points a ramp is aimed at, and how many points
 * round the pad's rim it is tried from. */
const AIM_EVERY = 4;
const RIM = 36;

/** The ramp from (fx, fz) on a pad's rim toward the run's point `q`, ended
 * where the line first meets the run's snow, at that snow's own height — a
 * run is not level across, and its edge up the slope stands over its line
 * — through its own shoulder, which it is pressed over; null where the line crosses another run's ground (its snow, its
 * shoulder and windrow) or a station first, or never meets the run. */
function rampTo(
  run: { id: string; points: readonly { x: number; y: number; z: number; s: number }[] },
  own: number,
  fx: number,
  fz: number,
  q: { x: number; z: number },
  height: (x: number, z: number) => number,
  cover: RunCover,
  station: (x: number, z: number, run: string) => boolean,
): SummitRamp | null {
  const len = hypot(q.x - fx, q.z - fz);
  const ux = (q.x - fx) / len;
  const uz = (q.z - fz) / len;
  for (let u = 0; u <= len; u += 1.5) {
    const x = fx + ux * u;
    const z = fz + uz * u;
    if (station(x, z, run.id)) return null;
    const near = cover(x, z, SHOULDER + LINE_SPARE);
    if (near >= 0 && near !== own) return null;
    if (cover(x, z, 0) !== own) continue;
    let best = Infinity;
    let s = 0;
    for (const a of run.points) {
      const e = hypot(a.x - x, a.z - z);
      if (e < best) {
        best = e;
        s = a.s;
      }
    }
    return {
      run: run.id,
      from: { x: fx, y: height(fx, fz), z: fz },
      to: { x, y: height(x, z), z, s },
      width: K.width,
    };
  }
  return null;
}

/** How much further than the pressing a ramp's line keeps off another
 * run's ground, m: a couple of cells, so no cell under it is left. */
const LINE_SPARE = 4;

/** Every cell of `field` a ramp's corridor reaches, with its weight: whole
 * across the ramp, eased out over `blend` beside it and past its foot;
 * never inside its pad (the pad's own), on a run's ground (`onRun`) or
 * where `keep` says. */
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
    if (!padded(p.kind)) continue;
    const k = p.kind === "gondola" ? "gondola" : "chair";
    const back = (p.x - x) * p.dx + (p.z - z) * p.dz;
    if (back < A.from[k] - A.ease || back > Math.min(A.length, p.length / 2)) continue;
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

/** R26, R27 — WHETHER A RAMP HAS ROOM to come down off pad `p`'s rim to a
 * run starting at (x, z), `half` m wide: from some point of the rim, out
 * off it and clear of the cut under its way in, a straight line to the
 * run's edge over no `blocked` ground, under no lift's line and through no
 * way in's cut, falling at least `fall` to the ground at that edge (and
 * `ROOM_SPARE` more, the run's grading moving it) and no more than the lip lets it — the line,
 * from its head on the rim, or null where there is none. What a run's
 * start is placed by, and the ground the runs walked after it keep off
 * (`nearRoom`), so the ramp `planRamps` lays once the runs are pressed has
 * its room. */
export function rampRoom(
  p: StationPad,
  pads: readonly StationPad[],
  lifts: readonly { bottom: { x: number; z: number }; top: { x: number; z: number } }[],
  x: number,
  z: number,
  half: number,
  row: { steepest: { max: number } },
  height: (x: number, z: number) => number,
  blocked: (x: number, z: number) => boolean,
): RampRoom | null {
  for (let a = 0; a < RIM; a++) {
    const ang = (a / RIM) * Math.PI * 2;
    const fx = p.x + Math.sin(ang) * p.r;
    const fz = p.z + Math.cos(ang) * p.r;
    if ((x - fx) * (fx - p.x) + (z - fz) * (fz - p.z) <= 0) continue;
    if (inApproach(pads, fx, fz, APPROACH_HEAD)) continue;
    const d = hypot(x - fx, z - fz);
    const length = d - half;
    if (length < K.least) continue;
    // Down to the run's edge on its side: falling enough to the ground there
    // as it stands (a run is not level across, its edge up the slope over
    // its line), and not too steeply to its line's (where the run's grading
    // cuts its edge down to it).
    const rim = height(fx, fz);
    const edge = height(fx + ((x - fx) * length) / d, fz + ((z - fz) * length) / d);
    if ((rim - edge) / length < K.fall * ROOM_SPARE) continue;
    if ((rim - height(x, z)) / length > steepest(row) * ROOM_STEEP) continue;
    let clear = true;
    for (let u = 0; clear && u <= length; u += ROOM_STEP) {
      const k = u / (length + half);
      const px = fx + (x - fx) * k;
      const pz = fz + (z - fz) * k;
      clear =
        !blocked(px, pz) &&
        !inApproach(pads, px, pz) &&
        !lifts.some((l) => offLine(l, px, pz) < LINE_KEEP);
    }
    if (clear) return { from: { x: fx, z: fz }, to: { x, z } };
  }
  return null;
}

/** What a ramp's room off `pad` keeps off as a start is placed (R26): the
 * room kept for every ramp before it, two ramps' ground apart
 * (`overlaps`); every run walked (`onRun`); every other pad and its eased
 * ground (`keep.pad` m past its rim); every other station (`keep.station`
 * m). */
export function roomBlocked(
  pad: StationPad | null,
  pads: readonly StationPad[],
  stations: readonly { x: number; z: number }[],
  rooms: readonly RampRoom[],
  keep: { pad: number; station: number },
  onRun: (x: number, z: number) => boolean,
): (x: number, z: number) => boolean {
  return (x, z) =>
    rooms.some((r) => nearRoom(r, x, z) < K.width / 2) ||
    onRun(x, z) ||
    pads.some((p) => p !== pad && hypot(x - p.x, z - p.z) < p.r + keep.pad) ||
    stations.some(
      (p) =>
        !(pad && hypot(p.x - pad.x, p.z - pad.z) < 1) && hypot(x - p.x, z - p.z) < keep.station,
    );
}

/** A ramp's room kept as a start is placed: its line from the rim to the
 * run's start. */
export type RampRoom = { from: { x: number; z: number }; to: { x: number; z: number } };

/** How far (x, z) stands off a ramp's room, m, past the ramp's own ground
 * (its half-width and its blend). */
export function nearRoom(r: RampRoom, x: number, z: number): number {
  const ex = r.to.x - r.from.x;
  const ez = r.to.z - r.from.z;
  const k = Math.max(
    0,
    Math.min(1, ((x - r.from.x) * ex + (z - r.from.z) * ez) / (ex * ex + ez * ez || 1)),
  );
  return hypot(x - (r.from.x + ex * k), z - (r.from.z + ez * k)) - K.width / 2 - K.blend;
}

/** How much more than `fall` a start is asked to lie under a ramp's head,
 * and the step its line is read at, m. */
const ROOM_SPARE = 1;
/** The share of the steepest a ramp may fall at that a start is placed
 * under: the run's grading cuts its snow down, the ramp's foot with it. */
const ROOM_STEEP = 0.7;
const ROOM_STEP = 3;

/** R26 — the ramps off every pad (`planRamps`), pressed into `ground` off a
 * run's snow and every other run's ground (`cover`) and every lift's bottom
 * station. */
export function layRamps(
  ground: Heightfield,
  pads: readonly StationPad[],
  runs: Parameters<typeof planRamps>[1],
  cover: RunCover,
  lifts: readonly {
    id: string;
    kind: string;
    bottom: { x: number; z: number };
    top: { x: number; z: number };
  }[],
): Map<string, SummitRamp[]> {
  // A station's footprint, and every run's first `head` metres (its start,
  // its windrows) — but the run a ramp comes down onto, whose head it is
  // making for.
  const heads = runs.flatMap((r) =>
    r.points.filter((q) => q.s <= K.head).map((q) => ({ ...q, run: r.id })),
  );
  const station = (x: number, z: number, more = 0, own = ""): boolean =>
    lifts.some((l) => hypot(x - l.bottom.x, z - l.bottom.z) < STATION_KEEP + more) ||
    heads.some((h) => h.run !== own && hypot(x - h.x, z - h.z) < h.width / 2 + SHOULDER + more);
  // The line is kept a couple of cells further off than the pressing is,
  // so no cell it is read over is one left unpressed.
  const margin = ground.cell * 2;
  const height = (x: number, z: number): number => sampleField(ground, x, z);
  // Its line never down under a lift's, among the towers — but beside the
  // track of the drag it leaves the top of, which its rider was just pulled
  // up on the snow.
  const from = new Map(runs.map((r) => [r.id, r.from]));
  const under = (x: number, z: number, run: string): boolean =>
    lifts.some(
      (l) => !(l.kind === "drag" && l.id === from.get(run)) && offLine(l, x, z) < LINE_KEEP,
    );
  const ramps = planRamps(
    pads,
    runs,
    height,
    cover,
    (x, z, run) => station(x, z, margin, run) || under(x, z, run) || inApproach(pads, x, z),
    (x, z) => inApproach(pads, x, z, APPROACH_HEAD),
  );
  // Under a lift's line a ramp only ever cuts: never up into the rope — a
  // drag's own track aside, which it leaves on the snow.
  const lines = (x: number, z: number, run: string): boolean =>
    lifts.some(
      (l) => !(l.kind === "drag" && l.id === from.get(run)) && offLine(l, x, z) < LINE_CUT,
    );
  const index = new Map(runs.map((r, i) => [r.id, i]));
  pressRamps(
    ground,
    ramps,
    pads,
    (x, z, run) => offOwn(cover, x, z, index.get(run) ?? -1, SHOULDER),
    (x, z, run) => station(x, z, 0, run),
    lines,
  );
  return ramps;
}

/** Whether (x, z) is a run's snow, or another run's than `own` out to
 * `past` m past its edge: ground a ramp to `own` leaves as it lies. */
function offOwn(cover: RunCover, x: number, z: number, own: number, past: number): boolean {
  if (cover(x, z, 0) >= 0) return true;
  const near = cover(x, z, past);
  return near >= 0 && near !== own;
}

/** R26 — press every ramp into `ground`, its pad's (`pads`, by lift): never
 * on the ground `onRun` keeps for a run, nor where `keep` says. */
export function pressRamps(
  ground: Heightfield,
  ramps: ReadonlyMap<string, readonly SummitRamp[]>,
  pads: readonly StationPad[],
  onRun: (x: number, z: number, run: string) => boolean,
  keep: (x: number, z: number, run: string) => boolean,
  cutOnly: (x: number, z: number, run: string) => boolean = () => false,
): void {
  for (const pad of pads) {
    for (const ramp of ramps.get(pad.lift) ?? []) {
      const run = (x: number, z: number): boolean => onRun(x, z, ramp.run);
      const own = (x: number, z: number): boolean => keep(x, z, ramp.run);
      eachCell(ground, ramp, pad, run, own, (i, w, t) => {
        const h = ground.data[i] * (1 - w) + rampHeight(ramp, t) * w;
        if (h > ground.data[i] && cutOnly(cellX(ground, i), cellZ(ground, i), ramp.run)) return;
        ground.data[i] = h;
      });
    }
  }
}

/** R26 — groom every ramp, up to a run's edge and never over its snow, nor
 * over another run's ground out to `past` m past its edge. */
export function groomRamps(
  packed: Heightfield,
  ramps: ReadonlyMap<string, readonly SummitRamp[]>,
  pads: readonly StationPad[],
  runs: readonly { id: string }[],
  cover: RunCover,
  past: number,
): void {
  const index = new Map(runs.map((r, i) => [r.id, i]));
  for (const pad of pads) {
    for (const ramp of ramps.get(pad.lift) ?? []) {
      const own = index.get(ramp.run) ?? -1;
      eachCell(
        packed,
        ramp,
        pad,
        (x, z) => offOwn(cover, x, z, own, past),
        () => false,
        (i, w) => {
          if (w > packed.data[i]) packed.data[i] = w;
        },
      );
    }
  }
}
