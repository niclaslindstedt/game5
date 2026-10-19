// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEFORMABLE SNOW, in the picture: the field (`deform-field.ts`) carried
// to the GPU as a ring texture the ground reads (`trail-map.ts`'s
// `deformAt`) and the clipmap draws as a mesh of its own (`terrain.ts`); the
// player's tools pressed into it each frame, and the spray's takes
// (`snow-takes.ts`) dug out of it — the hole made of the snow that flew.
//
// Presentation only: it reads the engine's skier and writes nothing back,
// and draws nothing from any stream.

import * as THREE from "three";

import type { SkierState } from "@engine";

import { createDeformField, type DeformField, type DeformLook } from "./deform-field.ts";
import { createDeformShade, type DeformShade, type GroundFrame } from "./deform-shade.ts";
import { edgeSlips, emptySlip, type EdgeSlip } from "./spray-sim.ts";
import type { TrailLevel } from "./settings-video.ts";
import type { SnowProps } from "./snowpack.ts";
import type { SnowTake } from "./snow-takes.ts";
import type { Stamp } from "./trail-stamp.ts";
import type { TrailUniforms } from "./trail-map.ts";

/** A field's look and its self-shadow's march: steps, and each step's
 * growth on the last. */
export type DeformTier = DeformLook & { march: number; grow: number };

/** THE FIELD A TRAILS STOP CARRIES, beside the march its self-shadow takes
 * (`deform-glsl.ts`): none at OFF and LOW (the trail map alone, as ever);
 * MEDIUM a 5 cm field 4.8 m round the player and a short march; HIGH 6 m
 * and the full one. The half-extent and the snap are whole multiples of
 * twice the ground's level-0 spacing (`spacing`, the TERRAIN stop's), so
 * the field's rim and its centre lie on level 0's own vertices. */
export function deformLook(trails: TrailLevel, spacing: number): DeformTier | null {
  const want = DEFORM_TIERS[trails];
  if (!want) return null;
  const step = 2 * spacing;
  return {
    cell: want.cell,
    half: Math.max(step, Math.round(want.half / step) * step),
    snap: step,
    march: want.march,
    grow: want.grow,
  };
}

const DEFORM_TIERS: Record<
  TrailLevel,
  { cell: number; half: number; march: number; grow: number } | null
> = {
  off: null,
  low: null,
  // Seven steps from a cell, each 1.6 the last: to about 0.6 m.
  medium: { cell: 0.05, half: 4.8, march: 7, grow: 1.6 },
  // Fourteen, each 1.33 the last: to about 1.6 m.
  high: { cell: 0.05, half: 6, march: 14, grow: 1.33 },
};

/** A frame longer than this, s, settles the walls twice. */
const SETTLE_TWICE = 1 / 45;

/** How far behind the player the window is centred, as a share of its
 * half-extent along the way he goes: more of the track he left in it. */
const LAG = 0.35;

let shown = true;
/** Whether the snow round the player is drawn as a volume — on unless a lab
 * asks to see the game without it (`deformAs(false)`, its BEFORE). */
export function deformShown(): boolean {
  return shown;
}
export function deformAs(on: boolean): void {
  shown = on;
}

export type DeformSnow = {
  readonly field: DeformField;
  readonly look: DeformLook;
  /** Press one frame of the player's tools — `skis` his skis' (or board's)
   * stamps, `body` his body's once he is thrown — and dig the spray's
   * `takes` out of the snow. */
  press(
    skier: SkierState,
    skis: readonly Stamp[],
    body: readonly Stamp[],
    snowAt: (x: number, z: number) => SnowProps,
    takes: readonly SnowTake[],
    n: number,
  ): void;
  /** Follow the player, let the walls settle over `dt` s of the run, and
   * upload what changed. */
  update(skier: SkierState, on: boolean, dt?: number): void;
  /** Its own shade marched a cell at a time on `gl` (`deform-shade.ts`)
   * over the ground's slope toward `sun`, from now on — and once now,
   * behind the loading card, so the pass is linked before the run. */
  bind(gl: THREE.WebGLRenderer, ground: GroundFrame, sun: { value: THREE.Vector3 }): void;
  /** Kilograms of thrown snow the field has dug since the run began. */
  thrown(): number;
  clear(): void;
  dispose(): void;
};

