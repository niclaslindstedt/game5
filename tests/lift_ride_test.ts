// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT RIDE (`engine/game/lift-ride.ts`): on a free ride a skier who
// rides into a lift's load zone is carried to its top — a chair seated and
// stood up over the ramp on its pad, a gondola inside its cabin and walked
// out facing down the mountain, a drag pulled up its track on his skis —
// and a free ride begun on a lift rides the last seconds of the lift serving
// the run picked (`freeRunOf`: the run named, else the first of the colour
// asked, else the course's first — or, given a spot, the chair whose run
// passes nearest it). Stood off at the top the skis are his at once —
// nothing leads him — and a rider who follows a run's sign down its ramp
// slides onto that run and never climbs to it. A race never boards one.

import { describe, expect, it } from "vitest";

import {
  BOARDING_RING,
  LIFT_LOOK,
  boardingRing,
  PISTE_GRADES,
  generateLevel,
  NEUTRAL_INPUT,
  TUNING,
  angleDiff,
  arrivalOf,
  chairLane,
  createGame,
  emptyChairAt,
  freeRunOf,
  freeRuns,
  liftPlans,
  queueSpot,
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

/** A RIDER WHO FOLLOWS THE SIGN off a top to run `id`: off a chair on down
 * its lane to the parting, then for the ramp's head on the pad's rim and
 * down the ramp until he is on the run's snow — poling at a crawl, checked
 * over `CHECK` m/s (`make lift-tops` is the same rider). How far he
 * climbed over the lowest he had come down to, m, and whether he got there. */
function followSign(
  run: GameState,
  plan: LiftPlan,
  id: string,
  seconds = 90,
): { climbed: number; arrived: boolean; events: GameEvent[] } {
  const map = run.level;
  const r = map.resort!.runs.find((q) => q.id === id)!;
  const ramp = plan.lift.ramps?.find((q) => q.run === id);
  const lane = plan.lift.kind === "chair" ? chairLane(plan) : null;
  const way = [
    ...(lane
      ? [
          {
            x: plan.lift.bottom.x + plan.dx * (lane.exit + 2) + plan.dz * lane.v,
            z: plan.lift.bottom.z + plan.dz * (lane.exit + 2) - plan.dx * lane.v,
          },
        ]
      : []),
    ...(ramp ? [ramp.from, ramp.to] : [r.points[0]]),
  ];
  // On the run's snow, once making for where the ramp meets it.
  const onRun = (x: number, z: number): boolean =>
    r.points.some((p) => Math.hypot(p.x - x, p.z - z) < p.width / 2);
  let k = 0;
  let low = Infinity;
  let climbed = 0;
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * 120 && k < way.length; i++) {
    const c = run.skier;
    if (!c.lift) {
      low = Math.min(low, c.y);
      climbed = Math.max(climbed, c.y - low);
    }
    const aim = way[k];
    if (!c.lift && k === way.length - 1 && onRun(c.x, c.z)) k = way.length;
    if (k >= way.length) break;
    if (Math.hypot(aim.x - c.x, aim.z - c.z) < REACHED) {
      k++;
      continue;
    }
    const off = angleDiff(c.heading, Math.atan2(aim.x - c.x, aim.z - c.z));
    step(run, {
      ...NEUTRAL_INPUT,
      steer: c.lift ? 0 : Math.max(-1, Math.min(1, off * 2.2)),
      tuck: c.lift ? 0 : c.speed < 5 ? 1 : 0.25,
      brake: c.lift ? 0 : Math.max(0, Math.min(1, c.speed - CHECK)),
    });
    events.push(...run.events);
  }
  return { climbed, arrived: k >= way.length, events };
}

/** How near a mark the rider who follows the sign makes for counts as
 * there, m; the speed he checks to, m/s. */
