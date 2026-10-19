// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT — the numbers `wingsuit.ts` flies a wingsuit jump on: a large
// modern three-wing suit (two arm wings and a leg wing, ram-air, the arms and
// legs its spars) over a single-canopy BASE rig. Stated once here; the
// drawing is built to the same geometry.
//
// THE AIR ON THE SUIT is the model fitted to a flight-test logger worn by a
// flyer in a large glide suit (an inertial and GPS unit on his chest): the
// lift and the drag as FACTORS that fold the half, the coefficient and the
// area into one number of square metres,
//
//   L = ρ V² cL(α),   D = cp ρ V² + L² / (ci ρ V²),
//
// induced plus parasitic, so the best glide is ½·√(ci/cp) whatever the air's
// density or the flyer's mass, which move only the speeds. The paper's suit
// was of an older generation (a best glide near 2.7); a large modern suit is
// scaled from it as the research does — a larger induced factor for a wider,
// longer wing, the parasitic factor near the same — to a best glide a little
// over 3 at about 45 m/s through air of 1 kg/m³: 150–160 km/h across and
// 13 m/s down, inside the large class's measured band (150–190 km/h, 10–14
// m/s, 3.0–3.5). The lift slope and the stall are the wind tunnel's on a
// suit model (the best glide near 10° of attack, the lift topping out past
// 30°, a gentle stall), the pitch the flight test's (a pitch inertia of
// 16 kg·m², a pitching-moment slope of 0.20 m³ per radian — a stable suit —
// and a short period near 0.8 Hz damped over 1.4 s); every number is the
// class's, none any maker's.
//
// THE FRAME is the engine's: x right, y up, z forward. The flyer is the
// skier's own body (his centre of gravity), with no skis and no poles.

