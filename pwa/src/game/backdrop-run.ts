// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUN UNDER THE CARDS (DOM-free): who rides the live run behind the
// front door, the loading card and the rest once the player has let go of
// it, and what it is stood up as. The DARING BOT rides it (`DARING_BOT`,
// `engine/sim/daring.ts`) — off the piste, at the kickers, flipping and
// spinning — on a SHOWCASE of the map (`engine/sim/showcase.ts`): stood up
// at once when the player leaves a plain mountain's run for the menu,
// whenever a run it rides is over by the restart rule, and in place of the
// race the door would otherwise stand over at boot. A discipline's course
// or venue is skied on to its flag first, and a free ride keeps its own
// mountain until it is over — and, where it is the ride the player left for
// the menu (`resume-run.ts`), is stood up again as that ride at the top of
// its last piste rather than handed on, so RESUME still has it. A link's
// pre-roll and `?bot=1` keep the plain bot (`App.tsx`'s `inputFor`).

import {
  botInput,
  createGame,
  DARING_BOT,
  showcaseNow,
  showcaseOptions,
  showcaseOver,
  type CreateGameOptions,
  type GameState,
  type SkierInput,
} from "@engine";

import { againAt, freeRestart } from "./free-ride.ts";

/** The controls the backdrop is ridden on this step — by the plain bot
 * where `plain` (a link's pre-roll, `?bot=1`). */
export function backdropInput(state: GameState, plain = false): SkierInput {
  return plain ? botInput(state) : botInput(state, DARING_BOT);
}

/** The run that takes over from `state` once the restart rule says it is
 * over, or null while it goes on: a showcase — or, handed the free ride's
 * `again` (`freeAgainOptions`), that ride stood at the top of its last
 * piste where it was ridden on skis or a board (a machine's ride is left
 * to the showcase, which would otherwise stand it up on its pad again and
 * again). */
export function backdropNext(
  state: GameState,
  again: CreateGameOptions | null = null,
): GameState | null {
  const end = showcaseOver(state);
  if (!end) return null;
  const ride = again && end !== "finished" ? freeRestart(state, again) : null;
  const top = ride && ["top", "start"].includes(againAt(state.rules, ride));
  return createGame(top ? ride : showcaseOptions(state));
}

/** The showcase the menu stands over when the player leaves `state` for
 * it (and at boot), or null where the run is kept as it is. */
export function backdropTaken(state: GameState): GameState | null {
  return showcaseNow(state) ? createGame(showcaseOptions(state)) : null;
}
