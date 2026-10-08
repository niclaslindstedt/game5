// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE MAPS — every race discipline's own NINE pinned maps, the ones a
// SLALOM, a GIANT SLALOM, a SUPER-G, a DOWNHILL, a SPEED RACE or a SKI CROSS
// off the race card is raced on, picked on the level card
// (`menu-levels.tsx`) its tile opens.
//
// A discipline's measured maps are chosen for the DISCIPLINE: nine seeds
// whose course makes a good race of it, out of a sweep of the generator's
// seeds on generator v8 (the bot down each candidate's course, the course's
// figures beside it, every shortlisted map looked at). A slalom's nine are
// the ski areas whose slalom stretch (R31) is a real slalom hill — the drop,
// the pitch, the combinations, the bot home clean near the slalom's minute;
// a downhill's the courses with a downhill's vertical and length under
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
    name: "Sea Pitch",
    blurb: "A long, gentle maritime pitch under high cloud",
    seed: 25,
    mode: "slalom",
    laps: 1,
    version: 8,
    digest: "218b72c7",
    region: "maritime",
    grade: "red",
    course: "6",
    day: { weather: "high", hour: 12.06 },
    figures: { vertical: 161, length: 640 },
  },
  {
    id: "slalom-2",
    name: "Grey Morning",
    blurb: "A long fell pitch in the flat light of an overcast morning",
    seed: 12,
    mode: "slalom",
    laps: 1,
    version: 8,
    digest: "8a538fb9",
    region: "fell",
    grade: "red",
    course: "2",
    day: { weather: "overcast", hour: 10.05 },
    figures: { vertical: 190, length: 650 },
  },
  {
    id: "slalom-3",
    name: "Fog Gates",
    blurb: "An alpine red where every gate comes out of the fog",
    seed: 19,
    mode: "slalom",
    laps: 1,
    version: 8,
    digest: "4acd6fb6",
    grade: "red",
    course: "8",
    day: { weather: "fog", hour: 12.35 },
    figures: { vertical: 191, length: 620 },
  },
  {
    id: "slalom-4",
    name: "Floodlit",
    blurb: "A night slalom under the masts on a continental red",
    seed: 26,
    mode: "slalom",
    laps: 1,
    version: 8,
    digest: "27201538",
    region: "continental",
    grade: "red",
    course: "3",
    sky: { hour: 20 },
    day: { weather: "clear", hour: 20 },
    figures: { vertical: 190, length: 600 },
  },
  {
    id: "slalom-5",
    name: "Afternoon Hill",
    blurb: "An even alpine pitch in the afternoon sun",
    seed: 2,
    mode: "slalom",
    laps: 1,
    version: 8,
    digest: "af4c0c8c",
    grade: "red",
    course: "6",
    day: { weather: "fair", hour: 15.46 },
    figures: { vertical: 190, length: 598 },
  },
  {
    id: "slalom-6",
    name: "Bright Fell",
    blurb: "A clear fell morning on a steep, even hill",
    seed: 38,
    mode: "slalom",
    laps: 1,
    version: 8,
    digest: "b6e3ca64",
    region: "fell",
    grade: "red",
    course: "5",
    day: { weather: "clear", hour: 10.45 },
    figures: { vertical: 190, length: 568 },
  },
  {
    id: "slalom-7",
    name: "Storm Hill",
    blurb: "A short alpine hill raced through a storm",
    seed: 33,
    mode: "slalom",
    laps: 1,
    version: 8,
    digest: "f0df1d1a",
    grade: "red",
    course: "5",
    day: { weather: "storm", hour: 14.5 },
    figures: { vertical: 140, length: 402 },
  },
  {
    id: "slalom-8",
    name: "Snow Gates",
    blurb: "Falling snow on a steep maritime hill",
    seed: 35,
    mode: "slalom",
    laps: 1,
    version: 8,
    digest: "316b1850",
    region: "maritime",
    grade: "red",
    course: "7",
    day: { weather: "snow", hour: 12.42 },
    figures: { vertical: 191, length: 532 },
  },
  {
    id: "slalom-9",
    name: "Black Wall",
    blurb: "The steepest of the nine: an alpine black in flurries",
    seed: 36,
    mode: "slalom",
    laps: 1,
    version: 8,
    digest: "ab966cb8",
    grade: "black",
    course: "8",
    day: { weather: "flurries", hour: 13.78 },
    figures: { vertical: 191, length: 422 },
  },
];

