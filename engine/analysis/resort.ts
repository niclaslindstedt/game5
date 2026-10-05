// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R25–R30 — A RESORT HELD TO ITS RULES: the network as the level publishes
// it, every run and every lift re-checked on the finished mountain, never
// on the plan that laid them.
//
// `analyzeLevel` holds the COURSE a map is raced on to R1–R24 as it holds
// any piste; this holds what a resort adds — every other run on the
// mountain, the transport lanes, the junctions, the lifts, the hub and its
// wind tunnels, whether every piste can be skied again (`access.ts`) —
// and the woods across all of it (R14), which is the dear half and is read
// once per resort rather than once per course. Its findings name their
// rules, like the rest of the scoreboard, and the generator rejects a
// resort on any error.

import { angleDiff, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { PisteGrade } from "../mapgen/grades.ts";
import { BENCH, NetIndex, WIDEST, clearance, netHit, runColour } from "../mapgen/network.ts";
import { regionOf, scaleBand } from "../mapgen/regions.ts";
import { RESORT_RULES as RR } from "../mapgen/resort-rules.ts";
import { LEVEL_RULES as R, withinBand } from "../mapgen/rules.ts";
import { minSeparation, tightestBend, windowGrades } from "../mapgen/track.ts";
import { driftAt } from "../mapgen/drift.ts";
import type { Level, Lift, Run } from "../mapgen/types.ts";
import { generatorTraits } from "../mapgen/versions.ts";
import { liftPlans, ropeShortfall } from "../game/lift-line.ts";
import { accessOf } from "./access.ts";
import { holdDrags, holdHub, holdTunnels } from "./hub.ts";
import type { Finding, Severity } from "./index.ts";

export { accessOf, accessReport, type AccessReport, type RunAccess } from "./access.ts";

/** The narrowest a piste closes, at a black's neck (R27), m. */
const NECKEST = Math.min(...Object.values(RR.piste.neck.width));

/** What a resort's analysis reports. */
export type ResortAnalysis = {
  ok: boolean;
  findings: Finding[];
  stats: {
    runs: number;
    roads: number;
    lifts: number;
    courses: number;
    /** Runs by the colour they measure. */
    colours: Record<PisteGrade, number>;
    /** Kilometres of piste by colour, and of transport lane. */
    km: Record<PisteGrade | "road", number>;
    /** Courses by colour. */
    courseColours: Record<PisteGrade, number>;
    junctions: number;
    /** The least strip two runs keep between their benches outside a
     * junction or a shared top, m. */
    leastGap: number;
    /** The steepest any lane falls over a grade window, m per m. */
    roadSteepest: number;
    /** R29: the pistes that cannot be skied again without a harder one,
     * and the drag lifts laid for it (every drag but the nursery's). */
    stranded: number;
    drags: number;
  };
};

/** The network as an index, built once per published runs array. */
const indices = new WeakMap<readonly Run[], NetIndex>();
export function runIndex(runs: readonly Run[]): NetIndex {
  let net = indices.get(runs);
  if (!net) {
    net = new NetIndex();
    for (const r of runs) net.add(r.points);
    indices.set(runs, net);
  }
  return net;
}

/** R27's colour mix: the least number of runs of each colour an area
 * offers, by region. */
export const COLOUR_MIX: Readonly<Record<string, Record<PisteGrade, number>>> = {
  alpine: { green: 1, blue: 1, red: 1, black: 1 },
  fell: { green: 1, blue: 1, red: 1, black: 0 },
  continental: { green: 0, blue: 0, red: 1, black: 1 },
  maritime: { green: 1, blue: 1, red: 1, black: 0 },
};

/** How much steeper than `road.grade` a lane may READ over a grade window:
 * a lane is graded to its ceiling over the steps of its own line, and a
 * window read across a piste's camber where it joins or crosses picks up a
 * little of the piste's own fall. */
const ROAD_SLACK = 0.025;

/** How far down a run the gap is read past a junction or a top it shares,
 * m of slack on the stretch the rule exempts. */
const SLACK = 10;

/** How far a top station's pad may fall across it and still be level
 * (R26), m. */
const PAD_TOLERANCE = 0.3;
/** How near a run's line the pad is that run's snow, m. */
const PAD_LINE = 10;

/** R26 — a top station's pad as the finished ground reads: how far it
 * stands off the surface R26 cuts it to — level on a v4 map; from v5 its
 * deck along the line level and the pad leaning off it to both sides
 * (`lift.top`) — over rings out to near its rim (round a chair's unload
 * mound, and off any run's line across it), and the mound's height over it
 * — null for a drag, whose top is held by `lift.drag.padGrade`. */
function padReading(
  level: Level,
  l: { kind: string; bottom: { x: number; z: number }; top: { x: number; y: number; z: number } },
): { spread: number; ramp: number | null } | null {
  if (l.kind === "drag") return null;
  const len = Math.max(1, hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z));
  const back = RR.lift.unload.at / len;
  const ux = l.top.x + (l.bottom.x - l.top.x) * back;
  const uz = l.top.z + (l.bottom.z - l.top.z) * back;
  const dx = (l.top.x - l.bottom.x) / len;
  const dz = (l.top.z - l.bottom.z) / len;
  const chair = l.kind === "chair";
  const levelPads = generatorTraits(level.version).levelPads === true;
  const pad = levelPads ? RR.lift.pad : RR.lift.top.pad;
  const deck = levelPads ? Infinity : RR.lift.top.deck;
  const lean = levelPads ? 0 : RR.lift.top.lean;
  // A run's line crossing the pad is the snow it was graded to (R27).
  const reach = pad / 2 + PAD_LINE + 4;
  const lines = (level.resort?.runs ?? []).flatMap((r) =>
    r.points.filter((p) => hypot(p.x - l.top.x, p.z - l.top.z) < reach),
  );
  let lo = Infinity;
  let hi = -Infinity;
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    for (const r of [0, 0.15, 0.3, 0.45].map((k) => k * pad)) {
      const x = l.top.x + Math.sin(t) * r;
      const z = l.top.z + Math.cos(t) * r;
      if (chair && onUnload(x - ux, z - uz, dx, dz, levelPads)) continue;
      // From v5 the ground under the line's way in is cut away (R26).
      if (!levelPads) {
        const back = (l.top.x - x) * dx + (l.top.z - z) * dz;
        const v = Math.abs((x - l.top.x) * dz - (z - l.top.z) * dx);
        const A = RR.lift.top.approach;
        const k = chair ? "chair" : "gondola";
        if (back > A.from[k] - A.ease && v < A.half[k] + A.blend) continue;
      }
      if (lines.some((p) => hypot(x - p.x, z - p.z) < PAD_LINE)) continue;
      // The lean off the deck taken back out: what is left is level.
      const v = Math.abs((x - l.top.x) * dz - (z - l.top.z) * dx);
      const g = level.groundAt(x, z) + lean * Math.max(0, v - deck);
      lo = Math.min(lo, g);
      hi = Math.max(hi, g);
    }
  }
  const ramp = chair ? level.groundAt(ux, uz) - level.groundAt(l.top.x, l.top.z) : null;
  return { spread: hi - lo, ramp };
}

