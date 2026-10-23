// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW A FRAME REACHES THE CANVAS in a region (R21) — straight, or through
// the region's grade (`grade-pass.ts`). The renderer hands every frame here
// and never learns which.
//
// A region whose grade is neutral (`isNeutral`: no region's is today — the
// alpine too is graded) is drawn straight onto the canvas, and no target is
// ever allocated for it. A graded region draws into the pass's half-float
// target and the pass writes the canvas. The pass is built the first time a graded region
// loads, and kept.
//
// THE ANTIALIAS ROW (`ANTIALIAS_SAMPLES`) is the target's sample count, set
// at once. The canvas's own multisampling is fixed when the canvas is made,
// so a neutral region is drawn straight onto it only while that is what the
// row asks for (its four samples, or none); at any other count it is drawn
// through the pass, at the neutral grade, as under the buzz.
//
// ON THE NODE RENDERER (`docs/webgpu.md`, part 7) the same decisions are
// made over the same pass: its target is three's own `RenderTarget` and
// the node grade (`grade-tsl.ts`, handed in as `node`) writes the canvas.
// The haze is told each frame where WebGL's would be mixed
// (`hazeInDisplay`): in display space only when the frame goes straight.
//
// THE RAYS ROW (`RAYS_LOOK`, `rays-tsl.ts`, part 18) is the node renderer's
// alone: while it is on, the frame always goes through the pass, the
// target keeps its depth, the rays are marched between the scene and the
// grade, and the grade shades the colour with them. With it OFF nothing
// of it is built or drawn.

import * as THREE from "three";
import { regionOf, type Level } from "@engine";

import { gradeOf, isNeutral, type ColourGrade } from "./colour-grade.ts";
import {
  ANTIALIAS_SAMPLES,
  RAYS_LOOK,
  type AntialiasLevel,
  type RaysLevel,
  type RaysLook,
} from "./settings-video.ts";
import { summerShown } from "./season-look.ts";
import type { GpuTimer } from "./gpu-timer.ts";
import { createGradePass, gradeSupported, type GradePass, type NodeGrade } from "./grade-pass.ts";

export type RegionPicture = {
  /** The region `level` is built in becomes the picture's; returns the
   * target the scene must be COMPILED against (null: the canvas). */
  load(level: Level): THREE.WebGLRenderTarget | null;
  /** Draw `scene` through `camera` onto the canvas, graded or not; the
   * grade's pass is a slice of its own on the GPU's timer. */
  draw(scene: THREE.Scene, camera: THREE.Camera, timer?: Pick<GpuTimer, "push" | "pop">): void;
  /** THE RAYS' FIRST DRAW, done behind the loading card after the scene's
   * warm-up (`renderer.ts`): with the row on, its passes are marched once
   * and the grade drawn shaded, so the pipelines they need are built there
   * and not on the run's first frame. Nothing with the row OFF. */
  warm(camera: THREE.Camera): void;
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

/** THE RAYS on the node renderer (`rays-tsl.ts`): the target readied for a
 * RAYS stop, the rays marched after the scene, the frame kept for the
 * water's mirror after the grade. */
export type NodeRays = {
  ready(target: THREE.RenderTarget, look: RaysLook): void;
  march(target: THREE.RenderTarget, camera: THREE.PerspectiveCamera, look: RaysLook): void;
  keep(target: THREE.RenderTarget, camera: THREE.PerspectiveCamera, look: RaysLook): void;
};

/** The node renderer's half of the picture (`render-seam.ts`'s `post`). */
export type NodePicture = {
  /** The samples the canvas was made with. */
  readonly canvas: number;
  /** The grade's node pass over the GLSL pass's uniforms. */
  readonly grade: NodeGrade;
  /** Whether the haze mixes in display space this frame (`drawsStraight`). */
  hazeInDisplay(on: boolean): void;
  /** The node renderer's counters since the frame began. */
  info(): { calls: number; triangles: number; points: number };
  /** The rays (made the first time a stop asks; null before the scene is
   * dressed). */
  rays(): NodeRays | null;
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
  /** Whether the RAYS row marches anything (the node renderer's alone). */
  rays?: boolean;
}): boolean {
  return !o.graded && o.buzz === 0 && !o.burning && o.samples === o.canvas && !o.rays;
}

/** The picture over `gl`, multisampled as the ANTIALIAS row `antialias`
 * reads at each frame — on the node renderer, through `node`. */
