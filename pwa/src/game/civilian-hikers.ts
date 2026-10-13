// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER'S HIKERS ON THE TRACKS — a few parties walking the ski area's
// cat tracks (`Run.kind === "road"`, a gravel road in summer —
// `summer-ground.ts`), or where it has none, its gentlest runs' grass: each
// a stretch of a few hundred metres walked up and back through the track's
// bends at a hiker's pace, resting at the far end. In winter those tracks
// are skied, so nobody walks them; in summer nothing does but the odd bike.
//
// Dealt by `civilian-plan.ts` on its own summer stream (presentation only,
// no digest moves); a pure function of the map off that stream. Three-free.

import type { Level, Rng, Run } from "@engine";

import { routeOf, type Route } from "./civilian-route.ts";

/** THE TRACK HIKES: how many parties a map deals (dealt between the two),
 * how many walk in each (a leader and her party), the stretch walked, m,
 * its points' spacing, m, the pace up a track, m/s (slower than on the
 * flat), and the rest at the far end, s. */
export const TRACK_HIKES = {
  parties: [3, 6] as const,
  party: [1, 4] as const,
  stretch: [160, 480] as const,
  step: 12,
  speed: [0.9, 1.25] as const,
  rest: [25, 70] as const,
  /** The shortest run a party is put on, m. */
  least: 200,
} as const;

/** A party on a track: its route (walked through its bends) and how many
 * walk it. */
export type TrackHike = { run: string; route: Route; size: number };

/** The tracks a summer's hikers walk: the cat tracks, else the greens and
 * blues (a walker keeps off the steep), every one long enough. */
function tracksOf(level: Level): Run[] {
  const runs = level.resort?.runs ?? [];
  const long = (r: Run) => r.length >= TRACK_HIKES.least;
  const roads = runs.filter((r) => r.kind === "road" && long(r));
  if (roads.length > 0) return roads;
  return runs.filter((r) => (r.grade === "green" || r.grade === "blue") && long(r));
}

/** A stretch of `run` from arc `s0` to `s1`, a point every `step` m. */
function stretchOf(run: Run, s0: number, s1: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  let next = s0;
  for (const p of run.points) {
    if (p.s < next || p.s > s1) continue;
    out.push({ x: p.x, z: p.z });
    next = p.s + TRACK_HIKES.step;
  }
  return out;
}

/** THE PARTIES on `level`'s tracks, dealt off `rng`. None where the ski
 * area has no track long enough. */
export function dealTrackHikes(rng: Rng, level: Level): TrackHike[] {
  const tracks = tracksOf(level);
  if (tracks.length === 0) return [];
  const out: TrackHike[] = [];
  const n = rng.int(TRACK_HIKES.parties[0], TRACK_HIKES.parties[1]);
  for (let k = 0; k < n; k++) {
    const run = rng.pick(tracks);
    const want = rng.range(TRACK_HIKES.stretch[0], TRACK_HIKES.stretch[1]);
    const len = Math.min(want, run.length);
    const s0 = rng.range(0, Math.max(0, run.length - len));
    const points = stretchOf(run, s0, s0 + len);
    const speed = rng.range(TRACK_HIKES.speed[0], TRACK_HIKES.speed[1]);
    const rest = rng.range(TRACK_HIKES.rest[0], TRACK_HIKES.rest[1]);
    const size = rng.int(TRACK_HIKES.party[0], TRACK_HIKES.party[1]);
    if (points.length < 2) continue;
    // Half the parties are on their way down: the track walked the other way.
    if (rng.chance(0.5)) points.reverse();
    out.push({ run: run.id, route: routeOf(points, speed, rest, 0, true), size });
  }
  return out;
}
