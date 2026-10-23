// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WEBGPU DEVICE, and the node renderer made on it (`render-seam.ts`'s
// factory). Fetched on its own only when a visit asks for a webgpu path
// (`gpu-backend.ts`, `?renderer=`), so the WebGL build never loads three's
// node half: `prepareGpu` is awaited before the world renderer is made
// (`renderer.ts`'s `loadModels`), and installs the factory it makes with.
//
// THE DEVICE IS ASKED FOR WHAT THE ADAPTER HAS. A device made without
// `requiredLimits` gets WebGPU's defaults — sixteen sampled textures a
// stage, 128 MiB buffers — whatever the card under it offers; the snow's
// shaders will want more than sixteen textures on the machines that have
// them. So every limit below is raised to the adapter's own, and every
// feature below that the adapter has is turned on.
//
// THE SWIZZLE SHIM. three r186 hands `GPUTexture.createView` a `swizzle`
// of `"rgba"` — the identity — and a browser that does not know the member's
// type (Chromium 141 among them) rejects the whole view. The identity is
// what a view does with no swizzle at all, so the shim drops it.
//
// NO DEVICE: `auto` or `webgpu` asked on a browser without an adapter (or
// with WebGPU switched off) runs three's WebGL2 back end instead —
// `webgpu-gl`, said as such in `__SH_BACKEND__` and the report, never passed
// off as WebGPU. So does a device that cannot draw on a canvas: before the
// renderer is made the device clears a canvas of its own and waits for it
// (`canPresent`), because a device can be handed out and then LOST the
// moment a canvas is configured on it (a software adapter beside a GPU
// process that has none, `scripts/lib/backend-flag.mjs`), which would leave
// a black page.
//
// A DEVICE LOST LATER, on `auto`: before the run's first frame, the page is
// loaded again on the WebGL2 back end (`fallBack`); after it, the next load
// of the tab is. Either way the tab remembers (`sessionStorage`), so it never
// loops, and the report says DEVICE LOST.

import type * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

import { freshBackend, type Backend, type BackendAsk } from "./gpu-backend.ts";
import { dressScene, type Dressing } from "./gpu-dress.ts";
import type { HazeUniforms } from "./haze.ts";
import { createNodeTimer, type TimedRenderer } from "./gpu-timer-node.ts";
import { nodeGradePass } from "./grade-tsl.ts";
import "./node-fixes-tsl.ts";
import { CANVAS_SAMPLES } from "./region-picture.ts";
import { setSeamFactory, type RenderSeam, type SeamInfo } from "./render-seam.ts";

/** The limits raised to the adapter's own. */
const LIMITS = [
  "maxTextureDimension2D",
  "maxSampledTexturesPerShaderStage",
  "maxSamplersPerShaderStage",
  "maxStorageBufferBindingSize",
  "maxBufferSize",
  "maxUniformBufferBindingSize",
  "maxVertexAttributes",
  "maxColorAttachmentBytesPerSample",
  "maxStorageBuffersPerShaderStage",
  "maxComputeWorkgroupStorageSize",
] as const;

/** The features turned on where the adapter has them (and every
 * `texture-compression-*` it has). */
const FEATURES = [
  "core-features-and-limits",
  "shader-f16",
  "timestamp-query",
  "float32-filterable",
  // The woods' one indirect draw a pass (`forest-indirect.ts`).
  "indirect-first-instance",
] as const;

/** What a WebGL2 context is guaranteed to hold, px — the webgpu-gl path's
 * texture cap before its context exists. */
const WEBGL2_TEXTURE = 4096;

/** A node back end a visit can ask the device for. */
type NodeAsk = Exclude<BackendAsk, "webgl">;

type Prepared = { device: GPUDevice | null; adapter: string; lost: { why: string | null } };
let prepared: Promise<Prepared> | null = null;
let shimmed = false;

/** No device: the node renderer's WebGL2 back end. */
const NO_DEVICE = (): Prepared => ({ device: null, adapter: "", lost: { why: null } });

