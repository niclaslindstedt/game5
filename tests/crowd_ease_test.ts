// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD'S HAND-OFFS (`crowd-ease.ts`): motion on its line is drawn as
// it is, a jump is eased out rather than drawn in a frame, and a jump past
// the cut is a cut.

import { describe, expect, it } from "vitest";

import { createCrowdEase, CROWD_EASE, easeCrowd } from "../pwa/src/game/crowd-ease.ts";

const W = 2;
const reach = new Float32Array([0.5, 0.5]);
const dt = 1 / 60;

/** Instance 0 drawn at the places `xs` (one a frame), its weights `ws`. */
function ride(xs: number[], ws: number[][] = xs.map(() => [0, 0])) {
  const e = createCrowdEase(1, W);
  return xs.map((x, f) => {
    const w = new Float32Array(ws[f]);
    const p = [x, 0, 0];
    const q = [0, 0, 0, 1];
    easeCrowd(e, 0, f * dt, w, reach, p, q);
    return { x: p[0], w: Array.from(w) };
  });
}

const second = (v: number[], f: number) => (v[f + 1] - 2 * v[f] + v[f - 1]) / (dt * dt);

describe("crowd ease", () => {
  it("draws steady motion as it is", () => {
    const xs = Array.from({ length: 60 }, (_, f) => 5 * f * dt);
    const drawn = ride(xs);
    for (let f = 0; f < xs.length; f++) expect(drawn[f].x).toBeCloseTo(xs[f], 9);
  });

  it("eases a jump in place out rather than drawing it", () => {
    const xs = Array.from({ length: 120 }, (_, f) => (f < 30 ? 0 : 1.5));
    const x = ride(xs).map((d) => d.x);
    let most = 0;
    for (let f = 1; f < x.length - 1; f++) most = Math.max(most, Math.abs(second(x, f)));
    expect(most).toBeLessThan(1.5 * CROWD_EASE.rate.place ** 2 * 1.05);
    expect(x[119]).toBeCloseTo(1.5, 2);
  });

  it("eases a pose switched on", () => {
    const ws = Array.from({ length: 90 }, (_, f) => (f < 30 ? [0, 0] : [1, 0]));
    const w = ride(Array(90).fill(0), ws).map((d) => d.w[0]);
    expect(w[30]).toBeLessThan(0.05);
    expect(w[89]).toBeCloseTo(1, 2);
  });

  it("cuts a jump past the cut", () => {
    const xs = Array.from({ length: 40 }, (_, f) => (f < 20 ? 0 : CROWD_EASE.cut + 2));
    expect(ride(xs)[20].x).toBe(CROWD_EASE.cut + 2);
  });
});
