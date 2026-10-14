// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RENDERER'S HOLD ON THE DEFORMABLE SNOW (`deform-snow.ts`): built with
// the ground at the TRAILS stop that carries one, fed the player's stamps
// and the spray's takes each frame (`snow-takes.ts` — the one snow budget),
// and moved after him. The player's alone: a rival's snow is the trail
// map's, as it always was.

import type { SkierState } from "@engine";

import { createDeformSnow, deformLook, deformShown, type DeformSnow } from "./deform-snow.ts";
import type { DeformLook } from "./deform-field.ts";
import type { VideoSettings } from "./settings-video.ts";
import type { SnowProps } from "./snowpack.ts";
import { drainTakes, recordTakes } from "./snow-takes.ts";
import type { Stamp } from "./trail-stamp.ts";
import type { TrailUniforms } from "./trail-map.ts";

export type DeformRig = {
  /** The field's look for a ground about to be built (undefined: none),
   * its old field let go. */
  build(
    video: VideoSettings,
    spacing: number,
    summer: boolean,
    uniforms: TrailUniforms,
  ): DeformLook | undefined;
  /** Before rider `i`'s stamps and spray: where his own stamps begin. */
  begin(i: number, skier: SkierState, stamps: readonly Stamp[]): void;
  /** After rider `i`'s stamps, spray and body: the player's pressed and
   * dug into the field. */
  end(
    i: number,
    skier: SkierState,
    stamps: readonly Stamp[],
    simDt: number,
    snowAt: (x: number, z: number) => SnowProps,
  ): void;
  update(skier: SkierState, on: boolean): void;
  /** Kilograms of thrown snow the field has dug this run (none: 0). */
  thrown(): number;
  clear(): void;
  dispose(): void;
};

export function createDeformRig(): DeformRig {
  let snow: DeformSnow | null = null;
  let own = -1;
  const skis: Stamp[] = [];
  const body: Stamp[] = [];
  return {
    build(video, spacing, summer, uniforms) {
      snow?.dispose();
      snow = null;
      const look = deformShown() && !summer ? deformLook(video.trails, spacing) : null;
      if (look) snow = createDeformSnow(look, uniforms);
      return snow?.look;
    },
    begin(i, skier, stamps) {
      if (i !== 0 || !snow) return;
      own = stamps.length;
      recordTakes(skier);
    },
    end(i, skier, stamps, simDt, snowAt) {
      if (i !== 0 || !snow || own < 0) return;
      skis.length = 0;
      body.length = 0;
      // Thrown, his stamps are his body's (`thrownEffects`); else his skis'.
      const into = skier.thrown ? body : skis;
      for (let k = own; k < stamps.length; k++) into.push(stamps[k]);
      const field = snow;
      drainTakes((takes, n) => {
        if (simDt > 0) field.press(skier, skis, body, snowAt, takes, n);
        else for (let k = 0; k < n; k++) field.field.take(takes[k]);
      });
      recordTakes(null);
      own = -1;
    },
    update(skier, on) {
      snow?.update(skier, on);
    },
    thrown: () => snow?.thrown() ?? 0,
    clear() {
      snow?.clear();
    },
    dispose() {
      snow?.dispose();
      snow = null;
    },
  };
}
