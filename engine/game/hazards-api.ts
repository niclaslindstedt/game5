// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A FREE RIDE'S HAZARDS OFF THE PISTE, as the engine's public surface
// re-exports them (`engine/index.ts`): the grimbear in the woods
// (`grimbear.ts`), the avalanche on a loaded slope (`avalanche.ts`) and the
// camp fires and bonfires a skier can ride into (`fires.ts`,
// `fire-burn.ts`), each with its numbers and its state.

export { GRIMBEAR } from "./defs/grimbear.ts";
export { freshGrimbear, stepGrimbear, type GrimbearAsk } from "./grimbear.ts";
export type { GrimbearPhase, GrimbearState } from "./grimbear-state.ts";
// THINGS THAT GO WRONG IN THE AIR (`mishaps.ts`): its numbers and stream.
export * from "./mishaps.ts";
export { AVALANCHE } from "./defs/avalanche.ts";
export {
  avalancheHazard,
  avalancheHolds,
  debrisDepth,
  freshAvalanche,
  loadOf as avalancheLoad,
  release as releaseAvalanche,
  steepShare,
  stepAvalanche,
  survivalMinutes,
} from "./avalanche.ts";
export { AVALANCHE_RESCUE } from "./defs/avalanche-rescue.ts";
export { burialOf, patrolMan, patrolReach, type PatrolMan } from "./avalanche-rescue.ts";
export {
  CELL as AVALANCHE_CELL,
  type AvalancheEvent,
  type AvalancheState,
  type AvalancheVictim,
  type Beacon,
  type Burial,
  type BuriedWho,
  type Patrol,
  type PatrolAct,
  type ProbeHole,
  type SlabFrame,
  type Slide,
} from "./avalanche-state.ts";
export { firesNear, firesOf, type Fire, type FireSeat } from "./fires.ts";
export { fireStrike, stepBurn, type BurnState } from "./fire-burn.ts";
export { sledBallAt, sledFireFlux } from "./sled-fire.ts";
export { SLED_FIRE } from "./defs/sled-fire.ts";
export { FIRE_BURN, FIRE_KINDS, FIRE_LAYOUT, type FireDef, type FireKind } from "./defs/fires.ts";
// THE WANTED LEVEL (`wanted.ts`): the army hunting a skier who stole a
// helicopter — its numbers, its state and its hook (`raiseHeat`).
export {
  WANTED,
  type GroundWaves,
  type PursuerKind,
  type WantedCause,
  type WantedRoster,
  type WaveMix,
} from "./defs/wanted.ts";
export {
  arrestSkier,
  arrestedOf,
  freshWanted,
  groundWave,
  quarryOf,
  raiseHeat,
  rosterOf,
  seesQuarry,
  setWanted,
  stepWanted,
  survivedOf,
  underCover,
  wavesSent,
} from "./wanted.ts";
export type { Pursuer, WantedEnd, WantedEvent, WantedState } from "./wanted-state.ts";
// THE GUNFIRE (`gunfire.ts`): the army's weapons and every round they fire.
export {
  GUNFIRE,
  WEAPONS,
  type BlastDef,
  type GunDef,
  type WeaponDef,
  type WeaponKind,
} from "./defs/weapons.ts";
export { WOUNDS } from "./defs/wounds.ts";
export {
  aimPoint,
  armGun,
  disarmGun,
  energyAt,
  fireAt,
  flightTime,
  freshGunfire,
  gunDraw,
  gunReady,
  lethalOf,
  rulesOf,
  speedAt,
  stepGunfire,
} from "./gunfire.ts";
export { bodyCentre, bodyHit, bodyPoints } from "./gunfire-body.ts";
export { damageMachine, machineAt } from "./gunfire-machine.ts";
export type * from "./gunfire-state.ts";
// THE ARMY'S HELICOPTERS IN FLIGHT (`army.ts`): called in, flown, fought.
export { ARMY } from "./defs/army.ts";
export { armyFloor, armyHelis, armyPoint, armyQuat, freshArmy, stepArmy } from "./army.ts";
export type * from "./army-state.ts";
// THE ARMY ON THE GROUND (`army-ground.ts`): the landings, the soldiers,
// the lifts' squads, the arrest.
export { ARMY_GROUND } from "./defs/army-ground.ts";
export { landing, ropeHover } from "./army.ts";
export { landingSpot, type LandSpot } from "./army-land.ts";
export { armyTroops, liftSquad, onTheGround, soldierKey, stepGround } from "./army-ground.ts";
export { LIFT_SQUAD, inGondola, liftFor } from "./army-lift.ts";
// THE GROUND WAVES (`army-wave.ts`): the columns up the mountain.
export { ARMY_WAVE } from "./defs/army-wave.ts";
export { WAVE_SQUAD, wayDown } from "./army-wave.ts";
// THE ARMY'S SNOWMOBILES (`army-sled.ts`): two up, after him over the snow.
export { ARMY_SLED } from "./defs/army-sled.ts";
export {
  ARMY_SLED_SOURCE,
  SLED_SQUAD,
  armySleds,
  crewed,
  sledPad,
  sledPoint,
  stepArmySleds,
} from "./army-sled.ts";
export {
  chooseWay,
  tunnelWithin,
  wayCost,
  type DriveRead,
  type TerrainRead,
} from "./army-drive.ts";
// THE GROUND WAVES' VEHICLES (`army-vehicle.ts`): carriers, trucks, tanks.
export { ARMY_VEHICLE, type ArmyVehicleKind, type VehicleSpec } from "./defs/army-vehicle.ts";
export {
  VEHICLE_SQUAD,
  armyVehicles,
  callVehicles,
  muzzleOf,
  stepArmyVehicles,
} from "./army-vehicle.ts";
export { rearOf } from "./army-vehicle-body.ts";
// THE ARMY'S PARAMOTORS AND BALLOONS (`army-air.ts`): riflemen and rocketeers.
export { ARMY_AIR } from "./defs/army-air.ts";
export { airWanted, armyBalloons, armyParas, nearestAir, stepArmyAir } from "./army-air.ts";
export { AIR_SQUAD, flyPara } from "./army-para.ts";
export { BALLOON_SQUAD, rocketGun } from "./army-balloon.ts";
export { burstOnArmy } from "./army-burst.ts";
export { freshAirState } from "./army-air-state.ts";
export type * from "./army-air-state.ts";
// THE BLAST (`blast.ts`): what a burst does where it goes off.
export { blastAt, type BlastSpec } from "./blast.ts";
// THE ARMY'S MACHINES TAKEN (`armour.ts`, `army-steal.ts`): a carrier, a
// truck or a tank driven, its helicopter flown off the snow.
export { ARMOUR } from "./defs/armour.ts";
export {
  ARMOUR_SOURCE,
  armourDoor,
  armourPoint,
  armourWithin,
  knockOut,
  sightPoint,
  stepArmour,
  takeArmour,
} from "./armour.ts";
export type { ArmourEvent, ArmourRide } from "./armour-state.ts";
export { ARMY_HELI_SOURCE, ARMY_PILOT_DOOR, armyHeliDoor } from "./army-steal.ts";
