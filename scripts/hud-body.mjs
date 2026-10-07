#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD BODY LAB (`make hud-body`): the HUD's anatomy figure MADE from a
// whole 3D body (`scripts/lib/bodyparts3d.mjs` — one man's CT, every bone
// and the skin a mesh of its own), so the bones sit in the flesh and in
// proportion to each other exactly as they do in him:
//
//   1. POSE: the model stands in the anatomical position already; only the
//      FEET are turned (`--foot`, degrees, about each ankle) so the five
//      metatarsals and toes are seen side by side rather than end on, as
//      every anatomy plate draws them — the skin under the ankle with them;
//   2. CUT: the trunk's bones are cut in two along the spine (a coronal
//      section through the middle of the vertebral bodies, following the
//      spine's curves): the FRONT view shows what lies before the cut (the
//      ribs' front arcs, the sternum, the vertebral bodies, the front of the
//      pelvis), the BACK view what lies behind it (the shoulder blades, the
//      ribs' backs, the vertebral arches, the sacrum). The skull and the
//      limbs are whole in both;
//   3. LOOK: orthographic, into the figure's box (the skin's height to
//      `FIGURE.h`, centred), from the front or from behind: every bone into
//      a depth buffer of its own with its surface's normal, the skin
//      likewise; which bone is nearest where they cross is read off the
//      depths, so the ORDER they are drawn in is the body's own;
//   4. LIGHT: each bone lit by one light high and to the viewer's left, its
//      recesses (the orbits, the nose, the gaps between ribs and vertebrae)
//      darkened by how far they sit behind the surface round them — the tone
//      cut into bands (`light`, `shadow`, `deep`), each traced as shapes;
//   5. TRACE: the skin's silhouette (the outline), each bone's silhouette and
//      its holes, each band;
//   6. PARTS: the twenty parts cut out of the outline at the body's own
//      seams, read off the bones (the jaw, the sternal notch, the armpits,
//      the costal margin, the iliac crests, the groin, the knees, the ankles,
//      the wrists); the back view is the front's cuts mirrored, its trunk the
//      back; and the front's strip behind the spine for the back;
//   7. MARK: where on each bone a crack is drawn — a long bone mid-shaft, a
//      flat or a small one where it shows — and how wide it is there.
//
// Writes `previews/hud-body-front.png` and `previews/hud-body-back.png` —
// the model lit as it is (left) and the figure traced off it with its parts
// (right) — and prints a table per view: each bone's area, its corners, how
// much of it another bone hides. With --write it writes
// `pwa/src/game/body-model.ts` (GENERATED: never edited by hand — change
// this lab and write again).
//
//   node scripts/hud-body.mjs              the sheets and the tables
//   node scripts/hud-body.mjs --write      ...and the figure's module

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

import {
  BP3D,
  elementsByName,
  ensureBodyParts3D,
  loadObj,
  selectBone,
} from "./lib/bodyparts3d.mjs";
import { createOrgans } from "./lib/hud-body-organs.mjs";
import { writeModule } from "./lib/hud-body-module.mjs";
import { createSheets } from "./lib/hud-body-sheet.mjs";
import { blurIn, createView, drawMesh, traceMask, vertexNormals } from "./lib/mask-trace.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE = join(root, "pwa", "src", "game", "body-model.ts");

const args = parseArgs(
  process.argv.slice(2),
  {
    write: { kind: "flag", default: false, help: "write pwa/src/game/body-model.ts" },
    foot: { kind: "number", default: 58, help: "degrees each foot is turned down about its ankle" },
    k: { kind: "number", default: 8, help: "pixels per figure unit the body is drawn at" },
    brow: {
      kind: "number",
      default: 14,
      help: "mm over the nose's root the skull cap is cut off at, the brain under it",
    },
  },
  "usage: node scripts/hud-body.mjs [--write] [--foot=58] [--k=8] [--brow=14]",
);

aliasEngine(root);
const { BONES, ORGANS } = await import("@engine");
/** Everything laid down in the figure: the bones, then the organs. */
const LAYERS = [...BONES, ...ORGANS];
const { FIGURE } = await import("../pwa/src/game/body-frame.ts");

const t0 = Date.now();
const cache = ensureBodyParts3D(join(root, "previews", ".bodyparts3d"));
const { objDir, table } = cache;
const names = elementsByName(table);
const SIDES = ["R", "L"];
const sideWord = (s) => (s === "R" ? "right" : "left");

// ── 1. POSE ──────────────────────────────────────────────────────────────

const loaded = new Map();
/** Every mesh of the concepts a test passes, once each. */
function meshesOf(test) {
  const fjs = new Set();
  for (const [n, list] of names) if (test(n)) for (const fj of list) fjs.add(fj);
  return [...fjs].map((fj) => {
    if (!loaded.has(fj)) loaded.set(fj, loadObj(join(objDir, `${fj}.obj`)));
    return loaded.get(fj);
  });
}
const named = (name) => meshesOf((n) => n === name);

