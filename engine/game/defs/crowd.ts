// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD'S NUMBERS — who else is out on the mountain on a free ride, and
// what kind of skier each of them is. The ski area (R25–R28) is a resort,
// and a resort on a good day is HUNDREDS of people: families strung out
// down the green with the kids in a wedge, a ski school's snake of small
// helmets in the instructor's track, friends who stop together in the
// middle of the run, the one who stops just BELOW THE CREST where nobody
// above can see him, the straight-liner in a tuck, the beginner who
// followed his friends up the black and side-slips it a metre at a time,
// the powder hound off into the trees, the park rat who goes for every
// kicker, and the lot coming down from the hut after a long lunch.
//
// Every one of them is a KIND (`CROWD_KINDS`: bands for each knob of
// `AmateurKnobs`) on a BODY (`CrowdBody`: who is wearing the kit — a man, a
// woman, a teenager, a child, an older man or woman, a freerider with a
// pack, a retro one-piece), dealt in GROUPS (`CROWD_GROUPS`) so the slopes
// fill the way they do: more families than freeriders, more people on the
// greens than on the blacks (`CROWD.share`). The numbers are a crowd's,
// rough on purpose: an amateur is stepped by `crowd.ts` along his run's
// line, not by the skier's physics, so a few hundred of them cost the step
// less than one rival does.

import type { PisteGrade } from "../../mapgen/grades.ts";

/** WHO IS IN THE KIT: the figure the app draws, and the size the crowd
 * meets the player with. */
export type CrowdBody =
  "man" | "woman" | "teen" | "child" | "oldMan" | "oldWoman" | "freerider" | "retro";

export const CROWD_BODIES: readonly CrowdBody[] = [
  "man",
  "woman",
  "teen",
  "child",
  "oldMan",
  "oldWoman",
  "freerider",
  "retro",
];

/** Each body's mass, kg, and the radius of the one plan circle it is to
 * the player, m — the body with its arms and poles out, as a rival's
 * (`RACE.bump.radius`); a child is half the mass and a smaller circle. */
export const CROWD_SIZE: Readonly<Record<CrowdBody, { mass: number; radius: number }>> = {
  man: { mass: 85, radius: 0.55 },
  woman: { mass: 68, radius: 0.5 },
  teen: { mass: 60, radius: 0.5 },
  child: { mass: 32, radius: 0.38 },
  oldMan: { mass: 82, radius: 0.55 },
  oldWoman: { mass: 66, radius: 0.5 },
  freerider: { mass: 88, radius: 0.58 },
  retro: { mass: 72, radius: 0.52 },
};

/** HOW HE TURNS — the line he draws down the piste:
 *  - `line`     straight down it, the bomber's: no turns at all;
 *  - `carve`    long, round arcs across half the piste;
 *  - `short`    quick short swings down the middle, a metre or two each way;
 *  - `zigzag`   from one edge to the other and back, sharp at each end;
 *  - `plough`   a slow wedge, gentle turns — the child and the beginner;
 *  - `traverse` the whole width at a time, a long way across for little
 *               way down: the nervous beginner;
 *  - `slip`     the FALLING LEAF: skis across the hill, side-slipping
 *               a beginner down a pitch he should not be on. */
export type TurnStyle = "line" | "carve" | "short" | "zigzag" | "plough" | "traverse" | "slip";

/** A style's shape: how much of the half-width the turns sweep (`amp`; a
 * share of the piste's half-width, or metres when `metres`), how far down
 * the run one turn takes (`len`, m — a band), the most the skis turn off
 * the line (`maxYaw`, rad), and whether it turns at the ends (a triangle
 * wave) rather than round arcs. */
export const TURN_STYLES: Readonly<
  Record<
    TurnStyle,
    { amp: number; metres?: boolean; len: [number, number]; maxYaw: number; sharp?: boolean }
  >
> = {
  line: { amp: 0, len: [200, 200], maxYaw: 0.3 },
  carve: { amp: 0.55, len: [24, 40], maxYaw: 0.85 },
  short: { amp: 1.8, metres: true, len: [7, 11], maxYaw: 0.75 },
  zigzag: { amp: 0.8, len: [26, 50], maxYaw: 1.2, sharp: true },
  plough: { amp: 0.35, len: [12, 22], maxYaw: 0.6 },
  traverse: { amp: 0.85, len: [70, 130], maxYaw: 1.35, sharp: true },
  slip: { amp: 0.4, len: [14, 24], maxYaw: 1.45, sharp: true },
};

