// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE AS DRAWN — its parts' places, decided once off the
// engine's own geometry (`BIKE`, `bike-geometry.ts`) and the class's
// published charts and photographs (`docs/downhill-bike.md`): a long,
// low frame with a short seat tube and the saddle slammed over the rear
// tyre, a dual-crown fork with its crowns either side of a short head tube,
// a single-pivot swingarm with a coil shock lying in the front triangle,
// a wide flat bar on a short direct-mount stem, flat pedals on 165 mm
// cranks, a single chainring under a guide, four-piston brakes on big
// rotors and two knobbly tyres on a 29″ front and a 27.5″ rear. No make or
// model is kept: what is kept is the class's shape, in metres.
//
// THE FRAME it is stated in is the engine's body frame (x the engine's
// right, y up, z forward) with its origin at the BOTTOM BRACKET; `BIKE_BB`
// carries it onto the bike's own centre of mass. The axles move where the
// physics moves them: `frontAxle` is the engine's own (`bikeFrontAxleAt`),
// the rear the engine's path. The DRIVE SIDE — the chain, the chainring and
// the derailleur — stands on the rider's true right as drawn, the body
// frame's −x (`DRIVE`).
//
// Three-free and DOM-free: `bike-view.ts` builds the code's bike off it and
// poses it, `skier-bike.ts` puts the rider's hands and feet where it says,
// a Blender builder can be handed it, and `tests/bike_look_test.ts` holds
// it to the engine's table and the class's bands.

import {
  BIKE,
  BIKE_BB,
  BIKE_REAR_AXLE,
  BIKE_STEER_AXIS,
  bikeFrontAxleAt,
  type BikePose,
} from "@engine";

export type V3 = { x: number; y: number; z: number };

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);
const fromCom = (p: V3): V3 => sub(p, BIKE_BB);

/** The side of the frame the chain runs on, as an x sign: the rider's true
 * right as the picture shows him is the body frame's −x. */
export const DRIVE = -1;

const EPS = (BIKE.headAngle * Math.PI) / 180;
/** Square to the steer axis, forward (the fork offset's way). */
const OFFSET_DIR = v(0, Math.cos(EPS), Math.sin(EPS));
/** The steer axis, up and back along the head tube (unit). */
export const STEER_AXIS: V3 = { ...BIKE_STEER_AXIS };

/** A point on the steer axis, from the bottom bracket: the extended fork's
 * axle less its offset — where the engine's own front axle turns about. */
export const STEER_AT: V3 = (() => {
  const a = bikeFrontAxleAt(0, 0, v(0, 0, 0));
  return sub(fromCom(a), scale(OFFSET_DIR, BIKE.offset));
})();

/** The point on the steer axis at height `y` over the bottom bracket. */
function onAxis(y: number): V3 {
  return add(STEER_AT, scale(STEER_AXIS, (y - STEER_AT.y) / STEER_AXIS.y));
}

/** THE NUMBERS, m. The stack and reach are the chart's (`docs/downhill-
 * bike.md`: stack 0.63, reach 0.457 for a large frame); the rest are the
 * class's measured bands' middles off its photographs. */
