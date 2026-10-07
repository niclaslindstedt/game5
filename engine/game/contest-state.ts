// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREESTYLE CONTESTS A RUN IS PART OF: what `GameState` carries between
// a contest's runs (big air, slopestyle, the halfpipe, moguls, aerials).
// Stated apart so the run's own state stays under its line cap;
// `GameState` is this and the run.

import type { BigAirContest } from "./big-air-contest.ts";
import type { SlopeContest } from "./slopestyle-contest.ts";
import type { PipeContest } from "./halfpipe-contest.ts";
import type { MogulsContest } from "./moguls-contest.ts";
import type { MogulTurns } from "./mogul-turns.ts";
import type { AerialFlight } from "./aerial-flight.ts";
import type { AerialsContest } from "./aerials-contest.ts";

export type ContestState = {
  /** A BIG AIR CONTEST so far (R37, `big-air-contest.ts`), before this
   * run's jump — carried for the judges and the app; never read by a
   * step. */
  bigAir?: BigAirContest;
  /** A SLOPESTYLE CONTEST so far (R38, `slopestyle-contest.ts`), carried
   * between its runs as big air's is. */
  slopestyle?: SlopeContest;
  /** A HALFPIPE CONTEST so far (R39, `halfpipe-contest.ts`), carried
   * between its runs as slopestyle's is. */
  halfpipe?: PipeContest;
  /** A MOGULS CONTEST so far (R40, `moguls-contest.ts`), carried between
   * its runs as the halfpipe's is. */
  moguls?: MogulsContest;
  /** THE TURNS OF A MOGULS RUN as the judges watch them (`mogul-turns.ts`)
   * — the run's own, stepped with it. */
  mogulTurns?: MogulTurns;
  /** AN AERIALS CONTEST so far (R41, `aerials-contest.ts`), carried
   * between its jumps as the moguls' is. */
  aerials?: AerialsContest;
  /** THE JUMP UNDER WAY on an aerials site (`aerial-flight.ts`): its
   * declared plan and the flight flown — the run's own, stepped with it. */
  aerial?: AerialFlight;
};
