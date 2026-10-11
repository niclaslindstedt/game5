// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREESTYLE CONTESTS A RUN IS PART OF: what `GameState` carries between
// a contest's runs (slopestyle, the halfpipe, moguls, aerials, ski jumping).
// Stated apart so the run's own state stays under its line cap;
// `GameState` is this and the run.

import type { SlopeContest } from "./slopestyle-contest.ts";
import type { PipeContest } from "./halfpipe-contest.ts";
import type { MogulsContest } from "./moguls-contest.ts";
import type { MogulTurns } from "./mogul-turns.ts";
import type { AerialFlight } from "./aerial-flight.ts";
import type { AerialsContest } from "./aerials-contest.ts";
import type { SkiJumpState } from "./ski-jump-state.ts";
import type { SkiJumpContest } from "./ski-jump-contest.ts";

export type ContestState = {
  /** A SLOPESTYLE CONTEST so far (R38, `slopestyle-contest.ts`), before
   * this run — carried for the judges and the app; never read by a step. */
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
  /** THE SKI JUMP UNDER WAY on a jumping hill (R43, `ski-jump.ts`): the bar,
   * the tracks, the take-off, the flight and its record — the run's own,
   * stepped with it. */
  jump?: SkiJumpState;
  /** A SKI JUMPING CONTEST so far (R43, `ski-jump-contest.ts`), before
   * this run's jump — carried for the jury, the judges and the app; the
   * jump's gate and its air are read off it when the run is stood up. */
  skiJumpContest?: SkiJumpContest;
};
