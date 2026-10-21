// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COCKPIT'S FACES, PAINTED IN CODE (`heli-cockpit.ts` lays them on the
// panel, the pedestal and the overhead console) — canvas only, three-free.
//
// THE UPPER PANEL is laid out as the light utility helicopter's is, read
// from the pilot in the right seat: his flight instruments in front of him
// in two rows — the airspeed, the attitude and the altimeter over the turn
// coordinator, the heading (an HSI) and the climb — with the rotor and the
// power turbine's twin-needle tachometer and the radar altimeter outboard;
// in the middle, where both front seats read it, the engine display's two
// screens (the first limit indicator over the engine's page) under a row
// of caution lights; on the guide's side a moving map that is a terrain
// page, painted off the snow under the machine (the snow above the machine
// red, within a hundred feet of it amber, below it green and black), a
// clock and the outside air. THE PEDESTAL carries the radios, the
// navigator, the transponder and the audio panel; THE OVERHEAD the
// switches and the breakers. Every face is BACK (drawn once: the bezels,
// the scales, the words) and LIVE (drawn over it while the cockpit is in
// sight: the needles, the ball, the cards, the screens).

import { COCKPIT, type Gauges } from "./cockpit-plan.ts";
import {
  AMBER,
  attitudeBall,
  keys,
  knob,
  band,
  bezel,
  compassCard,
  deg,
  GREEN,
  hub,
  INK,
  label,
  needle,
  numbers,
  RED,
  ticks,
  type Ctx,
  window7,
} from "./dial-paint.ts";

/** THE PANEL'S CANVAS: px per metre and its size. */
export const PANEL_PX = 1280;
const P = COCKPIT.panel;
export const PANEL_W = Math.round(P.half * 2 * PANEL_PX);
export const PANEL_H = Math.round((P.top - P.bottom) * PANEL_PX);

/** A spot on the panel, m: across from its middle (right +) and up from
 * its foot — in px. */
const px = (x: number): number => (x + P.half) * PANEL_PX;
const py = (y: number): number => PANEL_H - y * PANEL_PX;
const pr = (m: number): number => m * PANEL_PX;

/** Where each instrument sits on the panel, m (its middle) and its
 * diameter or size. */
export const PANEL_LAYOUT = {
  asi: { x: 0.27, y: 0.245, d: 0.09 },
  att: { x: 0.385, y: 0.245, d: 0.104 },
  alt: { x: 0.5, y: 0.245, d: 0.09 },
  tach: { x: 0.612, y: 0.245, d: 0.09 },
  turn: { x: 0.27, y: 0.098, d: 0.084 },
  hsi: { x: 0.385, y: 0.098, d: 0.104 },
  vsi: { x: 0.5, y: 0.098, d: 0.09 },
  radar: { x: 0.612, y: 0.098, d: 0.084 },
  fli: { x: 0, y: 0.214, w: 0.17, h: 0.112 },
  eng: { x: 0, y: 0.084, w: 0.17, h: 0.112 },
  caution: { x: 0, y: 0.316, w: 0.25, h: 0.036 },
  map: { x: -0.37, y: 0.17, w: 0.21, h: 0.2 },
  clock: { x: -0.59, y: 0.245, d: 0.068 },
  oat: { x: -0.59, y: 0.098, d: 0.06 },
} as const;

/** The airspeed's angle, deg from the top: 0..160 kt over 20..340°. */
const asiAngle = (kt: number): number => 20 + Math.min(160, Math.max(0, kt)) * 2;
/** The climb's: ±2,000 ft/min either side of nine o'clock. */
const vsiAngle = (fpm: number): number => 270 + Math.max(-2000, Math.min(2000, fpm)) * 0.085;
/** The radar altimeter's: 0..500 ft over half its face, then to 2,500. */
const radarAngle = (ft: number): number =>
  ft <= 500 ? 20 + ft * 0.32 : 180 + Math.min(2000, ft - 500) * 0.07;
/** The tachometer's: 0..120 % over 30..330°. */
const tachAngle = (pct: number): number => 30 + Math.min(120, Math.max(0, pct)) * 2.5;

