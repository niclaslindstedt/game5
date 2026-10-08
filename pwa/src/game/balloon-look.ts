// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON AS DRAWN — the measures, the shape and the paint the
// renderer builds it from (`balloon-envelope.ts`, `balloon-basket.ts`,
// hung on the engine's state by `balloon-scene.ts`). Three-free, so the
// suite reads it (`tests/balloon_look_test.ts`) and holds it to the
// engine's own `BALLOON`: the envelope's volume, height, widest girth and
// mouth, its gores, the basket's floor and wall, the burner's height.
//
// What a sport balloon of the "90" class looks like, as photographs of the
// class show it and its makers describe it (`docs/hot-air-balloon.md`):
//
//   * THE ENVELOPE is a NATURAL SHAPE — the shape a fabric bag takes when
//     only its vertical tapes carry the load: a crown rounded nearly as a
//     sphere is, widest a little above the middle, and below that a long,
//     nearly straight cone that tapers to the mouth. Its GORES are sewn from
//     horizontal PANELS; a vertical LOAD TAPE runs up every gore seam from
//     the mouth to the CROWN RING, and a horizontal tape over every panel
//     seam stops a tear spreading. The fabric is cut wider than the tapes
//     are apart, so between two tapes it BULGES outward under the pressure
//     inside, and a balloon seen against the sky has a scalloped outline.
//   * THE PARACHUTE VALVE closes a hole in the crown: a round panel of its
//     own cloth under the opening, overlapped by the envelope round its
//     rim, the load tapes crossing over it to the crown ring. From under
//     the mouth its edge reads as a ring and its shroud lines fan down the
//     inside walls; its red-and-white cord hangs down to the basket.
//   * THE SKIRT, a sleeve of flame-resistant cloth, hangs from the mouth
//     round the FLYING WIRES — stainless cables, one off each load tape's
//     foot, gathered four to a corner of the BURNER FRAME — and keeps a
//     wind off the flame.
//   * THE BURNER: a square stainless frame on four nylon rods in padded
//     sleeves standing out of the basket's corners, a double burner hung
//     in it — two COILS of stainless tube round their jets, browned by the
//     heat, over the blast valves and their handles — the hoses down to the
//     cylinders.
//   * THE BASKET is woven of willow and cane round a stainless frame, its
//     top rim rolled in leather or suede, rope handles woven into its sides,
//     a solid floor on runners; the propane CYLINDERS stand in its corners
//     in padded covers.
//   * THE COLOURS: bold panels, never pastel — gores alternating two
//     colours, bands round the girth, chevrons and diamonds round the
//     equator, a spiral stepped up the gores, the rainbow, a sunburst at the
//     crown. Each map deals its balloon one (`colourwayOf`, a salt of its
//     own off the map's seed — presentation only, no digest can see it).
//
// THE FRAMES: the envelope's own has its origin at the MOUTH's centre, y up
// its axis; the basket's has its origin at the FLOOR's centre (the engine's
// `BalloonState.x/y/z`), x to its right, y up, z forward.

import { BALLOON } from "@engine";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";

const E = BALLOON.envelope;
const K = BALLOON.basket;

