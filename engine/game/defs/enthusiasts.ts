// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ENTHUSIASTS — who is out on a free ride's ski area after dark
// (`enthusiasts.ts`). A night skiing session empties the hill: the lifts
// still turn and the floodlights burn, the piste machines and the snow guns
// work, but the families, the ski schools and the lot down from the hut have
// gone in. Only a few keen skiers stay out, lapping the lit runs — and each
// of those is a WHOLE SKIER, the player's own physics skied by the bot, on
// a pair and a build of his own and drawn in a kit of his own.

import type { PisteGrade } from "../../mapgen/grades.ts";
import { GROOMER } from "./groomer.ts";
import { RACE } from "./modes.ts";
import type { SkiId } from "./skis.ts";

export const ENTHUSIASTS = {
  /** How many are out after dark. */
  count: 3,
  /** The sun under this, rad, is night: the crowd has gone in. The same
   * dusk the piste machines go out at (`GROOMER.night`). */
  night: GROOMER.night,
  /** The pairs one is dealt — the six the player picks from. */
  skis: RACE.skis as readonly SkiId[],
  /** How hard he tucks, at the least and the most: a keen skier, not a
   * racer, holds some of it back. */
  pace: [0.35, 0.8] as readonly [number, number],
  /** How far right of a run's line he holds his lane, m either side. */
  lane: 5,
  /** How keen he is on each colour when he picks a run off a top: a keen
   * skier laps the reds and blues and drops into a black now and then. */
  grade: { green: 0.25, blue: 1, red: 1.4, black: 0.8 } as Readonly<Record<PisteGrade, number>>,
  /** How far before a run's end he looks for the one it merges into, m —
   * past the bot's look ahead, so the line he reads never runs out. */
  merge: 30,
  /** How far before the village end of a run he lets it carry him to a
   * stop, m. */
  stop: 20,
  /** What he rides the run-out to a stop with: the brake, held. */
  brake: 0.6,
  /** How slow, m/s, is stood still. */
  still: 0.6,
  /** ...and how slow at the bottom, where he rides the run-out to a stop,
   * m/s. */
  rested: 2,
  /** Stood at the bottom this long, s, he goes up again. */
  rest: 6,
  /** Stood still anywhere else, or `off` m off his run, `still` s on end,
   * he is lost: the next lift takes him. */
  lost: { still: 20, off: 80 },
  /** How long he skis straight on, s, stood off a lift at its top. */
  unload: 3,
  /** He moves only where the player cannot see him go, m — from where he
   * is and to where he will be. Short of that he waits. */
  unseen: 140,
} as const;
