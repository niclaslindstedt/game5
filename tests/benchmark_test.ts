// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEVELOPER PAGE AND THE BENCHMARK, held without a browser: the pinned
// race and the stretch it rides, the score and its lines, the report and
// the history, the hold that lets the page out, the frame-rate readout, the
// REPRO line read back as a URL, the physics readouts, the free camera and
// the campaign's board set by hand.
import { describe, expect, it } from "vitest";

import {
  RACE,
  TUNING,
  botInput,
  createGame,
  step,
  sunAtRun,
  weatherOf,
  type GameState,
} from "@engine";

import {
  BENCHMARK,
  benchmarkLevel,
  benchmarkSeconds,
  plannedRows,
} from "../pwa/src/game/benchmark-plan.ts";
import {
  INDEX_REAL,
  SAMPLE_EVERY,
  benchIndex,
  benchPlot,
  fpsOfIndex,
  indexOfFps,
  type BenchSample,
} from "../pwa/src/game/benchmark-index.ts";
import {
  benchmarkReport,
  median,
  HIDEABLE,
  noCost,
  noGpu,
  noMachine,
  noTotals,
  pictureRows,
  type BenchmarkRun,
  type FramePhases,
  type RunTotals,
} from "../pwa/src/game/benchmark-report.ts";
import {
  RUNS_KEPT,
  benchmarkSheet,
  keptWith,
  mergeBenchmarks,
  recordOf,
  type BenchmarkRecord,
} from "../pwa/src/game/benchmark-history.ts";
import { NO_HOLD, holdWait, tickHold } from "../pwa/src/game/menu-hold.ts";
import { FPS_STALL_MS, smoothFps } from "../pwa/src/game/frame-rate.ts";
import { physicsOf, readPose, reproOf, reproQuery } from "../pwa/src/game/debug-readout.ts";
import { flyLens, flyLook, flyStep, FLY, NO_KEYS } from "../pwa/src/game/free-fly.ts";
import { lockShelves, unlockRows, unlockShelves } from "../pwa/src/game/campaign-unlocks.ts";
import {
  EMPTY_PROGRESS,
  SHELVES,
  levelCleared,
  mergeProgress,
  recordRun,
  shelfUnlocked,
  shelfWon,
} from "../pwa/src/game/campaign.ts";
import { DEFAULT_VIDEO } from "../pwa/src/game/settings-video.ts";
import { DEV_HOLD_MS, freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

/** The pinned race, ridden headlessly exactly as the pump rides it: the
 * lights, then the measured frames, a whole number of steps each. */
function rideBenchmark(): { state: GameState; airs: number; treesNear: number } {
  const state = createGame({
    seed: BENCHMARK.seed,
    level: benchmarkLevel(),
    sky: BENCHMARK.sky,
    quiet: true,
  });
  const steps = Math.round((state.rules.countdown + benchmarkSeconds()) / TUNING.dt);
  let airs = 0;
  let near = 0;
  let samples = 0;
  for (let i = 0; i < steps; i++) {
    step(state, botInput(state));
    for (const e of state.events) if (e.kind === "air") airs += 1;
    if (i % 60 === 0 && state.phase !== "countdown") {
      const s = state.skier;
      samples += 1;
      for (const t of state.level.trees)
        if ((t.x - s.x) ** 2 + (t.z - s.z) ** 2 < 40 * 40) near += 1;
    }
  }
  return { state, airs, treesNear: near / Math.max(1, samples) };
}

describe("what the benchmark runs (benchmark-plan.ts)", () => {
  const ride = rideBenchmark();

  it("PUTS THE WHOLE FIELD ON THE SNOW — the heaviest thing the game does", () => {
    expect(BENCHMARK.mode).toBe("field");
    expect(ride.state.rivals.length).toBe(RACE.rivals);
  });

  it("rides a stretch THROUGH THE WOODS and OVER A KICKER", () => {
    expect(ride.airs).toBeGreaterThanOrEqual(1);
    expect(ride.treesNear).toBeGreaterThan(8);
  });

  it("is the pinned sky, in daylight from the green to the last frame", () => {
    expect(weatherOf(ride.state.level).kind).toBe(BENCHMARK.sky.weather);
    expect(sunAtRun(ride.state.level).elevation).toBeGreaterThan(0.1);
  });

  it("advances the game by a WHOLE NUMBER of engine steps per frame", () => {
    const steps = BENCHMARK.step / TUNING.dt;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-9);
    expect(Math.round(steps)).toBeGreaterThanOrEqual(1);
  });

  it("takes a reading that lands on the run's last frame, and is a race's length", () => {
    expect(BENCHMARK.frames % SAMPLE_EVERY).toBe(0);
    expect(benchmarkSeconds()).toBeGreaterThanOrEqual(20);
    expect(benchmarkSeconds()).toBeLessThanOrEqual(60);
  });

  it("rides the same race every time — a score compares only against the same work", () => {
    const again = rideBenchmark();
    expect(again.state.skier.x).toBe(ride.state.skier.x);
    expect(again.state.skier.z).toBe(ride.state.skier.z);
    expect(again.state.rivals.map((r) => r.run.skier.x)).toEqual(
      ride.state.rivals.map((r) => r.run.skier.x),
    );
  });
});

