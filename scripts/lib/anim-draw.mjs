// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMATION LAB'S SHEET (`make anim`): one scene of the rider's on one
// PNG, read top to bottom —
//
//   FILMSTRIPS   the frames of its window, a column a moment and a row a
//                way of drawing him: SHADED (the posed model rasterized,
//                `anim-raster.mjs`) from the side, behind and the front
//                three-quarter; WIRE (the mesh's hidden-line wireframe over
//                a dimmed fill) from the side and behind; BONES (the
//                skeleton over a ghost of the fill, each joint coloured by
//                its jolt that frame) from the side and behind. A cell
//                framed red is a frame that SNAPS. Every row is at one
//                scale, so what moves between cells is the motion.
//   ONION SKINS  every frame's skeleton laid over the others from the side,
//                behind and above, old to new blue to orange, with the
//                paths of his head, hands and boots traced and coloured by
//                speed — a pop is a spike off a smooth curve.
//   CHARTS       against the scene's clock, its phases banded along the top
//                and its snaps marked down every chart: the joint angles
//                group by group, the angles' acceleration (log), each
//                joint's jolt as a heatmap, each limb's stretch, the tips'
//                speeds.

import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { ANGLE_GROUPS, SPANS, TIPS, sideOf } from "./anim-measure.mjs";
import { boundsOf, cameraOf, drawCapture, fitBox } from "./anim-raster.mjs";

export const INK = {
  bg: [14, 18, 24],
  panel: [22, 27, 35],
  frame: [52, 60, 74],
  text: [220, 226, 236],
  dim: [130, 140, 156],
  grid: [36, 42, 54],
  snap: [244, 80, 70],
  ok: [110, 200, 140],
  warn: [240, 190, 80],
  l: [90, 160, 255],
  r: [255, 110, 90],
  c: [235, 235, 235],
  bike: [150, 156, 168],
};

const PALETTE = [
  [90, 160, 255],
  [255, 110, 90],
  [120, 225, 200],
  [255, 180, 70],
  [190, 140, 255],
  [255, 120, 200],
  [170, 220, 90],
  [240, 240, 240],
];

/** The rows of the filmstrips: how each draws him and from where. */
const STRIPS = [
  { mode: "shade", view: "side" },
  { mode: "shade", view: "back" },
  { mode: "shade", view: "front3" },
  { mode: "wire", view: "side" },
  { mode: "wire", view: "back" },
  { mode: "bones", view: "side" },
  { mode: "bones", view: "back" },
];

const W = 1800;
const PAD = 20;
const LABEL = 120;

/**
 * The scene's sheet as a PNG: `scene` its id and title, `family` its
 * family, `m` its measure (`anim-measure.mjs`), `samples` the reader's,
 * `caps` the captured frames (`{ t, k, cap?, joints, bike? }`), `verdict`
 * the row. `render` false leaves the shaded and wire rows out.
 */
