// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PINNED MAP — a seed's ski area raced down one of its COURSES (R28) of a
// PISTE GRADE (R23), in a KIND OF SNOW COUNTRY (R21) and, where it pins one,
// under a sky of its own. The maps are generated, not authored, so a pinned
// map is a short row of what builds it and the name the menu shows: a
// discipline's race maps (`race-maps.ts`) and the trick maps
// (`trick-maps.ts`) are rows of this shape.
//
// EVERY MAP NAMES THE GENERATOR THAT BUILT IT (`engine/mapgen/versions.ts`)
// and carries the DIGEST of the map that came out, and both are written out
// on every map rather than shared from a constant on purpose: a shared
// version is a single edit that re-rolls every pinned map, which is the
// implicit move the field exists to make impossible, and a digest is a claim
// about ONE map. `tests/race_maps_test.ts` and `tests/trick_maps_test.ts`
// rebuild every map and hold it to its digest, so a rule moving under one of
// these is a red suite rather than a silent re-roll — and when it goes red,
// the question is which of the two it was: a map deliberately moved (write
// the new digest down, re-rate, re-name), or the rules moving out from under
// one (add a version row, keep the old behaviour on the old row).
//
// A MAP IS NAMED FOR WHAT IT IS LIKE, never for where it is: the snow, the
// light, the shape of the ask. A region is a kind of country and no place.

import type { GeneratorVersion, PisteGrade, RegionId, SkyOverride, WeatherKind } from "@engine";

/** The games a pinned map is played as: a SLALOM, set on the map's
 * steepest stretch (R31), a DOWNHILL down its whole course out of a start
 * house against a field (R32), a SUPER-G from a start lowered down it
 * (R33), a SPEED RACE down a track cut straight down the face (R34), a
 * GIANT SLALOM's two runs round its gates (R36) or a SKI CROSS (R35). A
 * free ride measures nothing, so it is never pinned. */
export type PinnedMode = "slalom" | "giantSlalom" | "downhill" | "superG" | "speedSki" | "skiCross";

export type PinnedLevel = {
  id: string;
  name: string;
  /** One line of billing on the map's box. */
  blurb: string;
  seed: number;
  mode: PinnedMode;
  /** Runs to the finish: always R16's one — a piste is skied top to bottom. */
  laps: number;
  /** WHICH GENERATOR built this map (`mapgen/versions.ts`). Required on
   * every map, because it is the one thing about a pinned map that a change
   * somewhere else can take away. */
  version: GeneratorVersion;
  /** The fingerprint of the map this row was curated on, as `levelDigest`
   * reads it — `make rate RACE=…` prints the one that builds today. */
  digest: string;
  /** THE KIND OF SNOW COUNTRY the map is built in (R21): the alpine when
   * left out. Part of what the digest names. */
  region?: RegionId;
  /** THE PISTE GRADE of the course raced (R23), quoted so a box can sign it
   * without building the map, and held to the built map by its test. */
  grade: PisteGrade;
  /** THE COURSE of the seed's ski area this map is raced down (R28,
   * `Resort.course`): the run the gates are on, by its id. Part of what the digest names. */
  course: string;
  /** A sky or a start hour laid over the dealt day. A `sky` (`withSky`)
   * moves nothing the generator builds and so nothing the digest reads. */
  sky?: SkyOverride;
  /** THE DAY the map is ridden in — its sky and the solar hour the run
   * starts at, `sky` laid over the seed's own — quoted here so a box can
   * bill it without building the map, and held to the built map by its
   * test. */
  day: { weather: WeatherKind; hour: number };
};
