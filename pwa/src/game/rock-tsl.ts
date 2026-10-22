// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK ON THE NODE RENDERER (`docs/webgpu.md`, part 13): `rocks.ts`'s
// graft on the crags' skin and the cliffs' walls, and on the talus under
// them, restated in TSL over the same uniforms, term for term with the GLSL
// (`CALM_*`, `STRATA_*`, `TALUS_*`, `PULL_GLSL`):
//
//   - the vertex: the facets calmed with distance (the normal toward the
//     ground's smooth one, the paint toward the rock's mean), a talus
//     stone sunk by the snow and with the distance, and the whole pulled
//     toward the lens in depth alone;
//   - the colour: the snow decided by the facet, the laminae and their
//     analytic bump, the joints, the streaks, the rust and the lichen, the
//     beds as tone past the calm (`strata-tsl.ts`), the rime and the new
//     snow's dust;
//   - the normal tipped off the facet's by the laminae's slope;
//   - the haze laid thinner over the bare stone (`HAZE_KEEP`): the copy
//     hazes itself (`hazeOver`'s `keep`), its scene fog off.
//
// The rock's own uniforms (the beds, the wind, the summer, the stone's
// tone, the talus's reach) are read off the material drawn
// (`userData.graftOwn`, the very objects WebGL's graft is handed).

import * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeBuilder, NodeMaterial } from "three/webgpu";

import { graftOwn } from "./figure-tsl.ts";
import { insideWall } from "./glow-tsl.ts";
import { hazeOver, slot, type N } from "./haze-tsl.ts";
import type { PropDressing } from "./props-tsl.ts";
import { ROCK_SNOW } from "./rock-shapes.ts";
import { CALM_FROM, CALM_TO, FAR_EVEN } from "./strata-glsl.ts";
import { stBands, stFar, stHazeKeep } from "./strata-tsl.ts";

const {
  Fn,
  If,
  abs,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  cos,
  cross,
  dFdx,
  dFdy,
  distance,
  dot,
  faceDirection,
  float,
  floor,
  fract,
  length,
  materialColor,
  max,
  min,
  mix,
  modelWorldMatrix,
  normalLocal,
  normalView,
  normalize,
  positionGeometry,
  positionLocal,
  positionView,
  positionWorld,
  property,
  sign,
  sin,
  smoothstep,
  step,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const io = (name: string, type: string) => ({ name, type });

/** The laminae's spacing, m (`rocks.ts`'s `LAYER`). */
const LAYER = 0.9;
/** The depth pull (`PULL`, `PULL_FROM`, `PULL_MOST`). */
const PULL = 0.004;
const PULL_FROM = 30;
const PULL_MOST = 12;
const SNOW = (): N => vec3(...ROCK_SNOW.map((v) => Number(v.toFixed(3))));
const RIME = (): N => vec3(0.9, 0.93, 0.97);

/** What the vertex hands the fragment: the share calmed, and the paint. */
const CALM: N = varyingProperty("float", "vRkCalm");
const PAINT: N = varyingProperty("vec3", "vRkPaint");
/** What the colour hands the normal and the haze. */
const SLOPE: N = property("vec2", "rkSlope");
const KEEP: N = property("float", "rkKeep");

/** `rkHash`. */
const rkHash: N = Fn(([q]: N[]) => {
  const p = fract(q.mul(vec2(123.34, 456.21))).toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return fract(p.x.mul(p.y));
}).setLayout({ name: "rkHash", type: "float", inputs: [io("p", "vec2")] });

/** `rkHash3`. */
const rkHash3: N = Fn(([q]: N[]) => {
  const p = fract(q.mul(0.1031)).toVar();
  p.addAssign(dot(p, p.zyx.add(31.32)));
  return fract(p.x.add(p.y).mul(p.z));
}).setLayout({ name: "rkHash3", type: "float", inputs: [io("p", "vec3")] });

/** `rkNoise`: trilinear value noise. */
const rkNoise: N = Fn(([p]: N[]) => {
  const i = floor(p).toVar();
  const f0 = fract(p);
  const f = f0
    .mul(f0)
    .mul(float(3).sub(f0.mul(2)))
    .toVar();
  const h = (x: number, y: number, z: number): N => rkHash3(i.add(vec3(x, y, z)));
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y),
    mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y),
    f.z,
  );
}).setLayout({ name: "rkNoise", type: "float", inputs: [io("p", "vec3")] });

