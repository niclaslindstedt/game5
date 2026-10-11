// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S PANEL, PAINTED IN CODE (`plane-cockpit.ts` lays it on the
// panel's face, the glass displays over it are `plane-cockpit-glass.ts`'s)
// — canvas only, three-free, painted ONCE.
//
// The panel is laid out as a late one of the class is, read from the pilot
// in the left seat: a grey face with the glass's bezels cut into it — the
// primary flight display in front of him, the multi-function display in
// the middle, the standbys' strip between them, the annunciators' strip
// over the middle — each display framed by its soft keys and knobs; the
// clock and the start switch outboard of him; along the foot a row of
// rocker switches (the battery, the generator, the avionics, the fuel
// pump, the ignition and start, the lights, the pitot heat) under their
// labels; on the right the radios (a communication and navigation set, the
// audio panel, the transponder), the emergency beacon's switch and the
// circuit breakers in rows; placards in the plane's own words. Every word
// is also painted alone onto a black GLOW canvas: the panel's lettering
// is backlit, so after dark the words glow and the grey goes dark.
//
// The QUADRANT's top plate (the three levers' names and stops, the flaps'
// scale) and the OVERHEAD console (the trim's scale, the cabin and the
// panel lights, the breakers) are painted the same way.

import { PLANE_COCKPIT } from "./plane-cockpit-plan.ts";

type Ctx = CanvasRenderingContext2D;

/** THE PANEL'S CANVAS: px per metre and its size. */
export const PANEL_PX = 1600;
const P = PLANE_COCKPIT.panel;
export const PANEL_W = Math.round(P.half * 2 * PANEL_PX);
export const PANEL_H = Math.round((P.top - P.bottom) * PANEL_PX);

/** A spot on the panel, m: across from its middle (right +) and up from
 * its foot — in px. */
const px = (x: number): number => (x + P.half) * PANEL_PX;
const py = (y: number): number => PANEL_H - y * PANEL_PX;
const pr = (m: number): number => m * PANEL_PX;

const INK = "#e8eae6";
const GREY = "#5d6168";

/** Two contexts painted together: the face, and the glow under its words. */
type Pair = { c: Ctx; glow: Ctx | null };

function words(
  p: Pair,
  s: string,
  x: number,
  y: number,
  size: number,
  colour = INK,
  align: CanvasTextAlign = "center",
): void {
  for (const [c, col] of [
    [p.c, colour],
    [p.glow, "#ffffff"],
  ] as const) {
    if (!c) continue;
    c.fillStyle = col;
    c.font = `700 ${size}px "DejaVu Sans", "Helvetica", sans-serif`;
    c.textAlign = align;
    c.textBaseline = "middle";
    c.fillText(s, x, y);
  }
}

/** A recess with a bevel: the cut a display or a unit sits in. */
function recess(c: Ctx, x: number, y: number, w: number, h: number, r = 8): void {
  c.fillStyle = "#1a1c1f";
  c.beginPath();
  c.roundRect(x - 6, y - 6, w + 12, h + 12, r + 4);
  c.fill();
  const g = c.createLinearGradient(x, y - 6, x, y + h + 6);
  g.addColorStop(0, "#0b0c0d");
  g.addColorStop(1, "#2a2d31");
  c.strokeStyle = g;
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = "#0d0e10";
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}

/** A round knob, its knurl and the light on its rim. */
function knob(c: Ctx, x: number, y: number, r: number): void {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#5a5e64");
  g.addColorStop(1, "#141518");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#08090a";
  c.lineWidth = 1.5;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75);
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    c.stroke();
  }
}

