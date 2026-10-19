// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW'S OWN LIGHT ON THE NODE RENDERER (`docs/webgpu.md`, part 4): the
// lighting model the ground's node twin (`terrain-tsl.ts`) lights itself
// with — three's physical model, with what `snow-glsl.ts`'s light chunk
// does after three's lights restated in TSL, term for term and in its order:
//
//   1. the sun the deformable snow hides (`snowSelf`; part 5's — 1 here);
//   2. THE SKY by direction in place of the hemisphere (`skyIrradiance` off
//      the harmonics, `snow-sky-glsl.ts`), the bumps' shadows on the key
//      (`snowBumpLit`) and the light through a thin edge;
//   3. the flat light's last relief;
//   4. THE LAMPS, with their glints (`snow-lamps-glsl.ts`);
//   5. THE SUN's own terms: the wrap, the glitter and the glare
//      (`snow-sun-glsl.ts`);
//   6. the low sun's shade lifted in the mountain's shadow (`SHADE_LIFT`).
//
// The key the chunk reads (`directLight.color` as three's loop leaves it:
// shadowed, at the point's height, through the clouds) is what the key's
// light node hands the model (`lights-tsl.ts`' `KeyLightNode`), caught as it
// goes by (`direct`). A summer's ground is lit as everything else is, the
// lamps by their own node, with the flat light's relief alone over it.

import * as TSL from "three/tsl";
import { PhysicalLightingModel, type NodeBuilder } from "three/webgpu";

import { LAMP_SLOTS } from "./haze.ts";
import { tap, type N } from "./haze-tsl.ts";
import { lightSlots, terrainLit } from "./lights-tsl.ts";
import { DEFORM } from "./deform-field.ts";
import type { GroundSlots, SnowState } from "./snow-sample-tsl.ts";
import { snowGlints, snowHash3, snowNoise } from "./snow-noise-tsl.ts";
import { SUN_GLARE } from "./snow-sun-glsl.ts";
import { TRAIL } from "./trail-stamp.ts";

const {
  BRDF_Lambert,
  Break,
  Continue,
  If,
  Loop,
  abs,
  cameraPosition,
  clamp,
  diffuseColor,
  dot,
  float,
  fract,
  fwidth,
  length,
  max,
  min,
  mix,
  normalize,
  pow,
  reflect,
  smoothstep,
  vec3,
} = TSL as N;

/** `skyIrradiance(n)`: the sky's light on a surface facing `n`, off the
 * nine harmonics (`SKY_LIGHT_GLSL`). */
export function skyIrradiance(sh: N, n: N): N {
  const c = (i: number): N => sh.element(i);
  const e = c(0)
    .mul(0.282095)
    .add(c(1).mul(n.x.mul(0.488603)))
    .add(c(2).mul(n.y.mul(0.488603)))
    .add(c(3).mul(n.z.mul(0.488603)))
    .add(c(4).mul(n.x.mul(n.z).mul(1.092548)))
    .add(c(5).mul(n.x.mul(n.y).mul(1.092548)))
    .add(c(6).mul(n.y.mul(n.z).mul(1.092548)))
    .add(c(7).mul(n.y.mul(n.y).mul(3).sub(1).mul(0.315392)))
    .add(c(8).mul(n.x.mul(n.x).sub(n.z.mul(n.z)).mul(0.546274)));
  return max(e, vec3(0));
}

/** `snowBumpHeight`: the micro-relief as a height (part 5: the trail's
 * relief is nought). */
function bumpHeight(q: N, swell: N, chop: N, grain: N): N {
  return swell
    .mul(0.35)
    .mul(snowNoise(q.mul(0.23)))
    .add(chop.mul(0.32).mul(snowNoise(q.mul(0.38).add(13.7))))
    .add(grain.mul(0.035).mul(snowNoise(q.mul(1.7))));
}

