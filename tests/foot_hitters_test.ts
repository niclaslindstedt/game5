// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REST OF THE PEOPLE ON FOOT, AND THE REST OF WHAT STRIKES THEM
// (`engine/game/foot.ts`): the village's dog walkers (`dog-foot.ts`) and
// the ski patrol on its snowmobiles (`rescue-tracks.ts`' `patrolTracks`)
// met as bodies where the app draws them, and a person struck by the
// player's body thrown, by a piste machine and by a car of the traffic —
// the same two-body collision at the real masses, hurt and killed and
// listed for collecting with the INJURIES switch on, knocked and up again
// with it off, the player's body dosed only by what met it itself.

import { describe, expect, it } from "vitest";
import {
  CROWD_SIZE,
  GROOMER,
  NEUTRAL_INPUT,
  PERSON_HIT,
  VEHICLE_MASS,
  casualtiesOf,
  createGame,
  crewAt,
  crewKey,
  footAt,
  meetFoot,
  planSledRescue,
  sledCallGone,
  type GameEvent,
  type RescueCall,
} from "@engine";

import { civilianHour, freshCivilianPose } from "../pwa/src/game/civilian-plan.ts";
import { stepRun } from "../pwa/src/game/crowd-calls.ts";
import { DOG_FOOT, walkerKey, walkersAhead } from "../pwa/src/game/dog-foot.ts";
import { dogWalkerAt } from "../pwa/src/game/dog-walk-pose.ts";
import { dogPlanFor } from "../pwa/src/game/dog-walk.ts";
import { footCallOf, peopled } from "../pwa/src/game/foot-call.ts";
import { sledCall } from "../pwa/src/game/rescue-dispatch.ts";
import { freshSledCrewFrame, sledCrewAt } from "../pwa/src/game/rescue-sleds-crew.ts";
import { patrolTracks } from "../pwa/src/game/rescue-tracks.ts";
import { HIT_SEED, WALKER_KEY, footRow, stageFoot } from "./support/body-hits.ts";
import { levelFor } from "./support/levels.ts";

type Struck = Extract<GameEvent, { kind: "struck" }>;
const struckOf = (events: GameEvent[]): Struck | undefined =>
  events.find((e): e is Struck => e.kind === "struck");

describe("a dog walker run into", () => {
  it("is the civilians' collision: both dead at 60 km/h, nobody hurt with injuries off", () => {
    const on = footRow(60, "man", true, "walker");
    expect(on.killed).toBe(true);
    expect(on.casualties.sort()).toEqual(["civilian dead", "player dead"]);
    const off = footRow(60, "man", false, "walker", 20);
    expect(off.knocked).toBe(true);
    expect(off.killed || off.injured).toBe(false);
    expect(off.up).toBe(true);
    expect(off.casualties).toEqual([]);
  });

  it("is listed by his walker's key", () => {
    const { state, events } = stageFoot(45, "child", true, "walker");
    expect(struckOf(events)!.foot).toBe(WALKER_KEY);
    expect(casualtiesOf(state).find((k) => k.who === "civilian")!.id).toBe(WALKER_KEY);
  });

  it("is met where the village's plan draws him, his way knotted on ahead of the clock", () => {
    const level = levelFor(HIT_SEED);
    const plan = dogPlanFor(level)!;
    const call = footCallOf(level, false, 0);
    const walkers = call.people.filter((p) => p.track);
    expect(walkers.length).toBeGreaterThan(10);
    const pose = freshCivilianPose();
    const at = { x: 0, y: 0, z: 0 };
    let met = 0;
    for (let t = 0.5; t < 3 * DOG_FOOT.ahead; t += 1.3) {
      walkersAhead(call, t);
      for (const w of walkers) {
        const h = (w.key - DOG_FOOT.keys) >> 1;
        const member = ((w.key - DOG_FOOT.keys) & 1) as 0 | 1;
        expect(w.key).toBe(walkerKey(h, member));
        dogWalkerAt(plan, h, member, t, civilianHour(level, t), pose);
        const on = footAt({ level }, call, w, t, at);
        expect(on, `${w.key}@${t}`).toBe(pose.shown);
        if (!on || member === 1) continue;
        met++;
        expect(Math.hypot(at.x - pose.x, at.z - pose.z), `${w.key}@${t}`).toBeLessThan(0.02);
      }
    }
    expect(met).toBeGreaterThan(50);
  });

  it("is handed in with the civilians and knotted on by the run's own step", () => {
    const level = levelFor(HIT_SEED);
    const state = peopled(
      createGame({ level, seed: HIT_SEED, mode: "free", crowd: 0, quiet: true, gore: true }),
    );
    const tracks = state.foot!.call!.people.flatMap((p) => (p.track ? [p.track] : []));
    const ends = (): number[] => tracks.map((tr) => tr.t[tr.t.length - 1]);
    const was = ends();
    // Ten minutes on (the clock set forward), one step of the run's own.
    state.t = 600;
    stepRun(state, NEUTRAL_INPUT);
    const now = ends();
    expect(now.some((t, i) => t > was[i])).toBe(true);
    for (const t of now) expect(t).toBeGreaterThanOrEqual(state.t + DOG_FOOT.again);
  });
});

