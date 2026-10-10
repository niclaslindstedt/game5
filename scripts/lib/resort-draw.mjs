// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESORT DRAWN — a whole ski area the way its own piste map draws it,
// from nothing but the compiled level the game rides.
//
// Two pictures, both read straight off the level:
//
//   * THE PLAN (`renderResortPlan`): the mountain from above with the
//     summit at the TOP of the page, as a piste map hangs — the snow shaded
//     by height and hillshaded from the upper left, the woods as crowns, the
//     bare rock where the face is too steep to hold snow, every run drawn in
//     its colour (a transport lane dashed), its number in a disc of its
//     colour at its top, every lift a black line between two stations, every
//     cabin a brown square (`cabinsOf`), the
//     village, the HUB along the valley floor (R29) tinted and edged, the
//     two WIND TUNNELS (R30) with arrows the way they blow, the course the
//     map is raced on traced with its gates, and a piste R29 finds cannot be
//     skied again ringed in magenta.
//   * THE PANORAMA (`renderResortPanorama`): the same mountain seen from
//     out over the valley floor, looking up the fall line — a heightfield
//     marched column by column with a running horizon, so a run is seen
//     the way a piste map paints it: lit snow, dark woods, the runs in their
//     colours, the lift lines across them.
//
// The charts beside them (`renderResortCharts`): every course's profile
// down its length coloured by the colour of each hundred metres, and the
// woods by height — trunks per hectare in bands of height under the tree
// line — which is the measurement R14 on a resort is written against.

import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

const PAPER = [246, 244, 238];
const INK = [24, 24, 28];
const WHITE = [255, 255, 255];

/** The piste colours as the signs print them. */
export const GRADE_INK = {
  green: [40, 160, 70],
  blue: [30, 90, 210],
  red: [215, 40, 35],
  black: [20, 20, 22],
};
const ROAD_INK = [235, 140, 20];
const HUB_INK = [255, 214, 150];
const TUNNEL_INK = [0, 160, 190];
const FAIL_INK = [210, 30, 170];
const TREE = [28, 70, 46];
const ROCK = [128, 120, 112];
const LIFT = [12, 12, 14];
/** A cabin on the plan: timber brown. */
const CABIN = [128, 70, 36];

function halo(canvas, x, y, str, color, scale = 1) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx || dy) canvas.text(str, x + dx, y + dy, WHITE, scale);
    }
  }
  canvas.text(str, x, y, color, scale);
}

/** Snow by height: shadowed blue-grey low, white high, warm in the sun. */
function snowAt(t, lit) {
  const lo = [190, 205, 222];
  const hi = [252, 252, 255];
  const c = lo.map((v, k) => v + (hi[k] - v) * t);
  const warm = Math.max(0, lit - 0.6) * 0.25;
  return [
    c[0] * (0.62 + 0.45 * lit) + 30 * warm,
    c[1] * (0.62 + 0.45 * lit) + 20 * warm,
    c[2] * (0.66 + 0.4 * lit),
  ];
}

const clamp255 = (v) => Math.max(0, Math.min(255, v));

/** The run a groomed cell belongs to, as a colour, on a grid of `cell`
 * metres: each run's width stamped along its line, the lane's narrower. */
function runGrid(level, cell) {
  const n = Math.ceil(level.size / cell) + 1;
  const ink = new Int8Array(n * n).fill(-1);
  const order = ["green", "blue", "red", "black", "road"];
  for (const run of level.resort?.runs ?? []) {
    const k = order.indexOf(run.kind === "road" ? "road" : run.grade);
    for (const p of run.points) {
      const r = Math.ceil(p.width / 2 / cell);
      const c0 = Math.round(p.x / cell);
      const r0 = Math.round(p.z / cell);
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if ((dr * dr + dc * dc) * cell * cell > (p.width / 2) ** 2) continue;
          const o = (r0 + dr) * n + (c0 + dc);
          if (o >= 0 && o < ink.length && ink[o] < k) ink[o] = k;
        }
      }
    }
  }
  return {
    n,
    at(x, z) {
      const c = Math.round(x / cell);
      const r = Math.round(z / cell);
      if (c < 0 || r < 0 || c >= n || r >= n) return null;
      const k = ink[r * n + c];
      return k < 0 ? null : k === 4 ? ROAD_INK : GRADE_INK[order[k]];
    },
  };
}