export function drawSheet({ scene, family, m, samples, caps, verdict, render = true }) {
  const strips = STRIPS.filter((s) => render || s.mode === "bones");
  const N = Math.max(1, caps.length);
  const cellW = Math.floor((W - 2 * PAD - LABEL) / N);
  const cellH = 220;
  const stripH = strips.length * (cellH + 16);
  const onionH = 470;
  const chartH = 150;
  const charts = chartsOf(m);
  const chartsH = 30 + charts.reduce((a, c) => a + (c.h ?? chartH) + 30, 0);
  const H = 90 + stripH + 30 + onionH + 30 + chartsH;
  const d = createDrawing(W, H, INK.bg);

  // ── The head: the scene and its verdict. ──
  d.text(`${family} · ${scene.id}`, PAD, 14, INK.text, 3);
  d.text(scene.title ?? "", PAD, 44, INK.dim, 1);
  const v = verdict;
  const bad = (x) => (x ? INK.snap : INK.ok);
  const parts = [
    [`snap ${Math.round(v.snapShare * 100)}%`, v.snapShare > 0],
    [`worst jolt ${v.worstJolt} m/s2 ${v.worstJoint} @${v.worstAt}s`, v.worstJolt > m.most],
    [`pops ${v.pops}`, v.pops > 0],
    [
      `angle snaps ${v.angleSnaps} (worst ${v.worstAngle} deg/s2 ${v.worstAngleId})`,
      v.angleSnaps > 0,
    ],
    [`stretch ${v.stretch}% ${v.stretchBone}`, v.stretch > m.stretchMost * 100],
    [`clips ${v.clips}`, v.clips > 0],
    [`jerk rms ${v.jerkRms} m/s3`, false],
  ];
  let x = PAD;
  for (const [s, b] of parts) {
    d.text(s, x, 62, bad(b), 1);
    x += (s.length + 3) * 6;
  }

  // ── The filmstrips. ──
  let y = 90;
  const joltAt = new Map(m.jolt.jolts.map((f) => [f.t, f]));
  for (const strip of strips) {
    const cam = cameraOf(strip.view);
    const all = caps.map((c) => c.cap).filter(Boolean);
    const bounds = boundsOf(
      cam,
      strip.mode === "bones" ? [] : all,
      caps.flatMap((c) => [
        c.joints,
        ...(c.bike ? [Object.assign({}, [...c.bike.lines.flat(), ...c.bike.rings.flat()])] : []),
      ]),
    );
    d.text(strip.mode, PAD, y + 8, INK.text, 2);
    d.text(cam.say, PAD, y + 30, INK.dim, 1);
    caps.forEach((c, k) => {
      const box = { x0: PAD + LABEL + k * cellW, y0: y, w: cellW - 6, h: cellH };
      const fit = fitBox(bounds, box);
      d.fillRect(box.x0, box.y0, box.w, box.h, INK.panel);
      const f = joltAt.get(c.t);
      let z = null;
      if (c.cap && strip.mode !== "bones") z = drawCapture(d, c.cap, cam, box, fit, strip.mode);
      else if (c.cap) z = drawCapture(d, c.cap, cam, box, fit, "ghost");
      if (c.bike) drawBike(d, c.bike, cam, fit, box);
      if (strip.mode === "bones") drawBones(d, c.joints, cam, fit, box, m, c.k);
      d.rect(box.x0, box.y0, box.w, box.h, f && f.a > m.most ? INK.snap : INK.frame);
      d.text(`${c.t.toFixed(2)}s ${c.phase ?? ""}`, box.x0 + 4, box.y0 + box.h + 4, INK.dim, 1);
      void z;
    });
    y += cellH + 16;
  }

  // ── The onion skins. ──
  y += 14;
  d.text(
    "onion skins: every frame's bones, old blue to new orange; the tips' paths by speed (dim slow, bright fast); red a frame that snaps",
    PAD,
    y,
    INK.text,
    1,
  );
  y += 16;
  const views = ["side", "back", "top"];
  const pw = Math.floor((W - 2 * PAD - 2 * 10) / 3);
  views.forEach((view, i) => {
    const cam = cameraOf(view);
    const box = { x0: PAD + i * (pw + 10), y0: y, w: pw, h: onionH - 20 };
    d.fillRect(box.x0, box.y0, box.w, box.h, INK.panel);
    const bounds = boundsOf(
      cam,
      [],
      samples.map((s) => s.joints),
    );
    const fit = fitBox(bounds, box, 0.04);
    drawOnion(d, samples, cam, fit, box, m);
    d.rect(box.x0, box.y0, box.w, box.h, INK.frame);
    d.text(cam.say, box.x0 + 6, box.y0 + 6, INK.dim, 1);
  });
  y += onionH;

  // ── The charts. ──
  y += 10;
  const t0 = m.t[0] ?? 0;
  const t1 = m.t.at(-1) ?? 1;
  const cx0 = PAD + LABEL;
  const cw = W - 2 * PAD - LABEL;
  const px = (t) => cx0 + ((t - t0) / Math.max(1e-6, t1 - t0)) * cw;
  // The phases along the top, a band each.
  drawPhases(d, m, px, y, cw);
  y += 30;
  const snapTimes = [...m.jolt.events.map((e) => e.t), ...m.angleSnaps.map((e) => e.t)];
  for (const c of charts) {
    const h = c.h ?? chartH;
    d.text(c.say, PAD, y, INK.text, 1);
    const box = { x0: cx0, y0: y + 12, w: cw, h };
    d.fillRect(box.x0, box.y0, box.w, box.h, INK.panel);
    for (const c2 of caps) d.line(px(c2.t), box.y0, px(c2.t), box.y0 + h, INK.grid);
    for (const t of snapTimes) d.line(px(t), box.y0, px(t), box.y0 + h, [...INK.snap, 90]);
    c.draw(d, box, px);
    d.rect(box.x0, box.y0, box.w, box.h, INK.frame);
    y += h + 30;
  }
  return d.toPng();
}

