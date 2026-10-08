// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S GRIMBEAR VIEWS (`make world ARGS="--free --grimbear
// --views=grimbear-lurk,grimbear-run,grimbear-chase,grimbear-maul"`): the
// bot skis a free ride the grimbear hunts (`grimbear.ts`) until he is
// behind his trunk, out of it, over the skier and then pulled up short, and
// each moment is drawn from a lens planted beside him — and the run's own
// chase lens for `grimbear-chase`, the player's view of him coming.

import type { GameState } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

export type GrimbearLab = {
  rideUntil: (done: () => boolean, limit: number) => boolean;
  still: () => void;
  setOverride: (pose: LensPose | null) => void;
};

/** A lens `off` m to the beast's left, a little ahead, at a man's eye. */
function beside(state: GameState, off: number): LensPose {
  const b = state.grimbear!;
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  const ex = b.x + fz * off + fx * off * 0.5;
  const ez = b.z - fx * off + fz * off * 0.5;
  const ground = state.level.groundAt;
  return {
    eye: { x: ex, y: ground(ex, ez) + 1.7, z: ez },
    target: { x: b.x, y: ground(b.x, b.z) + 1.1, z: b.z },
    fov: 45,
    roll: 0,
  };
}

export function grimbearShots(state: GameState, lab: GrimbearLab): Record<string, () => string> {
  // Every run of his lands, so the catch is there to photograph: most miss
  // in the game (`GRIMBEAR.miss`), the grimbear lab's `miss` sheet.
  if (state.grimbear) state.grimbear.rng.chance = () => false;
  const at = (phase: string, after: number, limit: number): boolean =>
    state.grimbear !== undefined &&
    lab.rideUntil(() => state.grimbear?.phase === phase && state.grimbear.t >= after, limit);
  const shoot = (off: number, note: string): string => {
    lab.setOverride(beside(state, off));
    lab.still();
    lab.setOverride(null);
    return `${note}, t ${state.t.toFixed(1)} s`;
  };
  return {
    "grimbear-lurk"() {
      if (!at("lurk", 0.3, 400)) return "he never lay in wait (--free --grimbear)";
      return shoot(7, "behind his trunk");
    },
    "grimbear-chase"() {
      if (!at("run", 0.4, 400)) return "he never broke cover";
      lab.still();
      return `out of the trees, from the chase lens, t ${state.t.toFixed(1)} s`;
    },
    "grimbear-run"() {
      if (!at("run", 0.8, 400)) return "he never broke cover";
      return shoot(6, `running, ${state.grimbear!.speed.toFixed(1)} m/s`);
    },
    "grimbear-maul"() {
      if (!at("maul", 1, 400)) return "he never caught him";
      return shoot(5, "over the skier he took");
    },
    "grimbear-leave"() {
      if (!at("leave", 2, 400)) return "he never walked off";
      return shoot(8, "walking back into the woods");
    },
  };
}