/** The tab's memory of a WebGPU device that failed it (see the header). */
const FELL_BACK = "fall-line.gpu-fell-back";

function fellBack(): boolean {
  try {
    return sessionStorage.getItem(FELL_BACK) !== null;
  } catch {
    return false;
  }
}

/** Remember that WebGPU failed this tab, and why; `reload` loads the page
 * again so it draws on the WebGL2 back end now. */
function fallBack(why: string, reload: boolean): void {
  try {
    sessionStorage.setItem(FELL_BACK, why);
  } catch {
    return; // nowhere to remember it: a reload would only loop
  }
  if (reload && typeof location !== "undefined") location.reload();
}

/** How long the probe waits for the device to clear its canvas, ms. */
const PROBE_MS = 4000;

/** WHETHER THE DEVICE CAN DRAW ON A CANVAS: one canvas of its own
 * configured, cleared and waited for, with a breath after for a loss the
 * configure set off. False when anything fails or the device is lost. */
async function canPresent(device: GPUDevice, lost: { why: string | null }): Promise<boolean> {
  if (typeof document === "undefined") return true; // a worker draws on no canvas
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 4;
    const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
    if (!context) return false;
    context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: "opaque",
    });
    device.pushErrorScope("validation");
    const encoder = device.createCommandEncoder();
    encoder
      .beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      })
      .end();
    device.queue.submit([encoder.finish()]);
    const error = await device.popErrorScope();
    const wait = (ms: number) => new Promise<"slow">((done) => setTimeout(() => done("slow"), ms));
    const done = await Promise.race([
      device.queue.onSubmittedWorkDone().then(() => "done" as const),
      device.lost.then(() => "lost" as const),
      wait(PROBE_MS),
    ]);
    if (done === "done") await wait(100);
    context.unconfigure();
    return error === null && done === "done" && lost.why === null;
  } catch {
    return false;
  }
}

/** Drop the identity swizzle three passes (see the header). */
function shimSwizzle(): void {
  if (shimmed || typeof GPUTexture === "undefined") return;
  shimmed = true;
  const proto = GPUTexture.prototype;
  const createView = proto.createView;
  proto.createView = function (this: GPUTexture, descriptor?: GPUTextureViewDescriptor) {
    const d = descriptor as (GPUTextureViewDescriptor & { swizzle?: string }) | undefined;
    if (d?.swizzle === "rgba") {
      const rest = { ...d };
      delete rest.swizzle;
      return createView.call(this, rest);
    }
    return createView.call(this, descriptor);
  };
}

/** The adapter's device, asked for its own limits and features — or none. */
async function requestDevice(): Promise<Prepared> {
  const lost = { why: null as string | null };
  const gpu = typeof navigator !== "undefined" ? navigator.gpu : undefined;
  const adapter = gpu ? await gpu.requestAdapter({ powerPreference: "high-performance" }) : null;
  if (!adapter) return { device: null, adapter: "", lost };
  shimSwizzle();
  const requiredLimits: Record<string, number> = {};
  for (const name of LIMITS) {
    const value = adapter.limits[name];
    if (typeof value === "number") requiredLimits[name] = value;
  }
  const requiredFeatures: GPUFeatureName[] = [];
  for (const name of adapter.features) {
    const f = name as GPUFeatureName;
    if ((FEATURES as readonly string[]).includes(name) || name.startsWith("texture-compression-"))
      requiredFeatures.push(f);
  }
  const device = await adapter.requestDevice({ requiredLimits, requiredFeatures });
  void device.lost.then((info) => {
    lost.why = `${info.reason}: ${info.message}`;
    if (info.reason !== "destroyed") prepared = null; // the next renderer asks for a new one
  });
  if (!(await canPresent(device, lost))) {
    device.destroy();
    return NO_DEVICE();
  }
  const info = adapter.info;
  const name = [info.vendor, info.architecture, info.device, info.description]
    .filter((s) => s)
    .join(" ");
  return { device, adapter: name, lost };
}

