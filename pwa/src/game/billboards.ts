// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BILLBOARDS IN ONE DRAW — a pool of camera-facing quads drawn as one
// instanced mesh: the fire and the smoke of a crash (`explosion.ts`),
// hundreds of puffs that as sprites would each cost a draw call. Each quad
// is a place, a size, a turn in the screen, a colour and an opacity, and
// a cell of a texture laid out as a strip of square cells (the fire's
// billow and the smoke's), so the fire and the smoke are ONE list, sorted
// back to front for the eye — a flame behind the smoke is behind it.
//
// A quad is drawn one of three ways: its texture's cell (`mode` 0), or
// PROCEDURALLY in the shader off the clock — FIRE (`mode` 1), a ragged
// turbulent body whose every pixel has a temperature off flowing noise and
// takes the colour of glowing soot at it, white-yellow at its hottest
// through orange to a dull red, cooling at its edges into black SOOT that
// hides what is behind it as a sooty fireball's skin does; or SMOKE
// (`mode` 2), billowing and lumpy, lit from above and glowing orange
// underneath where a fire burns under it. Each quad turns its own noise
// (`seed`), so no two puffs are alike and none is a disc.
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
   * drawn with cell `cell` of the texture — or, `mode` 1, as fire at
   * `heat` 0..1 (its colour then the soot it cools to), `mode` 2 as smoke
   * glowing `glow` 0..1 underneath; `seed` its own noise. */
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
    mode?: number,
    heat?: number,
    seed?: number,
    glow?: number,
  ): void;
  /** Sort the list back to front from `eye` and hand it to the GPU; `time`
   * the clock the fire and smoke flow by, s. */
  end(eye: { x: number; y: number; z: number }, time?: number): void;
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
  const fx = new Float32Array(capacity * 4);
  const iPos = new THREE.InstancedBufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const iSize = new THREE.InstancedBufferAttribute(size, 3).setUsage(THREE.DynamicDrawUsage);
  const iCol = new THREE.InstancedBufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
  const iFx = new THREE.InstancedBufferAttribute(fx, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("iPos", iPos);
  geo.setAttribute("iSize", iSize);
  geo.setAttribute("iCol", iCol);
  geo.setAttribute("iFx", iFx);
  geo.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, cells: { value: cells }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 iPos;
      attribute vec3 iSize;
      attribute vec4 iCol;
      attribute vec4 iFx;
      uniform float cells;
      varying vec2 vUv;
      varying vec2 vLocal;
      varying vec2 vUp;
      varying vec4 vCol;
      varying vec4 vFx;
      void main() {
        // iSize: the width, the height, and the turn and the cell packed as
        // cell * 16 + turn (the turn kept in 0..2π).
        float cell = floor(iSize.z / 16.0);
        float turn = iSize.z - cell * 16.0;
        vUv = vec2((uv.x + cell) / cells, uv.y);
        vLocal = position.xy * 2.0;
        vCol = iCol;
        vFx = iFx;
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        float c = cos(turn);
        float s = sin(turn);
        // The screen's up in the quad's own frame, for the light.
        vUp = vec2(s, c);
        vec2 p = position.xy * iSize.xy;
        mv.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uTime;
      varying vec2 vUv;
      varying vec2 vLocal;
      varying vec2 vUp;
      varying vec4 vCol;
      varying vec4 vFx;
      float hash3(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
              mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
              mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float a = 0.5;
        float s = 0.0;
        for (int i = 0; i < 4; i++) {
          s += a * noise3(p);
          p = p * 2.07 + vec3(1.7, 9.2, 3.1);
          a *= 0.5;
        }
        return s / 0.9375;
      }
      // Glowing soot by its temperature, 0 cold to 1 white heat: a dull
      // red, orange, yellow, white-yellow — linear and over one, for the
      // tone map to keep it glowing.
      vec3 heatColour(float t) {
        vec3 c = mix(vec3(0.0), vec3(0.55, 0.06, 0.01), smoothstep(0.0, 0.22, t));
        c = mix(c, vec3(2.2, 0.55, 0.07), smoothstep(0.18, 0.48, t));
        c = mix(c, vec3(4.2, 2.0, 0.42), smoothstep(0.45, 0.75, t));
        c = mix(c, vec3(6.5, 5.2, 2.9), smoothstep(0.75, 1.0, t));
        return c;
      }
      void main() {
        float mode = vFx.x;
        vec4 o;
        if (mode < 0.5) {
          vec4 t = texture2D(map, vUv);
          o = vec4(t.rgb * vCol.rgb, t.a * vCol.a);
        } else {
          vec2 p = vLocal;
          float r = length(p);
          if (r > 1.0) discard;
          float seed = vFx.z;
          float up = dot(p, vUp);
          if (mode < 1.5) {
            // FIRE: the noise flowing up through it, warped by itself.
            vec3 q = vec3(p * 1.5, uTime * 0.55) + vec3(seed * 3.1, seed * 1.7, seed);
            float w = fbm(q - vec3(vUp * uTime * 1.3, 0.0));
            float n = fbm(q * 1.9 + vec3(w * 1.6, w * 1.6, 0.0) - vec3(vUp * uTime * 2.1, 0.0));
            float body = 1.0 - r * r * 1.1;
            float d = body + (n - 0.5) * 1.25;
            float dens = smoothstep(0.02, 0.32, d) * smoothstep(1.0, 0.7, r);
            if (dens < 0.01) discard;
            float heat = vFx.y;
            float t = clamp(heat * (0.35 + 1.05 * d) + (n - 0.5) * 0.45 * heat, 0.0, 1.0);
            // Cooling into soot at its rim: dark, and hiding what is behind.
            float soot = 1.0 - smoothstep(0.12, 0.42, t);
            vec3 c = mix(heatColour(t), vCol.rgb * (0.6 + 0.8 * n), soot);
            o = vec4(c, dens * vCol.a);
          } else {
            // SMOKE: billows rolling slowly over each other.
            vec3 q = vec3(p * 1.25, uTime * 0.12) + vec3(seed * 2.3, seed * 4.1, seed);
            float w = fbm(q);
            float n = fbm(q * 1.7 + vec3(w * 1.3, w * 1.3 - uTime * 0.05, 0.0));
            float body = 1.0 - r * r;
            float d = body + (n - 0.5) * 1.15;
            float dens = smoothstep(0.08, 0.5, d) * smoothstep(1.0, 0.6, r);
            if (dens < 0.01) discard;
            // Lit from above, shaded under, the lumps standing out.
            float n2 = fbm(q * 1.7 + vec3(w * 1.3, w * 1.3 - uTime * 0.05, 0.0) + vec3(vUp * 0.35, 0.0));
            float lit = 0.5 + 0.55 * smoothstep(-0.9, 0.9, up) + 1.6 * (n2 - n);
            vec3 c = vCol.rgb * max(0.25, lit);
            // Glowing orange underneath, over the fire.
            c += vec3(1.9, 0.55, 0.09) * vFx.w * smoothstep(0.5, -0.9, up) * (0.4 + 0.8 * n);
            o = vec4(c, dens * vCol.a);
          }
        }
        gl_FragColor = o;
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
  const raw = new Float32Array(capacity * 14);
  const order: number[] = [];
  const depth = new Float32Array(capacity);
  let n = 0;
  return {
    mesh,
    begin() {
      n = 0;
    },
    push(x, y, z, w, h, rot, r, g, b, a, cell, mode = 0, heat = 0, seed = 0, glow = 0) {
      if (n >= capacity || a <= 0.002) return;
      const k = n * 14;
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
      raw[k + 10] = mode;
      raw[k + 11] = heat;
      raw[k + 12] = seed;
      raw[k + 13] = glow;
      n++;
    },
    end(eye, time = 0) {
      material.uniforms.uTime.value = time;
      // Nothing to draw, and nothing drawn last frame: nothing to send.
      if (n === 0 && geo.instanceCount === 0) return;
      order.length = n;
      for (let i = 0; i < n; i++) {
        order[i] = i;
        const k = i * 14;
        depth[i] = (raw[k] - eye.x) ** 2 + (raw[k + 1] - eye.y) ** 2 + (raw[k + 2] - eye.z) ** 2;
      }
      order.sort((p, q) => depth[q] - depth[p]);
      for (let j = 0; j < n; j++) {
        const k = order[j] * 14;
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
        fx[j * 4] = raw[k + 10];
        fx[j * 4 + 1] = raw[k + 11];
        fx[j * 4 + 2] = raw[k + 12];
        fx[j * 4 + 3] = raw[k + 13];
      }
      geo.instanceCount = n;
      mesh.visible = n > 0;
      for (const a of [iPos, iSize, iCol, iFx]) {
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
