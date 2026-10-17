// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS CUT BY A LIFT'S ROPE (`cable-cut.ts`): a ski of a thrown body
// the rope went through this step is cut in two where it crossed. The
// piece with the binding stays the ski in `Thrown.skis`, its ends drawn in
// to what is left of it; the piece cut off goes on as a ski of its own in
// `Thrown.halves`. Each keeps the share of the whole ski it is
// (`LoneSki.part`) and where the binding was on the whole one
// (`LoneSki.mount`, which may now lie off its own ends), so the drawing
// lays the whole ski where it would be and shows only that share of it.

import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import type { RopeFrame } from "./cable-cut.ts";
import { sweptThrough } from "./cable-cut.ts";
import { CABLE } from "./defs/cable.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameState, LoneSki } from "./state.ts";

const dt = TUNING.dt;

/** A point seen down the rope (`cable-cut.ts`' frame), into `out`. */
function seen(f: RopeFrame, P: readonly number[], j: number, out: number[]): number[] {
  const x = P[j] - f.o[0];
  const y = P[j + 1] - f.o[1];
  const z = P[j + 2] - f.o[2];
  out[0] = x * f.e1[0] + y * f.e1[1] + z * f.e1[2];
  out[1] = x * f.e2[0] + y * f.e2[1] + z * f.e2[2];
  return out;
}

const t0 = [0, 0];
const l0 = [0, 0];
const t1 = [0, 0];
const l1 = [0, 0];

/** Where along a ski (0 its tail, 1 its tip, of its own ends) the rope
 * went through it this step, or null when it did not. A ski just let go
 * is swept back on `v`. */
function crossing(
  f: RopeFrame,
  ski: LoneSki,
  v: { x: number; y: number; z: number },
): number | null {
  const P = ski.ends;
  const fresh = ski.last.every((x, i) => x === P[i]);
  const L = fresh
    ? P.map((x, i) => x - (i % 3 === 0 ? v.x : i % 3 === 1 ? v.y : v.z) * dt)
    : ski.last;
  seen(f, L, 0, t0);
  seen(f, L, 3, l0);
  seen(f, P, 0, t1);
  seen(f, P, 3, l1);
  if (!sweptThrough(t0, l0, t1, l1, CABLE.cut.ski)) return null;
  // The share along it nearest the rope's point, at the step's middle.
  const ax = (l0[0] + l1[0]) / 2;
  const ay = (l0[1] + l1[1]) / 2;
  const dx = (t0[0] + t1[0]) / 2 - ax;
  const dy = (t0[1] + t1[1]) / 2 - ay;
  const d = dx * dx + dy * dy;
  const k = d > 0 ? -(ax * dx + ay * dy) / d : 0.5;
  return Math.min(0.97, Math.max(0.03, k));
}

/** Where the rope `f` goes through each of `skis` this step (`crossing`). */
export function skisCrossed(
  f: RopeFrame,
  skis: readonly LoneSki[],
  v: { x: number; y: number; z: number },
): (number | null)[] {
  return skis.map((ski) => crossing(f, ski, v));
}

/** The ski `ski` (its share `lo`–`hi` of the whole) from its own share
 * `a` to `b` (0 the tail, 1 the tip): its ends and the step before drawn
 * in to that stretch, its share and its mount restated on it. */
function stretch(ski: LoneSki, a: number, b: number): LoneSki {
  const P = ski.ends;
  const L = ski.last;
  const lerp = (Q: number[], s: number, k: number): number => Q[3 + k] + (Q[k] - Q[3 + k]) * s;
  const ends = [0, 1, 2].map((k) => lerp(P, b, k)).concat([0, 1, 2].map((k) => lerp(P, a, k)));
  const last = [0, 1, 2].map((k) => lerp(L, b, k)).concat([0, 1, 2].map((k) => lerp(L, a, k)));
  const [lo, hi] = ski.part ?? [0, 1];
  const span = hi - lo;
  return {
    ...ski,
    held: 0,
    // The binding where it was on the whole ski, as a share of this piece.
    mount: (ski.mount - a) / (b - a),
    ends,
    last,
    kick: [0, 0, 0, 0, 0, 0],
    part: [lo + span * a, lo + span * b],
    touching: 0,
    hooked: 0,
    tried: 0,
    hook: [0, 0, 0, 0, 0, 0],
    up: ski.up.slice(),
  };
}

/** THE SPRING OF A CUT: `off` sent `CABLE.cut.part` m/s along the ski
 * (`way` 1 toward its tip, −1 its tail) and `lift` up, its ends turned
 * apart at `spin` rad/s end over end; `kept` a third of it back. */
function part(kept: LoneSki, off: LoneSki, way: number): void {
  const S = CABLE.cut.split;
  const P = off.ends;
  const dx = P[0] - P[3];
  const dy = P[1] - P[4];
  const dz = P[2] - P[5];
  const len = hypot3(dx, dy, dz) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;
  const shove = (ski: LoneSki, along: number, up: number, turn: number): void => {
    for (let e = 0; e < 2; e++) {
      const j = 3 * e;
      // The tip end up and the tail end down for a turn end over end.
      const flip = (e === 0 ? 1 : -1) * turn * (len / 2);
      ski.last[j] -= ux * along * dt;
      ski.last[j + 1] -= (uy * along + up + flip) * dt;
      ski.last[j + 2] -= uz * along * dt;
    }
  };
  shove(off, way * S.along, S.lift, way * S.spin);
  shove(kept, -way * S.along * S.back, 0, 0);
}

/** THE THROWN BODY'S SKIS the rope `f` went through this step cut in two
 * where it crossed them — or, for a pair let go this very step, where it
 * crossed them as they stood under him (`stood`, from `skisCrossed`).
 * How many it cut. */
export function cutSkis(
  run: GameState,
  f: RopeFrame,
  v: { x: number; y: number; z: number },
  stood?: readonly (number | null)[],
): number {
  const b = run.skier.thrown;
  if (!b) return 0;
  let n = 0;
  const all = [b.skis, (b.halves ??= [])];
  for (const list of all) {
    for (let i = list.length - 1; i >= 0; i--) {
      const ski = list[i];
      const k = stood ? (list === b.skis ? (stood[i] ?? null) : null) : crossing(f, ski, v);
      if (k === null) continue;
      // The binding's side of the cut stays where the ski was; the other
      // goes on its own.
      const bound = ski.mount < k;
      const kept = bound ? stretch(ski, 0, k) : stretch(ski, k, 1);
      const off = bound ? stretch(ski, k, 1) : stretch(ski, 0, k);
      // The steel through it springs the two apart: the piece cut off
      // thrown on away from the binding's along the ski, up off it and
      // turning end over end, the binding's checked the other way.
      part(kept, off, bound ? 1 : -1);
      list[i] = kept;
      b.halves.push(off);
      n++;
    }
  }
  return n;
}
