// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOME ON THE NODE RENDERER (`docs/webgpu.md`, part 3): the node twin
// the webgpu paths draw `sky-dome.ts`'s ShaderMaterial with — the physical
// sky (`skyColour`), the cloud field's shell, the moon's sky and disc, the
// stars and the Milky Way, the sun's disc and aureole, the contrails, the
// halos and the corona, the far ground under the true horizon, the mist's
// band, a painted skyline and the valley fog's top, in the GLSL's order and
// term for term. Every uniform is the ShaderMaterial's own, read by
// reference, so `createSkyDome`'s `update` drives both back ends.
//
// What the GLSL switches with defines, the twin reads as uniforms, off the
// material's defines every render, since the node renderer does not
// rebuild a pipeline for a define: the SKY row's PLAIN (`PLAIN_SKY`), and
// which cloud the dome lays over its sky (`CLOUD_SLAB`, part 10) — LOW's
// shell read here (`cloud-shell-tsl.ts`), MEDIUM's slab or HIGH's volume
// read off the picture its pass drew before the frame (`cloud-pass-tsl.ts`,
// `cloud-volume-tsl.ts`), where this pixel stands through the lens.
//
// Linear light out: the node renderer's output pass tone maps the frame
// and encodes it (WebGL's dome does both itself), so the haze meets it with
// no seam either way.

import * as THREE from "three";
import * as TSL from "three/tsl";
import { NodeMaterial } from "three/webgpu";

import { cloudHalo, cloudSlots, cloudStack } from "./cloud-shell-tsl.ts";
import type { CloudUniforms } from "./clouds.ts";
import { contrailSky, trailSlots } from "./contrail-tsl.ts";
import type { ContrailUniforms } from "./contrails.ts";
import { FAR_AIR } from "./far-ranges-plan.ts";
import type { HazeUniforms } from "./haze.ts";
import {
  farColour,
  hazeColour,
  hazeSlots,
  mistBand,
  seaTop,
  skyColour,
  slot,
  standIn,
  tap,
  texSlot,
  type HazeSlots,
  type N,
} from "./haze-tsl.ts";
import { moonCorona, moonDisc, moonReach, nightSky } from "./night-sky-tsl.ts";
import { SUN_RADIUS } from "./sky-dome.ts";

// Read untyped, as every node here is (`haze-tsl.ts`'s `N`).
const {
  Fn,
  If,
  asin,
  atan,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  dot,
  exp,
  float,
  fract,
  fwidth,
  int,
  ivec2,
  length,
  log2,
  max,
  min,
  mix,
  mod,
  modelViewMatrix,
  normalize,
  positionLocal,
  select,
  floor,
  varying,
  smoothstep,
  step,
  textureLoad,
  textureSize,
  transpose,
  uniform,
  vec2,
  vec3,
  vec4,
} = TSL as N;

const LUMA = vec3(0.2126, 0.7152, 0.0722);

/** A 1×1 float skyline for the slot while none is painted: the format
 * `far-ranges.ts` bakes one in. */
function noSkyline(): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    new Float32Array([0, 1, 0, 1]),
    1,
    1,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  tex.needsUpdate = true;
  return tex;
}

/** The clouds' picture's stand-in while none is drawn (half floats, as
 * every pass draws). */
const NO_PICTURE = standIn();

