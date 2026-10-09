// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S OWN TOWN, BUILT — the houses, flats, shops and church the
// engine lays along the village's streets (`village-place.ts`, the
// `TOWN_KINDS` of `defs/resort-buildings.ts`) round the ski area's own
// buildings (`village-build.ts`), drawn on the facade kit in the materials a
// mountain village's are built of (`docs/buildings.md`):
//
//   * THE HOUSE (`house`): the mountain chalet — a rendered or stone
//     ground floor, a timber upper storey, its GABLE TO THE STREET on deep
//     eaves over a balcony across it with a boarded balustrade, windows
//     with painted shutters, a chimney; each its own colourway off its id.
//   * THE FLATS (`apartments`): three storeys and a timber roof storey
//     under a broad gable along the street, a balcony on every floor, the
//     entrance with its canopy and the residents' ski room door beside it.
//   * THE SHOP (`shop`): a ground floor of DISPLAY WINDOWS at the back of
//     the sidewalk under a canvas awning and a fascia board with the
//     shop's name, a flat over it with shuttered windows, its gable to the
//     street.
//   * THE CHURCH (`church`): a white rendered nave under a steep roof, tall
//     round-headed windows down its flanks, and before its gable the BELL
//     TOWER — a square shaft, its belfry's louvred openings and a clock
//     face on each side — under a SPIRE some thirty metres over the street
//     with its cross.
//
// The frame is the engine's (`defs/cabins.ts`): x across the front, +z out
// of it (toward the street), y up from the floor (`Site`). Three-free.

import { CHURCH_TOWER } from "@engine";

import { FACADE } from "./facade-paint.ts";
import { DOOR_VOID } from "./door-looks.ts";
import {
  Site,
  chimney,
  endGable,
  frontGable,
  idHash,
  plinth,
  signBoard,
  solid,
  storey,
  windows,
  type Skin,
} from "./resort-props.ts";

/** How deep the snow lies on a roof, m. */
const SNOW = 0.4;

const STONE: Skin = { layer: FACADE.stone, tint: 0xffffff };
const ROOF: Skin = { layer: FACADE.roof, tint: 0xffffff };
const DARK_ROOF: Skin = { layer: FACADE.roof, tint: 0x6a5048 };
const FASCIA: Skin = { layer: FACADE.boards, tint: 0x8a6a50 };
const WHITE: Skin = { layer: FACADE.plain, tint: 0xf2f2ef };

/** The renders a town's walls are painted in: chalk white, a warm cream,
 * an ochre, a pale grey-green, a rose. */
const RENDERS = [0xffffff, 0xf4e8cc, 0xecd2a0, 0xdfe6dc, 0xf0dcd4] as const;
/** The timber's tones: the sun-darkened larch of an old house, a newer
 * honey, a stained brown. */
const TIMBERS = [0x8a6a50, 0xc9a07a, 0x6e5240] as const;
/** The shutters' paints: a deep green, an oxblood, a grey-blue, the
 * timber's own. */
const SHUTTERS = [0x3c5a3e, 0x7a2a24, 0x4a5a6c, 0x8a6a50] as const;
/** The shop awnings' canvases. */
const AWNINGS = [0xb3262c, 0x2c4f7a, 0x2f6a46, 0xd8a52a, 0x5a3a2e, 0xe8e2d4] as const;
/** The shops' fascia grounds and their letters. */
const FASCIAS = [
  [0x23303a, 0xf2d27a],
  [0x6a1e22, 0xf3efe2],
  [0xf3efe2, 0x2a2a2a],
  [0x2a4a36, 0xf3efe2],
] as const;

function of<T>(list: readonly T[], id: string, salt: number): T {
  return list[Math.floor(idHash(id, salt) * list.length) % list.length];
}

/** A row of `n` windows across the front (+z) or the back with a painted
 * shutter folded back either side of each. */
