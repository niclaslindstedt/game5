// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TOWN LAB's page (driven by `scripts/town-preview.mjs`): one free ride
// on one seed skied into the village and drawn through the game's own
// renderer as strips of frames — `window.__town.run(sheets)` skis the whole
// story once and hands back each sheet as a PNG:
//
//   * the skier skied onto a street of the village and stood on his edges
//     to a stop;
//   * out of the bindings (the heels popped with the pole), onto his
//     shoulder (bent for the pair, stood up, clapped and swung up);
//   * walking the street with the pair on his shoulder, and away off it;
//   * the pair off his shoulder and down on the snow, and back in.
//
// Every frame is named by the moment it is of — `stop:<s>` s after he
// stopped, `walk:<s>` s into the walk, `leave:<s>` s after the pair began
// to come off — and drawn through a lens of the sheet's: `front` (three
// quarters from in front, to his right), `side` (his right side), `back`
// (three quarters behind), or `chase` (the game's own chase rung).

import { angleDiff } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  step,
  streetMaskAt,
  villageOf,
  type GameState,
  type SkierInput,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, withPreset } from "../game/settings-video.ts";

type Lens = "front" | "side" | "back" | "chase";
type Sheet = { name: string; lens: Lens; frames: string[]; cols?: number };

declare global {
  interface Window {
    __town?: {
      ready: Promise<void>;
      run(sheets: Sheet[]): Promise<{ name: string; png: string; notes: string[] }[]>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const tile = Number(params.get("tile") ?? 420);
/** How long he walks down the street before he turns for the way out, s. */
const along = Number(params.get("along") ?? 5);
const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${tile}px`;
canvas.style.height = `${tile}px`;
const sheetCanvas = document.getElementById("sheet") as HTMLCanvasElement;

await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, "high"),
  preserveDrawingBuffer: true,
});
renderer.resize(tile, tile, 1);
if (params.get("hour") !== null) renderer.setSky({ hour: Number(params.get("hour")) });

function fresh(): GameState {
  const state = createGame({ seed, mode: "free" });
  // The crowd is the free ride's, not the lab's: sent home so the views
  // are of him.
  delete state.crowd;
  return state;
}
let state = fresh();
const FRAME = 1 / 60;

/** A street of the village long enough to ski onto: its middle, and the
 * way along it. */
function streetStart(s: GameState): { x: number; z: number; heading: number } {
  const v = villageOf(s.level);
  if (!v) throw new Error("no village on this map");
  const st = [...v.streets].sort((a, b) => b.points.length - a.points.length)[0];
  const i = Math.floor(st.points.length * 0.35);
  const a = st.points[i];
  const b = st.points[i + 3];
  return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** The nearest way off the village from where he stands: a heading. */
function wayOut(s: GameState): number {
  const c = s.skier;
  let best = { h: c.heading, d: Infinity };
  for (let a = 0; a < 72; a++) {
    const hd = (a / 72) * Math.PI * 2;
    for (let d = 2; d < 260; d += 2) {
      if (streetMaskAt(s.level, c.x + Math.sin(hd) * d, c.z + Math.cos(hd) * d) < 2) {
        if (d < best.d) best = { h: hd, d };
        break;
      }
    }
  }
  return best.h;
}

/** A lens planted round him for this frame. */
function lensOf(s: GameState, lens: Lens): LensPose | null {
  if (lens === "chase") return null;
  const c = s.skier;
  const turn = lens === "front" ? 0.75 : lens === "side" ? Math.PI / 2 : 2.35;
  const range = 3.6;
  const ex = c.x + Math.sin(c.heading + turn) * range;
  const ez = c.z + Math.cos(c.heading + turn) * range;
  const ground = s.level.groundAt(c.x, c.z);
  return {
    eye: { x: ex, y: Math.max(s.level.groundAt(ex, ez) + 0.4, ground + 1.45), z: ez },
    target: { x: c.x, y: ground + 1.0, z: c.z },
    fov: 50,
    roll: 0,
  };
}

/** Where in the story he is, and the time each moment is at once known. */
type Story = { stop: number; walk: number; leave: number };

function phaseOf(s: GameState): string {
  const w = s.skier.town;
  if (!w)
    return s.skier.speed > 0.05 ? `skiing ${(s.skier.speed * 3.6).toFixed(1)} km/h` : "on his skis";
  return `${w.phase} ${w.phaseT.toFixed(2)} s`;
}

window.__town = {
  ready: renderer.load(state),
  async run(sheets) {
    state = fresh();
    await renderer.load(state);
    const start = streetStart(state);
    // Skied in along the street from a few metres back of it.
    const back = 14;
    placeRun(state, {
      x: start.x - Math.sin(start.heading) * back,
      z: start.z - Math.cos(start.heading) * back,
      heading: start.heading,
      speed: 7,
    });
    const story: Story = { stop: NaN, walk: NaN, leave: NaN };
    const wanted = sheets.flatMap((sh, n) =>
      sh.frames.map((f, j) => {
        const [anchor, at] = f.split(":");
        return { sheet: n, j, anchor: anchor as keyof Story, at: Number(at), name: f };
      }),
    );
    const order: (keyof Story)[] = ["stop", "walk", "leave"];
    wanted.sort((a, b) => order.indexOf(a.anchor) - order.indexOf(b.anchor) || a.at - b.at);
    const shots = sheets.map((sh) => ({
      ...sh,
      cols: sh.cols ?? Math.min(4, sh.frames.length),
      tiles: [] as { j: number; bitmap: ImageBitmap; label: string }[],
      notes: [] as string[],
    }));
    let target = start.heading;
    let leaving = false;
    let guard = 0;
    for (const want of wanted) {
      for (;;) {
        const t0 = story[want.anchor];
        if (!Number.isNaN(t0) && state.t - t0 >= want.at - 1e-6) break;
        if (++guard > 120 * 400) throw new Error(`never reached ${want.name}`);
        // THE DRIVER: neutral onto the street (the stop is the engine's);
        // on foot, along the street for `along` s, then for the way out.
        let input: SkierInput = NEUTRAL_INPUT;
        const w = state.skier.town;
        if (w?.phase === "walk") {
          if (!leaving && state.t - story.walk >= along) {
            leaving = true;
            target = wayOut(state);
          }
          const turn = angleDiff(state.skier.heading, target);
          input = {
            ...NEUTRAL_INPUT,
            tuck: Math.abs(turn) < 0.6 ? 1 : 0,
            steer: Math.max(-1, Math.min(1, turn * 3)),
          };
        }
        step(state, input);
        for (const e of state.events) {
          if (e.kind !== "town") continue;
          if (e.phase === "stop") story.stop = state.t;
        }
        const now = state.skier.town;
        if (now?.phase === "walk" && Number.isNaN(story.walk)) story.walk = state.t;
        if (now?.phase === "drop" && Number.isNaN(story.leave)) story.leave = state.t;
        // A frame drawn every other step, so the view's own springs run.
        if (guard % 2 === 0) renderer.draw(state, 0, FRAME, false);
        if (!now && !Number.isNaN(story.leave) && want.anchor !== "leave") break;
      }
      const shot = shots[want.sheet];
      renderer.setOverride(lensOf(state, shot.lens));
      if (shot.lens === "chase") renderer.setCamera("chase");
      renderer.draw(state, 0, FRAME, true);
      renderer.setOverride(null);
      const label = `${want.name} · ${phaseOf(state)}`;
      shot.tiles.push({ j: want.j, bitmap: await createImageBitmap(canvas), label });
      shot.notes.push(label);
      if (Number.isNaN(story.walk) && want.anchor === "walk") break;
    }
    return shots.map((sh) => {
      const rows = Math.ceil(sh.frames.length / sh.cols);
      sheetCanvas.width = sh.cols * tile;
      sheetCanvas.height = rows * tile;
      const g = sheetCanvas.getContext("2d")!;
      g.fillStyle = "#0b1116";
      g.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
      for (const t of sh.tiles) {
        const x = (t.j % sh.cols) * tile;
        const y = Math.floor(t.j / sh.cols) * tile;
        g.drawImage(t.bitmap, x, y);
        g.font = "13px monospace";
        g.fillStyle = "rgba(0,0,0,0.55)";
        g.fillRect(x, y, tile, 20);
        g.fillStyle = "#fff";
        g.fillText(t.label, x + 6, y + 14);
      }
      return { name: sh.name, png: sheetCanvas.toDataURL("image/png"), notes: sh.notes };
    });
  },
};
