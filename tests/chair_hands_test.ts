// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CHAIR LEFT ONLY BY HAND (`engine/game/chair-hands.ts`): on the player's
// free ride he sits on a chair until he moves — untouched he rides round
// the top wheel and back down with the bar up; forward with the bar up
// stands him up over the unload ramp, or throws him off the seat anywhere
// else, to fall as far as there is under him. The edge and the leans do
// nothing to him, and a tuck held since before the bar went up neither.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  carrierAt,
  chairBarDown,
  createGame,
  liftPlans,
  step,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const plans = liftPlans(level);
const chairRun = level.resort!.runs.find(
  (r) => r.kind === "piste" && plans.find((p) => p.lift.id === r.from)?.lift.kind === "chair",
)!;

function onChair(hands = true): GameState {
  return createGame({
    level,
    mode: "free",
    byLift: true,
    run: chairRun.id,
    chairHands: hands,
    quiet: true,
  });
}

/** Step `run` with `input(run)` until `done` or `seconds` pass; every event. */
function ride(
  run: GameState,
  seconds: number,
  done: (run: GameState) => boolean,
  input: (run: GameState) => SkierInput = () => NEUTRAL_INPUT,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * 120; i++) {
    step(run, input(run));
    events.push(...run.events);
    if (done(run)) break;
  }
  return events;
}

const FORWARD: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };
const LOOK: SkierInput = { ...NEUTRAL_INPUT, steer: 1, lean: -1 };

describe("the safety bar", () => {
  const plan = plans.find((p) => p.lift.kind === "chair")!;
  const off = plan.length - plan.look.off;
  it("is down mid-line on the way up and up at the unload, round the wheels and on the way down", () => {
    expect(chairBarDown(plan, { u: plan.length / 2, side: 0 })).toBe(1);
    expect(chairBarDown(plan, { u: off, side: 0 })).toBe(0);
    expect(chairBarDown(plan, { u: plan.length / 2, side: 1 })).toBe(0);
    expect(chairBarDown(plan, { u: plan.length, side: 0, turn: 0.5 })).toBe(0);
  });
});

describe("a chair left only by hand", () => {
  it("is the chair's own on the lift's own chair", () => {
    const run = onChair();
    expect(run.chairHands).toBe(true);
    expect(run.skier.lift?.kind).toBe("chair");
    expect(run.skier.lift?.carrier).toBeGreaterThanOrEqual(0);
  });

  it("untouched, rides round the top and back down the line with the bar up", () => {
    const run = onChair();
    const plan = plans[run.skier.lift!.index];
    let down = false;
    const events = ride(run, 90, (r) => {
      const l = r.skier.lift;
      if (!l || l.carrier === undefined) return true;
      const at = carrierAt(plan, l.carrier, r.t);
      if (at.side === 1 && at.turn === undefined && at.u < plan.length - 40) down = true;
      return down;
    });
    expect(down).toBe(true);
    expect(run.skier.lift?.round).toBe(true);
    expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(false);
    // Facing back down the line now, sat where his chair is.
    const c = run.skier;
    expect(Math.cos(c.heading - plan.heading)).toBeLessThan(-0.9);
    const at = carrierAt(plan, run.skier.lift!.carrier!, run.t);
    expect(chairBarDown(plan, at)).toBe(0);
    expect(c.y).toBeGreaterThan(level.groundAt(c.x, c.z) + 2);
  });

  it("is never thrown off by the edge or the leans — the lens is his to look round with", () => {
    const run = onChair();
    const plan = plans[run.skier.lift!.index];
    ride(
      run,
      40,
      () => false,
      () => LOOK,
    );
    expect(run.skier.lift).not.toBeNull();
    expect(run.skier.thrown).toBeNull();
    expect(plans[run.skier.lift!.index]).toBe(plan);
  });

  it("does nothing on a tuck held since before the bar went up", () => {
    const run = onChair();
    ride(
      run,
      20,
      () => false,
      () => FORWARD,
    );
    expect(run.skier.lift).not.toBeNull();
  });

  it("stands him up over the unload ramp on a fresh press there", () => {
    const run = onChair();
    const plan = plans[run.skier.lift!.index];
    const off = plan.length - plan.look.off;
    const events = ride(
      run,
      40,
      (r) => r.skier.lift === null,
      (r) => {
        const l = r.skier.lift;
        if (!l?.carrier && l?.carrier !== 0) return NEUTRAL_INPUT;
        return carrierAt(plan, l.carrier, r.t).u >= off ? FORWARD : NEUTRAL_INPUT;
      },
    );
    expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
    expect(run.skier.lift).toBeNull();
    expect(run.skier.thrown).toBeNull();
    expect(run.skier.chairLeft).not.toBeNull();
  });

  it("throws him off the seat on the way back down, to fall the height under him", () => {
    const run = onChair();
    const plan = plans[run.skier.lift!.index];
    let high = 0;
    let pressed = false;
    const events = ride(
      run,
      120,
      (r) => pressed && !r.skier.airborne && r.skier.lift === null && r.t > 1,
      (r) => {
        const l = r.skier.lift;
        if (!l) return NEUTRAL_INPUT;
        const at = carrierAt(plan, l.carrier!, r.t);
        const c = r.skier;
        const over = c.y - level.groundAt(c.x, c.z);
        if (at.side === 1 && at.turn === undefined && over > 6) {
          high = over;
          pressed = true;
          return FORWARD;
        }
        return NEUTRAL_INPUT;
      },
    );
    expect(pressed).toBe(true);
    expect(high).toBeGreaterThan(6);
    expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
    expect(events.some((e) => e.kind === "land" || e.kind === "wipeout")).toBe(true);
  });

  it("is the old ride where the app does not ask: stood off at the top untouched", () => {
    const run = onChair(false);
    const events = ride(run, 40, (r) => r.skier.lift === null);
    expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
  });
});
