// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD CUP DOWNHILL BIKE AS DRAWN — the race rig of the class raced on
// the steepest lift-served courses, decided once off the engine's own
// geometry (`BIKE`, `bike-look.ts`) and the class's photographs: a carbon
// front triangle with a big down tube and a short seat tube, the saddle
// slammed over the rear tyre; a dual-crown fork on a direct-mount stem; a
// RIGID REAR TRIANGLE carried on TWO SHORT COUNTER-ROTATING LINKS (a
// virtual-pivot four-bar), the upper link a rocker driving a coil shock
// that stands nearly upright in front of the seat tube, its lower eye on a
// tab just over the bottom bracket — 250 × 75 mm eye to eye and stroke,
// the class's — and the wheels, the drivetrain and the cockpit of a
// factory race bike. No make or model is kept: the class's shape, in
// metres.
//
// THE LINKAGE is FITTED to the engine: the four-bar's pins and links were
// chosen (a search over the pins, `docs/downhill-bike.md`'s rear-path) so
// the rear axle it carries rides the engine's own straight path
// (`BIKE.rearPath`) through all 200 mm of travel to within half a
// millimetre. The rear triangle is posed by putting its axle exactly where
// the engine has it and turning it until the LOWER link is its own length;
// the UPPER link then misses its length by under a millimetre and is drawn
// aimed at its pin. The shock is posed between its frame eye and the upper
// link's front arm.
//
// The frame is the engine's body frame (x the engine's right, y up, z
// forward) with its origin at the BOTTOM BRACKET; the drive side is −x
// (`DRIVE`). Three-free and DOM-free: `bike-wc-build.ts` builds and poses it,
// `tests/bike_wc_look_test.ts` holds the axle to the engine's path.

import { BIKE } from "@engine";

import { REAR_REST, type V3 } from "./bike-look.ts";

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });

/** A point of the (z, y) plane — the side view every pin lies in. */
export type ZY = { z: number; y: number };

const rotZY = (p: ZY, o: ZY, t: number): ZY => {
  const dz = p.z - o.z;
  const dy = p.y - o.y;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { z: o.z + dz * c - dy * s, y: o.y + dz * s + dy * c };
};
const dist = (a: ZY, b: ZY): number => Math.hypot(a.z - b.z, a.y - b.y);

/** THE PINS, m from the bottom bracket, the rear triangle at full
 * extension: each link's frame pivot and the pin it carries the triangle
 * by, the upper link's FRONT ARM (the shock's top eye), and
 * the shock's eye on the frame's tab over the bottom bracket. */
export const WC_PINS = {
  /** The lower link: its frame pivot just over and ahead of the bottom
   * bracket, its pin on the triangle's chainstay yoke behind it. */
  lowerFrame: { z: 0.0106, y: 0.1479 } as ZY,
  lowerPin: { z: -0.0406, y: 0.164 } as ZY,
  /** The upper link (the rocker): its frame pivot on the seat tube, its
   * pin at the seatstays' top. */
  upperFrame: { z: -0.0374, y: 0.26 } as ZY,
  upperPin: { z: -0.1354, y: 0.3352 } as ZY,
  /** The rocker's front arm: the shock's top eye. */
  shockLink: { z: 0.033, y: 0.351 } as ZY,
  /** The shock's bottom eye, on its tab off the down tube. */
  shockFrame: { z: 0.013, y: 0.102 } as ZY,
};

/** The rear axle at rest (extended), from the bottom bracket. */
const AXLE0: ZY = { z: REAR_REST.z, y: REAR_REST.y };
const PATH = (() => {
  const n = Math.hypot(BIKE.rearPath.y, BIKE.rearPath.z);
  return { z: BIKE.rearPath.z / n, y: BIKE.rearPath.y / n };
})();
const LOWER = dist(WC_PINS.lowerFrame, WC_PINS.lowerPin);
const UPPER = dist(WC_PINS.upperFrame, WC_PINS.upperPin);
/** The shock built (extended), eye to eye, m — the class's 250 mm. */
export const WC_SHOCK_REST = dist(WC_PINS.shockLink, WC_PINS.shockFrame);

/** THE REAR END at `comp` m of rear travel: the triangle's axle (exactly
 * the engine's), the triangle's turn about +x in three's sense (rad), its
 * two pins, each link's turn about its frame pivot (three's sense), and
 * the shock's eyes and length. */
export type WcRear = {
  axle: ZY;
  /** The triangle's turn, three's `rotation.x` (about the axle). */
  turn: number;
  lowerPin: ZY;
  upperPin: ZY;
  lowerTurn: number;
  upperTurn: number;
  shockTop: ZY;
  shockLength: number;
};

