// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRIMBEAR (`grimbear.ts`): dealt only to a free ride that asks for him;
// hidden behind a trunk ahead of the skier and beside his line before he
// can be seen; out of the trees as the skier comes; catching him ONCE —
// the skier thrown, the beast walking off, the reset at the top of the
// slope — and every sighting after that a chase that pulls up short.

import { describe, expect, it } from "vitest";

import {
  GRIMBEAR,
  TUNING,
  createGame,
  step,
  stepGrimbear,
  NEUTRAL_INPUT,
  type GameEvent,
  type GameState,
  type Level,
} from "@engine";
import { SLOPE, syntheticLevel } from "./support/synthetic.ts";
import {
  GRIMBEAR_ODDS,
  freeGameOptions,
  freeTopOptions,
  freshRide,
  grimbearAgain,
} from "../pwa/src/game/free-ride.ts";
import { freshGrimbearPose, grimbearPose } from "../pwa/src/game/grimbear-pose.ts";
import { SKIS } from "@engine";

/** The SLOPE with one trunk 9 m beside the straight below the bend. */
const TREE = { x: SLOPE.x + 9, z: 700 };
function woods(): Level {
  const level = syntheticLevel({ noTrees: true });
  level.trees = [
    { x: TREE.x, z: TREE.z, y: level.groundAt(TREE.x, TREE.z), height: 12, radius: 0.35, crown: 3 },
  ];
  return level;
}

function ride(ask?: "hunt" | "roam"): GameState {
  return createGame({ level: woods(), mode: "free", quiet: true, grimbear: ask, crowd: 0 });
}

/** The skier straight down the piste's line at `speed`, the beast stepped
 * beside him — the skier moved by hand, so nothing but the beast decides. */
function glide(state: GameState, fromZ: number, speed: number, seconds: number): GameEvent[] {
  const all: GameEvent[] = [];
  const c = state.skier;
  c.x = SLOPE.x;
  c.z = fromZ;
  c.vx = 0;
  c.vz = speed;
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) {
    state.t += TUNING.dt;
    events.length = 0;
    if (!c.thrown) c.z += speed * TUNING.dt;
    stepGrimbear(state, events);
    all.push(...events);
  }
  return all;
}

describe("the grimbear is dealt", () => {
  it("only to a free ride that asks for him", () => {
    expect(ride().grimbear).toBeUndefined();
    expect(createGame({ level: woods(), quiet: true, grimbear: "hunt" }).grimbear).toBeUndefined();
    expect(ride("hunt").grimbear?.hunt).toBe(true);
    expect(ride("roam").grimbear?.hunt).toBe(false);
  });

  it("waits a while into the ride before he lies in wait", () => {
    const b = ride("hunt").grimbear!;
    expect(b.phase).toBe("away");
    expect(b.wait).toBeGreaterThanOrEqual(GRIMBEAR.firstAfter[0]);
    expect(b.wait).toBeLessThanOrEqual(GRIMBEAR.firstAfter[1]);
  });

  it("draws nothing from the run's own stream", () => {
    const a = ride();
    const b = ride("hunt");
    expect(b.rng.next()).toBe(a.rng.next());
  });
});

describe("the ambush", () => {
  it("hides behind the trunk beside the skier's line, the tree between them", () => {
    const state = ride("hunt");
    const b = state.grimbear!;
    b.wait = 0;
    glide(state, 620, 15, TUNING.dt * 2);
    expect(b.phase).toBe("lurk");
    expect(b.tree).toBe(0);
    // Further from the skier than the trunk, and on its line from him.
    const c = state.skier;
    const toTree = Math.hypot(TREE.x - c.x, TREE.z - c.z);
    expect(Math.hypot(b.x - c.x, b.z - c.z)).toBeGreaterThan(toTree);
    const cross = ((TREE.x - c.x) * (b.z - c.z) - (TREE.z - c.z) * (b.x - c.x)) / toTree;
    expect(Math.abs(cross)).toBeLessThan(0.2);
  });

  it("finds nowhere to hide with no trunk ahead, and looks again", () => {
    const state = ride("hunt");
    const b = state.grimbear!;
    b.wait = 0;
    glide(state, 800, 15, TUNING.dt * 2);
    expect(b.phase).toBe("away");
    expect(b.wait).toBeGreaterThan(0);
  });
});

