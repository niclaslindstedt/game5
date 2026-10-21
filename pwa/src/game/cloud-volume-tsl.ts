// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HIGH'S CLOUD ON THE NODE RENDERER (`docs/webgpu.md`, part 10): the node
// twins of `cloud-volume.ts`'s three passes — the FRESH march (a pixel of
// every block, its cloud and its light's distance into two attachments at
// once), the WHOLE march on a cut, and the CARRY that keeps the rest of the
// picture through the lens's move — over `cloud-volume-glsl.ts`'s volume
// (the layers as shells round the planet, the Perlin-Worley carve, the
// light toward the sun, the powder and the deck's floor), restated term
// for term. Every uniform is the ShaderMaterial's own, read by reference,
// so `cloud-volume.ts` drives both back ends.
//
// THE NOISE: the shape's 64³ and the detail's 32³ are read off 2D atlases
// (`cloud-shell-tsl.ts`'s `noiseAtlas`), as the field's is: SwiftShader's
// Dawn refuses every write into a 3D texture. Every read is at the sheet's
// first level, so the march's branches never leave a read in non-uniform
// flow.
//
// THE LAYOUT is `cloud-pass-tsl.ts`'s: `screenCoordinate` stands where WebGL's
// `gl_FragCoord` stands against the reads, so the block's phase, the jitter
// and the kept picture's texels are WebGL's. The carry reads the fresh
// marches by sampling at texel centres rather than fetching (WebGL's
// `texelFetch`): a sampled read is the one whose rows the node renderer
// keeps the same on both of its back ends.

import type * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { CLOUD_LAYERS } from "./cloud-field.ts";
import { cloudPass, viewAt } from "./cloud-pass-tsl.ts";
import {
  cloudAir,
  cloudColumn,
  cloudLayerShell,
  cloudNoise,
  cloudSlots,
  hg,
  noiseAtlas,
  packLayers,
  readNoise,
  type CloudSlots,
} from "./cloud-shell-tsl.ts";
import type { CloudUniforms } from "./clouds.ts";
import type { HazeUniforms } from "./haze.ts";
import { hazeSlots, skyColour, slot, standIn, tap, texSlot, type N } from "./haze-tsl.ts";

// Read untyped, as every node here is (`haze-tsl.ts`'s `N`).
const {
  Break,
  Continue,
  Fn,
  If,
  Loop,
  abs,
  all,
  any,
  clamp,
  dot,
  exp,
  float,
  floor,
  fract,
  greaterThan,
  int,
  length,
  lessThan,
  max,
  min,
  mix,
  outputStruct,
  screenCoordinate,
  select,
  smoothstep,
  sqrt,
  vec2,
  vec3,
  vec4,
} = TSL as N;

type U = Record<string, THREE.IUniform>;

/** How far the shape's noise moves a column's edge (`WALL`). */
const WALL = 0.07;
const f5 = (x: number): number => Number(x.toFixed(5));

/** The volume's slots over its material's uniforms. */
type VolSlots = ReturnType<typeof volSlots>;
function volSlots(u: U) {
  const shape = noiseAtlas(u.uVolShape.value as THREE.Data3DTexture);
  const detail = noiseAtlas(u.uVolDetail.value as THREE.Data3DTexture);
  type Arr = { value: THREE.Vector4[] };
  const [A, B, C, sunLo, sunHi] = packLayers([
    u.uVolA,
    u.uVolB,
    u.uVolC,
    u.uCloudSunLo,
    u.uCloudSunHi,
  ] as unknown as Arr[]);
  return {
    shape,
    detail,
    shapeSheet: TSL.texture(shape.tex) as N,
    detailSheet: TSL.texture(detail.tex) as N,
    A,
    B,
    C,
    sunLo,
    sunHi,
    moon: slot(u.uCloudMoon, "vec3"),
    earth: slot(u.uEarth, "vec4"),
  };
}

const remap = (x: N, a: N, b: N, c: number, d: number): N =>
  x
    .sub(a)
    .div(max(b.sub(a), 1e-4))
    .mul(d - c)
    .add(c);

