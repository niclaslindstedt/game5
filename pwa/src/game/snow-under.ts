// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW FAR UNDER THE DRAWN SNOW THE SKIS STAND — the snow lab's measure of
// what the player sees from his own lens (`make snow-eval ARGS=--under`).
// A ski is never to sink out of sight under the snow drawn round it: the
// ground the clipmap draws, the loose cover laid over the engine's ground
// off the piste and the furrow the trail map and the deformable snow cut,
// all as the GPU places them, against the base of each ski as posed.
//
// The measure is read off the picture itself, never a twin of the shader:
// the ground alone is drawn from the lens into a depth texture, and at each
// ski's tip, middle and tail the drawn snow's point on the ray through it
// is found. Its gap is the base's height over the snow's local plane there
// (the plane through that point, along the ground's own normal), so a
// positive UNDER is a base standing that far below the snow drawn over it,
// and a negative one a base in sight over it.

import * as THREE from "three";

/** Where along a ski its base is read: near the tip (before the shovel's
 * rise), the middle, near the tail — shares of its length, tip first. */
export const UNDER_STATIONS = [
  { at: "tip", u: 0.14 },
  { at: "mid", u: 0.5 },
  { at: "tail", u: 0.86 },
] as const;

export type UnderPoint = {
  /** Which ski (0 the left, 1 the right; a board's one deck 0) and where. */
  ski: number;
  at: (typeof UNDER_STATIONS)[number]["at"];
  /** The base there, world m. */
  x: number;
  y: number;
  z: number;
  /** How far under the drawn snow it stands, m (negative: over it); NaN off
   * the picture or with no snow behind it. */
  under: number;
};

/** A base's three stations in its own mesh's frame: the lowest vertex in a
 * band a centimetre either side of each station's share of its length. */
function stationsOf(mesh: THREE.Mesh): THREE.Vector3[] {
  const pos = mesh.geometry.getAttribute("position");
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    z0 = Math.min(z0, pos.getZ(i));
    z1 = Math.max(z1, pos.getZ(i));
  }
  return UNDER_STATIONS.map(({ u }) => {
    const z = z1 - (z1 - z0) * u;
    let y = Infinity;
    let x = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i) - z) > 0.012 * (z1 - z0) + 0.005) continue;
      if (pos.getY(i) < y) {
        y = pos.getY(i);
        x = 0;
      }
    }
    return new THREE.Vector3(x, Number.isFinite(y) ? y : 0, z);
  });
}

const COPY_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const COPY_FRAG = /* glsl */ `
uniform sampler2D uDepth;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(uDepth, vUv).r, 0.0, 0.0, 1.0); }
`;

export type SnowUnder = {
  /** Draw `ground` alone from `camera` and read each base's gap; the
   * renderer's own target and every other part's visibility are restored. */
  measure(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    ground: THREE.Object3D,
    bases: readonly THREE.Mesh[],
    level: { normalAt(x: number, z: number, out: { x: number; y: number; z: number }): unknown },
  ): UnderPoint[];
  dispose(): void;
};

export function createSnowUnder(): SnowUnder {
  let target: THREE.WebGLRenderTarget | null = null;
  let copy: THREE.WebGLRenderTarget | null = null;
  const local = new WeakMap<THREE.BufferGeometry, THREE.Vector3[]>();
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: COPY_VERT,
      fragmentShader: COPY_FRAG,
      uniforms: { uDepth: { value: null } },
      depthTest: false,
      depthWrite: false,
    }),
  );
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera();
  const size = new THREE.Vector2();
  const p = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const s = new THREE.Vector3();
  const n = { x: 0, y: 1, z: 0 };
  const px = new Float32Array(4);
  return {
    measure(gl, scene, camera, ground, bases, level) {
      gl.getDrawingBufferSize(size);
      const w = Math.max(1, Math.floor(size.x));
      const h = Math.max(1, Math.floor(size.y));
      if (!target || target.width !== w || target.height !== h) {
        target?.dispose();
        copy?.dispose();
        target = new THREE.WebGLRenderTarget(w, h);
        target.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
        copy = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
      }
      // The ground alone: every other part of the scene held out of it.
      const hidden: THREE.Object3D[] = [];
      for (const child of scene.children) {
        if (child !== ground && child.visible) {
          child.visible = false;
          hidden.push(child);
        }
      }
      const was = gl.getRenderTarget();
      const autoClear = gl.autoClear;
      gl.autoClear = true;
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      for (const child of hidden) child.visible = true;
      (quad.material as THREE.ShaderMaterial).uniforms.uDepth.value = target.depthTexture;
      gl.setRenderTarget(copy);
      gl.render(quadScene, quadCam);
      gl.setRenderTarget(was);
      gl.autoClear = autoClear;
      const out: UnderPoint[] = [];
      for (let k = 0; k < bases.length; k++) {
        const mesh = bases[k];
        let stations = local.get(mesh.geometry);
        if (!stations) {
          stations = stationsOf(mesh);
          local.set(mesh.geometry, stations);
        }
        mesh.updateWorldMatrix(true, false);
        for (let i = 0; i < stations.length; i++) {
          p.copy(stations[i]).applyMatrix4(mesh.matrixWorld);
          const point: UnderPoint = {
            ski: k,
            at: UNDER_STATIONS[i].at,
            x: p.x,
            y: p.y,
            z: p.z,
            under: Number.NaN,
          };
          out.push(point);
          ndc.copy(p).project(camera);
          if (Math.abs(ndc.x) >= 1 || Math.abs(ndc.y) >= 1 || ndc.z >= 1) continue;
          const ix = Math.min(w - 1, Math.floor(((ndc.x + 1) / 2) * w));
          const iy = Math.min(h - 1, Math.floor(((ndc.y + 1) / 2) * h));
          gl.readRenderTargetPixels(copy!, ix, iy, 1, 1, px);
          const depth = px[0];
          if (!(depth < 0.999999)) continue;
          // The drawn snow on the ray through the base: the same screen
          // point at the snow's depth, unprojected.
          s.set(ndc.x, ndc.y, depth * 2 - 1).unproject(camera);
          level.normalAt(s.x, s.z, n);
          const nl = Math.hypot(n.x, n.y, n.z) || 1;
          // The base's height over the snow's plane there, along the plane's
          // normal and read as a vertical gap.
          const over = ((p.x - s.x) * n.x + (p.y - s.y) * n.y + (p.z - s.z) * n.z) / nl;
          point.under = -over / Math.max(0.3, n.y / nl);
        }
      }
      return out;
    },
    dispose() {
      target?.dispose();
      copy?.dispose();
      quad.geometry.dispose();
      (quad.material as THREE.Material).dispose();
    },
  };
}
