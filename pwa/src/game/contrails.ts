// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CONTRAILS ON THE GPU: the plan's trails at the run's moment
// (`contrail-plan.ts`) packed into the dome's uniforms each frame, ranked
// and capped at the CLOUDS' rung (`settings-video.ts`'s `CONTRAIL_LOOK`).
// No mesh, no pass and no texture: the dome draws them
// (`contrail-glsl.ts`). The planes fly on the run's own clock `t`; the
// light on them is the look's (`SkyLook.clouds.ice`), so the sun's clock
// moves it.

import * as THREE from "three";
import type { Level } from "@engine";

import {
  CONTRAIL,
  contrailShow,
  contrailsAt,
  trailFrameOf,
  type Trail,
  type TrailFrame,
} from "./contrail-plan.ts";
import { TRAIL_SLOTS } from "./contrail-glsl.ts";
import type { DistanceLevel } from "./settings-video.ts";
import { CONTRAIL_LOOK } from "./settings-video.ts";
import type { SkyLook } from "./sky.ts";

export type ContrailUniforms = ReturnType<typeof contrailUniforms>;
function contrailUniforms() {
  const v4 = (): THREE.Vector4[] => Array.from({ length: TRAIL_SLOTS }, () => new THREE.Vector4());
  return {
    uTrailA: { value: v4() },
    uTrailB: { value: v4() },
    uTrailC: { value: v4() },
    uTrailD: { value: v4() },
    uTrailOn: { value: new THREE.Vector4() },
    uTrailMid: { value: new THREE.Vector3(0, 0, CONTRAIL.reach) },
    uTrailSun: { value: new THREE.Vector3() },
    uTrailSky: { value: new THREE.Vector3() },
  };
}

/** A lab's hand on the moment the planes are at (the sky's look is the
 * caller's), or null to follow the run. */
let forcedT: number | null = null;
export function forceContrailTime(t: number | null): void {
  forcedT = t;
}

/** A lab's hand on the trails themselves (a fresh one, one forty minutes
 * old…), drawn in place of the plan's; null to follow the plan. */
let forcedTrails: Trail[] | null = null;
export function forceTrails(next: Trail[] | null): void {
  forcedTrails = next;
}

export type Contrails = {
  uniforms: ContrailUniforms;
  setTier(next: DistanceLevel): void;
  /** The trails over `level` at run time `t`, lit by `look`, for `camera`. */
  update(
    look: SkyLook,
    level: Level | null,
    t: number,
    camera: THREE.Camera,
    heightPx: number,
  ): void;
  /** How many the last frame drew (the labs'). */
  drawn(): number;
};

export function createContrails(): Contrails {
  const u = contrailUniforms();
  let tier: DistanceLevel = "medium";
  let frame: { level: Level; frame: TrailFrame } | null = null;
  let count = 0;
  return {
    uniforms: u,
    setTier(next) {
      tier = next;
    },
    drawn: () => count,
    update(look, level, t, camera, heightPx) {
      const lookOf = CONTRAIL_LOOK[tier];
      count = 0;
      if (!level) {
        u.uTrailOn.value.set(0, 0, 0, 0);
        return;
      }
      const at = forcedT ?? t;
      if (!frame || frame.level !== level) frame = { level, frame: trailFrameOf(level) };
      const f = frame.frame;
      const show = contrailShow(level, at) * look.clouds.show;
      const most = Math.min(lookOf.trails, TRAIL_SLOTS);
      const trails =
        show <= 0
          ? []
          : forcedTrails
            ? forcedTrails.slice(0, most)
            : contrailsAt(level, f, at, most);
      count = trails.length;
      for (let k = 0; k < trails.length; k++) {
        const r = trails[k];
        const fl = r.flight;
        u.uTrailA.value[k].set(r.head[0], r.head[1], r.tail[0], r.tail[1]);
        u.uTrailB.value[k].set(r.y, r.ageHead, r.ageTail, fl.width);
        u.uTrailC.value[k].set(r.alongHead, r.alongTail, fl.spread, fl.persists ? 0 : fl.life);
        u.uTrailD.value[k].set(fl.tau, fl.phase, r.plane ? 1 : 0, fl.forms ? 1 : 0);
      }
      const fov =
        camera instanceof THREE.PerspectiveCamera ? (camera.fov * Math.PI) / 180 / camera.zoom : 1;
      u.uTrailOn.value.set(count, show, fov / Math.max(1, heightPx), lookOf.fibres);
      u.uTrailMid.value.set(f.cx, f.cz, CONTRAIL.reach);
      u.uTrailSun.value.set(...look.clouds.ice.sun);
      u.uTrailSky.value.set(...look.clouds.ice.sky);
    },
  };
}
