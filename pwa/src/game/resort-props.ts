// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI AREA'S BUILDINGS' FURNITURE AND FRAME — what the village's and
// the mountain's buildings (`village-build.ts`, `mountain-build.ts`) share:
// the SITE a building is built on (its own frame on the engine's `Cabin`,
// the snow under it, a frame turned or moved inside it for a roof whose
// ridge runs along its front), and the things that stand round a real
// one and sell it at a skier's distance — a gable roof along the front,
// a chimney, a sign board with a row of "letters", picnic tables and
// benches, deck chairs, a furled parasol, ski racks with skis in them, skis
// stood upright in the snow, flags on poles, a radio mast, a toboggan.
// Every piece is a few boxes on the facade kit (`facade-kit.ts`), in the
// painted stack's materials.
//
// Three-free: the arrays are made a mesh by `facade-mesh.ts`.

import { CABINS, type Cabin, type CabinDef, type Level } from "@engine";

import { FACADE, type FacadeLayer } from "./facade-paint.ts";
import { FacadeKit, type Tint, type V3 } from "./facade-kit.ts";

export type Skin = { layer: FacadeLayer; tint: Tint };

/** A small integer hash of a building's id and a salt to 0..1 — the
 * building's own choices (a colourway, which panes are lit), never the
 * engine's stream. */
export function idHash(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** One building's site: the kit set down on its frame (x across its front,
 * +z out of its front, y up from its floor), its measure, how far below
 * the floor the lowest snow under it lies, and the snow at a point of its
 * frame. */
export class Site {
  readonly d: CabinDef;
  readonly hw: number;
  readonly hd: number;
  /** The lowest snow under the walls, below the floor (negative), m. */
  readonly base: number;

  constructor(
    readonly kit: FacadeKit,
    readonly level: Level,
    readonly c: Cabin,
  ) {
    this.d = CABINS[c.kind];
    this.hw = this.d.width / 2;
    this.hd = this.d.depth / 2;
    this.base = c.base - c.y;
    this.home();
  }

  /** Back to the building's own frame. */
  home(): void {
    this.kit.at(this.c.x, this.c.y, this.c.z, this.c.heading);
  }

  /** A frame inside the building's: its origin at (lx, ly, lz) of the
   * building's, turned `turn` radians clockwise from above. A turn of
   * π/2 runs the sub-frame's z along the building's x (a ridge along its
   * front), −π/2 its x out of the front (a mono-pitch falling to the back). */
  sub(lx: number, ly: number, lz: number, turn: number): void {
    this.home();
    const w = this.kit.world([lx, ly, lz]);
    this.kit.at(w[0], w[1], w[2], this.c.heading + turn);
  }

  /** The snow under a point of the building's frame, over the floor, m. */
  ground(lx: number, lz: number): number {
    const { x, z, heading } = this.c;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    return this.level.groundAt(x + lx * fz + lz * fx, z - lx * fx + lz * fz) - this.c.y;
  }

  /** The lowest snow over a rectangle of the building's frame, m over the
   * floor, sampled at its corners and middle. */
  lowest(x0: number, z0: number, x1: number, z1: number): number {
    let lo = Infinity;
    for (const x of [x0, (x0 + x1) / 2, x1])
      for (const z of [z0, (z0 + z1) / 2, z1]) lo = Math.min(lo, this.ground(x, z));
    return lo;
  }
}

/** A box's top, by default the same skin as its sides. */
export function solid(
  kit: FacadeKit,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  s: Skin,
  top: Skin = s,
): void {
  kit.box(
    Math.min(x0, x1),
    y0,
    Math.min(z0, z1),
    Math.max(x0, x1),
    y1,
    Math.max(z0, z1),
    s.layer,
    s.tint,
    top,
  );
}

/** A thin sheet seen from both faces (a flag, a sign's back), from (x0, z0)
 * to (x1, z1) in plan, `y0` to `y1` up. */
export function sheet(
  kit: FacadeKit,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  y1: number,
  tint: Tint,
): void {
  kit.wall(x0, z0, x1, z1, y0, y1, FACADE.plain, tint);
  kit.wall(x1, z1, x0, z0, y0, y1, FACADE.plain, tint);
}

/** A GABLE ROOF with its ridge ALONG THE FRONT (the building's x), its
 * eaves along the front and the back at `eave`, the ridge at `ridge`,
 * `over` m out all round, snow `snow` deep on it; centred at `lz` of the
 * building's frame, `hw` × `hd` of walls under it. */
