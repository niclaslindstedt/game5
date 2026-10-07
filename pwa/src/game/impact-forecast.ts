// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLOW SEEN COMING: the run a moment ahead, so the X-ray cam
// (`xray-shots.ts`) can slow the picture down BEFORE the bone goes rather
// than after. DOM-free and three-free.
//
// The engine is deterministic and every injury it deals is drawn off a hash
// of the blow, never off the run's stream (`body.ts`), so the future is
// there to be read: a COPY of the run (`forkRun`) is stepped on ahead with
// the hands the player holds now, and the first step that breaks a bone,
// does an injury of `FORECAST.ais` or worse, or tears him open (`gore.ts`)
// is the blow coming. The copy is the player's alone — the field and the
// crowd are left behind (a shoulder into one of them is the one blow this
// cannot see) — shares the map, which nothing in a step writes but its
// memos, and takes a stream of its own wherever the run carries one, so the
// run itself is never touched: its digests do not move.

import {
  bonesOf,
  createRng,
  step,
  TUNING,
  type BodyPart,
  type Bone,
  type GameState,
  type SkierInput,
} from "@engine";

/** How far ahead, how often, and what is worth slowing down for. */
export const FORECAST = {
  /** Seconds of run read ahead. */
  horizon: 0.6,
  /** Steps between two reads. */
  every: 12,
  /** The least AIS rank an injury with no fracture must be. */
  ais: 3,
} as const;

/** A blow seen coming: how many seconds off, the part it lands on, the
 * bones it breaks (none: an organ, a ligament, a wound) and whether it
 * tears him open (`gore.ts`). */
export type Forecast = { in: number; part: BodyPart | null; bones: Bone[]; gore: boolean };

const isRng = (o: Record<string, unknown>): boolean =>
  typeof o.next === "function" && typeof o.pick === "function" && typeof o.range === "function";

/** A deep copy of `v`: shared references kept shared, functions shared, a
 * stream (an `Rng`) dealt afresh off `seed`. */
function copy(v: unknown, seen: Map<object, unknown>, seed: { n: number }): unknown {
  if (v === null || typeof v !== "object") return v;
  const known = seen.get(v);
  if (known !== undefined) return known;
  if (ArrayBuffer.isView(v)) {
    const out = (v as unknown as { slice(): unknown }).slice();
    seen.set(v, out);
    return out;
  }
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    seen.set(v, out);
    for (const x of v) out.push(copy(x, seen, seed));
    return out;
  }
  if (v instanceof Map) {
    const out = new Map();
    seen.set(v, out);
    for (const [k, x] of v) out.set(k, copy(x, seen, seed));
    return out;
  }
  if (v instanceof Set) {
    const out = new Set();
    seen.set(v, out);
    for (const x of v) out.add(copy(x, seen, seed));
    return out;
  }
  const o = v as Record<string, unknown>;
  if (isRng(o)) {
    const out = createRng((seed.n = (seed.n * 1103515245 + 12345) >>> 0));
    seen.set(v, out);
    return out;
  }
  const out: Record<string, unknown> = {};
  seen.set(v, out);
  for (const k of Object.keys(o)) out[k] = copy(o[k], seen, seed);
  return out;
}

/** THE RUN COPIED for reading ahead: the player's own, on the same map,
 * the field and the crowd left out; nothing in it shared with the run but
 * the map and the pure functions. */
export function forkRun(state: GameState): GameState {
  const seen = new Map<object, unknown>([[state.level, state.level]]);
  const bare = { ...state, rivals: [], crowd: undefined, field: undefined };
  return copy(bare, seen, { n: (state.seed ^ state.tick) >>> 0 }) as GameState;
}

/** Whether an injury of `kind` on `part` is worth the cam. */
function worth(e: {
  part: BodyPart;
  injury: Parameters<typeof bonesOf>[0];
  ais: number;
}): Bone[] | null {
  const bones = bonesOf(e.injury, e.part);
  return bones.length > 0 || e.ais >= FORECAST.ais ? bones : null;
}

/** READ THE RUN AHEAD: the first blow worth the cam within `horizon` s if
 * the player holds `input`, or null. */
export function forecast(
  state: GameState,
  input: SkierInput,
  horizon: number = FORECAST.horizon,
): Forecast | null {
  const run = forkRun(state);
  const steps = Math.round(horizon / TUNING.dt);
  for (let i = 1; i <= steps; i++) {
    step(run, input);
    for (const e of run.events) {
      if (e.kind === "gore") return { in: i * TUNING.dt, part: null, bones: [], gore: true };
      if (e.kind !== "injury") continue;
      const bones = worth(e);
      if (bones) return { in: i * TUNING.dt, part: e.part, bones, gore: false };
    }
    if (run.progress.finished) break;
  }
  return null;
}

/** THE READ SPREAD OVER FRAMES: a copy of the run stepped on `per` steps a
 * frame rather than all at once, so reading ahead never costs one frame
 * its whole budget. A read that finds a blow says how far it is off the
 * run as it stands now; a read that reaches the horizon clean starts again
 * off the run as it is. */
export type Forecaster = {
  /** Read on for a frame: the blow seen coming, or null. */
  frame(state: GameState, input: SkierInput): Forecast | null;
  /** Forget the read under way (a new run, the cam put down). */
  drop(): void;
};

export function createForecaster(per = 10, horizon: number = FORECAST.horizon): Forecaster {
  let run: GameState | null = null;
  let level: GameState["level"] | null = null;
  let input: SkierInput | null = null;
  let left = 0;
  return {
    frame(state, held) {
      if (!run || level !== state.level || run.tick < state.tick) {
        run = forkRun(state);
        level = state.level;
        input = { ...held };
        left = Math.round(horizon / TUNING.dt);
      }
      for (let i = 0; i < per && left > 0; i++, left--) {
        step(run, input!);
        for (const e of run.events) {
          const bones = e.kind === "injury" ? worth(e) : null;
          if (e.kind !== "gore" && !bones) continue;
          const found: Forecast = {
            in: Math.max(0, (run.tick - state.tick) * TUNING.dt),
            part: e.kind === "injury" ? e.part : null,
            bones: bones ?? [],
            gore: e.kind === "gore",
          };
          run = null;
          return found;
        }
        if (run.progress.finished) left = 0;
      }
      if (left <= 0) run = null;
      return null;
    },
    drop() {
      run = null;
    },
  };
}