/** THE ENVELOPE'S SHAPE AND CUT. */
export const ENVELOPE_LOOK = {
  /** The natural shape's lower cone: how far out it runs for every metre up
   * as it leaves the mouth (a cone of ~29° off the axis), and how far up
   * the cone's run holds (shares of the equator's height) before it rounds
   * into the girth. */
  flare: 0.55,
  cone: 0.35,
  girth: 0.25,
  /** The crown's rounding over the equator: a superellipse's exponent (2 a
   * true ellipse; a little more, the crown a little flatter). */
  crown: 2.15,
  /** PANELS up a gore, mouth to the parachute's rim — each about 1.5 m along
   * the gore, as the class is cut. */
  rows: 16,
  /** The bulge between two load tapes: its depth as a share of the chord
   * between them (the fabric's lobe). */
  lobe: 0.13,
  /** Strips across a gore, and up a panel, the mesh is cut in. */
  across: 8,
  down: 3,
  /** Rows of the parachute's cap, rim to crown. */
  cap: 4,
  /** A load tape's width, m, and how far its tone is lifted off the panel's
   * (a tape is sewn on over the seam, of a paler webbing). */
  tape: 0.05,
  tapeTone: 0.16,
  /** A horizontal tape's width, m, and its tone (lighter work than the
   * load tapes', and read the less for it). */
  band: 0.035,
  bandTone: 0.08,
  /** A sewn seam's width, m (the panel seams under the horizontal tapes). */
  seam: 0.03,
  /** The crown ring's radius, m, and the ring round the parachute's rim. */
  crownRing: 0.22,
  /** THE SKIRT: how far it hangs under the mouth, m, along the wires, and
   * its rows. */
  skirt: 1.7,
  skirtRows: 2,
} as const;

/** THE BURNER AND ITS FRAME, in the basket's frame. */
export const BURNER_LOOK = {
  /** The frame: its height over the floor, m, its half-width, m, and its
   * tube's radius, m. */
  frameY: 2.15,
  frameHalf: 0.42,
  frameTube: 0.022,
  /** The two coils, side by side across: their centres off the middle, m,
   * the coil's radius, the tube's, its turns and its height, m. */
  coilX: 0.16,
  coilR: 0.115,
  coilTube: 0.016,
  coilTurns: 5,
  coilHeight: 0.25,
  /** The jets' outlets, where the flame leaves the coils: over the floor, m
   * — the engine's `basket.burner`. */
  outlet: K.burner,
  /** The rods' padded sleeves: radius, m. */
  sleeve: 0.042,
} as const;

/** THE BASKET AND WHAT STANDS IN IT, in the basket's frame. */
export const BASKET_LOOK = {
  /** The wall's corners rounded, m, and its weave's thickness, m. */
  corner: 0.13,
  thick: 0.05,
  /** The rim's roll of leather, its radius, m. */
  rim: 0.055,
  /** The floor's runners under it, m deep. */
  runner: 0.05,
  /** A weave's tile, m: four stakes across it, sixteen rows of weavers up. */
  tile: 0.1,
  /** The rope handles: how many on a long side and on a short one, their
   * height over the floor, m, their loop's radius and the rope's, m. */
  handlesLong: 2,
  handlesShort: 1,
  handleY: 0.82,
  handleR: 0.075,
  handleRope: 0.013,
  /** THE CYLINDERS (`BALLOON.mass.cylinders`, three): a 20 kg propane
   * flight cylinder's radius and height, m, and how far its centre stands
   * in from the walls, m; the corner each stands in (±1 across, ±1 along);
   * the fourth corner is the pilot's. */
  cylR: 0.155,
  cylH: 0.8,
  cylIn: 0.22,
  cylinders: [
    [1, 1],
    [-1, 1],
    [-1, -1],
  ] as readonly (readonly [number, number])[],
  /** The pair lashed outside the long wall on this side (±1 across) while
   * he is aboard; the corner (with ±1 along) is the pilot's, free of a
   * cylinder. */
  rack: [1, -1] as const,
} as const;

/** The envelope's whole height drawn over the basket's floor, m: the mouth's
 * height, the envelope to its crown. */
export const DRAWN_HEIGHT = E.mouthHeight + E.height;

// ── THE PROFILE ─────────────────────────────────────────────────────────

/** The meridian sampled: radius and height at each point, the arc length
 * along it from the mouth. */
export type Profile = { r: Float64Array; y: Float64Array; s: Float64Array };

const SAMPLES = 400;
let profileMemo: Profile | null = null;

