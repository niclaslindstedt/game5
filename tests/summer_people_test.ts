// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER'S PEOPLE ON FOOT — a free ride's ski area in midsummer
// (`civilian-summer.ts`, dealt by `civilian-plan.ts`, dressed by
// `civilian-dress.ts`): far fewer than a winter's day by the research's
// factor (`SUMMER_GUESTS`), the lift crew at every lift that runs and none
// at a drag that stands still, nobody on skis or carrying them, no snowman,
// hikers on the cat tracks, dressed in nothing a winter wears, dealt off a
// salt of their own so the winter's plan is as it was; the dogs out fewer
// and in no coat; the village's streets painted bare.

import { describe, expect, it, vi } from "vitest";

import { PART, civilianKit, kitParts, CIVILIAN_PALETTE } from "../pwa/src/game/civilian-dress.ts";
import {
  civilianAt,
  civilianPlanFor,
  civiliansOut,
  freshCivilianPose,
  planCivilians,
} from "../pwa/src/game/civilian-plan.ts";
import { freshRouteAt, routeAt } from "../pwa/src/game/civilian-route.ts";
import { SUMMER_GUESTS, WINTER_ONLY } from "../pwa/src/game/civilian-summer.ts";
import { dogPlanFor, householdOut } from "../pwa/src/game/dog-walk.ts";
import { paintArea, paintRoad, paintWalk, type Paint } from "../pwa/src/game/street-paint.ts";
import {
  paintSummerArea,
  paintSummerRoad,
  paintSummerWalk,
} from "../pwa/src/game/street-paint-summer.ts";
import { levelFor } from "./support/levels.ts";

const level = levelFor(38);
const winter = civilianPlanFor(level);
const summer = civilianPlanFor(level, true);
const NOON = 13;

const guestsOut = (p: typeof winter, hour: number): number => {
  let n = 0;
  const pose = freshCivilianPose();
  p.people.forEach((c, i) => {
    if (c.dress !== "guest") return;
    civilianAt(p, i, 600, hour, pose);
    if (pose.shown) n++;
  });
  return n;
};

describe("the summer's plan", () => {
  it("is a summer's, and dealt the same off the same map off nothing random", () => {
    expect(summer.summer).toBe(true);
    expect(winter.summer).toBe(false);
    const random = vi.spyOn(Math, "random");
    const again = planCivilians(level, true);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    expect(JSON.stringify(again.people)).toBe(JSON.stringify(summer.people));
    expect(JSON.stringify(again.props)).toBe(JSON.stringify(summer.props));
  });

  it("leaves the winter's plan as it was", () => {
    expect(JSON.stringify(planCivilians(level).people)).toBe(JSON.stringify(winter.people));
  });

  it("is far fewer than a winter's day, by the research's factor", () => {
    const w = guestsOut(winter, NOON);
    const s = guestsOut(summer, NOON);
    expect(w).toBeGreaterThan(100);
    // About a quarter: the factor, with the hikers on the tracks over it.
    expect(s / w).toBeGreaterThan(SUMMER_GUESTS * 0.6);
    expect(s / w).toBeLessThan(SUMMER_GUESTS * 1.4);
    expect(civiliansOut(summer, NOON)).toBeLessThan(civiliansOut(winter, NOON) * 0.4);
  });

  it("keeps the crew at every lift that runs, and none at a drag", () => {
    const lifts = level.resort?.lifts ?? [];
    for (const l of lifts) {
      const crew = summer.people.filter((c) => c.spot === `${l.id}-foot`);
      if (l.kind === "drag") expect(crew).toHaveLength(0);
      else expect(crew.some((c) => c.role === "liftAttendant")).toBe(true);
    }
  });

  it("puts nobody on skis, nothing on a shoulder and no snowman up", () => {
    for (const c of summer.people) {
      expect(WINTER_ONLY).not.toContain(c.role);
      expect(c.skis).toBe(false);
      for (const step of c.routine) expect(step.carry ?? "none").not.toBe("skis");
    }
    expect(summer.props.some((p) => p.kind === "snowman")).toBe(false);
    expect(summer.props.some((p) => p.kind === "blanket")).toBe(true);
    const pose = freshCivilianPose();
    summer.people.forEach((_, i) => {
      for (const t of [0, 77, 410]) {
        civilianAt(summer, i, t, NOON, pose);
        expect(pose.carry).not.toBe("skis");
        expect(pose.activity).not.toBe("skate");
      }
    });
  });

  it("walks hikers along the cat tracks, through their bends and back", () => {
    const hikers = summer.people.filter((c) => c.spot.startsWith("track-"));
    expect(hikers.length).toBeGreaterThan(2);
    const at = freshRouteAt();
    for (const c of hikers) {
      expect(c.leg?.through).toBe(true);
      for (const t of [0, 31, 250]) {
        routeAt(c.leg!, t, at);
        expect(Number.isFinite(at.x) && Number.isFinite(at.z)).toBe(true);
      }
    }
    expect(winter.people.some((c) => c.spot.startsWith("track-"))).toBe(false);
  });
});

describe("the summer's kit", () => {
  it("wears no ski helmet, beanie or skis, in colours the palette has", () => {
    const pose = freshCivilianPose();
    summer.people.forEach((c, i) => {
      const kit = civilianKit(c, level.seed, true);
      expect(["helmet", "beanie"]).not.toContain(kit.head);
      for (const k of kit.colours) expect(k).toBeLessThan(CIVILIAN_PALETTE.length);
      civilianAt(summer, i, 120, NOON, pose);
      const parts = kitParts(kit, pose, [0, 0, 0, 0]);
      expect(parts).not.toContain(PART.skis);
      expect(parts).not.toContain(PART.snowball);
    });
  });

  it("puts the riders in full-face helmets and the hikers' poles in their hands", () => {
    const riders = summer.people.filter((c) => c.role === "biker");
    for (const c of riders) {
      const kit = civilianKit(c, level.seed, true);
      expect(["fullface", "cap", "hair"]).toContain(kit.head);
    }
    const pose = freshCivilianPose();
    const i = summer.people.findIndex((c) => c.role === "hiker");
    civilianAt(summer, i, 0, NOON, pose);
    expect(pose.carry === "poles" || pose.carry === "mug").toBe(true);
  });
});

describe("the summer's dogs and streets", () => {
  it("walks fewer dogs, none in a coat", () => {
    const w = dogPlanFor(level)!;
    const s = dogPlanFor(level, true)!;
    expect(s.households.length).toBe(w.households.length);
    const out = (p: NonNullable<typeof w>) =>
      p.households.filter((_, h) => householdOut(p, h, NOON)).length;
    expect(out(s)).toBeLessThan(out(w));
    for (const h of s.households) for (const d of h.dogs) expect(d.dressed).toBe(false);
  });

  it("paints the streets as asphalt and bare stone, not snow", () => {
    const light = (p: Paint): number => {
      let sum = 0;
      for (let k = 0; k < p.data.length; k += 4) sum += p.data[k] + p.data[k + 1] + p.data[k + 2];
      return sum / (p.data.length / 4) / 3;
    };
    expect(light(paintSummerRoad())).toBeLessThan(120);
    expect(light(paintSummerArea())).toBeLessThan(120);
    expect(light(paintSummerWalk())).toBeLessThan(170);
    expect(light(paintRoad())).toBeGreaterThan(190);
    expect(light(paintArea())).toBeGreaterThan(190);
    expect(light(paintWalk())).toBeGreaterThan(170);
  });
});
