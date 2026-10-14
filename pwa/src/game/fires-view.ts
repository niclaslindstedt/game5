// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRES AS DRAWN — a ski area's camp fires and bonfires
// (`engine/game/fires.ts` stands them, `fire-plan.ts` lays out their
// parts), built in the woods' chunky, faceted look:
//
//   * THE SOLIDS: the hearth's ring of stones, the logs (the teepee in the
//     hearth, charred black where they burn; the benches' stumps; the
//     woodpile's split logs), the benches' split half logs and a camp
//     fire's sooty grill grate — each kind ONE instanced draw for the whole
//     ski area.
//   * THE GROUND: the snow round every fire trampled and melted — char and
//     ash in the hearth, wet dark slush at its rim, grey-brown boot-packed
//     snow out past the benches fading into the white — one mesh laid on
//     the drawn snow, and over the hearth a bed of EMBERS glowing and
//     breathing.
//   * THE FIRE: the FLAMES, tongues of fire each a quad turned to the lens
//     about the up axis, shaped and torn in the fragment shader off the
//     run's clock — a yellow-white heart, an orange body, red tips licking
//     off the top — laid over by the wind; a soft GLOW round them, warm by
//     day and wide at night; SPARKS rising and swirling off downwind, thick
//     at night; and a thin grey thread of SMOKE drifting off on the wind, a
//     bonfire's a tall column. Every particle is a pure function of the
//     clock in the shader: nothing is stepped on the CPU, whatever the
//     count of fires.
//   * THE LIGHT: the nearest fires' warm, flickering light dealt to the
//     lamp slots (`lamps`, `headlamp.ts`'s `Flood`), so after dark the
//     snow, the benches, the people and the trees round a fire are lit
//     orange.
//
// Eleven draw calls for every fire on the map; per frame, a handful of
// uniforms and the few nearest lights. Drawn only on a run whose rules
// keep fires (`RunRules.fires`, a free ride's). Presentation only.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { firesOf, type Level, type Wind } from "@engine";

import { FIRE_COLOURS } from "./fireball.ts";
import {
  FIRE_LOOK,
  fireHash,
  fireLayouts,
  flickerAt,
  nearestFires,
  snowFloor,
  type FireLayout,
} from "./fire-plan.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { Flood } from "./headlamp.ts";
import type { SkyLook } from "./sky.ts";

/** A fire's light, linear: the warm orange of wood flames, and its beam —
 * every way at once (`lampReach`'s spot opened past a full turn). */
const FIRE_LIGHT = [1.0, 0.5, 0.17] as const;
const ALL_ROUND = [-2, -1.5, -3, 0] as const;
/** How far off the flames, sparks and smoke are drawn, m. */
const REACH = 1400;

export type FiresView = {
  group: THREE.Group;
  /** The fires laid out, for the labs. */
  layouts: readonly FireLayout[];
  /** One frame: the run's clock, the sky, the wind, the lens and its
   * focal length in pixels; `lit` the night's lamps (0 by day … 1). */
  update(
    t: number,
    look: SkyLook,
    wind: Wind,
    eye: THREE.Vector3,
    pixels: number,
    lit: number,
  ): void;
  /** The nearest fires' lights at `t`, as seen from `eye`, onto `out`. */
  lamps(eye: THREE.Vector3, t: number, out: Flood[]): void;
  dispose(): void;
};

const NOISE = /* glsl */ `
float fHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float fNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x),
             mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fFbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * fNoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}
`;

const v3 = (c: readonly number[]): string => `vec3(${c.map((x) => x.toFixed(3)).join(", ")})`;
const COLOURS = /* glsl */ `
const vec3 F_WHITE = ${v3(FIRE_COLOURS.white)};
const vec3 F_ORANGE = ${v3(FIRE_COLOURS.orange)};
const vec3 F_RED = ${v3(FIRE_COLOURS.red)};
`;