/** A round instrument's middle and radius on the panel, px. */
function at(k: { x: number; y: number; d: number }): [number, number, number] {
  return [px(k.x), py(k.y), pr(k.d / 2)];
}

/** A screen's box on the panel, px: left, top, width, height. */
function box(k: { x: number; y: number; w: number; h: number }): [number, number, number, number] {
  return [px(k.x - k.w / 2), py(k.y + k.h / 2), pr(k.w), pr(k.h)];
}

/** THE PANEL'S BACK: the painted metal, the bezels, every scale and word. */
export function paintPanelBack(c: Ctx): void {
  const L = PANEL_LAYOUT;
  // Satin black-grey panel with a faint brushed grain and its edge seams.
  const g = c.createLinearGradient(0, 0, 0, PANEL_H);
  g.addColorStop(0, "#26282b");
  g.addColorStop(1, "#1b1c1e");
  c.fillStyle = g;
  c.fillRect(0, 0, PANEL_W, PANEL_H);
  c.globalAlpha = 0.05;
  for (let i = 0; i < 260; i++) {
    c.fillStyle = i % 2 ? "#fff" : "#000";
    c.fillRect(0, (i * 7.3) % PANEL_H, PANEL_W, 1);
  }
  c.globalAlpha = 1;
  c.strokeStyle = "#0e0f10";
  c.lineWidth = 3;
  for (const x of [-0.13, 0.13, 0.23, -0.24]) {
    c.beginPath();
    c.moveTo(px(x), 4);
    c.lineTo(px(x), PANEL_H - 4);
    c.stroke();
  }
  c.strokeRect(3, 3, PANEL_W - 6, PANEL_H - 6);

  // AIRSPEED: knots, the green arc, the red line at the never-exceed.
  {
    const [x, y, r] = at(L.asi);
    bezel(c, x, y, r);
    band(c, x, y, r, asiAngle(20), asiAngle(120), GREEN);
    band(c, x, y, r, asiAngle(120), asiAngle(150), AMBER);
    band(c, x, y, r, asiAngle(150), asiAngle(153), RED);
    ticks(c, x, y, r, asiAngle(0), asiAngle(160), 32, 4);
    numbers(c, x, y, r, asiAngle(0), asiAngle(160), [
      "0",
      "",
      "40",
      "",
      "80",
      "",
      "120",
      "",
      "160",
    ]);
    label(c, x, y + r * 0.32, r * 0.14, "KNOTS");
    label(c, x, y - r * 0.28, r * 0.12, "AIRSPEED");
  }
  // ALTIMETER: thousands on a drum, hundreds round the face.
  {
    const [x, y, r] = at(L.alt);
    bezel(c, x, y, r);
    ticks(c, x, y, r, 0, 360, 50, 5);
    numbers(c, x, y, r, 0, 324, ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], 0.2);
    label(c, x, y + r * 0.42, r * 0.11, "ALT FT");
  }
  // CLIMB: thousands of feet a minute up and down.
  {
    const [x, y, r] = at(L.vsi);
    bezel(c, x, y, r);
    ticks(c, x, y, r, vsiAngle(-2000), vsiAngle(2000), 40, 5);
    c.fillStyle = INK;
    c.font = `bold ${Math.round(r * 0.18)}px sans-serif`;
    for (const v of [-2, -1, 0, 1, 2]) {
      const a = deg(vsiAngle(v * 1000));
      c.fillText(String(Math.abs(v)), x + Math.sin(a) * r * 0.6, y - Math.cos(a) * r * 0.6);
    }
    label(c, x + r * 0.15, y - r * 0.3, r * 0.11, "UP");
    label(c, x + r * 0.15, y + r * 0.3, r * 0.11, "DOWN");
    label(c, x + r * 0.32, y, r * 0.09, "1000 FT/MIN");
  }
  // ROTOR AND POWER TURBINE: the twin-needle tachometer.
  {
    const [x, y, r] = at(L.tach);
    bezel(c, x, y, r);
    band(c, x, y, r, tachAngle(95), tachAngle(105), GREEN);
    band(c, x, y, r, tachAngle(105), tachAngle(106), RED);
    band(c, x, y, r, tachAngle(80), tachAngle(95), AMBER);
    ticks(c, x, y, r, tachAngle(0), tachAngle(120), 24, 4);
    numbers(c, x, y, r, tachAngle(0), tachAngle(120), ["0", "20", "40", "60", "80", "100", "120"]);
    label(c, x - r * 0.28, y + r * 0.34, r * 0.13, "NR");
    label(c, x + r * 0.28, y + r * 0.34, r * 0.13, "NF");
    label(c, x, y + r * 0.6, r * 0.1, "% RPM");
  }
  // RADAR ALTIMETER: the drop under the skids.
  {
    const [x, y, r] = at(L.radar);
    bezel(c, x, y, r);
    band(c, x, y, r, radarAngle(0), radarAngle(50), AMBER);
    ticks(c, x, y, r, radarAngle(0), radarAngle(500), 10, 2);
    ticks(c, x, y, r, radarAngle(500), radarAngle(2500), 4, 1);
    c.fillStyle = INK;
    c.font = `bold ${Math.round(r * 0.17)}px sans-serif`;
    for (const v of [0, 100, 200, 300, 400, 500, 1000, 2000]) {
      if (v === 300 || v === 100) continue;
      const a = deg(radarAngle(v));
      const w = v >= 1000 ? `${v / 1000}K` : String(v / 100);
      c.fillText(w, x + Math.sin(a) * r * 0.6, y - Math.cos(a) * r * 0.6);
    }
    label(c, x, y + r * 0.38, r * 0.11, "RAD ALT");
  }
  // TURN COORDINATOR'S scale: the standard-rate marks.
  {
    const [x, y, r] = at(L.turn);
    bezel(c, x, y, r);
    c.strokeStyle = INK;
    c.lineWidth = r * 0.05;
    for (const a of [-110, -70, 70, 110]) {
      const s = Math.sin(deg(a));
      const k = Math.cos(deg(a));
      c.beginPath();
      c.moveTo(x + s * r * 0.72, y + k * r * 0.72);
      c.lineTo(x + s * r * 0.95, y + k * r * 0.95);
      c.stroke();
    }
    label(c, x - r * 0.62, y + r * 0.66, r * 0.14, "L");
    label(c, x + r * 0.62, y + r * 0.66, r * 0.14, "R");
    label(c, x, y - r * 0.55, r * 0.11, "TURN COORDINATOR");
    label(c, x, y + r * 0.83, r * 0.09, "2 MIN");
  }
  // THE BEZELS of the attitude and the HSI (their faces are live).
  for (const k of [L.att, L.hsi]) {
    const [x, y, r] = at(k);
    bezel(c, x, y, r);
  }
  // THE CLOCK and the OUTSIDE AIR.
  {
    const [x, y, r] = at(L.clock);
    bezel(c, x, y, r);
    ticks(c, x, y, r, 0, 330, 11, 1);
    numbers(c, x, y, r, 0, 330, ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
  }
  {
    const [x, y, r] = at(L.oat);
    bezel(c, x, y, r);
    ticks(c, x, y, r, 30, 330, 12, 3);
    numbers(c, x, y, r, 30, 330, ["-40", "-20", "0", "20", "40"], 0.2);
    label(c, x, y + r * 0.42, r * 0.15, "°C OAT");
  }
  // THE SCREENS' bezels.
  for (const k of [L.fli, L.eng, L.map]) {
    const [x, y, w, h] = box(k);
    c.fillStyle = "#111214";
    c.fillRect(x - 12, y - 12, w + 24, h + 24);
    c.fillStyle = "#050607";
    c.fillRect(x, y, w, h);
    // The buttons along the bezel's foot.
    c.fillStyle = "#3a3d41";
    for (let i = 0; i < 5; i++) c.fillRect(x + (w * (i + 0.5)) / 5 - 9, y + h + 3, 18, 6);
  }
  label(c, px(L.fli.x), py(L.fli.y + L.fli.h / 2) - 18, 14, "VEHICLE & ENGINE");
  // Placards.
  label(c, px(0.73), py(0.31), 13, "VNE 150 KT", AMBER);
  label(c, px(-0.73), py(0.31), 13, "DOORS OFF VNE 100", AMBER);
  label(c, px(0.73), py(0.03), 12, "MAX 4 PAX", INK);
}

