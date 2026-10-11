// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE — the numbers `plane.ts` flies a free ride's plane on, and
// the geometry the drawing and the Blender model are built to (the model is
// handed this table whole, never numbers of its own). Stated once here.
//
// THE MACHINE is the class mountain drop zones and glacier operators fly: a
// single turboprop of about 410 kW (550 shp, flat-rated so it keeps its
// power high), a strut-braced constant-chord HIGH WING of 15.9 m and 30 m²,
// a long nose over the engine, a conventional tail, a tailwheel, wheel-skis
// on a wide-track main gear, and big SLIDING CABIN DOORS — the jumpers' on
// the RIGHT. About 2.8 t at its maximum, 1.3 t empty; it lifts off a few
// hundred metres of packed snow and climbs about 5 m/s.
//
// THE FRAME is the skier's: x to the right, y up, z forward (the nose) —
// the engine's right, which the picture shows MIRRORED (three.js's view from
// behind mirrors the map, as `cockpit-plan.ts` says of the helicopter): so
// the jump door, on the plane's right as a pilot in it sees it, and the
// pilot's left seat are stated at the engine's −x and +x. The
// origin is THE GROUND DATUM: the snow under the middle of the two main
// skis with the fuselage held LEVEL (its reference line horizontal) — so a
// plane in level flight attitude resting on its main skis stands at
// y = groundAt. On the snow it sits back on its tail ski, nose high, at the
// three-point attitude (`gear.tail` sets it, about 11°). Every point below
// is in that level frame.
//
// SOURCES, as classes and numbers only: the class's published sheet (span,
// area, length, power, weights, stall, climb, cruise, take-off and landing
// distances, the doors), the encyclopaedia's figures for it, flight-manual
// practice for a light utility plane's control throws, the lift and drag
// of a strut-braced high wing worked from its aspect ratio (Helmbold's
// lift slope, an Oswald factor of 0.75, a zero-lift drag back-solved from
// its cruise), momentum theory for the propeller's static thrust, and the
// snow's friction on a ski off the light-aircraft ski literature.

