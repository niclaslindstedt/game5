// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NEEDLE ATLAS — the sprays, tufts, twigs and whole-tree silhouettes the
// card trees (`tree-cards.ts`) are clothed in, PAINTED IN CODE once a load:
// every needle a short stroke rasterised with its own coverage, every twig
// of a birch's spray grown by SPACE COLONISATION (attraction points in the
// spray's envelope, nodes stepping toward the points they are nearest,
// points dying as a node reaches them), every snow pillow a soft blob. No
// file, no photograph — the tiles are a pure function of this module.
// Three-free and DOM-free, so the suite paints it too.
//
// FOUR CHANNELS, none of them a colour (the tree's own paint, per vertex,
// is the colour):
//   R  the SHADE the paint is multiplied by — dark at a spray's axis, where
//      the needles overlap, light at the needle tips;
//   G  the SNOW the spray can hold — pillows along the shoots, shelves on
//      the tiers of a silhouette — which the material raises over the
//      needles by the tree's load and how far the card faces the sky, and
//      which fills the gaps between the needles where it lies (a loaded
//      bough is a closed white shelf, not a white-tipped comb);
//   B  how THIN the foliage is there, for the light a low sun puts through a
//      spray's edge;
//   A  the needles' COVERAGE.
//
// THE MIPS KEEP THEIR COVERAGE. A spray's needles are a pixel wide; averaged
// down, their alpha falls under the material's threshold and a far card
// thins to nothing (or, under alpha-to-coverage, to a grey veil). Every
// level's alpha is scaled, tile by tile, until as many of its texels pass
// the threshold as passed at the full size (alpha-mip preservation).

/** The atlas, px a side. */
export const ATLAS_SIZE = 1024;

/** What every card samples, by name: a rectangle of the atlas, px. */
export type AtlasTile =
  | "solid"
  | "spruce"
  | "spruceB"
  | "fir"
  | "firB"
  | "tuft"
  | "larch"
  | "twig"
  | "twigB"
  | "disc"
  | "pineDisc"
  | "twigDisc"
  | "spireSide"
  | "spruceSide"
  | "pineSide"
  | "bareSide";

/** Where each tile stands, [x, y, w, h] px: the sprays a half-tile high,
 * the discs square, the silhouettes twice as high as wide. */
export const TILES: Readonly<Record<AtlasTile, readonly [number, number, number, number]>> = {
  spruce: [0, 0, 256, 128],
  spruceB: [256, 0, 256, 128],
  fir: [512, 0, 256, 128],
  firB: [768, 0, 256, 128],
  tuft: [0, 128, 256, 128],
  larch: [256, 128, 256, 128],
  twig: [512, 128, 256, 128],
  twigB: [768, 128, 256, 128],
  disc: [0, 256, 256, 256],
  pineDisc: [256, 256, 256, 256],
  twigDisc: [512, 256, 256, 256],
  solid: [768, 256, 256, 256],
  spireSide: [0, 512, 256, 512],
  spruceSide: [256, 512, 256, 512],
  pineSide: [512, 512, 256, 512],
  bareSide: [768, 512, 256, 512],
};

/** How far in from a tile's edge its painting keeps, px — so its lower
 * mips bleed into no neighbour's. */
const MARGIN = 6;

/** The alpha the material cuts at, and that every mip keeps the coverage
 * of. */
export const ALPHA_CUT = 0.5;

/** A tile's rectangle as UVs `[u0, v0, u1, v1]` (v up, as GL reads a
 * texture uploaded with its first row at the top and `flipY`), inset by
 * the margin. */
export function tileUv(tile: AtlasTile): readonly [number, number, number, number] {
  const [x, y, w, h] = TILES[tile];
  const s = ATLAS_SIZE;
  return [(x + MARGIN) / s, 1 - (y + h - MARGIN) / s, (x + w - MARGIN) / s, 1 - (y + MARGIN) / s];
}

/** A point `(u, v)` of a tile (0..1 each, v up) as an atlas UV. */
export function atTile(tile: AtlasTile, u: number, v: number): [number, number] {
  const [u0, v0, u1, v1] = tileUv(tile);
  return [u0 + (u1 - u0) * u, v0 + (v1 - v0) * v];
}

