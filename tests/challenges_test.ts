// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// FREE RIDE CHALLENGES (`engine/game/challenges/`): what a map deals — the
// same whichever course its free ride was stood up on — and how a run is
// judged: a timed line's clock between its gates and what voids it, a
// trick goal off its kicker, the hidden spots and the summits found, the
// bot down a dealt line earning a medal, and the judge writing nothing
// into the run it watches.

import { describe, expect, it } from "vitest";
import {
  CHALLENGES,
  createChallengeRun,
  createGame,
  dealChallenges,
  dealtRuns,
  generateLevel,
  isLine,
  isSpots,
  isSummits,
  isTrick,
  loadRealFace,
  medalOf,
  nearestTrackPoint,
  skiLine,
  trackPointAt,
  TUNING,
  type ChallengeEvent,
  type FlightRecord,
  type GameState,
  type Level,
  type LineChallenge,
  type TrickChallenge,
} from "@engine";
import { levelFor } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const SEEDS = [1, 38];

/** The seed's map stood up on another course than its own: a free ride
 * picked on another run. */
function otherCourse(level: Level): Level {
  const r = level.resort!;
  const other =
    r.courses.find((c) => c.id !== r.course && c.grade !== level.grade) ??
    r.courses.find((c) => c.id !== r.course)!;
  return generateLevel(level.seed, {
    course: other.id,
    ...(level.face ? { face: level.face } : { region: level.region }),
  });
}

/** A ski area of one red run down the synthetic slope, one chair to its
 * top and the slope's kicker on it — a judge's bench with no generator. */
function benchLevel(): Level {
  const level = syntheticLevel();
  const pts = level.track.points;
  const head = pts[0];
  const foot = pts[pts.length - 1];
  return {
    ...level,
    resort: {
      runs: [
        {
          id: "1",
          kind: "piste",
          grade: "red",
          points: pts,
          length: level.track.length,
          from: "C1",
          into: null,
          drifts: [],
        },
      ],
      lifts: [{ id: "C1", kind: "chair", bottom: { ...foot }, top: { ...head } }],
      courses: [],
      course: "1",
      village: { ...foot },
    },
  };
}

/** Stand the run's skier at (x, z) a step later, on his skis. */
function moveTo(state: GameState, x: number, z: number): void {
  state.t += TUNING.dt;
  state.tick += 1;
  state.events.length = 0;
  state.skier.x = x;
  state.skier.z = z;
}

/** Walk the skier down `line`'s run from `s0` to `s1` at `v` m/s, judging
 * every step; every event the judge said. */
function walk(
  state: GameState,
  judge: { step(s: GameState): ChallengeEvent[] },
  run: { track: { points: Level["track"]["points"]; length: number } },
  s0: number,
  s1: number,
  v: number,
): ChallengeEvent[] {
  const out: ChallengeEvent[] = [];
  for (let s = s0; s <= s1; s += v * TUNING.dt) {
    const p = trackPointAt(run, s);
    moveTo(state, p.x, p.z);
    out.push(...judge.step(state));
  }
  return out;
}

