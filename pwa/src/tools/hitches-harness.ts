// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HITCHES LAB's page (`scripts/hitches.mjs`): a free ride stood up the
// way the app stands one (the world built, its programs compiled behind the
// card), and then ONE moment that has been felt as a hitch on a phone played
// through the game's own renderer a frame at a time — every frame drawn and
// timed, the programs the driver linked during it counted (the driver's
// init script counts `linkProgram`), and the frames that stood out named
// with the clock they fell at.
//
//   ride      the baseline: the free ride, the player held, nothing called
//   crowd     an amateur down hurt in view, the call made, the machine in
//   rescue    the run after an injured one: the air ambulance flown in
//   police    the run after a death: the police machine flown in, the scene
//   sleds     the ski patrol driven up where no machine can land
//   steal     the police machine landed, taken from under its crew, flown up
//
// One scenario a page load, so each is met as a phone meets it: nothing of
// it compiled or built before. `window.__hitches.run()` hands back every
// frame's cost and the programs linked during it.

import {
  NEUTRAL_INPUT,
  createGame,
  generateLevel,
  heliDoor,
  placeRun,
  standSkier,
  throwAmateur,
  TUNING,
  type GameState,
  type RegionId,
} from "@engine";

import { createWorldRenderer, loadModels } from "../game/renderer.ts";
import { SETTLE, stepRun } from "../game/crowd-calls.ts";
import { bookRun, createRescueBook } from "../game/rescue-book.ts";
import { DEFAULT_VIDEO, TIERS, withPreset, type Tier } from "../game/settings-video.ts";
import { sledSpot } from "./rescue-sleds-views.ts";

/** One frame: the run's clock, its wall cost (draw and the GPU's finish),
 * ms, and the programs linked while it drew. */
type Row = { t: number; ms: number; links: number };

declare global {
  interface Window {
    __hitches?: { ready: Promise<string>; run(): Promise<{ note: string; rows: Row[] }> };
    /** Programs linked so far (the driver's init script). */
    __links?: number;
  }
}

const params = new URLSearchParams(location.search);
const scenario = params.get("scenario") ?? "ride";
const seed = Number(params.get("seed") ?? 2);
const share = Number(params.get("at") ?? 0.45);
const region = (params.get("region") || undefined) as RegionId | undefined;
const tier = (TIERS as readonly string[]).includes(params.get("quality") ?? "")
  ? (params.get("quality") as Tier)
  : "low";
const width = Number(params.get("w") ?? 320);
const height = Number(params.get("h") ?? 180);
const FRAME = 1 / Number(params.get("fps") ?? 30);
const STEPS = Math.round(FRAME / TUNING.dt);

const canvas = document.getElementById("stage") as HTMLCanvasElement;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;

await loadModels();
const renderer = createWorldRenderer(canvas, { video: withPreset(DEFAULT_VIDEO, tier) });
renderer.resize(width, height, 1);
const gl = renderer.gl.getContext();
const pixel = new Uint8Array(4);

const level = generateLevel(seed, { region });
const pts = level.track.points;
const fell = pts[Math.floor(pts.length * share)];
const up = (back: number) => pts.find((p) => p.s >= fell.s - back) ?? pts[0];

const fresh = (opts: { gore?: boolean; crowd?: number } = {}): GameState =>
  createGame({
    level,
    seed,
    region,
    mode: "free",
    gore: opts.gore ?? false,
    sfw: !opts.gore,
    crowd: opts.crowd ?? 60,
    quiet: true,
  });

