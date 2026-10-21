// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRDS AND THE ANIMALS ON THE NODE RENDERER (`docs/webgpu.md`, part
// 11): the GLSL each species' material grafts on WebGL, restated as a
// figure's pose (`figure-tsl.ts`), term for term:
//
//   bird    the wings (`bird-shapes.ts`'s `birdMaterial`): the hand folded
//           back about the species' wrist, the arm about the shoulder, the
//           whole wing flapped about it — the instance's `aFold` and
//           `aFlap`, the species' wrist its own number;
//   beast   the animals (`beast-shapes.ts`'s `beastMaterial`): the rack's
//           growth, the legs' swing and lift, the head's graze, and a
//           broken body's spine, flank, legs and head (`beast-crush.ts`),
//           painted where it was met; its shadow walks and breaks the same
//           way (`beastDepthMaterial`), unpainted.
//
// A species' numbers are read off the material drawn (`own`), so the
// whole roster shares a program on the node renderer as on WebGL.

import type * as THREE from "three";
import * as TSL from "three/tsl";

import { GRAZE_ANGLE } from "./beast-shapes.ts";
import { ARM_FOLD, HAND_FOLD } from "./bird-shapes.ts";
import { own, type FigureSpec, type PoseContext } from "./figure-tsl.ts";
import type { N } from "./haze-tsl.ts";

const {
  If,
  abs,
  attribute,
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  max,
  min,
  mix,
  positionGeometry,
  pow,
  select,
  sin,
  smoothstep,
  step,
  vec3,
} = TSL as N;

/** A constant as the GLSL prints it (`toFixed`). */
const fixed = (n: number, d: number): number => Number(n.toFixed(d));

/** THE BIRDS (`birdMaterial`): the wing hinges, before anything else. */
export function birdSpec(): FigureSpec {
  return {
    pose: {
      early(p) {
        const out = p.toVar();
        If(attribute("aWing", "float").greaterThan(0.5), () => {
          const wrist = own("uWrist", "float");
          const fold = attribute("aFold", "float");
          const flap = attribute("aFlap", "float");
          const side = select(p.x.lessThan(0), float(-1), float(1));
          const x = abs(p.x).toVar();
          const z = p.z.toVar();
          const hand = x.sub(wrist).toVar();
          If(hand.greaterThan(0), () => {
            const a = fold.mul(fixed(HAND_FOLD, 4));
            const c = cos(a).toVar();
            const s = sin(a).toVar();
            const nx = wrist.add(hand.mul(c)).add(z.mul(s)).toVar();
            z.assign(hand.negate().mul(s).add(z.mul(c)));
            x.assign(nx);
          });
          const b = fold.mul(fixed(ARM_FOLD, 4));
          const cb = cos(b).toVar();
          const sb = sin(b).toVar();
          const ax = x.mul(cb).add(z.mul(sb)).toVar();
          const az = x.negate().mul(sb).add(z.mul(cb));
          const cf = cos(flap).toVar();
          const sf = sin(flap).toVar();
          out.assign(vec3(side.mul(ax.mul(cf).sub(p.y.mul(sf))), ax.mul(sf).add(p.y.mul(cf)), az));
        });
        return out;
      },
    },
  };
}

/** `wreckHash` (`beast-crush.ts`). */
const wreckHash = (p: N): N => fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));

/** The rack's growth, the legs' swing and the head's graze (`gaitGraft`). */
function gait(p: N): N {
  const t = p.toVar();
  const antler = attribute("aAntler", "vec4");
  const motion = attribute("aMotion", "vec4");
  const part = attribute("aPart", "vec3");
  const pivot = own("uHeadPivot", "vec2");
  If(antler.w.greaterThan(-0.5), () => {
    const grown = step(antler.w, motion.w.add(0.0001)).mul(motion.w);
    t.assign(antler.xyz.add(t.sub(antler.xyz).mul(grown)));
  });
  If(part.x.greaterThan(0.5), () => {
    const ph = motion.x.add(part.x.sub(1).mul(6.2831853)).toVar();
    const swing = sin(ph).mul(motion.y).mul(own("uLegSwing", "float")).toVar();
    const dy = t.y.sub(part.y).toVar();
    const reach = clamp(dy.negate().div(own("uLegReach", "float")), 0, 1);
    const lift = max(0, cos(ph)).mul(motion.y).mul(own("uLegLift", "float")).mul(reach);
    t.assign(vec3(t.x, part.y.add(dy.mul(cos(swing))).add(lift), t.z.add(dy.mul(sin(swing)))));
  });
  If(part.z.greaterThan(0.5), () => {
    const g = motion.z.mul(fixed(GRAZE_ANGLE, 4)).toVar();
    const hy = t.y.sub(pivot.x).toVar();
    const hz = t.z.sub(pivot.y).toVar();
    t.assign(
      vec3(
        t.x,
        pivot.x.add(hy.mul(cos(g))).sub(hz.mul(sin(g))),
        pivot.y.add(hy.mul(sin(g))).add(hz.mul(cos(g))),
      ),
    );
  });
  return t;
}

