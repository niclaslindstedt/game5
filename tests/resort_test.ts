// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI AREA (R25–R30), held to its rule book across a spread of seeds in
// every region: the massif and the village, the lifts and the drags, the
// runs — never climbing, the lanes gentle, their colours measured, the
// necks, the gap between them — the courses down to the hub and the slalom
// gates on the one raced, every piste skied again without a harder one,
// the hub bare and groomed, and the two wind tunnels along it. Measured off
// what the map PUBLISHES, never the plan that laid it; the analysis
// (`analyzeResort`) holds the same book and must find it clean too.
//
// Then the course as skied, staged on the synthetic slope with slalom gates
// set on it by hand: a gate skied past costs `course.missPenalty` and the
// run goes on, and the gate line the bot skis stands on every gate.
import { describe, expect, it } from "vitest";

import {
  LEVEL_RULES as R,
  NEUTRAL_INPUT,
  PISTE_GRADES,
  REGION_IDS,
  RESORT_RULES as RR,
  TUNING,
  accessReport,
  analyzeLevel,
  analyzeResort,
  createGame,
  gateLineAt,
  generateLevel,
  outsideHub,
  pisteGradeOf,
  placeRun,
  slalom,
  step,
  steepestSpan,
  trackPointAt,
  windowGrades,
  withinBand,
  type GameEvent,
  type GameState,
  type GeneratedLevel,
  type Level,
  type PisteGrade,
  type RegionId,
  type ResortAnalysis,
  type Run,
  type TrackPoint,
} from "@engine";

import { nearestLift, runsCovering } from "./support/resort.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** The seeds each region is built on: two apiece, every one a whole ski
 * area — the most expensive map the engine builds, so built once here. */
const SEEDS: readonly number[] = [1, 38];

const built = new Map<string, GeneratedLevel>();
const resortAnalyses = new Map<GeneratedLevel, ResortAnalysis>();
/** The resort's analysis of a map, run once. */
function resortAnalysisOf(level: GeneratedLevel): ResortAnalysis {
  let hit = resortAnalyses.get(level);
  if (!hit) {
    hit = analyzeResort(level);
    resortAnalyses.set(level, hit);
  }
  return hit;
}
function areaFor(region: RegionId, seed: number): GeneratedLevel {
  const key = `${region}:${seed}`;
  let hit = built.get(key);
  if (!hit) {
    hit = generateLevel(seed, { region });
    built.set(key, hit);
  }
  return hit;
}

/** Every map of the spread, with its region. */
const areas = (): { region: RegionId; level: GeneratedLevel }[] =>
  REGION_IDS.flatMap((region) => SEEDS.map((seed) => ({ region, level: areaFor(region, seed) })));

const RANK: Readonly<Record<PisteGrade, number>> = { green: 0, blue: 1, red: 2, black: 3 };
/** The bench either side of a run (R8, R18), m. */
const BENCH = R.track.shoulder.flat + R.berm.width;
/** The narrowest a piste closes, at a black's neck (R27), m. */
const NECKEST = Math.min(...Object.values(RR.piste.neck.width));

/** The resort a map stands in; every map of the current generator has one. */
function resortOf(level: Level) {
  const resort = level.resort;
  expect(resort, `seed ${level.seed}`).toBeDefined();
  return resort!;
}

/** The stations of a run that are its own snow: off its kickers and drops
 * (R9, R24) and off any stretch another run's surface comes onto (a
 * junction, a lane leaving it, two runs off one top) — the stretches R27
 * reads the grade on. */
function ownStretch(level: Level, run: Run, index: number): Uint8Array {
  const pts = run.points;
  const skip = new Uint8Array(pts.length);
  const near = (x: number, z: number): number | null => {
    let best = Infinity;
    let at: number | null = null;
    for (const p of pts) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) {
        best = d;
        at = p.s;
      }
    }
    return best < 5 ? at : null;
  };
  const course = level.resort?.courses.find((c) => c.id === level.resort?.course);
  const raced = course?.runs.includes(run.id) ?? false;
  for (const k of level.kickers ?? []) {
    if (k.run !== run.id && !(raced && k.onTrack)) continue;
    const at = near(k.x, k.z);
    if (at === null) continue;
    pts.forEach((p, i) => {
      if (p.s - at > -k.ramp - 4 && p.s - at < k.landing + 4) skip[i] = 1;
    });
  }
  for (const c of level.cliffs ?? []) {
    if (c.run !== run.id && !(raced && c.onTrack)) continue;
    const at = near(c.x, c.z);
    if (at === null) continue;
    pts.forEach((p, i) => {
      if (p.s - at > -c.shelf - 4 && p.s - at < c.face + c.landing + 4) skip[i] = 1;
    });
  }
  pts.forEach((p, i) => {
    const others = runsCovering(level, p.x, p.z, BENCH);
    others.delete(index);
    if (others.size > 0) skip[i] = 1;
  });
  return skip;
}

