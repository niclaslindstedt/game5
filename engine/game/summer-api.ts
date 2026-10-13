// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER SEASON, as the engine's public surface re-exports it (`engine/index.ts`).
export {
  summerFieldOf,
  summerGroundAt,
  summerShareAt,
  summerSurfaceAt,
  treeLineY,
  type SummerField,
} from "./summer-ground.ts";
export {
  KIND_SURFACE,
  SUMMER_GROUND,
  SUMMER_KINDS,
  SURFACES,
  type SummerKind,
  type SummerSurface,
  type SurfaceId,
} from "./defs/summer-ground.ts";
export { SUMMER_DAY, drySummer, summerOf, summerSky } from "./summer.ts";