/** Make ready to draw on `asked` (a webgpu path): the device, then the
 * factory every world renderer from here on is made by. */
export async function prepareGpu(asked: NodeAsk): Promise<void> {
  const { device, adapter, lost } = await deviceFor(asked);
  const running: Backend = device ? "webgpu" : "webgpu-gl";
  setSeamFactory((canvas, options) =>
    gpuSeam(canvas, options, asked, running, device, adapter, lost),
  );
}

/** The device `asked` draws on: the adapter's, or none for the WebGL2 back
 * end (asked for, no adapter, a device that cannot present, or `auto` in a
 * tab WebGPU has already failed). Asked for once and shared. */
function deviceFor(asked: NodeAsk): Promise<Prepared> {
  if (asked === "webgpu-gl" || (asked === "auto" && fellBack())) {
    return Promise.resolve(NO_DEVICE());
  }
  return (prepared ??= requestDevice().catch(NO_DEVICE));
}

/** The canvas's viewport and scissor counted from the BOTTOM, as WebGL's:
 * a page of its own lays its cells out that way (`setViewport(x, y, …)`
 * with y up), and the node renderer counts the canvas's from the top. */
function bottomUp(renderer: WebGPURenderer): void {
  type Box = (x: number | THREE.Vector4, y?: number, w?: number, h?: number) => void;
  // A Vector2 as far as `getSize` writes one (three's core is not imported here).
  const at = {
    x: 0,
    y: 0,
    set(x: number, y: number) {
      at.x = x;
      at.y = y;
      return at;
    },
  };
  const size = at as unknown as THREE.Vector2;
  const flip = (inner: Box): Box =>
    function (x, y, w, h) {
      if (typeof x !== "number") return inner(x.x, flipped(x.y, x.w), x.z, x.w);
      return inner(x, flipped(y ?? 0, h ?? 0), w, h);
    };
  const flipped = (y: number, h: number): number => {
    renderer.getSize(size);
    return at.y - y - h;
  };
  const r = renderer as unknown as { setViewport: Box; setScissor: Box };
  r.setViewport = flip(renderer.setViewport.bind(renderer) as Box);
  r.setScissor = flip(renderer.setScissor.bind(renderer) as Box);
}

/** A NODE RENDERER OF ITS OWN (`own-gpu.ts`): a lab's or the gear stage's,
 * on the shared device, every scene it draws dressed the first time
 * (`gpu-dress.ts`) and brought up to the frame each draw. */
export async function ownRenderer(
  canvas: HTMLCanvasElement,
  options: { antialias: boolean },
  asked: NodeAsk,
  haze: HazeUniforms,
): Promise<{ renderer: WebGPURenderer; running: Backend; settled: () => Promise<void> }> {
  const { device } = await deviceFor(asked);
  const renderer = new WebGPURenderer({
    canvas,
    antialias: options.antialias,
    alpha: false,
    forceWebGL: device === null,
    ...(device ? { device } : {}),
  });
  await renderer.init();
  const dressed = new WeakMap<object, Dressing>();
  const draw = renderer.render.bind(renderer);
  renderer.render = (scene, camera) => {
    let d = dressed.get(scene);
    if (!d && (scene as THREE.Scene).isScene) {
      dressed.set(scene, (d = dressScene(renderer, scene as THREE.Scene, haze, device)));
    }
    d?.begin();
    draw(scene, camera);
    d?.end();
  };
  bottomUp(renderer);
  const running: Backend = device ? "webgpu" : "webgpu-gl";
  globalThis.__SH_BACKEND__ = running;
  const settled = (): Promise<void> =>
    device ? device.queue.onSubmittedWorkDone() : glSettled(renderer);
  return { renderer, running, settled };
}

