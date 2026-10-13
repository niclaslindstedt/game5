// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE AND THE SKYDIVE AS THE HUD READS THEM — DOM-free, so the
// suite reads them (`tests/plane_hud_test.ts`); drawn by `hud-plane.tsx`.
//
//   * THE PLANE (`planeOf`): flown from its door — the airspeed, the height
//     over the snow and over the sea, the climb, the power and the flap
//     levers, the attitude for the horizon, the load and the stall horn, and
//     the press the machine key is now (JUMP in the air, STEP OFF stopped on
//     the snow, nothing rolling) — or parked on its strip near him, its way
//     and the press that takes him aboard.
//   * THE SKYDIVE (`chuteOf`): from the door to the snow — what it is doing,
//     the altimeter, the fall, the air through the canopy, the PULL cue at a
//     sport jumper's pull height, and the press the machine key is now: OPEN
//     in freefall (once the tail has passed over him), CUT AWAY under an open
//     canopy, nothing while it opens; caught in a crown or on a lift, the
//     reset that begins it again.

import {
  CHUTE,
  PLANE,
  WINGSUIT,
  exitClear,
  planeWithin,
  type ChuteMode,
  type GameState,
} from "@engine";

import { SCREEN_TO_ENGINE } from "./input-model.ts";

/** THE PLANE as the HUD reads it. */
export type HudPlane =
  | {
      kind: "flown";
      /** The airspeed, m/s; the height over the snow under it and over the
       * sea, m; the climb, m/s. */
      speed: number;
      height: number;
      altitude: number;
      climb: number;
      /** The power lever, 0..1, and the flaps' setting, deg. */
      throttle: number;
      flaps: number;
      /** The attitude as the horizon shows it: nose-up pitch, rad, and the
       * bank as SCREEN rad (right side down positive as the player sees
       * it). */
      pitch: number;
      bank: number;
      /** The load on the airframe, g, and the stall horn (enough of the
       * wing let go of its air to hear). */
      load: number;
      stall: boolean;
      /** On the snow, and what the machine key does now. */
      grounded: boolean;
      press: "jump" | "stepoff" | null;
    }
  | { kind: "waiting"; away: number; near: boolean };

/** How near the parked plane the HUD names it to him, m. */
const PLANE_CALL = 120;
/** The share of the wing stalled the horn sounds at. */
const HORN = 0.25;
/** The height over the snow the door is a jump at, m (`plane.ts`'s). */
const JUMP_FROM = 1.5;

/** The plane's readout for the player at this step. */
export function planeOf(state: GameState): HudPlane | null {
  const p = state.plane;
  if (!p) return null;
  if (p.rider) {
    const moving = Math.hypot(p.vx, p.vy, p.vz);
    const sea = state.level.mountain?.sea ?? 0;
    return {
      kind: "flown",
      speed: p.airspeed,
      height: Math.max(0, p.agl),
      altitude: p.y - sea,
      climb: p.vy,
      throttle: p.controls.throttle,
      flaps: p.surfaces.flaps * PLANE.controls.flaps * (180 / Math.PI),
      pitch: p.pitch,
      bank: p.roll * SCREEN_TO_ENGINE,
      load: p.load,
      stall: p.stalled >= HORN && !p.grounded,
      grounded: p.grounded,
      press:
        p.mode !== "flown"
          ? null
          : !p.grounded && p.agl > JUMP_FROM
            ? "jump"
            : moving <= PLANE.board.fastest
              ? "stepoff"
              : null,
    };
  }
  const c = state.skier;
  if (p.mode !== "parked" || c.thrown || c.lift || state.chute) return null;
  const away = Math.hypot(p.x - c.x, p.z - c.z);
  return away < PLANE_CALL ? { kind: "waiting", away, near: planeWithin(state) } : null;
}

/** THE WINGSUIT'S STRIP, over the skydive's (`HudChute.suit`): the glide
 * it flies (across over down, through the air), the air through it, m/s,
 * its sink, m/s (down positive), and the height closing on the pull — `warn`
 * inside the bot's slowing height, `low` at its pull height (and under). */
