// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THIS BIT OF SNOW IS, ON THE NODE RENDERER (`docs/webgpu.md`, part 4):
// `snow-glsl.ts`'s sample chunk (with `snow-relief-glsl.ts`'s micro-relief),
// its colour and its roughness, restated in TSL for the ground's node twin
// (`terrain-tsl.ts`). The GLSL is the authority, term for term; every
// uniform is read by reference off the objects `terrain.ts` grafts into the
// GLSL, so one writer drives both back ends.
//
// `snowSample` runs inside the material's fragment stage, ahead of its
// colour (`GroundMaterial.setupDiffuseColor`): it declares the per-pixel
// state the GLSL keeps in globals (`snowN`, `snowPacked`, …) as variables of
// the shader and works them out, so the colour, the roughness, the normal
// and the light (`snow-light-tsl.ts`) all read the one sample.
//
// The snow's MARKS (part 5) are read in their own modules, each called where
// its chunk is spliced in the GLSL: the trail map's swaths, belts and
// furrows (`trail-tsl.ts`, `snow-trail-tsl.ts`), the tree wells, the
// avalanche (`slide-tsl.ts`) and the other skiers' lines on the piste
// (`piste-tracks-tsl.ts`).

import { ROCKS } from "@engine";
import type * as THREE from "three";
import * as TSL from "three/tsl";

import type { HazeUniforms } from "./haze.ts";
import type { GroundOwn } from "./terrain.ts";
import { slot, tap, type N } from "./haze-tsl.ts";
import { pisteTracks, trackFrameAt, trackSlots, type TrackFrameHere } from "./piste-tracks-tsl.ts";
import { CALM_HELD, ROCK_SNOW } from "./rock-shapes.ts";
import { slideAlbedo, slideNormal, slideSlots, type SlideHere } from "./slide-tsl.ts";
import { GLARE } from "./snow-glsl.ts";
import { snowHash1, snowNoise, snowNoiseGrad } from "./snow-noise-tsl.ts";
import {
  beltLugs,
  trailAlbedo,
  trailSample,
  wellAlbedo,
  wellSlope,
  type TrailHere,
} from "./snow-trail-tsl.ts";
import { CALM_FROM, CALM_TO } from "./strata-glsl.ts";
import { stBands, stCoord, stFar, stHazeKeep } from "./strata-tsl.ts";
import { FRESH_LOOK, LOOSE } from "./trail-stamp.ts";
import { trailSlots, wellReader } from "./trail-tsl.ts";

const {
  If,
  abs,
  atan,
  cameraPosition,
  clamp,
  cos,
  dot,
  float,
  fract,
  fwidth,
  inverseSqrt,
  length,
  mat2,
  max,
  min,
  mix,
  normalize,
  sign,
  sin,
  smoothstep,
  sqrt,
  step,
  texture,
  transpose,
  vec2,
  vec3,
} = TSL as N;

type U = Record<string, THREE.IUniform>;

/** What the ground's twin is built over: the uniforms `terrain.ts` grafts
 * into its GLSL (`shared`, the level's `own`, the trail's and the haze's),
 * whether it keeps the snow out of the rooms (`cut`) and whether it is a
 * summer's ground. */
export type GroundSpec = {
  haze: HazeUniforms;
  shared: U;
  own: U;
  trail: U;
  cut: boolean;
  summer: boolean;
};

/** A slot of a level's own (`GroundOwn`), read off the MATERIAL DRAWN —
 * the ground's own, which carries them as `userData.groundOwn` — before
 * every draw. The renderer builds a program's nodes once for every material
 * that reads the same (all the levels do, and the deformable snow's mesh)
 * and draws each with those: a slot naming its own object would hand every
 * level the first level's values, and one in the render group, whose
 * buffer is one for the whole render, the last one's. */
const ownSlot = (name: keyof GroundOwn, type: string): N =>
  (TSL as N).materialReference(`userData.groundOwn.${name}.value`, type) as N;