/** Each ankle: the top of the talus, the axis the foot is turned about. */
const ANKLE = Object.fromEntries(
  SIDES.map((s) => {
    const { v } = named(`${sideWord(s)} talus`)[0];
    let x = 0;
    let y = 0;
    let top = -Infinity;
    for (let i = 0; i < v.length; i += 3) {
      x += v[i];
      y += v[i + 1];
      top = Math.max(top, v[i + 2]);
    }
    return [s, { x: (x * 3) / v.length, y: (y * 3) / v.length, z: top }];
  }),
);
const TURN = (args.foot * Math.PI) / 180;

/** A mesh posed: each corner turned with its foot by `w(x, z)` of the turn
 * (0 above the ankle, 1 in the foot) about the ankle's left-right axis, the
 * toes down; its normals made again. */
function posed(mesh, w) {
  const v = new Float64Array(mesh.v.length);
  for (let i = 0; i < v.length; i += 3) {
    const [x, y, z] = [mesh.v[i], mesh.v[i + 1], mesh.v[i + 2]];
    const a = ANKLE[x < 0 ? "R" : "L"];
    const t = TURN * w(x, z);
    const dy = y - a.y;
    const dz = z - a.z;
    v[i] = x;
    v[i + 1] = a.y + dy * Math.cos(t) - dz * Math.sin(t);
    v[i + 2] = a.z + dz * Math.cos(t) + dy * Math.sin(t);
  }
  return { v, f: mesh.f, n: vertexNormals(v, mesh.f) };
}
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const still = () => 0;
/** The skin goes with the foot below the ankle, blended over a few cm. */
const skinTurn = (x, z) => {
  const a = ANKLE[x < 0 ? "R" : "L"].z;
  return smooth(a + 30, a - 20, z);
};

const skin = named("skin").map((m) => posed(m, skinTurn));
const boneMeshes = new Map(
  BONES.map((b) => {
    const foot = b.startsWith("foot");
    const ms = meshesOf(selectBone(b)).map((m) => posed(m, foot ? () => 1 : still));
    if (ms.length === 0) throw new Error(`no mesh for ${b}`);
    return [b, ms];
  }),
);

// ── 2. CUT ───────────────────────────────────────────────────────────────

/** The bones the coronal cut goes through; the rest are whole in both. */
const CUT = /^(ribs|scapula|clavicle|sternum|cervical|thoracic|lumbar|pelvis)/;
/** The cut, y (mm) at every height z: through the middle of the vertebral
 * bodies — each vertebra's front face and a share of the body's depth
 * behind it — between the vertebrae straight, above the atlas and below
 * the sacrum as the last. */
const cutAt = (() => {
  const knots = [];
  const depthOf = { cervical: 8, thoracic: 13, lumbar: 16, sacrum: 22 };
  for (const [name, list] of names) {
    const kind = /cervical vertebra|^atlas$|^axis$/.test(name)
      ? "cervical"
      : /thoracic vertebra$/.test(name)
        ? "thoracic"
        : /lumbar vertebra$/.test(name)
          ? "lumbar"
          : name === "sacrum"
            ? "sacrum"
            : null;
    if (!kind) continue;
    for (const fj of list) {
      if (!loaded.has(fj)) loaded.set(fj, loadObj(join(objDir, `${fj}.obj`)));
      const { v } = loaded.get(fj);
      let front = Infinity;
      let z = 0;
      for (let i = 0; i < v.length; i += 3) {
        front = Math.min(front, v[i + 1]);
        z += v[i + 2];
      }
      knots.push([(z * 3) / v.length, front + depthOf[kind]]);
    }
  }
  knots.sort((a, b) => a[0] - b[0]);
  return (z) => {
    if (z <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++)
      if (z <= knots[i][0]) {
        const [z0, y0] = knots[i - 1];
        const [z1, y1] = knots[i];
        return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
      }
    return knots[knots.length - 1][1];
  };
})();

/** THE SKULL CAP is cut off level a little over the root of the nose, as an
 * anatomy plate lifts it, so the brain shows in the skull under it. */
const CAP = (() => {
  let top = -Infinity;
  for (const s of SIDES)
    for (const m of named(`${sideWord(s)} nasal bone`))
      for (let i = 2; i < m.v.length; i += 3) top = Math.max(top, m.v[i]);
  return top + args.brow;
})();
/** How a bone is cut: along the spine, its cap off (the skull), or whole. */
const cutOf = (b) => (CUT.test(b) ? "spine" : b === "skull" ? "cap" : null);

// ── 3. LOOK ──────────────────────────────────────────────────────────────

