// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE IS HARD TO CRASH ON SNOW: every staged ride of
// `support/sled-landings.ts` — rollers, whoops, hard turns, a sidehill,
// kickers onto the flat and onto a landing, drops onto snow, a bank — is
// ridden out, and only a landing on its side or its nose, a loop, a drop
// from a height, a cliff and a wall ridden into throw the rider
// (`make sled-land` prints the same rides as a table).

import { describe, expect, it } from "vitest";

import { SLED_LANDINGS, rideLanding } from "./support/sled-landings.ts";

describe("the snowmobile over bumps, jumps, drops and cliffs", () => {
  for (const row of SLED_LANDINGS) {
    it(`${row.throws ? "throws its rider" : "is ridden out"}: ${row.what}`, () => {
      const r = rideLanding(row);
      expect(r.thrown, `${row.id}: ${JSON.stringify(r)}`).toBe(row.throws);
    });
  }
});
