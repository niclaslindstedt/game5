// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEFORMABLE SNOW, in the picture: the field (`deform-field.ts`) carried
// to the GPU as a ring texture the ground reads (`trail-map.ts`'s
// `deformAt`) and the clipmap draws as a mesh of its own (`terrain.ts`), the
// player's tools pressed into it each frame, and the SPRAY made of the snow
// that left the hole — every grain a share of a volume cut out of the field,
// flung the way the edge that cut it was sliding.
//
// Presentation only: it reads the engine's skier and writes nothing back,
// and draws from a stream of its own, never the engine's.

import * as THREE from "three";

import type { Level, SkierState } from "@engine";

import {
  createDeformField,
  type DeformEjecta,
  type DeformField,
  type DeformLook,
  type ToolMotion,
} from "./deform-field.ts";
import { edgeSlips, emptySlip, type EdgeSlip } from "./spray-sim.ts";
import type { Tier } from "./settings-video.ts";
import type { SnowProps } from "./snowpack.ts";
import type { Stamp } from "./trail-stamp.ts";
import type { TrailUniforms } from "./trail-map.ts";

/** THE FIELD A TERRAIN STOP CARRIES: its cell is a fifth of the ground's
 * level-0 spacing or finer, its half-extent and the step it follows the
 * player by both whole multiples of that spacing (and of twice it for the
 * snap), so its rim lies on level 0's own vertices. */
export const DEFORM_LOOK: Record<Tier, DeformLook> = {
  low: { cell: 0.08, half: 4, snap: 0.8 },
  medium: { cell: 0.05, half: 4.8, snap: 0.6 },
  high: { cell: 0.05, half: 6, snap: 1 },
};

/** THE THROW, as grains: how many a litre of snow thrown is drawn as, the
 * most a frame, and each one's life, s, and size, m. Set by looking. */
export const DEFORM_SPRAY = {
  perLitre: 34,
  most: 180,
  life: [0.7, 1.1],
  grain: [0.014, 0.03],
  clump: [0.04, 0.09],
  /** THE BLADE: an edge sliding faster than `bladeFrom` m/s shaves `blade`
   * m a m/s of its slide, to `bladeMost` m (more in loose snow). */
  bladeFrom: 1,
  blade: 0.0025,
  bladeMost: 0.02,
  /** How far behind the player the window is centred, as a share of its
   * half-extent, along the way he goes: more of the track he left in it. */
  lag: 0.35,
};

let shown = true;
/** Whether the snow round the player is drawn as a volume — on unless a lab
 * asks to see the game without it (`deformAs(false)`, its BEFORE). */
export function deformShown(): boolean {
  return shown;
}
export function deformAs(on: boolean): void {
  shown = on;
}

/** Something grains can be flung into (`spray.ts`'s `fling`). */
export type Fling = (
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  life: number,
  size: number,
  hard: number,
) => void;

export type DeformSnow = {
  readonly field: DeformField;
  readonly look: DeformLook;
  /** Press one frame of the player's tools — `skis` his skis' (or board's)
   * stamps, `body` his body's once he is thrown — and fling what they throw. */
  press(
    skier: SkierState,
    level: Level,
    skis: readonly Stamp[],
    body: readonly Stamp[],
    snowAt: (x: number, z: number) => SnowProps,
    fling: Fling | null,
  ): void;
  /** Follow the player, let the walls settle and upload what changed. */
  update(skier: SkierState, on: boolean): void;
  /** What was thrown in the last `press`, m³ — the lab's readout. */
  thrown(): number;
  clear(): void;
  dispose(): void;
};

