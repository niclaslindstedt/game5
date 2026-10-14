// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HURT BY HIS OWN BIKE (`bike-tangle.ts`): the numbers of a rider thrown
// into the bike he came off — its parts as solids his body meets, the
// chance a limb is caught in them, and what a catch does to it.
//
// THE RESEARCH (`docs/downhill-bike.md` § *Hurt by his own bike*, our own
// words over the published figures):
//   - The commonest way a mountain biker is hurt is a fall forward OVER
//     THE BARS, riding downhill; the serious injuries — fractures, the head,
//     the shoulder — come mostly out of it, and the shoulder and the arm
//     lead every downhill series.
//   - THE BARS AS A SPEAR: in the paediatric trauma series a handlebar
//     blow is about one bicycle injury in eleven (9 %), yet about ten times
//     as likely to be severe as any other — a solid organ hurt in 35 % of
//     them against 4 % of the rest, a hollow one in 9 % against under 1 %;
//     the liver, the spleen, the pancreas and the bowel take it, mostly out
//     of a simple fall rather than a collision. The bar turned square across
//     as the front wheel stops is what puts its end into the belly.
//   - THE CHAINRING AND THE PEDALS: the teeth's cut on the calf and the
//     shin and the pedal's pins in it are the commonest small wounds of the
//     sport; a lowside lays the leg under the drive side.
//   - THE WHEELS: a foot or a hand caught in the spokes is a real injury —
//     crushed, degloved, a toe or a heel's skin torn off in the worst — but
//     the series are nearly all children riding pillion; a rider's own
//     wheel takes a limb rarely, and only while it still turns.
//   - TORN OFF: a limb taken off by a bicycle is a case report rather than
//     a rate (fingers and toes in the spokes or the ring). THE GAME'S
//     LIBERTY: a limb caught at speed in a turning wheel, the ring or the
//     frame is snatched to the bike's speed over the few centimetres the
//     catch gives (`yank.give`), and past the far end of its ladder it
//     tears off (`GORE.sever`, only on a run with its INJURIES on) — so a
//     catch at 45–65 km/h can cost a leg or an arm, as asked.

/** HURT BY HIS OWN BIKE (`bike-tangle.ts`). */
export const BIKE_TANGLE = {
  /** How long after the throw the bike can still catch him, s: a tangle is
   * the first seconds of a fall, while the two are sliding together. */
  window: 4,
  /** THE PARTS AS SOLIDS, in the bike's body frame (`bike-geometry.ts`):
   * the bars' bar (half-width, its middle over the stem), the bar END's
   * reach, the frame's tubes' radius, the chainring and pedals' reach
   * about the bottom bracket (the ring on the drive side, a 36-tooth ring's
   * 0.07 m and the pedals' sweep), and a wheel's half-width at the tyre. */
  bars: { y: 0.55, z: 0.38, half: 0.4, radius: 0.025, end: 0.06 },
  tube: 0.03,
  ring: { x: 0.06, reach: 0.17 },
  wheel: { half: 0.035 },
  /** The frame's tubes, from its centre of mass, m (the bottom bracket's
   * place is the geometry's): the top of the head tube, the top of the
   * seat tube. */
  head: { y: 0.42, z: 0.36 },
  seat: { y: 0.4, z: -0.22 },
  /** The closing speed under which a touch is no blow, m/s, and how long a
   * point waits before its next blow off the bike, s. */
  touch: 1.2,
  /** WHAT EACH PART GIVES, m, a blow off it stopped over that and the
   * body's own give: a 17 kg bike is no tower — a tube flexes and the whole
   * bike is shoved away on its tyres; a wheel's spokes and tyre give most;
   * a bar END's plug spears with next to nothing, and the stem and the top
   * tube up into the groin little more. */
  give: { tube: 0.02, ring: 0.015, wheel: 0.04, bars: 0.02, spear: 0.006, groin: 0.01 },
  cool: 0.25,
  /** How much worse a blow is on the part that does it: a BAR END's small
   * end spears the trunk under it (the share the belly takes, against
   * `INJURY.share.trunk`'s), the RING's teeth cut where a tube would only
   * bruise (the blow's multiple). */
  spear: 0.9,
  teeth: 1.5,
  /** THE CHANCE A TOUCH CATCHES THE LIMB, by what it touches: a foot or a
   * hand between a TURNING wheel's spokes (only past `spin` m/s at the
   * rim), the ring's teeth, the bars and the stem, the frame's triangle.
   * Drawn off a hash of the run, the step and the point — never the
   * stream. The head is caught in the bars or the frame only. */
  catch: { wheel: 0.06, ring: 0.06, bars: 0.05, frame: 0.04 },
  /** The least closing speed a touch can catch at, m/s. */
  catchAt: 2.5,
  spin: 2,
  /** How long a caught limb is held, s (dealt between the two), and how
   * long it is left free after, s. */
  hold: { least: 0.35, most: 1.2 },
  free: 1,
  /** THE YANK: a caught limb brought to the part's speed over `give` m of
   * the catch's give and the limb's stretch — a blow on the part a tear
   * reads (`gore.ts`' `TEAR`), at `INJURY.peak`'s shape. At 0.02 m a
   * forearm comes off at ~12 m/s, a leg at the hip at ~10.5, the shin at the
   * knee at ~14, an arm at the shoulder at ~12 and the head at ~18. */
  yank: { give: 0.02 },
  /** THE PULL BETWEEN THEM while a limb is held: the share of the gap the
   * body pulls its limb from the anchor that moves the bike (the body's
   * effective mass on the limb against the bike's 17 kg). */
  tow: 0.6,
  /** The share of a blow's momentum the lying bike takes up as speed: the
   * rest goes into the ground under its tyres and the frame's flex. */
  shove: 0.5,
  /** The fastest the held limb drags the bike after it, m/s. */
  towMost: 3,
  /** AT THE THROW, dealt off the crash (`dealtStrikes`): the share of the
   * crash's speed each is met at, and its chance.
   *   - over the bars (`bars`, `hit`, a nosed `landing`): the BAR END into
   *     the belly as the bar turns across; the STEM and the top tube into
   *     the groin; a foot kept on its pedal, the bike tumbling after him;
   *   - laid down (`lowside`, `washout`): the RING into the shin of the
   *     leg under it; the foot trapped under the frame, dragged. */
  over: {
    barEnd: { chance: 0.12, share: 0.45 },
    stem: { chance: 0.15, share: 0.35 },
    pedal: { chance: 0.15 },
  },
  laid: {
    ring: { chance: 0.35, share: 0.3 },
    trapped: { chance: 0.1 },
  },
  /** A LIMB IN THE SPOKES at the throw (any crash the pedal or the frame
   * did not take): its chance, the share of the hands in it, and the share
   * of the crash's speed the turning wheel snatches it to — a yank that at
   * 45 km/h can tear a forearm off and at 50 km/h a shin. */
  spokes: { chance: 0.06, hand: 0.35, share: 1 },
  /** The least crash speed a dealt strike is drawn at, m/s, and how fast
   * the pace it is dealt at falls after the bike is stopped, m/s² (a ledge
   * stops it a few tenths before the crash is judged). */
  least: 3,
  pace: 12,
} as const;
