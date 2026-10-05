// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL (R32): the course set over a map's whole piste — its racing
// line and the speed gates that mark it, the jumps shaved, the A-nets, the
// speed trap — the rules it is raced under, the strict gates on a speed
// gate, the nets that catch a racer, the trap that takes his speed, and
// the field and its training run dealt about par.
import { describe, expect, it } from "vitest";

import {
  DISCIPLINE_RULES,
  DOWNHILL,
  DOWNHILL_FIELD,
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  downhillCourseOf,
  downhillLineAt,
  downhillPar,
  nearestTrackPoint,
  placeRun,
  setDownhill,
  simulateRun,
  skisById,
  step,
  trackPointAt,
  type GameEvent,
  type GameState,
  type Level,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

const D = DISCIPLINE_RULES.downhill;
const BASE = syntheticLevel();
const COURSE = setDownhill(BASE);

/** How far right of the piste's centreline a point stands, m. */
function across(level: Level, x: number, z: number): number {
  const p = trackPointAt(level, nearestTrackPoint(level, x, z).s);
  return (x - p.x) * Math.cos(p.heading) - (z - p.z) * Math.sin(p.heading);
}

/** Ski `seconds` with `input`, the events kept. */
function ride(state: GameState, seconds: number, input = NEUTRAL_INPUT): GameEvent[] {
  const seen: GameEvent[] = [];
  for (let i = 0; i < seconds / TUNING.dt && !state.progress.finished; i++) {
    step(state, input);
    seen.push(...state.events);
  }
  return seen;
}

describe("the downhill course (R32)", () => {
  const dh = COURSE.downhill!;
  const gates = COURSE.checkpoints.slice(1, -1);

  it("is set over the whole piste, once: set again, the very same map", () => {
    expect(dh.base).toBe(BASE);
    expect(dh.from).toBe(BASE.checkpoints[0].s);
    expect(dh.to).toBe(BASE.track.length);
    expect(setDownhill(BASE)).toBe(COURSE);
    expect(setDownhill(COURSE)).toBe(COURSE);
  });

  it("marks its racing line with speed gates — red, ten metres, on the line, inside the piste", () => {
    expect(gates.length).toBeGreaterThan(2);
    for (const g of gates) {
      expect(g.panels).toBe(true);
      expect(g.pole).toBeUndefined();
      expect(g.colour).toBe("red");
      expect(g.width).toBe(D.width);
      expect(g.width).toBeGreaterThanOrEqual(8);
      const line = downhillLineAt(COURSE, g.s)!.offset;
      expect(g.offset).toBeCloseTo(line, 6);
      const half = trackPointAt(COURSE, g.s).width / 2;
      // Both inner poles inside the piste, at a pole's room from its edge
      // where the piste is wide enough to have one.
      expect(Math.abs(across(COURSE, g.x, g.z)) + g.width / 2).toBeLessThanOrEqual(
        Math.max(half - D.inside, g.width / 2) + 1e-6,
      );
    }
  });

  it("spaces its gates down the piste as a downhill's are", () => {
    const arcs = COURSE.checkpoints.map((c) => c.s);
    for (let i = 1; i < arcs.length - 1; i++) {
      expect(arcs[i] - arcs[i - 1]).toBeGreaterThanOrEqual(D.spacing.min - 1e-6);
      expect(arcs[i] - arcs[i - 1]).toBeLessThanOrEqual(D.spacing.max + 1e-6);
    }
  });

  it("lays a racing line that bends less than the piste and keeps a gate's room inside it", () => {
    let pisteBend = 0;
    let lineBend = 0;
    for (let s = dh.from + 10; s < dh.to - 10; s += 4) {
      const a = trackPointAt(COURSE, s - 8);
      const b = trackPointAt(COURSE, s + 8);
      pisteBend += Math.abs(b.heading - a.heading) / 16;
      lineBend += Math.abs(downhillLineAt(COURSE, s)!.bend);
      const half = trackPointAt(COURSE, s).width / 2;
      expect(Math.abs(downhillLineAt(COURSE, s)!.offset)).toBeLessThanOrEqual(
        Math.max(0, half - D.line.margin) + 1e-6,
      );
    }
    expect(lineBend).toBeLessThan(pisteBend);
  });

  it("levels the piste's kickers and shaves its crests round", () => {
    expect((COURSE.kickers ?? []).filter((k) => k.onTrack)).toHaveLength(0);
    const pts = COURSE.track.points.filter((p) => p.s > dh.from + 4 && p.s < dh.to - 4);
    for (let i = 1; i < pts.length - 1; i++) {
      const h = (pts[i + 1].s - pts[i - 1].s) / 2;
      const bend = (pts[i - 1].y - 2 * pts[i].y + pts[i + 1].y) / (h * h);
      expect(bend).toBeGreaterThanOrEqual(-1 / D.crest - 1e-3);
    }
  });

  it("strings A-nets along both edges and stands its speed trap late on the course", () => {
    expect(dh.nets.gap).toBe(D.nets.gap);
    expect(dh.nets.from).toBeLessThan(dh.from);
    expect(dh.trap.s).toBeGreaterThanOrEqual(dh.from + (dh.to - dh.from) * D.trap.late - 1e-6);
    expect(dh.trap.s).toBeLessThanOrEqual(dh.to - D.trap.end + 1e-6);
  });

  it("stands the start house over the start gate", () => {
    const hut = nearestTrackPoint(COURSE, COURSE.spawn.x, COURSE.spawn.z);
    expect(hut.s).toBeCloseTo(dh.from - D.stand, 1);
    expect(COURSE.grid).toEqual([COURSE.spawn]);
  });
});

describe("the downhill as a run", () => {
  it("is raced under its own rules: an interval start, strict gates, the downhill technique", () => {
    const state = createGame({ level: BASE, seed: 3, mode: "downhill", quiet: true });
    expect(state.level.downhill).toBeDefined();
    expect(state.rules).toMatchObject({
      rivals: DOWNHILL.field,
      countdown: DOWNHILL.countdown,
      start: "interval",
      gates: "strict",
      window: DOWNHILL.window,
      technique: "downhill",
      contact: false,
    });
    expect(state.field?.runs).toHaveLength(DOWNHILL.field);
  });

  it("picks the ski area's course with the most vertical", () => {
    const level = {
      ...BASE,
      resort: {
        courses: [
          { id: "a", grade: "red", runs: [], length: 2000, drop: 600 },
          { id: "b", grade: "black", runs: [], length: 3000, drop: 1000 },
          { id: "c", grade: "black", runs: [], length: 3500, drop: 1300 },
        ],
      },
    } as unknown as Level;
    // The most vertical inside the rule's band first.
    expect(downhillCourseOf(level)).toBe("b");
    expect(downhillCourseOf(BASE)).toBeNull();
  });

  it("disqualifies a speed gate missed — a foot outside its inner poles", () => {
    const state = createGame({ level: BASE, seed: 3, mode: "downhill", rivals: 0, quiet: true });
    const gate = 1;
    const cp = state.level.checkpoints[gate];
    const fx = Math.sin(cp.heading);
    const fz = Math.cos(cp.heading);
    const rx = Math.cos(cp.heading);
    const rz = -Math.sin(cp.heading);
    const stage = (by: number): GameState => {
      const run = createGame({ level: BASE, seed: 3, mode: "downhill", rivals: 0, quiet: true });
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
    const through = stage(0);
    ride(through, 0.4);
    expect(through.progress.out).toBeNull();
    expect(through.progress.nextCheckpoint).toBe(gate + 1);
    const wide = stage(cp.width / 2 + 2);
    ride(wide, 0.4);
    expect(wide.progress.out).toEqual({ status: "dsq", why: "missed", gate });
    expect(state.progress.out).toBeNull();
  });

  it("catches a racer driven into the A-nets, and puts him out", () => {
    const state = createGame({ level: BASE, seed: 3, mode: "downhill", rivals: 0, quiet: true });
    const dh = state.level.downhill!;
    const s = (dh.from + dh.to) / 2;
    const p = trackPointAt(state.level, s);
    const net = p.width / 2 + dh.nets.gap;
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    // Just inside the net on the right, skiing hard right into it.
    placeRun(state, {
      x: p.x + rx * (net - 0.5),
      z: p.z + rz * (net - 0.5),
      heading: p.heading + 1.2,
      speed: 25,
      time: 30,
      nextCheckpoint: state.level.checkpoints.findIndex((c) => c.s > s),
    });
    const seen = ride(state, 1);
    expect(seen.some((e) => e.kind === "net")).toBe(true);
    expect(state.progress.out?.why).toBe("net");
    expect(state.progress.out?.status).toBe("dnf");
    // Held on the net, never through it.
    const at = nearestTrackPoint(state.level, state.skier.x, state.skier.z);
    const half = (state.level.track.points[at.index]?.width ?? 0) / 2;
    expect(at.distance).toBeLessThanOrEqual(half + dh.nets.gap + 0.05);
  });

  it("takes a racer's speed through the trap, once", () => {
    const state = createGame({ level: BASE, seed: 3, mode: "downhill", rivals: 0, quiet: true });
    const trap = state.level.downhill!.trap;
    placeRun(state, {
      x: trap.x - Math.sin(trap.heading) * 4,
      z: trap.z - Math.cos(trap.heading) * 4,
      heading: trap.heading,
      speed: 30,
      time: 60,
      nextCheckpoint: state.level.checkpoints.findIndex((c) => c.s > trap.s),
    });
    state.progress.started = true;
    const seen = ride(state, 0.5);
    const taken = seen.filter((e) => e.kind === "trap");
    expect(taken).toHaveLength(1);
    expect(state.progress.trap).toBeGreaterThan(25);
    expect(taken[0].kind === "trap" && taken[0].speed).toBe(state.progress.trap);
  });
});

describe("the downhill's field", () => {
  const race = createGame({ level: BASE, seed: 5, mode: "downhill", quiet: true });
  const training = createGame({
    level: BASE,
    seed: 5,
    mode: "downhill",
    training: true,
    quiet: true,
  });
  const par = downhillPar(race.level, skisById(DOWNHILL.skis))!;

  it("is dealt about par on the downhill pair, tight as a speed event's, its trap speeds about par's", () => {
    expect(race.field?.training).toBe(false);
    expect(par.trap).toBeGreaterThan(0);
    const F = DOWNHILL_FIELD;
    for (const r of race.field!.runs) {
      expect(r.skis).toBe(DOWNHILL.skis);
      if (r.out) {
        expect(r.time).toBeNull();
        expect(r.out.why === "fall" || r.out.why === "missed").toBe(true);
        continue;
      }
      expect(r.time!).toBeGreaterThan(par.time * (1 + F.best - F.noise) - 1e-6);
      expect(r.time!).toBeLessThan(par.time * (1 + F.spread + F.noise) + 1e-6);
      expect(r.trap!).toBeGreaterThan(par.trap * (1 - F.trap.spread - F.trap.noise) - 1e-6);
      expect(r.trap!).toBeLessThan(par.trap * (1 + F.trap.noise) + 1e-6);
    }
  });

  it("deals a training run slower, and counts it for nothing", () => {
    expect(training.field?.training).toBe(true);
    const mean = (g: GameState): number => {
      const home = g.field!.runs.filter((r) => r.time !== null);
      return home.reduce((a, r) => a + r.time!, 0) / home.length;
    };
    expect(mean(training)).toBeGreaterThan(mean(race));
    for (const r of training.field!.runs) if (r.out) expect(r.out.why).toBe("fall");
  });
});

describe("the bot on a downhill", () => {
  it("skis a generated downhill clean, at a downhill's pace", () => {
    const r = simulateRun(1, { mode: "downhill", spec: skisById(DOWNHILL.skis) });
    expect(r.out).toBeNull();
    expect(r.finished).toBe(true);
    // A downhill's pace: some 80–100 km/h on the mean, past 120 at the top.
    expect(r.meanSpeed * 3.6).toBeGreaterThan(70);
    expect(r.topSpeed * 3.6).toBeGreaterThan(120);
    expect(r.trap).not.toBeNull();
  }, 120_000);
});
