// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDMARK: FALL LINE, drawn as polygons rather than set in a font.
//
// The UI's type is the system's condensed stack, which is a different face
// on every machine — fine for a menu row, wrong for the name on the box. So
// the name is DRAWN: every letter of F A L L L I N E is straight-stroked,
// which makes each one a handful of convex polygons on a grid, stated here
// once and rendered by `title-logo.tsx` (and measured by
// `tests/wordmark_test.ts`).
//
// THE LETTERS are heavy and condensed — a cap height of 100 units on stems of
// 22, the bars a little lighter than the stems so a bar and a stem read as
// one weight — and every one is SHEARED FORWARD (`WORDMARK_SLANT`): a name
// leaning down the hill. The A is the peak: a flat, cut top (a cornice, not a
// point), no crossbar, and only a small notch for a counter, low between its
// legs, so it stands as a mountain does. The arms of the F, the E and the
// feet of the L end on a forward bevel, the same lean again, so no bar ends
// square against the speed of the rest.
//
// THE CUT is one narrow gap sliced straight through the word down a fall
// line's angle, as if a ski edge had carved through the letters — a gap,
// not ink, so whatever is behind the logo shows through it. It is laid so
// that every letter it crosses is parted into two pieces that each still
// read as the letter's own (no fragment smaller than
// `WORDMARK_FRAGMENT_MIN` of the cap height — the test rasterizes the word
// and counts).
//
// Two LOCKUPS: STACKED (FALL over LINE, the mark to the left spanning both
// lines) for the title, and INLINE (the mark and FALL LINE on one line) for
// the menu's head and anything wide and short. Both are stated in one
// coordinate space whose unit is the cap height's hundredth, so a lockup is
// scaled by its box alone.
//
// Pure data and arithmetic — no DOM — so the root suite reads it.

/** The cap height, units. Everything else is stated against it. */
export const WORDMARK_CAP = 100;

/** How far forward the letters lean, degrees off upright. */
export const WORDMARK_SLANT = 10;

/** The smallest piece the cut may leave of a letter, as a share of the cap
 * height (the piece's narrower side). Smaller than this and at the menu's
 * size the piece is a speck beside the letter it came off. */
export const WORDMARK_FRAGMENT_MIN = 0.06;

/** One point, units, y DOWN from the cap line (the baseline is y = 100). */
export type Pt = readonly [number, number];

/** A drawn letter: how far it advances the pen, and the convex pieces it is
 * built from, UPRIGHT (before the slant), in its own box `[0, advance]` by
 * `[0, WORDMARK_CAP]`. The pieces tile — they meet edge to edge and never
 * overlap — so one path draws them with no seam. */
export interface Glyph {
  readonly advance: number;
  readonly parts: readonly (readonly Pt[])[];
}

const T = 22; // stem, units
const B = 19; // bar, units — optically one weight with the stem
const V = 7; // the bevel an arm's end leans forward by, units across its bar

/** An arm off a stem: from x0 to x1, its top at y, its end bevelled so the
 * top runs `V` further than the bottom. */
function arm(x0: number, x1: number, y: number, h = B): Pt[] {
  return [
    [x0, y],
    [x1, y],
    [x1 - V, y + h],
    [x0, y + h],
  ];
}

