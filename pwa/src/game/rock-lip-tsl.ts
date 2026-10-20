// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SNOW MEETS THE ROCK ON THE NODE RENDERER (`docs/webgpu.md`):
// `rock-lip.ts`'s `ROCK_LIP_GLSL`, restated in TSL for the ground's node
// twin (`snow-sample-tsl.ts`). The GLSL is the authority, term for term.

import * as TSL from "three/tsl";

import type { N } from "./haze-tsl.ts";
import { CORE, EDGE, FOOT, JITTER, LIP, LIP_NOISE, LIP_VARY, RUNNEL, SHADE } from "./rock-lip.ts";
import { snowNoise } from "./snow-noise-tsl.ts";

const { clamp, float, length, max, min, mix, smoothstep } = TSL as N;

/** `rockLip`: the rock left bare at `p` (the slope's share `r` there, the
 * ground's slope `gr`, a pixel's footprint `foot`) and the lip and the
 * shade there. `ground(q)` reads the ground map at plan point `q`; `slope`
 * is the region's rock slope (`uRockSlope`). */
export function rockLipNode(
  p: N,
  r: N,
  gr: N,
  foot: N,
  ground: (q: N) => N,
  slope: N,
): { bare: N; lip: N; under: N } {
  const at = (q: N): N => {
    const gq = ground(q).toVar();
    return smoothstep(slope.x, slope.y, length(gq.rg)).mul(float(1).sub(clamp(gq.b, 0, 1)));
  };
  const s = max(length(gr), 1e-4);
  const d = gr.negate().div(s).toVar();
  const reach = float(LIP)
    .mul(mix(LIP_VARY[0], LIP_VARY[1], snowNoise(p.mul(LIP_NOISE.REACH_F))))
    .toVar();
  const bank = float(FOOT).mul(snowNoise(p.mul(LIP_NOISE.FOOT_F).add(7)).add(0.5));
  const up = at(p.sub(d.mul(reach)));
  const down = at(p.add(d.mul(bank))).toVar();
  const j = snowNoise(p.mul(LIP_NOISE.EDGE_F).add(11)).sub(0.5).mul(JITTER).toVar();
  const bare = smoothstep(EDGE[0], EDGE[1], min(r, min(up, down)).add(j)).toVar();
  const lip = max(0, smoothstep(EDGE[0], EDGE[1], min(r, down).add(j)).sub(bare)).toVar();
  const run = LIP_NOISE.RUN_STEPS.map((k) => snowNoise(p.add(d.mul(k)).mul(LIP_NOISE.RUN_F)))
    .reduce((a: N, b: N) => a.add(b))
    .div(LIP_NOISE.RUN_STEPS.length);
  bare.mulAssign(
    float(1).sub(
      smoothstep(0.62, 0.74, run)
        .mul(RUNNEL)
        .mul(float(1).sub(smoothstep(0.4, 1.2, foot.mul(LIP_NOISE.RUN_F * 2)))),
    ),
  );
  const under = bare
    .mul(
      float(1)
        .sub(at(p.sub(d.mul(reach.add(CORE)))))
        .mul(0.5)
        .add(
          float(1)
            .sub(at(p.sub(d.mul(reach.add(SHADE)))))
            .mul(0.5),
        ),
    )
    .toVar();
  return { bare, lip, under };
}
