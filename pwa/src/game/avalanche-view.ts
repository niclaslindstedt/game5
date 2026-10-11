// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE AS DRAWN — the engine's slab and flow (`avalanche.ts`)
// turned into a picture, every frame, on a free ride that has one:
//
//   * THE BED AND THE CROWN: the slab's frame handed to the snow's shader
//     (`avalanche-glsl.ts` over the shared haze uniforms), which lowers the
//     snow behind the crown and between the flanks by the slab's thickness,
//     and the crown's and flanks' walls drawn as a clean step over it
//     (`avalanche-plates.ts`);
//   * THE PLATES: the slab cracked out from its trigger into irregular
//     polygons (`avalanche-crack.ts`), each carried by the parcels nearest
//     it once the crack has reached it — so the cracks open where the flow
//     runs apart and the plates ride up on each other where it crowds —
//     tipping and breaking up as they go;
//   * THE BODY: the churned snow each running parcel carries, a few
//     faceted lumps a parcel that roll and heave, deepest at the head, with
//     the CHUNKS — the broken blocks rounding off into snowballs — tumbling
//     in it and lying on the debris where it stops;
//   * THE POWDER CLOUD: big billows boiled off the fast head and the low
//     dust of its saltation layer, flown by the run's own snow cloud
//     (`snow-cloud.ts`'s `billow`), hanging and drifting after;
//   * THE DEBRIS: the parcels at rest splatted into a small map
//     (`splatDebris`, the engine's own cones) the shader raises the snow by;
//   * THE QUAKE under a skier near it, for the lens (`camera-rigs.ts`).
//
// LAZY: nothing is allocated until a slab releases, and a slide's buffers
// are reused by the next one. Presentation only: it reads the engine's
// state, never writes it, and draws from no stream but its own hash.

import * as THREE from "three";
import { AVALANCHE, AVALANCHE_CELL as CELL, type GameState, type Level, type Slide } from "@engine";

import {
  CORNERS,
  crackFront,
  crackGone,
  crackOpen,
  crackSlab,
  type CrackFront,
  type Plate,
} from "./avalanche-crack.ts";
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
  quakeAt,
  SLIDE_LOOK,
  slabFrameOf,
  slabPhases,
  splatDebris,
  type DebrisBox,
} from "./avalanche-plan.ts";
import {
  outlineAttributes,
  plateGeometry,
  plateMaterial,
  wallGeometry,
  wallMaterial,
} from "./avalanche-plates.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import { LOOSE } from "./trail-stamp.ts";

const S = CELL.stride;
/** How often the debris map is laid again while parcels come to rest, s. */
const RELAY = 0.25;
/** The body's heaps in all: its lumps for each of the engine's most
 * parcels. */
const BODY_MOST = SLIDE_LOOK.body.per * AVALANCHE.cells;

export type AvalancheView = {
  group: THREE.Group;
  /** One frame: the blocks flown, the cloud boiled, the debris laid. */
  frame(state: GameState, dt: number, simDt: number, cloud: SnowCloud): void;
  /** How far the drawn snow stands off the engine's at (`x`, `z`), m: the
   * bed below, the debris above — what a skier on it is drawn on. */
  liftAt(x: number, z: number): number;
  /** How hard the ground shakes at (`x`, `z`), 0..1. */
  quake(x: number, z: number): number;
  /** What it holds now: instances drawn, bytes of buffers. */
  cost(): {
    plates: number;
    chunks: number;
    body: number;
    bytes: number;
    gpu: number;
    texels: number;
  };
  dispose(): void;
};

/** Normals averaged over every face meeting at a corner — the soup's
 * corners matched by where they stand — so a heap of churned snow is lit
 * round rather than cut into facets. */
