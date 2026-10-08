// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLEEDING INSIDE HIM, as the X-ray shows it. A bone broken through
// tears the vessels round it, and the blood goes where there is room for it:
// a long bone's break swells into a pool in the muscle round it, a rib's
// fills the chest, the pelvis and the lower spine fill the belly, a broken
// skull bleeds over the brain, and a torn organ fills the cavity it lies in.
// Each pool grows from nothing to the volume such a bleed reaches, rides the
// bone frame it bled from, and slops on his heart's beat.
//
// Presentation only, read off the body's record like the rest of the X-ray
// (`xray-view.ts` hands it where each bone broke and each organ tore).

import * as THREE from "three";

import type { Bone, BoneKind, Organ } from "@engine";

/** THE POOLS: the radius each kind of bleed swells to, m — the volume of
 * blood lost into it (a broken femur's thigh holds 1–1.5 l, a pelvis's belly
 * 2–3 l, a chest a litre or more each side), as a sphere — and how long it
 * takes, GAME s: shortened for play (the run is slowed while it is shown, so
 * this is several seconds on screen), as the pulse of the heart is. */
export const BLEED = {
  bone: {
    femur: 0.075,
    pelvis: 0.095,
    ribs: 0.09,
    tibia: 0.05,
    fibula: 0.035,
    humerus: 0.05,
    radius: 0.03,
    ulna: 0.03,
    clavicle: 0.035,
    scapula: 0.04,
    skull: 0.035,
    cervical: 0.03,
    thoracic: 0.045,
    lumbar: 0.06,
    sternum: 0.04,
    mandible: 0.02,
    patella: 0.03,
    hand: 0.02,
    foot: 0.025,
  } as Partial<Record<BoneKind, number>>,
  organ: {
    brain: 0.035,
    heart: 0.055,
    lung: 0.065,
    liver: 0.085,
    spleen: 0.08,
    stomach: 0.06,
    bowel: 0.07,
    kidney: 0.05,
    bladder: 0.05,
  } as Record<string, number>,
  /** A hairline bleeds this share of a break. */
  hairline: 0.35,
  /** A long bone's pool is drawn out along it this much. */
  along: 1.6,
  grow: 0.4,
  colour: 0x7a0410,
  rim: 0xff3a30,
} as const;

/** Where the blood from a broken trunk bone pools: in the cavity it bounds. */
export const CAVITY: Partial<Record<BoneKind, Organ>> = {
  ribs: "heart",
  sternum: "heart",
  thoracic: "heart",
  lumbar: "bowel",
  pelvis: "bladder",
  skull: "brain",
};

const VERT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uBeat;
varying vec3 vNormal;
varying vec3 vView;
float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)) + uSeed) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
void main() {
  // A lumpy pool, slopping slowly and swelling on the beat.
  float n = noise(position * 2.2 + vec3(0.0, uTime * 0.6, uSeed)) * 0.7
          + noise(position * 4.5 - vec3(uTime * 0.4, 0.0, 0.0)) * 0.3;
  vec3 p = position * (0.72 + 0.5 * n + 0.06 * uBeat);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColour;
uniform vec3 uRim;
uniform float uAlpha;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.8);
  vec3 col = mix(uColour, uRim, f * 0.8);
  gl_FragColor = vec4(col, uAlpha * (0.55 + 0.4 * f));
  #include <colorspace_fragment>
}
`;

/** One bleed this frame: where (in the frame of `matrix`), how big it gets,
 * the game second it began, and the axis a long bone's pool is drawn along. */
export type Bleed = {
  key: Bone | Organ;
  matrix: THREE.Matrix4;
  at: THREE.Vector3;
  axis: THREE.Vector3 | null;
  radius: number;
  since: number;
};

export type XrayBlood = {
  group: THREE.Group;
  /** Draw these bleeds at game second `t`, the glass `alpha` and the heart's
   * `beat` (0 … 1); every pool not named is put away. */
  update(bleeds: readonly Bleed[], t: number, alpha: number, beat: number): void;
  /** A new run: every pool gone. */
  clear(): void;
  dispose(): void;
};

const smooth = (k: number): number => k * k * (3 - 2 * k);

export function createXrayBlood(order: number): XrayBlood {
  const group = new THREE.Group();
  group.name = "xray-blood";
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pools = new Map<string, { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }>();
  const up = new THREE.Vector3(0, 1, 0);
  const turn = new THREE.Quaternion();
  const size = new THREE.Vector3();
  const local = new THREE.Matrix4();

  const poolOf = (key: string, seed: number) => {
    let p = pools.get(key);
    if (!p) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed },
          uBeat: { value: 0 },
          uColour: { value: new THREE.Color(BLEED.colour) },
          uRim: { value: new THREE.Color(BLEED.rim) },
          uAlpha: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      group.add(mesh);
      p = { mesh, mat };
      pools.set(key, p);
    }
    return p;
  };

  const drop = (key: string): void => {
    const p = pools.get(key);
    if (!p) return;
    group.remove(p.mesh);
    p.mat.dispose();
    pools.delete(key);
  };

  return {
    group,
    update(bleeds, t, alpha, beat) {
      const live = new Set<string>();
      bleeds.forEach((b, i) => {
        const r = b.radius * smooth(Math.min(1, Math.max(0, (t - b.since) / BLEED.grow)));
        if (r <= 0.002) return;
        live.add(b.key);
        const p = poolOf(b.key, (i * 7.31) % 10);
        if (b.axis) {
          turn.setFromUnitVectors(up, b.axis);
          size.set(r, r * BLEED.along, r);
        } else {
          turn.identity();
          size.set(r, r, r);
        }
        local.compose(b.at, turn, size);
        p.mesh.matrix.multiplyMatrices(b.matrix, local);
        p.mesh.matrixWorldNeedsUpdate = true;
        const u = p.mat.uniforms;
        u.uTime.value = t;
        u.uBeat.value = beat;
        u.uAlpha.value = alpha;
      });
      for (const key of [...pools.keys()]) if (!live.has(key)) drop(key);
    },
    clear() {
      for (const key of [...pools.keys()]) drop(key);
    },
    dispose() {
      this.clear();
      geo.dispose();
    },
  };
}
