#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Generates the PWA install icons and the favicon from the same geometry
// as pwa/public/icons/icon.svg — THE CARVE OFF THE PEAK: a faceted mountain
// on a night tile (the shadow face, the lit face, a lower shoulder and a
// blade of alpenglow under the summit) with a pair of carved ski tracks in
// the flag's red swinging down the lit face in an S. Pure Node (the
// framework's shared tooling/png.mjs encoder), so the pipeline needs no
// native image dependencies.
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
const NIGHT = [10, 23, 38]; // #0a1726 night
const DUSK = [22, 48, 79]; // #16304f dusk
const SNOW = [244, 248, 251]; // #f4f8fb snow
const SHADOW = [185, 205, 224]; // #b9cde0 snowShadow
const SHOULDER = [219, 230, 241]; // #dbe6f1 the lit snow a step toward its shadow (app-mark.ts)
const GLOW = [255, 178, 122]; // #ffb27a alpenglow
const FLAG = [224, 51, 43]; // #e0332b flag

// --- geometry in the SVG's 512-unit space -----------------------------------
// The facets, top of the painting order LAST, exactly as the SVG lists
// them: the whole silhouette in the shadow's blue, the lit face over it, the
// shoulder, the alpenglow's blade.
const FACETS = [
  {
    color: SHADOW,
    poly: [
      [296, 84],
      [512, 232],
      [512, 512],
      [0, 512],
      [0, 350],
      [140, 214],
    ],
  },
  {
    color: SNOW,
    poly: [
      [296, 84],
      [440, 512],
      [96, 512],
      [140, 214],
    ],
  },
  {
    color: SHOULDER,
    poly: [
      [140, 214],
      [96, 512],
      [0, 512],
      [0, 350],
    ],
  },
  {
    color: GLOW,
    poly: [
      [296, 84],
      [415, 165],
      [407, 177],
    ],
  },
];

// Each track is two circular arcs about a spine joined tangentially where
// the first bend gives way to the second. The turn REVERSES there — the
// second's centre is on the first's radial through that point but on the
// far side of it — so a track at radius +d on the first bend is at −d on
// the second. The first bend's sweep starts above the +x axis, so its range
// is stated negative and a sampled angle is folded back under `to` before
// the test.
const TRACK_W = 9.5; // half width of one track
const ARCS = [
  { cx: 211.36, cy: 200.5, r: 92, from: -52, to: 60 },
  { cx: 377.36, cy: 488.02, r: 240, from: 182, to: 240 },
];
// The two tracks, 36 apart about the spine: the outer one 18 out on the
// first bend — and so 18 in on the second.
const LINES = [
  { offsets: [18, -18], color: FLAG },
  { offsets: [-18, 18], color: FLAG },
];
// Round caps at each track's two ends, so a stroke does not end on a chisel.
const CAPS = [
  { arc: 0, deg: -52 },
  { arc: 1, deg: 182 },
];

/** The tile's night: a vertical gradient from the night overhead to the
 * dusk at the foot. */
function skyAt(v) {
  const t = Math.max(0, Math.min(1, v));
  return [
    NIGHT[0] + (DUSK[0] - NIGHT[0]) * t,
    NIGHT[1] + (DUSK[1] - NIGHT[1]) * t,
    NIGHT[2] + (DUSK[2] - NIGHT[2]) * t,
  ];
}

