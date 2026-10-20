// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE KEY, THE SKY AND THE LAMPS ON THE NODE RENDERER: what `haze.ts`'s GLSL
// grafts into three's lighting on every hazed material, restated as the
// node renderer's light nodes (`docs/webgpu.md`, part 2). Registered by
// class on the renderer's library (`gpu-dress.ts`), so they light every
// material the node renderer draws — and do their extra only on a material
// `hazeMaterial` dressed (`userData.haze`), as WebGL does.
//
//   KeyLightNode   the key (`world-lights.ts`'s `KeyLight`): its light by
//                  the point's height (`keyAtHeight`, the peaks'
//                  alpenglow) and through the clouds (`cloudShadow`), its
//                  shadow faded out over the shadow box's rim
//                  (`shadowFaded`), taken with the skiers' own maps
//                  (`heroShadowed`, `shadows-tsl.ts`) and with the
//                  mountain's own (`terrainLit`), the darkest of them —
//                  and the mountain's alone on a material that takes no
//                  shadow. Its map is `shadows-tsl.ts`'s `KeyShadowNode`.
//   SkyLightNode   the hemisphere (`SkyLight`): its light lifted in the
//                  mountain's shade at a low sun (`uShadeLift`).
//   LampsLight     the six lamp slots and the piste lights' map, on the
//                  side of a surface that faces each (`LAMP_FRAGMENT`).
//
// The mountain's shadow map (`terrain-shade.ts`) is baked on the CPU and
// uploaded, so it is read here as on WebGL. The STAND-IN for the pass not
// ported yet, a hook its part replaces: the clouds' shadow map
// (`cloudShadow`, part 10) is 1.

import * as THREE from "three";
import {
  BRDF_Lambert,
  Break,
  Fn,
  If,
  Loop,
  clamp,
  diffuseColor,
  dot,
  float,
  length,
  max,
  min,
  mix,
  normalWorld,
  positionWorld,
  smoothstep,
  texture,
  vec3,
} from "three/tsl";
import {
  DirectionalLightNode,
  HemisphereLightNode,
  LightingNode,
  type NodeBuilder,
  type TextureNode,
  type WebGPURenderer,
} from "three/webgpu";

import { LAMP_SLOTS, type HazeUniforms } from "./haze.ts";
import { slot, standIn, tap, type N } from "./haze-tsl.ts";
import { KeyShadowNode, heroShadowed } from "./shadows-tsl.ts";
import { KEY_BANDS } from "./sky-light.ts";
import { TERRAIN_SHADOW } from "./terrain-shadow.ts";
import { SkyLight, KeyLight } from "./world-lights.ts";

/** Whether the material being built is one `hazeMaterial` dressed. */
const hazed = (builder: NodeBuilder): boolean =>
  (builder.material as THREE.Material | null)?.userData.haze === true;

/** The lighting slots of the shared uniforms, and the maps the frame
 * re-points (`syncLights`). */
export type LightSlots = ReturnType<typeof makeSlots>;

function makeSlots(u: HazeUniforms) {
  const blank = standIn();
  return {
    u,
    blank,
    sunDir: slot(u.uSunDir, "vec3"),
    keyBandY: slot(u.uKeyBandY, "vec4"),
    keyBand: slot(u.uKeyBand, "vec3"),
    shadowFade: slot(u.uShadowFade, "vec4"),
    shadeLift: slot(u.uShadeLift, "float"),
    shade: texture(u.uTerrainShade.value ?? blank),
    shadeBox: slot(u.uTerrainShadeBox, "vec4"),
    shadeOn: slot(u.uTerrainShadeOn, "vec4"),
    lampPos: slot(u.uLampPos, "vec3"),
    lampDir: slot(u.uLampDir, "vec3"),
    lampOn: slot(u.uLampOn, "float"),
    lampCol: slot(u.uLampCol, "vec3"),
    lampBeam: slot(u.uLampBeam, "vec4"),
    piste: texture(u.uPisteLight.value ?? blank),
    pisteBox: slot(u.uPisteBox, "vec4"),
    pisteOn: slot(u.uPisteOn, "vec4"),
    pisteCol: slot(u.uPisteCol, "vec3"),
  };
}

const slotsOf = new WeakMap<HazeUniforms, LightSlots>();
export function lightSlots(u: HazeUniforms): LightSlots {
  let s = slotsOf.get(u);
  if (!s) slotsOf.set(u, (s = makeSlots(u)));
  return s;
}

/** Re-point the maps at what the slots hold this frame (a slot with none
 * reads the blank, behind its own switch). */