export const BIKE_LOOK = {
  stack: 0.63,
  /** The head tube's length (charts 0.10–0.12). */
  headTube: 0.11,
  /** The crowns past each end of the head tube, and the stanchions' and
   * lowers' spread either side of the middle (a dual-crown fork's legs). */
  crown: 0.035,
  forkHalf: 0.072,
  stanchion: { r: 0.0175, length: 0.56 },
  lower: { r: 0.024, length: 0.4 },
  /** The stem (direct-mount, 45–50 mm), the bar's rise and its width
   * (780–800 mm), the grips' length and the bar's back sweep at its ends. */
  stem: 0.048,
  rise: 0.025,
  barWidth: 0.8,
  grip: 0.13,
  sweep: 0.025,
  /** The frame's tubes, round enough to read as hydroformed alloy. */
  tube: { top: 0.024, down: 0.03, seat: 0.022, stay: 0.016 },
  /** The main pivot just over and behind the chainring, the swingarm's
   * rear end and its stays. */
  pivot: v(0, 0.09, 0.0),
  /** The coil shock in the front triangle: its front eye on a tab off the
   * down tube, its rear on the swingarm's rocker (in the swingarm's own
   * place, extended). Eye to eye about 0.25 m with a 75–85 mm stroke. */
  shockFront: v(0, 0.33, 0.23),
  shockRear: v(0, 0.29, -0.02),
  shock: { body: 0.024, coil: 0.03, eye: 0.012 },
  /** The seat tube (short, so the saddle drops out of the way), the post
   * and the saddle — slammed to just over the rear tyre. */
  seatTop: v(0, 0.46, -0.21),
  saddle: { at: v(0, 0.52, -0.25), length: 0.26, width: 0.13 },
  /** The cranks (165 mm), the pedals' platform and how far out they stand
   * (the stance's Q at the pedals' middles), the chainring (34–36 teeth). */
  crank: 0.165,
  pedal: { length: 0.105, width: 0.1, thick: 0.018 },
  q: 0.19,
  ring: 0.072,
  cog: 0.05,
  /** THE WHEELS: the rims' radius (622 and 584 mm bead seats), the tyres'
   * section (2.4–2.5″), their knobs, the spokes (32 a wheel), the hub and
   * the brake rotors (200–223 mm). */
  rimF: 0.311,
  rimR: 0.292,
  tyre: 0.062,
  knobs: 56,
  spokes: 32,
  hub: 0.03,
  rotor: 0.1,
};

/** THE HEAD TUBE's top and bottom on the steer axis, from the bottom
 * bracket. */
export const HEAD_TOP = onAxis(BIKE_LOOK.stack);
export const HEAD_BOTTOM = sub(HEAD_TOP, scale(STEER_AXIS, BIKE_LOOK.headTube));

/** THE CROWNS on the steered side: over the head tube and under it. */
export const CROWN_TOP = add(HEAD_TOP, scale(STEER_AXIS, BIKE_LOOK.crown));
export const CROWN_BOTTOM = sub(HEAD_BOTTOM, scale(STEER_AXIS, BIKE_LOOK.crown));

/** The middle of the bar, unsteered: off the top crown, the stem forward
 * and up, the bar's rise. */
export const BAR_MIDDLE = add(CROWN_TOP, v(0, 0.03 + BIKE_LOOK.rise, BIKE_LOOK.stem));

/** Each grip's middle, unsteered (the body frame's −x first). */
export const GRIPS: [V3, V3] = [-1, 1].map((s) =>
  add(BAR_MIDDLE, v((s * (BIKE_LOOK.barWidth - BIKE_LOOK.grip)) / 2, 0.006, -BIKE_LOOK.sweep)),
) as [V3, V3];

/** A point of the steered side turned `steer` rad about the steer axis
 * (right positive, the engine's `frontAxleAt`'s own turn). */
export function steered(p: V3, steer: number): V3 {
  const a = STEER_AXIS;
  const d = sub(p, STEER_AT);
  const c = Math.cos(steer);
  const s = Math.sin(steer);
  const k = a.x * d.x + a.y * d.y + a.z * d.z;
  // Rodrigues: d cos + (a × d) sin + a (a·d)(1 − cos).
  const cx = a.y * d.z - a.z * d.y;
  const cy = a.z * d.x - a.x * d.z;
  const cz = a.x * d.y - a.y * d.x;
  return v(
    STEER_AT.x + d.x * c + cx * s + a.x * k * (1 - c),
    STEER_AT.y + d.y * c + cy * s + a.y * k * (1 - c),
    STEER_AT.z + d.z * c + cz * s + a.z * k * (1 - c),
  );
}

/** THE GRIPS steered `steer` rad, from the bottom bracket. */
export function gripsAt(steer: number): [V3, V3] {
  return [steered(GRIPS[0], steer), steered(GRIPS[1], steer)];
}

