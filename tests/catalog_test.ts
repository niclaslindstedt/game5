// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CATALOG: six pairs of skis, each an answer to a kind of snow and none
// a point on one scale. Every pair is held to its own documented expectation
// (`topSpeed`) down the reference pitch; then each is held to what its row
// CLAIMS — the downhill ski flat out fastest, the slalom ski quickest onto
// an edge, the giant slalom ski holding the groomer hardest, the powder ski
// floating, the park ski taking the landing the others fold on — and the
// reference pair's footprint to being exactly the one every shared number
// was tuned on. Staged on the synthetic drag strips with `placeRun`.

import { describe, expect, it } from "vitest";

import {
  CHOUGH,
  EAGLE,
  HARE,
  MARMOT,
  NEUTRAL_INPUT,
  SKIS,
  SKI_CATALOG,
  SWIFT,
  cornerGrip,
  createGame,
  footprintOf,
  harshSpeedOf,
  isSkiId,
  placeRun,
  skisById,
  step,
  terminalSpeed,
  tipLimit,
  TOP_SPEED_PITCH,
  TUNING,
  type GameState,
  type Level,
  type SkiSpec,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const SCHUSS = flatLevel({
  packed: 1,
  grade: Math.tan(TOP_SPEED_PITCH),
  slopeFrom: 200,
  size: 4000,
});
const DEEP_SCHUSS = flatLevel({
  packed: 0,
  grade: Math.tan(TOP_SPEED_PITCH),
  slopeFrom: 200,
  size: 4000,
});
const POWDER = flatLevel({ packed: 0 });
const TUCK = { ...NEUTRAL_INPUT, tuck: 1 };

function stage(spec: SkiSpec, level: Level, speed = 0, z = 150): GameState {
  const state = createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: level.size / 2, z, heading: 0, speed });
  return state;
}

/** Seconds from a push-off to `kmh` in a tuck down the pitch, or Infinity. */
function timeTo(spec: SkiSpec, level: Level, kmh: number, limit = 40): number {
  const state = stage(spec, level, 2, 210);
  const steps = Math.round(limit * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, TUCK);
    if (state.skier.speed * 3.6 >= kmh) return (i + 1) * TUNING.dt;
  }
  return Infinity;
}

function topOn(spec: SkiSpec, level: Level): number {
  const state = stage(spec, level, 2, 210);
  for (let i = 0; i < 30 * TUNING.physicsHz; i++) step(state, TUCK);
  return state.skier.speed * 3.6;
}

/** The rest sink of the boot's station after settling, m. */
function restSink(spec: SkiSpec): number {
  const state = stage(spec, POWDER);
  for (let i = 0; i < 3 * TUNING.physicsHz; i++) step(state, NEUTRAL_INPUT);
  const mid = state.skier.contacts.findIndex((k) => k.station === "mid");
  return state.skier.sinks[mid];
}

describe("the catalog", () => {
  it("is six pairs with their own ids, the chamois the default", () => {
    expect(SKI_CATALOG.map((s) => s.id)).toEqual([
      "chamois",
      "swift",
      "chough",
      "eagle",
      "marmot",
      "hare",
    ]);
    expect(SKIS.id).toBe("chamois");
    for (const s of SKI_CATALOG) {
      expect(skisById(s.id)).toBe(s);
      expect(isSkiId(s.id)).toBe(true);
      expect(s.blurb.length).toBeGreaterThan(20);
      expect(s.kind.length).toBeGreaterThan(3);
    }
    expect(skisById("snowboard")).toBe(SKIS);
    expect(isSkiId("snowboard")).toBe(false);
  });

  it("keeps every pair inside the real bands it claims", () => {
    for (const s of SKI_CATALOG) {
      // Adult skis 1.55–2.20 m; waists 63–125 mm; sidecuts 11–50 m.
      expect(s.length).toBeGreaterThanOrEqual(1.55);
      expect(s.length).toBeLessThanOrEqual(2.2);
      expect(s.waist).toBeGreaterThanOrEqual(0.063);
      expect(s.waist).toBeLessThanOrEqual(0.125);
      expect(s.tipWidth).toBeGreaterThan(s.waist);
      expect(s.tailWidth).toBeGreaterThan(s.waist);
      expect(s.sidecut).toBeGreaterThanOrEqual(11);
      expect(s.sidecut).toBeLessThanOrEqual(50);
      expect(s.flex).toBeGreaterThanOrEqual(0);
      expect(s.flex).toBeLessThanOrEqual(1);
      expect(s.rocker).toBeGreaterThanOrEqual(0);
      expect(s.rocker).toBeLessThanOrEqual(1);
      // A racer's tuck is 0.25–0.35 m² of drag area, a recreational skier's
      // half-tuck 0.45–0.6; standing tall 0.6–0.9.
      expect(s.cdATuck).toBeGreaterThanOrEqual(0.2);
      expect(s.cdATuck).toBeLessThanOrEqual(0.6);
      expect(s.cdAUpright).toBeGreaterThanOrEqual(0.6);
      expect(s.cdAUpright).toBeLessThanOrEqual(0.9);
      expect(s.gearMass).toBeGreaterThanOrEqual(6);
      expect(s.gearMass).toBeLessThanOrEqual(11);
    }
  });

  it("builds the speed-event pairs to their discipline's competition rules", () => {
    // The men's top-level rules (docs/disciplines.md, "The skis"): giant
    // slalom at least 1.93 m and a 30 m sidecut, at most a 65 mm waist and
    // a 103 mm shoulder; downhill at least 2.18 m and 50 m, at most 65 mm
    // and 95 mm.
    const rules = [
      { ski: CHOUGH, length: 1.93, sidecut: 30, shoulder: 0.103 },
      { ski: EAGLE, length: 2.18, sidecut: 50, shoulder: 0.095 },
    ];
    for (const r of rules) {
      expect(r.ski.length, r.ski.id).toBeGreaterThanOrEqual(r.length);
      expect(r.ski.sidecut, r.ski.id).toBeGreaterThanOrEqual(r.sidecut);
      expect(r.ski.waist, r.ski.id).toBeLessThanOrEqual(0.065);
      expect(r.ski.tipWidth, r.ski.id).toBeLessThanOrEqual(r.shoulder);
    }
  });

  it("prices the reference pair's footprint at exactly one on every axis", () => {
    const fit = footprintOf(SKIS);
    expect(fit.sink).toBe(1);
    expect(fit.plane).toBe(1);
    expect(fit.edge).toBe(1);
    expect(fit.base).toBe(1);
    expect(fit.edgeRate).toBe(1);
    expect(fit.harsh).toBe(1);
    expect(fit.chatter).toBe(1);
    expect(harshSpeedOf(SKIS)).toBeCloseTo(TUNING.air.harshSpeed, 9);
  });
});

