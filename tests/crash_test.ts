// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIPEOUT, BOGGED, AND THE DAMAGE: a hard trunk, a landing over the
// tips, a fall at speed and a caught edge each throw the skier, and nothing
// short of them does; he tumbles on his own and the reset stands him back
// up; a skier bogged in powder sinks in and works back out; and a blow dulls
// an edge or hurts the legs only on a run that asked for damage.

import { describe, expect, it } from "vitest";

import {
  botInput,
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  RAGDOLL,
  skiPull,
  SKI_CATALOG,
  step,
  trenchGrip,
  TUNING,
  type GameEvent,
  type GameState,
  type RunMoment,
  type SkierInput,
  type Thrown,
} from "@engine";
import { flatLevel, LONE_TREE, pisteX, SLOPE, syntheticLevel } from "./support/synthetic.ts";

const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };
/** A groomed pitch to keep a skier moving while a dulled edge pulls him. */
const PITCH = flatLevel({ packed: 1, grade: 0.25, slopeFrom: 150, size: 3000 });

function ride(
  state: GameState,
  seconds: number,
  input: SkierInput | ((t: number) => SkierInput),
): GameEvent[] {
  const events: GameEvent[] = [];
  const t0 = state.t;
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, typeof input === "function" ? input(state.t - t0) : input);
    events.push(...state.events);
  }
  return events;
}

function staged(level = flatLevel({ packed: 1 }), moment: RunMoment, damage = false): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, damage, quiet: true });
  placeRun(state, moment);
  return state;
}

const atTree = (offset: number, kmh: number, damage = false): GameState =>
  staged(
    syntheticLevel(),
    { x: LONE_TREE.x + offset, z: LONE_TREE.z - 30, heading: 0, speed: kmh / 3.6 },
    damage,
  );

const wipeouts = (events: GameEvent[]) => events.filter((e) => e.kind === "wipeout");

/** How far up the sky his spine points: 1 stood, 0 lying flat. */
function spineUp(b: Thrown): number {
  const P = b.points;
  const at = (i: number, k: number) => P[3 * i + k];
  const R = RAGDOLL;
  const d = [0, 1, 2].map(
    (k) => at(R.shoulderL, k) + at(R.shoulderR, k) - at(R.hipL, k) - at(R.hipR, k),
  );
  return d[1] / Math.hypot(d[0], d[1], d[2]);
}

