// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A GONDOLA WALKED ABOARD (`engine/game/lift-skis.ts`): the rider steps out
// of his bindings at the station's door and carries the pair on his
// shoulder through the hall, stands it in the rack on his cabin's back
// door leaf, steps in on foot and rides with it there — and at the top
// takes it back onto his shoulder, walks out onto the pad, lays it down and
// clicks back in.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  boardingRing,
  createGame,
  liftPlans,
  seatedShare,
  standSkier,
  step,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";
import { afterskiOf } from "../pwa/src/game/afterski-hud.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const plan = liftPlans(level).find((p) => p.lift.kind === "gondola")!;

function ride(
  run: GameState,
  seconds: number,
  done: (run: GameState) => boolean,
  input: SkierInput = NEUTRAL_INPUT,
  each: (run: GameState) => void = () => {},
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * 120; i++) {
    step(run, input);
    events.push(...run.events);
    each(run);
    if (done(run)) break;
  }
  return events;
}

function atRing(): GameState {
  const run = createGame({ level, mode: "free", crowd: 0, quiet: true });
  const ring = boardingRing(plan);
  standSkier(run, ring.x, ring.z, plan.heading + Math.PI);
  return run;
}

describe("walking aboard a gondola with the skis", () => {
  it("shoulders the pair at the door, racks it in the cabin and rides with it there", () => {
    const run = atRing();
    let carried = false;
    const events = ride(
      run,
      90,
      (r) => r.skier.lift?.phase === "ride" && seatedShare(r.skier.lift) >= 1,
      NEUTRAL_INPUT,
      (r) => {
        if (r.skier.town?.phase === "walk") carried = true;
      },
    );
    expect(carried).toBe(true);
    const lift = run.skier.lift!;
    expect(seatedShare(lift)).toBeCloseTo(1, 5);
    // Out of his hands and into the rack: the pair is the cabin's now.
    expect(run.skier.town ?? null).toBeNull();
    expect(lift.skis).toHaveLength(2);
    expect(events.some((e) => e.kind === "town" && e.phase === "lay")).toBe(true);
    // Carried up with him, stood upright beside him in the cabin.
    ride(run, 4, () => false);
    for (const ski of run.skier.lift!.skis!) {
      const [tx, ty, tz, bx, by, bz] = ski.ends;
      expect(Math.hypot((tx + bx) / 2 - run.skier.x, (tz + bz) / 2 - run.skier.z)).toBeLessThan(
        2.5,
      );
      expect(ty - by).toBeGreaterThan(1.2);
    }
  });

  it("steps him in through the door of a cabin hanging plumb, never through its walls", () => {
    const run = atRing();
    const side = plan.look.gauge / 2;
    // The cabin's shell about its grip, m (`lift-carriers.ts`'s
    // `CABIN_HALF`, `own-cabin.ts`'s door): half its width across the line
    // and half its length along it, and half the door's opening; a body's
    // half depth.
    const wall = { across: 1.0, along: 1.08, door: 0.5, body: 0.2 };
    let stepped = false;
    ride(
      run,
      90,
      (r) => r.skier.lift?.phase === "ride" && seatedShare(r.skier.lift) >= 1,
      NEUTRAL_INPUT,
      (r) => {
        const l = r.skier.lift;
        if (l?.phase !== "ride" || l.rack !== undefined) return;
        const k = seatedShare(l);
        if (k <= 0 || k >= 1) return;
        stepped = true;
        const c = r.skier;
        const gx = plan.lift.bottom.x + plan.dx * l.u + plan.dz * side;
        const gz = plan.lift.bottom.z + plan.dz * l.u - plan.dx * side;
        const along = (c.x - gx) * plan.dx + (c.z - gz) * plan.dz;
        const across = (c.x - gx) * plan.dz - (c.z - gz) * plan.dx;
        // Through the flank only where the door is open…
        if (Math.abs(across - wall.across) < wall.body)
          expect(Math.abs(along)).toBeLessThan(wall.door - wall.body + 1e-6);
        // …and inside, clear of its back and front walls.
        if (across < wall.across) expect(Math.abs(along)).toBeLessThan(wall.along - wall.body);
        // Plumb while he steps in: the cabin drawn on its rail is where the
        // engine has it.
        expect(Math.abs(l.swing)).toBeLessThan(1e-9);
      },
    );
    expect(stepped).toBe(true);
  });

  it("takes the pair back out at the top and clicks back into it off the pad", () => {
    const run = atRing();
    ride(run, 90, (r) => r.skier.lift?.phase === "ride" && seatedShare(r.skier.lift) >= 1);
    let shouldered = false;
    // On foot through the station and out onto the pad is no town: the
    // HUD never calls one over it.
    let townCalled = false;
    // The tuck held skips him up the line.
    ride(
      run,
      240,
      (r) => r.skier.lift === null && shouldered && r.skier.town == null,
      { ...NEUTRAL_INPUT, tuck: 1 },
      (r) => {
        if (r.skier.town?.phase === "walk") shouldered = true;
        if (afterskiOf(r)?.kind === "town") townCalled = true;
      },
    );
    expect(shouldered).toBe(true);
    expect(townCalled).toBe(false);
    expect(run.skier.lift).toBeNull();
    expect(run.skier.town ?? null).toBeNull();
  });
});
