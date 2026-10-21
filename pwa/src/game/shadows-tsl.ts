// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHADOWS ON THE NODE RENDERER (`docs/webgpu.md`, part 6): what
// `haze.ts`'s GLSL and `terrain-shade.ts`'s depth graft do to the key's
// shadow on WebGL, restated for the webgpu paths over the SAME uniforms.
//
//   KeyShadowNode   the key's own shadow map — three's, PCF, with the
//                   key's bias and normal bias — made on the GPU the
//                   moment it is made at all, and drawn with every caster
//                   `castInLight` dressed cut where the mountain already
//                   shades it (`castMask`): WebGL's `shadeDepth`.
//   heroShadowed    the skiers' own maps (`hero-shadow.ts`), a quarter of
//                   one depth atlas each, looked up through a comparing
//                   sampler nine taps at a time and taken with the key's
//                   shadow, the darkest of them (`HERO_SHADOW_GLSL`).
//   shadeDepthTwin  the depth the skiers' passes draw with
//                   (`createShadeDepth`), the mountain's shade discarded.
//
// THE MAP IS MADE BEFORE ANYTHING BINDS IT. Three makes a shadow map's
// depth texture the first time a material binds it, as a plain texture, and
// makes it again under the bindings the first time its pass draws into it:
// every pipeline built in between stays bound to the texture destroyed, and
// the device refuses every frame after. A pass that always runs first hides
// that (the first frame draws the map before it binds it), but the
// warm-up's compile binds every material with no pass drawn
// (`environment.ts`'s `warmNode`). So the map is made as a target on the
// GPU in the same breath three makes it (`setupRenderTarget`).
//
// THE ATLAS IS LAID OUT TOP DOWN. On the node renderer a target's row 0 is
// its top: a quarter's viewport is counted from the top and a sampled uv's
// v runs down. `hero-shadow.ts` writes the matrices with v flipped
// (`heroBias`), so a slot's taps sit at the same corner, and the clamp that
// keeps them inside their quarter is the GLSL's mirrored in v.

import * as THREE from "three";
import {
  Fn,
  If,
  clamp,
  float,
  min,
  normalWorld,
  positionWorld,
  texture,
  vec2,
  vec4,
} from "three/tsl";
import {
  MeshBasicNodeMaterial,
  ShadowNode,
  type NodeBuilder,
  type NodeMaterial,
  type WebGPURenderer,
} from "three/webgpu";

import { figureShadowOf } from "./figure-twins-tsl.ts";
import { HERO_SLOTS, type HazeUniforms } from "./haze.ts";
import { slot, type N } from "./haze-tsl.ts";
import { lightSlots, terrainLit } from "./lights-tsl.ts";
import type { KeyLight } from "./world-lights.ts";

/** What stands in the atlas's slot before the skiers' map is made: a
 * comparing depth texture, as the binding is laid out for. */
function blankDepth(): THREE.DepthTexture {
  const d = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  d.compareFunction = THREE.LessEqualCompare;
  d.minFilter = d.magFilter = THREE.LinearFilter;
  return d;
}

/** A slot's own component of a vec4 of four (`uHeroOn`, `uHeroBias`):
 * swizzled, since `element` on a vector reads it as an array. */
const XYZW = ["x", "y", "z", "w"] as const;

/** The skiers' maps' slots of the shared uniforms. */
export type HeroSlots = ReturnType<typeof makeHero>;

function makeHero(u: HazeUniforms) {
  const blank = blankDepth();
  return {
    u,
    blank,
    map: texture(u.uHeroMap.value ?? blank) as N,
    // Each matrix is set in place (`hero-shadow.ts`), never replaced.
    matrix: u.uHeroMatrix.value.map((m) => slot({ value: m }, "mat4")),
    on: slot(u.uHeroOn, "vec4"),
    bias: slot(u.uHeroBias, "vec4"),
    hero: slot(u.uHero, "vec4"),
  };
}

const heroes = new WeakMap<HazeUniforms, HeroSlots>();
export function heroSlots(u: HazeUniforms): HeroSlots {
  let s = heroes.get(u);
  if (!s) heroes.set(u, (s = makeHero(u)));
  return s;
}

/** The atlas re-pointed at what the slot holds this frame (a SHADOWS row
 * moved makes a new one). */
export function syncHero(s: HeroSlots): void {
  const map = s.u.uHeroMap.value ?? s.blank;
  if (s.map.value !== map) s.map.value = map;
}

/** One comparing tap of slot `corner`'s quarter at `uv` (its own 0..1),
 * held a texel inside it as the GLSL holds it — mirrored in v. */
function heroTap(s: HeroSlots, uv: N, corner: N, z: N): N {
  const t = s.hero.y;
  const held = clamp(
    uv,
    vec2(t.mul(0.5), t.mul(1.5)),
    vec2(t.mul(-1.5).add(1), t.mul(-0.5).add(1)),
  );
  return s.map
    .sample(corner.add(held.mul(0.5)))
    .setUpdateMatrix(false)
    .compare(z);
}

/** Slot `i`'s shadow at the point: 1 outside his box, else nine taps a
 * texel and a quarter apart (`heroSlot`). */
