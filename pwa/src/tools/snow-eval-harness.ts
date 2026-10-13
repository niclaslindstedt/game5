// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW EVAL LAB's page (driven by `scripts/snow-eval-preview.mjs`): the
// snow a skier and a boarder meet, cut, throw and fall into, as the game
// draws it — the SHARED SCENES an eval round over the snow's effects is
// judged on, every candidate shot from the same spots at the same moments:
//
//   carve      linked carves on the groomer, the Chamois at 55 km/h
//   hockey     a hockey stop on skis from 45 km/h
//   heel       a snowboard's heelside stop from 40 km/h (the Lynx)
//   toe        ...and its toeside stop
//   powder     linked turns in the open meadow's deep powder, 35 km/h
//   crater     a fall in deep powder: the body down in the hole it made
//   track      the line a carve left, seen back up the slope from below
//
// each under a LIGHT — `day` (the sun 35° up, the lens off the skier's
// front quarter) or `low` (the sun 7° up and the hero lens looking INTO it,
// the spray backlit) — from two lenses: the game's own CHASE rung and a
// HERO lens placed for the scene. Each cell comes back as its own picture
// too, so a judge can set one candidate's beside another's.
//
// `perf` times the carve scene's drawn frames at the LOW, MEDIUM and HIGH
// pictures (ms a frame; swiftshader in a lab, so a RELATIVE readout).

import {
  createGame,
  edgeSideOf,
  NEUTRAL_INPUT,
  pairById,
  placeRun,
  step,
  sunAtRun,
  withSky,
  type GameState,
  type Level,
  type SkiSpec,
  type SkyOverride,
} from "@engine";

import type { Hideable } from "../game/benchmark-report.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import { holdInput, type HoldMove } from "../game/hold-input.ts";
import { createWorldRenderer, type WorldRendererExt } from "../game/renderer.ts";
import { DEFAULT_VIDEO, withPreset, type Tier } from "../game/settings-video.ts";
import { meadow as openPowder } from "./powder-lab.ts";
import { hourAt, meadow, pisteSpot } from "./stage.ts";

declare global {
  interface Window {
    __snowEval?: {
      ready: Promise<void>;
      /** Shoot `scenes` under `light`; resolves to each cell's picture. */
      shoot(
        scenes: string[],
        light: string,
      ): Promise<{ name: string; note: string; url: string }[]>;
      /** Time the carve scene at each tier, ms a frame. */
      perf(tiers: string[], frames: number): Promise<{ tier: string; ms: number }[]>;
    };
  }
}

const params = new URLSearchParams(location.search);
const seed = Number(params.get("seed") ?? 38);
const cellW = Number(params.get("w") ?? 640);
const cellH = Number(params.get("h") ?? 400);
const DEG = Math.PI / 180;
const FRAME = 1 / 60;

type Scene = {
  /** The pair ridden. */
  pair: string;
  /** Where: the piste's groomer or the meadow's deep powder. */
  where: "piste" | "meadow";
  move: HoldMove | "fall";
  kmh: number;
  /** The moment shot, s into the move (or after he left his skis). */
  t: number;
  /** A board's stop is mirrored onto the other edge. */
  mirror?: boolean;
  /** The snow dial. */
  depth: number;
  /** How far down the piste it is ridden, 0..1 — every scene on snow of
   * its own, so no scene's tracks lie under another's. */
  at?: number;
};

export const SCENES: Record<string, Scene> = {
  carve: { pair: "chamois", where: "piste", move: "carve", kmh: 55, t: 1.55, depth: 1, at: 1 / 3 },
  hockey: { pair: "chamois", where: "piste", move: "stop", kmh: 45, t: 0.75, depth: 1, at: 0.26 },
  heel: {
    pair: "lynx",
    where: "piste",
    move: "stop",
    kmh: 40,
    t: 0.75,
    mirror: true,
    depth: 1,
    at: 0.4,
  },
  toe: { pair: "lynx", where: "piste", move: "stop", kmh: 40, t: 0.75, depth: 1, at: 0.47 },
  powder: { pair: "chamois", where: "meadow", move: "carve", kmh: 35, t: 1.6, depth: 2.5 },
  crater: { pair: "chamois", where: "meadow", move: "fall", kmh: 12, t: 3, depth: 2.5 },
  track: { pair: "chamois", where: "piste", move: "carve", kmh: 55, t: 6, depth: 1, at: 0.6 },
};

