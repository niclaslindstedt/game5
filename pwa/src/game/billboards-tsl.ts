// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BILLBOARDS ON THE NODE RENDERER (`docs/webgpu.md`, part 9): the node
// twin of `billboards.ts`'s batch — the crash's fire and smoke, the halos,
// a gun's beads and its smoke, the balloon's flame — over each batch's own
// uniforms by reference, term for term with the GLSL: the quad turned in
// the screen, and its texture's cell (mode 0), the procedural FIRE flowing
// up through it (mode 1) or the SMOKE billowing (mode 2).
//
// Every batch is its own ShaderMaterial with the same code, so each is
// flagged with a key of its own (`nodeTwin`'s `own`): the node renderer
// keys a program by the material's fields, and two batches sharing one
// would draw the second with the first one's texture and cells.
//
// The cell is read before the modes branch: a texture read takes its
// footprint off its neighbours, which WebGPU allows only in uniform flow.

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { particleMaterial } from "./air-tsl.ts";
import { slot, tap, type N } from "./haze-tsl.ts";

const {
  Discard,
  Fn,
  If,
  attribute,
  cameraProjectionMatrix,
  cos,
  dot,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  modelViewMatrix,
  positionGeometry,
  sin,
  smoothstep,
  texture,
  uv,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** The GLSL's numbers as it prints them (`billboards.ts`). */
const FIRE_FLOW = 1.2;
const FIRE_CHURN = 0.2;
const fixed3 = (n: number): number => Number(n.toFixed(3));

/** `hash3`. */
const hash3: N = Fn(([p0]: N[]) => {
  const p = fract(p0.mul(0.3183099).add(0.1)).mul(17).toVar();
  return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
}).setLayout({ name: "boardHash3", type: "float", inputs: [{ name: "p", type: "vec3" }] });

/** `noise3`: trilinear value noise. */
const noise3: N = Fn(([x]: N[]) => {
  const i = floor(x).toVar();
  const f0 = fract(x);
  const f = f0
    .mul(f0)
    .mul(float(3).sub(f0.mul(2)))
    .toVar();
  const h = (dx: number, dy: number, dz: number): N => hash3(i.add(vec3(dx, dy, dz)));
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y),
    mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y),
    f.z,
  );
}).setLayout({ name: "boardNoise3", type: "float", inputs: [{ name: "x", type: "vec3" }] });

/** `fbm`: four octaves. */
const fbm: N = Fn(([p0]: N[]) => {
  const p = p0.toVar();
  const sum = float(0).toVar();
  let a = 0.5;
  for (let i = 0; i < 4; i++) {
    sum.addAssign(noise3(p).mul(a));
    p.assign(p.mul(2.07).add(vec3(1.7, 9.2, 3.1)));
    a *= 0.5;
  }
  return sum.div(0.9375);
}).setLayout({ name: "boardFbm", type: "float", inputs: [{ name: "p", type: "vec3" }] });

/** `flow`: the fire's noise carried along rather than boiling. */
const flow: N = Fn(([p0, t0]: N[]) => {
  const p = p0.toVar();
  const t = t0.toVar();
  const sum = float(0).toVar();
  let a = 0.5;
  for (let i = 0; i < 4; i++) {
    sum.addAssign(noise3(vec3(p, t)).mul(a));
    p.assign(p.mul(2.07).add(vec2(1.7, 9.2)));
    t.assign(t.mul(1.3).add(3.1));
    a *= 0.5;
  }
  return sum.div(0.9375);
}).setLayout({
  name: "boardFlow",
  type: "float",
  inputs: [
    { name: "p", type: "vec2" },
    { name: "t", type: "float" },
  ],
});

/** `heatColour`: glowing soot by its temperature. */
function heatColour(t: N): N {
  let c = mix(vec3(0), vec3(0.55, 0.06, 0.01), smoothstep(0, 0.22, t));
  c = mix(c, vec3(2.2, 0.55, 0.07), smoothstep(0.18, 0.48, t));
  c = mix(c, vec3(4.2, 2.0, 0.42), smoothstep(0.45, 0.75, t));
  return mix(c, vec3(6.5, 5.2, 2.9), smoothstep(0.75, 1, t));
}

