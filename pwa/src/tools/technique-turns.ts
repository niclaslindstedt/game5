// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TECHNIQUE LAB's TURN-SHAPE SHEET (`make technique ARGS=--sheets=turns`):
// how SHARP each technique turns. The runs are measured in Node
// (`scripts/lib/technique-shape.mjs`: every technique's own natural turn
// skied down one common open slope by a scripted rhythm) and handed to the
// page, which draws them here from straight above — every panel at the SAME
// metres a pixel on a metre grid, so the slalom's 5 m arcs and the
// downhill's 50 m sweeps are seen against each other at a glance:
//
//   the line    coloured by its radius (`BINS`), the start at the top
//   each apex   a dot and its radius, the turn's time and its peak edge
//   the target  the researched radius drawn as a faint circle at the
//               median turn's apex, and its band in the panel's head

/** One turn's apex as measured (`shapeOf`). */
export type ShapeTurn = {
  x: number;
  z: number;
  dx: number;
  dz: number;
  bend: number;
  radius: number;
  time: number;
  edge: number;
  kmh: number;
};
export type ShapeRow = {
  technique: string;
  skis: string;
  drive: { turn: number; kmh: number };
  /** [x, z, the line's radius there] every few steps. */
  line: [number, number, number][];
  turns: ShapeTurn[];
  thrown: boolean;
  band: { lo: number; hi: number; est?: boolean } | null;
};
export type Shapes = { course: string; seconds: number; rows: ShapeRow[] };

/** THE RADIUS AS A COLOUR, m: the line is painted in the bin its radius
 * falls in — the tightest red, a line all but straight grey. */
const BINS: { below: number; colour: string; label: string }[] = [
  { below: 5, colour: "#ff3b30", label: "< 5 m" },
  { below: 10, colour: "#ff9500", label: "5–10" },
  { below: 20, colour: "#ffd60a", label: "10–20" },
  { below: 40, colour: "#30d158", label: "20–40" },
  { below: 150, colour: "#40c8ff", label: "40–150" },
  { below: Infinity, colour: "#8e9aa6", label: "> 150 (straight)" },
];
const colourOf = (r: number) => BINS.find((b) => r < b.below)!.colour;

/** The scales the sheet may pick, m a pixel — the finest the longest run
 * fits `TALLEST` px at. */
const SCALES = [0.1, 0.2, 0.25, 0.4, 0.5, 0.75, 1, 1.5, 2];
const TALLEST = 1100;
/** Room either side of a line for its apexes' labels, px. */
const LABEL_ROOM = 140;

const mid = (b: { lo: number; hi: number }) => (b.lo + b.hi) / 2;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

