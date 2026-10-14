// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY WEIGHED (`spray-mass.ts`): the edge's cut off the snow's
// hardness, the grains' fall speeds, and what a stop throws off each kind
// of snow — the order the research puts them in, and the mass a lower SPRAY
// row draws as fewer, heavier parcels rather than less snow.

import { describe, expect, it } from "vitest";

import { createGame, pairById, placeRun, step, TUNING } from "@engine";

import { holdInput } from "../pwa/src/game/hold-input.ts";
import { SNOW, type SnowKind } from "../pwa/src/game/snowpack.ts";
import { edgeDepth, hardnessOf, settleSpeed } from "../pwa/src/game/spray-mass.ts";
import { createMassPool } from "../pwa/src/game/spray-mass-pool.ts";
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

describe("which way the snow goes", () => {
  it("a stop shoves its snow FORWARD, from under the skis, low, and down the slope", () => {
    // A hockey stop straight down a 30 % slope (downhill is +z).
    const level = flatLevel({ packed: 1, grade: 0.3, slopeFrom: 0 });
    const state = createGame({
      level,
      spec: pairById("chamois"),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 40 / 3.6 });
    let ahead = 0;
    let outrun = 0;
    let n = 0;
    let under = 0;
    const rises: number[] = [];
    let downhill = 0;
    let landed = 0;
    const from = new Float32Array(30000);
    const pool = createMassPool(30000, {
      spawn(i) {
        const vx = pool.vel[i * 3];
        const vy = pool.vel[i * 3 + 1];
        const vz = pool.vel[i * 3 + 2];
        const flat = Math.hypot(vx, vz);
        if (flat < 0.5) return;
        n++;
        // Off the travel (+z), along the snow.
        if (Math.acos(vz / flat) < Math.PI / 4) ahead++;
        // Pressed on ahead of the skis: faster down his way than he goes.
        if (vz > state.skier.vz) outrun++;
        rises.push(Math.atan2(vy, flat));
        const x = pool.pos[i * 3];
        const z = pool.pos[i * 3 + 2];
        from[i] = z;
        if (pool.pos[i * 3 + 1] - level.groundAt(x, z) < 0.05) under++;
      },
      retire(i) {
        // Where it ended up against where it left.
        landed++;
        if (pool.pos[i * 3 + 2] > from[i]) downhill++;
      },
    });
    const t0 = state.t;
    for (let i = 0; i < 2.4 * TUNING.physicsHz; i++) {
      step(state, holdInput(state, 40, 0, "stop", state.t - t0));
      if (i % 2) continue;
      pool.emit(state.skier, level, 1 / 60, 0, SNOW.groomed);
      pool.step(1 / 60, level);
    }
    expect(n).toBeGreaterThan(500);
    // Nearly all of it leaves within 45° of the way he was going…
    expect(ahead / n).toBeGreaterThan(0.85);
    // …a good share of it faster than he goes, shoved on ahead of him…
    expect(outrun / n).toBeGreaterThan(0.35);
    // …from down at the snow under the base…
    expect(under / n).toBeGreaterThan(0.95);
    // …shallow: the median a cut chip's 10–30° off the snow.
    rises.sort((a, b) => a - b);
    const median = (rises[rises.length >> 1] * 180) / Math.PI;
    expect(median).toBeGreaterThan(10);
    expect(median).toBeLessThan(30);
    // And what comes down lies down the slope, never back up it.
    expect(downhill / Math.max(1, landed)).toBeGreaterThan(0.7);
  });
});
