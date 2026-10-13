// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE (`avalanche.ts`): only on a free ride that asked for it, and
// nothing of it in a run that did not; a slab only on a steep, open, loaded
// slope — more on the lee — never on a groomed run, a gentle one or in the
// woods; the flow at rest on the flat; a skier out of its flank escaped,
// one stopped on it caught, carried a few seconds and buried — gone, the
// BURIED card up and the run started again, the reset held till then; the
// survival curve the others' burials keep; every draw
// off its own stream, so a run replays and no race moves.

import { describe, expect, it } from "vitest";

import {
  AVALANCHE,
  AVALANCHE_CELL,
  NEUTRAL_INPUT,
  avalancheHazard,
  avalancheHolds,
  createGame,
  debrisDepth,
  placeRun,
  releaseAvalanche,
  step,
  survivalMinutes,
  type GameEvent,
  type GameState,
  type Level,
} from "@engine";
import {
  AVALANCHE_LINES,
  LEE,
  avalancheRide,
  leeLevel,
  lineOk,
  rideLine,
} from "./support/avalanche-scenes.ts";
import { flatLevel, syntheticLevel } from "./support/synthetic.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";
import { readParams, overLink } from "../pwa/src/game/url-params.ts";
import { freeGameOptions, freshRide } from "../pwa/src/game/free-ride.ts";
import { SKIS, FULL_ASSIST } from "@engine";
import { RESTART_AFTER } from "../pwa/src/game/settings.ts";
import { buriedOf, deathOver, diedOf } from "../pwa/src/game/hud-wreck.ts";
import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { OVER_SNOW, lensGround } from "../pwa/src/game/camera-buried.ts";

const line = (id: string) => AVALANCHE_LINES.find((l) => l.id === id)!;

/** Every step's position and the run's events, folded into one number. */
function trace(state: GameState, steps: number): number {
  let h = 0;
  for (let i = 0; i < steps; i++) {
    step(state, { ...NEUTRAL_INPUT, tuck: 0.4, steer: i % 400 < 200 ? 0.3 : -0.3 });
    const c = state.skier;
    h = (h * 31 + Math.round(c.x * 1000) + Math.round(c.z * 1000) * 7) % 2147483647;
    h = (h + state.events.length) % 2147483647;
  }
  return h;
}

