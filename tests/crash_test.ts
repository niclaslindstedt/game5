// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIPEOUT, BOGGED, AND THE DAMAGE: a hard trunk, a landing over the
// tips, the body slammed down, a fall at speed and a caught edge each throw
// the skier, and nothing short of them does — a professional rides out the
// rest, and the near fall is kept as a save for the figure to play; he
// tumbles on his own and the reset stands him back up; a skier bogged in powder sinks in and works back out; and a blow dulls
// an edge or hurts the legs only on a run that asked for damage.

import { describe, expect, it } from "vitest";

import {
  botInput,
  crashLimit,
  crashOver,
  createGame,
  mayGetUp,
  NEUTRAL_INPUT,
  placeRun,
  RAGDOLL,
  skiPull,
  SKI_CATALOG,
  step,
  trenchGrip,
  TUNING,
  type CrashLimit,
  type GameEvent,
  type GameState,
  type LoneSki,
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

function staged(
  level = flatLevel({ packed: 1 }),
  moment: RunMoment,
  damage = false,
  resilience?: number,
): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, damage, quiet: true, resilience });
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
    for (let i = 0; i < 12 * TUNING.physicsHz; i++) {
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
    // The player's fall is his to watch: the engine stands him up at
    // `lieFor`, never sooner.
    expect(reset!.t - w[0].t).toBeGreaterThanOrEqual(TUNING.crash.lieFor - TUNING.dt);
    expect(reset!.t - w[0].t).toBeLessThanOrEqual(TUNING.crash.lieFor + TUNING.dt);
    expect(state.skier.thrown).toBeNull();
  });

  it("lets the player's own press stand him up only past `getUp`", () => {
    const state = atTree(0.3, 50);
    for (let i = 0; i < 6 * TUNING.physicsHz && !state.skier.thrown; i++) step(state, TUCK);
    expect(state.skier.thrown).not.toBeNull();
    const press = { ...NEUTRAL_INPUT, reset: true };
    // Pressed inside the first seconds: let go, and he lies on.
    step(state, press);
    expect(state.skier.thrown).not.toBeNull();
    while (state.skier.thrown!.t < TUNING.crash.getUp - TUNING.dt) {
      step(state, NEUTRAL_INPUT);
      expect(mayGetUp(state.skier.thrown)).toBe(state.skier.thrown!.t >= TUNING.crash.getUp);
    }
    step(state, NEUTRAL_INPUT);
    expect(mayGetUp(state.skier.thrown)).toBe(true);
    // ...and past them it answers at once.
    step(state, press);
    expect(state.skier.thrown).toBeNull();
    expect(state.events.some((e) => e.kind === "reset" && !e.auto)).toBe(true);
  });

  it("stands a rival up off his rest, the player off the clock", () => {
    const lain = { t: TUNING.crash.lieMin, still: TUNING.crash.lieStill } as Thrown;
    expect(crashOver(lain)).toBe(true);
    expect(crashOver(lain, true)).toBe(false);
    expect(crashOver({ ...lain, t: TUNING.crash.lieFor }, true)).toBe(true);
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
        pitch: -1,
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
    // ...and how far he goes over once down: on the groomer barely, in
    // powder a little further over the hands he put out, never past his
    // back.
    expect(groomer.rolled).toBeLessThan(Math.PI / 2);
    expect(powder.rolled).toBeLessThan(Math.PI);
    expect(deep.rolled).toBeLessThan(Math.PI);
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

  it("the skis come off one by one, apart, and slide on down the pitch without bouncing or sinking", () => {
    const state = staged(PITCH, {
      x: 1500,
      z: 200,
      heading: 0,
      speed: 60 / 3.6,
      height: 2.5,
      vy: -3,
      pitch: -1.4,
    });
    const events = ride(state, 0.6, NEUTRAL_INPUT);
    expect(wipeouts(events)).toHaveLength(1);
    const b = state.skier.thrown!;
    const [left, right] = b.skis;
    // One binding let go before the other.
    expect(left.held === 0 || right.held === 0).toBe(true);
    const mid = (s: LoneSki, k: number) => (s.ends[k] + s.ends[k + 3]) / 2;
    const above = (s: LoneSki) => mid(s, 1) - state.level.groundAt(mid(s, 0), mid(s, 2));
    const landed = [false, false];
    const rise = [0, 0];
    let gap = 0;
    let buried = 0;
    for (let i = 0; i < 4 * 120 && state.skier.thrown; i++) {
      step(state, NEUTRAL_INPUT);
      b.skis.forEach((s, k) => {
        // A ski is built to rise: no end of it, and not its middle, under
        // the snow.
        for (const at of [0, s.mount, 1]) {
          const x = s.ends[3] + (s.ends[0] - s.ends[3]) * at;
          const y = s.ends[4] + (s.ends[1] - s.ends[4]) * at;
          const z = s.ends[5] + (s.ends[2] - s.ends[5]) * at;
          buried = Math.max(buried, state.level.groundAt(x, z) - y);
        }
        if (s.held === 0 && s.touching === 3) landed[k] = true;
        else if (landed[k]) rise[k] = Math.max(rise[k], above(s));
      });
      gap = Math.max(gap, Math.hypot(mid(left, 0) - mid(right, 0), mid(left, 2) - mid(right, 2)));
    }
    expect(landed).toEqual([true, true]);
    expect(buried).toBeLessThan(0.005);
    // Once it lies on the snow, a ski stays on it: nothing hands its fall
    // back.
    expect(Math.max(...rise)).toBeLessThan(0.1);
    // Not a pair any more.
    expect(gap).toBeGreaterThan(1.5);
    // A ski on its base on the groomed pitch is still on its way.
    const way = (s: LoneSki) => Math.hypot(s.ends[0] - s.last[0], s.ends[2] - s.last[2]) * 120;
    const sliding = b.skis.filter((s) => s.up[1] > 0 && way(s) > 1);
    expect(sliding.length).toBeGreaterThan(0);
  });

  it("a landing taken steep on the tips goes over them; less steep, or level, is ridden away", () => {
    const drop = (pitch: number, packed = 1): GameEvent[] =>
      ride(
        staged(flatLevel({ packed }), {
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
    const nose = wipeouts(drop(-1));
    expect(nose).toHaveLength(1);
    expect(nose[0].kind === "wipeout" && nose[0].cause).toBe("nose");
    // Forty degrees over the tips is past what a body rides away, on the
    // groomer and in loose snow alike (`crash.crooked`); at twenty-six they slap
    // down, and he saves it thrown over them.
    expect(wipeouts(drop(-0.7))).toHaveLength(1);
    expect(wipeouts(drop(-0.7, 0))).toHaveLength(1);
    const slap = drop(-0.45);
    expect(wipeouts(slap)).toHaveLength(0);
    const saved = slap.find((e) => e.kind === "save");
    expect(saved?.kind === "save" && saved.save).toBe("landing");
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

  it("coming down on his side at speed throws him; the same roll at a crawl does not", () => {
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
    // The hip and the shoulder hit the snow: he has landed on his side.
    expect(fast[0].kind === "wipeout" && fast[0].cause).toBe("landing");
    expect(wipeouts(over(10))).toHaveLength(0);
  });

  it("a fall at speed on the snow throws him once he has lain over, not before", () => {
    // Stood on the snow rolled right over: the body down at speed.
    const state = staged(undefined, { x: 1500, z: 200, heading: 0, speed: 70 / 3.6, roll: 1.4 });
    const events = ride(state, 2, TUCK);
    const fall = wipeouts(events);
    expect(fall).toHaveLength(1);
    expect(fall[0].kind === "wipeout" && ["roll", "landing"]).toContain(fall[0].cause);
  });

  it("a trunk taken on the shoulder is shrugged off; met as hard on the tips, it throws him", () => {
    // Skiing down beside the trunk and slid sideways into it: the blow
    // lands on the body's circle, past what the tips take but short of
    // what a shoulder does.
    const level = syntheticLevel();
    const tree = level.trees.find((t) => t.x === LONE_TREE.x && t.z === LONE_TREE.z)!;
    const reach = TUNING.trees.bodyRadius + tree.radius + 0.1;
    const glance = staged(level, { x: tree.x - reach, z: tree.z, heading: 0, speed: 14 });
    glance.skier.vx = 5;
    const events = ride(glance, 2, TUCK);
    const hit = events.find((e) => e.kind === "hit");
    expect(hit && hit.kind === "hit" && hit.speed).toBeGreaterThan(TUNING.crash.treeSpeed);
    expect(wipeouts(events)).toHaveLength(0);
    const saved = events.find((e) => e.kind === "save");
    expect(saved?.kind === "save" && saved.save).toBe("tree");
    expect(glance.skier.save?.side).toBe(1);
    // Straight on into it, the tips first, at a crawl past `treeSpeed`.
    const square = staged(level, { x: tree.x, z: tree.z - 2, heading: 0, speed: 8 });
    expect(wipeouts(ride(square, 2, TUCK))).toHaveLength(1);
  });

  it("a club skier goes down to what a professional rides out, and a skier between is between", () => {
    const nose = (resilience: number) =>
      wipeouts(
        ride(
          staged(
            undefined,
            { x: 1500, z: 200, heading: 0, speed: 60 / 3.6, height: 2.5, vy: -3, pitch: -0.5 },
            false,
            resilience,
          ),
          2,
          NEUTRAL_INPUT,
        ),
      );
    expect(nose(1)).toHaveLength(0);
    expect(nose(0)).toHaveLength(1);
    const pro = { ...createGame({ level: flatLevel(), quiet: true }).skier, resilience: 1 };
    const club = { ...pro, resilience: 0 };
    const mid = { ...pro, resilience: 0.5 };
    for (const key of Object.keys(TUNING.crash.club) as CrashLimit[]) {
      expect(crashLimit(pro, key), key).toBe(TUNING.crash[key]);
      expect(crashLimit(club, key), key).toBeCloseTo(TUNING.crash.club[key], 12);
      // Every club threshold is the easier one.
      expect(TUNING.crash.club[key], key).toBeLessThan(TUNING.crash[key]);
      expect(crashLimit(mid, key), key).toBeCloseTo(
        (TUNING.crash[key] + TUNING.crash.club[key]) / 2,
        12,
      );
    }
  });

  it("a caught edge at speed throws him", () => {
    // Sliding sideways across the groomer at 40 km/h with the skis stood
    // right up on their edge: the edge bites all at once.
    const state = staged(undefined, { x: 1500, z: 200, heading: Math.PI / 2, speed: 40 / 3.6 });
    state.skier.vx = 0;
    state.skier.vz = 40 / 3.6;
    state.skier.edge = TUNING.crash.catchEdge + 0.1;
    const events = ride(state, 1, { ...NEUTRAL_INPUT, steer: 1 });
    const caught = wipeouts(events);
    expect(caught).toHaveLength(1);
    expect(caught[0].kind === "wipeout" && caught[0].cause).toBe("catch");
  });

  it("on a free ride, the reset after a wipeout stands him on the nearest piste", () => {
    // No crowd: an amateur skiing into him once he is back on the piste
    // is the crowd's business, not the reset's.
    const state = createGame({ level: syntheticLevel(), mode: "free", crowd: 0, quiet: true });
    placeRun(state, { x: LONE_TREE.x + 0.3, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 });
    const events = ride(state, 10, TUCK);
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
