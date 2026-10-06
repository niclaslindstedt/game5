// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICK FORMATS' RULE BOOK — R37 onward, the rules a FREESTYLE VENUE is
// built to on a map that is already built (R1–R30), beside the races'
// (`discipline-rules.ts`, R31–R36). A venue is not a course on the piste: it
// is a thing BUILT in the snow, as a real one is shaped by the snowcats out
// of a mountain's side. BIG AIR (R37) and the KNUCKLE HUCK (R38 — the big
// air jump's table and landing, ridden onto from the deck with no kicker)
// and the SLOPESTYLE COURSE (R39 — three rail sections and three jumps cut
// on one line) and the RAIL JAM'S SET (R40 — a short drop-in onto a deck
// with a row of rails and boxes side by side) and the HALFPIPE (R41 — a U
// cut down the slope) and the MOGULS COURSE (R42 — a mogul track down a
// steep pitch with two air bumps in it) and the DUAL MOGULS COURSE (R43 —
// R42's course with two lanes side by side) are built today; aerials is a
// rule here when it is built (`docs/specs/TRICK_MODES.md`).
//
// THE RESEARCH BEHIND THE NUMBERS — the freestyle competition rules' park
// chapter and a championship jump as its builders describe it, by article
// and never by event (`docs/freestyle.md` § *Big air*):
//
//   bigAir.platform ≥ 5 m        the start area: a level platform at the
//                                top of the drop-in
//   bigAir.dropIn ≥ 20°          the drop-in at least 20° (30 m long, 5 m
//                                wide at the least); a championship jump's
//                                in-run is 35–40° — a scaffold's; one cut
//                                into a mountain is gentler and longer
//   bigAir.flat 5–10 m           a flat before the kicker
//   bigAir.kick ≥ 25°, ≥ 2 m     the kicker: at least 2 m high and 25° at
//                                the take-off (a championship kicker ~5 m)
//   bigAir.table ≥ 15 m          take-off to landing: 15 m at the top two
//                                levels (~18 m on a championship jump)
//   bigAir.landing ≥ 28°         the landing at least 28°, MATCHED to the
//                                take-off, 20 m wide and 20 m long at the
//                                least
//   bigAir.finish ≥ 25 m         a finish area at least 25 m long if flat,
//                                over 30 m recommended, 30 m wide
//   bigAir.speed 50–70 km/h      off the lip (55–60 on a championship
//                                jump, ~80 km/h down its in-run); a jump
//                                of ~30 m and ~2 s of air, ~5 m over the
//                                lip on a big one
//
//   EQUIVALENT FALL HEIGHT        a landing slope is SAFE when whoever
//                                lands on it, at whatever speed he left
//                                the lip, meets it no harder than a fall
//                                from a set height — the landing shaped
//                                point by point so the slope is just
//                                steeper than the flight that reaches it by
//                                that much (the standard design method for
//                                terrain-park jumps in the engineering
//                                literature). Real landings cap out near
//                                38°; past that the snow will not hold.
//
// The rules, stated once here and mirrored VERBATIM in
// `docs/level-generator.md` (`tests/docs_rules_test.ts`):
//
//   R37 THE BIG AIR JUMP. A big air jump is BUILT straight down a built
//       map's face, a line of its own and not the piste, from a column of
//       the face (`bigAir.search`) and a bearing within a few degrees of
//       the fall line, where its profile lies nearest the ground it is cut
//       from (`bigAir.fit`) and clear of every lift station and the
//       village. Its PROFILE is built against the horizontal, in order: a
//       START PLATFORM level for `bigAir.platform` metres; a DROP-IN rolled
//       over to `bigAir.dropIn` degrees within `bigAir.roll` metres of
//       radius and as long as brings a skier tucked down it from the start
//       gate (`bigAir.skier`) to the lip at `bigAir.speed` m/s; a
//       transition of `bigAir.toFlat` metres of radius onto a FLAT of
//       `bigAir.flat` metres; the KICKER, curved up on `bigAir.kicker`
//       metres of radius to a take-off of `bigAir.kick` degrees; a level
//       TABLE of `bigAir.table` metres at the lip's height; a KNUCKLE
//       rounded over on `bigAir.knuckle` metres of radius onto a LANDING
//       shaped point by point so that a skier off the lip at any speed
//       meets it no harder than a fall of `bigAir.fall` metres, never
//       steeper than `bigAir.steepest` degrees and running `bigAir.past`
//       metres beyond where a skier `bigAir.fast` times the design speed
//       comes down; a transition of `bigAir.round` metres of radius onto a
//       RUN-OUT falling at `bigAir.outrun.grade` degrees for
//       `bigAir.outrun.length` metres. The jump is `bigAir.width` metres
//       wide, graded to its profile across that width and eased out over
//       `bigAir.ease`, groomed hard, every tree within `bigAir.margin`
//       metres of its edges cleared, and the piste's kickers and drops in
//       it taken out. Its gates are the START GATE at the platform's lip and
//       the FINISH LINE `bigAir.finish` metres into the run-out.
//
//   R38 THE KNUCKLE. A knuckle huck is ridden on a jump BUILT as R37's is,
//       on a line searched the same way (`knuckleHuck.search`,
//       `knuckleHuck.fit`), with NO KICKER: a START PLATFORM level for
//       `knuckleHuck.platform` metres; a DROP-IN rolled over to
//       `knuckleHuck.dropIn` degrees within `knuckleHuck.roll` metres of
//       radius and as long as brings a skier tucked down it from the start
//       gate (`knuckleHuck.skier`) to the knuckle at `knuckleHuck.speed`
//       m/s; a transition of `knuckleHuck.toFlat` metres of radius onto a
//       level DECK of `knuckleHuck.flat` metres; the KNUCKLE, rounded over
//       on `knuckleHuck.knuckle` metres of radius — sharp enough that a
//       skier at the design speed leaves the snow off it — down to a
//       LANDING of `knuckleHuck.steepest` degrees held for
//       `knuckleHuck.slope` metres, as a big air landing lies below its
//       knuckle; a transition of `knuckleHuck.round` metres of
//       radius onto a RUN-OUT falling at `knuckleHuck.outrun.grade` degrees
//       for `knuckleHuck.outrun.length` metres. The jump is
//       `knuckleHuck.width` metres wide, graded, groomed, cleared and its
//       gates set as R37's: the START GATE at the platform's lip and the
//       FINISH LINE `knuckleHuck.finish` metres into the run-out.
//
//   R39 THE SLOPESTYLE COURSE. A slopestyle course is BUILT as R37's jump
//       is, straight down a built map's face on a line searched the same
//       way (`slopestyle.search`, `slopestyle.fit`), `slopestyle.width`
//       metres wide, graded, groomed and cleared. Its PROFILE is built
//       against the horizontal, in order: a START PLATFORM level for
//       `slopestyle.platform` metres; then SIX SECTIONS, each met down an
//       APPROACH that either drops at `slopestyle.dropIn` degrees (rolled
//       over within `slopestyle.roll` metres of radius and brought round
//       within `slopestyle.toFlat`) or runs level, as long as brings the
//       rule's skier (`slopestyle.skier`: stood up into a rail section,
//       tucked into a jump) to the section at its design speed. The first
//       THREE are RAIL SECTIONS: a DECK falling at `slopestyle.rails.grade`
//       degrees for `slopestyle.rails.deck` metres, and on it,
//       `slopestyle.rails.lead` metres in, TWO JIBS side by side
//       `slopestyle.rails.lines` metres either side of the middle — a rail
//       and a box, each of the shape and length its section's row in
//       `slopestyle.jibs` gives, its near end `slopestyle.rails.entry`
//       metres over the snow — met at `slopestyle.rails.speed` m/s. The
//       last THREE are JUMPS, each sized up the ladder of
//       `slopestyle.jumps` and built as R37's: a FLAT of
//       `slopestyle.flat` metres, a KICKER on its row's radius to its
//       row's take-off, a level TABLE of its row's length, and a LANDING
//       shaped to the equivalent fall height `slopestyle.fall` for its
//       row's lip speed, never steeper than `slopestyle.steepest`
//       degrees; each landing brought round on `slopestyle.round` metres
//       of radius onto a RUN-OUT of `slopestyle.between.grade` degrees for
//       `slopestyle.between.length` metres, and the last onto the FINISH
//       AREA falling at `slopestyle.outrun.grade` degrees for
//       `slopestyle.outrun.length` metres. Its gates are the START GATE at
//       the platform's lip and the FINISH LINE `slopestyle.finish` metres
//       into the finish area; it has no gate between.
//
//   R40 THE RAIL JAM'S SET. A rail jam is ridden on a set BUILT as R37's
//       jump is, straight down a built map's face on a line searched the
//       same way (`railJam.search`, `railJam.fit`), `railJam.width` metres
//       wide, graded, groomed and cleared. Its PROFILE is built against the
//       horizontal, in order: a START PLATFORM level for `railJam.platform`
//       metres; a DROP-IN rolled over to `railJam.dropIn` degrees within
//       `railJam.roll` metres of radius and as long as brings the rule's
//       skier (`railJam.skier`, stood up) from the start gate to the
//       features at `railJam.speed` m/s, brought round within
//       `railJam.toFlat` metres onto a DECK falling at `railJam.deck.grade`
//       degrees for `railJam.deck.length` metres; and on the deck,
//       `railJam.deck.lead` metres in, a ROW OF FEATURES side by side
//       `railJam.lines` metres apart across it — the rails and boxes of
//       `railJam.jibs`, each of its row's kind, line and legs (a plan
//       length and a fall a leg, a rising leg a rainbow's), its near end
//       `railJam.entry` metres over the snow — so a rider picks one a hit;
//       then a transition of `railJam.round` metres of radius onto a
//       RUN-OUT falling at `railJam.outrun.grade` degrees for
//       `railJam.outrun.length` metres. Its gates are the START GATE at the
//       platform's lip and the FINISH LINE `railJam.finish` metres into the
//       run-out; it has no gate between.
//
//   R41 THE HALFPIPE. A halfpipe is ridden in a U CUT DOWN THE SLOPE, on a
//       line searched as R37's is (`halfpipe.search`, `halfpipe.fit`),
//       `halfpipe.width` metres wide, graded, groomed and cleared. Its
//       PROFILE is built against the horizontal, in order: a START
//       PLATFORM level for `halfpipe.platform` metres; a roll of
//       `halfpipe.roll` metres of radius onto the PIPE'S PITCH of
//       `halfpipe.pitch` degrees, held for `halfpipe.lead` metres to the
//       pipe's mouth, its `halfpipe.length` metres and its tail; a
//       transition of `halfpipe.round` metres of radius onto a RUN-OUT
//       falling at `halfpipe.outrun.grade` degrees for
//       `halfpipe.outrun.length` metres. THE PIPE is cut into that pitch
//       as an analytic surface, not the map's grid: across it, a FLAT
//       BOTTOM, then each WALL a circular TRANSITION rising to
//       `halfpipe.vert` degrees and a straight VERT at that angle to the
//       COPING `halfpipe.height` metres over the flat, the copings
//       `halfpipe.span` metres apart and the transition's radius whatever
//       those leave (the vert's own height `halfpipe.vertHeight`); a DECK
//       `halfpipe.deck` metres wide outside each coping at the pitch's
//       own height. The walls grow from nothing to their height over the
//       pipe's MOUTH (`halfpipe.mouth` metres) and shrink back over its
//       TAIL (`halfpipe.tail` metres), so a skier drops in down its middle
//       and rides out of its foot. The grid under it is cut to the same
//       surface, never above it. Its gates are the START GATE at the
//       platform's lip and the FINISH LINE `halfpipe.finish` metres into
//       the run-out; it has no gate between.
//
//   R42 THE MOGULS COURSE. A moguls course is BUILT as R37's jump is,
//       straight down a built map's face on a line searched the same way
//       (`moguls.search`, `moguls.fit`), `moguls.width` metres wide,
//       graded, groomed and cleared. Its PROFILE is built against the
//       horizontal, in order: a START PLATFORM level for `moguls.platform`
//       metres; a roll of `moguls.roll` metres of radius onto the COURSE'S
//       PITCH of `moguls.pitch` degrees, held until `moguls.course` metres
//       down the slope from the start gate; a transition of `moguls.round`
//       metres of radius onto a FINISH AREA falling at
//       `moguls.outrun.grade` degrees for `moguls.outrun.length` metres.
//       In the pitch stand TWO AIR BUMPS, their lips `moguls.air.at` of the
//       course down it: each a KICKER curved up off the pitch to a take-off
//       of `moguls.air.kick` degrees to the slope, its lip
//       `moguls.air.height` metres over the pitch, falling back to the
//       pitch at `moguls.air.back` degrees behind the lip. Down the course
//       runs a MOGUL TRACK `moguls.track` metres wide on the venue's line:
//       moguls every `moguls.bumps.spacing` metres down the slope,
//       `moguls.bumps.height` metres from crest to trough, their crests
//       snaking a quarter wave either way every `moguls.bumps.wave` metres
//       across, from `moguls.bumps.first` metres below the start gate to the
//       foot of the pitch, faded over `moguls.bumps.ease` metres at their
//       ends, their edges and round each air bump — none in the last
//       `moguls.air.runIn` metres before its lip nor the
//       `moguls.air.landing` metres after it. The moguls and the air bumps
//       are an analytic surface, not the map's grid, and the grid under
//       them is cut to the same surface, never above it. Its gates are the
//       START GATE at the platform's lip, `moguls.gates` CONTROL GATES
//       `moguls.track` metres wide spaced evenly between it and the FINISH
//       LINE at the course's foot, and the finish line.
//
//   R43 THE DUAL MOGULS COURSE. A dual moguls course is BUILT as R42's
//       is, on a line searched the same way (`dualMoguls.search`,
//       `dualMoguls.fit`), `dualMoguls.width` metres wide, its profile
//       R42's to `dualMoguls.course` metres down the slope, with TWO LANES
//       side by side, each `dualMoguls.lanes.width` metres wide, their
//       middles `dualMoguls.lanes.apart` metres apart either side of the
//       venue's line: the BLUE lane on the left looking up the hill, the
//       RED on the right. Down each lane's middle runs a MOGUL LINE
//       `dualMoguls.track` metres wide, both lines on ONE RHYTHM — their
//       moguls every `dualMoguls.bumps.spacing` metres from the same first
//       one — so neither lane is the faster. The two AIR BUMPS stand level
//       across both lanes, `dualMoguls.air.runIn` metres after the last
//       mogul above each, their landings `dualMoguls.air.landing` metres.
//       Each lane has its own gates: a START GATE at the platform's lip,
//       `dualMoguls.gates` CONTROL GATES as wide as the lane spaced evenly
//       down it, and its FINISH LINE at the course's foot; the start
//       platform carries both lanes' start gates side by side.

