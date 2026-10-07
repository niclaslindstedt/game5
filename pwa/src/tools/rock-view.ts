// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S ROCK VIEWS (`make world ARGS=--views=rocks,rocks-near,rocks-run,rocks-air`):
// the crags on the drops (the engine's `rocksOf`), through the game's own
// renderer.
//
//   * rocks, rocks-cliff — the widest cliff band from out on its landing,
//     square on and close from one side (the rockiest corner, where the
//     map has no cliff);
//   * rocks-near — the tallest outcrop on a whole wall, close, from 14 m
//     off down and across the slope;
//   * rocks-run — the outcrops nearest a run, from a skier's eye on it;
//   * rocks-air — the rockiest corner from a drone 160 m out over the valley.

import { nearestTrackPoint, rocksOf, rockyCliff, type Level, type Outcrop } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

export const ROCK_VIEWS = ["rocks", "rocks-cliff", "rocks-near", "rocks-run", "rocks-air"] as const;

/** The fall line at (x, z): its downhill unit vector. */
function fallAt(level: Level, x: number, z: number): { x: number; z: number } {
  const gx = level.groundAt(x + 15, z) - level.groundAt(x - 15, z);
  const gz = level.groundAt(x, z + 15) - level.groundAt(x, z - 15);
  const g = Math.hypot(gx, gz) || 1;
  return { x: -gx / g, z: -gz / g };
}

/** The outcrops' busiest 60 m square: its middle and how many. */
function busiest(all: Outcrop[]): { x: number; z: number; n: number } {
  const bins = new Map<string, Outcrop[]>();
  for (const o of all) {
    const k = `${Math.floor(o.x / 60)},${Math.floor(o.z / 60)}`;
    bins.set(k, [...(bins.get(k) ?? []), o]);
  }
  let best: Outcrop[] = [];
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
  const all = [...rocksOf(level)];
  if (all.length === 0) return null;
  const said = `${all.length} outcrops on the map`;
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
    const o = [...all].sort((a, b) => b.bare * b.height - a.bare * a.height)[0];
    const f = fallAt(level, o.x, o.z);
    // Down and across the slope, so the knot is seen along its strike.
    const ex = o.x + f.x * 10 + f.z * 9;
    const ez = o.z + f.z * 10 - f.x * 9;
    return {
      pose: {
        eye: { x: ex, y: level.groundAt(ex, ez) + 1.7, z: ez },
        target: { x: o.x, y: o.y + o.height * 0.45, z: o.z },
        fov: 55,
        roll: 0,
      },
      note: `close: the tallest crag, ${o.height.toFixed(1)} m, ${o.blocks} blocks; ${said}`,
    };
  }
  if (name === "rocks-run") {
    // The outcrop nearest any run, seen from the run a little below it.
    let best: { o: Outcrop; d: number; x: number; z: number } | null = null;
    for (const r of level.resort?.runs ?? [
      { points: level.track.points, length: level.track.length },
    ]) {
      const t = { track: { points: r.points, length: r.length, closed: false } as Level["track"] };
      for (const o of all) {
        if (o.height < 1.5) continue;
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
      note: `from the air: ${b.n} outcrops in 60 m; ${said}`,
    };
  }
  return { pose: below(level, b.x, b.z, 70, 2, 4), note: `${b.n} outcrops in 60 m; ${said}` };
}