/** THE DOWNHILL'S NINE, the gentlest first. */
const DOWNHILL_MAPS: readonly RaceMap[] = [
  {
    id: "downhill-1",
    name: "Evening Run",
    blurb: "Eight hundred metres of alpine black into the evening",
    seed: 38,
    mode: "downhill",
    laps: 1,
    version: 8,
    digest: "e423f587",
    grade: "black",
    course: "12",
    day: { weather: "fair", hour: 19.99 },
    figures: { vertical: 816, length: 2822 },
  },
  {
    id: "downhill-2",
    name: "Snow Black",
    blurb: "A continental black raced in the falling snow",
    seed: 20,
    mode: "downhill",
    laps: 1,
    version: 8,
    digest: "52ca33c6",
    region: "continental",
    grade: "black",
    course: "9",
    day: { weather: "snow", hour: 9.12 },
    figures: { vertical: 876, length: 2902 },
  },
  {
    id: "downhill-3",
    name: "Long Glide",
    blurb: "Four and a half kilometres of maritime blue: a glider's course",
    seed: 25,
    mode: "downhill",
    laps: 1,
    version: 8,
    digest: "da216578",
    region: "maritime",
    grade: "blue",
    course: "5",
    day: { weather: "high", hour: 12.34 },
    figures: { vertical: 894, length: 4408 },
  },
  {
    id: "downhill-4",
    name: "Fell Classic",
    blurb: "Over four kilometres of fell red in the afternoon",
    seed: 14,
    mode: "downhill",
    laps: 1,
    version: 8,
    digest: "5639022c",
    region: "fell",
    grade: "red",
    course: "6",
    day: { weather: "fair", hour: 15.85 },
    figures: { vertical: 933, length: 4161 },
  },
  {
    id: "downhill-5",
    name: "Into the Fog",
    blurb: "A long maritime red raced into the fog",
    seed: 1,
    mode: "downhill",
    laps: 1,
    version: 8,
    digest: "2111da8c",
    region: "maritime",
    grade: "red",
    course: "5",
    day: { weather: "fog", hour: 10.54 },
    figures: { vertical: 950, length: 4132 },
  },
  {
    id: "downhill-6",
    name: "Grey Giant",
    blurb: "Nearly a thousand metres of alpine red under grey cloud",
    seed: 30,
    mode: "downhill",
    laps: 1,
    version: 8,
    digest: "13ff8a79",
    grade: "red",
    course: "6",
    day: { weather: "overcast", hour: 12.77 },
    figures: { vertical: 979, length: 4138 },
  },
  {
    id: "downhill-7",
    name: "Black Flurries",
    blurb: "A thousand metres of continental black in flurries",
    seed: 39,
    mode: "downhill",
    laps: 1,
    version: 8,
    digest: "975ba431",
    region: "continental",
    grade: "black",
    course: "7",
    day: { weather: "flurries", hour: 11.49 },
    figures: { vertical: 1018, length: 3592 },
  },
  {
    id: "downhill-8",
    name: "Low Sun",
    blurb: "A fell red in the long light of late afternoon",
    seed: 36,
    mode: "downhill",
    laps: 1,
    version: 8,
    digest: "f2e1db47",
    region: "fell",
    grade: "red",
    course: "6",
    day: { weather: "clear", hour: 16.49 },
    figures: { vertical: 1041, length: 3920 },
  },
  {
    id: "downhill-9",
    name: "Big Drop",
    blurb: "The tallest of the nine: eleven hundred metres of alpine red",
    seed: 5,
    mode: "downhill",
    laps: 1,
    version: 8,
    digest: "167b619d",
    grade: "red",
    course: "7",
    day: { weather: "flurries", hour: 12.04 },
    figures: { vertical: 1083, length: 3862 },
  },
];