/** A point's height over the curving ground's plane (`volHeight`). */
function volHeight(v: VolSlots, p: N): N {
  const s = p.xz.sub(v.earth.xy);
  return p.y.add(dot(s, s).mul(v.earth.z));
}

/** Where the view crosses the shell at height `H` (`volCross`): sorted
 * roots, x > y where it never does. */
function volCross(v: VolSlots, e: N, d: N, H: N): N {
  const out = vec2(1, -1).toVar();
  const o = e.xz.sub(v.earth.xy);
  const A = dot(d.xz, d.xz).mul(v.earth.z).toVar();
  const B = d.y.add(dot(o, d.xz).mul(2).mul(v.earth.z)).toVar();
  const C = volHeight(v, e).sub(H).toVar();
  const disc = B.mul(B).sub(A.mul(C).mul(4)).toVar();
  If(disc.greaterThanEqual(0), () => {
    const q = B.add(select(B.greaterThanEqual(0), float(1), float(-1)).mul(sqrt(disc)))
      .mul(-0.5)
      .toVar();
    const r1 = select(
      abs(A).greaterThan(1e-12),
      q.div(A),
      select(q.greaterThanEqual(0), float(1e9), float(-1e9)),
    );
    const r2 = select(abs(q).greaterThan(1e-9), C.div(q), float(0));
    out.assign(vec2(min(r1, r2), max(r1, r2)));
  });
  return out;
}

/** THE RUN THROUGH A LAYER from `yb` to `yt` (`volShell`). */
function volShell(v: VolSlots, e: N, d: N, yb: N, yt: N): N {
  const out = vec2(1, 0).toVar();
  const h = volHeight(v, e).toVar();
  const rb = volCross(v, e, d, yb).toVar();
  const rt = volCross(v, e, d, yt).toVar();
  const hitsBase = rb.x.lessThanEqual(rb.y).and(rb.x.greaterThan(0));
  If(h.lessThan(yb), () => {
    out.assign(vec2(max(rb.y, 0), max(rt.y, 0)));
  })
    .ElseIf(h.lessThanEqual(yt), () => {
      out.assign(select(hitsBase, vec2(0, rb.x), vec2(0, max(rt.y, 0))));
    })
    .Else(() => {
      const misses = rt.x.greaterThan(rt.y).or(rt.y.lessThanEqual(0));
      const out1 = select(hitsBase, rb.x, rt.y);
      out.assign(select(misses, vec2(1, 0), vec2(max(rt.x, 0), out1)));
    });
  return out;
}

/** THE DENSITY of layer `i` at `p` (`volDensity`): `dens`, and `k` how far
 * up its column the point stands (−1 where no column stands). `bite` the
 * detail's share at the march's distance (`volBiteK`); null for the
 * light's reads, which take no detail. */
