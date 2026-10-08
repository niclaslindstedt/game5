// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE AS THE APP ASKS FOR ONE — what the start card writes
// (`Settings.ride`), how a stored blob of it is read back, what the rows'
// figures read as, and the one place those answers become the options a
// run is stood up with (`freeGameOptions`). DOM-free, so the suite reads all
// of it (`tests/free_ride_card_test.ts`).
//
// THE ROWS ASK IN WORDS, NOT FIGURES. Nobody picks the 43rd day of the year or
// 10:45 solar time; they pick MIDWINTER and MORNING, and a depth of snow by
// what it is like to ride. So the day is a SEASON, the hour a TIME OF DAY
// (the engine's `hourOfTime` says which hour that is on the map's own date
// and latitude, NIGHT included) and the snow one of four depths.
//
// THE DAY'S TWO ROWS DEFER TO THE MAP UNTIL THEY ARE MOVED. A generated map
// is a whole day, and a card that arrived with an opinion about it would
// quietly take that away from every skier who never touched it. So both
// store NULL until moved, and null is the seed's own answer (AS DEALT).
//
// THE SPOT BELONGS TO ITS SEED. A place picked on one map's chart is a
// meaningless coordinate on the next, so it is kept with the seed it was
// picked on and read only while that is still the seed on the card.

import {
  CURRENT_GENERATOR_VERSION,
  DEFAULT_REGION,
  TIMES_OF_DAY,
  freeRuns,
  isPisteGrade,
  pickFreeRun,
  isRegionId,
  snowCoverOf,
  type PisteGrade,
  type RegionId,
  type TimeOfDay,
  type WeatherKind,
  WEATHER_KINDS,
  type Assist,
  type CreateGameOptions,
  type GrimbearAsk,
  type GameState,
  type GrimbearState,
  lastPiste,
  type Level,
  type RunRules,
  type SkiSpec,
  regionOf,
} from "@engine";

import { runNumbers } from "./run-names.ts";

/** THE FREE RIDE'S MOUNTAINS, IN ORDER: the map the start card opens on
 * for every skier, and the ones ANOTHER MOUNTAIN steps to after it, the same
 * for everyone — so the map a skier is shown first is one the game has
 * usually built already (the front door stands on the first, and the card
 * builds the next in the background while the last is looked at), and a
 * map's chart is kept between visits (`seed-store.ts`). A seed typed or
 * stepped on the MAP row is a mountain of the skier's own.
 *
 * Each is a ski area the current generator builds first time (no attempt
 * refused, so the quickest to build), with five lifts or more and courses
 * of several colours; ordered so the colours the seeds deal alternate. */
export const FREE_SEEDS: readonly number[] = [
  2, 6, 12, 18, 21, 3, 27, 15, 30, 24, 22, 4, 14, 38, 8, 11,
];

/** The free ride's first mountain: the start card's when nothing was
 * picked, and the one the front door stands on. */
export const FIRST_FREE_SEED = FREE_SEEDS[0];

/** The mountain ANOTHER MOUNTAIN deals after `seed`: the next of
 * {@link FREE_SEEDS}, round to the first after the last — and the first
 * after a seed of the skier's own. */
export function nextFreeSeed(seed: number): number {
  const at = FREE_SEEDS.indexOf(seed);
  return FREE_SEEDS[(at + 1) % FREE_SEEDS.length];
}

/** THE SEASON ROW'S STOPS, each a day as a count off Jan 1 (so December
 * runs through New Year without a seam; the engine folds it, `dayOfYearOf`):
 * the whole winter a mountain like this one holds snow, where R15 deals only
 * mid-January to mid-March. */
export const SEASONS = [
  { id: "early", day: -16 }, // 15 Dec: the lowest sun, the shortest day
  { id: "mid", day: 20 }, // 20 Jan
  { id: "late", day: 56 }, // 25 Feb
  { id: "spring", day: 91 }, // 1 Apr: a high sun and long days
] as const;

export type SeasonId = (typeof SEASONS)[number]["id"];

