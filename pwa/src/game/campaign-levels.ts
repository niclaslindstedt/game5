// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN'S SHELVES, and the six maps each of them runs. Every map is a
// SEED's ski area in a KIND OF SNOW COUNTRY (R21), raced down one of its
// COURSES (R28) of a PISTE GRADE (R23) and, where the ladder needs one, the
// sky it is skied under — the maps are generated, not authored — so a shelf
// is a short table of them with the name the menu shows. Curating one is `make rate CAMPAIGN=1` and `make
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
// FOUR SHELVES, FOUR SKI AREAS. A shelf is ONE seed's resort on the
// generator that builds ski areas (v3, R25–R28): a massif with its lifts,
// its runs of every colour and its lanes down to the village — and its six
// maps are six of that area's COURSES (R28), each the line from a top
// station down the network to the village, raced through its own gates. The
// whole mountain is there on every rung — a skier may leave the course and
// ski anywhere on it — but the points are paid down the one course the rung
// races. Every map of a shelf names the same seed and country, so the six
// are one resort the generator builds once.
//
// THE CAMPAIGN RACES RED AND BLACK. The greens and the blues are the free
// ride's; a rung is a red or a black, with ONE blue to warm up on — the
// very first rung of the first shelf. The shelves blacken as they climb,
// and the blacks are ordered by how hard they really are on the rating's
// index (`make rate CAMPAIGN=1`) — the steepest pitch, the drop, the air,
// the drops across the piste — because two blacks can be a world apart:
// the early shelves' are the raceable ones, the last shelf's the brutal.
//
//   RIME WOODS   MARITIME, seed 38: deep snow and rimed firs; a blue to
//                warm up on, then five reds, the last into the night.
//   HIGH CIRQUE  ALPINE, seed 38: four reds off the cirque, then the first
//                two blacks — a forgiving one, then a thousand metres of it.
//   FROST BASIN  CONTINENTAL, seed 12: cold dry snow; three reds, then
//                three blacks with drops across the piste.
//   COLD CREST   CONTINENTAL, seed 16: one red, then the five hardest
//                blacks in the game, the last six drops in a fog.
//
// The FELL has no shelf: its ski areas are gentle by nature — no black on
// any of the first forty seeds and never more than two reds — so it is the
// free ride's country. The maritime opens because its reds are the gentlest
// (no black at all), the alpine follows because it offers two blacks at
// most, and the continental, the steepest country, hosts the last two
// shelves on two different massifs.
//
// The areas were picked from sweeps of forty seeds a country (`make resort
// COUNT=40 REGION=…`): the ones with six red-and-black courses (or a blue
// and five reds) that stand clean, every course finished by the bot, and a
// plan that reads as a ski area somebody laid out. Within a shelf the rungs
// climb on the index; across the shelves the share of black climbs (0, 2,
// 3, 5) and so does the shelf's mean ask.
//
// THE RUNG ORDER is a race, a time trial, two races, a time trial and a race
// — six rungs, so four races around two trials, and the race both OPENS and
// CLOSES a shelf.
//
// EVERY MAP IS SKIED ON THE HOUR, THE SEASON AND THE SKY ITS COURSE WAS
// DEALT (R15, R19 — each course of a resort is dealt a day of its own): no
// rung lays a sky over it today. A `sky` may still be pinned on a rung
// (`withSky`); it moves nothing the generator builds and so nothing the
// digest reads, but the rating reads it (its weather axis).
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
  /** THE PISTE GRADE of the course raced (R23) — red or black, the one blue
   * the first rung — quoted so a box can sign it without building the map,
   * and held to the built map by `tests/generator_version_test.ts`. */
  grade: PisteGrade;
  /** THE COURSE of the seed's ski area this map is raced down (R28,
   * `Resort.course`): the run the gates are on and the points are paid
   * down, by its id. Part of what the digest names. */
  course: string;
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
  /** The stem of its maps' ids (`rime-1` …), and the shelf's key on the
   * developer page's UNLOCKS. */
  id: string;
  /** The ski area's name — invented, and named for what it is like. */
  name: string;
  blurb: string;
  /** THE SKI AREA: the seed every map of the shelf is built from, and the
   * country it stands in (R21) — restated on every map, held equal by
   * `tests/campaign_test.ts`. */
  seed: number;
  region: RegionId;
  levels: readonly CampaignLevel[];
};

/** THE FIRST SHELF — open to everyone: a maritime ski area, deep snow and
 * rimed firs; the one blue to warm up on, then five reds, the last at night. */
