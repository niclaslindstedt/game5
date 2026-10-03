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
// generator that builds ski areas (v4, R25–R28): a massif with its lifts,
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
// and every rung is ordered by how hard it really is on the rating's index
// (`make rate CAMPAIGN=1`) — the steepest pitch, the drop, the air, the
// drops across the piste, the sky — because two blacks can be a world
// apart: the early shelves' are the raceable ones, the last shelf's the
// brutal.
//
//   RIME WOODS   MARITIME, seed 4: deep snow and rimed firs; a blue in a
//                valley fog to warm up on, then five reds, the last into a
//                storm.
//   HIGH CIRQUE  ALPINE, seed 8: four reds off the cirque, then the first
//                two blacks — one in a storm, then nine hundred metres of it.
//   FROST BASIN  CONTINENTAL, seed 10: cold dry snow; three reds, then
//                three blacks with drops across the piste, the last seven.
//   COLD CREST   CONTINENTAL, seed 77: a short red and a long one among the
//                four hardest blacks in the game — one in a storm, one in
//                falling snow, the last nearly twelve hundred metres of drop.
//
// The FELL has no shelf: its ski areas are gentle by nature — no black on
// any of the first forty seeds and never more than two reds — so it is the
// free ride's country. The maritime opens because its reds are the gentlest
// (no black at all), the alpine follows because it offers two blacks at
// most, and the continental, the steepest country, hosts the last two
// shelves on two different massifs.
//
// The areas were picked from sweeps of the v4 generator (`make resort
// COUNT=40 REGION=…`; forty maritime seeds, eighty alpine, a hundred and
// twenty continental): the ones with six red-and-black courses (or a blue
// and five reds) that stand clean, every course finished by the bot, and a
// plan that reads as a ski area somebody laid out. No continental area of
// the hundred and twenty offered five blacks the bot finishes, so the last
// shelf races four. Within a shelf the rungs climb on the index; across
// the shelves the share of black climbs (0, 2, 3, 4) and so does the
// shelf's mean ask.
//
// THE RUNG ORDER is a race, a time trial, two races, a time trial and a race
// — six rungs, so four races around two trials, and the race both OPENS and
// CLOSES a shelf.
//
// EVERY MAP IS SKIED ON THE HOUR, THE SEASON AND THE SKY ITS COURSE WAS
// DEALT (R15, R19 — each course of a resort is dealt a day of its own) —
// but for two, where the ladder needed a step the dealt day did not give:
// fair-weather cloud over RIME WOODS's late-sun red, and falling snow over
// COLD CREST's six-kicker black. A `sky` (`withSky`) moves nothing the
// generator builds and so nothing the digest reads, but the rating reads it
// (its weather axis), and the box bills it (`day`).
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
 * rimed firs; the one blue to warm up on, then five reds, the last into a storm. */
const RIME_WOODS: CampaignShelf = {
  id: "rime",
  name: "Rime Woods",
  blurb: "Deep snow and rimed firs: one blue to warm up on, then the reds",
  seed: 4,
  region: "maritime",
  levels: [
    {
      id: "rime-1",
      name: "Fog Opener",
      blurb: "The one blue: wide turns through the rimed firs in a valley fog, one kicker",
      seed: 4,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "4a43faec",
      region: "maritime",
      grade: "blue",
      course: "4",
      day: { weather: "fog", hour: 12.65 },
    },
    {
      id: "rime-2",
      name: "First Red",
      blurb:
        "Against the clock down the first red, five kickers and four hundred metres of drop in the sun",
      seed: 4,
      mode: "timeTrial",
      laps: 1,
      version: 4,
      digest: "fbe8009e",
      region: "maritime",
      grade: "red",
      course: "11",
      day: { weather: "clear", hour: 14.29 },
      medals: { gold: 180, silver: 189, bronze: 206 },
    },
    {
      id: "rime-3",
      name: "Flurry Line",
      blurb: "A short red raced through flurries, four kickers between the firs",
      seed: 4,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "0fc67945",
      region: "maritime",
      grade: "red",
      course: "3",
      day: { weather: "flurries", hour: 15.16 },
    },
    {
      id: "rime-4",
      name: "Late Sun",
      blurb:
        "A short red in the late afternoon sun under fair-weather cloud, three kickers down to the village",
      seed: 4,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "5b92d38a",
      region: "maritime",
      grade: "red",
      course: "5",
      sky: { weather: "fair" },
      day: { weather: "fair", hour: 16.87 },
    },
    {
      id: "rime-5",
      name: "Top to Village",
      blurb: "The clock over three kilometres of red, from the top lift to the village",
      seed: 4,
      mode: "timeTrial",
      laps: 1,
      version: 4,
      digest: "db8b3a93",
      region: "maritime",
      grade: "red",
      course: "7",
      day: { weather: "clear", hour: 15.3 },
      medals: { gold: 265, silver: 278, bronze: 304 },
    },
    {
      id: "rime-6",
      name: "Storm Red",
      blurb: "The last red race into a storm, five kickers and the next gate lost in the spindrift",
      seed: 4,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "2974386e",
      region: "maritime",
      grade: "red",
      course: "12",
      day: { weather: "storm", hour: 15.19 },
    },
  ],
};

