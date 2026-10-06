// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUNS A FREE RIDE HAS SKIED — and the two ways back onto them.
//
// A free ride owes no gate, so nothing on the course says where a skier
// belongs. Instead the run remembers every run of the ski area (R27) he has
// had his skis on (`Progress.skied`, the latest last), and:
//
//   * THE RESET stands him on the nearest point of the nearest of THOSE —
//     a piste before a lane — facing the way it runs there: back on the
//     snow he chose, never on a run he has not been near.
//   * THE RESTART stands him at the HEAD of the last piste he skied: the
//     top of the slope, to ski it again.
//
// Off a ski area the map's one piste is the only run (`TRACK_RUN`), and its
// head is the start line. Pure over the level and the run: the runs are
// walked in their published order and the first of two equal answers kept;
// nothing here draws from the stream.

import { nearestTrackPoint, nearestWithin, trackPointAt } from "../mapgen/index.ts";
import type { Level, TrackHit, TrackPoint } from "../mapgen/types.ts";
import type { GameState } from "./state.ts";

/** The id the map's own piste goes by where the map is no ski area. */
export const TRACK_RUN = "track";

/** How much nearer a TRANSPORT LANE (a cat track, R27) must be than a piste
 * for a reset to stand the skier on it, m: a skier set back on the snow is
 * set on a run to ski, and a lane is only the way between them. */
const LANE_HANDICAP = 40;

/** How far outside a run's edge a skier still counts as ON it, m — the
 * windrow and the edge poles are the run's too. */
const EDGE_GRACE = 3;

/** How often a free ride asks which run it is on, steps (a quarter of a
 * second at 120 Hz): a run is a hundred metres wide at a skier's pace. */
const NOTE_EVERY = 30;

/** The widest a run is asked about, m from its centreline: no run of the
 * ski area is wider than this either side. */
const REACH = 60;

/** ONE RUN as the free ride reads it: its id, whether it is a lane, and its
 * centreline as a line `nearestTrackPoint` can ask. */
type FreeLine = { id: string; lane: boolean; track: { points: TrackPoint[]; length: number } };

const lines = new WeakMap<Level, FreeLine[]>();

/** Every run of `level` a free ride can ski, in their published order: the
 * ski area's pistes and lanes, or the map's one piste off a ski area. */
function linesOf(level: Level): FreeLine[] {
  let out = lines.get(level);
  if (out) return out;
  const runs = level.resort?.runs.filter((r) => r.points.length >= 2) ?? [];
  out =
    runs.length > 0
      ? runs.map((r) => ({
          id: r.id,
          lane: r.kind === "road",
          track: { points: r.points, length: r.length },
        }))
      : [{ id: TRACK_RUN, lane: false, track: level.track }];
  lines.set(level, out);
  return out;
}

const hit: TrackHit = { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };

/** The run (x, z) is ON — inside its edges, give or take `EDGE_GRACE` — the
 * one whose centreline is nearest where two meet; null off every run. */
export function runUnder(level: Level, x: number, z: number): string | null {
  let best: string | null = null;
  let score = Infinity;
  for (const line of linesOf(level)) {
    nearestWithin(line, x, z, REACH, hit);
    if (hit.distance === Infinity) continue;
    const half = line.track.points[hit.index].width / 2 + EDGE_GRACE;
    if (hit.distance <= half && hit.distance < score) {
      score = hit.distance;
      best = line.id;
    }
  }
  return best;
}

/** Note `id` as the run skied last: to the end of the list, once. */
export function noteRun(state: GameState, id: string): void {
  const skied = state.progress.skied;
  if (skied[skied.length - 1] === id) return;
  const at = skied.indexOf(id);
  if (at >= 0) skied.splice(at, 1);
  skied.push(id);
}

/** THE FREE RIDE'S MEMORY, a step's worth: every `NOTE_EVERY` steps, the run
 * under a skier with his skis on the snow is noted as skied. */
export function noteSkied(state: GameState): void {
  if (state.tick % NOTE_EVERY !== 0) return;
  const c = state.skier;
  if (c.airborne || c.thrown || c.lift) return;
  const id = runUnder(state.level, c.x, c.z);
  if (id !== null) noteRun(state, id);
}

/** The run a free ride is stood up on before it has skied anything: the
 * PISTE nearest (x, z) — never a lane — or the map's own off a ski area. */
export function nearestPiste(level: Level, x: number, z: number): string {
  let best = TRACK_RUN;
  let score = Infinity;
  for (const line of linesOf(level)) {
    if (line.lane) continue;
    const d = nearestTrackPoint(line, x, z, hit).distance;
    if (d < score) {
      score = d;
      best = line.id;
    }
  }
  return best;
}

/** WHERE A FREE RIDE'S RESET STANDS THE SKIER: the nearest point of the
 * nearest run he has skied (every run where he has skied none) — a piste
 * preferred over a lane by `LANE_HANDICAP` — facing the way it runs. */
export function skiedResetPoint(state: GameState): TrackPoint {
  const level = state.level;
  const skied = state.progress.skied;
  const all = linesOf(level);
  const pool = all.filter((l) => skied.includes(l.id));
  let best: TrackPoint | null = null;
  let score = Infinity;
  for (const line of pool.length > 0 ? pool : all) {
    const near = nearestTrackPoint(line, state.skier.x, state.skier.z, hit);
    const d = near.distance + (line.lane ? LANE_HANDICAP : 0);
    if (d < score) {
      score = d;
      best = trackPointAt(line, near.s);
    }
  }
  return best ?? trackPointAt(level, nearestTrackPoint(level, state.skier.x, state.skier.z).s);
}

/** The last PISTE the run has skied (a lane's head is no top of a slope),
 * by id; undefined before it has skied one. */
export function lastPiste(state: GameState): string | undefined {
  const all = linesOf(state.level);
  const skied = state.progress.skied;
  for (let i = skied.length - 1; i >= 0; i--) {
    if (all.some((l) => l.id === skied[i] && !l.lane)) return skied[i];
  }
  return undefined;
}

/** THE TOP OF A SLOPE: where a free ride's restart stands the skier on the
 * piste `id` — its head, facing down it. Null for the map's own piste off a
 * ski area (its head is the start line, where a run is stood up anyway)
 * and for an id that is no piste of the map. */
export function pisteHead(
  level: Level,
  id: string,
): { x: number; z: number; heading: number } | null {
  const line = linesOf(level).find((l) => l.id === id && !l.lane && l.id !== TRACK_RUN);
  if (!line) return null;
  const top = line.track.points[0];
  return { x: top.x, z: top.z, heading: top.heading };
}

/** THE TOP OF THE SLOPE A RUN WAS ON: the head of the last piste it skied
 * (the piste nearest the skier where it has skied none), or the start line
 * off a ski area. */
export function topOfSlope(state: GameState): { x: number; z: number; heading: number } {
  const c = state.skier;
  const id = lastPiste(state) ?? nearestPiste(state.level, c.x, c.z);
  const spawn = state.level.spawn;
  return pisteHead(state.level, id) ?? { x: spawn.x, z: spawn.z, heading: spawn.heading };
}
