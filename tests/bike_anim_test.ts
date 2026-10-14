// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RIDER ANIMATED (`bike-anim.ts`): the clips eased between
// their keys, and the animator ridden down a real trail — its pose never
// flung between two frames, its hands on the grips, its feet on the pedals.

import { describe, expect, it } from "vitest";

import { bikePose, RAGDOLL as R } from "@engine";

import { animatedStyle, clipAt, CLIPS } from "../pwa/src/game/bike-anim.ts";
import { bracketFromRider, gripsAt, pedalsAt } from "../pwa/src/game/bike-look.ts";
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
});
