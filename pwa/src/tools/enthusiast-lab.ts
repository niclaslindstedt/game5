// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S ENTHUSIAST VIEWS (`make world ARGS="--free --hour=21
// --views=keen-0,keen-1,keen-2,keen-side,keen-lift"`): a free ride after
// dark, when the crowd has gone in and a few keen skiers lap the lit runs
// (`enthusiasts.ts`), each drawn as the player is — his own kit, his own
// pair, his headlamp. `keen-<i>` is a chase lens behind enthusiast `i` well
// into the ride, `keen-side` the first of them from beside his line, and
// `keen-lift` one carried up a lift, from beside the chair.

import type { GameState } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

export type EnthusiastLab = {
  rideUntil: (done: () => boolean, limit: number) => boolean;
  still: () => void;
  setOverride: (pose: LensPose | null) => void;
};

/** A lens `back` m behind skier (x, z, heading) and `side` m to his left,
 * `up` m over the snow, on him. */
function lensOn(
  state: GameState,
  at: { x: number; y: number; z: number; heading: number },
  back: number,
  side: number,
  up: number,
): LensPose {
  const fx = Math.sin(at.heading);
  const fz = Math.cos(at.heading);
  const ex = at.x - fx * back - fz * side;
  const ez = at.z - fz * back + fx * side;
  const ground = state.level.groundAt(ex, ez);
  return {
    eye: { x: ex, y: Math.max(ground + 1.5, at.y + up), z: ez },
    target: { x: at.x, y: at.y + 0.9, z: at.z },
    fov: 50,
    roll: 0,
  };
}

export function enthusiastShots(
  state: GameState,
  lab: EnthusiastLab,
): Record<string, () => string> {
  const keen = () => state.rivals.filter((r) => r.free);
  const shoot = (pose: LensPose, note: string): string => {
    lab.setOverride(pose);
    lab.still();
    lab.setOverride(null);
    return `${note}, t ${state.t.toFixed(1)} s`;
  };
  const say = (i: number): string => {
    const r = keen()[i];
    const c = r.run.skier;
    return `enthusiast ${i} on the ${c.spec.id} at ${(c.speed * 3.6).toFixed(0)} km/h`;
  };
  const behind = (i: number) => (): string => {
    if (keen().length <= i) return "no enthusiast out (--free --hour=21: a free ride after dark)";
    // Well into the ride, and skiing — not stood at the bottom or carried.
    lab.rideUntil(() => {
      const c = keen()[i].run.skier;
      return state.t >= 25 + 10 * i && !c.lift && !c.thrown && c.speed > 6;
    }, 400);
    const c = keen()[i].run.skier;
    return shoot(lensOn(state, c, 9, 0, 3), say(i));
  };
  return {
    "keen-0": behind(0),
    "keen-1": behind(1),
    "keen-2": behind(2),
    "keen-side"() {
      if (keen().length === 0) return "no enthusiast out";
      lab.rideUntil(() => {
        const c = keen()[0].run.skier;
        return !c.lift && !c.thrown && c.speed > 6;
      }, state.t + 200);
      const c = keen()[0].run.skier;
      return shoot(lensOn(state, c, -4, 7, 1), say(0));
    },
    "keen-lift"() {
      if (keen().length === 0) return "no enthusiast out";
      const up = () => keen().find((r) => r.run.skier.lift?.phase === "ride");
      if (!lab.rideUntil(() => up() !== undefined, state.t + 600)) {
        return "none of them went up a lift";
      }
      const c = up()!.run.skier;
      return shoot(lensOn(state, c, 6, 6, -2), `carried up the ${c.lift!.kind}`);
    },
  };
}
