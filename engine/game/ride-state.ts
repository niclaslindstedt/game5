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
 * drag's track for the next T-bar to come round to him, or on a gondola's
 * platform while his cabin comes round the wheel to him (`u` then the
 * station rail's, `lift-board.ts`'s `railAt`); `ride`: carried,
 * his grip `u` m of plan up the line at `speed` m/s, his chair or cabin
 * swung `swing` rad about the rope (its foot toward the top positive) as
 * the clock swings every carrier (`carrier-swing.ts`) — and stood off at
 * the top, he is the lift's no more.
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
  /** Whether he came in by the boarding ring rather than the load zone;
   * whether he has set off along the way — before it he turns to it on his
   * own line (`lift-board.ts`'s `setOut`) — and, stepping his skis round on
   * the spot, the way he steps (±1) and how far into the pair he is, 0..1. */
  ringed?: boolean;
  set?: boolean;
  pivot?: number;
  pair?: number;
  /** Gone into a gondola's station or onto a chair's load line out of
   * sight (`ride`): he is sat in his carrier as it leaves the station — the
   * picture fades out at the door and back in on him sat there. */
  faded?: boolean;
  /** THE CARRIER HE IS ON — the lift's own (`lift-line.ts`'s
   * `carrierAt`'s `k`) — once a chair has scooped him off its load line or
   * a T-bar taken him: a chair carries him wherever the clock has it; a
   * T-bar's grip runs on ahead of him on the rope while its cord pays out
   * of the spring box (`u` is his, the bar's). Left out on a carrier of his
   * own (a gondola's cabin). */
  carrier?: number;
  /** WAITING ON A CHAIR'S LOAD LINE OR A DRAG'S TRACK: how long till the
   * carrier that will take him comes to him, s — what he looks back over
   * his shoulder for (the pose reads it). */
  due?: number;
  /** STANDING UP OFF A CHAIR at its unload, s since the chair came to the
   * unload point: his skis on the ramp, he rises off the seat and slides
   * on ahead of it, turned off the line to the up rope's side, the lift
   * letting him go once he is up (`lift.rise`). */
  stand?: number;
  /** How long the tuck has been held while carried, s, and — once that
   * is long enough — how far into the fade that skips him up the lift he
   * is, s (`skipUp`). */
  held?: number;
  skip?: number;
};
