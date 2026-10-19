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
//   tool has touched it, and where its cells are finer than the eye
//   needs, as on WebGL.
//   THE FRAGMENT: what the snow is (`snow-sample-tsl.ts`), its colour and
//   roughness, its normal off the ground map's slope (never the mesh's),
//   lit by its own model (`snow-light-tsl.ts`) and hazed as `HAZE_FRAGMENT`
//   hazes it, keeping the bare rock's own share of its colour
//   (`HAZE_KEEP`). A summer's ground (`summer-tsl.ts`) is its own sample and
//   colour over the same vertex.
//   THE ROOMS: the cutting twin throws away the snow inside a room built or
//   a pit dug (`room-cuts.ts`), as its mask.
//
// THE MARKS (part 5): the trail map's relief lowers the vertex (a tent over
// the fine map close in, the coarse map further out, the deformable snow's
// field on its own mesh), the tree wells sink it and the avalanche's bed
// and debris move it; the furrows, the grooves, the other skiers' lines,
// the wells and the slide are shaded per pixel (`snow-sample-tsl.ts`).

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
import { DEFORM_FINE_PX } from "./snow-vertex-glsl.ts";
import { LOOSE } from "./trail-stamp.ts";

const {
  Fn,
  If,
  Continue,
  Loop,
  abs,
  all,
  cameraPosition,
  cameraViewMatrix,
  clamp,
  diffuseColor,
  distance,
  dot,
  float,
  greaterThanEqual,
  ivec2,
  length,
  lessThanEqual,
  max,
  min,
  mix,
  mod,
  normalize,
  positionGeometry,
  smoothstep,
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

/** `deformTouched`: whether a tool has touched the deformable snow over a
 * block of its cells — `n` × `n` taps from `from` cells past `p`, `step`
 * cells apart; 1 when any has. */
function deformTouched(s: GroundSlots, p: N, from: number, step: number, n: number): N {
  let most: N = float(0);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const at = p.add(vec2(i * step + from, j * step + from).mul(s.spacing));
      most = max(most, s.vertex.trail.deformAt(at).y);
    }
  }
  return clamp(most.mul(4), 0, 1);
}

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
      // THE DEFORMABLE SNOW'S MESH THINNED WHERE IT HAS NOTHING TO SHOW
      // (`SNOW_VERTEX_PLACE`): folded four wide where no tool has touched
      // it, and where one has, kept until a cell is under
      // `DEFORM_FINE_PX` pixels.
      If(s.deformMesh.greaterThan(0.5).and(s.focalPx.greaterThan(0)), () => {
        const e = grid.sub(mod(grid, 2)).toVar();
        const q = e.sub(mod(e, 4));
        const xzE = s.levelCentre.add(e.sub(s.gridHalf).mul(s.spacing)).toVar();
        const xzQ = s.levelCentre.add(q.sub(s.gridHalf).mul(s.spacing)).toVar();
        const pxAt = (at: N): N =>
          s.spacing
            .mul(s.focalPx)
            .div(
              max(
                length(
                  vec3(at.x, groundHeight(s, rimSlot.tex, rimBox, at), at.y).sub(cameraPosition),
                ),
                0.01,
              ),
            );
        const fine = DEFORM_FINE_PX;
        const fold1 = max(
          float(1).sub(deformTouched(s, xzE, 0.5, 1, 2)),
          clamp(
            float(fine)
              .sub(pxAt(xzE))
              .div(fine / 2),
            0,
            1,
          ),
        ).toVar();
        const fold2 = max(
          float(1).sub(deformTouched(s, xzQ, 0.5, 1.5, 3)),
          clamp(
            float(fine / 2)
              .sub(pxAt(xzQ))
              .div(fine / 4),
            0,
            1,
          ),
        ).toVar();
        xz.subAssign(mod(grid, 2).mul(fold1).add(mod(e, 4).mul(fold2)).mul(s.spacing));
        cellV.assign(s.spacing.mul(fold1.add(1).add(fold2.mul(2))));
      });
      // THE FURROW, low-passed to what the mesh can carry here: a tent over
      // the fine map close in, the coarse map further out — a function of
      // the distance, so two levels meeting at a vertex agree.
      const trail = s.vertex.trail;
      const snowR = max(s.baseSpacing, length(xz.sub(cameraPosition.xz)).div(s.reliefHalf)).toVar();
      const ct = tap(trail.coarse.tex, xz.div(trail.mapSize)).level(0).rg.mul(trail.scale).toVar();
      const relief = ct.x
        .negate()
        .add(ct.y.mul(float(1).sub(clamp(ct.x.div(0.03), 0, 1))))
        .toVar();
      const nearW = float(1)
        .sub(smoothstep(0.35, 0.7, snowR))
        .toVar();
      If(nearW.greaterThan(0), () => {
        const fineRelief = float(0).toVar();
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            const w = (i === 0 ? 0.5 : 0.25) * (j === 0 ? 0.5 : 0.25);
            fineRelief.addAssign(trail.relief(xz.add(vec2(i, j).mul(snowR))).mul(w));
          }
        }
        relief.assign(mix(relief, fineRelief, nearW));
      });
      // ON THE DEFORMABLE SNOW'S MESH: the field itself, a vertex a cell.
      If(s.deformMesh.greaterThan(0.5), () => {
        const dwv = trail.deformWeight(xz).toVar();
        If(dwv.greaterThan(0), () => {
          relief.assign(mix(relief, trail.relief(xz), dwv));
        });
      });
      const g = tap(s.ground, xz.sub(s.origin).add(s.cell.mul(0.5)).div(s.count.mul(s.cell)))
        .level(0)
        .toVar();
      const packedV = max(g.b, 0);
      // THE TREE WELLS (`tree-wells.ts`) and THE AVALANCHE
      // (`avalanche-glsl.ts`): its bed below, its debris above.
      const y = groundHeight(s, rimSlot.tex, rimBox, xz)
        .add(relief)
        .add(float(LOOSE).mul(float(1).sub(packedV)))
        .sub(s.vertex.well(xz))
        .add(s.vertex.slide.at(xz))
        .add(rimSlot.keep)
        .add(trail.keep())
        .add(s.vertex.slide.keep)
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