const K = args.k;
const W = FIGURE.w * K;
const H = FIGURE.h * K;
const TOP = 2.5;
const SOLE = FIGURE.h - 1.5;
let zMin = Infinity;
let zMax = -Infinity;
for (const m of skin)
  for (let i = 2; i < m.v.length; i += 3) {
    zMin = Math.min(zMin, m.v[i]);
    zMax = Math.max(zMax, m.v[i]);
  }
/** Millimetres per figure unit. */
const MM = (zMax - zMin) / (SOLE - TOP);
/** The height (mm) a row of pixels looks at. */
const zOfRow = (row) => zMax - ((row + 0.5) / K - TOP) * MM;

/** THE TWO VIEWS: from the front (his right on the viewer's left, the
 * nearest the smallest y) and from behind (his right on the viewer's
 * right, the nearest the largest y). */
const VIEWS = {
  front: { sx: 1, sd: 1 },
  back: { sx: -1, sd: -1 },
};
/** A view's light: high, in front of the viewer, to his left. */
function lightOf(view) {
  const l = [-0.45 * view.sx, -0.75 * view.sd, 0.55];
  const n = Math.hypot(...l);
  return l.map((x) => x / n);
}
function drawn(view, meshes, cut) {
  const out = createView(W, H);
  const clip =
    cut === "cap"
      ? Float32Array.from({ length: H }, (_, r) => (zOfRow(r) > CAP ? -Infinity : Infinity))
      : cut
        ? Float32Array.from({ length: H }, (_, r) => view.sd * cutAt(zOfRow(r)))
        : null;
  for (const m of meshes) {
    const p = new Float64Array(m.v.length);
    for (let i = 0; i < p.length; i += 3) {
      p[i] = ((view.sx * m.v[i]) / MM + FIGURE.w / 2) * K;
      p[i + 1] = (TOP + (zMax - m.v[i + 2]) / MM) * K;
      p[i + 2] = view.sd * m.v[i + 1];
    }
    drawMesh(out, p, m.n, m.f, clip);
  }
  return out;
}
const maskOf = (d) => Uint8Array.from(d.depth, (x) => (Number.isFinite(x) ? 1 : 0));
const organs = createOrgans({ cache, W, H, K, MM, posed, still });

// ── 4. LIGHT ─────────────────────────────────────────────────────────────

/** How far behind its surroundings a recess must sit to go fully dark, mm. */
const RECESS = 14;
/** A drawing's tone at every pixel it covers, 0 dark .. 1 lit. */
function toneOf(d, mask, light, w = W, h = H) {
  const { depth, normal } = d;
  const near = blurIn(depth, mask, w, h, Math.round(K * 0.7));
  const tone = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const lam = Math.max(
      0,
      normal[i * 3] * light[0] + normal[i * 3 + 1] * light[1] + normal[i * 3 + 2] * light[2],
    );
    const ao = Math.min(1, Math.max(0, (depth[i] - near[i]) / RECESS));
    tone[i] = Math.max(0, Math.min(1, 0.22 + 0.78 * lam - 0.75 * ao));
  }
  return blurIn(tone, mask, w, h, 1);
}

/** A drawing cut down to the box its mask fills (and a margin): the work
 * on one bone is the size of the bone, not of the figure. */
function cropOf(d, mask, pad = 12) {
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < W * H; i++)
    if (mask[i]) {
      const x = i % W;
      const y = (i / W) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad);
  y1 = Math.min(H - 1, y1 + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const depth = new Float32Array(w * h);
  const normal = new Float32Array(w * h * 3);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y + y0) * W + x + x0;
      const j = y * w + x;
      depth[j] = d.depth[i];
      m[j] = mask[i];
      normal[j * 3] = d.normal[i * 3];
      normal[j * 3 + 1] = d.normal[i * 3 + 1];
      normal[j * 3 + 2] = d.normal[i * 3 + 2];
    }
  return { x0, y0, w, h, d: { depth, normal }, mask: m };
}
/** THE BANDS a tone is cut into: what is drawn lighter, darker, darkest. */
const BANDS = {
  light: (t) => t > 0.8,
  shadow: (t) => t < 0.5,
  deep: (t) => t < 0.28,
};

// ── 5. TRACE ─────────────────────────────────────────────────────────────

const u = (x) => Math.round((x / K) * 10) / 10;
const pathOf = (shape, dx = 0, dy = 0) =>
  [shape.outer, ...shape.holes]
    .map((r) => `M${r.map(([x, y]) => `${u(x + dx)},${u(y + dy)}`).join("L")}Z`)
    .join("");

/** One view, drawn and traced: the outline, every bone's shapes, which
 * bone shows where, and the order they are laid down in. */
