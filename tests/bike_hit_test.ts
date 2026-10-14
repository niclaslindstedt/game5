// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE AGAINST THE WORLD (`bike-solids.ts`, `bike.ts`): every row of
// `make bike-hit` (`tests/support/bike-hits.ts`) held as it should come
// out — a trunk met square throws him over the bars from 20 km/h and a bar
// end clipped on one from 20 km/h; the race line's edge, a bench's cut and
// fill and the bot's own line ridden; a tower, a mast, a wall and a parked
// car thrown off; a pond stopped in — and none of them with the bike or
// its rider stood inside a solid, a bike frozen while it threw him, or a
// restart stood up in one.
import { describe, expect, it } from "vitest";

import { HIT_ROWS, hitFaults } from "./support/bike-hits.ts";

describe("the bike meets the world as it should", () => {
  for (const row of HIT_ROWS) {
    it(`${row.id}: ${row.label}`, { timeout: 120_000 }, () => {
      const r = row.run();
      expect(hitFaults(row, r)).toEqual([]);
    });
  }
});