/** A deterministic stream of 0..1, off `seed`. */
function stream(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One tile being painted, in floats, its own pixel frame (x right, y DOWN
 * from the tile's top) inside the margin. */
class Canvas {
  readonly w: number;
  readonly h: number;
  /** Shade, snow, thinness and coverage — premultiplied by coverage while
   * painted, divided out when done. */
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  readonly a: Float32Array;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.r = new Float32Array(w * h);
    this.g = new Float32Array(w * h);
    this.b = new Float32Array(w * h);
    this.a = new Float32Array(w * h);
  }
  /** A needle or a twig: a stroke from `(x0, y0)` to `(x1, y1)`, `wd` px
   * across, its coverage soft over its last pixel, shade `sh`, thinness
   * `th`, laid OVER what is there. */
  stroke(x0: number, y0: number, x1: number, y1: number, wd: number, sh: number, th: number): void {
    const r = wd / 2 + 1;
    const xa = Math.max(0, Math.floor(Math.min(x0, x1) - r));
    const xb = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1) + r));
    const ya = Math.max(0, Math.floor(Math.min(y0, y1) - r));
    const yb = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1) + r));
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = dx * dx + dy * dy || 1e-6;
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const px = x + 0.5 - x0;
        const py = y + 0.5 - y0;
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / l2));
        const d = Math.hypot(px - dx * t, py - dy * t);
        const c = Math.max(0, Math.min(1, wd / 2 + 0.5 - d));
        if (c <= 0) continue;
        this.over(y * this.w + x, c, sh, th);
      }
    }
  }
  private over(i: number, c: number, sh: number, th: number): void {
    const k = 1 - c;
    this.r[i] = sh * c + this.r[i] * k;
    this.b[i] = th * c + this.b[i] * k;
    this.a[i] = c + this.a[i] * k;
  }
  /** A LUMP of SNOW at `(x, y)`, `rx` px along `turn` (rad) and `rad` px
   * across it, `amount` 0..1 at its middle — the most of what lies there
   * and it. Its rim is broken by a few waves off `phase`, so no two lumps
   * are the same oval. */
  snow(x: number, y: number, rad: number, amount: number, rx = rad, turn = 0, phase = 0): void {
    const reach = Math.max(rx, rad) * 1.3;
    const xa = Math.max(0, Math.floor(x - reach - 1));
    const xb = Math.min(this.w - 1, Math.ceil(x + reach + 1));
    const ya = Math.max(0, Math.floor(y - reach - 1));
    const yb = Math.min(this.h - 1, Math.ceil(y + reach + 1));
    const c = Math.cos(turn);
    const sn = Math.sin(turn);
    for (let py = ya; py <= yb; py++) {
      for (let px = xa; px <= xb; px++) {
        const ox = px + 0.5 - x;
        const oy = py + 0.5 - y;
        const along = (ox * c + oy * sn) / rx;
        const across = (-ox * sn + oy * c) / rad;
        const a = Math.atan2(across, along);
        const rim =
          1 +
          0.22 * Math.sin(a * 3 + phase) +
          0.14 * Math.sin(a * 5 + phase * 2.3) +
          0.08 * Math.sin(a * 9 + phase * 4.1);
        const d = Math.hypot(along, across) / rim;
        if (d >= 1) continue;
        const v = amount * (1 - d * d);
        const i = py * this.w + px;
        if (v > this.g[i]) this.g[i] = v;
      }
    }
  }
}

/** A SPRUCE spray seen from above: an axis from the root (left) to the tip
 * (right), shoots off both sides swept toward the tip, each a comb of
 * needles all round it, broadest a third of the way out and ragged at the
 * edge; pillows of snow along the shoots. `flat` lays it out as a fir's
 * plate: denser, its shoots square to the axis and evenly long. */
