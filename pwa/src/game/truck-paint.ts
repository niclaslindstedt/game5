// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARGO TRUCK'S DASHBOARD FACES, PAINTED IN CODE (`truck-cab.ts` lays
// them on the dash) — canvas only, three-free.
//
// THE CLUSTER in front of the wheel is a heavy diesel truck's on air
// brakes: the speedometer (0–100 km/h, its odometer under the hub) and the
// tachometer (rpm, its economy band green and the red past 2,600) side by
// side; outboard on the left the DUAL AIR GAUGE, one needle a brake
// circuit (the red line below which the spring brakes come on) over the
// coolant; on the right the fuel over the battery's volts (24 V); a row of
// warning lamps along the foot — the charge, the oil, the coolant, the air
// low, the parking brake, the differential locks, the indicators, the beam,
// the low range. THE MIDDLE PANEL carries the CENTRAL TYRE INFLATION: its
// four settings as lit keys (the road, cross-country, snow and sand, and
// the one to get out of being stuck), the tyres' pressure in a window and
// the deflating and inflating lamps; under it the differential locks'
// switches (across each axle, and between them) with their lamps, the
// lights' rotary with the blackout settings, the hazard key and the
// convoy light. Every face is BACK (drawn once) and LIVE over it.

import { moulding, lampRow, type Lamps } from "./cab-paint.ts";
import {
  AMBER,
  band,
  bezel,
  GREEN,
  hub,
  INK,
  knob,
  label,
  needle,
  numbers,
  RED,
  ticks,
  window7,
  type Ctx,
} from "./dial-paint.ts";
import type { TruckGauges, TyreSetting } from "./truck-cab-plan.ts";

/** Where each dial sits on the cluster, as shares of its width and height,
 * and its diameter as a share of the height. */
const DIALS = {
  speed: { x: 0.37, y: 0.44, d: 0.74 },
  tach: { x: 0.63, y: 0.44, d: 0.74 },
  air: { x: 0.11, y: 0.3, d: 0.42 },
  coolant: { x: 0.11, y: 0.72, d: 0.3 },
  fuel: { x: 0.89, y: 0.3, d: 0.36 },
  volts: { x: 0.89, y: 0.72, d: 0.3 },
} as const;

const LAMPS: Lamps = [
  ["CHG", RED],
  ["OIL", RED],
  ["TEMP", RED],
  ["AIR", RED],
  ["P", RED],
  ["DIFF", AMBER],
  ["◀ ▶", GREEN],
  ["BEAM", "#3a7bff"],
  ["LOW", AMBER],
];

const at = (c: Ctx, k: { x: number; y: number; d: number }): [number, number, number] => [
  k.x * c.canvas.width,
  k.y * c.canvas.height,
  (k.d * c.canvas.height) / 2,
];

const speedAngle = (kmh: number) => -135 + Math.min(100, Math.max(0, kmh)) * (270 / 100);
const tachAngle = (rpm: number) => -135 + Math.min(3000, Math.max(0, rpm)) * (270 / 3000);
/** The air gauge's needles: 0..10 bar over 240°. */
const airAngle = (bar: number) => -120 + Math.min(10, Math.max(0, bar)) * 24;
const smallAngle = (share: number) => -60 + Math.min(1, Math.max(0, share)) * 120;