/** A JUMP'S RULE, as R37 and R38 state one (`big-air.ts` builds either). A
 * jump with no kicker (`kicker` 0) takes off from the knuckle at the end
 * of its deck, and `kick` is the take-off its landing is shaped for. */
export type JumpRule = {
  readonly platform: number;
  readonly dropIn: number;
  readonly roll: number;
  readonly toFlat: number;
  readonly flat: number;
  readonly kicker: number;
  readonly kick: number;
  readonly launch: number;
  readonly table: number;
  readonly knuckle: number;
  readonly fall: number;
  readonly slope: number;
  readonly steepest: number;
  readonly fast: number;
  readonly past: number;
  readonly round: number;
  readonly outrun: { readonly grade: number; readonly length: number };
  readonly finish: number;
  readonly speed: number;
  readonly skier: {
    readonly mass: number;
    readonly tuck: number;
    readonly air: number;
    readonly friction: number;
    readonly compression: number;
  };
  readonly width: number;
  readonly ease: number;
  readonly margin: number;
  readonly search: {
    readonly stride: number;
    readonly bearings: readonly number[];
    readonly starts: number;
    readonly step: number;
    readonly edge: number;
    readonly top: number;
  };
  readonly fit: { readonly deepest: number; readonly stations: number; readonly village: number };
  readonly arena: { readonly before: number; readonly past: number; readonly half: number };
};

