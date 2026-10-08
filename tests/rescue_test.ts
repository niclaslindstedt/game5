// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HURT TOO BADLY TO SKI ON (`engine/game/rescue.ts`): on a run that carries
// its injuries, a skier who has lain the time a fall is got up from and
// still carries a broken leg, a hurt spine or a torn organ is found
// INJURED and held where he lies — never stood back up — while an arm or a
// hand hurt never keeps him down.

import { describe, expect, it } from "vitest";
import { TUNING, disables, holdsHim, step, type GameEvent, type Injury } from "@engine";

import { DEATH, deathOver, injuredOf, wreckOf } from "../pwa/src/game/hud-wreck.ts";

import { stageTrial, type Staging } from "./support/injury-stage.ts";

const FEET_FIRST: Staging = { stage: { how: "fall", pose: "feet", speed: 8 }, ground: "groomed" };
const SHOULDER_INTO_TRUNK: Staging = {
  stage: { how: "ski", stuff: "trunk", speed: 12, offset: 0.5 },
  ground: "groomed",
};

function ride(s: Staging, seconds: number, gore = true) {
  const { state, input } = stageTrial(s, 0, gore);
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) {
    step(state, { ...input, reset: true });
    events.push(...state.events);
  }
  return { state, events };
}

const hurt = (kind: Injury["kind"], part: Injury["part"], ais = 3): Injury => ({
  part,
  kind,
  ais,
  t: 0,
});

describe("hurt too badly to ski on", () => {
  it("is a broken leg, the spine, the neck or a torn organ — never an arm", () => {
    expect(disables(hurt("brokenFemur", "thighL"))).toBe(true);
    expect(disables(hurt("brokenShin", "shinR"))).toBe(true);
    expect(disables(hurt("brokenPelvis", "pelvis"))).toBe(true);
    expect(disables(hurt("compressedVertebra", "back", 2))).toBe(true);
    expect(disables(hurt("neckFracture", "neck"))).toBe(true);
    expect(disables(hurt("spinalCord", "back", 5))).toBe(true);
    expect(disables(hurt("tornSpleen", "abdomen"))).toBe(true);
    // A crack in a leg is skied out, a concussion too; an arm never stops him.
    expect(disables(hurt("crackedShin", "shinL", 2))).toBe(false);
    expect(disables(hurt("concussion", "head", 2))).toBe(false);
    expect(disables(hurt("brokenArm", "armL"))).toBe(false);
    expect(disables(hurt("brokenCollarbone", "shoulderR", 2))).toBe(false);
  });

  it("holds a skier who lands feet first and breaks his legs where he lies", () => {
    const { state, events } = ride(FEET_FIRST, 10);
    const g = state.gore!;
    expect(g.dead).toBe(-1);
    expect(g.injured).toBeGreaterThanOrEqual(TUNING.crash.getUp - TUNING.dt);
    expect(g.injury).not.toBeNull();
    expect(disables(g.injury!)).toBe(true);
    // Pressed to get up every step, and past the time the engine would
    // stand him: still down.
    expect(state.skier.thrown).not.toBeNull();
    expect(holdsHim(state)).toBe(true);
    const found = events.filter((e) => e.kind === "injured");
    expect(found).toHaveLength(1);
    const e = found[0] as Extract<GameEvent, { kind: "injured" }>;
    expect(Number.isFinite(e.x + e.y + e.z)).toBe(true);
  });

  it("stands up a skier whose arm and collarbone are all he hurt", () => {
    const { state, events } = ride(SHOULDER_INTO_TRUNK, 10);
    expect(state.gore!.injured).toBe(-1);
    expect(events.some((e) => e.kind === "injured")).toBe(false);
    expect(state.skier.thrown).toBeNull();
  });

  it("is nowhere on a run that does not carry its injuries", () => {
    const { state, events } = ride(FEET_FIRST, 10, false);
    expect(state.gore).toBeUndefined();
    expect(events.some((e) => e.kind === "injured")).toBe(false);
    expect(state.skier.thrown).toBeNull();
  });
});

describe("the run ended INJURED (hud-wreck.ts)", () => {
  it("clears the glass on a death's timeline and goes white, not dark", () => {
    const w = wreckOf(null, null, DEATH.dark + DEATH.fade);
    expect(w.white).toBe(true);
    expect(w.fade).toBe(1);
    expect(w.word).toBe(1);
    expect(w.dark).toBe(1);
    // A death says so instead, dark.
    expect(wreckOf(null, 1, 2).white).toBe(false);
    expect(wreckOf(null, null, null).white).toBe(false);
  });

  it("starts the run again once it has run its course", () => {
    const { state } = ride(FEET_FIRST, 10);
    expect(injuredOf(state)).not.toBeNull();
    expect(deathOver(state)).toBe(injuredOf(state)! >= DEATH.again);
    const { state: later } = ride(FEET_FIRST, TUNING.crash.getUp + DEATH.again + 0.5);
    expect(deathOver(later)).toBe(true);
  });
});
