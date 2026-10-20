// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The crowd's smaller exports, gathered for `engine/index.ts`: the lift's
// cabin test, an amateur thrown, a person run into with the bodies that
// need collecting after (`person-hit.ts`), and the people on foot met as
// bodies (`foot.ts`) with the routes they walk (`foot-route.ts`).

export { inCabin } from "./crowd-lift.ts";
export { throwAmateur } from "./crowd-down.ts";
export { hurtFall, waitsForRescue } from "./crowd-hurt.ts";
export {
  casualtiesOf,
  exchangeOf,
  strikePerson,
  struckPerson,
  thrownFar,
  type Casualty,
  type StruckEvent,
  type StruckPerson,
} from "./person-hit.ts";
export { personGive } from "./body-person.ts";
export { PERSON_HIT } from "./defs/person-hit.ts";
export {
  CREW_KEYS,
  allStruck,
  crewAt,
  crewKey,
  footAt,
  footDown,
  footRadius,
  meetFoot,
  shareOfHours,
  stepFoot,
  trackAt,
  withFoot,
  type CrewTrack,
  type FootCall,
  type FootDown,
  type FootPerson,
  type FootTrack,
  type FootState,
  type Hours,
} from "./foot.ts";
export {
  freshRouteAt,
  routeAside,
  routeAt,
  routeOf,
  type Route,
  type RouteAt,
} from "./foot-route.ts";