export const TRICK_RULES = {
  /** R37 — the big air jump. */
  bigAir: {
    /** The start platform, m. */
    platform: 6,
    /** The drop-in, degrees: steeper than the rule's 20°, gentler than a
     * scaffold's 35–40°, as a jump cut into a mountain's side is. */
    dropIn: 30,
    /** The radius it is rolled over to the drop-in on, m. */
    roll: 20,
    /** The radius the drop-in meets the flat on, m: wide enough that the
     * skier coming off the drop-in at ~100 km/h is pressed into it at
     * under 2 g. */
    toFlat: 50,
    /** The flat before the kicker, m. */
    flat: 8,
    /** The kicker's curve, m of radius, and its take-off, degrees: on
     * 25 m to 32° the lip stands ~4 m over the flat — toward a
     * championship kicker's ~5 m — and a tucked skier is thrown ~2.5 m over
     * it, ~5 m with the jump sprung at the lip. */
    kicker: 25,
    kick: 32,
    /** THE LAUNCH: the share of the lip's angle a skier leaves it on — his
     * legs give through the kicker's curve and he comes off flatter than
     * the snow, so the landing is shaped for the flight he flies, not the
     * lip's (measured off the engine's skier tucked off the lip: a peak
     * over it of `v² sin²(launch × kick) / 2g`). */
    launch: 0.78,
    /** The table, m — the top two levels' 15 m. */
    table: 15,
    /** The knuckle's radius, m. */
    knuckle: 10,
    /** THE LANDING: the equivalent fall height it is shaped to, m (a third
     * of a metre — a landing a skier's legs take as a step down), its
     * steepest, degrees, and how far past the fast skier's touchdown it
     * runs, m. `fast` is the share of the design speed it is shaped for —
     * a skier who carries a tenth more is still on it. */
    fall: 0.35,
    /** Shaped by the fall height, never laid at one grade (R38's is). */
    slope: 0,
    steepest: 38,
    fast: 1.12,
    past: 6,
    /** The radius the landing meets the run-out on, m. */
    round: 45,
    /** The run-out: its fall, degrees, and its length, m. */
    outrun: { grade: 5, length: 70 },
    /** The finish line, m into the run-out. */
    finish: 35,
    /** THE DESIGN SPEED off the lip, m/s (59 km/h, a championship jump's
     * 55–60): a tucked skier's. One stood up the whole in-run comes off it
     * near 45 km/h and comes down on the knuckle — a jump is skied
     * tucked. */
    speed: 16.5,
    /** The skier the drop-in is sized for, tucked from the start gate:
     * his mass with his kit, kg, his tuck's drag area, m², the air's
     * density at a ski area's altitude, kg/m³, and the snow's friction —
     * and THE COMPRESSIONS' COST: the share of his speed's square he gives
     * up for each radian the snow turns him upward through, the drop-in's
     * foot and the kicker (his legs taking the load and his body lagging
     * the turn), measured off the engine's skier tucked down the jump
     * (`make sim ARGS="--mode bigAir"`). */
    skier: { mass: 85, tuck: 0.5, air: 1.0, friction: 0.05, compression: 0.55 },
    /** The jump's width, m (the landing's 20 m least and the finish's
     * 30), how far past its edges its grading eases out, m, and the trees
     * cleared within this of them, m. */
    width: 30,
    ease: 14,
    margin: 12,
    /** THE SEARCH for its line: every `stride` m across the face, these
     * bearings off the fall line, degrees, every `starts` m down each,
     * read every `step` m, `edge` m inside the map. */
    search: {
      stride: 24,
      bearings: [-12, -6, 0, 6, 12] as readonly number[],
      starts: 8,
      step: 2,
      edge: 120,
      top: 60,
    },
    /** How the line is chosen: the profile's root-mean-square cut or fill
     * against the ground under it, m, with its deepest weighted `deepest`
     * against it. No lift station within `stations` m, nor the village
     * within `village` m. */
    fit: { deepest: 0.3, stations: 40, village: 160 },
    /** How far past the finish the finish arena reaches, and how far
     * either side of the line, m. */
    arena: { before: 20, past: 40, half: 30 },
  },
  /** R38 — the knuckle (`docs/freestyle.md` § *Knuckle huck*). */
  knuckleHuck: {
    platform: 6,
    /** A short drop-in onto the deck: the knuckle is hit at a crawl next to
     * the big air's lip. */
    dropIn: 24,
    roll: 15,
    toFlat: 20,
    /** THE DECK, m: the run along the table a rider winds a butter up on —
     * the press set a few metres before the roll. */
    flat: 18,
    /** No kicker and no table: the take-off is the knuckle itself. */
    kicker: 0,
    table: 0,
    /** The take-off off the knuckle, degrees: the deck's level — what a
     * rider adds is his own pop. */
    kick: 0,
    /** Off a level deck there is no lip's angle to leave flatter than. */
    launch: 1,
    /** The knuckle's radius, m: at the design speed the snow falls away
     * faster than g can follow (v²/r > g), so a rider leaves it — the
     * pop is his. */
    knuckle: 6,
    /** THE LANDING: not shaped to a fall height but laid as a big air
     * jump's landing lies below its knuckle — rounded over to `steepest`
     * degrees and held there for `slope` m (a championship landing's
     * 34–39°, 20 m and more long). A knuckle's flights are low, and come
     * down on the steep. */
    fall: 0.35,
    slope: 26,
    steepest: 37,
    fast: 1.25,
    past: 6,
    round: 30,
    outrun: { grade: 5, length: 45 },
    finish: 20,
    /** THE DESIGN SPEED at the knuckle, m/s: 32 km/h, the middle of the
     * 20–40 km/h a knuckle is hit at. */
    speed: 8.9,
    skier: { mass: 85, tuck: 0.5, air: 1.0, friction: 0.05, compression: 0.8 },
    width: 26,
    ease: 12,
    margin: 12,
    search: {
      stride: 24,
      bearings: [-12, -6, 0, 6, 12] as readonly number[],
      starts: 8,
      step: 2,
      edge: 120,
      top: 60,
    },
    fit: { deepest: 0.3, stations: 40, village: 160 },
    arena: { before: 15, past: 30, half: 26 },
  },
} as const satisfies Record<string, JumpRule>;

