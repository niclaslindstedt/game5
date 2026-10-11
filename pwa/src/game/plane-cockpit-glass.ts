// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S GLASS, PAINTED IN CODE (`plane-cockpit.ts` lays each on
// the panel, `plane-cockpit-paint.ts` paints the panel round them) —
// canvas only, three-free. Every face is painted again while the cockpit
// is in sight, off the readings `plane-cockpit-plan.ts` makes of the
// plane's state:
//
//   THE PRIMARY FLIGHT DISPLAY in front of the pilot, laid out as a modern
//   one is: the attitude across the whole screen (the sky over the ground,
//   turned with the bank, the pitch ladder every 5°, the roll scale and its
//   pointer over the slip's trapezoid, the yellow aircraft symbol), the
//   airspeed tape on the left with its coloured bands, the altitude tape on
//   the right with the climb beside it, the heading arc along the foot, the
//   true airspeed, the outside air and the flaps along the top, a red
//   STALL across it when a wing lets go;
//   THE MULTI-FUNCTION DISPLAY in the middle: the engine's page down its
//   left (the torque and the turbine's temperature as dials, the gas
//   generator, the propeller, the fuel flow, the oil, the fuel, the flaps
//   and the trim) and a heading-up TERRAIN MAP on the rest, the snow round
//   the plane painted by how far it stands under it (red above, amber
//   within 300 ft, green and black below);
//   THE STANDBYS between them: the airspeed, the attitude and the
//   altimeter as three small round instruments;
//   THE ANNUNCIATORS over the middle, lit by what the plane is doing.
//
// Dark and unlit when the engine is not turning (the battery's display
// test is the only light then).

import type { PlaneGauges } from "./plane-cockpit-plan.ts";

type Ctx = CanvasRenderingContext2D;

/** The canvases' sizes, px. */
export const PFD_W = 512;
export const PFD_H = 386;
export const MFD_W = 512;
export const MFD_H = 386;
export const STANDBY_W = 170;
export const STANDBY_H = 512;
export const LIGHTS_W = 768;
export const LIGHTS_H = 88;

const INK = "#eef1ee";
const DIM = "#9aa3a8";
const GREEN = "#36d96a";
const AMBER = "#f5b41e";
const RED = "#ec3127";
const CYAN = "#33d6e8";
const MAGENTA = "#e049d8";
const YELLOW = "#ffd21a";
const SKY = ["#1f5fbf", "#4f97e6"];
const GROUND = ["#7a4a1c", "#4e2e0f"];

