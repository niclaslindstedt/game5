// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SUMMER'S GRASS ON THE NODE RENDERER (`docs/webgpu.md`, part 13):
// `summer-grass.ts`'s vertex restated in TSL on the copy of its material,
// term for term with the GLSL — each tuft stood on the world's own grid
// round the lens, the ground it stands on read off the terrain's own maps
// (what grows there, how tall), thinned with distance, the flowers, the
// wind, its normal the ground's, its colour the meadow's — and both faces
// lit alike.
//
// The vertex reads its maps at their first level (a vertex stage has no
// footprint), the heights by texel. Every uniform is the material drawn's
// own (`userData.graftOwn`: the terrain's shared maps and palette and the
// patch's own), each map re-pointed every draw.

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { graftOwn } from "./figure-tsl.ts";
import type { N } from "./haze-tsl.ts";
import { LOOSE } from "./trail-stamp.ts";

const {
  Fn,
  If,
  attribute,
  clamp,
  cos,
  distance,
  dot,
  float,
  floor,
  fract,
  ivec2,
  length,
  max,
  min,
  mix,
  normalLocal,
  normalViewGeometry,
  normalize,
  positionGeometry,
  select,
  sin,
  smoothstep,
  step,
  texture,
  textureLoad,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const io = (name: string, type: string) => ({ name, type });

/** The tuft's colour, for the fragment (`vGrassCol`). */
const COLOUR: N = varyingProperty("vec3", "vGrassCol");

/** Map `name` of the drawn material's own uniforms, re-pointed every draw. */
function ownMap(material: THREE.Material, name: string): N {
  const own = material.userData.graftOwn as Record<string, { value: THREE.Texture }>;
  return texture(own[name].value).onObjectUpdate(({ object }: { object: THREE.Mesh }) => {
    const m = object.material as THREE.Material;
    return (m.userData.graftOwn as Record<string, { value: THREE.Texture }>)[name].value;
  });
}

/** `grassHash`. */
const grassHash: N = Fn(([q]: N[]) => {
  const p = fract(q.mul(vec2(123.34, 456.21))).toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return fract(p.x.mul(p.y));
}).setLayout({ name: "grassHash", type: "float", inputs: [io("p", "vec2")] });

/** `grassNoise`. */
const grassNoise: N = Fn(([p]: N[]) => {
  const i = floor(p).toVar();
  const f = fract(p).toVar();
  const u = f
    .mul(f)
    .mul(float(3).sub(f.mul(2)))
    .toVar();
  return mix(
    mix(grassHash(i), grassHash(i.add(vec2(1, 0))), u.x),
    mix(grassHash(i.add(vec2(0, 1))), grassHash(i.add(vec2(1, 1))), u.x),
    u.y,
  );
}).setLayout({ name: "grassNoise", type: "float", inputs: [io("p", "vec2")] });

/** THE TUFT (`GRASS_VERTEX_BEGIN`): where it stands, how tall, its normal
 * and colour, and the blade's vertex. */
function grassVertex(material: THREE.Material): N {
  const heights = ownMap(material, "uHeight");
  const ground = ownMap(material, "uGround");
  const summerA = ownMap(material, "uSummerA");
  const summerB = ownMap(material, "uSummerB");
  return Fn(() => {
    const own = graftOwn;
    const patch = own("uGrassPatch", "vec4").toVar();
    const eye = own("uGrassEye", "vec2");
    const band2 = own("uGrassBand", "vec2");
    const wind = own("uGrassWind", "vec4");
    const time = own("uGrassTime", "float");
    const origin = own("uHeightOrigin", "vec2");
    const count = own("uHeightCount", "vec2");
    const cell = own("uCell", "float");
    const bands = own("uSummerBands", "vec3");
    const shares = own("uSumShares", "vec2");
    const blade = attribute("aBlade", "vec4").toVar();
    const position = positionGeometry;
    const size = patch.x;
    const span = patch.y.mul(size).toVar();
    const low = eye.sub(span.mul(0.5)).toVar();
    const local = attribute("aCell", "vec2").add(0.5).mul(size);
    const rel = local.sub(low);
    const at = low.add(rel.sub(floor(rel.div(span)).mul(span))).toVar();
    const id = floor(at.div(size)).toVar();
    const h1 = grassHash(id.mul(0.731).add(3.1)).toVar();
    const h2 = grassHash(id.mul(1.37).add(7.7)).toVar();
    const h3 = grassHash(id.mul(0.519).add(1.3)).toVar();
    at.addAssign(vec2(h1, h2).sub(0.5).mul(size).mul(0.9));
    const dist = distance(at, eye).toVar();
    const guv = at.sub(origin).add(cell.mul(0.5)).div(count.mul(cell));
    const g = ground.sample(guv).level(0).setUpdateMatrix(false).toVar();
    const suv = at.div(own("uSummerSize", "vec2"));
    const sA = summerA.sample(suv).level(0).setUpdateMatrix(false).toVar();
    const sB = summerB.sample(suv).level(0).setUpdateMatrix(false).toVar();
    // `grassHeight`: the heights by texel, bilinear by hand.
    const f = clamp(at.sub(origin).div(cell), vec2(0), count.sub(1.001)).toVar();
    const c = ivec2(floor(f)).toVar();
    const t = f.sub(floor(f)).toVar();
    const hAt = (dx: number, dy: number): N =>
      textureLoad(heights, c.add(ivec2(dx, dy))).setUpdateMatrix(false).r;
    const height = mix(mix(hAt(0, 0), hAt(1, 0), t.x), mix(hAt(0, 1), hAt(1, 1), t.x), t.y);
    const gy = height
      .add(
        float(1)
          .sub(max(g.b, 0))
          .mul(Number(LOOSE.toFixed(3))),
      )
      .toVar();
    const slope = length(g.rg);
    const above = smoothstep(
      bands.y.sub(20),
      bands.y.add(30),
      gy.add(grassNoise(at.mul(0.02)).sub(0.5).mul(60)),
    ).toVar();
    // What grows here, 0 nothing .. 1 a full tuft.
    const grow = float(1)
      .sub(smoothstep(0.25, 0.45, max(max(sA.r, sA.g), max(sA.b, sA.a))))
      .mul(float(1).sub(smoothstep(0.3, 0.6, sB.a)))
      .mul(float(1).sub(smoothstep(0.6, 0.85, slope)))
      .mul(float(1).sub(smoothstep(0.3, 0.8, g.a).mul(0.75)))
      .mul(float(1).sub(smoothstep(0.3, 0.6, sB.b).mul(0.7)));
    const keep = patch.w
      .mul(float(1).sub(smoothstep(patch.z.mul(0.3), patch.z, dist)))
      .mul(smoothstep(band2.x, band2.x.add(3), dist))
      .mul(float(1).sub(smoothstep(band2.y.sub(3), band2.y, dist)));
    const alive = step(h3, keep).mul(grow);
    const clump = grassNoise(at.mul(0.35));
    const tall = mix(0.18, 0.5, clump)
      .mul(mix(1, 0.4, smoothstep(0.3, 0.7, sB.r)))
      .mul(mix(1, 0.45, above))
      .mul(mix(0.6, 1.25, h1))
      .mul(alive)
      .toVar();
    tall.assign(min(tall, 0.85).mul(float(1).sub(smoothstep(patch.z.mul(0.35), patch.z, dist))));
    // THE FLOWERS.
    const band = clamp(gy.sub(bands.x).div(max(bands.y.sub(bands.x), 1)), 0, 1).toVar();
    const bloom = float(0.05).add(
      shares.y.mul(band.add(0.5)).mul(smoothstep(0.35, 0.75, grassNoise(at.mul(0.08).add(5)))),
    );
    const isFlower = blade.w.lessThan(0).toVar();
    const flower = select(
      isFlower,
      step(h2, bloom.mul(float(1).sub(above.mul(0.6)))),
      float(1),
    ).toVar();
    // THE WIND.
    const dir = wind.xy;
    const gust = grassNoise(at.mul(0.08).sub(dir.mul(time).mul(0.6)));
    const sway = gust.mul(0.65).add(0.35).mul(wind.z).toVar();
    const lean = blade.z.mul(blade.z).toVar();
    const swing = dir
      .mul(sway)
      .mul(0.6)
      .add(
        vec2(sin(time.mul(2.3).add(h1.mul(6.28))), cos(time.mul(1.9).add(h2.mul(6.28))))
          .mul(0.08)
          .mul(sway.add(0.3)),
      )
      .toVar();
    const turn = h3.mul(6.2831).toVar();
    const ct = cos(turn);
    const st = sin(turn);
    const wide = select(isFlower, float(1), mix(1, 1.6, step(0.5, size)));
    const q = position.xz.mul(wide).toVar();
    // GLSL's `mat2(c, -s, s, c) * q`, its columns (c, -s) and (s, c).
    const off = vec2(ct.mul(q.x).add(st.mul(q.y)), st.negate().mul(q.x).add(ct.mul(q.y))).mul(
      step(0.001, tall.mul(flower)),
    );
    const xz = at.add(off).add(swing.mul(lean).mul(tall));
    const y = gy.add(
      position.y
        .mul(tall)
        .mul(flower)
        .mul(float(1).sub(dot(swing, swing).mul(0.25).mul(lean))),
    );
    normalLocal.assign(normalize(vec3(g.r.negate(), 1, g.g.negate())));
    // THE COLOUR.
    const base = mix(
      own("uSumLow", "vec3"),
      own("uSumHigh", "vec3"),
      smoothstep(0.15, 0.95, band),
    ).toVar();
    base.assign(mix(base, own("uSumTop", "vec3"), above));
    base.assign(
      mix(
        base,
        own("uSumDry", "vec3"),
        shares.x.mul(smoothstep(0.45, 0.8, grassNoise(at.mul(0.0103).add(17)))).mul(0.7),
      ),
    );
    base.mulAssign(mix(0.85, 1.2, h2).mul(mix(0.78, 1.18, blade.z)));
    // Settled by `If` and assignment: a select inside a select can fail on
    // the GL fallback.
    const petal = vec3(0.25, 0.35, 0.8).toVar();
    If(h1.lessThan(0.92), () => {
      petal.assign(vec3(0.45, 0.25, 0.6));
    });
    If(h1.lessThan(0.8), () => {
      petal.assign(vec3(0.85, 0.65, 0.08));
    });
    If(h1.lessThan(0.6), () => {
      petal.assign(vec3(0.82, 0.82, 0.74));
    });
    COLOUR.assign(select(isFlower, petal, base));
    return vec3(xz.x, y, xz.y);
  })();
}

/** Finish the copy of a patch's material. */
export function grassGraft(copy: NodeMaterial, material: THREE.Material): void {
  const c = copy as NodeMaterial & Record<string, unknown>;
  c.positionNode = grassVertex(material);
  c.colorNode = vec4(COLOUR, 1);
  // Both faces lit alike: a blade's back is the same grass.
  c.normalNode = normalViewGeometry;
  (material as unknown as { graftNode: N }).graftNode = c.colorNode;
}