export function frontGable(
  site: Site,
  hw: number,
  hd: number,
  eave: number,
  ridge: number,
  over: number,
  roof: Skin,
  gable: Skin,
  fascia: Skin,
  snow: number,
  lx = 0,
  lz = 0,
): void {
  site.sub(lx, 0, lz, Math.PI / 2);
  site.kit.gableRoof(hd, hw, eave, ridge - eave, over, roof, gable, fascia, snow);
  site.home();
}

/** A GABLE ROOF with its ridge running OUT OF THE FRONT (the building's z),
 * its gable end to the front. */
export function endGable(
  site: Site,
  hw: number,
  hd: number,
  eave: number,
  ridge: number,
  over: number,
  roof: Skin,
  gable: Skin,
  fascia: Skin,
  snow: number,
  lx = 0,
  lz = 0,
): void {
  site.sub(lx, 0, lz, 0);
  site.kit.gableRoof(hw, hd, eave, ridge - eave, over, roof, gable, fascia, snow);
  site.home();
}

/** A MONO-PITCH roof falling to the back: high over the front at `high`,
 * low over the back at `low`. */
export function backPitch(
  site: Site,
  hw: number,
  hd: number,
  low: number,
  high: number,
  over: number,
  roof: Skin,
  fill: Skin,
  fascia: Skin,
  snow: number,
): void {
  site.sub(0, 0, 0, -Math.PI / 2);
  site.kit.monoRoof(hd, hw, low, high - low, over, roof, fill, fascia, snow);
  site.home();
}

/** A CHIMNEY of stone at (x, z) from `y0` up to `y1`, its cap and snow. */
export function chimney(
  kit: FacadeKit,
  x: number,
  z: number,
  y0: number,
  y1: number,
  w = 0.9,
): void {
  const h = w / 2;
  solid(kit, x - h, y0, z - h, x + h, y1, z + h, { layer: FACADE.stone, tint: 0xd8d4cc });
  solid(kit, x - h - 0.1, y1, z - h - 0.1, x + h + 0.1, y1 + 0.15, z + h + 0.1, {
    layer: FACADE.concrete,
    tint: 0xffffff,
  });
  solid(kit, x - h, y1 + 0.15, z - h, x + h, y1 + 0.35, z + h, {
    layer: FACADE.snow,
    tint: 0xffffff,
  });
}

/** A SIGN BOARD on the front (facing +z) from x0 to x1, y0 to y1, standing
 * `z` out: a board in `ground` with a row of light "letters" across it,
 * their widths off `seed` — a name read as a name from the piste. */
export function signBoard(
  kit: FacadeKit,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  ground: Tint,
  letters: Tint,
  seed: string,
): void {
  solid(kit, x0, y0, z, x1, y1, z + 0.12, { layer: FACADE.plain, tint: ground });
  const h = y1 - y0;
  const ly0 = y0 + h * 0.25;
  const ly1 = y1 - h * 0.25;
  const lw = (ly1 - ly0) * 0.62;
  const gap = lw * 0.28;
  const n = Math.max(3, Math.floor((x1 - x0 - h) / (lw + gap)));
  let x = (x0 + x1) / 2 - (n * (lw + gap) - gap) / 2;
  kit.glow = 1;
  for (let i = 0; i < n; i++) {
    // A space now and then splits the name into words.
    const space = i > 1 && i < n - 2 && idHash(seed, i) < 0.12;
    if (!space)
      kit.wall(
        x,
        z + 0.13,
        x + lw * (0.75 + idHash(seed, i + 40) * 0.3),
        z + 0.13,
        ly0,
        ly1,
        FACADE.plain,
        letters,
      );
    x += lw + gap;
  }
  kit.glow = 0;
}

const TIMBER: Skin = { layer: FACADE.boards, tint: 0xd9b48a };
const DARK_TIMBER: Skin = { layer: FACADE.boards, tint: 0x8a6a50 };

/** A PICNIC TABLE with its two benches at (x, z) on a floor at `y`, its
 * length along x (or along z if `turned`). */
