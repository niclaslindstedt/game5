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
   * Below them the lean and the edge are the ordinary air control of
   * `flight.ts`. */
  flipGate: 0.8,
  spinGate: 0.85,
  /** WHAT ONE STROKE IS WORTH, N·m·s of angular impulse about the pitch
   * axis (the lean) and about the up axis (the edge thrown over): divided
   * by the skier's own inertia, so a long stiff ski turns less for the same
   * throw. About 2.9 rad/s of pitch and 4.2 of yaw on the all-mountain
   * ski, reached over the wind-up below rather than in one step — with the
   * lean's own torque held on through the throw, a backflip in the 1.7 s a
   * park kicker gives a skier standing a metre tall, landed a few degrees
   * tips-down rather than over-turned onto his tails (in the air nothing
   * but the air's damping slows a flip); the front flip, thrown against
   * the tips the body eases up off the lip, comes round a little shorter
   * and the landing finishes it. */
  flip: 77,
  spin: 38,
  /** ...and the most a FLIGHT's strokes may add up to, rad/s on each axis:
   * the budget a skier taps out of. Enough for a double off the big lips
   * and not a triple. */
  flipCeiling: 6.5,
  spinCeiling: 8,
  /** HOW A STROKE IS PAID OUT, 1/s: not as one step's snap but as a
   * skier's throw — his body winds itself up, it gathers, and it settles
   * at the rate the stroke bought. The rate follows a critically damped
   * rise, `1 − (1 + ωt)·e^(−ωt)`, at this ω: half of it in 1.68/ω s, nine
   * tenths in 3.89/ω — about 0.17 s and 0.39 s for the flip, 0.21 s and
   * 0.49 s for the 360, whose heavier yaw gathers slower. What the delay
   * costs the turn is 2/ω s of the stroke's rate, which a skier holding
   * his throw is given back (the lean's torque, the 360's carry below). */
  flipWindUp: 10,
  spinWindUp: 8,
  /** THE 360 CARRIED: the edge held across its gate on the side a stroke
   * threw it to keeps winding the spin up at this much rad/s², out of the
   * same flight's budget — so a held 360 accelerates until the skier lets
   * go or the budget is spent, and a let-go one coasts down under the
   * air's damping. The flip needs no such dial: a held lean is already its
   * carry, the lean's own torque (`air.leanTorque`) gathering the flip the
   * whole time it is held, where the edge's yaw (`air.steerTorque`) is too
   * light to hold a spin against the air at all. */
  spinCarry: 3,
  /** A flight a stroke may be thrown in: one that LEFT the snow climbing at
   * least this fast, m/s, and has been up `air.counts` — a skier dropping off
   * a crest is not a launch. */
  launch: 0.5,
} as const;