/** ONE JIB of a rail section (R39), as its row gives it: which line, a
 * RAIL or a BOX, its shape, and the plan length of each of its legs, m —
 * a `"down"` one leg at the deck's fall, a `"flatDown"` a level leg then a
 * falling one, a `"downFlatDown"` three. */
export type JibRow = {
  readonly line: -1 | 1;
  readonly kind: "rail" | "box";
  readonly shape: "down" | "flatDown" | "downFlatDown";
  readonly legs: readonly number[];
};

/** ONE JUMP of a slopestyle course (R39): its kicker's radius, m, its
 * take-off, degrees, its table, m, and the speed off its lip it is built
 * for, m/s. */
export type SlopeJumpRow = {
  readonly kicker: number;
  readonly kick: number;
  readonly table: number;
  readonly speed: number;
};

/** R39 — the slopestyle course (`docs/freestyle.md` § *Slopestyle*: the
 * top level's six sections, three of them jumps, ~30 m wide, two or more
 * lines a section, a flat finish of 25–30 m; 10–30 km/h through a rail
 * section, 50–70 km/h at a jump's take-off). */
export const SLOPESTYLE_RULE = {
  platform: 6,
  /** The approaches' drop, degrees, and the radii it is rolled over and
   * brought round on, m — rolled over wide enough that a skier coming
   * off a landing at 70 km/h stays on the snow over it (v²/r under g). */
  dropIn: 22,
  roll: 45,
  toFlat: 30,
  /** How long an approach may drop, m, and how long it may run level to
   * bleed off a landing's speed, m — the bounds its length is found in. */
  approachMost: 160,
  levelMost: 120,
  rails: {
    /** The deck's fall, degrees: a rail section's gentle pitch (est.). */
    grade: 7,
    /** The deck's length, m, and how far down it the jibs begin, m. */
    deck: 20,
    lead: 4,
    /** THE SPEED the jibs are met at, m/s (23 km/h — the middle of the
     * 10–30 km/h a rail section is ridden at). */
    speed: 6.5,
    /** A jib's near end over the snow, m: ridden onto with a hop (est.). */
    entry: 0.3,
    /** The two lines, m either side of the course's middle. */
    lines: 6,
  },
  /** THE JIBS, a rail section's two to a row, left and right: a box and a
   * rail in each, the shapes a park's sets are built from (a down box, a
   * flat-down rail, a kinked down-flat-down rail; boxes 4.5–9 m, rails
   * 3–12 m — `docs/freestyle.md` § *Rail jam*). */
  jibs: [
    [
      { line: -1, kind: "box", shape: "down", legs: [8] },
      { line: 1, kind: "rail", shape: "flatDown", legs: [3, 6] },
    ],
    [
      { line: -1, kind: "rail", shape: "down", legs: [9] },
      { line: 1, kind: "box", shape: "flatDown", legs: [3, 6] },
    ],
    [
      { line: -1, kind: "rail", shape: "downFlatDown", legs: [3, 3, 4] },
      { line: 1, kind: "box", shape: "down", legs: [10] },
    ],
  ] as readonly (readonly JibRow[])[],
  /** The rail's pipe and the box's top across, m (a rail 7.5–10 cm round,
   * a box ~40 cm). */
  railWidth: 0.08,
  boxWidth: 0.4,
  /** THE JUMPS, sized up the ladder: the lip a little higher, the table a
   * little longer and the speed off it a little faster each time (a top
   * course's tables ~19–21 m to the landing's sweet spot, a 5 m kicker on
   * the biggest; 50–70 km/h at the take-off). */
  jumps: [
    { kicker: 18, kick: 28, table: 9, speed: 14.5 },
    { kicker: 20, kick: 29, table: 11, speed: 15.5 },
    { kicker: 22, kick: 30, table: 13, speed: 16.5 },
  ] as readonly SlopeJumpRow[],
  /** The flat before each kicker, m. */
  flat: 6,
  /** The landing (as R37's): the share of the lip a skier leaves it at,
   * the knuckle's radius, m, the equivalent fall height, m, the share of
   * the design speed it is shaped for, how far past that skier's
   * touchdown it runs, m, and its steepest, degrees. */
  launch: 0.78,
  knuckle: 10,
  fall: 0.35,
  fast: 1.12,
  past: 6,
  steepest: 36,
  /** The radius a landing meets its run-out on, m, and the run-out
   * between two jumps: its fall, degrees, and its length, m. */
  round: 40,
  between: { grade: 4, length: 10 },
  /** The finish area: its fall, degrees, and its length, m (the rules'
   * 25 m and more); the finish line, m into it. */
  outrun: { grade: 4, length: 50 },
  finish: 28,
  /** THE SKIER the approaches are sized for: his mass, kg, his drag area
   * stood up and tucked, m², the air's density, kg/m³, the snow's
   * friction, and the share of his speed's square a radian of
   * compression costs him (as R37's). */
  skier: { mass: 80, stand: 0.7, tuck: 0.5, air: 1.0, friction: 0.05, compression: 0.65 },
  width: 30,
  ease: 14,
  margin: 12,
  search: {
    stride: 24,
    bearings: [-12, -6, 0, 6, 12] as readonly number[],
    starts: 8,
    step: 2,
    edge: 120,
    top: 60,
  },
  fit: { deepest: 0.3, stations: 40, village: 160 },
  arena: { before: 20, past: 40, half: 30 },
} as const;

