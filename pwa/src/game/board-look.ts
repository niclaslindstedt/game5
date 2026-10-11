// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARD'S LOOK, as numbers — what `board-body.ts` lofts the deck,
// the bindings and the soft boots from, stated off the board's own spec
// (`defs/boards.ts`: its length, waist, nose and tail widths, sidecut,
// stance and binding angles) and the measured bands of the class (the
// project's snowboard research: the outline sheet, the camber profiles, the
// strap binding and the soft boot). Three-free, so the suite reads it.
//
// THE DECK in its own frame: s along it from the middle (−L/2 the tail,
// +L/2 the nose), across it from the centreline, up from the base.
//
//   * THE OUTLINE (`boardHalfWidth`): a twin's sidecut is a circle of the
//     spec's radius between the CONTACT POINTS, which stand at the
//     effective edge's ends (`CONTACT` of the length either side of the
//     middle, the engine's own nose and tail stations' reach) — widest
//     there, `waist` in the middle — and beyond them the nose and the tail
//     round off blunt, as a board's do, to a short flat at the tip.
//   * THE PROFILE (`boardBaseHeight`): a HYBRID — a few millimetres of
//     camber between the feet, flat to slightly lifted out to the contact
//     points, and the nose and the tail KICKED up over their last
//     `KICK.length` to `KICK.rise`. Under a carve the deck BOWS: its middle
//     pressed down onto the arc its edge is cutting (`boardBend`).
//   * THE THICKNESS (`boardThickness`): a wood core of ~13 mm under the
//     feet tapering to ~6 mm at the tips, the sidewalls and the steel edges
//     round it.
//
// THE BINDINGS (`BINDING`): strap bindings — a baseplate turned on its disc
// to the stance's angle, the heel cup behind the heel, the HIGHBACK rising
// behind the calf at its forward lean (0–25° adjustable; ~14° here, an
// all-mountain setting), an ankle strap over the instep and a toe cap over
// the toe box, each with its ratchet.
//
// THE SOFT BOOTS (`SOFT_BOOT`): a laced shell with a bulky toe box and a
// padded cuff to mid-calf — the dress's liner (`dress-garments.ts`'s
// `cutFeet`) stands inside it, its sole 0.275 m under the cuff's top.

/** How far either side of the deck's middle its CONTACT POINTS stand, as a
 * share of its length: the effective edge's ends — the engine's own nose
 * and tail stations stand just inside them (`suspension.ts`). */
export const CONTACT = 0.38;

/** THE NOSE AND THE TAIL'S KICK: how high the tip stands over the base's
 * line, m, and over how much of the length past the contact point it
 * rises — a twin's both alike. */
export const KICK = { rise: 0.055, length: 1 };

/** THE CAMBER between the feet, m (unloaded 5–10 mm; drawn as the rider's
 * weight leaves it), and how far the contact points are lifted off the
 * camber's line, m (a hybrid's 1–2 cm of rocker, drawn loaded). */
export const CAMBER = { rise: 0.004, rocker: 0.006 };

/** THE CORE, m: under the feet, and at the tips. */
export const CORE = { middle: 0.013, tip: 0.006 };

/** THE STRAP BINDING, m and rad: the baseplate's thickness (its disc and
 * pads over the deck), its width and length, the heel cup's height, the
 * highback's height over the sole and its forward lean, the straps' width
 * and thickness. */
export const BINDING = {
  plate: 0.02,
  width: 0.13,
  length: 0.26,
  disc: 0.065,
  cup: 0.075,
  highback: 0.25,
  lean: 0.24,
  strap: 0.05,
  strapThick: 0.018,
};

/** THE SOFT BOOT, m: its length heel to toe, its width at the toe box, the
 * toe box's height, the cuff's top over the sole (the dress's liner — the
 * figure's leg ends there), and the shaft's half widths at the ankle and
 * at the cuff. The cuff stands over the ankle, which sits `heel` behind
 * the boot's middle along its sole. */
export const SOFT_BOOT = {
  length: 0.315,
  width: 0.118,
  toe: 0.095,
  cuff: 0.275,
  ankle: 0.06,
  top: 0.068,
  heel: 0.025,
  sole: 0.022,
};

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A BOARD'S PROFILE from the side, m: each end's KICK (how high its tip
 * stands over the base's line, and how late past the contact point it
 * rises: a `length` under 1 holds the end low and turns it up short at the
 * tip, a directional board's tail), the CAMBER between the feet (a rocker between
 * them is a negative camber: the middle lowest, the feet lifted), and how
 * far each contact point is lifted off the camber's line (a hybrid's or a
 * rockered nose's rise). */