export function picnicTable(kit: FacadeKit, x: number, z: number, y: number, turned = false): void {
  const L = 1.8;
  const box = (a: number, b: number, c: number, d: number, y0: number, y1: number) =>
    turned
      ? solid(kit, x + c, y + y0, z + a, x + d, y + y1, z + b, TIMBER)
      : solid(kit, x + a, y + y0, z + c, x + b, y + y1, z + d, TIMBER);
  box(-L / 2, L / 2, -0.38, 0.38, 0.7, 0.76);
  box(-L / 2, L / 2, -0.82, -0.56, 0.42, 0.47);
  box(-L / 2, L / 2, 0.56, 0.82, 0.42, 0.47);
  // The two A-frame legs, each a block under the top and the benches.
  box(-L / 2 + 0.2, -L / 2 + 0.3, -0.75, 0.75, 0, 0.42);
  box(L / 2 - 0.3, L / 2 - 0.2, -0.75, 0.75, 0, 0.42);
}

/** A DECK CHAIR at (x, z) on a floor at `y`, facing +z (the view): a seat
 * and a raked back in a colour. */
export function deckChair(kit: FacadeKit, x: number, z: number, y: number, tint: Tint): void {
  const s: Skin = { layer: FACADE.plain, tint };
  // The seat from its foot up to the back's foot, and the back raked.
  const a: V3 = [x - 0.3, y + 0.25, z + 0.55];
  const b: V3 = [x + 0.3, y + 0.25, z + 0.55];
  const c: V3 = [x + 0.3, y + 0.35, z - 0.35];
  const d: V3 = [x - 0.3, y + 0.35, z - 0.35];
  const e: V3 = [x + 0.3, y + 0.95, z - 0.7];
  const f: V3 = [x - 0.3, y + 0.95, z - 0.7];
  for (const flip of [false, true]) {
    if (flip) {
      kit.quad(b, a, d, c, s.layer, s.tint);
      kit.quad(c, d, f, e, s.layer, s.tint);
    } else {
      kit.quad(a, b, c, d, s.layer, s.tint);
      kit.quad(d, c, e, f, s.layer, s.tint);
    }
  }
  solid(kit, x - 0.32, y, z + 0.5, x + 0.32, y + 0.25, z + 0.56, DARK_TIMBER);
  solid(kit, x - 0.32, y, z - 0.4, x + 0.32, y + 0.35, z - 0.34, DARK_TIMBER);
}

/** A PARASOL furled in the wind: its pole and the cloth wrapped round it. */
export function parasol(kit: FacadeKit, x: number, z: number, y: number, tint: Tint): void {
  kit.column(x, z, y, y + 2.9, 0.04, FACADE.steel, 0xffffff, 4);
  const sq = (r: number): [number, number][] => [
    [x - r, z - r],
    [x + r, z - r],
    [x + r, z + r],
    [x - r, z + r],
  ];
  kit.frustum(sq(0.12), sq(0.22), y + 1.6, y + 2.6, FACADE.plain, tint, null);
  kit.frustum(sq(0.22), sq(0.04), y + 2.6, y + 2.9, FACADE.plain, tint, {
    layer: FACADE.plain,
    tint,
  });
}

/** Ski colours, bright, as a rack fills with them. */
const SKI_TINTS: readonly Tint[] = [
  0xd8392b, 0x2a6fd6, 0xf2f2f2, 0x1d1f22, 0xf2b81c, 0x2fa65a, 0xe0569b, 0xf07a1e,
];

/** A SKI RACK from x0 to x1 at z on the snow at `y` (the frame's, facing
 * either way): a rail on posts and pairs of skis leaned into it, a share
 * `full` of its slots taken; all one colour (a hire rack) if `hire` is a
 * tint. */
export function skiRack(
  kit: FacadeKit,
  x0: number,
  x1: number,
  z: number,
  y: number,
  seed: string,
  full = 0.7,
  hire: Tint | null = null,
): void {
  const steel: Skin = { layer: FACADE.steel, tint: 0xffffff };
  solid(kit, x0, y + 0.95, z - 0.03, x1, y + 1.02, z + 0.03, steel);
  solid(kit, x0, y + 0.25, z - 0.03, x1, y + 0.3, z + 0.03, steel);
  for (const px of [x0, (x0 + x1) / 2, x1])
    solid(kit, px - 0.03, y - 0.3, z - 0.03, px + 0.03, y + 1.02, z + 0.03, steel);
  const slots = Math.floor((x1 - x0) / 0.32);
  for (let i = 0; i < slots; i++) {
    if (idHash(seed, i) > full) continue;
    const sx = x0 + 0.16 + i * 0.32;
    const side = idHash(seed, i + 300) < 0.5 ? -1 : 1;
    const tint = hire ?? SKI_TINTS[Math.floor(idHash(seed, i + 600) * SKI_TINTS.length)];
    // A pair leaned on the rail, their tails a little out in the snow.
    for (const o of [-0.05, 0.05]) {
      kit.quad(
        [sx + o - 0.04, y - 0.1, z + side * 0.35],
        [sx + o + 0.04, y - 0.1, z + side * 0.35],
        [sx + o + 0.04, y + 1.7, z + side * 0.02],
        [sx + o - 0.04, y + 1.7, z + side * 0.02],
        FACADE.plain,
        tint,
      );
      kit.quad(
        [sx + o + 0.04, y - 0.1, z + side * 0.35],
        [sx + o - 0.04, y - 0.1, z + side * 0.35],
        [sx + o - 0.04, y + 1.7, z + side * 0.02],
        [sx + o + 0.04, y + 1.7, z + side * 0.02],
        FACADE.plain,
        0x2a2c30,
      );
    }
  }
}

