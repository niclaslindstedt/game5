// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A TRAIL AS SHADED, ON THE NODE RENDERER (`docs/webgpu.md`, part 5):
// `snow-trail-glsl.ts` — the furrows read per pixel, their walls in the
// normal, the three bands by depth, the trench's hollow and the clods it
// spills, the deformable snow's own shadow — with the groove under the
// player's skis (`ski-clear.ts`'s `SKI_GROOVE_GLSL`), a snowmobile belt's
// paddles and the tree wells' slopes and colour (`snow-glsl.ts`), restated
// in TSL for the ground's node twin (`snow-sample-tsl.ts`). The GLSL is the
// authority, term for term, and each part sits where its chunk sits there.

import * as THREE from "three";
import * as TSL from "three/tsl";

import { slot, type N } from "./haze-tsl.ts";
import { SKI_HALF, SKI_LINES, SKI_POINTS } from "./ski-clear.ts";
import { snowNoise, snowNoiseGrad } from "./snow-noise-tsl.ts";
import { TRAIL } from "./trail-stamp.ts";
import type { TrailSlots } from "./trail-tsl.ts";

const {
  Continue,
  If,
  Loop,
  clamp,
  cos,
  distance,
  dot,
  float,
  fract,
  fwidth,
  length,
  max,
  mix,
  mod,
  normalize,
  pow,
  select,
  sin,
  smoothstep,
  vec2,
  vec3,
} = TSL as N;

const one = (x: N): N => float(1).sub(x);
const tint = (c: N, k: N): N => mix(vec3(1), c, k);

/** How deep the groove drawn under a ski is, m (`ski-clear.ts`'s `GROOVE`). */
const GROOVE = 0.025;
const f3 = (n: number): number => Number(n.toFixed(3));

/** `skiGroove(p, y)`: the narrow groove each of the player's bases presses
 * — its depth (x, 0..1 of `GROOVE`) and its slope (yz). `y` is the drawn
 * snow's height: a base well over it presses nothing. */
function skiGroove(trail: Record<string, THREE.IUniform>, p: N, y: N): N {
  const line = slot(trail.uSkiLine, "vec4");
  const on = slot(trail.uSkiClear, "float");
  const P = SKI_POINTS;
  const g = vec3(0).toVar();
  If(on.greaterThanEqual(1.5), () => {
    Loop({ start: 0, end: SKI_LINES, type: "int", name: "gs" }, ({ gs }: N) => {
      const base = gs.mul(P).toVar();
      let most: N = line.element(base).w;
      for (let k = 1; k < P; k++) most = max(most, line.element(base.add(k)).w);
      If(
        distance(p, line.element(base.add(P >> 1)).xz).greaterThan(
          most.mul(2).add(Number(SKI_HALF.toFixed(1)) + 0.05),
        ),
        () => {
          Continue();
        },
      );
      Loop({ start: 0, end: P - 1, type: "int", name: "gk" }, ({ gk }: N) => {
        const a = line.element(base.add(gk)).toVar();
        const b = line.element(base.add(gk).add(1)).toVar();
        const ab = b.xz.sub(a.xz).toVar();
        const t = clamp(dot(p.sub(a.xz), ab).div(max(dot(ab, ab), 1e-6)), 0, 1).toVar();
        const off = p.sub(a.xz.add(ab.mul(t))).toVar();
        const d = length(off).toVar();
        const w = mix(a.w, b.w, t).toVar();
        If(d.greaterThan(w.mul(2).add(0.05)), () => {
          Continue();
        });
        const lift = one(smoothstep(0.03, 0.12, mix(a.y, b.y, t).sub(y))).toVar();
        const h = one(smoothstep(w.mul(0.85), w.mul(1.35), d))
          .mul(lift)
          .toVar();
        If(h.greaterThan(g.x), () => {
          const dh0 = lift
            .mul(f3(GROOVE) * 6)
            .mul(d.sub(w.mul(0.85)))
            .mul(w.mul(1.35).sub(d))
            .div(pow(w.mul(0.5), 3));
          const dh = select(
            d.greaterThan(w.mul(0.85)).and(d.lessThan(w.mul(1.35))),
            clamp(dh0, 0, 1.2),
            float(0),
          );
          g.assign(vec3(h, off.div(max(d, 1e-5)).mul(dh)));
        });
      });
    });
  });
  return g;
}

