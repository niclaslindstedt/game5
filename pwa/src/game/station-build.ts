// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT STATIONS' BUILDINGS, BUILT — every house a lift's two ends
// stand on (`stationHouses`, the box a skier meets) and the station pieces
// `station-plan.ts` lays out that are buildings rather than furniture: the
// detachable TERMINAL over a chair's bullwheel, the operator's BOOTH, a
// gondola's PLATFORM ROOF and its DOOR, a drag's HUT. Built on the facade
// kit (`facade-kit.ts`) in the materials the real ones are built of
// (`docs/buildings.md`), every one with snow on its roof, as ONE geometry
// for the whole resort in world metres.
//
//   * A CHAIR'S FOOT: the drive and the chairs' garage behind the wheel,
//     straddling the line — a concrete plinth, larch boards, a roller door
//     on its back for the chairs, a window band looking up the line over
//     the load, windows and a louvred vent down its flanks, a gable roof
//     with the ridge along the line.
//   * A CHAIR'S TOP: the machine and operator's house beside the way off —
//     boards over a plinth, a window band onto the lane, a door at its end,
//     a mono-pitch roof falling to the lane.
//   * A GONDOLA'S END: a hall — a concrete base, a curtain wall along both
//     flanks, ribbed steel cladding above, a shallow gable roof on deep
//     eaves; over the wheel its PLATFORM ROOF on four columns, the cabins
//     turning under it.
//   * A DRAG'S FOOT: a timber drive hut behind the wheel, a pitched roof.
//   * THE TERMINAL over a chair's wheel: the long white composite hood with
//     its chamfered ends and red band, on two columns at its far end, the
//     wheel under it, a lightning rod on its back.
//
// Three-free: the arrays are made a mesh by `facade-mesh.ts`.

import { stationHouses, type Level, type LiftPlan } from "@engine";

import { FACADE } from "./facade-paint.ts";
import { FacadeKit, type Tint } from "./facade-kit.ts";
import type { Part, StationLayout } from "./station-plan.ts";

/** The tints, sRGB: white leaves a layer as painted. */
export const STATION_TINT = {
  as: 0xffffff,
  /** A booth's and a gondola hall's ribbed sheet. */
  booth: 0xc0392e,
  hall: 0x9aa4ad,
  /** The terminal's band, its underside and the dark steel. */
  stripe: 0xb5262c,
  under: 0x3a3f45,
  dark: 0x2a2e33,
  /** A board wall's door: a dark-stained ledged door. */
  timberDoor: 0x5a3c26,
} as const;
const T = STATION_TINT;

const ROOF = { layer: FACADE.roof, tint: T.as };
const BOARDS = { layer: FACADE.boards, tint: T.as };
const FASCIA = { layer: FACADE.plain, tint: 0x3a3d42 };
const TIMBER_FASCIA = { layer: FACADE.boards, tint: 0xb89a7a };

/** How deep the snow lies on a roof, m. */
const SNOW = { roof: 0.35, small: 0.22 };

/** Build every station of the map into one kit. */
export function buildStationHouses(
  level: Level,
  plans: readonly LiftPlan[],
  layout: StationLayout,
): FacadeKit {
  const kit = new FacadeKit();
  for (const p of plans) {
    stationHouses(level, p).forEach((h, end) => {
      const top = end === 1;
      // The house's own frame: +z up the line (so a foot's front faces
      // its wheel and a top's back does), x across it.
      kit.at(h.x, 0, h.z, p.heading);
      const ground = (lx: number, lz: number) => {
        const w = kit.world([lx, 0, lz]);
        return level.groundAt(w[0], w[2]);
      };
      const floor = h.top - p.look.house.height;
      const hw = h.halfWidth;
      const hl = h.halfLength;
      let high = -Infinity;
      for (const a of [-1, 1])
        for (const b of [-1, 1]) high = Math.max(high, ground(a * hw, b * hl));
      const plinth = Math.min(
        floor + p.look.house.height * 0.3,
        Math.max(floor + 0.3, high + 0.35),
      );
      const house = { hw, hl, base: h.base, plinth, eave: h.top };
      if (p.lift.kind === "gondola") gondolaHall(kit, house, top);
      else if (p.lift.kind === "chair") {
        if (top) chairTopHouse(kit, house);
        else chairDriveHouse(kit, house);
      } else dragHouse(kit, house);
    });
  }
  for (const part of layout.parts) piece(kit, level, part);
  return kit;
}

type House = { hw: number; hl: number; base: number; plinth: number; eave: number };

