// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE ON THE BENCH (`avalanche.ts`): a LEE SLOPE no generator built
// — a 38° powder face falling along +z, the wind blowing down it from the
// ridge so the whole face is loaded, easing through a bend onto a flat
// run-out — a slab released there by hand, and a skier on a line through it:
// on the slab as it goes (straight down, across and out of the flank, slow
// across, stopped), stood in its path below, stood beside it, and one
// traversing the face until it lets go of its own. Shared by the lab
// (`scripts/avalanche-lab.mjs`) and the suite (`tests/avalanche_test.ts`), so
// the table a PR shows is the rows the tests hold.

import {
  AVALANCHE,
  CLEAR_WEATHER,
  NEUTRAL_INPUT,
  createGame,
  placeRun,
  releaseAvalanche,
  step,
  stepAvalanche,
  type GameEvent,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";
import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { flatLevel } from "./synthetic.ts";

/** The bench's face, m: the pitch's grade (38°), where it starts falling,
 * where it starts easing off and over how far, and the middle of it across. */
export const LEE = {
  grade: Math.tan((38 * Math.PI) / 180),
  from: 300,
  ease: 520,
  bend: 120,
  x: 600,
  /** Where the slab is let go: the skier on it stands here. */
  slab: 380,
  /** The wind down the face, m/s, from the ridge (+z its way). */
  wind: 12,
} as const;

/** THE LEE SLOPE: unpacked, treeless, its whole face facing down a strong
 * wind under a steady snowfall — loaded everywhere it is steep. `wind` and
 * `fall` change the day. */
export function leeLevel(wind: number = LEE.wind, fall = 0.5): Level {
  const base = flatLevel({
    packed: 0,
    size: 1200,
    grade: LEE.grade,
    slopeFrom: LEE.from,
    runOut: { at: LEE.ease, bend: LEE.bend },
  });
  return {
    ...base,
    weather: { ...CLEAR_WEATHER, kind: "snow", snowfall: fall, wind, windFrom: Math.PI },
  };
}

/** A FREE RIDE on a map that asked for avalanches, its run's own stream
 * off `seed` (the map's when left out). */
export function avalancheRide(
  level: Level = leeLevel(),
  avalanche = true,
  seed?: number,
): GameState {
  return createGame({ level, seed, mode: "free", quiet: true, crowd: 0, avalanche });
}

/** One skier's line through a slab let go under him (or not). `release`
 * is where the slab is let go (null: left to the mountain); `hold` the
 * heading he keeps to, or null to ski where gravity takes him; `brake`
 * held, a stop. */
export type AvalancheLine = {
  id: string;
  what: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  hold: number | null;
  tuck: number;
  brake?: number;
  release: { x: number; z: number } | null;
  /** What a skier on this line comes out as. */
  wants: Outcome | "any";
};

export type Outcome = "escaped" | "buried" | "surfaced" | "untouched" | "released";

const ACROSS = Math.PI / 2;
const AT = { x: LEE.x, z: LEE.slab };

export const AVALANCHE_LINES: readonly AvalancheLine[] = [
  {
    id: "straight",
    what: "on the slab, straight down it tucked",
    ...AT,
    heading: 0,
    speed: 14,
    hold: 0,
    tuck: 1,
    release: AT,
    wants: "any",
  },
  {
    id: "flank",
    what: "on the slab, across and out of its flank at 60 km/h",
    ...AT,
    heading: ACROSS,
    speed: 17,
    hold: ACROSS,
    tuck: 1,
    release: AT,
    wants: "escaped",
  },
  {
    id: "slow",
    what: "on the slab, across it at 15 km/h",
    ...AT,
    heading: ACROSS,
    speed: 4,
    hold: ACROSS,
    tuck: 0,
    release: AT,
    wants: "buried",
  },
  {
    id: "stopped",
    what: "on the slab, stopped",
    ...AT,
    heading: ACROSS,
    speed: 0,
    hold: null,
    tuck: 0,
    brake: 1,
    release: AT,
    wants: "buried",
  },
  {
    id: "below",
    what: "stood on the run-out in its path",
    x: LEE.x,
    z: LEE.ease + LEE.bend + 40,
    heading: ACROSS,
    speed: 0,
    hold: null,
    tuck: 0,
    brake: 1,
    release: AT,
    wants: "any",
  },
  {
    id: "aside",
    what: "stood on the run-out 140 m off to its side",
    x: LEE.x + 140,
    z: LEE.ease + 60,
    heading: ACROSS,
    speed: 0,
    hold: null,
    tuck: 0,
    brake: 1,
    release: AT,
    wants: "untouched",
  },
  {
    id: "trigger",
    what: "across the loaded face until it lets go",
    x: 150,
    z: LEE.slab,
    heading: ACROSS,
    speed: 12,
    hold: ACROSS,
    tuck: 0.4,
    release: null,
    wants: "released",
  },
];

/** What came of a line: the outcome, the slab and its flow. */
export type AvalancheResult = {
  id: string;
  outcome: Outcome;
  /** Seconds from the release to his being caught, −1 never; the depth he
   * was buried at, m; the seconds of air he was dealt, s. */
  caughtAt: number;
  depth: number;
  air: number;
  /** The metres he skied before it released (the trigger line). */
  metres: number;
  /** The slab: its volume, m³, width and length, m, thickness, m. */
  volume: number;
  width: number;
  length: number;
  slabDepth: number;
  /** The flow: the fastest parcel at 2, 5, 10 and 20 s, m/s; the fastest
   * ever; the run-out from the crown, m; seconds until it was at rest. */
  front: number[];
  top: number;
  runout: number;
  ran: number;
};

const SAMPLES = [2, 5, 10, 20];

/** Ride a line for up to `seconds` (the flow and his burial with it), the
 * run's stream off `seed`. */
export function rideLine(
  line: AvalancheLine,
  seconds = 70,
  seed?: number,
  level?: Level,
): AvalancheResult {
  const state = avalancheRide(level ?? leeLevel(), true, seed);
  placeRun(state, { x: line.x, z: line.z, heading: line.heading, speed: line.speed });
  const a = state.avalanche!;
  if (line.release) releaseAvalanche(state, a, line.release.x, line.release.z, []);
  const input: SkierInput = { ...NEUTRAL_INPUT };
  const result: AvalancheResult = {
    id: line.id,
    outcome: "untouched",
    caughtAt: -1,
    depth: 0,
    air: 0,
    metres: 0,
    volume: 0,
    width: 0,
    length: 0,
    slabDepth: 0,
    front: SAMPLES.map(() => 0),
    top: 0,
    runout: 0,
    ran: -1,
  };
  const steps = Math.round(seconds * 120);
  let released = line.release !== null;
  let since = 0;
  let px = state.skier.x;
  let pz = state.skier.z;
  for (let i = 0; i < steps; i++) {
    const c = state.skier;
    input.tuck = line.tuck;
    input.brake = line.brake ?? 0;
    input.steer = line.hold === null ? 0 : clamp(2 * angleDiff(c.heading, line.hold), -1, 1);
    step(state, input);
    if (!released) result.metres += Math.hypot(c.x - px, c.z - pz);
    px = c.x;
    pz = c.z;
    for (const e of state.events as GameEvent[]) {
      if (e.kind !== "avalanche") continue;
      if (e.phase === "release") {
        released = true;
        if (!line.release) result.outcome = "released";
      }
      if (e.phase === "caught") result.caughtAt = since;
      if (e.phase === "buried") {
        result.outcome = "buried";
        result.depth = e.depth;
        result.air = a.victim?.air ?? 0;
      }
      if (e.phase === "surfaced") {
        result.outcome = "surfaced";
        result.depth = e.depth;
      }
      if (e.phase === "escaped" && result.outcome === "untouched") result.outcome = "escaped";
    }
    if (!released) continue;
    since += 1 / 120;
    const s = a.slide;
    if (!s) continue;
    SAMPLES.forEach((t, k) => {
      if (Math.abs(since - t) < 0.5 / 120) result.front[k] = s.front;
    });
    if (!s.running && result.ran < 0) result.ran = s.t;
    if (!line.release && result.outcome === "released") break;
  }
  const s = a.slide;
  if (s) {
    result.volume = s.volume;
    result.width = s.slab.left + s.slab.right;
    result.length = s.slab.length;
    result.slabDepth = s.slab.depth;
    result.top = s.top;
    result.runout = s.runout;
  }
  return result;
}

/** Whether a line came out as a skier on it should. */
export function lineOk(line: AvalancheLine, r: AvalancheResult): boolean {
  return line.wants === "any" || line.wants === r.outcome;
}

/** The release band, re-exported for the lab's header. */
export const BAND = AVALANCHE.steep;

/** A SLAB AND ITS FLOW ALONE on the bench, let go at the bench's spot on
 * the run's stream off `seed`, nobody on it: what it measured, and what
 * stepping it cost — the mean milliseconds of `stepAvalanche` a step while
 * it ran, timed apart from the skier's own step. */
export function flowAlone(
  seed: number,
  level: Level = leeLevel(),
): AvalancheResult & { cost: number; cells: number; bytes: number } {
  const state = avalancheRide(level, true, seed);
  placeRun(state, { x: LEE.x + 300, z: 200, heading: 0, speed: 0 });
  const a = state.avalanche!;
  const s = releaseAvalanche(state, a, LEE.x, LEE.slab, []);
  const events: GameEvent[] = [];
  const front = SAMPLES.map(() => 0);
  let ms = 0;
  let steps = 0;
  for (let i = 0; i < 120 * 70 && s.running; i++) {
    events.length = 0;
    const t0 = performance.now();
    stepAvalanche(state, events);
    ms += performance.now() - t0;
    steps++;
    SAMPLES.forEach((t, k) => {
      if (Math.abs(s.t - t) < 0.5 / 120) front[k] = s.front;
    });
  }
  return {
    id: `seed ${seed}`,
    outcome: "released",
    caughtAt: -1,
    depth: 0,
    air: 0,
    metres: 0,
    volume: s.volume,
    width: s.slab.left + s.slab.right,
    length: s.slab.length,
    slabDepth: s.slab.depth,
    front,
    top: s.top,
    runout: s.runout,
    ran: s.running ? -1 : s.t,
    cost: steps > 0 ? ms / steps : 0,
    cells: s.count,
    bytes: s.cells.byteLength + s.next.byteLength,
  };
}

/** The metres a skier traverses the loaded face before it lets go of its
 * own, on the run's stream off each of `seeds` (−1 where it held for the
 * whole ride). */
export function triggerMetres(seeds: readonly number[], level?: Level): number[] {
  const line = AVALANCHE_LINES.find((l) => l.id === "trigger")!;
  return seeds.map((seed) => {
    const r = rideLine(line, 90, seed, level);
    return r.outcome === "released" ? r.metres : -1;
  });
}
