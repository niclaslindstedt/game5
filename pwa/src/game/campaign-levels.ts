// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN'S SHELVES, and the six maps each of them runs. Every map is a
// SEED in a KIND OF SNOW COUNTRY (R21), built to a PISTE GRADE (R23) and,
// where the ladder needs one, the sky it is skied under — the maps are
// generated, not authored — so a shelf is a short table of them with the
// name the menu shows. Curating one is `make rate CAMPAIGN=1` and `make
// difficulty CAMPAIGN=1`'s job, and the numbers here are their output.
//
// EVERY MAP NAMES THE GENERATOR THAT BUILT IT (`engine/mapgen/versions.ts`)
// and carries the DIGEST of the map that came out, and both are written out
// on every map rather than shared from a constant on purpose: a shared
// version is a single edit that re-rolls the whole campaign, which is the
// implicit move the field exists to make impossible, and a digest is a claim
// about ONE map. `tests/generator_version_test.ts` rebuilds every map and
// holds it to its digest, so a rule moving under one of these is a red suite
// rather than a silent re-roll — and when it goes red, the question is which
// of the two it was: a map deliberately moved (write the new digest down,
// re-rate, re-time, re-name), or the rules moving out from under one (add a
// version row, keep the old behaviour on the old row).
//
// A MAP IS NAMED FOR WHAT IT IS LIKE, never for where it is: the snow, the
// light, the shape of the ask. A region is a kind of country and no place.
//
// FOUR SHELVES, A GRADE EACH — the colours a piste is signed with, gentlest
// first (R23), each in the kind of country that grade belongs in:
//
//   THE NURSERY  GREEN runs on the FELL: low rounded country, the whole of
//                every piste under 16 % and most of it under 10 %, wide,
//                groomed, bright days — the first turns.
//   THE WOODS    BLUE runs in the MARITIME: under 27 %, the firs walling
//                the piste, the first low kickers, the first dusk.
//   THE RIDGE    RED runs in the ALPINE: under 47 %, a downhill course's
//                pitch, kickers down it, storms and fog.
//   THE GLACIER  BLACK runs on the CONTINENTAL: over a thousand metres of
//                vertical, steep from the start hut, the pitches past 70 %,
//                DROPS across the piste (R24), cliffs beside it, the most
//                kickers and a third of it ungroomed.
//
// The ladder was re-cut by grade when the generator learned to build one
// (v2): the three shelves before it billed colours their maps did not
// measure — every one of those pistes read black on its steepest hundred
// metres — and a colour on a shelf that is not the colour on the piste is
// the lie the grades exist to end. Its ids are the grades' (`green-1` …),
// so no row of the board or the record book the old ladder kept lands on a
// map it was not ridden on.
//
// THE RUNG ORDER is a race, a time trial, two races, a time trial and a race
// — six rungs, so four races around two trials, and the race both OPENS and
// CLOSES a shelf. Every rung asks more than the one before it on `make rate
// CAMPAIGN=1`'s index, and the seeds were picked from sweeps of forty-eight
// seeds a shelf in its own grade and country (`make rate COUNT=48 ARGS="--from
// 101 --grade green --region fell --sim"`, 201… blue on the maritime, 301…
// red on the alpine, 401… black on the continental — seeds no map before
// them used) on the brief the rating module's header states: climb without
// a wall, no two rungs the same map twice, and every kind of ask led on
// somewhere. The nursery's are its daylight seeds only: a green is not
// skied into the dark.
//
// EVERY MAP IS SKIED ON THE HOUR, THE SEASON AND THE SKY ITS SEED DEALT
// (R15, R19), the face turned to that sun (R15): no rung lays a sky over the
// dealt one today, so the dark on the later shelves is the evenings R19
// hands out and not a lamp turned off by hand. A `sky` may still be pinned
// on a rung (`withSky`); it moves nothing the generator builds and so
// nothing the digest reads, but the rating reads it (its weather axis).
//
// THE MEDALS on a time trial are set against the bot's own run of it — the
// all-mountain pair skied by the bot from the start gate to the finish,
// which is what the curation loop measures (`make rate CAMPAIGN=1` prints it
// beside them). SILVER IS THE BOT'S TIME and three per cent; BRONZE is an
// eighth slower than the bot, because a medal is the DOOR to the next rung
// and nothing else; GOLD is two per cent under it, a clean run the bot does
// not ski.

