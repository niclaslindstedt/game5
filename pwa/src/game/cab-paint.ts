// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARRIER'S DASHBOARD FACES, PAINTED IN CODE (`carrier-cab.ts` lays
// them on the dash) — canvas only, three-free.
//
// THE CLUSTER in front of the wheel is a military diesel's: the
// speedometer (km/h, its odometer under the hub) and the tachometer (rpm,
// red past 3,600) side by side, the coolant's temperature and the oil's
// pressure outboard on the left, the fuel and the battery's volts (a 24 V
// system) on the right, a row of warning lamps along the foot — the
// charge, the oil, the coolant, the glow plugs, the parking brake, the
// beam, the indicators, the gearbox in reverse. THE SWITCH PANEL in the
// middle carries the lights' rotary switch with its blackout settings,
// the toggles for the wipers, the washer, the heater's fan, the work lamp
// and the convoy light, the glow plugs' and the starter's buttons and the
// key. THE RADIO on the mate's side is a vehicle set: its channel window,
// its knobs, its preset keys and its handset hook. Every face is BACK
// (drawn once) and the cluster LIVE over it (the needles, the lamps).

import { type CabGauges } from "./army-cab-plan.ts";
import {
  AMBER,
  band,
  bezel,
  deg,
  GREEN,
  hub,
  INK,
  keys,
  knob,
  label,
  needle,
  numbers,
  RED,
  ticks,
  window7,
  type Ctx,
} from "./dial-paint.ts";

/** px a metre on the dash's faces. */
const PX = 1600;

/** THE CLUSTER'S CANVAS, px, for a face `w` × `h` m. */
export const clusterSize = (w: number, h: number): [number, number] => [
  Math.round(w * PX),
  Math.round(h * PX),
];

/** Where each dial sits on the cluster, as shares of its width and
 * height, and its diameter as a share of the height. */
const DIALS = {
  speed: { x: 0.36, y: 0.44, d: 0.74 },
  tach: { x: 0.64, y: 0.44, d: 0.74 },
  coolant: { x: 0.1, y: 0.27, d: 0.34 },
  oil: { x: 0.1, y: 0.66, d: 0.34 },
  fuel: { x: 0.9, y: 0.27, d: 0.34 },
  volts: { x: 0.9, y: 0.66, d: 0.34 },
} as const;

/** The lamps along the cluster's foot: a word and its colour. */
const LAMPS = [
  ["CHG", RED],
  ["OIL", RED],
  ["TEMP", RED],
  ["GLOW", AMBER],
  ["P", RED],
  ["BEAM", "#3a7bff"],
  ["◀ ▶", GREEN],
  ["R", AMBER],
] as const;

const at = (c: Ctx, k: { x: number; y: number; d: number }): [number, number, number] => [
  k.x * c.canvas.width,
  k.y * c.canvas.height,
  (k.d * c.canvas.height) / 2,
];

/** Each gauge's angle, deg from the top, over its sweep. */
const speedAngle = (kmh: number) => -135 + Math.min(80, Math.max(0, kmh)) * (270 / 80);
const tachAngle = (rpm: number) => -135 + Math.min(4000, Math.max(0, rpm)) * (270 / 4000);
const smallAngle = (share: number) => -60 + Math.min(1, Math.max(0, share)) * 120;

/** A housing's matte black moulding with a faint grain. */
function moulding(c: Ctx, base = "#17181a"): void {
  const { width: w, height: h } = c.canvas;
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0.25)");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,255,255,0.025)";
  for (let i = 0; i < 900; i++) {
    const x = (i * 97.13) % w;
    const y = (i * 53.71) % h;
    c.fillRect(x, y, 2, 1);
  }
}

