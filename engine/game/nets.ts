// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE A-NETS (R32, R33) — the tall safety nets along both edges of a
// downhill or a super-G — and a ski cross's FENCE (R35), the course closed
// off along both its edges, which a racer carried into is out of the course
// as surely,
// strung on cables between steel posts a few metres outside the piste,
// that catch a racer who leaves the course at speed before the trees do.
//
// A NET IS A WALL THAT GIVES: a skier carried past its line on his skis is
// held on it — the way out taken off him, and the net closing round him so
// the speed along it dies within a couple of metres (`DOWNHILL_NETS.hold`,
// a share kept a step: some 0.3 of it in a tenth of a second) — and a racer
// driven into it harder than a brush (`DOWNHILL_NETS.out`) is out of the
// race: a downhiller caught in the nets does not go on. Harder still
// (`crash.netSpeed`) and he goes down into it (`crash.ts`'s `net` cause).
// The net's line is the piste's edge `nets.gap` metres out, read off the
// piste where he is (`nearestTrackPoint`), from the house to the finish
// arena.
//
// A BODY IN THE NET (`catchInNets`) is caught the way a racer's crash
// into one looks: the mesh BILLOWS back as he drives into it, up to the
// discipline's `nets.give` metres before the posts and cables hold, and
// takes his way out over that stroke (a spring and a damper, so a hard
// drive is stopped in the give and only a harder one bottoms it out — a
// blow, `Thrown.struck`); the mesh WRAPS what it holds, dragging the way
// along it and up it out of him in a few metres, so he drops to its foot
// tangled in it; and it hands back next to nothing
// — the net sags back no faster than `relax` and never further than the
// pocket his weight leaves in it (`pocket`), so he STAYS IN IT, lying at
// the foot of the bulge, until the reset. The skis go in too: every ski
// let go has one chance (`skiCatch`, off a hash, never the run's stream)
// of HOOKING in the mesh by the end that reaches it first, and a hooked
// end stays where it caught (`LoneSki.hooked`), the ski hanging off it —
// the old coarse meshes trapped ski tips often enough that the holes were
// made smaller, and a ski still ends up hung in the net more often than
// not. A ski cross's low FENCE takes none of this: a body thrown against
// it is held on its line (`holdOnLine`).
//
// Nothing here draws from any stream.

import { clamp, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import { DISCIPLINE_RULES, nearestTrackPoint, netsOf, speedCourseOf } from "../mapgen/index.ts";
import type { Level, TrackHit } from "../mapgen/types.ts";
import { outRun } from "./course.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameEvent, GameState, LoneSki, Thrown } from "./state.ts";

/** THE NETS AS A RACER MEETS THEM. */
export const DOWNHILL_NETS = {
  /** The share of his speed along the net kept a step while he is held in
   * it (at 120 Hz). */
  hold: 0.93,
  /** A drive into the net faster than this, m/s across it, puts him out;
   * one faster than `felt` is reported. */
  out: 2,
  felt: 1,
  /** THE NET TAKING A BODY (`catchInNets`): the spring of the mesh
   * billowing, 1/s² per metre in (a 10 m/s drive across it stopped in some
   * 1.3 m of its give), and its damping, 1/s; */
  spring: 45,
  damp: 4,
  /** the mesh dragging the way ALONG it and up it out of what it holds,
   * m/s² and a share a second of what is left — a racer driven in at
   * 100 km/h at a shallow angle is carried some fifteen metres down it,
   * not dozens; */
  drag: 6,
  snag: 1.5,
  /** the pocket his weight leaves in it, m, and how fast the net sags back
   * toward it, m/s — next to nothing: a net takes, it does not throw back;
   */
  pocket: 0.6,
  relax: 0.4,
  /** and the chance a ski let go has of HOOKING in the mesh by the end
   * that reaches it first. */
  skiCatch: 0.75,
} as const;

/** The hash's own salt: no other draw reads this stream. */
const SALT = 0x4e75;

const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };

/** WHERE (x, z) STANDS AGAINST A NET: the way out through it `(ux, uz)`,
 * square to the piste where (x, z) is, and how far past its line (x, z)
 * stands, m — null off the netted stretch or inside it. The app's drawn
 * net bulges by the same answer. */
export function netPocket(
  level: Level,
  x: number,
  z: number,
): { ux: number; uz: number; past: number } | null {
  const nets = netsOf(level);
  if (!nets) return null;
  nearestTrackPoint(level, x, z, hit);
  if (hit.s < nets.from || hit.s > nets.to || hit.distance < 1e-6) return null;
  const half = (level.track.points[hit.index]?.width ?? 0) / 2 + nets.gap;
  const past = hit.distance - half;
  if (past <= 0) return null;
  return { ux: (x - hit.x) / hit.distance, uz: (z - hit.z) / hit.distance, past };
}

/** How far a body sinks into the net before its posts and cables hold, m
 * — its discipline's `nets.give`. */
function giveOf(level: Level): number {
  return (level.downhill ? DISCIPLINE_RULES.downhill : DISCIPLINE_RULES.superG).nets.give;
}

/** Hold whatever of the skier has gone past a net on the net — his body,
 * once he is thrown into an A-net, is `catchInNets`'. */
