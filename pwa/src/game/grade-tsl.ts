// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRADE ON THE NODE RENDERER (`docs/webgpu.md`, part 7): `grade-pass.ts`'s
// fragment restated as TSL, step for step, over the pass's OWN uniforms —
// each read by reference (`slot`), so `setGrade`, `setBuzz` and `setBlaze`
// drive both back ends with no second copy of any number. The GLSL is the
// authority; a change to one is a change to both.
//
// THE PASS IS A `RenderPipeline` WITH ITS OUTPUT TRANSFORM DONE BY HAND. The
// scene is drawn into the pass's half-float target as on WebGL (in linear
// light: the node renderer applies no tone mapping into a target), and the
// pipeline's quad reads it back and writes the canvas. Three's own output
// transform would tone map and encode AFTER everything the quad does; WebGL's
// pass tone maps BEFORE the grade and encodes after it. So the pipeline's
// `outputColorTransform` is off and the quad does both itself, in WebGL's
// order: the buzz and the shimmer's reads, the tone map, the grade, the buzz's
// edges and the blaze, the sRGB curve.
//
// THE TONE MAP IS THE GLSL FIT, not three's node one: the node fit also
// multiplies the fit's `0.432951` by `0.983729` (`haze-tsl.ts`'s `FIT`), which
// darkens the mid-tones a hair. The grade's `acesGlsl` is WebGL's to the
// constant, so a graded frame lands on WebGL's pixel. (A frame drawn straight
// onto the canvas — a neutral grade, which no region has today — still goes
// through three's own output pass, which the fog node undoes.)
//
// THE PICTURE'S ROWS RUN DOWN on the node renderer: `screenUV` is 0 at the
// top, and a render target's texture is read with the same top-down v
// (three flips it on its WebGL2 back end). Every effect below is stated in
// WebGL's `vUv` (0 at the FOOT, where the flames rise from), so the quad
// turns its coordinate up once (`up`) and back down to read (`read`).

import * as THREE from "three";
import {
  Fn,
  If,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  sRGBTransferOETF,
  screenUV,
  sin,
  smoothstep,
  sqrt,
  texture,
  toneMappingExposure,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { RenderPipeline, type WebGPURenderer } from "three/webgpu";

import type { GradeUniforms } from "./grade-pass.ts";
import { ACES_IN, ACES_OUT, slot, times, type N } from "./haze-tsl.ts";

/** Mid grey in the grade's perceptual coordinate (`MID_P`). */
const MID_P = Math.sqrt(0.18);
/** Rec. 709 luminance, the GLSL's `LUMA`. */
const LUMA = (): N => vec3(0.2126, 0.7152, 0.0722);

/** THREE'S GLSL ACES FIT (`ACESFilmicToneMapping` in its tone-mapping
 * chunk), to the constant: the exposure over 0.6, the in matrix, the fit,
 * the out matrix, clamped. */
export function acesGlsl(c: N, exposure: N): N {
  const v = times(ACES_IN, c.mul(exposure).div(0.6));
  const fit = v
    .mul(v.add(0.0245786))
    .sub(0.000090537)
    .div(v.mul(v.mul(0.983729).add(0.432951)).add(0.238081));
  return clamp(times(ACES_OUT, fit), 0, 1);
}

/** The grade's slots: every uniform of the pass, by reference. */
export function gradeSlots(u: GradeUniforms) {
  return {
    contrast: slot(u.uContrast, "float"),
    lift: slot(u.uLift, "float"),
    saturation: slot(u.uSaturation, "float"),
    tint: slot(u.uTint, "vec3"),
    shade: slot(u.uShade, "vec3"),
    glow: slot(u.uGlow, "vec3"),
    split: slot(u.uSplit, "vec2"),
    buzz: slot(u.uBuzz, "float"),
    blaze: slot(u.uBlaze, "vec3"),
    time: slot(u.uTime, "float"),
  };
}
type Slots = ReturnType<typeof gradeSlots>;

/** `hash`, `noise` and `flames`, the blaze's (GLSL namesakes). */
const hash = (p: N): N => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
function noise(p: N): N {
  const i: N = floor(p);
  const f0: N = fract(p);
  const f = f0.mul(f0).mul(float(3).sub(f0.mul(2)));
  return mix(
    mix(hash(i), hash(i.add(vec2(1, 0))), f.x),
    mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x),
    f.y,
  );
}
function flames(uv: N, t: N): N {
  const q = vec2(uv.x.mul(7), uv.y.mul(3.2).sub(t.mul(2.6)));
  return noise(q)
    .mul(0.55)
    .add(noise(q.mul(2.1).add(3.7)).mul(0.3))
    .add(noise(q.mul(4.3).sub(1.9)).mul(0.15));
}

