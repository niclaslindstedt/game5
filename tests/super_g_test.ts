// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUPER-G (R33): the course set from a start lowered into its band —
// its gates turning the racer, each panelled pair red and blue in turn, its
// turning pole inside the line's apex, none on a jump — the rules it is
// raced under (one run, no training), the strict gates on a turning gate,
// the field dealt about par, and the bot down a generated one.
import { describe, expect, it } from "vitest";

import {
  DISCIPLINE_RULES,
  DISCIPLINES,
  JURY,
  LINE_STEP,
  NEUTRAL_INPUT,
  SUPER_G,
  SUPER_G_FIELD,
  TUNING,
  createGame,
  generateLevel,
  nearestTrackPoint,
  placeRun,
  setDownhill,
  setSuperG,
  simulateRun,
  skisById,
  speedLineAt,
  step,
  superGCourseOf,
  superGPar,
  superGStart,
  trackPointAt,
  type GameState,
  type Level,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

const G = DISCIPLINE_RULES.superG;
const BASE = syntheticLevel();
const COURSE = setSuperG(BASE);

/** How far right of the piste's centreline a point stands, m. */
function across(level: Level, x: number, z: number): number {
  const p = trackPointAt(level, nearestTrackPoint(level, x, z).s);
  return (x - p.x) * Math.cos(p.heading) - (z - p.z) * Math.sin(p.heading);
}

/** Ski `seconds` with `input`. */
function ride(state: GameState, seconds: number, input = NEUTRAL_INPUT): void {
  for (let i = 0; i < seconds / TUNING.dt && !state.progress.finished; i++) step(state, input);
}

describe("the super-G course (R33)", () => {
  const sg = COURSE.superG!;
  const gates = COURSE.checkpoints.slice(1, -1);

  it("is set over the piste once: set again, the very same map", () => {
    expect(sg.base).toBe(BASE);
    expect(sg.to).toBe(BASE.track.length);
    expect(setSuperG(BASE)).toBe(COURSE);
    expect(setSuperG(COURSE)).toBe(COURSE);
    // A downhill set over a super-G is set over the map under it.
    expect(setDownhill(COURSE).downhill?.base).toBe(BASE);
    expect(COURSE.downhill).toBeUndefined();
    expect(sg.line[1].s - sg.line[0].s).toBeCloseTo(LINE_STEP, 9);
    expect(G.line.step).toBe(LINE_STEP);
    expect(DISCIPLINE_RULES.downhill.line.step).toBe(LINE_STEP);
  });

  it("starts where the drop to the finish has come down into its band", () => {
    // The synthetic slope is under the band: the piste's own start gate.
    expect(sg.from).toBe(superGStart(BASE));
    expect(sg.vertical).toBeLessThanOrEqual(G.target + 1);
    const level = generateLevel(1, { course: superGCourseOf(generateLevel(1)) ?? undefined });
    const from = superGStart(level);
    const drop = trackPointAt(level, from).y - trackPointAt(level, level.track.length).y;
    expect(from).toBeGreaterThan(level.checkpoints[0].s);
    expect(drop).toBeLessThanOrEqual(G.target + 1);
    expect(drop).toBeGreaterThan(G.vertical.min);
  });

  it("sets as many gates as the vertical's direction changes ask, spaced inside the rule", () => {
    expect(gates.length).toBe(sg.turns);
    expect(gates.length).toBeGreaterThanOrEqual(Math.ceil(G.changes * sg.vertical));
    for (let i = 1; i < gates.length; i++) {
      // The rule's least: 25 m turning pole to turning pole.
      const a = gates[i - 1];
      const b = gates[i];
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(25);
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
      // The line passes `pass` outside the turning pole, toward the outside.
      expect(Math.abs(line - turning)).toBeCloseTo(G.pass, 0);
      expect(Math.abs(line - outside)).toBeLessThan(g.width);
      const half = trackPointAt(COURSE, g.s).width / 2;
      for (const pole of [turning, outside]) {
        expect(Math.abs(pole)).toBeLessThanOrEqual(half - G.inside + 0.5);
      }
    }
  });

  it("keeps every gate off its jumps' lips and landings", () => {
    for (const g of gates) {
      for (const j of sg.jumps) expect(g.s <= j - G.jump || g.s >= j + G.landing - 1e-6).toBe(true);
    }
  });

  it("is raced as one run with no training, under the strict gates", () => {
    const state = createGame({ level: BASE, seed: 3, mode: "superG", quiet: true });
    expect(state.rules).toMatchObject({
      start: "interval",
      gates: "strict",
      countdown: SUPER_G.countdown,
      window: SUPER_G.window,
      technique: "superG",
      jury: JURY.superG,
      contact: false,
    });
    expect(state.level.superG).toBeDefined();
    expect(state.field?.runs).toHaveLength(SUPER_G.field);
    expect(state.field?.training).toBe(false);
    expect(DISCIPLINES.find((d) => d.id === "superG")?.mode).toBe("superG");
  });

  it("disqualifies a racer who passes inside a turning pole", () => {
    const gate = 3;
    const stage = (by: number): GameState => {
      const run = createGame({ level: BASE, seed: 3, mode: "superG", rivals: 0, quiet: true });
      const cp = run.level.checkpoints[gate];
      const fx = Math.sin(cp.heading);
      const fz = Math.cos(cp.heading);
      const rx = Math.cos(cp.heading);
      const rz = -Math.sin(cp.heading);
      placeRun(run, {
        x: cp.x - fx * 3 + rx * by,
        z: cp.z - fz * 3 + rz * by,
        heading: cp.heading,
        speed: 20,
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
    // Two metres inside the turning pole.
    const inside = stage((cp.turn ?? 0) * (cp.width / 2 + 2));
    ride(inside, 0.4);
    expect(inside.progress.out).toEqual({ status: "dsq", why: "missed", gate });
  });

  it("deals its field about par, wider apart and oftener out than a downhill's", () => {
    const race = createGame({ level: BASE, seed: 5, mode: "superG", quiet: true });
    const par = superGPar(race.level, skisById(SUPER_G.skis))!;
    expect(par.time).toBeGreaterThan(0);
    expect(par.trap).toBeGreaterThan(0);
    const F = SUPER_G_FIELD;
    for (const r of race.field!.runs) {
      expect(r.skis).toBe(SUPER_G.skis);
      if (r.out) {
        expect(r.time).toBeNull();
        expect(r.out.why === "fall" || r.out.why === "missed").toBe(true);
        continue;
      }
      expect(r.time!).toBeGreaterThan(par.time * (1 + F.best - F.noise) - 1e-6);
      expect(r.time!).toBeLessThan(par.time * (1 + F.spread + F.noise) + 1e-6);
    }
  });
});

describe("the bot on a super-G", () => {
  it("skis a generated super-G clean, at a super-G's pace", () => {
    const r = simulateRun(1, { mode: "superG", spec: skisById(SUPER_G.skis) });
    expect(r.out).toBeNull();
    expect(r.finished).toBe(true);
    // A super-G's pace: some 80–90 km/h on the mean, past 100 at the top.
    expect(r.meanSpeed * 3.6).toBeGreaterThan(65);
    expect(r.topSpeed * 3.6).toBeGreaterThan(100);
    expect(r.trap).not.toBeNull();
  }, 120_000);
});
