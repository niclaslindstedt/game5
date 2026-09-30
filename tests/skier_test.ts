// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER ON THE SNOW: he stands at his rest sag, sinks into powder and
// not into the groomed piste, gets going down a pitch, reaches the top speed
// the spec documents in a tuck, is slower standing tall and slower in
// powder, carves, skids and stops, and pushes off on his poles. Staged on
// the synthetic drag strips (`support/synthetic.ts`) with `placeRun`, skied
// by scripted input through the real step.

import { describe, expect, it } from "vitest";

import {
  carveCurvature,
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  SKIS,
  step,
  terminalSpeed,
  TOP_SPEED_PITCH,
  TUNING,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const PACKED = flatLevel({ packed: 1 });
const POWDER = flatLevel({ packed: 0 });
/** The reference pitch: a 20° groomed schuss, and the same in powder. */
const SCHUSS = flatLevel({
  packed: 1,
  grade: Math.tan(TOP_SPEED_PITCH),
  slopeFrom: 200,
  size: 4000,
});
const DEEP_SCHUSS = flatLevel({
  packed: 0,
  grade: Math.tan(TOP_SPEED_PITCH),
  slopeFrom: 200,
  size: 4000,
});
const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };

function stage(level: Level, speed = 0, heading = 0, z = 150): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: level.size / 2, z, heading, speed });
  return state;
}

function ride(
  state: GameState,
  seconds: number,
  input: SkierInput | ((s: GameState) => SkierInput),
) {
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) step(state, typeof input === "function" ? input(state) : input);
}

/** Seconds from a push-off to `kmh` down the schuss, or Infinity. */
function timeTo(level: Level, kmh: number, input: SkierInput = TUCK, limit = 40): number {
  const state = stage(level, 2, 0, 210);
  const steps = Math.round(limit * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, input);
    if (state.skier.speed * 3.6 >= kmh) return (i + 1) * TUNING.dt;
  }
  return Infinity;
}

describe("the skier at rest", () => {
  it("stands on packed snow at his CoG height, level, and stays put", () => {
    const state = stage(PACKED);
    ride(state, 3, NEUTRAL_INPUT);
    const c = state.skier;
    const over = c.y - PACKED.groundAt(c.x, c.z);
    expect(over).toBeGreaterThan(SKIS.cogHeight - 0.08);
    expect(over).toBeLessThan(SKIS.cogHeight + 0.02);
    expect(Math.abs(c.pitch)).toBeLessThan(0.03);
    expect(Math.abs(c.roll)).toBeLessThan(0.01);
    expect(c.speed).toBeLessThan(0.05);
    expect(c.airborne).toBe(false);
    for (const contact of c.contacts) {
      expect(contact.touching).toBe(true);
      expect(contact.sink).toBeLessThan(0.03);
    }
  });

  it("sinks into powder by about the skis' rest sink", () => {
    const state = stage(POWDER);
    ride(state, 3, NEUTRAL_INPUT);
    const c = state.skier;
    const mid = c.contacts.find((k) => k.station === "mid")!;
    expect(mid.sink).toBeCloseTo(TUNING.snow.powderSink, 2);
    const over = c.y - POWDER.groundAt(c.x, c.z);
    expect(over).toBeLessThan(SKIS.cogHeight - 0.12);
    expect(over).toBeGreaterThan(SKIS.cogHeight - TUNING.snow.powderSink - 0.05);
  });

  it("reports every station's footprint on the snow surface for the trails", () => {
    const state = stage(POWDER, 12);
    ride(state, 1, TUCK);
    const c = state.skier;
    expect(c.contacts).toHaveLength(6);
    expect(c.contacts.filter((k) => k.side < 0)).toHaveLength(3);
    expect(c.contacts.map((k) => k.station)).toEqual(["tip", "mid", "tail", "tip", "mid", "tail"]);
    for (const k of c.contacts) {
      if (!k.touching) continue;
      expect(k.y).toBeCloseTo(POWDER.groundAt(k.x, k.z), 3);
      expect(Math.hypot(k.x - c.x, k.z - c.z)).toBeLessThan(SKIS.length);
    }
  });

  it("folds into a tuck: the crouch follows the thumb and drops the body", () => {
    const tall = stage(PACKED);
    const tucked = stage(PACKED);
    ride(tall, 3, NEUTRAL_INPUT);
    ride(tucked, 3, TUCK);
    expect(tucked.skier.crouch).toBeGreaterThan(0.95);
    expect(tall.skier.crouch).toBeLessThan(0.05);
    const dropped = tall.skier.y - tucked.skier.y;
    expect(dropped).toBeGreaterThan(SKIS.crouchDrop * 0.7);
    expect(dropped).toBeLessThan(SKIS.crouchDrop * 1.2);
  });
});