export function createDeformSnow(look: DeformLook, uniforms: TrailUniforms): DeformSnow {
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
  const slips: [EdgeSlip, EdgeSlip] = [emptySlip(), emptySlip()];
  const ejecta: DeformEjecta[] = [];
  const motion: ToolMotion = { vx: 0, vy: 0, vz: 0, slide: 0 };
  const blade: Stamp = { ax: 0, az: 0, bx: 0, bz: 0, half: 0.045, depth: 0, berm: 0, wall: 0.6 };
  let seed = 0x9e3779b9;
  const random = (): number => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  let lastThrown = 0;

  /** The ejecta as grains: a litre a few dozen, each jittered about its
   * flight by the throw's spread, clumps as the snow breaks. */
  const throwOut = (fling: Fling) => {
    // Powder is mostly air: a litre of it is a few grains and the cloud's.
    let grains = 0;
    for (const e of ejecta) grains += e.volume * 1000 * (1 - 0.85 * e.loose);
    const budget = Math.min(DEFORM_SPRAY.most, grains * DEFORM_SPRAY.perLitre);
    if (budget <= 0) return;
    for (const e of ejecta) {
      const share = (e.volume * 1000 * (1 - 0.85 * e.loose)) / grains;
      // Whole grains, the remainder by chance.
      const want = budget * share;
      let n = Math.floor(want);
      if (random() < want - n) n++;
      const speed = Math.hypot(e.vx, e.vy, e.vz);
      for (let g = 0; g < n; g++) {
        const j = e.spread * speed;
        const clump = random() < e.clumps * 0.7 * (1 - e.loose);
        const [s0, s1] = clump ? DEFORM_SPRAY.clump : DEFORM_SPRAY.grain;
        // A clump flies slower and lower than the dust round it.
        const k = clump ? 0.8 : 1;
        fling(
          e.x + (random() - 0.5) * 0.25,
          e.y + 0.02,
          e.z + (random() - 0.5) * 0.25,
          (e.vx + (random() - 0.5) * j) * k,
          (e.vy * (0.6 + 0.7 * random()) + (random() - 0.5) * j * 0.4) * k,
          (e.vz + (random() - 0.5) * j) * k,
          DEFORM_SPRAY.life[0] + DEFORM_SPRAY.life[1] * random(),
          // Loose snow comes off as fine dust, not chips.
          (s0 + (s1 - s0) * random()) * (1 - 0.35 * e.loose),
          clump ? 0.6 + 0.4 * random() : e.clumps * 0.4 * random(),
        );
      }
    }
  };

  return {
    field,
    look,
    press(skier, level, skis, body, snowAt, fling) {
      ejecta.length = 0;
      lastThrown = 0;
      // How fast his edges slide across themselves, and which way they fling.
      const n = edgeSlips(skier, slips);
      let slide = 0;
      let tx = 0;
      let tz = 0;
      for (let k = 0; k < n; k++) {
        const e = slips[k];
        slide += e.slide * e.share;
        tx += e.across.x * e.share;
        tz += e.across.z * e.share;
      }
      const tl = Math.hypot(tx, tz) || 1;
      motion.vx = skier.vx;
      motion.vy = skier.vy;
      motion.vz = skier.vz;
      for (const stamp of skis) {
        if (stamp.groom || stamp.belt) continue;
        motion.body = false;
        motion.slide = slide;
        motion.throwX = tx / tl;
        motion.throwZ = tz / tl;
        const mx = (stamp.ax + stamp.bx) / 2;
        const mz = (stamp.az + stamp.bz) / 2;
        field.press(stamp, motion, snowAt(mx, mz), level.groundAt(mx, mz), ejecta);
      }
      // THE EDGE AS A BLADE: a ski sliding across itself shaves the snow the
      // whole length of its edge, where the stations' stamps sweep only the
      // strip under each — so each sliding edge cuts its own line, a few
      // millimetres deeper the harder it slides, and throws what it shaves.
      for (let k = 0; k < n; k++) {
        const e = slips[k];
        if (e.share <= 0 || e.slide < DEFORM_SPRAY.bladeFrom) continue;
        const mx = (e.tip.x + e.tail.x) / 2;
        const mz = (e.tip.z + e.tail.z) / 2;
        const snow = snowAt(mx, mz);
        blade.ax = e.tip.x;
        blade.az = e.tip.z;
        blade.bx = e.tail.x;
        blade.bz = e.tail.z;
        blade.depth =
          Math.min(DEFORM_SPRAY.bladeMost, DEFORM_SPRAY.blade * e.slide) *
          (1 + 2 * Math.min(1, snow.loose));
        motion.body = false;
        motion.slide = e.slide;
        motion.throwX = e.across.x;
        motion.throwZ = e.across.z;
        field.press(blade, motion, snow, level.groundAt(mx, mz), ejecta);
      }
      const off = skier.thrown;
      for (const stamp of body) {
        motion.body = true;
        motion.slide = 0;
        motion.throwX = undefined;
        motion.throwZ = undefined;
        if (off) {
          motion.vx = off.vx;
          motion.vy = off.vy;
          motion.vz = off.vz;
        }
        const mx = (stamp.ax + stamp.bx) / 2;
        const mz = (stamp.az + stamp.bz) / 2;
        field.press(stamp, motion, snowAt(mx, mz), level.groundAt(mx, mz), ejecta);
      }
      for (const e of ejecta) lastThrown += e.volume;
      if (fling) throwOut(fling);
    },
    update(skier, on) {
      const off = skier.thrown;
      const x = off ? off.x : skier.x;
      const z = off ? off.z : skier.z;
      const vx = off ? off.vx : skier.vx;
      const vz = off ? off.vz : skier.vz;
      const v = Math.hypot(vx, vz);
      const lag = v > 0.5 ? (DEFORM_SPRAY.lag * look.half) / v : 0;
      field.follow(x - vx * lag, z - vz * lag);
      field.relax();
      const d = field.dirty;
      texture.clearUpdateRanges();
      if (d.all || (d.any && d.r1 - d.r0 > size / 3)) {
        texture.needsUpdate = true;
      } else if (d.any) {
        // The rows that changed, a range a row (three uploads a range as
        // one row of texels).
        for (let r = d.r0; r <= d.r1; r++)
          texture.addUpdateRange((r * size + d.c0) * 4, (d.c1 - d.c0 + 1) * 4);
        texture.needsUpdate = true;
      }
      field.flush();
      uniforms.uDeformBox.value.set(field.centre.x, field.centre.z, look.half, look.cell);
      uniforms.uDeformOn.value = on && field.centre.x === field.centre.x ? 1 : 0;
    },
    thrown() {
      return lastThrown;
    },
    clear() {
      field.clear();
    },
    dispose() {
      texture.dispose();
      uniforms.uDeformOn.value = 0;
    },
  };
}
