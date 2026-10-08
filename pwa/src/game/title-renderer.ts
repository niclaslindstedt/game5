// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE SCENE'S RENDERER: raw WebGL2, and nothing else. The world's
// renderer is three.js in a chunk of its own; pulling it onto the boot path
// for one picture would make the first thing a visitor downloads the
// biggest. This is a few kilobytes: two plates, two passes and a draw of
// points (`title-glsl.ts`), every number decided by `title-plan.ts`.
//
// It draws what it is told to — a title time, the pointer, whether the front
// door is open — and keeps only what a GPU must: its textures, its one
// half-resolution target, and the share of the way into the door's framing
// (eased per frame, since a press has no title time of its own). The
// resolution steps down on a machine that cannot hold it (`scaleAfter`)
// unless it is held (`fixedScale`, a lab's frozen frame).

import type { TitlePlate } from "../title/plates.ts";
import { BRIGHT_FS, COMPOSITE_FS, FULLSCREEN_VS, PARTICLE_FS, PARTICLE_VS } from "./title-glsl.ts";
import {
  exposureAt,
  framingAt,
  particleCounts,
  pixelRatio,
  scaleAfter,
  TITLE_BEATS,
} from "./title-plan.ts";

export type TitlePlates = {
  colour: ImageBitmap;
  aux: ImageBitmap;
  plate: TitlePlate;
};

export type TitleRendererOptions = {
  /** Reduced motion: a still frame, faded in. */
  still: boolean;
  /** Hold the resolution where it starts (a lab's frozen frame). */
  fixedScale: boolean;
};

export type TitleRenderer = {
  /** Draw a frame at title time `t` (s since the reveal; below zero is the
   * dark before it), `dt` since the last (s), the pointer −1..1. */
  draw(t: number, dt: number, pointer: readonly [number, number], menuOpen: boolean): void;
  /** The canvas's CSS box and the device pixel ratio. */
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
};

/** Thrown when the machine has no WebGL2 — the stage shows the poster. */
export class NoWebGL extends Error {}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [kind, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const sh = gl.createShader(kind)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(`title shader: ${gl.getShaderInfoLog(sh) ?? "?"}`);
    }
    gl.attachShader(program, sh);
    gl.deleteShader(sh);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`title program: ${gl.getProgramInfoLog(program) ?? "?"}`);
  }
  return program;
}

/** A plate on the GPU, mipmapped: the colour as sRGB (so it samples
 * linear), the aux as data. Decoded with no premultiply and no colour
 * conversion, or the aux's alpha would eat its other three channels. */
