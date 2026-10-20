// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH RENDERER DRAWS THE WORLD, and what it draws without. Three back ends
// can stand under the world renderer (`renderer.ts`):
//
//   webgl      three's WebGLRenderer — the game as it ships: every shader,
//              every pass, every instrument. The default.
//   webgpu     three's WebGPURenderer on a WebGPU device (`gpu-device.ts`),
//              drawing what three's node materials draw out of the box.
//   webgpu-gl  the same WebGPURenderer on its own WebGL2 back end
//              (`forceWebGL`) — what a browser with no WebGPU adapter gets
//              when it asks for `webgpu`, and a way to tell a WebGPU fault
//              from a node-material one on the same machine.
//
// The conversion to WebGPU is done a system at a time (`docs/webgpu.md`).
// Until a system is ported, the webgpu paths DRAW WITHOUT IT: its pass is
// skipped and its custom-shader meshes are hidden (`gpu-quarantine.ts`),
// because WebGPURenderer silently drops `onBeforeCompile` and draws a
// `ShaderMaterial` as a bare node material — a picture that lies rather than
// one with a hole in it. `GPU_PORTS` is the register: a port flips its row's
// `ported`, and the renderer runs the pass again on every back end.
//
// DOM-free and three-free: `tests/gpu_backend_test.ts` reads it on plain
// Node, and the app's main bundle reads it without pulling in three.

/** A back end the world renderer can stand on. */
export type Backend = "webgl" | "webgpu" | "webgpu-gl";
export const BACKENDS: readonly Backend[] = ["webgl", "webgpu", "webgpu-gl"];
/** What a visit draws on when nothing names one. */
export const DEFAULT_BACKEND: Backend = "webgl";

export const isBackend = (value: unknown): value is Backend =>
  typeof value === "string" && (BACKENDS as readonly string[]).includes(value);

/** A link's `?renderer=` word, or null where it names none this build has. */
export function readBackend(value: string | null | undefined): Backend | null {
  return isBackend(value) ? value : null;
}

/** The back end a visit asks for: the link's word over the default. */
export const chooseBackend = (asked: Backend | null): Backend => asked ?? DEFAULT_BACKEND;

/** Whether a back end is three's WebGPURenderer (either of its back ends). */
export const onNodeRenderer = (backend: Backend): boolean => backend !== "webgl";

/** One system a WebGPU port has to carry across: a render PASS the frame
 * runs (skipped on the webgpu paths until ported), or a family of custom
 * MATERIALS (hidden there until ported — the flag a material carries is its
 * `id`, `glslOnly` in `gpu-quarantine.ts`). `part` is the plan's PR. */
export type GpuPort = {
  id: string;
  kind: "pass" | "material";
  part: number;
  what: string;
  ported: boolean;
};

/** THE REGISTER, in the plan's order (`docs/webgpu.md` keeps the ledger). */
export const GPU_PORTS: readonly GpuPort[] = [
  { id: "sky-gpu", kind: "pass", part: 3, what: "the sky's LUT passes", ported: true },
  {
    id: "clouds",
    kind: "pass",
    part: 10,
    what: "the cloud shadow, the slab and the volume",
    ported: false,
  },
  {
    id: "trail-map",
    kind: "pass",
    part: 5,
    what: "the trail maps' stamps and fill",
    ported: true,
  },
  { id: "deform", kind: "pass", part: 5, what: "the deformable snow's field", ported: true },
  {
    id: "hero-shadow",
    kind: "pass",
    part: 6,
    what: "the skiers' own shadow atlas",
    ported: true,
  },
  {
    // WebGL's own economy (a depth program a kind of caster, the opaque
    // list grouped by material): the node renderer keys its shadow
    // pipelines by the caster already, so nothing replaces it, and it goes
    // with the GLSL (part 16).
    id: "shadow-depth",
    kind: "pass",
    part: 16,
    what: "WebGL's sun-map depth by kind and opaque sort, not needed on the node renderer",
    ported: false,
  },
  {
    id: "env-warm",
    kind: "pass",
    part: 6,
    what: "the first frame's shaders compiled behind the card",
    ported: true,
  },
  {
    id: "grade-pass",
    kind: "pass",
    part: 7,
    what: "the region's grade over the frame",
    ported: false,
  },
  {
    id: "snow-under",
    kind: "pass",
    part: 14,
    what: "the skis-under-the-snow probe",
    ported: false,
  },
  {
    id: "trail-overlay",
    kind: "pass",
    part: 14,
    what: "the developer's trail corner",
    ported: false,
  },
  { id: "gpu-timer", kind: "pass", part: 14, what: "the GPU's timer and the fence", ported: false },
  {
    id: "haze",
    kind: "material",
    part: 2,
    what: "a hazed material's haze, key, shade lift and lamps; the glow's fade",
    ported: true,
  },
  {
    id: "sky",
    kind: "material",
    part: 3,
    what: "the dome, the far ranges and the sky's passes, each drawn by its node twin",
    ported: true,
  },
  {
    id: "shader",
    kind: "material",
    part: 9,
    what: "every other ShaderMaterial (the spray first; the clouds, the rest in theirs)",
    ported: false,
  },
  {
    id: "terrain",
    kind: "material",
    part: 4,
    what: "the ground's clipmap and snow, drawn by its node twin",
    ported: true,
  },
  {
    id: "forest-batch",
    kind: "material",
    part: 8,
    what: "the woods' multi-draw batches",
    ported: false,
  },
  {
    id: "haze-graft",
    kind: "material",
    part: 11,
    what: "a hazed material with a graft of its own (the figures' gaits, the rock…)",
    ported: false,
  },
  {
    id: "model-merged",
    kind: "material",
    part: 12,
    what: "the merged models' per-vertex paint",
    ported: false,
  },
  { id: "wingsuit", kind: "material", part: 12, what: "the wingsuit's paint", ported: false },
  { id: "gore-tree", kind: "material", part: 11, what: "the blooded tree", ported: false },
];

