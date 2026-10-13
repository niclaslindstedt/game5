// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK'S RULE BOOK — R44 and R45, the rules a SUMMER ski area's
// bike trails are laid to over a map that is already built (R1–R30), beside
// the races' (`discipline-rules.ts`) and the freestyle venues'
// (`trick-rules.ts`). A bike park is not a course on the piste: it is a
// network of narrow trails BENCHED into the mountain's side off the tops of
// the lifts that carry bikes in summer, the way a trail crew with a small
// excavator cuts one, and a DOWNHILL RACE LINE beside them.
//
// THE RESEARCH BEHIND IT (`docs/bike-park.md`): the international trail
// difficulty rating and the national and regional trail standards built on
// it (tread widths, average and steepest grades, the tallest obstacle, the
// tightest turn), the half rule and the grade reversals of sustainable
// trail building, trail builders' guides (berms, tabletops, drops,
// step-downs, the rhythm of a jump line, the set-up before it and the
// run-out after it), a city bike-park plan's feature limits and risk rules
// (sight distance, fall zones), a GPS study of elite downhill courses, and
// photographs of working lift-served parks (machine-built flow trails 1.2–
// 2.5 m wide of pale gravel zig-zagging across the fall line; technical
// trails of natural dirt dropping straighter through the woods). Where a
// band is our own synthesis the doc says so.
//
// The rules, stated once here and mirrored VERBATIM in
// `docs/level-generator.md` (`tests/docs_rules_test.ts`):
//
//   R44 THE BIKE PARK. A summer ski area's BIKE PARK is laid over a built
//       map off a stream of its own (`park.salt`), so no map it is laid on
//       moves. Its trails leave the STAGING APRON of a chair's or a
//       gondola's top — the top station's pad, `park.apron` metres from its
//       middle — each from a signed HEAD of its own, the easiest nearest
//       the lift's line (moved `park.nudge` degrees round the rim at a time
//       where its first metres meet something); a drag carries no bike. A lift whose vertical is
//       under `park.vertical.least` metres carries none, and only the
//       lowest `park.lifts` lifts within `park.vertical.most` metres of
//       vertical do (the lowest of all where none is). Each trail is dealt
//       a GRADE — the park is dealt at least one GREEN, one BLUE and one
//       RED, and a BLACK where a lift is left for it (`park.deal`) — and is
//       WALKED down the face from its head: on a leg it holds the heading
//       off the fall line at which the ground falls at its grade's
//       `target` (never more than `half` of the hillside's own grade),
//       eased up where it lags its target's height and down where it is
//       ahead of it (`walk.hold`), and it turns back across the fall line
//       at the end of a leg dealt
//       `leg` metres long, at its CORRIDOR's edge (`corridor` metres either
//       side of a line from its head toward its end, offset `spread` of
//       that from its lift's line by its place among the lift's trails),
//       or where the ground ahead within `look` metres is water, a station,
//       a cabin, past `steep` degrees, `edge` metres from the map's edge,
//       or within `apart` metres of another trail running the same way; a
//       turn is an arc of the grade's `radius` metres through the fall
//       line, made only where that arc crosses nothing it keeps off and no
//       ground past `steep` degrees; where it can neither go on nor turn
//       it SKIRTS along the contour (`walk.skirt`) until it can. Within
//       `finish.reach` metres of height or plan distance of
//       its END — `finish.ring` metres up the slope from its lift's bottom
//       station, beside the load line, a trail's own place on that ring —
//       it is drawn straight to it where the ground on the way falls no
//       steeper than `finish.grade`. Its tread is `width` metres wide,
//       widened `berm.widen` times through a bermed turn. Its BENCH, the
//       tread's height down its line, is the ground under it eased over
//       `bench.window` metres and held to fall between nothing and its
//       grade's `steepest` over every metre; across the tread it tips
//       `bench.outslope` towards the downhill side, and from the tread's
//       edge it is eased into the ground over a shoulder of `bench.shoulder`
//       metres and `bench.bank` more for every metre of cut or fill. Its
//       FEATURES are shaped into that surface, each sized inside its
//       grade's band: a BERM banked through every turn of more than
//       `berm.turn` degrees (a grade's `berm.share` of them), its face
//       reaching `berm.height` metres at the outer edge and banked
//       `berm.bank` degrees where it is ridden, two-thirds of the way out;
//       ROLLERS (`roller`), and on a red or a black DIPS (`dip`), every
//       `reversal` metres down a leg; TABLETOPS (`table`: a take-off at
//       `angle` degrees to a lip `height` metres up, a deck `deck` metres
//       long, a landing at `land` degrees) in lines of `line` jumps
//       `spacing` metres lip to lip; GAPS (`gap` metres open between the
//       lip and the landing); DROPS off a ledge (`drop` metres), STEP-DOWNS
//       (`step` metres below the lip); ROCK GARDENS (`rocks`: rocks up to
//       their tallest, set in the tread) and ROOT sections (`roots`). A
//       feature stands at least `visible` metres after a turn or another
//       feature's end and `setup` metres after one before a jump line,
//       with `runout` times its own length clear past it before the next
//       turn; the first `filter.from`–`filter.to` metres of a trail carry
//       the hardest kind of feature it has; nothing stands in its first
//       `head` metres or its last `tail`. Every tree within `clear` metres
//       of a tread's edge is felled; a tree on its shoulder stands on the
//       shoulder. A trail is kept only if its bench falls on average inside
//       its grade's `mean` band, never steeper than `steepest` over any
//       `pitch` metres, never rising more than `climb.most` metres over
//       `climb.window`, cut or filled no more than `bench.most` metres, and
//       it ends at its end; each slot tries `tries` lines and keeps the
//       best — the most of it in the woods (a red's and a black's thrice
//       over), the least cut and the mean nearest its target.
//
//   R45 THE DOWNHILL RACE LINE. A bike park carries at most one DOWNHILL
//       RACE LINE, walked as R44 walks a trail at `race.target` off a
//       chair or a gondola of at least `race.vertical.least` metres of
//       vertical, the one with the most tried first and the next where it
//       cannot be laid, its corridor
//       `race.corridor` metres either side, its legs `race.leg` metres, its
//       turns `race.radius` metres round and unbanked, its tread
//       `race.width` metres wide and TAPED down both edges. Its START is the
//       point of its line `race.vertical.most` metres of height above its
//       finish (the apron, where the lift is lower); its FINISH is its end,
//       on the valley floor beside the lift's bottom station. It is kept
//       only if its mean grade from the start to the finish lies in
//       `race.mean`, its length in `race.length` and its vertical in
//       `race.vertical`. It carries rock gardens, roots, drops and step-
//       downs sized as a black's, and a FINISH JUMP — a black's tabletop —
//       within its last `race.jump` metres.