const stage = document.getElementById("stage") as HTMLCanvasElement;
const renderer: WorldRendererExt = createWorldRenderer(stage, {
  video: withPreset(DEFAULT_VIDEO, (params.get("quality") as Tier) || "high"),
  preserveDrawingBuffer: true,
});
renderer.resize(cellW, cellH, 1);
/** The page's own scene: the renderer is loaded for its pair and its
 * snow, and nobody else's tracks are on the map. */
const own = SCENES[params.get("scene") ?? "carve"] ?? SCENES.carve;
const first: GameState = createGame({
  seed,
  mode: "free",
  rivals: 0,
  quiet: true,
  crowd: 0,
  enthusiasts: 0,
  spec: pairById(own.pair),
  snowDepth: own.depth,
});
const level: Level = first.level;

/** A spot on the meadow down its fall line. */
function meadowSpot(): { x: number; z: number; heading: number } {
  const m = meadow(level);
  const n = { x: 0, y: 1, z: 0 };
  level.normalAt(m.x, m.z, n);
  const fall = Math.hypot(n.x, n.z) > 0.05 ? Math.atan2(n.x, n.z) : 0;
  return { x: m.x, z: m.z, heading: fall };
}

/** The input that lays him down in deep snow (the world lab's powder fall). */
const LAID_DOWN = { ...NEUTRAL_INPUT, steer: 1, brake: 1, lean: 1 };

/** Ride one scene to its moment, drawing every frame so the trail maps,
 * the spray and the cloud have lived through it. */
function ride(scene: Scene): { state: GameState; spot: { x: number; z: number; heading: number } } {
  const spec: SkiSpec = pairById(scene.pair);
  const state = createGame({
    level,
    mode: "free",
    rivals: 0,
    quiet: true,
    crowd: 0,
    enthusiasts: 0,
    spec,
    snowDepth: scene.depth,
  });
  const spot = scene.where === "meadow" ? meadowSpot() : pisteSpot(level, scene.at ?? 1 / 3);
  placeRun(state, { x: spot.x, z: spot.z, heading: spot.heading, speed: scene.kmh / 3.6 });
  renderer.setOverride(null);
  renderer.setCamera("chase", true);
  renderer.draw(state, 0, FRAME, false);
  const t0 = state.t;
  if (scene.move === "fall") {
    // The world lab's powder fall: stood in open powder at a crawl, edged
    // hard over with the weight back until the snow lays him down — and in
    // the next meadow on if this one's snow would not.
    for (let tries = 0; tries < 3 && !state.skier.thrown; tries++) {
      const open = openPowder(state);
      if (!open) break;
      placeRun(state, { x: open.x, z: open.z, heading: open.heading, speed: scene.kmh / 3.6 });
      renderer.draw(state, 0, FRAME, false);
      const until = state.t + 8;
      while (!state.skier.thrown && state.t < until) {
        for (let i = 0; i < 2; i++) step(state, LAID_DOWN);
        renderer.draw(state, 0, FRAME, false);
      }
    }
    while (state.skier.thrown && state.skier.thrown.t < scene.t) {
      for (let i = 0; i < 2; i++) step(state, NEUTRAL_INPUT);
      renderer.draw(state, 0, FRAME, false);
    }
    return { state, spot };
  }
  while (state.t - t0 < scene.t) {
    for (let i = 0; i < 2; i++) {
      const input = holdInput(state, scene.kmh, spot.heading, scene.move, state.t - t0);
      step(state, scene.mirror ? { ...input, steer: -input.steer } : input);
    }
    renderer.draw(state, 0, FRAME, false);
  }
  return { state, spot };
}

/** The hero lens: off the skier's front quarter by day, INTO the sun when
 * it is low (the spray backlit); over the hole for the crater; back up the
 * slope along the line for the track. */
