// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY (`spray-sim.ts`): the snow a turn throws is cut by an edge
// SLIDING across its own line — so a hockey stop throws a wall of it ahead
// of him and a run down the fall line throws none — and it comes off a
// board's one long edge as it does off a pair's two — and it is the snow's
// own: new snow fine and light, old snow coarse, a crust in plates, wet
// snow heavy, more of it the deeper it lies.

import { describe, expect, it } from "vitest";

import { createGame, pairById, placeRun, step, TUNING, type GameState } from "@engine";

import { holdInput, type HoldMove } from "../pwa/src/game/hold-input.ts";
import { snowAgeOf, type SnowAgeKind } from "../pwa/src/game/snow-age.ts";
import { ageSnow, emptyAged, SNOW } from "../pwa/src/game/snowpack.ts";
import {
  createSprayPool,
  edgeSlips,
  emptySlip,
  type SprayPool,
} from "../pwa/src/game/spray-sim.ts";
import { flatLevel } from "./support/synthetic.ts";

/** Ride `move` from `kmh` for `seconds`, flying the spray at 60 frames a
 * second; what was thrown, the most the edges slid across and the throw's
 * share along the way he went. */
function ride(pair: string, move: HoldMove, kmh: number, seconds: number, share = 1) {
  const stop = move === "stop";
  const level = flatLevel(
    stop ? { packed: 1 } : { packed: 1, grade: Math.tan(0.17), slopeFrom: 200, size: 4000 },
  );
  const state: GameState = createGame({
    level,
    spec: pairById(pair),
    rivals: 0,
    countdown: 0,
    quiet: true,
  });
  placeRun(
    state,
    stop
      ? { x: 1500, z: 200, heading: 0, speed: kmh / 3.6 }
      : { x: 2000, z: 600, heading: 0, speed: kmh / 3.6 },
  );
  const pool = createSprayPool(20000);
  pool.setBudget(share);
  const slips = [emptySlip(), emptySlip()] as [
    ReturnType<typeof emptySlip>,
    ReturnType<typeof emptySlip>,
  ];
  let most = 0;
  let edges = 0;
  let ahead = 0;
  let weight = 0;
  const t0 = state.t;
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, holdInput(state, kmh, 0, move, state.t - t0));
    if (i % 2) continue;
    pool.emit(state.skier, level, 1 / 60, 0, SNOW.groomed);
    pool.step(1 / 60, level);
    const s = state.skier;
    edges = edgeSlips(s, slips);
    for (let k = 0; k < edges; k++) {
      const e = slips[k];
      most = Math.max(most, e.slide);
      if (e.share > 0 && e.slide > 1 && s.speed > 1) {
        ahead += e.share * ((e.across.x * s.vx + e.across.z * s.vz) / s.speed);
        weight += e.share;
      }
    }
  }
  return { thrown: pool.stats().thrown, most, edges, ahead: weight ? ahead / weight : 0 };
}

describe("the spray off a sliding edge", () => {
  it("a hockey stop slides its edges across at speed and throws its wall ahead of him", () => {
    const r = ride("chamois", "stop", 40, 1.5);
    expect(r.most).toBeGreaterThan(5);
    expect(r.ahead).toBeGreaterThan(0.6);
    expect(r.thrown).toBeGreaterThan(80);
  });

  it("a run straight down the fall line throws next to nothing; a stop throws far more than a carve", () => {
    const straight = ride("chamois", "straight", 40, 2);
    const carve = ride("chamois", "carve", 40, 2);
    const stop = ride("chamois", "stop", 40, 2);
    expect(straight.thrown).toBeLessThan(10);
    expect(stop.thrown).toBeGreaterThan(carve.thrown * 3);
  });

  it("a board is one long edge, and throws a stop's wall as a pair does", () => {
    const board = ride("lynx", "stop", 40, 1.5);
    const skis = ride("chamois", "stop", 40, 1.5);
    expect(board.edges).toBe(1);
    expect(skis.edges).toBe(2);
    expect(board.ahead).toBeGreaterThan(0.6);
    expect(board.thrown).toBeGreaterThan(skis.thrown * 0.5);
  });

  it("the SPRAY row's share thins what is thrown", () => {
    const whole = ride("chamois", "stop", 40, 1.5);
    const quarter = ride("chamois", "stop", 40, 1.5, 0.25);
    expect(quarter.thrown).toBeLessThan(whole.thrown * 0.4);
  });
});

describe("the spray by the snow's age and depth", () => {
  const LEVEL = flatLevel({ packed: 0 });
  const AGE_OF = (kind: SnowAgeKind) =>
    snowAgeOf({ seed: 1, sun: LEVEL.sun, weather: LEVEL.weather }, { force: kind });

  /** A stop from 40 km/h in loose snow of an age and a depth: the grains
   * thrown, the share of them clumps and fines, and the launch speed. */
  function stopIn(kind: SnowAgeKind | null, depth = 1) {
    const level = flatLevel({ packed: 0 });
    const state = createGame({
      level,
      spec: pairById("chamois"),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 40 / 3.6 });
    const snow = ageSnow(
      { ...SNOW.soft, loose: SNOW.soft.loose * depth },
      kind ? AGE_OF(kind) : null,
      emptyAged(),
    );
    let n = 0;
    let clumps = 0;
    let fines = 0;
    const pool: SprayPool = createSprayPool(20000, {
      spawn(i) {
        n++;
        if (pool.hard[i] > 0.5) clumps++;
        if (pool.term[i] < 1.2) fines++;
      },
    });
    const t0 = state.t;
    let launch = 0;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, holdInput(state, 40, 0, "stop", state.t - t0));
      if (i % 2) continue;
      pool.emit(state.skier, level, 1 / 60, 0, snow);
      pool.step(1 / 60, level);
      launch += pool.stats().launch;
    }
    return {
      n,
      clumps: clumps / n,
      fines: fines / n,
      launch: launch / n,
      cloud: snow.loose * snow.fine,
    };
  }

  it("new snow throws fine and light, wet snow heavy and short, with no cloud", () => {
    const fresh = stopIn("fresh");
    const wet = stopIn("wet");
    expect(fresh.fines).toBeGreaterThan(wet.fines + 0.2);
    expect(wet.clumps).toBeGreaterThan(fresh.clumps + 0.2);
    expect(wet.launch).toBeLessThan(fresh.launch * 0.75);
    expect(wet.cloud).toBeLessThan(fresh.cloud * 0.15);
  });

  it("old snow is coarser than new, and a crust breaks into plates with next to no fines", () => {
    const fresh = stopIn("fresh");
    const old = stopIn("old");
    const crust = stopIn("crust");
    expect(old.clumps).toBeGreaterThan(fresh.clumps);
    expect(old.fines).toBeLessThan(fresh.fines);
    expect(crust.fines).toBeLessThan(old.fines);
    expect(crust.clumps).toBeGreaterThan(old.clumps);
  });

  it("deeper snow throws more, and more cloud", () => {
    const thin = stopIn("fresh", 0.5);
    const deep = stopIn("fresh", 2);
    expect(deep.n).toBeGreaterThan(thin.n * 1.6);
    expect(deep.cloud).toBeGreaterThan(thin.cloud * 3);
  });

  it("the groomer keeps its own spray whatever the loose snow's age", () => {
    const groomed = ageSnow(SNOW.groomed, AGE_OF("wet"), emptyAged());
    expect(groomed.fine).toBeCloseTo(SNOW.groomed.fine, 5);
    expect(groomed.heavy).toBe(0);
    expect(groomed.plates).toBe(0);
  });
});
