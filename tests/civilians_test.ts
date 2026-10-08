// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CIVILIANS — the people on foot about a free ride's ski area
// (`civilian-plan.ts` over `civilian-roles.ts` and `civilian-spots.ts`),
// held without a renderer: dealt the same off the same map, never off the
// run's stream, stood off the skiing at every moment, the lift crew at
// every lift, the partiers at the lodges, the night thinned out, and a
// walker at a boot's pace.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CABINS,
  cabinWalls,
  cabinsOf,
  freeRules,
  liftPlans,
  pisteGap,
  slalomRules,
  stationHouses,
} from "@engine";

import {
  civilianAt,
  civilianHour,
  civilianPlanFor,
  civiliansOut,
  freshCivilianPose,
  hasCivilians,
  planCivilians,
  CIVILIAN_MOST,
} from "../pwa/src/game/civilian-plan.ts";
import { BOOT_GAIT, roleOf } from "../pwa/src/game/civilian-roles.ts";
import { civilianClear, spotsOf } from "../pwa/src/game/civilian-spots.ts";
import { DECK, DECK_END, TERRACE } from "../pwa/src/game/lodge-measure.ts";
import { wildGround } from "../pwa/src/game/wild-ground.ts";
import { levelFor } from "./support/levels.ts";

const SEED = 38;
const level = levelFor(SEED);
const plan = civilianPlanFor(level);
const NOON = 12.5;
const NIGHT = 21;
const TIMES = [0, 7.3, 41, 129.5, 333, 917.25];

/** Whether a civilian works at a lift's post (beside its load line). */
const atPost = (spot: string): boolean => /-(foot|top)$/.test(spot);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the civilians' plan", () => {
  it("is a ski area's worth of people, under the cap", () => {
    expect(plan.people.length).toBeGreaterThan(40);
    expect(plan.people.length).toBeLessThanOrEqual(CIVILIAN_MOST);
  });

  it("is dealt the same off the same map, and off nothing random", () => {
    const random = vi.spyOn(Math, "random");
    const again = planCivilians(level);
    expect(random).not.toHaveBeenCalled();
    expect(JSON.stringify(again.people)).toBe(JSON.stringify(plan.people));
    expect(JSON.stringify(again.props)).toBe(JSON.stringify(plan.props));
  });

  it("is only a free ride's", () => {
    expect(hasCivilians(freeRules(1))).toBe(true);
    expect(hasCivilians(slalomRules(1))).toBe(false);
    // After dark the amateurs go in and the terraces party on.
    expect(hasCivilians({ ...freeRules(1), crowd: 0 })).toBe(true);
    expect(civilianHour(level)).toBe(level.sun.hour);
  });

  it("finds its places through the sources: every lift's foot, the lodges, the cabins", () => {
    const spots = spotsOf(level);
    for (const p of liftPlans(level)) {
      expect(spots.some((s) => s.id === `${p.lift.id}-foot`)).toBe(true);
    }
    for (const c of cabinsOf(level).filter((c) => c.kind === "afterski")) {
      expect(spots.some((s) => s.id === `${c.id}-terrace`)).toBe(true);
    }
  });
});

describe("where a civilian stands", () => {
  it("is off every run and clear of the trees, the walls and the station houses, at every moment", () => {
    const ground = wildGround(level);
    const walls = cabinWalls(level);
    const houses = liftPlans(level).flatMap((p) => stationHouses(level, p));
    const pose = freshCivilianPose();
    for (let i = 0; i < plan.people.length; i++) {
      const c = plan.people[i];
      for (const t of TIMES) {
        civilianAt(plan, i, t, NOON, pose);
        for (const w of walls) {
          expect(Math.hypot(w.x - pose.x, w.z - pose.z)).toBeGreaterThan(w.radius + 0.2);
        }
        expect(ground.nearestTree(pose.x, pose.z, 0.8)).toBeNull();
        for (const h of houses) {
          const dx = pose.x - h.x;
          const dz = pose.z - h.z;
          const u = dx * h.plan.dx + dz * h.plan.dz;
          const v = dx * h.plan.dz - dz * h.plan.dx;
          expect(Math.abs(u) < h.halfLength && Math.abs(v) < h.halfWidth).toBe(false);
        }
        if (atPost(c.spot) || c.deck) continue;
        expect(pisteGap(level, pose.x, pose.z, 40)).toBeGreaterThan(1.5);
      }
    }
  });

  it("walks only where he may stand, the whole leg", () => {
    const pose = freshCivilianPose();
    for (let i = 0; i < plan.people.length; i++) {
      const c = plan.people[i];
      if (!c.leg) continue;
      const cycle = 2 * (c.leg.length / c.leg.speed + c.leg.pause);
      for (let k = 0; k < 24; k++) {
        civilianAt(plan, i, (k / 24) * cycle, NOON, pose);
        expect(civilianClear(level, pose.x, pose.z)).toBe(true);
      }
    }
  });

  it("stands on the snow, or on a lodge's deck", () => {
    const ground = wildGround(level);
    const lodges = cabinsOf(level).filter((c) => c.kind === "afterski");
    const pose = freshCivilianPose();
    for (let i = 0; i < plan.people.length; i++) {
      civilianAt(plan, i, 55, NOON, pose);
      if (plan.people[i].deck) {
        expect(lodges.some((l) => Math.abs(pose.y - (l.y + DECK.top)) < 1e-6)).toBe(true);
      } else {
        expect(pose.y).toBeCloseTo(ground.snowY(pose.x, pose.z), 6);
      }
    }
  });
});