function render(name) {
  const view = VIEWS[name];
  const light = lightOf(view);
  // The skin's own silhouette, mirrored from behind, so one outline is
  // traced and the back's is the front's turned over.
  const skinDraw = drawn(view, skin, false);
  const skinMask = maskOf(skinDraw);
  const outline = traceMask(skinMask, W, H, { minArea: 400, minHole: 200, e: 0.9 });
  const skinTone = toneOf(skinDraw, skinMask, light);
  const masks = new Map();
  const tones = new Map();
  const shapes = {};
  const nearDepth = new Float32Array(W * H).fill(Infinity);
  const nearBone = new Int16Array(W * H).fill(-1);
  /** Over: how many pixels bone i lies in front of bone j. */
  const over = new Map();
  for (const [bi, b] of LAYERS.entries()) {
    const bone = bi < BONES.length;
    const { d, mask } = bone
      ? (() => {
          const dd = drawn(view, boneMeshes.get(b), cutOf(b));
          return { d: dd, mask: maskOf(dd) };
        })()
      : organs.layerOf(b, view, drawn);
    const c = cropOf(d, mask);
    const tone = new Float32Array(W * H);
    const ct = c ? toneOf(c.d, c.mask, light, c.w, c.h) : null;
    if (c)
      for (let y = 0; y < c.h; y++)
        for (let x = 0; x < c.w; x++) tone[(y + c.y0) * W + x + c.x0] = ct[y * c.w + x];
    masks.set(b, mask);
    tones.set(b, tone);
    for (let k = 0; k < W * H; k++) {
      if (!mask[k]) continue;
      const other = nearBone[k];
      if (other >= 0) {
        const key = d.depth[k] < nearDepth[k] ? `${bi}>${other}` : `${other}>${bi}`;
        over.set(key, (over.get(key) ?? 0) + 1);
      }
      if (d.depth[k] < nearDepth[k]) {
        nearDepth[k] = d.depth[k];
        nearBone[k] = bi;
      }
    }
    const band = (test) =>
      traceMask(
        Uint8Array.from(ct, (t, i) => (c.mask[i] && test(t) ? 1 : 0)),
        c.w,
        c.h,
        { minArea: 10, minHole: 10, e: 1.2 },
      )
        .map((sh) => pathOf(sh, c.x0, c.y0))
        .join("");
    shapes[b] = c
      ? {
          fill: traceMask(c.mask, c.w, c.h, { minArea: 6, minHole: 5, e: 0.8 })
            .map((sh) => pathOf(sh, c.x0, c.y0))
            .join(""),
          light: band(BANDS.light),
          shadow: band(BANDS.shadow),
          deep: band(BANDS.deep),
        }
      : { fill: "", light: "", shadow: "", deep: "" };
  }
  // THE ORDER: a bone goes down before every bone it lies behind more than
  // in front of; ties and loops broken by how far back it lies on the whole.
  const n = LAYERS.length;
  const meanDepth = LAYERS.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let k = 0; k < W * H; k++)
      if (nearBone[k] === i) {
        s += nearDepth[k];
        c++;
      }
    return c ? s / c : 0;
  });
  const behind = (i, j) => (over.get(`${j}>${i}`) ?? 0) > (over.get(`${i}>${j}`) ?? 0);
  const placed = [];
  const left = new Set(LAYERS.map((_, i) => i));
  while (left.size) {
    const free = [...left].filter((i) => ![...left].some((j) => j !== i && behind(j, i)));
    const pick = (free.length ? free : [...left]).sort((a, b) => meanDepth[b] - meanDepth[a])[0];
    placed.push(pick);
    left.delete(pick);
  }
  const order = placed.map((i) => LAYERS[i]);
  const shows = new Map(
    LAYERS.map((b, i) => [b, Uint8Array.from(nearBone, (x) => (x === i ? 1 : 0))]),
  );
  void n;
  return { name, view, outline, skinMask, skinTone, masks, tones, shapes, order, shows };
}

// ── 6. PARTS ─────────────────────────────────────────────────────────────

/** A mask's box in figure units: [x0, y0, x1, y1]. */
function boxOf(mask) {
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i]) continue;
    const x = i % W;
    const y = (i / W) | 0;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0 / K, y0 / K, (x1 + 1) / K, (y1 + 1) / K];
}
const CX = FIGURE.w / 2;
const OUT = 8;
const R0 = -OUT;
const L1 = FIGURE.w + OUT;
const p = (pts) => `M${pts.map(([x, y]) => `${u(x * K)},${u(y * K)}`).join("L")}Z`;