export type HudSuit = {
  glide: number;
  air: number;
  sink: number;
  warn: boolean;
  low: boolean;
};

/** THE SKYDIVE as the HUD reads it. */
export type HudChute = {
  /** `ready` is a wingsuit's alone: stood on its exit before the jump. */
  mode: Exclude<ChuteMode, "landed">;
  /** His height over the snow, m; his fall, m/s (down positive); the air
   * through him or the canopy, m/s. */
  height: number;
  fall: number;
  air: number;
  /** In freefall at or under the pull height: open now. */
  pull: boolean;
  /** The canopy stalled under the toggles. */
  stall: boolean;
  /** The canopy over him (or opening) is the reserve. */
  reserve: boolean;
  /** What the machine key does now: jump (off a wingsuit's exit), open the
   * main, cut away whatever canopy is over him (opening, flying or caught,
   * the reserve too), or — the main cut away — pull the reserve. */
  press: "jump" | "open" | "release" | "reserve" | null;
  /** In a wingsuit, flying it (or stood ready): its strip; null in the box
   * and under the canopy. */
  suit: HudSuit | null;
};

/** The skydive's readout for the player at this step: from the door to the
 * snow, and caught; gone once he is down on his skis or thrown. */
export function chuteOf(state: GameState): HudChute | null {
  const ch = state.chute;
  if (!ch || ch.done || ch.fell || ch.mode === "landed") return null;
  if (state.skier.thrown) return null;
  // A wingsuit's BASE rig has one canopy: nothing to cut away, no reserve.
  const suited = ch.suit === "wingsuit";
  if (ch.mode === "ready" && !suited) return null;
  const spare = !suited && !ch.reserve;
  const falling = ch.mode === "exit" || ch.mode === "freefall";
  const pullAt = suited ? WINGSUIT.bot.open : CHUTE.bot.open;
  const clear = suited ? WINGSUIT.exit.clear : exitClear(ch.from);
  const w = ch.wing;
  return {
    mode: ch.mode,
    height: Math.max(0, ch.agl),
    fall: ch.fall,
    air: ch.airspeed,
    pull: falling && ch.agl <= pullAt,
    stall: ch.mode === "open" && ch.stalled,
    reserve: ch.reserve,
    press:
      ch.mode === "ready"
        ? "jump"
        : (ch.mode === "exit" && ch.since >= clear) || ch.mode === "freefall"
          ? "open"
          : !suited && (ch.mode === "open" || ch.mode === "deploying" || ch.mode === "snagged")
            ? "release"
            : ch.mode === "released" && spare && ch.agl > CHUTE.handover
              ? "reserve"
              : null,
    suit:
      suited && (falling || ch.mode === "ready")
        ? {
            glide: w && falling ? w.glide : 0,
            air: ch.airspeed,
            sink: ch.fall,
            warn: falling && ch.agl <= WINGSUIT.bot.slow,
            low: falling && ch.agl <= pullAt,
          }
        : null,
  };
}

/** Whether a machine on the snow may call him: not while he flies the
 * plane or falls from it. */
export function aloftInPlane(state: GameState): boolean {
  return !!state.plane?.rider || !!(state.chute && !state.chute.done && !state.chute.fell);
}

/** How long he has stood on his boots after a wingsuit's landing before the
 * plate asks what next, s: the run-out walked off first. */
export const SUIT_LANDED_AFTER = 1.5;

/** DOWN OUT OF A WINGSUIT, on his boots and unhurt: with no skis on him
 * there is nothing to ski on, so the HUD offers the way on — again, the
 * piste map, or out (`hud-result.tsx`'s `LandedPlate`). */
export function suitLandedOf(state: GameState): boolean {
  const ch = state.chute;
  return (
    !!ch &&
    ch.suit === "wingsuit" &&
    ch.mode === "landed" &&
    !ch.fell &&
    !state.skier.thrown &&
    ch.t >= SUIT_LANDED_AFTER
  );
}
