// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIELD: three rivals on the start line beside the player, each a whole
// run over the same map skied by the bot, held by the same lights; the
// standings; and skiers that cannot pass through each other.

import { describe, expect, it } from "vitest";

import {
  SKI_CATALOG,
  createGame,
  fieldOrder,
  NEUTRAL_INPUT,
  placeRun,
  racePlace,
  RACE,
  step,
  TUNING,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

describe("the start line", () => {
  it("stands three rivals on the level's slots beside the player", () => {
    const level = syntheticLevel();
    const state = createGame({ level, quiet: true });
    expect(state.rivals).toHaveLength(RACE.rivals);
    expect(state.phase).toBe("countdown");
    const all = [state.skier, ...state.rivals.map((r) => r.run.skier)];
    all.forEach((s, i) => {
      expect(s.x).toBeCloseTo(level.grid[i].x, 6);
      expect(s.z).toBeCloseTo(level.grid[i].z, 6);
    });
    for (const r of state.rivals) {
      expect(r.run.level).toBe(level);
      expect(r.pace).toBeGreaterThanOrEqual(RACE.paceBand.min);
      expect(r.pace).toBeLessThanOrEqual(RACE.paceBand.max);
      expect(SKI_CATALOG).toContain(r.run.skier.spec);
    }
  });

  it("deals the field its skis off the run's own stream", () => {
    const pairs = (seed: number): string[] =>
      createGame({ level: syntheticLevel(), seed, quiet: true }).rivals.map(
        (r) => r.run.skier.spec.id,
      );
    expect(pairs(7)).toEqual(pairs(7));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) for (const id of pairs(seed)) seen.add(id);
    expect(seen.size).toBeGreaterThan(2);
  });

  it("holds the field in the gate under the lights and lets it go on GO", () => {
    const state = createGame({ level: syntheticLevel(), quiet: true });
    const start = state.rivals.map((r) => ({ x: r.run.skier.x, z: r.run.skier.z }));
    for (let i = 0; i < 2.5 * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
    // Held, not parked: each skier settles onto the snow at his own rest
    // pitch, which walks his centre of gravity a little. One let go on the
    // summit shelf would be pushing off.
    state.rivals.forEach((r, i) => {
      expect(Math.hypot(r.run.skier.x - start[i].x, r.run.skier.z - start[i].z)).toBeLessThan(0.5);
    });
    for (let i = 0; i < 8 * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
    for (const r of state.rivals) expect(r.run.skier.speed).toBeGreaterThan(3);
  });

  it("lets each rival go on his own reaction, out of step with the rest", () => {
    const state = createGame({ level: syntheticLevel(), seed: 5, quiet: true });
    for (const r of state.rivals) {
      expect(r.react).toBeGreaterThanOrEqual(RACE.reactBand.min);
      expect(r.react).toBeLessThan(RACE.reactBand.max);
    }
    expect(new Set(state.rivals.map((r) => r.react.toFixed(3))).size).toBe(RACE.rivals);
    expect(new Set(state.rivals.map((r) => r.run.skier.stride.toFixed(3))).size).toBe(RACE.rivals);
    // The step each one first moves off his spot after GO.
    const start = state.rivals.map((r) => ({ x: r.run.skier.x, z: r.run.skier.z }));
    const went: (number | null)[] = state.rivals.map(() => null);
    while (state.phase === "countdown") step(state, NEUTRAL_INPUT);
    const go = state.t;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, NEUTRAL_INPUT);
      state.rivals.forEach((r, k) => {
        if (went[k] !== null) return;
        // Off his spot by more than the settle onto the snow walks him.
        if (Math.hypot(r.run.skier.x - start[k].x, r.run.skier.z - start[k].z) > 0.5)
          went[k] = state.t - go;
      });
    }
    state.rivals.forEach((r, k) => {
      expect(went[k]).not.toBeNull();
      expect(went[k] as number).toBeGreaterThan(r.react);
    });
    expect(new Set(went.map((t) => (t as number).toFixed(2))).size).toBe(RACE.rivals);
  });

  it("deals the start beside the field, leaving its paces and skis as they were", () => {
    // Seed 7's field as it was dealt before the start was: the start is
    // drawn off a stream of its own, so no rival's pair or pace moved.
    const state = createGame({ level: syntheticLevel(), seed: 7, quiet: true });
    expect(state.rivals.map((r) => r.run.skier.spec.id)).toEqual(["chamois", "marmot", "chough"]);
    expect(state.rivals.map((r) => r.pace)).toEqual([
      0.8023409506306053, 0.995381526555866, 0.9042890537064523,
    ]);
  });

  it("deals each rival a resilience of his own in the band, the same per seed; the player's is a pro's", () => {
    const deal = (seed: number) => createGame({ level: syntheticLevel(), seed, quiet: true });
    const state = deal(7);
    expect(state.skier.resilience).toBe(1);
    const grit = state.rivals.map((r) => r.resilience);
    for (const [i, r] of grit.entries()) {
      expect(r).toBeGreaterThanOrEqual(RACE.resilienceBand.min);
      expect(r).toBeLessThanOrEqual(RACE.resilienceBand.max);
      expect(state.rivals[i].run.skier.resilience).toBe(r);
    }
    expect(deal(7).rivals.map((r) => r.resilience)).toEqual(grit);
    // Across a handful of fields, the rivals are not all one skier.
    const all = [1, 2, 3, 4, 5].flatMap((seed) => deal(seed).rivals.map((r) => r.resilience));
    expect(Math.max(...all) - Math.min(...all)).toBeGreaterThan(0.3);
    expect(createGame({ level: syntheticLevel(), seed: 7, resilience: 0.2 }).skier.resilience).toBe(
      0.2,
    );
  });
});

describe("the standings", () => {
  it("rank by gates taken, and put a skier standing still behind a field that is skiing", () => {
    const state = createGame({ level: syntheticLevel(), quiet: true });
    expect(racePlace(state)).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 25 * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
    expect(racePlace(state)).toBe(RACE.rivals + 1);
    const order = fieldOrder(state);
    expect(order).toHaveLength(RACE.rivals + 1);
    expect(order[order.length - 1]).toBeNull();
    for (const r of state.rivals) expect(r.run.progress.passed).toBeGreaterThan(0);
  });
});

describe("skier against skier", () => {
  it("pushes two overlapping skiers apart and reports the player's bump", () => {
    const state = createGame({ level: syntheticLevel(), countdown: 0, quiet: true });
    placeRun(state, { x: 400, z: 300, heading: Math.PI / 2, speed: 12 });
    const rival = state.rivals[0].run;
    placeRun(rival, { x: 404, z: 300, heading: -Math.PI / 2, speed: 4 });
    let bumped = false;
    for (let i = 0; i < 60; i++) {
      step(state, { ...NEUTRAL_INPUT, tuck: 0.3 });
      if (state.events.some((e) => e.kind === "bump" && e.rival === 0)) bumped = true;
    }
    expect(bumped).toBe(true);
    const gap = Math.hypot(state.skier.x - rival.skier.x, state.skier.z - rival.skier.z);
    expect(gap).toBeGreaterThan(RACE.bump.radius);
  });
});
