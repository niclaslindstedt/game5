// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TANK'S STATIONS' FACES, PAINTED IN CODE (`tank-driver.ts`,
// `tank-gunner.ts`) — canvas only, three-free.
//
//   * THE DRIVER'S DISPLAY: a screen of green figures on black, as a
//     modern hull's driver reads his tank — the speed large, the engine's
//     turn as a bar, the gear, the fuel, the coolant, the oil and the
//     battery, the turret's place over the hull drawn from above (where
//     the gun points, so he does not swing it into a tree) and the
//     cautions in amber and red;
//   * THE DRIVER'S SWITCH PANEL: the master switch, the starter, the
//     lights' blackout settings, the bilge pump, the fixed fire
//     extinguisher's guarded pull, the horn — lamps and guarded toggles;
//   * THE GUNNER'S FIRE CONTROL PANEL: the round chosen (lit), the laser's
//     range in a window, the gun ready, the stabiliser's mode and the
//     ballistic computer's keys;
//   * THE TURRET'S INDICATOR on the gunner's wall: a dial of the turret
//     off the hull's nose;
//   * THE SIGHT'S RETICLE: the field of view a soft-edged black circle,
//     the aiming mark at its middle (a gap cross on a short post), the
//     stadia along the horizontal line, the laser's range and the round
//     in a red readout at the foot, the ready mark beside it.
// Every face is BACK (drawn once) and LIVE over it where it reads.

import { moulding } from "./cab-paint.ts";
import {
  AMBER,
  bezel,
  GREEN,
  hub,
  keys,
  knob,
  label,
  needle,
  RED,
  ticks,
  window7,
  type Ctx,
} from "./dial-paint.ts";
import type { TankGauges } from "./tank-station-plan.ts";

const SCREEN_GREEN = "#62ff7a";
const SCREEN_DIM = "#1e5a2a";

