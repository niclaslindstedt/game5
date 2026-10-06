// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SIDESTEP — the block of `TUNING` that answers to `sidestep.ts`: how a
// skier stood across a slope too steep to walk up climbs it, one ski at a
// time, stamping a platform for each. It lives beside `tuning.ts` and is
// folded in as `TUNING.sidestep`, which is how the whole repo spells it.
//
// WHAT IS MEASURED, AND WHERE IT IS FROM (`docs/riding.md` § The sidestep):
//
//   - The technique: the skis square to the fall line, the UPHILL ski lifted
//     and set down a step up the hill on its uphill edge — set hard, the
//     snow slapped down into a ledge — the weight moved onto it, then the
//     downhill ski brought up beside it. The poles brace each step, the
//     uphill one planted up the hill, the downhill one pushing.
//   - Where it is taught: a skier walks a rise in a diagonal stride, opens
//     his skis into a herringbone (a V of some 17° a ski) as it steepens, and
//     turns side-on and sidesteps once the herringbone's edges slip — some
//     10° and up, and on anything steep or icy whatever else he could do.
//   - How steep: a black run's steepest pitch is about 35°, 40° is about the
//     steepest any marked run has, and 45° is half way to vertical where
//     steep skiing begins. A set edge holds a ledge on all of it, each step
//     shorter and harder the steeper it gets; past some 50° the snow does
//     not lie long enough to settle — it sluffs off as it falls — and there
//     is nothing to stamp a platform in. There a skier takes his skis off
//     and kicks steps in his boots, which this game does not do.
//   - The step: a sidestep gains a ski's width and a little more, 20–40 cm
//     across the snow, at about a step of each ski a second.
//
// Everything the player sees of it (the lift, the stamp, the body over the
// hill, the poles) is `skier-gait.ts`'s `sidestepGait`, off the phase and
// the side this block's engine half writes.

export const SIDESTEP = {
  /** The slope, rad, from which a skier stood across it and asked toward
   * the hill STEPS UP it rather than step round on the spot (10°: past
   * where the herringbone's edges hold). */
  from: 0.17,
  /** How far his skis may be off square to the fall line, rad, and still
   * stand across it (40°): turned further, a steer steps him round. */
  across: 0.7,
  /** One PAIR of steps — the uphill ski, then the downhill one — carries
   * him `step` m up the snow, at `steps` pairs a second on a moderate
   * slope. */
  step: 0.32,
  steps: 0.9,
  /** THE STEEP: from `steep` rad (35°, a black run's steepest) each step
   * is shorter and slower, down to `least` of it by `most` (45°), and
   * none at all by `none` (50°), where the snow sluffs rather than lies
   * and takes no platform. A slope past `none` is not sidestepped. */
  steep: 0.61,
  most: 0.79,
  none: 0.87,
  least: 0.45,
  /** How much of the slowing the pace takes, the rest the step's length:
   * a skier on a steep face takes shorter steps, and more slowly. */
  pace: 0.35,
  /** In loose snow each stamp packs down before it carries him: the share
   * of a step kept on bottomless powder (on the groomer, all of it). */
  powder: 0.7,
  /** The SKIS SET INTO THE HILL while he stands on his platforms: the
   * share of the slope's angle they are edged by, and never past `edge`
   * rad — so they stand near level across, on the ledge they cut. */
  set: 0.8,
  edge: 0.7,
} as const;
