// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY WEIGHED (`spray-mass.ts`): the edge's cut off the snow's
// hardness, the grains' fall speeds, and what a stop throws off each kind
// of snow — the order the research puts them in, and the mass a lower SPRAY
// row draws as fewer, heavier parcels rather than less snow.

import { describe, expect, it } from "vitest";

import { createGame, pairById, placeRun, step, TUNING } from "@engine";

import { holdInput } from "../pwa/src/game/hold-input.ts";
import { SNOW, type SnowKind } from "../pwa/src/game/snowpack.ts";
import { createMassPool, edgeDepth, hardnessOf, settleSpeed } from "../pwa/src/game/spray-mass.ts";
import { flatLevel } from "./support/synthetic.ts";

/** A stop from 40 km/h on `kind` snow: the kilograms thrown and the
 * parcels drawn, at a SPRAY row's `share`. */
function stopOn(kind: SnowKind, share = 1) {
  const packed = ["groomed", "hard", "ice"].includes(kind) ? 1 : 0;
  const level = flatLevel({ packed });
  const state = createGame({
    level,
    spec: pairById("chamois"),
    rivals: 0,
    countdown: 0,
    quiet: true,
  });
  placeRun(state, { x: 1500, z: 200, heading: 0, speed: 40 / 3.6 });
  const pool = createMassPool(30000);
  pool.setBudget(share);
  let kg = 0;
  let parcels = 0;
  const t0 = state.t;
  for (let i = 0; i < 2.4 * TUNING.physicsHz; i++) {
    step(state, holdInput(state, 40, 0, "stop", state.t - t0));
    if (i % 2) continue;
    pool.emit(state.skier, level, 1 / 60, 0, SNOW[kind]);
    pool.step(1 / 60, level);
    const w = pool.weighed();
    kg += w.cut + w.shove + w.lip + w.bow;
    parcels += pool.stats().thrown;
  }
  return { kg, parcels };
}

describe("the edge's cut", () => {
  it("a loaded edge sinks a few millimetres into a groomer, far less into ice, more into spring snow", () => {
    const piste = edgeDepth(1500, Math.PI / 4, 1.2, hardnessOf(SNOW.groomed));
    expect(piste).toBeGreaterThan(0.003);
    expect(piste).toBeLessThan(0.006);
    expect(edgeDepth(1500, Math.PI / 4, 1.2, hardnessOf(SNOW.ice))).toBeLessThan(piste / 5);
    expect(edgeDepth(1500, Math.PI / 4, 1.2, hardnessOf(SNOW.wet))).toBeGreaterThan(piste * 1.5);
  });

  it("grains fall at their size's speed: dust hangs, piste chips curtain down, clumps fly", () => {
    expect(settleSpeed(0.00016, 900)).toBeLessThan(0.6);
    const chip = settleSpeed(0.0005, 520);
    expect(chip).toBeGreaterThan(0.7);
    expect(chip).toBeLessThan(1.6);
    expect(settleSpeed(0.01, 400)).toBeGreaterThan(5);
  });
});

describe("what a stop throws", () => {
  it("a groomer's stop throws its tens of kilograms; ice next to nothing; powder the most", () => {
    const groomed = stopOn("groomed");
    const ice = stopOn("ice");
    const soft = stopOn("soft");
    expect(groomed.kg).toBeGreaterThan(8);
    expect(groomed.kg).toBeLessThan(30);
    expect(ice.kg).toBeLessThan(groomed.kg / 6);
    expect(soft.kg).toBeGreaterThan(groomed.kg);
  });

  it("a lower SPRAY row draws the same snow as fewer, heavier parcels", () => {
    const whole = stopOn("groomed", 1);
    const third = stopOn("groomed", 0.35);
    expect(third.parcels).toBeLessThan(whole.parcels * 0.6);
    expect(third.kg).toBeGreaterThan(whole.kg * 0.85);
    expect(third.kg).toBeLessThan(whole.kg * 1.15);
  });
});
