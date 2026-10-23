// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE `--renderer=` LAB FLAG, once for every browser lab: which back end the
// page draws the world on (`pwa/src/game/gpu-backend.ts`, `docs/webgpu.md`),
// turned into the three things a lab needs — the query parameter the page
// reads (`?renderer=`), the Chromium switches that back end needs here, and
// the check that the page really drew on it.
//
// WEBGPU IN A HEADLESS CONTAINER. Chromium offers no WebGPU adapter without
// a GPU unless told to: `--enable-unsafe-webgpu` lets it out on Linux,
// `--enable-features=Vulkan` puts Dawn on its Vulkan back end, and
// `--use-webgpu-adapter=swiftshader` hands it the software Vulkan adapter.
// That much makes a device, and the device is LOST ("a valid external
// Instance reference no longer exists") the moment a canvas is configured
// on it — off-screen work survives, presenting does not — unless the GPU
// process's own Vulkan is SwiftShader too (`--use-vulkan=swiftshader`,
// beside ANGLE on SwiftShader for the compositor). Like SwiftShader's
// WebGL, it is a statement about STRUCTURE (draw calls, pipelines, what is
// drawn) and never a phone's milliseconds. On a host GPU (`--gpu`) the
// adapter is the card's own.
//
// THE CHECK IS THE POINT. A page asked for `webgpu` that finds no adapter
// draws on three's WebGL2 back end and says so (`__SH_BACKEND__` is
// `webgpu-gl`) — a lab that did not look would report WebGL numbers as
// WebGPU ones. `assertBackend` fails the lab instead.
//
// A LAB DRAWS ON WEBGL UNLESS ASKED (part 15). The game's own default is
// `auto` (WebGPU where the device has it, else `webgpu-gl`), but every lab's
// flag stays `webgl`: its pictures are the ones it took before the flip, to
// the byte, and SwiftShader's WebGPU spends seconds on a frame. A lab that
// drives the built site names the back end in its link even for WebGL,
// since the site would otherwise pick `auto`. `--renderer=auto` asks for
// what a player gets: the WebGPU switches are passed, and the check takes
// either node back end and says which.

import process from "node:process";

/** The back ends a page can be asked for — `BACKEND_ASKS` in `gpu-backend.ts`. */
export const RENDERERS = ["webgl", "webgpu", "webgpu-gl", "auto"];

/** The flag's entry for a `parseArgs` table. `both` and `all` are for a
 * lab that runs the same plan on several (`make bench ARGS=--renderer=both`). */
export function rendererFlag(several = false) {
  return {
    kind: "string",
    default: "webgl",
    help: `the back end the world is drawn on (${RENDERERS.join(", ")}${several ? ", both: webgl and webgpu, all" : ""}) — ?renderer=`,
  };
}

/** The back ends a flag's value names, in order; exits on an unknown one. */
export function renderersOf(value, several = false) {
  const list =
    several && value === "both"
      ? ["webgl", "webgpu"]
      : several && value === "all"
        ? RENDERERS.filter((r) => r !== "auto") // `auto` is one of the node two
        : String(value ?? "webgl").split(",");
  for (const r of list) {
    if (!RENDERERS.includes(r) || (!several && list.length > 1)) {
      console.error(
        `unknown --renderer "${value}" (${RENDERERS.join(", ")}${several ? ", both, all" : ""})`,
      );
      process.exit(2);
    }
  }
  return list;
}

/** The Chromium switches drawing on `renderers` needs, beside the lab's
 * own; `gpu` when the lab draws on the host's GPU rather than SwiftShader. */
export function rendererArgs(renderers, gpu = false) {
  const list = Array.isArray(renderers) ? renderers : [renderers];
  if (!list.includes("webgpu") && !list.includes("auto")) return [];
  if (gpu) return ["--enable-unsafe-webgpu", "--enable-features=Vulkan"];
  return [
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ];
}

/** The query parameters for `renderer`, to lay over the lab's own. */
export function rendererQuery(renderer) {
  return { renderer };
}

/** `url` with `?renderer=` laid over its query, unless WebGL is asked (the
 * default, so a WebGL lab's link is the one it always was). */
export function rendererUrl(url, renderer) {
  if (!renderer || renderer === "webgl") return url;
  const [head, hash = ""] = String(url).split("#");
  const sep = head.includes("?") ? (head.endsWith("?") ? "" : "&") : "?";
  return `${head}${sep}renderer=${encodeURIComponent(renderer)}${hash ? `#${hash}` : ""}`;
}

/** Wait for the page's back end to be reported, and fail unless it is the
 * one asked for. Returns the name. */
export async function assertBackend(page, asked, timeoutMs = 120_000) {
  await page.waitForFunction(() => typeof globalThis.__SH_BACKEND__ === "string", null, {
    timeout: timeoutMs,
  });
  const running = await page.evaluate(() => globalThis.__SH_BACKEND__);
  if (asked === "auto" && (running === "webgpu" || running === "webgpu-gl")) {
    console.log(`  auto drew on ${running}`);
    return running;
  }
  if (running !== asked) {
    throw new Error(`asked for the ${asked} back end and the page drew on ${running}`);
  }
  return running;
}
