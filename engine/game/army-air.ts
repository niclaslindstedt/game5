// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S PARAMOTORS AND BALLOONS ON A HUNT — the call and the step
// over `army-para.ts` (the riflemen on paramotors) and `army-balloon.ts`
// (the rocketeers under balloons).
//
// THE CALL. The roster names how many of each the stars he carries send
// (`rosterOf(stars).paramotors`, `.balloons`, `.rocketeers`); on top of
// that, one more of each for every `ARMY_AIR.grow.every` s he has held the
// star, to the escalation's cap — the longer he survives, the more of the
// sky is theirs. Neither is flown in a wind past its own limit
// (`para.most`, `balloon.most`): on a stormy day the roster's paramotors
// and balloons stay on the ground. More out than asked: the extras turn
// for home.
//
// THE PURSUERS. Every paramotor flying and every balloon in the air is
// written into `WantedState.pursuers` (`paramotor`, `balloon`), so the
// wanted level's sight test sees through their eyes.
//
// `ArmyState.air` is absent until the roster first asks for one, and
// nothing here draws from any stream, so no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { ARMY_AIR } from "./defs/army-air.ts";
import { TUNING } from "./defs/tuning.ts";
import {
  downBalloon,
  freshArmyBalloon,
  huntBalloon,
  launchBalloon,
  leaveBalloon,
} from "./army-balloon.ts";
import { fallPara, freshPara, huntPara, launchPara, leavePara, meetPara } from "./army-para.ts";
import { freshAirState } from "./army-air-state.ts";
import { quarryOf, rosterOf } from "./wanted.ts";
import { windAt, type Wind } from "./wind.ts";
import type { ArmyAirState, ArmyBalloon, ArmyPara } from "./army-air-state.ts";
import type { ArmyState } from "./army-state.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { WantedState } from "./wanted-state.ts";

const dt = TUNING.dt;
const K = ARMY_AIR;
const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** HOW MANY OF EACH a hunt at the stars he carries asks for now: the
 * roster's, and one more for every `grow.every` s at the star, to the cap
 * — none of a kind whose wind limit the day's wind is past. */
export function airWanted(
  state: GameState,
  w: WantedState,
): { paramotors: number; balloons: number; rocketeers: number } {
  const on = w.ended === null && w.stars > 0;
  const r = rosterOf(on ? w.stars : 0);
  if (!on || (r.paramotors === 0 && r.balloons === 0))
    return { paramotors: 0, balloons: 0, rocketeers: 0 };
  const at = w.reached[w.stars];
  const more = Number.isFinite(at) ? Math.floor(Math.max(0, state.t - at) / K.grow.every) : 0;
  windAt(state.level, state.t, wind);
  const paramotors =
    r.paramotors > 0 && wind.speed <= K.para.most
      ? Math.min(K.grow.paramotors, r.paramotors + more)
      : 0;
  const balloons =
    r.balloons > 0 && wind.speed <= K.balloon.most
      ? Math.min(K.grow.balloons, r.balloons + more)
      : 0;
  return { paramotors, balloons, rocketeers: r.rocketeers };
}

/** The bearing from the map's middle the army's air comes in on: toward
 * where he is, spread either side by id. */
function bearingFor(state: GameState, id: number): number {
  const q = quarryOf(state);
  const half = state.level.size / 2;
  const base = Math.atan2(q.x - half, q.z - half);
  const k = id % 4;
  return base + (k === 0 ? 0 : k === 1 ? 0.5 : k === 2 ? -0.5 : 0.9);
}

/** CALL what is asked for, send home what is not. */
function call(
  state: GameState,
  air: ArmyAirState,
  want: { paramotors: number; balloons: number; rocketeers: number },
  events: GameEvent[],
): void {
  let live = 0;
  let last = -Infinity;
  for (const p of air.paras) {
    if (p.mode !== "due" && p.mode !== "fly") continue;
    if (live >= want.paramotors) {
      if (p.mode === "due") p.mode = "gone";
      else p.mode = "leave";
      continue;
    }
    live++;
    if (p.mode === "due") last = Math.max(last, p.due);
  }
  while (live < want.paramotors) {
    const id = air.nextPara++;
    const due = Math.max(state.t + K.para.respond, last + K.para.stagger);
    last = due;
    air.paras.push(freshPara(id, due, bearingFor(state, id)));
    air.parasCalled++;
    live++;
    events.push({
      kind: "army-air",
      t: state.t,
      change: "called",
      craft: "paramotor",
      id,
      x: 0,
      y: 0,
      z: 0,
    });
  }
  live = 0;
  last = -Infinity;
  for (const m of air.balloons) {
    if (m.mode !== "due" && m.mode !== "fly") continue;
    if (live >= want.balloons) {
      if (m.mode === "due") m.mode = "gone";
      else m.mode = "leave";
      continue;
    }
    live++;
    if (m.mode === "due") last = Math.max(last, m.due);
  }
  const each =
    want.balloons > 0 ? Math.max(1, Math.round(want.rocketeers / Math.max(1, want.balloons))) : 1;
  while (live < want.balloons) {
    const id = air.nextBalloon++;
    const due = Math.max(state.t + K.balloon.respond, last + K.balloon.stagger);
    last = due;
    air.balloons.push(freshArmyBalloon(state, id, due, Math.min(3, each)));
    air.balloonsCalled++;
    live++;
    events.push({
      kind: "army-air",
      t: state.t,
      change: "called",
      craft: "balloon",
      id,
      x: 0,
      y: 0,
      z: 0,
    });
  }
}

