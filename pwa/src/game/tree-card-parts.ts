// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARD TREES' PARTS — what every card tree (`tree-cards.ts`) is built
// of: the CARD (a quad of the needle atlas, `tree-atlas.ts`), a BOUGH laid
// as one or two of them, the opaque dark CORE inside a crown, the STANDING
// cards that carry a crown's silhouette from the side, the UMBRELLA that
// carries a tier seen from above; and the packing every cut is handed to
// the forest's batch in (`packCards`).

import * as THREE from "three";

import { atTile, type AtlasTile } from "./tree-atlas.ts";
import { Shape, type V3 } from "./tree-mesh.ts";
import { type KindPaint, type TreePaint } from "./tree-shapes.ts";
import { type TreeVariant } from "./tree-variants.ts";

/** The marks every card tree's vertices carry. */
const MARKS = { uv: 2, card: 2 } as const;

/** A shape for a card tree, its marks set to the solid tile and no snow. */
/** The most snow a bare crown's twigs take: under the material's laden
 * mark, so a larch or a birch keeps its snow on the twigs' pillows and is
 * never crusted whole, which would read as solid plates of snow. */
export const BARE_SNOW = 0.78;

export function cardShape(v: TreeVariant): Shape {
  const s = new Shape(v.lean, { marks: MARKS });
  solid(s);
  return s;
}

/** What is pushed from here on is solid wood or core: the atlas's whole
 * tile, no snow of its own. */
export function solid(s: Shape): void {
  s.mark("uv", ...atTile("solid", 0.5, 0.5));
  s.mark("card", 0, 0);
  s.facet = 0.25;
}

/** A corner of a card: where it is, where in its tile, its colour. */
type Corner = { p: V3; u: number; v: number; col: THREE.Color };

/** TWO-SIDED, ONCE EACH: the triangles `tris` (corners in threes, wound to
 * face `n`) pushed as they are and again wound the other way, so the
 * material can cull back faces — a card is seen from both sides, but the
 * closed wood and core it is built round are paid for once, never their
 * hidden insides too. The front's `card` mark is `snowy, 0`; the back's
 * `snowy, 1` when it is a bough's UNDERSIDE, else `snowy, 0` lit by `n`
 * mirrored through `plane` (a standing card's other side is the crown seen
 * from the other way) or by `n` itself (`plane` null). */
function twoSided(
  s: Shape,
  tile: AtlasTile,
  tris: readonly Corner[],
  n: V3,
  snowy: number,
  under: boolean,
  plane: V3 | null,
): void {
  s.facet = 0;
  const put = (c: Corner, nrm: V3): void => {
    s.mark("uv", ...atTile(tile, c.u, c.v));
    s.push(c.p, c.col, nrm);
  };
  s.mark("card", snowy, 0);
  for (const c of tris) put(c, n);
  let back = n;
  if (plane) {
    const l = Math.hypot(plane[0], plane[1], plane[2]) || 1;
    const f: V3 = [plane[0] / l, plane[1] / l, plane[2] / l];
    const d = 2 * (n[0] * f[0] + n[1] * f[1] + n[2] * f[2]);
    back = [n[0] - d * f[0], n[1] - d * f[1], n[2] - d * f[2]];
  } else if (under) {
    // A bough's underside faces down: seen from below it is lit by the sky
    // and the snow under it, never by a sun that only reaches its top (lit
    // so, a bough between the lens and a low sun shows warm and pale).
    back = [n[0], -n[1], n[2]];
  }
  s.mark("card", snowy, under ? 1 : 0);
  for (let i = 0; i + 2 < tris.length; i += 3) {
    put(tris[i], back);
    put(tris[i + 2], back);
    put(tris[i + 1], back);
  }
  solid(s);
}

