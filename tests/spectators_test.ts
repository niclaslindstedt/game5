// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPECTATORS' PLAN (`pwa/src/game/spectator-plan.ts`): who watches a
// race and where they stand — numerous, varied, off the piste and clear
// of the trunks, most of them round the finish, on the inside of a turn,
// dealt the same every time off the map's seed and never moving the map.

import { describe, expect, it } from "vitest";
import {
  createGame,
  MODE_RULES,
  GAME_MODES,
  levelDigest,
  nearestTrackPoint,
  type Level,
} from "@engine";

import {
  FAN_HATS,
  FAN_STYLES,
  FANS,
  hasSpectators,
  NETS,
  netStretch,
  planSpectators,
  turns,
  type SpectatorPlan,
} from "../pwa/src/game/spectator-plan.ts";
import { combinations, SLALOM_FANS } from "../pwa/src/game/spectator-slalom.ts";
import { startHousePlan } from "../pwa/src/game/start-house-plan.ts";
import { levelFor, LEVEL_SEEDS } from "./support/levels.ts";

const SEEDS = LEVEL_SEEDS.slice(0, 3);
const plans = new Map<number, SpectatorPlan>();
const planFor = (seed: number): SpectatorPlan => {
  let p = plans.get(seed);
  if (!p) {
    p = planSpectators(levelFor(seed) as Level);
    plans.set(seed, p);
  }
  return p;
};

describe("who gets a crowd", () => {
  it("every mode with something to watch, and never the free ride", () => {
    for (const mode of GAME_MODES) {
      expect(hasSpectators(MODE_RULES[mode](1)), mode).toBe(mode !== "free");
    }
  });
});

