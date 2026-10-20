// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE IN THE SNOW ON THE NODE RENDERER (`docs/webgpu.md`, part 5):
// `avalanche-glsl.ts` — the bed lowered behind the crown and between the
// flanks, the debris raised and broken into blocks — restated in TSL for the
// ground's node twin (`terrain-tsl.ts`). The GLSL is the authority, term for
// term; the uniforms are the haze object's slots (`avalanche-view.ts` writes
// them), read by reference, so one writer drives both back ends.
//
// The pixel's footprint (`foot`, `length(fwidth(p))`) is handed in, taken by
// the caller in uniform control flow, where the GLSL takes it in a branch.

import * as THREE from "three";
import * as TSL from "three/tsl";

import { SLIDE_LOOK } from "./avalanche-plan.ts";
import type { HazeUniforms } from "./haze.ts";
import { slot, tap, texSlot, type N } from "./haze-tsl.ts";
import { snowHash3, snowNoise, snowNoiseGrad } from "./snow-noise-tsl.ts";

const {
  Fn,
  If,
  abs,
  clamp,
  dot,
  float,
  length,
  max,
  min,
  mix,
  select,
  sin,
  smoothstep,
  sqrt,
  vec2,
  vec3,
} = TSL as N;

/** The GLSL's constants as it prints them (`toFixed(4)`). */
const f4 = (n: number): number => Number(n.toFixed(4));
const C = SLIDE_LOOK.crown;
const F = SLIDE_LOOK.flank;
const B = SLIDE_LOOK.bed;

const v2 = (name: string) => ({ name, type: "vec2" });

