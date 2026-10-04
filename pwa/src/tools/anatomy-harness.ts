// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANATOMY LAB'S PAGE (`make anatomy`, `scripts/anatomy-preview.mjs`):
// the HUD's bones made, measured and drawn against the plate they are
// traced from (`references/anatomy/skeleton-front.svg`, public domain).
//
//   1. TRACE: every labelled bone of the plate rasterised alone, its pixels
//      followed round into a ring (and its holes into rings); what is left
//      of the skeleton once every labelled bone is taken is `REST` (the
//      ribs, the right femur, the pelvis's loose pieces);
//   2. MAP: `anatomy-map.ts` lays every bone into the figure by its joints;
//   3. MEASURE: how much of each bone falls OUTSIDE the traced flesh (none
//      should), and the figure's segments against a body's proportions;
//   4. DRAW: `overlay` — the plate's own drawing of every bone warped by
//      that bone's map, our bone's outline over it, the flesh outline
//      round them, and the HUD's figure beside; `bones` — every bone in a
//      cell of its own, the plate's drawing of it with the trace on the
//      left, the mapped bone over its warped drawing on the right;
//   5. WRITE: the bones as `pwa/src/game/body-bones.ts`' source (the driver
//      writes it with `--write`).

import "../styles.css";
import "../body.css";

import { render, h } from "preact";

import { BONES, freshBody, type Bone } from "@engine";

import { BONE_ORDER, OUTLINE, OUTLINE_POINTS } from "../game/body-figure.ts";
import { bodyTile } from "../game/body-tile.ts";
import { BodyPanel } from "../game/hud-body.tsx";
import {
  FIGURE_JOINTS,
  ORBITS,
  apply,
  markSpots,
  planBones,
  type Comp,
  type Matrix,
  type Piece,
  type Pt,
  type Traced,
} from "./anatomy-map.ts";

/** Every labelled group the plate has, traced one by one. */
const IDS = [
  "Cranium",
  "Mandible",
  "CervicalVertebrae",
  "ThoracicVertebrae",
  "LumbarVertebrae",
  "ClavicleLeft",
  "ClavicleRight",
  "Scapula",
  "Manubrium",
  "Sternum",
  "PelvicGirdle",
  "Sacrum",
  "Coccyx",
  "HumerusLeft",
  "HumerusRight",
  "RadiusLeft",
  "RadiusRight",
  "UlnaLeft",
  "UlnaRight",
  "CarpalsLeft",
  "CarpalsRight",
  "MetacarpalsLeft",
  "MetacarpalsRight",
  "PhalangesLeft",
  "PhalangesRight",
  "FemurLeft",
  "PatellaLeft",
  "PatellaRight",
  "TibiaLeft",
  "TibiaRight",
  "FibulaLeft",
  "FibulaRight",
  "TarsalsLeft",
  "TarsalsRight",
  "MetatarsalsLeft",
  "MetatarsalsRight",
  "PhalangesFootLeft",
  "PhalangesFootRight",
];

const PLATE_W = 435.687;
const PLATE_H = 841.89;
/** The trace's pixels per plate unit. */
const K = 4;

// ── 1. TRACE ─────────────────────────────────────────────────────────────

async function raster(svg: string, css: string, W: number, H: number): Promise<Uint8ClampedArray> {
  const s = svg.replace(/<svg\b[^>]*>/, (m) => `${m}<style>${css}</style>`);
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
  await img.decode();
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, W, H);
  return g.getImageData(0, 0, W, H).data;
}

type Labels = {
  lab: Int32Array;
  comps: { id: number; n: number; start: number; box: number[]; c: Pt }[];
};

