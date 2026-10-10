#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GAME'S DRESSED SKIER AS A glTF: the player's skier in his outfit
// before he has dressed (`DEFAULT_OUTFIT`) cut by the game's own loom
// (`dress.ts`'s `dressOutfit`) and written out SKINNED, for Blender to pose
// — the title scene's skier (`scripts/blender/title_rider.py`) is this one,
// so the key art shows the skier the game draws, never a second one.
//
// What is written (one binary glTF):
//   an armature of `SKIER_BONES`, one joint a bone, each at its frame in the
//     bind pose the skin is cut in (`dress-loft.ts`'s `bindPose`), turned so
//     the Blender importer lays every bone back on that frame exactly (its
//     +y along the bone, its +z where it bends — as `skier.py` rolls them)
//   the CLOTH and the HARD mesh, each with its positions, normals, linear
//     vertex colours (COLOR_0, as `linear` writes them), joints and weights;
//     the hard mesh's material the glossier
//
// The frame is the one `skier.py` exports in: the body frame (x right, y up,
// z forward, the origin at the centre of gravity) laid as Blender's
// (-x, z, y) — in glTF's y-up terms (-x, y, -z), a half turn about y.
//
//   node scripts/dressed-skier.mjs                          previews/blender/dressed-skier.glb
//   node scripts/dressed-skier.mjs --out=elsewhere.glb

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A body-frame vector in glTF's frame (the body laid as Blender's
 * (-x, z, y), which the importer reads as glTF's (-x, y, -z)). */
const G = (p) => [-p.x, p.y, -p.z];

/** A 4×4 column-major matrix of a joint: its columns the frame's axes and
 * its translation the head, in glTF — which the Blender importer lays back
 * as a bone whose +y runs along it and whose +z is where it bends. */
function jointMatrix(f) {
  return [...G(f.x), 0, ...G(f.y), 0, ...G(f.z), 0, ...G(f.head), 1];
}

/** A rigid 4×4's inverse (column-major). */
function rigidInverse(m) {
  const r = [
    [m[0], m[4], m[8]],
    [m[1], m[5], m[9]],
    [m[2], m[6], m[10]],
  ];
  const t = [m[12], m[13], m[14]];
  // The inverse's rotation is the transpose; its translation −Rᵀt.
  const rt = (i) => -(r[0][i] * t[0] + r[1][i] * t[1] + r[2][i] * t[2]);
  return [
    r[0][0],
    r[0][1],
    r[0][2],
    0,
    r[1][0],
    r[1][1],
    r[1][2],
    0,
    r[2][0],
    r[2][1],
    r[2][2],
    0,
    rt(0),
    rt(1),
    rt(2),
    1,
  ];
}

/** A rotation matrix's quaternion [x, y, z, w] (column-major 4×4 in). */
function quatOf(m) {
  const [m00, m10, m20, m01, m11, m21, m02, m12, m22] = [
    m[0],
    m[1],
    m[2],
    m[4],
    m[5],
    m[6],
    m[8],
    m[9],
    m[10],
  ];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
  }
  const n = Math.hypot(...q);
  return q.map((k) => k / n);
}