/** The charts, top to bottom. */
function chartsOf(m) {
  const out = [];
  for (const g of ANGLE_GROUPS) {
    const series = Object.values(m.angles).filter((a) => a.group === g.id);
    if (!series.length) continue;
    out.push({
      say: g.say,
      draw: (d, box, px) =>
        lines(
          d,
          box,
          px,
          m.t,
          series.map((s, i) => ({ v: s.v, colour: PALETTE[i % PALETTE.length], say: s.say })),
        ),
    });
  }
  out.push({
    say: `angular acceleration, |deg/s2| (log 10 to 1000000); the red line ${m.angleMost}`,
    draw: (d, box, px) =>
      lines(
        d,
        box,
        px,
        m.t,
        Object.values(m.angles).map((s, i) => ({
          v: s.accel.map((x) => (x === null ? null : Math.abs(x))),
          colour: PALETTE[i % PALETTE.length],
          say: s.id,
        })),
        { log: [1, 6], line: m.angleMost, legend: false },
      ),
  });
  const joints = jointOrder(Object.keys(m.perJoint));
  out.push({
    say: `each joint's jolt, m/s2 (log: dark 1, green 10, yellow 100, red past ${m.most})`,
    h: joints.length * 9 + 4,
    draw: (d, box, px) => heat(d, box, px, m, joints),
  });
  const held = Object.values(m.stretch).filter((s) => s.held);
  out.push({
    say: `each limb's length off its middle, % (the dashed lines +-${m.stretchMost * 100}%)`,
    draw: (d, box, px) =>
      lines(
        d,
        box,
        px,
        m.t,
        held.map((s, i) => ({
          v: s.share.map((x) => (x === null ? null : x * 100)),
          colour: PALETTE[i % PALETTE.length],
          say: s.id,
        })),
        {
          span: [-Math.max(6, m.stretchWorst.a * 100 + 1), Math.max(6, m.stretchWorst.a * 100 + 1)],
          bands: [-m.stretchMost * 100, m.stretchMost * 100],
        },
      ),
  });
  out.push({
    say: "the tips' speed in his body frame, m/s",
    draw: (d, box, px) =>
      lines(
        d,
        box,
        px,
        m.t,
        TIPS.filter((n) => m.speeds[n]).map((n, i) => ({
          v: m.speeds[n],
          colour: PALETTE[i % PALETTE.length],
          say: n,
        })),
        { span: [0, null] },
      ),
  });
  out.push({
    say: "clips: a limb through another or the trunk (a tick a frame)",
    h: 40,
    draw: (d, box, px) => {
      const kinds = [...new Set(m.clips.map((c) => c.kind))];
      kinds.forEach((k, i) => {
        const yy = box.y0 + 4 + i * 9;
        d.text(k, box.x0 - LABEL + 4, yy, INK.warn, 1);
        for (const c of m.clips) if (c.kind === k) d.line(px(c.t), yy, px(c.t), yy + 7, INK.warn);
      });
      if (!kinds.length) d.text("none", box.x0 + 6, box.y0 + 14, INK.ok, 1);
    },
  });
  return out;
}

/** Joints in the skeleton's order, then the rest. */
function jointOrder(names) {
  const order = [];
  for (const [a, b] of SPANS) for (const n of [a, b]) if (!order.includes(n)) order.push(n);
  return [
    ...order.filter((n) => names.includes(n)),
    ...names.filter((n) => !order.includes(n)).sort(),
  ];
}

