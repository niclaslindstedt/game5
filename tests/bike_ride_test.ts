// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE IN THE GAME (`bike.ts`): only a summer free ride that
// asks for it carries one (and a run that does not is untouched); it is
// begun on a trail head; the machine press steps him off and on; a fall
// throws him as the `bike` crash cause and stands him back on it; walked,
// he pushes it beside him; every chair's and gondola's load zone carries
// the bike up with him; and the ride is
// deterministic — the same keys, the same ride.
// What the app draws on the snow is solid here as it is in the game
// (`drawn-solids.ts`): the stations' houses, boards and signs, the fires'
// benches.
import "../pwa/src/game/drawn-solids.ts";
import { describe, expect, it } from "vitest";
import {
  bikeAim,
  bikePilot,
  bikeTrailById,
  bikeTrailHeads,
  bikeWithin,
  bikeWorldOf,
  createGame,
  fromEuler,
  liftPlans,
  NEUTRAL_INPUT,
  placeBike,
  step,
  TUNING,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";
import { bikeRun, summerMap } from "./support/bike-bot.ts";

const SEED = 38;
const level = () => summerMap(SEED);

/** `n` steps of `run` under `input` (a function of the step), every
 * event kept. */
function ride(run: GameState, n: number, input: (s: GameState, i: number) => SkierInput) {
  const events: GameEvent[] = [];
  let s = run;
  for (let i = 0; i < n; i++) {
    s = step(s, input(s, i));
    events.push(...s.events);
  }
  return { s, events };
}

describe("the bike is a summer free ride's alone", () => {
  it("no bike on a winter free ride that asks for one, and the run is untouched", () => {
    const asked = createGame({ level: level(), mode: "free", bike: true, quiet: true });
    const plain = createGame({ level: level(), mode: "free", quiet: true });
    expect(asked.bike).toBeUndefined();
    const go = (_s: GameState, i: number): SkierInput => ({
      ...NEUTRAL_INPUT,
      tuck: i % 240 < 120 ? 1 : 0,
    });
    const a = ride(asked, 240, go).s;
    const b = ride(plain, 240, go).s;
    expect(JSON.stringify(a.skier)).toBe(JSON.stringify(b.skier));
  });
  it("no bike on a summer free ride that does not ask", () => {
    expect(
      createGame({ level: level(), mode: "free", summer: true, quiet: true }).bike,
    ).toBeUndefined();
  });
  it("on one that asks, he is on it at rest at a trail head", () => {
    const s = bikeRun(level(), "B2");
    const b = s.bike!;
    expect(b.onIt).toBe(true);
    expect(b.mode).toBe("ridden");
    expect(b.trail).toBe("B2");
    const head = bikeTrailHeads(s.level).find((h) => h.trail === "B2")!;
    expect(Math.hypot(b.x - head.x, b.z - head.z)).toBeLessThan(2);
    expect(b.speed).toBeLessThan(0.5);
    expect(Math.hypot(s.skier.x - b.rider.x, s.skier.z - b.rider.z)).toBeLessThan(1e-6);
  });
});

describe("the machine press", () => {
  it("steps him off onto his feet and back on beside it", () => {
    let s = bikeRun(level());
    s = step(s, { ...NEUTRAL_INPUT, machine: true });
    expect(s.bike!.onIt).toBe(false);
    expect(s.bike!.afoot).not.toBeNull();
    expect(s.events.some((e) => e.kind === "bike" && e.phase === "hop")).toBe(true);
    // A few steps on his feet, the bike lying where he left it.
    s = ride(s, 60, () => ({ ...NEUTRAL_INPUT })).s;
    expect(s.bike!.mode).toBe("parked");
    expect(bikeWithin(s)).toBe(true);
    s = step(s, { ...NEUTRAL_INPUT, machine: true });
    expect(s.bike!.onIt).toBe(true);
    expect(s.events.some((e) => e.kind === "bike" && e.phase === "board")).toBe(true);
  });
  it("walking off, he pushes it beside him, and gets back on it where he stops", () => {
    let s = bikeRun(level());
    s = step(s, { ...NEUTRAL_INPUT, machine: true });
    s = ride(s, 6 / TUNING.dt, () => ({ ...NEUTRAL_INPUT, tuck: 1 })).s;
    const b = s.bike!;
    expect(b.afoot!.walked).toBeGreaterThan(3);
    expect(b.afoot!.push).toBe(true);
    // At his left hand, a little ahead of him (`BIKE.walk.push`).
    expect(Math.hypot(b.x - s.skier.x, b.z - s.skier.z)).toBeLessThan(1);
    expect(bikeWithin(s)).toBe(true);
    s = step(s, { ...NEUTRAL_INPUT, machine: true });
    expect(s.bike!.onIt).toBe(true);
  });
});

describe("a fall", () => {
  it("throws him as the `bike` crash cause, the bike left down, and stands him back on it", () => {
    let s = bikeRun(level(), "B1");
    s = ride(s, 120, () => ({ ...NEUTRAL_INPUT, tuck: 1 })).s;
    // Laid over far past what the bars can hold.
    const b = s.bike!;
    b.q = fromEuler(b.heading, b.pitch, 1.3);
    const { s: after, events } = ride(s, 60, () => ({ ...NEUTRAL_INPUT }));
    const crash = events.find((e) => e.kind === "bike" && e.phase === "crash");
    expect(crash).toBeDefined();
    expect(after.skier.thrown?.cause ?? null).toBe("bike");
    expect(after.bike!.thrown).toBe(true);
    // Left to lie, he is stood back up on it on the trail.
    // (Read the moment he is: coasted on hands-off down a black for the
    // rest of 30 s, he will meet something else.)
    let back = after;
    let right = false;
    for (let i = 0; i < 30 / TUNING.dt && !right; i++) {
      back = step(back, NEUTRAL_INPUT);
      right = back.events.some((e) => e.kind === "bike" && e.phase === "right");
    }
    expect(right).toBe(true);
    expect(back.bike!.onIt).toBe(true);
  });
});

describe("the restart", () => {
  it("puts him back where he last rode a trail, however far off it he is thrown", () => {
    let s = bikeRun(level(), "B1");
    const aim = bikeAim(s, "B1");
    for (let i = 0; i < 60 / TUNING.dt && aim.s < 150; i++) s = step(s, bikePilot(s, aim));
    const last = s.bike!.ridden!;
    expect(last.trail).toBe("B1");
    expect(last.s).toBeGreaterThan(100);
    // Carried far off the park (a fall, a lift dropped off), then the reset.
    const b = s.bike!;
    b.x += 300;
    b.z += 300;
    s = step(s, { ...NEUTRAL_INPUT, reset: true });
    const t = bikeTrailById(s.level, "B1")!;
    const back = t.points.reduce((a, p) =>
      Math.hypot(p.x - s.bike!.x, p.z - s.bike!.z) < Math.hypot(a.x - s.bike!.x, a.z - s.bike!.z)
        ? p
        : a,
    );
    expect(Math.hypot(back.x - s.bike!.x, back.z - s.bike!.z)).toBeLessThan(1);
    // ...at the place he rode, or the first clear place a little down it.
    expect(back.s).toBeGreaterThanOrEqual(last.s - 1);
    expect(back.s).toBeLessThan(last.s + 61);
    expect(s.bike!.onIt).toBe(true);
  });
});

/** How far short of a lift's load zone a bike is rolled into it from, m:
 * between the wheel and the station's house behind it (`HOUSE_CLEAR`), which
 * is solid. */
const RUN_UP = 4;

describe("a lift carries the bike", () => {
  // Every chair and gondola of two maps, rolled into from `RUN_UP` m short
  // of its load zone at a walking pace (pedalled up to 1.5 m/s, never past it):
  // the bike is placed by `placeBike`, so it stands on the ground there
  // rather than at the trail head's height, and at that crawl the rider's
  // knees hold the bars to the line (`bike-body.ts`'s `crawlHeld`) — the
  // seed 38 chair a bike once rolled 133 m past.
  for (const seed of [38, 7]) {
    it(`boards every chair and gondola on seed ${seed} at a walking pace`, () => {
      const map = summerMap(seed);
      const plans = liftPlans(map).filter((p) => p.lift.kind !== "drag");
      expect(plans.length).toBeGreaterThan(0);
      const missed: string[] = [];
      for (const plan of plans) {
        const e = plan.look.entry;
        const u = e.at - e.along - RUN_UP;
        const x = plan.lift.bottom.x + u * plan.dx + e.side * plan.dz;
        const z = plan.lift.bottom.z + u * plan.dz - e.side * plan.dx;
        let st = createGame({
          level: map,
          mode: "free",
          summer: true,
          bike: true,
          spawn: { x, z },
          quiet: true,
        });
        const b = st.bike!;
        placeBike(b, bikeWorldOf(st.level, 0), x, z, plan.heading, 1.5);
        st.skier.x = b.rider.x;
        st.skier.y = b.rider.y;
        st.skier.z = b.rider.z;
        const y0 = map.groundAt(x, z);
        let lifted = false;
        let top = -Infinity;
        for (let i = 0; i < 60 / TUNING.dt && !(lifted && top > y0 + 20); i++) {
          const pedal = !lifted && st.bike!.speed < 1.6 ? 1 : 0;
          st = step(st, { ...NEUTRAL_INPUT, tuck: pedal });
          if (st.bike!.mode === "lift") lifted = true;
          if (lifted) top = Math.max(top, st.skier.y);
        }
        if (!lifted || top < y0 + 20) missed.push(`${plan.lift.id} ${plan.lift.kind}`);
      }
      expect(missed).toEqual([]);
    });
  }
  // Dropped off a chair's seat partway up — the landing thrown or not — he
  // is put back on the bike once he is up, as after any fall (it was once
  // left lying, and he stood up with no way back onto it).
  it("puts him back on it after he drops off a chair", () => {
    const map = level();
    const stuck: string[] = [];
    for (const plan of liftPlans(map).filter((p) => p.lift.kind === "chair")) {
      const e = plan.look.entry;
      const u = e.at - e.along - RUN_UP;
      const x = plan.lift.bottom.x + u * plan.dx + e.side * plan.dz;
      const z = plan.lift.bottom.z + u * plan.dz - e.side * plan.dx;
      let st = createGame({
        level: map,
        mode: "free",
        summer: true,
        bike: true,
        spawn: { x, z },
        quiet: true,
      });
      const b = st.bike!;
      placeBike(b, bikeWorldOf(st.level, 0), x, z, plan.heading, 1.5);
      st.skier.x = b.rider.x;
      st.skier.y = b.rider.y;
      st.skier.z = b.rider.z;
      let lifted = -1;
      for (let i = 0; i < 40 / TUNING.dt && !(lifted >= 0 && st.t - lifted > 18); i++) {
        st = step(st, { ...NEUTRAL_INPUT, tuck: lifted < 0 && st.bike!.speed < 1.6 ? 1 : 0 });
        if (lifted < 0 && st.bike!.mode === "lift") lifted = st.t;
      }
      st = step(st, { ...NEUTRAL_INPUT, machine: true });
      let back = false;
      for (let i = 0; i < 30 / TUNING.dt && !back; i++) {
        st = step(st, NEUTRAL_INPUT);
        back = st.bike!.onIt;
      }
      if (!back) stuck.push(plan.lift.id);
    }
    expect(stuck).toEqual([]);
  });
});

describe("the bot", () => {
  it("rides a trail's first stretch from its head", () => {
    let s = bikeRun(level(), "B1");
    const t = bikeTrailById(s.level, "B1")!;
    const aim = bikeAim(s, "B1");
    for (let i = 0; i < 60 / TUNING.dt && aim.s < 200; i++) s = step(s, bikePilot(s, aim));
    expect(aim.s).toBeGreaterThan(Math.min(200, t.length) - 1);
  });
  it("is deterministic: the same ride twice", () => {
    const go = () => {
      let s = bikeRun(level(), "B2");
      const aim = bikeAim(s, "B2");
      for (let i = 0; i < 20 / TUNING.dt; i++) s = step(s, bikePilot(s, aim));
      return JSON.stringify({ b: s.bike, c: s.skier.x, z: s.skier.z, t: s.t });
    };
    expect(go()).toBe(go());
  });
});
