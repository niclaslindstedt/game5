// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEVEL MAP: one map from above, annotated — the picture to reason
// about a map from instead of riding it.
//
// Everything on it is read straight off the compiled level the game itself
// rides, with nothing rendered in between: no three.js, no browser, no
// built app. The snow is shaded by HEIGHT (a cool blue-white in the valleys
// to bright white on the flanks) and hillshaded from the north-west, with
// contours every 5 m and a heavier one every 25 m; the packed track is a
// grey band with its centreline in orange; every checkpoint is a bar across
// the track with its number; every tree is a dark dot its crown's size;
// every kicker is an arrow from the foot of its ramp to its lip and on down
// its landing, labelled `K1…` on the track and `X1…` off it; the spawn is a
// green arrow at the grid's slots. Every id is the one `level-map.mjs`
// prints in its table.

import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

export const TITLE_H = 48;
export const LEGEND_W = 250;
export const MARGIN = 12;

const PAPER = [246, 244, 238];
const INK = [24, 24, 28];
const WHITE = [255, 255, 255];

export const MARK = {
  track: [244, 128, 36],
  packed: [150, 156, 166],
  tree: [22, 64, 44],
  birch: [196, 178, 120],
  treeEdge: [12, 36, 24],
  crust: [120, 160, 205],
  ice: [40, 150, 215],
  checkpoint: [232, 65, 44],
  gateBlue: [40, 90, 220],
  start: [30, 168, 72],
  kicker: [210, 40, 170],
  offKicker: [120, 50, 210],
  cliff: [150, 60, 20],
  contour: [60, 90, 130],
};

/** A grid's nearest cell to a plan point — plenty for a map drawn at a
 * pixel a metre or coarser. */
function cellOf(f, x, z) {
  const c = Math.min(f.cols - 1, Math.max(0, Math.round((x - f.originX) / f.cell)));
  const r = Math.min(f.rows - 1, Math.max(0, Math.round((z - f.originZ) / f.cell)));
  return f.data[r * f.cols + c];
}

/** Snow by height over the map's own range: blue-grey hollows, white tops. */
function snowColor(t) {
  const lo = [196, 212, 228];
  const hi = [252, 252, 255];
  return [lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t, lo[2] + (hi[2] - lo[2]) * t];
}

/** Text with a paper halo, so a label survives whatever it lands on. */
export function label(canvas, x, y, str, color = INK, scale = 2) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx || dy) canvas.text(str, x + dx, y + dy, WHITE, scale);
    }
  }
  return canvas.text(str, x, y, color, scale);
}

/** An arrow from (x, y) along (dx, dy) pixels, `stroke` wide. */
export function arrow(canvas, x, y, dx, dy, ink, stroke = 2) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(10, len * 0.4);
  canvas.line(x, y, x + dx, y + dy, ink, stroke);
  for (const s of [-1, 1]) {
    canvas.line(
      x + dx,
      y + dy,
      x + dx - ux * head + s * uy * head * 0.55,
      y + dy - uy * head - s * ux * head * 0.55,
      ink,
      stroke,
    );
  }
}

/**
 * Draw a level. `scale` is pixels per metre; `title` is the strip across
 * the top and `lines` the key's caption lines. Returns the drawing (call
 * `.toPng()`).
 */