/** What the trail makes of a pixel, beside `SnowState`'s own. */
export type TrailHere = {
  press: N;
  wall: N;
  wallUp: N;
  self: N;
  scuff: N;
  trough: N;
  trench: N;
  hollow: N;
  spill: N;
};

/** The six taps of the trench's ring, 0.9 m out. */
const RING = Array.from({ length: 6 }, (_, i) => [
  Math.cos(i * 1.0471976) * 0.9,
  Math.sin(i * 1.0471976) * 0.9,
]);

/** `SNOW_TRAIL_SAMPLE`: the furrows per pixel, bent into `grad`. */
export function trailSample(
  t: TrailSlots,
  trail: Record<string, THREE.IUniform>,
  o: { p: N; y: N; dist: N; grad: N; sunDir: N; skipW: N; rock: N },
): TrailHere {
  const { p, dist, grad } = o;
  const tr = t.trailAt(p).toVar();
  const here: TrailHere = {
    press: clamp(tr.x.div(0.14), 0, 1).toVar(),
    wall: float(0).toVar(),
    wallUp: vec2(0).toVar(),
    self: float(1).toVar(),
    scuff: float(0).toVar(),
    trough: float(0).toVar(),
    trench: float(0).toVar(),
    hollow: float(0).toVar(),
    spill: float(0).toVar(),
  };
  If(
    dist
      .lessThan(220)
      .and(o.skipW.lessThan(0.5))
      .and(t.furrowed.greaterThan(0.5).or(t.deformOn.greaterThan(0.5))),
    () => {
      const fineW = t.fineWeight(p);
      const e = mix(
        mix(t.coarseTexel, t.fineTexel.mul(0.75), fineW),
        t.deformBox.w,
        t.deformWeight(p),
      ).toVar();
      const tg = vec2(
        t.relief(p.add(vec2(e, 0))).sub(t.relief(p.sub(vec2(e, 0)))),
        t.relief(p.add(vec2(0, e))).sub(t.relief(p.sub(vec2(0, e)))),
      )
        .div(e.mul(2))
        .toVar();
      tg.mulAssign(one(smoothstep(120, 220, dist)));
      here.wall.assign(clamp(length(tg), 0, 1));
      here.wallUp.assign(tg);
      grad.addAssign(tg);
    },
  );
  // THE GROOVE UNDER THE PLAYER'S SKIS, where the trail map holds none —
  // and none on bare rock.
  If(dist.lessThan(40), () => {
    const sg = skiGroove(trail, p, o.y).toVar();
    const fade = one(smoothstep(0.01, 0.03, tr.x))
      .mul(one(smoothstep(20, 40, dist)))
      .mul(one(o.rock))
      .toVar();
    grad.addAssign(sg.yz.mul(fade));
    here.press.assign(max(here.press, sg.x.mul(0.55).mul(fade)));
  });
  // The sun the deformable snow's own relief hides.
  here.self.assign(t.deformSelf(p, o.sunDir, dist));
  // THE THREE DEPTHS OF A TRAIL.
  here.scuff.assign(smoothstep(0.003, 0.012, tr.x).mul(one(smoothstep(0.02, 0.05, tr.x))));
  here.trough.assign(smoothstep(0.02, 0.05, tr.x).mul(one(smoothstep(0.16, 0.3, tr.x))));
  here.trench.assign(smoothstep(0.16, 0.3, tr.x));
  If(
    dist
      .lessThan(110)
      .and(tr.x.greaterThan(0.03).or(tr.y.greaterThan(0.003)))
      .and(o.skipW.lessThan(0.5)),
    () => {
      const ring = float(0).toVar();
      const ringMax = float(0).toVar();
      for (const [dx, dz] of RING) {
        const rd = t.trailAt(p.add(vec2(dx, dz))).x.toVar();
        ring.addAssign(rd);
        ringMax.assign(max(ringMax, rd));
      }
      ring.divAssign(6);
      const fade = one(smoothstep(60, 110, dist)).toVar();
      here.hollow.assign(
        smoothstep(0.04, 0.7, tr.x)
          .mul(mix(0.45, 1, smoothstep(0, 0.3, tr.x.sub(ring))))
          .mul(fade),
      );
      here.spill.assign(
        smoothstep(0.12, 0.4, ringMax)
          .mul(one(smoothstep(0.03, 0.12, tr.x)))
          .mul(fade),
      );
    },
  );
  // The trough's walls crumbled; the trench's broken into blocks.
  If(dist.lessThan(70).and(here.wall.greaterThan(0.02)).and(tr.x.greaterThan(0.02)), () => {
    const k = here.wall.mul(one(smoothstep(25, 70, dist))).toVar();
    grad.addAssign(
      snowNoiseGrad(p.mul(6).add(19), float(0.05))
        .mul(6 * 0.03)
        .mul(k)
        .mul(here.trough),
    );
    grad.addAssign(
      snowNoiseGrad(p.mul(2.6).add(23), float(0.08))
        .mul(2.6 * 0.09)
        .mul(k)
        .mul(here.trench),
    );
    grad.addAssign(
      snowNoiseGrad(p.mul(7.5).add(29), float(0.05))
        .mul(7.5 * 0.025)
        .mul(k)
        .mul(here.trench),
    );
  });
  // THE SPILL: lumps and rolled balls of snow over the trench's rim.
  If(here.spill.greaterThan(0.01), () => {
    const lump = smoothstep(0.5, 0.75, snowNoise(p.mul(3.2).add(37)));
    grad.addAssign(
      snowNoiseGrad(p.mul(3.2).add(37), float(0.06))
        .mul(3.2 * 0.4)
        .mul(here.spill)
        .mul(lump.add(0.3)),
    );
    grad.addAssign(
      snowNoiseGrad(p.mul(8).add(43), float(0.04))
        .mul(8 * 0.06)
        .mul(here.spill),
    );
  });
  return here;
}

