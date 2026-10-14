// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK'S PUBLIC SURFACE, re-exported by `engine/index.ts`: where the
// rock lies on the drops (`rocks.ts`), a cliff's wall (`cliff-wall.ts`),
// the rock's shape and share (`rock-relief.ts`, `rock-share.ts`) and the
// ground reshaped by them, the surface a body meets (`rock-ground.ts`).

export {
  hashOf as rockHash,
  onAnyCliff,
  rockShare,
  rockyCliff,
  unit as rockDraw,
  wallOf,
} from "./rocks.ts";
export { ROCKS } from "./defs/rocks.ts";
export { ROCK_LATTICE, SKIN_SALT, bedrockOf, rockStrike, withRock } from "./rock-ground.ts";
export {
  RELIEF,
  RELIEF_SALT,
  reliefAt,
  reliefParams,
  reliefParts,
  type ReliefParams,
  type ReliefParts,
} from "./rock-relief.ts";
export { MASK as ROCK_MASK, rockMask, rockShareNodes } from "./rock-share.ts";
export { cliffWalls, faceShare, wallSolids, type CliffWall } from "./cliff-wall.ts";
