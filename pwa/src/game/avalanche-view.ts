// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE AS DRAWN — the engine's slab and flow (`avalanche.ts`)
// turned into a picture, every frame, on a free ride that has one:
//
//   * THE BED AND THE CROWN: the slab's frame handed to the snow's shader
//     (`avalanche-glsl.ts` over the shared haze uniforms), which lowers the
//     snow behind the crown and between the flanks by the slab's thickness;
//   * THE BLOCKS: the slab cut into plates (`plateGrid`) that ride their
//     parcels down the bed, crack apart, tip and break up into chunks that
//     tumble along in the flow, rounding into snowballs, and lie on the
//     debris where it stops — two instanced draws;
//   * THE POWDER CLOUD: billows boiled off the fast flow and the low dust
//     of its saltation layer, flown by the run's own snow cloud
//     (`snow-cloud.ts`'s `billow`), hanging and drifting after;
//   * THE DEBRIS: the parcels at rest splatted into a small map
//     (`splatDebris`, the engine's own cones) the shader raises the snow by;
//   * THE QUAKE under a skier near it, for the lens (`camera-rigs.ts`).
//
// LAZY: nothing is allocated until a slab releases, and a slide's buffers
// are reused by the next one. Presentation only: it reads the engine's
// state, never writes it, and draws from no stream but its own hash.

import * as THREE from "three";
import { AVALANCHE_CELL as CELL, type GameState, type Level, type Slide } from "@engine";

import {
  bedDepth,
  CHUNK_TRAITS,
  chunkTraits,
  roundOff,
  cloudShare,
  debrisAt,
  debrisBox,
  debrisBoxOf,
  debrisFits,
  hash01,
  plateBreak,
  plateGap,
  plateGrid,
  quakeAt,
  SLIDE_LOOK,
  slabFrameOf,
  slabPhases,
  splatDebris,
  type DebrisBox,
  type Plate,
} from "./avalanche-plan.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import { LOOSE } from "./trail-stamp.ts";

const S = CELL.stride;
/** How often the debris map is laid again while parcels come to rest, s. */
const RELAY = 0.25;

export type AvalancheView = {
  group: THREE.Group;
  /** One frame: the blocks flown, the cloud boiled, the debris laid. */
  frame(state: GameState, dt: number, simDt: number, cloud: SnowCloud): void;
  /** How far the drawn snow stands off the engine's at (`x`, `z`), m: the
   * bed below, the debris above — what a skier on it is drawn on. */
  liftAt(x: number, z: number): number;
  /** How hard the ground shakes at (`x`, `z`), 0..1. */
  quake(x: number, z: number): number;
  /** What it holds now: instances drawn, puffs boiled, bytes of buffers. */
  cost(): { plates: number; chunks: number; bytes: number; gpu: number; texels: number };
  dispose(): void;
};

/** A faceted lump: an icosahedron pushed about a little, so no two faces
 * of a block are one. */
function lumpGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k = 0.82 + 0.3 * hash01(Math.round(p.getX(i) * 97), Math.round(p.getZ(i) * 89), 5);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k);
  }
  // Three's icosahedron is already a triangle soup (each face its own
  // vertices, hashed alike where they meet), so its normals come out flat.
  g.computeVertexNormals();
  return shadeBySide(g, 0.82);
}

/** A block's faces coloured by which way they look: the top as white as
 * the snow it was, the broken sides and the underside the blue-grey of
 * snow in its own shade and crushed in the break (`docs/avalanche.md`). */
