// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK AS DRAWN (R44, R45): what `bike-trail-plan.ts` decides,
// made meshes — the trails' ribbon over the engine's own surface (one
// draw, its shoulders faded into the grass), the rock gardens' boulders
// and the roots (one instanced draw each), and the race line's stakes and
// tape. Lit, shadowed and hazed as the world is (`hazeMaterial`). Built by
// `gates.ts` only on a map that carries a park — a summer free ride's.

import * as THREE from "three";
import type { Level } from "@engine";

import { BIKE_LOOK, planBikeTrails, type BikeRibbon } from "./bike-trail-plan.ts";
import { hazeMaterial, PAST_THE_WALL, type HazeUniforms } from "./haze.ts";

export type BikeTrailsView = { group: THREE.Group; dispose(): void };

function geometryOf(r: BikeRibbon): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(r.pos, 3));
  // The plan's paint is sRGB; a vertex colour is linear light.
  const col = r.col.map((v, i) => (i % 4 === 3 ? v : Math.pow(v, 2.2)));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(r.uv, 2));
  geo.setIndex(r.idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** A grain to break the flat colour: crushed stone's speckle, the loam's
 * crumbs — a tile a metre across. */
function grainTexture(): THREE.DataTexture {
  const n = 128;
  const data = new Uint8Array(n * n * 4);
  let h = 0x2545f491;
  for (let i = 0; i < n * n; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const v = 200 + ((h >>> 0) % 56);
    // A stone now and then, lighter or darker.
    const stone = (h >>> 8) % 23 === 0 ? ((h >>> 16) % 2 ? 40 : -70) : 0;
    const g = Math.max(0, Math.min(255, v + stone));
    data.set([g, g, g, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.repeat.set(1, 1);
  t.needsUpdate = true;
  return t;
}

/** The bike park of `level` as drawn, or null where it has none. */
export function createBikeTrails(level: Level, haze: HazeUniforms): BikeTrailsView | null {
  const plan = planBikeTrails(level);
  if (!plan) return null;
  const group = new THREE.Group();
  group.name = "bike-park";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const grain = grainTexture();

  const ribbon = geometryOf(plan.ribbon);
  const tread = hazeMaterial(
    new THREE.MeshStandardMaterial({
      map: grain,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    }),
    haze,
    "bike-tread",
    PAST_THE_WALL,
  );
  const ribbonMesh = new THREE.Mesh(ribbon, tread);
  ribbonMesh.receiveShadow = true;
  ribbonMesh.renderOrder = 1;
  group.add(ribbonMesh);
  geos.push(ribbon);
  mats.push(tread);

  const solid = (rgb: readonly number[], name: string, rough = 0.9) => {
    const m = hazeMaterial(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace),
        roughness: rough,
        metalness: 0,
        flatShading: true,
      }),
      haze,
      name,
    );
    mats.push(m);
    return m;
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();

  if (plan.rocks.length > 0) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    geos.push(geo);
    const mesh = new THREE.InstancedMesh(
      geo,
      solid(BIKE_LOOK.rock, "bike-rock"),
      plan.rocks.length,
    );
    plan.rocks.forEach((r, i) => {
      e.set(0, r.spin, 0);
      q.setFromEuler(e);
      m4.compose(v.set(r.x, r.y, r.z), q, sc.set(r.r, r.h, r.r * 0.85));
      mesh.setMatrixAt(i, m4);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (plan.roots.length > 0) {
    // A root lies along +z: a cylinder turned onto its side.
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1).rotateX(Math.PI / 2);
    geos.push(geo);
    const mesh = new THREE.InstancedMesh(
      geo,
      solid(BIKE_LOOK.root, "bike-root"),
      plan.roots.length,
    );
    plan.roots.forEach((r, i) => {
      e.set(0, r.heading, 0);
      q.setFromEuler(e);
      m4.compose(v.set(r.x, r.y, r.z), q, sc.set(r.r, r.r * 0.7, r.len));
      mesh.setMatrixAt(i, m4);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (plan.posts.length > 0) {
    const T = BIKE_LOOK.tape;
    const geo = new THREE.BoxGeometry(0.035, T.post, 0.035).translate(0, T.post / 2, 0);
    geos.push(geo);
    const mesh = new THREE.InstancedMesh(
      geo,
      solid([0.9, 0.9, 0.88], "bike-stake"),
      plan.posts.length,
    );
    plan.posts.forEach((p, i) => {
      m4.makeTranslation(p.x, p.y, p.z);
      mesh.setMatrixAt(i, m4);
    });
    group.add(mesh);
    const tape = geometryOf(plan.tape);
    geos.push(tape);
    const tm = hazeMaterial(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: 0,
      }),
      haze,
      "bike-tape",
    );
    mats.push(tm);
    group.add(new THREE.Mesh(tape, tm));
  }
  return {
    group,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      grain.dispose();
    },
  };
}
