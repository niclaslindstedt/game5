// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE COST LAB's page (`scripts/gore-cost.mjs`): what a body torn
// apart COSTS a frame — a high-speed hit staged as the gore lab stages it
// (`gore-scenes.ts`), then skied on frame by frame through the game's own
// renderer with the INJURIES switch on, every frame measured:
//
//   * the processor: the whole `draw` and the gore view's own `update`
//     (`goreMeter`), and the wait for the card to finish it (`drain`);
//   * what was handed to the card: draw calls, triangles, the programs
//     linked (a program linked mid-run is a stall on a phone), the bytes
//     uploaded into buffers and textures;
//   * what the gore view holds: the drops in the air, the blots and pools
//     on the snow, its meshes and their triangles;
//   * THE TWIN: the same frame drawn again twice, still, with the gore shown
//     and with it hidden, each waited on — the gap is what drawing the gore
//     costs (its submit and its pixels), the processor's update aside.
//
// It exposes `window.__goreCost.run(scene)`, which hands back one row a
// frame from the scene's lead-in to `seconds` after the hit, with every
// program linked after the hit (and what told it from the one it is most
// like: a key that moved), the last frame's uploads by call and size, and
// what the gore group held at the end, by kind.

import {
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  step,
  TUNING,
  type GameState,
  type RegionId,
} from "@engine";
import * as THREE from "three";

import { goreMeter } from "../game/gore-view.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { dying } from "../game/xray-run.ts";
import { intoTree, ontoSnow, skiAtTree, type Stage } from "./gore-scenes.ts";

/** One frame's measures. `t` is seconds from the hit (negative before it). */
export type CostRow = {
  t: number;
  /** The processor's `draw`, ms, and the gore view's `update` inside it. */
  cpu: number;
  gore: number;
  /** The wait for the card to finish the frame, ms. */
  wait: number;
  calls: number;
  tris: number;
  /** Programs linked during this frame's draw. */
  links: number;
  /** Bytes uploaded to buffers and textures this frame, KB. */
  upload: number;
  /** The frame's biggest single upload, KB, and what it was. */
  big: number;
  bigWhat: string;
  /** KB uploaded by the twin drawn with the gore and without it. */
  shownUp: number;
  hiddenUp: number;
  drops: number;
  splats: number;
  pools: number;
  /** The gore group's meshes drawn and the triangles they hand the card. */
  meshes: number;
  goreTris: number;
  /** Of them, the pieces' skins and the blood's. */
  pieceTris: number;
  bloodTris: number;
  /** The twin: the still frame with the gore and without it, ms end to end. */
  shown: number;
  hidden: number;
  /** The twin's draw calls with the gore and without it. */
  shownCalls: number;
  hiddenCalls: number;
};

