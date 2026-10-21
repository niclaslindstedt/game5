// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY HELICOPTER'S FACES, PAINTED IN CODE (`army-heli-cockpit.ts` lays
// them on the panel, the lower console and the upper console) — canvas
// only, three-free.
//
// THE PANEL is laid out as the twin-engined utility helicopter's is
// (`army-cockpit-plan.ts`), read from the pilots' seats: before each pilot
// his flight instruments in two rows — the airspeed, the attitude and the
// barometric altimeter over the radar altimeter, the horizontal situation
// and the climb — a clock outboard; in the middle, where both read them,
// the ENGINE INSTRUMENTS AS VERTICAL TAPES on two units — on the left the
// fuel's two tanks, both engines' oil temperatures and pressures, their
// turbine gas temperatures and their gas generators' speeds; on the right
// the rotor's and both power turbines' speeds on three tapes side by side
// and the two torques — a pair of lit columns for the pair of engines,
// green in the band, amber and red past it; over them THE CAUTION AND
// ADVISORY PANEL, a grid of legends lit amber when one trips. THE LOWER
// CONSOLE carries the radios, the navigation's control, the flight control
// computer's panel and the stabilator's; THE UPPER CONSOLE the breakers,
// the lights' and the anti-ice's switches. Every face is BACK (drawn once)
// and the panel LIVE over it (the needles, the ball, the card, the tapes,
// the legends).

