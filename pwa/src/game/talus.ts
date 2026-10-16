// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TALUS AS DRAWN — the stones `talus-plan.ts` lays below the walls,
// in ONE draw: every stone within the FOREST row's reach of the lens
// merged into one mesh in the world's own frame, faceted, at two cuts (a
// chipped twenty-faced block near, an eight-faced one past `FAR` m),
// shaded by the crags' own material (`rocks.ts`, so a stone is the wall
// it fell from: its laminae tilted with it, its joints, rime and lichen),
// the snow lying on its up-facing facets. The mesh is merged afresh when
// the lens has moved `MOVE` m, from the squares of the plan within reach
// (planned one a frame past the near ones, `talusTile`); in the vertex
// shader every stone is buried deeper the deeper the run's loose snow and
// new snow lie, and SINKS into the snow over the reach's last quarter, so
// nothing pops in or out on the approach. Presentation only: the physics
// never reads a stone, and none lies on a run.

import * as THREE from "three";
import type { Level } from "@engine";
import { ROCK_SNOW, rockTone, type Tone } from "./rock-shapes.ts";
import { summerShown } from "./season-look.ts";
import type { RockLook } from "./settings-video.ts";
import { TALUS_SHAPES, TALUS_TILE, talusTile, type TalusStone } from "./talus-plan.ts";

/** Past this many m a stone is drawn at its eight-faced cut. */
const FAR = 110;
/** The lens moves this many m before the mesh is merged again. */
const MOVE = 24;
/** The squares within this many m of the lens are planned at once. */
const NEAR = 160;

type Shape = readonly (readonly [number, number, number])[];

/** A unit block's triangles: an icosahedron or an octahedron, each corner
 * pushed in or out off a hash so no two shapes are one stone. */
function shapeOf(k: number, far: boolean): Shape {
  const t = (1 + Math.sqrt(5)) / 2;
  const ico: [number, number, number][] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  const icoF = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  const oct: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const octF = [
    [2, 4, 0],
    [2, 0, 5],
    [2, 5, 1],
    [2, 1, 4],
    [3, 0, 4],
    [3, 5, 0],
    [3, 1, 5],
    [3, 4, 1],
  ];
  const vs = far ? oct : ico;
  const fs = far ? octF : icoF;
  const r = vs.map((v, i) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    // A chip: a hash a corner, the same corner for both cuts' axes.
    const h = Math.sin((k + 1) * 12.9898 + i * 78.233) * 43758.5453;
    const j = 0.78 + 0.4 * (h - Math.floor(h));
    return [(v[0] / l) * j, (v[1] / l) * j, (v[2] / l) * j] as const;
  });
  const out: (readonly [number, number, number])[] = [];
  for (const f of fs) out.push(r[f[0]], r[f[1]], r[f[2]]);
  return out;
}

const SHAPES = Array.from({ length: TALUS_SHAPES }, (_, k) => [
  shapeOf(k, false),
  shapeOf(k, true),
]);

/** Per vertex: position, normal, colour, the calm normal and colour, the
 * strata coordinates and the stone (its ground point and height). */
type Bufs = {
  pos: number[];
  nrm: number[];
  col: number[];
  soft: number[];
  calm: number[];
  bed: number[];
  stone: number[];
};