import type { GeneratorVersion, PisteGrade, RegionId, SkyOverride, WeatherKind } from "@engine";

/** The two games a campaign map is played as. A free ride measures nothing,
 * so it is never a rung. */
export type CampaignMode = "race" | "timeTrial";

/** The three medals a time trial pays, worst first. */
export const MEDALS = ["bronze", "silver", "gold"] as const;
export type Medal = (typeof MEDALS)[number];

export type CampaignLevel = {
  id: string;
  name: string;
  /** One line of billing on the map's box. */
  blurb: string;
  seed: number;
  mode: CampaignMode;
  /** Runs to the finish: always R16's one — a piste is skied top to bottom. */
  laps: number;
  /** WHICH GENERATOR built this map (`mapgen/versions.ts`). Required on
   * every map rather than on the shelf, because it is the one thing about a
   * campaign map that a change somewhere else can take away. */
  version: GeneratorVersion;
  /** The fingerprint of the map this rung was curated on, as `levelDigest`
   * reads it — `make rate CAMPAIGN=1` prints the one that builds today. */
  digest: string;
  /** THE KIND OF SNOW COUNTRY the map is built in (R21): a shelf's own —
   * the alpine when left out. Part of what the digest names. */
  region?: RegionId;
  /** THE PISTE GRADE the map is built to (R23): its shelf's colour, written
   * out on every map for the reason the version is. Part of what the digest
   * names. */
  grade: PisteGrade;
  /** A sky or a start hour laid over the dealt day (see the header). */
  sky?: SkyOverride;
  /** THE DAY the map is ridden in — its sky and the solar hour the run
   * starts at, `sky` laid over the seed's own — quoted here so a box can
   * bill it without building the map, and held to the built map by
   * `tests/generator_version_test.ts`. */
  day: { weather: WeatherKind; hour: number };
  /** A time trial's three medals, seconds over its laps — lower is better. */
  medals?: Record<Medal, number>;
};

export type CampaignShelf = {
  /** The shelf's GRADE (R23) — the colour every map on it is built to, the
   * sign on its tab, and the stem of its maps' ids. */
  id: PisteGrade;
  name: string;
  blurb: string;
  levels: readonly CampaignLevel[];
};

/** THE FIRST SHELF — open to everyone: green runs on the fell, bright days,
 * wide gentle pistes to learn the edge on, a roll or two for the first air. */
const NURSERY: CampaignShelf = {
  id: "green",
  name: "Nursery",
  blurb: "Green runs on the fell: wide, gentle, bright days, the first turns",
  levels: [
    {
      id: "green-1",
      name: "First Tracks",
      blurb: "A wide green run down the bare fell on a fair spring morning, two little rolls",
      seed: 132,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "5a10f247",
      region: "fell",
      grade: "green",
      day: { weather: "fair", hour: 9.98 },
    },
    {
      id: "green-2",
      name: "Birch Meadow",
      blurb: "Alone against the clock between the birches under high cloud",
      seed: 131,
      mode: "timeTrial",
      laps: 1,
      version: 2,
      digest: "22cba922",
      region: "fell",
      grade: "green",
      day: { weather: "high", hour: 12.26 },
      medals: { gold: 312, silver: 328, bronze: 358 },
    },
    {
      id: "green-3",
      name: "Long Traverse",
      blurb: "A fair March morning, the piste wandering wide across the gentle face",
      seed: 114,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "a5984219",
      region: "fell",
      grade: "green",
      day: { weather: "fair", hour: 11.5 },
    },
    {
      id: "green-4",
      name: "Low Sun",
      blurb: "A February sun low over the fell, and one roll to take air off",
      seed: 145,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "d0e29db8",
      region: "fell",
      grade: "green",
      day: { weather: "fair", hour: 10.23 },
    },
    {
      id: "green-5",
      name: "Clear Fell",
      blurb: "The clock again at a clear late-March noon, the longest green on the shelf",
      seed: 109,
      mode: "timeTrial",
      laps: 1,
      version: 2,
      digest: "ac0b55ec",
      region: "fell",
      grade: "green",
      day: { weather: "clear", hour: 12.98 },
      medals: { gold: 335, silver: 353, bronze: 385 },
    },
    {
      id: "green-6",
      name: "Birch Wall",
      blurb: "Through the thickest birches on the fell — the woods close in on either side",
      seed: 112,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "b2b9b18d",
      region: "fell",
      grade: "green",
      day: { weather: "fair", hour: 10.93 },
    },
  ],
};