describe("only on a free ride that asked", () => {
  it("is absent from a race, a free ride not asking, and every rule but the free ride's", () => {
    const level = leeLevel();
    const race = createGame({ level, quiet: true, avalanche: true });
    expect(race.avalanche).toBeUndefined();
    expect(race.rules.avalanche).toBeUndefined();
    const free = createGame({ level, mode: "free", quiet: true, crowd: 0 });
    expect(free.avalanche).toBeUndefined();
    expect(free.rules.avalanche).toBeUndefined();
    expect("avalanche" in free).toBe(false);
    const asked = avalancheRide(level);
    expect(asked.avalanche).toBeDefined();
    expect(asked.rules.avalanche).toBe(true);
  });

  it("moves no race: a run that asked for it skis the same steps as one that did not", () => {
    const a = createGame({ level: syntheticLevel(), quiet: true, avalanche: true });
    const b = createGame({ level: syntheticLevel(), quiet: true });
    expect(trace(a, 1200)).toBe(trace(b, 1200));
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it("draws nothing from the run's own stream on a free ride", () => {
    const on = avalancheRide(leeLevel(), true);
    const off = avalancheRide(leeLevel(), false);
    placeRun(on, { x: 150, z: LEE.slab, heading: Math.PI / 2, speed: 10 });
    placeRun(off, { x: 150, z: LEE.slab, heading: Math.PI / 2, speed: 10 });
    for (let i = 0; i < 240; i++) {
      step(on, NEUTRAL_INPUT);
      step(off, NEUTRAL_INPUT);
    }
    expect(on.rng.next()).toBe(off.rng.next());
  });

  it("replays exactly: the same ride lets the same slab go at the same step", () => {
    const run = (): string => {
      const s = avalancheRide();
      placeRun(s, { x: 150, z: LEE.slab, heading: Math.PI / 2, speed: 12 });
      const seen: string[] = [];
      for (let i = 0; i < 120 * 40; i++) {
        step(s, { ...NEUTRAL_INPUT, tuck: 0.4 });
        for (const e of s.events) if (e.kind === "avalanche") seen.push(`${s.tick}:${e.phase}`);
      }
      return `${seen.join(",")}|${s.skier.x.toFixed(6)},${s.skier.z.toFixed(6)}`;
    };
    expect(run()).toBe(run());
  });
});

describe("the hazard", () => {
  const load = 0.5;

  it("lies on a steep, open lee slope and not on the flat below it", () => {
    const level = leeLevel();
    expect(avalancheHazard(level, load, LEE.x, LEE.slab)).toBeGreaterThan(0.3);
    expect(avalancheHazard(level, load, LEE.x, LEE.ease + LEE.bend + 100)).toBe(0);
    expect(avalancheHazard(level, load, LEE.x, LEE.from - 100)).toBe(0);
  });

  it("is none on a 20° slope, on a groomed run or in the woods", () => {
    const gentle = flatLevel({
      packed: 0,
      size: 1200,
      grade: Math.tan((20 * Math.PI) / 180),
      slopeFrom: 0,
    });
    expect(avalancheHazard({ ...gentle, weather: leeLevel().weather }, load, 600, 400)).toBe(0);
    const groomed = flatLevel({ packed: 1, size: 1200, grade: LEE.grade, slopeFrom: 0 });
    expect(avalancheHazard({ ...groomed, weather: leeLevel().weather }, load, 600, 400)).toBe(0);
    const woods: Level = leeLevel();
    woods.trees = [];
    for (let i = 0; i < 6; i++) {
      const x = LEE.x + Math.cos(i) * 4;
      const z = LEE.slab + Math.sin(i) * 4;
      woods.trees.push({ x, z, y: woods.groundAt(x, z), height: 15, radius: 0.3, crown: 2.5 });
    }
    expect(avalancheHazard(woods, load, LEE.x, LEE.slab)).toBe(0);
  });

  it("is more on the lee than across the wind, and grows with the load", () => {
    const lee = leeLevel();
    const across: Level = { ...lee, weather: { ...lee.weather!, windFrom: -Math.PI / 2 } };
    const onLee = avalancheHazard(lee, load, LEE.x, LEE.slab);
    const onCross = avalancheHazard(across, load, LEE.x, LEE.slab);
    expect(onLee).toBeGreaterThan(onCross * 2);
    expect(onCross).toBeGreaterThan(0);
    expect(avalancheHazard(lee, 0.8, LEE.x, LEE.slab)).toBeGreaterThan(
      avalancheHazard(lee, 0.2, LEE.x, LEE.slab),
    );
  });

  it("never lets a groomed steep run go, however far it is skied", () => {
    const groomed = flatLevel({ packed: 1, size: 1200, grade: LEE.grade, slopeFrom: 300 });
    const level: Level = { ...groomed, weather: leeLevel().weather };
    const s = avalancheRide(level);
    placeRun(s, { x: 100, z: 380, heading: Math.PI / 2, speed: 12 });
    for (let i = 0; i < 120 * 40; i++) {
      step(s, { ...NEUTRAL_INPUT, tuck: 0.4 });
      expect(s.events.some((e) => e.kind === "avalanche")).toBe(false);
    }
  });

  it("lets the loaded face go under a skier traversing it", () => {
    const r = rideLine(line("trigger"), 90);
    expect(r.outcome).toBe("released");
  });
});

describe("the flow", () => {
  it("runs to tens of metres a second and comes to rest on the flat", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x + 300, z: 200, heading: 0, speed: 0 });
    const slide = releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    expect(slide.count).toBeLessThanOrEqual(AVALANCHE.cells);
    for (let i = 0; i < 120 * AVALANCHE.runMost && slide.running; i++) step(s, NEUTRAL_INPUT);
    expect(slide.running).toBe(false);
    expect(slide.t).toBeLessThan(AVALANCHE.runMost);
    expect(slide.top).toBeGreaterThan(15);
    // Every parcel at rest below the steep, none off the map.
    const c = slide.cells;
    for (let k = 0; k < c.length; k += AVALANCHE_CELL.stride) {
      expect(c[k + AVALANCHE_CELL.run]).toBe(0);
      expect(c[k + AVALANCHE_CELL.z]).toBeGreaterThan(LEE.ease - 40);
      expect(c[k + AVALANCHE_CELL.z]).toBeLessThan(1200);
    }
  });

  it("does not let the same slope go twice", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x, z: LEE.slab, heading: Math.PI / 2, speed: 8 });
    releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    s.avalanche!.rng.chance = () => true;
    s.avalanche!.quiet = 0;
    s.avalanche!.slide!.running = false;
    for (let i = 0; i < 120; i++) {
      step(s, NEUTRAL_INPUT);
      expect(s.events.some((e) => e.kind === "avalanche" && e.phase === "release")).toBe(false);
    }
  });
});

