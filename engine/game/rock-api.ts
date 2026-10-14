// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK'S PUBLIC SURFACE, re-exported by `engine/index.ts`: where the
// rock lies on the drops (`rocks.ts`), a cliff's wall (`cliff-wall.ts`),
// and the skin made the surface a body meets (`rock-ground.ts`).

export {
  hashOf as rockHash,
  onAnyCliff,
  rockShare,
  rockyCliff,
  unit as rockDraw,
  wallOf,
} from "./rocks.ts";
export { ROCKS } from "./defs/rocks.ts";
export { SKIN_SALT, bedrockOf, rockStrike, withRock } from "./rock-ground.ts";
export { cliffWalls, faceShare, wallSolids, type CliffWall } from "./cliff-wall.ts";
export {
  KIT_SALT,
  bedOf,
  dipAt,
  kitStones,
  kitTop,
  type KitStone,
  type KitTop,
} from "./rock-kit.ts";
export { PIECE, rockPieces, type Hull, type RockPiece } from "./rock-hull.ts";