export function syncLights(s: LightSlots): void {
  const shade = s.u.uTerrainShade.value ?? s.blank;
  if (s.shade.value !== shade) s.shade.value = shade;
  const piste = s.u.uPisteLight.value ?? s.blank;
  if (s.piste.value !== piste) s.piste.value = piste;
}

const sample = (t: TextureNode, uv: N): N => tap(t, uv);

/** THE MOUNTAIN'S OWN SHADOW at `world` (`TERRAIN_SHADOW_GLSL`'s `terrainLit`). */
export function terrainLit(s: LightSlots, world: N): N {
  return Fn(() => {
    const lit = float(1).toVar();
    If(s.shadeOn.x.greaterThanEqual(0.5), () => {
      const uv = world.xz.sub(s.shadeBox.xy).mul(s.shadeBox.zw);
      const pair = sample(s.shade, uv).xy;
      const horizon = mix(pair.x, pair.y, s.shadeOn.y);
      const elevation = clamp(s.sunDir.y, -1, 1).asin();
      const band = TERRAIN_SHADOW.band;
      const sun = smoothstep(-band, band, elevation.sub(horizon).add(TERRAIN_SHADOW.bias));
      const past = max(max(uv.negate(), uv.sub(1)), 0).div(s.shadeBox.zw);
      lit.assign(mix(sun, 1, smoothstep(0, TERRAIN_SHADOW.rim, length(past))));
    });
    return lit;
  })();
}

/** THE KEY'S SHARE AT HEIGHT `y` (`SKY_LIGHT_GLSL`'s `keyAtHeight`). */
export function keyAtHeight(s: LightSlots, y: N): N {
  const band = (i: number): N => s.keyBand.element(i);
  const by = s.keyBandY;
  const low = mix(band(0), band(1), clamp(y.sub(by.x).div(max(by.y.sub(by.x), 1e-3)), 0, 1));
  const mid = mix(band(1), band(2), y.sub(by.y).div(max(by.z.sub(by.y), 1e-3)));
  const high = mix(band(2), band(3), clamp(y.sub(by.z).div(max(by.w.sub(by.z), 1e-3)), 0, 1));
  return y.lessThanEqual(by.y).select(low, y.lessThanEqual(by.z).select(mid, high));
}
if (KEY_BANDS !== 4) throw new Error("lights-tsl.ts: keyAtHeight reads four bands");

/** The sun's shadow faded out over the shadow box's rim (`shadowFaded`). */
function shadowFaded(s: LightSlots, shadow: N): N {
  const d = length(positionWorld.xz.sub(s.shadowFade.xy));
  return mix(shadow, 1, smoothstep(s.shadowFade.z, s.shadowFade.w, d));
}

/** What an analytic light node keeps between builds (three's own fields). */
type Kept = {
  colorNode: N;
  baseColorNode: N | null;
  shadowNode: (N & { dispose(): void }) | null;
  shadowColorNode: N | null;
};

/** THE KEY on the node renderer (see the header). */
export class KeyLightNode extends DirectionalLightNode {
  static get type(): string {
    return "KeyLightNode";
  }

  /** The key's map is ours (`shadows-tsl.ts`), on every material it lights. */
  setupShadowNode(): N {
    return new KeyShadowNode(this.light as KeyLight);
  }

  setup(builder: NodeBuilder): N {
    const light = this.light as KeyLight;
    if (!light.haze || !hazed(builder)) return super.setup(builder);
    const s = lightSlots(light.haze);
    const kept = this as unknown as Kept;
    kept.colorNode = kept.baseColorNode ?? kept.colorNode;
    const casts = light.castShadow && builder.renderer.shadowMap.enabled;
    let colour = kept.colorNode;
    if (casts && builder.object.receiveShadow) {
      // Made once and shared with the plain path, as three makes it.
      if (kept.shadowColorNode === null) {
        kept.shadowNode = this.setupShadowNode() as unknown as Kept["shadowNode"];
        kept.shadowColorNode = kept.colorNode.mul(kept.shadowNode!);
        kept.baseColorNode = kept.colorNode;
      }
      const shadow = heroShadowed(light.haze, shadowFaded(s, kept.shadowNode!));
      colour = colour.mul(min(terrainLit(s, positionWorld), shadow));
    } else if (casts) {
      colour = colour.mul(terrainLit(s, positionWorld));
    } else if (kept.shadowNode !== null) {
      kept.shadowNode.dispose();
      kept.shadowNode = null;
      kept.shadowColorNode = null;
    }
    // `cloudShadow` is the clouds' pass's (part 10): 1 until then.
    colour = colour.mul(keyAtHeight(s, positionWorld.y));
    const direct = this.setupDirect(builder);
    if (direct)
      (builder as N).lightsNode.setupDirectLight(builder, this, { ...direct, lightColor: colour });
    return undefined;
  }
}

