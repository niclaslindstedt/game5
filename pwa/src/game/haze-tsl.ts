// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HAZE ON THE NODE RENDERER: `haze.ts`'s air restated as TSL for the
// webgpu paths (`docs/webgpu.md`, part 2), off the SAME shared uniforms —
// every node below reads its slot of `HazeUniforms` by reference
// (`hazeSlots`), so `writeHaze` and every other writer drive both back ends
// with no second copy of any number. The GLSL is the authority: each
// function here is its namesake there, term for term (`skyColour`,
// `hazeColour`, `farDistance`, `farColour`, `hazeAir`, `hazeMist`, the sea's
// `seaTop`), and a change to one is a change to both.
//
// THE HAZE IS THE SCENE'S FOG NODE (`hazeFog`): three's node materials mix
// it into their colour at the end of every lit or unlit material that keeps
// `fog` on — `gpu-dress.ts` turns it off on every material `hazeMaterial`
// did not dress, as WebGL hazes only those.
//
// WHERE THE MIX HAPPENS. The GLSL replaces `fog_fragment`, which three runs
// AFTER tone mapping and the output conversion: straight onto the canvas
// the haze's colour is tone-mapped and encoded first and mixed in DISPLAY
// space, which is what lets the far rim meet the dome with no seam. The
// node renderer runs its fog BEFORE either, in linear light, and tone maps
// the whole frame in a pass after. Mixed there, the haze would read
// heavier in the mid-tones and lighter in the highlights than WebGL's. So
// `display` (a uniform, on while WebGL's frame would go straight onto the
// canvas — `render-seam.ts`'s picture asks `drawsStraight` every frame)
// mixes as WebGL does there: the material's colour and the air's are
// carried to display space by the same transform the output pass applies
// (`toDisplay`), mixed there, and carried back (`fromDisplay`), so the
// output pass lands on WebGL's pixel. Off (where WebGL draws through the
// grade's target — a graded region, an ANTIALIAS stop the canvas was not
// made with, the buzz — and hazes in linear light, before the grade's
// pass), it mixes in linear light, as WebGL then does. Where the inverse
// cannot be exact — a channel ACES clips, a hue outside what its matrices
// return — the pixel is the clipped one either way; a pixel with no haze at
// all keeps its colour untouched.
//
// STAND-INS for what is not ported yet (each a hook its part replaces):
// the aerial-perspective volume (`aerialShade`, part 3) is 1 — the haze as
// LOW draws it, which is what the webgpu paths' sky is until then (the
// GPU sky's passes are skipped, so `uSkyView` is the LOW grid); and a
// material's own share of its colour through the haze (`HAZE_KEEP`: the
// snow, the rock) is not read — both are hidden until their parts.

