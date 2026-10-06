// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABINS AS DRAWN — every log building of the map (`cabinsOf`, the
// engine's: where each stands, which way it faces, its floor), built once a
// kind at two cuts (`cabin-shapes.ts`) and INSTANCED: a draw a kind and
// cut, however many stand on the mountain. Each building takes its near cut
// inside `NEAR` metres of the lens and its far cut past it (a few metres of
// hysteresis, so a lens hovering on the line does not flicker it); the
// instances are refilled only when a building changes band.
//
// THE WINDOWS ARE LIT AT NIGHT: every pane carries a GLOW mark, and the
// material adds a warm lamplight to it as the piste lights come on (the
// same `uPisteOn` the snow reads), so a map skied after dark has its cabins'
// windows burning from across the valley.

import * as THREE from "three";
import { cabinsOf, type Cabin, type CabinKind, type Level } from "@engine";

import { buildCabin, type CabinLod } from "./cabin-shapes.ts";
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
