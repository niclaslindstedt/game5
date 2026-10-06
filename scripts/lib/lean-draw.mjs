// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEAN LAB'S PICTURES (`scripts/lean-lab.mjs`), drawn with the
// framework's `tooling/draw` off the frames the lab read:
//
//   THE SHEET (previews/lean.png) — a row a run, as the sag lab lays its
//   rows: the run's name and what it is on the left over the figure FROM
//   BEHIND at its worst frame (where a drawn part shivers most off its own
//   smoothed line) in colour, the frames a twentieth of a second either
//   side of it in grey, the vertical and the turn's balance at his boots;
//   and on the right the leans over the run (a staged moment's whole, a
//   course's window round its worst frame), the gates passed marked in
//   their colours and the worst frame by a line.
//
//   A RUN'S DETAIL (previews/lean-<row>.png) — over the window: the leans,
//   their rates and what is left of each after the shiver's smoothing ×5
//   as strips; a strobe of the figure from behind every fourth frame,
//   coloured by how far through an edge change he is; and the phase
//   portraits of the whole run, each lean against its rate — a clean loop
//   a smooth swing, a spike off it a kink.

import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

import { rate, smoothed } from "./lean-signal.mjs";

const INK = {
  bg: [18, 22, 30],
  panel: [26, 31, 42],
  grid: [44, 50, 64],
  text: [220, 226, 236],
  dim: [120, 128, 142],
  red: [230, 70, 60],
  blue: [70, 120, 240],
  snow: [200, 215, 235],
  vertical: [90, 96, 110],
  ghost: [110, 116, 130],
  worst: [250, 210, 80],
};

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/** The frame `f`'s figure FROM BEHIND about its boots at (`cx`, `cy`), `k`
 * px a metre, seen along `view` (a frame's `fig.right`, so a strip of
 * frames is drawn in one view): the legs, the trunk and the head, the arms
 * and the poles; `ink` one colour for all of it (a ghost) or none for the
 * parts' own; `marks` the snow's line, the vertical and the balance. */
function figureBehind(
  d,
  f,
  cx,
  cy,
  k,
  { ink = null, marks = false, view = f.fig.right, trunk } = {},
) {
  const fig = f.fig;
  const foot = mid(fig.feet[0], fig.feet[1]);
  const at = (p) => {
    const q = sub(p, foot);
    return [cx + dot(q, view) * k, cy - q.y * k];
  };
  if (marks) {
    const sr = (f.snow * Math.PI) / 180;
    const w = 0.4 * k;
    d.line(
      cx - w * Math.cos(sr),
      cy + w * Math.sin(sr),
      cx + w * Math.cos(sr),
      cy - w * Math.sin(sr),
      INK.snow,
      2,
    );
    d.line(cx, cy, cx, cy - 1.8 * k, INK.vertical);
    const br = ((f.balance + f.snow) * Math.PI) / 180;
    d.line(cx, cy, cx + Math.sin(br) * 1.6 * k, cy - Math.cos(br) * 1.6 * k, [240, 210, 90, 200]);
  }
  const legs = ink ?? [110, 220, 130];
  const body = ink ?? trunk ?? [255, 110, 90];
  const arms = ink ?? INK.dim;
  const width = ink ? 1 : 2;
  for (const i of [0, 1]) {
    d.polyline([at(fig.feet[i]), at(fig.knees[i]), at(fig.hips)], legs, width);
    // A ghost is the legs, the trunk and the head: the lean, not the arms.
    if (ink) continue;
    d.polyline([at(fig.shoulders[i]), at(fig.elbows[i]), at(fig.hands[i])], arms, 1);
    if (fig.poles) d.polyline([at(fig.hands[i]), at(fig.poles[i])], INK.grid, 1);
  }
  d.polyline([at(fig.hips), ...(fig.waist ? [at(fig.waist)] : []), at(fig.neck)], body, width);
  d.polyline([at(fig.shoulders[0]), at(fig.neck), at(fig.shoulders[1])], body, 1);
  const [hx, hy] = at(fig.head);
  d.circle(hx, hy, 0.11 * k, ink ?? INK.text, 1);
  if (!ink) {
    const [mx, my] = at(fig.com);
    d.circle(mx, my, 2, [250, 150, 90], 1);
  }
}

/** A strip of channels over `win` (frames of `f`, `i0` the first one's
 * index) at y `y`, `h` high: `values(id)` the whole run's series, `lo..hi`
 * its scale; the gates and a worst frame marked. */
