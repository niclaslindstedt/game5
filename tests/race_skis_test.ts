// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAIR A RACE OPENS THE SKI CARD ON (`raceSkisOf`): every built
// discipline names its own class of ski, the one its field races on, and a
// mode that is no race names none, so the pair last picked stands.

import { describe, expect, it } from "vitest";

import {
  DISCIPLINES,
  DOWNHILL,
  GAME_MODES,
  SKI_CROSS,
  SLALOM,
  SPEED_SKI,
  SUPER_G,
  GIANT_SLALOM,
  isSkiId,
  raceSkisOf,
  skisById,
} from "@engine";

const CLASS = {
  slalom: "Slalom",
  giantSlalom: "Giant slalom",
  superG: "Super-G",
  downhill: "Downhill",
  skiCross: "Ski cross",
  speedSki: "Speed ski",
} as const;

describe("a race's own pair", () => {
  for (const { id, mode } of DISCIPLINES) {
    if (mode === null) continue;
    it(`${id} opens on its class's pair`, () => {
      const pair = raceSkisOf(mode);
      if (pair === null) throw new Error(`${id} names no pair`);
      expect(isSkiId(pair)).toBe(true);
      expect(skisById(pair).kind).toBe(CLASS[id as keyof typeof CLASS]);
    });
  }

  it("is the pair the field races on", () => {
    expect(raceSkisOf("slalom")).toBe(SLALOM.skis);
    expect(raceSkisOf("giantSlalom")).toBe(GIANT_SLALOM.skis);
    expect(raceSkisOf("superG")).toBe(SUPER_G.skis);
    expect(raceSkisOf("downhill")).toBe(DOWNHILL.skis);
    expect(raceSkisOf("skiCross")).toBe(SKI_CROSS.skis);
    expect(raceSkisOf("speedSki")).toBe(SPEED_SKI.skis);
  });

  it("is none for a mode that is no race", () => {
    const races = new Set(DISCIPLINES.map((d) => d.mode));
    for (const mode of GAME_MODES.filter((m) => !races.has(m))) {
      expect(raceSkisOf(mode)).toBeNull();
    }
  });
});
