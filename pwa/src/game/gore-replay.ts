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
// held still and out of sight while a replay is watched (its dead of earlier
// runs left lying in view), the replay's draws every copy from where it
// stands, and the run comes back as it was left. Nothing is ever left lying
// on the way into a replay, out of one, or across a seek inside one.

import * as THREE from "three";
import type { GameState } from "@engine";

import { createGoreView, type GoreModel, type GoreView } from "./gore-view.ts";
import { isStoodUp } from "./replay-keep.ts";

/** The pair, as the renderer holds it: a view whose `leave` is told the
 * state coming next. */
export type GoreViews = Omit<GoreView, "leave"> & {
  leave(model: GoreModel, next: GameState): void;
};

/** The group a gore view keeps its dead left lying in (`gore-view.ts`). */
const REMAINS = "gore-remains";

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
  let watching = false;
  /** The run's view held out of sight but for its dead, or shown again. */
  const hold = (on: boolean): void => {
    for (const o of run.group.children) o.visible = !on || o.name === REMAINS;
  };
  const active = (): GoreView => (watching && replay ? replay : run);

  return {
    group,
    leave(model, next) {
      // Only a new run leaves the last one lying, never a replay's comings and goings.
      if (!watching && !isStoodUp(next)) run.leave(model);
    },
    update(state, model, simDt, dt, veil) {
      const copy = isStoodUp(state);
      if (copy && !watching) {
        if (!replay) group.add((replay = make()).group);
        replay.group.visible = true;
        hold(true);
        watching = true;
      } else if (!copy && watching) {
        replay?.clear(model);
        if (replay) replay.group.visible = false;
        hold(false);
        watching = false;
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
    flown: (piece, out) => active().flown(piece, out),
    dispose() {
      run.dispose();
      replay?.dispose();
    },
  };
}