describe("the wipeout", () => {
  it("a trunk met hard throws the skier on, and the reset stands him up", () => {
    const state = atTree(0.3, 50);
    const events: GameEvent[] = [];
    let off: GameState["skier"]["thrown"] = null;
    let first: GameState["skier"]["thrown"] = null;
    const tree = state.level.trees.find((t) => t.x === LONE_TREE.x)!;
    let closest = Infinity;
    for (let i = 0; i < 8 * TUNING.physicsHz; i++) {
      step(state, TUCK);
      events.push(...state.events);
      if (state.skier.thrown) {
        off = { ...state.skier.thrown };
        first ??= off;
        for (let k = 0; k < RAGDOLL.count; k++) {
          const px = off.points[3 * k];
          const pz = off.points[3 * k + 2];
          if (off.points[3 * k + 1] < tree.y + tree.height) {
            closest = Math.min(closest, Math.hypot(px - tree.x, pz - tree.z));
          }
        }
      }
      if (events.some((e) => e.kind === "reset")) break;
    }
    const w = wipeouts(events);
    expect(w).toHaveLength(1);
    expect(w[0].kind === "wipeout" && w[0].cause).toBe("tree");
    // He left his skis at the way he had before the trunk took it — met
    // the trunk himself, no part of him passing through it — went over, and
    // came to rest lying on the snow.
    expect(off).not.toBeNull();
    expect(first!.vz).toBeGreaterThan(0.8 * TUNING.crash.keep * (50 / 3.6));
    expect(closest).toBeGreaterThanOrEqual(tree.radius + TUNING.crash.body.limb - 1e-6);
    expect(off!.tumble).toBeGreaterThan(Math.PI / 2);
    expect(Math.abs(spineUp(off!))).toBeLessThan(0.35);
    const reset = events.find((e) => e.kind === "reset");
    expect(reset && reset.kind === "reset" && reset.auto).toBe(true);
    expect(reset!.t - w[0].t).toBeGreaterThanOrEqual(TUNING.crash.lieMin - 1e-9);
    expect(reset!.t - w[0].t).toBeLessThanOrEqual(TUNING.crash.lieMax + TUNING.dt);
    expect(state.skier.thrown).toBeNull();
  });

  it("lies down in the snow as a body does — and deep powder stops him soonest", () => {
    // Over the tips at 60 km/h onto the groomer, onto ordinary powder and
    // onto the deepest: he lands, goes over, slides and lies still, flat —
    // not rolling on like a wheel — and the deeper the snow the sooner.
    const lie = (packed: number, snowDepth: number) => {
      const state = createGame({
        level: flatLevel({ packed }),
        rivals: 0,
        countdown: 0,
        quiet: true,
        snowDepth,
      });
      placeRun(state, {
        x: 1500,
        z: 200,
        heading: 0,
        speed: 60 / 3.6,
        height: 2.5,
        vy: -3,
        pitch: -0.7,
      });
      let body: Thrown | null = null;
      let down = -1;
      for (let i = 0; i < 8 * TUNING.physicsHz; i++) {
        step(state, NEUTRAL_INPUT);
        const b = state.skier.thrown;
        if (!b) {
          if (body) break;
          continue;
        }
        body = { ...b, points: b.points.slice() };
        if (down < 0 && b.touching) down = b.tumble;
      }
      expect(body).not.toBeNull();
      const b = body!;
      const from = { x: 1500, z: 200 };
      return {
        slid: Math.hypot(b.x - from.x, b.z - from.z),
        rolled: b.tumble - down,
        flat: Math.abs(spineUp(b)),
        still: b.still,
      };
    };
    const groomer = lie(1, 1);
    const powder = lie(0, 1);
    const deep = lie(0, 2);
    for (const r of [groomer, powder, deep]) {
      expect(r.still).toBeGreaterThan(0);
      expect(r.flat).toBeLessThan(0.35);
      // On the snow he goes over a turn at the most, never over and over.
      expect(r.rolled).toBeLessThan(2 * Math.PI);
    }
    expect(powder.slid).toBeLessThan(groomer.slid - 5);
    expect(deep.slid).toBeLessThanOrEqual(powder.slid);
    expect(deep.rolled).toBeLessThanOrEqual(groomer.rolled + 1e-9);
  });

  it("a trunk clipped slowly is a hit he skis on through", () => {
    // Held to a crawl in a snowplough down the face onto the trunk: a clip
    // well under `crash.treeSpeed`.
    const state = staged(syntheticLevel(), {
      x: LONE_TREE.x + 0.5,
      z: LONE_TREE.z - 12,
      heading: 0,
      speed: 16 / 3.6,
    });
    const events = ride(state, 5, () => ({ ...NEUTRAL_INPUT, brake: 0.7 }));
    expect(events.some((e) => e.kind === "hit")).toBe(true);
    expect(wipeouts(events)).toHaveLength(0);
  });

  it("with the skier thrown, the skis are let go and take no gate", () => {
    const state = atTree(0.3, 50);
    ride(state, 2.4, TUCK);
    expect(state.skier.thrown).not.toBeNull();
    const passed = state.progress.passed;
    ride(state, 0.5, TUCK);
    expect(state.skier.tuck).toBeLessThan(0.05);
    expect(state.progress.passed).toBe(passed);
  });

  it("a landing taken on the tips goes over them; the same drop level does not", () => {
    const drop = (pitch: number): GameEvent[] =>
      ride(
        staged(undefined, {
          x: 1500,
          z: 200,
          heading: 0,
          speed: 60 / 3.6,
          height: 2.5,
          vy: -3,
          pitch,
        }),
        2,
        NEUTRAL_INPUT,
      );
    const nose = wipeouts(drop(-0.7));
    expect(nose).toHaveLength(1);
    expect(nose[0].kind === "wipeout" && nose[0].cause).toBe("nose");
    const flat = drop(0);
    expect(flat.some((e) => e.kind === "land")).toBe(true);
    expect(wipeouts(flat)).toHaveLength(0);
  });

  it("the slope's kicker overshot at race speed is skied out", () => {
    // Launched fast, up under the arcade's heavier air, and down past the
    // landing onto the pitch: a hard landing, and no pair in the catalog
    // throws its skier for it.
    for (const spec of SKI_CATALOG) {
      const state = createGame({
        level: syntheticLevel(),
        rivals: 0,
        countdown: 0,
        spec,
        quiet: true,
      });
      placeRun(state, {
        x: pisteX(SLOPE.kickerZ - 60),
        z: SLOPE.kickerZ - 60,
        heading: 0,
        speed: 75 / 3.6,
      });
      const events = ride(state, 6, TUCK);
      expect(
        events.some((e) => e.kind === "land" && e.airTime > 0.6),
        spec.id,
      ).toBe(true);
      expect(wipeouts(events), spec.id).toHaveLength(0);
    }
  });

  it("a fall at speed throws him; the same roll at a crawl does not", () => {
    const over = (kmh: number): GameEvent[] =>
      ride(
        staged(undefined, {
          x: 1500,
          z: 200,
          heading: 0,
          speed: kmh / 3.6,
          height: 1.2,
          roll: 1.35,
        }),
        2,
        TUCK,
      );
    const fast = wipeouts(over(70));
    expect(fast).toHaveLength(1);
    expect(fast[0].kind === "wipeout" && fast[0].cause).toBe("roll");
    expect(wipeouts(over(10))).toHaveLength(0);
  });

  it("a caught edge at speed throws him", () => {
    // Sliding sideways across the groomer at 40 km/h with the skis stood
    // right up on their edge: the edge bites all at once.
    const state = staged(undefined, { x: 1500, z: 200, heading: Math.PI / 2, speed: 40 / 3.6 });
    state.skier.vx = 0;
    state.skier.vz = 40 / 3.6;
    state.skier.edge = TUNING.skier.slipEdge + 0.1;
    const events = ride(state, 1, { ...NEUTRAL_INPUT, steer: 1 });
    const caught = wipeouts(events);
    expect(caught).toHaveLength(1);
    expect(caught[0].kind === "wipeout" && caught[0].cause).toBe("catch");
  });

  it("on a free ride, the reset after a wipeout stands him on the nearest piste", () => {
    const state = createGame({ level: syntheticLevel(), mode: "free", quiet: true });
    placeRun(state, { x: LONE_TREE.x + 0.3, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 });
    const events = ride(state, 6, TUCK);
    expect(wipeouts(events)).toHaveLength(1);
    expect(events.some((e) => e.kind === "reset" && e.auto)).toBe(true);
    expect(state.level.packedAt(state.skier.x, state.skier.z)).toBe(1);
  });

  it("a time trial with a wipeout in it still reaches its finish", () => {
    const state = createGame({
      level: syntheticLevel(),
      seed: 7,
      mode: "timeTrial",
      quiet: true,
    });
    placeRun(state, { x: LONE_TREE.x + 0.3, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 });
    const events = ride(state, 4.5, TUCK);
    expect(wipeouts(events)).toHaveLength(1);
    for (let i = 0; i < 300 * TUNING.physicsHz && !state.progress.finished; i++) {
      step(state, botInput(state));
    }
    expect(state.progress.finished).toBe(true);
  });

  it("is a pure function of the moment: two crashes are the same crash", () => {
    const a = atTree(0.3, 50);
    const b = atTree(0.3, 50);
    ride(a, 3.2, TUCK);
    ride(b, 3.2, TUCK);
    expect(a.skier.thrown).not.toBeNull();
    expect(b.skier.thrown).toEqual(a.skier.thrown);
  });
});

