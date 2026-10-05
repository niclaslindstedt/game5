// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCORE AND THE STROKES — the block of `TUNING` that answers to
// `tricks.ts` (what the air, the ground a flight covered, the flips, the
// spins and the skier's grabs are worth, and the combo they ride on) and to
// `strokes.ts` (what one stroke on the lean or the edge turns the skier by,
// and out of what budget). It lives beside `tuning.ts` and is folded in as
// `TUNING.tricks`, which is how the whole repo spells it; nothing reads this
// module directly.
//
// Every number in here is an ARCADE DIAL, with one exception that says so
// where it stands (`lengthKnee`, the metres an ordinary kicker carries a
// skier, which is a measurement because it is what ties the two halves of a
// jump together). What the rest are chosen against is the LADDER they make
// between one flight and the next, and the doc comment below is that
// ladder.

/** THE SCORE (`tricks.ts`) and THE STROKES (`strokes.ts`). Read the score's
 * dials together with the runs they buy — every jump quoted at the reference
 * speed `lengthKnee / airKnee`, where its seconds and its metres are worth
 * the same and its base is twice what the clock alone would pay —
 *
 *   a 1 s jump                         108 × 1  =    108
 *   a 2 s jump                         371 × 1  =    371
 *   a 2 s jump with a backflip         671 × 3  =  2 013
 *   a 2 s jump with a 360              671 × 3  =  2 013
 *   a 2 s jump with a spread           521 × 3  =  1 563
 *   a 2 s jump, a backflip AND a 360 1 271 × 5  =  6 355
 *   a 3 s double backflip            1 631 × 5  =  8 155
 *
 * — the shape the whole thing is for: a skier who goes for the hard one off
 * the same kicker is paid several times over, the two axes are worth the
 * same so that CHAINING them beats repeating either, and a pose is worth a
 * little less than a revolution because the skier never turns over for it.
 * A jump with nothing done in it multiplies nothing: the air's own rung is
 * only ever sold beside a trick. */