/** Skis STOOD UPRIGHT IN THE SNOW in a loose row from x0 to x1 about z, on
 * the snow the site reads under each. */
export function skisInSnow(
  site: Site,
  x0: number,
  x1: number,
  z: number,
  seed: string,
  n: number,
): void {
  const kit = site.kit;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + idHash(seed, i) * 0.6)) / n;
    const zz = z + (idHash(seed, i + 50) - 0.5) * 1.6;
    const y = site.ground(x, zz);
    const tint = SKI_TINTS[Math.floor(idHash(seed, i + 90) * SKI_TINTS.length)];
    const lean = (idHash(seed, i + 130) - 0.5) * 0.3;
    for (const o of [-0.06, 0.06]) {
      solid(kit, x + o - 0.04, y - 0.3, zz - 0.02, x + o + 0.04 + lean * 0.1, y + 1.55, zz + 0.02, {
        layer: FACADE.plain,
        tint,
      });
    }
  }
}

/** A FLAG on a pole at (x, z) from the snow at `y`: the cloth hung off
 * the pole's top to +x, `tint` with a `bar` stripe (or a cross) across. */
export function flagPole(
  kit: FacadeKit,
  x: number,
  z: number,
  y: number,
  high: number,
  tint: Tint,
  bar: Tint | null = null,
  cross = false,
): void {
  kit.column(x, z, y - 0.4, y + high, 0.05, FACADE.steel, 0xffffff, 5);
  const top = y + high - 0.15;
  const w = 1.5;
  const h = 1.0;
  sheet(kit, x + 0.06, z, x + 0.06 + w, z, top - h, top, tint);
  if (bar !== null && !cross)
    sheet(kit, x + 0.06, z + 0.01, x + 0.06 + w, z + 0.01, top - h * 0.62, top - h * 0.38, bar);
  if (bar !== null && cross) {
    sheet(kit, x + 0.06, z + 0.01, x + 0.06 + w, z + 0.01, top - h * 0.6, top - h * 0.4, bar);
    sheet(
      kit,
      x + 0.06 + w * 0.4,
      z + 0.012,
      x + 0.06 + w * 0.6,
      z + 0.012,
      top - h * 0.85,
      top - h * 0.15,
      bar,
    );
  }
}

/** A FEATHER FLAG: a tall bowed banner on a flexible pole, in a colour. */
export function featherFlag(
  kit: FacadeKit,
  x: number,
  z: number,
  y: number,
  tint: Tint,
  edge: Tint,
): void {
  kit.column(x, z, y - 0.3, y + 3.6, 0.03, FACADE.steel, 0x404448, 4);
  const pts: [number, number][] = [
    [0.8, 0.55],
    [1.6, 0.6],
    [2.4, 0.55],
    [3.2, 0.42],
    [3.6, 0.15],
  ];
  let lo: [number, number] = [0.8, 0];
  for (const [yy, w] of pts) {
    sheet(kit, x, z, x + w, z, y + lo[0], y + yy, tint);
    lo = [yy, w];
  }
  sheet(kit, x + 0.01, z + 0.01, x + 0.12, z + 0.01, y + 0.8, y + 3.6, edge);
}

/** A RADIO MAST: a lattice read as a slim steel column with two cross
 * arms and a whip, from `y0` to `y1`. */