function spray(cv: Canvas, seed: number, flat: number): void {
  const rnd = stream(seed);
  const { w, h } = cv;
  const mid = h / 2;
  const axis = (u: number): [number, number] => [
    w * (0.02 + 0.95 * u),
    mid + Math.sin(u * 3.1 + seed) * h * 0.04,
  ];
  // The shoots.
  const shoots = Math.round(15 + 6 * flat);
  for (let s = 0; s < shoots; s++) {
    const u = (s + 0.5 + (rnd() - 0.5) * 0.6) / shoots;
    if (u > 0.96) continue;
    const [ax, ay] = axis(u);
    // The outline: broadest a third out, tapering to the tip; a fir's
    // plate keeps its width further.
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, u * (0.95 - 0.25 * flat) + 0.08)), 0.7);
    for (const side of [-1, 1]) {
      if (rnd() < 0.08 * (1 - flat)) continue; // a shoot lost
      const len = h * 0.5 * env * (0.7 + 0.4 * rnd());
      const sweep = 0.7 - 0.5 * flat + (rnd() - 0.5) * 0.3;
      const ex = ax + Math.sin(sweep) * len;
      const ey = ay + side * Math.cos(sweep) * len;
      // The needle mass the shoot carries, dense at its middle — at any
      // distance past arm's length a shoot is a dark body, not a comb.
      cv.stroke(ax, ay, ax + (ex - ax) * 0.8, ay + (ey - ay) * 0.8, 7 + 3 * flat, 0.22, 0.1);
      needles(cv, rnd, ax, ay, ex, ey, 8 + 2 * flat, 0.32 + 0.1 * flat);
      // Two side shoots off it, the second order.
      for (const at of [0.35, 0.65]) {
        const sx = ax + (ex - ax) * at;
        const sy = ay + (ey - ay) * at;
        const sl = len * 0.35 * (1 - at * 0.5);
        const sa = Math.atan2(ey - ay, ex - ax) + (rnd() < 0.5 ? -0.8 : 0.8);
        needles(cv, rnd, sx, sy, sx + Math.cos(sa) * sl, sy + Math.sin(sa) * sl, 6, 0.4);
      }
      // The shoot's own twig, darker.
      cv.stroke(ax, ay, ex, ey, 1.3, 0.2, 0);
      // A pillow on it, laid along it, the bigger the nearer the axis.
      const turn = Math.atan2(ey - ay, ex - ax);
      for (const at of [0.3, 0.62]) {
        cv.snow(
          ax + (ex - ax) * at,
          ay + (ey - ay) * at,
          len * (0.12 - 0.04 * at),
          0.65 + 0.35 * rnd(),
          len * (0.3 - 0.1 * at),
          turn,
          rnd() * 6.3,
        );
      }
    }
  }
  // Needles round the axis itself, and its twig.
  const [rx, ry] = axis(0);
  const [tx, ty] = axis(1);
  needles(cv, rnd, rx, ry, tx, ty, 6, 0.35);
  for (let k = 0; k < 8; k++) {
    const [x0, y0] = axis(k / 8);
    const [x1, y1] = axis((k + 1) / 8);
    cv.stroke(x0, y0, x1, y1, 2.4 - 1.5 * (k / 8), 0.2, 0);
  }
  // The snow along the axis: one long pillow broken into lumps.
  for (let k = 0; k < 9; k++) {
    const u = 0.08 + k * 0.1 + rnd() * 0.04;
    const [x, y] = axis(u);
    cv.snow(
      x,
      y + (rnd() - 0.5) * h * 0.1,
      h * (0.13 - 0.06 * u) * (0.7 + 0.5 * rnd()),
      1,
      w * (0.045 + 0.035 * rnd()),
      (rnd() - 0.5) * 0.4,
      rnd() * 6.3,
    );
  }
}

/** A comb of needles along a twig from `(x0, y0)` to `(x1, y1)`: short
 * strokes either side, angled forward, `len` px long, lighter at their
 * tips' end of the twig. */