/** THE SUPER-G'S NINE (R33), the longest and gentlest first — curated on
 * generator v8 off a sweep of seeds 1–40 in all four countries: a blue,
 * six reds and two blacks, 600 m of vertical from a start lowered down the
 * area's biggest course, every sky the jury races in but a storm — the bot
 * home on every one with no gate missed, no net and no harsh landing. */
const SUPER_G_MAPS: readonly RaceMap[] = [
  {
    id: "superG-1",
    name: "Morning Blue",
    blurb: "A long fell blue in the clear morning: room to find the line",
    seed: 31,
    mode: "superG",
    laps: 1,
    version: 8,
    digest: "60874e2c",
    region: "fell",
    grade: "blue",
    course: "5",
    day: { weather: "clear", hour: 9.86 },
    figures: { vertical: 600, length: 3137 },
  },
  {
    id: "superG-2",
    name: "Grey Coast",
    blurb: "Long maritime turns under an overcast sky",
    seed: 21,
    mode: "superG",
    laps: 1,
    version: 8,
    digest: "a75fd1c2",
    region: "maritime",
    grade: "red",
    course: "7",
    day: { weather: "overcast", hour: 14.9 },
    figures: { vertical: 600, length: 2913 },
  },
  {
    id: "superG-3",
    name: "Early Light",
    blurb: "A continental red in the low morning sun",
    seed: 19,
    mode: "superG",
    laps: 1,
    version: 8,
    digest: "a277608c",
    region: "continental",
    grade: "red",
    course: "4",
    day: { weather: "fair", hour: 9.28 },
    figures: { vertical: 600, length: 2769 },
  },
  {
    id: "superG-4",
    name: "High Cloud",
    blurb: "An alpine red under high cloud",
    seed: 23,
    mode: "superG",
    laps: 1,
    version: 8,
    digest: "80e9f82b",
    grade: "red",
    course: "7",
    day: { weather: "high", hour: 13.08 },
    figures: { vertical: 600, length: 2707 },
  },
  {
    id: "superG-5",
    name: "Fast Red",
    blurb: "An alpine red that runs past a hundred at the trap",
    seed: 34,
    mode: "superG",
    laps: 1,
    version: 8,
    digest: "506b1767",
    grade: "red",
    course: "6",
    day: { weather: "high", hour: 12.21 },
    figures: { vertical: 599, length: 2603 },
  },
  {
    id: "superG-6",
    name: "Snow Speed",
    blurb: "A maritime red raced in falling snow",
    seed: 5,
    mode: "superG",
    laps: 1,
    version: 8,
    digest: "f482c758",
    region: "maritime",
    grade: "red",
    course: "5",
    day: { weather: "snow", hour: 14.27 },
    figures: { vertical: 600, length: 2540 },
  },
  {
    id: "superG-7",
    name: "Low Sun",
    blurb: "A fell red in the long light of late afternoon",
    seed: 36,
    mode: "superG",
    laps: 1,
    version: 8,
    digest: "f2e1db47",
    region: "fell",
    grade: "red",
    course: "6",
    day: { weather: "clear", hour: 16.49 },
    figures: { vertical: 600, length: 2458 },
  },
  {
    id: "superG-8",
    name: "Evening Black",
    blurb: "An alpine black raced into the evening",
    seed: 38,
    mode: "superG",
    laps: 1,
    version: 8,
    digest: "e423f587",
    grade: "black",
    course: "12",
    day: { weather: "fair", hour: 19.99 },
    figures: { vertical: 599, length: 2378 },
  },
  {
    id: "superG-9",
    name: "Black Flurries",
    blurb: "The tightest of the nine: a continental black in flurries",
    seed: 39,
    mode: "superG",
    laps: 1,
    version: 8,
    digest: "975ba431",
    region: "continental",
    grade: "black",
    course: "7",
    day: { weather: "flurries", hour: 11.49 },
    figures: { vertical: 599, length: 2292 },
  },
];

