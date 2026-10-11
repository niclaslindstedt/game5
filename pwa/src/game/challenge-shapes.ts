// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHALLENGES' MARKS, BUILT — every piece `challenge-flags.ts` plants,
// procedurally and faceted on the trees' bench (`tree-mesh.ts`), in the
// look of the course's own marks (`mark-shapes.ts`):
//
//   * THE FEATHER FLAG: a tall, thin fibreglass pole spiked into the snow,
//     its foot in a dark ground spike, and on it a tall narrow sail — slim
//     at the foot, widest two thirds up, its top rounded back onto the
//     pole's tip, sewn to the pole by a sleeve — with the word printed down
//     it reading upward: START in white on the gate blue under white chevrons
//     (a white sail is lost against the snow and a winter sky),
//     FINISH on the gate red under a chequered head, and the same FINISH in
//     gold for the line being run (`featherTexture`'s three cells, picked
//     per instance).
//   * THE TIMING POST: a knee-high black post, the photocell's box on its
//     head, a lens on the face that looks across the run.
//   * THE PENNANT: a triangle of cloth on a short pole, white so the
//     instance's colour is its colour.
//   * THE CAIRN: a few faceted stones stacked to the knee.
//
// The cloths are built at rest in their xy plane, flying along +x off the
// pole at x = 0; the view's shader swings them into the wind and flutters
// them (`challenge-flags.ts`).

import * as THREE from "three";

import { PALETTE } from "../identity.ts";
import { CHALLENGE_FLAG as F } from "./challenge-flags-plan.ts";
import { MEDAL_LOOK } from "./medal-look.ts";
import { STRINGS } from "./strings.ts";
import { Shape, type V3 } from "./tree-mesh.ts";

const colour = (hex: THREE.ColorRepresentation): THREE.Color => new THREE.Color(hex);
const WHITE = colour(0xffffff);

function bench(facet = 0.6): Shape {
  const s = new Shape(0, { stems: false, wind: true });
  s.facet = facet;
  return s;
}

function ring(x: number, y: number, z: number, r: number, sides: number, turn = 0): V3[] {
  return Array.from({ length: sides }, (_, k) => {
    const a = turn + (k / sides) * Math.PI * 2;
    return [x + Math.cos(a) * r, y, z + Math.sin(a) * r] as V3;
  });
}

/** An upright faceted post: bands of (height, radius, colour) stacked up
 * it from its foot, capped to a `point`. */
function post(
  s: Shape,
  bands: readonly { y: number; r: number; c: THREE.Color }[],
  sides: number,
  point = 0,
): void {
  const rings = bands.map((b) => ring(0, b.y, 0, b.r, sides));
  const centres = bands.map((b) => [0, b.y, 0] as V3);
  s.loft(rings, centres, (k) => bands[k + 1].c);
  const top = bands[bands.length - 1];
  s.cap(rings[rings.length - 1], [0, top.y + point, 0], top.c, [0, 1, 0]);
}

/** THE FEATHER FLAG'S POLE: grey fibreglass over a dark ground spike. */
export function featherPole(): THREE.BufferGeometry {
  const s = bench();
  const r = F.flag.radius;
  const spike = colour(0x2a2d31);
  const glass = colour(0xd9dde2);
  post(
    s,
    [
      { y: 0, r: r * 1.8, c: spike },
      { y: 0.35, r: r * 1.8, c: spike },
      { y: 0.38, r, c: glass },
      { y: F.flag.pole, r: r * 0.6, c: glass },
    ],
    5,
    r,
  );
  return s.geometry();
}

/** The sail's half width out from the pole at share `v` of its height,
 * m: slim at the foot, widest two thirds up, rounded back onto the pole
 * at the top. */
export function featherWidth(v: number): number {
  const rise = 0.42 + 0.58 * Math.sin(Math.min(1, v / 0.68) * (Math.PI / 2));
  const head = v <= 0.72 ? 1 : Math.sqrt(Math.max(0, 1 - ((v - 0.72) / 0.28) ** 2));
  return F.flag.wide * rise * head;
}

/** THE FEATHER FLAG'S SAIL: a grid off the pole along +x, `uv` across
 * (0 at the pole) and up, cambered a little so its facets catch the
 * light. Its top row closes onto the pole's tip. */