function emitStone(b: Bufs, s: TalusStone, far: boolean, stone: Tone, winter: number): void {
  const shape = SHAPES[s.shape][far ? 1 : 0];
  // The stone's frame: its own axes yawed, then its up turned onto `u`.
  const cy = Math.cos(s.yaw);
  const sy = Math.sin(s.yaw);
  const ux = s.ux;
  const uy = s.uy;
  const uz = s.uz;
  // The rotation taking +y to u (about the axis y × u).
  const ax = uz;
  const az = -ux;
  const al = Math.hypot(ax, az);
  const c = uy;
  const sn = al;
  const kx = al > 1e-6 ? ax / al : 1;
  const kz = al > 1e-6 ? az / al : 0;
  const rot = (x: number, y: number, z: number): [number, number, number] => {
    // Yaw about y.
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    // Rodrigues about (kx, 0, kz).
    const dot = kx * x1 + kz * z1;
    const cxp = 0 * z1 - kz * y; // k × v, x
    const cyp = kz * x1 - kx * z1; // k × v, y
    const czp = kx * y - 0 * x1; // k × v, z
    return [
      x1 * c + cxp * sn + kx * dot * (1 - c),
      y * c + cyp * sn,
      z1 * c + czp * sn + kz * dot * (1 - c),
    ];
  };
  const ox = s.x;
  const oy = s.y - s.bury;
  const oz = s.z;
  const k = s.shade;
  const warm = 1 + 0.06 * s.warm;
  const base: Tone = [stone[0] * k * warm, stone[1] * k, (stone[2] * k) / warm];
  const mean: Tone = [stone[0] * 0.8, stone[1] * 0.8, stone[2] * 0.8];
  const over = summerShown() ? ([0.15, 0.17, 0.1] as Tone) : ROCK_SNOW;
  const most = summerShown() ? 0.5 : 0.9;
  // The bedding tilted with the stone (its own local axis), and an offset
  // so no two stones' laminae line up.
  const off = (s.yaw * 7.3) % 5;
  const h = s.sy * 2;
  for (let t = 0; t < shape.length; t += 3) {
    const w: [number, number, number][] = [];
    const lw: [number, number, number][] = [];
    for (let q = 0; q < 3; q++) {
      const v = shape[t + q];
      const lx = v[0] * s.sx;
      const ly = v[1] * s.sy;
      const lz = v[2] * s.sz;
      const r = rot(lx, ly, lz);
      w.push([ox + r[0], oy + r[1], oz + r[2]]);
      lw.push([lx, ly, lz]);
    }
    const ex = w[1][0] - w[0][0];
    const ey = w[1][1] - w[0][1];
    const ez = w[1][2] - w[0][2];
    const fx = w[2][0] - w[0][0];
    const fy = w[2][1] - w[0][1];
    const fz = w[2][2] - w[0][2];
    let nx = ey * fz - ez * fy;
    let ny = ez * fx - ex * fz;
    let nz = ex * fy - ey * fx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    // The snow lies on what faces up (a cap), none on a flank.
    const snow = winter * most * Math.max(0, Math.min(1, (ny - 0.5) / 0.35));
    for (let q = 0; q < 3; q++) {
      const v = shape[t + q];
      const p = w[q];
      b.pos.push(p[0], p[1], p[2]);
      b.nrm.push(nx, ny, nz);
      b.col.push(
        base[0] * (1 - snow) + over[0] * snow,
        base[1] * (1 - snow) + over[1] * snow,
        base[2] * (1 - snow) + over[2] * snow,
      );
      // The calm normal: the block's own round, its corner's direction.
      const sv = rot(v[0] / s.sx, v[1] / s.sy, v[2] / s.sz);
      const sl = Math.hypot(sv[0], sv[1], sv[2]) || 1;
      b.soft.push(sv[0] / sl, sv[1] / sl, sv[2] / sl);
      const even = winter * most * Math.max(0, Math.min(1, (sv[1] / sl - 0.5) / 0.35));
      b.calm.push(
        mean[0] * (1 - even) + over[0] * even,
        mean[1] * (1 - even) + over[1] * even,
        mean[2] * (1 - even) + over[2] * even,
      );
      // A wall's coordinates (-1): the laminae across its own height, the
      // joints along its length, a crack or two a stone.
      b.bed.push(lw[q][1] + off, (lw[q][0] + lw[q][2]) / 1.6, -1);
      b.stone.push(s.x, s.y, s.z, h);
    }
  }
}

export type Talus = {
  readonly mesh: THREE.Mesh;
  /** Merge what is within reach of the lens, when it has moved. */
  update(eye: THREE.Vector3): void;
  setLook(look: RockLook): void;
  /** Every square in reach planned and merged now (the lab's settle). */
  settle(): void;
  readonly stats: { stones: number; triangles: number };
  dispose(): void;
};

/** The talus of `level` in the region's rock `tone`, drawn by `material`
 * (the crags' own, with the talus's sinking), its reach in `reach.value.x`. */
