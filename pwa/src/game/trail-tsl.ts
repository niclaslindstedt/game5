// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRAIL MAP READ ON THE NODE RENDERER (`docs/webgpu.md`, part 5):
// `trail-map.ts`'s `TRAIL_GLSL` — the furrows, the berms, the swaths and the
// belts every skier and machine has stamped, and the deformable snow round
// the player — restated in TSL for the ground's node twin
// (`terrain-tsl.ts`) and the deformable snow's shade pass
// (`trail-map-tsl.ts`), with `deform-glsl.ts`'s march and its read and
// `tree-wells.ts`'s well map beside them. The GLSL is the authority, term
// for term; every uniform is read by reference off the object `trail-map.ts`
// made, so its writers drive both back ends.
//
// Each read is a real function of the generated shader (a layout): the
// ground's vertex reads the relief nine times and its fragment a dozen, and
// inlined each would be that many copies. Every map is read at its first
// level, as the GLSL's `textureLod(…, 0.0)` reads it: a derivative's
// footprint taken in a branch is undefined.

import * as THREE from "three";
import * as TSL from "three/tsl";

import { slot, tap, texSlot, type N } from "./haze-tsl.ts";

const {
  Break,
  Fn,
  If,
  Loop,
  abs,
  clamp,
  dot,
  float,
  length,
  max,
  min,
  mix,
  select,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
} = TSL as N;

type U = Record<string, THREE.IUniform>;

const v2 = (name: string) => ({ name, type: "vec2" });
const v3 = (name: string) => ({ name, type: "vec3" });
const f1 = (name: string) => ({ name, type: "float" });

/** A map read straight at its first level. */
const lod0 = (t: N, uv: N): N => tap(t, uv).level(0);

