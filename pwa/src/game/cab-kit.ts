// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCH THE TAKEN MACHINES' COCKPITS ARE BUILT ON (`carrier-cab.ts`,
// `army-heli-cockpit.ts`): one hand that makes every material in the haze,
// every mesh lit and shadowed, and keeps all of it to put away together —
// and the few shapes a cockpit is made of: a flat quad with its uvs, a
// rounded box, a rod between two points, a canvas a face is painted on.
// Presentation only.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";

type V3 = { x: number; y: number; z: number };

/** A canvas, its 2D context and the texture that shows it. */
export type Painted = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
};

export class CabKit {
  private readonly mats: THREE.Material[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly textures: THREE.Texture[] = [];
  constructor(
    private readonly haze: HazeUniforms,
    private readonly tag: string,
  ) {}

  /** A standard material in the haze. */
  std(p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), this.haze, this.tag);
    this.mats.push(m);
    return m;
  }

  /** A clear pane: the glass seen from in here. */
  glass(): THREE.MeshStandardMaterial {
    return this.std({
      color: 0x9fb6bf,
      roughness: 0.08,
      metalness: 0.4,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /** `g` as a mesh of `m` under `parent`, lit, shadowed and kept. */
  mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
    this.geos.push(g);
    const o = new THREE.Mesh(g, m);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }

  /** A box `w` × `h` × `d` with its middle at `at`, its edges rounded by
   * `r`. */
  box(
    w: number,
    h: number,
    d: number,
    at: V3,
    m: THREE.Material,
    parent: THREE.Object3D,
    r = 0,
  ): THREE.Mesh {
    const g =
      r > 0
        ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2))
        : new THREE.BoxGeometry(w, h, d);
    const o = this.mesh(g, m, parent);
    o.position.set(at.x, at.y, at.z);
    return o;
  }

  /** A rod of radius `r` from `a` to `b`. */
  rod(a: V3, b: V3, r: number, m: THREE.Material, parent: THREE.Object3D, sides = 10): THREE.Mesh {
    const d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = d.length();
    const o = this.mesh(new THREE.CylinderGeometry(r, r, len, sides), m, parent);
    o.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return o;
  }

  /** A canvas `w` × `h` px and its texture, kept. */
  canvas(w: number, h: number): Painted {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    this.textures.push(texture);
    return { canvas, ctx, texture };
  }

  /** A painted face's material: its canvas lit a little from within, as
   * a face under its own lamps reads in a dark cab — drawn both ways
   * (`side`) where it is laid out under a mirror, its winding turned. */
  face(
    t: THREE.Texture,
    glow = 0.3,
    side: THREE.Side = THREE.FrontSide,
  ): THREE.MeshStandardMaterial {
    return this.std({
      side,
      map: t,
      emissiveMap: t,
      emissive: 0xffffff,
      emissiveIntensity: glow,
      roughness: 0.55,
    });
  }

  /** Keep a geometry made elsewhere, to put away with the rest. */
  keep(g: THREE.BufferGeometry): THREE.BufferGeometry {
    this.geos.push(g);
    return g;
  }

  dispose(): void {
    for (const m of this.mats) m.dispose();
    for (const g of this.geos) g.dispose();
    for (const t of this.textures) t.dispose();
  }
}

/** A flat quad through four corners in order (its uvs from the first
 * corner along the second, up to the fourth). */
export function quad(a: V3, b: V3, c: V3, d: V3): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z],
      3,
    ),
  );
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** A point `t` of the way from `a` to `b`. */
export function mix(a: V3, b: V3, t: number): V3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
