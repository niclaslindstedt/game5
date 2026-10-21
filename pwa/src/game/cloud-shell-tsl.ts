// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LOW'S CLOUD ON THE NODE RENDERER: the field read along the view from the
// lens (`cloud-glsl.ts`'s `CLOUD_FIELD_GLSL` and `CLOUD_SHELL_GLSL`), the
// layers stacked front to back (`cloudStackGlsl`) and the 22° halo
// (`CLOUD_HALO_GLSL`), restated as TSL for the dome's node twin
// (`sky-dome-tsl.ts`, `docs/webgpu.md` part 3). The GLSL is the authority,
// term for term; the field's uniforms are `clouds.ts`'s own, read by
// reference, and its noise the same field off a 2D atlas (`noiseAtlas`).
//
// The shell is LOW's on the webgpu paths as on WebGL. Its pieces (the
// noise, the column, the light, the air, one layer's read) are what the
// clouds' passes are built from too (part 10): `cloud-pass-tsl.ts` draws
// the shadow map and MEDIUM's slab, and `cloud-volume-tsl.ts` HIGH's volume.

import * as TSL from "three/tsl";
import * as THREE from "three";

import { CLOUD_LAYERS, EDGE, SECOND } from "./cloud-field.ts";
import type { CloudUniforms } from "./clouds.ts";
import { slot, type N } from "./haze-tsl.ts";

// Read untyped, as every node here is (`haze-tsl.ts`'s `N`).
const {
  Break,
  If,
  Loop,
  acos,
  clamp,
  degrees,
  dot,
  exp,
  float,
  floor,
  fract,
  int,
  max,
  min,
  mix,
  mod,
  pow,
  renderGroup,
  select,
  smoothstep,
  step,
  texture,
  uniformArray,
  vec2,
  vec3,
  vec4,
} = TSL as N;

/** THE NOISE AS A 2D ATLAS. Dawn on some back ends (SwiftShader's among
 * them) refuses every write into a 3D texture, so the node renderer reads
 * every 3D noise (the field's 64³, the volume's shape and detail) off a 2D
 * sheet instead: its slices laid out in a square grid, each tile carrying
 * a one-texel border wrapped off its opposite edge, so the sampler's own
 * bilinear filter repeats as the 3D one does; the depth is filtered by
 * hand between two slices (`readNoise`). One channel or four, as the 3D
 * texture has. Made once per noise. */