/** The dome's node twin over the dome's own ShaderMaterial `m`. */
export function domeTwin(m: THREE.ShaderMaterial, haze: HazeUniforms): NodeMaterial {
  const U = m.uniforms;
  const s = hazeSlots(haze);
  const cs = cloudSlots(U as unknown as CloudUniforms);
  const ts = U.uTrailA ? trailSlots(U as unknown as ContrailUniforms) : null;
  const stars = slot(U.uStars, "float");
  const galaxy = slot(U.uGalaxy, "float");
  const turn = slot(U.uTurn, "mat3");
  const starTime = slot(U.uStarTime, "float");
  const moonDir = slot(U.uMoonDir, "vec3");
  const moonDiscU = slot(U.uMoonDisc, "vec4");
  const moonCol = slot(U.uMoonCol, "vec3");
  const moonGlow = slot(U.uMoonGlow, "vec3");
  const starSky = slot(U.uStarSky, "vec4");
  const skylineOn = slot(U.uSkylineOn, "float");
  const sunCol = slot(haze.uSunCol, "color");
  const cloudOn = cs.on;
  const skyline = texSlot(U.uSkyline as { value: THREE.Texture | null }, noSkyline());
  const plain = uniform(0).onRenderUpdate(() => (m.defines.PLAIN_SKY ? 1 : 0));
  const slab = uniform(0).onRenderUpdate(() => Number(m.defines.CLOUD_SLAB ?? 0));
  const picture = texSlot(U.uCloudTex as { value: THREE.Texture | null }, NO_PICTURE);
  const clip = varying(cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1)));

  const twin = new NodeMaterial();
  twin.name = "sky-dome";
  twin.side = THREE.BackSide;
  twin.depthWrite = false;
  twin.depthTest = true;
  twin.fog = false;
  twin.lights = false;
  // Pinned to the far plane so nothing is ever clipped by the sky.
  twin.vertexNode = Fn(() => {
    const p = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1)).toVar();
    return vec4(p.x, p.y, p.w, p.w);
  })();
  twin.fragmentNode = Fn(() => {
    const d = normalize(positionLocal).toVar();
    // The derivatives first, while the flow is uniform.
    const pixel = max(length(fwidth(d)), 1e-5).toVar();
    const reach = moonReach(d, moonDir, moonDiscU).toVar();
    const rim = max(fwidth(reach), 1e-4).toVar();
    const el = asin(clamp(d.y, -1, 1)).toVar();
    const elPx = max(fwidth(el), 1e-5).toVar();
    const c = skyColour(s, d).toVar();
    If(plain.lessThan(0.5), () => {
      // THE CLOUD FIELD in front: the volume's or the slab's picture read
      // where this pixel stands, or the shell's layers read here.
      const cl = vec4(0).toVar();
      const at = clip.xy.div(clip.w).mul(0.5).add(0.5).toVar();
      If(slab.greaterThan(1.5), () => {
        cl.assign(tap(picture.tex, at).level(0));
      })
        .ElseIf(slab.greaterThan(0.5), () => {
          // A linear read on a texel CORNER is the even mean of the 2 × 2
          // texels round it: the slab's dither averaged away.
          const sz = vec2(textureSize(picture.tex, 0)).toVar();
          const g = at.mul(sz).toVar();
          const c0 = floor(g).toVar();
          const fr = g.sub(c0).toVar();
          const read = (o: [number, number]): N =>
            tap(picture.tex, c0.add(vec2(o[0], o[1])).div(sz)).level(0);
          cl.assign(
            mix(mix(read([0, 0]), read([1, 0]), fr.x), mix(read([0, 1]), read([1, 1]), fr.x), fr.y),
          );
        })
        .Else(() => {
          cl.assign(cloudStack(cs, cameraPosition, d, s.sunPos, c));
        });
      const hide = cl.a;
      const clearSky = float(1).sub(hide).toVar();
      // THE MOON'S SKY close round it.
      const mo = d.sub(moonDir.mul(dot(d, moonDir)));
      const th = select(dot(d, moonDir).greaterThan(0), length(mo), float(3)).toVar();
      const moonAir = moonGlow.mul(
        exp(th.mul(-3))
          .mul(0.035)
          .add(exp(th.mul(th).mul(-900)).mul(0.08)),
      );
      c.addAssign(moonAir.mul(clearSky));
      // THE MOON'S DISC.
      const pole = transpose(turn).mul(vec3(0, 0, 1));
      const moon = moonDisc(d, moonDir, s.sunPos, pole, moonDiscU, moonCol, reach, rim).toVar();
      // THE NIGHT SKY, behind everything.
      If(stars.greaterThan(0.001).or(galaxy.greaterThan(0.001)), () => {
        const glare = clamp(dot(moonGlow, LUMA).mul(2), 0, 1)
          .mul(exp(th.mul(th).mul(-7)))
          .mul(step(-0.02, moonDir.y));
        const rel = dot(c, LUMA).div(max(starSky.y, 1e-6));
        const limit = starSky.x.sub(starSky.z.mul(log2(max(rel, 1e-3))).mul(0.30103));
        const night = nightSky(turn.mul(d), d.y, glare, stars, galaxy, starTime, limit, pixel);
        c.addAssign(night.mul(clearSky).mul(float(1).sub(moon.a)));
      });
      // THE SUN'S DISC, and the aureole round it.
      const mu = dot(d, s.sunPos).toVar();
      const cr = Math.cos(SUN_RADIUS);
      const disc = smoothstep(cr - 0.00002, cr + 0.00001, mu)
        .mul(exp(cs.veil.mul(-600).div(max(s.sunPos.y, 0.03))))
        .toVar();
      const lift = smoothstep(0, 0.3, s.sunPos.y).mul(27.5).add(2.5);
      const own = smoothstep(0.02, 0.12, s.sunPos.y);
      c.assign(
        mix(
          c,
          sunCol.mul(lift).add(c.mul(mix(float(0.15), float(1), own))),
          disc.mul(float(1).sub(hide.mul(0.97))),
        ),
      );
      const away = float(1).sub(mu);
      const aureole = exp(away.mul(-900))
        .mul(0.6)
        .add(exp(away.mul(-90)).mul(0.12));
      c.addAssign(
        sunCol
          .mul(aureole)
          .mul(clearSky)
          .mul(smoothstep(-0.03, 0.01, s.sunPos.y)),
      );
      // THE MOON in front of the sky behind it.
      c.addAssign(moon.rgb.mul(float(1).sub(hide.mul(0.93))));
      // THE CONTRAILS, over the sky and under every cloud layer.
      if (ts) {
        const tr = contrailSky(ts, cs, s.sunPos, cameraPosition, d, c).toVar();
        c.assign(c.mul(float(1).sub(tr.a)).add(tr.rgb));
      }
      c.assign(c.mul(clearSky).add(cl.rgb));
      // THE 22° HALO round the sun and the moon; the corona.
      const ring = float(1).sub(hide.mul(0.6));
      c.addAssign(cloudHalo(d, s.sunPos, sunCol, cloudOn.z).mul(ring));
      c.addAssign(cloudHalo(d, moonDir, moonGlow.mul(1.6), cloudOn.z).mul(ring));
      c.addAssign(moonCorona(th, hide, moonGlow));
    });
    // UNDER THE TRUE HORIZON: the far ground through the air, and the
    // mist's band over it.
    const below = el.negate().sub(s.far.x).toVar();
    const band = mistBand(s, d).toVar();
    const under = smoothstep(-0.0004, 0.0004, below);
    If(skylineOn.greaterThan(0.5), () => {
      c.assign(mix(c, farColour(s, d, smoothstep(0, 0.01, below)), under));
      c.assign(paintSkylineOn(s, skyline.tex, c, d, el, elPx));
      c.assign(mix(c, farColour(s, d, band), band));
    }).Else(() => {
      c.assign(mix(c, farColour(s, d, max(smoothstep(0, 0.01, below), band)), max(under, band)));
    });
    // A VALLEY FOG SEEN FROM ABOVE: its lit top under the level.
    If(
      s.seaK.greaterThan(0).and(d.y.lessThan(0)).and(cameraPosition.y.greaterThan(s.sea.w)),
      () => {
        const t = s.sea.w.sub(cameraPosition.y).div(d.y).toVar();
        const sp = cameraPosition.xz.add(d.xz.mul(t));
        const sea = mix(
          seaTop(s, sp, t),
          hazeColour(s, d),
          float(1).sub(exp(t.negate().div(40000))),
        );
        c.assign(mix(c, sea, smoothstep(0, -0.004, d.y)));
      },
    );
    return vec4(c.add(skyline.keep).add(picture.keep), 1);
  })();
  // A node on the material drawn, so the renderer refreshes the dome's
  // bindings every draw: the volume's picture swaps between two targets.
  (m as unknown as { twinNode: N }).twinNode = twin.fragmentNode;
  return twin;
}

