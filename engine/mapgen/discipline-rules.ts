// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DISCIPLINES' RULE BOOK — R31 onward, the rules a RACE COURSE of a
// discipline is set to on a map that is already built (R1–R30). The map is
// the mountain; a discipline is how a race uses it: where on the piste its
// course starts and finishes, which gates stand down it and what passing
// one means. The SLALOM (R31) and the DOWNHILL (R32) are set today; the
// giant slalom, the super-G, the ski cross and the speed run are named by
// the game and not set yet, and each will be a rule here when it is.
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
//   downhill.vertical 450–1100 m  a downhill's vertical drop: the men's top
//                                 level 800–1100, the women's 450–800, every
//                                 other race 450–1100 (a two-run downhill
//                                 350–450); no length is set — measured
//                                 courses run ~3.5 km (median 3499 m over
//                                 859 m, 41.5 gates)
//   downhill.width ≥ 8 m          a gate is FOUR poles and TWO panels, a
//                                 pair of poles holding a panel at each end,
//                                 at least 8 m between the inner poles;
//                                 red (blue only for a second course's
//                                 extra gates); rigid poles unless the jury
//                                 asks for flex ones
//   downhill.spacing ~80 m        no least spacing is set; the gates mark
//                                 the racing line, and check the speed
//                                 before a hard jump or passage (measured:
//                                 79 m along the course, 29 m across,
//                                 median)
//   downhill.course ~30 m         the course's width, fall zones on the
//                                 outside of the curves, the obstacles
//                                 behind high safety nets (A-nets, 4–6 m)
//   downhill.passing              both tips and both feet across the gate
//                                 line; a gate missed, or a racer stopped
//                                 by a fall, may not go on through the
//                                 gates — disqualified, did not finish
//   downhill.finish ≥ 15 m        the finish line's width, a wide, gentle,
//                                 fenced run-out past it
//   downhill.start                one race run on an interval start, the
//                                 racer pushing off with his poles only;
//                                 "ten seconds", then five to one, then GO,
//                                 a start valid from 5 s before to 5 s after
//   downhill.training             at least one timed training run on the
//                                 course before the race, every racer
//                                 started in one; its times count for
//                                 nothing
//
//   superG.vertical 350–650 m     a super-G's vertical drop: the men's top
//                                 level 400–650, the women's 400–600, any
//                                 other race 350–650 (youth 250–450);
//                                 measured top-level courses 598 ± 38 m
//                                 over 2293 ± 204 m
//   superG.changes ≥ 7 %          the direction changes: at least 7 % of the
//                                 vertical drop in metres (6 % at some
//                                 levels) — 42 on 600 m; measured 44 ± 3
//   superG.spacing ≥ 25 m         turning pole to turning pole of two
//                                 successive gates (15 m only inside a
//                                 rare combination); measured 49.5 ± 5.7 m
//                                 along the course, 12–13 m across
//   superG.width 6–8 m            a gate is FOUR flex poles and TWO panels,
//                                 the turning pair and the outside pair, 6–8
//                                 m between the inner poles (8–12 for a
//                                 gate set down the fall line); red and
//                                 blue in turn
//   superG.setting                the terrain used, long and medium turns
//                                 varied, never set only down the fall
//                                 line; jumps where the terrain allows; the
//                                 course about 30 m wide, prepared as a
//                                 downhill's
//   superG.passing                both tips and both feet across the gate
//                                 line; a gate missed disqualifies, a racer
//                                 stopped does not finish
//   superG.start                  one run on an interval start (60 s, never
//                                 under 40), the downhill's start: the start
//                                 clock, poles only, a start valid 5 s
//                                 either side
//   superG.inspection             NO training run: the course is inspected
//                                 slipping down beside its gates, never
//                                 skied through them
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
//
//   R32 THE DOWNHILL COURSE. A downhill is set on a built map's WHOLE
//       piste, from its start gate to its finish line, on the course of
//       the ski area with the most vertical (`downhill.vertical` the band
//       it is held to where the area has one) — the start a house over the
//       piste, the snow out of its door cut into a START DROP as steep as
//       `downhill.drop.grade` over its first `downhill.drop.length`
//       metres, every kicker on the piste levelled, the piste groomed hard
//       from the house to the end of the run-out whatever drift lay across
//       it and its relief combed smooth over `downhill.comb` — its
//       rollers and its drops kept as the course's JUMPS, every crest
//       sharper than `downhill.crest` metres of radius shaved round so a
//       racer at speed comes down on the slope below it — every tree
//       within `downhill.clear` metres of the piste and in the finish
//       arena cleared, and A-NETS along both edges of it `downhill.nets.gap`
//       metres outside the piste from the house to the finish arena. Its
//       RACING LINE is the line down the piste that bends the least,
//       kept `downhill.line.margin` metres inside its edges, and its
//       gates MARK it: SPEED GATES — four poles and two red panels,
//       `downhill.width` metres between the inner poles, centred on the
//       line — every `downhill.spacing` metres down the piste, none within
//       `downhill.jump` metres of a jump. The finish line is
//       `downhill.finishWidth` metres
//       wide at the least. The SPEED TRAP stands where the piste has
//       fallen the most over the `downhill.trap.run` metres before it, on
//       a straight, in the course's last `downhill.trap.late` share; the
//       course is timed at `downhill.timing` intermediates besides. A
//       downhill is one RUN, preceded by a TRAINING run on the same
//       course.
//
//   R33 THE SUPER-G COURSE. A super-G is set on the piste of the ski
//       area's course with the most vertical, from a START LOWERED down it
//       until the drop to the finish line is `superG.target` metres at the
//       most (`superG.vertical` the band it is held to where the piste has
//       one) — prepared as a downhill's is: the start a house over the
//       piste, the snow out of its door cut into a START DROP as steep as
//       `superG.drop.grade`, every kicker on the piste levelled, the piste
//       groomed hard and combed smooth over `superG.comb`, every crest
//       sharper than `superG.crest` metres of radius shaved round, every
//       tree within `superG.clear` metres of the piste and in the finish
//       arena cleared, and A-NETS along both edges `superG.nets.gap` metres
//       outside the piste. Its JUMPS are its drops and the crests a racer
//       leaves the snow on (the profile still bending over tighter than
//       `superG.takeoff` metres). Its gates TURN the racer: as many as
//       `superG.changes` of the vertical in metres and `superG.spacing`
//       metres apart down the piste give, whichever is more, each strayed
//       off the even spacing by `superG.rhythm`, none within `superG.jump`
//       metres before a jump nor `superG.landing` after it. Its RACING LINE
//       is the line that bends the least kept `superG.line.margin` metres
//       inside the piste and `superG.line.most` off its middle, SWUNG to
//       each gate's side in turn by `superG.swing` metres — no further than
//       bends it tighter than `superG.bend` metres, nor leaves the gate off
//       the snow; `superG.opening` of it at the first gates, the
//       `superG.straight` share before a jump, and less on a gentle stretch
//       (`superG.flat`) — eased from one gate's apex to the next. Each gate
//       is FOUR poles and TWO panels, red and blue in turn, `superG.width`
//       metres between the inner poles, its turning pole `superG.pass`
//       metres inside the line's apex and every pole `superG.inside` metres
//       inside the piste. The finish line is `superG.finishWidth` metres
//       wide at the least; the SPEED TRAP stands as a downhill's does, in
//       the course's last `superG.trap.late` share, and the course is timed
//       at `superG.timing` intermediates besides. A super-G is one RUN, with
//       no training run.

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
     * carve at race pace, with its edge's change between two turns — the
     * racer's cross-under (`Technique.cross`, `limits.ts`) — so an open
     * gate's turning pole stands no further across than the gates either
     * side of it leave room to swing to. */
    bend: 8,
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
  /** R32 — the downhill course. */
  downhill: {
    /** The vertical a downhill is held to, m: the women's floor to the
     * men's top. The ski area's course with the most vertical is the one
     * a downhill is set on, the band or not. */
    vertical: { min: 450, max: 1100 } as Band,
    /** The start: the racer stood this far above the wand's line, m. */
    stand: 1.1,
    /** THE START DROP: a speed event leaves its house down a ramp built
     * to reach full speed quickly — gentler than a slalom's cut (no
     * gradient is set for it), and longer. */
    drop: { lip: 0.6, length: 12, grade: 0.55, most: 3, ease: 50, shoulder: 10 },
    /** Every kicker on the piste levelled, and how far past its ends, m. */
    clearance: 30,
    /** The finish's run-out groomed with the course, m. */
    outrunLength: 60,
    /** The hill combed smooth of its short lips (the slalom's reach: the
     * lips of a black's face go; its rollers and drops, longer, stay). */
    comb: { reach: 6, ease: 6 },
    /** THE CRESTS SHAVED: no crest down the course sharper than this
     * radius, m — a racer flown off a knoll at 100+ km/h comes down on its
     * downslope, as a downhill's jumps are built to land him. */
    crest: 80,
    /** Trees cleared within this of the piste's edge along the course, m —
     * past the nets — and the finish arena's box: along, back up, across. */
    clear: 12,
    arena: { past: 90, before: 30, half: 45 },
    /** THE A-NETS: their line outside the piste's edge, m, how tall they
     * stand, m, and how far a racer driven into one sinks into it before
     * it holds him, m. */
    nets: { gap: 3, height: 5, give: 2 },
    /** The gates down the piste, m: the least, the most and the spacing
     * aimed at (the measured median's 79 m). */
    spacing: { min: 55, max: 110, target: 80 },
    /** Between the inner poles, m — the rule's 8 at the least — and how far
     * inside the piste's edge every pole stands, m. */
    width: 10,
    inside: 3,
    /** THE RACING LINE: laid a station every `step` m, kept `margin` m
     * inside the piste's edges — a gate's half-width and its poles' own
     * room — where the room it is held in opens and closes no faster than
     * `ease` m a metre down the piste (a piste that widens all at once
     * does not throw the line into a corner), and bending the least it
     * can between them (relaxed over `passes` at each of the strides
     * `strides`, coarse to fine). */
    line: {
      step: 4,
      margin: 8,
      ease: 0.1,
      passes: 60,
      strides: [64, 32, 16, 8, 4, 2, 1] as readonly number[],
    },
    /** No gate within this of a jump's lip or a drop's edge, m, before or
     * after: a racer goes straight over a jump. */
    jump: 25,
    /** The finish line's least width, m. */
    finishWidth: 20,
    /** THE SPEED TRAP: where the piste has fallen the most over the `run` m
     * before it, on a straight (no bend tighter than `straight` m of
     * radius within `span` m either side), in the last `late` share of the
     * course and `end` m short of the finish at the least. */
    trap: { run: 250, straight: 400, span: 30, late: 0.6, end: 60 },
    /** The intermediate timing points. */
    timing: 4,
  },
  /** R33 — the super-G course. */
  superG: {
    /** The vertical a super-G is held to, m: every race's band past the
     * youth's (the men's top level 400–650, the women's 400–600, any other
     * 350–650). Set on the ski area's course with the most vertical, its
     * START LOWERED down the piste until the drop to the finish is
     * `target` at the most — the measured top-level courses' 598 ± 38. */
    vertical: { min: 350, max: 650 } as Band,
    target: 600,
    /** The start: the racer stood this far above the wand's line, m. */
    stand: 1.1,
    /** THE START DROP: the speed events' ramp, a little shorter — a
     * super-G turns from its first gates. */
    drop: { lip: 0.6, length: 10, grade: 0.55, most: 3, ease: 45, shoulder: 10 },
    /** Every kicker on the piste levelled, and how far past its ends, m. */
    clearance: 30,
    /** The finish's run-out groomed with the course, m. */
    outrunLength: 60,
    /** The hill combed smooth of its short lips. */
    comb: { reach: 6, ease: 6 },
    /** THE CRESTS SHAVED, m of radius: a super-G is flown off its crests at
     * 25–28 m/s, where a racer leaves the snow over a crest tighter than
     * v²/g — some 65–80 m — so a crest is rounded to land him on its
     * downslope, as the downhill's are at its higher speed. */
    crest: 65,
    /** Trees cleared within this of the piste's edge, m, and the arena. */
    clear: 12,
    arena: { past: 90, before: 30, half: 45 },
    /** THE A-NETS, as the downhill's. */
    nets: { gap: 3, height: 5, give: 2 },
    /** THE DIRECTION CHANGES: at least this share of the vertical in
     * metres (the top level's 7 %). */
    changes: 0.07,
    /** The gates down the piste, m: the least (the rule's 25 m turning pole
     * to turning pole, and the measured least 32), the most, and the
     * spacing aimed at (the measured 49.5 ± 5.7 m along the course). */
    spacing: { min: 32, max: 75, target: 49 },
    /** How much a gate's spacing strays from the even one either way, as a
     * share — a course's rhythm changes. */
    rhythm: 0.18,
    /** Between the inner poles of a gate, m — the rule's 6–8 — and how far
     * inside the piste's edge every pole stands, m. */
    width: 8,
    inside: 2,
    /** How far outside the turning pole the line passes, m — a racer
     * brushes it with his shins at the top level; the game's line keeps a
     * margin the bot can hold at 100 km/h. */
    pass: 3.5,
    /** THE FIRST GATES out of the house, skied at a crawl on the downhill
     * ski — which stands on no more edge than its lean lets it there —
     * swing this share of their own, gate by gate. */
    opening: [0.35, 0.7] as readonly number[],
    /** ...and a gate on a GENTLE stretch — the piste falling less than `to`
     * over the `over` m above it — swings less, down to `least` of its own
     * at `from`: a racer comes onto a flat slowly, and the downhill ski at
     * 40 km/h carves no super-G turn. */
    flat: { over: 80, from: 0.08, to: 0.2, least: 0.35 },
    /** THE SWING: how far the line swings across the piste to a gate's side,
     * m, either side of the line that bends the least — the measured 13 m
     * across between two gates, as a line swung round the poles — dealt
     * between its least and most a gate; and the tightest it may bend for
     * it, m of radius (the measured least turn's 35 m — and what the
     * downhill ski carves at a super-G's pace, `SUPER_G_TECHNIQUE`). */
    swing: { min: 2.5, max: 5.5 } as Band,
    bend: 50,
    /** THE GATE BEFORE A JUMP is set straight: one within `approach` m of a
     * jump's lip swings this share of its own. */
    approach: 70,
    straight: 0.3,
    /** THE RACING LINE the swing is laid about: the downhill's, held
     * further inside the piste's edges so a gate swung either side of it
     * stands on the snow, and never more than `most` m off the piste's
     * middle — a super-G is set down the middle of a course some 30 m
     * wide, the gates swinging it either side, where a wide resort piste
     * would let the least-bending line wander twenty metres to a side. */
    line: {
      step: 4,
      margin: 9,
      most: 5,
      ease: 0.1,
      passes: 60,
      strides: [64, 32, 16, 8, 4, 2, 1] as readonly number[],
    },
    /** THE JUMPS: a crest is one where the shaved profile still bends over
     * tighter than `takeoff` m of radius, read over `crestSpan` m either
     * side (a lip's length) — a racer at 25–30 m/s leaves the
     * snow there — and no gate stands within `jump` m before a jump's lip
     * or a drop's edge, nor `landing` m after it, where he is still in the
     * air or just down: a gate in the air judges a foot nowhere near the
     * snow. */
    takeoff: 110,
    crestSpan: 10,
    jump: 25,
    landing: 45,
    /** The finish line's least width, m. */
    finishWidth: 20,
    /** THE SPEED TRAP, as the downhill's. */
    trap: { run: 200, straight: 300, span: 25, late: 0.5, end: 60 },
    /** The intermediate timing points. */
    timing: 3,
  },
} as const;
