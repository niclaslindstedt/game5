// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S RETRO VIEWS (`make world ARGS="--look=retro-magenta
// --views=retro-back,retro-side,retro-front,retro-stand,retro-air,retro-crash"`):
// the player in an eighties LOOK (`retro-model.ts`) shot close in the
// game's own renderer, so the suit, the hat, the shades and above all the
// scarf's tails and the bobble in the wind (`retro-wind.ts`) are judged at
// the moments they matter — at speed from behind, beside and ahead of him,
// stood still at the start, in the air and thrown.

import type { GameState } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { lastRopes } from "../game/retro-model.ts";

/** Where each tail's end flew, m behind him along his way and up off his
 * centre of gravity: what the picture is meant to show. */
function tails(state: GameState): string {
  const s = state.skier;
  const way = Math.hypot(s.vx, s.vz) > 1 ? Math.atan2(s.vx, s.vz) : s.heading;
  const [fx, fz] = [Math.sin(way), Math.cos(way)];
  return lastRopes
    .slice(0, 2)
    .map((r, i) => {
      const e = r[r.length - 1];
      if (!e) return "";
      const back = -((e.x - s.x) * fx + (e.z - s.z) * fz);
      return `tail ${"ab"[i]} ${back.toFixed(2)} m back, ${(e.y - s.y).toFixed(2)} m up`;
    })
    .join(", ");
}

export type RetroLab = {
  rideUntil: (done: () => boolean, limit: number) => boolean;
  still: () => void;
  setOverride: (pose: LensPose | null) => void;
};

/** A lens `back` m behind him along his way, `side` m to his left, `up` m
 * over him, on his chest. */
function lensOn(state: GameState, back: number, side: number, up: number, fov = 32): LensPose {
  const s = state.skier;
  const way = Math.hypot(s.vx, s.vz) > 1 ? Math.atan2(s.vx, s.vz) : s.heading;
  const fx = Math.sin(way);
  const fz = Math.cos(way);
  const ex = s.x - fx * back - fz * side;
  const ez = s.z - fz * back + fx * side;
  const ground = state.level.groundAt(ex, ez);
  return {
    eye: { x: ex, y: Math.max(ground + 0.4, s.y + 0.2 + up), z: ez },
    target: { x: s.x, y: s.y + 0.2, z: s.z },
    fov,
    roll: 0,
  };
}

export function retroShots(state: GameState, lab: RetroLab): Record<string, () => string> {
  const shoot = (pose: LensPose, note: string): string => {
    lab.setOverride(pose);
    lab.still();
    lab.setOverride(null);
    return `${note}, ${(state.skier.speed * 3.6).toFixed(0)} km/h, t ${state.t.toFixed(1)} s · ${tails(state)}`;
  };
  const fast = (from: number) => () =>
    lab.rideUntil(
      () => state.t >= from && !state.skier.thrown && state.skier.speed > 14,
      from + 120,
    );
  return {
    "retro-stand"() {
      lab.rideUntil(() => state.t >= 1.2, 3);
      return shoot(lensOn(state, -3.2, 1.4, 0.2, 40), "on the start line");
    },
    "retro-back"() {
      fast(14)();
      return shoot(lensOn(state, 4.2, 0.6, 0.6), "at speed, from behind");
    },
    "retro-side"() {
      fast(state.t + 1)();
      return shoot(lensOn(state, 0.3, 4.2, 0.1), "at speed, from beside");
    },
    "retro-top"() {
      fast(state.t + 1)();
      return shoot(lensOn(state, 1.6, 0.5, 1.6, 34), "at speed, close over his back");
    },
    "retro-front"() {
      fast(state.t + 1)();
      return shoot(lensOn(state, -4.4, 1.2, 0.3), "at speed, from ahead");
    },
    "retro-air"() {
      const flew = lab.rideUntil(
        () => !state.skier.thrown && state.t > 3 && airborne(state),
        state.t + 300,
      );
      if (!flew) return "no flight found";
      lab.rideUntil(() => false, state.t + 0.2);
      return shoot(lensOn(state, 1.5, 4.5, 0.3, 40), "in the air");
    },
  };
}

/** Off the snow by more than a hand. */
function airborne(state: GameState): boolean {
  const s = state.skier;
  return s.y - state.level.groundAt(s.x, s.z) > 0.6;
}