const deg = (d: number): number => (d * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function text(
  c: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  colour = INK,
  align: CanvasTextAlign = "center",
): void {
  c.fillStyle = colour;
  c.font = `600 ${size}px "DejaVu Sans Mono", "Menlo", monospace`;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.fillText(s, x, y);
}

/** A screen gone dark: the glass's black and a faint sheen. */
function dark(c: Ctx, w: number, h: number): void {
  c.fillStyle = "#050607";
  c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(255,255,255,0.05)");
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

// ── THE PRIMARY FLIGHT DISPLAY ─────────────────────────────────────────

/** Px of the attitude a degree of pitch moves the horizon. */
const PITCH_PX = 7;

function attitude(c: Ctx, g: PlaneGauges, cx: number, cy: number, w: number, h: number): void {
  c.save();
  c.translate(cx, cy);
  c.rotate(-g.roll);
  const off = ((g.pitch * 180) / Math.PI) * PITCH_PX;
  const big = Math.hypot(w, h) * 1.4;
  // The sky over the ground, the horizon a white line.
  let grd = c.createLinearGradient(0, off - big, 0, off);
  grd.addColorStop(0, SKY[0]);
  grd.addColorStop(1, SKY[1]);
  c.fillStyle = grd;
  c.fillRect(-big, off - big, big * 2, big);
  grd = c.createLinearGradient(0, off, 0, off + big);
  grd.addColorStop(0, GROUND[0]);
  grd.addColorStop(1, GROUND[1]);
  c.fillStyle = grd;
  c.fillRect(-big, off, big * 2, big);
  c.fillStyle = "#ffffff";
  c.fillRect(-big, off - 1.5, big * 2, 3);
  // The pitch ladder, every 5°, labelled every 10°, clipped round the
  // middle as a real one is.
  c.save();
  c.beginPath();
  c.rect(-w * 0.3, -h * 0.36, w * 0.6, h * 0.66);
  c.clip();
  const at = (g.pitch * 180) / Math.PI;
  for (let d = -90; d <= 90; d += 5) {
    if (d === 0 || Math.abs(d - at) > 30) continue;
    const y = off - d * PITCH_PX;
    const half = d % 10 === 0 ? 42 : 20;
    c.fillStyle = "#ffffff";
    c.fillRect(-half, y - 1, half * 2, 2);
    if (d % 10 === 0) {
      text(c, String(Math.abs(d)), -half - 16, y, 15);
      text(c, String(Math.abs(d)), half + 16, y, 15);
    }
  }
  c.restore();
  c.restore();

  // THE ROLL SCALE over it, fixed, and its pointer turned with the bank.
  c.save();
  c.translate(cx, cy);
  const R = h * 0.36;
  c.strokeStyle = "#ffffff";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, R, deg(-150), deg(-30));
  c.stroke();
  for (const d of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
    const a = deg(d - 90);
    const len = Math.abs(d) % 30 === 0 ? 14 : 8;
    c.beginPath();
    c.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    c.lineTo(Math.cos(a) * (R + len), Math.sin(a) * (R + len));
    c.stroke();
  }
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.moveTo(0, -R - 1);
  c.lineTo(-8, -R - 13);
  c.lineTo(8, -R - 13);
  c.closePath();
  c.fill();
  c.rotate(-g.roll);
  c.fillStyle = YELLOW;
  c.beginPath();
  c.moveTo(0, -R + 1);
  c.lineTo(-9, -R + 14);
  c.lineTo(9, -R + 14);
  c.closePath();
  c.fill();
  // The slip's trapezoid under it, shoved by the ball.
  const s = clamp(g.slip, -1, 1) * 14;
  c.fillRect(-10 + s, -R + 17, 20, 5);
  c.restore();

  // THE AIRCRAFT SYMBOL: the two wings and the dot, yellow on black.
  c.save();
  c.translate(cx, cy);
  for (const side of [-1, 1]) {
    c.fillStyle = "#000";
    c.fillRect(side * 34 - (side > 0 ? 0 : 52), -4, 52, 8);
    c.fillStyle = YELLOW;
    c.fillRect(side * 36 - (side > 0 ? 0 : 48), -2.5, 48, 5);
    c.fillRect(side > 0 ? 36 : -38, -2.5, 2, 12);
  }
  c.fillStyle = "#000";
  c.fillRect(-5, -5, 10, 10);
  c.fillStyle = YELLOW;
  c.fillRect(-3.5, -3.5, 7, 7);
  c.restore();
}

/** A tape: its value boxed in the middle, the scale running past it. */
function tape(
  c: Ctx,
  x: number,
  top: number,
  w: number,
  h: number,
  value: number,
  pxPer: number,
  step: number,
  label: number,
  bands: { from: number; to: number; colour: string }[],
  right: boolean,
  digits: (v: number) => string,
): void {
  c.save();
  c.fillStyle = "rgba(20,24,30,0.62)";
  c.fillRect(x, top, w, h);
  c.beginPath();
  c.rect(x, top, w, h);
  c.clip();
  const mid = top + h / 2;
  const span = h / 2 / pxPer;
  const edge = right ? x : x + w;
  const dir = right ? 1 : -1;
  for (const b of bands) {
    const y0 = mid - (b.to - value) * pxPer;
    const y1 = mid - (b.from - value) * pxPer;
    c.fillStyle = b.colour;
    c.fillRect(right ? x : x + w - 6, y0, 6, y1 - y0);
  }
  const first = Math.floor((value - span) / step) * step;
  for (let v = first; v <= value + span; v += step) {
    if (v < 0) continue;
    const y = mid - (v - value) * pxPer;
    const major = Math.round(v / label) * label === Math.round(v);
    c.fillStyle = "#ffffff";
    c.fillRect(edge + (right ? 0 : -1) * (major ? 14 : 8), y - 1, major ? 14 : 8, 2);
    if (major) text(c, digits(v), edge + dir * (w * 0.55), y, 16, INK, "center");
  }
  c.restore();
  // The boxed readout.
  const bh = 34;
  c.fillStyle = "#000";
  c.strokeStyle = "#ffffff";
  c.lineWidth = 2;
  c.beginPath();
  if (right) {
    c.moveTo(x - 8, mid);
    c.lineTo(x + 4, mid - bh / 2);
    c.lineTo(x + w + 6, mid - bh / 2);
    c.lineTo(x + w + 6, mid + bh / 2);
    c.lineTo(x + 4, mid + bh / 2);
  } else {
    c.moveTo(x + w + 8, mid);
    c.lineTo(x + w - 4, mid - bh / 2);
    c.lineTo(x - 6, mid - bh / 2);
    c.lineTo(x - 6, mid + bh / 2);
    c.lineTo(x + w - 4, mid + bh / 2);
  }
  c.closePath();
  c.fill();
  c.stroke();
  text(c, digits(value), x + w / 2 + (right ? 2 : -2), mid + 1, 21, INK);
}

/** The heading arc along the foot: the rose's top third turned under a
 * fixed lubber line, its readout boxed over it. */
function headingArc(c: Ctx, heading: number, cx: number, cy: number, r: number): void {
  c.save();
  c.beginPath();
  c.arc(cx, cy, r + 4, Math.PI, 0);
  c.closePath();
  c.fillStyle = "rgba(14,18,24,0.78)";
  c.fill();
  c.translate(cx, cy);
  c.strokeStyle = "#ffffff";
  c.lineWidth = 2;
  for (let d = 0; d < 360; d += 5) {
    const a = deg(d - heading) - Math.PI / 2;
    if (Math.sin(a) > 0.15) continue;
    const major = d % 10 === 0;
    c.beginPath();
    c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    c.lineTo(Math.cos(a) * (r - (major ? 12 : 6)), Math.sin(a) * (r - (major ? 12 : 6)));
    c.stroke();
    if (d % 30 === 0) {
      const name =
        d === 0 ? "N" : d === 90 ? "E" : d === 180 ? "S" : d === 270 ? "W" : String(d / 10);
      text(c, name, Math.cos(a) * (r - 26), Math.sin(a) * (r - 26), 15);
    }
  }
  c.restore();
  c.fillStyle = "#000";
  c.strokeStyle = "#fff";
  c.lineWidth = 2;
  c.fillRect(cx - 28, cy - r - 30, 56, 26);
  c.strokeRect(cx - 28, cy - r - 30, 56, 26);
  text(c, `${String(Math.round(heading) % 360).padStart(3, "0")}°`, cx, cy - r - 16, 18);
  c.fillStyle = "#fff";
  c.beginPath();
  c.moveTo(cx, cy - r + 2);
  c.lineTo(cx - 6, cy - r - 4);
  c.lineTo(cx + 6, cy - r - 4);
  c.closePath();
  c.fill();
}

export function paintPfd(c: Ctx, g: PlaneGauges): void {
  const W = PFD_W;
  const H = PFD_H;
  if (!g.live) {
    dark(c, W, H);
    return;
  }
  attitude(c, g, W / 2, H * 0.44, W, H);
  // The airspeed: the white arc the flaps fly in, the green, the yellow
  // caution and the red line at never-exceed.
  tape(
    c,
    10,
    54,
    72,
    246,
    g.ias,
    3.2,
    5,
    10,
    [
      { from: 50, to: 100, colour: "#ffffff" },
      { from: 58, to: 125, colour: GREEN },
      { from: 125, to: 150, colour: AMBER },
      { from: 150, to: 220, colour: RED },
    ],
    false,
    (v) => String(Math.round(v)),
  );
  tape(c, W - 92, 54, 72, 246, g.alt, 0.32, 100, 500, [], true, (v) =>
    String(Math.round(v / 10) * 10),
  );
  // The climb beside the altitude: a needle off its middle, ±2000 ft/min.
  const vx = W - 14;
  const vm = 177;
  c.fillStyle = "rgba(20,24,30,0.62)";
  c.fillRect(vx - 6, 70, 18, 214);
  const vy = vm - clamp(g.vsi / 2000, -1, 1) * 100;
  c.strokeStyle = "#fff";
  c.lineWidth = 2;
  for (const k of [-1, -0.5, 0, 0.5, 1]) {
    c.beginPath();
    c.moveTo(vx - 6, vm - k * 100);
    c.lineTo(vx + 2, vm - k * 100);
    c.stroke();
  }
  c.strokeStyle = MAGENTA;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(vx + 12, vm);
  c.lineTo(vx - 2, vy);
  c.stroke();
  text(c, `${g.vsi >= 0 ? "+" : ""}${Math.round(g.vsi / 10) * 10}`, W - 56, 316, 14, CYAN);
  // Along the top: the true airspeed, the flaps and the outside air.
  c.fillStyle = "rgba(0,0,0,0.55)";
  c.fillRect(0, 0, W, 30);
  text(c, `TAS ${Math.round(g.tas)}KT`, 8, 15, 15, INK, "left");
  text(c, `FLAPS ${Math.round(g.flaps * 40)}°`, W / 2, 15, 15, g.flaps > 0.01 ? CYAN : DIM);
  text(c, `OAT ${Math.round(g.oat)}°C`, W - 8, 15, 15, INK, "right");
  if (g.load > 2.2 || g.load < -0.5) text(c, `${g.load.toFixed(1)}G`, 110, 48, 17, AMBER, "left");
  headingArc(c, g.heading, W / 2, H + 86, 150);
  text(c, "1013", W - 56, H - 50, 15, CYAN);
  if (g.stall) {
    c.fillStyle = RED;
    c.fillRect(W / 2 - 64, H * 0.6, 128, 34);
    text(c, "STALL", W / 2, H * 0.6 + 18, 24, "#fff");
  }
}

// ── THE MULTI-FUNCTION DISPLAY ─────────────────────────────────────────

/** A round engine dial: its arc from 210° to −30°, the bands, the needle
 * and its readout under it. */
function engineDial(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  name: string,
  value: number,
  most: number,
  bands: { from: number; to: number; colour: string }[],
  shown: string,
): void {
  const a0 = deg(150);
  const span = deg(240);
  const at = (v: number) => a0 + clamp(v / most, 0, 1.05) * span;
  c.lineWidth = 6;
  for (const b of bands) {
    c.strokeStyle = b.colour;
    c.beginPath();
    c.arc(x, y, r, at(b.from), at(b.to));
    c.stroke();
  }
  c.strokeStyle = "#fff";
  c.lineWidth = 3;
  c.beginPath();
  const a = at(value);
  c.moveTo(x, y);
  c.lineTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2));
  c.stroke();
  text(c, name, x, y - r * 0.32, 12, DIM);
  c.fillStyle = "#000";
  c.fillRect(x - 30, y + r * 0.25, 60, 22);
  c.strokeStyle = "#555";
  c.lineWidth = 1;
  c.strokeRect(x - 30, y + r * 0.25, 60, 22);
  text(c, shown, x, y + r * 0.25 + 11, 16, value > most * 0.97 ? RED : GREEN);
}

