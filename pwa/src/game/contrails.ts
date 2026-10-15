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
import { ICE_ALTITUDE } from "./cloud-light.ts";

export type ContrailUniforms = ReturnType<typeof contrailUniforms>;
function contrailUniforms() {
  const v4 = (): THREE.Vector4[] => Array.from({ length: TRAIL_SLOTS }, () => new THREE.Vector4());
  return {
    uTrailA: { value: v4() },
    uTrailB: { value: v4() },
    uTrailC: { value: v4() },
    uTrailD: { value: v4() },
    uTrailOn: { value: new THREE.Vector4() },
    uTrailMid: { value: new THREE.Vector4(0, 0, CONTRAIL.reach, 0) },
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

/** The sun's dip under the level at the trails' height: it sets for them
 * that much later than for the snow. */
const DIP = Math.sqrt((2 * ICE_ALTITUDE) / 6_360_000);
const DEG = Math.PI / 180;

/** HOW MUCH OF A TRAIL SHOWS BY NIGHT: all of it while the sun still
 * lights it or the twilight sky behind it, nothing once the sun is past
 * nautical twilight at its height — save, under a bright high moon, a
 * faint grey line that mostly shows by the stars it dims. */
export function nightShow(look: Pick<SkyLook, "elevation" | "moon" | "moonLit">): number {
  const day = smooth(-(DIP + 12 * DEG), -(DIP + 3 * DEG), look.elevation);
  const moon = CONTRAIL.moonShow * look.moonLit * smooth(0.15, 0.6, look.moon.y);
  return Math.max(day, moon);
}

/** A plane's glint: only while the sun is over its own horizon. Its lights
 * are far too small to show. */
export function glintOf(look: Pick<SkyLook, "elevation">): number {
  return smooth(-DIP, -DIP + 1.5 * DEG, look.elevation);
}

function smooth(e0: number, e1: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
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
      const show = contrailShow(level, at) * look.clouds.show * nightShow(look);
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
      u.uTrailMid.value.set(f.cx, f.cz, CONTRAIL.reach, glintOf(look));
      u.uTrailSun.value.set(...look.clouds.ice.sun);
      u.uTrailSky.value.set(...look.clouds.ice.sky);
    },
  };
}
