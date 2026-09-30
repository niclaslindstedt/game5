// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S PICTURE: one recorded run as two panels — the SPEED
// against time (the edge angle and the crouch beside it, the flights
// shaded), and either the PROFILE (height against the distance the skier
// has covered: the snow's surface, the skier's centre of gravity and his
// pitch as a tick) or the PLAN (the path from above, with the skis' line
// ticked every half second). What `ride-lab.mjs` records is all it reads.

import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

export const INK = {
  bg: [246, 249, 252],
  panel: [255, 255, 255],
  grid: [214, 224, 234],
  text: [30, 46, 64],
  dim: [120, 138, 156],
  speed: [30, 90, 200],
  edge: [120, 170, 240],
  crouch: [230, 120, 40],
  air: [255, 226, 200],
  snow: [150, 170, 190],
  skier: [220, 50, 40],
  event: [40, 150, 90],
};

function panelBox(d, x, y, w, h, title) {
  d.fillRect(x, y, w, h, INK.panel);
  d.rect(x, y, w, h, INK.grid);
  d.text(title, x + 6, y + 6, INK.dim);
}

function range(values) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/** Draw a recorded run; returns the PNG bytes. */
export function drawRun(run, scenario, lines) {
  const W = 1100;
  const H = 640;
  const d = createDrawing(W, H, INK.bg);
  d.text(`RIDE ${scenario.id} - ${scenario.title}`, 16, 12, INK.text, 2);
  // ── Speed ──
  const px = 16;
  const py = 40;
  const pw = 700;
  const ph = 250;
  panelBox(d, px, py, pw, ph, "SPEED KM/H (BLUE), EDGE DEG (PALE), TUCK % (ORANGE)");
  const fs = run.frames;
  const tEnd = fs[fs.length - 1].t || 1;
  const vMax = Math.max(40, ...fs.map((f) => f.speed * 3.6), 100);
  const X = (t) => px + 10 + (t / tEnd) * (pw - 20);
  const Y = (v) => py + ph - 10 - (v / vMax) * (ph - 30);
  for (const f of fs) if (f.airborne) d.line(X(f.t), py + 20, X(f.t), py + ph - 10, INK.air);
  for (let v = 0; v <= vMax; v += 20) {
    d.line(px + 10, Y(v), px + pw - 10, Y(v), INK.grid);
    d.text(String(v), px + pw - 34, Y(v) - 9, INK.dim);
  }
  for (let t = 0; t <= tEnd; t += 1) d.line(X(t), py + ph - 10, X(t), py + ph - 6, INK.dim);
  d.polyline(
    fs.map((f) => [X(f.t), Y(f.crouch * 100)]),
    INK.crouch,
  );
  d.polyline(
    fs.map((f) => [X(f.t), Y(Math.abs(f.edge) * 57.3)]),
    INK.edge,
  );
  d.polyline(
    fs.map((f) => [X(f.t), Y(f.speed * 3.6)]),
    INK.speed,
    2,
  );
  for (const e of run.events) {
    if (e.kind === "hit" || e.kind === "land" || e.kind === "air" || e.kind === "reset") {
      d.line(X(e.t), py + 20, X(e.t), py + ph - 10, INK.event);
      d.text(e.kind, X(e.t) + 2, py + 22, INK.event);
    }
  }
  // ── The numbers ──
  const nx = 740;
  panelBox(d, nx, py, W - nx - 16, ph, "MEASURED");
  lines.forEach(([label, value], i) => {
    d.text(`${label}`, nx + 10, py + 26 + i * 18, INK.dim);
    d.text(`${value}`, nx + 210, py + 26 + i * 18, INK.text);
  });
  // ── Profile or plan ──
  const qy = py + ph + 16;
  const qh = H - qy - 16;
  const qw = W - 32;
  if (scenario.view === "plan") {
    panelBox(d, px, qy, qw, qh, "PLAN - THE PATH FROM ABOVE, THE SKIS' LINE EVERY 0.5 S");
    const [x0, x1] = range(fs.map((f) => f.x));
    const [z0, z1] = range(fs.map((f) => f.z));
    const span = Math.max(x1 - x0, z1 - z0, 20);
    const s = Math.min((qw - 40) / span, (qh - 40) / span);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const PX = (x) => px + qw / 2 + (x - cx) * s;
    const PZ = (z) => qy + qh / 2 - (z - cz) * s;
    for (const tr of run.trees) d.disk(PX(tr.x), PZ(tr.z), Math.max(2, tr.radius * s), INK.event);
    d.polyline(
      fs.map((f) => [PX(f.x), PZ(f.z)]),
      INK.speed,
      2,
    );
    let next = 0;
    for (const f of fs) {
      if (f.t < next) continue;
      next += 0.5;
      const L = 1.5;
      d.line(
        PX(f.x),
        PZ(f.z),
        PX(f.x + Math.sin(f.heading) * L),
        PZ(f.z + Math.cos(f.heading) * L),
        INK.skier,
        2,
      );
    }
  } else {
    panelBox(
      d,
      px,
      qy,
      qw,
      qh,
      "PROFILE - SNOW (GREY), CENTRE OF GRAVITY (RED), THE SKIS EVERY 0.25 S",
    );
    const dEnd = Math.max(10, fs[fs.length - 1].dist);
    const [g0, g1] = range(fs.flatMap((f) => [f.ground - f.sink, f.y + 0.6]));
    const hSpan = Math.max(4, g1 - g0 + 1);
    // One vertical scale for both axes unless the run is long: then the
    // heights are exaggerated to be read at all, and the caption says so.
    const sx = (qw - 40) / dEnd;
    const sy = Math.min((qh - 40) / hSpan, sx * 8);
    const DX = (dd) => px + 20 + dd * sx;
    const DY = (h) => qy + qh - 20 - (h - g0) * sy;
    d.text(`VERTICAL X${(sy / sx).toFixed(1)}`, px + qw - 110, qy + 6, INK.dim);
    d.polyline(
      fs.map((f) => [DX(f.dist), DY(f.ground)]),
      INK.snow,
      2,
    );
    d.polyline(
      fs.map((f) => [DX(f.dist), DY(f.ground - f.sink)]),
      INK.grid,
    );
    d.polyline(
      fs.map((f) => [DX(f.dist), DY(f.y)]),
      INK.skier,
      2,
    );
    let next = 0;
    for (const f of fs) {
      if (f.t < next) continue;
      next += 0.25;
      const L = 1.4;
      const dx = Math.cos(f.pitch) * L * sx;
      const dy = Math.sin(f.pitch) * L * sy;
      d.line(
        DX(f.dist),
        DY(f.y),
        DX(f.dist) + dx,
        DY(f.y) - dy,
        f.airborne ? INK.crouch : INK.skier,
        2,
      );
    }
  }
  return d.toPng();
}
