// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE THROUGH A DAY's numbers (`piste-day.ts`, `docs/riding.md`): how
// the ski area's runs go from the night's corduroy at the first chair to the
// skied-up afternoon, what a fall lays on them meanwhile, what a spring sun
// does to them and how they freeze again when it goes. Every number carries
// its unit; the hours are SOLAR hours, the map's own (R15).
//
// The sources are the working day of a ski area — the machines finish their
// night's pass before dawn, the lifts turn from about nine to half past four
// — and the snow's own: groomed snow is skied off its comb in a few hours of
// traffic, the loose snow scraped off it heaped at the turns; a fall over a
// piste in use is skied in as it lands, so what lies on it loose is a
// balance of the fall against the traffic rather than the whole of it; and
// a groomer softens only under a high sun (a spring one — a midwinter noon
// sun does not reach it), going hard and glassy again within an hour or two
// of the sun leaving it.

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
  /** THE WEAR: hours of full traffic that skis `1 − 1/e` of the comb off. */
  wear: 4,
  /** THE NEW SNOW skied in: hours of full traffic over which the loose
   * layer a fall leaves on a piste in use settles toward its rate times
   * this — before the first chair it all lies. */
  pack: 3,
  /** THE SUN'S WARMTH on a groomer: nothing under `from` of elevation, rad;
   * over it, the sine's excess warms the surface, which cools back with
   * `cool` h; `soft` is the warmth over which it is slush through (0..1
   * eased between). A lid over the sun takes its share (`lid`). */
  sun: {
    from: (15 * Math.PI) / 180,
    cool: 1.5,
    soft: { from: 0.12, full: 0.6 },
    lid: {
      clear: 1,
      fair: 0.9,
      high: 0.7,
      overcast: 0.35,
      fog: 0.35,
      flurries: 0,
      snow: 0,
      storm: 0,
    },
  },
  /** The integration's step through the day, h. */
  step: 0.25,
  /** WHAT EACH DOES TO THE PHYSICS. `loose`: the share of a groomer's pack
   * a worn piste (all of it), and a slushed one, read as loose snow — the
   * sink, the drag and the base's grip of the loose share, the edge's of the
   * rest (`packedUnder`). `ice`: the share of bare ice's grip (`grip.ice`)
   * a refrozen groomer stands at (`onIce`). */
  loose: { worn: 0.22, soft: 0.35, most: 0.5 },
  ice: 0.4,
} as const;
