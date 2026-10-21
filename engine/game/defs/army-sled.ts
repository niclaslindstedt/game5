// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S SNOWMOBILES (`army-sled.ts`): the military over-snow sleds the
// wanted level's roster sends after a man on the snow
// (`WANTED.roster`'s `snowmobiles`). Every number carries its unit;
// `docs/army.md` § *On snowmobiles* gives the reasoning beside each block.
//
// THE PATTERN is the way winter troops use a light over-snow machine: a
// utility snowmobile, two up — a driver and a man behind him — that moves
// a pair of riflemen fast over open snow and stops to let them fight. A
// machine on the move is a poor gun platform (the seat bucks under every
// bump), so the man behind fires from a SHORT HALT: the driver turns the
// nose at the target, brakes to a stop, the gunner fires a few bursts off
// the pillion and they drive on before the target can answer. A skier who
// keeps moving, keeps something between him and them and makes them stop
// often is hard to hit from one.
//
// THE MACHINE is the free ride's own (`defs/sled.ts`, `sled-body.ts`): the
// same body, belt and engine, stepped on the same snow, carrying two men
// with their kit and the gun.

export const ARMY_SLED = {
  /** THE CALL: seconds from the roster asking for a machine to it leaving
   * the village (the crew mounting up), and the seconds between one and
   * the next. They come from the snowmobile's spot beside the village
   * (`sledSpotOf`), each `apart` m to the side of the one before. */
  respond: 20,
  stagger: 8,
  apart: 5,

  /** THE CREW: two men, each with his kit (`ARMY_GROUND.mass`), and the
   * gun, its ammunition and the crew's packs on the rack, kg. */
  crew: 2,
  load: 40,

  /** THE DRIVE (`sledPilot`'s hands, to an aim the terrain reading picks):
   *   * `cruise` the pace over open snow, m/s (some 60 km/h — a laden
   *     utility machine on a mountain, not a racer); `woods` among trees;
   *     `close` the pace it closes on him at from within `slow` m;
   *   * `look` how far ahead it reads the snow, m, sampled every `step` m;
   *     `fan` the headings it weighs either side of the way to him, each
   *     `spread` rad / `fan` apart; it chooses again every `decide` s;
   *   * `lead` how far ahead of him it aims, s of his way. */
  drive: {
    cruise: 17,
    woods: 8,
    close: 6,
    slow: 60,
    look: 36,
    step: 6,
    fan: 9,
    spread: 1.6,
    decide: 0.1,
    lead: 1,
  },
  /** READING THE TERRAIN: a rise steeper than `climb` (a slope) is more
   * than a laden machine climbs; a drop steeper than `cliff` it will not
   * ride off; open water within `water` m, a wind tunnel's tube within
   * `tunnel` m, a trunk within `trunk` m of its line and the map's edge
   * within `edge` m are no way at all. A heading
   * costs `turn` for every radian off the way to him, `blocked` a metre
   * short of `look` it is stopped, `tree` a trunk near its line, and
   * `keep` for leaving the heading it holds. */
  terrain: {
    climb: 0.75,
    cliff: 0.9,
    water: 6,
    tunnel: 3,
    trunk: 3,
    edge: 40,
    turn: 6,
    blocked: 1.2,
    tree: 4,
    keep: 1.5,
  },
  /** THE SHORT HALT: with him in sight and nearer than `range` m (but not
   * nearer than `least`), it stops to fire once it may (`next`): braked to
   * under `still` m/s, the gunner settles `settle` s and fires up to
   * `bursts` bursts or for `hold` s, then they drive on for `move` to
   * `move` + `spread` s before stopping again. Out of sight `lost` s, the
   * halt is broken off. It stops with him `side` rad off its nose to the
   * right — the gunner's side, his line clear of the driver's head. */
  halt: {
    range: 380,
    side: 1.0,
    least: 20,
    still: 1.5,
    settle: 1.5,
    bursts: 3,
    hold: 8,
    move: 6,
    spread: 5,
    lost: 1.5,
  },
  /** HOW CLOSE IT COMES: with the army shooting to kill it keeps `lethal`
   * m off him (the gun does the work); with SAFE FOR WORK on it drives up
   * to `sfw` m and the crew get off to take him in — `dismount` m from
   * him once he is slower than `ARMY_GROUND.arrest.speed` or down. */
  stand: { lethal: 110, sfw: 7, dismount: 14 },
  /** THE GUN on the pillion: the gunner's light machine gun
   * (`WEAPONS.lmg`) at his shoulder — the muzzle over the sled's body
   * frame (`muzzle`, m: right, up, forward of its centre of gravity), how
   * far he can turn it off the nose either side, rad (the driver's
   * shoulders are dead ahead and his own hips stop him past the side),
   * the most it depresses and lifts, rad, and how fast he turns it,
   * rad/s. */
  gun: {
    muzzle: { x: 0.32, y: 0.85, z: 0.3 },
    arc: 1.7,
    low: -0.5,
    high: 0.5,
    turn: 2.5,
  },
  /** WHERE THE CREW SIT, body frame, m (right, up, forward of the centre of
   * gravity): the driver on the seat, the gunner on the pillion behind
   * him — what the player's body meets when he knocks them off, and where
   * a man stepping off is put down. */
  seats: {
    driver: { x: 0, y: 0.25, z: 0.05 },
    gunner: { x: 0, y: 0.32, z: -0.5 },
  },
  /** THE MACHINE'S PLAN as a box the skier is held out of: half its
   * length and width, m, and its top over the snow, m. */
  hull: { halfLength: 1.6, halfWidth: 0.55, height: 1.1 },
  /** OVER ON ITS SIDE: the crew right it after `right` s on its side, and
   * it rests `rest` s before driving on. */
  over: { right: 1.5, rest: 3 },
  /** NOT GETTING STUCK: its progress checked every `window` s; under
   * `least` m in one it swings off to a side for `detour` s; a second
   * window and the crew dig it out, stood `dig` m back on open snow
   * facing him. A third is STUCK, which the lab counts and must be 0. */
  stuck: { window: 4, least: 2, detour: 3, dig: 6 },
  /** HOME: the hunt over, it drives back to the village and is gone
   * within `gone` m of its spot, or after `home` s. Machines left standing
   * empty are kept up to `empty`, the oldest let go first. */
  home: 150,
  gone: 25,
  empty: 3,
  /** Ids: the crews are pursuers `pursuer` + n; the gunners' guns
   * `gun` + n. */
  ids: { pursuer: 5000, gun: 90_000 },
} as const;