function shadeBySide(g: THREE.BufferGeometry, side: number): THREE.BufferGeometry {
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(nrm.count * 3);
  for (let i = 0; i < nrm.count; i++) {
    const t = Math.max(0, Math.min(1, (nrm.getY(i) + 0.2) / 0.9));
    const k = side + (1 - side) * t;
    col[i * 3] = k * (0.93 + 0.07 * t);
    col[i * 3 + 1] = k * (0.95 + 0.05 * t);
    col[i * 3 + 2] = k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** A chunk not yet broken off: drawn at nought. */
const NOUGHT = new THREE.Matrix4().makeScale(0, 0, 0);

export function createAvalancheView(level: Level, haze: HazeUniforms): AvalancheView {
  const group = new THREE.Group();
  group.name = "avalanche";
  const u = haze;
  let slide: Slide | null = null;
  let phase: [number, number, number, number] = [0, 0, 0, 0];
  // THE DEBRIS MAP, its texture and its box: allocated at the first
  // release, grown only if a bigger slab needs it.
  let box: DebrisBox | null = null;
  let map = new Float32Array(0);
  let half = new Uint16Array(0);
  let texture: THREE.DataTexture | null = null;
  let laid = -1;
  let relay = 0;
  // THE BLOCKS: built at the first release.
  let plates: THREE.InstancedMesh | null = null;
  let chunks: THREE.InstancedMesh | null = null;
  let plateGeo: THREE.BufferGeometry | null = null;
  let lumpGeo: THREE.BufferGeometry | null = null;
  let material: THREE.MeshLambertMaterial | null = null;
  let tiles: Plate[] = [];
  /** The parcels where they broke, plan x and z a parcel. */
  let starts = new Float64Array(0);
  /** Each parcel's run, m, and the cloud owed it, puffs. */
  let runs = new Float32Array(0);
  /** Whether a parcel's chunks were posed at rest, and on which laying of
   * the debris. */
  let rested = new Uint8Array(0);
  /** The chunks a parcel owns, the parcels that own any, and every chunk's
   * own numbers (`chunkTraits`), dealt at the release. */
  let chunkPer = 0;
  let chunkParcels = 0;
  let traits = new Float32Array(0);
  let poseLaid = -2;
  let owed = new Float32Array(0);
  let crackOwed = 0;
  let settled = false;
  const at = { u: 0, v: 0 };
  const n = { x: 0, y: 1, z: 0 };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const tint = new THREE.Color();
  // The cloud's scatter: a stream of the view's own, dealt afresh off each
  // slide's crown, so a lab's sheet is the same sheet twice.
  let seed = 1;
  const random = (): number => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };

  function build(): void {
    material = hazeMaterial(
      new THREE.MeshLambertMaterial({ color: 0xf4f7fb, flatShading: true, vertexColors: true }),
      haze,
      "haze",
    );
    plateGeo = shadeBySide(new THREE.BoxGeometry(1, 1, 1), 0.78);
    lumpGeo = lumpGeometry();
    plates = new THREE.InstancedMesh(plateGeo, material, SLIDE_LOOK.plate.most);
    chunks = new THREE.InstancedMesh(lumpGeo, material, SLIDE_LOOK.chunk.most);
    for (const mesh of [plates, chunks]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.count = 0;
      // Each block a shade of its own, so the cracks read between them.
      for (let i = 0; i < mesh.instanceMatrix.count; i++) {
        const k = 0.9 + 0.1 * hash01(i, mesh === plates ? 1 : 2, 0xc01);
        tint.setRGB(k, k, Math.min(1, k * 1.02));
        mesh.setColorAt(i, tint);
      }
      group.add(mesh);
    }
  }

  /** The drawn snow's lift at a point in plan, off the slide's bed and
   * debris. */
  function lift(x: number, z: number): number {
    if (!slide) return 0;
    slabFrameOf(slide.slab, x, z, at);
    const bed = bedDepth(slide.slab, phase, at.u, at.v);
    return (box ? debrisAt(box, map, at.u, at.v) : 0) - bed;
  }

  /** A new slab: its frame into the shader, the map sized for it, the
   * plates cut. */
  function begin(s: Slide): void {
    if (!material) build();
    slide = s;
    phase = slabPhases(s.slab);
    seed = (Math.floor(phase[0] * 1e6) ^ 0x2545f491) >>> 0 || 1;
    fitBox(debrisBox(s.slab));
    laid = -1;
    relay = 0;
    settled = false;
    const k = s.slab;
    u.uSlab0.value.set(k.x, k.z, k.fx, k.fz);
    u.uSlab1.value.set(k.left, k.right, k.length, k.depth);
    u.uSlabJog.value.set(phase[0], phase[1], phase[2], phase[3]);
    u.uSlideOn.value.set(1, 0, 0, 0);
    // Where each parcel broke: the slab's own grid, read off the parcels
    // as they stand at the release (none has moved far yet).
    if (starts.length < s.count * 2) {
      starts = new Float64Array(s.count * 2);
      runs = new Float32Array(s.count);
      rested = new Uint8Array(s.count);
      owed = new Float32Array(s.count);
    }
    for (let i = 0; i < s.count; i++) {
      starts[i * 2] = s.cells[i * S + CELL.x] - s.cells[i * S + CELL.vx] * s.t;
      starts[i * 2 + 1] = s.cells[i * S + CELL.z] - s.cells[i * S + CELL.vz] * s.t;
    }
    runs.fill(0);
    rested.fill(0);
    const C = SLIDE_LOOK.chunk;
    chunkPer = Math.max(C.per, Math.min(C.perMost, Math.floor(C.most / Math.max(1, s.count))));
    chunkParcels = Math.min(s.count, Math.floor(C.most / chunkPer));
    if (traits.length < chunkParcels * chunkPer * CHUNK_TRAITS) {
      traits = new Float32Array(C.most * CHUNK_TRAITS);
    }
    for (let i = 0; i < chunkParcels; i++) {
      for (let b = 0; b < chunkPer; b++)
        chunkTraits(i, b, traits, (i * chunkPer + b) * CHUNK_TRAITS);
    }
    poseLaid = -2;
    owed.fill(0);
    // A slide first seen long after it broke (a run picked up late) has no
    // plates left to draw.
    tiles = s.t < 1 ? plateGrid(k, phase, starts, s.count) : [];
    crackOwed = s.t < 0.5 ? 0 : -1;
  }

  /** The parcels at rest laid into the map and up to the shader. */
  /** The map, its half floats and its texture fitted to `b`. */
  function fitBox(b: DebrisBox): void {
    if (!box || b.nu * b.nv > map.length) {
      map = new Float32Array(b.nu * b.nv);
      half = new Uint16Array(b.nu * b.nv);
    }
    if (!texture || !box || b.nu !== box.nu || b.nv !== box.nv) {
      texture?.dispose();
      texture = new THREE.DataTexture(half, b.nu, b.nv, THREE.RedFormat, THREE.HalfFloatType);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    }
    box = b;
    map.fill(0);
    half.fill(0);
    texture.needsUpdate = true;
    u.uSlideBox.value.set(b.u0, b.v0, b.nu * b.texel, b.nv * b.texel);
    u.uSlide.value = texture;
  }

  function relayDebris(s: Slide): void {
    if (!box || !texture) return;
    // A flow run past the room kept for it: the map grown to where it got.
    if (!debrisFits(box, s)) fitBox(debrisBoxOf(s));
    if (!box || !texture) return;
    const lying = splatDebris(s, box, map);
    for (let i = 0; i < box.nu * box.nv; i++) half[i] = THREE.DataUtils.toHalfFloat(map[i]);
    texture.needsUpdate = true;
    laid = lying;
    u.uSlideOn.value.y = lying > 0 ? 1 : 0;
  }

  function poseBlocks(s: Slide): void {
    if (!plates || !chunks) return;
    const c = s.cells;
    const k = s.slab;
    // THE PLATES: riding their parcels until they break.
    let np = 0;
    for (let i = 0; i < tiles.length; i++) {
      const p = tiles[i];
      const j = p.parcel * S;
      const run = runs[p.parcel];
      const breaks = plateBreak(i);
      if (run >= breaks) continue;
      const dx = c[j + CELL.x] - starts[p.parcel * 2];
      const dz = c[j + CELL.z] - starts[p.parcel * 2 + 1];
      const x = k.x + k.fz * p.u + k.fx * p.v + dx;
      const z = k.z - k.fx * p.u + k.fz * p.v + dz;
      const gap = plateGap(run);
      const h = p.h + LOOSE;
      const g = level.groundAt(x, z) + lift(x, z);
      level.normalAt(x, z, n);
      up.set(n.x, n.y, n.z);
      // Squared to the slope and the fall line, then tipping as it breaks.
      q.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, up);
      q2.setFromAxisAngle(
        THREE.Object3D.DEFAULT_UP,
        Math.atan2(k.fx, k.fz) + (hash01(i, 3, 9) - 0.5) * (0.12 + 0.5 * Math.min(1, run / breaks)),
      );
      q.multiply(q2);
      const tip = (run / breaks) ** 2 * 0.6;
      if (tip > 0) {
        axis.set(hash01(i, 1, 9) - 0.5, 0, hash01(i, 2, 9) - 0.5).normalize();
        q2.setFromAxisAngle(axis, tip);
        q.multiply(q2);
      }
      pos.set(x, g + h / 2 + tip * 0.4, z);
      // The plate is cut in plan; on the slope its fall-line side runs the
      // longer by the pitch, so the cracks close where it still lies.
      scl.set(Math.max(0.2, p.w - gap), h, Math.max(0.2, (p.l - gap) / Math.max(0.4, n.y)));
      m.compose(pos, q, scl);
      plates.setMatrixAt(np++, m);
    }
    plates.count = np;
    plates.instanceMatrix.needsUpdate = true;
    // THE CHUNKS: the broken blocks tumbling in the flow, rounding off.
    const per = chunkPer;
    const most = chunkParcels;
    // Each parcel owns `per` slots, a chunk not broken off yet drawn at
    // nought: so a parcel at rest keeps its chunks where they lie and no
    // frame poses them again — until the debris they sit on is laid anew.
    const relaid = poseLaid !== laid;
    poseLaid = laid;
    for (let i = 0; i < most; i++) {
      const j = i * S;
      const running = c[j + CELL.run] === 1;
      if (!running && rested[i] === 1 && !relaid) continue;
      rested[i] = running ? 0 : 1;
      const run = runs[i];
      const vx = c[j + CELL.vx];
      const vz = c[j + CELL.vz];
      const speed = Math.hypot(vx, vz);
      const spread = 1.5 + Math.min(3.5, run * 0.08);
      for (let b = 0; b < per; b++) {
        const slot = i * per + b;
        const o = slot * CHUNK_TRAITS;
        if (run < traits[o]) {
          chunks.setMatrixAt(slot, NOUGHT);
          continue;
        }
        const size = roundOff(traits[o + 1], traits[o + 2], traits[o], run);
        const a = traits[o + 3] + run * traits[o + 4];
        const r = spread * traits[o + 5];
        const x = c[j + CELL.x] + Math.cos(a) * r;
        const z = c[j + CELL.z] + Math.sin(a) * r;
        const g = level.groundAt(x, z) + lift(x, z);
        const bounce = running
          ? c[j + CELL.h] *
            Math.min(1, speed / 10) *
            (0.15 + 0.6 * Math.abs(Math.sin(run / (1.5 + size) + traits[o + 6])))
          : -size * 0.3;
        pos.set(x, g + size * 0.5 + bounce, z);
        // Rolling: turned about the axis across its way by its run over
        // its radius, on a tilt of its own.
        if (speed > 0.1) axis.set(vz / speed, 0, -vx / speed);
        else axis.set(1, 0, 0);
        q.setFromAxisAngle(axis, run / Math.max(0.15, size * 0.5) + traits[o + 7]);
        axis.set(traits[o + 8], 1, traits[o + 9]).normalize();
        q2.setFromAxisAngle(axis, traits[o + 10]);
        q.multiply(q2);
        scl.set(size, size * traits[o + 11], size * traits[o + 12]);
        m.compose(pos, q, scl);
        chunks.setMatrixAt(slot, m);
      }
    }
    const nc = most * per;
    chunks.count = nc;
    chunks.instanceMatrix.needsUpdate = true;
  }

  /** THE POWDER CLOUD off the running flow, and the whumpf's dust along the
   * crown at the release. */
  function boil(s: Slide, simDt: number, cloud: SnowCloud): void {
    const C = SLIDE_LOOK.cloud;
    const c = s.cells;
    const k = s.slab;
    // THE CRACK: a line of dust along the crown as the slab drops.
    if (crackOwed >= 0 && s.t < 0.6) {
      crackOwed += (k.left + k.right) * C.crack * Math.min(1, simDt / 0.3);
      while (crackOwed >= 1) {
        crackOwed -= 1;
        const w = -k.right + random() * (k.left + k.right);
        const x = k.x + k.fz * w + k.fx * 0.6;
        const z = k.z - k.fx * w + k.fz * 0.6;
        cloud.billow(
          x,
          level.groundAt(x, z) + 0.15,
          z,
          k.fx * 0.8,
          0.4,
          k.fz * 0.8,
          0.4,
          2.2,
          1.8,
          0.16,
        );
      }
    } else crackOwed = -1;
    if (!s.running || simDt <= 0) return;
    // Every running parcel owes its share: the low dust by its speed, the
    // billows by how fast it boils (the front most).
    let total = 0;
    for (let i = 0; i < s.count; i++) {
      if (c[i * S + CELL.run] !== 1) continue;
      total += cloudShare(Math.hypot(c[i * S + CELL.vx], c[i * S + CELL.vz]));
    }
    const each = total > 0 ? (C.billows * simDt) / Math.max(1, total) : 0;
    for (let i = 0; i < s.count; i++) {
      const j = i * S;
      if (c[j + CELL.run] !== 1) continue;
      const vx = c[j + CELL.vx];
      const vz = c[j + CELL.vz];
      const speed = Math.hypot(vx, vz);
      const share = cloudShare(speed);
      const dust = speed > C.dustFrom ? C.dust * simDt * Math.min(1, speed / 15) : 0;
      owed[i] += share * each * Math.min(1, total) + dust;
      while (owed[i] >= 1) {
        owed[i] -= 1;
        const big = random() < share * 0.8;
        const x = c[j + CELL.x] + (random() - 0.5) * 6;
        const z = c[j + CELL.z] + (random() - 0.5) * 6;
        const y = level.groundAt(x, z) + lift(x, z) + c[j + CELL.h] * (0.3 + 0.5 * random());
        if (big) {
          const rise = C.rise[0] + (C.rise[1] - C.rise[0]) * random();
          const size = C.size[0] + (C.size[1] - C.size[0]) * random();
          const hang = C.hang[0] + (C.hang[1] - C.hang[0]) * random();
          cloud.billow(
            x,
            y,
            z,
            vx * 0.75 + (random() - 0.5) * 3,
            rise * (0.5 + share),
            vz * 0.75 + (random() - 0.5) * 3,
            size,
            size * C.grow,
            hang,
            0.5 + 0.3 * share,
          );
        } else {
          const size = C.dustSize[0] + (C.dustSize[1] - C.dustSize[0]) * random();
          const hang = C.dustHang[0] + (C.dustHang[1] - C.dustHang[0]) * random();
          cloud.billow(x, y, z, vx * 0.85, 0.6, vz * 0.85, size, size * 3, hang, 0.2);
        }
      }
    }
  }

  return {
    group,
    frame(state, dt, simDt, cloud) {
      const s = state.avalanche?.slide ?? null;
      if (s !== slide) {
        if (s) begin(s);
        else {
          slide = null;
          u.uSlideOn.value.set(0, 0, 0, 0);
          if (plates) plates.count = 0;
          if (chunks) chunks.count = 0;
          return;
        }
      }
      if (!s || settled) return;
      // Each parcel's run so far: how far it has come from where it broke.
      const c = s.cells;
      for (let i = 0; i < s.count; i++) {
        runs[i] = Math.hypot(
          c[i * S + CELL.x] - starts[i * 2],
          c[i * S + CELL.z] - starts[i * 2 + 1],
        );
      }
      const lying = s.count - s.moving;
      relay -= dt;
      if ((lying !== laid && relay <= 0) || (!s.running && lying !== laid)) {
        relayDebris(s);
        relay = RELAY;
      }
      boil(s, simDt, cloud);
      poseBlocks(s);
      // Once at rest and laid, nothing moves again: the blocks are left
      // where they lie and no frame pays for them.
      if (!s.running && laid === s.count) settled = true;
    },
    liftAt: lift,
    quake(x, z) {
      const s = slide;
      if (!s) return 0;
      const c = s.cells;
      let near = Infinity;
      if (s.running) {
        for (let i = 0; i < s.count; i++) {
          if (c[i * S + CELL.run] !== 1) continue;
          const d = Math.hypot(c[i * S + CELL.x] - x, c[i * S + CELL.z] - z);
          if (d < near) near = d;
        }
      }
      const crown = Math.hypot(s.slab.x - x, s.slab.z - z);
      return quakeAt(near, s.running ? s.front : 0, s.t, crown);
    },
    cost() {
      const texels = box ? box.nu * box.nv : 0;
      const inst = (plates ? SLIDE_LOOK.plate.most : 0) + (chunks ? SLIDE_LOOK.chunk.most : 0);
      const geo = (plateGeo ? 24 * 32 : 0) + (lumpGeo ? 60 * 24 : 0);
      return {
        plates: plates?.count ?? 0,
        chunks: chunks?.count ?? 0,
        // The instance matrices and colours (on the GPU and copied here),
        // the debris map (half floats on the GPU, a float copy here and the
        // half floats it is sent from), the chunks' numbers and the
        // parcels' notes.
        bytes:
          inst * (64 + 12) * 2 +
          texels * 2 +
          map.byteLength +
          half.byteLength +
          geo +
          traits.byteLength +
          starts.byteLength * 2,
        // What of it lies on the GPU.
        gpu: inst * (64 + 12) + texels * 2 + geo,
        texels,
      };
    },
    dispose() {
      plates?.dispose();
      chunks?.dispose();
      plateGeo?.dispose();
      lumpGeo?.dispose();
      material?.dispose();
      texture?.dispose();
      if (u.uSlide.value === texture) u.uSlide.value = null;
      u.uSlideOn.value.set(0, 0, 0, 0);
    },
  };
}
