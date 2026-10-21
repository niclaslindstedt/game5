// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S PARAMOTORS AND BALLOONS (`army-para.ts`, `army-balloon.ts`):
// the riflemen the wanted level's roster flies in on paramotors and the
// rocketeers it drifts in under hot-air balloons (`WANTED.roster`'s
// `paramotors`, `balloons` and `rocketeers`). Every number carries its
// unit; `docs/army.md` § *Paramotors and balloons* gives the reasoning
// beside each block.
//
// THE PARAMOTOR is the game's own (`PARA`): the same wing on the same
// lines, the same polar, the same engine, flown by the canopy's maths
// (`canopy.ts`) — with a soldier in the harness instead of the skier.
// Armies have flown foot-launched powered paragliders for years for
// quiet insertion and border patrol; a rifleman under one is a slow,
// steady platform that can circle a man on the snow far out of a skier's
// reach.
//
// THE BALLOON is the game's own (`BALLOON`), flown by the same heat and
// drift (`flyBalloon`) under the same up-valley wind: a balloon steers by
// nothing but its height, so the army lets it go UPWIND of him and it
// drifts in over the mountain to him, the pilot choosing the layer whose
// wind carries it closest. The men in its basket fire shoulder-launched
// rockets (`WEAPONS.rocket`) down at him.