/** The front view's parts, cut at the seams its bones show. */
function partsOf(front) {
  const { masks, skinMask } = front;
  const box = (b) => boxOf(masks.get(b));
  const whole = (name, w = still) =>
    boxOf(
      maskOf(
        drawn(
          VIEWS.front,
          named(name).map((m) => posed(m, w)),
          false,
        ),
      ),
    );
  const at = (x, y) => skinMask[Math.round(y * K) * W + Math.round(x * K)] === 1;

  // The jaw's lower edge, column by column, his right to his left.
  const jaw = (() => {
    const m = masks.get("mandible");
    const [x0, , x1] = box("mandible");
    const pts = [];
    for (let x = x0 + 0.3; x <= x1 - 0.3; x += 1) {
      const c = Math.round(x * K);
      let low = -1;
      for (let y = 0; y < H; y++) if (m[y * W + c]) low = y;
      if (low >= 0) pts.push([x, (low + 1) / K]);
    }
    return pts;
  })();
  const notch = box("sternum")[1];
  const xiphoid = box("sternum")[3];
  const clavTop = Math.min(box("clavicleR")[1], box("clavicleL")[1]);
  /** The fingertips: the hands' lowest, and a little more. */
  const tips = Math.max(box("handR")[3], box("handL")[3]) + 1.5;

  /** THE GAP between an arm and the body, row by row: the middle of the
   * first stretch of air out from the body on that side. */
  const gaps = Object.fromEntries(
    SIDES.map((side) => {
      const dir = side === "R" ? -1 : 1;
      const rows = [];
      for (let y = notch + 4; y < tips; y += 0.5) {
        let x = CX;
        // Below the crotch the middle is air: past it and the leg first.
        while (Math.abs(x - CX) < CX - 1 && !at(x, y)) x += dir / K;
        while (Math.abs(x - CX) < CX - 1 && at(x, y)) x += dir / K;
        const a = x;
        while (Math.abs(x - CX) < CX - 1 && !at(x, y)) x += dir / K;
        if (Math.abs(x - CX) >= CX - 1) continue;
        rows.push([(a + x) / 2, y]);
      }
      return [side, rows];
    }),
  );
  /** THE ARMPIT: where the arm leaves the chest — a fifth of the way down
   * the humerus, halfway between the rib cage's edge and the humerus's inner
   * one (the arm's skin and the chest's are one silhouette there, so it is
   * read off the bones). */
  const armpit = Object.fromEntries(
    SIDES.map((s) => {
      const hu = box(`humerus${s}`);
      const y = hu[1] + (hu[3] - hu[1]) * 0.2;
      const dir = s === "R" ? 1 : -1;
      const row = Math.round(y * K) * W;
      const ribs = masks.get("ribs");
      let rx = s === "R" ? 0 : W - 1;
      while (rx > 0 && rx < W - 1 && !ribs[row + rx]) rx += dir;
      const hum = masks.get(`humerus${s}`);
      let hx = Math.round(CX * K);
      while (hx > 0 && hx < W - 1 && !hum[row + hx]) hx -= dir;
      return [s, [(rx + hx) / 2 / K, y]];
    }),
  );
  /** The seam's x at a height: the armpit's above it, the gap's where there
   * is air, and straight between them where the arm still lies on the body. */
  const seamX = (side, y) => {
    const a = armpit[side];
    const g = gaps[side].filter((q) => q[1] > a[1] + 4);
    if (y <= a[1]) return a[0];
    if (y <= g[0][1]) return a[0] + ((g[0][0] - a[0]) * (y - a[1])) / (g[0][1] - a[1]);
    let best = g[0];
    for (const q of g) if (Math.abs(q[1] - y) < Math.abs(best[1] - y)) best = q;
    return best[0];
  };
  /** The seam from one height to another, as corners. */
  const seam = (side, y0, y1) => {
    const out = [];
    const step = y1 > y0 ? 2 : -2;
    for (let y = y0; step > 0 ? y < y1 : y > y1; y += step) out.push([seamX(side, y), y]);
    out.push([seamX(side, y1), y1]);
    return out;
  };

  const costal = Math.max(...SIDES.map((s) => whole(`${sideWord(s)} tenth rib`)[3]));
  const crest = box("pelvis")[1];
  const hipY = Math.min(box("femurR")[1], box("femurL")[1]) + 2;
  /** The crotch: the first air straight down the middle below the pubis. */
  let crotch = box("pelvis")[3] - 2;
  while (at(CX, crotch) && crotch < FIGURE.h) crotch += 1 / K;
  const knee = Object.fromEntries(
    SIDES.map((s) => {
      const q = box(`patella${s}`);
      return [s, { top: q[1] - 1, foot: q[3] + 2 }];
    }),
  );
  const ankle = Object.fromEntries(
    SIDES.map((s) => [s, whole(`${sideWord(s)} talus`, () => 1)[1]]),
  );
  /** The wrist: the line across the forearm at the ends of the radius and
   * the ulna, square to the forearm; its outer end well out of the skin,
   * its inner end on the seam. */
  const wrist = Object.fromEntries(
    SIDES.map((s) => {
      const r = box(`radius${s}`);
      const ul = box(`ulna${s}`);
      const hu = box(`humerus${s}`);
      const w = [((r[0] + r[2]) / 2 + (ul[0] + ul[2]) / 2) / 2, Math.max(r[3], ul[3])];
      const e = [(hu[0] + hu[2]) / 2, hu[3]];
      const a = Math.atan2(w[1] - e[1], w[0] - e[0]);
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      const sgn = Math.sign(nx) * (s === "R" ? -1 : 1);
      const pt = (t) => [w[0] + nx * t * sgn, w[1] + ny * t * sgn];
      let t = 0;
      const inside = (q) => (s === "R" ? q[0] < seamX(s, q[1]) : q[0] > seamX(s, q[1]));
      while (t > -30 && inside(pt(t))) t -= 0.05;
      return [s, { outer: pt(14), inner: pt(t) }];
    }),
  );

  const jawY = Math.max(...jaw.map((q) => q[1]));
  const jawR = jaw[0];
  const jawL = jaw[jaw.length - 1];
  // The neck's sides: the skin's edges at its narrowest, under the jaw.
  let neck = { w: Infinity, a: CX - 4, b: CX + 4 };
  for (let y = jawY; y < notch; y += 0.25) {
    let a = CX;
    while (at(a, y)) a -= 1 / K;
    let b = CX;
    while (at(b, y)) b += 1 / K;
    if (b - a < neck.w) neck = { w: b - a, a: a - 0.6, b: b + 0.6 };
  }
  const sternW = (box("sternum")[2] - box("sternum")[0]) / 2;
  /** The jaw's line carried out level to both sides: the head above it. */
  const jawLine = [[R0, jawR[1]], ...jaw, [L1, jawL[1]]];
  /** That line between two x, its ends cut in. */
  const jawBetween = (xa, xb) => {
    const yAt = (x) => {
      for (let i = 1; i < jawLine.length; i++) {
        const [x0, y0] = jawLine[i - 1];
        const [x1, y1] = jawLine[i];
        if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
      }
      return jawLine[jawLine.length - 1][1];
    };
    return [[xa, yAt(xa)], ...jawLine.filter(([x]) => x > xa && x < xb), [xb, yAt(xb)]];
  };
  const baseR = [CX - sternW * 1.6, notch];
  const baseL = [CX + sternW * 1.6, notch];
  const neckKnee = (clavTop + jawY) / 2;
  const wR = wrist.R;
  const wL = wrist.L;
  const B = FIGURE.h + OUT;
  const regions = {
    head: p([...jawLine, [L1, -OUT], [R0, -OUT]]),
    neck: p([...jawBetween(neck.a, neck.b), [neck.b, neckKnee], baseL, baseR, [neck.a, neckKnee]]),
    shoulderR: p([
      ...jawBetween(R0, neck.a),
      [neck.a, neckKnee],
      baseR,
      armpit.R,
      [R0, armpit.R[1]],
    ]),
    shoulderL: p([
      ...jawBetween(neck.b, L1),
      [L1, armpit.L[1]],
      armpit.L,
      baseL,
      [neck.b, neckKnee],
    ]),
    chest: p([
      baseR,
      baseL,
      armpit.L,
      ...seam("L", armpit.L[1], costal).slice(1),
      [CX, xiphoid],
      ...seam("R", costal, armpit.R[1]).slice(0, -1),
      armpit.R,
    ]),
    abdomen: p([[CX, xiphoid], ...seam("L", costal, crest), ...seam("R", crest, costal)]),
    pelvis: p([...seam("L", crest, hipY), [CX, crotch], ...seam("R", hipY, crest)]),
    armR: p([
      [R0, armpit.R[1]],
      armpit.R,
      ...seam("R", armpit.R[1], wR.inner[1]).slice(1, -1),
      wR.inner,
      wR.outer,
    ]),
    armL: p([
      armpit.L,
      [L1, armpit.L[1]],
      wL.outer,
      wL.inner,
      ...seam("L", wL.inner[1], armpit.L[1]).slice(1),
    ]),
    handR: p([wR.outer, wR.inner, ...seam("R", wR.inner[1], tips).slice(1), [R0, tips]]),
    handL: p([wL.inner, wL.outer, [L1, tips], ...seam("L", tips, wL.inner[1]).slice(0, -1)]),
    thighR: p([
      ...seam("R", hipY, tips),
      [R0, tips],
      [R0, knee.R.top],
      [CX, knee.R.top],
      [CX, crotch],
    ]),
    thighL: p([
      [CX, crotch],
      [CX, knee.L.top],
      [L1, knee.L.top],
      [L1, tips],
      ...seam("L", tips, hipY),
    ]),
    kneeR: p([
      [R0, knee.R.top],
      [CX, knee.R.top],
      [CX, knee.R.foot],
      [R0, knee.R.foot],
    ]),
    kneeL: p([
      [CX, knee.L.top],
      [L1, knee.L.top],
      [L1, knee.L.foot],
      [CX, knee.L.foot],
    ]),
    shinR: p([
      [R0, knee.R.foot],
      [CX, knee.R.foot],
      [CX, ankle.R],
      [R0, ankle.R],
    ]),
    shinL: p([
      [CX, knee.L.foot],
      [L1, knee.L.foot],
      [L1, ankle.L],
      [CX, ankle.L],
    ]),
    footR: p([
      [R0, ankle.R],
      [CX, ankle.R],
      [CX, B],
      [R0, B],
    ]),
    footL: p([
      [CX, ankle.L],
      [L1, ankle.L],
      [L1, B],
      [CX, B],
    ]),
  };
  // The front's own strip for the back: behind the spine, from the neck's
  // base to the sacrum, as wide as the vertebral bodies.
  const half = (b) => (box(b)[2] - box(b)[0]) / 2;
  const back = p([
    [CX - half("cervical") * 0.7, notch - 2],
    [CX + half("cervical") * 0.7, notch - 2],
    [CX + half("thoracic") * 0.45, costal],
    [CX + half("lumbar") * 0.45, crest + 4],
    [CX - half("lumbar") * 0.45, crest + 4],
    [CX - half("thoracic") * 0.45, costal],
  ]);
  return { regions, back };
}