describe("a ski patrolman run into", () => {
  it("is the crews' collision: hurt at 30 km/h, both dead at 60, nobody with injuries off", () => {
    expect(footRow(30, "man", true, "patrol").casualties).toEqual(["crew hurt"]);
    expect(footRow(60, "man", true, "patrol").casualties.sort()).toEqual([
      "crew dead",
      "player dead",
    ]);
    expect(footRow(60, "man", false, "patrol", 20).casualties).toEqual([]);
  });

  const level = levelFor(38);
  const pts = level.track.points;
  const fell = pts[Math.floor(pts.length * 0.45)];
  const plan = planSledRescue(level, fell)!;
  const casualty = { x: fell.x, z: fell.z, known: 0 };
  const callOf = (taken: (number | null)[]): RescueCall =>
    sledCall(plan, 0, sledCallGone(plan, taken), [casualty], taken);

  it("is met where the patrol's plan has him on foot, and not while he rides", () => {
    const call = callOf([null, null]);
    const tracks = patrolTracks(level, call);
    expect(tracks.length).toBe(4);
    const f = freshSledCrewFrame();
    const at = { x: 0, y: 0, z: 0 };
    let afoot = 0;
    let riding = 0;
    for (let t = 0.3; t < sledCallGone(plan); t += 3.1) {
      sledCrewAt(level, plan, casualty, call.sledsTaken, t, f);
      for (let j = 0; j < 4; j++) {
        const on = crewAt({ level }, tracks[j], t, at);
        const walking = f.crew[j].shown && !f.seats[j];
        if (f.seats[j]?.on === 1) {
          riding++;
          expect(on, `${t} ${j}`).toBe(false);
        }
        if (!on || !walking) continue;
        afoot++;
        expect(Math.hypot(at.x - f.crew[j].x, at.z - f.crew[j].z), `${t} ${j}`).toBeLessThan(0.4);
      }
    }
    expect(afoot).toBeGreaterThan(40);
    expect(riding).toBeGreaterThan(10);
  });

  it("with his machine taken after he was sampled, is met only as far as the theft changes nothing", () => {
    const call = callOf([null, null]);
    call.crew = patrolTracks(level, call);
    const tr = call.crew[0];
    const sure = tr.sled!.sure;
    const at = { x: 0, y: 0, z: 0 };
    // On foot a moment past the work's end, by his track.
    let t = sure + 0.1;
    while (!crewAt({ level }, tr, t, at) && t < sure + 120) t += 0.25;
    expect(t).toBeLessThan(sure + 120);
    const meeting = (taken: (number | null)[]): number => {
      const state = createGame({ level, seed: 38, mode: "free", crowd: 0, quiet: true });
      call.sledsTaken = [...taken];
      state.rescue = [call];
      const c = state.skier;
      c.x = at.x;
      c.z = at.z - 0.5;
      c.y = level.groundAt(c.x, c.z) + c.spec.cogHeight;
      c.heading = 0;
      c.vx = 0;
      c.vz = 20;
      state.t = t;
      meetFoot(state, []);
      return state.foot?.struck.filter((s) => s.foot === crewKey(0, 0)).length ?? 0;
    };
    expect(meeting([null, null])).toBe(1);
    const stolen: (number | null)[] = [null, null];
    stolen[tr.sled!.k] = 5;
    expect(meeting(stolen)).toBe(0);
  });
});

