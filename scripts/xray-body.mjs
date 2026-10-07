#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY BODY LAB (`make xray-body`): the skeleton and the organs the
// X-RAY CAM draws inside the skier (`xray-view.ts`), made from the same
// whole 3D body as the HUD's anatomy plate (`scripts/lib/bodyparts3d.mjs`:
// one man's CT, every bone and organ a mesh of its own) and FITTED ONTO THE
// SKIER'S OWN RIG, so every bone rides the rig bone it belongs to:
//
//   1. GATHER: every bone of `BONES` (the concepts `selectBone` names) and
//      every organ of `ORGANS` (`ORGAN_SOURCES`), turned into the body frame
//      the game poses in (x his right, y up, z forward, metres). The lungs,
//      which this body has only as their airways and vessels, are the tree's
//      CONVEX HULL;
//   2. THIN: each piece clustered on a grid (every corner in a cell merged
//      to their mean) until it is down to its budget of triangles — the
//      faceted, chunky look the game's trees and figures share;
//   3. FIT: each piece handed to one rig bone (`HOME`), its corners read
//      off landmarks of HIS (the hip, knee and ankle joints, the shoulder,
//      elbow and wrist, the sacrum's plane, the seventh cervical vertebra,
//      the skull's middle, the palm) and laid on the same landmarks of the
//      rig in the pose it is bound in (`skier-rig.ts`'s `STANDING`): along
//      each span stretched to the span, across it by the body's one scale;
//   4. WRITE: every corner as a 16-bit integer in its rig bone's frame,
//      every triangle's corners as 16-bit indices, both base64.
//
// Prints a table (each piece's rig bone, its corners and triangles, its
// extent) and writes `previews/xray-body.png`: the fitted skeleton and
// organs from the front and the side inside the dressed skier's silhouette,
// bound as the rig is. With --write it writes `pwa/src/game/xray-model.ts`
// (GENERATED: never edit by hand — change this lab and write again).
//
//   node scripts/xray-body.mjs              the sheet and the table
//   node scripts/xray-body.mjs --write      ...and the module

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { encodePng } from "@niclaslindstedt/oss-game-framework/tooling/png";

import {
  BP3D,
  ORGAN_SOURCES,
  elementsByName,
  ensureBodyParts3D,
  loadObj,
  selectBone,
} from "./lib/bodyparts3d.mjs";
import { thin } from "./lib/xray-thin.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    write: { kind: "flag", default: false, help: "write pwa/src/game/xray-model.ts" },
    scale: { kind: "number", default: 1, help: "every budget of triangles times this" },
  },
  "usage: node scripts/xray-body.mjs [--write] [--scale=1]",
);

aliasEngine(root);
const { BONES, ORGANS } = await import("@engine");
const { skierBones, STANDING } = await import("../pwa/src/game/skier-rig.ts");
const { skierPose } = await import("../pwa/src/game/skier-pose.ts");
const { dressOutfit } = await import("../pwa/src/game/dress.ts");
const { DEFAULT_OUTFIT } = await import("../pwa/src/game/outfit.ts");
const { THREE_HULL } = await import("./lib/xray-hull.mjs");

const cache = ensureBodyParts3D(join(root, "previews", ".bodyparts3d"));
const partNames = elementsByName(cache.table);
const isaNames = elementsByName(cache.isaTable);

// ── 1. GATHER ────────────────────────────────────────────────────────────

const loaded = new Map();
/** Every mesh of the concepts a test passes (from one tree), once each. */
function meshesOf(test, isa = false) {
  const table = isa ? isaNames : partNames;
  const dir = isa ? cache.isaDir : cache.objDir;
  const fjs = new Set();
  for (const [n, list] of table) if (test(n)) for (const fj of list) fjs.add(fj);
  return [...fjs].map((fj) => {
    const key = `${isa ? "i" : "p"}${fj}`;
    if (!loaded.has(key)) loaded.set(key, loadObj(join(dir, `${fj}.obj`)));
    return loaded.get(key);
  });
}
const named = (name) => meshesOf((n) => n === name);

/** The model's frame is x HIS LEFT, y his back, z up, mm; the game's is x
 * his right, y up, z forward, m. Which way his right lies is read off the
 * femurs, never assumed. */