function components(m: Uint8Array, W: number, H: number, minArea: number): Labels {
  const lab = new Int32Array(W * H);
  const comps: Labels["comps"] = [];
  let id = 0;
  const st: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || lab[s]) continue;
    id++;
    st.push(s);
    lab[s] = id;
    let n = 0;
    let sx = 0;
    let sy = 0;
    const box = [W, H, 0, 0];
    while (st.length) {
      const q = st.pop()!;
      n++;
      const x = q % W;
      const y = (q / W) | 0;
      sx += x;
      sy += y;
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
      for (const k of [
        x > 0 ? q - 1 : -1,
        x < W - 1 ? q + 1 : -1,
        y > 0 ? q - W : -1,
        y < H - 1 ? q + W : -1,
      ]) {
        if (k >= 0 && m[k] && !lab[k]) {
          lab[k] = id;
          st.push(k);
        }
      }
    }
    if (n >= minArea) comps.push({ id, n, start: s, box, c: [sx / n, sy / n] });
  }
  return { lab, comps };
}

/** A component's boundary, followed round (Moore). */
function contour(lab: Int32Array, W: number, H: number, id: number, start: number): Pt[] {
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const is = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === id;
  const pts: Pt[] = [];
  let x = start % W;
  let y = (start / W) | 0;
  const x0 = x;
  const y0 = y;
  let dir = 7;
  let guard = 0;
  do {
    pts.push([x, y]);
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8;
      if (is(x + dirs[d][0], y + dirs[d][1])) {
        x += dirs[d][0];
        y += dirs[d][1];
        dir = d;
        found = true;
        break;
      }
    }
    if (!found) break;
  } while ((x !== x0 || y !== y0) && ++guard < 400000);
  return pts;
}

/** Douglas–Peucker on an open run. */
function dp(pts: Pt[], e: number): Pt[] {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let im = 0;
  let dm = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d =
      L > 1e-9
        ? Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L
        : Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
    if (d > dm) {
      dm = d;
      im = i;
    }
  }
  if (dm <= e) return [a, b];
  return [...dp(pts.slice(0, im + 1), e).slice(0, -1), ...dp(pts.slice(im), e)];
}

/** A closed ring simplified: split in two so its ends are not one point. */
function ring(pts: Pt[], e: number): Pt[] {
  const h = pts.length >> 1;
  return [...dp(pts.slice(0, h + 1), e).slice(0, -1), ...dp(pts.slice(h), e)];
}

async function trace(svg: string): Promise<Traced> {
  const W = Math.ceil(PLATE_W * K);
  const H = Math.ceil(PLATE_H * K);
  const only = (sel: string): string =>
    `svg *{visibility:hidden} ${sel}{visibility:visible} text,tspan{display:none!important}`;
  const masks = (d: Uint8ClampedArray, dark: boolean): { fg: Uint8Array; dk: Uint8Array } => {
    const fg = new Uint8Array(W * H);
    const dk = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (d[4 * i + 3] <= 100) continue;
      fg[i] = 1;
      if (dark && (d[4 * i] + d[4 * i + 1] + d[4 * i + 2]) / 3 < 110) dk[i] = 1;
    }
    return { fg, dk };
  };
  const toPlate = (r: Pt[]): Pt[] => ring(r, 1.6).map(([x, y]) => [x / K, y / K] as Pt);
  const traceMask = (m: Uint8Array, dark: Uint8Array | null, minArea: number): Comp[] => {
    const { lab, comps } = components(m, W, H, minArea);
    const out: Comp[] = comps.map((c) => ({
      outer: toPlate(contour(lab, W, H, c.id, c.start)),
      holes: [],
      c: [c.c[0] / K, c.c[1] / K],
      area: c.n / K / K,
    }));
    const inv = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) inv[i] = m[i] ? 0 : 1;
    const bg = components(inv, W, H, 30);
    for (const hole of bg.comps) {
      const [x0, y0, x1, y1] = hole.box;
      if (x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1) continue;
      const k = comps.findIndex((c) => c.id === lab[hole.start - 1]);
      if (k >= 0) out[k].holes.push(toPlate(contour(bg.lab, W, H, hole.id, hole.start)));
    }
    if (dark) {
      const dk = components(dark, W, H, 60);
      for (const hole of dk.comps) {
        const k = comps.findIndex((c) => c.id === lab[hole.start]);
        if (k >= 0) out[k].holes.push(toPlate(contour(dk.lab, W, H, hole.id, hole.start)));
      }
    }
    return out;
  };
  const traced: Traced = {};
  const all = masks(await raster(svg, only("#layer3, #layer3 *"), W, H), false).fg;
  const covered = new Uint8Array(W * H);
  for (const id of IDS) {
    const { fg, dk } = masks(await raster(svg, only(`#${id}, #${id} *`), W, H), id === "Cranium");
    for (let i = 0; i < W * H; i++) if (fg[i]) covered[i] = 1;
    traced[id] = traceMask(fg, id === "Cranium" ? dk : null, 40);
  }
  // THE REST: the skeleton less every labelled bone, kept two pixels clear.
  const restMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!all[i]) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const j = i + dy * W + dx;
        if (j >= 0 && j < W * H && covered[j]) {
          near = true;
          break;
        }
      }
    if (!near) restMask[i] = 1;
  }
  traced.REST = traceMask(restMask, null, 60);
  return traced;
}

