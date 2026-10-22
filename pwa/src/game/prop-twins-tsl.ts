// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PROPS' NODE TWINS (`docs/webgpu.md`, part 13), in the `props` family
// of the register: what `sky-twins-tsl.ts` hands for these flags.
//
//   flag-sail, flag-pennant
//               the challenges' feather flags and pennants
//               (`challenge-flags.ts`): the cloth swung to the wind in its
//               instance's frame and fluttered, the sail's print a cell an
//               instance and read the right way round from behind
//   slab-plates the plates a slab breaks into (`avalanche-plates.ts`): each
//               an irregular prism off its instance's outline
//   piste-glow  the floodlights' haloes (`piste-lights.ts`)
//   fire-embers, fire-flames, fire-glow, fire-sparks, fire-smoke
//               a free ride's camp fires and bonfires (`fires-view.ts`),
//               over the fire's own fragments (`fire-tsl.ts`)
//
// The flags and the plates move their vertex before the instance's matrix,
// as WebGL's graft does at `begin_vertex`, so they are figure twins
// (`figure-tsl.ts`). The flags read their instance's own matrix (the wind
// turned into its frame, the flutter's phase off its place) from an
// instanced copy of the mesh's matrices (`frameOf`), in place of three's
// instancing; their faces are flat-shaded, so no normal is carried. The
// ShaderMaterials' twins read each material's own uniforms off the material
// drawn (`shaderOwn`), as the effects' do (part 12).

import * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeMaterial } from "three/webgpu";

import { particleMaterial } from "./air-tsl.ts";
import { FEATHER_CELLS, WORD_BAND } from "./challenge-shapes.ts";
import { CORNERS } from "./avalanche-crack.ts";
import {
  fadeAt,
  fireNoise,
  fireVaryings,
  flameFragment,
  smokeFragment,
  sparkFragment,
} from "./fire-tsl.ts";
import { FIRE_COLOURS } from "./fireball.ts";
import {
  figureTwin,
  own,
  interleave,
  packed,
  shaderOwn,
  type FigureSpec,
  type Own,
} from "./figure-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import type { N } from "./haze-tsl.ts";
import { GLOW } from "./piste-lights.ts";
import { stageSkyTwin } from "./stage-tsl.ts";

const {
  Discard,
  Fn,
  If,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  cos,
  dFdx,
  dFdy,
  dot,
  exp,
  float,
  fract,
  frontFacing,
  instanceIndex,
  instancedBufferAttribute,
  int,
  length,
  mat4,
  materialReference,
  materialEmissive,
  max,
  min,
  mix,
  modelViewMatrix,
  normalLocal,
  normalize,
  pow,
  positionGeometry,
  select,
  sin,
  smoothstep,
  sqrt,
  step,
  texture,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} = TSL as N;

// ---------------------------------------------------------------- an instance's frame

/** The matrices of an instanced mesh as an instanced copy over the same
 * array (three's own way where they will not fit a uniform buffer), its
 * version brought up to the mesh's every draw: one program whatever the
 * count. */
const frames = new WeakMap<THREE.InstancedBufferAttribute, N>();
function frameOf(mesh: THREE.InstancedMesh): N {
  const im = mesh.instanceMatrix;
  let node = frames.get(im);
  if (!node) {
    const copy = new THREE.InstancedInterleavedBuffer(im.array as Float32Array, 16, 1);
    copy.setUsage(THREE.DynamicDrawUsage);
    const col = (k: number): N => instancedBufferAttribute(copy as never, "vec4", 16, k * 4);
    const synced = uniform(0).onObjectUpdate(() => {
      if (copy.version !== im.version) copy.version = im.version;
      return 0;
    });
    node = mat4(col(0), col(1), col(2), col(3).add(vec4(0, 0, 0, synced)));
    frames.set(im, node);
  }
  return node;
}

// ---------------------------------------------------------------- the flags

/** The cloth's motion (`SWAY`): swung about the pole to the wind in the
 * instance's frame and fluttered along its length; `frame` the instance's
 * matrix, or null for a mesh drawn once. */
