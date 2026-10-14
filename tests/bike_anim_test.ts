// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RIDER ANIMATED (`bike-anim.ts`): the clips eased between
// their keys, and the animator ridden down a real trail — its pose never
// flung between two frames, its hands on the grips, its feet on the pedals.

import { describe, expect, it } from "vitest";

import { bikePose, RAGDOLL as R } from "@engine";

import { animatedStyle, clipAt, CLIPS } from "../pwa/src/game/bike-anim.ts";
import { bracketFromRider, gripsAt, pedalsAt } from "../pwa/src/game/bike-look.ts";
import { drawnBikePose, FOLLOW, riderSlack } from "../pwa/src/game/rider-follow.ts";
import { riderPoints } from "../pwa/src/game/skier-bike.ts";
import { CLIPS as RIDES, clipWindow, rideClip } from "../pwa/src/tools/bike-clips.ts";

describe("bike animation clips", () => {
  it("eases between keys and is still at both ends", () => {
    expect(clipAt(CLIPS.land, 0)).toEqual({});
    expect(clipAt(CLIPS.land, 5)).toEqual({});
    const deep = clipAt(CLIPS.land, 0.1).hipY!;
    expect(deep).toBeCloseTo(-0.11, 3);
    // Half way to the deepest key in time, half way there (the ease is even).
    expect(Math.abs(clipAt(CLIPS.land, 0.05).hipY!)).toBeCloseTo(0.055, 3);
    expect(clipAt(CLIPS.land, 0.1, 0.5).hipY).toBeCloseTo(deep / 2, 4);
  });
});

describe("bike animator on the trail", () => {
  it("keeps the hands on the grips and the feet on the pedals through the berm", async () => {
    const clip = RIDES.find((c) => c.id === "berm")!;
    const win = clipWindow(clip)!;
    let frames = 0;
    await rideClip(clip, win, (s) => {
      const b = s.bike!;
      if (!b.onIt || s.skier.thrown) return;
      const pose = bikePose(b);
      const style = animatedStyle(b, s.level, s.t);
      const pts = riderPoints(pose, style);
      const at = (i: number) => ({ x: pts[3 * i], y: pts[3 * i + 1], z: pts[3 * i + 2] });
      const bb = bracketFromRider(pose);
      const [g0] = gripsAt(pose.steer);
      const [p0] = pedalsAt(style.crank);
      const hand = at(R.handL);
      expect(
        Math.hypot(hand.x - bb.x - g0.x, hand.y - bb.y - g0.y, hand.z - bb.z - g0.z),
      ).toBeLessThan(0.02);
      const foot = at(R.footL);
      expect(
        Math.hypot(foot.x - bb.x - p0.x, foot.y - bb.y - p0.y, foot.z - bb.z - p0.z),
      ).toBeLessThan(0.15);
      frames++;
    });
    expect(frames).toBeGreaterThan(30);
  }, 120_000);

  it("never locks a knee or an elbow straight, pedalling or in the air", async () => {
    const angle = (a: number[], b: number[], c: number[]): number => {
      const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
      const dot = u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
      return (Math.acos(dot / (Math.hypot(...u) * Math.hypot(...w))) * 180) / Math.PI;
    };
    for (const id of ["pedal", "jump"]) {
      const clip = RIDES.find((c) => c.id === id)!;
      let knee = 0;
      let elbow = 0;
      await rideClip(clip, clipWindow(clip)!, (s) => {
        const b = s.bike!;
        if (!b.onIt || s.skier.thrown) return;
        const pts = riderPoints(bikePose(b), animatedStyle(b, s.level, s.t));
        const at = (i: number) => [pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]];
        for (const [h, k, f] of [
          [R.hipL, R.kneeL, R.footL],
          [R.hipR, R.kneeR, R.footR],
        ])
          knee = Math.max(knee, angle(at(h), at(k), at(f)));
        for (const [sh, e, hd] of [
          [R.shoulderL, R.elbowL, R.handL],
          [R.shoulderR, R.elbowR, R.handR],
        ])
          elbow = Math.max(elbow, angle(at(sh), at(e), at(hd)));
      });
      // A rider's knee keeps 30–40° of bend at the bottom of the stroke.
      expect(knee, id).toBeLessThan(150);
      expect(elbow, id).toBeLessThan(160);
    }
  }, 120_000);

  it("turns the cranks at the cadence, never half a turn in a frame", async () => {
    const clip = RIDES.find((c) => c.id === "pedal")!;
    let last: number | null = null;
    let most = 0;
    await rideClip(clip, clipWindow(clip)!, (s) => {
      const b = s.bike!;
      if (!b.onIt) return;
      const c = animatedStyle(b, s.level, s.t).crank;
      if (last !== null)
        most = Math.max(most, Math.abs(Math.atan2(Math.sin(c - last), Math.cos(c - last))));
      last = c;
    });
    // 90 rpm is 0.16 rad a frame at 60 Hz.
    expect(most).toBeLessThan(0.25);
  }, 120_000);

  it("holds the rider on the frame through the take-off's jolt, the bike moved with him", async () => {
    const clip = RIDES.find((c) => c.id === "jump")!;
    const drawn: number[] = [];
    const engine: number[] = [];
    await rideClip(clip, clipWindow(clip)!, (s) => {
      const b = s.bike!;
      if (!b.onIt || s.skier.thrown) return;
      const pose = bikePose(b);
      const d = drawnBikePose(b, s.t);
      const slack = riderSlack(pose, d);
      expect(Math.hypot(slack.x, slack.y, slack.z)).toBeLessThanOrEqual(
        FOLLOW.far * Math.sqrt(3) + 1e-9,
      );
      drawn.push(d.rider.y);
      engine.push(pose.rider.y);
    });
    const worst = (y: number[]) =>
      Math.max(...y.slice(2).map((v, i) => Math.abs(v - 2 * y[i + 1] + y[i])));
    expect(drawn.length).toBeGreaterThan(30);
    expect(worst(drawn)).toBeLessThanOrEqual(worst(engine) + 1e-9);
  }, 120_000);
});

