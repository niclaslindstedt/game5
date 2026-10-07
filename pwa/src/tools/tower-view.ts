// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S TOWER VIEWS (`make world ARGS=--views=tower-pad,tower-edge,tower-span`):
// the lift towers where they meet the runs (`lift-line.ts`'s `TOWER_SITE`),
// as a skier on the run sees them, through the game's own renderer.
//
//   * tower-pad — the tower standing nearest a run's middle (padded, where
//     the plan pads it), from a skier's eye on the run 26 m up the slope;
//   * tower-edge — a bare tower standing just off a run's edge, from the
//     run's middle a little up the slope, so the setback reads;
//   * tower-span — a line spanning a run between two towers off its
//     edges, from the run's middle under the rope, looking along the run.

import { liftPlans, nearestTrackPoint, pisteGap, type Level, type Support } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

export const TOWER_VIEWS = ["tower-pad", "tower-edge", "tower-span"] as const;

type Found = { s: Support; gap: number; heading: number };

/** Every tower of the map with how far it stands outside a run's edge. */
function towers(level: Level): Found[] {
  const out: Found[] = [];
  for (const p of liftPlans(level)) {
    for (const s of p.supports) {
      if (!s.station)
        out.push({ s, gap: pisteGap(level, s.x, s.z) - p.look.column, heading: p.heading });
    }
  }
  return out;
}

/** The nearest run to (x, z), its line as a track. */
function runNear(level: Level, x: number, z: number) {
  let best = { d: Infinity, run: null as Level["track"] | null };
  for (const r of level.resort?.runs ?? []) {
    const t = { points: r.points, length: r.length, closed: false } as Level["track"];
    const hit = nearestTrackPoint({ track: t }, x, z);
    if (hit.distance < best.d) best = { d: hit.distance, run: t };
  }
  return best.run ?? level.track;
}

/** A skier's eye on the run, `back` m up it from the point nearest
 * (x, z), looking at (x, y, z). */
function fromRun(level: Level, x: number, z: number, y: number, back: number): LensPose {
  const run = runNear(level, x, z);
  const hit = nearestTrackPoint({ track: run }, x, z);
  const i = Math.max(0, hit.index - Math.round(back / 2));
  const p = run.points[i];
  return {
    eye: { x: p.x, y: level.groundAt(p.x, p.z) + 1.7, z: p.z },
    target: { x, y, z },
    fov: 55,
    roll: 0,
  };
}

export function towerView(level: Level, name: string): { pose: LensPose; note: string } | null {
  const all = towers(level);
  if (name === "tower-pad") {
    const t = [...all].sort((a, b) => a.gap - b.gap)[0];
    if (!t) return null;
    const padded = all.filter((o) => o.s.pad).length;
    return {
      pose: fromRun(level, t.s.x, t.s.z, t.s.ground + 2, 26),
      note: `the tower nearest a run's middle, ${t.gap.toFixed(1)} m outside its edge${t.s.pad ? ", padded" : ""}; ${padded} padded of ${all.length}`,
    };
  }
  if (name === "tower-edge") {
    const bare = all.filter((t) => !t.s.pad && t.gap < 12).sort((a, b) => a.gap - b.gap);
    const t = bare[0];
    if (!t) return null;
    return {
      pose: fromRun(level, t.s.x, t.s.z, t.s.ground + 4, 40),
      note: `bare tower ${t.gap.toFixed(1)} m outside the run's edge`,
    };
  }
  // tower-span: the longest span whose middle stands on a run.
  let best: { a: Support; b: Support; len: number } | null = null;
  for (const p of liftPlans(level)) {
    for (let i = 0; i + 1 < p.supports.length; i++) {
      const a = p.supports[i];
      const b = p.supports[i + 1];
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      if (pisteGap(level, mx, mz) >= 0) continue;
      const len = b.u - a.u;
      if (!best || len > best.len) best = { a, b, len };
    }
  }
  if (!best) return null;
  const mx = (best.a.x + best.b.x) / 2;
  const mz = (best.a.z + best.b.z) / 2;
  return {
    pose: fromRun(level, mx, mz, level.groundAt(mx, mz) + 8, 60),
    note: `a ${Math.round(best.len)} m span across a run`,
  };
}
