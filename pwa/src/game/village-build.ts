// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI AREA'S VILLAGE, BUILT — the base's own buildings the engine
// stands round the hub (`resort-buildings.ts`, `defs/resort-buildings.ts`:
// each kind's footprint, walls and ridge, and the reach of its terrace or
// apron), each drawn ON that footprint in the materials the real ones are
// built of (`docs/buildings.md`), on the facade kit, as ONE geometry for
// the whole ski area with the mountain's (`mountain-build.ts`):
//
//   * THE BASE LODGE (`restaurant`): a stone plinth, a boarded ground
//     floor with its doors, the dining hall above GLAZED along the whole
//     face, a broad low gable with its ridge along the front and a
//     cross-gable over the entrance carrying the name board, a stone
//     chimney, and the TERRACE of boards across the front with its rail,
//     rows of picnic tables, furled parasols and the ski racks at its foot.
//   * THE TICKET OFFICE (`ticket`): a timber kiosk, a row of serving
//     windows under a deep awning on brackets, a white sign band with a
//     blue name across the top, a pass machine, the queue's rails.
//   * THE RENTAL (`rental`): a glazed SHOP FRONT under a red canvas
//     awning, boarded upper floor, a projecting sign, a long rack of hire
//     skis all one colour.
//   * THE SKI SCHOOL (`school`): a hut painted the school's red with white
//     trim and two dormers, its meeting flags on poles before it.
//   * FIRST AID (`firstAid`): white render, a wide door with the RED CROSS
//     over it and on its gable, a radio mast, toboggans, a flag.
//   * HOTELS (`hotel`): a stone ground floor, rendered storeys and a
//     boarded top one, a BALCONY ON EVERY FLOOR with its close-boarded
//     balustrade, a big gable on deep eaves sheltering them, most windows
//     lit after dark; each its own colourway off its id.
//   * THE GARAGE (`garage`): ribbed steel over a concrete plinth, three
//     roller doors a groomer drives through with their coloured jambs and
//     flood lamps, the concrete apron, a fuel tank.
//   * THE PUMP HOUSE (`pumpHouse`): formwork concrete under a flat roof,
//     a steel double door, louvres, pipes, a sign band, a cooling tower.
//   * THE TOWN round them — the houses, flats, shops and church along the
//     village's streets — is `village-town.ts`'s; the streets' furniture
//     (the lamps, the bus shelter, the signs, the snow poles) is
//     `street-furniture-build.ts`'s, built into the same kit.
//
// The frame is the engine's (`defs/cabins.ts`): x across the front, +z out
// of it, y up from the floor (`Site`). Three-free: the arrays are made a
// mesh by `facade-mesh.ts`.

import { TERRACES, resortBuildingsOf, cabinsOf, type Cabin, type Level } from "@engine";

import { FACADE } from "./facade-paint.ts";
import { FacadeKit } from "./facade-kit.ts";
import { DOOR_VOID } from "./door-looks.ts";
import { buildMountainBuilding } from "./mountain-build.ts";
import { apartments, church, house, shop } from "./village-town.ts";
import { buildStreetEdges } from "./street-edges-build.ts";
import { buildStreetFurniture } from "./street-furniture-build.ts";
import {
  Site,
  backPitch,
  chimney,
  flagPole,
  frontGable,
  endGable,
  idHash,
  parasol,
  picnicTable,
  radioMast,
  redCross,
  signBoard,
  skiRack,
  solid,
  plinth,
  storey,
  toboggan,
  windows,
  type Skin,
} from "./resort-props.ts";

/** The skins the village is built of. */
export const VILLAGE_SKIN = {
  stone: { layer: FACADE.stone, tint: 0xffffff },
  boards: { layer: FACADE.boards, tint: 0xffffff },
  darkBoards: { layer: FACADE.boards, tint: 0x8c7a6a },
  concrete: { layer: FACADE.concrete, tint: 0xffffff },
  roof: { layer: FACADE.roof, tint: 0xffffff },
  rustRoof: { layer: FACADE.roof, tint: 0xa0644a },
  fascia: { layer: FACADE.plain, tint: 0x3a3d42 },
  timberFascia: { layer: FACADE.boards, tint: 0xb89a7a },
  render: { layer: FACADE.render, tint: 0xffffff },
  steel: { layer: FACADE.steel, tint: 0xffffff },
  dark: { layer: FACADE.plain, tint: 0x2c3035 },
  white: { layer: FACADE.plain, tint: 0xf2f2ef },
} as const satisfies Record<string, Skin>;
const S = VILLAGE_SKIN;