/** SPEED SKIING'S NINE (R34), the slowest track first: nine faces a
 * straight track was cut down whose clean run in a full tuck comes through
 * the timing zone at 187–215 km/h, across all four countries, curated on
 * generator v8 off a sweep of seeds 1–40. Each box draws the track, and its
 * figures are the FINAL's: the start house at the top to the timing zone's
 * bottom line. */
const SPEED_SKI_MAPS: readonly RaceMap[] = [
  {
    id: "speedSki-1",
    name: "First Track",
    blurb: "A short continental track under a clear sky",
    seed: 39,
    mode: "speedSki",
    laps: 1,
    version: 8,
    digest: "15f3fcf4",
    region: "continental",
    grade: "red",
    course: "6",
    day: { weather: "clear", hour: 14.51 },
    figures: { vertical: 222, length: 445 },
  },
  {
    id: "speedSki-2",
    name: "Fog Track",
    blurb: "An alpine track that drops out of the fog",
    seed: 7,
    mode: "speedSki",
    laps: 1,
    version: 8,
    digest: "d08f4a09",
    grade: "black",
    course: "11",
    day: { weather: "fog", hour: 16.73 },
    figures: { vertical: 231, length: 437 },
  },
  {
    id: "speedSki-3",
    name: "Fair Fell",
    blurb: "A fell track on a fair afternoon",
    seed: 29,
    mode: "speedSki",
    laps: 1,
    version: 8,
    digest: "80cc1da5",
    region: "fell",
    grade: "red",
    course: "13",
    day: { weather: "fair", hour: 14.55 },
    figures: { vertical: 245, length: 545 },
  },
  {
    id: "speedSki-4",
    name: "Sea Fog",
    blurb: "A maritime track with the fog rolling in",
    seed: 20,
    mode: "speedSki",
    laps: 1,
    version: 8,
    digest: "97385435",
    region: "maritime",
    grade: "red",
    course: "8",
    day: { weather: "fog", hour: 14.48 },
    figures: { vertical: 253, length: 542 },
  },
  {
    id: "speedSki-5",
    name: "Flurry Track",
    blurb: "A maritime track in flurries out of a sunny sky",
    seed: 23,
    mode: "speedSki",
    laps: 1,
    version: 8,
    digest: "fd71e0f8",
    region: "maritime",
    grade: "red",
    course: "3",
    day: { weather: "flurries", hour: 11.82 },
    figures: { vertical: 272, length: 529 },
  },
  {
    id: "speedSki-6",
    name: "Long Launch",
    blurb: "A long alpine launch under high cloud",
    seed: 25,
    mode: "speedSki",
    laps: 1,
    version: 8,
    digest: "0b8a4ace",
    grade: "red",
    course: "12",
    day: { weather: "high", hour: 11.74 },
    figures: { vertical: 301, length: 740 },
  },
  {
    id: "speedSki-7",
    name: "High Track",
    blurb: "A steep alpine track under high cloud",
    seed: 26,
    mode: "speedSki",
    laps: 1,
    version: 8,
    digest: "b1d36403",
    grade: "red",
    course: "2",
    day: { weather: "high", hour: 12.66 },
    figures: { vertical: 282, length: 525 },
  },
  {
    id: "speedSki-8",
    name: "Snow Track",
    blurb: "A continental track in falling snow",
    seed: 36,
    mode: "speedSki",
    laps: 1,
    version: 8,
    digest: "f526fb0c",
    region: "continental",
    grade: "black",
    course: "6",
    day: { weather: "snow", hour: 10.73 },
    figures: { vertical: 289, length: 521 },
  },
  {
    id: "speedSki-9",
    name: "The Fastest",
    blurb: "The steepest track of the nine, over 210 at the line",
    seed: 19,
    mode: "speedSki",
    laps: 1,
    version: 8,
    digest: "a4b93689",
    region: "maritime",
    grade: "red",
    course: "11",
    day: { weather: "high", hour: 11.84 },
    figures: { vertical: 318, length: 732 },
  },
];

