// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE COURSE SET ON A MAP, whichever discipline set it — a slalom's
// stretch (R31, `Level.slalom`), a downhill's whole piste (R32,
// `Level.downhill`) or a super-G's from its lowered start (R33,
// `Level.superG`) — as what every discipline's course shares: the map it
// was set over, the start gate's arc and the finish line's, the vertical
// between. What a reader asks that does not care which race it is (the
// start house over the course's top, the nets along it, the start shots);
// a reader that does asks the discipline's own field.

import type { Level } from "./types.ts";

export type RaceCourse = { base: Level; from: number; to: number; vertical: number };

/** The race course set on `level`, or null on a map with none. */
export function raceCourseOf(level: Level): RaceCourse | null {
  return level.slalom ?? level.downhill ?? level.superG ?? null;
}
