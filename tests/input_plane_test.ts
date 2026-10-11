// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE FLOWN BY HAND (`pwa/src/game/input-plane.ts`): the stick
// eased on a held key and scaled with the airspeed, the levers left where
// they are put, the flaps a notch a press, the screen's sides flipped onto
// the engine's, the pull eased off at the buffet — and the aerobatics a
// player throws on the keys (a loop over the top from a dive, low and high
// over a generated map's strip, an aileron roll, a hammerhead, inverted
// flight, a spin and its recovery) flown on the physics alone.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  TUNING,
  airstripOf,
  createGame,
  planeAloft,
  step,
  type GameEvent,
  type GameState,
  type Level,
  type PlaneState,
} from "@engine";

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
  type PlaneModel,
} from "../pwa/src/game/input-plane.ts";
import { SCREEN_TO_ENGINE, neutralTouch } from "../pwa/src/game/input-model.ts";
import { levelFor } from "./support/levels.ts";
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
    expect(rollReach(60)).toBe(1);
    expect(rollReach(80)).toBeCloseTo(60 / 80, 6);
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

// THE PLAYER'S HAND IN THE AIR: the keys a human holds, through
// `samplePlane`, flown on the physics alone (`make plane-flight`'s p-rows).
type Hand = { s: GameState; m: PlaneModel; crashed: boolean };
function hand(
  level: Level,
  x: number,
  y: number,
  z: number,
  heading: number,
  speed: number,
  throttle = 1,
): Hand {
  const s = createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
  planeAloft(s, { x, y, z, heading, speed, power: throttle });
  const m = createPlaneModel();
  seatPlaneModel(m, { throttle, flaps: 0 });
  return { s, m, crashed: false };
}
function press(h: Hand, k: Partial<PlaneKeysHeld>): void {
  const p = h.s.plane!;
  const plane = samplePlane(h.m, keys(k), neutralTouch(), dt, p.airspeed, p.stalled);
  step(h.s, { ...NEUTRAL_INPUT, plane });
  h.crashed ||= (h.s.events as GameEvent[]).some((e) => e.kind === "plane" && e.phase === "crash");
}
/** The aileron keys a human taps to bring the bank to `want`. */
function wings(p: PlaneState, want = 0): Partial<PlaneKeysHeld> {
  const err = Math.atan2(Math.sin(p.roll - want), Math.cos(p.roll - want)) * SCREEN_TO_ENGINE;
  return { stickLeft: err > 0.05, stickRight: err < -0.05 };
}
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const SIZE = 4000;

/** Full power, pushed into a dive to 120 kt with the wings levelled, then
 * the stick held back: the flight path's turn in the vertical, the bank
 * it came out at, and whether it crashed. */
function loopByHand(level: Level, x: number, z: number, heading: number, height: number) {
  const h = hand(level, x, level.groundAt(x, z) + height, z, heading, 50);
  const p = h.s.plane!;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const path = (): number => Math.atan2(p.vy, p.vx * fx + p.vz * fz);
  for (let i = 0; i < Math.round(40 / dt) && p.airspeed < 120 / 1.943844; i++)
    press(h, { stickForward: true, ...wings(p) });
  let last = path();
  let turned = 0;
  let top = p.y;
  const y0 = p.y;
  for (let i = 0; i < Math.round(40 / dt) && Math.abs(turned) < 2 * Math.PI; i++) {
    press(h, { stickBack: true });
    const a = path();
    turned += wrap(a - last);
    last = a;
    top = Math.max(top, p.y);
  }
  return { turned, gained: top - y0, bank: Math.abs(p.roll), crashed: h.crashed };
}

describe("a held stick-back", () => {
  it("loops the plane over the top from a dive on full power", () => {
    const L = loopByHand(flatLevel({ size: SIZE }), SIZE / 2, SIZE / 2 - 1200, 0, 600);
    // Over the top and round in the vertical — not a wingover's turn.
    expect(L.turned).toBeGreaterThanOrEqual(2 * Math.PI - 0.02);
    expect(L.gained).toBeGreaterThan(40);
    expect(L.bank).toBeLessThan(0.35);
    expect(L.crashed).toBe(false);
  });

  it("loops it over a generated map's strip, in the edge's band, low and high", () => {
    const level = levelFor(38);
    const strip = airstripOf(level);
    for (const height of [300, 2500]) {
      const L = loopByHand(level, strip.start.x, strip.start.z, strip.heading, height);
      expect(L.turned).toBeGreaterThanOrEqual(2 * Math.PI - 0.02);
      expect(L.bank).toBeLessThan(0.6);
      expect(L.crashed).toBe(false);
    }
  });
});