describe("the score (benchmark-index.ts)", () => {
  it("SCORES 100 FOR DRAWING THE RACE IN THE TIME IT TAKES TO RIDE", () => {
    expect(benchIndex(30, 30)).toBe(INDEX_REAL);
    expect(benchIndex(30, 15)).toBe(200);
    expect(benchIndex(30, 60)).toBe(50);
  });

  it("has no score before it has drawn a frame", () => {
    expect(benchIndex(0, 0)).toBe(0);
    expect(benchIndex(1, 0)).toBe(0);
  });

  it("is a frame rate in another hat, and converts back exactly", () => {
    expect(indexOfFps(60, 1 / 60)).toBeCloseTo(100);
    expect(fpsOfIndex(indexOfFps(137, BENCHMARK.step), BENCHMARK.step)).toBeCloseTo(137);
  });

  it("walks the x axis across THE RUN and keeps an earlier spike under the ceiling", () => {
    const samples: BenchSample[] = [
      { frame: 15, index: 400, fps: 300 },
      { frame: 900, index: 150, fps: 80 },
    ];
    const plot = benchPlot(samples, 1800, 1 / 60);
    expect(plot.points[1].x).toBeCloseTo(0.5);
    expect(plot.top).toBeGreaterThanOrEqual(indexOfFps(300, 1 / 60));
    for (const p of [...plot.points, ...plot.rate]) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    expect(plot.index).toBe(150);
  });

  it("draws an empty graph rather than nothing before the first reading", () => {
    const plot = benchPlot([], 1800, 1 / 60);
    expect(plot.points).toEqual([]);
    expect(plot.index).toBe(0);
    expect(plot.top).toBeGreaterThan(0);
  });
});

/** A run of `frames` frames each costing `each`, fully accounted. */
function fakeRun(frames = 120): BenchmarkRun {
  const totals: RunTotals = {
    frames,
    sim: 2 * frames,
    render: 6 * frames,
    pose: 1 * frames,
    trail: 0.5 * frames,
    world: 1.5 * frames,
    submit: 2.5 * frames,
    gpu: 5 * frames,
    between: 0.5 * frames,
    wall: 14 * frames,
  };
  const cost: FramePhases = {
    ...noCost(),
    calls: 210,
    triangles: 480_000,
    programs: 30,
    geometries: 90,
    textures: 20,
    frameMs: 6,
    simMs: 2,
    gpuMs: 5,
    wallMs: 14,
  };
  const samples: BenchSample[] = [];
  const costs: FramePhases[] = [];
  for (let f = SAMPLE_EVERY; f <= frames; f += SAMPLE_EVERY) {
    samples.push({ frame: f, index: 119, fps: 71 });
    costs.push(cost);
  }
  return {
    map: "SEED 39",
    skis: 4,
    width: 1280,
    height: 720,
    pixelRatio: 1,
    picture: pictureRows(DEFAULT_VIDEO),
    plan: plannedRows(),
    samples,
    costs,
    scene: [
      { name: "forest", objects: 12, triangles: 300_000 },
      { name: "terrain", objects: 4, triangles: 150_000 },
    ],
    totals,
    gpu: {
      frames: 100,
      dropped: 2,
      ms: { shadow: 50, scene: 300, terrain: 120 },
      tags: { "": { frames: 100, ms: 470 }, forest: { frames: 10, ms: 40 } },
    },
    hidden: [],
    machine: { cores: 8, clockMs: 0.1, gpu: "a graphics card" },
    step: 1 / 60,
    frames,
  };
}