/** `snowBumpLit`: the bumps' shadows, marched toward the key. */
function bumpLit(s: GroundSlots, p: N, L: N, macro: N, swell: N, chop: N, grain: N): N {
  const lit = float(1).toVar();
  const run = length(L.xz).toVar();
  If(run.greaterThanEqual(1e-3), () => {
    const u = L.xz.div(run).toVar();
    const rise = L.y.div(run).sub(dot(macro, u)).toVar();
    If(rise.greaterThan(0).and(rise.lessThanEqual(1.6)), () => {
      const h0 = bumpHeight(p, swell, chop, grain).toVar();
      const win = abs(p.sub(s.deformBox.xy));
      const nearField = s.deformOn
        .greaterThan(0.5)
        .and(max(win.x, win.y).lessThan(s.deformBox.z.add(11.5)));
      const trailTop = nearField.select(
        float(Math.max(TRAIL.maxBerm, DEFORM.tallest)),
        float(TRAIL.maxBerm),
      );
      const top = trailTop.add(swell.mul(0.35)).add(chop.mul(0.32)).add(grain.mul(0.035)).toVar();
      const d = float(0.15).toVar();
      Loop(8, () => {
        If(
          rise
            .greaterThan(0.012)
            .and(h0.add(d.mul(rise)).sub(top).greaterThanEqual(d.mul(0.012).add(0.012))),
          () => {
            Break();
          },
        );
        const above = h0.add(d.mul(rise)).sub(bumpHeight(p.add(u.mul(d)), swell, chop, grain));
        const soft = d.mul(0.012).add(0.012);
        lit.assign(min(lit, smoothstep(soft.negate(), soft, above)));
        d.mulAssign(1.85);
      });
    });
  });
  return lit;
}

/** The snow's lighting model (see the header). */
export class SnowLightingModel extends PhysicalLightingModel {
  readonly s: GroundSlots;
  readonly st: SnowState;
  readonly summer: boolean;
  keyLit: N = null;

  constructor(s: GroundSlots, st: SnowState, summer: boolean) {
    super();
    this.s = s;
    this.st = st;
    this.summer = summer;
  }

  start(builder: NodeBuilder): void {
    this.keyLit = vec3(0).toVar("snowKeyLit");
    super.start(builder);
    const r = (builder.context as N).reflectedLight;
    if (this.summer) flatFacing(this.s, this.st, r);
    else snowLight(this.s, this.st, r, this.keyLit);
  }

  direct(data: N, builder: NodeBuilder): void {
    // The key as three's loop leaves it: the one directional light.
    if (data.lightNode?.light?.isDirectionalLight) this.keyLit.assign(data.lightColor);
    super.direct(data, builder);
  }

  indirect(builder: NodeBuilder): void {
    if (this.summer) {
      super.indirect(builder);
      return;
    }
    // THE SKY, by direction: replaces three's hemisphere outright.
    this.indirectSpecular(builder);
    const r = (builder.context as N).reflectedLight;
    r.indirectDiffuse.assign(
      skyIrradiance(this.s.skySh, this.st.n).mul(BRDF_Lambert({ diffuseColor: diffuseColor.rgb })),
    );
    this.ambientOcclusion(builder);
  }
}

/** The flat light's lid brighter over where the sun is. */
function flatFacing(s: GroundSlots, st: SnowState, r: N): void {
  const lidDir = normalize(vec3(s.sunPos.x, 2.2, s.sunPos.z)).toVar();
  const facing = clamp(dot(st.n, lidDir).div(lidDir.y), 0, 1.3);
  r.indirectDiffuse.mulAssign(mix(1, facing.mul(0.45).add(0.55), s.flat));
}