const REACHED = 4;
const CHECK = 12;

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
    let inclined = 0;
    const events = ride(run, 600, (r) => {
      const c = r.skier;
      if (c.lift?.phase === "ride") {
        highest = Math.max(highest, c.y - level.groundAt(c.x, c.z));
        // Once sat: the chair scoops him up off the load line first.
        if (c.lift.t > TUNING.lift.scoop) {
          lowest = Math.min(lowest, c.y - level.groundAt(c.x, c.z));
          // Sat, he is inclined to nothing: the cross-slope passing under
          // the chair is not under his skis.
          inclined = Math.max(inclined, Math.abs(c.incline));
        }
      }
      return r.events.some((e) => e.kind === "lift" && e.phase === "off");
    });
    const off = events.find((e) => e.kind === "lift" && e.phase === "off");
    expect(off).toBeDefined();
    // Carried clear of the snow out on the line, and down to the ramp sat
    // with his skis on it, never in it…
    expect(highest).toBeGreaterThan(4);
    expect(lowest).toBeGreaterThan(TUNING.lift.sit - 1e-6);
    expect(inclined).toBe(0);
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
      return r.events.some((e) => e.kind === "lift" && e.phase === "off");
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
    ride(run, 900, (r) => r.events.some((e) => e.kind === "lift" && e.phase === "off"));
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

  for (const kind of ["chair", "gondola", "drag"] as const) {
    it(`boards a ${kind} from its boarding ring, facing any way, and carries him up`, () => {
      const plan = of(kind)!;
      const ring = boardingRing(plan);
      const run = createGame({ level, mode: "free", quiet: true });
      // Come in off the mountain, facing away from the line, at a run.
      standSkier(run, ring.x, ring.z, plan.heading + 2.5);
      run.skier.vx = Math.sin(plan.heading + 2.5) * 8;
      run.skier.vz = Math.cos(plan.heading + 2.5) * 8;
      run.skier.speed = 8;
      step(run, NEUTRAL_INPUT);
      expect(run.skier.lift?.phase).toBe("board");
      // Turned to the way as a skier turns — never slid along it sideways
      // or backward — then skated up the queue's lane, never faster than
      // the glide asks, onto the lift facing up its line.
      let fastest = 0;
      let across = 0;
      ride(run, 60, (r) => {
        const c = r.skier;
        if (c.lift?.phase === "board") {
          fastest = Math.max(fastest, c.speed);
          if (c.speed > 0.3) {
            const way = Math.atan2(c.vx, c.vz);
            across = Math.max(across, Math.abs(angleDiff(c.heading, way)));
          }
        }
        return c.lift?.phase === "ride";
      });
      expect(across).toBeLessThan(0.3);
      expect(run.skier.lift?.phase).toBe("ride");
      expect(fastest).toBeLessThan(BOARDING_RING.glide * 2);
      expect(Math.abs(angleDiff(run.skier.heading, plan.heading))).toBeLessThan(0.05);
      const events = ride(run, 900, (r) =>
        r.events.some((e) => e.kind === "lift" && e.phase === "off"),
      );
      expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
    });
  }

  it("lays every boarding ring on the queue's lane past the corral, clear of the houses", () => {
    for (const plan of plans) {
      const ring = boardingRing(plan);
      // Beyond the head of the queue the crowd stands in…
      const head = queueSpot(plan, 0);
      expect(Math.hypot(ring.x - head.x, ring.z - head.z)).toBeGreaterThan(10);
      // …and no station house stands on it.
      for (const h of stationHouses(level, plan)) {
        const rx = ring.x - h.x;
        const rz = ring.z - h.z;
        const a = Math.abs(rx * plan.dx + rz * plan.dz);
        const b = Math.abs(rx * plan.dz - rz * plan.dx);
        expect(
          a > h.halfLength + BOARDING_RING.radius || b > h.halfWidth + BOARDING_RING.radius,
        ).toBe(true);
      }
    }
  });

  it("will not take a skier through the ring at speed, nor in a race", () => {
    const plan = of("chair")!;
    const ring = boardingRing(plan);
    const fast = createGame({ level, mode: "free", quiet: true });
    standSkier(fast, ring.x, ring.z, plan.heading);
    fast.skier.speed = BOARDING_RING.fastest + 2;
    step(fast, NEUTRAL_INPUT);
    expect(fast.skier.lift).toBeNull();
    const race = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    standSkier(race, ring.x, ring.z, plan.heading);
    step(race, NEUTRAL_INPUT);
    expect(race.skier.lift).toBeNull();
  });

  it("is a free ride's alone: a race never boards", () => {
    const plan = of("chair")!;
    const run = createGame({ level, rivals: 0, countdown: 0, quiet: true });
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

  it("puts a skier who will not wait at the top, and lets him go there", () => {
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
    expect(resort.runs.find((r) => r.id === run.progress.skied.at(-1))!.from).toBe(target.from);
  });

  it("rides only the last seconds of the lift, the top close ahead", () => {
    const run = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    expect(arrivalOf(plans[run.skier.lift!.index]).u).toBe(run.skier.lift!.u);
    let at = -1;
    ride(run, 30, (r) => {
      if (r.events.some((e) => e.kind === "lift" && e.phase === "off")) at = r.t;
      return at >= 0;
    });
    expect(at).toBeGreaterThan(TUNING.lift.arrive - 0.05);
    expect(at).toBeLessThan(TUNING.lift.arrive + 0.05);
  });

  it("is stood off at the top and the skis are his at once — nothing leads him", () => {
    const run = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    const plan = plans[run.skier.lift!.index];
    const events = ride(run, 30, (r) => r.skier.lift === null);
    expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
    expect(run.skier.lift).toBeNull();
    // Let be, he slides off the ramp and coasts to a stop on the level top,
    // never down off it: nothing steers him for a run.
    ride(run, 20, () => false);
    const c = run.skier;
    expect(Math.hypot(c.x - plan.lift.top.x, c.z - plan.lift.top.z)).toBeLessThan(RR_PAD);
    expect(Math.abs(c.y - plan.lift.top.y)).toBeLessThan(2);
    expect(c.speed).toBeLessThan(0.5);
    expect(c.thrown).toBeNull();
  });

  it("leaves the chair he stood up off running on, and it sweeps him over if he stops in its way", () => {
    const run = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    const plan = plans[run.skier.lift!.index];
    ride(run, 30, (r) => r.skier.lift === null);
    const left = run.skier.chairLeft!;
    expect(left.index).toBe(plans.indexOf(plan));
    // Running on toward the wheel at the terminal's speed, then gone round it.
    expect(emptyChairAt(plan, left, run.t + 1)).toBeCloseTo(left.u + plan.look.slow, 6);
    expect(emptyChairAt(plan, left, run.t + 60)).toBeNull();
    // Stopped dead on the unload ramp, the chair comes on into his legs.
    const events = ride(run, 6, (r) => r.skier.thrown !== null, { ...NEUTRAL_INPUT, brake: 1 });
    expect(events.some((e) => e.kind === "wipeout" && e.cause === "chair")).toBe(true);
  });

  it("follows the sign down his run's ramp onto it, never climbing", () => {
    const run = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    const plan = plans[run.skier.lift!.index];
    const id = run.progress.skied.at(-1)!;
    expect(signsOf(level, plan).some((s) => s.run === id)).toBe(true);
    const { climbed, arrived, events } = followSign(run, plan, id);
    expect(events.some((e) => e.kind === "reset" || e.kind === "wipeout")).toBe(false);
    expect(climbed).toBeLessThan(CLIMB);
    expect(arrived).toBe(true);
  });

  it("replays to the figure", () => {
    const a = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    const b = createGame({ level, mode: "free", byLift: true, spawn: spot, quiet: true });
    ride(a, 40, () => false);
    ride(b, 40, () => false);
    expect([a.skier.x, a.skier.y, a.skier.z]).toEqual([b.skier.x, b.skier.y, b.skier.z]);
  });
});

