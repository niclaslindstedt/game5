// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT EVERY KIND OF CHALLENGE ASKS OF A MAP AND A RUN: the runs a line or
// a goal may be dealt on (in an order that is the map's alone), a gate laid
// across one, whether a step crossed it, and whether the skier is on his
// own skis. Pure; nothing here draws from any stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { nearestWithin, skiRoutesOf, trackPointAt } from "../../mapgen/index.ts";
import type { RunGrade } from "../../mapgen/grades.ts";
import type { Level, TrackHit, TrackPoint } from "../../mapgen/types.ts";
import { balloonAboard } from "../balloon.ts";
import type { GameState } from "../state.ts";
import type { ChallengeGate } from "./types.ts";

/** A RUN a challenge can be dealt on: a piste of the ski area or one of
 * its ski routes (R42) — never a transport lane — with its line as the
 * piste queries read one. */
export type DealtRun = {
  id: string;
  grade: RunGrade;
  /** The arc the last summit ramp joins it at (0 with none), m. */
  ramp: number;
  track: { points: TrackPoint[]; length: number };
};

const runsOf = new WeakMap<Level, DealtRun[]>();

/** Every run of `level` a challenge may be dealt on, SORTED BY ID — the
 * same list whichever course the map was stood up on (a free ride's level
 * differs only by its course, and the ski area under it is one). */
export function dealtRuns(level: Level): DealtRun[] {
  let out = runsOf.get(level);
  if (out) return out;
  const ramps = new Map<string, number>();
  for (const lift of level.resort?.lifts ?? []) {
    for (const r of lift.ramps ?? []) ramps.set(r.run, Math.max(ramps.get(r.run) ?? 0, r.to.s));
  }
  const pistes = (level.resort?.runs ?? [])
    .filter((r) => r.kind === "piste" && r.points.length >= 2)
    .map((r) => ({
      id: r.id,
      grade: r.grade,
      ramp: ramps.get(r.id) ?? 0,
      track: { points: r.points, length: r.length },
    }));
  const routes = skiRoutesOf(level).map((r) => ({
    id: r.id,
    grade: "orange" as const,
    ramp: 0,
    track: { points: r.points, length: r.length },
  }));
  out = [...pistes, ...routes].sort((a, b) => byId(a.id, b.id));
  runsOf.set(level, out);
  return out;
}

/** A fixed order on ids: shorter first, then by character — "2" before
 * "13", and the same on every machine. */
export function byId(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

/** A STABLE HASH of a string, 32 bits (FNV-1a). */
export function hashText(text: string, salt = 0): number {
  let h = (0x811c9dc5 ^ salt) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** THE GATE across `run` at arc `s`: its middle on the centreline, the
 * run's heading and width there, and its two flags. */
export function gateOn(run: DealtRun, s: number): ChallengeGate {
  const p = trackPointAt(run, s);
  const half = p.width / 2;
  // Heading 0 is +z, clockwise from above: the right of the way down is
  // (cos h, −sin h).
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    heading: p.heading,
    width: p.width,
    s: p.s,
    left: { x: p.x - rx * half, z: p.z - rz * half },
    right: { x: p.x + rx * half, z: p.z + rz * half },
  };
}

/** Where along the step from (x0, z0) to (x1, z1) it crossed `gate`
 * between its flags going DOWN the run (with the heading), 0..1 — or −1
 * when it did not. */
export function gateCrossing(
  gate: ChallengeGate,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): number {
  const fx = Math.sin(gate.heading);
  const fz = Math.cos(gate.heading);
  const a = (x0 - gate.x) * fx + (z0 - gate.z) * fz;
  const b = (x1 - gate.x) * fx + (z1 - gate.z) * fz;
  if (!(a < 0 && b >= 0)) return -1;
  const k = a / (a - b);
  const cx = x0 + (x1 - x0) * k - gate.x;
  const cz = z0 + (z1 - z0) * k - gate.z;
  const across = cx * Math.cos(gate.heading) - cz * Math.sin(gate.heading);
  return Math.abs(across) <= gate.width / 2 ? k : -1;
}

const hit: TrackHit = { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };

/** Where on `run` (x, z) lies — its arc and how far outside the run's edge,
 * m (negative inside) — or null farther than `within` m off its line. */
export function onRun(
  run: DealtRun,
  x: number,
  z: number,
  within: number,
): { s: number; out: number } | null {
  nearestWithin(run, x, z, within, hit);
  if (hit.distance === Infinity) return null;
  return { s: hit.s, out: hit.distance - run.track.points[hit.index].width / 2 };
}

/** Whether the skier is ON HIS OWN SKIS (or his own feet): not thrown,
 * not carried by a lift, not in or on any machine, not inside a lodge. */
export function onOwnSkis(s: GameState): boolean {
  const k = s.skier;
  if (k.thrown || k.lift || k.fetch || k.town) return false;
  if (s.heli?.rider || s.plane?.rider) return false;
  const ch = s.chute;
  if (ch && !ch.done && ch.mode !== "landed" && ch.mode !== "released") return false;
  if (s.sled?.mode === "ridden") return false;
  if (s.para && s.para.mode !== "dropped") return false;
  if (s.balloon && balloonAboard(s)) return false;
  if (s.afterski?.inside) return false;
  if (s.groomers?.some((g) => g.rider)) return false;
  return true;
}

/** THE STEP A JUDGE SAW LAST: where the skier was and when. `step` hands
 * back the previous step's place and keeps this one's — null on a run it
 * has not seen (a restart is a new state), on a clock that went back, or
 * on a step longer than `jump` m (a skier set down elsewhere, never
 * skied there). */
export function trackPrev(): {
  step(state: GameState, jump: number): { x: number; z: number; t: number } | null;
} {
  let seen: GameState | null = null;
  const was = { x: 0, z: 0, t: 0 };
  const then = { x: 0, z: 0, t: 0 };
  return {
    step(state, jump) {
      const k = state.skier;
      const fresh = seen !== state || state.t < was.t || hypot(k.x - was.x, k.z - was.z) > jump;
      then.x = was.x;
      then.z = was.z;
      then.t = was.t;
      seen = state;
      was.x = k.x;
      was.z = k.z;
      was.t = state.t;
      return fresh ? null : then;
    },
  };
}