// ── 2. MAP ───────────────────────────────────────────────────────────────

/** One bone in the figure: its components' rings (each with its holes),
 * its shading, its crack's mark. */
type Mapped = {
  bone: Bone;
  pieces: Piece[];
  comps: { outer: Pt[]; holes: Pt[][] }[];
  shade: Pt[][];
  mark: { x: number; y: number; a: number; r: number };
};

const r1 = (n: number): number => Math.round(n * 10) / 10;

function mapBones(traced: Traced): Mapped[] {
  const plan = planBones(traced);
  const spots = markSpots();
  return BONES.map((bone) => {
    const comps = plan[bone].flatMap((p) =>
      p.comps.map((c) => ({
        outer: ring(
          c.outer.map((q) => apply(p.m, q)),
          0.08,
        ),
        // Every opening big enough to read; a speck (a foramen) is not one.
        holes: c.holes
          .map((hl) =>
            ring(
              hl.map((q) => apply(p.m, q)),
              0.08,
            ),
          )
          .filter((r) => ringArea(r) > 0.6),
      })),
    );
    const shade =
      bone === "skull"
        ? [
            ...ORBITS.map((o) => o.map((q) => apply(plan.skull[0].m, q))),
            ...comps.flatMap((c) => c.holes),
          ]
        : [];
    const s = spots[bone];
    return {
      bone,
      pieces: plan[bone],
      comps,
      shade,
      mark: { x: s.p[0], y: s.p[1], a: s.a, r: halfWidth(comps, s.p, s.a) },
    };
  });
}