/** A row of the engine page: a name, a bar and its value. */
function bar(c: Ctx, y: number, name: string, share: number, shown: string, colour = GREEN): void {
  text(c, name, 8, y, 13, DIM, "left");
  c.fillStyle = "#1a1d22";
  c.fillRect(58, y - 5, 62, 10);
  c.fillStyle = colour;
  c.fillRect(58, y - 5, 62 * clamp(share, 0, 1), 10);
  text(c, shown, 164, y, 13, INK, "right");
}

/** The terrain round the plane, heading up, painted by how far the snow
 * stands under it: `ground(f, r)` the snow `f` m ahead and `r` m to the
 * right as seen, `alt` the plane's height, m. */
function terrain(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  ground: (f: number, r: number) => number,
  alt: number,
  heading: number,
): void {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = "#000";
  c.fillRect(x, y, w, h);
  const N = 36;
  const range = 2500;
  const cx = x + w / 2;
  const cy = y + h * 0.78;
  const per = (h * 0.72) / range;
  const cell = (range * 2) / N;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const r = -range + (i + 0.5) * cell;
      const f = -range * 0.35 + (j + 0.5) * cell;
      const below = alt - ground(f, r);
      // The terrain display's dot fill, in its dim shades: red over the
      // plane, amber within a hundred feet under it, greens lower.
      if (below > 450) continue;
      c.fillStyle =
        below < 0 ? "#a3271b" : below < 30 ? "#a87a12" : below < 150 ? "#1f6a2b" : "#0f3417";
      const s = cell * per;
      const d = Math.max(1.5, s * 0.6);
      c.fillRect(
        cx + (r - cell / 2) * per + (s - d) / 2,
        cy - (f + cell / 2) * per + (s - d) / 2,
        d,
        d,
      );
    }
  }
  // The range rings, the plane's symbol and the heading over it.
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.lineWidth = 1.5;
  for (const k of [0.5, 1]) {
    c.beginPath();
    c.arc(cx, cy, range * k * per * 0.72, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
  }
  text(c, "1.3", cx + range * 0.36 * per * 0.72 + 4, cy - range * 0.24 * per, 12, INK, "left");
  c.fillStyle = "#fff";
  c.beginPath();
  c.moveTo(cx, cy - 12);
  c.lineTo(cx - 9, cy + 9);
  c.lineTo(cx, cy + 4);
  c.lineTo(cx + 9, cy + 9);
  c.closePath();
  c.fill();
  c.restore();
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(x, y, w, 24);
  text(
    c,
    `TRK ${String(Math.round(heading) % 360).padStart(3, "0")}°`,
    x + w / 2,
    y + 12,
    15,
    MAGENTA,
  );
  text(c, "TERRAIN", x + 6, y + h - 12, 12, AMBER, "left");
}

