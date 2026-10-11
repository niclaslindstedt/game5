// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S COCKPIT (`plane-cockpit-plan.ts`, drawn by
// `plane-cockpit.ts`) and its lens (`camera-plane.ts`'s HELMET rung): the
// pilot sat in the left seat inside the cabin, the controls moving the way
// the plane is flown, the grips in his reach, the instruments reading the
// plane, the fov opened on a tall screen and the lens rolled with the
// airframe.

import { describe, expect, it } from "vitest";
import {
  PLANE,
  createGame,
  fromEuler,
  planeAloft,
  rotate,
  type GameState,
  type PlaneControls,
} from "@engine";

import { rollFor } from "../pwa/src/game/camera-heli.ts";
import { createPlaneCam, planeLens, type PlaneAt } from "../pwa/src/game/camera-plane.ts";
import {
  PLANE_COCKPIT,
  bodyOf,
  controlPose,
  inPlaneCabin,
  leverKnob,
  planeCockpitFov,
  planeGaugesOf,
  planeHeadOf,
  stickGrip,
} from "../pwa/src/game/plane-cockpit-plan.ts";
import { flatLevel } from "./support/synthetic.ts";

const SIZE = 4000;
const level = flatLevel({ size: SIZE });
const ground = (x: number, z: number): number => level.groundAt(x, z);

function flying(heading = 0.6): { s: GameState; at: PlaneAt } {
  const s = createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
  planeAloft(s, { x: SIZE / 2, y: 900, z: SIZE / 2, heading, speed: 50, power: 0.7 });
  const p = s.plane!;
  return { s, at: { x: p.x, y: p.y, z: p.z, q: p.q } };
}

type V = { x: number; y: number; z: number };
const dist = (a: V, b: V): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const neutral: PlaneControls = { pitch: 0, roll: 0, yaw: 0, throttle: 0.5, flaps: 0 };
const ctl = (o: Partial<PlaneControls>): PlaneControls => ({ ...neutral, ...o });