/** THE SNOW ROW'S STOPS, by how deep the loose snow lies, cm (`snowCoverOf`).
 * MEDIUM is the snow every race is ridden on; DEEP is a metre of fresh snow,
 * a northern forest's by March, where the powder is bottomless — a skis
 * that stops sinks to its belly, only speed keeps it on top and the skier's
 * weight keeps it upright (`snow.ts`). */
export const SNOW_STOPS = [
  { id: "thin", cm: 20 },
  { id: "medium", cm: 40 },
  { id: "thick", cm: 70 },
  { id: "deep", cm: 100 },
] as const;

export type SnowId = (typeof SNOW_STOPS)[number]["id"];

/** The snow dial (`SNOW_DIAL`) a stop asks for: its depth over the
 * ordinary snow's. */
export function depthOf(snow: SnowId): number {
  const stop = SNOW_STOPS.find((s) => s.id === snow) ?? SNOW_STOPS[1];
  return stop.cm / 100 / snowCoverOf(1);
}

/** What the start card writes. */
export type FreeRide = {
  /** The map; null is the one the front door is standing over. */
  seed: number | null;
  /** The season ({@link SEASONS}); null is the map's own date. */
  season: SeasonId | null;
  /** The time of day (`hourOfTime`); null is the map's own hour. */
  time: TimeOfDay | null;
  /** How deep the powder is ({@link SNOW_STOPS}). */
  snow: SnowId;
  /** Where on the chart the ride starts, on the seed it was picked on; null
   * is the start line. */
  spot: { seed: number; x: number; z: number } | null;
  /** The sky to ride under (R19's kinds, at their typical numbers —
   * `weatherFor`); null is the one the map was dealt. */
  weather: WeatherKind | null;
  /** The kind of snow country the map is built in (R21). */
  region: RegionId;
  /** The piste grade the map is built to (R23); null is the one the seed
   * deals. */
  grade: PisteGrade | null;
  /** The run of the ski area (R27, `Run.id`) the ride is carried to the top
   * of, on the seed and in the country it was picked on; null is the first
   * of the GRADE row's colour (`pickFreeRun`). */
  run: { seed: number; region: RegionId; id: string } | null;
};

