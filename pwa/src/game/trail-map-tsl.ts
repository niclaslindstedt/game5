// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRAIL MAP'S PASSES ON THE NODE RENDERER (`docs/webgpu.md`, part 5):
// the node twins of `trail-map.ts`'s four passes — the stamp (every capsule
// MAX-blended into both maps, `furrowProfile` in TSL), the swath (written
// whole), the copy that moves the fine window and the fill new snow takes
// off — and of `deform-shade.ts`'s march a cell at a time. Each is made
// once a material, over that material's OWN uniforms read by reference, and
// takes its pipeline state (the blending above all) off the ShaderMaterial,
// so `trail-map.ts` drives both back ends.
//
// THE LAYOUT IS WEBGL'S. On the node renderer a fragment's place in a target
// (`screenCoordinate`, row 0 at the top on both of its back ends) is the
// texel a read at uv (x, y) finds at (x, y) — row 0 at v ≈ 0 — where WebGL's
// row 0 is at clip y −1. So the stamp's quad is placed with its clip y
// negated, and the copy's uv runs down the target: a world point's texel is
// at the uv the ground reads it at, `(p − origin) / span`, as on WebGL.

import * as THREE from "three";
import * as TSL from "three/tsl";
import { NodeMaterial } from "three/webgpu";

import { slot, tap, texSlot, texel, type N } from "./haze-tsl.ts";
import { TRAIL } from "./trail-stamp.ts";
import { trailSlots } from "./trail-tsl.ts";

const {
  Discard,
  Fn,
  If,
  abs,
  all,
  atan,
  attribute,
  clamp,
  dot,
  float,
  greaterThanEqual,
  ivec2,
  length,
  lessThanEqual,
  max,
  mix,
  mod,
  pow,
  positionGeometry,
  screenCoordinate,
  select,
  sign,
  sin,
  sqrt,
  texture,
  varying,
  vec2,
  vec4,
} = TSL as N;

type U = Record<string, THREE.IUniform>;

/** The GLSL's constants as it prints them (`toFixed`), so both back ends
 * cut the same profile. */
const fixed = (n: number, d: number): number => Number(n.toFixed(d));
const BERM_REACH = fixed(TRAIL.bermReach, 2);
const WALL_SOFT = fixed(TRAIL.wallSoft, 1);
const WALL_SPAN = fixed(TRAIL.wallHard - TRAIL.wallSoft, 1);
const SLOUGH_DEEP = fixed(TRAIL.sloughDeep, 2);

/** A pass's twin: no depth, no fog, no lights, the ShaderMaterial's
 * blending, its quad placed by `vertex` and its colour `fragment`. */
function passMaterial(name: string, from: THREE.Material, vertex: N, fragment: N): NodeMaterial {
  const m = new NodeMaterial();
  m.name = name;
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  m.lights = false;
  m.toneMapped = false;
  m.blending = from.blending;
  m.blendEquation = from.blendEquation;
  m.blendEquationAlpha = from.blendEquationAlpha;
  m.blendSrc = from.blendSrc;
  m.blendDst = from.blendDst;
  m.blendSrcAlpha = from.blendSrcAlpha;
  m.blendDstAlpha = from.blendDstAlpha;
  m.vertexNode = vertex;
  m.fragmentNode = fragment;
  // A node on the material drawn, so the renderer refreshes the pass's
  // bindings every draw: it otherwise watches the material's own fields,
  // which never move, and would sample the map a swap has made the target.
  (from as unknown as { passNode: N }).passNode = fragment;
  return m;
}

/** The stamp's quad (`STAMP_VERTEX`): the capsule's segment and shape off
 * its instance, widened to the texel floor, and what its fragment reads. */