/** The concrete plinth from under the snow up to the walls' foot. */
function plinth(kit: FacadeKit, h: House, out = 0.08): void {
  kit.box(
    -h.hw - out,
    h.base,
    -h.hl - out,
    h.hw + out,
    h.plinth,
    h.hl + out,
    FACADE.concrete,
    T.as,
  );
}

/** A chair's foot: the drive and the garage the chairs are run into. */
function chairDriveHouse(kit: FacadeKit, h: House): void {
  const { hw, hl, plinth: y0, eave: y1 } = h;
  plinth(kit, h);
  kit.box(-hw, y0, -hl, hw, y1, hl, FACADE.boards, T.as, null);
  // The garage's roller door in its back, a door beside it.
  const door = Math.min(4.2, hw * 0.9);
  kit.inset(
    door / 2 - 0.6,
    -hl,
    -door / 2 - 0.6,
    -hl,
    y0,
    Math.min(y1 - 0.5, y0 + 3.6),
    0.04,
    FACADE.shutter,
    T.as,
  );
  kit.inset(
    door / 2 + 1.2,
    -hl,
    door / 2 + 0.2,
    -hl,
    y0,
    y0 + 2.1,
    0.04,
    FACADE.plain,
    T.timberDoor,
  );
  // The operator's window band up the line, over the load.
  const band = Math.min(1.5, (y1 - y0) * 0.3);
  kit.inset(
    -hw * 0.8,
    hl,
    hw * 0.8,
    hl,
    y1 - band - 0.6,
    y1 - 0.6,
    0.05,
    FACADE.glazing,
    T.as,
    true,
  );
  // Down each flank: two windows and the drive's louvred vent.
  for (const s of [-1, 1]) {
    const x = s * hw;
    for (const z of [-hl * 0.45, hl * 0.25]) {
      kit.inset(
        x,
        z + s * 0.65,
        x,
        z - s * 0.65,
        y0 + 1.3,
        y0 + 2.5,
        0.05,
        FACADE.window,
        T.as,
        true,
      );
    }
    kit.inset(
      x,
      hl * 0.72 + s * 0.6,
      x,
      hl * 0.72 - s * 0.6,
      y0 + 0.5,
      y0 + 1.2,
      0.05,
      FACADE.louvre,
      T.as,
    );
  }
  kit.gableRoof(hw, hl, y1, Math.min(2.2, hw * 0.4), 0.9, ROOF, BOARDS, FASCIA, SNOW.roof);
}

/** A chair's top: the machine and operator's house beside the way off,
 * its −x side onto the lane. */
function chairTopHouse(kit: FacadeKit, h: House): void {
  const { hw, hl, plinth: y0, eave: y1 } = h;
  plinth(kit, h);
  kit.box(-hw, y0, -hl, hw, y1, hl, FACADE.boards, T.as, null);
  // The window band onto the lane (−x faces it), and the door at the end
  // toward the wheel.
  kit.inset(-hw, -hl * 0.75, -hw, hl * 0.75, y0 + 1.1, y0 + 2.5, 0.05, FACADE.glazing, T.as, true);
  kit.inset(0.55, -hl, -0.55, -hl, y0, y0 + 2.1, 0.04, FACADE.plain, T.timberDoor);
  kit.inset(-hw * 0.6, hl, hw * 0.2, hl, y0 + 1.2, y0 + 2.3, 0.05, FACADE.window, T.as, true);
  kit.inset(hw, hl * 0.3, hw, -hl * 0.3, y0 + 0.6, y0 + 1.3, 0.05, FACADE.louvre, T.as);
  kit.monoRoof(hw, hl, y1, 0.9, 0.7, ROOF, BOARDS, FASCIA, SNOW.roof);
}

/** A gondola's hall. */
function gondolaHall(kit: FacadeKit, h: House, top: boolean): void {
  const { hw, hl, plinth: y0, eave: y1 } = h;
  plinth(kit, h, 0.15);
  const wall = Math.min(y0 + 2.6, y1 - 3);
  const glassTop = Math.min(wall + 3, y1 - 1);
  // The concrete base wall all round, the curtain wall along the flanks,
  // ribbed sheet over it and on the ends.
  kit.box(-hw, y0, -hl, hw, wall, hl, FACADE.concrete, T.as, null);
  for (const s of [-1, 1]) {
    kit.inset(s * hw, s * hl, s * hw, -s * hl, wall, glassTop, 0.02, FACADE.glazing, T.as, true);
  }
  kit.box(
    -hw - 0.02,
    glassTop,
    -hl - 0.02,
    hw + 0.02,
    y1,
    hl + 0.02,
    FACADE.cladding,
    T.hall,
    null,
  );
  // The ends between the base and the sheet: sheet too.
  for (const s of [-1, 1]) {
    const z = s * (hl + 0.01);
    kit.wall(-s * hw, z, s * hw, z, wall, glassTop, FACADE.cladding, T.hall);
  }
  // A band of windows high in the end away from the line.
  const z = top ? hl : -hl;
  const sgn = top ? 1 : -1;
  kit.inset(
    -sgn * hw * 0.8,
    z,
    sgn * hw * 0.8,
    z,
    glassTop - 1.8,
    glassTop - 0.3,
    0.04,
    FACADE.glazing,
    T.as,
    true,
  );
  kit.gableRoof(
    hw,
    hl,
    y1,
    Math.min(1.8, hw * 0.25),
    1.3,
    ROOF,
    { layer: FACADE.cladding, tint: T.hall },
    FASCIA,
    SNOW.roof,
  );
}

