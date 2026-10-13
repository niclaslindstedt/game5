// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABLE GRIND (`engine/game/cable.ts`): on a free ride a skier come
// down onto a lift's rope from above is put on it and slides it — the
// running rope's friction and its fall his only pull — pops off it on the
// jump let go and lands back on it, and is thrown off it onto the snow when
// a carrier comes along the rope to him. Every second of it pays into the
// combo (`tricks.ts`), and the score is kept on a free ride.

import { describe, expect, it } from "vitest";

import {
  CABLE,
  LYNX,
  NEUTRAL_INPUT,
  createGame,
  liftPlans,
  ropeAt,
  ropeOver,
  standSkier,
  step,
  type GameEvent,
  type GameState,
  type LiftPlan,
  type SkierInput,
  type SkiSpec,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const plans = liftPlans(level);

/** A free ride dropped onto `plan`'s rope `side` half way up its line,
 * feet a little over it, going down the line at `speed` — his skis square
 * across it, or `along` it. */
function dropped(
  plan: LiftPlan,
  side: 0 | 1,
  speed = 6,
  at = 0.5,
  turn = Math.PI / 2,
  spec?: SkiSpec,
): GameState {
  const run = createGame({ level, mode: "free", quiet: true, ...(spec ? { spec } : {}) });
  const u = plan.length * at;
  const p = ropeOver(plan, side, u);
  standSkier(run, p.x, p.z, plan.heading + Math.PI + turn);
  const c = run.skier;
  c.y = p.y + c.spec.cogHeight + 0.2;
  c.vx = -plan.dx * speed;
  c.vz = -plan.dz * speed;
  c.vy = -1;
  c.airborne = true;
  return run;
}

function ride(
  run: GameState,
  seconds: number,
  input: (i: number) => SkierInput = () => NEUTRAL_INPUT,
  done: (run: GameState, i: number) => boolean = () => false,
): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < seconds * 120; i++) {
    step(run, input(i));
    out.push(...run.events);
    if (done(run, i)) break;
  }
  return out;
}

const chair = plans.find((p) => p.lift.kind === "chair")!;

describe("the cable grind (cable.ts)", () => {
  it("has a chairlift to grind on the test map", () => {
    expect(chair).toBeDefined();
  });

  it("puts a skier come down onto a rope on it, and holds him on it", () => {
    const run = dropped(chair, 1);
    const events = ride(run, 0.5);
    expect(events.some((e) => e.kind === "grind" && e.phase === "on")).toBe(true);
    const c = run.skier;
    expect(c.grind).toBeTruthy();
    // On the rope: his feet on its top.
    const u = c.grind!.u;
    expect(c.y - c.spec.cogHeight).toBeCloseTo(ropeAt(chair, u), 3);
    expect(c.airborne).toBe(false);
  });

  it("is a free ride's only: a race never puts him on a rope", () => {
    const run = dropped(chair, 1);
    run.rules = { ...run.rules, cables: false };
    ride(run, 0.3);
    expect(run.skier.grind ?? null).toBe(null);
  });

  it("pays a grind into the combo, and banks it on the snow", () => {
    const run = dropped(chair, 1);
    const events = ride(run, 0.6);
    expect(events.some((e) => e.kind === "trick" && e.trick === "grind")).toBe(true);
    expect(run.tricks.base).toBeGreaterThan(CABLE.element);
  });

  it("pops off the rope on the jump let go and lands back on it", () => {
    const run = dropped(chair, 1, 4);
    ride(run, 0.3);
    expect(run.skier.grind).toBeTruthy();
    // Held a beat, then let go.
    const events = ride(
      run,
      3,
      (i) => ({ ...NEUTRAL_INPUT, jump: i < 10 }),
      (r, i) => i > 20 && !!r.skier.grind && r.skier.grind.time > 0.2,
    );
    const ons = events.filter((e) => e.kind === "grind" && e.phase === "on").length;
    const offs = events.filter((e) => e.kind === "grind" && e.phase === "off").length;
    expect(offs).toBeGreaterThanOrEqual(1);
    expect(ons).toBeGreaterThanOrEqual(1);
    expect(run.skier.thrown).toBe(null);
  });

  it("is thrown off it onto the snow by a carrier coming along the rope", () => {
    // Down the UP rope: the chairs come up it at him.
    const run = dropped(chair, 0, 3, 0.4);
    const events = ride(run, 30, undefined, (r) => r.skier.thrown !== null);
    const wipe = events.find((e) => e.kind === "wipeout");
    expect(wipe && wipe.kind === "wipeout" ? wipe.cause : null).toBe("cable");
    expect(run.skier.grind ?? null).toBe(null);
  });

  it("throws the ollie up onto a low rope the jump was popped under", () => {
    const run = dropped(chair, 1);
    const c = run.skier;
    c.y -= 3;
    c.vy = 3;
    c.popped = 0.05;
    ride(run, 1 / 120);
    expect(c.grind).toBeTruthy();
  });

  it("puts a rope come down onto along the skis between his legs: he tips off it, hurt", () => {
    const run = dropped(chair, 1, 6, 0.5, 0);
    const events = ride(run, 0.2);
    expect(run.skier.grind ?? null).toBe(null);
    expect(events.some((e) => e.kind === "grind" && e.phase === "straddle")).toBe(true);
    const wipe = events.find((e) => e.kind === "wipeout");
    expect(wipe && wipe.kind === "wipeout" ? wipe.cause : null).toBe("straddle");
    expect(run.skier.thrown).not.toBe(null);
    // The steel up into the crotch: the pelvis hurt at once.
    expect(run.skier.body.injuries.some((i) => i.part === "pelvis")).toBe(true);
  });

  it("lets a board land along the rope: no legs apart to come down astride", () => {
    const run = dropped(chair, 1, 6, 0.5, 0, LYNX);
    ride(run, 0.3);
    expect(run.skier.grind).toBeTruthy();
  });

  it("swaps the skis half round on a tap, never along the rope", () => {
    const run = dropped(chair, 1);
    ride(run, 0.3);
    const before = run.skier.grind!.target;
    ride(run, 0.1, () => ({ ...NEUTRAL_INPUT, steer: 1 }));
    expect(Math.abs(Math.cos(run.skier.grind!.target))).toBeLessThan(0.01);
    expect(Math.abs(run.skier.grind!.target - before)).toBeCloseTo(Math.PI, 3);
  });

  it("drops nobody onto a rope he is climbing past", () => {
    const run = dropped(chair, 1);
    run.skier.vy = 3;
    ride(run, 1 / 120);
    expect(run.skier.grind ?? null).toBe(null);
  });
});