/** THE SKY'S LIGHT on the node renderer: the hemisphere, lifted in the
 * mountain's shade (`SHADE_LIFT`). */
export class SkyLightNode extends HemisphereLightNode {
  static get type(): string {
    return "SkyLightNode";
  }

  setup(builder: NodeBuilder): N {
    const light = this.light as SkyLight;
    if (!light.haze || !hazed(builder)) return super.setup(builder);
    const s = lightSlots(light.haze);
    const self = this as unknown as { colorNode: N; groundColorNode: N; lightDirectionNode: N };
    const weight = normalWorld.dot(self.lightDirectionNode).mul(0.5).add(0.5);
    const lift = s.shadeLift.mul(float(1).sub(terrainLit(s, positionWorld))).add(1);
    const irradiance = mix(self.groundColorNode, self.colorNode, weight).mul(lift);
    (builder.context as N).irradiance.addAssign(irradiance);
    return undefined;
  }
}

/** THE LAMPS as a light of the scene's own, so the node renderer lights
 * with them: its node reads the shared slots. Added on the webgpu paths
 * only (`gpu-dress.ts`) — WebGL's materials carry the lamps in their GLSL. */
export class LampsLight extends THREE.Light {
  readonly isLampsLight = true;
  constructor(readonly haze: HazeUniforms) {
    super(0xffffff, 1);
    this.name = "lamps";
  }
}

/** Whether `builder` draws a lit material three's GLSL would end with
 * `lights_fragment_end` — the lamps' place. */
function litMaterial(builder: NodeBuilder): boolean {
  const m = builder.material as unknown as Record<string, unknown> | null;
  return !!m && !!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial);
}

/** THE LAMPS on a lit surface (`LAMP_FRAGMENT`, `lampReach`, `pisteLight`). */
export class LampsLightNode extends LightingNode {
  static get type(): string {
    return "LampsLightNode";
  }

  constructor(readonly light: LampsLight) {
    super();
  }

  setup(builder: NodeBuilder): N {
    const m = builder.material as THREE.Material | null;
    if (!hazed(builder) || !litMaterial(builder) || m?.userData.ownLamps) return undefined;
    const s = lightSlots(this.light.haze);
    const at = (n: N, i: N): N => n.element(i);
    const lit = Fn(() => {
      const sum = vec3(0).toVar();
      Loop(LAMP_SLOTS, ({ i }: { i: N }) => {
        const on = at(s.lampOn, i);
        // Dealt in order: the first empty slot ends the lamps.
        If(on.lessThanEqual(0), () => {
          Break();
        });
        If(on.greaterThan(0.001), () => {
          const way = at(s.lampPos, i).sub(positionWorld).toVar();
          const d = length(way);
          const L = way.div(max(d, 1e-3));
          const axis = dot(L.negate(), at(s.lampDir, i));
          const b = at(s.lampBeam, i);
          const beam = smoothstep(b.x, b.y, axis).add(b.w.mul(smoothstep(b.z, b.x, axis)));
          const reach = on
            .mul(beam)
            .mul(smoothstep(0.2, 0.9, d))
            .div(d.mul(d).mul(0.012).add(1));
          sum.addAssign(
            at(s.lampCol, i)
              .mul(reach)
              .mul(max(dot(normalWorld, L), 0)),
          );
        });
      });
      If(s.pisteOn.x.greaterThan(0), () => {
        const uv = positionWorld.xz.sub(s.pisteBox.xy).mul(s.pisteBox.zw);
        const inside = uv.x
          .greaterThanEqual(0)
          .and(uv.y.greaterThanEqual(0))
          .and(uv.x.lessThanEqual(1))
          .and(uv.y.lessThanEqual(1));
        const v = sample(s.piste, uv).xyz.mul(s.pisteOn.x.mul(s.pisteOn.y));
        If(inside, () => {
          sum.addAssign(s.pisteCol.mul(max(dot(normalWorld, v), 0)));
        });
      });
      return sum;
    })();
    const lambert: N = BRDF_Lambert({ diffuseColor: diffuseColor.rgb });
    (builder.context as N).reflectedLight.directDiffuse.addAssign(lambert.mul(lit).mul(9));
    return undefined;
  }
}

/** Teach `renderer` the three lights' nodes — once a renderer. */
const taught = new WeakSet<object>();
export function registerLights(renderer: WebGPURenderer): void {
  if (taught.has(renderer.library)) return;
  taught.add(renderer.library);
  // The library's types know three's own pairs; these are ours.
  renderer.library.addLight(KeyLightNode as never, KeyLight as never);
  renderer.library.addLight(SkyLightNode as never, SkyLight as never);
  renderer.library.addLight(LampsLightNode as never, LampsLight as never);
}
