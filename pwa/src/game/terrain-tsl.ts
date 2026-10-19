// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND ON THE NODE RENDERER (`docs/webgpu.md`, part 4): the node twin
// the webgpu paths draw the clipmap's every level with, in place of the
// `MeshStandardMaterial` `terrain.ts` grafts `snow-glsl.ts` into — the same
// uniforms, read by reference (`groundSpecs`), so `terrain.ts`'
// `follow` and every other writer drive both back ends.
//
//   THE VERTEX (`SNOW_VERTEX_PLACE`, `SNOW_VERTEX_BEGIN`): a grid vertex
//   placed round the lens, morphed onto the next level near its rim (the
//   CDLOD morph: no crack between two levels), lifted onto the generator's
//   heightfield read with four exact fetches (`textureLoad`), the rim of
//   mountains past the map's edge (`rimRise`), the loose cover over the
//   powder, kept under the skiers' bases (`skiClear`) and sunk under the
//   finer level (`uHole`). The deformable snow's own mesh folds where no
//   tool has touched it, as on WebGL.
//   THE FRAGMENT: what the snow is (`snow-sample-tsl.ts`), its colour and
//   roughness, its normal off the ground map's slope (never the mesh's),
//   lit by its own model (`snow-light-tsl.ts`) and hazed as `HAZE_FRAGMENT`
//   hazes it, keeping the bare rock's own share of its colour
//   (`HAZE_KEEP`). A summer's ground (`summer-tsl.ts`) is its own sample and
//   colour over the same vertex.
//   THE ROOMS: the cutting twin throws away the snow inside a room built or
//   a pit dug (`room-cuts.ts`), as its mask.
//
// STAND-INS until part 5: the trail map's relief in the vertex and the
// furrows per pixel, the tree wells, the avalanche, the deformable snow's
// field (`deformTouched`: untouched, so its mesh folds) — each named where
// it stands.

import * as THREE from "three";
import * as TSL from "three/tsl";
import { MeshStandardNodeMaterial, type NodeBuilder, type NodeMaterial } from "three/webgpu";

import { rimRise } from "./far-ranges-tsl.ts";
import { hazeOver, slot, tap, texSlot, texel, type HazeFogOptions, type N } from "./haze-tsl.ts";
import { ROOM_CUTS, roomCutUniforms } from "./room-cuts.ts";
import { CLEAR, RIVALS, SKI_HALF, SKI_LINES, SKI_POINTS } from "./ski-clear.ts";
import { SnowLightingModel } from "./snow-light-tsl.ts";
import {
  groundSlots,
  snowColour,
  snowRoughness,
  snowSample,
  type GroundSlots,
  type GroundSpec,
  type SnowState,
} from "./snow-sample-tsl.ts";
import { summerColour, summerSample, summerSlots } from "./summer-tsl.ts";
import { LOOSE } from "./trail-stamp.ts";

