// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHETHER HE RIDES A MACHINE this frame — the one question the lens asks
// to pick between the rung the player keeps for himself and the one he
// keeps for his machines (`settings.ts`'s `Cameras`, `camera.ts`'s
// `aboard`): sat on the helicopter's skid, stood in the jump plane's door,
// on the snowmobile's boards, in a piste machine's cab, in the balloon's
// basket or under the paramotor's wing. Out of a door into the skydive, or
// thrown off anything, he is himself again. Three-free.

import type { GameState } from "@engine";

import { inBasket } from "./camera-balloon.ts";
import { drivenGroomer } from "./camera-groomer.ts";
import { underWing } from "./camera-para.ts";
import { ridingSled } from "./camera-sled.ts";

export function aboardCraft(state: GameState): boolean {
  if (state.skier.thrown) return false;
  return (
    !!state.heli?.rider ||
    !!state.plane?.rider ||
    ridingSled(state.sled, false) ||
    drivenGroomer(state) !== null ||
    inBasket(state.balloon, false) ||
    underWing(state)
  );
}
