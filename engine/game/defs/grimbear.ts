// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRIMBEAR's numbers (`grimbear.ts`): the thing in the woods a free
// ride meets now and then — a bear's shaggy bulk and head on a man's
// stride. Every number carries its unit.

export const GRIMBEAR = {
  /** Seconds of the ride before he lies in wait the first time, and
   * between one sighting and the next, s (low, high — dealt off his own
   * stream). */
  firstAfter: [20, 60] as const,
  againAfter: [70, 160] as const,
  /** How often a hunt with no tree to hide behind looks again, s. */
  retry: 1,
  /** THE AMBUSH: a trunk this far ahead along the way the skier is going,
   * m, and this far beside his line — not on it, where he would ski into
   * it, and not so far he would never pass it. `aim` is the offset he
   * likes best. */
  ahead: [50, 95] as const,
  lateral: [5, 16] as const,
  aim: 9,
  /** The radius searched round each point ahead for a trunk, m. */
  search: 20,
  /** How far behind the trunk he stands, past its bark, m — the trunk
   * between him and the skier coming. */
  hide: 0.9,
  /** The slowest skier he lies in wait for, m/s: a crawl is never met. */
  minSpeed: 5,
  /** He gives a hiding place up when the skier is this far off, m, or
   * already past it by `passed` m. */
  giveUp: 150,
  passed: 6,
  /** He breaks cover when the skier is this many seconds from passing
   * him, or nearer than `near` m: a hunt in good time to meet him, a chase
   * only as he goes by, to run after him. */
  trigger: { hunt: 2.4, chase: 0.6 },
  near: { hunt: 28, chase: 12 },
  /** THE RUN: a sprinter's top speed, m/s, reached at `accel` m/s², and
   * turned at most `turn` rad/s. A hunt is not held to it: he runs the
   * skier down at `outrun` times the skier's own speed, whatever it is. */
  sprint: 11,
  accel: 9,
  turn: 5,
  outrun: 1.3,
  /** How far ahead along the skier's way he aims, s at most. */
  lead: 2.5,
  /** A CHASE (every sighting after the catch): he runs after the skier, at
   * a point `short` m behind him, at `share` of his speed at most, for
   * `chaseFor` s, and pulls up short `short` m off him whatever happens. */
  share: 0.8,
  chaseFor: 5,
  short: 5,
  /** A hunt that has not caught him in this long lets him go, s. */
  huntFor: 14,
  /** THE CATCH: how near he has to come, m. */
  reach: 1.4,
  /** THE MISS: the share of his runs at the skier that miss him, dealt at
   * each burst off his own stream. A miss is seen: at `lunge` m he dives
   * at a spot `wide` m to his own side of where the skier will be and
   * `behind` m behind it, at `dive` times his pace, never nearer him than
   * `clear` m however he turns — swipes the air there and stumbles on
   * past, slowing at `skid` m/s² from `diveFor` s in, and pulls up roaring
   * after `missFor` s. A run that misses leaves him hunting the next
   * time. */
  miss: 0.8,
  lunge: 3.2,
  wide: 2.2,
  behind: 1.2,
  dive: 1.15,
  clear: 1.8,
  diveFor: 0.35,
  skid: 12,
  missFor: 1.5,
  /** How long he stands over the skier, s, then walks off at `walk` m/s
   * for `leaveFor` s, or until he is `gone` m away. */
  maulFor: 4,
  walk: 1.6,
  leaveFor: 14,
  gone: 60,
  /** How long he stands roaring after a chase he gave up, s. */
  haltFor: 1.8,
  /** How long the skier lies after the catch before he is stood back up
   * at the top of the slope, s — long enough to see him walk away. */
  lieFor: 9,
  /** What the skier keeps of his own speed when he is taken, and what he
   * is given of the beast's. */
  keep: 0.12,
  shove: 0.12,
} as const;
