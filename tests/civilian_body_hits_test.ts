// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PEOPLE ON FOOT RUN INTO (`engine/game/foot.ts`): a civilian, a rescue
// crew member and a civilian met by the snowmobile are the same two-body
// collision as an amateur (`tests/body_hits_test.ts`) — the exchange at
// the real masses, both hurt at speed with the INJURIES switch on, nobody
// hurt past a knock with it off, the bodies listed for collecting — and
// the engine meets them where the app draws them: the civilians' plan and
// the crews' calls handed in as data, the same in a replay.

import { describe, expect, it } from "vitest";
import {
  CROWD_SIZE,
  NEUTRAL_INPUT,
  PERSON_HIT,
  casualtiesOf,
  crewAt,
  createGame,
  footAt,
  routeAt,
  standSkier,
  step,
  totalMass,
  type FootCall,
  type GameEvent,
  type GameState,
} from "@engine";

import { civilianAt, civilianHour, civilianPlanFor } from "../pwa/src/game/civilian-plan.ts";
import { footCallOf, peopled } from "../pwa/src/game/foot-call.ts";
import { bookRun, createRescueBook } from "../pwa/src/game/rescue-book.ts";
import { flightAt, freshFlightFrame, planFlight } from "../pwa/src/game/rescue-flight.ts";
import { recipeOf } from "../pwa/src/game/replay.ts";
import { HIT_SEED, footRow, rideOn, stageFoot } from "./support/body-hits.ts";
import { levelFor } from "./support/levels.ts";

const CRUSH = /Ribs|Chest|Pelvis|pelvis|Femur|lacerated|Liver|Spleen|Lung|Neck|brain/;

type Struck = Extract<GameEvent, { kind: "struck" }>;
const struckOf = (events: GameEvent[]): Struck | undefined =>
  events.find((e): e is Struck => e.kind === "struck");

describe("a civilian run into", () => {
  it("at 10 km/h is no collision: the app's knock is the whole of it", () => {
    const { state, events } = stageFoot(10, "man", true);
    expect(struckOf(events)).toBeUndefined();
    expect(state.foot!.down).toEqual([]);
    expect(state.skier.vz).toBeCloseTo(10 / 3.6, 6);
  });

  it("past the strike speed is two bodies colliding at their masses", () => {
    const { state, events } = stageFoot(60, "man", true);
    const e = struckOf(events)!;
    expect(e).toBeDefined();
    expect(e.amateur).toBe(-1);
    expect(e.foot).toBe(7);
    expect(e.who).toBe("civilian");
    expect(e.speed).toBeCloseTo(60 / 3.6, 1);
    // A grown man each: about half the closing speed each, the same impulse.
    expect(e.taken / e.speed).toBeGreaterThan(0.4);
    expect(e.given / e.speed).toBeGreaterThan(0.45);
    expect(e.given / e.taken).toBeCloseTo(totalMass(state.skier.spec) / CROWD_SIZE.man.mass, 6);
    expect(e.thrown).toBe(true);
    expect(state.skier.thrown?.cause).toBe("skier");
    const d = state.foot!.down[0];
    expect(d.thrown.vz).toBeGreaterThan(5);
    expect(d.dead).toBe(true);
  });

  it("at 30 km/h with injuries on: the player bruised, the civilian hurt past getting up", () => {
    const r = footRow(30, "man", true);
    expect(r.thrown).toBe(false);
    expect(r.injuries.length).toBeGreaterThan(0);
    expect(r.injured).toBe(true);
    expect(r.killed).toBe(false);
    expect(r.casualties).toEqual(["civilian hurt"]);
  });

  it("at 60 and 90 km/h with injuries on: two bodies to collect, crushed", () => {
    for (const kmh of [60, 90]) {
      const r = footRow(kmh, "man", true);
      expect(r.thrown, `${kmh}`).toBe(true);
      expect(r.killed, `${kmh}`).toBe(true);
      expect(r.worst, `${kmh}`).toBeGreaterThanOrEqual(4);
      expect(r.injuries.filter((k) => CRUSH.test(k)).length, `${kmh}`).toBeGreaterThanOrEqual(3);
      expect(r.casualties.sort(), `${kmh}`).toEqual(["civilian dead", "player dead"]);
    }
    expect(footRow(90, "man", true).crush).toBeGreaterThan(footRow(60, "man", true).crush);
  });

  it("with injuries off nobody is killed or held down: knocked, lain still, let go", () => {
    for (const kmh of [30, 60, 90]) {
      const r = footRow(kmh, "man", false, "civilian", 20);
      expect(r.knocked, `${kmh}`).toBe(true);
      expect(r.killed || r.injured || r.crush > 0, `${kmh}`).toBe(false);
      expect(r.up, `${kmh}`).toBe(true);
      expect(r.dead || r.down, `${kmh}`).toBe(false);
      expect(r.casualties, `${kmh}`).toEqual([]);
    }
  });

  it("is let go to his plan once he has had the time to walk back", () => {
    const { state } = stageFoot(30, "man", false);
    expect(state.foot!.down.length).toBe(1);
    rideOn(state, PERSON_HIT.foot.back + 1);
    expect(state.foot!.down.length).toBe(0);
  });

  it("casualtiesOf lists where he lies, where he was struck, and when", () => {
    const { state } = stageFoot(90, "man", true);
    const t = state.t;
    rideOn(state, 6);
    const him = casualtiesOf(state).find((k) => k.who === "civilian")!;
    expect(him.id).toBe(7);
    expect(him.dead).toBe(true);
    expect(him.cause).toBe("skier");
    expect(him.t).toBe(t);
    expect(him.points?.length).toBeGreaterThan(30);
    expect(him.crush).toBeGreaterThan(0.5);
    expect(him.z - him.impact!.z).toBeGreaterThan(2);
  });

  it("the same meeting is the same casualties, step for step", () => {
    const one = stageFoot(60, "man", true).state;
    const two = stageFoot(60, "man", true).state;
    rideOn(one, 3);
    rideOn(two, 3);
    expect(one.skier.body.injuries).toEqual(two.skier.body.injuries);
    expect(casualtiesOf(one)).toEqual(casualtiesOf(two));
  });
});