/** A path turned over left to right, for the view from behind. */
const mirror = (d) =>
  d.replace(
    /(-?[\d.]+),(-?[\d.]+)/g,
    (_, x, y) => `${Math.round((FIGURE.w - Number(x)) * 10) / 10},${y}`,
  );

// ── 7. MARK ──────────────────────────────────────────────────────────────

/** A mask's long axis: its centre, its way (rad) and its reach along. */
function axisOf(mask) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < W * H; i++)
    if (mask[i]) {
      n++;
      sx += i % W;
      sy += (i / W) | 0;
    }
  const c = [sx / n, sy / n];
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let i = 0; i < W * H; i++)
    if (mask[i]) {
      const dx = (i % W) - c[0];
      const dy = ((i / W) | 0) - c[1];
      xx += dx * dx;
      yy += dy * dy;
      xy += dx * dy;
    }
  const a = 0.5 * Math.atan2(2 * xy, xx - yy);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < W * H; i++)
    if (mask[i]) {
      const t = ((i % W) - c[0]) * Math.cos(a) + (((i / W) | 0) - c[1]) * Math.sin(a);
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
  return { c, a, lo, hi };
}
/** The pixel of `mask` nearest a point (pixels). */
function nearestIn(mask, x, y) {
  let best = [x, y];
  let d = Infinity;
  for (let i = 0; i < W * H; i++)
    if (mask[i]) {
      const dd = ((i % W) - x) ** 2 + (((i / W) | 0) - y) ** 2;
      if (dd < d) {
        d = dd;
        best = [i % W, (i / W) | 0];
      }
    }
  return best;
}
/** A mark at a point and a way: centred across the bone there, its half
 * width the run across it. */
