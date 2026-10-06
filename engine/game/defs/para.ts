// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR — the numbers `para.ts` flies a free ride's powered wing on,
// and the geometry the drawing is built to. Stated once here;
// `docs/paramotor.md` explains every block.
//
// THE RIG is a MOTORISED SPEED WING flown on skis: a small ram-air wing of
// the class speed riders launch off a summit on (8–18 m² flat, an aspect
// ratio near 4, a glide of 3–5 and speeds of 40–90 km/h) over a foot-launch
// paramotor on the skier's back — a single-cylinder two-stroke of about
// 185 cc swinging a 1.25 m two-bladed propeller inside a guard cage, about
// 75 kgf of static thrust at full rpm, the whole frame, cage and tank about
// 25 kg. A larger wing would float; this one flies FAST, close to the snow,
// and climbs only on the engine. What a real paramotor wing does (22–30 m²,
// a trim near 37 km/h, a minimum sink near 1.1 m/s, a glide near 8) is the
// slow end of the same polar, and the numbers below are its fast end.
//
// THE FRAME is the engine's: x to the right, y up, z forward. The pilot is
// the skier's own body (his centre of gravity); the WING is a point mass
// the lines hang him from.

export const PARA = {
  /** THE WING: its flat area, m², its mass with the air held in its cells,
   * kg (the cloth about 3 kg, some 4 m³ of air inside, its apparent mass
   * besides), and the lines' length from the harness to the canopy, m —
   * a speed wing's short lines. */
  wing: { area: 16, mass: 10, lines: 6 },
  /** THE POLAR: the lift slope per radian of angle of attack (a wing of
   * aspect ratio near 4), the angle of zero lift (its camber), the angle it
   * stalls at, the lift left past it, the zero-lift drag (the cloth, the
   * cells' mouths and the lines), the induced drag's factor 1/(π e A), and
   * the drag past the stall — and, the brakes let up, the SURGE that
   * throws a stalled canopy forward over the pilot as it fills again. Trimmed (`rig`), these put the wing at about
   * 8° of attack and a lift coefficient near 0.6 — 55 km/h at the weight. */
  polar: {
    slope: 3.2,
    zero: -0.05,
    stall: 0.3,
    stalled: 0.55,
    drag0: 0.045,
    induced: 0.133,
    stallDrag: 0.45,
    surge: 0.5,
  },
  /** THE TRIM: the chord's angle to the plane square to the lines, rad,
   * nose down negative — what sets the angle of attack the wing settles
   * at. THE BRAKES pull the trailing edge down: they raise the trim and
   * the lift and the drag, and stall the wing sooner. THE ACCELERATOR
   * (the lean forward) pulls the front risers down; the TRIMMERS let out
   * (the lean back) slow it. */
  rig: -0.05,
  brakes: { rig: 0.1, lift: 0.45, drag: 0.15, stall: 0.08 },
  speedBar: { rig: -0.06, trimmers: 0.03 },
  /** THE TURN: the side force a toggle pulled all the way down puts on the
   * canopy, as a coefficient on the dynamic pressure and the area (the
   * braked tip dragging, the canopy yawing and banking toward it), and the
   * drag the one braked side adds. The pilot's WEIGHT SHIFT in the
   * harness adds to it. THE ENGINE'S TORQUE turns the wing left a little
   * at full power. THE CANOPY RIGHTS ITSELF: its arc swings it back over
   * the pilot as it banks (a side force against the bank, the same
   * coefficient on the sine of it), so a toggle held is a turn of a
   * steady bank and a toggle let go levels it. */
  turn: { side: 0.22, drag: 0.04, weight: 0.05, torque: -0.025, righting: 0.3 },
  /** THE SWING DAMPED: the canopy's pitch and roll against the air as
   * it swings about the pilot, N per m/s of their relative swing square to
   * the lines. */
  damping: 28,
  /** THE ENGINE: the static thrust at full rpm, N (75 kgf), the speed at
   * which the propeller's thrust has fallen to nothing, m/s (its pitch
   * speed), the rpm at idle and full, how fast the rpm answers the
   * throttle, s, and the thrust line's tilt up off the pilot's way, rad. */
  engine: { thrust: 735, pitchSpeed: 38, idle: 2200, full: 8500, lag: 0.35, tilt: 0.08 },
  /** THE FRAME, CAGE AND TANK on his back, kg: a foot-launch paramotor's. */
  motorMass: 25,
  /** THE LAUNCH: on the summit the wing is held overhead, inflated, until
   * the skier has skied off fast enough for it to fly — m/s; the wing then
   * stands this far back of plumb, rad. */
  launch: { release: 8, lean: 0.2 },
  /** THE WING BROUGHT DOWN: its lowest point within this much of the snow,
   * m, or tangled in a crown, and it collapses — the rig is cut away. */
  ground: 0.4,
  /** THE GEAR DROPPED (the release press): the canopy and the motor fall
   * free — the canopy's drag area, m², streaming as cloth; how long the
   * press must be clear of the last, s. */
  dropped: { canopyDrag: 6, motorDrag: 0.3 },
  /** NEAR THE SNOW the pilot stands up out of the seat and his skis meet
   * the slope square: from `stand` m over it, fully by `square` m. */
  flare: { stand: 6, square: 1.5 },
  /** THE AIR THE WING FLIES IN (`para-air.ts`). The wind's log law runs up
   * to `top` m over the snow (the surface layer; above it the wind is the
   * same at every height); the woods shelter it only below their `crowns`,
   * m. RIDGE LIFT: the flow rises along the slope it meets at the wind's
   * speed times the slope, read over a spur's flank and over the whole
   * face (`span` m either side), each `share` of it, dying out over the
   * ground in `depth` m — on a steep face the rise reaches seven tenths of
   * the wind, on a shallow one a fifth, and no slope steers it steeper than
   * `steepest`. Down a slope the flow separates: `separate` of the sink is
   * kept smooth and the rest is the lee's rotor, a full lee where the air
   * falls `leeSlope` of its speed. THE EDDIES: their sigma as shares of the
   * mean wind — `open` air, `ground` near the snow (dying out in
   * `groundDepth` m), `lee`, `woods` (over the crowns, dying out
   * `woodsDepth` m above them) — times `storm` under a storm; their
   * `wavelengths`, m, how fast they churn as they are carried (`churn`, m/s
   * a radian of the wave), and the height, m, under which their up-and-down
   * is pressed flat by the snow (`flat`). */
  air: {
    top: 300,
    crowns: 22,
    ridge: [
      { span: 25, share: 0.45, depth: 60 },
      { span: 140, share: 0.55, depth: 260 },
    ],
    steepest: 0.7,
    separate: 0.55,
    leeSlope: 0.25,
    eddies: {
      open: 0.09,
      ground: 0.12,
      groundDepth: 35,
      lee: 0.3,
      woods: 0.14,
      woodsDepth: 40,
      storm: 1.35,
      wavelengths: [18, 55, 160],
      churn: 1.5,
      flat: 12,
    },
  },
  /** A FOLD — the wing COLLAPSING in the air, which is what rough air does
   * to a soft wing: pushed under `alpha`, rad, of attack (a downdraught, the
   * accelerator in a gust) its leading edge tucks under — a FRONTAL; one
   * tip pushed under it alone by the eddies across the span, that side
   * folds — an ASYMMETRIC, the canopy turning toward the folded side. The
   * span the tips stand apart, m (the projected span); how deep a fold
   * goes per radian under the angle (`deep`, at least `least`, at most
   * `most`); the lift a fold takes off (a frontal all of its share, a side
   * fold `sideLift` of it), the drag it adds, the turn toward the folded
   * side; and the refill — spontaneous in a few seconds (`refill`, s, for
   * the whole fold), faster with the brakes pumped (`pump`) and slowly
   * under `slow` m/s of air. The roll the tips' difference throws on the
   * canopy (`roll`, per radian of their difference). */
  fold: {
    alpha: 0.0,
    span: 6.4,
    deep: 6,
    least: 0.35,
    most: 0.95,
    lift: 0.85,
    sideLift: 0.45,
    drag: 0.2,
    turn: 0.4,
    refill: 1.6,
    pump: 1.5,
    slow: 8,
    roll: 0.6,
  },
} as const;

/** The pilot's mass on the lines, kg: the skier, his kit and the motor on
 * his back. */
export function pilotMass(skierMass: number): number {
  return skierMass + PARA.motorMass;
}