const FADE = /* glsl */ `
uniform float uHaze;
uniform float uReach;
float fadeAt(float dist) {
  return smoothstep(uReach, uReach * 0.7, dist) * exp(-dist * uHaze * 0.6);
}
`;

/** A quad from (-1, `y0`) to (1, 1), one per instance. */
function quad(y0: number): THREE.InstancedBufferGeometry {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, y0, 0, 1, y0, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo;
}

/** THE TRAMPLED SNOW round every fire, one mesh: rings out from each
 * hearth to its ring's edge, laid on the drawn snow, its colour and alpha
 * in its vertices. */
function groundGeometry(level: Level, layouts: readonly FireLayout[]): THREE.BufferGeometry {
  const AROUND = 28;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const f of layouts) {
    const { x: cx, z: cz } = f.fire;
    const hearth = f.fire.radius;
    // Out from the middle: the ash, the stones' rim, the slush, the
    // trampled snow, the fade.
    const rings = [
      0,
      hearth * 0.7,
      hearth * 1.25,
      hearth * 1.6,
      hearth + 0.9,
      f.ring * 0.7,
      f.ring,
    ];
    const base = pos.length / 3;
    for (const r of rings) {
      for (let i = 0; i < AROUND; i++) {
        const a = (i / AROUND) * Math.PI * 2;
        // Ragged at its edge, as boots leave it.
        const jag = r === 0 ? 0 : (fireHash(cx, cz, 900 + i + Math.round(r * 10)) - 0.5) * 0.18 * r;
        const x = cx + Math.sin(a) * (r + jag);
        const z = cz + Math.cos(a) * (r + jag);
        pos.push(x, snowFloor(level, x, z) + 0.025, z);
        const n = fireHash(x, z, 77);
        const s = r / f.ring;
        let c: [number, number, number, number];
        if (r < hearth * 0.75) c = [0.035, 0.03, 0.028, 1];
        else if (r < hearth * 1.3) c = [0.09, 0.075, 0.065, 1];
        else if (r < hearth * 1.65) c = [0.32, 0.28, 0.24, 0.95];
        else if (s < 0.75) c = [0.42 + 0.08 * n, 0.38 + 0.07 * n, 0.33 + 0.06 * n, 0.85];
        else c = [0.55, 0.52, 0.48, r >= f.ring ? 0 : 0.55];
        col.push(...c);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) {
      for (let i = 0; i < AROUND; i++) {
        const a = base + k * AROUND + i;
        const b = base + k * AROUND + ((i + 1) % AROUND);
        idx.push(a, a + AROUND, b, b, a + AROUND, b + AROUND);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createFires(level: Level, haze: HazeUniforms): FiresView | null {
  const fires = firesOf(level);
  if (fires.length === 0) return null;
  const layouts = fireLayouts(level, fires);
  const group = new THREE.Group();
  group.name = "fires";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const std = (
    p: THREE.MeshStandardMaterialParameters,
    name: string,
  ): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial({ flatShading: true, ...p }), haze, name);
    mats.push(m);
    return m;
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const at = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const way = new THREE.Vector3();
  const colour = new THREE.Color();
  const bark = new THREE.Color(0x6e5038);
  const birch = new THREE.Color(0xc9c1b3);
  const char = new THREE.Color(0x17120f);

  const instanced = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    n: number,
    fill: (mesh: THREE.InstancedMesh) => void,
  ): void => {
    if (n === 0) return;
    geos.push(geo);
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    fill(mesh);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
    group.add(mesh);
  };

  // THE STONES: a faceted lump, flattened.
  const stones = layouts.flatMap((f) => f.stones);
  instanced(
    new THREE.IcosahedronGeometry(1, 0),
    std({ color: 0xffffff, roughness: 0.9 }, "fire-stone"),
    stones.length,
    (mesh) =>
      stones.forEach((s, i) => {
        q.setFromAxisAngle(up, s.yaw);
        sc.set(s.size * 1.15, s.size * s.flat, s.size);
        mesh.setMatrixAt(i, m4.compose(at.set(s.x, s.y, s.z), q, sc));
        // Sooted on the inside of the ring, grey granite elsewhere.
        const g = 0.16 + 0.12 * fireHash(s.x, s.z, 5);
        mesh.setColorAt(i, colour.setRGB(g, g * 0.97, g * 0.93));
      }),
  );
  // THE LOGS: a seven-sided log along its axis, its bark by its tone.
  const logs = layouts.flatMap((f) => f.logs);
  const along = (piece: { dx: number; dy: number; dz: number }): THREE.Quaternion =>
    q.setFromUnitVectors(up, way.set(piece.dx, piece.dy, piece.dz));
  instanced(
    new THREE.CylinderGeometry(1, 1, 1, 7, 1),
    std({ color: 0xffffff, roughness: 0.95 }, "fire-log"),
    logs.length,
    (mesh) =>
      logs.forEach((l, i) => {
        sc.set(l.radius, l.length, l.radius);
        mesh.setMatrixAt(i, m4.compose(at.set(l.x, l.y, l.z), along(l), sc));
        const wood = fireHash(l.x, l.z, 11) < 0.35 ? birch : bark;
        mesh.setColorAt(i, colour.copy(wood).lerp(char, l.tone));
      }),
  );
  // THE BENCHES: a split half log, its round side down, its flat face up.
  const seats = layouts.flatMap((f) => f.seats);
  const half = new THREE.CylinderGeometry(1, 1, 1, 9, 1, false, 0, Math.PI).rotateZ(-Math.PI / 2);
  const face = new THREE.PlaneGeometry(1, 2).rotateX(-Math.PI / 2);
  const seatGeo = mergeGeometries([half.deleteAttribute("uv"), face.deleteAttribute("uv")])!;
  half.dispose();
  face.dispose();
  instanced(
    seatGeo,
    std({ color: 0xffffff, roughness: 0.92, side: THREE.DoubleSide }, "fire-bench"),
    seats.length,
    (mesh) =>
      seats.forEach((s, i) => {
        q.setFromAxisAngle(up, s.heading - Math.PI / 2);
        sc.set(s.length, s.radius, s.radius);
        mesh.setMatrixAt(i, m4.compose(at.set(s.x, s.y, s.z), q, sc));
        const g = 0.85 + 0.15 * fireHash(s.x, s.z, 3);
        mesh.setColorAt(i, colour.setRGB(0.5 * g, 0.37 * g, 0.25 * g));
      }),
  );
  // THE GRILL: sooty steel bars.
  const bars = layouts.flatMap((f) => f.bars);
  instanced(
    new THREE.CylinderGeometry(1, 1, 1, 4, 1),
    std({ color: 0x2a2624, roughness: 0.6, metalness: 0.5 }, "fire-grate"),
    bars.length,
    (mesh) =>
      bars.forEach((b, i) => {
        sc.set(b.radius, b.length, b.radius);
        mesh.setMatrixAt(i, m4.compose(at.set(b.x, b.y, b.z), along(b), sc));
      }),
  );

  // THE TRAMPLED SNOW.
  const groundGeo = groundGeometry(level, layouts);
  geos.push(groundGeo);
  const groundMat = std(
    { color: 0xffffff, roughness: 0.95, vertexColors: true, transparent: true, depthWrite: false },
    "fire-ground",
  );
  groundMat.flatShading = false;
  groundMat.polygonOffset = true;
  groundMat.polygonOffsetFactor = -2;
  groundMat.polygonOffsetUnits = -2;
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.renderOrder = 1;
  group.add(ground);

  // THE FIRE'S OWN UNIFORMS, shared by every shader of it.
  const shared = {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector3() },
    uNight: { value: 0 },
    uPx: { value: 0.001 },
    uLit: { value: new THREE.Color(0.8, 0.8, 0.8) },
    uHaze: haze.uHaze,
    uReach: { value: REACH },
  };
  const shader = (
    vertex: string,
    fragment: string,
    blending: THREE.Blending,
  ): THREE.ShaderMaterial => {
    const m = new THREE.ShaderMaterial({
      uniforms: shared,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending,
    });
    mats.push(m);
    return m;
  };
  const draw = (
    geo: THREE.InstancedBufferGeometry,
    mat: THREE.Material,
    order: number,
    name: string,
  ): void => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.name = name;
    group.add(mesh);
  };
  const attr = (
    geo: THREE.InstancedBufferGeometry,
    name: string,
    data: number[],
    size: number,
  ): void => {
    geo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(data), size));
  };

  // THE EMBERS: a disc over each hearth, glowing in cells and breathing.
  const emberGeo = quad(-1);
  attr(
    emberGeo,
    "aBed",
    layouts.flatMap((f) => [f.fire.x, f.floor + 0.03, f.fire.z, f.embers]),
    4,
  );
  emberGeo.instanceCount = layouts.length;
  draw(
    emberGeo,
    shader(
      /* glsl */ `
      attribute vec4 aBed;
      uniform float uTime;
      ${FADE}
      varying vec2 vUv;
      varying float vFade;
      varying float vSeed;
      void main() {
        vec3 p = aBed.xyz + vec3(position.x, 0.0, position.y) * aBed.w;
        vUv = position.xy;
        vSeed = fract(aBed.x * 0.37 + aBed.z * 0.61);
        vFade = fadeAt(length(cameraPosition - p));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
      /* glsl */ `
      uniform float uTime;
      ${NOISE}
      ${COLOURS}
      varying vec2 vUv;
      varying float vFade;
      varying float vSeed;
      void main() {
        float r = length(vUv);
        if (r > 1.0) discard;
        float cells = fNoise(vUv * 7.0 + vSeed * 40.0);
        float breath = fNoise(vUv * 2.5 + vec2(uTime * 0.6, -uTime * 0.45) + vSeed * 9.0);
        float g = smoothstep(0.35, 0.85, cells * (0.6 + 0.6 * breath)) * (1.0 - r * r);
        vec3 col = mix(vec3(0.03, 0.022, 0.018), F_RED * 1.6, smoothstep(0.0, 0.5, g));
        col = mix(col, F_ORANGE, smoothstep(0.5, 1.0, g));
        gl_FragColor = vec4(col, smoothstep(1.0, 0.75, r) * vFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      THREE.NormalBlending,
    ),
    2,
    "fire-embers",
  );

  // THE FLAMES: a quad a tongue, its foot on the hearth.
  const tongues = layouts.flatMap((f) => f.tongues);
  const flameGeo = quad(0);
  attr(
    flameGeo,
    "aBase",
    tongues.flatMap((t) => [t.x, t.y, t.z, t.seed]),
    4,
  );
  attr(
    flameGeo,
    "aSize",
    tongues.flatMap((t) => [t.width, t.height]),
    2,
  );
  flameGeo.instanceCount = tongues.length;
  draw(
    flameGeo,
    shader(
      /* glsl */ `
      attribute vec4 aBase;
      attribute vec2 aSize;
      uniform float uTime;
      uniform vec3 uWind;
      ${FADE}
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;
      void main() {
        float s = aBase.w;
        float breathe = 0.8 + 0.12 * sin(uTime * 5.3 + s * 17.3) + 0.08 * sin(uTime * 11.7 + s * 31.1);
        float h = aSize.y * breathe;
        vec3 toEye = cameraPosition - aBase.xyz;
        vec2 side = normalize(vec2(toEye.z, -toEye.x) + vec2(1e-5, 0.0));
        float v = position.y;
        vec3 p = aBase.xyz + vec3(side.x, 0.0, side.y) * position.x * aSize.x * 0.5;
        p.y += v * h;
        // Laid over by the wind, the top the most.
        vec2 lay = uWind.xz * 0.05;
        lay /= max(1.0, length(lay) / 0.6);
        p.xz += lay * h * v * v;
        vUv = vec2(position.x, v);
        vSeed = s;
        vFade = fadeAt(length(cameraPosition - p));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
      /* glsl */ `
      uniform float uTime;
      ${NOISE}
      ${COLOURS}
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;
      void main() {
        float v = vUv.y;
        float t = uTime;
        float n = fFbm(vec2(vUv.x * 1.8 + vSeed * 7.0, v * 2.6 - t * 3.0 + vSeed * 3.0));
        float n2 = fNoise(vec2(vUv.x * 5.0 + vSeed * 13.0, v * 7.0 - t * 6.0));
        // Licking side to side, the more the higher.
        float u = vUv.x + (n - 0.5) * 1.0 * v + 0.18 * sin(v * 7.0 - t * 8.0 + vSeed * 20.0) * v;
        // Widest low, drawn to a point at the top.
        float prof = (1.0 - pow(v, 1.15)) * mix(0.65, 1.0, smoothstep(0.0, 0.15, v));
        // Its tongues torn off the top.
        float d = prof - abs(u) + (n2 - 0.5) * 0.55 * v * v + (n - 0.5) * 0.35;
        float a = smoothstep(0.0, 0.1, d);
        if (a < 0.01) discard;
        float heat = clamp(d * 2.4 * (1.2 - v), 0.0, 1.0);
        vec3 col = mix(F_RED, F_ORANGE, smoothstep(0.04, 0.4, heat));
        col = mix(col, F_WHITE, smoothstep(0.5, 0.95, heat));
        float alpha = a * mix(0.55, 1.0, heat) * smoothstep(0.0, 0.05, v) * vFade;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      THREE.NormalBlending,
    ),
    5,
    "fire-flames",
  );

  // THE GLOW round the flames: warm by day, wide at night.
  const glowGeo = quad(-1);
  // Two attributes from one list: the place, then the sizes and seed.
  const glowData = layouts.flatMap((f) => {
    const G = FIRE_LOOK[f.fire.kind].glow;
    return [
      f.fire.x,
      f.floor + f.fire.flames * 0.4,
      f.fire.z,
      G.day,
      G.night,
      fireHash(f.fire.x, f.fire.z, 4),
    ];
  });
  const glowBuf = new THREE.InstancedInterleavedBuffer(new Float32Array(glowData), 6);
  glowGeo.setAttribute("aGlow", new THREE.InterleavedBufferAttribute(glowBuf, 3, 0));
  glowGeo.setAttribute("aGlowSize", new THREE.InterleavedBufferAttribute(glowBuf, 3, 3));
  glowGeo.instanceCount = layouts.length;
  draw(
    glowGeo,
    shader(
      /* glsl */ `
      attribute vec3 aGlow;
      attribute vec3 aGlowSize;
      uniform float uTime;
      uniform float uNight;
      ${FADE}
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float size = mix(aGlowSize.x, aGlowSize.y, uNight) * 0.5;
        float s = aGlowSize.z * 17.3;
        float flick = 0.92 + 0.09 * sin(uTime * 5.3 + s) + 0.06 * sin(uTime * 9.1 + s * 1.7);
        vec4 mv = viewMatrix * vec4(aGlow, 1.0);
        float dist = length(mv.xyz);
        // Drawn a little toward the lens, so the snow does not cut it.
        mv.xyz += normalize(-mv.xyz) * min(size * 0.6, dist * 0.5);
        mv.xy += position.xy * size;
        vUv = position.xy;
        // A halo for the eye standing off: close to, the flames are their own.
        vAlpha = mix(0.35, 0.8, uNight) * flick * fadeAt(dist) * smoothstep(size, size * 4.0, dist);
        gl_Position = projectionMatrix * mv;
      }`,
      /* glsl */ `
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float r = length(vUv);
        if (r > 1.0) discard;
        float g = (1.0 - r);
        g = g * g * g;
        gl_FragColor = vec4(vec3(1.0, 0.45, 0.12) * g * vAlpha, 1.0);
        #include <colorspace_fragment>
      }`,
      THREE.AdditiveBlending,
    ),
    6,
    "fire-glow",
  );

  // THE SPARKS: off the hearth, rising, slowing and swirling off downwind.
  const sparkSrc: number[] = [];
  const spark: number[] = [];
  // THE SMOKE: puffs off the flames' tops.
  const smokeSrc: number[] = [];
  const smoke: number[] = [];
  for (const f of layouts) {
    const L = FIRE_LOOK[f.fire.kind];
    for (let i = 0; i < L.sparks.count; i++) {
      sparkSrc.push(f.fire.x, f.floor, f.fire.z, f.fire.radius);
      spark.push(
        L.sparks.rise,
        L.sparks.life,
        f.fire.flames,
        fireHash(f.fire.x, f.fire.z, 1000 + i),
      );
    }
    for (let i = 0; i < L.smoke.count; i++) {
      smokeSrc.push(f.fire.x, f.floor + f.fire.flames * 0.7, f.fire.z, L.smoke.alpha);
      smoke.push(L.smoke.rise, L.smoke.life, L.smoke.size, L.smoke.swell);
    }
  }
  const sparkGeo = quad(-1);
  attr(sparkGeo, "aSrc", sparkSrc, 4);
  attr(sparkGeo, "aSpark", spark, 4);
  sparkGeo.instanceCount = spark.length / 4;
  draw(
    sparkGeo,
    shader(
      /* glsl */ `
      attribute vec4 aSrc;
      attribute vec4 aSpark;
      uniform float uTime;
      uniform vec3 uWind;
      uniform float uNight;
      uniform float uPx;
      ${FADE}
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHeat;
      void main() {
        float s = aSpark.w;
        float life = aSpark.y * (0.6 + 0.8 * fract(s * 7.13));
        float tau = mod(uTime + s * 31.7, life);
        float k = tau / life;
        float a = s * 81.68;
        float r0 = aSrc.w * 0.6 * sqrt(fract(s * 3.7));
        vec3 p = aSrc.xyz + vec3(sin(a) * r0, aSpark.z * (0.15 + 0.3 * fract(s * 9.1)), cos(a) * r0);
        float rise = aSpark.x * (0.5 + fract(s * 5.3));
        p.y += rise * tau - 0.2 * rise * tau * tau / life;
        p.xz += uWind.xz * tau * 0.6 + vec2(sin(tau * 3.1 + a), cos(tau * 2.7 + a)) * 0.3 * tau;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float dist = length(mv.xyz);
        float size = max(0.02 * (1.0 - 0.5 * k), dist * uPx);
        mv.xy += position.xy * size;
        vUv = position.xy;
        vHeat = 1.0 - k;
        vAlpha = (1.0 - k) * smoothstep(0.0, 0.04, k) * mix(0.3, 1.0, uNight)
          * (0.6 + 0.4 * sin(uTime * 23.0 + a)) * fadeAt(dist) * smoothstep(250.0, 120.0, dist);
        gl_Position = projectionMatrix * mv;
      }`,
      /* glsl */ `
      ${COLOURS}
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHeat;
      void main() {
        float r = dot(vUv, vUv);
        if (r > 1.0) discard;
        vec3 col = mix(F_RED * 2.2, F_ORANGE * 1.6, vHeat);
        col = mix(col, F_WHITE * 1.3, smoothstep(0.85, 1.0, vHeat));
        gl_FragColor = vec4(col * (1.0 - r) * vAlpha, 1.0);
        #include <colorspace_fragment>
      }`,
      THREE.AdditiveBlending,
    ),
    7,
    "fire-sparks",
  );

  const smokeGeo = quad(-1);
  attr(smokeGeo, "aSrc", smokeSrc, 4);
  attr(smokeGeo, "aSmoke", smoke, 4);
  smokeGeo.instanceCount = smoke.length / 4;
  draw(
    smokeGeo,
    shader(
      /* glsl */ `
      attribute vec4 aSrc;
      attribute vec4 aSmoke;
      uniform float uTime;
      uniform vec3 uWind;
      uniform float uNight;
      uniform vec3 uLit;
      ${FADE}
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vCol;
      varying float vSeed;
      void main() {
        float s = fract(float(gl_InstanceID) * 0.618034 + aSrc.x * 0.013);
        float life = aSmoke.y;
        float tau = mod(uTime + s * life, life);
        float k = tau / life;
        // Up on its heat, slowing as it cools; carried off by the wind.
        float rise = aSmoke.x * (1.0 - exp(-tau * 0.4)) / 0.4;
        float size = aSmoke.z + aSmoke.w * tau;
        vec3 p = aSrc.xyz + vec3(0.0, rise, 0.0);
        // The column stands a breath before the wind lays it over.
        p.xz += uWind.xz * 0.75 * (tau - 1.5 * (1.0 - exp(-tau / 1.5)));
        p.xz += vec2(sin(s * 40.0 + tau * 0.7), cos(s * 53.0 + tau * 0.6)) * size * 0.35;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float dist = length(mv.xyz);
        float spin = s * 6.2831853 + tau * 0.25;
        vec2 q = vec2(cos(spin) * position.x - sin(spin) * position.y,
                      sin(spin) * position.x + cos(spin) * position.y);
        mv.xy += q * size;
        vUv = position.xy;
        vSeed = s;
        vAlpha = aSrc.w * smoothstep(0.0, 0.05, k) * pow(1.0 - k, 1.4) * fadeAt(dist)
          * smoothstep(1.0, 3.0, dist);
        // Grey off wood, lit by the sky; glowing from under by the fire at night.
        vCol = uLit * vec3(0.2, 0.2, 0.2) + vec3(1.0, 0.42, 0.12) * uNight * 0.5 * exp(-tau * 1.4);
        gl_Position = projectionMatrix * mv;
      }`,
      /* glsl */ `
      ${NOISE}
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vCol;
      varying float vSeed;
      void main() {
        float r = dot(vUv, vUv);
        if (r > 1.0) discard;
        float soft = (1.0 - r) * (1.0 - r);
        float wisp = 0.55 + 0.6 * fNoise(vUv * 2.5 + vSeed * 30.0);
        gl_FragColor = vec4(vCol, vAlpha * soft * wisp);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
      THREE.NormalBlending,
    ),
    4,
    "fire-smoke",
  );

  const near: FireLayout[] = [];
  const seeds = new Map(layouts.map((f) => [f, fireHash(f.fire.x, f.fire.z, 4)]));
  return {
    group,
    layouts,
    update(t, look, wind, _eye, pixels, lit) {
      shared.uTime.value = t;
      shared.uWind.value.set(wind.x, 0, wind.z);
      shared.uNight.value = Math.min(1, Math.max(0, lit));
      shared.uPx.value = 1.6 / Math.max(1, pixels);
      const k = look.keyIntensity * 0.4;
      const a = look.ambient * 0.8;
      shared.uLit.value.setRGB(
        look.keyColour[0] * k + look.skyLight[0] * a,
        look.keyColour[1] * k + look.skyLight[1] * a,
        look.keyColour[2] * k + look.skyLight[2] * a,
      );
    },
    lamps(eye, t, out) {
      if (!group.visible) return;
      for (const f of nearestFires(layouts, eye.x, eye.y, eye.z, near)) {
        out.push({
          x: f.lamp.x,
          y: f.lamp.y,
          z: f.lamp.z,
          dx: 0,
          dy: -1,
          dz: 0,
          colour: FIRE_LIGHT,
          beam: ALL_ROUND,
          power: f.lamp.power * flickerAt(t, seeds.get(f) ?? 0),
        });
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const m of meshes) m.dispose();
    },
  };
}