describe("bike animator's limb guards", () => {
  // THE KNEE GUARD and THE TRUNK-PITCH SOLVE keep the limbs from folding
  // shut through a landing and a pump — and do it without a jump: a
  // sixtieth of a second apart, no joint moves 10 cm on the bike.
  // The knees' least on each (a big landing folds them deeper than a
  // pump), deg; the elbows never under the motion lab's 70.
  for (const [id, least] of [
    ["land", 60],
    ["pump", 85],
  ] as const) {
    it(`keeps the knees open, the elbows soft and every joint steady through the ${id}`, async () => {
      const clip = RIDES.find((c) => c.id === id)!;
      const win = clipWindow(clip)!;
      const angle = (p: number[], a: number, b: number, c: number) => {
        const u = [0, 1, 2].map((j) => p[3 * a + j] - p[3 * b + j]);
        const w = [0, 1, 2].map((j) => p[3 * c + j] - p[3 * b + j]);
        const dot = u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
        return (Math.acos(dot / (Math.hypot(...u) * Math.hypot(...w))) * 180) / Math.PI;
      };
      let last: number[] | null = null;
      let step = 0;
      let lo = 180;
      let elbow = 180;
      await rideClip(clip, win, (s) => {
        const b = s.bike!;
        if (!b.onIt || s.skier.thrown) return void (last = null);
        const pts = riderPoints(bikePose(b), animatedStyle(b, s.level, s.t));
        for (const [h, k, f] of [
          [R.hipL, R.kneeL, R.footL],
          [R.hipR, R.kneeR, R.footR],
        ]) {
          const a = angle(pts, h, k, f);
          lo = Math.min(lo, a);
        }
        for (const [sh, el, ha] of [
          [R.shoulderL, R.elbowL, R.handL],
          [R.shoulderR, R.elbowR, R.handR],
        ])
          elbow = Math.min(elbow, angle(pts, sh, el, ha));
        if (last)
          for (let i = 0; i < pts.length / 3; i++)
            step = Math.max(
              step,
              Math.hypot(...[0, 1, 2].map((j) => pts[3 * i + j] - last![3 * i + j])),
            );
        last = pts;
      });
      expect(lo).toBeGreaterThan(least);
      expect(elbow).toBeGreaterThan(70);
      expect(step).toBeLessThan(0.1);
    }, 120_000);
  }
});