describe("a person struck by a piste machine", () => {
  it("at its working pace is knocked and gets up; driven, hurt — its rider's body never dosed", () => {
    const work = footRow(12, "man", true, "groomer", 20);
    expect(work.knocked).toBe(true);
    expect(work.injured || work.killed).toBe(false);
    expect(work.up).toBe(true);
    const driven = footRow(22, "man", true, "groomer");
    expect(driven.injured).toBe(true);
    expect(driven.casualties).toEqual(["civilian hurt"]);
    expect(driven.injuries).toEqual([]);
    // At a crawl it is the app's push, no collision.
    expect(footRow(9, "man", true, "groomer").knocked).toBe(false);
  });

  it("takes nearly all of the machine's speed and the machine none of his", () => {
    const { state, events } = stageFoot(22, "man", true, "groomer");
    const e = struckOf(events)!;
    expect(e.by).toBe("groomer");
    expect(e.away).toBe(true);
    expect(e.given / e.speed).toBeGreaterThan(1);
    expect(e.taken).toBeLessThan(0.02 * e.speed);
    expect(e.given / e.taken).toBeCloseTo(GROOMER.mass / CROWD_SIZE.man.mass, 3);
    expect(state.groomers![0].speed).toBeCloseTo(22 / 3.6, 6);
    expect(casualtiesOf(state)[0].cause).toBe("groomer");
  });

  it("with injuries off is knocked and gets up", () => {
    const r = footRow(22, "man", false, "groomer", 20);
    expect(r.knocked && r.up).toBe(true);
    expect(r.casualties).toEqual([]);
  });
});

describe("a person struck by the player's body thrown", () => {
  it("is the collision at his own weight, his body slowed and dosed by it", () => {
    const { state, events } = stageFoot(60, "man", true, "thrown");
    const e = struckOf(events)!;
    expect(e.by).toBe("thrown");
    expect(e.away).toBeUndefined();
    expect(e.taken / e.speed).toBeGreaterThan(0.4);
    expect(state.skier.thrown!.vz).toBeCloseTo(60 / 3.6 - e.taken, 1);
    expect(state.foot!.struck[0].dosed).toBe(false);
    const r = footRow(60, "man", true, "thrown");
    expect(r.killed || r.injured).toBe(true);
    expect(r.injuries.length).toBeGreaterThan(0);
  });

  it("with injuries off is knocked and gets up", () => {
    const r = footRow(60, "man", false, "thrown", 20);
    expect(r.knocked).toBe(true);
    expect(r.killed || r.injured).toBe(false);
    expect(r.casualties).toEqual([]);
  });
});

describe("a person struck by a car", () => {
  it("is hurt at the village's pace and killed at the road's, the car never slowed", () => {
    const street = footRow(25, "man", true, "car");
    expect(street.injured).toBe(true);
    const road = footRow(45, "man", true, "car");
    expect(road.killed).toBe(true);
    expect(road.casualties).toEqual(["civilian dead"]);
    expect(road.injuries).toEqual([]);
  });

  it("at the car's own mass, filed as the car's", () => {
    const { state, events } = stageFoot(45, "woman", true, "car");
    const e = struckOf(events)!;
    expect(e.by).toBe("car");
    expect(e.away).toBe(true);
    const ratio = e.given / e.taken;
    const of = Object.values(VEHICLE_MASS).map((m) => m / CROWD_SIZE.woman.mass);
    expect(of.some((r) => Math.abs(ratio - r) < 1e-6 * r)).toBe(true);
    expect(casualtiesOf(state)[0].cause).toBe("car");
  });

  it("with injuries off is knocked and gets up", () => {
    const r = footRow(45, "man", false, "car", 20);
    expect(r.knocked && r.up).toBe(true);
    expect(r.casualties).toEqual([]);
  });

  it("strikes past the blow a skier gives at the strike speed, never under it", () => {
    expect(PERSON_HIT.foot.blow).toBeLessThan(PERSON_HIT.strike * 0.6);
    expect(footRow(15, "man", true, "car").knocked).toBe(true);
  });
});
