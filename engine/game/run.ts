// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE SKIER'S STEP — the skier (and, on a tricks run, the strokes thrown in
// the air, `strokes.ts`), the trees and the edge, the wipeout (or his own
// tumble once he is thrown, `crash.ts`), the damage it cost (`damage.ts`),
// the air record, the clock and the odometer, the buzzer
// (`RunRules.limit`), the course (when the rules count one — a free ride
// does not) and the automatic reset, in that order, for ONE run: the
// player's, or one of the rivals' (`rivals.ts`), which is a run of its own
// over the same map. The field is stepped by this same function — a rival
// that skied a different step would be a rival in a different game.
//
// The phase gates everything else: under the lights (`countdown`) the
// skier stands in the gate with the skis held across the slope and nothing
// is steered, and a finished run coasts with the controls let go.

import { TUNING } from "./defs/tuning.ts";
import { collideTrees, keepInBounds } from "./collision.ts";
import { resetSkier, stepCourse } from "./course.ts";
import { stepSkier } from "./skier.ts";
import { crashOver, quietClocks, stepThrown, throwRider, wipeoutCause } from "./crash.ts";
import { takeDamage } from "./damage.ts";
import { poseInput, stepStrokes } from "./strokes.ts";
import { NEUTRAL_INPUT, type GameEvent, type GameState, type SkierInput } from "./state.ts";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";

/** What the skier holds under the lights: the skis across the slope, and
 * nothing else. */
const HOLD: SkierInput = { ...NEUTRAL_INPUT, brake: 1 };
/** What a finished skier does: checks his speed down to a stop in the
 * arena — a skier left to himself would go on working (`poles.ts`). */
const COAST: SkierInput = { ...NEUTRAL_INPUT, brake: 0.6 };

/** Advance one skier's run by the step the world has just taken. `events`
 * is the run's own list, already cleared for this step. */
export function stepRun(run: GameState, input: SkierInput, events: GameEvent[]): void {
  const racing = run.phase === "racing";
  if (input.reset && racing) {
    resetSkier(run, events, false);
    return;
  }
  const c = run.skier;
  const x0 = c.x;
  const z0 = c.z;
  const v0 = { x: c.vx, y: c.vy, z: c.vz };
  const speed0 = c.speed;
  // THE WIPEOUT (`crash.ts`): with the skier thrown, the skis go on with
  // the controls let go, and he tumbles on his own.
  const off = c.thrown;
  const held = off ? NEUTRAL_INPUT : !racing ? (run.phase === "countdown" ? HOLD : COAST) : input;
  const tricks = run.rules.tricks && held === input;
  stepSkier(run, tricks ? poseInput(run, held) : held, events);
  // THE STROKES (`strokes.ts`), on a skier whose flight is now current.
  if (tricks) stepStrokes(run, input);
  collideTrees(run, events);
  keepInBounds(run);
  if (off) {
    stepThrown(run, off);
    quietClocks(c);
  } else {
    const cause = wipeoutCause(run, events, speed0);
    if (cause) throwRider(run, cause, v0, events);
  }
  takeDamage(run, events);
  // THE RUN'S AIR RECORD, off the landing the skier has just reported.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "land" && e.airTime > run.progress.bestAir) run.progress.bestAir = e.airTime;
  }
  if (!racing) return;
  const p = run.progress;
  if (p.finished) return;
  p.time += TUNING.dt;
  p.distance += hypot(c.x - x0, c.z - z0);
  // THE BUZZER (`RunRules.limit`): the run is over wherever it stands.
  if (run.rules.limit > 0 && p.time >= run.rules.limit) {
    p.finished = true;
    p.missed = null;
    run.phase = "finished";
    events.push({ kind: "finish", t: run.t, time: p.time, place: 1 });
    return;
  }
  if (off) {
    // A thrown skier takes no gate; he is stood back up once he has lain
    // long enough.
    if (crashOver(off)) resetSkier(run, events, true);
    return;
  }
  if (run.rules.course) stepCourse(run, x0, z0, events);
  if (p.finished) return;
  const R = TUNING.reset;
  // Bogged, the skier is given the time to work out (`trench.ts`).
  const stuck = c.trench > 0 ? c.trenchFor >= TUNING.trench.holdFor : c.stuckFor >= R.stuckFor;
  if (c.overFor >= R.overFor || stuck) resetSkier(run, events, true);
}
