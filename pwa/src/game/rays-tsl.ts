// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAYS ON THE NODE RENDERER (`docs/webgpu.md`, part 18): light worked
// out by marching rays through the frame just drawn, the OPTIONS ▸ PICTURE
// row RAYS (`RAYS_LOOK`). A web page has no hardware ray tracing, so every
// ray here walks the picture's own depth, a pixel at a time:
//
//   THE SHADE (ambient occlusion). Snow in the lee of a trunk, under a
//   bough, at a wall's foot or in a furrow's trough sees less of the sky
//   than open snow does, and the eye reads that dimming as things standing
//   ON the snow rather than pasted over it. Four directions round every
//   pixel, four steps each, find the horizon the depth around it makes
//   (a horizon-based estimate, the idea of three's `GTAONode` cut down to
//   what a phone can march) and the share of the sky above it.
//   THE CONTACT SHADOWS. The key's map is a few centimetres a texel at best,
//   so a boot on the snow, a ski's edge or a gate's foot casts nothing
//   where it touches. From every pixel the sun lights, a short ray toward
//   the sun (half a metre, ten steps) asks the depth whether anything
//   stands in the way (three's `SSSNode` is the same idea): where it does,
//   the pixel takes the shadow's colour, the sky's blue over the sun's
//   white. A pixel the key's map or the mountain already shades is left
//   alone, so no shadow is laid twice.
//   THE MIRROR (`water-tsl.ts`): the lakes and the ice march the reflected
//   ray through the LAST frame's depth and take its colour where it lands,
//   kept here after the grade (`keep`).
//
// THE PASSES, each frame the row is on, between the scene and the grade:
//
//   depth  the picture's depth (multisampled or not: one sample is read)
//          made a distance in metres, half the picture a side.
//   march  the shade in red and the contact light in green, half a side,
//          each pixel's directions turned by a four-by-four pattern.
//   smooth the march's pattern averaged away four by four, across no edge
//          (a sample is weighed by how near its distance is).
//   (grade) the smoothed answer brought up to the whole picture by its four
//          nearest, again across no edge, and laid over the colour.
//
// THE HAZE IS RESPECTED. What the grade reads is a surface's colour already
// mixed into the air in front of it (`hazeOver`), which is affine in the
// surface: `seen = A·surface + B`, `B` the air's own share. A darkening `k`
// of the surface is therefore `k·seen + (1 − k)·B`, with `B` the haze over
// black at the pixel's world point: a far slope under the mist keeps its
// mist, and the air in front of a shaded trunk is not shaded with it. The
// air's share is held under the colour itself, since a material the haze
// is not laid on (the figures near the lens) has no air in front to keep:
// shading never lightens a pixel.
// THE GRADE'S ORDER is kept: the shading is linear light, before the tone
// map and everything after it.
//
// Nothing here runs on WebGL; with the row OFF none of it is built.

import * as THREE from "three";
import * as TSL from "three/tsl";
import { NodeMaterial, QuadMesh, type WebGPURenderer } from "three/webgpu";

import type { HazeUniforms } from "./haze.ts";
import { hazeOver, type N } from "./haze-tsl.ts";
import { lightSlots, terrainLit } from "./lights-tsl.ts";
import type { RaysLook } from "./settings-video.ts";
import { keyShadowOf } from "./shadows-tsl.ts";
import type { KeyLight, SkyLight } from "./world-lights.ts";