function stampQuad(u: U) {
  const origin = slot(u.uOrigin, "vec2");
  const span = slot(u.uSpan, "float");
  const minHalf = slot(u.uMinHalf, "float");
  const seg = attribute("iSeg", "vec4");
  const shape = attribute("iShape", "vec4");
  const extra = attribute("iExtra", "vec3");
  const hw = max(shape.x, minHalf);
  const thin = sqrt(shape.x.div(hw));
  const sw = max(extra.x, hw);
  const reach = sw.mul(1 + BERM_REACH).add(minHalf);
  const a = seg.xy;
  const b = seg.zw;
  const d = b.sub(a);
  const len = length(d);
  const t = select(len.greaterThan(1e-4), d.div(len), vec2(1, 0));
  const n = vec2(t.y.negate(), t.x);
  const along = mix(a.sub(t.mul(reach)), b.add(t.mul(reach)), positionGeometry.x.mul(0.5).add(0.5));
  const p = along.add(n.mul(positionGeometry.y).mul(reach));
  const ndc = p.sub(origin).div(span).mul(2).sub(1);
  return {
    vertex: vec4(ndc.x, ndc.y.negate(), 0, 1),
    minHalf,
    vP: varying(p, "vTrailP"),
    vSeg: varying(seg, "vTrailSeg"),
    vShape: varying(vec4(hw, shape.y.mul(thin), shape.z.mul(thin), shape.w), "vTrailShape"),
    vSlough: varying(sw, "vTrailSlough"),
    vEdge: varying(vec2(extra.y, extra.z.mul(thin)), "vTrailEdge"),
  };
}

/** THE STAMP (`STAMP_FRAGMENT`): the cut or the trench round it, the berm
 * beside it, and a belt's packed floor and axis. */
export function stampTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const q = stampQuad(m.uniforms);
  const frag = Fn(() => {
    const { vP, vSeg, vShape, vSlough, vEdge, minHalf } = q;
    const a = vSeg.xy;
    const ab = vSeg.zw.sub(a).toVar();
    const l2 = dot(ab, ab).toVar();
    const h = clamp(dot(vP.sub(a), ab).div(max(l2, 1e-8)), 0, 1);
    const rel = vP.sub(a).sub(ab.mul(h)).toVar();
    const d = length(rel).toVar();
    const sd = select(
      l2.greaterThan(1e-8),
      dot(rel, vec2(ab.y, ab.x.negate())).div(sqrt(max(l2, 1e-8))),
      d,
    ).toVar();
    const u = d.div(vShape.x).toVar();
    const k = clamp(vShape.w, 0, 1).mul(WALL_SPAN).add(WALL_SOFT);
    const outer = max(vShape.x, vSlough).toVar();
    const w = d.div(outer).toVar();
    const tilt = vEdge.x;
    const lean = clamp(sd.div(vShape.x), -1, 1);
    const wedge = float(1).sub(
      abs(tilt)
        .mul(0.5)
        .mul(float(1).sub(sign(tilt).mul(lean))),
    );
    const cut = select(
      u.lessThan(1),
      // `u` held under 1 for the power: past it the select takes nought.
      float(1)
        .sub(pow(clamp(u, 0, 1), k))
        .mul(wedge),
      float(0),
    );
    const bowl = select(
      outer.greaterThan(vShape.x).and(w.lessThan(1)),
      float(1).sub(w.mul(w).mul(w)).mul(SLOUGH_DEEP),
      float(0),
    );
    const press = max(cut, bowl);
    const v = w.sub(0.8).div(BERM_REACH).toVar();
    const heap = max(0, float(1).sub(tilt.mul(0.8).mul(sign(sd))));
    const berm = select(
      v.greaterThan(0).and(v.lessThan(1)),
      sin(v.mul(3.14159265)).mul(heap),
      float(0),
    );
    const pack = float(0).toVar();
    const axis = float(0).toVar();
    If(vEdge.y.greaterThan(0), () => {
      pack.assign(select(d.lessThan(vShape.x), vEdge.y, float(0)));
      const th = atan(ab.x, ab.y).toVar();
      If(th.lessThan(0), () => {
        th.addAssign(3.14159265);
      });
      axis.assign(
        select(
          d.lessThan(vShape.x.add(minHalf.mul(2))),
          clamp(th.div(3.14159265), 0, 1).mul(0.5).add(0.5),
          float(0),
        ),
      );
    });
    return vec4(press.mul(vShape.y), berm.mul(vShape.z), pack, axis);
  });
  return passMaterial("trail-stamp", m, q.vertex, frag());
}

