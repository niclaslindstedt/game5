// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN'S SHELVES, and the six maps each of them runs. Every map is a
// SEED in a KIND OF SNOW COUNTRY (R21) and, where the ladder needs one, the
// sky it is skied under — the maps are generated, not authored — so a shelf
// is a short table of them with the name the menu shows. Curating one is
// `make rate CAMPAIGN=1` and `make difficulty CAMPAIGN=1`'s job, and the
// numbers here are their output.
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
// THREE SHELVES, A REGION EACH. THE NURSERY is skied on the FELL — low,
// rounded country, half the vertical, the gentlest pistes the generator
// makes (a blue's mean grade; the steepest hundred metres of a fell still
// read red or black on the colour rule, which is honest: a fell's headwall
// is a headwall). THE RIDGE is the ALPINE — the rules as written, black
// pistes over a thousand metres of vertical. THE GLACIER is the CONTINENTAL
// — a fifth more vertical, the steepest faces, and two of its rungs skied
// from the last light into the night, one in a blizzard and one in fog.
//
// THE RUNG ORDER is a race, a time trial, two races, a time trial and a race
// — six rungs, so four races around two trials, and the race both OPENS and
// CLOSES a shelf. Every rung asks more than the one before it on `make rate
// CAMPAIGN=1`'s index, and the seeds were picked from sweeps of the first
// ninety-six alpine seeds and the first forty-eight of the fell and the
// continental (`make rate COUNT=96`, `make rate COUNT=48 ARGS="--region
// fell"`) on the brief the rating module's header states: climb without a
// wall, no two rungs the same map twice, and every kind of ask led on
// somewhere.
//
// EVERY MAP IS SKIED ON THE HOUR, THE SEASON AND THE SKY ITS SEED DEALT
// (R15, R19): no rung lays a sky over the dealt one today, so the dark on
// the glacier is the evenings R19 hands out and not a lamp turned off by
// hand. A `sky` may still be pinned on a rung (`withSky`); it moves nothing
// the generator builds and so nothing the digest reads, but the rating
// reads it (its weather axis).
//
// THE MEDALS on a time trial are set against the bot's own run of it — the
// all-mountain pair skied by the bot from the start gate to the finish,
// which is what the curation loop measures (`make rate CAMPAIGN=1` prints it
// beside them). SILVER IS THE BOT'S TIME and three per cent; BRONZE is an
// eighth slower than the bot, because a medal is the DOOR to the next rung
// and nothing else; GOLD is two per cent under it, a clean run the bot does
// not ski.

import type { GeneratorVersion, RegionId, SkyOverride, WeatherKind } from "@engine";

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
  id: "nursery" | "ridge" | "glacier";
  name: string;
  blurb: string;
  levels: readonly CampaignLevel[];
};

/** THE FIRST SHELF — open to everyone: the fell, bright days, gentle pistes
 * to learn the edge on, then the crust, the traverses and the first air. */
const NURSERY: CampaignShelf = {
  id: "nursery",
  name: "Nursery",
  blurb: "The fell: gentle pistes, bright days, the first turns",
  levels: [
    {
      id: "nursery-1",
      name: "First Turns",
      blurb: "A gentle fell under high cloud, three rolls to learn the edge on",
      seed: 34,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "88daa0ad",
      region: "fell",
      day: { weather: "high", hour: 10.98 },
    },
    {
      id: "nursery-2",
      name: "Birch Line",
      blurb: "Alone against the clock down the birches on a clear February afternoon",
      seed: 36,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "3d8a18c5",
      region: "fell",
      day: { weather: "clear", hour: 13.51 },
      medals: { gold: 284, silver: 299, bronze: 327 },
    },
    {
      id: "nursery-3",
      name: "Open Fell",
      blurb: "A fair March morning on the bare top, four lips and a long run-out",
      seed: 45,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "9a93b4f1",
      region: "fell",
      day: { weather: "fair", hour: 10.19 },
    },
    {
      id: "nursery-4",
      name: "Wind Crust",
      blurb: "High cloud and a crust scoured over the open snow beside the piste",
      seed: 33,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "67df1008",
      region: "fell",
      day: { weather: "high", hour: 10.88 },
    },
    {
      id: "nursery-5",
      name: "Birch Woods",
      blurb: "The clock again, in and out of the birch woods under high cloud",
      seed: 20,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "11d2c314",
      region: "fell",
      day: { weather: "high", hour: 12.48 },
      medals: { gold: 305, silver: 321, bronze: 350 },
    },
    {
      id: "nursery-6",
      name: "Six Lips",
      blurb:
        "Flurries out of a sunny sky and six kickers down one fell — the most air on the shelf",
      seed: 40,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "6b172f8e",
      region: "fell",
      day: { weather: "flurries", hour: 11.99 },
    },
  ],
};

