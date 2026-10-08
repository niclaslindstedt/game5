// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI AREA'S MOUNTAIN BUILDINGS, BUILT — the two the engine stands up
// at the tops (`resort-buildings.ts`), on its footprints, on the facade kit
// (`village-build.ts` builds them into the village's one mesh):
//
//   * THE MOUNTAIN RESTAURANT (`mountainHut`): a single storey of rough
//     stone over a storey dug into the slope, under a very low gable with
//     its ridge along the front carrying a deep slab of snow to the eave;
//     big windows and the door on its face, a green name board on the
//     fascia, a stone chimney; a timber DECK across the front with tables
//     and a parasol, and past it LEVELLED SNOW with a row of red deck
//     chairs, feather flags and skis stood up in the snow.
//   * THE PATROL HUT (`patrol`): a small hut of red boards on posts, a
//     mono-pitch falling to the back, a big window over the runs, a stair
//     and landing to its door, toboggans stood against its flank, a radio
//     mast and the patrol's flag — a white cross on red.
//
// The frame is the engine's (`Site`: x across the front, +z out of it, y
// up from the floor). Three-free.

import { FACADE } from "./facade-paint.ts";
import {
  Site,
  backPitch,
  chimney,
  deckChair,
  featherFlag,
  flagPole,
  frontGable,
  parasol,
  picnicTable,
  plinth,
  radioMast,
  signBoard,
  skiRack,
  skisInSnow,
  solid,
  storey,
  toboggan,
  windows,
} from "./resort-props.ts";

/** Build a mountain building (`mountainHut` or `patrol`) on its site. */
export function buildMountainBuilding(site: Site): void {
  if (site.c.kind === "mountainHut") mountainHut(site);
  else if (site.c.kind === "patrol") patrolHut(site);
}

const STONE = { layer: FACADE.stone, tint: 0xf4f0ea };
const DARK_STONE = { layer: FACADE.stone, tint: 0xc8c4bc };
const DECK = { layer: FACADE.boards, tint: 0xc9a988 };
const RAIL = { layer: FACADE.steel, tint: 0x5a6066 };

function mountainHut(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  plinth(site, DARK_STONE, 0);
  storey(site, 0, d.walls, STONE);
  // The storey dug in under it shows on the downhill face where the snow
  // falls away: a row of windows in the plinth.
  const below = site.ground(0, hd + 0.5);
  if (below < -2.1) windows(site, "front", -hw + 1.5, hw - 1.5, 5, below + 0.6, -0.4, 1.2, 0.7, 9);
  // The face: two big windows either side of the door, lit.
  kit.inset(-1, hd, 1, hd, 0, 2.3, 0.05, FACADE.door, 0xffffff, true);
  windows(site, "front", -hw + 0.8, -1.6, 3, 0.7, 2.9, 2.2, 0.9, 1, FACADE.glazing);
  windows(site, "front", 1.6, hw - 0.8, 3, 0.7, 2.9, 2.2, 0.9, 2, FACADE.glazing);
  windows(site, "left", -hd + 1, hd - 1, 3, 1.0, 2.5, 1.2, 0.7, 3);
  windows(site, "right", -hd + 1, hd - 1, 3, 1.0, 2.5, 1.2, 0.7, 4);
  windows(site, "back", -hw + 2, hw - 2, 4, 1.2, 2.4, 1.0, 0.5, 5);
  // The low roof with the deep slab of snow on it, its boarded gables.
  frontGable(
    site,
    hw,
    hd,
    d.walls,
    d.ridge,
    d.reach.side,
    { layer: FACADE.roof, tint: 0xffffff },
    { layer: FACADE.boards, tint: 0x8c7a6a },
    { layer: FACADE.boards, tint: 0x8c7a6a },
    0.75,
  );
  signBoard(kit, -4, 4, d.walls - 0.75, d.walls - 0.1, hd + 0.05, 0x234a3a, 0xf3efe2, c.id);
  chimney(kit, -hw * 0.45, -hd * 0.3, d.walls, d.ridge + 1.2, 1.1);
  // THE DECK across the front, on a stone skirt, its rail round the ends.
  const t0 = hd;
  const t1 = hd + 5;
  const tw = hw + 0.5;
  const deck = -0.2;
  const foot = Math.min(deck - 0.3, site.lowest(-tw, t0, tw, t1)) - 0.5;
  solid(kit, -tw, foot, t0, tw, deck, t1, DARK_STONE, DECK);
  solid(kit, -tw, deck + 0.95, t0, -tw + 0.06, deck + 1.02, t1, RAIL);
  solid(kit, tw - 0.06, deck + 0.95, t0, tw, deck + 1.02, t1, RAIL);
  solid(kit, -tw, deck + 0.95, t1 - 0.06, -3, deck + 1.02, t1, RAIL);
  solid(kit, 3, deck + 0.95, t1 - 0.06, tw, deck + 1.02, t1, RAIL);
  for (const x of [-tw, -tw / 2, -3, 3, tw / 2, tw])
    solid(kit, x - 0.04, deck, t1 - 0.06, x + 0.04, deck + 1.02, t1, RAIL);
  for (let i = 0; i < 4; i++) {
    const x = -tw + 2.8 + ((2 * tw - 5.6) * i) / 3;
    picnicTable(kit, x, t0 + 2.6, deck, true);
  }
  parasol(kit, 0, t0 + 2.4, deck, 0xc8352c);
  // THE SNOW TERRACE past it: a row of red deck chairs facing the view.
  const z = hd + d.reach.front - 1.2;
  for (let i = 0; i < 8; i++) {
    const x = -hw + 1.2 + ((2 * hw - 2.4) * i) / 7;
    deckChair(kit, x, z, site.ground(x, z), i % 3 === 2 ? 0xf2a51c : 0xc8352c);
  }
  // The feather flags and the skis about it.
  featherFlag(kit, -tw - 1.2, hd + 3, site.ground(-tw - 1.2, hd + 3), 0xe0402c, 0xf2f2f2);
  featherFlag(kit, tw + 1.2, hd + 4, site.ground(tw + 1.2, hd + 4), 0x2a6fd6, 0xf2c230);
  skisInSnow(site, -hw, -hw * 0.3, hd + d.reach.front + 1.2, c.id, 9);
  skisInSnow(site, hw * 0.3, hw, hd + d.reach.front + 1.2, c.id + "b", 7);
  skiRack(kit, -hw, -hw + 4, -hd - 1.5, site.ground(-hw + 2, -hd - 1.5), c.id + "r", 0.6);
}

