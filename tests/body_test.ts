// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY: a blow is a stop over the body's give and the snow's, fitted to
// the measured head drops on snow; the same fall is softer in powder than
// on the groomer and hardest on ice; an injury is a chance on a risk curve,
// drawn off a hash so a run replays injury for injury; a clean landing
// hurts nothing and a trunk at speed hurts a great deal; and the whole body
// is summed as the trauma ward sums it.

import { describe, expect, it } from "vitest";

import {
  BODY_PARTS,
  INJURIES,
  NEUTRAL_INPUT,
  SKI_CATALOG,
  TUNING,
  blowOf,
  createGame,
  freshBody,
  placeRun,
  riskOf,
  severityOf,
  snowGive,
  step,
  type GameEvent,
  type GameState,
  type RunMoment,
  type SkierInput,
} from "@engine";
import { flatLevel, LONE_TREE, pisteX, SLOPE, syntheticLevel } from "./support/synthetic.ts";

const I = TUNING.injury;
const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };

function staged(
  level: ReturnType<typeof flatLevel>,
  moment: RunMoment,
  snowDepth?: number,
): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, quiet: true, snowDepth });
  placeRun(state, moment);
  return state;
}

function ride(state: GameState, seconds: number, input: SkierInput = NEUTRAL_INPUT): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, input);
    events.push(...state.events);
  }
  return events;
}

describe("a blow", () => {
  it("is fitted to the measured head drops on snow: 51, 106 and 170 g at 6.1 m/s", () => {
    // Soft snow, the groomer (the study's hard), and ice (its very hard).
    const head = I.give.head;
    expect(blowOf(6.1, head + I.snow.soft)).toBeGreaterThan(51 * 0.85);
    expect(blowOf(6.1, head + I.snow.soft)).toBeLessThan(51 * 1.15);
    expect(blowOf(6.1, head + I.snow.packed)).toBeGreaterThan(106 * 0.85);
    expect(blowOf(6.1, head + I.snow.packed)).toBeLessThan(106 * 1.15);
    expect(blowOf(6.1, head + I.snow.ice)).toBeGreaterThan(170 * 0.85);
    expect(blowOf(6.1, head + I.snow.ice)).toBeLessThan(170 * 1.15);
  });

  it("a helmet at its test speed into a trunk risks a concussion, never a fracture", () => {
    // 5.4 m/s (about 20 km/h), the speed a helmet is tested at and about as
    // fast as one protects: the trunk crushes its liner.
    const g = blowOf(5.4, I.give.head + I.tree + I.helmet);
    expect(riskOf(g, INJURIES.concussion.at)).toBeGreaterThan(0.1);
    expect(riskOf(g, INJURIES.concussion.at)).toBeLessThan(0.5);
    expect(riskOf(g, INJURIES.skullFracture.at)).toBe(0);
    // ...and at 30 km/h a trunk can already fracture the skull of a skier
    // in a helmet.
    expect(
      riskOf(blowOf(30 / 3.6, I.give.head + I.tree + I.helmet), INJURIES.skullFracture.at),
    ).toBeGreaterThan(0.2);
  });

  it("the snow gives more the softer and the deeper it is, and least on ice", () => {
    const packed = flatLevel({ packed: 1 });
    const powder = flatLevel({ packed: 0 });
    const at = (level: typeof packed, depth: number, fresh = 0): number => {
      const state = createGame({ level, rivals: 0, countdown: 0, quiet: true, snowDepth: depth });
      state.fresh = fresh;
      return snowGive(state, 1500, 300);
    };
    expect(at(packed, 1)).toBeCloseTo(I.snow.packed, 6);
    expect(at(powder, 1)).toBeGreaterThan(at(packed, 1) * 4);
    expect(at(powder, 2)).toBeGreaterThan(at(powder, 1));
    // New snow over the groomer softens it.
    expect(at(packed, 1, 0.2)).toBeGreaterThan(at(packed, 1));
    expect(I.snow.ice).toBeLessThan(I.snow.packed);
  });
});

