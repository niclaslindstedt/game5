// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MACHINE's numbers (`groomer.ts`, `docs/piste-machine.md`): the
// big tracked snow groomer that works the runs at night. Every number
// carries its unit.
//
// THE CLASS, measured across the current machines of the largest size a ski
// area runs (the class, never a make): a rubber-belted crawler some 8.9 m
// long with its blade and tiller on, 4.2 m wide over two tracks 1.65 m
// across, the cab's roof some 2.9–3.3 m over the snow; 10.8–13.2 t ready to
// work (with a winch boom on the back, 14.5 t); a twelve-way blade 5.25 m
// wide open (4.4 m closed) and some 1.2 m tall; a tiller 5.5–6.2 m wide with
// its finisher flaps, the comb's corduroy behind it; a six-cylinder diesel of
// some 340 kW; grooming at 10–15 km/h and travelling at about 20–23 km/h at
// most; and a roof bar and a front of LED work lamps, with an amber beacon
// on the roof.
//
// The frame is the engine's: x right (the side the screen draws on the
// driver's left — the renderer's frame mirrors the map), y up, z forward,
// the origin on the snow under the middle of the tracks.

export const GROOMER = {
  /** How many machines work a night's ski area, at most: one a run, never
   * two on the same run. */
  count: 2,
  /** The shortest run one is set to, m. */
  shortest: 250,
  /** THE MACHINE, m: the tracks' run on the snow and their width, the
   * width over both, the blade's face ahead of the middle and its width
   * open, the tiller's end behind the middle and its width with the
   * finishers out, the cab's roof over the snow. */
  tracks: { length: 4.6, width: 1.65, span: 4.21 },
  blade: { ahead: 4.0, width: 5.25, height: 1.2 },
  tiller: { behind: 4.9, width: 5.5 },
  roof: 3.0,
  /** Ready to work, kg. */
  mass: 12000,
  /** THE FOOTPRINT a skier meets, m: from the blade's face to the tiller's
   * end, and half the widest of blade and tiller. */
  front: 4.0,
  back: 4.9,
  half: 2.75,
  /** THE PACE, m/s: grooming down a run (12 km/h), climbing one (9 km/h),
   * and the most it makes driven (22 km/h) — forward, and in reverse.
   * Gathered and shed at `accel` m/s². */
  work: 3.3,
  climb: 2.5,
  most: 6.1,
  reverse: 2.8,
  accel: 0.9,
  /** THE PIVOT: a crawler turns on its tracks, the one run against the
   * other — at most this fast, rad/s, standing or moving. */
  turn: 0.42,
  /** THE GROOMED SWATH: the tiller's width as it is laid down, m, and the
   * lanes it is worked in — this much of the swath overlaps the last. */
  swath: 5.2,
  overlap: 0.6,
  /** How far inside each end of its run a pass turns, m — clear of the
   * station at the top and of the runs met at the bottom. */
  margin: 18,
  /** How far one swath point is laid from the last, m. */
  step: 2,
  /** A NIGHT'S WORK BEFORE THE SKIER COMES: the most lanes the machine has
   * already finished when the run starts, and the most of the pass it is
   * on, as a share of the run. */
  doneLanes: 3,
  /** The sun under this, rad, is a night the machines work (2° up — the
   * dusk the lamps are lit by). */
  night: 0.035,
  /** TAKEN: the machine press within `reach` m of its footprint, the skier
   * slower than `fastest` m/s against it. */
  board: { reach: 3, fastest: 4 },
  /** Where the driver sits: over the snow and ahead of the middle, m. */
  seat: { y: 2.05, z: 0.9 },
  /** Stepped down out of the cab: this far out to its left, m. */
  hop: 1.4,
  /** RIDDEN INTO: a skier meeting its footprint closing slower than
   * `push` m/s is held off it, as off a wall; faster, he is knocked down
   * (the `groomer` crash cause) and thrown back off it at `bounce` of the
   * closing speed. The blow on the body is taken at `least` m/s at the
   * least, `hard` times over — twelve tonnes of steel do not give — and
   * against `give` m of the blade's give. */
  strike: { push: 2.5, bounce: 0.35, least: 8, hard: 1.3, give: 0.015 },
} as const;