/** ONE FEATURE of a rail jam's set (R40), as its row gives it: its line
 * across the deck (0 the middle, ±1 a line either side, ±2 the outer), a
 * RAIL or a BOX, its shape, and each of its legs: the plan length, m, and
 * its fall, degrees (negative a rise — a rainbow's way up). */
export type RailJamRow = {
  readonly line: number;
  readonly kind: "rail" | "box";
  readonly shape: "down" | "flatDown" | "downFlatDown" | "rainbow";
  readonly legs: readonly { readonly plan: number; readonly fall: number }[];
};

/** R40 — the rail jam's set (`docs/freestyle.md` § *Rail jam*: boxes ~40
 * cm wide and 4.5–9 m long, rails 7.5–10 cm round and 3–12 m long — down,
 * flat-down, down-flat-down, a rainbow — ridden at 10–30 km/h off a short
 * drop-in, a row of them side by side so a rider picks one a hit). */
export const RAIL_JAM_RULE = {
  platform: 6,
  /** The drop-in, degrees, and the radii it is rolled over and brought
   * round on, m: a rail park's short, steepish in-run (est.). */
  dropIn: 15,
  roll: 15,
  toFlat: 20,
  /** The longest the drop-in may be, m — the bound its length is found
   * in. */
  approachMost: 80,
  deck: {
    /** The deck's fall, degrees: a jib park's gentle pitch (est., R39's
     * rail decks'), steep enough that a ski slides on down a box's
     * polyethylene. */
    grade: 7,
    /** The deck's length, m, and how far down it the features begin, m —
     * room on the deck above them for a rider to pick his line. */
    length: 34,
    lead: 12,
  },
  /** THE SPEED the features are met at, m/s (22 km/h — inside the 10–30
   * km/h a rail is ridden at). */
  speed: 6,
  /** A feature's near end over the snow, m: a ride-on feature, its end
   * buried in a snow ramp so it is ridden onto with a hop (est.; a
   * stand-alone rail stands 0.5–1 m up). */
  entry: 0.3,
  /** The lines, m apart across the deck. */
  lines: 5,
  /** THE FEATURES, left to right: a down box, a flat-down rail, a kinked
   * box (down-flat-down), a down-flat-down rail and a rainbow rail. */
  jibs: [
    { line: -2, kind: "box", shape: "down", legs: [{ plan: 7, fall: 7 }] },
    {
      line: -1,
      kind: "rail",
      shape: "flatDown",
      legs: [
        { plan: 3, fall: 0 },
        { plan: 6, fall: 7 },
      ],
    },
    {
      line: 0,
      kind: "box",
      shape: "downFlatDown",
      legs: [
        { plan: 3, fall: 7 },
        { plan: 3, fall: 0 },
        { plan: 3, fall: 7 },
      ],
    },
    {
      line: 1,
      kind: "rail",
      shape: "downFlatDown",
      legs: [
        { plan: 3, fall: 7 },
        { plan: 3, fall: 0 },
        { plan: 4, fall: 7 },
      ],
    },
    {
      line: 2,
      kind: "rail",
      shape: "rainbow",
      legs: [
        { plan: 2, fall: -6 },
        { plan: 2, fall: 3 },
        { plan: 2, fall: 10 },
      ],
    },
  ] as readonly RailJamRow[],
  /** The rail's pipe and the box's top across, m. */
  railWidth: 0.08,
  boxWidth: 0.4,
  /** The radius the deck meets the run-out on, m; the run-out, its fall,
   * degrees, and its length, m; the finish line, m into it. */
  round: 25,
  outrun: { grade: 5, length: 40 },
  finish: 20,
  /** THE SKIER the drop-in is sized for, stood up (a rail is met stood
   * up, never tucked): his mass, kg, his drag area, m², the air's
   * density, kg/m³, the snow's friction, and the share of his speed's
   * square a radian of compression costs him (as R39's). */
  skier: { mass: 80, stand: 0.7, air: 1.0, friction: 0.05, compression: 0.65 },
  width: 30,
  ease: 12,
  margin: 12,
  search: {
    stride: 24,
    bearings: [-12, -6, 0, 6, 12] as readonly number[],
    starts: 8,
    step: 2,
    edge: 120,
    top: 60,
  },
  fit: { deepest: 0.3, stations: 40, village: 160 },
  arena: { before: 15, past: 30, half: 26 },
} as const;

