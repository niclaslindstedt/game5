// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R27 — THE RUNS, WALKED: every run of a resort laid down the mountain from
// its top station (or, a lane, off a piste part-way down), asking the index
// of the runs laid before it (`net-index.ts`) "is another run near here?".
//
// A run is walked the way R5's piste is (`track.ts`): two metres a step
// down the mountain, its heading bending either side of a CENTRE on a slow
// wave, the untouched ground steering it off any heading it would climb
// along or fall along steeper than its colour allows, the turn each step
// capped at what R6 lets a bend that steep and that wide make, and the
// heading never within a right angle of straight across the face — so
// every station is further down the map than the one before and a run can
// never double back over itself. What is new is that it is not alone:
//
//   * ITS CENTRE IS A TARGET, not the fall line: the bearing from where it
//     is to where it is going (the village, the foot of a lift, the far side
//     of the face), so a blue off the peak can wind across to the gentle
//     sector and a transport lane can traverse the whole mountain.
//   * IT MEETS THE RUNS LAID BEFORE IT. Every step it asks the index how
//     near the nearest other run is, and looks ahead along its heading; a
//     run it would come within `network.gap` of — the bench either side and
//     a strip of the mountain between — it MERGES into: from there its
//     wanted heading is the other's, turned in toward the other's line by
//     how far off it it still stands, until it runs inside the other on its
//     line, along it. A run that would have to CROSS another to reach it
//     (still pointed across it when it reaches its edge) is refused, and the
//     resort draws it again.
//   * A RUN THAT MEETS NOTHING ENDS ON THE VALLEY FLOOR, turned to the fall
//     line for R5's finish straight into the village.
//
// The walk draws everything it draws before its first step, in a fixed
// order, so a refused walk costs the stream nothing beyond its own draws.

import {
  angleDiff,
  clamp,
  hypot,
  smoothstep,
  TAU,
} from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { valueNoise } from "@niclaslindstedt/oss-game-framework/core/noise";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { pisteGradeOf, steepestSpan, type GradeRow, type PisteGrade } from "./grades.ts";
import { NetIndex, netHit } from "./net-index.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES as R, bendFloor, inBand } from "./rules.ts";
import { flankAt, type TerrainPlan } from "./terrain.ts";
import { bendRoom, minSeparation, setHeadings, tightestBend } from "./track.ts";
import type { RunKind, TrackPoint } from "./types.ts";

/** What a run is asked to be, before it is walked (`resort.ts`). */
export type RunSpec = {
  /** The run's number on the piste map, from 1. */
  readonly id: string;
  /** The station it leaves (`Lift.id` of the lift whose top it is). */
  readonly from: string;
  readonly kind: RunKind;
  /** The colour it is built to (R23) — a road's is the green's. */
  readonly row: GradeRow;
  /** Where it starts, and the heading it would like to leave on. */
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  /** Where it is going: a point down the mountain it steers its centre at
   * until it is level with it, and then straight down to the floor. */
  readonly target: { readonly x: number; readonly z: number };
  /** The wave's amplitude, rad: how far either side of the centre it
   * swings. */
  readonly amplitude: number;
  /** A LANE's destination (R27): the run (its index in the walk) it is laid
   * to join, at its target — every other run it meets it crosses. */
  readonly join?: number;
  /** A REAL FACE's pistes (`real-hints.ts`): the bends of the real one the
   * run steers its centre through, top first, before its target — and,
   * between them, the point on a real piste ahead it steers for. */
  readonly via?: readonly { readonly x: number; readonly z: number }[];
  readonly follow?: (x: number, z: number) => { readonly x: number; readonly z: number } | null;
  /** A LANE's route (`lanes.ts`): the line it follows down to its join. */
  readonly route?: readonly { readonly x: number; readonly z: number }[];
  /** Which way across the fall line it leans off its top (−1 … 1), the
   * side its start is looked for on first. */
  readonly lean: number;
  /** A BRANCH LANE's start (R27): the run it leaves part-way down (its
   * index in the walk) and the arc on it. */
  readonly branch?: { readonly run: number; readonly s: number };
  /** A LINK LANE's end (R27): the lift whose bottom station it runs to. */
  readonly to?: string;
  /** Ground a piste may not run over — a drag lift's line, whose track is
   * ridden on the snow (R26). */
  readonly avoid?: (x: number, z: number, half: number) => boolean;
};