describe("the spectators' plan", () => {
  it("is dealt the same every time, and leaves the map as it found it", () => {
    const level = levelFor(SEEDS[0]) as Level;
    const before = levelDigest(level);
    const a = planSpectators(level);
    const b = planSpectators(level);
    expect(b.fans).toEqual(a.fans);
    expect(b.stands).toEqual(a.stands);
    expect(levelDigest(level)).toBe(before);
  });

  it("is numerous and inside its budget", () => {
    for (const seed of SEEDS) {
      const n = planFor(seed).fans.length;
      expect(n, `seed ${seed}`).toBeGreaterThan(2000);
      expect(n, `seed ${seed}`).toBeLessThanOrEqual(FANS.cap);
    }
  });

  it("stands most of them round the finish, in its stands and on its slope", () => {
    for (const seed of SEEDS) {
      const p = planFor(seed);
      const arena = p.fans.filter((f) => f.arena).length;
      expect(arena / p.fans.length, `seed ${seed}`).toBeGreaterThan(0.4);
      expect(p.stands.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(p.arena, `seed ${seed}`).not.toBeNull();
    }
  });

  it("keeps every standing fan behind the fence and clear of the trunks", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed) as Level;
      const points = level.track.points;
      for (const f of planFor(seed).fans) {
        if (f.kind === "stand" || f.kind === "back") continue;
        const hit = nearestTrackPoint(level, f.x, f.z);
        if (hit.s < level.track.length) {
          expect(hit.distance, `seed ${seed} ${f.kind}`).toBeGreaterThanOrEqual(
            points[hit.index].width / 2 + FANS.fence,
          );
        }
        for (const t of level.trees) {
          if (Math.abs(t.x - f.x) > 2 || Math.abs(t.z - f.z) > 2) continue;
          expect(Math.hypot(t.x - f.x, t.z - f.z)).toBeGreaterThanOrEqual(FANS.trunk);
        }
      }
    }
  });

  it("puts a crowd at a hard turn on its inside", () => {
    let seen = 0;
    for (const seed of SEEDS) {
      const level = levelFor(seed) as Level;
      const bends = turns(level.track.points);
      const p = planFor(seed);
      for (const b of p.banks.filter((k) => k.kind === "turn")) {
        const hit = nearestTrackPoint(level, b.x, b.z);
        const bend = bends.reduce((best, t) =>
          Math.abs(t.s - hit.s) < Math.abs(best.s - hit.s) ? t : best,
        );
        expect(Math.sign(hit.lateral), `seed ${seed} at ${hit.s.toFixed(0)} m`).toBe(
          Math.sign(bend.bend),
        );
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("deals a varied crowd: every style, every hat, children, many colours", () => {
    const fans = SEEDS.flatMap((s) => planFor(s).fans);
    const styles = new Set(fans.map((f) => f.style));
    const hats = new Set(fans.map((f) => f.hat));
    expect(styles.size).toBe(FAN_STYLES.length);
    expect(hats.size).toBe(FAN_HATS.length);
    expect(fans.some((f) => f.height < 1.45)).toBe(true);
    expect(new Set(fans.map((f) => f.dress[0])).size).toBeGreaterThanOrEqual(8);
  });

  it("stands the spectator fence two metres or more behind the safety nets", () => {
    expect(FANS.fence - NETS.out).toBeGreaterThanOrEqual(2);
  });

  it("parts the fans into banks that hold every one of them once", () => {
    for (const seed of SEEDS) {
      const p = planFor(seed);
      let next = 0;
      for (const [i, b] of p.banks.entries()) {
        expect(b.from).toBe(next);
        for (let k = b.from; k < b.to; k++) expect(p.fans[k].bank).toBe(i);
        next = b.to;
      }
      expect(next).toBe(p.fans.length);
    }
  });
});

describe("a slalom's audience", () => {
  const SLALOMS = [38, 7].map((seed) => {
    const level = createGame({ seed, mode: "slalom", quiet: true }).level;
    return { seed, level, plan: planSpectators(level) };
  });
  const ARENA = new Set(["stand", "back"]);

  it("is numerous, inside its budget, and keeps the finish arena", () => {
    for (const { seed, plan } of SLALOMS) {
      expect(plan.fans.length, `seed ${seed}`).toBeGreaterThan(2000);
      expect(plan.fans.length, `seed ${seed}`).toBeLessThanOrEqual(FANS.cap);
      expect(plan.arena, `seed ${seed}`).not.toBeNull();
      expect(plan.banks.some((b) => b.kind === "jump" || b.kind === "line")).toBe(false);
    }
  });

  it("stands nobody on the course or inside its nets, and nobody in the run-out", () => {
    for (const { seed, level, plan } of SLALOMS) {
      const finish = level.checkpoints[level.checkpoints.length - 1];
      const nets = netStretch(level, finish);
      expect(nets.from).toBe(level.slalom!.from - 2);
      for (const f of plan.fans) {
        if (ARENA.has(f.kind)) continue;
        const hit = nearestTrackPoint(level, f.x, f.z);
        const out = hit.distance - level.track.points[hit.index].width / 2;
        if (hit.s >= nets.from && hit.s <= nets.to) {
          expect(out, `seed ${seed} ${f.kind} at ${hit.s.toFixed(0)} m`).toBeGreaterThanOrEqual(
            NETS.out + 2,
          );
        }
        if (f.kind !== "start") {
          expect(hit.s, `seed ${seed} ${f.kind}`).toBeLessThanOrEqual(finish.s);
        }
      }
    }
  });

  it("is thick at the finish, thin at the start, and thicker down the course", () => {
    for (const { seed, level, plan } of SLALOMS) {
      const start = level.checkpoints[0];
      const finish = level.checkpoints[level.checkpoints.length - 1];
      const within = (p: { x: number; z: number }, r: number) =>
        plan.fans.filter((f) => Math.hypot(f.x - p.x, f.z - p.z) < r).length;
      expect(within(finish, 120), `seed ${seed}`).toBeGreaterThan(10 * within(start, 120));
      // The top and the bottom three tenths of the course, the arena aside.
      const third = 0.3 * (finish.s - start.s);
      let upper = 0;
      let lower = 0;
      for (const f of plan.fans) {
        if (ARENA.has(f.kind)) continue;
        const s = nearestTrackPoint(level, f.x, f.z).s;
        if (s < start.s + third) upper++;
        else if (s > finish.s - third) lower++;
      }
      expect(lower, `seed ${seed}`).toBeGreaterThan(4 * upper);
    }
  });

  it("lines both sides of the course, and crowds its combinations on both", () => {
    for (const { seed, level, plan } of SLALOMS) {
      const sides = [0, 0];
      for (const f of plan.fans) {
        if (ARENA.has(f.kind) || f.kind === "start") continue;
        sides[nearestTrackPoint(level, f.x, f.z).lateral > 0 ? 1 : 0]++;
      }
      const all = sides[0] + sides[1];
      expect(Math.min(...sides) / all, `seed ${seed}`).toBeGreaterThan(0.3);
      if (combinations(level).length === 0) continue;
      const combo = new Set(
        plan.banks
          .filter((b) => b.kind === "combo")
          .map((b) => Math.sign(nearestTrackPoint(level, b.x, b.z).lateral)),
      );
      expect(combo.size, `seed ${seed}`).toBe(2);
    }
  });

  it("keeps a few by the start house, never in front of its door", () => {
    for (const { seed, level, plan } of SLALOMS) {
      const house = startHousePlan(level)!;
      const knot = plan.fans.filter((f) => f.kind === "start");
      expect(knot.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(knot.length, `seed ${seed}`).toBeLessThanOrEqual(SLALOM_FANS.start.count);
      for (const f of knot) {
        const along = (f.x - house.x) * house.fx + (f.z - house.z) * house.fz;
        expect(along, `seed ${seed}`).toBeLessThan(0);
      }
    }
  });
});
