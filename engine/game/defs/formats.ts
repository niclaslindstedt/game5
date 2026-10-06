// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE DISCIPLINES AND THE TRICK FORMATS the game names, each with the
// mode that skis it where it is built — the race card's and the tricks
// card's lists. Stated apart from `modes.ts`, which re-exports them, so
// that file stays under its line cap; it imports nothing from `modes.ts`
// but a type, so the two load in either order.

import type { GameMode } from "./modes.ts";

/** THE RACE DISCIPLINES the game names, in the order a race card lists
 * them. */
export type Discipline = "slalom" | "giantSlalom" | "superG" | "downhill" | "skiCross" | "speedSki";

/** Each discipline, and the mode that races it where it is BUILT — null
 * where it is named and not built yet. */
export const DISCIPLINES: readonly { id: Discipline; mode: GameMode | null }[] = [
  { id: "slalom", mode: "slalom" },
  { id: "giantSlalom", mode: "giantSlalom" },
  { id: "superG", mode: "superG" },
  { id: "downhill", mode: "downhill" },
  { id: "skiCross", mode: "skiCross" },
  { id: "speedSki", mode: "speedSki" },
];

/** THE TRICK FORMATS the game names (`docs/freestyle.md`), in the order the
 * trick card lists them — the build order. */
export type Freestyle =
  | "bigAir"
  | "knuckleHuck"
  | "slopestyle"
  | "railJam"
  | "halfpipe"
  | "moguls"
  | "dualMoguls"
  | "aerials";

/** Each format, and the mode that skis it where it is BUILT — null where it
 * is named and not built yet. */
export const FREESTYLE: readonly { id: Freestyle; mode: GameMode | null }[] = [
  { id: "bigAir", mode: "bigAir" },
  { id: "knuckleHuck", mode: "knuckleHuck" },
  { id: "slopestyle", mode: "slopestyle" },
  { id: "railJam", mode: "railJam" },
  { id: "halfpipe", mode: "halfpipe" },
  { id: "moguls", mode: "moguls" },
  { id: "dualMoguls", mode: null },
  { id: "aerials", mode: null },
];
