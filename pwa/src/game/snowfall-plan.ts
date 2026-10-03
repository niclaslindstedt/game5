// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW THE FALL MOVES PAST THE LENS — the arithmetic `snowfall.ts` draws
// by, three-free, so the suite and the weather lab (`make snowfall`) ask
// the same questions of it the shader is handed the answers to.
//
//   * A FLAKE'S OWN VELOCITY is the wind's (`windAt`, the engine's) plus
//     its fall through still air: a fall's flakes drop a metre a second,
//     the air's crystals barely settle. That is the snow's motion over the
//     mountain, the same for every lens.
//   * THE LENS'S VELOCITY is measured off the lens itself, frame to frame
//     (`createLensTrack`), never assumed from the skier: a chase rig that
//     lags, a death cam zooming, a broadcast lens planted still all move as
//     they move. A jump too big for any lens to ski is a CUT, not a speed.
//   * WHAT IS SEEN is the difference (`airPast`): a flake's velocity less
//     the lens's. Ride at 100 km/h into still air and every flake comes at
//     the lens at 100 km/h; ride downwind at the wind's speed and the snow
//     only falls. Each flake is drawn as the smear that motion makes over
//     the frame's shutter (`shutterOf`), so it reads as streaming past
//     rather than as a dot hopping a hundred pixels between two frames.

/** Flakes in the pool at a SPRAY share of 1. */
export const FLAKES = 14000;
/** The box of air round the lens the fall fills, m a side. */
export const BOX = 48;
/** How fast a flake falls through still air, m/s. */
export const FALL_SPEED = 1.1;
/** The air's crystals at a SPRAY share of 1, how slowly they settle, m/s,
 * and how far from the lens they are drawn, m (faded from its middle). */
export const MOTES = 4000;
export const MOTE_SETTLE = 0.2;
export const MOTE_REACH = 14;
/** The fall under which the box holds only the air's crystals: a tenth of a
 * full fall and up is a fall, and a fall grows out of them. */
export const FALL_FROM = 0.1;
/** THE SHUTTER: how much of a frame's time each smear spans (1 is the whole
 * frame, so one frame's smear meets the next's), and its bounds, s. */
export const SHUTTER = { share: 1, min: 1 / 120, max: 1 / 30 };
/** THE LENS'S VELOCITY: how quickly the measured velocity follows the lens,
 * s, and the speed past which a move is a CUT, m/s (no lens skis faster). */
export const LENS = { settle: 0.06, cut: 90 };

export type Vec3 = { x: number; y: number; z: number };

/** How much of the box is the air's crystals rather than a fall, 0..1. */
export function moteOf(snowfall: number): number {
  return 1 - Math.min(1, Math.max(0, snowfall) / FALL_FROM);
}

/** A FLAKE'S OWN VELOCITY, m/s, world frame: carried by the wind, falling
 * through the air at a fall's pace or a crystal's. */
export function flakeDrift(
  wind: { x: number; z: number },
  snowfall: number,
  out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
  const mote = moteOf(snowfall);
  out.x = wind.x;
  out.y = -(FALL_SPEED + (MOTE_SETTLE - FALL_SPEED) * mote);
  out.z = wind.z;
  return out;
}

/** WHAT THE LENS SEES: a flake's velocity past it, m/s — the flake's own
 * less the lens's. */
export function airPast(drift: Vec3, lens: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  out.x = drift.x - lens.x;
  out.y = drift.y - lens.y;
  out.z = drift.z - lens.z;
  return out;
}

/** The seconds a smear spans for a frame `dt` s long. */
export function shutterOf(dt: number): number {
  return Math.min(SHUTTER.max, Math.max(SHUTTER.min, dt * SHUTTER.share));
}

export type LensTrack = {
  /** The lens is at `at` after `dt` s: its velocity, m/s (held over a
   * frame that took no time, zeroed by a cut). */
  step(at: Vec3, dt: number): Vec3;
  /** Forget where the lens was: the next step is a cut. */
  reset(): void;
};

/** THE LENS'S VELOCITY, measured off where it stands frame to frame. */
export function createLensTrack(): LensTrack {
  const v: Vec3 = { x: 0, y: 0, z: 0 };
  const last: Vec3 = { x: 0, y: 0, z: 0 };
  let known = false;
  return {
    step(at, dt) {
      if (!known) {
        known = true;
        v.x = v.y = v.z = 0;
      } else if (dt > 0) {
        const rx = (at.x - last.x) / dt;
        const ry = (at.y - last.y) / dt;
        const rz = (at.z - last.z) / dt;
        if (Math.hypot(rx, ry, rz) > LENS.cut) {
          v.x = v.y = v.z = 0;
        } else {
          const k = 1 - Math.exp(-dt / LENS.settle);
          v.x += (rx - v.x) * k;
          v.y += (ry - v.y) * k;
          v.z += (rz - v.z) * k;
        }
      }
      last.x = at.x;
      last.y = at.y;
      last.z = at.z;
      return v;
    },
    reset() {
      known = false;
    },
  };
}
