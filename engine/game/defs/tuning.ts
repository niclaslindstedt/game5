// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Global tuning — the numbers that shape the FEEL, shared by every pair of
// skis (the pair's own numbers live in `defs/skis.ts`). Grouped by subject:
// the clock, the air, the SNOW (how far it lets a ski sink and what it
// costs to push through it), GRIP, the EDGE and the SKID, the SKIER's body,
// the POLES, the AIR, the HULL contacts, the trees, the course and the
// reset. Every number carries its unit; every model it feeds names its
// source at the function that implements it. Tweak here, verify with
// `npm run ride` and `npm run sim`; the render layer never reads these.
// The score and the strokes are stated next door (`defs/tricks.ts`) and
// folded in as `TUNING.tricks`.

import { TRICKS } from "./tricks.ts";

/** The clock the whole engine runs on. Named out here so the timestep is
 * derived from it rather than restated. */
const PHYSICS_HZ = 120;

export const TUNING = {
  /** HOW OFTEN THE WORLD IS SOLVED, steps a second. The legs are a set of
   * penalty springs holding ninety kilos on centimetres of sag, and the
   * stops are stiffer again; 120 Hz follows both. The bot decides on every
   * step too. */
  physicsHz: PHYSICS_HZ,
  /** ...and the same number as the timestep, s. Derived, never authored. */
  dt: 1 / PHYSICS_HZ,

  /** Standard gravity, m/s². */
  g: 9.81,

  /** THE AIR: density at −8 °C at two thousand metres up, kg/m³ (ISA). */
  airDensity: 1.05,

  /** THE SNOW — a ski's water. Powder lets a ski SINK, and how far is a
   * function of speed exactly as a planing hull's draft is: at rest the ski
   * is buried to the boot, and with speed the pressure under it climbs and
   * it floats up onto the top. `snow.ts` owns the model. */
  snow: {
    /** How deep a standing skier sinks into untouched powder, m — a pair
     * of skis on 40 cm of fresh snow buries them to the boot tops. */
    powderSink: 0.22,
    /** ...and into a groomed piste, m: a centimetre of corduroy pressed. */
    packedSink: 0.012,
    /** THE NEW SNOW a fall lays (`snowfall.ts`): how fast it builds at a
     * fall of 1, m/s — a blizzard's 8 cm an hour, the far end of what a
     * real one lays — and how deep a layer buries the groomer's feel
     * outright, m: a hand's depth of new snow and the piste is half powder. */
    freshRate: 0.08 / 3600,
    freshBury: 0.18,
    /** THE PLANING SPEED, m/s: sink falls as exp(−(v / planeSpeed)²), so
     * at this speed a ski carries a third of its rest sink and by 30 km/h
     * it rides a few centimetres into the powder — the moment a skier feels
     * the tips come up. */
    planeSpeed: 6,
    /** How quickly the support under a ski follows the sink the speed asks
     * for, s (a skier slowing in powder settles, he does not drop). */
    sinkLag: 0.25,
    /** The tip and the tail sink less than the mid station for the load
     * they carry: the ski is a beam, and its ends ride up. */
    endSink: 0.7,
    /** ROLLING RESISTANCE, as a share of the load on each station: the
     * base's friction on a groomed surface (0.03–0.05 on cold hard snow),
     * and in powder. */
    crrPacked: 0.035,
    crrPowder: 0.07,
    /** THE PLOUGH: the snow a sunk tip shoves aside, N per metre of ski
     * width per metre of sink per (m/s)² — the bow wave of a displacement
     * hull, and why a skier bogged in powder wants momentum. */
    plough: 70,
    /** POWDER DRAG: what compacting fresh snow costs at speed, as a share
     * of the station's load per m/s — gone on packed snow. Set so the
     * all-mountain ski runs about three quarters of its piste speed in
     * powder once it is planing (the powder ski more, the race skis less). */
    powderDrag: 0.004,
    /** How deep the loose snow lies at the ordinary snow (dial 1), m: 40 cm
     * of powder over a settled base, which a standing skier's skis press a
     * little over half the way down. The start card's figures are this
     * times the dial. */
    cover: 0.4,
    /** DEEP SNOW (`snow.ts`'s header): what grows past the ordinary depth,
     * by the BOTTOMLESS share (`bottomlessOf`). */
    deep: {
      /** The dial at which the powder is bottomless: a metre of fresh snow
       * (`cover` × 2.5), the usual depth of a maritime winter by March. */
      full: 2.5,
      /** THE SNOW GIVES: the exponent on the load a ski carries over its
       * rest load, (L / L₀)^give, at full depth — and the most load it is
       * read at, as a multiple of the rest. */
      give: 0.8,
      loadMax: 2.5,
      /** ...and the deepest it gives to, as a share of the loose layer
       * (`cover` × the dial): the whole of it pressed to the density a
       * ski's few kPa leave it at. */
      compact: 0.72,
      /** IT STAYS PRESSED: the speed along the snow, m/s, at which a ski
       * rides wholly on snow nobody has pressed — below it, a sink only
       * comes back up that share as fast. */
      settle: 2,
      /** IT PLANES LATER: the planing speed goes as the dial to this power
       * past the ordinary snow. */
      plane: 0.1,
      /** THE BODY PLOUGHS: once a skier has sunk past his boots the shins
       * and the knees shove snow as the tips do (`bellyPlough`), at this
       * share of the plough's own law, and the deepest it is read at, m. */
      belly: 0.5,
      bellyMax: 0.5,
    },
  },

  /** THE FOOTPRINT — how much each pair's own skis are worth against the
   * reference's (`footprint.ts`; the all-mountain ski reads 1 on every one). */
  footprint: {
    /** The rest sink goes as the ground pressure to this power: a sink is
     * the snow compacted until it carries the load, and fresh snow stiffens
     * as it packs, so halving the pressure takes off less than half. */
    floatExp: 0.8,
    /** The edge's hold on packed snow goes as the ski's stiffness: a stiff
     * ski holds its whole length on the edge, a soft one only the middle —
     * `1 + edgeFlex · (flex − flex₀)`. */
    edgeFlex: 0.5,
    /** ...and as the INVERSE rocker: a rockered tip holds no edge on the
     * groomer, `1 − edgeRocker · (rocker − rocker₀)`. */
    edgeRocker: 0.35,
    /** The base's hold in powder goes as the waist to this power: a wide
     * ski steers on its float. */
    baseFloat: 0.8,
    /** The rocker's help in powder: a lifted tip planes sooner and turns
     * on its base, `1 + rockerFloat · (rocker − rocker₀)`. */
    rockerFloat: 0.3,
    /** How much longer a stiff long ski takes onto its edge, and how much
     * quicker a short soft one is: the edge rate goes as the inverse of
     * `(L / L₀) · (W / W₀)^waistRate · (1 + flexRate · (flex − flex₀))` —
     * the waist because the boot stands that much further from the edge it
     * is tipped onto. */
    flexRate: 0.4,
    waistRate: 0.5,
    /** A soft ski lands softer: the harsh speed goes as
     * `1 + flexHarsh · (flex₀ − flex)`. */
    flexHarsh: 0.25,
  },

  /** GRIP — the friction coefficients between the skis and the snow, each
   * a peak reached over its reference slip speed (a `tanh` curve, which is
   * how an edge lets go: progressively, then all at once past it). */
  grip: {
    /** THE EDGE holding sideways on packed snow — the coefficient a sharp
     * steel edge bites a groomed surface with — and the share of it a ski
     * lying FLAT still has (a flat ski slides; the rest comes with the
     * edge angle, `skier.ts`). */
    edgePacked: 0.95,
    flatShare: 0.3,
    /** ...and in powder, where the edge is buried and the ski turns on its
     * BASE: what the base holds sideways, as a coefficient on the load. */
    basePowder: 0.45,
    /** The slip speed across the ski at which the sideways grip is 76 %
     * developed, m/s. */
    sideRef: 0.4,
    /** THE SKID SCRAPES: a ski pivoted across the way and shoved sideways
     * is sliding on its edge, not cutting a groove with it, and sliding
     * friction is less than the bite — this share of the edge's hold is
     * what a fully skidding ski keeps (blended by `SkierState.skid`). */
    skidHold: 0.5,
    /** BLUE ICE (a frozen tarn's, `Level.iceAt`, and the icy patches a
     * region's crust carries): the share of the groomer's grip an edge has
     * left on bare ice — a sharp edge scratches a line and little more. */
    ice: { edge: 0.35, base: 0.35 },
  },

  /** THE EDGE AND THE SKID — how the skis are steered. */
  steer: {
    /** How the edge fades with speed: the full `edgeMax` at a standstill,
     * two thirds of it by `fadeSpeed` m/s — a skier at a schuss stands his
     * skis flatter than one snaking a nursery slope. */
    fadeSpeed: 25,
    /** How fast the skis can be rolled from edge to edge on the reference
     * pair, rad/s (`footprint.ts` scales it by the length and the flex). */
    edgeRate: 3.4,
    /** THE ARCADE'S HAND ON THE YAW — which models nothing. On the snow the
     * yaw rate is held toward the one the edge's own geometry asks for (the
     * way, times the carve's curvature) but no faster than `pathShare` of
     * the corner grip can turn the way itself, with `yawHold` N·m per rad/s;
     * and the nose is held to the way the skier is going, `slipHold` N·m per
     * rad of slide once he is going faster than `slipFrom` m/s; the two
     * together no more than `yawHoldMax` N·m. Zero is the bare physics. */
    yawHold: 1600,
    slipHold: 1100,
    yawHoldMax: 1000,
    pathShare: 0.9,
    slipFrom: 3,
    /** THE SCRUB: an edge holding a skier round a carve is cutting a
     * groove, and a skier laid over hard is cutting one under both skis —
     * a drag against the travel of this share of the bend's own
     * acceleration (the rate the edge asks for, times the way), on the
     * packed share of the snow; powder charges for its own shoving through
     * the plough. Why a bend taken flat out costs the way rather than
     * being free — but only a little of it: this is a FAST game, and a
     * clean carve at 90 km/h in a tuck gathers speed down a red pitch
     * rather than bleeding it. */
    scrub: 0.12,
    /** THE TIP LOADED: a lean forward loads the tips and tightens the
     * carve, a lean back lets it run — this share of the curvature per
     * unit of lean. */
    tipLoad: 0.25,
    /** THE SKID (the brake): the skis pivoted across the way by up to
     * `skidAngle` rad at a crawl (a snowplough's 60°), fading toward
     * `skidFast` by `skidFadeSpeed` m/s (a hockey stop at speed is a
     * narrower angle held harder), and the drag a skidding ski pays per
     * unit of brake as a share of its load — the snow it shoves sideways
     * (a snowplough alone is 0.35 g, which brings a skier down toward a
     * walk on a 20° groomer; a real hockey stop pulls about 0.5–0.8 g,
     * and the pivoted edges scraping on `grip.skidHold` add their share on
     * top of this). The pivot is only thrown by the back key pressed FIRST
     * (`input-model.ts`): the same key pressed with an edge on is the edge
     * cut harder (`carve`), which costs nearly nothing. */
    skidAngle: 1.05,
    skidFast: 0.5,
    skidFadeSpeed: 20,
    skidDrag: 0.35,
    /** How fast the skis pivot into and out of a skid, rad/s. */
    skidRate: 4,
  },

  /** THE ARCADE'S HANDS — dials that model nothing, stated as such, and the
   * reason the game FEELS like skiing rather than measuring like it. Each is
   * a multiplier on a measured quantity, so 1 is the bare physics and the
   * distance from 1 is how far the game leans on the skier's side. A real
   * carve on a groomed piste pulls 1–2 g; a racer at the arcade's pace
   * wants a little more than that and never a caught edge. */
  arcade: {
    /** Every SIDEWAYS grip on the snow — the edges and the bases, on the
     * groomer and in powder alike. */
    sideGrip: 1.3,
    /** The tipping point: the inclination the skier holds into a turn is
     * worth this many times its own tangent, which is what lets a skier
     * carry the grip above without being thrown over the outside ski. Read
     * by `tipLimit`, and by the roll the skier holds (`skier.rollMax`,
     * scaled). */
    hangOff: 1.4,
  },

  /** THE SKIER — the body on the skis is nine tenths of the moving mass,
   * and moving it is how skis are skied. */
  skier: {
    /** The body's lag behind the edge and the lean, s. */
    lag: 0.16,
    /** How far fore and aft the lean moves the hips, m. */
    aftReach: 0.25,
    /** THE ANGULATION FOLLOWS THE TURN: on packed snow the hips go inside
     * as far as the edge sends them only once the bend it asks for pulls
     * this many g; under it, that share of the way. */
    hangG: 0.35,
    /** THE INCLINATION INTO A TURN: the most the whole rolls into a carve,
     * rad — on packed snow, where the bend's own load asks for it (a
     * bicycle's lean, atan(v²κ / g)) and this is the cap, 40°, the whole
     * body of a strong carver laid over (a racer goes past 60°); and in
     * powder, where the roll is the whole of how a ski turns. Read by
     * `tipLimit` too. */
    rollPacked: 0.7,
    rollPowder: 0.5,
    /** The righting the skier and his legs together hold that roll with,
     * N·m per rad, the damping on the roll rate, N·m·s, and the most it can
     * ever be, N·m — a load past this puts him over. */
    rollStiff: 5000,
    rollDamp: 380,
    rollMax: 900,
    /** THE FORE-AFT BALANCE: a skier stands over his skis whatever the snow
     * does under his feet — his boots and his legs hold the body square to
     * the slope, and he sits back into a skid rather than going over the
     * tips (a skid at 0.9 g at the feet is 700 N·m over the tips). Held
     * toward the lean the thumb asks (`leanPitch` rad tips-up at full lean
     * back), N·m per rad off it, with a damping on the pitch rate, N·m·s,
     * and never more than `pitchMax` N·m — on the snow only; in the air
     * the lean is the pitch lever outright (`flight.ts`). */
    pitchStiff: 4000,
    pitchDamp: 300,
    pitchMax: 1500,
    leanPitch: 0.2,
    /** THE CARVE IN POWDER: a ski rolled over in powder turns toward the
     * low side, as a share of the ski's load per radian of roll. It needs
     * way on, reached by `carveSpeed` m/s. */
    carve: 1.2,
    carveSpeed: 4,
    /** DEEP POWDER (`snow.ts`'s header): the share of the roll held
     * (`rollStiff`, `rollMax`) that the buried edges gave and deep snow
     * takes away; the moment THE SOFT SIDE GIVES, as a share of the whole's
     * weight at its CoG height per radian of roll off the snow's plane; and
     * the share of both left once the skis plane on top rather than sit
     * down in it. */
    deepHold: 0.7,
    deepTip: 2,
    deepPlaning: 0.5,
    /** ...and the pace the soft side's give comes in over, m/s. */
    deepTipFrom: 1.5,
    deepTipFull: 4,
    /** THE TUCK: how fast the body folds toward the crouch the tuck asks
     * for and stands back up, 1/s — and the least of the way (m/s) a tuck
     * counts for anything: a skier at rest crouching is not going faster. */
    crouchRate: 3,
    /** THE START OF A HIGH-SIDE: the sideways slip at a contact, m/s,
     * past which an edge standing more than `slipEdge` rad over is in
     * trouble — the bot stands his edge down past it; what actually
     * throws a skier is `crash.catchSlip` / `.catchEdge`, well beyond. */
    slipSpeed: 6,
    slipEdge: 0.75,
  },

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
  poles: {
    /** The speed, m/s, under which the push is its whole, and the speed by
     * which the legs and the arms can no longer keep up and it is gone: 22
     * and 34 km/h — a racer skates out of the gate and keeps skating on a
     * flat to hold his speed, and the power law (below) is what makes the
     * last of it little. */
    speed: 6,
    fade: 9.5,
    /** The mean propulsive power, W — a fit recreational skier's sprint
     * (an elite cross-country skier holds over 400 W for minutes). */
    power: 450,
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
    /** THE DRIVE IS FOR A STRAIGHT: a skier works on the flat and down the
     * run-out, not with his skis on edge in a bend — the edge asked past
     * `edgeFrom` of full takes it away by `edgeGone`. */
    edgeFrom: 0.25,
    edgeGone: 0.6,
    /** The share of the push left in powder — the baskets sink and a
     * skating ski has nothing to push off. */
    powderShare: 0.4,
    /** Strides a second: a skate stride each leg at a crawl, a double
     * pole a second faster — and the share of each cycle the push is on,
     * the rest the recovery (a rest level of `floor` of the mean between). */
    cadence: 1.3,
    cadencePole: 1.05,
    duty: 0.45,
    floor: 0.3,
    /** How far he goes past a planted basket over one push, m — the pole's
     * sweep from its plant to its release behind him, double-poling and
     * skating (the pose's own strokes sweep 1.55 and 1.19 m; less here, so
     * a push ends before the last of the arm's reach, where the basket
     * hardly moves for all the arm it takes). A push is never longer than
     * the snow takes to pass under it (`strideRate`). */
    sweep: 1.35,
    sweepSkate: 1,
    /** The quickest he works the poles, strides a second — a double pole
     * at its most driven — and the shares of the snow going by under one
     * push that a push at that cadence still sweeps where he starts to
     * give up poling for the tuck, and where he has (the arm reaches past
     * `sweep`, so he keeps up with somewhat more than it). */
    cadenceMax: 2,
    keepUp: { from: 0.85, to: 0.6 },
    /** How fast the drive the body shows comes and goes, 1/s. */
    rate: 4,
  },

  /** THE JUMP (`skier.ts`): the skier sinks and loads his legs while the
   * jump is held on the snow and springs off them when it is let go — an
   * OLLIE, straight up off the snow's own normal. The pop is `popMin` m/s
   * for a tap, rising with the time held to `popMax` at `full` s; held
   * longer is no higher. At the race's flight gravity the full pop stands
   * him about a metre off the snow; a tap hops a boot's height. How deep
   * the load folds him, as a crouch. */
  jump: {
    popMin: 2.2,
    popMax: 6,
    full: 2,
    crouch: 0.75,
  },

  /** CUTTING HARDER (`skier.ts`): the back key thrown with an edge already
   * on — the skis stood further over and pressed into the groove, so the
   * line tightens rather than slows. The extra share of the edge's lock,
   * the most edge it reaches, the tighter curvature, the extra grip the
   * pressed edge holds, and the share of the groove's scrub it spares. */
  carve: {
    edge: 0.45,
    tighten: 0.35,
    grip: 0.3,
    scrubSpared: 0.6,
  },

  /** THE AIR — what the skier can still do once the snow has let go of him
   * (`flight.ts`). */
  air: {
    /** ARCADE GRAVITY IN FLIGHT, as a multiple of `g` — models nothing,
     * and says so. At the real 9.81 a kicker taken at race speed hangs a
     * skier 6 m up for 2 s, and a hang that long on a chase camera reads
     * as slow motion rather than weight. Only a skier genuinely FLYING
     * feels it — no ski and no body point on the snow since the step
     * before — so the ground holds him over a roller at exactly the real g
     * and where he leaves the snow is a fact about the shape and the speed;
     * what this sets is how soon the air gives him back. The bot's
     * ballistics read it through `limits.ts`'s `flightGravity`. */
    gravity: 1.5,
    /** The lean's pitch authority, N·m at full lean (back = tips up):
     * 2.0 rad/s² on the reference pair's 26 kg·m² of pitch — enough to
     * trim a landing, not to turn a flip (that is a STROKE, `strokes.ts`,
     * and only on a tricks run). */
    leanTorque: 53,
    /** The edge in the air: a little yaw, N·m at full lock — the skis
     * swung across. */
    steerTorque: 6,
    /** Rotational damping in the air, N·m·s per rad/s: about the pitch
     * and the roll axes (a five-second decay on the reference pair), and
     * about the up axis — a skier is a tall body and a short one across,
     * so his yaw is a third of his pitch to turn and the same drag would
     * stop a 360 in half a second. */
    damping: 6,
    yawDamping: 1.8,
    /** THE SKIER'S BODY ENGLISH ON THE ROLL: nothing in the controls rolls
     * a skier in the air, so he levels himself, N·m per rad of roll off
     * level, with a damping on the roll rate, N·m·s. */
    rollLevel: 320,
    rollDamp: 55,
    /** ...up to this roll off level, rad, fading out over the last 0.3. */
    rollGiveUp: 1.1,
    /** THE ARCADE'S HAND ON THE PITCH (`flight.ts`): with the lean left
     * alone the body eases the tips toward half the flight path, never more
     * than `pitchAim` rad either way, at `pitchLevel` N·m per rad off it and
     * never past `pitchLevelMax` N·m — both on the reference pair, scaled
     * by each one's pitch inertia — under two thirds of the lean's
     * authority, and not once he is `pitchGiveUp` rad off. */
    pitchLevel: 46,
    pitchLevelMax: 28,
    pitchAim: 0.35,
    pitchGiveUp: 1.0,
    /** The yaw rate, rad/s, past which a flying skier is SPINNING and the
     * roll's and the pitch's levelling are let go (`flight.ts`) — a 360
     * turns at about 4; the edge's own little yaw never nears 1. */
    spinLevel: 2,
    /** ...and over the last this many seconds before the snow comes back
     * (`flight.ts`'s `landingAhead`), s, the skis are eased from half the
     * flight path onto the slope they will land on instead. */
    landLook: 0.8,
    /** How long off the snow before it counts as air, s — anything shorter
     * is a skier skipping over a bump. */
    counts: 0.15,
    /** A LANDING: the speed INTO the slope, m/s, past which the legs cannot
     * take it all and the skier pays for it — a share of his way per m/s
     * over, up to `harshMax`. */
    harshSpeed: 8,
    harshLoss: 0.02,
    harshMax: 0.12,
  },

  /** THE LANDING'S LOAD (`flight.ts`'s `landingLoad`) — how hard the snow
   * takes a skier back, and how true he has to come down to ride it away.
   *
   * THE IMPACT is the EQUIVALENT FALL HEIGHT, the snow-park engineers'
   * measure of a landing: the speed into the slope as a drop from rest,
   * EFH = v⊥² / 2g. Jump designers hold the sweet spot of a landing to
   * 0.1–0.9 m and call past 1.5 m a hard one; measured tables run to 3–5 m
   * off the sweet spot, and hard snow lands about a third harder than soft
   * at the same spot. The legs and the snow stop that fall over a STROKE —
   * the hips sinking from the stance into a squat, `stroke` m (less the
   * share of it a tuck has already spent, `tuckStroke`), plus the snow
   * pressed under the skis: `give` of whatever loose snow lies there (40 cm
   * of powder takes a quarter of a metre, a metre of it most of the fall) —
   * so the load is 1 + EFH / stroke g. */
  landing: {
    stroke: 0.45,
    tuckStroke: 0.25,
    give: 0.6,
    /** THE LOAD A LANDING MAY CARRY: under `clean` g a landing is judged
     * only as the tips' dig is (`crash.noseAngle`), and past `buckle` g the
     * legs fold however true it was — a flat landing off a big air. */
    clean: 6,
    buckle: 14,
    /** HOW TRUE HE MUST COME DOWN: the most the skis may be off the slope
     * they land on, rad — the tips down into it, the tails first, rolled
     * across it, and sideways to the way he is going — at a landing under
     * `clean` g, shrinking to `tight` of it at `buckle`. The bigger the
     * landing, the more perfect it must be. */
    tipsDown: 0.5,
    tailsDown: 0.8,
    rolled: 0.6,
    sideways: 0.9,
    tight: 0.2,
    /** ...and under `clean` g more forgiving still, to `1 + slack` of it
     * at a hop that loads him no more than standing. */
    slack: 1,
    /** Only a landing that ends a real flight is judged, s in the air. */
    air: 0.3,
  },

  /** THE HULL: points on the body — the hips, the shoulders, the helmet,
   * the knees — and the skis' tips and tails that meet the snow when the
   * legs are not what is touching it: a tail dragged over a crest, a skier
   * on his side, one on his back. Resolved as impulses (`chassis.ts`). */
  hull: {
    /** Share of the speed into the snow a hull point gets back. */
    restitution: 0.1,
    /** Friction of a body sliding on snow. */
    friction: 0.4,
    /** How fast a point already under the snow is pushed back out, 1/s of
     * its depth, and the most that push may be worth, m/s. */
    pushRate: 10,
    pushOut: 1.5,
  },

  /** THE TREES — trunks are cylinders (`collision.ts`). */
  trees: {
    /** The skier's plan footprint as three circles down the skis' length,
     * of this radius, m. */
    bodyRadius: 0.35,
    /** How much of the closing speed comes back, and how much of the speed
     * ALONG the trunk a glancing blow scrubs off. */
    restitution: 0.15,
    scrub: 0.35,
    /** A hit is reported at this closing speed, m/s, at most once per
     * `cooldown` s. */
    hitSpeed: 1.5,
    cooldown: 0.6,
    /** Spatial hash cell for the trunks, m. */
    cell: 12,
  },

  /** THE MAP'S EDGE: the skier is turned back this far inside it, m, by a
   * push that grows over `soft` m. */
  bounds: { margin: 6, soft: 20, push: 12 },

  /** THE COURSE. */
  course: {
    /** Metres either side of a gate's visible width that still count — the
     * benefit of the doubt at gate range. */
    grace: 2,
    /** ...and the START GATE's crossing, m more still: a field jostling off
     * the start line has still started the run if it swings wide. */
    startGrace: 10,
    /** A crossing of the owed gate's line this far past its edge (beyond
     * the grace), m, is that gate skied past, and flagged at once. */
    missReach: 25,
    /** A SLALOM GATE skied past (R28) costs this on the clock, s, and the
     * run goes on — an arcade racer's penalty, never a climb back. */
    missPenalty: 3,
    /** A reset stands the skier this far PAST the last gate he took, m (or
     * this far short of the start gate before he has taken one). */
    resetAhead: 3,
    /** A FREE RIDE's reset within this far of the foot of the run he is
     * nearest — the finish line and its arena, where nothing is left to
     * ski — is the lift back up: the start line, m. */
    footReach: 30,
  },

  /** THE WIPEOUT — the skier thrown (`crash.ts`). Four ways off, each a
   * threshold no clean run comes near. */
  crash: {
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
    /** How long he lies before the reset stands him up, s: at least
     * `lieMin` off the skis and `lieStill` lain still (under `restSpeed`
     * m/s, on the snow) — the beat the death cam rises over him on — and
     * never past `lieMax`. */
    lieMin: 1.8,
    restSpeed: 0.6,
    lieStill: 1,
    lieMax: 6.5,
  },

  /** BOGGED IN DEEP POWDER (`trench.ts`). A skier stopped in deep snow
   * sinks to his knees; the way out is to pole (the tuck held) and rock —
   * the weight thrown fore and aft, side to side — or the reset. */
  trench: {
    /** Seconds BOGGED before he starts to sink — the tuck held (poling) in
     * powder under `creep` m/s along the skis. */
    after: 1,
    /** How fast he sinks, m/s, and the deepest he gets, m, on top of the
     * sink. */
    dig: 0.1,
    max: 0.25,
    /** The share of the poles' push lost at the deepest. */
    grip: 0.75,
    /** ROCKING OUT: snow packed back per metre the skier's weight moves
     * (`hipAft`, `hipRight`), m/m — and cleared as the skis move out of the
     * hole, m per m of way past `creep` m/s. */
    rock: 0.04,
    clear: 0.4,
    creep: 1,
    /** Past this depth he is bogged and `stuck` fires, m. From its first
     * centimetre the automatic reset waits `holdFor` s instead of
     * `reset.stuckFor`, so the skier has the time to work out. */
    stuckAt: 0.05,
    holdFor: 8,
  },

  /** DAMAGE (`damage.ts`) — only on a run that asked for it. */
  damage: {
    /** A trunk dulls the edge on its side past this closing speed, m/s, by
     * `treeRate` per m/s over. */
    treeFrom: 4,
    treeRate: 0.06,
    /** A harsh landing hurts the legs by `landRate` per m/s past the pair's
     * harsh speed. */
    landRate: 0.05,
    /** A wipeout's own share, on the parts its cause reaches. */
    wipeout: 0.2,
    /** Below this much in one blow nothing is reported. */
    report: 0.04,
    /** A DULLED EDGE: the pull it puts on the line at fully dulled, rad
     * toward its own side, and the share of its bite lost. */
    skiToe: 0.06,
    skiGrip: 0.4,
    /** HURT LEGS: the shares of the legs' rate, damping and harsh speed lost
     * at fully hurt. */
    springSoft: 0.4,
    dampSoft: 0.5,
    harshSoft: 0.45,
  },

  /** THE AUTOMATIC RESET. */
  reset: {
    /** Seconds on his side or back before the skier is put back. He counts
     * as over when his up axis is below this share of vertical. */
    overFor: 3,
    overUp: 0.25,
    /** Seconds held poling (the tuck) going nowhere before he is put back,
     * and what "nowhere" is, m/s. */
    stuckFor: 3,
    stuckSpeed: 0.6,
  },

  /** THE WIND TUNNEL (R30, `wind-tunnel.ts`): a horizontal lift along the
   * hub that blows a skier from its entrance to its exit without his
   * skiing. The air inside moves along it at the tunnel's own speed, so the
   * drag a skier feels there is against THAT air — it pushes him on while
   * he is slower, and costs him nothing once he rides at its speed — and
   * the blowers THRUST him along over it: `thrust` m/s² while he is
   * `soft` m/s or more under the wind's speed, easing to nothing at it
   * (and a quarter of it back past it), so a skier stood at the entrance
   * is at the wind's speed in a few seconds. Across it he is CENTRED,
   * `centre` m/s² a metre off its line, `damp` /s of his sideways way
   * taken out. He is taken in where he stands inside its width with his
   * skis within `capture` rad of the way it blows — a skier crossing it
   * is not — and let go `release` m past its edge, at its exit with his
   * way kept, or thrown. */
  tunnel: {
    thrust: 9,
    soft: 4,
    back: 0.25,
    centre: 0.8,
    damp: 1.5,
    capture: 0.7,
    release: 2,
  },

  /** THE LIFT RIDE (`lift-ride.ts`; the lifts' own measure is `LIFT_LOOK`).
   * The rope's slowing into the top terminal, m/s², and its pick-up off
   * the load line, m/s²; how far down the hanger from the grip a chair's
   * rider (`seat`) and a cabin's (`cabin`) has his body's origin, m, and
   * each hanger's swinging length, m; the swing's damping, 1/s, the most
   * it swings, rad, and the kick a tower's bend in the rope gives it, rad/s
   * per unit of slope change read `bend` m either side (to `kickMost`
   * rad/s — a lurch of a few degrees); how long a chair
   * scoops a rider up, s; the way a chair stands him up with on the ramp,
   * turned `ramp` rad off the line to the up rope's side (the ramp runs
   * off on the diagonal, clear of the chairs round the wheel),
   * a cabin walks him out with, m/s, and how far short of the top the
   * cabin's door lets him out, m. THE FREE RIDE'S ARRIVAL: the chair's ride
   * starts `before` m short of its last tower, held to `rideLeast`..
   * `rideMost` m below the top; the lead gives the controls back past
   * `leadNear`..`leadFar` m down the run (as far as the spot picked) or
   * after `leadFor` s, joins the run at its nearest point `drop` m or more
   * below him (within `joinFar` m — the free ride picks a run off a chair
   * it can be joined from, a metres-off-the-spot penalty `noJoin` on any
   * other), aims `aim` m on down it, steers `steer` per rad
   * off it, pushes on the poles under `push` m/s and reads the run `window`
   * m on and `back` m back of his last place; a control past `touch` takes
   * it. */
  lift: {
    decel: 0.8,
    accel: 1.2,
    seat: 2.3,
    cabin: 3.6,
    chairHang: 2.4,
    cabinHang: 4.0,
    damp: 0.45,
    swingMost: 0.3,
    kick: 1.5,
    kickMost: 0.2,
    bend: 3,
    scoop: 0.8,
    standUp: 2.2,
    ramp: 0.55,
    walkOut: 1.5,
    door: 10,
    before: 30,
    rideLeast: 60,
    rideMost: 130,
    leadNear: 40,
    drop: 2,
    joinFar: 120,
    noJoin: 2000,
    leadFar: 90,
    leadFor: 16,
    aim: 14,
    steer: 2.2,
    push: 6,
    window: 40,
    back: 6,
    touch: 0.15,
  },

  /** THE SCORE AND THE STROKES (`defs/tricks.ts`). */
  tricks: TRICKS,
} as const;
