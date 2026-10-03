// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HAND-OVER between the forest's bands (`forest.ts`), three-free. A
// tree is the same tree cut lighter with distance — FULL, MID, the FAR
// sketch — and a band that simply ended at its edge swapped one cut for the
// next in a single frame, in plain sight: the boughs thinned as the skier
// watched, and at the far edge the tree turned into its kind's lead variant
// (and, on a thinner FOREST row, went out altogether).
//
// So a tree that crosses an edge DISSOLVES into its next cut over
// `HAND_OVER_S`: for that moment it is drawn in both, each keeping a
// complementary share of the screen's pixels (a dither the tree material
// discards against — the window `[lo, hi)` of a 0..1 threshold), the old
// cut's share falling from whole to nothing — into the mid cut, the sketch,
// or nothing at all for a tree the far band leaves out; a tree reaching the
// end of the woods fades in the same way. It is a fade in TIME, not a ring
// of distance: a ring would stand stippled round a skier at rest, where
// this leaves every tree whole the moment the lens stops. A tree only
// changes its cut once it is `HYSTERESIS` past the edge, so a lens bobbing
// at one does not set it flickering; and a tree the lens did not see on the
// last fill (behind it, outside the frustum) takes its cut at once, so
// turning the head shows the woods as they are rather than mid-dissolve.
// Where the bands end is the FOREST and DISTANCE rows' and is not moved
// here.

/** The bands' edges, m: the FOREST row's `full` and `mid`, the DISTANCE
 * row's `far` (where the trees stop). */
export type BandEdges = { full: number; mid: number; far: number };

/** How long a tree takes to dissolve from one cut into the next, ms. */
export const HAND_OVER_MS = 400;

/** How far past an edge, m, a tree has to stand before it changes its cut. */
export const HYSTERESIS = 3;

/** The cut a tree is drawn in: 0 FULL, 1 MID, 2 the FAR sketch, -1 none. */
export type BandIndex = -1 | 0 | 1 | 2;

/** The cut a tree `d` m from the lens in plan belongs in. `inFar` is
 * whether the far band keeps this tree (the FOREST row's `farShare`); the
 * mid band never runs past where the trees stop. */
export function bandAt(d: number, e: BandEdges, inFar: boolean): BandIndex {
  if (d >= e.far) return -1;
  if (d < e.full) return 0;
  if (d < e.mid) return 1;
  return inFar ? 2 : -1;
}

/** The cut a tree in `current` keeps or moves to at `d`: it keeps its own
 * while that is still what stands `HYSTERESIS` nearer or farther. */
export function settle(current: BandIndex, d: number, e: BandEdges, inFar: boolean): BandIndex {
  const target = bandAt(d, e, inFar);
  if (target === current) return target;
  if (bandAt(d - HYSTERESIS, e, inFar) === current || bandAt(d + HYSTERESIS, e, inFar) === current)
    return current;
  return target;
}

/** Every tree's hand-over: the cut it is in, the cut it is leaving, when it
 * began to (ms), and the last fill that saw it. */
export type HandOver = {
  band: Int8Array;
  from: Int8Array;
  at: Float64Array;
  seen: Uint32Array;
};

export function createHandOver(count: number): HandOver {
  return {
    band: new Int8Array(count).fill(-1),
    from: new Int8Array(count).fill(-1),
    at: new Float64Array(count).fill(-Infinity),
    seen: new Uint32Array(count),
  };
}

/** One tree's draw: the cut it is leaving (`from`) keeps the threshold
 * window `[0, split)`, the cut it is in (`band`) `[split, 1)`. A settled
 * tree is `from = -1, split = 0`: its own cut, whole. */
export type TreeDraw = { from: BandIndex; band: BandIndex; split: number };

/** Tree `i` on fill number `tick` (counting from 1, one a fill) at `now`
 * ms, `d` m from the lens: its cut settled and its hand-over read, into
 * `out`. Returns whether it is still dissolving. */
export function handOver(
  h: HandOver,
  i: number,
  d: number,
  e: BandEdges,
  inFar: boolean,
  now: number,
  tick: number,
  out: TreeDraw,
): boolean {
  const current = h.band[i] as BandIndex;
  const seen = h.seen[i] === tick - 1;
  h.seen[i] = tick;
  if (!seen) {
    // Out of sight on the last fill: whatever cut it belongs in, at once.
    h.band[i] = bandAt(d, e, inFar);
    h.from[i] = -1;
    h.at[i] = -Infinity;
  } else {
    const next = settle(current, d, e, inFar);
    if (next !== current) {
      const p = Math.min(1, (now - h.at[i]) / HAND_OVER_MS);
      if (p < 1 && next === h.from[i]) {
        // Turned back mid-dissolve: run the same dissolve backwards.
        h.at[i] = now - (1 - p) * HAND_OVER_MS;
      } else {
        h.at[i] = now;
      }
      h.from[i] = current;
      h.band[i] = next;
    }
  }
  const p = Math.min(1, Math.max(0, (now - h.at[i]) / HAND_OVER_MS));
  out.band = h.band[i] as BandIndex;
  if (p >= 1) {
    out.from = -1;
    out.split = 0;
    return false;
  }
  out.from = h.from[i] as BandIndex;
  out.split = 1 - p;
  return true;
}
