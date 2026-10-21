// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR'S SHARED PIECES ON THE NODE RENDERER (`docs/webgpu.md`, part 9):
// what every particle twin reads, restated from the GLSL it is grafted out
// of, term for term, over the SAME uniforms by reference:
//
//   airLight / airSky   `snow-air-light.ts`'s `AIR_LIGHT_VERTEX` and
//                       `AIR_LIGHT_FRAGMENT`: the key by height and past the
//                       mountain, the sky's irradiance on four faces;
//   sheltered           `shelter.ts`'s cabin box round the lens;
//   lampsThrough        a beam lighting the snow in the air it passes
//                       through (the spray's and the cloud's fragment loop);
//   lampsAt, pisteAt    the lamps and the piste lights at a point, for the
//                       flakes and the plumes, read once a particle;
//   airHaze             what is drawn in the haze's colour alone (the spray,
//                       the cloud, its shadow) mixed into it by `hazeAmount`
//                       — in display space where the frame goes straight onto
//                       the canvas, in linear light where it goes through the
//                       grade's target, as WebGL mixes it (`haze-tsl.ts`).
//
// The key here is taken through the clouds' shadow (`cloudShadow`, part
// 10), as the key's light node takes it (`lights-tsl.ts`).

import type * as THREE from "three";
import * as TSL from "three/tsl";
import { NodeMaterial } from "three/webgpu";

import { LAMP_SLOTS, type HazeUniforms } from "./haze.ts";
import {
  fromDisplay,
  hazeAir,
  hazeColour,
  hazeMist,
  hazeSlots,
  slot,
  tap,
  toDisplay,
  type HazeFogOptions,
  type N,
} from "./haze-tsl.ts";
import { cloudShadow } from "./cloud-pass-tsl.ts";
import { keyAtHeight, lightSlots, terrainLit, type LightSlots } from "./lights-tsl.ts";
import { SHELTER } from "./shelter.ts";
import { skyIrradiance } from "./snow-light-tsl.ts";

