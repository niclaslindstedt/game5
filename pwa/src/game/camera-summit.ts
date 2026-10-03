// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMIT, as the lens reads it — how much a skier is at the top of a
// lift, on its station's pad and just over its lip (R26), where the boom
// (`camera-rigs.ts`) stops leaning with the mountain. Three-free, so the
// suite reads it (`tests/world_render_test.ts`).
//
// A boom that leans its arm up the slope behind a skier reads a steep face
// as gentler than it is, which is what it is for on the way down. At the
// top it is the opposite of what is wanted: standing on the level pad and
// pushing off over its lip, the lens should stay LEVEL, so the face falls
// away under the horizon as near to straight down as it looks from the top
// of a real one — the drop felt in the stomach. So the share is whole on
// a station's pad and over its lip, and fades out as he drops below it and
// gets away from it, the boom leaning back in with the mountain as he
// commits to the face.

import type { Level } from "@engine";

/** Whole within `near` m of a top station and fading out by `far`; whole
 * down to `drop.from` m under its pad and gone by `drop.to`. */
export const SUMMIT = { near: 45, far: 110, drop: { from: 6, to: 45 } } as const;

function fade(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return 1 - t * t * (3 - 2 * t);
}

/** How much the skier at (x, z) is at a summit, 0..1 — the most of every
 * gondola's and chair's top on the map. */
export function summitShare(level: Level, x: number, z: number): number {
  const lifts = level.resort?.lifts;
  if (!lifts) return 0;
  const y = level.groundAt(x, z);
  let most = 0;
  for (const l of lifts) {
    if (l.kind === "drag") continue;
    const near = fade(SUMMIT.near, SUMMIT.far, Math.hypot(x - l.top.x, z - l.top.z));
    if (near <= 0) continue;
    const below = fade(SUMMIT.drop.from, SUMMIT.drop.to, l.top.y - y);
    most = Math.max(most, near * below);
  }
  return most;
}