declare global {
  interface Window {
    __goreCost?: {
      ready: Promise<string>;
      scenes: readonly string[];
      run(scene: string): Promise<{
        rows: CostRow[];
        note: string;
        linked: string[];
        uploads: string[];
        held: string[];
      }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 2);
const region = (params.get("region") || undefined) as RegionId | undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "medium";
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const dpr = Number(params.get("dpr") ?? 1);
const seconds = Number(params.get("seconds") ?? 6);
const twins = Number(params.get("twins") ?? 2);

// THE CARD'S LEDGER: every program linked and every byte uploaded, counted
// at the context's own calls (patched before the renderer makes one).
const gl = {
  links: 0,
  bytes: 0,
  named: [] as string[],
  defines: [] as string[][],
  big: 0,
  bigWhat: "",
};
/** Every define and uniform declared in a program, to tell two programs apart. */
const definesOf = (c: WebGL2RenderingContext, p: WebGLProgram): string[] =>
  (c.getAttachedShaders(p) ?? [])
    .flatMap((sh) => (c.getShaderSource(sh) ?? "").split("\n"))
    .map((l) => l.trim())
    .filter((l) => /^#define |^uniform /.test(l));
/** Count an upload, keeping the frame's biggest and what it was. */
const tally = new Map<string, number>();
const upload = (n: number, what: string): void => {
  gl.bytes += n;
  const key = `${what} ${n}`;
  tally.set(key, (tally.get(key) ?? 0) + n);
  if (n > gl.big) {
    gl.big = n;
    gl.bigWhat = what;
  }
};
/** What a program is, read off three's defines in its vertex shader. */
const FLAGS = [
  "USE_INSTANCING",
  "USE_SKINNING",
  "USE_COLOR",
  "USE_ALPHAMAP",
  "DOUBLE_SIDED",
  "USE_SHADOWMAP",
  "USE_MORPHTARGETS",
  "DEPTH_PACKING",
];
const nameOf = (c: WebGL2RenderingContext, p: WebGLProgram): string => {
  const src = (c.getAttachedShaders(p) ?? []).map((sh) => c.getShaderSource(sh) ?? "").join("\n");
  const name = /#define SHADER_NAME (\S+)/.exec(src)?.[1] ?? "raw";
  const flags = FLAGS.filter((f) => new RegExp(`#define ${f}\\b`).test(src));
  return [name, ...flags.map((f) => f.replace("USE_", "").toLowerCase())].join(" ");
};
const proto = WebGL2RenderingContext.prototype;
const sizeOf = (data: unknown, offset = 0, length = 0): number => {
  if (typeof data === "number") return data;
  if (!ArrayBuffer.isView(data)) return 0;
  const each = "BYTES_PER_ELEMENT" in data ? (data.BYTES_PER_ELEMENT as number) : 1;
  return length > 0 ? length * each : data.byteLength - offset * each;
};
const link = proto.linkProgram;
proto.linkProgram = function (p) {
  gl.links++;
  gl.named.push(nameOf(this, p));
  gl.defines.push(definesOf(this, p));
  link.call(this, p);
};
const bufferData = proto.bufferData as (...a: unknown[]) => void;
(proto as unknown as { bufferData: (...a: unknown[]) => void }).bufferData = function (
  this: WebGL2RenderingContext,
  ...a: unknown[]
) {
  upload(sizeOf(a[1], (a[3] as number) ?? 0, (a[4] as number) ?? 0), "bufferData");
  bufferData.apply(this, a);
};
const bufferSub = proto.bufferSubData as (...a: unknown[]) => void;
(proto as unknown as { bufferSubData: (...a: unknown[]) => void }).bufferSubData = function (
  this: WebGL2RenderingContext,
  ...a: unknown[]
) {
  upload(sizeOf(a[2], (a[3] as number) ?? 0, (a[4] as number) ?? 0), "bufferSubData");
  bufferSub.apply(this, a);
};
/** Bytes a texel, off an upload's format and type. */
const CHANNELS: Record<number, number> = {
  6403: 1,
  36244: 1,
  33319: 2,
  33320: 2,
  6407: 3,
  36248: 3,
  6408: 4,
  36249: 4,
  6406: 1,
  6409: 1,
  6410: 2,
};
const BYTES: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5124: 4,
  5125: 4,
  5126: 4,
  5131: 2,
  36193: 2,
};
/** Where a call's width, height, depth and format sit in its arguments. */
const TEX: Record<string, { w: number; h: number; d?: number; format: number }> = {
  texImage2D: { w: 3, h: 4, format: 6 },
  texSubImage2D: { w: 4, h: 5, format: 6 },
  texImage3D: { w: 3, h: 4, d: 5, format: 7 },
  texSubImage3D: { w: 5, h: 6, d: 7, format: 8 },
};
for (const name of ["texImage2D", "texSubImage2D", "texImage3D", "texSubImage3D"] as const) {
  const f = proto[name] as (...a: unknown[]) => void;
  const at = TEX[name];
  (proto as unknown as Record<string, (...a: unknown[]) => void>)[name] = function (
    this: WebGL2RenderingContext,
    ...a: unknown[]
  ) {
    const src = a[a.length - 1];
    let n = 0;
    if (typeof a[at.w] === "number" && typeof a[at.h] === "number" && a.length > at.format + 1) {
      // The region sent, never the whole array it is read out of.
      const texel =
        (CHANNELS[a[at.format] as number] ?? 4) * (BYTES[a[at.format + 1] as number] ?? 1);
      n = (a[at.w] as number) * (a[at.h] as number) * (at.d ? (a[at.d] as number) : 1) * texel;
    } else if (src && typeof src === "object" && "width" in src && "height" in src) {
      n = (src.width as number) * (src.height as number) * 4; // an image or a canvas
    }
    upload(n, `${name} ${a.filter((x) => typeof x === "number").join(",")}`);
    f.apply(this, a);
  };
}

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;

await loadModels();
const renderer = createWorldRenderer(canvas, { video: withPreset(DEFAULT_VIDEO, tier) });
renderer.resize(width, height, dpr);

const level = generateLevel(seed, { region });
const FRAME = 1 / 60;
const STEPS = Math.round(FRAME / TUNING.dt);
/** The wall time a twin is drawn over: nothing moves in it. */
const STILL = 1e-4;

function fresh(): GameState {
  return createGame({ level, seed, region, mode: "free", gore: true, crowd: 0, quiet: true });
}
const stage = { level, fresh } as unknown as Stage;

/** THE HITS, each staged a beat before the moment he meets it. */
const SCENES: Record<string, () => GameState> = {
  /** Skied square into a trunk at 108 km/h from 15 m up the fall line:
   * his middle crushed on it, the smear, the limbs flung on past it. */
  trunk: () => skiAtTree(stage, 30, 15).s,
  /** Thrown flat on his side into the snow at 100 km/h, sliding on: the
   * limbs torn off at the joints and the trunk burst. */
  mangled: () => ontoSnow(stage, "left", 28, 8).s,
  /** Flown head first into a trunk at 90 km/h: the head torn off. */
  decapitation: () => intoTree(stage, "head", 25).s,
  /** Thrown head first into the snow at 90 km/h: the skull crushed. */
  crush: () => ontoSnow(stage, "head", 25).s,
};

const ready = (async () => {
  const first = fresh();
  await renderer.load(first);
  renderer.setCamera("chase", true);
  renderer.draw(first, 1, FRAME);
  await renderer.shadeSettled();
  renderer.drain();
  return `seed ${seed}${region ? ` ${region}` : ""}, ${tier}, ${width}×${height} at ${dpr}×, ${twins} twin(s) a frame`;
})();

/** What the gore group hands the card: its meshes drawn and their triangles. */
function goreLoad(root: THREE.Object3D | undefined) {
  const out = { meshes: 0, tris: 0, drops: 0, splats: 0, pools: 0, pieces: 0, blood: 0 };
  root?.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    const count = g.index ? g.index.count : (g.getAttribute("position")?.count ?? 0);
    const range = Math.min(count, g.drawRange.count) / 3;
    const n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
    if (n === 0 || range === 0) return;
    out.meshes++;
    out.tris += range * n;
    if (m.name === "blood-drops") out.drops += n;
    else if (m.name === "blood-splats") out.splats += n;
    else if (m.name === "blood-pools") out.pools += n;
    // A piece torn off is a skin of its own; the blood is instanced or the streams.
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) out.pieces += range * n;
    else if (m.name.startsWith("blood") || o.parent?.name === "blood") out.blood += range * n;
  });
  return out;
}