export function paintMfd(
  c: Ctx,
  g: PlaneGauges,
  ground: (f: number, r: number) => number,
  alt: number,
): void {
  const W = MFD_W;
  const H = MFD_H;
  if (!g.live) {
    dark(c, W, H);
    return;
  }
  c.fillStyle = "#07090b";
  c.fillRect(0, 0, W, H);
  // THE ENGINE'S PAGE down the left.
  c.fillStyle = "#0d1014";
  c.fillRect(0, 0, 172, H);
  engineDial(
    c,
    86,
    62,
    44,
    "TRQ %",
    g.torque,
    110,
    [
      { from: 0, to: 100, colour: GREEN },
      { from: 100, to: 110, colour: RED },
    ],
    String(Math.round(g.torque)),
  );
  engineDial(
    c,
    86,
    158,
    44,
    "ITT °C",
    g.itt,
    900,
    [
      { from: 400, to: 750, colour: GREEN },
      { from: 750, to: 765, colour: AMBER },
      { from: 765, to: 900, colour: RED },
    ],
    String(Math.round(g.itt)),
  );
  bar(c, 222, "NG %", (g.ng - 50) / 54, g.ng.toFixed(1));
  bar(c, 242, "PROP", g.rpm / 2300, String(Math.round(g.rpm)));
  bar(c, 262, "FF", g.flow / 220, `${Math.round(g.flow)}`);
  bar(c, 282, "OIL P", g.oilP / 130, String(Math.round(g.oilP)));
  bar(c, 302, "OIL T", g.oilT / 110, String(Math.round(g.oilT)));
  bar(c, 322, "FUEL", g.fuel / 515, `${Math.round(g.fuel)}KG`, g.fuel < 60 ? AMBER : GREEN);
  // The flaps and the trim.
  text(c, "FLAP", 8, 346, 13, DIM, "left");
  c.fillStyle = "#1a1d22";
  c.fillRect(58, 341, 62, 10);
  c.fillStyle = CYAN;
  c.fillRect(58 + 58 * clamp(g.flaps, 0, 1), 338, 4, 16);
  text(c, `${Math.round(g.flaps * 40)}°`, 164, 346, 13, INK, "right");
  text(c, "TRIM", 8, 366, 13, DIM, "left");
  c.fillStyle = "#1a1d22";
  c.fillRect(58, 361, 62, 10);
  c.fillStyle = INK;
  c.fillRect(87 + 29 * clamp(g.trim, -1, 1), 358, 4, 16);
  text(c, g.trim > 0.05 ? "DN" : g.trim < -0.05 ? "UP" : "TO", 164, 366, 13, INK, "right");
  terrain(c, 176, 0, W - 176, H, ground, alt, g.heading);
}