/** THE SKYLINE at bearing `az` (turns): two layers' crests and distances
 * (`skylineAt`), read with exact fetches between two bins. */
function skylineAt(sky: N, bins: N, az: N): N {
  const x = fract(az.add(1)).mul(bins).sub(0.5).toVar();
  const i0 = x.floor().toVar();
  const a = textureLoad(sky, ivec2(int(mod(i0, bins)), int(0))).toVar();
  const b = textureLoad(sky, ivec2(int(mod(i0.add(1), bins)), int(0))).toVar();
  return mix(a, b, x.sub(i0));
}

/** A range's colour `below` rad under its crest, `dist` m off (`ridgeColour`). */
function ridgeColour(s: HazeSlots, dh: N, dist: N, below: N, slope: N): N {
  const air = hazeColour(s, dh);
  const far = min(dist, FAR_AIR.near).add(max(dist.sub(FAR_AIR.near), 0).mul(FAR_AIR.thin));
  const seen = exp(
    far
      .negate()
      .mul(s.haze)
      .mul(mix(s.floor, float(1), 0.5)),
  )
    .mul(mix(float(1), float(0.75), smoothstep(0.01, 0.06, below)))
    .toVar();
  const right = vec3(dh.z, 0, dh.x.negate());
  const face = normalize(
    vec3(0, 0.8, 0)
      .sub(dh.mul(0.6))
      .sub(right.mul(clamp(slope.mul(3), -1.5, 1.5))),
  );
  const lit = max(dot(face, s.sunDir), 0).mul(0.8).add(max(s.sunDir.y, 0).mul(0.2));
  const snow = mix(float(3), float(1.2), smoothstep(0, 0.015, below));
  const ground = s.farGround.add(s.farKey.mul(lit)).mul(snow);
  return mix(air, ground, seen);
}