const centroid = (meshes) => {
  let x = 0;
  let y = 0;
  let z = 0;
  let n = 0;
  for (const { v } of meshes)
    for (let i = 0; i < v.length; i += 3) {
      x += v[i];
      y += v[i + 1];
      z += v[i + 2];
      n++;
    }
  return [x / n, y / n, z / n];
};
const SIGN = Math.sign(centroid(named("right femur"))[0] - centroid(named("left femur"))[0]);
/** The model's corner (mm) in the game's frame (m). */
const toGame = (x, y, z) => [SIGN * x * 0.001, z * 0.001, -y * 0.001];
/** A mirrored frame turns every triangle inside out: wind them back. */
const FLIP = SIGN < 0;

/** Meshes merged into one, in the game's frame. */
function merged(meshes) {
  let nv = 0;
  let nf = 0;
  for (const m of meshes) {
    nv += m.v.length;
    nf += m.f.length;
  }
  const v = new Float64Array(nv);
  const f = new Uint32Array(nf);
  let ov = 0;
  let of = 0;
  for (const m of meshes) {
    for (let i = 0; i < m.v.length; i += 3) {
      const g = toGame(m.v[i], m.v[i + 1], m.v[i + 2]);
      v[ov + i] = g[0];
      v[ov + i + 1] = g[1];
      v[ov + i + 2] = g[2];
    }
    const base = ov / 3;
    for (let i = 0; i < m.f.length; i += 3) {
      f[of + i] = base + m.f[i];
      f[of + i + 1] = base + (FLIP ? m.f[i + 2] : m.f[i + 1]);
      f[of + i + 2] = base + (FLIP ? m.f[i + 1] : m.f[i + 2]);
    }
    ov += m.v.length;
    of += m.f.length;
  }
  return { v, f };
}

const boneMesh = new Map(
  BONES.map((b) => {
    const ms = meshesOf(selectBone(b));
    if (ms.length === 0) throw new Error(`no mesh for ${b}`);
    return [b, merged(ms)];
  }),
);
const organMesh = new Map(
  ORGANS.map((o) => {
    const src = ORGAN_SOURCES[o];
    const ms = src.names.flatMap((n) => meshesOf((k) => k === n, !!src.isa));
    if (ms.length === 0) throw new Error(`no mesh for ${o}`);
    const m = merged(ms);
    return [o, src.close ? THREE_HULL(m.v) : m];
  }),
);

// ── 3. FIT: the landmarks ────────────────────────────────────────────────

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));

/** The mean of a mesh's corners whose height lies in the band `lo..hi`
 * metres up from its lowest (or, with `top`, down from its highest). */
function band(mesh, lo, hi, top = false) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 1; i < mesh.v.length; i += 3) {
    min = Math.min(min, mesh.v[i]);
    max = Math.max(max, mesh.v[i]);
  }
  const s = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < mesh.v.length; i += 3) {
    const h = top ? max - mesh.v[i + 1] : mesh.v[i + 1] - min;
    if (h < lo || h > hi) continue;
    s[0] += mesh.v[i];
    s[1] += mesh.v[i + 1];
    s[2] += mesh.v[i + 2];
    n++;
  }
  return mul(s, 1 / n);
}
const meanOf = (mesh) => band(mesh, -1, 99);
const game = (name) => merged(named(name));

const SIDE = { l: "left", r: "right" };
const LM = {};
for (const s of ["l", "r"]) {
  const w = SIDE[s];
  const femur = game(`${w} femur`);
  const humerus = game(`${w} humerus`);
  const hand = boneMesh.get(`hand${s.toUpperCase()}`);
  const foot = boneMesh.get(`foot${s.toUpperCase()}`);
  const wrist = mul(
    add(band(game(`${w} radius`), 0, 0.015), band(game(`${w} ulna`), 0, 0.015)),
    0.5,
  );
  let tip = [0, Infinity, 0];
  for (let i = 0; i < hand.v.length; i += 3)
    if (hand.v[i + 1] < tip[1]) tip = [hand.v[i], hand.v[i + 1], hand.v[i + 2]];
  let toe = [0, 0, -Infinity];
  for (let i = 0; i < foot.v.length; i += 3)
    if (foot.v[i + 2] > toe[2]) toe = [foot.v[i], foot.v[i + 1], foot.v[i + 2]];
  LM[s] = {
    hip: band(femur, 0, 0.025, true),
    knee: band(femur, 0, 0.03),
    ankle: meanOf(game(`${w} talus`)),
    toe,
    shoulder: band(humerus, 0, 0.025, true),
    elbow: band(humerus, 0, 0.025),
    wrist,
    tip,
  };
}
const hipsMid = lerp(LM.l.hip, LM.r.hip, 0.5);
const neckB = meanOf(game("seventh cervical vertebra"));
const skull = boneMesh.get("skull");
const skullMid = (() => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < skull.v.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], skull.v[i + k]);
      hi[k] = Math.max(hi[k], skull.v[i + k]);
    }
  return lerp(lo, hi, 0.5);
})();