/** Whether a point (rx, rz) from a chair's unload point is on its unload
 * ramp (R26): a level pad's mound round it, a leaning pad's ramp along the
 * line beside it (`lift.unload`), with a metre to spare. */
function onUnload(rx: number, rz: number, dx: number, dz: number, levelPads: boolean): boolean {
  const U = RR.lift.unload;
  if (levelPads) return hypot(rx, rz) < U.reach + 1;
  const along = rx * dx + rz * dz;
  const across = Math.abs(rx * dz - rz * dx);
  return along > -U.back - U.edge - 1 && along < U.reach + 1 && across < U.half + U.edge + 1;
}

/** What is wrong with a ramp off a top (R26) as the ground reads it, or
 * null: it leaves its pad's rim, comes down to its run, and falls all the
 * way to its foot — never climbing over any `RAMP_STEP` m of it, and never
 * steeper than its even fall allows. */
function rampFault(
  level: Level,
  l: {
    kind: string;
    bottom: { x: number; z: number };
    top: { x: number; y: number; z: number };
  },
  r: NonNullable<Lift["ramps"]>[number],
): string | null {
  // A drag's ramps leave the ground round where it lets go of its rider.
  const len = hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z) || 1;
  const back = l.kind === "drag" ? RR.lift.drag.letGo / len : 0;
  const mx = l.top.x + (l.bottom.x - l.top.x) * back;
  const mz = l.top.z + (l.bottom.z - l.top.z) * back;
  const rim = hypot(r.from.x - mx, r.from.z - mz);
  const want = l.kind === "drag" ? RR.lift.drag.rim : RR.lift.top.pad / 2;
  if (Math.abs(rim - want) > 0.5) return `leaves ${rim.toFixed(1)} m off its top`;
  const run = level.resort?.runs.find((q) => q.id === r.run);
  if (!run) return "comes down to no run";
  const length = hypot(r.to.x - r.from.x, r.to.z - r.from.z);
  if (r.from.y - r.to.y < RR.lift.top.ramp.fall * length - RAMP_SLACK)
    return `falls only ${((r.from.y - r.to.y) / length).toFixed(2)} to its run`;
  let last = level.groundAt(r.from.x, r.from.z);
  // Short of its foot, where the run's own shoulder and windrow begin.
  for (let u = RAMP_STEP; u <= length - RAMP_STEP; u += RAMP_STEP) {
    const k = u / length;
    const y = level.groundAt(
      r.from.x + (r.to.x - r.from.x) * k,
      r.from.z + (r.to.z - r.from.z) * k,
    );
    if (y > last + RAMP_SLACK) return `climbs at ${u.toFixed(0)} m`;
    if ((last - y) / RAMP_STEP > RAMP_MOST + RAMP_SLACK)
      return `falls at ${((last - y) / RAMP_STEP).toFixed(2)} at ${u.toFixed(0)} m`;
    last = y;
  }
  return null;
}

