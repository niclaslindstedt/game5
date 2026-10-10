// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AMATEURS' SIGN AT A SKI ROUTE AS DRAWN — the boards `route-sign-plan.ts`
// stands at the head of every orange route, built for `gates.ts` beside the
// ski area's own signs (`run-signs.ts`).
//
// A SCRAP OF PLANK NAILED TO A STICK: the board is its hacked outline
// (`AmateurSign.outline`) given a thickness, its face printed into one small
// atlas — wood gone silver in the weather, the grain opened into checks,
// two nails and the rust run down from them where the stick is behind it —
// and over that the PAINT the locals brushed on: the point dipped in the
// route's orange, two lopsided orange diamonds at the tail, and the words in
// black between them, letter by letter in a quick hand that never sits on
// one line, a drip or two run down from the heaviest strokes; and all of it
// weathered: flaked back to the wood in spots, thinnest where the brush ran
// dry. The stick is unbarked pine, tapered, knocked in on a lean, the stub
// of a branch left on it.
//
// LIT AS WOOD IS LIT: nothing glows. The print is the albedo and, read
// again as data, the bump, so the paint stands a hair proud of the grain
// and the checks sink into it under a raking sun or a headlamp.

import * as THREE from "three";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Level } from "@engine";

import { GRADE_LOOK } from "./grade-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { AMATEUR, amateurSigns, type AmateurSign } from "./route-sign-plan.ts";
import { SIGN_FALLBACK, SIGN_LOOKS } from "./sign-look.ts";
import { STRINGS } from "./strings.ts";

/** The print's scale, px per metre, and the margin round the board's
 * outline in its cell, m. */
const PX = 560;
const MARGIN = 0.04;

/** Weathered timber: the silver it goes, the brown under it, the grain and
 * the checks, the end grain and the back. */
const WOOD = {
  silver: "#b3a58e",
  light: "#cfc4ae",
  brown: "#82654a",
  grain: "#574a3c",
  check: "#2b2219",
  edge: "#8a7f70",
  bark: "#5e4c3b",
  barkDark: "#2f251c",
  cut: "#c9b48e",
};

/** The paints: the route's own orange out of a tin, and black. */
const PAINT = { orange: GRADE_LOOK.orange.paint, black: "#17130f" };

/** The hand the words are brushed in — a quick marker's, whatever the
 * country: the locals did not go to the sign shop. */
const HAND = SIGN_LOOKS.maritime;

let handLoaded: Promise<boolean> | null = null;
function loadHand(): Promise<boolean> {
  handLoaded ??=
    typeof FontFace === "undefined"
      ? Promise.resolve(false)
      : new FontFace(HAND.family, `url(${HAND.url})`).load().then(
          (face) => {
            document.fonts.add(face);
            return true;
          },
          () => false,
        );
  return handLoaded;
}

/** The board's outline in VIEW coordinates (x across the reader's view,
 * to his right): the plan's, mirrored for a board pointing left. */
function viewOutline(s: AmateurSign): [number, number][] {
  if (s.point === "right") return s.outline;
  return s.outline.map(([x, y]) => [-x, y] as [number, number]).reverse();
}

/** The box round a board's view outline, m. */
function boxOf(pts: readonly [number, number][]): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0: x0 - MARGIN, y0: y0 - MARGIN, x1: x1 + MARGIN, y1: y1 + MARGIN };
}

type Cell = { ox: number; oy: number; w: number; h: number; box: ReturnType<typeof boxOf> };

/** View metres → the cell's pixels. */
const px = (c: Cell, x: number, y: number): [number, number] => [
  c.ox + (x - c.box.x0) * PX,
  c.oy + (c.box.y1 - y) * PX,
];

