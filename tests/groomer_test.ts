// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINES (`engine/game/groomer.ts`): a free ride's night
// groomers out on the ski area's runs — out only when asked and after dark,
// dealt off a stream of their own so nothing else a ride draws moves, laying
// a swath behind the tiller that the physics reads as packed snow
// (`groomed.ts`, `snow.ts`'s `packedSnow`), taken on the machine press and
// driven, and — skied into — knocking the skier down onto a body that takes
// the blow (`body.ts`).

import { describe, expect, it } from "vitest";
import {
  GROOMER,
  NEUTRAL_INPUT,
  createGame,
  groomSegment,
  freshGroomed,
  groomedFresh,
  groomersOut,
  groomerWithin,
  packedSnow,
  packedUnder,
  placeRun,
  severityOf,
  step,
  sunAtRun,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);
const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });

function ride(groomer: "on" | "off" | "night" = "on"): GameState {
  return createGame({ level, mode: "free", groomer, crowd: 0, quiet: true });
}

function run(s: GameState, seconds: number, input: SkierInput, out: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(s, input);
    out.push(...s.events);
  }
  return out;
}

/** The first machine stopped where it works, the skier stood `off` m to
 * its left beside the cab. */
function parked(off = 4.6): GameState {
  const s = ride();
  const g = s.groomers![0];
  g.mode = "parked";
  g.speed = 0;
  placeRun(s, {
    x: g.x - Math.cos(g.heading) * off,
    z: g.z + Math.sin(g.heading) * off,
    heading: g.heading,
  });
  return s;
}

describe("when the machines are out", () => {
  it("never unless asked; always on `on`; after dark on `night`", () => {
    expect(groomersOut(level, undefined)).toBe(false);
    expect(groomersOut(level, "off")).toBe(false);
    expect(groomersOut(level, "on")).toBe(true);
    expect(groomersOut(level, "night")).toBe(sunAtRun(level).elevation < GROOMER.night);
  });

  it("puts up to `GROOMER.count` on a free ride, and none on any other run", () => {
    const s = ride();
    expect(s.groomers!.length).toBeGreaterThan(0);
    expect(s.groomers!.length).toBeLessThanOrEqual(GROOMER.count);
    expect(ride("off").groomers).toBeUndefined();
    const trial = createGame({ level, mode: "timeTrial", groomer: "on", quiet: true });
    expect(trial.groomers).toBeUndefined();
  });

  it("comes with a part of the night's work done: a swath laid and its snow groomed", () => {
    const s = ride();
    for (const g of s.groomers!) expect(g.swath.length).toBeGreaterThan(8);
    expect(s.groomed!.cells.size).toBeGreaterThan(50);
  });
});

describe("the machines' stream", () => {
  it("draws nothing off the run's own: the stream and the skier are as a ride without them", () => {
    const a = ride("off");
    const b = ride("on");
    expect(JSON.stringify(b.rng)).toBe(JSON.stringify(a.rng));
    expect(b.skier.x).toBe(a.skier.x);
    expect(b.skier.z).toBe(a.skier.z);
  });

  it("deals the same machines on the same runs, and works them the same, twice", () => {
    const a = ride();
    const b = ride();
    run(a, 3, NEUTRAL_INPUT);
    run(b, 3, NEUTRAL_INPUT);
    expect(JSON.stringify(a.groomers)).toBe(JSON.stringify(b.groomers));
  });
});