/** THE BLAZE over `c` at `uv` (`blaze` in the GLSL). */
function blaze(s: Slots, c0: N, uv: N): N {
  const heat = s.blaze.x;
  const flash = s.blaze.y;
  const smoke = s.blaze.z;
  const t = s.time;
  // The cast.
  let c: N = mix(c0, c0.mul(vec3(1.35, 0.82, 0.5)).add(vec3(0.06, 0.018, 0)), heat.mul(0.7));
  // The tongues up from the foot.
  const reach = heat.mul(0.42).add(0.18);
  const n = flames(uv, t);
  const tongue = smoothstep(
    reach,
    reach.mul(0.25),
    uv.y.add(float(0.5).sub(n).mul(reach).mul(0.9)),
  );
  const core = smoothstep(reach.mul(0.55), 0, uv.y.add(float(0.5).sub(n).mul(reach).mul(0.6)));
  const fire = mix(vec3(1, 0.32, 0.04), vec3(1, 0.82, 0.42), core);
  c = mix(c, fire.mul(core.add(1.2)), clamp(tongue.mul(heat).mul(1.1), 0, 1));
  // The smoke at the edges, rolling.
  const edge = smoothstep(0.2, 0.75, length(uv.sub(0.5).mul(vec2(1.25, 1))));
  const roll = noise(uv.mul(5).add(vec2(t.mul(0.3), t.mul(0.7))))
    .mul(0.6)
    .add(0.4);
  c = mix(c, vec3(0.05, 0.04, 0.035), clamp(smoke.mul(edge).mul(roll).mul(1.3), 0, 0.92));
  c = c.mul(float(1).sub(smoke.mul(0.25)));
  // The flash.
  return mix(c, vec3(1, 0.94, 0.82), clamp(flash, 0, 1));
}

/** THE GRADE'S OUTPUT: the picture `picture` read, tone mapped, graded and
 * encoded — the colour the quad writes the canvas with. `toned` is whether
 * the renderer tone maps (its ACES) at all. */