const {
  Break,
  Continue,
  Fn,
  If,
  Loop,
  abs,
  all,
  cameraPosition,
  dot,
  float,
  length,
  lessThan,
  max,
  mix,
  pow,
  select,
  smoothstep,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** The slots the air's pieces read, made once a set of uniforms. */
export type AirSlots = {
  u: HazeUniforms;
  light: LightSlots;
  skySh: N;
  shelterOn: N;
  shelter: N;
  shelterHalf: N;
};

const airOf = new WeakMap<HazeUniforms, AirSlots>();
export function airSlots(u: HazeUniforms): AirSlots {
  let s = airOf.get(u);
  if (!s) {
    s = {
      u,
      light: lightSlots(u),
      skySh: slot(u.uSkySh, "vec3"),
      shelterOn: slot(SHELTER.uShelterOn, "float"),
      shelter: slot(SHELTER.uShelter, "mat4"),
      shelterHalf: slot(SHELTER.uShelterHalf, "vec3"),
    };
    airOf.set(u, s);
  }
  return s;
}

/** THE SHELTER (`SHELTER_GLSL`'s `sheltered`): true inside the cabin box. */
export function sheltered(s: AirSlots, world: N): N {
  const p = s.shelter.mul(vec4(world, 1)).xyz;
  return s.shelterOn.greaterThanEqual(0.5).and(all(lessThan(abs(p), s.shelterHalf)));
}

/** The five lights `airLight(p)` hands the fragment (the key, then the sky
 * up, down, toward the key and away from it, level). */
export type AirLight = { key: N; up: N; down: N; to: N; from: N };

/** `airLight(p)` (`AIR_LIGHT_VERTEX`): read once a particle, in the vertex
 * stage; `keyCol` the material's own `uKeyCol`. */
export function airLight(s: AirSlots, keyCol: N, p: N): AirLight {
  const l = s.light;
  const sun = terrainLit(l, p).toVar();
  const key = keyCol.mul(keyAtHeight(l, p.y)).mul(cloudShadow(l.cloud, p)).mul(sun);
  const lift = float(1)
    .add(l.shadeLift.mul(float(1).sub(sun)))
    .mul(0.31831);
  const k = l.sunDir.xz;
  const kl = length(k);
  const level = select(kl.greaterThan(1e-3), vec3(k.x.div(kl), 0, k.y.div(kl)), vec3(1, 0, 0));
  const sh = s.skySh;
  return {
    key,
    up: skyIrradiance(sh, vec3(0, 1, 0)).mul(lift),
    down: skyIrradiance(sh, vec3(0, -1, 0)).mul(lift),
    to: skyIrradiance(sh, level).mul(lift),
    from: skyIrradiance(sh, level.negate()).mul(lift),
  };
}

/** `airSky(n)` (`AIR_LIGHT_FRAGMENT`): the sky's light on a world normal
 * off the four faces. */
export function airSky(s: AirSlots, a: AirLight, n: N): N {
  const k = s.light.sunDir.xz;
  const kl = length(k);
  const level = select(kl.greaterThan(1e-3), k.div(kl), vec2(1, 0));
  const across = dot(n.xz, level);
  const wUp = max(n.y, 0);
  const wDown = max(n.y.negate(), 0);
  const wTo = max(across, 0);
  const wFrom = max(across.negate(), 0);
  const rest = max(float(1).sub(wUp).sub(wDown).sub(wTo).sub(wFrom), 0);
  const mean = a.up.add(a.down).add(a.to).add(a.from).mul(0.25);
  return a.up
    .mul(wUp)
    .add(a.down.mul(wDown))
    .add(a.to.mul(wTo))
    .add(a.from.mul(wFrom))
    .add(mean.mul(rest))
    .div(max(wUp.add(wDown).add(wTo).add(wFrom).add(rest), 1e-3));
}

/** `lampReach(i, toLamp, d)` (`LAMP_GLSL`). */
function lampReach(l: LightSlots, i: N, toLamp: N, d: N): N {
  const on = l.lampOn.element(i);
  const axis = dot(toLamp.negate(), l.lampDir.element(i));
  const b = l.lampBeam.element(i);
  const beam = smoothstep(b.x, b.y, axis).add(b.w.mul(smoothstep(b.z, b.x, axis)));
  return on
    .mul(beam)
    .mul(smoothstep(0.2, 0.9, d))
    .div(d.mul(d).mul(0.012).add(1));
}

/** `pisteLight(at)` (`LAMP_GLSL`): the piste lights' vector irradiance. */
export function pisteAt(s: AirSlots, at: N): N {
  const l = s.light;
  return Fn(() => {
    const v = vec3(0).toVar();
    If(l.pisteOn.x.greaterThan(0), () => {
      const uv = at.xz.sub(l.pisteBox.xy).mul(l.pisteBox.zw);
      const inside = uv.x
        .greaterThanEqual(0)
        .and(uv.y.greaterThanEqual(0))
        .and(uv.x.lessThanEqual(1))
        .and(uv.y.lessThanEqual(1));
      const read = tap(l.piste, uv).xyz.mul(l.pisteOn.x.mul(l.pisteOn.y));
      If(inside, () => {
        v.assign(read);
      });
    });
    return v;
  })();
}

/** THE LAMPS ON SNOW IN THE AIR (the spray's and the cloud's loop): every
 * beam through `world`, brightest seen looking back up it along `view`
 * (from the lens), and the piste lights round it. */
export function lampsThrough(s: AirSlots, world: N, view: N): N {
  const l = s.light;
  return Fn(() => {
    const sum = vec3(0).toVar();
    Loop(LAMP_SLOTS, ({ i }: { i: N }) => {
      // Dealt in order: the first empty slot ends them.
      If(l.lampOn.element(i).lessThanEqual(0), () => {
        Break();
      });
      const toLamp = l.lampPos.element(i).sub(world).toVar();
      const gap = length(toLamp).toVar();
      const toward = pow(max(0, dot(view, l.lampDir.element(i))), 3)
        .mul(0.5)
        .add(0.5);
      sum.addAssign(
        l.lampCol
          .element(i)
          .mul(lampReach(l, i, toLamp.div(max(gap, 1e-3)), gap))
          .mul(toward)
          .mul(1.8),
      );
    });
    return sum.add(l.pisteCol.mul(length(pisteAt(s, world))).mul(1.2));
  })();
}

/** THE LAMPS AT A POINT, once a particle (the flakes', the plumes'): every
 * lamp's reach × `gain`, and the piste lights' × `gain`. */
export function lampsAt(s: AirSlots, p: N, gain: number): N {
  const l = s.light;
  return Fn(() => {
    const sum = vec3(0).toVar();
    Loop(LAMP_SLOTS, ({ i }: { i: N }) => {
      const on = l.lampOn.element(i);
      If(on.lessThanEqual(0), () => {
        Break();
      });
      If(on.lessThanEqual(0.001), () => {
        Continue();
      });
      const L = l.lampPos.element(i).sub(p).toVar();
      const d = length(L).toVar();
      sum.addAssign(
        l.lampCol
          .element(i)
          .mul(lampReach(l, i, L.div(max(d, 1e-3)), d))
          .mul(gain),
      );
    });
    return sum.add(l.pisteCol.mul(length(pisteAt(s, p))).mul(gain));
  })();
}

/** `hazeAmount(dist, rise)` (`HAZE_AMOUNT_GLSL`): the air and the mist. */
export function hazeAmount(u: HazeUniforms, dist: N, rise: N): N {
  const s = hazeSlots(u);
  return max(hazeAir(s, dist, rise), hazeMist(s, dist, rise));
}

/** WHAT IS DRAWN IN THE HAZE'S COLOUR ALONE, mixed into it: `col` at world
 * point `world` taken toward the haze's colour on its bearing by
 * `hazeAmount`, in display space where WebGL's frame would go straight
 * onto the canvas (the GLSL mixes after its tone map and encoding) and in
 * linear light where it goes through the grade's target. */
export function airHaze(u: HazeUniforms, how: HazeFogOptions, col: N, world: N): N {
  const s = hazeSlots(u);
  const ray = world.sub(cameraPosition).toVar();
  const dist = length(ray).toVar();
  const hz = hazeColour(s, ray.div(max(dist, 1e-3)));
  const a = hazeAmount(u, dist, ray.y);
  const shown = how.display.greaterThan(0.5);
  const lin = mix(col, hz, a);
  const disp = fromDisplay(
    mix(toDisplay(col, how.exposure), toDisplay(hz, how.exposure), a),
    how.exposure,
  );
  return select(shown, disp, lin);
}

/** A particle's twin: a node material over `from`'s pipeline (its
 * blending, its depth, its side), its quad placed by `vertex` and its
 * colour `fragment` — no lights, no fog (the twin hazes itself). A node is
 * hung on the ShaderMaterial drawn, so the renderer refreshes its bindings
 * every draw (`trail-map-tsl.ts`'s `passMaterial`). */
export function particleMaterial(
  name: string,
  from: THREE.Material,
  vertex: N,
  fragment: N,
): NodeMaterial {
  const m = new NodeMaterial();
  m.name = name;
  m.transparent = from.transparent;
  m.depthTest = from.depthTest;
  m.depthWrite = from.depthWrite;
  m.side = from.side;
  m.fog = false;
  m.lights = false;
  m.toneMapped = from.toneMapped;
  m.blending = from.blending;
  m.blendEquation = from.blendEquation;
  m.blendSrc = from.blendSrc;
  m.blendDst = from.blendDst;
  m.polygonOffset = from.polygonOffset;
  m.polygonOffsetFactor = from.polygonOffsetFactor;
  m.polygonOffsetUnits = from.polygonOffsetUnits;
  m.vertexNode = vertex;
  m.fragmentNode = fragment;
  (from as unknown as { twinNode: N }).twinNode = fragment;
  return m;
}