import { ARMY_COCKPIT, PILOT, COPILOT } from "./army-cockpit-plan.ts";
import type { Gauges } from "./cockpit-plan.ts";
import {
  AMBER,
  attitudeBall,
  band,
  bezel,
  compassCard,
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

/** THE PANEL'S CANVAS: px a metre and its size. */
export const ARMY_PANEL_PX = 1000;
const P = ARMY_COCKPIT.panel;
export const ARMY_PANEL_W = Math.round(P.half * 2 * ARMY_PANEL_PX);
export const ARMY_PANEL_H = Math.round((P.top - P.bottom) * ARMY_PANEL_PX);

/** A spot on the panel, m — across from its middle (right as seen +) and
 * up from its foot — in px. */
const px = (x: number): number => (x + P.half) * ARMY_PANEL_PX;
const py = (y: number): number => ARMY_PANEL_H - y * ARMY_PANEL_PX;
const pr = (m: number): number => m * ARMY_PANEL_PX;

/** Each pilot's instruments round the middle of his set, m, and their
 * diameters. */
const SET = {
  asi: { x: -0.175, y: 0.24, d: 0.088 },
  adi: { x: 0, y: 0.235, d: 0.125 },
  alt: { x: 0.175, y: 0.24, d: 0.088 },
  radar: { x: -0.175, y: 0.085, d: 0.08 },
  hsi: { x: 0, y: 0.085, d: 0.12 },
  vsi: { x: 0.175, y: 0.085, d: 0.08 },
  clock: { x: 0.31, y: 0.24, d: 0.06 },
} as const;

/** Where each pilot's set is centred across the panel. */
const SETS = [PILOT * 0.56, COPILOT * 0.56] as const;

/** THE ENGINE UNITS: their middles, widths and height; the caution panel. */
const UNITS = {
  left: { x: -0.15, y: 0.135, w: 0.27, h: 0.22 },
  right: { x: 0.15, y: 0.135, w: 0.27, h: 0.22 },
  caution: { x: 0, y: 0.295, w: 0.52, h: 0.06 },
} as const;

/** The left unit's tapes (a pair each), their words and their ranges. */
const LEFT_TAPES = [
  { word: "FUEL", lo: 0, hi: 100, green: [20, 100], amber: [10, 20] },
  { word: "OIL °C", lo: 0, hi: 160, green: [40, 130], amber: [130, 150] },
  { word: "OIL PSI", lo: 0, hi: 120, green: [30, 100], amber: [20, 30] },
  { word: "TGT", lo: 0, hi: 1000, green: [300, 810], amber: [810, 850] },
  { word: "NG %", lo: 0, hi: 110, green: [60, 102], amber: [102, 105] },
] as const;
const RIGHT_TAPES = [
  { word: "NR NP %", lo: 0, hi: 130, green: [96, 104], amber: [104, 110] },
  { word: "TRQ %", lo: 0, hi: 140, green: [0, 100], amber: [100, 115] },
] as const;

/** The caution panel's legends, row by row. */
const CAUTIONS = [
  [
    "#1 FUEL LOW",
    "#1 GEN",
    "#1 OIL PRESS",
    "#1 ENG OUT",
    "MAIN XMSN",
    "#2 ENG OUT",
    "#2 OIL PRESS",
    "#2 GEN",
  ],
  [
    "#1 FUEL PRESS",
    "LOW ROTOR",
    "CHIP INPUT",
    "AFCS DEGR",
    "STAB",
    "HYD PUMP",
    "IFF",
    "#2 FUEL LOW",
  ],
] as const;

function at(cx: number, k: { x: number; y: number; d: number }): [number, number, number] {
  return [px(cx + k.x), py(k.y), pr(k.d / 2)];
}

function boxOf(k: {
  x: number;
  y: number;
  w: number;
  h: number;
}): [number, number, number, number] {
  return [px(k.x - k.w / 2), py(k.y + k.h / 2), pr(k.w), pr(k.h)];
}

/** The airspeed's angle, deg from the top: 0..200 kt round the dial. */
const asiAngle = (kt: number): number => 15 + Math.min(200, Math.max(0, kt)) * 1.6;
/** The climb's: ±4,000 ft/min either side of nine o'clock. */
const vsiAngle = (fpm: number): number => 270 + Math.max(-4000, Math.min(4000, fpm)) * 0.04;
/** The radar altimeter's: 0..200 ft over half its face, then to 1,500. */
const radarAngle = (ft: number): number =>
  ft <= 200 ? 15 + ft * 0.8 : 175 + Math.min(1300, ft - 200) * 0.12;

/** The panel's ground: a dark grey with a matte grain and its seams. */
function ground(c: Ctx): void {
  const g = c.createLinearGradient(0, 0, 0, ARMY_PANEL_H);
  g.addColorStop(0, "#2a2d2d");
  g.addColorStop(1, "#1a1c1c");
  c.fillStyle = g;
  c.fillRect(0, 0, ARMY_PANEL_W, ARMY_PANEL_H);
  c.fillStyle = "rgba(255,255,255,0.025)";
  for (let i = 0; i < 2600; i++)
    c.fillRect((i * 151.7) % ARMY_PANEL_W, (i * 71.3) % ARMY_PANEL_H, 2, 1);
  c.strokeStyle = "#0e0f0f";
  c.lineWidth = 3;
  for (const x of [-0.31, 0.31]) {
    c.beginPath();
    c.moveTo(px(x), 0);
    c.lineTo(px(x), ARMY_PANEL_H);
    c.stroke();
  }
}

/** A row of Dzus fasteners along a seam. */
function fasteners(c: Ctx, x: number): void {
  c.fillStyle = "#3b3e3e";
  for (let y = 0.03; y < P.top - P.bottom; y += 0.08) {
    c.beginPath();
    c.arc(px(x), py(y), 4, 0, Math.PI * 2);
    c.fill();
  }
}

/** THE PANEL'S BACK: the ground, the bezels, every scale and word. */
export function paintArmyPanelBack(c: Ctx): void {
  ground(c);
  for (const x of [-0.31, 0.31, -P.half + 0.02, P.half - 0.02]) fasteners(c, x);
  SETS.forEach((cx, i) => {
    // THE AIRSPEED: 0..200 kt.
    {
      const [x, y, r] = at(cx, SET.asi);
      bezel(c, x, y, r);
      ticks(c, x, y, r, 15, 335, 40, 4);
      numbers(c, x, y, r, 15, 335, ["0", "", "40", "", "80", "", "120", "", "160", "", "200"], 0.2);
      band(c, x, y, r, asiAngle(40), asiAngle(150), GREEN);
      band(c, x, y, r, asiAngle(150), asiAngle(193), AMBER);
      label(c, x, y + r * 0.35, r * 0.15, "KNOTS");
    }
    // THE ATTITUDE in its square case; THE HSI.
    {
      const [x, y, r] = at(cx, SET.adi);
      c.fillStyle = "#151616";
      c.fillRect(x - r * 1.18, y - r * 1.18, r * 2.36, r * 2.36);
      bezel(c, x, y, r);
      label(c, x - r * 0.95, y + r * 1.05, r * 0.12, "PULL TO CAGE", "#9aa09a");
    }
    {
      const [x, y, r] = at(cx, SET.hsi);
      c.fillStyle = "#151616";
      c.fillRect(x - r * 1.18, y - r * 1.18, r * 2.36, r * 2.36);
      bezel(c, x, y, r);
      label(c, x - r * 0.85, y - r * 1.02, r * 0.12, "HDG", AMBER);
      label(c, x + r * 0.85, y - r * 1.02, r * 0.12, "CRS", AMBER);
      knob(c, x - r * 0.98, y + r * 0.98, r * 0.14);
      knob(c, x + r * 0.98, y + r * 0.98, r * 0.14);
    }
    // THE ALTIMETER: 0..1,000 ft a turn, the drum's window, the setting.
    {
      const [x, y, r] = at(cx, SET.alt);
      bezel(c, x, y, r);
      ticks(c, x, y, r, 0, 360, 50, 5);
      numbers(c, x, y, r, 0, 324, ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], 0.2);
      window7(c, x - r * 0.3, y + r * 0.28, r * 0.6, r * 0.2, "", false);
      label(c, x + r * 0.42, y - r * 0.32, r * 0.1, "IN HG", "#9aa09a");
    }
    // THE RADAR ALTIMETER: its low bug, its scale.
    {
      const [x, y, r] = at(cx, SET.radar);
      bezel(c, x, y, r);
      ticks(c, x, y, r, 15, 335, 32, 4);
      numbers(c, x, y, r, 15, 175, ["0", "50", "100", "150", "200"], 0.17);
      band(c, x, y, r, radarAngle(0), radarAngle(50), AMBER);
      label(c, x, y + r * 0.4, r * 0.13, "RAD ALT");
    }
    // THE CLIMB: ±4,000 ft/min.
    {
      const [x, y, r] = at(cx, SET.vsi);
      bezel(c, x, y, r);
      ticks(c, x, y, r, 110, 430, 32, 4);
      numbers(c, x, y, r, 110, 430, ["4", "3", "2", "1", "0", "1", "2", "3", "4"], 0.17);
      label(c, x + r * 0.3, y, r * 0.13, "UP");
      label(c, x + r * 0.3, y + r * 0.3, r * 0.13, "DN");
    }
    // THE CLOCK outboard.
    {
      const [x, y, r] = at(cx, { ...SET.clock, x: SET.clock.x * (i === 0 ? 1 : -1) });
      bezel(c, x, y, r);
      ticks(c, x, y, r, 0, 360, 60, 5);
      numbers(
        c,
        x,
        y,
        r,
        0,
        330,
        ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
        0.24,
      );
    }
    // The master caution under the glareshield before him.
    const mx = px(cx);
    c.fillStyle = "#3d2f0a";
    c.fillRect(mx - 40, 6, 80, 22);
    label(c, mx, 17, 11, "MASTER CAUTION", "#6b5a2a");
  });
  // THE ENGINE UNITS and their tapes' scales.
  for (const [k, tapes] of [
    [UNITS.left, LEFT_TAPES],
    [UNITS.right, RIGHT_TAPES],
  ] as const) {
    const [x, y, w, h] = boxOf(k);
    c.fillStyle = "#0b0c0c";
    c.fillRect(x - 6, y - 6, w + 12, h + 12);
    c.fillStyle = "#050606";
    c.fillRect(x, y, w, h);
    const n = tapes.length;
    tapes.forEach((t, i) => {
      const cw = w / n;
      const cx = x + cw * i + cw / 2;
      label(c, cx, y + h - 10, 10, t.word, "#a7aca5");
      // The scale's ticks either side of the pair.
      c.strokeStyle = "#5d625c";
      c.lineWidth = 1;
      for (let s = 0; s <= 10; s++) {
        const yy = y + 14 + (h - 38) * (1 - s / 10);
        c.beginPath();
        c.moveTo(cx - cw * 0.42, yy);
        c.lineTo(cx - cw * 0.34, yy);
        c.moveTo(cx + cw * 0.34, yy);
        c.lineTo(cx + cw * 0.42, yy);
        c.stroke();
      }
    });
  }
  // THE CAUTION PANEL's legends, dark.
  paintCautions(c, null);
  label(c, px(0), py(0.012), 11, "ENGINE INSTRUMENTS", "#7c817a");
}

