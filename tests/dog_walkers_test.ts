// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PEOPLE WALKING THEIR DOGS (`dog-walk.ts`, `dog-walk-net.ts`,
// `dog-walk-route.ts`, `dog-walk-pose.ts`): dealt the same off the same
// map and never off the run's stream; where everybody is and what lies on
// the sidewalk a pure function of the clock, whatever was asked before;
// on the sidewalks and off the carriageways but at a crossing, and over
// one only when no car is on it; every dog within its lead of the hand;
// every dog squatting and leaving its pile on a long run, the pile where
// it squatted, from the moment it is laid until it is bagged; and only
// where the ski area has its people on foot (a free ride).

import { describe, expect, it, vi } from "vitest";
import {
  freeRules,
  freshVehiclePose,
  onCarriageway,
  slalomRules,
  trafficOf,
  vehicleAt,
  villageOf,
} from "@engine";

import { freshCivilianPose, hasCivilians } from "../pwa/src/game/civilian-plan.ts";
import { DOG_WALK } from "../pwa/src/game/dog-defs.ts";
import {
  dogPlanFor,
  dogShareAt,
  householdOut,
  messAt,
  planDogWalks,
  walkAt,
  walkOf,
  type DogPlan,
  type Mess,
} from "../pwa/src/game/dog-walk.ts";
import { walkNetOf } from "../pwa/src/game/dog-walk-net.ts";
import { dogAt, dogWalkerAt, freshDogPose } from "../pwa/src/game/dog-walk-pose.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const plan = dogPlanFor(level)!;
/** The hour every household is out at (the morning walk's peak). */
const PEAK = 7.6;
/** A long run, s, and the step the timeline is sampled at. */
const LONG = 2400;
const DT = 0.5;

/** How far a crossing's centre the carriageway under one reaches, m. */
const CROSSING_REACH = 7;

