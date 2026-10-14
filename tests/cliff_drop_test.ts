// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OFF A CLIFF, HE ONLY FALLS (`leg-ray.ts`): over a cliff's face the snow's
// normal under the hips lies nearly level, and a leg's ray cast along it
// once ended metres over the face's foot and was taken as a leg on the
// snow — the skier, falling past the face, stood on its foot from the air
// and was sprung back up. Staged on a shelf, a face and an apron shaped by
// hand: nothing but the snow below may turn his fall round.

import { describe, expect, it } from "vitest";
import { SKIS, TUNING, createGame, placeRun, step } from "@engine";
import { shapedLevel } from "./support/synthetic.ts";

const TUCK = { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false };

/** The edge at z = 300: a shelf falling 15 % behind it, a face dropping
 * `drop` m over `face` m, and an apron falling 30 % below it. */
function cliff(drop: number, face: number) {
  return shapedLevel(
    (_x, z) => {
      if (z < 300) return 100 - (z - 300) * 0.15;
      if (z < 300 + face) return 100 - ((z - 300) / face) * drop;
      return 100 - drop - (z - 300 - face) * 0.3;
    },
    { cell: 1 },
  );
}

/** Ski off the edge at `kmh`, tucked: the upward speed he gains while
 * clear of the snow under him, m/s summed. */
function airKick(drop: number, face: number, kmh: number): number {
  const level = cliff(drop, face);
  const state = createGame({ level, spec: SKIS, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 300, z: 294, heading: 0, speed: kmh / 3.6 });
  const c = state.skier;
  let kick = 0;
  let vy = c.vy;
  for (let i = 0; i < 3 * TUNING.physicsHz && !c.thrown; i++) {
    step(state, TUCK);
    if (c.vy > vy && c.y - level.groundAt(c.x, c.z) > 2) kick += c.vy - vy;
    vy = c.vy;
  }
  return kick;
}

describe("a skier off a cliff", () => {
  for (const [drop, face] of [
    [10, 4],
    [20, 6],
  ]) {
    for (const kmh of [30, 50, 70]) {
      it(`is never pushed up in the air off a ${drop} m face at ${kmh} km/h`, () => {
        expect(airKick(drop, face, kmh)).toBeLessThan(0.05);
      });
    }
  }
});