export function renderLevelMap({ level, scale = 0.6, title, lines = [] }) {
  const size = level.size;
  const mapW = Math.ceil(size * scale);
  const mapH = mapW;
  const width = MARGIN + mapW + MARGIN + LEGEND_W;
  const height = TITLE_H + mapH + MARGIN;
  const canvas = createDrawing(width, height, PAPER);
  const ox = MARGIN;
  const oy = TITLE_H;
  // North (+z) is up the page, east (+x) to the right.
  const px = (x) => ox + x * scale;
  const py = (z) => oy + (size - z) * scale;

  // ── The ground: one sample per pixel, snow by height, hillshaded ──────
  const heights = new Float32Array(mapW * mapH);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < mapH; j++) {
    const z = size - (j + 0.5) / scale;
    for (let i = 0; i < mapW; i++) {
      const h = level.groundAt((i + 0.5) / scale, z);
      heights[j * mapW + i] = h;
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  const normal = { x: 0, y: 1, z: 0 };
  // Light from the north-west, fairly low: a sun's-eye view of the relief.
  const L = { x: -0.5, y: 0.6, z: 0.62 };
  const ll = Math.hypot(L.x, L.y, L.z);
  for (let j = 0; j < mapH; j++) {
    const z = size - (j + 0.5) / scale;
    for (let i = 0; i < mapW; i++) {
      const x = (i + 0.5) / scale;
      const h = heights[j * mapW + i];
      level.normalAt(x, z, normal);
      const lit = Math.max(0, (normal.x * L.x + normal.y * L.y + normal.z * L.z) / ll);
      const shade = 0.55 + 0.55 * lit;
      const base = snowColor(Math.sqrt((h - lo) / Math.max(1, hi - lo)));
      // R21's own snow first, so the groomer reads over it: the crust a
      // blue wash, the river's ice a stronger blue.
      const crust = level.crust ? cellOf(level.crust, x, z) : 0;
      const ice = level.iceAt ? level.iceAt(x, z) : 0;
      const wild = base.map(
        (v, k) => v + (MARK.crust[k] - v) * crust * 0.45 + (MARK.ice[k] - v) * ice * 0.75,
      );
      const packed = Math.max(0, level.packedAt(x, z) - Math.max(ice, crust));
      const c = wild.map((v, k) => v + (MARK.packed[k] - v) * packed * 0.7);
      canvas.set(
        ox + i,
        oy + j,
        c.map((v) => Math.max(0, Math.min(255, v * shade))),
      );
    }
  }
  // ── Contours, marched pixel to pixel ───────────────────────────────────
  for (let j = 0; j + 1 < mapH; j++) {
    for (let i = 0; i + 1 < mapW; i++) {
      const h = heights[j * mapW + i];
      const hr = heights[j * mapW + i + 1];
      const hd = heights[(j + 1) * mapW + i];
      const band = (v, step) => Math.floor(v / step);
      if (band(h, 25) !== band(hr, 25) || band(h, 25) !== band(hd, 25)) {
        canvas.set(ox + i, oy + j, [...MARK.contour, 150]);
      } else if (band(h, 5) !== band(hr, 5) || band(h, 5) !== band(hd, 5)) {
        canvas.set(ox + i, oy + j, [...MARK.contour, 55]);
      }
    }
  }

  // ── The forest ─────────────────────────────────────────────────────────
  for (const t of level.trees) {
    const r = Math.max(0.8, t.crown * scale * 0.8);
    canvas.disk(px(t.x), py(t.z), r, [...(t.kind === "birch" ? MARK.birch : MARK.tree), 230]);
  }

  // ── The piste: the centreline over the packed band, open ─────────────
  const pts = level.track.points;
  canvas.polyline(
    pts.map((p) => [px(p.x), py(p.z)]),
    [...MARK.track, 230],
    Math.max(1, scale * 2.5),
    false,
  );

  // ── The kickers: foot → lip → end of landing ──────────────────────────
  for (const k of level.kickers) {
    const ink = k.onTrack ? MARK.kicker : MARK.offKicker;
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const footX = k.x - fx * k.ramp;
    const footZ = k.z - fz * k.ramp;
    const endX = k.x + fx * k.landing;
    const endZ = k.z + fz * k.landing;
    arrow(canvas, px(footX), py(footZ), px(k.x) - px(footX), py(k.z) - py(footZ), ink, 3);
    canvas.line(px(k.x), py(k.z), px(endX), py(endZ), [...ink, 140], 2);
    const wx = Math.cos(k.heading) * (k.width / 2);
    const wz = -Math.sin(k.heading) * (k.width / 2);
    canvas.line(px(k.x + wx), py(k.z + wz), px(k.x - wx), py(k.z - wz), ink, 2);
    label(canvas, px(k.x) + 7, py(k.z) - 16, k.id, ink, 1);
  }

  // ── The cliffs (R22): the edge, and a tick down the face ───────────────
  for (const c of level.cliffs ?? []) {
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const wx = Math.cos(c.heading) * (c.width / 2);
    const wz = -Math.sin(c.heading) * (c.width / 2);
    canvas.line(px(c.x + wx), py(c.z + wz), px(c.x - wx), py(c.z - wz), MARK.cliff, 3);
    for (const t of [-0.5, 0, 0.5]) {
      const ex = c.x + wx * t;
      const ez = c.z + wz * t;
      canvas.line(px(ex), py(ez), px(ex + fx * 8), py(ez + fz * 8), MARK.cliff, 2);
    }
    label(canvas, px(c.x) + 7, py(c.z) - 16, c.id, MARK.cliff, 1);
  }

  // ── The gates, numbered in the order they are skied: the start gate
  // first, the finish line last, red and blue ─────────────────────────
  level.checkpoints.forEach((c, i) => {
    const rx = Math.cos(c.heading);
    const rz = -Math.sin(c.heading);
    const hw = c.width / 2;
    const last = i === level.checkpoints.length - 1;
    const ink = i === 0 || last ? INK : c.colour === "blue" ? MARK.gateBlue : MARK.checkpoint;
    canvas.line(px(c.x + rx * hw), py(c.z + rz * hw), px(c.x - rx * hw), py(c.z - rz * hw), ink, 3);
    // The number stands off the right edge.
    const lx = px(c.x + rx * (hw + 12));
    const ly = py(c.z + rz * (hw + 12));
    label(canvas, lx - 4, ly - 7, i === 0 ? "START" : last ? "FIN" : String(i), ink, 2);
  });
  // The direction of travel, off the start line.
  const s0 = pts[0];
  const s1 = pts[Math.min(pts.length - 1, 20)];
  arrow(canvas, px(s0.x), py(s0.z), px(s1.x) - px(s0.x), py(s1.z) - py(s0.z), INK, 2);

  // ── The start line, four abreast ───────────────────────────────────────
  const sp = level.spawn;
  for (const g of level.grid) canvas.disk(px(g.x), py(g.z), 2.5, MARK.start);
  arrow(
    canvas,
    px(sp.x),
    py(sp.z),
    Math.sin(sp.heading) * 26,
    -Math.cos(sp.heading) * 26,
    MARK.start,
    3,
  );
  label(canvas, px(sp.x) + 8, py(sp.z) + 6, "START", MARK.start, 1);

  // ── Title strip ────────────────────────────────────────────────────────
  canvas.text(title ?? `LEVEL ${level.seed}`, MARGIN, 14, INK, 2);

  // ── The key ────────────────────────────────────────────────────────────
  const kx = MARGIN + mapW + MARGIN + 8;
  let ky = TITLE_H + 4;
  const key = (ink, text) => {
    canvas.fillRect(kx, ky, 14, 10, ink);
    canvas.text(text, kx + 20, ky + 2, INK, 1);
    ky += 18;
  };
  key(MARK.track, "PISTE CENTRELINE");
  key(MARK.packed, "GROOMED SNOW");
  key(MARK.checkpoint, "RED GATE N");
  key(MARK.gateBlue, "BLUE GATE N");
  key(INK, "START GATE / FINISH");
  key(MARK.kicker, "KICKER ON PISTE");
  key(MARK.offKicker, "KICKER OFF PISTE");
  if (level.cliffs?.length) key(MARK.cliff, "CLIFF (EDGE, FACE)");
  key(MARK.tree, "TREE (CROWN)");
  if (level.trees.some((t) => t.kind === "birch")) key(MARK.birch, "BIRCH (CROWN)");
  if (level.crust) key(MARK.crust, "WIND CRUST");
  if (level.ice) key(MARK.ice, "RIVER ICE");
  key(MARK.start, "SPAWN + GRID");
  key(MARK.contour, "CONTOURS 5 / 25 M");
  ky += 8;
  for (const line of lines) {
    canvas.text(line, kx, ky, INK, 1);
    ky += 12;
  }
  // A 200 m scale bar.
  const bar = 200 * scale;
  canvas.fillRect(kx, height - MARGIN - 20, bar, 4, INK);
  canvas.text("200 M", kx, height - MARGIN - 12, INK, 1);
  return canvas;
}