function makeTrail(t: U, tag: string) {
  // The maps are re-pointed as the window moves (the fine and the spare
  // swap) and as the deformable snow's field is bound; each texture node
  // follows its slot every render (`texSlot`), `keep` in the graph.
  const fine = texSlot(t.uTrailFine as { value: THREE.Texture }, t.uTrailFine.value);
  const coarse = texSlot(t.uTrailCoarse as { value: THREE.Texture }, t.uTrailCoarse.value);
  const deform = texSlot(t.uDeform as { value: THREE.Texture }, t.uDeform.value);
  const fineOrigin = slot(t.uFineOrigin, "vec2");
  const fineSpan = slot(t.uFineSpan, "float");
  const mapSize = slot(t.uMapSize, "float");
  const scale = slot(t.uTrailScale, "vec2");
  const furrowed = slot(t.uFurrowed, "float");
  const deformBox = slot(t.uDeformBox, "vec4");
  const deformSpan = slot(t.uDeformSpan, "float");
  const deformOn = slot(t.uDeformOn, "float");
  const march = slot(t.uDeformMarch, "vec2");

  /** `deformWeight`: how much of the field stands for the map at `p`. */
  const deformWeight: N = Fn(([p]: N[]) => {
    const d = abs(p.sub(deformBox.xy));
    const m = max(d.x, d.y);
    const w = float(1).sub(smoothstep(deformBox.z.mul(0.82), deformBox.z.sub(deformBox.w), m));
    return select(deformOn.lessThan(0.5), float(0), w);
  }).setLayout({ name: `deformWeight${tag}`, type: "float", inputs: [v2("p")] });

  /** `deformAt`: the field's height (x), touched (y), firmness (z). */
  const deformAt: N = Fn(([p]: N[]) => {
    const uv = p.div(deformSpan).add(deformBox.w.mul(0.5).div(deformSpan));
    return lod0(deform.tex, uv).rgb;
  }).setLayout({ name: `deformAt${tag}`, type: "vec3", inputs: [v2("p")] });

  /** `trailFineWeight`: inside the fine window, faded over its rim. */
  const fineWeight: N = Fn(([p]: N[]) => {
    const u = p.sub(fineOrigin).div(fineSpan).toVar();
    const edge = min(u, float(1).sub(u));
    return smoothstep(0, 0.06, min(edge.x, edge.y));
  }).setLayout({ name: `trailFineWeight${tag}`, type: "float", inputs: [v2("p")] });

  /** `trailAt`: the depth (x) and berm (y) at `p`, m. */
  const trailAt: N = Fn(([p]: N[]) => {
    const w = fineWeight(p).toVar();
    const v = vec2(0).toVar();
    If(furrowed.greaterThanEqual(0.5), () => {
      const uvF = p.sub(fineOrigin).div(fineSpan).toVar();
      If(w.greaterThanEqual(1), () => {
        v.assign(lod0(fine.tex, uvF).rg);
      }).Else(() => {
        v.assign(lod0(coarse.tex, p.div(mapSize)).rg);
        If(w.greaterThan(0), () => {
          v.assign(mix(v, lod0(fine.tex, uvF).rg, w));
        });
      });
    });
    v.mulAssign(scale);
    const dw = deformWeight(p).toVar();
    If(dw.greaterThan(0), () => {
      const f = deformAt(p).toVar();
      v.assign(mix(v, vec2(max(f.x.negate(), 0), max(f.x, 0)), dw.mul(clamp(f.y, 0, 1))));
    });
    return v;
  }).setLayout({ name: `trailAt${tag}`, type: "vec2", inputs: [v2("p")] });

  /** `trailPackAt`: a swath's share (x), a belt's (y), the axis (z, over π). */
  const packAt: N = Fn(([p]: N[]) => {
    const w = fineWeight(p).toVar();
    const uvF = p.sub(fineOrigin).div(fineSpan).toVar();
    const g = lod0(coarse.tex, p.div(mapSize)).ba.toVar();
    If(w.greaterThanEqual(1), () => {
      g.assign(lod0(fine.tex, uvF).ba);
    }).ElseIf(w.greaterThan(0), () => {
      g.assign(mix(g, lod0(fine.tex, uvF).ba, w));
    });
    const belt = step(0.5, g.y).toVar();
    const axis = select(belt.greaterThan(0.5), g.y.sub(0.5).mul(2), g.y.mul(2));
    return vec3(g.x.mul(float(1).sub(belt)), g.x.mul(belt), axis);
  }).setLayout({ name: `trailPackAt${tag}`, type: "vec3", inputs: [v2("p")] });

  /** `trailRelief`: how far the snow at `p` stands off its untouched
   * surface, m — down by the furrow, up by a berm no furrow has cut. */
  const relief: N = Fn(([p]: N[]) => {
    const tr = trailAt(p).toVar();
    const r = tr.y
      .mul(float(1).sub(clamp(tr.x.div(0.03), 0, 1)))
      .sub(tr.x)
      .toVar();
    const dw = deformWeight(p).toVar();
    If(dw.greaterThan(0), () => {
      const f = deformAt(p).toVar();
      r.assign(mix(r, f.x, dw.mul(clamp(f.y, 0, 1))));
    });
    return r;
  }).setLayout({ name: `trailRelief${tag}`, type: "float", inputs: [v2("p")] });

  /** `deformSelf`: the sun let through by the field's own relief, read
   * off the shade pass's alpha (`DEFORM_SHADE_GLSL`). */
  const deformSelf: N = Fn(([p, sun, dist]: N[]) => {
    const w = deformWeight(p).toVar();
    const lit = float(1).toVar();
    If(w.greaterThan(0).and(sun.y.greaterThan(0)).and(dist.lessThan(60)), () => {
      const uv = p.div(deformSpan).add(deformBox.w.mul(0.5).div(deformSpan));
      const a = lod0(deform.tex, uv).a;
      lit.assign(mix(1, a, w.mul(float(1).sub(smoothstep(35, 60, dist)))));
    });
    return lit;
  }).setLayout({
    name: `deformSelf${tag}`,
    type: "float",
    inputs: [v2("p"), v3("sun"), f1("dist")],
  });

  /** `deformMarch`: the key marched toward the sun over the field from
   * `p` on ground of slope `slope` — 1 lit, 0 in its own shade. */
  const deformMarch: N = Fn(([p, sun, slope]: N[]) => {
    const lit = float(1).toVar();
    const slh = length(sun.xz).toVar();
    If(sun.y.greaterThan(0).and(slh.greaterThanEqual(1e-3)), () => {
      const sl = sun.xz.div(slh).toVar();
      const rise = sun.y.div(slh).sub(dot(slope, sl)).toVar();
      const h0 = relief(p).toVar();
      const st = deformBox.w.mul(0.75).toVar();
      Loop({ start: 0, end: 14, type: "int", name: "dm" }, ({ dm }: N) => {
        If(float(dm).greaterThanEqual(march.x), () => {
          Break();
        });
        const clear = h0.add(rise.mul(st)).sub(relief(p.add(sl.mul(st))));
        const pen = st.mul(0.04).add(0.003).toVar();
        lit.assign(min(lit, smoothstep(pen.negate(), pen, clear)));
        st.mulAssign(march.y);
      });
    });
    return lit;
  }).setLayout({
    name: `deformMarch${tag}`,
    type: "float",
    inputs: [v2("p"), v3("sun"), v2("slope")],
  });

  return {
    fine,
    coarse,
    deform,
    fineOrigin,
    fineSpan,
    mapSize,
    scale,
    furrowed,
    deformBox,
    deformSpan,
    deformOn,
    worked: slot(t.uWorked, "float"),
    belted: slot(t.uBelted, "float"),
    fineTexel: slot(t.uFineTexel, "float"),
    coarseTexel: slot(t.uCoarseTexel, "float"),
    /** Every re-pointed map's keep, to stand in the graph (reads 0). */
    keep: (): N => fine.keep.add(coarse.keep).add(deform.keep),
    deformWeight,
    deformAt,
    fineWeight,
    trailAt,
    packAt,
    relief,
    deformSelf,
    deformMarch,
  };
}

