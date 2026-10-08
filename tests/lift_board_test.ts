// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BOARDING A LIFT, AND LEAVING ONE EARLY (`engine/game/lift-ride.ts`): a
// skier who rides into a lift's boarding ring SKATES up the queue's lane —
// inside the corral, beside the queue standing on it, shouldering aside
// whoever is in his way (`crowd-lift.ts`'s `brushQueue`) — and is taken:
// faded into a gondola's cabin or onto a chair as it leaves the station, or
// stood on a drag's track until a T-bar of the lift's own comes round to
// him. Carried, the machine press lets go of the lift wherever he is, and
// the tuck held skips him up it.

import { describe, expect, it } from "vitest";

import {
  BOARDING_RING,
  CORRAL_TAIL,
  NEUTRAL_INPUT,
  TUNING,
  angleDiff,
  arrivalOf,
  boardingRing,
  cabinDoors,
  carrierAt,
  carrierCount,
  createGame,
  liftPlans,
  platformOf,
  queueLane,
  railAt,
  seatedShare,
  standSkier,
  step,
  type GameEvent,
  type GameState,
  type LiftPlan,
  type SkierInput,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const plans = liftPlans(level);
const of = (kind: LiftPlan["lift"]["kind"]) => plans.find((p) => p.lift.kind === kind)!;

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

/** A free ride rolled into a lift's boarding ring from beyond its corral. */
function atRing(plan: LiftPlan, crowd = 0): GameState {
  const run = createGame({ level, mode: "free", crowd, quiet: true });
  const ring = boardingRing(plan);
  standSkier(run, ring.x, ring.z, plan.heading + Math.PI);
  return run;
}

/** How far a point lies off a lift's queue lane, m (its corral's legs). */
function offLane(plan: LiftPlan, x: number, z: number): number {
  const rx = x - plan.lift.bottom.x;
  const rz = z - plan.lift.bottom.z;
  const u = rx * plan.dx + rz * plan.dz;
  const v = rx * plan.dz - rz * plan.dx;
  const lane = queueLane(plan);
  let best = Infinity;
  for (let k = 0; k + 1 < lane.length; k++) {
    const a = lane[k];
    const b = lane[k + 1];
    const du = b.u - a.u;
    const dv = b.v - a.v;
    const len2 = du * du + dv * dv;
    const t = Math.max(0, Math.min(1, ((u - a.u) * du + (v - a.v) * dv) / len2));
    best = Math.min(best, Math.hypot(u - a.u - du * t, v - a.v - dv * t));
  }
  return best;
}

describe("boarding a lift from its ring", () => {
  for (const kind of ["chair", "gondola", "drag"] as const) {
    it(`skates a ${kind}'s rider up the lane inside its corral, at a skater's pace`, () => {
      const plan = of(kind);
      const run = atRing(plan);
      step(run, NEUTRAL_INPUT);
      const walk = run.skier.lift!.walk!;
      let widest = 0;
      let fastest = 0;
      let strides = 0;
      const stride0 = run.skier.stride;
      ride(
        run,
        60,
        (r) => r.skier.lift?.phase !== "board",
        NEUTRAL_INPUT,
        (r) => {
          const l = r.skier.lift;
          if (l?.phase !== "board") return;
          fastest = Math.max(fastest, r.skier.speed);
          // Inside the corral once he is in at its open end.
          if (l.s! > walk - (CORRAL_TAIL - 1.5))
            widest = Math.max(widest, offLane(plan, r.skier.x, r.skier.z));
          strides = r.skier.stride - stride0;
        },
      );
      expect(widest).toBeLessThan(1.3);
      expect(fastest).toBeLessThan(TUNING.lift.board.pace + 0.5);
      // His legs worked it: the figure's gait has strides to draw.
      expect(strides).toBeGreaterThan(2);
    });
  }

  it("goes past the queue, shouldering aside whoever stands in his way", () => {
    const plan = of("drag");
    const run = atRing(plan, 400);
    const lift = plans.indexOf(plan);
    const queued = () => run.crowd!.amateurs.filter((a) => a.mode === "queue" && a.lift === lift);
    // Let the queue form.
    ride(run, 40, () => queued().length >= 4);
    standSkier(run, boardingRing(plan).x, boardingRing(plan).z, plan.heading + Math.PI);
    let nearest = Infinity;
    const events = ride(
      run,
      60,
      (r) => r.skier.lift?.phase === "ride",
      NEUTRAL_INPUT,
      (r) => {
        if (r.skier.lift?.phase !== "board") return;
        for (const a of queued())
          nearest = Math.min(nearest, Math.hypot(a.x - r.skier.x, a.z - r.skier.z));
      },
    );
    expect(queued().length).toBeGreaterThan(0);
    // Never through anyone: they are put aside as he comes.
    expect(nearest).toBeGreaterThan(0.45);
    expect(events.some((e) => e.kind === "bump" && e.amateur !== undefined)).toBe(true);
  });

  it("stands a drag's rider waiting on its track until a T-bar of its own comes round", () => {
    const plan = of("drag");
    const run = atRing(plan);
    let waited = 0;
    const events = ride(
      run,
      90,
      (r) => r.skier.lift?.phase === "ride",
      NEUTRAL_INPUT,
      (r) => {
        if (r.skier.lift?.phase === "wait") waited += 1 / 120;
      },
    );
    expect(events.some((e) => e.kind === "lift" && e.phase === "take")).toBe(true);
    expect(waited).toBeGreaterThan(0);
    // Taken by the carrier the clock brings past the load line.
    const n = carrierCount(plan);
    const passing = Array.from({ length: n }, (_, k) => carrierAt(plan, k, run.t)).filter(
      (c) => c.side === 0 && Math.abs(c.u - plan.look.entry.at) < 0.1,
    );
    expect(passing.length).toBe(1);
    // Pulled up from a stand.
    expect(run.skier.lift!.speed).toBeLessThan(plan.look.slow);
  });

  it("fades a chair's rider into his chair as it leaves the station", () => {
    const plan = of("chair");
    const run = atRing(plan);
    ride(run, 60, (r) => r.skier.lift?.phase === "ride");
    const l = run.skier.lift!;
    expect(l.faded).toBe(true);
    // Sat in it at once, out of the station.
    expect(Number.isNaN(l.from.y)).toBe(true);
    expect(l.u).toBeGreaterThan(plan.look.entry.at);
  });

  it("takes a gondola's rider through the hall to wait on its platform, and his cabin comes round to him", () => {
    const plan = of("gondola");
    const G = TUNING.lift.gondola;
    const run = atRing(plan);
    ride(run, 60, (r) => r.skier.lift?.phase === "wait");
    const l = run.skier.lift!;
    expect(l.phase).toBe("wait");
    // Faded through the door and back in on him stood on the platform,
    // beside his cabin's way, facing up the line.
    expect(l.faded).toBe(true);
    const p = platformOf(plan);
    expect(Math.hypot(run.skier.x - p.x, run.skier.z - p.z)).toBeLessThan(1e-6);
    // His cabin comes round the wheel, slowing to the station's crawl, its
    // doors opening, and takes him alongside.
    const at = railAt(plan, l.u);
    expect(Math.hypot(at.x - plan.lift.bottom.x, at.z - plan.lift.bottom.z)).toBeLessThan(4);
    let waited = 0;
    ride(run, 30, (r) => {
      if (r.skier.lift?.phase === "wait") waited += TUNING.dt;
      return r.skier.lift?.phase === "ride";
    });
    expect(waited).toBeGreaterThan(1.5);
    expect(waited).toBeLessThan(6);
    const took = run.skier.lift!;
    expect(took.speed).toBeCloseTo(G.creep, 5);
    expect(cabinDoors(took)).toBeCloseTo(1, 5);
    expect(seatedShare(took)).toBeLessThan(0.1);
    // He steps in and sits while it creeps on, its doors shut, and it is
    // taken back onto the rope.
    ride(run, G.stepIn, () => false);
    expect(seatedShare(run.skier.lift!)).toBeCloseTo(1, 5);
    expect(run.skier.lift!.speed).toBeCloseTo(G.creep, 5);
    ride(run, G.shut + 0.05, () => false);
    expect(cabinDoors(run.skier.lift!)).toBeCloseTo(0, 5);
    ride(run, 3, () => false);
    expect(run.skier.lift!.speed).toBeGreaterThan(2);
    // Sat in it up the line, his cabin's floor carried off the platform.
    expect(Math.abs(angleDiff(run.skier.heading, plan.heading))).toBeLessThan(0.05);
  });

  it("stops, steps his skis round on the spot and skates off when he comes in the wrong way", () => {
    const plan = of("chair");
    const ring = boardingRing(plan);
    const lane = queueLane(plan);
    const a = lane[lane.length - 2];
    const b = lane[lane.length - 1];
    // Out of the corral's side of the ring, heading away from it.
    const away = Math.atan2(
      plan.dx * (b.u - a.u) + plan.dz * (b.v - a.v),
      plan.dz * (b.u - a.u) - plan.dx * (b.v - a.v),
    );
    const run = createGame({ level, mode: "free", crowd: 0, quiet: true });
    standSkier(run, ring.x, ring.z, away);
    run.skier.vx = Math.sin(away) * 4;
    run.skier.vz = Math.cos(away) * 4;
    run.skier.speed = 4;
    let skidded = false;
    let pivoted = false;
    let across = 0;
    let swung = 0;
    let last = away;
    ride(
      run,
      30,
      (r) => r.skier.lift?.phase !== "board" && r.skier.lift !== null,
      NEUTRAL_INPUT,
      (r) => {
        const c = r.skier;
        if (c.lift?.phase !== "board") return;
        if (c.skid > 0) skidded = true;
        if (c.pivot !== 0) pivoted = true;
        if (c.speed > 0.3) {
          across = Math.max(across, Math.abs(angleDiff(c.heading, Math.atan2(c.vx, c.vz))));
          // Never swivelled while he slides.
          swung = Math.max(swung, Math.abs(angleDiff(last, c.heading)) / TUNING.dt);
        }
        last = c.heading;
      },
    );
    expect(skidded).toBe(true);
    expect(pivoted).toBe(true);
    expect(across).toBeLessThan(0.3);
    expect(swung).toBeLessThan(TUNING.lift.board.turn + 0.1);
    expect(run.skier.lift?.phase).toBe("ride");
  });

  it("never takes the ring through the gondola's corral fence from the side", () => {
    const plan = of("gondola");
    const e = plan.look.entry;
    // Stood beside the door outside the corral: not in its load zone.
    const run = createGame({ level, mode: "free", crowd: 0, quiet: true });
    const v = 3;
    standSkier(
      run,
      plan.lift.bottom.x + plan.dx * e.at + plan.dz * v,
      plan.lift.bottom.z + plan.dz * e.at - plan.dx * v,
      plan.heading,
    );
    step(run, NEUTRAL_INPUT);
    expect(run.skier.lift).toBeNull();
    expect(BOARDING_RING.radius).toBeGreaterThan(0);
  });
});

describe("leaving a lift early", () => {
  it("lets go of a chair on the machine press, and he drops off it", () => {
    const plan = of("chair");
    const run = atRing(plan);
    ride(run, 60, (r) => r.skier.lift?.phase === "ride");
    ride(run, 12, () => false);
    const high = run.skier.y - level.groundAt(run.skier.x, run.skier.z);
    expect(high).toBeGreaterThan(2);
    const events = ride(run, 1 / 120, () => true, { ...NEUTRAL_INPUT, machine: true });
    expect(run.skier.lift).toBeNull();
    expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
    // Falling, never stood back on the snow under him.
    ride(run, 0.2, () => false);
    expect(run.skier.airborne || run.skier.thrown !== null).toBe(true);
  });

  it("lets go of a T-bar on the machine press onto the track", () => {
    const plan = of("drag");
    const run = atRing(plan);
    ride(run, 90, (r) => r.skier.lift?.phase === "ride");
    ride(run, 3, () => false);
    step(run, { ...NEUTRAL_INPUT, machine: true });
    expect(run.skier.lift).toBeNull();
    ride(run, 1, () => false);
    expect(run.skier.thrown).toBeNull();
  });

  it("skates off on the machine press before he is taken", () => {
    const plan = of("gondola");
    const run = atRing(plan);
    ride(run, 1, () => false);
    expect(run.skier.lift?.phase).toBe("board");
    step(run, { ...NEUTRAL_INPUT, machine: true });
    expect(run.skier.lift).toBeNull();
  });

  for (const kind of ["chair", "gondola", "drag"] as const) {
    it(`skips a ${kind}'s rider up it behind a fade when the tuck is held`, () => {
      const plan = of(kind);
      const run = atRing(plan);
      ride(run, 90, (r) => r.skier.lift?.phase === "ride");
      const tuck = { ...NEUTRAL_INPUT, tuck: 1 };
      // Not before it has been held long enough.
      ride(run, TUNING.lift.skip.hold - 0.2, () => false, tuck);
      expect(run.skier.lift?.skip).toBeUndefined();
      const there = arrivalOf(plan).u;
      ride(run, 1.5, (r) => r.skier.lift?.faded === true && r.skier.lift.u >= there - 1, tuck);
      const l = run.skier.lift!;
      expect(l.u).toBeGreaterThanOrEqual(there - 1);
      expect(l.faded).toBe(true);
      // And on to the top from there, let go as ever.
      const events = ride(run, 30, (r) => r.skier.lift === null);
      expect(events.some((e) => e.kind === "lift" && e.phase === "off")).toBe(true);
    });
  }
});