/** How deep the snow lies on a roof, m. */
const SNOW = 0.4;

/** Build every one of the ski area's own buildings of `level` into one kit. */
export function buildResortBuildings(level: Level, cabins = cabinsOf(level)): FacadeKit {
  const kit = new FacadeKit();
  for (const c of resortBuildingsOf(cabins)) buildResortBuilding(kit, level, c);
  buildStreetEdges(kit, level);
  buildStreetFurniture(kit, level);
  return kit;
}

/** Build one building of the ski area onto `kit`. */
export function buildResortBuilding(kit: FacadeKit, level: Level, c: Cabin): void {
  const site = new Site(kit, level, c);
  switch (c.kind) {
    case "restaurant":
      return lodge(site);
    case "ticket":
      return ticket(site);
    case "rental":
      return rental(site);
    case "school":
      return school(site);
    case "firstAid":
      return firstAid(site);
    case "hotel":
      return hotel(site);
    case "garage":
      return garage(site);
    case "pumpHouse":
      return pumpHouse(site);
    case "house":
      return house(site);
    case "apartments":
      return apartments(site);
    case "shop":
      return shop(site);
    case "church":
      return church(site);
    default:
      return buildMountainBuilding(site);
  }
}

// ------------------------------------------------------------ base lodge

function lodge(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  const g = 3.4;
  plinth(site, S.stone, 0);
  storey(site, 0, g, S.boards);
  storey(site, g, d.walls, S.darkBoards);
  // A string course of timber between the storeys.
  solid(kit, -hw - 0.12, g - 0.1, -hd - 0.12, hw + 0.12, g + 0.15, hd + 0.12, S.timberFascia);
  // The ground floor: the entrance's doors in the middle, windows either side.
  // The doors hung in the middle (`doors-view.ts`), the room dark behind
  // them, glazed side lights either side.
  kit.inset(-1, hd, 1, hd, 0, 2.5, 0.005, FACADE.plain, DOOR_VOID, false);
  kit.inset(-2.4, hd, -1, hd, 0, 2.5, 0.05, FACADE.glazing, 0xffffff, true);
  kit.inset(1, hd, 2.4, hd, 0, 2.5, 0.05, FACADE.glazing, 0xffffff, true);
  windows(site, "front", -hw + 1, -4, 5, 0.8, 2.6, 1.6, 0.8, 1);
  windows(site, "front", 4, hw - 1, 5, 0.8, 2.6, 1.6, 0.8, 2);
  // The dining hall: glazed along the whole face, lit at night.
  kit.inset(
    -hw + 0.6,
    hd,
    hw - 0.6,
    hd,
    g + 0.3,
    d.walls - 0.3,
    0.05,
    FACADE.glazing,
    0xffffff,
    true,
  );
  windows(site, "left", -hd + 1, hd - 1, 5, g + 0.6, d.walls - 0.6, 1.8, 0.9, 3);
  windows(site, "right", -hd + 1, hd - 1, 5, g + 0.6, d.walls - 0.6, 1.8, 0.9, 4);
  windows(site, "back", -hw + 2, hw - 2, 9, g + 0.8, d.walls - 0.8, 1.4, 0.6, 5);
  windows(site, "back", -hw + 2, hw - 2, 7, 0.8, 2.4, 1.4, 0.3, 6);
  // The glulam columns down the face, carrying the eaves — none before the
  // doors (`building-walls.ts` stands the same ones).
  for (let i = 0; i <= 6; i++) {
    const x = -hw + 0.3 + ((2 * hw - 0.6) * i) / 6;
    if (Math.abs(x) < 2.6) continue;
    solid(kit, x - 0.16, 0, hd + 0.05, x + 0.16, d.walls, hd + 0.3, S.timberFascia);
  }
  // The roof: the broad gable along the front, a cross-gable over the door.
  frontGable(site, hw, hd, d.walls, d.ridge, d.reach.side, S.roof, S.boards, S.fascia, SNOW);
  const cw = 6;
  const cz = hd * 0.55;
  const chd = hd - cz + 0.3;
  endGable(site, cw, chd, d.walls, d.ridge - 0.2, 1.2, S.roof, S.darkBoards, S.fascia, SNOW, 0, cz);
  // Its gable glazed up toward the apex, and the name board under it.
  kit.inset(
    -cw + 1.6,
    hd + 0.3,
    cw - 1.6,
    hd + 0.3,
    d.walls + 0.2,
    d.walls + 1.9,
    0.04,
    FACADE.glazing,
    0xffffff,
    true,
  );
  solid(kit, -cw, d.walls - 0.7, hd, cw, d.walls + 0.05, hd + 0.3, S.timberFascia);
  signBoard(
    kit,
    -cw + 0.6,
    cw - 0.6,
    d.walls - 0.62,
    d.walls - 0.02,
    hd + 0.3,
    0x234a3a,
    0xf3efe2,
    c.id,
  );
  chimney(kit, hw * 0.55, -hd * 0.35, d.walls, d.ridge + 1.3, 1.2);
  // THE TERRACE: boards across the whole front on a stone skirt, a rail.
  // Measured in the engine, which rings it with its rail (`TERRACES`).
  const T = TERRACES.restaurant!;
  const t0 = hd + T.from;
  const t1 = hd + T.out;
  const tw = hw + T.end;
  const deck = T.deck;
  const foot = Math.min(deck - 0.3, site.lowest(-tw, t0, tw, t1)) - 0.5;
  solid(kit, -tw, foot, t0, tw, deck, t1, S.stone, { layer: FACADE.boards, tint: 0xc9a988 });
  const rail = { layer: FACADE.boards, tint: 0x9a7b60 };
  solid(kit, -tw, deck, t1 - 0.08, -T.gap, deck + T.rail, t1, rail);
  solid(kit, T.gap, deck, t1 - 0.08, tw, deck + T.rail, t1, rail);
  solid(kit, -tw, deck, t0, -tw + 0.08, deck + T.rail, t1, rail);
  solid(kit, tw - 0.08, deck, t0, tw, deck + T.rail, t1, rail);
  // The steps down off the terrace in the middle of its rail.
  const snow = site.ground(0, t1 + 1.5);
  const steps = Math.max(1, Math.round((deck - snow) / 0.18));
  for (let i = 0; i < steps; i++) {
    const y = deck - ((i + 1) * (deck - snow)) / steps;
    solid(kit, -T.gap, foot, t1 + i * 0.3, T.gap, y + 0.18, t1 + (i + 1) * 0.3, S.stone, {
      layer: FACADE.boards,
      tint: 0xc9a988,
    });
  }
  // The tables in two rows, parasols between them.
  for (let i = 0; i < 6; i++) {
    const x = -tw + 2.6 + ((2 * tw - 5.2) * i) / 5;
    if (Math.abs(x) < 2.6) continue;
    picnicTable(kit, x, t0 + 2, deck);
    picnicTable(kit, x, t0 + 4.6, deck);
    if (i % 2 === 0) parasol(kit, x + 1.6, t0 + 3.3, deck, i % 4 === 0 ? 0xc8352c : 0xf0ece0);
  }
  // The ski racks on the snow at the terrace's foot, either side of the steps.
  skiRack(kit, -tw + 1, -3.5, t1 + 1.6, site.ground(-tw / 2, t1 + 1.6), c.id + "a", 0.75);
  skiRack(kit, 3.5, tw - 1, t1 + 1.6, site.ground(tw / 2, t1 + 1.6), c.id + "b", 0.75);
}