/** THE SWATH (`GROOM_FRAGMENT`): the capsule's inside written whole. */
export function groomTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const q = stampQuad(m.uniforms);
  const frag = Fn(() => {
    const { vP, vSeg, vShape } = q;
    const a = vSeg.xy;
    const ab = vSeg.zw.sub(a).toVar();
    const h = clamp(dot(vP.sub(a), ab).div(max(dot(ab, ab), 1e-8)), 0, 1);
    If(length(vP.sub(a).sub(ab.mul(h))).greaterThan(vShape.x), () => {
      Discard();
    });
    const axis = atan(ab.x, ab.y).toVar();
    If(axis.lessThan(0), () => {
      axis.addAssign(3.14159265);
    });
    return vec4(0, 0, 1, clamp(axis.div(3.14159265), 0, 0.999).mul(0.5));
  });
  return passMaterial("trail-groom", m, q.vertex, frag());
}

/** A full-target quad, and its uv running down the target (see the header). */
function fullQuad() {
  const uv = varying(
    vec2(positionGeometry.x.mul(0.5).add(0.5), float(0.5).sub(positionGeometry.y.mul(0.5))),
    "vTrailUv",
  );
  return { vertex: vec4(positionGeometry.xy, 0, 1), uv };
}

/** THE COPY (`COPY_FRAGMENT`): the old window onto the new, the newly
 * exposed edge from the coarse map. */
export function copyTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const u = m.uniforms;
  const q = fullQuad();
  const old = texSlot(u.uOld as { value: THREE.Texture }, u.uOld.value as THREE.Texture);
  const coarse = texSlot(u.uCoarse as { value: THREE.Texture }, u.uCoarse.value as THREE.Texture);
  const oldOrigin = slot(u.uOldOrigin, "vec2");
  const newOrigin = slot(u.uNewOrigin, "vec2");
  const span = slot(u.uSpan, "float");
  const mapSize = slot(u.uMapSize, "float");
  const frag = Fn(() => {
    const p = newOrigin.add(q.uv.mul(span)).toVar();
    const o = p.sub(oldOrigin).div(span).toVar();
    const inside = all(greaterThanEqual(o, vec2(0))).and(all(lessThanEqual(o, vec2(1))));
    const was = tap(old.tex, o).level(0);
    const far = tap(coarse.tex, p.div(mapSize)).level(0);
    return select(inside, was, far).add(old.keep).add(coarse.keep);
  });
  return passMaterial("trail-copy", m, q.vertex, frag());
}

/** THE FILL: a flat step, taken off the target by the blending. */
export function fillTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const step = slot(m.uniforms.uStep, "vec3");
  return passMaterial("trail-fill", m, fullQuad().vertex, vec4(step, 0));
}

/** THE DEFORMABLE SNOW'S SHADE (`deform-shade.ts`'s `FRAGMENT`): the field
 * as uploaded, its alpha the march toward the sun from the cell's centre. */
export function deformShadeTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const u = m.uniforms;
  const t = trailSlots(u);
  const ground: N = texture(u.uGround.value as THREE.Texture).setUpdateMatrix(false);
  const origin = slot(u.uHeightOrigin, "vec2");
  const count = slot(u.uHeightCount, "vec2");
  const cell = slot(u.uCell, "float");
  const sun = slot(u.uSunDir, "vec3");
  const frag = Fn(() => {
    const ij = ivec2(screenCoordinate.xy).toVar();
    const f = texel(t.deform.tex, ij).toVar();
    const span = t.deformSpan;
    const c = t.deformBox.xy;
    const p = c
      .add(mod(vec2(ij).mul(t.deformBox.w).sub(c).add(span.mul(0.5)), span))
      .sub(span.mul(0.5))
      .toVar();
    const guv = p.sub(origin).add(cell.mul(0.5)).div(count.mul(cell));
    const lit = t.deformMarch(p, sun, tap(ground, guv).level(0).rg);
    return vec4(f.rgb, lit.add(t.keep()));
  });
  return passMaterial("deform-shade", m, fullQuad().vertex, frag());
}
