// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMIT, as the lens reads it — how much a skier is at the top of a
// lift, on its station's pad and just over its lip (R26), where the boom
// (`camera-rigs.ts`) stops leaning with the mountain. Three-free, so the
// suite reads it (`tests/world_render_test.ts`).
//
// A boom that leans its arm up the slope behind a skier reads a steep face
// as gentler than it is, which is what it is for on the way down. At the
// top it is the opposite of what is wanted: sliding off the pad toward its
// lip, the lens should stand LOW behind him and LEVEL (`SUMMIT_LOOK`), so
// the pad's edge is the edge of the world and the face beyond it is out of
// sight under the horizon — a lip that reads as a cliff, whatever colour
// the run off it. So the share is whole on a station's pad and down the
// RAMP off it (R26, `Lift.ramps`) to its LIP (`rampLip`: the ramp's foot
// where it falls evenly onto a steeper run, the knee where it rolls over
// into its own drop), and fades out over the first few metres he drops
// below that, the lens hanging a beat at the top and tipping down after him
// as the boom leans back in with the mountain.

import { rampFrame, rampHeight, rampLip, type Level } from "@engine";

/** Whole within `near` m of a top station and fading out by `far`; whole
 * down to `drop.from` m under its deck (its rim stands about 2 m under it,
 * R26) and gone by `drop.to` — and on a ramp off it, `beside` m either side
 * of the ramp's width, under its lip the same. */
export const SUMMIT = {
  near: 45,
  far: 110,
  drop: { from: 2.5, to: 14 },
  beside: 6,
} as const;

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
  for (const l of lifts) {
    for (const r of l.ramps ?? []) {
      const f = rampFrame(r, x, z);
      if (f.t < 0 || f.d > r.width / 2 + SUMMIT.beside) continue;
      // Whole down to the lip, and under it as far as he has dropped.
      const lip = rampLip(r);
      if (f.t * f.length > lip.at + SUMMIT.near) continue;
      const edge = rampHeight(r, lip.at / lip.length);
      const below = f.t * f.length <= lip.at ? 1 : fade(SUMMIT.drop.from, SUMMIT.drop.to, edge - y);
      most = Math.max(most, below);
    }
  }
  return most;
}