describe("a map's challenges", () => {
  it("are dealt the same whichever course the free ride was stood up on", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const plan = dealChallenges(level);
      expect(dealChallenges(level)).toBe(plan);
      const again = dealChallenges(otherCourse(level));
      expect(again).not.toBe(plan);
      expect(again.key).toBe(plan.key);
      expect(JSON.stringify(again.challenges)).toBe(JSON.stringify(plan.challenges));
    }
  });

  it("deal lines on its runs, downhill between gates on the run's snow", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const plan = dealChallenges(level);
      const lines = plan.challenges.filter(isLine);
      expect(lines.length).toBeGreaterThanOrEqual(CHALLENGES.line.least);
      expect(lines.length).toBeLessThanOrEqual(CHALLENGES.line.most);
      // Every colour the ski area has among them, up to the count.
      const runs = dealtRuns(level);
      const colours = new Set(runs.map((r) => r.grade));
      expect(new Set(lines.map((l) => l.grade)).size).toBe(Math.min(colours.size, lines.length));
      for (const l of lines) {
        const run = runs.find((r) => r.id === l.run)!;
        expect(l.id).toBe(`line:${l.run}:1`);
        for (const g of [l.start, l.finish]) {
          const hit = nearestTrackPoint(run, g.x, g.z);
          expect(hit.distance).toBeLessThan(1);
          expect(g.width).toBeGreaterThan(5);
          expect(Math.hypot(g.left.x - g.right.x, g.left.z - g.right.z)).toBeCloseTo(g.width, 3);
        }
        expect(l.start.s).toBeGreaterThanOrEqual(CHALLENGES.line.fromHead);
        expect(l.finish.s - l.start.s).toBeGreaterThanOrEqual(CHALLENGES.line.shortest - 1e-6);
        expect(l.finish.s - l.start.s).toBeLessThanOrEqual(CHALLENGES.line.longest + 1e-6);
        expect(l.finish.y).toBeLessThan(l.start.y - CHALLENGES.line.drop + 1e-6);
        expect(l.medals.gold).toBeLessThan(l.medals.silver);
        expect(l.medals.silver).toBeLessThan(l.medals.bronze);
        expect(l.par).toBeGreaterThan(l.length / CHALLENGES.par.most - 1e-6);
      }
    }
  });

  it("deal trick goals on its kickers, spots off its runs and every lift's top", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const plan = dealChallenges(level);
      const ids = plan.challenges.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      const tricks = plan.challenges.filter(isTrick);
      expect(tricks.length).toBeGreaterThanOrEqual(CHALLENGES.trick.least);
      for (const t of tricks) {
        const k = (level.kickers ?? []).find(
          (k) =>
            Math.round(k.x) === Math.round(t.kicker.x) &&
            Math.round(k.z) === Math.round(t.kicker.z),
        );
        expect(k).toBeDefined();
        expect(t.id).toBe(`trick:${Math.round(k!.x)}:${Math.round(k!.z)}`);
      }
      const spots = plan.challenges.find(isSpots)!;
      expect(spots.spots.length).toBeGreaterThanOrEqual(3);
      for (const a of spots.spots) {
        for (const b of spots.spots) {
          if (a !== b)
            expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(CHALLENGES.spots.apart);
        }
        expect(a.x).toBeGreaterThanOrEqual(CHALLENGES.spots.margin);
        expect(a.z).toBeLessThanOrEqual(level.size - CHALLENGES.spots.margin);
        for (const run of level.resort!.runs) {
          const hit = nearestTrackPoint({ track: run }, a.x, a.z);
          expect(hit.distance - run.points[hit.index].width / 2).toBeGreaterThan(
            CHALLENGES.spots.offRun - 1,
          );
        }
      }
      const summits = plan.challenges.find(isSummits)!;
      expect(summits.tops.map((t) => t.lift).sort()).toEqual(
        level.resort!.lifts.map((l) => l.id).sort(),
      );
      expect(summits.medals.gold).toBe(summits.tops.length);
    }
  });

  it("deal on a real face too", async () => {
    expect(await loadRealFace("fell-2")).toBe(true);
    const level = generateLevel(1, { face: "fell-2" });
    const plan = dealChallenges(level);
    expect(plan.key).toBe(`face-fell-2:1:v${level.version}`);
    expect(plan.challenges.filter(isLine).length).toBeGreaterThanOrEqual(CHALLENGES.line.least);
    expect(plan.challenges.some(isSummits)).toBe(true);
    // ...and the same on another course of it.
    expect(JSON.stringify(dealChallenges(otherCourse(level)).challenges)).toBe(
      JSON.stringify(plan.challenges),
    );
  });

  it("deal nothing on a map with no ski area", () => {
    expect(dealChallenges(syntheticLevel()).challenges).toEqual([]);
  });
});

