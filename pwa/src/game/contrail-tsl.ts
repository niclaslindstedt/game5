// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CONTRAILS ON THE NODE RENDERER: `contrail-glsl.ts`'s `contrailSky`
// restated as TSL for the dome's node twin (`sky-dome-tsl.ts`,
// `docs/webgpu.md` part 3), off the same uniforms (`contrails.ts`), read by
// reference. The GLSL is the authority, term for term — the dark gap, the
// pair of lines merging, the Crow instability's wave and puffs, the old
// band's fibres, the glint at the head — and a change to one is a change
// to both.

import * as TSL from "three/tsl";

import { cloudAir, type CloudSlots } from "./cloud-shell-tsl.ts";
import { CONTRAIL } from "./contrail-plan.ts";
import { TRAIL_SLOTS } from "./contrail-glsl.ts";
import type { ContrailUniforms } from "./contrails.ts";
import { slot, type N } from "./haze-tsl.ts";

// Read untyped, as every node here is (`haze-tsl.ts`'s `N`).
const {
  Break,
  Continue,
  If,
  Loop,
  clamp,
  cos,
  cross,
  dot,
  exp,
  float,
  floor,
  fract,
  int,
  inverseSqrt,
  length,
  max,
  min,
  mix,
  pow,
  select,
  sin,
  smoothstep,
  step,
  vec2,
  vec3,
  vec4,
} = TSL as N;

export type TrailSlots = ReturnType<typeof trailSlots>;

export function trailSlots(u: ContrailUniforms) {
  return {
    A: slot(u.uTrailA, "vec4"),
    B: slot(u.uTrailB, "vec4"),
    C: slot(u.uTrailC, "vec4"),
    D: slot(u.uTrailD, "vec4"),
    on: slot(u.uTrailOn, "vec4"),
    mid: slot(u.uTrailMid, "vec4"),
    sun: slot(u.uTrailSun, "vec3"),
    sky: slot(u.uTrailSky, "vec3"),
  };
}

function trailHash(p0: N): N {
  const p = fract(p0.mul(vec2(0.1031, 0.103))).toVar();
  p.addAssign(dot(p, p.yx.add(33.33)));
  return fract(p.x.add(p.y).mul(p.x));
}
function trailNoise(p: N): N {
  const i = floor(p);
  const u0 = p.sub(i);
  const u = u0.mul(u0).mul(u0.mul(-2).add(3));
  return mix(
    mix(trailHash(i), trailHash(i.add(vec2(1, 0))), u.x),
    mix(trailHash(i.add(vec2(0, 1))), trailHash(i.add(1)), u.x),
    u.y,
  );
}
const hg = (mu: N, g: number): N =>
  float(1 - g * g).div(pow(float(1 + g * g).sub(mu.mul(2 * g)), 1.5));

/** The trails in front of the sky along `d` from the eye `e`, the sky's
 * colour there `sky`: premultiplied colour and the share hidden. */
