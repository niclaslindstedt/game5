// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD (`engine/game/crowd.ts`): the free ride's amateurs — dealt in
// groups onto the resort's runs, the easy ones fullest, skiing them top to
// bottom and riding the lifts back up, deterministic off a stream of their
// own, and met by the player as bodies that knock and get knocked down.

import { describe, expect, it } from "vitest";
import {
  CROWD,
  CROWD_GROUPS,
  clipCrowd,
  createGame,
  crowdNet,
  NEUTRAL_INPUT,
  step,
  type Amateur,
  type GameEvent,
  type GameState,
} from "@engine";

import { levelFor } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** Seed 7's resort has every colour on it. */
const SEED = 7;
const level = levelFor(SEED);
const free = (crowd?: number): GameState =>
  createGame({ level, seed: SEED, mode: "free", quiet: true, crowd });
const ride = (state: GameState, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 120); i++) step(state, NEUTRAL_INPUT);
};

describe("the crowd is dealt", () => {
  it("onto a free ride only, as many as the ride asks", () => {
    expect(free().crowd!.amateurs.length).toBe(CROWD.count);
    expect(free(40).crowd!.amateurs.length).toBe(40);
    expect(free(0).crowd).toBeUndefined();
    for (const mode of ["race", "timeTrial"] as const) {
      expect(createGame({ level, seed: SEED, mode, quiet: true }).crowd).toBeUndefined();
    }
    // A measured run has the snow to itself unless it asks.
    expect(createGame({ level, seed: SEED, quiet: true, rivals: 0 }).crowd).toBeUndefined();
  });

  it("in groups that are what they say: a school of children, a family with one", () => {
    const crowd = free().crowd!;
    const kinds = new Set(crowd.groups.map((g) => g.kind));
    for (const kind of ["solo", "family", "friends", "school"] as const)
      expect(kinds).toContain(kind);
    for (const g of crowd.groups) {
      const people = g.members.map((m) => crowd.amateurs[m]);
      expect(people.every((a, k) => a.rank === k && a.group === crowd.groups.indexOf(g))).toBe(
        true,
      );
      const def = CROWD_GROUPS[g.kind];
      expect(people.length).toBeLessThanOrEqual(1 + def.count[1]);
      if (g.kind === "school") {
        expect(people[0].kind).toBe("instructor");
        expect(people.slice(1).every((a) => a.body === "child")).toBe(true);
        // The snake skis the instructor's turns.
        for (const a of people) expect(a.knobs.turn).toBe(people[0].knobs.turn);
      }
      if (g.kind === "family" && people.length > 1) expect(people[1].kind).toBe("kid");
      // Each one his own: knobs inside their bands.
      for (const a of people) {
        for (const k of ["skill", "aggression", "offPiste", "wobble", "stopper", "jumper"] as const)
          expect(a.knobs[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("off a stream of its own: the run's stream and the player are untouched", () => {
    const withCrowd = free();
    const without = free(0);
    expect(withCrowd.rng.next()).toBe(without.rng.next());
    expect(withCrowd.skier.x).toBe(without.skier.x);
  });

  it("pushes off with the whole crowd, never in step with it", () => {
    const state = free();
    ride(state, 1);
    const poling = state.crowd!.amateurs.filter((a) => a.push > 0.05);
    expect(poling.length).toBeGreaterThan(20);
    // How bunched their strokes are: 1 all in step, 0 spread round the cycle.
    const c = poling.reduce((x, a) => x + Math.cos(a.pole), 0) / poling.length;
    const s = poling.reduce((x, a) => x + Math.sin(a.pole), 0) / poling.length;
    expect(Math.hypot(c, s)).toBeLessThan(0.3);
  });

  it("the same seed, the same crowd, step for step", () => {
    const a = free();
    const b = free();
    ride(a, 20);
    ride(b, 20);
    const pick = (s: GameState) => s.crowd!.amateurs.map((m) => [m.mode, m.run, m.x, m.z]);
    expect(pick(a)).toEqual(pick(b));
  });
});

describe("the crowd skis", () => {
  const state = free();
  const net = crowdNet(state.level);
  const metres: Record<string, number> = {};
  for (const r of net.runs) metres[r.grade] = (metres[r.grade] ?? 0) + r.length;
  const people: Record<string, number> = {};
  const seen = new Map<number, string[]>();
  let speed = 0;
  let samples = 0;
  for (let s = 0; s < 12; s++) {
    ride(state, 10);
    for (const a of state.crowd!.amateurs) {
      const modes = seen.get(a.id) ?? [];
      if (modes[modes.length - 1] !== a.mode) modes.push(a.mode);
      seen.set(a.id, modes);
      if (a.mode === "lift") continue;
      const g = net.runs[a.run].grade;
      people[g] = (people[g] ?? 0) + 1;
      speed += a.speed;
      samples += 1;
    }
  }

  it("the easy runs fullest: more people a metre on the greens than the blacks", () => {
    const per = (g: string) => (people[g] ?? 0) / Math.max(1, metres[g] ?? 0);
    expect(metres.green).toBeGreaterThan(0);
    expect(metres.black).toBeGreaterThan(0);
    expect(per("green")).toBeGreaterThan(per("black") * 2);
    expect(per("green")).toBeGreaterThan(per("red"));
  });

  it("on the snow, down the mountain, and back up the lifts", () => {
    for (const a of state.crowd!.amateurs) {
      expect(Number.isFinite(a.x + a.y + a.z + a.s + a.d + a.speed)).toBe(true);
      if (a.mode === "lift" || a.mode === "air") continue;
      expect(Math.abs(a.y - state.level.groundAt(a.x, a.z))).toBeLessThan(0.01);
    }
    expect(speed / samples).toBeGreaterThan(2);
    // Someone has been all the way down, up a lift and out again.
    const round = [...seen.values()].filter((m) => m.join(",").includes("lift,ski"));
    expect(round.length).toBeGreaterThan(5);
    // ...and a few have stopped, and a few have fallen.
    const all = [...seen.values()].map((m) => m.join(","));
    expect(all.filter((m) => m.includes("stop")).length).toBeGreaterThan(10);
    expect(all.filter((m) => m.includes("down")).length).toBeGreaterThan(3);
  });

  it("on a map with no resort, down its piste", () => {
    const flat = createGame({ level: syntheticLevel(), seed: 3, mode: "free", quiet: true });
    expect(crowdNet(flat.level).runs).toHaveLength(1);
    ride(flat, 10);
    expect(flat.crowd!.amateurs.some((a) => a.mode === "ski" && a.speed > 1)).toBe(true);
  });
});

describe("the player meets the crowd", () => {
  /** One amateur stood in front of the player, everyone else up a lift,
   * the player coming at him at `v` m/s. */
  function meet(v: number, skill = 0.2): { state: GameState; a: Amateur; events: GameEvent[] } {
    const state = free(30);
    const crowd = state.crowd!;
    for (const o of crowd.amateurs) o.mode = "lift";
    const a = crowd.amateurs[0];
    a.mode = "ski";
    a.knobs = { ...a.knobs, skill };
    a.vx = a.vz = 0;
    a.speed = 0;
    const c = state.skier;
    a.x = c.x;
    a.z = c.z + 0.9;
    a.y = c.y - c.spec.cogHeight;
    c.heading = 0;
    c.vx = 0;
    c.vz = v;
    const events: GameEvent[] = [];
    clipCrowd(state, events);
    return { state, a, events };
  }

  it("a shoulder at a crawl: a bump, and nobody down", () => {
    const { a, events, state } = meet(2.5, 0.9);
    expect(events.some((e) => e.kind === "bump" && e.amateur === a.id && e.rival === -1)).toBe(
      true,
    );
    expect(a.mode).not.toBe("down");
    expect(state.skier.thrown).toBeFalsy();
    // They are pushed apart.
    expect(Math.abs(a.z - state.skier.z)).toBeGreaterThan(0.9);
  });

  it("hard enough and he goes down; harder and so does the player", () => {
    const knocked = meet(6);
    expect(knocked.a.mode).toBe("down");
    expect(knocked.state.skier.thrown).toBeFalsy();
    const taken = meet(20);
    expect(taken.a.mode).toBe("down");
    expect(taken.state.skier.thrown?.cause).toBe("skier");
    expect(taken.events.some((e) => e.kind === "wipeout" && e.cause === "skier")).toBe(true);
  });
});