/** The painted skyline over `c` (`paintSkyline`); `el` the view's
 * elevation and `px` a pixel's height in it. */
function paintSkylineOn(s: HazeSlots, sky: N, c: N, d: N, el: N, px: N): N {
  const hz = d.xz;
  const flat = dot(hz, hz).lessThan(1e-8);
  const h = normalize(select(flat, vec2(1, 0), hz));
  const dh = vec3(h.x, 0, h.y).toVar();
  const bins = float(textureSize(sky, 0).x).toVar();
  const az = atan(d.x, d.z).div(6.28318531).toVar();
  const stepAz = float(2).div(bins);
  const sm = skylineAt(sky, bins, az).toVar();
  const l = skylineAt(sky, bins, az.sub(stepAz)).toVar();
  const r = skylineAt(sky, bins, az.add(stepAz)).toVar();
  const span = stepAz.mul(12.5663706);
  const crest = (hh: N, dist: N): N => atan(hh.sub(cameraPosition.y), dist);
  const farEl = crest(sm.z, sm.w).toVar();
  const farSlope = crest(r.z, r.w).sub(crest(l.z, l.w)).div(span);
  const nearEl = crest(sm.x, sm.y).toVar();
  const nearSlope = crest(r.x, r.y).sub(crest(l.x, l.y)).div(span);
  const one = mix(
    c,
    ridgeColour(s, dh, sm.w, farEl.sub(el), farSlope),
    smoothstep(farEl.add(px), farEl.sub(px), el),
  );
  const two = mix(
    one,
    ridgeColour(s, dh, sm.y, nearEl.sub(el), nearSlope),
    smoothstep(nearEl.add(px), nearEl.sub(px), el),
  );
  return select(flat, c, two);
}
