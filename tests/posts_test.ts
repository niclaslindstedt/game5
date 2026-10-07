// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POSTS (`posts.ts`): a floodlight mast's pole and a lift tower's
// column are as solid as a trunk — met square they stop a skier, the hit
// is reported once and says it was a post, and he never ends up inside
// one; every tower and every mast of a ski area is one.

import { describe, expect, it } from "vitest";

import {
  createGame,
  liftPlans,
  NEUTRAL_INPUT,
  pisteMasts,
  PISTE_MAST,
  placeRun,
  postsOf,
  solidsOf,
  step,
  TUNING,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };

function ride(state: GameState, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, TUCK);
    events.push(...state.events);
  }
  return events;
}

describe("the floodlight masts", () => {
  const level = syntheticLevel();
  // A mast on the straight below the S-bend, where the face falls along +z.
  const mast = pisteMasts(level).find((m) => m.z > 600 && m.z < 900)!;

  it("are posts, behind the trunks in the solid list", () => {
    expect(mast).toBeDefined();
    const posts = postsOf(level);
    expect(posts.some((p) => p.x === mast.x && p.z === mast.z)).toBe(true);
    expect(posts.find((p) => p.x === mast.x)!.radius).toBe(PISTE_MAST.pole.foot);
    // The trunks first, in their own order, so a trunk's index is its own.
    const solids = solidsOf(level);
    level.trees.forEach((t, i) => expect(solids[i]).toBe(t));
    expect(solids).toHaveLength(level.trees.length + posts.length);
  });

  it("stops a skier met square, reports a post once, and is never passed through", () => {
    const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: mast.x, z: mast.z - 12, heading: 0, speed: 40 / 3.6 });
    const events = ride(state, 2);
    const hits = events.filter((e) => e.kind === "hit");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const first = hits[0];
    expect(first.kind === "hit" && first.post).toBe(true);
    expect(first.kind === "hit" && first.speed).toBeGreaterThan(8);
    // He did not go through it.
    expect(state.skier.z).toBeLessThan(mast.z);
  });
});

describe("the lift towers", () => {
  const level = levelFor(LEVEL_SEEDS[1]);

  it("stand every support of every lift as a post of its column's girth, or its pad's", () => {
    const plans = liftPlans(level);
    expect(plans.length).toBeGreaterThan(0);
    const posts = postsOf(level);
    for (const plan of plans) {
      for (const s of plan.supports) {
        const post = posts.find((p) => p.x === s.x && p.z === s.z);
        expect(post, `${plan.lift.id} at ${s.u.toFixed(0)} m`).toBeDefined();
        // A padded tower is met on its pad, wider than the steel.
        if (s.pad) expect(post!.radius).toBeGreaterThan(plan.look.column);
        else expect(post!.radius).toBe(plan.look.column);
        expect(post!.height).toBe(s.rope);
      }
    }
  });

  it("throw a skier back off a tower he runs into", () => {
    const plan = liftPlans(level).find((p) => p.supports.length > 2)!;
    const tower = plan.supports[1];
    // Straight at it down the fall line, from a few metres above.
    const n = { x: 0, y: 0, z: 0 };
    level.normalAt(tower.x, tower.z, n);
    const down = Math.atan2(n.x, n.z);
    const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    placeRun(state, {
      x: tower.x - Math.sin(down) * 6,
      z: tower.z - Math.cos(down) * 6,
      heading: down,
      speed: 30 / 3.6,
    });
    const events = ride(state, 1.5);
    const hit = events.find((e) => e.kind === "hit");
    expect(hit && hit.kind === "hit" && hit.post).toBe(true);
    // Never inside the column.
    const d = Math.hypot(state.skier.x - tower.x, state.skier.z - tower.z);
    expect(d).toBeGreaterThan(plan.look.column);
  });
});