describe("the risk curve", () => {
  it("is an even chance at its dose, nothing under its floor, and rises with the dose", () => {
    expect(riskOf(40, 40)).toBeCloseTo(0.5, 9);
    expect(riskOf(40 * I.floor * 0.99, 40)).toBe(0);
    let last = 0;
    for (let d = 20; d <= 80; d += 2) {
      const p = riskOf(d, 40);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    expect(riskOf(50, 40)).toBeGreaterThan(0.85);
  });
});

describe("the catalog", () => {
  it("gives every part a ladder, and every injury a part, a rank and a dose", () => {
    const parts = new Set<string>(BODY_PARTS.map((p) => p.replace(/[LR]$/, "")));
    for (const [kind, def] of Object.entries(INJURIES)) {
      expect(parts.has(def.part), kind).toBe(true);
      expect(def.ais, kind).toBeGreaterThanOrEqual(1);
      expect(def.ais, kind).toBeLessThanOrEqual(5);
      expect(def.at, kind).toBeGreaterThan(0);
    }
    for (const part of parts) {
      expect(
        Object.values(INJURIES).some((d) => d.part === part),
        part,
      ).toBe(true);
    }
  });
});

describe("the body on the snow", () => {
  it("a clean landing off the slope's kicker hurts nothing, on any pair", () => {
    for (const spec of SKI_CATALOG) {
      const state = createGame({
        level: syntheticLevel(),
        rivals: 0,
        countdown: 0,
        spec,
        quiet: true,
      });
      placeRun(state, {
        x: pisteX(SLOPE.kickerZ - 60),
        z: SLOPE.kickerZ - 60,
        heading: 0,
        speed: 75 / 3.6,
      });
      const events = ride(state, 6, TUCK);
      expect(
        events.some((e) => e.kind === "land" && e.airTime > 0.6),
        spec.id,
      ).toBe(true);
      expect(state.skier.body.injuries, spec.id).toEqual([]);
      // ...and the landing is billed on the meter — but ridden out, so the
      // HUD shows no g for it.
      expect(state.skier.body.peak, spec.id).toBeGreaterThan(I.landingShown);
      expect(state.skier.body.impact?.fall, spec.id).toBe(false);
      expect(state.skier.body.fallPeak, spec.id).toBe(0);
    }
  });

  it("the same drop is a softer landing in powder than on the groomer", () => {
    const drop = (packed: number) => {
      const state = staged(flatLevel({ packed }), {
        x: 1500,
        z: 200,
        heading: 0,
        speed: 20,
        height: 12,
      });
      ride(state, 3);
      return state.skier.body;
    };
    const hard = drop(1);
    const soft = drop(0);
    expect(hard.peak).toBeGreaterThan(soft.peak * 1.5);
    expect(severityOf(hard)).toBeGreaterThanOrEqual(severityOf(soft));
  });

  it("a trunk at speed is a blow of a hundred g and more, and hurts him", () => {
    const state = staged(syntheticLevel(), {
      x: LONE_TREE.x,
      z: LONE_TREE.z - 20,
      heading: 0,
      speed: 60 / 3.6,
    });
    const events = ride(state, 4);
    const body = state.skier.body;
    expect(events.some((e) => e.kind === "wipeout")).toBe(true);
    expect(body.peak).toBeGreaterThan(100);
    // He went down on it, so it is a fall's blow: the HUD's to show.
    expect(body.fallPeak).toBe(body.peak);
    expect(body.impact?.fall).toBe(true);
    expect(body.injuries.length).toBeGreaterThan(0);
    expect(severityOf(body)).toBeGreaterThanOrEqual(9);
    // Every injury taken was reported as it was taken.
    expect(events.filter((e) => e.kind === "injury")).toHaveLength(body.injuries.length);
    // No step's blows did more than `perBlow` new injuries.
    const byStep = new Map<number, number>();
    for (const h of body.injuries) byStep.set(h.t, (byStep.get(h.t) ?? 0) + 1);
    for (const n of byStep.values()) expect(n).toBeLessThanOrEqual(I.perBlow);
  });

  it("replays injury for injury, and draws nothing from the run's stream", () => {
    const run = () => {
      const state = staged(syntheticLevel(), {
        x: LONE_TREE.x,
        z: LONE_TREE.z - 20,
        heading: 0,
        speed: 55 / 3.6,
      });
      ride(state, 4);
      return state;
    };
    const a = run();
    const b = run();
    expect(a.skier.body).toEqual(b.skier.body);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it("a reset does not mend him", () => {
    const state = staged(syntheticLevel(), {
      x: LONE_TREE.x,
      z: LONE_TREE.z - 20,
      heading: 0,
      speed: 60 / 3.6,
    });
    ride(state, 8);
    const taken = state.skier.body.injuries.length;
    expect(taken).toBeGreaterThan(0);
    ride(state, 0.1, { ...NEUTRAL_INPUT, reset: true });
    expect(state.skier.body.injuries.length).toBe(taken);
  });
});

describe("the injury severity score", () => {
  it("is the squares of the worst rank in each of the three worst-hurt regions", () => {
    const body = freshBody();
    expect(severityOf(body)).toBe(0);
    const set = (part: (typeof BODY_PARTS)[number], ais: number) => {
      body.worst[BODY_PARTS.indexOf(part)] = ais;
    };
    set("head", 3);
    set("neck", 1);
    set("chest", 2);
    set("kneeL", 2);
    set("handR", 1);
    set("abdomen", 1);
    // Head 3, chest 2, limbs 2: 9 + 4 + 4.
    expect(severityOf(body)).toBe(17);
  });
});