/** WHAT MAKES ONE AMATEUR HIMSELF, each 0..1 unless it says otherwise —
 * dealt once, from his kind's bands, and read every step:
 *  - `skill`       how well he skis: his speed, how tight he can turn, how
 *                  often he falls, and which colours he is let on;
 *  - `aggression`  how much of his speed he takes and how little room he
 *                  gives — the bomber's 1, the cautious beginner's 0;
 *  - `offPiste`    how likely he is to take a run off the side into the
 *                  powder and back;
 *  - `width`       how much of his style's sweep he uses;
 *  - `wobble`      how drunk he is: the line wanders, the body sways and
 *                  he falls for nothing;
 *  - `stopper`     how often he stops in the middle of the run — and the
 *                  worse he is at it the more likely just below a crest;
 *  - `jumper`      how much he goes for a kicker on his way down. */
export type AmateurKnobs = {
  skill: number;
  aggression: number;
  offPiste: number;
  width: number;
  wobble: number;
  stopper: number;
  jumper: number;
  style: TurnStyle;
  /** One turn's length down the run, m. */
  turn: number;
};

/** The KINDS of skier on the mountain. */
export type CrowdKind =
  | "cruiser"
  | "carver"
  | "bomber"
  | "beginner"
  | "zigzag"
  | "stopper"
  | "powder"
  | "parkRat"
  | "drunk"
  | "instructor"
  | "kid";

type Band = readonly [number, number];

/** A kind as bands, its turn styles and the bodies it comes in. */
export type CrowdKindDef = {
  skill: Band;
  aggression: Band;
  offPiste: Band;
  width: Band;
  wobble: Band;
  stopper: Band;
  jumper: Band;
  styles: readonly TurnStyle[];
  bodies: readonly CrowdBody[];
};

const ADULTS: readonly CrowdBody[] = ["man", "woman", "oldMan", "oldWoman", "retro"];

export const CROWD_KINDS: Readonly<Record<CrowdKind, CrowdKindDef>> = {
  // THE CRUISER: the bulk of any resort — a blue run's skier on a holiday
  // week, round turns at a pace he can stop from.
  cruiser: {
    skill: [0.35, 0.65],
    aggression: [0.2, 0.55],
    offPiste: [0, 0.08],
    width: [0.5, 0.9],
    wobble: [0, 0.05],
    stopper: [0.05, 0.25],
    jumper: [0, 0.15],
    styles: ["carve", "carve", "short", "zigzag"],
    bodies: [...ADULTS, "teen"],
  },
  // THE CARVER: the good skier — long arcs on the edges, fast and clean.
  carver: {
    skill: [0.75, 0.95],
    aggression: [0.45, 0.8],
    offPiste: [0, 0.2],
    width: [0.7, 1],
    wobble: [0, 0.02],
    stopper: [0, 0.08],
    jumper: [0.05, 0.3],
    styles: ["carve", "carve", "short"],
    bodies: ["man", "woman", "teen", "retro", "oldMan"],
  },
  // THE BOMBER: straight down the fall line in a tuck, faster than his
  // skiing, through every gap in the crowd.
  bomber: {
    skill: [0.45, 0.7],
    aggression: [0.9, 1],
    offPiste: [0, 0.1],
    width: [0, 0.2],
    wobble: [0, 0.05],
    stopper: [0, 0.03],
    jumper: [0.3, 0.7],
    styles: ["line"],
    bodies: ["man", "teen", "freerider"],
  },
  // THE BEGINNER: a wedge and a prayer.
  beginner: {
    skill: [0.05, 0.25],
    aggression: [0, 0.2],
    offPiste: [0, 0],
    width: [0.4, 0.8],
    wobble: [0.02, 0.1],
    stopper: [0.2, 0.5],
    jumper: [0, 0],
    styles: ["plough", "plough", "traverse"],
    bodies: [...ADULTS, "teen"],
  },
  // THE ZIGZAG: wall to wall across the piste, edge to edge, in nobody's
  // line and everybody's way.
  zigzag: {
    skill: [0.2, 0.45],
    aggression: [0.1, 0.4],
    offPiste: [0, 0.03],
    width: [0.85, 1],
    wobble: [0, 0.06],
    stopper: [0.1, 0.3],
    jumper: [0, 0.05],
    styles: ["zigzag", "traverse"],
    bodies: [...ADULTS, "teen"],
  },
  // THE ONE WHO STOPS BELOW THE CREST: middle of the piste, just over the
  // roll, where nobody coming over it sees him until he is there.
  stopper: {
    skill: [0.2, 0.5],
    aggression: [0, 0.3],
    offPiste: [0, 0],
    width: [0.3, 0.6],
    wobble: [0, 0.05],
    stopper: [0.7, 1],
    jumper: [0, 0.05],
    styles: ["carve", "plough", "short"],
    bodies: ADULTS,
  },
  // THE POWDER HOUND: off the side of the piste whenever the snow is deep,
  // a pack on his back and wide skis.
  powder: {
    skill: [0.65, 0.95],
    aggression: [0.5, 0.85],
    offPiste: [0.6, 1],
    width: [0.5, 0.9],
    wobble: [0, 0.02],
    stopper: [0, 0.1],
    jumper: [0.2, 0.6],
    styles: ["short", "carve"],
    bodies: ["freerider", "freerider", "man", "woman"],
  },
  // THE PARK RAT: every kicker, every time — and a fair share of them
  // landed on his back.
  parkRat: {
    skill: [0.4, 0.75],
    aggression: [0.6, 0.95],
    offPiste: [0, 0.2],
    width: [0.2, 0.6],
    wobble: [0, 0.04],
    stopper: [0.05, 0.25],
    jumper: [0.8, 1],
    styles: ["short", "line", "carve"],
    bodies: ["teen", "teen", "freerider"],
  },
  // AFTER LUNCH AT THE HUT: the line wanders, the body sways, and the snow
  // comes up to meet him for no reason anyone else can see.
  drunk: {
    skill: [0.25, 0.6],
    aggression: [0.4, 0.9],
    offPiste: [0, 0.15],
    width: [0.4, 1],
    wobble: [0.55, 1],
    stopper: [0.2, 0.5],
    jumper: [0, 0.3],
    styles: ["zigzag", "carve", "line"],
    bodies: ["man", "man", "woman", "oldMan", "retro"],
  },
  // THE INSTRUCTOR at the head of a ski school: slow, short, tidy turns the
  // children can follow in.
  instructor: {
    skill: [0.85, 1],
    aggression: [0, 0.1],
    offPiste: [0, 0],
    width: [0.35, 0.55],
    wobble: [0, 0],
    stopper: [0.15, 0.3],
    jumper: [0, 0],
    styles: ["plough", "short"],
    bodies: ["man", "woman"],
  },
  // A CHILD: in a wedge behind whoever is in front — a parent, an
  // instructor — and down a dozen times a morning without minding.
  kid: {
    skill: [0.1, 0.45],
    aggression: [0.1, 0.5],
    offPiste: [0, 0],
    width: [0.3, 0.7],
    wobble: [0.03, 0.12],
    stopper: [0.1, 0.3],
    jumper: [0, 0.2],
    styles: ["plough", "plough", "short"],
    bodies: ["child"],
  },
};

