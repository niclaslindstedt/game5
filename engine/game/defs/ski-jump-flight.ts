// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP'S NUMBERS (R43): the bar, the take-off, the flight's polar and
// its controls, the landing — what `jump-inrun.ts` and `jump-flight.ts`
// ride a ski jump on. The research is `docs/freestyle.md` § *Ski jumping*;
// a number marked (est.) is ours, and a number marked (fitted) was fitted in
// the flight lab (`make skijump-flight`) to the norm's own checks: K reached
// off the design gate in calm air, the flight's peak 3–4 m over the slope
// about half way, 4.5–5 s to K, and the head and tail wind's factors.
// The in-run's own numbers — the tracks' friction and the crouch's drag
// area — are the hill's rule's (`SKI_JUMP_RULE.skier`), so the generator's
// design gate and the engine's in-run are one sum.

/** Degrees to radians. */
const D = Math.PI / 180;

export const JUMP = {
  /** THE BAR. The jumper sits on the starting bar of his gate, his skis in
   * the tracks, and leaves it on the press — the tuck past `press`, or the
   * jump key — after the green light: a shove off the bar with his hands
   * worth `shove` m/s down the tracks (est.), his centre of mass `seat` m
   * over them in the crouch (est., a crouched jumper's hips at the knees'
   * height). */
  bar: { press: 0.5, shove: 1.2, seat: 0.45 },
  /** THE TAKE-OFF (`docs/freestyle.md`: an explosive extension of the legs
   * on the last metres of the table lasting 0.25–0.30 s, adding 2–3 m/s at
   * right angles to it, 2.5 m/s representative). The press STARTS the
   * push; it lasts `push` s and its force rises and falls as a half sine,
   * so the share of it the edge keeps — the part done in the last `push`
   * s before the edge — falls off as (1 + cos(π·Δ/push)) / 2 for a push
   * `Δ` s early or late. `perpendicular` m/s at the build the mode rides
   * (the light build's `strength`), scaled as √ of a build's strength over
   * it (est.: 2.2–2.9 m/s across the builds). Within `sweet` s of perfect
   * the take-off is rated perfect (est.). The release stands his centre of
   * mass `release` m over the edge along the table's normal (est.: the
   * crouch's 0.45 m extended through the push). */
  takeOff: { push: 0.28, perpendicular: 2.5, strength: 0.85, sweet: 0.03, release: 0.6 },
  /** THE TAKE-OFF'S ROTATION (est.): a push early turns him forward too
   * little — he flies sat up, the skis high to the air — and a push late
   * too much, the tips dropping: `rotation` rad of attitude at a whole
   * push's error, the sign the error's, decaying over `settle` s; never
   * pressed, he leaves the edge sat up by `none` rad. */
  rotation: { per: 14 * D, none: 12 * D, settle: 0.9 },
  /** THE TRANSITION into the V-style: from the take-off's crouch to laid out
   * over the skis in `layout` s (the research's ~0.5 s), the V opened from
   * `veeFrom` s after the edge over `veeOpen` s and, let go (the tuck key
   * released with no assist), closed over `veeClose` s (est.). A take-off
   * mistimed lays out slower: by `slow` × the push's lost share. */
  layout: { time: 0.55, slow: 0.6, veeFrom: 0.1, veeOpen: 0.35, veeClose: 0.5 },
  /** THE POLAR (fitted): the whole jumper's lift and drag AREAS, m² (the
   * coefficient times the reference area: a force over ½ρV²), laid out in
   * the V-style, against his skis' angle of attack to the air, degrees, at
   * a body angle of ~10° over the skis and a V of ~30°. Its SHAPE is the
   * full-scale wind-tunnel studies' of the V-style (the lift rising near
   * linearly to its most at ~40° and falling past it, the drag growing as
   * the sine squared); its SIZE was fitted in the lab so a jump off the
   * jury's gate in calm air, flown at the ideal, reaches K in ~4.3 s with
   * its peak ~4 m over the slope: the lift at 38° 0.55 m² (the studies:
   * 0.5–0.7), the drag 0.32 m² — under the studies' 0.4–0.6, a lift to drag
   * of ~1.7 where they measure 1.2–1.6, the price of a point-mass jumper
   * with no lift off his body's pitch through the flight (est.). Read
   * linearly between the rows. */
  polar: {
    alpha: [0, 10, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90] as readonly number[],
    lift: [
      0.031, 0.169, 0.316, 0.393, 0.462, 0.524, 0.562, 0.539, 0.477, 0.37, 0.193, 0.039,
    ] as readonly number[],
    drag: [
      0.069, 0.088, 0.152, 0.191, 0.235, 0.289, 0.348, 0.412, 0.47, 0.549, 0.627, 0.657,
    ] as readonly number[],
    /** The areas a body met by the air before it has laid out — the
     * take-off's crouch extended, L/D ~0.7 off the table (the research's
     * 80 N of lift and of drag off a large hill's table). */
    crouch: { lift: 0.16, drag: 0.24 },
    /** The skis held together rather than in the V: the lift's share and
     * the drag's (the studies: the V is worth a quarter more lift). */
    closed: { lift: 0.8, drag: 0.97 },
    /** A body turned over or tumbling: what is left of it. */
    tumble: { lift: 0.05, drag: 0.6 },
    /** The areas were fitted on the jumper of the hill's rule
     * (`SKI_JUMP_RULE.skier.mass`, kg); a heavier build is a bigger body,
     * its areas as its mass to the ⅔. */
    mass: 67.5,
    /** The polar's whole scale (fitted). */
    scale: 1,
  },
  /** THE ATTITUDE: the angle of attack he holds, deg. `ideal` the best for
   * distance through the flight, s after the edge to degrees, eased between
   * the rows (fitted: the lab's sweep of constant angles finds the longest
   * flight at 36–40°, the research's 35–40° in mid-flight; lower in the
   * first second, as he comes up out of the transition); `trim` where the
   * air's own pitching moment carries him with no hand on it — sat up,
   * draggy, near the lift's most (est.); `lean` the most the lean moves it,
   * a hand that eases him toward the ideal (`Assist.air` 1) and one that
   * does not; `lag` the time he takes to move to it, s; below `over` the
   * air's moment turns him over, the angle running away at `diverge` per
   * s; past `stall` the lift is gone; never under `least`. He holds it
   * against his PATH OVER THE SNOW, the hill being what he sees: `wind` the
   * share of the wind's turn of the air past him that reaches his angle of
   * attack (1 all of it). */
  attitude: {
    ideal: [
      [0, 30],
      [1, 38],
      [6, 38],
    ] as readonly (readonly [number, number])[],
    trim: 44,
    lean: { assisted: 12, bare: 26 },
    lag: 0.2,
    over: 6,
    diverge: 4,
    stall: 45,
    least: -40,
    wind: 1,
  },
  /** THE ROLL (est.): the edge rolls him at `rate` rad/s; the hand levels it
   * over `level` s; a wind across the hill rolls him `cross` rad/s per
   * m/s; past `lost` rad in the air he is over and lost. */
  roll: { rate: 0.8, level: 0.3, cross: 0.03, lost: 0.7 },
  /** THE LANDING. The skis' soles lie `feet` m under his centre of mass
   * laid out (est.). The telemark is asked for on the trick key within
   * `prep` s of the snow (the research's last half second, est.): the
   * body comes up, the angle of attack to `prepAoa` deg (the research's
   * ~40° at the landing) over `prepLag` s; asked for later than `late` s
   * before the touch, or within `after` s past it, it is a telemark set on
   * the snow. A landing sat back past `sat` deg of attack, rolled past
   * `rolled` rad, or turned over is a fall. With the assist's hand on
   * (`Assist.air` past `auto`) the telemark is made for him `autoAt` m over
   * the snow. */
  landing: {
    feet: 0.35,
    prep: 0.8,
    prepAoa: 40,
    prepLag: 0.15,
    late: 0.06,
    after: 0.3,
    sat: 56,
    rolled: 0.4,
    auto: 0.5,
    autoAt: 2.2,
  },
  /** THE PHOTOCELLS: 8 m apart, the second 10 m before the edge. */
  cells: { from: 18, to: 10 },
  /** The jump's flight never counts before this, s (it is a jump). */
  least: 0.3,
} as const;
