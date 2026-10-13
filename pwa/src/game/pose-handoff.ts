// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HAND-OFF BETWEEN TWO WAYS OF DRAWING HIM: the skier is posed off his
// skis' readings while he rides, hung on the engine's ragdoll once he is
// thrown (`skier-ragdoll.ts`), and stood in his boots once he is up and
// walking (`party-pose.ts`, `town-pose.ts`) — each its own answer to where
// his limbs are, and none of them where the last left him. Switched in a
// frame, his whole body jumped half a metre (`make jolt`'s wipeout: a
// forearm flung at four thousand m/s²).
//
// So where the way he is drawn changes, the gap between the last frame
// drawn and the new pose is CARRIED in the world and eased out over
// `HAND_OFF` s with a smootherstep, which starts and ends at rest — every
// joint leaves where it was and arrives where the new pose has it, and no
// faster than the move itself. A gap wider than `CUT` is a reset standing
// him somewhere else, which is a cut, never a glide across the snow.
// Three-free: the caller turns the points into the world and back
// (`skier-figure.ts`' `createFigureHandOff` does, for a figure on a root).

import type { SkierPose } from "./skier-joints.ts";
import type { V3 } from "./skier-vec.ts";

/** How long a hand-off between two ways of drawing him takes, s. */
export const HAND_OFF = 0.25;
/** A gap wider than this anywhere in him is a cut, m. */
const CUT = 2.5;

/** The points of a pose that are carried, by name — and each boot's frame,
 * two directions, carried as the points a boot's length out along them
 * from his foot and set back to unit length. */
const POINTS = ["hips", "waist", "neck", "head"] as const;
const PAIRS = ["hipJoints", "knees", "feet", "shoulders", "elbows", "hands"] as const;

export type HandOff = {
  /** The way he was last drawn. */
  mode: string;
  /** Where each point was last drawn, in the world, and the frame
   * before — how fast it was going. */
  last: Map<string, V3>;
  before: Map<string, V3>;
  /** The last frame's time step, s. */
  step: number;
  /** The gap carried at the switch, in the world, and how long ago it was. */
  gap: Map<string, V3>;
  age: number;
};

export function createHandOff(): HandOff {
  return {
    mode: "",
    last: new Map(),
    before: new Map(),
    step: 0,
    gap: new Map(),
    age: HAND_OFF,
  };
}

/** Forget the last drawing (a new run, the figure hidden): the next pose is
 * drawn as it comes. */
export function resetHandOff(h: HandOff): void {
  h.mode = "";
  h.last.clear();
  h.before.clear();
  h.step = 0;
  h.gap.clear();
  h.age = HAND_OFF;
}

/** Every carried point of `p`, by name. */
function pointsOf(p: SkierPose, visit: (name: string, v: V3) => void): void {
  for (const k of POINTS) visit(k, p[k]);
  for (const k of PAIRS) {
    visit(`${k}0`, p[k][0]);
    visit(`${k}1`, p[k][1]);
  }
  if (p.poles) {
    visit("poles0", p.poles[0]);
    visit("poles1", p.poles[1]);
  }
  for (let i = 0; i < 2; i++) {
    const foot = p.feet[i];
    const b = p.boots[i];
    visit(`bootF${i}`, along(foot, b.f));
    visit(`bootN${i}`, along(foot, b.n));
  }
}

/** A boot's length, for its frame's points, m. */
const BOOT = 0.3;
const along = (from: V3, d: V3): V3 => ({
  x: from.x + d.x * BOOT,
  y: from.y + d.y * BOOT,
  z: from.z + d.z * BOOT,
});
/** The unit direction from `from` to `to`. */
const toward = (from: V3, to: V3): V3 => {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const z = to.z - from.z;
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
};

const ease = (s: number): number => {
  const k = Math.max(0, Math.min(1, s));
  return 1 - k * k * k * (k * (k * 6 - 15) + 10);
};

/**
 * `p` as it is drawn this frame, drawn the way `mode` names, `dt` s after
 * the last: where the way changed, the gap from the last frame carried and
 * eased out. `toWorld` and `toLocal` take a point of the pose's frame into
 * the world and back. Returns `p` itself where nothing is carried, else a
 * copy with its points moved.
 */
export function handOff(
  h: HandOff,
  p: SkierPose,
  mode: string,
  dt: number,
  toWorld: (v: V3) => V3,
  toLocal: (v: V3) => V3,
): SkierPose {
  const world = new Map<string, V3>();
  pointsOf(p, (name, v) => world.set(name, toWorld(v)));
  h.age += dt;
  if (h.mode !== "" && mode !== h.mode && h.last.size > 0) {
    // The gap from where he would have been drawn — the last frame carried
    // on at its own pace, so he goes on moving through the switch.
    const gap = new Map<string, V3>();
    let widest = 0;
    const on = h.step > 0 ? dt / h.step : 0;
    for (const [name, w] of world) {
      const was = h.last.get(name);
      if (!was) continue;
      const b = h.before.get(name) ?? was;
      const g = {
        x: was.x + (was.x - b.x) * on - w.x,
        y: was.y + (was.y - b.y) * on - w.y,
        z: was.z + (was.z - b.z) * on - w.z,
      };
      widest = Math.max(widest, Math.hypot(g.x, g.y, g.z));
      gap.set(name, g);
    }
    h.gap = widest > CUT ? new Map() : gap;
    h.age = 0;
  }
  h.mode = mode;
  const k = h.gap.size > 0 ? ease(h.age / HAND_OFF) : 0;
  if (k <= 0) h.gap.clear();
  if (dt > 0) {
    h.before = h.last;
    h.step = dt;
  }
  h.last = new Map();
  for (const [name, w] of world) {
    const g = h.gap.get(name);
    const drawn = g ? { x: w.x + g.x * k, y: w.y + g.y * k, z: w.z + g.z * k } : w;
    h.last.set(name, drawn);
  }
  if (k <= 0) return p;
  const moved = (name: string, v: V3): V3 => {
    const d = h.last.get(name);
    return d ? toLocal(d) : v;
  };
  const pair = (name: string, v: [V3, V3]): [V3, V3] => [
    moved(`${name}0`, v[0]),
    moved(`${name}1`, v[1]),
  ];
  const feet = pair("feet", p.feet);
  const boots = [0, 1].map((i) => ({
    ...p.boots[i],
    f: toward(feet[i], moved(`bootF${i}`, along(p.feet[i], p.boots[i].f))),
    n: toward(feet[i], moved(`bootN${i}`, along(p.feet[i], p.boots[i].n))),
  })) as SkierPose["boots"];
  return {
    ...p,
    boots,
    hips: moved("hips", p.hips),
    waist: moved("waist", p.waist),
    neck: moved("neck", p.neck),
    head: moved("head", p.head),
    hipJoints: pair("hipJoints", p.hipJoints),
    knees: pair("knees", p.knees),
    feet,
    shoulders: pair("shoulders", p.shoulders),
    elbows: pair("elbows", p.elbows),
    hands: pair("hands", p.hands),
    poles: p.poles ? pair("poles", p.poles) : null,
  };
}
