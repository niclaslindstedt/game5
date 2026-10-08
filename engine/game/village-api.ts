// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREETS, as the engine's public surface re-exports them
// (`engine/index.ts`): the street plan (`village-streets.ts`), what its
// streets carry for traffic and walkers (`village-furniture.ts`), the
// village as the map knows it (`village.ts`) and the numbers it is laid
// by (`defs/village-streets.ts`).

export {
  MASK as STREET_MASK,
  felledTrees,
  onCarriageway,
  onStreet,
  streetMaskAt,
  villageBox,
  villageBuildingsOf,
  villageOf,
  villageSolids,
  type Village,
} from "./village.ts";
export {
  besidePoint,
  reachOf,
  streetAt,
  type Junction,
  type Street,
  type StreetPoint,
  type VillageArea,
  type VillageStreets,
} from "./village-streets.ts";
export {
  nearestOn,
  offsetLine,
  trimAt,
  type Bay,
  type BusStop,
  type Crossing as StreetCrossing,
  type Lane,
  type SnowPole,
  type StreetFurniture,
  type StreetLamp,
  type Walk,
} from "./village-furniture.ts";
export {
  SECTIONS,
  STREET_FURNITURE,
  VILLAGE_AREAS,
  VILLAGE_LOTS,
  VILLAGE_STREETS,
  sideReach,
  type Section,
  type StreetKind,
  type StreetSide,
} from "./defs/village-streets.ts";
export { BASE_KINDS, TOWN_KINDS, type BaseKind, type TownKind } from "./defs/resort-buildings.ts";