function patrolHut(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  const red = { layer: FACADE.boards, tint: 0xd2473c };
  const post = { layer: FACADE.steel, tint: 0x5a6066 };
  // The floor on four posts over the snow, a skirt of boards under it.
  for (const x of [-hw + 0.2, hw - 0.2])
    for (const z of [-hd + 0.2, hd - 0.2])
      solid(kit, x - 0.12, site.base - 0.6, z - 0.12, x + 0.12, 0, z + 0.12, post);
  solid(kit, -hw - 0.1, -0.3, -hd - 0.1, hw + 0.1, 0, hd + 0.1, {
    layer: FACADE.plain,
    tint: 0x4a3a2e,
  });
  storey(site, 0, d.walls, red);
  for (const x of [-hw, hw])
    for (const z of [-hd, hd])
      solid(kit, x - 0.08, 0, z - 0.08, x + 0.08, d.walls, z + 0.08, {
        layer: FACADE.plain,
        tint: 0xf2f2ef,
      });
  // The big window over the runs, and one each side.
  kit.inset(-hw + 0.5, hd, hw - 0.5, hd, 0.9, 2.5, 0.04, FACADE.glazing, 0xffffff, true);
  windows(site, "left", -hd + 0.5, hd - 0.5, 1, 1.1, 2.3, 1.4, 1, 1);
  // The door on the right flank, its landing and the stair down to the snow.
  kit.inset(hw, 1.1, hw, -0.1, 0, 2.1, 0.04, FACADE.plain, 0x5a3c26, false);
  const landing = { layer: FACADE.boards, tint: 0xa98d72 };
  solid(kit, hw, -0.25, -0.6, hw + 1.2, 0, 1.6, landing);
  const snow = site.ground(hw + 2.5, 0.5);
  const drop = Math.max(0, -snow);
  const steps = Math.max(1, Math.round(drop / 0.2));
  for (let i = 0; i < steps; i++) {
    const y = -((i + 1) * drop) / steps;
    solid(kit, hw + 1.2 + i * 0.25, snow - 0.3, -0.6, hw + 1.45 + i * 0.25, y + 0.02, 0.6, landing);
  }
  backPitch(
    site,
    hw,
    hd,
    d.walls,
    d.ridge,
    0.4,
    { layer: FACADE.roof, tint: 0xffffff },
    red,
    { layer: FACADE.plain, tint: 0xf2f2ef },
    0.3,
  );
  // The patrol's cross on its face, and its flag; the mast at the back.
  solid(kit, -0.9, d.walls - 0.25, hd, 0.9, d.walls + 0.3, hd + 0.08, {
    layer: FACADE.plain,
    tint: 0xf2f2ef,
  });
  signBoard(kit, -0.85, 0.85, d.walls - 0.2, d.walls + 0.25, hd + 0.08, 0xf2f2ef, 0xc81e1e, c.id);
  radioMast(kit, -hw + 0.4, -hd + 0.4, d.ridge - 0.6, d.ridge + 5);
  flagPole(kit, -hw - 1.5, hd + 1, site.ground(-hw - 1.5, hd + 1), 5.5, 0xc81e1e, 0xffffff, true);
  // The toboggans stood on end against the left flank.
  for (let i = 0; i < 3; i++) {
    site.sub(-hw, 0, -hd + 0.8 + i * 0.95, -Math.PI / 2);
    toboggan(kit, 0, 0.05, site.ground(-hw - 0.5, -hd + 0.8 + i * 0.95));
    site.home();
  }
  // A bench under the window.
  const by = site.ground(0, hd + 1.2);
  solid(kit, -1.2, by + 0.42, hd + 0.9, 1.2, by + 0.48, hd + 1.3, landing);
  for (const x of [-1, 1])
    solid(kit, x - 0.05, by - 0.5, hd + 0.95, x + 0.05, by + 0.42, hd + 1.25, landing);
}