/** A trail grade: the colour a trail head's sign is painted (R44). */
export type TrailGrade = "green" | "blue" | "red" | "black";

/** A band, [least, most]. */
type Band = readonly [number, number];

/** One grade's row (R44): every length in metres, every grade in metres
 * of fall per metre along, every angle in degrees. */
export type TrailRule = {
  /** The tread's width. */
  readonly width: Band;
  /** The bench's mean grade, start to end. */
  readonly mean: Band;
  /** The grade a leg is walked at. */
  readonly target: number;
  /** The steepest the bench falls over any `pitch` metres. */
  readonly steepest: number;
  /** A leg's grade never more than this share of the hillside's. */
  readonly half: number;
  /** A leg's length. */
  readonly leg: Band;
  /** How far either side of its axis a trail's legs may swing. */
  readonly corridor: Band;
  /** A turn's radius. */
  readonly radius: Band;
  /** The share of turns bermed. */
  readonly bermShare: number;
  /** A berm's height at its outer edge, and its bank where it is ridden. */
  readonly berm: { readonly height: Band; readonly bank: Band };
  /** A grade reversal every this far down a leg (null: none laid). */
  readonly reversal: Band | null;
  /** Rollers: height, length (null: none). */
  readonly roller: { readonly height: Band; readonly length: Band } | null;
  /** Dips dug across the tread: depth, length (null: none). */
  readonly dip: { readonly depth: Band; readonly length: Band } | null;
  /** Tabletops: lip height, take-off angle, deck length, landing angle,
   * jumps in a line, and lip-to-lip spacing (null: none). */
  readonly table: {
    readonly height: Band;
    readonly angle: Band;
    readonly deck: Band;
    readonly land: Band;
    readonly line: Band;
    readonly spacing: Band;
  } | null;
  /** A gap's open length (null: none). */
  readonly gap: Band | null;
  /** A drop's height. */
  readonly drop: Band | null;
  /** A step-down's height below its lip (null: none). */
  readonly step: Band | null;
  /** A rock garden's tallest rock and its length (null: none). */
  readonly rocks: { readonly height: Band; readonly length: Band } | null;
  /** A root section's tallest root and its length (null: none). */
  readonly roots: { readonly height: Band; readonly length: Band } | null;
  /** The straight before a jump line. */
  readonly setup: number;
  /** The run-out past a jump or a drop, in its own lengths. */
  readonly runout: number;
  /** A feature seen from this far: straight before it. */
  readonly visible: number;
  /** The fall zone cleared either side of the tread. */
  readonly fall: number;
  /** How many features a 100 m of leg carries, about (besides reversals). */
  readonly every: number;
};