export function radioMast(kit: FacadeKit, x: number, z: number, y0: number, y1: number): void {
  kit.column(x, z, y0, y1, 0.07, FACADE.steel, 0xffffff, 4);
  kit.column(x, z, y1, y1 + 1.6, 0.02, FACADE.steel, 0x30343a, 4);
  for (const f of [0.55, 0.85]) {
    const y = y0 + (y1 - y0) * f;
    solid(kit, x - 0.5, y, z - 0.025, x + 0.5, y + 0.05, z + 0.025, {
      layer: FACADE.steel,
      tint: 0xffffff,
    });
  }
  // The red warning lamp at its head, lit after dark.
  kit.glow = 1;
  solid(kit, x - 0.08, y1, z - 0.08, x + 0.08, y1 + 0.16, z + 0.08, {
    layer: FACADE.plain,
    tint: 0xd02020,
  });
  kit.glow = 0;
}

/** A PATROL TOBOGGAN stood on end against a wall facing +z at (x, z): a
 * deep orange tub with its handles. */
export function toboggan(kit: FacadeKit, x: number, z: number, y: number, tint = 0xe2541c): void {
  kit.frustum(
    [
      [x - 0.3, z],
      [x + 0.3, z],
      [x + 0.3, z + 0.32],
      [x - 0.3, z + 0.32],
    ],
    [
      [x - 0.22, z],
      [x + 0.22, z],
      [x + 0.22, z + 0.22],
      [x - 0.22, z + 0.22],
    ],
    y,
    y + 2.3,
    FACADE.plain,
    tint,
    { layer: FACADE.plain, tint },
  );
  solid(kit, x - 0.36, y + 0.9, z + 0.05, x + 0.36, y + 0.95, z + 0.12, {
    layer: FACADE.steel,
    tint: 0x30343a,
  });
}

/** A RED CROSS on a white plaque on a wall facing +z, its middle at (x, y),
 * standing at `z`, `size` m square. */
export function redCross(kit: FacadeKit, x: number, y: number, z: number, size: number): void {
  const h = size / 2;
  solid(kit, x - h, y - h, z, x + h, y + h, z + 0.08, { layer: FACADE.plain, tint: 0xf4f4f2 });
  const a = size * 0.36;
  const b = size * 0.12;
  solid(kit, x - a, y - b, z + 0.08, x + a, y + b, z + 0.12, {
    layer: FACADE.plain,
    tint: 0xc81e1e,
  });
  solid(kit, x - b, y - a, z + 0.08, x + b, y + a, z + 0.12, {
    layer: FACADE.plain,
    tint: 0xc81e1e,
  });
}

/** The plinth from under the lowest snow up to `top` over the floor, a
 * little proud of the walls. */
export function plinth(site: Site, skin: Skin, top = 0, out = 0.1, front = 0): void {
  const { hw, hd } = site;
  solid(site.kit, -hw - out, site.base - 0.6, -hd - out, hw + out, top, hd + out + front, skin);
}

/** A row of `n` punched windows across a wall face, from a to b along it,
 * `y0` to `y1` up — on the front (+z), the back, or a flank (±x). Lit at
 * night by the hash of the building's id (`lit` the share). */
export function windows(
  site: Site,
  face: "front" | "back" | "left" | "right",
  a: number,
  b: number,
  n: number,
  y0: number,
  y1: number,
  w: number,
  lit = 0.7,
  salt = 0,
  layer: FacadeLayer = FACADE.window,
): void {
  const { hw, hd, kit } = site;
  for (let i = 0; i < n; i++) {
    const m = a + ((b - a) * (i + 0.5)) / n;
    const on = idHash(site.c.id, salt * 97 + i) < lit;
    if (face === "front")
      kit.inset(m - w / 2, hd, m + w / 2, hd, y0, y1, 0.04, layer, 0xffffff, on);
    else if (face === "back")
      kit.inset(m + w / 2, -hd, m - w / 2, -hd, y0, y1, 0.04, layer, 0xffffff, on);
    else if (face === "right")
      kit.inset(hw, m + w / 2, hw, m - w / 2, y0, y1, 0.04, layer, 0xffffff, on);
    else kit.inset(-hw, m - w / 2, -hw, m + w / 2, y0, y1, 0.04, layer, 0xffffff, on);
  }
}

/** The four walls of a storey from y0 to y1 in a skin (no top). */
export function storey(site: Site, y0: number, y1: number, skin: Skin, inset = 0): void {
  const { hw, hd } = site;
  site.kit.box(
    -hw + inset,
    y0,
    -hd + inset,
    hw - inset,
    y1,
    hd - inset,
    skin.layer,
    skin.tint,
    null,
  );
}
