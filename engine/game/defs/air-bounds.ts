// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRBORNE EDGE (`TUNING.bounds.air`, read by `collision.ts`'s
// `airBounds`): what turns every craft in the air back from the edge of the
// map — the plane, the helicopter, the paramotor, the balloon and the
// skydiver's canopy. Inside a band along the edge the WIND blows it back in
// and its pilot's hand is turned toward the map's middle; nothing is a wall.
//
//   * the band each craft is met over inside the edge, m — a plane's a
//     turn's diameter at its cruise and a 30° bank (2·v²/(g tan φ) at
//     50 m/s ≈ 880 m), so the turn the hand has fully taken over a sixth
//     of the way in (`plane.ts`) brings it round with a couple of hundred
//     metres to spare; a helicopter's and a
//     balloon's less, a canopy's least — and a skydiver on his body
//     (`skydive`) a track's: 40 m/s turned round at his flat turn's rate;
//   * `wind` the wind that blows it back in at the edge, m/s, growing as
//     the square of how deep in the band it is (and on past the edge);
//   * `low` and `high` the heights over the snow the plane's turn and wind
//     come on over, m: none on the strip and in the climb-out, all of it
//     a safe turn's height up.
export const AIR_BOUNDS = {
  plane: 900,
  heli: 160,
  heliTurn: 6,
  para: 120,
  balloon: 160,
  chute: 100,
  skydive: 320,
  wind: 16,
  low: 40,
  high: 140,
} as const;
