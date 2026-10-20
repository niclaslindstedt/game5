// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND WAVES (`army-wave.ts`): the columns of troops the wanted level
// sends UP THE MOUNTAIN from the valley (`WANTED.waves`, read with
// `groundWave`) — how many may be out at once, where a column dismounts
// and forms up, how it climbs, and when a man leaves the column to fight.
// Every number carries its unit; `docs/army.md` § *Ground waves* gives the
// reasoning beside each block.
//
// THE PATTERN is a foot column's in the mountains, restated for a ski
// area: trucks bring the troops up the valley's roads as far as they go
// and the men DISMOUNT out of the enemy's sight, form up in a column of
// files, and climb the easiest line there is — here the ski area's own
// runs and cat tracks, which are packed and graded — on skis with skins or
// slogging on foot in their boots, toward where he was last seen. Near
// enough to fight, a man leaves the column and goes after him as every
// soldier on the ground does (`army-ground.ts`).

export const ARMY_WAVE = {
  /** THE MOST MEN OF THE WAVES OUT AT ONCE, by stars (index = stars): the
   * engine's bound on what the waves cost a step. A wave that would put
   * more out puts what the bound leaves room for. */
  most: [0, 0, 24, 48, 96, 160] as readonly number[],
  /** THE SNOWMOBILES the waves keep out on top of the roster's, at the
   * most (each is a whole sled body on the snow's physics). */
  sleds: 5,

  /** WHERE A COLUMN DISMOUNTS: `start` m down the way up from him (along
   * the runs, not as the crow flies) — and further, every `sample` m, while
   * he could see the place it forms up on, to `hidden` m at the most —
   * and never nearer him than `apart` m as the crow flies (a run winds
   * back on itself). Where the way ends nearer him than that, it is
   * carried on down the fall line. */
  start: 380,
  apart: 300,
  hidden: 720,
  /** The way up's points are kept every `sample` m. */
  sample: 8,
  /** THE COLUMN: up to `abreast` men across, `gap` m apart (no wider than
   * the run they climb, less `margin` m each side), ranks `rank` m apart
   * down the way. Every `slog`th man is on foot; the rest climb on skis
   * with skins. */
  abreast: 5,
  gap: 3.2,
  margin: 2,
  rank: 4.5,
  slog: 3,
  /** THE CLIMB: a man takes the next point of the way up once he is within
   * `reach` m of it (or past it); the way he climbs is the ground's own
   * (`army-troop.ts`: the skins' herringbone and traverse, the boots'
   * slog). */
  reach: 6,
  /** TO THE FIGHT: a man leaves the column and goes after him once he is
   * within `engage` m of where he was last seen, or sees him within a
   * rifle's range (or the way up is climbed). */
  engage: 220,

  /** SENT HOME: a man of a wave further than `behind` m from where he was
   * last seen while the hunt runs, or — the hunt over — further than
   * `home` m from him, is taken off the map: out of the fight, and out of
   * the step's cost. */
  behind: 1100,
  home: 450,

  /** At most this many of a wave's men close round a man arrested (the
   * rest stand where they are). */
  cover: 12,
  /** Within this many metres of the arrest a man of a wave closes round
   * him. */
  coverNear: 60,
  /** ...and the rest of them come up to a ring `near` to `far` m round
   * him (each at his own), at `pace` m/s at the most, and stand there. */
  ring: { near: 9, far: 40, pace: 4 },
} as const;