/** `rkSoft`: a noise faded to its mean where its wave is under a few pixels. */
const rkSoft = (p: N, wave: number, px: N): N =>
  mix(0.5, rkNoise(p.div(wave)), float(1).sub(smoothstep(0.15, 0.4, px.div(wave))));

/** `rkJoint`: the distance from `u` to the nearest joint of a run. */
const rkJoint: N = Fn(([u, run, lead, keep, skip, second]: N[]) => {
  const c = floor(u).toVar();
  const d = float(4).toVar();
  for (let i = -1; i <= 1; i++) {
    const cc = c.add(i).toVar();
    const h1 = rkHash(vec2(cc, run));
    const a = cc.add(mix(h1.mul(0.8).add(0.1), 0, lead));
    If(rkHash(vec2(cc.add(31.7), keep)).greaterThan(skip), () => {
      d.assign(min(d, abs(u.sub(a))));
    });
    const h2 = rkHash(vec2(cc.add(57.1), run.add(0.5)));
    If(h2.greaterThan(float(1).sub(second)), () => {
      const b = cc.add(0.25).add(rkHash(vec2(run, cc.add(9.3))).mul(0.5));
      d.assign(min(d, abs(u.sub(b))));
    });
  }
  return d;
}).setLayout({
  name: "rkJoint",
  type: "float",
  inputs: [
    io("u", "float"),
    io("run", "float"),
    io("lead", "float"),
    io("keep", "float"),
    io("skip", "float"),
    io("second", "float"),
  ],
});

/** THE VERTEX: calmed (`CALM_COLOUR`, `CALM_NORMAL`), and a talus stone
 * sunk (`TALUS_SINK`). */
function rockVertex(talus: boolean, d: PropDressing): N {
  return Fn(() => {
    const world = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz;
    const calm = smoothstep(CALM_FROM, CALM_TO, distance(world, cameraPosition)).toVar();
    PAINT.assign(mix(attribute("color", "vec3"), attribute("calm", "vec3"), calm));
    CALM.assign(calm);
    normalLocal.assign(
      normalize(mix(attribute("normal", "vec3"), attribute("soft", "vec3"), calm)),
    );
    const p = positionLocal.toVar();
    if (talus) {
      const stone = attribute("stone", "vec4");
      const reach = graftOwn("uTalus", "vec4").x;
      const dist = distance(stone.xyz, cameraPosition);
      const px = stone.w.mul(cameraProjectionMatrix.element(1).y).mul(360).div(max(dist, 1));
      const gone = max(
        smoothstep(reach.mul(0.6), reach, dist),
        float(1).sub(smoothstep(1.5, 3.0, px)),
      );
      const snow = clamp(
        slot(d.haze.uSnowDial, "float").sub(1).mul(0.3).add(slot(d.haze.uFresh, "float")),
        stone.w.mul(-0.1),
        1.5,
      );
      p.y.subAssign(snow.add(gone.mul(stone.w).mul(1.2)));
    }
    return p;
  })();
}

/** AND PULLED TOWARD THE LENS, IN DEPTH ALONE (`PULL_GLSL`). */
const pulled: N = Fn(() => {
  const mv = positionView.toVar();
  const dist = length(mv);
  const pull = clamp(dist.sub(PULL_FROM).mul(PULL), 0, PULL_MOST);
  return cameraProjectionMatrix.mul(vec4(mv.mul(float(1).sub(pull.div(max(dist, 1)))), 1));
});