/** A screw head. */
function screw(c: Ctx, x: number, y: number): void {
  c.fillStyle = "#3c4045";
  c.beginPath();
  c.arc(x, y, 5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#1c1e21";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x - 3.5, y);
  c.lineTo(x + 3.5, y);
  c.stroke();
}

/** A display's bezel round its glass (`rect` in m on the panel), the soft
 * keys along its foot and a knob at each lower corner. */
function displayBezel(
  p: Pair,
  r: { x: number; y: number; w: number; h: number },
  name: string,
): void {
  const c = p.c;
  const x = px(r.x - r.w / 2);
  const y = py(r.y + r.h / 2);
  const w = pr(r.w);
  const h = pr(r.h);
  const m = 22;
  c.fillStyle = "#16171a";
  c.beginPath();
  c.roundRect(x - m, y - m, w + m * 2, h + m * 2 + 38, 14);
  c.fill();
  c.strokeStyle = "#2c2f34";
  c.lineWidth = 2;
  c.stroke();
  recess(c, x, y, w, h, 4);
  // The soft keys under the glass.
  const keys = 6;
  for (let k = 0; k < keys; k++) {
    const kx = x + 34 + ((w - 68) * k) / (keys - 1);
    c.fillStyle = "#26282c";
    c.beginPath();
    c.roundRect(kx - 18, y + h + 14, 36, 18, 3);
    c.fill();
  }
  knob(c, x - 4, y + h + 26, 15);
  knob(c, x + w + 4, y + h + 26, 15);
  words(p, name, x + w / 2, y - 12, 13, "#9aa1a8");
}

export function paintPanelBack(c: Ctx, glow: Ctx | null): void {
  const p: Pair = { c, glow };
  if (glow) {
    glow.fillStyle = "#000";
    glow.fillRect(0, 0, PANEL_W, PANEL_H);
  }
  // THE FACE: a grey crinkle-finished aluminium sheet.
  const g = c.createLinearGradient(0, 0, 0, PANEL_H);
  g.addColorStop(0, "#4b4f55");
  g.addColorStop(1, "#3a3d42");
  c.fillStyle = g;
  c.fillRect(0, 0, PANEL_W, PANEL_H);
  // Its grain: a seeded hash of specks, so every build is the same panel.
  let h = 2166136261;
  for (let i = 0; i < 9000; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const x = h % PANEL_W;
    h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d) >>> 0;
    const y = h % PANEL_H;
    c.fillStyle = (h & 1) === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
    c.fillRect(x, y, 2, 2);
  }
  // The sub-panels' seams and their screws: the pilot's, the middle and
  // the right.
  c.strokeStyle = "#2a2c30";
  c.lineWidth = 3;
  for (const sx of [-0.19, 0.165]) {
    c.beginPath();
    c.moveTo(px(sx), 0);
    c.lineTo(px(sx), PANEL_H);
    c.stroke();
  }
  for (const sx of [-0.485, -0.205, -0.175, 0.15, 0.18, 0.485]) {
    for (const sy of [0.02, 0.42]) screw(c, px(sx), py(sy));
  }

  const S = PLANE_COCKPIT.screens;
  displayBezel(p, S.pfd, "PFD");
  displayBezel(p, S.mfd, "MFD");
  // The standbys' strip and the annunciators' strip.
  const sb = S.standby;
  recess(c, px(sb.x - sb.w / 2), py(sb.y + sb.h / 2), pr(sb.w), pr(sb.h), 6);
  words(p, "STBY", px(sb.x), py(sb.y + sb.h / 2) - 14, 12, "#9aa1a8");
  const li = S.lights;
  recess(c, px(li.x - li.w / 2), py(li.y + li.h / 2), pr(li.w), pr(li.h), 3);

  // OUTBOARD OF THE PILOT: the clock and the start switch.
  const ck = { x: px(-0.45), y: py(0.31) };
  recess(c, ck.x - 46, ck.y - 30, 92, 60, 6);
  c.fillStyle = "#3a4a30";
  c.fillRect(ck.x - 38, ck.y - 20, 76, 40);
  words(p, "12:00", ck.x, ck.y, 24, "#cfe8a8");
  words(p, "CLOCK", ck.x, ck.y - 44, 11, "#9aa1a8");
  const st = { x: px(-0.45), y: py(0.2) };
  knob(c, st.x, st.y, 22);
  c.fillStyle = "#c9ccd0";
  c.fillRect(st.x - 3, st.y - 20, 6, 20);
  words(p, "OFF", st.x - 36, st.y - 18, 11);
  words(p, "IGN", st.x, st.y - 34, 11);
  words(p, "START", st.x + 40, st.y - 18, 11);

  // THE ROCKER SWITCHES along the foot under their labels.
  const sw = [
    "BAT",
    "GEN",
    "AVN",
    "F PUMP",
    "IGN",
    "NAV",
    "STROBE",
    "BCN",
    "LAND",
    "TAXI",
    "PITOT",
    "INST LT",
  ];
  sw.forEach((name, k) => {
    const x = px(-0.47 + k * 0.034);
    const y = py(0.055);
    c.fillStyle = "#121315";
    c.fillRect(x - 13, y - 20, 26, 40);
    c.fillStyle = k < 2 ? "#a3241c" : "#2c2e32";
    c.fillRect(x - 10, y - 17, 20, 18);
    c.fillStyle = "#1b1c1f";
    c.fillRect(x - 10, y + 1, 20, 16);
    words(p, name, x, y - 32, 10);
  });
  c.strokeStyle = INK;
  c.lineWidth = 1.5;
  c.strokeRect(px(-0.485), py(0.115), pr(0.105), pr(0.085));
  words(p, "MASTER", px(-0.4325), py(0.125), 9);

  // THE RADIOS on the right: the communication and navigation set, the
  // audio panel, the transponder.
  const rx = px(0.2);
  const unit = (y: number, h: number) => {
    const top = py(y);
    recess(c, rx, top, pr(0.27), pr(h), 4);
    return top;
  };
  let top = unit(0.395, 0.07);
  const seg = (x: number, y: number, s: string, col = "#ffb02e") => {
    c.fillStyle = "#050505";
    c.fillRect(x - 4, y - 16, s.length * 15 + 8, 32);
    c.fillStyle = col;
    c.font = `700 26px "DejaVu Sans Mono", monospace`;
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText(s, x, y);
  };
  seg(rx + 14, top + 28, "122.800");
  seg(rx + 150, top + 28, "121.500", "#7fd9ff");
  seg(rx + 14, top + 76, "114.30");
  seg(rx + 150, top + 76, "109.10", "#7fd9ff");
  knob(c, rx + pr(0.27) - 30, top + 52, 18);
  words(p, "COM", rx - 22, top + 28, 11);
  words(p, "NAV", rx - 22, top + 76, 11);
  top = unit(0.31, 0.035);
  ["COM1", "COM2", "NAV1", "MKR", "SPKR", "ICS"].forEach((k, i) => {
    const x = rx + 16 + i * 66;
    c.fillStyle = i === 0 ? "#2e4f2c" : "#232528";
    c.fillRect(x, top + 10, 54, 34);
    words(p, k, x + 27, top + 27, 12);
  });
  top = unit(0.26, 0.045);
  seg(rx + 16, top + 36, "7000", "#ffb02e");
  words(p, "ALT", rx + 120, top + 36, 13, "#9aa1a8");
  for (const [i, k] of ["IDENT", "VFR", "STBY"].entries()) {
    c.fillStyle = "#232528";
    c.fillRect(rx + 170 + i * 82, top + 20, 70, 32);
    words(p, k, rx + 205 + i * 82, top + 36, 12);
  }
  // The emergency beacon's switch and its placard.
  c.fillStyle = "#d8c022";
  c.fillRect(px(0.45) - 16, py(0.21) - 18, 32, 36);
  c.fillStyle = "#222";
  c.fillRect(px(0.45) - 4, py(0.21) - 26, 8, 26);
  words(p, "ELT", px(0.45), py(0.21) + 30, 11);
  // THE BREAKERS in two rows down the right.
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 9; k++) {
      const x = px(0.21 + k * 0.031);
      const y = py(0.135 - row * 0.06);
      c.fillStyle = "#0f1011";
      c.beginPath();
      c.arc(x, y, 12, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#e7e7e2";
      c.beginPath();
      c.arc(x, y, 7, 0, Math.PI * 2);
      c.fill();
      words(p, String([5, 5, 10, 15, 5, 10, 5, 20, 5][k]), x, y - 22, 10);
    }
  }
  words(p, "CIRCUIT BREAKERS — PULL TO OPEN", px(0.335), py(0.17), 11);

  // THE PLACARDS, in the plane's own words.
  const plate = (x: number, y: number, w: number, lines: string[], col = "#ecece6") => {
    c.fillStyle = "#121314";
    c.fillRect(px(x) - pr(w) / 2, py(y) - 10, pr(w), 18 * lines.length + 6);
    lines.forEach((l, i) => words(p, l, px(x), py(y) + i * 18, 12, col));
  };
  plate(-0.06, 0.043, 0.2, ["NEVER EXCEED 150 KT", "FLAPS EXTENDED 100 KT"]);
  plate(0.04, 0.418, 0.28, ["JUMP DOOR — SLIDE SHUT BELOW 500 M"], "#ffcf3a");
  plate(-0.29, 0.418, 0.18, ["NO SMOKING IN THE CABIN"]);
  words(p, "PROP", px(-0.075), py(0.012), 11);
  words(p, "POWER", px(-0.02), py(0.012), 11);
  words(p, "COND", px(0.035), py(0.012), 11);
}

