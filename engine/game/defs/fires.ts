// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRES OF A SKI AREA — the numbers `fires.ts` stands them by and
// burns a skier with. Two kinds:
//
//   * A CAMP FIRE — the warming fire a hut keeps outside its door, where
//     skiers stop to grill sausages on sticks and get their hands warm: an
//     outdoor fireplace of a stone or steel ring about a metre across,
//     flames half a metre to a metre high, a woodpile beside it (the hut
//     keeps the firewood) and two to four log benches in a ring round it.
//     In the north the classic skier's lunch is cooked on exactly such a
//     fire at a rest stop beside the runs — a warming hut or an
//     open-fronted log shelter facing a fire ring, the benches about it —
//     and a mountain restaurant keeps a grill on its terrace. It is the
//     hut's own fireplace, so it stands a few metres out from its front:
//     far enough that the walls and the eaves are never in the heat, near
//     enough to be the hut's.
//   * A BONFIRE — the big open fire a ski area keeps where skiers gather.
//     Fire codes for an open bonfire cap its fuel at about four and a half
//     metres across and two and a half tall, set at least fifteen metres
//     from any building or anything that burns, in a pit a little wider
//     than the fire; its flames stand three to five metres. Benches stand
//     back where the heat is bearable — the radiant flux off a fire that
//     size falls to a few kW/m², warm on the face, at four to six metres.
//     WHERE a ski area keeps one follows where its skiers stop: the BASE
//     (the plaza at the foot of the lifts, where the runs come home and
//     the fire pits stand by the village's terraces — the commonest place
//     by far), the MID-MOUNTAIN stop (the bench where the first lift tops
//     out and the mountain restaurant stands, its deck with fire pits
//     beside it) and the TOP (the warming fire or lean-to with a grill a
//     short walk off the top station, where a northern area's skiers stop
//     to grill before the run down). Each stands a little off the station
//     or the runs, never on them: a skier sees it from the lift and skis
//     to it.
//
// AND WHAT ONE DOES TO A SKIER WHO RIDES INTO IT (`burn`): his clothes take
// fire. A body in a fire's flames or wearing burning clothes is under a
// flux of the order of a hundred kW/m² (flame contact, and the burning
// shell of a ski jacket over him) — far past the 4–5 kW/m² that hurts in
// seconds — and the burn model (`body.ts`, `defs/anatomy.ts`'s `heat`
// ladder) reads it as a dose in (kW/m²)^4/3 · s, as it reads a wreck's
// fireball: past the airway's threshold in a couple of seconds, which
// `gore.ts` reads as mortal. Every number is metres, seconds or kW/m².

/** The kinds of fire. */
export type FireKind = "camp" | "bonfire";

/** One kind's measure.
 *   * `radius`: the hearth's, m — the ring of stones a camp fire burns in,
 *     the bed of a bonfire: what a skier riding into it is in the fire.
 *   * `flames`: how tall its flames stand over the ground, m.
 *   * `flux`: the heat on a body lying IN it, kW/m².
 *   * `seats`: the benches round it — `ring` how far out their middles
 *     stand from the fire's, `least`/`most` how many, `length` each
 *     bench's length, m (a split log or a plank on two stumps).
 *   * `woodpile`: the share of fires with a stack of firewood beside them. */
export type FireDef = {
  radius: number;
  flames: number;
  flux: number;
  seats: { ring: number; least: number; most: number; length: number };
  woodpile: number;
};

export const FIRE_KINDS: Readonly<Record<FireKind, FireDef>> = {
  // A ring of stones 1.1 m across, its fire half a metre to a metre high:
  // the hearth a skier is in is its inside, 0.55 m.
  camp: {
    radius: 0.55,
    flames: 0.8,
    flux: 90,
    seats: { ring: 2, least: 2, most: 4, length: 1.8 },
    woodpile: 0.7,
  },
  // A bed 3.6 m across (the code's cap is 4.5), flames 4 m: the hearth
  // 1.8 m; benches 5 m out from its middle, about 3 m off its edge.
  bonfire: {
    radius: 1.8,
    flames: 4,
    flux: 140,
    seats: { ring: 5, least: 5, most: 7, length: 2.4 },
    woodpile: 1,
  },
};

/** Where the fires stand, m and shares.
 *   * `camp.chance`: the share of the huts that keep a fire (a log hut,
 *     cabin or chalet, an afterski lodge, a mountain restaurant, the
 *     patrol's hut) — dealt in the order of their hashes, a hut with no
 *     room for one passing it on to the next; `camp.off` how far out from the building's front
 *     wall the fire's middle stands, dealt between the two (never inside
 *     the roof's reach and `camp.eaves` past it); `camp.slope` the most the
 *     ground may lean (rise over run) under the fire and its benches.
 *   * `bonfire.least`/`most`: how many a ski area keeps in all; `sites`
 *     where (`bonfireSites` in `fires.ts`): the BASE's beside the bottom
 *     station nearest the village (`base.count` of them, the second dealt
 *     at `base.second`), the TOP's off the highest lift's top station,
 *     the MID-MOUNTAIN's off the lift top nearest half way up (between
 *     `mid.band` of the way from the base to the top) at odds `mid.odds`.
 *     Each site's spots are looked for out to `search` from its station on
 *     a grid of `step`, the ones nearest `near` from it first (each nudged
 *     by up to `jitter` by its hash), on ground no steeper than `slope`
 *     and `station` from the station itself — the top's and the middle's
 *     no more than `rise` over their station's snow, so a skier off the
 *     lift glides to it and never climbs — and in the open first (no more
 *     than `glade.trunks` trunks within `glade.reach`), in among the trees
 *     only where the open has no room. Every site keeps `building`
 *     from any building's walls (the fire code's fifteen metres), `apart`
 *     between two bonfires, `pad` from the helicopter's pad, the parked
 *     snowmobile and the balloon's site, `strip` from the airstrip's edge,
 *     `hub` outside the hub's open snow, `tunnel` from a wind tunnel's
 *     lane, `route` from a ski route's marked corridor.
 *   * `clear`: what a fire's middle keeps from a trunk, a post or a wall
 *     past its benches' ring, m. */
export const FIRE_LAYOUT = {
  camp: { chance: 0.45, off: [4, 8] as const, eaves: 1.5, slope: 0.3 },
  bonfire: {
    least: 2,
    most: 4,
    sites: {
      base: { count: 1, second: 0.5, near: 40, search: 280, slope: 0.15 },
      top: { near: 45, search: 220, slope: 0.2 },
      mid: { odds: 0.75, band: [0.25, 0.75] as const, near: 40, search: 200, slope: 0.2 },
    },
    step: 8,
    jitter: 40,
    station: 25,
    rise: 2,
    glade: { reach: 20, trunks: 2 },
    building: 15,
    apart: 60,
    pad: 30,
    strip: 60,
    hub: 6,
    tunnel: 15,
    route: 12,
  },
  clear: 0.6,
} as const;

/** A skier and his fire (his footprint is the trees' three circles,
 * `TUNING.trees.bodyRadius`, read there).
 *   * `over`: how far over a fire's flames his centre of gravity must be to
 *     pass over it untouched, m (a jump clears a camp fire).
 *   * `flux`: the heat on him while his clothes burn, kW/m² — flame
 *     contact and the burning shell over him.
 *   * `lasts`: how long his clothes burn, s, before what will burn has.
 *   * `judge`: how often the dose is judged while he burns, s — a body on
 *     fire is hurt as it burns, never only once it is out. */
export const FIRE_BURN = {
  over: 1,
  flux: 100,
  lasts: 25,
  judge: 0.25,
} as const;