// ── THE STANDBYS ───────────────────────────────────────────────────────

function standbyFace(c: Ctx, x: number, y: number, r: number): void {
  c.fillStyle = "#16181b";
  c.beginPath();
  c.arc(x, y, r + 7, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#050506";
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function dialNeedle(c: Ctx, x: number, y: number, a: number, len: number): void {
  c.strokeStyle = "#f2f2ee";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(x - Math.cos(a) * 10, y - Math.sin(a) * 10);
  c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  c.stroke();
  c.fillStyle = "#333";
  c.beginPath();
  c.arc(x, y, 6, 0, Math.PI * 2);
  c.fill();
}

export function paintStandby(c: Ctx, g: PlaneGauges): void {
  const W = STANDBY_W;
  c.fillStyle = "#2b2e33";
  c.fillRect(0, 0, W, STANDBY_H);
  const r = 64;
  const x = W / 2;
  // The airspeed, its arcs and its needle.
  let y = 86;
  standbyFace(c, x, y, r);
  const asi = (kt: number) => deg(-90 + clamp(kt, 0, 180) * 1.8);
  c.lineWidth = 6;
  for (const [a, b, col] of [
    [58, 125, GREEN],
    [125, 150, AMBER],
  ] as const) {
    c.strokeStyle = col;
    c.beginPath();
    c.arc(x, y, r - 6, asi(a), asi(b));
    c.stroke();
  }
  for (let kt = 0; kt <= 180; kt += 20) {
    const a = asi(kt);
    text(c, String(kt), x + Math.cos(a) * (r - 22), y + Math.sin(a) * (r - 22), 13);
  }
  dialNeedle(c, x, y, asi(g.ias), r - 10);
  // The standby attitude.
  y = 256;
  standbyFace(c, x, y, r);
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.clip();
  c.translate(x, y);
  c.rotate(-g.roll);
  const off = clamp(((g.pitch * 180) / Math.PI) * 2.2, -r, r);
  c.fillStyle = "#3d7fd3";
  c.fillRect(-r * 2, off - r * 3, r * 4, r * 3);
  c.fillStyle = "#6a4119";
  c.fillRect(-r * 2, off, r * 4, r * 3);
  c.fillStyle = "#fff";
  c.fillRect(-r * 2, off - 1.5, r * 4, 3);
  for (const d of [-20, -10, 10, 20]) c.fillRect(-14, off - d * 2.2, 28, 2);
  c.restore();
  c.fillStyle = AMBER;
  c.fillRect(x - 34, y - 2, 24, 5);
  c.fillRect(x + 10, y - 2, 24, 5);
  c.fillRect(x - 3, y - 3, 6, 6);
  // The altimeter: the hundreds' needle, the thousands in a window.
  y = 426;
  standbyFace(c, x, y, r);
  for (let k = 0; k < 10; k++) {
    const a = deg(k * 36 - 90);
    text(c, String(k), x + Math.cos(a) * (r - 16), y + Math.sin(a) * (r - 16), 14);
  }
  c.fillStyle = "#000";
  c.fillRect(x - 26, y + 14, 52, 22);
  text(c, String(Math.floor(Math.max(0, g.alt) / 1000)).padStart(2, "0"), x, y + 26, 16);
  dialNeedle(c, x, y, deg(((g.alt % 1000) / 1000) * 360 - 90), r - 12);
}

// ── THE ANNUNCIATORS ───────────────────────────────────────────────────

/** The lights, their words and when each is lit. */
const LIGHTS: { word: string; colour: string; lit: (g: PlaneGauges) => boolean }[] = [
  { word: "STALL", colour: RED, lit: (g) => g.stall },
  { word: "DOOR", colour: AMBER, lit: (g) => g.door },
  { word: "GEN", colour: AMBER, lit: (g) => g.gen },
  { word: "OIL", colour: RED, lit: (g) => !g.live },
  { word: "FUEL LO", colour: AMBER, lit: (g) => g.fuel < 60 },
  { word: "BRAKE", colour: AMBER, lit: (g) => g.brake },
  { word: "FLAPS", colour: GREEN, lit: (g) => g.flaps > 0.02 },
  { word: "G", colour: AMBER, lit: (g) => g.load > 3.4 || g.load < -1 },
];

export function paintLights(c: Ctx, g: PlaneGauges): void {
  c.fillStyle = "#111214";
  c.fillRect(0, 0, LIGHTS_W, LIGHTS_H);
  const n = LIGHTS.length;
  const w = LIGHTS_W / n;
  LIGHTS.forEach((l, i) => {
    const x = i * w + 4;
    const on = l.lit(g);
    c.fillStyle = on ? l.colour : "#1e2023";
    c.fillRect(x, 8, w - 8, LIGHTS_H - 16);
    text(c, l.word, x + (w - 8) / 2, LIGHTS_H / 2, 22, on ? "#111" : "#4a4d52");
  });
}
