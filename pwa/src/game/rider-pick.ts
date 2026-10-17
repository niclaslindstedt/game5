// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER PICKED BY MODE. The rider card's AUTO bodies (`outfit.ts`'s
// `auto`, `autoWoman` — the default) are no kit of their own: each run
// stands them in the modelled kit its mode is skied in (`player-model.ts`):
// the HIKER on a free ride, the FREESTYLE rider on a tricks run and every
// freestyle contest, the RACER on every race discipline — and on the ski
// jump, whose jumper's one-piece suit is a race suit's cousin. Any other
// body is the player's own pick and is left as it is, so the code-dressed
// man and woman are one press away on the BODY row. DOM-free.

import type { RunRules } from "@engine";

import { gearOf, type BodyId, type ModelKit, type Outfit } from "./outfit.ts";

/** The modelled kit a run's rules are skied in. */
export function kitOfRules(rules: RunRules): ModelKit {
  if (rules.tricks || rules.aerials) return "freestyle";
  return rules.course ? "racer" : "hiker";
}

const MAN: Record<ModelKit, BodyId> = { hiker: "hiker", racer: "racer", freestyle: "freestyle" };
const WOMAN: Record<ModelKit, BodyId> = {
  hiker: "hikerWoman",
  racer: "racerWoman",
  freestyle: "freestyleWoman",
};

/** The outfit with an AUTO body stood in `kit`'s model, a man's or a
 * woman's as the auto body is; any other body unchanged. */
export function byMode(outfit: Outfit, kit: ModelKit): Outfit {
  const body = gearOf("body", outfit.body);
  if (!body.auto) return outfit;
  return { ...outfit, body: (body.female ? WOMAN : MAN)[kit] };
}
