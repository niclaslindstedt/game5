// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN AMATEUR GOING DOWN AND GETTING UP, HANDED OVER — the crowd's figure is
// drawn two ways: on his skis as a blend of the morph targets
// (`crowd-view.ts`), and down in the snow hung on the engine's ragdoll
// (`crowd-fall.ts`). Neither is where the other left him: the ragdoll is
// thrown off a body of its own, and the get-up ends in the bare stance
// while the figure on his skis is crouched, leant and planting. Switched in
// a frame, a ski tip jumped a metre and a half (`make jolt`'s crowd
// `fall-ski`: ten thousand m/s²).
//
// So where the way he is drawn changes, the gap between where the last
// frame had him — carried on at its own pace — and the new way's figure is
// kept in the world and eased out over `HAND_OFF` s with a smootherstep,
// as the player's own hand-off does (`pose-handoff.ts`). While a gap is
// carried he is drawn as joints (`shown`), the down mesh's way, whichever
// side of the switch he is on. Three-free and DOM-free; nothing here is
// kept but the last two frames an amateur was drawn at.

import { placePosed, posedAt, widestOf, zipPosed } from "./crowd-ease.ts";
import type { Posed, V3 } from "./crowd-rig.ts";

/** How long a hand-off between his two ways of being drawn takes, s. */
export const CROWD_HAND_OFF = 0.3;
/** A gap wider than this anywhere in him is a cut, m. */
const CUT = 3;
/** A frame this long after the last starts him afresh, s. */
const AFRESH = 0.25;

/** What a frame drew him at: down, his joints in the world; on his skis,
 * the drawn weights and matrix his joints are read back off when asked. */
type Shot = {
  t: number;
  down: boolean;
  shown: Posed | null;
  targets: readonly Posed[] | null;
  w: Float32Array;
  pos: [number, number, number];
  quat: [number, number, number, number];
  mirror: number;
};

type Record_ = { cur: Shot; prev: Shot; gap: Posed | null; age: number; fresh: boolean };

/** On his skis this frame: his targets and the weights, place, turn and
 * mirror he is drawn at. */
export type Stood = {
  targets: readonly Posed[];
  w: ArrayLike<number>;
  pos: ArrayLike<number>;
  quat: ArrayLike<number>;
  mirror: number;
};

export type CrowdHandOff = {
  /**
   * Amateur `id` at `t`, drawn `down` (his joints in the world) or stood
   * (`Stood`). Returns the joints he is drawn at in the world while a
   * hand-off is carried — or down — and null where the morph draws him as
   * he is.
   */
  frame: (id: number, t: number, now: { down: Posed } | { stood: Stood }) => Posed | null;
};

const shot = (width: number): Shot => ({
  t: -Infinity,
  down: false,
  shown: null,
  targets: null,
  w: new Float32Array(width),
  pos: [0, 0, 0],
  quat: [0, 0, 0, 1],
  mirror: 1,
});

/** The joints a shot drew, in the world. */
function jointsOf(s: Shot): Posed | null {
  if (s.shown) return s.shown;
  if (!s.targets) return null;
  return placePosed(posedAt(s.targets, s.w), s.pos, s.quat, s.mirror);
}

/** The joints a figure on his skis is drawn at, in the world. */
const stoodJoints = (s: Stood): Posed =>
  placePosed(posedAt(s.targets, s.w), s.pos, s.quat, s.mirror);

const ease = (s: number): number => {
  const k = Math.max(0, Math.min(1, s));
  return 1 - k * k * k * (k * (k * 6 - 15) + 10);
};

export function createCrowdHandOff(count: number, width: number): CrowdHandOff {
  const recs: Record_[] = Array.from({ length: count }, () => ({
    cur: shot(width),
    prev: shot(width),
    gap: null,
    age: CROWD_HAND_OFF,
    fresh: true,
  }));
  return {
    frame(id, t, now) {
      const r = recs[id];
      const dt = t - r.cur.t;
      if (dt === 0) return r.cur.shown;
      const stood = "stood" in now ? now.stood : null;
      const down = stood === null;
      const afresh = !(dt > 0 && dt <= AFRESH);
      let posed: Posed | null = "down" in now ? now.down : null;
      if (!afresh && down !== r.cur.down) {
        // The way he is drawn changed: the gap from where the last frame
        // had him, carried on at its own pace.
        const was = jointsOf(r.cur);
        posed ??= stoodJoints(stood!);
        if (was) {
          const before = r.fresh ? was : (jointsOf(r.prev) ?? was);
          const on = r.cur.t - r.prev.t > 0 ? dt / (r.cur.t - r.prev.t) : 0;
          const gap = zipPosed(
            was,
            posed,
            (w, n, b): V3 => [
              w[0] + (w[0] - b[0]) * on - n[0],
              w[1] + (w[1] - b[1]) * on - n[1],
              w[2] + (w[2] - b[2]) * on - n[2],
            ],
            before,
          );
          r.gap = widestOf(gap) > CUT ? null : gap;
          r.age = 0;
        }
      } else if (afresh) r.gap = null;
      else r.age += dt;
      const k = r.gap ? ease(r.age / CROWD_HAND_OFF) : 0;
      if (k <= 0) r.gap = null;
      let shown: Posed | null = null;
      if (r.gap) {
        posed ??= stoodJoints(stood!);
        shown = zipPosed(posed, r.gap, (p, g): V3 => [
          p[0] + g[0] * k,
          p[1] + g[1] * k,
          p[2] + g[2] * k,
        ]);
      } else if (down) shown = posed;
      // The last two frames on.
      const next = r.prev;
      r.prev = r.cur;
      r.cur = next;
      next.t = t;
      next.down = down;
      next.shown = shown;
      if (stood) {
        const s = stood;
        next.targets = s.targets;
        for (let j = 0; j < next.w.length; j++) next.w[j] = j < s.w.length ? s.w[j] : 0;
        for (let j = 0; j < 3; j++) next.pos[j] = s.pos[j];
        for (let j = 0; j < 4; j++) next.quat[j] = s.quat[j];
        next.mirror = s.mirror;
      } else next.targets = null;
      r.fresh = afresh;
      return shown;
    },
  };
}