/** THE CLUSTER'S BACK: the housing, the bezels, every scale and word. */
export function paintClusterBack(c: Ctx): void {
  moulding(c);
  const { width: w, height: h } = c.canvas;
  // The hood's lip over the dials.
  c.fillStyle = "#0d0e0f";
  c.fillRect(0, 0, w, h * 0.05);
  // THE SPEEDOMETER: 0..80 km/h.
  {
    const [x, y, r] = at(c, DIALS.speed);
    bezel(c, x, y, r);
    ticks(c, x, y, r, -135, 135, 16, 2);
    numbers(c, x, y, r, -135, 135, ["0", "10", "20", "30", "40", "50", "60", "70", "80"], 0.16);
    label(c, x, y + r * 0.32, r * 0.12, "km/h");
    // The odometer's window.
    window7(c, x - r * 0.3, y + r * 0.46, r * 0.6, r * 0.16, "", false);
    c.fillStyle = "#d8dbd2";
    c.font = `bold ${Math.round(r * 0.13)}px monospace`;
    c.textAlign = "center";
    c.fillText("0 4 2 7 1 8", x, y + r * 0.55);
  }
  // THE TACHOMETER: 0..4,000 rpm, the red from 3,600.
  {
    const [x, y, r] = at(c, DIALS.tach);
    bezel(c, x, y, r);
    band(c, x, y, r, tachAngle(3600), tachAngle(4000), RED);
    band(c, x, y, r, tachAngle(1400), tachAngle(2800), GREEN);
    ticks(c, x, y, r, -135, 135, 20, 5);
    numbers(c, x, y, r, -135, 135, ["0", "10", "20", "30", "40"], 0.18);
    label(c, x, y + r * 0.32, r * 0.12, "×100 r/min");
    label(c, x, y + r * 0.55, r * 0.1, "DIESEL", "#9aa09a");
  }
  const small = (k: { x: number; y: number; d: number }, lo: string, hi: string, word: string) => {
    const [x, y, r] = at(c, k);
    bezel(c, x, y, r);
    ticks(c, x, y, r, -60, 60, 4, 2);
    label(c, x - r * 0.62, y - r * 0.18, r * 0.24, lo);
    label(c, x + r * 0.62, y - r * 0.18, r * 0.24, hi);
    label(c, x, y + r * 0.45, r * 0.24, word);
    return [x, y, r] as const;
  };
  {
    const [x, y, r] = small(DIALS.coolant, "40", "120", "°C");
    band(c, x, y, r, smallAngle(0.85), 60, RED);
  }
  {
    const [x, y, r] = small(DIALS.oil, "0", "6", "bar");
    band(c, x, y, r, -60, smallAngle(0.12), RED);
  }
  {
    const [x, y, r] = small(DIALS.fuel, "0", "1", "FUEL");
    band(c, x, y, r, -60, smallAngle(0.12), AMBER);
    label(c, x, y - r * 0.1, r * 0.2, "½");
  }
  {
    const [x, y, r] = small(DIALS.volts, "18", "32", "V");
    band(c, x, y, r, smallAngle(0.57), smallAngle(0.79), GREEN);
  }
  paintLamps(c, false);
}

