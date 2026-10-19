// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PERSON RUN INTO, staged (`engine/game/person-hit.ts`): the player on a
// free ride of seed 3 driven at a closing speed into one amateur stood
// still in front of him, everyone else up a lift — the meeting
// `tests/body_hits_test.ts` holds and `make body-hits` prints a row of.

import {
  casualtiesOf,
  clipCrowd,
  createGame,
  feelBumps,
  markFall,
  severityOf,
  NEUTRAL_INPUT,
  step,
  type Amateur,
  type CrowdBody,
  type GameEvent,
  type GameState,
} from "@engine";

import { levelFor } from "./levels.ts";

export const HIT_SEED = 3;

/** The meeting staged and stepped once: the player at `kmh` into a
 * standing amateur of `body`, on a run with its INJURIES on or off. */
export function stageMeeting(
  kmh: number,
  body: CrowdBody,
  gore: boolean,
): { state: GameState; a: Amateur; events: GameEvent[] } {
  const state = createGame({
    level: levelFor(HIT_SEED),
    seed: HIT_SEED,
    mode: "free",
    quiet: true,
    crowd: 30,
    gore,
  });
  const crowd = state.crowd!;
  for (const o of crowd.amateurs) o.mode = "lift";
  const a = crowd.amateurs[0];
  a.mode = "ski";
  a.body = body;
  a.board = null;
  a.knobs = { ...a.knobs, skill: 0.5 };
  a.vx = a.vz = a.speed = 0;
  const c = state.skier;
  a.x = c.x;
  a.z = c.z + 0.9;
  a.y = c.y - c.spec.cogHeight;
  c.heading = 0;
  c.vx = 0;
  c.vz = kmh / 3.6;
  const events: GameEvent[] = [];
  clipCrowd(state, events);
  feelBumps(state, events);
  markFall(state);
  return { state, a, events };
}

/** Steps the run on `seconds` under the neutral input. */
export function rideOn(state: GameState, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 120); i++) step(state, NEUTRAL_INPUT);
}

/** ONE ROW: the meeting staged, ridden on `seconds`, and what came of it
 * on both sides. */
export type HitRow = {
  kmh: number;
  body: CrowdBody;
  gore: boolean;
  /** The player: thrown by it, every injury (kind@part:AIS), the worst
   * AIS, the injury severity score, dead, down hurt. */
  thrown: boolean;
  injuries: string[];
  worst: number;
  iss: number;
  dead: boolean;
  down: boolean;
  /** The amateur: knocked down, killed, injured past getting up, crushed
   * 0..1, back up on his skis by the end. */
  knocked: boolean;
  killed: boolean;
  injured: boolean;
  crush: number;
  up: boolean;
  /** Who `casualtiesOf` lists at the end. */
  casualties: string[];
};

export function hitRow(kmh: number, body: CrowdBody, gore: boolean, seconds = 8): HitRow {
  const { state, a } = stageMeeting(kmh, body, gore);
  const thrown = !!state.skier.thrown;
  const knocked = a.mode === "down";
  rideOn(state, seconds);
  const b = state.skier.body;
  const g = state.gore;
  return {
    kmh,
    body,
    gore,
    thrown,
    injuries: b.injuries.map((h) => `${h.kind}@${h.part}:${h.ais}`),
    worst: Math.max(0, ...b.injuries.map((h) => h.ais)),
    iss: severityOf(b),
    dead: !!g && g.dead >= 0,
    down: !!g && g.injured >= 0,
    knocked,
    killed: !!a.dead,
    injured: !!a.injured,
    crush: a.crush ?? 0,
    up: a.mode !== "down",
    casualties: casualtiesOf(state).map((k) => `${k.who}${k.dead ? " dead" : " hurt"}`),
  };
}

/** The lab's sweep: every speed into a grown man and a child, both ways
 * of the switch. */
export const HIT_SPEEDS = [10, 20, 30, 45, 60, 90] as const;
export const HIT_BODIES: readonly CrowdBody[] = ["man", "child"];