/** THE ARMY'S AIR'S STEP, on a hunted run: the call, every paramotor and
 * balloon flown and fought, the pursuers written. After the vehicles,
 * before the gunfire. */
export function stepArmyAir(state: GameState, events: GameEvent[]): void {
  const w = state.wanted;
  const a = state.army;
  if (!w || !a || a.home) return;
  const want = airWanted(state, w);
  if (!a.air) {
    if (want.paramotors === 0 && want.balloons === 0) return;
    a.air = freshAirState();
  }
  const air = a.air;
  const on = w.ended === null && w.stars > 0;
  call(state, air, want, events);
  for (const p of air.paras) stepOnePara(state, air, p, w, on, events);
  for (const m of air.balloons) stepOneBalloon(state, air, m, w, on, events);
  air.paras = air.paras.filter((p) => p.mode !== "gone");
  air.balloons = air.balloons.filter((m) => m.mode !== "gone");
  writeAir(a, w);
}

function stepOnePara(
  state: GameState,
  air: ArmyAirState,
  p: ArmyPara,
  w: WantedState,
  on: boolean,
  events: GameEvent[],
): void {
  p.t += dt;
  switch (p.mode) {
    case "due":
      if (!on) p.mode = "gone";
      else if (state.t >= p.due) launchPara(state, p, events);
      break;
    case "fly":
      if (!on) {
        p.mode = "leave";
        p.t = 0;
        break;
      }
      huntPara(state, air, p, w, events);
      meetPara(state, air, p, events);
      break;
    case "leave":
      leavePara(state, p, events);
      if (p.mode === "leave") meetPara(state, air, p, events);
      break;
    case "fall":
    case "down":
      fallPara(state, p, events);
      break;
    default:
      break;
  }
}

function stepOneBalloon(
  state: GameState,
  air: ArmyAirState,
  m: ArmyBalloon,
  w: WantedState,
  on: boolean,
  events: GameEvent[],
): void {
  m.t += dt;
  switch (m.mode) {
    case "due":
      if (!on) m.mode = "gone";
      else if (state.t >= m.due) launchBalloon(state, m, events);
      break;
    case "fly":
      if (!on) {
        m.mode = "leave";
        m.t = 0;
        break;
      }
      huntBalloon(state, air, m, w, events);
      break;
    case "leave":
      leaveBalloon(state, air, m, events);
      break;
    case "down":
      downBalloon(state, m, events);
      break;
    default:
      break;
  }
}

/** WRITE THE ARMY'S AIR into the wanted level's pursuers. */
function writeAir(a: ArmyState, w: WantedState): void {
  const lo = K.ids.pursuer;
  const kept = w.pursuers.filter((p) => p.id < lo || p.id >= lo + 1000);
  const air = a.air;
  if (air) {
    for (const p of air.paras) {
      if (p.mode !== "fly") continue;
      kept.push({ id: lo + (p.id % 500), kind: "paramotor", x: p.x, y: p.y + 0.6, z: p.z });
    }
    for (const m of air.balloons) {
      if (m.mode !== "fly") continue;
      const b = m.body;
      kept.push({ id: lo + 500 + (m.id % 500), kind: "balloon", x: b.x, y: b.y + 1.6, z: b.z });
    }
  }
  w.pursuers = kept;
}

/** The army's paramotors on the map (flying, falling or down), for the
 * drawing, the ear and the labs. */
export function armyParas(state: GameState): readonly ArmyPara[] {
  return state.army?.air?.paras.filter((p) => p.mode !== "due") ?? [];
}

/** The army's balloons on the map, for the drawing, the ear and the labs. */
export function armyBalloons(state: GameState): readonly ArmyBalloon[] {
  return state.army?.air?.balloons.filter((m) => m.mode !== "due") ?? [];
}

/** The nearest of the army's paramotors and balloons to (x, z), m — what a
 * lab or a lens frames. */
export function nearestAir(state: GameState, x: number, z: number): number {
  let best = Infinity;
  for (const p of armyParas(state)) best = Math.min(best, hypot(p.x - x, p.z - z));
  for (const m of armyBalloons(state)) best = Math.min(best, hypot(m.body.x - x, m.body.z - z));
  return best;
}
