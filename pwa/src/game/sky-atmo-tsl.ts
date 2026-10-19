// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GPU SKY'S PASSES ON THE NODE RENDERER (`docs/webgpu.md`, part 3):
// `sky-gpu-glsl.ts` — Hillaire's model on the GPU — restated as TSL, one
// node twin for each of the four passes `sky-gpu.ts` draws (the
// transmittance and multiple-scattering tables, the sky-view table, HIGH's
// aerial-perspective volume). The GLSL is the authority, line for line:
// the same media off `EARTH`, the same parametrisations, the same marches
// and the same exposure as `sky.ts` presses the LOW grid. A change to one
// is a change to both.
//
// `sky-gpu.ts` drives both back ends: it makes the same ShaderMaterials
// with the same uniforms, and on the webgpu paths the renderer's library
// draws each with its twin here (`sky-twins-tsl.ts`), reading those
// uniforms by reference. The pixel a pass writes is `screenCoordinate` —
// three's, in WebGPU's convention on both of its back ends, row 0 the one
// a texture read at v ≈ 0 finds — so every table is laid out as WebGL's.

import * as THREE from "three";
import * as TSL from "three/tsl";
import { NodeMaterial } from "three/webgpu";

import { EARTH } from "./atmosphere-model.ts";
import { slot, texSlot, type N } from "./haze-tsl.ts";
import { FROXELS, SKY_TABLES } from "./sky-gpu-plan.ts";
import { DOME } from "./sky.ts";
import { SKY_VIEW_EL } from "./sky-table-format.ts";

