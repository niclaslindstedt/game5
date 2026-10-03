// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT RIDE (`engine/game/lift-ride.ts`): on a free ride a skier who
// rides into a lift's load zone is carried to its top — a chair seated and
// stood up over the ramp on its pad, a gondola inside its cabin and walked
// out facing down the mountain, a drag pulled up its track on his skis —
// and a free ride begun on a lift arrives at the top of the chair whose run
// passes nearest the spot picked and is led onto that run until he takes
// the controls. A race never boards one.

import { describe, expect, it } from "vitest";

import {
  LIFT_LOOK,
  NEUTRAL_INPUT,
  TUNING,
  angleDiff,
  chairLane,
  createGame,
  liftPlans,
  standSkier,
  stationHouses,
  step,
  type GameEvent,
  type GameState,
  type LiftPlan,
  type SkierInput,
} from "@engine";
import { signsOf } from "../pwa/src/game/station-plan.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);

/** Step a run with `input` until `done` or `seconds` run out; every event. */
function ride(
  run: GameState,
  seconds: number,
  done: (run: GameState) => boolean,
  input: SkierInput = NEUTRAL_INPUT,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * 120; i++) {
    step(run, input);
    events.push(...run.events);
    if (done(run)) break;
  }
  return events;
}

/** A free ride stood in a lift's load zone, facing up its line. */
function atEntry(plan: LiftPlan): GameState {
  const run = createGame({ level, mode: "free", quiet: true });
  const e = plan.look.entry;
  const x = plan.lift.bottom.x + plan.dx * e.at + plan.dz * e.side;
  const z = plan.lift.bottom.z + plan.dz * e.at - plan.dx * e.side;
  standSkier(run, x, z, plan.heading);
  return run;
}

const plans = liftPlans(level);
const of = (kind: LiftPlan["lift"]["kind"]) => plans.find((p) => p.lift.kind === kind);

describe("riding a lift on a free ride", () => {
  it("has a chair, a gondola and a drag on the map", () => {
    expect(of("chair")).toBeDefined();
    expect(of("gondola")).toBeDefined();
    expect(of("drag")).toBeDefined();
  });

  it("boards a chair, carries him seated up the rope and stands him on the ramp", () => {
    const plan = of("chair")!;
    const run = atEntry(plan);
    step(run, NEUTRAL_INPUT);
    expect(run.skier.lift?.phase).toBe("board");
    let highest = 0;
    let lowest = Infinity;
    const events = ride(run, 600, (r) => {
      const c = r.skier;
      if (c.lift?.phase === "ride") {
        highest = Math.max(highest, c.y - level.groundAt(c.x, c.z));
        // Once sat: the chair scoops him up off the load line first.
        if (c.lift.t > TUNING.lift.scoop) lowest = Math.min(lowest, c.y - level.groundAt(c.x, c.z));
      }
      return c.lift === null;
    });
    const off = events.find((e) => e.kind === "lift" && e.phase === "off");
    expect(off).toBeDefined();
    // Carried clear of the snow out on the line, and down to the ramp sat
    // with his skis on it, never in it…
    expect(highest).toBeGreaterThan(4);
    expect(lowest).toBeGreaterThan(TUNING.lift.sit - 1e-6);
    // …and stood up over the ramp, LIFT_LOOK's `off` short of the top.
    const c = run.skier;
    const fromTop = Math.hypot(c.x - plan.lift.top.x, c.z - plan.lift.top.z);
    expect(fromTop).toBeLessThan(plan.look.off + plan.look.gauge + 2);
    expect(events.filter((e) => e.kind === "lift" && e.phase === "tower").length).toBe(
      plan.supports.length - 2,
    );
  });

  it("carries a drag's rider up its track on his skis", () => {
    const plan = of("drag")!;
    const run = atEntry(plan);
    let worst = 0;
    ride(run, 600, (r) => {
      const c = r.skier;
      if (c.lift?.phase === "ride")
        worst = Math.max(worst, Math.abs(c.y - level.groundAt(c.x, c.z) - c.spec.cogHeight));
      return c.lift === null;
    });
    expect(worst).toBeLessThan(0.6);
    const c = run.skier;
    expect(Math.hypot(c.x - plan.lift.top.x, c.z - plan.lift.top.z)).toBeLessThan(
      plan.look.off + 4,
    );
  });

  it("takes a gondola's rider in at its door and walks him out facing down", () => {
    const plan = of("gondola")!;
    const run = atEntry(plan);
    ride(run, 900, (r) => r.skier.lift === null);
    const c = run.skier;
    expect(Math.hypot(c.x - plan.lift.top.x, c.z - plan.lift.top.z)).toBeLessThan(20);
    expect(Math.abs(angleDiff(c.heading, plan.heading + Math.PI))).toBeLessThan(0.2);
  });

  it("will not take a skier coming in too fast or facing away", () => {
    const plan = of("chair")!;
    const run = atEntry(plan);
    standSkier(run, run.skier.x, run.skier.z, plan.heading + Math.PI);
    step(run, NEUTRAL_INPUT);
    expect(run.skier.lift).toBeNull();
    const fast = atEntry(plan);
    fast.skier.vx = plan.dx * (LIFT_LOOK.chair.entry.fastest + 3);
    fast.skier.vz = plan.dz * (LIFT_LOOK.chair.entry.fastest + 3);
    fast.skier.speed = LIFT_LOOK.chair.entry.fastest + 3;
    step(fast, NEUTRAL_INPUT);
    expect(fast.skier.lift).toBeNull();
  });

  it("is a free ride's alone: a race never boards", () => {
    const plan = of("chair")!;
    const run = createGame({ level, mode: "race", rivals: 0, countdown: 0, quiet: true });
    const e = plan.look.entry;
    standSkier(
      run,
      plan.lift.bottom.x + plan.dx * e.at + plan.dz * e.side,
      plan.lift.bottom.z + plan.dz * e.at - plan.dx * e.side,
      plan.heading,
    );
    step(run, NEUTRAL_INPUT);
    expect(run.skier.lift).toBeNull();
  });

  it("puts a skier who will not wait at the top", () => {
    const plan = of("chair")!;
    const run = atEntry(plan);
    ride(run, 3, (r) => r.skier.lift?.phase === "ride");
    step(run, { ...NEUTRAL_INPUT, reset: true });
    expect(run.skier.lift).toBeNull();
    expect(Math.hypot(run.skier.x - plan.lift.top.x, run.skier.z - plan.lift.top.z)).toBeLessThan(
      plan.look.off + plan.look.gauge + 2,
    );
  });
});