/** A drag's drive hut. */
function dragHouse(kit: FacadeKit, h: House): void {
  const { hw, hl, plinth: y0, eave: y1 } = h;
  plinth(kit, h);
  kit.box(-hw, y0, -hl, hw, y1, hl, FACADE.boards, T.as, null);
  kit.inset(hw, 0.5, hw, -0.5, y0 + 1, y0 + 1.9, 0.04, FACADE.window, T.as, true);
  kit.inset(0.45, -hl, -0.45, -hl, y0, y0 + 1.95, 0.04, FACADE.plain, T.timberDoor);
  kit.gableRoof(
    hw,
    hl,
    y1,
    Math.max(0.8, hw * 0.55),
    0.45,
    ROOF,
    BOARDS,
    TIMBER_FASCIA,
    SNOW.small,
  );
}

/** One of the layout's pieces that is a building. */
function piece(kit: FacadeKit, level: Level, part: Part): void {
  kit.at(part.x, part.y, part.z, part.yaw);
  const ground = (lx: number, lz: number) => {
    const w = kit.world([lx, 0, lz]);
    return level.groundAt(w[0], w[2]) - part.y;
  };
  switch (part.kind) {
    case "hood":
      return terminal(kit, part.size, ground);
    case "booth":
      return booth(kit, ground);
    case "canopy":
      return platformRoof(kit, part.size, ground);
    case "door":
      return hallDoor(kit);
    case "hut":
      return operatorHut(kit, ground);
    default:
      return;
  }
}

/** The plan of a hood: `w` wide, from `z0` to `z1` along, its corners cut
 * back `c`. */
function chamfered(w: number, z0: number, z1: number, c: number): [number, number][] {
  const x = w / 2;
  return [
    [-x + c, z0],
    [x - c, z0],
    [x, z0 + c],
    [x, z1 - c],
    [x - c, z1],
    [-x + c, z1],
    [-x, z1 - c],
    [-x, z0 + c],
  ];
}

/** A DETACHABLE TERMINAL'S HOOD over the wheel: its frame is the part's —
 * its underside at y 0, +z up the line, the wheel near z 0 — `w` wide and
 * 14 m long, from 4 m past the wheel back over the rail; standing on two
 * columns at its far end. */
function terminal(kit: FacadeKit, w: number, ground: (x: number, z: number) => number): void {
  const z0 = -10;
  const z1 = 4;
  const body = 1.0;
  const cap = 0.7;
  const c = Math.min(1.6, w * 0.22);
  kit.prism(chamfered(w, z0, z1, c), 0, body, FACADE.panel, T.as);
  // The band round it, standing proud.
  kit.prism(chamfered(w + 0.04, z0 - 0.02, z1 + 0.02, c), 0.32, 0.56, FACADE.plain, T.stripe);
  // The cap: the hood's shoulders drawn in to its crown.
  const i = Math.min(1.1, w * 0.16);
  kit.frustum(
    chamfered(w, z0, z1, c),
    chamfered(w - i * 2, z0 + i, z1 - i, Math.max(0.2, c - i * 0.6)),
    body,
    body + cap,
    FACADE.panel,
    T.as,
    { layer: FACADE.panel, tint: 0xe6e8e9 },
  );
  // Snow on the crown, and its underside.
  const s = SNOW.small;
  kit.frustum(
    chamfered(w - i * 2 - 0.1, z0 + i + 0.05, z1 - i - 0.05, Math.max(0.2, c - i * 0.6)),
    chamfered(
      w - i * 2 - 0.1 - s * 2,
      z0 + i + 0.05 + s,
      z1 - i - 0.05 - s,
      Math.max(0.1, c - i * 0.6 - s),
    ),
    body + cap,
    body + cap + s,
    FACADE.snow,
    0xeef3f8,
    { layer: FACADE.snow, tint: 0xffffff },
  );
  kit.cap(chamfered(w, z0, z1, c), 0, FACADE.plain, T.under, true);
  // The two columns at its far end, a lightning rod on its back.
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.7);
    const z = z0 + 1.2;
    kit.box(x - 0.2, ground(x, z) - 0.4, z - 0.2, x + 0.2, 0, z + 0.2, FACADE.steel, T.as, null);
  }
  kit.column(0, z0 + 2, body + cap, body + cap + 3.2, 0.03, FACADE.steel, T.dark, 4);
}