// ---------------------------------------------------------- ticket office

function ticket(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  plinth(site, S.concrete, 0);
  storey(site, 0, d.walls, S.boards);
  // The serving windows along the front, lit, their counters under them.
  for (let i = 0; i < 4; i++) {
    const x = -hw + 1.2 + i * 1.75;
    kit.inset(x, hd, x + 1.3, hd, 0.95, 2.3, 0.04, FACADE.window, 0xffffff, true);
    solid(kit, x - 0.05, 0.85, hd, x + 1.35, 0.95, hd + 0.35, S.steel);
  }
  // Its door hung apart (`doors-view.ts`), a narrow side light either side.
  kit.inset(hw - 1.75, hd, hw - 0.75, hd, 0, 2.3, 0.005, FACADE.plain, DOOR_VOID, false);
  kit.inset(hw - 2.0, hd, hw - 1.75, hd, 0, 2.3, 0.04, FACADE.glazing, 0xffffff, true);
  kit.inset(hw - 0.75, hd, hw - 0.5, hd, 0, 2.3, 0.04, FACADE.glazing, 0xffffff, true);
  windows(site, "left", -hd + 0.8, hd - 0.8, 1, 1, 2.2, 1.4, 0.5, 1);
  windows(site, "back", -hw + 1, hw - 1, 2, 1.2, 2.2, 1.0, 0.2, 2);
  // The roof: a mono-pitch falling to the back, and the sign band round
  // its high front.
  backPitch(site, hw, hd, d.walls, d.ridge, 0.4, S.roof, S.boards, S.fascia, 0.3);
  solid(kit, -hw - 0.45, d.walls - 0.15, hd + 0.2, hw + 0.45, d.ridge + 0.55, hd + 0.45, S.white);
  signBoard(
    kit,
    -hw + 0.2,
    hw - 0.2,
    d.walls + 0.05,
    d.ridge + 0.4,
    hd + 0.45,
    0x1f5fae,
    0xffffff,
    c.id,
  );
  // The awning over the windows on its brackets.
  const ax0 = -hw + 0.6;
  const ax1 = hw - 2.3;
  kit.slope(
    [ax0, 2.55, hd + 1.7],
    [ax1, 2.55, hd + 1.7],
    [ax1, 2.95, hd],
    [ax0, 2.95, hd],
    S.roof,
    0.12,
    S.fascia,
    0.2,
  );
  for (const x of [ax0 + 0.2, (ax0 + ax1) / 2, ax1 - 0.2]) {
    // A knee brace from the wall up under the beam.
    solid(kit, x - 0.05, 2.0, hd, x + 0.05, 2.55, hd + 0.12, S.timberFascia);
    solid(kit, x - 0.05, 2.4, hd + 0.12, x + 0.05, 2.55, hd + 0.6, S.timberFascia);
    solid(kit, x - 0.06, 2.55, hd, x + 0.06, 2.65, hd + 1.6, S.timberFascia);
  }
  // The pass machine and the queue's rails, on the snow before it.
  const y = site.ground(0, hd + 2);
  solid(kit, hw - 0.3, y, hd + 0.4, hw + 0.4, y + 1.7, hd + 1.0, {
    layer: FACADE.panel,
    tint: 0x3d78c8,
  });
  for (let r = 0; r < 3; r++) {
    const z = hd + 2.2 + r * 1.1;
    solid(kit, -hw + 0.8, y + 0.95, z - 0.025, hw - 2.6, y + 1.0, z + 0.025, S.steel);
    for (const x of [-hw + 0.8, (-hw + hw - 1.8) / 2, hw - 2.6])
      solid(kit, x - 0.03, y - 0.3, z - 0.03, x + 0.03, y + 1.0, z + 0.03, S.steel);
  }
  skiRack(kit, -hw - 2.4, -hw - 0.6, hd + 1.4, site.ground(-hw - 1.5, hd + 1.4), c.id, 0.5);
}