function needles(
  cv: Canvas,
  rnd: () => number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  len: number,
  shade: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const n = Math.max(2, Math.round(l / 1.2));
  for (let i = 0; i < n; i++) {
    const t = (i + rnd() * 0.8) / n;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    for (const side of [-1, 1]) {
      if (rnd() < 0.15) continue;
      const a = side * (0.7 + rnd() * 0.5);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = ux * ca - uy * sa;
      const ny = ux * sa + uy * ca;
      const nl = len * (0.7 + 0.5 * rnd()) * (1 - 0.35 * t);
      const tip = 0.55 + 0.45 * t;
      cv.stroke(
        x,
        y,
        x + nx * nl,
        y + ny * nl,
        1.4,
        shade + (1 - shade) * tip * rnd(),
        0.4 + 0.6 * t,
      );
    }
  }
}

/** A PINE's spray: twigs fanning from the root (left) out and up, each
 * ending in a brush of long needles radiating round it — the tufts a pine's
 * pad is made of — snow cupped in the brushes. */
function tuft(cv: Canvas, seed: number): void {
  const rnd = stream(seed);
  const { w, h } = cv;
  const ends = 9;
  for (let e = 0; e < ends; e++) {
    const a = -0.9 + (1.8 * (e + rnd() * 0.6)) / ends;
    const len = w * (0.55 + 0.35 * rnd());
    const x0 = w * 0.04;
    const y0 = h * 0.5;
    const ex = x0 + Math.cos(a) * len;
    const ey = y0 + Math.sin(a) * len * 0.42;
    cv.stroke(x0, y0, ex, ey, 1.8, 0.22, 0);
    // The brush: long needles all round the twig's last third.
    const brush = 40;
    for (let k = 0; k < brush; k++) {
      const t = 0.55 + 0.45 * rnd();
      const bx = x0 + (ex - x0) * t;
      const by = y0 + (ey - y0) * t;
      const b = a + (rnd() - 0.5) * 2.6;
      const nl = h * (0.16 + 0.12 * rnd());
      cv.stroke(
        bx,
        by,
        bx + Math.cos(b) * nl,
        by + Math.sin(b) * nl * 0.9,
        1.1,
        0.4 + 0.6 * rnd(),
        0.7,
      );
    }
    cv.snow(
      x0 + (ex - x0) * 0.8,
      y0 + (ey - y0) * 0.8,
      h * 0.09,
      0.75,
      w * 0.07,
      a * 0.42,
      rnd() * 6.3,
    );
  }
}

/** A bare TWIG spray, grown by space colonisation: attraction points
 * scattered through a fan off the root (left), a node stepping toward the
 * mean of the points nearest it, a point killed once a node comes within
 * the kill radius — so the spray fills its envelope without a rule for
 * where each twig goes. `hang` weeps it (a larch's), and a larch's twigs
 * carry the knobs of its short shoots. */
