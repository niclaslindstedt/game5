// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIGURES ON THE NODE RENDERER (`docs/webgpu.md`, part 11): the free
// ride's amateurs, the people on foot, the dogs, the traffic, a race's
// fans, the birds and the animals, and the blooded tree — each a classic
// material WebGL draws with GLSL grafted into it (`hazeMaterial`'s
// `extra`), flagged `nodeTwin(material, "figures", kind)`, and drawn here
// by a NODE TWIN: a copy of the material, field for field as three's own
// library copies one, whose vertex runs the graft in TSL.
//
// THE GRAFTS RUN WHERE WEBGL RUNS THEM. Three's node material moves a
// vertex by its morphs, then its instance, then its `positionNode`; a
// graft that turns a wing or swings a leg runs in the figure's OWN frame,
// before the instance's matrix — and a `positionNode` runs after it. So a
// twin's `setupPosition` is its own (`FigurePose`):
//
//   early   GLSL's `begin_vertex`: before the morphs (a wing folded, a leg
//           swung, a part folded away);
//   late    GLSL's `morphtarget_vertex`: after them (a part an instance
//           does not wear, folded to its feet);
//   post    after the instance's matrix;
//   instance  in place of three's instance matrix: the instance's own
//           move, read off an attribute (a fan, whose matrix is a
//           translation alone). Three reads a matrix off a uniform array
//           sized to the mesh's count, which writes a vertex program for
//           every count — one a stand of fans;
//   paint   GLSL's `color_vertex`: the vertex's colour off the instance's
//           outfit, given the vertex colour, the instance's tint and the
//           point as posed. A twin that paints draws its colour off that
//           varying alone, the tint already in it, as WebGL's `vColor` is.
//
// THE SHADOW TAKES THE SAME VERTEX where WebGL's does. Three's shadow pass
// draws every caster with one material of its own, moved by the caster's
// `positionNode` after its instance — never a graft's vertex. Where WebGL
// draws a caster's depth with the graft too (`figureDepth` on its
// `customDepthMaterial`: the civilians' folds, an animal's gait), the key's
// shadow node hands the pass a shadow material of the figure's own
// (`figureShadow`, `shadows-tsl.ts`), moved by the same pose; elsewhere
// the caster is drawn as WebGL draws it, by the morphs and the instance.
//
// EIGHT VERTEX BUFFERS. The node renderer binds every attribute a vertex
// reads as a buffer of its own, and a WebGPU device need allow no more than
// eight; a figure reading more (the traffic's marks, a fan's dealt look)
// reads the ones that never change from ONE interleaved copy
// (`interleave`, `packed`), made the first time its twin is built. WebGL
// reads the separate ones it always has.
//
// A material's own numbers (a species' wrist, a beast's gait, a stain's
// front) are read off the material drawn (`own`, `userData.figureOwn`):
// materials with one graft share one program on the node renderer as on
// WebGL, and a uniform naming its own object would hand every one of them
// the first one's.

import * as THREE from "three";
import * as TSL from "three/tsl";
import {
  MeshLambertNodeMaterial,
  MeshStandardNodeMaterial,
  NodeMaterial,
  type NodeBuilder,
} from "three/webgpu";

import { insideWall } from "./glow-tsl.ts";
import type { HazeUniforms } from "./haze.ts";
import type { N } from "./haze-tsl.ts";

const {
  Fn,
  If,
  abs,
  attribute,
  float,
  instanceColor,
  instancedMesh,
  materialColor,
  materialReference,
  morphReference,
  positionLocal,
  varyingProperty,
  vec3,
  vec4,
  vertexColor,
} = TSL as N;

/** What a figure's vertex is moved and painted by (see the header). Each
 * builds its nodes when called, inside the vertex's own stack. */
export type FigurePose = {
  /** Before anything: the geometry readied (`interleave`) for `object`. */
  prepare?: (geometry: THREE.BufferGeometry, object: THREE.Object3D) => void;
  early?: (p: N, ctx: PoseContext) => N;
  late?: (p: N, ctx: PoseContext) => N;
  instance?: (p: N, ctx: PoseContext) => N;
  post?: (p: N, ctx: PoseContext) => N;
  paint?: (colour: N, tint: N, ctx: PoseContext) => N;
};

