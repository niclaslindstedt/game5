// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MORTAL WOUNDS' PUBLIC SURFACE, re-exported whole by `engine/index.ts`:
// the step that deals them and the blood's flow (`gore.ts`), the state they
// are kept in (`gore-state.ts`) and their numbers (`defs/gore.ts`).

export { bleedsOf, brokeAt, holdsHim, isDead, stepGore, woundFlow, type Bleed } from "./gore.ts";
export {
  GORE_OPEN,
  GORE_PIECES,
  freshGore,
  lostPiece,
  type DeathCause,
  type GoreOpen,
  type GorePiece,
  type GoreState,
  type Impaled,
  type TornPiece,
} from "./gore-state.ts";
export { GORE } from "./defs/gore.ts";