export type BoardProfile = {
  nose: { rise: number; length: number };
  tail: { rise: number; length: number };
  camber: number;
  noseRocker: number;
  tailRocker: number;
};

/** THE ALL-MOUNTAIN TWIN'S PROFILE (the Lynx's): a hybrid — a few
 * millimetres of camber between the feet, the contact points lifted, both
 * ends kicked alike. Every board this does not name is drawn in it. */
export const TWIN_PROFILE: BoardProfile = {
  nose: KICK,
  tail: KICK,
  camber: CAMBER.rise,
  noseRocker: CAMBER.rocker,
  tailRocker: CAMBER.rocker,
};

/** EACH CLASS'S PROFILE, off the research's camber and rocker bands
 * (camber 5–10 mm unloaded, drawn loaded; rocker's contact points lifted
 * 1–2 cm): the beginner's board rockered between the feet, the park twin
 * flat between them, the powder board's long rockered nose and short low
 * tail, the charger's full camber with an early-rise nose, and the
 * carver's full camber on short low tips. */
const PROFILES: Readonly<Record<string, BoardProfile>> = {
  pika: {
    nose: { rise: 0.06, length: 1 },
    tail: { rise: 0.06, length: 1 },
    camber: -0.008,
    noseRocker: 0.012,
    tailRocker: 0.012,
  },
  stoat: {
    nose: { rise: 0.055, length: 1 },
    tail: { rise: 0.055, length: 1 },
    camber: 0,
    noseRocker: 0.009,
    tailRocker: 0.009,
  },
  ptarmigan: {
    nose: { rise: 0.08, length: 1 },
    tail: { rise: 0.035, length: 0.8 },
    camber: 0.004,
    noseRocker: 0.02,
    tailRocker: 0.003,
  },
  wolf: {
    nose: { rise: 0.065, length: 1 },
    tail: { rise: 0.04, length: 0.85 },
    camber: 0.007,
    noseRocker: 0.008,
    tailRocker: 0.001,
  },
  goshawk: {
    nose: { rise: 0.045, length: 0.9 },
    tail: { rise: 0.022, length: 0.7 },
    camber: 0.008,
    noseRocker: 0,
    tailRocker: 0,
  },
};

/** The profile board `id` is drawn in. */
export function profileOf(id: string): BoardProfile {
  return PROFILES[id] ?? TWIN_PROFILE;
}

/** The board's numbers its look is drawn from: its outline, and — off the
 * spec too — how far its middle stands AHEAD of the stance's (`setback`,
 * m: a set-back board's feet stand behind its middle, `SkiSpec.mount`) and
 * its profile. Left out, the twin's: centred, `TWIN_PROFILE`. */
export type BoardShape = {
  length: number;
  waist: number;
  tipWidth: number;
  tailWidth: number;
  sidecut: number;
  setback?: number;
  profile?: BoardProfile;
};

/** HALF THE DECK'S WIDTH at `s` m from the stance's middle (nose
 * positive): the sidecut's circle between the contact points, the end
 * rounded off blunt beyond them. */
export function boardHalfWidth(b: BoardShape, s: number): number {
  const L = b.length;
  const c = CONTACT * L;
  const d = s - (b.setback ?? 0);
  const end = d >= 0 ? b.tipWidth : b.tailWidth;
  const a = Math.abs(d);
  if (a <= c) {
    // The circle through the contact points' width at the spec's radius,
    // its deepest at the middle; held to the waist there.
    const R = b.sidecut;
    const sag = (x: number) => R - Math.sqrt(Math.max(0, R * R - x * x));
    const atContact = end / 2;
    return Math.max(b.waist / 2, atContact - sag(c) + sag(a));
  }
  // Past the contact point: the end rounds off as a squared ellipse,
  // a little wider at first (the widest point just past contact).
  const u = clamp((a - c) / (L / 2 - c), 0, 1);
  const bulge = 1 + 0.02 * Math.sin(Math.PI * Math.min(1, u * 2));
  return (end / 2) * bulge * Math.pow(Math.max(0, 1 - Math.pow(u, 2.6)), 1 / 2.6);
}