function shuttered(
  site: Site,
  face: "front" | "back",
  a: number,
  b: number,
  n: number,
  y0: number,
  y1: number,
  w: number,
  paint: number,
  lit: number,
  salt: number,
): void {
  const { kit, hd } = site;
  windows(site, face, a, b, n, y0, y1, w, lit, salt);
  const skin: Skin = { layer: FACADE.boardShutter, tint: paint };
  const z = face === "front" ? hd : -hd;
  const out = face === "front" ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const m = a + ((b - a) * (i + 0.5)) / n;
    for (const s of [-1, 1]) {
      const x0 = m + s * (w / 2 + 0.04);
      const x1 = m + s * (w / 2 + 0.04 + w * 0.5);
      solid(kit, x0, y0 - 0.05, z, x1, y1 + 0.05, z + out * 0.06, skin);
    }
  }
}

/** A row of windows down a flank (±x), each with its shutters. */
function flankWindows(
  site: Site,
  side: "left" | "right",
  a: number,
  b: number,
  n: number,
  y0: number,
  y1: number,
  w: number,
  paint: number,
  lit: number,
  salt: number,
): void {
  const { kit, hw } = site;
  windows(site, side, a, b, n, y0, y1, w, lit, salt);
  const skin: Skin = { layer: FACADE.boardShutter, tint: paint };
  const x = side === "right" ? hw : -hw;
  const out = side === "right" ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const m = a + ((b - a) * (i + 0.5)) / n;
    for (const s of [-1, 1]) {
      const z0 = m + s * (w / 2 + 0.04);
      const z1 = m + s * (w / 2 + 0.04 + w * 0.5);
      solid(kit, x, y0 - 0.05, z0, x + out * 0.06, y1 + 0.05, z1, skin);
    }
  }
}

/** A BALCONY across the front at floor `y`: its slab, a close-boarded
 * balustrade of `tint` and the brackets under it. */
function balcony(site: Site, x0: number, x1: number, y: number, deep: number, tint: number): void {
  const { kit, hd } = site;
  const timber: Skin = { layer: FACADE.boards, tint };
  solid(kit, x0, y - 0.18, hd, x1, y, hd + deep, WHITE, { layer: FACADE.boards, tint: 0xd9b48a });
  const bal: Skin = { layer: FACADE.balustrade, tint };
  solid(kit, x0, y, hd + deep - 0.07, x1, y + 1.0, hd + deep, bal);
  solid(kit, x0, y, hd, x0 + 0.07, y + 1.0, hd + deep, bal);
  solid(kit, x1 - 0.07, y, hd, x1, y + 1.0, hd + deep, bal);
  for (const x of [x0 + 0.4, (x0 + x1) / 2, x1 - 0.4]) {
    solid(kit, x - 0.08, y - 0.9, hd, x + 0.08, y - 0.18, hd + deep * 0.7, timber);
  }
}

// ---------------------------------------------------------------- house

