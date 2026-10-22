// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INSTRUMENTS' TWINS ON THE NODE RENDERER (`docs/webgpu.md`, part 14):
// the two passes a developer's or a lab's instrument draws, restated for
// the node renderer over each ShaderMaterial's own uniforms.
//
//   trail-overlay  DEVELOPER ▸ TRAIL MAP's corner (`trail-overlay.ts`): a
//                  map's depth and berm, the most of the texels under each
//                  pixel, in warm white and blue over near-black. Drawn
//                  straight onto the canvas in display space, so its sRGB
//                  curve is done here (`overlay.draw` takes the output
//                  transform off for the draw)
//   under-copy     the snow lab's probe (`snow-under.ts`): the ground's
//                  depth, texel for texel, into a float target the probe
//                  reads back

import type * as THREE from "three";
import * as TSL from "three/tsl";
import { NodeMaterial } from "three/webgpu";

import { standIn, tap, texSlot, texel, type N } from "./haze-tsl.ts";

const {
  clamp,
  float,
  fwidth,
  ivec2,
  max,
  mix,
  positionGeometry,
  pow,
  screenCoordinate,
  step,
  uv,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const NONE = standIn();

/** A quad drawn straight in clip space, its state off the ShaderMaterial. */
function quadMaterial(name: string, from: THREE.Material, fragment: N): NodeMaterial {
  const m = new NodeMaterial();
  m.name = name;
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  m.lights = false;
  m.toneMapped = false;
  m.transparent = from.transparent;
  m.vertexNode = vec4(positionGeometry.xy, 0, 1);
  m.fragmentNode = fragment;
  // A node on the material drawn, so a swapped map is bound each draw.
  (from as unknown as { passNode: N }).passNode = fragment;
  return m;
}

/** Linear light to the sRGB curve, as `colorspace_fragment` writes it. */
function toSrgb(c: N): N {
  const lo = c.mul(12.92);
  const hi = pow(max(c, vec3(0)), vec3(1 / 2.4))
    .mul(1.055)
    .sub(0.055);
  return mix(hi, lo, step(c, vec3(0.0031308)));
}

/** THE TRAIL CORNER: sixteen taps across the pixel's footprint, the most. */
export function overlayTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const map = texSlot(m.uniforms.uMap as { value: THREE.Texture | null }, NONE);
  const at = uv().toVar();
  const foot = fwidth(at).toVar();
  let t: N = vec2(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const off = vec2(i / 3 - 0.5, j / 3 - 0.5).mul(foot);
      t = max(t, tap(map.tex, at.add(off)).rg);
    }
  }
  const rg = t.toVar();
  let c: N = vec3(0.03, 0.05, 0.08);
  c = mix(c, vec3(0.25, 0.55, 1.0), clamp(rg.y.mul(6), 0, 1));
  c = mix(c, vec3(1.0, 0.92, 0.8), clamp(rg.x.mul(8), 0, 1));
  return quadMaterial("trail-overlay", m, vec4(toSrgb(c), float(0.92).add(map.keep)));
}

/** THE PROBE'S COPY: the depth at this texel, as red. */
export function underCopyTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const depth = texSlot(m.uniforms.uDepth as { value: THREE.Texture | null }, NONE);
  const d = texel(depth.tex, ivec2(screenCoordinate.xy)).r;
  return quadMaterial("under-copy", m, vec4(d.add(depth.keep), 0, 0, 1));
}

/** The instruments' twin of kind `kind`, or null for another kind. */
export function instrumentTwin(m: THREE.Material, kind: string): NodeMaterial | null {
  if (kind === "trail-overlay") return overlayTwin(m as THREE.ShaderMaterial);
  if (kind === "under-copy") return underCopyTwin(m as THREE.ShaderMaterial);
  return null;
}