// --------------------------------------------------------------- rental

function rental(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  const g = 3.1;
  plinth(site, S.stone, 0);
  storey(site, 0, g, S.darkBoards);
  storey(site, g, d.walls, S.boards);
  // The shop front: glass the whole width, the door in it, lit.
  kit.inset(-hw + 0.4, hd, hw - 3.2, hd, 0.15, g - 0.25, 0.05, FACADE.glazing, 0xffffff, true);
  kit.inset(hw - 2.9, hd, hw - 0.9, hd, 0, 2.5, 0.005, FACADE.plain, DOOR_VOID, false);
  windows(site, "front", -hw + 1, hw - 1, 5, g + 0.7, d.walls - 0.6, 1.3, 0.5, 1);
  windows(site, "left", -hd + 1, hd - 1, 3, g + 0.7, d.walls - 0.6, 1.2, 0.4, 2);
  windows(site, "right", -hd + 1, hd - 1, 3, g + 0.7, d.walls - 0.6, 1.2, 0.4, 3);
  windows(site, "left", -hd + 1, hd - 1, 2, 0.8, 2.4, 1.6, 0.5, 4, FACADE.glazing);
  frontGable(site, hw, hd, d.walls, d.ridge, d.reach.side, S.roof, S.boards, S.fascia, SNOW);
  // The canvas awning over the shop front, red.
  const red = { layer: FACADE.plain, tint: 0xc0332a };
  kit.slope(
    [-hw + 0.2, g - 0.5, hd + 1.6],
    [hw - 3.0, g - 0.5, hd + 1.6],
    [hw - 3.0, g - 0.05, hd],
    [-hw + 0.2, g - 0.05, hd],
    red,
    0.35,
    red,
    0,
  );
  // The sign band under the eaves and the projecting sign at the corner.
  signBoard(kit, -hw + 1, hw - 1, d.walls - 0.9, d.walls - 0.25, hd, 0xd2521f, 0xffffff, c.id);
  solid(kit, hw - 0.6, g + 0.4, hd, hw - 0.5, g + 0.5, hd + 1.4, S.dark);
  solid(kit, hw - 0.62, g - 0.7, hd + 0.3, hw - 0.48, g + 0.4, hd + 1.4, {
    layer: FACADE.plain,
    tint: 0xd2521f,
  });
  for (const s of [-1, 1]) {
    const x = hw - 0.55 + s * 0.08;
    kit.quad(
      [x, g - 0.55, hd + 0.5],
      [x, g - 0.55, hd + 0.6],
      [x, g + 0.25, hd + 1.25],
      [x, g + 0.25, hd + 1.15],
      FACADE.plain,
      0xffffff,
    );
  }
  // The rack of hire skis along the front, all one colour.
  const y = site.ground(0, hd + 2.2);
  skiRack(kit, -hw + 0.5, hw - 3.4, hd + 2.2, y, c.id, 0.9, 0xe8862a);
  const sb = { layer: FACADE.plain, tint: 0x2c3035 };
  solid(kit, hw - 2.6, y, hd + 2.2, hw - 1.9, y + 1.0, hd + 2.3, sb);
}

