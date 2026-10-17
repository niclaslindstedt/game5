// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The snow cloud's shadow on the slope: how many shadows each lies under,
// which is what keeps a stack of them a shadow and never a black smear.

import { describe, expect, it } from "vitest";

import { overlapOf } from "../pwa/src/game/snow-cloud-shadow.ts";

/** `n` shadows of radius `r` on a line `gap` apart, each of opacity `o`. */
function line(n: number, gap: number, r: number, o: number) {
  const spot = new Float32Array(n * 4);
  const look = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    spot[i * 4] = i * gap;
    spot[i * 4 + 3] = r;
    look[i * 4] = o;
  }
  return { spot, look };
}

describe("the snow cloud's shadow", () => {
  it("counts a lone shadow once", () => {
    const { spot, look } = line(1, 0, 1, 1);
    const out = new Float32Array(1);
    overlapOf(spot, look, 4, 1, out);
    expect(out[0]).toBe(1);
  });

  it("counts a pile on one spot by its opacities", () => {
    const { spot, look } = line(10, 0, 1, 0.5);
    const out = new Float32Array(10);
    overlapOf(spot, look, 4, 10, out);
    for (const v of out) expect(v).toBeCloseTo(1 + 9 * 0.5, 5);
  });

  it("leaves shadows apart alone, and finds neighbours across cells", () => {
    const apart = line(4, 10, 1, 1);
    const out = new Float32Array(4);
    overlapOf(apart.spot, apart.look, 4, 4, out);
    for (const v of out) expect(v).toBe(1);
    // A roost's line, half a metre apart under 3 m shadows.
    const roost = line(40, 0.5, 3, 1);
    const many = new Float32Array(40);
    overlapOf(roost.spot, roost.look, 4, 40, many);
    // Five a side within reach, weighted 5/6 … 1/6: 2.5 a side.
    expect(many[20]).toBeCloseTo(6, 5);
    expect(many[0]).toBeLessThan(many[20]);
  });
});
