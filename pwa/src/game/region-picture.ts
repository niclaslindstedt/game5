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

import * as THREE from "three";
import { regionOf, type Level } from "@engine";

import { gradeOf, isNeutral } from "./colour-grade.ts";
import type { GpuTimer } from "./gpu-timer.ts";
import { createGradePass, gradeSupported, type GradePass } from "./grade-pass.ts";

export type RegionPicture = {
  /** The region `level` is built in becomes the picture's; returns the
   * target the scene must be COMPILED against (null: the canvas). */
  load(level: Level): THREE.WebGLRenderTarget | null;
  /** Draw `scene` through `camera` onto the canvas, graded or not; the
   * grade's pass is a slice of its own on the GPU's timer. */
  draw(scene: THREE.Scene, camera: THREE.Camera, timer?: Pick<GpuTimer, "push" | "pop">): void;
  /** What the last frame's SCENE cost — the grade's own pass not counted. */
  info(): { calls: number; triangles: number; points: number };
  dispose(): void;
};

export function createRegionPicture(gl: THREE.WebGLRenderer, samples: number): RegionPicture {
  let pass: GradePass | null = null;
  let graded = false;
  const size = new THREE.Vector2();
  const last = { calls: 0, triangles: 0, points: 0 };
  return {
    load(level) {
      const grade = gradeOf(regionOf(level).id);
      graded = !isNeutral(grade) && gradeSupported(gl);
      if (!graded) return null;
      pass ??= createGradePass(samples);
      pass.setGrade(grade);
      return pass.target;
    },
    draw(scene, camera, timer) {
      if (!graded || !pass) {
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
