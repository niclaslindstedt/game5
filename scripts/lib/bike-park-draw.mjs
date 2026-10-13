// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK DRAWN (R44, R45) — a summer ski area's trails from above,
// from nothing but the level the game rides: the mountain shaded by height
// and hillshaded, in summer (meadow low, scree and rock high and steep),
// the woods as crowns, the pistes as pale grass strips, every lift a line
// between two stations, every TRAIL in its grade's colour as wide as the
// scale lets it be (the race line black, taped in orange), its id at its
// head, and its FEATURES marked along it — a berm a tick on the turn's
// outside, a roller or a dip a dot, a jump, a drop or a garden a labelled
// glyph — and every junction ringed.
//
// Beside it, THE PROFILES: every trail's bench down its length with its
// features stood on it, coloured by its grade's band.

import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

const PAPER = [246, 244, 238];
const INK = [24, 24, 28];
const WHITE = [255, 255, 255];
export const TRAIL_INK = {
  green: [30, 150, 60],
  blue: [25, 85, 205],
  red: [210, 35, 30],
  black: [18, 18, 20],
};
const TAPE = [255, 140, 0];
const LIFT = [12, 12, 14];
const TREE = [34, 78, 40];
const PISTE = [214, 222, 170];
const JUNCTION = [210, 30, 170];
/** A feature's glyph colour on the plan. */
const FEATURE_INK = {
  berm: [120, 70, 30],
  roller: [150, 110, 60],
  dip: [110, 80, 50],
  table: [255, 200, 0],
  gap: [255, 120, 0],
  drop: [190, 0, 160],
  stepdown: [140, 0, 200],
  rocks: [110, 110, 120],
  roots: [90, 55, 25],
};

function halo(canvas, x, y, str, color, scale = 1) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) if (dx || dy) canvas.text(str, x + dx, y + dy, WHITE, scale);
  }
  canvas.text(str, x, y, color, scale);
}

/** The area a park covers, with a margin, m. */
export function parkBox(park, margin = 120) {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const t of park.trails) {
    for (const p of t.points) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      z0 = Math.min(z0, p.z);
      z1 = Math.max(z1, p.z);
    }
  }
  return { x0: x0 - margin, z0: z0 - margin, x1: x1 + margin, z1: z1 + margin };
}