function sway(p: N, own: Own, frame: N | null): N {
  const wind = own("uFlagWind", "vec2");
  const time = own("uFlagTime", "float");
  // `transpose(mat3(instanceMatrix)) * w`, column by column.
  const w = vec3(wind.x, 0, wind.y);
  const col = (k: number): N => frame.element(k).xyz;
  const lw = (frame ? vec3(dot(col(0), w), dot(col(1), w), dot(col(2), w)) : w).toVar();
  const ph = frame ? frame.element(3).x.mul(0.37).add(frame.element(3).z.mul(0.61)) : float(0);
  const t = p.toVar();
  const sp = length(lw.xz).toVar();
  const gust = min(sp, 14);
  const reach = max(t.x, 0);
  t.z.addAssign(
    reach
      .mul(gust.mul(0.012).add(0.035))
      .mul(sin(time.mul(gust.mul(0.35).add(2.4)).sub(reach.mul(4.5)).add(ph))),
  );
  const dir0 = select(sp.greaterThan(0.4), lw.xz.div(max(sp, 1e-6)), vec2(1, 0)).toVar();
  const wob = sin(time.mul(0.55).add(ph)).mul(0.4).div(sp.mul(0.35).add(1)).toVar();
  const cw = cos(wob);
  const sw = sin(wob);
  const dir = vec2(dir0.x.mul(cw).sub(dir0.y.mul(sw)), dir0.x.mul(sw).add(dir0.y.mul(cw))).toVar();
  return vec3(t.x.mul(dir.x).sub(t.z.mul(dir.y)), t.y, t.x.mul(dir.y).add(t.z.mul(dir.x)));
}

/** A flag's spec: the sway in the instance's frame, then the instance. */
function flagSpec(m: THREE.Material, sail: boolean): FigureSpec {
  let mesh: THREE.Object3D | null = null;
  let bare = false;
  const spec: FigureSpec = {
    pose: {
      prepare(geometry, object) {
        mesh = object;
        bare = !geometry.getAttribute("normal");
      },
      instance(p) {
        // A cloth is flat-shaded and carries no normal; the key's shadow
        // reads one for its normal bias all the same, and the node
        // renderer's would read a zero turned into NaN. The cloth's own
        // facing stands in.
        if (bare) normalLocal.assign(vec3(0, 0, 1));
        const inst = mesh as THREE.InstancedMesh | null;
        if (!inst?.isInstancedMesh) return sway(p, own, null);
        const frame = frameOf(inst);
        return frame.mul(vec4(sway(p, own, frame), 1)).xyz;
      },
    },
  };
  if (sail) {
    const map = (m as THREE.MeshStandardMaterial).map;
    spec.dress = (twin) => {
      // `CELL_UV` per vertex, as WebGL's `vMapUv` is.
      const uv = attribute("uv", "vec2");
      const cell = varying(
        vec2(min(uv.x, 0.985).add(attribute("aCell", "float")).div(FEATHER_CELLS.count), uv.y),
        "vSailUv",
      );
      // `SAIL_MAP`: from behind, the word's band turned end for end, read
      // with the unturned print's gradients.
      const turn = frontFacing
        .not()
        .and(cell.y.greaterThan(WORD_BAND[0]))
        .and(cell.y.lessThan(WORD_BAND[1]));
      const at = vec2(cell.x, select(turn, float(WORD_BAND[0] + WORD_BAND[1]).sub(cell.y), cell.y));
      const print = texture(map, at).grad(dFdx(cell), dFdy(cell)).setUpdateMatrix(false).toVar();
      const t = twin as NodeMaterial & Record<string, N>;
      // The colour alone: three's `materialColor` carries the map read at the
      // plain uv, which the print replaces.
      t.colorNode = vec4(materialReference("color", "color").mul(print.rgb), print.a);
      t.emissiveNode = materialEmissive.mul(print.rgb);
    };
  }
  return spec;
}

// ---------------------------------------------------------------- the slab's plates

/** The plates' spec (`plateMaterial`): the prism's corner off the
 * instance's outline, its shade off the vertex. The attributes that never
 * change are read from one interleaved copy (`interleave`): with the
 * outline's four, a plate would otherwise bind more than eight buffers. */
function plateSpec(): FigureSpec {
  return {
    pose: {
      prepare(geometry) {
        interleave(geometry, ["aCorner", "aTop", "color"]);
      },
      early() {
        const corner = int(packed("aCorner", "float").add(0.5)).toVar();
        const at = vec2(0).toVar();
        for (let k = 0; k < CORNERS / 2; k++) {
          const o = attribute(`aOutline${k}`, "vec4");
          If(corner.equal(k * 2), () => {
            at.assign(o.xy);
          });
          If(corner.equal(k * 2 + 1), () => {
            at.assign(o.zw);
          });
        }
        return vec3(at.x, packed("aTop", "float").sub(0.5), at.y);
      },
      paint(_colour, tint) {
        return packed("color", "vec3").mul(tint);
      },
    },
  };
}

