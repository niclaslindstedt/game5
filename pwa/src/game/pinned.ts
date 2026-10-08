// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PINNED MAPS — which map a measured run is on, and the run stood up on it.
//
// Everything a generated map needs is a seed and the generator it was built
// by, so a pinned map is just those with a name and the mode pinned to them
// (`pinned-levels.ts`): the same generator builds it, on the version it was
// curated under, and it comes out identical for every player. A RACE off the
// front door (the slalom, the super-G, the downhill …) is raced on its
// discipline's own nine (`race-maps.ts`), all open, chosen for the
// discipline; a TRICKS run on a trick map (`trick-maps.ts`). A seed of your
// own is the FREE RIDE's, and a link's (`?seed=`).
//
// Pure: nothing here touches storage, so `tests/race_maps_test.ts` holds
// the policy without a browser.

import {
  LEVEL_RULES,
  generateLevel,
  regionOf,
  type Assist,
  type CreateGameOptions,
  type GameMode,
  type Level,
  type SkyOverride,
  type SkiSpec,
} from "@engine";

import type { PinnedLevel } from "./pinned-levels.ts";
import { disciplineOf, raceMapFor, raceMapsOf, type RacePicks } from "./race-maps.ts";

export type { PinnedLevel, PinnedMode } from "./pinned-levels.ts";

/* ── THE MAP, BUILT ───────────────────────────────────────────────────── */

/** THE MAP ITSELF, exactly as it was curated: the seed's resort on its own
 * generator version, in its country, raced down its own course (R28) of its
 * grade (R23). Nothing about the sky is in here — a pinned sky is laid over
 * the run (`pinnedGameOptions`), and the same map under a different sky is
 * the same map, with the same digest. */
export function buildPinnedLevel(level: PinnedLevel): Level {
  return generateLevel(level.seed, {
    version: level.version,
    region: level.region,
    grade: level.grade,
    course: level.course,
  });
}

/** THE SKY the map is ridden under, where the row pins one over the day its
 * seed dealt — what the rating reads, and what the run is stood up in. */
export function pinnedSky(level: PinnedLevel): SkyOverride | undefined {
  return level.sky;
}

/** The pinned map's own name for a measured mode: the mode itself where a
 * race map can be one, the slalom's otherwise. */
function measuredMode(mode: GameMode): PinnedLevel["mode"] {
  return mode === "downhill" ||
    mode === "superG" ||
    mode === "giantSlalom" ||
    mode === "speedSki" ||
    mode === "skiCross"
    ? mode
    : "slalom";
}

/** WHAT THE LEVEL CARDS LAST PICKED, as the settings keep them: each
 * discipline's race map (`Settings.raceMap`). */
export type PinnedPicks = { raceMap: RacePicks };

/** No card has picked anything yet: every mode's first map. */
export const NO_PICKS: PinnedPicks = { raceMap: {} };

/** THE PINNED MAP A MEASURED RUN IS ON, or null where it is choosing its
 * own. A RACE rides the race map its discipline's level card last picked
 * (`Settings.raceMap`, `race-maps.ts`) — or its first, on a fresh app — so
 * two figures in the record book are two figures down the same piste. The
 * answer is null for a mode with no nine of its own (a FREE RIDE, a TRICKS
 * run: the modes that pick a seed or a trick map), and for a LINK that
 * names a seed (`?seed=`), which takes the pinned map off for that visit
 * so a lab or a shared link rides exactly the seed it names. */
export function pinnedFor(
  picks: PinnedPicks,
  mode: GameMode,
  linkSeed: number | null,
): PinnedLevel | null {
  if (linkSeed !== null) return null;
  const races = raceMapsOf(mode);
  const discipline = disciplineOf(mode);
  if (!races || !discipline) return null;
  return raceMapFor(mode, picks.raceMap[discipline]) ?? races[0];
}

/** WHAT A RIDE PRESS STANDS UP ON A PINNED MAP, as the arguments of the
 * app's `pinned` press: the map `pinnedFor` puts a measured run on, in its
 * mode — or null where the run is choosing its own seed. */
export function pinnedPress(
  chosen: PinnedPicks,
  mode: GameMode,
  linkSeed: number | null,
): [PinnedLevel, PinnedLevel["mode"]] | null {
  const pin = pinnedFor(chosen, mode, linkSeed);
  return pin ? [pin, measuredMode(mode)] : null;
}

/** Whether `level` is the very map `pin` builds — the same seed on the same
 * generator, raced down the same course of its resort — so a run on it can
 * reuse a map already standing rather than build it again. */
export function isPinnedMap(level: Level, pin: PinnedLevel): boolean {
  return (
    level.seed === pin.seed &&
    level.version === pin.version &&
    regionOf(level).id === regionOf(pin).id &&
    level.resort?.course === pin.course
  );
}

/** Who skis a pinned run, and with what: the pair, the help, whether
 * blows cost him, and his poles (with them when left out). */
export type PinnedSkier = {
  spec: SkiSpec;
  assist: Assist;
  damage: boolean;
  poles?: boolean;
  /** The INJURIES switch on (`injuriesShown`): a blow past what a body
   * survives tears him apart and kills him (`CreateGameOptions.gore`). */
  gore?: boolean;
};

/** A RUN ON THE PINNED MAP — the map's own snow under the map's own sky,
 * skied as `mode` on the skier's pair over the race's one run (R16).
 *
 * `built` is the map already paid for — building one is the most expensive
 * thing this engine does, and the map under the menu is often the very one
 * asked for. */
export function pinnedGameOptions(
  level: PinnedLevel,
  mode: PinnedLevel["mode"],
  skier: PinnedSkier,
  built?: Level,
): CreateGameOptions {
  return {
    seed: level.seed,
    level: built ?? buildPinnedLevel(level),
    mode,
    laps: LEVEL_RULES.race.laps,
    sky: pinnedSky(level),
    spec: skier.spec,
    assist: skier.assist,
    damage: skier.damage,
    ...(skier.gore ? { gore: true } : {}),
    poles: skier.poles,
  };
}

/** THE FRONT DOOR'S PINNED FACES: the map each discipline on the race card
 * rides — null where a link pinned a seed instead. */
export function frontDoorPins(
  chosen: PinnedPicks,
  linkSeed: number | null,
): {
  raceMap: string | null;
  downhillMap: string | null;
  superGMap: string | null;
  giantSlalomMap: string | null;
  speedSkiMap: string | null;
  skiCrossMap: string | null;
} {
  return {
    raceMap: pinnedFor(chosen, "slalom", linkSeed)?.name ?? null,
    downhillMap: pinnedFor(chosen, "downhill", linkSeed)?.name ?? null,
    superGMap: pinnedFor(chosen, "superG", linkSeed)?.name ?? null,
    giantSlalomMap: pinnedFor(chosen, "giantSlalom", linkSeed)?.name ?? null,
    speedSkiMap: pinnedFor(chosen, "speedSki", linkSeed)?.name ?? null,
    skiCrossMap: pinnedFor(chosen, "skiCross", linkSeed)?.name ?? null,
  };
}