/** The trail map's reads over uniforms `t` (`TrailUniforms`, or a pass's
 * own record of them), made once a record and stage and shared by every
 * node built over it — or, with `own`, a set for one material alone. The
 * VERTEX's are a set of their own (`vertex`), with their own names: a
 * function is generated once a material, and the texture it reads is named
 * by the stage that built it first — read from the other stage it names a
 * binding that stage does not have.
 *
 * THREE KEEPS A FUNCTION'S CODE ONCE A RENDERER (`buildFunctionNode`), with
 * the names of the uniforms and the textures it reads as the first program
 * to build it numbered them, and it declares those in that program alone.
 * A second program built over the same set (the ground's cut and plain
 * levels, a summer's) reads members its own struct does not have, and the
 * device refuses it. So every ground material makes its own (`own`): the
 * levels that share one program still build it once. */
export type TrailSlots = ReturnType<typeof makeTrail>;
const trailsOf = [new WeakMap<U, TrailSlots>(), new WeakMap<U, TrailSlots>()];
export function trailSlots(t: U, vertex = false, own = false): TrailSlots {
  if (own) return makeTrail(t, vertex ? "V" : "");
  const of = trailsOf[vertex ? 1 : 0];
  let s = of.get(t);
  if (!s) of.set(t, (s = makeTrail(t, vertex ? "V" : "")));
  return s;
}

/** `WELL_GLSL`'s `wellDepth`: how deep a tree well lowers the snow at `p`,
 * m, off the well map (`tree-wells.ts`) in `u` (`uWell`, `uWellFrame`) —
 * made once a map and stage (`trailSlots` says why). */
const wellsOf = [new WeakMap<THREE.IUniform, N>(), new WeakMap<THREE.IUniform, N>()];
export function wellReader(u: U, vertex = false, own = false): N {
  if (own) return makeWell(u, vertex ? "V" : "");
  const of = wellsOf[vertex ? 1 : 0];
  let read = of.get(u.uWell);
  if (!read) of.set(u.uWell, (read = makeWell(u, vertex ? "V" : "")));
  return read;
}
function makeWell(u: U, tag: string): N {
  const map: N = texture(u.uWell.value as THREE.Texture).setUpdateMatrix(false);
  const frame = slot(u.uWellFrame, "vec4");
  return Fn(([p]: N[]) => {
    const d = float(0).toVar();
    If(frame.w.greaterThan(0), () => {
      const uv = p.sub(frame.xy).div(frame.z).toVar();
      const e = min(uv, float(1).sub(uv));
      const edge = min(e.x, e.y).toVar();
      If(edge.greaterThan(0), () => {
        d.assign(lod0(map, uv).r.mul(smoothstep(0, 0.125, edge)));
      });
    });
    return d;
  }).setLayout({ name: `wellDepth${tag}`, type: "float", inputs: [v2("p")] });
}
