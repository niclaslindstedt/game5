// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARD, as the engine's public surface re-exports it
// (`engine/index.ts`): the boards and the questions about a pair's id
// (`defs/boards.ts`), the board's own technique (`defs/technique.ts`), and
// its two edges — which is the toe and which the heel, and what each holds
// (`limits.ts`, `incline.ts`).

export { LYNX, BOARD_CATALOG, isBoard, isBoardId, isPairId, pairById } from "./defs/boards.ts";
export { BOARD_TECHNIQUE } from "./defs/technique.ts";
export { angulateShareOf, edgeAskedAt, edgeSideOf } from "./limits.ts";
export { angulationOf } from "./incline.ts";
export type { BoardMoves } from "./board-state.ts";
export { BOARD_MOVES } from "./defs/board-moves.ts";
export {
  boardDrive,
  freeFootOf,
  holdsStill,
  hopShare,
  pushRate,
  pushReachOf,
  skateReach,
  turnWork,
} from "./board-moves.ts";
export { caughtCause, slideAcross, slowCatch, strapBoard } from "./board-crash.ts";
