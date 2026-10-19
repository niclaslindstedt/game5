// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PATROL SAT ON ITS SNOWMOBILES (`rescue-sleds-ride.ts`): every
// patroller's body sat on the seat's top and stood on the running boards,
// whatever its height, the driver's hands out at the bars, and both rides
// built into the same figure as the air crew's targets.

import { describe, expect, it } from "vitest";

import { civilianPosed } from "../pwa/src/game/civilian-moves.ts";
import { crewTargets } from "../pwa/src/game/rescue-crew.ts";
import { BEARERS } from "../pwa/src/game/rescue-defs.ts";
import { RIDES, SEAT_RISE, patrolTargets, ridePosed } from "../pwa/src/game/rescue-sleds-ride.ts";

const bodies = [...new Set(BEARERS.map((b) => b.body))];

describe("the patrol sat on its machines", () => {
  for (const body of bodies) {
    for (const place of RIDES) {
      it(`a ${body} as ${place}: hips on the seat, boots on the boards`, () => {
        const P = ridePosed(body, place);
        // The hip joint a hand's breadth over the seat's top.
        expect(P.pelvis[1]).toBeGreaterThan(SEAT_RISE[place] + 0.04);
        expect(P.pelvis[1]).toBeLessThan(SEAT_RISE[place] + 0.16);
        // The boots on the boards as they stand on the snow.
        const stood = civilianPosed(body, "stand");
        expect(Math.abs(P.ankleL[1] - stood.ankleL[1])).toBeLessThan(0.03);
        expect(Math.abs(P.ankleR[1] - stood.ankleR[1])).toBeLessThan(0.03);
        // Astride: the boots either side of the seat, ahead of the hips.
        expect(P.ankleR[0] - P.ankleL[0]).toBeGreaterThan(0.4);
        expect(P.ankleL[2]).toBeGreaterThan(P.pelvis[2]);
      });
    }
    it(`a ${body}'s figure carries both rides after the air crew's targets`, () => {
      expect(patrolTargets(body).length).toBe(crewTargets(body).length + RIDES.length);
    });
  }
});
