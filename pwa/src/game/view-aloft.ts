// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VIEW ALOFT, three-free: how far the picture reaches when the lens is
// HIGH OVER THE SNOW — a helicopter, the jump plane, the balloon, the
// paramotor, a canopy, a wingsuit, or any lens stood up there.
//
// The DISTANCE row (`settings-video.ts`) was cut for a skier ON the snow:
// LOW's mist closes 280 m out, which is the course and what stands beside
// it, a few seconds ahead at speed. A pilot in the same mist sees a disc of
// snow under him and nothing he could steer by — the mountain, the valley,
// the lifts are all behind the wall. So the reach GROWS WITH THE HEIGHT over
// the snow under the lens: nothing changes below `ALOFT_VIEW.from` (so a
// skier's picture, and every lab of it, is the row's own to the byte), and
// above it every metre climbed opens `grow` metres of view, until the
// ground's whole clipmap (`TERRAIN_REACH`) is in it — the whole map, on
// every stop.
//
// WHY THAT IS AFFORDABLE: what a reach costs is the ground's rings and the
// woods, and from high up both are cheap at the far end and dear at the
// near one. So with the reach the picture takes a COARSER near end: the
// ground leaves out the fine levels under the lens a pilot cannot resolve
// from up there (`terrain.ts`'s `follow`, `FINE_UNDER`), keeping about as
// many rings as on the snow, and the woods choose their cut by the SLANT
// distance from the lens (`lift`), so the trees under him are the far
// band's sketch rather than the full cut, and their reach on the snow
// grows more slowly than the view's (`treeGrow`), up to `treeMost`.

import { DISTANCE_LOOK, TERRAIN_REACH, type DistanceLevel } from "./settings-video.ts";

export const ALOFT_VIEW = {
  /** The height over the snow, m, below which nothing changes. */
  from: 20,
  /** View opened per metre climbed past `from`, m: at LOW the mist stands
   * a kilometre out 60 m up, and the ground's whole reach is drawn from
   * under 200 m up. Past that the wall goes on out over the rim, so a
   * pilot's mist thins away as he climbs (`haze.ts`). What the reach costs
   * is the ground's rings, as many as on the snow, and the woods — which
   * grow on their own, slower clock (`treeGrow`). */
  grow: 20,
  /** Tree reach on the snow opened per metre climbed, m. */
  treeGrow: 2.5,
  /** The furthest the woods reach in plan, m — the MAX stop's own. */
  treeMost: DISTANCE_LOOK.max.trees,
  /** The across-the-ground mist (`haze.ts`'s `uMistAloft`) eases in over
   * these heights over the snow, m. */
  across: { from: 40, to: 220 },
} as const;

export type AloftLook = {
  /** How far the ground is drawn, m (no further than its clipmap's reach). */
  reach: number;
  /** The mist's wall, m; 0 is none (DISTANCE MAX). */
  mist: number;
  /** How far out the woods stand in plan, m. */
  trees: number;
  /** How far the crags are drawn, m. */
  view: number;
  /** The lens's height over the snow past `from`, m: the woods' cut is
   * chosen at the slant distance over it. 0 on the snow. */
  lift: number;
  /** How far aloft the lens is, 0..1 (`uMistAloft`). */
  aloft: number;
};

/** The view at a DISTANCE stop with the lens `over` m above the snow under it. */
export function aloftLook(distance: DistanceLevel, over: number): AloftLook {
  const look = DISTANCE_LOOK[distance];
  const lift = Math.max(0, over - ALOFT_VIEW.from);
  const view = look.view + ALOFT_VIEW.grow * lift;
  const { from, to } = ALOFT_VIEW.across;
  const t = Math.min(1, Math.max(0, (over - from) / (to - from)));
  return {
    reach: look.mist ? Math.min(TERRAIN_REACH, view) : look.view,
    // The wall goes on out past the ground's reach: the mist at its far
    // end thins as he climbs, as the MAX stop's none.
    mist: look.mist ? view : 0,
    trees: Math.max(
      look.trees,
      Math.min(ALOFT_VIEW.treeMost, look.trees + ALOFT_VIEW.treeGrow * lift),
    ),
    view: Math.max(look.view, Math.min(TERRAIN_REACH, view)),
    lift,
    aloft: t * t * (3 - 2 * t),
  };
}
