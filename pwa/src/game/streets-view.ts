// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREETS ON THE SNOW — the surfaces `street-plan.ts` lays,
// made meshes in the textures `street-paint.ts` paints: the roads, the
// packed places (the car park, the junctions), the sidewalks and the
// square, and what is painted on them (the crossings, the bays). Each a
// layer a step nearer the lens in depth than the snow under it, so none
// fights the ground; lit, shadowed and hazed as the world is
// (`hazeMaterial`), and lit after dark by the street lamps' light baked
// with the floodlights' (`street-furniture-build.ts`'s `streetLampMasts`).
// The kerbs, the windrows and the furniture stand on the facade kit with
// the buildings (`street-edges-build.ts`, `street-furniture-build.ts`).

import * as THREE from "three";
import type { Level } from "@engine";

import { hazeMaterial, PAST_THE_WALL, type HazeUniforms } from "./haze.ts";
import { paintArea, paintRoad, paintWalk, type Paint } from "./street-paint.ts";
import { planStreets, TILE, type StreetGeo } from "./street-plan.ts";

export type VillageStreetsView = {
  group: THREE.Group;
  dispose(): void;
};

function texture(p: Paint): THREE.DataTexture {
  const t = new THREE.DataTexture(p.data, p.width, p.height, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function geometry(g: StreetGeo): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(g.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(g.col, 3));
  geo.setIndex(g.idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** The streets of `level`'s village as drawn, or null where it has none. */
export function createVillageStreets(level: Level, haze: HazeUniforms): VillageStreetsView | null {
  const plan = planStreets(level);
  if (!plan) return null;
  const group = new THREE.Group();
  group.name = "village-streets";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  /** A layer: its geometry in a material over `map`, pushed `step`
   * depth units nearer the lens. */
  const layer = (g: StreetGeo, map: THREE.Texture | null, step: number, name: string) => {
    if (g.idx.length === 0) return;
    const geo = geometry(g);
    const mat = hazeMaterial(
      new THREE.MeshStandardMaterial({
        map,
        vertexColors: true,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2 * step,
      }),
      haze,
      name,
      PAST_THE_WALL,
    );
    geos.push(geo);
    mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.renderOrder = step;
    group.add(mesh);
  };
  const road = texture(paintRoad());
  const area = texture(paintArea());
  const walk = texture(paintWalk());
  const square = texture(paintWalk(512, TILE.square, 0.62));
  texs.push(road, area, walk, square);
  layer(plan.area, area, 1, "street-area");
  layer(plan.road, road, 2, "street-road");
  layer(plan.walk, walk, 3, "street-walk");
  layer(plan.square, square, 3, "street-square");
  layer(plan.marks, null, 4, "street-marks");
  return {
    group,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
    },
  };
}
