// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS A RUN IS NAMED FROM — every word on a piste-head sign and in
// the news line that names a run (§39.1). The names are DEALT from these
// lists by `run-names.ts`; this file holds only the words and the forms
// they are put together in.
//
// HOW A SKI AREA NAMES ITS RUNS, as the pattern and never the instance:
//
//   * EVERY RUN HAS A NUMBER and most have a name; the number is what the
//     sign and the piste map lead with, the name what a skier remembers.
//   * A RUN IS NAMED FOR WHAT IT IS OR WHAT IS ON IT: the terrain (a wall,
//     a couloir, a bowl, a ridge, a gully, a meadow, a glade), what lives
//     there (the birds and the beasts of the country — the same roster the
//     wildlife is dealt), what grows there (the trees), the weather and the
//     light, the works of the valley (a hut, a dairy, a sawmill, a claim).
//   * THE COLOUR SETS THE TONE: a green is a family's run — a meadow, a
//     sunny pasture, a little hill; a blue is the mountain's own word; a red
//     is bolder; a black is FEARSOME — a wall, a face, a chute, a gorge,
//     and now and then a joke a skier makes at the top of one.
//   * A LANE IS NAMED AS A WAY: a cat track or a ski path is a "-way", a
//     "path", a "road", a "track", a "traverse" or a "catwalk".
//   * THE COUNTRY SETS THE VOICE:
//       - the ALPINE numbers every run and names it for the alp, the hut, the
//         col or the wall it runs off, its valley run and its forest run;
//         its lanes are paths and ways;
//       - the FELLS name a run as a slope or a hill — the family slope, the
//         steep, the loop — for the birch, the berries, the reindeer and the
//         grouse; their lanes are tracks and trails;
//       - the CONTINENTAL ranges name a run for a PERSON (someone's run,
//         someone's glade — a first name in the possessive), for the camps
//         of the valley's working past (the sawmill, the claim, the flume),
//         for the beasts, and for a joke; their lanes are roads, catwalks
//         and traverses;
//       - the MARITIME ranges name a run as a COURSE in borrowed English
//         words — the family course, the forest course, the panorama — or
//         for the serow, the sika and the rime; their lanes are routes and
//         ways.
//
// Every name here is invented and generic; none is a real run's.

import type { PisteGrade, RegionId } from "@engine";

/** One way of making a name: the first words, the second words, and how a
 * pair is put together. A form with no `tails` is a whole name per head. */
export type NameForm = {
  heads: readonly string[];
  tails?: readonly string[];
  join?: (head: string, tail: string) => string;
};

/** A country's voice: the forms for a piste of each colour, and for a lane
 * — whose forms ALWAYS end in one of `laneWords`. */
export type RegionNames = Readonly<Record<PisteGrade, readonly NameForm[]>> & {
  lane: readonly NameForm[];
  laneWords: readonly string[];
};

const own = (head: string, tail: string): string => `${head}'s ${tail}`;

const ALPINE: RegionNames = {
  green: [
    {
      heads: ["Sunny", "Little", "Cowbell", "Gentian", "Haybarn", "Chapel", "Dairy", "Snowbell"],
      tails: ["Meadow", "Alp", "Pasture", "Glade"],
    },
    { heads: ["Family", "Valley", "Village"], tails: ["Run", "Meadow"] },
  ],
  blue: [
    {
      heads: ["Larch", "Stone Pine", "Chamois", "Marmot", "Hut", "Spring", "Hare", "Nutcracker"],
      tails: ["Run", "Glade", "Descent", "Bowl", "Woods"],
    },
  ],
  red: [
    {
      heads: ["Chough", "Ibex", "Eagle", "Moraine", "Cornice", "Col", "Glacier", "Fox"],
      tails: ["Ridge", "Shoulder", "Gully", "Descent", "Schuss"],
    },
  ],
  black: [
    {
      heads: ["Vulture", "Iron", "North", "Grey", "Lynx", "Devil's", "Raven", "Thunder"],
      tails: ["Wall", "Couloir", "Face", "Gorge", "Chute"],
    },
  ],
  lane: [
    {
      heads: ["Larch", "Hut", "Chapel", "Dairy", "Sawmill", "Moraine", "Spring", "Forest", "Col"],
      tails: ["Way", "Path", "Traverse"],
    },
  ],
  laneWords: ["Way", "Path", "Traverse"],
};