/** THE ATTITUDE: the sky and the ground behind the fixed aircraft, the
 * horizon moved with the pitch and turned with the roll, the bank pointer
 * on its scale. */
function paintAttitude(c: Ctx, g: Gauges): void {
  attitudeBall(c, ...at(PANEL_LAYOUT.att), g);
}

/** THE HSI: the compass card turned to the heading under the lubber line. */
function paintHsi(c: Ctx, g: Gauges): void {
  compassCard(c, ...at(PANEL_LAYOUT.hsi), g);
}

/** THE TURN COORDINATOR'S live half: the little aircraft banked by the
 * turn's rate (standard rate, 3°/s, on the marks) and the ball. */
function paintTurn(c: Ctx, g: Gauges): void {
  const [x, y, r] = at(PANEL_LAYOUT.turn);
  // The ball's tube.
  c.fillStyle = "#d8dbd2";
  c.fillRect(x - r * 0.42, y + r * 0.42, r * 0.84, r * 0.17);
  c.fillStyle = "#111";
  c.fillRect(x - r * 0.09, y + r * 0.42, r * 0.02, r * 0.17);
  c.fillRect(x + r * 0.07, y + r * 0.42, r * 0.02, r * 0.17);
  c.beginPath();
  c.arc(x + g.slip * r * 0.33, y + r * 0.505, r * 0.075, 0, Math.PI * 2);
  c.fill();
  const bank = Math.max(-35, Math.min(35, (g.turn / 3) * 20));
  c.save();
  c.translate(x, y);
  c.rotate(deg(bank));
  c.fillStyle = INK;
  c.fillRect(-r * 0.7, -r * 0.04, r * 1.4, r * 0.08);
  c.beginPath();
  c.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  c.fill();
  c.fillRect(-r * 0.03, -r * 0.24, r * 0.06, r * 0.14);
  c.restore();
}

