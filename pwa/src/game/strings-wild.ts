// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF AN ANIMAL RUN INTO (`beast-hit.ts`) — a block of the one
// strings table (`strings.ts`, §39.1), stated next door and spread into
// `STRINGS` under the same names: what each animal is called on the news
// line, and the line a blow that did NOT throw him earns (one that threw
// him is the wipeout's `YARD SALE! ANIMAL`).

import type { BeastId } from "@engine";

export const WILD_STRINGS = {
  /** Every animal by the word the news line calls it. */
  beastWord: {
    hare: "HARE",
    squirrel: "SQUIRREL",
    fox: "FOX",
    arcticfox: "ARCTIC FOX",
    roedeer: "ROE DEER",
    reindeer: "REINDEER",
    chamois: "CHAMOIS",
    moose: "MOOSE",
    wolverine: "WOLVERINE",
    lynx: "LYNX",
    wolf: "WOLF",
    ibex: "IBEX",
    elk: "ELK",
    coyote: "COYOTE",
    sika: "SIKA",
  } satisfies Record<BeastId, string>,
  /** Run clean through it, and still on his skis. */
  newsBeastSplat: (word: string): string => `SPLAT! ${word}`,
  /** Knocked it flat, and still on his skis. */
  newsBeastKnocked: (word: string): string => `SORRY, ${word}!`,
};
