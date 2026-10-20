// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RUN INTO A PERSON — the player meeting an amateur of the crowd
// (`crowd.ts`' `clipCrowd`) past `PERSON_HIT.strike`: no longer a shoulder
// but two bodies of their real masses colliding, flesh on flesh (next to
// no bounce), the same impulse through both — the wildlife's hit
// (`beast-hit.ts`) retyped for a man:
//   - THE AMATEUR takes his share of the exchange as a change of speed and
//     is thrown on it (`crowd-down.ts`). On a run that carries its
//     injuries (`GameState.gore`) he is INJURED past `injure` — down for
//     good, alive, to be collected — and KILLED past `kill`, CRUSHED 0..1
//     on to `crush`; on a safe run he is only knocked down and gets up;
//   - THE PLAYER keeps what the exchange left him: thrown (the `skier`
//     crash cause) with it past the crowd's own threshold, and his body is
//     struck a step later (`body-person.ts`) on every part the other body
//     stood at the height of, stopped by its give — soft to a slow blow,
//     crushed through by a fast one — through `body.ts`' hands, so the
//     ladders and the wounds (`gore.ts`) do the rest.
// Every meeting is filed on the crowd (`CrowdState.struck`) and reported
// (`StruckEvent`); `casualtiesOf` lists every body on the snow that needs
// collecting, for the rescue and the police to come for. A free ride only
// (no other run has a crowd), and nothing here draws from any stream. The
// people ON FOOT — the civilians and the rescue's and the police's crews —
// are the same two bodies colliding (`foot.ts`, through `exchangeOf`).

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { CROWD_SIZE } from "./defs/crowd.ts";
import { PERSON_HIT as K } from "./defs/person-hit.ts";
import { totalMass } from "./defs/skis.ts";
import type { Amateur } from "./crowd-state.ts";
import type { CrashCause, GameEvent, GameState } from "./state.ts";
import type { FootDown } from "./foot.ts";

/** ONE PERSON STRUCK: the amateur (`Amateur.id`), the run time, the spot
 * the two met (between them, at the height of a body's middle), the
 * closing speed, m/s, the change of speed it made in the player
 * (`taken`) and in him (`given`), m/s, his height, m, whether it threw the
 * player, whether the amateur was killed or injured and how crushed, 0..1
 * — and whether the player's body has been struck by it yet. A person on
 * foot (`foot.ts`) is `amateur` −1 and carries his `foot` key and `who`
 * he is, and — when it was not the player on his skis or his snowmobile —
 * what struck him (`by`: the player's body thrown, a piste machine, a car)
 * and whether the player had nothing to do with it (`away`: a machine he
 * was not driving, heard from where it happened and never felt). */
export type StruckPerson = {
  amateur: number;
  foot?: number;
  who?: FootDown["who"];
  by?: "thrown" | "groomer" | "car";
  away?: true;
  t: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  taken: number;
  given: number;
  height: number;
  thrown: boolean;
  killed: boolean;
  injured: boolean;
  crush: number;
  dosed: boolean;
};

/** A person struck, as the app hears it (`StruckPerson` less the body's
 * own bookkeeping). */
export type StruckEvent = { kind: "struck" } & Omit<StruckPerson, "dosed">;

/** THE EXCHANGE between the player's `mp` kg and a person's `ma` kg
 * closing at `closing` m/s, flesh on flesh: the change of speed it makes
 * in each, m/s, and what it does to the person on a run that carries its
 * injuries (`GameState.gore`) — killed, injured, how crushed 0..1. */
export function exchangeOf(
  state: GameState,
  mp: number,
  ma: number,
  closing: number,
): { taken: number; given: number; killed: boolean; injured: boolean; crush: number } {
  const j = ((1 + K.restitution) * closing) / (1 / mp + 1 / ma);
  const taken = j / mp;
  const given = j / ma;
  const injuries = state.gore !== undefined;
  const killed = injuries && given >= K.kill;
  const injured = injuries && !killed && given >= K.injure;
  const crush = injuries ? Math.min(1, Math.max(0, (given - K.kill) / (K.crush - K.kill))) : 0;
  return { taken, given, killed, injured, crush };
}

/** THE COLLISION itself, once `clipCrowd` has found the two closing at
 * `closing` m/s along (`nx`, `nz`) — from the player to the amateur — and
 * judged whether it `throws` the player: the exchange, the amateur's
 * outcome on him (`dead`, `injured`, `crush`), the meeting filed and the
 * event. Returns the player's velocity after it (set on him when it does
 * not throw him) and the amateur's, to be thrown with. */
