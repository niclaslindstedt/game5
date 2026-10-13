// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE — the summer free ride's machine (`docs/downhill-bike.md`):
// a long-travel dual-suspension bike of the class raced on lift-served
// courses, built only to go down. Every number carries its unit, and where it
// came from is said beside it — the class's published frame charts, set-up
// guides and measured studies, kept as the BAND they sit in and never as a
// make and model. `docs/downhill-bike.md` holds every band and its source;
// the picks here are the middles of those bands unless a line says
// otherwise.
//
// THE BODY FRAME is the engine's: x to the rider's right, y up, z forward.
// Geometry is stated from the BOTTOM BRACKET (the crank axle), the frame's
// fixed point, with the bike stood upright on flat ground and NOTHING
// compressed; the physics' body origin is the bike's own centre of mass
// (`BIKE.com`) and the rider is a second body on his own springs.

/** One end's suspension: travel m at the wheel, the share of it the rider's
 * weight settles it into at rest (sag), the progression (the rate at full
 * travel over the rate at sag), the damping ratio and the asymmetry of the
 * stroke — rebound and compression multiples of the critical-share damper,
 * and the knee past which it goes digressive, m/s. */
export type BikeEnd = {
  travel: number;
  sag: number;
  progression: number;
  zeta: number;
  rebound: number;
  bump: number;
  knee: number;
};