/** Draw the sheet onto `canvas`; its size and a note. */
export function drawTurns(
  canvas: HTMLCanvasElement,
  shapes: Shapes,
): { w: number; h: number; note: string } {
  const rows = shapes.rows;
  // Each run from its start: across (x) and down the slope (z).
  const extent = rows.map((r) => {
    const xs = r.line.map((p) => p[0]);
    const zs = r.line.map((p) => p[1]);
    return {
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      z0: Math.min(...zs),
      z1: Math.max(...zs),
    };
  });
  const longest = Math.max(...extent.map((e) => e.z1 - e.z0));
  const mpp = SCALES.find((s) => longest / s <= TALLEST) ?? SCALES[SCALES.length - 1];
  const panels = extent.map((e) => Math.max(260, (e.x1 - e.x0) / mpp + 2 * LABEL_ROOM));
  const headH = 104;
  const panelHead = 74;
  const gap = 10;
  const tall = longest / mpp + 30;
  canvas.width = Math.max(
    980,
    panels.reduce((a, b) => a + b + gap, gap),
  );
  canvas.height = headH + panelHead + tall + 16;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b1116";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "middle";
  ctx.font = "12px monospace";
  ctx.fillStyle = "#e8eef4";
  [
    `TECHNIQUE · TURN SHAPES · each technique's own linked carve on ${shapes.course}, ${shapes.seconds.toFixed(1)} s each`,
    `from straight above, every panel at ${mpp} m a pixel (the grid every 10 m, bolder every 50 m), the start at the top`,
    "each apex: the line's radius there · the turn's time · its peak edge · the dashed circle the researched radius at the median turn",
  ].forEach((l, i) => ctx.fillText(l, 8, 12 + i * 16));
  // The legend and a scale bar.
  let lx = 8;
  ctx.fillText("the line's radius:", lx, 66);
  lx += ctx.measureText("the line's radius: ").width;
  for (const b of BINS) {
    ctx.fillStyle = b.colour;
    ctx.fillRect(lx, 62, 22, 8);
    ctx.fillStyle = "#e8eef4";
    ctx.fillText(b.label, lx + 26, 66);
    lx += 34 + ctx.measureText(b.label).width;
  }
  const bar = 50 / mpp;
  ctx.fillStyle = "#e8eef4";
  ctx.fillRect(8, 86, bar, 4);
  for (let m = 0; m <= 50; m += 10) ctx.fillRect(8 + m / mpp, 82, 1, 12);
  ctx.fillText("50 m", 14 + bar, 88);

  let x0 = gap;
  rows.forEach((row, i) => {
    const e = extent[i];
    const w = panels[i];
    const top = headH + panelHead;
    // The panel's middle across is the run's.
    const cx = (e.x0 + e.x1) / 2;
    const px = (x: number) => x0 + w / 2 + (x - cx) / mpp;
    const py = (z: number) => top + 10 + (z - e.z0) / mpp;
    // The head.
    const radii = row.turns.map((t) => t.radius);
    const medR = median(radii);
    const head = [
      `${row.technique.toUpperCase()} · ${row.skis}`,
      `natural turn ${row.drive.turn} s from ${row.drive.kmh} km/h`,
      `median R ${medR === null ? "—" : medR.toFixed(1)} m · ${fmt(median(row.turns.map((t) => t.time)), 2)} s · ${fmt(median(row.turns.map((t) => t.edge)), 0)}°`,
      row.band
        ? `target R ${row.band.lo}–${row.band.hi} m${row.band.est ? " (est.)" : ""}`
        : "no discipline: no target",
    ];
    if (row.thrown) head[1] += " · THROWN";
    ctx.fillStyle = "#e8eef4";
    head.forEach((l, j) => ctx.fillText(l, x0 + 4, headH + 8 + j * 16));
    // The panel and its grid, every 10 m from the start.
    ctx.fillStyle = "#16212b";
    ctx.fillRect(x0, top, w, tall);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, top, w, tall);
    ctx.clip();
    for (let m = 0; m * 1 <= longest + 10; m += 10) {
      ctx.fillStyle = m % 50 === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
      ctx.fillRect(x0, py(e.z0 + m), w, 1);
    }
    const left = Math.floor((cx - (w / 2) * mpp) / 10) * 10;
    for (let m = left; m <= cx + (w / 2) * mpp; m += 10) {
      ctx.fillStyle =
        Math.round(m) % 50 === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
      ctx.fillRect(px(m), top, 1, tall);
    }
    // The target radius at the median turn's apex, on the inside of it.
    const at = row.turns.find((t) => t.radius === medR);
    if (row.band && at) {
      const r = mid(row.band);
      const ox = at.x + at.bend * r * at.dz;
      const oz = at.z - at.bend * r * at.dx;
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px(ox), py(oz), r / mpp, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // The line, in its radius's colour.
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let k = 1; k < row.line.length; k++) {
      const a = row.line[k - 1];
      const b = row.line[k];
      ctx.strokeStyle = colourOf(b[2]);
      ctx.beginPath();
      ctx.moveTo(px(a[0]), py(a[1]));
      ctx.lineTo(px(b[0]), py(b[1]));
      ctx.stroke();
    }
    // The apexes, labelled on the outside of each turn.
    ctx.font = "11px monospace";
    for (const t of row.turns) {
      const ax = px(t.x);
      const ay = py(t.z);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // The outside: away from the turn's centre, across the page.
      const out = -t.bend * t.dz >= 0 ? 1 : -1;
      const text = `${t.radius.toFixed(1)} m ${t.time.toFixed(2)} s ${t.edge.toFixed(0)}°`;
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(11,17,22,0.7)";
      const tx = out > 0 ? ax + 8 : ax - 8 - tw;
      ctx.fillRect(tx - 2, ay - 7, tw + 4, 14);
      ctx.fillStyle = colourOf(t.radius);
      ctx.fillText(text, tx, ay);
    }
    ctx.font = "12px monospace";
    ctx.restore();
    x0 += w + gap;
  });
  return { w: canvas.width, h: canvas.height, note: `turns at ${mpp} m/px` };
}

function fmt(v: number | null, d: number): string {
  return v === null ? "—" : v.toFixed(d);
}