/** One tape: a pair of columns lit to `a` and `b` of their range. */
function tapePair(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  t: { lo: number; hi: number; green: readonly number[]; amber: readonly number[] },
  a: number,
  b: number,
): void {
  const base = y + h - 24;
  const tall = h - 38;
  const colour = (v: number) =>
    v >= t.green[0] && v <= t.green[1] ? GREEN : v >= t.amber[0] && v <= t.amber[1] ? AMBER : RED;
  [a, b].forEach((v, i) => {
    const k = Math.max(0, Math.min(1, (v - t.lo) / (t.hi - t.lo)));
    const cx = x + w * (i === 0 ? 0.33 : 0.53);
    c.fillStyle = "#101511";
    c.fillRect(cx, base - tall, w * 0.14, tall);
    c.fillStyle = colour(v);
    // The column as lit segments, as the tapes' lamps are.
    const segs = Math.round(k * 30);
    for (let s = 0; s < segs; s++)
      c.fillRect(cx, base - (s + 1) * (tall / 30) + 1, w * 0.14, tall / 30 - 1.5);
  });
}

/** THE CAUTION PANEL: the legends lit where `g` trips them (dark when
 * `g` is null). */
function paintCautions(c: Ctx, g: Gauges | null): void {
  const [x, y, w, h] = boxOf(UNITS.caution);
  c.fillStyle = "#070808";
  c.fillRect(x - 3, y - 3, w + 6, h + 6);
  const cols = CAUTIONS[0].length;
  const cw = w / cols;
  const ch = h / CAUTIONS.length;
  const lit = (word: string): boolean => {
    if (!g || !g.live) return false;
    if (word === "LOW ROTOR") return g.lowRotor;
    return false;
  };
  CAUTIONS.forEach((row, j) =>
    row.forEach((word, i) => {
      const on = lit(word);
      c.fillStyle = on ? "#f4b41c" : "#1d1a12";
      c.fillRect(x + i * cw + 1.5, y + j * ch + 1.5, cw - 3, ch - 3);
      label(
        c,
        x + i * cw + cw / 2,
        y + j * ch + ch / 2,
        Math.min(9, ch * 0.33),
        word,
        on ? "#140f02" : "#4c4532",
      );
    }),
  );
}