/** THE SECOND SHELF — an alpine ski area under its cirque: four reds
 * down the fall line, then the first two blacks. */
const HIGH_CIRQUE: CampaignShelf = {
  id: "cirque",
  name: "High Cirque",
  blurb: "Reds off the cirque, then the first blacks: drops across the piste",
  seed: 8,
  region: "alpine",
  levels: [
    {
      id: "cirque-1",
      name: "Long Traverse",
      blurb: "Three kilometres of red on a clear morning, long traverses across the face",
      seed: 8,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "10c41001",
      region: "alpine",
      grade: "red",
      course: "7",
      day: { weather: "clear", hour: 10.32 },
    },
    {
      id: "cirque-2",
      name: "Cirque Clock",
      blurb: "Against the clock under the cirque at noon, three kickers on the way down",
      seed: 8,
      mode: "timeTrial",
      laps: 1,
      version: 4,
      digest: "67c47454",
      region: "alpine",
      grade: "red",
      course: "2",
      day: { weather: "fair", hour: 11.99 },
      medals: { gold: 172, silver: 180, bronze: 197 },
    },
    {
      id: "cirque-3",
      name: "Morning Fog",
      blurb: "A red raced into the morning fog, three kickers looming out of it",
      seed: 8,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "26604e7f",
      region: "alpine",
      grade: "red",
      course: "4",
      day: { weather: "fog", hour: 9.86 },
    },
    {
      id: "cirque-4",
      name: "Six Kickers",
      blurb: "Six hundred metres of red through the flurries, six kickers to take air off",
      seed: 8,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "593596c8",
      region: "alpine",
      grade: "red",
      course: "11",
      day: { weather: "flurries", hour: 13.59 },
    },
    {
      id: "cirque-5",
      name: "First Black",
      blurb: "The first black, against the clock in a storm: seven kickers and two drops",
      seed: 8,
      mode: "timeTrial",
      laps: 1,
      version: 4,
      digest: "6e786204",
      region: "alpine",
      grade: "black",
      course: "10",
      day: { weather: "storm", hour: 11.17 },
      medals: { gold: 181, silver: 190, bronze: 207 },
    },
    {
      id: "cirque-6",
      name: "Cirque Wall",
      blurb: "Nine hundred metres of black off the top, three drops on the steepest pitch",
      seed: 8,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "4815a9a4",
      region: "alpine",
      grade: "black",
      course: "8",
      day: { weather: "flurries", hour: 12.31 },
    },
  ],
};

/** THE THIRD SHELF — a continental ski area, cold dry snow: three reds,
 * then three blacks with drops across the piste. */