/** THE NATURAL SHAPE's meridian, mouth (y 0) to crown (y = height): a cubic
 * from the mouth, leaving it at the cone's flare, into the girth at the
 * equator; a superellipse over the crown. */
export function profile(): Profile {
  if (profileMemo) return profileMemo;
  const L = ENVELOPE_LOOK;
  const R = E.diameter / 2;
  const rm = E.mouth / 2;
  const eq = E.equator;
  const n = 2 * SAMPLES + 1;
  const r = new Float64Array(n);
  const y = new Float64Array(n);
  const s = new Float64Array(n);
  const p1 = [rm + L.cone * L.flare * eq, L.cone * eq];
  const p2 = [R, eq - L.girth * eq];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const a = (1 - t) ** 3;
    const b = 3 * (1 - t) ** 2 * t;
    const c = 3 * (1 - t) * t * t;
    const d = t ** 3;
    r[i] = a * rm + b * p1[0] + c * p2[0] + d * R;
    y[i] = b * p1[1] + c * p2[1] + d * eq;
  }
  for (let i = 1; i <= SAMPLES; i++) {
    // Even in angle over the crown, so the cap is sampled as finely as the
    // girth.
    const th = (i / SAMPLES) * (Math.PI / 2);
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    // A superellipse (|x/R|^p + |y/h|^p = 1) by its angle.
    const k = (cs ** L.crown + sn ** L.crown) ** (-1 / L.crown);
    r[SAMPLES + i] = R * cs * k;
    y[SAMPLES + i] = eq + (E.height - eq) * sn * k;
  }
  r[n - 1] = 0;
  y[n - 1] = E.height;
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(r[i] - r[i - 1], y[i] - y[i - 1]);
  profileMemo = { r, y, s };
  return profileMemo;
}

/** The meridian's point an arc `at` m from the mouth: its radius and
 * height, and the meridian's direction there (dr, dy, unit). */
export function meridianAt(at: number): { r: number; y: number; dr: number; dy: number } {
  const p = profile();
  const n = p.s.length;
  const want = Math.max(0, Math.min(p.s[n - 1], at));
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p.s[mid] <= want) lo = mid;
    else hi = mid;
  }
  const f = (want - p.s[lo]) / Math.max(1e-9, p.s[hi] - p.s[lo]);
  const dr = p.r[hi] - p.r[lo];
  const dy = p.y[hi] - p.y[lo];
  const len = Math.hypot(dr, dy) || 1;
  return { r: p.r[lo] + dr * f, y: p.y[lo] + dy * f, dr: dr / len, dy: dy / len };
}

/** The arc along the meridian from the mouth to the parachute's rim, m (the
 * point on the crown whose radius is the vent's), and to the crown. */
export function ventArc(): number {
  const p = profile();
  const rv = E.vent / 2;
  for (let i = p.r.length - 1; i > 0; i--) {
    if (p.r[i] >= rv && p.y[i] > E.equator) return p.s[i];
  }
  return p.s[p.s.length - 1];
}
export function crownArc(): number {
  const p = profile();
  return p.s[p.s.length - 1];
}

/** The radius off the axis at `u` across a gore (0 and 1 its tapes) where
 * the profile's girth is `r`: the straight chord between the two tapes,
 * bulged out into the fabric's lobe, its crown at `r`. */
export function lobedRadius(r: number, u: number): number {
  return (r * lobeOf(u)) / LOBE_PEAK;
}

/** The section's radius at `u` across a gore over the tapes' circle. */
function lobeOf(u: number): number {
  const half = Math.PI / E.gores;
  const chord = Math.cos(half) / Math.cos((u - 0.5) * 2 * half);
  return chord + ENVELOPE_LOOK.lobe * 2 * Math.sin(half) * Math.sin(Math.PI * u);
}

/** The lobe's crown over the tapes' circle: the profile's radius is the
 * envelope's girth measured over its lobes (as a balloon's published
 * diameter is), so the tapes stand this much inside it. */
