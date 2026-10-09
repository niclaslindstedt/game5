// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER — the numbers `heli.ts` flies a free ride's helicopter on,
// and the geometry the drawing and the Blender model are built to
// (`scripts/blender/heli.py` is handed this table, never numbers of its
// own). Stated once here; `docs/helicopter.md` explains every block.
//
// THE MACHINE is the light single-engine utility helicopter heli-ski
// operators fly: a three-bladed main rotor of about 10.7 m across turning at
// about 390 rpm (a tip speed near 220 m/s), a two-bladed tail rotor of about
// 1.9 m across at about 2,050 rpm on the right of a slim boom, skid gear on
// two cross tubes, a glazed cabin for a pilot and five or six skiers, and a
// maximum weight of about 2,250 kg — flown here at a working weight of
// pilot, fuel and kit. The guests ride inside; THE SKIER rides on the
// RIGHT SKID, sat on the tube between the cross tubes with his skis on, his
// legs hanging out over the snow, ready to push off.
//
// THE FRAME is the skier's: x to the right, y up, z forward (the nose), the
// origin on the ground under the middle of the skids — THE SKID DATUM, so a
// helicopter resting on level snow stands at y = groundAt.

export const HELI = {
  /** THE WORKING WEIGHT, kg: about 1,175 kg empty, a pilot, a guide, three
   * quarters of the fuel and the ski basket. The skier on the skid is added
   * on top while he rides it. */
  mass: 1780,
  /** The turning inertias about the CoG, kg·m² (roll, yaw, pitch) — a light
   * helicopter's, a slim fuselage long fore and aft. What a torque off the
   * attitude (the rider's weight off the centre line, a gust on the fin)
   * swings it by before the stabilisation catches it. */
  inertia: { roll: 1600, yaw: 4200, pitch: 4800 },
  /** THE CoG above the skid datum, m. */
  cog: 1.25,

  /** THE MAIN ROTOR: radius, m; blades; rpm; the hub's height above the
   * skid datum and its place fore of the datum, m. */
  rotor: { radius: 5.35, blades: 3, rpm: 390, hub: 3.15, at: 0.15 },
  /** THE TAIL ROTOR: radius, m; blades; rpm; its hub (x right of the
   * boom's end — this class's tail rotor is on the right — y up, z aft), m. */
  tail: { radius: 0.93, blades: 2, rpm: 2050, hub: { x: 0.36, y: 2.0, z: -5.9 } },
  /** THE AIRFRAME as the drawing and the crash read it, m: the nose's and
   * the tail fin's reach along z, the cabin's width and its roof, the
   * boom's height — and every point the crash tests against the snow
   * (`strike`, body frame). */
  body: {
    nose: 3.7,
    tail: -7.2,
    width: 1.86,
    floor: 0.72,
    roof: 2.49,
    boom: 1.88,
    strike: [
      { x: 0, y: 1.0, z: 3.5 }, // the chin bubble
      { x: 0, y: 1.15, z: -6.75 }, // the ventral fin's foot
      { x: 0, y: 3.37, z: -7.1 }, // the fin's top
      { x: 0, y: 1.5, z: -4.0 }, // the boom's belly
      { x: 0.36, y: 1.07, z: -5.9 }, // the tail rotor's lowest tip
    ],
  },
  /** THE SKIDS: the track between them, their fore and aft ends and the
   * tube's centre height above the datum, m, and the two cross tubes' z. */
  skid: { track: 2.2, front: 1.6, back: -1.5, y: 0.04, tube: 0.04, cross: [0.95, -0.55] },
  /** WHERE THE SKIER SITS, body frame, m: on the right skid's tube between
   * the cross tubes, facing out over it (+x). */
  seat: { x: 1.1, y: 0.08, z: 0.1 },

  /** THE POWER, as momentum theory spends it (`heli.ts`'s `thrustMost`): the
   * shaft power that reaches the induced flow, W (the engine's ~630 kW less
   * the profile power and the tail rotor, folded into a figure of merit
   * near 0.65 — the generous end, so the lever climbs it briskly: nearly
   * twice its weight at the hover and its weight alone at ~18 m/s of climb),
   * the air's density the rotor works in, kg/m³ (held: there is no ceiling,
   * by design), and the parasite flat plate, m², whose power at speed
   * (½ρfV³) is taken off what the rotor has. */
  power: 420e3,
  density: 1.0,
  flatPlate: 1.4,
  /** GROUND EFFECT (Cheeseman & Bennett): the thrust at a power multiplied
   * by 1 / (1 − (R / 4z)²), z the hub's height over the snow — held to
   * `groundMost` at the skids. */
  groundMost: 1.3,

  /** THE AIR ON THE AIRFRAME: frontal, side and plan areas times their drag
   * coefficients, m², at the density above. */
  drag: { front: 1.4, side: 11, plan: 14 },
  /** THE FIN turning the nose into the relative wind, 1/s² per m/s of side
   * slip — the weathervane the pedals hold against. */
  vane: 0.002,

  /** THE FLIGHT, BY HAND — the rotor's authority and the airframe's own
   * answer, with nothing of an autopilot between them (`heli.ts`):
   *   * THE DISC. The cyclic tilts the rotor disc, and the thrust goes
   *     where the disc points. `cyclic` is the pitch and roll acceleration
   *     full cyclic gives the disc at full rpm, rad/s², and `damping` the
   *     rotor's damping of a pitch and a roll rate, 1/s — so the cyclic
   *     sets a rate, and let go the disc stays where it was left: neutral,
   *     never levelling itself. `flapback` is the disc blown back by the
   *     air through it, rad/s² per m/s: nose up in forward flight, away
   *     from a sideways one — held off with the cyclic.
   *   * THE FUSELAGE hangs under the hub like a pendulum (`hang`: its
   *     natural frequency, rad/s, and its damping ratio) — swinging under
   *     the disc as it is thrown about, and hanging off the centre line by
   *     the weight of the skier on its skid.
   *   * THE PEDALS. `pedal` is the yaw acceleration full pedal gives, rad/s²,
   *     and `yawDamping` the tail rotor's and the fin's damping, 1/s; the
   *     main rotor's TORQUE turns the nose left by `torque` rad/s² for
   *     every share of the hover's thrust it pulls over it (and right as it
   *     is lowered) — so the collective wants the pedals with it.
   *   * THE COLLECTIVE is the thrust's share of what the rotor can give,
   *     answered in `lag` s.
   * Nothing stops the disc: held over, it carries on past the vertical and
   * round, so a machine high enough can be rolled and looped. */
  flight: {
    cyclic: { pitch: 1.6, roll: 2.2 },
    damping: { pitch: 2.0, roll: 2.6 },
    flapback: 0.004,
    hang: { frequency: 4.5, damping: 0.35 },
    pedal: 1.8,
    yawDamping: 1.5,
    torque: 1.2,
    lag: 0.3,
  },

  /** THE BOT'S HANDS on the same controls (`heli-pilot.ts`) — what a link's
   * pre-roll, a card's run behind it, the labs and the pilot flying home
   * fly with:
   *   * `cruise` the speed it makes for, m/s, `brake` how hard it plans to
   *     slow, m/s², and `tilt` the most it tilts the disc for either, rad;
   *   * `climb` and `sink` the vertical speeds it flies at most, m/s — the
   *     sink held to `sinkSlow` near the hover, under the vortex ring's
   *     onset (a quarter to half the hover's induced velocity);
   *   * `attitude` its hands' natural frequency on the disc, rad/s, and
   *     their damping ratio; `hold` its gain on a vertical speed missed, 1/s;
   *   * `clear` the height over the snow it flies at with nothing asked, m,
   *     and `settle` the sink it sets down at, m/s. */
  pilot: {
    cruise: 40,
    brake: 1.6,
    tilt: 0.35,
    climb: 8,
    sink: 6,
    sinkSlow: 2.5,
    attitude: 3,
    damping: 0.9,
    hold: 1.5,
    clear: 45,
    settle: 0.8,
  },

  /** THE ROTOR SPOOLED UP and down, its share of the full rpm a second. */
  spool: 0.22,

  /** ON THE SNOW AND INTO IT (`heli.ts`'s crash):
   *   * `sink` the vertical speed the skids take on landing, m/s (the gear
   *     is certified for 2.5 with a reserve to 3.1), and
   *     `slide` the speed along the snow, m/s — past either it is a crash;
   *   * `tilt` the most the airframe may stand off the snow's own lean, and
   *     `slope` the steepest snow it can be landed on, rad (past it the
   *     skid rolls over — the dynamic rollover; a flight manual's slope
   *     limits are 6–10°, and a machine pivoting on one skid is past saving
   *     at 5–8°, held a little wider here for the arcade);
   *   * `clear` the gap the rotor's tips must keep from the snow and a
   *     crown, m;
   *   * `wreck` the seconds the wreck burns before the ride starts again
   *     from the pad — long enough to watch the fireball rise and the
   *     pieces come down, the skier it threw lying where he fell until
   *     then;
   *   * `blast` the push the blast throws the skier on the skid off it
   *     with, m/s, out from the machine's side and up, on top of the way
   *     it was going — a man flung tens of metres. */
  crash: {
    sink: 3.2,
    slide: 5,
    tilt: 0.2,
    slope: 0.16,
    clear: 0.15,
    wreck: 7,
    blast: { out: 15, up: 10 },
  },

  /** BOARDING AT THE PAD: how near the seat a skier rides in to be taken
   * on, m, the fastest he may be going, m/s (a skier's cruise, about
   * 43 km/h — he need not stop dead), and the seconds he is sat on the
   * skid over. */
  board: { reach: 6, fastest: 12, sit: 0.8 },
  /** THE DROP: the push he leaves the skid with, out and up, m/s. */
  drop: { out: 1.6, up: 0.6 },

  /** THE GRIP (`heli-grip.ts`): the skier on the skid is sat on its tube,
   * his back to the cabin, holding on with his hands — nothing straps him
   * in. The seat carries what presses him into it and the cabin's side what
   * pushes him back against it, each holding `friction` of the load along
   * them; the rest is HIS HANDS' — judged against his weight as gravity
   * pulls it (an arcade rule: the rotor's own pull, which in a steady
   * inverted push would press him into the seat, is left out, so a machine
   * turned over sheds him). Up to `hold` of his weight he holds for as long
   * as he likes (a firm two-handed hold on a tube); past it the hold drains,
   * all of it in `endure` s at his whole weight hung off his hands (the
   * dead hang of a gloved grip on a cold tube, rounded down for a body
   * being shaken), slower under less, and comes back in `recover` s once
   * the load is under `hold` again. A bank of 45° toward his side is
   * held; turned over, or banked or pitched past some 60°, he goes.
   * `middle` is how far his middle sits over the seat's origin, m — where
   * his fall off it is read from. */
  grip: { friction: 0.5, hold: 0.45, endure: 1.1, recover: 3, middle: 0.5 },
  /** INTO THE ROTOR (`heli-grip.ts`): a skier let go of the skid falls in
   * the MACHINE'S OWN FRAME — gravity alone, as though the airframe stood
   * still under him — for `carry` s at most, while his fall runs through
   * the disc (an arcade rule, so a machine turned over over him is what he
   * falls into rather than what the rotor's pull hauls away from him). A
   * point of his body crossing the disc between `mast` m and its radius of
   * the mast with the rotor over `spool` of its rpm is struck by a blade:
   * the blade's speed there (Ω·r: some 45 m/s a metre out, 220 at the
   * tip), of which a piece torn off takes `fling` (at most `flingMost`
   * m/s) and the body it leaves `kick`, along the blade's way, and the
   * downwash's `wash` m/s down through the disc. */
  blades: { carry: 1.6, mast: 0.3, spool: 0.4, fling: 0.3, flingMost: 34, kick: 0.04, wash: 9 },

  /** THE PAD on the valley floor (`heli-pad.ts`): the radius kept clear,
   * m, and the steepest snow it may stand on, rad. */
  pad: { radius: 14, slope: 0.08 },

  /** THE PILOT FLYING HOME after the drop (`heli.ts`, on the bot's hands):
   * the height over the snow he keeps, m, and the beat the controls stay
   * where the skier left them before he takes them, s. */
  home: { clear: 70, beat: 1 },

  /** THE ROTOR'S WASH (`washAt`): what momentum theory says comes off a
   * hovering disc — the induced velocity √(T / 2ρA), doubled in the far
   * wake — spread radially along the snow as the outwash wall jet, which
   * falls off as 1/r past `core` rotor radii and is gone past `reach`
   * rotor diameters of height. */
  wash: { core: 1.7, reach: 2.5 },
} as const;