/** THE DRESSED SKIER, as the bytes of a binary glTF. */
export async function dressedSkierGlb() {
  aliasEngine(root);
  const { dressOutfit } = await import("../pwa/src/game/dress.ts");
  const { bindPose } = await import("../pwa/src/game/dress-loft.ts");
  const { SKIER_BONES } = await import("../pwa/src/game/skier-rig.ts");
  const { DEFAULT_OUTFIT } = await import("../pwa/src/game/outfit.ts");
  const dressed = dressOutfit(DEFAULT_OUTFIT);
  const frames = bindPose().frames;

  const chunks = [];
  let offset = 0;
  const views = [];
  const accessors = [];
  /** A typed array appended to the buffer as a view and an accessor. */
  const add = (array, componentType, type, count, extra = {}) => {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    chunks.push(bytes, Buffer.alloc(pad));
    offset += bytes.length + pad;
    accessors.push({ bufferView: views.length - 1, componentType, count, type, ...extra });
    return accessors.length - 1;
  };
  const FLOAT = 5126;
  const U8 = 5121;
  const U32 = 5125;

  // The joints, flat under the root: each at its bind frame, in the scene.
  const mats = SKIER_BONES.map((n) => jointMatrix(frames[n]));
  const nodes = [{ name: "dressed-skier", children: [] }];
  const joints = SKIER_BONES.map((n, i) => {
    nodes.push({ name: n, rotation: quatOf(mats[i]), translation: mats[i].slice(12, 15) });
    nodes[0].children.push(nodes.length - 1);
    return nodes.length - 1;
  });
  const ibm = add(new Float32Array(mats.flatMap(rigidInverse)), FLOAT, "MAT4", mats.length);

  const materials = [
    {
      name: "cloth",
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 0.8,
      },
    },
    {
      name: "hard",
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 0.3,
      },
    },
  ];
  const meshes = [];
  for (const [m, part] of [
    [0, dressed.cloth],
    [1, dressed.hard],
  ]) {
    const nv = part.position.length / 3;
    const pos = new Float32Array(nv * 3);
    const nrm = new Float32Array(nv * 3);
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nv; i++) {
      const p = G({
        x: part.position[3 * i],
        y: part.position[3 * i + 1],
        z: part.position[3 * i + 2],
      });
      const n = G({ x: part.normal[3 * i], y: part.normal[3 * i + 1], z: part.normal[3 * i + 2] });
      const nl = Math.hypot(...n) || 1;
      for (let k = 0; k < 3; k++) {
        pos[3 * i + k] = p[k];
        nrm[3 * i + k] = n[k] / nl;
        lo[k] = Math.min(lo[k], p[k]);
        hi[k] = Math.max(hi[k], p[k]);
      }
    }
    // Four influences a vertex, summing to one.
    const jw = new Float32Array(nv * 4);
    const ji = new Uint8Array(nv * 4);
    for (let i = 0; i < nv; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += part.skinWeight[4 * i + k] ?? 0;
      for (let k = 0; k < 4; k++) {
        const w = part.skinWeight[4 * i + k] ?? 0;
        jw[4 * i + k] = sum > 0 ? w / sum : k === 0 ? 1 : 0;
        ji[4 * i + k] = w > 0 || k === 0 ? (part.skinIndex[4 * i + k] ?? 0) : 0;
      }
    }
    const attributes = {
      POSITION: add(pos, FLOAT, "VEC3", nv, { min: lo, max: hi }),
      NORMAL: add(nrm, FLOAT, "VEC3", nv),
      COLOR_0: add(new Float32Array(part.color), FLOAT, "VEC3", nv),
      JOINTS_0: add(ji, U8, "VEC4", nv),
      WEIGHTS_0: add(jw, FLOAT, "VEC4", nv),
    };
    const indices = add(new Uint32Array(part.index), U32, "SCALAR", part.index.length);
    meshes.push({ name: materials[m].name, primitives: [{ attributes, indices, material: m }] });
    nodes.push({ name: materials[m].name, mesh: meshes.length - 1, skin: 0 });
    nodes[0].children.push(nodes.length - 1);
  }

  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: "2.0", generator: "scripts/dressed-skier.mjs" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes,
    materials,
    skins: [{ name: "rig", joints, inverseBindMatrices: ibm }],
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  };
  const text = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8);
  const chunkHead = (len, kind) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(len, 0);
    b.writeUInt32LE(kind, 4);
    return b;
  };
  return Buffer.concat([
    header,
    chunkHead(jsonChunk.length, 0x4e4f534a),
    jsonChunk,
    chunkHead(bin.length, 0x004e4942),
    bin,
  ]);
}

/** The dressed skier written to `path`; returns the path. */
export async function writeDressedSkier(path) {
  mkdirSync(dirname(path), { recursive: true });
  const bytes = await dressedSkierGlb();
  writeFileSync(path, bytes);
  return path;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(
    process.argv.slice(2),
    {
      out: {
        kind: "string",
        default: "previews/blender/dressed-skier.glb",
        help: "where the glTF is written",
      },
    },
    "usage: node scripts/dressed-skier.mjs [--out=previews/blender/dressed-skier.glb]",
  );
  const path = await writeDressedSkier(join(root, args.out));
  console.log(`saved ${path.replace(`${root}/`, "")}`);
}
