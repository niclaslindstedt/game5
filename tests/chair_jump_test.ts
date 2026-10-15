// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A JUMP OFF A CHAIR INTO THE MOUNTAIN — the cut under a top station's pad
// is a snow wall steeper than any pitch a skier rides. Thrown off a chair
// high over it, he falls into that wall and the body is put back on its
// surface a point at a time, straight up; the share of that lift that lies
// UP the face must be a position corrected, never speed kept, or the body
// is shot up the wall and tens of metres into the air (seed 861995's C1,
// in the maritime country, jumped off 17 m up: 42 m over the snow at the
// top of the throw). `rock-ground.ts`' `liftedOnto` holds it.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  carrierAt,
  createGame,
  generateLevel,
  liftPlans,
  step,
  type GameState,
} from "@engine";

const level = generateLevel(861995, { region: "maritime" });
const plan = liftPlans(level).find((p) => p.lift.id === "C1")!;
const run0 = level.resort!.runs.find((r) => r.kind === "piste" && r.from === "C1")!;

/** On C1's chair near its top, pressing forward once the chair is `at` m up
 * the line; the thrown body's highest over the snow under it, and how high
 * the seat was when he let go. */
function jumpAt(at: number): { seat: number; peak: number; thrown: boolean } {
  const run: GameState = createGame({
    level,
    mode: "free",
    byLift: true,
    run: run0.id,
    chairHands: true,
    quiet: true,
  });
  let armed = false;
  let seat = Number.NaN;
  let peak = -Infinity;
  let off = -1;
  for (let i = 0; i < 120 * 120; i++) {
    const ride = run.skier.lift;
    let input = NEUTRAL_INPUT;
    if (ride?.carrier !== undefined && off < 0) {
      const spot = carrierAt(plan, ride.carrier, run.t);
      if (spot.side === 0 && spot.u >= at) {
        input = armed ? { ...NEUTRAL_INPUT, tuck: 1 } : NEUTRAL_INPUT;
        armed = true;
        seat = run.skier.y - level.groundAt(run.skier.x, run.skier.z);
      }
    }
    step(run, input);
    if (ride && !run.skier.lift && off < 0) off = run.t;
    const b = run.skier.thrown;
    if (b) peak = Math.max(peak, b.y - level.groundAt(b.x, b.z));
    if (off >= 0 && run.t - off > 5) break;
  }
  return { seat, peak, thrown: peak > -Infinity };
}

describe("a jump off a chair into the cut under a top station", () => {
  it.each([1536, 1538, 1542, 1543])("never shoots the body up the wall (at %i m)", (at) => {
    const { seat, peak, thrown } = jumpAt(at);
    expect(seat).toBeGreaterThan(10);
    expect(thrown).toBe(true);
    expect(peak).toBeLessThan(6);
  });
});