export function createRegionPicture(
  gl: THREE.WebGLRenderer,
  antialias: () => AntialiasLevel,
  node: NodePicture | null = null,
  raysLevel: () => RaysLevel = () => "off",
): RegionPicture {
  let samples = ANTIALIAS_SAMPLES[antialias()];
  // The canvas's own, as it was made.
  const canvas = node ? node.canvas : gl.getContextAttributes()?.antialias ? CANVAS_SAMPLES : 0;
  // The node renderer always draws into half floats (its own frame is one).
  const supported = (): boolean => !!node || gradeSupported(gl);
  const createPass = (n: number): GradePass => createGradePass(n, node?.grade ?? null);
  let pass: GradePass | null = null;
  let graded = false;
  let grade: ColourGrade | null = null;
  let buzz = 0;
  let burning = false;
  /** The RAYS stop the target was last readied for. */
  let readied: RaysLook = RAYS_LOOK.off;
  const size = new THREE.Vector2();
  const last = { calls: 0, triangles: 0, points: 0 };
  /** The scene's draw, counted before the grade's own. */
  const tally = (): void => {
    const r = node ? node.info() : gl.info.render;
    last.calls = r.calls;
    last.triangles = r.triangles;
    last.points = r.points;
  };
  /** The row moved: the target takes the new count at once, and a neutral
   * region not drawn straight onto the canvas gets a pass to be drawn by. */
  const follow = (): void => {
    const n = ANTIALIAS_SAMPLES[antialias()];
    if (n === samples) return;
    samples = n;
    pass?.setSamples(n);
    if (pass || samples === canvas || !supported()) return;
    pass = createPass(samples);
    if (grade) pass.setGrade(grade);
  };
  return {
    load(level) {
      grade = gradeOf(regionOf(level).id, summerShown());
      graded = !isNeutral(grade) && supported();
      pass?.setGrade(grade);
      // The rays' target readied now, so the warm-up builds what it draws.
      const look = node ? RAYS_LOOK[raysLevel()] : RAYS_LOOK.off;
      const rays = look !== RAYS_LOOK.off ? node?.rays() : null;
      if (!graded && !rays && (samples === canvas || !supported())) return null;
      pass ??= createPass(samples);
      pass.setGrade(grade);
      if (rays && readied !== look) rays.ready(pass.target, (readied = look));
      return pass.target;
    },
    warm(camera) {
      const lens = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
        ? (camera as THREE.PerspectiveCamera)
        : null;
      const rays = readied !== RAYS_LOOK.off && lens && pass ? node?.rays() : null;
      if (!rays || !lens || !pass) return;
      const onto = gl.getRenderTarget();
      rays.march(pass.target, lens, readied);
      pass.render(gl, true);
      gl.setRenderTarget(onto);
    },
    setBuzz(b, t) {
      buzz = b > 1e-3 && supported() ? b : 0;
      if (buzz > 0 && !pass) {
        pass = createPass(samples);
        if (grade) pass.setGrade(grade);
      }
      pass?.setBuzz(buzz, t);
    },
    setBlaze(b, t) {
      const on = !!b && b.heat + b.flash + b.smoke > 1e-3 && supported();
      if (!on && !burning) return;
      burning = on;
      if (on && !pass) {
        pass = createPass(samples);
        if (grade) pass.setGrade(grade);
      }
      if (on && b) pass?.setBlaze(b.heat, b.flash, b.smoke, t);
      else pass?.setBlaze(0, 0, 0, t);
    },
    draw(scene, camera, timer) {
      follow();
      const look = node ? RAYS_LOOK[raysLevel()] : RAYS_LOOK.off;
      const lens = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
        ? (camera as THREE.PerspectiveCamera)
        : null;
      const marching = look.shade || look.contact || look.mirror;
      const rays = (marching || readied !== RAYS_LOOK.off) && lens ? node?.rays() : null;
      if (marching && rays && !pass) {
        pass = createPass(samples);
        if (grade) pass.setGrade(grade);
      }
      const on = marching && !!rays;
      const straight = drawsStraight({ graded, buzz, burning, samples, canvas, rays: on });
      node?.hazeInDisplay(straight || !pass);
      if (straight || !pass) {
        gl.render(scene, camera);
        tally();
        return;
      }
      if (rays && readied !== (on ? look : RAYS_LOOK.off)) {
        readied = on ? look : RAYS_LOOK.off;
        rays.ready(pass.target, readied);
      }
      gl.getDrawingBufferSize(size);
      pass.setSize(size.x, size.y);
      const onto = gl.getRenderTarget();
      gl.setRenderTarget(pass.target);
      gl.render(scene, camera);
      tally();
      gl.setRenderTarget(onto);
      if (on && rays && lens) {
        timer?.push("rays");
        rays.march(pass.target, lens, look);
        timer?.pop();
      }
      timer?.push("grade");
      pass.render(gl, on);
      timer?.pop();
      if (rays && lens) rays.keep(pass.target, lens, on ? look : RAYS_LOOK.off);
    },
    info: () => ({ ...last }),
    dispose() {
      pass?.dispose();
      pass = null;
    },
  };
}
