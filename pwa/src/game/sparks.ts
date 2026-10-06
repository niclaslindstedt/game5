// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SPARKS AND EMBERS — the glowing bits a crash throws (`explosion.ts`):
// the SPARKS (burning metal and fuel droplets flung out of a blast, and
// struck off a piece of airframe skidding on ice and rock) — white-hot,
// fast, gone in under a second — and the EMBERS a fire lofts, orange and
// slow, carried up in its plume. Each is drawn as a glowing head and a
// streak behind it along its way (what a lens open for a frame sees of a
// spark), one draw call for the heads and one for the streaks, from a
// fixed pool: nothing allocates once it is built. Presentation only.

import * as THREE from "three";

import { glow } from "./glow-sprite.ts";

/** THE POOL, and how a spark lives: its colour cooling from white heat
 * through yellow and orange to a dull red (RGB at birth, at mid-life and
 * at death — over one so the tone map keeps it glowing), the drag of the
 * air on it, 1/s, and the streak drawn behind it, s of its way. */
export const SPARK = {
  pool: 900,
  hot: [5, 4.2, 2.6] as const,
  warm: [3.4, 1.6, 0.45] as const,
  cold: [0.9, 0.18, 0.04] as const,
  drag: 1.4,
  streak: 0.045,
  /** An ember's lift in the plume, m/s², and its drag. */
  emberLift: 11,
  emberDrag: 1.1,
  /** The heads' size, m. */
  size: 0.28,
} as const;

export type Sparks = {
  group: THREE.Group;
  /** One spark at (x, y, z) going (vx, vy, vz), living `life` s; `ember`
   * a slow one the plume carries up. */
  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    ember?: boolean,
  ): void;
  update(dt: number, groundAt: (x: number, z: number) => number): void;
  clear(): void;
  dispose(): void;
};

export function createSparks(): Sparks {
  const N = SPARK.pool;
  const group = new THREE.Group();
  group.name = "sparks";
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const age = new Float32Array(N);
  const life = new Float32Array(N);
  const ember = new Uint8Array(N);
  const headPos = new Float32Array(N * 3);
  const headCol = new Float32Array(N * 3);
  const linePos = new Float32Array(N * 6);
  const lineCol = new Float32Array(N * 6);
  const heads = new THREE.BufferGeometry();
  heads.setAttribute("position", new THREE.BufferAttribute(headPos, 3));
  heads.setAttribute("color", new THREE.BufferAttribute(headCol, 3));
  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lines.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
  const headMat = new THREE.PointsMaterial({
    size: SPARK.size,
    map: glow(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    fog: false,
  });
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const points = new THREE.Points(heads, headMat);
  const streaks = new THREE.LineSegments(lines, lineMat);
  points.frustumCulled = streaks.frustumCulled = false;
  points.renderOrder = streaks.renderOrder = 10;
  group.add(points, streaks);
  let next = 0;
  let live = 0;

  const colour = (k: number, out: Float32Array, at: number, dim: number): void => {
    const [a, b] = k < 0.35 ? [SPARK.hot, SPARK.warm] : [SPARK.warm, SPARK.cold];
    const t = k < 0.35 ? k / 0.35 : (k - 0.35) / 0.65;
    const fade = k > 0.75 ? (1 - k) / 0.25 : 1;
    for (let c = 0; c < 3; c++) out[at + c] = (a[c] + (b[c] - a[c]) * t) * fade * dim;
  };

  return {
    group,
    emit(x, y, z, vx, vy, vz, l, isEmber = false) {
      const i = next;
      next = (next + 1) % N;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;
      age[i] = 0;
      life[i] = l;
      ember[i] = isEmber ? 1 : 0;
    },
    update(dt, groundAt) {
      const was = live;
      live = 0;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        age[i] += dt;
        if (age[i] >= life[i]) {
          life[i] = 0;
          continue;
        }
        const j = i * 3;
        const e = ember[i] === 1;
        const drag = Math.exp(-(e ? SPARK.emberDrag : SPARK.drag) * dt);
        vel[j] *= drag;
        vel[j + 2] *= drag;
        vel[j + 1] = vel[j + 1] * drag + (e ? SPARK.emberLift * drag - 9.81 : -9.81) * dt;
        pos[j] += vel[j] * dt;
        pos[j + 1] += vel[j + 1] * dt;
        pos[j + 2] += vel[j + 2] * dt;
        const g = groundAt(pos[j], pos[j + 2]);
        if (pos[j + 1] < g + 0.03) {
          // Into the snow: a spark skips once off a hard crust and dies in
          // the powder.
          pos[j + 1] = g + 0.03;
          vel[j + 1] = Math.abs(vel[j + 1]) * 0.2;
          vel[j] *= 0.5;
          vel[j + 2] *= 0.5;
          age[i] = Math.max(age[i], life[i] * 0.8);
        }
        const k = age[i] / life[i];
        const h = live * 3;
        headPos[h] = pos[j];
        headPos[h + 1] = pos[j + 1];
        headPos[h + 2] = pos[j + 2];
        colour(e ? 0.35 + k * 0.65 : k, headCol, h, e ? 0.8 : 1);
        const s = live * 6;
        const tail = e ? SPARK.streak * 0.5 : SPARK.streak;
        linePos[s] = pos[j];
        linePos[s + 1] = pos[j + 1];
        linePos[s + 2] = pos[j + 2];
        linePos[s + 3] = pos[j] - vel[j] * tail;
        linePos[s + 4] = pos[j + 1] - vel[j + 1] * tail;
        linePos[s + 5] = pos[j + 2] - vel[j + 2] * tail;
        colour(e ? 0.35 + k * 0.65 : k, lineCol, s, 1);
        colour(Math.min(1, (e ? 0.35 + k * 0.65 : k) + 0.3), lineCol, s + 3, 0.25);
        live++;
      }
      if (live === 0 && was === 0) return;
      heads.setDrawRange(0, live);
      lines.setDrawRange(0, live * 2);
      for (const g of [heads, lines]) {
        (g.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
        (g.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
      }
      points.visible = streaks.visible = live > 0;
    },
    clear() {
      life.fill(0);
      live = 0;
      heads.setDrawRange(0, 0);
      lines.setDrawRange(0, 0);
      points.visible = streaks.visible = false;
    },
    dispose() {
      heads.dispose();
      lines.dispose();
      headMat.dispose();
      lineMat.dispose();
    },
  };
}