/** THE BASE'S HEIGHT over the line the contact points stand on, m, at `s`
 * m from the stance's middle: the camber between the feet, the contact
 * points' rocker, and each end kicked up past its contact point. */
export function boardBaseHeight(b: BoardShape, s: number, stance: number): number {
  const P = b.profile ?? TWIN_PROFILE;
  const back = b.setback ?? 0;
  const L = b.length;
  const c = CONTACT * L;
  const d = s - back;
  const nose = d >= 0;
  const a = Math.abs(d);
  const lift = nose ? P.noseRocker : P.tailRocker;
  if (a > c) {
    // THE KICK: rising ever steeper to the tip, then rounding over it.
    const K = nose ? P.nose : P.tail;
    const u = clamp((a - c) / (L / 2 - c), 0, 1) ** (1 / K.length);
    return lift + K.rise * (1 - Math.cos((Math.PI / 2) * u)) ** 1.3 * (1 + 0.15 * u);
  }
  const feet = stance / 2;
  const af = Math.abs(s);
  if (af <= feet) {
    // Camber: highest in the middle, down to the feet.
    const u = af / Math.max(1e-6, feet);
    return P.camber * (1 - u * u);
  }
  // From the feet out to the contact point, lifted off the line.
  const reach = Math.abs((nose ? c : -c) + back);
  const u = (af - feet) / Math.max(1e-6, reach - feet);
  return lift * u * u;
}

/** THE DECK'S THICKNESS at `s` m from the stance's middle, m. */
export function boardThickness(b: BoardShape, s: number): number {
  const d = s - (b.setback ?? 0);
  const u = clamp(Math.abs(d) / (b.length / 2), 0, 1);
  return CORE.tip + (CORE.middle - CORE.tip) * Math.cos((Math.PI / 2) * u) ** 0.8;
}

/** THE DECK BOWED BY A CARVE, 1/m: a board stood on `edge` rad with a
 * sidecut of `sidecut` m cuts an arc of `sidecut · cos(edge)` (Howe's
 * relation) — tighter than its own sidecut lying flat — and lies on that
 * arc only bent: its middle pressed down off the line of its ends, a
 * curvature of `sin(edge) / sidecut` across its own plane (est.). Nought
 * flat, and carried only by a deck loaded on its edge (`load`, 0..1). */
export function boardBend(edge: number, sidecut: number, load = 1): number {
  return (Math.sin(Math.min(1.3, Math.abs(edge))) / Math.max(1, sidecut)) * clamp(load, 0, 1);
}

/** How far the deck's base is bowed up off its middle at `s` m along it,
 * m, under a bend of `k` 1/m: the ends stand up off the pressed middle as
 * an arc's do (`k s² / 2`), held inside the contact points and carried
 * straight on past them with the kick. */
export function bowAt(k: number, s: number, length: number): number {
  const c = CONTACT * length;
  const a = Math.min(Math.abs(s), c);
  const past = Math.max(0, Math.abs(s) - c);
  return (k * a * a) / 2 + k * c * past;
}

/** A BOARD'S TOPSHEET: the deck's paint, its graphic's trim and a second
 * tone, the sidewalls, the base and the base's graphic, the bindings'
 * frame, straps and highbacks, and the boots' shell, laces and cuff — one
 * a board, never picked. */
export type BoardSheet = {
  name: string;
  paint: number;
  trim: number;
  second: number;
  sidewall: number;
  base: number;
  baseArt: number;
  binding: number;
  strap: number;
  highback: number;
  boot: number;
  bootTrim: number;
  /** The graphic, decals on the deck's top in (u, v): u along it from the
   * tail (0) to the nose (1), v across from the left edge (−1) to the
   * right (1); each a closed convex outline, the trim's, and then the
   * second tone's. */
  top: [number, number][][];
  second2: [number, number][][];
  /** The base's graphic, the same way, seen from below. */
  under: [number, number][][];
};

/** A slanted band across the deck from `u0` to `u1` at the left edge,
 * leaning `lean` (u) toward the nose at the right edge. */
function band(u0: number, u1: number, lean: number): [number, number][] {
  return [
    [u0, -0.98],
    [u1, -0.98],
    [u1 + lean, 0.98],
    [u0 + lean, 0.98],
  ];
}

