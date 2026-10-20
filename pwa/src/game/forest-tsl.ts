// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS' MATERIALS ON THE NODE RENDERER (`docs/webgpu.md`, part 8):
// `forest.ts`'s, `tree-snow.ts`'s, `tree-mesh.ts`'s and
// `tree-card-material.ts`'s GLSL restated as TSL for the shapes
// `forest-nodes.ts` draws instanced, over the SAME tree table WebGL's batch
// reads (`forest-batch.ts`). The GLSL is the authority, term for term:
//
//   treeFrame     the tree a vertex belongs to, off its own `treeWord` (the
//                 batch's slot word): its matrix and its numbers fetched by
//                 texel from the table (`BATCH_VERTEX`), the trunk pushed out
//                 to its girth (`GIRTH_VERTEX`) and the crown swayed by the
//                 wind (`TREE_WIND_VERTEX`, the matrix's inverse taken as
//                 its columns over their squared lengths, since it is a turn
//                 and a stretch);
//   tree          the faceted cuts: a face's snow kept or shed by the tree's
//                 load, the green and the bark tinted (`TREE_SNOW_VERTEX`),
//                 the hand-over's dither (`graftTree`), lit by three's
//                 standard model as WebGL's `MeshStandardMaterial` is;
//   cards         the card trees: the atlas's four channels read apart, the
//                 snow laid by the sky and the load, an edge-on card faded,
//                 the underside darker, the backlight (`graftCards`,
//                 `graftCardTree`);
//   casters       the casters' depth: the girth and the wind, the
//                 mountain's shade discarded (`castMask`, as
//                 `createShadeDepth` on WebGL).
//
// THE NORMAL IS THE BATCH'S. Three's batching chunk turns a normal by the
// tree's matrix over its columns' squared lengths (a stretch kept, a shear
// not); `setupPosition` does the same to `normalLocal`, so the lighting
// reads the normal WebGL's does. The casters need no normal and take a
// `positionNode`, which the shadow pass copies.
//
// Every material is hazed by the scene's fog node and lit by the key's and
// the sky's nodes (`userData.haze`, `gpu-dress.ts`), as `hazeMaterial`
// dresses WebGL's.

import * as THREE from "three";
import * as TSL from "three/tsl";
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu";

import { TREE_BITS, type BatchUniforms } from "./forest-batch.ts";
import type { WoodsKit } from "./forest-nodes.ts";
import type { HazeUniforms } from "./haze.ts";
import { slot, tap, texel, texSlot, type N } from "./haze-tsl.ts";
import { castMask } from "./shadows-tsl.ts";
import { ALPHA_CUT } from "./tree-atlas.ts";
import { SNOW, SNOW_SHADE } from "./tree-shapes.ts";