/** `SNOW_FRAGMENT_LIGHT` after three's lights, on `r` (see the header). */
function snowLight(s: GroundSlots, st: SnowState, r: N, key: N): void {
  const one = (x: N): N => float(1).sub(x);
  const lambert = (): N => BRDF_Lambert({ diffuseColor: diffuseColor.rgb });
  const world = st.world;
  const V = normalize(cameraPosition.sub(world)).toVar();
  // The crystals' footprint, in uniform flow (`snowGlints`).
  const fwWorld = length(fwidth(world)).toVar();
  // 1. The sun the deformable snow hides (part 5: `snowSelf` is 1).
  r.directDiffuse.mulAssign(st.self);
  r.directSpecular.mulAssign(st.self);
  // 2. The bumps' shadows on the key, and the light through a thin edge.
  const keyLit = key.toVar();
  const fade = one(smoothstep(70, 130, st.dist)).toVar();
  If(
    fade.greaterThan(0).and(dot(keyLit, keyLit).greaterThan(1e-8)).and(s.skip.x.lessThan(0.5)),
    () => {
      const macro = tap(
        s.ground,
        st.p.sub(s.origin).add(s.cell.mul(0.5)).div(s.count.mul(s.cell)),
      ).rg;
      const swell = one(st.packed).mul(one(smoothstep(60, 400, st.dist)));
      const grain = one(st.newSnow.mul(0.4)).mul(one(smoothstep(20, 90, st.dist)));
      const bump = mix(1, bumpLit(s, st.p, s.sunDir, macro, swell, st.chop, grain), fade).toVar();
      r.directDiffuse.mulAssign(bump);
      r.directSpecular.mulAssign(bump);
      key.mulAssign(bump);
    },
  );
  const thin = max(max(st.wall.mul(one(st.packed.mul(0.6))), st.berm), st.slideWall)
    .mul(one(st.ice))
    .mul(one(st.rock))
    .mul(one(smoothstep(30, 80, st.dist)))
    .toVar();
  If(thin.greaterThan(0), () => {
    const back = pow(max(dot(V.negate(), s.sunDir), 0), 3);
    const away = one(smoothstep(-0.25, 0.35, dot(st.n, s.sunDir)));
    r.directDiffuse.addAssign(
      lambert()
        .mul(keyLit)
        .mul(vec3(0.5, 0.78, 1.0))
        .mul(thin.mul(0.55).mul(back).mul(away)),
    );
  });
  // 3. The flat light's last relief (part 5: and down in a trench).
  flatFacing(s, st, r);
  {
    const rel = max(dot(st.n, normalize(st.vNormal)), 0);
    const rel2 = rel.mul(rel).toVar();
    const rel4 = rel2.mul(rel2);
    const rel8 = rel4.mul(rel4);
    r.indirectDiffuse.mulAssign(
      mix(1, rel8.mul(rel2).mul(0.32).add(0.68), s.flat.mul(one(smoothstep(40, 160, st.dist)))),
    );
  }
  // 4. The lamps.
  lamps(s, st, r, V, fwWorld);
  // 5. The sun's own terms.
  sun(s, st, r, key, V, fwWorld);
  // 6. The shade lifted where the mountain keeps the key off.
  const ls = lightSlots(s.spec.haze);
  If(ls.shadeLift.greaterThan(0), () => {
    r.indirectDiffuse.mulAssign(ls.shadeLift.mul(one(terrainLit(ls, world))).add(1));
  });
}

/** `SNOW_LAMPS_LIGHT`: every slot's beam and the piste lights' bake, with
 * the crystals glinting toward each. */
