// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRAIL MAP — every furrow any skier has cut this run, kept on the GPU
// in world space and read by the terrain (`terrain.ts`), which lowers the
// snow by it and shades the trough it leaves.
//
// TWO MAPS, because one cannot be both fine enough and big enough. A ski is
// fifteen centimetres wide and a map fine enough to draw it over the whole
// 1.6 km basin would be twenty thousand texels a side. So:
//
//   * the COARSE map covers the whole map at under a metre a texel, and
//     every stamp of every skier goes into it for the life of the run —
//     which is how a trail a rival cut on the far side of the mountain is still
//     there when the player comes round to it;
//   * the FINE map is a window a hundred-odd metres square that follows the
//     player, at a few centimetres a texel — where the three furrows read
//     as three furrows. When he rides far enough off its centre it is moved:
//     one pass copies what the old window held onto the new one and fills
//     the newly exposed edge from the coarse map, so a trail ridden out of
//     the window and back into it comes back (blurrier, which is the right
//     way round — it is older).
//
// A STAMP is a capsule (`trail-stamp.ts` decides every number) drawn as one
// instanced quad into both maps with MAX blending: a furrow ridden twice is
// as deep as the deeper of the two, and a berm never fills a trough. The
// red channel is the depth over `TRAIL.maxDepth`, the green the berm over
// `TRAIL.maxBerm`; the terrain decodes both through `trailAt` (below).
//
// NEW SNOW FILLS THEM (`fill`): as a fall lays its centimetres over the run
// (`GameState.fresh`), a pass takes as much off every trough and every berm
// in both maps — whole steps of the byte encoding at a time, the remainder
// carried — so an hour's storm leaves the morning's trails as soft dents,
// and the trail cut a minute ago crisp beside them.

import * as THREE from "three";

import { recentre, TRAIL, type Stamp } from "./trail-stamp.ts";

/** The maps' sizes — a TRAILS stop, `TRAIL_LOOK` in `settings-video.ts`. */
export type TrailOptions = {
  /** Fine window: texels a side, and metres a side. */
  fineSize: number;
  fineSpan: number;
  /** Coarse map texels a side (it spans the whole map). */
  coarseSize: number;
};

/** Stamps drawn in one pass at most; more are drawn in further passes. */
const BATCH = 1024;

export type TrailUniforms = {
  uTrailFine: { value: THREE.Texture };
  uTrailCoarse: { value: THREE.Texture };
  uFineOrigin: { value: THREE.Vector2 };
  uFineSpan: { value: number };
  uFineTexel: { value: number };
  uCoarseTexel: { value: number };
  uMapSize: { value: number };
  uTrailScale: { value: THREE.Vector2 };
};

/** The GLSL every surface that reads the trail map needs: `trailAt(p)` is
 * the depth (x) and berm (y) in metres at a world plan point, fine where
 * the window covers it and coarse elsewhere, blended across the window's
 * last few metres so its edge is never a line on the snow. */
export const TRAIL_GLSL = /* glsl */ `
uniform sampler2D uTrailFine;
uniform sampler2D uTrailCoarse;
uniform vec2 uFineOrigin;
uniform float uFineSpan;
uniform float uFineTexel;
uniform float uCoarseTexel;
uniform float uMapSize;
uniform vec2 uTrailScale;

float trailFineWeight(vec2 p) {
  vec2 u = (p - uFineOrigin) / uFineSpan;
  vec2 edge = min(u, 1.0 - u);
  return smoothstep(0.0, 0.06, min(edge.x, edge.y));
}

vec2 trailAt(vec2 p) {
  vec2 coarse = textureLod(uTrailCoarse, p / uMapSize, 0.0).rg;
  float w = trailFineWeight(p);
  vec2 v = coarse;
  if (w > 0.0) {
    vec2 fine = textureLod(uTrailFine, (p - uFineOrigin) / uFineSpan, 0.0).rg;
    v = mix(coarse, fine, w);
  }
  return v * uTrailScale;
}

// How far the snow at \`p\` stands off its untouched surface, m: down by
// the furrow, up by a berm where no furrow has cut it away.
float trailRelief(vec2 p) {
  vec2 t = trailAt(p);
  return -t.x + t.y * (1.0 - clamp(t.x / 0.03, 0.0, 1.0));
}
`;