describe("a free ride begun on a lift with no spot", () => {
  // Seed 1 serves its green off a drag, its blue off the gondola and its
  // black off a chair: the colour asked for is the run arrived at, on
  // whatever lift leaves its top.
  for (const grade of PISTE_GRADES) {
    it(`rides up to the top of the ${grade} course's first run`, () => {
      const map = generateLevel(1, { grade });
      const resort = map.resort!;
      const course = resort.courses.find((c) => c.id === resort.course)!;
      const run = createGame({ level: map, mode: "free", byLift: true, quiet: true });
      const lift = run.skier.lift!;
      expect(lift.phase).toBe("ride");
      const first = resort.runs.find((r) => r.id === course.runs[0])!;
      expect(run.progress.skied.at(-1)).toBe(first.id);
      expect(lift.id).toBe(first.from);
      expect(lift.kind).toBe(resort.lifts.find((l) => l.id === first.from)!.kind);
      // Off the top and down to the run past its sign, never thrown on the
      // way and never climbing — where a ramp comes down to it (a drag's
      // top has one only where it fits).
      const plan = liftPlans(map)[lift.index];
      if (plan.lift.kind === "drag") {
        const events = ride(run, 30, (r) => r.skier.lift === null);
        expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
        expect(plan.lift.kind).toBe("drag");
        return;
      }
      const { climbed, arrived, events } = followSign(run, plan, first.id);
      expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
      expect(events.some((e) => e.kind === "reset" || e.kind === "wipeout")).toBe(false);
      expect(climbed).toBeLessThan(CLIMB);
      expect(arrived).toBe(true);
    });
  }
});

