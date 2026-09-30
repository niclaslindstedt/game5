// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEVELOPER ▸ FREE CAMERA: the lens taken off the ladder and flown by hand,
// while the race goes on under it.
//
// Every camera in the game is bolted to a skis, so a fault that sits BESIDE
// the line — a trunk through a berm, a furrow cut short, a tree floating
// over a hollow — is only ever seen for the frame the chase happens to
// sweep past it. The free camera stops and looks.
//
// THE KEYS ARE ONES NO SKIER HOLDS: I and K fly forward and back along the
// look, J and L slide sideways, U and O sink and climb, and holding the
// shift keys flies faster; a drag on the picture turns the head. The skis
// keeps its own keys, so a race can still be ridden — or paused — under a
// lens flown somewhere else. (A key the player rebinds onto I–O is theirs.)
//
// DOM-free, so the tests fly it; `dev-tools.ts` owns the listeners and
// hands the pose to the renderer's override every frame.

import type { LensPose } from "./camera-rigs.ts";

export type FlyState = { x: number; y: number; z: number; yaw: number; pitch: number };

export type FlyKeys = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fast: boolean;
};

/** Which `KeyboardEvent.code` flies which way. */
export const FLY_CODES: Record<Exclude<keyof FlyKeys, "fast">, string> = {
  forward: "KeyI",
  back: "KeyK",
  left: "KeyJ",
  right: "KeyL",
  up: "KeyO",
  down: "KeyU",
};

export const FLY = {
  /** Cruising speed, m/s — a skis's pace, so the camera can keep up. */
  speed: 18,
  /** What the shift keys multiply it by. */
  fast: 4,
  /** Radians of head-turn per CSS pixel dragged. */
  look: 0.004,
  /** How far up or down the head may tip, rad — short of straight, where
   * the yaw would stop meaning anything. */
  pitchLimit: 1.45,
  fov: 60,
} as const;

export const NO_KEYS: FlyKeys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  up: false,
  down: false,
  fast: false,
};

/** Fly `dt` seconds on the keys held: forward along the LOOK (so pointing
 * down and flying forward dives), sideways level. */
export function flyStep(fly: FlyState, keys: FlyKeys, dt: number): void {
  const v = FLY.speed * (keys.fast ? FLY.fast : 1) * dt;
  const ahead = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const side = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const lift = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  const cp = Math.cos(fly.pitch);
  const sy = Math.sin(fly.yaw);
  const cy = Math.cos(fly.yaw);
  // Heading 0 is +z, clockwise from above: right of it is -x.
  fly.x += (sy * cp * ahead - cy * side) * v;
  fly.z += (cy * cp * ahead + sy * side) * v;
  fly.y += (Math.sin(fly.pitch) * ahead + lift) * v;
}

/** Turn the head by a drag of `dx`, `dy` CSS pixels (right and down). */
export function flyLook(fly: FlyState, dx: number, dy: number): void {
  fly.yaw -= dx * FLY.look;
  fly.pitch = Math.max(-FLY.pitchLimit, Math.min(FLY.pitchLimit, fly.pitch - dy * FLY.look));
}

/** The lens the renderer stands at. */
export function flyLens(fly: FlyState): LensPose {
  const cp = Math.cos(fly.pitch);
  return {
    eye: { x: fly.x, y: fly.y, z: fly.z },
    target: {
      x: fly.x + Math.sin(fly.yaw) * cp * 10,
      y: fly.y + Math.sin(fly.pitch) * 10,
      z: fly.z + Math.cos(fly.yaw) * cp * 10,
    },
    fov: FLY.fov,
    roll: 0,
  };
}