/** R27's colour of a run: R23's steepest colour window on its own line, up
 * to where it runs inside the run it merges into. */
function measuredColour(run: Run, onto: readonly TrackPoint[] | null): PisteGrade {
  let n = run.points.length;
  if (onto) {
    for (let i = n - 1; i > 1; i--) {
      const p = run.points[i];
      let best = Infinity;
      let width = 0;
      for (const q of onto) {
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d < best) {
          best = d;
          width = q.width;
        }
      }
      if (best >= width / 2) break;
      n = i;
    }
  }
  const own = run.points.slice(0, Math.max(2, n));
  return pisteGradeOf(steepestSpan({ track: { points: own, length: own[own.length - 1].s } }));
}

describe("the ski area a seed builds (R25–R30)", () => {
  it("passes its own analysis, the network and the course raced on it alike", () => {
    for (const { region, level } of areas()) {
      const errors = analyzeLevel(level).findings.filter((f) => f.severity === "error");
      expect(errors, `${region} ${level.seed}`).toEqual([]);
      expect(resortAnalysisOf(level).ok, `${region} ${level.seed}`).toBe(true);
    }
  });

  it("stands one massif over the village (R25)", () => {
    for (const { region, level } of areas()) {
      const resort = resortOf(level);
      // Every country's mountain as tall (R25).
      expect(
        withinBand(level.mountain.vertical, RR.massif.vertical, 1e-6),
        `${region} ${level.seed}`,
      ).toBe(true);
      // The village on the valley floor, on the ground.
      expect(resort.village.z).toBeGreaterThanOrEqual(R.mountain.base * level.size - 1);
      expect(resort.village.y).toBeCloseTo(level.groundAt(resort.village.x, resort.village.z), 1);
      expect(level.region).toBe(region);
    }
  });

  it("lifts every skier up the mountain, and drags him back from a piste's foot (R26)", () => {
    for (const { region, level } of areas()) {
      const resort = resortOf(level);
      const ids = resort.lifts.map((l) => `${l.id}:${l.kind}`);
      for (const want of ["G1:gondola", "C1:chair", "C2:chair", "D1:drag"]) {
        expect(ids, `${region} ${level.seed}`).toContain(want);
      }
      for (const l of resort.lifts) {
        // Every lift climbs, its stations on the ground.
        expect(l.top.y).toBeGreaterThan(l.bottom.y + 20);
        expect(l.top.y).toBeCloseTo(level.groundAt(l.top.x, l.top.z), 1);
        if (l.kind !== "drag" || l.id === "D1") continue;
        // A drag laid for R29: its length, and no steeper than a rope pulls
        // a skier on his skis.
        const D = RR.lift.drag;
        const length = Math.hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z);
        expect(withinBand(length, D.length, 1), `${l.id} of ${region} ${level.seed}`).toBe(true);
        for (let u = 0; u + D.pitchWindow <= length; u += 4) {
          const at = (v: number): number =>
            level.groundAt(
              l.bottom.x + ((l.top.x - l.bottom.x) * v) / length,
              l.bottom.z + ((l.top.z - l.bottom.z) * v) / length,
            );
          expect((at(u + D.pitchWindow) - at(u)) / D.pitchWindow).toBeLessThanOrEqual(
            D.pitch + 0.03,
          );
        }
      }
      // Nothing grows on a lift's line.
      const onLine = level.trees.filter((t) => nearestLift(level, t.x, t.z) < RR.lift.clear - 0.5);
      expect(onLine, `${region} ${level.seed}`).toEqual([]);
    }
  });

  it("lays its runs down the mountain, never climbing, never doubling back (R27)", () => {
    for (const { region, level } of areas()) {
      const resort = resortOf(level);
      resort.runs.forEach((run, index) => {
        const pts = run.points;
        const who = `run ${run.id} of ${region} ${level.seed}`;
        for (let i = 1; i < pts.length; i++) expect(pts[i].z, who).toBeGreaterThan(pts[i - 1].z);
        const step = run.length / (pts.length - 1);
        const grades = windowGrades(
          pts.map((p) => p.y),
          step,
          ownStretch(level, run, index),
        );
        expect(grades.gentlest, who).toBeGreaterThanOrEqual(-0.01);
        expect(grades.steepest, who).toBeLessThanOrEqual(R.track.maxGrade + 0.01);
      });
    }
  });

  it("starts every piste under the top it leaves, never up the slope above it (R27)", () => {
    // Slid onto the top's contour just under the station (`headOnContour`);
    // the slack is what the pads pressed again, the runs graded and a drag
    // re-laid clear of the runs (`clearStations`) may move either by —
    // never the tens of metres a start found across the face through the
    // top could stand above it.
    for (const { region, level } of areas()) {
      const resort = resortOf(level);
      for (const run of resort.runs) {
        const top = resort.lifts.find((l) => l.id === run.from)?.top;
        if (run.kind !== "piste" || !top) continue;
        expect(run.points[0].y - top.y, `run ${run.id} of ${region} ${level.seed}`).toBeLessThan(6);
      }
    }
  });

  it("grades its lanes no steeper than a cat track, as wide as one (R27)", () => {
    for (const { region, level } of areas()) {
      const resort = resortOf(level);
      const lanes = resort.runs.filter((r) => r.kind === "road");
      expect(lanes.length, `${region} ${level.seed}`).toBeGreaterThan(0);
      resort.runs.forEach((run, index) => {
        if (run.kind !== "road") return;
        const who = `lane ${run.id} of ${region} ${level.seed}`;
        for (const p of run.points) expect(withinBand(p.width, RR.road.width, 0.5), who).toBe(true);
        const step = run.length / (run.points.length - 1);
        const grades = windowGrades(
          run.points.map((p) => p.y),
          step,
          ownStretch(level, run, index),
        );
        // The slack the analysis allows a lane read across a piste's camber.
        expect(grades.steepest, who).toBeLessThanOrEqual(RR.road.grade + 0.025);
        // A branch lane leaves a piste; a link lane ends at its lift's
        // bottom station; any other ends on a run or in the hub.
        if (run.branch) {
          expect(resort.runs.find((r) => r.id === run.branch?.run)?.kind, who).toBe("piste");
        }
        if (run.to !== undefined) {
          const lift = resort.lifts.find((l) => l.id === run.to);
          const end = run.points[run.points.length - 1];
          expect(lift, who).toBeDefined();
          expect(Math.hypot(end.x - lift!.bottom.x, end.z - lift!.bottom.z), who).toBeLessThan(25);
        }
      });
    }
  });

  it("measures every piste's colour on its own line, and offers its region's mix (R27)", () => {
    for (const { region, level } of areas()) {
      const resort = resortOf(level);
      const byId = new Map(resort.runs.map((r) => [r.id, r]));
      const pistes = resort.runs.filter((r) => r.kind === "piste");
      expect(pistes.length).toBeGreaterThanOrEqual(RR.network.runs.min);
      for (const run of pistes) {
        const onto = run.into ? (byId.get(run.into.run)?.points ?? null) : null;
        expect(measuredColour(run, onto), `run ${run.id} of ${region} ${level.seed}`).toBe(
          run.grade,
        );
      }
      // More than one colour on every mountain.
      expect(new Set(pistes.map((r) => r.grade)).size).toBeGreaterThan(1);
    }
  });

  it("keeps the mountain's strip between its runs but at a junction (R27)", () => {
    for (const { region, level } of areas()) {
      const a = resortAnalysisOf(level);
      const apart = a.findings.filter((f) => f.rule === "R27" && / pass .* apart /.test(f.message));
      expect(apart, `${region} ${level.seed}`).toEqual([]);
      expect(a.stats.leastGap, `${region} ${level.seed}`).toBeGreaterThanOrEqual(
        RR.network.gap - 0.5,
      );
      expect(a.stats.junctions).toBeGreaterThan(0);
    }
  });

  it("closes its pistes to necks and opens them out again, never narrower than a black's (R27)", () => {
    let necked = 0;
    for (const { region, level } of areas()) {
      for (const run of resortOf(level).runs) {
        if (run.kind !== "piste") continue;
        const widths = run.points.map((p) => p.width);
        const who = `run ${run.id} of ${region} ${level.seed}`;
        expect(Math.min(...widths), who).toBeGreaterThanOrEqual(NECKEST - 0.5);
        expect(Math.max(...widths), who).toBeLessThanOrEqual(RR.piste.most + 0.5);
        // A neck: down to its colour's neck width somewhere off its ends,
        // and wider again below it.
        const neck = RR.piste.neck.width[run.grade];
        const at = run.points.findIndex((p) => p.width <= neck + 0.5);
        if (at > 0 && run.points.slice(at).some((p) => p.width > neck + 5)) necked++;
      }
    }
    expect(necked).toBeGreaterThanOrEqual(areas().length);
  });

  it("chains every course from a top station down the runs to the hub (R28)", () => {
    for (const { region, level } of areas()) {
      const resort = resortOf(level);
      const byId = new Map(resort.runs.map((r) => [r.id, r]));
      expect(resort.courses.length).toBeGreaterThan(0);
      expect(resort.courses.map((c) => c.id)).toContain(resort.course);
      for (const c of resort.courses) {
        const who = `course ${c.id} of ${region} ${level.seed}`;
        expect(withinBand(c.length, RR.course.length), who).toBe(true);
        const runs = c.runs.map((id) => byId.get(id)!);
        expect(runs.every(Boolean), who).toBe(true);
        // Off a lift's top, each run into the next, the last into the hub.
        expect(
          resort.lifts.map((l) => l.id),
          who,
        ).toContain(runs[0].from);
        for (let i = 0; i + 1 < runs.length; i++)
          expect(runs[i].into?.run, who).toBe(runs[i + 1].id);
        const last = runs[runs.length - 1];
        expect(last.into, who).toBeNull();
        const end = last.points[last.points.length - 1];
        expect(outsideHub(resort.hub!, end.x, end.z), who).toBeLessThanOrEqual(1);
        // Its colour is the steepest on it.
        const steepest = Math.max(...runs.map((r) => RANK[r.grade]));
        expect(c.grade, who).toBe(PISTE_GRADES[steepest]);
      }
      // The map's own piste is the course raced, start line to finish.
      const raced = resort.courses.find((c) => c.id === resort.course)!;
      expect(level.track.length).toBeCloseTo(raced.length, 0);
      expect(level.grade).toBe(raced.grade);
    }
  });

  it("sets slalom gates on the course raced, alternating and inside the piste (R28)", () => {
    for (const { region, level } of areas()) {
      const cps = level.checkpoints;
      const G = RR.course.gates;
      const who = `${region} ${level.seed}`;
      expect(slalom(cps[0]), who).toBe(false);
      expect(slalom(cps[cps.length - 1]), who).toBe(false);
      let first = 0;
      for (let k = 1; k < cps.length - 1; k++) {
        const g = cps[k];
        expect(slalom(g), `gate ${k} of ${who}`).toBe(true);
        const off = g.offset ?? 0;
        // Narrower than the piste, inside it with the margin to spare.
        expect(g.width).toBeLessThanOrEqual(G.width[level.grade!] + 1e-6);
        expect(Math.abs(off) + g.width / 2).toBeLessThanOrEqual((g.span ?? 0) / 2 - G.margin + 0.5);
        // Left and right in turn: a gate's side is its place in the line,
        // a gate on the line over a kicker or a drop taking neither.
        if (off === 0) continue;
        const side = Math.sign(off) * (k % 2 === 1 ? 1 : -1);
        if (first === 0) first = side;
        expect(side, `gate ${k} of ${who}`).toBe(first);
        // The bot's line stands on its centre.
        expect(gateLineAt(level, g.s).offset).toBeCloseTo(off, 6);
      }
      expect(cps.filter((g) => (g.offset ?? 0) !== 0).length, who).toBeGreaterThan(cps.length / 3);
    }
  });

  it("brings every piste's skier back to its top without a harder run, and every lift in reach (R29)", () => {
    for (const { region, level } of areas()) {
      const resort = resortOf(level);
      const report = accessReport(level);
      const pistes = resort.runs.filter((r) => r.kind === "piste").map((r) => r.id);
      expect(report.runs.map((r) => r.id)).toEqual(pistes);
      for (const r of report.runs)
        expect(r.ok, `${r.id} of ${region} ${level.seed}: ${r.why}`).toBe(true);
      expect(report.orphans, `${region} ${level.seed}`).toEqual([]);
    }
    expect(accessReport({}).runs).toEqual([]);
  });

  it("opens a hub across the valley floor, groomed, with no tree, kicker or cliff in it (R29)", () => {
    for (const { region, level } of areas()) {
      const hub = resortOf(level).hub!;
      const who = `${region} ${level.seed}`;
      expect(hub, who).toBeDefined();
      hub.top.forEach((top, i) => {
        const depth = hub.bottom[i] - top;
        expect(depth, who).toBeGreaterThanOrEqual(RR.hub.depth.min - 1);
        expect(depth, who).toBeLessThanOrEqual(RR.hub.depth.max + 1);
      });
      const inside = (x: number, z: number): boolean => outsideHub(hub, x, z) === 0;
      expect(
        level.trees.filter((t) => inside(t.x, t.z)),
        who,
      ).toEqual([]);
      expect(
        level.kickers.filter((k) => inside(k.x, k.z)),
        who,
      ).toEqual([]);
      expect(
        level.cliffs.filter((c) => inside(c.x, c.z)),
        who,
      ).toEqual([]);
      // Groomed: read across its middle at every published column.
      hub.top.forEach((top, i) => {
        const x = hub.x0 + i * hub.step;
        expect(level.packedAt(x, (top + hub.bottom[i]) / 2), who).toBeGreaterThan(0.9);
      });
    }
  });

  it("blows two wind tunnels along the hub, one each way (R30)", () => {
    for (const { region, level } of areas()) {
      const resort = resortOf(level);
      const tunnels = resort.tunnels ?? [];
      const who = `${region} ${level.seed}`;
      expect(
        tunnels.map((t) => t.id),
        who,
      ).toEqual(["W1", "W2"]);
      const T = RR.tunnel;
      for (const t of tunnels) {
        expect(t.length, who).toBeGreaterThanOrEqual(T.length);
        expect(t.width).toBe(T.width);
        expect(t.speed).toBe(T.speed);
        for (const p of t.points) expect(outsideHub(resort.hub!, p.x, p.z), who).toBe(0);
        const grades = windowGrades(
          t.points.map((p) => p.y),
          t.length / (t.points.length - 1),
        );
        expect(Math.max(grades.steepest, -grades.gentlest), who).toBeLessThanOrEqual(
          T.grade + 0.01,
        );
        // No tree by its edge: the trees in its box first, then each
        // against its line.
        const clear = t.width / 2 + RR.lift.clear - 0.5;
        const xs = t.points.map((p) => p.x);
        const zs = t.points.map((p) => p.z);
        const box = (v: number, of: number[]): boolean =>
          v > Math.min(...of) - clear && v < Math.max(...of) + clear;
        const near = level.trees.filter(
          (tree) =>
            box(tree.x, xs) &&
            box(tree.z, zs) &&
            t.points.some((p) => Math.hypot(tree.x - p.x, tree.z - p.z) < clear),
        );
        expect(near, `${t.id} of ${who}`).toEqual([]);
      }
      // Opposite ways along the floor, apart.
      const [a, b] = tunnels;
      expect(Math.cos(a.points[0].heading - b.points[0].heading), who).toBeLessThan(-0.9);
      const mid = (t: (typeof tunnels)[number]) => t.points[t.points.length >> 1];
      expect(Math.abs(mid(a).z - mid(b).z), who).toBeGreaterThan(a.width);
    }
  });
});