function heroSlot(s: HeroSlots, i: number): N {
  const corner = vec2((i % 2) * 0.5, Math.floor(i / 2) * 0.5);
  const nb = s.bias[XYZW[i]];
  return Fn(() => {
    const lit = float(1).toVar();
    const hc = s.matrix[i].mul(vec4(positionWorld.add(normalWorld.mul(nb)), 1));
    const p = hc.xyz.div(hc.w).toVar();
    const inside = p.x
      .greaterThan(0)
      .and(p.x.lessThan(1))
      .and(p.y.greaterThan(0))
      .and(p.y.lessThan(1))
      .and(p.z.lessThan(1));
    If(inside, () => {
      const z = p.z.sub(s.hero.z);
      const gap = s.hero.y.mul(1.25);
      let sum: N = float(0);
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          sum = sum.add(heroTap(s, p.xy.add(vec2(k, j).mul(gap)), corner, z));
        }
      }
      lit.assign(sum.div(9));
    });
    return lit;
  })();
}

/** THE SKIERS' OWN MAPS taken with `shadow`, the darkest of them
 * (`heroShadowed`). */
export function heroShadowed(u: HazeUniforms, shadow: N): N {
  const s = heroSlots(u);
  return Fn(() => {
    const out = float(shadow).toVar();
    If(s.hero.x.greaterThanEqual(0.5), () => {
      for (let i = 0; i < HERO_SLOTS; i++) {
        If(s.on[XYZW[i]].greaterThan(0.5), () => {
          out.assign(min(out, heroSlot(s, i)));
        });
      }
    });
    return out;
  })();
}

/** Whether the point takes the key past the mountain's own shadow — what a
 * caster keeps of itself (`terrainLit(…) < 0.5` is discarded). */
const masks = new WeakMap<HazeUniforms, N>();
export function castMask(u: HazeUniforms): N {
  let m = masks.get(u);
  if (!m) masks.set(u, (m = terrainLit(lightSlots(u), positionWorld).greaterThanEqual(0.5)));
  return m;
}

/** Whether `object` draws its depth through the mountain's shade on WebGL
 * (`castInLight`, `createShadeDepth`). */
const shadeCast = (object: THREE.Object3D): boolean =>
  (object.customDepthMaterial as THREE.Material | undefined)?.userData.shadeCast === true;

/** What a material's shadow pass is cut by: three reads it off the drawn
 * material (`maskShadowNode`, which a classic material carries as a plain
 * field), and keeps what it read per material until the material moves. */
type Masked = THREE.Material & { maskShadowNode?: N };
type Cache = { _cacheShadowNodes?: WeakMap<THREE.Material, unknown> };

function maskCaster(renderer: WebGPURenderer, material: Masked, u: HazeUniforms): void {
  if (material.maskShadowNode) return;
  material.maskShadowNode = castMask(u);
  (renderer as unknown as Cache)._cacheShadowNodes?.delete(material);
}

type RenderFn = (object: THREE.Object3D, ...rest: unknown[]) => void;
type MadeMap = { shadowMap: THREE.RenderTarget; depthTexture: THREE.DepthTexture };
type MakeMap = (this: ShadowNode, shadow: THREE.LightShadow, builder: NodeBuilder) => MadeMap;

/** Every KeyShadowNode made, by its light: what the warm-up asks for. */
const keyShadows = new WeakMap<THREE.Light, KeyShadowNode>();
export const keyShadowOf = (light: THREE.Light): KeyShadowNode | null =>
  keyShadows.get(light) ?? null;

/** THE KEY'S SHADOW MAP (see the header). */
export class KeyShadowNode extends ShadowNode {
  static get type(): string {
    return "KeyShadowNode";
  }

  private readonly wrapped = new WeakMap<RenderFn, RenderFn>();

  constructor(light: KeyLight) {
    super(light, light.shadow);
    keyShadows.set(light, this);
  }

  setupRenderTarget(shadow: THREE.LightShadow, builder: NodeBuilder): MadeMap {
    // Three's own, missing from its types.
    const own = (ShadowNode.prototype as unknown as { setupRenderTarget: MakeMap })
      .setupRenderTarget;
    const made = own.call(this, shadow, builder);
    (builder.renderer as WebGPURenderer).initRenderTarget(made.shadowMap);
    return made;
  }

  getShadowRenderObjectFunction(renderer: WebGPURenderer, shadow?: THREE.LightShadow): RenderFn {
    const inner = super.getShadowRenderObjectFunction(renderer, shadow) as RenderFn;
    const haze = (this.light as KeyLight).haze;
    if (!haze) return inner;
    let outer = this.wrapped.get(inner);
    if (!outer) {
      outer = (object, ...rest) => {
        // `rest[3]` is the material drawn (three's render-object call).
        if (object.castShadow && shadeCast(object)) maskCaster(renderer, rest[3] as Masked, haze);
        // A figure whose WebGL depth takes its graft is drawn by a shadow
        // material moved the same way (`figure-twins-tsl.ts`), `rest[0]`
        // the scene the pass overrides.
        const figure = object.castShadow ? figureShadowOf(object.customDepthMaterial) : null;
        if (!figure) return inner(object, ...rest);
        const scene = rest[0] as THREE.Scene;
        const own = scene.overrideMaterial;
        scene.overrideMaterial = figure;
        try {
          inner(object, ...rest);
        } finally {
          scene.overrideMaterial = own;
        }
      };
      this.wrapped.set(inner, outer);
    }
    return outer;
  }
}

/** The skiers' passes' depth (`createShadeDepth`): nothing but depth, its
 * side the source's, the mountain's shade discarded. */
export function shadeDepthTwin(material: THREE.Material, u: HazeUniforms): NodeMaterial {
  const twin = new MeshBasicNodeMaterial();
  twin.name = "shade-depth";
  twin.side = material.side;
  twin.colorWrite = material.colorWrite;
  twin.fog = false;
  twin.lights = false;
  twin.maskNode = castMask(u);
  return twin;
}