const LOBE_PEAK = lobeOf(0.5);

/** Where gore `g`'s first tape stands round the axis, rad off +x toward +z —
 * turned so the tapes gather onto the burner frame's corners in fours. */
export function tapeAngle(i: number): number {
  return ((i + 0.5) * 2 * Math.PI) / E.gores;
}

// ── THE MESH ────────────────────────────────────────────────────────────

/** THE ENVELOPE'S MESH, in its own frame: every panel its own grid of
 * vertices, so the paint changes crisply at its seams (`aPanel`: the gore,
 * the row — `rows` the parachute's cap, −1 the skirt — and where in the
 * panel, u across and v up, each 0..1), the gore's width there (`aWidth`,
 * m, what the tapes are drawn in metres by), the analytic normal. */
export type EnvelopeLayout = {
  vertices: number;
  position: Float32Array;
  normal: Float32Array;
  panel: Float32Array;
  width: Float32Array;
  index: Uint32Array;
  /** The first vertex of the parachute's cap and of the skirt. */
  capFrom: number;
  skirtFrom: number;
};

let layoutMemo: EnvelopeLayout | null = null;

/** The envelope's point at arc `at` along the meridian, `u` across gore `g`,
 * written into `out` at `o` (position) — and its normal into `nrm`. Below
 * the mouth (`at` < 0) it is the skirt's, coned in along the wires. */
function envelopePoint(
  g: number,
  u: number,
  at: number,
  pos: Float32Array,
  nrm: Float32Array,
  o: number,
): number {
  const ang = tapeAngle(g) + (u * 2 * Math.PI) / E.gores;
  let r: number;
  let y: number;
  let dr: number;
  let dy: number;
  if (at < 0) {
    // THE SKIRT, down along the wires toward the burner frame's corners.
    const corner = Math.SQRT2 * BURNER_LOOK.frameHalf;
    const drop = E.mouthHeight - BURNER_LOOK.frameY;
    const k = -at / drop;
    r = E.mouth / 2 + (corner - E.mouth / 2) * k;
    y = at;
    const len = Math.hypot(E.mouth / 2 - corner, drop);
    dr = (E.mouth / 2 - corner) / len;
    dy = drop / len;
  } else {
    const m = meridianAt(at);
    r = m.r;
    y = m.y;
    dr = m.dr;
    dy = m.dy;
  }
  const rr = lobedRadius(r, u);
  const cx = Math.cos(ang);
  const cz = Math.sin(ang);
  pos[o] = rr * cx;
  pos[o + 1] = y;
  pos[o + 2] = rr * cz;
  // The normal: out of the meridian (dy, −dr) turned round the axis, leant
  // across the lobe by its slope.
  const lobeTilt = ENVELOPE_LOOK.lobe * Math.PI * Math.cos(Math.PI * u);
  const nx = dy * cx;
  const nz = dy * cz;
  const ny = -dr;
  // The lobe's slope across: along the circle's tangent (−sin, cos).
  const tx = -cz;
  const tz = cx;
  const lx = nx - tx * lobeTilt;
  const lz = nz - tz * lobeTilt;
  const len = Math.hypot(lx, ny, lz) || 1;
  nrm[o] = lx / len;
  nrm[o + 1] = ny / len;
  nrm[o + 2] = lz / len;
  return rr;
}