const FELL: RegionNames = {
  green: [
    {
      heads: ["Birch", "Willow", "Cloudberry", "Lingonberry", "Bunting", "Tarn", "Sunrise"],
      tails: ["Slope", "Hill", "Loop", "Glade"],
    },
    { heads: ["Family", "Children's", "Little"], tails: ["Slope", "Hill"] },
  ],
  blue: [
    {
      heads: ["Reindeer", "Ptarmigan", "Ermine", "Fox", "Fell", "Cairn", "Snow Hare", "Lemming"],
      tails: ["Slope", "Run", "Brow", "Hill"],
    },
  ],
  red: [
    {
      heads: ["Wolverine", "Raven", "Eagle", "Northern Light", "Blizzard", "Sastrugi", "Snowdrift"],
      tails: ["Run", "Brow", "Slope", "Gully"],
    },
  ],
  black: [
    {
      heads: ["Storm", "Midwinter", "Polar Night", "Frost", "Wolverine", "Gale"],
      tails: ["Steep", "Wall", "Drop", "Gully"],
    },
    { heads: ["The Steep", "The Long Drop", "The Ice Wall"] },
  ],
  lane: [
    {
      heads: ["Birch", "Reindeer", "Fence", "Sledge", "Tarn", "Cabin", "Herder", "Fell"],
      tails: ["Track", "Trail"],
    },
  ],
  laneWords: ["Track", "Trail"],
};

const CONTINENTAL: RegionNames = {
  green: [
    {
      heads: ["Mabel", "Otto", "Hattie", "Gus", "Lena", "Arvid", "Nell", "Edie", "Clem"],
      tails: ["Meadow", "Glade", "Park"],
      join: own,
    },
    {
      heads: ["Sleepy", "Sunday", "Picnic", "Homestead", "Lazy"],
      tails: ["Meadow", "Flats", "Park"],
    },
  ],
  blue: [
    {
      heads: ["Aspen", "Lodgepole", "Elk", "Sawmill", "Sluice", "Lantern", "Pack Mule", "Assay"],
      tails: ["Glade", "Run", "Park", "Gulch", "Trail"],
    },
    {
      heads: ["Walt", "Ingrid", "Rudy", "Birger", "Ada", "Hank"],
      tails: ["Run", "Glade"],
      join: own,
    },
  ],
  red: [
    {
      heads: ["Bighorn", "Coyote", "Moose", "Timberline", "Dynamite", "Avalanche", "Mule Deer"],
      tails: ["Ridge", "Gulch", "Chute", "Bowl"],
    },
    { heads: ["Jeb", "Tillie", "Orrin", "Maude"], tails: ["Ridge", "Bowl"], join: own },
  ],
  black: [
    {
      heads: ["Wolf", "Blackpowder", "Rockslide", "Cougar", "Mountain Goat", "Lightning"],
      tails: ["Chute", "Couloir", "Face", "Plunge", "Headwall"],
    },
    { heads: ["Second Thoughts", "Knee Knocker", "Hold Your Hat", "Gulp", "No Way Back"] },
  ],
  lane: [
    {
      heads: ["Sawmill", "Wagon", "Mule", "Haul", "Skid", "Timber", "Claim", "Flume", "Stage"],
      tails: ["Road", "Catwalk", "Traverse"],
    },
  ],
  laneWords: ["Road", "Catwalk", "Traverse"],
};

const MARITIME: RegionNames = {
  green: [
    {
      heads: ["Family", "Rainbow", "Snowman", "Sunshine", "Kids", "Cherry", "Starlight"],
      tails: ["Course", "Garden", "Park", "Field"],
    },
  ],
  blue: [
    {
      heads: ["Panorama", "Forest", "Fir", "Birch", "Sika", "Hare", "Sea View", "Lantern"],
      tails: ["Course", "Run", "Line"],
    },
  ],
  red: [
    {
      heads: ["Serow", "Sea Eagle", "Powder", "Rime", "Challenge", "Typhoon", "Jay"],
      tails: ["Course", "Wall", "Slope"],
    },
  ],
  black: [
    {
      heads: ["Macaque", "Storm", "Dragon", "Tengu", "Thunder", "Ice Fall"],
      tails: ["Wall", "Course", "Plunge", "Chute"],
    },
  ],
  lane: [
    {
      heads: ["Forest", "River", "Shrine", "Bridge", "Lantern", "Village", "Valley", "Cedar"],
      tails: ["Route", "Way"],
    },
  ],
  laneWords: ["Route", "Way"],
};

/** Every country's voice, by the region a map was built in. */
export const RUN_NAMES: Readonly<Record<RegionId, RegionNames>> = {
  alpine: ALPINE,
  fell: FELL,
  continental: CONTINENTAL,
  maritime: MARITIME,
};

/** The words around a run's name. */
export const RUN_WORDS = {
  /** The grade's shape as a glyph (`grade-look.ts`), for a line of text. */
  mark: { green: "●", blue: "■", red: "▬", black: "◆" } as Readonly<Record<PisteGrade, string>>,
  /** The run as the news line names it: `◆ RUN 7 · IRON WALL`. */
  newsRun: (mark: string, number: string, name: string): string =>
    `${mark} RUN ${number} · ${name.toUpperCase()}`,
  /** A lane as the news line names it: `● HUT PATH`. */
  newsLane: (mark: string, name: string): string => `${mark} ${name.toUpperCase()}`,
  /** A course that chains runs: the first's name to the last's. */
  courseChain: (first: string, last: string): string => `${first} – ${last}`,
};
