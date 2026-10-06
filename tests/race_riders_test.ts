// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUILD A RACE OPENS THE DRESS CARD ON (`raceRiderOf`): every built
// discipline names a weight that suits it — and so does every built
// freestyle format — and a mode that is neither names none, so the build
// last picked stands.

import { describe, expect, it } from "vitest";

import { DISCIPLINES, FREESTYLE, GAME_MODES, RIDERS, isRiderId, raceRiderOf } from "@engine";

const massOf = (mode: Parameters<typeof raceRiderOf>[0]): number => {
  const id = raceRiderOf(mode);
  if (id === null) throw new Error(`${mode} names no build`);
  const rider = RIDERS.find((r) => r.id === id);
  if (!rider) throw new Error(`${id} is no build`);
  return rider.mass;
};

describe("a race's own build", () => {
  for (const { id, mode } of [...DISCIPLINES, ...FREESTYLE]) {
    if (mode === null) continue;
    it(`${id} names a build`, () => {
      const rider = raceRiderOf(mode);
      expect(rider).not.toBeNull();
      expect(isRiderId(rider ?? "")).toBe(true);
    });
  }

  it("is the build each discipline asks for", () => {
    expect(raceRiderOf("slalom")).toBe("medium");
    expect(raceRiderOf("giantSlalom")).toBe("solid");
    expect(raceRiderOf("superG")).toBe("solid");
    expect(raceRiderOf("downhill")).toBe("solid");
    expect(raceRiderOf("skiCross")).toBe("solid");
    expect(raceRiderOf("speedSki")).toBe("heavy");
    // Big air: the competition field's measured mean (~72 kg) is nearest
    // the medium build.
    expect(raceRiderOf("bigAir")).toBe("medium");
    // Slopestyle: the same field, the same build.
    expect(raceRiderOf("slopestyle")).toBe("medium");
  });

  it("grows heavier the more a race is the tuck alone", () => {
    expect(massOf("slalom")).toBeLessThan(massOf("giantSlalom"));
    expect(massOf("giantSlalom")).toBeLessThanOrEqual(massOf("superG"));
    expect(massOf("slalom")).toBeLessThan(massOf("superG"));
    expect(massOf("superG")).toBeLessThanOrEqual(massOf("downhill"));
    expect(massOf("downhill")).toBeLessThan(massOf("speedSki"));
  });

  it("is none for a mode that is no race and no freestyle format", () => {
    const races = new Set([...DISCIPLINES, ...FREESTYLE].map((d) => d.mode));
    for (const mode of GAME_MODES.filter((m) => !races.has(m))) {
      expect(raceRiderOf(mode)).toBeNull();
    }
  });
});
