// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI LAB's page (driven by `scripts/afterski-preview.mjs`): a free
// ride on one seed drawn through the game's own renderer at the afterski's
// moments — `window.__afterski.shoot(name)` stages one and draws it, the
// script photographs the canvas.
//
//   * lodge, lodge-near, lodge-2 — the lodges from the snow before them
//     (`cabin-view.ts`'s);
//   * inside-<s> — stood at the valley lodge's door, gone in on the machine
//     press and `s` s into the party (the room's own lens round him; the
//     beers come on the engine's clock);
//   * eyes-<b> — skiing down the piste with a buzz of `b`, through his own
//     eyes (the HELMET rung): the drunk picture; chase-<b> the same from
//     the chase boom;
//   * fetch-<s> — `s` s after a buzzed skier is thrown on the piste: up,
//     walking to his skis, picking them up, back in — from a lens planted
//     off the line he fell along, so a run of them is the frames of it.
//
// The views are staged in the order they are asked for; each family sets
// its own moment up, so they need not share a run.

import {
  botInput,
  createGame,
  doorOf,
  lodgesOf,
  NEUTRAL_INPUT,
  placeRun,
  standSkier,
  step,
  throwRider,
  trackPointAt,
  type GameState,
  type SkierInput,
} from "@engine";

import { h, render } from "preact";

import "../afterski.css";
import "../sled.css";
import { afterskiOf } from "../game/afterski-hud.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import { AfterskiReadout, BuzzMeter } from "../game/hud-afterski.tsx";
import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { DEFAULT_VIDEO, withPreset } from "../game/settings-video.ts";
import { cabinView } from "./cabin-view.ts";

