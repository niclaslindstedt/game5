// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GEAR STAGE'S BACKDROP ON THE NODE RENDERER (`docs/webgpu.md`, part
// 14): `stage-backdrop.ts`'s two grafts and its sky, restated term for term
// for the stage's own renderer (`own-gpu.ts`, `gear-stage.ts`).
//
//   stage-snow    the corduroy on the piste and the drift off it, as the
//                 copy's colour; the glitter, as its emissive
//   stage-meadow  a summer's grass, its tussocks and the dirt trail with
//                 its two ruts, as the copy's colour
//   stage-sky     the dome: the deep blue overhead paling to the haze at
//                 the horizon, warm toward the sun, drawn at the far plane
//
// The grafts' numbers are the ones `stage-backdrop.ts` hands WebGL's
// (`userData.stage`: the piste's half width and the sun), and the sky reads
// the ShaderMaterial's own uniforms.

import type * as THREE from "three";
import * as TSL from "three/tsl";
import { NodeMaterial } from "three/webgpu";

import { slot, type N } from "./haze-tsl.ts";

const {
  Fn,
  abs,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  cos,
  distance,
  dot,
  floor,
  fract,
  fwidth,
  materialColor,
  materialEmissive,
  max,
  mix,
  modelViewMatrix,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  select,
  sin,
  smoothstep,
  step,
  varying,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** The numbers a backdrop graft is handed (`stage-backdrop.ts`). */
export type StageOwn = { piste: number; sun: [number, number, number] };

/** `stageHash`: a grain's own number. */
const hash = (p: N): N => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));

/** `stageNoise`: the hash smoothed between the lattice's corners. */
function noise(p: N): N {
  const i = floor(p).toVar();
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3)).toVar();
  return mix(
    mix(hash(i), hash(i.add(vec2(1, 0))), f.x),
    mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x),
    f.y,
  );
}

/** Finish the copy of a backdrop graft `kind`; false for another kind. */
export function finishStage(copy: NodeMaterial, material: THREE.Material, kind: string): boolean {
  const c = copy as NodeMaterial & Record<string, N>;
  const own = material.userData.stage as StageOwn | undefined;
  if (kind === "stage-snow" && own) {
    const w = positionWorld;
    const piste = own.piste;
    const onPiste = smoothstep(piste - 0.6, piste + 0.4, abs(w.x))
      .oneMinus()
      .toVar();
    const cordX = w.x.div(0.07).toVar();
    const cordW = fwidth(cordX);
    const cord = mix(cos(cordX.mul(6.2831853)).mul(0.5).add(0.5), 0.5, clamp(cordW.mul(1.6), 0, 1));
    const drift = hash(floor(w.xz.mul(0.7)));
    const shade = onPiste
      .mul(0.15)
      .mul(cord)
      .oneMinus()
      .mul(onPiste.oneMinus().mul(0.03).mul(drift).oneMinus());
    c.colorNode = materialColor.mul(vec4(vec3(shade), 1));
    const grain = floor(w.xz.mul(70)).toVar();
    const eye = normalize(cameraPosition.sub(w));
    const facing = hash(grain.add(floor(dot(eye, vec3(37, 11, 23)).mul(3))));
    const glint = step(0.9965, hash(grain)).mul(step(0.55, facing));
    const near = smoothstep(4, 22, distance(cameraPosition, w)).oneMinus();
    const sunUp = Math.max(0, own.sun[1]);
    c.emissiveNode = materialEmissive.add(
      vec3(1, 0.98, 0.94).mul(glint.mul(near).mul(2.2 * sunUp)),
    );
  } else if (kind === "stage-meadow") {
    const xz = positionWorld.xz.toVar();
    const z = positionWorld.z;
    const tuft = noise(xz.mul(1.7))
      .mul(0.6)
      .add(noise(xz.mul(0.21)).mul(0.4));
    const grass0 = mix(vec3(0.13, 0.21, 0.06), vec3(0.3, 0.38, 0.12), tuft);
    const grass = mix(
      grass0,
      vec3(0.42, 0.4, 0.22),
      smoothstep(0.62, 0.9, noise(xz.mul(0.05))).mul(0.35),
    );
    const wander = sin(z.mul(0.045))
      .mul(0.9)
      .add(sin(z.mul(0.13).add(1.3)).mul(0.4));
    const across = abs(positionWorld.x.sub(wander)).toVar();
    const trail = smoothstep(0.75, 1.15, across.add(noise(xz.mul(3)).sub(0.5).mul(0.3)))
      .oneMinus()
      .mul(smoothstep(180, 260, z).oneMinus());
    const dirt0 = mix(vec3(0.3, 0.23, 0.16), vec3(0.42, 0.34, 0.25), noise(xz.mul(6)));
    const ruts = smoothstep(0.05, 0.16, abs(across.sub(0.32)))
      .oneMinus()
      .mul(-0.25)
      .add(1);
    c.colorNode = vec4(mix(grass, dirt0.mul(ruts), trail), materialColor.a);
  } else {
    return false;
  }
  // A draw's uniforms are refreshed in full only for a material with a node
  // of its own, and the material three checks is `material`.
  (material as unknown as { graftNode?: N }).graftNode ??= c.colorNode;
  return true;
}

/** THE SKY'S TWIN (`buildSky`), over the ShaderMaterial's own uniforms. */
export function stageSkyTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const u = m.uniforms;
  const zenith = slot(u.uZenith, "color");
  const horizon = slot(u.uHorizon, "color");
  const warm = slot(u.uWarm, "color");
  const sun = slot(u.uSun, "vec3");
  const dir = varying(normalize(positionLocal), "vStageDir");
  const material = new NodeMaterial();
  material.name = "stage-sky";
  material.side = m.side;
  material.depthWrite = false;
  material.fog = false;
  material.lights = false;
  material.toneMapped = false;
  const clip = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1)).toVar();
  material.vertexNode = vec4(clip.xy, clip.w, clip.w);
  material.fragmentNode = Fn(() => {
    const up = clamp(dir.y, 0, 1).toVar();
    const base = mix(horizon, zenith, pow(up, 0.38));
    const toSun = max(0, dot(normalize(vec3(dir.x, 0, dir.z)), normalize(vec3(sun.x, 0, sun.z))));
    const c = mix(base, warm, pow(toSun, 3).mul(up.oneMinus()).mul(0.22));
    return vec4(select(dir.y.lessThan(0), horizon, c), 1);
  })();
  return material;
}