function volDensity(
  c: CloudSlots,
  v: VolSlots,
  i: N,
  p: N,
  hm: N,
  bite: N | null,
): { dens: N; k: N } {
  const dens = float(0).toVar();
  const k = float(-1).toVar();
  const A = c.A.element(i);
  const VA = v.A.element(i);
  const n = cloudNoise(c, i, p.xz).toVar();
  const most = cloudColumn(c, i, n.add(f5(WALL)));
  If(most.y.sub(most.x).greaterThan(0.002), () => {
    k.assign(0);
    const off = n.sub(0.5).mul(vec2(0.83, -0.61)).div(VA.x).toVar();
    const q = vec3(p.x.add(off.x), hm.mul(A.y).add(A.x), p.z.add(off.y)).toVar();
    const s = readNoise(v.shape, v.shapeSheet, q.mul(VA.x).add(v.B.element(i).xyz)).toVar();
    const fbm = s.g.mul(0.625).add(s.b.mul(0.25)).add(s.a.mul(0.125)).toVar();
    const col = cloudColumn(c, i, n.add(fbm.sub(0.55).mul(f5(2 * WALL)))).toVar();
    const span = col.y.sub(col.x).toVar();
    If(span.greaterThan(0.002), () => {
      const kk = hm.sub(col.x).div(span).toVar();
      If(kk.greaterThan(0).and(kk.lessThan(1)), () => {
        k.assign(kk);
        const dome = c.C.element(i).w;
        const lo = smoothstep(0, mix(0.3, 0.07, dome), kk);
        const hi = smoothstep(1, mix(0.6, 0.45, dome), kk);
        const inside = lo
          .mul(hi)
          .mul(smoothstep(0, 0.45, span))
          .toVar();
        const shape = clamp(remap(s.r, fbm.sub(1), float(1), 0, 1), 0, 1);
        dens.assign(clamp(remap(shape, float(1).sub(inside), float(1), 0, 1), 0, 1));
        if (bite) {
          If(dens.greaterThan(0), () => {
            const dt = readNoise(v.detail, v.detailSheet, q.mul(VA.y).add(v.C.element(i).xyz));
            const dn0 = dt.r.mul(0.625).add(dt.g.mul(0.25)).add(dt.b.mul(0.125)).toVar();
            const dn = mix(float(1).sub(dn0), dn0, clamp(kk.mul(4), 0, 1));
            dens.assign(clamp(remap(dens, dn.mul(VA.w).mul(bite), float(1), 0, 1), 0, 1));
          });
        }
      });
    });
  });
  return { dens, k };
}

/** THE SUN THROUGH THE CLOUD from `p` (`volOdToSun`). */
function volOdToSun(
  c: CloudSlots,
  v: VolSlots,
  light: number,
  i: N,
  p: N,
  L: N,
  yb: N,
  depth: N,
  sigma: N,
  step: N,
): N {
  const od = float(0).toVar();
  const t = float(0).toVar();
  const dt = float(step).toVar();
  const mean = float(0).toVar();
  const hq = float(0).toVar();
  const left = float(0).toVar();
  Loop({ start: 0, end: light, type: "int", name: "j" }, () => {
    t.addAssign(dt);
    const q = p.add(L.mul(t.sub(dt.mul(0.5)))).toVar();
    hq.assign(volHeight(v, q).sub(yb).div(depth));
    If(hq.lessThan(-0.05).or(hq.greaterThan(1.05)), () => {
      left.assign(1);
      Break();
    });
    const dq = volDensity(c, v, i, q, hq, null).dens;
    od.addAssign(sigma.mul(dq).mul(dt));
    mean.addAssign(dq.div(light));
    dt.mulAssign(1.9);
  });
  const rest = select(
    L.y.greaterThanEqual(0),
    float(1).sub(hq).mul(depth).div(max(L.y, 0.03)),
    hq.mul(depth).div(max(L.y.negate(), 0.15)),
  );
  const B = v.B.element(i);
  const deck = smoothstep(0.55, 0.95, B.w);
  const on = od.add(
    sigma
      .mul(max(mean, B.w.mul(0.4)))
      .mul(deck)
      .mul(min(rest, 30000)),
  );
  return select(left.greaterThan(0.5), od, on);
}

/** ONE LAYER MARCHED (`cloudLayerVolume`): premultiplied colour and the
 * share hidden, and the distance its light comes from. */
