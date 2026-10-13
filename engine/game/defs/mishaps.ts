// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THINGS THAT GO WRONG ON THEIR OWN (`mishaps.ts`) — the canopy that opens
// badly and the engine that stops — their odds and their numbers, stated
// once. A free ride is dealt them only when the player's OPTIONS ask
// (`CreateGameOptions.mishaps`); every other run, and every lab, has none.
//
// THE ODDS are a game's, not the sky's. Real main canopies fail to open
// cleanly something like once in a thousand jumps (line twists far more
// often, most kicked out without a thought), and a turbine stops in flight
// once in a hundred thousand hours — odds a player would never meet. So
// RARE deals about one flight in eight something to handle, and OFTEN
// about every other one. What each mishap DOES is the real thing's, as
// training and incident reports describe it:
//
//   * LINE TWISTS on opening: the lines wound a turn or several above the
//     risers, the jumper spun under a canopy he cannot steer or flare (the
//     toggles are above the twist) until they unwind — on their own,
//     slowly, or faster as he kicks and spreads the risers. A canopy badly
//     twisted turns on its own, and the turn feeds the twist: past the
//     decision height the answer is to cut away.
//   * A LINE OVER the canopy (a tip tangled in the lines): the tip's cells
//     pinched off, the canopy turning hard toward them past what the
//     opposite toggle can hold — a spiral. Nothing flies it out: cut away
//     and pull the reserve.
//   * A HARD OPENING: the slider down at once, the snivel skipped — the
//     whole canopy grabbing the air at freefall speed, eight to fifteen g
//     where three to six is normal, and the neck and the back pay for it.
//   * THE PARAMOTOR'S CRAVAT: after a deep asymmetric collapse the tip
//     caught in the lines and held there, the wing turning into it.
//     Weight-shift and brake away from it to hold the heading; a sharp,
//     deep pull (here the brakes, pumped) gives the cloth the slack to
//     come free. Leaned into, it spirals.
//   * THE PARAMOTOR'S TWISTS after a reverse launch not turned round in
//     time: unwound as the canopy's.
//   * AN ENGINE STOPPAGE in the plane: a few seconds of coughing and the
//     power gone, the propeller windmilling — glide at the best-glide speed
//     and land on whatever snow is ahead. In the helicopter: the turbine
//     quits, the rotor slows under the collective as fast as its inertia
//     lets it, and only the collective lowered at once — the descent's air
//     driving the rotor (AUTOROTATION) — keeps it turning; flared at the
//     bottom, the rotor's stored spin is pulled out as the last thrust.

/** How often things go wrong: the OPTIONS row's two "on" stops. */
export type MishapRate = "rare" | "often";

