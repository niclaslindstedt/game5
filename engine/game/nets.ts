// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE A-NETS (R32, R33) — the tall safety nets along both edges of a
// downhill or a super-G — and a ski cross's FENCE (R35), the course closed
// off along both its edges, which a racer carried into is out of the course
// as surely,
// strung on cables between steel posts a few metres outside the piste,
// that catch a racer who leaves the course at speed before the trees do.
//
// A NET IS A WALL THAT GIVES: a skier (or, thrown, his body) carried past
// its line is held on it — the way out taken off him, and the net closing
// round him so the speed along it dies within a couple of metres
// (`DOWNHILL_NETS.hold`, a share kept a step: some 0.3 of it in a tenth of
// a second) — and a racer driven into it harder than a brush
// (`DOWNHILL_NETS.out`) is out of the race: a downhiller caught in the
// nets does not go on. The net's line is the piste's edge `nets.gap`
// metres out, read off the piste where he is (`nearestTrackPoint`), from
// the house to the finish arena. Nothing here draws from any stream.

import { nearestTrackPoint, netsOf } from "../mapgen/index.ts";
import type { TrackHit } from "../mapgen/types.ts";
import { outRun } from "./course.ts";
import type { GameEvent, GameState } from "./state.ts";

/** THE NETS AS A RACER MEETS THEM. */
export const DOWNHILL_NETS = {
  /** The share of his speed along the net kept a step while he is held in
   * it (at 120 Hz). */
  hold: 0.93,
  /** A drive into the net faster than this, m/s across it, puts him out;
   * one faster than `felt` is reported. */
  out: 2,
  felt: 1,
} as const;

const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };

/** The net line `(ux, uz)` outward from the piste where (x, z) is, and how
 * far past it (x, z) stands, m — null off the netted stretch or inside. */
function pastNet(
  state: GameState,
  x: number,
  z: number,
): { ux: number; uz: number; past: number } | null {
  const level = state.level;
  const nets = netsOf(level);
  if (!nets) return null;
  nearestTrackPoint(level, x, z, hit);
  if (hit.s < nets.from || hit.s > nets.to || hit.distance < 1e-6) return null;
  const half = (level.track.points[hit.index]?.width ?? 0) / 2 + nets.gap;
  const past = hit.distance - half;
  if (past <= 0) return null;
  return { ux: (x - hit.x) / hit.distance, uz: (z - hit.z) / hit.distance, past };
}

/** Hold whatever of the skier has gone past a net on the net. */
export function stepNets(state: GameState, events: GameEvent[]): void {
  if (!netsOf(state.level)) return;
  const c = state.skier;
  const off = c.thrown;
  if (off) {
    // His body held on the net, point by point, and its way out taken.
    const pts = off.points;
    const last = off.last;
    for (let i = 0; i < pts.length; i += 3) {
      const net = pastNet(state, pts[i], pts[i + 2]);
      if (!net) continue;
      pts[i] -= net.ux * net.past;
      pts[i + 2] -= net.uz * net.past;
      last[i] = pts[i];
      last[i + 2] = pts[i + 2];
    }
    const net = pastNet(state, off.x, off.z);
    if (net) {
      off.x -= net.ux * net.past;
      off.z -= net.uz * net.past;
      const out = off.vx * net.ux + off.vz * net.uz;
      if (out > 0) {
        off.vx -= out * net.ux;
        off.vz -= out * net.uz;
      }
    }
    return;
  }
  const net = pastNet(state, c.x, c.z);
  if (!net) return;
  c.x -= net.ux * net.past;
  c.z -= net.uz * net.past;
  const into = c.vx * net.ux + c.vz * net.uz;
  if (into > 0) {
    c.vx -= into * net.ux;
    c.vz -= into * net.uz;
  }
  c.vx *= DOWNHILL_NETS.hold;
  c.vz *= DOWNHILL_NETS.hold;
  // Once his way out is taken, only a fresh drive into it is felt.
  if (into > DOWNHILL_NETS.felt)
    events.push({ kind: "net", t: state.t, speed: into, x: c.x, z: c.z });
  const p = state.progress;
  const racing = state.phase === "racing" && p.started && !p.finished;
  if (racing && state.rules.gates === "strict" && into > DOWNHILL_NETS.out) {
    outRun(state, events, { status: "dnf", why: "net", gate: p.nextCheckpoint });
  }
}