const {
  Fn,
  abs,
  attribute,
  cameraPosition,
  clamp,
  cross,
  dFdx,
  dFdy,
  diffuseColor,
  dot,
  float,
  fract,
  int,
  ivec2,
  length,
  max,
  mix,
  normalGeometry,
  normalLocal,
  normalize,
  positionGeometry,
  positionLocal,
  positionView,
  positionWorld,
  pow,
  screenCoordinate,
  select,
  sin,
  smoothstep,
  texture,
  textureLoad,
  textureSize,
  uint,
  uniform,
  uv,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** What a table's slot holds before a batch binds it: one float texel, of
 * the format the binding is laid out for. */
function blankTable(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
  t.needsUpdate = true;
  return t;
}

/** A batch's table and the wind, as the vertex reads them. Each texture
 * follows its slot every render (a rebuilt batch binds a new table). */
type Reader = { matrix: N; data: N; keep: N; wind: N };

function readerOf(u: BatchUniforms, wind: THREE.IUniform<THREE.Vector4>): Reader {
  const matrix = texSlot(u.uTreeMatrix, blankTable());
  const data = texSlot(u.uTreeData, blankTable());
  return {
    matrix: matrix.tex,
    data: data.tex,
    keep: matrix.keep.add(data.keep),
    wind: slot(wind, "vec4"),
  };
}

/** Texel `k` of a table `w` texels wide. */
const at = (t: N, w: N, k: N): N => texel(t, ivec2(k.mod(w), k.div(w)));

/** THE TREE A VERTEX BELONGS TO (see the header): its matrix's columns, its
 * numbers (`d0`: girth x, girth z, tone, load; `d1`: the tint and a hash),
 * its dither window, and the vertex placed in its own frame. */
function treeFrame(r: Reader): { c: N[]; d0: N; d1: N; fade: N; p: N } {
  const word = attribute("treeWord", "uint");
  const tree = int(word.bitAnd(uint((1 << TREE_BITS) - 1))).toVar();
  const lo = float(word.shiftRight(uint(TREE_BITS)).bitAnd(uint(127)));
  const hi = float(word.shiftRight(uint(TREE_BITS + 7)).bitAnd(uint(127)));
  const mw = int(textureSize(textureLoad(r.matrix), 0).x);
  const dw = int(textureSize(textureLoad(r.data), 0).x);
  const m = tree.mul(4).toVar();
  const c = [0, 1, 2, 3].map((k) => at(r.matrix, mw, m.add(k)).toVar());
  const d = tree.mul(2).toVar();
  const d0 = at(r.data, dw, d).toVar();
  const d1 = at(r.data, dw, d.add(1)).toVar();
  // The girth (`GIRTH_VERTEX`).
  const stem = attribute("stem", "vec3");
  const p0 = positionGeometry;
  const xz = stem.xy.add(p0.xz.sub(stem.xy).mul(mix(vec2(1), d0.xy, stem.z)));
  const p = vec3(xz.x, p0.y, xz.y).toVar();
  // The wind in the crown (`TREE_WIND_VERTEX`).
  const w = r.wind;
  const phase = w.w.mul(d1.w.mul(0.6).add(1.1)).add(d1.w.mul(6.2831853));
  const swing = float(0.0004)
    .add(sin(phase).mul(0.0004))
    .add(sin(phase.mul(2.7).add(1.3)).mul(0.00015));
  const height = length(c[1].xyz);
  const world = vec3(w.x, 0, w.y).mul(p.y.mul(p.y).mul(swing).mul(height));
  const back = vec3(
    dot(c[0].xyz, world).div(dot(c[0].xyz, c[0].xyz)),
    dot(c[1].xyz, world).div(dot(c[1].xyz, c[1].xyz)),
    dot(c[2].xyz, world).div(dot(c[2].xyz, c[2].xyz)),
  );
  const swayed = length(w.xy).greaterThan(0.05).and(p.y.greaterThan(0));
  p.addAssign(select(swayed, back, vec3(0)));
  return { c, d0, d1, fade: vec2(lo, hi).div(127), p };
}

/** `p` carried into the world by the tree's columns, `r.keep` in the graph. */
const placed = (f: { c: N[]; p: N }, keep: N): N =>
  f.c[0].xyz
    .mul(f.p.x)
    .add(f.c[1].xyz.mul(f.p.y))
    .add(f.c[2].xyz.mul(f.p.z))
    .add(f.c[3].xyz)
    .add(keep);

/** The normal turned as three's batching chunk turns it. */
const turned = (c: N[], n: N): N => {
  const s = n.div(vec3(dot(c[0].xyz, c[0].xyz), dot(c[1].xyz, c[1].xyz), dot(c[2].xyz, c[2].xyz)));
  return c[0].xyz.mul(s.x).add(c[1].xyz.mul(s.y)).add(c[2].xyz.mul(s.z));
};

/** THE HAND-OVER'S DITHER (`graftTree`): whether a fragment is inside the
 * window its tree is kept in. */
function inWindow(fade: N): N {
  const d = fract(
    float(52.9829189).mul(fract(dot(screenCoordinate.xy, vec2(0.06711056, 0.00583715)))),
  );
  return d.greaterThanEqual(fade.x).and(d.lessThan(fade.y));
}

/** What the vertex hands the fragment: the dither window, the tinted
 * colour. */
const FADE: N = varyingProperty("vec2", "vTreeFade");
const TINT: N = varyingProperty("vec3", "vTreeColour");

/** THE FACETED CUTS (see the header). */
class TreeMaterial extends MeshStandardNodeMaterial {
  private readonly r: Reader;

  constructor(r: Reader) {
    super({ roughness: 0.9, metalness: 0 });
    this.r = r;
    this.name = "forest";
    this.fog = true;
    this.userData.haze = true;
    this.colorNode = vec4(TINT, 1);
    this.maskNode = inWindow(FADE);
  }

  setupPosition(): N {
    const r = this.r;
    Fn(() => {
      const f = treeFrame(r);
      positionLocal.assign(placed(f, r.keep));
      normalLocal.assign(turned(f.c, normalGeometry));
      FADE.assign(f.fade);
      // The tree's own snow and tint (`TREE_SNOW_VERTEX`).
      const col = attribute("color", "vec3");
      const snowy = attribute("snowy", "vec4");
      const tint = f.d1.rgb;
      const snow = select(snowy.a.greaterThan(f.d0.w), snowy.rgb.mul(tint), col);
      TINT.assign(select(snowy.a.greaterThan(0), snow, col.mul(tint)).mul(f.d0.z));
    }, "void")();
    return positionLocal;
  }
}

/** THE CARD TREES (see the header, and `tree-card-material.ts`). */
class CardTreeMaterial extends MeshStandardNodeMaterial {
  private readonly r: Reader;
  private readonly card: N = varyingProperty("vec2", "vCard");
  private readonly up: N = varyingProperty("float", "vCardUp");
  private readonly load: N = varyingProperty("float", "vCardLoad");

  constructor(r: Reader, atlas: THREE.Texture, key: THREE.DirectionalLight | null) {
    super({ roughness: 0.9, metalness: 0 });
    this.r = r;
    this.name = "forest-cards";
    this.fog = true;
    this.userData.haze = true;
    this.alphaTest = ALPHA_CUT;
    this.maskNode = inWindow(FADE);
    const map = texture(atlas);
    const at = uv();
    const tex = tap(map, at).toVar("cardTex");
    // An edge-on card's tile is one blot: faded out past grazing. The
    // footprint is taken in uniform control flow, before any choice.
    const face = normalize(cross(dFdx(positionView), dFdy(positionView)));
    const seen = abs(dot(face, normalize(positionView)));
    const edge = tex.b.greaterThan(0.02).or(tex.a.lessThan(0.98));
    const alpha = tex.a.mul(select(edge, smoothstep(0.06, 0.28, seen), float(1)));
    // The snow, read a level and a half down the mips.
    const mask = tap(map, at).bias(1.5).g;
    const under = this.card.y.greaterThan(0.5);
    const sky = smoothstep(0.3, 0.95, this.up).toVar("cardSky");
    const crust = float(0.32)
      .mul(tex.a)
      .mul(smoothstep(1.05, 1.45, this.card.x))
      .mul(smoothstep(0.8, 0.95, this.up));
    const lump = max(mask, crust).mul(this.card.x).mul(this.load).mul(sky.mul(0.7).add(0.3));
    const snow = select(under, float(0), smoothstep(0.26, 0.34, lump)).toVar("cardSnow");
    const shade = mix(0.72, 1.2, tex.r).mul(select(under, float(0.62), float(1)));
    const needles = TINT.mul(shade);
    const white = mix(
      vec3(SNOW_SHADE.r, SNOW_SHADE.g, SNOW_SHADE.b),
      vec3(SNOW.r, SNOW.g, SNOW.b),
      sky,
    );
    this.colorNode = vec4(mix(needles, white, snow), alpha);
    // THE BACKLIGHT: a needle spray between the lens and a low sun glows at
    // its thin edges, never its snow (`CARD_BACKLIGHT`, the key's colour).
    if (key) {
      const colour = new THREE.Color();
      const dir = new THREE.Vector3();
      const keyColour = uniform(colour).onRenderUpdate(() =>
        colour.copy(key.color).multiplyScalar(key.intensity),
      );
      const keyDir = uniform(dir).onRenderUpdate(() =>
        dir
          .setFromMatrixPosition(key.matrixWorld)
          .sub(new THREE.Vector3().setFromMatrixPosition(key.target.matrixWorld))
          .normalize(),
      );
      const back = max(0, dot(normalize(positionWorld.sub(cameraPosition)), keyDir));
      this.emissiveNode = keyColour
        .mul(diffuseColor.rgb)
        .mul(pow(back, 12).mul(0.12).mul(tex.b).mul(float(1).sub(snow)));
    }
  }

  setupPosition(): N {
    const r = this.r;
    Fn(() => {
      const f = treeFrame(r);
      positionLocal.assign(placed(f, r.keep));
      normalLocal.assign(turned(f.c, normalGeometry));
      FADE.assign(f.fade);
      this.card.assign(attribute("card", "vec2"));
      // The card's turn is the tree's (`CARD_VERTEX`).
      const n = normalGeometry;
      this.up.assign(
        normalize(f.c[0].xyz.mul(n.x).add(f.c[1].xyz.mul(n.y)).add(f.c[2].xyz.mul(n.z))).y,
      );
      this.load.assign(clamp(f.d0.w, 0, 1.2).mul(0.55).add(0.25));
      TINT.assign(attribute("color", "vec3").mul(f.d1.rgb).mul(f.d0.z));
    }, "void")();
    return positionLocal;
  }
}

/** The casters' depth (see the header): only ever drawn into the key's map. */
function casterMaterial(r: Reader, u: HazeUniforms): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial();
  m.name = "forest-casters";
  m.fog = false;
  m.lights = false;
  m.positionNode = Fn(() => placed(treeFrame(r), r.keep))();
  m.maskShadowNode = castMask(u);
  return m;
}

/** The woods' kit for `forest.ts` (`render-seam.ts`'s `woods`): the
 * backlight takes `key`'s colour and direction. */
export function woodsKit(u: HazeUniforms, key: THREE.DirectionalLight | null): WoodsKit {
  return {
    tree: (b, wind) => new TreeMaterial(readerOf(b, wind)),
    cards: (b, wind, atlas) => new CardTreeMaterial(readerOf(b, wind), atlas, key),
    casters: (b, wind) => casterMaterial(readerOf(b, wind), u),
  };
}