describe("aerobatics by hand", () => {
  const at = (speed: number, throttle = 1, y = 1500): Hand =>
    hand(flatLevel({ size: SIZE }), SIZE / 2, y, SIZE / 2 - 1200, 0, speed, throttle);

  it("rolls round on the stick held full over", () => {
    const h = at(58);
    const p = h.s.plane!;
    for (let i = 0; i < Math.round(4 / dt) && p.pitch < 0.3; i++) press(h, { stickBack: true });
    let rolled = 0;
    let t = 0;
    while (Math.abs(rolled) < 2 * Math.PI && t < 9) {
      press(h, { stickRight: true });
      rolled += p.wz * dt;
      t += dt;
    }
    expect(Math.abs(rolled)).toBeGreaterThanOrEqual(2 * Math.PI);
    expect(h.crashed).toBe(false);
  });

  it("turns a hammerhead on the rudder at the top of a vertical climb", () => {
    const h = at(62);
    const p = h.s.plane!;
    const h0 = p.heading;
    let phase = "pull";
    for (let i = 0; i < Math.round(40 / dt); i++) {
      let k: Partial<PlaneKeysHeld> = {};
      if (phase === "pull") {
        k = { stickBack: true };
        if (p.pitch > 1.4) phase = "hold";
      } else if (phase === "hold") {
        k = { stickForward: p.pitch > 1.5, stickBack: p.pitch < 1.35, ...wings(p) };
        if (p.airspeed < 30) phase = "kick";
      } else if (phase === "kick") {
        k = { rudderLeft: true, ...wings(p) };
        if (p.pitch < -0.9) phase = "down";
      } else {
        k = { stickBack: p.pitch < -0.3 };
        if (p.pitch > -0.1) break;
      }
      press(h, k);
    }
    expect(phase).toBe("down");
    expect(Math.abs(wrap(p.heading - h0))).toBeGreaterThan(2.6);
    expect(h.crashed).toBe(false);
  });

  it("flies on its back on the push", () => {
    const h = at(58);
    const p = h.s.plane!;
    for (let i = 0; i < Math.round(4 / dt) && p.pitch < 0.25; i++) press(h, { stickBack: true });
    for (let t = 0; Math.abs(p.roll) < 2.9 && t < 6; t += dt) press(h, { stickRight: true });
    const y0 = p.y;
    let low = p.y;
    let upside = 0;
    for (let i = 0; i < Math.round(10 / dt); i++) {
      press(h, { stickForward: p.vy < 0, ...wings(p, Math.PI) });
      low = Math.min(low, p.y);
      if (Math.abs(p.roll) > 2.6) upside += dt;
    }
    expect(upside).toBeGreaterThan(9);
    expect(y0 - low).toBeLessThan(100);
  });

  it("eases a held pull off at the buffet, and goes through it with full rudder", () => {
    const m = createPlaneModel();
    let c = samplePlane(m, keys({ stickBack: true }), neutralTouch(), dt, 25, 0);
    for (let i = 0; i < 120; i++)
      c = samplePlane(m, keys({ stickBack: true }), neutralTouch(), dt, 25, 0.4);
    expect(c.pitch).toBeGreaterThan(-0.5);
    for (let i = 0; i < 360; i++)
      c = samplePlane(m, keys({ stickBack: true, rudderLeft: true }), neutralTouch(), dt, 25, 0.4);
    expect(c.pitch).toBeCloseTo(-1, 2);
  });

  it("spins on full rudder held with the stall, and recovers on opposite rudder and a push", () => {
    const h = at(45, 0, 2000);
    const p = h.s.plane!;
    let phase = "slow";
    let yawed = 0;
    for (let i = 0; i < Math.round(80 / dt) && phase !== "out"; i++) {
      let k: Partial<PlaneKeysHeld> = {};
      if (phase === "slow") {
        k = { stickBack: true, ...wings(p) };
        if (p.stalled > 0.3) phase = "spin";
      } else if (phase === "spin") {
        k = { stickBack: true, rudderLeft: true };
        yawed += p.wy * dt;
        if (Math.abs(yawed) > 4 * Math.PI) phase = "recover";
      } else {
        k = { rudderRight: Math.abs(p.wy) > 0.3, stickForward: true };
        if (p.stalled < 0.05 && Math.abs(p.wy) < 0.3) phase = "out";
      }
      press(h, k);
    }
    expect(phase).toBe("out");
    expect(h.crashed).toBe(false);
  });
});
