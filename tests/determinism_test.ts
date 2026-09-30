// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DETERMINISM CONTRACT: the same map, the same seed and the same inputs
// give the same run, to the bit — solo, with a field, and skied by the bot
// through the harness. Nothing in `step` may read a clock or `Math.random`.

import { describe, expect, it } from "vitest";

import {
  botInput,
  createGame,
  hypot,
  hypot3,
  hypot4,
  noiseField,
  sampleNoise,
  simulateRun,
  step,
  TUNING,
  valueNoise,
  type GameState,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

function fingerprint(state: GameState): string {
  const c = state.skier;
  const skiers = [c, ...state.rivals.map((r) => r.run.skier)];
  return skiers
    .map((s) => [s.x, s.y, s.z, s.vx, s.vy, s.vz, s.q.w, s.q.x, s.edge, s.crouch].join(","))
    .join("|");
}

function race(seconds: number, rivals: number): string {
  const state = createGame({ level: syntheticLevel(), seed: 7, rivals, quiet: true });
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) step(state, botInput(state));
  return fingerprint(state);
}

describe("determinism", () => {
  it("a bot-skied solo run replays exactly", () => {
    expect(race(30, 0)).toBe(race(30, 0));
  });

  it("a race with a field replays exactly", () => {
    expect(race(30, 3)).toBe(race(30, 3));
  });

  it("the harness's digest is stable", () => {
    const level = syntheticLevel();
    const a = simulateRun(1, { level });
    const b = simulateRun(1, { level: syntheticLevel() });
    expect(a.digest).toBe(b.digest);
    expect(a.time).toBe(b.time);
  });

  it("the field's pace is dealt off the run's own seed", () => {
    const pace = (seed: number) =>
      createGame({ level: syntheticLevel(), seed, quiet: true }).rivals.map((r) => r.pace);
    expect(pace(3)).toEqual(pace(3));
    expect(pace(3)).not.toEqual(pace(4));
  });

  // The engine's own `hypot` family and the noise field it bakes the country
  // through stand in for `Math.hypot` and `valueNoise` on the hot paths, and
  // the digests were cut under the builtins: they must be the same BITS.
  it("hypot, hypot3 and hypot4 return Math.hypot's bits", () => {
    const edges = [0, -0, 1, -1, 3, 4, 0.1, 5e-324, 1e-310, 1e-160, 1e160, 1e308, -1e308];
    const odd = [Infinity, -Infinity, Number.NaN];
    for (const a of [...edges, ...odd]) {
      for (const b of [...edges, ...odd]) {
        expect(Object.is(hypot(a, b), Math.hypot(a, b))).toBe(true);
        for (const c of [0, -2, 1e-300, 7.5, Infinity, Number.NaN]) {
          expect(Object.is(hypot3(a, b, c), Math.hypot(a, b, c))).toBe(true);
          expect(Object.is(hypot4(a, b, c, 0.3), Math.hypot(a, b, c, 0.3))).toBe(true);
        }
      }
    }
    // A fixed spread of magnitudes, off a little LCG so the case is itself
    // deterministic: the metres the engine lives in, and far either side.
    let r = 12345;
    const next = (): number => {
      r = (Math.imul(r, 1103515245) + 12345) >>> 0;
      const u = r / 4294967296 - 0.5;
      return u * 10 ** ((r % 40) - 20);
    };
    let wrong = 0;
    for (let i = 0; i < 200_000; i++) {
      const a = next();
      const b = next();
      const c = next();
      const d = next();
      if (!Object.is(hypot(a, b), Math.hypot(a, b))) wrong++;
      if (!Object.is(hypot3(a, b, c), Math.hypot(a, b, c))) wrong++;
      if (!Object.is(hypot4(a, b, c, d), Math.hypot(a, b, c, d))) wrong++;
    }
    expect(wrong).toBe(0);
  });

  it("a noise field returns valueNoise's bits, in and out of its kept square", () => {
    const field = noiseField(170, 9001);
    let wrong = 0;
    for (let i = 0; i < 20_000; i++) {
      // Mostly neighbours (the kept square reused), now and then a leap.
      const x = i % 97 === 0 ? i * 37.3 : 400 + (i % 500) * 1.7;
      const z = i % 89 === 0 ? -i * 11.9 : 300 + Math.floor(i / 500) * 2;
      if (!Object.is(sampleNoise(field, x, z), valueNoise(x, z, 170, 9001))) wrong++;
    }
    expect(wrong).toBe(0);
  });
});