/** R41 — the halfpipe (`docs/freestyle.md` § *Halfpipe*: the top level's
 * pipe — walls 6.7 m from the flat to the coping, 19–22 m coping to coping,
 * at least 160 m long and 170 m recommended, at least 17° down its centre
 * and 18° recommended, the top of each wall at 82–83°). */
export const HALFPIPE_RULE = {
  platform: 6,
  /** The roll onto the pitch, m of radius. */
  roll: 18,
  /** THE PIPE'S PITCH down its centre, degrees (the recommended 18°). */
  pitch: 18,
  /** The pitch before the mouth, m: the drop-in a skier gathers his first
   * speed on. */
  lead: 12,
  /** THE PIPE: its mouth, where the walls grow, its full-height length
   * (the recommended 170 m) and its tail, m. */
  mouth: 22,
  length: 170,
  tail: 18,
  /** THE WALLS: floor to coping, m; coping to coping, m; the vert's angle,
   * degrees, and the height it stands over, m. The transition's radius is
   * what those leave: (height − vertHeight) / (1 − cos vert), ~7.4 m on the
   * 22-foot pipe, its flat ~5.3 m wide (est. — the rules set neither). */
  height: 6.7,
  span: 20,
  vert: 83,
  vertHeight: 0.2,
  /** The deck outside each coping, m (est., 3–5 m). */
  deck: 4,
  /** The radius the pitch meets the run-out on, m; the run-out; the finish
   * line, m into it. */
  round: 40,
  outrun: { grade: 5, length: 50 },
  finish: 25,
  /** The venue graded across, m: the pipe and both decks and a margin. */
  width: 40,
  ease: 14,
  margin: 12,
  search: {
    stride: 24,
    bearings: [-12, -6, 0, 6, 12] as readonly number[],
    starts: 8,
    step: 2,
    edge: 120,
    top: 60,
  },
  fit: { deepest: 0.3, stations: 40, village: 160 },
  arena: { before: 15, past: 30, half: 30 },
} as const;

