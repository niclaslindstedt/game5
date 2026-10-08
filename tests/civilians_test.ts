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
  rolledBall,
  type Ball,
} from "../pwa/src/game/civilian-plan.ts";
import { BOOT_GAIT, roleOf } from "../pwa/src/game/civilian-roles.ts";
import { SNOWBALL, snowballAt } from "../pwa/src/game/civilian-moves.ts";
import { routeAt } from "../pwa/src/game/civilian-route.ts";
import { civilianClear, pastHub, spotsOf } from "../pwa/src/game/civilian-spots.ts";
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
      expect(["walker", "stroller", "baseSkier", "child"]).toContain(c.role);
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
      const c = plan.people[i];
      // A skater skates, and a child pushing a ball goes at its pace.
      if (!c.leg || c.skis || c.role === "roller") continue;
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
        const pace = plan.people[i].skis ? plan.people[i].leg!.speed : BOOT_GAIT.speed[1];
        expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(pace * 0.1 + 0.02);
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

describe("the base area", () => {
  const village = level.resort!.village;
  const feet = liftPlans(level)
    .map((p) => p.lift.bottom)
    .filter((b) => b.y - village.y < 60);
  /** On the valley floor's base: about the village or a lift's foot there. */
  const atBase = (x: number, z: number): boolean =>
    Math.hypot(x - village.x, z - village.z) < 150 ||
    feet.some((b) => Math.hypot(x - b.x, z - b.z) < 60);
  const MOVING = ["walk", "skate", "roll"];

  it("is busy by day, and most busy at midday: a crowd, much of it on the move", () => {
    const pose = freshCivilianPose();
    const count = (hour: number) => {
      let all = 0;
      let moving = 0;
      for (let i = 0; i < plan.people.length; i++) {
        for (const t of [30, 300]) {
          civilianAt(plan, i, t, hour, pose);
          if (!pose.shown || !atBase(pose.x, pose.z)) continue;
          all++;
          if (MOVING.includes(pose.activity)) moving++;
        }
      }
      return { all: all / 2, moving: moving / 2 };
    };
    const noon = count(NOON);
    expect(noon.all).toBeGreaterThan(100);
    expect(noon.moving).toBeGreaterThan(30);
    expect(count(16.5).all).toBeGreaterThan(70);
    expect(count(NIGHT).all).toBeLessThan(noon.all / 3);
  });

  it("goes round the base: rounds of several stops, every line of them clear the whole way", () => {
    const rounds = plan.people.filter((c) => c.leg && c.leg.points.length > 2);
    expect(rounds.length).toBeGreaterThan(10);
    // The rounds keep to the base's mountain side of the hub.
    for (const c of rounds) {
      if (c.leg!.side !== 0) continue;
      for (const p of c.leg!.points) expect(pastHub(level, p.x, p.z)).toBe(false);
    }
    for (const c of plan.people) {
      if (!c.leg) continue;
      const r = c.leg;
      // Out to the end and back, sampled every half metre.
      for (let u = 0; u < r.cycle; u += 0.5 / r.speed) {
        const at = routeAt(r, u);
        expect(civilianClear(level, at.x, at.z)).toBe(true);
      }
    }
  });

  it("has a few guests skating between the lifts' feet along the valley floor", () => {
    const skaters = plan.people.filter((c) => c.skis);
    expect(skaters.length).toBeGreaterThanOrEqual(3);
    const ground = wildGround(level);
    for (const c of skaters) {
      const r = c.leg!;
      expect(r.speed).toBeGreaterThan(1.5);
      expect(r.speed).toBeLessThan(4);
      for (let u = 0; u < r.cycle; u += 1 / r.speed) {
        const at = routeAt(r, u);
        expect(ground.slope(at.x, at.z)).toBeLessThanOrEqual(0.12 + 1e-9);
      }
    }
    // Skating at their pace while they move, stood on their skis between.
    const pose = freshCivilianPose();
    const acts = new Set<string>();
    for (let i = 0; i < plan.people.length; i++) {
      if (!plan.people[i].skis) continue;
      for (let t = 0; t < 120; t += 7) acts.add(civilianAt(plan, i, t, NOON, pose).activity);
    }
    expect(acts.has("skate")).toBe(true);
    expect(acts.has("walk")).toBe(false);
  });

  it("throws snowballs across the ring, in an arc, and only while thrown", () => {
    const pose = freshCivilianPose();
    const ball = { x: 0, y: 0, z: 0 };
    let flown = 0;
    for (let i = 0; i < plan.people.length; i++) {
      const c = plan.people[i];
      for (let t = 0; t < 30; t += 0.05) {
        civilianAt(plan, i, t, NOON, pose);
        const b = snowballAt(pose, ball);
        if (c.role !== "snowballer") {
          expect(b).toBeNull();
          continue;
        }
        if (!b) continue;
        flown++;
        const d = Math.hypot(b.x - pose.x, b.z - pose.z);
        expect(d).toBeLessThanOrEqual(SNOWBALL.reach + 0.01);
        expect(b.y - pose.y).toBeGreaterThan(0.5);
        expect(b.y - pose.y).toBeLessThan(SNOWBALL.from + SNOWBALL.arc + 0.01);
      }
    }
    expect(flown).toBeGreaterThan(0);
  });

  it("builds snowmen at every stage, and rolls the next ball to one, growing", () => {
    const stages = new Set(plan.props.filter((p) => p.kind === "snowman").map((p) => p.stage));
    expect(stages.size).toBeGreaterThan(1);
    const rollers = plan.people.map((c, i) => ({ c, i })).filter(({ c }) => c.role === "roller");
    expect(rollers.length).toBeGreaterThan(0);
    const ball: Ball = { x: 0, y: 0, z: 0, r: 0 };
    const pose = freshCivilianPose();
    for (const { c, i } of rollers) {
      const r = c.leg!;
      let last = 0;
      let grew = false;
      for (let u = 0; u < r.lengths[0] / r.speed; u += 0.5) {
        const t = u - c.offset;
        const b = rolledBall(plan, i, t, ball);
        expect(b).not.toBeNull();
        expect(civilianAt(plan, i, t, NOON, pose).activity).toBe("roll");
        if (b!.r > last + 1e-9 && last > 0) grew = true;
        last = b!.r;
        // The ball ahead of his feet, on the snow.
        expect(Math.hypot(b!.x - pose.x, b!.z - pose.z)).toBeLessThan(0.7);
      }
      expect(grew).toBe(true);
      // Ended against the snowman, never into it.
      const snowman = plan.props.filter((p) => p.kind === "snowman");
      const end = rolledBall(plan, i, r.lengths[0] / r.speed + 0.5 - c.offset, ball)!;
      const near = Math.min(...snowman.map((s) => Math.hypot(s.x - end.x, s.z - end.z)));
      expect(near).toBeGreaterThan(0.36 + end.r - 0.01);
      expect(near).toBeLessThan(1.2);
    }
    // Nobody else rolls one.
    for (let i = 0; i < plan.people.length; i++) {
      if (plan.people[i].role !== "roller") expect(rolledBall(plan, i, 10, ball)).toBeNull();
    }
  });
});