/** One CARD: the quad `a b c d` carrying `tile`, `a` its root's left
 * corner, `b` the tip's left, `c` the tip's right, `d` the root's right —
 * so the tile's root (its left edge) lies along `a d`. Its vertices' colours
 * from `root` to `tip`, its normal `n` (the crown's mass and the sky), its
 * snow `snowy`, its back an underside when `under`. Wound so its front faces
 * `n`. */
export function card(
  s: Shape,
  a: V3,
  b: V3,
  c: V3,
  d: V3,
  tile: AtlasTile,
  root: THREE.Color,
  tip: THREE.Color,
  n: V3,
  snowy: number,
  under: boolean,
  u0 = 0,
  u1 = 1,
): void {
  // Which way the quad faces as built: flip it to face `n`.
  const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const f = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const fx = e[1] * f[2] - e[2] * f[1];
  const fy = e[2] * f[0] - e[0] * f[2];
  const fz = e[0] * f[1] - e[1] * f[0];
  const flip = fx * n[0] + fy * n[1] * 16 + fz * n[2] < 0;
  const A: Corner = { p: a, u: u0, v: 0, col: root };
  const B: Corner = { p: b, u: u1, v: 0, col: tip };
  const C: Corner = { p: c, u: u1, v: 1, col: tip };
  const D: Corner = { p: d, u: u0, v: 1, col: root };
  twoSided(s, tile, flip ? [A, B, C, A, C, D] : [A, C, B, A, D, C], n, snowy, under, null);
}

/** A bough laid as two cards (one when `single`): from `root` out along `a` (rad in plan) to
 * `reach` crown radii, dropping `drop` (units of height) at its middle and
 * `tipDrop` at its tip, `wide` crown radii across at its broadest, rolled
 * `roll` about its axis. */
export function bough(
  s: Shape,
  root: V3,
  a: number,
  reach: number,
  drop: number,
  tipDrop: number,
  wide: number,
  roll: number,
  tile: AtlasTile,
  inner: THREE.Color,
  outer: THREE.Color,
  snowy: number,
  single = false,
): void {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const at = (t: number, dy: number): V3 => [
    root[0] + ca * reach * t,
    root[1] - dy,
    root[2] + sa * reach * t,
  ];
  const r0 = at(0, 0);
  const r1 = at(0.5, drop);
  const r2 = at(1, tipDrop);
  // Across the bough, rolled toward the vertical; a unit of height is some
  // four crown radii, hence the quarter.
  const across = (w: number): V3 => [
    -sa * w * Math.cos(roll),
    (w * Math.sin(roll)) / 4,
    ca * w * Math.cos(roll),
  ];
  const w0 = across(wide * 0.55);
  const w1 = across(wide);
  const w2 = across(wide * 0.75);
  const n: V3 = [ca * 0.35, 0.8, sa * 0.35];
  const mid = inner.clone().lerp(outer, 0.5);
  const off = (p: V3, w: V3, k: number): V3 => [p[0] + w[0] * k, p[1] + w[1] * k, p[2] + w[2] * k];
  if (single) {
    // A lighter cut's bough: one card from its root to its tip, the whole
    // spray along it.
    card(
      s,
      off(r0, w0, -1),
      off(r2, w2, -1),
      off(r2, w2, 1),
      off(r0, w0, 1),
      tile,
      inner,
      outer,
      n,
      snowy,
      true,
    );
    return;
  }
  card(
    s,
    off(r0, w0, -1),
    off(r1, w1, -1),
    off(r1, w1, 1),
    off(r0, w0, 1),
    tile,
    inner,
    mid,
    n,
    snowy,
    true,
    0,
    0.5,
  );
  card(
    s,
    off(r1, w1, -1),
    off(r2, w2, -1),
    off(r2, w2, 1),
    off(r1, w1, 1),
    tile,
    mid,
    outer,
    n,
    snowy,
    true,
    0.5,
    1,
  );
}