/** THE ENVELOPE'S MESH (memoised: one shape, every balloon). */
export function envelopeLayout(): EnvelopeLayout {
  if (layoutMemo) return layoutMemo;
  const L = ENVELOPE_LOOK;
  const G = E.gores;
  const nu = L.across + 1;
  const nvPanel = L.down + 1;
  const nvCap = L.cap + 1;
  const nvSkirt = L.skirtRows + 1;
  const perGore = nu * (L.rows * nvPanel + nvCap + nvSkirt);
  const vertices = G * perGore;
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const panel = new Float32Array(vertices * 4);
  const width = new Float32Array(vertices);
  const quads = G * L.across * (L.rows * L.down + L.cap + L.skirtRows);
  const index = new Uint32Array(quads * 6);
  const vent = ventArc();
  const crown = crownArc();
  let v = 0;
  let q = 0;
  const grid = (g: number, row: number, from: number, to: number, nv: number): void => {
    const base = v;
    for (let j = 0; j < nv; j++) {
      const fv = j / (nv - 1);
      const at = from + (to - from) * fv;
      for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1);
        const rr = envelopePoint(g, u, at, position, normal, v * 3);
        panel[v * 4] = g;
        panel[v * 4 + 1] = row;
        panel[v * 4 + 2] = u;
        panel[v * 4 + 3] = fv;
        width[v] = 2 * rr * Math.sin(Math.PI / G);
        v++;
      }
    }
    for (let j = 0; j < nv - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = base + j * nu + i;
        const b = a + 1;
        const c = a + nu;
        const d = c + 1;
        // Wound so the outside faces out (u runs round toward +z from +x).
        index.set([a, c, b, b, c, d], q);
        q += 6;
      }
    }
  };
  let capFrom = 0;
  let skirtFrom = 0;
  for (let g = 0; g < G; g++) {
    for (let row = 0; row < L.rows; row++) {
      grid(g, row, (vent * row) / L.rows, (vent * (row + 1)) / L.rows, nvPanel);
    }
  }
  capFrom = v;
  for (let g = 0; g < G; g++) grid(g, L.rows, vent, crown, nvCap);
  skirtFrom = v;
  const drop = E.mouthHeight - BURNER_LOOK.frameY;
  for (let g = 0; g < G; g++) grid(g, -1, -Math.min(L.skirt, drop * 0.85), 0, nvSkirt);
  layoutMemo = { vertices, position, normal, panel, width, index, capFrom, skirtFrom };
  return layoutMemo;
}

/** THE ENVELOPE'S VOLUME as drawn, m³: the lobed section integrated up the
 * meridian, mouth to crown. */
export function drawnVolume(): number {
  const p = profile();
  // The lobed section's area over a circle of the tapes' radius.
  const n = 64;
  let area = 0;
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n;
    const rr = lobedRadius(1, u);
    area += 0.5 * rr * rr * ((2 * Math.PI) / E.gores / n);
  }
  area *= E.gores;
  let V = 0;
  for (let i = 1; i < p.r.length; i++) {
    const r = (p.r[i] + p.r[i - 1]) / 2;
    V += area * r * r * (p.y[i] - p.y[i - 1]);
  }
  return V;
}

// ── THE FLYING WIRES ─────────────────────────────────────────────────────

/** A flying wire: the load tape it hangs off (its foot at the mouth, in the
 * envelope's frame) and the burner frame's corner it is clipped to (in the
 * basket's frame). */
export type Wire = { top: [number, number, number]; corner: [number, number, number] };

/** Every flying wire — one a load tape, four to a corner. */
export function wirePlan(): Wire[] {
  const out: Wire[] = [];
  const rm = E.mouth / 2;
  const h = BURNER_LOOK.frameHalf;
  for (let i = 0; i < E.gores; i++) {
    const a = tapeAngle(i);
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    out.push({
      top: [rm * cx, 0, rm * cz],
      corner: [Math.sign(cx) * h, BURNER_LOOK.frameY, Math.sign(cz) * h],
    });
  }
  return out;
}

// ── THE COLOURS ─────────────────────────────────────────────────────────

/** The salt the colourway is dealt off the map's seed with — a stream of its
 * own, so no other draw moves. */
export const COLOURWAY_SALT = 0x6b1a7e55;

/** THE PATTERNS a balloon is painted in, each a rule from a panel (its
 * gore, row, and where in it) to a slot of its palette. */
