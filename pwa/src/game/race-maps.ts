// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE MAPS — every race discipline's own NINE pinned maps, the ones a
// SLALOM or a DOWNHILL off the front door is raced on, picked on the level
// card (`menu-levels.tsx`) its tile opens.
//
// A discipline's measured maps are chosen for the DISCIPLINE: nine seeds
// whose course makes a good race of it, out of a sweep of the generator's
// seeds on today's rules (the bot down each candidate's course, the course's
// figures beside it, every shortlisted map looked at). A slalom's nine are
// the ski areas whose slalom stretch (R31) is a real slalom hill — the drop,
// the pitch, the combinations, the bot home clean near the slalom's minute;
// a downhill's the black courses with a downhill's vertical and length under
// them (R32), the bot home with no net, no out and no harsh landing. Each
// ladder runs from the gentlest to the hardest, across the countries a race
// is raced in and the days it is raced on. All nine are open: the campaign
// is the ladder, and it keeps its own shelves (`campaign-levels.ts`).
//
// A row has a campaign map's shape (`CampaignLevel`) on purpose, so every
// question already asked of a pinned map — what it builds, the sky it is
// skied under, whether a map standing is the one asked for, the run stood up
// on it, the record book's row — is asked of a race map the same way. LIKE
// A CAMPAIGN MAP, each names the generator that built it and carries the
// DIGEST of the map that came out (`levelDigest`), and `tests/race_maps_test.ts`
// rebuilds every one and holds it to it: a rule moving under one is a red
// suite, never a silent re-roll. Every one was curated on the generator
// current at the time, so its seed, country and grade — what the pause card
// prints — build the same mountain in a free ride.
//
// A MAP IS NAMED FOR WHAT IT IS LIKE, never for where it is.
//
// DOM-free and storage-free: the card, the app, the routes script and the
// suite read one statement of it.

import { DISCIPLINES, type Discipline, type GameMode } from "@engine";

import type { CampaignLevel } from "./campaign-levels.ts";

/** A RACE MAP: a pinned map raced as its discipline, with the course's own
 * figures quoted so its box can bill them without building it — held to the
 * built course by `tests/race_maps_test.ts`. */
export type RaceMap = CampaignLevel & {
  figures: {
    /** The course's vertical drop, start wand to finish line, m. */
    vertical: number;
    /** Its length down the piste, m. */
    length: number;
  };
};

/** The level card's maps for a discipline that has its own. */
export type RaceMaps = { readonly [D in Discipline]?: readonly RaceMap[] };