export function strikePerson(
  state: GameState,
  events: GameEvent[],
  a: Amateur,
  nx: number,
  nz: number,
  closing: number,
  throws: boolean,
): { player: Vec3; amateur: Vec3 } {
  const c = state.skier;
  const ma = CROWD_SIZE[a.body].mass;
  const { taken, given, killed, injured, crush } = exchangeOf(
    state,
    totalMass(c.spec),
    ma,
    closing,
  );
  if (killed) a.dead = true;
  if (injured) a.injured = true;
  if (crush > 0) a.crush = crush;
  const height = K.height[a.body];
  const feet = c.y - c.spec.cogHeight;
  const said: Omit<StruckPerson, "dosed"> = {
    amateur: a.id,
    t: state.t,
    x: (c.x + a.x) / 2,
    y: feet + height * 0.55,
    z: (c.z + a.z) / 2,
    speed: closing,
    taken,
    given,
    height,
    thrown: throws,
    killed,
    injured,
    crush,
  };
  const crowd = state.crowd!;
  (crowd.struck ??= []).push({ ...said, dosed: false });
  events.push({ kind: "struck", ...said });
  const player = { x: c.vx - taken * nx, y: c.vy, z: c.vz - taken * nz };
  if (!throws) {
    c.vx = player.x;
    c.vz = player.z;
  }
  return {
    player,
    amateur: { x: a.vx + given * nx, y: given * K.lift, z: a.vz + given * nz },
  };
}

/** The latest meeting with amateur `id`, if any. */
export function struckPerson(state: GameState, id: number): StruckPerson | undefined {
  const all = state.crowd?.struck;
  if (!all) return undefined;
  for (let k = all.length - 1; k >= 0; k--) if (all[k].amateur === id) return all[k];
  return undefined;
}

/** A BODY ON THE SNOW THAT NEEDS COLLECTING: the player (`id` −1), an
 * amateur (his `Amateur.id`) or a person on foot (his `FootPerson.key`); where it lies — its middle, and the
 * ragdoll's points (`RAGDOLL` order, x y z each) when it is on one;
 * whether dead, how crushed, 0..1; the run time it happened (−1 not
 * known: dug out of an avalanche); where the blow that did it was (null
 * when none is known); and what did it. */
export type Casualty = {
  who: "player" | "amateur" | FootDown["who"];
  id: number;
  x: number;
  y: number;
  z: number;
  points: readonly number[] | null;
  dead: boolean;
  crush: number;
  t: number;
  impact: { x: number; y: number; z: number } | null;
  cause: CrashCause | "avalanche" | null;
};

/** EVERY BODY THAT NEEDS COLLECTING, now: each amateur down for good —
 * killed, injured past getting up, fallen badly on his own
 * (`crowd-hurt.ts`), or dug out of an avalanche dead — each person on
 * foot killed or injured (`foot.ts`), and
 * the player, on a run with injuries, dead or hurt too badly to ski on.
 * Pure: a query of the state, written by nothing. */
export function casualtiesOf(state: GameState): Casualty[] {
  const out: Casualty[] = [];
  const g = state.gore;
  const c = state.skier;
  if (g && (g.dead >= 0 || g.injured >= 0)) {
    const b = c.thrown;
    out.push({
      who: "player",
      id: -1,
      x: b ? b.x : c.x,
      y: b ? b.y : c.y,
      z: b ? b.z : c.z,
      points: b ? b.points : null,
      dead: g.dead >= 0,
      crush: g.crushed >= 0 || g.middle >= 0 ? 1 : g.lost || g.open ? 0.5 : 0,
      t: b ? state.t - b.t : g.dead >= 0 ? g.dead : g.injured,
      impact: b?.from ?? null,
      cause: b?.cause ?? null,
    });
  }
  for (const a of state.crowd?.amateurs ?? []) {
    if (!a.dead && !a.injured && !a.hurt) continue;
    if (a.buried !== undefined) continue;
    const hit = struckPerson(state, a.id);
    const b = a.thrown;
    out.push({
      who: "amateur",
      id: a.id,
      x: b ? b.x : a.x,
      y: b ? b.y : a.y,
      z: b ? b.z : a.z,
      points: b ? b.points : null,
      dead: !!a.dead,
      crush: a.crush ?? 0,
      t: hit ? hit.t : -1,
      impact: hit ? { x: hit.x, y: hit.y, z: hit.z } : null,
      cause: hit ? "skier" : a.hurt ? (a.thrown?.cause ?? null) : "avalanche",
    });
  }
  for (const d of state.foot?.down ?? []) {
    if (!d.dead && !d.injured) continue;
    const b = d.thrown;
    out.push({
      who: d.who,
      id: d.key,
      x: b.x,
      y: b.y,
      z: b.z,
      points: b.points,
      dead: d.dead,
      crush: d.crush,
      t: d.hit.t,
      impact: { x: d.hit.x, y: d.hit.y, z: d.hit.z },
      cause: d.cause,
    });
  }
  return out;
}

/** How far a casualty lies from where it was struck, m (0 unknown). */
export function thrownFar(k: Casualty): number {
  return k.impact ? hypot(k.x - k.impact.x, k.z - k.impact.z) : 0;
}