function cloudLayerVolume(
  c: CloudSlots,
  v: VolSlots,
  steps: number,
  light: number,
  i: N,
  e: N,
  d: N,
  L: N,
  sky: N,
  jit: N,
): { colour: N; dist: N } {
  const colour = vec4(0).toVar();
  const dist = float(0).toVar();
  const A = c.A.element(i);
  const yb = A.x.toVar();
  const depth = A.y.toVar();
  const run = volShell(v, e, d, yb, yb.add(depth)).toVar();
  const t0 = run.x.toVar();
  If(run.y.greaterThan(run.x).and(t0.lessThanEqual(120000)), () => {
    const t1 = min(run.y, t0.add(30000)).toVar();
    const sigma = A.w.div(depth).mul(1.6).toVar();
    const mu = dot(d, L).toVar();
    const phase = hg(mu, 0.75).mul(0.12).add(0.75).add(hg(mu, -0.25).mul(0.25)).toVar();
    const phase2 = hg(mu, 0.4).mul(0.06).add(0.8).toVar();
    const powderOn = float(0.5).sub(mu.mul(0.5)).toVar();
    const lightStep = clamp(depth.mul(0.04), 15, 60).toVar();
    const B = v.B.element(i);
    const deck = smoothstep(0.55, 0.95, B.w).toVar();
    const odS = A.w
      .mul(0.12 * 0.3)
      .div(max(abs(L.y), 0.06))
      .toVar();
    const slabT = mix(
      exp(odS.mul(-0.2)).mul(0.3),
      max(exp(odS.negate()), exp(odS.mul(-0.2)).mul(0.3)),
      smoothstep(-0.05, 0.05, L.y),
    ).toVar();
    const acc = vec3(0).toVar();
    const T = float(1).toVar();
    const wsum = float(0).toVar();
    const least = max(depth.div(20), 25).toVar();
    const t = t0.add(max(least, t0.mul(0.03)).mul(jit)).toVar();
    const lo = v.sunLo.element(i);
    const hi = v.sunHi.element(i);
    const base = c.base.element(i);
    const top = c.top.element(i);
    Loop({ start: 0, end: steps, type: "int", name: "k" }, () => {
      If(t.greaterThan(t1), () => {
        Break();
      });
      const dt = max(least, t.mul(0.03)).toVar();
      const p = e.add(d.mul(t)).toVar();
      const tc = t.toVar();
      const hm = volHeight(v, p).sub(yb).div(depth).toVar();
      const bite = smoothstep(30000, 3000, t).toVar();
      const got = volDensity(c, v, i, p, hm, bite);
      const dens = got.dens.toVar();
      const kc = got.k.toVar();
      t.addAssign(select(kc.lessThan(0), dt.mul(2.5), dt));
      If(dens.lessThanEqual(0), () => {
        Continue();
      });
      const od = volOdToSun(c, v, light, i, p, L, yb, depth, sigma, lightStep).toVar();
      const beer = exp(od.negate())
        .add(
          exp(od.mul(-0.3))
            .mul(0.45)
            .add(exp(od.mul(-0.1)).mul(0.12))
            .mul(phase2)
            .div(phase),
        )
        .toVar();
      beer.assign(max(beer, float(0.8).div(od.mul(0.19).add(1).mul(phase))));
      const powder = mix(
        float(1),
        float(1).sub(exp(sigma.negate().mul(dens).mul(120))),
        powderOn,
      ).toVar();
      const kl = clamp(hm, 0, 1).toVar();
      beer.assign(
        max(beer, deck.mul(slabT).mul(kl.mul(0.6).add(0.75)).div(max(powder, 0.25).mul(0.75))),
      );
      const ka = mix(kl, kl.mul(0.45).add(0.55), deck);
      const sun = max(mix(lo, hi, ka).sub(v.moon), 0);
      const amb = mix(base, top, ka)
        .mul(mix(kc, kc.mul(0.45).add(0.55), deck).mul(0.28).add(0.72))
        .add(v.moon.mul(kl.mul(0.3).add(0.3)));
      const lit = sun.mul(beer).mul(phase).mul(powder).mul(0.75).add(amb);
      const a = float(1)
        .sub(exp(sigma.negate().mul(dens).mul(dt)))
        .toVar();
      const air = cloudAir(c, tc, e.y.sub(c.seaLevel), p.y.sub(c.seaLevel)).toVar();
      const w = T.mul(a).toVar();
      acc.addAssign(w.mul(lit.mul(air).add(sky.mul(vec3(1).sub(air)))));
      dist.addAssign(w.mul(tc));
      wsum.addAssign(w);
      T.mulAssign(float(1).sub(a));
      If(T.lessThan(0.01), () => {
        Break();
      });
    });
    dist.assign(select(wsum.greaterThan(0), dist.div(max(wsum, 1e-30)), float(0)));
    const fade = smoothstep(120000, 60000, t0);
    colour.assign(vec4(acc, float(1).sub(T)).mul(fade));
  });
  return { colour, dist };
}

