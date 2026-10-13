// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE'S BENCH (`bike-rides.ts`): grounds no generator built, as the
// bike's physics asks the world (`BikeWorld`) — a plane at a grade, a
// profile down +z (a drop, a table, a berm's bank, a garden of rocks), on one
// of the summer's surfaces — and a rider's runner that rides the bike on one
// with a hand on its controls step by step.

import {
  BIKE,
  SURFACES,
  TUNING,
  crashBike as crashOf,
  freshBike,
  placeBike,
  rideBike,
  startLanding,
  stepLanding,
  type BikeControls,
  type BikeCrash,
  type BikeLanding,
  type BikeRide,
  type BikeState,
  type BikeStepReport,
  type BikeZone,
  type SurfaceId,
  type ZonedWorld,
} from "@engine";

/** A ground described by its height, m, at (x, z) and that height's slope
 * along x and z (∂h/∂x, ∂h/∂z). */
export type Ground = (x: number, z: number, out: { h: number; dx: number; dz: number }) => void;

/** A BENCH WORLD over `ground` on `surface`, the air still at a ski area's
 * density (`TUNING.airDensity`). `surfaceAt` may name the surface by place. */
export function benchWorld(
  ground: Ground,
  surface: SurfaceId | ((x: number, z: number) => SurfaceId),
  zone?: (x: number, z: number) => BikeZone,
): ZonedWorld {
  const at = { h: 0, dx: 0, dz: 0 };
  return {
    groundAt(x, z) {
      ground(x, z, at);
      return at.h;
    },
    normalAt(x, z, out) {
      ground(x, z, at);
      const l = Math.hypot(at.dx, 1, at.dz);
      out.x = -at.dx / l;
      out.y = 1 / l;
      out.z = -at.dz / l;
    },
    surfaceAt(x, z) {
      return SURFACES[typeof surface === "string" ? surface : surface(x, z)];
    },
    wind: { x: 0, z: 0 },
    rho: TUNING.airDensity,
    ...(zone ? { zoneAt: zone } : {}),
  };
}

/** A plane falling `grade` (rise over run) along +z. */
export const slope =
  (grade: number): Ground =>
  (_x, z, o) => {
    o.h = -grade * z;
    o.dx = 0;
    o.dz = -grade;
  };

/** A profile down +z: its height and slope at z, flat across. */
export const profile =
  (h: (z: number) => number): Ground =>
  (_x, z, o) => {
    o.h = h(z);
    const e = 0.01;
    o.dx = 0;
    o.dz = (h(z + e) - h(z - e)) / (2 * e);
  };

/** What a ride on the bench gives back each step, for a row to read: the
 * landings judged so far and the crash, if he came off. */
export type Sample = {
  t: number;
  b: BikeState;
  report: BikeStepReport;
  landings: { verdict: BikeLanding; peak: number; air: number; t: number }[];
  crash: BikeCrash | null;
};

export const NO_HANDS: BikeControls = { pedal: 0, front: 0, rear: 0, steer: 0, lean: 0, crouch: 0 };
export const RIDDEN: BikeRide = { yaw: 1, air: 1, hands: true };
export const RAW: BikeRide = { yaw: 0, air: 0, hands: true };

/** RIDE THE BIKE on `world` from (x, z) facing `heading` at `speed` m/s for
 * up to `seconds`, the controls `hand(b, t)` each step, `watch` told every
 * step (return true to stop) — the landings judged and a crash stopping the
 * ride unless `through`. The rider is 80 kg unless `mass` says. */
export function benchRide(
  world: ZonedWorld,
  o: {
    x?: number;
    z?: number;
    heading?: number;
    speed: number;
    seconds: number;
    ride?: BikeRide;
    hand?: (b: BikeState, t: number) => BikeControls;
    watch?: (s: Sample) => boolean | void;
    mass?: number;
    through?: boolean;
    /** Started this high over the ground, m, in the air (a drop's landing
     * read on its own). */
    lift?: number;
  },
): Sample {
  const b = freshBike(o.mass ?? BIKE.rider.mass);
  placeBike(b, world, o.x ?? 0, o.z ?? 0, o.heading ?? 0, o.speed);
  b.onIt = true;
  b.mode = "ridden";
  if (o.lift) {
    b.y += o.lift;
    b.rider.y += o.lift;
    b.front.touching = false;
    b.rear.touching = false;
    b.airborne = true;
    b.airTime = 1;
  }
  const dt = TUNING.dt;
  const report: BikeStepReport = { touchdown: false, impact: 0, frontFirst: false };
  const steps = Math.round(o.seconds / dt);
  const sample: Sample = { t: 0, b, report, landings: [], crash: null };
  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const ctl = o.hand ? o.hand(b, t) : NO_HANDS;
    b.controls = ctl;
    rideBike(b, ctl, world, o.ride ?? RIDDEN, dt, report);
    if (report.touchdown) startLanding(b, report, world);
    const done = stepLanding(b, dt);
    if (done) sample.landings.push({ verdict: done.verdict, peak: done.peak, air: done.air, t });
    if (!sample.crash) sample.crash = crashOf(b, world, dt);
    sample.t = t + dt;
    if (o.watch && o.watch(sample)) break;
    if (sample.crash && !o.through) break;
  }
  return sample;
}