/** THE SKI CROSS'S NINE, the gentlest first. */
const SKI_CROSS_MAPS: readonly RaceMap[] = [
  {
    id: "skiCross-1",
    name: "Alpine Berms",
    blurb: "An alpine red with seven berms under high cloud",
    seed: 25,
    mode: "skiCross",
    laps: 1,
    version: 8,
    digest: "0b8a4ace",
    grade: "red",
    course: "12",
    day: { weather: "high", hour: 11.74 },
    figures: { vertical: 166, length: 861 },
  },
  {
    id: "skiCross-2",
    name: "Fell Black",
    blurb: "A clear fell black with eight banked turns",
    seed: 15,
    mode: "skiCross",
    laps: 1,
    version: 8,
    digest: "1a16ba8d",
    region: "fell",
    grade: "black",
    course: "12",
    day: { weather: "clear", hour: 11.51 },
    figures: { vertical: 190, length: 961 },
  },
  {
    id: "skiCross-3",
    name: "Continental Cross",
    blurb: "Five jumps down a sunny continental red",
    seed: 26,
    mode: "skiCross",
    laps: 1,
    version: 8,
    digest: "27201538",
    region: "continental",
    grade: "red",
    course: "3",
    day: { weather: "clear", hour: 13.9 },
    figures: { vertical: 189, length: 951 },
  },
  {
    id: "skiCross-4",
    name: "Snow Cross",
    blurb: "A maritime red raced in the falling snow",
    seed: 12,
    mode: "skiCross",
    laps: 1,
    version: 8,
    digest: "d59ac0b1",
    region: "maritime",
    grade: "red",
    course: "11",
    day: { weather: "snow", hour: 9.37 },
    figures: { vertical: 181, length: 904 },
  },
  {
    id: "skiCross-5",
    name: "Flurry Cross",
    blurb: "Flurries on a continental red with a step-down",
    seed: 23,
    mode: "skiCross",
    laps: 1,
    version: 8,
    digest: "8e008e5b",
    region: "continental",
    grade: "red",
    course: "7",
    day: { weather: "flurries", hour: 12.59 },
    figures: { vertical: 185, length: 913 },
  },
  {
    id: "skiCross-6",
    name: "Roller Coast",
    blurb: "A maritime red with four sets of rollers",
    seed: 7,
    mode: "skiCross",
    laps: 1,
    version: 8,
    digest: "62b508b2",
    region: "maritime",
    grade: "red",
    course: "10",
    day: { weather: "clear", hour: 9.72 },
    figures: { vertical: 166, length: 814 },
  },
  {
    id: "skiCross-7",
    name: "Afternoon Cross",
    blurb: "An alpine red in the afternoon, flurries blowing",
    seed: 29,
    mode: "skiCross",
    laps: 1,
    version: 8,
    digest: "bd917166",
    grade: "red",
    course: "7",
    day: { weather: "flurries", hour: 15.04 },
    figures: { vertical: 184, length: 895 },
  },
  {
    id: "skiCross-8",
    name: "Blue Jumps",
    blurb: "A fell blue with five jumps and two step-downs",
    seed: 39,
    mode: "skiCross",
    laps: 1,
    version: 8,
    digest: "2239b224",
    region: "fell",
    grade: "blue",
    course: "6",
    day: { weather: "clear", hour: 9.79 },
    figures: { vertical: 181, length: 869 },
  },
  {
    id: "skiCross-9",
    name: "Fog Cross",
    blurb: "The last of the nine: an alpine red in the fog",
    seed: 31,
    mode: "skiCross",
    laps: 1,
    version: 8,
    digest: "f0754677",
    grade: "red",
    course: "4",
    day: { weather: "fog", hour: 10.73 },
    figures: { vertical: 192, length: 882 },
  },
];