// ---------------------------------------------------------- ski school

function school(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  const red = { layer: FACADE.boards, tint: 0xd4524a };
  plinth(site, S.concrete, 0);
  storey(site, 0, d.walls, red);
  // White corner boards and trim.
  for (const x of [-hw, hw])
    for (const z of [-hd, hd])
      solid(kit, x - 0.12, 0, z - 0.12, x + 0.12, d.walls, z + 0.12, S.white);
  solid(kit, -hw - 0.1, d.walls - 0.2, hd, hw + 0.1, d.walls, hd + 0.1, S.white);
  kit.inset(-0.8, hd, 0.8, hd, 0, 2.2, 0.005, FACADE.plain, DOOR_VOID, false);
  windows(site, "front", -hw + 0.6, -1.2, 2, 0.9, 2.3, 1.3, 0.8, 1);
  windows(site, "front", 1.2, hw - 0.6, 2, 0.9, 2.3, 1.3, 0.8, 2);
  windows(site, "left", -hd + 0.8, hd - 0.8, 2, 0.9, 2.3, 1.1, 0.5, 3);
  windows(site, "right", -hd + 0.8, hd - 0.8, 2, 0.9, 2.3, 1.1, 0.5, 4);
  frontGable(
    site,
    hw,
    hd,
    d.walls,
    d.ridge,
    d.reach.side,
    S.roof,
    red,
    { layer: FACADE.plain, tint: 0xf2f2ef },
    SNOW,
  );
  // Two dormers on the front slope.
  for (const x of [-hw * 0.5, hw * 0.5]) {
    const z0 = 0.4;
    // The dormer's cheeks rise out of the slope a little over the eaves.
    solid(kit, x - 0.8, d.walls + 0.6, z0, x + 0.8, d.walls + 1.4, hd - 0.4, red, red);
    kit.inset(
      x - 0.5,
      hd - 0.4,
      x + 0.5,
      hd - 0.4,
      d.walls + 0.4,
      d.walls + 1.25,
      0.03,
      FACADE.window,
      0xffffff,
      true,
    );
    endGable(
      site,
      0.8,
      (hd - 0.4 - z0) / 2,
      d.walls + 1.4,
      d.walls + 2.0,
      0.2,
      S.roof,
      red,
      S.white,
      0.15,
      x,
      (hd - 0.4 + z0) / 2,
    );
  }
  // The school's sign over the door.
  signBoard(kit, -1.8, 1.8, 2.45, 3.0, hd, 0xffffff, 0xd4524a, c.id);
  // The meeting flags in a row before it, in the school's colours.
  const flags = [0xd4524a, 0xf2c230, 0x2a6fd6, 0x2fa65a, 0xd4524a, 0xf2f2f2];
  for (let i = 0; i < flags.length; i++) {
    const x = -hw + 0.5 + ((2 * hw - 1) * i) / (flags.length - 1);
    const z = hd + d.reach.front + 0.6;
    flagPole(kit, x, z, site.ground(x, z), 4.2, flags[i], i % 2 ? 0xffffff : null);
  }
}

// ------------------------------------------------------------ first aid