export function createTalus(
  level: Level,
  tone: Tone,
  material: THREE.Material,
  reach: { value: THREE.Vector4 },
  look: RockLook,
): Talus {
  const stone = rockTone(tone);
  const geometry = new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "talus";
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.visible = false;
  let share = look.talus.share;
  reach.value.x = look.talus.reach;
  const stats = { stones: 0, triangles: 0 };
  const cols = Math.ceil(level.size / TALUS_TILE);
  const planned = new Set<number>();
  let last: THREE.Vector3 | null = null;
  let dirty = true;

  const tilesNear = (eye: THREE.Vector3, r: number): number[] => {
    const out: number[] = [];
    const i0 = Math.max(0, Math.floor((eye.x - r) / TALUS_TILE));
    const i1 = Math.min(cols - 1, Math.floor((eye.x + r) / TALUS_TILE));
    const j0 = Math.max(0, Math.floor((eye.z - r) / TALUS_TILE));
    const j1 = Math.min(cols - 1, Math.floor((eye.z + r) / TALUS_TILE));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = Math.max(0, Math.abs(eye.x - (i + 0.5) * TALUS_TILE) - TALUS_TILE / 2);
        const dz = Math.max(0, Math.abs(eye.z - (j + 0.5) * TALUS_TILE) - TALUS_TILE / 2);
        if (dx * dx + dz * dz < r * r) out.push(j * cols + i);
      }
    }
    return out;
  };

  const merge = (eye: THREE.Vector3): void => {
    const r = reach.value.x;
    const b: Bufs = { pos: [], nrm: [], col: [], soft: [], calm: [], bed: [], stone: [] };
    const winter = summerShown() ? 0 : 1;
    let stones = 0;
    for (const key of tilesNear(eye, r)) {
      if (!planned.has(key)) continue;
      const list = talusTile(level, key % cols, Math.floor(key / cols));
      for (const s of list) {
        // The share drawn: the smallest let go first (a stone's own draw
        // against its size's rank).
        if (share < 1 && s.sy * 2 < 1.6 * (1 - share) + (s.shade - 0.62) * 0.5) continue;
        const d = Math.hypot(s.x - eye.x, s.y - eye.y, s.z - eye.z);
        if (d > r) continue;
        emitStone(b, s, d > FAR, stone, winter);
        stones++;
      }
    }
    const set = (name: string, a: number[], n: number): void => {
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(a, n));
    };
    set("position", b.pos, 3);
    set("normal", b.nrm, 3);
    set("color", b.col, 3);
    set("soft", b.soft, 3);
    set("calm", b.calm, 3);
    set("strata", b.bed, 3);
    set("stone", b.stone, 4);
    stats.stones = stones;
    stats.triangles = b.pos.length / 9;
    mesh.visible = stones > 0;
    last = eye.clone();
    dirty = false;
  };

  return {
    mesh,
    stats,
    update(eye) {
      const r = reach.value.x;
      if (r <= 0) {
        mesh.visible = false;
        return;
      }
      // The near squares at once; the next one owed, one a frame.
      let fresh = false;
      for (const key of tilesNear(eye, Math.min(r, NEAR))) {
        if (planned.has(key)) continue;
        talusTile(level, key % cols, Math.floor(key / cols));
        planned.add(key);
        fresh = true;
      }
      if (!fresh) {
        for (const key of tilesNear(eye, r + MOVE)) {
          if (planned.has(key)) continue;
          talusTile(level, key % cols, Math.floor(key / cols));
          planned.add(key);
          fresh = true;
          break;
        }
      }
      if (dirty || fresh || !last || last.distanceToSquared(eye) > MOVE * MOVE) merge(eye);
    },
    setLook(next) {
      if (next.talus.reach === reach.value.x && next.talus.share === share) return;
      reach.value.x = next.talus.reach;
      share = next.talus.share;
      dirty = true;
    },
    settle() {
      if (!last) return;
      for (const key of tilesNear(last, reach.value.x + MOVE)) {
        if (planned.has(key)) continue;
        talusTile(level, key % cols, Math.floor(key / cols));
        planned.add(key);
      }
      merge(last);
    },
    dispose() {
      geometry.dispose();
    },
  };
}
