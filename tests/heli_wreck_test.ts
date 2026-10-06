// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WRECK ON THE BODY (`defs/heli-wreck.ts`, `body.ts`): a helicopter
// crashed with the skier on its skid hands his spine the snow's stop of
// its fall at once, and its fireball's heat burns him — summed while it
// burns, judged once as it goes out, and less the further off he lies.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  WRECK,
  createGame,
  fireFlux,
  fireballAt,
  fireballOf,
  step,
  type GameEvent,
  type GameState,
  type InjuryKind,
  type SkierInput,
} from "@engine";

import { levelFor } from "./support/levels.ts";

const level = levelFor(1);
const hands = (collective: number): SkierInput => ({
  ...NEUTRAL_INPUT,
  heli: { collective, pitch: 0, roll: 0, pedal: 0 },
});
const BURNS = new Set<InjuryKind>([
  "burntFace",
  "facialBurns",
  "deepFacialBurns",
  "burntNeck",
  "airwayBurn",
  "burntHand",
  "handBurns",
  "burntArm",
  "armBurns",
  "burntLeg",
  "legBurns",
]);

/** Climbed for `climb` s at full collective, then let down on `down` until
 * it crashes: the run, and every event of the crash's step. */
function crashed(climb: number, down: number): { s: GameState; crash: GameEvent[] } {
  const s = createGame({ level, mode: "free", heli: true, crowd: 0, quiet: true });
  for (let i = 0; i < climb * 120; i++) step(s, hands(0.95));
  for (let i = 0; i < 60 * 120 && s.heli!.mode !== "wreck"; i++) step(s, hands(down));
  expect(s.heli!.mode).toBe("wreck");
  return { s, crash: [...s.events] };
}

describe("the fireball's heat", () => {
  const full = fireballOf(WRECK.fire.fuel * WRECK.fire.share);

  it("is the ball's own skin inside it, and a sphere's view of it outside", () => {
    expect(fireFlux(2, 10, 1)).toBe(WRECK.fire.emissive);
    expect(fireFlux(20, 10, 1)).toBeCloseTo(WRECK.fire.emissive / 4);
    expect(fireFlux(2, 10, 0.5)).toBe(WRECK.fire.emissive / 2);
  });

  it("swells to its size, lifts off and burns out over its life", () => {
    const early = fireballAt(0.05);
    const grown = fireballAt(full.life * 0.4);
    const late = fireballAt(full.life);
    expect(early.radius).toBeLessThan(grown.radius);
    expect(grown.radius).toBeGreaterThan((full.diameter / 2) * 0.9);
    expect(late.height - late.radius * 0.55).toBeGreaterThan(10);
    expect(early.glow).toBeGreaterThan(0.9);
    expect(late.glow).toBe(0);
  });
});

describe("a helicopter crashed with the skier on its skid", () => {
  it("drives the snow's stop of its fall up his spine on the step it comes down", () => {
    const soft = crashed(2, 0.3);
    const hard = crashed(6, 0.1);
    expect(hard.s.heli!.wreck!.sink).toBeGreaterThan(soft.s.heli!.wreck!.sink);
    for (const { s, crash } of [soft, hard]) {
      const spine = crash.filter((e) => e.kind === "injury" && e.part === "back");
      expect(spine.length).toBe(1);
      expect(s.skier.body.impact?.source).toBe("heli");
    }
    // A fall stopped over the gear's crush is a compression fracture at the
    // least, and harder it reaches the cord.
    const worst = (c: GameEvent[]) =>
      Math.max(...c.map((e) => (e.kind === "injury" && e.part === "back" ? e.ais : 0)));
    expect(worst(soft.crash)).toBeGreaterThanOrEqual(2);
    expect(worst(hard.crash)).toBeGreaterThanOrEqual(worst(soft.crash));
  });

  it("burns him once, as the fireball goes out — never before", () => {
    const { s } = crashed(3, 0.1);
    const life = fireballAt(0).life;
    const burnt: { t: number; kind: InjuryKind }[] = [];
    while (s.heli!.mode === "wreck" && s.heli!.t < life + 0.5) {
      step(s, NEUTRAL_INPUT);
      for (const e of s.events)
        if (e.kind === "injury" && BURNS.has(e.injury))
          burnt.push({ t: s.heli!.t, kind: e.injury });
    }
    expect(s.skier.body.heat).toBeGreaterThan(100);
    expect(burnt.length).toBeGreaterThan(3);
    for (const b of burnt) expect(b.t).toBeGreaterThanOrEqual(life);
    expect(new Set(burnt.map((b) => b.t)).size).toBe(1);
  });

  it("burns nobody far from it, and is mended with him on the pad", () => {
    const { s } = crashed(3, 0.1);
    // Stood a hundred metres off instead, the ball's view of him is small.
    const w = s.heli!.wreck!;
    const far = fireFlux(100, fireballAt(1).radius, 1) ** (4 / 3) * fireballAt(0).life;
    expect(far).toBeLessThan(105 / 2);
    expect(w.aboard).toBe(true);
    while (s.heli!.mode === "wreck") step(s, NEUTRAL_INPUT);
    expect(s.skier.body.heat).toBe(0);
    expect(s.skier.body.injuries).toHaveLength(0);
  });
});
