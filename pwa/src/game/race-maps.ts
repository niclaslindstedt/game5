// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE MAPS — every race discipline's own NINE pinned maps, the ones a
// SLALOM, a GIANT SLALOM, a SUPER-G, a DOWNHILL, a SPEED RACE or a SKI CROSS
// off the race card is raced on, picked on the level card
// (`menu-levels.tsx`) its tile opens.
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
// is raced in and the days it is raced on. All nine are open.
//
// A row has a pinned map's shape (`PinnedLevel`) on purpose, so every
// question already asked of a pinned map — what it builds, the sky it is
// skied under, whether a map standing is the one asked for, the run stood up
// on it, the record book's row — is asked of a race map the same way. Each
// names the generator that built it and carries the
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

import type { PinnedLevel } from "./pinned-levels.ts";

/** A RACE MAP: a pinned map raced as its discipline, with the course's own
 * figures quoted so its box can bill them without building it — held to the
 * built course by `tests/race_maps_test.ts`. */
export type RaceMap = PinnedLevel & {
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

/** THE SUPER-G'S NINE (R33), the gentlest first by the rating's index —
 * curated off a sweep of seeds 1–64 in the alpine and 1–34 in the
 * continental and the maritime (108 of 114 skied home by the bot): three
 * reds and six blacks, three in each country, 430–600 m of vertical from a
 * start lowered down the area's biggest course, every sky the jury races in
 * but a storm and one race at night — the bot home on every one with no
 * gate missed, no net and no harsh landing, within −5 … +7 % of par, and
 * every map built cold in seconds. */
const SUPER_G_MAPS: readonly RaceMap[] = [
  {
    id: "superG-1",
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
    figures: { vertical: 547, length: 2332 },
  },
  {
    id: "superG-2",
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
    figures: { vertical: 429, length: 2192 },
  },
  {
    id: "superG-3",
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
    figures: { vertical: 600, length: 2620 },
  },
  {
    id: "superG-4",
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
    figures: { vertical: 565, length: 2079 },
  },
  {
    id: "superG-5",
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
    figures: { vertical: 599, length: 2224 },
  },
  {
    id: "superG-6",
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
    figures: { vertical: 600, length: 2678 },
  },
  {
    id: "superG-7",
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
    figures: { vertical: 599, length: 1956 },
  },
  {
    id: "superG-8",
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
    figures: { vertical: 599, length: 2098 },
  },
  {
    id: "superG-9",
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
    figures: { vertical: 599, length: 2098 },
  },
];

/** SPEED SKIING'S NINE (R34), the slowest track first: nine faces a
 * straight track was cut down whose final the bot, held in a full tuck,
 * comes through the timing zone at 187–225 km/h — the top class's tour
 * band, a slow northern track at its foot and a fast one at its head —
 * across the fell, the alpine, the continental and the maritime, under
 * the clear, fair, high and flurried skies a speed race is run in (its
 * jury runs none in a storm), the bot home on both runs within a few
 * tenths of par (the clean run, skied), every map built in seconds. Each
 * box draws the track, and its figures are the FINAL's: the start house
 * at the top to the timing zone's bottom line. */
const SPEED_SKI_MAPS: readonly RaceMap[] = [
  {
    id: "speedSki-1",
    name: "Short Fell",
    blurb: "A short fell track under a fair sky: 200 m of fall, the winners through at 185",
    seed: 21,
    mode: "speedSki",
    laps: 1,
    version: 6,
    digest: "7bd46dad",
    region: "fell",
    grade: "red",
    course: "8",
    day: { weather: "fair", hour: 13.13 },
    figures: { vertical: 203, length: 564 },
  },
  {
    id: "speedSki-2",
    name: "High Haze",
    blurb: "An alpine track under high cloud, timed past 195 km/h",
    seed: 32,
    mode: "speedSki",
    laps: 1,
    version: 6,
    digest: "6c574886",
    grade: "blue",
    course: "5",
    day: { weather: "high", hour: 14.83 },
    figures: { vertical: 226, length: 553 },
  },
  {
    id: "speedSki-3",
    name: "Late Flurries",
    blurb: "A fell track in the last of the day, flurries in the air: 200 km/h",
    seed: 13,
    mode: "speedSki",
    laps: 1,
    version: 6,
    digest: "61718aed",
    region: "fell",
    grade: "blue",
    course: "11",
    day: { weather: "flurries", hour: 17.97 },
    figures: { vertical: 248, length: 653 },
  },
  {
    id: "speedSki-4",
    name: "Cold Glass",
    blurb: "A continental track under a clear sky, steep off the start and fast through the trap",
    seed: 20,
    mode: "speedSki",
    laps: 1,
    version: 6,
    digest: "60d95991",
    region: "continental",
    grade: "red",
    course: "5",
    day: { weather: "clear", hour: 14.29 },
    figures: { vertical: 256, length: 538 },
  },
  {
    id: "speedSki-5",
    name: "Long Run-out",
    blurb: "A continental track down a black face: 210 km/h and a long way to stop",
    seed: 23,
    mode: "speedSki",
    laps: 1,
    version: 6,
    digest: "a580d06e",
    region: "continental",
    grade: "black",
    course: "10",
    day: { weather: "clear", hour: 15.12 },
    figures: { vertical: 284, length: 634 },
  },
  {
    id: "speedSki-6",
    name: "Morning Drop",
    blurb: "An alpine track in the morning sun, 300 m down to the trap at 218",
    seed: 26,
    mode: "speedSki",
    laps: 1,
    version: 6,
    digest: "31f256ee",
    grade: "green",
    course: "1",
    day: { weather: "fair", hour: 10.8 },
    figures: { vertical: 299, length: 630 },
  },
  {
    id: "speedSki-7",
    name: "Noon Steep",
    blurb: "An alpine track at noon under a clear sky, past 220 km/h",
    seed: 19,
    mode: "speedSki",
    laps: 1,
    version: 6,
    digest: "ce28de62",
    grade: "black",
    course: "8",
    day: { weather: "clear", hour: 12.51 },
    figures: { vertical: 305, length: 626 },
  },
  {
    id: "speedSki-8",
    name: "Wet Air",
    blurb: "A maritime track under high cloud: 316 m of fall and 223 km/h",
    seed: 15,
    mode: "speedSki",
    laps: 1,
    version: 6,
    digest: "35579761",
    region: "maritime",
    grade: "blue",
    course: "7",
    day: { weather: "high", hour: 12.84 },
    figures: { vertical: 316, length: 732 },
  },
  {
    id: "speedSki-9",
    name: "The Long Launch",
    blurb: "The fastest: a fell face with a 740 m launch, 225 km/h through the trap",
    seed: 28,
    mode: "speedSki",
    laps: 1,
    version: 6,
    digest: "0240ffe1",
    region: "fell",
    grade: "red",
    course: "8",
    day: { weather: "fair", hour: 13.75 },
    figures: { vertical: 323, length: 839 },
  },
];

/** THE SKI CROSS'S NINE, the gentlest first. */
const SKI_CROSS_MAPS: readonly RaceMap[] = [
  {
    id: "skiCross-1",
    name: "Fell Rollers",
    blurb: "A gentle fell blue in flurries as the light goes",
    seed: 24,
    mode: "skiCross",
    laps: 1,
    version: 6,
    digest: "f6bc378d",
    region: "fell",
    grade: "blue",
    course: "8",
    day: { weather: "flurries", hour: 17.92 },
    figures: { vertical: 128, length: 830 },
  },
  {
    id: "skiCross-2",
    name: "Sea Berms",
    blurb: "A maritime blue to learn the berms on",
    seed: 12,
    mode: "skiCross",
    laps: 1,
    version: 6,
    digest: "fefdf046",
    region: "maritime",
    grade: "blue",
    course: "4",
    day: { weather: "fair", hour: 10.69 },
    figures: { vertical: 129, length: 796 },
  },
  {
    id: "skiCross-3",
    name: "High Fell",
    blurb: "Three jumps on a fell blue under high cloud",
    seed: 34,
    mode: "skiCross",
    laps: 1,
    version: 6,
    digest: "60f95f99",
    region: "fell",
    grade: "blue",
    course: "5",
    day: { weather: "high", hour: 11.7 },
    figures: { vertical: 154, length: 790 },
  },
  {
    id: "skiCross-4",
    name: "Afternoon Cross",
    blurb: "A short alpine red in the afternoon sun",
    seed: 16,
    mode: "skiCross",
    laps: 1,
    version: 6,
    digest: "b7578bb3",
    grade: "red",
    course: "13",
    day: { weather: "fair", hour: 14.64 },
    figures: { vertical: 159, length: 793 },
  },
  {
    id: "skiCross-5",
    name: "Roller Coast",
    blurb: "Three sets of rollers on a maritime red",
    seed: 17,
    mode: "skiCross",
    laps: 1,
    version: 6,
    digest: "05f472fc",
    region: "maritime",
    grade: "red",
    course: "4",
    day: { weather: "fair", hour: 10.38 },
    figures: { vertical: 172, length: 835 },
  },
  {
    id: "skiCross-6",
    name: "Long Haul",
    blurb: "Nearly a kilometre of continental course under high cloud",
    seed: 27,
    mode: "skiCross",
    laps: 1,
    version: 6,
    digest: "d313cb13",
    region: "continental",
    grade: "red",
    course: "7",
    day: { weather: "high", hour: 14.75 },
    figures: { vertical: 198, length: 983 },
  },
  {
    id: "skiCross-7",
    name: "Big Air Alley",
    blurb: "Four jumps and a step-down on a clear alpine red",
    seed: 25,
    mode: "skiCross",
    laps: 1,
    version: 6,
    digest: "f43c0412",
    grade: "red",
    course: "3",
    day: { weather: "clear", hour: 14.17 },
    figures: { vertical: 188, length: 933 },
  },
  {
    id: "skiCross-8",
    name: "Night Cross",
    blurb: "Five jumps under the floodlights on a continental red",
    seed: 21,
    mode: "skiCross",
    laps: 1,
    version: 6,
    digest: "cf5bee60",
    region: "continental",
    grade: "red",
    course: "3",
    day: { weather: "fair", hour: 20.2 },
    figures: { vertical: 183, length: 903 },
  },
  {
    id: "skiCross-9",
    name: "Black Cross",
    blurb: "A continental black of seven tight berms",
    seed: 30,
    mode: "skiCross",
    laps: 1,
    version: 6,
    digest: "4da5deb0",
    region: "continental",
    grade: "black",
    course: "8",
    day: { weather: "fair", hour: 9.94 },
    figures: { vertical: 189, length: 880 },
  },
];

/** THE GIANT SLALOM'S NINE (R36), the gentlest first: the reds, then the
 * blacks, each from a start lowered down the ski area's biggest course to
 * some 400 m of vertical — every one raced by the bot clean on both runs,
 * within −4 … +4 % of par, across the alpine, the continental and the
 * maritime, one at dusk. */
const GIANT_SLALOM_MAPS: readonly RaceMap[] = [
  {
    id: "giantSlalom-1",
    name: "Long Fall",
    blurb: "A maritime red in the afternoon: long even turns from the first gate",
    seed: 21,
    mode: "giantSlalom",
    laps: 1,
    version: 6,
    digest: "5e5f9d44",
    region: "maritime",
    grade: "red",
    course: "8",
    day: { weather: "fair", hour: 13.13 },
    figures: { vertical: 398, length: 1852 },
  },
  {
    id: "giantSlalom-2",
    name: "Long Shadows",
    blurb: "A maritime red under a low afternoon sun",
    seed: 27,
    mode: "giantSlalom",
    laps: 1,
    version: 6,
    digest: "79794319",
    region: "maritime",
    grade: "red",
    course: "9",
    day: { weather: "fair", hour: 15.03 },
    figures: { vertical: 399, length: 1880 },
  },
  {
    id: "giantSlalom-3",
    name: "Morning Rhythm",
    blurb: "A short alpine red early in the morning, the rhythm quick",
    seed: 16,
    mode: "giantSlalom",
    laps: 1,
    version: 6,
    digest: "49fbed65",
    grade: "red",
    course: "8",
    day: { weather: "clear", hour: 9.22 },
    figures: { vertical: 400, length: 1570 },
  },
  {
    id: "giantSlalom-4",
    name: "Dusk Turns",
    blurb: "A maritime red raced at dusk under the floodlights",
    seed: 20,
    mode: "giantSlalom",
    laps: 1,
    version: 6,
    digest: "3a823d25",
    region: "maritime",
    grade: "red",
    course: "9",
    day: { weather: "fair", hour: 18.14 },
    figures: { vertical: 400, length: 2006 },
  },
  {
    id: "giantSlalom-5",
    name: "Steep Opener",
    blurb: "A short alpine black: steep from the house, turn after turn",
    seed: 2,
    mode: "giantSlalom",
    laps: 1,
    version: 6,
    digest: "f5ccc53b",
    grade: "black",
    course: "7",
    day: { weather: "fair", hour: 13.9 },
    figures: { vertical: 400, length: 1668 },
  },
  {
    id: "giantSlalom-6",
    name: "Thin Cloud",
    blurb: "An alpine black under high cloud, two crests to carry",
    seed: 7,
    mode: "giantSlalom",
    laps: 1,
    version: 6,
    digest: "e2ffe22f",
    grade: "black",
    course: "9",
    day: { weather: "high", hour: 13.3 },
    figures: { vertical: 400, length: 1862 },
  },
  {
    id: "giantSlalom-7",
    name: "Grey Hill",
    blurb: "An alpine black in the flat light of an overcast, three crests on it",
    seed: 18,
    mode: "giantSlalom",
    laps: 1,
    version: 6,
    digest: "bffa7ac3",
    grade: "black",
    course: "9",
    day: { weather: "overcast", hour: 16.35 },
    figures: { vertical: 399, length: 1782 },
  },
  {
    id: "giantSlalom-8",
    name: "Fog Gates",
    blurb: "A continental black in the valley fog, gate after gate out of the murk",
    seed: 25,
    mode: "giantSlalom",
    laps: 1,
    version: 6,
    digest: "6f65eb84",
    region: "continental",
    grade: "black",
    course: "10",
    day: { weather: "fog", hour: 17.19 },
    figures: { vertical: 400, length: 1652 },
  },
  {
    id: "giantSlalom-9",
    name: "Short Fuse",
    blurb: "The shortest and steepest: a continental black with three jumps",
    seed: 26,
    mode: "giantSlalom",
    laps: 1,
    version: 6,
    digest: "616334e4",
    region: "continental",
    grade: "black",
    course: "11",
    day: { weather: "fair", hour: 14.22 },
    figures: { vertical: 399, length: 1536 },
  },
];

/** EVERY DISCIPLINE'S NINE. A discipline built later adds its row here. */
export const RACE_MAPS: RaceMaps = {
  slalom: SLALOM_MAPS,
  giantSlalom: GIANT_SLALOM_MAPS,
  superG: SUPER_G_MAPS,
  downhill: DOWNHILL_MAPS,
  speedSki: SPEED_SKI_MAPS,
  skiCross: SKI_CROSS_MAPS,
};

/** The discipline a mode races, where it races one. */
export function disciplineOf(mode: GameMode): Discipline | null {
  return DISCIPLINES.find((d) => d.mode === mode)?.id ?? null;
}

/** THE RACE MAPS A MODE IS RACED ON, or null where it races no discipline
 * (the free ride, the tricks run). */
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