/** Line series against time, nulls breaking a line. */
function lines(d, box, px, t, series, opts = {}) {
  const { log = null, line = null, legend = true, bands = null } = opts;
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) {
    for (const x of s.v) {
      if (x === null || !Number.isFinite(x)) continue;
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  if (opts.span) {
    if (opts.span[0] !== null) lo = Math.min(lo, opts.span[0]);
    if (opts.span[1] !== null) hi = Math.max(hi, opts.span[1]);
  }
  if (!Number.isFinite(lo)) [lo, hi] = [0, 1];
  if (hi - lo < 1e-6) [lo, hi] = [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.06;
  if (!log) [lo, hi] = [lo - pad, hi + pad];
  const py = log
    ? (x) => {
        const l = Math.log10(Math.max(10 ** log[0], x));
        return box.y0 + box.h - ((l - log[0]) / (log[1] - log[0])) * box.h;
      }
    : (x) => box.y0 + box.h - ((x - lo) / (hi - lo)) * box.h;
  // The grid and its numbers.
  const ticks = log ? range(log[0], log[1]).map((e) => 10 ** e) : niceTicks(lo, hi);
  for (const tk of ticks) {
    const yy = py(tk);
    if (yy < box.y0 || yy > box.y0 + box.h) continue;
    d.line(box.x0, yy, box.x0 + box.w, yy, INK.grid);
    d.text(fmt(tk), box.x0 - 44, yy - 3, INK.dim, 1);
  }
  if (bands) for (const b of bands) dashed(d, box.x0, py(b), box.x0 + box.w, INK.warn);
  if (line !== null) d.line(box.x0, py(line), box.x0 + box.w, py(line), INK.snap);
  for (const s of series) {
    let prev = null;
    s.v.forEach((x, k) => {
      if (x === null || !Number.isFinite(x)) {
        prev = null;
        return;
      }
      const p = [px(t[k]), Math.max(box.y0, Math.min(box.y0 + box.h, py(x)))];
      if (prev) d.line(prev[0], prev[1], p[0], p[1], s.colour);
      prev = p;
    });
  }
  if (legend) {
    let lx = box.x0 + 6;
    for (const s of series) {
      d.fillRect(lx, box.y0 + 5, 8, 6, s.colour);
      d.text(s.say, lx + 11, box.y0 + 4, s.colour, 1);
      lx += 11 + (s.say.length + 2) * 6;
    }
  }
}

function range(a, b) {
  const out = [];
  for (let k = a; k <= b; k++) out.push(k);
  return out;
}

function niceTicks(lo, hi) {
  const span = hi - lo;
  const step = 10 ** Math.floor(Math.log10(span / 3));
  const k = span / step > 15 ? 5 : span / step > 7 ? 2 : 1;
  const s = step * k;
  const out = [];
  for (let x = Math.ceil(lo / s) * s; x <= hi; x += s) out.push(Math.round(x / s) * s);
  return out;
}

const fmt = (x) =>
  Math.abs(x) >= 1e4
    ? `${Math.round(x / 1000)}k`
    : Math.abs(x) >= 10
      ? `${Math.round(x)}`
      : `${Math.round(x * 10) / 10}`;

function dashed(d, x0, y, x1, c) {
  for (let x = x0; x < x1; x += 8) d.line(x, y, Math.min(x1, x + 4), y, c);
}

/** The jolt heatmap: a row a joint, a column a frame. */
function heat(d, box, px, m, joints) {
  joints.forEach((n, r) => {
    const yy = box.y0 + 2 + r * 9;
    d.text(n, box.x0 - LABEL + 4, yy, sideColour(n), 1);
    const s = m.perJoint[n].jolt;
    s.forEach((a, k) => {
      if (a === null) return;
      const x0 = px(m.t[k]);
      const x1 = k + 1 < m.t.length ? px(m.t[k + 1]) : x0 + 1;
      d.fillRect(Math.floor(x0), yy, Math.max(1, Math.ceil(x1 - x0)), 8, ramp(a, m.most));
    });
  });
}

/** A jolt to a colour: dark under 1, through green and yellow, red past the line. */
function ramp(a, most) {
  if (a > most) return INK.snap;
  const l = Math.max(0, Math.min(1, Math.log10(Math.max(1, a)) / Math.log10(most)));
  if (l < 0.5) {
    const k = l / 0.5;
    return [Math.round(20 + 40 * k), Math.round(40 + 150 * k), Math.round(50 + 40 * k)];
  }
  const k = (l - 0.5) / 0.5;
  return [Math.round(60 + 190 * k), Math.round(190 + 20 * k), Math.round(90 - 40 * k)];
}

const sideColour = (n) => INK[sideOf(n)];

/** The phases the frames were drawn in, a band each along the top. */
function drawPhases(d, m, px, y, cw) {
  const colours = new Map();
  let start = 0;
  for (let k = 1; k <= m.phases.length; k++) {
    if (k < m.phases.length && m.phases[k] === m.phases[start]) continue;
    const p = m.phases[start];
    if (!colours.has(p)) colours.set(p, PALETTE[colours.size % PALETTE.length]);
    const x0 = px(m.t[start]);
    const x1 = px(m.t[Math.min(k, m.t.length - 1)]);
    d.fillRect(Math.floor(x0), y, Math.max(1, Math.ceil(x1 - x0)), 10, [...colours.get(p), 120]);
    if (x1 - x0 > p.length * 6 + 4) d.text(p, x0 + 2, y + 12, colours.get(p), 1);
    start = k;
  }
  d.text("phase", PAD, y + 2, INK.dim, 1);
  void cw;
}

/** The skeleton of one frame, each joint coloured by its jolt that frame. */
function drawBones(d, joints, cam, fit, box, m, k) {
  const at = (n) => {
    const p = joints[n];
    if (!p) return null;
    const [sx, sy] = cam.project(p.x, p.y, p.z);
    return [fit.sx(sx), fit.sy(sy)];
  };
  for (const [a, b] of SPANS) {
    const p = at(a);
    const q = at(b);
    if (!p || !q) continue;
    d.line(p[0], p[1], q[0], q[1], INK[sideOf(b)], 2);
  }
  for (const n of Object.keys(joints)) {
    const p = at(n);
    if (!p) continue;
    const a = m.perJoint[n]?.jolt[k] ?? 0;
    d.fillRect(Math.round(p[0]) - 2, Math.round(p[1]) - 2, 5, 5, ramp(a ?? 0, m.most));
  }
  void box;
}

/** The bike's stick, grey. */
function drawBike(d, bike, cam, fit) {
  const at = (p) => {
    const [sx, sy] = cam.project(p.x, p.y, p.z);
    return [fit.sx(sx), fit.sy(sy)];
  };
  for (const [a, b] of bike.lines) {
    const p = at(a);
    const q = at(b);
    d.line(p[0], p[1], q[0], q[1], INK.bike, 2);
  }
  for (const ring of bike.rings) {
    for (let k = 1; k < ring.length; k++) {
      const p = at(ring[k - 1]);
      const q = at(ring[k]);
      d.line(p[0], p[1], q[0], q[1], INK.bike, 1);
    }
  }
}

/** Every frame's bones over the others, and the tips' paths. */
function drawOnion(d, samples, cam, fit, box, m) {
  const n = samples.length;
  const every = Math.max(1, Math.round(n / 40));
  const snapAt = new Set(m.jolt.jolts.filter((f) => f.a > m.most).map((f) => f.t));
  const at = (p) => {
    const [sx, sy] = cam.project(p.x, p.y, p.z);
    return [fit.sx(sx), fit.sy(sy)];
  };
  samples.forEach((s, k) => {
    const snap = snapAt.has(s.t);
    if (!snap && k % every !== 0) return;
    const u = n > 1 ? k / (n - 1) : 0;
    const c = snap
      ? [...INK.snap, 120]
      : [Math.round(80 + 175 * u), Math.round(140 + 30 * u), Math.round(255 - 185 * u), 70];
    for (const [a, b] of SPANS) {
      const p = s.joints[a];
      const q = s.joints[b];
      if (!p || !q) continue;
      const P = at(p);
      const Q = at(q);
      d.line(P[0], P[1], Q[0], Q[1], c, 1);
    }
  });
  // The tips' paths, by speed.
  for (const tip of TIPS) {
    const sp = m.speeds[tip];
    if (!sp) continue;
    let prev = null;
    samples.forEach((s, k) => {
      const p = s.joints[tip];
      if (!p) {
        prev = null;
        return;
      }
      const P = at(p);
      if (prev) {
        const v = Math.min(1, (sp[k] ?? 0) / 6);
        const base = INK[sideOf(tip)];
        d.line(
          prev[0],
          prev[1],
          P[0],
          P[1],
          base.map((x) => Math.round(x * (0.35 + 0.65 * v))),
          2,
        );
      }
      prev = P;
    });
  }
  void box;
}