describe("the judge", () => {
  const level = benchLevel();
  const plan = dealChallenges(level);
  const line = plan.challenges.find(isLine) as LineChallenge;
  const run = dealtRuns(level)[0];

  it("deals the bench one line, a trick goal on its kicker and its one summit", () => {
    expect(line).toBeDefined();
    expect(plan.challenges.filter(isTrick)).toHaveLength(1);
    expect(plan.challenges.find(isSummits)?.tops).toHaveLength(1);
  });

  it("clocks a line from its start gate to its finish, with a split half way", () => {
    const state = createGame({ level, countdown: 0, quiet: true });
    const judge = createChallengeRun(level);
    const v = 15;
    const events = walk(state, judge, run, line.start.s - 20, line.finish.s + 5, v);
    const kinds = events.filter((e) => e.id === line.id).map((e) => e.kind);
    expect(kinds).toEqual(["start", "split", "done"]);
    const done = events.find((e) => e.kind === "done")!;
    // The time between the gates at the walk's speed, read to within a step.
    const along = line.finish.s - line.start.s;
    expect(done.value!).toBeCloseTo(along / v, 1);
    expect(done.medal).toBe(medalOf(line, done.value!));
  });

  it("shows a line under way and throws it away on a reset or off its corridor", () => {
    const state = createGame({ level, countdown: 0, quiet: true });
    const judge = createChallengeRun(level);
    walk(state, judge, run, line.start.s - 10, line.start.s + 40, 12);
    const live = judge.live()!;
    expect(live.id).toBe(line.id);
    expect(live.elapsed).toBeGreaterThan(3);
    expect(live.share).toBeGreaterThan(0);
    state.events.push({ kind: "reset", t: state.t, checkpoint: -1, auto: false });
    const out = judge.step(state);
    expect(out).toContainEqual(
      expect.objectContaining({ kind: "void", id: line.id, why: "reset" }),
    );
    expect(judge.live()).toBeNull();
    // Started again, then skied off sideways far past the run's edge.
    walk(state, judge, run, line.start.s - 10, line.start.s + 20, 12);
    const p = trackPointAt(run, line.start.s + 20);
    const said: ChallengeEvent[] = [];
    for (let d = 0; d < p.width / 2 + CHALLENGES.line.corridor + 10; d += 0.2) {
      moveTo(state, p.x + Math.cos(p.heading) * d, p.z - Math.sin(p.heading) * d);
      said.push(...judge.step(state));
    }
    expect(said).toContainEqual(expect.objectContaining({ kind: "void", why: "off" }));
  });

  it("voids a line when the skier is thrown, and never starts one on a lift", () => {
    const state = createGame({ level, countdown: 0, quiet: true });
    const judge = createChallengeRun(level);
    walk(state, judge, run, line.start.s - 10, line.start.s + 20, 12);
    state.skier.thrown = {} as GameState["skier"]["thrown"];
    moveTo(state, state.skier.x, state.skier.z + 0.1);
    expect(judge.step(state)).toContainEqual(
      expect.objectContaining({ kind: "void", why: "fall" }),
    );
    state.skier.thrown = null;
    state.skier.lift = {} as GameState["skier"]["lift"];
    const ridden = walk(state, judge, run, line.start.s - 10, line.start.s + 20, 12);
    expect(ridden.some((e) => e.kind === "start")).toBe(false);
  });

  it("writes nothing into the run it watches", () => {
    const state = createGame({ level, countdown: 0, quiet: true });
    const judge = createChallengeRun(level);
    const p = trackPointAt(run, line.start.s - 1);
    moveTo(state, p.x, p.z);
    const before = JSON.stringify({
      skier: state.skier,
      progress: state.progress,
      tricks: state.tricks,
    });
    const n = state.events.length;
    judge.step(state);
    const q = trackPointAt(run, line.start.s + 1);
    moveTo(state, q.x, q.z);
    const was = JSON.stringify({
      skier: state.skier,
      progress: state.progress,
      tricks: state.tricks,
    });
    expect(judge.step(state).map((e) => e.kind)).toEqual(["start"]);
    expect(
      JSON.stringify({ skier: state.skier, progress: state.progress, tricks: state.tricks }),
    ).toBe(was);
    expect(before).not.toBe(was);
    expect(state.events.length).toBe(n);
  });

  it("reads a trick off its kicker by the flights the run files", () => {
    const trick = plan.challenges.find(isTrick) as TrickChallenge;
    const state = createGame({ level, countdown: 0, quiet: true });
    const judge = createChallengeRun(level);
    judge.step(state);
    const flight = (
      spin: number,
      grab: boolean,
      outcome: FlightRecord["outcome"],
      dx = 0,
    ): FlightRecord => ({
      flight: 1,
      flip: 0,
      spin,
      grabs: grab ? ["mute"] : [],
      air: 1,
      length: 12,
      height: 1,
      switchIn: false,
      switchOut: false,
      landing: 1,
      outcome,
      t: state.t,
      x: trick.kicker.x + dx,
      z: trick.kicker.z,
    });
    const said = (f: FlightRecord) => {
      state.tricks.flights.push(f);
      moveTo(state, state.skier.x, state.skier.z);
      return judge.step(state).filter((e) => e.id === trick.id);
    };
    expect(said(flight(0, false, "landed"))).toEqual([
      expect.objectContaining({ kind: "done", value: 1, medal: "bronze" }),
    ]);
    expect(said(flight(0, false, "sketchy"))).toEqual([]);
    expect(said(flight(0, false, "landed", 60))).toEqual([]);
    const g = trick.goals.gold;
    const gold = flight(((g.spin || 0) * Math.PI) / 180, g.grab, "landed");
    gold.flip = g.flips * 2 * Math.PI;
    expect(said(gold)).toEqual([expect.objectContaining({ value: 3, medal: "gold" })]);
  });

  it("counts every summit stood off once, with what the book knew", () => {
    const state = createGame({ level, countdown: 0, quiet: true });
    const judge = createChallengeRun(level);
    const off = () => {
      moveTo(state, state.skier.x, state.skier.z);
      state.events.push({ kind: "lift", t: state.t, id: "C1", lift: "chair", phase: "off" });
      return judge.step(state).filter((e) => e.id === "summits");
    };
    expect(off()).toEqual([
      expect.objectContaining({ kind: "found", what: "C1", value: 1, medal: "gold" }),
    ]);
    expect(off()).toEqual([]);
    const known = createChallengeRun(level, { found: { summits: ["C1"] } });
    state.events.push({ kind: "lift", t: state.t, id: "C1", lift: "chair", phase: "off" });
    expect(known.step(state)).toEqual([]);
  });
});

describe("the bot down a dealt line", () => {
  it("finishes it and earns a medal", () => {
    const level = levelFor(1);
    const lines = dealChallenges(level).challenges.filter(isLine);
    const red = lines.find((l) => l.grade === "blue") ?? lines[0];
    const skied = skiLine(level, red);
    expect(skied.why).toBeNull();
    expect(skied.time).not.toBeNull();
    expect(skied.medal).not.toBeNull();
  });
});