export function featherCloth(): THREE.BufferGeometry {
  const cols = 4;
  const rows = 12;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const h = F.flag.top - F.flag.foot;
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const w = featherWidth(v);
    const y = F.flag.foot + v * h;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      pos.push(u * w, y, Math.sin(u * Math.PI) * w * 0.05);
      uv.push((u * w) / F.flag.wide, v);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** The share of the sail's height its word is set in, foot to head (the
 * view prints the back of the band turned end for end). */
export const WORD_BAND = [0.15, 0.71] as const;

/** The three cells of the sail's print, side by side. */
export const FEATHER_CELLS = { start: 0, finish: 1, live: 2, count: 3 } as const;

/** THE SAILS' PRINT: three cells across one canvas — START, FINISH and
 * the running line's FINISH in gold — each the sail's box with the word
 * set down it reading upward. */
export function featherTexture(): THREE.CanvasTexture {
  const cw = 160;
  const ch = 640;
  const canvas = document.createElement("canvas");
  canvas.width = cw * FEATHER_CELLS.count;
  canvas.height = ch;
  const g = canvas.getContext("2d")!;
  const cells: { bg: string; ink: string; sleeve: string; chequer: boolean; word: string }[] = [
    {
      bg: PALETTE.gateBlue,
      ink: "#f6f8fa",
      sleeve: "#f6f8fa",
      chequer: false,
      word: STRINGS.challengeFlagStart,
    },
    {
      bg: PALETTE.flag,
      ink: "#f6f8fa",
      sleeve: "#15181c",
      chequer: true,
      word: STRINGS.challengeFlagFinish,
    },
    {
      bg: MEDAL_LOOK.gold.deep,
      ink: "#1a1204",
      sleeve: MEDAL_LOOK.gold.rim,
      chequer: true,
      word: STRINGS.challengeFlagFinish,
    },
  ];
  cells.forEach((c, k) => {
    const x0 = k * cw;
    g.fillStyle = c.bg;
    g.fillRect(x0, 0, cw, ch);
    // The sleeve down the pole's side.
    g.fillStyle = c.sleeve;
    g.fillRect(x0, 0, cw * 0.11, ch);
    // Canvas y runs down; the sail's v runs up, so its head is at y 0.
    if (c.chequer) {
      const sq = cw / 6;
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 6; i++) {
          g.fillStyle = (r + i) % 2 === 0 ? "#15181c" : "#f6f8fa";
          g.fillRect(x0 + i * sq, ch * 0.09 + r * sq, sq, sq);
        }
      }
    } else {
      // Two chevrons pointing down the run's way, at the head.
      g.fillStyle = c.sleeve;
      for (let r = 0; r < 2; r++) {
        const y = ch * 0.1 + r * cw * 0.32;
        g.beginPath();
        g.moveTo(x0 + cw * 0.18, y);
        g.lineTo(x0 + cw * 0.5, y + cw * 0.22);
        g.lineTo(x0 + cw * 0.82, y);
        g.lineTo(x0 + cw * 0.82, y + cw * 0.12);
        g.lineTo(x0 + cw * 0.5, y + cw * 0.34);
        g.lineTo(x0 + cw * 0.18, y + cw * 0.12);
        g.closePath();
        g.fill();
      }
    }
    // The word, reading up the sail between the head and the foot.
    g.save();
    g.translate(x0 + cw * 0.44, ch * (1 - (WORD_BAND[0] + WORD_BAND[1]) / 2));
    g.rotate(-Math.PI / 2);
    g.fillStyle = c.ink;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const room = ch * 0.54;
    let size = 74;
    g.font = `900 ${size}px sans-serif`;
    const wide = g.measureText(c.word).width;
    if (wide > room) size = Math.floor((size * room) / wide);
    g.font = `900 ${size}px sans-serif`;
    g.fillText(c.word, 0, 0);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** THE TIMING POST: a black post to the knee, the photocell's box on its
 * head and its lens on the +z face, across the run. */
export function timingPost(): THREE.BufferGeometry {
  const s = bench();
  const dark = colour(0x23262b);
  post(
    s,
    [
      { y: 0, r: 0.03, c: dark },
      { y: F.sensor.height - 0.16, r: 0.025, c: dark },
    ],
    5,
  );
  // The box.
  const box = colour(0x16181b);
  const y0 = F.sensor.height - 0.18;
  const y1 = F.sensor.height;
  const w = 0.07;
  const d = 0.06;
  const c = (x: number, y: number, z: number): V3 => [x, y, z];
  s.quad(c(-w, y0, d), c(w, y0, d), c(w, y1, d), c(-w, y1, d), box, [0, 0, 1]);
  s.quad(c(w, y0, -d), c(-w, y0, -d), c(-w, y1, -d), c(w, y1, -d), box, [0, 0, -1]);
  s.quad(c(w, y0, d), c(w, y0, -d), c(w, y1, -d), c(w, y1, d), box, [1, 0, 0]);
  s.quad(c(-w, y0, -d), c(-w, y0, d), c(-w, y1, d), c(-w, y1, -d), box, [-1, 0, 0]);
  s.quad(c(-w, y1, d), c(w, y1, d), c(w, y1, -d), c(-w, y1, -d), box, [0, 1, 0]);
  // The lens: a red disc on the face.
  const lens = colour(0xd8241c);
  const lr = 0.03;
  const ly = (y0 + y1) / 2;
  const rim = Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * Math.PI * 2;
    return [Math.cos(a) * lr, ly + Math.sin(a) * lr, d + 0.004] as V3;
  });
  s.cap(rim, [0, ly, d + 0.006], lens, [0, 0, 1]);
  return s.geometry();
}

