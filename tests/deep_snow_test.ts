// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEEP SNOW (`snow.ts`'s header): past the ordinary depth, up to a metre of
// fresh snow, the powder is bottomless — it gives under load and stays
// pressed, a ski planes later and the body ploughs, and a skier down in it
// turns with his weight, held up by it. Held here from both ends: the
// ordinary snow every race is skied on is the model it was, and the deep
// snow does what skiers say it does — keep it moving, keep the tips up,
// hang your weight uphill. Plus the angulation following the bend on the
// groomer. Staged on the synthetic drag strips with `placeRun`.

import { describe, expect, it } from "vitest";

import {
  bottomlessOf,
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  settleShare,
  sinkTarget,
  skisById,
  SKIS,
  SNOW_DIAL,
  snowCoverOf,
  step,
  TOP_SPEED_PITCH,
  TUNING,
  type GameState,
  type Level,
  type RunMoment,
  type SkierInput,
  type SkiSpec,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const METRE = SNOW_DIAL.max;
const POWDER = flatLevel({ packed: 0 });
const PACKED = flatLevel({ packed: 1 });
const DEEP_SCHUSS = flatLevel({
  packed: 0,
  grade: Math.tan(TOP_SPEED_PITCH),
  slopeFrom: 200,
  size: 4000,
});
const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };

function stage(
  level: Level,
  moment: RunMoment,
  snowDepth: number = METRE,
  spec: SkiSpec = SKIS,
): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, spec, snowDepth, quiet: true });
  placeRun(state, moment);
  return state;
}

function ride(state: GameState, seconds: number, input: (s: GameState, t: number) => SkierInput) {
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) step(state, input(state, i / TUNING.physicsHz));
}

const over = (s: GameState): boolean => Math.abs(s.skier.roll) > 1.2;

const midSink = (s: GameState): number =>
  s.skier.sinks[s.skier.contacts.findIndex((k) => k.station === "mid")];

describe("the depth of snow", () => {
  it("reads a metre of fresh snow at the dial's deepest, the ordinary snow at 40 cm", () => {
    expect(snowCoverOf(1)).toBeCloseTo(0.4, 9);
    expect(snowCoverOf(METRE)).toBeCloseTo(1, 9);
    expect(bottomlessOf(1)).toBe(0);
    expect(bottomlessOf(0.5)).toBe(0);
    expect(bottomlessOf(METRE)).toBe(1);
  });

  it("leaves the ordinary snow's model alone: no give, no hold-down, no later planing", () => {
    expect(sinkTarget(0, 5, 1, 1, 1, 2.5)).toBe(sinkTarget(0, 5, 1, 1, 1));
    expect(settleShare(bottomlessOf(1), 0)).toBe(1);
  });

  it("gives under load in deep snow, down to what the loose layer compacts to", () => {
    const rest = sinkTarget(0, 0, 1, 1, METRE, 1, 1);
    const loaded = sinkTarget(0, 0, 1, 1, METRE, 2, 1);
    expect(loaded).toBeGreaterThan(rest);
    expect(loaded).toBeLessThanOrEqual(TUNING.snow.deep.compact * snowCoverOf(METRE) + 1e-9);
    expect(sinkTarget(0, 0, 1, 1, METRE, 0.5, 1)).toBeLessThan(rest);
  });

  it("stays pressed under a stopped ski, and only new snow comes back up", () => {
    expect(settleShare(1, 0)).toBe(0);
    expect(settleShare(1, TUNING.snow.deep.settle)).toBe(1);
  });

  it("sinks a skier standing in a metre to his knees — some 50–65 cm", () => {
    const deep = stage(POWDER, { x: 1500, z: 200, heading: 0 });
    const medium = stage(POWDER, { x: 1500, z: 200, heading: 0 }, 1);
    ride(deep, 3, () => NEUTRAL_INPUT);
    ride(medium, 3, () => NEUTRAL_INPUT);
    const sink = midSink(deep);
    expect(sink).toBeGreaterThan(0.5);
    expect(sink).toBeLessThan(0.66);
    expect(deep.skier.y).toBeLessThan(medium.skier.y - 0.25);
    expect(Math.abs(deep.skier.roll)).toBeLessThan(0.05);
  });
});