const RIME_WOODS: CampaignShelf = {
  id: "rime",
  name: "Rime Woods",
  blurb: "Deep snow and rimed firs: one blue to warm up on, then the reds",
  seed: 38,
  region: "maritime",
  levels: [
    {
      id: "rime-1",
      name: "Blue Opener",
      blurb: "The one blue: wide turns through the rimed firs on a clear noon, two low kickers",
      seed: 38,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "eaecc566",
      region: "maritime",
      grade: "blue",
      course: "4",
      day: { weather: "clear", hour: 13.73 },
    },
    {
      id: "rime-2",
      name: "First Red",
      blurb: "Against the clock down the first red, four hundred metres of drop in the sun",
      seed: 38,
      mode: "timeTrial",
      laps: 1,
      version: 3,
      digest: "594877b7",
      region: "maritime",
      grade: "red",
      course: "13",
      day: { weather: "clear", hour: 14.93 },
      medals: { gold: 172, silver: 181, bronze: 198 },
    },
    {
      id: "rime-3",
      name: "Storm Line",
      blurb: "A short red raced into a storm, the next gate lost in the spindrift",
      seed: 38,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "058f3527",
      region: "maritime",
      grade: "red",
      course: "5",
      day: { weather: "storm", hour: 14.42 },
    },
    {
      id: "rime-4",
      name: "Lift to Village",
      blurb: "The longest red on the hill, three runs joined from the top lift to the village",
      seed: 38,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "43531355",
      region: "maritime",
      grade: "red",
      course: "8",
      day: { weather: "clear", hour: 12.79 },
    },
    {
      id: "rime-5",
      name: "Dusk Kickers",
      blurb: "The clock at dusk, over five kickers between the firs",
      seed: 38,
      mode: "timeTrial",
      laps: 1,
      version: 3,
      digest: "268a7fcf",
      region: "maritime",
      grade: "red",
      course: "3",
      day: { weather: "fair", hour: 18.98 },
      medals: { gold: 158, silver: 166, bronze: 181 },
    },
    {
      id: "rime-6",
      name: "Night Red",
      blurb: "The last red race after dark, six kickers and the arena's lights below",
      seed: 38,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "80f10a53",
      region: "maritime",
      grade: "red",
      course: "12",
      day: { weather: "fair", hour: 20.21 },
    },
  ],
};

/** THE SECOND SHELF — an alpine ski area under its cirque: four reds
 * down the fall line, then the first two blacks. */
const HIGH_CIRQUE: CampaignShelf = {
  id: "cirque",
  name: "High Cirque",
  blurb: "Reds off the cirque, then the first blacks: drops across the piste",
  seed: 38,
  region: "alpine",
  levels: [
    {
      id: "cirque-1",
      name: "Evening Red",
      blurb: "A short red in the low evening sun, four kickers down the fall line",
      seed: 38,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "fb8c1438",
      region: "alpine",
      grade: "red",
      course: "5",
      day: { weather: "clear", hour: 18.04 },
    },
    {
      id: "cirque-2",
      name: "Cirque Clock",
      blurb: "Against the clock from under the cirque, five kickers on a clear midday",
      seed: 38,
      mode: "timeTrial",
      laps: 1,
      version: 3,
      digest: "6303aef1",
      region: "alpine",
      grade: "red",
      course: "12",
      day: { weather: "clear", hour: 11.81 },
      medals: { gold: 178, silver: 187, bronze: 204 },
    },
    {
      id: "cirque-3",
      name: "Flurry Line",
      blurb: "Flurries out of a bright sky, a short red with five kickers on it",
      seed: 38,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "94ffff88",
      region: "alpine",
      grade: "red",
      course: "3",
      day: { weather: "flurries", hour: 15.35 },
    },
    {
      id: "cirque-4",
      name: "Long Red",
      blurb: "Seven hundred metres of red from the top lift under high cloud, six kickers",
      seed: 38,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "55bbc472",
      region: "alpine",
      grade: "red",
      course: "7",
      day: { weather: "high", hour: 17.0 },
    },
    {
      id: "cirque-5",
      name: "First Black",
      blurb: "The first black, against the clock: four drops across the piste in flat light",
      seed: 38,
      mode: "timeTrial",
      laps: 1,
      version: 3,
      digest: "cd8a5a76",
      region: "alpine",
      grade: "black",
      course: "11",
      day: { weather: "overcast", hour: 13.47 },
      medals: { gold: 135, silver: 142, bronze: 155 },
    },
    {
      id: "cirque-6",
      name: "Cirque Wall",
      blurb: "A thousand metres of black off the top, four drops on the steepest pitch",
      seed: 38,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "1b818b43",
      region: "alpine",
      grade: "black",
      course: "8",
      day: { weather: "clear", hour: 11.07 },
    },
  ],
};

/** THE THIRD SHELF — a continental ski area, cold dry snow: three reds,
 * then three blacks with drops across the piste. */