/** THE SECOND SHELF — blue runs in the maritime: the firs walling the line,
 * deep snow beside it, the first low kickers, the first dusk. */
const WOODS: CampaignShelf = {
  id: "blue",
  name: "Woods",
  blurb: "Blue runs through the firs: deep snow, low kickers, the first dusk",
  levels: [
    {
      id: "blue-1",
      name: "Fir Glades",
      blurb: "A clear January noon and three low kickers between the rimed firs",
      seed: 202,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "8d644af6",
      region: "maritime",
      grade: "blue",
      day: { weather: "clear", hour: 12.99 },
    },
    {
      id: "blue-2",
      name: "Afternoon Firs",
      blurb: "Against the clock in a fair afternoon's low light, the woods on both edges",
      seed: 205,
      mode: "timeTrial",
      laps: 1,
      version: 2,
      digest: "92adfc97",
      region: "maritime",
      grade: "blue",
      day: { weather: "fair", hour: 15.59 },
      medals: { gold: 293, silver: 308, bronze: 336 },
    },
    {
      id: "blue-3",
      name: "Deep Snow Line",
      blurb: "A clear March morning, a fifth of the piste under drifted snow",
      seed: 235,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "09dccef2",
      region: "maritime",
      grade: "blue",
      day: { weather: "clear", hour: 11.34 },
    },
    {
      id: "blue-4",
      name: "Dusk Among the Firs",
      blurb: "Out of the last of the sun into the dusk, the firs dark either side",
      seed: 212,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "a78023ff",
      region: "maritime",
      grade: "blue",
      day: { weather: "fair", hour: 18.43 },
    },
    {
      id: "blue-5",
      name: "Clear Night",
      blurb: "The clock at nightfall under a clear sky, the arena's floodlights ahead",
      seed: 240,
      mode: "timeTrial",
      laps: 1,
      version: 2,
      digest: "252c814c",
      region: "maritime",
      grade: "blue",
      day: { weather: "clear", hour: 18.4 },
      medals: { gold: 312, silver: 328, bronze: 358 },
    },
    {
      id: "blue-6",
      name: "Night Snowfall",
      blurb: "The last blue race, in a steady snowfall after dark",
      seed: 218,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "0f9b83ef",
      region: "maritime",
      grade: "blue",
      day: { weather: "snow", hour: 18.61 },
    },
  ],
};

/** THE THIRD SHELF — red runs in the alpine: a downhill course's pitch, the
 * kickers down it, the storms and the fog. */
