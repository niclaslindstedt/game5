// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The crowd's smaller exports, gathered for `engine/index.ts`: the lift's
// cabin test, an amateur thrown, and a person run into with the bodies
// that need collecting after (`person-hit.ts`).

export { inCabin } from "./crowd-lift.ts";
export { throwAmateur } from "./crowd-down.ts";
export { hurtFall, waitsForRescue } from "./crowd-hurt.ts";
export {
  casualtiesOf,
  strikePerson,
  struckPerson,
  thrownFar,
  type Casualty,
  type StruckEvent,
  type StruckPerson,
} from "./person-hit.ts";
export { personGive } from "./body-person.ts";
export { PERSON_HIT } from "./defs/person-hit.ts";