describe("the dog walks", () => {
  it("are a village's households, each with a dog or two", () => {
    expect(plan).not.toBeNull();
    expect(plan.households.length).toBe(DOG_WALK.households);
    for (const hh of plan.households) {
      expect(hh.dogs.length).toBeGreaterThanOrEqual(1);
      expect(hh.dogs.length).toBeLessThanOrEqual(2);
    }
    expect(plan.households.some((hh) => hh.dogs.length === 2)).toBe(true);
    expect(plan.households.some((hh) => hh.child !== null)).toBe(true);
  });

  it("walk a sidewalk network that holds together", () => {
    const net = walkNetOf(level)!;
    const seen = new Set([0]);
    const todo = [0];
    while (todo.length > 0) {
      const u = todo.pop()!;
      for (const k of net.adj[u]) {
        const e = net.edges[k];
        const w = e.a === u ? e.b : e.a;
        if (!seen.has(w)) {
          seen.add(w);
          todo.push(w);
        }
      }
    }
    expect(seen.size).toBe(net.nodes.length);
    expect(net.edges.some((e) => e.crossing)).toBe(true);
  });

  it("are dealt the same every time, off no stream but their own", () => {
    const random = vi.spyOn(Math, "random");
    const again = planDogWalks(level)!;
    expect(again.households).toEqual(plan.households);
    for (let h = 0; h < 4; h++) {
      expect(walkOf(again, h, 1).legs).toEqual(walkOf(plan, h, 1).legs);
      expect(walkOf(again, h, 1).mess).toEqual(walkOf(plan, h, 1).mess);
    }
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("put everybody and everything at a moment the same whatever was asked before", () => {
    const fresh = (): DogPlan => planDogWalks(level)!;
    const a = fresh();
    const b = fresh();
    // One asked straight at the moment, the other walked up to it.
    for (const t of [30, 400, 900]) messAt(b, t, PEAK);
    const p = freshDogPose();
    const q = freshDogPose();
    for (const t of [905.5, 1300]) {
      expect(messAt(a, t, PEAK)).toEqual(messAt(b, t, PEAK));
      for (let h = 0; h < a.households.length; h++) {
        dogAt(a, h, 0, t, PEAK, p);
        dogAt(b, h, 0, t, PEAK, q);
        expect(p).toEqual(q);
      }
    }
  });

  it("keep fewer households out in the small hours than on the morning walk", () => {
    expect(dogShareAt(3)).toBeLessThan(0.15);
    expect(dogShareAt(PEAK)).toBeGreaterThan(0.85);
    const out = (hour: number) =>
      plan.households.filter((_, h) => householdOut(plan, h, hour)).length;
    expect(out(3)).toBeLessThan(out(PEAK));
  });
});

describe("on the sidewalks", () => {
  const v = villageOf(level)!;
  const traffic = trafficOf(level);
  const car = freshVehiclePose();
  const nearCrossing = (x: number, z: number): boolean =>
    v.crossings.some((c) => Math.hypot(c.x - x, c.z - z) < CROSSING_REACH);

  it("keeps owners and dogs off the carriageway but at a crossing, a dog within its lead", () => {
    const dog = freshDogPose();
    const walker = freshCivilianPose();
    let onRoad = 0;
    let samples = 0;
    for (let t = 0; t < LONG / 2; t += DT) {
      for (let h = 0; h < plan.households.length; h++) {
        dogWalkerAt(plan, h, 0, t, PEAK, walker);
        if (!walker.shown) continue;
        samples++;
        if (onCarriageway(level, walker.x, walker.z)) {
          onRoad++;
          expect(nearCrossing(walker.x, walker.z), `owner ${h} at ${t}`).toBe(true);
        }
        for (let d = 0; d < plan.households[h].dogs.length; d++) {
          dogAt(plan, h, d, t, PEAK, dog);
          expect(dog.shown).toBe(true);
          if (onCarriageway(level, dog.x, dog.z)) {
            expect(nearCrossing(dog.x, dog.z), `dog ${h}/${d} at ${t}`).toBe(true);
          }
          // Within its lead and the reach of the hand that holds it.
          const lead = plan.households[h].dogs[d].lead;
          expect(Math.hypot(dog.x - walker.x, dog.z - walker.z)).toBeLessThan(lead + 0.6);
        }
      }
    }
    expect(samples).toBeGreaterThan(1000);
    // Crossing streets, but only now and then.
    expect(onRoad).toBeGreaterThan(0);
    expect(onRoad / samples).toBeLessThan(0.12);
  });

  it("crosses a street only with no car on the crossing", () => {
    if (!traffic) return;
    const walker = freshCivilianPose();
    for (let t = 0; t < LONG / 2; t += DT) {
      for (let h = 0; h < plan.households.length; h++) {
        dogWalkerAt(plan, h, 0, t, PEAK, walker);
        if (!walker.shown || !onCarriageway(level, walker.x, walker.z)) continue;
        for (let k = 0; k < traffic.vehicles.length; k++) {
          vehicleAt(traffic, k, t, car);
          if (!car.shown) continue;
          expect(
            Math.hypot(car.x - walker.x, car.z - walker.z),
            `owner ${h} at ${t}`,
          ).toBeGreaterThan(2.5);
        }
      }
    }
  });
});

describe("what the dogs leave", () => {
  it("every dog squats and leaves its pile on a long run", () => {
    const pose = freshDogPose();
    for (const hh of plan.households) {
      for (let d = 0; d < hh.dogs.length; d++) {
        let squatted = false;
        for (let k = 0; ; k++) {
          const w = walkOf(plan, hh.id, k);
          if (w.t0 > LONG * 2) break;
          for (const st of w.stops) {
            if (st.dog !== d || st.act !== "poop") continue;
            dogAt(plan, hh.id, d, (st.te + st.circle + st.tr) / 2, PEAK, pose);
            expect(pose.act).toBe("poop");
            squatted = true;
          }
        }
        expect(squatted, `household ${hh.id}'s dog ${d}`).toBe(true);
      }
    }
    const piles = plan.walks.flat().flatMap((w) => w.mess.filter((m) => m.kind === "poop"));
    expect(piles.length).toBeGreaterThan(plan.households.length);
  });

  it("lays each pile under its dog's squat, on the sidewalk and never on the road", () => {
    for (const w of plan.walks.flat()) {
      const squats = w.stops.filter((st) => st.act === "poop");
      for (const m of w.mess.filter((x) => x.kind === "poop")) {
        expect(onCarriageway(level, m.x, m.z)).toBe(false);
        expect(squats.some((st) => m.at >= st.te + st.circle && m.at <= st.tr)).toBe(true);
      }
    }
  });

  it("shows at a moment exactly the piles laid by then and not bagged, and keeps them", () => {
    const all = (): Mess[] => plan.walks.flat().flatMap((w) => w.mess);
    const seen: Mess[] = [];
    let before: Mess[] = [];
    for (const t of [120, 360, 720, 1100, 1500]) {
      messAt(plan, t, PEAK, seen);
      const expected = all()
        .filter((m) => m.at >= 0 && m.at <= t && m.until > t)
        .sort((a, b) => a.at - b.at)
        .slice(-DOG_WALK.kept);
      expect(new Set(seen)).toEqual(new Set(expected));
      // What lay there before and was not bagged since still lies there.
      for (const m of before) {
        if (m.until > t && seen.length < DOG_WALK.kept) expect(seen).toContain(m);
      }
      before = [...seen];
    }
    expect(before.some((m) => m.kind === "poop")).toBe(true);
  });

  it("bags some piles but leaves most of them", () => {
    const piles = plan.walks.flat().flatMap((w) => w.mess.filter((m) => m.kind === "poop"));
    const bagged = piles.filter((m) => m.until < Infinity).length;
    expect(bagged).toBeGreaterThan(0);
    expect(bagged / piles.length).toBeLessThan(0.5);
  });
});

describe("only where the ski area has its people on foot", () => {
  it("is a free ride's", () => {
    expect(hasCivilians(freeRules(1))).toBe(true);
    expect(hasCivilians(slalomRules(1))).toBe(false);
  });
  it("walks at a household's own pace, home between walks", () => {
    for (let h = 0; h < plan.households.length; h++) {
      const a = walkOf(plan, h, 0);
      const b = walkOf(plan, h, 1);
      expect(b.t0).toBeGreaterThan(a.t1 + DOG_WALK.home[0] - 1e-6);
      expect(walkAt(plan, h, (a.t1 + b.t0) / 2)).toBeNull();
    }
  });
});