/** The DARK CORE inside a crown: a closed body of `sides` round the stem
 * through the rings `ys` (shares of the height), each its `radius` (crown
 * radii), drawn in the deep interior's own dark — and, on a tree laden
 * past `snowy` 0.7, crusted where it faces the sky as its boughs are. */
export function core(
  s: Shape,
  ys: readonly number[],
  radius: (y: number) => number,
  sides: number,
  col: THREE.Color,
  x: (y: number) => number = () => 0,
  snowy = 0,
): void {
  solid(s);
  s.mark("card", snowy, 0);
  const rings = ys.map((y, k) =>
    Array.from({ length: sides }, (_, i): V3 => {
      const a = (i / sides) * Math.PI * 2 + k * 0.6;
      const r = Math.max(0.01, radius(y));
      return [x(y) + Math.cos(a) * r, y, -Math.sin(a) * r];
    }),
  );
  const centres = ys.map((y): V3 => [x(y), y, 0]);
  s.loft(rings, centres, () => col);
  s.cap(
    rings[rings.length - 1],
    [x(ys[ys.length - 1]), ys[ys.length - 1] + 0.02, 0],
    col,
    [0, 1, 0],
    true,
  );
  s.cap(rings[0], [x(ys[0]), ys[0] - 0.01, 0], col, [0, -1, 0]);
}

/** THE STANDING CARDS of a cut: `n` cards through the stem at even turns,
 * `wide` crown radii either side, from `y0` to `y1`, carrying the tree's
 * silhouette from the side. A `cone` card (a spruce's, a fir's) is cut to
 * the cone its tile is painted in — square at the foot, a fifth of its
 * width at the head — rather than the whole quad: a card is paid for by
 * every pixel it covers, needles or not, and the quad's top corners are
 * sky. */
export function standing(
  s: Shape,
  n: number,
  y0: number,
  y1: number,
  wide: number,
  tile: AtlasTile,
  low: THREE.Color,
  high: THREE.Color,
  snowy: number,
  seed: number,
  cone = false,
): void {
  // The outline in the tile's (u across, v up), wound as foot-left,
  // foot-right, then up the right and back down the left.
  const outline: readonly [number, number][] = cone
    ? [
        [0, 0],
        [1, 0],
        [1, 0.15],
        [0.6, 1],
        [0.4, 1],
        [0, 0.15],
      ]
    : [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI + seed;
    const ca = Math.cos(a) * wide;
    const sa = Math.sin(a) * wide;
    // The card's normal: square to it, leaning to the sky a little so the
    // snow on its shelves takes the light.
    const nrm: V3 = [-Math.sin(a) * 0.7, 0.7, Math.cos(a) * 0.7];
    const at = ([u, v]: readonly [number, number]): Corner => ({
      // The silhouette tile is drawn upright: its u across, its v up.
      p: [(u * 2 - 1) * ca, y0 + (y1 - y0) * v, (u * 2 - 1) * sa],
      u,
      v,
      col: low.clone().lerp(high, v),
    });
    // A fan off the foot-left corner: the outline is convex.
    const tris: Corner[] = [];
    for (let i = 1; i + 1 < outline.length; i++)
      tris.push(at(outline[0]), at(outline[i]), at(outline[i + 1]));
    twoSided(s, tile, tris, nrm, snowy, false, [-sa, 0, ca]);
  }
}

/** A tier seen from above, laid across the crown at `y`: an umbrella of four
 * triangles off a middle raised `rise`, `r` crown radii out. */