/** The debris map's stand-in while no slide has laid one: its own format. */
const NO_DEBRIS = (() => {
  const t = new THREE.DataTexture(new Uint16Array(1), 1, 1, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();

function makeSlide(u: HazeUniforms, tag: string) {
  const slab0 = slot(u.uSlab0, "vec4");
  const slab1 = slot(u.uSlab1, "vec4");
  const jog = slot(u.uSlabJog, "vec4");
  const box = slot(u.uSlideBox, "vec4");
  const on = slot(u.uSlideOn, "vec4");
  const crack = slot(u.uSlabCrack, "vec4");
  const map = texSlot(u.uSlide, NO_DEBRIS);
  map.tex.setUpdateMatrix(false);

  /** `slideFrame`: `p` in the slab's frame — across, down the fall line. */
  const frame = (p: N): N => {
    const d = p.sub(slab0.xy).toVar();
    return vec2(d.x.mul(slab0.w).sub(d.y.mul(slab0.z)), d.x.mul(slab0.z).add(d.y.mul(slab0.w)));
  };

  /** `slideBed`: how far below the old surface the bed lies, m. */
  const bed: N = Fn(([uv]: N[]) => {
    const u0 = uv.x;
    const v = uv.y;
    const out = float(0).toVar();
    const top = sin(u0.mul(f4(C.wave[0])).add(jog.x))
      .mul(f4(C.jog[0]))
      .add(sin(u0.mul(f4(C.wave[1])).add(jog.y)).mul(f4(C.jog[1])))
      .toVar();
    const left = slab1.x.add(sin(v.mul(f4(F.wave)).add(jog.z)).mul(f4(F.ragged))).toVar();
    const right = slab1.y.add(sin(v.mul(f4(F.wave * 1.3)).add(jog.w)).mul(f4(F.ragged))).toVar();
    If(
      v
        .greaterThanEqual(top)
        .and(v.lessThanEqual(slab1.z))
        .and(u0.lessThanEqual(left))
        .and(u0.greaterThanEqual(right.negate())),
      () => {
        const edge = min(left.sub(u0), u0.add(right));
        const t = clamp(v.sub(top).div(slab1.z), 0, 1);
        const gone = clamp(crack.w.sub(length(uv.sub(crack.xy)).div(crack.z)).div(0.1), 0, 1);
        out.assign(
          gone
            .mul(slab1.w)
            .mul(float(1).sub(t.mul(f4(B.thin))))
            .mul(
              smoothstep(0, f4(F.low), edge)
                .mul(f4(1 - F.lowShare))
                .add(f4(F.lowShare)),
            )
            .mul(float(1).sub(smoothstep(slab1.z.sub(f4(B.toe)), slab1.z, v))),
        );
      },
    );
    return out;
  }).setLayout({ name: `slideBed${tag}`, type: "float", inputs: [v2("uv")] });

  /** `slideDebris`: the debris lying at `uv`, m. */
  const debris: N = Fn(([uv]: N[]) => {
    const out = float(0).toVar();
    If(on.y.greaterThan(0), () => {
      const q = uv.sub(box.xy).div(box.zw).toVar();
      If(
        q.x.greaterThan(0).and(q.y.greaterThan(0)).and(q.x.lessThan(1)).and(q.y.lessThan(1)),
        () => {
          out.assign(tap(map.tex, q).level(0).r);
        },
      );
    });
    return out;
  }).setLayout({ name: `slideDebris${tag}`, type: "float", inputs: [v2("uv")] });

  /** `slideAt`: the snow's height off the old surface at `p`, m. */
  const at: N = Fn(([p]: N[]) => {
    const out = float(0).toVar();
    If(on.x.greaterThan(0), () => {
      const uv = frame(p).toVar();
      out.assign(debris(uv).sub(bed(uv)));
    });
    return out;
  }).setLayout({ name: `slideAt${tag}`, type: "float", inputs: [v2("p")] });

  return { slab0, slab1, on, keep: map.keep, frame, bed, debris, at };
}

export type SlideSlots = ReturnType<typeof makeSlide>;
const slidesOf = [new WeakMap<HazeUniforms, SlideSlots>(), new WeakMap<HazeUniforms, SlideSlots>()];
/** The slide's reads over `u`, made once a stage and shared by every node
 * over it (the vertex's apart, as `trail-tsl.ts`' `trailSlots` says). */
export function slideSlots(u: HazeUniforms, vertex = false): SlideSlots {
  const of = slidesOf[vertex ? 1 : 0];
  let s = of.get(u);
  if (!s) of.set(u, (s = makeSlide(u, vertex ? "V" : "")));
  return s;
}

/** `slideLumps`: the blocks' field, a rounded block a cell, 0..1. */
const lumps: N = Fn(([p]: N[]) => {
  const i = p.floor().toVar();
  const fr = p.fract().toVar();
  const best = float(9).toVar();
  const second = float(9).toVar();
  const tall = float(0).toVar();
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const c = vec2(x, y);
      const r = snowHash3(vec3(i.add(c), 3.7)).toVar();
      const o = c.add(0.15).add(r.xy.mul(0.7)).sub(fr);
      const d = dot(o, o).mul(r.z.mul(0.6).add(0.7)).toVar();
      If(d.lessThan(best), () => {
        second.assign(best);
        best.assign(d);
        tall.assign(r.z);
      }).ElseIf(d.lessThan(second), () => {
        second.assign(d);
      });
    }
  }
  const edge = sqrt(second).sub(sqrt(best));
  return tall
    .mul(0.55)
    .add(0.45)
    .mul(smoothstep(0, 0.45, edge));
}).setLayout({ name: "slideLumps", type: "float", inputs: [v2("p")] });

/** `slideWarp`: the blocks' field bent about. */
const warp = (p: N): N =>
  p.add(vec2(snowNoise(p.mul(0.31)).sub(0.5), snowNoise(p.mul(0.31).add(17)).sub(0.5)).mul(3));

/** `slideLumpGrad`: the blocks' slope, by finite difference. */
const lumpGrad: N = Fn(([p]: N[]) => {
  const e = 0.08;
  return vec2(
    lumps(p.add(vec2(e, 0))).sub(lumps(p.sub(vec2(e, 0)))),
    lumps(p.add(vec2(0, e))).sub(lumps(p.sub(vec2(0, e)))),
  ).div(2 * e);
}).setLayout({ name: "slideLumpGrad", type: "vec2", inputs: [v2("p")] });

/** What the slide makes of a pixel (`SLIDE_NORMAL`'s outputs). */
export type SlideHere = { slide: N; bed: N; debris: N; wall: N };

/** `SLIDE_NORMAL`: the slide's surface bent into `grad`, and what it is
 * here. `foot` is the pixel's own footprint on the ground. */
export function slideNormal(sl: SlideSlots, p: N, grad: N, dist: N, foot: N): SlideHere {
  const here = {
    slide: float(0).toVar(),
    bed: float(0).toVar(),
    debris: float(0).toVar(),
    wall: float(0).toVar(),
  };
  If(sl.on.x.greaterThan(0), () => {
    const suv = sl.frame(p).toVar();
    const bed = sl.bed(suv).toVar();
    here.debris.assign(sl.debris(suv));
    here.slide.assign(here.debris.sub(bed));
    here.bed.assign(
      select(bed.greaterThan(0), clamp(float(1).sub(here.debris.div(0.35)), 0, 1), float(0)),
    );
    If(
      dist.lessThan(400).and(
        bed
          .greaterThan(0)
          .or(here.debris.greaterThan(0))
          .or(abs(suv.x).lessThan(sl.slab1.x.add(sl.slab1.y).add(4))),
      ),
      () => {
        const se = clamp(foot.mul(0.6), 0.06, 0.6).toVar();
        const sg = vec2(
          sl.at(p.add(vec2(se, 0))).sub(sl.at(p.sub(vec2(se, 0)))),
          sl.at(p.add(vec2(0, se))).sub(sl.at(p.sub(vec2(0, se)))),
        )
          .div(se.mul(2))
          .toVar();
        here.wall.assign(smoothstep(0.5, 1.6, length(sg)));
        grad.addAssign(sg);
        If(here.debris.greaterThan(0.02), () => {
          const k = smoothstep(0.02, 0.35, here.debris).toVar();
          const a1 = float(1)
            .sub(smoothstep(0.25, 0.6, foot.mul(0.9)))
            .toVar();
          const a2 = float(1).sub(smoothstep(0.25, 0.6, foot.mul(2.8)));
          const wp = warp(p).toVar();
          grad.addAssign(
            lumpGrad(wp.mul(0.9))
              .mul(0.9 * 0.45)
              .mul(k)
              .mul(a1),
          );
          grad.addAssign(
            lumpGrad(wp.mul(1.7).add(5))
              .mul(1.7 * 0.25)
              .mul(k)
              .mul(a1),
          );
          grad.addAssign(
            lumpGrad(p.mul(2.8).add(11))
              .mul(2.8 * 0.18)
              .mul(k)
              .mul(a2),
          );
          grad.addAssign(
            snowNoiseGrad(p.mul(0.22).add(5), float(0.3))
              .mul(0.22 * 0.6)
              .mul(k),
          );
        });
        If(here.bed.greaterThan(0), () => {
          const fl = sl.slab0.zw;
          const ac = vec2(fl.y, fl.x.negate()).toVar();
          const q = vec2(dot(p, ac).mul(1.6), dot(p, fl).mul(0.05));
          const g2 = snowNoiseGrad(q, float(0.2)).toVar();
          grad.addAssign(
            ac
              .mul(g2.x.mul(1.6))
              .add(fl.mul(g2.y.mul(0.05)))
              .mul(0.03)
              .mul(here.bed)
              .mul(float(1).sub(smoothstep(30, 120, dist))),
          );
        });
      },
    );
  });
  return here;
}

/** `SLIDE_ALBEDO`: the bed, the wall's layers, the debris, on `alb`. */
export function slideAlbedo(sl: SlideSlots, here: SlideHere, alb: N, p: N, y: N, foot: N): void {
  const one = (x: N): N => float(1).sub(x);
  const tint = (c: N, k: N): N => mix(vec3(1), c, k);
  If(sl.on.x.greaterThan(0), () => {
    const px = foot;
    If(here.bed.greaterThan(0), () => {
      const patchy = snowNoise(p.mul(0.12).add(3));
      alb.assign(
        mix(alb, vec3(0.69, 0.75, 0.85).mul(patchy.mul(0.1).add(0.94)), here.bed.mul(0.8)),
      );
    });
    If(here.wall.greaterThan(0), () => {
      const w = snowNoise(p.mul(0.35)).mul(0.12);
      const bands = sin(y.add(w).mul(23)).mul(0.5).add(0.5);
      alb.assign(mix(alb, mix(vec3(0.6, 0.67, 0.8), vec3(0.8, 0.85, 0.95), bands), here.wall));
    });
    If(here.debris.greaterThan(0.02), () => {
      const k = smoothstep(0.02, 0.3, here.debris).toVar();
      const a1 = one(smoothstep(0.3, 0.7, px.mul(0.9)));
      const wp = warp(p).toVar();
      const lump = max(lumps(wp.mul(0.9)), lumps(wp.mul(1.7).add(5)).mul(0.85));
      const gap = mix(0.6, one(smoothstep(0.02, 0.3, lump)), a1).toVar();
      const a0 = one(smoothstep(0.4, 1.2, px.mul(0.28)));
      const coarse = mix(0.5, one(smoothstep(0.05, 0.5, lumps(p.mul(0.28).add(7)))), a0);
      alb.assign(mix(alb, vec3(0.95, 0.97, 1.0), k.mul(0.4)));
      alb.mulAssign(tint(vec3(0.56, 0.64, 0.79), gap.mul(0.55).add(coarse.mul(0.3)).mul(k)));
      const rim = smoothstep(0.02, 0.12, here.debris).mul(one(smoothstep(0.15, 0.6, here.debris)));
      alb.mulAssign(tint(vec3(0.7, 0.76, 0.86), rim.mul(0.6)));
      const a3 = one(smoothstep(0.3, 0.7, px.mul(4)));
      const fleck = smoothstep(0.93, 0.985, snowNoise(p.mul(4).add(61)));
      alb.assign(mix(alb, vec3(0.32, 0.27, 0.22), fleck.mul(0.55).mul(k).mul(a3)));
    });
  });
}