describe("the report (benchmark-report.ts)", () => {
  it("reports the CONDITIONS, the frame and where to look", () => {
    const text = benchmarkReport(fakeRun());
    expect(text).toMatch(/^BENCHMARK — SEED 39 · 4 skis · 1280×720 @ 1x/);
    expect(text).toContain("INDEX 119");
    expect(text).toContain("MACHINE 8 cores · 0.10 ms clock · a graphics card");
    expect(text).toContain("PICTURE resolution ");
    expect(text).toContain(`PINNED  seed ${BENCHMARK.seed}`);
    expect(text).toContain("WHERE THE FRAME WENT, MEANED OVER 120 FRAMES");
    expect(text).toContain("WHAT WAS STANDING THERE, LAST FRAME");
    // Heaviest first — the first row is where to look.
    const scene = text.slice(text.indexOf("WHAT WAS STANDING THERE"));
    expect(scene.indexOf("forest")).toBeLessThan(scene.indexOf("terrain"));
    expect(text).toContain("THE RUN, READING BY READING");
  });

  it("BILLS THE WHOLE FRAME — the engine's steps and the fence beside the draw", () => {
    const text = benchmarkReport(fakeRun());
    expect(text).toMatch(/sim\s+2\.00 ms\s+14%/);
    expect(text).toMatch(/gpu\s+5\.00 ms\s+36%/);
    expect(text).toMatch(/wall\s+14\.00 ms\s+the frame, end to end — 71 fps, index 119/);
  });

  it("derives `rest` and `unbilled`, and never prints a negative phase", () => {
    // The A/B's differences are signed on purpose; this is about the phases.
    const run = { ...fakeRun(), gpu: noGpu() };
    run.totals.pose = 99 * run.totals.frames;
    run.totals.sim = 99 * run.totals.frames;
    const text = benchmarkReport(run);
    expect(text).toMatch(/rest\s+0\.00 ms/);
    expect(text).toMatch(/unbilled\s+0\.00 ms/);
    expect(text).not.toMatch(/-\d/);
  });

  it("leaves the breakdown out rather than printing a frame of zeroes", () => {
    const run = { ...fakeRun(), totals: noTotals(), machine: noMachine() };
    const text = benchmarkReport(run);
    expect(text).not.toContain("WHERE THE FRAME WENT");
    expect(text).not.toContain("MACHINE");
  });

  it("reads a frame's usual cost as the MIDDLE reading, not the mean", () => {
    expect(median([1, 2, 100])).toBe(2);
    expect(median([1, 3])).toBe(2);
    expect(median([])).toBe(0);
  });

  it("bills THE GPU'S OWN TIMER slice by slice, in the order a frame draws them", () => {
    const text = benchmarkReport(fakeRun());
    expect(text).toContain("WHERE THE GPU WENT, TIMER QUERIES OVER 100 FRAMES (2 dropped)");
    const lines = text.split("\n");
    const at = (slice: string) => lines.findIndex((l) => l.trimStart().startsWith(`${slice} `));
    expect(at("shadow")).toBeGreaterThan(0);
    expect(at("shadow")).toBeLessThan(at("scene"));
    expect(at("scene")).toBeLessThan(at("terrain"));
    expect(lines[at("scene")]).toMatch(/3\.000 ms\s+64%/);
    expect(text).toMatch(/card\s+4\.700 ms/);
    // No timer, no section: a machine without one is not billed zeroes.
    expect(benchmarkReport({ ...fakeRun(), gpu: noGpu() })).not.toContain("WHERE THE GPU WENT");
  });

  it("bills the INTERLEAVED A/B as each variant's card time against the whole picture's", () => {
    const text = benchmarkReport(fakeRun());
    expect(text).toContain("A/B, INTERLEAVED FRAME BY FRAME");
    expect(text).toMatch(/\(nothing\)\s+4\.700 ms\s+100/);
    expect(text).toMatch(/forest\s+4\.000 ms\s+-0\.700\s+10/);
    const alone = { ...fakeRun().gpu, tags: { "": { frames: 100, ms: 470 } } };
    expect(benchmarkReport({ ...fakeRun(), gpu: alone })).not.toContain("A/B");
  });

  it("says a run drawn WITHOUT a subsystem is an A/B reading", () => {
    expect(benchmarkReport(fakeRun())).not.toContain("HIDDEN");
    const text = benchmarkReport({ ...fakeRun(), hidden: ["forest", "shadow"] });
    expect(text).toContain("HIDDEN  forest · shadow — an A/B reading");
  });

  it("writes every row of OPTIONS ▸ PICTURE down, the switch as a word", () => {
    const rows = pictureRows(DEFAULT_VIDEO);
    expect(rows.map((r) => r.label)).toEqual(Object.keys(DEFAULT_VIDEO));
    expect(rows.find((r) => r.label === "antialias")?.value).toBe(
      DEFAULT_VIDEO.antialias ? "on" : "off",
    );
  });
});