export const PLANE = {
  /** THE WORKING WEIGHT, kg, without the skier at the door: about 1,290 kg
   * empty, the pilot, the fuel for two lifts and a load of jumpers and
   * their kit in the cabin (the class's jump load). The skier in the door
   * is added while he is aboard. [class sheet; est.] */
  mass: 2450,
  /** The turning inertias about the CoG, kg·m²: roll (about z), pitch
   * (about x), yaw (about y) — a light utility plane's, scaled by mass and
   * span from a four-seater's measured set. [est.] */
  inertia: { roll: 5600, pitch: 7000, yaw: 11500 },
  /** THE CoG, body frame, m: on the centre line, a little behind the main
   * gear (a tailwheel plane's gear stands ahead of it) and under the wing's
   * aerodynamic centre. [est., three-view] */
  cog: { y: 1.62, z: -0.36 },
  /** THE FUEL aboard on a jump flight, kg of jet fuel (about 250 L), in the
   * wing tanks either side of the root — what the wreck burns and the
   * fireball is sized off (`fireballOf`, the helicopter's law). [class
   * sheet: 480–644 L full] */
  fuel: 200,

  /** THE FUSELAGE as stations along z, m: the bottom and top of the skin
   * and its half width at each — the nose's spinner, the cowling, the
   * windscreen's foot (the firewall), the cabin, the tailcone tapering to
   * the rudder post. 10.9 m overall. [class sheet; est. sections] */
  fuselage: {
    stations: [
      { z: 3.45, bottom: 1.82, top: 1.94, half: 0.05 },
      { z: 3.2, bottom: 1.6, top: 2.12, half: 0.36 },
      { z: 2.3, bottom: 1.36, top: 2.17, half: 0.46 },
      { z: 1.3, bottom: 1.08, top: 2.2, half: 0.56 },
      { z: 0.4, bottom: 0.95, top: 2.68, half: 0.63 },
      { z: -1.9, bottom: 0.98, top: 2.68, half: 0.62 },
      { z: -3.0, bottom: 1.2, top: 2.56, half: 0.52 },
      { z: -5.0, bottom: 1.55, top: 2.36, half: 0.32 },
      { z: -7.0, bottom: 1.78, top: 2.22, half: 0.14 },
      { z: -7.45, bottom: 1.9, top: 2.16, half: 0.06 },
    ],
  },
  /** THE COWLING over the turbine, from its front ring to the firewall, m,
   * and the exhaust stacks either side (their z and height). [est.] */
  cowling: { front: 3.2, back: 1.3, exhaust: { z: 2.55, y: 1.85 } },

  /** THE WING: span, m; chord, m (constant, rectangular); its root's
   * height (the chord line at the side of the cabin roof) and the leading
   * edge's z, m; the dihedral and the incidence to the fuselage line, rad
   * (1.8° and 2°); the washout at the tip, rad (2°, the tip set lower so
   * the root stalls first); the flap's and the aileron's share of the
   * semi-span (the flap inboard, the aileron outboard) and of the chord.
   * 15.87 m × 1.90 m, 30.15 m², aspect ratio 8.35. [class sheet] */
  wing: {
    span: 15.87,
    chord: 1.9,
    root: { y: 2.72, le: 0.42 },
    dihedral: 0.031,
    incidence: 0.035,
    washout: 0.035,
    flap: { span: 0.55, chord: 0.3 },
    aileron: { span: 0.45, chord: 0.25 },
  },
  /** THE LIFT STRUTS, one a side, from the cabin's lower side to about
   * 0.55 of the semi-span, and the jury strut half way up (right side;
   * the left mirrored), m. [three-view, est.] */
  struts: {
    foot: { x: 0.62, y: 1.05, z: -0.2 },
    head: { x: 4.3, y: 2.86, z: -0.3 },
    jury: 0.55,
  },
  /** THE HORIZONTAL TAIL: span, m (16 ft 10 in), chord, m, its leading
   * edge's z and height, m, its incidence to the fuselage line, rad (set
   * so the plane trims at about 45 m/s with the stick centred), and the
   * elevator's share of its chord. [class drawing; est.] */
  tail: { span: 5.13, chord: 1.1, le: -6.1, y: 1.98, incidence: -0.035, elevator: 0.4 },
  /** THE FIN AND RUDDER: the root's height, leading edge and chord, the
   * tip's, m, and the rudder's share of the chord — tall, with a dorsal
   * fillet run forward along the tailcone (`dorsal`: its leading edge's z
   * at the root). Three-point fin-top height 3.2 m. [class sheet; est.] */
  fin: {
    root: { y: 2.2, le: -5.85, chord: 1.65 },
    tip: { y: 4.55, le: -6.75, chord: 0.85 },
    dorsal: -4.6,
    rudder: 0.4,
  },
  /** THE PROPELLER: diameter, m; blades; the hub's height and place along
   * z, m; the spinner's diameter, m; and its rpm at full power. Turning
   * clockwise seen from the cockpit. [class sheet: 3 blades, 2.56–2.67 m] */
  prop: { diameter: 2.56, blades: 3, hub: { y: 1.88, z: 3.25 }, spinner: 0.42, rpm: 2200 },

  /** THE GEAR: the main legs from the fuselage to the axles, the track,
   * the wheels' radius, and the main SKIS under them (length, width, how
   * far forward of the axle the tip reaches, the tip's upturn), m; and the
   * TAIL SKI (where it touches, length, width), m — its height in the
   * level frame sets the three-point attitude, atan(1.37 / 7.05) ≈ 11°.
   * Wide-track spring legs; wheel-skis of a mountain operator. [class
   * drawing: track ≈3.0 m; skis est.] */
  gear: {
    leg: { x: 0.5, y: 1.0, z: 0.1 },
    track: 3.0,
    wheel: 0.38,
    ski: { length: 2.6, width: 0.5, front: 1.5, tip: 0.18 },
    tail: { z: -7.05, y: 1.37, length: 0.9, width: 0.25 },
  },

  /** THE CABIN behind the pilot: the floor's height, its front and back
   * along z, its width and height, m. [est.] */
  cabin: { floor: 1.0, front: 1.2, back: -2.3, width: 1.16, height: 1.3 },
  /** THE JUMP DOOR on the RIGHT as seen from the seat (the engine's −x —
   * see THE FRAME), slid open aft along the outside: its plane (x), its front and back edges along z and its sill and lintel,
   * m — a 1.58 m double door under the wing's trailing edge, aft of the
   * strut's foot. [class sheet: 1.58 m combined width] */
  door: { x: -0.62, front: -0.12, back: -1.7, bottom: 1.05, top: 2.15 },
  /** WHERE THE SKIER STANDS in the door, body frame, m: the floor under
   * his skis on the sill, crouched under the lintel facing forward along
   * the fuselage (the poised exit), and how high his body's origin stands
   * over that floor crouched. */
  jumper: { x: -0.4, y: 1.0, z: -0.92, height: 0.62 },
  /** THE PILOT'S EYE in the left seat as he sees it (the engine's +x),
   * body frame, m. */
  pilotEye: { x: 0.3, y: 2.3, z: 0.72 },

  /** THE AIR ON IT (`plane.ts`'s per-surface model):
   *   * `lift` the 3D lift slope a rad of each surface (Helmbold off its
   *     aspect ratio: the wing's 8.35, the tail's 4.7, the fin's doubled by
   *     its end plate), the wing section's zero-lift angle (cambered), rad,
   *     and the stall angle past it, rad (from zero lift, so CLmax ≈ slope
   *     × stall: 1.67 clean — 58 kt at the maximum weight — and 2.08 with
   *     the flaps down, 52 kt);
   *   * past the stall the lift falls to a flat plate's, `plate` × sin 2α,
   *     over `soft` rad, and the drag rises to `plateDrag` × sin²α;
   *   * `oswald` the span efficiency; `profile` each surface's section
   *     drag; `flapLift` the flapped section's zero-lift shift a rad of
   *     flap, and `flapDrag` the drag of full flap; `flapStall` how much of
   *     that shift raises the stall too;
   *   * `downwash` the tail's downwash a unit of the wing's lift
   *     coefficient, rad (2 / πA);
   *   * `body` the fuselage, the gear on skis and the struts as drag areas
   *     (CdA, m²) along the body's axes — front, side, plan — at a point
   *     behind the CoG (`at`); their sum with the wing's profile drag is
   *     the class's CD0 ≈ 0.078 × 30.15 m², plus the skis.
   *   * `effect` each control surface's angle-of-attack effectiveness (a
   *     rad of surface a rad of the surface's α).
   *   * `slip` the share of the propeller's slipstream increment the tail
   *     and the fin sit in. [est., see the header] */
  aero: {
    lift: { wing: 4.96, tail: 4.15, fin: 3.4 },
    zeroLift: -0.052,
    stall: { wing: 0.335, tail: 0.3, fin: 0.38 },
    plate: 1.05,
    soft: 0.07,
    plateDrag: 1.25,
    oswald: 0.75,
    profile: { wing: 0.011, tail: 0.012, fin: 0.012 },
    flapLift: 0.22,
    flapDrag: 0.09,
    flapStall: 0.8,
    downwash: 0.076,
    body: { front: 1.8, side: 6.5, plan: 6.0, at: { y: 1.6, z: -0.9 } },
    effect: { aileron: 0.25, elevator: 0.5, rudder: 0.5 },
    slip: 0.6,
  },

  /** THE ENGINE AND PROPELLER: the shaft power at full throttle, W (550
   * shp); the propeller's efficiency at speed; the static thrust at full
   * power, N (momentum theory off the 2.56 m disc at a figure of merit
   * near 0.7); the power's lag to the lever, s (a turbine's spool); flight
   * idle's share of the power; the reverse thrust's share of the static
   * with the brakes on the snow (the beta range); and the drag area of the
   * windmilling propeller at idle, m². The torque's roll on the airframe
   * is the shaft power over the propeller's turn, `torque` of it felt;
   * the slipstream's swirl on the fin yaws it `swirl` m of lever a newton
   * of thrust. [class sheet; est.] */
  engine: {
    power: 410e3,
    efficiency: 0.8,
    staticThrust: 10.5e3,
    spool: 1.1,
    idle: 0.04,
    reverse: 0.32,
    windmill: 0.15,
    torque: 0.35,
    swirl: 0.025,
  },

  /** THE CONTROLS: the throws, rad (aileron ±20°, elevator 25° up / 20°
   * down, rudder ±25°, flaps 0–40°), how fast a surface follows its
   * control, full throws a second, the flaps' run end to end, s, and the
   * tail ski's steering with the rudder, rad at full pedal. [light utility
   * practice] */
  controls: {
    aileron: 0.35,
    elevatorUp: 0.44,
    elevatorDown: 0.35,
    rudder: 0.44,
    flaps: 0.7,
    rate: 4,
    flapRun: 6,
    tailSteer: 0.45,
  },

  /** THE SNOW UNDER THE SKIS (`plane.ts`'s gear): each leg's spring, N/m,
   * and damping, N·s/m (main, tail); the skis' friction along their run
   * on the strip's packed snow and on loose snow off it, and across them;
   * the brakes' added friction (a ski's drag claws) — the brakes are the
   * skid key's; and the speed under which a friction is eased to nothing,
   * m/s (so a plane at rest does not jitter). [light-aircraft ski
   * literature: μ 0.05–0.1 packed, ≈0.2 soft] */
  ground: {
    spring: { main: 150e3, tail: 45e3 },
    damping: { main: 16e3, tail: 5e3 },
    packed: 0.07,
    soft: 0.18,
    across: 0.6,
    brake: 0.18,
    ease: 0.15,
  },

  /** INTO THE SNOW AND THE TREES (`plane.ts`'s crash):
   *   * `sink` the touchdown sink the gear rides, m/s (a utility gear's
   *     certified 3 m/s with a reserve), and `travel` the most a leg may be
   *     pressed, m, before it folds;
   *   * `slide` the sideways skid of the main skis it survives, m/s — a
   *     ground loop past it tips a wing in;
   *   * `wreck` the seconds it burns before the ride starts again on the
   *     strip; `blast` the push the impact throws the jumper in the door
   *     out with, m/s (out of the door and up);
   *   * `strike` the airframe's extremes tested against the snow, body
   *     frame (the wingtips' leading and trailing edges, the nose, the
   *     belly, the tailcone, the fin's top, the stabiliser's tips) — the
   *     propeller's disc is tested on its own. */
  crash: {
    sink: 3.6,
    travel: 0.42,
    slide: 7,
    wreck: 10,
    blast: { out: 6, up: 5 },
    strike: [
      { x: 7.93, y: 2.97, z: 0.42 },
      { x: 7.93, y: 2.97, z: -1.48 },
      { x: -7.93, y: 2.97, z: 0.42 },
      { x: -7.93, y: 2.97, z: -1.48 },
      { x: 0, y: 1.45, z: 3.1 },
      { x: 0, y: 0.95, z: -0.6 },
      { x: 0, y: 1.6, z: -5.2 },
      { x: 0, y: 4.55, z: -7.15 },
      { x: 2.56, y: 1.98, z: -6.65 },
      { x: -2.56, y: 1.98, z: -6.65 },
    ],
  },

  /** BOARDING THE PARKED PLANE: how near the door a skier rides in to be
   * taken aboard, m, and the fastest he may be going, m/s. */
  board: { reach: 5, fastest: 4 },
  /** THE JUMP: the push he leaves the door with, out and up, m/s. */
  jump: { out: 1.4, up: 0.4 },

  /** THE STRIP it needs (`airstrip.ts`): its width, m; how many times the
   * plane's own measured take-off roll at its start weight is laid
   * (`rollFactor`, ≈1.5 — "just enough" with an abort margin), and the
   * overrun past it, m; the measured roll itself, m (`plane-flight`'s lab
   * reads it off the engine: its packed-snow roll at the working weight
   * with the skier aboard, the take-off flap, full power — 199 m on the
   * flat, 222 m down a generated map's own strip); the steepest grade along
   * it and across it, and the most the snow may stand off a straight line
   * along it, m, and the most its grade over any 5 m may stand off the
   * strip's own (no lip or terrace edge); the clearance kept round it, m. */
  strip: {
    width: 20,
    roll: 225,
    rollFactor: 1.5,
    overrun: 60,
    grade: 0.03,
    cross: 0.04,
    bump: 1.2,
    step: 0.04,
    clear: 14,
  },

  /** THE BOT'S HANDS (`plane-pilot.ts`): the speeds it flies, m/s — the
   * rotation on the take-off roll, the best climb, the cruise, the jump
   * run (≈72 kt, flaps a quarter), the approach (≈1.25 × the full-flap
   * stall) — the flaps it takes off and approaches with (shares), the
   * height over the snow it climbs straight ahead to off the strip before
   * it turns, m, the glide path it lands down, rad (6°, the class's steep
   * approach), how far out it turns onto it, m, and the landing circuit's
   * turn radius (its downwind leg flown twice that off the strip), m, how
   * far inside the map's edge its circuits keep (they fly under the
   * airborne bounds' height), m, the
   * height it flares at, m, how far short of the threshold the glide path
   * meets the snow (the flare floats it on past), m, and the jump run's
   * height over the summit, m — 2,000 m puts the exit 2,500–2,800 m over
   * the snow under the door, a sport jump's 40–50 s of freefall to the
   * pull, about ten and a half minutes of climb off the strip (`make
   * skydive-flight`; 500 m gave a 1,200 m hop and 1,500 m about 2,000 m).
   * On the take-off roll: the speed the tail is let fly at, m/s, the
   * pitch it is held at tail up and lifted off at, rad, and the most
   * forward stick it takes. */
  pilot: {
    rotate: 28,
    tailUp: 15,
    tailPitch: 0.07,
    liftPitch: 0.15,
    shove: 0.5,
    climb: 40,
    cruise: 55,
    jumpRun: 37,
    approach: 31,
    flapsOff: 0.4,
    flapsLand: 1,
    flapsRun: 0.25,
    clear: 60,
    glide: 0.105,
    final: 1000,
    circuit: 300,
    edge: 150,
    flare: 5,
    aim: 80,
    jumpHeight: 2000,
  },

  /** THE PILOT FLYING HOME after the jump: the beat the controls stay
   * where the jumper left them, s. */
  home: { beat: 1.5 },
} as const;

/** The plane's whole mass, kg, with the skier at the door or without. */
export function planeMass(rider: number): number {
  return PLANE.mass + rider;
}