/** THE ENGINE DISPLAY: the first limit indicator, and the engine's page. */
function paintEngine(c: Ctx, g: Gauges): void {
  const L = PANEL_LAYOUT;
  for (const k of [L.fli, L.eng]) {
    const [x, y, w, h] = box(k);
    c.fillStyle = g.live ? "#030b14" : "#050607";
    c.fillRect(x, y, w, h);
  }
  if (!g.live) return;
  // FLI: the one needle for the engine's nearest limit, read in tenths.
  {
    const [x, y, w, h] = box(L.fli);
    const cx = x + w * 0.36;
    const cy = y + h * 0.58;
    const r = h * 0.42;
    const fli = Math.max(g.torque / 10, ((g.t4 - 400) / 380) * 10, ((g.ng - 60) / 40) * 10);
    const a = (v: number): number => -130 + Math.min(12, Math.max(0, v)) * 21.7;
    band(c, cx, cy, r, a(0), a(9.5), GREEN);
    band(c, cx, cy, r, a(9.5), a(10.3), AMBER);
    band(c, cx, cy, r, a(10.3), a(12), RED);
    c.strokeStyle = INK;
    ticks(c, cx, cy, r, a(0), a(12), 12, 2);
    numbers(c, cx, cy, r, a(0), a(12), ["0", "2", "4", "6", "8", "10", "12"], 0.2);
    needle(c, cx, cy, r, a(fli), 0.9, 0.05);
    hub(c, cx, cy, r);
    label(c, cx, cy + r * 0.45, r * 0.18, "FLI", GREEN);
    c.textAlign = "left";
    c.font = `bold ${Math.round(h * 0.12)}px monospace`;
    const rows: [string, string][] = [
      ["TRQ", `${g.torque.toFixed(0)}%`],
      ["T4", `${g.t4.toFixed(0)}`],
      ["NG", `${g.ng.toFixed(1)}`],
    ];
    rows.forEach(([k, v], i) => {
      c.fillStyle = "#7fd0ff";
      c.fillText(k, x + w * 0.7, y + h * (0.28 + i * 0.25));
      c.fillStyle = INK;
      c.fillText(v, x + w * 0.7, y + h * (0.4 + i * 0.25));
    });
  }
  // The engine's page: oil, fuel, the electrics and the outside air.
  {
    const [x, y, w, h] = box(L.eng);
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.font = `bold ${Math.round(h * 0.11)}px monospace`;
    const bar = (row: number, word: string, share: number, value: string): void => {
      const yy = y + h * (0.16 + row * 0.2);
      c.fillStyle = "#7fd0ff";
      c.fillText(word, x + w * 0.04, yy);
      c.fillStyle = "#1e2a36";
      c.fillRect(x + w * 0.32, yy - h * 0.04, w * 0.4, h * 0.08);
      c.fillStyle = GREEN;
      c.fillRect(x + w * 0.32, yy - h * 0.04, w * 0.4 * Math.max(0, Math.min(1, share)), h * 0.08);
      c.fillStyle = INK;
      c.fillText(value, x + w * 0.76, yy);
    };
    const oilP = 2.4 + g.ng * 0.02;
    const oilT = 40 + g.ng * 0.45;
    bar(0, "OIL P", oilP / 6, oilP.toFixed(1));
    bar(1, "OIL T", oilT / 120, oilT.toFixed(0));
    bar(2, "FUEL", g.fuel / 100, `${Math.round(g.fuel * 4.3)}KG`);
    bar(3, "VOLT", 0.7, "28.2");
    bar(4, "OAT", (g.oat + 40) / 80, `${g.oat.toFixed(0)}°`);
  }
}