/** THE SECOND SHELF — the alpine: black pistes over a thousand metres of
 * vertical, the woods, the drifts, the tightest bends. */
const RIDGE: CampaignShelf = {
  id: "ridge",
  name: "Ridge",
  blurb: "The alpine: black pistes, the timberline, the drifts",
  levels: [
    {
      id: "ridge-1",
      name: "Under the Ridge",
      blurb: "High cloud on a black piste's shoulder, six kickers to learn the air on",
      seed: 64,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "84eca003",
      region: "alpine",
      day: { weather: "high", hour: 9.53 },
    },
    {
      id: "ridge-2",
      name: "Larch Bowl",
      blurb: "A clear afternoon and the clock, over the steepest pitch so far",
      seed: 7,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "630c1626",
      region: "alpine",
      day: { weather: "clear", hour: 14.42 },
      medals: { gold: 272, silver: 286, bronze: 313 },
    },
    {
      id: "ridge-3",
      name: "Stone Pine",
      blurb: "A fair January afternoon through the timberline woods",
      seed: 4,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "6b31568e",
      region: "alpine",
      day: { weather: "fair", hour: 13.81 },
    },
    {
      id: "ridge-4",
      name: "Wind Lips",
      blurb: "High cloud and five kickers down the face — the most air so far",
      seed: 84,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "fe250f6f",
      region: "alpine",
      day: { weather: "high", hour: 11.24 },
    },
    {
      id: "ridge-5",
      name: "Flat Light",
      blurb: "The clock under a lid of overcast, the longest run of the shelf in flat light",
      seed: 37,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "d14629a1",
      region: "alpine",
      day: { weather: "overcast", hour: 11.24 },
      medals: { gold: 361, silver: 380, bronze: 415 },
    },
    {
      id: "ridge-6",
      name: "Night Flurries",
      blurb: "Flurries at nightfall and deep snow beside the piste, the shelf's last race",
      seed: 47,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "30a057d8",
      region: "alpine",
      day: { weather: "flurries", hour: 19.69 },
    },
  ],
};

/** THE THIRD SHELF — the continental: the biggest faces, the steepest
 * hundred metres, and two rungs skied into the dark. */
const GLACIER: CampaignShelf = {
  id: "glacier",
  name: "Glacier",
  blurb: "The continental: the biggest faces, and the dark",
  levels: [
    {
      id: "glacier-1",
      name: "First Face",
      blurb: "High cloud on the biggest face so far, four lips down it",
      seed: 3,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "27dda6c8",
      region: "continental",
      day: { weather: "high", hour: 9.63 },
    },
    {
      id: "glacier-2",
      name: "Five Kickers",
      blurb: "A clear midday and five lips against the clock",
      seed: 12,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "502b70e3",
      region: "continental",
      day: { weather: "clear", hour: 12.41 },
      medals: { gold: 263, silver: 277, bronze: 302 },
    },
    {
      id: "glacier-3",
      name: "Deep Snow",
      blurb: "Fair weather and deep snow beside a piste that never lets up",
      seed: 17,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "91fa8dcb",
      region: "continental",
      day: { weather: "fair", hour: 12 },
    },
    {
      id: "glacier-4",
      name: "Storm Front",
      blurb: "A blizzard at dusk, the next gate lost in the spindrift",
      seed: 10,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "4ef2c372",
      region: "continental",
      day: { weather: "storm", hour: 18.65 },
    },
    {
      id: "glacier-5",
      name: "Steady Fall",
      blurb: "The clock in a steady snowfall, over the steepest hundred metres of the campaign",
      seed: 48,
      mode: "timeTrial",
      laps: 1,
      version: 1,
      digest: "2f97b487",
      region: "continental",
      day: { weather: "snow", hour: 11.28 },
      medals: { gold: 305, silver: 321, bronze: 351 },
    },
    {
      id: "glacier-6",
      name: "Valley Fog",
      blurb: "The last race, into a fog lying over the lower mountain at nightfall",
      seed: 22,
      mode: "race",
      laps: 1,
      version: 1,
      digest: "04cd7931",
      region: "continental",
      day: { weather: "fog", hour: 18.85 },
    },
  ],
};

/** The shelves in the order they open. */
export const SHELVES: readonly CampaignShelf[] = [NURSERY, RIDGE, GLACIER];

/** Every campaign map, shelf by shelf, in the order they are played. */
export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = SHELVES.flatMap((shelf) => shelf.levels);