describe("the skier in it", () => {
  for (const l of AVALANCHE_LINES.filter((x) => x.release)) {
    it(`${l.id}: ${l.what} — ${l.wants}`, () => {
      expect(lineOk(l, rideLine(l))).toBe(true);
    });
  }

  it("caught, he is carried a few seconds, buried, and held past the app's longest restart", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x, z: LEE.slab, heading: Math.PI / 2, speed: 0 });
    releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    const seen: GameEvent[] = [];
    let caughtAt = -1;
    let buriedAt = -1;
    let held = 0;
    for (let i = 0; i < 120 * 60; i++) {
      step(s, { ...NEUTRAL_INPUT, brake: 1 });
      for (const e of s.events) {
        if (e.kind === "avalanche" || e.kind === "wipeout") seen.push(e);
        if (e.kind === "avalanche" && e.phase === "caught") caughtAt = s.t;
        if (e.kind === "avalanche" && e.phase === "buried") buriedAt = s.t;
      }
      const v = s.avalanche!.victim;
      if (v?.phase === "lost" && v.t < AVALANCHE.lostFor) {
        held++;
        expect(s.skier.thrown).not.toBeNull();
        expect(avalancheHolds(s)).toBe(true);
      }
      if (buriedAt >= 0 && !s.skier.thrown) break;
    }
    const phases = seen.map((e) =>
      e.kind === "avalanche" ? e.phase : e.kind === "wipeout" ? `wipeout:${e.cause}` : e.kind,
    );
    expect(phases).toContain("wipeout:avalanche");
    expect(phases).toContain("caught");
    expect(phases).not.toContain("surfaced");
    const buried = seen.find((e) => e.kind === "avalanche" && e.phase === "buried");
    expect(buried && buried.kind === "avalanche" && buried.depth).toBeGreaterThanOrEqual(
      AVALANCHE.buriedLeast,
    );
    // Swept along a few seconds, never longer than the snow takes to close.
    expect(buriedAt - caughtAt).toBeGreaterThan(0.5);
    expect(buriedAt - caughtAt).toBeLessThanOrEqual(AVALANCHE.carryMost + 0.01);
    // Held under the snow until the app's longest RESTART AFTER has run.
    expect(AVALANCHE.lostFor).toBeGreaterThanOrEqual(RESTART_AFTER.max);
    expect(held / 120).toBeGreaterThanOrEqual(AVALANCHE.lostFor - 0.1);
    expect(s.skier.thrown).toBeNull();
    expect(s.avalanche!.victim).toBeNull();
  });

  it("a reset takes him out of it", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x, z: LEE.slab, heading: Math.PI / 2, speed: 0 });
    releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    for (let i = 0; i < 120 * 40 && s.avalanche!.victim?.phase !== "lost"; i++) {
      step(s, { ...NEUTRAL_INPUT, brake: 1 });
    }
    expect(s.avalanche!.victim?.phase).toBe("lost");
    step(s, { ...NEUTRAL_INPUT, reset: true });
    step(s, NEUTRAL_INPUT);
    expect(s.skier.thrown).toBeNull();
    expect(s.avalanche!.victim).toBeNull();
  });
});