/** EVERY LAYER along the view (`volStack`): the marched ones and the
 * shell's read for the thin ice; and the stack's light's distance. */
function volStack(
  c: CloudSlots,
  v: VolSlots,
  steps: number,
  light: number,
  e: N,
  d: N,
  L: N,
  sky: N,
  jit: N,
): { colour: N; dist: N } {
  const acc = vec4(0).toVar();
  const dsum = float(0).toVar();
  const wsum = float(0).toVar();
  const n = int(c.on.x.add(0.5)).toVar();
  Loop({ start: 0, end: CLOUD_LAYERS, type: "int", name: "k" }, ({ k }: { k: N }) => {
    If(k.greaterThanEqual(n), () => {
      Break();
    });
    const i = select(d.y.greaterThanEqual(0), k, n.sub(1).sub(k)).toVar();
    const one = vec4(0).toVar();
    const di = float(0).toVar();
    If(v.A.element(i).z.greaterThan(0.5), () => {
      const got = cloudLayerVolume(c, v, steps, light, i, e, d, L, sky, jit);
      one.assign(got.colour);
      di.assign(got.dist);
    }).Else(() => {
      one.assign(cloudLayerShell(c, i, e, d, L, sky));
      const A = c.A.element(i);
      const mid = A.x.add(A.y.mul(0.5));
      const dy = select(abs(d.y).greaterThan(1e-3), d.y, float(1e-3));
      di.assign(abs(mid.sub(e.y).div(dy)));
    });
    const w = float(1).sub(acc.a).mul(one.a).toVar();
    dsum.addAssign(w.mul(di));
    wsum.addAssign(w);
    const keep = float(1).sub(acc.a);
    acc.assign(vec4(acc.rgb.add(keep.mul(one.rgb)), acc.a.add(keep.mul(one.a))));
  });
  const dist = select(wsum.greaterThan(1e-4), dsum.div(max(wsum, 1e-4)), float(1e5));
  return { colour: acc.mul(c.on.y), dist };
}

/** What a march hands its outputs: the cloud and its light's distance. */
const Marched = TSL.struct({ cloud: "vec4", dist: "float" }, "CloudMarched") as N;

/** THE MARCH (`MARCH`): the fresh share of a frame into the cloud and its
 * distance, or with `whole` every pixel of the kept picture. */
export function marchTwin(m: THREE.ShaderMaterial, haze: HazeUniforms): NodeMaterial {
  const u = m.uniforms as U;
  const steps = Number(m.defines.STEPS);
  const light = Number(m.defines.LIGHT);
  const whole = m.defines.WHOLE !== undefined;
  const c = cloudSlots(u as unknown as CloudUniforms);
  const v = volSlots(u);
  const s = hazeSlots(haze);
  const invViewProj = slot(u.uInvViewProj, "mat4");
  const eye = slot(u.uEye, "vec3");
  const keepSize = slot(u.uKeep, "vec2");
  const phase = slot(u.uPhase, "vec2");
  const block = slot(u.uBlock, "float");
  const frame = slot(u.uFrame, "float");
  const frag = Fn(() => {
    const px = floor(screenCoordinate).toVar();
    const kp = (whole ? px : px.mul(block).add(phase)).toVar();
    const d = viewAt(invViewProj, eye, kp.add(0.5).div(keepSize)).toVar();
    // An interleaved gradient over the screen, turned on by the golden
    // ratio a frame (`volJitter`).
    const jit = fract(
      fract(dot(kp, vec2(0.06711056, 0.00583715)))
        .mul(52.9829189)
        .add(frame.mul(0.618034)),
    );
    const got = volStack(c, v, steps, light, eye, d, s.sunPos, skyColour(s, d), jit);
    const cloud = got.colour.toVar();
    const dist = got.dist.toVar();
    // A pixel the march could not settle is left clear rather than carried
    // on as a hole for sixteen frames.
    const ok = all(lessThan(abs(cloud), vec4(1e20))).and(abs(dist).lessThan(1e20));
    return Marched(select(ok, cloud, vec4(0)), select(ok, dist, float(1e5)));
  });
  // The march is made once and read twice: a stage's output must be the
  // output struct itself, never a function returning one.
  const out = frag();
  const cloud = out.get("cloud");
  const node = whole ? cloud : outputStruct(cloud, vec4(out.get("dist").mul(0.001), 0, 0, 1));
  return cloudPass(whole ? `cloud-whole-${steps}` : `cloud-fresh-${steps}`, m, node);
}

