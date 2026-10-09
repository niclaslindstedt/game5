// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// IN TOWN ON FOOT — the numbers `town.ts` reads: how a skier who comes into
// the village stops, steps out of his bindings, puts the pair on his
// shoulder and walks the streets in his boots, and how he lays it down and
// steps back in once he is off them.
//
// How a pair is CARRIED, as skiers are taught it: the two skis held base to
// base (their brakes hooked into each other so they stay together), laid
// on ONE shoulder with the TIPS FORWARD and dipped a little, the bindings
// just BEHIND the shoulder — never on it, where they bite — so the flat of
// the lower ski's topsheet rests on it; the hand on that side well out in
// front on top of them, pressing down to balance the tails behind, and the
// two poles in the OTHER hand. Out of a binding the way every alpine one is
// left: the pole's tip pressed down on the lever at the back of the heel
// piece, which pops the heel, and the boot stepped out heel first.

export const TOWN = {
  /** STOPPED ON A STREET: skied onto a street of the village (`onStreet`)
   * he is stood on his edges (the brake held) until he goes no faster than
   * `stopAt` m/s, and out of the bindings from there. */
  stopAt: 0.6,
  /** HOW LONG EACH BEAT TAKES, s: out of both bindings (`out`), the pair
   * picked up, stood on its tails, clapped base to base and swung up onto
   * the shoulder (`pick`), taken off it and laid on the snow (`drop`), and
   * back into both bindings (`clip`). */
  out: 2.1,
  pick: 2.8,
  drop: 2.4,
  clip: 1.5,
  /** STEPPING OUT: how far back off the pair he steps once both boots are
   * out, m — so it lies in front of him to bend for. */
  back: 0.34,
  /** WALKING IN HIS BOOTS (the tuck walks him on, the edge turns him):
   * his pace on the flat, m/s — a walk in stiff ski boots is slower than in
   * shoes; `climb` how much a rising pitch (rise over run) slows it, to
   * `slowest` of it at most; `turn` how fast he turns on the spot, rad/s. */
  walk: 1.35,
  climb: 1.5,
  slowest: 0.45,
  turn: 2.4,
  /** HIS STRIDE, as the figure draws it and the carried pair rides it: a
   * stride every `stride` m walked, the shoulder dipping `bob` m at each
   * heel strike. */
  stride: 1.1,
  bob: 0.025,
  /** THE PAIR STOOD ON ITS TAILS in front of him, clapped base to base, m:
   * `out` to his right, `ahead` in front of him; its bases `gap` apart. */
  upright: { out: 0.15, ahead: 0.36, gap: 0.014 },
  /** THE PAIR ON HIS RIGHT SHOULDER, m and rad: the lower ski's topsheet
   * `shoulder` over the snow, `out` to his right of his middle; the
   * bindings `behind` behind the shoulder (the mount point, the boot's
   * middle — the toe piece just behind it); the tips forward and `tipDown`
   * below level; `thick` a ski's depth, so the upper one's base lies on the
   * lower one's. */
  carry: { shoulder: 1.44, out: 0.21, behind: 0.22, tipDown: 0.2, thick: 0.02 },
} as const;