function strip(d, o) {
  const { x0, y, w, h, lo, hi, from, to, f, i0, n, ids, channels, values, gates, mark, title } = o;
  d.rect(x0, y, w, h, INK.panel);
  const px = (t) => x0 + ((t - from) / Math.max(1e-6, to - from)) * w;
  const py = (v) => y + h - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * h;
  for (const g of [lo, lo / 2, 0, hi / 2, hi]) {
    d.line(x0, py(g), x0 + w, py(g), INK.grid);
    d.text(String(g), x0 - 6 - String(g).length * 6, py(g) - 3, INK.dim);
  }
  for (const g of gates) {
    if (g.t < from || g.t > to) continue;
    d.line(px(g.t), y, px(g.t), y + h, g.turn > 0 ? INK.red : g.turn < 0 ? INK.blue : INK.grid);
  }
  if (mark !== undefined) d.line(px(mark), y, px(mark), y + h, INK.worst);
  let kx = x0 + 4;
  if (title) {
    d.text(title, kx, y + 4, INK.dim);
    kx += title.length * 6 + 16;
  }
  for (const id of ids) {
    const ch = channels.find((c) => c.id === id);
    const v = values(id);
    const pts = [];
    for (let j = 0; j < n; j++) pts.push([px(f[i0 + j].t), py(v[i0 + j])]);
    d.polyline(pts, ch.ink, id === "trunk" || id === "head" ? 2 : 1);
    d.text(id.toUpperCase(), kx, y + 4, ch.ink);
    kx += id.length * 6 + 14;
  }
  d.text(`${(to - from).toFixed(1)} S`, x0 + w - 36, y + h + 3, INK.dim);
}

/** The frames of `r` between `from` and `to` s: the first index and how many. */
function span(r, from, to) {
  const f = r.frames;
  let i0 = f.findIndex((x) => x.t >= from);
  if (i0 < 0) i0 = 0;
  let n = 0;
  while (i0 + n < f.length && f[i0 + n].t <= to) n++;
  return { i0, n };
}

/** THE SHEET: a row a run (`rows`, each read — `r.read.worst`), `h` the
 * frame step, s; `channels` the lab's; `window` a course row's span, s. */
export function leanSheet({ rows, channels, h, window, title }) {
  const W = 1400;
  const ROW = 230;
  const d = createDrawing(W, 44 + rows.length * ROW, INK.bg);
  d.text(title, 10, 8, INK.text, 2);
  d.text(
    "FIGURE FROM BEHIND AT ITS WORST FRAME (COLOUR), 50 MS EITHER SIDE (GREY), THE VERTICAL AND THE BALANCE (YELLOW); TRACE: THE LEANS -70..70 DEG, + RIGHT",
    10,
    26,
    INK.dim,
  );
  const IDS = ["incline", "s.roll", "legs", "trunk", "head"];
  rows.forEach((r, n) => {
    const y0 = 44 + n * ROW;
    const f = r.frames;
    d.line(0, y0, W, y0, [40, 46, 58]);
    d.text(r.id.toUpperCase(), 10, y0 + 8, INK.text, 2);
    d.text(r.say.toUpperCase().slice(0, 52), 10, y0 + 28, INK.dim);
    if (f.length < 4) return;
    const R = r.read;
    const w = R.worst;
    const fw = f[w.i];
    d.text(
      `WORST ${w.id.toUpperCase()} ${w.by >= 0 ? "+" : ""}${w.by.toFixed(1)} DEG AT ${w.t.toFixed(2)} S  ${(fw.speed * 3.6).toFixed(0)} KM/H`,
      10,
      y0 + 42,
      INK.text,
    );
    const sh = (id) => R.channels[id].shiver.toFixed(2);
    d.text(
      `SHIVER LEGS ${sh("legs")} TRUNK ${sh("trunk")} HEAD ${sh("head")}  OFF ${R.off.toFixed(0)}`,
      10,
      y0 + 54,
      INK.dim,
    );
    // The figure: its neighbours in grey, then the frame itself.
    const k = 80;
    const cx = 150;
    const cy = y0 + ROW - 18;
    const step = Math.max(1, Math.round(0.05 / h));
    for (const j of [w.i - step, w.i + step]) {
      if (f[j]) figureBehind(d, f[j], cx, cy, k, { ink: INK.ghost, view: fw.fig.right });
    }
    figureBehind(d, fw, cx, cy, k, { marks: true });
    // The trace.
    const total = f[f.length - 1].t;
    const course = r.id.startsWith("course");
    const from = course ? Math.max(0, Math.min(total - window, w.t - window / 2)) : 0;
    const to = course ? Math.min(total, from + window) : total;
    const { i0, n: count } = span(r, from, to);
    const series = {};
    const values = (id) => (series[id] ??= f.map(channels.find((c) => c.id === id).get));
    strip(d, {
      x0: 330,
      y: y0 + 64,
      w: W - 350,
      h: ROW - 82,
      lo: -70,
      hi: 70,
      from,
      to,
      f,
      i0,
      n: count,
      ids: IDS,
      channels,
      values,
      gates: r.gates,
      mark: w.t,
    });
  });
  return d.toPng();
}

