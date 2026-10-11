// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING STADIUM AS PLANNED (`ski-jump-arena-plan.ts`) AND ITS
// CROWD (`spectator-jump.ts`): the grandstands down both sides of the
// out-run and the terraces across its foot outside the landing area's
// walls, the back boards across the out-run's end with the exit in them,
// the arena's masts outside the walls, the crowd up the landing hill behind
// its nets and nobody on the in-run or the landing area — dealt the same
// every time, inside the budget, and never moving the map.

import { describe, expect, it } from "vitest";

import { levelDigest, setSkiJump } from "@engine";
import { jumpArenaPlan, SJ_ARENA } from "../pwa/src/game/ski-jump-arena-plan.ts";
import { landingWidth } from "../pwa/src/game/ski-jump-frame.ts";
import { FANS, planSpectators } from "../pwa/src/game/spectator-plan.ts";
import { JUMP_FANS } from "../pwa/src/game/spectator-jump.ts";
import { levelFor } from "./support/levels.ts";

const level = setSkiJump(levelFor(1));
const hill = level.skiJump!;
const arena = jumpArenaPlan(level)!;
const f = arena.frame;
const crowd = planSpectators(level);
const local = (x: number, z: number) => ({
  d: (x - f.x) * f.fx + (z - f.z) * f.fz,
  a: (x - f.x) * f.rx + (z - f.z) * f.rz,
});

describe("the ski jumping stadium's plan", () => {
  it("is null on a map with no hill, and kept per map", () => {
    expect(jumpArenaPlan(levelFor(1))).toBeNull();
    expect(jumpArenaPlan(level)).toBe(arena);
  });

  it("stands two grandstands down the out-run's sides and two terraces past its end", () => {
    expect(arena.stands).toHaveLength(4);
    const half = landingWidth(hill, hill.u) / 2;
    for (const s of arena.stands.slice(0, 2)) {
      const p = local(s.x, s.z);
      expect(Math.abs(p.a)).toBeGreaterThan(half + 2);
      expect(p.d).toBeGreaterThan(hill.u - SJ_ARENA.side.above - 1);
    }
    for (const s of arena.stands.slice(2)) {
      expect(local(s.x, s.z).d).toBeGreaterThan(hill.outrun + SJ_ARENA.bank.from);
    }
  });

  it("closes the out-run's end with the back boards, the exit gate in them", () => {
    const boards = arena.fences.filter((fe) => fe.kind === "board");
    expect(boards).toHaveLength(2);
    for (const b of boards)
      for (const p of b.points) expect(local(p.x, p.z).d).toBeCloseTo(hill.outrun, 6);
    expect(arena.arena.exit).toBeDefined();
  });

  it("raises the arena's masts outside the walls", () => {
    expect(arena.masts.length).toBeGreaterThanOrEqual(4);
    for (const m of arena.masts) {
      const p = local(m.x, m.z);
      expect(Math.abs(p.a)).toBeGreaterThan(landingWidth(hill, Math.min(p.d, hill.u)) / 2 + 2);
      expect(m.lamps.length).toBeGreaterThan(0);
    }
  });
});

describe("the ski jumping crowd", () => {
  it("is dealt the same every time, inside the budget, and leaves the map alone", () => {
    const before = levelDigest(level);
    const again = planSpectators(level);
    expect(again.fans).toEqual(crowd.fans);
    expect(levelDigest(level)).toBe(before);
    expect(crowd.fans.length).toBeGreaterThan(2500);
    expect(crowd.fans.length).toBeLessThanOrEqual(FANS.cap);
  });

  it("packs the stands and lines the landing hill, with the coaches on their platforms", () => {
    const by = (k: string) => crowd.fans.filter((fan) => fan.kind === k).length;
    expect(by("stand") + by("back")).toBeGreaterThan(crowd.fans.length / 2);
    expect(by("finish")).toBeGreaterThan(300);
    expect(by("start")).toBe(2 * JUMP_FANS.coaches);
    expect(crowd.fences.some((fe) => fe.kind === "net")).toBe(true);
  });

  it("puts nobody on the in-run, the landing area or the out-run", () => {
    const astray = crowd.fans.filter((fan) => {
      if (fan.kind === "start") return false;
      const p = local(fan.x, fan.z);
      if (p.d <= hill.edge) return true;
      return p.d < hill.outrun && Math.abs(p.a) <= landingWidth(hill, Math.min(p.d, hill.u)) / 2;
    });
    expect(astray).toHaveLength(0);
  });

  it("keeps every fan clear of the trunks", () => {
    // The trunks near the stadium only, then the nearest to each fan.
    const xs = crowd.fans.map((fan) => fan.x);
    const zs = crowd.fans.map((fan) => fan.z);
    const [x0, x1, z0, z1] = [
      Math.min(...xs) - 2,
      Math.max(...xs) + 2,
      Math.min(...zs) - 2,
      Math.max(...zs) + 2,
    ];
    const near = level.trees.filter((t) => t.x > x0 && t.x < x1 && t.z > z0 && t.z < z1);
    let least = Infinity;
    for (const fan of crowd.fans)
      for (const t of near) least = Math.min(least, (t.x - fan.x) ** 2 + (t.z - fan.z) ** 2);
    expect(Math.sqrt(least)).toBeGreaterThan(0.5);
  });
});