function firstAid(site: Site): void {
  const { kit, hw, hd, d } = site;
  plinth(site, S.concrete, 0.3);
  storey(site, 0.3, d.walls, S.render);
  // The wide door the toboggans come in at and the ambulance backs up to.
  kit.inset(-1.6, hd, 1.6, hd, 0.3, 2.9, 0.05, FACADE.shutter, 0xffffff, false);
  solid(kit, -1.85, 0.3, hd, -1.6, 3.1, hd + 0.08, { layer: FACADE.plain, tint: 0xc81e1e });
  solid(kit, 1.6, 0.3, hd, 1.85, 3.1, hd + 0.08, { layer: FACADE.plain, tint: 0xc81e1e });
  kit.inset(hw - 2.2, hd, hw - 1.1, hd, 0.3, 2.5, 0.005, FACADE.plain, DOOR_VOID, false);
  windows(site, "front", -hw + 0.6, -2.4, 2, 1.1, 2.5, 1.3, 0.9, 1);
  windows(site, "left", -hd + 0.8, hd - 0.8, 2, 1.1, 2.5, 1.2, 0.9, 2);
  windows(site, "right", -hd + 0.8, hd - 0.8, 2, 1.1, 2.5, 1.2, 0.9, 3);
  windows(site, "back", -hw + 1, hw - 1, 3, 1.1, 2.5, 1.2, 0.6, 4);
  frontGable(
    site,
    hw,
    hd,
    d.walls,
    d.ridge,
    d.reach.side,
    { layer: FACADE.roof, tint: 0xb8bcc0 },
    S.render,
    S.white,
    SNOW,
  );
  redCross(kit, 0, 3.25, hd + 0.02, 0.7);
  // The cross big on the gable ends, read from the lifts.
  for (const s of [-1, 1]) {
    site.sub(s * hw, 0, 0, (s * Math.PI) / 2);
    redCross(kit, 0, d.walls + 0.75, 0.02, 1.3);
    site.home();
  }
  radioMast(kit, -hw + 1.2, -hd + 1.2, d.walls, d.ridge + 4.5);
  const y = site.ground(-hw - 1, hd + 1);
  toboggan(kit, -hw + 0.6, hd + 0.05, y);
  toboggan(kit, -hw + 1.4, hd + 0.05, y, 0xc8352c);
  flagPole(kit, hw + 1.2, hd + 1.5, site.ground(hw + 1.2, hd + 1.5), 6, 0xc81e1e, 0xffffff, true);
}

// ---------------------------------------------------------------- hotel

const HOTEL_RENDER = [0xffffff, 0xf3e6c8, 0xf0d9b0, 0xe8ecef] as const;
const HOTEL_TRIM = [0xd0a070, 0x9bb59a, 0xd48a70, 0xb8b0a8] as const;

