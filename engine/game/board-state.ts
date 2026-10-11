// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SNOWBOARDER IS DOING WITH HIS FEET (`SkierState.board`, present on
// a board alone): the moves `board-moves.ts` makes and the figure draws —
// the rear foot out of its binding pushing, the hop, the sideslip's eased
// edge and the falling leaf's swing. Nothing here exists on skis, so no
// pair of skis carries it and no ski run's digest can see it.

/** A SNOWBOARDER'S MOVES at a crawl and stood across a slope. */
export type BoardMoves = {
  /** THE REAR FOOT OUT OF ITS BINDING (`freeFootOf` names which), pushing
   * beside the board in the ONE-FOOT SKATE — the push on the stride's
   * phase (`SkierState.stride`, `poles.ts`'s `strideShape`) — or set on the
   * board between the bindings while he glides; false strapped in. */
  free: boolean;
  /** HOPPING, 0..1: the share of his working that is the board hopped
   * along with both feet in (loose snow, where a free foot sinks) rather
   * than the skate; the hops are on the stride's phase. */
  hop: number;
  /** THE SIDESLIP (`SkierState.sidestep` the side the hill rises on): how
   * far his UPHILL edge is eased off, 0 set … 1 flat … past 1 onto the
   * downhill edge; 0 when he is not stood across a slope. */
  slip: number;
  /** THE FALLING LEAF: how far the nose is swung down the hill off square
   * to the fall line, rad (nose down positive); 0 off a sideslip. */
  leaf: number;
  /** THE POP the flight he is in left the snow on (`board-tricks.ts`): off
   * the TAIL, the ollie, or off the NOSE, the nollie — the lean he held as
   * he sprang it; null for a flight he did not pop (off a kicker's lip or a
   * crest). Set as he leaves the snow; naming only, it moves nothing. */
  pop: "ollie" | "nollie" | null;
};

/** A SNOWBOARDER'S GRABS (`board-tricks.ts`'s `boardGrabOf`), each a hand
 * on the board at the place the sport names it by: the INDY (the rear hand
 * on the toe edge between the feet), the MUTE (the front hand on the toe
 * edge), the MELON (the front hand on the heel edge), the STALEFISH (the
 * rear hand round behind the rear leg on the heel edge), the METHOD (the
 * front hand on the heel edge, the board kicked up behind him), the NOSE
 * grab and the TAIL grab (a hand on that end). */
export type BoardGrab = "indy" | "mute" | "melon" | "stalefish" | "method" | "nose" | "tail";

/** WHAT A BOARD'S SPIN IS CALLED (`board-tricks.ts`'s `spinTag`), carried on
 * the combo's spin and half parts beside their count: FRONTSIDE (the chest
 * turned down the way he goes first) or BACKSIDE (the back first), whether
 * he took off riding SWITCH, and whether he popped it off the nose (a
 * NOLLIE). Absent on skis. */
export type SpinTag = {
  side?: "frontside" | "backside";
  switched?: true;
  nollie?: true;
};

/** A board's moves at rest: strapped in, stood still. */
export function freshBoardMoves(): BoardMoves {
  return { free: false, hop: 0, slip: 0, leaf: 0, pop: null };
}
