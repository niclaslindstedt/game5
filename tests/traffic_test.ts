// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S TRAFFIC (`engine/game/traffic.ts`, `traffic-plan.ts`,
// `traffic-route.ts`, `traffic-contact.ts`): the cars, the ski bus and the
// bicycles on the village's streets and the cars parked in its bays — a
// pure function of the map and the clock, the same every time; on the
// carriageway, never two in one place, at a village's speeds; the bus
// standing at its stop; and, on a free ride alone, met by the skier.

import { describe, expect, it } from "vitest";

import {
  DRIVES,
  NEUTRAL_INPUT,
  TRAFFIC,
  VEHICLES,
  createGame,
  freshVehiclePose,
  onCarriageway,
  placeRun,
  step,
  trafficOf,
  vehicleAt,
  villageOf,
  type GameEvent,
  type GameState,
  type Level,
  type TrafficPlan,
  type VehiclePose,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);

function planOf(l: Level): TrafficPlan {
  const plan = trafficOf(l);
  expect(plan, "the map's village has traffic").not.toBeNull();
  return plan!;
}

type Box = { x: number; z: number; fx: number; fz: number; hl: number; hw: number };

function boxOf(kind: keyof typeof VEHICLES, x: number, z: number, heading: number): Box {
  const V = VEHICLES[kind];
  return { x, z, fx: Math.sin(heading), fz: Math.cos(heading), hl: V.length / 2, hw: V.width / 2 };
}

/** Whether two boxes overlap, by the separating axes of both. */
function overlap(a: Box, b: Box): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const [ax, az] of [
    [a.fx, a.fz],
    [a.fz, -a.fx],
    [b.fx, b.fz],
    [b.fz, -b.fx],
  ]) {
    const ra = a.hl * Math.abs(a.fx * ax + a.fz * az) + a.hw * Math.abs(a.fz * ax - a.fx * az);
    const rb = b.hl * Math.abs(b.fx * ax + b.fz * az) + b.hw * Math.abs(b.fz * ax - b.fx * az);
    if (Math.abs(dx * ax + dz * az) > ra + rb) return false;
  }
  return true;
}

/** Every vehicle at `t`. */
function posesAt(plan: TrafficPlan, t: number, out: VehiclePose[]): VehiclePose[] {
  for (let k = 0; k < plan.vehicles.length; k++) vehicleAt(plan, k, t, out[k]);
  return out;
}

function run(s: GameState, seconds: number): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, NEUTRAL_INPUT);
    out.push(...s.events);
  }
  return out;
}