/** How far a rope may fall short of its clearance and still clear, m. */
const ROPE_SLACK = 0.25;

/** How far a run's head may stand over the depth under its top it was
 * slid to (R27), m: its grading moves it. */
const START_SLACK = 1.5;

/** The steepest a ramp falls anywhere along it: its steepest overall, eased
 * off the pad over its first `ease` share and even after. */
const RAMP_MOST = RR.lift.top.ramp.steep / (1 - RR.lift.top.ramp.ease / 2);

/** The step a ramp is read at, m, and the slack its fall is read with. */
const RAMP_STEP = 4;
const RAMP_SLACK = 0.05;

/** How near its lift's bottom station a link lane must end (R27), m. */
const LINK_END = 24;

/** Re-check the resort a level stands in. A map without one has nothing
 * to hold. */
export function analyzeResort(level: Level): ResortAnalysis {
  const findings: Finding[] = [];
  const add = (rule: string, severity: Severity, message: string): void => {
    findings.push({ rule, severity, message });
  };
  const colours: Record<PisteGrade, number> = { green: 0, blue: 0, red: 0, black: 0 };
  const courseColours: Record<PisteGrade, number> = { green: 0, blue: 0, red: 0, black: 0 };
  const km: Record<PisteGrade | "road", number> = { green: 0, blue: 0, red: 0, black: 0, road: 0 };
  const resort = level.resort;
  const empty = {
    ok: false,
    findings,
    stats: {
      runs: 0,
      roads: 0,
      lifts: 0,
      courses: 0,
      colours,
      km,
      courseColours,
      junctions: 0,
      leastGap: Infinity,
      roadSteepest: 0,
      stranded: 0,
      drags: 0,
    },
  };
  if (!resort) {
    add("R25", "error", "no resort published");
    return empty;
  }
  const region = regionOf(level);
  const runs = resort.runs;
  const byId = new Map(runs.map((r) => [r.id, r]));
  const net = runIndex(runs);

  // R25 — the massif's vertical, and the village on the valley floor.
  const M = level.mountain;
  if (M && !withinBand(M.vertical, scaleBand(RR.massif.vertical, region.relief.vertical), 1e-6)) {
    add("R25", "error", `a vertical of ${M.vertical.toFixed(0)} m`);
  }
  if (resort.village.z < R.mountain.base * level.size - 1) {
    add("R25", "error", "the village is not on the valley floor");
  }

  // R26 — the lifts climb, and nothing grows on their lines.
  for (const l of resort.lifts) {
    if (l.top.y <= l.bottom.y + 20)
      add("R26", "error", `${l.id} climbs only ${(l.top.y - l.bottom.y).toFixed(0)} m`);
  }
  // R26 — every gondola's and chair's top on its level pad, a chair's with
  // its unload ramp.
  {
    for (const l of resort.lifts) {
      const pad = padReading(level, l);
      if (!pad) continue;
      if (pad.spread > PAD_TOLERANCE)
        add("R26", "error", `${l.id}'s top pad stands ${pad.spread.toFixed(2)} m off its cut`);
      if (pad.ramp !== null && pad.ramp < RR.lift.unload.height * 0.8)
        add("R26", "error", `${l.id}'s unload ramp stands only ${pad.ramp.toFixed(2)} m`);
    }
    // R26 — every lift's rope clear of the snow by what it owes, all the way
    // to its wheels (from v5, whose approaches are cut for it).
    if (!generatorTraits(level.version).levelPads) {
      for (const plan of liftPlans(level)) {
        const short = ropeShortfall(level, plan);
        if (short.lack > ROPE_SLACK)
          add(
            "R26",
            "error",
            `${plan.lift.id}'s rope runs ${short.lack.toFixed(2)} m into its clearance ${(plan.length - short.u).toFixed(0)} m short of its top`,
          );
      }
    }
    // R26 — every ramp off a top: off its pad's rim, down to its run, never
    // climbing and never steeper than its lip's drop; and on a leaning pad
    // every piste off a chair's or a gondola's top comes down to by one, so
    // a rider let go there slides to it.
    for (const l of resort.lifts) {
      for (const r of l.ramps ?? []) {
        const why = rampFault(level, l, r);
        if (why) add("R26", "error", `${l.id}'s ramp to run ${r.run} ${why}`);
      }
      if (l.kind === "drag" || generatorTraits(level.version).levelPads) continue;
      for (const r of runs) {
        if (r.from !== l.id) continue;
        if (r.kind === "piste" && !l.ramps?.some((q) => q.run === r.id))
          add("R26", "error", `${l.id}'s run ${r.id} has no ramp down to it`);
        // R27 — every run off it, a lane too, starts under it: a rider off
        // the lift never climbs to his run.
        const head = r.points[0];
        if (head && head.y > l.top.y - RR.lift.top.ramp.drop + START_SLACK)
          add(
            "R27",
            "error",
            `${l.id}'s run ${r.id} starts ${(head.y - l.top.y).toFixed(1)} m against its top`,
          );
      }
    }
    // R26 — every bottom station, and a drag's top, beside the runs; no
    // drag lift across a piste.
    const hitAt = netHit();
    const onRun = (x: number, z: number, pistes: boolean): boolean => {
      net.nearest(x, z, WIDEST, (r) => pistes && runs[r].kind === "road", hitAt);
      return hitAt.distance < hitAt.width / 2;
    };
    for (const l of resort.lifts) {
      const len = hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z) || 1;
      const dx = (l.top.x - l.bottom.x) / len;
      const dz = (l.top.z - l.bottom.z) / len;
      const F = RR.lift.footprint[l.kind];
      const ends: { at: { x: number; z: number }; f: number }[] = [{ at: l.bottom, f: 1 }];
      if (l.kind === "drag") ends.push({ at: l.top, f: -1 });
      for (const { at, f } of ends) {
        let on = 0;
        for (let u = -F.back; u <= F.ahead; u += 4)
          for (let v = -F.half; v <= F.half; v += 4)
            if (onRun(at.x + f * (dx * u + dz * v), at.z + f * (dz * u - dx * v), false)) on++;
        if (on > 0)
          add("R26", "error", `${l.id}'s ${f > 0 ? "bottom" : "top"} station stands on a run`);
      }
      if (l.kind !== "drag") continue;
      let across = 0;
      for (let u = 0; u <= len; u += 4)
        if (onRun(l.bottom.x + dx * u, l.bottom.z + dz * u, true)) across++;
      if (across > 0) add("R26", "error", `${l.id} crosses a piste`);
    }
  }

  // R27 — every run.
  let roadSteepest = 0;
  let junctions = 0;
  runs.forEach((run, self) => {
    const pts = run.points;
    const n = pts.length;
    if (n < 2) {
      add("R27", "error", `run ${run.id} has no line`);
      return;
    }
    // SHARED GROUND: where this run's corridor runs onto another's — its
    // tail inside the run it merges into, a lane across a piste, two runs
    // off one top — the snow is the other's, and its grade and its packing
    // are read on the other.
    const shared = new Uint8Array(n);
    const near = netHit();
    for (let i = 0; i < n; i++) {
      net.nearest(pts[i].x, pts[i].z, WIDEST, (r) => r === self, near);
      if (near.distance < pts[i].width / 2 + near.width / 2 + BENCH) shared[i] = 1;
    }
    const step = run.length / (n - 1);
    const road = run.kind === "road";
    const onto = run.into ? (byId.get(run.into.run)?.points ?? null) : null;
    const measured = road ? "green" : runColour(run.points, onto);
    if (!road && measured !== run.grade) {
      add("R27", "error", `run ${run.id} is billed ${run.grade} and measures ${measured}`);
    }
    if (road) km.road += run.length / 1000;
    else {
      colours[run.grade]++;
      km[run.grade] += run.length / 1000;
    }
    if (run.into) {
      junctions++;
      const into = byId.get(run.into.run);
      if (!into) add("R27", "error", `run ${run.id} merges into a run that is not there`);
      else if (run.into.s < 0 || run.into.s > into.length + 1) {
        add("R27", "error", `run ${run.id} merges ${run.into.s.toFixed(0)} m down run ${into.id}`);
      }
    } else if (run.to !== undefined) {
      // A link lane ends at the bottom station it runs to.
      const lift = resort.lifts.find((l) => l.id === run.to);
      const end = pts[n - 1];
      if (!lift || hypot(end.x - lift.bottom.x, end.z - lift.bottom.z) > LINK_END) {
        add("R27", "error", `run ${run.id} ends short of ${run.to}'s bottom station`);
      }
    } else if (pts[n - 1].z < R.track.finishZ * level.size - 1) {
      add("R27", "error", `run ${run.id} ends on the mountain without merging`);
    }
    if (run.branch) {
      junctions++;
      const parent = byId.get(run.branch.run);
      if (!parent || parent.kind !== "piste")
        add("R27", "error", `run ${run.id} leaves a run that is not a piste`);
    }
    // Never climbing, never doubling back up the map.
    for (let i = 1; i < n; i++) {
      if (pts[i].z <= pts[i - 1].z) {
        add("R27", "error", `run ${run.id} turns back up the map at ${pts[i].s.toFixed(0)} m`);
        break;
      }
    }
    const ys = pts.map((p) => p.y);
    // A kicker's ramp and a drop are R9's and R24's; read the grade where
    // neither stands — the run's own kickers are the course's on its map,
    // or carry its id.
    const skip = new Uint8Array(n);
    for (const k of level.kickers ?? []) {
      if (k.run !== undefined && k.run !== run.id) continue;
      if (k.run === undefined && !k.onTrack) continue;
      const hit = netHitOn(net, runs, run, k.x, k.z);
      if (hit === null) continue;
      for (let i = 0; i < n; i++) {
        const u = pts[i].s - hit;
        if (u > -k.ramp - 4 && u < k.landing + 4) skip[i] = 1;
      }
    }
    for (const c of level.cliffs ?? []) {
      if (c.run !== undefined && c.run !== run.id) continue;
      if (c.run === undefined && !c.onTrack) continue;
      const hit = netHitOn(net, runs, run, c.x, c.z);
      if (hit === null) continue;
      for (let i = 0; i < n; i++) {
        const u = pts[i].s - hit;
        if (u > -c.shelf - 4 && u < c.face + c.landing + 4) skip[i] = 1;
      }
    }
    for (let i = 0; i < n; i++) if (shared[i]) skip[i] = 1;
    const grades = windowGrades(ys, step, skip);
    if (grades.gentlest < -0.01) {
      add("R27", "error", `run ${run.id} climbs at ${(-grades.gentlest).toFixed(3)}`);
    }
    const ceiling = road ? RR.road.grade + ROAD_SLACK : R.track.maxGrade + 0.01;
    if (grades.steepest > ceiling) {
      add(
        "R27",
        "error",
        `run ${run.id} falls at ${grades.steepest.toFixed(3)} (most ${ceiling.toFixed(2)})`,
      );
    }
    if (road) roadSteepest = Math.max(roadSteepest, grades.steepest);
    // Widths: a piste's never under the narrowest neck (R27).
    const W = road ? RR.road.width : { min: NECKEST, max: WIDEST };
    for (const p of pts) {
      if (!withinBand(p.width, W, 0.5)) {
        add("R27", "error", `run ${run.id} is ${p.width.toFixed(1)} m wide at ${p.s.toFixed(0)} m`);
        break;
      }
    }
    // Bends (R6), off the graded line's own fall.
    const tight = tightestBend(run, (i) => ys[i]);
    if (tight.radius < tight.floor - 0.5) {
      add(
        "R27",
        "error",
        `run ${run.id} bends to ${tight.radius.toFixed(0)} m on a ${(tight.grade * 100).toFixed(0)} % pitch`,
      );
    }
    if (minSeparation(run) < R.track.separation.plan - 0.5) {
      add("R27", "error", `run ${run.id} passes close by itself`);
    }
    // Packed on its line outside its drifts (R10, R17).
    let low = 1;
    for (let i = 0; i < n; i += 5) {
      if (shared[i] || driftAt(run.drifts, pts[i].s) > 0) continue;
      low = Math.min(low, level.packedAt(pts[i].x, pts[i].z));
    }
    if (low < 0.98) add("R27", "error", `run ${run.id}'s line is only ${low.toFixed(2)} packed`);
  });

  // R27 — the gap between runs, and no run across another.
  let leastGap = Infinity;
  const hit = netHit();
  runs.forEach((run, a) => {
    for (let i = 0; i < run.points.length; i += 3) {
      const p = run.points[i];
      net.nearest(p.x, p.z, 120, (r) => r === a, hit);
      if (hit.distance === Infinity) continue;
      const other = runs[hit.run];
      const need = clearance(p.width, hit.width);
      if (hit.distance >= need) {
        leastGap = Math.min(leastGap, hit.distance - p.width / 2 - hit.width / 2 - 2 * BENCH);
        continue;
      }
      // Exempt: two runs leaving one top, near it; a run closing on the one
      // it merges into; the one it closes on, beside it.
      if (run.from === other.from && Math.min(p.s, hit.s) < RR.network.sibling + SLACK) {
        continue;
      }
      if (run.into?.run === other.id && p.s >= run.into.from - SLACK) continue;
      if (other.into?.run === run.id && hit.s >= other.into.from - SLACK) continue;
      // A lane leaving a piste part-way down, near where it leaves.
      if (run.branch?.run === other.id && p.s < RR.network.sibling + SLACK) continue;
      if (other.branch?.run === run.id && hit.s < RR.network.sibling + SLACK) continue;
      // Two runs coming into the village side by side (R27).
      if (p.s > run.length - RR.network.finish && hit.s > other.length - RR.network.finish)
        continue;
      // A lane crossing a run (R27).
      if (
        (run.kind === "road" || other.kind === "road") &&
        Math.abs(angleDiff(p.heading, hit.heading)) > 0.5
      ) {
        continue;
      }
      // Two runs merging into one third run, side by side where they join it.
      if (run.into && other.into && run.into.run === other.into.run) {
        if (p.s >= run.into.from - SLACK && hit.s >= other.into.from - SLACK) continue;
      }
      add(
        "R27",
        "error",
        `runs ${run.id} and ${other.id} pass ${hit.distance.toFixed(0)} m apart at ${p.s.toFixed(0)} m down ${run.id}`,
      );
      return;
    }
  });

  // R27 — the colour mix.
  const mix = COLOUR_MIX[region.id] ?? COLOUR_MIX.alpine;
  for (const c of ["green", "blue", "red", "black"] as const) {
    if (colours[c] < mix[c]) add("R27", "warn", `no ${c} run on the mountain`);
  }
  const pistes = runs.filter((r) => r.kind === "piste").length;
  if (pistes < RR.network.runs.min) add("R27", "error", `only ${pistes} pistes`);

  // R28 — the courses.
  for (const c of resort.courses) {
    courseColours[c.grade]++;
    if (!withinBand(c.length, RR.course.length)) {
      add("R28", "error", `course ${c.id} is ${c.length.toFixed(0)} m`);
    }
  }
  if (resort.courses.length === 0) add("R28", "error", "no course down the mountain");

  // R29 — access: every piste skied again without a harder one, and no
  // lift an island; the hub it all comes down to.
  const access = accessOf(resort);
  for (const a of access.runs) {
    if (!a.ok) add("R29", "error", `run ${a.id} cannot be skied again: ${a.why}`);
    else if (a.home > RR.access.runout) {
      add(
        "R29",
        "warn",
        `run ${a.id} skis ${a.home.toFixed(0)} m on below it before a lift takes it back`,
      );
    }
  }
  for (const id of access.orphans) add("R29", "error", `no skier reaches ${id}'s bottom station`);
  holdHub(level, resort, add);
  // R30 — the wind tunnels; R26 — the drag lifts' lines.
  holdTunnels(level, resort, net, add);
  holdDrags(level, resort, net, add);

  // R14 — the woods: clear of every run and every lift; under the tree
  // line.
  let onRuns = 0;
  let onLifts = 0;
  for (const t of level.trees) {
    // Every run's corridor, not only the nearest centreline's: a lane
    // leaving a wide piste runs inside its surface.
    if (net.covers(t.x, t.z, R.forest.corridor - 0.5, hit)) onRuns++;
    for (const l of resort.lifts) {
      const dx = l.top.x - l.bottom.x;
      const dz = l.top.z - l.bottom.z;
      const len2 = dx * dx + dz * dz || 1;
      let u = ((t.x - l.bottom.x) * dx + (t.z - l.bottom.z) * dz) / len2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      if (hypot(t.x - (l.bottom.x + dx * u), t.z - (l.bottom.z + dz * u)) < RR.lift.clear - 0.5) {
        onLifts++;
        break;
      }
    }
  }
  if (onRuns > 0) add("R14", "error", `${onRuns} tree(s) stand on a run's corridor`);
  if (onLifts > 0) add("R26", "error", `${onLifts} tree(s) stand on a lift's line`);

  return {
    ok: findings.every((f) => f.severity !== "error"),
    findings,
    stats: {
      runs: runs.length,
      roads: runs.filter((r) => r.kind === "road").length,
      lifts: resort.lifts.length,
      courses: resort.courses.length,
      colours,
      km,
      courseColours,
      junctions,
      leastGap,
      roadSteepest,
      stranded: access.runs.filter((a) => !a.ok).length,
      drags: resort.lifts.filter((l) => l.kind === "drag" && l.id !== "D1").length,
    },
  };
}