export type Atlas = { tex: THREE.DataTexture; n: number; grid: number; size: number };
const atlases = new WeakMap<THREE.Data3DTexture, Atlas>();
export function noiseAtlas(src: THREE.Data3DTexture): Atlas {
  const had = atlases.get(src);
  if (had) return had;
  const { data, width: n } = src.image as { data: Uint8Array; width: number };
  const ch = data.length / (n * n * n) >= 4 ? 4 : 1;
  const grid = Math.ceil(Math.sqrt(n));
  const tile = n + 2;
  const size = grid * tile;
  const out = new Uint8Array(size * size * ch);
  const wrap = (i: number): number => (i + n) % n;
  for (let z = 0; z < n; z++) {
    const ox = (z % grid) * tile;
    const oy = Math.floor(z / grid) * tile;
    for (let y = -1; y <= n; y++)
      for (let x = -1; x <= n; x++) {
        const to = ((oy + 1 + y) * size + ox + 1 + x) * ch;
        const from = (wrap(x) + wrap(y) * n + z * n * n) * ch;
        for (let k = 0; k < ch; k++) out[to + k] = data[from + k];
      }
  }
  const format = ch === 4 ? THREE.RGBAFormat : THREE.RedFormat;
  const tex = new THREE.DataTexture(out, size, size, format, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  const atlas = { tex, n, grid, size };
  atlases.set(src, atlas);
  return atlas;
}

/** The atlas read at `at` in the 3D texture's own coordinates (repeating),
 * as `texture(tex3d, at)` reads it: every channel. */
export function readNoise(atlas: Atlas, sheet: N, at: N): N {
  const { n, grid, size } = atlas;
  const tile = n + 2;
  const xy = fract(at.xy).mul(n).add(1).toVar();
  const zz = fract(at.z).mul(n).sub(0.5).toVar();
  const z0 = floor(zz).toVar();
  const f = zz.sub(z0);
  const slice = (z: N): N => {
    const k = mod(z, n);
    const o = vec2(mod(k, grid), floor(k.div(grid))).mul(tile);
    return sheet.sample(o.add(xy).div(size)).level(0);
  };
  return mix(slice(z0), slice(z0.add(1)), f);
}

/** A per-layer array read as `GLSL`'s `uX[i]`. */
export type Layered = { element(i: N): N };

/** SEVERAL PER-LAYER ARRAYS PACKED INTO ONE. The node renderer makes a
 * uniform buffer of every array a stage reads, and a WebGPU stage may bind
 * no more than twelve (the floor every adapter offers): the volume's march
 * read thirteen with each array its own. So the arrays of a pass are copied
 * into one array of vec4s each render, `sources[j]`'s layer `i` at
 * `j × CLOUD_LAYERS + i`, and each read back as its own (`.xyz` for a vec3's). */
export function packLayers(sources: { value: (THREE.Vector4 | THREE.Vector3)[] }[]): Layered[] {
  const packed = Array.from({ length: sources.length * CLOUD_LAYERS }, () => new THREE.Vector4());
  const node: N = (uniformArray(packed, "vec4") as N).setGroup(renderGroup).onRenderUpdate(() => {
    sources.forEach((s, j) => {
      for (let i = 0; i < CLOUD_LAYERS; i++) {
        const v = s.value[i];
        packed[j * CLOUD_LAYERS + i].set(v.x, v.y, v.z, (v as THREE.Vector4).w ?? 0);
      }
    });
  });
  return sources.map((s, j) => {
    const three = !(s.value[0] as THREE.Vector4).isVector4;
    return {
      element: (i: N): N => {
        const v = node.element(int(j * CLOUD_LAYERS).add(i));
        return three ? v.xyz : v;
      },
    };
  });
}

/** What the shell's nodes read: the field's slots once a material. */
export type CloudSlots = ReturnType<typeof cloudSlots>;

export function cloudSlots(u: CloudUniforms) {
  const atlas = noiseAtlas(u.uCloudNoise.value as THREE.Data3DTexture);
  const [A, B, C, sun, top, base] = packLayers([
    u.uCloudA,
    u.uCloudB,
    u.uCloudC,
    u.uCloudSun,
    u.uCloudTop,
    u.uCloudBase,
  ]);
  return {
    atlas,
    sheet: texture(atlas.tex) as N,
    A,
    B,
    C,
    sun,
    top,
    base,
    on: slot(u.uCloudOn, "vec4"),
    seaLevel: slot(u.uCloudSeaLevel, "float"),
    veil: slot(u.uCloudVeil, "float"),
  };
}

/** The field's noise for layer `i` at plan point `xz` (`cloudNoise`). */
export function cloudNoise(c: CloudSlots, i: N, xz: N): N {
  const B = c.B.element(i);
  const C = c.C.element(i);
  const p = vec3(
    dot(xz, B.xy).mul(B.z).add(C.x),
    xz.x.mul(B.y).sub(xz.y.mul(B.x)).mul(B.w).add(C.y),
    C.z,
  ).toVar();
  const ct = Math.cos(SECOND.turn);
  const st = Math.sin(SECOND.turn);
  const r = vec2(p.x.mul(ct).sub(p.y.mul(st)), p.x.mul(st).add(p.y.mul(ct)))
    .mul(SECOND.scale)
    .add(vec2(SECOND.off[0], SECOND.off[1]));
  const q = vec3(r, p.z.mul(SECOND.w).add(SECOND.off[2]));
  const read = (at: N): N => readNoise(c.atlas, c.sheet, at).r;
  return read(p)
    .mul(1 - SECOND.weight)
    .add(read(q).mul(SECOND.weight));
}

/** The column a noise stands up, its edge widened by `w` (`cloudColumnSoft`). */
export function cloudColumnSoft(c: CloudSlots, i: N, n: N, w: N): N {
  const A = c.A.element(i);
  const cv = smoothstep(A.z.sub(w.mul(0.5)), A.z.add(EDGE).add(w), n).toVar();
  const s = smoothstep(0, 0.25, cv);
  const dome = c.C.element(i).w;
  const bottom = float(0.5).sub(s.mul(0.5)).mul(float(1).sub(dome)).toVar();
  const top = s.mul(0.5).add(0.5).mul(float(1).sub(dome)).add(pow(cv, 0.55).mul(dome));
  return vec2(bottom, max(bottom, top));
}

/** The column with no widening (`cloudColumn`). */
export const cloudColumn = (c: CloudSlots, i: N, n: N): N => cloudColumnSoft(c, i, n, float(0));

/** The air between the eye and a cloud `dist` m off (`cloudAir`). */
export function cloudAir(c: CloudSlots, dist: N, a0: N, a1: N): N {
  const a = max(0, a0.add(a1).mul(0.5));
  const beta = vec3(5.8e-6, 13.6e-6, 33.1e-6)
    .mul(exp(a.negate().div(8000)))
    .add(exp(a.negate().div(1200)).mul(4.4e-6));
  return exp(beta.add(c.veil).negate().mul(dist));
}

/** Henyey and Greenstein's phase (`cloudHg`). */
export const hg = (mu: N, g: number): N =>
  float(1 - g * g).div(pow(float(1 + g * g).sub(mu.mul(2 * g)), 1.5));

/** The light at height `h` in layer `i`'s column (`cloudLit`). */
export function cloudLit(c: CloudSlots, i: N, h: N, col: N, L: N, mu: N, od: N): N {
  const Tb = max(exp(od.negate()), exp(od.mul(-0.2)).mul(0.3));
  const Ts = mix(Tb.y, Tb.x, smoothstep(-0.05, 0.05, L.y));
  const phase = hg(mu, 0.75).mul(0.12).add(0.75).add(hg(mu, -0.25).mul(0.25));
  const k = clamp(h.sub(col.x).div(max(col.y.sub(col.x), 1e-3)), 0, 1);
  const amb = mix(c.base.element(i), c.top.element(i), k).mul(k.mul(0.25).add(0.75));
  return c.sun.element(i).mul(Ts).mul(phase).add(amb);
}

/** The optical depth toward the sun inside a column (`cloudOdColumn`). */
export function cloudOdColumn(c: CloudSlots, i: N, h: N, col: N, L: N): N {
  const op = c.A.element(i).w.mul(0.12).div(max(L.y.abs(), 0.06));
  return op.mul(vec2(max(col.y.sub(h), 0), max(h.sub(col.x), 0)));
}

/** LOW's one read of layer `i` (`cloudLayerShell`): premultiplied colour,
 * and the share hidden. */
export function cloudLayerShell(c: CloudSlots, i: N, e: N, d: N, L: N, sky: N): N {
  const out = vec4(0).toVar();
  const A = c.A.element(i);
  const mid = A.x.add(A.y.mul(0.5));
  const dy = select(d.y.abs().lessThan(1e-6), float(1e-6), d.y);
  const t = mid.sub(e.y).div(dy).toVar();
  If(t.greaterThan(0).and(t.lessThanEqual(140000)), () => {
    const p = e.add(d.mul(t)).toVar();
    const B = c.B.element(i);
    const foot = t.mul(0.002).div(max(d.y.abs(), 0.03)).mul(max(B.z, B.w));
    const soft = min(foot.mul(6), 0.6).add(float(1).sub(c.C.element(i).w).mul(0.12));
    const col = cloudColumnSoft(c, i, cloudNoise(c, i, p.xz), soft).toVar();
    const F = col.y.sub(col.x).toVar();
    If(F.greaterThan(0), () => {
      const h = mix(col.x, col.y, float(0.7));
      const od = cloudOdColumn(c, i, h, col, L);
      const lit = cloudLit(c, i, h, col, L, dot(d, L), od);
      const a = float(1)
        .sub(exp(A.w.negate().mul(F).div(max(d.y.abs(), 0.03)).mul(0.5)))
        .mul(smoothstep(0, 0.3, F))
        .mul(smoothstep(140000, 60000, t))
        .toVar();
      const T = cloudAir(c, t, e.y.sub(c.seaLevel), p.y.sub(c.seaLevel));
      const seen = lit.mul(T).add(sky.mul(vec3(1).sub(T)));
      out.assign(vec4(seen.mul(a), a));
    });
  });
  return out;
}

/** The layers in order along the view, front to back (`cloudStack`),
 * each read by `layer` (the shell's, or the slab's). */
export function cloudStack(
  c: CloudSlots,
  e: N,
  d: N,
  L: N,
  sky: N,
  layer: (i: N) => N = (i) => cloudLayerShell(c, i, e, d, L, sky),
): N {
  const acc = vec4(0).toVar();
  const n = int(c.on.x.add(0.5)).toVar();
  Loop({ start: 0, end: CLOUD_LAYERS, type: "int", name: "k" }, ({ k }: { k: N }) => {
    If(k.greaterThanEqual(n), () => {
      Break();
    });
    const i = select(d.y.greaterThanEqual(0), k, n.sub(1).sub(k));
    const one = layer(i).toVar();
    const keep = float(1).sub(acc.a);
    acc.assign(vec4(acc.rgb.add(keep.mul(one.rgb)), acc.a.add(keep.mul(one.a))));
  });
  return acc.mul(c.on.y);
}

/** THE 22° HALO round `sun` in a veil of ice (`cloudHalo`). */
export function cloudHalo(d: N, sun: N, sunCol: N, strength: N): N {
  const th = degrees(acos(clamp(dot(d, sun), -1, 1)));
  const edge = vec3(21.75, 22.0, 22.3);
  const x = vec3(th).sub(edge).div(0.45);
  const ring = exp(x.mul(x).negate());
  const skirt = step(edge, vec3(th))
    .mul(exp(vec3(th).sub(edge).negate().div(3)))
    .mul(0.35);
  return select(
    strength.lessThanEqual(0),
    vec3(0),
    sunCol.mul(ring.add(skirt)).mul(strength).mul(0.16),
  );
}