export const WINGSUIT = {
  /** THE SUIT, kg, and its span glove to glove and length helmet to the leg
   * wing's trailing edge in flight, m (a 1.80 m flyer's), and its planform,
   * m² (a large suit's 1.8–2.2). */
  suit: { mass: 3.5, span: 1.75, length: 2.1, area: 2.0 },
  /** THE LIFT FACTOR, m² (`cL = slope · (α − zero)`, α from the chest's plane,
   * rad), to the stall at `stall` rad — where it tops out — and falling
   * gently past it by `post` m² per rad, never under `floor` of the most. */
  lift: { slope: 1.3, zero: -0.14, stall: 0.6, post: 0.9, floor: 0.45 },
  /** THE DRAG FACTORS, m²: the parasitic `parasite` at the suit's design
   * attack `design`, growing by `alpha` per rad² off it (the body presented
   * at an angle the suit is not cut for), the induced `induced`, and past
   * the stall `stall` more per rad (the wing separated, the flyer mushing). */
  drag: { parasite: 0.064, design: 0.17, alpha: 0.12, induced: 2.6, stall: 0.5 },
  /** THE SUIT'S SHAPES, each the share of a factor it leaves: the ARMS SWEPT
   * BACK to the hips (the tuck — the delta dive: less wing, a sleeker body,
   * the lift slope, the parasitic and the induced factors all down) and the
   * wings SPREAD full and pushed forward (the back key: a little more lift
   * and more drag — the float and the flare). */
  sweep: { lift: 0.6, parasite: 0.85, induced: 0.7 },
  spread: { lift: 1.12, parasite: 1.15, induced: 1.05 },
  /** THE TRIM: the attack the flyer's body holds the suit at, rad — hands
   * off (the best glide), the lean forward all the way (the dive), the lean
   * back all the way (the flare, near the stall); the arms swept take it
   * lower, the wings spread higher, and a turn pulled `turn` higher at the
   * full edge (a turn is pulled, and sinks). */
  trim: { glide: 0.17, dive: -0.14, flare: 0.42, sweep: -0.06, spread: 0.06, turn: 0.4 },
  /** THE PITCH (the short period): the inertia, kg·m², the moment's slope
   * against the attack off its trim, m³ per rad (ρV² times it), and the
   * damping on the pitch rate, m⁴ (ρV times it), set so the short period
   * damps over about 1.4 s at 45 m/s; and the attack kept between `least`
   * and `most` rad. */
  pitch: { inertia: 16, moment: 0.2, damping: 0.3, least: -0.5, most: 1.4 },
  /** THE ROLL: the bank the edge asks at full, rad, the time it takes to
   * roll to it, s (a body's roll is quick, its inertia small), and the yaw
   * a flyer falling too steeply for a heading to mean anything turns by on
   * the edge, rad/s. */
  roll: { bank: 1.55, time: 0.22, flat: 2.5 },
  /** How fast the body follows the hands — the lean, the sweep, the spread
   * — s. */
  hands: 0.35,
  /** THE SUIT PRESSURISING: its ram-air wings fill from `from` m/s of air
   * through them and are full by `full`, over a lag of `time` s — the lift
   * is that share of a full suit's; unpressurised it flaps, a body with
   * little lift (the first second or two off a cliff). */
  pressure: { from: 8, full: 18, time: 0.5 },
  /** THE EXIT: stood on a cliff's edge, the press (or the tuck) is the
   * jump — a running exit's push out off the edge and up, m/s; the body led
   * into the relative wind at `alpha` rad of attack (a good exit presents
   * the suit to the air coming up at him at its most lift, just short of the
   * stall, from the first moment, rather than falling flat and mushing), held so until the air through him reaches
   * `held` m/s; the press does nothing for `clear` s after it (the edge, or
   * a door's tail, passed); off a hover the push is a step off the skid,
   * `step` m/s, and nothing up; and he is FLYING once his path is no steeper
   * than a glide of `flying` (the start arc flown out), or after `most` s. */
  exit: { push: 4.5, step: 1, up: 0.8, alpha: 0.55, held: 15, clear: 1, flying: 1, most: 14 },
  /** THE CLIFF EXIT searched for on a map (`wingsuitExitOf`): ground in the
   * top `top` of the mountain's vertical and `margin` m inside the map's
   * edge, sampled every `grid` m, the fall line's way and `spread` rad
   * either side of it; the start arc flown off each of the `tried` steepest
   * (the drop over 30 m and a third of it over 100 m, and `height` of each
   * metre the point stands over the band's foot)
   * — a point mass on the suit's own lift and drag — and the one that clears
   * the snow by the most — and, among those that clear it by `clear` m, the
   * highest — taken; the arc flown `arc` s from a stand `stand` m (his
   * centre of gravity standing) over the edge, at `mass` kg. A real exit
   * point is a wall near sheer for the first hundred metres; where the map
   * has none (a generated mountain's faces top out near 45°, and the arc
   * off one meets the snow 60–80 m down), the exit is a HOVER over the best
   * edge, the least height from `hoverLeast` to `hoverMost` m in
   * `hoverStep`s whose arc from rest clears the snow, raised `hoverRoom` m
   * more so the suit is flown a while before the pull — kept low, some
   * 350 m over the snow, so the flight is down the face rather than over
   * it, the face falling away under him giving the room the pull needs. */
  search: {
    top: 0.55,
    margin: 300,
    grid: 12,
    spread: 0.35,
    tried: 48,
    height: 0.1,
    clear: 10,
    arc: 9,
    stand: 1,
    mass: 89,
    hoverLeast: 100,
    hoverMost: 800,
    hoverStep: 25,
    hoverRoom: 100,
  },
  /** THE SNOW MET IN FLIGHT: the body's half thickness lying on the wind,
   * m — his centre this near the snow under him (or where he will be next
   * step) is the snow met, and the crash code's to judge; a crown met within
   * `crown` m of its edge the same, as a tree. */
  body: 0.3,
  crown: 0.2,
  /** THE OPENING from the suit: the drag area the flyer shows the air at
   * the throw, m² (a suit's parasitic drag, sunk into), and the suit's lift
   * carried through the pilot chute and the canopy's leaving the container,
   * gone by line stretch. */
  deploy: { floor: 0.15 },
  /** LANDED UNDER THE CANOPY on his boots: from a sink of `sink` m/s or a
   * ground speed of `run` m/s he is thrown (a parachute landing fall past
   * what it can take), under them he runs it out at `stop` m/s² to a walk —
   * and walks (`walk` m/s at full, turning `turn` rad/s), the machine press
   * or the reset beginning the jump again. */
  land: { sink: 6, run: 9, stop: 5, walk: 1.4, turn: 1.6 },
  /** THE BOT'S HANDS (`wingsuit-pilot.ts`): the height over the snow it
   * pulls at, m (a BASE flight's 150–400 m over the terrain: 350 on a long
   * flight's run-out), and the height it stops flying the suit to slow for
   * the pull at, m (the "sink into the suit" or a flare to its apex); the
   * terrain it keeps under it — the seconds ahead it looks and the clearance
   * it holds over what it will meet there, m, diving the fall line when it
   * has room and flaring when it has not — and the glide's best attack it
   * flies hands off; and the height over the floor from which it flies for
   * the piste the canopy will land on, m, until it is within `near` m of it
   * (a canopy pulled at 350 m reaches some 700 m of open snow, no further). */
  bot: { open: 350, slow: 450, ahead: 4, keep: 40, close: 15, home: 1000, near: 150 },
} as const;

/** The flyer's mass, kg: the skier's body and his clothes, the suit and the
 * BASE rig — no skis, no poles. */
export function wingsuitMass(skierMass: number, rigMass: number): number {
  return skierMass + WINGSUIT.suit.mass + rigMass;
}