/** A run as it is walked and then built. */
export type WalkedRun = {
  spec: RunSpec;
  points: TrackPoint[];
  length: number;
  /** The untouched (or the earlier runs') ground under each station, and
   * the cross-fall the corridor keeps there (R8) — `track.ts`'s `Piste`. */
  raw: Float64Array;
  cross: Float64Array;
  /** The run this one merges into, by its index in the walk, and the arc
   * on it where this one runs onto its line; null on a run that reaches
   * the floor. */
  into: { run: number; s: number } | null;
  /** The arc on THIS run from which it runs beside the one it merges into
   * — its corridor touching the other's — m; its length on a run that
   * reaches the floor. */
  mergeFrom: number;
  /** The arc on this run from which its centre runs inside the other's
   * width and flat shoulder — where its grading is drawn onto the other's
   * surface — m; its length on a run that reaches the floor. */
  coreFrom: number;
  /** The arc on this run where it began closing on the one it merges into
   * (it came within the clearance of it), m; its length on a run that
   * reaches the floor. */
  mergeStart: number;
  /** The steepest its start may fall (R12), when the mountain made it
   * gentler than the colour it was built to and its start is that
   * colour's; its row's own when unset. */
  startSlope?: number;
  /** How many times its walk turned away from a harder run it would have
   * merged into (R29). */
  turned: number;
};

export { NetIndex, netHit, type NetHit } from "./net-index.ts";

/** The widest a run is anywhere (R27), m. */
export const WIDEST = RR.piste.most;

/** The bench either side of a run's width: the flat shoulder and the
 * windrow's (R8, R18). */
export const BENCH = R.track.shoulder.flat + R.berm.width;

/** The least plan distance two runs' centrelines keep where neither merges
 * into the other (R27): both half-widths, both benches and the gap. */
export function clearance(a: number, b: number): number {
  return a / 2 + b / 2 + 2 * BENCH + RR.network.gap;
}

/** How much further off than the clearance a walk keeps from another run:
 * the line it walks is smoothed and its widths read again afterwards, and
 * either moves an edge a few metres. */
const WALK_MARGIN = 12;

/** The look-aheads a heading is judged over, m: a run is bulldozed across
 * the folds of the face on an average pitch, not walked down the fall line
 * of every spur. */
const LOOK_AHEAD = [20, 40, 60] as const;

/** The headings a step chooses among: every `HEADING_STEP` rad either side
 * of the map's fall line, to `swing`. */
const HEADING_STEP = 0.06;

/** R27 — THE HEADING A RUN TAKES at a point: of every heading it may take,
 * the one that best keeps the untouched mountain falling along it between
 * `minFall` and `cap` over every look-ahead (a lane's at its `aim` pitch,
 * too), nearest the heading the run wants (`want`) and nearest the one it
 * has (`current`). A pitch past the cap or a climb costs far more than any
 * bearing, so a run winds across a slope too steep for it and keeps on
 * one side of the fall line while it can. */
export function chooseHeading(
  ground: Heightfield,
  x: number,
  z: number,
  want: number,
  current: number,
  cap: number,
  aim: number | null,
  swing: number,
  side = 0,
): number {
  const y0 = sampleField(ground, x, z);
  let best = want;
  let bestCost = Infinity;
  const least = R.track.minFall;
  // The local fall line, for the side a traverse is held on.
  const w = R.track.gradeWindow;
  const down = Math.atan2(
    -(sampleField(ground, x + w, z) - sampleField(ground, x - w, z)),
    -(sampleField(ground, x, z + w) - sampleField(ground, x, z - w)),
  );
  for (let h = -swing; h <= swing + 1e-9; h += HEADING_STEP) {
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    let over = 0;
    let under = 0;
    let fallSum = 0;
    for (const L of LOOK_AHEAD) {
      const fall = (y0 - sampleField(ground, x + fx * L, z + fz * L)) / L;
      over = Math.max(over, fall - cap);
      under = Math.max(under, least - fall);
      fallSum += fall;
    }
    let cost = Math.max(0, over) * 40 + Math.max(0, under) * 40;
    if (aim !== null) cost += Math.abs(fallSum / LOOK_AHEAD.length - aim) * 12;
    cost += Math.abs(angleDiff(h, want)) * 0.35 + Math.abs(angleDiff(h, current)) * 0.25;
    if (side !== 0) {
      const off = angleDiff(down, h);
      if (Math.abs(off) > 0.12 && Math.sign(off) !== side) cost += ZIGZAG_SIDE;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = h;
    }
  }
  return best;
}

/** THE ZIG-ZAG: a piste on a face steeper than its colour winds down it in
 * long traverses either side of the line to its target — the side it holds
 * costs the other this much — turning back when it has strayed `ZIGZAG_BAND`
 * metres off that line or held one side `ZIGZAG_HOLD` metres. */
const ZIGZAG_SIDE = 0.8;
const ZIGZAG_BAND = 110;
const ZIGZAG_HOLD = 420;

/** Turning away from a run it may not merge into: how far the wanted
 * heading is turned, rad, for how long after the run was last near, m, and
 * how far inside the clearance it may still come before it is refused, m. */
const REPEL_TURN = 0.7;
const REPEL_HOLD = 40;
const REPEL_SLACK = 14;

/** How hard a run is built to, for what may merge into it: a lane and a
 * green 0, a blue 1, a red 2, a black 3. */