describe("taken INTO the snow", () => {
  /** Step until the slide has him buried, keeping how far the body's middle
   * ever rose over the snow's top while it carried him (past the first
   * half second, the throw's own). */
  function ride(s: GameState, input = NEUTRAL_INPUT, seconds = 30) {
    let caught = -1;
    let buried = -1;
    let over = -Infinity;
    for (let i = 0; i < 120 * seconds && buried < 0; i++) {
      step(s, input);
      for (const e of s.events) {
        if (e.kind !== "avalanche") continue;
        if (e.phase === "caught") caught = s.t;
        if (e.phase === "buried") buried = s.t;
      }
      const b = s.skier.thrown;
      const slide = s.avalanche!.slide;
      if (b && slide && s.avalanche!.victim?.phase === "carried" && s.t - caught > 0.5) {
        over = Math.max(over, b.y - s.level.groundAt(b.x, b.z) - debrisDepth(slide, b.x, b.z));
      }
    }
    return { caught, buried, over };
  }

  it("carried, he rides down in the snow and is never thrown up out of it", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x, z: LEE.slab, heading: Math.PI / 2, speed: 0 });
    releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    const r = ride(s, { ...NEUTRAL_INPUT, brake: 1 });
    expect(r.caught).toBeGreaterThan(0);
    expect(r.buried).toBeGreaterThan(r.caught);
    expect(r.over).toBeLessThan(0.5);
  });

  it("while it has him, every lens stands over the snow, never inside its blocks", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x, z: LEE.slab, heading: Math.PI / 2, speed: 0 });
    const slide = releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    expect(lensGround(s, s.level.groundAt)).toBe(s.level.groundAt);
    for (let i = 0; i < 120 * 10 && s.avalanche!.victim?.phase !== "carried"; i++) {
      step(s, { ...NEUTRAL_INPUT, brake: 1 });
    }
    const b = s.skier.thrown!;
    const over = lensGround(s, s.level.groundAt);
    const want = s.level.groundAt(b.x, b.z) + debrisDepth(slide, b.x, b.z) + OVER_SNOW;
    expect(over(b.x, b.z)).toBeCloseTo(want, 6);
  });

  it("skied into the running flow from above, he is taken and buried", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x, z: LEE.slab - 60, heading: 0, speed: 20 });
    releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    const r = ride(s, { ...NEUTRAL_INPUT, tuck: 1 });
    expect(r.caught).toBeGreaterThan(0);
    expect(r.buried).toBeGreaterThan(r.caught);
    expect(r.over).toBeLessThan(0.5);
  });

  it("skied into its debris at rest, he is taken and buried there", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x + 300, z: 200, heading: Math.PI / 2, speed: 0 });
    const slide = releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    for (let i = 0; i < 120 * AVALANCHE.runMost && slide.running; i++) {
      step(s, { ...NEUTRAL_INPUT, brake: 1 });
    }
    expect(slide.running).toBe(false);
    expect(s.avalanche!.victim).toBeNull();
    // The deepest of the deposit, skied into from above at 60 km/h.
    const c = slide.cells;
    let at = { x: 0, z: 0, d: 0 };
    for (let k = 0; k < c.length; k += AVALANCHE_CELL.stride) {
      const x = c[k + AVALANCHE_CELL.x];
      const z = c[k + AVALANCHE_CELL.z];
      const d = debrisDepth(slide, x, z);
      if (d > at.d) at = { x, z, d };
    }
    expect(at.d).toBeGreaterThan(AVALANCHE.engulf);
    placeRun(s, { x: at.x, z: at.z - 40, heading: 0, speed: 17 });
    const r = ride(s, { ...NEUTRAL_INPUT, tuck: 1 }, 10);
    expect(r.caught).toBeGreaterThan(0);
    expect(r.buried).toBeGreaterThan(r.caught);
  });
});