describe("bogged", () => {
  /** A skier pinned in powder pushing on his poles: his way taken off him. */
  function pinned(seconds: number, state: GameState, input = TUCK): GameEvent[] {
    const events: GameEvent[] = [];
    for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
      state.skier.vx = state.skier.vz = 0;
      step(state, input);
      events.push(...state.events);
    }
    return events;
  }
  const inPowder = () => staged(flatLevel({ packed: 0 }), { x: 1500, z: 300, heading: 0 });

  it("sinks a skier bogged in powder in, and says so once", () => {
    const state = inPowder();
    const events = pinned(4, state);
    expect(events.filter((e) => e.kind === "stuck")).toHaveLength(1);
    expect(state.skier.trench).toBeGreaterThan(TUNING.trench.stuckAt);
    expect(state.skier.trench).toBeLessThanOrEqual(TUNING.trench.max);
    expect(trenchGrip(state.skier.trench)).toBeLessThan(1);
    // A push off down a pitch out of the same powder never gets near it.
    const launch = staged(flatLevel({ packed: 0, grade: 0.3, slopeFrom: 250 }), {
      x: 1500,
      z: 300,
      heading: 0,
      speed: 2,
    });
    ride(launch, 4, TUCK);
    expect(launch.skier.trench).toBe(0);
  });

  it("is worked back out, and the reset waits for the skier to try", () => {
    const state = inPowder();
    pinned(3, state);
    const dug = state.skier.trench;
    expect(dug).toBeGreaterThan(0.1);
    // Rocked: the lean fore and aft and the edge side to side, off the poles.
    const rock = (t: number): SkierInput => {
      const s = Math.sin(2 * Math.PI * 1.2 * t) >= 0 ? 1 : -1;
      return { ...NEUTRAL_INPUT, tuck: 0.35, steer: s, lean: s };
    };
    const events = ride(state, 4, rock);
    expect(state.skier.trench).toBeLessThan(dug / 2);
    expect(events.some((e) => e.kind === "reset")).toBe(false);
  });

  it("stands a skier who never gets out back up after his own hold", () => {
    const state = inPowder();
    const events = pinned(TUNING.trench.holdFor + 3, state);
    const reset = events.find((e) => e.kind === "reset");
    expect(reset && reset.kind === "reset" && reset.auto).toBe(true);
    expect(reset!.t).toBeGreaterThan(TUNING.trench.holdFor);
  });
});

