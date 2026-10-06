// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABINS AS DRAWN — every log building of the map (`cabinsOf`, the
// engine's: where each stands, which way it faces, its floor), built once a
// kind at two cuts (`cabin-shapes.ts`) and INSTANCED: a draw a kind and
// cut, however many stand on the mountain. Each building takes its near cut
// inside `NEAR` metres of the lens and its far cut past it (a few metres of
// hysteresis, so a lens hovering on the line does not flicker it); the
// instances are refilled only when a building changes band.
//
// THE DRIFT: every building's plinth has the snow banked up against it
// all round — a skirt cut for the building where it stands, off the
// ground under it (`level.groundAt`), so the bank follows the slope that
// one instanced shape cannot; low across the front, where the steps are.
// All of them are one mesh for the map.
//
// THE WINDOWS ARE LIT AT NIGHT: every pane carries a GLOW mark, and the
// material adds a warm lamplight to it as the piste lights come on (the
// same `uPisteOn` the snow reads), so a map skied after dark has its cabins'
// windows burning from across the valley.

import * as THREE from "three";
import { CABINS, cabinsOf, type Cabin, type CabinKind, type Level } from "@engine";

import { CABIN_PAINT } from "./cabin-parts.ts";

import { buildCabin, porchOf, type CabinLod } from "./cabin-shapes.ts";
import { lodgeYardGeometry } from "./lodge-yard.ts";
import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { LUX_TO_LAMP } from "./piste-lights.ts";

/** Where a building hands its near cut over to its far, m, and the band
 * either side of it it keeps the cut it has. */
const NEAR = 190;
const HYSTERESIS = 12;

/** The lamplight in a window, linear, and how bright at full dark. */
const LAMP = "vec3(1.0, 0.56, 0.24)";
const LAMP_BRIGHT = 1.5;

/** A pane's glow, in the material: the mark through to the fragment, and
 * the lamplight added as the dark comes on. */
