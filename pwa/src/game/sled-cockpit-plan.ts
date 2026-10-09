// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S COCKPIT, DECIDED — three-free, so the suite reads it.
// What the rider sees over the bars on the HELMET rung (`camera-sled.ts`)
// and `sled-cockpit.ts` draws: where every control stands on the bars, how
// far each moves for the engine's controls, and what the display reads.
//
// The layout is a mountain machine's, after the makers' operator's guides
// and the class's spec sheets:
//
//   RIGHT BAR  the THUMB THROTTLE — a paddle ahead of the grip's inboard
//              end, sprung out to idle and pushed back toward the bar by the
//              thumb — on its housing, with the red EMERGENCY STOP button
//              on top of it (up to run, pressed to ground the ignition);
//   LEFT BAR   the BRAKE LEVER ahead of the grip, pulled toward it by the
//              fingers, off a master cylinder with its fluid's sight glass
//              and the parking lock's tab; inboard of it the SWITCH
//              CLUSTER: the hand and thumb warmers' up and down, the
//              display's MODE toggle, the electric REVERSE, the headlamp's
//              high and low beam;
//   MIDDLE     a tapered aluminium bar on a tall riser, the MOUNTAIN STRAP
//              loop over its middle and a padded crossbar, the post running
//              down into the hood; the SAFETY TETHER clipped in beside the
//              display; HAND GUARDS wrapped round both grips;
//   DASH       a colour DISPLAY under a low smoked deflector: the speed,
//              the engine's speed as a bar with its red line, the coolant's
//              temperature, the fuel, the ALTITUDE (a mountain gauge's),
//              the clock, and the tell-tales under it.
//
// Every point is in the machine's body frame (x right, y up, z forward,
// the origin at its centre of gravity), anchored on the traced grip and
// post (`SLED_LOOK`) the model is built off, so the drawn controls sit
// where the model's bars are.

import { SLED, type SledState } from "@engine";

import { SLED_LOOK, sledFrame } from "./sled-look.ts";

export type V3 = { x: number; y: number; z: number };

/** WHICH SIDE IS THE RIDER'S. The body frame's x is "right" by name, but
 * looking forward down +z in a right-handed frame +x stands on the left of
 * the picture — the side the rider's left hand is on. So the throttle's
 * side is −x and the brake's +x, and every control below is placed by
 * these, never by a bare sign. */
export const RIGHT = -1;
export const LEFT = 1;

const [GZ, GY] = sledFrame(SLED_LOOK.grip);
const [PZ, PY] = sledFrame(SLED_LOOK.post);
const HB = SLED_LOOK.barWidth / 2;
/** The hood's top a little ahead of the dash, where the deflector stands. */
const [DZ, DY] = sledFrame([SLED_LOOK.post[0] + 0.32, 1.04]);

/** Where everything stands, body frame, m. */
export const COCKPIT = {
  /** The post's foot in the hood and the riser's clamp the bars turn about
   * (the model's `postAxis`). */
  post: { x: 0, y: PY, z: PZ } as V3,
  riser: { x: 0, y: GY - 0.045, z: GZ + 0.023 } as V3,
  /** The bar's half width, and its line from the left end to the right —
   * swept back to the grips and dropped to the clamp. */
  halfBar: HB,
  bar: [
    [-1, 0, 0],
    [-0.757, 0.013, -0.005],
    [-0.46, 0.035, -0.027],
    [0, 0.045, -0.035],
    [0.46, 0.035, -0.027],
    [0.757, 0.013, -0.005],
    [1, 0, 0],
  ].map(([s, dz, dy]) => ({ x: s * HB, y: GY + dy, z: GZ - 0.017 + dz })) as V3[],
  /** A grip's inboard and outboard ends' |x|, its radius. */
  grip: { from: HB * 0.716, to: HB, r: 0.017 },
  /** The throttle's and the brake's housings' |x| on the bar. */
  housing: HB * 0.66,
  /** The mountain strap's loop and the crossbar under it. */
  strap: { half: SLED_LOOK.handle.width / 2, height: SLED_LOOK.handle.height * 0.6 },
  /** The display on its bracket ahead of the riser's clamp — a mountain
   * gauge rides on the bars and turns with them: its centre, size and its
   * face tipped back toward the rider off the vertical, rad. */
  display: { at: { x: 0, y: GY + 0.025, z: GZ + 0.1 } as V3, w: 0.18, h: 0.104, tilt: 0.62 },
  /** The low smoked deflector on the hood ahead: its foot, size and lean
   * back off the vertical, rad. */
  deflector: { z: DZ, y: DY - 0.01, w: 0.4, h: 0.17, lean: 0.55 },
  /** The safety tether's post on the hood, right of the bars. */
  tether: { x: RIGHT * 0.13, y: DY + 0.03, z: DZ - 0.12 } as V3,
  /** The elbows a standing rider's forearms run back to, |x|, y, z. */
  elbow: { x: 0.42, y: GY - 0.12, z: GZ - 0.3 } as V3,
} as const;

