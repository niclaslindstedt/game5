// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER'S WEIGHT (`defs/riders.ts`): four builds, the medium one the
// reference every row already carries — handed back to the bit, so nothing
// skied before a build could be chosen moves — and the others felt where
// mass is: faster in a tuck down the reference pitch the heavier he is,
// slower to skate up to speed on the flat, a harder landing off the same
// drop, and a harder shoulder into another skier. Staged on the synthetic
// strips with `placeRun`, skied through the real step.

import { describe, expect, it } from "vitest";

import {
  createGame,
  driveForce,
  harshSpeedOf,
  isRiderId,
  landingLoad,
  MEDIUM_RIDER,
  NEUTRAL_INPUT,
  placeRun,
  RIDERS,
  riderById,
  riderOf,
  SKI_CATALOG,
  SKIS,
  step,
  terminalSpeed,
  TOP_SPEED_PITCH,
  totalMass,
  TUNING,
  withRider,
  type GameState,
  type Level,
  type SkiSpec,
  type SkierInput,
} from "@engine";
import { flatLevel, syntheticLevel } from "./support/synthetic.ts";

const PACKED = flatLevel({ packed: 1 });
const SCHUSS = flatLevel({
  packed: 1,
  grade: Math.tan(TOP_SPEED_PITCH),
  slopeFrom: 200,
  size: 4000,
});
const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };
const HEAVY = withRider(SKIS, riderById("heavy"));
const LIGHT = withRider(SKIS, riderById("light"));

function stage(level: Level, spec: SkiSpec, speed = 0, z = 150): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, spec, quiet: true });
  placeRun(state, { x: level.size / 2, z, heading: 0, speed });
  return state;
}

function ride(state: GameState, seconds: number, input: SkierInput): void {
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) step(state, input);
}

describe("the builds", () => {
  it("are four, lightest first, the medium one the 80 kg skier every pair carries", () => {
    expect(RIDERS.map((r) => r.id)).toEqual(["light", "medium", "solid", "heavy"]);
    for (let i = 1; i < RIDERS.length; i++) {
      expect(RIDERS[i].mass).toBeGreaterThan(RIDERS[i - 1].mass);
    }
    expect(MEDIUM_RIDER.mass).toBe(SKIS.skierMass);
    for (const spec of SKI_CATALOG) {
      expect(riderOf(spec)).toBe(MEDIUM_RIDER);
      expect(spec.skierMass).toBe(MEDIUM_RIDER.mass);
    }
    expect(isRiderId("heavy")).toBe(true);
    expect(isRiderId("yeti")).toBe(false);
    expect(riderById("yeti")).toBe(MEDIUM_RIDER);
  });

  it("hands every pair back untouched under the medium rider", () => {
    for (const spec of SKI_CATALOG) expect(withRider(spec, MEDIUM_RIDER)).toBe(spec);
    // ...and back again from another build, to the figure that matters.
    const back = withRider(HEAVY, MEDIUM_RIDER);
    expect(back.skierMass).toBeCloseTo(SKIS.skierMass, 9);
    expect(back.cdATuck).toBeCloseTo(SKIS.cdATuck, 9);
    expect(back.polePush).toBeCloseTo(SKIS.polePush, 9);
  });

  it("restates the skier and nothing of the skis", () => {
    expect(HEAVY.skierMass).toBe(riderById("heavy").mass);
    for (const key of ["length", "waist", "sidecut", "flex", "rocker", "gearMass"] as const) {
      expect(HEAVY[key]).toBe(SKIS[key]);
    }
    // His legs carry him at the same sag.
    const sag = (s: SkiSpec): number => (totalMass(s) * TUNING.g) / s.legs.rate;
    expect(sag(HEAVY)).toBeCloseTo(sag(SKIS), 9);
    expect(sag(LIGHT)).toBeCloseTo(sag(SKIS), 9);
  });
});

describe("a heavier skier", () => {
  it("runs faster flat out in a tuck down the reference pitch, as his expectation says", () => {
    const top = (spec: SkiSpec): number => {
      const state = stage(SCHUSS, spec, 2, 210);
      ride(state, 30, TUCK);
      return state.skier.speed * 3.6;
    };
    const light = top(LIGHT);
    const medium = top(SKIS);
    const heavy = top(HEAVY);
    expect(heavy).toBeGreaterThan(medium * 1.04);
    expect(light).toBeLessThan(medium * 0.96);
    // Each within a tenth of his own documented top speed, which climbs as
    // the terminal speed does.
    for (const [kmh, spec] of [
      [light, LIGHT],
      [heavy, HEAVY],
    ] as const) {
      expect(kmh).toBeGreaterThan(spec.topSpeed * 0.9);
      expect(kmh).toBeLessThan(spec.topSpeed * 1.1);
    }
    expect(HEAVY.topSpeed / SKIS.topSpeed).toBeCloseTo(
      terminalSpeed(HEAVY, TOP_SPEED_PITCH) / terminalSpeed(SKIS, TOP_SPEED_PITCH),
      9,
    );
  });

  it("winds up slower on the flat: his push buys less speed on more mass", () => {
    const accel = (s: SkiSpec): number => driveForce(s, 2, 1, 1) / totalMass(s);
    expect(accel(HEAVY)).toBeLessThan(accel(SKIS) * 0.85);
    expect(accel(LIGHT)).toBeGreaterThan(accel(SKIS) * 1.05);
    const after = (spec: SkiSpec): number => {
      const state = stage(PACKED, spec, 1);
      ride(state, 4, NEUTRAL_INPUT);
      return state.skier.speed;
    };
    expect(after(HEAVY)).toBeLessThan(after(SKIS));
    expect(after(LIGHT)).toBeGreaterThan(after(SKIS));
  });

  it("feels the same drop harder: his legs stop it over less of their stroke", () => {
    const impact = 8;
    expect(landingLoad(impact, 0, 0, riderOf(HEAVY).hold)).toBeGreaterThan(
      landingLoad(impact, 0, 0, riderOf(SKIS).hold),
    );
    expect(landingLoad(impact, 0, 0, riderOf(LIGHT).hold)).toBeLessThan(
      landingLoad(impact, 0, 0, riderOf(SKIS).hold),
    );
    expect(harshSpeedOf(HEAVY)).toBeLessThan(harshSpeedOf(SKIS));
    expect(harshSpeedOf(LIGHT)).toBeGreaterThan(harshSpeedOf(SKIS));
    // The medium rider's load is the one it always was.
    expect(landingLoad(impact, 0.5, 0.1, 1)).toBe(landingLoad(impact, 0.5, 0.1));
  });

  it("shoulders a rival off his line and is moved less himself", () => {
    const shove = (spec: SkiSpec): { me: number; rival: number } => {
      const state = createGame({ level: syntheticLevel(), countdown: 0, quiet: true, spec });
      placeRun(state, { x: 400, z: 300, heading: Math.PI / 2, speed: 12 });
      const rival = state.rivals[0].run;
      placeRun(rival, { x: 404, z: 300, heading: -Math.PI / 2, speed: 4 });
      for (let i = 0; i < 60; i++) {
        step(state, NEUTRAL_INPUT);
        if (state.events.some((e) => e.kind === "bump" && e.rival === 0)) break;
      }
      return { me: state.skier.vx, rival: rival.skier.vx };
    };
    const medium = shove(SKIS);
    const heavy = shove(HEAVY);
    // He keeps more of his way east, and the rival is driven further east.
    expect(heavy.me).toBeGreaterThan(medium.me);
    expect(heavy.rival).toBeGreaterThan(medium.rival);
  });
});