export const BIKE = {
  /** THE BIKE, built up with pedals: 16–18 kg across measured builds and
   * reviews; 17 kg picked. */
  mass: 17,
  /** The bike's own centre of mass from the bottom bracket, m: over it and a
   * little ahead (the fork, the front wheel and the bars), a hand's breadth
   * over the frame's lowest tube — our estimate from the parts' weights. */
  com: { x: 0, y: 0.17, z: 0.12 },
  /** THE FRAME'S INERTIA about the bike's own centre of mass, kg·m², roll
   * (about z), pitch (about x) and yaw (about y). It carries the rider's OWN
   * body about his centre too, braced on the bars and the pedals (a
   * standing adult about 10, 10 and 2 kg·m² about his own centre, the bike's
   * 1.3, 2.4 and 1.6), shared as a braced body passes it — his mass rides on
   * springs of its own (`BIKE.rider`). Our estimate. */
  inertia: { roll: 7.1, pitch: 10.2, yaw: 4.4 },

  /** THE WHEELS: a 29″ front and a 27.5″ rear (the mixed set-up of the
   * steepest courses), radius with the tyre on, m, and inertia about the
   * axle, kg·m² (0.20–0.26 measured and worked, Σ m r²). */
  front: { radius: 0.375, inertia: 0.24 },
  rear: { radius: 0.36, inertia: 0.21 },

  /** THE GEOMETRY, m from the bottom bracket, the axles where they sit at
   * SAG (the chart's static numbers ridden): a 1.29 m wheelbase (charts
   * 1.25–1.33), 0.45 m chainstay (0.43–0.46), the bottom bracket at 0.355 m
   * static (0.345–0.37), dropping some 35 mm into sag. */
  rearAxle: { y: 0.005, z: -0.45 },
  frontAxle: { y: 0.02, z: 0.84 },
  /** The head angle from the ground, deg (charts 62–63.5), the fork offset,
   * m (42–52 mm). The trail these give with the front radius is 0.141 m
   * (charts 125–145 mm): `(R cos ε − d) / sin ε`. */
  headAngle: 62.5,
  offset: 0.048,
  /** The rear wheel's path as it compresses, a unit vector in the body's
   * (y, z): up and a little back — a downhill frame's rearward early path
   * (builders' charts), held straight here. */
  rearPath: { y: 0.98, z: -0.2 },

  /** THE SUSPENSION at each end (`BikeEnd`): 200 mm of travel at both
   * (rear 190–210, a dual-crown fork 180–203); sag 33% rear and 25% front
   * (set-up guides 30–35% and 20–30%); progression 1.5 (builders' 1.4–1.7);
   * damping ratio 0.3 (0.2–0.4, our estimate from vehicle practice), the
   * rebound 1.2 and compression 0.8 of it, digressive past 1 m/s. */
  rearEnd: {
    travel: 0.2,
    sag: 0.33,
    progression: 1.5,
    zeta: 0.3,
    rebound: 1.2,
    bump: 0.8,
    knee: 1,
  } satisfies BikeEnd,
  frontEnd: {
    travel: 0.2,
    sag: 0.25,
    progression: 1.5,
    zeta: 0.3,
    rebound: 1.2,
    bump: 0.8,
    knee: 1,
  } satisfies BikeEnd,
  /** THE BUMP STOP over the last of the stroke (10–15 mm, builders'), m and
   * N/m; past the travel the TYRE and the rim take it, N/m (a downhill
   * tyre's vertical stiffness 80–150 N/mm, our estimate, stiffened to the
   * rim's as it pinches). */
  bumpStop: { reach: 0.012, rate: 150_000 },
  pinch: { rate: 300_000, damping: 2_000 },

  /** THE TYRES, a downhill knobbly at 1.6–1.9 bar (`docs/downhill-bike.md`):
   * the cornering stiffness over load, per rad (a survey of fourteen tyres
   * measured 0.15–0.35 per degree, 9–20 per rad; 12 picked for a soft
   * knobbly's carcass); the camber stiffness over load, per rad (0.43–0.86;
   * 0.75 picked: a bike turns on its lean); the relaxation length, m
   * (cornering stiffness over lateral stiffness, 0.12–0.45 measured for
   * vehicle tyres; a wide low-pressure carcass long); the pneumatic trail,
   * m (the side force's centre behind the contact, our estimate); the
   * speed under which the slip is read as at a crawl, m/s; and the
   * longitudinal creep under which a held brake holds rather than skids,
   * m/s. The grip and the rolling resistance are the GROUND's
   * (`defs/summer-ground.ts`'s `SURFACES`). */
  tyre: {
    cornering: 12,
    camber: 0.75,
    relax: 0.3,
    pneumatic: 0.02,
    crawl: 1.2,
    creep: 0.3,
    /** How sharply a side force past the peak falls to the sliding grip, per
     * unit of overload (our estimate). */
    fade: 3,
    /** The most slip a tyre winds up to, rad — past it is a slide. */
    most: 0.5,
  },

  /** THE STEERING: the bars and fork's inertia about the steer axis with
   * the front wheel, kg·m² (our estimate, a wheel's diametral inertia and
   * the fork's), the steer's own friction, N·m·s, and the bars' lock, rad. */
  steer: { inertia: 0.25, damping: 1.5, lock: 0.9 },

  /** THE BRAKES: four-piston discs on 200–223 mm rotors — the most torque
   * each lever gives, N·m (our estimate: more than either tyre can hold on
   * dry dirt, so the endo and the lock are the limits, as on a real bike). */
  brakes: { front: 360, rear: 300 },

  /** THE RIDER: a point mass, kg (a picked build's, `riders.ts`; 80 the
   * medium), on his legs and arms as a SECOND SUSPENSION in the frame's
   * axes. `stand` is his centre of mass from the bottom bracket in the
   * attack stance, m (CoM 0.95–1.10 m over the ground standing); `low` how
   * far down and `back` how far behind it the lean takes him at full lean
   * (CoM 0.85–0.95 m low and back); `crouch` how far the loaded legs fold
   * for a pop; `stroke` the room under and over `stand` before the body
   * meets the bike or the legs are straight. Rates N/m and damping N·s/m:
   * a human leg in a hop is a spring of 10–30 kN/m (Farley et al., 1991);
   * his arms are softer fore and aft. */
  rider: {
    mass: 80,
    stand: { y: 0.74, z: -0.01 },
    back: 0.27,
    forward: 0.1,
    low: 0.14,
    crouch: 0.32,
    stroke: { down: 0.45, up: 0.18, fore: 0.3, aft: 0.35, side: 0.3 },
    rate: { up: 14_000, fore: 25_000, side: 12_000 },
    damping: { up: 1_300, fore: 1_000, side: 1_000 },
    /** The stop at either end of the legs' and arms' room: the body on the
     * bike, the limbs straight, N/m and N·s/m. */
    stop: { rate: 80_000, damping: 3_000 },
    /** THE MOST THE LEGS PUSH, as a share of his weight: a rider meeting a
     * landing plans to stop his fall over `stroke` m (his legs' and the
     * bike's room, ~0.55–0.65 m), so he lets them give at `1 + v²/(2·g·
     * stroke)` — a 2 m drop's 6.3 m/s about 4.4 g, a small one's less —
     * never under `least` nor over `most` (`absorbOf`); taken stiff, `taut`.
     * Stood on the bike they push at most `most`. */
    legs: { most: 7.5, least: 1.8, stroke: 0.6, taut: 12 },
    /** THE POP: the extra push of the legs' extension, N, and how long, s,
     * after the crouch is let go — a bunny hop's 0.3–0.6 m. */
    pop: { force: 1_900, time: 0.2, tuck: 0.35 },
    /** How long his hips take from the middle to all the way back or
     * forward, s (our estimate off filmed riders' weight shifts). */
    shift: 0.25,
    /** His drag area in the attack stance and crouched, m² (0.45–0.60 and
     * 0.35–0.45, pacing tools' bands; ours 0.50 and 0.42). */
    cda: 0.5,
    cdaLow: 0.42,
  },

  /** THE PEDALS: the most power a few seconds hold, W (field peaks 834 ±
   * 129 W, lab 1138 ± 136; 900 picked), the power held indefinitely, W
   * (critical power, a trained rider's ~350), the work above it banked,
   * J (W′, 15–25 kJ), the most push at the wheel at a crawl, N (a standing
   * rider's weight on the crank through a low gear), and the roll-out of
   * the top gear, m per crank turn, with the most cadence, rpm (a 36/11 on
   * the rear wheel, 120 rpm — spun out near 55 km/h). */
  pedal: { power: 900, critical: 350, reserve: 20_000, push: 330, rollout: 7.7, cadence: 120 },

  /** THE HANDS: what the rider does with the bars to keep it up — the steer
   * aimed at a lean, which the bars are held to by `hold` N·m/rad and
   * `still` N·m·s/rad up to `most` N·m; the balance's natural frequency,
   * rad/s, and damping ratio; the tightest radius asked of the bars, m;
   * the share of the grip a turn is asked to lean on. Below `slow` m/s his
   * knees and hips help (`docs/downhill-bike.md`: at a crawl riders steer
   * harder and move their knees), faded out by `fast`; under `dab` m/s he
   * puts a foot down. */
  hands: {
    hold: 420,
    still: 30,
    most: 90,
    feel: 0.8,
    omega: 4,
    zeta: 0.8,
    tightest: 2.5,
    grip: 0.8,
    reach: 1.25,
    ease: 0.25,
    slow: 2.5,
    fast: 4,
    knees: { rate: 900, damping: 260 },
    dab: 0.8,
  },

  /** THE AIR: the pitch his body English asks at full lean, rad/s (nose up
   * leaning back), the yaw a twist of the bars asks, rad/s, and the most
   * torque his body puts through the bike for either, N·m (our estimates);
   * how hard the assist's hand levels the bike to the snow ahead, 1/s. */
  air: { pitch: 2.2, yaw: 1.2, torque: 260, level: 2.5 },

  /** WHAT THROWS HIM OFF (`bike.ts`): a lean past `lean` rad held `leanFor`
   * s (the lowside); the front's side force past `slide` × its sliding grip
   * for `slideFor` s over `slideFast` m/s (the washout); the body's peak
   * on a landing past `land` g (a crash on a cased, nosed or flat landing);
   * a trunk, a post or a rock met past `hit` m/s; the bike pitched past
   * `nose` rad over its front wheel (over the bars); and the centre of
   * his mass under `low` m over the snow. */
  crash: {
    lean: 1.13,
    leanFor: 0.15,
    slide: 1.6,
    slideFor: 0.3,
    slideFast: 3,
    land: 9,
    hit: 3.5,
    nose: 0.85,
    low: 0.45,
    /** Into a wall's bare rock (`rock-ground.ts`'s `rockStrike`, read
     * `reach` m past the front axle): a step of stone met at `strike` m/s,
     * or ridden up a face of it steeper than `climb` rad (50°) as fast. */
    rock: { strike: 4, reach: 0.4, climb: 0.87 },
    /** WHICH WAY HE GOES, by how he came off (`crash.over`'s shape: the
     * share of the turn head over heels along his way, the share over onto
     * a side, and the climb he leaves with, m/s): over the bars head first
     * and up; a washout or a lowside down on the low side, barely off the
     * ground; a landing he could not hold sat down back and to the side; a
     * trunk or a rock hit over it; his body put on the ground, onto a side. */
    over: {
      bars: { pitch: 1, side: 0.15, up: 1.4 },
      washout: { pitch: 0.15, side: 1, up: 0.2 },
      lowside: { pitch: 0.1, side: 1, up: 0.1 },
      landing: { pitch: -0.4, side: 0.8, up: 0.2 },
      hit: { pitch: 1, side: 0.25, up: 1.6 },
      down: { pitch: 0.3, side: 0.9, up: 0.2 },
    },
  },

  /** GETTING ON AND OFF: within `reach` m of a bike stood still, slower than
   * `fastest` m/s; a remount is put back on the trail within `back` m. */
  board: { reach: 2.5, fastest: 1.5, back: 60 },
  /** WALKING beside it, off the bike: m/s and how fast he turns, rad/s. */
  walk: { speed: 1.4, turn: 2 },
  /** A flight shorter than this is not called one, s. */
  airCounts: 0.25,
  /** How the landing is read: the window after touchdown its peak is taken
   * over, s, and the body's g low-passed over, s (a blow's duration). */
  landing: { window: 0.25, smooth: 0.03 },
  /** The physics' substeps a game step (720 Hz at 120). */
  substeps: 6,
} as const;

/** The bike and its rider together, kg. */
export function bikeMass(rider: number = BIKE.rider.mass): number {
  return BIKE.mass + rider;
}