export function rankOf(spec: RunSpec): number {
  if (spec.kind === "road") return 0;
  return spec.row.id === "blue" ? 1 : spec.row.id === "red" ? 2 : spec.row.id === "black" ? 3 : 0;
}

/** How far past its inside bench a bend's centre stands, m: the bank
 * behind the bench needs room before it meets the bank of the same bend's
 * other side, which stands on another height (R18). */
const BEND_ROOM = 10;

/** The wave's shape, as R5's walk lingers at its crests. */
const WAVE_SHAPE = 0.6;
/** The ease into and out of a sweep, m. */
const SWEEP_EASE = 40;
/** How far along its heading a run looks for another to meet, m. */
const AHEAD = [30, 60, 90, 120, 150];
/** How close to the other's line, and how true to its heading, a merging
 * run must come before it is one with it, m and rad. */
const JOIN_LATERAL = 2.5;
const JOIN_HEADING = 0.12;
/** How far up from the end of the run it merges into a run must have
 * joined it, m: from one that reaches the floor, its finish straight, its
 * run-out and a course's ease across the junction (R28); from one that
 * merges in turn, twice that ease — and how far down from its top. */
export const JOIN_FINISH = R.track.finish + R.track.runout + RR.course.merge;
export const JOIN_END = 2 * RR.course.merge;
/** How far a run may run beside another closing on it before the merge is
 * given up on, m. */
const MERGE_MOST = 700;
/** …and a lane on its traverse to the run it joins, m. */
const JOIN_MOST = 1600;
/** How hard a merging run turns in toward the other's line: rad per metre
 * off it, and the most. */
const MERGE_GAIN = 1 / 50;
const MERGE_TURN = 0.45;
/** How far off the other's heading a run may still be pointed when it
 * reaches the other's edge and be merging rather than crossing, rad. */
const CROSSING = 0.9;
/** A LANE CROSSES every run it meets but the one it is laid to join (R27),
 * and is let pass a run it crossed for this many metres. */
const CROSS_PAST = 140;
/** How near the end of its route a link lane ends at its station, m. */
const GOAL_END = 6;
/** The least angle a lane crosses a run at, rad: shallower, it joins it. */
const CROSS_LEAST = 0.5;
/** …and the least it is held to inside another's clearance, a little over
 * that for the smoothing of its line, rad; and how much further off than
 * the clearance it keeps from a run it does not cross, m. */
const LANE_SQUARE = 0.6;
const LANE_MARGIN = 10;
/** No neck closes a piste this near its top station, m: the start opens
 * onto the run. */
const NECK_FROM = 150;
/** How far apart the ends of a run may come out of the smoothing before the
 * tail is drawn back onto them, m. */
const HELD = 0.05;

/** A LAB'S EYE on the walks: when set, every walk that is refused is handed
 * to it with the line it had walked and why — what `make resort
 * ARGS=--walks` draws. Never set in the game. */
let walkTrace: ((spec: RunSpec, points: readonly TrackPoint[], why: string) => void) | null = null;
export function traceWalks(
  sink: ((spec: RunSpec, points: readonly TrackPoint[], why: string) => void) | null,
): void {
  walkTrace = sink;
}

/** Hand a walk refused after it was walked (its grading) to the trace. */
export function traceRefused(spec: RunSpec, points: readonly TrackPoint[], why: string): void {
  if (walkTrace) walkTrace(spec, points, why);
}

/** R27 — walk one run down the mountain from its spec, handing a refused
 * one to the lab's trace when one is set. */
export function walkRun(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  spec: RunSpec,
  net: NetIndex,
  shared: (run: number) => boolean,
): WalkedRun | string {
  const points: TrackPoint[] = [];
  const out = walk(rng, plan, ground, spec, net, shared, points);
  if (typeof out === "string" && walkTrace) walkTrace(spec, points, out);
  return out;
}

/** The heading a lane takes to follow its route: at the route's point a
 * look-ahead past the one nearest it. `at` is the index it was nearest
 * last, which only moves on. */
function followRoute(
  route: readonly { readonly x: number; readonly z: number }[],
  x: number,
  z: number,
  at: { i: number },
): number {
  const d2 = (k: number): number => (route[k].x - x) ** 2 + (route[k].z - z) ** 2;
  while (at.i + 1 < route.length && d2(at.i + 1) <= d2(at.i)) at.i++;
  // Look ahead by about forty metres.
  let j = at.i;
  let run = 0;
  while (j + 1 < route.length && run < 40) {
    run += hypot(route[j + 1].x - route[j].x, route[j + 1].z - route[j].z);
    j++;
  }
  const t = route[j];
  return Math.atan2(t.x - x, Math.max(0.5, t.z - z));
}

/** R27 — walk one run down the mountain from its spec. `shared` says which
 * runs leave the same top station (exempt from the gap for `network.shared`
 * metres). Returns the run, or why it could not be walked. */
