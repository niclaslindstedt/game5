// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK KIT AS DRAWN — the engine's pieces (`rock-kit.ts`' `kitStones`:
// the walls built of slabs, buttress prisms, blocks and wedges, and the
// talus under them) INSTANCED: one draw a piece and a cut, whatever the
// number of stones, out of a kit of eight pieces at three cuts built once.
//
// The map is cut into the engine's kit CELLS, each laid when it first comes
// within `REACH` m of the lens (sliced, `SLICE` ms a frame, the nearest
// first; within `NOW` m at once) and let go well out of it. Every frame a
// cell is CULLED against the lens's frustum, and a cell of wall alone that
// turns its back to the lens with it; the rest are drawn at the CUT their
// distance asks (`CUT_OUT`: the bevelled near cut, the plain one, the far
// handful of corners), changed only past a margin. Past `FADE_FROM` m every
// stone SINKS back into its wall (scaled about its buried back in the
// vertex shader), gone by `FADE_TO`: the far wall is the skin's and the
// snow shader's paint, and nothing pops off it.
//
// Painted in its own material, no texture: the prototype's corners carry
// their cavity (the buried back and the undersides dark), each stone its
// shade (bands along its bed, streaks down the fall line, a warm iron
// stain) and the shader lays the snow on every face that holds it — the
// SAME up share the physics calls bare (`ROCKS.skin.holds`) — and rime on
// the faces turned into the wind.

import * as THREE from "three";
import {
  ROCKS,
  kitStones,
  rockPieces,
  windAt,
  type Hull,
  type KitStone,
  type Level,
} from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { rockTone, type Tone } from "./rock-shapes.ts";
import { summerShown } from "./season-look.ts";

/** How far out cells are laid, m. */
const REACH = 600;
/** Within this a cell is laid at once, m. */
const NOW = 120;
/** The laying's share of a frame, ms. */
const SLICE = 1.2;
/** The cuts by distance from the lens to a cell's middle, m. */
export const CUT_OUT = [70, 260, Infinity] as const;
const MARGIN = 12;
/** The stones sink into the wall from here, gone by there, m. */
export const FADE_FROM = 380;
export const FADE_TO = 520;
/** Cells kept laid past the reach, m, before they are let go. */
const KEEP = 250;