/** A ring's area, units². */
function ringArea(r: Pt[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

/** How far across the bone it is from `p`, either way, on its narrower
 * side: the crack's half length. */
function halfWidth(comps: Mapped["comps"], p: Pt, a: number): number {
  const n: Pt = [-Math.sin(a), Math.cos(a)];
  let best = Infinity;
  for (const dir of [1, -1]) {
    let near = Infinity;
    for (const c of comps)
      for (const r of [c.outer, ...c.holes])
        for (let i = 0; i < r.length; i++) {
          const q0 = r[i];
          const q1 = r[(i + 1) % r.length];
          // p + t·n·dir against the edge q0→q1.
          const ex = q1[0] - q0[0];
          const ey = q1[1] - q0[1];
          const dx = n[0] * dir;
          const dy = n[1] * dir;
          const den = dx * ey - dy * ex;
          if (Math.abs(den) < 1e-9) continue;
          const t = ((q0[0] - p[0]) * ey - (q0[1] - p[1]) * ex) / den;
          const u = ((q0[0] - p[0]) * dy - (q0[1] - p[1]) * dx) / den;
          if (t > 0 && u >= 0 && u <= 1) near = Math.min(near, t);
        }
    best = Math.min(best, near);
  }
  return Math.max(0.6, Math.min(3, Number.isFinite(best) ? best : 1));
}

// ── 3. MEASURE ───────────────────────────────────────────────────────────

const PX = 10;

/** Each bone's pixels outside the flesh, of its own, at `PX` a unit. */
function containment(mapped: Mapped[]): Map<Bone, { area: number; out: number }> {
  const W = 92 * PX;
  const H = 211 * PX;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.setTransform(PX, 0, 0, PX, 0, 0);
  g.fillStyle = "#fff";
  g.fill(new Path2D(OUTLINE));
  const flesh = g.getImageData(0, 0, W, H).data;
  const res = new Map<Bone, { area: number; out: number }>();
  for (const m of mapped) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.setTransform(PX, 0, 0, PX, 0, 0);
    g.fillStyle = "#fff";
    for (const comp of m.comps) g.fill(new Path2D(pathOf(comp)), "evenodd");
    const d = g.getImageData(0, 0, W, H).data;
    let area = 0;
    let out = 0;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 128) continue;
      area++;
      if (flesh[i] < 128) out++;
    }
    res.set(m.bone, { area: area / PX / PX, out: out / PX / PX });
  }
  return res;
}

/** THE FIGURE'S SEGMENTS against a body's (as shares of stature, the
 * segment-length tables of biomechanics): the joint-to-joint lengths. */
function proportions(): string[] {
  const J = FIGURE_JOINTS;
  const ys = OUTLINE_POINTS.map((p) => p[1]);
  const H = Math.max(...ys) - Math.min(...ys);
  const d = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const rows: [string, number, number][] = [
    [
      "upper arm (shoulder–elbow)",
      (d(J.shoulderR, J.elbowR) + d(J.shoulderL, J.elbowL)) / 2,
      0.186,
    ],
    ["forearm (elbow–wrist)", (d(J.elbowR, J.wristR) + d(J.elbowL, J.wristL)) / 2, 0.146],
    ["thigh (hip–knee)", (d(J.hipR, J.kneeR) + d(J.hipL, J.kneeL)) / 2, 0.245],
    ["shank (knee–ankle)", (d(J.kneeR, J.ankleR) + d(J.kneeL, J.ankleL)) / 2, 0.246],
    ["shoulder joints apart", d(J.shoulderR, J.shoulderL), 0.2],
    ["hip joints apart", d(J.hipR, J.hipL), 0.1],
    ["chin to crown", J.chin[1] - Math.min(...ys), 0.13],
  ];
  return [
    `stature ${H.toFixed(1)} units`,
    ...rows.map(
      ([name, len, norm]) =>
        `${name.padEnd(28)} ${(len / H).toFixed(3)} of stature (a body's ${norm.toFixed(3)}, ${((len / H / norm - 1) * 100).toFixed(0).padStart(3)} %)`,
    ),
  ];
}

// ── 4. DRAW ──────────────────────────────────────────────────────────────

const fmt = (p: Pt): string => `${r1(p[0])},${r1(p[1])}`;
const ringPath = (r: Pt[]): string => `M${r.map(fmt).join("L")}Z`;
const pathOf = (c: { outer: Pt[]; holes: Pt[][] }): string =>
  [c.outer, ...c.holes].map(ringPath).join("");
const mat = (m: Matrix): string => `matrix(${m.map((v) => v.toFixed(5)).join(",")})`;

/** The plate's drawing of one bone, warped by its map: the whole skeleton
 * layer, clipped to the bone's own traced components, in each piece's
 * frame. */