describe("the plane's cockpit", () => {
  it("sits the pilot in the left seat, inside the cabin, under the roof", () => {
    const E = PLANE_COCKPIT.eye;
    // The left seat as seen is the engine's +x.
    expect(bodyOf(E).x).toBeGreaterThan(0.2);
    expect(bodyOf(E).x).toBeCloseTo(PLANE.pilotEye.x, 6);
    expect(inPlaneCabin(bodyOf(E))).toBe(true);
    expect(E.y).toBeLessThan(PLANE_COCKPIT.roof - 0.15);
    expect(E.y - PLANE_COCKPIT.seat.top).toBeGreaterThan(0.75);
    // Behind the panel and the windscreen's foot, over the glareshield.
    expect(E.z).toBeLessThan(PLANE_COCKPIT.panel.z - 0.5);
    expect(E.y).toBeGreaterThan(PLANE_COCKPIT.panel.top + 0.2);
    // Outside the cabin is outside: the door lens, the nose, over the roof.
    expect(inPlaneCabin({ x: PLANE.door.x - 0.45, y: 2.25, z: PLANE.door.back + 0.6 })).toBe(false);
    expect(inPlaneCabin({ x: 0, y: 1.9, z: 2.5 })).toBe(false);
    expect(inPlaneCabin({ x: 0, y: 3, z: 0.5 })).toBe(false);
  });

  it("swings the stick the way the plane is flown", () => {
    const rest = stickGrip(controlPose(ctl({})));
    // Stick forward (pitch +): the grip moves forward; back: aft.
    expect(stickGrip(controlPose(ctl({ pitch: 1 }))).z).toBeGreaterThan(rest.z + 0.1);
    expect(stickGrip(controlPose(ctl({ pitch: -1 }))).z).toBeLessThan(rest.z - 0.1);
    // Roll toward the engine's +x (the pilot's left as seen): the grip goes
    // to the left as seen (−x in the cockpit's frame).
    expect(stickGrip(controlPose(ctl({ roll: 1 }))).x).toBeLessThan(rest.x - 0.05);
    expect(stickGrip(controlPose(ctl({ roll: -1 }))).x).toBeGreaterThan(rest.x + 0.05);
    // The second seat's stick moves with it.
    const a = stickGrip(controlPose(ctl({ roll: 1 })), 1);
    const b = stickGrip(controlPose(ctl({})), 1);
    expect(a.x - b.x).toBeCloseTo(stickGrip(controlPose(ctl({ roll: 1 }))).x - rest.x, 6);
  });

  it("pushes the pedal on the side the nose goes and runs the levers forward with power and flaps", () => {
    const yawed = controlPose(ctl({ yaw: 1 }));
    // Nose toward the engine's +x — the pilot's left: the left pedal forward.
    expect(yawed.pedalLeft).toBeGreaterThan(0);
    expect(yawed.pedalRight).toBeLessThan(0);
    const idle = leverKnob(controlPose(ctl({ throttle: 0 })).power);
    const full = leverKnob(controlPose(ctl({ throttle: 1 })).power);
    expect(full.z).toBeGreaterThan(idle.z + 0.1);
    const up = controlPose(ctl({ flaps: 0 })).flap;
    const down = controlPose(ctl({ flaps: 1 })).flap;
    expect(leverKnob(down, -1, PLANE_COCKPIT.flapLever.length).z).toBeGreaterThan(
      leverKnob(up, -1, PLANE_COCKPIT.flapLever.length).z,
    );
    // Trim turns the wheel both ways.
    expect(controlPose(ctl({}), 1).trim).toBeGreaterThan(0);
    expect(controlPose(ctl({}), -1).trim).toBeLessThan(0);
  });

  it("keeps the stick, the power lever and the pedals in the pilot's reach", () => {
    const Pi = PLANE_COCKPIT.pilot;
    const x0 = -PLANE_COCKPIT.seat.x;
    // The arm to the wrist, the hand to the middle of its hold and the lean
    // forward the harness's reel lets him at full forward stick.
    const arm = Pi.upperArm + Pi.forearm + 0.14;
    const leg = Pi.thigh + Pi.shin + 0.12;
    for (const o of [
      {},
      { pitch: 1 },
      { pitch: -1 },
      { roll: 1 },
      { roll: -1 },
      { pitch: -1, roll: -1 },
    ]) {
      const pose = controlPose(ctl(o));
      const grip = stickGrip(pose);
      const sh = { x: x0 - Pi.shoulder.half, y: Pi.shoulder.y, z: Pi.shoulder.z };
      expect(dist(sh, grip)).toBeLessThan(arm);
      // ...and the grip never drives into his lap.
      expect(grip.y).toBeGreaterThan(Pi.hip.y + 0.1);
    }
    for (const throttle of [0, 0.5, 1]) {
      const knob = leverKnob(controlPose(ctl({ throttle })).power);
      const sh = { x: x0 + Pi.shoulder.half, y: Pi.shoulder.y, z: Pi.shoulder.z };
      expect(dist(sh, knob)).toBeLessThan(arm);
    }
    const E = PLANE_COCKPIT.pedals;
    for (const side of [-1, 1]) {
      const hip = { x: x0 + side * Pi.hip.half, y: Pi.hip.y, z: Pi.hip.z };
      const pedal = { x: E.x + side * E.gap, y: E.y, z: E.z + E.travel };
      expect(dist(hip, pedal)).toBeLessThan(leg);
    }
  });

  it("reads the plane on the instruments", () => {
    const { s } = flying(Math.PI / 2);
    const p = s.plane!;
    const g = planeGaugesOf(p, 0, 0);
    expect(g.tas).toBeCloseTo(p.airspeed * 1.943844, 3);
    // Thinner air at height: the indicated under the true.
    expect(g.ias).toBeLessThan(g.tas);
    expect(g.alt).toBeCloseTo((p.y + PLANE.cog.y) * 3.28084, 1);
    expect(g.live).toBe(true);
    // A heading toward the engine's +x reads as seen: 270.
    expect(g.heading).toBeCloseTo(270, 0);
    // Banked toward the engine's +x (the left as seen) reads left wing down.
    const banked = planeGaugesOf({ ...p, roll: 0.5 }, 0, 0);
    expect(banked.roll).toBeLessThan(0);
    expect(planeGaugesOf({ ...p, vy: 5 }, 0, 0).vsi).toBeGreaterThan(900);
    expect(planeGaugesOf({ ...p, spin: 0 }, 0, 0).live).toBe(false);
    expect(planeGaugesOf({ ...p, stalled: 1, grounded: false }, 0, 0).stall).toBe(true);
    expect(planeGaugesOf({ ...p, door: 1 }, 0, 0).door).toBe(true);
  });

  it("turns the head a little into a turn, and not on the snow", () => {
    const { s } = flying();
    const p = s.plane!;
    expect(planeHeadOf({ ...p, wy: 0, roll: 0 }).turn).toBeCloseTo(0, 6);
    const into = planeHeadOf({ ...p, wy: 0.3, roll: 0.5 }).turn;
    expect(into).toBeGreaterThan(0);
    expect(into).toBeLessThanOrEqual(PLANE_COCKPIT.look.turnMost);
    expect(planeHeadOf({ ...p, wy: -3, roll: -1.5 }).turn).toBeCloseTo(
      -PLANE_COCKPIT.look.turnMost,
      6,
    );
    expect(planeHeadOf({ ...p, grounded: true, wy: 0.3 }).turn).toBe(0);
  });

  it("opens the fov on a tall screen and keeps its own on a wide one", () => {
    expect(planeCockpitFov(16 / 9)).toBe(PLANE_COCKPIT.fov);
    const tall = planeCockpitFov(390 / 844);
    expect(tall).toBeGreaterThan(PLANE_COCKPIT.fov);
    expect(tall).toBeLessThanOrEqual(PLANE_COCKPIT.tallMost);
    expect(planeCockpitFov(0.2)).toBe(PLANE_COCKPIT.tallMost);
  });
});