/** HOW PEOPLE COME — the group kinds and what each is made of:
 *  - `solo`    one of anyone;
 *  - `couple`  two adults who ski alike;
 *  - `family`  one or two parents and one to three children strung out
 *              behind, the parent waiting for the last one;
 *  - `friends` two to four who stop together;
 *  - `school`  an instructor and a snake of three to seven children in his
 *              track;
 *  - `drunks`  two or three down from the hut;
 *  - `crew`    two or three powder hounds off the side together. */
export type GroupKind = "solo" | "couple" | "family" | "friends" | "school" | "drunks" | "crew";

/** How a group follows its leader: `loose` — near him, on his piste, each
 * in his own line; `track` — in his very track, a ski school's snake. */
export type GroupFollow = "loose" | "track";

export type CrowdGroupDef = {
  /** How often the group is dealt, against the others. */
  weight: number;
  /** The leader's kind (the first is dealt for a family's parents too). */
  lead: readonly CrowdKind[];
  /** Who follows him, and how many: [min, max]. */
  follow: readonly CrowdKind[];
  count: readonly [number, number];
  /** How followers are kept: in a line or about him. */
  keep: GroupFollow;
  /** How far apart down the run they ski, m. */
  gap: number;
};

export const CROWD_GROUPS: Readonly<Record<GroupKind, CrowdGroupDef>> = {
  solo: {
    weight: 30,
    lead: [
      "cruiser",
      "cruiser",
      "cruiser",
      "carver",
      "carver",
      "bomber",
      "beginner",
      "beginner",
      "zigzag",
      "zigzag",
      "stopper",
      "powder",
      "parkRat",
      "drunk",
    ],
    follow: [],
    count: [0, 0],
    keep: "loose",
    gap: 0,
  },
  couple: {
    weight: 9,
    lead: ["cruiser", "cruiser", "carver", "beginner", "zigzag"],
    follow: ["cruiser", "cruiser", "beginner", "zigzag"],
    count: [1, 1],
    keep: "loose",
    gap: 8,
  },
  family: {
    weight: 12,
    lead: ["cruiser"],
    follow: ["kid", "kid", "kid", "cruiser"],
    count: [1, 4],
    keep: "loose",
    gap: 7,
  },
  friends: {
    weight: 8,
    lead: ["cruiser", "carver", "bomber", "parkRat"],
    follow: ["cruiser", "cruiser", "carver", "bomber", "zigzag", "parkRat"],
    count: [1, 3],
    keep: "loose",
    gap: 10,
  },
  school: {
    weight: 4,
    lead: ["instructor"],
    follow: ["kid"],
    count: [3, 7],
    keep: "track",
    gap: 4,
  },
  drunks: {
    weight: 3,
    lead: ["drunk"],
    follow: ["drunk"],
    count: [1, 2],
    keep: "loose",
    gap: 9,
  },
  crew: {
    weight: 2,
    lead: ["powder"],
    follow: ["powder"],
    count: [1, 2],
    keep: "loose",
    gap: 14,
  },
};

