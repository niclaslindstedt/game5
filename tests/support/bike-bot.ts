// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT DOWN THE BIKE PARK (`bike-pilot.ts`), as the lab and the suite
// ride it: a summer free ride begun on the bike at a trail's head, ridden
// through the game's own step by the bot's keys until it is at the trail's
// foot (or a lift's load zone has taken it there), with what the ride came
// to — its time, its mean and top speed, its flights and landings, and every
// fall.
import {
  bikeAim,
  bikePilot,
  bikeTrailById,
  createGame,
  generateLevel,
  step,
  TUNING,
  type BikeCrash,
  type BikeLanding,
  type GameState,
  type Level,
  type TrailGrade,
} from "@engine";

/** What one ride of a trail came to. */
export type TrailRide = {
  seed: number;
  trail: string;
  grade: TrailGrade;
  kind: "trail" | "race";
  length: number;
  /** Whether it got to the foot, and how far down it got, m. */
  home: boolean;
  reached: number;
  seconds: number;
  /** Mean speed down the trail and the fastest, km/h. */
  mean: number;
  top: number;
  /** Flights over `BIKE.airCounts`, the longest, s, and every landing's verdict. */
  flights: number;
  longest: number;
  landings: Record<BikeLanding, number>;
  /** The hardest landing, g. */
  hardest: number;
  /** Every fall, by how. */
  crashes: BikeCrash[];
};

/** A summer map of `seed`, built once. */
const maps = new Map<number, Level>();
export function summerMap(seed: number): Level {
  let level = maps.get(seed);
  if (!level) {
    level = generateLevel(seed);
    maps.set(seed, level);
  }
  return level;
}

/** A summer free ride on the bike at the head of `trail`. */
export function bikeRun(level: Level, trail?: string): GameState {
  return createGame({
    level,
    mode: "free",
    summer: true,
    bike: true,
    bikeTrail: trail,
    quiet: true,
  });
}

/** THE BOT DOWN `trail` of `seed`'s park, for at most `limit` s (or the
 * first `upTo` m of it). */
export function rideTrail(seed: number, trail: string, limit = 1800, upTo = Infinity): TrailRide {
  const level = summerMap(seed);
  let state = bikeRun(level, trail);
  const t = bikeTrailById(state.level, trail);
  if (!t) throw new Error(`no trail ${trail} on seed ${seed}`);
  const end = Math.min(t.length, upTo);
  const aim = bikeAim(state, trail);
  const out: TrailRide = {
    seed,
    trail,
    grade: t.grade,
    kind: t.kind,
    length: end,
    home: false,
    reached: 0,
    seconds: 0,
    mean: 0,
    top: 0,
    flights: 0,
    longest: 0,
    landings: { clean: 0, cased: 0, nosed: 0, overshot: 0, flat: 0 },
    hardest: 0,
    crashes: [],
  };
  const steps = Math.round(limit / TUNING.dt);
  for (let i = 0; i < steps; i++) {
    state = step(state, bikePilot(state, aim));
    const b = state.bike!;
    for (const e of state.events) {
      if (e.kind === "air") out.flights++;
      if (e.kind !== "bike") continue;
      if (e.phase === "crash" && e.how) out.crashes.push(e.how);
      if (e.phase === "land" && e.landing) {
        out.landings[e.landing]++;
        out.longest = Math.max(out.longest, e.air ?? 0);
        out.hardest = Math.max(out.hardest, e.g ?? 0);
      }
    }
    if (b.onIt) out.top = Math.max(out.top, b.speed * 3.6);
    out.reached = Math.max(out.reached, aim.s);
    out.seconds = (i + 1) * TUNING.dt;
    if (aim.s >= end - 12 || (b.mode === "lift" && aim.s > end - 80)) {
      out.home = true;
      break;
    }
  }
  out.mean = (out.reached / Math.max(1, out.seconds)) * 3.6;
  return out;
}

/** The park's trails of `seed` — one of each grade and the race line. */
export function parkTrails(seed: number): { id: string; grade: TrailGrade; kind: string }[] {
  const park = bikeRun(summerMap(seed)).level.bikePark;
  return (park?.trails ?? []).map((t) => ({ id: t.id, grade: t.grade, kind: t.kind }));
}

/** The falls a km the bot is allowed down a trail of each grade (and the
 * race line): every trail must be got down, a green nearly clean, and the
 * harder grades with the falls the bot's hand still takes there — far more
 * than a real rider's, mostly on rock gardens and steep switchbacks on a
 * narrow tread (`docs/downhill-bike.md`); a ceiling that holds the bot from
 * getting worse, lowered as it gets better. */
export const BOT_FALLS: Record<TrailGrade | "race", number> = {
  green: 3,
  blue: 10,
  red: 15,
  black: 45,
  race: 12,
};

/** Whether a ride is in its band: home, and its falls a km within it. */
export function botPasses(r: TrailRide): boolean {
  const perKm = r.crashes.length / Math.max(0.1, r.reached / 1000);
  return r.home && perKm <= BOT_FALLS[r.kind === "race" ? "race" : r.grade];
}
