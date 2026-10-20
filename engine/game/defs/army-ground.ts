// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY ON THE GROUND (`army-ground.ts`, `army-land.ts`,
// `army-troop.ts`, `army-lift.ts`): the soldiers the wanted level's roster
// sends after a man on the snow (`WANTED.roster`'s `soldiers` and
// `lifted`), and how the helicopters put them down. Every number carries
// its unit; `docs/army.md` § *On the ground* gives the reasoning beside
// each block.
//
// THE PATTERN is the air assault's, restated for a mountain: a utility
// helicopter carries a section; it lands where the ground lets it (a
// helicopter is set down on no more than a few degrees of slope — most
// types' flight manuals allow some 5–8°, and roll over at 15–18° — and
// never under or among trees), the men jump out and run to either side of
// it, kneel facing out until it has lifted, and then go after him. Where
// it cannot land it hovers and they come down a FAST ROPE — a thick rope
// slid hand under hand from 10–15 m. A section left behind is picked up
// again and set down ahead of him: the leapfrog every air-mobile force
// fights by.
//
// ON SKIS a soldier is a winter infantryman on long touring skis with a
// heavy pack: he skis well, not fast — a disciplined descent, checked to a
// pace he can stop from and shoot — skates the flats, climbs short rises in
// a herringbone and long ones in a traverse. He fires off one knee or
// stood on his skis, the poles let hang, as winter troops are taught.
//
// SAFE FOR WORK (the INJURIES switch off) they never wound him: the
// gunfire's warning fire, then the arrest — he is put face down in the
// snow, a knee on his back and his hands behind it, as any police or
// military arrest is made — which ends the run.

export const ARMY_GROUND = {
  /** THE SECTION a helicopter carries, men (the class seats about ten
   * behind its two gunners), and the most it puts down at once is what
   * the roster still asks for. */
  section: 8,

  /** THE LANDING: the ring round him it looks for a place in, m (nearer
   * than `near` the men land on top of him, further than `far` they are
   * out of the fight), the distance it prefers, m, and how much it prefers
   * a place AHEAD of him downhill — where he is going — over one behind,
   * m of cost; the search's grid, m; the most the ground may lean over the
   * disc's circle, as a slope (0.12, some 7°, a flight manual's limit);
   * the room clear of trees, posts, lifts and water round it, m past the
   * disc; and how far he may be from a place before a man is out on it,
   * m, before the landing is given up and a new place asked for. */
  land: { near: 60, far: 280, prefer: 120, ahead: 60, grid: 8, slope: 0.12, room: 4, stale: 450 },
  /** THE FAST ROPE where it cannot land: the place under it clear of
   * trunks this far round, m; the hover it is slid from over the snow, m
   * (never under the flight's floor over the woods); a man slides it at
   * `slide` m/s and the next follows `gap` s after. */
  rope: { clear: 5, hover: 13, slide: 4, gap: 1.2 },
  /** THE APPROACH: braked to the spot at no more than `decel` m/s² (a
   * flare's), down to `slow` m/s; held `over` m above it until within
   * `within` m of it, then sunk at `sink` m/s onto it; `climb` m/s back
   * off it. */
  approach: { decel: 4, slow: 2, over: 20, within: 6, sink: 4, climb: 6 },
  /** OUT OF THE DOORS: a man every `every` s from each door, run `run` m
   * out to his side, knelt facing out until the machine has lifted. The
   * machine waits `linger` s after the last is clear, and gives up on a
   * pick-up after `wait` s. */
  dismount: { every: 0.7, run: 9, linger: 1.5, wait: 45 },

  /** THE LEAPFROG: a squad whose every man is further than `recall` m from
   * where he was last seen for `after` s is picked up and put down again
   * ahead of him. */
  recall: 350,
  after: 15,

  /** ON SKIS: the pace he holds, m/s (a disciplined descent with a pack —
   * about 60 km/h at the most), checked at `brake` m/s²; the tightest
   * turn he skis, m; the snow's and the air's drag (the crowd's, an
   * amateur's skis on the same snow); the push of his poles and his
   * skating where the hill does not carry him, m/s²; and his pace on the
   * flat and up a rise: `skate` m/s on the flat, falling by `climb` m/s
   * for every unit of slope against him to `least` m/s (a herringbone's,
   * a traverse's on skins), and a rise steeper than `traverse` (a slope)
   * climbed across it, zig-zagging every `zig` s. */
  ski: {
    pace: 16,
    brake: 4,
    turn: 7,
    snow: 0.45,
    air: 0.0035,
    push: 1.2,
    skate: 3.4,
    climb: 7,
    least: 0.7,
    traverse: 0.45,
    zig: 7,
  },
  /** ON FOOT (the anti-armour man, who carries his launcher rather than
   * skis): his walk on the flat and down a slope, m/s, and up one. */
  foot: { walk: 1.6, least: 0.5 },
  /** KEEPING CLEAR: of trunks and posts, m past their radius, looked for
   * `ahead` m along his way; of each other, m. */
  clear: { solid: 1.2, ahead: 9, apart: 2.5 },
  /** NOT GETTING STUCK: his progress checked every `window` s; under
   * `least` m in one and he steps off sideways for `detour` s. */
  stuck: { window: 4, least: 1.5, detour: 3 },

  /** THE FIRE: a rifleman stops to fire within `range` m with him in
   * sight; settles `settle` s (stood) or `kneel` s (off one knee, taken on
   * ground leaning under `flat`, a slope); fires up to `bursts` bursts or
   * for `hold` s, then moves on for `move` to `move` + `spread` s before he
   * stops again. With SAFE FOR WORK on, within `rush` m of him he stops
   * firing and runs him down. The rocketeer's range, m. */
  fire: {
    range: 260,
    settle: 0.7,
    kneel: 1.2,
    flat: 0.35,
    bursts: 3,
    hold: 6,
    move: 5,
    spread: 4,
    rush: 45,
    rocket: 300,
  },
  /** The anti-armour man comes with a section from this many stars. */
  rocketFrom: 4,
  /** His muzzle over his feet, m: stood, knelt. */
  muzzle: { stand: 1.45, kneel: 0.95 },

  /** THE ARREST (SAFE FOR WORK on): a soldier within `WANTED.arrest.reach`
   * of him takes him if he is slower than `speed` m/s or down; he is put
   * face down over `settle` s and held there. The rest close round him
   * `ring` m off, their rifles on him. */
  arrest: { speed: 3, settle: 0.8, ring: 3.5 },

  /** BODY ON BODY: a soldier and his kit, kg; knocked down by the player
   * he is up again `back` s after (`foot.ts`). */
  mass: 105,

  /** UP THE LIFTS: from the first star that asks for them, a squad of
   * `squad` is dropped at a lift's foot `respond` s after the roster asks
   * (another every `every` s while the roster is short), at the far end of
   * its queue's lane; the lift taken is the one whose top is nearest him
   * and at least `above` m over him. */
  lift: { squad: 4, respond: 20, every: 30, above: 30, lane: 18 },

  /** Ids: soldiers are pursuers `pursuer` + n; their guns `gun` + n; a
   * man knocked down is a person on foot keyed `key` + n. */
  ids: { pursuer: 2000, gun: 3000, key: 2_000_000 },
} as const;