describe("every run this machine has scored (benchmark-history.ts)", () => {
  const record = (at: number): BenchmarkRecord => ({ ...fakeRun(30), at, index: at / 10 });

  it("keeps the newest runs, newest first, and drops the oldest", () => {
    const many = Array.from({ length: RUNS_KEPT + 5 }, (_, i) => record(1000 + i));
    const kept = keptWith(many);
    expect(kept.length).toBe(RUNS_KEPT);
    expect(kept[0].at).toBe(1000 + RUNS_KEPT + 4);
    expect(keptWith(kept, record(99_999))[0].at).toBe(99_999);
  });

  it("KEEPS THE WHOLE RUN, not the score — a stored run reports as it did", () => {
    const run = record(5000);
    const back = mergeBenchmarks(JSON.parse(JSON.stringify([run])));
    expect(back).toHaveLength(1);
    expect(benchmarkReport(back[0])).toBe(benchmarkReport(run));
  });

  it("drops what is not a run, and reads a blob that is not a list as no history", () => {
    expect(recordOf({ index: 5 })).toBeNull();
    expect(mergeBenchmarks([null, 3, "x", { at: -1 }, record(10)])).toHaveLength(1);
    for (const junk of [null, 3, "x", {}]) expect(mergeBenchmarks(junk)).toEqual([]);
  });

  it("reads the history back as a sheet, one line a run", () => {
    expect(benchmarkSheet([])).toMatch(/No benchmark runs/);
    const sheet = benchmarkSheet([record(2000), record(1000)]);
    expect(sheet.split("\n").filter((l) => l.includes("index"))).toHaveLength(2);
    expect(sheet).toContain("picture code: resolution");
  });
});

describe("the hold that lets the developer page out (menu-hold.ts)", () => {
  const held = (from: number) => ({ from, fired: false });

  it("does nothing without a finger, and fires at the hold's length and not before", () => {
    expect(tickHold(NO_HOLD, 5_000, DEV_HOLD_MS)).toBe(NO_HOLD);
    expect(tickHold(held(0), DEV_HOLD_MS - 1, DEV_HOLD_MS).fired).toBe(false);
    expect(tickHold(held(0), DEV_HOLD_MS, DEV_HOLD_MS).fired).toBe(true);
  });

  it("answers an early wake with the SAME state and the time still owed", () => {
    const h = held(0);
    expect(tickHold(h, 6999, DEV_HOLD_MS)).toBe(h);
    expect(holdWait(h, 6999.5, DEV_HOLD_MS)).toBe(1);
    expect(holdWait(h, 2000, DEV_HOLD_MS)).toBe(5000);
    expect(holdWait(NO_HOLD, 0, DEV_HOLD_MS)).toBe(0);
  });

  it("is seven seconds — no thumb resting on the title lets it out by accident", () => {
    expect(DEV_HOLD_MS).toBe(7000);
  });
});

