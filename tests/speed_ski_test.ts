// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SPEED SKIING (R34): the straight track cut down a generated face — its
// graded profile, its zones, its margin and its two runs' starts — the
// rules it is raced under (a qualification and a final, the clock through
// the timing zone alone, read finer than a step), the speed pair and the
// setter's point mass held to each other, the field dealt about par and
// its final ranked alone, the jury's anemometer at the zone, and the bot
// down both runs and stopped on the run-out.
import { describe, expect, it } from "vitest";

import {
  DISCIPLINES,
  DISCIPLINE_RULES,
  JURY,
  PEREGRINE,
  SPEED_SKI,
  SPEED_SKI_FIELD,
  TUNING,
  botInput,
  createGame,
  fieldPlace,
  levelDigest,
  raceParOf,
  setSpeedSki,
  speedSkiAim,
  speedSkiLines,
  startGustOf,
  step,
  totalMass,
  type GameState,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const K = DISCIPLINE_RULES.speedSki;
const SEED = 38;
const BASE = levelFor(SEED);
const QUALIFY = setSpeedSki(BASE, 1);
const FINAL = setSpeedSki(BASE, 2);

/** The bot down `state` to the zone's bottom line, then on until stopped. */
function race(state: GameState, past = false): GameState {
  for (let i = 0; i < 120 * TUNING.physicsHz; i++) {
    step(state, botInput(state));
    if (state.progress.finished && (!past || state.skier.speed < 0.5)) break;
  }
  return state;
}

describe("the speed track (R34)", () => {
  const sk = FINAL.speedSki!;
  const pts = FINAL.track.points;

  it("is a straight track of its own, the map's piste not skied", () => {
    expect(pts[0].heading).toBe(pts[pts.length - 1].heading);
    for (const p of pts) {
      expect(p.heading).toBe(pts[0].heading);
      expect(p.width).toBe(K.width);
    }
    expect(Math.abs(pts[0].heading)).toBeLessThanOrEqual(Math.PI / 6);
    // The piste's kickers and drops are on no track a racer skis.
    for (const k of FINAL.kickers ?? []) expect(k.onTrack).toBe(false);
    for (const c of FINAL.cliffs ?? []) expect(c.onTrack).toBe(false);
  });

  it("is graded down the fall line: never rising, its crests and knees rounded", () => {
    const h = pts[1].s - pts[0].s;
    for (let i = 1; i < pts.length; i++) expect(pts[i].y).toBeLessThanOrEqual(pts[i - 1].y + 1e-6);
    // Read over 8 m (the profile is a cubic through 4 m samples).
    const w = Math.round(8 / h);
    for (let i = w; i < pts.length - w; i++) {
      const bend = (pts[i - w].y - 2 * pts[i].y + pts[i + w].y) / (w * h) ** 2;
      expect(bend, `crest at ${pts[i].s}`).toBeGreaterThan(-1.15 / K.crest);
      expect(bend, `knee at ${pts[i].s}`).toBeLessThan(1.15 / K.knee);
    }
    // The ground under the track is the profile.
    for (const p of pts) expect(Math.abs(FINAL.groundAt(p.x, p.z) - p.y)).toBeLessThan(0.3);
  });

  it("launches, times 100 m along the snow, and runs out to its finish enclosure", () => {
    expect(sk.zone.length).toBeCloseTo(K.trap, 1);
    const launch = (a: number, b: number): number => {
      let along = 0;
      for (const p of pts) {
        const i = pts.indexOf(p);
        if (i === 0 || p.s <= a || p.s > b) continue;
        along += Math.hypot(p.s - pts[i - 1].s, p.y - pts[i - 1].y);
      }
      return along;
    };
    expect(K.launch).toContain(Math.round(launch(sk.top, sk.zone.from) / 100) * 100);
    expect(sk.stop).toBeGreaterThan(sk.zone.to + K.runOut.brake);
    expect(sk.stop).toBeLessThan(FINAL.track.length);
    const lines = speedSkiLines(FINAL)!;
    expect(lines.braking.s).toBeCloseTo(sk.zone.to + K.runOut.brake, 6);
    expect(lines.finish.s).toBe(sk.stop);
  });

  it("aims its final at the top class's band, its qualification some 12 km/h under it", () => {
    const final = speedSkiAim(FINAL);
    expect(final).toBeGreaterThanOrEqual(K.speed.min);
    expect(final).toBeLessThanOrEqual(K.speed.max);
    const qualify = speedSkiAim(QUALIFY);
    expect(final - qualify).toBeGreaterThan(K.qualify - 2);
    expect(final - qualify).toBeLessThan(15);
    expect(QUALIFY.speedSki!.from).toBeGreaterThan(sk.from);
  });

  it("clears its safety margin of every trunk, and is set over the map without moving it", () => {
    const fx = Math.sin(pts[0].heading);
    const fz = Math.cos(pts[0].heading);
    for (const t of FINAL.trees) {
      const along = (t.x - pts[0].x) * fx + (t.z - pts[0].z) * fz;
      const across = Math.abs((t.x - pts[0].x) * fz - (t.z - pts[0].z) * fx);
      if (along > 0 && along < FINAL.track.length) {
        expect(across).toBeGreaterThan(K.width / 2 + K.margin);
      }
    }
    // A pure function of the map: the same track again, the map untouched.
    expect(setSpeedSki(BASE, 2)).toBe(FINAL);
    expect(levelDigest(BASE)).toBe(levelDigest(levelFor(SEED)));
    expect(sk.base).toBe(BASE);
  });

  it("is the start gate and the timing zone's two lines, across the track and its margin", () => {
    const cps = FINAL.checkpoints;
    expect(cps).toHaveLength(3);
    expect(cps[0].s).toBe(sk.from);
    expect(cps[1].s).toBeCloseTo(sk.zone.from, 6);
    expect(cps[2].s).toBeCloseTo(sk.zone.to, 6);
    expect(cps[1].width).toBe(K.width + 2 * K.margin);
  });

  it("sizes its run-out on the speed pair's own numbers", () => {
    // The point mass the setter skis is the pair's medium rider in his kit.
    expect(K.stop.mass).toBe(totalMass(PEREGRINE));
    expect(K.stop.tuck).toBe(PEREGRINE.cdATuck);
    expect(K.stop.stood).toBe(PEREGRINE.cdAUpright);
    expect(K.stop.friction).toBe(TUNING.snow.crrPacked);
    expect(K.stop.air).toBe(TUNING.airDensity);
  });
});

describe("speed skiing as a mode", () => {
  it("is a built discipline: two runs, an interval start, the strict gates, its jury", () => {
    expect(DISCIPLINES.find((d) => d.id === "speedSki")?.mode).toBe("speedSki");
    const state = createGame({ seed: SEED, level: BASE, mode: "speedSki", quiet: true });
    expect(state.level.speedSki?.run).toBe(1);
    expect(state.rules.start).toBe("interval");
    expect(state.rules.gates).toBe("strict");
    expect(state.rules.technique).toBe("speedSki");
    expect(state.rules.jury).toBe(JURY.speedSki);
    expect(state.rules.window).toBe(SPEED_SKI.window);
    expect(state.field?.runs).toHaveLength(SPEED_SKI.field);
    // The jury's anemometer stands at the top of the timing zone.
    expect(startGustOf(state.level)).toBeLessThanOrEqual(JURY.speedSki.wind + 1e-9);
  });

  it("times the zone alone, read finer than the step, and its speed is the zone over that time", () => {
    const state = race(
      createGame({ seed: SEED, level: BASE, mode: "speedSki", spec: PEREGRINE, quiet: true }),
    );
    const p = state.progress;
    expect(p.out).toBeNull();
    expect(p.finished).toBe(true);
    expect(p.trap).not.toBeNull();
    expect(p.trap! * p.time).toBeCloseTo(state.level.speedSki!.zone.length, 6);
    // Under two seconds through 100 m — 180 km/h and more — and not a whole
    // number of steps.
    expect(p.time).toBeLessThan(2);
    expect((p.time / TUNING.dt) % 1).not.toBeCloseTo(0, 3);
    // Near par, as the field is dealt about it.
    const par = raceParOf(state.level)!;
    expect(p.trap! / par.trap).toBeGreaterThan(0.96);
    expect(p.trap! / par.trap).toBeLessThan(1.04);
  });

  it("stops the racer home on the run-out, stood up and skidding past the braking line", () => {
    const state = race(
      createGame({ seed: SEED, level: BASE, mode: "speedSki", spec: PEREGRINE, quiet: true }),
      true,
    );
    expect(state.skier.thrown).toBeNull();
    expect(state.skier.speed).toBeLessThan(0.5);
    const head = state.level.track.points[0];
    const along =
      (state.skier.x - head.x) * Math.sin(head.heading) +
      (state.skier.z - head.z) * Math.cos(head.heading);
    expect(along).toBeGreaterThan(state.level.speedSki!.zone.to + K.runOut.brake);
    expect(along).toBeLessThan(state.level.track.length);
  });

  it("races its final from the top for the qualification's best, ranked on the final alone", () => {
    const first = createGame({ seed: SEED, level: BASE, mode: "speedSki", quiet: true });
    const heat = { run: 2 as const, player: 1, field: first.field!.runs };
    const final = createGame({ seed: SEED, level: BASE, mode: "speedSki", quiet: true, heat });
    expect(final.level.speedSki?.run).toBe(2);
    expect(final.level.speedSki?.from).toBe(final.level.speedSki?.top);
    const f = final.field!;
    expect(f.runs.length).toBe(SPEED_SKI.qualify - 1);
    // In increasing order of their qualifying speed — the fastest last.
    const before = f.runs.map((r) => r.before);
    for (let i = 1; i < before.length; i++) expect(before[i]).toBeLessThanOrEqual(before[i - 1]);
    // The final alone: a run a hair under everyone's is first, whatever he
    // qualified at.
    final.progress.time = Math.min(...f.runs.map((r) => r.time ?? Infinity)) - 1e-3;
    expect(fieldPlace(final)).toBe(1);
  });

  it("deals a field tight at the top and hardly ever out", () => {
    let outs = 0;
    let runs = 0;
    for (const seed of [SEED, 7, 11]) {
      const state = createGame({ seed, level: BASE, mode: "speedSki", quiet: true });
      const times = state.field!.runs.filter((r) => r.time !== null).map((r) => r.time!);
      runs += state.field!.runs.length;
      outs += state.field!.runs.length - times.length;
      times.sort((a, b) => a - b);
      const par = raceParOf(state.level)!.time;
      expect(times[0] / par).toBeGreaterThan(1);
      expect(times[times.length - 1] / times[0]).toBeLessThan(1 + SPEED_SKI_FIELD.spread + 0.02);
      for (const r of state.field!.runs) {
        if (r.out) expect(r.out.why).toBe("fall");
        else expect(r.trap! * r.time!).toBeCloseTo(state.level.speedSki!.zone.length, 6);
      }
    }
    expect(outs / runs).toBeLessThan(0.1);
  });
});