/** What a pose's steps hand each other: the point as posed in the
 * figure's frame (`posed`, before the instance), and whatever a step kept
 * for the paint. */
export type PoseContext = { posed: N; kept: Record<string, N> };

/** What a twin of kind `kind` is built with: its pose, and its fragment's
 * extras (a roughness, a glow, the blood) over the copy. */
export type FigureSpec = {
  pose: FigurePose;
  /** Finish the twin's fragment (roughness, emissive…). */
  dress?: (twin: NodeMaterial, own: Own) => void;
  /** After the diffuse colour: discard, repaint (the blooded tree). */
  diffuse?: (own: Own) => void;
};

/** A material's own uniform `name`, read off the material drawn. */
export type Own = (name: string, type: string) => N;
const owned = new Map<string, N>();
export const own: Own = (name, type) => {
  let node = owned.get(name);
  if (!node) owned.set(name, (node = materialReference(`userData.figureOwn.${name}.value`, type)));
  return node;
};

/** A uniform of the material's own, by reference: what every material of
 * a kind shares the value of (the palettes, the clock). */
export const ownValue = (m: THREE.Material, name: string): { value: unknown } =>
  (m.userData.figureOwn as Record<string, { value: unknown }>)[name];

/** The vertex colour a painted twin is drawn with (see the header). */
const PAINT: N = varyingProperty("vec3", "vFigurePaint");

/** THE VERTEX (see the header): the pose's steps round three's own morphs
 * and instance; the paint after them, the posed point kept for it. */
function setupPose(builder: NodeBuilder, pose: FigurePose, paint: boolean): N {
  const object = builder.object as THREE.InstancedMesh;
  const geometry = builder.geometry as THREE.BufferGeometry;
  pose.prepare?.(geometry, object);
  Fn(() => {
    const ctx: PoseContext = { posed: positionLocal, kept: {} };
    if (pose.early) positionLocal.assign(pose.early(positionLocal, ctx));
    const morphs = geometry.morphAttributes;
    if (morphs.position || morphs.normal || morphs.color) morphReference(object);
    if (pose.late) positionLocal.assign(pose.late(positionLocal, ctx));
    const painted = paint && pose.paint;
    if (painted) ctx.posed = positionLocal.toVar();
    if (pose.instance) positionLocal.assign(pose.instance(positionLocal, ctx));
    else if (object.isInstancedMesh && object.instanceMatrix?.isInstancedBufferAttribute)
      instancedMesh(object);
    if (pose.post) positionLocal.assign(pose.post(positionLocal, ctx));
    if (painted) {
      const tint = object.instanceColor ? instanceColor : vec3(1);
      PAINT.assign(pose.paint!(vertexColor().rgb, tint, ctx));
    }
  }, "void")();
  return positionLocal;
}

type Twin = NodeMaterial & { figure: FigureSpec };

/** A node material class whose vertex is a figure's (see the header). */
function figureClass<T extends new (...args: any[]) => NodeMaterial>(Base: T) {
  return class extends Base {
    figure!: FigureSpec;

    setupPosition(builder: NodeBuilder): N {
      return setupPose(builder, this.figure.pose, true);
    }

    setupDiffuseColor(builder: NodeBuilder): void {
      // A painted twin's tint is in its paint, as WebGL's `vColor` has it:
      // three's own multiply by the instance's colour is left out.
      const object = builder.object as THREE.InstancedMesh;
      const tint = this.figure.pose.paint ? object.instanceColor : null;
      if (tint) object.instanceColor = null;
      try {
        super.setupDiffuseColor(builder);
      } finally {
        if (tint) object.instanceColor = tint;
      }
      this.figure.diffuse?.(own);
    }
  };
}

const FigureLambert = figureClass(MeshLambertNodeMaterial);
const FigureStandard = figureClass(MeshStandardNodeMaterial);

/** A shadow pass's material for a caster whose WebGL depth takes its
 * graft: three's own shadow material (a colour of 0, no blending, no fog)
 * moved by the figure's pose. */
class FigureShadow extends NodeMaterial {
  readonly isShadowPassMaterial = true;
  constructor(private readonly pose: FigurePose) {
    super();
    this.name = "figure-shadow";
    this.colorNode = vec4(0, 0, 0, 1);
    this.blending = THREE.NoBlending;
    this.fog = false;
  }