const angleOf = (p: ZY, o: ZY): number => Math.atan2(p.y - o.y, p.z - o.z);
const LOWER_AT0 = angleOf(WC_PINS.lowerPin, WC_PINS.lowerFrame);
const UPPER_AT0 = angleOf(WC_PINS.upperPin, WC_PINS.upperFrame);

/** The triangle's pins at axle `axle`, turned `t` (the (z, y) plane's
 * sense) about it. */
function pinsAt(axle: ZY, t: number): { lower: ZY; upper: ZY } {
  const shift = (p: ZY): ZY => ({ z: p.z + axle.z - AXLE0.z, y: p.y + axle.y - AXLE0.y });
  return {
    lower: rotZY(shift(WC_PINS.lowerPin), axle, t),
    upper: rotZY(shift(WC_PINS.upperPin), axle, t),
  };
}

/** THE REAR END at `comp` m of travel (clamped to the travel). */
export function wcRear(comp: number): WcRear {
  const c = Math.max(0, Math.min(BIKE.rearEnd.travel, comp));
  const axle: ZY = { z: AXLE0.z + PATH.z * c, y: AXLE0.y + PATH.y * c };
  // Turn the triangle about its axle until the lower link is its length:
  // Newton on the miss, from the fitted turn's slope (−2 rad a metre).
  let t = -2 * c;
  for (let i = 0; i < 12; i++) {
    const miss = dist(pinsAt(axle, t).lower, WC_PINS.lowerFrame) - LOWER;
    const h = 1e-5;
    const slope = (dist(pinsAt(axle, t + h).lower, WC_PINS.lowerFrame) - LOWER - miss) / h;
    if (Math.abs(slope) < 1e-9) break;
    const step = miss / slope;
    t -= step;
    if (Math.abs(step) < 1e-9) break;
  }
  const pins = pinsAt(axle, t);
  const upperTurn = angleOf(pins.upper, WC_PINS.upperFrame) - UPPER_AT0;
  const shockTop = rotZY(WC_PINS.shockLink, WC_PINS.upperFrame, upperTurn);
  return {
    axle,
    // The (z, y) plane's turn is three's `rotation.x` negated.
    turn: -t,
    lowerPin: pins.lower,
    upperPin: pins.upper,
    lowerTurn: -(angleOf(pins.lower, WC_PINS.lowerFrame) - LOWER_AT0),
    upperTurn: -upperTurn,
    shockTop,
    shockLength: dist(shockTop, WC_PINS.shockFrame),
  };
}

/** How far the upper link misses its own length at `comp`, m (the four-bar
 * fit's residual — held under a millimetre by the suite). */
export function upperMiss(comp: number): number {
  const r = wcRear(comp);
  return dist(r.upperPin, WC_PINS.upperFrame) - UPPER;
}

/** THE FRAME'S LINES, m from the bottom bracket: the points its tubes are
 * swept through, and their sections (half width across x, half height). */
export const WC_FRAME = {
  /** The seat tube's clamp, the saddle over it slammed (the post short). */
  seatClamp: v(0, 0.43, -0.13),
  /** The top tube meets the seat tube here, braced to the head. */
  topJoin: v(0, 0.47, -0.08),
  /** The down tube's belly — wide and flat-sided, a carbon race frame's. */
  downBelly: v(0, 0.29, 0.29),
  /** The chainstay yoke's middle on the triangle (between the lower pin and
   * the axle) and the seatstays' bridge. */
  yoke: v(0, 0.1, -0.16),
  bridge: v(0, 0.2, -0.27),
  /** The stays' spread either side of the middle at the axle, m (157 mm
   * hub spacing, the dropouts outside it). */
  dropout: 0.082,
};

/** THE LIVERY: a factory team's gloss white frame, its graphics in the
 * team's navy and a fluorescent accent — a frame that reads against dark
 * dirt and woods; the rider wears the same colours (`RACER_KIT`). */
export const WC_LIVERY = {
  frame: 0xe9eae6,
  accent: 0xff5a1a,
  graphic: 0x1a2a46,
  carbon: 0x1a1b1e,
  gold: 0xc9a24f,
  spring: 0xff5a1a,
  anodised: 0xff5a1a,
};

/** A few of the build's numbers that the drawing reads beside `BIKE_LOOK`:
 * the cassette's seven cogs (11–25 teeth, a downhill's close range), the
 * chainring (36 teeth), the rotors' radii (223 front, 203 rear), the
 * number plate. */
export const WC_PARTS = {
  cogs: [0.025, 0.029, 0.033, 0.037, 0.041, 0.045, 0.05],
  ring: 0.074,
  rotorF: 0.1115,
  rotorR: 0.1015,
  plate: { width: 0.2, height: 0.16 },
  number: "27",
};