/** THE DRIVER'S DISPLAY, live. */
export function paintDriverDisplay(c: Ctx, g: TankGauges | null): void {
  const { width: w, height: h } = c.canvas;
  // The bezel and its keys round the glass.
  moulding(c, "#1a1c1a");
  c.fillStyle = "#020403";
  c.fillRect(w * 0.08, h * 0.1, w * 0.84, h * 0.76);
  for (let i = 0; i < 5; i++) {
    c.fillStyle = "#2c2f2c";
    c.fillRect(w * (0.12 + i * 0.16), h * 0.89, w * 0.1, h * 0.07);
  }
  if (!g) return;
  const x0 = w * 0.08;
  const y0 = h * 0.1;
  const W = w * 0.84;
  const H = h * 0.76;
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  // THE SPEED, large.
  c.fillStyle = SCREEN_GREEN;
  c.font = `bold ${Math.round(H * 0.32)}px monospace`;
  c.fillText(String(Math.round(g.kmh)).padStart(2, " "), x0 + W * 0.05, y0 + H * 0.38);
  c.font = `bold ${Math.round(H * 0.09)}px sans-serif`;
  c.fillText("km/h", x0 + W * 0.05, y0 + H * 0.5);
  // THE GEAR.
  c.strokeStyle = SCREEN_GREEN;
  c.lineWidth = 2;
  c.strokeRect(x0 + W * 0.36, y0 + H * 0.08, W * 0.14, H * 0.34);
  c.font = `bold ${Math.round(H * 0.26)}px monospace`;
  c.textAlign = "center";
  c.fillText(g.gear, x0 + W * 0.43, y0 + H * 0.34);
  // THE ENGINE as a bar.
  c.textAlign = "left";
  c.font = `bold ${Math.round(H * 0.07)}px sans-serif`;
  c.fillText("RPM", x0 + W * 0.05, y0 + H * 0.64);
  c.fillStyle = SCREEN_DIM;
  c.fillRect(x0 + W * 0.16, y0 + H * 0.58, W * 0.34, H * 0.07);
  c.fillStyle = g.rpm > 2700 ? RED : SCREEN_GREEN;
  c.fillRect(x0 + W * 0.16, y0 + H * 0.58, W * 0.34 * Math.min(1, g.rpm / 3000), H * 0.07);
  // THE FLUIDS, a row each.
  const rows: [string, string, boolean][] = [
    ["FUEL", `${Math.round(g.fuel * 100)}%`, g.fuel < 0.15],
    ["COOL", `${Math.round(g.coolant)}°C`, g.coolant > 110],
    ["OIL", `${g.oil.toFixed(1)} bar`, g.oil < 1],
    ["BATT", `${g.volts.toFixed(1)} V`, g.volts < 24],
  ];
  c.font = `bold ${Math.round(H * 0.066)}px monospace`;
  rows.forEach(([word, value, bad], i) => {
    c.fillStyle = bad ? AMBER : SCREEN_GREEN;
    const col = x0 + W * (0.04 + (i % 2) * 0.36);
    c.fillText(`${word.padEnd(5, " ")}${value}`, col, y0 + H * (0.78 + Math.floor(i / 2) * 0.11));
  });
  // THE TURRET over the hull, from above: the hull a box, the gun a line.
  const cx = x0 + W * 0.78;
  const cy = y0 + H * 0.4;
  const s = H * 0.24;
  c.strokeStyle = SCREEN_GREEN;
  c.lineWidth = 2;
  c.strokeRect(cx - s * 0.45, cy - s, s * 0.9, s * 2);
  c.beginPath();
  c.arc(cx, cy, s * 0.38, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(cx, cy);
  // The engine's right is the picture's left: the gun drawn as he sees it.
  c.lineTo(cx - Math.sin(g.turret) * s * 1.25, cy - Math.cos(g.turret) * s * 1.25);
  c.stroke();
  c.font = `bold ${Math.round(H * 0.07)}px sans-serif`;
  c.textAlign = "center";
  c.fillText("TURRET", cx, y0 + H * 0.94);
  // THE CAUTIONS.
  c.textAlign = "left";
  c.font = `bold ${Math.round(H * 0.08)}px sans-serif`;
  if (g.dead) {
    c.fillStyle = RED;
    c.fillText("ENGINE FAIL", x0 + W * 0.36, y0 + H * 0.52);
  } else if (Math.abs(g.turret) > 1.2) {
    c.fillStyle = AMBER;
    c.fillText("GUN OVER SIDE", x0 + W * 0.36, y0 + H * 0.52);
  }
}

/** THE DRIVER'S SWITCH PANEL (drawn once). */
export function paintDriverPanel(c: Ctx): void {
  moulding(c, "#20231f");
  const { width: w, height: h } = c.canvas;
  const lamp = (x: number, y: number, colour: string, word: string) => {
    c.fillStyle = colour;
    c.beginPath();
    c.arc(x * w, y * h, h * 0.045, 0, Math.PI * 2);
    c.fill();
    label(c, x * w, (y + 0.1) * h, h * 0.055, word);
  };
  const toggle = (x: number, y: number, word: string, guard = false) => {
    c.fillStyle = "#0b0c0c";
    c.fillRect(x * w - h * 0.05, y * h - h * 0.09, h * 0.1, h * 0.18);
    if (guard) {
      c.strokeStyle = "#b8231c";
      c.lineWidth = h * 0.02;
      c.strokeRect(x * w - h * 0.07, y * h - h * 0.11, h * 0.14, h * 0.22);
    }
    c.fillStyle = "#6a6d68";
    c.beginPath();
    c.arc(x * w, y * h, h * 0.03, 0, Math.PI * 2);
    c.fill();
    label(c, x * w, (y + 0.17) * h, h * 0.05, word);
  };
  lamp(0.1, 0.15, "#3a1110", "MSTR");
  lamp(0.25, 0.15, "#3a2a0c", "OIL");
  lamp(0.4, 0.15, "#3a2a0c", "HOT");
  lamp(0.55, 0.15, "#3a1110", "FIRE");
  lamp(0.7, 0.15, "#123a17", "PARK");
  lamp(0.85, 0.15, "#3a2a0c", "FILTER");
  toggle(0.1, 0.55, "MASTER", true);
  toggle(0.25, 0.55, "START");
  toggle(0.4, 0.55, "BILGE");
  toggle(0.55, 0.55, "HORN");
  // The lights' rotary.
  knob(c, w * 0.72, h * 0.55, h * 0.09);
  label(c, w * 0.72, h * 0.72, h * 0.05, "B.O. · DRIVE");
  // The fixed extinguisher's pull under its red guard.
  c.fillStyle = "#b8231c";
  c.fillRect(w * 0.84, h * 0.42, h * 0.16, h * 0.24);
  label(c, w * 0.84 + h * 0.08, h * 0.54, h * 0.07, "FIRE", "#fff");
  label(c, w * 0.5, h * 0.92, h * 0.05, "HULL · DRIVER", "#8a8f88");
}

/** The rounds on the fire control's keys, left to right. */
const ROUNDS = ["AP", "HE", "MP", "CAN"] as const;

/** THE FIRE CONTROL'S PANEL, live: `range` the laser's (m, or null for
 * none), `ready` the gun loaded. */
export function paintFireControl(c: Ctx, range: number | null, ready: boolean): void {
  moulding(c, "#1e211d");
  const { width: w, height: h } = c.canvas;
  label(c, w * 0.5, h * 0.08, h * 0.06, "FIRE CONTROL", AMBER);
  // The round chosen: the high-explosive lit.
  keys(c, w * 0.06, h * 0.16, w * 0.88, h * 0.14, ROUNDS);
  const kw = (w * 0.88) / ROUNDS.length;
  c.strokeStyle = AMBER;
  c.lineWidth = h * 0.015;
  c.strokeRect(w * 0.06 + kw + 3, h * 0.16, kw - 6, h * 0.14);
  // The laser's range.
  label(c, w * 0.2, h * 0.42, h * 0.05, "RANGE");
  window7(
    c,
    w * 0.32,
    h * 0.36,
    w * 0.4,
    h * 0.12,
    range === null ? "----" : String(Math.round(range)).padStart(4, "0"),
    true,
  );
  label(c, w * 0.82, h * 0.42, h * 0.05, "m");
  // The gun ready, the stabiliser, the laser armed.
  const lamp = (x: number, on: boolean, colour: string, word: string) => {
    c.fillStyle = on ? colour : "#262826";
    c.beginPath();
    c.arc(w * x, h * 0.6, h * 0.04, 0, Math.PI * 2);
    c.fill();
    label(c, w * x, h * 0.69, h * 0.045, word);
  };
  lamp(0.15, ready, GREEN, "READY");
  lamp(0.38, true, GREEN, "STAB");
  lamp(0.61, true, AMBER, "LASER");
  lamp(0.84, !ready, AMBER, "LOAD");
  keys(c, w * 0.06, h * 0.78, w * 0.88, h * 0.12, ["TEST", "BATT", "MAN", "EMER"]);
}

/** THE TURRET'S INDICATOR, live: the turret `turret` rad off the hull's
 * nose (the engine's right the picture's left). */
export function paintAzimuth(c: Ctx, turret: number): void {
  const { width: w, height: h } = c.canvas;
  moulding(c);
  const x = w / 2;
  const y = h / 2;
  const r = w * 0.38;
  bezel(c, x, y, r);
  ticks(c, x, y, r, 0, 360, 32, 4);
  label(c, x, y - r * 0.55, r * 0.2, "12");
  label(c, x, y + r * 0.55, r * 0.2, "6");
  // The hull's outline, fixed; the gun's needle, turned as he sees it.
  c.strokeStyle = "#9aa09a";
  c.lineWidth = r * 0.05;
  c.strokeRect(x - r * 0.2, y - r * 0.4, r * 0.4, r * 0.8);
  needle(c, x, y, r, -(turret * 180) / Math.PI, 0.8, 0.08);
  hub(c, x, y, r);
}

/** THE SIGHT'S RETICLE, live, on a square canvas laid over the lens: the
 * field's circle, the aiming mark, the stadia, the range and the round. */
export function paintReticle(c: Ctx, range: number | null, ready: boolean): void {
  const { width: w, height: h } = c.canvas;
  const x = w / 2;
  const y = h / 2;
  const R = h * 0.47;
  c.clearRect(0, 0, w, h);
  // THE FIELD: black outside the circle, its edge soft, a faint blue cast
  // and the light falling off toward the rim inside it.
  c.fillStyle = "#000";
  c.fillRect(0, 0, w, h);
  c.save();
  c.globalCompositeOperation = "destination-out";
  const hole = c.createRadialGradient(x, y, R * 0.9, x, y, R);
  hole.addColorStop(0, "rgba(0,0,0,1)");
  hole.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = hole;
  c.beginPath();
  c.arc(x, y, R, 0, Math.PI * 2);
  c.fill();
  c.restore();
  const cast = c.createRadialGradient(x, y, R * 0.3, x, y, R * 0.92);
  cast.addColorStop(0, "rgba(40,70,90,0.06)");
  cast.addColorStop(1, "rgba(0,10,20,0.35)");
  c.fillStyle = cast;
  c.beginPath();
  c.arc(x, y, R * 0.92, 0, Math.PI * 2);
  c.fill();
  // THE AIMING MARK: a cross with its middle left open, the post under it.
  const ink = "rgba(10,10,10,0.92)";
  c.strokeStyle = ink;
  c.fillStyle = ink;
  const gap = R * 0.035;
  c.lineWidth = Math.max(2, R * 0.006);
  c.beginPath();
  c.moveTo(x - R * 0.9, y);
  c.lineTo(x - gap * 3, y);
  c.moveTo(x + gap * 3, y);
  c.lineTo(x + R * 0.9, y);
  c.moveTo(x, y + gap * 3);
  c.lineTo(x, y + R * 0.9);
  c.moveTo(x, y - gap * 3);
  c.lineTo(x, y - R * 0.25);
  c.stroke();
  // The heavy ends of the lines toward the rim.
  c.lineWidth = Math.max(4, R * 0.018);
  c.beginPath();
  c.moveTo(x - R * 0.9, y);
  c.lineTo(x - R * 0.45, y);
  c.moveTo(x + R * 0.45, y);
  c.lineTo(x + R * 0.9, y);
  c.moveTo(x, y + R * 0.45);
  c.lineTo(x, y + R * 0.9);
  c.stroke();
  // The mark itself: a small open box.
  c.lineWidth = Math.max(2, R * 0.007);
  c.strokeRect(x - gap, y - gap, gap * 2, gap * 2);
  // THE STADIA: a tick every mil-step along the line, a long one each fifth.
  c.lineWidth = Math.max(1.5, R * 0.004);
  for (let i = 1; i <= 8; i++) {
    const dx = i * R * 0.05;
    const tall = i % 4 === 0 ? R * 0.04 : R * 0.02;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(x + s * dx, y);
      c.lineTo(x + s * dx, y - tall);
      c.stroke();
    }
  }
  // The lead's chevrons under the mark.
  for (let i = 1; i <= 3; i++) {
    const dy = i * R * 0.08;
    c.beginPath();
    c.moveTo(x - R * 0.025, y + dy - R * 0.012);
    c.lineTo(x, y + dy);
    c.lineTo(x + R * 0.025, y + dy - R * 0.012);
    c.stroke();
  }
  // THE READOUT at the foot: the range, the round, the gun ready.
  const glow = "#ff3b2a";
  c.fillStyle = glow;
  c.font = `bold ${Math.round(R * 0.09)}px monospace`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.shadowColor = glow;
  c.shadowBlur = R * 0.02;
  c.fillText(range === null ? "----" : String(Math.round(range)).padStart(4, "0"), x, y + R * 0.72);
  c.font = `bold ${Math.round(R * 0.06)}px monospace`;
  c.fillText("HE", x - R * 0.3, y + R * 0.72);
  if (ready) c.fillText("●", x + R * 0.28, y + R * 0.72);
  c.shadowBlur = 0;
  // A faint word at the field's top: the channel and its power.
  c.fillStyle = "rgba(255,59,42,0.75)";
  c.font = `bold ${Math.round(R * 0.045)}px monospace`;
  c.fillText("DAY ×5", x, y - R * 0.82);
}

/** THE RETICLE's canvas, px a side. */
export const RETICLE_PX = 1024;