// ── the course as skied, staged ────────────────────────────────────────

/** The synthetic slope with its gates between the start gate and the
 * finish set SLALOM-fashion: `width` m wide, alternately `offset` m right
 * and left of the line, on a piste `span` wide. */
function slalomSlope(offset = 6, width = 6): Level {
  const level = syntheticLevel({ noTrees: true, noKicker: true });
  const n = level.checkpoints.length;
  level.checkpoints = level.checkpoints.map((cp, k) => {
    if (k === 0 || k === n - 1) return cp;
    const p = trackPointAt(level, cp.s);
    const off = k % 2 === 1 ? offset : -offset;
    return {
      ...cp,
      x: p.x + Math.cos(p.heading) * off,
      z: p.z - Math.sin(p.heading) * off,
      width,
      offset: off,
      span: p.width,
    };
  });
  return level;
}

function stage(level: Level, gate: number, lateral: number): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
  const cp = level.checkpoints[gate];
  const p = trackPointAt(level, cp.s - 25);
  placeRun(state, {
    x: p.x + Math.cos(p.heading) * lateral,
    z: p.z - Math.sin(p.heading) * lateral,
    heading: p.heading,
    speed: 14,
    time: 30,
    nextCheckpoint: gate,
  });
  return state;
}

function ski(state: GameState, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, NEUTRAL_INPUT);
    events.push(...state.events);
  }
  return events;
}