/** THE BIKE PARK'S NUMBERS (R44, R45), each the middle of
 * `docs/bike-park.md`'s bands unless said. */
export const BIKE_PARK_RULES = {
  park: {
    /** The park's own stream beside the map's seed. */
    salt: 0xb1ce,
    /** Trail heads stand this far from a top station's middle: the
     * staging apron's rim (the pad is R26's `lift.top.pad`, 48 m). */
    apron: 30,
    /** A head whose lead walks into something is moved this far round the
     * rim, degrees, either way in turn. */
    nudge: 12,
    /** Which lifts carry bikes: at least `least` m of vertical; the
     * lowest `lifts` within `most`. */
    vertical: { least: 120, most: 820 },
    lifts: 3,
    /** The grades dealt off each lift carrying bikes, the lowest first:
     * row k is the k-th lowest lift's (a lift past the last row takes the
     * last), a park of one lift its own row. */
    deal: [
      ["green", "blue", "red"],
      ["blue", "red", "black"],
      ["red", "black"],
    ] as readonly (readonly TrailGrade[])[],
    one: ["green", "blue", "red", "black"] as readonly TrailGrade[],
    /** At most this many trails (the race line besides). */
    most: 9,
    /** Lines a slot tries before keeping the best. */
    tries: 6,
    /** A walk gives up past this many metres. */
    longest: 16000,
  },
  /** The walk. */
  walk: {
    /** A station every this far along the line. */
    step: 1,
    /** Look this far ahead for what turns a leg. */
    look: 10,
    /** Ground steeper than this cannot be benched. */
    steep: 38,
    /** Keep this far inside the map's edge. */
    edge: 80,
    /** A trail running within this of another, the same way, turns. */
    apart: 9,
    /** The corridor's axis offset per trail of a lift, in corridor
     * widths. */
    spread: 1.0,
    /** Clear of a station's middle by this (top) and (bottom), and of a
     * cabin's by this. */
    station: { top: 26, bottom: 30 },
    cabin: 14,
    /** Clear of a lift tower's column by this. */
    tower: 4,
    /** How far a leg's heading wanders off its ideal, rad, and over what
     * length its wander turns, m. */
    wander: { flow: 0.06, tech: 0.22, length: 40 },
    /** How a leg holds the trail to its mean: its grade the target plus
     * `gain` × the height it is owed over `over` m, kept within `least`–`most`
     * of the target. */
    hold: { gain: 1, over: 150, least: 0.3, most: 1.6 },
    /** Where a leg can neither go on nor turn, it SKIRTS along the
     * contour at most `most` m, its heading turned `steer` rad/m. */
    skirt: { most: 300, steer: 0.2 },
    /** How fast a leg's heading may turn toward its ideal, rad/m. */
    steer: 0.05,
  },
  /** The end: a ring round the bottom station, up the slope. */
  finish: {
    ring: 40,
    /** Spread of the trails' ends round it, rad either side of up-slope. */
    spread: 1.0,
    /** Drawn straight home within this height (m) or plan distance. */
    reach: { height: 30, plan: 220 },
    /** The straight home falls no steeper than this. */
    grade: 0.2,
    /** A trail reaching within this of its end has ended. */
    within: 3,
  },
  /** The bench. */
  bench: {
    window: 16,
    outslope: 0.05,
    shoulder: 1.0,
    bank: 1.2,
    /** The shoulder no wider than this. */
    widest: 4,
    /** Cut or fill no more than this at the centre line, m. */
    most: 3.5,
  },
  /** How the bench may rise: no more than `most` m over `window` m. */
  climb: { most: 0.3, window: 20 },
  /** The window a steepest pitch is measured over, m. */
  pitch: 10,
  /** No feature in a trail's first `head` m or last `tail` m. */
  head: 25,
  tail: 30,
  /** The first feature of the hardest kind stands in this window, m. */
  filter: { from: 30, to: 100 },
  /** Felled within this of a tread's edge (beside the fall zone). */
  clear: 0.5,
  berm: {
    /** A turn of more than this many degrees is bermed. */
    turn: 50,
    /** The tread through a berm, in widths. */
    widen: 1.4,
    /** Where the bank is measured, out of the tread's width. */
    ridden: 2 / 3,
  },
  grades: {
    green: {
      width: [1.6, 2.4],
      mean: [0.04, 0.085],
      target: 0.065,
      steepest: 0.15,
      half: 0.5,
      leg: [100, 240],
      corridor: [120, 200],
      radius: [5, 8],
      bermShare: 1,
      berm: { height: [0.3, 0.6], bank: [20, 35] },
      reversal: [8, 16],
      roller: { height: [0.3, 0.6], length: [4, 6] },
      dip: null,
      table: {
        height: [0.5, 0.8],
        angle: [15, 22],
        deck: [2, 3],
        land: [14, 20],
        line: [1, 2],
        spacing: [16, 24],
      },
      gap: null,
      drop: null,
      step: null,
      rocks: null,
      roots: null,
      setup: 20,
      runout: 2,
      visible: 15,
      fall: 1,
      every: 0.6,
    },
    blue: {
      width: [1.3, 1.9],
      mean: [0.06, 0.125],
      target: 0.095,
      steepest: 0.2,
      half: 0.5,
      leg: [80, 180],
      corridor: [100, 170],
      radius: [4, 6],
      bermShare: 1,
      berm: { height: [0.5, 1.0], bank: [30, 45] },
      reversal: [8, 16],
      roller: { height: [0.4, 0.8], length: [4, 6] },
      dip: null,
      table: {
        height: [0.9, 1.4],
        angle: [24, 32],
        deck: [3, 5],
        land: [20, 28],
        line: [2, 3],
        spacing: [16, 28],
      },
      gap: null,
      drop: [0.3, 0.6],
      step: [0.3, 0.5],
      rocks: { height: [0.1, 0.2], length: [8, 15] },
      roots: null,
      setup: 20,
      runout: 2,
      visible: 20,
      fall: 1.5,
      every: 0.9,
    },
    red: {
      width: [0.9, 1.4],
      mean: [0.1, 0.2],
      target: 0.15,
      steepest: 0.3,
      half: 0.6,
      leg: [40, 120],
      corridor: [60, 110],
      radius: [3, 5],
      bermShare: 0.6,
      berm: { height: [0.8, 1.4], bank: [40, 55] },
      reversal: [12, 25],
      roller: null,
      dip: { depth: [0.2, 0.4], length: [3, 5] },
      table: {
        height: [1.5, 2.0],
        angle: [30, 38],
        deck: [5, 8],
        land: [24, 32],
        line: [2, 3],
        spacing: [18, 30],
      },
      gap: [4, 7],
      drop: [0.6, 1.2],
      step: [0.5, 1.4],
      rocks: { height: [0.2, 0.4], length: [10, 20] },
      roots: { height: [0.08, 0.15], length: [8, 18] },
      setup: 30,
      runout: 2.5,
      visible: 30,
      fall: 2,
      every: 1.3,
    },
    black: {
      width: [0.6, 1.1],
      mean: [0.15, 0.3],
      target: 0.22,
      steepest: 0.5,
      half: 1,
      leg: [25, 90],
      corridor: [40, 80],
      radius: [2.5, 4],
      bermShare: 0.35,
      berm: { height: [1.0, 1.8], bank: [45, 60] },
      reversal: null,
      roller: null,
      dip: null,
      table: {
        height: [1.8, 2.4],
        angle: [32, 42],
        deck: [8, 11],
        land: [28, 34],
        line: [1, 2],
        spacing: [20, 35],
      },
      gap: [8, 12],
      drop: [1.2, 2.5],
      step: [1.0, 2.5],
      rocks: { height: [0.4, 0.6], length: [12, 25] },
      roots: { height: [0.1, 0.2], length: [10, 20] },
      setup: 40,
      runout: 3,
      visible: 40,
      fall: 2,
      every: 1.6,
    },
  } satisfies Record<TrailGrade, TrailRule>,
  /** R45 — THE DOWNHILL RACE LINE. */
  race: {
    target: 0.25,
    mean: [0.18, 0.32],
    steepest: 0.6,
    length: [1500, 3500],
    vertical: { least: 400, most: 700 },
    corridor: [40, 70],
    leg: [30, 90],
    radius: [8, 14],
    width: [2, 3],
    /** The finish jump stands within this of the finish, m. */
    jump: 200,
    /** Tape posts down both edges every this far, m. */
    tape: 6,
  },
} as const;

/** The grades in order, easiest first. */
export const TRAIL_GRADES: readonly TrailGrade[] = ["green", "blue", "red", "black"];
