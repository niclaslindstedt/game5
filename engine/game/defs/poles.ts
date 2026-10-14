// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRIVE A SKIER MAKES HIMSELF — the block of `TUNING` that answers to
// `poles.ts` (the stride, the skate, the double pole, the step turn and the
// hill taking over). It lives beside `tuning.ts` and is folded in as
// `TUNING.poles`.

/** THE DRIVE A SKIER MAKES HIMSELF (`poles.ts`): off a standstill and up
 * a rise he STRIDES — the skis parallel, a leg kicking back off each
 * step and the other arm planting its pole, the gait of a man walking
 * on skis — rolling he SKATES — the skis in a V, a leg pushing off each
 * stride, the poles planted with it — and faster he DOUBLE-POLES, both
 * poles planted together and the body folded over them. Both are a man's legs and arms against the
 * snow, so the push is POWER-LIMITED: the force is the lesser of what a
 * plant can press (`SkiSpec.polePush`, N) and `power` W over the way,
 * which is how every human-powered drive falls off with speed. It is
 * AUTOMATIC below `fade` — a skier going slowly works for his speed
 * whatever the thumbs say — and stops with the skid thrown, in the air,
 * with a jump being loaded, and once he is thrown. */
export const POLES = {
  /** The speed, m/s, under which the push is its whole; the speed by
   * which THE SKATE is gone, the legs no longer keeping up with the skis
   * (34 km/h — a racer skates out of the gate and a step turn is a
   * crawl's); and the speed by which THE DOUBLE POLE is, eased
   * (`driveReach`): 61 km/h, though the arms' cadence gives out well
   * before it (`keepUp`). Measured, an elite double-poler runs up to some
   * 30 km/h on the flat and poles on down a gentle pitch past 40; the
   * power law (below) is what makes each push buy less the faster he
   * goes. */
  speed: 6,
  skateFade: 9.5,
  fade: 17,
  /** The mean propulsive power, W — past what a double-poler holds over a
   * race (some 300 W a cycle measured on the ergometer, more out of the
   * legs and the trunk than the arms), nearer what the fittest put down
   * in a sprint: this is an arcade's skier, working like mad, and the
   * speed he wins off the flat is meant to be felt. */
  power: 800,
  /** THE HILL TAKES OVER (`slopeShare`): down a pitch whose pull along his
   * skis is `from` times what his poles add at the speed he is going, he
   * starts to give up working them, and by `to` times he has — he stands
   * the poles under his arms and tucks (the thumb's tuck, which the drive
   * held off). On a gentle run-out he poles; down a steep face, never.
   * The pitch is the ground's over `span` m (`hillPull`), not a roller's. */
  hill: { from: 0.6, to: 1.15, span: 12 },
  /** THE FOLD a double-pole stroke averages, as a share of the tuck's
   * (`poleFold`): the trunk drives down near level over the plant and
   * comes back up through the recovery — measured, a double-poler's
   * frontal area is some way between a skier stood up and one tucked. */
  fold: 0.45,
  /** Below this way, m/s, he skates; over `skateTo` he double-poles —
   * blended between: a skater's V at a crawl and up to about 20 km/h,
   * where the legs can no longer keep up with the skis and the arms take
   * the whole of the work. */
  skateFrom: 5.5,
  skateTo: 9,
  /** Under `strideTo` m/s he STRIDES (the diagonal stride), all of it
   * under `strideFrom`: a V taken at a walk goes nowhere, and a skier
   * setting off or climbing a rise walks his skis forward. */
  strideFrom: 1.6,
  strideTo: 3,
  /** THE SKATE'S V, each ski off his line, rad: at a walk (`strideFrom`)
   * and by `skateTo` — measured skating holds some 14° a ski at 3 m/s
   * (19° in the asymmetric skate a skier climbs in, 45° and more slow up
   * a steep rise), and the V closes as the speed comes up. He rides the
   * gliding ski's arm of it (`glideYaw`). */
  vee: { slow: 0.36, fast: 0.2 },
  /** The drive under which he does not skate at all (`skateWork`): a
   * skier half working — the brake held, an edge on — pushes on his
   * poles with his skis together. */
  skateDrive: 0.4,
  /** THE DRIVE IS FOR A STRAIGHT: a skier works on the flat and down the
   * run-out, not with his skis on edge in a bend — the edge asked past
   * `edgeFrom` of full takes it away by `edgeGone`. */
  edgeFrom: 0.25,
  edgeGone: 0.6,
  /** THE STEP TURN (`poles.ts`'s `stepWork`): a skier at a crawl STEPS
   * his skis round a turn, pushing all the way, rather than wait on a
   * sidecut whose arc at a walk is fifteen metres and more. Each stride
   * turns his heading `step` rad (a step turn's steps are 15–30° each, a
   * skate turn's push-and-step 30–45° at a crawl), the V leads the
   * heading into it by `lead` rad (its inside arm stepped out ahead of
   * the line he is on), a turn is taken up and let go at `rate` a second
   * — a stride or so — and the skis stand on `edge` less of the speed's
   * lock while he can step (some 22° rather than 55°: an edge to push off
   * and to lean the turn's load on, not a carve); at a walk his strides
   * come `quick` quicker than going straight (a step turn is short quick
   * steps, not a skater's long glide; rolling, he turns on the skate's
   * own cadence). So from a crawl to 27 km/h he comes round 90° in some
   * two seconds, on a few metres, faster out of it than into it. */
  turn: { step: 0.7, lead: 0.25, rate: 3, edge: 0.6, quick: 0.35 },
  /** THE STEP TURN ON THE SPOT (`stepRound`): stood still with only a
   * steer held, a skier is not going anywhere — he STEPS HIS SKIS ROUND,
   * the inside ski's tip lifted and set down `angle` rad further round,
   * its tail where it was (the star turn every beginner is taught on the
   * flat), then the outside ski lifted and brought alongside it; `steps`
   * such pairs a second. Measured stepping round on skis takes 15–30° a
   * step at one to two steps a second, so a right angle is three or four
   * pairs: about 25° at 1.2 a second — some 30°/s. A pair begun is
   * finished, and set down together. */
  pivot: { angle: 0.44, steps: 1.2 },
  /** The share of the push left in powder — the baskets sink and a
   * skating ski has nothing to push off. */
  powderShare: 0.4,
  /** Strides a second: THE SKATE'S — one leg's push and the long glide
   * on the other ski (`strideRate`), measured at 0.85 a second at 3.5
   * m/s rising to 1.3 by 6.3 (a skater lengthens his glide first and
   * quickens only toward his top speed) — and the slowest a double pole
   * is worked; the share of each stride the push is on (measured: the
   * leg's push 0.42–0.5 s of a stroke), the rest the glide and the
   * recovery (a rest level of `floor` of the mean between); and the
   * least share of a skate stride the poles bite for (`poleDuty` —
   * measured 0.34 s slow to 0.22 s fast, a quarter of a stroke). */
  cadence: { slow: 0.85, fast: 1.3, from: 3.5, to: 6.3 },
  /** UP A RISE THE GLIDE IS SHORT (`skateCadence`): a skater pushes again
   * once the gliding ski has slowed by as much as it does over a flat
   * stride's glide, and up a rise gravity's pull along his skis, g·sin θ,
   * is added to the glide's own slowing — the base's rolling resistance
   * (`snow.crrPacked`) and the air's on a skier stood up (`area` m² of
   * him at `mass` kg). So the glide is cut by the flat's deceleration over
   * the climb's, the leg's push keeps its time, and the strides come
   * quicker the steeper it is — measured, a skater's cycle rate rises and
   * his cycle shortens with the incline at the same speed, and the share
   * of the cycle he spends pushing grows (some 0.85 cycles a second, two
   * strides each, in the offset skate up a steep climb). `most` strides a
   * second is the quickest a skater's legs turn over (a cycle a second);
   * `duty` the most of a stride the leg's push may fill. */
  climb: { area: 0.55, mass: 78, most: 2, duty: 0.72 },
  cadencePole: 1.05,
  duty: 0.45,
  floor: 0.3,
  dutyLeast: 0.2,
  /** How far he goes past a planted basket over one push, m — the pole's
   * sweep from its plant to its release behind him, double-poling and
   * skating (the pose's own strokes sweep 1.55 and 1.19 m; less here, so
   * a push ends before the last of the arm's reach, where the basket
   * hardly moves for all the arm it takes). A push is never longer than
   * the snow takes to pass under it (`strideRate`). */
  sweep: 1.35,
  sweepSkate: 1,
  /** The quickest he works the poles, strides a second — a double pole
   * at its most driven: past the 1.3 a second measured of an elite
   * double-poler at 80 poles a minute, an arcade skier's quick arms, but
   * no quicker than a stroke a body can swing smoothly (faster, the swing
   * whips the baskets through and he double-poles on at 55 km/h where a
   * racer tucks; at this one he gives it up past some 40 km/h) —
   * and the shares of the snow going by under one
   * push that a push at that cadence still sweeps where he starts to
   * give up poling for the tuck, and where he has (the arm reaches past
   * `sweep`, so he keeps up with somewhat more than it). */
  cadenceMax: 1.8,
  keepUp: { from: 0.95, to: 0.8 },
  /** The least share of a double pole's stroke the poles are on the snow
   * (`doublePoleDuty`): measured, a double-poler driving his cadence up
   * shortens his poling time to some 0.2 s of a stroke of 0.7–0.8 s. */
  jab: 0.25,
  /** How fast the drive the body shows comes and goes, 1/s. */
  rate: 4,
  /** WITHOUT POLES (`SkierState.poles` off — the player's hard mode):
   *   - `legs`: the share of the push's power and a plant's press his
   *     legs make alone. Measured skating, the arms put a third and more
   *     of the propulsive power into the snow, and all of a double pole
   *     — so with none he skates at every speed (`skateShare`) on 0.6 of
   *     it;
   *   - `climb`: up a rise, the pair's pitch, rad, from which a push with
   *     no basket to brace it slips back (2°), and by which only `least`
   *     of it holds (10°, `climbShare`) — the herringbone's grip without
   *     the arms behind it;
   *   - `balance`: the share of his resilience (`SkierState.resilience`)
   *     he keeps — poles are a skier's outriggers, a touch on the snow
   *     that catches a lurch, and without them a professional falls where
   *     a skier halfway to the club skier does (`crash.ts`'s
   *     `crashLimit`);
   *   - `rock`: the share of a bog's rocking that packs the hole back
   *     (`trench.ts`) with no poles to lever himself on. */
  bare: {
    legs: 0.6,
    climb: { from: 0.035, to: 0.17, least: 0.15 },
    balance: 0.5,
    rock: 0.45,
  },
} as const;
