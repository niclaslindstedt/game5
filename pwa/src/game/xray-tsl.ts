// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY CAM ON THE NODE RENDERER (`docs/webgpu.md`, part 12): the node
// twins of `xray-view.ts`'s and `xray-blood.ts`'s draws, each over its
// ShaderMaterial's own uniforms by reference (a hundred bones and organs
// share one GLSL, and so one program), term for term with the GLSL:
//
//   xray-piece   a bone or an organ: lit from one fixed key, a rim, the
//                crack across a break glowing, a break reddening from the
//                break out, a shattered bone's shards each turned its own
//                way, a wedge knocked out of its side
//   xray-glass   the glass skin over his own, skinned on his rig
//   xray-mask    his skin's solid patches, depth only, skinned
//   xray-veil    the dark sheet over the frame; it also CLEARS THE DEPTH
//                under him (on WebGL the veil's `onBeforeRender` clears it —
//                a clear the node renderer cannot make inside its pass), as
//                a sheet at the far plane written through every depth
//   xray-blood   a pool of blood, lumpy and slopping on the beat
//
// And THE DISSOLVE on his skin's own material (`dissolveSkin`, from the
// dressing's finish): each fragment dropped where a noise over his bind-pose
// surface stands above how solid he is, a glowing edge along the front.

import * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeBuilder, NodeMaterial } from "three/webgpu";

import { particleMaterial } from "./air-tsl.ts";
import { glslMod, objectOwn, shaderOwn } from "./figure-tsl.ts";
import { dissolves } from "./gpu-backend.ts";
import type { N } from "./haze-tsl.ts";

const {
  Discard,
  Fn,
  If,
  abs,
  attribute,
  cameraProjectionMatrix,
  clamp,
  cos,
  cross,
  dot,
  exp,
  float,
  floor,
  fract,
  frontFacing,
  length,

  max,
  mix,
  highpModelNormalViewMatrix,
  modelViewMatrix,
  normalGeometry,
  normalView,
  normalize,
  positionGeometry,
  positionView,
  pow,
  sin,
  smoothstep,
  uv,
  varyingProperty,
  vec3,
  vec4,
} = TSL as N;

const h1 = (n: N): N => fract(sin(n.mul(91.3458)).mul(47453.5453));

/** `v` turned `a` about the unit `axis` (Rodrigues). */
const turn = (v: N, axis: N, a: N): N => {
  const c = cos(a);
  return v
    .mul(c)
    .add(cross(axis, v).mul(sin(a)))
    .add(axis.mul(dot(axis, v)).mul(float(1).sub(c)));
};

/** THE DISSOLVE's noise (`xrHash` / `xrNoise` / `xrPatch`). */
const xrHash = (p: N): N => fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453));
const xrNoise = Fn(([p]: N[]) => {
  const i = floor(p).toVar();
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3)).toVar();
  const h = (dx: number, dy: number, dz: number): N => xrHash(i.add(vec3(dx, dy, dz)));
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), f.x), mix(h(0, 1, 0), h(1, 1, 0), f.x), f.y),
    mix(mix(h(0, 0, 1), h(1, 0, 1), f.x), mix(h(0, 1, 1), h(1, 1, 1), f.x), f.y),
    f.z,
  );
}).setLayout({ name: "xrayNoise", type: "float", inputs: [{ name: "p", type: "vec3" }] });
const xrPatch = (body: N): N =>
  xrNoise(body.mul(9))
    .mul(0.65)
    .add(xrNoise(body.mul(23)).mul(0.35));

