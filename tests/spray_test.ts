// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY (`spray-sim.ts`): the snow a turn throws is cut by an edge
// SLIDING across its own line — so a hockey stop throws a wall of it ahead
// of him and a run down the fall line throws none — and it comes off a
// board's one long edge as it does off a pair's two.

import { describe, expect, it } from "vitest";

import { createGame, pairById, placeRun, step, TUNING, type GameState } from "@engine";

import { holdInput, type HoldMove } from "../pwa/src/game/hold-input.ts";
import { SNOW } from "../pwa/src/game/snowpack.ts";
import { createSprayPool, edgeSlips, emptySlip } from "../pwa/src/game/spray-sim.ts";
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
