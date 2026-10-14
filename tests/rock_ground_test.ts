import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  ROCK_FIELD,
  bedrockOf,
  createGame,
  packedSnow,
  placeRun,
  regionOf,
  rockShare,
  snowGive,
  step,
  withRock,
  type GameEvent,
  type GameState,
  type Level,
} from "@engine";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";

import { regionLookOf } from "../pwa/src/game/region-look.ts";
import { DOWN } from "../pwa/src/game/rock-shapes.ts";
import { CUTS } from "../pwa/src/game/rocks.ts";
import { rockSkinOf } from "./support/rock-skin.ts";
import { levelFor } from "./support/levels.ts";

// THE ROCK UNDERFOOT (`engine/game/rock-ground.ts`): a wall's drawn rock
// skin is the surface a body meets — ridden on, hard and scraping, and a
// crash when it is driven into.

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
 * `at`, facing and driven up it at `speed`, then ridden on for `seconds` untouched. */
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
  // Driven up the WALL's own face — not along the facet he is stood on,
  // which may be a ledge's riser.
  const t = { x: -n.x * n.y, y: 1 - n.y * n.y, z: -n.z * n.y };
  const tl = Math.hypot(t.x, t.y, t.z);
  s.skier.vx = (speed * t.x) / tl;
  s.skier.vy = (speed * t.y) / tl;
  s.skier.vz = (speed * t.z) / tl;
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

  it("stands where the rock is drawn: the near cut stands on the surface ridden, a hair over at most", () => {
    const band = regionLookOf(regionOf(base).id).rock!;
    const near = CUTS[0];
    const T = ROCK_FIELD.tile;
    // The near cut of the tiles round a few walls.
    const round = spots.slice(0, 6).map((p) => [Math.floor(p.x / T) * T, Math.floor(p.z / T) * T]);
    const { mesh: m } = rockSkinOf(rocky, band.tone, near, CUTS[1], (x0, z0) =>
      round.some(([x, z]) => x === x0 && z === z0),
    );
    let checked = 0;
    let on = 0;
    let worst = 0;
    let deepest = 0;
    for (let t = 0; t < m.pos.length; t += 9) {
      const x = (m.pos[t] + m.pos[t + 3] + m.pos[t + 6]) / 3;
      const y = (m.pos[t + 1] + m.pos[t + 4] + m.pos[t + 7]) / 3;
      const z = (m.pos[t + 2] + m.pos[t + 5] + m.pos[t + 8]) / 3;
      // The skirts hung under a tile's edge, and what is under the snow.
      const same = (i: number, k: number): boolean =>
        m.pos[t + 3 * i] === m.pos[t + 3 * k] && m.pos[t + 3 * i + 2] === m.pos[t + 3 * k + 2];
      if (same(0, 1) || same(1, 2) || same(0, 2)) continue;
      if (y < base.groundAt(x, z) + 0.05) continue;
      const at = rocky.groundAt(x, z);
      worst = Math.max(worst, y - at);
      deepest = Math.max(deepest, at - y);
      if (Math.abs(at - y) < 0.01) on++;
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
    // Never over the rock met by more than the cut's tolerance, never under
    // it by more than DOWN of them, and on it (within a centimetre) nearly
    // everywhere.
    expect(worst).toBeLessThan(near.tol + 0.005);
    expect(deepest).toBeLessThan(DOWN * near.tol + 0.005);
    expect(on / checked).toBeGreaterThan(0.9);
  }, 120_000);

  it("is met wherever it is drawn, on a summer bike park's map too: no facet stands over the surface", () => {
    for (const summer of [false, true]) {
      const s = createGame({ seed: 38, mode: "free", summer, bike: summer, crowd: 0, quiet: true });
      const level = s.level;
      const band = regionLookOf(regionOf(level).id).rock!;
      const { mesh: m } = rockSkinOf(level, band.tone, CUTS[0], CUTS[1]);
      let worst = 0;
      for (let t = 0; t < m.pos.length; t += 9) {
        for (const [a, b, c] of [
          [1 / 3, 1 / 3, 1 / 3],
          [0.6, 0.2, 0.2],
          [0.2, 0.6, 0.2],
          [0.2, 0.2, 0.6],
        ]) {
          const x = a * m.pos[t] + b * m.pos[t + 3] + c * m.pos[t + 6];
          const y = a * m.pos[t + 1] + b * m.pos[t + 4] + c * m.pos[t + 7];
          const z = a * m.pos[t + 2] + b * m.pos[t + 5] + c * m.pos[t + 8];
          worst = Math.max(worst, y - level.groundAt(x, z));
        }
      }
      expect(m.pos.length).toBeGreaterThan(9000);
      expect(worst).toBeLessThan(0.02);
    }
  }, 240_000);

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
