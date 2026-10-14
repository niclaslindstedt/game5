// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FALL LAB'S CORNERS (`make falls`, `tests/support/fall-matrix.ts`):
// what a fall from a height does to a skier, held to what it does to a body
// (`docs/riding.md` § *Falls from a height*) — ridden away onto a steep
// face of powder, lethal from a real height onto the flat groomer, and
// never a death from a drop a skier takes every day.

import { describe, expect, it } from "vitest";
import { fallRates, type FallCase } from "./support/fall-matrix.ts";

const TRIALS = 8;
const rate = (c: FallCase) => fallRates(c, TRIALS);

describe("a fall from a height", () => {
  it("is ridden away feet first onto a steep face of deep powder", () => {
    const r = rate({ height: 30, slope: 40, ground: "powder", how: "feet" });
    expect(r.dead).toBe(0);
    expect(r.worst).toBeLessThanOrEqual(2);
  });

  it("is taken whole on the skis from a drop a skier takes every day", () => {
    for (const ground of ["groomed", "ice"] as const) {
      const r = rate({ height: 5, slope: 0, ground, how: "feet" });
      expect(r.dead).toBe(0);
      expect(r.worst).toBeLessThanOrEqual(1);
    }
  });

  it("kills more often than not from 20 m onto the flat groomer, however he meets it", () => {
    for (const how of ["feet", "back", "side", "head"] as const)
      expect(rate({ height: 20, slope: 0, ground: "groomed", how }).dead).toBeGreaterThan(0.5);
  });

  it("is not saved by a steep groomer from a real height", () => {
    expect(rate({ height: 30, slope: 35, ground: "groomed", how: "feet" }).dead).toBeGreaterThan(
      0.5,
    );
  });

  it("is the worst head first and the least on the feet", () => {
    const c = { height: 8, slope: 0, ground: "groomed" } as const;
    const head = rate({ ...c, how: "head" });
    const feet = rate({ ...c, how: "feet" });
    expect(head.dead).toBeGreaterThan(0.5);
    expect(feet.dead).toBe(0);
  });

  it("is softened by deep powder against the groomer", () => {
    const c = { height: 15, slope: 0, how: "side" } as const;
    expect(rate({ ...c, ground: "powder" }).iss).toBeLessThan(
      rate({ ...c, ground: "groomed" }).iss,
    );
  });
});