/** A bone's or an organ's twin. */
function pieceTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const o = (name: string, type: string): N => shaderOwn(name, type);
  const breakU = o("uBreak", "float");
  const grade = o("uGrade", "float");
  const vNormal = varyingProperty("vec3", "vXrNormal");
  const vView = varyingProperty("vec3", "vXrView");
  const vAlong = varyingProperty("float", "vXrAlong");
  const vShard = varyingProperty("float", "vXrShard");

  const vertex = Fn(() => {
    const energy = o("uEnergy", "float");
    const open = o("uOpen", "float");
    const sector = o("uSector", "float");
    const axis = o("uAxis", "vec3");
    const perp = o("uPerp", "vec3");
    const mid = o("uMid", "vec3");
    const centre = attribute("aCentre", "vec3");
    const along = attribute("aAlong", "float");
    const around = attribute("aAround", "float");
    const cell = attribute("aCell", "float");
    const p = positionGeometry.add(normalGeometry.mul(o("uSwell", "float"))).toVar();
    const n = vec3(normalGeometry).toVar();
    vShard.assign(0);
    If(grade.greaterThanEqual(2).and(open.greaterThan(0)), () => {
      const side = along.lessThan(breakU).select(float(-1), float(1));
      const e = energy;
      // The two ends shoved past each other and apart.
      const shove = axis
        .mul(side)
        .mul(e.mul(0.006).add(0.004))
        .add(perp.mul(side).mul(e.mul(0.012).add(0.006)));
      const off = vec3(0).toVar();
      const near = abs(along.sub(breakU)).toVar();
      const rc = centre.sub(mid).toVar();
      const radial = normalize(rc.sub(axis.mul(dot(rc, axis))).add(perp.mul(1e-4))).toVar();
      If(grade.greaterThanEqual(4).and(near.lessThan(0.16)), () => {
        // SHATTERED: every shard its own way.
        const r = h1(cell);
        off.assign(
          radial
            .mul(r.mul(0.018).add(0.008))
            .mul(e)
            .add(
              axis
                .mul(h1(cell.add(7)).sub(0.5))
                .mul(0.02)
                .mul(e),
            ),
        );
        const a = h1(cell.add(3)).sub(0.5).mul(1.6).mul(open).toVar();
        const ax = normalize(
          vec3(h1(cell.add(1)).sub(0.5), h1(cell.add(2)).sub(0.5), h1(cell.add(5)).sub(0.5)),
        ).toVar();
        p.assign(centre.add(turn(p.sub(centre), ax, a)));
        n.assign(turn(n, ax, a));
        vShard.assign(1);
      }).ElseIf(
        grade
          .greaterThanEqual(3)
          .and(near.lessThan(0.09))
          .and(abs(glslMod(around.sub(sector).add(3.14159), 6.28318).sub(3.14159)).lessThan(0.9)),
        () => {
          // A WEDGE: the butterfly knocked out of the side.
          off.assign(radial.mul(e.mul(0.02).add(0.018)));
          vShard.assign(1);
        },
      );
      p.addAssign(shove.add(off).mul(open));
    });
    const mv = modelViewMatrix.mul(vec4(p, 1)).toVar();
    vNormal.assign(normalize(highpModelNormalViewMatrix.mul(n)));
    vView.assign(mv.xyz.negate());
    vAlong.assign(along);
    return cameraProjectionMatrix.mul(mv);
  })();

  const fragment = Fn(() => {
    const colour = o("uColour", "color");
    const rimU = o("uRim", "color");
    const crack = o("uCrack", "color");
    const broken = o("uBroken", "color");
    const n = normalize(vNormal).toVar();
    If(frontFacing.not(), () => {
      n.assign(n.negate());
    });
    const v = normalize(vView);
    const lit = max(0, dot(n, normalize(vec3(-0.35, 0.75, 0.55))))
      .mul(0.65)
      .add(0.35)
      .toVar();
    const rim = pow(float(1).sub(max(0, dot(n, v))), 2).toVar();
    const col = colour.mul(lit).add(rimU.mul(rim).mul(0.7)).toVar();
    const near = abs(vAlong.sub(breakU)).toVar();
    If(grade.greaterThanEqual(1), () => {
      // The crack across the bone, glowing.
      const band = float(1).sub(smoothstep(0.006, grade.mul(0.01).add(0.02), near));
      col.assign(
        mix(col, crack.mul(1.6), band.mul(grade.greaterThanEqual(2).select(float(0.5), float(1)))),
      );
    });
    If(grade.greaterThanEqual(2), () => {
      // A break reddens from the break out; a shard all red.
      const red = max(exp(near.mul(-9)), vShard);
      col.assign(mix(col, broken.mul(lit.mul(0.6).add(0.6)), clamp(red, 0, 1).mul(0.85)));
    });
    col.assign(mix(col, broken.mul(0.7).add(rimU.mul(rim).mul(0.3)), o("uHurt", "float")));
    col.assign(mix(col, vec3(1.6), o("uFlash", "float")));
    return vec4(col, o("uAlpha", "float"));
  })();
  return particleMaterial("xray-piece", m, vertex, fragment);
}

/** The glass skin: three's own skinned vertex, a fresnel of the glass. */
function glassTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const fragment = Fn(() => {
    const n = normalize(normalView);
    const f = pow(float(1).sub(abs(dot(n, normalize(positionView.negate())))), 2.2).toVar();
    const col = mix(shaderOwn("uGlass", "color"), shaderOwn("uRim", "color"), f);
    return vec4(col, shaderOwn("uAlpha", "float").mul(f.mul(0.5).add(0.06)));
  })();
  return particleMaterial("xray-glass", m, null, fragment);
}

/** The mask: his skin's solid patches, three's own skinned vertex, the
 * noise over the bind pose (`position`, before the skin). */
function maskTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const fragment = Fn(() => {
    const solid = shaderOwn("uXrSolid", "float");
    const cut = solid.mul(1.1).sub(0.05);
    If(solid.lessThan(1).and(xrPatch(positionGeometry).greaterThan(cut)), () => {
      Discard();
    });
    return vec4(0);
  })();
  const twin = particleMaterial("xray-mask", m, null, fragment);
  twin.colorWrite = m.colorWrite;
  return twin;
}