/** A piece's cut as a flat-shaded geometry, its cavity in the colour. */
function cutGeometry(h: Hull, piece: number, cut: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  h.tris.forEach(([i, j, k], f) => {
    const a = h.points[i];
    const b = h.points[j];
    const c = h.points[k];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1];
    let ny = e1[2] * e2[0] - e1[0] * e2[2];
    let nz = e1[0] * e2[1] - e1[1] * e2[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    // A fracture face of its own shade, a few per cent either way.
    const hh = Math.imul(piece * 97 + f + 1, 0x9e3779b1) >>> 0;
    const face = 0.9 + 0.2 * ((hh >>> 8) / 16777216);
    for (const p of [a, b, c]) {
      pos.push(p[0], p[1], p[2]);
      nrm.push(nx, ny, nz);
      // Dark at the buried back and on the faces turned into the wall.
      const ao = (0.55 + 0.45 * Math.min(1, p[1] * 1.15)) * (0.8 + 0.2 * Math.max(0, ny + 0.5));
      const k = ao * face;
      col.push(k, k, k);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  g.userData.cut = cut;
  return g;
}

type Cell = {
  readonly ci: number;
  readonly cj: number;
  /** Its middle, and how far any stone of it reaches from it. */
  readonly c: THREE.Vector3;
  readonly r: number;
  /** Per piece: its stones' matrices (16 a stone) and colours (3). */
  readonly mats: Float32Array[];
  readonly cols: Float32Array[];
  readonly count: number;
  /** The wall's mean facing and how far its pieces turn off it (a cosine),
   * or null for a cell with talus in it. */
  readonly cone: THREE.Vector3 | null;
  readonly spread: number;
  cut: number;
};

export type RockKit = {
  readonly group: THREE.Group;
  update(eye: THREE.Vector3, camera: THREE.Camera | null): void;
  /** Lay every cell within reach of the last lens at once (the lab's). */
  settle(): void;
  /** What it holds: bytes, prototype triangles, stones laid, build ms. */
  readonly stats: { bytes: number; triangles: number; stones: number; buildMs: number };
  dispose(): void;
};

export function createRockKit(level: Level, haze: HazeUniforms, band: Tone): RockKit {
  const group = new THREE.Group();
  group.name = "rock-kit";
  const pieces = rockPieces();
  const stats = { bytes: 0, triangles: 0, stones: 0, buildMs: 0 };
  const stone = rockTone(band);
  const summer = summerShown();
  const wind = windAt(level, 0);
  const wl = Math.hypot(wind.x, wind.z) || 1;
  const uniforms = {
    uKitSnow: {
      value: summer ? new THREE.Color(0.15, 0.17, 0.1) : new THREE.Color(0.93, 0.96, 1.0),
    },
    uKitCover: { value: summer ? 0.5 : 1 },
    // The wind the snow is blown from: the rime is on the faces into it.
    uKitWind: { value: new THREE.Vector2(-wind.x / wl, -wind.z / wl) },
    uKitRime: { value: summer ? 0 : Math.min(1, 0.25 + wind.speed / 14) },
  };
  const S = ROCKS.skin;
  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    haze,
    "rock-kit",
    (shader) => {
      PAST_THE_WALL(shader);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        /* glsl */ `
vec3 transformed = vec3(position);
{
  // Sunk back into its wall with distance: scaled about its buried back.
  vec3 kitAt = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  float kitD = distance(kitAt, cameraPosition);
  transformed *= 1.0 - smoothstep(${FADE_FROM.toFixed(1)}, ${FADE_TO.toFixed(1)}, kitD);
}
`,
      );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          /* glsl */ `#include <common>
uniform vec3 uKitSnow;
uniform float uKitCover;
uniform vec2 uKitWind;
uniform float uKitRime;
`,
        )
        .replace(
          "#include <color_fragment>",
          /* glsl */ `#include <color_fragment>
{
  // The face's own facing in the world, off the world position's slope
  // across the pixel (every face is flat).
  vec3 kitN = normalize(cross(dFdx(vHazeWorld), dFdy(vHazeWorld)));
  if (dot(kitN, cameraPosition - vHazeWorld) < 0.0) kitN = -kitN;
  float kitSnow = uKitCover * smoothstep(${(S.slides - 0.02).toFixed(3)}, ${S.holds.toFixed(3)}, kitN.y);
  // Plastered on the faces into the wind, on the steep ones too.
  float kitRime = uKitRime * smoothstep(0.35, 0.85, dot(kitN.xz, uKitWind)) * (1.0 - kitSnow) * 0.55;
  diffuseColor.rgb = mix(diffuseColor.rgb, uKitSnow, clamp(kitSnow + kitRime, 0.0, 1.0));
}
`,
        );
    },
  );

  // Eight pieces, three cuts: 24 instanced draws at the most.
  const geoms = pieces.map((p, i) => p.cuts.map((h, c) => cutGeometry(h, i, c)));
  const meshes: THREE.InstancedMesh[][] = geoms.map((gs) =>
    gs.map((g, c) => {
      const im = new THREE.InstancedMesh(g, material, 16);
      im.count = 0;
      im.frustumCulled = false;
      im.matrixAutoUpdate = false;
      im.receiveShadow = true;
      im.castShadow = c < 2;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(16 * 3), 3);
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      im.visible = false;
      group.add(im);
      stats.bytes += (g.getAttribute("position").count * 9 + 16 * 19) * 4;
      stats.triangles += g.getAttribute("position").count / 3;
      return im;
    }),
  );

  const cellSize = ROCKS.kit.cell;
  const cols = Math.ceil(level.size / cellSize);
  const cells = new Map<number, Cell | null>();
  const keyOf = (ci: number, cj: number): number => cj * cols + ci;

  const lay = (ci: number, cj: number): Cell | null => {
    const t0 = performance.now();
    const stones = kitStones(level, ci, cj);
    const cell = stones.length ? cellOf(ci, cj, stones) : null;
    stats.buildMs += performance.now() - t0;
    if (cell) {
      stats.stones += cell.count;
      stats.bytes += cell.count * 19 * 4;
    }
    return cell;
  };

  const cellOf = (ci: number, cj: number, stones: KitStone[]): Cell => {
    const per = pieces.map(() => [] as KitStone[]);
    for (const s of stones) per[s.piece].push(s);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let talus = false;
    const n = new THREE.Vector3();
    for (const s of stones) {
      cx += s.m[9];
      cy += s.m[10];
      cz += s.m[11];
      talus ||= s.talus;
      const l = Math.hypot(s.m[3], s.m[4], s.m[5]);
      n.x += s.m[3] / l;
      n.y += s.m[4] / l;
      n.z += s.m[5] / l;
    }
    const c = new THREE.Vector3(cx, cy, cz).multiplyScalar(1 / stones.length);
    let r = 0;
    let spread = 1;
    n.normalize();
    for (const s of stones) {
      r = Math.max(r, Math.hypot(s.m[9] - c.x, s.m[10] - c.y, s.m[11] - c.z) + s.r);
      const l = Math.hypot(s.m[3], s.m[4], s.m[5]);
      spread = Math.min(spread, (s.m[3] * n.x + s.m[4] * n.y + s.m[5] * n.z) / l);
    }
    const mats = per.map((list) => {
      const a = new Float32Array(list.length * 16);
      list.forEach((s, i) => {
        const m = s.m;
        a.set(
          [m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, m[9], m[10], m[11], 1],
          i * 16,
        );
      });
      return a;
    });
    const colours = per.map((list) => {
      const a = new Float32Array(list.length * 3);
      list.forEach((s, i) => {
        const f = 0.6 + 0.65 * s.shade;
        // Iron: a warm stain where the draw runs warm.
        const iron = Math.max(0, s.warm - 0.45) * 0.5;
        a[i * 3] = stone[0] * f * (1 + 0.06 * s.warm + iron * 0.9);
        a[i * 3 + 1] = stone[1] * f * (1 + iron * 0.25);
        a[i * 3 + 2] = stone[2] * f * (1 - 0.06 * s.warm - iron * 0.5);
      });
      return a;
    });
    return {
      ci,
      cj,
      c,
      r,
      mats,
      cols: colours,
      count: stones.length,
      cone: talus ? null : n,
      spread,
      cut: -1,
    };
  };

  const frustum = new THREE.Frustum();
  const projView = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  let lastEye: THREE.Vector3 | null = null;
  let lastSig = "";
  const toEye = new THREE.Vector3();

  const cutOf = (d: number, had: number): number => {
    let k = CUT_OUT.findIndex((o) => d < o);
    if (had >= 0 && k !== had) {
      const edge = k > had ? CUT_OUT[had] + MARGIN : CUT_OUT[k] - MARGIN;
      if (k > had ? d < edge : d > edge) k = had;
    }
    return k;
  };

  /** The cells within `reach` of the eye in plan, nearest first. */
  const within = (eye: THREE.Vector3, reach: number): [number, number, number][] => {
    const out: [number, number, number][] = [];
    const i0 = Math.max(0, Math.floor((eye.x - reach) / cellSize));
    const i1 = Math.min(cols - 1, Math.floor((eye.x + reach) / cellSize));
    const j0 = Math.max(0, Math.floor((eye.z - reach) / cellSize));
    const j1 = Math.min(cols - 1, Math.floor((eye.z + reach) / cellSize));
    for (let cj = j0; cj <= j1; cj++) {
      for (let ci = i0; ci <= i1; ci++) {
        const dx = Math.max(0, Math.abs(eye.x - (ci + 0.5) * cellSize) - cellSize / 2);
        const dz = Math.max(0, Math.abs(eye.z - (cj + 0.5) * cellSize) - cellSize / 2);
        const d2 = dx * dx + dz * dz;
        if (d2 < reach * reach) out.push([ci, cj, d2]);
      }
    }
    return out.sort((a, b) => a[2] - b[2]);
  };

  const refill = (shown: Cell[]): void => {
    for (let p = 0; p < pieces.length; p++) {
      for (let c = 0; c < 3; c++) {
        const im = meshes[p][c];
        let n = 0;
        for (const cell of shown) if (cell.cut === c) n += cell.mats[p].length / 16;
        if (n > im.instanceMatrix.count) {
          const room = Math.ceil(n * 1.5);
          stats.bytes += (room - im.instanceMatrix.count) * 19 * 4;
          im.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(room * 16), 16);
          im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(room * 3), 3);
          im.instanceColor.setUsage(THREE.DynamicDrawUsage);
        }
        const ma = im.instanceMatrix.array as Float32Array;
        const ca = im.instanceColor!.array as Float32Array;
        let k = 0;
        for (const cell of shown) {
          if (cell.cut !== c) continue;
          ma.set(cell.mats[p], k * 16);
          ca.set(cell.cols[p], k * 3);
          k += cell.mats[p].length / 16;
        }
        im.count = n;
        im.visible = n > 0;
        if (!n) continue;
        im.instanceMatrix.clearUpdateRanges();
        im.instanceMatrix.addUpdateRange(0, n * 16);
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor!.clearUpdateRanges();
        im.instanceColor!.addUpdateRange(0, n * 3);
        im.instanceColor!.needsUpdate = true;
      }
    }
  };

  const show = (eye: THREE.Vector3, camera: THREE.Camera | null): void => {
    if (camera) {
      camera.updateMatrixWorld();
      projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projView);
    }
    const shown: Cell[] = [];
    let sig = "";
    for (const [ci, cj] of within(eye, FADE_TO + cellSize)) {
      const cell = cells.get(keyOf(ci, cj));
      if (!cell) continue;
      sphere.set(cell.c, cell.r);
      if (camera && !frustum.intersectsSphere(sphere)) continue;
      // A wall turned away whole: every piece of it faces off the lens.
      if (cell.cone) {
        toEye.subVectors(eye, cell.c);
        const d = toEye.length();
        if (
          d > cell.r * 2 &&
          toEye.dot(cell.cone) / d < -Math.sqrt(1 - cell.spread * cell.spread) - 0.25
        ) {
          continue;
        }
      }
      const d = Math.max(0, eye.distanceTo(cell.c) - cell.r * 0.5);
      if (d > FADE_TO) continue;
      cell.cut = cutOf(d, cell.cut);
      shown.push(cell);
      sig += `${ci},${cj},${cell.cut};`;
    }
    if (sig !== lastSig) {
      lastSig = sig;
      refill(shown);
    }
  };

  return {
    group,
    stats,
    update(eye, camera) {
      lastEye = eye.clone();
      // Lay what is owed: the near at once, the next slice by slice.
      const until = performance.now() + SLICE;
      for (const [ci, cj, d2] of within(eye, REACH)) {
        const key = keyOf(ci, cj);
        if (cells.has(key)) continue;
        if (d2 < NOW * NOW || performance.now() < until) cells.set(key, lay(ci, cj));
      }
      // Let go what is well out of reach.
      for (const [key, cell] of cells) {
        if (!cell) continue;
        const dx = Math.max(0, Math.abs(eye.x - cell.c.x) - cellSize);
        const dz = Math.max(0, Math.abs(eye.z - cell.c.z) - cellSize);
        if (dx * dx + dz * dz > (REACH + KEEP) ** 2) {
          stats.stones -= cell.count;
          stats.bytes -= cell.count * 19 * 4;
          cells.delete(key);
        }
      }
      show(eye, camera);
    },
    settle() {
      if (!lastEye) return;
      for (const [ci, cj] of within(lastEye, REACH)) {
        const key = keyOf(ci, cj);
        if (!cells.has(key)) cells.set(key, lay(ci, cj));
      }
      lastSig = "";
    },
    dispose() {
      for (const gs of geoms) for (const g of gs) g.dispose();
      for (const ms of meshes) for (const m of ms) m.dispose();
      material.dispose();
    },
  };
}