export function contrailSky(t: TrailSlots, c: CloudSlots, sunPos: N, e: N, d: N, sky: N): N {
  const acc = vec4(0).toVar();
  If(t.on.y.greaterThan(0).and(d.y.greaterThanEqual(0.008)), () => {
    const n = int(t.on.x.add(0.5)).toVar();
    const mu = dot(d, sunPos);
    const phase = hg(mu, 0.85).mul(0.1).add(0.55).add(hg(mu, -0.2).mul(0.18)).toVar();
    const dh = d.xz.div(max(length(d.xz), 1e-4)).toVar();
    Loop({ start: 0, end: TRAIL_SLOTS, type: "int", name: "k" }, ({ k }: { k: N }) => {
      If(k.greaterThanEqual(n), () => {
        Break();
      });
      const A = t.A.element(k).toVar();
      const B = t.B.element(k).toVar();
      const C = t.C.element(k).toVar();
      const D = t.D.element(k).toVar();
      const ax = A.zw.sub(A.xy).toVar();
      const L2 = max(dot(ax, ax), 1).toVar();
      // Where the view crosses the height it was laid at; then again at
      // the height the trail has sunk to there.
      const t0 = B.x.sub(e.y).div(d.y);
      const p0 = e.xz.add(d.xz.mul(t0));
      const u0 = clamp(dot(p0.sub(A.xy), ax).div(L2), 0, 1);
      const age0 = mix(B.y, B.z, u0);
      const y = B.x
        .sub(
          float(1)
            .sub(exp(age0.negate().div(CONTRAIL.sinkTime)))
            .mul(CONTRAIL.sink),
        )
        .toVar();
      const t1 = y.sub(e.y).div(d.y).toVar();
      If(t1.lessThanEqual(0).or(t1.greaterThan(160000)), () => {
        Continue();
      });
      const p = e.xz.add(d.xz.mul(t1)).toVar();
      const u = clamp(dot(p.sub(A.xy), ax).div(L2), 0, 1).toVar();
      const age = mix(B.y, B.z, u).toVar();
      const w = B.w.add(C.z.mul(age)).toVar();
      const nrm = vec2(ax.y, ax.x.negate()).mul(inverseSqrt(L2));
      const q = p.sub(A.xy.add(ax.mul(u)));
      const x = dot(q, nrm).toVar();
      const across = dot(dh, nrm).abs();
      const foot = t1.mul(t.on.z).mul(mix(float(1), float(1).div(max(d.y, 0.04)), across));
      const we = max(w, foot.mul(1.6)).toVar();
      const reach = we.mul(1.6).add(w);
      // The glint first: the plane at the head.
      If(D.z.greaterThan(0.5), () => {
        const pl = vec3(A.x, B.x, A.y).sub(e).toVar();
        const dist = length(pl).toVar();
        const th = length(cross(d, pl.div(dist)));
        const size = float(32).div(dist).toVar();
        const px = max(size, t.on.z.mul(1.4)).toVar();
        const g = exp(th.mul(th).negate().div(px.mul(px)))
          .mul(size.mul(size))
          .div(px.mul(px))
          .mul(smoothstep(CONTRAIL.glintReach, CONTRAIL.glintClear, dist));
        const air = cloudAir(c, dist, e.y.sub(c.seaLevel), B.x.sub(c.seaLevel));
        acc.assign(
          vec4(
            acc.rgb.add(float(1).sub(acc.a).mul(t.sun.mul(9).mul(air).mul(g).mul(t.mid.w))),
            acc.a,
          ),
        );
      });
      // Past either end, nothing.
      const raw = dot(p.sub(A.xy), ax).div(L2);
      If(
        D.w.lessThan(0.5).or(x.abs().greaterThan(reach)).or(raw.lessThan(0)).or(raw.greaterThan(1)),
        () => {
          Continue();
        },
      );
      const along = mix(C.x, C.y, u).toVar();
      // THE CROW INSTABILITY: a wave along the line, then puffs.
      const lam = D.y.mul(140).add(330).toVar();
      const ph = along
        .div(lam)
        .mul(6.2832)
        .add(D.y.mul(31))
        .add(trailNoise(vec2(along.div(1300), D.y.mul(5))).mul(2.2))
        .toVar();
      const seen = smoothstep(4, 12, lam.div(max(t1.mul(t.on.z), 1))).toVar();
      const crow = seen.mul(smoothstep(12, 55, age)).mul(float(1).sub(smoothstep(110, 300, age)));
      const xc = x.sub(crow.mul(0.45).mul(min(w, 120)).mul(sin(ph))).toVar();
      const old = smoothstep(150, 1200, age).toVar();
      const fib = t.on.w;
      const rag = old
        .mul(fib)
        .mul(trailNoise(vec2(along.div(2200), D.y.mul(9))).sub(0.5))
        .mul(0.7);
      const r = xc.div(max(we, 1).mul(0.5).mul(rag.add(1))).toVar();
      // FRESH: the pair of lines merging; then one; an old band flat-topped.
      const merge = exp(age.negate().div(7)).mul(w.div(we)).toVar();
      const off = merge.mul(0.62);
      const sig = mix(float(0.42), float(0.62), float(1).sub(merge));
      const s2 = sig.mul(sig).mul(0.35);
      const ra = r.sub(off);
      const rb = r.add(off);
      const two = exp(ra.mul(ra).negate().div(s2))
        .add(exp(rb.mul(rb).negate().div(s2)))
        .mul(0.5);
      const one = exp(
        r
          .mul(r)
          .negate()
          .mul(mix(float(2.2), float(1), old))
          .mul(mix(float(1), r.mul(r).mul(0.4).add(0.6), old)),
      );
      const prof = mix(one, two.mul(1.15), merge).toVar();
      const puff = seen.mul(smoothstep(35, 100, age)).mul(float(1).sub(smoothstep(150, 420, age)));
      const knot = cos(ph).mul(0.5).add(0.5);
      prof.mulAssign(
        float(1).sub(
          puff
            .mul(0.7)
            .mul(float(1).sub(knot.mul(knot)))
            .mul(w.div(we)),
        ),
      );
      // Fibres: streaks along the band, and its body patchy.
      If(fib.greaterThan(0).and(age.greaterThan(90)), () => {
        const s1 = trailNoise(
          vec2(along.div(900).add(D.y.mul(7)), xc.div(max(w.mul(0.22), 1))),
        ).toVar();
        const s2n = trailNoise(vec2(along.div(260), xc.div(max(w.mul(0.07), 1)).add(13))).toVar();
        const pxm = max(t1.mul(t.on.z), 1).toVar();
        const a1 = mix(float(0.55), s1, smoothstep(4, 12, float(900).div(pxm)));
        const a2 = mix(float(0.5), s2n, smoothstep(4, 12, min(260, w.mul(0.07)).div(pxm)));
        const streak = a1.mul(a2.mul(0.6).add(0.6)).mul(0.8).add(0.45);
        prof.mulAssign(mix(float(1), streak, smoothstep(90, 700, age).mul(fib)));
      });
      // Its density at this age (`contrail-plan.ts`'s `tauAt`).
      const persists = step(C.w, 0).toVar();
      const tau = D.x
        .mul(pow(B.w.div(w), 0.55))
        .mul(
          persists
            .mul(0.6)
            .mul(smoothstep(0, 300, age))
            .add(1),
        )
        .mul(exp(age.negate().div(CONTRAIL.youngTime)).mul(CONTRAIL.young).add(1))
        .toVar();
      tau.mulAssign(
        select(
          persists.greaterThan(0.5),
          float(1).sub(smoothstep(CONTRAIL.fade, CONTRAIL.persist, age)),
          float(1).sub(smoothstep(C.w.mul(0.35), C.w, age)),
        ),
      );
      tau.mulAssign(smoothstep(0.2, CONTRAIL.gap, age));
      const slant = min(float(1).div(max(d.y, 0.05)), max(1, w.div(350)));
      const a = float(1)
        .sub(exp(tau.negate().mul(prof).mul(slant).mul(w.div(we))))
        .mul(smoothstep(t.mid.z, t.mid.z.mul(0.72), length(p.sub(t.mid.xy))))
        .toVar();
      // A short trail far off is a speck, not a plane's line: let it go.
      If(persists.lessThan(0.5), () => {
        a.mulAssign(
          smoothstep(
            CONTRAIL.shortReach,
            CONTRAIL.shortClear,
            length(vec2(t1.mul(length(d.xz)), y.sub(e.y))),
          ),
        );
      });
      If(a.lessThanEqual(0.0005), () => {
        Continue();
      });
      const lit = t.sun
        .mul(phase)
        .mul(mix(float(1), float(0.8), old))
        .add(t.sky.mul(mix(float(0.85), float(1), old)));
      const air = cloudAir(c, t1, e.y.sub(c.seaLevel), y.sub(c.seaLevel));
      const col = lit.mul(air).add(sky.mul(vec3(1).sub(air)));
      const keep = float(1).sub(acc.a);
      acc.assign(vec4(acc.rgb.add(keep.mul(col).mul(a)), acc.a.add(keep.mul(a))));
    });
  });
  return acc.mul(t.on.y);
}
