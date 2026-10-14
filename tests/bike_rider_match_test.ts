// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREERIDER AS A MOTION (`bike-rider-match.ts`): a library of poses
// matched to the ride's signals each frame and blended by inertialization,
// so a switch of pose never pops. Presentation only: the engine never reads
// any of it.
import { describe, expect, it } from "vitest";
import { bikePose, step, NEUTRAL_INPUT, RAGDOLL as R, type BikePose } from "@engine";

import { bracketFromRider, gripsAt } from "../pwa/src/game/bike-look.ts";
import type { RideStyle } from "../pwa/src/game/bike-ride-style.ts";
import {
  createRiderMotion,
  nearestPose,
  RIDER_POSES,
  signalsOf,
} from "../pwa/src/game/bike-rider-match.ts";
import { riderPoints } from "../pwa/src/game/skier-bike.ts";
import { bikeRun, summerMap } from "./support/bike-bot.ts";

const STILL: RideStyle = {
  trick: "none",
  side: 1,
  amount: 0,
  yaw: 0,
  roll: 0,
  footOut: 0,
  foot: 0,
  brake: 0,
  flight: 0,
};
const HZ = 60;

function restPose(): BikePose {
  const s = bikeRun(summerMap(38));
  for (let i = 0; i < 60; i++) step(s, NEUTRAL_INPUT);
  return bikePose(s.bike!);
}

/** The most any joint moves from one frame to the next, m. */
function mostMove(a: number[], b: number[]): number {
  let most = 0;
  for (let i = 0; i < R.count; i++) {
    const d = Math.hypot(
      a[3 * i] - b[3 * i],
      a[3 * i + 1] - b[3 * i + 1],
      a[3 * i + 2] - b[3 * i + 2],
    );
    most = Math.max(most, d);
  }
  return most;
}

describe("the pose library", () => {
  it("names every pose once and matches a still ride to the attack stance", () => {
    const ids = RIDER_POSES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pose = restPose();
    expect(RIDER_POSES[nearestPose(signalsOf({ ...pose, pedalling: false }, STILL))].id).toBe(
      "attack",
    );
  });

  it("matches the foot out to its own pose", () => {
    const pose = restPose();
    const i = nearestPose(signalsOf(pose, { ...STILL, footOut: 1, foot: 1 }));
    expect(RIDER_POSES[i].id).toBe("footout");
  });
});

describe("the rider's motion", () => {
  it("is the same answer for the same ride, and the same frame asked twice", () => {
    const pose = restPose();
    const a = createRiderMotion();
    const b = createRiderMotion();
    for (let k = 0; k < 90; k++) {
      const st = k > 30 ? { ...STILL, footOut: 1, foot: 1 as const } : STILL;
      const pa = a.points(pose, st, k / HZ);
      expect(a.points(pose, st, k / HZ)).toEqual(pa);
      expect(b.points(pose, st, k / HZ)).toEqual(pa);
    }
  });

  it("never pops when the signals switch at once, where the still pose would", () => {
    const pose = restPose();
    const motion = createRiderMotion();
    const out = { ...STILL, footOut: 1, foot: 1 as const };
    const seen: number[][] = [];
    for (let k = 0; k < 120; k++) seen.push(motion.points(pose, k < 60 ? STILL : out, k / HZ));
    // A pop is a joint's ACCELERATION: the second difference of its
    // place, m/s², held under the motion lab's snap.
    let most = 0;
    for (let k = 4; k < seen.length; k++) {
      for (let i = 0; i < 3 * R.count; i++) {
        const a = (seen[k][i] - 2 * seen[k - 1][i] + seen[k - 2][i]) * HZ * HZ;
        most = Math.max(most, Math.abs(a));
      }
    }
    // The stateless stance jumps the foot the whole way in one frame.
    const jump = mostMove(riderPoints(pose, STILL), riderPoints(pose, out));
    expect(jump).toBeGreaterThan(0.2);
    expect(jump * HZ * HZ).toBeGreaterThan(500);
    expect(most).toBeLessThan(150);
  });

  it("keeps his hands on the grips held still", () => {
    const pose = restPose();
    const motion = createRiderMotion();
    let pts: number[] = [];
    for (let k = 0; k < 120; k++) pts = motion.points(pose, STILL, k / HZ);
    const bb = bracketFromRider(pose);
    const grips = gripsAt(pose.steer);
    for (const [i, hand] of [R.handL, R.handR].entries()) {
      const g = grips[i];
      const gap = Math.hypot(
        pts[3 * hand] - (bb.x + g.x),
        pts[3 * hand + 1] - (bb.y + g.y),
        pts[3 * hand + 2] - (bb.z + g.z),
      );
      expect(gap).toBeLessThan(0.02);
    }
  });
});