/** A RUN'S DETAIL over its window `from`..`to` s. */
export function leanDetail({ r, channels, h, from, to, shiver, title }) {
  const f = r.frames;
  const W = 1400;
  const L = 70;
  const PW = W - L - 20;
  const STROBE = 230;
  const PHASE = 260;
  const strips = [
    {
      h: 260,
      title: "LEAN DEG (+ RIGHT)",
      ids: ["incline", "balance", "legs", "trunk", "head", "angul"],
      lo: -70,
      hi: 70,
    },
    {
      h: 170,
      title: "RATE DEG/S",
      ids: ["incline", "legs", "trunk", "head"],
      lo: -500,
      hi: 500,
      of: "rate",
    },
    {
      h: 150,
      title: `LEFT AFTER ${Math.round(shiver * 1000)} MS SMOOTHING X5 DEG`,
      ids: ["s.roll", "legs", "trunk", "head"],
      lo: -6,
      hi: 6,
      of: "shiver",
    },
  ];
  const height = 50 + strips.reduce((a, s) => a + s.h + 24, 0) + STROBE + 30 + PHASE + 20;
  const d = createDrawing(W, height, INK.bg);
  d.text(`${title}  WINDOW ${from.toFixed(1)}-${to.toFixed(1)} S`, 10, 8, INK.text, 2);
  d.text(r.say.toUpperCase().slice(0, 150), 10, 28, INK.dim);
  const { i0, n } = span(r, from, to);
  const raw = {};
  const series = (id) => (raw[id] ??= f.map(channels.find((c) => c.id === id).get));
  let y = 50;
  for (const s of strips) {
    const values = (id) => {
      const v = series(id);
      if (s.of === "rate") return rate(v, h);
      if (s.of === "shiver") {
        const sm = smoothed(v, h, shiver);
        return v.map((a, i) => (a - sm[i]) * 5);
      }
      return v;
    };
    strip(d, { ...s, x0: L, y, w: PW, from, to, f, i0, n, channels, values, gates: r.gates });
    y += s.h + 24;
  }
  // THE STROBE from behind, the trunk coloured by how
  // far through an edge change he is (red held in a turn, pale crossing).
  d.rect(L, y, PW, STROBE, INK.panel);
  // Some 28 figures across the window, a whole number of frames apart.
  const every = Math.max(1, Math.round(n / 28));
  d.text(
    `FROM BEHIND EVERY ${every} FRAMES (${Math.round(every * h * 1000)} MS): VERTICAL (GREY), BALANCE (YELLOW), SNOW; TRUNK PALER THROUGH AN EDGE CHANGE`,
    L + 4,
    y + 4,
    INK.dim,
  );
  const px = (t) => L + ((t - from) / Math.max(1e-6, to - from)) * PW;
  for (let j = 0; j < n; j += every) {
    const x = f[i0 + j];
    const trunk = [255, 120 + Math.round(100 * x.transit), 90 + Math.round(120 * x.transit)];
    figureBehind(d, x, px(x.t), y + STROBE - 30, 70, { marks: true, trunk });
  }
  y += STROBE + 30;
  // THE PHASE PORTRAITS over the whole run: each lean against its rate.
  const ids = ["incline", "s.roll", "legs", "trunk", "head"];
  const cw = (W - 20 - (ids.length - 1) * 10) / ids.length;
  ids.forEach((id, k) => {
    const x0 = 10 + k * (cw + 10);
    d.rect(x0, y, cw, PHASE, INK.panel);
    const ch = channels.find((c) => c.id === id);
    const v = series(id);
    const rv = rate(v, h);
    const ax = (a) => x0 + cw / 2 + (Math.max(-70, Math.min(70, a)) / 70) * (cw / 2 - 6);
    const ay = (b) => y + PHASE / 2 - (Math.max(-500, Math.min(500, b)) / 500) * (PHASE / 2 - 6);
    d.line(x0, y + PHASE / 2, x0 + cw, y + PHASE / 2, INK.grid);
    d.line(x0 + cw / 2, y, x0 + cw / 2, y + PHASE, INK.grid);
    d.polyline(
      v.map((a, i) => [ax(a), ay(rv[i])]),
      [...ch.ink, 150],
      1,
    );
    d.text(`${id.toUpperCase()}: LEAN -70..70 / RATE -500..500`, x0 + 4, y + 4, ch.ink);
  });
  return d.toPng();
}
