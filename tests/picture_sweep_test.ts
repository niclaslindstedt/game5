// The picture sweep: a deal that keeps every row's stops balanced and apart,
// and a fit that reads a known price list back out of noisy, drifting
// blocks (`pwa/src/game/picture-sweep.ts`).

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { describe, expect, it } from "vitest";

import {
  SWEEP,
  dealSweep,
  fitSweep,
  readSweeps,
  sweepCosts,
  sweepLines,
  sweptPrices,
  type SweepBlock,
  type SweepPicture,
  type SweepResult,
} from "../pwa/src/game/picture-sweep.ts";
import type { Level } from "@engine";

import {
  BENCH_SCENE_IDS,
  benchScene,
  isBenchScene,
  sceneHour,
  sceneSky,
} from "../pwa/src/game/bench-scenes.ts";
import { BENCHMARK } from "../pwa/src/game/benchmark-plan.ts";
import { PICTURE_PRICES } from "../pwa/src/game/picture-fit.ts";
import { PICTURE_LADDERS, PICTURE_ROWS } from "../pwa/src/game/settings-video.ts";

const cost = (picture: SweepPicture): number =>
  PICTURE_ROWS.reduce(
    (s, row) =>
      s + (PICTURE_PRICES[row] as Record<string, { cost: number }>)[picture[row] as string].cost,
    0,
  );

/** A machine whose frame IS the price list, on a floor of 4 ms, warming up
 * through the run, dearer in the second half of the race loop, with noise
 * and the odd hitch. */
function sweepOf(blocks: number, seed = 1): SweepBlock[] {
  const rng = createRng(seed);
  return dealSweep(blocks).map((picture, i) => {
    const t = (i / blocks) * 600;
    const loop = ((i * SWEEP.blockFrames) % SWEEP.loopFrames) / SWEEP.loopFrames;
    const drift = 4 + 1.5 * (t / 600) + (loop > 0.5 ? 0.6 : 0);
    const hitch = i % 97 === 13 ? 25 : 0;
    const noise = (rng.next() - 0.5) * 0.3;
    const wall = drift + cost(picture) + noise + hitch;
    return { picture, wall, cpu: wall * 0.4, frames: 28, at: t, loop };
  });
}

describe("the picture sweep", () => {
  it("deals every stop of every row equally often", () => {
    const pictures = dealSweep(SWEEP.blocks);
    expect(pictures).toHaveLength(SWEEP.blocks);
    for (const row of PICTURE_ROWS) {
      const ladder = PICTURE_LADDERS[row] as readonly string[];
      const counts = ladder.map((stop) => pictures.filter((p) => p[row] === stop).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
    expect(dealSweep(40, 9)).toEqual(dealSweep(40, 9));
  });

  it("keeps two rows apart", () => {
    const pictures = dealSweep(SWEEP.blocks);
    const same = pictures.filter((p) => p.terrain === p.forest).length / pictures.length;
    // Independent three-stop rows agree a third of the time.
    expect(same).toBeGreaterThan(0.2);
    expect(same).toBeLessThan(0.47);
  });

  it("reads the price list back out of drifting, noisy blocks", () => {
    const fit = fitSweep(sweepOf(SWEEP.blocks));
    expect(fit.dropped).toBeGreaterThan(0);
    for (const row of PICTURE_ROWS) {
      for (const [stop, price] of Object.entries(
        PICTURE_PRICES[row] as Record<string, { cost: number }>,
      )) {
        expect(Math.abs(fit.rows[row][stop].ms - price.cost)).toBeLessThan(0.12);
      }
    }
    expect(fit.residualMs).toBeLessThan(0.2);
    expect(fit.r2).toBeGreaterThan(0.95);
  });

  it("prices at the dearest view, levelled up each ladder", () => {
    const race = fitSweep(sweepOf(SWEEP.blocks, 2));
    const vista = structuredClone(race);
    vista.rows.distance.max.ms = 3;
    vista.rows.terrain.medium.ms = -0.4;
    const wrap = (wall: typeof race, view: "race" | "vista"): SweepResult => ({
      plan: SWEEP,
      width: 1920,
      height: 1080,
      view,
      wall,
      cpu: wall,
      blocks: [],
    });
    const { costs, floorMs } = sweepCosts([wrap(race, "race"), wrap(vista, "vista")]);
    expect(costs.distance.max).toBe(3);
    expect(floorMs).toBeGreaterThan(4);
    for (const row of PICTURE_ROWS) {
      const ladder = PICTURE_LADDERS[row] as readonly string[];
      expect(costs[row][ladder[0]]).toBe(0);
      for (let i = 1; i < ladder.length; i++) {
        expect(costs[row][ladder[i]]).toBeGreaterThanOrEqual(costs[row][ladder[i - 1]]);
      }
    }
    const prices = sweptPrices(costs);
    expect(prices.distance.max).toEqual({ cost: 3, benefit: PICTURE_PRICES.distance.max.benefit });
  });

  it("is read back off a report", () => {
    const blocks = sweepOf(80, 3);
    const result: SweepResult = {
      plan: { ...SWEEP, blocks: 80 },
      width: 1280,
      height: 720,
      view: "race",
      wall: fitSweep(blocks, "wall"),
      cpu: fitSweep(blocks, "cpu"),
      blocks,
    };
    const text = ["BENCHMARK — a report", ...sweepLines(result), "trailing"].join("\n");
    expect(readSweeps(text)).toEqual([JSON.parse(JSON.stringify(result))]);
    expect(readSweeps("nothing here")).toEqual([]);
  });
});

describe("the benchmark's scenes", () => {
  const level = { sun: { hour: 11, dayOfYear: 40, latitude: 47 } } as unknown as Level;

  it("stands each scene under its own calm sky", () => {
    expect(BENCH_SCENE_IDS).toEqual(["race", "vista", "sunset", "night", "snow"]);
    expect(sceneSky(benchScene("race"), level)).toEqual({
      weather: { kind: BENCHMARK.sky.weather.kind, wind: 0 },
      hour: BENCHMARK.sky.hour,
    });
    const sunset = sceneHour(benchScene("sunset"), level);
    const night = sceneHour(benchScene("night"), level);
    expect(sunset).toBeGreaterThan(15);
    expect(night).toBeGreaterThan(sunset);
    expect(sceneSky(benchScene("snow"), level).weather).toEqual({ kind: "snow", wind: 0 });
    expect(isBenchScene("night")).toBe(true);
    expect(isBenchScene("noon")).toBe(false);
  });
});
