// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STEER ON A SLALOM (R31), chosen the way a racer reads the next
// gates: a few ways of steering over the next moments — one edge now, then
// another — skied forward on the bot's model of a carved turn
// (`turn-model.ts`: the edge rolled at his rate and no further over than
// his body is laid, the skis turned by the carve that edge buys, the way
// turned by the snow's grip across them, the lean following the turn's
// balance), each scored by how far it strays from the course's line
// (`race-line.ts`), by the way it leaves him heading, and far more by
// reaching the gate owed on the wrong side of its turning pole; the first
// edge of the best is the one given. Pure: it reads the state and writes
// nothing.

import { angleDiff, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { slalomLineFast, trackPointAt } from "../mapgen/index.ts";
import type { TrackPoint } from "../mapgen/types.ts";
import { crashLimit } from "../game/crash.ts";
import { CRASH } from "../game/defs/crash.ts";
import { raceLineAt } from "../game/race-line.ts";
import type { GameState } from "../game/state.ts";
import {
  TURN_STEP,
  createTurnModel,
  createTurnState,
  readTurnModel,
  startTurn,
  stepTurn,
} from "./turn-model.ts";

/** What the planner is told: how many seconds ahead it skis each way of
 * steering, how far outside a turning pole the feet are planned past it,
 * m, and what a way's heading off the line's costs against its distance
 * off it (m² a rad² at the horizon's end). */
export type SlalomPlan = {
  horizon: number;
  /** ...and at least how far down the piste, m: a turn is a gate's length
   * whatever the speed, so a slow skier reads further ahead in time. */
  reach: number;
  clear: number;
  heading: number;
  /** ...and what a m/s over the speed the course allows costs at the
   * horizon's end, m² a (m/s)². */
  speed: number;
  /** ...and what a change of the steer from the one he holds costs, m²
   * for a whole lock's swing squared: a racer commits to a turn. */
  change: number;
};

/** What the planner chooses: the steer, −1..1, and the check, 0..1. */
export type SlalomChoice = { steer: number; brake: number };

/** The edges a way of steering is made of, as a share of the edge held. */
const STEERS = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
/** How far above a closed gate's foot pole the crossing of its line is
 * judged by, m. */
const CLOSED_EARLY = 0.8;
/** The line ahead is read every `LINE_STEP` m, out to `LINE_MAX` steps. */
const LINE_STEP = 0.25;
const LINE_MAX = 160;
/** A way that turns him more than `ACROSS` rad off the piste's heading is
 * one turning him across the hill and up it: it costs `ACROSS_COST` m² a
 * rad² past it and a step. */
const ACROSS = 1.1;
const ACROSS_COST = 40;
/** A way that slides his skis across their line within `CATCH_SHARE` of
 * what catches an edge stood that far over (`crash.ts`) costs
 * `CATCH_COST` m² a m/s past it and a step. */
const CATCH_SHARE = 0.8;
const CATCH_COST = 20;
/** The distance off the line is summed as if read every twentieth of a
 * second. */
const PER_SECOND = 20;

const model = createTurnModel();
const sim = createTurnState();
const start = createTurnState();
const line = new Float64Array(LINE_MAX + 1);
const options = [0, 0];
const pa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pb: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** The steer and the check for the skier in `state` at arc `s` of the
 * piste, written to `out`: the check `brake` his speed asks for weighed
 * against none (a check pivots his skis the way he steers, so it is a
 * turn as much as a brake) — or held at `brake` where `held` — against
 * the speed the course allows, `allowed` m/s. */
export function slalomSteer(
  state: GameState,
  s: number,
  brake: number,
  held: boolean,
  allowed: number,
  plan: SlalomPlan,
  out: SlalomChoice,
): void {
  const level = state.level;
  const c = state.skier;
  const here = trackPointAt(level, s, pa);
  const rx = Math.cos(here.heading);
  const rz = -Math.sin(here.heading);
  const y0 = (c.x - here.x) * rx + (c.z - here.z) * rz;
  const going = hypot(c.vx, c.vz) > 1 ? Math.atan2(c.vx, c.vz) : c.heading;
  readTurnModel(state, s, brake, model);
  // Where his edge would catch: a little inside the physics' own line.
  const catchSlip = CATCH_SHARE * crashLimit(c, "catchSlip");
  const catchEdge = CATCH_SHARE * crashLimit(c, "catchEdge");
  startTurn(state, y0, angleDiff(here.heading, going), here.heading, start);
  // The gate owed: where its turning pole stands across the piste, and on
  // which side of it his feet must pass.
  const p = state.progress;
  const gate = level.checkpoints[p.nextCheckpoint];
  let gateS = Infinity;
  let topS = Infinity;
  let pole = 0;
  let side = 0;
  if (gate?.pole === "open") {
    const g = trackPointAt(level, gate.s, pb);
    const across = (gate.x - g.x) * Math.cos(g.heading) - (gate.z - g.z) * Math.sin(g.heading);
    const turn = gate.turn ?? -1;
    pole = across + turn * (gate.width / 2);
    side = -turn;
    gateS = gate.s;
  } else if (gate?.pole === "closed") {
    // A CLOSED gate is crossed from one side of its poles' line to the
    // other between its top and its foot: judged at its foot, on the side
    // the course's line leaves it by.
    const half = gate.width / 2;
    const into = slalomLineFast(level, gate.s - half)?.offset ?? 0;
    const out = slalomLineFast(level, gate.s + half)?.offset ?? 0;
    side = Math.sign(out - into);
    gateS = gate.s + half - CLOSED_EARLY;
    // ...and not crossed above its top pole: on the side he comes in by
    // until he is past it.
    topS = gate.s - half + CLOSED_EARLY;
  }
  // The line ahead, read once: every way is scored against it where it
  // has got to down the piste.
  const horizon = Math.max(plan.horizon, plan.reach / model.speed);
  const steps = Math.max(1, Math.round(horizon / TURN_STEP));
  const dt = horizon / steps;
  const reach = Math.min(LINE_MAX, Math.ceil((model.speed * horizon * 1.2) / LINE_STEP) + 2);
  for (let j = 0; j <= reach; j++) line[j] = raceLineAt(level, s + j * LINE_STEP)?.offset ?? 0;
  const lineAt = (u: number): number => {
    const f = Math.min(reach, Math.max(0, u / LINE_STEP));
    const j = Math.min(reach - 1, Math.floor(f));
    return line[j] + (line[j + 1] - line[j]) * (f - j);
  };
  const switchAt = Math.round(steps * 0.4);
  let best = 0;
  let bestBrake = brake;
  let bestCost = Infinity;
  // The check asked for, weighed against none.
  options[0] = brake;
  options[1] = 0;
  const checks = held || brake <= 0 ? 1 : 2;
  for (let k = 0; k < checks; k++) {
    model.brake = options[k];
    for (const first of STEERS) {
      for (const then of STEERS) {
        Object.assign(sim, start);
        let cost = plan.change * (first - c.steer) ** 2;
        let judged = false;
        let topped = false;
        for (let i = 0; i < steps; i++) {
          stepTurn(model, sim, (i < switchAt ? first : then) * model.held, dt);
          const off = sim.y - lineAt(sim.u);
          cost += off * off * dt * PER_SECOND;
          // ...and an edge stood well over on skis sliding fast across their
          // line is one about to catch (`crash.ts`'s high-side).
          const slide = sim.v * Math.abs(Math.sin(sim.slip)) - catchSlip;
          if (slide > 0 && Math.abs(sim.edge) > catchEdge && sim.skid < CRASH.catchSkid)
            cost += CATCH_COST * slide * dt * PER_SECOND;
          const over = Math.abs(sim.psi) - ACROSS;
          if (over > 0) cost += ACROSS_COST * over * over * dt * PER_SECOND;
          if (!topped && s + sim.u >= topS) {
            topped = true;
            const clear = (pole - sim.y) * side;
            if (clear < 0) cost += 400 * clear * clear + 40;
          }
          if (!judged && s + sim.u >= gateS) {
            judged = true;
            const clear = (sim.y - pole) * side - plan.clear;
            if (clear < 0) cost += 400 * clear * clear + 40;
          }
          if (cost >= bestCost) break;
        }
        // ...and the way it leaves him going against the line's own.
        const lead = Math.atan2(lineAt(sim.u + 1) - lineAt(sim.u - 1), 2);
        const turned = sim.psi - lead;
        cost += plan.heading * turned * turned;
        const fast = sim.v - allowed;
        if (fast > 0) cost += plan.speed * fast * fast;
        if (cost < bestCost) {
          bestCost = cost;
          best = first;
          bestBrake = model.brake;
        }
      }
    }
  }
  out.steer = best;
  out.brake = bestBrake;
}