/** The run the scenario plays, and how it is stood up. */
function stage(): { s: GameState; note: string } {
  if (scenario === "crowd") {
    const s = fresh();
    const a = s.crowd!.amateurs.find((m) => m.mode === "ski")!;
    a.x = fell.x;
    a.z = fell.z;
    a.y = level.groundAt(fell.x, fell.z);
    a.heading = fell.heading;
    throwAmateur(a, 1, "roll");
    a.timer = 2;
    a.hurt = true;
    return { s, note: `an amateur down at s ${fell.s.toFixed(0)} m` };
  }
  if (scenario === "rescue" || scenario === "police" || scenario === "steal") {
    const ended = fresh({ gore: true });
    placeRun(ended, { x: fell.x, z: fell.z, heading: fell.heading });
    if (scenario === "rescue") ended.gore!.injured = 0;
    else ended.gore!.dead = 0;
    const s = fresh({ gore: true });
    bookRun(createRescueBook(), ended, s);
    return { s, note: `${s.rescue?.[0]?.kind ?? "no"} call at s ${fell.s.toFixed(0)} m` };
  }
  if (scenario === "sleds") {
    const spot = sledSpot(level, share);
    const ended = fresh({ gore: true });
    if (spot) standSkier(ended, spot.x, spot.z, 0);
    ended.gore!.injured = 0;
    const s = fresh({ gore: true });
    bookRun(createRescueBook(), ended, s);
    return { s, note: `${s.rescue?.[0]?.kind ?? "no"} call` };
  }
  return { s: fresh(), note: "nothing called" };
}

const { s, note } = stage();
const held = scenario === "sleds" && s.rescue?.[0]?.sleds ? s.rescue[0].sleds.park[0] : null;
const stand = held
  ? {
      x: held.x - Math.sin(held.heading) * 40,
      z: held.z - Math.cos(held.heading) * 40,
      heading: held.heading,
    }
  : { ...up(70) };

const ready = (async () => {
  standSkier(s, stand.x, stand.z, stand.heading);
  await renderer.load(s);
  renderer.setCamera("chase", true);
  for (let i = 0; i < 4; i++) renderer.draw(s, 1, FRAME);
  await new Promise((done) => setTimeout(done, 2000));
  await renderer.shadeSettled();
  return note;
})();

/** One frame of the run: stepped as the app steps it, drawn, and waited on
 * to the GPU's end (one pixel read back), timed. */
function frame(rows: Row[], input = NEUTRAL_INPUT, hold = true): void {
  for (let i = 0; i < STEPS; i++) {
    if (hold) standSkier(s, stand.x, stand.z, stand.heading);
    stepRun(s, input);
  }
  const links = window.__links ?? 0;
  const t0 = performance.now();
  renderer.draw(s, 1, FRAME);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  rows.push({ t: s.t, ms: performance.now() - t0, links: (window.__links ?? 0) - links });
}

/** Frames played until the run's clock reaches `t`. */
function until(rows: Row[], t: number, input = NEUTRAL_INPUT, hold = true): void {
  while (s.t < t) frame(rows, input, hold);
}

async function run(): Promise<{ note: string; rows: Row[] }> {
  await ready;
  const rows: Row[] = [];
  const call = (): NonNullable<GameState["rescue"]>[number] | undefined => s.rescue?.[0];
  if (scenario === "ride") until(rows, s.t + 8);
  else if (scenario === "crowd") {
    until(rows, SETTLE + 1);
    const c = call();
    if (c) until(rows, c.down + 12);
  } else if (scenario === "steal") {
    const c = call();
    if (!c) return { note, rows };
    // Fast to the landing: stepped, not drawn, the machine in and down.
    while (s.t < c.down + 6)
      for (let i = 0; i < STEPS; i++) {
        standSkier(s, stand.x, stand.z, stand.heading);
        stepRun(s, NEUTRAL_INPUT);
      }
    const door = heliDoor(c.site);
    const ax = door.x - c.site.x;
    const az = door.z - c.site.z;
    const d = Math.hypot(ax, az) || 1;
    placeRun(s, {
      x: door.x + (ax / d) * 1,
      z: door.z + (az / d) * 1,
      heading: Math.atan2(-ax, -az),
    });
    until(rows, s.t + 1, NEUTRAL_INPUT, false);
    const hands = (collective: number, pitch = 0) => ({
      ...NEUTRAL_INPUT,
      heli: { collective, pitch, roll: 0, pedal: 0 },
    });
    stepRun(s, { ...hands(0), machine: true });
    until(rows, s.t + 1.5, hands(0), false);
    until(rows, s.t + 8, hands(0.9), false);
    until(rows, s.t + 6, hands(0.8, 0.25), false);
  } else {
    const c = call();
    if (!c) return { note, rows };
    const end = c.kind === "sled" && c.sleds ? c.start + c.sleds.parked[0] + 12 : c.down + 15;
    until(rows, end);
  }
  return { note, rows };
}

window.__hitches = { ready, run };
