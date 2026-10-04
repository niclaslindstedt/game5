// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIPEOUT — the block of `TUNING` that answers to `crash.ts`: the four
// ways a skier is thrown off his skis, the save short of it, and the body
// he is thrown as. It lives beside `tuning.ts` (which it outgrew) and is
// folded in as `TUNING.crash`, which is how the whole repo spells it;
// nothing reads this module directly.

/** THE WIPEOUT — the skier thrown (`crash.ts`). Four ways off, each a
 * threshold no clean run comes near. */
export const CRASH = {
  /** THE PROFESSIONAL'S MARGIN: every threshold here is where a skier
   * who skis for a living can no longer stay on his feet — what the
   * body physically cannot stand up out of — and everything short of it
   * is ridden out, with the save shown (`SkierState.save`).
   *
   * A trunk SQUARE IN FRONT OF THE SKIS (the tips' circle) met at this
   * closing speed or more throws him, m/s (25 km/h): the trunk stops the
   * skis and he does not. A trunk BESIDE HIM — taken on the shoulder, the
   * body's or the tails' circle — throws him only at `treeShoulder`
   * (36 km/h into it): the blow knocks him aside and round, and his skis
   * are still under him to stand on. */
  treeSpeed: 7,
  treeShoulder: 10,
  /** A landing taken this far tips-down against the slope, rad, at this
   * speed into it or more, m/s, goes over the tips — the landing that
   * ends a real flight of `noseAir` s or more. The tips DIG only where
   * the snow takes them: `noseDig` (32°) in loose snow, and on the
   * groomer they slap down flat unless they come in at `noseAngle`
   * (46°), past which they spear it. */
  noseAngle: 0.8,
  noseDig: 0.56,
  noseImpact: 5,
  noseAir: 0.3,
  /** THE BODY DOWN: the hips, the shoulders or the helmet driven into
   * the snow at this speed or more, m/s (`SkierState.bodyHit` — what a
   * drop of twelve centimetres hits at) — he has come down on his side,
   * his back or his head, and no one stands up out of that. A hip
   * brushed in a deep carve slides along the snow and goes into it at a
   * fraction of this; that, and a hand put down, are saves. */
  bodySlam: 1.5,
  /** THE LEGS FOLD: a landing's load past this, g (`landingLoad`), is
   * more than a skier's legs can hold however true he came down — the
   * knees go and he sits down on the snow at speed. How true the skis
   * came down is the snow's and the body's to settle: a landing on the
   * skis is ridden away, and one on the body is `bodySlam`'s. */
  legsFold: 18,
  /** A skier going over (`reset.overUp`) at this speed or more, m/s, is
   * thrown; slower, he sits down and the reset's own clock stands him up. */
  rollSpeed: 6,
  /** ...once he has lain over ON THE SNOW (`SkierState.rolledFor`) this
   * long, s — less, and he has put a hand down and pushed himself back
   * up onto his skis. */
  rollHold: 0.35,
  /** THE CAUGHT EDGE: a ski stood this far over, rad (49°), with the
   * snow sliding across it at this speed or more, m/s (32 km/h). A pro
   * holds a skidded edge far past where the bot stands his down
   * (`skier.slipEdge` / `.slipSpeed`). Never read in a SKID: past
   * `catchSkid` of the brake's pivot (`SkierState.skid`) the slide across
   * the skis is the skier's own — a hockey stop, not a high-side. */
  catchEdge: 0.85,
  catchSlip: 9,
  catchSkid: 0.5,
  /** THE CLUB SKIER: the same thresholds for a skier of resilience 0
   * (`SkierState.resilience`) — the professional's above are 1, and a
   * skier between is the blend (`crash.ts`'s `crashLimit`). A trunk on
   * the tips at 18 km/h and on the shoulder at 22, the tips digging at
   * 25° in loose snow and 32° on the groomer, down from a body drop of
   * five centimetres, the legs folding at 10 g, a hand down held for an
   * eighth of a second, an edge caught at 40° and 22 km/h across it. */
  club: {
    treeSpeed: 5,
    treeShoulder: 6,
    noseAngle: 0.56,
    noseDig: 0.44,
    bodySlam: 1,
    legsFold: 10,
    rollHold: 0.12,
    catchEdge: 0.7,
    catchSlip: 6,
  },
  /** THE SAVE (`SkierState.save`): how near a thing came to throwing him
   * is a share of its threshold, and a save is kept from `saveFrom` of
   * one. A landing is near from `landing.clean` g toward `legsFold`, and
   * from `saveTip` rad tips-down or `saveRoll` rad rolled against the
   * slope; an edge from `saveEdge` of the edge and `saveSlip` of the
   * slide that catch it (an ordinary skidded turn is short of both); a
   * newer save takes the place of one older than `saveHold` s or nearer
   * than what is left of it. */
  saveFrom: 0.25,
  saveTip: 0.3,
  saveRoll: 0.5,
  saveEdge: 0.9,
  saveSlip: 0.7,
  saveHold: 0.5,
  /** What he leaves with: this share of his velocity before the blow, and
   * a turn at his speed over `tumbleRadius` m, no faster than `maxSpin`
   * rad/s, with `carry` of his own turning on top. */
  keep: 0.85,
  tumbleRadius: 2,
  maxSpin: 6,
  carry: 0.5,
  /** WHICH WAY HE GOES OVER, by what threw him, against the way he was
   * going: `pitch` is the share of the turn that takes his head on along
   * it (back, negative), `side` the share that takes it over to one side
   * of it, and `up` the climb he leaves with, m/s:
   *   - a TRUNK stops the skis and the man goes on over them — on, and
   *     away from the side the trunk was on;
   *   - over the TIPS, the tips dig and he is pitched over them;
   *   - a CAUGHT EDGE bites and stops the slide, and he is flung on over
   *     it the way the snow was sliding — the high-side, which on skis
   *     slid sideways is over onto his side;
   *   - a FALL AT SPEED is the skis gone from under him: down onto the
   *     side he was already lying toward, barely off the snow;
   *   - a LANDING the legs could not hold sits him down BACK and to the
   *     side, the commonest fall there is.
   * A sideways fall turns at least `topple` rad/s whatever his speed —
   * the turn of a man of his height going over from his feet. */
  over: {
    tree: { pitch: 1, side: 0.25, up: 1.8 },
    nose: { pitch: 1, side: 0, up: 1.8 },
    catch: { pitch: 1, side: 0.2, up: 1.2 },
    roll: { pitch: 0.1, side: 1, up: 0.3 },
    landing: { pitch: -0.45, side: 0.8, up: 0.2 },
    // Another skier taken out: half over him, half off to the side.
    skier: { pitch: 0.6, side: 0.6, up: 1.2 },
  },
  topple: 3,
  /** THE BODY (`ragdoll.ts`): thirteen points — the hips, the shoulders,
   * the head, the knees, the feet, the elbows, the hands — held at the
   * skier's own measures (`skier-pose.ts`'s `BODY` states the same ones
   * for the figure, and `tests/crash_test.ts` holds the two together), a
   * mass on each, kg (80 in all), and a radius, m, the snow and the
   * trunks keep it out by. `radius` is the torso's. */
  body: {
    thigh: 0.44,
    shin: 0.46,
    upperArm: 0.31,
    forearm: 0.34,
    spine: 0.5,
    shoulder: 0.2,
    hip: 0.12,
    neck: 0.18,
    mass: { hip: 14, shoulder: 11, head: 5, knee: 5, foot: 4, elbow: 2, hand: 1.5 },
    head: 0.13,
    limb: 0.06,
  },
  radius: 0.11,
  /** Passes over the body's joints a step: enough that no limb is seen to
   * stretch. */
  iterations: 8,
  /** THE JOINTS a body cannot pass: the thigh `hipBack` of its length
   * behind the hip and `hipUp` above it; a hand no nearer its shoulder
   * than `foldArm` m; the knee and the elbow folded no tighter than
   * `kneeFold` and `elbowFold` rad between their two bones (35° and 30° —
   * the calf meets the thigh and the forearm the upper arm there); and
   * no limb nearer the line of the spine than `torso` m, so an arm or a
   * knee flung across him meets his chest rather than passing through. */
  hipBack: 0.35,
  hipUp: 0.3,
  foldArm: 0.2,
  kneeFold: 0.6,
  elbowFold: 0.52,
  torso: 0.16,
  /** THE BODY'S OWN TONE — a man falling is not a sack: the limbs are
   * driven toward a pose by muscle, a spring of `brace` rad/s with
   * `braceDamp` of critical damping while he is in the air (the
   * PROTECTIVE REFLEX: the hands thrown out toward the snow he is about
   * to meet at `reach` of the arm's length, the knees drawn up and bent),
   * giving way at `relax` 1/s once his trunk has met the snow to the
   * slack pose a body lies in — legs out and a little bent, arms out at
   * his sides — held at `lie` rad/s and `lieDamp`. The muscles are inside
   * the body, so they never move it as a whole: whatever push and twist
   * the drive would put on the body is taken back off it (`ragdoll.ts`),
   * and only the snow can turn him. */
  tone: {
    brace: 10,
    braceDamp: 0.8,
    lie: 2,
    lieDamp: 1.2,
    relax: 12,
    reach: 0.85,
  },
  /** THE SNOW under every point: it settles `sink` m into powder at the
   * ordinary dial (twice that at the deepest), the speed into it taken
   * away; Coulomb friction along it on the weight and on the arrival —
   * `frictionPacked` on the groomer, `frictionPowder` in fresh snow — and
   * the PLOUGH, 1/s per unit of powder depth, the share of its way a point
   * buried in fresh snow loses a second shoving it. */
  sink: 0.15,
  frictionPacked: 0.45,
  /** ...and the friction and the plough a point meets are not that
   * point's alone: what touches the snow is a patch of back, side or
   * shoulder, and this share of every point's loss is taken off the body
   * as a whole — so a hand or a head digging in slows him rather than
   * being a pivot to cartwheel over. */
  patch: 0.7,
  /** A BODY IS NOT A WHEEL: what meets the snow is a back, a side, a
   * shoulder — a broad patch, never a point to pivot over — so while his
   * trunk is on it the snow takes this share of his turning a second, on
   * top of the friction at each point. */
  spinDrag: 3,
  frictionPowder: 0.8,
  plough: 1.2,
  /** A point put back on the snow from under it keeps no more than this
   * of the push, m/s: the way out is a position corrected, not a launch,
   * and a body thrown down in deep powder starts a hand under the
   * surface it is laid on. */
  pushOut: 0.3,
  /** THE SKIS, skierless: the tip-over a landing over the tips puts into
   * them, rad/s per m/s of impact, capped. */
  skiKick: 0.35,
  skiKickMax: 5,
  /** THE SKIS LET GO (`lone-skis.ts`): each its own body once its binding
   * releases, so a pair comes apart in every fall. */
  skis: {
    /** The one under him — on the side he goes down on — is held in its
     * binding this long, s, going with his foot, before it lets go; the
     * other releases at once. Scaled by how hard the fall is. */
    hold: 0.22,
    /** ...and let go with his foot's way, no more than this off his
     * body's own, m/s. */
    fling: 1.5,
    /** The wrench each ski is let go with at full speed (`kickSpeed`,
     * m/s; less below it): turned about the snow's up, rad/s; popped up
     * off the snow, m/s; spun about its own length, rad/s; and the two
     * thrown apart across the way, m/s. Each between its `…Min` share and
     * the whole, off a hash of the moment — the two never alike. */
    kickSpeed: 15,
    yaw: 5,
    yawMin: 0.35,
    pop: 2.2,
    popMin: 0.3,
    spin: 9,
    spinMin: 0.3,
    spread: 1.2,
    /** THE SNOW UNDER A LONE SKI. Nothing bounces: the way into the snow
     * is taken and the way out of it kept no faster than `pushOut`, m/s.
     * Coulomb along its base: `base` on wax, `top` on its topsheet, and
     * `edge` across it, the steel scraping sideways. The `brake` is added
     * to both at the tail end of a ski on its base, where the brake's arms
     * drop into the snow once the boot is out — so a ski held harder at
     * the tail swings tip first down the fall line, and slides away on any
     * pitch steeper than about 9°. A ski is built to rise: it never sinks
     * into the snow, and in powder it shoves through the cover at `plough`
     * 1/s per unit of depth across, a quarter of that along — a ski
     * planes. */
    pushOut: 0.2,
    base: 0.05,
    brake: 0.22,
    top: 0.3,
    edge: 0.3,
    plough: 2,
    /** On the snow a ski on its side flops flat at this rate, 1/s; in the air its
     * spin about its length fades at `spinFade`, 1/s. */
    settle: 14,
    /** ...onto its base unless it lies further over onto its back than
     * this, the cosine of its up against the snow's taken negative (0.5:
     * 120° over): the binding stands proud of the topsheet, and a ski
     * propped on it rolls back onto its base. */
    right: 0.5,
    spinFade: 0.3,
  },
  /** How long he lies before the reset stands him up, s: at least
   * `lieMin` off the skis and `lieStill` lain still (under `restSpeed`
   * m/s, on the snow) — the beat the death cam rises over him on — and
   * never past `lieMax`. */
  lieMin: 1.8,
  restSpeed: 0.6,
  lieStill: 1,
  lieMax: 6.5,
};