/** THE LAMPS along the foot: dark, or those `lit` glowing. */
function paintLamps(c: Ctx, live: boolean, lit: readonly boolean[] = []): void {
  const { width: w, height: h } = c.canvas;
  const y = h * 0.9;
  const r = h * 0.045;
  const x0 = w * 0.22;
  const dx = (w * 0.56) / (LAMPS.length - 1);
  LAMPS.forEach(([word, colour], i) => {
    const x = x0 + dx * i;
    const on = live && lit[i];
    c.fillStyle = on ? colour : "#222426";
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    if (on) {
      const g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
      g.addColorStop(0, `${colour}`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.globalAlpha = 0.35;
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r * 2.4, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    c.fillStyle = on ? "#101010" : "#5c605c";
    c.font = `bold ${Math.round(r * (word.length > 2 ? 0.62 : 0.9))}px sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(word, x, y + 1);
  });
}

/** THE CLUSTER LIVE over its back: the needles and the lamps. */
export function paintClusterLive(c: Ctx, back: CanvasImageSource, g: CabGauges): void {
  c.drawImage(back, 0, 0);
  const pin = (k: { x: number; y: number; d: number }, a: number, len: number, w?: number) => {
    const [x, y, r] = at(c, k);
    needle(c, x, y, r, a, len, w);
    hub(c, x, y, r);
  };
  pin(DIALS.speed, speedAngle(g.kmh), 0.82);
  pin(DIALS.tach, tachAngle(g.rpm), 0.82);
  pin(DIALS.coolant, smallAngle((g.coolant - 40) / 80), 0.78, 0.09);
  pin(DIALS.oil, smallAngle(g.oil / 6), 0.78, 0.09);
  pin(DIALS.fuel, smallAngle(g.fuel), 0.78, 0.09);
  pin(DIALS.volts, smallAngle((g.volts - 18) / 14), 0.78, 0.09);
  paintLamps(c, true, [
    g.dead,
    g.dead || g.oil < 0.8,
    g.coolant > 104,
    false,
    g.park,
    false,
    false,
    g.reverse,
  ]);
}

/** THE SWITCH PANEL's face: the lights' rotary, the toggles, the buttons,
 * the key — where `TOGGLES` stand the toggles' levers are built in 3D. */
export function paintSwitches(c: Ctx): void {
  moulding(c, "#1d1f1c");
  const { width: w, height: h } = c.canvas;
  // The plate's screws.
  c.fillStyle = "#3a3d38";
  for (const [x, y] of [
    [0.03, 0.06],
    [0.97, 0.06],
    [0.03, 0.94],
    [0.97, 0.94],
  ]) {
    c.beginPath();
    c.arc(x * w, y * h, h * 0.025, 0, Math.PI * 2);
    c.fill();
  }
  // THE LIGHTS' ROTARY with its settings round it.
  const rx = w * 0.17;
  const ry = h * 0.36;
  const rr = h * 0.16;
  c.fillStyle = "#0b0c0c";
  c.beginPath();
  c.arc(rx, ry, rr * 1.25, 0, Math.PI * 2);
  c.fill();
  knob(c, rx, ry, rr);
  c.strokeStyle = INK;
  c.lineWidth = rr * 0.18;
  c.beginPath();
  c.moveTo(rx, ry);
  c.lineTo(rx + Math.sin(deg(-40)) * rr * 0.9, ry - Math.cos(deg(-40)) * rr * 0.9);
  c.stroke();
  const settings = ["OFF", "B.O.", "B.O. DR", "PARK", "HEAD"];
  settings.forEach((word, i) => {
    const a = deg(-80 + i * 40);
    label(c, rx + Math.sin(a) * rr * 1.75, ry - Math.cos(a) * rr * 1.75, h * 0.045, word);
  });
  label(c, rx, ry + rr * 1.85, h * 0.05, "LIGHTS", AMBER);
  // THE TOGGLES' plates and their words.
  for (const t of TOGGLES) {
    const x = t.x * w;
    const y = t.y * h;
    c.fillStyle = "#0b0c0c";
    c.fillRect(x - h * 0.045, y - h * 0.08, h * 0.09, h * 0.16);
    c.fillStyle = "#4b4e49";
    c.beginPath();
    c.arc(x, y, h * 0.035, 0, Math.PI * 2);
    c.fill();
    label(c, x, y - h * 0.13, h * 0.042, t.word);
    label(c, x, y + h * 0.13, h * 0.034, "ON ▲", "#9aa09a");
  }
  // THE BUTTONS: the glow plugs and the starter, the key between them.
  const button = (x: number, y: number, colour: string, word: string) => {
    c.fillStyle = "#0b0c0c";
    c.beginPath();
    c.arc(x * w, y * h, h * 0.07, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = colour;
    c.beginPath();
    c.arc(x * w, y * h, h * 0.05, 0, Math.PI * 2);
    c.fill();
    label(c, x * w, (y + 0.13) * h, h * 0.042, word);
  };
  button(0.62, 0.74, "#c8a018", "GLOW");
  button(0.9, 0.74, "#2a2c2a", "START");
  knob(c, 0.76 * w, 0.74 * h, h * 0.07);
  c.fillStyle = "#c9ccc4";
  c.fillRect(0.76 * w - h * 0.012, 0.74 * h - h * 0.05, h * 0.024, h * 0.1);
  label(c, 0.76 * w, 0.87 * h, h * 0.042, "OFF  RUN");
  label(c, 0.17 * w, 0.92 * h, h * 0.036, "BLACKOUT DRIVE — CONVOY ONLY", "#8a8f88");
}

/** The toggles on the switch panel, as shares of its width and height:
 * where each lever stands and its word. */
export const TOGGLES = [
  { x: 0.42, y: 0.3, word: "WIPER" },
  { x: 0.53, y: 0.3, word: "WASH" },
  { x: 0.64, y: 0.3, word: "FAN" },
  { x: 0.75, y: 0.3, word: "WORK" },
  { x: 0.86, y: 0.3, word: "CONVOY" },
] as const;

/** THE RADIO's face: the channel's window, the knobs, the preset keys. */
export function paintRadio(c: Ctx, live: boolean): void {
  moulding(c, "#262a22");
  const { width: w, height: h } = c.canvas;
  c.strokeStyle = "#11130f";
  c.lineWidth = h * 0.03;
  c.strokeRect(h * 0.03, h * 0.03, w - h * 0.06, h - h * 0.06);
  window7(c, w * 0.3, h * 0.12, w * 0.4, h * 0.24, "CH 07  46.750", live);
  for (const [x, word] of [
    [0.12, "VOL"],
    [0.88, "SQL"],
  ] as const) {
    knob(c, w * x, h * 0.32, h * 0.15);
    label(c, w * x, h * 0.56, h * 0.08, word);
  }
  keys(c, w * 0.25, h * 0.48, w * 0.5, h * 0.16, ["1", "2", "3", "4", "5", "6"]);
  keys(c, w * 0.25, h * 0.7, w * 0.5, h * 0.14, ["PRE", "MAN", "SCAN", "CLR"]);
  label(c, w * 0.12, h * 0.82, h * 0.07, "PWR");
  label(c, w * 0.88, h * 0.82, h * 0.07, "HI·LO");
}
