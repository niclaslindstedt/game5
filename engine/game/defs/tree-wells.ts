// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TREE WELLS — the numbers (`tree-well.ts` is the model).
//
// What a tree well is, from the snow-safety literature on deep-snow
// immersion: a pit of LOOSE, UNCONSOLIDATED snow round the foot of a tree,
// above all a conifer whose low boughs reach out over the snow. The boughs
// catch the falling snow and shed it outside their spread, so the snowpack
// builds into a wall round the trunk while the snow under them stays low
// and soft — the deeper the snowpack, the deeper the well. On a slope the
// snow creeping down the hill piles against the trunk's uphill side, so
// the hollow opens and deepens on the DOWNHILL side. The boughs hang over
// it and hide it under the powder. A skier who comes too close slides in,
// usually head or feet first; the loose walls collapse in on him and the
// more he struggles the deeper he sinks. In two field trials where
// volunteers were set in a well, nine in ten could not get out on their
// own; wells metres deep have been measured where the snowpack is deep
// enough. Groomed runs have none: the machines fill them.
//
// The game's wells are as deep as the run's own powder makes them: none at
// the ordinary snow (the dial at 1 — where every race is skied, so no race
// and no digest moves), grown with the BOTTOMLESS share (`snow.ts`'s
// `bottomlessOf`) to their whole depth at a metre of fresh. Every figure
// below is an estimate set inside what that literature and the photographs
// of real wells show.

import type { TreeKind } from "../../mapgen/regions.ts";

export const TREE_WELLS = {
  /** THE DEEPEST WELL, m, at a full-skirted conifer at least `grown` m
   * tall in the deepest powder: a pit a skier stands chest deep in at the
   * trunk — a snowpack's worth under a metre of fresh. */
  depth: 1.4,
  /** A tree under `grown` m tall shelters less snow: its well as deep as
   * its height's share of that. */
  grown: 7,
  /** THE WELL'S REACH from the trunk, m: a little past the low boughs'
   * spread — `reach` of the crown's widest radius, the snow they shed
   * piling just outside their drip line — never under `least` and never
   * past `most`. */
  reach: 1.1,
  least: 1.2,
  most: 3.6,
  /** DOWNHILL: on a slope of `slopeFull` (rise over run) and steeper, the
   * pit reaches `lean` further on the downhill side than across it (and as
   * much less on the uphill side, where the creeping snow is piled on the
   * trunk), and is `deeper` of its depth deeper there. */
  slopeFull: 0.6,
  lean: 0.35,
  deeper: 0.3,
  /** The well map's cell, m (`tree-well.ts`'s index). */
  cell: 4,
  /** THE WALL'S SHAPE: the hollow's depth falls from the trunk to the rim
   * as (1 − s)^wall, s the share of the way out — a FUNNEL, deepest at the
   * trunk and steepest beside it, its loose wall leaning back to a soft
   * lip where it meets the snowpack, as the cross-sections the safety
   * literature draws and the photographs of dug-out wells show it. */
  wall: 1.5,
  /** THE SNOW IN IT: how far into the well (m under the snowpack's
   * surface) the snow is wholly loose — bottomless whatever the dial. */
  loose: 0.45,
  /** STUCK IN IT (`trench.ts`): a skier stopped in a well sinks after
   * `after` s, `dig` times as fast as in open powder, and whether he is
   * poling or not — the loose walls fall in on him — down to `max` m past
   * his sink; rocking packs back only `rock` of what it does in open
   * powder. `at` is how far into a well (`SkierState.well`) counts. */
  after: 0.35,
  dig: 3,
  max: 0.6,
  rock: 0.35,
  at: 0.3,
  /** EACH KIND'S SHARE of the deepest well: a full skirt of low boughs
   * (spruce, fir, hemlock, the stone pine) shelters the most; a pine's
   * crown is lifted and a larch is bare in winter; a dwarf shrub is
   * mostly buried; a broadleaf leaves only the shallow ring its trunk
   * melts. */
  kinds: {
    spruce: 1,
    fir: 1,
    hemlock: 1,
    blackspruce: 0.85,
    stonepine: 0.9,
    whitepine: 0.85,
    pine: 0.6,
    lodgepole: 0.55,
    juniper: 0.5,
    dwarfpine: 0.5,
    larch: 0.4,
    snag: 0.15,
    birch: 0.25,
    aspen: 0.2,
    rowan: 0.25,
    alder: 0.25,
    willow: 0.3,
    beech: 0.3,
    maple: 0.25,
    ash: 0.2,
  } satisfies Record<TreeKind, number>,
  /** A broadleaf's ring — and a dead snag's — reaches only `ring` m past
   * its trunk: nothing hangs over the snow to shelter it. */
  ring: 0.7,
  ringed: ["snag", "birch", "aspen", "rowan", "alder", "willow", "beech", "maple", "ash"],
  /** A well shallower than this at its trunk is not laid, m. */
  min: 0.08,
} as const;