// ---------------------------------------------------------------- the piste lights' haloes

/** THE HALO (`glowMaterial`): a quad turned to the lens at each glass, at
 * least a few pixels wide, bright from in front of the lamp, faded into
 * the haze and gone past the mist's wall. */
function pisteGlowTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const on = shaderOwn("uOn", "float");
  const pixels = shaderOwn("uPixels", "float");
  const col = shaderOwn("uCol", "vec3");
  const haze = shaderOwn("uHaze", "float");
  const mist = shaderOwn("uMist", "float");
  const vAt: N = TSL.varyingProperty("vec2", "vPisteAt");
  const vAlpha: N = TSL.varyingProperty("float", "vPisteAlpha");
  const vertex = Fn(() => {
    const centre = attribute("aCentre", "vec3");
    const aim = attribute("aAim", "vec3");
    const mv = modelViewMatrix.mul(vec4(centre, 1)).toVar();
    const depth = max(mv.z.negate(), 0.1);
    const back = cameraPosition.sub(centre).toVar();
    const dist = length(back).toVar();
    const facing = dot(aim, back.div(max(dist, 1e-3)));
    const size = max(GLOW.size, float(GLOW.minPx).mul(depth).div(pixels)).toVar();
    vAlpha.assign(
      on
        .mul(smoothstep(-0.2, 0.65, facing))
        .mul(mix(1, float(GLOW.size).div(size), 0.6))
        .mul(exp(dist.negate().mul(haze).mul(0.7)))
        .mul(select(mist.greaterThan(0), step(dist, mist), float(1))),
    );
    const p = positionGeometry;
    mv.xy.addAssign(p.xy.mul(size));
    vAt.assign(p.xy.mul(2));
    return cameraProjectionMatrix.mul(mv);
  })();
  const fragment = Fn(() => {
    const r = length(vAt).toVar();
    If(r.greaterThan(1).or(vAlpha.lessThanEqual(0)), () => {
      Discard();
    });
    const core = smoothstep(0.22, 0, r);
    const halo = pow(float(1).sub(r), 3).mul(0.55);
    return vec4(mix(col, vec3(1), core).mul(2.5), core.add(halo).mul(vAlpha));
  })();
  return particleMaterial("piste-glow", m, vertex, fragment);
}

// ---------------------------------------------------------------- the fires

/** A colour as the GLSL writes it (three decimals). */
const v3 = (c: readonly number[]): N => vec3(...c.map((x) => Number(x.toFixed(3))));