/** How many tree crowns cover each cell of a `cell` metre grid. */
function treeGrid(level, cell) {
  const n = Math.ceil(level.size / cell) + 1;
  const cover = new Float32Array(n * n);
  for (const t of level.trees) {
    const r = Math.max(1, Math.ceil(t.crown / cell));
    const c0 = Math.round(t.x / cell);
    const r0 = Math.round(t.z / cell);
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        const d2 = (dr * dr + dc * dc) * cell * cell;
        if (d2 > t.crown * t.crown) continue;
        const o = (r0 + dr) * n + (c0 + dc);
        if (o >= 0 && o < cover.length) cover[o] = Math.max(cover[o], t.height);
      }
    }
  }
  return {
    at(x, z) {
      const c = Math.round(x / cell);
      const r = Math.round(z / cell);
      if (c < 0 || r < 0 || c >= n || r >= n) return 0;
      return cover[r * n + c];
    },
  };
}

/** THE PLAN: the ski area from above, summit up — the whole map, or the
 * square `view` ({ x, z, size }, m: its corner nearest the summit's left
 * and its side) of it. Returns the drawing. */
export function renderResortPlan({
  level,
  scale = 0.4,
  title,
  course = true,
  refused = [],
  hubAt = null,
  failing = new Set(),
  cabins = [],
  hints = null,
  village = null,
  view = null,
}) {
  const size = view ? view.size : level.size;
  const vx = view ? view.x : 0;
  const vz = view ? view.z : 0;
  const W = Math.ceil(size * scale);
  const TITLE = 40;
  const canvas = createDrawing(W + 24, W + TITLE + 12, PAPER);
  const ox = 12;
  const oy = TITLE;
  // Summit up: the map's z = 0 (the ridge) at the top of the page.
  const px = (x) => ox + (x - vx) * scale;
  const py = (z) => oy + (z - vz) * scale;
  let lo = Infinity;
  let hi = -Infinity;
  const hs = new Float32Array(W * W);
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      const h = level.groundAt(vx + (i + 0.5) / scale, vz + (j + 0.5) / scale);
      hs[j * W + i] = h;
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  const nrm = { x: 0, y: 1, z: 0 };
  // Lit from the upper left of the page, as a piste map is painted.
  const L = { x: -0.55, y: 0.62, z: -0.55 };
  const ll = Math.hypot(L.x, L.y, L.z);
  const runs = runGrid(level, 2);
  const hub = hubAt ? level.resort?.hub : null;
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      const x = vx + (i + 0.5) / scale;
      const z = vz + (j + 0.5) / scale;
      level.normalAt(x, z, nrm);
      const lit = Math.max(0, (nrm.x * L.x + nrm.y * L.y + nrm.z * L.z) / ll);
      const h = hs[j * W + i];
      let c = snowAt(Math.sqrt((h - lo) / Math.max(1, hi - lo)), lit);
      // Rock where the face is too steep to hold snow (past ~45°).
      if (nrm.y < 0.7) {
        const t = Math.min(1, (0.7 - nrm.y) / 0.12);
        c = c.map((v, k) => v + (ROCK[k] * (0.6 + 0.5 * lit) - v) * t);
      }
      const ink = runs.at(x, z);
      const packed = level.packedAt(x, z);
      if (ink && packed > 0.3) c = c.map((v, k) => v + (ink[k] - v) * 0.38 * packed);
      else if (hub) {
        const e = hubAt(hub, x);
        if (e && z >= e.top && z <= e.bottom) c = c.map((v, k) => v + (HUB_INK[k] - v) * 0.4);
      }
      canvas.set(ox + i, oy + j, c.map(clamp255));
    }
  }
  // Contours every 50 m, faint.
  for (let j = 0; j + 1 < W; j++) {
    for (let i = 0; i + 1 < W; i++) {
      const b = (v) => Math.floor(v / 50);
      const h = hs[j * W + i];
      if (b(h) !== b(hs[j * W + i + 1]) || b(h) !== b(hs[(j + 1) * W + i])) {
        canvas.set(ox + i, oy + j, [70, 90, 120, 60]);
      }
    }
  }
  for (const t of level.trees) {
    canvas.disk(px(t.x), py(t.z), Math.max(0.7, t.crown * scale * 0.9), [...TREE, 210]);
  }
  // The walks refused, faint, each ending in its slot's number.
  for (const r of refused) {
    const pts = r.points;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      canvas.line(
        px(pts[i].x),
        py(pts[i].z),
        px(pts[i + 1].x),
        py(pts[i + 1].z),
        [200, 40, 160, 90],
        1,
      );
    }
    const end = pts[pts.length - 1];
    if (end) halo(canvas, px(end.x) + 3, py(end.z), r.spec.id, [200, 40, 160], 1);
  }
  // The runs, each in its colour; a lane dashed.
  for (const run of level.resort?.runs ?? []) {
    const ink = run.kind === "road" ? ROAD_INK : GRADE_INK[run.grade];
    const pts = run.points;
    for (let i = 0; i + 1 < pts.length; i++) {
      if (run.kind === "road" && Math.floor(pts[i].s / 24) % 2 === 1) continue;
      canvas.line(px(pts[i].x), py(pts[i].z), px(pts[i + 1].x), py(pts[i + 1].z), ink, 2);
    }
  }
  // Where a branch lane leaves its piste, a ring on the piste; where a link
  // lane reaches its lift's bottom station, a ring at the station.
  for (const run of level.resort?.runs ?? []) {
    const ends = [];
    if (run.branch) ends.push(run.points[0]);
    if (run.to !== undefined) ends.push(run.points[run.points.length - 1]);
    for (const p of ends) {
      canvas.disk(px(p.x), py(p.z), 6, WHITE);
      canvas.disk(px(p.x), py(p.z), 5, ROAD_INK);
      canvas.disk(px(p.x), py(p.z), 2.5, WHITE);
    }
  }
  // The hub's two edges, dashed.
  if (hub) {
    for (let i = 0; i + 1 < hub.top.length; i++) {
      if (i % 2 === 1) continue;
      const x0 = hub.x0 + i * hub.step;
      const x1 = x0 + hub.step;
      for (const e of [hub.top, hub.bottom])
        canvas.line(px(x0), py(e[i]), px(x1), py(e[i + 1]), [170, 110, 40], 1);
    }
    const mid = Math.floor(hub.top.length / 2);
    halo(canvas, px(hub.x0 + mid * hub.step) - 10, py(hub.top[mid]) + 4, "HUB", [150, 90, 30], 1);
  }
  // The wind tunnels, an arrow every 120 m the way the wind blows.
  for (const tun of level.resort?.tunnels ?? []) {
    const pts = tun.points;
    for (let i = 0; i + 1 < pts.length; i++) {
      canvas.line(px(pts[i].x), py(pts[i].z), px(pts[i + 1].x), py(pts[i + 1].z), TUNNEL_INK, 3);
    }
    for (let s = 60; s < tun.length; s += 120) {
      const p = pts[Math.min(pts.length - 1, Math.round((s / tun.length) * (pts.length - 1)))];
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const tip = { x: p.x + fx * 14, z: p.z + fz * 14 };
      for (const side of [-1, 1]) {
        const bx = p.x - fx * 6 + Math.cos(p.heading) * 9 * side;
        const bz = p.z - fz * 6 - Math.sin(p.heading) * 9 * side;
        canvas.line(px(tip.x), py(tip.z), px(bx), py(bz), TUNNEL_INK, 2);
      }
    }
    halo(canvas, px(pts[0].x) - 8, py(pts[0].z) + 6, tun.id, TUNNEL_INK, 1);
  }
  // The course raced, and its gates.
  if (course) {
    const pts = level.track.points;
    for (let i = 0; i + 1 < pts.length; i += 1) {
      canvas.line(
        px(pts[i].x),
        py(pts[i].z),
        px(pts[i + 1].x),
        py(pts[i + 1].z),
        [250, 210, 40, 200],
        5,
      );
    }
    for (const c of level.checkpoints) {
      const rx = Math.cos(c.heading) * (c.width / 2);
      const rz = -Math.sin(c.heading) * (c.width / 2);
      canvas.line(px(c.x + rx), py(c.z + rz), px(c.x - rx), py(c.z - rz), INK, 2);
    }
  }
  // Lifts: a line between two stations, the id at the top.
  for (const l of level.resort?.lifts ?? []) {
    canvas.line(
      px(l.bottom.x),
      py(l.bottom.z),
      px(l.top.x),
      py(l.top.z),
      LIFT,
      l.kind === "gondola" ? 3 : 2,
    );
    canvas.fillRect(px(l.bottom.x) - 4, py(l.bottom.z) - 4, 8, 8, LIFT);
    canvas.fillRect(px(l.top.x) - 5, py(l.top.z) - 5, 10, 10, LIFT);
    halo(canvas, px(l.top.x) + 8, py(l.top.z) - 4, l.id, LIFT, 1);
  }
  // Every run's number in a disc of its colour, at its top — ringed in
  // magenta where R29 finds it cannot be skied again.
  for (const run of level.resort?.runs ?? []) {
    const p = run.points[Math.min(run.points.length - 1, 40)];
    const ink = run.kind === "road" ? ROAD_INK : GRADE_INK[run.grade];
    if (failing.has(run.id)) {
      canvas.disk(px(p.x), py(p.z), 13, FAIL_INK);
      const e = run.points[run.points.length - 1];
      canvas.disk(px(e.x), py(e.z), 7, FAIL_INK);
    }
    canvas.disk(px(p.x), py(p.z), 8, WHITE);
    canvas.disk(px(p.x), py(p.z), 7, ink);
    canvas.text(run.id, px(p.x) - (run.id.length > 1 ? 5 : 2), py(p.z) - 3, WHITE, 1);
  }
  // The village's streets (`villageOf`): each to its carriageway's width
  // in dark grey, the square and the car park as outlines.
  if (village) {
    for (const st of village.streets) {
      const w = Math.max(1.5, st.section.lane * 2 * scale);
      for (let i = 0; i + 1 < st.points.length; i++) {
        const [a, b] = [st.points[i], st.points[i + 1]];
        canvas.line(px(a.x), py(a.z), px(b.x), py(b.z), [70, 66, 62], w);
      }
    }
  }
  // Every cabin (`cabinsOf`): a timber-brown square on a white ground, the
  // first of each group with its id.
  for (const c of cabins) {
    canvas.fillRect(px(c.x) - 4, py(c.z) - 4, 9, 9, WHITE);
    canvas.fillRect(px(c.x) - 3, py(c.z) - 3, 7, 7, CABIN);
    if (cabins.find((o) => o.group === c.group) === c)
      halo(canvas, px(c.x) + 7, py(c.z) + 4, c.id, CABIN, 1);
  }
  // A real face's hints (`real-hints.ts`) over it all, thin: the real
  // pistes in their grade's colour, the real lifts in magenta from a ring
  // at the bottom to a dot at the top, the real houses as grey ticks, the
  // real town's streets in orange (main roads thicker) inside a dotted
  // ring of its radius.
  if (hints) {
    const HINT_GRADE = {
      green: [40, 150, 60],
      blue: [40, 90, 200],
      red: [200, 40, 40],
      black: [20, 20, 20],
      orange: [240, 130, 20],
    };
    for (const h of hints.houses) {
      const [dx, dz] = [Math.sin(h.turn), Math.cos(h.turn)];
      const r = Math.max(1, (h.size * scale) / 2);
      canvas.line(
        px(h.x) - dx * r,
        py(h.z) - dz * r,
        px(h.x) + dx * r,
        py(h.z) + dz * r,
        [90, 90, 90],
        2,
      );
    }
    // The real town's streets (main roads thicker), and its radius.
    for (const st of hints.streets ?? []) {
      for (let i = 0; i + 1 < st.points.length; i++) {
        const [a, b] = [st.points[i], st.points[i + 1]];
        canvas.line(px(a.x), py(a.z), px(b.x), py(b.z), [230, 120, 20], st.main ? 2 : 1);
      }
    }
    if (hints.town) {
      const t = hints.town;
      for (let k = 0; k < 96; k++) {
        const a = (k / 96) * 2 * Math.PI;
        const x = px(t.x + Math.sin(a) * t.r);
        const z = py(t.z + Math.cos(a) * t.r);
        canvas.disk(x, z, 1, [230, 120, 20]);
      }
    }
    for (const p of hints.pistes) {
      const ink = [...HINT_GRADE[p.grade], 200];
      for (let i = 0; i + 1 < p.points.length; i++) {
        const [a, b] = [p.points[i], p.points[i + 1]];
        canvas.line(px(a.x), py(a.z), px(b.x), py(b.z), ink, 1);
      }
    }
    for (const l of hints.lifts) {
      canvas.line(px(l.bottom.x), py(l.bottom.z), px(l.top.x), py(l.top.z), [200, 0, 200], 1);
      canvas.disk(px(l.bottom.x), py(l.bottom.z), 4, [200, 0, 200]);
      canvas.disk(px(l.bottom.x), py(l.bottom.z), 2.5, WHITE);
      canvas.disk(px(l.top.x), py(l.top.z), 3, [200, 0, 200]);
    }
  }
  const v = level.resort?.village;
  if (v) {
    canvas.fillRect(px(v.x) - 7, py(v.z) - 7, 14, 14, [120, 60, 30]);
    halo(canvas, px(v.x) + 10, py(v.z) - 4, "VILLAGE", INK, 1);
  }
  canvas.text(title ?? `RESORT ${level.seed}`, 12, 12, INK, 2);
  return canvas;
}