export const SCHEMES = [
  "gores",
  "bands",
  "chevrons",
  "diamonds",
  "spiral",
  "rainbow",
  "sunburst",
] as const;
export type Scheme = (typeof SCHEMES)[number];

/** THE PALETTES, sRGB: five slots — two bold body colours, an accent, a
 * deep one, and the dark the skirt and the trims are cut in. */
export const PALETTES: readonly (readonly number[])[] = [
  [0xc8202f, 0xf3b51b, 0xf4f1ea, 0x1d2b53, 0x1b1b1d],
  [0x1f6fd0, 0xf4f1ea, 0xffcf2e, 0x0b2f78, 0x1b1b1d],
  [0x1f8a4c, 0xf6d02f, 0xf0832a, 0x0d4d2b, 0x1b1b1d],
  [0x6a2c91, 0xe8438f, 0xf4f1ea, 0xf3c623, 0x1b1b1d],
  [0xf2661b, 0x1b1b1d, 0xf4f1ea, 0xc8202f, 0x2a2a2e],
  [0x0f8b8d, 0xf4f1ea, 0xec5f2a, 0x13315c, 0x1b1b1d],
];

/** The rainbow's own six, sRGB, round its gores. */
export const RAINBOW = [0xd6252b, 0xf2771c, 0xf6cf22, 0x2aa34a, 0x1f6fd0, 0x6c3797];

export type Colourway = { scheme: number; palette: number };

/** The balloon a map is dealt: its pattern and its palette, off the map's
 * seed and a salt of its own (presentation only — no digest moves). */
export function colourwayOf(seed: number): Colourway {
  const rng = createRng((seed ^ COLOURWAY_SALT) >>> 0);
  rng.next();
  return { scheme: rng.int(0, SCHEMES.length - 1), palette: rng.int(0, PALETTES.length - 1) };
}

/** Every colourway, for a lab's sheet: each pattern once, the palettes
 * dealt round them. */
export function everyColourway(): Colourway[] {
  return SCHEMES.map((_, i) => ({ scheme: i, palette: i % PALETTES.length }));
}

/** The palette's slot a panel's point is painted from (0..4, or 5..10 a
 * rainbow colour): gore `g`, row `row` (`rows` the parachute, −1 the
 * skirt), at u across and v up the panel. `PAINT_GLSL`'s `paintSlot` is
 * this rule again for the shader — change both. */
export function paintSlot(scheme: number, g: number, row: number, u: number, v: number): number {
  const rows = ENVELOPE_LOOK.rows;
  if (row < 0) return 4;
  const odd = g % 2;
  if (row >= rows) return scheme === 6 ? 1 : odd ? 2 : 0;
  // The mouth's first panel in the trim's dark — the burner scorches there.
  if (row === 0) return 3;
  // The row the equator falls in, as the shader has it.
  const eq = EQUATOR_ROW;
  switch (SCHEMES[scheme]) {
    case "gores":
      return row >= rows - 2 ? 2 : odd;
    case "bands":
      if (row >= rows - 3) return 0;
      if (row >= eq - 1 && row <= eq + 1) return row === eq ? 2 : 3;
      return row > eq ? 1 : 0;
    case "chevrons": {
      if (row === eq || row === eq + 1) {
        // A zigzag band: a point up each gore's middle.
        const k = (row - eq + v) / 2;
        return k < 1 - Math.abs(2 * u - 1) * 0.5 ? 2 : 3;
      }
      return row > eq ? 0 : 1;
    }
    case "diamonds":
      if (row >= eq - 1 && row <= eq) {
        const vv = (row - (eq - 1) + v) / 2;
        return Math.abs(u - 0.5) + Math.abs(vv - 0.5) < 0.5 ? (odd ? 2 : 1) : 3;
      }
      return 0;
    case "spiral":
      // Bands stepping half a panel up every gore, round and round.
      return Math.floor((g + u) / 2 + row + v) % 3;
    case "rainbow":
      return 5 + (g % 6);
    case "sunburst": {
      // Rays down from the crown, a point down each gore's middle.
      const from = rows - 6;
      if (row >= from) {
        const t = (row - from + v) / 6;
        return t > Math.abs(2 * u - 1) * 0.85 ? (odd ? 1 : 2) : 0;
      }
      return row === from - 1 ? 3 : 0;
    }
    default:
      return 0;
  }
}

