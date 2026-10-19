// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTER — the geometry the military helicopter is modelled
// to (`scripts/blender/army.py` is handed this table, never numbers of its
// own) and the places on it the army's people use: the doors they sit in
// and slide open, the door guns' mounts and their arcs, the gunners'
// seats, the troops' seats in the doorways and the fast-rope bars they go
// down. Stated once here; `docs/army.md` explains every block and the
// research behind it.
//
// THE MACHINE is the medium twin-engine utility helicopter armies fly
// troops in: a four-bladed main rotor about 14 m across turning at about
// 314 rpm, a two-bladed tail rotor about 2.6 m across high on the fin, two
// turboshafts side by side under one cowl, skid gear, a boxy cabin for a
// crew of two and up to a dozen troops, and a big SLIDING DOOR on each
// side of it, each with a door gun on a pintle at its forward edge. About
// 13 m from the nose to the fin and 17 m with the rotors turning; a
// maximum weight of about 5,400 kg.
//
// THE FRAME is the game's helicopter's (`HELI`): x to the right, y up, z
// forward (the nose), the origin on the ground under the middle of the
// skids — the SKID DATUM. The blocks the model shares with the heli-ski
// machine (`rotor`, `tail`, `body`, `skid`) are named and shaped as `HELI`'s
// are, so one builder's machinery lays either skin. Every place below is
// stated for the RIGHT side; the left is its mirror (x negated), which
// `army-heli-plan.ts` hands out.

export const ARMY_HELI = {
  /** A working weight with a crew of four and a section aboard, kg; the
   * class's maximum is about 5,400. */
  mass: 5200,

  /** THE MAIN ROTOR: radius, m; blades; rpm; the hub's height above the
   * skid datum and its place fore of the datum, m — and the blade's chord,
   * m. It turns anticlockwise seen from above, as the class's does. */
  rotor: { radius: 7.01, blades: 4, rpm: 314, hub: 3.58, at: 0.1, chord: 0.42 },
  /** THE TAIL ROTOR: radius, m; blades; rpm; its hub (x right of the fin, y
   * up, z), m — high on the fin, on its right; its chord, m. */
  tail: { radius: 1.3, blades: 2, rpm: 1660, hub: { x: 0.42, y: 2.9, z: -7.75 }, chord: 0.28 },
  /** THE AIRFRAME, m: the nose's and the fin's reach along z, the cabin's
   * width, its belly and its roof, the boom's height, and the points a
   * crash tests against the snow (body frame) — the fin's top and the
   * ventral fin's foot among them, which the builder reads the fin off. */
  body: {
    nose: 4.62,
    tail: -8.3,
    width: 2.44,
    floor: 0.6,
    roof: 2.56,
    boom: 2.02,
    strike: [
      { x: 0, y: 1.0, z: 4.45 }, // the nose's tip
      { x: 0, y: 1.5, z: -8.05 }, // the ventral fin's foot
      { x: 0, y: 4.05, z: -8.3 }, // the fin's top
      { x: 0, y: 1.72, z: -5.0 }, // the boom's belly
      { x: 0.42, y: 1.6, z: -7.75 }, // the tail rotor's lowest tip
    ],
  },
  /** THE SKIDS: the track between them, their fore and aft ends, the
   * tube's centre height above the datum and its radius, m, and the two
   * cross tubes' z. */
  skid: { track: 2.62, front: 2.15, back: -1.7, y: 0.05, tube: 0.05, cross: [1.25, -0.8] },

  /** THE CABIN'S FLOOR, m over the datum: what a man sat in a doorway sits
   * on, and the doors' sill. */
  sill: 0.7,
  /** THE CABIN inside, m: its floor to its ceiling, the bulkhead behind the
   * crew's seats and the one aft of the troops. */
  cabin: { ceiling: 2.36, front: 1.62, back: -1.02 },

  /** THE SLIDING DOOR on each side: the opening's forward and aft edges
   * (z), its sill and its head (y), m, and how far the door slides aft
   * along the fuselage to stand open — its own width. */
  door: { front: 1.55, back: -0.85, sill: 0.7, head: 1.95, slide: 2.42 },

  /** THE DOOR GUN on each side — a 7.62 mm-class general-purpose machine
   * gun (`WEAPONS.doorGun`) on a pintle at the doorway's forward edge:
   *   * `pivot` where it turns, body frame, m (the right side's);
   *   * `muzzle`, `grip`, `stock` along the gun's own axis from the pivot
   *     (`ahead` out along the barrel, `up` above it), m: where its rounds
   *     leave, where the gunner's right hand is on the pistol grip and his
   *     cheek at the stock;
   *   * `yaw` the arc it turns through either side of square out of the
   *     door, rad (stops keep it off the airframe), and `pitch` how far it
   *     can be raised and depressed, rad. */
  gun: {
    pivot: { x: 1.3, y: 1.62, z: 1.22 },
    muzzle: { ahead: 0.86, up: 0.03 },
    grip: { ahead: -0.27, up: -0.1 },
    stock: { ahead: -0.6, up: -0.02 },
    yaw: 1.2,
    pitch: { up: 0.3, down: 1.05 },
  },
  /** THE GUNNER'S SEAT on each side: inboard of the gun, facing out of the
   * door, its top, m. */
  gunner: { x: 0.6, y: 1.08, z: 1.2 },
  /** THE TROOPS' PLACES IN THE DOORWAY on each side, sat on the cabin's
   * floor at its edge facing out with their legs over the sill, ready to
   * drop onto the skid — along z, m, aft of the gunner. */
  seats: { x: 1.02, z: [0.5, -0.05, -0.6] },
  /** THE BENCH across the aft bulkhead, facing forward, its top and the
   * places on it, m. */
  bench: { y: 1.12, z: -0.72, x: [-0.75, -0.25, 0.25, 0.75] },
  /** THE FAST-ROPE BAR over each door: swung out from the roof's edge over
   * the doorway's middle, the rope's hook at its end, m. */
  rope: { x: 2.1, y: 2.55, z: 0.36 },

  /** THE LIGHTS, body frame, m: the red anti-collision beacons (on the
   * fin's top and under the belly) and the navigation lights (red to port,
   * green to starboard, on the cabin's roof edges over the crew doors). */
  lights: {
    beacons: [
      { x: 0, y: 4.09, z: -8.2 },
      { x: 0, y: 0.52, z: -1.6 },
    ],
    nav: { x: 1.2, y: 2.32, z: 2.6 },
  },
} as const;