function gpuSeam(
  canvas: HTMLCanvasElement,
  options: { antialias: boolean },
  asked: BackendAsk,
  running: Backend,
  device: GPUDevice | null,
  adapter: string,
  lost: { why: string | null },
): RenderSeam {
  const renderer = new WebGPURenderer({
    canvas,
    antialias: options.antialias,
    alpha: false, // the canvas opaque, as the WebGL one is made
    powerPreference: "high-performance",
    forceWebGL: device === null,
    ...(device ? { device } : {}),
  });
  // Counted a frame at a time by the seam: three resets on its own only
  // inside its animation loop, which the app does not use.
  renderer.info.autoReset = false;
  const state = freshBackend(asked, running);
  state.adapter = adapter;
  let dressing: Dressing | null = null;
  /** Whether a frame has been drawn whole (`endFrame`, the warm-up's first): a loss
   * before it is a load that failed (see the header). */
  let started = false;
  const ready = renderer.init().then(
    () => {
      globalThis.__SH_BACKEND__ = running;
    },
    (error: unknown) => {
      if (asked === "auto" && device) fallBack(`init: ${String(error)}`, true);
      throw error;
    },
  );
  if (asked === "auto" && device) {
    void device.lost.then((info) => {
      if (info.reason !== "destroyed") fallBack(`${info.reason}: ${info.message}`, !started);
    });
  }
  const pipelines = renderer as unknown as { _pipelines?: { caches?: Map<string, unknown> } };
  const info: SeamInfo = {
    calls: 0,
    triangles: 0,
    points: 0,
    programs: 0,
    geometries: 0,
    textures: 0,
  };
  return {
    gl: renderer as unknown as RenderSeam["gl"],
    native: false,
    ready,
    state,
    maxTextureSize: () => device?.limits.maxTextureDimension2D ?? WEBGL2_TEXTURE,
    dress(scene, haze) {
      dressing = dressScene(renderer, scene, haze, device);
    },
    beginFrame() {
      renderer.info.reset();
      dressing?.begin();
    },
    post: {
      canvas: options.antialias ? CANVAS_SAMPLES : 0,
      grade: (u) =>
        nodeGradePass(renderer, u, () => {
          const rays = dressing?.rays();
          return rays ? (seen) => rays.shade(seen) : null;
        }),
      rays: () => dressing?.rays() ?? null,
      hazeInDisplay: (on) => dressing?.hazeInDisplay(on),
      info: () => {
        const r = renderer.info.render;
        return { calls: r.drawCalls, triangles: r.triangles, points: r.points };
      },
    },
    woods: () => dressing?.woods ?? null,
    endFrame() {
      started = true;
      dressing?.end();
    },
    settled: () => (device ? device.queue.onSubmittedWorkDone() : glSettled(renderer)),
    timer: (mode) => createNodeTimer(renderer as unknown as TimedRenderer, mode),
    fence() {
      if (!device) return null;
      const at = performance.now();
      return device.queue.onSubmittedWorkDone().then(() => performance.now() - at);
    },
    drainContext: () => (device ? null : (backendGl(renderer) ?? null)),
    info() {
      const r = renderer.info.render;
      const m = renderer.info.memory;
      info.calls = r.drawCalls;
      info.triangles = r.triangles;
      info.points = r.points;
      info.programs = m.programs;
      info.geometries = m.geometries;
      info.textures = m.textures;
      state.pipelines = pipelines._pipelines?.caches?.size ?? 0;
      state.lost = lost.why;
      return info;
    },
    dispose() {
      renderer.dispose();
    },
  };
}

/** The WebGL back end's queue drained: a fence, polled a frame apart so the
 * loading card keeps drawing while the driver works. */
function glSettled(renderer: WebGPURenderer): Promise<void> {
  const gl = backendGl(renderer);
  const sync = gl?.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!gl || !sync) return Promise.resolve();
  gl.flush();
  return new Promise((done) => {
    const poll = (): void => {
      if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) return void setTimeout(poll, 16);
      gl.deleteSync(sync);
      done();
    };
    poll();
  });
}

/** The node renderer's WebGL2 back end's context, or undefined on WebGPU. */
function backendGl(renderer: WebGPURenderer): WebGL2RenderingContext | undefined {
  return (renderer.backend as unknown as { gl?: WebGL2RenderingContext }).gl;
}