/** THE ROCK'S OWN MATERIAL (`STRATA_COLOUR`), over the calmed paint
 * `base`: its colour, and the laminae's slope and the haze's keep left in
 * `SLOPE` and `KEEP` for the normal and the output. */
function rockColour(base: N, d: PropDressing): N {
  return Fn(() => {
    const strataV = attribute("strata", "vec3").toVar();
    const vCalm = CALM;
    const stone = graftOwn("uRockStone", "vec3");
    const P = positionWorld.toVar();
    const dpx = dFdx(P).toVar();
    const dpy = dFdy(P).toVar();
    const px = max(length(dpx), length(dpy)).add(1e-4).toVar();
    const F0 = normalize(cross(dpx, dpy)).toVar();
    const F = F0.mul(sign(dot(F0, cameraPosition.sub(P)).add(1e-6))).toVar();
    const lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
    const rock = float(1)
      .sub(smoothstep(0.3, 0.55, lum))
      .toVar();
    const wall = strataV.z.lessThan(-0.5).toVar();
    const mid = float(1).sub(smoothstep(0.08, 0.3, px));
    const winter = float(1).sub(graftOwn("uRockSummer", "float")).toVar();
    const patchy = smoothstep(
      0.3,
      0.72,
      rkSoft(P.mul(vec3(1.0, 2.2, 1.0)).add(3.0), 3.1, px)
        .mul(0.6)
        .add(rkSoft(P.add(17.0), 1.1, px).mul(0.4)),
    ).toVar();
    const near = float(1).sub(vCalm).mul(winter).toVar();
    const col = vec3(base).toVar();
    // Every derivative below is taken before or outside a branch: WebGPU
    // takes one only in uniform control flow.
    const t = strataV.x
      .div(LAYER)
      .add(sin(strataV.y.mul(9.42)).mul(0.18))
      .toVar();
    const dt = vec2(dFdx(t), dFdy(t)).toVar();
    const fwW = abs(dFdx(strataV.x))
      .add(abs(dFdy(strataV.x)))
      .toVar();
    const u = strataV.y.mul(TSL.select(wall, float(1.9), float(2.0))).toVar();
    const fwU = abs(dFdx(u))
      .add(abs(dFdy(u)))
      .add(1e-6)
      .toVar();
    const s0 = float(1).sub(rock).toVar();
    If(wall, () => {
      const eat = near
        .mul(smoothstep(0.35, 0.8, s0))
        .mul(0.5)
        .mul(float(1).sub(patchy))
        .toVar();
      col.assign(mix(col, stone.mul(patchy.mul(0.4).add(0.7)), eat));
      rock.assign(max(rock, eat));
    }).Else(() => {
      const smear = clamp(s0.mul(4).mul(float(1).sub(s0)), 0, 1)
        .mul(near)
        .toVar();
      const want = smoothstep(0.7, 0.92, F.y);
      const s1 = mix(s0, min(s0, want), smear.mul(0.7)).toVar();
      const eat = near
        .mul(smoothstep(0.35, 0.8, s0))
        .mul(0.75)
        .mul(smoothstep(0.75, 0.15, patchy))
        .toVar();
      s1.mulAssign(float(1).sub(eat));
      const bare = clamp(col.sub(SNOW().mul(s0)).div(max(float(1).sub(s0), 0.25)), 0, 1).toVar();
      bare.assign(mix(bare, stone.mul(patchy.mul(0.35).add(0.75)), smoothstep(0.55, 0.9, s0)));
      col.assign(mix(col, mix(bare, SNOW(), s1), min(1, max(smear, eat.mul(2)))));
      rock.assign(float(1).sub(s1));
    });

    // THE LAMINAE, and their analytic bump.
    const fwT = abs(dt.x).add(abs(dt.y)).toVar();
    const lam = float(1)
      .sub(smoothstep(0.04, 0.14, fwT))
      .toVar();
    const L = floor(t).toVar();
    const fl = t.sub(L).toVar();
    const layer = rkHash(vec2(L, 3.1));
    const dh = float(0.035 * 3.14159)
      .mul(cos(fl.mul(3.14159)))
      .mul(lam)
      .mul(lam)
      .mul(rock);
    SLOPE.assign(dt.mul(dh));

    // THE JOINTS: no grid.
    const run = floor(L.mul(0.41).add(sin(L.mul(1.7)).mul(0.3))).toVar();
    const jd = float(0).toVar();
    If(wall, () => {
      jd.assign(rkJoint(u, run, float(0), L, float(0.65), float(0.12)));
    }).Else(() => {
      jd.assign(rkJoint(u, run, float(1), floor(run.div(3)), float(0.22), float(0.38)));
    });
    const jw = TSL.select(wall, float(0.012), float(0)).toVar();
    const crack = float(1)
      .sub(smoothstep(jw.mul(0.4), jw.add(fwU.mul(1.6)), jd))
      .mul(mid)
      .toVar();
    const parting = float(1)
      .sub(smoothstep(0, fwT.add(0.05), min(fl, float(1).sub(fl))))
      .mul(step(TSL.select(wall, float(0.72), float(0.3)), rkHash(vec2(L.add(0.5), 5.3))));
    const tone = mix(
      1,
      layer
        .mul(0.28)
        .add(0.86)
        .mul(float(1).sub(parting.mul(0.2))),
      lam,
    ).toVar();
    tone.mulAssign(float(1).sub(TSL.select(wall, float(0.3), float(0.38)).mul(crack)));
    tone.mulAssign(float(1).sub(smoothstep(-0.04, -0.45, F.y).mul(0.42).mul(float(1).sub(vCalm))));

    // STREAKS down the fall line, RUST, LICHEN — on the steep facets.
    const steep = float(1)
      .sub(smoothstep(0.55, 0.85, F.y))
      .mul(float(1).sub(vCalm))
      .toVar();
    const wet = smoothstep(0.6, 0.85, rkSoft(vec3(P.x, P.y.mul(0.06), P.z), 1.6, px))
      .mul(steep)
      .toVar();
    const rust = smoothstep(0.62, 0.9, rkSoft(vec3(P.x.add(40), P.y.mul(0.23), P.z), 7.7, px)).mul(
      steep,
    );
    const lichen = smoothstep(
      0.6,
      0.78,
      rkSoft(P.add(23.0), 2.7, px)
        .mul(0.6)
        .add(rkSoft(P.zxy.mul(1.3).add(7.0), 1.1, px).mul(0.4)),
    ).mul(float(1).sub(wet));
    const orange = smoothstep(0.55, 0.75, rkNoise(P.mul(0.11).add(5.0)));
    const c = col.toVar();
    const rk = c
      .mul(tone)
      .mul(float(1).sub(wet.mul(0.22)))
      .toVar();
    rk.assign(mix(rk, rk.mul(vec3(1.25, 1.0, 0.78)), rust.mul(0.3)));
    rk.assign(
      mix(rk, rk.mul(mix(vec3(1.0, 1.1, 0.9), vec3(1.3, 1.02, 0.7), orange)), lichen.mul(0.3)),
    );
    c.assign(mix(c, rk, rock));

    // THE BEDS AS TONE where the facets are calmed away (the skin alone).
    const strata = graftOwn("uStrata", "vec4");
    If(wall.not().and(strata.w.greaterThan(0.5)).and(vCalm.greaterThan(0)), () => {
      const b = stBands(graftOwn("uStSeed", "uint"), strata.z, strataV.x, fwW).toVar();
      const even = strataV.z;
      const spread = even.mul(Number(FAR_EVEN.toFixed(2))).toVar();
      const bare = clamp(c.sub(SNOW().mul(spread)).div(max(float(1).sub(spread), 0.08)), 0, 1);
      const banded = stFar(bare, SNOW(), even, b, winter, distance(P, cameraPosition));
      c.assign(mix(c, banded, vCalm));
    });

    // RIME on the windward facets and the NEW SNOW dusting what lies back.
    const windward = clamp(dot(F.xz, graftOwn("uRockWind", "vec2")).negate(), 0, 1);
    const ledgeTop = TSL.select(
      wall,
      smoothstep(0.78, 0.98, fl)
        .mul(lam)
        .add(smoothstep(0.15, 0.6, F.y)),
      float(0),
    ).toVar();
    const rime = smoothstep(0.5, 0.9, windward.add(ledgeTop.mul(0.25)))
      .mul(
        smoothstep(
          0.42,
          0.78,
          rkSoft(P.add(2.0), 1.7, px)
            .mul(0.6)
            .add(rkSoft(P, 6.7, px).mul(0.6))
            .add(ledgeTop.mul(0.25)),
        ),
      )
      .mul(winter);
    const lies = smoothstep(0.25, 0.6, F.y).toVar();
    const dust = clamp(slot(d.haze.uFresh, "float").mul(5), 0, 0.4)
      .mul(patchy.mul(0.7).add(0.3))
      .mul(smoothstep(0.4, 0.75, rkSoft(P.add(11.0), 0.48, px).add(lies.mul(0.3))))
      .mul(lies.mul(0.65).add(0.35))
      .mul(winter);
    const cover = clamp(TSL.select(wall, float(0.6), float(0.45)).mul(rime).add(dust), 0, 0.7)
      .mul(patchy.mul(0.55).add(0.45))
      .mul(rock)
      .mul(float(1).sub(vCalm.mul(0.8)))
      .toVar();
    SLOPE.mulAssign(float(1).sub(cover));
    KEEP.assign(stHazeKeep(distance(P, cameraPosition)));
    return mix(c, RIME(), cover);
  })();
}