// ── THE QUADRANT'S TOP PLATE ───────────────────────────────────────────

export const QUADRANT_W = 384;
export const QUADRANT_H = 256;

/** The quadrant's plate: the three slots, each lever's name and its stops,
 * and beside them the flap lever's slot and scale. Laid along z (the top
 * of the canvas forward) and across x (−0.12 to +0.14 m). */
export function paintQuadrant(c: Ctx, glow: Ctx | null): void {
  const p: Pair = { c, glow };
  if (glow) {
    glow.fillStyle = "#000";
    glow.fillRect(0, 0, QUADRANT_W, QUADRANT_H);
  }
  c.fillStyle = "#1c1d20";
  c.fillRect(0, 0, QUADRANT_W, QUADRANT_H);
  const xOf = (x: number) => ((x + 0.12) / 0.26) * QUADRANT_W;
  for (const x of [...PLANE_COCKPIT.levers.x, PLANE_COCKPIT.flapLever.x]) {
    c.fillStyle = "#050506";
    c.fillRect(xOf(x) - 6, 30, 12, QUADRANT_H - 60);
  }
  const [prop, power, cond] = PLANE_COCKPIT.levers.x;
  words(p, "MAX", xOf(power), 16, 13);
  words(p, "IDLE", xOf(power), QUADRANT_H - 18, 13);
  words(p, "FEATHER", xOf(prop) - 6, QUADRANT_H - 18, 11);
  words(p, "CUT", xOf(cond) + 6, QUADRANT_H - 18, 11);
  words(p, "FLAP", xOf(PLANE_COCKPIT.flapLever.x), 16, 13);
  ["40", "30", "20", "10", "0"].forEach((s, i) =>
    words(p, s, xOf(PLANE_COCKPIT.flapLever.x) + 30, 44 + i * 42, 13),
  );
}