/** A batch's twin over its ShaderMaterial `m` (`createBillboards`). */
export function billboardTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const U = m.uniforms;
  const cells = slot(U.cells, "float");
  const time = slot(U.uTime, "float");
  const map = texture(U.map.value as THREE.Texture);
  const vUv = varyingProperty("vec2", "vBoardUv");
  const vLocal = varyingProperty("vec2", "vBoardLocal");
  const vUp = varyingProperty("vec2", "vBoardUp");
  const vCol = varyingProperty("vec4", "vBoardCol");
  const vFx = varyingProperty("vec4", "vBoardFx");

  const vertex = Fn(() => {
    const iPos = attribute("iPos", "vec3");
    const iSize = attribute("iSize", "vec3");
    // The turn and the cell packed as cell · 16 + turn.
    const cell = floor(iSize.z.div(16)).toVar();
    const turn = iSize.z.sub(cell.mul(16)).toVar();
    const at = uv();
    vUv.assign(vec2(at.x.add(cell).div(cells), at.y));
    vLocal.assign(positionGeometry.xy.mul(2));
    vCol.assign(attribute("iCol", "vec4"));
    vFx.assign(attribute("iFx", "vec4"));
    const mv = modelViewMatrix.mul(vec4(iPos, 1)).toVar();
    const c = cos(turn).toVar();
    const s = sin(turn).toVar();
    vUp.assign(vec2(s, c));
    const p = positionGeometry.xy.mul(iSize.xy).toVar();
    const off = vec2(c.mul(p.x).sub(s.mul(p.y)), s.mul(p.x).add(c.mul(p.y)));
    return cameraProjectionMatrix.mul(vec4(mv.xy.add(off), mv.z, mv.w));
  })();

  const fragment = Fn(() => {
    const mode = vFx.x.toVar();
    const t = tap(map, vUv).toVar();
    const o = vec4(t.rgb.mul(vCol.rgb), t.a.mul(vCol.a)).toVar();
    If(mode.greaterThanEqual(0.5), () => {
      const p = vLocal.toVar();
      const r = length(p).toVar();
      If(r.greaterThan(1), () => {
        Discard();
      });
      const seed = vFx.z.toVar();
      const up = dot(p, vUp).toVar();
      If(mode.lessThan(1.5), () => {
        // FIRE: the noise flowing up through it, warped by itself.
        const q = p
          .mul(1.5)
          .add(vec2(seed.mul(3.1), seed.mul(1.7)))
          .toVar();
        const tq = time.mul(fixed3(FIRE_CHURN)).add(seed).toVar();
        const w = flow(q.sub(vUp.mul(time).mul(fixed3(FIRE_FLOW * 0.6))), tq);
        const n = flow(
          q
            .mul(1.9)
            .add(vec2(w.mul(1.6)))
            .sub(vUp.mul(time).mul(fixed3(FIRE_FLOW))),
          tq.mul(1.4).add(5),
        ).toVar();
        const body = float(1).sub(r.mul(r).mul(1.1));
        const d = body.add(n.sub(0.5).mul(1.25)).toVar();
        const dens = smoothstep(0.02, 0.32, d)
          .mul(smoothstep(1, 0.7, r))
          .toVar();
        If(dens.lessThan(0.01), () => {
          Discard();
        });
        const heat = vFx.y;
        const temp = heat
          .mul(d.mul(1.05).add(0.35))
          .add(n.sub(0.5).mul(0.45).mul(heat))
          .clamp(0, 1)
          .toVar();
        // Cooling into soot at its rim: dark, and hiding what is behind.
        const soot = float(1).sub(smoothstep(0.12, 0.42, temp));
        const c = mix(heatColour(temp), vCol.rgb.mul(n.mul(0.8).add(0.6)), soot);
        o.assign(vec4(c, dens.mul(vCol.a)));
      }).Else(() => {
        // SMOKE: billows rolling slowly over each other.
        const q = vec3(p.mul(1.25), time.mul(0.12))
          .add(vec3(seed.mul(2.3), seed.mul(4.1), seed))
          .toVar();
        const w = fbm(q).toVar();
        const warp = q
          .mul(1.7)
          .add(vec3(w.mul(1.3), w.mul(1.3).sub(time.mul(0.05)), 0))
          .toVar();
        const n = fbm(warp).toVar();
        const body = float(1).sub(r.mul(r));
        const d = body.add(n.sub(0.5).mul(1.15));
        const dens = smoothstep(0.08, 0.5, d)
          .mul(smoothstep(1, 0.6, r))
          .toVar();
        If(dens.lessThan(0.01), () => {
          Discard();
        });
        // Lit from above, shaded under, the lumps standing out.
        const n2 = fbm(warp.add(vec3(vUp.mul(0.35), 0)));
        const lit = smoothstep(-0.9, 0.9, up).mul(0.55).add(0.5).add(n2.sub(n).mul(1.6));
        const c = vCol.rgb.mul(max(0.25, lit)).add(
          vec3(1.9, 0.55, 0.09)
            .mul(vFx.w)
            .mul(smoothstep(0.5, -0.9, up))
            .mul(n.mul(0.8).add(0.4)),
        );
        o.assign(vec4(c, dens.mul(vCol.a)));
      });
    });
    return o;
  })();

  return particleMaterial("billboards", m, vertex, fragment);
}