/** The fires' twins (`createFires`), each over the fire's shared uniforms. */
function fireTwin(m: THREE.ShaderMaterial, kind: string): NodeMaterial | null {
  const time = shaderOwn("uTime", "float");
  const wind = shaderOwn("uWind", "vec3");
  const night = shaderOwn("uNight", "float");
  const fade = (dist: N): N =>
    fadeAt(dist, shaderOwn("uReach", "float"), shaderOwn("uHaze", "float"));
  const V = fireVaryings();
  const position = positionGeometry;
  const project = (p: N): N => cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(p, 1));
  switch (kind) {
    case "fire-embers": {
      const vertex = Fn(() => {
        const bed = attribute("aBed", "vec4");
        const p = bed.xyz.add(vec3(position.x, 0, position.y).mul(bed.w)).toVar();
        V.uv.assign(position.xy);
        V.seed.assign(fract(bed.x.mul(0.37).add(bed.z.mul(0.61))));
        V.fade.assign(fade(length(cameraPosition.sub(p))));
        return project(p);
      })();
      const fragment = Fn(() => {
        const r = length(V.uv).toVar();
        If(r.greaterThan(1), () => {
          Discard();
        });
        const cells = fireNoise(V.uv.mul(7).add(V.seed.mul(40)));
        const breath = fireNoise(
          V.uv
            .mul(2.5)
            .add(vec2(time.mul(0.6), time.mul(-0.45)))
            .add(V.seed.mul(9)),
        );
        const g = smoothstep(0.35, 0.85, cells.mul(breath.mul(0.6).add(0.6)))
          .mul(float(1).sub(r.mul(r)))
          .toVar();
        const col = mix(
          vec3(0.03, 0.022, 0.018),
          v3(FIRE_COLOURS.red).mul(1.6),
          smoothstep(0, 0.5, g),
        ).toVar();
        col.assign(mix(col, v3(FIRE_COLOURS.orange), smoothstep(0.5, 1, g)));
        return vec4(col, smoothstep(1, 0.75, r).mul(V.fade));
      })();
      return particleMaterial("fire-embers", m, vertex, fragment);
    }
    case "fire-flames": {
      const vertex = Fn(() => {
        const base = attribute("aBase", "vec4");
        const size = attribute("aSize", "vec2");
        const s = base.w;
        const breathe = sin(time.mul(5.3).add(s.mul(17.3)))
          .mul(0.12)
          .add(0.8)
          .add(sin(time.mul(11.7).add(s.mul(31.1))).mul(0.08));
        const h = size.y.mul(breathe).toVar();
        const toEye = cameraPosition.sub(base.xyz).toVar();
        const side = normalize(vec2(toEye.z, toEye.x.negate()).add(vec2(1e-5, 0))).toVar();
        const v = position.y;
        const p = base.xyz
          .add(vec3(side.x, 0, side.y).mul(position.x).mul(size.x).mul(0.5))
          .toVar();
        p.y.addAssign(v.mul(h));
        const lay = wind.xz.mul(0.05).toVar();
        lay.divAssign(max(1, length(lay).div(0.6)));
        const off = lay.mul(h).mul(v).mul(v);
        p.addAssign(vec3(off.x, 0, off.y));
        V.uv.assign(vec2(position.x, v));
        V.seed.assign(s);
        V.fade.assign(fade(length(cameraPosition.sub(p))));
        return project(p);
      })();
      return particleMaterial("fire-flames", m, vertex, flameFragment(time));
    }
    case "fire-glow": {
      const vertex = Fn(() => {
        const at = attribute("aGlow", "vec3");
        const sz = attribute("aGlowSize", "vec3");
        const size = mix(sz.x, sz.y, night).mul(0.5).toVar();
        const s = sz.z.mul(17.3);
        const flick = sin(time.mul(5.3).add(s))
          .mul(0.09)
          .add(0.92)
          .add(sin(time.mul(9.1).add(s.mul(1.7))).mul(0.06));
        const mv = cameraViewMatrix.mul(vec4(at, 1)).toVar();
        const dist = length(mv.xyz).toVar();
        mv.xyz.addAssign(normalize(mv.xyz.negate()).mul(min(size.mul(0.6), dist.mul(0.5))));
        mv.xy.addAssign(position.xy.mul(size));
        V.uv.assign(position.xy);
        V.alpha.assign(
          mix(0.35, 0.8, night)
            .mul(flick)
            .mul(fade(dist))
            .mul(smoothstep(size, size.mul(4), dist)),
        );
        return cameraProjectionMatrix.mul(mv);
      })();
      const fragment = Fn(() => {
        const r = length(V.uv).toVar();
        If(r.greaterThan(1), () => {
          Discard();
        });
        const g = float(1).sub(r);
        return vec4(vec3(1.0, 0.45, 0.12).mul(g.mul(g).mul(g)).mul(V.alpha), 1);
      })();
      return particleMaterial("fire-glow", m, vertex, fragment);
    }
    case "fire-sparks": {
      const px = shaderOwn("uPx", "float");
      const vertex = Fn(() => {
        const src = attribute("aSrc", "vec4");
        const spark = attribute("aSpark", "vec4");
        const s = spark.w.toVar();
        const life = spark.y.mul(fract(s.mul(7.13)).mul(0.8).add(0.6)).toVar();
        const x = time.add(s.mul(31.7));
        const tau = x.sub(x.div(life).floor().mul(life)).toVar();
        const k = tau.div(life).toVar();
        const a = s.mul(81.68).toVar();
        const r0 = src.w.mul(0.6).mul(sqrt(fract(s.mul(3.7))));
        const p = src.xyz
          .add(
            vec3(sin(a).mul(r0), spark.z.mul(fract(s.mul(9.1)).mul(0.3).add(0.15)), cos(a).mul(r0)),
          )
          .toVar();
        const rise = spark.x.mul(fract(s.mul(5.3)).add(0.5)).toVar();
        p.y.addAssign(rise.mul(tau).sub(rise.mul(0.2).mul(tau).mul(tau).div(life)));
        const drift = wind.xz
          .mul(tau)
          .mul(0.6)
          .add(
            vec2(sin(tau.mul(3.1).add(a)), cos(tau.mul(2.7).add(a)))
              .mul(0.3)
              .mul(tau),
          );
        p.addAssign(vec3(drift.x, 0, drift.y));
        const mv = cameraViewMatrix.mul(vec4(p, 1)).toVar();
        const dist = length(mv.xyz).toVar();
        const size = max(float(1).sub(k.mul(0.5)).mul(0.02), dist.mul(px));
        mv.xy.addAssign(position.xy.mul(size));
        V.uv.assign(position.xy);
        V.heat.assign(float(1).sub(k));
        V.alpha.assign(
          float(1)
            .sub(k)
            .mul(smoothstep(0, 0.04, k))
            .mul(mix(0.3, 1, night))
            .mul(sin(time.mul(23).add(a)).mul(0.4).add(0.6))
            .mul(fade(dist))
            .mul(smoothstep(250, 120, dist)),
        );
        return cameraProjectionMatrix.mul(mv);
      })();
      return particleMaterial("fire-sparks", m, vertex, sparkFragment());
    }
    case "fire-smoke": {
      const lit = shaderOwn("uLit", "color");
      const vertex = Fn(() => {
        const src = attribute("aSrc", "vec4");
        const smoke = attribute("aSmoke", "vec4");
        const s = fract(float(instanceIndex).mul(0.618034).add(src.x.mul(0.013))).toVar();
        const life = smoke.y;
        const x = time.add(s.mul(life));
        const tau = x.sub(x.div(life).floor().mul(life)).toVar();
        const k = tau.div(life).toVar();
        const rise = smoke.x.mul(float(1).sub(exp(tau.mul(-0.4)))).div(0.4);
        const size = smoke.z.add(smoke.w.mul(tau)).toVar();
        const p = src.xyz.add(vec3(0, rise, 0)).toVar();
        const lay = wind.xz.mul(0.75).mul(
          tau.sub(
            float(1)
              .sub(exp(tau.negate().div(1.5)))
              .mul(1.5),
          ),
        );
        p.addAssign(vec3(lay.x, 0, lay.y));
        const wob = vec2(sin(s.mul(40).add(tau.mul(0.7))), cos(s.mul(53).add(tau.mul(0.6))))
          .mul(size)
          .mul(0.35);
        p.addAssign(vec3(wob.x, 0, wob.y));
        const mv = cameraViewMatrix.mul(vec4(p, 1)).toVar();
        const dist = length(mv.xyz).toVar();
        const spin = s.mul(6.2831853).add(tau.mul(0.25)).toVar();
        const q = vec2(
          cos(spin).mul(position.x).sub(sin(spin).mul(position.y)),
          sin(spin).mul(position.x).add(cos(spin).mul(position.y)),
        );
        mv.xy.addAssign(q.mul(size));
        V.uv.assign(position.xy);
        V.seed.assign(s);
        V.alpha.assign(
          src.w
            .mul(smoothstep(0, 0.05, k))
            .mul(pow(float(1).sub(k), 1.4))
            .mul(fade(dist))
            .mul(smoothstep(1, 3, dist)),
        );
        V.col.assign(
          lit.mul(vec3(0.2)).add(
            vec3(1.0, 0.42, 0.12)
              .mul(night)
              .mul(0.5)
              .mul(exp(tau.mul(-1.4))),
          ),
        );
        return cameraProjectionMatrix.mul(mv);
      })();
      return particleMaterial("fire-smoke", m, vertex, smokeFragment());
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------- the hook

/** The twin for prop flag `kind` over `m`, or null for a kind that is not
 * a prop's. */
export function propTwinOf(
  m: THREE.Material,
  kind: string,
  haze: HazeUniforms,
): NodeMaterial | null {
  switch (kind) {
    case "flag-sail":
      return figureTwin(m, flagSpec(m, true), haze);
    case "flag-pennant":
      return figureTwin(m, flagSpec(m, false), haze);
    case "slab-plates":
      return figureTwin(m, plateSpec(), haze);
    case "piste-glow":
      return pisteGlowTwin(m as THREE.ShaderMaterial);
    case "stage-sky":
      return stageSkyTwin(m as THREE.ShaderMaterial);
    default:
      return kind.startsWith("fire-") ? fireTwin(m as THREE.ShaderMaterial, kind) : null;
  }
}