/** The rig as it is bound. */
const bind = skierBones(skierPose(STANDING));
const trunkRig = bind.pelvis.length + bind.chest.length;
/** THE BODY'S ONE SCALE: his trunk to the rig's, which every piece takes
 * across its span. */
const SCALE = trunkRig / len(sub(neckB, hipsMid));
const waistB = lerp(hipsMid, neckB, bind.pelvis.length / trunkRig);
const UP = [0, 1, 0];
const FWD = [0, 0, 1];
const BACK = [0, 0, -1];

/** A frame of his: an origin, its axes (x = y × z) and how much is taken
 * along it (`along`) and across it. */
function frameOf(o, yDir, zRef, along, across = SCALE) {
  const y = norm(yDir);
  const z = norm(sub(zRef, mul(y, dot(zRef, y))));
  return { o, x: cross(y, z), y, z, along, across };
}
function spanOf(head, tail, zRef, rigBone, inset = 0) {
  const d = len(sub(tail, head));
  return frameOf(head, sub(tail, head), zRef, (bind[rigBone].length - inset) / d);
}

/** Each rig bone's frame of HIS. */
const HIS = {
  pelvis: spanOf(hipsMid, waistB, FWD, "pelvis"),
  chest: spanOf(waistB, neckB, FWD, "chest"),
  head: frameOf(skullMid, UP, FWD, SCALE),
};
for (const s of ["l", "r"]) {
  const L = LM[s];
  const out = s === "r" ? [1, 0, 0] : [-1, 0, 0];
  HIS[`thigh_${s}`] = spanOf(L.hip, L.knee, FWD, `thigh_${s}`);
  HIS[`shin_${s}`] = spanOf(L.knee, L.ankle, FWD, `shin_${s}`);
  HIS[`boot_${s}`] = frameOf(L.ankle, FWD, UP, SCALE);
  HIS[`upperarm_${s}`] = spanOf(L.shoulder, L.elbow, BACK, `upperarm_${s}`);
  // The forearm ends at the GRIP (the rig's hand is the fist round the
  // pole), a palm's length past the wrist.
  const toward = norm(sub(L.tip, L.wrist));
  const grip = add(L.wrist, mul(toward, 0.07));
  HIS[`forearm_${s}`] = spanOf(L.elbow, grip, BACK, `forearm_${s}`);
  // The hand on the fist's frame: along the forearm, its thumb (out to his
  // side in the anatomical position) up the pole.
  HIS[`hand_${s}`] = frameOf(grip, toward, out, SCALE * 0.9, SCALE * 0.9);
}

/** WHICH RIG BONE EACH PIECE RIDES. */
const HOME = (name) => {
  const s = name.endsWith("L") ? "l" : name.endsWith("R") ? "r" : "";
  const kind = s ? name.slice(0, -1) : name;
  switch (kind) {
    case "skull":
    case "mandible":
    case "cervical":
    case "brain":
      return "head";
    case "clavicle":
    case "scapula":
    case "sternum":
    case "ribs":
    case "thoracic":
    case "heart":
    case "lung":
    case "liver":
    case "spleen":
    case "stomach":
      return "chest";
    case "lumbar":
    case "pelvis":
    case "bowel":
    case "kidney":
    case "bladder":
      return "pelvis";
    case "humerus":
      return `upperarm_${s}`;
    case "radius":
    case "ulna":
      return `forearm_${s}`;
    case "hand":
      return `hand_${s}`;
    case "femur":
    case "patella":
      return `thigh_${s}`;
    case "tibia":
    case "fibula":
      return `shin_${s}`;
    case "foot":
      return `boot_${s}`;
  }
  throw new Error(`no rig bone for ${name}`);
};