// ── THE OVERHEAD CONSOLE ───────────────────────────────────────────────

export const OVERHEAD_W = 320;
export const OVERHEAD_H = 1024;

export function paintOverhead(c: Ctx, glow: Ctx | null): void {
  const p: Pair = { c, glow };
  if (glow) {
    glow.fillStyle = "#000";
    glow.fillRect(0, 0, OVERHEAD_W, OVERHEAD_H);
  }
  c.fillStyle = "#2a2c30";
  c.fillRect(0, 0, OVERHEAD_W, OVERHEAD_H);
  c.fillStyle = GREY;
  c.fillRect(8, 8, OVERHEAD_W - 16, OVERHEAD_H - 16);
  c.fillStyle = "#33363b";
  c.fillRect(14, 14, OVERHEAD_W - 28, OVERHEAD_H - 28);
  // The trim's scale beside its wheel (the wheel itself is built).
  words(p, "NOSE DN", OVERHEAD_W / 2, 70, 18);
  words(p, "TRIM", OVERHEAD_W / 2, 400, 20);
  words(p, "NOSE UP", OVERHEAD_W / 2, 600, 18);
  // The lights' switches and dimmers.
  for (const [i, s] of ["DOME", "PANEL", "FLOOD", "CABIN"].entries()) {
    const y = 700 + i * 72;
    c.fillStyle = "#111214";
    c.fillRect(54, y - 20, 34, 40);
    c.fillStyle = "#2a2c30";
    c.fillRect(60, y - 16, 22, 18);
    words(p, s, 190, y, 18, INK, "center");
  }
  words(p, "LIGHTS", OVERHEAD_W / 2, 650, 16, "#9aa1a8");
}
