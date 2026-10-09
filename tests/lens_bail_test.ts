// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LEAVING A MACHINE FROM ITS COCKPIT (`camera.ts`'s `bail`): a skier who
// leaves the helicopter on a worn rung (the cockpit, the nose) into the air
// or thrown would be left in his own head with nothing to see; the lens
// stands the chase in for the rung he chose and hands it back once he is
// aboard again or has stood on his skis for `BAIL_HOLD` s.

import { describe, expect, it } from "vitest";
import { BAIL_HOLD, createLens } from "../pwa/src/game/camera.ts";

const DT = 1 / 60;

describe("the lens leaving a machine from its cockpit", () => {
  it("stands the chase in when he goes up off the machine, and hands back on his feet", () => {
    const lens = createLens(0.1, 1000);
    lens.set("helmet", true);
    lens.bail(true, false, false, DT);
    // Off the skid: a step on his feet before the fall reads as in the air.
    lens.bail(false, false, false, DT);
    lens.bail(false, true, false, DT);
    expect(lens.rung()).toBe("chase");
    expect(lens.chosen()).toBe("helmet");
    // In the air and thrown, the stand-in holds.
    for (let t = 0; t < 3; t += DT) lens.bail(false, false, true, DT);
    expect(lens.rung()).toBe("chase");
    // Stood up long enough: back to the cockpit's rung (his own helmet).
    for (let t = 0; t < BAIL_HOLD + 0.1; t += DT) lens.bail(false, false, false, DT);
    expect(lens.rung()).toBe("helmet");
  });

  it("hands back at once when he is aboard again", () => {
    const lens = createLens(0.1, 1000);
    lens.set("tips", true);
    lens.bail(true, false, false, DT);
    lens.bail(false, true, false, DT);
    expect(lens.rung()).toBe("chase");
    lens.bail(true, false, false, DT);
    expect(lens.rung()).toBe("tips");
  });

  it("leaves a booming rung, a step off on the snow and a pick by hand alone", () => {
    const chase = createLens(0.1, 1000);
    chase.set("far", true);
    chase.bail(true, false, false, DT);
    chase.bail(false, true, false, DT);
    expect(chase.rung()).toBe("far");

    const walk = createLens(0.1, 1000);
    walk.set("helmet", true);
    walk.bail(true, false, false, DT);
    for (let t = 0; t < 1; t += DT) walk.bail(false, false, false, DT);
    walk.bail(false, true, false, DT); // a hop long after stepping off
    expect(walk.rung()).toBe("helmet");

    const picked = createLens(0.1, 1000);
    picked.set("helmet", true);
    picked.bail(true, false, false, DT);
    picked.bail(false, true, false, DT);
    picked.set("far");
    for (let t = 0; t < BAIL_HOLD + 0.1; t += DT) picked.bail(false, false, false, DT);
    expect(picked.rung()).toBe("far");
  });
});