const FROST_BASIN: CampaignShelf = {
  id: "basin",
  name: "Frost Basin",
  blurb: "Cold dry snow: short reds, then three blacks with drops",
  seed: 10,
  region: "continental",
  levels: [
    {
      id: "basin-1",
      name: "Cold Morning",
      blurb: "A clear, cold morning and a short red to open the basin, four kickers",
      seed: 10,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "85ea3ae9",
      region: "continental",
      grade: "red",
      course: "5",
      day: { weather: "clear", hour: 9.06 },
    },
    {
      id: "basin-2",
      name: "Snow Clock",
      blurb: "The clock down a short, steep red in falling snow",
      seed: 10,
      mode: "timeTrial",
      laps: 1,
      version: 4,
      digest: "b4a5bd8e",
      region: "continental",
      grade: "red",
      course: "3",
      day: { weather: "snow", hour: 11.02 },
      medals: { gold: 110, silver: 115, bronze: 126 },
    },
    {
      id: "basin-3",
      name: "Seven Kickers",
      blurb:
        "Three kilometres of red under high cloud, seven kickers on eight hundred metres of drop",
      seed: 10,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "52ed07a8",
      region: "continental",
      grade: "red",
      course: "6",
      day: { weather: "high", hour: 10.29 },
    },
    {
      id: "basin-4",
      name: "Four Drops",
      blurb: "A black through the flurries, four drops across the piste and seven kickers",
      seed: 10,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "b27c5ffc",
      region: "continental",
      grade: "black",
      course: "8",
      day: { weather: "flurries", hour: 11.36 },
    },
    {
      id: "basin-5",
      name: "Short Black",
      blurb: "Against the clock down a short black, three drops and four kickers",
      seed: 10,
      mode: "timeTrial",
      laps: 1,
      version: 4,
      digest: "15003760",
      region: "continental",
      grade: "black",
      course: "12",
      day: { weather: "fair", hour: 13.41 },
      medals: { gold: 149, silver: 157, bronze: 171 },
    },
    {
      id: "basin-6",
      name: "Basin Wall",
      blurb: "The last race off the top of the basin: a thousand metres of black and seven drops",
      seed: 10,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "a99433e3",
      region: "continental",
      grade: "black",
      course: "9",
      day: { weather: "high", hour: 9.4 },
    },
  ],
};

/** THE FOURTH SHELF — the steepest continental ski area: two reds among
 * the four hardest blacks in the game. */
const COLD_CREST: CampaignShelf = {
  id: "crest",
  name: "Cold Crest",
  blurb: "The steepest blacks: drops, a storm and falling snow, two reds among four blacks",
  seed: 77,
  region: "continental",
  levels: [
    {
      id: "crest-1",
      name: "Crest Opener",
      blurb: "A short red to open the crest, three kickers under fair-weather cloud",
      seed: 77,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "27f341ad",
      region: "continental",
      grade: "red",
      course: "3",
      day: { weather: "fair", hour: 11.84 },
    },
    {
      id: "crest-2",
      name: "Steep Clock",
      blurb:
        "Against the clock down eleven hundred metres of black, the steepest pitch on the crest",
      seed: 77,
      mode: "timeTrial",
      laps: 1,
      version: 4,
      digest: "d41f4f5c",
      region: "continental",
      grade: "black",
      course: "9",
      day: { weather: "high", hour: 11.81 },
      medals: { gold: 226, silver: 238, bronze: 260 },
    },
    {
      id: "crest-3",
      name: "Snow Red",
      blurb:
        "The one long red, raced in falling snow: three and a half kilometres and seven kickers",
      seed: 77,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "9586af74",
      region: "continental",
      grade: "red",
      course: "5",
      day: { weather: "snow", hour: 10.95 },
    },
    {
      id: "crest-4",
      name: "Storm Black",
      blurb:
        "A black raced into a storm, four drops across the piste and the next gate lost in the spindrift",
      seed: 77,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "6c263fb2",
      region: "continental",
      grade: "black",
      course: "11",
      day: { weather: "storm", hour: 10.97 },
    },
    {
      id: "crest-5",
      name: "Falling Snow",
      blurb:
        "Against the clock down a black of six kickers in falling snow, every roll hard to read",
      seed: 77,
      mode: "timeTrial",
      laps: 1,
      version: 4,
      digest: "140db917",
      region: "continental",
      grade: "black",
      course: "12",
      sky: { weather: "snow" },
      day: { weather: "snow", hour: 9.26 },
      medals: { gold: 165, silver: 173, bronze: 189 },
    },
    {
      id: "crest-6",
      name: "Crest Wall",
      blurb:
        "The last race: nearly twelve hundred metres of black off the crest, five kickers and two drops",
      seed: 77,
      mode: "race",
      laps: 1,
      version: 4,
      digest: "77ce73da",
      region: "continental",
      grade: "black",
      course: "8",
      day: { weather: "clear", hour: 9.29 },
    },
  ],
};

/** The shelves in the order they open, gentlest first. */
export const SHELVES: readonly CampaignShelf[] = [RIME_WOODS, HIGH_CIRQUE, FROST_BASIN, COLD_CREST];

/** Every campaign map, shelf by shelf, in the order they are played. */
export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = SHELVES.flatMap((shelf) => shelf.levels);
