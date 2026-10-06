// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREESTYLE CONTESTS A RUN IS PART OF: what `GameState` carries between
// a contest's runs (big air, slopestyle, the halfpipe, moguls) or steps through a
// session (a jam). Stated apart so the run's own state stays under its
// line cap; `GameState` is this and the run.

import type { BigAirContest } from "./big-air-contest.ts";
import type { SlopeContest } from "./slopestyle-contest.ts";
import type { PipeContest } from "./halfpipe-contest.ts";
import type { JamState } from "./jam.ts";
import type { MogulsContest } from "./moguls-contest.ts";
import type { MogulTurns } from "./mogul-turns.ts";

export type ContestState = {
  /** A BIG AIR CONTEST so far (R37, `big-air-contest.ts`), before this
   * run's jump — carried for the judges and the app; never read by a
   * step. */
  bigAir?: BigAirContest;
  /** A SLOPESTYLE CONTEST so far (R39, `slopestyle-contest.ts`), carried
   * between its runs as big air's is. */
  slopestyle?: SlopeContest;
  /** A HALFPIPE CONTEST so far (R41, `halfpipe-contest.ts`), carried
   * between its runs as slopestyle's is. */
  halfpipe?: PipeContest;
  /** A MOGULS CONTEST so far (R42, `moguls-contest.ts`), carried between
   * its runs as the halfpipe's is. */
  moguls?: MogulsContest;
  /** THE TURNS OF A MOGULS RUN as the judges watch them (`mogul-turns.ts`)
   * — the run's own, stepped with it. */
  mogulTurns?: MogulTurns;
  /** A KNUCKLE HUCK'S JAM so far (R38, `jam.ts`): the hits ridden, and
   * where the one under way began — the run's own, stepped with it. */
  jam?: JamState;
};