function roundNormals(g: THREE.BufferGeometry): void {
  const p = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const sum = new Map<string, [number, number, number]>();
  const key = (i: number) =>
    `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    const a = sum.get(k) ?? [0, 0, 0];
    a[0] += nrm.getX(i);
    a[1] += nrm.getY(i);
    a[2] += nrm.getZ(i);
    sum.set(k, a);
  }
  for (let i = 0; i < p.count; i++) {
    const a = sum.get(key(i))!;
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    nrm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
}

/** A faceted lump: an icosahedron pushed about a little, so no two faces
 * of a block are one; `detail` 1 for the body's rounder heaps, `round`
 * to light it round rather than in facets. */
function lumpGeometry(detail: number, side: number, round = false): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k =
      (detail ? 0.66 : 0.8) +
      (detail ? 0.5 : 0.34) *
        hash01(Math.round(p.getX(i) * 97), Math.round(p.getZ(i) * 89), 5 + detail);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k);
  }
  // Three's icosahedron is already a triangle soup (each face its own
  // vertices, hashed alike where they meet), so its normals come out flat.
  g.computeVertexNormals();
  if (round) roundNormals(g);
  return shadeBySide(g, side);
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
    col[i * 3] = k * (0.9 + 0.1 * t);
    col[i * 3 + 1] = k * (0.94 + 0.06 * t);
    col[i * 3 + 2] = k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** A chunk not yet broken off: drawn at nought. */
const NOUGHT = new THREE.Matrix4().makeScale(0, 0, 0);

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createAvalancheView(level: Level, haze: HazeUniforms): AvalancheView {
  const group = new THREE.Group();
  group.name = "avalanche";
  const u = haze;
  let slide: Slide | null = null;
  let phase: [number, number, number, number] = [0, 0, 0, 0];
  let crack: CrackFront = { u: 0, v: 0, speed: 1 };
  // THE DEBRIS MAP, its texture and its box: allocated at the first
  // release, grown only if a bigger slab needs it.
  let box: DebrisBox | null = null;
  let map = new Float32Array(0);
  let half = new Uint16Array(0);
  let texture: THREE.DataTexture | null = null;
  let laid = -1;
  let relay = 0;
  /** The view's own clock, s: the slide's stops once it is at rest, and a
   * heap laid down at the last step must still fade. */
  let clock = 0;
  // THE BLOCKS, THE BODY AND THE WALLS: built at the first release.
  let plates: THREE.InstancedMesh | null = null;
  let chunks: THREE.InstancedMesh | null = null;
  let body: THREE.InstancedMesh | null = null;
  let wall: THREE.Mesh | null = null;
  let wallMat: THREE.Material | null = null;
  let bodyMat: THREE.Material | null = null;
  let plateGeo: THREE.BufferGeometry | null = null;
  let lumpGeo: THREE.BufferGeometry | null = null;
  let heapGeo: THREE.BufferGeometry | null = null;
  let material: THREE.MeshLambertMaterial | null = null;
  let plateMat: THREE.MeshLambertMaterial | null = null;
  let outlines: THREE.InstancedBufferAttribute[] = [];
  let tiles: Plate[] = [];
  /** The parcels where they broke, plan x and z a parcel. */
  let starts = new Float64Array(0);
  /** Each parcel's run, m; how far down the slab it stands, m; when it came
   * to rest, s (−1 running); and the cloud owed it, puffs. */
  let runs = new Float32Array(0);
  let downs = new Float32Array(0);
  let restAt = new Float32Array(0);
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
  let bodyDone = false;
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
    plateMat = plateMaterial(haze);
    plateGeo = plateGeometry();
    outlines = outlineAttributes(plateGeo, SLIDE_LOOK.plate.most);
    lumpGeo = lumpGeometry(0, 0.76);
    heapGeo = lumpGeometry(1, 0.74, true);
    bodyMat = hazeMaterial(
      new THREE.MeshLambertMaterial({ color: 0xf4f7fb, vertexColors: true }),
      haze,
      "haze",
    );
    plates = new THREE.InstancedMesh(plateGeo, plateMat, SLIDE_LOOK.plate.most);
    chunks = new THREE.InstancedMesh(lumpGeo, material, SLIDE_LOOK.chunk.most);
    body = new THREE.InstancedMesh(heapGeo, bodyMat, BODY_MOST);
    for (const mesh of [plates, chunks, body]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.count = 0;
      // Each a shade of its own, so the cracks and the lumps read apart.
      for (let i = 0; i < mesh.instanceMatrix.count; i++) {
        const k = 0.88 + 0.12 * hash01(i, mesh === plates ? 1 : mesh === chunks ? 2 : 3, 0xc01);
        tint.setRGB(k, k, Math.min(1, k * 1.02));
        mesh.setColorAt(i, tint);
      }
      group.add(mesh);
    }
    wallMat = wallMaterial(haze);
    wall = new THREE.Mesh(new THREE.BufferGeometry(), wallMat);
    wall.frustumCulled = false;
    wall.receiveShadow = true;
    group.add(wall);
  }

  /** The drawn snow's lift at a point in plan, off the slide's bed and
   * debris. */
  function lift(x: number, z: number): number {
    if (!slide) return 0;
    slabFrameOf(slide.slab, x, z, at);
    const bed = bedDepth(slide.slab, phase, at.u, at.v) * crackGone(crack, at.u, at.v, slide.t);
    return (box ? debrisAt(box, map, at.u, at.v) : 0) - bed;
  }

  /** A new slab: its frame into the shader, the map sized for it, the
   * plates cracked, the walls laid. */
  function begin(s: Slide): void {
    if (!material) build();
    slide = s;
    phase = slabPhases(s.slab);
    seed = (Math.floor(phase[0] * 1e6) ^ 0x2545f491) >>> 0 || 1;
    fitBox(debrisBox(s.slab));
    laid = -1;
    relay = 0;
    settled = false;
    bodyDone = false;
    const k = s.slab;
    u.uSlab0.value.set(k.x, k.z, k.fx, k.fz);
    u.uSlab1.value.set(k.left, k.right, k.length, k.depth);
    u.uSlabJog.value.set(phase[0], phase[1], phase[2], phase[3]);
    u.uSlideOn.value.set(1, 0, 0, 0);
    crack = crackFront(k);
    u.uSlabCrack.value.set(crack.u, crack.v, crack.speed, s.t);
    // Where each parcel broke: the slab's own grid, read off the parcels
    // as they stand at the release (none has moved far yet).
    if (starts.length < s.count * 2) {
      starts = new Float64Array(s.count * 2);
      runs = new Float32Array(s.count);
      downs = new Float32Array(s.count);
      restAt = new Float32Array(s.count);
      rested = new Uint8Array(s.count);
      owed = new Float32Array(s.count);
    }
    for (let i = 0; i < s.count; i++) {
      starts[i * 2] = s.cells[i * S + CELL.x] - s.cells[i * S + CELL.vx] * s.t;
      starts[i * 2 + 1] = s.cells[i * S + CELL.z] - s.cells[i * S + CELL.vz] * s.t;
    }
    runs.fill(0);
    rested.fill(0);
    restAt.fill(-1);
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
    tiles = s.t < 1 ? crackSlab(k, phase, starts, s.count) : [];
    for (let i = 0; i < tiles.length; i++) {
      const o = tiles[i].outline;
      for (let c = 0; c < CORNERS / 2; c++) {
        outlines[c].setXYZW(i, o[c * 4], o[c * 4 + 1], o[c * 4 + 2], o[c * 4 + 3]);
      }
    }
    for (const a of outlines) a.needsUpdate = true;
    if (wall) {
      wall.geometry.dispose();
      wall.geometry = wallGeometry(level, k, phase);
    }
    crackOwed = s.t < 0.5 ? 0 : -1;
  }

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

  /** The parcels at rest laid into the map and up to the shader. */
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

  /** THE PLATES: each carried by its three parcels once the crack has
   * reached it, the crack round it opening as they run it apart, tipping,
   * turning and riding up as it goes, gone once it has broken up. */
  function posePlates(s: Slide): void {
    if (!plates) return;
    const c = s.cells;
    const k = s.slab;
    let np = 0;
    for (let i = 0; i < tiles.length; i++) {
      const p = tiles[i];
      // Not drawn until the crack reaches it: the snow is whole there yet.
      if (s.t <= p.crack) continue;
      const open = crackOpen(s.t - p.crack);
      let dx = 0;
      let dz = 0;
      let run = 0;
      for (let w = 0; w < 3; w++) {
        const a = p.near[w];
        const wt = p.weight[w] * open;
        dx += wt * (c[a * S + CELL.x] - starts[a * 2]);
        dz += wt * (c[a * S + CELL.z] - starts[a * 2 + 1]);
        run += wt * runs[a];
      }
      const breaks = plateBreak(i);
      if (run >= breaks) continue;
      const x = k.x + k.fz * p.u + k.fx * p.v + dx;
      const z = k.z - k.fx * p.u + k.fz * p.v + dz;
      // Flush and whole until the crack reaches it, a dark line round it
      // the moment it does, opening as it runs apart.
      const gap = open > 0 ? plateGap(run) * open : 0;
      const shrink = Math.max(0.35, 1 - gap / Math.max(0.5, p.r));
      const h = p.h + LOOSE;
      const g = level.groundAt(x, z) + lift(x, z);
      level.normalAt(x, z, n);
      up.set(n.x, n.y, n.z);
      const share = Math.min(1, run / breaks);
      // Squared to the slope and the fall line, then turning and tipping as
      // it goes: a heave the moment it cracks, more the further it runs.
      q.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, up);
      q2.setFromAxisAngle(
        THREE.Object3D.DEFAULT_UP,
        Math.atan2(k.fx, k.fz) + (hash01(i, 3, 9) - 0.5) * 1.1 * share * open,
      );
      q.multiply(q2);
      const tip = (0.04 + 0.08 * hash01(i, 4, 9)) * open + share * share * 0.45;
      axis.set(hash01(i, 1, 9) - 0.5, 0, hash01(i, 2, 9) - 0.5).normalize();
      q2.setFromAxisAngle(axis, tip);
      q.multiply(q2);
      // One edge digs in and the other rides up: the middle lifts by half
      // its radius's rise, and a plate crowded by the one behind it rides
      // up onto it.
      const ride = Math.sin(tip) * p.r * 0.45;
      pos.set(x, g + h / 2 + ride * open, z);
      // The plate is cut in plan; on the slope its fall-line side runs the
      // longer by the pitch, so the cracks close where it still lies.
      scl.set(shrink, h, shrink / Math.max(0.4, n.y));
      m.compose(pos, q, scl);
      plates.setMatrixAt(np, m);
      if (np !== i) {
        // The outline goes with the matrix's slot.
        const o = p.outline;
        for (let cc = 0; cc < CORNERS / 2; cc++) {
          outlines[cc].setXYZW(np, o[cc * 4], o[cc * 4 + 1], o[cc * 4 + 2], o[cc * 4 + 3]);
        }
      }
      np++;
    }
    if (np !== plates.count || np < tiles.length) {
      for (const a of outlines) a.needsUpdate = true;
    }
    plates.count = np;
    plates.instanceMatrix.needsUpdate = true;
  }

  /** THE BODY: the churned snow of every running parcel, a few faceted
   * heaps rolling and heaving round it, deepest at the head, shrinking
   * into the debris once it rests. */
  function poseBody(s: Slide, front: number): void {
    if (!body || bodyDone) return;
    const B = SLIDE_LOOK.body;
    const c = s.cells;
    const t = s.t;
    let nb = 0;
    let live = 0;
    for (let i = 0; i < s.count && nb + B.per <= BODY_MOST; i++) {
      const j = i * S;
      const running = c[j + CELL.run] === 1;
      if (running) restAt[i] = -1;
      else if (restAt[i] < 0) restAt[i] = clock;
      const fade = running ? 1 : 1 - smooth(0, B.fade, clock - restAt[i]);
      const grown = smooth(B.grow[0], B.grow[1], runs[i]) * fade;
      if (grown <= 0.01) continue;
      live++;
      const vx = c[j + CELL.vx];
      const vz = c[j + CELL.vz];
      const speed = Math.hypot(vx, vz);
      const yaw = speed > 0.3 ? Math.atan2(vx, vz) : Math.atan2(s.slab.fx, s.slab.fz);
      const head = Math.exp(-Math.max(0, front - downs[i]) / B.front);
      const big = 1 + B.head * head;
      const tall = Math.max(B.low, c[j + CELL.h]) * (1 + B.rise * head);
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      for (let b = 0; b < B.per; b++) {
        const h1 = hash01(i, b, 0xb0d);
        const h2 = hash01(i, b, 0xb0e);
        const h3 = hash01(i, b, 0xb0f);
        // Spread round the parcel along and across its way, churning.
        const wob = Math.sin(t * (1.6 + 1.4 * h1) + h2 * 6.28);
        const along = (h1 - 0.5) * 8 + wob * 0.9;
        const across = (h2 - 0.5) * 7;
        const x = c[j + CELL.x] + sy * along + cy * across;
        const z = c[j + CELL.z] + cy * along - sy * across;
        const g = level.groundAt(x, z) + lift(x, z);
        level.normalAt(x, z, n);
        up.set(n.x, n.y, n.z);
        q.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, up);
        q2.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw + t * (h3 - 0.5) * 1.6 + h3 * 6);
        q.multiply(q2);
        const sa = (B.across[0] + (B.across[1] - B.across[0]) * h2) * big * grown;
        const sl = (B.along[0] + (B.along[1] - B.along[0]) * h3) * big * grown;
        const sh = tall * (B.tall[0] + (B.tall[1] - B.tall[0]) * h1) * grown * (1 + 0.14 * wob) * 2;
        pos.set(x, g + sh * 0.18, z);
        scl.set(sa * 2, sh, sl * 2);
        m.compose(pos, q, scl);
        body.setMatrixAt(nb++, m);
      }
    }
    body.count = nb;
    body.instanceMatrix.needsUpdate = true;
    if (!s.running && live === 0) bodyDone = true;
  }

  /** THE CHUNKS: the broken blocks tumbling in the flow, rounding off. */
  function poseChunks(s: Slide): void {
    if (!chunks) return;
    const c = s.cells;
    const per = chunkPer;
    const most = chunkParcels;
    // Each parcel owns `per` slots, a chunk not broken off yet drawn at
    // nought: so a parcel at rest keeps its chunks where they lie and no
    // frame poses them again — until the debris they sit on is laid anew.
    const relaid = poseLaid !== laid;
    poseLaid = laid;
    const big = Math.max(0.6, Math.min(1.3, s.slab.depth / 0.55));
    for (let i = 0; i < most; i++) {
      const j = i * S;
      const running = c[j + CELL.run] === 1;
      if (!running && rested[i] === 1 && !relaid) continue;
      rested[i] = running ? 0 : 1;
      const run = runs[i];
      const vx = c[j + CELL.vx];
      const vz = c[j + CELL.vz];
      const speed = Math.hypot(vx, vz);
      const spread = 2 + Math.min(4, run * 0.08);
      for (let b = 0; b < per; b++) {
        const slot = i * per + b;
        const o = slot * CHUNK_TRAITS;
        if (run < traits[o]) {
          chunks.setMatrixAt(slot, NOUGHT);
          continue;
        }
        const size = roundOff(traits[o + 1] * big, traits[o + 2], traits[o], run);
        const a = traits[o + 3] + run * traits[o + 4];
        const r = spread * traits[o + 5];
        const x = c[j + CELL.x] + Math.cos(a) * r;
        const z = c[j + CELL.z] + Math.sin(a) * r;
        const g = level.groundAt(x, z) + lift(x, z);
        // Tumbling through the body: up out of it and back in.
        const bounce = running
          ? c[j + CELL.h] *
            Math.min(1, speed / 10) *
            (0.35 + 0.9 * Math.abs(Math.sin(run / (1.5 + size) + traits[o + 6])))
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
    chunks.count = most * per;
    chunks.instanceMatrix.needsUpdate = true;
  }

  /** THE POWDER CLOUD off the running flow — the head most — and the
   * whumpf's dust along the crown at the release. */
  function boil(s: Slide, simDt: number, cloud: SnowCloud, front: number): void {
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
          0.5,
          2.4,
          2,
          0.22,
        );
      }
    } else crackOwed = -1;
    if (!s.running || simDt <= 0) return;
    // Every running parcel owes its share of the billows — by how fast it
    // boils, the head most — and its low dust by its speed.
    let total = 0;
    let head = 0;
    for (let i = 0; i < s.count; i++) {
      if (c[i * S + CELL.run] !== 1) continue;
      const share = cloudShare(Math.hypot(c[i * S + CELL.vx], c[i * S + CELL.vz]));
      total += share;
      head += share * Math.exp(-Math.max(0, front - downs[i]) / C.front);
    }
    const whole = Math.min(1, total / 6);
    const toHead = head > 0 ? (C.billows * C.headShare * simDt * whole) / head : 0;
    const toAll = total > 0 ? (C.billows * (1 - C.headShare) * simDt * whole) / total : 0;
    const deep = Math.max(0.7, Math.min(1.5, k.depth / 0.5));
    for (let i = 0; i < s.count; i++) {
      const j = i * S;
      if (c[j + CELL.run] !== 1) continue;
      const vx = c[j + CELL.vx];
      const vz = c[j + CELL.vz];
      const speed = Math.hypot(vx, vz);
      const share = cloudShare(speed);
      const nearHead = Math.exp(-Math.max(0, front - downs[i]) / C.front);
      const billows = share * (toAll + toHead * nearHead);
      const dust = speed > C.dustFrom ? C.dust * simDt * Math.min(1, speed / 15) : 0;
      owed[i] += billows + dust;
      while (owed[i] >= 1) {
        owed[i] -= 1;
        const big = random() * (billows + dust) < billows;
        const ux = speed > 0.1 ? vx / speed : k.fx;
        const uz = speed > 0.1 ? vz / speed : k.fz;
        if (big) {
          // Off the head's top and a little ahead of it, carried on at
          // most of its speed and rising, swelling as it goes.
          const ahead = random() * 5;
          const x = c[j + CELL.x] + ux * ahead + (random() - 0.5) * 8;
          const z = c[j + CELL.z] + uz * ahead + (random() - 0.5) * 8;
          // Mostly the smaller, now and then a great head of it.
          const size =
            (C.size[0] + (C.size[1] - C.size[0]) * random() ** 1.6) *
            deep *
            (random() < 0.12 ? 1.6 : 1);
          const y = level.groundAt(x, z) + lift(x, z) + c[j + CELL.h] * 0.6 + size * 0.55;
          const rise = C.rise[0] + (C.rise[1] - C.rise[0]) * random();
          const hang = C.hang[0] + (C.hang[1] - C.hang[0]) * random();
          const opacity = C.opacity[0] + (C.opacity[1] - C.opacity[0]) * random();
          cloud.billow(
            x,
            y,
            z,
            vx * 0.92 + (random() - 0.5) * 3,
            rise * (0.6 + 0.6 * share),
            vz * 0.92 + (random() - 0.5) * 3,
            size,
            size * C.grow,
            hang,
            opacity,
          );
        } else {
          const x = c[j + CELL.x] + (random() - 0.5) * 7;
          const z = c[j + CELL.z] + (random() - 0.5) * 7;
          const y = level.groundAt(x, z) + lift(x, z) + c[j + CELL.h] * (0.3 + 0.4 * random());
          const size = C.dustSize[0] + (C.dustSize[1] - C.dustSize[0]) * random();
          const hang = C.dustHang[0] + (C.dustHang[1] - C.dustHang[0]) * random();
          cloud.billow(x, y, z, vx * 0.85, 0.8, vz * 0.85, size, size * 3, hang, 0.55);
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
          if (body) body.count = 0;
          if (wall) {
            wall.geometry.dispose();
            wall.geometry = new THREE.BufferGeometry();
          }
          return;
        }
      }
      if (!s) return;
      u.uSlabCrack.value.w = s.t;
      if (settled) return;
      // Each parcel's run so far — how far it has come from where it broke
      // — and how far down the slab it stands; the head is the furthest.
      const c = s.cells;
      let front = -Infinity;
      for (let i = 0; i < s.count; i++) {
        const x = c[i * S + CELL.x];
        const z = c[i * S + CELL.z];
        runs[i] = Math.hypot(x - starts[i * 2], z - starts[i * 2 + 1]);
        slabFrameOf(s.slab, x, z, at);
        downs[i] = at.v;
        if (c[i * S + CELL.run] === 1 && at.v > front) front = at.v;
      }
      const lying = s.count - s.moving;
      relay -= dt;
      clock += simDt;
      if ((lying !== laid && relay <= 0) || (!s.running && lying !== laid)) {
        relayDebris(s);
        relay = RELAY;
      }
      boil(s, simDt, cloud, front);
      posePlates(s);
      poseBody(s, front);
      poseChunks(s);
      // Once at rest and laid, nothing moves again: the blocks are left
      // where they lie and no frame pays for them.
      if (!s.running && laid === s.count && bodyDone) settled = true;
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
      const P = SLIDE_LOOK.plate.most;
      const inst = plates ? P + SLIDE_LOOK.chunk.most + BODY_MOST : 0;
      // The prism (12 triangles a corner, five floats a vertex), the lump
      // (20 faces) and the heap (80), as three lays them out.
      const geo = plates ? CORNERS * 36 * 4 * 9 + 60 * 36 + 240 * 36 : 0;
      const outline = plates ? P * CORNERS * 2 * 4 : 0;
      // Ten floats a wall vertex: where, its normal, its shade, its drop.
      const walls = wall ? (wall.geometry.attributes.position?.count ?? 0) * 40 : 0;
      return {
        plates: plates?.count ?? 0,
        chunks: chunks?.count ?? 0,
        body: body?.count ?? 0,
        // The instance matrices and colours (on the GPU and copied here),
        // the plates' outlines, the walls, the debris map (half floats on
        // the GPU, a float copy here and the half floats it is sent from),
        // the chunks' numbers and the parcels' notes.
        bytes:
          (inst * (64 + 12) + outline) * 2 +
          walls * 2 +
          texels * 2 +
          map.byteLength +
          half.byteLength +
          geo +
          traits.byteLength +
          starts.byteLength * 3,
        // What of it lies on the GPU.
        gpu: inst * (64 + 12) + outline + walls + texels * 2 + geo,
        texels,
      };
    },
    dispose() {
      plates?.dispose();
      chunks?.dispose();
      body?.dispose();
      plateGeo?.dispose();
      lumpGeo?.dispose();
      heapGeo?.dispose();
      wall?.geometry.dispose();
      wallMat?.dispose();
      bodyMat?.dispose();
      material?.dispose();
      plateMat?.dispose();
      texture?.dispose();
      if (u.uSlide.value === texture) u.uSlide.value = null;
      u.uSlideOn.value.set(0, 0, 0, 0);
    },
  };
}