export const ARMY_AIR = {
  /** THE ESCALATION on top of the roster: one more paramotor and one more
   * balloon out for every `every` s he has held the star he carries, to
   * at most `paramotors` and `balloons` at once — the longer he lasts,
   * the more of the sky is theirs. */
  grow: { every: 75, paramotors: 6, balloons: 3 },

  /** THE PARAMOTOR. */
  para: {
    /** THE CALL: seconds from the roster asking to the first coming in
     * (launched off a road or a ridge on its bearing), and between one and
     * the next; m inside the map's edge at the most, and no further than
     * `near` m from him — a wing that crawls at 15 m/s is launched within
     * reach — and the height over the snow it comes in at, m. */
    respond: 20,
    stagger: 6,
    inset: 70,
    near: 750,
    enter: 90,
    /** THE WIND IT FLIES IN: a wing trimmed near 15 m/s cannot hold a
     * circle in a wind past about two thirds of that — a pilot stays on
     * the ground (`most`, m/s at 10 m over him). */
    most: 9,
    /** THE WING'S TRIM, m/s: the free ride's wing flies near 15 m/s hands
     * up; the speed bar adds a few. */
    trim: 15,
    /** THE SOLDIER IN THE HARNESS with his kit, kg (`ARMY_GROUND.mass`'s
     * man), the motor's on his back besides; his drag area seated in the
     * harness with the cage behind him, m² (a seated pilot's frontal area
     * near 0.6 m² at a drag coefficient near 1). */
    drag: 0.6,
    /** THE ORBIT round him: its radius, m, its height over him, m, and how
     * hard it closes on the circle's radius (the share of the way spent
     * closing on it per m off it, against the way round). Off the circle
     * further than `far` radii, it flies straight in. `speed` is the way
     * round over the ground, m/s, on top of the man's own, and `dash` the
     * way in from further out (the speed bar all the way out). */
    orbit: { radius: 150, height: 60, close: 0.012, far: 1.8, speed: 15, dash: 19 },
    /** THE SEARCH out of sight: the circle round where he was last seen,
     * this many times wider and `height` m over it. */
    search: { wider: 1.6, height: 90 },
    /** THE GROUND, THE WOODS AND THE LIFTS: the least height it holds
     * over the snow, over a crown and over a lift's rope, m, read round
     * the circle it flies (`ring` points), `look` s ahead along its way
     * and `toward` m of the way toward the circle (a ridge between him and
     * it is climbed over before it is reached, not met); and the hard
     * floor under that it never sinks below, m (full throttle, the brakes
     * off, turned for the lower side). */
    clear: { snow: 40, crowns: 22, rope: 25, ring: 12, look: 6, toward: 400, floor: 18 },
    /** Two paramotors keep this far apart, m: each pushed off the other's
     * track; and this far from an army helicopter's disc, m. */
    separate: 70,
    heli: 60,
    /** THE HANDS: how hard the toggles follow the heading it wants, per
     * rad off it; the most toggle it pulls (a steady turn, never a
     * spiral), and the least of it while more than `under` m under the
     * height it wants (`climbing`: a wing banked hard sinks), and the most
     * turning off snow rising ahead (`escape`: a steep turn spends height
     * to come round in time); the m/s past
     * the trim over which the speed bar goes all the way out; how near
     * the stall's angle of attack he lets the wing come before he lets it
     * fly (hands up, the bar out, the engine back to its trim), rad; and
     * the throttle's hold — its trim, per m off the height it wants, per
     * m/s of climb. */
    hands: {
      steer: 1.4,
      most: 0.35,
      under: 20,
      climbing: 0.15,
      escape: 0.6,
      barSpan: 4,
      stallMargin: 0.04,
      trim: 0.55,
      perMetre: 0.04,
      perClimb: 0.25,
    },
    /** THE RIFLE from the harness: he fires within `range` m of him and
     * in sight, a burst at a time, `every` s apart at the least. */
    fire: { range: 340, every: 3.5 },
    /** BROUGHT DOWN by a stolen helicopter: its disc within `disc` m of
     * the wing (the blades through the cloth and the lines), or the wing
     * in its wash — within `wash` rotor radii across and under the hub by
     * no more than `under` m — collapses it. A soldier whose wing is
     * gone falls under the cloth (`tangle` m² of drag, the paramotor's
     * own) — or, SAFE FOR WORK, under his reserve, sinking at `reserve`
     * m/s. Down, he lies `lie` s before he is taken off. */
    downed: { disc: 4, wash: 1.6, under: 25, reserve: 5.5, lie: 60 },
    /** LEAVING: the height over the snow it climbs to on the way out, m,
     * and how far past the map's edge it is gone, m; the way out read
     * among `ways` bearings as the one whose snow is lowest over the next
     * `look` m (a wing climbs slower than a face rises), kept unless
     * another is `keep` m lower. */
    leave: { height: 120, past: 80, ways: 12, look: 400, keep: 25 },
  },

  /** THE BALLOON. */
  balloon: {
    /** THE CALL: seconds from the roster asking to the first being let go,
     * and between one and the next; the most wind at 10 m over him it is
     * flown in, m/s (a balloon pilot stays on the ground past about
     * 7.5); and how far UPWIND of him it is let go, m, already flying. */
    respond: 30,
    stagger: 25,
    most: 7.5,
    upwind: 600,
    /** THE CREW: the pilot and the rocketeers in the basket, kg each with
     * their kit and their rockets. */
    man: 105,
    /** THE HEIGHT IT FLIES: over the snow ahead of it, m — the layer it
     * picks between `low` and `high`, read every `pick` s at `layers`
     * heights for the wind's veer that carries it closest to him — never
     * under `floor` m over the snow or `crowns` m over a crown. */
    height: { low: 90, high: 260, layers: 6, pick: 6, floor: 45, crowns: 25 },
    /** THE ROCKETS: fired within `range` m of him (slant), once he is in
     * sight, a man at a time, `every` s apart at the least across the
     * basket. SAFE FOR WORK, each is laid on the snow `warn` m to a side
     * of him (`near`–`far`) — never at him. */
    fire: { range: 420, every: 4, warn: { near: 35, far: 60 } },
    /** LEAVING: drifted `past` m beyond him downwind (out of the fight),
     * or the hunt over — it climbs to `height` m and is taken off once it
     * is `gone` m from him or at the map's edge. */
    leave: { past: 450, height: 300, gone: 1400 },
    /** BROUGHT DOWN: a burst within `burst` m of the envelope's middle (a
     * rocket's or a shell's fragments through the cloth; its radius is
     * some 8.6 m) or within `basket` m of the basket, or a stolen
     * helicopter's disc within `disc` m of the cloth, TEARS it: `torn` of
     * its cloth is holes the hot air pours out of, and with the INJURIES on
     * it catches fire. Its pilot shuts the burner and it sinks; a basket
     * that meets the snow no harder than a landing puts its crew out on
     * foot, `out` m apart round it. */
    downed: { burst: 11, basket: 5, disc: 3, torn: 0.55, out: 2.2 },
  },

  /** A ROCKET'S BURST ON THE ARMY'S OWN: a carrier, a truck or a tank
   * whose middle is within `vehicle` m of a burst is knocked out (a
   * shoulder rocket's shaped charge through a carrier's or a truck's
   * skin, or down through a tank's thin roof); a paramotor's wing within
   * `wing` m is shredded; a helicopter whose cabin is within `heli` m (a
   * tank shell he fired, `armour.ts`) comes down. */
  burst: { vehicle: 5, wing: 6, heli: 4 },

  /** Ids: paramotors are pursuers `pursuer` + n, balloons `pursuer` + 500
   * + n; the riflemen's guns `gun` + n, the rocketeers' `gun` + 5000 +
   * 4n + seat. */
  ids: { pursuer: 7000, gun: 120_000 },
} as const;