/** THE PANEL LIVE over its back: the needles, the attitude, the card, the
 * tapes, the cautions — off `g` (both pilots' sets read the same machine). */
export function paintArmyPanelLive(c: Ctx, back: CanvasImageSource, g: Gauges): void {
  c.drawImage(back, 0, 0);
  for (const cx of SETS) {
    {
      const [x, y, r] = at(cx, SET.asi);
      needle(c, x, y, r, asiAngle(g.ias), 0.82);
      hub(c, x, y, r);
    }
    {
      const [x, y, r] = at(cx, SET.adi);
      attitudeBall(c, x, y, r, g);
    }
    {
      const [x, y, r] = at(cx, SET.hsi);
      compassCard(c, x, y, r, g);
    }
    {
      const [x, y, r] = at(cx, SET.alt);
      const ft = Math.max(0, g.alt);
      window7(
        c,
        x - r * 0.3,
        y + r * 0.28,
        r * 0.6,
        r * 0.2,
        String(Math.round(ft / 100) * 100).padStart(5, "0"),
        g.live,
      );
      needle(c, x, y, r, ((ft % 1000) / 1000) * 360, 0.85);
      needle(c, x, y, r, ((ft % 10000) / 10000) * 360, 0.5, 0.1);
      hub(c, x, y, r);
    }
    {
      const [x, y, r] = at(cx, SET.radar);
      needle(c, x, y, r, radarAngle(g.radar), 0.8);
      hub(c, x, y, r);
      if (g.radar < 50 && g.live) {
        c.fillStyle = AMBER;
        c.beginPath();
        c.arc(x - r * 0.45, y - r * 0.45, r * 0.09, 0, Math.PI * 2);
        c.fill();
      }
    }
    {
      const [x, y, r] = at(cx, SET.vsi);
      needle(c, x, y, r, vsiAngle(g.vsi), 0.82);
      hub(c, x, y, r);
    }
  }
  if (g.live) {
    const pair = (v: number, d: number) => [v, v + d] as const;
    const left = [
      pair(g.fuel, -1.5),
      pair(85 + (g.torque / 100) * 10, 2),
      pair(45 + (g.ng / 100) * 30, -1.5),
      pair(g.t4 + 120, -8),
      pair(g.ng, -0.6),
    ];
    const right = [pair(g.nr, g.nf - g.nr), pair(g.torque, -1.2)];
    for (const [k, tapes, vals] of [
      [UNITS.left, LEFT_TAPES, left],
      [UNITS.right, RIGHT_TAPES, right],
    ] as const) {
      const [x, y, w, h] = boxOf(k);
      const cw = w / tapes.length;
      tapes.forEach((t, i) => tapePair(c, x + cw * i, y, cw, h, t, vals[i][0], vals[i][1]));
      // The digits under the torques and the turbine temperatures.
      if (k === UNITS.right) {
        label(c, x + cw * 1.5, y + h - 2 - 26, 13, `${Math.round(g.torque)}`, GREEN);
      }
    }
  }
  paintCautions(c, g);
  // The master caution lit with a caution.
  if (g.live && g.lowRotor) {
    for (const cx of SETS) {
      c.fillStyle = AMBER;
      c.fillRect(px(cx) - 40, 6, 80, 22);
      label(c, px(cx), 17, 11, "MASTER CAUTION", "#140f02");
    }
  }
}