const FROST_BASIN: CampaignShelf = {
  id: "basin",
  name: "Frost Basin",
  blurb: "Cold dry snow: long reds, then three blacks with drops",
  seed: 12,
  region: "continental",
  levels: [
    {
      id: "basin-1",
      name: "Cold Morning",
      blurb: "A clear, cold morning and a short red to open the basin",
      seed: 12,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "f0ce43d1",
      region: "continental",
      grade: "red",
      course: "3",
      day: { weather: "clear", hour: 9.36 },
    },
    {
      id: "basin-2",
      name: "Fog Clock",
      blurb: "The clock down a short red into the valley fog",
      seed: 12,
      mode: "timeTrial",
      laps: 1,
      version: 3,
      digest: "4a66661a",
      region: "continental",
      grade: "red",
      course: "5",
      day: { weather: "fog", hour: 13.55 },
      medals: { gold: 126, silver: 132, bronze: 144 },
    },
    {
      id: "basin-3",
      name: "Three Runs",
      blurb: "Three runs joined top to bottom, six kickers on seven hundred metres of red",
      seed: 12,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "506411f5",
      region: "continental",
      grade: "red",
      course: "6",
      day: { weather: "clear", hour: 13.37 },
    },
    {
      id: "basin-4",
      name: "Five Drops",
      blurb: "A black under a grey sky, five drops across the piste",
      seed: 12,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "2dede74a",
      region: "continental",
      grade: "black",
      course: "9",
      day: { weather: "overcast", hour: 14.27 },
    },
    {
      id: "basin-5",
      name: "Flat Light",
      blurb: "Against the clock down eleven hundred metres of black in flat light",
      seed: 12,
      mode: "timeTrial",
      laps: 1,
      version: 3,
      digest: "da0d7cf5",
      region: "continental",
      grade: "black",
      course: "7",
      day: { weather: "overcast", hour: 13.16 },
      medals: { gold: 257, silver: 271, bronze: 296 },
    },
    {
      id: "basin-6",
      name: "Basin Wall",
      blurb: "The last race off the top of the basin: a thousand metres of black, three drops",
      seed: 12,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "842d9312",
      region: "continental",
      grade: "black",
      course: "8",
      day: { weather: "high", hour: 10.08 },
    },
  ],
};

/** THE FOURTH SHELF — the steepest continental ski area: one red, then the
 * five hardest blacks in the game. */
const COLD_CREST: CampaignShelf = {
  id: "crest",
  name: "Cold Crest",
  blurb: "The steepest blacks: drops, storms and fog — one red, then five blacks",
  seed: 16,
  region: "continental",
  levels: [
    {
      id: "crest-1",
      name: "Last Red",
      blurb: "The one red on the crest, seven kickers on the way down to the village",
      seed: 16,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "c93b24c4",
      region: "continental",
      grade: "red",
      course: "7",
      day: { weather: "fair", hour: 15.75 },
    },
    {
      id: "crest-2",
      name: "Black Clock",
      blurb: "The clock down a black of five kickers and two drops",
      seed: 16,
      mode: "timeTrial",
      laps: 1,
      version: 3,
      digest: "ea471389",
      region: "continental",
      grade: "black",
      course: "12",
      day: { weather: "fair", hour: 11.75 },
      medals: { gold: 171, silver: 179, bronze: 196 },
    },
    {
      id: "crest-3",
      name: "Storm Black",
      blurb: "A black raced into a storm, the spindrift off the crest",
      seed: 16,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "8c414892",
      region: "continental",
      grade: "black",
      course: "13",
      day: { weather: "storm", hour: 10.99 },
    },
    {
      id: "crest-4",
      name: "Twelve Hundred",
      blurb: "Twelve hundred metres of vertical and five drops — the steepest pitch on the crest",
      seed: 16,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "5dc36726",
      region: "continental",
      grade: "black",
      course: "9",
      day: { weather: "fair", hour: 14.57 },
    },
    {
      id: "crest-5",
      name: "Long Black",
      blurb: "Against the clock down three runs of black, three kilometres of it",
      seed: 16,
      mode: "timeTrial",
      laps: 1,
      version: 3,
      digest: "9eb5f29b",
      region: "continental",
      grade: "black",
      course: "10",
      day: { weather: "high", hour: 11.79 },
      medals: { gold: 279, silver: 294, bronze: 321 },
    },
    {
      id: "crest-6",
      name: "Fog Wall",
      blurb: "The last race: six drops in a fog, the hardest black on the mountain",
      seed: 16,
      mode: "race",
      laps: 1,
      version: 3,
      digest: "8555c99c",
      region: "continental",
      grade: "black",
      course: "8",
      day: { weather: "fog", hour: 15.37 },
    },
  ],
};

/** The shelves in the order they open, gentlest first. */
export const SHELVES: readonly CampaignShelf[] = [RIME_WOODS, HIGH_CIRQUE, FROST_BASIN, COLD_CREST];

/** Every campaign map, shelf by shelf, in the order they are played. */
export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = SHELVES.flatMap((shelf) => shelf.levels);
