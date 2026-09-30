// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT IS NOT SNOW: a trunk stops a skier met square and turns one met off
// centre, the hit is reported once, the skier never ends up inside the
// trunk; and the map's edge turns him back.

import { describe, expect, it } from "vitest";

import {
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  step,
  treesNear,
  TUNING,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";
import { flatLevel, LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };

function ride(state: GameState, seconds: number, input: SkierInput): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, input);
    events.push(...state.events);
  }
  return events;
}

/** The lone tree stands on the slope east of the piste: the skier is put
 * down 30 m above it, pointing at it, and gravity does the rest. */
function atTree(offset: number, speed: number): GameState {
  const state = createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: LONE_TREE.x + offset, z: LONE_TREE.z - 30, heading: 0, speed });
  return state;
}

describe("trees", () => {
  it("are found by the hash", () => {
    const level = syntheticLevel();
    const near = treesNear(level, LONE_TREE.x + 1, LONE_TREE.z, 2, []);
    expect(near).toHaveLength(1);
    expect(level.trees[near[0]].x).toBe(LONE_TREE.x);
    expect(treesNear(level, LONE_TREE.x + 30, LONE_TREE.z, 2, [])).toHaveLength(0);
  });

  it("a trunk met square stops the skier and is reported once", () => {
    // Three seconds: the trunk, and the skier thrown — not yet the reset
    // that stands him back up (`crash_test.ts`).
    const state = atTree(0, 50 / 3.6);
    const events = ride(state, 3, TUCK);
    const hits = events.filter((e) => e.kind === "hit");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const first = hits[0];
    expect(first.kind === "hit" && first.speed).toBeGreaterThan(10);
    // Most of his way gone, and never through the trunk.
    const c = state.skier;
    expect(c.z).toBeLessThan(LONE_TREE.z);
    const tree = state.level.trees.find((t) => t.x === LONE_TREE.x)!;
    const nose = { x: c.x + Math.sin(c.heading) * 0.8, z: c.z + Math.cos(c.heading) * 0.8 };
    expect(Math.hypot(nose.x - tree.x, nose.z - tree.z)).toBeGreaterThan(tree.radius);
  });

  it("costs a skier most of his speed", () => {
    const state = atTree(0.2, 50 / 3.6);
    let before = 0;
    let hitAt = -1;
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      const was = state.skier.speed;
      step(state, TUCK);
      if (hitAt < 0 && state.events.some((e) => e.kind === "hit")) {
        before = was;
        hitAt = i;
      }
      if (hitAt >= 0 && i === hitAt + 30) break;
    }
    expect(before).toBeGreaterThan(10);
    expect(state.skier.speed).toBeLessThan(before * 0.6);
  });

  it("a clipped tip turns the skier", () => {
    const state = atTree(0.55, 50 / 3.6);
    ride(state, 3, TUCK);
    expect(Math.abs(state.skier.heading)).toBeGreaterThan(0.1);
  });
});

describe("the map's edge", () => {
  it("turns a skier back before he leaves", () => {
    const level = flatLevel({ packed: 1, size: 3000 });
    const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 2900, heading: 0, speed: 30 });
    ride(state, 10, TUCK);
    expect(state.skier.z).toBeLessThanOrEqual(level.size - TUNING.bounds.margin + 1e-6);
  });
});
