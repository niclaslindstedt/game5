// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK (R44, R45) in every kind of snow country (R21) and on real
// mountainsides: laid and held to the analyzer as on the alpine
// (`bike_park_test.ts`). A real face is steeper and rougher than a dealt
// one, so a flow trail does not fit on every one; these two carry a park.
import { describe, it } from "vitest";
import { generateLevel, loadRealFace, setBikePark } from "@engine";
import { holdsPark } from "./support/bike-park.ts";

const SLOW = 240_000;

describe("the bike park in every region and on real faces", () => {
  for (const region of ["fell", "continental", "maritime"] as const) {
    it(
      `holds R44 and R45 — ${region}`,
      () => {
        holdsPark(setBikePark(generateLevel(1, { region })));
      },
      SLOW,
    );
  }
  for (const face of ["continental-2", "fell-3"]) {
    it(
      `holds R44 and R45 — ${face}`,
      async () => {
        await loadRealFace(face);
        holdsPark(setBikePark(generateLevel(1, { face })));
      },
      SLOW,
    );
  }
});