/** Is 512-space point (x, y) inside the polygon `poly`? (Even–odd.) */
function inPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Is 512-space point (x, y) on one of the tracks? Returns its colour. */
function trackAt(x, y, lines = LINES, halfWidth = TRACK_W) {
  for (let a = 0; a < ARCS.length; a++) {
    const arc = ARCS[a];
    const r = Math.hypot(x - arc.cx, y - arc.cy);
    let deg = (Math.atan2(y - arc.cy, x - arc.cx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (deg > arc.to) deg -= 360;
    if (deg < arc.from || deg > arc.to) continue;
    for (const line of lines) {
      if (Math.abs(r - (arc.r + line.offsets[a])) <= halfWidth) return line.color;
    }
  }
  for (const cap of CAPS) {
    const arc = ARCS[cap.arc];
    const a = (cap.deg * Math.PI) / 180;
    for (const line of lines) {
      const rr = arc.r + line.offsets[cap.arc];
      const cx = arc.cx + rr * Math.cos(a);
      const cy = arc.cy + rr * Math.sin(a);
      if (Math.hypot(x - cx, y - cy) <= halfWidth) return line.color;
    }
  }
  return null;
}

/** THE FAVICON'S ONE RIBBON. At sixteen pixels the pair of tracks is a
 * pixel and a half each with a pixel of snow between, and averaged that is a
 * pink smear; drawn as one ribbon over the pair's whole width (the spine,
 * out to both tracks' outer edges) it is two solid pixels of red, which is
 * the mark at that size. Only the 16 is drawn so. */
const RIBBON = [{ offsets: [0, 0], color: FLAG }];
const RIBBON_W = 18 + TRACK_W;

/** Off the square's sides — only a maskable icon's padding reaches there —
 * the two skylines run on down at their own slopes, the shoulder's to the
 * left and the shadow face's to the right, so the mountain does not end on
 * a shelf at the square's edge. */
const APRONS = [
  {
    color: SHOULDER,
    poly: [
      [0, 350],
      [-200, 544],
      [-200, 900],
      [0, 900],
    ],
  },
  {
    color: SHADOW,
    poly: [
      [512, 232],
      [712, 369],
      [712, 900],
      [512, 900],
    ],
  },
];

/** Color of the mark at 512-space point (x, y), or null for the sky. Below
 * the square a point takes the facet on its foot, and beside it an apron. */
function markAt(x, y, small = false) {
  // The SVG's painting order read backwards: the tracks over the facets.
  const track = small ? trackAt(x, y, RIBBON, RIBBON_W) : trackAt(x, y);
  if (track) return track;
  if (x < 0 || x >= 512) {
    for (const apron of APRONS) if (inPolygon(apron.poly, x, y)) return apron.color;
    return null;
  }
  const fy = Math.min(511.99, y);
  for (let i = FACETS.length - 1; i >= 0; i--) {
    if (inPolygon(FACETS[i].poly, x, fy)) return FACETS[i].color;
  }
  return null;
}

/** Where inside a pixel the renderers sample — a 4x4 supersample, so the
 * edges are soft rather than staircased even at the favicon's sixteen
 * pixels, where a track is a pixel and a half wide. */
const SAMPLES = [];
for (let j = 0; j < 4; j++)
  for (let i = 0; i < 4; i++) SAMPLES.push([(i + 0.5) / 4, (j + 0.5) / 4]);

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
        const mark = markAt(px, py, size <= 16);
        const c = mark ?? skyAt(v);
        r += c[0];
        g += c[1];
        b += c[2];
      }
      const o = (y * size + x) * 3;
      rgb[o] = r / SAMPLES.length;
      rgb[o + 1] = g / SAMPLES.length;
      rgb[o + 2] = b / SAMPLES.length;
    }
  }
  return encodePng(size, size, rgb);
}

/** Wrap PNGs in one ICO container (valid since Vista), one entry a size —
 * the browser picks the one nearest the tab's own pixels, so the sixteen is
 * drawn at sixteen rather than squeezed out of the thirty-two. */
function pngsToIco(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4); // count
  let offset = header.length;
  images.forEach(({ png, size }, i) => {
    const e = 6 + 16 * i;
    header[e] = size < 256 ? size : 0;
    header[e + 1] = size < 256 ? size : 0;
    header.writeUInt16LE(1, e + 4); // planes
    header.writeUInt16LE(32, e + 6); // bpp
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((im) => im.png)]);
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
writeFileSync(
  join(root, "pwa", "public", "favicon.ico"),
  pngsToIco([
    { png: renderIcon(16), size: 16 },
    { png: renderIcon(32), size: 32 },
  ]),
);

console.log("icons: icon-1024, pwa-192, pwa-512, pwa-512-maskable, apple-touch-180, favicon.ico");