export const MISHAPS = {
  /** THE ODDS, each a chance an occasion is dealt its mishap: a main
   * canopy opened, a paramotor launched (its twists), a side collapse
   * deep enough to cravat, a plane's or a helicopter's lift-off. */
  odds: {
    rare: { chute: 0.12, paraTwist: 0.1, cravat: 0.25, plane: 0.12, heli: 0.1 },
    often: { chute: 0.5, paraTwist: 0.4, cravat: 0.65, plane: 0.5, heli: 0.45 },
  },
  /** WHICH CANOPY MALFUNCTION a main's is, by share (twists the commonest). */
  chute: { twist: 0.55, hard: 0.25, lineover: 0.2 },
  /** LINE TWISTS: how many turns, dealt in [min, max]; how fast they come out
   * on their own and kicked, rad/s (a few turns take half a minute left
   * alone, a few seconds kicked); the canopy's own turn, as a share of a
   * full toggle, at `full` turns and over. */
  twist: { min: 1, max: 4, unwind: 0.55, kick: 2.6, turn: 0.55, full: 3 },
  /** A LINE OVER: the share of the canopy's area pinched off with the tip,
   * the lift the rest loses (a share), the drag the tangle adds, and its
   * turn as a share of a full toggle — past what the other toggle (1) can
   * hold: a spinning descent two to three times a canopy's. */
  lineover: { area: 0.5, lift: 0.25, drag: 0.12, turn: 3 },
  /** A HARD OPENING: the snivel's and the inflation's durations as a share
   * of a normal opening's — the slider slammed down. Past `hurt` g the
   * opening's load is a blow on the neck (whipped, times `neck`) and a
   * load down the spine (times `back`). */
  hard: { snivel: 0.06, inflate: 0.45, hurt: 7, neck: 2.4, back: 1.15 },
  /** THE CRAVAT: the side collapse it follows (its depth, 0..1), the lift
   * and drag of the tip held in the lines, its turn per qS (a full toggle
   * with the weight shifted is 0.27 — held, barely, against it), and the
   * chance a sharp, deep pull of the brakes frees it. A pump is the brakes
   * past `pull` from under `slack` inside `snap` s. */
  cravat: {
    depth: 0.5,
    lift: 0.22,
    drag: 0.05,
    turn: 0.22,
    clear: 0.35,
    pull: 0.85,
    slack: 0.25,
    snap: 0.6,
  },
  /** THE PARAMOTOR'S TWISTS after a launch: how many turns, dealt in
   * [min, max]. */
  paraTwist: { min: 1, max: 2.2 },
  /** AN ENGINE STOPPAGE, plane and helicopter: due a dealt number of
   * seconds after lift-off, only once at least `agl` m over the snow (else
   * held until it is); the plane coughs for `cough` s first. */
  engine: {
    plane: { after: [25, 200], agl: 150, cough: 3 },
    heli: { after: [20, 160], agl: 80, cough: 0.6 },
  },
} as const;

/** THE HELICOPTER WITH NO ENGINE (`heli.ts`'s autorotation). With the
 * engine running the machine is flown on momentum theory's thrust at a
 * governed rpm (`thrustMost`); with it failing, the rotor is a blade
 * element: the thrust T = ρA(ΩR)²·σa/2·(θ/3 − λ/2) off the blades' pitch θ
 * (the collective, from `pitch[0]` full down to `pitch[1]` full up, rad)
 * and the inflow λ = (v_n + v_i)/ΩR through the disc — so a descent's air
 * coming UP through it (λ under naught) lifts a lowered collective, as a
 * real rotor autorotating does. The class's rotor: solidity `solidity`
 * (three blades of ~0.3 m chord on 5.35 m), lift slope `slope` per rad —
 * about 8.5° of pitch at the hover. The rotor's inertia about its shaft,
 * kg·m², is a three-bladed rotor of this class's (the low-rotor horn about
 * a second and a half after a stoppage with the collective left where it
 * was); the profile power at full rpm, W, ~0.3 of the hover's, at the rpm
 * cubed and growing with the blades' pitch squared (`drag` at the pitch's
 * top); under `stall` of the rpm the blades stall — none of their lift
 * left by `dead`, and their drag `stallDrag` times over with the
 * collective up, which is why a rotor let go that low does not come
 * back; it oversped to `most`. */
export const AUTOROTATION = {
  pitch: [0.035, 0.26],
  solidity: 0.0535,
  slope: 5.7,
  inertia: 900,
  profile: 75e3,
  drag: 2.5,
  stall: 0.72,
  dead: 0.55,
  stallDrag: 6,
  most: 1.12,
  /** The low-rotor horn: under this share of the rpm. */
  horn: 0.92,
  /** The blades' pitch at the top of the collective's travel, rad (18°,
   * a light helicopter's stop): the most the blades can lift in the air
   * meeting them (`thrustMost`), so a disc moving along its own thrust —
   * climbing hard, or turned over and falling — runs out of lift once
   * that air takes their angle of attack, by some 45 m/s through it. */
  pitchMost: 0.32,
} as const;
