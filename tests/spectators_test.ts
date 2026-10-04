// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPECTATORS' PLAN (`pwa/src/game/spectator-plan.ts`): who watches a
// race and where they stand — numerous, varied, off the piste and clear
// of the trunks, most of them round the finish, on the inside of a turn,
// dealt the same every time off the map's seed and never moving the map.

import { describe, expect, it } from "vitest";
import { MODE_RULES, GAME_MODES, levelDigest, nearestTrackPoint, type Level } from "@engine";

import {
  FAN_HATS,
  FAN_STYLES,
  FANS,
  hasSpectators,
  planSpectators,
  turns,
  type SpectatorPlan,
} from "../pwa/src/game/spectator-plan.ts";
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