/** THE LOWER CONSOLE's face, px: its width across and its length along. */
export const ARMY_CONSOLE_W = 384;
export const ARMY_CONSOLE_H = 1536;

/** THE LOWER CONSOLE's face, read from its aft end (the canvas's foot) to
 * the panel (its head): the radios, the navigation, the flight control
 * computer, the stabilator, the trims. */
export function paintArmyConsole(c: Ctx, live: boolean): void {
  const W = ARMY_CONSOLE_W;
  const H = ARMY_CONSOLE_H;
  c.fillStyle = "#1c1e1e";
  c.fillRect(0, 0, W, H);
  const plate = (y: number, h: number, title: string) => {
    c.fillStyle = "#262929";
    c.fillRect(8, y, W - 16, h - 6);
    c.strokeStyle = "#0b0c0c";
    c.lineWidth = 3;
    c.strokeRect(8, y, W - 16, h - 6);
    c.fillStyle = "#3b3e3e";
    for (const [x, yy] of [
      [16, y + 8],
      [W - 16, y + 8],
      [16, y + h - 14],
      [W - 16, y + h - 14],
    ]) {
      c.beginPath();
      c.arc(x, yy, 4, 0, Math.PI * 2);
      c.fill();
    }
    label(c, W / 2, y + 16, 14, title);
  };
  let y = 6;
  // From the panel aft.
  plate(y, 190, "FLT CONTROL COMPUTER");
  keys(c, 30, y + 40, W - 60, 34, ["SAS 1", "SAS 2", "TRIM", "FPS"]);
  keys(c, 30, y + 90, W - 60, 34, ["BOOST", "STAB AUTO", "MAN", "TEST"]);
  window7(c, 60, y + 140, W - 120, 30, live ? "AFCS OK" : "", live);
  y += 190;
  plate(y, 160, "STABILATOR");
  knob(c, W * 0.3, y + 90, 26);
  knob(c, W * 0.7, y + 90, 26);
  label(c, W * 0.3, y + 135, 12, "SLEW UP/DN");
  label(c, W * 0.7, y + 135, 12, "AUTO CONTROL");
  y += 160;
  for (const [title, freq] of [
    ["UHF-AM", "251.700"],
    ["VHF-FM 1", "46.750"],
    ["VHF-FM 2", "33.400"],
  ] as const) {
    plate(y, 200, title);
    window7(c, 60, y + 40, W - 120, 40, freq, live);
    knob(c, 60, y + 120, 24);
    knob(c, W - 60, y + 120, 24);
    keys(c, 100, y + 104, W - 200, 32, ["PRE", "MAN", "SQ"]);
    label(c, 60, y + 160, 11, "VOL");
    label(c, W - 60, y + 160, 11, "CHAN");
    y += 200;
  }
  plate(y, 220, "NAV CONTROL");
  window7(c, 40, y + 40, W - 80, 40, live ? "WPT 03  N 61" : "", live);
  keys(c, 30, y + 96, W - 60, 30, ["1", "2", "3", "4", "5"]);
  keys(c, 30, y + 132, W - 60, 30, ["6", "7", "8", "9", "0"]);
  keys(c, 30, y + 168, W - 60, 30, ["MODE", "DIM", "ENT", "CLR"]);
  y += 220;
  plate(y, 150, "IFF");
  keys(c, 30, y + 40, W - 60, 34, ["M1", "M2", "M3/A", "M4"]);
  knob(c, W / 2, y + 108, 22);
  y += 150;
  plate(y, H - y - 4, "TRIM · LIGHTS");
  knob(c, W * 0.25, y + 70, 22);
  knob(c, W * 0.5, y + 70, 22);
  knob(c, W * 0.75, y + 70, 22);
  label(c, W * 0.25, y + 108, 11, "PANEL");
  label(c, W * 0.5, y + 108, 11, "CONSOLE");
  label(c, W * 0.75, y + 108, 11, "NVG");
}

