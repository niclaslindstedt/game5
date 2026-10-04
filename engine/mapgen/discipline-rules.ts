// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DISCIPLINES' RULE BOOK — R31 onward, the rules a RACE COURSE of a
// discipline is set to on a map that is already built (R1–R30). The map is
// the mountain; a discipline is how a race uses it: where on the piste its
// course starts and finishes, which gates stand down it and what passing
// one means. Only the SLALOM is set today; the giant slalom, the super-G,
// the downhill, the ski cross and the speed run are named by the game and
// not set yet, and each will be a rule here when it is.
//
// THE RESEARCH BEHIND THE NUMBERS — the international alpine competition
// rules, by article and never by event:
//
//   slalom.vertical 140–220 m     a slalom hill's vertical drop at the top
//                                 level (men 180–220, women 140–220; lower
//                                 races 120–200, children 100–160, an entry
//                                 league 80–120)
//   slalom.gradient 0.33–0.45     the top level's gradient; gentler
//                                 stretches allowed, past 0.52 only for a
//                                 few metres
//   slalom.width 4–6 m            a gate is two poles — the TURNING pole a
//                                 racer turns round, a flex pole 1.8 m over
//                                 the snow, and an OUTSIDE pole — 4–6 m
//                                 apart; a slalom flies no panels
//   slalom.turn 6–13 m            turning pole to turning pole of two
//                                 successive gates
//   slalom.changes 0.30–0.35 ±3   the direction changes: 30–35 % of the
//                                 vertical drop in metres, ±3
//   slalom.combos                 open and closed gates; at least three
//                                 HAIRPINS (two closed gates), one to three
//                                 VERTICALS (three or four closed gates),
//                                 0.75–1 m between the gates of one, in a
//                                 line down the hill; one to three DELAYED
//                                 gates, 12–18 m turning pole to turning
//                                 pole
//   slalom.setting                no hard gate at the start or the finish,
//                                 an easier gate before a combination, the
//                                 last gate fast and aimed at the middle of
//                                 the finish, which is at least 10 m wide
//   slalom.passing                both ski tips and both feet cross the
//                                 gate line; the pole between the skis is a
//                                 STRADDLE; either is a disqualification,
//                                 and a racer may no longer climb back to a
//                                 gate he missed
//   slalom.start                  "ready", then "go", and the racer must be
//                                 away within about 10 s of it
//   slalom.runs                   two runs on two courses set on the same
//                                 slope, the combined time ranked
//
// The rules, in prose (each realized by `slalom.ts`, asserted in
// tests/slalom_test.ts, and carried VERBATIM by docs/level-generator.md):
//
//   R31 THE SLALOM COURSE. A slalom is set on a built map's piste, on the
//       stretch of it that drops one of `slalom.drops` metres, the
//       steepest to the top level's gradient and then the longest drop
//       (`slalom.pick`; a drop under `slalom.pick.least` only where none
//       over it fits), between a START and a
//       FINISH, no longer than `slalom.maxLength`, nowhere narrower than
//       `slalom.minWidth`, crossing no drop on the piste, its finish on a
//       gentler run-out (no steeper than `slalom.outrun` over the
//       `slalom.outrunLength` past the line) — the start a hut over the
//       piste, the snow out of its door cut into a START DROP as steep as
//       `slalom.drop.grade` over its first `slalom.drop.length` metres, the
//       line `slalom.finishWidth` metres wide at the least, every
//       kicker on the piste within `slalom.clearance` of the stretch
//       levelled, the piste groomed hard from the hut to the end of the
//       run-out whatever drift lay across it and its relief combed smooth
//       over `slalom.comb`, and every tree within
//       `slalom.clear` metres of the course and in the finish arena cleared. Its gates are POLE GATES, red and
//       blue alternately, as many direction changes as `slalom.changes` of
//       the vertical (spaced `slalom.spacing` metres apart down the piste,
//       which wins where the two disagree): OPEN gates across the hill — the
//       turning pole set either side of the course's line in turn, no
//       further across than leaves the line round the poles bending no
//       tighter than `slalom.bend`, the outside pole `slalom.width` metres
//       further out, `slalom.turn` metres turning pole to turning pole;
//       `slalom.hairpins` HAIRPINS and `slalom.verticals` VERTICALS of
//       CLOSED gates — poles one above the other, `slalom.closed` metres
//       apart, `slalom.gap` between the gates of one, in a line down the
//       hill; and `slalom.delays` DELAYED gates `slalom.delayed` metres on.
//       No combination stands within `slalom.clean` gates of the start or
//       the finish, an open gate comes before every one, every pole stands
//       `slalom.inside` metres inside the piste, and the last gate is
//       `slalom.last` metres above the line and aims at its middle. A slalom
//       is two RUNS on the same stretch, the second set afresh.

