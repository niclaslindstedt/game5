// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EFFECTS' NODE TWINS (`docs/webgpu.md`, part 12), in the `effects`
// family of the register: what `sky-twins-tsl.ts` hands for these flags,
// each over its ShaderMaterial's own uniforms by reference, term for term
// with the GLSL.
//
//   rotor       a rotor's or a propeller's smear (`rotor-disc.ts`)
//   lift-fade   the black sheet over the frame as the chair runs through a
//               station (`lifts.ts`)
//   flame       the balloon's burner, its jets and pilots
//               (`balloon-flame.ts` → `balloon-flame-tsl.ts`)
//   burn-*      a skier burning: the flames, the glow, the sparks, the
//               smoke (`burn-view.ts` → `burn-tsl.ts`)
//   xray-*      the X-ray's bones and organs, the glass, the mask, the veil
//               and the blood (`xray-view.ts`, `xray-blood.ts` →
//               `xray-tsl.ts`)

import * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { particleMaterial } from "./air-tsl.ts";
import { flameTwin } from "./balloon-flame-tsl.ts";
import { burnTwin } from "./burn-tsl.ts";
import { glslMod, shaderOwn } from "./figure-tsl.ts";
import type { N } from "./haze-tsl.ts";
import type { DiscSpec } from "./rotor-disc.ts";
import { xrayTwin } from "./xray-tsl.ts";

const {
  Discard,
  Fn,
  If,
  atan,
  float,
  fwidth,
  length,
  max,
  min,
  mix,
  positionGeometry,
  pow,
  select,
  smoothstep,
  vec3,
  vec4,
} = TSL as N;

/** THE SMEAR (`rotorDisc`): each blade's width swept over the arc it turns
 * in a picture, faded toward an even haze, the painted tips a ring. */
function rotorTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const d = m.userData.disc as DiscSpec;
  const opacity = shaderOwn("uOpacity", "float");
  const smearU = shaderOwn("uSmear", "float");
  const contrast = shaderOwn("uContrast", "float");
  const blade = shaderOwn("uBlade", "color");
  const tip = shaderOwn("uTip", "color");
  const blood = shaderOwn("uBlood", "float");
  const shade = shaderOwn("uShade", "float");
  const gap = (2 * Math.PI) / d.blades;
  const fragment = Fn(() => {
    const at = positionGeometry.xy.toVar();
    // The footprint, in uniform control flow before the discard.
    const pixel = length(fwidth(at)).toVar();
    const mm = length(at).toVar();
    const r = mm.div(d.radius).toVar();
    If(r.greaterThan(1).or(mm.lessThan(d.root)), () => {
      Discard();
    });
    const a = atan(at.y, at.x);
    const behind = glslMod(a.sub(d.first).mul(d.trail), gap).toVar();
    const chord = float(d.chord).mul(float(1).sub(float(d.taper).mul(smoothstep(d.tipFrom, 1, r))));
    const hw = chord.mul(0.5).div(mm).toVar();
    const drawn = max(hw, pixel.mul(0.7).div(mm)).toVar();
    const smear = max(smearU, 1e-4).toVar();
    let cover: N = float(0);
    for (let k = -1; k <= 2; k++) {
      const b = behind.add(k * gap);
      cover = cover.add(max(min(b.add(drawn), smear).sub(max(b.sub(drawn), 0)), 0));
    }
    const even = hw.mul(2).div(gap);
    const shared = mix(even, cover.mul(hw).div(drawn.mul(smear)), contrast);
    const rim = float(1).sub(smoothstep(float(1).sub(pixel.div(d.radius)), 1, r));
    const alpha = opacity
      .mul(d.strength ?? 1)
      .mul(rim)
      .mul(pow(shared.mul(2.5).clamp(0, 1), 0.6))
      .toVar();
    const ink = mix(select(r.greaterThan(d.band), tip, blade), vec3(0.32, 0.015, 0.02), blood);
    return vec4(ink.mul(shade), alpha.add(blood.mul(0.25).mul(alpha)));
  })();
  return particleMaterial("rotor-disc", m, null, fragment);
}

/** THE FADE through a station: black over the whole frame, in clip space. */
function fadeTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const fade = shaderOwn("uFade", "float");
  const vertex = vec4(positionGeometry.xy, 0, 1);
  return particleMaterial("lift-fade", m, vertex, vec4(0, 0, 0, fade));
}

/** The twin for effect flag `kind` over `m`, or null for one not an
 * effect's. */
export function effectTwin(m: THREE.ShaderMaterial, kind: string): NodeMaterial | null {
  switch (kind) {
    case "rotor":
      return rotorTwin(m);
    case "lift-fade":
      return fadeTwin(m);
    case "flame":
      return flameTwin(m);
    default:
      return burnTwin(m, kind) ?? xrayTwin(m, kind);
  }
}