/** THE SLALOM'S NINE, the gentlest first. */
const SLALOM_MAPS: readonly RaceMap[] = [
  {
    id: "slalom-1",
    name: "Soft Rhythm",
    blurb: "A gentle maritime pitch to find the rhythm on",
    seed: 2,
    mode: "slalom",
    laps: 1,
    version: 5,
    digest: "91d2bdd9",
    region: "maritime",
    grade: "red",
    course: "4",
    day: { weather: "fair", hour: 13.7 },
    figures: { vertical: 160, length: 596 },
  },
  {
    id: "slalom-2",
    name: "Afternoon Hill",
    blurb: "A short alpine hill in the afternoon sun",
    seed: 1,
    mode: "slalom",
    laps: 1,
    version: 5,
    digest: "a0889dc5",
    grade: "red",
    course: "4",
    day: { weather: "fair", hour: 15.6 },
    figures: { vertical: 140, length: 468 },
  },
  {
    id: "slalom-3",
    name: "Long Pitch",
    blurb: "Nearly two hundred metres of even alpine pitch",
    seed: 17,
    mode: "slalom",
    laps: 1,
    version: 5,
    digest: "f6d5e1ec",
    grade: "red",
    course: "7",
    day: { weather: "fair", hour: 12.8 },
    figures: { vertical: 191, length: 572 },
  },
  {
    id: "slalom-4",
    name: "Thin Light",
    blurb: "A steep continental pitch under high cloud",
    seed: 33,
    mode: "slalom",
    laps: 1,
    version: 5,
    digest: "dd22b6ef",
    region: "continental",
    grade: "red",
    course: "3",
    day: { weather: "high", hour: 15.7 },
    figures: { vertical: 160, length: 512 },
  },
  {
    id: "slalom-5",
    name: "Snow Gates",
    blurb: "Falling snow on a steep maritime hill",
    seed: 3,
    mode: "slalom",
    laps: 1,
    version: 5,
    digest: "5091c32a",
    region: "maritime",
    grade: "red",
    course: "11",
    day: { weather: "snow", hour: 13.1 },
    figures: { vertical: 161, length: 512 },
  },
  {
    id: "slalom-6",
    name: "Floodlit",
    blurb: "A night slalom under the masts, on a steep continental face",
    seed: 31,
    mode: "slalom",
    laps: 1,
    version: 5,
    digest: "cf58b0e0",
    region: "continental",
    grade: "red",
    course: "4",
    sky: { hour: 20 },
    day: { weather: "fair", hour: 20 },
    figures: { vertical: 190, length: 558 },
  },
  {
    id: "slalom-7",
    name: "Clear Wall",
    blurb: "A long, steep maritime wall on a clear day",
    seed: 34,
    mode: "slalom",
    laps: 1,
    version: 5,
    digest: "491281cf",
    region: "maritime",
    grade: "red",
    course: "7",
    day: { weather: "clear", hour: 11.8 },
    figures: { vertical: 191, length: 614 },
  },
  {
    id: "slalom-8",
    name: "Black Pitch",
    blurb: "A short black alpine pitch, steep from the door",
    seed: 46,
    mode: "slalom",
    laps: 1,
    version: 5,
    digest: "d257e4e7",
    grade: "black",
    course: "8",
    day: { weather: "clear", hour: 14.1 },
    figures: { vertical: 140, length: 480 },
  },
  {
    id: "slalom-9",
    name: "Headwall",
    blurb: "The steepest of the nine: a continental black wall",
    seed: 47,
    mode: "slalom",
    laps: 1,
    version: 5,
    digest: "05cf86e0",
    region: "continental",
    grade: "black",
    course: "11",
    day: { weather: "fair", hour: 12.6 },
    figures: { vertical: 191, length: 420 },
  },
];

