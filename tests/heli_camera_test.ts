// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S LENSES (`camera-heli.ts`, `camera-crash.ts`) and THE
// FIREBALL's numbers (`fireball.ts`): a change of rung flown round the
// machine rather than cut or through it, the nose lens ahead of the
// airframe, the crash's lens cutting to a lens planted back off the wreck
// and holding on it — never after the skier — and a fireball the size and
// life the correlations give for the fuel it burns.

import { describe, expect, it } from "vitest";
import { HELI, fireballAt, type HeliState } from "@engine";

import {
  createHeliCam,
  frameHeli,
  heliLens,
  heliMiddleOf,
  orbitBlend,
  type HeliAt,
} from "../pwa/src/game/camera-heli.ts";
import { CRASH_LOOK, frameCrash, startCrashCam } from "../pwa/src/game/camera-crash.ts";
import type { LensPose } from "../pwa/src/game/camera-rigs.ts";
import { HANDOVER } from "../pwa/src/game/camera-rigs.ts";
import { BALL, createBall, fireballOf, lightBall, stepBall } from "../pwa/src/game/fireball.ts";

const flat = () => 0;
/** A machine hovering 40 m up, its nose north, going 20 m/s along it. */
const heli = { vx: 0, vy: 0, vz: 20, roll: 0 } as HeliState;
const at: HeliAt = { x: 0, y: 40, z: 0, heading: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
const gap = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("the helicopter's lens", () => {
  it("puts the nose lens on TIPS, ahead of the airframe and looking down", () => {
    const cam = createHeliCam();
    const l = heliLens(cam, heli, at, "tips", flat);
    expect(l.eye.z).toBeGreaterThan(HELI.body.nose);
    expect(l.target.z).toBeGreaterThan(l.eye.z);
    expect(l.target.y).toBeLessThan(l.eye.y);
    const down = (p: LensPose) => (p.eye.y - p.target.y) / gap(p.eye, p.target);
    expect(down(l)).toBeGreaterThan(0.4);
  });

  it("sits the HELMET lens in the cockpit, behind the nose", () => {
    const h = { ...heli, heading: 0, pitch: 0, yawRate: 0 } as HeliState;
    const l = heliLens(createHeliCam(), h, at, "helmet", flat);
    expect(l.eye.z).toBeLessThan(HELI.body.nose);
    expect(l.target.z).toBeGreaterThan(l.eye.z);
  });

  it("flies a change of rung over HANDOVER s, never cutting, never through the machine", () => {
    const cam = createHeliCam();
    const dt = 1 / 60;
    let last = frameHeli(cam, heli, at, "chase", dt, flat);
    for (let i = 0; i < 30; i++) last = frameHeli(cam, heli, at, "chase", dt, flat);
    const middle = heliMiddleOf(at);
    let most = 0;
    let least = Infinity;
    const steps = Math.ceil(HANDOVER / dt) + 2;
    for (let i = 0; i < steps; i++) {
      const lens = frameHeli(cam, heli, at, "tips", dt, flat);
      most = Math.max(most, gap(lens.eye, last.eye));
      if (i > 2 && i < steps - 4) least = Math.min(least, gap(lens.eye, middle));
      last = lens;
    }
    // No frame jumps the eye as a cut would (the chase stands 15 m back).
    expect(most).toBeLessThan(2);
    // Round the rotor, never through the cabin.
    expect(least).toBeGreaterThan(HELI.rotor.radius * 0.8);
    expect(gap(last.eye, heliLens(cam, heli, at, "tips", flat).eye)).toBeLessThan(1e-6);
  });

  it("cuts a change of rung asked to be cut", () => {
    const cam = createHeliCam();
    frameHeli(cam, heli, at, "chase", 1 / 60, flat);
    frameHeli(cam, heli, at, "chase", 1 / 60, flat);
    cam.cut = true;
    const lens = frameHeli(cam, heli, at, "far", 1 / 60, flat);
    expect(gap(lens.eye, heliLens(cam, heli, at, "far", flat).eye)).toBeLessThan(1e-6);
  });

  it("orbits a hand-over the short way round, ending on each lens to the figure", () => {
    const c = { x: 0, y: 0, z: 0 };
    const a: LensPose = { eye: { x: 0, y: 3, z: -15 }, target: c, fov: 60, roll: 0 };
    const b: LensPose = {
      eye: { x: 0, y: 1, z: 5 },
      target: { x: 0, y: 0, z: 30 },
      fov: 74,
      roll: 0,
    };
    expect(gap(orbitBlend(a, b, 0, c).eye, a.eye)).toBeLessThan(1e-9);
    const end = orbitBlend(a, b, 1, c);
    expect(gap(end.eye, b.eye)).toBeLessThan(1e-9);
    const mid = orbitBlend(a, b, 0.5, c);
    expect(Math.hypot(mid.eye.x, mid.eye.z)).toBeGreaterThan(7 - 1e-9);
  });
});

describe("the crash's lens", () => {
  const from: LensPose = {
    eye: { x: 0, y: 45, z: -15 },
    target: { x: 0, y: 41, z: 8 },
    fov: 60,
    roll: 0.1,
  };
  const wreck = { x: 0, y: 0, z: 0 };
  const ball = fireballOf(BALL.fuel * BALL.share);

  it("cuts on the impact to a lens planted on the side it was on, the whole fire in frame", () => {
    const cam = startCrashCam(from, wreck, flat);
    const lens = frameCrash(cam, wreck, 1 / 60, flat);
    // Back off the wreck far enough to hold the ball and the column.
    const off = Math.hypot(lens.eye.x - wreck.x, lens.eye.z - wreck.z);
    expect(off).toBeGreaterThan(ball.diameter * 1.2);
    expect(off).toBeGreaterThanOrEqual(CRASH_LOOK.least - 1);
    // On the side the lens on screen stood, low over the snow.
    expect(lens.eye.z).toBeLessThan(0);
    expect(lens.eye.y).toBeGreaterThan(0);
    expect(lens.eye.y).toBeLessThan(CRASH_LOOK.height + 1);
    expect(lens.roll).toBe(0);
    // Looking at the fire.
    expect(Math.hypot(lens.target.x - wreck.x, lens.target.z - wreck.z)).toBeLessThan(2);
  });

  it("holds on the wreck whatever the skier does: a slow push, the look rising with the smoke", () => {
    const cam = startCrashCam(from, wreck, flat);
    const first = frameCrash(cam, wreck, 1 / 60, flat);
    let lens = first;
    for (let t = 0; t < 7; t += 1 / 60) lens = frameCrash(cam, wreck, 1 / 60, flat);
    expect(gap(lens.eye, wreck)).toBeLessThan(gap(first.eye, wreck));
    expect(gap(lens.eye, wreck)).toBeGreaterThan(CRASH_LOOK.nearest - 1);
    expect(lens.target.y).toBeGreaterThan(first.target.y + 8);
    expect(Math.hypot(lens.target.x - wreck.x, lens.target.z - wreck.z)).toBeLessThan(2);
  });

  it("is never inside the fireball", () => {
    const cam = startCrashCam(from, wreck, flat);
    for (let t = 0; t < 7; t += 1 / 60) {
      const lens = frameCrash(cam, wreck, 1 / 60, flat);
      const b = fireballAt(cam.t);
      expect(gap(lens.eye, { x: wreck.x, y: wreck.y + b.height, z: wreck.z })).toBeGreaterThan(
        b.radius + 4,
      );
    }
  });

  it("turns round off a trunk in the way, and rises over a rise of the snow", () => {
    // Trees everywhere on the lens's own side (z < 0).
    const woods = (eye: { x: number; z: number }) => eye.z < 0;
    const cam = startCrashCam(from, wreck, flat, woods);
    const lens = frameCrash(cam, wreck, 1 / 60, flat);
    expect(lens.eye.z).toBeGreaterThan(0);
    // A ridge between the side it was on and the wreck.
    const ridge = (x: number, z: number) => (Math.abs(z + 20) < 6 ? 12 : 0) + x * 0;
    const over = startCrashCam(from, wreck, ridge, () => false);
    expect(over.lift + over.bearing * 0).toBeGreaterThanOrEqual(CRASH_LOOK.height);
    const l2 = frameCrash(over, wreck, 1 / 60, ridge);
    // It sees: the snow nowhere over the line to the fire.
    for (let k = 0.05; k < 0.95; k += 0.05) {
      const x = l2.eye.x + (wreck.x - l2.eye.x) * k;
      const z = l2.eye.z + (wreck.z - l2.eye.z) * k;
      const y = l2.eye.y + (wreck.y + CRASH_LOOK.lookLow - l2.eye.y) * k;
      expect(y).toBeGreaterThan(ridge(x, z));
    }
  });

  it("is thrown about by the shock as it arrives, then settles", () => {
    const cam = startCrashCam(from, wreck, flat);
    const still = { ...cam };
    const a = frameCrash(cam, wreck, cam.shock + 0.05, flat);
    const b = frameCrash({ ...still }, wreck, cam.shock - 0.01, flat);
    expect(a.fov).toBeGreaterThan(b.fov);
  });

  it("never stands under the snow", () => {
    const hill = (x: number) => 60 + x * 0.5;
    const cam = startCrashCam(from, wreck, hill);
    for (let t = 0; t < 5; t += 1 / 60) {
      const lens = frameCrash(cam, wreck, 1 / 60, hill);
      expect(lens.eye.y).toBeGreaterThan(hill(lens.eye.x));
    }
  });
});

describe("the fireball", () => {
  it("is the size and life the fireball correlations give for its fuel", () => {
    const { diameter, life } = fireballOf(100);
    expect(diameter).toBeCloseTo(5.8 * Math.cbrt(100), 6);
    expect(life).toBeCloseTo(0.45 * Math.cbrt(100), 6);
    // A light helicopter's: some 25–30 m across for some two seconds.
    const heli = fireballOf(BALL.fuel * BALL.share);
    expect(heli.diameter).toBeGreaterThan(24);
    expect(heli.diameter).toBeLessThan(32);
    expect(heli.life).toBeGreaterThan(1.6);
    expect(heli.life).toBeLessThan(3);
  });

  it("lifts off, rises and burns out into smoke, every lobe of it", () => {
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ball = createBall();
    const { diameter, life } = fireballOf(BALL.fuel * BALL.share);
    lightBall(ball, 0, 0, 0, diameter / 2, 0, 0, 1, random);
    let smoke = 0;
    const dt = 1 / 60;
    let t = 0;
    for (; t < life * 3 && ball.live; t += dt) {
      stepBall(ball, dt, t, () => smoke++, random);
      if (t < life * BALL.lift * 0.9) expect(ball.vy).toBe(0);
    }
    expect(ball.live).toBe(false);
    expect(ball.y).toBeGreaterThan(diameter / 2);
    expect(smoke).toBeGreaterThanOrEqual(BALL.lobes);
  });
});