function twigs(cv: Canvas, seed: number, hang: number, knobs: boolean): void {
  const rnd = stream(seed);
  const { w, h } = cv;
  const pts: [number, number][] = [];
  while (pts.length < 520) {
    const x = rnd();
    const y = rnd() * 2 - 1;
    // A fan, widening out from the root, rounded at the tip.
    const env = Math.sin(Math.PI * Math.min(1, x * 0.9 + 0.08));
    if (Math.abs(y) > env * (0.95 - 0.3 * hang)) continue;
    pts.push([w * (0.05 + 0.92 * x), h * (0.5 + 0.47 * (y + hang * x * x * 0.4))]);
  }
  type Node = { x: number; y: number; parent: number; depth: number };
  const nodes: Node[] = [{ x: w * 0.03, y: h * 0.5, parent: -1, depth: 0 }];
  const step = 5;
  const reach = 46;
  const kill = 7;
  const alive = pts.map(() => true);
  for (let it = 0; it < 90; it++) {
    const pull = new Map<number, [number, number, number]>();
    pts.forEach(([px, py], k) => {
      if (!alive[k]) return;
      let best = -1;
      let bd = reach;
      nodes.forEach((n, j) => {
        const d = Math.hypot(px - n.x, py - n.y);
        if (d < bd) {
          bd = d;
          best = j;
        }
      });
      if (best < 0) return;
      if (bd < kill) {
        alive[k] = false;
        return;
      }
      const p = pull.get(best) ?? [0, 0, 0];
      const n = nodes[best];
      p[0] += (px - n.x) / bd;
      p[1] += (py - n.y) / bd;
      p[2]++;
      pull.set(best, p);
    });
    if (pull.size === 0) {
      // Nothing in reach of any node yet: the leader grows on toward the tip.
      const last = nodes[nodes.length - 1];
      nodes.push({ x: last.x + step, y: last.y, parent: nodes.length - 1, depth: last.depth + 1 });
      continue;
    }
    for (const [j, [sx, sy, c]] of pull) {
      const l = Math.hypot(sx, sy) || 1;
      const n = nodes[j];
      nodes.push({
        x: n.x + (sx / l) * step + (rnd() - 0.5) * 1.5,
        y: n.y + (sy / l) * step + (rnd() - 0.5) * 1.5 + hang * 0.8,
        parent: j,
        depth: n.depth + (c > 0 ? 1 : 0),
      });
    }
  }
  // The PIPE MODEL: a twig as thick as the twigs it carries — each node's
  // width the square root of the tips above it.
  const tips = new Float32Array(nodes.length).fill(1);
  for (let j = nodes.length - 1; j > 0; j--) tips[nodes[j].parent] += tips[j];
  for (let j = 1; j < nodes.length; j++) {
    const n = nodes[j];
    const p = nodes[n.parent];
    const wd = Math.min(4, 1.5 + Math.sqrt(tips[j]) * 0.35);
    cv.stroke(p.x, p.y, n.x, n.y, wd, 0.35 + 0.4 * Math.min(1, n.depth / 40), wd < 1.8 ? 1 : 0.5);
    if (knobs && tips[j] < 2 && rnd() < 0.5) {
      cv.stroke(n.x, n.y, n.x + 1.5, n.y - 1.5, 2.2, 0.5, 0.6);
    }
    // Snow only where the wood is stout enough to hold it.
    if (wd > 2.6 && rnd() < 0.35) cv.snow(n.x, n.y - wd, wd * 1.4, 0.8, wd * 2.5);
  }
}

/** A tier DISC seen from above: sprays radiating from the middle, the
 * crown's tier as a lens over it sees it. `kind` is the spray each arm is. */
function disc(cv: Canvas, seed: number, kind: "spruce" | "tuft" | "twig"): void {
  const rnd = stream(seed);
  const arms = kind === "twig" ? 7 : 9;
  const sub = new Canvas(128, 64);
  if (kind === "spruce") spray(sub, seed + 3, 0.2);
  else if (kind === "tuft") tuft(sub, seed + 3);
  else twigs(sub, seed + 3, 0, false);
  const c = cv.w / 2;
  for (let a = 0; a < arms; a++) {
    const t = ((a + rnd() * 0.5) / arms) * Math.PI * 2;
    const len = c * (0.82 + 0.16 * rnd());
    stamp(cv, sub, c, c, t, len, len * 0.5);
  }
  // A spruce's tier is capped in the middle; a pine's tufts hold snow only
  // in their brushes, the dark needles showing between.
  if (kind === "spruce") cv.snow(c, c, c * 0.35, 0.9, c * 0.35, 0, seed);
}

/** Lay `src` onto `cv` with its root (its left edge's middle) at
 * `(x, y)`, turned `t` and stretched to `len` × `wid` px: the shade and
 * thinness over what is there, the snow its most. */
function stamp(
  cv: Canvas,
  src: Canvas,
  x: number,
  y: number,
  t: number,
  len: number,
  wid: number,
): void {
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const r = Math.hypot(len, wid / 2) + 1;
  for (let py = Math.max(0, Math.floor(y - r)); py < Math.min(cv.h, Math.ceil(y + r)); py++) {
    for (let px = Math.max(0, Math.floor(x - r)); px < Math.min(cv.w, Math.ceil(x + r)); px++) {
      const dx = px + 0.5 - x;
      const dy = py + 0.5 - y;
      const u = (dx * ct + dy * st) / len;
      const v = (-dx * st + dy * ct) / wid + 0.5;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const k = Math.floor(v * src.h) * src.w + Math.floor(u * src.w);
      const i = py * cv.w + px;
      const c = src.a[k];
      if (c > 0) {
        cv.r[i] = src.r[k] + cv.r[i] * (1 - c);
        cv.b[i] = src.b[k] + cv.b[i] * (1 - c);
        cv.a[i] = c + cv.a[i] * (1 - c);
      }
      cv.g[i] = Math.max(cv.g[i], src.g[k]);
    }
  }
}