/** THE UPPER CONSOLE's face, px. */
export const ARMY_OVERHEAD_W = 512;
export const ARMY_OVERHEAD_H = 1024;

/** THE UPPER CONSOLE's face, its aft end at the canvas's foot: rows of
 * breakers, the lights' and the anti-ice's switches, the engines' starts,
 * the fuel pumps; the space the quadrant's levers stand in left bare. */
export function paintArmyOverhead(c: Ctx): void {
  const W = ARMY_OVERHEAD_W;
  const H = ARMY_OVERHEAD_H;
  c.fillStyle = "#1c1e1e";
  c.fillRect(0, 0, W, H);
  // The quadrant's slot, forward (the canvas's head).
  c.fillStyle = "#0a0b0b";
  c.fillRect(W * 0.3, 20, W * 0.4, H * 0.3);
  label(c, W / 2, H * 0.33, 14, "ENG POWER CONT · FUEL", "#9aa09a");
  label(c, W * 0.2, 40, 13, "#1", INK);
  label(c, W * 0.8, 40, 13, "#2", INK);
  // The switches' rows.
  const rows = [
    ["ENG 1 START", "ENG 2 START", "APU", "APU GEN"],
    ["PITOT HTR", "WINDSHIELD", "ENG ANTI-ICE", "BLADE DEICE"],
    ["POS LT", "ANTI-COLL", "SEARCH", "CABIN"],
    ["FUEL PUMP 1", "XFEED", "FUEL PUMP 2", "BOOST"],
  ];
  rows.forEach((row, j) => {
    const y = H * 0.38 + j * 80;
    row.forEach((word, i) => {
      const x = W * (0.14 + i * 0.24);
      c.fillStyle = "#0b0c0c";
      c.fillRect(x - 14, y - 18, 28, 36);
      c.fillStyle = "#9a9d97";
      c.fillRect(x - 3, y - 14, 6, 18);
      c.beginPath();
      c.arc(x, y - 14, 6, 0, Math.PI * 2);
      c.fill();
      label(c, x, y + 30, 11, word);
    });
  });
  // The breakers.
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 10; i++) {
      const x = W * (0.07 + i * 0.096);
      const y = H * 0.74 + j * 62;
      c.fillStyle = "#0c0d0d";
      c.beginPath();
      c.arc(x, y, 13, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = (i + j) % 7 === 0 ? "#d4d4c8" : "#2a2d2d";
      c.beginPath();
      c.arc(x, y, 8, 0, Math.PI * 2);
      c.fill();
      label(c, x, y + 22, 8, `${5 + ((i * 3 + j) % 4) * 5}`, "#7c817a");
    }
}