function warped(m: Mapped, idx: number): string {
  return m.pieces
    .map((p, k) => {
      const id = `clip-${idx}-${k}`;
      const clip = p.comps.map((c) => ringPath(c.outer)).join("");
      return `<clipPath id="${id}"><path d="${clip}"/></clipPath><g transform="${mat(p.m)}"><use href="#layer3" clip-path="url(#${id})"/></g>`;
    })
    .join("");
}

const HUES = new Map<Bone, number>(BONES.map((b, i) => [b, (i * 47) % 360]));

function contours(m: Mapped, w = 0.14): string {
  const hue = HUES.get(m.bone)!;
  return m.comps
    .map(
      (c) =>
        `<path d="${pathOf(c)}" fill="none" stroke="hsl(${hue},85%,32%)" stroke-width="${w}" stroke-linejoin="round"/>`,
    )
    .join("");
}

function overlaySheet(mapped: Mapped[], host: HTMLElement): void {
  const order = BONE_ORDER.map((b) => mapped.find((m) => m.bone === b)!);
  const px = 6;
  const view = `viewBox="0 0 92 211" width="${92 * px}" height="${211 * px}"`;
  const flesh = `<path d="${OUTLINE}" fill="#f3e6dc" stroke="#7a5a48" stroke-width="0.25"/>`;
  const joints = Object.values(FIGURE_JOINTS)
    .map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="0.45" fill="#d0021b"/>`)
    .join("");
  const a = `<svg ${view}>${flesh}${order.map((m, i) => warped(m, i)).join("")}</svg>`;
  const b = `<svg ${view}>${flesh}${order.map((m, i) => warped(m, i + 100)).join("")}${order.map((m) => contours(m)).join("")}${joints}</svg>`;
  host.innerHTML = `<div class="row"><div><div class="cap">THE PLATE'S DRAWING, EACH BONE WARPED BY ITS MAP</div>${a}</div><div><div class="cap">OUR BONES OVER IT · JOINTS</div>${b}</div><div><div class="cap">THE HUD'S FIGURE</div><div id="hud-fig"></div></div></div>`;
  const tile = bodyTile(freshBody(), 100);
  render(
    h("div", { class: "hud anatomy-big", style: { position: "relative", inset: "auto" } }, [
      h(
        "style",
        null,
        `.anatomy-big .hud-body{position:static;transform:none;max-width:none}.anatomy-big .hud-body-figure{height:${211 * px}px}.anatomy-big .hud-body-word{display:none}`,
      ),
      h(BodyPanel, { tile }),
    ]),
    host.querySelector("#hud-fig")!,
  );
}

function bonesSheet(
  mapped: Mapped[],
  host: HTMLElement,
  fit: Map<Bone, { area: number; out: number }>,
): void {
  const cells = mapped.map((m, i) => {
    // The plate's crop: the bone's own components (unwarped) with their trace.
    const plate = m.pieces.flatMap((p) => p.comps);
    const pb = boxOf(
      plate.flatMap((c) => c.outer),
      4,
    );
    const plateSvg = `<svg viewBox="${pb.join(" ")}" width="200" height="220" preserveAspectRatio="xMidYMid meet"><rect x="${pb[0]}" y="${pb[1]}" width="${pb[2]}" height="${pb[3]}" fill="#fff"/><use href="#layer3"/>${plate
      .map(
        (c) =>
          `<path d="${[c.outer, ...c.holes].map(ringPath).join("")}" fill="none" stroke="#0a6" stroke-width="${pb[2] / 200}"/>`,
      )
      .join("")}</svg>`;
    const fb = boxOf(
      m.comps.flatMap((c) => c.outer),
      2,
    );
    const figSvg = `<svg viewBox="${fb.join(" ")}" width="200" height="220" preserveAspectRatio="xMidYMid meet"><rect x="${fb[0]}" y="${fb[1]}" width="${fb[2]}" height="${fb[3]}" fill="#fff"/><path d="${OUTLINE}" fill="#f3e6dc" stroke="#7a5a48" stroke-width="${fb[2] / 250}"/>${warped(m, 200 + i)}${contours(m, fb[2] / 200)}<circle cx="${m.mark.x}" cy="${m.mark.y}" r="${fb[2] / 80}" fill="#d0021b"/></svg>`;
    const f = fit.get(m.bone)!;
    const bad = f.out > 0.05 * f.area || f.out > 0.4;
    return `<div class="cell"><div class="cap">${m.bone} · ${m.pieces.length} piece${m.pieces.length > 1 ? "s" : ""} · ${m.comps.length} rings · <span style="color:${bad ? "#ff5a4a" : "#8fd"}">${f.out.toFixed(2)} of ${f.area.toFixed(1)} u² outside</span></div><div class="pair">${plateSvg}${figSvg}</div></div>`;
  });
  host.innerHTML = `<div class="grid">${cells.join("")}</div>`;
}