describe("keep it moving, keep the tips up", () => {
  it("planes an all-mountain ski down a pitch in a metre once the skier leans back", () => {
    const flat = stage(DEEP_SCHUSS, { x: 2000, z: 210, heading: 0, speed: 2 });
    const back = stage(DEEP_SCHUSS, { x: 2000, z: 210, heading: 0, speed: 2 });
    ride(flat, 20, () => TUCK);
    ride(back, 20, () => ({ ...TUCK, lean: 1 }));
    expect(back.skier.speed * 3.6).toBeGreaterThan(45);
    expect(back.skier.speed).toBeGreaterThanOrEqual(flat.skier.speed * 0.95);
  });

  it("carries the powder ski over the top faster than the all-mountain ski", () => {
    const marmot = stage(
      DEEP_SCHUSS,
      { x: 2000, z: 210, heading: 0, speed: 2 },
      METRE,
      skisById("marmot"),
    );
    const chamois = stage(DEEP_SCHUSS, { x: 2000, z: 210, heading: 0, speed: 2 });
    ride(marmot, 20, () => TUCK);
    ride(chamois, 20, () => TUCK);
    expect(marmot.skier.speed).toBeGreaterThan(chamois.skier.speed);
  });

  it("is still the ordinary powder at the ordinary depth: a tucked skier planes", () => {
    const s = stage(DEEP_SCHUSS, { x: 2000, z: 210, heading: 0, speed: 2 }, 1);
    ride(s, 20, () => TUCK);
    expect(s.skier.speed * 3.6).toBeGreaterThan(60);
    expect(midSink(s)).toBeLessThan(TUNING.snow.powderSink * 0.3);
  });
});

describe("turn with your weight", () => {
  const SIDEHILL = flatLevel({ packed: 0, grade: 0.18, slopeFrom: 400 });
  /** A traverse across the fall line: the ground falls along +z, the
   * skier goes along +x. */
  const across = { x: 1400, z: 440, heading: Math.PI / 2, speed: 20 / 3.6 };

  it("holds the same traverse in the ordinary snow, hands off", () => {
    const s = stage(SIDEHILL, across, 1);
    let fell = false;
    ride(s, 5, (st) => {
      fell ||= over(st);
      return { ...NEUTRAL_INPUT, tuck: 0.5 };
    });
    expect(fell).toBe(false);
  });

  it("stays upright in a metre with the weight hung uphill", () => {
    const s = stage(SIDEHILL, across);
    let fell = false;
    ride(s, 8, (st) => {
      fell ||= over(st);
      const steer = Math.max(-1, Math.min(1, -3 * st.skier.roll - 0.3 * st.skier.wz));
      return { ...NEUTRAL_INPUT, tuck: 0.5, steer };
    });
    expect(fell).toBe(false);
    expect(s.skier.thrown).toBeNull();
  });
});

describe("the angulation follows the bend", () => {
  const hangAt = (level: Level, kmh: number): number => {
    const s = stage(level, { x: 1500, z: 400, heading: 0, speed: kmh / 3.6 }, 1);
    ride(s, 1, () => ({ ...NEUTRAL_INPUT, steer: 1 }));
    return s.skier.hipRight / s.skier.spec.hipReach;
  };

  it("stands a skier square at a crawl on the groomer, and hangs his hips in at pace", () => {
    expect(hangAt(PACKED, 3)).toBeLessThan(0.5);
    expect(hangAt(PACKED, 45)).toBeGreaterThan(0.9);
  });

  it("hangs them in at any pace in powder, where his weight is how the skis turn", () => {
    expect(hangAt(POWDER, 3)).toBeGreaterThan(0.9);
  });
});
