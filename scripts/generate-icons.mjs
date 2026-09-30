#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Generates the PWA install icons and the favicon from the same geometry
// as pwa/public/icons/icon.svg — a pair of carved ski tracks coming down off
// a peak: a white mountain under a clear sky with a shadowed ridge behind
// it, the two parallel tracks starting just under the summit and swinging
// down the face in an S toward the lower left, and a red slalom gate
// standing on the face beside them. Pure Node (the framework's shared
// tooling/png.mjs encoder), so the pipeline needs no native image
// dependencies.
// Rerun with `npm run icons` / `make icons` after changing the mark, and keep
// icon.svg and pwa/src/game/app-mark.ts in lockstep.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { encodePng } from "@niclaslindstedt/oss-game-framework/tooling/png";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "pwa", "public", "icons");
mkdirSync(iconsDir, { recursive: true });

// Palette — mirrors PALETTE in pwa/src/identity.ts and the SVG's fills.
const SKY_TOP = [111, 168, 220]; // #6fa8dc skyHigh
const SKY_BOT = [207, 230, 247]; // #cfe6f7 sky
const SNOW = [244, 248, 251]; // #f4f8fb snow
const RIDGE = [185, 205, 224]; // #b9cde0 snowShadow
const TRACK = [111, 168, 220]; // #6fa8dc skyHigh
const FLAG = [224, 51, 43]; // #e0332b flag
const INK = [13, 34, 51]; // #0d2233 hudShadow

// --- geometry in the SVG's 512-unit space -----------------------------------
// The ground: the ridge behind and the peak in front, each a triangle whose
// upper edges are the skyline (the feet stand off the tile, so only the
// summit and the two faces show).
const RIDGE_PEAK = [
  [118, 228],
  [-260, 512],
  [440, 512],
];
const PEAK = [
  [330, 100],
  [-120, 512],
  [780, 512],
];

// Each track is two circular arcs joined tangentially where the first bend
// gives way to the second (206.05, 347.72 on the outer track). The turn
// REVERSES there — the second's centre is on the first's radial through that
// point but on the far side of it — so a track at radius +d on the first
// bend is at −d on the second. The first bend's sweep starts above the
// +x axis, so its range is stated negative and a sampled angle is folded
// back under `to` before the test.
const TRACK_W = 11; // half width of one track
const ARCS = [
  { cx: 180, cy: 200, r: 150, from: -20, to: 80 },
  { cx: 228.62, cy: 475.75, r: 130, from: 205, to: 260 },
];
// The two tracks: the outer one on the spine, the inner one 36 in from it on
// the first bend — and so 36 OUT from it on the second.
const LINES = [
  { offsets: [0, 0], color: TRACK },
  { offsets: [-36, 36], color: TRACK },
];
// Round caps at each track's two ends, so a stroke does not end on a chisel.
const CAPS = [
  { arc: 0, deg: -20 },
  { arc: 1, deg: 205 },
];

// The gate: a pole and a slalom panel, as the SVG's two rects.
const POLE = { x0: 440, y0: 222, x1: 450, y1: 340 };
const PANEL = { x0: 372, y0: 224, x1: 440, y1: 270 };

function skyAt(v) {
  const t = Math.max(0, Math.min(1, v));
  return [
    SKY_TOP[0] + (SKY_BOT[0] - SKY_TOP[0]) * t,
    SKY_TOP[1] + (SKY_BOT[1] - SKY_TOP[1]) * t,
    SKY_TOP[2] + (SKY_BOT[2] - SKY_TOP[2]) * t,
  ];
}

/** Is 512-space point (x, y) inside the triangle `tri`? */
function inTriangle(tri, x, y) {
  let sign = 0;
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = tri[i];
    const [bx, by] = tri[(i + 1) % 3];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Is 512-space point (x, y) on one of the tracks? Returns its colour. */
function trackAt(x, y) {
  for (let a = 0; a < ARCS.length; a++) {
    const arc = ARCS[a];
    const r = Math.hypot(x - arc.cx, y - arc.cy);
    let deg = (Math.atan2(y - arc.cy, x - arc.cx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (deg > arc.to) deg -= 360;
    if (deg < arc.from || deg > arc.to) continue;
    for (const line of LINES) {
      if (Math.abs(r - (arc.r + line.offsets[a])) <= TRACK_W) return line.color;
    }
  }
  for (const cap of CAPS) {
    const arc = ARCS[cap.arc];
    const a = (cap.deg * Math.PI) / 180;
    for (const line of LINES) {
      const rr = arc.r + line.offsets[cap.arc];
      const cx = arc.cx + rr * Math.cos(a);
      const cy = arc.cy + rr * Math.sin(a);
      if (Math.hypot(x - cx, y - cy) <= TRACK_W) return line.color;
    }
  }
  return null;
}

/** Is 512-space point (x, y) inside the axis-aligned box `b`? */
function inBox(b, x, y) {
  return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}

/** Color of the mark at 512-space point (x, y), or null for the sky. */
function markAt(x, y) {
  // Top to bottom of the SVG's painting order, read backwards: the gate over
  // the tracks over the peak over the ridge.
  if (inBox(PANEL, x, y)) return FLAG;
  if (inBox(POLE, x, y)) return INK;
  const track = trackAt(x, y);
  if (track) return track;
  if (inTriangle(PEAK, x, y)) return SNOW;
  if (inTriangle(RIDGE_PEAK, x, y)) return RIDGE;
  return null;
}

/** Where inside a pixel the renderers sample — a 2x2 supersample, for edges
 * that are soft rather than staircased. */
const SAMPLES = [
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];

/** Render the mark at `size`, with the geometry scaled by `inset` toward the
 * center (maskable icons keep the mark inside the safe zone). */
function renderIcon(size, inset = 1) {
  const rgb = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [ox, oy] of SAMPLES) {
        const u = ((x + ox) / size - 0.5) / inset + 0.5;
        const v = ((y + oy) / size - 0.5) / inset + 0.5;
        const px = u * 512;
        const py = v * 512;
        const mark = px >= 0 && px < 512 && py >= 0 && py < 512 ? markAt(px, py) : null;
        const c = mark ?? skyAt(v);
        r += c[0];
        g += c[1];
        b += c[2];
      }
      const o = (y * size + x) * 3;
      rgb[o] = r / 4;
      rgb[o + 1] = g / 4;
      rgb[o + 2] = b / 4;
    }
  }
  return encodePng(size, size, rgb);
}

/** Wrap one PNG in an ICO container (valid since Vista). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  header[6] = size < 256 ? size : 0;
  header[7] = size < 256 ? size : 0;
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
}

// THE MASTER RASTER — the mark at the largest size any store asks for, and
// the one file the SHELLS will derive their own icon sets from when they
// arrive (a shell imports the core, never another shell, so the
// full-resolution mark lives here, in the website's own icon directory,
// where both of them will look). Not in the manifest: nothing serves it to a
// browser, and an install icon above 512 buys nothing.
writeFileSync(join(iconsDir, "icon-1024.png"), renderIcon(1024));
writeFileSync(join(iconsDir, "pwa-192.png"), renderIcon(192));
writeFileSync(join(iconsDir, "pwa-512.png"), renderIcon(512));
writeFileSync(join(iconsDir, "pwa-512-maskable.png"), renderIcon(512, 0.78));
writeFileSync(join(iconsDir, "apple-touch-icon-180.png"), renderIcon(180));
writeFileSync(join(root, "pwa", "public", "favicon.ico"), pngToIco(renderIcon(32), 32));

console.log("icons: icon-1024, pwa-192, pwa-512, pwa-512-maskable, apple-touch-180, favicon.ico");