/** THE PLAN: the park from above, the summit up the page. */
export function renderBikePlan({
  level,
  park,
  scale = 0.8,
  title,
  box = parkBox(park),
  labels = true,
}) {
  const W = Math.ceil((box.x1 - box.x0) * scale);
  const H = Math.ceil((box.z1 - box.z0) * scale);
  const TITLE = 34;
  const c = createDrawing(W, H + TITLE, PAPER);
  // The mountain's summit is up the page: which way is up the mountain.
  const m = level.mountain;
  const up = m ? Math.sign(m.summit.z - m.base.z) || -1 : -1;
  const px = (x) => (x - box.x0) * scale;
  const pz = (z) => TITLE + (up < 0 ? (z - box.z0) * scale : (box.z1 - z) * scale);
  const base = park.base;
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < H; j += 4) {
    for (let i = 0; i < W; i += 4) {
      const y = base.groundAt(box.x0 + i / scale, up < 0 ? box.z0 + j / scale : box.z1 - j / scale);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  const nrm = { x: 0, y: 1, z: 0 };
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = box.x0 + (i + 0.5) / scale;
      const z = up < 0 ? box.z0 + (j + 0.5) / scale : box.z1 - (j + 0.5) / scale;
      const y = level.groundAt(x, z);
      level.normalAt(x, z, nrm);
      const t = (y - lo) / Math.max(1, hi - lo);
      const lit = Math.max(0, 0.55 + 0.6 * (-nrm.x * 0.6 + nrm.y * 0.5 - up * nrm.z * 0.6));
      const steep = 1 - nrm.y;
      // Meadow low, a browner alp high, scree where steep.
      const meadow = [118 - 30 * t, 150 - 25 * t, 80 - 10 * t];
      const scree = [150, 145, 135];
      const k = Math.min(1, Math.max(0, (steep - 0.18) * 4));
      const col = meadow.map((v, n) => (v + (scree[n] - v) * k) * (0.55 + 0.6 * lit));
      c.set(
        i,
        TITLE + j,
        col.map((v) => Math.max(0, Math.min(255, v))),
      );
    }
  }
  // The pistes as pale grass strips.
  for (const run of base.resort?.runs ?? []) {
    for (let k = 0; k < run.points.length; k += 3) {
      const p = run.points[k];
      c.disk(px(p.x), pz(p.z), Math.max(1, (p.width / 2) * scale), [...PISTE, 90]);
    }
  }
  // The woods.
  for (const tr of level.trees) {
    const x = px(tr.x);
    const y = pz(tr.z);
    if (x < 0 || y < TITLE || x >= W || y >= H + TITLE) continue;
    c.disk(x, y, Math.max(0.8, tr.crown * scale * 0.8), [...TREE, 200]);
  }
  // The lifts.
  for (const l of base.resort?.lifts ?? []) {
    c.line(
      px(l.bottom.x),
      pz(l.bottom.z),
      px(l.top.x),
      pz(l.top.z),
      l.kind === "drag" ? [80, 80, 80] : LIFT,
      2,
    );
    c.fillRect(px(l.bottom.x) - 4, pz(l.bottom.z) - 4, 8, 8, LIFT);
    c.fillRect(px(l.top.x) - 4, pz(l.top.z) - 4, 8, 8, LIFT);
    halo(c, px(l.top.x) + 6, pz(l.top.z) - 10, l.id, LIFT);
  }
  // The aprons.
  for (const a of park.aprons) c.circle(px(a.x), pz(a.z), a.radius * scale, [250, 250, 250], 2);
  // The trails, easiest drawn last so they read over the hard ones.
  const order = ["race", "black", "red", "blue", "green"];
  const sorted = [...park.trails].sort(
    (a, b) =>
      order.indexOf(a.kind === "race" ? "race" : a.grade) -
      order.indexOf(b.kind === "race" ? "race" : b.grade),
  );
  for (const t of sorted) {
    const ink = TRAIL_INK[t.grade];
    const w = Math.max(1.5, t.points[0].width * scale);
    const pts = t.points.filter((_, i) => i % 2 === 0).map((p) => [px(p.x), pz(p.z)]);
    if (t.kind === "race") c.polyline(pts, TAPE, w + 3);
    c.polyline(pts, [255, 255, 255, 160], w + 2);
    c.polyline(pts, ink, w);
    if (t.kind === "race" && t.start > 0) {
      const s = t.points.find((p) => p.s >= t.start);
      if (s) {
        c.disk(px(s.x), pz(s.z), 5, TAPE);
        halo(c, px(s.x) + 7, pz(s.z) - 3, "START", INK);
      }
    }
  }
  // The features.
  for (const t of park.trails) {
    for (const f of t.features) {
      const at = (s) => t.points[Math.max(0, Math.min(t.points.length - 1, Math.round(s)))];
      const p = at((f.from + f.to) / 2);
      const x = px(p.x);
      const y = pz(p.z);
      const ink = FEATURE_INK[f.kind];
      if (f.kind === "berm") {
        // On the turn's outside: a turn to the right banks on the left.
        const side = -(f.side ?? 1);
        const ox = Math.cos(p.heading) * side * 3;
        const oz = -Math.sin(p.heading) * side * 3;
        c.disk(px(p.x + ox), pz(p.z + oz), 1.6, ink);
      } else if (f.kind === "roller" || f.kind === "dip") {
        c.disk(x, y, 1.2, ink);
      } else {
        c.disk(x, y, 3.2, INK);
        c.disk(x, y, 2.4, ink);
        if (labels) halo(c, x + 4, y - 3, f.id.split("-")[1], INK);
      }
    }
  }
  for (const j of park.junctions) c.circle(px(j.x), pz(j.z), 4, JUNCTION, 1);
  // The heads and their ids.
  for (const t of park.trails) {
    const p = t.points[0];
    c.disk(px(p.x), pz(p.z), 5, TRAIL_INK[t.grade]);
    c.circle(px(p.x), pz(p.z), 6, WHITE, 1);
    halo(c, px(p.x) + 8, pz(p.z) + 2, t.id, TRAIL_INK[t.grade], 2);
  }
  c.fillRect(0, 0, W, TITLE, PAPER);
  c.text(title ?? "", 8, 10, INK, 2);
  return c;
}

/** THE PROFILES: each trail's bench, its tread over its features, by its
 * length. */
export function renderBikeProfiles({ park, treadAt, width = 1100 }) {
  const ROW = 120;
  const H = park.trails.length * ROW + 20;
  const c = createDrawing(width, H, PAPER);
  park.trails.forEach((t, ti) => {
    const top = 10 + ti * ROW;
    const ink = TRAIL_INK[t.grade];
    const pts = t.points;
    const hi = pts[0].y + 3;
    const lo = pts[pts.length - 1].y - 3;
    const sx = (width - 140) / Math.max(1, t.length);
    const sy = (ROW - 26) / Math.max(1, hi - lo);
    const X = (s) => 120 + s * sx;
    const Y = (y) => top + 6 + (hi - y) * sy;
    c.line(120, top + ROW - 18, width - 20, top + ROW - 18, [200, 200, 195]);
    let prev = null;
    let prevG = null;
    for (let s = 0; s <= t.length; s += Math.max(0.5, 1 / sx)) {
      const y = treadAt(park, ti, s, 0);
      const g = pts[Math.min(pts.length - 1, Math.round(s))].ground;
      if (prevG) c.line(prevG[0], prevG[1], X(s), Y(g), [170, 160, 140]);
      if (prev) c.line(prev[0], prev[1], X(s), Y(y), ink, 1.5);
      prev = [X(s), Y(y)];
      prevG = [X(s), Y(g)];
    }
    for (const f of t.features) {
      if (f.kind === "berm" || f.kind === "roller" || f.kind === "dip") continue;
      c.disk(X((f.from + f.to) / 2), top + ROW - 18, 2, FEATURE_INK[f.kind]);
    }
    c.text(t.id, 6, top + 8, ink, 2);
    c.text(`${t.grade}${t.kind === "race" ? " DH" : ""}`, 6, top + 30, INK);
    c.text(`${Math.round(t.length)} m`, 6, top + 42, INK);
    c.text(`${Math.round(t.vertical)} m drop`, 6, top + 54, INK);
  });
  return c;
}
