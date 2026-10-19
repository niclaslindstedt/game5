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
// NO ADAPTER: `webgpu` asked on a browser without one (or with WebGPU
// switched off) runs three's WebGL2 back end instead — `webgpu-gl`, said as
// such in `__SH_BACKEND__` and the report, never passed off as WebGPU.

import { WebGPURenderer } from "three/webgpu";

import { freshBackend, type Backend } from "./gpu-backend.ts";
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
] as const;

/** What a WebGL2 context is guaranteed to hold, px — the webgpu-gl path's
 * texture cap before its context exists. */
const WEBGL2_TEXTURE = 4096;

type Prepared = { device: GPUDevice | null; adapter: string; lost: { why: string | null } };
let prepared: Promise<Prepared> | null = null;
let shimmed = false;

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
    prepared = null; // the next renderer asks for a new one
  });
  const info = adapter.info;
  const name = [info.vendor, info.architecture, info.device, info.description]
    .filter((s) => s)
    .join(" ");
  return { device, adapter: name, lost };
}

/** Make ready to draw on `asked` (a webgpu path): the device, then the
 * factory every world renderer from here on is made by. */
export async function prepareGpu(asked: Exclude<Backend, "webgl">): Promise<void> {
  const ready =
    asked === "webgpu"
      ? (prepared ??= requestDevice().catch(() => ({
          device: null,
          adapter: "",
          lost: { why: null },
        })))
      : Promise.resolve<Prepared>({ device: null, adapter: "", lost: { why: null } });
  const { device, adapter, lost } = await ready;
  const running: Backend = device ? "webgpu" : "webgpu-gl";
  setSeamFactory((canvas, options) =>
    gpuSeam(canvas, options, asked, running, device, adapter, lost),
  );
}

function gpuSeam(
  canvas: HTMLCanvasElement,
  options: { antialias: boolean },
  asked: Backend,
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
  const ready = renderer.init().then(() => {
    globalThis.__SH_BACKEND__ = running;
  });
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
    beginFrame: () => renderer.info.reset(),
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