describe("which run a free ride by lift starts down", () => {
  const map = generateLevel(1);
  const runs = freeRuns(map);

  it("is the run named, of those leaving a lift's top, in id order", () => {
    expect(runs.length).toBeGreaterThan(2);
    expect(runs.map((r) => Number(r.id))).toEqual(
      [...runs.map((r) => Number(r.id))].sort((a, b) => a - b),
    );
    for (const r of runs) expect(freeRunOf(map, { run: r.id, grade: "green" })).toBe(r.id);
  });

  it("is the first of the colour asked, even where no course of it reaches the valley", () => {
    for (const grade of PISTE_GRADES) {
      const first = runs.find((r) => r.grade === grade);
      if (first) expect(freeRunOf(map, { grade })).toBe(first.id);
    }
    const run = createGame({
      level: map,
      mode: "free",
      byLift: true,
      run: runs[1].id,
      quiet: true,
    });
    expect(run.progress.skied.at(-1)).toBe(runs[1].id);
  });

  it("is the course's first run where nothing is asked", () => {
    const resort = map.resort!;
    const course = resort.courses.find((c) => c.id === resort.course)!;
    expect(freeRunOf(map, {})).toBe(course.runs[0]);
  });
});

describe("the way from a lift's top onto its run", () => {
  // Every run off a chair's or a gondola's top lies under it, a ramp down
  // to it off the pad's rim (R26, R27): a rider who follows its sign slides
  // onto it. A drag's top, unpressed, has a ramp only where one fits.
  const map = levelFor(LEVEL_SEEDS[0]);
  const all = liftPlans(map);
  const ramped = (r: { id: string; from: string }): boolean =>
    all.some((p) => p.lift.id === r.from && !!p.lift.ramps?.some((q) => q.run === r.id));
  it("has a ramp down to every run off a chair's or a gondola's top", () => {
    for (const r of freeRuns(map)) {
      const kind = all.find((p) => p.lift.id === r.from)!.lift.kind;
      if (kind !== "drag") expect(ramped(r)).toBe(true);
    }
  });
  const padded = (r: { from: string }): boolean =>
    all.find((p) => p.lift.id === r.from)!.lift.kind !== "drag";
  for (const r of freeRuns(map).filter((q) => ramped(q) && padded(q))) {
    it(`brings a rider who follows its sign onto run ${r.id} (${r.grade}), never climbing`, () => {
      const run = createGame({ level: map, mode: "free", byLift: true, run: r.id, quiet: true });
      const plan = all[run.skier.lift!.index];
      const { climbed, arrived, events } = followSign(run, plan, r.id);
      expect(events.some((e) => e.kind === "reset" || e.kind === "wipeout")).toBe(false);
      expect(run.skier.thrown).toBeNull();
      expect(climbed).toBeLessThan(CLIMB);
      expect(arrived).toBe(true);
    });
  }
});

/** The pad's width across, m; the most a rider following a sign may rise
 * over the lowest he has come down to, m — a roll of the snow, never a
 * climb. */
const RR_PAD = 48;
const CLIMB = 0.6;
