// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S ROCK VIEWS (`make world ARGS=--views=rocks,rocks-near,rocks-run,rocks-air`):
// the rock on the drops (the walls' skin over the engine's `rockShare`, the
// cliffs' walls), through the game's own renderer.
//
//   * rocks, rocks-cliff — the widest cliff band from out on its landing,
//     square on and close from one side (the rockiest corner, where the
//     map has no cliff);
//   * rocks-near — the barest spot of a wall, close, from 14 m off down
//     and across the slope;
//   * rocks-run — the bare wall nearest a run, from a skier's eye on it;
//   * rocks-air — the rockiest corner from a drone 160 m out over the valley.

import { nearestTrackPoint, regionOf, rockShare, rockyCliff, type Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

export const ROCK_VIEWS = ["rocks", "rocks-cliff", "rocks-near", "rocks-run", "rocks-air"] as const;

/** The fall line at (x, z): its downhill unit vector. */
function fallAt(level: Level, x: number, z: number): { x: number; z: number } {
  const gx = level.groundAt(x + 15, z) - level.groundAt(x - 15, z);
  const gz = level.groundAt(x, z + 15) - level.groundAt(x, z - 15);
  const g = Math.hypot(gx, gz) || 1;
  return { x: -gx / g, z: -gz / g };
}

/** A bare spot of a wall. */
type Spot = { x: number; z: number; y: number; bare: number };

/** The map's bare ground, sampled every 8 m. */
function spotsOf(level: Level): Spot[] {
  const out: Spot[] = [];
  if (!regionOf(level).rock) return out;
  for (let z = 8; z < level.size - 8; z += 8) {
    for (let x = 8; x < level.size - 8; x += 8) {
      const bare = rockShare(level, x, z);
      if (bare > 0.3) out.push({ x, z, y: level.groundAt(x, z), bare });
    }
  }
  return out;
}

/** The bare ground's busiest 60 m square: its middle and how many spots. */
function busiest(all: Spot[]): { x: number; z: number; n: number } {
  const bins = new Map<string, Spot[]>();
  for (const o of all) {
    const k = `${Math.floor(o.x / 60)},${Math.floor(o.z / 60)}`;
    bins.set(k, [...(bins.get(k) ?? []), o]);
  }
  let best: Spot[] = [];
  for (const b of bins.values()) if (b.length > best.length) best = b;
  return {
    x: best.reduce((a, o) => a + o.x, 0) / best.length,
    z: best.reduce((a, o) => a + o.z, 0) / best.length,
    n: best.length,
  };
}

/** A lens `back` m down the fall line from (x, z), `high` m over the
 * snow, looking at the ground there plus `rise`. */
function below(
  level: Level,
  x: number,
  z: number,
  back: number,
  high: number,
  rise: number,
  fov = 55,
): LensPose {
  const f = fallAt(level, x, z);
  const ex = x + f.x * back;
  const ez = z + f.z * back;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + high, z: ez },
    target: { x, y: level.groundAt(x, z) + rise, z },
    fov,
    roll: 0,
  };
}

export function rockView(level: Level, name: string): { pose: LensPose; note: string } | null {
  const all = spotsOf(level);
  if (all.length === 0) return null;
  const said = `${Math.round((all.length * 64) / 1000)}k m² of bare wall on the map`;
  if (name === "rocks" || name === "rocks-cliff") {
    // The widest rocky cliff, from out below it on its landing: square on
    // (`rocks`), or close and off to one side (`rocks-cliff`).
    const c = [...(level.cliffs ?? [])].filter(rockyCliff).sort((a, b) => b.width - a.width)[0];
    if (c) {
      const near = name === "rocks-cliff";
      const out = near ? 16 : 40;
      const side = near ? 12 : 0;
      const ex = c.x + Math.sin(c.heading) * out + Math.cos(c.heading) * side;
      const ez = c.z + Math.cos(c.heading) * out - Math.sin(c.heading) * side;
      return {
        pose: {
          eye: { x: ex, y: level.groundAt(ex, ez) + 1.7, z: ez },
          target: { x: c.x, y: c.y - c.drop * 0.5, z: c.z },
          fov: 58,
          roll: 0,
        },
        note: `cliff ${c.id}: ${c.drop.toFixed(1)} m drop, ${Math.round(c.width)} m wide; ${said}`,
      };
    }
  }
  if (name === "rocks-near") {
    // The barest spot of the rockiest 60 m, not a lone steep pitch.
    const c = busiest(all);
    const o = [...all]
      .filter((p) => Math.hypot(p.x - c.x, p.z - c.z) < 40)
      .sort((a, b) => b.bare - a.bare)[0];
    const f = fallAt(level, o.x, o.z);
    // Down and across the slope, so the wall is seen along its contour.
    const ex = o.x + f.x * 22 + f.z * 12;
    const ez = o.z + f.z * 22 - f.x * 12;
    return {
      pose: {
        eye: { x: ex, y: level.groundAt(ex, ez) + 1.7, z: ez },
        target: { x: o.x, y: o.y + 2, z: o.z },
        fov: 55,
        roll: 0,
      },
      note: `close: the barest wall; ${said}`,
    };
  }
  if (name === "rocks-run") {
    // The bare wall nearest any run, seen from the run a little below it.
    let best: { o: Spot; d: number; x: number; z: number } | null = null;
    for (const r of level.resort?.runs ?? [
      { points: level.track.points, length: level.track.length },
    ]) {
      const t = { track: { points: r.points, length: r.length, closed: false } as Level["track"] };
      for (const o of all) {
        if (o.bare < 0.6) continue;
        const hit = nearestTrackPoint(t, o.x, o.z);
        if (hit.distance > 25 && (!best || hit.distance < best.d)) {
          const p = r.points[Math.min(r.points.length - 1, hit.index + 15)];
          best = { o, d: hit.distance, x: p.x, z: p.z };
        }
      }
    }
    if (!best) return null;
    return {
      pose: {
        eye: { x: best.x, y: level.groundAt(best.x, best.z) + 1.7, z: best.z },
        target: { x: best.o.x, y: best.o.y + 1.5, z: best.o.z },
        fov: 58,
        roll: 0,
      },
      note: `from a run, a crag ${best.d.toFixed(0)} m off it; ${said}`,
    };
  }
  const b = busiest(all);
  if (name === "rocks-air") {
    return {
      pose: below(level, b.x, b.z, 160, 90, 0, 50),
      note: `from the air: the rockiest 60 m; ${said}`,
    };
  }
  return { pose: below(level, b.x, b.z, 70, 2, 4), note: `the rockiest 60 m; ${said}` };
}