describe("the BURIED card", () => {
  it("comes up on every run, the injuries off too, and starts the run again", () => {
    const s = avalancheRide();
    expect(s.gore).toBeUndefined();
    placeRun(s, { x: LEE.x, z: LEE.slab, heading: Math.PI / 2, speed: 0 });
    releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    for (let i = 0; i < 120 * 40 && s.avalanche!.victim?.phase !== "carried"; i++) {
      step(s, { ...NEUTRAL_INPUT, brake: 1 });
    }
    // Carried, he is not dead yet: the lens follows him in the snow.
    expect(buriedOf(s)).toBeNull();
    expect(takeSnapshot(s).died).toBeNull();
    for (let i = 0; i < 120 * 40 && s.avalanche!.victim?.phase !== "lost"; i++) {
      step(s, NEUTRAL_INPUT);
    }
    for (let i = 0; i < 240; i++) step(s, NEUTRAL_INPUT);
    expect(buriedOf(s)).toBeCloseTo(2, 1);
    expect(diedOf(s)).toBeCloseTo(2, 1);
    expect(takeSnapshot(s).died?.cause).toBe("smothered");
    expect(deathOver(s, 5)).toBe(false);
    for (let i = 0; i < 120 * 3.1; i++) step(s, NEUTRAL_INPUT);
    expect(deathOver(s, 5)).toBe(true);
    expect(STRINGS.buriedWord).toBe("BURIED");
  });
});

describe("the survival curve", () => {
  it("reads the burial statistics: 91 % at 18 min, 34 % at 35", () => {
    expect(survivalMinutes(0.91, 1)).toBeCloseTo(18, 5);
    expect(survivalMinutes(0.34, 1)).toBeCloseTo(35, 5);
    expect(survivalMinutes(0.5, 1)).toBeGreaterThan(18);
    expect(survivalMinutes(0.5, 1)).toBeLessThan(35);
  });

  it("is shorter the deeper he lies", () => {
    expect(survivalMinutes(0.5, 2)).toBeLessThan(survivalMinutes(0.5, 1));
    expect(survivalMinutes(0.5, 0.5)).toBe(survivalMinutes(0.5, 1));
  });
});

describe("the app's side", () => {
  it("says a release, a catch, a burial, an escape and a lost skier", () => {
    const s = avalancheRide();
    const ev = (phase: string, depth = 0): GameEvent =>
      ({ kind: "avalanche", t: 1, phase, id: 1, x: 0, z: 0, size: 900, depth }) as GameEvent;
    for (const p of ["release", "caught", "buried", "surfaced", "escaped", "lost"]) {
      expect(newsFor(ev(p, 1.2), s)).not.toBeNull();
    }
    expect(newsFor(ev("stopped"), s)).toBeNull();
    expect(newsFor(ev("freed"), s)).toBeNull();
    expect(
      newsFor({ kind: "wipeout", t: 1, cause: "avalanche", speed: 9, x: 0, z: 0 }, s),
    ).toBeNull();
  });

  it("asks for avalanches on every free ride, and a link turns them off", () => {
    const opts = freeGameOptions(freshRide(), 7, { spec: SKIS, assist: FULL_ASSIST }, () => 0.9);
    expect(opts.avalanche).toBe(true);
    expect(readParams("?avalanche=0").avalanche).toBe(false);
    expect(readParams("?avalanche=1").avalanche).toBe(true);
    expect(readParams("").avalanche).toBeNull();
    expect(overLink(opts, readParams("?avalanche=0")).avalanche).toBe(false);
    expect(overLink(opts, readParams("")).avalanche).toBe(true);
  });
});
