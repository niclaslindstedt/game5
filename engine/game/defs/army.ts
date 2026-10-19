// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTERS IN FLIGHT (`army.ts`): how the machines the wanted
// level's roster asks for (`WANTED.roster`'s `helicopters`) are called in,
// flown and fought. Every number carries its unit; `docs/army.md` § *In
// flight* gives the reasoning beside each block.
//
// THE MACHINE is `ARMY_HELI`, the medium twin-engine utility class: a
// cruise of about 225 km/h (62 m/s), a never-exceed speed near 250 km/h,
// and a two-pilot crew flying it nap-of-the-earth or at a safe height over
// the woods.
//
// HOW IT HUNTS is the door gunner's geometry. A gun on a pintle in a side
// door bears square out of the side, so the crew fly a PYLON TURN round
// the target: a steady circle at a height and radius that keep the man
// square out of the gunner's door, the machine banked into the circle so
// the inside door looks down at him. Door gunners qualify against targets
// from about 150 to 800 m, from the hover and moving at about 70 knots
// (36 m/s); a circle of some 220 m at 70 m over him puts the gun about
// 230 m off him, inside the gun's best band and outside a rifleman's easy
// reach, and the orbit's 30 m/s banks the machine about 23°
// (tan φ = v² / (g·r)). A target that RUNS — a stolen helicopter at
// speed — cannot be orbited: the machine sits in ECHELON off his tail
// quarter, behind and to the gun's side, so the door gun yawed toward the
// nose bears on him, and flies his speed.

export const ARMY = {
  /** THE CALL: seconds from the roster asking for a machine to it coming
   * in at the map's edge (the duty crew's scramble), and the seconds
   * between one machine and the next called with it. They come in over
   * the edge nearest where he was when the hunt began, give or take
   * `drift` rad. */
  respond: 10,
  drift: 0.6,
  stagger: 7,
  /** WHERE IT COMES IN: m inside the map's edge, the bearing between
   * machines called together, rad (each the next either side of the
   * first), and the height over the snow it comes in at, m. */
  inset: 60,
  spread: 0.5,
  enter: 150,

  /** THE FLIGHT (a point flown with a pilot's limits, its attitude read
   * off what it does):
   *   * `cruise` the transit speed, m/s; `most` the dash it makes to keep
   *     station on a fleeing machine, m/s;
   *   * `tilt` the most the disc is leant to accelerate, rad (34°, a hard
   *     turn's bank) — g·tan of it
   *     the most it accelerates or turns on, m/s²; `lag` the time the
   *     attitude takes to follow, s (the accelerations it pulls are
   *     smoothed on it, so the bank rolls in rather than snaps);
   *   * `climb` and `sink` the vertical speeds, m/s, and `heave` the most
   *     vertical acceleration, m/s²;
   *   * `yaw` the most rate of turn of the nose, rad/s;
   *   * `nose` the nose-down the fuselage hangs at per m/s of airspeed,
   *     rad (some 6° at the cruise);
   *   * `gain` how hard it closes on its place in echelon, 1/s. */
  flight: {
    cruise: 62,
    most: 72,
    tilt: 0.6,
    lag: 0.6,
    climb: 10,
    sink: 12,
    heave: 4,
    yaw: 0.6,
    nose: 0.0017,
    gain: 0.3,
  },

  /** THE GROUND AND THE WOODS: the least height of the skid datum over
   * the snow and over any crown under the disc while it flies, m; how far
   * ahead it reads the ground, s of its way (sampled every `step` m); and
   * the hard floor it is never let under, m — what keeps it out of the
   * mountain whatever its station asks. */
  terrain: { clear: 30, look: 7, step: 20, floor: 12 },

  /** THE PYLON TURN on a slow quarry: the circle's radius, m; the speed
   * flown round it, m/s; the height over him, m; and how hard it closes on
   * the circle's radius, 1/s (the speed in or out a metre off it). */
  orbit: { radius: 220, speed: 30, height: 70, close: 0.3 },
  /** THE ECHELON on a fast quarry: m behind him, m to the side, m above;
   * and his speed over which it flies it rather than the circle, m/s (the
   * circle is let go from 60 % of it). */
  chase: { back: 140, aside: 90, above: 25, fast: 24 },
  /** THE SEARCH when he is out of sight: the circle round where he was
   * last seen is this share of the stars' search radius
   * (`WANTED.searchRadius`), flown at `speed` m/s, `height` m up. */
  search: { share: 0.5, speed: 35, height: 110 },
  /** Two machines are kept this far apart, m: each is pushed off the
   * other's station. */
  separate: 120,

  /** THE GUNS: the most range the door gunners fire from, m (the gun's
   * best band); the range the doors slide open within, m; how fast a door
   * slides, share a second; the gun's rest aim (yaw, pitch) while it does
   * not bear, rad; and the slack in an arc's stop a gun is still let fire
   * through, rad. */
  guns: { engage: 650, open: 1400, slide: 0.6, rest: { yaw: 0, pitch: -0.35 }, slack: 0.02 },

  /** LEAVING: the height over the snow it climbs to on the way out, m,
   * and how far past the map's edge it is gone, m. */
  leave: { height: 180, past: 150 },

  /** A RAM: the stolen helicopter's disc into this one's (or the cabins
   * nearer than `hull` m): the discs meet within `disc` m of each other's
   * height. The army's machine falls and burns; the player's crashes by
   * its own rules. `spin` the falling machine's yaw rate, rad/s, the tail
   * rotor gone; `wreck` how long the wreck lies, s. */
  ram: { disc: 2.5, hull: 6, spin: 2.4, wreck: 120 },

  /** Ids: the army's helicopters are pursuers `pursuer` + n, their gunners
   * `pursuer` + 100 + 2n (+1 the left door); their guns `gun` + 2n (+1
   * the left door). */
  ids: { pursuer: 1000, gun: 1000 },
} as const;