/** A corner of his (game frame, m) in its rig bone's frame, m. */
function fit(p, f) {
  const d = sub(p, f.o);
  return [dot(d, f.x) * f.across, dot(d, f.y) * f.along, dot(d, f.z) * f.across];
}

// ── 2. THIN, and the budgets ─────────────────────────────────────────────

/** Triangles a piece is thinned to. */
const BUDGET = {
  skull: 1100,
  mandible: 240,
  cervical: 420,
  thoracic: 900,
  lumbar: 420,
  ribs: 1800,
  sternum: 160,
  clavicle: 140,
  scapula: 260,
  pelvis: 1000,
  humerus: 280,
  radius: 180,
  ulna: 180,
  hand: 600,
  femur: 340,
  patella: 80,
  tibia: 300,
  fibula: 160,
  foot: 600,
  brain: 500,
  heart: 320,
  lung: 360,
  liver: 380,
  spleen: 160,
  stomach: 260,
  bowel: 700,
  kidney: 180,
  bladder: 140,
};
const kindOf = (name) => (/[LR]$/.test(name) ? name.slice(0, -1) : name);

// ── 4. WRITE ─────────────────────────────────────────────────────────────

/** One corner step, m: ±0.65 m about a rig bone's head in 16 bits. */
const UNIT = 0.00002;
const pieces = [];
for (const [name, mesh] of [...boneMesh, ...organMesh]) {
  const budget = Math.round(BUDGET[kindOf(name)] * args.scale);
  const t = thin(mesh.v, mesh.f, budget);
  const bone = HOME(name);
  const f = HIS[bone];
  const pos = new Int16Array(t.v.length);
  const local = new Float64Array(t.v.length);
  for (let i = 0; i < t.v.length; i += 3) {
    const l = fit([t.v[i], t.v[i + 1], t.v[i + 2]], f);
    for (let k = 0; k < 3; k++) {
      const q = Math.round(l[k] / UNIT);
      if (Math.abs(q) > 32767) throw new Error(`${name} reaches past its frame (${l[k]} m)`);
      pos[i + k] = q;
      local[i + k] = q * UNIT;
    }
  }
  pieces.push({
    name,
    bone,
    organ: ORGANS.includes(name),
    v: local,
    f: t.f,
    pos: Buffer.from(pos.buffer).toString("base64"),
    idx: Buffer.from(Uint16Array.from(t.f).buffer).toString("base64"),
  });
}

const rows = pieces.map((p) => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.v.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p.v[i + k]);
      hi[k] = Math.max(hi[k], p.v[i + k]);
    }
  return `${p.name.padEnd(10)} ${p.bone.padEnd(11)} ${String(p.v.length / 3).padStart(5)} v ${String(p.f.length / 3).padStart(5)} t  ${hi.map((h, k) => (h - lo[k]).toFixed(3)).join(" × ")} m`;
});
console.log(rows.join("\n"));
const tris = pieces.reduce((a, p) => a + p.f.length / 3, 0);
console.log(`\n${pieces.length} pieces, ${tris} triangles, scale ${SCALE.toFixed(3)}`);

