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
};

/** A board's moves at rest: strapped in, stood still. */
export function freshBoardMoves(): BoardMoves {
  return { free: false, hop: 0, slip: 0, leaf: 0 };
}
