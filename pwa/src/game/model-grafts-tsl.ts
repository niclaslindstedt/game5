// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S AND THE MODELS' GRAFTS ON THE NODE RENDERER (`docs/webgpu.md`,
// part 12): the classic materials WebGL draws with a GLSL graft of their
// own (`onBeforeCompile`), flagged `nodeGraft(material, family, kind)`
// (`gpu-backend.ts`). Their copy is three's own (the library's
// `fromMaterial`, field for field), and the dressing hands it here to be
// finished (`gpu-dress.ts`): the graft's nodes are set on the COPY.
//
//   pbr       a merged model (`model-merge.ts`: a pair of skis, a machine's
//             parts): the metalness, the roughness and the clearcoat off
//             each vertex (`pbr`), as the graft reads them;
//   rigid     a posed figure merged into one draw (`posed-merge.ts`): its
//             normal through the inverse transpose of the part's bone, not
//             the bone itself, so an unevenly scaled part (a stretched
//             strut, a helmet's shell) is lit as its own normal matrix lit
//             it;
//   flutter   the modelled kit's loose cloth trailed and flapped down the
//             air past him, and the skin-tight suit's shiver on its lee
//             (`player-model.ts`'s `withFlutter`);
//   wingsuit  the wingsuit's colourway painted off each vertex's place on
//             its wing (`wingsuit-look.ts`'s `suitPaintGlsl`).
//
// And on any copy whose material carries clipping planes (a ski cut by a
// rope, `ski-cut-view.ts`), the planes as its mask: the node renderer clips
// by a clipping group in the scene, never by a material's own planes.
//
// THE VERTEX RUNS AFTER THREE'S SKINNING, as WebGL's graft does (after
// `skinning_vertex` / `skinnormal_vertex`): a copy's `positionNode` runs
// after the morphs, the skin and the instance. It is set on the copy alone:
// the shadow passes copy the DRAWN material's `positionNode`, and WebGL's
// depth (three's own, or the skiers' `createShadeDepth`) takes none of
// these grafts, so the shadows stay WebGL's.
//
// A material's own numbers (one skier's air past him, one piece's planes)
// are read off the material drawn (`userData.graftOwn`, or the material's
// own planes): materials with one graft share one program, keyed by their
// `customProgramCacheKey`, on the node renderer as on WebGL.

import * as THREE from "three";
import * as TSL from "three/tsl";
import type { NodeBuilder, NodeMaterial } from "three/webgpu";

import { finishCloth } from "./cloth-tsl.ts";
import { graftOwn } from "./figure-tsl.ts";
import { graftOf } from "./gpu-backend.ts";
import type { N } from "./haze-tsl.ts";
import { SUIT_CUT, colourwayOf, type SuitColourway } from "./wingsuit-look.ts";

const {
  Fn,
  If,
  abs,
  attribute,
  clamp,
  dot,
  float,
  fract,
  inverse,
  length,
  mat3,
  materialColor,
  max,
  min,
  normalLocal,
  normalize,
  positionLocal,
  reference,
  referenceBuffer,
  select,
  sin,
  transpose,
  uniform,
  vec3,
  vec4,
} = TSL as N;

// ---------------------------------------------------------------- pbr

/** The merged look's metal, roughness and coat, off the vertices. */
function pbr(copy: NodeMaterial): void {
  const p = attribute("pbr", "vec3");
  const c = copy as NodeMaterial & Record<string, unknown>;
  c.metalnessNode = p.x;
  c.roughnessNode = p.y;
  if (c.isMeshPhysicalNodeMaterial === true) c.clearcoatNode = p.z;
}

// ---------------------------------------------------------------- rigid

/** The normal through the part's normal matrix — the inverse transpose of
 * its one bone's skin matrix — in place of three's skinned normal. */
const rigidNode: N = Fn((builder: NodeBuilder) => {
  const object = builder.object as THREE.SkinnedMesh;
  if (object.isSkinnedMesh !== true) return positionLocal;
  const bones = referenceBuffer("skeleton.boneMatrices", "mat4", object.skeleton.bones.length);
  const index = attribute("skinIndex", "uvec4");
  const skin = reference("bindMatrixInverse", "mat4")
    .mul(bones.element(index.x))
    .mul(reference("bindMatrix", "mat4"));
  normalLocal.assign(transpose(inverse(mat3(skin))).mul(attribute("normal", "vec3")));
  return positionLocal;
});

// ---------------------------------------------------------------- flutter