/** The weathered plank under the paint. */
function weathered(g: CanvasRenderingContext2D, c: Cell, rng: Rng): void {
  g.fillStyle = WOOD.silver;
  g.fillRect(c.ox, c.oy, c.w, c.h);
  // Brown where the weather has not got to it yet, in long smears.
  for (let i = 0; i < 9; i++) {
    g.globalAlpha = rng.range(0.15, 0.4);
    g.fillStyle = WOOD.brown;
    const y = c.oy + rng.range(0, c.h);
    g.beginPath();
    g.ellipse(c.ox + rng.range(0, c.w), y, rng.range(60, 220), rng.range(4, 14), 0, 0, Math.PI * 2);
    g.fill();
  }
  // Bleached streaks where the sun gets the most.
  for (let i = 0; i < 14; i++) {
    g.globalAlpha = rng.range(0.15, 0.35);
    g.fillStyle = WOOD.light;
    g.fillRect(
      c.ox + rng.range(-40, c.w),
      c.oy + rng.range(0, c.h),
      rng.range(80, 300),
      rng.range(2, 7),
    );
  }
  // The grain, long and wavering along the board.
  g.strokeStyle = WOOD.grain;
  for (let i = 0; i < 46; i++) {
    const y = c.oy + rng.range(-4, c.h + 4);
    const amp = rng.range(0.5, 3);
    const len = rng.range(40, 140);
    const ph = rng.range(0, Math.PI * 2);
    g.globalAlpha = rng.range(0.15, 0.55);
    g.lineWidth = rng.range(0.5, 2);
    g.beginPath();
    for (let x = 0; x <= c.w; x += 6) {
      const yy = y + Math.sin(x / len + ph) * amp;
      if (x === 0) g.moveTo(c.ox + x, yy);
      else g.lineTo(c.ox + x, yy);
    }
    g.stroke();
  }
  // Checks: the grain split open, dark, tapering at both ends.
  g.strokeStyle = WOOD.check;
  for (let i = 0; i < 5; i++) {
    const x = c.ox + rng.range(0, c.w * 0.8);
    const y = c.oy + rng.range(c.h * 0.15, c.h * 0.85);
    const len = rng.range(40, 180);
    for (let k = 0; k < 3; k++) {
      g.globalAlpha = 0.5 - k * 0.12;
      g.lineWidth = 2.2 - k * 0.6;
      g.beginPath();
      g.moveTo(x + k * len * 0.12, y);
      g.quadraticCurveTo(
        x + len / 2,
        y + rng.range(-2, 2),
        x + len - k * len * 0.12,
        y + rng.range(-1, 1),
      );
      g.stroke();
    }
  }
  // A knot.
  const kx = c.ox + rng.range(c.w * 0.3, c.w * 0.7);
  const ky = c.oy + rng.range(c.h * 0.2, c.h * 0.8);
  for (let r = 1; r <= 3; r++) {
    g.globalAlpha = 0.55 / r;
    g.lineWidth = r === 1 ? 4 : 1.2;
    g.strokeStyle = WOOD.check;
    g.beginPath();
    g.ellipse(kx, ky, 3 + r * 5, 2 + r * 2, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** A brushed stroke: `path` laid down in a few passes, each a little off
 * the last and thinner, so its edge is ragged and the wood shows where the
 * brush ran dry. */
function brushed(
  g: CanvasRenderingContext2D,
  rng: Rng,
  colour: string,
  width: number,
  path: (j: () => number) => void,
): void {
  g.save();
  g.strokeStyle = g.fillStyle = colour;
  g.lineCap = g.lineJoin = "round";
  for (let k = 0; k < 4; k++) {
    g.globalAlpha = k === 0 ? 0.95 : 0.4;
    g.lineWidth = width * (1 - k * 0.18);
    const j = (): number => rng.range(-width * 0.12, width * 0.12);
    g.beginPath();
    path(j);
    g.stroke();
  }
  g.restore();
}

/** The paint the locals put on, on its own layer so the weather can take
 * it back. */
function painted(
  p: CanvasRenderingContext2D,
  c: Cell,
  s: AmateurSign,
  pts: readonly [number, number][],
  rng: Rng,
  font: string,
): void {
  const dir = s.point === "right" ? 1 : -1;
  const hw = AMATEUR.board.width / 2;
  const hh = AMATEUR.board.height / 2;
  // THE POINT DIPPED IN ORANGE: everything past a ragged line just short
  // of the shoulder, the brush's edge wandering.
  p.save();
  p.beginPath();
  pts.forEach(([x, y], i) => {
    const [u, v] = px(c, x, y);
    if (i === 0) p.moveTo(u, v);
    else p.lineTo(u, v);
  });
  p.closePath();
  p.clip();
  p.fillStyle = PAINT.orange;
  p.beginPath();
  const edge = hw - 0.09;
  const steps = 40;
  const phase = rng.range(0, Math.PI * 2);
  const [, top] = px(c, 0, hh + 0.05);
  const [, foot] = px(c, 0, -hh - 0.05);
  const far = px(c, dir * (hw + AMATEUR.tip * 1.3), 0)[0];
  for (let k = 0; k <= steps; k++) {
    const y = hh + 0.05 - ((2 * hh + 0.1) * k) / steps;
    const [u, v] = px(
      c,
      dir * (edge + rng.range(-0.004, 0.004) + Math.sin(k * 0.9 + phase) * 0.008),
      y,
    );
    if (k === 0) p.moveTo(far, top);
    p.lineTo(u, v);
  }
  p.lineTo(far, foot);
  p.closePath();
  p.fill();
  // The brush dragged on past where it was meant to stop, running dry.
  p.strokeStyle = PAINT.orange;
  p.lineCap = "round";
  for (let k = 0; k < 26; k++) {
    const y = rng.range(-hh, hh);
    const [ua, v] = px(c, dir * (edge + 0.004), y);
    const [ub] = px(c, dir * (edge - rng.range(0.008, 0.05)), y);
    p.globalAlpha = rng.range(0.35, 0.8);
    p.lineWidth = rng.range(1.2, 3.5);
    p.beginPath();
    p.moveTo(ua, v);
    p.lineTo(ub, v + rng.range(-1.5, 1.5));
    p.stroke();
  }
  p.restore();

  // TWO DIAMONDS at the tail, a stroke each round and filled, not square
  // to each other or the board.
  const size = AMATEUR.board.height * 0.32;
  for (let k = 0; k < 2; k++) {
    const cx = -dir * (hw - 0.07 - k * size * 1.55) + rng.range(-0.006, 0.006);
    const cy = rng.range(-0.012, 0.012);
    const turn = rng.range(-0.18, 0.18);
    const corner = (a: number, r: number): [number, number] =>
      px(c, cx + Math.sin(a + turn) * r * 0.82, cy + Math.cos(a + turn) * r);
    const ring = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) =>
      corner(a, size * rng.range(0.92, 1.06)),
    );
    p.fillStyle = PAINT.orange;
    p.beginPath();
    ring.forEach(([u, v], i) => (i === 0 ? p.moveTo(u, v) : p.lineTo(u, v)));
    p.closePath();
    p.fill();
    brushed(p, rng, PAINT.orange, 5, (j) => {
      ring.forEach(([u, v], i) =>
        i === 0 ? p.moveTo(u + j(), v + j()) : p.lineTo(u + j(), v + j()),
      );
      p.closePath();
    });
  }

  // THE WORDS, between the diamonds and the dipped point, each letter on
  // its own wobble, the line climbing or sagging as the hand went.
  const text = STRINGS.skiRouteAmateur.toUpperCase();
  const lo = -dir * (hw - 0.07 - size * 1.55) + dir * (size * 0.9 + 0.03);
  const hi = dir * (edge - 0.05);
  const [u0] = px(c, Math.min(lo, hi), 0);
  const [u1] = px(c, Math.max(lo, hi), 0);
  const room = u1 - u0;
  let fontPx = AMATEUR.board.height * PX * 0.62;
  p.font = `${fontPx}px ${font}`;
  const width = p.measureText(text).width;
  fontPx *= Math.min(1, (room * 0.96) / Math.max(1, width));
  p.font = `${fontPx}px ${font}`;
  const total = p.measureText(text).width;
  const [, vMid] = px(c, 0, 0);
  const sag = rng.range(-0.08, 0.08) * fontPx;
  p.textBaseline = "middle";
  p.textAlign = "left";
  let u = u0 + (room - total) / 2;
  const chars = [...text];
  chars.forEach((ch, i) => {
    const w = p.measureText(ch).width;
    const t = chars.length > 1 ? i / (chars.length - 1) : 0;
    const v = vMid + sag * (t * 2 - 1) + rng.range(-0.05, 0.05) * fontPx;
    const scale = rng.range(0.9, 1.08);
    p.save();
    p.translate(u + w / 2, v);
    p.rotate(rng.range(-0.06, 0.06));
    p.scale(scale, scale * rng.range(0.94, 1.08));
    p.fillStyle = PAINT.black;
    p.fillText(ch, -w / 2, 0);
    // The brush went over it again here and there, a little off.
    if (rng.chance(0.3)) {
      p.globalAlpha = 0.5;
      p.fillText(ch, -w / 2 + rng.range(-1.5, 1.5), rng.range(-1.5, 1.5));
    }
    p.restore();
    // A drip run down from the foot of a heavy stroke.
    if (ch !== " " && rng.chance(0.22)) {
      const du = u + rng.range(0.25, 0.75) * w;
      const dv = v + fontPx * 0.32;
      const len = rng.range(0.15, 0.5) * fontPx;
      p.save();
      p.strokeStyle = p.fillStyle = PAINT.black;
      p.lineCap = "round";
      p.lineWidth = rng.range(1.5, 3);
      p.beginPath();
      p.moveTo(du, dv);
      p.lineTo(du + rng.range(-1, 1), dv + len);
      p.stroke();
      p.beginPath();
      p.arc(du, dv + len, p.lineWidth * 0.9, 0, Math.PI * 2);
      p.fill();
      p.restore();
    }
    u += w * 0.98;
  });

  // THE WEATHER TAKES IT BACK: flakes off to the wood, in clusters, more
  // along the bottom edge where the snow sits on it.
  p.save();
  p.globalCompositeOperation = "destination-out";
  for (let k = 0; k < 140; k++) {
    const x = rng.range(c.ox, c.ox + c.w);
    const low = rng.chance(0.4);
    const y = low ? rng.range(c.oy + c.h * 0.7, c.oy + c.h) : rng.range(c.oy, c.oy + c.h);
    p.globalAlpha = rng.range(0.6, 1);
    p.beginPath();
    const r = rng.chance(0.15) ? rng.range(5, 10) : rng.range(1, low ? 7 : 4.5);
    p.ellipse(x, y, r * rng.range(1, 2.6), r, rng.range(-0.3, 0.3), 0, Math.PI * 2);
    p.fill();
  }
  // And it wears the paint thin along the grain.
  for (let k = 0; k < 26; k++) {
    p.globalAlpha = rng.range(0.15, 0.4);
    p.lineWidth = rng.range(0.8, 2.2);
    const y = rng.range(c.oy, c.oy + c.h);
    p.beginPath();
    p.moveTo(c.ox + rng.range(0, c.w * 0.5), y);
    p.lineTo(c.ox + rng.range(c.w * 0.5, c.w), y + rng.range(-2, 2));
    p.stroke();
  }
  p.restore();
}

/** Two nails where the stick is behind the board, and the rust run down
 * from them. */
function nailed(g: CanvasRenderingContext2D, c: Cell, s: AmateurSign, rng: Rng): void {
  const dir = s.point === "right" ? 1 : -1;
  const x = -dir * AMATEUR.hang;
  for (const y of [AMATEUR.board.height * 0.26, -AMATEUR.board.height * 0.24]) {
    const [u, v] = px(c, x + rng.range(-0.012, 0.012), y + rng.range(-0.01, 0.01));
    const grad = g.createLinearGradient(u, v, u, v + 34);
    grad.addColorStop(0, "rgba(110, 52, 18, 0.7)");
    grad.addColorStop(1, "rgba(110, 52, 18, 0)");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(u - 3, v);
    g.lineTo(u + 3, v);
    g.lineTo(u + 1.5 + rng.range(-1, 1), v + rng.range(20, 34));
    g.lineTo(u - 1.5, v + 26);
    g.closePath();
    g.fill();
    g.fillStyle = "#3b3631";
    g.beginPath();
    g.arc(u, v, 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#6d665d";
    g.beginPath();
    g.arc(u - 1, v - 1, 2, 0, Math.PI * 2);
    g.fill();
  }
}

/** Snow caught along the board's top edge and packed into its checks: a
 * broken white rim, thicker in places, the wood showing between. */
function snowed(
  g: CanvasRenderingContext2D,
  c: Cell,
  pts: readonly [number, number][],
  rng: Rng,
): void {
  const hh = AMATEUR.board.height / 2;
  g.save();
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const [u, v] = px(c, x, y);
    if (i === 0) g.moveTo(u, v);
    else g.lineTo(u, v);
  });
  g.closePath();
  g.clip();
  g.fillStyle = "#f1f3f6";
  const [, top] = px(c, 0, hh);
  for (let u = c.ox; u < c.ox + c.w; u += rng.range(3, 9)) {
    if (rng.chance(0.25)) continue;
    g.globalAlpha = rng.range(0.6, 0.95);
    const deep = rng.chance(0.15) ? rng.range(7, 13) : rng.range(1.5, 5);
    g.beginPath();
    g.ellipse(u, top, rng.range(4, 12), deep, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export type RouteSigns = { group: THREE.Group; dispose(): void };

/** The amateurs' sign at every ski route of `level`; null with none. */
export function createRouteSigns(level: Level, haze: HazeUniforms): RouteSigns | null {
  const signs = amateurSigns(level);
  if (signs.length === 0) return null;
  const group = new THREE.Group();

  // ONE ATLAS, a cell a sign stacked down it.
  const cells: Cell[] = [];
  let H = 0;
  let W = 0;
  const outlines = signs.map(viewOutline);
  for (const pts of outlines) {
    const box = boxOf(pts);
    const w = Math.ceil((box.x1 - box.x0) * PX);
    const h = Math.ceil((box.y1 - box.y0) * PX);
    cells.push({ ox: 0, oy: H, w, h, box });
    H += h;
    W = Math.max(W, w);
  }
  W = THREE.MathUtils.ceilPowerOfTwo(W);
  H = THREE.MathUtils.ceilPowerOfTwo(H);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const layer = document.createElement("canvas");
  const print = (font: string): void => {
    g.clearRect(0, 0, W, H);
    signs.forEach((s, i) => {
      const c = cells[i];
      weathered(g, c, createRng(s.seed));
      nailed(g, c, s, createRng(s.seed ^ 0x9a11));
      layer.width = W;
      layer.height = H;
      const p = layer.getContext("2d")!;
      painted(p, c, s, outlines[i], createRng(s.seed ^ 0x9a1e7), font);
      g.drawImage(layer, 0, 0);
      snowed(g, c, outlines[i], createRng(s.seed ^ 0x5e0));
    });
  };
  print(SIGN_FALLBACK);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const bump = new THREE.CanvasTexture(canvas);
  bump.colorSpace = THREE.NoColorSpace;

  const faceMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ map: tex, bumpMap: bump, bumpScale: 0.6, roughness: 0.92 }),
    haze,
    "route-sign-face",
  );
  const woodMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: WOOD.edge, roughness: 0.95 }),
    haze,
    "route-sign-wood",
  );
  const barkMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: WOOD.bark, roughness: 1, flatShading: true }),
    haze,
    "route-sign-bark",
  );
  const disposables: { dispose(): void }[] = [tex, bump, faceMat, woodMat, barkMat];

  signs.forEach((s, i) => {
    const c = cells[i];
    const pts = outlines[i];
    const dir = s.point === "right" ? 1 : -1;
    const t = AMATEUR.board.thick;
    // The face: the outline triangulated, its UVs into the cell.
    const contour = pts.map(([x, y]) => new THREE.Vector2(x, y));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const pos: number[] = [];
    const uv: number[] = [];
    for (const [x, y] of pts) {
      pos.push(x, y, t / 2);
      const [u, v] = px(c, x, y);
      uv.push(u / W, 1 - v / H);
    }
    const idx = tris.flat();
    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    faceGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    faceGeo.setIndex(idx);
    faceGeo.computeVertexNormals();
    // The back and the sawn edges round it, one plain mesh.
    const shape = new THREE.Shape(contour);
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: t * 0.96, bevelEnabled: false });
    bodyGeo.translate(0, 0, -t / 2);
    disposables.push(faceGeo, bodyGeo);

    const sign = new THREE.Group();
    sign.position.set(s.x, s.y, s.z);
    sign.rotation.y = s.heading + Math.PI;
    // The stick, leaning, knocked into the snow.
    const lean = new THREE.Group();
    lean.rotation.set(s.leanBack, 0, -s.leanSide, "XZY");
    const st = AMATEUR.stick;
    const stickGeo = new THREE.CylinderGeometry(st.top, st.foot, st.height + st.sunk, 7, 3);
    // A stick is never straight: nudge its rings off the line.
    const sp = stickGeo.getAttribute("position");
    const rng = createRng(s.seed ^ 0x571c);
    const bendX = rng.range(-0.025, 0.025);
    const bendZ = rng.range(-0.02, 0.02);
    for (let k = 0; k < sp.count; k++) {
      const yy = sp.getY(k) / (st.height + st.sunk) + 0.5;
      const b = Math.sin(yy * Math.PI);
      sp.setX(k, sp.getX(k) + bendX * b);
      sp.setZ(k, sp.getZ(k) + bendZ * b);
    }
    stickGeo.computeVertexNormals();
    stickGeo.translate(0, (st.height + st.sunk) / 2 - st.sunk, -st.foot - t / 2);
    const stick = new THREE.Mesh(stickGeo, barkMat);
    // The stub of a branch lopped off, its cut end pale.
    const stubGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.07, 5);
    stubGeo.rotateZ(Math.PI / 2 + rng.range(-0.5, 0.5));
    const stub = new THREE.Mesh(stubGeo, barkMat);
    stub.position.set(dir * -0.04, rng.range(0.45, 0.8), -st.foot - t / 2);
    disposables.push(stickGeo, stubGeo);
    // The board, nailed by its tail across the stick's face, on its tilt.
    const board = new THREE.Group();
    board.position.set(dir * AMATEUR.hang, s.boardY, 0);
    board.rotation.z = s.tilt * dir;
    const face = new THREE.Mesh(faceGeo, faceMat);
    const body = new THREE.Mesh(bodyGeo, woodMat);
    board.add(face, body);
    lean.add(stick, stub, board);
    sign.add(lean);
    sign.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    group.add(sign);
  });

  let disposed = false;
  void loadHand().then((ok) => {
    if (!ok || disposed) return;
    print(`"${HAND.family}", ${SIGN_FALLBACK}`);
    tex.needsUpdate = bump.needsUpdate = true;
  });

  return {
    group,
    dispose() {
      disposed = true;
      for (const d of disposables) d.dispose();
    },
  };
}