/** THE CLUSTER'S BACK: the housing, the bezels, every scale and word. */
export function paintTruckClusterBack(c: Ctx): void {
  moulding(c);
  const { width: w, height: h } = c.canvas;
  c.fillStyle = "#0d0e0f";
  c.fillRect(0, 0, w, h * 0.05);
  {
    const [x, y, r] = at(c, DIALS.speed);
    bezel(c, x, y, r);
    ticks(c, x, y, r, -135, 135, 20, 2);
    numbers(c, x, y, r, -135, 135, ["0", "20", "40", "60", "80", "100"], 0.17);
    label(c, x, y + r * 0.32, r * 0.12, "km/h");
    window7(c, x - r * 0.21, y + r * 0.47, r * 0.42, r * 0.14, "", false);
    c.fillStyle = "#d8dbd2";
    c.font = `bold ${Math.round(r * 0.11)}px monospace`;
    c.textAlign = "center";
    c.fillText("118306", x, y + r * 0.555);
  }
  {
    const [x, y, r] = at(c, DIALS.tach);
    bezel(c, x, y, r);
    band(c, x, y, r, tachAngle(1100), tachAngle(1800), GREEN);
    band(c, x, y, r, tachAngle(2600), tachAngle(3000), RED);
    ticks(c, x, y, r, -135, 135, 30, 5);
    numbers(c, x, y, r, -135, 135, ["0", "5", "10", "15", "20", "25", "30"], 0.15);
    label(c, x, y + r * 0.32, r * 0.12, "×100 r/min");
    label(c, x, y + r * 0.55, r * 0.1, "DIESEL", "#9aa09a");
  }
  {
    // THE DUAL AIR GAUGE: 0..10 bar, the red below 5.5 (the spring brakes).
    const [x, y, r] = at(c, DIALS.air);
    bezel(c, x, y, r);
    band(c, x, y, r, airAngle(0), airAngle(5.5), RED);
    ticks(c, x, y, r, -120, 120, 10, 2);
    numbers(c, x, y, r, -120, 120, ["0", "2", "4", "6", "8", "10"], 0.2);
    label(c, x, y + r * 0.42, r * 0.17, "bar  1 · 2");
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
    const [x, y, r] = small(DIALS.fuel, "0", "1", "FUEL");
    band(c, x, y, r, -60, smallAngle(0.12), AMBER);
    label(c, x, y - r * 0.1, r * 0.2, "½");
  }
  {
    const [x, y, r] = small(DIALS.volts, "18", "32", "V");
    band(c, x, y, r, smallAngle(0.57), smallAngle(0.79), GREEN);
  }
  lampRow(c, LAMPS, false, [], 0.9, 0.2, 0.8);
}

/** THE CLUSTER LIVE over its back: the needles and the lamps. */
export function paintTruckClusterLive(c: Ctx, back: CanvasImageSource, g: TruckGauges): void {
  c.drawImage(back, 0, 0);
  const pin = (
    k: { x: number; y: number; d: number },
    a: number,
    len: number,
    w?: number,
    colour?: string,
  ) => {
    const [x, y, r] = at(c, k);
    if (colour) needleIn(c, x, y, r, a, len, w ?? 0.06, colour);
    else needle(c, x, y, r, a, len, w);
    hub(c, x, y, r);
  };
  pin(DIALS.speed, speedAngle(g.kmh), 0.82);
  // The truck's engine turns slower than the carrier's: its rpm on its own scale.
  pin(DIALS.tach, tachAngle(g.rpm * 0.7), 0.82);
  pin(DIALS.air, airAngle(g.air[0]), 0.8, 0.07);
  pin(DIALS.air, airAngle(g.air[1]), 0.68, 0.07, RED);
  pin(DIALS.coolant, smallAngle((g.coolant - 40) / 80), 0.78, 0.09);
  pin(DIALS.fuel, smallAngle(g.fuel), 0.78, 0.09);
  pin(DIALS.volts, smallAngle((g.volts - 18) / 14), 0.78, 0.09);
  lampRow(
    c,
    LAMPS,
    true,
    [
      g.dead,
      g.dead || g.oil < 0.8,
      g.coolant > 104,
      g.air[1] < 5.5,
      g.park,
      g.locks,
      false,
      false,
      true,
    ],
    0.9,
    0.2,
    0.8,
  );
}

/** A needle in `colour`. */
function needleIn(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  a: number,
  len: number,
  w: number,
  colour: string,
) {
  const s = Math.sin((a * Math.PI) / 180);
  const k = -Math.cos((a * Math.PI) / 180);
  c.fillStyle = colour;
  c.beginPath();
  c.moveTo(x + s * r * len, y + k * r * len);
  c.lineTo(x - k * r * w, y + s * r * w);
  c.lineTo(x - s * r * 0.18, y - k * r * 0.18);
  c.lineTo(x + k * r * w, y - s * r * w);
  c.closePath();
  c.fill();
}

/** The central inflation's keys, left to right, and the word on each. */
const SETTINGS: readonly [TyreSetting, string][] = [
  ["road", "ROAD"],
  ["cross", "X-CTRY"],
  ["snow", "SNOW"],
  ["stuck", "STUCK"],
];

/** The differential locks' switches, as shares of the panel. */
export const LOCK_SWITCHES = [
  { x: 0.16, y: 0.74, word: "INTER" },
  { x: 0.32, y: 0.74, word: "FRONT" },
  { x: 0.48, y: 0.74, word: "REAR" },
] as const;