const {
  Fn,
  If,
  Loop,
  abs,
  clamp,
  cos,
  cross,
  dot,
  exp,
  float,
  floor,
  ivec2,
  max,
  min,
  mix,
  normalize,
  screenCoordinate,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  textureLoad,
  uniform,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** Every number the rays are marched by: one place, held by
 * `tests/rays_tsl_test.ts`. */
export const RAYS = {
  /** THE SHADE: how far round a point it looks, m, and how it fades with
   * the distance from the lens (whole to `near`, none past `far`), m. */
  shadeRadius: 1.4,
  shadeNear: 70,
  shadeFar: 160,
  /** Its widest reach on the half picture, px: a point closer than the
   * radius would otherwise look across half the screen. */
  shadeMaxPx: 40,
  /** The horizon's angle under which a slope is not its own occluder
   * (sine): the flat snow at a grazing look stays unshaded. */
  shadeBias: 0.14,
  /** How dark the shade lays at its most, 0..1 of the light. */
  shadeStrength: 1,
  /** THE CONTACT SHADOWS: the ray's length toward the sun, m; its steps;
   * how deep behind a surface something is taken to stand, m (a ski is
   * thin: anything deeper is the ground beyond it); and the fade with the
   * distance from the lens, m. */
  contactLength: 0.55,
  contactSteps: 10,
  contactThick: 0.35,
  contactNear: 22,
  contactFar: 40,
  /** How far an edge is: a neighbour's distance off by more than this
   * share of the pixel's own is across one, and weighs nothing. */
  edge: 0.04,
  /** THE MIRROR: the first step, m, each step's growth over the last, the
   * steps (0.6 m × 1.3²³ is some 250 m out), and the reach past which a
   * reflection gives way to the far mirror, m. */
  mirrorStart: 0.6,
  mirrorGrowth: 1.3,
  mirrorSteps: 24,
  mirrorFar: 260,
} as const;

/** The four-by-four pattern that turns each pixel's directions and offsets
 * its steps: every sixteenth of a turn once a tile, so the smoothing's
 * four-by-four average sees every one. */
const PATTERN = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export type NodeRays = {
  /** Ready the picture's target for `look`: its depth kept as a texture
   * while anything is marched, let go otherwise. */
  ready(target: THREE.RenderTarget, look: RaysLook): void;
  /** After the scene: the depth made metres, the rays marched, smoothed. */
  march(target: THREE.RenderTarget, camera: THREE.PerspectiveCamera, look: RaysLook): void;
  /** The grade's colour shaded (linear light, before its tone map). */
  shade(seen: N): N;
  /** After the grade: the frame kept for the water's mirror (MAX). */
  keep(target: THREE.RenderTarget, camera: THREE.PerspectiveCamera, look: RaysLook): void;
  dispose(): void;
};

/** What the water's mirror reads (`water-tsl.ts`): the last frame's colour
 * and distance, the lens it was drawn through, and whether there is one. */
export type RayHistory = {
  colour: N;
  depth: N;
  view: N;
  proj: N;
  on: N;
};

/** A target of half floats, `channels` wide, sampled straight. */
function halfTarget(format: THREE.PixelFormat, type: THREE.TextureDataType): THREE.RenderTarget {
  const t = new THREE.RenderTarget(1, 1, {
    type,
    format,
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  t.texture.colorSpace = THREE.NoColorSpace;
  return t;
}

/** A pass of one full-screen quad over `fragment`. */
function quadOf(name: string, fragment: N): QuadMesh {
  const material = new NodeMaterial();
  material.name = name;
  material.fragmentNode = fragment;
  material.depthTest = false;
  material.depthWrite = false;
  const quad = new QuadMesh(material);
  quad.name = name;
  return quad;
}

/** The view-space point at texel `c` of a picture `size` texels wide, at
 * distance `z` along the lens (`p00`, `p11` the projection's scale). */
function viewAt(c: N, size: N, z: N, p00: N, p11: N): N {
  const uv = vec2(c).add(0.5).div(size);
  const ndc = vec2(uv.x.mul(2).sub(1), float(1).sub(uv.y.mul(2)));
  return vec3(ndc.x.mul(z).div(p00), ndc.y.mul(z).div(p11), z.negate());
}

const shared = new WeakMap<HazeUniforms, RayHistory & { stand: THREE.Texture }>();

/** The water's mirror's view of the rays' history, one per haze. */
export function rayHistory(u: HazeUniforms): RayHistory {
  let h = shared.get(u);
  if (!h) {
    const stand = new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RedFormat);
    stand.type = THREE.HalfFloatType;
    stand.minFilter = stand.magFilter = THREE.NearestFilter;
    stand.needsUpdate = true;
    const colour = new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RGBAFormat);
    colour.type = THREE.HalfFloatType;
    colour.needsUpdate = true;
    h = {
      stand,
      colour: texture(colour),
      depth: texture(stand),
      view: uniform(new THREE.Matrix4()),
      proj: uniform(new THREE.Matrix4()),
      on: uniform(0),
    };
    shared.set(u, h);
  }
  return h;
}

/** THE MIRROR'S MARCH (`water-tsl.ts`, RAYS MAX): from world point `from`
 * along the reflected ray `dir`, step by growing step through the last
 * frame's distances, the colour it drew where the ray first passes behind
 * a surface — faded toward `fallback` (the mirror of the sky and the far
 * hills) at the picture's edges, at the end of the march and where it
 * finds nothing. The last frame's lens is the one projected through, so a
 * still world reflects where it stands while the lens moves; only what
 * moves itself is a frame late in the water. */
export function mirrorMarch(h: RayHistory, from: N, dir: N, fallback: N): N {
  return Fn(() => {
    const got = vec4(fallback, 0).toVar();
    If(h.on.greaterThan(0.5), () => {
      const t = float(RAYS.mirrorStart).toVar();
      const lo = float(0).toVar();
      const hi = float(0).toVar();
      const found = float(0).toVar();
      /** Where the ray at `s` m stands in the last frame: its uv, how far
       * behind what was drawn there it is, m, and whether it is on it. */
      const probe = (s: N): { uv: N; behind: N; inside: N } => {
        const v = h.view.mul(vec4(from.add(dir.mul(s)), 1));
        const c = h.proj.mul(v);
        const ndc = c.xy.div(c.w);
        const uv = vec2(ndc.x.mul(0.5).add(0.5), float(0.5).sub(ndc.y.mul(0.5)));
        const drawn = h.depth.sample(uv).level(0).setUpdateMatrix(false).x;
        const inside = uv.x
          .greaterThan(0)
          .and(uv.x.lessThan(1))
          .and(uv.y.greaterThan(0))
          .and(uv.y.lessThan(1))
          .and(c.w.greaterThan(0));
        return { uv, behind: v.z.negate().sub(drawn), inside };
      };
      Loop(RAYS.mirrorSteps, () => {
        If(found.lessThan(0.5), () => {
          const p = probe(t);
          const thick = max(t.mul(0.2), 0.6);
          If(p.inside.and(p.behind.greaterThan(0)).and(p.behind.lessThan(thick)), () => {
            found.assign(1);
            lo.assign(t.div(RAYS.mirrorGrowth));
            hi.assign(t);
          });
          t.mulAssign(RAYS.mirrorGrowth);
        });
      });
      If(found.greaterThan(0.5), () => {
        Loop(4, () => {
          const mid = lo.add(hi).mul(0.5);
          const p = probe(mid);
          // Braced: a block that hands back a node is read as a return.
          If(p.behind.greaterThan(0), () => {
            hi.assign(mid);
          }).Else(() => {
            lo.assign(mid);
          });
        });
        const p = probe(hi);
        const edge = min(min(p.uv.x, float(1).sub(p.uv.x)), min(p.uv.y, float(1).sub(p.uv.y)));
        const reach = float(1).sub(smoothstep(RAYS.mirrorFar * 0.6, RAYS.mirrorFar, hi));
        const sure = smoothstep(0, 0.08, edge).mul(reach);
        const colour = h.colour.sample(p.uv).level(0).setUpdateMatrix(false).rgb;
        got.assign(vec4(mix(fallback, colour, sure), sure));
      });
    });
    return got.rgb;
  })();
}

export function createNodeRays(
  renderer: WebGPURenderer,
  haze: HazeUniforms,
  key: KeyLight | null,
  sky: SkyLight | null,
): NodeRays {
  const depthTex = new THREE.DepthTexture(4, 4);
  const lin = halfTarget(THREE.RedFormat, THREE.HalfFloatType);
  const raw = halfTarget(THREE.RGFormat, THREE.UnsignedByteType);
  const soft = halfTarget(THREE.RGFormat, THREE.UnsignedByteType);
  soft.texture.minFilter = soft.texture.magFilter = THREE.NearestFilter;
  const history = rayHistory(haze);
  /** The last frame's colour, copied off the picture's target: a target of
   * its own so it is made in the target's format (a framebuffer texture is
   * made in the canvas's, which a half-float target cannot be copied to). */
  const kept = halfTarget(THREE.RGBAFormat, THREE.HalfFloatType);
  kept.texture.minFilter = kept.texture.magFilter = THREE.LinearFilter;
  let made = false;

  const near = uniform(0.1);
  const far = uniform(1000);
  const p00 = uniform(1);
  const p11 = uniform(1);
  const half = uniform(new THREE.Vector2(1, 1));
  const full = uniform(new THREE.Vector2(1, 1));
  const lens = uniform(new THREE.Matrix4()); // the camera's world matrix
  const sunView = uniform(new THREE.Vector3(0, 1, 0));
  const contactOn = uniform(0);
  const keyOn = uniform(0);
  const keyMatrix = uniform(new THREE.Matrix4());
  /** The shadow's colour over the lit one, per channel: the sky alone over
   * the sky and the sun on open snow. */
  const shadeTint = uniform(new THREE.Vector3(1, 1, 1));
  const blank = new THREE.DepthTexture(1, 1);
  blank.compareFunction = THREE.LessEqualCompare;
  const keyMap = texture(blank);

  const depthNode = texture(depthTex);
  const linNode = texture(lin.texture);
  const rawNode = texture(raw.texture);
  const softNode = texture(soft.texture);

  /** Metres along the lens at window depth `d` (WebGL's and WebGPU's
   * depth alike: both write `far·(1 − near/z)/(far − near)`). */
  const metres = (d: N): N => near.mul(far).div(far.sub(d.mul(far.sub(near))));

  // DEPTH: one sample of the picture's depth at the half texel's corner.
  const depthPass = quadOf(
    "rays-depth",
    Fn(() => {
      const c = ivec2(floor(screenCoordinate.xy)).mul(2);
      const d = textureLoad(depthNode, c).x;
      return vec4(select(d.greaterThanEqual(1), float(60000), metres(d)), 0, 0, 1);
    })(),
  );

  /** A half texel held on the picture: a read off its edge is the edge's
   * own, never the nothing past it (which reads as a wall at the lens). */
  const onHalf = (c: N): N => clamp(c, ivec2(0, 0), ivec2(half).sub(1));
  const zAt = (c: N): N => textureLoad(linNode, onHalf(c)).x;

  // MARCH: the shade and the contact light.
  const marchPass = quadOf(
    "rays-march",
    Fn(() => {
      const c = ivec2(floor(screenCoordinate.xy)).toVar();
      const z = zAt(c).toVar();
      const out = vec4(1, 1, 0, 1).toVar();
      If(z.lessThan(far.mul(0.98)), () => {
        const p = viewAt(c, half, z, p00, p11).toVar();
        const pl = viewAt(c.sub(ivec2(1, 0)), half, zAt(c.sub(ivec2(1, 0))), p00, p11);
        const pr = viewAt(c.add(ivec2(1, 0)), half, zAt(c.add(ivec2(1, 0))), p00, p11);
        const pu = viewAt(c.sub(ivec2(0, 1)), half, zAt(c.sub(ivec2(0, 1))), p00, p11);
        const pd = viewAt(c.add(ivec2(0, 1)), half, zAt(c.add(ivec2(0, 1))), p00, p11);
        // The normal off the nearer neighbour each way: across no edge.
        const dx = select(abs(pr.z.sub(p.z)).lessThan(abs(p.z.sub(pl.z))), pr.sub(p), p.sub(pl));
        const dy = select(abs(pd.z.sub(p.z)).lessThan(abs(p.z.sub(pu.z))), pd.sub(p), p.sub(pu));
        const n0 = normalize(cross(dy, dx)).toVar();
        const n = select(dot(n0, p).greaterThan(0), n0.negate(), n0).toVar();
        const i = c.x.mod(4).add(c.y.mod(4).mul(4));
        let turn: N = float(PATTERN[15]);
        for (let k = 14; k >= 0; k--) turn = select(i.equal(k), float(PATTERN[k]), turn);
        const jitter = turn.add(0.5).div(16).toVar();

        // THE SHADE.
        const reach = min(
          float(RAYS.shadeRadius).mul(p00).mul(half.x).mul(0.5).div(z),
          RAYS.shadeMaxPx,
        ).toVar();
        const shade = float(0).toVar();
        If(reach.greaterThan(1.5), () => {
          const sum = float(0).toVar();
          Loop(4, ({ i: dir }: { i: N }) => {
            const a = float(dir)
              .add(jitter)
              .mul(Math.PI / 2);
            const step = vec2(cos(a), sin(a));
            const most = float(0).toVar();
            Loop(4, ({ i: s }: { i: N }) => {
              const t = float(s).add(jitter).add(0.5).div(4);
              const at = c.add(ivec2(step.mul(reach).mul(t.mul(t))));
              const q = viewAt(at, half, zAt(at), p00, p11);
              const v = q.sub(p);
              const d = sqrt(dot(v, v)).max(1e-3);
              const fall = float(1).sub(clamp(d.div(RAYS.shadeRadius), 0, 1).pow(2));
              // A step off the picture sees nothing: no horizon from it.
              const seen = at.x
                .greaterThanEqual(0)
                .and(at.y.greaterThanEqual(0))
                .and(float(at.x).lessThan(half.x))
                .and(float(at.y).lessThan(half.y));
              const rise = dot(n, v).div(d).sub(RAYS.shadeBias).mul(fall);
              most.assign(select(seen, max(most, rise), most));
            });
            sum.addAssign(clamp(most, 0, 1));
          });
          shade.assign(sum.div(4));
        });
        const shadeFade = float(1).sub(smoothstep(RAYS.shadeNear, RAYS.shadeFar, z));
        out.x.assign(float(1).sub(shade.mul(shadeFade)));

        // THE CONTACT SHADOWS, where the sun lights the pixel at all.
        If(contactOn.greaterThan(0.5).and(z.lessThan(RAYS.contactFar)), () => {
          const facing = dot(n, sunView);
          const world = lens.mul(vec4(p.add(n.mul(0.04)), 1)).xyz.toVar();
          const sc = keyMatrix.mul(vec4(world, 1)).toVar();
          const kc = sc.xyz.div(sc.w).toVar();
          const inMap = kc.x
            .greaterThan(0)
            .and(kc.x.lessThan(1))
            .and(kc.y.greaterThan(0))
            .and(kc.y.lessThan(1));
          const mapped = keyMap
            .sample(vec2(kc.x, float(1).sub(kc.y)))
            .setUpdateMatrix(false)
            .compare(kc.z.sub(0.0004));
          const keyLit = select(keyOn.greaterThan(0.5).and(inMap), mapped, float(1));
          const lit = smoothstep(0.02, 0.12, facing)
            .mul(keyLit)
            .mul(terrainLit(lightSlots(haze), world))
            .toVar();
          const hit = float(0).toVar();
          If(lit.greaterThan(0.01), () => {
            const len = float(RAYS.contactLength).mul(clamp(z.div(6), 0.35, 1));
            Loop(RAYS.contactSteps, ({ i: s }: { i: N }) => {
              const t = float(s).add(jitter).div(RAYS.contactSteps);
              const q = p.add(sunView.mul(len.mul(t))).add(n.mul(0.02));
              const ndc = vec2(q.x.mul(p00), q.y.mul(p11)).div(q.z.negate());
              const uv = vec2(ndc.x.mul(0.5).add(0.5), float(0.5).sub(ndc.y.mul(0.5)));
              const at = ivec2(uv.mul(half));
              const inside = uv.x
                .greaterThan(0)
                .and(uv.x.lessThan(1))
                .and(uv.y.greaterThan(0))
                .and(uv.y.lessThan(1));
              const behind = q.z.negate().sub(zAt(at));
              const blocked = behind
                .greaterThan(z.mul(0.002).add(0.01))
                .and(behind.lessThan(RAYS.contactThick));
              hit.assign(max(hit, select(inside.and(blocked), float(1).sub(t.mul(0.5)), 0)));
            });
          });
          const contactFade = float(1).sub(smoothstep(RAYS.contactNear, RAYS.contactFar, z));
          out.y.assign(float(1).sub(hit.mul(lit).mul(contactFade)));
        });
      });
      return out;
    })(),
  );

  // SMOOTH: four by four, weighed by how near each distance is.
  const smoothPass = quadOf(
    "rays-smooth",
    Fn(() => {
      const c = ivec2(floor(screenCoordinate.xy)).toVar();
      const z = zAt(c).toVar();
      const sum = vec2(0, 0).toVar();
      const weight = float(0).toVar();
      for (let y = -2; y <= 1; y++) {
        for (let x = -2; x <= 1; x++) {
          const at = c.add(ivec2(x, y));
          const w = exp(abs(zAt(at).sub(z)).div(z.mul(RAYS.edge)).negate());
          sum.addAssign(textureLoad(rawNode, onHalf(at)).xy.mul(w));
          weight.addAssign(w);
        }
      }
      return vec4(sum.div(max(weight, 1e-4)), 0, 1);
    })(),
  );

  const air = { display: float(0), exposure: float(1) };
  return {
    ready(target, look) {
      const on = look.shade || look.contact || look.mirror;
      const want = on ? depthTex : null;
      if (target.depthTexture === want) return;
      target.depthTexture = want;
      target.resolveDepthBuffer = on;
      target.dispose();
    },
    march(target, camera, look) {
      const w = target.width;
      const h = target.height;
      const hw = Math.max(1, Math.ceil(w / 2));
      const hh = Math.max(1, Math.ceil(h / 2));
      for (const t of [lin, raw, soft]) if (t.width !== hw || t.height !== hh) t.setSize(hw, hh);
      half.value.set(hw, hh);
      full.value.set(w, h);
      near.value = camera.near;
      far.value = camera.far;
      p00.value = camera.projectionMatrix.elements[0];
      p11.value = camera.projectionMatrix.elements[5];
      lens.value.copy(camera.matrixWorld);
      contactOn.value = look.contact ? 1 : 0;
      if (key) {
        const dir = new THREE.Vector3()
          .subVectors(key.position, key.target.position)
          .normalize()
          .transformDirection(camera.matrixWorldInverse);
        sunView.value.copy(dir);
        const shadow =
          (keyShadowOf(key) as unknown as { shadowMap?: THREE.RenderTarget | null } | null)
            ?.shadowMap?.depthTexture ?? null;
        const mapped = key.castShadow && renderer.shadowMap.enabled && shadow;
        keyOn.value = mapped ? 1 : 0;
        if (mapped && keyMap.value !== shadow) keyMap.value = shadow;
        keyMatrix.value.copy(key.shadow.matrix);
        // The shadow's colour: the sky's light alone over it and the key's
        // on open snow (both over the same albedo, which cancels).
        const up = Math.max(
          0,
          new THREE.Vector3().subVectors(key.position, key.target.position).normalize().y,
        );
        const k = key.color.clone().multiplyScalar(key.intensity * up);
        const s = sky ? sky.color.clone().multiplyScalar(sky.intensity) : new THREE.Color(0, 0, 0);
        shadeTint.value.set(
          s.r / Math.max(1e-4, s.r + k.r),
          s.g / Math.max(1e-4, s.g + k.g),
          s.b / Math.max(1e-4, s.b + k.b),
        );
      }
      const onto = renderer.getRenderTarget();
      renderer.setRenderTarget(lin);
      depthPass.render(renderer);
      renderer.setRenderTarget(raw);
      marchPass.render(renderer);
      renderer.setRenderTarget(soft);
      smoothPass.render(renderer);
      renderer.setRenderTarget(onto);
    },
    shade(seen) {
      return Fn(() => {
        const c = ivec2(floor(screenCoordinate.xy)).toVar();
        const d = textureLoad(depthNode, c).x.toVar();
        const out = vec3(seen).toVar();
        If(d.lessThan(1), () => {
          const z = metres(d).toVar();
          // The four nearest half texels, weighed by place and distance.
          const hp = vec2(c).add(0.5).mul(0.5).sub(0.5);
          const base = ivec2(floor(hp)).toVar();
          const f = hp.sub(floor(hp)).toVar();
          const sum = vec2(0, 0).toVar();
          const weight = float(0).toVar();
          for (const [x, y] of [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ]) {
            const at = base.add(ivec2(x, y));
            const wx = x === 0 ? float(1).sub(f.x) : f.x;
            const wy = y === 0 ? float(1).sub(f.y) : f.y;
            const w = wx
              .mul(wy)
              .add(1e-3)
              .mul(exp(abs(zAt(at).sub(z)).div(z.mul(RAYS.edge)).negate()));
            sum.addAssign(textureLoad(softNode, onHalf(at)).xy.mul(w));
            weight.addAssign(w);
          }
          const got = select(weight.greaterThan(1e-4), sum.div(max(weight, 1e-4)), vec2(1, 1));
          const ao = mix(1, got.x, RAYS.shadeStrength);
          const k = mix(shadeTint, vec3(1), got.y).mul(ao).toVar();
          const view = viewAt(c, full, z, p00, p11);
          const world = lens.mul(vec4(view, 1)).xyz;
          // Never over the colour itself: a figure no haze is laid on
          // (its material unhazed) has no air in front to keep.
          const b = min(hazeOver(haze, air, vec3(0), world), seen);
          out.assign(seen.mul(k).add(b.mul(float(1).sub(k))));
        });
        return out;
      })();
    },
    keep(target, camera, look) {
      history.on.value = look.mirror ? 1 : 0;
      if (!look.mirror) return;
      if (!made || kept.width !== target.width || kept.height !== target.height) {
        made = true;
        kept.setSize(target.width, target.height);
        renderer.initRenderTarget(kept);
      }
      renderer.copyTextureToTexture(target.texture, kept.texture);
      if (history.colour.value !== kept.texture) history.colour.value = kept.texture;
      if (history.depth.value !== lin.texture) history.depth.value = lin.texture;
      history.view.value.copy(camera.matrixWorldInverse);
      history.proj.value.copy(camera.projectionMatrix);
    },
    dispose() {
      depthTex.dispose();
      for (const t of [lin, raw, soft]) t.dispose();
      for (const q of [depthPass, marchPass, smoothPass]) (q.material as NodeMaterial).dispose();
      kept.dispose();
      blank.dispose();
    },
  };
}
