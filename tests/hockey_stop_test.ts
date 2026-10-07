// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOCKEY STOP (`hockey-stop.ts`, `RunRules.hockeyStop`): a freestyle
// run that is over is ridden out by throwing the skis across on the brake
// and standing there — never by coasting on down the mountain behind the
// plate. A race's finish still coasts.

import { describe, expect, it } from "vitest";

import { botInput, createGame, hypot, NEUTRAL_INPUT, step, type GameMode } from "@engine";

/** A run of `mode` on seed 38 skied by the bot to its end, then left alone
 * for `after` s: how far he went, how fast he ended, whether the skis were
 * thrown across on the way. */
function rideOut(mode: GameMode, after: number) {
  const state = createGame({ seed: 38, mode, quiet: true, countdown: 0 });
  for (let n = 0; state.phase !== "finished" && n < 120 * 200; n++) step(state, botInput(state));
  expect(state.phase).toBe("finished");
  const x0 = state.skier.x;
  const z0 = state.skier.z;
  let thrown = 0;
  let stoppedAt = Infinity;
  let late = 0;
  for (let n = 0; n < after * 120; n++) {
    if (n === (after - 2) * 120) late = state.skier.heading;
    step(state, NEUTRAL_INPUT);
    thrown = Math.max(thrown, Math.abs(state.skier.skiAngle));
    if (state.skier.speed < 0.05 && stoppedAt === Infinity) stoppedAt = n / 120;
    if (state.skier.speed >= 0.05) stoppedAt = Infinity;
  }
  const c = state.skier;
  const turned = Math.abs(Math.atan2(Math.sin(c.heading - late), Math.cos(c.heading - late)));
  return {
    went: hypot(c.x - x0, c.z - z0),
    speed: c.speed,
    thrown,
    across: Math.abs(c.skiAngle),
    turned,
    stoppedAt,
  };
}

describe("the hockey stop after a freestyle run", () => {
  it("is every freestyle mode's, and no race's", () => {
    for (const mode of [
      "bigAir",
      "slopestyle",
      "halfpipe",
      "moguls",
      "aerials",
      "tricks",
    ] as const) {
      expect(createGame({ seed: 38, mode, quiet: true }).rules.hockeyStop).toBe(true);
    }
    for (const mode of ["slalom", "downhill", "timeTrial", "free"] as const) {
      expect(createGame({ seed: 38, mode, quiet: true }).rules.hockeyStop).toBeFalsy();
    }
  });

  it("throws the skis across and stands him still off a big air landing", () => {
    const r = rideOut("bigAir", 12);
    expect(r.thrown).toBeGreaterThan(0.5);
    expect(r.speed).toBeLessThan(0.05);
    expect(r.stoppedAt).toBeLessThan(8);
    // ...and stops, rather than riding on off the venue — stood with the
    // skis still across, never stepping round on the spot.
    expect(r.went).toBeLessThan(60);
    expect(r.across).toBeGreaterThan(0.5);
    expect(r.turned).toBeLessThan(0.05);
  });

  it("stands him still at the foot of a mogul course", () => {
    const r = rideOut("moguls", 8);
    expect(r.speed).toBeLessThan(0.05);
    expect(r.went).toBeLessThan(30);
  });
});
