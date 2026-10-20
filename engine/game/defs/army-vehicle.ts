// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND WAVES' VEHICLES (`army-vehicle.ts`): the tracked over-snow
// carriers, the trucks and the tanks a ground wave's mix names
// (`WANTED.waves`, read with `groundWave`). Every number carries its unit;
// `docs/army.md` § *The waves' vehicles* gives the reasoning beside each
// block.
//
// WHAT EACH IS (the class, never a maker's model — each row is the band
// the service vehicles of its class sit in, restated from the open
// references in our own words):
//   * THE TRACKED CARRIER is the articulated over-snow carrier the
//     northern armies move troops in: two short units on four wide rubber
//     band tracks, a cab with the engine in front and a troop body behind,
//     joined by a steered hitch — some 6.8–7.6 m long overall, 1.9–2.2 m
//     wide and 2.2–2.4 m tall, 4.5 t unarmoured and some 11 t armoured,
//     about 50 km/h on a road and half that in deep snow, and on its wide
//     tracks (a ground pressure near a man on skis') it climbs slopes of
//     up to 100 % on firm snow. The front unit seats the driver and three
//     or four, the rear a section of eight to eleven.
//   * THE TRUCK is a cross-country cargo truck, six wheels driven, a cab
//     forward and a canvas tilt over the bed, chains on its wheels in
//     winter: some 8 m long, 2.5 m wide and 3.4 m tall to the tilt, about
//     15 t laden; 85 km/h on a road, and on packed snow a grade of 30 %
//     or so before its chains spin. Its bed seats two squads facing in.
//   * THE TANK is a main battle tank: a 7.5–8 m hull (some 10 m with the
//     gun forward), 3.6–3.8 m wide and 2.4–3 m to the turret's roof, 55–
//     65 t; about 70 km/h on a road and 40–50 off it; 60 % grades and a
//     30–40 % side slope. Its turret traverses a full circle in about
//     nine seconds (40°/s); the gun elevates to +20° and depresses to
//     −9°; a high-explosive round is laid and fired from a short halt
//     every six to ten seconds (`WEAPONS.tankGun`).
// In winter all three are painted white or white-washed over their green
// in broken patches, which breaks the outline better than solid white.

export type ArmyVehicleKind = "carrier" | "truck" | "tank";

/** ONE KIND'S BODY AND DRIVE. */
export type VehicleSpec = {
  /** The plan as a box, m: half its length (the front unit's, for the
   * carrier) and its width, and its top over the snow. */
  halfLength: number;
  halfWidth: number;
  height: number;
  /** Its mass laden, kg (what a blow from it weighs). */
  mass: number;
  /** THE DRIVE: the pace over open snow and among trees, m/s; how hard it
   * gathers and sheds pace, m/s²; how fast it turns at the most, rad/s,
   * and — wheels, not tracks — the tightest turn, m (0: it pivots). */
  cruise: number;
  woods: number;
  accel: number;
  brake: number;
  turn: number;
  radius: number;
  /** THE GROUND IT TAKES: the steepest rise it climbs and the steepest
   * drop it goes down, as a slope; and the share of its pace it keeps up
   * a rise at its limit (it slows to it in proportion). */
  climb: number;
  cliff: number;
  creep: number;
  /** Its crew's eyes over the snow, m (the commander in his hatch). */
  eyes: number;
  /** The men it carries to put down. */
  seats: number;
};