/** Every uniform the ground's nodes read, once a material. */
export function groundSlots(spec: GroundSpec) {
  const { haze: h, shared: s, trail: t } = spec;
  const opt = (u: U, name: string, type: string, fallback: unknown): N =>
    slot(u[name] ?? { value: fallback }, type);
  return {
    spec,
    ground: texture(s.uGround.value).setUpdateMatrix(false),
    trackDir: texture(s.uTrackDir.value).setUpdateMatrix(false),
    height: texture(s.uHeight.value).setUpdateMatrix(false),
    origin: slot(s.uHeightOrigin, "vec2"),
    count: slot(s.uHeightCount, "vec2"),
    cell: slot(s.uCell, "float"),
    levelCentre: ownSlot("uLevelCentre", "vec2"),
    spacing: ownSlot("uSpacing", "float"),
    hole: ownSlot("uHole", "vec4"),
    gridHalf: ownSlot("uGridHalf", "float"),
    deformMesh: ownSlot("uDeformMesh", "float"),
    focalPx: ownSlot("uFocalPx", "float"),
    reliefHalf: slot(s.uReliefHalf, "float"),
    baseSpacing: slot(s.uBaseSpacing, "float"),
    forestTint: slot(s.uForestTint, "vec3"),
    crustTone: slot(s.uCrustTone, "vec3"),
    iceTone: slot(s.uIceTone, "vec3"),
    rock: slot(s.uRock, "vec4"),
    rockSlope: slot(s.uRockSlope, "vec2"),
    rockStone: slot(s.uRockStone, "vec3"),
    stSeed: slot(s.uStSeed, "uint"),
    strata: slot(s.uStrata, "vec4"),
    sastrugi: slot(s.uSastrugi, "float"),
    windDir: slot(s.uWindDir, "vec2"),
    skip: slot(s.uSnowSkip, "vec4"),
    flat: slot(h.uFlat, "float"),
    fresh: slot(h.uFresh, "float"),
    piste: slot(h.uPiste, "vec2"),
    age: slot(h.uSnowAge, "vec4"),
    age2: slot(h.uSnowAge2, "vec4"),
    glitter: slot(h.uGlitter, "float"),
    sunDir: slot(h.uSunDir, "vec3"),
    sunPos: slot(h.uSunPos, "vec3"),
    skySh: slot(h.uSkySh, "vec3"),
    lampGlint: slot(h.uLampGlint, "float"),
    worked: opt(t, "uWorked", "float", 0),
    deformOn: opt(t, "uDeformOn", "float", 0),
    deformBox: slot(t.uDeformBox, "vec4"),
    /** The trail map's reads (`trail-tsl.ts`), the wells' and the slide's,
     * this material's own (`trailSlots` says why). */
    trail: trailSlots(t, false, true),
    well: wellReader(s, false, true),
    wellFrame: slot(s.uWellFrame, "vec4"),
    slide: slideSlots(h, false, true),
    tracks: trackSlots(h, s),
    /** ...and the vertex's own set of them. */
    vertex: {
      trail: trailSlots(t, true, true),
      well: wellReader(s, true, true),
      slide: slideSlots(h, true, true),
    },
  };
}
export type GroundSlots = ReturnType<typeof groundSlots>;

/** The per-pixel state `snow-glsl.ts` keeps in its globals. */
export type SnowState = {
  p: N;
  world: N;
  vNormal: N;
  dist: N;
  n: N;
  packed: N;
  press: N;
  wall: N;
  forest: N;
  berm: N;
  crust: N;
  ice: N;
  rock: N;
  foot: N;
  skin: N;
  skinCol: N;
  hazeKeep: N;
  groomed: N;
  self: N;
  belt: N;
  lug: N;
  worked: N;
  chop: N;
  combed: N;
  lane: N;
  cord: N;
  scuff: N;
  slideWall: N;
  newSnow: N;
  old: N;
  wind: N;
  sunCrust: N;
  hoar: N;
  wet: N;
  cup: N;
  scour: N;
  trackShade: N;
  albedo: N;
  /** What the trail map makes of the pixel (`snow-trail-tsl.ts`). */
  trail?: TrailHere;
  /** m: how deep a tree well lowers the snow here. */
  well?: N;
  /** What the avalanche makes of it (`slide-tsl.ts`). */
  slideHere?: SlideHere;
  /** A summer's ground's own roughness (`summer-tsl.ts`). */
  rough?: N;
};

/** The ground map's uv at plan point `p`. */
export function groundUv(s: GroundSlots, p: N): N {
  return p.sub(s.origin).add(s.cell.mul(0.5)).div(s.count.mul(s.cell));
}

/** The corduroy's way off the track map at `uv`: across and along it. */
function trackFrame(s: GroundSlots, uv: N): { acr: N; alg: N; tw: N } {
  const tw = tap(s.trackDir, uv).toVar();
  const dw = tw.xy.mul(2).sub(1);
  const tht = atan(dw.y, dw.x).mul(0.5).toVar();
  const acr = vec2(cos(tht), sin(tht).negate()).toVar();
  return { acr, alg: vec2(acr.y, acr.x.negate()), tw };
}

/** `SNOW_FRAGMENT_SAMPLE`: everything about this bit of snow (see the
 * header). `world` is the vertex's own world point, `vNormal` the mesh's
 * normal, both as varyings. */
