// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TREE WELLS (`engine/game/tree-well.ts`): the hollow round a trunk in deep
// powder — none at the ordinary snow, deeper on the downhill side, none on
// the groomer — and a skier who slides into one is held in it, while one who
// skis past at speed rides through.

import { describe, expect, it } from "vitest";
import {
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  step,
  TUNING,
  wellAt,
  withWells,
  wellShareOf,
  type GameState,
} from "@engine";
import { LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

const level = syntheticLevel();
const game = (snowDepth: number): GameState =>
  createGame({ level, rivals: 0, countdown: 0, snowDepth, quiet: true });

describe("the wells laid", () => {
  it("lays none at the ordinary snow: the map is the map itself", () => {
    expect(wellShareOf(1)).toBe(0);
    expect(game(1).level).toBe(level);
    expect(withWells(level, 0)).toBe(level);
  });

  it("lays them in deep powder, once per map and dial", () => {
    const s = game(2.5);
    expect(s.level).not.toBe(level);
    expect(s.level.wells?.list.length).toBeGreaterThan(0);
    expect(game(2.5).level).toBe(s.level);
  });

  it("is deepest at the trunk and gone past the reach", () => {
    const deep = game(2.5).level;
    const w = deep.wells!.list.find(
      (v) => Math.hypot(v.x - LONE_TREE.x, v.z - LONE_TREE.z) < 0.01,
    )!;
    expect(w).toBeDefined();
    const near = wellAt(deep, w.x + (w.trunk + 0.1) * w.fz, w.z - (w.trunk + 0.1) * w.fx);
    const out = wellAt(deep, w.x + w.reach * 2 * w.fz, w.z - w.reach * 2 * w.fx);
    expect(near).toBeGreaterThan(0.5);
    expect(out).toBe(0);
    // The surface itself is lowered there, for everything that reads it.
    const x = w.x + (w.trunk + 0.1) * w.fz;
    const z = w.z - (w.trunk + 0.1) * w.fx;
    expect(level.groundAt(x, z) - deep.groundAt(x, z)).toBeCloseTo(near, 5);
  });

  it("opens further on the downhill side than the uphill", () => {
    const deep = game(2.5).level;
    const w = deep.wells!.list.find(
      (v) => Math.hypot(v.x - LONE_TREE.x, v.z - LONE_TREE.z) < 0.01,
    )!;
    const d = w.trunk + (w.reach - w.trunk) * 0.7;
    const down = wellAt(deep, w.x + w.fx * d, w.z + w.fz * d);
    const up = wellAt(deep, w.x - w.fx * d, w.z - w.fz * d);
    expect(w.lean).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(up);
  });

  it("lays none on packed snow", () => {
    const deep = game(2.5).level;
    for (const w of deep.wells!.list) expect(level.packedAt(w.x, w.z)).toBeLessThan(0.5);
  });
});

describe("a skier and a well", () => {
  const ride = (dz: number, dx: number, speed: number, heading: number) => {
    const s = game(2.5);
    placeRun(s, { x: LONE_TREE.x + dx, z: LONE_TREE.z + dz, heading, speed });
    let well = 0;
    let stuck = false;
    for (let i = 0; i < 10 * TUNING.physicsHz; i++) {
      step(s, NEUTRAL_INPUT);
      well = Math.max(well, s.skier.well);
      for (const e of s.events) if (e.kind === "stuck" && e.well) stuck = true;
    }
    return { s, well, stuck };
  };

  it("slides one stood above it in, and holds him there", () => {
    const { s, well, stuck } = ride(-3, 0, 0, 0);
    expect(well).toBeGreaterThan(0.3);
    expect(stuck).toBe(true);
    expect(s.skier.trench).toBeGreaterThan(0.3);
  });

  it("lets one skiing past at speed ride through", () => {
    const { stuck, s } = ride(1.5, -6, 5, 1.4);
    expect(stuck).toBe(false);
    expect(s.skier.trench).toBe(0);
  });
});