const RIDGE: CampaignShelf = {
  id: "red",
  name: "Ridge",
  blurb: "Red runs in the alpine: a downhill course's pitch, kickers, storms",
  levels: [
    {
      id: "red-1",
      name: "Ridge Traverse",
      blurb: "A fair midday on the alpine face, long traverses and four kickers",
      seed: 348,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "08b9b71e",
      region: "alpine",
      grade: "red",
      day: { weather: "fair", hour: 12.68 },
    },
    {
      id: "red-2",
      name: "Six Kickers",
      blurb: "The clock on a fair late-winter morning, over six kickers and the drifts",
      seed: 303,
      mode: "timeTrial",
      laps: 1,
      version: 2,
      digest: "4944e323",
      region: "alpine",
      grade: "red",
      day: { weather: "fair", hour: 10.67 },
      medals: { gold: 305, silver: 320, bronze: 350 },
    },
    {
      id: "red-3",
      name: "Storm Face",
      blurb: "A blizzard at midday, a third of the piste drifted and the next gate lost",
      seed: 307,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "4c52897a",
      region: "alpine",
      grade: "red",
      day: { weather: "storm", hour: 13.53 },
    },
    {
      id: "red-4",
      name: "Whiteout",
      blurb: "Another storm, the spindrift off the crests and six kickers in it",
      seed: 312,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "f75eb099",
      region: "alpine",
      grade: "red",
      day: { weather: "storm", hour: 13.48 },
    },
    {
      id: "red-5",
      name: "Night Clock",
      blurb: "Against the clock deep into a clear night, under the moon",
      seed: 314,
      mode: "timeTrial",
      laps: 1,
      version: 2,
      digest: "b0ddd4c9",
      region: "alpine",
      grade: "red",
      day: { weather: "fair", hour: 21.22 },
      medals: { gold: 324, silver: 340, bronze: 372 },
    },
    {
      id: "red-6",
      name: "Into the Fog",
      blurb: "The last red race, into a fog lying over the lower mountain at dusk",
      seed: 337,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "b49f0620",
      region: "alpine",
      grade: "red",
      day: { weather: "fog", hour: 17.94 },
    },
  ],
};

/** THE FOURTH SHELF — black runs on the continental: over a thousand metres
 * of vertical, steep from the hut, drops across the piste and cliffs beside
 * it, the most kickers, a third of it ungroomed. */
const GLACIER: CampaignShelf = {
  id: "black",
  name: "Glacier",
  blurb: "Black runs on the continental: steep from the hut, drops, cliffs, air",
  levels: [
    {
      id: "black-1",
      name: "First Drops",
      blurb: "A fair morning, off the hut onto a 70 % pitch and three drops across the piste",
      seed: 433,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "33e88052",
      region: "continental",
      grade: "black",
      day: { weather: "fair", hour: 11.09 },
    },
    {
      id: "black-2",
      name: "Steep Snowfall",
      blurb: "The clock in a steady snowfall, down eleven hundred metres of black",
      seed: 419,
      mode: "timeTrial",
      laps: 1,
      version: 2,
      digest: "f9be9b4b",
      region: "continental",
      grade: "black",
      day: { weather: "snow", hour: 13.67 },
      medals: { gold: 303, silver: 318, bronze: 348 },
    },
    {
      id: "black-3",
      name: "Eight Kickers",
      blurb: "Snow falling, eight kickers and four drops — the most air on the mountain",
      seed: 406,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "ab3eb4a8",
      region: "continental",
      grade: "black",
      day: { weather: "snow", hour: 10.31 },
    },
    {
      id: "black-4",
      name: "Storm Drops",
      blurb: "A blizzard at nightfall and five drops across the piste",
      seed: 436,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "083dac4e",
      region: "continental",
      grade: "black",
      day: { weather: "storm", hour: 18.27 },
    },
    {
      id: "black-5",
      name: "Ungroomed",
      blurb: "The clock in the snow, a third of the piste left to the wind",
      seed: 404,
      mode: "timeTrial",
      laps: 1,
      version: 2,
      digest: "db45ff0d",
      region: "continental",
      grade: "black",
      day: { weather: "snow", hour: 13.41 },
      medals: { gold: 305, silver: 320, bronze: 350 },
    },
    {
      id: "black-6",
      name: "The Wall",
      blurb: "The last race: a January morning down the steepest black on the mountain",
      seed: 411,
      mode: "race",
      laps: 1,
      version: 2,
      digest: "cb2d7637",
      region: "continental",
      grade: "black",
      day: { weather: "fair", hour: 10.01 },
    },
  ],
};

/** The shelves in the order they open, gentlest first. */
export const SHELVES: readonly CampaignShelf[] = [NURSERY, WOODS, RIDGE, GLACIER];

/** Every campaign map, shelf by shelf, in the order they are played. */
export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = SHELVES.flatMap((shelf) => shelf.levels);
