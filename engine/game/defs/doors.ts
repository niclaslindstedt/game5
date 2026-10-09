// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DOOR OPENED — the numbers `doorway.ts` reads: where a skier stands to
// open one, how long each part of the move takes, how far and how fast the
// leaf swings and how its closer brings it back. Restated from the research
// in `docs/buildings.md` § Doors, in our own numbers:
//
//   * a lever stands about a metre over the floor (the accessible band is
//     0.86–1.22 m), and wants a short press down to draw the latch;
//   * a person pushes a door through its first half in about a second, and
//     its closer takes at least five seconds to bring it from 90° to 12°,
//     then latches it in the last stretch a little quicker — never slammed;
//   * a door is held open only while someone is in it; a closer has no
//     delay of its own, the leaf turns back as soon as it is let go.
//
// Metres, seconds and radians.

export const DOOR = {
  /** WHO MAY OPEN ONE: within `reach` m of the doorway's middle on either
   * side, going no faster than `slowest` m/s, turned no further than
   * `facing` rad from the door. */
  reach: 2.6,
  slowest: 1.6,
  facing: 1.6,
  /** WHERE HE STANDS: before a leaf he pushes, `push.out` m off its face
   * and `push.in` m in from its latch edge toward its hinge; beside one he
   * pulls, `pull.out` m off it and `pull.past` m past the latch edge — clear
   * of the leaf's sweep — stepping back to `pull.back` m as he draws it. */
  push: { out: 0.72, in: 0.28 },
  pull: { out: 0.6, past: 0.36, back: 0.95 },
  /** THE LEVER: `lever.y` m over the floor, `lever.inset` m in from the
   * leaf's latch edge. */
  lever: { y: 1.0, inset: 0.07 },
  /** THE MOVE, s: shuffled to the handle at `shuffle` m/s (at least
   * `least` s, at most `most`); the hand to the lever over `reach` s;
   * pressed down over `press` s (the latch drawn at its end); the leaf
   * pushed or drawn through its first `hand` of its swing on the hand, then
   * stepped through behind it at `through` m/s, starting `wait` s after the
   * leaf began to move. */
  time: {
    shuffle: 0.9,
    least: 0.35,
    most: 2.5,
    reach: 0.45,
    press: 0.3,
    wait: 0.55,
    through: 1.3,
  },
  /** THE LEAF: swung `open` rad (a hinged leaf) over `swing` s, eased in
   * and out; held while he is within `clear` m of the doorway and for
   * `dwell` s after; then its closer brings it back over `close` s, the
   * last `latch` share of that quicker, and it latches. A roller door
   * rolls up `roll` of its height over `rollUp` s and down over `rollDown`.
   * It is passable (no solid) past `pass` of its opening. */
  leaf: {
    open: 1.65,
    swing: 1.5,
    hand: 0.4,
    clear: 1.3,
    dwell: 0.8,
    close: 6.5,
    latch: 0.15,
    roll: 0.62,
    rollUp: 2.6,
    rollDown: 4,
    pass: 0.45,
  },
  /** Where he stands once through: `inside` m past the doorway's face. */
  inside: 1.5,
} as const;
