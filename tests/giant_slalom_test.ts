// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GIANT SLALOM (R36): the course set from a start lowered into its band
// — a gate every twenty-odd metres, each panelled pair red and blue in turn,
// its turning pole inside the line's apex, none on a jump, the line held off
// a lift's towers — its two runs on the same stretch with the second's gates
// dealt afresh, the rules it is raced under, the strict gates on a turning
// gate, the field dealt about par and its second run started in reverse, and
// the bot down a generated one.
import { describe, expect, it } from "vitest";

import {
  DISCIPLINE_RULES,
  DISCIPLINES,
  GIANT_SLALOM,
  GIANT_SLALOM_FIELD,
  JURY,
  NEUTRAL_INPUT,
  RACE_RIDERS,
  RACE_SKIS,
  TUNING,
  createGame,
  generateLevel,
  giantSlalomCourseOf,
  giantSlalomPar,
  giantSlalomStart,
  liftPlans,
  nearestTrackPoint,
  placeRun,
  raceCourseOf,
  setGiantSlalom,
  setSuperG,
  simulateRun,
  skisById,
  speedCourseOf,
  speedLineAt,
  step,
  superGCourseOf,
  trackPointAt,
  type GameState,
  type Level,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

const G = DISCIPLINE_RULES.giantSlalom;
const BASE = syntheticLevel();
const COURSE = setGiantSlalom(BASE);

/** How far right of the piste's centreline a point stands, m. */
function across(level: Level, x: number, z: number): number {
  const p = trackPointAt(level, nearestTrackPoint(level, x, z).s);
  return (x - p.x) * Math.cos(p.heading) - (z - p.z) * Math.sin(p.heading);
}

/** Ski `seconds` with `input`. */
function ride(state: GameState, seconds: number, input = NEUTRAL_INPUT): void {
  for (let i = 0; i < seconds / TUNING.dt && !state.progress.finished; i++) step(state, input);
}

describe("the giant slalom course (R36)", () => {
  const gs = COURSE.giantSlalom!;
  const gates = COURSE.checkpoints.slice(1, -1);

  it("is set over the piste once a run: set again, the very same map", () => {
    expect(gs.base).toBe(BASE);
    expect(gs.run).toBe(1);
    expect(gs.to).toBe(BASE.track.length);
    expect(setGiantSlalom(BASE)).toBe(COURSE);
    expect(setGiantSlalom(COURSE)).toBe(COURSE);
    // A super-G set over a giant slalom is set over the map under it.
    expect(setSuperG(COURSE).superG?.base).toBe(BASE);
    expect(COURSE.superG).toBeUndefined();
    // The course every race reader asks after, and the line the bot rides.
    expect(raceCourseOf(COURSE)).toBe(gs);
    expect(speedCourseOf(COURSE)).toBe(gs);
    expect(gs.trap).toBeUndefined();
  });

  it("sets its second run on the same stretch, its gates dealt afresh", () => {
    const second = setGiantSlalom(BASE, 2);
    expect(second.giantSlalom?.run).toBe(2);
    expect(second.giantSlalom?.base).toBe(BASE);
    expect(setGiantSlalom(COURSE, 2)).toBe(second);
    expect(setGiantSlalom(second, 1)).toBe(COURSE);
    expect(second.giantSlalom?.from).toBe(gs.from);
    expect(second.giantSlalom?.to).toBe(gs.to);
    const one = gates.map((g) => `${g.s.toFixed(1)}:${g.turn}`).join(" ");
    const two = second.checkpoints
      .slice(1, -1)
      .map((g) => `${g.s.toFixed(1)}:${g.turn}`)
      .join(" ");
    expect(two).not.toBe(one);
  });

  it("starts where the drop to the finish has come down into its band", () => {
    expect(gs.from).toBe(giantSlalomStart(BASE));
    expect(gs.vertical).toBeLessThanOrEqual(G.target + 1);
    const plain = generateLevel(1);
    expect(giantSlalomCourseOf(plain)).toBe(superGCourseOf(plain));
    const level = generateLevel(1, { course: giantSlalomCourseOf(plain) ?? undefined });
    const from = giantSlalomStart(level);
    const drop = trackPointAt(level, from).y - trackPointAt(level, level.track.length).y;
    expect(from).toBeGreaterThan(level.checkpoints[0].s);
    expect(drop).toBeLessThanOrEqual(G.target + 1);
    expect(drop).toBeGreaterThan(G.vertical.min);
  });

  it("sets as many gates as the vertical's direction changes ask, spaced inside the rule", () => {
    expect(gates.length).toBe(gs.turns);
    expect(gates.length).toBeGreaterThanOrEqual(Math.ceil(G.changes * gs.vertical));
    for (let i = 1; i < gates.length; i++) {
      const a = gates[i - 1];
      const b = gates[i];
      // The rule's least: 10 m turning pole to turning pole.
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(10);
      expect(b.s - a.s).toBeGreaterThanOrEqual(G.spacing.min - 1e-6);
    }
  });

  it("panels every gate, red and blue in turn, turning to either side in turn", () => {
    gates.forEach((g, i) => {
      expect(g.panels).toBe(true);
      expect(g.width).toBe(G.width);
      expect(g.colour).toBe(i % 2 === 0 ? "red" : "blue");
      if (i > 0) expect(g.turn).toBe(-(gates[i - 1].turn ?? 0));
    });
  });

  it("stands each turning pole inside the line's apex, every pole on the snow", () => {
    for (const g of gates) {
      const centre = across(COURSE, g.x, g.z);
      const turning = centre + (g.turn ?? 0) * (g.width / 2);
      const outside = centre - (g.turn ?? 0) * (g.width / 2);
      const line = speedLineAt(COURSE, g.s)!.offset;
      expect(Math.abs(line - turning)).toBeCloseTo(G.pass, 0);
      expect(Math.abs(line - outside)).toBeLessThanOrEqual(g.width);
      const half = trackPointAt(COURSE, g.s).width / 2;
      for (const pole of [turning, outside]) {
        expect(Math.abs(pole)).toBeLessThanOrEqual(half - G.inside + 0.5);
      }
    }
  });

  it("keeps every gate off its jumps' lips and landings", () => {
    for (const g of gates) {
      for (const j of gs.jumps) expect(g.s <= j - G.jump || g.s >= j + G.landing - 1e-6).toBe(true);
    }
  });

  it("holds its line off a lift tower standing on the piste", () => {
    // Seed 17's course runs past a tower left on the piste — the rare one a
    // line running down a run too far to span stands there, padded.
    const raced = createGame({ seed: 17, mode: "giantSlalom", rivals: 0, quiet: true }).level;
    const course = raced.giantSlalom!;
    let checked = 0;
    for (const plan of liftPlans(raced)) {
      for (const post of plan.supports) {
        const hit = nearestTrackPoint(raced, post.x, post.z);
        if (hit.s < course.from || hit.s > course.to) continue;
        if (Math.abs(hit.lateral) > trackPointAt(raced, hit.s).width / 2) continue;
        checked += 1;
        const line = speedLineAt(raced, hit.s)!.offset;
        expect(Math.abs(line - hit.lateral)).toBeGreaterThan(G.towers.clear - 0.5);
      }
    }
    expect(checked).toBeGreaterThan(0);
  }, 60_000);

  it("is raced as two runs under the strict gates, on its own pair and build", () => {
    const state = createGame({ level: BASE, seed: 3, mode: "giantSlalom", quiet: true });
    expect(state.rules).toMatchObject({
      start: "interval",
      gates: "strict",
      countdown: GIANT_SLALOM.countdown,
      window: GIANT_SLALOM.window,
      technique: "giantSlalom",
      jury: JURY.giantSlalom,
      contact: false,
    });
    expect(GIANT_SLALOM.runs).toBe(2);
    expect(state.level.giantSlalom?.run).toBe(1);
    expect(state.field?.run).toBe(1);
    expect(state.field?.runs).toHaveLength(GIANT_SLALOM.field);
    expect(state.field?.training).toBe(false);
    expect(DISCIPLINES.find((d) => d.id === "giantSlalom")?.mode).toBe("giantSlalom");
    expect(RACE_SKIS.giantSlalom).toBe(GIANT_SLALOM.skis);
    expect(RACE_RIDERS.giantSlalom).toBe("solid");
  });

  it("disqualifies a racer who passes inside a turning pole", () => {
    const gate = 3;
    const stage = (by: number): GameState => {
      const run = createGame({ level: BASE, seed: 3, mode: "giantSlalom", rivals: 0, quiet: true });
      const cp = run.level.checkpoints[gate];
      const fx = Math.sin(cp.heading);
      const fz = Math.cos(cp.heading);
      const rx = Math.cos(cp.heading);
      const rz = -Math.sin(cp.heading);
      placeRun(run, {
        x: cp.x - fx * 3 + rx * by,
        z: cp.z - fz * 3 + rz * by,
        heading: cp.heading,
        speed: 18,
        time: 10,
        nextCheckpoint: gate,
      });
      return run;
    };
    const cp = COURSE.checkpoints[gate];
    const through = stage(0);
    ride(through, 0.4);
    expect(through.progress.out).toBeNull();
    expect(through.progress.nextCheckpoint).toBe(gate + 1);
    const inside = stage((cp.turn ?? 0) * (cp.width / 2 + 2));
    ride(inside, 0.4);
    expect(inside.progress.out).toEqual({ status: "dsq", why: "missed", gate });
  });

  it("deals its field about par, and starts its second run's best thirty in reverse", () => {
    const race = createGame({ level: BASE, seed: 5, mode: "giantSlalom", quiet: true });
    const par = giantSlalomPar(race.level, skisById(GIANT_SLALOM.skis))!;
    expect(par.time).toBeGreaterThan(0);
    const F = GIANT_SLALOM_FIELD;
    for (const r of race.field!.runs) {
      expect(r.skis).toBe(GIANT_SLALOM.skis);
      if (r.out) {
        expect(r.time).toBeNull();
        continue;
      }
      expect(r.time!).toBeGreaterThan(par.time * (1 + F.best - F.noise) - 1e-6);
      expect(r.time!).toBeLessThan(par.time * (1 + F.spread + F.noise) + 1e-6);
    }
    const second = createGame({
      level: race.level,
      seed: 5,
      mode: "giantSlalom",
      heat: { run: 2, player: par.time, field: race.field!.runs },
      quiet: true,
    });
    expect(second.level.giantSlalom?.run).toBe(2);
    expect(second.field?.run).toBe(2);
    const home = race.field!.runs.filter((r) => r.time !== null).sort((a, b) => a.time! - b.time!);
    const leader = home[0];
    const order = second.field!.runs.map((r) => r.id);
    // The first run's leader starts last of the best thirty.
    expect(order.indexOf(leader.id)).toBe(Math.min(GIANT_SLALOM.qualify, home.length) - 1);
  });
});

describe("the bot on a giant slalom", () => {
  it("skis a generated giant slalom clean, at a giant slalom's pace", () => {
    const r = simulateRun(2, { mode: "giantSlalom", spec: skisById(GIANT_SLALOM.skis) });
    expect(r.out).toBeNull();
    expect(r.finished).toBe(true);
    // Some 65–75 km/h on the mean.
    expect(r.meanSpeed * 3.6).toBeGreaterThan(55);
    expect(r.meanSpeed * 3.6).toBeLessThan(90);
    expect(r.trap).toBeNull();
  }, 120_000);
});