export function snowSample(s: GroundSlots, world: N, vNormal: N): SnowState {
  const p = world.xz.toVar();
  const dist = length(world.sub(cameraPosition)).toVar();
  const guv = groundUv(s, p).toVar();
  const g = tap(s.ground, guv).toVar();
  const freshK = smoothstep(0, FRESH_LOOK, s.fresh).toVar();
  const packed = max(g.b, 0).mul(float(1).sub(freshK)).toVar();
  // A PISTE MACHINE'S SWATH and A SNOWMOBILE'S BELT (`trailPackAt`), each
  // packed through and only the snow fallen since on it.
  const groom = vec3(0).toVar();
  If(s.trail.worked.add(s.trail.belted).greaterThan(0), () => {
    groom.assign(s.trail.packAt(p));
  });
  const groomed = smoothstep(0, 0.45, groom.x).toVar();
  const belt = smoothstep(0, 0.45, groom.y).toVar();
  If(belt.greaterThan(0), () => {
    const since = float(1).sub(groom.y).mul(FRESH_LOOK);
    packed.assign(
      mix(
        packed,
        float(1)
          .sub(smoothstep(0, FRESH_LOOK, since))
          .mul(0.85),
        belt,
      ),
    );
  });
  If(groomed.greaterThan(0), () => {
    const since = float(1).sub(groom.x).mul(FRESH_LOOK);
    packed.assign(mix(packed, float(1).sub(smoothstep(0, FRESH_LOOK, since)), groomed));
  });
  const notSwath = float(1).sub(groomed).mul(float(1).sub(belt)).mul(packed).toVar();
  const cord = float(0).toVar();
  const trackShade = float(0).toVar();
  const lane = float(0).toVar();
  const worked = max(s.worked, s.piste.x).mul(notSwath).toVar();
  const untouched = float(1).sub(s.piste.x);
  const combed = s.piste.y.mul(untouched).mul(untouched).mul(notSwath).toVar();
  const chop = s.piste.x.mul(max(g.b, 0)).mul(freshK).mul(float(1).sub(groomed)).toVar();
  const forest = g.a.toVar();
  const grad = g.rg.toVar();
  const surf = tap(s.trackDir, guv).a.mul(255).sub(128).div(127).toVar();
  const crust = max(surf, 0).toVar();
  const ice = max(surf.negate(), 0).toVar();
  // The loose cover's step at the track's shoulders.
  {
    const du = vec2(float(0.5).div(s.count.x), 0);
    const dv = vec2(0, float(0.5).div(s.count.y));
    const at = (o: N): N => max(tap(s.ground, guv.add(o)).b, 0);
    const pg = vec2(at(du).sub(at(du.negate())), at(dv).sub(at(dv.negate()))).div(s.cell);
    grad.subAssign(pg.mul(LOOSE));
  }
  const inside = clamp(p, s.origin, s.origin.add(s.count.sub(1).mul(s.cell)));
  const past = length(p.sub(inside)).toVar();
  If(past.greaterThan(0), () => {
    const vn = normalize(vNormal).toVar();
    grad.assign(mix(grad, vn.xz.negate().div(max(vn.y, 0.2)), smoothstep(0, 30, past)));
  });
  const rock = s.rock.w
    .mul(smoothstep(s.rockSlope.x, s.rockSlope.y, length(grad)))
    .mul(float(1).sub(packed))
    .toVar();
  const skin = s.strata.w
    .mul(smoothstep(ROCKS.skin.from, 0.45, g.b.negate()))
    .mul(smoothstep(CALM_FROM, CALM_TO, dist))
    .toVar();
  rock.assign(max(rock, skin.mul(s.rock.w)));
  const skinCol = vec3(0).toVar();
  const slopeW = grad.sub(s.strata.xy);
  const foot = length(fwidth(p)).toVar();
  const fwW = sqrt(dot(slopeW, slopeW).add(1)).mul(foot).toVar();
  If(skin.greaterThan(0), () => {
    const ny = inverseSqrt(dot(grad, grad).add(1));
    const even = clamp(
      ny.add(CALM_HELD - ROCKS.skin.slides).div(ROCKS.skin.holds - ROCKS.skin.slides),
      0,
      1,
    );
    const b = stBands(s.stSeed, s.strata.z, stCoord(s.stSeed, s.strata, p, world.y), fwW);
    skinCol.assign(stFar(s.rockStone, vec3(...ROCK_SNOW), even, b, 1, dist).div(GLARE));
  });

  // THE SNOW'S AGE, here.
  const newSnow = float(0).toVar();
  const old = float(0).toVar();
  const wind = float(0).toVar();
  const sunCrust = float(0).toVar();
  const hoar = float(0).toVar();
  const wet = float(0).toVar();
  const cup = float(0).toVar();
  const scour = float(0).toVar();
  {
    const loose = float(1).sub(packed).mul(float(1).sub(ice)).mul(float(1).sub(rock)).toVar();
    const runNew = freshK;
    const aged = s.age.y.mul(float(1).sub(runNew)).mul(loose).toVar();
    const steep = length(g.rg).toVar();
    const face = dot(g.rg.negate().div(max(steep, 1e-4)), s.age2.zw)
      .mul(smoothstep(0.04, 0.3, steep))
      .toVar();
    const exposed = float(1).sub(forest);
    newSnow.assign(max(s.age.x, runNew).mul(loose));
    old.assign(aged);
    wind.assign(s.age.z.mul(aged).mul(exposed));
    sunCrust.assign(
      s.age.w
        .mul(aged)
        .mul(clamp(face.mul(0.9).add(0.35), 0, 1))
        .mul(float(1).sub(forest.mul(0.5))),
    );
    hoar.assign(
      s.age2.x
        .mul(float(1).sub(runNew))
        .mul(loose)
        .mul(clamp(float(0.85).sub(face.mul(0.8)), 0.25, 1))
        .mul(float(1).sub(s.age.z.mul(0.6).mul(exposed))),
    );
    wet.assign(
      s.age2.y
        .mul(float(1).sub(runNew))
        .mul(loose)
        .mul(clamp(face.mul(0.6).add(0.55), 0, 1)),
    );
  }
  // THE FURROWS, per pixel (`SNOW_TRAIL_SAMPLE`).
  const trail = trailSample(s.trail, s.spec.trail, {
    p,
    y: world.y,
    dist,
    grad,
    sunDir: s.sunDir,
    skipW: s.skip.w,
    rock,
  });
  const { press, wall, self, scuff } = trail;
  // THE PADDLES' PRINT across a belt's floor.
  const lug = beltLugs(p, groom.z, belt, dist, grad);
  // THE TREE WELLS: the hollow's own slope.
  const well = s.well(p).toVar();
  wellSlope(s.well, s.wellFrame.w, p, dist, grad);
  // THE AVALANCHE: its bed, its walls and its debris.
  const slideHere = slideNormal(s.slide, p, grad, dist, foot);
  const slideWall = slideHere.wall;
  const berm = float(0).toVar();
  // The piste's own frame for the other skiers' lines, read in uniform flow.
  const frameHere = trackFrameAt(s.tracks, p);
  If(s.skip.y.lessThan(0.5), () => {
    relief(s, {
      p,
      guv,
      grad,
      dist,
      packed,
      worked,
      chop,
      crust,
      press,
      newSnow,
      old,
      wind,
      scour,
      sunCrust,
      wet,
      cup,
      groomed,
      combed,
      belt,
      berm,
      cord,
      lane,
      axis: groom.z,
      trackShade,
      frameHere,
    });
  });
  // Ice is flat: the swells and the grain are the snow's, not the ice's.
  grad.assign(mix(grad, g.rg, ice.mul(0.85)));
  const n = normalize(vec3(grad.x.negate(), 1, grad.y.negate())).toVar();
  const state: SnowState = {
    p,
    world,
    vNormal,
    dist,
    n,
    packed,
    press,
    wall,
    forest,
    berm,
    crust,
    ice,
    rock,
    foot,
    skin,
    skinCol,
    hazeKeep: float(1).toVar(),
    groomed,
    self,
    belt,
    lug,
    worked,
    chop,
    combed,
    lane,
    cord,
    scuff,
    slideWall,
    newSnow,
    old,
    wind,
    sunCrust,
    hoar,
    wet,
    cup,
    scour,
    trackShade,
    albedo: vec3(0).toVar(),
    trail,
    well,
    slideHere,
  };
  return state;
}

