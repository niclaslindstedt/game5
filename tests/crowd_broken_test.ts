// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN AMATEUR RUN INTO, AS DRAWN (`pwa/src/game/crowd-broken.ts`): with the
// INJURIES on, a man the player killed lies broken — his limbs off their
// joints across the snow, his skis off his boots, his trunk flatter the
// more he was crushed, bloodied — a hurt one lies with one leg broken and
// stirs, and with the INJURIES off nothing of it: he is knocked down and
// gets up as before. Staged by `tests/support/body-hits.ts`.

import { describe, expect, it } from "vitest";

import {
  bledBetween,
  bleedOf,
  bloodOf,
  breakPose,
  brokenOf,
  flatOf,
  hurtOf,
  type Hurt,
} from "../pwa/src/game/crowd-broken.ts";
import { lyingPose } from "../pwa/src/game/crowd-fall.ts";
import type { Posed, V3 } from "../pwa/src/game/crowd-rig.ts";
import { rideOn, stageMeeting } from "./support/body-hits.ts";

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** A grown man struck at `kmh`, ridden on 3 s: the state, him, his pose. */
function lying(kmh: number, gore: boolean) {
  const { state, a } = stageMeeting(kmh, "man", gore);
  rideOn(state, 3);
  const pose = lyingPose(a.thrown!.points, a.body, [0, 0, 0]);
  return { state, a, pose };
}

const clone = (p: Posed): Posed => structuredClone(p);

describe("an amateur run into, as drawn", () => {
  it("is hurt only with the injuries on, and dead at 60 km/h", () => {
    const on = lying(60, true);
    const hurt = hurtOf(on.state, on.a)!;
    expect(hurt.dead).toBe(true);
    expect(hurt.down).toBe(true);
    expect(hurt.since).toBeGreaterThan(2.9);
    const off = lying(60, false);
    expect(hurtOf(off.state, off.a)).toBeUndefined();
    expect(bloodOf(undefined)).toBe(0);
    const at30 = lying(30, true);
    const hurt30 = hurtOf(at30.state, at30.a)!;
    expect(hurt30.dead).toBe(false);
  });

  it("breaks a dead man's limbs off their joints but keeps every bone its length", () => {
    const { state, a, pose } = lying(90, true);
    const hurt = hurtOf(state, a)!;
    const broken = breakPose(clone(pose), hurt);
    // Every shin and forearm is still as long as it was.
    for (const [j0, j1] of [
      ["kneeL", "ankleL"],
      ["kneeR", "ankleR"],
      ["elbowL", "handL"],
      ["elbowR", "handR"],
      ["neck", "head"],
    ] as const) {
      expect(dist(broken[j0], broken[j1])).toBeCloseTo(dist(pose[j0], pose[j1]), 5);
    }
    // ...and something has been turned off its line.
    const moved = (["ankleL", "ankleR", "handL", "handR", "head"] as const).filter(
      (j) => dist(broken[j], pose[j]) > 0.1,
    );
    expect(moved.length).toBeGreaterThanOrEqual(4);
    // The trunk is left where the ragdoll laid it.
    expect(dist(broken.pelvis, pose.pelvis)).toBe(0);
  });

  it("lays his skis flat off his boots once he is down, the same every frame", () => {
    const { state, a, pose } = lying(60, true);
    const hurt = hurtOf(state, a)!;
    const one = breakPose(clone(pose), hurt);
    const two = breakPose(clone(pose), hurt);
    expect(one).toEqual(two);
    for (const k of ["skiL", "skiR"] as const) {
      expect(Math.abs(one[k].tip[1] - one[k].tail[1])).toBeLessThan(1e-9);
      // As long as it was.
      expect(dist(one[k].tip, one[k].tail)).toBeCloseTo(dist(pose[k].tip, pose[k].tail), 5);
    }
  });

  it("breaks through the first moment rather than in a frame", () => {
    const { state, a, pose } = lying(90, true);
    const hurt: Hurt = { ...hurtOf(state, a)!, since: 0, down: false };
    expect(breakPose(clone(pose), hurt)).toEqual(pose);
  });

  it("lets a hurt man stir, and keeps a dead one still", () => {
    const { state, a, pose } = lying(30, true);
    const hurt = hurtOf(state, a)!;
    const at = (since: number) => breakPose(clone(pose), { ...hurt, since });
    const spread = Math.max(
      ...[5, 6, 7, 8].map((t) =>
        Math.max(dist(at(t).handL, at(4).handL), dist(at(t).handR, at(4).handR)),
      ),
    );
    expect(spread).toBeGreaterThan(0.05);
    const dead: Hurt = { ...hurt, dead: true, crush: 0.5 };
    expect(breakPose(clone(pose), { ...dead, since: 5 })).toEqual(
      breakPose(clone(pose), { ...dead, since: 9 }),
    );
  });

  it("draws a crushed man flatter and bloodier, a hurt one bloodied a little", () => {
    const hurt = { dead: false, crush: 0, seed: 1, since: 10, down: true };
    const dead = { ...hurt, dead: true, crush: 0.2 };
    const crushed = { ...hurt, dead: true, crush: 1 };
    expect(flatOf(hurt)).toBe(1);
    expect(flatOf(crushed)).toBeLessThan(flatOf(dead));
    expect(flatOf(crushed)).toBeGreaterThan(0.4);
    expect(brokenOf(crushed)).toBeGreaterThan(brokenOf(dead));
    expect(brokenOf(dead)).toBeGreaterThan(brokenOf(hurt));
    expect(bloodOf(crushed)).toBeGreaterThan(bloodOf(dead));
    expect(bloodOf(dead)).toBeGreaterThan(bloodOf(hurt));
    expect(bloodOf(hurt)).toBeGreaterThan(0);
    expect(bloodOf(crushed)).toBeLessThanOrEqual(1);
  });

  it("bleeds a cupful from a hurt man's face and litres from a crushed body, all of it once", () => {
    const hurt = { killed: false, crush: 0 };
    const crushed = { killed: true, crush: 1 };
    expect(bleedOf(hurt).litres).toBeLessThan(0.2);
    expect(bleedOf(crushed).litres).toBeGreaterThan(2);
    // Run out in pieces, it is the same as run out at once.
    let sum = 0;
    for (let t = 0; t < 300; t += 0.5) sum += bledBetween(crushed, t, t + 0.5);
    expect(sum).toBeCloseTo(bledBetween(crushed, 0, 300), 9);
    expect(sum).toBeLessThanOrEqual(bleedOf(crushed).litres);
    expect(bledBetween(crushed, 5, 5)).toBe(0);
  });
});