const NO_PICTURE = standIn();

/** THE CARRY (`CARRY`): every pixel of the kept picture, the fresh ones
 * as they are and the rest found on the last picture. */
export function carryTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const u = m.uniforms as U;
  const pic = (k: string) => texSlot(u[k] as { value: THREE.Texture | null }, NO_PICTURE);
  const fresh = pic("uFresh");
  const freshDist = pic("uFreshDist");
  const history = pic("uHistory");
  const invViewProj = slot(u.uInvViewProj, "mat4");
  const prevVP = slot(u.uPrevVP, "mat4");
  const eye = slot(u.uEye, "vec3");
  const keepSize = slot(u.uKeep, "vec2");
  const freshSize = slot(u.uFreshSize, "vec2");
  const phase = slot(u.uPhase, "vec2");
  const block = slot(u.uBlock, "float");
  const frag = Fn(() => {
    const px = floor(screenCoordinate).toVar();
    const cell = floor(px.div(block)).toVar();
    const top = freshSize.sub(1);
    const marched = all(px.sub(cell.mul(block)).equal(phase));
    // A fresh texel's centre, read as WebGL's `texelFetch` reads it.
    const at = (t: N, q: N): N => tap(t, q.add(0.5).div(freshSize)).level(0);
    const fuv = px.sub(phase).div(block).add(0.5).div(freshSize);
    const own = select(marched, at(fresh.tex, cell), tap(fresh.tex, fuv).level(0)).toVar();
    const lo = vec4(1e9).toVar();
    const hi = vec4(-1e9).toVar();
    const near = float(1e9).toVar();
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++) {
        const q = clamp(cell.add(vec2(x, y)), vec2(0), top);
        const cq = at(fresh.tex, q).toVar();
        lo.assign(min(lo, cq));
        hi.assign(max(hi, cq));
        near.assign(min(near, at(freshDist.tex, q).r));
      }
    // Where this pixel's cloud stood on the last picture.
    const uv = px.add(0.5).div(keepSize).toVar();
    const d = viewAt(invViewProj, eye, uv);
    const was = prevVP.mul(vec4(eye.add(d.mul(near).mul(1000)), 1)).toVar();
    const puv = was.xy.div(was.w).mul(0.5).add(0.5).toVar();
    const lost = was.w
      .lessThanEqual(0)
      .or(any(lessThan(puv, vec2(0))))
      .or(any(greaterThan(puv, vec2(1))));
    const kept = tap(history.tex, puv).level(0).toVar();
    const moved = length(puv.sub(uv).mul(keepSize)).toVar();
    const pad = hi.sub(lo).mul(0.25).add(0.02);
    const steady = smoothstep(0.25, 1.5, moved).toVar();
    kept.assign(mix(kept, clamp(kept, lo.sub(pad), hi.add(pad)), steady));
    // Settled by assignment, not by a select inside a select: the GL
    // fallback asks the output's type after the build, outside the
    // isolated branch the inner select was set up in, and fails there.
    const out = vec4(kept).toVar();
    If(lost, () => {
      out.assign(own);
    }).ElseIf(marched, () => {
      out.assign(mix(kept, own, mix(float(0.5), float(1), steady)));
    });
    return out.add(fresh.keep).add(freshDist.keep).add(history.keep);
  })();
  return cloudPass("cloud-carry", m, frag);
}