function lamps(s: GroundSlots, st: SnowState, r: N, V: N, fwWorld: N): void {
  const ls = lightSlots(s.spec.haze);
  const one = (x: N): N => float(1).sub(x);
  const world = st.world;
  const loose = one(st.packed.mul(0.8))
    .mul(one(st.press.mul(0.6)))
    .mul(one(st.ice))
    .mul(one(st.rock))
    .toVar();
  const lampLit = vec3(0).toVar();
  const lampGlint = vec3(0).toVar();
  const lgQ = world.mul(7).toVar();
  const lgRad = max(0.14, fwWorld.mul(7 * 0.75)).toVar();
  const lgK = float(0.14).div(lgRad).toVar();
  const lgFacet = vec3(0).toVar();
  const lgSpot = float(0).toVar();
  const at = (n: N, i: N): N => n.element(i);
  If(
    at(ls.lampOn, 0).greaterThan(0).and(s.lampGlint.greaterThan(0)).and(st.dist.lessThan(40)),
    () => {
      const lgCell = lgQ.floor().toVar();
      const lgR = snowHash3(lgCell.add(57)).toVar();
      If(lgR.z.lessThanEqual(0.6), () => {
        lgFacet.assign(
          normalize(
            st.n.add(
              snowHash3(lgCell.add(57 + 7.13))
                .mul(2)
                .sub(1)
                .mul(0.6),
            ),
          ),
        );
        const f = fract(lgQ).sub(lgR.mul(0.6).add(0.2));
        lgSpot.assign(one(smoothstep(lgRad.mul(0.45), lgRad, length(f))));
      });
    },
  );
  Loop(LAMP_SLOTS, ({ i }: { i: N }) => {
    const on = at(ls.lampOn, i);
    If(on.lessThanEqual(0), () => {
      Break();
    });
    If(on.lessThanEqual(0.001), () => {
      Continue();
    });
    const way = at(ls.lampPos, i).sub(world).toVar();
    const d = length(way).toVar();
    const L = way.div(max(d, 1e-3)).toVar();
    const axis = dot(L.negate(), at(ls.lampDir, i));
    const b = at(ls.lampBeam, i);
    const beam = smoothstep(b.x, b.y, axis).add(b.w.mul(smoothstep(b.z, b.x, axis)));
    const e = on
      .mul(beam)
      .mul(smoothstep(0.2, 0.9, d))
      .div(d.mul(d).mul(0.012).add(1))
      .toVar();
    If(e.greaterThan(0), () => {
      lampLit.addAssign(at(ls.lampCol, i).mul(e.mul(max(dot(st.n, L), 0))));
      If(lgSpot.greaterThan(0), () => {
        const H = normalize(L.add(V));
        const g = pow(max(dot(lgFacet, H), 0), 600);
        lampGlint.addAssign(at(ls.lampCol, i).mul(e.mul(g.mul(lgSpot).mul(lgK).mul(lgK))));
      });
    });
  });
  // THE PISTE LIGHTS, baked.
  If(ls.pisteOn.x.greaterThan(0), () => {
    const uv = world.xz.sub(ls.pisteBox.xy).mul(ls.pisteBox.zw).toVar();
    const inside = uv.x
      .greaterThanEqual(0)
      .and(uv.y.greaterThanEqual(0))
      .and(uv.x.lessThanEqual(1))
      .and(uv.y.lessThanEqual(1));
    const pv = inside
      .select(tap(ls.piste, uv).xyz.mul(ls.pisteOn.x.mul(ls.pisteOn.y)), vec3(0))
      .toVar();
    const pe = length(pv).toVar();
    If(pe.greaterThan(1e-4), () => {
      lampLit.addAssign(ls.pisteCol.mul(max(dot(st.n, pv), 0)));
      If(st.dist.lessThan(40).and(s.lampGlint.greaterThan(0)), () => {
        const H = normalize(pv.div(pe).add(V));
        lampGlint.addAssign(
          ls.pisteCol.mul(
            pe.mul(snowGlints(world, 7, float(600), float(0.6), st.n, H, 83, fwWorld)),
          ),
        );
      });
    });
  });
  r.directDiffuse.addAssign(BRDF_Lambert({ diffuseColor: diffuseColor.rgb }).mul(lampLit).mul(9));
  r.directSpecular.addAssign(
    lampGlint
      .mul(loose)
      .mul(one(smoothstep(12, 40, st.dist)))
      .mul(12),
  );
}