describe("the cockpit lens", () => {
  it("stands at the pilot's eye inside the cabin, looking forward over the nose", () => {
    const { s, at } = flying();
    const lens = planeLens(createPlaneCam(), s.plane!, at, "helmet", ground);
    const back = { x: -at.q.x, y: -at.q.y, z: -at.q.z, w: at.q.w };
    const eye = rotate(back, { x: lens.eye.x - at.x, y: lens.eye.y - at.y, z: lens.eye.z - at.z });
    expect(inPlaneCabin(eye)).toBe(true);
    const look = rotate(back, {
      x: lens.target.x - lens.eye.x,
      y: lens.target.y - lens.eye.y,
      z: lens.target.z - lens.eye.z,
    });
    expect(look.z).toBeGreaterThan(0.9 * Math.hypot(look.x, look.y, look.z));
    expect(look.y).toBeLessThan(0);
    expect(lens.fov).toBe(PLANE_COCKPIT.fov);
  });

  it("rolls with the airframe — level, banked and upside down", () => {
    for (const roll of [0, 0.6, -0.9, Math.PI - 0.05]) {
      const { s } = flying(0.3);
      const p = s.plane!;
      p.q = fromEuler(0.3, 0, roll);
      p.roll = roll;
      p.wy = 0;
      const at = { x: p.x, y: p.y, z: p.z, q: p.q };
      const lens = planeLens(createPlaneCam(), { ...p, roll: 0 }, at, "helmet", ground);
      const f = {
        x: lens.target.x - lens.eye.x,
        y: lens.target.y - lens.eye.y,
        z: lens.target.z - lens.eye.z,
      };
      const l = Math.hypot(f.x, f.y, f.z);
      const want = rollFor(
        { x: f.x / l, y: f.y / l, z: f.z / l },
        rotate(p.q, { x: 0, y: 1, z: 0 }),
      );
      expect(lens.roll).toBeCloseTo(want, 6);
      expect(Math.abs(Math.abs(lens.roll) - Math.abs(roll))).toBeLessThan(0.15);
    }
  });

  it("widens the cockpit lens on a tall screen", () => {
    const { s, at } = flying();
    const wide = planeLens(createPlaneCam(), s.plane!, at, "helmet", ground, 16 / 9);
    const tall = planeLens(createPlaneCam(), s.plane!, at, "helmet", ground, 390 / 844);
    expect(tall.fov).toBeGreaterThan(wide.fov);
  });
});