export function house(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  const g = 2.8;
  const render: Skin = { layer: FACADE.render, tint: of(RENDERS, c.id, 1) };
  const timber = of(TIMBERS, c.id, 2);
  const paint = of(SHUTTERS, c.id, 3);
  const stoneFoot = idHash(c.id, 4) < 0.4;
  plinth(site, STONE, 0.2);
  storey(site, 0, g, stoneFoot ? STONE : render);
  storey(site, g, d.walls, { layer: FACADE.boards, tint: timber });
  // The door at one side of the street front, its little roof over it.
  const door = idHash(c.id, 5) < 0.5 ? -hw + 2 : hw - 2;
  // Its leaf hung apart (`doors-view.ts`), the hall dark behind it.
  kit.inset(door - 0.55, hd, door + 0.55, hd, 0.2, 2.3, 0.005, FACADE.plain, DOOR_VOID, false);
  solid(kit, door - 0.9, 2.35, hd, door + 0.9, 2.5, hd + 0.9, FASCIA, ROOF);
  shuttered(
    site,
    "front",
    door < 0 ? -hw + 3.5 : -hw + 0.8,
    door < 0 ? hw - 0.8 : hw - 3.5,
    2,
    0.95,
    2.2,
    1.0,
    paint,
    0.7,
    1,
  );
  // Upstairs: the balcony across the gable, the windows behind it.
  shuttered(site, "front", -hw + 1, hw - 1, 3, g + 0.6, g + 2.2, 1.0, paint, 0.75, 2);
  balcony(site, -hw + 0.4, hw - 0.4, g + 0.05, 1.3, timber);
  // The gable's own window up under the ridge.
  kit.inset(
    -0.6,
    hd,
    0.6,
    hd,
    d.walls + 0.4,
    d.walls + 1.6,
    0.04,
    FACADE.casement,
    0xffffff,
    idHash(c.id, 6) < 0.5,
  );
  shuttered(site, "back", -hw + 1, hw - 1, 3, 0.95, 2.2, 1.0, paint, 0.5, 3);
  shuttered(site, "back", -hw + 1, hw - 1, 3, g + 0.6, g + 2.0, 0.9, paint, 0.4, 4);
  flankWindows(site, "left", -hd + 1.2, hd - 1.2, 2, 0.95, 2.2, 1.0, paint, 0.5, 5);
  flankWindows(site, "right", -hd + 1.2, hd - 1.2, 2, 0.95, 2.2, 1.0, paint, 0.5, 6);
  flankWindows(site, "left", -hd + 1.2, hd - 1.2, 3, g + 0.6, g + 2.0, 0.9, paint, 0.5, 7);
  flankWindows(site, "right", -hd + 1.2, hd - 1.2, 3, g + 0.6, g + 2.0, 0.9, paint, 0.5, 8);
  // The roof: the gable to the street on deep eaves, the chimney.
  endGable(
    site,
    hw,
    hd,
    d.walls,
    d.ridge,
    1.4,
    idHash(c.id, 9) < 0.5 ? ROOF : DARK_ROOF,
    { layer: FACADE.boards, tint: timber },
    FASCIA,
    SNOW,
  );
  chimney(kit, hw * 0.45, -hd * 0.4, d.walls, d.ridge + 0.4, 0.8);
  // The woodpile under the eaves of one flank.
  const side = idHash(c.id, 10) < 0.5 ? -1 : 1;
  solid(kit, side * hw, 0.2, -hd + 1, side * (hw + 0.7), 1.6, hd - 2, {
    layer: FACADE.woodpile,
    tint: 0xffffff,
  });
}

// ------------------------------------------------------------ apartments

export function apartments(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  const g = 3;
  const fl = (d.walls - g) / 3;
  const render: Skin = { layer: FACADE.render, tint: of(RENDERS, c.id, 1) };
  const timber = of(TIMBERS, c.id, 2);
  const paint = of(SHUTTERS, c.id, 3);
  plinth(site, STONE, 0.3);
  storey(site, 0, g + 2 * fl, render);
  storey(site, g + 2 * fl, d.walls, { layer: FACADE.boards, tint: timber });
  // The entrance in the middle under its canopy; the ski room's door and
  // the garage's beside it.
  kit.inset(-1, hd, 1, hd, 0.3, 2.6, 0.005, FACADE.plain, DOOR_VOID, false);
  kit.inset(-1.2, hd, -1, hd, 0.3, 2.6, 0.05, FACADE.glazing, 0xffffff, true);
  kit.inset(1, hd, 1.2, hd, 0.3, 2.6, 0.05, FACADE.glazing, 0xffffff, true);
  solid(kit, -2, 2.75, hd, 2, 2.95, hd + 1.4, { layer: FACADE.plain, tint: 0x3a3d42 }, ROOF);
  kit.inset(-hw + 1.2, hd, -hw + 3.8, hd, 0.3, 2.6, 0.05, FACADE.shutter, 0xffffff, false);
  kit.inset(hw - 3.4, hd, hw - 2.2, hd, 0.3, 2.4, 0.05, FACADE.plankDoor, 0xffffff, false);
  shuttered(site, "front", 2.4, hw - 4, 2, 1.0, 2.4, 1.1, paint, 0.6, 1);
  const bays = Math.max(4, Math.round((2 * hw) / 3.2));
  for (let f = 0; f < 3; f++) {
    const y0 = g + f * fl;
    windows(
      site,
      "front",
      -hw + 0.5,
      hw - 0.5,
      bays,
      y0 + 0.15,
      y0 + 2.3,
      1.1,
      0.7,
      10 + f,
      FACADE.door,
    );
    shuttered(
      site,
      "back",
      -hw + 0.8,
      hw - 0.8,
      bays,
      y0 + 0.8,
      y0 + 2.2,
      1.0,
      paint,
      0.55,
      20 + f,
    );
    flankWindows(site, "left", -hd + 1.2, hd - 1.2, 3, y0 + 0.8, y0 + 2.2, 1.0, paint, 0.5, 30 + f);
    flankWindows(
      site,
      "right",
      -hd + 1.2,
      hd - 1.2,
      3,
      y0 + 0.8,
      y0 + 2.2,
      1.0,
      paint,
      0.5,
      40 + f,
    );
    balcony(site, -hw - 0.1, hw + 0.1, y0, 1.4, timber);
    for (let i = 1; i < bays; i += 2) {
      const x = -hw + (2 * hw * i) / bays;
      solid(kit, x - 0.04, y0, hd, x + 0.04, y0 + 2.4, hd + 1.3, {
        layer: FACADE.boards,
        tint: timber,
      });
    }
  }
  frontGable(
    site,
    hw,
    hd,
    d.walls,
    d.ridge,
    1.8,
    ROOF,
    { layer: FACADE.boards, tint: timber },
    FASCIA,
    SNOW,
  );
  chimney(kit, -hw * 0.45, -hd * 0.25, d.walls, d.ridge + 0.6);
  chimney(kit, hw * 0.45, -hd * 0.25, d.walls, d.ridge + 0.6);
}