describe("every pair, down the reference pitch", () => {
  for (const spec of SKI_CATALOG) {
    it(`${spec.id} tops out within a tenth of its documented top speed`, () => {
      const kmh = topOn(spec, SCHUSS);
      expect(kmh).toBeGreaterThan(spec.topSpeed * 0.9);
      expect(kmh).toBeLessThan(spec.topSpeed * 1.1);
      expect(kmh).toBeLessThan(terminalSpeed(spec, TOP_SPEED_PITCH) * 3.6);
    });
  }
});

describe("six answers to a kind of snow", () => {
  it("the downhill ski is the quickest flat out; the powder and park skis the slowest", () => {
    const tops = new Map(SKI_CATALOG.map((s) => [s.id, topOn(s, SCHUSS)]));
    expect(Math.max(...tops.values())).toBe(tops.get("eagle"));
    expect(tops.get("marmot")!).toBeLessThan(tops.get("chamois")!);
    expect(tops.get("hare")!).toBeLessThan(tops.get("chamois")!);
  });

  it("the stiff race skis hold the groomer hardest in a bend, the powder ski least", () => {
    const grips = SKI_CATALOG.map((s) => cornerGrip(s, 1));
    expect(Math.max(...grips)).toBe(cornerGrip(EAGLE, 1));
    expect(cornerGrip(CHOUGH, 1)).toBeGreaterThan(cornerGrip(SKIS, 1));
    expect(Math.min(...grips)).toBe(cornerGrip(MARMOT, 1));
  });

  it("the slalom ski is the quickest onto an edge, the downhill ski the slowest", () => {
    const rates = SKI_CATALOG.map((s) => footprintOf(s).edgeRate);
    expect(Math.max(...rates)).toBe(footprintOf(SWIFT).edgeRate);
    expect(Math.min(...rates)).toBe(footprintOf(EAGLE).edgeRate);
  });

  it("the wide powder ski sinks least and gets going quickest in powder; the narrow race skis sink most", () => {
    const sinks = SKI_CATALOG.map(restSink);
    expect(Math.min(...sinks)).toBe(restSink(MARMOT));
    expect(restSink(MARMOT)).toBeLessThan(TUNING.snow.powderSink * 0.85);
    const times = SKI_CATALOG.map((s) => timeTo(s, DEEP_SCHUSS, 50));
    expect(Math.min(...times)).toBe(timeTo(MARMOT, DEEP_SCHUSS, 50));
    for (const s of [SWIFT, CHOUGH, EAGLE]) {
      expect(footprintOf(s).sink).toBeGreaterThan(1);
    }
  });

  it("the soft park ski takes the hardest landing whole; the stiff downhill ski the least", () => {
    const harsh = SKI_CATALOG.map(harshSpeedOf);
    expect(Math.max(...harsh)).toBe(harshSpeedOf(HARE));
    expect(Math.min(...harsh)).toBe(harshSpeedOf(EAGLE));
  });

  it("a low tuck tips later than a tall stance", () => {
    for (const s of SKI_CATALOG) expect(tipLimit(s)).toBeGreaterThan(0.5);
  });
});