function walk(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  spec: RunSpec,
  net: NetIndex,
  shared: (run: number) => boolean,
  points: TrackPoint[],
): WalkedRun | string {
  const T = R.track;
  const N = RR.network;
  const G = spec.row;
  const road = spec.kind === "road";
  const step = T.step;
  const size = plan.size;
  // Everything drawn is drawn here, in this order.
  const widthSeed = rng.int(1, 1 << 30);
  const bendSeed = rng.int(1, 1 << 30);
  const period = inBand(rng, T.wander.scale);
  let phase = rng.range(0, TAU);
  const sweeps: { at: number; length: number; angle: number }[] = [];
  const nSweeps = road ? 0 : rng.int(0, G.track.sweeps.max);
  for (let i = 0; i < nSweeps; i++) {
    sweeps.push({
      at: rng.range(0.15, 0.7) * N.sweepReach,
      length: inBand(rng, T.sweeps.length),
      angle: inBand(rng, T.sweeps.angle) * (rng.chance(0.5) ? 1 : -1),
    });
  }
  // THE NECKS down a piste (R27): where it tightens and opens out again.
  const NK = RR.piste.neck;
  const necks: { from: number; to: number }[] = [];
  if (!road) {
    for (
      let at = inBand(rng, NK.every) * rng.range(0.3, 0.8);
      at < N.longest;
      at += inBand(rng, NK.every)
    ) {
      if (at < NECK_FROM) continue;
      necks.push({ from: at, to: at + inBand(rng, NK.length) });
    }
  }
  const neckW = G.id ? NK.width[G.id] : 0;
  const swing = road ? RR.road.swing : T.swing;
  // The pitch a run's walk holds its traverses to: well under its colour's
  // ceiling, so the grading wins back at every traverse what it filled in
  // at every turn across the fall line (R27); a black's is its row's own.
  const steepest = road
    ? RR.road.grade * RR.road.steer
    : G.id === "black" || G.id === null
      ? G.track.steepest
      : G.steepest.max * N.traverse;
  const aimPitch = (RR.road.aim.min + RR.road.aim.max) / 2;
  const W = road ? RR.road.width : G.id ? RR.piste.width[G.id] : G.track.width;
  // The tree line as a height (the village stands at the floor's): a piste
  // opens out on the open snow above it.
  const lineY = plan.treeLine - plan.altitude;
  const zEnd = size * T.finishZ;
  const edge = (plan.flankBand ?? RR.massif.flank).inner - 140;
  const widthAt = (p: TrackPoint): number => {
    const v = valueNoise(p.s, 0, T.widthScale, widthSeed);
    let wide = W.min + (W.max - W.min) * smoothstep(0.15, 0.85, v);
    if (road) return wide;
    const y = sampleField(ground, p.x, p.z);
    wide = Math.min(
      RR.piste.most,
      wide * (1 + RR.piste.open * smoothstep(lineY - 60, lineY + 60, y)),
    );
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const reach = wide / 2;
    const fall =
      (sampleField(ground, p.x + rx * reach, p.z + rz * reach) -
        sampleField(ground, p.x - rx * reach, p.z - rz * reach)) /
      wide;
    wide -= (wide - W.min) * smoothstep(T.narrow.min, T.narrow.max, Math.abs(fall));
    const neck = necks.find((k) => p.s > k.from && p.s < k.to);
    if (!neck || neckW >= wide) return wide;
    const close =
      smoothstep(neck.from, neck.from + NK.ease, p.s) *
      (1 - smoothstep(neck.to - NK.ease, neck.to, p.s));
    return wide + (neckW - wide) * close;
  };
  const turnFor = (width: number, grade: number): number =>
    (step / Math.max(bendFloor(grade), width / 2 + BENCH + BEND_ROOM + 4)) * 0.85;
  const pitchAt = (px: number, pz: number, heading: number): number => {
    const L = 30;
    const dx = Math.sin(heading) * L;
    const dz = Math.cos(heading) * L;
    const here = sampleField(ground, px, pz);
    return Math.max(
      (here - sampleField(ground, px + dx, pz + dz)) / L,
      (sampleField(ground, px - dx, pz - dz) - here) / L,
    );
  };
  let x = spec.x;
  let z = spec.z;
  let h = spec.heading;
  let s = 0;
  points.push({ x, z, y: 0, s, heading: h, width: 0 });
  points[0].width = widthAt(points[0]);
  const hit = netHit();
  let merging = -1;
  let joining = false;
  const onRoute = { i: 0 };
  /** Whether a run's stretch at arc `at` is its finish, near the floor:
   * its last `network.finish` metres, which a run coming into the village
   * beside it passes by (R27). */
  const atFinish = (r: number, at: number): boolean =>
    z >= zEnd - N.finish && at > net.runs[r].points[net.runs[r].points.length - 1].s - N.finish;
  /** The runs a walk does not meet here: its own top's, near it; a run a
   * lane has crossed, past it; a finish near the floor. */
  const skip = (r: number, at: number): boolean =>
    (shared(r) && s < N.shared) || (crossed.get(r) ?? -1) > s || atFinish(r, at);
  const third = netHit();
  const beside = netHit();
  /** The runs a lane may come near: the pistes off its own top, near it;
   * the run it joins, from where it turns to join it, and any other joining
   * that run there. */
  const laneSkip = (r: number, at: number): boolean =>
    (shared(r) && !net.runs[r].road && Math.min(s, at) < N.sibling) ||
    (joining && (r === merging || (net.runs[r].into === merging && at >= net.runs[r].from)));
  let pressed = false;
  let repel = { side: 0, until: -1 };
  let turned = 0;
  const rank = rankOf(spec);
  let mergeFrom = Infinity;
  let coreFrom = Infinity;
  let mergeStart = 0;
  let into: { run: number; s: number } | null = null;
  // The zig-zag's side (+1 toward +x of the fall line) and where it began.
  let zz = spec.lean >= 0 ? 1 : -1;
  let zzFrom = 0;
  const lineX = spec.target.x - spec.x;
  const lineZ = spec.target.z - spec.z;
  const lineLen = hypot(lineX, lineZ) || 1;
  const crossed = new Map<number, number>();
  const most = Math.ceil(N.longest / step);
  while (true) {
    if (points.length > most) return "the run runs out of length before it ends";
    const here = points[points.length - 1];
    const hw = here.width;
    let want = h;
    if (merging >= 0 && joining) {
      // A LANE JOINING its run: on along its own traverse toward the point
      // it was laid to, at a lane's pitch, until its line meets the run's.
      net.nearest(x, z, 600, (r) => r !== merging, hit);
      if (hit.distance === Infinity) return "a lane lost the run it was joining";
      if (hit.distance < hit.width / 2 + BENCH + hw / 2) mergeFrom = Math.min(mergeFrom, s);
      if (hit.distance < hit.width / 2 + R.track.shoulder.flat) coreFrom = Math.min(coreFrom, s);
      if (hit.distance < Math.max(JOIN_LATERAL * 2, hit.width / 4)) {
        into = { run: merging, s: hit.s };
        break;
      }
      if (spec.route && onRoute.i >= spec.route.length - 1) {
        const end = spec.route[spec.route.length - 1];
        if (hypot(end.x - x, end.z - z) > 30) return "a lane runs past the end of its route";
      }
      if (s - mergeStart > JOIN_MOST) return "a lane never reaches the run it joins";
      if (spec.route) want = clamp(followRoute(spec.route, x, z, onRoute), -swing, swing);
      else {
        const toward = spec.join === merging ? spec.target : { x: hit.x, z: hit.z };
        want = chooseHeading(
          ground,
          x,
          z,
          clamp(Math.atan2(toward.x - x, Math.max(1, toward.z - z)), -swing, swing),
          h,
          steepest,
          aimPitch,
          swing,
        );
      }
    } else if (merging >= 0) {
      // MERGING: the other's heading, turned in toward its line.
      net.nearest(x, z, 300, (r) => r !== merging, hit);
      if (hit.distance === Infinity) return "a run lost the one it was merging into";
      if (Math.abs(hit.lateral) < hw / 2 + hit.width / 2 + BENCH)
        mergeFrom = Math.min(mergeFrom, s);
      if (Math.abs(hit.lateral) < hit.width / 2 + R.track.shoulder.flat) {
        coreFrom = Math.min(coreFrom, s);
      }
      const off = angleDiff(hit.heading, h);
      if (Math.abs(hit.lateral) < hit.width / 2 && Math.abs(off) > CROSSING) {
        return "a run crosses another";
      }
      // Never into the other's last stretch: its finish into the village is
      // passed by (R27), and a course must have a run left to follow
      // across the junction (R28).
      const other = net.runs[merging];
      const last = other.points[other.points.length - 1].s;
      if (hit.s > last - (other.into < 0 ? JOIN_FINISH : JOIN_END)) {
        return "a run merges into another's finish";
      }
      // …nor into its first stretch, off its top station.
      if (hit.s < JOIN_END && Math.abs(hit.lateral) < hit.width / 2 + BENCH + hw / 2) {
        return "a run merges into another's start";
      }
      if (Math.abs(hit.lateral) < JOIN_LATERAL && Math.abs(off) < JOIN_HEADING) {
        into = { run: merging, s: hit.s };
        break;
      }
      if (s - mergeStart > MERGE_MOST) return "a run never closes on the one it merges into";
      // On its way in it keeps clear of every third run but one merging
      // into the same run beside it, as anywhere (R27).
      net.nearest(
        x,
        z,
        hw / 2 + 2 * BENCH + N.gap + WIDEST,
        (r, at) =>
          r === merging || (net.runs[r].into === merging && at >= net.runs[r].from) || skip(r, at),
        third,
      );
      if (third.distance < clearance(hw, third.width)) {
        return "a run is pressed against a run it may not merge into";
      }
      // A piste closes on the other's line whatever its pitch: from the
      // junction on, the course is the other's.
      want = clamp(
        hit.heading - clamp(hit.lateral * MERGE_GAIN, -MERGE_TURN, MERGE_TURN),
        -swing,
        swing,
      );
    } else if (s >= T.hold) {
      const vary = 1 + T.wander.vary * (valueNoise(s, 0, 500, bendSeed) * 2 - 1);
      phase += (TAU * step) / (period * vary);
      const wave = Math.sin(phase);
      let bend = spec.amplitude * Math.sign(wave) * Math.abs(wave) ** WAVE_SHAPE;
      for (const sw of sweeps) {
        const into = s - sw.at;
        if (into <= -SWEEP_EASE || into >= sw.length + SWEEP_EASE) continue;
        const w =
          smoothstep(-SWEEP_EASE, 0, into) *
          (1 - smoothstep(sw.length, sw.length + SWEEP_EASE, into));
        bend = bend * (1 - w) + sw.angle * w;
      }
      // Away from a run it may not merge into.
      if (repel.until > s) bend += repel.side * REPEL_TURN;
      // THE CENTRE: the bearing to the target, then the fall line below it.
      // A real piste's next bend ahead first, where the run follows one.
      const aim = spec.follow?.(x, z) ?? spec.via?.find((p) => p.z > z + 40) ?? spec.target;
      const tz = Math.max(aim.z, z + 60);
      const level = road ? 0 : smoothstep(spec.target.z - 120, spec.target.z, z);
      const off = road ? RR.road.swing : N.centre;
      const centre = clamp(Math.atan2(aim.x - x, tz - z), -off, off) * (1 - level);
      bend += centre;
      // THE FINISH: turned to the fall line for the village.
      bend *= 1 - smoothstep(zEnd - T.finishTurn, zEnd - 20, z);
      // THE FACE: turned back from the side ridges.
      const across = x - size / 2;
      const away = smoothstep(edge, edge + 120, Math.abs(across));
      bend = bend * (1 - away) + -Math.sign(across) * 0.8 * away;
      if (!road) {
        // How far off the line to its target the run has strayed, + toward
        // +x of it.
        const off = ((x - spec.x) * lineZ - (z - spec.z) * lineX) / lineLen;
        const flip =
          (zz > 0 && off > ZIGZAG_BAND) ||
          (zz < 0 && off < -ZIGZAG_BAND) ||
          s - zzFrom > ZIGZAG_HOLD;
        if (flip) {
          zz = s - zzFrom > ZIGZAG_HOLD ? (off > 0 ? -1 : 1) : -zz;
          zzFrom = s;
        }
      }
      want = spec.route
        ? clamp(followRoute(spec.route, x, z, onRoute), -swing, swing)
        : chooseHeading(
            ground,
            x,
            z,
            clamp(bend, -swing, swing),
            h,
            steepest,
            road ? aimPitch : null,
            swing,
            road ? 0 : zz,
          );
    }
    const maxTurn = turnFor(hw, pitchAt(x, z, h) * G.track.pitch);
    h = clamp(h + clamp(angleDiff(h, want), -maxTurn, maxTurn), -swing, swing);
    x += Math.sin(h) * step;
    z += Math.cos(h) * step;
    s += step;
    const p: TrackPoint = { x, z, y: 0, s, heading: h, width: 0 };
    p.width = widthAt(p);
    points.push(p);
    if (merging < 0 && (road || s >= T.hold)) {
      // ANOTHER RUN NEAR: beside us, or ahead along the heading — once a
      // piste is off its start (R12), which leaves its gate straight. A piste
      // merges into it; a lane merges into one it meets going its way down
      // a gentle line, and crosses any other.
      // Near the floor a run comes into the village beside the others: their
      // finishes are passed by, never merged into (R27).
      const reach = p.width / 2 + 2 * BENCH + N.gap + WIDEST;
      const meet = (): boolean => {
        // A piste merges only into a run built no harder than itself — a
        // skier who came down a blue is never made to ski a red to the lift
        // (R29) — and not into one it left its top with until it has run
        // its own way: from either it turns away, and is walked again if it
        // is pressed against it.
        if (!road && ((shared(hit.run) && s < N.sibling) || net.runs[hit.run].rank > rank)) {
          if (net.runs[hit.run].rank > rank && repel.until < s) turned++;
          repel = { side: Math.sign(hit.lateral) || 1, until: s + REPEL_HOLD };
          if (hit.distance < clearance(p.width, hit.width) - REPEL_SLACK) pressed = true;
          return false;
        }
        if (!road) return true;
        // A lane joins the run it was laid to, and any it meets running its
        // own way; it crosses the rest.
        if (
          hit.run === spec.join ||
          (!spec.route && Math.abs(angleDiff(hit.heading, h)) < CROSS_LEAST)
        ) {
          joining = true;
          return true;
        }
        crossed.set(hit.run, s + CROSS_PAST);
        return false;
      };
      net.nearest(x, z, reach, skip, hit);
      if (hit.distance < Infinity && hit.distance < clearance(p.width, hit.width) + WALK_MARGIN) {
        if (meet()) {
          merging = hit.run;
          mergeStart = s;
        }
      } else {
        for (const d of AHEAD) {
          const ax = x + Math.sin(h) * d;
          const az = z + Math.cos(h) * d;
          net.nearest(ax, az, reach, skip, hit);
          if (
            hit.distance < Infinity &&
            hit.distance < clearance(p.width, hit.width) + WALK_MARGIN
          ) {
            if (meet()) {
              merging = hit.run;
              mergeStart = s;
            }
            break;
          }
        }
      }
    }
    if (!road && s < N.sibling) {
      // OFF A SHARED TOP: beside the runs that left it with this one, never
      // onto one — its line stays off the other's width and bench.
      net.nearest(x, z, WIDEST / 2 + BENCH, (r) => !shared(r), beside);
      if (beside.distance < beside.width / 2 + BENCH)
        return "a run runs over one that left its top with it";
    }
    if (road) {
      // A LANE BESIDE A RUN it does not join (R27): it crosses a piste
      // square or keeps the gap from it, and never meets another lane —
      // the one pressed after would cut through the other's bench.
      net.nearest(x, z, p.width / 2 + 2 * BENCH + N.gap + WIDEST, laneSkip, beside);
      if (
        beside.distance < clearance(p.width, beside.width) + LANE_MARGIN &&
        (net.runs[beside.run].road || Math.abs(angleDiff(beside.heading, h)) < LANE_SQUARE)
      ) {
        return "a lane runs beside a run";
      }
    }
    if (!road && spec.avoid?.(x, z, p.width / 2)) return "a run runs over a drag lift's line";
    if (pressed) return "a run is pressed against a run it may not merge into";
    // A LINK LANE ends at the lift's bottom station it was laid to.
    if (spec.to !== undefined) {
      const end = spec.route?.[spec.route.length - 1];
      if (end && hypot(end.x - x, end.z - z) < GOAL_END) break;
      if (end && onRoute.i >= (spec.route?.length ?? 0) - 1 && z > end.z + GOAL_END) {
        return "a lane runs past the end of its route";
      }
      continue;
    }
    if (merging < 0 && z >= zEnd) break;
  }
  const station = spec.to !== undefined;
  if (!into && !station) {
    // THE FINISH STRAIGHT, opening out into the village.
    const arena = points[points.length - 1].width;
    const open = Math.max(arena, T.width.max);
    const straight = Math.round(T.finish / step);
    for (let k = 1; k <= straight; k++) {
      x += Math.sin(h) * step;
      z += Math.cos(h) * step;
      s += step;
      points.push({
        x,
        z,
        y: 0,
        s,
        heading: h,
        width: arena + (open - arena) * smoothstep(0, 0.5, k / straight),
      });
    }
  }
  const length = s;
  if (length < (road ? RR.road.shortest : N.shortest))
    return `a run comes out ${length.toFixed(0)} m long`;
  const end = { x, z };
  smoothRun(points, spec, into || station ? end : null);
  if (!into && !station) {
    const straight = Math.round(T.finish / step);
    const walked = points.length - straight - 1;
    for (let i = 0; i <= walked; i++) points[i].width = widthAt(points[i]);
    for (let k = 1; k <= straight; k++) {
      const open = smoothstep(0, 0.5, k / straight);
      points[walked + k].width =
        points[walked].width +
        (Math.max(points[walked].width, T.width.max) - points[walked].width) * open;
    }
  } else {
    for (const p of points) p.width = widthAt(p);
  }
  setHeadings(points);
  const n = points.length;
  const cross = new Float64Array(n);
  const run: WalkedRun = {
    spec,
    points,
    length,
    raw: new Float64Array(n),
    cross,
    into,
    mergeFrom: into ? Math.min(mergeFrom, length) : length,
    coreFrom: into ? Math.min(coreFrom, length) : length,
    mergeStart: into ? mergeStart : length,
    turned,
  };
  const bend = tightestBend(run, (i) => sampleField(ground, points[i].x, points[i].z));
  if (bend.radius < bend.floor) {
    return `a bend tightens to ${bend.radius.toFixed(0)} m on a ${(bend.grade * 100).toFixed(0)} % pitch`;
  }
  if (bendRoom(run) < BEND_ROOM) return "a bend folds the inside bench";
  if (minSeparation(run) < T.separation.plan) return "a run passes close by itself";
  if (road) {
    // A LANE AS SMOOTHED, held to the gap again (R27): it crosses a run
    // square or keeps the gap from it, but where it leaves its piste and
    // where it joins its run.
    const onto = into?.run ?? -1;
    for (const p of points) {
      // Every stretch of a piste it crosses square is passed: the nearest
      // of the rest is the one to keep the gap from.
      const skipLane = (r: number, at: number): boolean =>
        (shared(r) && !net.runs[r].road && Math.min(p.s, at) < N.sibling) ||
        (r === onto && p.s >= mergeStart) ||
        (onto >= 0 && net.runs[r].into === onto && p.s >= mergeStart && at >= net.runs[r].from) ||
        (!net.runs[r].road &&
          Math.abs(angleDiff(headingAt(net.runs[r].points, at), p.heading)) >= CROSS_LEAST);
      net.nearest(p.x, p.z, p.width / 2 + 2 * BENCH + N.gap + WIDEST, skipLane, beside);
      if (beside.distance < clearance(p.width, beside.width)) return "a lane runs beside a run";
    }
  }
  if (!into && !road) {
    // THE VILLAGE: a run that reaches the floor comes in beside the others'
    // finishes (R27) — their benches may meet, their corridors never.
    const from = length - N.finish - T.finish;
    for (const p of points) {
      if (p.s < from) continue;
      net.nearest(p.x, p.z, WIDEST + 2 * BENCH, (r) => shared(r) && p.s < N.shared, hit);
      if (hit.distance < p.width / 2 + hit.width / 2 + 2 * BENCH) {
        return "a run comes into the village over another";
      }
    }
  }
  const reach = WIDEST / 2 + BENCH + T.bank.max + 10;
  for (const p of points) {
    if (p.x < reach || p.x > size - reach || p.z < reach || p.z > size - reach) {
      return "a run runs off the map";
    }
    const rx = Math.cos(p.heading) * (p.width / 2 + BENCH);
    const rz = -Math.sin(p.heading) * (p.width / 2 + BENCH);
    if (flankAt(plan, p.x + rx, p.z + rz) > 0.05 || flankAt(plan, p.x - rx, p.z - rz) > 0.05) {
      return "a run runs up a side ridge";
    }
  }
  return run;
}

