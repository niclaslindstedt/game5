// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUILD A RACE OPENS THE DRESS CARD ON (`raceRiderOf`): every built
// discipline names a weight that suits it, and a mode that is no race names
// none, so the build last picked stands.

import { describe, expect, it } from "vitest";

import { DISCIPLINES, GAME_MODES, RIDERS, isRiderId, raceRiderOf } from "@engine";

const massOf = (mode: Parameters<typeof raceRiderOf>[0]): number => {
  const id = raceRiderOf(mode);
  if (id === null) throw new Error(`${mode} names no build`);
  const rider = RIDERS.find((r) => r.id === id);
  if (!rider) throw new Error(`${id} is no build`);
  return rider.mass;
};

describe("a race's own build", () => {
  for (const { id, mode } of DISCIPLINES) {
    if (mode === null) continue;
    it(`${id} names a build`, () => {
      const rider = raceRiderOf(mode);
      expect(rider).not.toBeNull();
      expect(isRiderId(rider ?? "")).toBe(true);
    });
  }

  it("is the build each discipline asks for", () => {
    expect(raceRiderOf("slalom")).toBe("medium");
    expect(raceRiderOf("superG")).toBe("solid");
    expect(raceRiderOf("downhill")).toBe("solid");
    expect(raceRiderOf("speedSki")).toBe("heavy");
  });

  it("grows heavier the more a race is the tuck alone", () => {
    expect(massOf("slalom")).toBeLessThan(massOf("superG"));
    expect(massOf("superG")).toBeLessThanOrEqual(massOf("downhill"));
    expect(massOf("downhill")).toBeLessThan(massOf("speedSki"));
  });

  it("is none for a mode that is no race", () => {
    const races = new Set(DISCIPLINES.map((d) => d.mode));
    for (const mode of GAME_MODES.filter((m) => !races.has(m))) {
      expect(raceRiderOf(mode)).toBeNull();
    }
  });
});