describe("damage", () => {
  it("is off unless asked for: a trunk dulls nothing", () => {
    const state = atTree(0.3, 50);
    const events = ride(state, 3, TUCK);
    expect(events.some((e) => e.kind === "damage")).toBe(false);
    expect(state.skier.damage).toEqual({ ski: [0, 0], legs: 0 });
    expect(skiPull(state.skier)).toBe(0);
  });

  it("dulls the edge on the side the trunk was met, and says so", () => {
    const state = atTree(0.4, 40, true);
    const events = ride(state, 3, TUCK);
    const d = state.skier.damage;
    // The trunk stood left of the skier's line (he passed right of it).
    expect(d.ski[0]).toBeGreaterThan(d.ski[1]);
    expect(events.some((e) => e.kind === "damage" && e.part === "skiLeft")).toBe(true);
  });

  it("a dulled edge pulls a skier going straight toward its side", () => {
    const run = (dulled: [number, number]): number => {
      const state = staged(PITCH, { x: 1500, z: 200, heading: 0, speed: 50 / 3.6 });
      state.damage = true;
      state.skier.damage.ski = dulled;
      ride(state, 4, { ...TUCK, tuck: 0.5 });
      return state.skier.x - 1500;
    };
    expect(run([0, 0])).toBeCloseTo(0, 1);
    expect(run([0, 1])).toBeGreaterThan(3);
    expect(run([1, 0])).toBeLessThan(-3);
  });

  it("a landing the legs could not take hurts them", () => {
    const state = staged(
      flatLevel({ packed: 1 }),
      { x: 1500, z: 200, heading: 0, speed: 60 / 3.6, height: 5, vy: -4 },
      true,
    );
    const events = ride(state, 2, NEUTRAL_INPUT);
    const land = events.find((e) => e.kind === "land");
    expect(land && land.kind === "land" && land.harsh).toBe(true);
    expect(state.skier.damage.legs).toBeGreaterThan(0);
  });

  it("is never dealt to a rival", () => {
    const state = createGame({ level: syntheticLevel(), damage: true, quiet: true });
    expect(state.damage).toBe(true);
    for (const r of state.rivals) expect(r.run.damage).toBe(false);
  });
});