import type { Band } from "./rules.ts";

export const DISCIPLINE_RULES = {
  /** R31 — the slalom course. */
  slalom: {
    /** The vertical drops a slalom is set to, m, tried in order: the top
     * level's, then a lower race's, then an entry league's. */
    drops: [190, 160, 140, 110, 80] as readonly number[],
    /** Which stretch wins: its gradient, counted to the top level's
     * steepest (`steep`), then `vertical` a metre of drop and `low` for
     * the foot of the piste — so a steep 140 m beats a gentle 190 m, and a
     * slalom is never set on an easy hill where the piste has a hard one.
     * The drops from `least` up compete so; a shorter one is tried only
     * where none of those fits. */
    pick: { steep: 0.45, vertical: 0.0004, low: 0.03, least: 140 },
    vertical: { min: 140, max: 220 } as Band,
    /** The longest a slalom runs down the piste, m: a top-level slalom
     * hill is about 590 m long. */
    maxLength: 720,
    /** The least piste width along it, m. */
    minWidth: 15,
    /** The finish's run-out: the steepest mean gradient past the line, and
     * over how far, m. */
    outrun: 0.22,
    outrunLength: 40,
    /** The line's least width, m (and the arena's fences stand wider). */
    finishWidth: 27,
    /** Trees cleared within this of the piste's edge along the course, m,
     * and the finish arena's box past the line: along, back up, across. */
    clear: 14,
    arena: { past: 70, before: 25, half: 40 },
    /** How far the stretch keeps from a drop on the piste, m, and how far
     * either side of it a kicker on the piste is levelled away. */
    clearance: 30,
    /** THE HILL COMBED SMOOTH: the ground under the course and its banks
     * taken to its own mean over a square this many metres either side of
     * each point — the length of the lips a black's face carries (one every
     * 5–7 m), so they go and the pitch stays — and how far past the piste's
     * edge the combing eases out, m. */
    comb: { reach: 6, ease: 6 },
    /** The direction changes as a share of the vertical, and the ± on it. */
    changes: { min: 0.3, max: 0.35, slack: 3 },
    /** The spacing of the gates down the piste, m (plan). */
    spacing: { min: 10.5, max: 12.5 } as Band,
    /** An open gate: the turning pole either side of the course's line,
     * m — the rules fix only the turning poles' distance, and this is the
     * offset a slalom ski carves at race pace (`limits.ts`: a turn of
     * eight or nine metres at its edge's hold), a section tight and a
     * section open — and the gate's width to its outside pole, m. */
    across: { min: 0.5, max: 1.0 } as Band,
    width: { min: 4, max: 6 } as Band,
    /** Turning pole to turning pole, m. */
    turn: { min: 6, max: 13 } as Band,
    /** A closed gate's poles apart down the hill, m, and the gap between
     * the gates of a combination, m. */
    closed: { min: 4.8, max: 5.6 } as Band,
    gap: { min: 0.75, max: 1 } as Band,
    /** THE TIGHTEST THE LINE ROUND THE POLES MAY BEND, m: a slalom ski's
     * carve at race pace, with its edge's change between two turns
     * (`limits.ts`) — so an open gate's turning pole stands no further
     * across than the gates either side of it leave room to swing to. */
    bend: 10,
    /** How many of each combination a course carries. */
    hairpins: { min: 3, max: 4 } as Band,
    verticals: { min: 1, max: 2 } as Band,
    delays: { min: 1, max: 2 } as Band,
    /** A delayed gate's turning pole on from the last, m, and how far
     * across, m. */
    delayed: { min: 12.5, max: 16 } as Band,
    delayAcross: { min: 1.8, max: 2.4 } as Band,
    /** No combination within this many gates of the start or the finish. */
    clean: 3,
    /** Every pole this far inside the piste's edge, m. */
    inside: 1,
    /** The last gate above the finish line, m. */
    last: 16,
    /** The start: the racer stood this far above the wand's line, m —
     * his boots just behind it, his poles planted over it. */
    stand: 1.1,
    /** THE START DROP: a slalom is the best skiers in the world on a hill
     * with no easy metre on it, and its start falls away out of the house
     * so they are at speed in a push. The snow below the wand is cut down:
     * level for `lip` m (where the boots go through), then steepened to
     * `grade` at its steepest over the next `length` m — never by more than
     * `most` m deep — and eased back onto the hill over `ease` m, the cut's
     * banks `shoulder` m wide either side of the piste. */
    drop: { lip: 0.6, length: 8, grade: 0.75, most: 3.5, ease: 40, shoulder: 10 },
  },
} as const;