// ------------------------------------------------------------------ shop

export function shop(site: Site): void {
  const { kit, hw, hd, d, c } = site;
  const g = 3.4;
  const render: Skin = { layer: FACADE.render, tint: of(RENDERS, c.id, 1) };
  const timber = of(TIMBERS, c.id, 2);
  const paint = of(SHUTTERS, c.id, 3);
  const awning = of(AWNINGS, c.id, 4);
  const [ground, letters] = of(FASCIAS, c.id, 5);
  plinth(site, STONE, 0.15);
  storey(site, 0, g, render);
  storey(site, g, d.walls, idHash(c.id, 6) < 0.5 ? render : { layer: FACADE.boards, tint: timber });
  // THE SHOP FRONT: display windows either side of the glazed door, on a
  // stone stall riser, lit after dark; a fascia board over them.
  const door = 1.0;
  solid(kit, -hw + 0.4, 0.15, hd, hw - 0.4, 0.6, hd + 0.12, STONE);
  kit.inset(
    -hw + 0.5,
    hd + 0.12,
    -door - 0.2,
    hd + 0.12,
    0.6,
    2.7,
    0.03,
    FACADE.glazing,
    0xffffff,
    true,
  );
  kit.inset(
    door + 0.2,
    hd + 0.12,
    hw - 0.5,
    hd + 0.12,
    0.6,
    2.7,
    0.03,
    FACADE.glazing,
    0xffffff,
    true,
  );
  kit.inset(-door, hd, door, hd, 0.15, 2.7, 0.005, FACADE.plain, DOOR_VOID, false);
  // The goods in the windows: a few shapes on a shelf behind the glass.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = s * (door + 0.8 + i * ((hw - door - 1.6) / 3));
      const h = 0.4 + idHash(c.id, 20 + i + (s > 0 ? 3 : 0)) * 0.9;
      const tint = of(
        [0xd04030, 0x2a5aa0, 0xf0f0e8, 0x303438, 0xe0b030],
        c.id,
        30 + i + (s > 0 ? 3 : 0),
      );
      solid(kit, x - 0.3, 0.6, hd - 0.5, x + 0.3, 0.6 + h, hd - 0.15, {
        layer: FACADE.plain,
        tint,
      });
    }
  }
  solid(kit, -hw + 0.3, 2.75, hd, hw - 0.3, 3.35, hd + 0.15, { layer: FACADE.plain, tint: ground });
  signBoard(kit, -hw + 1, hw - 1, 2.8, 3.3, hd + 0.15, ground, letters, c.id);
  // The awning: a sloped canvas out over the sidewalk, its valance.
  site.sub(0, 0, hd, 0);
  kit.quad(
    [-hw + 0.3, 2.7, 0],
    [hw - 0.3, 2.7, 0],
    [hw - 0.3, 2.25, 1.6],
    [-hw + 0.3, 2.25, 1.6],
    FACADE.plain,
    awning,
  );
  kit.quad(
    [-hw + 0.3, 2.25, 1.6],
    [hw - 0.3, 2.25, 1.6],
    [hw - 0.3, 2.7, 0],
    [-hw + 0.3, 2.7, 0],
    FACADE.plain,
    awning,
  );
  kit.wall(-hw + 0.3, 1.6, hw - 0.3, 1.6, 2.0, 2.25, FACADE.plain, awning);
  kit.wall(hw - 0.3, 1.6, -hw + 0.3, 1.6, 2.0, 2.25, FACADE.plain, awning);
  site.home();
  // The flat over the shop.
  shuttered(site, "front", -hw + 1, hw - 1, 3, g + 0.6, g + 2.2, 1.0, paint, 0.7, 1);
  shuttered(site, "back", -hw + 1, hw - 1, 3, g + 0.6, g + 2.2, 1.0, paint, 0.5, 2);
  windows(site, "back", -hw + 1, hw - 1, 2, 0.9, 2.3, 1.2, 0.4, 3);
  flankWindows(site, "left", -hd + 1.5, hd - 1.5, 2, g + 0.6, g + 2.2, 1.0, paint, 0.5, 4);
  flankWindows(site, "right", -hd + 1.5, hd - 1.5, 2, g + 0.6, g + 2.2, 1.0, paint, 0.5, 5);
  kit.inset(
    -0.6,
    hd,
    0.6,
    hd,
    d.walls + 0.4,
    d.walls + 1.5,
    0.04,
    FACADE.casement,
    0xffffff,
    idHash(c.id, 7) < 0.5,
  );
  endGable(
    site,
    hw,
    hd,
    d.walls,
    d.ridge,
    1.2,
    ROOF,
    { layer: FACADE.boards, tint: timber },
    FASCIA,
    SNOW,
  );
  chimney(kit, -hw * 0.4, -hd * 0.35, d.walls, d.ridge + 0.4, 0.8);
}