/** How near a run that is NOT on the course comes to a point of it, m —
 * the course's own runs are the ones its line is laid along. Infinity past
 * `reach`. */
export function nearestOtherRun(
  level: Level,
  x: number,
  z: number,
  reach: number,
  atTop = false,
): number {
  const resort = level.resort;
  if (!resort) return Infinity;
  const net = runIndex(resort.runs);
  const course = resort.courses.find((c) => c.id === resort.course);
  // Near its top only the course's first run is its own: every other run
  // there left the top beside it.
  const mine = atTop ? course?.runs.slice(0, 1) : course?.runs;
  const own = new Set(resort.runs.flatMap((r, i) => (mine?.includes(r.id) ? [i] : [])));
  return net.nearest(x, z, reach, (r) => own.has(r), netHit()).distance;
}

/** Plan distance from a point to the nearest run's centreline, m (Infinity
 * past `reach`). */
export function nearestRun(level: Level, x: number, z: number, reach: number): number {
  const runs = level.resort?.runs;
  if (!runs) return Infinity;
  return runIndex(runs).nearest(x, z, reach, () => false, netHit()).distance;
}

/** The arc on `run` nearest a point, or null when the run is not near. */
function netHitOn(
  net: NetIndex,
  runs: readonly Run[],
  run: Run,
  x: number,
  z: number,
): number | null {
  const a = runs.indexOf(run);
  const h = net.nearest(x, z, 6, (r) => r !== a, netHit());
  return h.distance < 5 ? h.s : null;
}
