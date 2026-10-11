// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWBOARD'S OWN MOVES — the block of `TUNING` that answers to
// `board-moves.ts` (the one-foot skate, the step turn about the front foot,
// the sideslip and the falling leaf) and `board-crash.ts` (the caught
// downhill edge, the board kept on through a fall, the dig out of a bog).
// It lives beside `tuning.ts` and is folded in as `TUNING.board`.
//
// WHAT IS KNOWN, AND WHAT IS AN ESTIMATE (`docs/riding.md` § The board):
//
//   - THE ONE-FOOT SKATE. A rider crossing the flat, shuffling up a lift
//     line or leaving a start takes his REAR foot out of its binding and
//     pushes with it beside the board — short quick pushes, the front foot
//     strapped in and the body turned to face the nose — then sets the
//     foot back on the board between the bindings to glide, and straps it
//     back in before he rides off down anything steep. A push from one
//     foot beside a board is short and sideways to it: a fraction of a
//     skier's two-legged skate (`legs`), useful to about a running pace and
//     buying nothing past it. These numbers are ESTIMATES set to those
//     descriptions, not measured.
//   - THE STEP TURN. Strapped by the front foot alone, a rider steers a
//     board at a walk by swinging its tail round with the free foot — the
//     board pivots about the FRONT BINDING.
//   - THE SIDESTEP DOES NOT EXIST. Strapped in, both feet on one deck, a
//     rider cannot step up a slope a ski at a time: he climbs by taking
//     the board off and walking, which this game does not do (a skier past
//     50° kicking steps in his boots is the same refusal). A board gets up
//     a rise only as far as the skate carries it.
//   - THE SIDESLIP AND THE FALLING LEAF. Stood across a steep pitch on his
//     UPHILL edge (the heel edge facing down the hill, the toe edge facing
//     up it), a rider eases the edge off and the board slides straight down
//     the fall line, the edge his brake; weight on his front foot drifts it
//     forward across the slope, on his back foot backward — the falling
//     leaf, a beginner's first descent and an expert's way down a chute.
//     Let the edge go past flat and the DOWNHILL edge meets the snow
//     sliding into it: the catch every rider knows.
//   - THE CAUGHT DOWNHILL EDGE. The board stops dead across its slide and
//     the body goes on: off a heel edge (the rider facing down the hill)
//     he is SLAMMED onto his back — his seat, his outstretched hands and
//     the back of his head — and off a toe edge thrown forward onto his
//     knees, his hands and his face. Wrist injuries are the snowboarder's
//     commonest (about a quarter of them), from hands put down to break
//     exactly these falls, with the head from the backward slam; knee
//     ligaments, the skier's commonest, are far rarer with both feet held
//     to one deck. The board stays on through all of it — there is no
//     binding release, so no board is ever lost to a fall.
//   - BOGGED IN POWDER. No poles to lever on: a rider stuck in deep snow
//     digs with his hands and hops the board free.

export const BOARD_MOVES = {
  /** THE ONE-FOOT SKATE (`board-moves.ts`). */
  skate: {
    /** The share of a skier's power-limited push (`poles.power`, the pair's
     * `polePush`) one free foot beside the board has. */
    legs: 0.35,
    /** The push is whole under `speed` m/s (5 km/h) and gone by `fade`
     * (14 km/h): a foot pushing beside a board cannot keep up past a run. */
    speed: 1.4,
    fade: 4,
    /** Pushes a second: quick and short at a standstill, `slow`, to `fast`
     * by the fade. */
    slow: 1.3,
    fast: 1.8,
    /** THE FOOT TAKEN OUT: working for his speed (the drive over `drive`)
     * under `free` m/s, the rear foot comes out of its binding; it is
     * STRAPPED BACK IN once he is going `strap` m/s (16 km/h) — past where
     * a push buys anything, so he never rides off down a pitch with a foot
     * hanging. */
    drive: 0.3,
    free: 2.2,
    strap: 4.5,
    /** With a foot free he stands the board on `edge` of what the edge's
     * lock asks: one strapped foot cannot tip a board hard over. */
    edge: 0.4,
    /** HOPPING, in loose snow: a free foot sinks where it pushes, so in
     * powder (the packed share under `hopBelow`, all of it hop by `hopAt`)
     * he keeps both feet in and hops the board along, worth `hop` of the
     * skate. */
    hopBelow: 0.6,
    hopAt: 0.2,
    hop: 0.5,
    /** THE STEP TURN about the front foot: each push swings the tail round
     * by `turn` rad, taken up at `rate` a second. */
    turn: 0.22,
    rate: 3,
  },
  /** THE SIDESLIP AND THE FALLING LEAF (`board-moves.ts`). */
  slip: {
    /** A pitch of `from` rad (8°) or more, the board within
     * `sidestep.across` of square to the fall line, sliding no faster than
     * `most` m/s (18 km/h) and under `way` m/s along its own length, not
     * working, not tucked: he stands across it on his uphill edge. */
    from: 0.14,
    most: 5,
    way: 3,
    /** The UPHILL EDGE SET: `bite` rad over the slope's own angle, never
     * past `edge` rad — the board edged a little past level across. */
    bite: 0.12,
    edge: 0.9,
    /** THE EDGE EASED OFF: the steer AWAY from the hill past `dead` of
     * full, over `span` of it, flattens the board; its last `over` tips it
     * past flat onto the downhill edge (with the steer full away, `over`
     * of the set edge on the wrong side). The steer toward the hill, or the
     * brake, sets it whole. */
    dead: 0.1,
    span: 0.75,
    over: 0.25,
    /** Eased off past `hold` of the way to flat he slides — the standstill
     * hold lets go, and the edge's own grip is his brake. */
    hold: 0.12,
    /** THE FALLING LEAF: the lean (weight to the front foot, forward)
     * swings the nose `leaf` rad (26°) down off square, at `leafRate` rad/s,
     * and the board slides that way across the hill. */
    leaf: 0.45,
    leafRate: 0.8,
  },
  /** THE CAUGHT DOWNHILL EDGE at a crawl (`board-crash.ts`): the edge
   * leading a slide across the board stood into it past `dig` rad (6°) —
   * the board laid flat or onto it — with the slide at `slip` m/s or more,
   * out of a skid and slower than `most` m/s overall (past it, the fast
   * catch's own `crash.boardDig` / `.catchSlip`). */
  catch: {
    dig: 0.1,
    slip: 1.2,
    most: 7,
  },
  /** THE SLAM: the board stopped dead under him, the body pivots over its
   * edge at the slide's speed over his height, `whip` per m/s across and
   * never less than `least` rad/s, held to `crash.maxSpin` — and a
   * faceplant leaves with `up` m/s off the snow, a slam with none. */
  slam: {
    whip: 1,
    least: 1.6,
    up: 0.3,
  },
  /** BOGGED (`trench.ts`): with no poles, `rock` of a skier's rocking
   * packs the hole back — his hands digging the board free as he rocks it
   * — and each hop (the tuck, in loose snow) packs back `hop` m a second of
   * the `trench.dig` the push digs: hopping alone sinks him slower than a
   * skier's poling, and he rocks out. */
  bog: {
    rock: 0.7,
    hop: 0.05,
  },
} as const;
