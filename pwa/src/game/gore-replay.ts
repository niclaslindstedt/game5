// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOUNDS OF A RUN AND OF ITS REPLAY, DRAWN APART. A replay is a copy of
// the run stood up again and stepped off its tape (`replay-keep.ts`), so the
// wounds it deals are the run's own, dealt again — but drawn by
// `gore-view.ts`, which keeps one rider's pieces, guts, blood and stumps, a
// copy swapped in for the run would cost the run what it had drawn, and the
// run's dead body would be LEFT LYING as a new run's would (`leave`): there
// in the snow ahead of the replay before he ever reached it, and laid there
// a second time when the replay was left.
//
// So the run and its replays each have a view of their own: the run's is
// HELD ASIDE while a replay is watched (`GoreView.hold`) — out of sight, and
// off the skin the replay's body wears too (the stumps, the opened trunk,
// the bone out through it, the blood soaked into his clothes) — but for the
// dead of OTHER runs, left lying in view. The death the replay is of is not
// among them, though the rider stood up after it left it lying: the replay
// draws that death again, and he would fly into his own body and its pieces
// lying there ahead of him. The replay's view draws every copy from where
// it stands, and the run comes back as it was left. Nothing is ever left
// lying on the way into a replay, out of one, or across a seek inside one.

import * as THREE from "three";
import type { GameState } from "@engine";

import { createGoreView, type GoreModel, type GoreView } from "./gore-view.ts";
import { isStoodUp, replayOf } from "./replay-keep.ts";

/** The pair, as the renderer holds it: a view whose `leave` is told the
 * state coming next, and which holds its own views aside itself. */
export type GoreViews = Omit<GoreView, "leave" | "hold"> & {
  leave(model: GoreModel, next: GameState): void;
};

/** Both views, over `createGoreView`'s own arguments; the replay's is built
 * on the first replay watched. */
export function createGoreViews(...args: Parameters<typeof createGoreView>): GoreViews {
  return pairViews(() => createGoreView(...args));
}

/** The pair over any maker of views (the suite's are hollow). */
export function pairViews(make: () => GoreView): GoreViews {
  const group = new THREE.Group();
  group.name = "gore-views";
  const run = make();
  group.add(run.group);
  let replay: GoreView | null = null;
  /** The run the replay being watched is of; null while none is. */
  let watching: GameState | null = null;
  const active = (): GoreView => (watching && replay ? replay : run);

  return {
    group,
    leave(model, next) {
      // Only a new run leaves the last one lying, never a replay's comings and goings.
      if (!watching && !isStoodUp(next)) run.leave(model);
    },
    update(state, model, simDt, dt, veil) {
      const of = replayOf(state);
      if (of !== watching && watching) {
        replay?.clear(model);
        if (replay) replay.group.visible = false;
        run.hold(false, model);
        watching = null;
      }
      if (of && !watching) {
        if (!replay) group.add((replay = make()).group);
        replay.group.visible = true;
        run.hold(true, model, of);
        watching = of;
      }
      active().update(state, model, simDt, dt, veil);
    },
    setPace(pace) {
      run.setPace(pace);
      replay?.setPace(pace);
    },
    clear(model) {
      run.clear(model);
      replay?.clear(model);
    },
    clearRemains: () => run.clearRemains(),
    remains: () => run.remains(),
    flown: (piece, out) => active().flown(piece, out),
    dispose() {
      run.dispose();
      replay?.dispose();
    },
  };
}