/** THE DOWNHILL'S NINE, the gentlest first. */
const DOWNHILL_MAPS: readonly RaceMap[] = [
  {
    id: "downhill-1",
    name: "Short Course",
    blurb: "Five hundred metres of vertical to learn the speed on",
    seed: 55,
    mode: "downhill",
    laps: 1,
    version: 5,
    digest: "520b7f31",
    grade: "black",
    course: "12",
    day: { weather: "clear", hour: 9.8 },
    figures: { vertical: 552, length: 2018 },
  },
  {
    id: "downhill-2",
    name: "Glider",
    blurb: "Long, gentle continental pitches: a glider's course",
    seed: 48,
    mode: "downhill",
    laps: 1,
    version: 5,
    digest: "7577b211",
    region: "continental",
    grade: "black",
    course: "7",
    day: { weather: "fair", hour: 15.9 },
    figures: { vertical: 873, length: 2558 },
  },
  {
    id: "downhill-3",
    name: "Air Time",
    blurb: "Six jumps, and the fastest trap of the nine",
    seed: 16,
    mode: "downhill",
    laps: 1,
    version: 5,
    digest: "f816bc4a",
    region: "continental",
    grade: "black",
    course: "7",
    day: { weather: "fair", hour: 17.4 },
    figures: { vertical: 792, length: 2514 },
  },
  {
    id: "downhill-4",
    name: "Grey Day",
    blurb: "Nearly a thousand metres under an overcast",
    seed: 18,
    mode: "downhill",
    laps: 1,
    version: 5,
    digest: "6dff5df1",
    grade: "black",
    course: "9",
    day: { weather: "overcast", hour: 16.3 },
    figures: { vertical: 949, length: 2675 },
  },
  {
    id: "downhill-5",
    name: "January",
    blurb: "Flurries out of a January sky",
    seed: 36,
    mode: "downhill",
    laps: 1,
    version: 5,
    digest: "11ae4a47",
    grade: "black",
    course: "7",
    day: { weather: "flurries", hour: 16.3 },
    figures: { vertical: 941, length: 2630 },
  },
  {
    id: "downhill-6",
    name: "Night Run",
    blurb: "A thousand metres of downhill under the floodlights",
    seed: 38,
    mode: "downhill",
    laps: 1,
    version: 5,
    digest: "b5a34ea8",
    grade: "black",
    course: "8",
    sky: { hour: 20 },
    day: { weather: "clear", hour: 20 },
    figures: { vertical: 1033, length: 2866 },
  },
  {
    id: "downhill-7",
    name: "Five Jumps",
    blurb: "A thousand metres of continental face, and five jumps on it",
    seed: 53,
    mode: "downhill",
    laps: 1,
    version: 5,
    digest: "0c8d446a",
    region: "continental",
    grade: "black",
    course: "7",
    day: { weather: "fair", hour: 13 },
    figures: { vertical: 1032, length: 2842 },
  },
  {
    id: "downhill-8",
    name: "Long Morning",
    blurb: "The longest of the nine, in the morning light",
    seed: 41,
    mode: "downhill",
    laps: 1,
    version: 5,
    digest: "b3d40a02",
    grade: "black",
    course: "9",
    day: { weather: "fair", hour: 9.7 },
    figures: { vertical: 1056, length: 2965 },
  },
  {
    id: "downhill-9",
    name: "The Wall",
    blurb: "Eleven hundred metres off the steepest start of them all",
    seed: 52,
    mode: "downhill",
    laps: 1,
    version: 5,
    digest: "4629bd2a",
    region: "continental",
    grade: "black",
    course: "8",
    day: { weather: "overcast", hour: 13.6 },
    figures: { vertical: 1088, length: 2756 },
  },
];

/** EVERY DISCIPLINE'S NINE. A discipline built later adds its row here. */
export const RACE_MAPS: RaceMaps = {
  slalom: SLALOM_MAPS,
  downhill: DOWNHILL_MAPS,
};

/** The discipline a mode races, where it races one. */
export function disciplineOf(mode: GameMode): Discipline | null {
  return DISCIPLINES.find((d) => d.mode === mode)?.id ?? null;
}

/** THE RACE MAPS A MODE IS RACED ON, or null where it rides the campaign's
 * (the time trial) or measures nothing (the free ride, the tricks run). */
export function raceMapsOf(mode: GameMode): readonly RaceMap[] | null {
  const discipline = disciplineOf(mode);
  const maps = discipline === null ? undefined : RACE_MAPS[discipline];
  return maps && maps.length > 0 ? maps : null;
}

/** The race map named by an id among a mode's, or null where the id names
 * none of them (a fresh app, a stale stored id). */
export function raceMapFor(mode: GameMode, id: string | null | undefined): RaceMap | null {
  return raceMapsOf(mode)?.find((map) => map.id === id) ?? null;
}

/** The race map an id names, in any discipline — what a stored pick and a
 * pick off the level card are held to. */
export function findRaceMap(id: unknown): RaceMap | null {
  if (typeof id !== "string") return null;
  for (const maps of Object.values(RACE_MAPS)) {
    const found = maps?.find((map) => map.id === id);
    if (found) return found;
  }
  return null;
}

/** THE DISCIPLINES' PICKS as the settings keep them: one race map's id per
 * discipline. */
export type RacePicks = { readonly [D in Discipline]?: string };

/** A stored blob as picks: every id kept that names a map of its own
 * discipline, everything else dropped. */
export function mergeRacePicks(blob: unknown): RacePicks {
  const out: { [D in Discipline]?: string } = {};
  if (typeof blob !== "object" || blob === null) return out;
  for (const { id } of DISCIPLINES) {
    const pick = (blob as Record<string, unknown>)[id];
    if (typeof pick === "string" && RACE_MAPS[id]?.some((map) => map.id === pick)) out[id] = pick;
  }
  return out;
}
