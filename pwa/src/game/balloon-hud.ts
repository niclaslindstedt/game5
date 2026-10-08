// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON AS THE HUD READS IT (`balloon.ts`) — DOM-free, so the
// suite reads it; `hud-balloon.tsx` draws it. While the skier is in the
// basket: what a balloon pilot's instrument pack shows him — the height
// over the snow under him and over the sea, the variometer, the
// envelope's temperature against its red line, the propane left — and the
// wind he drifts on, which way it carries him; and the CALL the moment asks
// for, the most urgent first.

import { BALLOON, type BalloonState, type GameState } from "@engine";

import { SCREEN_TO_ENGINE } from "./input-model.ts";

/** WHAT THE MOMENT ASKS OF HIM, the most urgent first:
 *   * `fire`  — the envelope alight: over the side;
 *   * `hot`   — past the fabric's working limit: off the burner;
 *   * `sink`  — falling at the snow fast and low: burn;
 *   * `empty` — the propane gone: it comes down;
 *   * `tether` — held on its tether: burn to be let go;
 *   * `landed` — set down and still: he may step out;
 *   * `burn`  — the burner roaring;
 *   * null    — nothing to say. */
export type BalloonCall = "fire" | "hot" | "sink" | "empty" | "tether" | "landed" | "burn" | null;

export type HudBalloon = {
  /** Over the snow under the basket, m; over the sea, m (null on a map with
   * no sea); the climb, m/s. */
  agl: number;
  sea: number | null;
  climb: number;
  /** The envelope's air, °C, and the fabric's working limit, °C. */
  temp: number;
  limit: number;
  /** The propane left, kg, and as a share of a full load. */
  fuel: number;
  fuelShare: number;
  /** The wind at the envelope, km/h, and the way it carries him as a screen
   * angle off the basket's heading (0 straight ahead, clockwise), rad. */
  windKmh: number;
  windAngle: number;
  /** How fast the basket goes over the snow, km/h — what the speed dial
   * reads while he is in it (it drifts with the wind it is in, so this
   * and the wind come together once it has caught up). */
  groundKmh: number;
  /** The blast valve open; the parachute valve's opening, 0..1. */
  burning: boolean;
  vent: number;
  /** The scorch toward alight, 0..1 — the HUD's warning before a fire. */
  scorch: number;
  call: BalloonCall;
};

/** A climb or a sink worth calling, m/s, and the height under which a sink
 * that fast is called, m. */
const SINK = { fast: 2.8, low: 80 };

/** THE CALL for this state of the balloon. */
export function balloonCall(b: BalloonState): BalloonCall {
  if (b.burning) return "fire";
  if (b.temp >= BALLOON.temp.limit) return "hot";
  if (b.mode === "tethered") return "tether";
  if (!b.grounded && b.climb < -SINK.fast && b.agl < SINK.low) return "sink";
  if (b.fuel <= 0) return "empty";
  if (b.grounded && Math.hypot(b.vx, b.vy, b.vz) <= BALLOON.land.stepOut) return "landed";
  if (b.valve) return "burn";
  return null;
}

/** The balloon's readout for the player at this step, while he is in the
 * basket and on his feet in it. */
export function balloonOf(state: GameState): HudBalloon | null {
  const b = state.balloon;
  if (!b || !b.aboard || state.skier.thrown) return null;
  const sea = state.level.mountain ? b.y - state.level.mountain.sea : null;
  // The wind's way in the basket's own frame, onto the screen through the
  // one flip the input model owns.
  const way = Math.atan2(b.windX, b.windZ) - b.heading;
  return {
    agl: Math.max(0, b.agl),
    sea,
    climb: b.climb,
    temp: b.temp,
    limit: BALLOON.temp.limit,
    fuel: b.fuel,
    fuelShare: Math.max(0, Math.min(1, b.fuel / BALLOON.mass.fuel)),
    windKmh: b.wind * 3.6,
    windAngle: Math.atan2(Math.sin(way) * SCREEN_TO_ENGINE, Math.cos(way)),
    groundKmh: Math.hypot(b.vx, b.vz) * 3.6,
    burning: b.valve,
    vent: b.vent,
    scorch: b.scorch,
    call: balloonCall(b),
  };
}