describe("the hunt", () => {
  it("breaks cover as the skier comes and takes him, once", () => {
    const state = ride("hunt");
    const b = state.grimbear!;
    b.wait = 0;
    const events = glide(state, 620, 15, 8);
    const kinds = events
      .filter((e) => e.kind === "grimbear")
      .map((e) => e.kind === "grimbear" && e.phase);
    expect(kinds.slice(0, 2)).toEqual(["burst", "maul"]);
    const burst = events.find((e) => e.kind === "grimbear" && e.phase === "burst")!;
    // Out of the trees before the skier had passed his trunk.
    expect(burst.t).toBeLessThan((TREE.z - 620) / 15);
    expect(state.skier.thrown?.cause).toBe("maul");
    expect(b.hunt).toBe(false);
    expect(b.top).toBe(true);
  });

  it("catches a skier going flat out too", () => {
    const state = ride("hunt");
    state.grimbear!.wait = 0;
    glide(state, 600, 30, 8);
    expect(state.skier.thrown?.cause).toBe("maul");
  });

  it("walks off, and the skier is stood up at the top of the slope", () => {
    const state = ride("hunt");
    const b = state.grimbear!;
    b.wait = 0;
    glide(state, 620, 15, 6);
    expect(b.phase === "maul" || b.phase === "leave").toBe(true);
    let reset: GameEvent | undefined;
    const phases = new Set<string>();
    for (let i = 0; i < Math.round(GRIMBEAR.lieFor / TUNING.dt) + 10 && !reset; i++) {
      step(state, NEUTRAL_INPUT);
      phases.add(b.phase);
      reset = state.events.find((e) => e.kind === "reset");
    }
    expect(phases.has("leave")).toBe(true);
    expect(reset).toBeDefined();
    expect(state.skier.thrown).toBeNull();
    expect(state.skier.x).toBeCloseTo(state.level.spawn.x, 3);
    expect(state.skier.z).toBeCloseTo(state.level.spawn.z, 3);
    expect(b.top).toBe(false);
  });
});

describe("after the catch", () => {
  it("only chases, and pulls up short of the skier", () => {
    const state = ride("roam");
    const b = state.grimbear!;
    b.wait = 0;
    let nearest = Infinity;
    const c = state.skier;
    c.x = SLOPE.x;
    c.z = 620;
    c.vz = 15;
    const seen: string[] = [];
    for (let i = 0; i < Math.round(10 / TUNING.dt); i++) {
      state.t += TUNING.dt;
      c.z += 15 * TUNING.dt;
      state.events.length = 0;
      stepGrimbear(state, state.events);
      for (const e of state.events) if (e.kind === "grimbear") seen.push(e.phase);
      if (b.phase !== "away" && b.phase !== "lurk")
        nearest = Math.min(nearest, Math.hypot(b.x - c.x, b.z - c.z));
    }
    expect(seen[0]).toBe("burst");
    expect(seen).toContain("halt");
    expect(seen).not.toContain("maul");
    expect(c.thrown).toBeNull();
    expect(nearest).toBeGreaterThan(GRIMBEAR.reach);
  });

  it("pulls up short of a skier who stops", () => {
    const state = ride("roam");
    const b = state.grimbear!;
    b.wait = 0;
    glide(state, 620, 15, 5);
    expect(b.phase).toBe("run");
    const events = glide(state, state.skier.z, 0.1, 6);
    expect(events.some((e) => e.kind === "grimbear" && e.phase === "halt")).toBe(true);
    expect(state.skier.thrown).toBeNull();
  });
});

describe("the app deals him", () => {
  const skier = { spec: SKIS, assist: { yaw: 1, air: 1 } };
  it("to a free ride at the odds, never past them", () => {
    expect(freeGameOptions(freshRide(), 2, skier, () => GRIMBEAR_ODDS - 0.01).grimbear).toBe(
      "hunt",
    );
    expect(freeGameOptions(freshRide(), 2, skier, () => GRIMBEAR_ODDS).grimbear).toBeUndefined();
  });

  it("keeps him on a restart, and the catch he has had", () => {
    const again = freeGameOptions(freshRide(), 2, skier, () => 0);
    const hunted = ride("hunt");
    expect(freeTopOptions(again, undefined, hunted.grimbear).grimbear).toBe("hunt");
    hunted.grimbear!.hunt = false;
    expect(freeTopOptions(again, undefined, hunted.grimbear).grimbear).toBe("roam");
    expect(freeTopOptions(again, undefined, undefined).grimbear).toBeUndefined();
    expect(grimbearAgain(undefined)).toBeUndefined();
  });
});

describe("his figure", () => {
  it("runs like a man: the legs and the arms swing against each other", () => {
    const pose = grimbearPose("run", 0.85, 9, 0, freshGrimbearPose());
    expect(Math.sign(pose.hip[0])).toBe(-Math.sign(pose.hip[1]));
    expect(Math.sign(pose.shoulder[0])).toBe(-Math.sign(pose.hip[0]));
    expect(pose.lean).toBeGreaterThan(0.3);
  });

  it("stands tall and roars when he pulls up", () => {
    const pose = grimbearPose("halt", 0, 0, 0.5, freshGrimbearPose());
    expect(pose.jaw).toBeGreaterThan(0.5);
    expect(pose.spread).toBeGreaterThan(0.5);
  });
});
