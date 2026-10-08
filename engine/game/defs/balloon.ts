// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON — the numbers `balloon.ts` flies a free ride's balloon
// on, and the geometry the drawing is built to. Stated once here;
// `docs/hot-air-balloon.md` explains every block and where it comes from.
//
// THE CLASS is a sport balloon of the "90" size (about 90,000 cubic feet,
// 2,550 m³): three or four aboard, a wicker basket on a stainless frame, a
// double burner fired by one blast valve, three propane cylinders standing
// in the basket's corners, a parachute valve in the crown pulled open on a
// cord. Numbers are the class's as its flight manuals and the published
// research state them (see the doc): a nylon envelope coated against the
// heat whose fabric may not run past about 120 °C (a fusible link in the
// crown melts near 127 °C to say it has), a burner of a few megawatts per
// coil, a climb or a descent of a few metres a second, a lag of tens of
// seconds between a burn and the climb it buys, and a pilot who stays on
// the ground in a surface wind past about 7.5 m/s.
//
// THE FRAME is the engine's: x to the right, y up, z forward along the
// basket's heading. The basket's FLOOR CENTRE is the balloon's position
// (`BalloonState.x/y/z`); everything else is measured from it.

export const BALLOON = {
  /** THE ENVELOPE as built: its volume, m³; its widest diameter (the
   * equator), m; its height from the mouth to the crown, m; the equator's
   * height over the mouth, m (a natural shape is widest above its middle);
   * the mouth's (the throat's) diameter, m, and its height over the
   * basket's floor, m (the load cables and the burner frame between); the
   * crown's parachute valve's diameter, m; the GORES it is sewn from (the
   * vertical panels between load tapes); and the fabric's area, m². */
  envelope: {
    volume: 2550,
    diameter: 17.2,
    height: 19.5,
    equator: 11.5,
    mouth: 4.2,
    mouthHeight: 4.6,
    vent: 5.2,
    gores: 16,
    surface: 960,
  },
  /** THE BASKET: its floor, m (wide across x, long along z), the wall's
   * height, m, and the burner's height over the floor, m (on its frame, the
   * coils' outlets just under the mouth's reach). */
  basket: { width: 1.35, length: 1.75, wall: 1.12, burner: 2.4 },
  /** THE MASSES, kg: the envelope's fabric, tapes and valve; the basket
   * with its frame and floor; the burner with its frame and hoses; the
   * cylinders empty; the propane they hold when full. The skier's own mass
   * (`totalMass`) is added while he is aboard. */
  mass: { envelope: 140, basket: 85, burner: 32, cylinders: 51, fuel: 60 },
  /** THE AIR it flies in, as the standard atmosphere has it: the air at the
   * sea's level, °C (a winter day's), the lapse, K/m, the pressure there,
   * Pa, the gas constant of dry air, J/(kg K), its heat capacity, J/(kg K),
   * and the sky's radiating temperature under the air's, K (a clear winter
   * sky is far colder than the air the envelope sits in). */
  air: { sea: -3, lapse: 0.0065, pressure: 101325, gas: 287.05, cp: 1005, sky: 20 },
  /** THE BURNER: its gross output with the blast valve open, W (two coils
   * of about 2.5 MW each); the share of it that ends up in the envelope's
   * air (the rest radiated out the mouth and lost to the flame's own
   * plume); the propane's heating value, J/kg; how fast the flame comes on
   * and goes off after the valve, s; and the input above which the blast
   * valve is open (it is on or off). */
  burner: { power: 5.0e6, efficiency: 0.7, heating: 46.4e6, lag: 0.25, open: 0.5 },
  /** THE ENVELOPE'S HEAT LOSS: radiation, the fabric's effective
   * emissivity (most of the loss, the research says some 70 %); and
   * convection off both faces, a still-air coefficient, W/(m² K), rising by
   * `forced` for every m/s of air past it (forced convection in a wind,
   * a climb or a descent). */
  loss: { emissivity: 0.45, still: 1.5, forced: 1.0 },
  /** THE PARACHUTE VALVE: the most heat its opening dumps, W/K of the
   * envelope's excess temperature (the hot air out of the crown, cold air
   * drawn in at the mouth), and how fast it follows the cord pulled and
   * reseals let go, s. */
  vent: { most: 30000, lag: 0.6 },
  /** THE AIR AGAINST IT: the drag coefficient climbing or sinking (on the
   * envelope's plan area) and drifting (on its side area: `sideShare` of
   * the diameter times the height), and the added mass, a share of the air
   * it displaces (a body accelerating a fluid drags some of it along). */
  drag: { vertical: 0.6, horizontal: 0.45, sideShare: 0.8, added: 0.5 },
  /** THE LIMITS: the fabric's working limit, °C (the HUD's red line, the
   * `hot` call); and past `fails` the fabric weakens and scorches. */
  temp: { limit: 120, fails: 135 },
  /** THE FIRE. The skirt and the scoop keep a wind off the flame up to
   * `shear`, m/s of air past the envelope; past it the mouth is pushed in
   * over the burner and every second of burning scorches the fabric at
   * `(air − shear) / scorch` of the way to alight. Past `temp.fails` it
   * scorches at `(T − fails) / cook` a second, burner or not. Alight, the
   * fabric burns away over `burnFor` s: the hot air pours out of the holes
   * (`leak`, W/K at the whole envelope gone), the lift with it, and the
   * cloth left streams as a drag area of `streamer` of the plan. */
  fire: { shear: 7, scorch: 3, cook: 10, burnFor: 12, leak: 90000, streamer: 0.25 },
  /** THE GROUND: the speed into the snow (along its normal) past which the
   * basket is a CRASH, m/s; the speed along it, dragged by the envelope,
   * past which it goes over and throws him out, m/s; the wicker's friction
   * on the snow; the speed below which he may step out, m/s; how fast a
   * trunk may be met and the basket only snagged in its crown, m/s; and
   * how long an envelope on the snow takes to lie down, s. */
  land: { hard: 4.5, dragMost: 7, friction: 0.35, stepOut: 0.6, tree: 3, deflate: 20 },
  /** THE TETHER at the start: the balloon stood up inflated on the valley
   * floor, held down by its tether, `heavy` short of flying (as a share of
   * its weight) — the first burn makes it light, and it is let go when its
   * lift beats its weight by `release`, N. */
  tether: { heavy: 0.02, release: 150 },
  /** THE SITE: the room it is stood up in on the valley floor, m (the
   * envelope's radius and a margin), the steepest lean it is stood on,
   * and the room kept from the helicopter's pad, m. */
  site: { room: 14, slope: 0.06, fromPad: 70 },
  /** WALKING IN THE BASKET: his pace, m/s (a shuffle in ski boots), and
   * how close his boots come to the wall, m. */
  walk: { speed: 0.9, wall: 0.25 },
  /** THE BASKET'S LEAN under his weight: the height over the floor of the
   * point it hangs from (the load ring under the mouth), m, and of the
   * hanging load's centre of mass, m. */
  hang: { pivot: 4.2, cog: 0.7 },
  /** OVER THE SIDE: the push he jumps with, out and up, m/s. */
  jump: { out: 2.2, up: 1.6 },
  /** A CRASH: how long he lies before the ride starts again, s. */
  crash: { lieFor: 6 },
} as const;

/** The balloon's own mass empty, kg (the fabric, the basket, the burner, the
 * cylinders — no fuel, no pilot). */
export const BALLOON_EMPTY =
  BALLOON.mass.envelope + BALLOON.mass.basket + BALLOON.mass.burner + BALLOON.mass.cylinders;

/** The envelope's plan area, m², and its side area, m². */
export const BALLOON_PLAN = (Math.PI / 4) * BALLOON.envelope.diameter ** 2;
export const BALLOON_SIDE =
  BALLOON.drag.sideShare * BALLOON.envelope.diameter * BALLOON.envelope.height;

/** The height of the envelope's centre over the basket's floor, m — where
 * its drag and its lift act and where the wind on it is read. */
export const BALLOON_CENTRE = BALLOON.envelope.mouthHeight + BALLOON.envelope.height * 0.5;