describe("the frame-rate readout (frame-rate.ts)", () => {
  it("takes the first frame whole and eases after it", () => {
    const first = smoothFps(0, 1000 / 60);
    expect(first).toBeCloseTo(60);
    const next = smoothFps(first, 1000 / 30);
    expect(next).toBeLessThan(60);
    expect(next).toBeGreaterThan(30);
  });

  it("skips a stall rather than burying the reading", () => {
    expect(smoothFps(60, FPS_STALL_MS + 1)).toBe(60);
    expect(smoothFps(60, 0)).toBe(60);
  });
});

describe("the REPRO line (debug-readout.ts)", () => {
  it("is a URL the app reads back to the same run, moment and pose", () => {
    const state = createGame({ seed: 39, mode: "timeTrial", quiet: true });
    for (let i = 0; i < 600; i++) step(state, botInput(state));
    const facts = reproOf(state, "timeTrial", "far");
    const params = readParams(reproQuery(facts));
    expect(params).toMatchObject({ rides: true, seed: 39, mode: "timeTrial", camera: "far" });
    expect(params.skis).toBe(state.skier.spec.id);
    expect(params.t).toBeCloseTo(state.t, 2);
    expect(params.sky?.weather).toBe(weatherOf(state.level).kind);
    expect(params.pose?.x).toBeCloseTo(state.skier.x, 1);
    expect(params.pose?.z).toBeCloseTo(state.skier.z, 1);
    expect(params.pose?.heading).toBeCloseTo(state.skier.heading, 2);
  });

  it("names a free ride and a tricks run in the spelling `url-params.ts` reads", () => {
    const state = createGame({ seed: 7, quiet: true });
    expect(readParams(reproQuery(reproOf(state, "free", "chase"))).free).toBe(true);
    expect(readParams(reproQuery(reproOf(state, "tricks", "chase"))).mode).toBe("tricks");
    expect(readParams(reproQuery(reproOf(state, "slalom", "chase"))).mode).toBe("slalom");
  });

  it("reads a pose back, and refuses anything that is not one", () => {
    expect(readPose("1,2,0.5,10")).toEqual({ x: 1, z: 2, heading: 0.5, speed: 10 });
    expect(readPose("1,2,0.5")).toEqual({ x: 1, z: 2, heading: 0.5, speed: 0 });
    for (const junk of [null, "", "1,2", "a,b,c", "1,2,3,4,5"]) expect(readPose(junk)).toBeNull();
  });
});

describe("the physics readouts (debug-readout.ts)", () => {
  it("lists every probe the engine writes, with its load, sink and travel", () => {
    const state = createGame({ seed: 39, quiet: true });
    for (let i = 0; i < 120; i++) step(state, botInput(state));
    const read = physicsOf(state);
    expect(read.probes).toHaveLength(state.skier.contacts.length);
    expect(new Set(read.probes.map((p) => p.name)).size).toBe(read.probes.length);
    expect(read.probes.some((p) => p.touching && p.load > 0)).toBe(true);
    expect(read.packed).toBeGreaterThanOrEqual(0);
    expect(read.packed).toBeLessThanOrEqual(100);
  });
});