describe("a free ride begun on a lift", () => {
  const resort = level.resort!;
  // The spot: well down a run off a chair that drops away off its top's
  // pad — one a rider stood off the chair can be led down onto.
  const target = resort.runs.find((r) => {
    const top = plans.find((p) => p.lift.id === r.from && p.lift.kind === "chair")?.lift.top;
    return (
      r.kind === "piste" &&
      !!top &&
      r.points.some(
        (p) =>
          p.y < top.y - TUNING.lift.drop - 1 &&
          Math.hypot(p.x - top.x, p.z - top.z) < TUNING.lift.joinFar - 10,
      )
    );
  })!;
  const spot = target.points[Math.floor(target.points.length / 3)];

  it("starts seated on the chair whose run passes nearest the spot", () => {
    const run = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    const lift = run.skier.lift!;
    expect(lift.phase).toBe("ride");
    expect(lift.id).toBe(target.from);
    expect(resort.runs[lift.lead!.run].from).toBe(target.from);
    const plan = plans[lift.index];
    expect(plan.length - lift.u).toBeGreaterThan(50);
  });

  it("is stood off at the top, led over the lip and onto the run, then let go", () => {
    const run = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    const pad = run.skier.lift!;
    const plan = plans[pad.index];
    const padY = plan.lift.top.y;
    const events = ride(run, 120, (r) => r.skier.lift === null);
    expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
    expect(events.some((e) => e.kind === "lift" && e.phase === "free")).toBe(true);
    // Down off the pad, on the run he picked.
    const c = run.skier;
    expect(c.y).toBeLessThan(padY - 3);
    const r = resort.runs[pad.lead!.run];
    const near = Math.min(...r.points.map((p) => Math.hypot(p.x - c.x, p.z - c.z)));
    expect(near).toBeLessThan(25);
    expect(c.thrown).toBeNull();
  });

  it("leads him straight down the lane off the ramp, then the way the signs point, never through the house", () => {
    const run = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    const lead = run.skier.lift!;
    const plan = plans[lead.index];
    const lane = chairLane(plan);
    const houses = plans.flatMap((p) => stationHouses(level, p));
    const frame = (x: number, z: number) => ({
      u: (x - plan.lift.bottom.x) * plan.dx + (z - plan.lift.bottom.z) * plan.dz,
      v: (x - plan.lift.bottom.x) * plan.dz - (z - plan.lift.bottom.z) * plan.dx,
    });
    const way = signsOf(level, plan).find((s) => s.run === resort.runs[lead.lead!.run].id)!.way;
    let laned = 0;
    let parted = false;
    let turned = 0;
    ride(run, 120, (r) => {
      const c = r.skier;
      if (c.lift?.phase !== "lead") return c.lift === null;
      // Never inside a station house.
      for (const h of houses) {
        const a = (c.x - h.x) * h.plan.dx + (c.z - h.z) * h.plan.dz;
        const b = (c.x - h.x) * h.plan.dz - (c.z - h.z) * h.plan.dx;
        expect(Math.max(Math.abs(a) - h.halfLength, Math.abs(b) - h.halfWidth)).toBeGreaterThan(0);
      }
      const { u, v } = frame(c.x, c.z);
      // Down the lane to the parting…
      if (u >= lane.exit - TUNING.lift.turnIn) parted = true;
      if (!parted && u > plan.length) {
        expect(Math.abs(v - lane.v)).toBeLessThan(1.5);
        laned++;
      }
      // …and off it the way his run's sign points.
      if (turned === 0 && Math.abs(v - lane.v) > 6) turned = Math.sign(v - lane.v);
      return false;
    });
    expect(laned).toBeGreaterThan(0);
    expect(turned).toBe(way);
  });

  it("hands the skis back at the first touch of a control", () => {
    const run = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    ride(run, 120, (r) => r.skier.lift?.phase === "lead");
    expect(run.skier.lift?.phase).toBe("lead");
    step(run, { ...NEUTRAL_INPUT, steer: 1 });
    expect(run.skier.lift).toBeNull();
  });

  it("replays to the figure", () => {
    const a = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    const b = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    ride(a, 40, () => false);
    ride(b, 40, () => false);
    expect([a.skier.x, a.skier.y, a.skier.z]).toEqual([b.skier.x, b.skier.y, b.skier.z]);
  });
});