import * as THREE from "three";
import {
  Fn,
  If,
  acos,
  asin,
  cameraPosition,
  clamp,
  dot,
  exp,
  float,
  fract,
  length,
  max,
  min,
  mix,
  normalize,
  output,
  positionWorld,
  pow,
  reference,
  renderGroup,
  sRGBTransferEOTF,
  sRGBTransferOETF,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { TextureNode } from "three/webgpu";

import { FAR_RADIUS } from "./horizon.ts";
import { MIST_OPEN, type HazeUniforms } from "./haze.ts";

/** A node of the graph, whatever its type. TSL's own types track each
 * node's width (a float, a vec3…) and its swizzles through every call; the
 * node builder checks the same thing when the graph compiles, and says
 * which node, so the functions here take and return any node rather than
 * restating every width in a type. */
export type N = any;

/** A slot of the shared uniforms read by reference once a render, so the
 * value the writers set this frame is the value drawn — however they set
 * it (a number replaced, a vector set in place, an array of them). */
export function slot(o: { value: unknown }, type: string): N {
  const node: N = (reference("value", type, o) as N).setGroup(renderGroup);
  node.updateType = "render";
  return node;
}

/** A 1×1 texture to stand where a slot holds none (null) yet: the node
 * renderer binds a texture whether a branch reads it or not. Half floats,
 * as every map the slots carry. */
export function standIn(rgba: [number, number, number, number] = [0, 0, 0, 0]): THREE.DataTexture {
  const h = rgba.map((c) => THREE.DataUtils.toHalfFloat(c));
  const tex = new THREE.DataTexture(
    new Uint16Array(h),
    1,
    1,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** What the haze's nodes read: every slot once, and the texture nodes the
 * frame re-points (`syncHaze`) when a writer swaps a map. */
export type HazeSlots = ReturnType<typeof makeSlots>;

function makeSlots(u: HazeUniforms) {
  const sky = texture(u.uSkyView.value);
  return {
    u,
    sky,
    sunDir: slot(u.uSunDir, "vec3"),
    sunPos: slot(u.uSunPos, "vec3"),
    skySize: slot(u.uSkyViewSize, "vec2"),
    tint: slot(u.uHazeTint, "vec3"),
    hazeShadow: slot(u.uHazeShadow, "vec4"),
    far: slot(u.uFar, "vec2"),
    farGround: slot(u.uFarGround, "color"),
    farKey: slot(u.uFarKey, "color"),
    haze: slot(u.uHaze, "float"),
    mist: slot(u.uMist, "float"),
    mistAloft: slot(u.uMistAloft, "float"),
    mistOpen: slot(u.uMistOpen, "float"),
    lift: slot(u.uHazeLift, "float"),
    floor: slot(u.uHazeFloor, "float"),
    airLift: slot(u.uAirLift, "float"),
    sea: slot(u.uSea, "vec4"),
    seaSun: slot(u.uSeaSun, "vec3"),
    seaK: slot(u.uSeaK, "float"),
    seaBase: slot(u.uSeaBase, "float"),
  };
}

const slotsOf = new WeakMap<HazeUniforms, HazeSlots>();
/** The slots of `u`, made once and shared by every node built over it. */
export function hazeSlots(u: HazeUniforms): HazeSlots {
  let s = slotsOf.get(u);
  if (!s) slotsOf.set(u, (s = makeSlots(u)));
  return s;
}

/** Re-point the texture nodes at what the slots hold this frame. */
export function syncHaze(s: HazeSlots): void {
  if (s.sky.value !== s.u.uSkyView.value) s.sky.value = s.u.uSkyView.value;
}

/** THE PHYSICAL SKY along `dir` (`SKY_GLSL`'s `skyColour`). */
export function skyColour(s: HazeSlots, dir: N): N {
  const d: N = normalize(dir);
  const up = clamp(
    asin(clamp(d.y, -1, 1))
      .add(s.far.x)
      .div(float(Math.PI / 2).add(s.far.x)),
    0,
    1,
  );
  const hl = length(d.xz);
  const sl = length(s.sunPos.xz);
  const ca = select(
    hl.greaterThan(1e-4).and(sl.greaterThan(1e-4)),
    dot(d.xz, s.sunPos.xz).div(hl.mul(sl).max(1e-8)),
    float(1),
  );
  const u = sqrt(acos(clamp(ca, -1, 1)).div(Math.PI));
  const v = sqrt(up);
  const uv = vec2(u, v).mul(s.skySize.sub(1)).add(0.5).div(s.skySize);
  return (s.sky as unknown as TextureNode).sample(uv).rgb;
}

/** The sky just over the true horizon on `dir`'s bearing. */
function horizonDir(s: HazeSlots, dir: N): N {
  return normalize(vec3(dir.x, clamp(dir.y, float(-0.02).sub(s.far.x), 0.06), dir.z));
}

/** THE COLOUR A FAR SURFACE FADES INTO along `dir` (`hazeColour`). */
export function hazeColour(s: HazeSlots, dir: N): N {
  return mix(skyColour(s, horizonDir(s, dir)), s.hazeShadow.xyz, s.hazeShadow.w);
}

/** How far the ray along `dir` runs to the far ground, m (`farDistance`). */
export function farDistance(s: HazeSlots, dir: N): N {
  const sd = normalize(dir).y.negate();
  const q = sd.mul(sd).sub(s.far.y.mul(2 / FAR_RADIUS));
  return select(
    sd.lessThanEqual(0).or(q.lessThan(0)),
    float(1e9),
    s.far.y.mul(2).div(sd.add(sqrt(q.max(0))).max(1e-9)),
  );
}

/** WHAT LIES UNDER THE HORIZON as the mist's wall shows it (`farColour`). */
export function farColour(s: HazeSlots, dir: N, shadow: number): N {
  const d = horizonDir(s, dir);
  const air = mix(skyColour(s, d), s.hazeShadow.xyz, s.hazeShadow.w.mul(shadow));
  const thin = mix(s.floor, 1, exp(s.far.y.mul(-0.5).div(s.lift)));
  const seen = exp(farDistance(s, dir).negate().mul(s.haze).mul(thin));
  const face = normalize(vec3(d.x.negate(), 0.75, d.z.negate()));
  const lit = max(dot(face, s.sunDir), 0).mul(0.7).add(max(s.sunDir.y, 0).mul(0.3));
  const ground = s.farGround.add(s.farKey.mul(lit));
  return mix(air, ground, seen);
}

/** The air between the lens and a point `dist` m off, `rise` m over it (`hazeAir`). */
export function hazeAir(s: HazeSlots, dist: N, rise: N): N {
  const thin = exp(max(rise, 0).negate().div(s.lift));
  return float(1).sub(
    exp(
      dist
        .negate()
        .mul(s.haze)
        .mul(mix(s.floor, 1, thin)),
    ),
  );
}

/** The DISTANCE row's mist (`hazeMist`). */
export function hazeMist(s: HazeSlots, dist: N, rise: N): N {
  const across = mix(dist, sqrt(max(dist.mul(dist).sub(rise.mul(rise)), 0)), s.mistAloft);
  const m = across.div(s.mist.max(1e-6));
  let mist = max(float(1).sub(exp(m.mul(m).mul(-3))), smoothstep(0.7, 1, m));
  mist = mix(mist, smoothstep(0.2, 0.82, m), s.mistAloft);
  const open = mix(mist, min(mist, MIST_OPEN), s.mistOpen);
  return select(s.mist.lessThanEqual(0), float(0), open);
}

// THE SEA OF CLOUD'S TOP as lumps (`seaHash`, `seaNoise`, `seaHeight`,
// `seaPuffs`, `seaTop`).
const seaHash = (c: N): N => fract(sin(dot(c, vec2(127.1, 311.7))).mul(43758.5453));
function seaNoise(p: N): N {
  const i = p.floor();
  const f0 = p.sub(i);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(
    mix(seaHash(i), seaHash(i.add(vec2(1, 0))), f.x),
    mix(seaHash(i.add(vec2(0, 1))), seaHash(i.add(1)), f.x),
    f.y,
  );
}
function seaHeight(p: N, far: N): N {
  const big = seaNoise(p.div(2300).add(5));
  const k = exp(far.negate().div(30000));
  const roll = seaNoise(p.div(760).add(11))
    .mul(0.6)
    .add(seaNoise(p.div(330).add(3)).mul(0.4));
  return mix(big, big.mul(0.5).add(roll.mul(0.5)), k);
}
const seaPuffs = (p: N, far: N): N =>
  mix(float(0.5), seaNoise(p.div(120).add(17)), exp(far.negate().div(9000)));

/** The sea's top lit at plan point `p`, `far` m off (`seaTop`). */
export function seaTop(s: HazeSlots, p: N, far: N): N {
  const e = far.mul(0.01).add(60);
  const n = seaHeight(p, far);
  const nx = seaHeight(p.add(vec2(e, 0)), far).sub(n);
  const nz = seaHeight(p.add(vec2(0, e)), far).sub(n);
  const relief = float(90).div(e);
  const nrm = normalize(vec3(nx.mul(relief).negate(), 1, nz.mul(relief).negate()));
  const L = normalize(vec3(s.sunDir.x, max(s.sunDir.y, 0), s.sunDir.z));
  const graze = float(1).sub(smoothstep(0.04, 0.4, L.y));
  const face = clamp(dot(nrm, L).div(max(L.y, 0.06)), 0, 2.2);
  const lit = mix(float(1), face.mul(mix(0.45, 1.55, n.mul(n).mul(n.mul(-2).add(3)))), graze);
  const sky = max(s.sea.xyz.sub(s.seaSun), vec3(0));
  const puff = seaPuffs(p, far);
  const shaded = sky
    .mul(mix(0.8, 1.12, n))
    .add(s.seaSun.mul(lit))
    .mul(mix(0.93, 1.07, puff));
  return mix(s.sea.xyz, shaded, mix(0.55, 1, exp(far.negate().div(25000))));
}

// THE OUTPUT TRANSFORM the node renderer's last pass applies straight onto
// the canvas — three's ACES filmic fit (its `RRTAndODTFit` between its two
// matrices, after the exposure over 0.6) and the sRGB curve — and its
// inverse. The matrices are three's, row by row as its GLSL multiplies them.
export const ACES_IN = new THREE.Matrix3().set(
  0.59719,
  0.35458,
  0.04823,
  0.076,
  0.90834,
  0.01566,
  0.0284,
  0.13383,
  0.83777,
);
export const ACES_OUT = new THREE.Matrix3().set(
  1.60475,
  -0.53108,
  -0.07367,
  -0.10208,
  1.10813,
  -0.00605,
  -0.00327,
  -0.07276,
  1.07602,
);

/** `m` times `v`, row by row. */
function times(m: THREE.Matrix3, v: N): N {
  const e = m.elements; // column-major
  return vec3(
    dot(vec3(e[0], e[3], e[6]), v),
    dot(vec3(e[1], e[4], e[7]), v),
    dot(vec3(e[2], e[5], e[8]), v),
  );
}

/** The fit's own constants: `(v (v + A) − B) / (v (C v + D) + E)`. Three's
 * NODE fit multiplies its `0.432951` by C too (`v (v + 0.432951) C + E`),
 * where its GLSL one does not — so the node renderer's canvas is a hair
 * darker than WebGL's in the mid-tones (`docs/webgpu.md`, part 7's to
 * square), and the transform here is the node pass's, which is the one it
 * has to undo. */
export const FIT = {
  a: 0.0245786,
  b: 0.000090537,
  c: 0.983729,
  d: 0.983729 * 0.432951,
  e: 0.238081,
};

/** Linear light to the canvas's pixel, as the output pass makes it. */
export function toDisplay(c: N, exposure: N): N {
  const v = times(ACES_IN, c.mul(exposure).div(0.6));
  const fit = v
    .mul(v.add(FIT.a))
    .sub(FIT.b)
    .div(v.mul(v.mul(FIT.c).add(FIT.d)).add(FIT.e));
  return sRGBTransferOETF(clamp(times(ACES_OUT, fit), 0, 1));
}

/** The canvas's pixel back to the linear light the output pass maps to
 * it: the sRGB curve undone, the out matrix inverted, the fit solved as
 * the quadratic it is — `(1 − C y) v² + (A − D y) v − (B + E y) = 0` — and
 * the in matrix and the exposure undone. */
export function fromDisplay(d: N, exposure: N): N {
  const y = clamp(times(ACES_OUT.clone().invert(), sRGBTransferEOTF(d)), 0, 1);
  const qa = float(1).sub(y.mul(FIT.c));
  const qb = float(FIT.a).sub(y.mul(FIT.d));
  const qc = float(FIT.b).add(y.mul(FIT.e)).negate();
  const v = qb
    .negate()
    .add(sqrt(qb.mul(qb).sub(qa.mul(qc).mul(4))))
    .div(qa.mul(2));
  return times(ACES_IN.clone().invert(), v).mul(0.6).div(exposure);
}

/** The haze's options: whether it mixes in display space (see the header)
 * and the exposure the output pass runs at. */
export type HazeFogOptions = { display: N; exposure: N };

/**
 * THE HAZE AS THE SCENE'S FOG NODE (`HAZE_FRAGMENT`): what three mixes the
 * material's colour (`output`) into. The air's own light on the bearing and
 * how much of it stands in front, per channel; the twilight's lift on it;
 * the mist's wall; the low deck or the valley fog seen from outside it.
 */
export function hazeFog(u: HazeUniforms, how: HazeFogOptions): N {
  const s = hazeSlots(u);
  return Fn(() => {
    const ray = positionWorld.sub(cameraPosition).toVar();
    const dist = length(ray).toVar();
    const dir = ray.div(max(dist, 1e-3)).toVar();
    // `aerialShade` is 1 until the GPU sky's volume is ported (part 3).
    const air = float(1)
      .sub(pow(vec3(float(1).sub(hazeAir(s, dist, ray.y))), s.tint))
      .toVar();
    const a2 = air.mul(air);
    const col = hazeColour(s, dir).mul(pow(vec3(s.airLift), float(1).sub(a2.mul(a2))));
    const far = farColour(s, dir, 1);
    const mist = hazeMist(s, dist, ray.y).toVar();
    const over = max(air, vec3(mist.mul(s.mistOpen)));
    const shut = mist.mul(float(1).sub(s.mistOpen));
    const base = output.rgb;
    const shown = how.display.greaterThan(0.5);
    const into = (c: N): N => select(shown, toDisplay(c, how.exposure), c);
    const mixed = mix(mix(into(base), into(col), over), into(far), shut).toVar();
    const touched = max(max(over.x, over.y), max(over.z, shut)).toVar();
    If(s.seaK.greaterThan(0), () => {
      const lo = min(cameraPosition.y, positionWorld.y);
      const hi = max(cameraPosition.y, positionWorld.y);
      const span = hi.sub(lo);
      const under = clamp(min(hi, s.sea.w).sub(max(lo, s.seaBase)).add(1).div(span.add(1)), 0, 1);
      const sea = s.sea.xyz.toVar();
      If(cameraPosition.y.greaterThan(s.sea.w).and(positionWorld.y.lessThan(s.sea.w)), () => {
        const p = cameraPosition.xz.add(
          ray.xz.mul(s.sea.w.sub(cameraPosition.y)).div(min(ray.y, -1e-3)),
        );
        sea.assign(seaTop(s, p, length(p.sub(cameraPosition.xz))));
      });
      const k = float(1).sub(exp(s.seaK.negate().mul(dist).mul(under)));
      mixed.assign(mix(mixed, into(sea), k));
      touched.assign(max(touched, k));
    });
    const back = select(shown, fromDisplay(mixed, how.exposure), mixed);
    // A pixel the air does not reach keeps its own colour to the bit.
    return vec4(select(touched.greaterThan(1 / 1024), back, base), output.a);
  })();
}