declare global {
  interface Window {
    __afterski?: {
      ready: Promise<void>;
      shoot(name: string): Promise<{ name: string; note: string }>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const width = Number(params.get("w") ?? 1280);
const height = Number(params.get("h") ?? 720);
const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const label = document.getElementById("label") as HTMLDivElement;
const hud = document.getElementById("hud") as HTMLDivElement;

await loadModels();
const renderer = createWorldRenderer(canvas, {
  video: withPreset(DEFAULT_VIDEO, "high"),
  preserveDrawingBuffer: true,
});
renderer.resize(width, height, 1);
const state: GameState = createGame({ seed, mode: "free" });
// The crowd is the free ride's, not the lab's: sent home so the views are
// of him.
delete state.crowd;
const level = state.level;
if (params.get("hour") !== null) renderer.setSky({ hour: Number(params.get("hour")) });

const FRAME = 1 / 60;
/** Two engine steps a display frame, drawn or not. */
function frame(input: SkierInput | null, present: boolean): void {
  for (let i = 0; i < 2; i++) step(state, input ?? botInput(state));
  renderer.draw(state, 0, FRAME, present);
}
/** The machine press: ONE step with it held (it is taken on the press),
 * then the frame's second without. */
function press(): void {
  step(state, { ...NEUTRAL_INPUT, machine: true });
  step(state, NEUTRAL_INPUT);
  renderer.draw(state, 0, FRAME, false);
}
function still(): void {
  renderer.draw(state, 0, FRAME, true);
}

/** THE PARTY: in the valley lodge, `s` s on. */
function inside(s: number): string {
  if (!state.afterski?.inside) {
    const lodge = lodgesOf(level)[0];
    if (!lodge) return "no lodge on this map";
    const door = doorOf(lodge);
    standSkier(state, door.x, door.z, door.heading);
    state.skier.buzz = 0;
    press();
    if (!state.afterski?.inside) return "the door did not take him";
  }
  while ((state.afterski?.t ?? 0) < s) frame(NEUTRAL_INPUT, false);
  still();
  const a = state.afterski!;
  return `in ${a.inside}, ${a.t.toFixed(1)} s, ${a.beers} beers, buzz ${(state.skier.buzz ?? 0).toFixed(2)}${a.sip >= 0 ? ", drinking" : ""}`;
}

/** Out of any lodge and stood on the piste `s` m down it at `speed`. */
function onPiste(s: number, speed: number): void {
  if (state.afterski?.inside) press();
  const p = trackPointAt(level, s);
  placeRun(state, { x: p.x, z: p.z, heading: p.heading, speed });
}

/** SKIING WITH A BUZZ of `b`, through `rung` (helmet or chase). */
function buzzed(b: number, rung: "helmet" | "chase"): string {
  onPiste(level.track.length * 0.35, 12);
  state.skier.buzz = b;
  renderer.setCamera(rung, true);
  for (let i = 0; i < 90; i++) frame(null, false);
  state.skier.buzz = b;
  still();
  return `buzz ${b.toFixed(2)} on the ${rung} rung, ${(state.skier.speed * 3.6).toFixed(0)} km/h`;
}

/** THE FALL AND THE FETCH: thrown once, then `s` s after it. */
let fell: { x: number; z: number; heading: number; t: number } | null = null;
function fetchAt(s: number): string {
  if (!fell) {
    onPiste(level.track.length * 0.4, 11);
    state.skier.buzz = 0.9;
    frame(NEUTRAL_INPUT, false);
    const c = state.skier;
    throwRider(state, "catch", { x: c.vx * 1.2, y: 1, z: c.vz * 1.2 }, state.events);
    fell = { x: c.x, z: c.z, heading: c.heading, t: state.t };
  }
  while (state.t - fell.t < s) frame(NEUTRAL_INPUT, false);
  const c = state.skier;
  // The lens planted off his line, far enough back for him and both skis.
  const side = fell.heading + Math.PI / 2;
  const mx = (fell.x + c.x) / 2 + Math.sin(fell.heading) * 6;
  const mz = (fell.z + c.z) / 2 + Math.cos(fell.heading) * 6;
  const ex = mx + Math.sin(side) * 16;
  const ez = mz + Math.cos(side) * 16;
  const lens: LensPose = {
    eye: { x: ex, y: level.groundAt(ex, ez) + 4.5, z: ez },
    target: { x: mx, y: level.groundAt(mx, mz) + 0.6, z: mz },
    fov: 50,
    roll: 0,
  };
  renderer.setOverride(lens);
  still();
  renderer.setOverride(null);
  const f = c.fetch;
  const what = c.thrown
    ? "down"
    : f
      ? `${f.phase}, ${f.carried.filter(Boolean).length} carried`
      : "skiing on";
  return `${s} s after the fall: ${what}`;
}

window.__afterski = {
  ready: renderer.load(state),
  async shoot(name) {
    const inside_ = /^inside-(\d+(?:\.\d+)?)$/.exec(name);
    const eyes = /^(eyes|chase)-(\d+(?:\.\d+)?)$/.exec(name);
    const fetch = /^fetch-(\d+(?:\.\d+)?)$/.exec(name);
    let note: string;
    if (inside_) note = inside(Number(inside_[1]));
    else if (eyes) note = buzzed(Number(eyes[2]), eyes[1] === "eyes" ? "helmet" : "chase");
    else if (fetch) note = fetchAt(Number(fetch[1]));
    else if (name.startsWith("lodge")) {
      const view = cabinView(level, name);
      if (!view) note = "no lodge on this map";
      else {
        renderer.setOverride(view.pose);
        for (let i = 0; i < 4; i++) renderer.draw(state, 0, FRAME, false);
        still();
        renderer.setOverride(null);
        note = view.note;
      }
    } else throw new Error(`no view "${name}"`);
    label.textContent = `${name.toUpperCase()} · seed ${seed} · ${note}`;
    // The HUD's own afterski readouts over the picture, as the run shows
    // them (not on the lodge views, which are of the building).
    const reading = name.startsWith("lodge") ? null : afterskiOf(state);
    const buzz = state.skier.buzz ?? 0;
    render(
      h("div", { class: "hud" }, [
        reading
          ? h(AfterskiReadout, {
              afterski: reading,
              touch: false,
              machineKey: "ENTER",
              jumpKey: "SPACE",
              onPress: () => {},
              onDrink: () => {},
            })
          : null,
        buzz > 0.005 ? h(BuzzMeter, { buzz }) : null,
      ]),
      hud,
    );
    return { name, note };
  },
};
