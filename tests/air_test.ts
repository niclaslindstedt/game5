// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND ON THE SKIER — the air where he is (`wind.ts`: the log law down
// to his body, the mountain's exposure, the woods' shelter), the apparent
// wind he hears and the HUD reads (`airflowAt`), and what that air does to
// him (`air.ts`, summed in `skier.ts`): a headwind slows him, a tailwind
// carries him, a crosswind pushes him off his line and he leans into it, a
// wind across a turn tightens or widens it, and a breeze cannot start a
// skier stood still while a storm's gust can.

import { describe, expect, it } from "vitest";

import {
  BODY_HEIGHT,
  NEUTRAL_INPUT,
  TUNING,
  airAt,
  airflowAt,
  createGame,
  exposureAt,
  placeRun,
  profileAt,
  shelterAt,
  sideAreaOf,
  dragAreaOf,
  SKIS,
  step,
  windAt,
  withSky,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { flatLevel } from "./support/synthetic.ts";

const W = TUNING.wind;

describe("the air where a skier is (wind.ts)", () => {
  const level = withSky(levelFor(LEVEL_SEEDS[1]), { weather: { kind: "storm", wind: 20 } });

  it("comes down the log law to his body: three quarters of the 10 m wind at a metre", () => {
    expect(profileAt(W.refHeight)).toBeCloseTo(1, 9);
    expect(profileAt(BODY_HEIGHT)).toBeGreaterThan(0.7);
    expect(profileAt(BODY_HEIGHT)).toBeLessThan(0.8);
    expect(profileAt(0.5)).toBeLessThan(profileAt(BODY_HEIGHT));
    expect(profileAt(0)).toBeGreaterThan(0);
  });

  it("blows harder up the mountain than on the valley floor", () => {
    const m = level.mountain!;
    expect(exposureAt(level, m.base.x, m.base.z)).toBeLessThan(1);
    expect(exposureAt(level, m.summit.x, m.summit.z)).toBeGreaterThan(1);
    expect(exposureAt(level, m.summit.x, m.summit.z)).toBeLessThanOrEqual(W.summit + 1e-9);
  });

  it("is sheltered in the woods and open where nothing grows", () => {
    let least = 1;
    for (let i = 0; i < level.trees.length; i += 7) {
      least = Math.min(least, shelterAt(level, level.trees[i].x, level.trees[i].z));
    }
    // Somewhere on the mountain the woods close over.
    expect(least).toBeLessThan(0.5);
    expect(least).toBeGreaterThanOrEqual(1 - W.shelter.most - 1e-6);
    const m = level.mountain!;
    expect(shelterAt({ ...level, trees: [] }, m.base.x, m.base.z)).toBe(1);
  });

  it("is the weather's wind times all three, from the same bearing", () => {
    const t = 17.25;
    const { x, z } = level.spawn;
    const w = windAt(level, t);
    const a = airAt(level, t, x, z, BODY_HEIGHT);
    const k = profileAt(BODY_HEIGHT) * exposureAt(level, x, z) * shelterAt(level, x, z);
    expect(a.speed).toBeCloseTo(w.speed * k, 9);
    expect(a.x).toBeCloseTo(w.x * k, 9);
    expect(a.z).toBeCloseTo(w.z * k, 9);
  });
});

describe("the apparent wind (airflowAt)", () => {
  const level = withSky(levelFor(LEVEL_SEEDS[1]), { weather: { kind: "storm", wind: 28 } });
  const t = 31.5;
  const { x, z } = level.spawn;
  const w = airAt(level, t, x, z, BODY_HEIGHT);
  const ux = w.x / w.speed;
  const uz = w.z / w.speed;
  const rider = (vx: number, vy: number, vz: number, heading: number) => ({
    x,
    z,
    vx,
    vy,
    vz,
    heading,
  });

  it("is the air where he stands on a skier at rest", () => {
    const f = airflowAt(level, t, rider(0, 0, 0, 0));
    expect(f.x).toBeCloseTo(w.x, 9);
    expect(f.z).toBeCloseTo(w.z, 9);
    expect(f.speed).toBeCloseTo(w.speed, 9);
  });

  it("adds a headwind to the speed and takes a tailwind from it", () => {
    // Skiing at 28 m/s straight into it: the two added, all of it in his face.
    const head = airflowAt(level, t, rider(-ux * 28, 0, -uz * 28, Math.atan2(-ux, -uz)));
    expect(head.speed).toBeCloseTo(w.speed + 28, 6);
    expect(head.head).toBeCloseTo(head.speed, 6);
    expect(head.across).toBeCloseTo(0, 6);
    // Skiing with it as fast as it blows: a calm.
    expect(airflowAt(level, t, rider(w.x, 0, w.z, Math.atan2(ux, uz))).speed).toBeCloseTo(0, 9);
    // Falling through still air is wind too.
    expect(airflowAt(level, t, rider(w.x, -10, w.z, 0)).speed).toBeCloseTo(10, 9);
  });

  it("reads a wind across him on the heading's right as positive", () => {
    // Faced so the wind blows toward his right, (cos h, -sin h).
    const f = airflowAt(level, t, rider(0, 0, 0, Math.atan2(-uz, ux)));
    expect(f.across).toBeCloseTo(w.speed, 6);
    expect(f.head).toBeCloseTo(0, 6);
  });
});

describe("the side-on drag area", () => {
  it("is less than the frontal stood up and more in a tuck, whose profile is long", () => {
    expect(sideAreaOf(SKIS, 0)).toBeLessThan(dragAreaOf(SKIS, 0));
    expect(sideAreaOf(SKIS, 1)).toBeGreaterThan(dragAreaOf(SKIS, 1));
  });
});

// ── The skier in the wind, on the bench ──────────────────────────────────
// The strip runs along +z, so a skier faced down it has +x on his right.
// A wind FROM `from` moves toward `from + π` (`windAt`): from 0 is in his
// face, from π behind him, from −π/2 blows toward his right.

const PITCH = Math.tan((20 * Math.PI) / 180);

function under(level: Level, wind: number, from: number): Level {
  return wind === 0 ? level : withSky(level, { weather: { kind: "clear", wind, windFrom: from } });
}

function run(level: Level, at: { x: number; z: number; speed: number }): GameState {
  const state = createGame({ level, seed: 5, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: at.x, z: at.z, heading: 0, speed: at.speed });
  return state;
}

function ride(state: GameState, seconds: number, input: SkierInput): void {
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) step(state, input);
}

