import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  ROCKS,
  ROCK_LATTICE,
  bedrockOf,
  createGame,
  packedSnow,
  placeRun,
  regionOf,
  reliefAt,
  reliefParams,
  rockMask,
  rockShare,
  snowGive,
  step,
  withRock,
  type GameEvent,
  type GameState,
  type Level,
} from "@engine";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";

import { levelFor } from "./support/levels.ts";

// THE ROCK UNDERFOOT (`engine/game/rock-ground.ts`): a wall's rock — the
// ground reshaped by its relief (`rock-relief.ts`), as the ground draws it
// (`tests/rock_drawn_test.ts`) — is the surface a body meets: ridden on,
// hard and scraping, and a crash when it is driven into.

const base = levelFor(38);
const rocky = withRock(base);

/** Bare wall spots well inside the map, a few dozen. */
function wallSpots(level: Level): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let z = 300; z < level.size - 300; z += 61) {
    for (let x = 300; x < level.size - 300; x += 61) {
      if (rockShare(level, x, z) > 0.9) out.push({ x, z });
    }
  }
  return out;
}
const spots = wallSpots(base);

/** A free ride on the map, its player stood `back` m down the wall from
 * `at`, facing up it at `speed`, then ridden on for `seconds` untouched. */
function intoWall(at: { x: number; z: number }, back: number, speed: number, seconds: number) {
  const s = createGame({ level: base, mode: "free", crowd: 0, quiet: true });
  const n = { x: 0, y: 1, z: 0 };
  base.normalAt(at.x, at.z, n);
  const l = Math.hypot(n.x, n.z);
  placeRun(s, {
    x: at.x + (n.x / l) * back,
    z: at.z + (n.z / l) * back,
    heading: Math.atan2(-n.x, -n.z),
    speed,
  });
  const events: GameEvent[] = [];
  let fastest = 0;
  for (let k = 0; k < seconds * 120; k++) {
    step(s, { ...NEUTRAL_INPUT });
    events.push(...s.events);
    const b = s.skier.thrown;
    fastest = Math.max(fastest, s.skier.speed, b ? Math.hypot(b.vx, b.vy, b.vz) : 0);
  }
  return { s, events, fastest };
}

const rockFalls = (events: GameEvent[]): number =>
  events.filter((e) => e.kind === "wipeout" && e.cause === "rock").length;