export function stepNets(state: GameState, events: GameEvent[]): void {
  if (!netsOf(state.level)) return;
  const c = state.skier;
  if (c.thrown) {
    // A ski cross's low fence takes no pocket: his body is held on its
    // line, point by point, and its way out taken.
    if (!speedCourseOf(state.level)) holdOnLine(state, c.thrown);
    return;
  }
  const net = netPocket(state.level, c.x, c.z);
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

/** A thrown body held on a net's line: every point past it put back on it
 * and its way out taken. */
function holdOnLine(state: GameState, off: Thrown): void {
  const pts = off.points;
  const last = off.last;
  for (let i = 0; i < pts.length; i += 3) {
    const net = netPocket(state.level, pts[i], pts[i + 2]);
    if (!net) continue;
    pts[i] -= net.ux * net.past;
    pts[i + 2] -= net.uz * net.past;
    last[i] = pts[i];
    last[i + 2] = pts[i + 2];
  }
  const net = netPocket(state.level, off.x, off.z);
  if (!net) return;
  off.x -= net.ux * net.past;
  off.z -= net.uz * net.past;
  const out = off.vx * net.ux + off.vz * net.uz;
  if (out > 0) {
    off.vx -= out * net.ux;
    off.vz -= out * net.uz;
  }
}

/** THE NET TAKING WHAT IS THROWN INTO IT, after the body's and the skis'
 * own step (`stepThrown`): every point of him past a net's line billowed
 * into it, wrapped and held in its pocket, and every ski let go
 * hooked in it or held like him. */
export function catchInNets(state: GameState, b: Thrown): void {
  b.netted = 0;
  const level = state.level;
  if (!speedCourseOf(level)) return;
  const give = giveOf(level);
  const P = b.points;
  const L = b.last;
  for (let j = 0, i = 0; j < P.length; j += 3, i++) {
    const net = netPocket(level, P[j], P[j + 2]);
    if (!net) continue;
    b.netted |= 1 << i;
    const bottom = takeInto(P, L, j, net, give);
    if (bottom > b.struck[i]) b.struck[i] = bottom;
  }
  for (const ski of b.skis) catchSki(state, ski, give);
}

/** One ski's ends in the mesh: a hook tried the first time one reaches
 * it, and an end not hooked taken into it as a body's point is. */
function catchSki(state: GameState, ski: LoneSki, give: number): void {
  if (ski.held > 0) return;
  const P = ski.ends;
  for (let e = 0; e < 2; e++) {
    const bit = 1 << e;
    if (ski.hooked & bit) continue;
    const j = 3 * e;
    const net = netPocket(state.level, P[j], P[j + 2]);
    if (!net) continue;
    takeInto(P, ski.last, j, net, give);
    // ONE CHANCE A SKI, at the end that reaches the mesh first: hooked, it
    // hangs off that end and the other swings in under it.
    if (ski.tried) continue;
    ski.tried = bit;
    const draw = hash2(state.tick, 2 * ski.side + e, (state.seed ^ SALT) | 0);
    if (draw >= DOWNHILL_NETS.skiCatch) continue;
    ski.hooked |= bit;
    for (let a = j; a < j + 3; a++) ski.hook[a] = P[a];
  }
}

/** One point at `P[j]` (its last position `L[j]`) past the net `net`
 * taken into it, `give` m of it the most: the mesh's spring and damper
 * against the way out, its drag along it and down it, and its sag back
 * no faster than `relax` to the pocket. Returns the way out it still had
 * on meeting the posts and cables at the full give, m/s — a blow, or 0. */
function takeInto(
  P: number[],
  L: number[],
  j: number,
  net: { ux: number; uz: number; past: number },
  give: number,
): number {
  const N = DOWNHILL_NETS;
  const dt = TUNING.dt;
  let vx = (P[j] - L[j]) / dt;
  let vy = (P[j + 1] - L[j + 1]) / dt;
  let vz = (P[j + 2] - L[j + 2]) / dt;
  const { ux, uz } = net;
  // ACROSS THE NET: out through it against the spring and the damper; back
  // in, the sag, toward the pocket and no faster than `relax`.
  let out = vx * ux + vz * uz;
  vx -= out * ux;
  vz -= out * uz;
  let past = net.past;
  let bottom = 0;
  if (out > 0) out = Math.max(0, out - (N.spring * past + N.damp * out) * dt);
  else out = Math.max(out, -N.relax * clamp((past - N.pocket) / N.pocket, 0, 1));
  if (past > give) {
    bottom = Math.max(0, out);
    P[j] -= ux * (past - give);
    P[j + 2] -= uz * (past - give);
    past = give;
    out = Math.min(out, 0);
  }
  // ALONG IT AND UP IT: the mesh wrapped round him drags the way out of
  // him, so he is not carried far along it and a body flung over in it
  // does not vault up it. Down it he drops, to its foot: the mesh is
  // pegged to the snow and holds no one up.
  const up = Math.max(0, vy);
  const along = hypot3(vx, up, vz);
  if (along > 1e-9) {
    const keep = Math.max(0, along - (N.drag + N.snag * along) * dt) / along;
    vx *= keep;
    vz *= keep;
    if (up > 0) vy *= keep;
  }
  vx += out * ux;
  vz += out * uz;
  L[j] = P[j] - vx * dt;
  L[j + 1] = P[j + 1] - vy * dt;
  L[j + 2] = P[j + 2] - vz * dt;
  return bottom;
}
