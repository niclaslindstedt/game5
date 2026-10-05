// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE MAPS — every race discipline's own NINE pinned maps, off the
// campaign: nine seeds whose course makes a GOOD race of that discipline, a
// ladder from the gentlest to the hardest by the rating's index, all of them
// open from the first visit. The level card a discipline's race opens shows
// its nine (`menu-levels.tsx`), and a measured run of it is on the one
// picked there (`pinnedFor`, `Settings.raceMap`). The campaign is not
// touched: a campaign rung that is a race is still skied on its own shelf's
// map. A discipline with no rows here keeps the campaign's maps.
//
// Each row is a pinned map in the campaign's own shape (`CampaignLevel`) —
// so the record book, the boxes, the day line and the run stood up on it
// are the campaign's — and LIKE A CAMPAIGN MAP it names the generator that
// built it and carries the DIGEST of the map that came out (`levelDigest`),
// written out on every row on purpose; `tests/race_maps_test.ts` rebuilds
// every row and holds it to it, so a rule moving under one is a red suite,
// never a silent re-roll. Every row is curated on the generator in this
// tree, so its seed, country and grade build the same mountain in a free
// ride. Nine different seeds a discipline, none of them a campaign shelf's
// or a trick map's.
//
// A MAP IS NAMED FOR WHAT IT IS LIKE, never for where it is.
//
// DOM-free and storage-free: the cards, the app, the routes script and the
// suite read one statement of it.

import type { Discipline, GameMode } from "@engine";

import type { CampaignLevel } from "./campaign-levels.ts";

/** THE SUPER-G'S NINE (R33), gentlest first by the rating's index — curated
 * off a sweep of seeds 1–64 in the alpine and 1–34 in the continental and
 * the maritime (108 of 114 skied home by the bot): three reds and six
 * blacks, three in each country, 430–600 m of vertical from a start lowered
 * down the area's biggest course, every sky the jury races in but a storm
 * and one race at night — the bot home on every one with no gate missed,
 * no net and no harsh landing, within a few per cent of par. */
const SUPER_G_MAPS: readonly CampaignLevel[] = [
  {
    id: "superg-1",
    name: "Long Reach",
    blurb: "A maritime red under a clear sky: long open turns over 550 m and no jump",
    seed: 33,
    mode: "superG",
    laps: 1,
    version: 5,
    digest: "ca2ed4b9",
    region: "maritime",
    grade: "red",
    course: "12",
    day: { weather: "clear", hour: 11.16 },
  },
  {
    id: "superg-2",
    name: "High Veil",
    blurb: "A short maritime red under high cloud, turn after turn down 430 m",
    seed: 12,
    mode: "superG",
    laps: 1,
    version: 5,
    digest: "62f6538d",
    region: "maritime",
    grade: "red",
    course: "11",
    day: { weather: "high", hour: 13.01 },
  },
  {
    id: "superg-3",
    name: "Grey Lid",
    blurb: "An alpine red under an overcast, the flat light hiding its one roll: 600 m",
    seed: 30,
    mode: "superG",
    laps: 1,
    version: 5,
    digest: "1664fbed",
    grade: "red",
    course: "6",
    day: { weather: "overcast", hour: 12.74 },
  },
  {
    id: "superg-4",
    name: "Dry Cold",
    blurb: "The first black: cold dry snow on the continental face, a clear sky, 565 m",
    seed: 25,
    mode: "superG",
    laps: 1,
    version: 5,
    digest: "8d26c0ab",
    region: "continental",
    grade: "black",
    course: "9",
    day: { weather: "clear", hour: 11.71 },
  },
  {
    id: "superg-5",
    name: "Long Air",
    blurb: "Clear and fast: 600 m of black over three jumps, the biggest air of the nine",
    seed: 38,
    mode: "superG",
    laps: 1,
    version: 5,
    digest: "b5a34ea8",
    grade: "black",
    course: "8",
    day: { weather: "clear", hour: 11.07 },
  },
  {
    id: "superg-6",
    name: "Snowline",
    blurb: "Raced in a steady snowfall: 600 m of maritime red and fifty-four gates",
    seed: 3,
    mode: "superG",
    laps: 1,
    version: 5,
    digest: "662bd11e",
    region: "maritime",
    grade: "red",
    course: "7",
    day: { weather: "snow", hour: 11.4 },
  },
  {
    id: "superg-7",
    name: "Flurry Wall",
    blurb: "A continental black, flurries out of a sunny sky, two jumps in under two kilometres",
    seed: 29,
    mode: "superG",
    laps: 1,
    version: 5,
    digest: "fc0efe73",
    region: "continental",
    grade: "black",
    course: "8",
    day: { weather: "flurries", hour: 14.32 },
  },
  {
    id: "superg-8",
    name: "Floodlit",
    blurb: "The night race: 600 m of black under the floodlights, two jumps in the dark",
    seed: 44,
    mode: "superG",
    laps: 1,
    version: 5,
    digest: "18b31f4e",
    grade: "black",
    course: "9",
    day: { weather: "fair", hour: 19.54 },
  },
  {
    id: "superg-9",
    name: "Grey Out",
    blurb: "The hardest: a continental black in the valley fog, the gates coming out of the grey",
    seed: 1,
    mode: "superG",
    laps: 1,
    version: 5,
    digest: "de6b74c7",
    region: "continental",
    grade: "black",
    course: "7",
    day: { weather: "fog", hour: 13.98 },
  },
];

/** EVERY DISCIPLINE'S MAPS, where it has its own. */
export const RACE_MAPS: Readonly<Partial<Record<Discipline, readonly CampaignLevel[]>>> = {
  superG: SUPER_G_MAPS,
};

/** The discipline a mode races, or null for a mode that is none. */
export function disciplineOf(mode: GameMode): Discipline | null {
  return mode === "slalom" || mode === "downhill" || mode === "superG" ? mode : null;
}

/** A mode's own race maps, or null where it rides the campaign's. */
export function raceMapsFor(mode: GameMode): readonly CampaignLevel[] | null {
  const d = disciplineOf(mode);
  const rows = d ? RACE_MAPS[d] : undefined;
  return rows && rows.length > 0 ? rows : null;
}

/** The race map an id names, of any discipline, or null. */
export function findRaceMap(id: string): CampaignLevel | null {
  for (const rows of Object.values(RACE_MAPS)) {
    const hit = rows?.find((row) => row.id === id);
    if (hit) return hit;
  }
  return null;
}