/** THE CROWD'S OWN NUMBERS. */
export const CROWD = {
  /** How many amateurs a free ride deals onto the mountain. */
  count: 260,
  /** The most a run may ask for (`createGame`'s `crowd`). */
  most: 600,
  /** HOW CROWDED EACH COLOUR IS, per metre of run: the greens full, the
   * blacks nearly empty, a cat track a thoroughfare between them. */
  share: { green: 1, blue: 0.6, red: 0.3, black: 0.12, road: 0.25 } as Readonly<
    Record<PisteGrade | "road", number>
  >,
  /** The skill a colour asks for: below it, a skier is on it only as the
   * one his friends took up there (`lost`, the share of the weight he
   * keeps). */
  needs: { green: 0, blue: 0.3, red: 0.5, black: 0.72, road: 0 } as Readonly<
    Record<PisteGrade | "road", number>
  >,
  lost: 0.05,
  /** The share of the crowd riding a lift when the run starts. */
  lifted: 0.15,
  /** How long a group is up the lift between runs, s — a fraction of a
   * real ride, so the snow keeps its crowd. */
  lift: [12, 45] as readonly [number, number],
  /** How often an amateur reconsiders his line, s. */
  think: 0.25,
  /** The speed an amateur skis at, m/s: `base` and up to `span` more by
   * his skill, as much of it as his aggression takes; the bomber's line
   * lets him run `line` times that. */
  speed: { base: 3.5, span: 15, line: 1.6, slip: 2.2 },
  /** The resistance on him, m/s² and per m: the snow's under the skis, the
   * air's on the body (a v² drag), and the scrub of a ski turned off the
   * way it goes (per radian). */
  drag: { snow: 0.45, air: 0.0035, scrub: 1.4 },
  /** How hard he can check his speed, m/s², and at a crawl what his poles
   * and his skating give him: the speed, m/s, and the push, m/s². */
  brake: 3.5,
  crawl: { speed: 2.6, push: 0.9 },
  /** The lean a turn is read as begun past, rad — so a drunk's sway or a
   * straight line's chatter starts none (the player's view reads his edge
   * past 0.14 the same way). */
  turnOn: 0.1,
  /** How fast he can swing his skis round, rad/s, at no skill and at all. */
  yawRate: [1.4, 3.4] as readonly [number, number],
  /** A FALL: how many a minute at no skill on a green, and how much more
   * likely on a colour past him, drunk, or landing a kicker; how long he
   * lies, s; how much the slide scrubs, m/s². */
  fall: { rate: 0.18, steep: 3, wobble: 1.4, lie: [2.5, 7] as readonly [number, number], slide: 6 },
  /** A STOP: how many a minute at a stopper's 1, how long, s; and how much
   * likelier just below a crest — a roll he has just come over, by how
   * much steeper the pitch is here than `crestBack` m above. */
  stop: {
    rate: 1.2,
    hold: [3, 12] as readonly [number, number],
    crest: 6,
    crestBack: 12,
    crestPitch: 0.08,
  },
  /** OFF THE PISTE: how far past the edge an excursion goes, m, how long it
   * lasts, m of run; how many a minute at an `offPiste` of 1; and the
   * clearance he keeps from a trunk, m. */
  wander: {
    reach: [8, 40] as readonly [number, number],
    run: [80, 260] as readonly [number, number],
    rate: 1.4,
    trunk: 2.4,
  },
  /** A KICKER: how far ahead he sees one, m; how long he is in the air
   * off it — `air` s and `perSpeed` more a m/s, at most `most` s; and the
   * least speed that takes him off it at all, m/s. */
  kicker: { see: 60, air: 0.25, perSpeed: 0.045, most: 1.5, speed: 6 },
  /** The room he keeps from the skier ahead on his run: how far ahead he
   * looks, m and s of his speed, and how wide a berth, m. */
  room: { ahead: 4, time: 0.8, berth: 1.8 },
  /** A GROUP regrouping: how far behind the last one may fall before the
   * leader waits, m, and how near he must come before they go on. */
  regroup: { far: 60, near: 15 },
  /** THE PLAYER MEETING ONE: the closing speed that knocks the amateur
   * down at no skill and at all, m/s; the share of it that comes back;
   * and the closing speed that takes the PLAYER down, as a share of what
   * a trunk on the shoulder would (`crash.treeShoulder`). */
  knock: [2.5, 6] as readonly [number, number],
  restitution: 0.25,
  floors: 0.85,
};
