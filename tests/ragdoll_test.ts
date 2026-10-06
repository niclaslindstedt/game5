// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY THROWN (`ragdoll.ts`, `crash.ts`'s throw): a man falling, not a
// sack — every joint held to what a body allows through every kind of fall,
// the muscles moving the limbs against the trunk and never turning the man,
// the solver giving him no speed of its own, and each cause sending him
// over the way that fall goes.

import { describe, expect, it } from "vitest";

import {
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  RAGDOLL as R,
  step,
  TUNING,
  type GameState,
  type RunMoment,
  type SkierInput,
  type Thrown,
} from "@engine";
import { flatLevel, LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

const K = TUNING.crash;
const B = K.body;
const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };
const MASS = [
  B.mass.hip,
  B.mass.hip,
  B.mass.shoulder,
  B.mass.shoulder,
  B.mass.head,
  B.mass.knee,
  B.mass.knee,
  B.mass.foot,
  B.mass.foot,
  B.mass.elbow,
  B.mass.elbow,
  B.mass.hand,
  B.mass.hand,
];

type V = [number, number, number];
const at = (b: Thrown, i: number): V => [b.points[3 * i], b.points[3 * i + 1], b.points[3 * i + 2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V): number => Math.hypot(...a);
const mid = (a: V, b: V): V => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
/** The angle at `j` between its two bones, rad. */
const angle = (i: V, j: V, k: V): number =>
  Math.acos(
    Math.max(-1, Math.min(1, dot(sub(i, j), sub(k, j)) / (len(sub(i, j)) * len(sub(k, j))))),
  );

/** Every kind of fall the ride lab stages, each skied until the reset. */
const FALLS: {
  id: string;
  level: () => GameState["level"];
  moment: RunMoment;
  input: SkierInput;
}[] = [
  {
    id: "a trunk at 50 km/h",
    level: syntheticLevel,
    moment: { x: LONE_TREE.x + 0.3, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 },
    input: TUCK,
  },
  {
    id: "over the tips at 60 km/h",
    level: () => flatLevel({ packed: 1 }),
    moment: { x: 1500, z: 200, heading: 0, speed: 60 / 3.6, height: 2.5, vy: -3, pitch: -1 },
    input: NEUTRAL_INPUT,
  },
  {
    id: "onto his side at 70 km/h",
    level: () => flatLevel({ packed: 1 }),
    moment: { x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 1.2, roll: 1.35 },
    input: TUCK,
  },
  {
    id: "into deep powder",
    level: () => flatLevel({ packed: 0 }),
    moment: { x: 1500, z: 200, heading: 0, speed: 60 / 3.6, height: 2.5, vy: -3, pitch: -1 },
    input: NEUTRAL_INPUT,
  },
];

/** Ski a fall and hand every step's body to `see`. */
function fall(f: (typeof FALLS)[number], see: (b: Thrown, s: GameState) => void, snowDepth = 1) {
  const state = createGame({ level: f.level(), rivals: 0, countdown: 0, quiet: true, snowDepth });
  placeRun(state, f.moment);
  let seen = 0;
  for (let i = 0; i < 12 * TUNING.physicsHz; i++) {
    step(state, f.input);
    const b = state.skier.thrown;
    if (!b) {
      if (seen > 0) break;
      continue;
    }
    seen++;
    see(b, state);
  }
  expect(seen, f.id).toBeGreaterThan(0);
}

describe("the body thrown", () => {
  it("holds every joint to what a body allows, through every kind of fall", () => {
    // The knee and the elbow folded no tighter than their bones meet, the
    // elbow never bent forward, no limb through the chest — and the hinges
    // a few degrees slack, as a solver's are.
    const slack = 0.08;
    for (const f of FALLS) {
      let knee = Math.PI;
      let elbow = Math.PI;
      let inside = Infinity;
      fall(f, (b) => {
        for (const s of [0, 1]) {
          knee = Math.min(knee, angle(at(b, R.hipL + s), at(b, R.kneeL + s), at(b, R.footL + s)));
          elbow = Math.min(
            elbow,
            angle(at(b, R.shoulderL + s), at(b, R.elbowL + s), at(b, R.handL + s)),
          );
        }
        const a = mid(at(b, R.hipL), at(b, R.hipR));
        const c = mid(at(b, R.shoulderL), at(b, R.shoulderR));
        const ac = sub(c, a);
        for (let i = R.kneeL; i < R.count; i++) {
          const p = at(b, i);
          const t = Math.max(0, Math.min(1, dot(sub(p, a), ac) / dot(ac, ac)));
          inside = Math.min(
            inside,
            len(sub(p, [a[0] + ac[0] * t, a[1] + ac[1] * t, a[2] + ac[2] * t])),
          );
        }
      });
      expect(knee, f.id).toBeGreaterThan(K.kneeFold - slack);
      expect(elbow, f.id).toBeGreaterThan(K.elbowFold - slack);
      expect(inside, f.id).toBeGreaterThan(K.torso - 0.04);
    }
  });

  it("is turned by nothing of his own in the air: the muscles move the limbs against the trunk", () => {
    // Off the tips and up into the air: the limbs thrown out to brace, the
    // body's spin about its centre of mass held through it all — only the
    // snow can change it.
    const f = FALLS[1];
    const spins: number[] = [];
    fall(f, (b) => {
      if (b.touching || b.down >= 0) return;
      let tot = 0;
      const c: V = [0, 0, 0];
      for (let i = 0; i < R.count; i++) {
        tot += MASS[i];
        for (let k = 0; k < 3; k++) c[k] += MASS[i] * b.points[3 * i + k];
      }
      for (let k = 0; k < 3; k++) c[k] /= tot;
      const h: V = [0, 0, 0];
      for (let i = 0; i < R.count; i++) {
        const r = sub(at(b, i), c);
        const v: V = [0, 1, 2].map(
          (k) => (b.points[3 * i + k] - b.last[3 * i + k]) / TUNING.dt,
        ) as V;
        h[0] += MASS[i] * (r[1] * v[2] - r[2] * v[1]);
        h[1] += MASS[i] * (r[2] * v[0] - r[0] * v[2]);
        h[2] += MASS[i] * (r[0] * v[1] - r[1] * v[0]);
      }
      spins.push(len(h));
    });
    expect(spins.length).toBeGreaterThan(30);
    for (let i = 1; i < spins.length; i++) {
      expect(spins[i]).toBeLessThanOrEqual(spins[i - 1] * 1.01 + 1e-6);
    }
  });

  it("puts his hands out ahead of him while he is in the air", () => {
    let ahead = -Infinity;
    fall(FALLS[1], (b) => {
      if (b.touching || b.down >= 0 || b.t < 0.15) return;
      const a = mid(at(b, R.hipL), at(b, R.hipR));
      const c = mid(at(b, R.shoulderL), at(b, R.shoulderR));
      const up = sub(c, a);
      const across = sub(at(b, R.hipR), at(b, R.hipL));
      const chest: V = [
        across[1] * up[2] - across[2] * up[1],
        across[2] * up[0] - across[0] * up[2],
        across[0] * up[1] - across[1] * up[0],
      ];
      const n = len(chest);
      for (const s of [0, 1]) {
        ahead = Math.max(ahead, dot(sub(at(b, R.handL + s), at(b, R.shoulderL + s)), chest) / n);
      }
    });
    expect(ahead).toBeGreaterThan(0.3);
  });

  it("goes over the way his fall sends him: a caught edge flings him the way the snow slid", () => {
    // Facing +x and sliding toward +z — the snow running across his skis
    // from his left — with the edge stood up: it bites, and he goes over
    // it toward +z, head first that way.
    const state = createGame({
      level: flatLevel({ packed: 1 }),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 200, heading: Math.PI / 2, speed: 40 / 3.6 });
    state.skier.vx = 0;
    state.skier.vz = 40 / 3.6;
    state.skier.edge = K.catchEdge + 0.1;
    let lean = 0;
    for (let i = 0; i < TUNING.physicsHz; i++) {
      step(state, { ...NEUTRAL_INPUT, steer: 1 });
      const b = state.skier.thrown;
      if (!b || b.t > 0.45) continue;
      const head = at(b, R.head);
      const hips = mid(at(b, R.hipL), at(b, R.hipR));
      lean = head[2] - hips[2];
    }
    expect(state.skier.thrown?.cause ?? "catch").toBe("catch");
    expect(lean).toBeGreaterThan(0.4);
  });

  it("lies still in the end, and nothing the solver does stands him back up", () => {
    // Once he has stopped he stays stopped: no step lifts his hips off the
    // snow by more than a hand's width.
    for (const f of FALLS) {
      let low = Infinity;
      let rose = 0;
      fall(f, (b, s) => {
        if (b.still <= 0) return;
        const hips = mid(at(b, R.hipL), at(b, R.hipR));
        const over = hips[1] - s.level.groundAt(hips[0], hips[2]);
        low = Math.min(low, over);
        rose = Math.max(rose, over - low);
      });
      expect(rose, f.id).toBeLessThan(0.1);
    }
  });
});