export function umbrella(
  s: Shape,
  y: number,
  r: number,
  rise: number,
  tile: AtlasTile,
  col: THREE.Color,
  rim: THREE.Color,
  snowy: number,
  turn: number,
  x = 0,
  z = 0,
): void {
  const top: V3 = [x, y + rise, z];
  const corners: V3[] = [0, 1, 2, 3].map((k) => {
    const a = turn + (k * Math.PI) / 2;
    return [x + Math.cos(a) * r * Math.SQRT2, y, z + Math.sin(a) * r * Math.SQRT2];
  });
  const uvs: [number, number][] = [
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
    [0.5, 0],
  ];
  // The corners of the tile are its corners; the umbrella's four ribs run
  // to the middles of its edges, so the disc painted inside the tile is
  // whole.
  const uvAt = (k: number): [number, number] => {
    const a = uvs[k];
    const b = uvs[(k + 1) % 4];
    return [a[0] + b[0] - 0.5, a[1] + b[1] - 0.5];
  };
  const tris: Corner[] = [];
  for (let k = 0; k < 4; k++) {
    const [qu, qv] = uvAt((k + 3) % 4);
    const [pu, pv] = uvAt((k + 2) % 4);
    tris.push(
      { p: top, u: 0.5, v: 0.5, col },
      { p: corners[(k + 1) % 4], u: qu, v: qv, col: rim },
      { p: corners[k], u: pu, v: pv, col: rim },
    );
  }
  twoSided(s, tile, tris, [0, 1, 0], snowy, true, null);
}

/** The core's colour: the crown's deep interior, its darkest green. */
export const deep = (p: KindPaint): THREE.Color => p.dark.clone();

/** The region's paint back out of a kind's (for the faceted builder). */
export function paintOf(p: KindPaint): TreePaint {
  return {
    needle: p.needle,
    needleDark: p.dark,
    birchBark: p.bark,
    birchTwigs: p.twigs,
    load: p.load,
  };
}

/** A faceted tree as a card tree: every vertex on the atlas's solid tile,
 * carrying no snow of its own. */
export function asCards(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.getAttribute("position").count;
  const [u, v] = atTile("solid", 0.5, 0.5);
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("card", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/** Two non-indexed geometries with the same attributes as one. */
export function merge(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(b.attributes)) {
    const x = a.getAttribute(name);
    const y = b.getAttribute(name);
    const out = new Float32Array(x.array.length + y.array.length);
    out.set(x.array as Float32Array, 0);
    out.set(y.array as Float32Array, x.array.length);
    g.setAttribute(name, new THREE.Float32BufferAttribute(out, y.itemSize));
  }
  a.dispose();
  b.dispose();
  g.computeBoundingSphere();
  return g;
}

/** A card tree PACKED for the forest's batch (`forest-batch.ts`), every one
 * with the same attributes in the same types, as a batch asks: the colours
 * as 16-bit shares and the normals as bytes (a third less on the card, as
 * the solid cuts are packed, `tree-snow.ts`); the position, the trunk's
 * `stem`, the atlas's `uv` and the `card` mark stay floats. */
export function packCards(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.getAttribute("position");
  const n = pos.count;
  const col = g.getAttribute("color");
  const nrm = g.getAttribute("normal");
  const colours = new Uint16Array(n * 3);
  const normals = new Int8Array(n * 3);
  for (let v = 0; v < n; v++) {
    for (let k = 0; k < 3; k++) {
      colours[v * 3 + k] = Math.round(Math.min(1, Math.max(0, col.getComponent(v, k))) * 65535);
      normals[v * 3 + k] = Math.round(Math.max(-1, Math.min(1, nrm.getComponent(v, k))) * 127);
    }
  }
  const floats = (name: string, size: number): THREE.BufferAttribute => {
    const a = g.getAttribute(name);
    const out = new Float32Array(n * size);
    if (a)
      for (let v = 0; v < n; v++)
        for (let k = 0; k < size; k++) out[v * size + k] = a.getComponent(v, k);
    return new THREE.BufferAttribute(out, size);
  };
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", floats("position", 3));
  out.setAttribute("color", new THREE.BufferAttribute(colours, 3, true));
  out.setAttribute("normal", new THREE.BufferAttribute(normals, 3, true));
  out.setAttribute("stem", floats("stem", 3));
  out.setAttribute("uv", floats("uv", 2));
  out.setAttribute("card", floats("card", 2));
  g.dispose();
  return out;
}
