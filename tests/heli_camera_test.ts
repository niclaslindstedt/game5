// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S LENSES (`camera-heli.ts`, `camera-crash.ts`) and THE
// FIREBALL's numbers (`fireball.ts`): a change of rung flown round the
// machine rather than cut or through it, the nose lens ahead of the
// airframe, the crash's lens taking over from the lens on screen to the
// figure and pulling back from it — and a fireball the size and life the
// correlations give for the fuel it burns.

import { describe, expect, it } from "vitest";
import { HELI, type HeliState } from "@engine";

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
  it("puts the nose lens ahead of the airframe, looking on along the nose", () => {
    const cam = createHeliCam();
    for (const rung of ["tips", "helmet"] as const) {
      const l = heliLens(cam, heli, at, rung, flat);
      expect(l.eye.z).toBeGreaterThan(HELI.body.nose);
      expect(l.target.z).toBeGreaterThan(l.eye.z);
      expect(l.target.y).toBeLessThan(l.eye.y);
    }
    // The look-down lens looks further down than the bolted one.
    const tips = heliLens(cam, heli, at, "tips", flat);
    const helmet = heliLens(cam, heli, at, "helmet", flat);
    const down = (l: LensPose) => (l.eye.y - l.target.y) / gap(l.eye, l.target);
    expect(down(helmet)).toBeGreaterThan(down(tips));
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
  const wreck = { x: 0, y: 2, z: 0 };

  it("takes over from the lens on screen without a jump, and pulls back from it", () => {
    const cam = startCrashCam(from, wreck);
    const first = frameCrash(cam, wreck, null, 1 / 60, flat);
    expect(gap(first.eye, from.eye)).toBeLessThan(0.6);
    let lens = first;
    for (let t = 0; t < CRASH_LOOK.pull + 1; t += 1 / 60) {
      lens = frameCrash(cam, wreck, null, 1 / 60, flat);
    }
    expect(gap(lens.eye, wreck)).toBeGreaterThan(CRASH_LOOK.dist * 0.9);
    // Settled looking at the crash, from over the snow.
    expect(gap(lens.target, wreck)).toBeLessThan(CRASH_LOOK.overMost + 1);
    expect(lens.eye.y).toBeGreaterThan(wreck.y);
    expect(lens.roll).toBeCloseTo(0, 6);
  });

  it("draws further back the further the blast threw the skier", () => {
    const near = startCrashCam(from, wreck);
    const far = startCrashCam(from, wreck);
    let a = frameCrash(near, wreck, { x: 5, y: 1, z: 0 }, 1 / 60, flat);
    let b = frameCrash(far, wreck, { x: 45, y: 1, z: 0 }, 1 / 60, flat);
    // Up to the close-in on him, which takes over from the pull-back.
    for (let t = 0; t < CRASH_LOOK.zoomLate - 0.1; t += 1 / 60) {
      a = frameCrash(near, wreck, { x: 5, y: 1, z: 0, vy: 9 }, 1 / 60, flat);
      b = frameCrash(far, wreck, { x: 45, y: 1, z: 0, vy: 9 }, 1 / 60, flat);
    }
    expect(gap(b.eye, b.target)).toBeGreaterThan(gap(a.eye, a.target) + 10);
  });

  it("closes in on the skier near his apex and rides his path down", () => {
    const cam = startCrashCam(from, wreck);
    const dt = 1 / 60;
    // Flung up at 12 m/s and out along +x at 14 m/s off the wreck.
    const at = (t: number) => ({
      x: 14 * t,
      y: 2 + 12 * t - 4.9 * t * t,
      z: 0,
      vx: 14,
      vy: 12 - 9.81 * t,
      vz: 0,
    });
    const apex = 12 / 9.81;
    let lens = from;
    let wide = Infinity;
    const fovs: number[] = [];
    for (let t = dt; t <= 2.3; t += dt) {
      lens = frameCrash(cam, wreck, at(t), dt, flat);
      if (t < CRASH_LOOK.zoomFrom) expect(cam.zoomAt).toBeNull();
      if (Math.abs(t - 0.5) < dt / 2) wide = gap(lens.eye, at(t));
      if (Math.abs(t - apex) < dt / 2) {
        // Begun before the apex, and nearer him at it.
        expect(cam.zoomAt).not.toBeNull();
        expect(cam.zoomAt!).toBeLessThan(apex);
        expect(gap(lens.eye, at(t))).toBeLessThan(wide);
      }
      if (t > 1.6) fovs.push(lens.fov);
    }
    // A tracking shot: close behind him along his way, off to his side,
    // looking ahead of him down it — carried with him, a little behind.
    const end = at(2.3);
    expect(lens.eye.x).toBeLessThan(end.x);
    expect(end.x - lens.eye.x).toBeLessThan(CRASH_LOOK.back * 2.5);
    expect(Math.abs(lens.eye.z)).toBeGreaterThan(CRASH_LOOK.side * 0.5);
    expect(lens.target.x).toBeGreaterThan(end.x);
    expect(gap(lens.eye, end)).toBeLessThan(15);
    expect(lens.eye.y).toBeGreaterThan(flat());
    // Wider and tilted the faster he falls.
    expect(fovs[fovs.length - 1]).toBeGreaterThan(fovs[0]);
    expect(fovs[fovs.length - 1]).toBeGreaterThan(CRASH_LOOK.fov);
    expect(Math.abs(lens.roll)).toBeGreaterThan(0.05);
  });

  it("throws a lens at the impact itself back out of the fireball at once", () => {
    const nose: LensPose = {
      eye: { x: 0, y: 3, z: 1 },
      target: { x: 0, y: -2, z: 31 },
      fov: 74,
      roll: 0,
    };
    const cam = startCrashCam(nose, wreck);
    let lens = nose;
    for (let t = 0; t < CRASH_LOOK.flinchFor; t += 1 / 60) {
      lens = frameCrash(cam, wreck, null, 1 / 60, flat);
    }
    expect(gap(lens.eye, wreck)).toBeGreaterThan(CRASH_LOOK.flinch * 0.8);
    // Back the way it was looking from.
    expect(lens.eye.z).toBeLessThan(0);
  });

  it("never stands under the snow", () => {
    const hill = (x: number) => 60 + x * 0.5;
    const cam = startCrashCam(from, wreck);
    for (let t = 0; t < 5; t += 1 / 60) {
      const lens = frameCrash(cam, wreck, null, 1 / 60, hill);
      if (t > 0.5) expect(lens.eye.y).toBeGreaterThan(hill(lens.eye.x));
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
