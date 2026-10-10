// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ONE-KEY BRAKE AND THE CLIMB — the block of `TUNING` that answers to
// `stop-hand.ts`: the back key held with no edge asked slows a skier the
// way a skier slows, and stops him; pressed again stood still, it takes him
// back up the hill; and the tuck held facing a hill climbs it. It lives
// beside `tuning.ts` and is folded in as `TUNING.hand`.
//
// WHAT IS MEASURED, AND WHERE IT IS FROM (`docs/riding.md` § The one-key
// brake):
//
//   - A skier slows by FINISHING HIS TURNS: each one carried on round
//     across the fall line, skidded so the edges scrape speed off, and the
//     next begun from there — the zig-zag down a slope every ski school
//     teaches as speed control. The turn is finished some 60–80° across
//     the fall line; carried past 90° it climbs and stops him.
//   - He STOPS with a HOCKEY STOP: both skis pivoted across the way he is
//     going, their edges set, from a speed a turn can no longer be linked
//     at (some 30 km/h on a groomer), the turn carried uphill with it so
//     the slope helps.
//   - He CLIMBS a gentle slope walking or skating straight up it on his
//     skis (to some 8°, where the walk's grip runs out on a groomer), and
//     anything steeper SIDE-ON: turned across the fall line and sidestepped
//     up it (`sidestep.ts`, from 10°). Stood facing up anything steeper, he
//     steps round on the spot to stand across it first, his edges set at
//     every step (`poles.ts`'s `stepRound`).

export const STOP_HAND = {
  /** The speed, m/s, above which the back key LINKS SKIDDED TURNS (54
   * km/h) and below which the next turn is the last: the hockey stop. */
  link: 15,
  /** ...and from over it, at least `links` turns linked before the stop,
   * while he is still over `owedTo` m/s (32 km/h). */
  links: 1,
  owedTo: 9,
  /** How far across the fall line a linked turn is finished, rad — the
   * way he is GOING, not the way his skis point, which on a steep slope
   * slip down it: 50° on a slope of `gentle` (15°) and under, 69° on one
   * of `steep` (38°) and over. */
  across: 0.87,
  acrossSteep: 1.2,
  gentle: 0.26,
  steep: 0.66,
  /** ...and the hockey stop carried round uphill until the slope stops
   * him: to `last` (100°) on a gentle slope, `lastSteep` (137°) on a steep
   * one, where only climbing takes his speed. */
  last: 1.75,
  lastSteep: 2.4,
  /** The steer eased off over the last `band` rad (25°) of a turn. */
  band: 0.44,
  /** The brake held through a linked turn, and through the hockey stop on
   * a gentle slope, 0..1 — eased out of the hockey stop to none on a
   * steep one, where the skis pivoted across slip down it and only the
   * carve uphill holds: a skid that turns him as it scrapes. */
  skid: 0.5,
  stop: 0.4,
  /** A linked turn is let go `flip` (10°) before it is finished. */
  flip: 0.17,
  /** The zig-zag's steer: eased in and swung across at `swing` a second,
   * to no more than (`link` over the speed) to the `ease` at speed, never
   * under `least` — a full edge thrown at 100 km/h is a crash. */
  swing: 1.5,
  ease: 1,
  least: 0.35,
  /** Under this speed, m/s, he has STOPPED. */
  still: 0.3,
  /** The steer, of full, under which the back key is the one-key brake —
   * an edge asked with it is the hockey stop by hand. */
  steerFree: 0.15,
  /** Slow enough to set off up a hill, m/s. */
  crawl: 1.2,
  /** The slope, rad, from which there is a HILL to climb (3°), and from
   * which it is climbed SIDE-ON rather than walked straight up (8°). */
  hill: 0.05,
  walk: 0.14,
  /** How near, rad, his heading must come to the one he is turning to
   * before he stops stepping round: 15°. */
  aim: 0.26,
  /** Stood facing a hill this far round from straight down it, rad
   * (110°), the tuck held is a climb. */
  facing: 1.92,
  /** Stood facing this far round up a hill, rad (150°), BACK turns him to
   * face down it and lets it take him, ploughed; any less and the hill is
   * behind or beside him, and BACK climbs it. */
  upHill: 2.62,
} as const;
