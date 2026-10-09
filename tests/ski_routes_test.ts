// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R42 — THE SKI ROUTES: the ORANGE grade past black, found on the finished
// mountain off a lift's top and never groomed. Held here on the corpus every
// rule suite shares: what a route is (steeper than a groomer works, no
// steeper than a couloir, never over a cliff, open of trees, off a lift's top
// and down onto a run), that nothing works its snow, that a map from before
// the routes carries none, and that the game marks, signs and starts one.
import { describe, expect, it } from "vitest";

import {
  LEVEL_RULES,
  RESORT_RULES,
  createGame,
  courseGrade,
  generateLevel,
  isRunGrade,
  pickFreeRun,
  skiRoutesOf,
  stakePlan,
  steepestAlong,
} from "@engine";
import { GRADE_LOOK } from "../pwa/src/game/grade-look.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const K = RESORT_RULES.route;
const maps = (): { seed: number; level: ReturnType<typeof levelFor> }[] =>
  LEVEL_SEEDS.map((seed) => ({ seed, level: levelFor(seed) }));

describe("R42 ski routes", () => {
  it("marks one on most of the corpus, never more than the rule allows", () => {
    const counts = maps().map(({ level }) => skiRoutesOf(level).length);
    expect(counts.filter((n) => n > 0).length).toBeGreaterThanOrEqual(LEVEL_SEEDS.length - 1);
    for (const n of counts) expect(n).toBeLessThanOrEqual(K.count.max);
  }, 240_000);

  it("is steeper than any groomed black and never a cliff", () => {
    for (const { level } of maps()) {
      for (const r of skiRoutesOf(level)) {
        expect(r.grade).toBe("orange");
        const steepest = steepestAlong(r.points, LEVEL_RULES.track.colourWindow);
        expect(steepest).toBeCloseTo(r.steepest, 9);
        expect(steepest).toBeGreaterThan(LEVEL_RULES.track.maxGrade);
        expect(steepest).toBeLessThanOrEqual(K.steepest);
        expect(steepestAlong(r.points, K.pitchWindow)).toBeLessThanOrEqual(K.cliff);
        expect(r.length).toBeGreaterThanOrEqual(K.length.min);
        expect(r.length).toBeLessThanOrEqual(K.length.max);
        expect(r.points[0].y - r.points[r.points.length - 1].y).toBeGreaterThanOrEqual(K.vertical);
      }
    }
  });

  it("leaves a chair's or gondola's top and comes down onto a run", () => {
    for (const { level } of maps()) {
      const resort = level.resort!;
      for (const r of skiRoutesOf(level)) {
        const lift = resort.lifts.find((l) => l.id === r.from);
        expect(lift?.kind === "chair" || lift?.kind === "gondola").toBe(true);
        const top = lift!.top;
        const head = r.points[0];
        expect(Math.hypot(head.x - top.x, head.z - top.z)).toBeLessThan(K.rim + K.cell);
        const run = resort.runs.find((x) => x.id === r.into.run)!;
        const foot = r.points[r.points.length - 1];
        // On its corridor: inside a station's half width, to a square.
        const off = Math.min(
          ...run.points.map((p) => Math.hypot(p.x - foot.x, p.z - foot.z) - p.width / 2),
        );
        expect(off).toBeLessThan(K.cell);
      }
    }
  });

  it("runs clear of every trunk and out from under the lifts", () => {
    for (const { level } of maps()) {
      for (const r of skiRoutesOf(level)) {
        for (const p of r.points) {
          for (const t of level.trees) {
            const d = Math.hypot(t.x - p.x, t.z - p.z) - t.radius;
            if (d < K.open - 1.5) throw new Error(`trunk ${d.toFixed(2)} m off ${r.id}`);
          }
          for (const l of level.resort!.lifts) {
            const dx = l.top.x - l.bottom.x;
            const dz = l.top.z - l.bottom.z;
            const u = Math.max(
              0,
              Math.min(
                1,
                ((p.x - l.bottom.x) * dx + (p.z - l.bottom.z) * dz) / (dx * dx + dz * dz),
              ),
            );
            const d = Math.hypot(p.x - l.bottom.x - dx * u, p.z - l.bottom.z - dz * u);
            if (d < K.lift - K.cell) throw new Error(`${r.id} ${d.toFixed(1)} m under ${l.id}`);
          }
        }
      }
    }
  });

  it("is never groomed: nothing packs its snow and no run is its line", () => {
    for (const { level } of maps()) {
      for (const r of skiRoutesOf(level)) {
        expect(level.resort!.runs.some((x) => x.id === r.id)).toBe(false);
        // The middle of the route, clear of the pad it leaves and the run it
        // comes onto, lies as the mountain left it.
        const mid = r.points.filter((p) => p.s > K.lead && p.s < r.length - K.lead);
        const packed = mid.reduce((a, p) => a + level.packedAt(p.x, p.z), 0) / mid.length;
        expect(packed).toBeLessThan(0.25);
      }
    }
  });

  it("is marked in orange stakes down both sides", () => {
    for (const { level } of maps()) {
      const plan = stakePlan(level);
      const n = plan.grade.filter((g) => g === "orange").length;
      const want = skiRoutesOf(level).reduce((a, r) => a + Math.floor(r.length / K.every), 0);
      if (want === 0) expect(n).toBe(0);
      else expect(n).toBeGreaterThan(want);
    }
  });

  it("is not marked on a map from before the routes", () => {
    const level = generateLevel(LEVEL_SEEDS[0], { version: 8 });
    expect(level.version).toBe(8);
    expect(skiRoutesOf(level)).toEqual([]);
  }, 120_000);
});

describe("the orange grade", () => {
  it("is a grade a run is asked for, raced on the black's course", () => {
    expect(isRunGrade("orange")).toBe(true);
    expect(isRunGrade("purple")).toBe(false);
    expect(courseGrade("orange")).toBe("black");
    expect(courseGrade("red")).toBe("red");
  });

  it("is signed in orange, a double diamond", () => {
    expect(GRADE_LOOK.orange.shape).toBe("double");
    expect(GRADE_LOOK.orange.paint.toLowerCase()).toBe("#f2780c");
  });

  it("picks a ski route where one is asked for, the fallback where none is", () => {
    const runs = [
      { id: "1", grade: "black" as const },
      { id: "SR1", grade: "orange" as const },
    ];
    expect(pickFreeRun(runs, { grade: "orange" }, "1")).toBe("SR1");
    expect(pickFreeRun(runs.slice(0, 1), { grade: "orange" }, "1")).toBe("1");
  });

  it("starts a free ride by lift up the lift its route leaves", () => {
    const { level } = maps().find(({ level }) => skiRoutesOf(level).length > 0)!;
    const route = skiRoutesOf(level)[0];
    const run = createGame({ level, mode: "free", byLift: true, grade: "orange" });
    expect(run.skier.lift?.id).toBe(route.from);
  });
});