export type TrailMap = {
  uniforms: TrailUniforms;
  /** Draw these stamps; follow the player at (px, pz). */
  update(renderer: THREE.WebGLRenderer, stamps: readonly Stamp[], px: number, pz: number): void;
  /** Let `metres` of new snow settle into every trail: troughs shallower,
   * berms lower, down to the untouched snow and no further. */
  fill(renderer: THREE.WebGLRenderer, metres: number): void;
  /** Wipe every trail (a new run). */
  clear(renderer: THREE.WebGLRenderer): void;
  /** Compile the maps' own passes ahead of their first use — they are not
   * in the scene, so the scene's compile never meets them, and a program
   * first linked on the run's first frame stalls that frame. Resolves when
   * the driver has them. */
  compile(renderer: THREE.WebGLRenderer): Promise<unknown>;
  dispose(): void;
};

function target(size: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

const STAMP_VERTEX = /* glsl */ `
attribute vec4 iSeg;
attribute vec4 iShape;
uniform vec2 uOrigin;
uniform float uSpan;
uniform float uMinHalf;
varying vec2 vP;
varying vec4 vSeg;
varying vec4 vShape;
void main() {
  float hw = max(iShape.x, uMinHalf);
  // A stamp widened to the texel floor keeps its volume, not its depth.
  float thin = iShape.x / hw;
  float reach = hw * (1.0 + ${TRAIL.bermReach.toFixed(2)}) + uMinHalf;
  vec2 a = iSeg.xy;
  vec2 b = iSeg.zw;
  vec2 d = b - a;
  float len = length(d);
  vec2 t = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  vec2 along = mix(a - t * reach, b + t * reach, position.x * 0.5 + 0.5);
  vec2 p = along + n * position.y * reach;
  vP = p;
  vSeg = iSeg;
  vShape = vec4(hw, iShape.y * thin, iShape.z * thin, iShape.w);
  gl_Position = vec4((p - uOrigin) / uSpan * 2.0 - 1.0, 0.0, 1.0);
}
`;

// \`furrowProfile\` in trail-stamp.ts, in GLSL.
const STAMP_FRAGMENT = /* glsl */ `
varying vec2 vP;
varying vec4 vSeg;
varying vec4 vShape;
void main() {
  vec2 a = vSeg.xy;
  vec2 ab = vSeg.zw - a;
  float h = clamp(dot(vP - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  float d = length(vP - a - ab * h);
  float u = d / vShape.x;
  float k = ${TRAIL.wallSoft.toFixed(1)} + ${(TRAIL.wallHard - TRAIL.wallSoft).toFixed(1)} * clamp(vShape.w, 0.0, 1.0);
  float press = u < 1.0 ? 1.0 - pow(u, k) : 0.0;
  float v = (u - 0.8) / ${TRAIL.bermReach.toFixed(2)};
  float berm = (v > 0.0 && v < 1.0) ? sin(3.14159265 * v) : 0.0;
  gl_FragColor = vec4(press * vShape.y, berm * vShape.z, 0.0, 1.0);
}
`;

const COPY_FRAGMENT = /* glsl */ `
uniform sampler2D uOld;
uniform sampler2D uCoarse;
uniform vec2 uOldOrigin;
uniform vec2 uNewOrigin;
uniform float uSpan;
uniform float uMapSize;
varying vec2 vUv;
void main() {
  vec2 p = uNewOrigin + vUv * uSpan;
  vec2 o = (p - uOldOrigin) / uSpan;
  bool inside = all(greaterThanEqual(o, vec2(0.0))) && all(lessThanEqual(o, vec2(1.0)));
  gl_FragColor = inside ? texture2D(uOld, o) : texture2D(uCoarse, p / uMapSize);
}
`;

export function createTrailMap(mapSize: number, options: TrailOptions): TrailMap {
  const coarse = target(options.coarseSize);
  let fine = target(options.fineSize);
  let spare = target(options.fineSize);
  const span = options.fineSpan;
  const fineTexel = span / options.fineSize;
  const coarseTexel = mapSize / options.coarseSize;
  let centreX = Number.NaN;
  let centreZ = Number.NaN;

  const uniforms: TrailUniforms = {
    uTrailFine: { value: fine.texture },
    uTrailCoarse: { value: coarse.texture },
    uFineOrigin: { value: new THREE.Vector2(-1e6, -1e6) },
    uFineSpan: { value: span },
    uFineTexel: { value: fineTexel },
    uCoarseTexel: { value: coarseTexel },
    uMapSize: { value: mapSize },
    uTrailScale: { value: new THREE.Vector2(TRAIL.maxDepth, TRAIL.maxBerm) },
  };

  // THE STAMP PASS.
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const seg = new THREE.InstancedBufferAttribute(new Float32Array(BATCH * 4), 4);
  const shape = new THREE.InstancedBufferAttribute(new Float32Array(BATCH * 4), 4);
  seg.setUsage(THREE.DynamicDrawUsage);
  shape.setUsage(THREE.DynamicDrawUsage);
  quad.setAttribute("iSeg", seg);
  quad.setAttribute("iShape", shape);
  const stampMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uOrigin: { value: new THREE.Vector2() },
      uSpan: { value: 1 },
      uMinHalf: { value: 0 },
    },
    vertexShader: STAMP_VERTEX,
    fragmentShader: STAMP_FRAGMENT,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendEquationAlpha: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
  });
  const stampMesh = new THREE.Mesh(quad, stampMaterial);
  stampMesh.frustumCulled = false;
  const stampScene = new THREE.Scene();
  stampScene.add(stampMesh);
  const lens = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  // THE COPY PASS (moving the window).
  const copyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uOld: { value: fine.texture },
      uCoarse: { value: coarse.texture },
      uOldOrigin: { value: new THREE.Vector2() },
      uNewOrigin: { value: new THREE.Vector2() },
      uSpan: { value: span },
      uMapSize: { value: mapSize },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: COPY_FRAGMENT,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  });
  const copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMaterial);
  copyMesh.frustumCulled = false;
  const copyScene = new THREE.Scene();
  copyScene.add(copyMesh);

  // THE FILL PASS: the whole target less a flat step, by reverse
  // subtraction — the byte clamps at zero, so a trail fills to the snow
  // round it and never past.
  const fillMaterial = new THREE.ShaderMaterial({
    uniforms: { uStep: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */ `
      void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uStep;
      void main() { gl_FragColor = vec4(uStep, 0.0, 0.0); }
    `,
    blending: THREE.CustomBlending,
    blendEquation: THREE.ReverseSubtractEquation,
    blendEquationAlpha: THREE.ReverseSubtractEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
  });
  const fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fillMaterial);
  fillMesh.frustumCulled = false;
  const fillScene = new THREE.Scene();
  fillScene.add(fillMesh);
  /** One byte of the depth channel, m: the smallest fill a pass can take. */
  const depthStep = TRAIL.maxDepth / 255;
  /** New snow fallen and not yet taken off the maps, m. */
  let pending = 0;

  const clearColour = new THREE.Color();

  function withTarget(
    renderer: THREE.WebGLRenderer,
    rt: THREE.WebGLRenderTarget,
    draw: () => void,
  ) {
    const was = renderer.getRenderTarget();
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(rt);
    draw();
    renderer.setRenderTarget(was);
    renderer.autoClear = auto;
  }

  function wipe(renderer: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget) {
    renderer.getClearColor(clearColour);
    const alpha = renderer.getClearAlpha();
    withTarget(renderer, rt, () => {
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
    });
    renderer.setClearColor(clearColour, alpha);
  }

  function follow(renderer: THREE.WebGLRenderer, px: number, pz: number) {
    const moved = Number.isNaN(centreX)
      ? recentre(Infinity, Infinity, px, pz, span * 0.2, fineTexel)
      : recentre(centreX, centreZ, px, pz, span * 0.2, fineTexel);
    if (!moved) return;
    const nx = moved.x;
    const nz = moved.z;
    const oldOrigin = uniforms.uFineOrigin.value;
    const u = copyMaterial.uniforms;
    u.uOld.value = fine.texture;
    (u.uOldOrigin.value as THREE.Vector2).copy(oldOrigin);
    (u.uNewOrigin.value as THREE.Vector2).set(nx - span / 2, nz - span / 2);
    withTarget(renderer, spare, () => renderer.render(copyScene, lens));
    [fine, spare] = [spare, fine];
    centreX = nx;
    centreZ = nz;
    oldOrigin.set(nx - span / 2, nz - span / 2);
    uniforms.uTrailFine.value = fine.texture;
  }

  function drawStamps(
    renderer: THREE.WebGLRenderer,
    rt: THREE.WebGLRenderTarget,
    ox: number,
    oz: number,
    extent: number,
    minHalf: number,
    count: number,
  ) {
    const u = stampMaterial.uniforms;
    (u.uOrigin.value as THREE.Vector2).set(ox, oz);
    u.uSpan.value = extent;
    u.uMinHalf.value = minHalf;
    quad.instanceCount = count;
    withTarget(renderer, rt, () => renderer.render(stampScene, lens));
  }

  return {
    uniforms,
    update(renderer, stamps, px, pz) {
      follow(renderer, px, pz);
      const o = uniforms.uFineOrigin.value;
      for (let from = 0; from < stamps.length; from += BATCH) {
        const n = Math.min(BATCH, stamps.length - from);
        const sa = seg.array as Float32Array;
        const sh = shape.array as Float32Array;
        for (let i = 0; i < n; i++) {
          const s = stamps[from + i];
          sa[i * 4] = s.ax;
          sa[i * 4 + 1] = s.az;
          sa[i * 4 + 2] = s.bx;
          sa[i * 4 + 3] = s.bz;
          sh[i * 4] = s.half;
          sh[i * 4 + 1] = s.depth / TRAIL.maxDepth;
          sh[i * 4 + 2] = s.berm / TRAIL.maxBerm;
          sh[i * 4 + 3] = s.wall ?? TRAIL.wall;
        }
        seg.needsUpdate = true;
        shape.needsUpdate = true;
        drawStamps(renderer, coarse, 0, 0, mapSize, coarseTexel * 0.75, n);
        drawStamps(renderer, fine, o.x, o.y, span, fineTexel * 0.75, n);
      }
    },
    fill(renderer, metres) {
      pending += Math.max(0, metres);
      const steps = Math.floor(pending / depthStep);
      if (steps < 1) return;
      pending -= steps * depthStep;
      const metresNow = steps * depthStep;
      // The berm's channel is finer: the same metres are more of its bytes.
      const berm = Math.min(255, Math.round((metresNow / TRAIL.maxBerm) * 255));
      (fillMaterial.uniforms.uStep.value as THREE.Vector2).set(
        Math.min(255, steps) / 255,
        berm / 255,
      );
      withTarget(renderer, coarse, () => renderer.render(fillScene, lens));
      withTarget(renderer, fine, () => renderer.render(fillScene, lens));
    },
    clear(renderer) {
      pending = 0;
      wipe(renderer, coarse);
      wipe(renderer, fine);
      wipe(renderer, spare);
      centreX = Number.NaN;
      centreZ = Number.NaN;
      uniforms.uFineOrigin.value.set(-1e6, -1e6);
    },
    compile(renderer) {
      // Against a map, as the passes are drawn: a program is keyed on the
      // target's colour space, and one compiled for the canvas is not the
      // one a map's pass asks for.
      const was = renderer.getRenderTarget();
      renderer.setRenderTarget(coarse);
      const ready = [stampScene, copyScene, fillScene].map((s) => renderer.compileAsync(s, lens));
      renderer.setRenderTarget(was);
      return Promise.all(ready);
    },
    dispose() {
      coarse.dispose();
      fine.dispose();
      spare.dispose();
      quad.dispose();
      stampMaterial.dispose();
      copyMaterial.dispose();
      copyMesh.geometry.dispose();
      fillMaterial.dispose();
      fillMesh.geometry.dispose();
    },
  };
}
