// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW A FRAME REACHES THE CANVAS in a region (R21) — straight, or through
// the region's grade (`grade-pass.ts`). The renderer hands every frame here
// and never learns which.
//
// A region whose grade is neutral — the alpine, the picture as authored —
// is drawn onto the canvas exactly as it always was, and no target is ever
// allocated for it: the map everybody has always ridden costs what it cost.
// A graded region draws into the pass's half-float target and the pass
// writes the canvas. The pass is built the first time a graded region
// loads, and kept.
//
// THE ANTIALIAS ROW (`ANTIALIAS_SAMPLES`) is the target's sample count, set
// at once. The canvas's own multisampling is fixed when the canvas is made,
// so a neutral region is drawn straight onto it only while that is what the
// row asks for (its four samples, or none); at any other count it is drawn
// through the pass, at the neutral grade, as under the buzz.

import * as THREE from "three";
import { regionOf, type Level } from "@engine";

import { gradeOf, isNeutral, type ColourGrade } from "./colour-grade.ts";
import { ANTIALIAS_SAMPLES, type AntialiasLevel } from "./settings-video.ts";
import { summerShown } from "./season-look.ts";
import type { GpuTimer } from "./gpu-timer.ts";
import { createGradePass, gradeSupported, type GradePass } from "./grade-pass.ts";

export type RegionPicture = {
  /** The region `level` is built in becomes the picture's; returns the
   * target the scene must be COMPILED against (null: the canvas). */
  load(level: Level): THREE.WebGLRenderTarget | null;
  /** Draw `scene` through `camera` onto the canvas, graded or not; the
   * grade's pass is a slice of its own on the GPU's timer. */
  draw(scene: THREE.Scene, camera: THREE.Camera, timer?: Pick<GpuTimer, "push" | "pop">): void;
  /** THE BUZZ over the picture (`grade-pass.ts`), 0..1, and the clock it
   * swims by, s: at 0 nothing changes; above it even an ungraded region
   * draws through the pass, at its own neutral grade. */
  setBuzz(buzz: number, t: number): void;
  /** THE BLAZE over the picture (`grade-pass.ts`), or null: as the buzz,
   * an ungraded region draws through the pass only while it burns. */
  setBlaze(blaze: { heat: number; flash: number; smoke: number } | null, t: number): void;
  /** What the last frame's SCENE cost — the grade's own pass not counted. */
  info(): { calls: number; triangles: number; points: number };
  dispose(): void;
};

/** What a canvas made with multisampling takes a pixel. */
export const CANVAS_SAMPLES = 4;

/** Whether the frame goes STRAIGHT onto the canvas rather than through the
 * grade's target: a neutral region, no buzz, no blaze, and the ANTIALIAS
 * row asking for what the canvas was made with. Three tone maps and
 * encodes before the haze only on the canvas, so this is also where the
 * haze is mixed in display space (`haze-tsl.ts`, which asks the same). */
export function drawsStraight(o: {
  graded: boolean;
  buzz: number;
  burning: boolean;
  samples: number;
  canvas: number;
}): boolean {
  return !o.graded && o.buzz === 0 && !o.burning && o.samples === o.canvas;
}

/** The picture over `gl`, multisampled as the ANTIALIAS row `antialias`
 * reads at each frame. */
export function createRegionPicture(
  gl: THREE.WebGLRenderer,
  antialias: () => AntialiasLevel,
): RegionPicture {
  let samples = ANTIALIAS_SAMPLES[antialias()];
  // The canvas's own, as it was made.
  const canvas = gl.getContextAttributes()?.antialias ? CANVAS_SAMPLES : 0;
  let pass: GradePass | null = null;
  let graded = false;
  let grade: ColourGrade | null = null;
  let buzz = 0;
  let burning = false;
  const size = new THREE.Vector2();
  const last = { calls: 0, triangles: 0, points: 0 };
  /** The row moved: the target takes the new count at once, and a neutral
   * region not drawn straight onto the canvas gets a pass to be drawn by. */
  const follow = (): void => {
    const n = ANTIALIAS_SAMPLES[antialias()];
    if (n === samples) return;
    samples = n;
    pass?.setSamples(n);
    if (pass || samples === canvas || !gradeSupported(gl)) return;
    pass = createGradePass(samples);
    if (grade) pass.setGrade(grade);
  };
  return {
    load(level) {
      grade = gradeOf(regionOf(level).id, summerShown());
      graded = !isNeutral(grade) && gradeSupported(gl);
      pass?.setGrade(grade);
      if (!graded && (samples === canvas || !gradeSupported(gl))) return null;
      pass ??= createGradePass(samples);
      pass.setGrade(grade);
      return pass.target;
    },
    setBuzz(b, t) {
      buzz = b > 1e-3 && gradeSupported(gl) ? b : 0;
      if (buzz > 0 && !pass) {
        pass = createGradePass(samples);
        if (grade) pass.setGrade(grade);
      }
      pass?.setBuzz(buzz, t);
    },
    setBlaze(b, t) {
      const on = !!b && b.heat + b.flash + b.smoke > 1e-3 && gradeSupported(gl);
      if (!on && !burning) return;
      burning = on;
      if (on && !pass) {
        pass = createGradePass(samples);
        if (grade) pass.setGrade(grade);
      }
      if (on && b) pass?.setBlaze(b.heat, b.flash, b.smoke, t);
      else pass?.setBlaze(0, 0, 0, t);
    },
    draw(scene, camera, timer) {
      follow();
      if (drawsStraight({ graded, buzz, burning, samples, canvas }) || !pass) {
        gl.render(scene, camera);
        const r = gl.info.render;
        last.calls = r.calls;
        last.triangles = r.triangles;
        last.points = r.points;
        return;
      }
      gl.getDrawingBufferSize(size);
      pass.setSize(size.x, size.y);
      const onto = gl.getRenderTarget();
      gl.setRenderTarget(pass.target);
      gl.render(scene, camera);
      const r = gl.info.render;
      last.calls = r.calls;
      last.triangles = r.triangles;
      last.points = r.points;
      gl.setRenderTarget(onto);
      timer?.push("grade");
      pass.render(gl);
      timer?.pop();
    },
    info: () => ({ ...last }),
    dispose() {
      pass?.dispose();
      pass = null;
    },
  };
}
