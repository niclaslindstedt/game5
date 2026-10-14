// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK's public surface (R44, R45): the park laid over a summer
// map, the questions every reader asks of it, its rule book and its
// analyzer. Kept out of the mapgen barrel: the park reads the cabins
// (`game/cabins.ts`), which read the mapgen barrel, so exporting it there
// would close a cycle.

export { setBikePark, bikeLifts, judgeTrail, type TrailVerdict } from "../mapgen/bike-park.ts";
export { benchAt, treadAt, withBikeSurface } from "../mapgen/bike-surface.ts";
export {
  bikeTrailAt,
  bikeTreadAt,
  bikeTrailById,
  bikeTrailHeads,
  nearestBikeHead,
  featuresAt,
  nearestBikeTrailPoint,
  type BikeTread,
} from "../mapgen/bike-park-query.ts";
export {
  BIKE_PARK_RULES,
  TRAIL_GRADES,
  type TrailGrade,
  type TrailRule,
} from "../mapgen/bike-park-rules.ts";
export type {
  BikeApron,
  BikeFeature,
  BikeFeatureKind,
  BikeJunction,
  BikePark,
  BikePiece,
  BikeTrail,
  BikeTrailHead,
  BikeTrailHit,
  BikeTrailPoint,
} from "../mapgen/bike-park-types.ts";
export {
  analyzeBikePark,
  type BikeParkAnalysis,
  type TrailMeasure,
} from "../analysis/bike-park.ts";
