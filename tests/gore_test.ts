// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MORTAL WOUNDS (`engine/game/gore.ts`): only on a run that asked for
// them, a blow past what a body survives tears a piece off, crushes the
// skull, opens the trunk or runs him through on a spike — and he dies, is
// never stood back up, and his heart pumps the blood out in beats until
// it stops.

import { describe, expect, it } from "vitest";
import { GORE, GORE_PIECES, TUNING, lostPiece, step, type GameEvent } from "@engine";

import { stageTrial, type Staging } from "./support/injury-stage.ts";

const HEAD_INTO_TRUNK: Staging = {
  stage: { how: "into", pose: "head", stuff: "trunk", speed: 25 },
  ground: "groomed",
};
const SOFT_TRUNK: Staging = {
  stage: { how: "into", pose: "front", stuff: "trunk", speed: 8 },
  ground: "groomed",
};
const ON_A_TREE: Staging = {
  stage: { how: "spike", pose: "back", stuff: "trunk", speed: 12, height: 9 },
  ground: "soft",
};
const ON_ICE: Staging = { stage: { how: "fall", pose: "left", speed: 25 }, ground: "ice" };

/** A staging stepped `seconds`, every event kept. */
function ride(s: Staging, seconds: number, gore = true) {
  const { state, input } = stageTrial(s, 0, gore);
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) {
    step(state, input);
    events.push(...state.events);
  }
  return { state, events };
}

describe("mortal wounds", () => {
  it("are nowhere on a run that did not ask for them", () => {
    const { state, events } = ride(HEAD_INTO_TRUNK, 2, false);
    expect(state.gore).toBeUndefined();
    expect(events.some((e) => e.kind === "gore" || e.kind === "death")).toBe(false);
  });

  it("tear the head off a body driven head first into a trunk at 90 km/h", () => {
    const { state, events } = ride(HEAD_INTO_TRUNK, 2);
    const g = state.gore!;
    expect(lostPiece(g, "head")).toBe(true);
    expect(g.dead).toBeGreaterThanOrEqual(0);
    expect(g.cause).toBe("head");
    expect(events.filter((e) => e.kind === "death")).toHaveLength(1);
    const torn = g.torn.find((p) => p.piece === "head")!;
    expect(Number.isFinite(torn.vx + torn.vy + torn.vz)).toBe(true);
  });

  it("leave a body whole that a trunk only breaks, and stand it back up", () => {
    const { state } = ride(SOFT_TRUNK, 8);
    const g = state.gore!;
    expect(g.lost).toBe(0);
    expect(g.mortal).toBe(-1);
    expect(state.skier.thrown).toBeNull();
  });

  it("tear limbs off and open the trunk of a body thrown onto ice at 25 m/s", () => {
    const { state } = ride(ON_ICE, 1);
    const g = state.gore!;
    expect(GORE_PIECES.some((p) => lostPiece(g, p))).toBe(true);
    expect(g.open).not.toBe(0);
    expect(g.dead).toBeGreaterThanOrEqual(0);
  });

  it("run a body through that falls onto a tree's top, and hold it there", () => {
    const { state } = ride(ON_A_TREE, 4);
    const g = state.gore!;
    expect(g.impaled).not.toBeNull();
    expect(g.impaled!.stuff).toBe("tree");
    expect(g.cause).toBe("impaled");
    const b = state.skier.thrown!;
    const p = g.impaled!.point;
    // Held on the spike, slid down it no further than it holds him.
    expect(b.points[3 * p + 1]).toBeCloseTo(g.impaled!.y - GORE.impale.sink, 2);
    expect(Math.hypot(b.points[3 * p] - g.impaled!.x, b.points[3 * p + 2] - g.impaled!.z)).toBe(0);
  });

  it("never stand a mortally wounded body back up", () => {
    const { state } = ride(HEAD_INTO_TRUNK, TUNING.crash.lieFor + 3);
    expect(state.skier.thrown).not.toBeNull();
  });

  it("pump the blood out in beats while the heart beats, and only drain it after", () => {
    const { state: s } = stageTrial(ON_ICE, 0, true);
    const pulses: number[] = [];
    let stopped = -1;
    for (let i = 0; i < Math.round(10 / TUNING.dt); i++) {
      step(s, { ...s.input });
      const g = s.gore!;
      if (g.dead >= 0 && s.t - g.dead < GORE.heart.agonal * 0.5) pulses.push(g.pulse);
      if (g.dead >= 0 && g.rate === 0 && stopped < 0) stopped = s.t;
    }
    // Spurts and lulls: the pulse swings across most of its range.
    expect(Math.max(...pulses)).toBeGreaterThan(0.9);
    expect(Math.min(...pulses)).toBe(0);
    expect(stopped).toBeGreaterThan(0);
    const g = s.gore!;
    expect(g.blood).toBeGreaterThan(0.2);
    expect(g.blood).toBeLessThanOrEqual(GORE.blood.volume);
  });
});