export function freshRide(): FreeRide {
  return {
    seed: null,
    season: null,
    time: null,
    snow: "medium",
    spot: null,
    weather: null,
    region: DEFAULT_REGION,
    grade: null,
    run: null,
  };
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const isSeason = (v: unknown): v is SeasonId => SEASONS.some((s) => s.id === v);
const isSnow = (v: unknown): v is SnowId => SNOW_STOPS.some((s) => s.id === v);

/** A stored blob — anything at all — made into a ride this build offers,
 * every field checked on its own. A blob from the build with faders (a
 * `depth` multiple, a `day`, an `hour`) keeps its snow on the nearest stop
 * and hands the day back to the map. */
export function mergeRide(blob: unknown): FreeRide {
  const out = freshRide();
  if (!blob || typeof blob !== "object") return out;
  const b = blob as Record<string, unknown>;
  if (isNumber(b.seed) && Number.isInteger(b.seed) && b.seed >= 1 && b.seed <= 0xffffffff) {
    out.seed = b.seed;
  }
  if (isSeason(b.season)) out.season = b.season;
  if (TIMES_OF_DAY.includes(b.time as TimeOfDay)) out.time = b.time as TimeOfDay;
  if (isSnow(b.snow)) out.snow = b.snow;
  else if (isNumber(b.depth)) {
    const cm = snowCoverOf(b.depth) * 100;
    out.snow = SNOW_STOPS.reduce((best, s) =>
      Math.abs(s.cm - cm) < Math.abs(best.cm - cm) ? s : best,
    ).id;
  }
  if (typeof b.weather === "string" && WEATHER_KINDS.includes(b.weather as WeatherKind)) {
    out.weather = b.weather as WeatherKind;
  }
  if (isRegionId(b.region)) out.region = b.region;
  if (isPisteGrade(b.grade)) out.grade = b.grade;
  const run = b.run as Record<string, unknown> | null | undefined;
  if (
    run &&
    typeof run === "object" &&
    isNumber(run.seed) &&
    isRegionId(run.region) &&
    typeof run.id === "string"
  ) {
    out.run = { seed: run.seed, region: run.region, id: run.id };
  }
  const spot = b.spot as Record<string, unknown> | null | undefined;
  if (
    spot &&
    typeof spot === "object" &&
    isNumber(spot.seed) &&
    isNumber(spot.x) &&
    isNumber(spot.z)
  ) {
    out.spot = { seed: spot.seed, x: spot.x, z: spot.z };
  }
  return out;
}

/** THE RUN ROW'S LAST STOP: no run at all, but the HELICOPTER on its pad
 * on the valley floor (`heli.ts`) — the ride begun sat on its skid. Kept
 * as a run id of its own, so it belongs to its map as a run does. */
export const HELI_RUN = "heli";

/** Whether the ride on `seed` begins on the helicopter. */
export function heliOn(ride: FreeRide, seed: number): boolean {
  return runOn(ride, seed) === HELI_RUN;
}

/** THE RUN ROW'S OTHER VEHICLE STOP: the SNOWMOBILE parked at the bottom
 * (`sled.ts`) — the ride begun stood on its boards, the skis racked, the
 * engine running. A run id of its own, as the helicopter's is. */
export const SLED_RUN = "sled";

/** Whether the ride on `seed` begins on the snowmobile. */
export function sledOn(ride: FreeRide, seed: number): boolean {
  return runOn(ride, seed) === SLED_RUN;
}

/** THE RUN ROW'S FIRST VEHICLE STOP: the PARAMOTOR on the summit
 * (`para.ts`) — the ride begun at the top of the mountain on his skis, the
 * motor on his back and the wing over him. A run id of its own, as the
 * machines' are. */
export const PARA_RUN = "para";

/** Whether the ride on `seed` begins under the paramotor. */
export function paraOn(ride: FreeRide, seed: number): boolean {
  return runOn(ride, seed) === PARA_RUN;
}

/** THE RUN ROW'S BALLOON STOP: the HOT AIR BALLOON stood up inflated on
 * the valley floor (`balloon.ts`) — the ride begun in its basket, held on
 * its tether until the first burns make it light. A run id of its own, as
 * the machines' are. */
export const BALLOON_RUN = "balloon";

/** Whether the ride on `seed` begins in the hot air balloon. */
export function balloonOn(ride: FreeRide, seed: number): boolean {
  return runOn(ride, seed) === BALLOON_RUN;
}

/** THE RUN ROW'S AFTERSKI STOP: no run and no machine, but INSIDE the
 * valley's afterski lodge (`afterski.ts`) — the ride begun at the party,
 * his skis in the rack, the beers coming round, and the machine press the
 * way out onto the snow with whatever buzz he has drunk. A run id of its
 * own, as the machines' are; offered only on a map with a lodge. */
export const AFTERSKI_RUN = "afterski";

/** Whether the ride on `seed` begins inside the afterski lodge. */
export function afterskiOn(ride: FreeRide, seed: number): boolean {
  return runOn(ride, seed) === AFTERSKI_RUN;
}

/** The spot to start at on `seed`, or null for the start line. */
export function spotOn(ride: FreeRide, seed: number): { x: number; z: number } | null {
  return ride.spot !== null && ride.spot.seed === seed ? { x: ride.spot.x, z: ride.spot.z } : null;
}

/** The run picked on `seed` in the ride's country, or null for the first
 * of the GRADE row's colour. THE RUN BELONGS TO ITS MAP, as the spot does:
 * a run's id on one seed or country is another run, or none, on the next. */
export function runOn(ride: FreeRide, seed: number): string | null {
  return ride.run !== null && ride.run.seed === seed && ride.run.region === ride.region
    ? ride.run.id
    : null;
}

/** A RUN AS THE START CARD BILLS IT: the number the piste map signs it with
 * and its colour, its length and its drop, m, and its head — the
 * top a ride by lift is carried to (`freeRuns`, in their order). */
export type FreeRunInfo = {
  id: string;
  number: string;
  grade: PisteGrade;
  length: number;
  vertical: number;
  head: { x: number; y: number; z: number; heading: number };
};

/** Every run of `level` a free ride can be carried to the top of, billed
 * (`FreeRunInfo`), and the run that is when nothing is asked — the first
 * of the course the map is raced on. */
export function freeRunList(level: Level): { runs: FreeRunInfo[]; fallback: string | null } {
  const numbers = runNumbers(level);
  const runs = freeRuns(level).map((r): FreeRunInfo => {
    const top = r.points[0];
    const foot = r.points[r.points.length - 1];
    return {
      id: r.id,
      number: numbers.get(r.id) ?? r.id,
      grade: r.grade,
      length: r.length,
      vertical: Math.max(0, top.y - foot.y),
      head: { x: top.x, y: top.y, z: top.z, heading: top.heading },
    };
  });
  const resort = level.resort;
  const fallback = resort?.courses.find((c) => c.id === resort.course)?.runs[0] ?? null;
  return { runs, fallback };
}

/** THE RUN THE CARD MARKS, of the runs its chart was sent: the one picked
 * on this map, else the first of the GRADE row's colour, else the map's
 * own — the engine's own rule (`pickFreeRun`), so the run marked is the run
 * ridden. Null off a resort. */
export function markedRun(
  ride: FreeRide,
  seed: number,
  list: { runs: readonly FreeRunInfo[]; fallback: string | null },
): FreeRunInfo | null {
  const id = pickFreeRun(
    list.runs,
    { run: runOn(ride, seed), grade: ride.grade },
    list.fallback ?? undefined,
  );
  return list.runs.find((r) => r.id === id) ?? null;
}

/** THE RUN A FREE RIDE IS STOOD UP AS, on `seed`, for the skier on his
 * pair with his help and his poles (with them when left out) — everything
 * but the map itself, which the caller either hands over already built or
 * leaves to the seed. */
/** THE ODDS THE GRIMBEAR IS OUT (`grimbear.ts`): one free ride in three,
 * on the average — now two rides running, now five without. The app's draw,
 * not the engine's: the run is handed the answer and replays from it. */
export const GRIMBEAR_ODDS = 1 / 3;

export function freeGameOptions(
  ride: FreeRide,
  seed: number,
  skier: { spec: SkiSpec; assist: Assist; poles?: boolean; gore?: boolean },
  random: () => number = Math.random,
): CreateGameOptions {
  const heli = heliOn(ride, seed);
  const sled = sledOn(ride, seed);
  const para = paraOn(ride, seed);
  const balloon = balloonOn(ride, seed);
  const party = afterskiOn(ride, seed);
  const vehicle = heli || sled || para || balloon || party;
  const spot = vehicle ? null : spotOn(ride, seed);
  return {
    seed,
    spec: skier.spec,
    assist: skier.assist,
    poles: skier.poles ?? true,
    ...(skier.gore ? { gore: true } : {}),
    mode: "free",
    region: ride.region,
    grade: ride.grade ?? undefined,
    run: vehicle ? undefined : (runOn(ride, seed) ?? undefined),
    // THE HELICOPTER: sat on its skid on the pad, the rotor turning.
    heli,
    // THE SNOWMOBILE: stood on its boards at the bottom, the engine running.
    sled,
    // THE PARAMOTOR: stood on the summit, the wing over him.
    para,
    // THE HOT AIR BALLOON: in its basket on the valley floor, tethered.
    balloon,
    // THE AFTERSKI: inside the valley's lodge, the party under way.
    inLodge: party,
    snowDepth: depthOf(ride.snow),
    // ONE PATH FOR THE HOUR: the TIME row's word goes through `day`
    // (`withDay`, which reads it on the map's own latitude and the season's
    // date); the WEATHER row names only the sky, never an hour, so the two
    // cannot disagree.
    day: {
      time: ride.time,
      dayOfYear: SEASONS.find((s) => s.id === ride.season)?.day ?? null,
    },
    sky: ride.weather === null ? undefined : { weather: ride.weather },
    spawn: spot ?? undefined,
    // A SPOT PICKED ON THE CHART IS WHERE THE RIDE STARTS: stood on the snow
    // there, never carried up a lift to the top of the run beside it. With no
    // spot it comes onto the mountain BY CHAIR (`lift-ride.ts`): up the lift
    // whose run passes nearest the start line, led off its top onto that run.
    // (The afterski asks for the chair too: a map with no lodge — which
    // the card never offers it on — comes onto the mountain by lift.)
    byLift: spot === null && !(heli || sled || para || balloon),
    // THE GRIMBEAR, now and then.
    grimbear: random() < GRIMBEAR_ODDS ? "hunt" : undefined,
    // THE PISTE MACHINES, out working the runs if the ride is after dark.
    groomer: "night",
  };
}

/** THE FREE RIDE STARTED AGAIN: the options it was stood up with, on the map `level` it built. The day and the sky are
 * already in that map, so they are dropped rather than laid on again —
 * `withSky` makes a new map of any map it is handed, and a new map is one
 * the renderer has not built, which it would never draw. */
export function freeAgainOptions(options: CreateGameOptions, level: Level): CreateGameOptions {
  return { ...options, level, day: undefined, sky: undefined };
}

/** THE FREE RIDE'S RESTART: the ride `again` (`freeAgainOptions`) stood at
 * the TOP OF THE SLOPE — the head of the piste `run`, the last it skied
 * (`lastPiste`) — on the snow, neither at the spot it was first stood on nor
 * carried up a lift; the start line where it has skied no piste of a ski
 * area. */
export function freeTopOptions(
  again: CreateGameOptions,
  run: string | undefined,
  beast?: GrimbearState,
): CreateGameOptions {
  return {
    ...again,
    spawn: undefined,
    byLift: false,
    run,
    grimbear: grimbearAgain(beast),
    // A ride begun at the afterski starts again on the snow, not at the bar.
    inLodge: false,
  };
}

/** The options a free ride's restart stands the next rider up on, off the
 * ride `again` it was begun on (`freeAgainOptions`); null for every other
 * run, which starts again from its start line. */
export function freeRestart(
  state: GameState,
  again: CreateGameOptions | null,
): CreateGameOptions | null {
  return !state.rules.course && !state.rules.tricks && again
    ? freeTopOptions(again, lastPiste(state), state.grimbear)
    : null;
}

/** WHERE THE NEXT RIDER STANDS once this one is dead: the start of a race
 * or a tricks run; on a free ride, wherever the restart's options `next`
 * (`freeTopOptions`) put him, read in the order `createGame` reads them —
 * the balloon's basket, the paramotor's summit, the helicopter's pad, the
 * snowmobile, then the top of the last piste skied, else the start line. */
export type AgainAt = "start" | "top" | "pad" | "sled" | "summit" | "basket";

export function againAt(rules: RunRules, next: CreateGameOptions | null): AgainAt {
  if (rules.course || rules.tricks || !next) return "start";
  if (next.balloon && !next.inLodge) return "basket";
  if (next.para) return "summit";
  if (rules.heli && next.heli) return "pad";
  if (rules.sled && next.sled) return "sled";
  return next.run !== undefined ? "top" : "start";
}

/** THE GRIMBEAR ON A RIDE STARTED AGAIN: still out where he was, and still
 * owed his one catch if he has not had it — only ever chasing after it. */
export function grimbearAgain(beast: GrimbearState | undefined): GrimbearAsk | undefined {
  return beast ? (beast.hunt ? "hunt" : "roam") : undefined;
}

/** THE MAP ALREADY STANDING, if a free ride asked for with `options` is
 * ridden on exactly it: the same seed under this generator, in the same
 * country, down the course the seed deals (no grade asked), and nothing
 * set over it or eased for a race — the front door's own map, which stands
 * on the first free ride mountain (`FIRST_FREE_SEED`). Riding the very map
 * the renderer has built spares the loading card building it again. */
export function standingFor(
  level: Level,
  rules: RunRules,
  options: CreateGameOptions,
): Level | undefined {
  const same =
    level.seed === options.seed &&
    level.version === CURRENT_GENERATOR_VERSION &&
    regionOf(level).id === (options.region ?? DEFAULT_REGION) &&
    options.grade === undefined &&
    rules.course &&
    rules.jury === undefined &&
    !level.slalom &&
    !level.downhill &&
    !level.superG &&
    !level.giantSlalom;
  return same ? level : undefined;
}