/** The veil: the sheet over the frame, and the depth under it cleared. */
function veilTwin(m: THREE.ShaderMaterial): NodeMaterial {
  // At the far plane, on every back end's clip space (z / w just short of 1).
  const vertex = vec4(positionGeometry.xy, 0.99999, 1);
  const fragment = Fn(() => {
    const d = uv().sub(0.5);
    const corner = smoothstep(0.25, 0.75, length(d).mul(1.2));
    return vec4(
      shaderOwn("uTint", "color"),
      shaderOwn("uAlpha", "float").mul(corner.mul(0.26).add(0.72)),
    );
  })();
  const twin = particleMaterial("xray-veil", m, vertex, fragment);
  // Written through everything: WebGL's clear, as a draw.
  twin.depthTest = true;
  twin.depthWrite = true;
  twin.depthFunc = THREE.AlwaysDepth;
  return twin;
}

/** A pool of blood. */
function bloodTwin(m: THREE.ShaderMaterial): NodeMaterial {
  const vNormal = varyingProperty("vec3", "vXrNormal");
  const vView = varyingProperty("vec3", "vXrView");
  const vertex = Fn(() => {
    const time = shaderOwn("uTime", "float");
    const seed = shaderOwn("uSeed", "float");
    const h = (p: N): N => fract(sin(dot(p, vec3(127.1, 311.7, 74.7)).add(seed)).mul(43758.5453));
    const noise = (x: N): N => {
      const i = floor(x).toVar();
      const f0 = fract(x);
      const f = f0.mul(f0).mul(f0.mul(-2).add(3)).toVar();
      const c = (dx: number, dy: number, dz: number): N => h(i.add(vec3(dx, dy, dz)));
      return mix(
        mix(mix(c(0, 0, 0), c(1, 0, 0), f.x), mix(c(0, 1, 0), c(1, 1, 0), f.x), f.y),
        mix(mix(c(0, 0, 1), c(1, 0, 1), f.x), mix(c(0, 1, 1), c(1, 1, 1), f.x), f.y),
        f.z,
      );
    };
    const position = positionGeometry;
    // A lumpy pool, slopping slowly and swelling on the beat.
    const n = noise(position.mul(2.2).add(vec3(0, time.mul(0.6), seed)))
      .mul(0.7)
      .add(noise(position.mul(4.5).sub(vec3(time.mul(0.4), 0, 0))).mul(0.3));
    const p = position.mul(n.mul(0.5).add(0.72).add(shaderOwn("uBeat", "float").mul(0.06)));
    const mv = modelViewMatrix.mul(vec4(p, 1)).toVar();
    vNormal.assign(normalize(highpModelNormalViewMatrix.mul(normalGeometry)));
    vView.assign(mv.xyz.negate());
    return cameraProjectionMatrix.mul(mv);
  })();
  const fragment = Fn(() => {
    const f = pow(float(1).sub(abs(dot(normalize(vNormal), normalize(vView)))), 1.8).toVar();
    const col = mix(shaderOwn("uColour", "color"), shaderOwn("uRim", "color"), f.mul(0.8));
    return vec4(col, shaderOwn("uAlpha", "float").mul(f.mul(0.4).add(0.55)));
  })();
  return particleMaterial("xray-blood", m, vertex, fragment);
}

/** The twin for X-ray flag `kind` over `m`, or null for one not the
 * X-ray's. */
export function xrayTwin(m: THREE.ShaderMaterial, kind: string): NodeMaterial | null {
  switch (kind) {
    case "xray-piece":
      return pieceTwin(m);
    case "xray-glass":
      return glassTwin(m);
    case "xray-mask":
      return maskTwin(m);
    case "xray-veil":
      return veilTwin(m);
    case "xray-blood":
      return bloodTwin(m);
    default:
      return null;
  }
}

// ---------------------------------------------------------------- the dissolve

// Read off the object's material; a material sharing the program undressed
// is solid.
const solidU = objectOwn("userData.xrayOwn.uXrSolid.value", "float", 1);
const edgeU = objectOwn("userData.xrayOwn.uXrEdge.value", "color");

/** THE DISSOLVE on the copy of his skin's material `material` (flagged by
 * `xray-view.ts` with `userData.xrayOwn`): the dropped patches as its mask,
 * the glowing edge laid over what it draws. */
export function dissolveSkin(copy: NodeMaterial, material: THREE.Material): void {
  if (!dissolves(material)) return;
  // The bind-pose place, carried to the fragment as it is (`vXrBody`).
  const body = positionGeometry;
  const cut = solidU.mul(1.1).sub(0.05);
  const keep = solidU.greaterThanEqual(1).or(xrPatch(body).lessThanEqual(cut));
  const before = copy.maskNode as N;
  copy.maskNode = before ? before.and(keep) : keep;
  const base = copy.setupOutput.bind(copy);
  copy.setupOutput = (builder: NodeBuilder, output: N): N => {
    const out: N = base(builder, output);
    const edge = float(1).sub(smoothstep(0, 0.05, cut.sub(xrPatch(body))));
    const glow = solidU.lessThan(1).select(edge, float(0));
    return vec4(mix(out.rgb, edgeU.mul(1.6), glow), out.a);
  };
  // A draw's uniforms are refreshed in full only for a material with a node
  // of its own, and the material three checks is `material`.
  (material as unknown as { xrayNode: N }).xrayNode = keep;
}