/** THE PANORAMA: the mountain from out over the valley, looking up it. */
export function renderResortPanorama({ level, width = 1600, height = 900, title }) {
  const size = level.size;
  const canvas = createDrawing(width, height, [196, 214, 236]);
  // Sky: a gradient.
  for (let y = 0; y < height; y++) {
    const t = y / height;
    const c = [150 + 70 * t, 180 + 50 * t, 225 + 20 * t];
    for (let x = 0; x < width; x++) canvas.set(x, y, c);
  }
  const M = level.mountain;
  const top = M ? M.base.y + M.vertical : 1000;
  // The camera: out past the valley floor, raised, looking up the fall line.
  const cam = { x: size / 2, z: size * 1.42, y: top * 0.55 + 300 };
  const focal = width * 0.72;
  const pitch = -0.12;
  const horizon = height * 0.5 - pitch * focal;
  const runs = runGrid(level, 2);
  const trees = treeGrid(level, 3);
  const nrm = { x: 0, y: 1, z: 0 };
  const L = { x: -0.5, y: 0.65, z: 0.55 };
  const ll = Math.hypot(L.x, L.y, L.z);
  const fov = Math.atan(width / 2 / focal);
  for (let col = 0; col < width; col++) {
    const a = -fov + (2 * fov * col) / (width - 1);
    const dx = Math.sin(a);
    const dz = -Math.cos(a);
    let ymax = height;
    for (let d = 120; d < size * 1.9; d += d < 800 ? 2 : d < 2000 ? 3 : 4) {
      const x = cam.x + dx * d;
      const z = cam.z + dz * d;
      if (x < 0 || z < 0 || x > size || z > size) continue;
      const h = level.groundAt(x, z);
      const tree = trees.at(x, z);
      const lift = tree > 0 ? tree : 0;
      const depth = d * Math.cos(a);
      const sy = horizon + ((cam.y - (h + lift)) * focal) / depth;
      if (sy >= ymax) continue;
      level.normalAt(x, z, nrm);
      const lit = Math.max(0, (nrm.x * L.x + nrm.y * L.y + nrm.z * L.z) / ll);
      let c = snowAt(Math.min(1, Math.max(0, h / Math.max(1, top))), lit);
      if (nrm.y < 0.7) {
        const t = Math.min(1, (0.7 - nrm.y) / 0.12);
        c = c.map((v, k) => v + (ROCK[k] * (0.55 + 0.5 * lit) - v) * t);
      }
      const ink = runs.at(x, z);
      const packed = level.packedAt(x, z);
      if (ink && packed > 0.3) c = c.map((v, k) => v + (ink[k] - v) * 0.45 * packed);
      if (tree > 0) c = TREE.map((v) => v * (0.7 + 0.5 * lit));
      // Haze with distance.
      const haze = Math.min(0.55, d / 9000);
      c = c.map((v, k) => v + ([200, 215, 235][k] - v) * haze);
      const from = Math.max(0, Math.floor(sy));
      for (let y = from; y < ymax; y++) canvas.set(col, y, c.map(clamp255));
      ymax = from;
      if (ymax <= 0) break;
    }
  }
  // The lift lines over it.
  const project = (x, y, z) => {
    const vx = x - cam.x;
    const vz = z - cam.z;
    const depth = -vz;
    if (depth < 50) return null;
    return { x: width / 2 + (vx * focal) / depth, y: horizon + ((cam.y - y) * focal) / depth };
  };
  for (const l of level.resort?.lifts ?? []) {
    const a = project(l.bottom.x, l.bottom.y + 12, l.bottom.z);
    const b = project(l.top.x, l.top.y + 12, l.top.z);
    if (a && b) canvas.line(a.x, a.y, b.x, b.y, [...LIFT, 200], 1);
  }
  canvas.text(title ?? `RESORT ${level.seed}`, 12, 12, INK, 2);
  return canvas;
}