/** A rectangle, x0..x1 by y0..y1. */
function box(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

/** The mid arm's top: centred a touch above half height, as type draws it,
 * so the letter does not look as though it is sagging. */
const MID = (WORDMARK_CAP - B) / 2 - 2;

/** Every letter the name needs. Advances are the letters' own widths; the
 * spacing between them is `SPACING` and the pair table under it. */
export const WORDMARK_GLYPHS: Readonly<Record<string, Glyph>> = {
  F: {
    advance: 50,
    parts: [box(0, 0, T, WORDMARK_CAP), arm(T, 50, 0), arm(T, 44, MID)],
  },
  // The peak: legs 24 wide at the foot, a flat top 22 across, the notch 24
  // wide at the baseline and 40 tall. Split down its middle into two convex
  // halves.
  A: {
    advance: 70,
    parts: [
      [
        [0, WORDMARK_CAP],
        [24, 0],
        [35, 0],
        [35, 60],
        [23, WORDMARK_CAP],
      ],
      [
        [35, 0],
        [46, 0],
        [70, WORDMARK_CAP],
        [47, WORDMARK_CAP],
        [35, 60],
      ],
    ],
  },
  L: {
    advance: 48,
    parts: [box(0, 0, T, WORDMARK_CAP), arm(T, 48, WORDMARK_CAP - B)],
  },
  I: {
    advance: T,
    parts: [box(0, 0, T, WORDMARK_CAP)],
  },
  // Stems of 20 (an N's verticals are drawn lighter than an I's, or the
  // letter goes black), and a diagonal whose own thickness across it is a
  // stem's.
  N: {
    advance: 70,
    parts: [
      box(0, 0, 20, WORDMARK_CAP),
      [
        [20, 0],
        [26, 0],
        [50, 56],
        [50, WORDMARK_CAP],
        [44, WORDMARK_CAP],
        [20, 44],
      ],
      box(50, 0, 70, WORDMARK_CAP),
    ],
  },
  E: {
    advance: 50,
    parts: [
      box(0, 0, T, WORDMARK_CAP),
      arm(T, 50, 0),
      arm(T, 45, MID),
      arm(T, 50, WORDMARK_CAP - B),
    ],
  },
};

/** The gap between two letters and between the two words, units. */
export const SPACING = { letter: 9, word: 34 } as const;

/** The pairs that need more or less than the plain gap, units (negative
 * draws them together). F over A: the A's foot tucks under the F's arm, or a
 * hole opens between them. */
const PAIRS: Readonly<Record<string, number>> = {
  FA: -18,
  AL: -6,
};

/** The forward lean as a shear: a point at the cap line moves right by
 * `tan(slant) · cap`, a point on the baseline not at all. */
const LEAN = Math.tan((WORDMARK_SLANT * Math.PI) / 180);

/** A point leant forward. */
export function lean([x, y]: Pt): Pt {
  return [x + (WORDMARK_CAP - y) * LEAN, y];
}

/** One letter placed in a line: its letter, where its pen stood, and its
 * pieces leant and moved into the line's space. */
export interface Placed {
  readonly char: string;
  readonly x: number;
  readonly parts: readonly (readonly Pt[])[];
}

/** A line of the name laid out from `x`, `y` (its cap line), leant. */
export function layLine(text: string, x = 0, y = 0): Placed[] {
  const out: Placed[] = [];
  let pen = x;
  let prev = "";
  for (const char of text) {
    if (char === " ") {
      pen += SPACING.word - SPACING.letter;
      prev = "";
      continue;
    }
    const glyph = WORDMARK_GLYPHS[char];
    if (!glyph) throw new Error(`wordmark: no glyph for ${char}`);
    if (prev) pen += PAIRS[prev + char] ?? 0;
    const at = pen;
    out.push({
      char,
      x: at,
      parts: glyph.parts.map((part) =>
        part.map((p) => {
          const [lx, ly] = lean(p);
          return [lx + at, ly + y] as Pt;
        }),
      ),
    });
    pen += glyph.advance + SPACING.letter;
    prev = char;
  }
  return out;
}

/** How far right a line's ink reaches, units. */
export function lineRight(line: readonly Placed[]): number {
  let right = -Infinity;
  for (const g of line)
    for (const part of g.parts) for (const [x] of part) right = Math.max(right, x);
  return right;
}

/** THE CUT: where the gap starts and ends, both in clear air outside the
 * letters, and how wide it is, units. Stated per lockup because the letters
 * sit in different places in each; both run down at a fall line's angle,
 * between 20° and 30° below the horizontal. */
export interface Cut {
  readonly from: Pt;
  readonly to: Pt;
  readonly width: number;
}

/** The gap's width, units. */
export const WORDMARK_CUT_WIDTH = 4.5;

/** A cut from a point by one letter to a point by another, each stated in
 * that letter's own upright box (so `[-20, 0]` is level with the letter's
 * top, twenty units before it) and leant with it. */
function cutBetween(a: Placed, at: Pt, b: Placed, to: Pt, y0: number, y1: number): Cut {
  const [ax, ay] = lean(at);
  const [bx, by] = lean(to);
  return {
    from: [a.x + ax, y0 + ay],
    to: [b.x + bx, y1 + by],
    width: WORDMARK_CUT_WIDTH,
  };
}

/** The cut as a polygon — the band either side of its line — which is what
 * a mask cuts the letters with. */
export function cutBand(cut: Cut): Pt[] {
  const dx = cut.to[0] - cut.from[0];
  const dy = cut.to[1] - cut.from[1];
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * (cut.width / 2);
  const ny = (dx / len) * (cut.width / 2);
  return [
    [cut.from[0] + nx, cut.from[1] + ny],
    [cut.to[0] + nx, cut.to[1] + ny],
    [cut.to[0] - nx, cut.to[1] - ny],
    [cut.from[0] - nx, cut.from[1] - ny],
  ];
}

/** Which side of the cut's line a point is on (the sign), and how far. */
export function cutSide(cut: Cut, [x, y]: Pt): number {
  const dx = cut.to[0] - cut.from[0];
  const dy = cut.to[1] - cut.from[1];
  return ((x - cut.from[0]) * dy - (y - cut.from[1]) * dx) / Math.hypot(dx, dy);
}

/** The two arrangements of the logo. */
export type LockupKind = "stacked" | "inline";

/** A whole logo: its box, where the mark stands in it, the letters, and the
 * cut. Everything in units of the cap height's hundredth.
 *
 * THE MARK IS THE ICON'S TILE, LEANT WITH THE LETTERS: its 512-unit square
 * scaled to `size` units, its foot's left corner at `x`, `y + size`, and
 * sheared forward by `WORDMARK_SLANT` about that foot — so its right edge
 * runs parallel to the letters' stems and the gap between them is one width
 * all the way up. The peak alone, without its tile, has nowhere to stand: cut
 * off by the square's sides it reads as a house's gable. */
export interface Lockup {
  readonly kind: LockupKind;
  readonly width: number;
  readonly height: number;
  readonly mark: { readonly x: number; readonly y: number; readonly size: number };
  /** The mark's whole transform as an SVG `transform` attribute, from its
   * 512-square into the lockup. */
  readonly markTransform: string;
  readonly letters: readonly Placed[];
  readonly cut: Cut;
}

/** The gap between the mark and the name, units. */
const MARK_GAP = 30;

/** The gap between FALL's baseline and LINE's cap line in the stacked
 * lockup, units. */
const LEAD = 16;

/** Where the cut starts and ends in each lockup, in the letters' own boxes:
 * INLINE from over the first L's top to under the N's foot; STACKED from
 * the F's stem, down through FALL's foot, across the gap and out through
 * LINE's E — one carve through both lines. */
const CUT: Readonly<Record<LockupKind, { from: Pt; to: Pt }>> = {
  inline: { from: [-20, 0], to: [66, 108] },
  stacked: { from: [-6, 30], to: [76, 30] },
};

/** The mark's transform: scaled from its 512-square, leant about its foot. */
function markTransform(x: number, y: number, size: number): string {
  const k = size / 512;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `matrix(${r(k)} 0 ${r(-k * LEAN)} ${r(k)} ${r(x + size * LEAN)} ${r(y)})`;
}

/** Lay a lockup out. */
export function lockup(kind: LockupKind): Lockup {
  if (kind === "inline") {
    // The mark stands a touch taller than the caps, its foot on the
    // baseline, so the summit rises over the letters as a peak over a
    // valley would.
    const size = WORDMARK_CAP * 1.36;
    const x0 = size + MARK_GAP;
    const top = size - WORDMARK_CAP;
    const letters = layLine("FALL LINE", x0, top);
    const firstL = letters[2];
    return {
      kind,
      width: lineRight(letters),
      height: size,
      mark: { x: 0, y: 0, size },
      markTransform: markTransform(0, 0, size),
      letters,
      cut: cutBetween(firstL, CUT.inline.from, letters[6], CUT.inline.to, top, top),
    };
  }
  // STACKED: LINE starts on the same slanted margin FALL does, so its pen
  // is moved back by the lean over the height between the two cap lines.
  const size = WORDMARK_CAP * 2 + LEAD;
  const down = WORDMARK_CAP + LEAD;
  // FALL's baseline stands `down` over the mark's foot, where the leant
  // edge has moved right by the lean over that height.
  const x0 = size + MARK_GAP + down * LEAN;
  const fall = layLine("FALL", x0, 0);
  const line = layLine("LINE", x0 - down * LEAN, down);
  const letters = [...fall, ...line];
  return {
    kind,
    width: Math.max(lineRight(fall), lineRight(line)),
    height: size,
    mark: { x: 0, y: 0, size },
    markTransform: markTransform(0, 0, size),
    letters,
    cut: cutBetween(fall[0], CUT.stacked.from, line[3], CUT.stacked.to, 0, down),
  };
}

/** A set of polygons as one SVG path, each closed. */
export function pathOf(polys: readonly (readonly Pt[])[]): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return polys.map((poly) => `M${poly.map(([x, y]) => `${r(x)} ${r(y)}`).join("L")}Z`).join("");
}