/** THE LYNX'S SHEET: a deep slate-blue deck, a TWIN's graphic mirrored
 * nose and tail — a broad warm band either side of the middle, slanted the
 * way the feet stand, and a cat's two ear-tufts of the second tone at
 * each tip — so it reads the same ridden either way round; an off-white
 * base with the band again in the trim; black bindings with warm straps,
 * and grey soft boots. */
export const LYNX_SHEET: BoardSheet = {
  name: "Lynx",
  paint: 0x2c3e5c,
  trim: 0xe8953a,
  second: 0xeee6d4,
  sidewall: 0x16181c,
  base: 0xe9e4d8,
  baseArt: 0xd8572a,
  binding: 0x1b1d21,
  strap: 0xd9822f,
  highback: 0x26292f,
  boot: 0x4a4f57,
  bootTrim: 0x1f2226,
  top: [band(0.3, 0.37, 0.06), band(0.63, 0.7, -0.06)],
  second2: [
    // The tips' tufts, a pair of triangles at each end.
    [
      [0.02, -0.55],
      [0.13, -0.32],
      [0.04, -0.1],
    ],
    [
      [0.02, 0.55],
      [0.04, 0.1],
      [0.13, 0.32],
    ],
    [
      [0.98, -0.55],
      [0.96, -0.1],
      [0.87, -0.32],
    ],
    [
      [0.98, 0.55],
      [0.87, 0.32],
      [0.96, 0.1],
    ],
    // A slim rule down the middle between the bands.
    [
      [0.4, -0.08],
      [0.6, -0.08],
      [0.6, 0.08],
      [0.4, 0.08],
    ],
  ],
  under: [band(0.18, 0.3, 0.08), band(0.7, 0.82, -0.08)],
};

/** A ROUNDED BLOB of the deck's graphic: an `n`-sided polygon about (u, v)
 * with half sizes `ru` along the deck and `rv` across it. */
function blob(u: number, v: number, ru: number, rv: number, n = 8): [number, number][] {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [u + Math.cos(a) * ru, v + Math.sin(a) * rv] as [number, number];
  });
}

/** A CHEVRON pointing toward the nose (`dir` 1) or the tail (−1), its
 * point at `u`, `depth` deep along the deck and `thick` thick: two convex
 * halves, each a slanted bar from an edge to the middle. */
function chevron(u: number, depth: number, thick: number, dir = 1): [number, number][][] {
  const tip = u;
  const foot = u - dir * depth;
  return [
    [
      [foot, -0.98],
      [foot + dir * thick, -0.98],
      [tip + dir * thick, 0],
      [tip, 0],
    ],
    [
      [tip, 0],
      [tip + dir * thick, 0],
      [foot + dir * thick, 0.98],
      [foot, 0.98],
    ],
  ];
}

/** THE PIKA'S SHEET: a moss-green deck scattered with warm yellow pebbles
 * and a cream rule round its middle — friendly and plain, as a first board
 * is — with green bindings and tan boots. */
export const PIKA_SHEET: BoardSheet = {
  name: "Pika",
  paint: 0x55803a,
  trim: 0xf0c04a,
  second: 0xefe7d2,
  sidewall: 0x1c1f1a,
  base: 0x2d3a26,
  baseArt: 0xf0c04a,
  binding: 0x2b3326,
  strap: 0x6f9a45,
  highback: 0x2e3529,
  boot: 0x8a6a48,
  bootTrim: 0x3a2c20,
  top: [
    blob(0.16, -0.45, 0.04, 0.3),
    blob(0.22, 0.35, 0.03, 0.22),
    blob(0.8, 0.42, 0.04, 0.3),
    blob(0.86, -0.3, 0.03, 0.22),
    blob(0.5, 0.0, 0.05, 0.45),
  ],
  second2: [band(0.44, 0.46, 0), band(0.54, 0.56, 0)],
  under: [blob(0.25, 0, 0.08, 0.6), blob(0.75, 0, 0.08, 0.6)],
};

/** THE STOAT'S SHEET: a black park deck, a TWIN's graphic mirrored about
 * the middle — red chevrons pointing out to both tips and a cream bar
 * across the waist — so it reads alike ridden either way; red straps and
 * black boots. */
