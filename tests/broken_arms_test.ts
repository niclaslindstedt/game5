// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RIDING WITH A BROKEN ARM (`pwa/src/game/skier-broken.ts`): which break an
// injury makes, the pole a broken arm drops, the piece below the break
// hanging and swinging from it, and the rig and the skin cut there so a
// sound arm moves exactly as it always did.

import { describe, expect, it } from "vitest";
import type { Injury } from "@engine";

import { clothWeights } from "../pwa/src/game/dress-loft.ts";
import {
  armBreaks,
  breakArms,
  BREAK,
  createArmSwing,
  type ArmBreak,
} from "../pwa/src/game/skier-broken.ts";
import { BODY, skierPose, type V3 } from "../pwa/src/game/skier-pose.ts";
import { SKIER_BONES, STANDING, skierBones } from "../pwa/src/game/skier-rig.ts";

const hurt = (part: Injury["part"], kind: Injury["kind"]): Injury => ({ part, kind, ais: 2, t: 0 });
const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const pose = () => skierPose(STANDING);
const both = (l: ArmBreak | null, r: ArmBreak | null) => [l, r] as const;

describe("which arm is broken where", () => {
  it("reads a bone broken through, the nearest the shoulder winning", () => {
    expect(armBreaks([])).toEqual([null, null]);
    expect(armBreaks([hurt("armL", "brokenArm")])).toEqual(["upper", null]);
    expect(armBreaks([hurt("armR", "brokenForearm")])).toEqual([null, "fore"]);
    expect(armBreaks([hurt("handR", "brokenWrist")])).toEqual([null, "wrist"]);
    expect(
      armBreaks([
        hurt("armL", "brokenForearm"),
        hurt("armL", "brokenArm"),
        hurt("handL", "brokenWrist"),
      ]),
    ).toEqual(["upper", null]);
  });

  it("holds a hairline crack, a broken hand and a bruise", () => {
    expect(
      armBreaks([
        hurt("armL", "crackedArm"),
        hurt("armR", "crackedForearm"),
        hurt("handL", "brokenHand"),
        hurt("handR", "crackedRadius"),
        hurt("armR", "bruisedElbow"),
      ]),
    ).toEqual([null, null]);
  });
});

describe("the pose with a broken arm", () => {
  it("comes back as it was with no break", () => {
    const p = pose();
    expect(breakArms(p, both(null, null), createArmSwing(), 0.016)).toBe(p);
  });

  it("drops the broken arm's pole and leaves the other", () => {
    const b = breakArms(pose(), both("fore", null), createArmSwing(), 0);
    expect(b.dropped).toEqual([true, false]);
    expect(b.kinks?.[0]?.bone).toBe("fore");
    expect(b.kinks?.[1]).toBeNull();
    expect(b.hands[1]).toEqual(pose().hands[1]);
  });

  it("keeps every bone its length, the break where the rig cuts it", () => {
    const p = pose();
    const b = breakArms(p, both("upper", "fore"), createArmSwing(), 0);
    const [up, fore] = [b.kinks![0]!.at, b.kinks![1]!.at];
    expect(dist(b.shoulders[0], up)).toBeCloseTo(BREAK.upper, 6);
    expect(dist(up, b.elbows[0])).toBeCloseTo(BODY.upperArm - BREAK.upper, 3);
    expect(dist(b.elbows[0], b.hands[0])).toBeCloseTo(BODY.forearm, 3);
    expect(dist(b.shoulders[1], b.elbows[1])).toBeCloseTo(BODY.upperArm, 6);
    expect(dist(b.elbows[1], fore)).toBeCloseTo(BREAK.fore, 6);
    expect(dist(fore, b.hands[1])).toBeCloseTo(BODY.forearm - BREAK.fore, 3);
  });

  it("hangs the piece below the break down under gravity", () => {
    const b = breakArms(pose(), both("upper", "wrist"), createArmSwing(), 0);
    const pin = b.kinks![0]!.at;
    // The upper arm's lower piece and its forearm hang near plumb.
    expect((pin.y - b.hands[0].y) / dist(pin, b.hands[0])).toBeGreaterThan(0.9);
    const wrist = b.kinks![1]!.at;
    expect((wrist.y - b.hands[1].y) / dist(wrist, b.hands[1])).toBeGreaterThan(0.95);
  });

  it("swings forward when he brakes, and settles back when he rides on", () => {
    const swing = createArmSwing();
    const p = pose();
    const rest = breakArms(p, both(null, "fore"), swing, 0);
    // Braking at 6 m/s²: the arm feels gravity tipped forward.
    let b = rest;
    for (let i = 0; i < 60; i++)
      b = breakArms(p, both(null, "fore"), swing, 1 / 60, { x: 0, y: -9.81, z: 6 });
    expect(b.hands[1].z).toBeGreaterThan(rest.hands[1].z + 0.03);
    for (let i = 0; i < 300; i++) b = breakArms(p, both(null, "fore"), swing, 1 / 60);
    expect(dist(b.hands[1], rest.hands[1])).toBeLessThan(0.01);
  });
});

describe("the rig cut at the break", () => {
  it("moves a sound arm's lower bones exactly with the bones they are cut from", () => {
    const bind = skierBones(pose());
    const posed = skierBones(skierPose({ ...STANDING, steer: 0.8, crouch: 0.6 }));
    for (const s of ["l", "r"] as const) {
      for (const [bone, lo] of [
        [`upperarm_${s}`, `upperarm_lo_${s}`],
        [`forearm_${s}`, `forearm_lo_${s}`],
      ] as const) {
        const [a, b] = [posed[bone], posed[lo]];
        for (const k of ["x", "y", "z"] as const) expect(dist(a[k], b[k])).toBeLessThan(1e-9);
        // The lower bone's head the same distance down the same line in
        // the bind pose and the posed one: one rigid move for both.
        const at = dist(bind[lo].head, bind[bone].head);
        expect(dist(b.head, a.head)).toBeCloseTo(at, 9);
      }
    }
  });

  it("splits a broken bone at the break", () => {
    const b = breakArms(pose(), both("upper", "fore"), createArmSwing(), 0);
    const f = skierBones(b);
    expect(dist(f.upperarm_lo_l.head, b.kinks![0]!.at)).toBeLessThan(1e-9);
    expect(dist(f.forearm_lo_r.head, b.kinks![1]!.at)).toBeLessThan(1e-9);
    // The hanging piece runs down, the held one out.
    expect(f.upperarm_lo_l.y.y).toBeLessThan(-0.8);
    expect(f.upperarm_l.y.y).toBeGreaterThan(f.upperarm_lo_l.y.y);
  });

  it("weights the skin past the break to the bone below it", () => {
    const F = skierBones(pose());
    const lo = SKIER_BONES.indexOf("upperarm_lo_l");
    const up = SKIER_BONES.indexOf("upperarm_l");
    const at = (d: number) => {
      const f = F.upperarm_l;
      return { x: f.head.x + f.y.x * d, y: f.head.y + f.y.y * d, z: f.head.z + f.y.z * d };
    };
    const share = (w: { bone: number; w: number }[], b: number) =>
      w.find((x) => x.bone === b)?.w ?? 0;
    const above = clothWeights(at(BREAK.upper - 0.06), ["upperarm_l", "forearm_l", "spine"]);
    const below = clothWeights(at(BREAK.upper + 0.06), ["upperarm_l", "forearm_l", "spine"]);
    expect(share(above, lo)).toBe(0);
    expect(share(above, up)).toBeGreaterThan(0.5);
    expect(share(below, up)).toBe(0);
    expect(share(below, lo)).toBeGreaterThan(0.5);
  });
});