/** THE CHARTS: the courses' profiles and the woods by height. */
export function renderResortCharts({ level, analysis, width = 900 }) {
  const courses = level.resort?.courses ?? [];
  const rowH = 90;
  const height = 60 + courses.length * (rowH + 22) + 300;
  const canvas = createDrawing(width, height, PAPER);
  canvas.text("COURSES: HEIGHT DOWN THE LENGTH, COLOURED BY EACH 100 M", 12, 12, INK, 1);
  let y0 = 34;
  const maxLen = Math.max(1, ...courses.map((c) => c.length));
  const maxDrop = Math.max(1, ...courses.map((c) => c.drop));
  for (const c of courses) {
    const pts = coursePoints(level, c);
    canvas.text(
      `COURSE ${c.id}  ${c.grade.toUpperCase()}  ${(c.length / 1000).toFixed(2)} KM  ${c.drop.toFixed(0)} M  RUNS ${c.runs.join(">")}`,
      12,
      y0,
      GRADE_INK[c.grade],
      1,
    );
    const ox = 12;
    const oy = y0 + 14;
    const sx = (width - 30) / maxLen;
    const sy = rowH / maxDrop;
    const y00 = pts[0]?.y ?? 0;
    const step = pts.length > 1 ? pts[1].s - pts[0].s : 2;
    const span = Math.max(1, Math.round(100 / step));
    for (let i = 0; i + 1 < pts.length; i++) {
      const j = Math.min(pts.length - 1, i + span);
      const g = (pts[i].y - pts[j].y) / Math.max(1, pts[j].s - pts[i].s);
      const ink =
        g <= 0.16
          ? GRADE_INK.green
          : g <= 0.27
            ? GRADE_INK.blue
            : g <= 0.47
              ? GRADE_INK.red
              : GRADE_INK.black;
      canvas.line(
        ox + pts[i].s * sx,
        oy + (y00 - pts[i].y) * sy,
        ox + pts[i + 1].s * sx,
        oy + (y00 - pts[i + 1].y) * sy,
        ink,
        2,
      );
    }
    y0 += rowH + 22;
  }
  // The woods by height: trunks a hectare in 50 m bands under the line.
  const M = level.mountain;
  if (M) {
    const lineY = M.base.y + (M.treeLine - M.altitude);
    const band = 50;
    const counts = new Map();
    const area = new Map();
    for (const t of level.trees) {
      const k = Math.floor((lineY - t.y) / band);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    // The land in each band, off the ground grid, every 10 m.
    for (let z = 5; z < level.size; z += 10) {
      for (let x = 5; x < level.size; x += 10) {
        const k = Math.floor((lineY - level.groundAt(x, z)) / band);
        area.set(k, (area.get(k) ?? 0) + 100);
      }
    }
    const keys = [...area.keys()].sort((a, b) => a - b).filter((k) => k >= -4 && k < 24);
    canvas.text(
      "WOODS BY HEIGHT: TRUNKS A HECTARE, 50 M BANDS (ABOVE THE LINE <0)",
      12,
      y0,
      INK,
      1,
    );
    const top = y0 + 16;
    let most = 1;
    for (const k of keys)
      most = Math.max(most, ((counts.get(k) ?? 0) / (area.get(k) ?? 1)) * 10000);
    keys.forEach((k, i) => {
      const per = ((counts.get(k) ?? 0) / (area.get(k) ?? 1)) * 10000;
      const yy = top + i * 9;
      canvas.text(`${String(k * band).padStart(5)}`, 12, yy, INK, 1);
      canvas.fillRect(60, yy, (per / most) * (width - 160), 7, TREE);
      canvas.text(per.toFixed(0), 60 + (per / most) * (width - 160) + 4, yy, INK, 1);
    });
    y0 = top + keys.length * 9 + 12;
  }
  if (analysis) {
    const s = analysis.stats;
    canvas.text(
      `KM GREEN ${s.km.green.toFixed(1)} BLUE ${s.km.blue.toFixed(1)} RED ${s.km.red.toFixed(1)} BLACK ${s.km.black.toFixed(1)} LANE ${s.km.road.toFixed(1)}`,
      12,
      y0,
      INK,
      1,
    );
  }
  return canvas;
}

/** A course's line as the level would race it: the runs it follows, by
 * the arcs the course pieces publish, read off the runs. */
function coursePoints(level, course) {
  if (level.resort.course === course.id) return level.track.points;
  const byId = new Map(level.resort.runs.map((r) => [r.id, r]));
  const out = [];
  let s0 = 0;
  let from = 0;
  for (let k = 0; k < course.runs.length; k++) {
    const run = byId.get(course.runs[k]);
    const next = course.runs[k + 1];
    const to = next ? run.length : run.length;
    for (const p of run.points) {
      if (p.s < from || p.s > to) continue;
      out.push({ s: s0 + p.s - from, y: p.y });
    }
    s0 += to - from;
    from = run.into ? run.into.s : 0;
  }
  return out;
}