export function gradeOutput(
  u: GradeUniforms,
  picture: THREE.Texture,
  toned = true,
  rays: ((seen: N) => N) | null = null,
): N {
  const s = gradeSlots(u);
  const pic: N = texture(picture);
  /** The picture at `p`, WebGL's `vUv` (0 at the foot). */
  const read = (p: N): N =>
    pic
      .sample(vec2(p.x, float(1).sub(p.y)))
      .level(0)
      .setUpdateMatrix(false);
  /** `split` (the buzz's colours split toward the edges). */
  const split = (p: N, ch: N): N => vec3(read(p.add(ch)).r, read(p).g, read(p.sub(ch)).b);
  /** `drunk` (THE BUZZ: the picture swimming, seen double). */
  const drunk = (p0: N): N => {
    const b = s.buzz;
    const t = s.time;
    const c = p0.sub(0.5);
    const wave = vec2(sin(p0.y.mul(6).add(t.mul(1.3))), cos(p0.x.mul(4.5).add(t.mul(1.05))))
      .mul(0.014)
      .mul(b);
    const p = c
      .mul(float(1).sub(b.mul(0.06).mul(sin(t.mul(0.7)).mul(0.5).add(0.5))))
      .add(0.5)
      .add(wave);
    const ch = c.mul(0.022).mul(b);
    const twin = vec2(sin(t.mul(0.63)), cos(t.mul(0.41)).mul(0.35))
      .mul(0.04)
      .mul(b);
    const r = b.mul(0.0045);
    const a = split(p, ch)
      .mul(0.4)
      .add(
        split(p.add(vec2(r, 0)), ch)
          .add(split(p.sub(vec2(r, 0)), ch))
          .add(split(p.add(vec2(0, r)), ch))
          .add(split(p.sub(vec2(0, r)), ch))
          .mul(0.15),
      );
    const e = split(p.add(twin), ch);
    return mix(a, e, smoothstep(0, 0.5, b).mul(0.45));
  };
  return Fn(() => {
    const up: N = vec2(screenUV.x, float(1).sub(screenUV.y));
    // The air over the fire shimmering, most low down (nothing at no heat).
    const lo = float(1).sub(up.y);
    const at = up.add(
      vec2(sin(up.y.mul(38).add(s.time.mul(11))), cos(up.x.mul(31).add(s.time.mul(9))))
        .mul(s.blaze.x.max(0).mul(0.0045))
        .mul(lo.add(0.35)),
    );
    const seen: N = read(at).rgb.toVar();
    If(s.buzz.greaterThan(0), () => {
      seen.assign(drunk(at));
    });
    // THE RAYS (`rays-tsl.ts`), on the scene's own linear light.
    if (rays) seen.assign(rays(seen));
    const linear: N = max(seen, 0);
    const c: N = (toned ? acesGlsl(linear, toneMappingExposure) : linear).toVar();

    // THE CONTRAST, then THE LIFT, in the perceptual coordinate.
    const p0 = sqrt(max(c, 0)).sub(MID_P).mul(s.contrast).add(MID_P);
    const p = max(p0.add(s.lift.mul(float(1).sub(p0))), 0);
    c.assign(p.mul(p));
    // THE SATURATION, about the pixel's own light.
    const l = dot(c, LUMA());
    c.assign(max(c.sub(l).mul(s.saturation).add(l), 0));
    // THE CAST.
    c.assign(c.mul(s.tint));
    // THE SPLIT.
    const w = clamp(sqrt(max(dot(c, LUMA()), 0)), 0, 1);
    const shade = s.split.x.mul(float(1).sub(w));
    const glow = s.split.y.mul(w);
    c.assign(c.mul(float(1).sub(shade).add(shade.mul(s.shade))));
    c.assign(c.mul(float(1).sub(glow).add(glow.mul(s.glow))));
    // ...and the edges of the buzz closing in, warm.
    If(s.buzz.greaterThan(0), () => {
      const edge = smoothstep(0.3, 0.8, length(up.sub(0.5).mul(vec2(1.2, 1))));
      c.assign(c.mul(float(1).sub(s.buzz.mul(0.6).mul(edge))));
      c.assign(mix(c, c.mul(vec3(1.08, 0.97, 0.86)), s.buzz.mul(0.6)));
    });
    If(s.blaze.x.add(s.blaze.y).add(s.blaze.z).greaterThan(0), () => {
      c.assign(blaze(s, c, up));
    });
    return vec4(sRGBTransferOETF(c) as N, 1);
  })();
}

/** THE NODE RENDERER'S GRADE PASS over `u` (`grade-pass.ts`'s `NodeGrade`):
 * a `RenderPipeline` whose quad writes `gradeOutput` onto the canvas, its
 * own output transform off (see the header). A second pipeline, built the
 * first time the RAYS row asks for it, shades the colour first with
 * `shade` (`rays-tsl.ts`); the first is never touched by it, so a picture
 * with the row OFF is the one drawn before the row existed. */
export function nodeGradePass(
  renderer: WebGPURenderer,
  u: GradeUniforms,
  shade: (() => ((seen: N) => N) | null) | null = null,
): { render(shaded?: boolean): void; dispose(): void; readonly pipeline: RenderPipeline } {
  const toned = renderer.toneMapping === THREE.ACESFilmicToneMapping;
  const pipeline = new RenderPipeline(renderer, gradeOutput(u, u.uPicture.value, toned));
  pipeline.outputColorTransform = false;
  let shaded: RenderPipeline | null = null;
  return {
    pipeline,
    render(withRays = false) {
      const by = withRays ? shade?.() : null;
      if (by && !shaded) {
        shaded = new RenderPipeline(renderer, gradeOutput(u, u.uPicture.value, toned, by));
        shaded.outputColorTransform = false;
      }
      const onto = renderer.getRenderTarget();
      renderer.setRenderTarget(null);
      (by && shaded ? shaded : pipeline).render();
      renderer.setRenderTarget(onto);
    },
    dispose() {
      pipeline.dispose();
      shaded?.dispose();
    },
  };
}