// THE SHEET: front and side, the skin's silhouette and every piece in it.
{
  const W = 900;
  const H = 820;
  const rgb = new Uint8Array(W * H * 3).fill(18);
  const PX = 520;
  const view = (p, side) => {
    const across = side ? p[2] : p[0];
    const ox = side ? W * 0.75 : W * 0.27;
    return [ox + across * PX, H * 0.48 - p[1] * PX, side ? -p[0] : -p[2]];
  };
  const zbuf = new Float32Array(W * H).fill(Infinity);
  const put = (x, y, d, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (d > zbuf[i]) return;
    zbuf[i] = d;
    rgb.set(c, i * 3);
  };
  const tri = (a, b, c, col) => {
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) < 1e-9) return;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den;
        const w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        put(x, y, w0 * a[2] + w1 * b[2] + w2 * c[2], col(w0, w1, w2));
      }
  };
  // The dressed skin, flat grey, far behind everything else.
  const dress = dressOutfit(DEFAULT_OUTFIT);
  for (const part of [dress.cloth, dress.hard])
    for (const side of [false, true]) {
      const P = part.position;
      for (let i = 0; i < part.index.length; i += 3) {
        const at = (k) => {
          const j = part.index[i + k] * 3;
          const q = view([P[j], P[j + 1], P[j + 2]], side);
          return [q[0], q[1], 50];
        };
        tri(at(0), at(1), at(2), () => [64, 72, 86]);
      }
    }
  const light = norm([-0.4, 0.6, 0.7]);
  for (const p of pieces) {
    const fr = bind[p.bone];
    const world = (i) => {
      const [x, y, z] = [p.v[i], p.v[i + 1], p.v[i + 2]];
      return [
        fr.head.x + fr.x.x * x + fr.y.x * y + fr.z.x * z,
        fr.head.y + fr.x.y * x + fr.y.y * y + fr.z.y * z,
        fr.head.z + fr.x.z * x + fr.y.z * y + fr.z.z * z,
      ];
    };
    const base = p.organ ? [230, 90, 90] : [235, 230, 210];
    for (const side of [false, true])
      for (let i = 0; i < p.f.length; i += 3) {
        const a = world(p.f[i] * 3);
        const b = world(p.f[i + 1] * 3);
        const c = world(p.f[i + 2] * 3);
        const n = norm(cross(sub(b, a), sub(c, a)));
        const toEye = side ? [1, 0, 0] : [0, 0, 1];
        const lit = 0.35 + 0.65 * Math.max(0, dot(n, side ? norm([0.7, 0.6, -0.4]) : light));
        const facing = dot(n, toEye) > 0 ? 1 : 0.55;
        const col = mul(base, lit * facing).map((q) => Math.min(255, Math.round(q)));
        tri(view(a, side), view(b, side), view(c, side), () => col);
      }
  }
  mkdirSync(join(root, "previews"), { recursive: true });
  writeFileSync(join(root, "previews", "xray-body.png"), encodePng(W, H, Buffer.from(rgb.buffer)));
  console.log("wrote previews/xray-body.png");
}

if (args.write) {
  const out = [];
  out.push("// SPDX-License-Identifier: CC-BY-SA-2.1-JP");
  out.push("// GENERATED by `make xray-body ARGS=--write` (scripts/xray-body.mjs) — never");
  out.push("// edit by hand: change the lab and write it again.");
  out.push("//");
  out.push("// THE X-RAY CAM'S SKELETON AND ORGANS (`xray-view.ts`): every bone of");
  out.push("// `BONES` and every organ of `ORGANS`, thinned to a few hundred faceted");
  out.push("// triangles each and fitted onto the skier's rig — each piece's corners in");
  out.push("// the frame of the rig bone it rides (`bone`), metres in `XRAY_UNIT` steps");
  out.push("// as little-endian 16-bit integers, its triangles as 16-bit indices, both");
  out.push("// base64; `bind` is that bone's length in the pose it was fitted in.");
  out.push("//");
  out.push(`// Adapted from ${BP3D.credit}`);
  out.push("// (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/). This file, as an");
  out.push("// adaptation, is under the same licence.");
  out.push("");
  out.push('import type { Bone, Organ } from "@engine";');
  out.push('import type { SkierBone } from "./skier-rig.ts";');
  out.push("");
  out.push("export type XrayPiece<N> = { name: N; bone: SkierBone; pos: string; idx: string };");
  out.push("");
  out.push(`export const XRAY_UNIT = ${UNIT};`);
  out.push("");
  out.push("/** Each rig bone's length in the pose the pieces were fitted in, m. */");
  out.push("export const XRAY_BIND: Partial<Record<SkierBone, number>> = {");
  for (const b of Object.keys(HIS)) out.push(`  ${b}: ${bind[b].length.toFixed(4)},`);
  out.push("};");
  for (const [label, organ] of [
    ["XRAY_BONES", false],
    ["XRAY_ORGANS", true],
  ]) {
    out.push("");
    out.push(`export const ${label}: readonly XrayPiece<${organ ? "Organ" : "Bone"}>[] = [`);
    for (const p of pieces.filter((q) => q.organ === organ)) {
      out.push(`  {`);
      out.push(`    name: "${p.name}",`);
      out.push(`    bone: "${p.bone}",`);
      out.push(`    pos: "${p.pos}",`);
      out.push(`    idx: "${p.idx}",`);
      out.push(`  },`);
    }
    out.push("];");
  }
  writeFileSync(join(root, "pwa", "src", "game", "xray-model.ts"), out.join("\n") + "\n");
  console.log("wrote pwa/src/game/xray-model.ts");
}