describe("the skier under gravity", () => {
  it("tops out within a tenth of the documented top speed in a tuck down the reference pitch", () => {
    const state = stage(SCHUSS, 2, 0, 210);
    ride(state, 30, TUCK);
    const kmh = state.skier.speed * 3.6;
    expect(kmh).toBeGreaterThan(SKIS.topSpeed * 0.9);
    expect(kmh).toBeLessThan(SKIS.topSpeed * 1.1);
    // ...which is where the air holds him (`terminalSpeed`, within the
    // grip's scrub and the snow's own drag).
    expect(kmh).toBeLessThan(terminalSpeed(SKIS, TOP_SPEED_PITCH) * 3.6);
    expect(kmh).toBeGreaterThan(terminalSpeed(SKIS, TOP_SPEED_PITCH) * 3.6 * 0.85);
    expect(state.skier.airborne).toBe(false);
    expect(Math.abs(state.skier.roll)).toBeLessThan(0.1);
  });

  it("is slower standing tall than folded into a tuck", () => {
    const tall = stage(SCHUSS, 2, 0, 210);
    ride(tall, 30, NEUTRAL_INPUT);
    const tucked = stage(SCHUSS, 2, 0, 210);
    ride(tucked, 30, TUCK);
    expect(tall.skier.speed).toBeLessThan(tucked.skier.speed * 0.8);
    expect(tall.skier.speed * 3.6).toBeGreaterThan(60);
  });

  it("is slower in powder, and planes up onto it with speed", () => {
    expect(timeTo(DEEP_SCHUSS, 50)).toBeGreaterThan(timeTo(SCHUSS, 50) * 1.3);
    const state = stage(DEEP_SCHUSS, 2, 0, 210);
    const mid = state.skier.contacts.findIndex((k) => k.station === "mid");
    const restSink = state.skier.sinks[mid];
    ride(state, 30, TUCK);
    const kmh = state.skier.speed * 3.6;
    expect(kmh).toBeLessThan(SKIS.topSpeed * 0.9);
    expect(kmh).toBeGreaterThan(55);
    expect(state.skier.sinks[mid]).toBeLessThan(restSink * 0.25);
  });

  it("pushes off on the poles from rest on the flat, and only at a crawl", () => {
    const state = stage(PACKED);
    ride(state, 8, TUCK);
    expect(state.skier.speed).toBeGreaterThan(1.5);
    expect(state.skier.speed).toBeLessThan(TUNING.poles.fade + 0.5);
    const idle = stage(PACKED);
    ride(idle, 8, NEUTRAL_INPUT);
    expect(idle.skier.speed).toBeLessThan(0.05);
  });
});

describe("the edge and the skid", () => {
  it("carves right on a right edge, and left on a left one", () => {
    for (const side of [1, -1]) {
      const state = stage(PACKED, 40 / 3.6);
      ride(state, 2, { ...NEUTRAL_INPUT, steer: side });
      expect(Math.sign(state.skier.heading)).toBe(side);
      expect(Math.abs(state.skier.heading)).toBeGreaterThan(0.4);
      // Inclined into the turn, not thrown out of it.
      expect(Math.sign(state.skier.roll)).toBe(side);
      expect(Math.abs(state.skier.roll)).toBeLessThan(0.6);
    }
  });

  it("carves about the arc the sidecut makes at the edge it stands on", () => {
    const state = stage(PACKED, 40 / 3.6);
    ride(state, 1, { ...NEUTRAL_INPUT, steer: 0.6 });
    const c = state.skier;
    const asked = carveCurvature(SKIS, c.edge) * c.way;
    // The yaw rate settles near the curvature the edge asks for.
    expect(c.wy).toBeGreaterThan(asked * 0.6);
    expect(c.wy).toBeLessThan(asked * 1.3);
  });

  it("stops from 80 km/h on packed snow inside 90 m without spinning round", () => {
    const state = stage(PACKED, 80 / 3.6);
    const z0 = state.skier.z;
    ride(state, 8, { ...NEUTRAL_INPUT, brake: 1 });
    expect(state.skier.speed).toBeLessThan(0.5);
    expect(state.skier.z - z0).toBeLessThan(90);
    expect(Math.abs(state.skier.heading)).toBeLessThan(0.3);
  });

  it("holds his speed down a pitch in a snowplough where a tuck runs away", () => {
    const plough = stage(SCHUSS, 5, 0, 210);
    ride(plough, 15, { ...NEUTRAL_INPUT, brake: 1 });
    const tucked = stage(SCHUSS, 5, 0, 210);
    ride(tucked, 15, TUCK);
    expect(plough.skier.speed).toBeLessThan(tucked.skier.speed * 0.6);
  });

  it("does not swap ends skidding hard into a turn", () => {
    const state = stage(PACKED, 70 / 3.6);
    let worst = 0;
    ride(state, 4, (s) => {
      const c = s.skier;
      if (Math.hypot(c.vx, c.vz) > 3) {
        const way = Math.atan2(c.vx, c.vz);
        let d = Math.abs(c.heading - way) % (2 * Math.PI);
        if (d > Math.PI) d = 2 * Math.PI - d;
        worst = Math.max(worst, d);
      }
      return { ...NEUTRAL_INPUT, brake: 1, steer: s.t > 0.3 ? 0.6 : 0 };
    });
    expect(worst).toBeLessThan(Math.PI / 3);
  });
});
