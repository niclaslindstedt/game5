// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE BENCHMARK RUNS — the plan, as data.
//
// Its own module because it is a TABLE and the thing that reads it is a
// render loop: `benchmark.ts` reaches for a canvas and a WebGL context, and
// this has to be readable without either — by the card that reports a run
// (`menu-bench.tsx`), by the rig that stands the race up (`bench-run.ts`),
// and above all by `tests/benchmark_test.ts`, which is where the choices
// below are held to something.
//
// Every field is PINNED rather than read off the skier: a measurement that
// moved with whichever skis somebody last rode, or whichever map the level
// card last picked, would be a number that only compares to itself. The one
// thing deliberately left free is OPTIONS ▸ PICTURE — the whole use of the
// tool is running it twice with one row moved — which is what obliges the
// map, the sky and the stretch below to be ones where every row can show.

import {
  generateLevel,
  type GameMode,
  type GeneratorVersion,
  type Level,
  type RegionId,
  type SkyOverride,
} from "@engine";

import type { CameraRung } from "./renderer-api.ts";

export type BenchmarkPlan = {
  /** THE MAP. Seed 20 in the MARITIME (R21) on generator v1 (`version`),
   * because of what its first thirty seconds ski through: the maritime is
   * the one country wooded nearly to the summit — in the alpine the tree
   * line stands at about half the vertical, so no seed's first thirty
   * seconds out of the start hut ever see a trunk — and on this seed the
   * piste runs out of the start into the WOODS (thirteen trunks within
   * 40 m of the leader on the mean reading, the most of the thirty seeds
   * swept with a flight in the stretch) and the bot takes a KICKER inside
   * it, so it carries the forest's draw, a flight, the landing's puff and
   * the grooves of four skiers. `tests/benchmark_test.ts` skis it
   * headlessly and holds both. A generator version that moves the map owes
   * the sweep again, and the report names the version and the region
   * (`plannedRows`) so two runs either side of one are never read as the
   * same race. */
  seed: number;
  /** The kind of snow country the seed is raised in (R21) — pinned with
   * the seed, because the same seed in another region is another map. */
  region: RegionId;
  /** WHICH GENERATOR builds it (`versions.ts`) — pinned like a campaign
   * map's, so the race a score was taken on is the race every later build
   * takes it on: v1, the generator before the grades (R23), which is the
   * map the sweep above chose and the one the history's scores stand on.
   * A graded map re-rolls the seed, and a sweep of the graded ones found
   * none with both the woods and a flight in its first thirty seconds. */
  version: GeneratorVersion;
  /** THE RACE, because it is the heaviest thing the game does: four skis
   * drawn, and — the part no screenshot shows — four whole runs stepped at
   * 120 Hz, each ridden by the bot deciding on every step. A benchmark that
   * rode alone would be reporting the renderer and calling it the game. */
  mode: GameMode;
  /** The view. CHASE is what a skier actually rides, which makes the score a
   * statement about playing the game rather than about a camera nobody uses. */
  camera: CameraRung;
  /** THE SKY, pinned over whatever R19 dealt the seed: FAIR cumulus under a
   * late-morning sun. Daylight, because at night the woods go into the dark
   * and the haze and a row like FOREST would read as free; fair rather than
   * clear, because the dome's cloud is a per-pixel cost every frame pays;
   * and not falling snow or fog, which close the view before the far woods
   * and would make DISTANCE read as free. The sun stands at that hour for
   * the whole run (`clock.ts`). */
  sky: Required<Pick<SkyOverride, "weather" | "hour">>;
  /** Seconds of game each rendered frame advances. A sixtieth divides the
   * engine's step exactly (`TUNING.physicsHz` is 120), so a frame is a whole
   * number of steps with nothing carried — the race is the same race every
   * time it is run. */
  step: number;
  /** Frames MEASURED, after the warm-up: thirty seconds of racing at the
   * step above — the start, the woods, the kicker and the run out of it. */
  frames: number;
};

export const BENCHMARK: BenchmarkPlan = {
  seed: 20,
  region: "maritime",
  version: 1,
  mode: "race",
  camera: "chase",
  sky: { weather: "fair", hour: 11 },
  step: 1 / 60,
  frames: 1800,
};

/** THE BENCHMARK'S MAP, built on its own version in its own country. */
export function benchmarkLevel(plan: BenchmarkPlan = BENCHMARK): Level {
  return generateLevel(plan.seed, { region: plan.region, version: plan.version });
}

/** How long the measured stretch is, s — the plan's own arithmetic, so the
 * developer page's row and the card's billing never disagree about it. */
export function benchmarkSeconds(plan: BenchmarkPlan = BENCHMARK): number {
  return plan.frames * plan.step;
}

/** The pinned dials, as the report and the history write them down: a run
 * from another build is only comparable if it says what it was pinned to. */
export function plannedRows(plan: BenchmarkPlan = BENCHMARK): { label: string; value: string }[] {
  return [
    { label: "seed", value: String(plan.seed) },
    { label: "region", value: plan.region },
    { label: "generator", value: `v${plan.version}` },
    { label: "mode", value: plan.mode },
    { label: "camera", value: plan.camera },
    { label: "sky", value: `${plan.sky.weather} ${plan.sky.hour}h` },
    { label: "frames", value: `${plan.frames} × ${Math.round(1 / plan.step)} Hz` },
  ];
}
