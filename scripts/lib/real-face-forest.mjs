// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES' WOODS — how much of each height of a real face is wooded,
// and where its tree line stands, read off the forest the map data draws
// (`landuse=forest`, `natural=wood`: a closed way, or a multipolygon
// relation's rings). The hints' bake (`scripts/real-hints.mjs`) hands it a
// face's map data and its baked heights; what comes back is a few bytes a
// face (`HINT_TREES` in `real-hints-index.ts`), which `real-face.ts` reads.
//
// The forest is RASTERISED onto the face's own height grid (126×126, 32 m
// apart — every cell inside the 4×4 km window), each cell's middle in a
// forest or not (even-odd over the rings' edges, so a clearing cut out of
// a wood as an inner ring is open). The cells are then binned by their
// height between the face's lowest and highest sample: BANDS bands, each
// the share of its cells wooded — the gradient — and the TREE LINE the
// top of the highest fine bin still wooded past `LINE_COVER`, as a share
// of that relief. A face whose window is hardly wooded at all (`LEAST`) is
// none: its map data draws no forest, and the region's row stands in.

import { SIZE, mapAt } from "./real-face-crops.mjs";

/** The cover bands kept between the face's lowest and highest sample. */
export const BANDS = 8;
/** The fine bins the tree line is read in, the fewest cells a bin is read
 * on, and the cover a bin must keep to stand under the tree line. */
const LINE_BINS = 48;
const LINE_CELLS = 12;
const LINE_COVER = 0.05;
/** The least share of the window wooded for a face to have woods of its
 * own. */
const LEAST = 0.01;

const isForest = (tags) => tags.landuse === "forest" || tags.natural === "wood";

/** Every forest polygon on a face: each a list of edges [x0, z0, x1, z1]
 * on the map, the edges of all its rings together (even-odd fills them
 * right whatever order they come in). `relationFull(id)` is a relation's
 * whole XML, or null; `readXml` reads it. Returns the polygons and how
 * many relations were left out for want of members. */
export async function forestPolygons(face, data, relationFull, readXml) {
  const polys = [];
  const at = (nodes, ref) => {
    const g = nodes.get(ref);
    return g ? mapAt(face, ...g) : null;
  };
  const edgesOf = (nodes, refs) => {
    const out = [];
    for (let i = 1; i < refs.length; i++) {
      const a = at(nodes, refs[i - 1]);
      const b = at(nodes, refs[i]);
      if (a && b) out.push([a[0], a[1], b[0], b[1]]);
    }
    return out;
  };
  for (const w of data.ways.values()) {
    if (!isForest(w.tags) || w.refs[0] !== w.refs.at(-1) || w.refs.length < 4) continue;
    polys.push(edgesOf(data.nodes, w.refs));
  }
  let missing = 0;
  for (const [id, r] of data.relations) {
    if (r.tags.type !== "multipolygon" || !isForest(r.tags)) continue;
    let src = data;
    if (r.members.some((m) => !data.ways.has(m))) {
      const xml = await relationFull(id);
      if (!xml) {
        missing++;
        continue;
      }
      src = readXml(xml, { nodes: new Map(), ways: new Map(), relations: new Map() });
      if (r.members.some((m) => !src.ways.has(m))) {
        missing++;
        continue;
      }
    }
    polys.push(r.members.flatMap((m) => edgesOf(src.nodes, src.ways.get(m).refs)));
  }
  return { polys, missing };
}

/** Which cells of the n×n grid (`cell` m apart) stand in a forest, 1 or 0. */
export function rasterise(polys, n, cell) {
  const wooded = new Uint8Array(n * n);
  for (const edges of polys) {
    let z0 = Infinity;
    let z1 = -Infinity;
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const [ax, az, bx, bz] of edges) {
      z0 = Math.min(z0, az, bz);
      z1 = Math.max(z1, az, bz);
      x0 = Math.min(x0, ax, bx);
      x1 = Math.max(x1, ax, bx);
    }
    if (z1 < 0 || z0 > SIZE || x1 < 0 || x0 > SIZE) continue;
    const r0 = Math.max(0, Math.ceil(z0 / cell));
    const r1 = Math.min(n - 1, Math.floor(z1 / cell));
    const rows = new Map();
    for (const [ax, az, bx, bz] of edges) {
      if (az === bz) continue;
      const lo = Math.max(r0, Math.ceil(Math.min(az, bz) / cell));
      const hi = Math.min(r1, Math.ceil(Math.max(az, bz) / cell) - 1);
      for (let r = lo; r <= hi; r++) {
        const z = r * cell;
        // Half-open: an edge counts at a row it starts on, never one it ends on.
        if (z < Math.min(az, bz) || z >= Math.max(az, bz)) continue;
        const x = ax + ((bx - ax) * (z - az)) / (bz - az);
        let xs = rows.get(r);
        if (!xs) rows.set(r, (xs = []));
        xs.push(x);
      }
    }
    for (const [r, xs] of rows) {
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil(xs[k] / cell));
        const c1 = Math.min(n - 1, Math.floor(xs[k + 1] / cell));
        for (let c = c0; c <= c1; c++) wooded[r * n + c] = 1;
      }
    }
  }
  return wooded;
}

/** A face's woods by height off its wooded cells and its heights: the
 * share wooded in each of BANDS bands between its lowest and highest
 * sample, the tree line as a share of that relief, and the whole window's
 * share — or null for a face hardly wooded at all. */
export function woodsByHeight(wooded, heights) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const h of heights) {
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  const span = Math.max(1, hi - lo);
  const shareOf = (h) => Math.min(0.999999, (h - lo) / span);
  const count = (bins) => {
    const all = new Uint32Array(bins);
    const woods = new Uint32Array(bins);
    for (let i = 0; i < heights.length; i++) {
      const b = Math.floor(shareOf(heights[i]) * bins);
      all[b]++;
      woods[b] += wooded[i];
    }
    return { all, woods };
  };
  let total = 0;
  for (const w of wooded) total += w;
  const share = total / wooded.length;
  if (share < LEAST) return { share, trees: null };
  const coarse = count(BANDS);
  const bands = Array.from(coarse.all, (a, b) => (a > 0 ? coarse.woods[b] / a : 0));
  const fine = count(LINE_BINS);
  let top = 0;
  for (let b = 0; b < LINE_BINS; b++) {
    if (fine.all[b] >= LINE_CELLS && fine.woods[b] / fine.all[b] >= LINE_COVER) top = b + 1;
  }
  return { share, trees: { line: top / LINE_BINS, bands }, lo, hi };
}

/** The woods as `real-face.ts` reads them: the tree line's share of the
 * relief, then every band's cover, a byte each (0..255), as hex. */
export function encodeTrees(trees) {
  const q = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return [trees.line, ...trees.bands].map((v) => q(v).toString(16).padStart(2, "0")).join("");
}