const {
  Fn,
  If,
  Continue,
  Loop,
  abs,
  all,
  cameraViewMatrix,
  clamp,
  diffuseColor,
  distance,
  dot,
  float,
  greaterThanEqual,
  ivec2,
  lessThanEqual,
  max,
  min,
  mix,
  mod,
  normalize,
  positionGeometry,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** A 1×1 float texture standing for the rim until `far-ranges.ts` writes
 * one: the same format, so the pipeline's binding fits both. */
const NO_RIM = (() => {
  const t = new THREE.DataTexture(new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType);
  t.needsUpdate = true;
  return t;
})();

/** `heightTexel` / `groundHeight`: the generator's ground at plan `p`,
 * bilinear between four exact fetches, and the rim's rise past the edge. */
function groundHeight(s: GroundSlots, rim: N, rimBox: N, p: N): N {
  const lo = s.origin;
  const hi = s.origin.add(s.count.sub(1).mul(s.cell));
  const q = clamp(p, lo, hi).toVar();
  const f = q.sub(lo).div(s.cell).toVar();
  const i = f.floor().toVar();
  const t = f.sub(i).toVar();
  const top = ivec2(s.count).sub(1);
  const at = (dx: number, dy: number): N =>
    texel(s.height, clamp(ivec2(i).add(ivec2(dx, dy)), ivec2(0), top)).r;
  return mix(mix(at(0, 0), at(1, 0), t.x), mix(at(0, 1), at(1, 1), t.x), t.y).add(
    rimRise(rim, rimBox, p, q),
  );
}

/** `skiClear(p, y, reach)`: `y` let down under the player's bases and the
 * nearest rivals' within reach of `p` (`SKI_CLEAR_GLSL`). */
function skiClear(trail: Record<string, THREE.IUniform>, p: N, y0: N, reach: N): N {
  const y = y0.toVar();
  if (!trail.uSkiLine) return y;
  const line = slot(trail.uSkiLine, "vec4");
  const on = slot(trail.uSkiClear, "float");
  const rival = slot(trail.uRivalLine, "vec4");
  const P = SKI_POINTS;
  const cut = (a: N, b: N): void => {
    const ab = b.xz.sub(a.xz).toVar();
    const t = clamp(dot(p.sub(a.xz), ab).div(max(dot(ab, ab), 1e-6)), 0, 1).toVar();
    const d = distance(p, a.xz.add(ab.mul(t)));
    If(d.lessThanEqual(mix(a.w, b.w, t).add(reach)), () => {
      y.assign(min(y, mix(a.y, b.y, t).sub(CLEAR)));
    });
  };
  If(on.greaterThan(0.5), () => {
    Loop({ start: 0, end: SKI_LINES, type: "int", name: "sl" }, ({ sl }: N) => {
      Loop({ start: 0, end: P - 1, type: "int", name: "sk" }, ({ sk }: N) => {
        const at = sl.mul(P).add(sk);
        cut(line.element(at), line.element(at.add(1)));
      });
    });
  });
  Loop({ start: 0, end: RIVALS * SKI_LINES, type: "int", name: "rl" }, ({ rl }: N) => {
    If(
      distance(p, rival.element(rl.mul(P).add(P >> 1)).xz).greaterThan(reach.add(SKI_HALF)),
      () => {
        Continue();
      },
    );
    Loop({ start: 0, end: P - 1, type: "int", name: "rk" }, ({ rk }: N) => {
      const at = rl.mul(P).add(rk);
      cut(rival.element(at), rival.element(at.add(1)));
    });
  });
  return y;
}

/** `inRoomCut(p)`: inside a room built or a pit dug (`ROOM_CUT_PARS`). */
function inRoomCut(p: N): N {
  const a = slot(roomCutUniforms.uRoomCutA, "vec4");
  const b = slot(roomCutUniforms.uRoomCutB, "vec4");
  const n = slot(roomCutUniforms.uRoomCuts, "int");
  const inside = float(0).toVar();
  Loop(ROOM_CUTS, ({ i }: N) => {
    If(i.lessThan(n), () => {
      const ai = a.element(i);
      const d = p.sub(ai.xy).toVar();
      const lx = d.x.mul(ai.w).sub(d.y.mul(ai.z));
      const lz = d.x.mul(ai.z).add(d.y.mul(ai.w));
      const bi = b.element(i);
      If(abs(lx).lessThan(bi.x).and(abs(lz).lessThan(bi.y)), () => {
        inside.assign(1);
      });
    });
  });
  return inside.greaterThan(0.5);
}

/** The ground's node material (see the header). */
class GroundMaterial extends MeshStandardNodeMaterial {
  readonly s: GroundSlots;
  readonly how: HazeFogOptions;
  readonly world: N = varyingProperty("vec3", "vSnowWorld");
  readonly vNormal: N = varyingProperty("vec3", "vSnowNormal");
  private readonly states = new WeakMap<NodeBuilder, SnowState>();
  private readonly roughVar: N = float(0.8).toVar("snowRoughness");
  private readonly normalVar: N = vec3(0, 0, 1).toVar("snowNormalView");

  constructor(spec: GroundSpec, how: HazeFogOptions) {
    super();
    this.s = groundSlots(spec);
    this.how = how;
    this.name = `${spec.cut ? "terrain-cut" : "terrain"}${spec.summer ? "-summer" : ""}`;
    this.metalness = 0;
    this.fog = false; // hazed in `setupOutput`, with the rock's share kept
    this.userData.haze = true; // the key's and the sky's nodes light it as WebGL does
    this.userData.ownLamps = !spec.summer;
    this.positionNode = this.place();
    this.roughnessNode = this.roughVar;
    this.normalNode = this.normalVar;
    if (spec.cut) this.maskNode = inRoomCut(this.world.xz).not();
  }

  /** `SNOW_VERTEX_PLACE` and `SNOW_VERTEX_BEGIN` (see the header). */
  private place(): N {
    const s = this.s;
    const haze = s.spec.haze;
    const rimSlot = texSlot(haze.uFarRim, NO_RIM);
    rimSlot.tex.setUpdateMatrix(false); // fetched by texel: no uv transform
    const rimBox = slot(haze.uFarRimBox, "vec4");
    return Fn(() => {
      const grid = positionGeometry.xz.toVar();
      const local = grid.sub(s.gridHalf).mul(s.spacing).toVar();
      const edge = max(abs(local.x), abs(local.y)).div(s.gridHalf.mul(s.spacing));
      const morph = clamp(edge.sub(0.72).div(0.2), 0, 1).mul(float(1).sub(s.deformMesh));
      const xz = s.levelCentre.add(local).sub(mod(grid, 2).mul(s.spacing).mul(morph)).toVar();
      const cellV = s.spacing.toVar();
      // THE DEFORMABLE SNOW'S MESH: part 5's field is not read yet, so no
      // tool has touched it and every cell folds four wide.
      If(s.deformMesh.greaterThan(0.5).and(s.focalPx.greaterThan(0)), () => {
        const e = grid.sub(mod(grid, 2));
        xz.subAssign(mod(grid, 2).add(mod(e, 4)).mul(s.spacing));
        cellV.assign(s.spacing.mul(4));
      });
      // PART 5: the trail map's relief (`uTrailCoarse`, `trailRelief`), the
      // tree wells (`wellDepth`) and the avalanche (`slideAt`): nought.
      const g = tap(s.ground, xz.sub(s.origin).add(s.cell.mul(0.5)).div(s.count.mul(s.cell)))
        .level(0)
        .toVar();
      const packedV = max(g.b, 0);
      const y = groundHeight(s, rimSlot.tex, rimBox, xz)
        .add(float(LOOSE).mul(float(1).sub(packedV)))
        .add(rimSlot.keep)
        .toVar();
      y.assign(skiClear(s.spec.trail, xz, y, cellV));
      If(s.hole.w.greaterThan(0.5), () => {
        const dh = abs(xz.sub(s.hole.xy));
        If(max(dh.x, dh.y).lessThanEqual(s.hole.z.sub(s.spacing).add(s.spacing.mul(0.01))), () => {
          y.subAssign(max(s.spacing.mul(2), s.hole.w.sub(1)));
        });
      });
      // THE MESH'S NORMAL: the ground map's slope on the map, the ground
      // differenced past its edge.
      const e = max(s.spacing, s.cell).toVar();
      const lo = s.origin.add(e);
      const hi = s.origin.add(s.count.sub(1).mul(s.cell)).sub(e);
      const normal = normalize(vec3(g.r.negate(), 1, g.g.negate())).toVar();
      If(
        all(greaterThanEqual(xz, lo))
          .and(all(lessThanEqual(xz, hi)))
          .not(),
        () => {
          const h = (o: N): N => groundHeight(s, rimSlot.tex, rimBox, xz.add(o));
          normal.assign(
            normalize(
              vec3(
                h(vec2(e.negate(), 0)).sub(h(vec2(e, 0))),
                e.mul(2),
                h(vec2(0, e.negate())).sub(h(vec2(0, e))),
              ),
            ),
          );
        },
      );
      const transformed = vec3(xz.x, y, xz.y).toVar();
      this.world.assign(transformed);
      this.vNormal.assign(normal);
      return transformed;
    })();
  }

  setupDiffuseColor(builder: NodeBuilder): void {
    const s = this.s;
    let st: SnowState;
    if (s.spec.summer) {
      const m = summerSlots(s.spec.shared);
      st = summerSample(s, m, this.world, this.vNormal);
      summerColour(s, m, st);
    } else {
      st = snowSample(s, this.world, this.vNormal);
      snowColour(s, st);
    }
    this.states.set(builder, st);
    this.roughVar.assign(s.spec.summer ? st.rough : snowRoughness(st));
    this.normalVar.assign(normalize(cameraViewMatrix.mul(vec4(st.n, 0)).xyz));
    super.setupDiffuseColor(builder);
    diffuseColor.assign(vec4(st.albedo, diffuseColor.a));
  }

  // Three's types leave the builder out of this one; it is handed it.
  setupLightingModel(builder?: NodeBuilder): SnowLightingModel {
    const st = builder ? this.states.get(builder) : undefined;
    if (!st) throw new Error("terrain-tsl.ts: the ground was lit before it was sampled");
    return new SnowLightingModel(this.s, st, this.s.spec.summer);
  }

  setupOutput(builder: NodeBuilder, outputNode: N): N {
    const st = this.states.get(builder);
    const keep = st?.hazeKeep;
    // The lit colour made in the main flow, before the haze's branches read
    // it: built first inside one, three would declare the lighting's
    // constants again in the other.
    const lit = vec4(outputNode).toVar("groundLit");
    const hazed = hazeOver(this.s.spec.haze, this.how, lit.rgb, this.world, { keep });
    return super.setupOutput(builder, vec4(hazed, lit.a));
  }
}

/** The ground's twin over the ground's material `m`, made off its spec
 * (`groundSpecs`), or null for a material that is not the ground's. `m`
 * takes a node, which tells the renderer to refresh every frame what it
 * draws `m` — and every level's material that shares its program — with:
 * it otherwise watches the materials' own fields alone, which never move,
 * and would draw each level with the uniforms its first frame left. */
export function groundTwin(
  m: THREE.Material,
  spec: GroundSpec | undefined,
  how: HazeFogOptions,
): NodeMaterial | null {
  if (!spec) return null;
  const twin = new GroundMaterial(spec, how);
  (m as unknown as { groundNode: N }).groundNode = twin.positionNode;
  // The lights' nodes are set up over `m`, not the twin: the snow lights its
  // own lamps, so the scene's are not added again (`lights-tsl.ts`).
  m.userData.ownLamps = twin.userData.ownLamps;
  return twin;
}