const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };

describe("the wind on the skier (air.ts)", () => {
  const pitch = flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 });
  /** His speed after 25 s tucked down the 20° pitch from a push-off. */
  const schuss = (wind: number, from: number): number => {
    const state = run(under(pitch, wind, from), { x: 2000, z: 210, speed: 3 });
    ride(state, 25, TUCK);
    return state.skier.speed;
  };

  it("slows him into a headwind and carries him with a tailwind", () => {
    const still = schuss(0, 0);
    const head = schuss(12, 0);
    const tail = schuss(12, Math.PI);
    // Some 9 m/s of air at his body: his terminal speed moves by about that.
    expect(head).toBeLessThan(still - 4);
    expect(tail).toBeGreaterThan(still + 4);
  });

  it("pushes him off a straight line in a crosswind, and he leans into it", () => {
    const flat = flatLevel({ packed: 1 });
    const still = run(flat, { x: 1500, z: 200, speed: 20 });
    const blown = run(under(flat, 15, -Math.PI / 2), { x: 1500, z: 200, speed: 20 });
    let leaned = 0;
    for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
      step(still, NEUTRAL_INPUT);
      step(blown, NEUTRAL_INPUT);
      if (i > TUNING.physicsHz) leaned += blown.skier.roll;
    }
    // Blown toward his right (+x), the way he goes bends that way — the
    // edges hold most of it…
    expect(blown.skier.x - 1500).toBeGreaterThan(still.skier.x - 1500 + 0.2);
    // …and he leans to his left, into the wind (roll is right side down).
    expect(leaned / (2 * TUNING.physicsHz)).toBeLessThan(-0.02);
  });

  it("tightens a turn the wind blows into and widens one it blows out of", () => {
    // Where the grip is what limits the turn — full edge at 95 km/h — a
    // wind across him into the turn bends the way further than the edges
    // alone could, and one out of it takes from what they can.
    const flat = flatLevel({ packed: 1 });
    /** Degrees turned in 1.5 s on full edge to the right from 95 km/h. */
    const turned = (wind: number, from: number): number => {
      const state = run(under(flat, wind, from), { x: 1500, z: 200, speed: 95 / 3.6 });
      ride(state, 1.5, { ...NEUTRAL_INPUT, steer: 1 });
      return (state.skier.heading * 180) / Math.PI;
    };
    const still = turned(0, 0);
    expect(turned(18, -Math.PI / 2)).toBeGreaterThan(still + 3); // toward his right
    expect(turned(18, Math.PI / 2)).toBeLessThan(still - 3); // toward his left
  });

  it("leans him less into a turn the wind blows into, more out of it", () => {
    const flat = flatLevel({ packed: 1 });
    /** His roll after 1 s on a half edge to the right from 60 km/h. */
    const roll = (from: number): number => {
      const state = run(under(flat, 18, from), { x: 1500, z: 200, speed: 60 / 3.6 });
      ride(state, 1, { ...NEUTRAL_INPUT, steer: 0.5 });
      return state.skier.roll;
    };
    expect(roll(Math.PI / 2)).toBeGreaterThan(roll(-Math.PI / 2) + 0.05);
  });

  it("cannot start a skier stood still in a breeze, but a storm's gust can", () => {
    const flat = flatLevel({ packed: 1 });
    // From behind him, along his skis.
    const breeze = run(under(flat, 5, Math.PI), { x: 1500, z: 200, speed: 0 });
    ride(breeze, 5, NEUTRAL_INPUT);
    expect(breeze.skier.speed).toBeLessThan(0.05);
    const storm = run(under(flat, 32, Math.PI), { x: 1500, z: 200, speed: 0 });
    ride(storm, 5, NEUTRAL_INPUT);
    expect(storm.skier.speed).toBeGreaterThan(0.5);
  });
});
