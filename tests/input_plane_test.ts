// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE FLOWN BY HAND (`pwa/src/game/input-plane.ts`): the stick
// eased on a held key and scaled with the airspeed, the levers left where
// they are put, the flaps a notch a press, the screen's sides flipped onto
// the engine's — and a held stick-back pulling a whole loop from cruise on
// the physics alone without snapping the wing.

import { describe, expect, it } from "vitest";
import { NEUTRAL_INPUT, TUNING, createGame, planeAloft, step, type GameEvent } from "@engine";

import {
  FLAP_NOTCH,
  NO_PLANE_KEYS,
  PITCH_LEAST,
  ROLL_LEAST,
  THROTTLE_KEY_RATE,
  createPlaneModel,
  nudgeFlaps,
  pitchReach,
  rollReach,
  samplePlane,
  seatPlaneModel,
  type PlaneKeysHeld,
} from "../pwa/src/game/input-plane.ts";
import { SCREEN_TO_ENGINE, neutralTouch } from "../pwa/src/game/input-model.ts";
import { flatLevel } from "./support/synthetic.ts";

const dt = TUNING.dt;
const keys = (k: Partial<PlaneKeysHeld>): PlaneKeysHeld => ({ ...NO_PLANE_KEYS, ...k });

describe("the stick's reach", () => {
  it("is all the travel slow and shrinks with speed to its floor", () => {
    expect(pitchReach(20)).toBe(1);
    expect(pitchReach(28)).toBe(1);
    expect(pitchReach(45)).toBeLessThan(1);
    expect(pitchReach(45)).toBeGreaterThan(pitchReach(60));
    expect(pitchReach(200)).toBe(PITCH_LEAST);
    expect(rollReach(30)).toBe(1);
    expect(rollReach(60)).toBeCloseTo(40 / 60, 6);
    expect(rollReach(500)).toBe(ROLL_LEAST);
  });
});

describe("samplePlane", () => {
  it("eases a held stick key over rather than snapping it", () => {
    const m = createPlaneModel();
    const first = samplePlane(m, keys({ stickBack: true }), neutralTouch(), dt, 20);
    expect(first.pitch).toBeLessThan(0);
    expect(first.pitch).toBeGreaterThan(-0.1);
    let c = first;
    for (let i = 0; i < 480; i++)
      c = samplePlane(m, keys({ stickBack: true }), neutralTouch(), dt, 20);
    expect(c.pitch).toBeCloseTo(-1, 2);
    // Let go, the stick comes back to the middle.
    for (let i = 0; i < 120; i++) c = samplePlane(m, NO_PLANE_KEYS, neutralTouch(), dt, 20);
    expect(Math.abs(c.pitch)).toBeLessThan(1e-3);
  });

  it("scales the held stick to the speed's reach", () => {
    const slow = createPlaneModel();
    const fast = createPlaneModel();
    let a = samplePlane(slow, NO_PLANE_KEYS, neutralTouch(), dt, 25);
    let b = a;
    for (let i = 0; i < 240; i++) {
      a = samplePlane(slow, keys({ stickBack: true }), neutralTouch(), dt, 25);
      b = samplePlane(fast, keys({ stickBack: true }), neutralTouch(), dt, 70);
    }
    expect(b.pitch).toBeCloseTo(a.pitch * pitchReach(70), 3);
  });

  it("moves the power lever at its rate and leaves it where it is put", () => {
    const m = createPlaneModel();
    let c = samplePlane(m, keys({ throttleUp: true }), neutralTouch(), 1, 40);
    expect(c.throttle).toBeCloseTo(THROTTLE_KEY_RATE, 6);
    c = samplePlane(m, NO_PLANE_KEYS, neutralTouch(), 1, 40);
    expect(c.throttle).toBeCloseTo(THROTTLE_KEY_RATE, 6);
    c = samplePlane(m, keys({ throttleUp: true }), neutralTouch(), 5, 40);
    expect(c.throttle).toBe(1);
  });

  it("moves the flaps a notch a press, never a notch a step", () => {
    const m = createPlaneModel();
    let c = samplePlane(m, keys({ flapsDown: true }), neutralTouch(), dt, 40);
    for (let i = 0; i < 30; i++)
      c = samplePlane(m, keys({ flapsDown: true }), neutralTouch(), dt, 40);
    expect(c.flaps).toBeCloseTo(FLAP_NOTCH, 6);
    samplePlane(m, NO_PLANE_KEYS, neutralTouch(), dt, 40);
    c = samplePlane(m, keys({ flapsDown: true }), neutralTouch(), dt, 40);
    expect(c.flaps).toBeCloseTo(2 * FLAP_NOTCH, 6);
    nudgeFlaps(m, -1);
    c = samplePlane(m, NO_PLANE_KEYS, neutralTouch(), dt, 40);
    expect(c.flaps).toBeCloseTo(FLAP_NOTCH, 6);
  });

  it("flips the screen's sides onto the engine's", () => {
    const m = createPlaneModel();
    let c = samplePlane(m, keys({ stickRight: true, rudderRight: true }), neutralTouch(), dt, 30);
    for (let i = 0; i < 120; i++) {
      c = samplePlane(m, keys({ stickRight: true, rudderRight: true }), neutralTouch(), dt, 30);
    }
    expect(Math.sign(c.roll)).toBe(SCREEN_TO_ENGINE);
    expect(Math.sign(c.yaw)).toBe(SCREEN_TO_ENGINE);
  });

  it("lets the thumb's stick own both its axes while it is down", () => {
    const m = createPlaneModel();
    const touch = { ...neutralTouch(), stick: true, stickX: 0.5, stickY: -1 };
    const c = samplePlane(m, keys({ stickForward: true }), touch, dt, 25);
    expect(c.pitch).toBeCloseTo(-1, 6);
    expect(c.roll).toBeCloseTo(0.5 * SCREEN_TO_ENGINE, 6);
  });

  it("is seated on the plane's own levers as he boards", () => {
    const m = createPlaneModel();
    seatPlaneModel(m, { throttle: 0.3, flaps: 0.3 });
    const c = samplePlane(m, NO_PLANE_KEYS, neutralTouch(), dt, 0);
    expect(c.throttle).toBeCloseTo(0.3, 6);
    expect(c.flaps).toBeCloseTo(FLAP_NOTCH, 6);
  });
});

describe("a held stick-back", () => {
  it("loops the plane from cruise on full power without crashing", () => {
    const size = 4000;
    const s = createGame({
      level: flatLevel({ size }),
      mode: "free",
      plane: true,
      crowd: 0,
      quiet: true,
    });
    planeAloft(s, { x: size / 2, y: 900, z: size / 2 - 1200, heading: 0, speed: 58, power: 1 });
    const m = createPlaneModel();
    seatPlaneModel(m, { throttle: 1, flaps: 0 });
    const p = s.plane!;
    const y0 = p.y;
    let turned = 0;
    let top = p.y;
    let crashed = false;
    for (let i = 0; i < Math.round(30 / dt) && turned < 2 * Math.PI; i++) {
      const plane = samplePlane(m, keys({ stickBack: true }), neutralTouch(), dt, p.airspeed);
      step(s, { ...NEUTRAL_INPUT, plane });
      turned += -p.wx * dt;
      top = Math.max(top, p.y);
      crashed ||= (s.events as GameEvent[]).some((e) => e.kind === "plane" && e.phase === "crash");
    }
    expect(turned).toBeGreaterThanOrEqual(2 * Math.PI);
    expect(top - y0).toBeGreaterThan(80);
    expect(crashed).toBe(false);
  });
});
