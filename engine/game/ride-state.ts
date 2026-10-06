// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER CARRIED — along a wind tunnel (`wind-tunnel.ts`) or up a lift
// (`lift-ride.ts`) — beside `state.ts`, which re-exports both, so a reader
// asks the one place he always has.

/** A skier carried along a WIND TUNNEL (`wind-tunnel.ts`): which (its
 * place among the resort's tunnels, and its id), where along it he is —
 * the arc, m; how far right of its line, m; the way it blows there, rad —
 * and the station his line was last read from. */
export type TunnelRide = {
  index: number;
  id: string;
  s: number;
  lateral: number;
  heading: number;
  seg: number;
};

/** A skier on a LIFT (`lift-ride.ts`). `board`: skating from where he
 * rode into its load zone or its boarding ring (`from`) up the queue's
 * lane, past the queue, to where it carries him off; `wait`: stood on a
 * drag's track for the next T-bar to come round to him; `ride`: carried,
 * his grip `u` m of plan up the line at `speed` m/s, his chair or cabin
 * swung `swing` rad about the rope (its foot toward the top positive) at
 * `swingRate` rad/s — and stood off at the top, he is the lift's no more.
 * `t` is seconds in the phase; `tower` the next of its supports he has
 * still to pass over. */
export type LiftRide = {
  index: number;
  id: string;
  kind: "gondola" | "chair" | "drag";
  phase: "board" | "wait" | "ride";
  u: number;
  speed: number;
  swing: number;
  swingRate: number;
  t: number;
  tower: number;
  /** Where he came into the zone from (`board`), or where the carrier
   * took him from the snow (`ride`; `y` NaN for a ride not boarded). */
  from: { x: number; y: number; z: number; heading: number };
  /** BOARDING (`board`): the length of the way up the queue's lane to the
   * carrier, m, how far along it he is, m, the pace he skates it at, m/s,
   * and the way he faces, rad. */
  walk?: number;
  s?: number;
  pace?: number;
  head?: number;
  /** Gone into a gondola's station or onto a chair's load line out of
   * sight (`ride`): he is sat in his carrier as it leaves the station — the
   * picture fades out at the door and back in on him sat there. */
  faded?: boolean;
  /** How long the tuck has been held while carried, s, and — once that
   * is long enough — how far into the fade that skips him up the lift he
   * is, s (`skipUp`). */
  held?: number;
  skip?: number;
};