/** THE CONTROLS' TRAVEL, rad: the throttle's paddle from idle to wide open,
 * the brake lever pulled to the grip, and the bars' share of the skis'
 * angle (the model's linkage, `sled-view.ts`). */
export const TRAVEL = { throttle: 0.55, brake: 0.3, bars: 0.8 } as const;

/** How the controls stand this frame. */
export type CockpitPose = { bars: number; throttle: number; brake: number };

export function cockpitPose(s: Pick<SledState, "skiAngle" | "controls">): CockpitPose {
  const c = s.controls;
  return {
    bars: s.skiAngle * TRAVEL.bars,
    throttle: Math.max(0, Math.min(1, c.throttle)) * TRAVEL.throttle,
    brake: Math.max(0, Math.min(1, c.brake)) * TRAVEL.brake,
  };
}

/** THE TANK AND THE COOLANT, kept between frames by the display: what the
 * engine has burnt and how warm it has run (a gauge's own memory — the
 * engine keeps neither). */
export type GaugeMemory = { fuel: number; coolant: number };

/** A full tank of a mountain machine, L; its burn at idle and flat out at
 * the red line, L/h; the coolant's warm running temperature and how much
 * a hard pull adds, °C, and how slowly it gets there, s. */
export const GAUGE = {
  tank: 40,
  idleBurn: 1.2,
  fullBurn: 34,
  startFuel: 0.86,
  coldStart: 2,
  warm: 52,
  hot: 18,
  warmUp: 90,
  /** The red line's share of the limiter, and the low fuel warning. */
  redline: 8000,
  lowFuel: 0.15,
} as const;

export function freshGauge(): GaugeMemory {
  return { fuel: GAUGE.startFuel, coolant: GAUGE.coldStart };
}

/** What the display reads. */
export type GaugeReading = {
  /** km/h over the ground, whole. */
  speed: number;
  /** The engine, rpm (rounded to fifty, as a display steps it), and its
   * share of the limiter for the bar; the red line's share. */
  rpm: number;
  rpmShare: number;
  redShare: number;
  /** °C, and its share of the bar (−10..100 °C). */
  coolant: number;
  coolantShare: number;
  /** The tank's share left, 0..1. */
  fuel: number;
  /** m over the sea, rounded to ten, or null on a map without a sea. */
  altitude: number | null;
  /** "hh:mm". */
  clock: string;
  /** The tell-tales: low fuel, the engine hot. */
  lowFuel: boolean;
  hot: boolean;
};

/** Read the machine onto the display, stepping its memory `dt` s. */
export function gaugeOf(
  s: Pick<SledState, "speed" | "rpm" | "running" | "controls">,
  mem: GaugeMemory,
  dt: number,
  altitude: number | null,
  hour: number,
): GaugeReading {
  const share = Math.max(0, Math.min(1, s.rpm / SLED.maxRpm));
  if (s.running && dt > 0) {
    const burn = GAUGE.idleBurn + (GAUGE.fullBurn - GAUGE.idleBurn) * share * s.controls.throttle;
    mem.fuel = Math.max(0, mem.fuel - (burn / 3600 / GAUGE.tank) * dt);
  }
  const target = s.running ? GAUGE.warm + GAUGE.hot * share * s.controls.throttle : GAUGE.coldStart;
  mem.coolant += (target - mem.coolant) * Math.min(1, dt / GAUGE.warmUp);
  const h = ((hour % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return {
    speed: Math.round(s.speed * 3.6),
    rpm: Math.round(s.rpm / 50) * 50,
    rpmShare: share,
    redShare: GAUGE.redline / SLED.maxRpm,
    coolant: Math.round(mem.coolant),
    coolantShare: Math.max(0, Math.min(1, (mem.coolant + 10) / 110)),
    fuel: mem.fuel,
    altitude: altitude === null ? null : Math.round(altitude / 10) * 10,
    clock: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
    lowFuel: mem.fuel < GAUGE.lowFuel,
    hot: mem.coolant > GAUGE.warm + GAUGE.hot * 0.9,
  };
}