type Relief = Record<
  | "p"
  | "guv"
  | "grad"
  | "dist"
  | "packed"
  | "worked"
  | "chop"
  | "crust"
  | "press"
  | "newSnow"
  | "old"
  | "wind"
  | "scour"
  | "sunCrust"
  | "wet"
  | "cup"
  | "groomed"
  | "combed"
  | "belt"
  | "berm"
  | "cord"
  | "lane"
  | "axis"
  | "trackShade",
  N
> & { frameHere: TrackFrameHere };

/** `SNOW_RELIEF_SAMPLE`: the micro-relief bent into `grad`. */
function relief(s: GroundSlots, r: Relief): void {
  const { p, grad, dist, packed, worked, chop, press } = r;
  const one = (x: N): N => float(1).sub(x);
  const nearFade = one(smoothstep(20, 90, dist)).toVar();
  const midFade = one(smoothstep(60, 400, dist)).toVar();
  If(midFade.greaterThan(0).and(packed.lessThan(1)), () => {
    grad.addAssign(
      snowNoiseGrad(p.mul(0.23), float(0.35))
        .mul(0.23 * 0.35)
        .mul(midFade)
        .mul(one(packed)),
    );
  });
  // THE DAY'S PISTE.
  If(worked.greaterThan(0.01).and(midFade.greaterThan(0)), () => {
    const { acr, alg } = trackFrame(s, r.guv);
    const k = worked.mul(midFade).toVar();
    grad.addAssign(
      snowNoiseGrad(p.mul(0.55).add(3.1), float(0.3))
        .mul(0.55 * 0.16)
        .mul(k),
    );
    grad.addAssign(
      snowNoiseGrad(p.mul(1.4).add(8.3), float(0.25))
        .mul(1.4 * 0.05)
        .mul(k)
        .mul(nearFade),
    );
    const sg = snowNoiseGrad(vec2(dot(p, acr).mul(5), dot(p, alg).mul(0.22)), float(0.3));
    grad.addAssign(
      acr
        .mul(sg.x.mul(5))
        .add(alg.mul(sg.y.mul(0.22)))
        .mul(0.006)
        .mul(k)
        .mul(nearFade),
    );
    const bg = snowNoiseGrad(vec2(dot(p, acr).mul(0.2), dot(p, alg).mul(0.32)).add(17), float(0.3));
    grad.addAssign(
      acr
        .mul(bg.x.mul(0.2))
        .add(alg.mul(bg.y.mul(0.32)))
        .mul(0.55)
        .mul(k)
        .mul(k),
    );
    const tg2 = snowNoiseGrad(vec2(dot(p, acr).mul(2.4), dot(p, alg).mul(0.06)), float(0.2));
    grad.addAssign(
      acr
        .mul(tg2.x.mul(2.4))
        .add(alg.mul(tg2.y.mul(0.06)))
        .mul(0.02)
        .mul(k)
        .mul(nearFade),
    );
  });
  // THE SKIED-IN NEW SNOW.
  If(chop.greaterThan(0.01).and(midFade.greaterThan(0)), () => {
    const k = chop.mul(midFade).toVar();
    grad.addAssign(
      snowNoiseGrad(p.mul(0.38).add(13.7), float(0.3))
        .mul(0.38 * 0.32)
        .mul(k),
    );
    grad.addAssign(
      snowNoiseGrad(p.mul(1.1).add(2.9), float(0.25))
        .mul(1.1 * 0.07)
        .mul(k)
        .mul(nearFade),
    );
  });
  // SASTRUGI.
  If(s.sastrugi.greaterThan(0).and(r.crust.greaterThan(0.01)), () => {
    const sFade = one(smoothstep(40, 260, dist));
    const across = vec2(s.windDir.y.negate(), s.windDir.x).toVar();
    const warp = snowNoise(p.mul(0.08)).mul(6);
    const ph = dot(p, across).mul(1.9).add(warp);
    const breakUp = smoothstep(0.3, 0.7, snowNoise(p.mul(0.35).add(7)));
    const k = s.sastrugi.mul(r.crust).mul(sFade).mul(breakUp).mul(one(press));
    grad.addAssign(
      across
        .mul(cos(ph))
        .mul(1.9 * 0.07)
        .mul(k),
    );
  });
  If(nearFade.greaterThan(0), () => {
    const grain = one(r.newSnow.mul(0.6))
      .mul(r.old.mul(0.7).add(1))
      .mul(one(r.wind.mul(0.5)));
    grad.addAssign(
      snowNoiseGrad(p.mul(1.7), float(0.3))
        .mul(1.7 * 0.035)
        .mul(nearFade)
        .mul(one(r.newSnow.mul(0.4))),
    );
    grad.addAssign(
      snowNoiseGrad(p.mul(7), float(0.3))
        .mul(7 * 0.007)
        .mul(nearFade)
        .mul(one(press))
        .mul(grain),
    );
  });
  // THE WIND'S SLAB. The ripples' footprint is taken out here, in uniform
  // flow, as the GLSL's `fwidth(ph)` is the same value.
  const windPh = dot(p, s.windDir)
    .mul(6.2831853 / 0.32)
    .add(
      snowNoise(p.mul(0.5).add(3))
        .mul(4)
        .add(snowNoise(p.mul(1.3)).mul(1.2))
        .mul(6.2831853),
    )
    .toVar();
  const windAa = one(smoothstep(0.25, 0.7, fwidth(windPh).div(6.2831853))).toVar();
  If(r.wind.greaterThan(0.01).and(midFade.greaterThan(0)), () => {
    r.scour.assign(smoothstep(0.45, 0.75, snowNoise(p.mul(0.11).add(51))).mul(r.wind));
    If(nearFade.greaterThan(0), () => {
      const breakUp = smoothstep(0.25, 0.6, snowNoise(p.mul(0.7).add(9)));
      const k = r.wind
        .mul(windAa)
        .mul(breakUp)
        .mul(one(press))
        .mul(one(r.scour.mul(0.6)));
      grad.addAssign(s.windDir.mul(sin(windPh)).mul(0.32).mul(k));
    });
    grad.addAssign(
      snowNoiseGrad(p.mul(0.16).add(5), float(0.4))
        .mul(0.16 * 0.45)
        .mul(r.wind)
        .mul(midFade),
    );
  });
  // THE SUN CRUST.
  If(r.sunCrust.greaterThan(0.01).and(nearFade.greaterThan(0)), () => {
    grad.addAssign(
      snowNoiseGrad(p.mul(3.4).add(61), float(0.12))
        .mul(3.4 * 0.012)
        .mul(r.sunCrust)
        .mul(nearFade),
    );
  });
  // SUN CUPS. The crate's footprint is taken in uniform flow, as above.
  const cw = vec2(snowNoise(p.mul(0.45).add(3)), snowNoise(p.mul(0.45).add(8)))
    .mul(5)
    .toVar();
  const r1 = mat2(0.8, 0.6, -0.6, 0.8);
  const r2 = mat2(0.28, -0.96, 0.96, 0.28);
  const c2 = r2.mul(p).mul(14).sub(cw.yx).toVar();
  const cupAa = one(smoothstep(0.6, 1.6, length(fwidth(c2)))).toVar();
  If(r.wet.greaterThan(0.01).and(dist.lessThan(120)), () => {
    const c1 = r1.mul(p).mul(10.5).add(cw).toVar();
    const k = r.wet
      .mul(cupAa)
      .mul(one(smoothstep(60, 120, dist)))
      .mul(one(press))
      .toVar();
    grad.addAssign(
      transpose(r1)
        .mul(vec2(sin(c1.x), sin(c1.y)).negate())
        .mul(10.5 * 0.009)
        .mul(k),
    );
    grad.addAssign(
      transpose(r2)
        .mul(vec2(sin(c2.x), sin(c2.y)).negate())
        .mul(14 * 0.005)
        .mul(k),
    );
    r.cup.assign(
      clamp(cos(c1.x).add(cos(c1.y)).add(cos(c2.x)).add(cos(c2.y)).mul(0.15).add(0.5), 0, 1).mul(k),
    );
  });

  // THE CORDUROY. The phase's and the lanes' footprints are taken in
  // uniform flow, off the same way the comb runs.
  const td = tap(s.trackDir, r.guv).toVar();
  r.berm.assign(td.b.mul(one(r.groomed)));
  const along = max(length(td.xy.mul(2).sub(1)), r.groomed).toVar();
  const dd = td.xy.mul(2).sub(1);
  // In a swath the comb runs the way the machine went.
  const th = mix(atan(dd.y, dd.x).mul(0.5), r.axis.mul(3.14159265), step(0.5, r.groomed)).toVar();
  const across = vec2(cos(th), sin(th).negate()).toVar();
  const phase = dot(p, across)
    .mul(6.2831853 / 0.14)
    .toVar();
  const phaseAa = one(smoothstep(0.35, 0.9, fwidth(phase))).toVar();
  const lanePos = dot(p, across).div(5.2).toVar();
  const laneAa = one(smoothstep(0.3, 0.8, fwidth(lanePos).mul(12))).toVar();
  If(packed.greaterThan(0.05).and(along.greaterThan(0.05)).and(worked.lessThan(0.98)), () => {
    const k = packed
      .mul(min(along.mul(2), 1))
      .mul(phaseAa)
      .mul(one(press.mul(0.7)))
      .mul(one(r.belt))
      .toVar();
    k.mulAssign(one(smoothstep(0, 0.25, r.berm)));
    const worn = smoothstep(0.3, 0.7, snowNoise(p.mul(0.42).add(11)));
    const chip = snowNoise(p.mul(2.6).add(5));
    k.mulAssign(mix(mix(0.3, 1, worn).mul(mix(0.55, 1, chip)), 1.25, max(r.groomed, r.combed)));
    k.mulAssign(one(worked));
    k.mulAssign(r.combed.mul(0.6).add(1));
    // THE OTHER SKIERS' LINES (`piste-tracks.ts`), cutting the comb away.
    k.mulAssign(
      one(
        pisteTracks(
          s.tracks,
          r.frameHere,
          p,
          across,
          packed
            .mul(min(along.mul(2), 1))
            .mul(one(r.belt))
            .mul(one(r.groomed)),
          grad,
          dist,
          r.trackShade,
        ),
      ),
    );
    grad.addAssign(across.mul(cos(phase)).mul(0.14).mul(k));
    r.cord.assign(sin(phase).mul(min(k, 1)));
    const kl = packed
      .mul(min(along.mul(2), 1))
      .mul(one(worked))
      .mul(one(press.mul(0.7)))
      .mul(one(r.belt))
      .toVar();
    kl.mulAssign(one(smoothstep(0, 0.25, r.berm)));
    kl.mulAssign(mix(0.35, 1, max(r.combed, r.groomed)).mul(midFade));
    If(kl.greaterThan(0.01), () => {
      const seam = one(smoothstep(0, 0.035, abs(fract(lanePos).sub(0.5)))).toVar();
      grad.addAssign(
        across
          .mul(sign(fract(lanePos).sub(0.5)))
          .mul(seam)
          .mul(0.08)
          .mul(kl)
          .mul(laneAa),
      );
      r.lane.assign(
        snowHash1(vec2(lanePos.floor(), 7)).mul(2).sub(1).mul(0.6).sub(seam.mul(laneAa)).mul(kl),
      );
    });
  });
  // THE PLOUGH'S CLODS on the berm.
  If(r.berm.greaterThan(0.01).and(dist.lessThan(140)), () => {
    const clodFade = one(smoothstep(30, 140, dist));
    const b = smoothstep(0, 0.3, r.berm).toVar();
    grad.addAssign(
      snowNoiseGrad(p.mul(2.2), float(0.15))
        .mul(2.2 * 0.09)
        .mul(b)
        .mul(clodFade),
    );
    grad.addAssign(
      snowNoiseGrad(p.mul(6.5), float(0.1))
        .mul(6.5 * 0.025)
        .mul(b)
        .mul(clodFade),
    );
  });
}