/** A whole tree from the SIDE, for the cards that stand in for it far off:
 * a stem up the middle and a stack of tiers off it — a spire's narrow, a
 * spruce's broad and hanging — each tier a skirt of needles falling off the
 * stem with its SHELF of snow along its top; a pine's crown a few dark pads
 * high on a bare stem; a bare crown a lattice of twigs. The tile is drawn
 * squashed as the card is stretched: a card is two crown radii across and
 * the tree's height high, the height some four radii. */
function side(cv: Canvas, seed: number, form: "spire" | "spruce" | "pine" | "bare"): void {
  const rnd = stream(seed);
  const { w, h } = cv;
  const cx = w / 2;
  // Every stroke in "tree units": x a crown radius (w / 2 px), y a share of
  // the height (h px), y UP.
  const X = (x: number): number => cx + x * (w / 2);
  const Y = (y: number): number => h * (1 - y);
  if (form === "bare") {
    const sub = new Canvas(128, 64);
    twigs(sub, seed + 7, 0.1, false);
    cv.stroke(X(0), Y(0), X(0), Y(0.95), 4, 0.3, 0);
    for (let k = 0; k < 16; k++) {
      const y = 0.22 + 0.72 * (k / 16);
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
      const r = 0.95 * Math.sin(Math.PI * Math.min(1, (y - 0.15) * 1.25));
      stamp(cv, sub, X(0), Y(y), a, (w / 2) * r * 1.1 + 10, h * 0.16);
    }
    return;
  }
  // The stem.
  cv.stroke(X(0), Y(0), X(0), Y(form === "pine" ? 0.92 : 0.98), form === "pine" ? 5 : 3.5, 0.3, 0);
  if (form === "pine") {
    const pads = 7;
    for (let p = 0; p < pads; p++) {
      const y = 0.5 + 0.42 * (p / (pads - 1)) + (rnd() - 0.5) * 0.04;
      const x = (rnd() - 0.5) * 1.1 * (1 - p / pads);
      const r = 0.55 - 0.25 * (p / pads);
      cv.stroke(X(0), Y(y - 0.05), X(x), Y(y), 2, 0.3, 0);
      cv.stroke(X(x - r * 0.7), Y(y), X(x + r * 0.7), Y(y + 0.01), 9, 0.16, 0.1);
      for (let k = 0; k < 220; k++) {
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * r;
        const nx = x + Math.cos(a) * d;
        const ny = y + Math.sin(a) * d * 0.13;
        const nl = 7 + 5 * rnd();
        const b = a + (rnd() - 0.5);
        cv.stroke(
          X(nx),
          Y(ny),
          X(nx) + Math.cos(b) * nl,
          Y(ny) - Math.sin(b) * nl * 0.6,
          1.2,
          0.35 + 0.6 * rnd(),
          0.8,
        );
      }
      for (let k = 0; k < 7; k++) {
        const sx = x + (rnd() - 0.5) * r * 1.4;
        cv.snow(
          X(sx),
          Y(y + 0.02 + 0.015 * rnd()),
          h * (0.008 + 0.01 * rnd()),
          0.6 + 0.4 * rnd(),
          (w / 2) * r * (0.12 + 0.12 * rnd()),
          0,
          rnd() * 6.3,
        );
      }
    }
    return;
  }
  const tiers = form === "spire" ? 16 : 12;
  const taper = form === "spire" ? 1.5 : 1.05;
  const base = 0.05;
  for (let t = 0; t < tiers; t++) {
    const u = t / tiers;
    const y = base + (0.97 - base) * u;
    const r = Math.pow(1 - u * 0.96, taper) * (0.9 + 0.15 * rnd());
    const drop = (form === "spire" ? 0.05 : 0.08) * (1 - 0.5 * u);
    // The skirt: boughs off the stem to the rim, each a dark body of
    // needles with a fringe hanging under it (a spruce's curtains).
    const boughs = 9;
    for (let b = 0; b < boughs; b++) {
      const f = (b + 0.5) / boughs;
      const x = (f * 2 - 1) * r * (0.92 + 0.12 * rnd());
      const yy = y - drop * Math.abs(f * 2 - 1) * 1.2 - 0.004;
      // The bough's needle mass, thick enough that a tier reads as a solid
      // dark skirt from a few hundred metres: a far cut is this tile.
      const mass = (h / tiers) * (0.55 - 0.25 * Math.abs(f * 2 - 1));
      cv.stroke(X(x * 0.1), Y(y + 0.01), X(x * 0.92), Y(yy), mass, 0.2 + 0.15 * rnd(), 0.1);
      const hang = form === "spruce" ? 1.6 : 1;
      for (let k = 0; k < 26; k++) {
        const s = rnd();
        const bx = x * (0.15 + 0.85 * s);
        const by = y + (yy - y) * s;
        const nl = (4 + 7 * rnd()) * (0.6 + 0.6 * s) * hang;
        const a = -Math.PI / 2 + (rnd() - 0.5) * 1.8;
        cv.stroke(
          X(bx),
          Y(by),
          X(bx) + Math.cos(a) * nl,
          Y(by) - Math.sin(a) * nl,
          1.4,
          0.25 + 0.7 * rnd() * s,
          0.3 + 0.7 * s,
        );
      }
    }
    // The shelf of snow along the tier's top, in lumps.
    for (let k = 0; k < 9; k++) {
      const f = (k + 0.5 + (rnd() - 0.5) * 0.6) / 9;
      const x = (f * 2 - 1) * r * 0.85;
      const lift = drop * Math.abs(f * 2 - 1) * 1.1;
      cv.snow(
        X(x),
        Y(y - lift + 0.004),
        h * (0.006 + 0.006 * rnd()),
        0.6 + 0.4 * rnd(),
        (w / 2) * r * (0.08 + 0.08 * rnd()),
        0,
        rnd() * 6.3,
      );
    }
  }
}

