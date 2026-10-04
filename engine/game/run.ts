// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE SKIER'S STEP — the lift that carries him, if any (`lift-ride.ts`),
// the wind tunnel he rides (`wind-tunnel.ts`),
// the skier (and, on a tricks run, the strokes thrown in
// the air, `strokes.ts`), the trees and the edge, the wipeout (or his own
// tumble once he is thrown, `crash.ts` — or what he nearly fell to and
// rode out), the damage it cost (`damage.ts`) and what his body took
// (`body.ts`),
// the air record, the clock and the odometer, the buzzer
// (`RunRules.limit`), the course (when the rules count one — a free ride
// does not, and notes the runs it skies instead) and the automatic reset, in that order, for ONE run: the
// player's, or one of the rivals' (`rivals.ts`), which is a run of its own
// over the same map. The field is stepped by this same function — a rival
// that skied a different step would be a rival in a different game.
//
// The phase gates everything else: under the lights (`countdown`) the
// skier stands in the gate with the skis held across the slope and nothing
// is steered, and a finished run coasts with the controls let go.

import { TUNING } from "./defs/tuning.ts";
import { collideTrees, keepInBounds } from "./collision.ts";
import { outRun, resetSkier, stepCourse } from "./course.ts";
import { derive, stepSkier } from "./skier.ts";
import { crashOver, noteSave, quietClocks, stepThrown, throwRider, wipeoutCause } from "./crash.ts";
import { takeDamage } from "./damage.ts";
import { stepBody } from "./body.ts";
import { poseInput, stepStrokes } from "./strokes.ts";
import { leadInput, stepLift } from "./lift-ride.ts";
import { stepTunnel } from "./wind-tunnel.ts";
import { stepGatePoles } from "./gate-poles.ts";
import { noteSkied } from "./skied.ts";
import { heldInHouse, stepStartPush } from "./start-push.ts";
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
export function stepRun(run: GameState, given: SkierInput, events: GameEvent[]): void {
  const racing = run.phase === "racing";
  // THE LIFT (`lift-ride.ts`): while one carries him the step is its own;
  // stood off the free ride's lift, he is led until he takes the controls.
  if (stepLift(run, given, events)) return;
  const input = leadInput(run, given, events);
  if (input.reset && racing) {
    standUp(run, events, false);
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
  // THE WIND TUNNEL (`wind-tunnel.ts`): taken in, carried, or let go.
  stepTunnel(run, events);
  // HELD IN THE START HOUSE after GO, and thrown out of it (`start-push.ts`).
  const housed = heldInHouse(run);
  stepStartPush(run, input);
  stepSkier(run, tricks ? poseInput(run, held) : held, events);
  // IN THE GATE: under the lights his poles are planted over the wand and
  // hold him where he stands, however steep the pitch below the hut — only
  // his legs settle.
  if ((run.phase === "countdown" || (housed && c.launch < 0)) && !off) {
    c.x = x0;
    c.z = z0;
    c.vx = 0;
    c.vz = 0;
    derive(c, run.level);
  }
  // THE STROKES (`strokes.ts`), on a skier whose flight is now current.
  if (tricks) stepStrokes(run, input);
  collideTrees(run, events);
  // THE FLEX POLES (`gate-poles.ts`): knocked over, standing back up.
  stepGatePoles(run, events, off !== null);
  keepInBounds(run);
  if (off) {
    stepThrown(run, off);
    quietClocks(c);
  } else {
    const cause = wipeoutCause(run, events, speed0);
    if (cause) throwRider(run, cause, v0, events);
    else noteSave(run, events);
  }
  takeDamage(run, events);
  // THE BODY (`body.ts`): what the blows of this step did to him.
  stepBody(run, events, off);
  // THE RUN'S AIR RECORD, off the landing the skier has just reported.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "land" && e.airTime > run.progress.bestAir) run.progress.bestAir = e.airTime;
  }
  if (!racing) return;
  const p = run.progress;
  if (p.finished) return;
  // On an interval start the clock waits for the wand.
  if (p.started || run.rules.start !== "interval") p.time += TUNING.dt;
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
    if (crashOver(off)) standUp(run, events, true);
    return;
  }
  if (run.rules.course) stepCourse(run, x0, z0, events);
  // A FREE RIDE remembers the runs it skies instead (`skied.ts`).
  else noteSkied(run);
  if (p.finished) return;
  const R = TUNING.reset;
  // Bogged, the skier is given the time to work out (`trench.ts`).
  const stuck = c.trench > 0 ? c.trenchFor >= TUNING.trench.holdFor : c.stuckFor >= R.stuckFor;
  if (c.overFor >= R.overFor || stuck) standUp(run, events, true);
}

/** THE RESET — or, under the strict gates (R31), where nobody is stood
 * back on the course, the end of the run: a racer stopped is out. */
function standUp(run: GameState, events: GameEvent[], auto: boolean): void {
  if (run.rules.gates === "strict" && run.rules.course && !run.progress.finished) {
    outRun(run, events, { status: "dnf", why: "fall", gate: run.progress.nextCheckpoint });
    return;
  }
  resetSkier(run, events, auto);
}