// ---------------------------------------------------------------- church

/** The church's tower: its side, its shaft to the belfry's sill, the
 * belfry, the spire's foot and its point, m over the floor — the engine's,
 * whose walls stand it the same (`CHURCH_TOWER`). */
export const TOWER = CHURCH_TOWER;

export function church(site: Site): void {
  const { kit, hw, hd, d } = site;
  const white: Skin = { layer: FACADE.render, tint: 0xfbfaf6 };
  const T = TOWER;
  const th = T.side / 2;
  // The nave: from the back to the tower's back face.
  const naveFront = hd - T.side;
  const nz = (naveFront - hd) / 2;
  const nhd = (naveFront + hd) / 2;
  plinth(site, STONE, T.plinth);
  site.kit.box(-hw, 0, -hd, hw, d.walls, naveFront, white.layer, white.tint, null);
  // Tall round-headed windows down both flanks, lit for evensong.
  for (const side of ["left", "right"] as const) {
    windows(site, side, -hd + 2, naveFront - 1, 4, 2.4, 6.4, 1.2, 0.5, side === "left" ? 1 : 2);
    const x = side === "right" ? hw + 0.05 : -hw - 0.05;
    for (let i = 0; i < 4; i++) {
      const m = -hd + 2 + ((naveFront - 1 + hd - 2) * (i + 0.5)) / 4;
      // The arch over each: a stone hood.
      solid(kit, x, 6.4, m - 0.75, x + (side === "right" ? 0.12 : -0.12), 6.9, m + 0.75, STONE);
    }
  }
  // The apse window at the back.
  windows(site, "back", -1, 1, 1, 3, 6.6, 1.6, 0.5, 3);
  // The nave's roof: its ridge along the church, its gable against the
  // tower.
  endGable(site, hw, nhd, d.walls, d.ridge, 0.8, DARK_ROOF, white, FASCIA, SNOW, 0, nz);
  // THE TOWER: its shaft, a string course, the belfry with its louvred
  // openings and a clock face on every side.
  const t0 = hd - T.side;
  solid(kit, -th, site.base - 0.6, t0, th, 0.4, hd, STONE);
  site.kit.box(-th, 0.4, t0, th, T.shaft, hd, white.layer, white.tint, null);
  solid(kit, -th - 0.15, T.shaft, t0 - 0.15, th + 0.15, T.shaft + 0.35, hd + 0.15, STONE);
  site.kit.box(-th, T.shaft + 0.35, t0, th, T.belfry, hd, white.layer, white.tint, null);
  solid(kit, -th - 0.2, T.belfry, t0 - 0.2, th + 0.2, T.belfry + 0.3, hd + 0.2, STONE);
  // The door into the tower, the porch's steps.
  kit.inset(-0.9, hd, 0.9, hd, 0.4, 3.4, 0.005, FACADE.plain, DOOR_VOID, false);
  solid(kit, -1.4, 3.4, hd, 1.4, 3.7, hd + 0.3, STONE);
  // The tower's windows up the shaft.
  for (const y of [6, 10.5])
    kit.inset(-0.35, hd, 0.35, hd, y, y + 1.6, 0.04, FACADE.window, 0xffffff, false);
  const tz = (t0 + hd) / 2;
  // Louvres and clock on each face: the front, back and flanks.
  const faces: [number, number, number, number][] = [
    [-0.9, hd, 0.9, hd],
    [0.9, t0, -0.9, t0],
    [th, tz + 0.9, th, tz - 0.9],
    [-th, tz - 0.9, -th, tz + 0.9],
  ];
  for (const [x0, z0, x1, z1] of faces) {
    kit.inset(x0, z0, x1, z1, T.shaft + 1.1, T.shaft + 3.2, 0.05, FACADE.louvre, 0x5a4a40, false);
    // The clock: a dark disc as a square face with its gilt hands.
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const nx = -(z1 - z0) / 1.8;
    const nz2 = (x1 - x0) / 1.8;
    const ax = (x1 - x0) / 1.8;
    const az = (z1 - z0) / 1.8;
    const cy = T.shaft - 1.6;
    const r = 0.85;
    const at = (u: number, v: number, out = 0.06): [number, number, number] => [
      mx + ax * u + nx * out,
      cy + v,
      mz + az * u + nz2 * out,
    ];
    kit.quad(at(-r, -r), at(r, -r), at(r, r), at(-r, r), FACADE.plain, 0x1e2a36);
    kit.quad(
      at(-0.05, 0, 0.08),
      at(0.05, 0, 0.08),
      at(0.05, 0.65, 0.08),
      at(-0.05, 0.65, 0.08),
      FACADE.plain,
      0xe6c050,
    );
    kit.quad(
      at(0, -0.05, 0.08),
      at(0.5, -0.05, 0.08),
      at(0.5, 0.05, 0.08),
      at(0, 0.05, 0.08),
      FACADE.plain,
      0xe6c050,
    );
  }
  // THE SPIRE: an eight-sided needle off the belfry's square, sheathed
  // in weathered copper, its snow caught on the sill; the cross at its
  // point.
  const foot: [number, number][] = [];
  const head: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r0 = th * 1.08;
    foot.push([Math.cos(a) * r0, tz + Math.sin(a) * r0]);
    head.push([Math.cos(a) * 0.08, tz + Math.sin(a) * 0.08]);
  }
  kit.frustum(foot, head, T.belfry + 0.3, T.spire, FACADE.roof, 0x6f9a86, null);
  kit.cap(foot, T.belfry + 0.3, FACADE.snow, 0xffffff);
  solid(kit, -0.06, T.spire, tz - 0.06, 0.06, T.spire + 1.6, tz + 0.06, {
    layer: FACADE.plain,
    tint: 0xd9b440,
  });
  solid(kit, -0.5, T.spire + 0.95, tz - 0.06, 0.5, T.spire + 1.1, tz + 0.06, {
    layer: FACADE.plain,
    tint: 0xd9b440,
  });
}
