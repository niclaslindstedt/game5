// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE OTHER SKIERS' TRACKS ON THE PISTE, ON THE NODE RENDERER
// (`docs/webgpu.md`, part 5): `piste-tracks.ts`'s `PISTE_TRACKS_GLSL` — the
// carvers', skidders' and boards' lines down the piste's own frame, cutting
// the comb away and shading the snow — restated in TSL for the ground's node
// twin (`snow-sample-tsl.ts`'s corduroy). The GLSL is the authority, term for
// term, with every number off `PISTE_TRACKS` as it prints them.
//
// The piste's frame is read, and its footprints across the lines (`pu`) and
// on the ground (`px`) taken, by the caller in uniform control flow
// (`trackFrameAt`): the GLSL takes them in a branch, where a derivative is
// undefined.

import type * as THREE from "three";
import * as TSL from "three/tsl";

import { slot, tap, type N } from "./haze-tsl.ts";
import { PISTE_TRACKS } from "./piste-tracks.ts";
import { snowHash1, snowNoise } from "./snow-noise-tsl.ts";

const {
  Fn,
  If,
  abs,
  clamp,
  cos,
  exp,
  float,
  fract,
  fwidth,
  inverseSqrt,
  length,
  max,
  min,
  mix,
  select,
  sign,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec4,
} = TSL as N;

const T = PISTE_TRACKS;
const f4 = (n: number): number => Number(n.toFixed(4));
const f1 = (name: string) => ({ name, type: "float" });

/** The piste's frame at `p` and the footprints the lines are judged by. */
export type TrackFrameHere = { fr: N; pu: N; px: N };

/** The uniforms the tracks read: the traffic (`uTracks`, the haze's) and
 * the piste's frame (`uTrackFrame`, `uTrackFrameBox`, the ground's). */
export function trackSlots(
  haze: { uTracks: THREE.IUniform },
  shared: Record<string, THREE.IUniform>,
) {
  return {
    tracks: slot(haze.uTracks, "vec2"),
    frame: texture(shared.uTrackFrame.value as THREE.Texture).setUpdateMatrix(false),
    box: slot(shared.uTrackFrameBox, "vec4"),
  };
}
export type TrackSlots = ReturnType<typeof trackSlots>;

/** The frame at `p`, read in uniform flow (see the header). */
export function trackFrameAt(t: TrackSlots, p: N): TrackFrameHere {
  const fr = tap(t.frame, p.sub(t.box.xy).mul(t.box.zw)).level(0).toVar();
  return { fr, pu: fwidth(fr.x).toVar(), px: length(fwidth(p)).toVar() };
}

/** One skier's line in column `n` of layer `i` (width `w`, salt `salt`):
 * its slope across and down the frame (xy), its cut into the comb (z) and
 * its shade (w) — nought where the column has none or it is out of reach. */
function lineIn(tracks: N): N {
  return Fn(([u, v, pu, n, fi, w, salt]: N[]) => {
    const out = vec4(0).toVar();
    const churn = tracks.y;
    const h0 = snowHash1(vec2(n, salt)).toVar();
    // Fewer lines early: a column has one once the traffic reaches it.
    If(h0.lessThanEqual(tracks.x), () => {
      const h1 = snowHash1(vec2(n.add(0.5), salt.add(3.1))).toVar();
      const h2 = fract(h1.mul(7.13).add(h0.mul(3.7))).toVar();
      const h3 = fract(h1.mul(13.7).add(h0.mul(11.3))).toVar();
      const x0 = n.sub(fi.mul(0.37)).add(0.25).add(h1.mul(0.5)).mul(w);
      const amp = w.mul(mix(0.1, 0.45, h2)).toVar();
      const lam = mix(12, 34, h3).toVar();
      const a = v.mul(6.2831853).div(lam).add(h0.mul(40)).add(h2.mul(17)).toVar();
      const s = sin(a).toVar();
      const slope = amp.mul(6.2831853).div(lam).mul(cos(a)).toVar();
      const inv = inverseSqrt(slope.mul(slope).add(1)).toVar();
      const d = u.sub(x0).sub(amp.mul(s)).mul(inv).toVar();
      const kind = fract(h3.mul(5.3).add(h1.mul(2.9)));
      const carve = step(kind, 0.6).toVar();
      const board = step(0.85, kind).toVar();
      const apart = carve.mul(f4(T.stance)).toVar();
      const wid = mix(
        mix(abs(s).mul(0.8).add(0.6).mul(f4(T.width.skid)), f4(T.width.board), board),
        f4(T.width.carve),
        carve,
      )
        .mul(mix(1, f4(T.width.churned), churn))
        .toVar();
      const sprayW = churn.mul(0.2).add(0.07).toVar();
      const reach = apart.add(max(wid.mul(4.5), carve.mul(sprayW.mul(4.5).add(0.14))));
      If(abs(d).lessThanEqual(reach), () => {
        // Older lines are skied over in stretches.
        const keep = smoothstep(
          -0.45,
          0.15,
          sin(v.mul(0.035).mul(h2.add(0.7)).add(h0.mul(31)))
            .add(h1.mul(0.7))
            .sub(0.2),
        ).toVar();
        const k = keep.mul(float(1).sub(smoothstep(0.6, 1.6, pu.div(wid))));
        const line = keep.mul(min(1, wid.mul(1.2).div(max(pu, 1e-4)))).toVar();
        If(line.greaterThan(0.01), () => {
          const depth = mix(
            mix(f4(T.depth.skid), f4(T.depth.board), board),
            f4(T.depth.carve),
            carve,
          )
            .mul(mix(1, f4(T.depth.churned), churn))
            .mul(abs(s).mul(0.25).add(0.75));
          const d1 = d.sub(apart).toVar();
          const d2 = d.add(apart).toVar();
          const iw = float(1).div(wid.mul(wid)).toVar();
          const g1 = exp(d1.mul(d1).mul(iw).negate()).toVar();
          const g2 = carve.mul(exp(d2.mul(d2).mul(iw).negate())).toVar();
          const dh = depth
            .mul(2)
            .mul(iw)
            .mul(d1.mul(g1).add(d2.mul(g2)));
          const gr = vec2(1, slope.negate()).mul(dh.mul(k).mul(inv));
          const cut = line.mul(
            float(1).sub(smoothstep(apart.add(wid.mul(0.8)), apart.add(wid.mul(2.2)), abs(d))),
          );
          // The snow a carve throws out on the outside of its turn.
          const o = d.mul(sign(s)).sub(apart).sub(0.14).div(sprayW).toVar();
          const spray = carve
            .mul(exp(o.mul(o).negate()))
            .mul(s)
            .mul(s);
          const shade = line.mul(
            spray.mul(0.7).sub(
              g1
                .add(g2)
                .mul(mix(0.35, 0.8, carve.add(board)))
                .mul(float(1).sub(churn.mul(0.4))),
            ),
          );
          out.assign(vec4(gr, cut, shade));
        });
      });
    });
    return out;
  }).setLayout({
    name: "pisteLine",
    type: "vec4",
    inputs: [f1("u"), f1("v"), f1("pu"), f1("n"), f1("fi"), f1("w"), f1("salt")],
  });
}