describe("who is where", () => {
  it("has the lift crew at every lift's foot, out by day and after dark", () => {
    const pose = freshCivilianPose();
    for (const p of liftPlans(level)) {
      const crew = plan.people
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.role === "liftAttendant" && c.spot === `${p.lift.id}-foot`);
      expect(crew.length).toBeGreaterThan(0);
      for (const { c } of crew) {
        expect(Math.hypot(c.home.x - p.lift.bottom.x, c.home.z - p.lift.bottom.z)).toBeLessThan(40);
      }
      for (const hour of [NOON, NIGHT]) {
        expect(crew.some(({ i }) => civilianAt(plan, i, 10, hour, pose).shown)).toBe(true);
      }
    }
  });

  it("has the partiers on the lodges' terraces and nowhere else", () => {
    const lodges = cabinsOf(level).filter((c) => c.kind === "afterski");
    const d = CABINS.afterski;
    /** On the lodge's terrace, in its own frame. */
    const onTerrace = (l: (typeof lodges)[number], x: number, z: number): boolean => {
      const fx = Math.sin(l.heading);
      const fz = Math.cos(l.heading);
      const lx = (x - l.x) * fz - (z - l.z) * fx;
      const lz = (x - l.x) * fx + (z - l.z) * fz;
      return (
        Math.abs(lx) <= d.width / 2 + DECK_END && lz >= d.depth / 2 && lz <= d.depth / 2 + TERRACE
      );
    };
    const partiers = plan.people.filter(
      (c) => c.role === "partier" || c.role === "terraceSitter" || c.role === "terraceKnot",
    );
    expect(partiers.length).toBeGreaterThan(0);
    for (const c of partiers) {
      expect(c.deck).toBe(true);
      expect(lodges.some((l) => onTerrace(l, c.home.x, c.home.z))).toBe(true);
    }
  });

  it("thins out at night to the partiers, a few staff and the odd walker", () => {
    expect(civiliansOut(plan, NIGHT)).toBeLessThan(civiliansOut(plan, NOON));
    expect(civiliansOut(plan, 6)).toBeLessThan(civiliansOut(plan, NOON));
    const pose = freshCivilianPose();
    let walkers = 0;
    let all = 0;
    for (let i = 0; i < plan.people.length; i++) {
      const c = plan.people[i];
      if (!civilianAt(plan, i, 0, NIGHT, pose).shown) continue;
      all++;
      if (roleOf(c.role).staff || c.deck) continue;
      expect(["walker", "child"]).toContain(c.role);
      walkers++;
    }
    expect(walkers).toBeLessThan(all / 3);
  });
});

describe("how a civilian moves", () => {
  it("walks at a boot's pace", () => {
    const a = freshCivilianPose();
    const b = freshCivilianPose();
    let legs = 0;
    for (let i = 0; i < plan.people.length; i++) {
      if (!plan.people[i].leg) continue;
      legs++;
      for (const t of TIMES) {
        civilianAt(plan, i, t, NOON, a);
        civilianAt(plan, i, t + 0.5, NOON, b);
        if (a.activity !== "walk" || b.activity !== "walk" || a.heading !== b.heading) continue;
        const v = Math.hypot(b.x - a.x, b.z - a.z) / 0.5;
        expect(v).toBeGreaterThan(BOOT_GAIT.speed[0] * 0.8);
        expect(v).toBeLessThanOrEqual(BOOT_GAIT.speed[1] + 1e-9);
        expect(b.walked - a.walked).toBeCloseTo(v * 0.5, 6);
      }
    }
    expect(legs).toBeGreaterThan(0);
  });

  it("never slides or jumps between two moments", () => {
    const a = freshCivilianPose();
    const b = freshCivilianPose();
    for (let i = 0; i < plan.people.length; i++) {
      for (const t of TIMES) {
        civilianAt(plan, i, t, NOON, a);
        civilianAt(plan, i, t + 0.1, NOON, b);
        expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.12);
      }
    }
  });

  it("is a pure function of the clock", () => {
    const a = freshCivilianPose();
    const b = freshCivilianPose();
    for (let i = 0; i < plan.people.length; i++) {
      civilianAt(plan, i, 512.5, NOON, a);
      civilianAt(plan, i, 3, NIGHT, b);
      civilianAt(plan, i, 512.5, NOON, b);
      expect(b).toEqual(a);
    }
  });

  it("dances to one beat on a terrace", () => {
    const pose = freshCivilianPose();
    for (let i = 0; i < plan.people.length; i++) {
      civilianAt(plan, i, 200, NIGHT, pose);
      if (pose.activity === "dance") expect(pose.clock).toBe(200);
    }
  });
});