/** THE FRONT AXLE steered `steer` and compressed `comp` m, from the bottom
 * bracket — the engine's own. */
export function frontAxle(steer: number, comp: number): V3 {
  return fromCom(bikeFrontAxleAt(steer, comp, v(0, 0, 0)));
}

/** The rear axle fully extended, from the bottom bracket. */
export const REAR_REST: V3 = fromCom(BIKE_REAR_AXLE);
const ARM = sub(REAR_REST, BIKE_LOOK.pivot);
const ARM_LENGTH = Math.hypot(ARM.y, ARM.z);

/** THE SWINGARM'S TURN about the main pivot at `comp` m of rear travel,
 * rad about +x (the axle swung up): the engine's path is straight along
 * `BIKE.rearPath`, the drawn arm a circle through its ends — the two part
 * by under two centimetres at full travel, the axle drawn on the arc. */
export function swingAt(comp: number): number {
  const n = Math.hypot(BIKE.rearPath.y, BIKE.rearPath.z);
  const ay = ARM.y + (comp * BIKE.rearPath.y) / n;
  const az = ARM.z + (comp * BIKE.rearPath.z) / n;
  // A turn about +x by θ takes +z toward −y: the turn from the arm at rest
  // to the arm compressed, in the (z, y) plane, negated.
  return -Math.atan2(ARM.z * ay - ARM.y * az, ARM.z * az + ARM.y * ay);
}

/** A point carried by the swingarm, turned `angle` rad about +x through the
 * main pivot. */
export function onSwingarm(p: V3, angle: number): V3 {
  const d = sub(p, BIKE_LOOK.pivot);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add(BIKE_LOOK.pivot, v(d.x, d.y * c - d.z * s, d.y * s + d.z * c));
}

/** THE REAR AXLE at `comp` m of travel, from the bottom bracket, as drawn. */
export function rearAxle(comp: number): V3 {
  return onSwingarm(REAR_REST, swingAt(comp));
}

/** THE SHOCK's two eyes at `comp` m of rear travel, and its length. */
export function shockAt(comp: number): { front: V3; rear: V3; length: number } {
  const rear = onSwingarm(BIKE_LOOK.shockRear, swingAt(comp));
  const front = BIKE_LOOK.shockFront;
  return { front, rear, length: Math.hypot(rear.y - front.y, rear.z - front.z) };
}

/** THE PEDALS' MIDDLES with the cranks at `crank` rad (0 the −x crank
 * forward, level; forward pedalling takes the front pedal down), from the
 * bottom bracket — the body frame's −x pedal first. */
export function pedalsAt(crank: number): [V3, V3] {
  const out: V3[] = [];
  for (const i of [0, 1]) {
    const a = crank + i * Math.PI;
    out.push(
      v((i ? 1 : -1) * BIKE_LOOK.q, -Math.sin(a) * BIKE_LOOK.crank, Math.cos(a) * BIKE_LOOK.crank),
    );
  }
  return out as [V3, V3];
}

/** How long the arm is from the main pivot to the rear axle, m. */
export const SWINGARM = ARM_LENGTH;

/** THE BIKE'S BOTTOM BRACKET from the drawn rider's centre of mass in the
 * body frame (the root his figure is hung in while he rides): what his
 * hands and feet are laid from. */
export function bracketFromRider(pose: Pick<BikePose, "rider">): V3 {
  return v(-pose.rider.x, -pose.rider.y, -pose.rider.z);
}

/** THE ATTACHMENT POINTS a rider and a lift hold the bike by, from the
 * bottom bracket, unsteered and at rest: the saddle's top (where he sits
 * on it and where the frame is lifted), and the LIFT HOOK — the front
 * tyre's top, by which a chair's or a drag's bike carrier hangs it. */
export const SADDLE_TOP: V3 = add(BIKE_LOOK.saddle.at, v(0, 0.03, 0));
export const LIFT_HOOK: V3 = add(frontAxle(0, 0), v(0, BIKE.front.radius, 0));