export const ARMY_VEHICLE = {
  kinds: {
    carrier: {
      halfLength: 1.75,
      halfWidth: 0.95,
      height: 2.3,
      mass: 5500,
      cruise: 9,
      woods: 4,
      accel: 1.6,
      brake: 4,
      turn: 0.7,
      radius: 0,
      climb: 0.8,
      cliff: 0.9,
      creep: 0.35,
      eyes: 2.5,
      seats: 8,
    },
    truck: {
      halfLength: 4,
      halfWidth: 1.25,
      height: 3.3,
      mass: 15000,
      cruise: 11,
      woods: 4,
      accel: 1.4,
      brake: 4,
      turn: 0.45,
      radius: 11,
      climb: 0.3,
      cliff: 0.4,
      creep: 0.4,
      eyes: 2.6,
      seats: 12,
    },
    tank: {
      halfLength: 3.9,
      halfWidth: 1.85,
      height: 2.6,
      mass: 60000,
      cruise: 9,
      woods: 3.5,
      accel: 1.2,
      brake: 5,
      turn: 0.45,
      radius: 0,
      climb: 0.6,
      cliff: 0.7,
      creep: 0.3,
      eyes: 3,
      seats: 0,
    },
  } satisfies Record<ArmyVehicleKind, VehicleSpec>,

  /** THE CARRIER'S REAR UNIT: its middle `hitch` m behind the front's, and
   * how far back from the hitch, m — it trails the front about the hitch
   * as a trailer does (the steered articulation). */
  rear: { hitch: 2.05, back: 1.85 },

  /** THE MOST VEHICLES OF THE WAVES OUT AT ONCE, by stars (index = stars):
   * the engine's bound on what they cost a step. */
  most: [0, 0, 2, 4, 8, 12] as readonly number[],

  /** WHERE THEY COME FROM: the way up the wave climbs (`wayDown`), read
   * `back` m further down it than the column forms up — out of his sight
   * — or its end; the next of a wave `stagger` s after the one before, and
   * none set off with another within `room` m of the spot. */
  back: 260,
  stagger: 6,
  room: 14,

  /** READING THE SNOW (`army-drive.ts`, as the snowmobiles read it): the
   * way ahead read `look` m, every `step` m, at `fan` headings either side
   * spread over `spread` rad, chosen again every `decide` s; a point of the
   * way up taken within `reach` m of it. */
  drive: { look: 40, step: 8, fan: 6, spread: 1.4, decide: 0.25, reach: 12 },
  /** What a heading costs: `turn` a radian off the way wanted, `blocked` a
   * metre short of `look` it is stopped, `tree` a solid near its line
   * (within `trunk` m past its half width), `keep` a radian off the way
   * held; open water within `water` m and the map's edge within `edge` m
   * are no way at all. */
  terrain: { turn: 6, blocked: 1.2, tree: 4, keep: 1.5, trunk: 1.5, water: 8, edge: 40 },

  /** PUTTING THE MEN DOWN: a carrier halts and they get out once it is
   * within `carrier` m of him with him in sight (or within `blind` m out
   * of it); a truck at the top of the way it can drive, or `truck` m from
   * him. Out of the back a man every `every` s, `out` m behind it, and it
   * moves on `linger` s after the last. */
  drop: { carrier: 170, blind: 110, truck: 320, every: 0.45, out: 3, linger: 2 },

  /** THE TANK'S FIGHT: it stands off him `lethal` m shooting to kill and
   * `sfw` m with SAFE FOR WORK on, closes to run him down where he is
   * within `ram` m (INJURIES on); with him in sight within `range` m —
   * or, out of its own crew's sight, CUED onto him by whoever of the hunt
   * sees him (the radio) within `cued` m — it halts to fire (no sooner than `least` s after the last halt ended),
   * brakes under `still` m/s, lays the gun at `traverse` rad/s and
   * `elevate` rad/s between `low` and `high` rad, and fires once it is
   * laid within `laid` rad, up to `shots` rounds or for `hold` s. The
   * muzzle stands `muzzle` m forward of the turret ring and `ring` m up. */
  tank: {
    lethal: 260,
    sfw: 90,
    ram: 45,
    range: 900,
    cued: 450,
    least: 5,
    still: 0.6,
    traverse: 0.7,
    elevate: 0.12,
    low: -0.16,
    high: 0.35,
    laid: 0.015,
    shots: 2,
    hold: 14,
    muzzle: 5.2,
    ring: 2.3,
    /** WARNING SHOTS with SAFE FOR WORK on: laid `near` to `far` m to a
     * side of him, never nearer — past its shell's throw. */
    warn: { near: 55, far: 85 },
  },

  /** CLOSING ON HIM: every vehicle but a tank running him down stops
   * `stop` m short of him. Met by its front faster than `strike` m/s it
   * knocks him down (the `armour` crash). */
  stop: 9,
  strike: { closing: 2.5, least: 6, hard: 1.5, give: 0.004 },

  /** NOT GETTING STUCK (the snowmobiles' watch): progress checked every
   * `window` s; under `least` m in one, it swings off to a side for
   * `detour` s; a second, it backs `dig` m down its own track; a third and
   * it is STUCK (the lab's count, always 0) and is put back on the way up
   * at the point behind it. */
  stuck: { window: 5, least: 2.5, detour: 4, dig: 8 },

  /** SENT HOME: further than `behind` m from where he was last seen, or —
   * the hunt over — `home` m from him, a vehicle is taken off the map; a
   * nearer one drives back down the way it came and is gone after
   * `leave` s. */
  behind: 1300,
  home: 450,
  leave: 90,

  /** Ids: the crews are pursuers `pursuer` + n; the tanks' guns `gun` + n;
   * a vehicle's men a squad `squad` + n. */
  ids: { pursuer: 6000, gun: 96_000, squad: 40_000 },
} as const;