/** THE GIANT SLALOM'S NINE (R36), the longest and gentlest first, each
 * from a start lowered down the ski area's biggest course to 400 m of
 * vertical — curated on generator v8 off a sweep of seeds 1–40 in all four
 * countries, every one raced by the bot clean. */
const GIANT_SLALOM_MAPS: readonly RaceMap[] = [
  {
    id: "giantSlalom-1",
    name: "Wide Blue",
    blurb: "Long open turns down an alpine blue under high cloud",
    seed: 25,
    mode: "giantSlalom",
    laps: 1,
    version: 8,
    digest: "d8c70140",
    grade: "blue",
    course: "5",
    day: { weather: "high", hour: 12.22 },
    figures: { vertical: 400, length: 2186 },
  },
  {
    id: "giantSlalom-2",
    name: "Fell Afternoon",
    blurb: "Two kilometres of fell red in the afternoon sun",
    seed: 14,
    mode: "giantSlalom",
    laps: 1,
    version: 8,
    digest: "5639022c",
    region: "fell",
    grade: "red",
    course: "6",
    day: { weather: "fair", hour: 15.85 },
    figures: { vertical: 400, length: 2097 },
  },
  {
    id: "giantSlalom-3",
    name: "Fog Black",
    blurb: "A continental black raced into the fog",
    seed: 7,
    mode: "giantSlalom",
    laps: 1,
    version: 8,
    digest: "c6174135",
    region: "continental",
    grade: "black",
    course: "11",
    day: { weather: "fog", hour: 16.59 },
    figures: { vertical: 399, length: 2006 },
  },
  {
    id: "giantSlalom-4",
    name: "Grey Sound",
    blurb: "An overcast maritime red, even from top to bottom",
    seed: 37,
    mode: "giantSlalom",
    laps: 1,
    version: 8,
    digest: "5ff4e07e",
    region: "maritime",
    grade: "red",
    course: "6",
    day: { weather: "overcast", hour: 11.84 },
    figures: { vertical: 400, length: 1953 },
  },
  {
    id: "giantSlalom-5",
    name: "Snow Turns",
    blurb: "Falling snow on a steady maritime red",
    seed: 30,
    mode: "giantSlalom",
    laps: 1,
    version: 8,
    digest: "2e6e95b4",
    region: "maritime",
    grade: "red",
    course: "6",
    day: { weather: "snow", hour: 10.24 },
    figures: { vertical: 400, length: 1892 },
  },
  {
    id: "giantSlalom-6",
    name: "Clear Fell",
    blurb: "A fell black under a clear sky",
    seed: 34,
    mode: "giantSlalom",
    laps: 1,
    version: 8,
    digest: "4bfdeb8c",
    region: "fell",
    grade: "black",
    course: "10",
    day: { weather: "clear", hour: 11.3 },
    figures: { vertical: 400, length: 1868 },
  },
  {
    id: "giantSlalom-7",
    name: "Flurry Red",
    blurb: "Flurries out of a sunny sky on an alpine red",
    seed: 5,
    mode: "giantSlalom",
    laps: 1,
    version: 8,
    digest: "167b619d",
    grade: "red",
    course: "7",
    day: { weather: "flurries", hour: 12.04 },
    figures: { vertical: 400, length: 1772 },
  },
  {
    id: "giantSlalom-8",
    name: "Steep Black",
    blurb: "A continental black with the turns stacked close",
    seed: 26,
    mode: "giantSlalom",
    laps: 1,
    version: 8,
    digest: "6cb81b88",
    region: "continental",
    grade: "black",
    course: "9",
    day: { weather: "clear", hour: 13.23 },
    figures: { vertical: 400, length: 1722 },
  },
  {
    id: "giantSlalom-9",
    name: "Short and Sharp",
    blurb: "The shortest of the nine: 1.7 km of fell red",
    seed: 3,
    mode: "giantSlalom",
    laps: 1,
    version: 8,
    digest: "2cc30c2c",
    region: "fell",
    grade: "red",
    course: "8",
    day: { weather: "high", hour: 13.64 },
    figures: { vertical: 400, length: 1704 },
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