export function createDeformSnow(look: DeformTier, uniforms: TrailUniforms): DeformSnow {
  const field = createDeformField(look);
  const size = field.size;
  const texture = new THREE.DataTexture(
    field.rgba,
    size,
    size,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  uniforms.uDeform.value = texture;
  uniforms.uDeformSpan.value = size * look.cell;
  uniforms.uDeformMarch.value.set(look.march, look.grow);
  let shade: DeformShade | null = null;
  let drawn: THREE.WebGLRenderer | null = null;
  const slips: [EdgeSlip, EdgeSlip] = [emptySlip(), emptySlip()];
  const motion = { slide: 0, body: false, aheadX: 0, aheadZ: 0 };

  return {
    field,
    look,
    press(skier, skis, body, snowAt, takes, n) {
      // How fast his edges slide across themselves, and which way.
      const m = edgeSlips(skier, slips);
      let slide = 0;
      let tx = 0;
      let tz = 0;
      for (let k = 0; k < m; k++) {
        const e = slips[k];
        slide += e.slide * e.share;
        tx += e.across.x * e.share;
        tz += e.across.z * e.share;
      }
      const tl = Math.hypot(tx, tz) || 1;
      motion.body = false;
      motion.slide = slide;
      motion.aheadX = tx / tl;
      motion.aheadZ = tz / tl;
      for (const stamp of skis) {
        if (stamp.groom || stamp.belt) continue;
        field.press(stamp, motion, snowAt((stamp.ax + stamp.bx) / 2, (stamp.az + stamp.bz) / 2));
      }
      motion.body = true;
      motion.slide = 0;
      for (const stamp of body) {
        field.press(stamp, motion, snowAt((stamp.ax + stamp.bx) / 2, (stamp.az + stamp.bz) / 2));
      }
      for (let i = 0; i < n; i++) field.take(takes[i]);
    },
    update(skier, on, dt = 0) {
      const off = skier.thrown;
      const x = off ? off.x : skier.x;
      const z = off ? off.z : skier.z;
      const vx = off ? off.vx : skier.vx;
      const vz = off ? off.vz : skier.vz;
      const v = Math.hypot(vx, vz);
      const lag = v > 0.5 ? (LAG * look.half) / v : 0;
      field.follow(x - vx * lag, z - vz * lag);
      // The walls settle by the run's time, not the frame's count: a frame
      // that stood for two of the run's sixtieths settles twice (no more —
      // a slow machine is not handed more work for being slow).
      field.relax();
      if (dt > SETTLE_TWICE) field.relax();
      const d = field.dirty;
      texture.clearUpdateRanges();
      if (d.all || (d.any && d.r1 - d.r0 > size / 3)) {
        texture.needsUpdate = true;
      } else if (d.any) {
        // The rows that changed, one range a row.
        for (let r = d.r0; r <= d.r1; r++)
          texture.addUpdateRange((r * size + d.c0) * 4, (d.c1 - d.c0 + 1) * 4);
        texture.needsUpdate = true;
      }
      field.flush();
      uniforms.uDeformBox.value.set(field.centre.x, field.centre.z, look.half, look.cell);
      uniforms.uDeformOn.value = on && field.centre.x === field.centre.x ? 1 : 0;
      if (shade && drawn && uniforms.uDeformOn.value > 0) shade.draw(drawn);
    },
    bind(gl, ground, sun) {
      shade?.dispose();
      shade = createDeformShade(size, texture, uniforms, ground, sun);
      drawn = gl;
      uniforms.uDeform.value = shade.texture;
      shade.draw(gl);
    },
    thrown: () => field.thrown(),
    clear() {
      field.clear();
    },
    dispose() {
      shade?.dispose();
      texture.dispose();
      uniforms.uDeformOn.value = 0;
    },
  };
}