/** A broken body (`crushGraft`), what the paint needs kept in `ctx`. */
function crush(p: N, ctx: PoseContext): N {
  const t = p.toVar();
  const br = attribute("aBroken", "vec4");
  const part = attribute("aPart", "vec3");
  const body = own("uBody", "vec4");
  const pivot = own("uHeadPivot", "vec2");
  const k = {
    c: float(0).toVar(),
    near: float(0).toVar(),
    onSide: float(0).toVar(),
    h: float(0).toVar(),
    across: float(0).toVar(),
  };
  ctx.kept = k;
  If(br.x.greaterThan(0), () => {
    const c = br.x;
    const side = br.z;
    const dz = t.z.sub(br.y).toVar();
    k.c.assign(c);
    k.near.assign(exp(pow(dz.div(body.y.mul(0.26)), 2).negate()));
    k.onSide.assign(smoothstep(-0.35, 0.75, side.mul(t.x).div(body.x)));
    k.h.assign(wreckHash(floor(positionGeometry.mul(37)).add(br.w)));
    If(part.x.greaterThan(0.5), () => {
      const a = wreckHash(vec3(part.x, br.w, 3.1))
        .sub(0.5)
        .mul(2.2)
        .mul(c)
        .toVar();
      const b = wreckHash(vec3(part.x, br.w, 7.7))
        .sub(0.5)
        .mul(1.3)
        .mul(c)
        .toVar();
      const dy = t.y.sub(part.y).toVar();
      const y1 = dy.mul(cos(a)).toVar();
      t.assign(vec3(t.x.add(dy.mul(sin(a))), part.y.add(y1.mul(cos(b))), t.z.add(y1.mul(sin(b)))));
    }).Else(() => {
      const dent = c.mul(0.75).mul(body.x).mul(k.near).mul(k.onSide);
      const y = body.z.add(t.y.sub(body.z).mul(float(1).sub(c.mul(0.3).mul(k.near))));
      const rough = k.h.sub(0.5).mul(0.5).mul(body.w).mul(c).mul(k.near).mul(k.onSide);
      t.assign(vec3(t.x.sub(side.mul(dent)), y.add(rough), t.z));
    });
    If(part.z.greaterThan(0.5), () => {
      const a = side.negate().mul(c).mul(1.2).toVar();
      const hy = t.y.sub(pivot.x).toVar();
      const y = pivot.x.add(hy.mul(cos(a))).sub(c.mul(0.3).mul(max(0, t.z.sub(pivot.y))));
      t.assign(vec3(t.x.add(hy.mul(sin(a))), y, t.z));
    });
    const th = c
      .mul(0.45)
      .mul(clamp(dz.div(body.y.mul(0.15)), -1, 1))
      .toVar();
    const py = body.z.add(body.w).toVar();
    const ry = t.y.sub(py).toVar();
    t.assign(
      vec3(
        t.x,
        py.add(ry.mul(cos(th))).sub(dz.mul(sin(th))),
        br.y.add(ry.mul(sin(th))).add(dz.mul(cos(th))),
      ),
    );
    k.across.assign(side.mul(t.x).div(body.x));
  });
  return t;
}

/** THE ANIMALS (`beastMaterial`, and `beastDepthMaterial` unpainted). */
export function beastSpec(m: THREE.Material): FigureSpec {
  const painted = m.userData.figureDepth === undefined;
  return {
    pose: {
      early: (p, ctx) => crush(gait(p), ctx),
      paint: painted
        ? (colour, tint, ctx) => {
            const k = ctx.kept;
            const out = colour.mul(tint).toVar();
            If(k.c.greaterThan(0), () => {
              const br = attribute("aBroken", "vec4");
              const wound = clamp(k.c.mul(1.8).mul(k.near).mul(k.onSide), 0, 1);
              const meat = select(
                k.h.greaterThan(0.82),
                own("uFat", "vec3"),
                mix(own("uClot", "vec3"), own("uMuscle", "vec3"), k.h.mul(1.2)),
              );
              const spat = k.c.mul(
                step(0.62, wreckHash(floor(positionGeometry.mul(23)).add(br.w).add(1))),
              );
              const blood = own("uBlood", "vec3").mul(k.h.mul(0.45).add(0.55));
              out.assign(mix(out, blood, min(1, spat)));
              out.assign(
                mix(out, own("uClot", "vec3"), k.c.mul(0.5).mul(smoothstep(0.2, -0.6, k.across))),
              );
              out.assign(mix(out, meat, smoothstep(0.22, 0.55, wound)));
            });
            return out;
          }
        : undefined,
    },
  };
}