/** THE OPERATOR'S BOOTH: a red ribbed base, glass all round over it, a flat
 * roof overhanging with snow on it; its door on its back (−z). */
function booth(kit: FacadeKit, ground: (x: number, z: number) => number): void {
  const x = 1.2;
  const lo = Math.min(ground(-x, -x), ground(x, -x), ground(-x, x), ground(x, x)) - 0.3;
  kit.box(-x - 0.05, lo, -x - 0.05, x + 0.05, 0.25, x + 0.05, FACADE.concrete, T.as);
  kit.box(-x, 0.25, -x, x, 1.05, x, FACADE.cladding, T.booth, null);
  const was = kit.glow;
  kit.glow = 1;
  kit.box(-x, 1.05, -x, x, 2.2, x, FACADE.glazing, T.as, null);
  kit.glow = was;
  kit.inset(0.95, -x, 0.05, -x, 0.25, 2.15, 0.03, FACADE.door, T.as);
  kit.flatRoof(x, x, 2.2, 0.22, 0.32, { layer: FACADE.plain, tint: 0x3a3d42 }, SNOW.small);
  kit.column(x - 0.3, -x + 0.3, 2.42, 3.8, 0.025, FACADE.steel, T.dark, 4);
}

/** A GONDOLA'S PLATFORM ROOF over its wheel: `w` wide, 12 m along, its
 * underside at y 0, a deep fascia of ribbed sheet round it, on four
 * columns; the cabins turn under it. */
function platformRoof(kit: FacadeKit, w: number, ground: (x: number, z: number) => number): void {
  const hw = w / 2 + 0.6;
  const hl = 6.5;
  kit.box(-hw, 0, -hl, hw, 1.3, hl, FACADE.cladding, T.hall, null);
  kit.cap(
    [
      [-hw, -hl],
      [hw, -hl],
      [hw, hl],
      [-hw, hl],
    ],
    0,
    FACADE.plain,
    T.under,
    true,
  );
  kit.flatRoof(hw, hl, 1.3, 0.25, 0.4, { layer: FACADE.plain, tint: 0x3a3d42 }, SNOW.roof);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (hw - 0.4);
      const z = sz * (hl - 0.6);
      kit.box(
        x - 0.18,
        ground(x, z) - 0.3,
        z - 0.18,
        x + 0.18,
        0,
        z + 0.18,
        FACADE.steel,
        T.as,
        null,
      );
    }
  }
}

/** A GONDOLA HALL'S DOOR: a glazed double door in its frame, proud of the
 * wall, and a little canopy over it. */
function hallDoor(kit: FacadeKit): void {
  kit.inset(-1.5, 0, 1.5, 0, 0, 2.6, 0.06, FACADE.door, T.as, true);
  kit.box(-1.9, 2.75, 0, 1.9, 2.95, 1.4, FACADE.plain, 0x3a3d42, {
    layer: FACADE.snow,
    tint: 0xffffff,
  });
}

/** A DRAG'S OPERATOR HUT: boards, a window looking up the track, a door,
 * a pitched roof with its snow. Its frame: +z the way its window faces. */
function operatorHut(kit: FacadeKit, ground: (x: number, z: number) => number): void {
  const x = 1.1;
  const lo = Math.min(ground(-x, -x), ground(x, -x), ground(-x, x), ground(x, x)) - 0.3;
  kit.box(-x - 0.05, lo, -x - 0.05, x + 0.05, 0.2, x + 0.05, FACADE.concrete, T.as);
  kit.box(-x, 0.2, -x, x, 2.2, x, FACADE.boards, T.as, null);
  kit.inset(-x * 0.75, x, x * 0.75, x, 1.0, 1.9, 0.04, FACADE.window, T.as, true);
  kit.inset(x, 0.45, x, -0.45, 0.2, 2.0, 0.04, FACADE.plain, T.timberDoor);
  kit.gableRoof(x, x, 2.2, 0.75, 0.35, ROOF, BOARDS, TIMBER_FASCIA, SNOW.small);
}

export type { Tint };
