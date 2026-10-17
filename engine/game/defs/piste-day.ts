// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE THROUGH A DAY's numbers (`piste-day.ts`, `docs/riding.md`): how
// much traffic the ski area's runs have taken by the hour a free ride is
// stood up, and what a fall lays on them meanwhile. Every number carries
// its unit; the hours are SOLAR hours, the map's own (R15).
//
// The sources are the working day of a ski area — the machines finish their
// night's pass before dawn, the lifts turn from about nine to half past four
// — and the snow's own: a fall over a piste in use is skied in as it lands,
// so what lies on it loose is a balance of the fall against the traffic
// rather than the whole of it.
//
// The day never takes the grip away: no slush, no evening refreeze, no
// skied-off loose layer under the edge — the runs ski as the groomer they
// are at any hour, so an evening run keeps its traction.

export const PISTE_DAY = {
  /** The night's last pass done, solar hour — the machines are on the runs
   * until just before the first chair: before this the runs are theirs,
   * groomed and untouched. */
  groomed: 8,
  /** The lifts, solar hours: the first chair, and the last. */
  open: 9,
  close: 16.5,
  /** The share of the day's traffic still on the runs after the last chair
   * (the stragglers, a floodlit run's evening skiers). */
  after: 0.3,
  /** THE WEAR, as drawn: hours of full traffic that skis `1 − 1/e` of the
   * comb off the look of the corduroy. */
  wear: 4,
  /** THE NEW SNOW skied in: hours of full traffic over which the loose
   * layer a fall leaves on a piste in use settles toward its rate times
   * this — before the first chair it all lies. */
  pack: 3,
  /** The integration's step through the day, h. */
  step: 0.25,
} as const;