describe("the free camera (free-fly.ts)", () => {
  it("flies forward along the look and turns the head on a drag", () => {
    const fly = { x: 0, y: 10, z: 0, yaw: 0, pitch: 0 };
    flyStep(fly, { ...NO_KEYS, forward: true }, 1);
    expect(fly.z).toBeCloseTo(FLY.speed);
    expect(fly.x).toBeCloseTo(0);
    flyStep(fly, { ...NO_KEYS, up: true, fast: true }, 0.5);
    expect(fly.y).toBeCloseTo(10 + FLY.speed * FLY.fast * 0.5);
    flyLook(fly, 0, -1e6);
    expect(fly.pitch).toBe(FLY.pitchLimit);
    const lens = flyLens({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    expect(lens.target.z).toBeGreaterThan(lens.eye.z);
  });
});

describe("the campaign set by hand (campaign-unlocks.ts)", () => {
  it("opens the whole ladder, every shelf WON, and invents no time", () => {
    const open = unlockShelves(EMPTY_PROGRESS, null);
    for (const shelf of SHELVES) expect(shelfWon(shelf, open), shelf.id).toBe(true);
    for (const result of Object.values(open.results)) expect(result.best).toBeUndefined();
    expect(unlockRows(open).every((r) => r.won && r.open)).toBe(true);
    // A board opened by hand survives the trip through storage.
    expect(mergeProgress(JSON.parse(JSON.stringify(open)))).toEqual(open);
  });

  it("works on a PREFIX: opening a shelf wins the ones before it, shutting one those after", () => {
    const mid = unlockShelves(EMPTY_PROGRESS, SHELVES[1].id);
    expect(shelfWon(SHELVES[0], mid)).toBe(true);
    expect(shelfWon(SHELVES[1], mid)).toBe(true);
    expect(shelfUnlocked(SHELVES[2], mid)).toBe(true);
    expect(shelfWon(SHELVES[2], mid)).toBe(false);
    const back = lockShelves(unlockShelves(EMPTY_PROGRESS, null), SHELVES[1].id);
    expect(shelfWon(SHELVES[0], back)).toBe(true);
    expect(SHELVES[1].levels.every((l) => back.results[l.id] === undefined)).toBe(true);
    expect(lockShelves(back, null)).toEqual(EMPTY_PROGRESS);
  });

  it("keeps a time actually ridden, and a real run fills a granted one in", () => {
    const level = SHELVES[0].levels[0];
    const ridden = recordRun(EMPTY_PROGRESS, level, {
      time: 321,
      skis: "hare",
      order: [null, 0, 1, 2],
    });
    const open = unlockShelves(ridden, null);
    expect(open.results[level.id].best).toBe(321);
    const granted = unlockShelves(EMPTY_PROGRESS, null);
    const after = recordRun(granted, level, { time: 400, skis: "swift", order: [0, null, 1, 2] });
    expect(after.results[level.id]).toMatchObject({ best: 400, skis: "swift", place: 1 });
    expect(levelCleared(after, level)).toBe(true);
  });
});

describe("what the developer page remembers (settings.ts)", () => {
  it("is shut on a fresh visit, and a stored blob keeps only real switches", () => {
    expect(freshSettings().developer).toBe(false);
    const merged = mergeSettings({ developer: true, dev: { fps: true, cost: "yes", bogus: true } });
    expect(merged.developer).toBe(true);
    expect(merged.dev.fps).toBe(true);
    expect(merged.dev.cost).toBe(false);
    expect("bogus" in merged.dev).toBe(false);
  });

  it("opens the developer's pages and the benchmark from a link", () => {
    expect(readParams("?menu=dev").page).toBe("dev");
    expect(readParams("?menu=benchHistory").page).toBe("benchHistory");
    expect(readParams("?bench=1").bench).toBe(true);
    expect(readParams("").bench).toBe(false);
  });

  it("reads the benchmark's GPU timer and its A/B hide off a link", () => {
    expect(readParams("?bench=1").gpu).toBe("passes");
    expect(readParams("?bench=1&gpu=split").gpu).toBe("split");
    expect(readParams("?bench=1&gpu=nonsense").gpu).toBe("passes");
    expect(readParams("?bench=1").hide).toEqual([]);
    expect(readParams("?hide=forest,nothing,cloud").hide).toEqual(["forest", "cloud"]);
    expect(readParams("?bench=1&ab=1").ab).toBe(true);
    expect(readParams("?bench=1&frames=600").frames).toBe(600);
    expect(readParams("?bench=1&frames=5").frames).toBe(null);
    expect(readParams("?bench=1&frames=99999").frames).toBe(null);
    expect(readParams("?bench=1&view=vista").view).toBe("vista");
    expect(readParams("?bench=1").view).toBe("race");
    expect(readParams("?bench=1").ab).toBe(false);
    for (const name of HIDEABLE) expect(readParams(`?hide=${name}`).hide).toEqual([name]);
  });
});
