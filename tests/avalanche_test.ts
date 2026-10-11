// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE (`avalanche.ts`): only on a free ride that asked for it, and
// nothing of it in a run that did not; a slab only on a steep, open, loaded
// slope — more on the lee — never on a groomed run, a gentle one or in the
// woods; the flow at rest on the flat; a skier out of its flank escaped,
// one stopped on it caught, carried and buried, the reset held while he
// lies under it and his air running out on the survival curve; every draw
// off its own stream, so a run replays and no race moves.

import { describe, expect, it } from "vitest";

import {
  AVALANCHE,
  AVALANCHE_CELL,
  NEUTRAL_INPUT,
  avalancheHazard,
  avalancheHolds,
  createGame,
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

  it("caught, he is thrown, held buried, and stood up once his air is out", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x, z: LEE.slab, heading: Math.PI / 2, speed: 0 });
    releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    const seen: GameEvent[] = [];
    let held = 0;
    for (let i = 0; i < 120 * 160; i++) {
      step(s, { ...NEUTRAL_INPUT, brake: 1 });
      for (const e of s.events) if (e.kind === "avalanche" || e.kind === "wipeout") seen.push(e);
      if (s.avalanche!.victim?.phase === "buried") {
        held++;
        expect(s.skier.thrown).not.toBeNull();
        expect(avalancheHolds(s)).toBe(true);
      }
      if (seen.some((e) => e.kind === "avalanche" && e.phase === "lost") && !s.skier.thrown) break;
    }
    const phases = seen.map((e) =>
      e.kind === "avalanche" ? e.phase : e.kind === "wipeout" ? `wipeout:${e.cause}` : e.kind,
    );
    expect(phases).toContain("wipeout:avalanche");
    expect(phases).toContain("caught");
    expect(phases).toContain("buried");
    expect(phases).toContain("lost");
    const buried = seen.find((e) => e.kind === "avalanche" && e.phase === "buried");
    expect(buried && buried.kind === "avalanche" && buried.depth).toBeGreaterThanOrEqual(
      AVALANCHE.headFree,
    );
    // Held under the snow for the air he was dealt — far past the lie of
    // an ordinary fall.
    expect(held / 120).toBeGreaterThan(10);
    expect(s.skier.thrown).toBeNull();
    expect(s.avalanche!.victim).toBeNull();
  });

  it("a reset takes him out of it", () => {
    const s = avalancheRide();
    placeRun(s, { x: LEE.x, z: LEE.slab, heading: Math.PI / 2, speed: 0 });
    releaseAvalanche(s, s.avalanche!, LEE.x, LEE.slab, []);
    for (let i = 0; i < 120 * 40 && s.avalanche!.victim?.phase !== "buried"; i++) {
      step(s, { ...NEUTRAL_INPUT, brake: 1 });
    }
    expect(s.avalanche!.victim?.phase).toBe("buried");
    step(s, { ...NEUTRAL_INPUT, reset: true });
    step(s, NEUTRAL_INPUT);
    expect(s.skier.thrown).toBeNull();
    expect(s.avalanche!.victim).toBeNull();
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
