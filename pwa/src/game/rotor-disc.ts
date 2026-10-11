// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A ROTOR'S SMEAR AS DRAWN — the disc a turning rotor or propeller is drawn
// as once its blades blur (`rotor-look.ts` says how much, a frame at a
// time), and the model's own blades faded out as the smear takes over:
// the helicopter's main and tail rotors (`heli-view.ts`) and the jump
// plane's propeller (`plane-view.ts`) alike.

import * as THREE from "three";

import type { RotorLook } from "./rotor-look.ts";

/** A rotor's blades as the shader draws them, in the rotor's own frame. */
export type DiscSpec = {
  /** The tip's radius and where the blades start, m. */
  radius: number;
  root: number;
  /** The chord, m, and the share of it the tip tapers off, from `tipFrom`
   * (a share of the radius) out. */
  chord: number;
  taper: number;
  tipFrom: number;
  /** Where the painted tip band starts, a share of the radius (past 1 for
   * none). */
  band: number;
  blades: number;
  /** Blade 0's angle in the disc's plane, rad, and the way the smear
   * trails it: +1 toward a larger angle. */
  first: number;
  trail: 1 | -1;
  /** How strongly the haze reads, a share of the lifted cover (1 when left
   * out): a propeller seen from the seat right behind it fills the view and
   * is a fainter veil than a rotor seen from below. */
  strength?: number;
};

/** THE SMEAR: each blade's ink spread over the arc it sweeps in one
 * picture (`RotorLook.smear`), the pattern faded toward an even haze as the
 * strobe dissolves it (`contrast`). A blade covers its own width of disc
 * whatever it is smeared over, so the wedges thin as they widen and a rotor
 * at speed is a faint haze — darkest at the root, where the blade is widest
 * for its radius, with the painted tips a ring at its rim. */
export function rotorDisc(d: DiscSpec): THREE.Mesh {
  const f = (v: number): string => v.toFixed(5);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uSmear: { value: 0 },
      uContrast: { value: 1 },
      uBlade: { value: new THREE.Color(0.05, 0.052, 0.056) },
      uTip: { value: new THREE.Color(0.5, 0.05, 0.06) },
      uBlood: { value: 0 },
      // The ink's light: the shader is unlit, so a disc in the dark is
      // darkened by its owner (`shadeDisc`), never glowing.
      uShade: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vAt;
      void main() {
        vAt = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uSmear;
      uniform float uContrast;
      uniform vec3 uBlade;
      uniform vec3 uTip;
      uniform float uBlood;
      uniform float uShade;
      varying vec2 vAt;
      const float GAP = ${f((2 * Math.PI) / d.blades)};
      void main() {
        float m = length(vAt);
        float r = m / ${f(d.radius)};
        if (r > 1.0 || m < ${f(d.root)}) discard;
        // Where this point is behind the nearest blade, along the way the
        // smear trails it.
        float a = atan(vAt.y, vAt.x);
        float behind = mod(${f(d.trail)} * (a - ${f(d.first)}), GAP);
        float chord = ${f(d.chord)} * (1.0 - ${f(d.taper)} * smoothstep(${f(d.tipFrom)}, 1.0, r));
        float hw = 0.5 * chord / m;
        // A blade narrower than a pixel is drawn a pixel wide and as much
        // fainter, so a far rotor neither shimmers nor vanishes.
        float pixel = length(fwidth(vAt));
        float drawn = max(hw, 0.7 * pixel / m);
        float smear = max(uSmear, 1e-4);
        // Each blade's width swept over [0, smear] behind it: the share of
        // the picture this point is under a blade — the blade's own, and
        // the trails of the blades ahead where the smear reaches them.
        float cover = 0.0;
        for (int k = -1; k <= 2; k++) {
          float b = behind + float(k) * GAP;
          cover += max(min(b + drawn, smear) - max(b - drawn, 0.0), 0.0);
        }
        cover *= hw / (drawn * smear);
        cover = mix(2.0 * hw / GAP, cover, uContrast);
        float rim = 1.0 - smoothstep(1.0 - pixel / ${f(d.radius)}, 1.0, r);
        // Read stronger than the ink alone, as a disc reads against the
        // snow: a blade's share of a picture lifted and eased, so the haze
        // at speed is a grey sheet and its ghost wedges still show.
        float alpha = ${f(d.strength ?? 1)} * uOpacity * rim * pow(clamp(2.5 * cover, 0.0, 1.0), 0.6);
        // Through a body, the blades come out of it red (heli-grip.ts).
        vec3 ink = mix(r > ${f(d.band)} ? uTip : uBlade, vec3(0.32, 0.015, 0.02), uBlood);
        gl_FragColor = vec4(ink * uShade, alpha + 0.25 * uBlood * alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(d.radius, 96), material);
  disc.renderOrder = 5;
  disc.visible = false;
  return disc;
}

/** Sets a disc to this frame's look — `blood` the share its blades are red
 * with a body they went through. */
export function lookDisc(disc: THREE.Mesh, look: RotorLook, on: boolean, blood = 0): void {
  const u = (disc.material as THREE.ShaderMaterial).uniforms;
  u.uBlood.value = blood;
  u.uOpacity.value = look.disc;
  u.uSmear.value = Math.min(look.smear, 9);
  u.uContrast.value = look.contrast;
  disc.visible = on && look.disc > 0.01;
}

/** How lit the disc's ink is, 0..1 (1 by day). */
export function shadeDisc(disc: THREE.Mesh, light: number): void {
  (disc.material as THREE.ShaderMaterial).uniforms.uShade.value = light;
}

/** The model's blades drawn as solid as `look.blades` says. Their materials
 * are transparent for good (`bladesOf`): toggled as the rotor spooled up,
 * each was a program of its own linked the moment he sat on the skid. */
export function fadeBlades(meshes: THREE.Mesh[], look: RotorLook): void {
  const o = look.blades;
  for (const mesh of meshes) {
    const m = mesh.material as THREE.MeshStandardMaterial;
    m.opacity = o;
    mesh.visible = o > 0.01;
    mesh.castShadow = o > 0.5;
  }
}