/** R27 — THE COLOUR A RUN MEASURES: R23's steepest colour window along
 * its own line, up to where it runs inside the run it merges into (`onto`,
 * that run's stations) — past that the snow is the other's, and so is the
 * pitch. A course down both is measured whole (R28). */
export function runColour(
  points: readonly TrackPoint[],
  onto: readonly TrackPoint[] | null,
): PisteGrade {
  let n = points.length;
  if (onto) {
    for (let i = n - 1; i > 1; i--) {
      const p = points[i];
      let best = Infinity;
      let width = 0;
      for (const q of onto) {
        const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
        if (d < best) {
          best = d;
          width = q.width;
        }
      }
      if (Math.sqrt(best) >= width / 2) break;
      n = i;
    }
  }
  const own = points.slice(0, Math.max(2, n));
  return pisteGradeOf(steepestSpan({ track: { points: own, length: own[own.length - 1].s } }));
}

/** A run's heading at arc `s`, off its nearest station. */
function headingAt(points: readonly TrackPoint[], s: number): number {
  const last = points[points.length - 1].s;
  const i = Math.round((clamp(s, 0, last) / Math.max(1e-9, last)) * (points.length - 1));
  return points[i].heading;
}

/** THE WALK SMOOTHED (`track.ts`'s `smoothWalk`): the headings through a
 * triangular window and the line laid again from the start along them —
 * and, on a run that merges, the tail drawn back so it still ends where
 * the walk ended, on the other's line. Writes `x`, `z` in place. */
function smoothRun(
  points: TrackPoint[],
  spec: RunSpec,
  end: { x: number; z: number } | null,
): void {
  const n = points.length;
  const raw = points.map((p) => p.heading);
  const step = R.track.step;
  const K = 5;
  let x = spec.x;
  let z = spec.z;
  for (let i = 1; i < n; i++) {
    let sum = 0;
    let norm = 0;
    for (let j = -K; j <= K; j++) {
      const w = K + 1 - Math.abs(j);
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
  if (!end) return;
  const dx = end.x - points[n - 1].x;
  const dz = end.z - points[n - 1].z;
  if (Math.abs(dx) < HELD && Math.abs(dz) < HELD) return;
  // Spread the miss over the last stretch, eased in, so the line bends
  // the little it must and no more.
  const span = Math.min(n - 1, Math.round(240 / step));
  for (let i = n - 1 - span; i < n; i++) {
    const w = smoothstep(0, 1, (i - (n - 1 - span)) / span);
    points[i].x += dx * w;
    points[i].z += dz * w;
  }
}