describe("the swath", () => {
  it("is laid as the machine works on, and the snow under it groomed", () => {
    const s = ride();
    const g = s.groomers![0];
    const laid = g.swath.length;
    const cells = s.groomed!.cells.size;
    run(s, 20, NEUTRAL_INPUT);
    expect(g.swath.length).toBeGreaterThan(laid);
    expect(s.groomed!.cells.size).toBeGreaterThan(cells);
    const n = g.swath.length;
    expect(groomedFresh(s.groomed!, g.swath[n - 2], g.swath[n - 1])).toBeDefined();
  });

  it("grooms the cells whose middles the tiller covers, at the new snow there was", () => {
    const grid = freshGroomed();
    groomSegment(grid, 10, 10, 30, 10, 2.75, 0.04);
    expect(groomedFresh(grid, 20, 10)).toBe(0.04);
    expect(groomedFresh(grid, 20, 11.5)).toBe(0.04);
    expect(groomedFresh(grid, 20, 16)).toBeUndefined();
  });

  it("is packed through under the physics, carrying only what has fallen since", () => {
    const s = ride();
    const g = s.groomers![0];
    const x = g.swath[0];
    const z = g.swath[1];
    const at = groomedFresh(s.groomed!, x, z)!;
    s.fresh = at + 0.02;
    expect(packedSnow(s, x, z)).toBeCloseTo(packedUnder(1, 0.02), 9);
    // Off the swath — far off the map's runs — the map's own field under the
    // whole fall, as a ride with no machines reads it.
    const bare = { ...s, groomed: undefined };
    expect(packedSnow(s, 3, 3)).toBe(packedSnow(bare, 3, 3));
    expect(packedSnow(bare, x, z)).toBe(packedUnder(level.packedAt(x, z), s.fresh));
  });
});

describe("taken on the machine press", () => {
  it("is offered beside the cab and not from afar", () => {
    expect(groomerWithin(parked())).not.toBeNull();
    expect(groomerWithin(parked(12))).toBeNull();
  });

  it("puts him in the cab, drives on his controls, and lets him down again", () => {
    const s = parked();
    const g = s.groomers![0];
    const events: GameEvent[] = [];
    run(s, 1 / 120, ask({ machine: true }), events);
    expect(g.rider).toBe(true);
    expect(events.some((e) => e.kind === "groomer" && e.phase === "board")).toBe(true);
    const x0 = g.x;
    const z0 = g.z;
    run(s, 4, ask({ tuck: 1 }));
    expect(Math.hypot(g.x - x0, g.z - z0)).toBeGreaterThan(5);
    expect(g.speed).toBeGreaterThan(2);
    expect(g.tiller).toBe(true);
    // He rides in the cab, moving with it.
    expect(Math.hypot(s.skier.x - g.x, s.skier.z - g.z)).toBeLessThan(2);
    run(s, 1 / 120, ask({ machine: true }), events);
    expect(g.rider).toBe(false);
    expect(g.mode).toBe("parked");
    expect(events.some((e) => e.kind === "groomer" && e.phase === "hop")).toBe(true);
    expect(s.skier.thrown).toBeNull();
  });
});

describe("skied into", () => {
  it("knocks him down hard: the `groomer` cause and a body badly hurt", () => {
    const s = parked();
    const g = s.groomers![0];
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    placeRun(s, { x: g.x + fx * 12, z: g.z + fz * 12, heading: g.heading + Math.PI, speed: 13 });
    const events = run(s, 2, NEUTRAL_INPUT);
    expect(events.some((e) => e.kind === "groomer" && e.phase === "strike")).toBe(true);
    expect(s.skier.thrown?.cause).toBe("groomer");
    expect(severityOf(s.skier.body)).toBeGreaterThanOrEqual(25);
  });

  it("only holds him off when he leans on it at a shuffle", () => {
    const s = parked(GROOMER.half + 0.6);
    const g = s.groomers![0];
    placeRun(s, {
      x: g.x - Math.cos(g.heading) * (GROOMER.half + 0.6),
      z: g.z + Math.sin(g.heading) * (GROOMER.half + 0.6),
      heading: g.heading + Math.PI / 2,
      speed: 1.2,
    });
    const events = run(s, 1, NEUTRAL_INPUT);
    expect(s.skier.thrown).toBeNull();
    expect(events.some((e) => e.kind === "groomer" && e.phase === "strike")).toBe(false);
  });
});