/** Whether the frame runs pass `id` on `backend`: always on WebGL, on the
 * webgpu paths once its row is ported. An id not in the register is a pass
 * nobody has to port, and runs. */
export function runsPass(backend: Backend, id: string): boolean {
  if (!onNodeRenderer(backend)) return true;
  const row = GPU_PORTS.find((p) => p.id === id);
  return row ? row.ported : true;
}

/** The passes `backend` draws the frame without, in the register's order. */
export function skippedPasses(backend: Backend): string[] {
  return GPU_PORTS.filter((p) => p.kind === "pass" && !runsPass(backend, p.id)).map((p) => p.id);
}

/** Whether a material family is still hidden on the webgpu paths. */
export function quarantinedOn(backend: Backend, id: string): boolean {
  if (!onNodeRenderer(backend)) return false;
  const row = GPU_PORTS.find((p) => p.id === id);
  return row ? !row.ported : true;
}

/** Flag `target` (a material or an object) as drawn by GLSL the webgpu
 * paths cannot run, in family `family` of `GPU_PORTS` — hidden there
 * (`gpu-quarantine.ts`) until that row is ported. */
export function glslOnly<T extends { userData: Record<string, unknown> }>(
  target: T,
  family: string,
): T {
  target.userData.glsl = family;
  return target;
}

/** Flag a ShaderMaterial as drawn on the webgpu paths by node twin `twin`
 * (`sky-twins-tsl.ts`): its GLSL is WebGL's, and the node renderer's
 * library hands the twin in its place, reading the same uniforms. Its
 * family is `family`'s row of `GPU_PORTS`, hidden until that is ported. */
export function nodeTwin<T extends { userData: Record<string, unknown> }>(
  material: T,
  family: string,
  twin: string,
): T {
  material.userData.twin = twin;
  return glslOnly(material, family);
}

/** WHAT DREW THE FRAME, for the developer page and the benchmark's report. */
export type BackendState = {
  /** What the visit asked for (`?renderer=`). */
  asked: Backend;
  /** What actually runs: `webgpu` asked on a browser with no adapter runs
   * `webgpu-gl`. */
  running: Backend;
  /** The passes skipped (`skippedPasses`). */
  skipped: string[];
  /** The meshes hidden on the last frame, by family and where they hang
   * (`gpu-quarantine.ts`), e.g. `{ "shader:sky": 1 }`. */
  quarantined: Record<string, number>;
  /** Render pipelines three holds (the webgpu paths; 0 on WebGL, whose
   * count is the frame cost's programs). */
  pipelines: number;
  /** What the adapter calls itself, where the browser says. */
  adapter: string;
  /** Why the device went, once it has. */
  lost: string | null;
};

/** The state of a renderer that has drawn nothing on `backend` yet. */
export function freshBackend(asked: Backend, running: Backend = asked): BackendState {
  return {
    asked,
    running,
    skipped: skippedPasses(running),
    quarantined: {},
    pipelines: 0,
    adapter: "",
    lost: null,
  };
}

/** The state as report lines: what ran, what it skipped, what it hid. */
export function backendLines(state: BackendState): string[] {
  const ran =
    state.asked === state.running ? state.running : `${state.running} (asked ${state.asked})`;
  const head = [ran, state.adapter, state.pipelines > 0 ? `${state.pipelines} pipelines` : ""];
  const out = [`RENDERER ${head.filter((s) => s !== "").join(" · ")}`];
  if (state.lost) out.push(`  DEVICE LOST ${state.lost}`);
  if (state.skipped.length > 0) out.push(`  SKIPPED ${state.skipped.join(" · ")}`);
  const hid = Object.entries(state.quarantined).sort((a, b) => b[1] - a[1]);
  if (hid.length > 0) {
    out.push(`  QUARANTINED ${hid.map(([k, n]) => `${k} ×${n}`).join(" · ")}`);
  }
  return out;
}

declare global {
  /** Which back end the page's world renderer runs (`docs/webgpu.md`):
   * what a lab asserts it got (`scripts/lib/backend-flag.mjs`). */
  var __SH_BACKEND__: Backend | undefined;
}
