// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JOLT LAB'S FAMILIES (`make jolt`): every animated figure the game
// draws, a family each — its scenes and how one is driven into samples
// (`jolt-measure.mjs`). A family is `{ id, say, scenes, ride(scene) }`; a
// scene is `{ id, title, … }`, whatever its family's `ride` reads.

import { MOVES } from "./skier-moves.mjs";
import { BOARD_MOVES } from "./board-figure-moves.mjs";
import { createRiderReader, movesOf } from "./jolt-rider.mjs";

export const FAMILY_IDS = ["skier", "board", "ride", "crowd", "people", "wild"];

/** The families asked for, built over the lab's modules `ctx`. */
export async function familiesOf(ctx, ids) {
  const rider = createRiderReader(ctx);
  const all = {
    skier: () => ({
      id: "skier",
      say: "the player on skis through every move of the skier lab, as the model draws him",
      scenes: movesOf(ctx, MOVES, ctx.E.skisById("chamois")),
      ride: rider,
    }),
    board: () => ({
      id: "board",
      say: "the player on a board through every move of the board lab, as the model draws him",
      scenes: movesOf(ctx, BOARD_MOVES, ctx.E.pairById("lynx")),
      ride: rider,
    }),
    // Every other family is a module of its own, loaded when asked for.
    ride: async () => (await import("./jolt-ride.mjs")).rideFamily(ctx, rider),
    crowd: async () => (await import("./jolt-people.mjs")).crowdFamily(ctx),
    people: async () => (await import("./jolt-people.mjs")).peopleFamily(ctx),
    wild: async () => (await import("./jolt-wild.mjs")).wildFamily(ctx),
  };
  const out = [];
  for (const id of ids) out.push(await all[id]());
  return out;
}
