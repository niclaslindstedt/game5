// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON THE JUMP PLANE (`pwa/src/game/camera-plane.ts`): the booms
// behind and over it, the door lens out of the door on the door's side,
// the cockpit at the pilot's eye rolled with the airframe, every boom clear
// of the snow, and a change of rung flown round the airframe — never
// through it.

import { describe, expect, it } from "vitest";
import { PLANE, createGame, planeAloft, rotate, type GameState } from "@engine";

import {
  PLANE_LOOK,
  createPlaneCam,
  framePlane,
  planeLens,
  planeMiddleOf,
  type PlaneAt,
} from "../pwa/src/game/camera-plane.ts";
import { HANDOVER } from "../pwa/src/game/camera-rigs.ts";
import type { CameraRung } from "../pwa/src/game/renderer-api.ts";
import { flatLevel } from "./support/synthetic.ts";

const SIZE = 4000;
const level = flatLevel({ size: SIZE });
const ground = (x: number, z: number): number => level.groundAt(x, z);

function flying(y = 900, heading = 0.6): { s: GameState; at: PlaneAt } {
  const s = createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
  planeAloft(s, { x: SIZE / 2, y, z: SIZE / 2, heading, speed: 50, power: 0.7 });
  const p = s.plane!;
  return { s, at: { x: p.x, y: p.y, z: p.z, q: p.q } };
}

type V = { x: number; y: number; z: number };
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dist = (a: V, b: V): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
/** A world point in the airframe's body frame, off its ground datum. */
const body = (at: PlaneAt, w: V): V =>
  rotate({ x: -at.q.x, y: -at.q.y, z: -at.q.z, w: at.q.w }, sub(w, at));

const RUNGS: CameraRung[] = ["tips", "helmet", "chase", "far", "high", "orbit"];

describe("the plane's lenses", () => {
  it("frames every rung with a finite lens", () => {
    const { s, at } = flying();
    const cam = createPlaneCam();
    for (const rung of RUNGS) {
      const lens = framePlane(cam, s.plane!, at, rung, 1 / 60, ground);
      for (const v of [lens.eye.x, lens.eye.y, lens.eye.z, lens.target.x, lens.fov, lens.roll]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it("stands the chase behind the tail, over it and out to the door's side", () => {
    const { s, at } = flying();
    const lens = planeLens(createPlaneCam(), s.plane!, at, "chase", ground);
    // Fresh booms frame along the default; step them onto the airframe.
    const cam = createPlaneCam();
    framePlane(cam, s.plane!, at, "chase", 1 / 60, ground);
    const settled = planeLens(cam, s.plane!, at, "chase", ground);
    const b = body(at, settled.eye);
    expect(b.z).toBeLessThan(-PLANE_LOOK.chase.dist + 2);
    expect(b.y).toBeGreaterThan(PLANE.cog.y);
    expect(Math.sign(b.x)).toBe(Math.sign(PLANE.door.x));
    expect(Number.isFinite(lens.eye.x)).toBe(true);
  });

  it("holds the door lens just outside the door, looking out and down", () => {
    const { s, at } = flying();
    const lens = planeLens(createPlaneCam(), s.plane!, at, "tips", ground);
    const eye = body(at, lens.eye);
    expect(Math.sign(eye.x)).toBe(Math.sign(PLANE.door.x));
    expect(Math.abs(eye.x)).toBeGreaterThan(Math.abs(PLANE.door.x));
    const look = body(at, {
      x: at.x + (lens.target.x - lens.eye.x),
      y: at.y + (lens.target.y - lens.eye.y),
      z: at.z + (lens.target.z - lens.eye.z),
    });
    expect(look.y).toBeLessThan(0);
    expect(Math.sign(look.x)).toBe(Math.sign(PLANE.door.x));
    expect(look.z).toBeGreaterThan(0);
  });

  it("puts the cockpit lens at the pilot's eye, looking forward", () => {
    const { s, at } = flying();
    const lens = planeLens(createPlaneCam(), s.plane!, at, "helmet", ground);
    const eye = body(at, lens.eye);
    expect(eye.x).toBeCloseTo(PLANE.pilotEye.x, 6);
    expect(eye.y).toBeCloseTo(PLANE.pilotEye.y, 6);
    expect(eye.z).toBeCloseTo(PLANE.pilotEye.z, 6);
  });

  it("keeps every boom clear of the snow with the plane down low", () => {
    const { s, at } = flying(level.groundAt(SIZE / 2, SIZE / 2) + 3);
    const cam = createPlaneCam();
    for (const rung of ["chase", "far", "high", "orbit"] as CameraRung[]) {
      const lens = framePlane(cam, s.plane!, at, rung, 1 / 60, ground);
      expect(lens.eye.y).toBeGreaterThanOrEqual(
        ground(lens.eye.x, lens.eye.z) + PLANE_LOOK.clearance - 1e-6,
      );
    }
  });

  it("flies a change of rung round the airframe, clear of its wings", () => {
    const { s, at } = flying();
    const middle = planeMiddleOf(at);
    for (const [a, b] of [
      ["chase", "far"],
      ["far", "chase"],
      ["chase", "orbit"],
      ["high", "chase"],
    ] as [CameraRung, CameraRung][]) {
      const cam = createPlaneCam();
      framePlane(cam, s.plane!, at, a, 1 / 60, ground);
      const dt = HANDOVER / 20;
      for (let i = 0; i < 22; i++) {
        const lens = framePlane(cam, s.plane!, at, b, dt, ground);
        expect(dist(lens.eye, middle)).toBeGreaterThanOrEqual(PLANE_LOOK.orbitLeast - 1e-6);
      }
    }
  });

  it("opens the booms and lets them out on a tall screen, the wingspan across", () => {
    const { s, at } = flying();
    const cam = createPlaneCam();
    framePlane(cam, s.plane!, at, "chase", 1 / 60, ground);
    const wide = planeLens(cam, s.plane!, at, "chase", ground, 16 / 9);
    const tall = planeLens(cam, s.plane!, at, "chase", ground, 390 / 844);
    const middle = planeMiddleOf(at);
    expect(tall.fov).toBeGreaterThan(wide.fov);
    expect(dist(tall.eye, middle)).toBeGreaterThan(dist(wide.eye, middle));
    const half = Math.tan((tall.fov / 2) * (Math.PI / 180)) * (390 / 844);
    expect(half * dist(tall.eye, middle)).toBeGreaterThanOrEqual(PLANE.wing.span / 2);
  });
});