/** THE PADDLES' PRINT across a belt's floor (`snow-glsl.ts`), bent into
 * `grad`; the lug's share is the return. Its phase's footprint is taken in
 * uniform flow, the GLSL's `fwidth(ph)` being the same value there. */
export function beltLugs(p: N, axis: N, belt: N, dist: N, grad: N): N {
  const L = TRAIL.lug;
  const row = f3(L.row);
  const pitch = f3(L.pitch);
  const th = axis.mul(3.14159265).toVar();
  const alg = vec2(sin(th), cos(th)).toVar();
  const acr = vec2(cos(th), sin(th).negate()).toVar();
  const rowN = dot(p, acr).div(row).floor().toVar();
  const ph = dot(p, alg).div(pitch).add(mod(rowN, 2).mul(0.5)).toVar();
  const aa = one(smoothstep(0.3, 0.8, fwidth(ph))).toVar();
  const lug = float(0).toVar();
  If(belt.greaterThan(0.01).and(dist.lessThan(70)), () => {
    const c = cos(ph.mul(6.2831853)).mul(0.5).add(0.5).toVar();
    const c2 = c.mul(c).toVar();
    const ac = fract(dot(p, acr).div(row)).toVar();
    const ends = smoothstep(0, 0.12, ac).mul(smoothstep(1, 0.88, ac));
    const k = belt
      .mul(aa)
      .mul(ends)
      .mul(one(smoothstep(35, 70, dist)))
      .toVar();
    k.mulAssign(mix(0.6, 1, snowNoise(p.mul(3).add(rowN.mul(1.7)))));
    lug.assign(c2.mul(c).mul(k));
    const dh = c2
      .mul(3 * f3(L.depth) * 3.14159265)
      .mul(sin(ph.mul(6.2831853)))
      .div(pitch);
    grad.addAssign(alg.mul(dh).mul(k));
  });
  return lug;
}

