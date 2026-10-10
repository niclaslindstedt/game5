// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE — the numbers `chute.ts` flies a jump out of the plane's door
// on: the freefall, the deployment, the canopy and what it can catch in.
// Stated once here; the drawing is built to the same geometry.
//
// THE RIG is a sport skydiver's: a harness and container on the back (the
// reserve in the upper tray, the main in the lower, a throw-out pilot chute
// in a pouch at the bottom), a 9-cell ram-air main of about 200 sq ft on
// lines of a few metres and risers to the harness, a SLIDER — a rectangle of
// fabric with a grommet at each corner the lines run through — that holds
// the canopy's mouth shut while it fills so it opens over seconds rather
// than at once, and a pair of steering toggles on the rear risers. Every
// number is the class's measured band (sources: the freefall's terminal
// speeds and drag areas, the deployment's timeline and its opening shock,
// a sport main's polar); none is any one maker's.
//
// THE FRAME is the engine's: x right, y up, z forward. The jumper is the
// skier's own body (his centre of gravity); the open canopy is a point mass
// the lines hang him from, as the paramotor's wing is (`para.ts`).

export const CHUTE = {
  /** THE CONTAINER on his back, m (width across, height up the back, depth
   * off it) and its mass with both canopies packed, kg: a sport rig's. */
  container: { width: 0.36, height: 0.52, depth: 0.18, mass: 11 },
  /** THE PILOT CHUTE thrown out of its pouch at the bottom of the container:
   * its diameter, m (a sport rig's 0.6–0.9 m), and the BRIDLE it pulls the
   * pin and then the bag by, m. */
  pilot: { diameter: 0.75, bridle: 2.5 },
  /** THE DEPLOYMENT BAG the canopy is packed in, m (its size as it comes off
   * the container). */
  bag: { width: 0.34, height: 0.22, depth: 0.16 },
  /** THE MAIN CANOPY, flat: its area, m² (200 sq ft), its span and chord,
   * m (an aspect ratio near 2.3), its cells, its mass with the air held in
   * them, kg (the cloth about 3 kg, some 6 m³ of air inside and its
   * apparent mass), the lines' length from the harness to the canopy, m
   * (the lines and the risers together), and the SLIDER's size, m. */
  canopy: {
    area: 18.6,
    span: 6.5,
    chord: 2.85,
    cells: 9,
    mass: 12,
    lines: 4.2,
    slider: { width: 0.75, length: 0.65 },
  },
  /** THE POLAR, as `para.ts`'s is read: the lift slope per radian of
   * attack (an aspect ratio near 2.3), the angle of zero lift, the stall
   * angle, the lift left past it, the zero-lift drag (the cloth, the open
   * cells' mouths, some 70 m of line and the slider), the induced drag's
   * 1/(π e A) and the drag past the stall — and, the toggles let up, the
   * SURGE that throws a stalled canopy forward over him as it fills again.
   * Trimmed (`rig`) these fly it at
   * about 11 m/s forward and 4.3 m/s down — a glide near 2.6 — with the
   * jumper hung under it. */
  polar: {
    slope: 2.86,
    zero: -0.05,
    stall: 0.5,
    stalled: 0.5,
    drag0: 0.1,
    induced: 0.2,
    stallDrag: 0.6,
    surge: 0.5,
  },
  /** How fast a canopy just full flies forward of him, m/s (trimmed nose
   * down, it flies at once). */
  surge: 6,
  /** WHAT THE POLAR FLIES, m/s, hands off: forward and down — what a canopy
   * stood up already flying (`skydiveAt`'s `open`) is started at, and what
   * the suite and the lab hold the polar to. */
  flies: { forward: 11.7, sink: 4.3 },
  /** THE TRIM, rad (the chord to the plane square to the lines), and what
   * BOTH TOGGLES do pulled down — the trailing edge deflected: the trim, the
   * lift and the drag raised and the stall come sooner; THE RISERS: the
   * fronts pulled down (the lean forward) lower the trim and dive it, the
   * rears (the lean back) raise it a little and flatten the glide. */
  rig: -0.13,
  brakes: { rig: 0.05, lift: 0.8, drag: 0.1, stall: 0.06 },
  risers: { front: -0.07, rear: 0.03 },
  /** THE TURN: a toggle pulled all the way down as a side force on the
   * canopy (its coefficient on the dynamic pressure and the area), the
   * drag that one braked side adds, and the canopy righting itself over the
   * jumper as it banks. */
  turn: { side: 0.27, drag: 0.05, righting: 0.35 },
  /** THE SWING DAMPED against the air, N per m/s of the canopy's swing
   * about the jumper square to the lines. */
  damping: 40,
  /** How fast the toggles and the risers follow the hands, s. */
  hands: 0.15,
  /** THE FREEFALL: the drag area face to the air, m² — BELLY TO EARTH
   * (the box, an arch: 2mg/(ρv²) off a 55 m/s terminal near the ground),
   * TRACKING (the arms back and the legs straight: less area and a glide of
   * its own), HEAD DOWN (the tuck: a 0.2 m² dive, 85–90 m/s) — and the
   * track's glide off the drag, the back slide's, the turn's most rate,
   * rad/s (a flat turn on the arms and legs), how fast he goes from one
   * body to another, s, and the most a rider in the air is drawn pitched on
   * his skier's own axes, rad (short of straight down, where a heading has
   * no meaning). */
  freefall: {
    belly: 0.5,
    track: 0.34,
    head: 0.2,
    glide: 0.9,
    back: 0.25,
    turn: 1.6,
    body: 0.6,
    pitchMost: 1.4,
  },
  /** THE EXIT: out of the door he presents his chest to the relative wind
   * — first the prop blast along the plane's way, then, as gravity takes
   * him, the air from below; he is out of the "hill" and in freefall once
   * the air comes `vertical` rad of plumb up at him, or after `most` s.
   * The press there does nothing for `clear` s (the tail passes over). */
  exit: { vertical: 0.2, most: 9, clear: 1.5 },
  /** THE DEPLOYMENT (the throw out): the pilot chute out and inflating, the
   * bridle taut and the pin pulled, the bag lifted off the container, the
   * lines unstowed to LINE STRETCH, the canopy SNIVELLING with the slider
   * held at the top, the slider coming down and the canopy spread to FULL
   * INFLATION — each stage's end, s after the throw (line stretch a little
   * over a second, the whole three to four), and the drag area the system
   * shows the air at each stage's end, m² (the jumper's belly the floor; the
   * last the canopy as the slider reaches the risers). The deceleration
   * this drag puts on him is the OPENING SHOCK — three to six g. */
  deploy: {
    stages: [
      { id: "pilot", end: 0.45, area: 0.55 },
      { id: "bag", end: 0.85, area: 0.65 },
      { id: "lines", end: 1.3, area: 1.5 },
      { id: "snivel", end: 2.9, area: 3.4 },
      { id: "inflate", end: 3.6, area: 14 },
    ],
  },
  /** FULL INFLATION'S LAST: the slider down, the cells still filling as
   * the canopy begins to fly — the air's force on it a share `from` of a
   * full canopy's at first, all of it after `time` s. */
  fill: { from: 0.55, time: 1 },
  /** THE LINES' STRETCH, s: the nylon's give the load on the harness is
   * felt through, as the time the pull is eased over. */
  stretch: 0.12,
  /** THE OPENING SHOCK's band, g — what a lab and the suite hold a normal
   * opening to (the harness's load on the jumper, peak). */
  shock: { least: 3, most: 6 },
  /** NEAR THE SNOW under the canopy he stands up in the harness and his
   * skis meet the slope square: from `stand` m over it, fully by `square`
   * m. */
  flare: { stand: 6, square: 1.5 },
  /** THE CANOPY BROUGHT DOWN onto the snow (its lowest within this of the
   * snow, m) is cut away as a skier lands under it; a FREEFALL handed back
   * to the skier's own step this far over the snow, m (the landing judged
   * there as any fall's), and at least the drop of `lead` steps at the
   * speed he falls at. */
  ground: 0.4,
  handover: 2.5,
  lead: 3,
  /** A skier come down on his skis with no canopy over him (a cut-away, a
   * low opening lost) skis on — the skydive over — once he has stood on the
   * snow this long unthrown, s. */
  settle: 0.5,
  /** THE CANOPY CUT AWAY (the release press, or the auto release on the
   * skis): it falls as cloth — its drag area streaming, m², its mass, kg,
   * and how fast it drifts with the wind, a share of the wind. */
  dropped: { area: 2.5, mass: 4, drift: 0.8 },
  /** CAUGHT: in a crown, the canopy within `crown` m of the crown's edge
   * below the tree's top; on a lift, a line or the cloth within `rope` m of
   * a rope, `tower` m of a tower's column, `carrier` m of a chair or a
   * cabin. HANGING THERE: the lines' length he hangs on, m, the swing's
   * damping, 1/s, and the speed into a trunk past which the blow is felt,
   * m/s. */
  snag: { crown: 1.2, rope: 0.7, tower: 1.0, carrier: 1.4, damping: 0.25, hurt: 2.5 },
  /** THE BOT'S HANDS (`chute-pilot.ts`): the height over the snow it pulls
   * at, m (a sport jumper's 1,000 m), not before `least` s out of the door,
   * and the hard deck it pulls at as soon as it is clear of the plane, m;
   * the glide it reckons on, the height it turns onto its final at, m, and
   * THE FLARE — both toggles from naught at `flare` m over the snow down to
   * all the way at `flared` m, a progressive flare that runs out of speed
   * as the skis meet the snow. */
  bot: { open: 1000, least: 2, deck: 600, glide: 2.2, final: 60, flare: 3, flared: 1 },
} as const;

/** One stage of the deployment (`CHUTE.deploy.stages`). */
export type DeployStage = (typeof CHUTE.deploy.stages)[number]["id"];

/** The jumper's mass on the lines, kg: the skier, his kit and the rig. */
export function jumperMass(skierMass: number): number {
  return skierMass + CHUTE.container.mass;
}