/** THE NORMAL tipped off the facet's by the laminae's slope
 * (`STRATA_NORMAL`), in view space. */
const tipped: N = Fn(() => {
  const n = normalView.toVar();
  const sx = dFdx(positionView).toVar();
  const sy = dFdy(positionView).toVar();
  const r1 = cross(sy, n).toVar();
  const r2 = cross(n, sx).toVar();
  const det = dot(sx, r1).mul(faceDirection).toVar();
  const grad = sign(det).mul(r1.mul(SLOPE.x).add(r2.mul(SLOPE.y)));
  return normalize(abs(det).mul(n).sub(grad));
});

/** Finish the copy of a rock's (`talus`: the talus's) material. */
export function rockGraft(
  copy: NodeMaterial,
  material: THREE.Material,
  talus: boolean,
  d: PropDressing,
): void {
  const c = copy as NodeMaterial & Record<string, unknown>;
  c.vertexColors = false;
  c.positionNode = rockVertex(talus, d);
  c.vertexNode = pulled();
  c.colorNode = vec4(rockColour(materialColor.rgb.mul(PAINT), d), 1);
  c.normalNode = tipped();
  c.maskNode = insideWall(d.haze); // `PAST_THE_WALL`
  // Hazed here, the bare stone keeping its share of its own colour.
  c.fog = false;
  const base = Object.getPrototypeOf(copy) as {
    setupOutput(builder: NodeBuilder, out: N): N;
  };
  c.setupOutput = function (this: NodeMaterial, builder: NodeBuilder, out: N): N {
    // The lit colour made in the main flow, before the haze's branches read
    // it (`terrain-tsl.ts`'s `setupOutput`).
    const lit = vec4(out).toVar("rockLit");
    const hazed = hazeOver(d.haze, d.how, lit.rgb, positionWorld, { keep: KEEP });
    return base.setupOutput.call(this, builder, vec4(hazed, lit.a));
  };
  // A draw's uniforms are refreshed in full only for a material with a
  // node of its own, and the material three checks is `material`.
  (material as unknown as { graftNode: N }).graftNode = c.colorNode;
}