/** THE TREE WELLS' slope, off the map the mesh is lowered by. */
export function wellSlope(well: N, frameOn: N, p: N, dist: N, grad: N): void {
  If(frameOn.greaterThan(0).and(dist.lessThan(90)), () => {
    const we = 0.3;
    const wg = vec2(
      well(p.add(vec2(we, 0))).sub(well(p.sub(vec2(we, 0)))),
      well(p.add(vec2(0, we))).sub(well(p.sub(vec2(0, we)))),
    ).div(2 * we);
    grad.subAssign(wg);
  });
}

/** A TREE WELL's colour (`snow-glsl.ts`): the hollow cooler and shadier the
 * deeper in, and on its floor what the tree sheds. `px` is the pixel's
 * footprint, taken in uniform flow. */
export function wellAlbedo(alb: N, depth: N, p: N, px: N): void {
  If(depth.greaterThan(0.02), () => {
    const k = smoothstep(0, 1, depth);
    alb.assign(mix(alb, vec3(0.62, 0.7, 0.84), k.mul(0.55)));
    alb.mulAssign(tint(vec3(0.66, 0.72, 0.82), smoothstep(0.25, 1.3, depth)));
    const floorK = smoothstep(0.55, 1.2, depth).mul(one(smoothstep(0.3, 0.7, px.mul(6))));
    const clot = smoothstep(0.55, 0.85, snowNoise(p.mul(6).add(41)));
    const needle = smoothstep(0.7, 0.95, snowNoise(p.mul(23).add(7)));
    alb.assign(mix(alb, vec3(0.3, 0.25, 0.19), clot.mul(0.5).add(needle.mul(0.35)).mul(floorK)));
  });
}

/** `SNOW_TRAIL_ALBEDO`: pressed, walled and dug snow, on `alb`. */
export function trailAlbedo(alb: N, h: TrailHere, st: { packed: N; fresh: N; sunDir: N }): void {
  alb.mulAssign(tint(vec3(0.9, 0.93, 0.97), h.press));
  alb.mulAssign(
    tint(
      vec3(0.86, 0.9, 0.96),
      smoothstep(0.04, 0.29, h.press).mul(one(st.packed)).mul(one(h.trench)),
    ),
  );
  alb.mulAssign(tint(vec3(0.86, 0.9, 0.96), h.scuff.mul(st.packed.mul(0.65).add(0.35))));
  alb.assign(mix(alb, vec3(0.78, 0.87, 1.0), h.hollow.mul(0.55)));
  alb.mulAssign(tint(vec3(0.82, 0.9, 1.0), h.wall.mul(h.trench)));
  alb.assign(mix(alb, st.fresh, h.spill.mul(0.6)));
  const awayW = dot(normalize(h.wallUp.add(1e-6)), normalize(st.sunDir.xz.add(1e-6)))
    .mul(0.5)
    .add(0.5);
  alb.mulAssign(tint(vec3(0.8, 0.86, 0.95), h.wall.mul(mix(0.25, 1, awayW))));
}

/** `SNOW_TRAIL_LIGHT`: down in a trench, on the reflected light `r`. */
export function trailLight(r: N, hollow: N, sunPos: N): void {
  r.indirectDiffuse.mulAssign(tint(vec3(0.6, 0.68, 0.84), hollow));
  const high = smoothstep(0.3, 0.9, sunPos.y.div(max(length(sunPos), 1e-3)));
  r.directDiffuse.mulAssign(one(hollow.mul(0.5).mul(one(high))));
}
