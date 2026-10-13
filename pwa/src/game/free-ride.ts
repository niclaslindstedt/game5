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
// store NULL until moved, and null is the seed's own answer (`dealtDay`, shown in orange).
//
// THE SPOT BELONGS TO ITS SEED. A place picked on one map's chart is a
// meaningless coordinate on the next, so it is kept with the seed it was
// picked on and read only while that is still the seed on the card.

import {
  CURRENT_GENERATOR_VERSION,
  DEFAULT_REGION,
  TIMES_OF_DAY,
  dayOfYearOf,
  hourOfTime,
  weatherOf,
  freeRuns,
  skiRoutesOf,
  pickFreeRun,
  isRegionId,
  snowCoverOf,
  type RunGrade,
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
  type MishapRate,
  type MishapState,
  type Level,
  type RunRules,
  type SkiSpec,
  regionOf,
  realFaceRegion,
  realFacePlace,
  seasonDay,
  SKIS,
  isBoard,
} from "@engine";

import { DEFAULT_FACE } from "./face-picks.ts";
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
  // 15 Jul: SUMMER, the snow gone but for the patches high in the hollows
  // (`summer.ts`) — the engine's `SUMMER_DAY`.
  { id: "summer", day: 196 },
] as const;

/** Whether the ride is stood up in SUMMER. */
export function summerOn(ride: Pick<FreeRide, "season">): boolean {
  return ride.season === "summer";
}

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
  /** The REAL FACE the mountain is raised on (R25, one of the region's —
   * `REAL_FACE_IDS`); null is the massif the seed deals. */
  face: string | null;
  /** The piste grade the map is built to (R23); null is the one the seed
   * deals. No row of the card writes it (a slope of any colour is picked
   * on the RUN row) and a stored one is dropped, so it is always null. */
  grade: RunGrade | null;
  /** The run of the ski area (R27, `Run.id`) the ride is carried to the top
   * of, on the seed and in the country it was picked on — or a START row's
   * machine (`SKIS_START`'s neighbours); null is the map's most difficult
   * piste (`pickFreeRun`). */
  run: { seed: number; region: RegionId; face?: string | null; id: string } | null;
  /** THE AVALANCHES row: whether the loaded slopes off the runs may slide
   * (`avalanche.ts`). On unless the player turns them off. */
  avalanche: boolean;
  /** Whether the WHERE steps have been opened on this ride: the first time
   * they are, the ride is stood on the first real range (`firstWhere`). */
  placed: boolean;
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
    face: null,
    grade: null,
    run: null,
    avalanche: true,
    placed: false,
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
  if (typeof b.avalanche === "boolean") out.avalanche = b.avalanche;
  if (typeof b.placed === "boolean") out.placed = b.placed;
  // A face is kept only in its own country: a face stored under another
  // region (or one this build has not baked) is the dealt massif.
  if (typeof b.face === "string" && realFaceRegion(b.face) === out.region) out.face = b.face;
  // No row asks a grade any more: the mountain is the seed's own, and a
  // grade stored by an older build is dropped with the row.
  const run = b.run as Record<string, unknown> | null | undefined;
  if (
    run &&
    typeof run === "object" &&
    isNumber(run.seed) &&
    isRegionId(run.region) &&
    typeof run.id === "string"
  ) {
    out.run = {
      seed: run.seed,
      region: run.region,
      ...(typeof run.face === "string" ? { face: run.face } : {}),
      id: run.id,
    };
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

/** THE START ROW'S PLANE STOP: the JUMP PLANE on its strip below the
 * village (`plane.ts`, `airstrip.ts`) — the ride begun stood in its open
 * door on his skis, the rig on his back, the engine running and the plane
 * his to fly. A run id of its own, as the machines' are. */
export const PLANE_RUN = "plane";

/** Whether the ride on `seed` begins in the jump plane's door. */
export function planeOn(ride: FreeRide, seed: number): boolean {
  return runOn(ride, seed) === PLANE_RUN;
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

/** THE START ROW'S WINGSUIT STOP, after the plane: the WINGSUIT with no
 * skis on, stood on its exit high on the mountain (`wingsuit-start.ts`) —
 * the edge over the drop, or a hover off the helicopter's skid over it. */
export const WINGSUIT_RUN = "wingsuit";

/** Whether the ride on `seed` begins on the wingsuit's own exit. */
export function wingsuitOn(ride: FreeRide, seed: number): boolean {
  return runOn(ride, seed) === WINGSUIT_RUN;
}

/** THE START ROW'S FIRST STOP: SLOPE, carried by the lift to the RUN
 * row's run on whatever the gear card picks, skis or a snowboard — no run
 * id of its own: it is the run picked, or none. */
export const SKIS_START = "skis";

/** THE START ROW'S SUMMER STOP: the DOWNHILL BIKE (`bike.ts`), the ride
 * begun on it at the head of a bike park trail — the one whose head is
 * nearest the spot picked on the chart, else the park's easiest. A run id
 * of its own, as the machines' are. */
export const BIKE_RUN = "bike";

/** Whether the ride on `seed` begins on the downhill bike. */
export function bikeOn(ride: FreeRide, seed: number): boolean {
  return runOn(ride, seed) === BIKE_RUN;
}

/** THE START ROW IN SUMMER: no snow to ski or ride on, so THE DOWNHILL BIKE
 * first, then the ways into the air — the paramotor, the balloon, the
 * helicopter, the plane and the wingsuit. */
export const SUMMER_STARTS: readonly string[] = [
  BIKE_RUN,
  PARA_RUN,
  BALLOON_RUN,
  HELI_RUN,
  PLANE_RUN,
  WINGSUIT_RUN,
];

/** The start a summer ride stands on when the one picked is not a summer
 * start (a slope, the snowmobile, the lodge): the downhill bike. */
export const SUMMER_DEFAULT = BIKE_RUN;

/** THE RIDE AS IT IS STOOD UP: itself, except in summer, where a start that
 * is not one of `SUMMER_STARTS` on `seed` is the bike (`SUMMER_DEFAULT`) —
 * the spot picked kept, since it picks the bike's trail. */
export function seasonRide(ride: FreeRide, seed: number): FreeRide {
  if (!summerOn(ride)) return ride;
  const at = runOn(ride, seed);
  if (at !== null && SUMMER_STARTS.includes(at)) return ride;
  return {
    ...ride,
    run: { seed, region: ride.region, face: ride.face, id: SUMMER_DEFAULT },
  };
}

/** What the START row writes when `id` is picked on `seed`: SLOPE hands the
 * ride back to the RUN row's first run, anything else is its machine (or
 * the lodge, or the wingsuit's exit), kept as a run id of the map as
 * before. */
export function startPicked(ride: FreeRide, seed: number, id: string): Partial<FreeRide> {
  return id === SKIS_START
    ? { run: null }
    : { run: { seed, region: ride.region, face: ride.face, id } };
}

/** What the RUN row writes when run `id` is picked on `seed`: that run, ON
 * SKIS — a slope picked is a slope to ski, whatever the START row said. */
export function runPicked(ride: FreeRide, seed: number, id: string): Partial<FreeRide> {
  return { run: { seed, region: ride.region, face: ride.face, id }, spot: null };
}

/** The spot to start at on `seed`, or null for the start line. */
export function spotOn(ride: FreeRide, seed: number): { x: number; z: number } | null {
  return ride.spot !== null && ride.spot.seed === seed ? { x: ride.spot.x, z: ride.spot.z } : null;
}

/** The ride moved onto the map and country a paused free ride is skied on
 * (the pause card's PISTE MAP): itself where it is already there, else the
 * same day and snow with the run and the spot left to that map. */
export function rideOnto(
  ride: FreeRide,
  seed: number,
  region: RegionId,
  face: string | null = null,
): FreeRide {
  if (ride.seed === seed && ride.region === region && ride.face === face) return ride;
  return { ...ride, seed, region, face, run: null, spot: null };
}

/** The run picked on `seed` in the ride's country, or null for the first
 * of the GRADE row's colour. THE RUN BELONGS TO ITS MAP, as the spot does:
 * a run's id on one seed or country is another run, or none, on the next. */
export function runOn(ride: FreeRide, seed: number): string | null {
  return ride.run !== null &&
    ride.run.seed === seed &&
    ride.run.region === ride.region &&
    (ride.run.face ?? null) === ride.face
    ? ride.run.id
    : null;
}

/** A RUN AS THE START CARD BILLS IT: the number the piste map signs it with
 * and its colour, its length and its drop, m, and its head — the
 * top a ride by lift is carried to (`freeRuns`, in their order). */
export type FreeRunInfo = {
  id: string;
  number: string;
  grade: RunGrade;
  length: number;
  vertical: number;
  head: { x: number; y: number; z: number; heading: number };
};

/** The day the ride's SEASON stop means on its mountain — half a year on
 * for a real face south of the equator, where deep winter is July — or null
 * for the map's own date. */
export function seasonOn(ride: Pick<FreeRide, "season" | "face">): number | null {
  const day = SEASONS.find((s) => s.id === ride.season)?.day;
  if (day === undefined) return null;
  const place = ride.face ? realFacePlace(ride.face) : null;
  return seasonDay(day, place?.lat ?? 0);
}

/** THE DAY A MAP WAS DEALT, in the start card's own words: the season
 * nearest its date, the time of day nearest its hour, and its sky. The
 * SEASON, TIME and WEATHER rows show these (in a colour of their own) until
 * the skier steps one. */
export type DealtDay = { season: SeasonId; time: TimeOfDay; weather: WeatherKind };

export function dealtDay(level: Pick<Level, "sun" | "weather">): DealtDay {
  const { hour, dayOfYear, latitude } = level.sun;
  const apart = (a: number, b: number, round: number): number => {
    const d = Math.abs(a - b) % round;
    return Math.min(d, round - d);
  };
  const nearest = <T>(items: readonly T[], off: (t: T) => number): T =>
    items.reduce((best, t) => (off(t) < off(best) ? t : best));
  // South of the equator a season is half a year on (`seasonDay`).
  const season = nearest(SEASONS, (s) =>
    apart(dayOfYearOf(seasonDay(s.day, latitude)), dayOfYear, 365),
  ).id;
  const time = nearest(TIMES_OF_DAY, (t) => apart(hourOfTime(latitude, dayOfYear, t), hour, 24));
  return { season, time, weather: weatherOf(level).kind };
}

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
  // The SKI ROUTES (R42) after the pistes, by their own names: a ride up
  // to one is a ride up the lift whose top it leaves.
  for (const r of skiRoutesOf(level)) {
    const top = r.points[0];
    runs.push({
      id: r.id,
      number: r.id,
      grade: r.grade,
      length: r.length,
      vertical: Math.max(0, top.y - r.points[r.points.length - 1].y),
      head: { x: top.x, y: top.y, z: top.z, heading: top.heading },
    });
  }
  const resort = level.resort;
  const fallback = resort?.courses.find((c) => c.id === resort.course)?.runs[0] ?? null;
  return { runs, fallback };
}

/** THE RUN THE CARD MARKS, of the runs its chart was sent: the one picked
 * on this map, else the most difficult piste (the first of the hardest, up to a black
 * colour) — the engine's own rule (`pickFreeRun`), so the run marked is the
 * run ridden. Null off a resort. */
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
  picked: FreeRide,
  seed: number,
  skier: {
    spec: SkiSpec;
    assist: Assist;
    poles?: boolean;
    gore?: boolean;
    sfw?: boolean;
    mishapRate?: MishapRate | "off";
  },
  random: () => number = Math.random,
): CreateGameOptions {
  const summer = summerOn(picked);
  const ride = seasonRide(picked, seed);
  const heli = heliOn(ride, seed);
  const sled = sledOn(ride, seed);
  const para = paraOn(ride, seed);
  const balloon = balloonOn(ride, seed);
  const plane = planeOn(ride, seed);
  const wingsuit = wingsuitOn(ride, seed);
  const bike = summer && bikeOn(ride, seed);
  // SAFE FOR WORK the lodges are shut: no ride begins at the party.
  const party = !skier.sfw && afterskiOn(ride, seed);
  const vehicle = heli || sled || para || balloon || plane || party || wingsuit || bike;
  // On the bike the spot picks its trail: the head nearest it.
  const spot = vehicle && !bike ? null : spotOn(ride, seed);
  return {
    seed,
    // NOTHING ON HIS FEET IN A WINGSUIT: a board picked on the gear card is
    // not his figure in the suit (a board is drawn as its own model, with no
    // wings), so the ride is stood up on the reference pair, never shown —
    // and on the bike, whose rider is the skis' figure with the pair put away.
    spec: (wingsuit || bike) && isBoard(skier.spec) ? SKIS : skier.spec,
    assist: skier.assist,
    poles: skier.poles ?? true,
    ...(skier.gore ? { gore: true } : {}),
    ...(skier.sfw ? { sfw: true } : {}),
    mode: "free",
    region: ride.region,
    face: ride.face ?? undefined,
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
    // THE JUMP PLANE: stood in its door on the strip, the engine running.
    plane,
    // THE WINGSUIT: on its own exit high on the mountain, or worn up the
    // craft picked — no skis on, every jump flown in it.
    ...(wingsuit ? { wingsuit: true } : {}),
    // THE DOWNHILL BIKE: at rest on a trail head, the rider on it.
    ...(bike ? { bike: true } : {}),
    // THE AFTERSKI: inside the valley's lodge, the party under way.
    inLodge: party,
    snowDepth: depthOf(ride.snow),
    // ONE PATH FOR THE HOUR: the TIME row's word goes through `day`
    // (`withDay`, which reads it on the map's own latitude and the season's
    // date); the WEATHER row names only the sky, never an hour, so the two
    // cannot disagree.
    day: {
      time: ride.time,
      dayOfYear: seasonOn(ride),
    },
    sky: ride.weather === null ? undefined : { weather: ride.weather },
    spawn: spot ?? undefined,
    // A SPOT PICKED ON THE CHART IS WHERE THE RIDE STARTS: stood on the snow
    // there, never carried up a lift to the top of the run beside it. With no
    // spot it comes onto the mountain BY CHAIR (`lift-ride.ts`): up the lift
    // whose run passes nearest the start line, led off its top onto that run.
    // (The afterski asks for the chair too: a map with no lodge — which
    // the card never offers it on — comes onto the mountain by lift.)
    byLift: spot === null && !vehicle,
    // THE GRIMBEAR, now and then.
    grimbear: random() < GRIMBEAR_ODDS ? "hunt" : undefined,
    // THE PISTE MACHINES, out working the runs if the ride is after dark.
    groomer: "night",
    // THE AVALANCHES: the loaded slopes off the groomed runs may slide,
    // unless the start card's row turned them off — and never in summer.
    avalanche: ride.avalanche && !summer,
    // SUMMER: the mountain with its snow gone (`summer.ts`).
    ...(summer ? { summer: true } : {}),
    // THINGS GO WRONG (`mishaps.ts`): a canopy's malfunction, an engine
    // stopping — dealt off a stream of their own, salted by the app.
    ...(skier.mishapRate && skier.mishapRate !== "off"
      ? { mishaps: { rate: skier.mishapRate, salt: Math.floor(random() * 2 ** 32) } }
      : {}),
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
  mishaps?: MishapState,
): CreateGameOptions {
  return {
    ...again,
    spawn: undefined,
    byLift: false,
    run,
    grimbear: grimbearAgain(beast),
    // The next rider is dealt his own mishaps, salted off the last one's.
    mishaps: again.mishaps && {
      ...again.mishaps,
      salt: mishaps ? Math.floor(mishaps.rng.next() * 2 ** 32) : (again.mishaps.salt + 1) >>> 0,
    },
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
  if (state.rules.course || state.rules.tricks || !again) return null;
  // ON HIS FEET ON THE SLOPE, a ride begun on a machine starts again at the
  // top of that slope on his skis, never back on the machine he left.
  // In SUMMER there is no slope to ski: he starts again on what he left.
  const ride = onTheSlope(state) && !again.wingsuit && !again.summer ? onSkisAgain(again) : again;
  return freeTopOptions(ride, lastPiste(state), state.grimbear, state.mishaps);
}

/** The crashes a machine throws its rider in: down off one of these, he is
 * still the machine's, and its restart stands him back on it. */
const CRAFT_CRASHES: ReadonlySet<string> = new Set([
  "heli",
  "sled",
  "balloon",
  "plane",
  "wingsuit",
]);

/** WHETHER THE RIDER IS ON HIS OWN FEET ON THE MOUNTAIN — skiing, stood or
 * down on the snow off his own skis, or riding a lift — rather than in, on
 * or under a machine: the helicopter's skid, the snowmobile, the plane, the
 * balloon's basket, the paramotor's wing, a canopy or freefall, a piste
 * machine's cab, the lodge — or thrown by one of them. */
export function onTheSlope(state: GameState): boolean {
  const c = state.skier;
  if (c.thrown && CRAFT_CRASHES.has(c.thrown.cause)) return false;
  if (state.heli?.rider || state.plane?.rider || state.sled?.rider) return false;
  if (state.balloon?.aboard) return false;
  if (state.para && state.para.mode !== "dropped") return false;
  const ch = state.chute;
  if (ch && !ch.done && ch.mode !== "landed" && ch.mode !== "released") return false;
  if (state.afterski?.inside) return false;
  return !state.groomers?.some((g) => g.rider);
}

/** The ride `again` with every machine it was begun on left out: stood on
 * the snow on his skis, the helicopter and the snowmobile parked where the
 * ski area keeps them. */
function onSkisAgain(again: CreateGameOptions): CreateGameOptions {
  return {
    ...again,
    heli: undefined,
    sled: undefined,
    para: undefined,
    balloon: undefined,
    plane: undefined,
    chute: undefined,
  };
}

/** WHERE THE NEXT RIDER STANDS once this one is dead: the start of a race
 * or a tricks run; on a free ride, wherever the restart's options `next`
 * (`freeTopOptions`) put him, read in the order `createGame` reads them —
 * the balloon's basket, the paramotor's summit, the plane's door on its
 * strip, the helicopter's pad, the snowmobile, the wingsuit's own exit,
 * then the top of the last piste skied, else the start line. */
export type AgainAt = "start" | "top" | "pad" | "sled" | "summit" | "basket" | "strip" | "exit";

export function againAt(rules: RunRules, next: CreateGameOptions | null): AgainAt {
  if (rules.course || rules.tricks || !next) return "start";
  if (next.balloon && !next.inLodge) return "basket";
  if (next.para) return "summit";
  if (next.plane && !next.inLodge) return "strip";
  if (rules.heli && next.heli) return "pad";
  if (rules.sled && next.sled) return "sled";
  if (next.wingsuit && !next.inLodge) return "exit";
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
    (level.face ?? null) === (options.face ?? null) &&
    options.grade === undefined &&
    rules.course &&
    rules.jury === undefined &&
    !level.slalom &&
    !level.downhill &&
    !level.superG &&
    !level.giantSlalom;
  return same ? level : undefined;
}

/** The map a free ride was stood up on, and the ask it answered
 * (`seed-maps.ts`'s `askKey`: the seed, the country or real face, the grade). */
export type RiddenMap = { ask: string; level: Level };

/** THE MOUNTAIN BEING RIDDEN, kept for another free ride on it: `ridden`'s
 * map where it is still the one standing (`current`) and the ride asks for
 * the same mountain — the pause card's PISTE MAP picking another run or
 * start. Ridden again as it is (`freeAgainOptions`), so nothing is generated
 * or built and the ride only moves the rider. */
export function rideKept(ridden: RiddenMap | null, current: Level, ask: string): Level | undefined {
  return ridden && ridden.level === current && ridden.ask === ask ? current : undefined;
}

/** A ride stood on a link's real `face` — a link to one of the free
 * ride's cards opens it there — (in the face's own country), or
 * the ride as it is where the link names none this build has. */
export function rideOnFace(ride: FreeRide, face: string | null): FreeRide {
  const region = face ? realFaceRegion(face) : null;
  if (!face || !region || face === ride.face) return ride;
  return { ...ride, face, region, spot: null, run: null };
}

/** THE WHERE STEPS OPENED FOR THE FIRST TIME: the ride is stood on the first
 * real range's first mountain (`DEFAULT_FACE`) rather than on
 * GENERATED; after that, wherever the skier last left it. */
export function firstWhere(ride: FreeRide): FreeRide {
  if (ride.placed) return ride;
  return { ...(DEFAULT_FACE ? rideOnFace(ride, DEFAULT_FACE) : ride), placed: true };
}
