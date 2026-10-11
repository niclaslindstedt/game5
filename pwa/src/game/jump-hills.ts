// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKI JUMPING'S OWN HILLS — the maps a ski jumping contest (R43) is jumped
// on, picked on the trick map card when it is opened for SKI JUMPING
// (`menu-tricks.tsx`), as every other freestyle format picks one of the six
// trick maps (`trick-maps.ts`).
//
// Each is a SEED's map in its country with the jumping hill R43 cuts down
// its face (`setSkiJump`) — the LARGE hill (HS 140) or the NORMAL (HS 106),
// the row's `hill` — jumped on a DAY of its own (a date, an hour, a sky),
// none of which moves anything the generator builds. A hill's map is built
// with NO PARK: the hill is what it was chosen for, and nothing else on the
// mountain is ridden. They were chosen with `make skijump-hills` out of a
// sweep of the first thirty seeds in every country, for the hill the map
// gives: a landing hill and out-run laid on the face with little earth
// moved (the `rms` and the `fill` and `cut` columns), the in-run near the
// ground rather than up on trestles, level ground beside the out-run for
// the stadium's stands (`arena`), the bot's jump near K — and spread over
// the countries, the light and the skies a jury lets a contest go ahead in
// (`JURY`: no storm), some of them contests under the arena's floodlights.
//
// LIKE A TRICK MAP, each names the generator that built it and carries the
// DIGEST of the map that came out (`levelDigest`); `tests/jump_hills_test.ts`
// rebuilds every one and holds it to its digest, its hill's place on the
// map and the line its box draws (`make routes`: the hill's own axis, as a
// speed track's box draws its track). No hill's seed in its country is a
// trick map's, so no run on one meets a map stood up for another format.
//
// A HILL IS NAMED FOR WHAT IT IS LIKE, never for where it is.
//
// DOM-free and storage-free.

import { SKI_JUMP, SKI_JUMP_RULE, setSkiJump, type GameMode, type Level } from "@engine";

import { STRINGS } from "./strings.ts";
import { TRICK_MAPS, buildTrickMap, trickMapFor, type TrickMap } from "./trick-maps.ts";

/** A SKI JUMPING HILL: a trick map's row with its hill named, and the
 * DIGEST of the hill R43 cut on its map (`levelDigest` of `jumpHillLevel`)
 * — the map's own digest cannot see a rule that moves the hill alone. */
export type JumpHill = TrickMap & { hill: NonNullable<TrickMap["hill"]>; hillDigest: string };

/** THE HILLS, in the order the card shows them — the normal hills first,
 * then the large, each the brightest first. */
export const JUMP_HILLS: readonly JumpHill[] = [
  {
    id: "hill-1",
    name: "Clear Morning",
    blurb: "A clear February morning on a normal hill down an alpine face",
    seed: 29,
    version: 9,
    digest: "bd917166",
    hill: "normal",
    hillDigest: "4a2cc535",
    day: { dayOfYear: 50, hour: 10.5, weather: "clear" },
  },
  {
    id: "hill-2",
    name: "Sea Breeze",
    blurb: "Fair-weather afternoon on a maritime normal hill laid close to its face",
    seed: 14,
    version: 9,
    digest: "76aaf4c9",
    region: "maritime",
    hill: "normal",
    hillDigest: "ea8592ed",
    day: { dayOfYear: 30, hour: 13.5, weather: "fair" },
  },
  {
    id: "hill-3",
    name: "High Plateau",
    blurb: "High cloud over a continental normal hill in the March sun",
    seed: 3,
    version: 9,
    digest: "6da64d09",
    region: "continental",
    hill: "normal",
    hillDigest: "c900cc8f",
    day: { dayOfYear: 70, hour: 15, weather: "high" },
  },
  {
    id: "hill-4",
    name: "Polar Night",
    blurb: "A January evening on the fells, a normal hill under the floodlights",
    seed: 12,
    version: 9,
    digest: "1204c1b5",
    region: "fell",
    hill: "normal",
    hillDigest: "3ff6efe4",
    day: { dayOfYear: 15, hour: 19.5, weather: "clear" },
  },
  {
    id: "hill-5",
    name: "Spring Giant",
    blurb: "A large alpine hill in the clear noon of late March",
    seed: 15,
    version: 9,
    digest: "575aff75",
    hill: "large",
    hillDigest: "596b0205",
    day: { dayOfYear: 80, hour: 12, weather: "clear" },
  },
  {
    id: "hill-6",
    name: "Powder Sky",
    blurb: "Flurries out of a sunny sky over a large continental hill",
    seed: 29,
    version: 9,
    digest: "5cd9def8",
    region: "continental",
    hill: "large",
    hillDigest: "2cf2d24b",
    day: { dayOfYear: 45, hour: 14, weather: "flurries" },
  },
  {
    id: "hill-7",
    name: "Grey Coast",
    blurb: "A flat-lit January morning on a large maritime hill",
    seed: 19,
    version: 9,
    digest: "a4b93689",
    region: "maritime",
    hill: "large",
    hillDigest: "f4691ff6",
    day: { dayOfYear: 25, hour: 11.5, weather: "overcast" },
  },
  {
    id: "hill-8",
    name: "Midwinter Lights",
    blurb: "Snow falling through the floodlights on a large hill on the fells",
    seed: 15,
    version: 9,
    digest: "762b38b9",
    region: "fell",
    hill: "large",
    hillDigest: "137efbbc",
    day: { dayOfYear: 355, hour: 18.5, weather: "snow" },
  },
  {
    id: "hill-9",
    name: "Valley Fog",
    blurb: "A large continental hill out of the valley's fog at dusk",
    seed: 26,
    version: 9,
    digest: "27201538",
    region: "continental",
    hill: "large",
    hillDigest: "ea48030f",
    day: { dayOfYear: 60, hour: 17.5, weather: "fog" },
  },
];