// Read untyped, as every node here is (`haze-tsl.ts`'s `N`).
const {
  Fn,
  If,
  Loop,
  clamp,
  cos,
  dot,
  exp,
  float,
  int,
  length,
  max,
  min,
  mix,
  normalize,
  positionGeometry,
  pow,
  screenCoordinate,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const PI = Math.PI;
const RG = EARTH.groundRadius;
const RT = EARTH.topRadius;
const H = Math.sqrt(RT * RT - RG * RG);
const v3 = (c: readonly number[]): N => vec3(c[0], c[1], c[2]);

/** The media at a height h km (`medium`): Rayleigh's scattering, Mie's,
 * the extinction. */
function medium(h: N): { sr: N; sm: N; ext: N } {
  const hh = max(h, 0);
  const sr = v3(EARTH.rayleigh)
    .mul(exp(hh.negate().div(EARTH.rayleighHeight)))
    .toVar();
  const dm = exp(hh.negate().div(EARTH.mieHeight)).toVar();
  const sm = dm.mul(EARTH.mieScattering).toVar();
  const ozone = max(0, float(1).sub(h.sub(EARTH.ozoneCentre).abs().div(EARTH.ozoneWidth)));
  const ext = sr.add(dm.mul(EARTH.mieExtinction)).add(v3(EARTH.ozone).mul(ozone)).toVar();
  return { sr, sm, ext };
}
const rayleighPhase = (nu: N): N =>
  nu
    .mul(nu)
    .add(1)
    .mul(3 / (16 * PI));
function miePhase(nu: N): N {
  const g = EARTH.mieG;
  const k = ((3 / (8 * PI)) * (1 - g * g)) / (2 + g * g);
  return nu
    .mul(nu)
    .add(1)
    .mul(k)
    .div(pow(float(1 + g * g).sub(nu.mul(2 * g)), 1.5));
}
/** The far root of a ray from radius r at zenith cosine mu with sphere R. */
function toSphere(r: N, mu: N, R: number): N {
  const disc = r
    .mul(r)
    .mul(mu.mul(mu).sub(1))
    .add(R * R);
  return select(
    disc.lessThan(0),
    float(-1),
    r
      .negate()
      .mul(mu)
      .add(sqrt(max(disc, 0))),
  );
}
function toGround(r: N, mu: N): N {
  const disc = r
    .mul(r)
    .mul(mu.mul(mu).sub(1))
    .add(RG * RG);
  return select(
    mu.greaterThanEqual(0).or(disc.lessThan(0)),
    float(-1),
    max(
      0,
      r
        .negate()
        .mul(mu)
        .sub(sqrt(max(disc, 0))),
    ),
  );
}
function horizonMu(r: N): N {
  const s = float(RG).div(r);
  return sqrt(max(0, float(1).sub(s.mul(s)))).negate();
}
function transUv(r: N, mu: N): N {
  const rho = sqrt(max(0, r.mul(r).sub(RG * RG)));
  const d = max(0, toSphere(r, mu, RT));
  const dMin = float(RT).sub(r);
  const dMax = rho.add(H);
  return vec2(d.sub(dMin).div(max(1e-9, dMax.sub(dMin))), rho.div(H));
}

/** The two tables built once, as `TABLES_GLSL` reads them. */
type Tables = { trans: N; ms: N };
const lutUv = (uv: N, w: number, h: number): N =>
  clamp(uv, 0, 1)
    .mul(vec2(w - 1, h - 1))
    .add(0.5)
    .div(vec2(w, h));
/** The sun from radius r at zenith cosine muS (`sunTrans`). */
function sunTrans(t: Tables, r: N, muS: N): N {
  const hz = horizonMu(r).toVar();
  const vis = clamp(muS.sub(hz).div(0.0093).add(0.5), 0, 1).toVar();
  const uv = transUv(r, max(muS, hz));
  const T = t.trans.sample(lutUv(uv, SKY_TABLES.trans.width, SKY_TABLES.trans.height)).level(0);
  return select(vis.lessThanEqual(0), vec3(0), T.rgb.mul(vis));
}
function multiScat(t: Tables, r: N, muS: N): N {
  const uv = vec2(muS.mul(0.5).add(0.5), r.sub(RG).div(RT - RG));
  return t.ms.sample(lutUv(uv, SKY_TABLES.ms.size, SKY_TABLES.ms.size)).level(0).rgb;
}
function tablesOf(u: Record<string, THREE.IUniform>): Tables {
  // Both are drawn before any pass that reads them: read as they stand.
  return {
    trans: texture(u.uTrans.value as THREE.Texture),
    ms: texture((u.uMs?.value ?? u.uTrans.value) as THREE.Texture),
  };
}

/** A pass's twin: its quad straight onto the target, its fragment `frag`. */
function passTwin(name: string, frag: () => N): NodeMaterial {
  const twin = new NodeMaterial();
  twin.name = name;
  twin.depthTest = false;
  twin.depthWrite = false;
  twin.fog = false;
  twin.lights = false;
  twin.vertexNode = vec4(positionGeometry.xy, 0, 1);
  twin.fragmentNode = Fn(frag)();
  return twin;
}

/** THE TRANSMITTANCE TABLE (`TRANS_FRAGMENT`). */
export function transTwin(): NodeMaterial {
  const T = SKY_TABLES.trans;
  return passTwin("sky-trans", () => {
    const uv = screenCoordinate.sub(0.5).div(vec2(T.width - 1, T.height - 1));
    const rho = uv.y.mul(H).toVar();
    const r = sqrt(rho.mul(rho).add(RG * RG)).toVar();
    const dMin = float(RT).sub(r);
    const dMax = rho.add(H);
    const d = dMin.add(uv.x.mul(dMax.sub(dMin))).toVar();
    const mu = select(
      d.equal(0),
      float(1),
      clamp(
        float(H * H)
          .sub(rho.mul(rho))
          .sub(d.mul(d))
          .div(r.mul(d).mul(2)),
        -1,
        1,
      ),
    ).toVar();
    const len = max(0, toSphere(r, mu, RT));
    const dt = len.div(T.steps).toVar();
    const od = vec3(0).toVar();
    Loop({ start: 0, end: T.steps, type: "int", name: "i" }, ({ i }: { i: N }) => {
      const t = float(i).add(0.5).mul(dt);
      const rr = sqrt(r.mul(r).add(t.mul(t)).add(r.mul(mu).mul(t).mul(2)));
      od.addAssign(medium(rr.sub(RG)).ext.mul(dt));
    });
    return vec4(exp(od.negate()), 1);
  });
}

/** THE MULTIPLE-SCATTERING TABLE (`MS_FRAGMENT`). */
export function msTwin(u: Record<string, THREE.IUniform>): NodeMaterial {
  const M = SKY_TABLES.ms;
  const t = tablesOf(u);
  return passTwin("sky-ms", () => {
    const Nn = M.size - 1;
    const j = screenCoordinate.y.sub(0.5);
    const i = screenCoordinate.x.sub(0.5);
    const r = max(0.01, j.div(Nn).mul(RT - RG))
      .add(RG)
      .toVar();
    const muS = i.div(Nn).mul(2).sub(1).toVar();
    const sx = sqrt(max(0, float(1).sub(muS.mul(muS)))).toVar();
    const sy = muS;
    const L2 = vec3(0).toVar();
    const F = vec3(0).toVar();
    const n = M.dirs * M.dirs;
    Loop(
      { start: 0, end: M.dirs, type: "int", name: "a" },
      { start: 0, end: M.dirs, type: "int", name: "b" },
      ({ a, b }: { a: N; b: N }) => {
        const cosT = float(1).sub(
          float(a)
            .add(0.5)
            .mul(2 / M.dirs),
        );
        const phi = float(b)
          .add(0.5)
          .mul((2 * PI) / M.dirs);
        const sinT = sqrt(max(0, float(1).sub(cosT.mul(cosT))));
        const dx = sinT.mul(cos(phi)).toVar();
        const dy = cosT.toVar();
        const ground = toGround(r, dy).toVar();
        const len = select(ground.greaterThanEqual(0), ground, max(0, toSphere(r, dy, RT)));
        const dt = len.div(M.steps).toVar();
        const T = vec3(1).toVar();
        Loop({ start: 0, end: M.steps, type: "int", name: "s" }, ({ s }: { s: N }) => {
          const tt = float(s).add(0.3).mul(dt);
          const px = dx.mul(tt);
          const py = r.add(dy.mul(tt));
          const rr = length(vec2(px, py)).toVar();
          const md = medium(rr.sub(RG));
          const mu = px.mul(sx).add(py.mul(sy)).div(rr);
          const sunT = sunTrans(t, rr, mu);
          const scat = md.sr.add(md.sm);
          const e = max(md.ext, vec3(1e-9)).toVar();
          const stp = exp(e.negate().mul(dt)).toVar();
          const share = vec3(1).sub(stp).div(e).toVar();
          L2.addAssign(
            T.mul(scat)
              .mul(sunT)
              .mul(1 / (4 * PI))
              .mul(share)
              .div(n),
          );
          F.addAssign(T.mul(scat).mul(share).div(n));
          T.mulAssign(stp);
        });
        If(ground.greaterThanEqual(0), () => {
          const gx = dx.mul(ground);
          const gy = r.add(dy.mul(ground));
          const gr = length(vec2(gx, gy)).toVar();
          const gmu = gx.mul(sx).add(gy.mul(sy)).div(gr).toVar();
          L2.addAssign(
            T.mul(sunTrans(t, gr, gmu))
              .mul(max(0, gmu))
              .mul(EARTH.albedo / PI)
              .div(n),
          );
        });
      },
    );
    return vec4(L2.div(vec3(1).sub(min(vec3(0.99), F))), 1);
  });
}

/** THE SKY'S RADIANCE along `view` from radius `r` with the sun toward
 * `sun`, marched in `steps` packed toward the lens (`skyMarch`). */
function skyMarch(t: Tables, r: N, view: N, sun: N, steps: number): N {
  const mu = view.y;
  const ground = toGround(r, mu);
  const len = select(ground.greaterThanEqual(0), ground, max(0, toSphere(r, mu, RT))).toVar();
  const nu = dot(view, sun).toVar();
  const pr = rayleighPhase(nu).toVar();
  const pm = miePhase(nu).toVar();
  const L = vec3(0).toVar();
  const T = vec3(1).toVar();
  const prev = float(0).toVar();
  Loop({ start: 1, end: steps, type: "int", condition: "<=", name: "s" }, ({ s }: { s: N }) => {
    const fs = float(s).div(steps);
    const t1 = len.mul(fs).mul(fs).toVar();
    const dt = t1.sub(prev).toVar();
    const tt = prev.add(dt.mul(0.5));
    prev.assign(t1);
    const p = vec3(0, r, 0).add(view.mul(tt)).toVar();
    const rr = length(p).toVar();
    const md = medium(rr.sub(RG));
    const muS = dot(p, sun).div(rr).toVar();
    const S = md.sr
      .mul(pr)
      .add(md.sm.mul(pm))
      .mul(sunTrans(t, rr, muS))
      .add(md.sr.add(md.sm).mul(multiScat(t, rr, muS)));
    const e = max(md.ext, vec3(1e-9)).toVar();
    const stp = exp(e.negate().mul(dt)).toVar();
    L.addAssign(T.mul(S).mul(vec3(1).sub(stp)).div(e));
    T.mulAssign(stp);
  });
  return L;
}

/** THE SKY-VIEW TABLE, exposed as the LOW grid is (`VIEW_FRAGMENT`); its
 * steps the material's own `STEPS`. */
export function viewTwin(u: Record<string, THREE.IUniform>, steps: number): NodeMaterial {
  const t = tablesOf(u);
  const size = slot(u.uSize, "vec2");
  const elevation = slot(u.uElevation, "float");
  const radius = slot(u.uRadius, "float");
  const expose = slot(u.uExpose, "vec4");
  const rows = slot(u.uNightRows, "vec3");
  const V1 = 1 / (SKY_VIEW_EL - 1);
  const nightAt = (v: N): N => {
    const x = clamp(v, 0, 1).mul(SKY_VIEW_EL - 1);
    const k = int(min(x.floor(), SKY_VIEW_EL - 2)).toVar();
    return mix(rows.element(k), rows.element(k.add(1)), x.sub(float(k)));
  };
  const lumOf = (c: N): N => dot(c, vec3(0.2126, 0.7152, 0.0722));
  const dirOf = (uu: N, vv: N): N => {
    const az = uu.mul(uu).mul(PI);
    const el = vv.mul(vv).mul(PI / 2);
    const c = cos(el);
    return vec3(sin(az).mul(c), sin(el), cos(az).mul(c));
  };
  const pulled = (uu: N, vv: N, sun: N): N => {
    const L = skyMarch(t, radius, dirOf(uu, vv), sun, steps).toVar();
    // The grazing rows pulled toward the row a step over them, in the
    // logarithm, as the LOW grid's is (`DOME.horizon`).
    If(vv.lessThan(V1), () => {
      const L1 = skyMarch(t, radius, dirOf(uu, float(V1)), sun, steps);
      const w = float(1).sub(vv.div(V1)).mul(DOME.horizon);
      L.assign(L.mul(pow(max(L1, vec3(1e-30)).div(max(L, vec3(1e-30))), vec3(w))));
    });
    return L;
  };
  const exposed = (L: N, vv: N): N => {
    const Y = lumOf(L).toVar();
    const press = select(
      Y.greaterThan(0),
      pow(Y.div(expose.y), DOME.span - 1).mul(DOME.gain),
      float(0),
    );
    return L.mul(expose.x).mul(press).add(nightAt(vv));
  };
  return passTwin("sky-view", () => {
    const uu = screenCoordinate.x.sub(0.5).div(size.x.sub(1)).toVar();
    const vv = screenCoordinate.y.sub(0.5).div(size.y.sub(1)).toVar();
    const sun = vec3(0, sin(elevation), cos(elevation)).toVar();
    const c = exposed(pulled(uu, vv, sun), vv).toVar();
    // A veil or heaps between: the blue thinned toward the horizon's white.
    If(expose.w.greaterThan(0), () => {
      c.addAssign(
        exposed(pulled(uu, float(0), sun), float(0))
          .sub(c)
          .mul(expose.w),
      );
    });
    return vec4(min(c, vec3(65000)), 1);
  });
}

/** The ground's stand-in while the map has none: half-float heights. */
function noGround(): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    new Uint16Array([THREE.DataUtils.toHalfFloat(-1e4)]),
    1,
    1,
    THREE.RedFormat,
    THREE.HalfFloatType,
  );
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** THE AERIAL-PERSPECTIVE VOLUME (HIGH, `FROXEL_FRAGMENT`). */
export function froxelTwin(u: Record<string, THREE.IUniform>): NodeMaterial {
  const F = FROXELS;
  const t = tablesOf(u);
  const invViewProj = slot(u.uInvViewProj, "mat4");
  const eye = slot(u.uEye, "vec3");
  const sunU = slot(u.uSun, "vec3");
  const radius = slot(u.uRadius, "float");
  const law = slot(u.uHazeLaw, "vec3");
  const box = slot(u.uGroundBox, "vec4");
  const on = slot(u.uGroundOn, "vec4");
  const ground = texSlot(u.uGround as { value: THREE.Texture | null }, noGround());
  const grow = Math.pow(F.reach / 12, 1 / (F.light - 1));
  const groundAt = (xz: N): N => {
    const uv = xz.sub(box.xy).mul(box.zw).toVar();
    const out = uv.x
      .lessThan(0)
      .or(uv.y.lessThan(0))
      .or(uv.x.greaterThan(1))
      .or(uv.y.greaterThan(1));
    return select(out, float(-1e9), ground.tex.sample(uv).level(0).r);
  };
  const sunSeen = (p: N): N => {
    const seen = float(1).toVar();
    If(on.x.greaterThanEqual(0.5).and(sunU.y.greaterThanEqual(-0.02)), () => {
      const s = float(12).toVar();
      Loop({ start: 0, end: F.light, type: "int", name: "q" }, () => {
        const q = p.add(sunU.mul(s)).toVar();
        const h = groundAt(q.xz);
        seen.assign(min(seen, smoothstep(-4, 6, q.y.sub(h))));
        s.mulAssign(grow);
      });
    });
    return seen;
  };
  return passTwin("sky-froxel", () => {
    const px = screenCoordinate.x.sub(0.5);
    const slice = px.div(F.size).floor().toVar();
    const x = px.sub(slice.mul(F.size));
    const y = screenCoordinate.y.sub(0.5);
    const ndc = vec2(x, y).add(0.5).div(F.size).mul(2).sub(1);
    const w = invViewProj.mul(vec4(ndc, 1, 1)).toVar();
    const dir = normalize(w.xyz.div(w.w).sub(eye)).toVar();
    const D = pow(slice.add(1).div(F.slices), 3).mul(F.depth).toVar();
    const nu = dot(dir, sunU).toVar();
    const pr = rayleighPhase(nu).toVar();
    const pm = miePhase(nu).toVar();
    const lit = vec3(0).toVar();
    const whole = vec3(0).toVar();
    const od = float(0).toVar();
    const prev = float(0).toVar();
    Loop({ start: 1, end: F.steps, type: "int", condition: "<=", name: "s" }, ({ s }: { s: N }) => {
      const fs = float(s).div(F.steps);
      const t1 = D.mul(fs).mul(fs).toVar();
      const dt = t1.sub(prev).toVar();
      const tt = prev.add(dt.mul(0.5));
      prev.assign(t1);
      const p = eye.add(dir.mul(tt)).toVar();
      const rise = p.y.sub(eye.y).toVar();
      const dens = law.x.mul(mix(law.z, float(1), exp(max(rise, 0).negate().div(law.y)))).toVar();
      const wgt = dens.mul(dt).mul(exp(od.negate())).toVar();
      od.addAssign(dens.mul(dt));
      const rr = radius.add(rise.div(1000)).toVar();
      const muS = sunU.y;
      const md = medium(rr.sub(RG));
      const sun = md.sr
        .mul(pr)
        .add(md.sm.mul(pm))
        .mul(sunTrans(t, rr, muS))
        .toVar();
      const sky = md.sr
        .add(md.sm)
        .mul(multiScat(t, rr, muS))
        .toVar();
      lit.addAssign(wgt.mul(sky.add(sun.mul(sunSeen(p)))));
      whole.addAssign(wgt.mul(sky.add(sun)));
    });
    const share = select(whole.y.greaterThan(1e-20), lit.div(max(whole, vec3(1e-20))), vec3(1));
    return vec4(clamp(share, 0, 1).add(ground.keep), 1);
  });
}