/** A gate down the straight below the slope's bend, where a skier let go
 * runs straight. */
function straightGate(level: Level): number {
  return level.checkpoints.findIndex((cp, k) => k > 0 && cp.z > 620 && cp.z < 900);
}

describe("the slalom gates as skied (R28)", () => {
  it("costs a gate skied past its penalty on the clock, and the run goes on", () => {
    const level = slalomSlope();
    const gate = straightGate(level);
    expect(gate).toBeGreaterThan(0);
    // Down the far side of the line from the gate's panel.
    const off = level.checkpoints[gate].offset ?? 0;
    const state = stage(level, gate, -Math.sign(off) * 2);
    const t0 = state.progress.time;
    const events = ski(state, 3);
    const missed = events.filter((e) => e.kind === "missed");
    expect(missed).toHaveLength(1);
    expect(missed[0]).toMatchObject({ index: gate, penalty: TUNING.course.missPenalty });
    expect(TUNING.course.missPenalty).toBe(3);
    expect(state.progress.penalty).toBe(TUNING.course.missPenalty);
    // On the clock: the run's own time and the penalty on top.
    expect(state.progress.time - t0).toBeCloseTo(3 + TUNING.course.missPenalty, 1);
    // ...and owed no longer: the run goes on to the next gate.
    expect(state.progress.nextCheckpoint).toBe(gate + 1);
    expect(state.progress.missed).toBeNull();
  });

  it("takes a gate skied through, at no cost", () => {
    const level = slalomSlope();
    const gate = straightGate(level);
    const state = stage(level, gate, level.checkpoints[gate].offset ?? 0);
    const events = ski(state, 3);
    expect(events.some((e) => e.kind === "checkpoint" && e.index === gate)).toBe(true);
    expect(events.some((e) => e.kind === "missed")).toBe(false);
    expect(state.progress.penalty).toBe(0);
    expect(state.progress.nextCheckpoint).toBe(gate + 1);
  });

  it("charges nothing for a gate that spans the piste, and points back to it", () => {
    // The synthetic slope's own gates span the piste: one skied beside is
    // flagged for the arrow, never charged.
    const level = syntheticLevel({ noTrees: true, noKicker: true });
    const gate = straightGate(level);
    const cp = level.checkpoints[gate];
    expect(slalom(cp)).toBe(false);
    const state = stage(level, gate, cp.width / 2 + TUNING.course.grace + 6);
    const events = ski(state, 3);
    expect(events.some((e) => e.kind === "missed" && e.index === gate)).toBe(true);
    expect(state.progress.penalty).toBe(0);
    expect(state.progress.missed).toBe(gate);
  });

  it("weaves the gate line through every gate's centre", () => {
    const level = slalomSlope(6);
    const cps = level.checkpoints;
    for (let k = 1; k < cps.length - 1; k++) {
      expect(gateLineAt(level, cps[k].s).offset).toBeCloseTo(cps[k].offset ?? 0, 9);
    }
    // Halfway between two gates set either side it crosses the line, and
    // straightens there; it turns hardest round a gate.
    const a = cps[2];
    const b = cps[3];
    const mid = gateLineAt(level, (a.s + b.s) / 2);
    expect(mid.offset).toBeCloseTo(((a.offset ?? 0) + (b.offset ?? 0)) / 2, 9);
    expect(mid.curvature).toBeLessThan(1e-9);
    expect(gateLineAt(level, a.s + 1).curvature).toBeGreaterThan(mid.curvature);
    // A piste whose gates span it has no weave.
    const plain = syntheticLevel({ noTrees: true, noKicker: true });
    expect(gateLineAt(plain, plain.checkpoints[2].s + 30)).toEqual({
      offset: 0,
      curvature: 0,
      bend: 0,
    });
  });
});
