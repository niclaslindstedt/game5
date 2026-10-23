// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH RENDERER DRAWS THE WORLD, and what it draws without. Three back ends
// can stand under the world renderer (`renderer.ts`):
//
//   webgl      three's WebGLRenderer — the game as it was drawn before the
//              port, every shader in GLSL. The way back (`?renderer=webgl`,
//              or DEVELOPER ▸ RENDERER).
//   webgpu     three's WebGPURenderer on a WebGPU device (`gpu-device.ts`).
//   webgpu-gl  the same WebGPURenderer on its own WebGL2 back end
//              (`forceWebGL`) — what a browser with no WebGPU device gets,
//              and a way to tell a WebGPU fault from a node-material one on
//              the same machine.
//
// THE GAME ASKS FOR `auto` (part 15, `docs/webgpu.md`): WebGPU where the
// browser hands out an adapter and a device that can draw on a canvas, the
// node renderer's WebGL2 back end where it does not. A LAB PAGE draws on
// WebGL unless its link names a back end (`pageBackend`), so a lab's
// pictures stay the pictures they were and `--renderer=` asks for the rest.
//
// The conversion was done a system at a time. A system not yet ported is
// DRAWN WITHOUT on the webgpu paths: its pass is skipped and its custom-
// shader meshes are hidden (`gpu-quarantine.ts`), because WebGPURenderer
// silently drops `onBeforeCompile` and draws a `ShaderMaterial` as a bare
// node material — a picture that lies rather than one with a hole in it.
// `GPU_PORTS` is the register: a port flips its row's `ported`, and the
// renderer runs the pass again on every back end.
//
// DOM-free and three-free: `tests/gpu_backend_test.ts` reads it on plain
// Node, and the app's main bundle reads it without pulling in three.

/** A back end the world renderer can stand on. */
export type Backend = "webgl" | "webgpu" | "webgpu-gl";
export const BACKENDS: readonly Backend[] = ["webgl", "webgpu", "webgpu-gl"];
/** What a visit can ASK for: a back end, or `auto` — WebGPU where the
 * device has it, else the node renderer's WebGL2 back end. */
export type BackendAsk = Backend | "auto";
export const BACKEND_ASKS: readonly BackendAsk[] = ["auto", ...BACKENDS];
/** What the game asks for when neither the link nor the setting names one. */
export const DEFAULT_BACKEND: BackendAsk = "auto";
/** What a lab page draws on when its link names nothing. */
export const LAB_BACKEND: Backend = "webgl";

export const isBackend = (value: unknown): value is Backend =>
  typeof value === "string" && (BACKENDS as readonly string[]).includes(value);

export const isBackendAsk = (value: unknown): value is BackendAsk =>
  typeof value === "string" && (BACKEND_ASKS as readonly string[]).includes(value);

/** A link's `?renderer=` word, or null where it names none this build has. */
export function readBackend(value: string | null | undefined): BackendAsk | null {
  return isBackendAsk(value) ? value : null;
}

/** What the game asks for: the link's word, over the stored setting
 * (DEVELOPER ▸ RENDERER), over the default. */
export const chooseBackend = (
  link: BackendAsk | null,
  stored: BackendAsk | null = null,
): BackendAsk => link ?? stored ?? DEFAULT_BACKEND;

/** The game's own ask once the app has made it (`setVisitBackend`), so a
 * renderer made later on the same page (the gear stage) asks for the same.
 * Null on a lab page. */
let visit: BackendAsk | null = null;

/** The app's ask for this visit (`use-render-kit.ts`); null forgets it. */
export function setVisitBackend(ask: BackendAsk | null): void {
  visit = ask;
}

/** What a renderer made on this page asks for: the link's word, else the
 * game's ask, else a lab's WebGL. */