function upload(gl: WebGL2RenderingContext, bitmap: ImageBitmap, srgb: boolean): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  const internal = srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function createTitleRenderer(
  canvas: HTMLCanvasElement,
  plates: TitlePlates,
  opts: TitleRendererOptions,
): TitleRenderer {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "default",
  });
  if (!gl) throw new NoWebGL("no WebGL2");
  const { plate } = plates;

  const bright = compile(gl, FULLSCREEN_VS, BRIGHT_FS);
  const composite = compile(gl, FULLSCREEN_VS, COMPOSITE_FS);
  const points = compile(gl, PARTICLE_VS, PARTICLE_FS);
  const colourTex = upload(gl, plates.colour, true);
  const auxTex = upload(gl, plates.aux, false);
  const vao = gl.createVertexArray();

  // The half-resolution target the bright pass writes and the composite
  // reads through its mips.
  const brightTex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  let brightSize: [number, number] = [0, 0];
  const sizeBright = (w: number, h: number): void => {
    const bw = Math.max(16, Math.round(w / 2));
    const bh = Math.max(16, Math.round(h / 2));
    if (bw === brightSize[0] && bh === brightSize[1]) return;
    brightSize = [bw, bh];
    gl.bindTexture(gl.TEXTURE_2D, brightTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, brightTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const at = (p: WebGLProgram) => {
    const cache = new Map<string, WebGLUniformLocation | null>();
    return (name: string): WebGLUniformLocation | null => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
      return cache.get(name)!;
    };
  };
  const ub = at(bright);
  const uc = at(composite);
  const up = at(points);

  // The skyline and the depth's scale never change: set once.
  gl.useProgram(composite);
  const ridge = new Float32Array(65 * 3);
  plate.ridge.slice(0, 65).forEach((p, i) => ridge.set(p, i * 3));
  gl.uniform3fv(uc("uRidge"), ridge);
  gl.uniform2f(uc("uDepth"), plate.depth.near, plate.depth.far);

  let cssW = 1;
  let cssH = 1;
  let dpr = 1;
  let step = 0;
  let slow = 0;
  let menu = 0;
  let lean: [number, number] = [0, 0];
  let frame = 0;

  const applySize = (): void => {
    const ratio = pixelRatio(dpr, step);
    const w = Math.max(1, Math.round(cssW * ratio));
    const h = Math.max(1, Math.round(cssH * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    sizeBright(w, h);
  };

  const commonUniforms = (
    u: (n: string) => WebGLUniformLocation | null,
    t: number,
    rect: readonly number[],
  ): void => {
    gl.uniform1i(u("uColour"), 0);
    gl.uniform1i(u("uAux"), 1);
    gl.uniform4f(u("uRect"), rect[0], rect[1], rect[2], rect[3]);
    gl.uniform2f(u("uSun"), plate.sun[0], plate.sun[1]);
    gl.uniform2f(u("uSubject"), plate.subject[0], plate.subject[1]);
    gl.uniform1f(u("uT"), t);
  };

  return {
    draw(t, dt, pointer, menuOpen) {
      // The door's framing, eased in; a frozen frame stands at its end.
      const reframe = TITLE_BEATS.reframe / 1000;
      if (opts.fixedScale) menu = menuOpen ? 1 : 0;
      else menu += ((menuOpen ? 1 : -1) * Math.min(dt, 0.1)) / reframe;
      menu = Math.max(0, Math.min(1, menu));
      const ease = 1 - Math.exp(-Math.min(dt, 0.1) * 2.5);
      lean = opts.fixedScale
        ? [0, 0]
        : [lean[0] + (pointer[0] - lean[0]) * ease, lean[1] + (pointer[1] - lean[1]) * ease];
      if (!opts.fixedScale && dt > 0) {
        const next = scaleAfter(step, slow, dt * 1000);
        slow = next.slow;
        if (next.step !== step) {
          step = next.step;
          applySize();
        }
      }
      const w = canvas.width;
      const h = canvas.height;
      const motion = opts.still ? 8 : Math.max(0, t);
      const { rect, parallax } = framingAt(motion, cssW / cssH, plate, menu, lean, opts.still);
      const exposure = t < 0 ? 0 : exposureAt(t);
      frame++;

      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, colourTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, auxTex);

      // PASS ONE: the light, at half resolution, then its mips.
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, brightSize[0], brightSize[1]);
      gl.useProgram(bright);
      commonUniforms(ub, motion, rect);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, brightTex);
      gl.generateMipmap(gl.TEXTURE_2D);

      // PASS TWO: the scene.
      gl.viewport(0, 0, w, h);
      gl.useProgram(composite);
      commonUniforms(uc, motion, rect);
      gl.uniform1i(uc("uBright"), 2);
      gl.uniform2f(uc("uPar"), parallax[0], parallax[1]);
      gl.uniform2f(uc("uPx"), 1 / w, 1 / h);
      gl.uniform1f(uc("uAspect"), cssW / cssH);
      gl.uniform1f(uc("uExposure"), exposure);
      gl.uniform1f(uc("uFrame"), opts.fixedScale ? 0 : frame % 997);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // THE PARTICLES, added over it.
      const counts = particleCounts(cssW, cssH, opts.still);
      const [a, b, c] = counts.snow;
      const total = a + b + c + counts.spray;
      if (total > 0 && exposure > 0) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(points);
        gl.uniform1f(up("uT"), motion);
        gl.uniform3f(up("uLayers"), a, a + b, a + b + c);
        gl.uniform1f(up("uTotal"), total);
        gl.uniform4f(up("uRect"), rect[0], rect[1], rect[2], rect[3]);
        gl.uniform2f(up("uPar"), parallax[0], parallax[1]);
        gl.uniform2f(up("uSun"), plate.sun[0], plate.sun[1]);
        gl.uniform3f(up("uSpray"), plate.spray.uv[0], plate.spray.uv[1], plate.spray.radius);
        gl.uniform2f(up("uSubject"), plate.subject[0], plate.subject[1]);
        gl.uniform2f(up("uViewport"), w, h);
        gl.uniform1f(up("uRatio"), w / cssW);
        gl.uniform1f(up("uExposure"), exposure);
        gl.drawArrays(gl.POINTS, 0, total);
        gl.disable(gl.BLEND);
      }
    },
    resize(width, height, ratio) {
      cssW = Math.max(1, width);
      cssH = Math.max(1, height);
      dpr = ratio;
      applySize();
    },
    dispose() {
      gl.deleteTexture(colourTex);
      gl.deleteTexture(auxTex);
      gl.deleteTexture(brightTex);
      gl.deleteFramebuffer(fbo);
      gl.deleteProgram(bright);
      gl.deleteProgram(composite);
      gl.deleteProgram(points);
      gl.deleteVertexArray(vao);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