function markAt(mask, x, y, a) {
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const inM = (t) => {
    const px = Math.round(x + nx * t);
    const py = Math.round(y + ny * t);
    return px >= 0 && py >= 0 && px < W && py < H && mask[py * W + px] === 1;
  };
  let lo = 0;
  while (inM(lo - 1) && lo > -K * 8) lo--;
  let hi = 0;
  while (inM(hi + 1) && hi < K * 8) hi++;
  const mid = (lo + hi) / 2;
  return {
    x: u(x + 0.5 + nx * mid),
    y: u(y + 0.5 + ny * mid),
    a: Math.round(a * 100) / 100,
    r: Math.round(Math.max(0.4, Math.min(3, (hi - lo + 1) / 2 / K)) * 100) / 100,
  };
}

function marksOf(r) {
  const { masks, shows, view } = r;
  // Where a bone shows least (a shoulder blade from the front), it is
  // marked where it shows at all.
  const seen = (b) => (shows.get(b).some((x) => x) ? shows.get(b) : masks.get(b));
  const alongAt = (mask, t, show) => {
    const ax = axisOf(mask);
    const s = ax.lo + (ax.hi - ax.lo) * t;
    const [x, y] = nearestIn(show, ax.c[0] + Math.cos(ax.a) * s, ax.c[1] + Math.sin(ax.a) * s);
    const a = Math.abs(Math.sin(ax.a)) > 0.3 && Math.sin(ax.a) < 0 ? ax.a + Math.PI : ax.a;
    return markAt(show, x, y, a);
  };
  const inBox = (b, fx, fy, a) => {
    const [x0, y0, x1, y1] = boxOf(masks.get(b));
    const fxv = view.sx > 0 ? fx : 1 - fx;
    const [x, y] = nearestIn(seen(b), (x0 + (x1 - x0) * fxv) * K, (y0 + (y1 - y0) * fy) * K);
    return markAt(seen(b), x, y, a);
  };
  const out = {};
  for (const s of SIDES) {
    for (const [kind, t] of [
      ["humerus", 0.5],
      ["radius", 0.55],
      ["ulna", 0.45],
      ["femur", 0.5],
      ["tibia", 0.55],
      ["fibula", 0.5],
      ["clavicle", 0.5],
    ])
      out[`${kind}${s}`] = alongAt(masks.get(`${kind}${s}`), t, seen(`${kind}${s}`));
    out[`scapula${s}`] = inBox(`scapula${s}`, s === "R" ? 0.3 : 0.7, 0.45, Math.PI / 2);
    out[`patella${s}`] = inBox(`patella${s}`, 0.5, 0.5, Math.PI / 2);
    const one = (name, w) =>
      maskOf(
        drawn(
          view,
          named(name).map((m) => posed(m, w)),
          false,
        ),
      );
    out[`hand${s}`] = alongAt(
      one(`${sideWord(s)} third metacarpal bone`, still),
      0.5,
      seen(`hand${s}`),
    );
    out[`foot${s}`] = alongAt(
      one(`${sideWord(s)} second metatarsal bone`, () => 1),
      0.5,
      seen(`foot${s}`),
    );
  }
  out.skull = inBox("skull", 0.68, 0.16, -0.5 * view.sx);
  out.mandible = inBox("mandible", 0.7, 0.75, 0.4 * view.sx);
  out.cervical = inBox("cervical", 0.5, 0.6, Math.PI / 2);
  out.thoracic = inBox("thoracic", 0.5, 0.6, Math.PI / 2);
  out.lumbar = inBox("lumbar", 0.5, 0.5, Math.PI / 2);
  out.sternum = inBox("sternum", 0.5, 0.45, Math.PI / 2);
  out.ribs = inBox("ribs", 0.12, 0.55, 1.2 * view.sx);
  out.pelvis = inBox("pelvis", 0.2, 0.22, view.sx > 0 ? 2.2 : Math.PI - 2.2);
  return out;
}

