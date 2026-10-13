// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RIDER SOLVED ON HIS BIKE (`bike-rider-ik.ts`): every joint
// put by inverse kinematics off the engine's bike and rider — the fists on
// the grips, the balls of the feet on the pedals, every bone its own length,
// the knees and the elbows bent and out in the attack stance, the heels
// dropped, and the trunk folded as far as it takes to reach the bar —
// ridden down a real trail by the bot, step by step.
import { describe, expect, it } from "vitest";
import { bikeAim, bikePilot, bikePose, NEUTRAL_INPUT, step, type BikePose } from "@engine";

import { gripsAt, pedalsAt } from "../pwa/src/game/bike-look.ts";
import {
  RIDER,
  createRiderDynamics,
  solveRider,
  twoBone,
  type RiderJoints,
} from "../pwa/src/game/bike-rider-ik.ts";
import { bikeRun, summerMap } from "./support/bike-bot.ts";

type P = { x: number; y: number; z: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const angle = (a: P, j: P, b: P): number => {
  const u = { x: a.x - j.x, y: a.y - j.y, z: a.z - j.z };
  const w = { x: b.x - j.x, y: b.y - j.y, z: b.z - j.z };
  const d =
    (u.x * w.x + u.y * w.y + u.z * w.z) / (Math.hypot(u.x, u.y, u.z) * Math.hypot(w.x, w.y, w.z));
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
};

/** Poses of the bot riding seed 38's first trail, a few a second. */
function ridden(): BikePose[] {
  let s = bikeRun(summerMap(38));
  const aim = bikeAim(s);
  const out: BikePose[] = [];
  for (let i = 0; i < 120 * 14; i++) {
    const input = s.bike ? bikePilot(s, aim) : NEUTRAL_INPUT;
    s = step(s, input);
    if (i % 30 === 0 && s.bike?.onIt && !s.skier.thrown) out.push(bikePose(s.bike));
  }
  return out;
}

const POSES = ridden();
const SOLVED: RiderJoints[] = POSES.map((p) => solveRider(p));

describe("the rider solved on the bike (bike-rider-ik.ts)", () => {
  it("is ridden: the bot gives a spread of poses down the trail", () => {
    expect(POSES.length).toBeGreaterThan(30);
  });

  it("keeps every bone its own length", () => {
    for (const j of SOLVED) {
      for (const i of [0, 1] as const) {
        expect(dist(j.hips[i], j.knees[i])).toBeCloseTo(RIDER.thigh, 3);
        expect(dist(j.knees[i], j.ankles[i])).toBeCloseTo(RIDER.shin, 3);
        expect(dist(j.shoulders[i], j.elbows[i])).toBeCloseTo(RIDER.upperArm, 3);
        expect(dist(j.elbows[i], j.hands[i])).toBeCloseTo(RIDER.forearm, 3);
      }
    }
  });

  it("has his fists round the grips and his feet on the pedals", () => {
    for (let n = 0; n < POSES.length; n++) {
      const p = POSES[n];
      const j = SOLVED[n];
      const g = gripsAt(p.steer);
      const pd = pedalsAt(p.crank);
      for (const i of [0, 1] as const) {
        expect(dist(j.hands[i], g[i])).toBeLessThan(0.01);
        // The ankle reaches its place over the pedal: the ball of the foot
        // stands on the platform.
        expect(dist(j.balls[i], pd[i])).toBeLessThan(0.04);
      }
    }
  });

  it("stands in the attack stance: knees and elbows bent, out, the trunk forward", () => {
    const knees: number[] = [];
    const elbows: number[] = [];
    const pitch: number[] = [];
    for (const j of SOLVED) {
      for (const i of [0, 1] as const) {
        knees.push(angle(j.hips[i], j.knees[i], j.ankles[i]));
        elbows.push(angle(j.shoulders[i], j.elbows[i], j.hands[i]));
        // Out: each knee and elbow further from the middle than its root.
        expect(Math.abs(j.knees[i].x)).toBeGreaterThan(Math.abs(j.hips[i].x) - 0.01);
        expect(Math.abs(j.elbows[i].x)).toBeGreaterThan(Math.abs(j.shoulders[i].x));
      }
      pitch.push((Math.atan2(j.trunk.up.z, j.trunk.up.y) * 180) / Math.PI);
    }
    const mid = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
    // The coaching's flexed stance: never locked, never squatted flat.
    expect(Math.max(...knees)).toBeLessThan(172);
    expect(mid(knees)).toBeGreaterThan(110);
    expect(mid(knees)).toBeLessThan(165);
    expect(mid(elbows)).toBeGreaterThan(115);
    expect(mid(elbows)).toBeLessThan(165);
    // The chest low over the stem.
    expect(mid(pitch)).toBeGreaterThan(30);
    expect(mid(pitch)).toBeLessThan(75);
  });

  it("drops his heels below the balls of his feet", () => {
    for (const j of SOLVED)
      for (const i of [0, 1] as const) expect(j.ankles[i].y).toBeGreaterThan(j.balls[i].y);
  });

  it("holds his head up and looks ahead down the trail", () => {
    for (const j of SOLVED) {
      expect(j.face.z).toBeGreaterThan(0.6);
      expect(j.head.y).toBeGreaterThan(j.neck.y);
    }
  });

  it("lags the frame's accelerations on a damped spring that settles", () => {
    const d = createRiderDynamics();
    let lag = d.step({ x: 0, y: 40, z: 0 }, 0, 1 / 60);
    for (let i = 0; i < 6; i++) lag = d.step({ x: 0, y: 40, z: 0 }, 0, 1 / 60);
    expect(lag.pelvis.y).toBeLessThan(0);
    for (let i = 0; i < 240; i++) lag = d.step({ x: 0, y: 0, z: 0 }, 0, 1 / 60);
    expect(Math.abs(lag.pelvis.y)).toBeLessThan(1e-3);
  });

  it("solves a two-bone limb onto a reachable target exactly", () => {
    const [mid, end] = twoBone({ x: 0, y: 0, z: 0 }, { x: 0, y: -0.7, z: 0.2 }, 0.44, 0.46, {
      x: 0,
      y: 0,
      z: 1,
    });
    expect(dist(end, { x: 0, y: -0.7, z: 0.2 })).toBeLessThan(1e-9);
    expect(mid.z).toBeGreaterThan(0.2);
  });

  it("prints the stance (for the lab's table)", () => {
    const rows = SOLVED.slice(0, 40).map((j, n) => {
      const k = [0, 1].map((i) => angle(j.hips[i], j.knees[i], j.ankles[i]).toFixed(0)).join("/");
      const e = angle(j.shoulders[0], j.elbows[0], j.hands[0]).toFixed(0);
      const t = ((Math.atan2(j.trunk.up.z, j.trunk.up.y) * 180) / Math.PI).toFixed(0);
      const p = POSES[n];
      return `knee ${k} elbow ${e} trunk ${t} crouch ${p.crouch.toFixed(2)} shift ${p.shift.toFixed(2)} rider ${p.rider.y.toFixed(2)},${p.rider.z.toFixed(2)}`;
    });
    if (process.env.RIDER_TABLE) console.log(rows.join("\n"));
    expect(rows.length).toBeGreaterThan(0);
  });
});
