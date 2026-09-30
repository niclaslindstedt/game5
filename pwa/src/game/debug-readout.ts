// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE DEVELOPER OVERLAY READS, and THE REPRO LINE — DOM-free, so
// `tests/benchmark_test.ts` holds both without a browser; `debug-hud.tsx` is
// the markup over it and `dev-tools.ts` the rig that fills it.
//
// THE REPRO LINE is the frame on screen as a URL: the seed, the mode, the
// skis, how far into the run (`t`), the camera, the sky, and where the
// player's skis stands (`pose`). `url-params.ts` reads every one of them
// back: `?t=` pre-rides the run with the BOT to that second — the clock, the
// lights, the field and the checkpoints owed — and `?pose=` then stands the
// player's skis where it was, at its speed. So a frame somebody finds by
// poking at the game can be handed to somebody else, which is the whole
// point of a developer page (game2's `[STAGE] … [REPRO]` block, ported).
//
// What a link cannot carry is how the player RODE to that moment: the field
// in a repro is where the bot's run would have left it. A frame whose bug is
// in the field's positions is a replay's to show, not a link's.

import { weatherOf, type GameMode, type GameState } from "@engine";

import type { FrameCost } from "./benchmark-report.ts";
import type { CameraRung } from "./renderer-api.ts";

/** Everything a repro link names. */
export type ReproFacts = {
  seed: number;
  mode: GameMode;
  skis: string;
  /** Seconds into the run. */
  t: number;
  camera: CameraRung;
  weather: string;
  /** The start hour the map's sun was dealt (or asked for). */
  hour: number;
  pose: SkisPose;
};

/** Where the player's skis stands: plan position, heading, forward speed. */
export type SkisPose = { x: number; z: number; heading: number; speed: number };

/** The facts off a run. */
export function reproOf(state: GameState, mode: GameMode, camera: CameraRung): ReproFacts {
  const s = state.skier;
  return {
    seed: state.seed,
    mode,
    skis: s.spec.id,
    t: state.t,
    camera,
    weather: weatherOf(state.level).kind,
    hour: state.level.sun.hour,
    pose: { x: s.x, z: s.z, heading: s.heading, speed: s.way },
  };
}

const round = (v: number, dp: number): number => Number(v.toFixed(dp));

/** THE QUERY that stands the frame up again — exactly the spelling
 * `url-params.ts` reads. `splash=0` rides along: a link handed to somebody
 * is a link they want to land IN the frame. */
export function reproQuery(f: ReproFacts): string {
  const q = new URLSearchParams();
  q.set("start", f.mode === "free" ? "free" : "race");
  q.set("seed", String(f.seed));
  if (f.mode === "timeTrial") q.set("mode", "trial");
  if (f.mode === "tricks") q.set("mode", "tricks");
  q.set("skis", f.skis);
  q.set("t", String(round(f.t, 2)));
  q.set("camera", f.camera);
  q.set("weather", f.weather);
  q.set("hour", String(round(f.hour, 2)));
  const p = f.pose;
  q.set("pose", [round(p.x, 1), round(p.z, 1), round(p.heading, 3), round(p.speed, 1)].join(","));
  q.set("splash", "0");
  return `?${q.toString()}`;
}

/** A `?pose=x,z,heading,speed` read back, or null for anything else. */
export function readPose(raw: string | null): SkisPose | null {
  if (raw === null) return null;
  const n = raw.split(",").map(Number);
  if (n.length < 3 || n.length > 4 || n.some((v) => !Number.isFinite(v))) return null;
  return { x: n[0], z: n[1], heading: n[2], speed: n[3] ?? 0 };
}

/** One station where a ski meets the snow, as the overlay lists it. */
export type ProbeRow = {
  /** `tip L`, `mid R`, `tail L`… */
  name: string;
  touching: boolean;
  /** N. */
  load: number;
  /** How far under the untouched surface, cm. */
  sink: number;
  /** The leg's compression, cm. */
  travel: number;
};

/** THE PHYSICS READOUTS: every station, and the skier's own figures. */
export type PhysicsRead = {
  probes: ProbeRow[];
  /** Share of the load on packed snow, %. */
  packed: number;
  speed: number;
  way: number;
  /** The edge the skis stand on, degrees, signed like the steer. */
  edge: number;
  /** How far across the way the skis are pivoted by the brake, %. */
  skid: number;
  airborne: boolean;
  /** The run's snow dial. */
  snowDepth: number;
};

export function physicsOf(state: GameState): PhysicsRead {
  const s = state.skier;
  return {
    probes: s.contacts.map((c) => {
      const side = c.side < 0 ? "L" : c.side > 0 ? "R" : "C";
      return {
        name: `${c.station} ${side}`,
        touching: c.touching,
        load: Math.round(c.load),
        sink: round(c.sink * 100, 1),
        travel: round(c.compression * 100, 1),
      };
    }),
    packed: Math.round(s.packed * 100),
    speed: s.speed,
    way: s.way,
    edge: Math.round((s.edge * 180) / Math.PI),
    skid: Math.round(s.skid * 100),
    airborne: s.airborne,
    snowDepth: state.snowDepth,
  };
}

/** Everything the overlay draws, refreshed on the HUD's tick. */
export type DebugSnapshot = {
  /** Smoothed frames a second, and the frame's own ms. */
  fps: number | null;
  frameMs: number;
  /** The renderer's own bill for the last frame, and the engine's steps. */
  cost: (FrameCost & { simMs: number }) | null;
  physics: PhysicsRead | null;
  /** The engine's last lines of output (`output-bridge.ts`). */
  log: string[] | null;
  /** Whether the free camera has the lens. */
  freefly: boolean;
  repro: string;
};