/** The atlas painted, its levels from the full size down to 1 px, each
 * RGBA, rows top first. */
export function paintAtlas(): Uint8Array[] {
  const size = ATLAS_SIZE;
  const top = new Float32Array(size * size * 4);
  const paint = (tile: AtlasTile, draw: (cv: Canvas) => void): void => {
    const [x, y, w, h] = TILES[tile];
    const cv = new Canvas(w - 2 * MARGIN, h - 2 * MARGIN);
    draw(cv);
    for (let py = 0; py < cv.h; py++) {
      for (let px = 0; px < cv.w; px++) {
        const i = py * cv.w + px;
        const o = ((y + MARGIN + py) * size + x + MARGIN + px) * 4;
        const a = cv.a[i];
        // Out of premultiplied, and a texel nothing covers keeps a shade a
        // mip can blend into without darkening the edge.
        top[o] = a > 1e-4 ? Math.min(1, cv.r[i] / a) : 0.45;
        top[o + 1] = cv.g[i];
        top[o + 2] = a > 1e-4 ? Math.min(1, cv.b[i] / a) : 1;
        top[o + 3] = a;
      }
    }
  };
  paint("spruce", (cv) => spray(cv, 11, 0));
  paint("spruceB", (cv) => spray(cv, 23, 0.15));
  paint("fir", (cv) => spray(cv, 37, 1));
  paint("firB", (cv) => spray(cv, 41, 0.85));
  paint("tuft", (cv) => tuft(cv, 53));
  paint("larch", (cv) => twigs(cv, 67, 0.7, true));
  paint("twig", (cv) => twigs(cv, 71, 0, false));
  paint("twigB", (cv) => twigs(cv, 83, 0.15, false));
  paint("disc", (cv) => disc(cv, 97, "spruce"));
  paint("pineDisc", (cv) => disc(cv, 101, "tuft"));
  paint("twigDisc", (cv) => disc(cv, 103, "twig"));
  paint("spireSide", (cv) => side(cv, 107, "spire"));
  paint("spruceSide", (cv) => side(cv, 109, "spruce"));
  paint("pineSide", (cv) => side(cv, 113, "pine"));
  paint("bareSide", (cv) => side(cv, 127, "bare"));
  // The solid tile: every texel whole, shade 1, no snow of its own.
  {
    const [x, y, w, h] = TILES.solid;
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const o = (py * size + px) * 4;
        top[o] = 1;
        top[o + 1] = 0;
        top[o + 2] = 0;
        top[o + 3] = 1;
      }
    }
  }
  return mipChain(top, size);
}

