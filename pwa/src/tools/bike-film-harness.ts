// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S FILM LAB page (`scripts/bike-film.mjs`): the rider and
// his bike MOVING together, through the game's OWN renderer. Every clip of
// `bike-clips.ts` (the pedal, the turns, the berm, the pump, the jump, the
// whip, the table, the landing, the brake, the foot out, the crash, the push
// and the lift) is ridden on the real engine and drawn EVERY frame — so
// whatever the drawing eases, springs or lags is stepped as the game steps
// it — and photographed at evenly spaced moments of its window from each
// ANGLE asked:
//
//   side    beside him on his left, level with the hips, carried with him
//   front   three quarters ahead of him, a little above
//   rear    three quarters behind him, a little above
//   chase   the game's own close chase rung: the picture a player sees
//   orbit   wide and high off his right, the whole bike and its line
//
// A clip's sheet is a row an angle and a column a moment — a filmstrip —
// with the clip's figures under each frame. `window.__film.frames(clip,
// angles, n)` hands back the frames (PNG data URLs); `window.__film.lay(…)`
// lays a clip's sheet out, with any reference photographs the driver hands
// in at the head of its rows, for the driver to photograph.

import { bikePose, type GameState } from "@engine";

import { animatedStyle } from "../game/bike-anim.ts";
import { bikeLookOf, setBikeLook } from "../game/bike-variant.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { CLIP_HZ, CLIP_MAP, CLIPS, clipLevel, clipWindow, rideClip } from "./bike-clips.ts";

type Frame = { clip: string; angle: string; k: number; t: number; caption: string; png: string };

declare global {
  interface Window {
    __film?: {
      ready: Promise<string>;
      clips: readonly { id: string; about: string }[];
      angles: readonly string[];
      frames(clip: string, angles: string[], n: number): Promise<Frame[]>;
      lay(
        clip: string,
        frames: Frame[],
        refs: { name: string; src: string }[],
        cols: number,
      ): Promise<void>;
    };
  }
}

const params = new URLSearchParams(location.search);
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "low";
const width = Number(params.get("w") ?? 640);
const height = Number(params.get("h") ?? 360);
setBikeLook(bikeLookOf(params.get("bikelook")) ?? "freeride");
const styled = params.get("bikelook") !== "trail";

const ANGLES = ["side", "front", "rear", "chase", "orbit"] as const;
type Angle = (typeof ANGLES)[number];

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const sheetEl = document.getElementById("sheet") as HTMLDivElement;

await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, tier),
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
const FRAME = 1 / CLIP_HZ;

/** A lens planted round the bike in its own heading's frame: `side` m to
 * its right (negative its left), `ahead` m along it, `up` m over it,
 * looking at the rider's middle. */
function planted(s: GameState, side: number, ahead: number, up: number, fov: number): LensPose {
  const b = s.bike!;
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  return {
    eye: { x: b.x + fx * ahead + fz * side, y: b.y + up, z: b.z + fz * ahead - fx * side },
    target: { x: b.x, y: b.y + 0.45, z: b.z },
    fov,
    roll: 0,
  };
}

function lensOf(s: GameState, angle: Angle): LensPose | null {
  switch (angle) {
    case "side":
      return planted(s, -3.4, 0.2, 0.55, 42);
    case "front":
      return planted(s, -2.2, 3.6, 1.0, 46);
    case "rear":
      return planted(s, 2.2, -3.6, 1.3, 46);
    case "orbit":
      return planted(s, 7.5, 2.5, 4.5, 50);
    case "chase":
      return null;
  }
}

function caption(s: GameState, t: number): string {
  const b = s.bike!;
  const p = bikePose(b);
  const st = styled ? animatedStyle(b, s.level, s.t) : null;
  const what = s.skier.thrown
    ? "thrown"
    : b.mode === "lift"
      ? "lift"
      : b.afoot
        ? "afoot"
        : b.airborne
          ? `air ${b.airTime.toFixed(2)}s`
          : "ground";
  const trick = st && st.trick !== "none" ? ` ${st.trick} ${st.amount.toFixed(2)}` : "";
  const foot = st && st.footOut > 0.05 ? ` foot ${st.footOut.toFixed(2)}` : "";
  const deg = (r: number) => Math.round((r * 180) / Math.PI);
  return (
    `${t.toFixed(2)}s ${(b.speed * 3.6).toFixed(0)}km/h ${what}${trick}${foot}\n` +
    `roll ${deg(p.roll)}° pitch ${deg(p.pitch)}° fork ${Math.round(p.forkShare * 100)}% ` +
    `shock ${Math.round(p.shockShare * 100)}% crouch ${p.crouch.toFixed(2)}`
  );
}

/** The map the renderer is loaded on. */
let drawn: unknown = null;