const lines = new WeakMap<object, N>();

/** `pisteTracks`: the lines' grooves laid into `grad` (by `weight`), the
 * share of the comb they cut away (the return) and their shade into
 * `shadeOut` (`snowTrackShade`). */
export function pisteTracks(
  t: TrackSlots,
  here: TrackFrameHere,
  p: N,
  acr: N,
  weight0: N,
  grad: N,
  dist: N,
  shadeOut: N,
): N {
  let line = lines.get(t);
  if (!line) lines.set(t, (line = lineIn(t.tracks)));
  const cutOut = float(0).toVar();
  shadeOut.assign(0);
  const { fr, pu, px } = here;
  const weight = weight0.mul(smoothstep(0.6, 0.95, fr.w)).toVar();
  If(
    weight0
      .greaterThanEqual(0.01)
      .and(t.tracks.x.greaterThan(0))
      .and(dist.lessThanEqual(f4(T.far)))
      .and(weight.greaterThanEqual(0.01)),
    () => {
      const acrV = acr.toVar();
      const alg = vec2(acrV.y.negate(), acrV.x);
      const u = fr.x;
      const v = fr.y.add(fr.z).toVar();
      const churn = t.tracks.y;
      const near = float(1)
        .sub(smoothstep(f4(T.near[0]), f4(T.near[1]), dist))
        .toVar();
      const cut = float(0).toVar();
      const shade = float(0).toVar();
      const gr = vec2(0).toVar();
      If(near.greaterThan(0), () => {
        for (let i = 0; i < 3; i++) {
          const w = f4(T.columns[i]);
          const salt = 7.31 * i + 2;
          const cu = u
            .div(w)
            .add(0.37 * i)
            .toVar();
          const c0 = cu.floor().toVar();
          const c1 = c0.add(select(fract(cu).greaterThan(0.5), float(1), float(-1)));
          for (const n of [c0, c1]) {
            const r = line(u, v, pu, n, float(i), float(w), float(salt)).toVar();
            gr.addAssign(r.xy);
            cut.assign(max(cut, r.z));
            shade.addAssign(r.w);
          }
        }
      });
      // Churned, the lines are lost in scraped and heaped patches.
      shade.addAssign(
        snowNoise(p.mul(0.7).add(23)).sub(0.5).mul(0.9).mul(churn).mul(t.tracks.x).mul(near),
      );
      // Further off, the lines as faint streaks down the fall line.
      const streak = snowNoise(vec2(u.mul(0.8), v.mul(0.04)).add(61)).sub(0.5);
      const sa = float(1).sub(smoothstep(0.3, 0.8, px.mul(0.8)));
      shade.addAssign(streak.mul(0.6).mul(t.tracks.x).mul(sa).mul(float(1).sub(near)));
      grad.addAssign(acrV.mul(gr.x).add(alg.mul(gr.y)).mul(weight).mul(near));
      shadeOut.assign(clamp(shade.mul(2.5), -1, 1).mul(weight));
      cutOut.assign(cut.mul(weight).mul(near));
    },
  );
  return cutOut;
}
