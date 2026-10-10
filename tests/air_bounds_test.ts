// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRBORNE EDGE (`collision.ts`'s `airBounds` / `airBoundsAt`,
// `defs/air-bounds.ts`): every craft in the air — the plane, the
// helicopter, the paramotor and the balloon — flown at the map's edge is
// blown back in by the bounds' wind and has its pilot's hand turned toward
// the middle, and none of them leaves the map. Nothing is a wall.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  TUNING,
  airBounds,
  airBoundsAt,
  balloonPilot,
  balloonTrim,
  createGame,
  pilotInput,
  planeAloft,
  planeHold,
  step,
  type AirBounds,
  type GameState,
  type SkierInput,
} from "@engine";

import { flatLevel } from "./support/synthetic.ts";
import { levelFor } from "./support/levels.ts";

const B = TUNING.bounds.air;
const out = (): AirBounds => ({ depth: 0, wx: 0, wz: 0, heading: 0 });

function run(
  s: GameState,
  seconds: number,
  input: (s: GameState) => SkierInput,
  each: () => void,
): void {
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) {
    step(s, input(s));
    each();
  }
}

describe("the airborne edge (airBounds)", () => {
  const level = { size: 3000 };

  it("is nothing in the middle and grows into a wind blowing straight back in", () => {
    expect(airBounds(level, 1500, 1500, 200, out()).depth).toBe(0);
    const mid = airBounds(level, 100, 1500, 200, out());
    expect(mid.depth).toBeCloseTo(0.5);
    expect(mid.wx).toBeCloseTo(B.wind / 4);
    expect(mid.wz).toBe(0);
    const edge = airBounds(level, 2999.999, 1500, 200, out());
    expect(edge.depth).toBeCloseTo(1, 3);
    expect(edge.wx).toBeCloseTo(-B.wind, 1);
    // Past the edge it grows on, but only so far.
    const past = airBounds(level, -2000, 1500, 200, out());
    expect(past.depth).toBe(2);
    expect(past.wx).toBeCloseTo(4 * B.wind);
  });

  it("blows diagonally in off a corner and points the hand at the middle", () => {
    const c = airBounds(level, 50, 50, 200, out());
    expect(c.wx).toBeGreaterThan(0);
    expect(c.wz).toBeCloseTo(c.wx);
    expect(c.heading).toBeCloseTo(Math.PI / 4);
  });

  it("is not felt near the snow, and is whole a safe turn's height up", () => {
    expect(airBoundsAt(level, 50, 1500, B.low, 200, out()).depth).toBe(0);
    expect(airBoundsAt(level, 50, 1500, B.high, 200, out()).depth).toBeCloseTo(0.75);
    const half = airBoundsAt(level, 50, 1500, (B.low + B.high) / 2, 200, out());
    expect(half.depth).toBeCloseTo(0.375);
  });
});

describe("every craft in the air is turned back from the edge", () => {
  it("the plane, flown at the edge and held toward it", () => {
    const SIZE = 4000;
    const s = createGame({
      level: flatLevel({ size: SIZE }),
      mode: "free",
      plane: true,
      crowd: 0,
      quiet: true,
    });
    planeAloft(s, {
      x: SIZE - B.plane - 300,
      y: 300,
      z: SIZE / 2,
      heading: Math.PI / 2,
      speed: 50,
      power: 0.8,
    });
    const p = s.plane!;
    let nearest = SIZE;
    let back = false;
    run(
      s,
      90,
      (st) => ({
        ...NEUTRAL_INPUT,
        plane: planeHold(st, { heading: Math.PI / 2, height: 300, speed: 50, flaps: 0 }),
      }),
      () => {
        nearest = Math.min(nearest, SIZE - p.x, p.x, SIZE - p.z, p.z);
        if (p.vx < 0) back = true;
      },
    );
    expect(p.mode).toBe("flown");
    expect(back).toBe(true);
    expect(nearest).toBeGreaterThan(0);
  });

  it("the helicopter, its pilot aimed off the map", () => {
    const level = levelFor(1);
    const s = createGame({ level, mode: "free", heli: true, crowd: 0, quiet: true });
    const h = s.heli!;
    run(
      s,
      25,
      (st) => pilotInput(st, { x: h.x, z: h.z, height: 160 }),
      () => {},
    );
    // Carried over to a stretch of the map's edge, the same height up.
    const dx = 700 - h.x;
    h.x += dx;
    s.skier.x += dx;
    h.y = level.groundAt(h.x, h.z) + 160;
    const z = h.z;
    let nearest = level.size;
    run(
      s,
      60,
      (st) => pilotInput(st, { x: -2000, z, height: 160 }),
      () => {
        nearest = Math.min(nearest, h.x);
      },
    );
    expect(s.skier.thrown).toBeNull();
    expect(nearest).toBeGreaterThan(0);
    expect(nearest).toBeLessThan(700 - 50);
  });

  it("the paramotor, flown straight at the edge", () => {
    const level = flatLevel({
      grade: 0.3,
      slopeFrom: 120,
      runOut: { at: 1500, bend: 300 },
      packed: 1,
    });
    const s = createGame({ level, mode: "free", para: true, crowd: 0, quiet: true });
    const tuck = { ...NEUTRAL_INPUT, tuck: 1 };
    run(
      s,
      25,
      () => tuck,
      () => {},
    );
    const p = s.para!;
    expect(p.flying).toBe(true);
    // Carried on along its heading till it is a band and a bit off the edge.
    const ux = Math.sin(p.heading);
    const uz = Math.cos(p.heading);
    const reach = (e: number, u: number): number =>
      u > 1e-3 ? (level.size - e) / u : u < -1e-3 ? -e / u : Infinity;
    const toEdge = Math.min(reach(p.x, ux), reach(p.z, uz)) - (B.para + 120);
    for (const o of [p, s.skier]) {
      o.x += ux * toEdge;
      o.z += uz * toEdge;
    }
    let nearest = level.size;
    run(
      s,
      45,
      () => tuck,
      () => {
        nearest = Math.min(nearest, p.x, p.z, level.size - p.x, level.size - p.z);
      },
    );
    expect(s.skier.thrown).toBeNull();
    expect(nearest).toBeGreaterThan(0);
  });

  it("the balloon, drifting out over the edge", () => {
    const level = flatLevel({ grade: 0.3, slopeFrom: 300, runOut: { at: 2600, bend: 150 } });
    const s = createGame({ level, mode: "free", balloon: true, crowd: 0, quiet: true });
    const b = s.balloon!;
    b.mode = "flown";
    b.grounded = false;
    const dx = 60 - b.x;
    b.x += dx;
    s.skier.x += dx;
    b.y = level.groundAt(b.x, b.z) + 200;
    b.vx = -3;
    b.vz = 0;
    b.vy = 0;
    b.temp = balloonTrim(s, b);
    let nearest = level.size;
    run(
      s,
      60,
      (st) => balloonPilot(st),
      () => {
        nearest = Math.min(nearest, b.x);
      },
    );
    expect(nearest).toBeGreaterThan(0);
    expect(b.x).toBeGreaterThan(60);
  });
});