/** The programs three holds now, oldest first. */
const programs = (): { name: string; cacheKey: string }[] =>
  (renderer.gl.info.programs ?? []) as unknown as { name: string; cacheKey: string }[];

/** One still frame, waited on: its milliseconds end to end and its draws. */
function still(state: GameState): { ms: number; calls: number; up: number } {
  const at = performance.now();
  const bytes = gl.bytes;
  renderer.draw(state, 1, STILL);
  renderer.drain();
  return {
    ms: performance.now() - at,
    calls: renderer.cost().calls,
    up: (gl.bytes - bytes) / 1024,
  };
}

async function run(scene: string): Promise<{
  rows: CostRow[];
  note: string;
  linked: string[];
  uploads: string[];
  held: string[];
}> {
  const note = await ready;
  const make = SCENES[scene];
  if (!make) throw new Error(`no scene "${scene}"`);
  renderer.clearBodies();
  const state = make();
  renderer.setCamera("chase", true);
  const rows: CostRow[] = [];
  let hit = -1;
  let named = gl.named.length;
  let known = 0;
  const lead = Math.round(1 / FRAME);
  const total = 3 * lead + Math.round(seconds / FRAME);
  for (let k = 0; k < total; k++) {
    for (let i = 0; i < STEPS; i++) step(state, NEUTRAL_INPUT);
    if (hit < 0 && (state.skier.thrown || (state.gore?.mortal ?? -1) >= 0)) {
      hit = state.t;
      named = gl.named.length;
      known = programs().length;
    }
    if (hit >= 0 && state.t - hit > seconds) break;
    renderer.setDeathCam(dying(state));
    const links = gl.links;
    const bytes = gl.bytes;
    tally.clear();
    gl.big = 0;
    gl.bigWhat = "";
    const at = performance.now();
    renderer.draw(state, 1, FRAME);
    const drawn = performance.now();
    renderer.drain();
    const waited = performance.now();
    const cost = renderer.cost();
    const row: CostRow = {
      t: state.t,
      cpu: drawn - at,
      gore: goreMeter.updateMs,
      wait: waited - drawn,
      calls: cost.calls,
      tris: cost.triangles,
      links: gl.links - links,
      upload: (gl.bytes - bytes) / 1024,
      big: gl.big / 1024,
      bigWhat: gl.bigWhat,
      shownUp: 0,
      hiddenUp: 0,
      ...(() => {
        const g = goreLoad(renderer.group("gore"));
        return {
          drops: g.drops,
          splats: g.splats,
          pools: g.pools,
          meshes: g.meshes,
          goreTris: g.tris,
          pieceTris: g.pieces,
          bloodTris: g.blood,
        };
      })(),
      shown: 0,
      hidden: 0,
      shownCalls: 0,
      hiddenCalls: 0,
    };
    // THE TWIN, the best of `twins` each way, so a hiccup of the machine's
    // is not billed to the gore.
    const group = renderer.group("gore");
    if (group && twins > 0) {
      let shown = Infinity;
      let hidden = Infinity;
      for (let r = 0; r < twins; r++) {
        const a = still(state);
        shown = Math.min(shown, a.ms);
        row.shownCalls = a.calls;
        row.shownUp = a.up;
        group.visible = false;
        const b = still(state);
        group.visible = true;
        hidden = Math.min(hidden, b.ms);
        row.hiddenCalls = b.calls;
        row.hiddenUp = b.up;
      }
      row.shown = shown;
      row.hidden = hidden;
    }
    rows.push(row);
  }
  // Timed from the hit, with half a second of skiing before it to compare.
  for (const r of rows) r.t -= hit;
  // Each program linked after the hit, and where it is one already
  // named, what it alone declares beside the first of that name.
  const sets = gl.defines.slice(named);
  const names = gl.named.slice(named);
  const linked = names.map((n, i) => {
    const first = names.indexOf(n);
    if (first === i) return n;
    const own = sets[i].filter((l) => !sets[first].includes(l));
    const lacks = sets[first].filter((l) => !sets[i].includes(l));
    return `${n} [+${own.join(" +")} -${lacks.join(" -")}]`;
  });
  // What the gore group holds at the end, by kind: its meshes drawn, a
  // kind's count and the triangles it hands the card.
  const kinds = new Map<string, { n: number; tris: number }>();
  renderer.group("gore")?.traverseVisible((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const kind = `${o.parent?.name || "-"}/${mesh.name || mesh.type}`;
    const g = mesh.geometry;
    const count = g.index ? g.index.count : (g.getAttribute("position")?.count ?? 0);
    const inst = (mesh as THREE.InstancedMesh).isInstancedMesh
      ? (mesh as THREE.InstancedMesh).count
      : 1;
    const k = kinds.get(kind) ?? { n: 0, tris: 0 };
    k.n++;
    k.tris += (Math.min(count, g.drawRange.count) / 3) * inst;
    kinds.set(kind, k);
  });
  const held = [...kinds].map(([k, v]) => `${k} ×${v.n} (${Math.round(v.tris)} tris)`);
  // three's own record of the programs made after the hit: its name and
  // the end of its key, where a material's own cache key sits.
  const made = programs()
    .slice(known)
    .map((p) => `${p.name} …${p.cacheKey.slice(-70)}`);
  // The last frame's uploads by kind, the dearest first.
  const uploads = [...tally]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, n]) => `${(n / 1024).toFixed(0)} KB as ${k}`);
  return {
    rows: rows.filter((r) => r.t >= -0.5),
    linked: [...linked, ...made],
    uploads,
    held,
    note: `${note}; hit at t ${hit.toFixed(2)} s`,
  };
}

window.__goreCost = { ready, scenes: Object.keys(SCENES), run };