export function graftGlow(shader: THREE.WebGLProgramParametersWithUniforms): void {
  PAST_THE_WALL(shader);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float glow;\nvarying float vGlow;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = glow;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying float vGlow;")
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
  totalEmissiveRadiance += vGlow * ${LAMP} * ${LAMP_BRIGHT.toFixed(2)} * clamp(uPisteOn.x / ${LUX_TO_LAMP.toFixed(6)}, 0.0, 1.0);`,
    );
}

/** The drift: how far out from the plinth it runs, m, how high up it the
 * snow is banked over the ground at its foot, and how near the floor it
 * may come (the stone a course above it showing); across the front, how
 * far below the floor it stops, clear of the steps. */
const DRIFT = { reach: 0.9, bank: 0.3, belowFloor: 0.08, front: 0.52, step: 0.7 };

/** The plinth's outline in the building's frame — the walls and, under a
 * porch, its deck: its half-width, and its front and back. */
function plinthOutline(kind: CabinKind): { half: number; front: number; back: number } {
  const d = CABINS[kind];
  const porch = porchOf(kind);
  const wide = kind === "afterski" ? 0.6 : 0;
  return {
    half: d.width / 2 + wide + 0.08,
    front: d.depth / 2 + porch + 0.08,
    back: -d.depth / 2 - 0.08,
  };
}

/** THE DRIFTS of every building of `level`, as one geometry in the world
 * frame: three rings round each plinth — at its face, part way out and
 * at the foot — the snow banked to `DRIFT.bank` over the ground at its
 * face and run out into the slope. */
export function driftGeometry(level: Level, cabins: readonly Cabin[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  // A shade under the roofs' snow: the bank is in the wall's shadow half
  // the day, and a pure white skirt reads as a plate laid on the slope.
  const snow = CABIN_PAINT.snow.clone().multiplyScalar(0.9);
  for (const c of cabins) {
    const o = plinthOutline(c.kind);
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    // Round the outline: (local x, local z, outward x, outward z, front?).
    const ring: [number, number, number, number, boolean][] = [];
    const edge = (
      x0: number,
      z0: number,
      x1: number,
      z1: number,
      nx: number,
      nz: number,
      front: boolean,
    ): void => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / DRIFT.step));
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // A corner's ring point runs out along the diagonal.
        const k = i === 0 ? Math.SQRT1_2 : 1;
        const cx = i === 0 ? (nx - nz) * k : nx;
        const cz = i === 0 ? (nz + nx) * k : nz;
        ring.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, cx, cz, front]);
      }
    };
    // Clockwise from above, starting at the front-left corner.
    edge(-o.half, o.front, o.half, o.front, 0, 1, true);
    edge(o.half, o.front, o.half, o.back, 1, 0, false);
    edge(o.half, o.back, -o.half, o.back, 0, -1, false);
    edge(-o.half, o.back, -o.half, o.front, -1, 0, false);
    const first = pos.length / 3;
    for (const [lx, lz, nx, nz, front] of ring) {
      const at = (r: number): [number, number] => {
        const x = lx + nx * r;
        const z = lz + nz * r;
        return [c.x + x * fz + z * fx, c.z - x * fx + z * fz];
      };
      const [ix, iz] = at(0.02);
      const g = level.groundAt(ix, iz);
      const top = front ? c.y - DRIFT.front : c.y - DRIFT.belowFloor;
      const bank = Math.max(0.03, Math.min(DRIFT.bank, top - g));
      pos.push(ix, g + bank, iz);
      const [mx, mz] = at(DRIFT.reach * 0.4);
      pos.push(mx, level.groundAt(mx, mz) + bank * 0.4, mz);
      const [ox, oz] = at(DRIFT.reach);
      pos.push(ox, level.groundAt(ox, oz) - 0.08, oz);
    }
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = first + i * 3;
      const b = first + ((i + 1) % n) * 3;
      for (let r = 0; r < 2; r++) {
        index.push(a + r, a + r + 1, b + r, b + r, a + r + 1, b + r + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const n = pos.length / 3;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([snow.r, snow.g, snow.b], i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("glow", new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

export type Cabins = {
  group: THREE.Group;
  /** Hand each building its cut for a lens at `eye`. */
  update(eye: THREE.Vector3): void;
  dispose(): void;
};

export function createCabins(level: Level, haze: HazeUniforms): Cabins {
  const group = new THREE.Group();
  group.name = "cabins";
  const cabins = cabinsOf(level);
  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }),
    haze,
    "cabin",
    graftGlow,
  );
  const geos: THREE.BufferGeometry[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const byKind = new Map<CabinKind, Cabin[]>();
  for (const c of cabins) {
    const list = byKind.get(c.kind);
    if (list) list.push(c);
    else byKind.set(c.kind, [c]);
  }
  type Kind = { list: Cabin[]; cuts: THREE.InstancedMesh[]; band: Int8Array };
  const kinds: Kind[] = [];
  for (const [kind, list] of byKind) {
    const cuts = ([0, 1] as CabinLod[]).map((lod) => {
      const geo = buildCabin(kind, lod);
      geos.push(geo);
      const mesh = new THREE.InstancedMesh(geo, material, list.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.frustumCulled = false;
      meshes.push(mesh);
      group.add(mesh);
      return mesh;
    });
    kinds.push({ list, cuts, band: new Int8Array(list.length).fill(-1) });
  }
  const drifts = driftGeometry(level, cabins);
  geos.push(drifts);
  const drift = new THREE.Mesh(drifts, material);
  drift.receiveShadow = true;
  group.add(drift);
  // The lodges' steps and ski racks, on the snow (`lodge-yard.ts`).
  const lodges = cabins.filter((c) => c.kind === "afterski");
  if (lodges.length) {
    const yards = lodgeYardGeometry(level, lodges);
    geos.push(yards);
    const yard = new THREE.Mesh(yards, material);
    yard.castShadow = true;
    yard.receiveShadow = true;
    group.add(yard);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  return {
    group,
    update(eye) {
      for (const k of kinds) {
        let moved = false;
        k.list.forEach((c, i) => {
          const d = Math.hypot(c.x - eye.x, c.z - eye.z, c.y - eye.y);
          const was = k.band[i];
          const now = was === 0 ? (d > NEAR + HYSTERESIS ? 1 : 0) : d < NEAR - HYSTERESIS ? 0 : 1;
          if (now !== was) moved = true;
          k.band[i] = now;
        });
        if (!moved) continue;
        const n = [0, 0];
        k.list.forEach((c, i) => {
          const cut = k.band[i];
          const mesh = k.cuts[cut];
          mesh.setMatrixAt(
            n[cut]++,
            m4.compose(at.set(c.x, c.y, c.z), q.setFromAxisAngle(up, c.heading), one),
          );
        });
        k.cuts.forEach((mesh, cut) => {
          mesh.count = n[cut];
          mesh.instanceMatrix.needsUpdate = true;
        });
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of meshes) m.dispose();
      material.dispose();
    },
  };
}