/** A wheel's tyre drawn small, its pressure shown by its flat. */
function tyre(c: Ctx, x: number, y: number, r: number, flat: number, on: boolean): void {
  c.strokeStyle = on ? AMBER : "#5c605c";
  c.lineWidth = r * 0.28;
  c.beginPath();
  c.ellipse(x, y + r * flat * 0.25, r, r * (1 - flat * 0.25), 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = on ? AMBER : "#5c605c";
  c.fillRect(x - r * 1.25, y + r * (1 - flat * 0.1), r * 2.5, r * 0.18);
}

/** THE MIDDLE PANEL: the tyre inflation, the locks, the lights. `g`
 * null paints it dark (the back), else live. */
export function paintTruckMiddle(c: Ctx, g: TruckGauges | null): void {
  moulding(c, "#1d1f1c");
  const { width: w, height: h } = c.canvas;
  // The plate's screws.
  c.fillStyle = "#3a3d38";
  for (const [x, y] of [
    [0.03, 0.05],
    [0.97, 0.05],
    [0.03, 0.95],
    [0.97, 0.95],
  ]) {
    c.beginPath();
    c.arc(x * w, y * h, h * 0.02, 0, Math.PI * 2);
    c.fill();
  }
  // THE TYRE INFLATION's bezel, its word and its keys.
  c.fillStyle = "#0b0c0c";
  c.fillRect(w * 0.05, h * 0.06, w * 0.9, h * 0.44);
  label(c, w * 0.5, h * 0.11, h * 0.05, "CENTRAL TYRE INFLATION", AMBER);
  const kw = (w * 0.86) / SETTINGS.length;
  SETTINGS.forEach(([key, word], i) => {
    const x = w * 0.07 + i * kw;
    const on = !!g && g.setting === key;
    c.fillStyle = on ? "#3a3014" : "#25272a";
    c.fillRect(x + 4, h * 0.17, kw - 8, h * 0.16);
    tyre(c, x + kw / 2, h * 0.235, h * 0.035, i / 3, on);
    label(c, x + kw / 2, h * 0.3, h * 0.035, word, on ? AMBER : "#aeb2ab");
  });
  window7(c, w * 0.3, h * 0.36, w * 0.4, h * 0.1, g ? `${g.tyres.toFixed(1)} bar` : "", !!g);
  for (const [x, word, on] of [
    [0.16, "DEFL", false],
    [0.84, "INFL", false],
  ] as const) {
    c.fillStyle = on ? AMBER : "#2a2c2a";
    c.beginPath();
    c.arc(w * x, h * 0.41, h * 0.025, 0, Math.PI * 2);
    c.fill();
    label(c, w * x, h * 0.465, h * 0.03, word, "#9aa09a");
  }
  // THE DIFFERENTIAL LOCKS: their plates, words and lamps (the levers are
  // built in 3D where `LOCK_SWITCHES` stand).
  label(c, w * 0.32, h * 0.56, h * 0.04, "DIFF LOCK", INK);
  for (const t of LOCK_SWITCHES) {
    const x = t.x * w;
    const y = t.y * h;
    c.fillStyle = "#0b0c0c";
    c.fillRect(x - h * 0.04, y - h * 0.07, h * 0.08, h * 0.14);
    c.fillStyle = "#4b4e49";
    c.beginPath();
    c.arc(x, y, h * 0.03, 0, Math.PI * 2);
    c.fill();
    label(c, x, y + h * 0.11, h * 0.032, t.word);
    const on = !!g && g.locks;
    c.fillStyle = on ? AMBER : "#2a2c2a";
    c.beginPath();
    c.arc(x, y - h * 0.11, h * 0.022, 0, Math.PI * 2);
    c.fill();
  }
  // THE LIGHTS' ROTARY with its blackout settings.
  const rx = w * 0.72;
  const ry = h * 0.74;
  const rr = h * 0.07;
  knob(c, rx, ry, rr);
  c.strokeStyle = INK;
  c.lineWidth = rr * 0.2;
  c.beginPath();
  c.moveTo(rx, ry);
  c.lineTo(rx - rr * 0.6, ry - rr * 0.7);
  c.stroke();
  ["OFF", "B.O.", "PARK", "HEAD"].forEach((word, i) => {
    const a = ((-70 + i * 47) * Math.PI) / 180;
    label(c, rx + Math.sin(a) * rr * 1.8, ry - Math.cos(a) * rr * 1.8, h * 0.026, word);
  });
  // The hazard key and the convoy light's.
  c.fillStyle = "#7d1612";
  c.fillRect(w * 0.86, h * 0.67, h * 0.1, h * 0.1);
  label(c, w * 0.86 + h * 0.05, h * 0.72, h * 0.06, "▲", "#ffd0c8");
  label(c, w * 0.86 + h * 0.05, h * 0.82, h * 0.028, "HAZ");
  label(c, w * 0.5, h * 0.94, h * 0.03, "TYRES DOWN: 40 km/h MAX", "#8a8f88");
}