describe("the village's traffic", () => {
  it("is the same every time it is asked, and where it was a period ago", () => {
    const plan = planOf(level);
    const a = freshVehiclePose();
    const b = freshVehiclePose();
    for (let k = 0; k < plan.vehicles.length; k++) {
      for (const t of [0, 37.5, 211.25, 480]) {
        vehicleAt(plan, k, t, a);
        vehicleAt(plan, k, t + plan.period, b);
        expect(b.shown).toBe(a.shown);
        if (!a.shown) continue;
        expect(b.x).toBeCloseTo(a.x, 6);
        expect(b.z).toBeCloseTo(a.z, 6);
        expect(b.heading).toBeCloseTo(a.heading, 6);
      }
    }
  });

  it("carries cars, the bus and bicycles, and parks cars in the bays", () => {
    const plan = planOf(level);
    const kinds = new Set(plan.vehicles.map((v) => v.kind));
    expect(kinds.has("bus")).toBe(true);
    expect(kinds.has("bike")).toBe(true);
    expect(
      plan.vehicles.filter((v) => v.kind !== "bus" && v.kind !== "bike").length,
    ).toBeGreaterThanOrEqual(TRAFFIC.loop.least * 2);
    expect(plan.parked.length).toBeGreaterThan(10);
    const bays = new Map(villageOf(level)!.bays.map((b) => [b.id, b]));
    const seen = new Set<string>();
    for (const p of plan.parked) {
      const bay = bays.get(p.bay);
      expect(bay, `${p.bay} is a bay`).toBeDefined();
      expect(seen.has(p.bay), `${p.bay} holds one car`).toBe(false);
      seen.add(p.bay);
      expect(Math.hypot(p.x - bay!.x, p.z - bay!.z)).toBeLessThan(0.05);
      expect(VEHICLES[p.kind].length).toBeLessThanOrEqual(bay!.length + 0.01);
      expect(VEHICLES[p.kind].width).toBeLessThanOrEqual(bay!.width);
    }
  });

  it("keeps to the carriageway, never two in one place nor one in a parked car", () => {
    const plan = planOf(level);
    const poses = plan.vehicles.map(() => freshVehiclePose());
    let shown = 0;
    let off = 0;
    for (let t = 0; t < plan.period; t += 0.5) {
      posesAt(plan, t, poses);
      for (let a = 0; a < poses.length; a++) {
        const p = poses[a];
        if (!p.shown) continue;
        shown++;
        if (!onCarriageway(level, p.x, p.z)) off++;
        const A = boxOf(p.kind, p.x, p.z, p.heading);
        for (let b = a + 1; b < poses.length; b++) {
          const q = poses[b];
          if (!q.shown) continue;
          expect(overlap(A, boxOf(q.kind, q.x, q.z, q.heading)), `${a} and ${b} at ${t}`).toBe(
            false,
          );
        }
        for (const c of plan.parked) {
          if (Math.abs(c.x - p.x) > 16 || Math.abs(c.z - p.z) > 16) continue;
          expect(
            overlap(A, boxOf(c.kind, c.x, c.z, c.heading)),
            `${a} and parked ${c.id} at ${t}`,
          ).toBe(false);
        }
      }
    }
    expect(shown).toBeGreaterThan(1000);
    // The road out runs past the village's mask to the map's edge.
    expect(off / shown).toBeLessThan(0.15);
  });

  it("drives at a village's speeds, and a bicycle at a winter cyclist's", () => {
    const plan = planOf(level);
    const p = freshVehiclePose();
    for (let k = 0; k < plan.vehicles.length; k++) {
      const kind = plan.vehicles[k].kind;
      const D = kind === "bus" ? DRIVES.bus : kind === "bike" ? DRIVES.bike : DRIVES.car;
      let most = 0;
      let last: VehiclePose | null = null;
      for (let t = 0; t < plan.period; t += 0.5) {
        vehicleAt(plan, k, t, p);
        if (!p.shown) {
          last = null;
          continue;
        }
        most = Math.max(most, Math.abs(p.speed));
        // It moves as fast as it says it does (and no faster).
        if (last) expect(Math.hypot(p.x - last.x, p.z - last.z)).toBeLessThan(0.5 * D.road + 1.5);
        last = { ...p };
      }
      expect(most, `${kind} ${k}`).toBeLessThanOrEqual(D.road + 0.05);
      expect(most, `${kind} ${k}`).toBeGreaterThan(kind === "bike" ? 2 : 4);
    }
  });

  it("stands the bus at its stop", () => {
    const plan = planOf(level);
    const v = villageOf(level)!;
    const k = plan.vehicles.findIndex((x) => x.kind === "bus");
    const p = freshVehiclePose();
    let still = 0;
    let atStop = 0;
    for (let t = 0; t < plan.period; t += 0.5) {
      vehicleAt(plan, k, t, p);
      if (!p.shown || Math.abs(p.speed) > 0.05) continue;
      still += 0.5;
      if (Math.hypot(p.x - v.bus!.x, p.z - v.bus!.z) < 12) atStop += 0.5;
    }
    expect(atStop).toBeGreaterThanOrEqual(TRAFFIC.bus.stay.least);
    expect(atStop / still).toBeGreaterThan(0.8);
  });
});

describe("met by the skier", () => {
  /** The skier stood in the way of the first car on the loop, `ahead` s
   * before it comes. */
  function inTheWay(mode: "free" | "timeTrial"): GameState {
    const s = createGame({ level, mode, crowd: 0, quiet: true });
    const plan = planOf(level);
    const k = plan.vehicles.findIndex((x) => x.role === "loop");
    const p = freshVehiclePose();
    // A moment the car is going at the street's pace.
    let t = s.t + 1;
    for (; t < s.t + plan.period; t += 0.5) {
      vehicleAt(plan, k, t, p);
      if (p.shown && p.speed > 5) break;
    }
    // Wait for it there, the run's clock wound on to just before.
    s.t = t - 1;
    placeRun(s, { x: p.x, z: p.z, heading: p.heading, speed: 0 });
    return s;
  }

  it("knocks him down on a free ride: the `car` cause", () => {
    const s = inTheWay("free");
    const events = run(s, 2);
    expect(events.some((e) => e.kind === "traffic" && e.phase === "strike")).toBe(true);
    expect(s.skier.thrown?.cause).toBe("car");
  });

  it("is not there on any other run", () => {
    const s = inTheWay("timeTrial");
    const events = run(s, 2);
    expect(events.some((e) => e.kind === "traffic")).toBe(false);
    expect(s.skier.thrown?.cause).not.toBe("car");
  });

  it("holds him off a parked car he shuffles into", () => {
    const s = createGame({ level, mode: "free", crowd: 0, quiet: true });
    const c = planOf(level).parked[0];
    const V = VEHICLES[c.kind];
    const off = V.width / 2 + 0.6;
    // Beside it, shuffling in square to its side.
    const rx = Math.cos(c.heading);
    const rz = -Math.sin(c.heading);
    placeRun(s, {
      x: c.x + rx * off,
      z: c.z + rz * off,
      heading: c.heading - Math.PI / 2,
      speed: 1,
    });
    const events = run(s, 1);
    expect(events.some((e) => e.kind === "traffic")).toBe(false);
    expect(s.skier.thrown).toBeNull();
    const dx = s.skier.x - c.x;
    const dz = s.skier.z - c.z;
    expect(Math.abs(dx * rx + dz * rz)).toBeGreaterThan(V.width / 2);
  });
});