describe("a rescue crew member run into", () => {
  it("is the same collision: hurt at 30 km/h, both dead at 60 and 90", () => {
    expect(footRow(30, "man", true, "crew").casualties).toEqual(["crew hurt"]);
    for (const kmh of [60, 90]) {
      const r = footRow(kmh, "man", true, "crew");
      expect(r.killed, `${kmh}`).toBe(true);
      expect(r.casualties.sort(), `${kmh}`).toEqual(["crew dead", "player dead"]);
    }
    expect(footRow(60, "man", false, "crew", 20).casualties).toEqual([]);
  });

  it("is met where his call's plan has him, sampled for the engine", () => {
    const level = levelFor(HIT_SEED);
    const pts = level.track.points;
    const fell = pts[Math.floor(pts.length * 0.45)];
    const fresh = (): GameState =>
      createGame({ level, seed: HIT_SEED, mode: "free", gore: true, crowd: 0, quiet: true });
    const ended = fresh();
    standSkier(ended, fell.x, fell.z, fell.heading);
    ended.t = 30;
    ended.gore!.injured = 0;
    const next = bookRun(createRescueBook(), ended, fresh());
    const call = next.rescue![0];
    expect(call.crew!.length).toBe(4);
    const flight = planFlight(level, call.casualties);
    const f = freshFlightFrame();
    const at = { x: 0, y: 0, z: 0 };
    let met = 0;
    for (let t = Math.max(0, call.down) + 0.5; t < call.up; t += 7.3) {
      flightAt(level, flight, t - call.start, f);
      for (let j = 0; j < 4; j++) {
        const on = crewAt(next, call.crew![j], t, at);
        expect(on, `${t} ${j}`).toBe(f.crew[j].shown);
        if (!on) continue;
        met++;
        expect(Math.hypot(at.x - f.crew[j].x, at.z - f.crew[j].z), `${t} ${j}`).toBeLessThan(0.4);
      }
    }
    expect(met).toBeGreaterThan(20);
  });
});

