// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FILM UNDER THE MENU, wired: while the daring bot rides the race behind
// the front door (`backdrop-run.ts`), the picture is cut as an action film's
// ski sequence (`camera-cinema.ts`, `cinema-director.ts`) rather than the
// cards' slow orbit — the run read ahead (`cinema-ahead.ts`) so a lens is
// standing by the landing before he leaves the lip, and the backdrop's own
// clock slowed over the hang of a long flight (`cinemaRate`). Nobody is
// riding it, so its time is the director's to bend.
//
// The renderer is told through the replay's own door (`setReplayCam`, the
// FILM angle), so nothing on a run's ladder changes; and it is told nothing
// while a replay is being watched, a run ridden, or the backdrop is not the
// race (the title scene, the rider and gear cards' stage). DOM-free, kept
// out of `App.tsx`, which only asks for the rate once a frame.

import type { GameState, SkierInput } from "@engine";

import { backdropHeld } from "./backdrop-hold.ts";
import { createLookAhead } from "./cinema-ahead.ts";
import { cinemaRate } from "./cinema-director.ts";
import type { WorldRenderer } from "./renderer-api.ts";

/** Milliseconds of each frame the read ahead may spend, and the most steps. */
export const CINEMA_BUDGET = { ms: 2.5, steps: 48 } as const;

export type CinemaRun = {
  /** Once a frame, before the steps: the lens told, and the rate the
   * backdrop runs at returned — 1 while `on` is false. */
  frame: (state: GameState, on: boolean) => number;
};

/** `drive` is the backdrop's own hands (`backdrop-run.ts`'s `backdropInput`),
 * which the read ahead rides its copy on. */
export function createCinemaRun(
  renderer: Pick<WorldRenderer, "setReplayCam">,
  drive: (state: GameState) => SkierInput,
  now: () => number = () => performance.now(),
): CinemaRun {
  const ahead = createLookAhead((s) => drive(s));
  let was = false;
  return {
    frame: (state, asked) => {
      // Not while a card's own picture covers the race (`backdrop-hold.ts`).
      const on = asked && !backdropHeld();
      if (!on) {
        if (was) {
          renderer.setReplayCam(null);
          ahead.drop();
        }
        was = false;
        return 1;
      }
      was = true;
      const until = now() + CINEMA_BUDGET.ms;
      let left = CINEMA_BUDGET.steps;
      ahead.frame(state, () => left-- > 0 && now() < until);
      const plan = ahead.shots();
      renderer.setReplayCam({
        angle: "film",
        shot: null,
        plan,
        step: state.tick,
        path: ahead.path,
      });
      return cinemaRate(plan, state.tick);
    },
  };
}