/** THE CAUTION AND WARNING PANEL over the engine display: two rows of
 * square-cornered capsules, each legend engraved in the glass and readable
 * dim while it is out, lit red (a warning) or amber (a caution) behind
 * it when it is on — the rotor and the engine's oil and the gearbox's
 * warnings down with the rotor, the generator, the fuel pump and the
 * hydraulics with the engine, the first limit, the fuel low, and the
 * cabin's DOOR open while a skier is out on the skid. */
function paintCautions(c: Ctx, g: Gauges): void {
  const [x, y, w, h] = box(PANEL_LAYOUT.caution);
  const off = !g.live;
  const lights: [string, string, boolean, string][] = [
    ["ROTOR", "RPM", g.lowRotor, RED],
    ["ENG", "P", off, RED],
    ["XMSN", "P", off, RED],
    ["LIMIT", "", g.limit, AMBER],
    ["FUEL", "P", off, AMBER],
    ["GEN", "", off, AMBER],
    ["HYD", "", off, AMBER],
    ["LOW", "FUEL", g.fuel < 9, AMBER],
    ["DOOR", "", g.skid, AMBER],
    ["BATT", "TEMP", false, AMBER],
  ];
  // The bezel the capsules sit in.
  c.fillStyle = "#050506";
  c.fillRect(x - 3, y - 3, w + 6, h + 6);
  const cols = 5;
  const gap = 3;
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (h - gap) / 2;
  lights.forEach(([top, bottom, on, colour], i) => {
    const lx = x + (i % cols) * (cw + gap);
    const ly = y + Math.floor(i / cols) * (ch + gap);
    if (on) {
      const glow = c.createRadialGradient(
        lx + cw / 2,
        ly + ch / 2,
        1,
        lx + cw / 2,
        ly + ch / 2,
        cw * 0.7,
      );
      glow.addColorStop(0, "#fff6d8");
      glow.addColorStop(0.35, colour);
      glow.addColorStop(1, colour);
      c.fillStyle = glow;
    } else {
      c.fillStyle = colour === RED ? "#2a1514" : "#29230f";
    }
    c.fillRect(lx, ly, cw, ch);
    // The glass's sheen over its top.
    c.fillStyle = "rgba(255,255,255,0.06)";
    c.fillRect(lx, ly, cw, ch * 0.4);
    c.fillStyle = on ? "#141110" : colour === RED ? "#9a4a43" : "#9a8448";
    c.textAlign = "center";
    c.textBaseline = "middle";
    const lines = bottom ? [top, bottom] : [top];
    const size = Math.round(ch * (lines.length > 1 ? 0.36 : 0.44));
    c.font = `bold ${size}px sans-serif`;
    lines.forEach((word, k) => {
      const ty = ly + ch / 2 + (k - (lines.length - 1) / 2) * size * 1.05;
      c.fillText(word, lx + cw / 2, ty, cw - 6);
    });
  });
}