function boxOf(pts: Pt[], pad: number): [number, number, number, number] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return [x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0];
}

// ── 5. WRITE ─────────────────────────────────────────────────────────────

function moduleOf(mapped: Mapped[]): string {
  const body = mapped
    .map((m) => {
      const fill = m.comps.map((c) => `      "${pathOf(c)}",`).join("\n");
      const shade = m.shade.map((r) => `      "${ringPath(r)}",`).join("\n");
      const k = m.mark;
      return `  ${m.bone}: {\n    fill: [\n${fill}\n    ],\n    shade: [${shade ? `\n${shade}\n    ` : ""}],\n    mark: { x: ${r1(k.x)}, y: ${r1(k.y)}, a: ${k.a.toFixed(3)}, r: ${r1(k.r)} },\n  },`;
    })
    .join("\n");
  return `// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// GENERATED by \`make anatomy ARGS=--write\` (scripts/anatomy-preview.mjs,
// pwa/src/tools/anatomy-map.ts) — never edit by hand: move a landmark in
// the map and write it again.
//
// THE BONES OF THE HUD'S FIGURE (\`body-figure.ts\`), each traced off the
// public-domain skeleton plate (\`references/anatomy/skeleton-front.svg\`)
// and laid into the traced figure by its joints: every component a ring
// with its holes (filled even-odd), the skull's orbits and openings as
// shading, and where a crack is drawn across the bone (\`mark\`: the point,
// the bone's way there, rad, and its half width).

import type { Bone } from "@engine";

/** How one bone is drawn. */
export type BoneDraw = {
  fill: string[];
  shade: string[];
  mark: { x: number; y: number; a: number; r: number };
};

export const BONE_SHAPES: Record<Bone, BoneDraw> = {
${body}
};
`;
}

// ── The page ─────────────────────────────────────────────────────────────

type Result = { table: string[]; module: string };

declare global {
  interface Window {
    __anatomy?: { run: () => Promise<Result> };
  }
}

window.__anatomy = {
  run: async () => {
    const svg = await (await fetch("skeleton-front.svg")).text();
    // The plate inline once, hidden, so every sheet can `<use>` its layer.
    const holder = document.getElementById("plate")!;
    holder.innerHTML = svg.replace(/<\?xml[^>]*>/, "");
    const traced = await trace(svg);
    const mapped = mapBones(traced);
    const fit = containment(mapped);
    overlaySheet(mapped, document.getElementById("sheet-overlay")!);
    bonesSheet(mapped, document.getElementById("sheet-bones")!, fit);
    const table = [
      ...mapped.map((m) => {
        const f = fit.get(m.bone)!;
        return `${m.bone.padEnd(10)} ${String(m.comps.length).padStart(3)} rings ${f.area.toFixed(1).padStart(6)} u²  outside ${f.out.toFixed(2).padStart(5)} u² (${((f.out / Math.max(f.area, 1e-9)) * 100).toFixed(1).padStart(4)} %)`;
      }),
      "",
      ...proportions(),
    ];
    return { table, module: moduleOf(mapped) };
  },
};
