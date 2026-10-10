// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE TIPS AS A REAL ONE DOES: every row of
// `support/sled-tips.ts` a rider of the class expects to stay up — any turn
// on the flat, at any speed the snow allows, on the groomer and in powder
// from a thin cover to bottomless; a traverse held into the hill — stays
// up, and every row he expects to go over — stalled across a 35° face of
// bottomless powder — goes over (`make sled-tip` prints the whole bench).

import { describe, expect, it } from "vitest";

import { SLED_TIPS, rideTip } from "./support/sled-tips.ts";

describe("the snowmobile rolling over", () => {
  for (const row of SLED_TIPS.filter((r) => r.wants !== "either")) {
    it(`${row.wants === "up" ? "stays up" : "goes over"}: ${row.id}`, () => {
      const r = rideTip(row);
      const said = `${row.id}: ${JSON.stringify(r)}`;
      if (row.wants === "up") expect(r.thrown, said).toBeLessThan(0);
      else expect(r.thrown, said).toBeGreaterThanOrEqual(0);
    });
  }
});
