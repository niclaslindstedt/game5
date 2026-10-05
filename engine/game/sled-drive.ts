// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S DRIVE — engine, CVT and belt, from the thumb throttle to
// the force the belt offers the snow. What the snow actually TAKES of it is
// the grip's (`sled-body.ts` sums it probe by probe); this module owns the
// belt between the two and the engine that turns it. The sibling sled
// game's drive, restated for the one mountain machine.
//
// THE ENGINE is a power curve (`powerShare`) over rpm: a two-stroke's —
// little down low and a rush onto the pipe — rising to its peak at
// `peakRpm` and falling past it to the limiter at `maxRpm`, which cuts the
// fuel. Shut, it freewheels: a two-stroke barely brakes.
//
// THE CVT is modelled by what it does rather than by its sheaves: with the
// throttle open it holds the engine at the rpm the thumb asks for — from
// the clutch's engagement up to the power peak at full throttle — shifting
// up as the belt gains speed, until it runs out of ratio at `gearTop`. Past
// that the engine is locked to the belt and climbs with it to the limiter.
// So the force the drive offers is POWER over belt speed — flat power,
// falling force — floored at a launch speed (the clutch slipping off the
// line) and capped at what the peak torque does through the lowest ratio.
//
// THE BELT is a mass of its own: the engine pushes it, the snow pushes
// back through the grip, its rails and idlers drag it, and the brake clamps
// it. It spins faster than the sled is going in powder or off the line —
// the slip that digs the trench and throws the roost — and in the air it
// spins up free. It never runs backwards: the drive is one-way.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { SLED } from "./defs/sled.ts";

const B = SLED.belt;
const RPM_TO_RAD = (2 * Math.PI) / 60;

/** The engine's power at `rpm`, as a share of its peak. */
export function powerShare(rpm: number): number {
  const S = SLED;
  if (rpm <= S.peakRpm) {
    const x = clamp((rpm - S.idleRpm) / (S.peakRpm - S.idleRpm), 0, 1);
    return 0.12 + 0.88 * (1 - Math.pow(1 - x, S.curve));
  }
  const x = clamp((rpm - S.peakRpm) / (S.maxRpm - S.peakRpm), 0, 1.5);
  return 1 - 0.25 * x * x;
}

/** The engine speed the belt drives it at in the CVT's TOP ratio, rpm. */
export function rpmAtTop(treadSpeed: number): number {
  return (treadSpeed / SLED.gearTop) * SLED.maxRpm;
}

/** The most the drive can ever push the belt with, N: the peak torque
 * through the lowest ratio, less the driveline. */
export function maxDriveForce(): number {
  const S = SLED;
  const torque = (S.powerKw * 1000) / (S.peakRpm * RPM_TO_RAD);
  const rpmPerMps = (S.maxRpm * S.gearSpan) / S.gearTop;
  return torque * S.driveline * rpmPerMps * RPM_TO_RAD;
}

/** The force the drive offers the belt, N, at engine `rpm`, `throttle`
 * 0..1 and the belt at `treadSpeed` m/s. Negative with the throttle shut:
 * the little a two-stroke brakes while the driven clutch is engaged. */
export function driveForce(rpm: number, throttle: number, treadSpeed: number): number {
  const S = SLED;
  const top = rpmAtTop(treadSpeed);
  if (throttle <= 0.01 || rpm < S.engageRpm * 0.95) {
    return top > S.engageRpm ? -S.engineBrake * treadSpeed : 0;
  }
  const power = S.powerKw * 1000 * powerShare(rpm) * throttle * S.driveline;
  let force = Math.min(power / Math.max(treadSpeed, B.launchFloor), maxDriveForce());
  // THE LIMITER: fuel cut over the last two per cent to the redline.
  force *= clamp((S.maxRpm * 1.02 - top) / (S.maxRpm * 0.02), 0, 1);
  return force;
}

/** Where the CVT holds the engine: the rpm the thumb asks for, or the rpm
 * the belt drives it at in top ratio if that is higher. */
export function rpmGoal(throttle: number, treadSpeed: number): number {
  const S = SLED;
  const top = rpmAtTop(treadSpeed);
  if (throttle <= 0.01) return top > S.engageRpm ? top : S.idleRpm;
  const asked = S.engageRpm + (S.peakRpm - S.engageRpm) * clamp(throttle, 0, 1);
  return Math.min(Math.max(asked, top), S.maxRpm * 1.03);
}

/** THE BELT'S STEP: its speed advanced by the drive, the snow's reaction
 * (`ground`, N — the sum of what the belt's grip put INTO the snow,
 * positive pushing the sled forward), its own losses and the brake (0..1),
 * which never clamps it below `floor` m/s. Returns the new speed, m/s. */
export function stepBelt(
  treadSpeed: number,
  rpm: number,
  throttle: number,
  brake: number,
  ground: number,
  dt: number,
  floor = 0,
): number {
  const v = treadSpeed;
  const loss = B.lossLin * v + B.lossQuad * v * v;
  const net = driveForce(rpm, throttle, v) - ground - loss;
  let next = v + (net / B.mass) * dt;
  const clampDv = (SLED.brakeForce * brake * dt) / B.mass;
  if (next > 0) next = Math.max(Math.min(next, floor), next - clampDv);
  return Math.max(0, next);
}

/** The engine's own step toward where the CVT holds it, rpm. */
export function stepRpm(rpm: number, throttle: number, treadSpeed: number, dt: number): number {
  const goal = rpmGoal(throttle, treadSpeed);
  return rpm + (goal - rpm) * Math.min(1, B.rpmRate * dt);
}