/** The panel row the equator's height falls in. */
export const EQUATOR_ROW = (() => {
  const vent = ventArc();
  const p = profile();
  // The equator's arc: where the profile's widest point lies.
  let at = 0;
  let best = 0;
  for (let i = 0; i < p.r.length; i++) {
    if (p.r[i] > best) {
      best = p.r[i];
      at = p.s[i];
    }
  }
  return Math.min(ENVELOPE_LOOK.rows - 2, Math.floor((at / vent) * ENVELOPE_LOOK.rows));
})();

/** The rule `paintSlot` states, for the shader: the scheme, the gore and
 * row as floats, u and v. */
export const PAINT_GLSL = /* glsl */ `
int paintSlot(int scheme, float gf, float rowf, float u, float v) {
  int rows = ${ENVELOPE_LOOK.rows};
  int eq = ${EQUATOR_ROW};
  int g = int(gf + 0.5);
  int row = int(floor(rowf + 0.5));
  if (row < 0) return 4;
  int odd = g - 2 * (g / 2);
  if (row >= rows) return scheme == 6 ? 1 : (odd == 1 ? 2 : 0);
  if (row == 0) return 3;
  if (scheme == 0) return row >= rows - 2 ? 2 : odd;
  if (scheme == 1) {
    if (row >= rows - 3) return 0;
    if (row >= eq - 1 && row <= eq + 1) return row == eq ? 2 : 3;
    return row > eq ? 1 : 0;
  }
  if (scheme == 2) {
    if (row == eq || row == eq + 1) {
      float k = (float(row - eq) + v) / 2.0;
      return k < 1.0 - abs(2.0 * u - 1.0) * 0.5 ? 2 : 3;
    }
    return row > eq ? 0 : 1;
  }
  if (scheme == 3) {
    if (row >= eq - 1 && row <= eq) {
      float vv = (float(row - (eq - 1)) + v) / 2.0;
      return abs(u - 0.5) + abs(vv - 0.5) < 0.5 ? (odd == 1 ? 2 : 1) : 3;
    }
    return 0;
  }
  if (scheme == 4) {
    int k = int(floor((gf + u) / 2.0 + float(row) + v));
    return k - 3 * (k / 3);
  }
  if (scheme == 5) return 5 + (g - 6 * (g / 6));
  if (scheme == 6) {
    int from = rows - 6;
    if (row >= from) {
      float t = (float(row - from) + v) / 6.0;
      return t > abs(2.0 * u - 1.0) * 0.85 ? (odd == 1 ? 1 : 2) : 0;
    }
    return row == from - 1 ? 3 : 0;
  }
  return 0;
}
`;

/** The eleven colours a colourway paints with, sRGB: the palette's five,
 * then the rainbow's six. */
export function colourwayColours(c: Colourway): number[] {
  return [...PALETTES[c.palette], ...RAINBOW];
}

// ── THE WICKER ───────────────────────────────────────────────────────────

/** THE WEAVE as a tile of texels, `size` square (one `BASKET_LOOK.tile`):
 * four upright stakes and sixteen rows of weavers passed in front of one
 * and behind the next, each row the other way to the one under it — an
 * sRGB colour and a height (0 in the gaps, 1 a weaver's crown over a
 * stake). Three-free; `balloon-basket.ts` makes the textures. */