// ── THE SHEETS ───────────────────────────────────────────────────────────

const { sheet } = createSheets({ W, H, K, root, bones: BONES, pathOf });

// ── RUN ──────────────────────────────────────────────────────────────────

const front = render("front");
const back = render("back");
const { regions, back: backStrip } = partsOf(front);
// From behind: the front's cuts turned over, the trunk the back.
const backRegions = {};
for (const [part, d] of Object.entries(regions)) {
  if (part === "chest" || part === "abdomen") continue;
  backRegions[part] = mirror(d);
}
backRegions.back = mirror(`${regions.chest}${regions.abdomen}`);
const frontMarks = marksOf(front);
const backMarks = marksOf(back);

for (const [r, parts, marks] of [
  [front, { ...regions, back: backStrip }, frontMarks],
  [back, backRegions, backMarks],
]) {
  const s = sheet(r, r.name === "front" ? regions : backRegions, marks, `hud-body-${r.name}.png`);
  console.log(s.out.replace(`${root}/`, ""));
  console.log(
    `  ${r.name}: outline ${r.outline.length} ring(s), ${r.outline.reduce((n, o) => n + o.outer.length, 0)} corners; flesh in no part ${s.none.toFixed(1)} u², in two ${s.doubled.toFixed(1)} u²`,
  );
  void parts;
}
console.log(`  ${MM.toFixed(2)} mm a unit; feet turned ${args.foot}°`);
console.log("  layer         front: area u²  corners  hidden   back: area u²  corners  hidden");
/** How much of a layer the layers in front of it hide, 0 .. 1. */
const hiddenOf = (r, b) => {
  const area = r.masks.get(b).reduce((n, x) => n + x, 0);
  const shown = r.shows.get(b).reduce((n, x) => n + x, 0);
  return area > 0 ? Math.round((1 - shown / area) * 100) / 100 : 1;
};
const stat = (r, b) => {
  const area = r.masks.get(b).reduce((n, x) => n + x, 0) / K / K;
  const shown = r.shows.get(b).reduce((n, x) => n + x, 0) / K / K;
  const corners = Object.values(r.shapes[b]).join("").split(/[ML]/).length - 1;
  const hid = area > 0 ? Math.round(100 - (shown / area) * 100) : 100;
  return `${area.toFixed(1).padStart(13)} ${String(corners).padStart(8)} ${String(hid).padStart(5)} %`;
};
for (const b of LAYERS) console.log(`  ${b.padEnd(12)} ${stat(front, b)}  ${stat(back, b)}`);
console.log(`  order (front): ${front.order.join(" ")}`);
console.log(`  order (back):  ${back.order.join(" ")}`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);

// ── THE MODULE ───────────────────────────────────────────────────────────

if (args.write)
  writeModule({
    MODULE,
    root,
    BP3D,
    BONES,
    ORGANS,
    pathOf,
    hiddenOf,
    views: { front, back, regions, backRegions, frontMarks, backMarks, backStrip },
  });
