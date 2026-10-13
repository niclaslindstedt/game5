// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABLE GRIND'S NUMBERS (`cable.ts`): a skier or a rider come down onto a
// lift's rope from above is put on it and slides it, as the arcade
// skateboarders' wires do. Every number is an arcade's or an estimate's, and
// says which.

export const CABLE = {
  /** HOW NEAR THE ROPE HIS FEET MUST COME DOWN, m: across its line either
   * side, and over its top (and how far under it they may already be) —
   * the magnet an arcade's wire has, not the inch a real rope asks for. */
  capture: 0.9,
  above: 0.7,
  below: 0.35,
  /** How fast he may still be climbing as he meets it, m/s — coming DOWN
   * onto it is what puts him on. */
  rising: 0.5,
  /** THE OLLIE ONTO IT: the jump popped under a rope no more than `reach`
   * m over his feet, within `after` s of the pop, throws him up onto it
   * (an arcade's — a skier's pop is a metre, a low rope three or four). */
  ollie: { reach: 4.5, after: 0.35 },
  /** How far from each station's wheel the rope is his, m: inside a
   * station the rope runs into its house. */
  ends: 9,
  /** THE SLIDE: Coulomb friction of a ski's base on a greased steel haul
   * rope (est., a rail's), against the rope's own way — a rope runs, so it
   * drags a skier slower than it along with it. */
  friction: 0.09,
  /** The drag area of a skier stood up on it, m², and his mass, kg — the
   * air's share of his slow (a jib's). */
  drag: 0.7,
  mass: 80,
  /** THE SWAP, THE PRESS AND THE TURN, as on a rail (`JIBS`). */
  tap: 0.6,
  rate: 12,
  press: 0.5,
  /** THE POP off it, m/s up — the jump let go on it: high enough to clear
   * a chair's grip coming at him and land back on the rope behind it (an
   * arcade's). */
  pop: 4.2,
  /** HOW CLOSE A CARRIER'S GRIP MAY COME along the rope before it takes
   * his skis and throws him off, m, and how much of its speed it gives him
   * as it does. */
  reach: 1.1,
  shove: 1,
  /** POINTS: what a second on the rope is worth to the combo, and what
   * the grind is worth as an element the moment he is on (`tricks.ts`). */
  perSecond: 120,
  element: 150,
} as const;