export function wickerTexels(size: number): { colour: Uint8Array; height: Float32Array } {
  const colour = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const stakes = 4;
  const rows = 16;
  const rng = createRng(0x5eed1c4e);
  const tone = Array.from({ length: rows * stakes }, () => 0.82 + 0.3 * rng.next());
  for (let j = 0; j < size; j++) {
    const fy = (j + 0.5) / size;
    const row = Math.floor(fy * rows);
    const ry = fy * rows - row;
    // A weaver is round across its height.
    const across = Math.sin(Math.PI * ry);
    for (let i = 0; i < size; i++) {
      const fx = (i + 0.5) / size;
      const sx = fx * stakes;
      const stake = Math.floor(sx);
      const along = sx - stake;
      // In front of the stake on alternate rows and alternate stakes.
      const front = (row + stake) % 2 === 0;
      // Where the weaver runs over a stake it bows out; behind one, in.
      const bow = Math.cos(Math.PI * (2 * along - 1)) * 0.5 + 0.5;
      const h = Math.max(0, across) * (front ? 0.55 + 0.45 * bow : 0.55 - 0.35 * bow);
      const gap = across < 0.18 ? 1 - across / 0.18 : 0;
      const t = tone[row * stakes + stake] * (0.72 + 0.4 * h) * (1 - 0.65 * gap);
      // Honey willow, a little greener in the weaver's shade.
      const o = (j * size + i) * 4;
      colour[o] = Math.min(255, Math.round(198 * t));
      colour[o + 1] = Math.min(255, Math.round(150 * t));
      colour[o + 2] = Math.min(255, Math.round(92 * t));
      colour[o + 3] = 255;
      height[j * size + i] = h * (1 - gap);
    }
  }
  return { colour, height };
}

// ── THE ENVELOPE LAID ON THE SNOW ────────────────────────────────────────

/** Where the envelope is laid: the mouth's foot on the snow (world x and z,
 * relative to `ox`/`oz` of the drawing's origin), the heading it lies
 * toward (its crown that way), and the snow's height. */
export type Lay = {
  x: number;
  z: number;
  heading: number;
  groundAt: (x: number, z: number) => number;
  /** The drawing's origin, world (the basket's floor). */
  ox: number;
  oy: number;
  oz: number;
};

/** A point of the envelope (its own frame, upright) LAID FLAT on the snow:
 * tipped over toward `lay.heading`, its girth squashed into a wide flat
 * sheet a hand's breadth deep and rucked into folds. Written into `out` at
 * `o`, relative to the drawing's origin. */
export function laidPoint(
  px: number,
  py: number,
  pz: number,
  lay: Lay,
  out: Float32Array,
  o: number,
): void {
  const fx = Math.sin(lay.heading);
  const fz = Math.cos(lay.heading);
  // Along the axis from the mouth, and across: the radial part toward the
  // way it tips goes under, the part across it spreads out sideways.
  const along = py;
  const rd = px * fx + pz * fz;
  const rs = px * fz - pz * fx;
  const r = Math.hypot(px, pz);
  const flat = Math.min(1, r / (E.diameter / 2));
  const wx = lay.x + fx * along * 0.94 + fz * rs * 1.45;
  const wz = lay.z + fz * along * 0.94 - fx * rs * 1.45;
  // Its top a little over its bottom where the sheet doubles, rucked.
  const ruck =
    0.22 * Math.sin(along * 1.3 + rs * 0.7) * Math.sin(rs * 1.9 + along * 0.35) * flat +
    0.1 * Math.sin(along * 3.1 - rs * 2.6) +
    0.05 * Math.sin(along * 7.3 + rs * 5.1);
  const lift = 0.08 + 0.14 * (1 - rd / Math.max(0.3, r)) * flat + Math.max(0, ruck);
  const gy = lay.groundAt(lay.ox + wx, lay.oz + wz);
  out[o] = wx;
  out[o + 1] = gy - lay.oy + lift;
  out[o + 2] = wz;
}