export const TRICKS = {
  /** What a second of air is worth one `airKnee` into a flight, points/s;
   * the rate rises as `log2(1 + t/airKnee)` from there, so a flight's purse
   * grows rather faster than the flight does (`airPointsPerSecond`). */
  airRate: 100,
  /** The flight, s, the rate is quoted at — one second, the shortest jump a
   * skier reads as a jump rather than a bump. */
  airKnee: 1,
  /** HOW FAR THE FLIGHT CARRIED HIM, m, the length curve is quoted at —
   * `airKnee`'s twin on the other axis of the same jump, and the one number
   * the by-the-metre half is drawn from (`lengthPointsPerMetre` states the
   * rate off it, so there is no `lengthRate` to drift out of step with
   * `airRate`). It is a SPEED in disguise: the metres an ordinary kicker
   * carries a skier in the air's own knee: a skier off a park kicker at
   * about 60 km/h. Re-measure with the bot skiing the terrain park (R20)
   * on four seeds on every pair of the catalog once the park is tuned. */
  lengthKnee: 17,
  /** What the FIRST revolution of a flight adds to the combo's base,
   * points; the Nth adds N times it, alongside N steps of multiplier — so a
   * double is ×4 and not ×3, because a double backflip is a much harder
   * trick that happens to be measured in revolutions. */
  flipPoints: 300,
  /** ...and a revolution about the skier's own UP axis — the 360 — on the
   * same ladder, and the same figure, so the two are worth CHAINING rather
   * than repeating. The axes are counted apart: a flip with a spin in it is
   * two first revolutions. */
  spinPoints: 300,
  /** THE TWIST — a flip and a 360 in the SAME flight, credited as a third
   * element beside the two revolutions themselves: this much base and one
   * step. What it prices is the combination; the turns are already paid. */
  twistPoints: 300,
  /** A SKIER'S GRAB held in the air (`TrickPose`): what it adds to the base
   * once it has been held `poseHold` s, beside one step of multiplier. Each
   * grab is bought once a flight. */
  posePoints: 150,
  poseHold: 0.35,
  /** THE LANDING FINISHES THE TURN: a revolution this short of whole at
   * the touchdown, rad, is counted — the skis meeting the slope rotate the
   * skier the last of the way, and one who came round to 330° and skied
   * it away has turned a flip. Short of it, and he has not; nose-first past
   * it is `crash.ts`'s. */
  landSlack: 0.6,
  /** THE LANDING, JUDGED — by how hard the skier met the snow, as a share of
   * what his legs take before they fold to the stop (`harshSpeedOf`, less what
   * damage has cost it): at no more than `cleanLanding` of it a flight of
   * `airElement` s or more is landed CLEAN, at no more than `perfectLanding`
   * PERFECT — met along the slope, the springs taking it a little at a
   * time. Past the whole of it the landing is sketchy (rule 6), and where
   * damage is on it is what hurts the legs. A landing more than
   * `landSlip` rad sideways to the way the skier is going is neither.
   * Three quarters of the stroke: a skier's legs take 8 m/s whole where
   * the sibling snowmobile game's springs took 10, and a flip landed off
   * a park kicker a touch tips-down meets the snow at about 6. */
  cleanLanding: 0.75,
  perfectLanding: 0.35,
  landSlip: 0.35,
  /** What a clean landing adds to the combo's base at a dead-soft touchdown,
   * points, falling to nothing at `cleanLanding` — and beside a trick
   * turned in the same flight, one step of multiplier, two for a perfect
   * one. Alone it multiplies nothing, as the air's own rung does not. */
  landPoints: 250,
  /** How long the skier has on the snow, s, to leave the next lip before
   * the combo closes and banks. */
  linkWindow: 1.2,
  /** THE AIR ITSELF AS AN ELEMENT: how long a flight has to last, s, for
   * the air to buy a step of multiplier — credited only once a trick has
   * landed beside it, and only once per combo. */
  airElement: 0.5,

  /** ── THE STROKES (`strokes.ts`) ─────────────────────────────────────
   * THE GATES: how far toward the top of its axis an input has to be
   * carried for it to be a stroke rather than trim — the lean's (both
   * ways: back is the backflip, forward the front flip) and the edge's.
   * The edge's is the lower: a key tapped left or right is ramped
   * (`input-model.ts`) and a quick tap must still reach it. Below them the
   * lean and the edge are the ordinary air control of `flight.ts`. */
  flipGate: 0.8,
  spinGate: 0.6,
  /** WHAT ONE STROKE TURNS, rad: a tap on the edge is HALF A TURN about
   * the skier's own up axis — once, and the skis come down backward (a
   * 180, ridden away switch); twice, a whole 360 — and a tap on the lean a
   * WHOLE TURN nose over tail, a loop. A tap the other way takes one back
   * off what is still owed. */
  spinStep: Math.PI,
  flipStep: 2 * Math.PI,
  /** ...and the most a flight's strokes may have owed at once on each
   * axis, rad: a 720 and a double. */
  spinMost: 4 * Math.PI,
  flipMost: 4 * Math.PI,
  /** HOW A STROKE IS TURNED: not handed over in a step but THROWN — the
   * rate gathered at `spinAccel` / `flipAccel` rad/s² up to a cruise of
   * `spinRate` / `flipRate` rad/s, and taken off again at the same
   * acceleration so the body stops square on the angle bought (a 180
   * stops with the skis straight backward, a loop with them level). The
   * accelerations are the reference pair's, scaled by the root of each
   * pair's own inertia against it (a long downhill ski is slower to throw
   * round, the short park ski quicker). An arcade's numbers: a 180 in
   * about 0.36 s, a loop in 0.5–0.7, so both come round off the jump key's
   * own pop on the flat — a real skier wants a kicker for the loop. */
  spinRate: 12,
  flipRate: 10,
  spinAccel: 120,
  flipAccel: 100,
  /** THE THROW IS PACED TO THE SNOW: whatever is owed is turned by
   * `finish` s before the flight comes back down (`flight.ts`'s
   * `landingAhead`), the cruise raised to fit up to `rateMost` rad/s —
   * and a stroke that could not be turned in the air left, at that rate,
   * is not taken at all: a lean thrown for the landing is the lean, not a
   * loop the skier would land half way round. */
  finish: 0.08,
  rateMost: 18,
  /** A flight a stroke may be thrown in: one that LEFT the snow climbing at
   * least this fast, m/s, and has been up `air.counts` — a skier dropping off
   * a crest is not a launch. */
  launch: 0.5,
  /** ON A FREE RIDE, a flight is one the skier MEANT only if he left the
   * snow off a kicker's ramp or within this long of popping the jump, s —
   * a knee taken at speed throws him without asking, and the edge he
   * steers across it is his steering (`TrickState.meant`). A tricks run
   * means every flight. */
  popWindow: 0.3,
} as const;