describe("the rock underfoot", () => {
  it("is laid on every free ride on a rocky region's map, over the map itself", () => {
    expect(regionOf(base).rock).toBe(true);
    const s = createGame({ level: base, mode: "free", crowd: 0, quiet: true });
    expect(s.level.rockAt).toBeDefined();
    expect(bedrockOf(s.level)).toBe(base);
    expect(withRock(base)).toBe(rocky);
    expect(withRock(rocky)).toBe(rocky);
    expect(spots.length).toBeGreaterThan(8);
  });

  it("is the ground reshaped by the rock's relief, as much as it is rock", () => {
    const p = reliefParams(base);
    let checked = 0;
    let shaped = 0;
    for (const at of spots.slice(0, 12)) {
      for (let dz = -6; dz <= 6; dz += 0.7) {
        for (let dx = -6; dx <= 6; dx += 0.7) {
          // A corner of the lattice the rock is laid on (between them it
          // is laid flat, as the ground's mesh draws it).
          const x = Math.round((at.x + dx) / ROCK_LATTICE) * ROCK_LATTICE;
          const z = Math.round((at.z + dz) / ROCK_LATTICE) * ROCK_LATTICE;
          const m = rockMask(base, x, z);
          const y = base.groundAt(x, z);
          expect(rocky.groundAt(x, z)).toBeCloseTo(y + (m > 0 ? m * reliefAt(p, x, z, y) : 0), 9);
          expect(rocky.rockAt!(x, z)).toBeCloseTo(m, 9);
          checked++;
          if (Math.abs(rocky.groundAt(x, z) - y) > 0.3) shaped++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    // Most of a wall stands out of or is cut into the ground.
    expect(shaped / checked).toBeGreaterThan(0.4);
  });

  it("is one surface with no step in it: a body never meets an edge it cannot ride over", () => {
    // Along lines down and across the walls every 5 cm, the surface never
    // rises or drops faster than a near-vertical riser's (a riser where a
    // joint shifts the beds stands near 85°; a step would be thousands).
    let worst = 0;
    for (const at of spots.slice(0, 12)) {
      for (const [ux, uz] of [
        [1, 0],
        [0, 1],
        [0.6, 0.8],
      ]) {
        let last = rocky.groundAt(at.x - 15 * ux, at.z - 15 * uz);
        for (let t = -15 + 0.05; t <= 15; t += 0.05) {
          const y = rocky.groundAt(at.x + t * ux, at.z + t * uz);
          worst = Math.max(worst, Math.abs(y - last) / 0.05);
          last = y;
        }
      }
    }
    expect(worst).toBeLessThan(25);
  });

  it("holds the snow on its ledges: bare where its facet is steep, not where it faces the sky", () => {
    let ledges = 0;
    let bare = 0;
    const n = { x: 0, y: 1, z: 0 };
    for (const at of spots) {
      for (let k = 0; k < 40; k++) {
        const x = at.x + ((k * 37) % 13) - 6;
        const z = at.z + ((k * 53) % 11) - 5;
        const on = rocky.rockAt!(x, z);
        if (on < 0.99) continue;
        rocky.normalAt(x, z, n);
        const b = rocky.bareRockAt!(x, z);
        if (n.y > ROCKS.skin.holds) {
          expect(b).toBe(0);
          ledges++;
        }
        if (n.y < ROCKS.skin.slides) {
          expect(b).toBeCloseTo(1, 9);
          bare++;
        }
      }
    }
    expect(ledges).toBeGreaterThan(20);
    expect(bare).toBeGreaterThan(20);
  });

  it("leaves the snow alone: off the walls the ground is the map's", () => {
    for (let k = 0; k < base.track.points.length; k += 37) {
      const p = base.track.points[k];
      expect(rocky.groundAt(p.x, p.z)).toBe(base.groundAt(p.x, p.z));
      expect(rocky.rockAt!(p.x, p.z)).toBe(0);
    }
  });

  it("is hard and scraping: nothing sinks into bare rock, and a blow on it is a crag's", () => {
    const s = createGame({ level: base, mode: "free", crowd: 0, quiet: true, snowDepth: 2 });
    let bare = 0;
    for (const p of spots) {
      if ((s.level.bareRockAt!(p.x, p.z) ?? 0) < 0.9) continue;
      bare++;
      expect(packedSnow(s, p.x, p.z)).toBe(1);
      expect(snowGive(s, p.x, p.z)).toBeLessThan(0.006);
    }
    expect(bare).toBeGreaterThan(4);
  });

  it("throws a skier who drives up a wall of it fast, and lets one ride it slowly", () => {
    let fast = 0;
    let slow = 0;
    const tried = spots.slice(0, 8);
    for (const p of tried) {
      const run = intoWall(p, 3, 20, 2);
      fast += rockFalls(run.events) > 0 ? 1 : 0;
      // ...and thrown against it, never flung off it faster than he came:
      // a body or a ski put back out of a steep facet is a position fixed.
      expect(run.fastest).toBeLessThan(25);
      slow += rockFalls(intoWall(p, 3, 5, 2).events);
    }
    expect(fast).toBeGreaterThanOrEqual(tried.length - 2);
    expect(slow).toBe(0);
  });

  it("throws the snowmobile's rider driven into it, and not one crawling at it", () => {
    const sledInto = (p: { x: number; z: number }, speed: number): GameState => {
      const s = createGame({ level: base, mode: "free", sled: true, crowd: 0, quiet: true });
      const k = s.sled!;
      const n = { x: 0, y: 1, z: 0 };
      base.normalAt(p.x, p.z, n);
      const l = Math.hypot(n.x, n.z);
      const heading = Math.atan2(-n.x, -n.z);
      k.x = p.x + (n.x / l) * 8;
      k.z = p.z + (n.z / l) * 8;
      k.y = s.level.groundAt(k.x, k.z) + 0.6;
      k.heading = heading;
      k.q = fromEuler(heading, 0, 0);
      k.vx = Math.sin(heading) * speed;
      k.vz = Math.cos(heading) * speed;
      k.vy = 0;
      return s;
    };
    let thrown = 0;
    for (const p of spots.slice(0, 8)) {
      const s = sledInto(p, 16);
      for (let i = 0; i < 360; i++) {
        step(s, { ...NEUTRAL_INPUT, tuck: 1 });
        if (s.events.some((e) => e.kind === "sled" && e.phase === "crash")) {
          thrown++;
          break;
        }
      }
    }
    expect(thrown).toBeGreaterThanOrEqual(4);
  });
});
