// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE TURNS TIGHTLY: held at full lock on the flat at a crawl,
// at trail speed and fast, on the groomer and in powder, both ways round, it
// settles on a circle inside each row's band of `support/sled-turns.ts`,
// turns through 90° and never throws its rider (`make sled-turn` prints the
// same turns as a table).

import { describe, expect, it } from "vitest";

import { SLED_TURNS, rideTurn } from "./support/sled-turns.ts";

describe("the snowmobile at full lock", () => {
  for (const row of SLED_TURNS) {
    for (const steer of [1, -1]) {
      it(`turns on a ${row.radius[0]}–${row.radius[1]} m circle ${row.what}, to the ${steer > 0 ? "right" : "left"}`, () => {
        const r = rideTurn(row, steer);
        const said = `${row.id}: ${JSON.stringify(r)}`;
        expect(r.thrown, said).toBe(false);
        expect(r.quarter, said).toBeGreaterThan(0);
        expect(r.radius, said).toBeGreaterThanOrEqual(row.radius[0]);
        expect(r.radius, said).toBeLessThanOrEqual(row.radius[1]);
      });
    }
  }
});
