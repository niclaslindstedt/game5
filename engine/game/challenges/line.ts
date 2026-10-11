// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TIMED LINE — a run of the ski area between two FLAG GATES, against
// the clock. The clock starts as the skier crosses the start gate going
// down the run and stops at the finish; a fall, a reset, a lift, a machine,
// straying from the run's corridor or stalling throws the attempt away, and
// crossing the start gate again starts it afresh.
//
// DEALT on the runs of every colour the ski area has — a green, a blue, a
// red, a black and an orange ski route where it has them, then any others —
// one line a run, its start gate clear of the lift's pad below the last
// summit ramp's join, its finish some hundreds of metres to a kilometre and
// a half down, and downhill all the way. Its medals are shares of the
// line's PAR (`par.ts`), measured against the bot.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Level } from "../../mapgen/types.ts";
import { CHALLENGES } from "../defs/challenges.ts";
import type { GameState } from "../state.ts";
import {
  dealtRuns,
  gateCrossing,
  gateOn,
  onOwnSkis,
  onRun,
  trackPrev,
  type DealtRun,
} from "./common.ts";
import { linePar } from "./par.ts";
import {
  medalOf,
  type ChallengeBase,
  type ChallengeEvent,
  type ChallengeGate,
  type ChallengeKind,
  type ChallengeWatch,
  type LiveLine,
  type VoidCause,
} from "./types.ts";

const L = CHALLENGES.line;
const M = CHALLENGES.medals;

/** A TIMED LINE: the run it is on and that run's colour, its two gates,
 * its length and drop, m, and its par, s. */
export interface LineChallenge extends ChallengeBase {
  kind: "line";
  run: string;
  grade: DealtRun["grade"];
  start: ChallengeGate;
  finish: ChallengeGate;
  length: number;
  drop: number;
  par: number;
}

export function isLine(c: ChallengeBase): c is LineChallenge {
  return c.kind === "line";
}

/** The colours a map's lines are dealt across first, in order. */
const COLOURS = ["green", "blue", "red", "black", "orange"] as const;

/** The stretch of `run` a line may lie on: from where its start gate
 * stands to the last arc its finish may — null on a run too short. */
function roomOn(run: DealtRun): { from: number; most: number } | null {
  const from = Math.max(L.fromHead, run.ramp + L.fromRamp);
  const most = Math.min(from + L.longest, run.track.length - L.beforeEnd);
  return most - from >= L.shortest ? { from, most } : null;
}

function dealLines(level: Level, rng: Rng): LineChallenge[] {
  const runs = dealtRuns(level).filter((r) => roomOn(r) !== null);
  const want = Math.min(runs.length, clamp(Math.round(runs.length / L.perRuns), L.least, L.most));
  // A run of every colour there is first, then the rest at random.
  const order: DealtRun[] = [];
  for (const colour of COLOURS) {
    const of = runs.filter((r) => r.grade === colour);
    if (of.length > 0) order.push(rng.pick(of));
  }
  const rest = runs.filter((r) => !order.includes(r));
  while (rest.length > 0) order.push(rest.splice(Math.floor(rng.next() * rest.length), 1)[0]);
  const out: LineChallenge[] = [];
  for (const run of order) {
    if (out.length >= want) break;
    const line = lineOn(level, run, rng.range(L.want[0], L.want[1]));
    if (line) out.push(line);
  }
  return out;
}

/** The line down `run` about `length` m long, or null where no stretch of
 * it drops enough to be one. */
function lineOn(level: Level, run: DealtRun, length: number): LineChallenge | null {
  const room = roomOn(run);
  if (!room) return null;
  const start = gateOn(run, room.from);
  for (const ask of [length, room.most - room.from]) {
    const to = Math.min(room.most, room.from + Math.max(L.shortest, ask));
    const finish = gateOn(run, to);
    const long = to - room.from;
    const drop = start.y - finish.y;
    if (drop < Math.max(L.drop, L.dropPer * long)) continue;
    const par = linePar(level, run, room.from, to);
    const round = (v: number) => Math.round(v * 10) / 10;
    return {
      id: `line:${run.id}:1`,
      kind: "line",
      run: run.id,
      grade: run.grade,
      start,
      finish,
      length: long,
      drop,
      par,
      medals: {
        gold: round(par * M.gold),
        silver: round(par * M.silver),
        bronze: round(par * M.bronze),
      },
      better: "lower",
      unit: "s",
    };
  }
  return null;
}

/** An attempt under way: when its clock started, s, whether it is past
 * half way, and how far down the line it is, 0..1. */
type Attempt = { from: number; split: boolean; share: number };

function watchLines(level: Level, lines: readonly LineChallenge[]): ChallengeWatch {
  const runs = new Map(dealtRuns(level).map((r) => [r.id, r]));
  const running = new Map<LineChallenge, Attempt>();
  let latest: LineChallenge | null = null;
  let now = 0;
  const prev = trackPrev();
  const drop = (c: LineChallenge, why: VoidCause, t: number, out: ChallengeEvent[]) => {
    running.delete(c);
    out.push({ kind: "void", id: c.id, t, why });
  };
  return {
    step(state: GameState, out: ChallengeEvent[]) {
      const k = state.skier;
      const t = state.t;
      now = t;
      const was = prev.step(state, L.jump);
      if (was === null) {
        for (const c of [...running.keys()]) drop(c, "moved", t, out);
        return;
      }
      // What throws every attempt away this step.
      let why: VoidCause | null = null;
      if (state.events.some((e) => e.kind === "reset")) why = "reset";
      else if (!onOwnSkis(state)) why = k.thrown ? "fall" : k.lift ? "lift" : "machine";
      if (why) for (const c of [...running.keys()]) drop(c, why, t, out);
      for (const [c, a] of [...running]) {
        const run = runs.get(c.run);
        const at = run ? onRun(run, k.x, k.z, c.start.width + L.corridor * 2) : null;
        const elapsed = t - a.from;
        if (at === null || at.out > L.corridor) {
          drop(c, "off", t, out);
          continue;
        }
        if (elapsed > c.medals.bronze * L.stall) {
          drop(c, "slow", t, out);
          continue;
        }
        a.share = clamp((at.s - c.start.s) / (c.finish.s - c.start.s), 0, 1);
        if (!a.split && a.share >= 0.5) {
          a.split = true;
          out.push({ kind: "split", id: c.id, t, value: elapsed });
        }
        const f = gateCrossing(c.finish, was.x, was.z, k.x, k.z);
        if (f >= 0) {
          const time = was.t + (t - was.t) * f - a.from;
          running.delete(c);
          out.push({ kind: "done", id: c.id, t, value: time, medal: medalOf(c, time) });
        }
      }
      if (why) return;
      for (const c of lines) {
        const f = gateCrossing(c.start, was.x, was.z, k.x, k.z);
        if (f < 0) continue;
        running.set(c, { from: was.t + (t - was.t) * f, split: false, share: 0 });
        latest = c;
        out.push({ kind: "start", id: c.id, t });
      }
    },
    live(): LiveLine | null {
      const c = latest && running.has(latest) ? latest : ([...running.keys()].pop() ?? null);
      if (!c) return null;
      const a = running.get(c)!;
      return {
        id: c.id,
        run: c.run,
        elapsed: now - a.from,
        share: a.share,
        medals: c.medals,
      };
    },
  };
}

export const LINE_KIND: ChallengeKind<LineChallenge> = {
  id: "line",
  deal: dealLines,
  watch: (level, dealt) => watchLines(level, dealt),
};