/** The levels, each down-sampled from the last and its alpha scaled, tile by
 * tile, to keep the share of texels over `ALPHA_CUT` the full size had. */
function mipChain(top: Float32Array, size: number): Uint8Array[] {
  const tiles = Object.values(TILES);
  const coverage = (img: Float32Array, s: number, scale: number): number[] => {
    const f = s / size;
    return tiles.map(([x, y, w, h]) => {
      let n = 0;
      let all = 0;
      for (
        let py = Math.floor(y * f);
        py < Math.max(Math.floor(y * f) + 1, Math.floor((y + h) * f));
        py++
      ) {
        for (
          let px = Math.floor(x * f);
          px < Math.max(Math.floor(x * f) + 1, Math.floor((x + w) * f));
          px++
        ) {
          all++;
          if (img[(py * s + px) * 4 + 3] * scale >= ALPHA_CUT) n++;
        }
      }
      return n / Math.max(1, all);
    });
  };
  const want = coverage(top, size, 1);
  const out: Uint8Array[] = [toBytes(top)];
  let cur = top;
  let s = size;
  while (s > 1) {
    const n = s / 2;
    const next = new Float32Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let ar = 0;
        let a = 0;
        let g = 0;
        let br = 0;
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const o = ((y * 2 + dy) * s + x * 2 + dx) * 4;
          // The shade and thinness weighted by coverage, so an empty texel
          // does not pale the needles' edge.
          ar += cur[o] * (cur[o + 3] + 1e-3);
          br += cur[o + 2] * (cur[o + 3] + 1e-3);
          a += cur[o + 3];
          g += cur[o + 1];
        }
        const o = (y * n + x) * 4;
        const wsum = a + 4e-3;
        next[o] = ar / wsum;
        next[o + 1] = g / 4;
        next[o + 2] = br / wsum;
        next[o + 3] = a / 4;
      }
    }
    // Each tile's alpha scaled back up to the coverage it had.
    if (n >= 8) {
      const f = n / size;
      tiles.forEach(([x, y, w, h], k) => {
        let lo = 1;
        let hi = 4;
        const one = (scale: number): number => {
          let c = 0;
          let all = 0;
          for (let py = Math.floor(y * f); py < Math.floor((y + h) * f); py++) {
            for (let px = Math.floor(x * f); px < Math.floor((x + w) * f); px++) {
              all++;
              if (next[(py * n + px) * 4 + 3] * scale >= ALPHA_CUT) c++;
            }
          }
          return c / Math.max(1, all);
        };
        if (one(1) >= want[k]) return;
        for (let it = 0; it < 12; it++) {
          const m = (lo + hi) / 2;
          if (one(m) < want[k]) lo = m;
          else hi = m;
        }
        for (let py = Math.floor(y * f); py < Math.floor((y + h) * f); py++) {
          for (let px = Math.floor(x * f); px < Math.floor((x + w) * f); px++) {
            const o = (py * n + px) * 4 + 3;
            next[o] = Math.min(1, next[o] * hi);
          }
        }
      });
    }
    out.push(toBytes(next));
    cur = next;
    s = n;
  }
  return out;
}

function toBytes(f: Float32Array): Uint8Array {
  const b = new Uint8Array(f.length);
  for (let i = 0; i < f.length; i++) b[i] = Math.round(Math.max(0, Math.min(1, f[i])) * 255);
  return b;
}