/** `SNOW_SUN_LIGHT`: the wrap, the glitter and the glare. */
function sun(s: GroundSlots, st: SnowState, r: N, key: N, V: N, fwWorld: N): void {
  const one = (x: N): N => float(1).sub(x);
  const world = st.world;
  const n = st.n;
  const sunLit = key.mul(st.self).toVar();
  const ndl = dot(n, s.sunDir).toVar();
  const wrap = max(0, ndl.add(0.45).div(1.45))
    .sub(max(ndl, 0))
    .mul(one(s.flat.mul(0.7)));
  r.directDiffuse.addAssign(
    BRDF_Lambert({ diffuseColor: diffuseColor.rgb })
      .mul(sunLit)
      .mul(wrap)
      .mul(vec3(0.55, 0.78, 1.0))
      .mul(0.9),
  );
  // THE GLITTER, two sizes of crystal cell.
  If(st.dist.lessThan(140).and(s.glitter.greaterThan(0)).and(s.skip.z.lessThan(0.5)), () => {
    const H = normalize(s.sunDir.add(V)).toVar();
    const loose = one(st.packed.mul(0.8))
      .mul(one(st.press.mul(0.6)))
      .mul(one(st.ice))
      .mul(one(st.rock));
    const keepFine = st.newSnow
      .mul(0.45)
      .add(st.hoar.mul(0.5))
      .add(1)
      .mul(one(st.old.mul(0.55)))
      .mul(0.6);
    const oh = max(st.old, st.hoar);
    const keepCoarse = mix(0.35, 0.6, oh);
    const near = mix(8, 1.5, oh).toVar();
    const glaze = one(st.sunCrust.mul(0.6)).mul(one(st.wet.mul(0.85)));
    const glint = float(0).toVar();
    If(st.dist.lessThan(45), () => {
      glint.addAssign(
        snowGlints(world, 7, mix(600, 320, st.newSnow), keepFine, n, H, 0, fwWorld)
          .mul(one(smoothstep(15, 45, st.dist)))
          .mul(st.newSnow.mul(0.3).add(1).add(st.hoar.mul(1.5))),
      );
    });
    If(st.dist.greaterThan(near), () => {
      glint.addAssign(
        snowGlints(
          world,
          2.5,
          mix(900, 140, st.hoar),
          mix(keepCoarse, 0.9, st.hoar),
          n,
          H,
          31,
          fwWorld,
        )
          .mul(smoothstep(near, near.add(17), st.dist))
          .mul(one(smoothstep(50, st.hoar.mul(60).add(140), st.dist)))
          .mul(st.old.mul(0.6).add(1).add(st.hoar.mul(4))),
      );
    });
    const sunMax = max(max(sunLit.r, sunLit.g), max(sunLit.b, 1e-4)).toVar();
    const sunTint = sunLit.div(sunMax).toVar();
    const warmth = clamp(one(sunTint.b.div(max(sunTint.r, 1e-4))), 0, 1).toVar();
    const flare = sunMax.mul(glint).mul(loose).mul(glaze).mul(18).mul(s.glitter).toVar();
    flare.assign(mix(flare, flare.div(flare.div(2.5).add(1)), warmth));
    r.directSpecular.addAssign(pow(sunTint, vec3(warmth.mul(1.5).add(1))).mul(flare));
  });
  // THE GLARE.
  If(s.skip.z.lessThan(0.5), () => {
    const rv = max(dot(reflect(s.sunDir.negate(), n), V), 0);
    const gloss = clamp(
      st.packed
        .mul(0.3)
        .add(st.sunCrust.mul(0.85))
        .add(st.wet.mul(0.55))
        .add(st.scour.mul(0.3))
        .add(st.ice.mul(0.9)),
      0,
      1,
    )
      .mul(one(st.rock))
      .toVar();
    const k = mix(6, 140, gloss.mul(gloss));
    const graze0 = one(max(dot(n, V), 0));
    const graze = graze0.mul(graze0);
    const lobe = pow(rv, k).mul(gloss.mul(gloss).mul(2.5).add(0.25)).mul(graze.mul(1.6).add(0.15));
    r.directSpecular.addAssign(
      sunLit
        .mul(lobe)
        .mul(SUN_GLARE)
        .mul(one(st.newSnow.mul(0.8).mul(one(gloss)))),
    );
  });
}