/** R42 — the moguls course (`docs/freestyle.md` § *Moguls*: the top
 * series' 235 ± 35 m at 28 ± 4°, 18–22 m wide, a 10 ± 2 m track between
 * nine control gates, moguls ~3.5 m apart, two air bumps 50–70 cm high at
 * a 26–35° take-off with a 15–18 m landing, the top one 15 % of the course
 * down it and the bottom one 20 % from the finish, a level finish area of
 * 30–40 m). */
export const MOGULS_RULE = {
  platform: 6,
  /** The roll onto the pitch, m of radius. */
  roll: 15,
  /** THE PITCH, degrees: the low end of the top series' band (28 ± 4°) —
   * as steep as a skier on this engine checks his speed on with the turns
   * against the moguls (a skid alone drags ~0.35 g, under the pull of a
   * steeper pitch). */
  pitch: 25,
  /** The course down the slope from the start gate to the finish line,
   * m (the top series' 235). */
  course: 235,
  /** The radius the pitch meets the finish area on, m; the finish area. */
  round: 30,
  outrun: { grade: 3, length: 35 },
  /** THE TRACK, m (10 ± 2), and the control gates between the start and
   * the finish (nine, each a tenth of the course). */
  track: 10,
  gates: 9,
  /** THE MOGULS: their spacing down the slope (~3.5 m), crest to trough
   * (est., 0.8–1.2 m on a course; the lower end, for a skier whose legs
   * fold half a metre), the snake of their crests across, where the first
   * stands below the start gate and how far they fade, m. */
  bumps: { spacing: 3.5, height: 0.7, wave: 8, first: 10, ease: 3 },
  /** THE AIR BUMPS: their lips as shares of the course down it (15 % from
   * the start, 20 % from the finish), the lip over the pitch, m (50–70
   * cm), the take-off to the slope, degrees (26–35°), the fall back behind
   * the lip, degrees, the smooth run-in before the lip and the landing
   * after it, m (5–6 m from the last mogul; a 15–18 m landing in the
   * rules, 18–20 m on a course sheet — the longer, for a run at pace). */
  air: {
    at: [0.15, 0.8] as readonly number[],
    height: 0.7,
    kick: 35,
    back: 45,
    runIn: 6,
    landing: 20,
  },
  /** The course graded across, m (18–22), its ease and the trees cleared
   * past it, m. */
  width: 22,
  ease: 12,
  margin: 10,
  search: {
    stride: 24,
    bearings: [-12, -6, 0, 6, 12] as readonly number[],
    starts: 8,
    step: 2,
    edge: 120,
    top: 60,
  },
  fit: { deepest: 0.3, stations: 40, village: 160 },
  arena: { before: 15, past: 30, half: 26 },
} as const;