/** `SNOW_FRAGMENT_COLOUR`: the albedo, into `st.albedo` (GLARE in), and the
 * air kept over the skin's stone into `st.hazeKeep`. */
export function snowColour(s: GroundSlots, st: SnowState): N {
  const { p, packed, dist } = st;
  const one = (x: N): N => float(1).sub(x);
  const fresh = vec3(0.95, 0.975, 1.0);
  const shade = vec3(0.84, 0.9, 0.98);
  const drift = snowNoise(p.mul(0.018))
    .mul(0.6)
    .add(snowNoise(p.mul(0.07)).mul(0.4));
  const alb = mix(fresh, shade, drift.mul(0.32)).toVar();
  const tint = (c: N, k: N): N => mix(vec3(1), c, k);
  alb.assign(mix(alb, vec3(0.975, 0.99, 1.0), st.newSnow.mul(0.75)));
  alb.mulAssign(tint(vec3(0.85, 0.855, 0.84), st.old));
  alb.mulAssign(tint(vec3(0.8, 0.86, 0.94), st.scour.mul(0.9)));
  alb.mulAssign(tint(vec3(0.93, 0.945, 0.965), st.sunCrust));
  alb.mulAssign(tint(vec3(0.72, 0.74, 0.74).mul(one(st.cup.mul(0.12))), st.wet));
  alb.assign(mix(alb, vec3(0.97, 0.985, 1.0), st.hoar.mul(0.35)));
  alb.assign(mix(alb, vec3(0.7, 0.75, 0.82), packed.mul(0.9)));
  alb.assign(mix(alb, vec3(0.86, 0.9, 0.95), max(st.groomed.mul(0.65), st.combed.mul(0.5))));
  alb.mulAssign(st.cord.mul(0.07).add(st.lane.mul(0.07)).add(st.trackShade.mul(0.3)).add(1));
  alb.assign(mix(alb, vec3(0.8, 0.85, 0.92), st.belt.mul(0.35)));
  alb.mulAssign(one(st.lug.mul(0.08)));
  // The day's piste; its streaks' footprint taken in uniform flow.
  const pxP = length(fwidth(p)).toVar();
  If(st.worked.greaterThan(0.01), () => {
    const scrape = smoothstep(0.45, 0.75, snowNoise(p.mul(0.5).add(21)));
    const heap = smoothstep(0.55, 0.85, snowNoise(p.mul(1.1).add(4)));
    alb.assign(mix(alb, vec3(0.62, 0.68, 0.78), scrape.mul(0.45).mul(st.worked)));
    alb.assign(mix(alb, vec3(0.93, 0.96, 1.0), heap.mul(0.5).mul(st.worked)));
    const { acr, alg } = trackFrame(s, groundUv(s, p));
    const streak = snowNoise(vec2(dot(p, acr).mul(2.4), dot(p, alg).mul(0.06)));
    const aaS = one(smoothstep(0.3, 0.8, pxP.mul(2.4)));
    alb.mulAssign(one(smoothstep(0.4, 0.8, streak).mul(0.1).mul(st.worked).mul(aaS)));
  });
  If(st.chop.greaterThan(0.01), () => {
    const trough = one(smoothstep(0.3, 0.6, snowNoise(p.mul(0.38).add(13.7))));
    alb.assign(mix(alb, vec3(0.74, 0.79, 0.86), trough.mul(0.4).mul(st.chop)));
  });
  // THE GRAIN THAT STREAMS PAST.
  {
    const px = pxP;
    const m = (k: number, o: number): N =>
      snowNoise(p.mul(k).add(o))
        .sub(0.5)
        .mul(one(smoothstep(0.3, 0.7, px.mul(k))));
    const patchy = mix(0.22, 0.32, packed)
      .mul(one(st.newSnow.mul(0.55)))
      .mul(st.old.mul(0.5).add(1).add(st.wet.mul(0.5)));
    alb.mulAssign(
      m(0.85, 0)
        .mul(0.45)
        .add(m(2.9, 3.7).mul(0.4))
        .add(m(8.5, 9.1).mul(0.3))
        .mul(patchy)
        .mul(one(st.ice))
        .add(1),
    );
  }
  // A TREE WELL, and the avalanche's own snow.
  wellAlbedo(alb, st.well ?? float(0), p, pxP);
  if (st.slideHere) slideAlbedo(s.slide, st.slideHere, alb, p, st.world.y, st.foot);
  If(st.berm.greaterThan(0), () => {
    const clod = snowNoise(p.mul(2.2));
    alb.assign(mix(alb, fresh.mul(mix(1, 0.88, clod)), smoothstep(0, 0.35, st.berm)));
  });
  // Pressed, walled and dug snow.
  if (st.trail) trailAlbedo(alb, st.trail, { packed, fresh, sunDir: s.sunDir });
  // A wood seen from afar.
  const farW = st.forest.mul(smoothstep(160, 520, dist)).toVar();
  const fc = p.div(5.5).toVar();
  const fpx = length(fwidth(fc)).toVar();
  If(farW.greaterThan(0), () => {
    const fi = fc.floor().toVar();
    const fh = snowHash1(fi).toVar();
    const ff = fract(fc)
      .sub(0.5)
      .sub(
        vec2(fh, snowHash1(fi.add(7.3)))
          .sub(0.5)
          .mul(0.4),
      );
    const core = step(fh, st.forest.mul(1.15))
      .mul(smoothstep(0.42, 0.12, length(ff)))
      .toVar();
    core.assign(mix(core, min(1, st.forest.mul(1.15)).mul(0.3), smoothstep(0.35, 0.9, fpx)));
    alb.assign(
      mix(alb, mix(s.forestTint, s.forestTint.mul(0.5), core), farW.mul(mix(0.5, 0.72, core))),
    );
  });
  // THE REGION'S OWN SNOW.
  alb.assign(mix(alb, alb.mul(s.crustTone), st.crust.mul(one(packed.mul(0.5)))));
  If(st.ice.greaterThan(0), () => {
    alb.assign(
      mix(
        alb,
        s.iceTone.mul(mix(0.9, 1.05, snowNoise(p.mul(0.05)))),
        st.ice.mul(one(st.press.mul(0.6))),
      ),
    );
  });
  If(st.rock.greaterThan(0), () => {
    const grain = mix(0.5, snowNoise(p.mul(0.6)), one(smoothstep(0.5, 1.4, st.foot.mul(0.6))));
    const rockAlb = mix(s.rock.rgb.mul(mix(0.7, 1.2, grain)), st.skinCol, st.skin);
    alb.assign(mix(alb, rockAlb, st.rock));
    st.hazeKeep.assign(mix(1, stHazeKeep(dist), st.skin));
  });
  st.albedo.assign(alb.mul(GLARE));
  return st.albedo;
}

/** `SNOW_FRAGMENT_ROUGHNESS`. */
export function snowRoughness(st: SnowState): N {
  const r = mix(mix(0.85, 0.55, st.packed), 0.92, st.berm)
    .sub(st.press.mul(0.1))
    .sub(st.scuff.mul(0.22))
    .toVar();
  r.assign(mix(r, 0.72, st.groomed));
  r.subAssign(st.worked.mul(0.15));
  r.assign(mix(r, 0.94, st.newSnow.mul(0.7)));
  r.assign(mix(r, 0.62, st.wind.mul(st.scour.mul(0.5).add(0.3))));
  r.assign(mix(r, 0.34, st.sunCrust.mul(0.85)));
  r.assign(mix(r, 0.3, st.wet.mul(0.8)));
  r.assign(mix(r, 0.62, st.crust.mul(0.6)));
  r.assign(mix(r, 0.18, st.ice));
  r.assign(mix(r, 0.95, st.rock));
  return r;
}
