// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FALL CRATER (`trail-stamp.ts`'s `craterStampOf`): a body met by the
// snow out of the air presses a round pit where it lands — nothing for a
// stumble, wider and deeper the harder he came down, a hole in powder and a
// dish on the groomer, its rim the snow it threw out and never past the
// trail map's scale.

import { describe, expect, it } from "vitest";

import { CRATER, craterStampOf, TRAIL, type Stamp } from "../pwa/src/game/trail-stamp.ts";

function crater(impact: number, packed: number): Stamp | undefined {
  const out: Stamp[] = [];
  craterStampOf(4, -2, impact, packed, out);
  return out[0];
}

describe("the fall crater", () => {
  it("leaves nothing for a fall slower than it shows at", () => {
    expect(crater(CRATER.from - 0.5, 0)).toBeUndefined();
  });

  it("is a round pit where he landed", () => {
    const c = crater(9, 0)!;
    expect(c.ax).toBe(4);
    expect(Math.hypot(c.bx - c.ax, c.bz - c.az)).toBeLessThan(0.01);
  });

  it("grows wider and deeper the harder he came down", () => {
    const soft = crater(5, 0)!;
    const hard = crater(13, 0)!;
    expect(hard.half).toBeGreaterThan(soft.half);
    expect(hard.depth).toBeGreaterThan(soft.depth);
    expect(crater(40, 0)!.half).toBeCloseTo(CRATER.half[1], 6);
  });

  it("is a hole in powder and a dish on the groomer", () => {
    expect(crater(12, 0)!.depth).toBeGreaterThan(2 * crater(12, 1)!.depth);
  });

  it("stands its rim up and stays inside the map's scale", () => {
    for (const impact of [4, 9, 20, 60]) {
      for (const packed of [0, 0.5, 1]) {
        const c = crater(impact, packed)!;
        expect(c.berm).toBeGreaterThan(0);
        expect(c.berm).toBeLessThanOrEqual(TRAIL.maxBerm);
        expect(c.depth).toBeLessThanOrEqual(TRAIL.maxDepth);
      }
    }
  });
});