describe("a civilian run down by the snowmobile", () => {
  it("is hit by the machine's mass: killed at 60 km/h, the machine barely slowed", () => {
    const { state, events } = stageFoot(60, "man", true, "sled");
    const e = struckOf(events)!;
    expect(e.killed).toBe(true);
    expect(e.given / e.speed).toBeGreaterThan(0.8);
    expect(e.taken / e.speed).toBeLessThan(0.3);
    expect(state.sled!.vz).toBeGreaterThan(0.7 * (60 / 3.6));
    expect(state.skier.thrown).toBeFalsy();
    // At 30 km/h, which a skier's blow only hurts him at, it is past injuring.
    expect(footRow(30, "man", true, "sled").injured).toBe(true);
  });
});

describe("the people handed in", () => {
  const level = levelFor(HIT_SEED);

  it("are met where the civilians' plan draws them, out when it has them out", () => {
    const plan = civilianPlanFor(level);
    const call = footCallOf(level, false, 0);
    expect(call.people.length).toBe(plan.people.length);
    const state = { level };
    const at = { x: 0, y: 0, z: 0 };
    let walkers = 0;
    for (const t of [0, 47.5, 333]) {
      for (let i = 0; i < plan.people.length; i += 3) {
        const pose = civilianAt(plan, i, t, civilianHour(level, t));
        const on = footAt(state, call, call.people[i], t, at);
        expect(on, `${i}@${t}`).toBe(pose.shown);
        if (!on) continue;
        expect(Math.hypot(at.x - pose.x, at.z - pose.z), `${i}@${t}`).toBeLessThan(1e-6);
        if (plan.people[i].leg) walkers++;
      }
    }
    expect(walkers).toBeGreaterThan(10);
  });

  it("each within the circle the cull keeps him in", () => {
    const call = footCallOf(level, false, 0);
    for (const p of call.people) {
      if (!p.route) continue;
      for (let u = 0; u < p.route.cycle; u += p.route.cycle / 17) {
        const a = routeAt(p.route, u);
        expect(Math.hypot(a.x - p.rx, a.z - p.rz)).toBeLessThan(p.rr + 0.01);
      }
    }
  });

  it("a person not out at the hour is no body to meet", () => {
    const call: FootCall = {
      people: [{ key: 1, body: "man", x: 0, y: 0, z: 0, heading: 0, rx: 0, rz: 0, rr: 1 }],
      rate: 0,
    };
    const at = { x: 0, y: 0, z: 0 };
    const out = {
      ...call.people[0],
      keen: 0.5,
      hours: [
        [0, 0.4],
        [24, 0.4],
      ] as const,
    };
    expect(footAt({ level }, call, call.people[0], 0, at)).toBe(true);
    expect(footAt({ level }, call, out, 0, at)).toBe(false);
  });

  it("only a free ride with its people is handed them, and its replay carries them", () => {
    const free = peopled(
      createGame({ level, seed: HIT_SEED, mode: "free", crowd: 0, quiet: true, gore: true }),
    );
    expect(free.foot?.call?.people.length).toBeGreaterThan(50);
    const recipe = recipeOf(free, "free");
    expect(recipe.foot).toBe(free.foot!.call);
    const again = createGame(recipe);
    expect(again.foot?.call).toBe(free.foot!.call);
    const race = peopled(createGame({ level, seed: HIT_SEED, quiet: true }));
    expect(race.foot).toBeUndefined();
  });

  it("a replay of the same inputs meets the same person the same way", () => {
    const run = (): GameState => {
      const { state } = stageFoot(45, "woman", true);
      for (let i = 0; i < 240; i++) step(state, { ...NEUTRAL_INPUT, tuck: 1 });
      return state;
    };
    const a = run();
    const b = run();
    expect(a.foot!.struck).toEqual(b.foot!.struck);
    expect(a.foot!.down[0].thrown.points).toEqual(b.foot!.down[0].thrown.points);
    expect(casualtiesOf(a)).toEqual(casualtiesOf(b));
    // A woman: the lighter takes more of the same impulse.
    const e = a.foot!.struck[0];
    expect(e.given / e.taken).toBeCloseTo(totalMass(a.skier.spec) / CROWD_SIZE.woman.mass, 6);
    expect(e.given).toBeGreaterThan(e.taken);
  });
});