  setupPosition(builder: NodeBuilder): N {
    return setupPose(builder, this.pose, false);
  }
}

/** THE TWIN of a figure's material `m` drawn by `spec`: the material
 * copied field for field (three's `NodeLibrary.fromMaterial`), hazed and
 * walled as `gpu-dress.ts` finishes a copy, with the kind's vertex and
 * fragment. */
export function figureTwin(m: THREE.Material, spec: FigureSpec, haze: HazeUniforms): NodeMaterial {
  const standard = (m as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;
  const twin = (standard ? new FigureStandard() : new FigureLambert()) as Twin;
  const into = twin as unknown as Record<string, unknown>;
  const from = m as unknown as Record<string, unknown>;
  for (const key in m) into[key] = from[key];
  twin.figure = spec;
  // The paint carries the vertex colour.
  if (spec.pose.paint) {
    twin.vertexColors = false;
    twin.colorNode = materialColor.mul(vec4(PAINT, 1));
  }
  twin.fog = m.userData.haze === true;
  if (m.userData.hazeWall === true) twin.maskNode = insideWall(haze);
  spec.dress?.(twin, own);
  // The renderer refreshes a draw's uniforms in full only for a material
  // with a node of its own, and the material drawn is `m`.
  (m as unknown as { figureNode: N }).figureNode = twin.colorNode ?? float(0);
  return twin;
}

/** THE SHADOW MATERIAL for a caster whose WebGL depth material `depth`
 * carries a figure's graft, moved by `pose`: its own numbers read off it
 * (`userData` shared). */
export function figureShadow(depth: THREE.Material, pose: FigurePose): NodeMaterial {
  const shadow = new FigureShadow(pose);
  shadow.userData = depth.userData;
  shadow.side = depth.side;
  return shadow;
}

/** An attribute `interleave` packed, by its own name. */
export const packed = (name: string, type: string): N => attribute(`fig_${name}`, type);

/** Copy `g`'s attributes `names` (never written again, each its own
 * array) into one interleaved buffer — instanced if they are — read by
 * `packed` (see the header). Done once a geometry. */
export function interleave(g: THREE.BufferGeometry, names: readonly string[]): void {
  if (g.hasAttribute(`fig_${names[0]}`)) return;
  const from = names.map((n) => g.getAttribute(n) as THREE.BufferAttribute);
  const stride = from.reduce((s, a) => s + a.itemSize, 0);
  const count = from[0].count;
  const array = new Float32Array(count * stride);
  let offset = 0;
  for (const a of from) {
    for (let i = 0; i < count; i++)
      for (let k = 0; k < a.itemSize; k++)
        array[i * stride + offset + k] = a.array[i * a.itemSize + k];
    offset += a.itemSize;
  }
  const first = from[0] as THREE.InstancedBufferAttribute;
  const buffer = first.isInstancedBufferAttribute
    ? new THREE.InstancedInterleavedBuffer(array, stride, first.meshPerAttribute)
    : new THREE.InterleavedBuffer(array, stride);
  offset = 0;
  names.forEach((n, j) => {
    const size = from[j].itemSize;
    g.setAttribute(`fig_${n}`, new THREE.InterleavedBufferAttribute(buffer, size, offset));
    offset += size;
  });
}

/** `If` written as GLSL's chain of `a < k ? x : …`: the value of the first
 * band `v` falls under, over thresholds rising by one from `from` (each
 * value its band's: `values[0]` below `from`, `values[1]` below `from + 1`,
 * … the last above them all). */
export function band(v: N, from: number, values: N[]): N {
  const out = (values[0] as N).toVar();
  for (let k = 1; k < values.length; k++) {
    If(v.greaterThanEqual(from + k - 1), () => {
      out.assign(values[k]);
    });
  }
  return out;
}

/** GLSL's `mod`: `x − y·floor(x / y)`. */
export const glslMod = (x: N, y: N | number): N => x.sub(TSL.floor(x.div(y)).mul(y));

/** `abs(a − b) > 0.5`: whether `a` is not `b`'s whole number. */
export const notNear = (a: N, b: N): N => abs(a.sub(b)).greaterThan(0.5);