export function pageBackend(search: string): BackendAsk {
  return readBackend(new URLSearchParams(search).get("renderer")) ?? visit ?? LAB_BACKEND;
}

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
    what: "the cloud shadow, the slab and the volume, each pass drawn by its node twin",
    ported: true,
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
    ported: true,
  },
  {
    id: "snow-under",
    kind: "pass",
    part: 14,
    what: "the skis-under-the-snow probe, its depth copied by its node twin and read back waited for",
    ported: true,
  },
  {
    id: "trail-overlay",
    kind: "pass",
    part: 14,
    what: "the developer's trail corner, drawn by its node twin",
    ported: true,
  },
  {
    id: "gpu-timer",
    kind: "pass",
    part: 14,
    what: "the GPU's timer (timestamp queries) and the fence (the device's queue)",
    ported: true,
  },
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
    id: "particles",
    kind: "material",
    part: 9,
    what: "the spray, the snowfall and spindrift, the snow cloud and its shadow, the billboards, the sparks, the plumes",
    ported: true,
  },
  {
    // THE GUARD: every ShaderMaterial with no twin. None is left — the
    // effects', the props' and the gear stage's backdrop draw by their
    // twins (the `effects` and `props` rows) — so it hides nothing, and
    // stays to hide one added before its twin until the GLSL goes (16).
    id: "shader",
    kind: "material",
    part: 16,
    what: "a ShaderMaterial with no node twin (none is left; the guard for one added before its port)",
    ported: false,
  },
  {
    id: "effects",
    kind: "material",
    part: 12,
    what: "the rotors' smear, the lift's fade, the balloon's flame, the burn and the X-ray, each drawn by its node twin",
    ported: true,
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
    what: "the woods' multi-draw batches, drawn shape by shape instanced on the node renderer",
    ported: true,
  },
  {
    id: "figures",
    kind: "material",
    part: 11,
    what: "the crowd, the people on foot, the dogs, the traffic, the fans, the birds and the animals, each drawn by its figure twin",
    ported: true,
  },
  {
    // THE GUARD for grafts: the figures' draw by their twins (the
    // `figures` row), the skier's, the machines' and the cloths' by theirs
    // (`model-merged`, `skier`, `wingsuit`, `cloth`), the props' and the
    // gear stage's by theirs (`props`). The game's scene has none left; a
    // graft added before its port is hidden here until the GLSL goes (16).
    id: "haze-graft",
    kind: "material",
    part: 16,
    what: "a hazed material with a graft no port draws (none is left; the guard for one added before its port)",
    ported: false,
  },
  {
    id: "model-merged",
    kind: "material",
    part: 12,
    what: "the merged models' metal, roughness and coat off the vertices, drawn by their node graft",
    ported: true,
  },
  {
    id: "skier",
    kind: "material",
    part: 12,
    what: "the posed figure's normals, the dressed kit's flutter, the X-ray's dissolve and a cut ski's planes, drawn by their node grafts",
    ported: true,
  },
  {
    id: "wingsuit",
    kind: "material",
    part: 12,
    what: "the wingsuit's paint, drawn by its node graft",
    ported: true,
  },
  {
    id: "cloth",
    kind: "material",
    part: 12,
    what: "the balloon's envelope, the canopies and the paramotor's lines, drawn by their node grafts",
    ported: true,
  },
  {
    id: "props",
    kind: "material",
    part: 13,
    what: "the buildings, the rooms, the crags, the signs, the water, the grass, the flags, the slab's plates, the piste lights and the fires, each drawn by its node graft or twin",
    ported: true,
  },
  {
    id: "gore-tree",
    kind: "material",
    part: 11,
    what: "the blooded tree, drawn by its figure twin",
    ported: true,
  },
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
  own = false,
): T {
  material.userData.twin = twin;
  // A key of its own, where several materials share one shader but not
  // their uniforms (the billboards' batches): the node renderer keys a
  // program by the material's own fields (never `userData`), and would
  // otherwise draw them all with the first one's twin. WebGL reads no
  // such field, so its programs are the same.
  if (own) (material as unknown as Record<string, unknown>).twinOwn = `${twin}:${++owned}`;
  return glslOnly(material, family);
}
let owned = 0;

/** Flag a figure's material (a classic one with a graft of its own) as
 * drawn on the webgpu paths by figure twin `kind` (`figure-twins-tsl.ts`),
 * over its graft's own uniforms `own` — read there off the material drawn
 * (`userData.figureOwn`). WebGL reads neither. */
export function figureTwin<T extends { userData: Record<string, unknown> }>(
  material: T,
  kind: string,
  own: Record<string, { value: unknown }> = {},
): T {
  material.userData.figureOwn = own;
  return nodeTwin(material, "figures", kind);
}

/** Flag a caster's WebGL depth material as carrying figure `kind`'s graft
 * (`figureTwin`), over its own uniforms: the key's shadow on the node
 * renderer draws the caster moved the same way (`figureShadowOf`). */
export function figureDepth<T extends { userData: Record<string, unknown> }>(
  depth: T,
  kind: string,
  own: Record<string, { value: unknown }> = {},
): T {
  depth.userData.figureDepth = kind;
  depth.userData.figureOwn = own;
  return depth;
}

/** Flag a classic material whose GLSL graft (`onBeforeCompile`) the node
 * renderer finishes in nodes of kind `kind` (`model-grafts-tsl.ts`): its
 * copy is three's own, and the graft's nodes are set on it as the dressing
 * finishes it. In family `family` of `GPU_PORTS`, hidden until ported.
 * WebGL reads neither flag. */
export function nodeGraft<T extends { userData: Record<string, unknown> }>(
  material: T,
  family: string,
  kind: string,
): T {
  material.userData.graft = kind;
  grafts.set(material, kind);
  return glslOnly(material, family);
}

// The materials flagged, by identity: a clone copies `userData` (as JSON)
// but never the `onBeforeCompile` WebGL grafts with, so a clone (a dead
// skier's baked remains) is drawn plain on WebGL and must be on the node
// renderer too.
const grafts = new WeakMap<object, string>();
const dissolving = new WeakSet<object>();

/** The node graft `material` itself was flagged with, or null (a clone of
 * a flagged material's included). */
export function graftOf(material: object): string | null {
  return grafts.get(material) ?? null;
}

/** Flag his skin's material as dissolved under the X-ray, over the view's
 * own uniforms `own` (`xray-view.ts`, `xray-tsl.ts`). */
export function nodeDissolve(
  material: { userData: Record<string, unknown> },
  own: { uXrSolid: { value: number }; uXrEdge: { value: unknown } },
): void {
  material.userData.xrayOwn = own;
  dissolving.add(material);
}

/** Whether `material` itself is dissolved under the X-ray. */
export function dissolves(material: object): boolean {
  return dissolving.has(material);
}

/** WHAT DREW THE FRAME, for the developer page and the benchmark's report. */
export type BackendState = {
  /** What the visit asked for (`?renderer=`, the setting, or `auto`). */
  asked: BackendAsk;
  /** What actually runs: `webgpu` or `auto` asked on a browser with no
   * device runs `webgpu-gl`. */
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
export function freshBackend(
  asked: BackendAsk,
  running: Backend = asked === "auto" ? "webgpu" : asked,
): BackendState {
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