/** THE FLUTTER (`withFlutter`), term for term: a loose point trailed down
 * the air and flapped along its normal, floated off him in free fall; a
 * tight suit's skin shivered on its lee side. */
const flutterNode: N = Fn(() => {
  const flow = graftOwn("uFlow", "vec3");
  const time = graftOwn("uFlTime", "float");
  const floated = graftOwn("uFloat", "float");
  const wind = graftOwn("uWind", "vec4");
  const flutter = attribute("flutter", "float");
  const shiver = attribute("shiver", "float");
  const raw = attribute("position", "vec3");
  const p = positionLocal.toVar();
  const sp = length(flow).toVar();
  If(flutter.greaterThan(0), () => {
    const k = flutter.mul(clamp(sp.div(22), 0, 1)).toVar();
    p.assign(p.add(vec3(0, flutter.mul(wind.z).mul(floated), 0)));
    If(sp.greaterThan(0.3), () => {
      const d = flow.div(sp);
      const ph = dot(raw, vec3(23, 17, 29)).toVar();
      const f = k.mul(9).add(9).toVar();
      p.addAssign(d.mul(k).mul(wind.x.add(sin(time.mul(f).mul(0.7).add(ph)).mul(0.012))));
      p.addAssign(
        normalize(normalLocal)
          .mul(k)
          .mul(wind.y)
          .mul(sin(time.mul(f).add(ph.mul(1.7)))),
      );
    });
  });
  If(shiver.greaterThan(0).and(sp.greaterThan(4)), () => {
    const nn = normalize(normalLocal).toVar();
    const lee = max(dot(nn, flow.div(sp)), 0);
    const ph = dot(raw, vec3(41, 37, 31));
    const a = shiver
      .mul(lee)
      .mul(wind.w)
      .mul(clamp(sp.sub(4).div(26), 0, 1));
    p.addAssign(nn.mul(a).mul(sin(time.mul(sp.mul(0.6).add(24)).add(ph))));
  });
  return p;
});

// ---------------------------------------------------------------- wingsuit

/** A colourway's colour as the GLSL writes it: linear light. */
const lin = (hex: number): N => {
  const c = new THREE.Color(hex);
  return vec3(c.r, c.g, c.b);
};

/** Whether the pattern's accent is at (u, v), per wing (`suitPaintGlsl`). */
function patternAt(c: SuitColourway, arm: N, u: N, v: N): N {
  if (c.pattern === "chevrons") {
    const onArm = fract(u.mul(1.3).add(v.mul(0.75)).mul(2.4))
      .lessThan(0.3)
      .and(u.greaterThan(0.18))
      .and(u.lessThan(0.84));
    const onLeg = fract(v.mul(2.6).add(abs(u.sub(0.5)).mul(1.6)))
      .lessThan(0.28)
      .and(v.greaterThan(0.12));
    return select(arm, onArm, onLeg);
  }
  if (c.pattern === "stripes") {
    const onArm = abs(v.sub(0.42))
      .lessThan(0.06)
      .or(abs(v.sub(0.62)).lessThan(0.035))
      .and(u.lessThan(0.86));
    const onLeg = abs(u.sub(0.5))
      .lessThan(0.05)
      .or(abs(u.sub(0.32)).lessThan(0.025))
      .or(abs(u.sub(0.68)).lessThan(0.025));
    return select(arm, onArm, onLeg);
  }
  const onArm = v
    .greaterThan(0.56)
    .and(u.greaterThan(0.12))
    .and(u.lessThan(0.84))
    .and(v.lessThan(0.93));
  const onLeg = abs(u.sub(0.5)).lessThan(0.2).and(v.greaterThan(0.22)).and(v.lessThan(0.93));
  return select(arm, onArm, onLeg);
}

/** THE SUIT'S PAINT at `w` (`aWing`: u, v, which wing, which skin), in
 * colourway `c` — `suitPaint` in the GLSL, branch for branch. */
