// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THINGS THAT GO WRONG ON THEIR OWN — the free ride's dealt mishaps
// (`defs/mishaps.ts`): whether an occasion is dealt one, and the draws that
// shape it. A stream of its own off the run's seed and the app's salt
// (`MISHAP_SALT`), never `state.rng`, and absent unless the player asked
// for mishaps — so no race, no lab and no digest can see it.

import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { MISHAPS, type MishapRate } from "./defs/mishaps.ts";
import type { GameState } from "./state.ts";

// The numbers, read through here by the engine's public surface.
export * from "./defs/mishaps.ts";

/** The stream's salt off the run's seed — no other stream shares it. */
const MISHAP_SALT = 0x2f8c4d71;

/** What a free ride asks of its mishaps: how often, and the app's salt
 * (a fresh draw a ride, so a ride started again is dealt afresh — the run
 * itself replays from it). */
export type MishapAsk = { rate: MishapRate; salt: number };

/** The run's mishaps: how often, and the stream they are dealt off. */
export type MishapState = { rate: MishapRate; rng: Rng };

export function freshMishaps(seed: number, ask: MishapAsk): MishapState {
  return { rate: ask.rate, rng: createRng((seed ^ MISHAP_SALT ^ ask.salt) >>> 0) };
}

/** An occasion of `kind`: its stream when the run deals it a mishap, else
 * null (no mishaps asked, or the odds said no). One draw a call. */
export function mishapOf(state: GameState, kind: keyof (typeof MISHAPS.odds)["rare"]): Rng | null {
  const m = state.mishaps;
  if (!m) return null;
  return m.rng.next() < MISHAPS.odds[m.rate][kind] ? m.rng : null;
}

/** A draw off the run's mishap stream, 0..1 — 1 (never under any odds)
 * with no mishaps asked. */
export function mishapDraw(state: GameState): number {
  return state.mishaps ? state.mishaps.rng.next() : 1;
}

/** LINE TWISTS coming out: `twist` rad (signed) unwound one step of `dt` s
 * — on their own, or `kicked` — toward naught, never past it. */
export function unwound(twist: number, kicked: boolean, dt: number): number {
  const T = MISHAPS.twist;
  const step = (kicked ? T.kick : T.unwind) * dt;
  return Math.abs(twist) <= step ? 0 : twist - Math.sign(twist) * step;
}

/** The turn a twisted canopy makes on its own, a share of a full toggle,
 * signed as its twist. */
export function twistTurn(twist: number): number {
  const T = MISHAPS.twist;
  return Math.sign(twist) * T.turn * Math.min(1, Math.abs(twist) / (T.full * 2 * Math.PI));
}

/** AN ENGINE DEALT ITS STOPPAGE (`HeliState.engine`, `PlaneState.engine`):
 * the seconds aloft left before it goes, the seconds it coughs first, and
 * whether it has stopped. */
export type EngineFault = { due: number; cough: number; out: boolean };

/** The fault a lift-off of `kind` is dealt, or null. */
export function engineFaultOf(state: GameState, kind: "plane" | "heli"): EngineFault | null {
  const rng = mishapOf(state, kind);
  if (!rng) return null;
  const E = MISHAPS.engine[kind];
  return { due: rng.range(E.after[0], E.after[1]), cough: E.cough, out: false };
}

/** ONE STEP OF A DEALT FAULT, `aloft` and `agl` m over the snow: the clock
 * run down while it flies high enough, then the cough, then the stop.
 * What happened this step: the cough begun, the engine stopped, or
 * nothing. */
export function stepFault(
  f: EngineFault,
  aloft: boolean,
  agl: number,
  kind: "plane" | "heli",
  dt: number,
): "cough" | "out" | null {
  if (f.out) return null;
  if (f.due > 0) {
    if (!aloft) return null;
    f.due -= dt;
    if (f.due > 0 || agl < MISHAPS.engine[kind].agl) {
      f.due = Math.max(f.due, 1e-6);
      return null;
    }
    f.due = 0;
    return "cough";
  }
  f.cough -= dt;
  if (f.cough > 0) return null;
  f.out = true;
  return "out";
}

/** How much of its power a coughing engine gives at clock `t`, 0..1 — the
 * surges and dips of a fuel-starved turbine, a pure function of the clock. */
export function coughOf(t: number): number {
  const a = Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1.1);
  return Math.min(1, Math.max(0.05, 0.55 + 0.6 * a));
}
