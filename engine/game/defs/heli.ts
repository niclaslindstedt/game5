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
  tail: { radius: 0.93, blades: 2, rpm: 2050, hub: { x: 0.36, y: 1.65, z: -6.55 } },
  /** THE AIRFRAME as the drawing and the crash read it, m: the nose's and
   * the tail fin's reach along z, the cabin's width and its roof, the
   * boom's height — and every point the crash tests against the snow
   * (`strike`, body frame). */
  body: {
    nose: 3.7,
    tail: -6.88,
    width: 1.86,
    floor: 0.72,
    roof: 2.35,
    boom: 1.75,
    strike: [
      { x: 0, y: 0.75, z: 3.6 }, // the chin bubble
      { x: 0, y: 1.2, z: -6.7 }, // the tail fin's foot
      { x: 0, y: 2.5, z: -6.85 }, // the fin's top
      { x: 0, y: 1.2, z: -4.0 }, // the boom's belly
      { x: 0, y: 0.72, z: -6.55 }, // the tail rotor's lowest tip
    ],
  },
  /** THE SKIDS: the track between them, their fore and aft ends and the
   * tube's centre height above the datum, m, and the two cross tubes' z. */
  skid: { track: 2.2, front: 1.6, back: -1.5, y: 0.04, tube: 0.04, cross: [0.95, -0.8] },
  /** WHERE THE SKIER SITS, body frame, m: on the right skid's tube between
   * the cross tubes, facing out over it (+x). */
  seat: { x: 1.1, y: 0.08, z: 0.1 },

  /** THE POWER, as momentum theory spends it (`heli.ts`'s `thrustMost`): the
   * shaft power that reaches the induced flow, W (the engine's ~630 kW less
   * the profile power and the tail rotor, folded into a figure of merit),
   * the air's density the rotor works in, kg/m³ (held: there is no ceiling,
   * by design), and the parasite flat plate, m², whose power at speed
   * (½ρfV³) is taken off what the rotor has. */
  power: 300e3,
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

  /** THE ARCADE PILOT — what the controls ask of the attitude and the
   * collective, and the stabilisation that flies it there:
   *   * `pitch` the nose down the tuck asks (and `back` up the brake asks),
   *     rad;
   *   * `bank` the most it rolls into a turn, rad; `turn` the yaw rate full
   *     steer asks at the hover and `turnFast` at speed, rad/s (`turnAt`
   *     the speed between, m/s);
   *   * `climb` and `sink` the vertical speeds the lean asks, m/s — the
   *     sink held to `sinkSlow` near the hover, where a faster descent
   *     would settle the rotor into its own wash (the vortex ring, which
   *     sets in at a quarter to a half of the hover's induced velocity);
   *   * `attitude` the stabilisation's natural frequency, rad/s, and its
   *     damping; `hold` the collective's gain on a vertical speed missed,
   *     1/s;
   *   * `lag` the collective's and the rotor's answer to a change, s;
   *   * `coordinate` the share of the side slip the fin and the pilot's
   *     feet take out each second, 1/s — the arcade's hand that keeps the
   *     helicopter going the way it points. */
  pilot: {
    pitch: 0.36,
    back: 0.22,
    bank: 0.62,
    turn: 1.0,
    turnFast: 0.42,
    turnAt: 35,
    climb: 10,
    sink: 9,
    sinkSlow: 3,
    attitude: 3.2,
    damping: 0.85,
    hold: 2.2,
    lag: 0.3,
    coordinate: 0.9,
  },

  /** THE ROTOR SPOOLED UP and down, its share of the full rpm a second. */
  spool: 0.22,

  /** ON THE SNOW AND INTO IT (`heli.ts`'s crash):
   *   * `sink` the vertical speed the skids take on landing, m/s, and
   *     `slide` the speed along the snow, m/s — past either it is a crash;
   *   * `tilt` the most the airframe may stand off the snow's own lean, and
   *     `slope` the steepest snow it can be landed on, rad (past it the
   *     skid rolls over — the dynamic rollover; a flight manual's slope
   *     limits are 6–10°, and a machine pivoting on one skid is past saving
   *     at 5–8°, held a little wider here for the arcade);
   *   * `clear` the gap the rotor's tips must keep from the snow and a
   *     crown, m;
   *   * `wreck` the seconds the wreck burns before the ride starts again
   *     from the pad. */
  crash: { sink: 4.5, slide: 7, tilt: 0.2, slope: 0.16, clear: 0.15, wreck: 4.5 },

  /** BOARDING AT THE PAD: how near the seat a skier rides in to be taken
   * on, m, the fastest he may be going, m/s, and the seconds he is sat on
   * the skid over. */
  board: { reach: 3.2, fastest: 9, sit: 0.8 },
  /** THE DROP: the push he leaves the skid with, out and up, m/s. */
  drop: { out: 1.6, up: 0.6 },

  /** THE PAD on the valley floor (`heli-pad.ts`): the radius kept clear,
   * m, and the steepest snow it may stand on, rad. */
  pad: { radius: 14, slope: 0.08 },

  /** THE PILOT FLYING HOME after the drop (`heli.ts`'s autopilot): the
   * height over the snow he keeps, m, the speed he cruises at, m/s, and
   * the distance out from the pad he comes down from, m, how hard he slows
   * for it, m/s², and the beat he holds it level after the drop, s. */
  home: { clear: 70, cruise: 45, approach: 120, brake: 1.6, beat: 1 },

  /** THE ROTOR'S WASH (`washAt`): what momentum theory says comes off a
   * hovering disc — the induced velocity √(T / 2ρA), doubled in the far
   * wake — spread radially along the snow as the outwash wall jet, which
   * falls off as 1/r past `core` rotor radii and is gone past `reach`
   * rotor diameters of height. */
  wash: { core: 1.7, reach: 2.5 },
} as const;