/** The ready line: the map, the look, and every clip's window. */
const windows = new Map<string, [number, number] | null>();
const ready = (async () => {
  const s0 = CLIPS[0].start(clipLevel());
  await renderer.load(s0);
  renderer.setSky({ weather: "fair", hour: CLIP_MAP.hour });
  drawn = s0.level;
  renderer.draw(s0, 1, FRAME);
  await renderer.shadeSettled();
  return `seed ${CLIP_MAP.seed} · ${styled ? "freeride" : "trail"} · ${tier} · ${width}×${height}`;
})();

async function frames(id: string, angles: string[], n: number): Promise<Frame[]> {
  await ready;
  const clip = CLIPS.find((c) => c.id === id);
  if (!clip) throw new Error(`no clip ${id}`);
  if (!windows.has(id)) windows.set(id, clipWindow(clip));
  const win = windows.get(id);
  if (!win) return [];
  const [from, to] = win;
  // The moments photographed: n evenly across the window, as frame counts.
  const span = Math.round((to - from) * CLIP_HZ);
  const at = new Set<number>();
  for (let k = 0; k < n; k++) at.add(Math.round((k * span) / Math.max(1, n - 1)));
  const out: Frame[] = [];
  let f = 0;
  let k = 0;
  let loaded = false;
  renderer.setCamera("chase", true);
  await rideClip(clip, win, async (s, t) => {
    if (!loaded) {
      // A clip begun elsewhere on the map (the lift's) is the same map:
      // the renderer stays loaded, only the lens is cut to him.
      if (drawn !== s.level) {
        await renderer.load(s);
        drawn = s.level;
      }
      renderer.setSky({ weather: "fair", hour: CLIP_MAP.hour });
      renderer.setCamera("chase", true);
      loaded = true;
    }
    // Every frame stepped as the game steps it (the springs, the eases,
    // the lens), presented only at the moments shot.
    const shot = at.has(f++);
    renderer.setOverride(null);
    renderer.draw(s, 1, FRAME, false);
    if (!shot) return;
    for (const angle of angles) {
      renderer.setOverride(lensOf(s, angle as Angle));
      // The same moment again from this lens: the clock all but held.
      renderer.draw(s, 1, 1e-4, true);
      out.push({
        clip: id,
        angle,
        k,
        t,
        caption: caption(s, t),
        png: canvas.toDataURL("image/png"),
      });
    }
    renderer.setOverride(null);
    k++;
  });
  return out;
}

async function lay(
  id: string,
  shot: Frame[],
  refs: { name: string; src: string }[],
  cols: number,
): Promise<void> {
  const clip = CLIPS.find((c) => c.id === id)!;
  const angles = [...new Set(shot.map((f) => f.angle))];
  const n = Math.max(0, ...shot.map((f) => f.k + 1));
  const tw = Math.round(width / 2);
  const th = Math.round(height / 2);
  const per = Math.min(cols, n);
  sheetEl.style.gridTemplateColumns = `${refs.length ? `${th * 1.4}px ` : ""}repeat(${per}, ${tw}px)`;
  const head = document.createElement("header");
  const win = windows.get(id);
  head.textContent = `${id} — ${clip.about}\n${await ready} · window ${win ? `${win[0].toFixed(2)}–${win[1].toFixed(2)} s` : "not ridden"}`;
  const cells: HTMLElement[] = [head];
  for (const angle of angles) {
    for (let row = 0; row * per < n; row++) {
      if (refs.length) {
        const ref = document.createElement("figure");
        ref.className = "ref";
        const r = refs[row % refs.length];
        if (row === 0 || refs.length > 1) {
          const img = document.createElement("img");
          img.src = r.src;
          img.style.width = `${th * 1.4}px`;
          img.style.height = `${th}px`;
          img.style.objectFit = "cover";
          await img.decode().catch(() => undefined);
          ref.append(img);
          const cap = document.createElement("figcaption");
          cap.textContent = `reference\n${r.name}`;
          ref.append(cap);
        }
        cells.push(ref);
      }
      for (let c = 0; c < per; c++) {
        const f = shot.find((x) => x.angle === angle && x.k === row * per + c);
        const cell = document.createElement("figure");
        if (f) {
          const img = document.createElement("img");
          img.src = f.png;
          img.width = tw;
          img.height = th;
          await img.decode();
          cell.append(img);
          const cap = document.createElement("figcaption");
          cap.textContent = `${angle} ${f.k + 1}/${n}  ${f.caption}`;
          cell.append(cap);
        }
        cells.push(cell);
      }
    }
  }
  sheetEl.replaceChildren(...cells);
}

window.__film = {
  ready,
  clips: CLIPS.map((c) => ({ id: c.id, about: c.about })),
  angles: ANGLES,
  frames,
  lay,
};
