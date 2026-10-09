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
  BONE_KINDS,
  BONES,
  INJURIES,
  NEUTRAL_INPUT,
  ORGANS,
  ORGAN_KINDS,
  RAGDOLL,
  SKI_CATALOG,
  TUNING,
  FRACTURE_GRADE,
  blowOf,
  bonesOf,
  energyOver,
  fractureEnergyOf,
  fracturesOf,
  createGame,
  organsOf,
  organsOfInjury,
  freshBody,
  placeRun,
  resetSkier,
  riskOf,
  saidOf,
  severityOf,
  snowGive,
  step,
  type GameEvent,
  type GameState,
  type InjuryDef,
  type InjuryKind,
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
    const g = blowOf(5.4, I.give.head + I.solid.trunk + I.helmet);
    expect(riskOf(g, INJURIES.concussion.at)).toBeGreaterThan(0.1);
    expect(riskOf(g, INJURIES.concussion.at)).toBeLessThan(0.5);
    expect(riskOf(g, INJURIES.skullFracture.at)).toBe(0);
    // ...and at 30 km/h a trunk can already fracture the skull of a skier
    // in a helmet.
    expect(
      riskOf(blowOf(30 / 3.6, I.give.head + I.solid.trunk + I.helmet), INJURIES.skullFracture.at),
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

describe("the bones", () => {
  it("every bone can be cracked and broken, on the side of the part that does it", () => {
    const reached = new Map<string, Set<string>>();
    for (const kind of Object.keys(INJURIES) as InjuryKind[]) {
      const def = INJURIES[kind] as InjuryDef;
      if (!def.bones) continue;
      expect(def.fracture, kind).toBeDefined();
      const parts = BODY_PARTS.filter((p) => p === def.part || p.replace(/[LR]$/, "") === def.part);
      for (const part of parts)
        for (const bone of bonesOf(kind, part)) {
          expect(BONES, `${kind} ${part}`).toContain(bone);
          // A paired part breaks its own side's bone.
          if (/[LR]$/.test(part) && /[LR]$/.test(bone)) expect(bone.at(-1)).toBe(part.at(-1));
          if (!reached.has(bone)) reached.set(bone, new Set());
          reached.get(bone)!.add(def.fracture!);
        }
    }
    for (const bone of BONES)
      expect([...(reached.get(bone) ?? [])].sort(), bone).toEqual(["break", "hairline"]);
    expect(BONES.length).toBeGreaterThan(BONE_KINDS.length);
  });

  it("a crack is under its break: a rank at most as high, and a dose below it", () => {
    for (const kind of Object.keys(INJURIES) as InjuryKind[]) {
      const crack = INJURIES[kind] as InjuryDef;
      if (crack.fracture !== "hairline") continue;
      const breaks = Object.values(INJURIES as Record<string, InjuryDef>).filter(
        (d) =>
          d.fracture === "break" &&
          d.part === crack.part &&
          d.mech === crack.mech &&
          d.bones!.some((b) => crack.bones!.includes(b)),
      );
      for (const d of breaks) {
        expect(crack.ais, kind).toBeLessThanOrEqual(d.ais);
        expect(crack.at, kind).toBeLessThan(d.at);
      }
    }
  });

  it("each bone shows its worst; a fracture is never said, the cord is", () => {
    const body = freshBody();
    body.injuries.push({ part: "thighL", kind: "crackedFemur", ais: 2, t: 0 });
    body.injuries.push({ part: "thighL", kind: "brokenFemur", ais: 3, t: 1 });
    body.injuries.push({ part: "shinR", kind: "crackedShin", ais: 1, t: 2 });
    const f = fracturesOf(body);
    expect(f[BONES.indexOf("femurL")]).toBe(2);
    expect(f[BONES.indexOf("femurR")]).toBe(0);
    expect(f[BONES.indexOf("tibiaR")]).toBe(1);
    expect(f.filter((g) => g > 0)).toHaveLength(2);
    expect(saidOf("brokenFemur")).toBe(false);
    expect(saidOf("tornAcl")).toBe(true);
    expect(saidOf("spinalCord")).toBe(true);
  });
});

describe("the organs", () => {
  it("every organ can be hurt, and every organ an injury names is one of them", () => {
    const named = new Set<string>();
    for (const def of Object.values(INJURIES) as InjuryDef[])
      for (const o of def.organs ?? []) {
        expect(ORGAN_KINDS).toContain(o);
        named.add(o);
      }
    expect([...named].sort()).toEqual([...ORGAN_KINDS].sort());
  });

  it("each organ shows its worst; a paired one on its side; organ injuries are said", () => {
    const body = freshBody();
    body.injuries.push({ part: "abdomen", kind: "bruisedKidney", ais: 2, t: 0, side: "R" });
    body.injuries.push({ part: "abdomen", kind: "tornKidney", ais: 3, t: 1, side: "R" });
    body.injuries.push({ part: "chest", kind: "collapsedLung", ais: 3, t: 2, side: "L" });
    body.injuries.push({ part: "abdomen", kind: "lacerated", ais: 4, t: 3 });
    const o = organsOf(body);
    expect(o[ORGANS.indexOf("kidneyR")]).toBe(3);
    expect(o[ORGANS.indexOf("kidneyL")]).toBe(0);
    expect(o[ORGANS.indexOf("lungL")]).toBe(3);
    expect(o[ORGANS.indexOf("lungR")]).toBe(0);
    expect(o[ORGANS.indexOf("stomach")]).toBe(4);
    expect(o[ORGANS.indexOf("bowel")]).toBe(4);
    expect(o[ORGANS.indexOf("brain")]).toBe(0);
    expect(organsOfInjury(body.injuries[0])).toEqual(["kidneyR"]);
    expect(saidOf("tornKidney")).toBe(true);
  });
});

describe("how a break breaks", () => {
  it("a blow's energy goes as its g, a twist's or a bend's as its speed squared", () => {
    expect(energyOver("blunt", 90, 60)).toBeCloseTo(1.5);
    expect(energyOver("load", 30, 15)).toBeCloseTo(2);
    expect(energyOver("bend", 30, 20)).toBeCloseTo(2.25);
    expect(energyOver("twist", 11, 11)).toBeCloseTo(1);
  });

  it("grades a break simple, wedge or shattered by the energy that did it", () => {
    const C = I.comminute;
    expect(C.wedge).toBeGreaterThan(1);
    // The pendulum study: comminuted at 2.3 times the energy of a simple break.
    expect(C.shatter).toBeCloseTo(2.3);
    const graded = (energy: number | undefined, kind: InjuryKind = "brokenFemur") => {
      const body = freshBody();
      body.injuries.push({ part: "thighL", kind, ais: INJURIES[kind].ais, t: 0, energy });
      const i = BONES.indexOf("femurL");
      return [fracturesOf(body)[i], fractureEnergyOf(body)[i]];
    };
    expect(graded(undefined)).toEqual([FRACTURE_GRADE.simple, 1]);
    expect(graded(C.wedge - 0.01)[0]).toBe(FRACTURE_GRADE.simple);
    expect(graded(C.wedge)[0]).toBe(FRACTURE_GRADE.wedge);
    expect(graded(C.shatter)).toEqual([FRACTURE_GRADE.shatter, C.shatter]);
    // A crack stays a crack however hard it was struck.
    expect(graded(5, "crackedFemur")[0]).toBe(FRACTURE_GRADE.hairline);
  });

  it("a trunk met faster breaks his bones worse", () => {
    const worst = (kmh: number) => {
      const state = staged(syntheticLevel(), {
        x: LONE_TREE.x + 0.4,
        z: LONE_TREE.z - 40,
        heading: 0,
        speed: kmh / 3.6,
      });
      // Read every step, since the reset that stands him up mends him.
      let grade = 0;
      let energy = 0;
      for (let i = 0; i < 6 * TUNING.physicsHz; i++) {
        step(state, TUCK);
        for (const h of state.skier.body.injuries) {
          if ((INJURIES[h.kind] as InjuryDef).fracture) expect(h.energy, h.kind).toBeGreaterThan(0);
        }
        grade = Math.max(grade, ...fracturesOf(state.skier.body));
        energy = Math.max(energy, ...fractureEnergyOf(state.skier.body));
      }
      return { grade, energy };
    };
    const slow = worst(40);
    const fast = worst(110);
    expect(fast.energy).toBeGreaterThan(slow.energy);
    expect(fast.grade).toBe(FRACTURE_GRADE.shatter);
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

  it("a fall from a height landed on the feet breaks the legs from the heel up", () => {
    const fall = (height: number) => {
      const state = staged(flatLevel({ packed: 1 }), {
        x: 1500,
        z: 200,
        heading: 0,
        speed: 3,
        height,
      });
      const events = ride(state, 4);
      const land = events.find((e) => e.kind === "land");
      const legs = state.skier.body.injuries.filter(
        (h) => INJURIES[h.kind].mech === "load" && h.part !== "back",
      );
      return { g: land?.kind === "land" ? land.g : 0, legs: legs.map((h) => h.kind) };
    };
    // A couple of metres is a landing the legs take.
    expect(fall(2).legs).toEqual([]);
    // Tens of metres onto the groomer is the whole leg, heel to hip, both
    // sides at once — not a blow's few.
    const big = fall(40);
    expect(big.g).toBeGreaterThan(80);
    for (const kind of ["brokenHeel", "pilonFracture", "plateauFracture", "femurDriven"])
      expect(big.legs.filter((k) => k === kind)).toHaveLength(2);
    expect(big.legs).toContain("brokenHipSocket");
    // And the organs are stopped as hard as the skeleton: the lungs bruised,
    // the liver or the spleen torn on what holds them.
    expect(big.legs).toContain("bruisedLungFall");
    expect(big.legs.some((k) => k === "tornLiverFall" || k === "tornSpleenFall")).toBe(true);
  });

  it("a fall the legs cannot stop hurts the trunk when it meets the snow, not at the skis' touch", () => {
    // Off 120 m onto the flat: the skis land at nearly 50 m/s.
    const state = staged(flatLevel({ packed: 1 }), {
      x: 1500,
      z: 200,
      heading: 0,
      speed: 3,
      height: 120,
    });
    const TRUNK = new Set(["back", "chest", "abdomen", "neck"]);
    let landed = -1;
    let trunkAt = -1;
    let lowest = Infinity;
    for (let i = 0; i < 8 * TUNING.physicsHz && trunkAt < 0; i++) {
      step(state, NEUTRAL_INPUT);
      if (landed < 0 && state.events.some((e) => e.kind === "land")) {
        landed = state.tick;
        // The legs break where the skis meet the snow...
        const now = state.events.filter((e) => e.kind === "injury").map((e) => e.part);
        expect(now).toContain("footL");
        expect(now.filter((p) => TRUNK.has(p))).toEqual([]);
        // ...and the body comes on down into it, never back up off it.
        expect(state.skier.thrown!.vy).toBeLessThan(-20);
      }
      if (landed < 0) continue;
      const hurt = state.events.some((e) => e.kind === "injury" && TRUNK.has(e.part));
      if (!hurt) continue;
      trunkAt = state.tick;
      const P = state.skier.thrown!.points;
      for (const i of [
        RAGDOLL.hipL,
        RAGDOLL.hipR,
        RAGDOLL.shoulderL,
        RAGDOLL.shoulderR,
        RAGDOLL.head,
      ])
        lowest = Math.min(lowest, P[3 * i + 1] - state.level.groundAt(P[3 * i], P[3 * i + 2]));
    }
    // The spine and the organs go a few steps on, with the trunk in the snow.
    expect(trunkAt).toBeGreaterThan(landed);
    expect((trunkAt - landed) * TUNING.dt).toBeLessThanOrEqual(I.owedMost + TUNING.dt);
    expect(lowest).toBeLessThan(0.3);
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

  it("a reset mends him, keeping the run's hardest blow", () => {
    const state = staged(syntheticLevel(), {
      x: LONE_TREE.x,
      z: LONE_TREE.z - 20,
      heading: 0,
      speed: 60 / 3.6,
    });
    // Ski into the trunk until it has hurt him, then ask for the reset.
    for (let i = 0; i < 8 * 120 && state.skier.body.injuries.length === 0; i++)
      ride(state, 1 / 120);
    expect(state.skier.body.injuries.length).toBeGreaterThan(0);
    const peak = state.skier.body.peak;
    resetSkier(state, [], false);
    expect(state.skier.body.injuries).toEqual([]);
    expect(state.skier.body.worst.every((w) => w === 0)).toBe(true);
    expect(state.skier.body.peak).toBe(peak);
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
