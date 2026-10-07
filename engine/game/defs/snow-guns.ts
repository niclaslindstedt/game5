// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW GUNS' NUMBERS — the snowmaking a ski area stands along its runs
// in a thin season (`snow-guns.ts`), each one a measured class's, never a
// make's. RESEARCHED, not guessed:
//
//   * TWO KINDS. A FAN GUN: a short drum 1.0–1.2 m across and 1.2–1.8 m
//     long, a 15–22 kW fan blowing ~20 m/s out through one or two rings of
//     nozzles (and the nucleators that seed the ice), 700–800 kg; on a
//     two-wheeled carriage a snowcat tows into place, or on a column of
//     2–6 m beside its hydrant; tilted up 20–45°, swept side to side through
//     a set arc on its turntable; throws 50–80 m. Housings bright yellow,
//     now and then orange or white, the carriage and the column galvanised.
//     A LANCE: an aluminium tube 5–10 m long and ~0.1 m across, hinged at
//     its foot and leaned ~30° off plumb across the run and down the wind,
//     a small nozzle head 5–10 m over the snow; a fine mist that falls
//     slowly and drifts, 10–35 m. Grey, a coloured band at the head.
//   * WHERE. On the run's WINDWARD edge, so the wind carries the snow over
//     it; 1–5 m outside the groomed width, never on the skiable snow, each
//     at a hydrant pit; a fan gun every 40–100 m (hydrants 76–91 m apart),
//     a lance every 30–46 m; aimed across the piste and a little down it,
//     so the cone lands on the run. The runs from the base, the lower and
//     beginners' slopes and the race courses first: some 30–70 % of a
//     ski area's runs are covered, the greens most and the blacks least.
//   * WHEN. Early in the season (November to the New Year) to build the
//     base, and late in it to patch worn runs — never while it snows, and
//     only cold: a wet bulb under −2 °C. So a spring sun high enough to
//     soften the piste stops them; a gale (past ~12 m/s) turns them off.
//   * WHAT IT LEAVES. A WHALE of machine snow under each: dense (400–500
//     kg/m³), heaped where the cone lands, stretched along the throw — 3 m
//     and more after days in one place, until a snowcat pushes it out. On
//     an open run they are pushed out every night, so what a skier meets is
//     the last hours' heap, held low here: loose, heavy snow he ploughs.

/** The snow guns' layout and the numbers each kind is drawn and felt by. */
export const SNOW_GUN = {
  /** THE THIN SEASONS, as days of the year: early from `early.from` round
   * the New Year to `early.to`, late from `late.from` to `late.to`. */
  season: { early: { from: 305, to: 10 }, late: { from: 50, to: 130 } },
  /** Above this sun, rad (40°), a late season's air is too warm to make
   * snow in — the noon of a spring day; and past this mean wind, m/s, the
   * guns are turned off. */
  warm: (40 * Math.PI) / 180,
  windMost: 12,
  /** The share of a grade's runs that carry guns. */
  cover: { green: 1, blue: 0.85, red: 0.6, black: 0.35 },
  /** The share of covered runs on fan guns (the rest on lances), and the
   * share of fan guns stood on a column (the rest on a carriage). */
  fanShare: 0.65,
  towerShare: 0.4,
  /** The first gun's arc down from the run's head, m. */
  first: 25,
  /** THE FAN GUN, m: a gun every `every` down the run, its foot `out` past
   * the edge; its drum (`radius`, `length`), tipped up `tilt` rad and
   * swept `sweep` rad either side of its aim once every `period` s; the
   * nozzle ring's height over the snow on a carriage and on a column; the
   * throw (`reach`); what a skier meets of it — the carriage's bulk, the
   * column's pole. */
  fan: {
    every: 80,
    out: 4,
    radius: 0.58,
    length: 1.5,
    tilt: (22 * Math.PI) / 180,
    sweep: (30 * Math.PI) / 180,
    period: 75,
    nozzle: { carriage: 1.9, tower: 4.6 },
    reach: 60,
    solid: { carriage: 0.85, tower: 0.16 },
  },
  /** THE LANCE, m: a lance every `every`, its foot `out` past the edge;
   * the tube's `length` and radius, leaned `lean` rad off plumb; the throw. */
  lance: {
    every: 40,
    out: 2.5,
    length: 9,
    radius: 0.055,
    lean: (30 * Math.PI) / 180,
    reach: 22,
    solid: 0.09,
  },
  /** How near a gun stands to a floodlight mast, a trunk, a cabin, another
   * gun (two runs side by side), the finish line and the start, m. */
  clear: { mast: 6, tree: 1.8, cabin: 7, gun: 15, finish: 40, start: 25 },
  /** THE WHALE under a running gun: centred where the cone lands (`land`
   * of the throw out), `along` × the throw long and `across` × the throw
   * wide, `height` m at its crest (a lance's `lance` of it). */
  whale: { land: 0.55, along: 0.3, across: 0.17, height: 0.8, lance: 0.6 },
} as const;