/** THE TERRAIN PAGE: the snow round the machine, heading up, painted
 * against its height — `height` the snow's height at a point ahead `f` m
 * and to the right `r` m of it, m over the sea. */
function paintMap(
  c: Ctx,
  g: Gauges,
  height: ((f: number, r: number) => number) | null,
  over: number,
): void {
  const [x, y, w, h] = box(PANEL_LAYOUT.map);
  c.fillStyle = "#020305";
  c.fillRect(x, y, w, h);
  if (!g.live) return;
  // The picture: a cell every `step` px, a kilometre across the screen.
  const range = 1000;
  const step = 8;
  if (height) {
    const me = { x: x + w / 2, y: y + h * 0.7 };
    // Near the snow the alerting is relaxed, as a helicopter's terrain
    // page is at the hover and on the pad: the ground it stands on is not
    // a warning — the bands lifted by as much as it is under 60 m up.
    const lift = Math.max(0, 60 - (over - height(0, 0)));
    for (let py0 = y; py0 < y + h; py0 += step) {
      for (let px0 = x; px0 < x + w; px0 += step) {
        const f = ((me.y - (py0 + step / 2)) / w) * range;
        const r = ((px0 + step / 2 - me.x) / w) * range;
        const d = height(f, r) - over - lift;
        c.fillStyle = d > -15 ? "#c0261c" : d > -30 ? "#d89a1a" : d > -150 ? "#1d6b2a" : "#0b2412";
        c.fillRect(px0, py0, step, step);
      }
    }
    // The range rings and the machine.
    c.strokeStyle = "rgba(220,230,240,0.6)";
    c.lineWidth = 2;
    for (const k of [0.25, 0.5]) {
      c.beginPath();
      c.arc(me.x, me.y, w * k, Math.PI, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(me.x, me.y - 14);
    c.lineTo(me.x - 9, me.y + 9);
    c.lineTo(me.x + 9, me.y + 9);
    c.closePath();
    c.fill();
  }
  c.fillStyle = "rgba(0,0,0,0.6)";
  c.fillRect(x, y, w, h * 0.12);
  c.fillStyle = INK;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.font = `bold ${Math.round(h * 0.07)}px monospace`;
  c.fillText(`GS ${Math.round(g.ias).toString().padStart(3)}KT`, x + 8, y + h * 0.06);
  c.fillText(
    `TRK ${String(Math.round(g.heading) % 360).padStart(3, "0")}°`,
    x + w * 0.52,
    y + h * 0.06,
  );
  c.fillStyle = AMBER;
  c.fillText("TERRAIN 1KM", x + 8, y + h * 0.95);
}

/** THE PANEL'S LIVE FACES over `back` (`paintPanelBack`'s canvas). */
export function paintPanelLive(
  c: Ctx,
  back: CanvasImageSource,
  g: Gauges,
  height: ((f: number, r: number) => number) | null,
  over: number,
  clockHours: number,
): void {
  const L = PANEL_LAYOUT;
  c.drawImage(back, 0, 0);
  {
    const [x, y, r] = at(L.asi);
    needle(c, x, y, r, asiAngle(g.ias), 0.88);
    hub(c, x, y, r);
  }
  {
    const [x, y, r] = at(L.alt);
    // The thousands on their drum, the hundreds' long needle, the ten
    // thousands' short one.
    const thousands = Math.floor(Math.max(0, g.alt) / 1000);
    c.fillStyle = "#000";
    c.fillRect(x - r * 0.42, y - r * 0.16, r * 0.44, r * 0.3);
    label(c, x - r * 0.2, y - r * 0.01, r * 0.24, String(thousands).padStart(2, "0"));
    needle(c, x, y, r, (g.alt / 10000) * 360, 0.5, 0.1);
    needle(c, x, y, r, ((g.alt % 1000) / 1000) * 360, 0.9);
    hub(c, x, y, r);
  }
  {
    const [x, y, r] = at(L.vsi);
    needle(c, x, y, r, vsiAngle(g.vsi), 0.88);
    hub(c, x, y, r);
  }
  {
    const [x, y, r] = at(L.tach);
    needle(c, x, y, r, tachAngle(g.nr), 0.9, 0.05);
    c.save();
    c.globalAlpha = 0.85;
    needle(c, x, y, r, tachAngle(g.nf), 0.62, 0.07);
    c.restore();
    hub(c, x, y, r);
  }
  {
    const [x, y, r] = at(L.radar);
    if (g.radar > 2500 || !g.live) {
      c.fillStyle = RED;
      c.fillRect(x - r * 0.25, y + r * 0.08, r * 0.5, r * 0.2);
      label(c, x, y + r * 0.18, r * 0.15, "OFF", "#fff");
      needle(c, x, y, r, radarAngle(2500) + 10, 0.85);
    } else needle(c, x, y, r, radarAngle(g.radar), 0.85);
    hub(c, x, y, r);
  }
  {
    const [x, y, r] = at(L.clock);
    needle(c, x, y, r, ((clockHours % 12) / 12) * 360, 0.5, 0.08);
    needle(c, x, y, r, (clockHours % 1) * 360, 0.82, 0.05);
    hub(c, x, y, r);
  }
  {
    const [x, y, r] = at(L.oat);
    needle(c, x, y, r, 30 + (Math.max(-40, Math.min(40, g.oat)) + 40) * 3.75, 0.82, 0.06);
    hub(c, x, y, r);
  }
  paintAttitude(c, g);
  paintHsi(c, g);
  paintTurn(c, g);
  paintEngine(c, g);
  paintCautions(c, g);
  paintMap(c, g, height, over);
}

/** THE PEDESTAL'S CANVAS: px per metre, and its size (its sloping face,
 * the panel's foot down to its knee). */
export const PEDESTAL_W = 384;
export const PEDESTAL_H = 1024;

/** Seven-segment-ish digits in a dark window. */
/** THE PEDESTAL'S FACE: the radio, the navigator, the transponder, the
 * audio panel and a row of switches — `live` the engine running (the
 * windows lit). */
export function paintPedestal(c: Ctx, live: boolean): void {
  const W = PEDESTAL_W;
  c.fillStyle = "#1d1e20";
  c.fillRect(0, 0, W, PEDESTAL_H);
  const unit = (y: number, h: number): void => {
    c.fillStyle = "#121314";
    c.fillRect(10, y, W - 20, h);
    c.strokeStyle = "#2c2e31";
    c.lineWidth = 3;
    c.strokeRect(10, y, W - 20, h);
  };
  // The audio panel.
  unit(16, 120);
  keys(c, 22, 30, W - 44, 40, ["COM1", "COM2", "NAV", "ICS", "SPKR"]);
  keys(c, 22, 82, W - 44, 40, ["PILOT", "CREW", "PAX", "MKR", "ISO"]);
  // The navigator: a screen and its knobs.
  unit(150, 300);
  c.fillStyle = live ? "#0a1a10" : "#050505";
  c.fillRect(30, 170, W - 130, 200);
  if (live) {
    c.fillStyle = "#57ff6e";
    c.font = "bold 26px monospace";
    c.textAlign = "left";
    c.textBaseline = "top";
    c.fillText("WPT  SUMMIT", 42, 182);
    c.fillText("DIS   4.2NM", 42, 222);
    c.fillText("DTK    018°", 42, 262);
    c.fillText("ETE    02:31", 42, 302);
  }
  knob(c, W - 60, 220, 26);
  knob(c, W - 60, 320, 30);
  keys(c, 30, 390, W - 60, 40, ["MSG", "OBS", "FPL", "PROC", "D>"]);
  // The radio: two frequencies.
  unit(466, 140);
  window7(c, 26, 490, 140, 44, "122.800", live);
  window7(c, 186, 490, 140, 44, "118.350", live);
  knob(c, 60, 572, 20);
  knob(c, W - 60, 572, 24);
  // The transponder.
  unit(620, 110);
  window7(c, 26, 642, 150, 44, "7000", live);
  keys(c, 186, 642, W - 210, 44, ["STBY", "ALT", "IDT"]);
  // A row of switches: the lights and the heating.
  unit(744, 260);
  const words = ["LDG LT", "SRCH", "DEMIST", "HEAT", "PITOT", "NAV"];
  words.forEach((word, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const sx = 64 + col * 120;
    const sy = 800 + row * 110;
    c.fillStyle = "#cfd2cc";
    c.font = "bold 20px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(word, sx, sy - 34);
    knob(c, sx, sy + 12, 16);
  });
}

/** THE OVERHEAD'S CANVAS (its face, from the windscreen end aft). */
export const OVERHEAD_W = 384;
export const OVERHEAD_H = 1024;

/** THE OVERHEAD CONSOLE: the electrical master switches and the rows of
 * circuit breakers, every one with its word. */
export function paintOverhead(c: Ctx): void {
  const W = OVERHEAD_W;
  c.fillStyle = "#202124";
  c.fillRect(0, 0, W, OVERHEAD_H);
  c.strokeStyle = "#0d0e0f";
  c.lineWidth = 4;
  c.strokeRect(4, 4, W - 8, OVERHEAD_H - 8);
  c.textAlign = "center";
  c.textBaseline = "middle";
  // The masters, near the windscreen where the hand reaches first.
  const masters = ["BAT", "GEN", "AVIONICS", "HORN", "CRANK", "EMER"];
  masters.forEach((word, i) => {
    const sx = 54 + (i % 3) * 138;
    const sy = 80 + Math.floor(i / 3) * 110;
    c.fillStyle = "#cfd2cc";
    c.font = "bold 22px sans-serif";
    c.fillText(word, sx, sy - 38);
    c.fillStyle = "#0b0c0d";
    c.fillRect(sx - 18, sy - 18, 36, 46);
    c.fillStyle = word === "EMER" || word === "CRANK" ? "#b2241c" : "#d9dbd4";
    c.fillRect(sx - 8, sy - 28, 16, 40);
  });
  // The breakers.
  const breakers = [
    "FUEL P",
    "HYD",
    "NR",
    "NG",
    "T4",
    "TRQ",
    "ENG DSP",
    "GPS",
    "COM1",
    "COM2",
    "XPDR",
    "ICS",
    "ATT",
    "HSI",
    "PITOT",
    "WIPER",
    "BEACON",
    "STROBE",
    "LDG",
    "NAV LT",
    "INST LT",
    "CABIN",
    "HOOK",
    "HORN",
  ];
  c.font = "bold 16px sans-serif";
  breakers.forEach((word, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const sx = 50 + col * 95;
    const sy = 330 + row * 108;
    c.fillStyle = "#b9bcb4";
    c.fillText(word, sx, sy - 32);
    c.fillStyle = "#0b0b0c";
    c.beginPath();
    c.arc(sx, sy, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#e7e9e1";
    c.lineWidth = 4;
    c.beginPath();
    c.arc(sx, sy, 13, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#c0c0b8";
    c.fillText(String(i % 3 === 0 ? 5 : i % 3 === 1 ? 3 : 7.5), sx, sy + 34);
  });
}