function hotel(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  const g = 3.5;
  const fl = (d.walls - g) / 3;
  const render = { layer: FACADE.render, tint: HOTEL_RENDER[Math.floor(idHash(c.id, 1) * 4)] };
  const trim = HOTEL_TRIM[Math.floor(idHash(c.id, 2) * 4)];
  const timberTop = idHash(c.id, 3) < 0.7;
  plinth(site, S.stone, 0);
  storey(site, 0, g, S.stone);
  storey(site, g, timberTop ? g + 2 * fl : d.walls, render);
  if (timberTop) storey(site, g + 2 * fl, d.walls, S.boards);
  // The ground floor: the entrance, its canopy, windows.
  kit.inset(-1, hd, 1, hd, 0, 2.6, 0.005, FACADE.plain, DOOR_VOID, false);
  kit.inset(-1.6, hd, -1, hd, 0, 2.6, 0.05, FACADE.glazing, 0xffffff, true);
  kit.inset(1, hd, 1.6, hd, 0, 2.6, 0.05, FACADE.glazing, 0xffffff, true);
  solid(kit, -2.4, 2.8, hd, 2.4, 3.0, hd + 1.8, S.dark, S.roof);
  windows(site, "front", -hw + 0.8, -2.4, 3, 0.9, 2.6, 1.5, 0.8, 1);
  windows(site, "front", 2.4, hw - 0.8, 3, 0.9, 2.6, 1.5, 0.8, 2);
  // The upper storeys: a window to every room front and back, balcony
  // doors on the front, a balcony along each floor.
  const bays = Math.max(4, Math.round((2 * hw) / 3));
  for (let f = 0; f < 3; f++) {
    const y0 = g + f * fl;
    windows(
      site,
      "front",
      -hw + 0.4,
      hw - 0.4,
      bays,
      y0 + 0.15,
      y0 + 2.3,
      1.1,
      0.75,
      10 + f,
      FACADE.door,
    );
    windows(site, "back", -hw + 0.4, hw - 0.4, bays, y0 + 0.8, y0 + 2.2, 1.0, 0.6, 20 + f);
    windows(site, "left", -hd + 1, hd - 1, 3, y0 + 0.8, y0 + 2.2, 1.0, 0.6, 30 + f);
    windows(site, "right", -hd + 1, hd - 1, 3, y0 + 0.8, y0 + 2.2, 1.0, 0.6, 40 + f);
    // The balcony: its slab, then a close-boarded balustrade round it.
    const b0 = hd;
    const b1 = hd + 1.5;
    solid(kit, -hw - 0.1, y0 - 0.2, b0, hw + 0.1, y0, b1, S.white, {
      layer: FACADE.boards,
      tint: 0xd9b48a,
    });
    const bal = { layer: FACADE.boards, tint: trim };
    solid(kit, -hw - 0.1, y0, b1 - 0.07, hw + 0.1, y0 + 1.05, b1, bal);
    solid(kit, -hw - 0.1, y0, b0, -hw - 0.03, y0 + 1.05, b1, bal);
    solid(kit, hw + 0.03, y0, b0, hw + 0.1, y0 + 1.05, b1, bal);
    // The partitions between the flats.
    for (let i = 1; i < bays; i += 2) {
      const x = -hw + (2 * hw * i) / bays;
      solid(kit, x - 0.04, y0, b0, x + 0.04, y0 + 2.4, b1 - 0.1, S.boards);
    }
  }
  // The big roof on deep eaves over the balconies, a gable glazed in the
  // roof storey, two chimneys.
  frontGable(
    site,
    hw,
    hd,
    d.walls,
    d.ridge,
    2.0,
    S.roof,
    timberTop ? S.boards : render,
    S.timberFascia,
    SNOW,
  );
  for (const s of [-1, 1]) {
    site.sub(s * hw, 0, 0, (s * Math.PI) / 2);
    kit.inset(
      -2,
      0,
      2,
      0,
      d.walls + 0.4,
      d.walls + 2.2,
      0.03,
      FACADE.window,
      0xffffff,
      idHash(c.id, 50 + s) < 0.6,
    );
    site.home();
  }
  chimney(kit, -hw * 0.5, -hd * 0.3, d.walls, d.ridge + 0.8);
  chimney(kit, hw * 0.45, -hd * 0.3, d.walls, d.ridge + 0.8);
  // The name down the roof: a board on the front slope.
  signBoard(kit, -4.5, 4.5, d.walls + 0.9, d.walls + 1.9, hd - 0.3, 0x2c3035, 0xf2d27a, c.id);
}

// --------------------------------------------------------------- garage

function garage(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  const clad = { layer: FACADE.cladding, tint: idHash(c.id, 1) < 0.5 ? 0x8fa39a : 0xa9b0b6 };
  plinth(site, S.concrete, 0.8);
  storey(site, 0.8, d.walls, clad);
  // Three roller doors a groomer's blade and tiller pass through.
  const door = 6.5;
  for (let i = 0; i < 3; i++) {
    const x = -hw + 2 + i * (door + 1.2);
    // The middle one is the door a walker opens, rolled by `doors-view.ts`.
    if (i === 1) kit.inset(x, hd, x + door, hd, 0, 5.2, 0.005, FACADE.plain, DOOR_VOID, false);
    else kit.inset(x, hd, x + door, hd, 0, 5.2, 0.06, FACADE.shutter, 0xffffff, false);
    const jamb = { layer: FACADE.plain, tint: 0xe0a21a };
    solid(kit, x - 0.3, 0, hd, x, 5.5, hd + 0.15, jamb);
    solid(kit, x + door, 0, hd, x + door + 0.3, 5.5, hd + 0.15, jamb);
    solid(kit, x - 0.3, 5.2, hd, x + door + 0.3, 5.5, hd + 0.15, jamb);
    // A flood lamp over each, lit.
    kit.glow = 1;
    solid(kit, x + door / 2 - 0.3, 5.9, hd, x + door / 2 + 0.3, 6.15, hd + 0.5, {
      layer: FACADE.plain,
      tint: 0xfff4d0,
    });
    kit.glow = 0;
  }
  kit.inset(hw - 2.4, hd, hw - 1.4, hd, 0, 2.2, 0.04, FACADE.plain, 0x3a3e43, false);
  windows(site, "front", hw - 1.3, hw - 0.3, 1, 1.4, 2.4, 0.8, 0.8, 1);
  windows(site, "left", -hd + 1.5, hd - 1.5, 4, 3.5, 5, 1.6, 0.6, 2);
  windows(site, "right", -hd + 1.5, hd - 1.5, 4, 3.5, 5, 1.6, 0.6, 3);
  windows(site, "back", -hw + 2, hw - 2, 6, 4, 5.5, 1.6, 0.3, 4);
  frontGable(
    site,
    hw,
    hd,
    d.walls,
    d.ridge,
    0.6,
    { layer: FACADE.cladding, tint: 0x6f767c },
    clad,
    S.fascia,
    0.35,
  );
  // The apron of concrete before the doors.
  const a1 = hd + d.reach.front - 0.3;
  const foot = site.lowest(-hw, hd, hw, a1) - 0.4;
  solid(kit, -hw - 0.3, foot, hd + 0.1, hw + 0.3, 0.02, a1, S.concrete, {
    layer: FACADE.concrete,
    tint: 0xa6a8aa,
  });
  // The fuel tank on its bund at the corner.
  const y = site.ground(hw + 2.4, 0);
  solid(kit, hw + 1, y - 0.3, -3, hw + 3.8, y + 0.5, 3, S.concrete);
  kit.column(hw + 2.4, -1.4, y + 0.5, y + 3.4, 1.0, FACADE.steel, 0x3f6e4a, 8);
  kit.column(hw + 2.4, 1.4, y + 0.5, y + 3.4, 1.0, FACADE.steel, 0x3f6e4a, 8);
  solid(kit, hw + 1.2, y + 0.5, 2.6, hw + 1.6, y + 2.0, 2.9, {
    layer: FACADE.plain,
    tint: 0xd0d4d7,
  });
}