function heroOf(name: string, state: GameState, light: string, sunAz: number): LensPose {
  const s = state.skier;
  const at = (x: number, z: number, up: number) => ({ x, y: level.groundAt(x, z) + up, z });
  const body = s.thrown ?? s;
  if (name === "track") {
    // From ahead of him and to one side, looking back up the slope at the
    // groove he left, low over the snow.
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const eye = at(s.x + fx * 3 + fz * 2, s.z + fz * 3 - fx * 2, 2.4);
    const tgt = at(s.x - fx * 12, s.z - fz * 12, 0);
    return { eye, target: tgt, fov: 50, roll: 0 };
  }
  if (name === "crater") {
    const a = light === "low" ? sunAz + Math.PI : s.heading + Math.PI / 2;
    const eye = at(body.x + Math.sin(a) * 3.2, body.z + Math.cos(a) * 3.2, 2.2);
    return {
      eye,
      target: { x: body.x, y: level.groundAt(body.x, body.z) - 0.3, z: body.z },
      fov: 52,
      roll: 0,
    };
  }
  // Day: the front quarter on his right; low: from the far side of him
  // from the sun, a little off the line so the sun's disc is beside him.
  const a = light === "low" ? sunAz + Math.PI + 0.25 : s.heading + 0.9;
  const r = 4.6;
  const eye = at(s.x + Math.sin(a) * r, s.z + Math.cos(a) * r, 0.9);
  const tgt = { x: s.x, y: level.groundAt(s.x, s.z) + 0.75, z: s.z };
  return { eye, target: tgt, fov: 46, roll: 0 };
}

function skyOf(light: string): SkyOverride {
  return { weather: "clear", hour: hourAt(level, (light === "low" ? 7 : 35) * DEG) };
}

function grab(): string {
  return stage.toDataURL("image/png");
}

/** What a diagnosis takes out of the picture (`?hide=cloud,spray`). */
const hidden = (params.get("hide") ?? "").split(",").filter(Boolean) as Hideable[];

window.__snowEval = {
  ready: renderer.load(first).then(() => renderer.setHidden(hidden, "lab")),
  async shoot(scenes, light) {
    const sky = skyOf(light);
    renderer.setSky(sky);
    const sunAz = sunAtRun(withSky(level, sky)).azimuth;
    const out: { name: string; note: string; url: string }[] = [];
    for (const name of scenes) {
      const scene = SCENES[name];
      if (!scene) continue;
      const { state } = ride(scene);
      const s = state.skier;
      const side = edgeSideOf(pairById(scene.pair), Math.sign(s.edge));
      const note = `${name} · ${light} · ${(s.speed * 3.6).toFixed(0)} km/h · edge ${(s.edge / DEG).toFixed(0)}°${side ? ` ${side}` : ""}${s.thrown ? ` · down ${s.thrown.t.toFixed(1)} s` : ""}`;
      // The game's own chase rung, settled a few frames on the spot.
      renderer.setOverride(null);
      renderer.draw(state, 0, 0, true);
      await renderer.shadeSettled();
      renderer.draw(state, 0, 0, true);
      out.push({ name: `${name}-${light}-chase`, note, url: grab() });
      renderer.setOverride(heroOf(name, state, light, sunAz));
      renderer.draw(state, 0, 0, true);
      out.push({ name: `${name}-${light}-hero`, note, url: grab() });
      renderer.setOverride(null);
      await new Promise((done) => setTimeout(done, 0));
    }
    renderer.setSky(null);
    return out;
  },
  async perf(tiers, frames) {
    const res: { tier: string; ms: number }[] = [];
    renderer.setSky(skyOf("day"));
    for (const tier of tiers) {
      renderer.setVideo(withPreset(DEFAULT_VIDEO, tier as Tier));
      const scene = SCENES.carve;
      const { state, spot } = ride({ ...scene, t: 1 });
      const t0 = performance.now();
      for (let f = 0; f < frames; f++) {
        for (let i = 0; i < 2; i++)
          step(state, holdInput(state, scene.kmh, spot.heading, "carve", 1 + f * FRAME));
        renderer.draw(state, 0, FRAME, true);
      }
      renderer.gl.getContext().finish();
      res.push({ tier, ms: (performance.now() - t0) / frames });
    }
    renderer.setSky(null);
    return res;
  },
};
