// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOOP AS DRAWN (`pwa/src/game/skier-somersault.ts`): thrown, tucked and
// opened — the arms swung into it, the knees pulled up, the legs let down
// and the arms flung out to the snow — and the lean that threw it no longer
// drawn as a lean while the loop owns the body.

import { describe, expect, it } from "vitest";
import {
  createSomersault,
  createTuck,
  flipPhases,
  somersaultOf,
  stepSomersault,
  tuckOf,
  withFlip,
} from "../pwa/src/game/skier-somersault.ts";

const LOOP = 2 * Math.PI;
const DT = 1 / 60;

/** A loop turned at a steady rate, the shape at each frame. */
function turn(dir: number, seconds = 0.6) {
  const s = createSomersault();
  const out = [];
  for (let t = 0; t <= seconds; t += DT) {
    const done = Math.min(1, t / (seconds - 0.08)) * LOOP * dir;
    stepSomersault(s, { flipGoal: LOOP * dir, flipDone: done }, DT);
    out.push({ u: Math.abs(done) / LOOP, shape: somersaultOf(s)! });
  }
  return out;
}

describe("the loop as drawn", () => {
  it("is thrown, tucked through the middle and opened before the snow", () => {
    for (const dir of [1, -1]) {
      const frames = turn(dir);
      const at = (u: number) => frames.find((f) => f.u >= u)!.shape;
      expect(flipPhases(at(0.02)).pop).toBeGreaterThan(0.5);
      expect(flipPhases(at(0.45)).tuck).toBeGreaterThan(0.9);
      expect(flipPhases(frames[frames.length - 1].shape).open).toBeGreaterThan(0.6);
    }
  });

  it("opens the hips coming out of a backflip: the chest up off the knees", () => {
    const frames = turn(1);
    const late = tuckOf(frames.find((f) => f.u >= 0.85)!.shape);
    const middle = tuckOf(frames.find((f) => f.u >= 0.45)!.shape);
    expect(late.pitch).toBeLessThan(middle.pitch);
    expect(late.nod).toBeLessThan(0); // the head back, spotting the snow
  });

  it("throws the arms up into a backflip, down into a front flip, out to land", () => {
    const back = withFlip(undefined, { tuck: 0, dir: 1, own: 1, u: 0 })!;
    const front = withFlip(undefined, { tuck: 0, dir: -1, own: 1, u: 0 })!;
    const open = withFlip(undefined, { tuck: 0, dir: 1, own: 1, u: 1 })!;
    expect(back.arm).toBeGreaterThan(Math.PI / 2);
    expect(front.arm).toBeLessThan(Math.PI / 2);
    expect(open.out).toBeGreaterThan(1);
  });

  it("takes the lean and the fall's spotting off the body while it owns it", () => {
    const tuck = createTuck();
    tuck.step({ flipGoal: LOOP, flipDone: 1 }, DT);
    const fall = { w: 1, arm: 1.2, out: 0.4, span: 0.8, pitch: 0.4, nod: 0.3, lift: 0.1 };
    const pose = { lean: 1, flight: fall, somersault: undefined };
    tuck.lay(pose);
    expect(pose.lean).toBe(0);
    expect(pose.flight!.pitch).toBe(0);
    // ...and gives them back once he is down.
    for (let i = 0; i < 60; i++) tuck.step(null, DT);
    const after = { lean: 1, flight: fall, somersault: undefined };
    tuck.lay(after);
    expect(after.lean).toBe(1);
    expect(after.flight).toBe(fall);
  });
});
