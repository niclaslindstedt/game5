// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICK FORMATS' RULE BOOK — R37 onward, the rules a FREESTYLE VENUE is
// built to on a map that is already built (R1–R30), beside the races'
// (`discipline-rules.ts`, R31–R36). A venue is not a course on the piste: it
// is a thing BUILT in the snow, as a real one is shaped by the snowcats out
// of a mountain's side. BIG AIR (R37) and the KNUCKLE HUCK (R38 — the big
// air jump's table and landing, ridden onto from the deck with no kicker)
// are built today; slopestyle, the rail jam, the halfpipe, moguls, dual
// moguls and aerials are each a rule here when they are built
// (`docs/specs/TRICK_MODES.md`).
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
//   bigAir.speed 55–60 km/h      off the lip and on the landing (a
//                                championship jump's ~80 km/h down its
//                                in-run); a jump of ~30 m and ~2 s of air
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
    /** The radius the drop-in meets the flat on, m. */
    toFlat: 30,
    /** The flat before the kicker, m. */
    flat: 8,
    /** The kicker's curve, m of radius, and its take-off, degrees: on
     * 22 m to 26° the lip stands ~2.2 m over the flat — the rule's least
     * height on a kicker steeper than its least angle. */
    kicker: 22,
    kick: 26,
    /** The table, m — the top two levels' 15 m and a little. */
    table: 16,
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
    /** THE DESIGN SPEED off the lip, m/s (60 km/h — the rule's 55–60 and
     * a little, so a skier who stands up on the in-run still clears the
     * table). */
    speed: 16.7,
    /** The skier the drop-in is sized for, tucked from the start gate:
     * his mass with his kit, kg, his tuck's drag area, m², the air's
     * density at a ski area's altitude, kg/m³, and the snow's friction —
     * and THE COMPRESSIONS' COST: the share of his speed's square he gives
     * up for each radian the snow turns him upward through, the drop-in's
     * foot and the kicker (his legs taking the load and his body lagging
     * the turn), measured off the engine's skier tucked down the jump
     * (`make sim ARGS="--mode bigAir"`). */
    skier: { mass: 85, tuck: 0.5, air: 1.0, friction: 0.05, compression: 0.8 },
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