export const STOAT_SHEET: BoardSheet = {
  name: "Stoat",
  paint: 0x1b1c21,
  trim: 0xd8452c,
  second: 0xefe9dc,
  sidewall: 0x0f1013,
  base: 0xd8452c,
  baseArt: 0x1b1c21,
  binding: 0x16171b,
  strap: 0xd8452c,
  highback: 0x1f2126,
  boot: 0x2a2c31,
  bootTrim: 0xd8452c,
  top: [...chevron(0.86, 0.12, 0.05, 1), ...chevron(0.14, 0.12, 0.05, -1)],
  second2: [band(0.46, 0.54, 0)],
  under: [...chevron(0.8, 0.14, 0.06, 1), ...chevron(0.2, 0.14, 0.06, -1)],
};

/** THE PTARMIGAN'S SHEET: a burnt-orange directional deck, a feathered
 * arrow of cream chevrons running up to the nose and a dark band at the
 * tail, so which way it points is read at a glance; dark bindings with
 * orange straps and brown boots. */
export const PTARMIGAN_SHEET: BoardSheet = {
  name: "Ptarmigan",
  paint: 0xc4561f,
  trim: 0xf2ece0,
  second: 0x2a2421,
  sidewall: 0x1a1512,
  base: 0x2a2421,
  baseArt: 0xc4561f,
  binding: 0x231f1c,
  strap: 0xd0692c,
  highback: 0x2a2522,
  boot: 0x5b4636,
  bootTrim: 0x221b16,
  top: [
    ...chevron(0.9, 0.1, 0.035, 1),
    ...chevron(0.8, 0.1, 0.035, 1),
    ...chevron(0.7, 0.1, 0.035, 1),
  ],
  second2: [band(0.04, 0.16, 0)],
  under: [...chevron(0.85, 0.16, 0.06, 1)],
};

/** THE WOLF'S SHEET: a graphite deck, a long gold stripe from the tail to
 * the nose down its middle and two deep red slashes across it ahead of the
 * front foot; black bindings with gold straps and dark grey boots. */
export const WOLF_SHEET: BoardSheet = {
  name: "Wolf",
  paint: 0x3a3f46,
  trim: 0xc9a227,
  second: 0x8c1f1f,
  sidewall: 0x151719,
  base: 0x1d1f22,
  baseArt: 0xc9a227,
  binding: 0x17191c,
  strap: 0xc9a227,
  highback: 0x202327,
  boot: 0x3c4046,
  bootTrim: 0x16181b,
  top: [
    [
      [0.08, -0.07],
      [0.92, -0.07],
      [0.92, 0.07],
      [0.08, 0.07],
    ],
  ],
  second2: [band(0.74, 0.77, 0.08), band(0.8, 0.83, 0.08)],
  under: [band(0.3, 0.7, 0)],
};

/** THE GOSHAWK'S SHEET: a race board's — a deep blue deck, a yellow race
 * block at the nose with a white number panel in it and a yellow bar at
 * the tail; plate bindings in black and white hard-boot shells. */
export const GOSHAWK_SHEET: BoardSheet = {
  name: "Goshawk",
  paint: 0x163f78,
  trim: 0xf2c400,
  second: 0xf0f0ec,
  sidewall: 0x0d1420,
  base: 0x101a2c,
  baseArt: 0xf2c400,
  binding: 0x141518,
  strap: 0x2a2c30,
  highback: 0x1a1c20,
  boot: 0xd9dbe0,
  bootTrim: 0x1c1e22,
  top: [band(0.72, 0.9, 0), band(0.08, 0.13, 0)],
  second2: [
    [
      [0.76, -0.45],
      [0.86, -0.45],
      [0.86, 0.45],
      [0.76, 0.45],
    ],
  ],
  under: [band(0.45, 0.55, 0)],
};

/** EVERY BOARD'S SHEET, by its id. */
const SHEETS: Readonly<Record<string, BoardSheet>> = {
  lynx: LYNX_SHEET,
  pika: PIKA_SHEET,
  stoat: STOAT_SHEET,
  ptarmigan: PTARMIGAN_SHEET,
  wolf: WOLF_SHEET,
  goshawk: GOSHAWK_SHEET,
};

/** The sheet a board is drawn in: its own, and the Lynx's for a board this
 * build does not carry (a lab's own spec). */
export function sheetOf(id: string): BoardSheet {
  return SHEETS[id] ?? LYNX_SHEET;
}
