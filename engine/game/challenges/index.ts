// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// FREE RIDE CHALLENGES — the public face of `engine/game/challenges/`: the
// registry of kinds and the deal and judge over it (`registry.ts`), each
// kind's own shapes, and the bot's measurement of a timed line
// (`sim/challenge-line.ts`). See `docs/challenges.md`.

export {
  CHALLENGE_KINDS,
  challengeKey,
  createChallengeRun,
  dealChallenges,
  type ChallengePlan,
  type ChallengeRun,
} from "./registry.ts";
export { medalOf, medalBeats, MEDALS } from "./types.ts";
export type {
  ChallengeBase,
  ChallengeEvent,
  ChallengeGate,
  ChallengeKind,
  ChallengeMemory,
  ChallengeResult,
  ChallengeWatch,
  LiveLine,
  Medal,
  MedalBars,
  VoidCause,
} from "./types.ts";
export { isLine, LINE_KIND, type LineChallenge } from "./line.ts";
export {
  isTrick,
  kickerKey,
  meetsGoal,
  tierOf,
  TRICK_KIND,
  type TrickChallenge,
  type TrickGoal,
} from "./trick.ts";
export {
  isSpots,
  SPOTS_KIND,
  type HiddenSpot,
  type SpotKind,
  type SpotsChallenge,
} from "./spots.ts";
export { isSummits, SUMMITS_KIND, type SummitsChallenge } from "./summits.ts";
export { linePar } from "./par.ts";
export { dealtRuns, onOwnSkis, type DealtRun } from "./common.ts";
export { CHALLENGES } from "../defs/challenges.ts";
export { skiLine, type LineSkied } from "../../sim/challenge-line.ts";
