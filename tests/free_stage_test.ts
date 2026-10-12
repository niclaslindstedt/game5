// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S WORLD STAGED BEHIND ITS CARDS (`free-stage.ts`) and the
// builds it rides (`world-build.ts`): a stage is the ride's own or thrown
// away, a build on a staged map pays only for the compile, a build asked
// for while it is still staging joins it, and nothing staged is drawn.

import { describe, expect, it } from "vitest";
import type { CreateGameOptions, GameState, Level } from "@engine";

import { createFreeStage, sceneKey } from "../pwa/src/game/free-stage.ts";
import type { WorldRenderer } from "../pwa/src/game/renderer-api.ts";
import { createWorldBuild } from "../pwa/src/game/world-build.ts";

const map = (seed: number): Level => ({ seed, face: "alpine-1" }) as unknown as Level;
const game = (level: Level): GameState => ({ level, rules: {} }) as unknown as GameState;
const ride = (more: Partial<CreateGameOptions> = {}): CreateGameOptions => ({
  seed: 7,
  face: "alpine-1",
  region: "alpine",
  mode: "free",
  ...more,
});

/** A renderer that records what it is asked, its loads settled by hand. */
function fakeRenderer() {
  const calls: string[] = [];
  const open: (() => void)[] = [];
  const later = (what: string): Promise<void> => {
    calls.push(what);
    return new Promise((done) => open.push(done));
  };
  const renderer = {
    load: (s: GameState, cold?: boolean) => later(`${cold ? "cold" : "load"} ${s.level.seed}`),
    finish: (s: GameState) => later(`finish ${s.level.seed}`),
    clear: () => void calls.push("clear"),
  } as unknown as WorldRenderer;
  const settle = async (): Promise<void> => {
    // Rounds: a settled load can ask for the next one a few ticks later.
    for (let round = 0; round < 4; round++) {
      while (open.length) open.shift()!();
      for (let i = 0; i < 5; i++) await Promise.resolve();
    }
  };
  return { renderer, calls, settle };
}

describe("the scene a free ride's world is built for", () => {
  it("is the same whatever pair, help or luck the run is dealt", () => {
    const a = sceneKey(ride({ grimbear: "hunt", poles: true }), "kit-a");
    const b = sceneKey(ride({ poles: false, mishaps: { rate: "often", salt: 3 } }), "kit-b");
    expect(a).toBe(b);
  });

  it("is another world for another hour, start or craft", () => {
    const base = sceneKey(ride(), "kit");
    expect(sceneKey(ride({ day: { time: "evening", dayOfYear: null } }), "kit")).not.toBe(base);
    expect(sceneKey(ride({ heli: true }), "kit")).not.toBe(base);
    expect(sceneKey(ride({ seed: 8 }), "kit")).not.toBe(base);
  });

  it("names the outfit only where the world wears it (a wingsuit)", () => {
    expect(sceneKey(ride(), "a")).toBe(sceneKey(ride(), "b"));
    expect(sceneKey(ride({ wingsuit: true }), "a")).not.toBe(
      sceneKey(ride({ wingsuit: true }), "b"),
    );
  });
});

describe("a world built ahead", () => {
  it("is never drawn, and a build on it only compiles", async () => {
    const { renderer, calls, settle } = fakeRenderer();
    const world = createWorldBuild(renderer, () => {});
    const level = map(7);
    void world.stage(game(level));
    await settle();
    expect(world.drawable(level)).toBe(false);
    const built = world.build(game(level));
    await settle();
    await built;
    expect(calls).toEqual(["cold 7", "finish 7"]);
    expect(world.drawable(level)).toBe(true);
  });

  it("is joined by a build asked for while it is still being built", async () => {
    const { renderer, calls, settle } = fakeRenderer();
    const world = createWorldBuild(renderer, () => {});
    const level = map(7);
    void world.stage(game(level));
    const built = world.build(game(level));
    await settle();
    await settle();
    await built;
    expect(calls).toEqual(["cold 7", "finish 7"]);
  });

  it("is thrown away whole, and another map is built from nothing", async () => {
    const { renderer, calls, settle } = fakeRenderer();
    const world = createWorldBuild(renderer, () => {});
    void world.stage(game(map(7)));
    await settle();
    world.unstage();
    expect(world.staged()).toBe(null);
    void world.build(game(map(8)));
    expect(calls).toEqual(["cold 7", "clear", "load 8"]);
  });
});

describe("the free ride's stage", () => {
  function rig() {
    const { renderer, calls, settle } = fakeRenderer();
    const world = createWorldBuild(renderer, () => {});
    let held: Level | null = null;
    const listeners = new Set<() => void>();
    const timers: (() => void)[] = [];
    let restored = 0;
    let busy = false;
    const stage = createFreeStage({
      held: () => held,
      onMaps: (l) => (listeners.add(l), () => listeners.delete(l)),
      stand: (o) => game(o.level!),
      stage: world.stage,
      unstage: world.unstage,
      busy: () => busy,
      restore: () => void restored++,
      later: (run) => (timers.push(run), () => timers.splice(timers.indexOf(run), 1)),
    });
    return {
      stage,
      calls,
      settle,
      arrive: (level: Level) => {
        held = level;
        for (const l of [...listeners]) l();
      },
      tick: () => timers.splice(0).forEach((run) => run()),
      restored: () => restored,
      setBusy: (b: boolean) => (busy = b),
    };
  }

  it("waits for the map, then stages it, and RIDE rides that very map", () => {
    const r = rig();
    r.stage.want(ride(), "kit");
    r.tick();
    expect(r.calls).toEqual([]);
    const level = map(7);
    r.arrive(level);
    r.tick();
    expect(r.calls).toEqual(["cold 7"]);
    const taken = r.stage.take(ride({ grimbear: "hunt" }), "kit");
    expect(taken?.level).toBe(level);
    expect(taken?.day).toBeUndefined();
  });

  it("is not ridden by a ride whose world differs", () => {
    const r = rig();
    r.arrive(map(7));
    r.stage.want(ride(), "kit");
    r.tick();
    expect(r.stage.take(ride({ heli: true }), "kit")).toBe(null);
  });

  it("is thrown away and the backdrop handed back when the cards go", () => {
    const r = rig();
    r.arrive(map(7));
    r.stage.want(ride(), "kit");
    r.tick();
    r.stage.drop();
    expect(r.calls).toEqual(["cold 7", "clear"]);
    expect(r.restored()).toBe(1);
  });

  it("never touches the world a load is building", () => {
    const r = rig();
    r.arrive(map(7));
    r.stage.want(ride(), "kit");
    r.tick();
    r.setBusy(true);
    r.stage.drop();
    expect(r.calls).toEqual(["cold 7"]);
    expect(r.restored()).toBe(0);
  });
});