function suitPaint(c: SuitColourway, w: N): N {
  const u = w.x.toVar();
  const v = w.y.toVar();
  const arm = w.z.lessThan(1.5).toVar();
  const under = w.w.lessThan(0);
  const cells = select(arm, float(SUIT_CUT.arm.cells), float(SUIT_CUT.leg.cells));
  const r = fract(u.mul(cells));
  const rib = r.lessThan(0.022).or(r.greaterThan(0.978)).toVar();
  const boots = arm
    .not()
    .and(u.lessThan(0.17).or(u.greaterThan(0.83)))
    .and(v.greaterThan(0.74));
  const out = vec3(0).toVar();
  If(under, () => {
    const mouth = select(
      arm,
      u.greaterThan(0.07).and(u.lessThan(0.3)).and(v.greaterThan(0.13)).and(v.lessThan(0.2)),
      v
        .greaterThan(0.1)
        .and(v.lessThan(0.17))
        .and(
          abs(u.sub(0.38))
            .lessThan(0.07)
            .or(abs(u.sub(0.62)).lessThan(0.07)),
        ),
    );
    const col = lin(c.under).toVar();
    If(arm.and(v.lessThan(0.1)), () => {
      col.assign(lin(c.edge));
    });
    If(v.greaterThan(0.95), () => {
      col.assign(lin(c.dark));
    });
    If(boots, () => {
      col.assign(lin(c.dark));
    });
    out.assign(
      select(mouth, vec3(0.012, 0.012, 0.014), col.mul(select(rib, float(0.8), float(0.92)))),
    );
  }).Else(() => {
    const col = lin(c.base).toVar();
    If(patternAt(c, arm, u, v), () => {
      col.assign(lin(c.accent));
    });
    If(arm.and(u.greaterThan(0.86)), () => {
      col.assign(lin(c.tips));
    });
    If(select(arm, v.lessThan(0.13), u.lessThan(0.07).or(u.greaterThan(0.93))), () => {
      col.assign(lin(c.edge));
    });
    If(v.greaterThan(0.955), () => {
      col.assign(lin(c.dark));
    });
    If(boots, () => {
      col.assign(lin(c.dark));
    });
    If(rib, () => {
      col.mulAssign(0.7);
    });
    out.assign(col);
  });
  return out;
}

/** The suit's paint by colourway, made once each. */
const paints = new Map<number, N>();
function wingsuit(copy: NodeMaterial, material: THREE.Material): void {
  const suit = Number(material.userData.suit ?? 0);
  let paint = paints.get(suit);
  if (!paint) {
    paint = Fn(() => suitPaint(colourwayOf(suit), attribute("aWing", "vec4")))();
    paints.set(suit, paint);
  }
  copy.colorNode = materialColor.mul(vec4(paint, 1));
}

// ---------------------------------------------------------------- clipping

/** Up to this many of a material's planes are read. */
const PLANES = 2;

/** Plane `i` of the drawn material, as (normal, constant), read each draw;
 * a missing plane keeps everything. */
const planes: N[] = Array.from({ length: PLANES }, (_, i) =>
  uniform(new THREE.Vector4(0, 0, 0, 1)).onObjectUpdate(
    ({ object }: { object: THREE.Mesh }, self: { value: THREE.Vector4 }) => {
      const m = object.material;
      const p = (Array.isArray(m) ? m[0] : m).clippingPlanes?.[i];
      if (p) self.value.set(p.normal.x, p.normal.y, p.normal.z, p.constant);
      else self.value.set(0, 0, 0, 1);
    },
  ),
);

/** What survives the material's own planes: the side of every one its
 * normal points to, as three's WebGL clipping keeps it (in world space,
 * where the planes are). */
const keptNode: N = Fn(() => {
  const world = TSL.positionWorld as N;
  let kept: N = null;
  for (const p of planes) {
    const side = dot(p.xyz, world).add(p.w).greaterThanEqual(0);
    kept = kept ? kept.and(side) : side;
  }
  return kept;
})();

/** Whether `material` carries clipping planes of its own. */
export const clipped = (material: THREE.Material): boolean =>
  (material.clippingPlanes?.length ?? 0) > 0;

// ---------------------------------------------------------------- the hook

/** Finish the copy of `material` with its graft's nodes (see the header). */
export function finishGraft(copy: NodeMaterial, material: THREE.Material): void {
  const kind = graftOf(material);
  switch (kind) {
    case "pbr":
      pbr(copy);
      break;
    case "rigid":
      copy.positionNode = rigidNode();
      break;
    case "flutter":
      copy.positionNode = flutterNode();
      break;
    case "wingsuit":
      wingsuit(copy, material);
      break;
    default:
      if (kind) finishCloth(copy, material, kind);
  }
  if (clipped(material)) {
    copy.maskNode = copy.maskNode
      ? min(float(copy.maskNode), float(keptNode)).greaterThan(0.5)
      : keptNode;
    // A draw's uniforms are refreshed in full only for a material with a
    // node of its own, and the material three checks is `material`.
    (material as unknown as { graftNode: N }).graftNode = keptNode;
  }
}