/** A PENNANT'S POLE: thin, grey, to `height`. */
export function pennantPole(height: number): THREE.BufferGeometry {
  const s = bench();
  const r = F.pennant.radius;
  const grey = colour(0xc4c9cf);
  post(
    s,
    [
      { y: 0, r: r * 1.3, c: colour(0x2a2d31) },
      { y: 0.2, r: r * 1.3, c: colour(0x2a2d31) },
      { y: 0.22, r, c: grey },
      { y: height, r: r * 0.8, c: grey },
    ],
    5,
    r,
  );
  return s.geometry();
}

/** A PENNANT: a triangle off the pole along +x, its hoist `deep` m down
 * the pole from `top`, `long` m to its point; white. */
export function pennantCloth(top: number): THREE.BufferGeometry {
  const s = bench(0.75);
  const cols = 4;
  const long = F.pennant.long;
  const deep = F.pennant.deep;
  const at = (i: number, j: number): V3 => {
    const u = i / cols;
    const half = (deep / 2) * (1 - u);
    const mid = top - deep / 2;
    const z = Math.sin(u * Math.PI) * 0.03;
    return [u * long, mid + half * (j * 2 - 1), z];
  };
  for (let i = 0; i < cols; i++) {
    s.quad(at(i, 0), at(i + 1, 0), at(i + 1, 1), at(i, 1), WHITE, [0, 0, 1]);
  }
  return s.geometry();
}

/** THE CAIRN: stones stacked to the knee, each a faceted lump, a little
 * off the last. */
export function cairn(): THREE.BufferGeometry {
  const s = bench(0.8);
  const stones = [
    { y: 0, r: 0.42, h: 0.28, x: 0, z: 0, c: 0x6f6a63 },
    { y: 0.25, r: 0.33, h: 0.24, x: 0.04, z: -0.03, c: 0x7d776e },
    { y: 0.46, r: 0.25, h: 0.2, x: -0.03, z: 0.02, c: 0x655f58 },
    { y: 0.64, r: 0.16, h: 0.21, x: 0.02, z: 0.03, c: 0x837c72 },
  ];
  stones.forEach((st, k) => {
    const c = colour(st.c);
    const turn = k * 0.9;
    const rings = [
      ring(st.x, st.y, st.z, st.r * 0.7, 6, turn),
      ring(st.x, st.y + st.h * 0.45, st.z, st.r, 6, turn + 0.3),
      ring(st.x, st.y + st.h, st.z, st.r * 0.55, 6, turn),
    ];
    const centres = rings.map((_, i) => [st.x, st.y + (st.h * i) / 2, st.z] as V3);
    s.loft(rings, centres, () => c);
    s.cap(rings[2], [st.x, st.y + st.h * 1.08, st.z], c, [0, 1, 0]);
    s.cap(rings[0], [st.x, st.y - 0.02, st.z], c, [0, -1, 0], true);
  });
  return s.geometry();
}
