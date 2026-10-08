// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BALLOON'S FIRE AS DRAWN, DECIDED (`pwa/src/game/balloon-fire-plan.ts`):
// the burner's flame — its length against the class's pencil flame, the
// ignition's burst, the tail lifting off the coil once the valve shuts,
// the bend in a shear — and the envelope's burn spreading from where it
// caught, faster up the gores than down, sweeping the whole envelope by
// the time the engine has it burnt through.

import { describe, expect, it } from "vitest";
import { BALLOON } from "@engine";

import {
  FLAME,
  SPREAD,
  catchPoint,
  clothNoise,
  fireFront,
  flameBend,
  flameMemory,
  spreadKey,
  stepFlame,
  type FlameNow,
} from "../pwa/src/game/balloon-fire-plan.ts";
import { envelopeLayout } from "../pwa/src/game/balloon-look.ts";

const now = (): FlameNow => ({ length: 0, cut: 0, burst: 0, bright: 0 });

describe("the burner's flame", () => {
  it("is a pencil flame of over five metres at full blast, roaring into the mouth", () => {
    const m = flameMemory();
    const n = now();
    stepFlame(m, true, 1, 2, n);
    expect(n.length).toBeGreaterThan(5);
    expect(n.length).toBeLessThan(8);
    expect(n.cut).toBe(0);
    // From the coils at the burner's height its top is well inside the mouth.
    expect(BALLOON.basket.burner + n.length).toBeGreaterThan(BALLOON.envelope.mouthHeight + 2);
  });

  it("lights with a burst that dies away", () => {
    const m = flameMemory();
    const n = now();
    stepFlame(m, true, 0.3, 0.02, n);
    const lit = n.burst;
    expect(lit).toBeGreaterThan(0.8);
    stepFlame(m, true, 1, 1, n);
    expect(n.burst).toBeLessThan(0.05);
  });

  it("goes out from the coil first, the last of it lifting away", () => {
    const m = flameMemory();
    const n = now();
    stepFlame(m, true, 1, 2, n);
    const long = n.length;
    stepFlame(m, false, 0.8, 0.1, n);
    expect(n.cut).toBeGreaterThan(0.5);
    expect(n.length).toBeCloseTo(long, 5);
    expect(n.bright).toBeGreaterThan(0);
    stepFlame(m, false, 0, 1, n);
    expect(n.bright).toBe(0);
  });

  it("is laid over by the air past it, never past its most", () => {
    expect(flameBend(0)).toBe(0);
    expect(flameBend(7)).toBeGreaterThan(0.3);
    expect(flameBend(40)).toBe(FLAME.bendMost);
  });
});

describe("the envelope on fire", () => {
  const rest = envelopeLayout().position;
  const caught = catchPoint(true, 0.4, [0, 0, 0]);
  const keys: number[] = [];
  for (let i = 0; i < rest.length; i += 3) {
    const [x, y, z] = [rest[i], rest[i + 1], rest[i + 2]];
    keys.push(spreadKey(x, y, z, caught[0], caught[1], caught[2], clothNoise(x, y, z)));
  }
  const reach = Math.max(...keys);

  it("catches low on the windward side in a shear, at the crown when cooked", () => {
    const low = catchPoint(true, 0, [0, 0, 0]);
    expect(low[1]).toBeGreaterThan(0.5);
    expect(low[1]).toBeLessThan(4);
    expect(low[2]).toBeGreaterThan(1.5);
    const crown = catchPoint(false, 0, [0, 0, 0]);
    expect(crown[1]).toBeGreaterThan(BALLOON.envelope.height - 1);
  });

  it("climbs the gores faster than it creeps down them", () => {
    const up = spreadKey(caught[0], caught[1] + 6, caught[2], caught[0], caught[1], caught[2], 0.5);
    const down = spreadKey(
      caught[0],
      caught[1] - 6,
      caught[2],
      caught[0],
      caught[1],
      caught[2],
      0.5,
    );
    expect(down).toBeGreaterThan(up * 3);
  });

  it("sweeps the whole envelope before the engine burns it through", () => {
    const sweptAt = 1 / SPREAD.sweep;
    expect(sweptAt).toBeLessThan(1);
    expect(keys.every((k) => k <= fireFront(sweptAt, reach) + 1e-6)).toBe(true);
    // A tenth of the way in, only a patch round where it caught is gone.
    const tenth = fireFront(0.1, reach);
    const gone = keys.filter((k) => k < tenth - SPREAD.edge).length / keys.length;
    expect(gone).toBeLessThan(0.05);
  });

  it("reads the same noise as the shader eats the cloth by", () => {
    for (const [x, y, z] of [
      [1, 2, 3],
      [-4.2, 9.1, 0.3],
    ]) {
      const n = clothNoise(x, y, z);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
      expect(clothNoise(x, y, z)).toBe(n);
    }
  });
});