/** The hill named by an id, or the first where the id is no hill (a fresh
 * app, or a stale stored id). */
export function jumpHillFor(id: string | null): JumpHill {
  return JUMP_HILLS.find((row) => row.id === id) ?? JUMP_HILLS[0];
}

/** Whether an id names a jump hill — what a stored setting is held to. */
export function isJumpHill(id: unknown): id is string {
  return typeof id === "string" && JUMP_HILLS.some((row) => row.id === id);
}

/** The map a hill is cut on: its seed in its country on its generator. */
export function buildJumpHill(row: JumpHill): Level {
  return buildTrickMap(row);
}

/** The hill as the contest jumps it: `setSkiJump` over the row's map. */
export function jumpHillLevel(row: JumpHill, built?: Level): Level {
  return setSkiJump(built ?? buildJumpHill(row), row.hill);
}

/** THE LINE A HILL'S BOX DRAWS: the hill IN PROFILE, as the side of a
 * jumping hill is drawn — the in-run from the top gate over the edge, the
 * landing hill and the out-run — laid as a track `routeOf` fits into its
 * box, the length along the hill across it and the height down it. */
export function hillProfile(level: Level): Pick<Level, "track"> {
  const hill = level.skiJump!;
  const points: Level["track"]["points"] = [];
  for (let d = hill.from; d <= hill.outrun; d += 2) {
    points.push({ x: -d, z: -hill.yAt(d), y: 0, s: d, heading: 0, width: 0 });
  }
  return { track: { ...level.track, points } };
}

/** WHAT THE TRICK MAP CARD OFFERS a format: a ski jumping contest its
 * hills, every other format the six trick maps. */
export function cardMaps(mode: GameMode): readonly TrickMap[] {
  return mode === "skiJump" ? JUMP_HILLS : TRICK_MAPS;
}

/** The map the card's answer stands on for a format — a ski jumping
 * contest's hill (`Settings.jumpHill`), every other format's trick map
 * (`Settings.trickMap`). */
export function cardPick(
  mode: GameMode,
  picks: { trickMap: string | null; jumpHill: string | null },
): TrickMap {
  return mode === "skiJump" ? jumpHillFor(picks.jumpHill) : trickMapFor(picks.trickMap);
}

/** A box's billing for a ski jump: its hill's size and the rounds. */
export function hillBilling(map: TrickMap): string {
  return STRINGS.skiJumpBilling(SKI_JUMP_RULE.hills[map.hill ?? SKI_JUMP.hill].hs, SKI_JUMP.trial);
}

/** Every hill size the hills are jumped on, smallest first — the tricks
 * card's line for the format. */
export function hillSizes(): number[] {
  const sizes = new Set(JUMP_HILLS.map((row) => SKI_JUMP_RULE.hills[row.hill].hs));
  return [...sizes].sort((a, b) => a - b);
}
