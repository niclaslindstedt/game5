// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SPEED RACE (R34) as the app reads it: every time it keeps — the run's,
// the board's, the record book's — is the time through the timing zone,
// and every one is shown as the SPEED it is: the zone's length over it.
// Lower is still better, so the field's order, the record book's `beats`
// and the ghost are the engine's and the book's own; only the reading
// turns round.
//
// DOM-free and storage-free: `tests/speed_ski_hud_test.ts` reads it.

/** The speed, km/h, a time of `seconds` through a zone of `zone` m reads as
 * — null for a time that is none. */
export function speedOf(seconds: number | null | undefined, zone: number): number | null {
  return seconds === null || seconds === undefined || !(seconds > 0)
    ? null
    : (zone / seconds) * 3.6;
}

/** A time's gap to the leader's, s, as the speed it costs, km/h — negative
 * is slower; null where either is none. */
export function speedGapOf(
  seconds: number | null | undefined,
  gap: number | null | undefined,
  zone: number,
): number | null {
  const mine = speedOf(seconds, zone);
  const leader = gap === null || gap === undefined ? null : speedOf((seconds ?? 0) - gap, zone);
  return mine === null || leader === null ? null : mine - leader;
}