// ------------------------------------------------------------ pump house

function pumpHouse(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  plinth(site, S.concrete, 0.4, 0.05);
  storey(site, 0, d.walls, S.concrete);
  site.kit.flatRoof(hw, hd, d.walls, 0.35, 0.15, S.concrete, SNOW);
  // The parapet round the roof.
  solid(kit, -hw - 0.15, d.walls + 0.35, -hd - 0.15, hw + 0.15, d.ridge, -hd + 0.1, S.concrete);
  solid(kit, -hw - 0.15, d.walls + 0.35, hd - 0.1, hw + 0.15, d.ridge, hd + 0.15, S.concrete);
  // The steel double door, louvres either side, the sign band.
  kit.inset(-1.2, hd, 1.2, hd, 0, 2.6, 0.005, FACADE.plain, DOOR_VOID, false);
  kit.inset(-hw + 0.8, hd, -2.2, hd, 1.2, 3.6, 0.05, FACADE.louvre, 0xffffff, false);
  kit.inset(2.2, hd, hw - 0.8, hd, 1.2, 3.6, 0.05, FACADE.louvre, 0xffffff, false);
  kit.inset(-hw + 1, -hd, hw - 1, -hd, 2.4, 3.8, 0.05, FACADE.louvre, 0xffffff, false);
  signBoard(kit, -1.8, 1.8, 2.85, 3.35, hd, 0xf2f2ef, 0x1f5fae, c.id);
  kit.glow = 1;
  solid(kit, -0.3, 3.55, hd, 0.3, 3.75, hd + 0.35, { layer: FACADE.plain, tint: 0xfff4d0 });
  kit.glow = 0;
  // The pipes up the flank and into the ground.
  for (const z of [-1.5, 0, 1.5])
    kit.column(hw + 0.3, z, site.base - 0.5, d.walls - 0.6, 0.18, FACADE.steel, 0x3d6fa8, 8);
  solid(kit, hw, d.walls - 0.85, -1.8, hw + 0.5, d.walls - 0.5, 1.8, {
    layer: FACADE.steel,
    tint: 0x3d6fa8,
  });
  // The cooling tower on its slab before it, and a transformer kiosk.
  const y = site.ground(-hw + 2, hd + 1.4);
  solid(kit, -hw + 0.4, y - 0.3, hd + 0.4, -hw + 3.4, y + 0.15, hd + 2.4, S.concrete);
  solid(
    kit,
    -hw + 0.6,
    y + 0.15,
    hd + 0.6,
    -hw + 3.2,
    y + 2.6,
    hd + 2.2,
    { layer: FACADE.cladding, tint: 0x9aa4ad },
    S.dark,
  );
  kit.column(-hw + 1.9, hd + 1.4, y + 2.6, y + 3.0, 0.75, FACADE.steel, 0xffffff, 10);
  const yk = site.ground(hw - 1.4, hd + 1.4);
  solid(
    kit,
    hw - 2.4,
    yk - 0.3,
    hd + 0.6,
    hw - 0.4,
    yk + 2.2,
    hd + 2.0,
    { layer: FACADE.panel, tint: 0xb8c2a8 },
    S.dark,
  );
}
