// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BILLBOARDS IN ONE DRAW — a pool of camera-facing quads drawn as one
// instanced mesh: the fire and the smoke of a crash (`explosion.ts`),
// hundreds of puffs that as sprites would each cost a draw call. Each quad
// is a place, a size, a turn in the screen, a colour and an opacity, and
// a cell of a texture laid out as a strip of square cells (the fire's
// billow and the smoke's), so the fire and the smoke are ONE list, sorted
// back to front for the eye — a flame behind the smoke is behind it.
//
// Filled every frame (`begin`, `push`, `end`); nothing allocates once it
// is built. Tone-mapped and closed with the colour-space conversion like
// every other hand-written shader here.

import * as THREE from "three";

export type Billboards = {
  mesh: THREE.Mesh;
  /** Start this frame's list. */
  begin(): void;
  /** One quad at (x, y, z), `w` × `h` m, turned `rot` rad in the screen,
   * coloured (r, g, b) — linear, over one for a glow — at opacity `a`,
   * drawn with cell `cell` of the texture. */
  push(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    rot: number,
    r: number,
    g: number,
    b: number,
    a: number,
    cell: number,
  ): void;
  /** Sort the list back to front from `eye` and hand it to the GPU. */
  end(eye: { x: number; y: number; z: number }): void;
  dispose(): void;
};

/** A batch of at most `capacity` quads over `map`, a strip of `cells`
 * square cells side by side; `additive` adds them on rather than laying
 * them over. */
export function createBillboards(
  map: THREE.Texture,
  cells: number,
  capacity: number,
  additive = false,
): Billboards {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.setAttribute("uv", base.getAttribute("uv"));
  const pos = new Float32Array(capacity * 3);
  const size = new Float32Array(capacity * 3);
  const col = new Float32Array(capacity * 4);
  const iPos = new THREE.InstancedBufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const iSize = new THREE.InstancedBufferAttribute(size, 3).setUsage(THREE.DynamicDrawUsage);
  const iCol = new THREE.InstancedBufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("iPos", iPos);
  geo.setAttribute("iSize", iSize);
  geo.setAttribute("iCol", iCol);
  geo.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, cells: { value: cells } },
    vertexShader: /* glsl */ `
      attribute vec3 iPos;
      attribute vec3 iSize;
      attribute vec4 iCol;
      uniform float cells;
      varying vec2 vUv;
      varying vec4 vCol;
      void main() {
        // iSize: the width, the height, and the turn and the cell packed as
        // cell * 16 + turn (the turn kept in 0..2π).
        float cell = floor(iSize.z / 16.0);
        float turn = iSize.z - cell * 16.0;
        vUv = vec2((uv.x + cell) / cells, uv.y);
        vCol = iCol;
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        float c = cos(turn);
        float s = sin(turn);
        vec2 p = position.xy * iSize.xy;
        mv.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      varying vec4 vCol;
      void main() {
        vec4 t = texture2D(map, vUv);
        gl_FragColor = vec4(t.rgb * vCol.rgb, t.a * vCol.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  // The list as pushed, before it is sorted into the attributes.
  const raw = new Float32Array(capacity * 10);
  const order: number[] = [];
  const depth = new Float32Array(capacity);
  let n = 0;
  return {
    mesh,
    begin() {
      n = 0;
    },
    push(x, y, z, w, h, rot, r, g, b, a, cell) {
      if (n >= capacity || a <= 0.002) return;
      const k = n * 10;
      raw[k] = x;
      raw[k + 1] = y;
      raw[k + 2] = z;
      raw[k + 3] = w;
      raw[k + 4] = h;
      const turn = rot - Math.floor(rot / (Math.PI * 2)) * Math.PI * 2;
      raw[k + 5] = cell * 16 + turn;
      raw[k + 6] = r;
      raw[k + 7] = g;
      raw[k + 8] = b;
      raw[k + 9] = a;
      n++;
    },
    end(eye) {
      // Nothing to draw, and nothing drawn last frame: nothing to send.
      if (n === 0 && geo.instanceCount === 0) return;
      order.length = n;
      for (let i = 0; i < n; i++) {
        order[i] = i;
        const k = i * 10;
        depth[i] = (raw[k] - eye.x) ** 2 + (raw[k + 1] - eye.y) ** 2 + (raw[k + 2] - eye.z) ** 2;
      }
      order.sort((p, q) => depth[q] - depth[p]);
      for (let j = 0; j < n; j++) {
        const k = order[j] * 10;
        pos[j * 3] = raw[k];
        pos[j * 3 + 1] = raw[k + 1];
        pos[j * 3 + 2] = raw[k + 2];
        size[j * 3] = raw[k + 3];
        size[j * 3 + 1] = raw[k + 4];
        size[j * 3 + 2] = raw[k + 5];
        col[j * 4] = raw[k + 6];
        col[j * 4 + 1] = raw[k + 7];
        col[j * 4 + 2] = raw[k + 8];
        col[j * 4 + 3] = raw[k + 9];
      }
      geo.instanceCount = n;
      mesh.visible = n > 0;
      for (const a of [iPos, iSize, iCol]) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, n * a.itemSize);
        a.needsUpdate = true;
      }
    },
    dispose() {
      geo.dispose();
      base.dispose();
      material.dispose();
    },
  };
}
