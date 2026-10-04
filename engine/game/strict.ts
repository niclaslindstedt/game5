// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STRICT GATES — the international rules a slalom is judged by (R31),
// on a run whose rules ask for them (`RunRules.gates`).
//
// A POLE GATE IS PASSED when both feet cross its gate line between its
// poles: the line from the turning pole to the outside pole of an open
// gate, from the top pole to the foot pole of a closed one. The feet are
// the skis' middle stations (`SkierState.contacts`), read on the step his
// body crosses the line — a racer's body may lean over the pole, his feet
// may not pass it. Both feet on the wrong side is a gate MISSED; one either
// side, the pole between the skis, a STRADDLE. Either disqualifies at
// once: a racer may no longer climb back to a gate. So does skipping a
// gate — crossing the next one's line while this one is still owed.
//
// THE START: the run clock waits for the wand (the start gate), and a
// racer not through it within `RunRules.window` seconds of GO is
// disqualified. THE FINISH is the line, crossed with no gate owed — which
// under these rules is the only way to reach it.
//
// A FALL that stops him is a DID NOT FINISH (`run.ts`): under these rules
// nobody is stood back on the course.

import { TUNING } from "./defs/tuning.ts";
import { crossedCheckpoint, crossedLine, finishRun, outRun } from "./course.ts";
import type { Checkpoint } from "../mapgen/types.ts";
import type { GameEvent, GameState, RunOut } from "./state.ts";

const K = TUNING.course;

/** How far past a pole a foot may stand and still be on its right side,
 * m — the pole's own girth. */
const POLE = 0.05;
/** How far outside an open gate's outside pole a foot still counts as
 * through it, m: the outside pole is the generous end. */
const OUTER = 1;
/** How far beyond a gate's poles a crossing of its line is still that
 * gate's — taken past it rather than nowhere near it, m: past an open
 * gate's turning pole, past its outside pole, past a closed gate's ends. */
const REACH = { turn: 12, outside: 5, closed: 1.2 };

/** How far along a gate's line a point stands from its centre, m —
 * positive to the right of the way it is crossed. */
function lateralOf(cp: Checkpoint, x: number, z: number): number {
  const fx = Math.sin(cp.heading);
  const fz = Math.cos(cp.heading);
  return (x - cp.x) * fz - (z - cp.z) * fx;
}

/** Where a foot at `lateral` stands against a pole gate: `1` through it,
 * `0` on the wrong side of a pole, and how far off the gate it is. */
function footIn(cp: Checkpoint, lateral: number): boolean {
  const half = cp.width / 2;
  if (cp.pole === "closed") return Math.abs(lateral) <= half + POLE;
  // From the turning pole toward the outside pole.
  const turn = cp.turn ?? -1;
  const inward = (lateral - turn * half) * -turn;
  return inward >= -POLE && inward <= cp.width + OUTER;
}

/** Whether a crossing of a pole gate's line at `lateral` (the body's) is
 * that gate's to judge: through it, or taken past it near enough. */
function judged(cp: Checkpoint, lateral: number): boolean {
  const half = cp.width / 2;
  if (cp.pole === "closed") return Math.abs(lateral) <= half + REACH.closed;
  const turn = cp.turn ?? -1;
  const inward = (lateral - turn * half) * -turn;
  return inward >= -REACH.turn && inward <= cp.width + REACH.outside;
}

/** THE VERDICT at a pole gate the body has just crossed: passed, missed
 * or straddled, by where his two feet are. A station off the snow keeps
 * the place it last touched (`SkierState.contacts`) — metres back up the
 * hill once he has flown off a roller — so a foot in the air is taken
 * under the body, which is where it is. */
function verdictAt(state: GameState, cp: Checkpoint): "pass" | "missed" | "straddle" {
  const c = state.skier;
  let feet = 0;
  let through = 0;
  for (const contact of c.contacts) {
    if (contact.station !== "mid") continue;
    feet += 1;
    const x = contact.touching ? contact.x : c.x;
    const z = contact.touching ? contact.z : c.z;
    if (footIn(cp, lateralOf(cp, x, z))) through += 1;
  }
  if (feet === 0) return "pass";
  return through === feet ? "pass" : through === 0 ? "missed" : "straddle";
}

/** Out of the race at gate `gate`. */
function disqualify(state: GameState, events: GameEvent[], why: RunOut["why"], gate: number): void {
  outRun(state, events, { status: "dsq", why, gate });
}

/** Check the move the skier just made against the gate the run owes, by
 * the strict rules. */
export function stepStrict(state: GameState, x0: number, z0: number, events: GameEvent[]): void {
  const p = state.progress;
  if (p.finished) return;
  const cps = state.level.checkpoints;
  const n = cps.length;
  const c = state.skier;
  const owed = p.nextCheckpoint;
  const cp = cps[owed];
  if (!p.started) {
    if (crossedCheckpoint(cp, x0, z0, c.x, c.z, K.startGrace) !== null) {
      credit(state, events, owed);
      p.started = true;
      p.lapStart = p.time;
      p.nextCheckpoint = owed + 1;
      return;
    }
    const window = state.rules.window;
    if (window > 0 && state.t - state.rules.countdown > window) {
      disqualify(state, events, "start", 0);
    }
    return;
  }
  if (owed === n - 1) {
    if (crossedCheckpoint(cp, x0, z0, c.x, c.z) !== null) {
      credit(state, events, owed);
      finishRun(state, events);
    }
    return;
  }
  const lateral = crossedLine(cp, x0, z0, c.x, c.z);
  if (lateral !== null && (cp.pole === undefined || judged(cp, lateral))) {
    const verdict =
      cp.pole === undefined
        ? Math.abs(lateral) <= cp.width / 2 + K.grace
          ? "pass"
          : "missed"
        : verdictAt(state, cp);
    if (verdict === "pass") {
      credit(state, events, owed);
      p.nextCheckpoint = owed + 1;
    } else {
      disqualify(state, events, verdict, owed);
    }
    return;
  }
  // THE NEXT GATE TAKEN with this one still owed: this one skipped.
  const next = cps[owed + 1];
  if (next && owed + 1 < n - 1 && crossedCheckpoint(next, x0, z0, c.x, c.z, -K.grace) !== null) {
    disqualify(state, events, "missed", owed);
  }
}

/** A gate taken: the clock at it, the count, the event. */
function credit(state: GameState, events: GameEvent[], index: number): void {
  const p = state.progress;
  p.passed += 1;
  p.lastCheckpoint = index;
  p.splits[index] = p.time;
  p.lastPassedAt = p.time;
  events.push({ kind: "checkpoint", t: state.t, index, lap: p.lap, split: p.time });
}