/** A MOGULS COURSE'S RULE, R42's or R43's: `MOGULS_RULE`'s shape with its
 * numbers widened, so a dual course's row is one. */
type Widen<T> = T extends number
  ? number
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T;
export type MogulsRule = Widen<typeof MOGULS_RULE>;

/** R43 — the dual moguls course (`docs/freestyle.md` § *Dual moguls*: 220
 * ± 35 m on the top series, 20–24 m wide, two lanes of 6.5 ± 0.5 m, the two
 * mogul lines at least 4.5 m apart; the air bumps as a moguls course's, 4–5
 * m from the last mogul, with landings of 18 and 20 m). Everything it does
 * not say is R42's. */
export const DUAL_MOGULS_RULE: MogulsRule & {
  readonly lanes: { readonly width: number; readonly apart: number };
} = {
  ...MOGULS_RULE,
  /** The course down the slope, m (the top series' 220). */
  course: 220,
  /** Each lane's mogul line, m: the middle of a 6.5 m lane, leaving the
   * lines 6.5 m apart (at least 4.5). */
  track: 5,
  /** THE LANES: each one's width, and their middles apart, m. */
  lanes: { width: 6.5, apart: 6.5 },
  /** The air bumps 5 m after the last mogul above each (4–5), the
   * landing the longer of the two the rules give. */
  air: { ...MOGULS_RULE.air, runIn: 5 },
  /** The course graded across, m (20–24). */
  width: 24,
};
