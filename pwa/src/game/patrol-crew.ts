// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PATROL AT AN AVALANCHE, POSED — the two who come for a buried
// skier (`avalanche-rescue.ts`'s `patrolMan` says where each is and what he
// is doing), as KEYS of a body in its boots (`party-pose.ts`' `Key`, laid
// on the crowd's bodies by `civilian-moves.ts`' `keyPosed`), and the
// WEIGHTS a moment puts on them. Three-free, so the suite reads it.
//
// What a rescuer does, as the drills teach it and the poses show it: SKIING
// IN, low over his skis; the COARSE SEARCH on foot with the transceiver
// held out at his chest, eyes on its display; the FINE SEARCH crouched with
// the unit down on the snow, bracketing for the lowest number; the PROBE
// held upright in both hands in front of him, pushed in and drawn back;
// and the SHOVEL — the civilians' own scoop and throw (`shovel0..2`), as a
// conveyor clears a hole from downhill. The stride is the air ambulance
// crew's (`rescue-crew.ts`' `strideKey`): every key's planted foot stands
// where a linear stance puts it, so it never slides.
//
// The frame is the patroller's: x right, y up, z the way he faces, the
// floor at 0.

import type { CrowdBody, PatrolMan } from "@engine";

import { CIVILIAN_POSES, keyPosed, type Holding } from "./civilian-moves.ts";
import { civilianTargets } from "./civilian-shapes.ts";
import { CROWD_LOOKS, type Posed } from "./crowd-rig.ts";
import { ANKLE, blend, v, type Key } from "./party-pose.ts";
import { RESCUE_STRIDE, crewKey, strideKey } from "./rescue-crew.ts";

/** The targets, in the order the morph targets and weights go in (the
 * stance is the base). */
export const PATROL_POSES = [
  "walk0",
  "walk1",
  "walk2",
  "walk3",
  "ski",
  "search",
  "searchLow",
  "probeUp",
  "probeDown",
  "shovel0",
  "shovel1",
  "shovel2",
] as const;
export type PatrolTarget = (typeof PATROL_POSES)[number];

/** Where the probe stands in a patroller's frame, m: upright before him,
 * between his hands — the pole the view draws (`patrol-view.ts`). */
export const PROBE_AT = { x: 0, z: 0.42 } as const;
/** How far the probe goes in on a stroke, m — the hands' travel. */
export const PROBE_STROKE = 0.42;
/** One probe stroke, s: up, in and drawn back. */
export const PROBE_CYCLE = 0.5;
/** One shovel load, s: the civilians' (`civilian-moves.ts`' `CYCLE`), a
 * little quicker for a rescuer working against the clock. */
export const SHOVEL_CYCLE = 1.9;

const copy = (k: Key): Key => blend(k, k, 0);
const STOOD = crewKey("stand");

/** SKIING IN: knees and hips bent over the skis, the hands forward where
 * the poles are held. */
const SKI: Key = {
  ...copy(STOOD),
  hipY: 0.8,
  hipZ: -0.1,
  pitch: 0.38,
  nod: 0.18,
  feet: [v(-0.12, ANKLE, 0.06), v(0.12, ANKLE, -0.04)],
  hands: [v(-0.3, 0.86, 0.36), v(0.3, 0.86, 0.36)],
};

/** THE COARSE SEARCH: walking on, the unit held out at his chest in the
 * right hand and his eyes on it. */
const SEARCH: Key = {
  ...copy(STOOD),
  pitch: 0.12,
  nod: -0.42,
  hands: [v(-0.28, 0.86, 0.1), v(0.06, 1.08, 0.36)],
};

/** THE FINE SEARCH: crouched, the unit down on the snow before him, the
 * other hand on his knee. */
const SEARCH_LOW: Key = {
  ...copy(STOOD),
  hipY: 0.5,
  hipZ: -0.22,
  pitch: 0.95,
  nod: -0.28,
  feet: [v(-0.2, ANKLE, 0.16), v(0.2, ANKLE, -0.08)],
  hands: [v(-0.2, 0.5, 0.32), v(0.08, 0.1, 0.55)],
};

/** THE PROBE raised: stood over it, both hands high on the pole. */
const PROBE_UP: Key = {
  ...copy(STOOD),
  pitch: 0.18,
  nod: -0.35,
  feet: [v(-0.17, ANKLE, 0.02), v(0.17, ANKLE, -0.04)],
  hands: [v(-0.04, 1.1, PROBE_AT.z), v(0.04, 1.22, PROBE_AT.z)],
};

/** THE PROBE pushed in: bent over it, the hands a stroke lower. */
const PROBE_DOWN: Key = {
  ...copy(PROBE_UP),
  hipY: 0.84,
  hipZ: -0.08,
  pitch: 0.55,
  nod: -0.3,
  hands: [v(-0.04, 1.1 - PROBE_STROKE, PROBE_AT.z), v(0.04, 1.22 - PROBE_STROKE, PROBE_AT.z)],
};

const OWN: Partial<Record<PatrolTarget, Key>> = {
  ski: SKI,
  search: SEARCH,
  searchLow: SEARCH_LOW,
  probeUp: PROBE_UP,
  probeDown: PROBE_DOWN,
};

const EMPTY: Holding = { tool: "hold", tip: 0 };

/** The skeleton and holding of every target of `body`, the stance first —
 * what the figure is built at (`civilian-shapes.ts`' `buildPosedFigure`);
 * the shovel's three are the civilians' own. */
export function patrolTargets(body: CrowdBody): { posed: Posed; holding: Holding }[] {
  const look = CROWD_LOOKS[body];
  const civil = civilianTargets(body);
  return (["stand", ...PATROL_POSES] as const).map((t) => {
    if (t.startsWith("shovel")) return civil[1 + CIVILIAN_POSES.indexOf(t as "shovel0")];
    const key =
      t === "stand"
        ? STOOD
        : t.startsWith("walk")
          ? strideKey(Number(t.slice(-1)) as 0 | 1 | 2 | 3, null)
          : OWN[t]!;
    return { posed: keyPosed(key, look), holding: EMPTY };
  });
}

const AT = Object.fromEntries(PATROL_POSES.map((k, i) => [k, i])) as Record<PatrolTarget, number>;

const frac = (x: number): number => x - Math.floor(x);
const ease = (x: number): number => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

/** How far the probe is pushed in at a moment of his probing, 0 drawn up …
 * 1 a stroke down. */
export function probeIn(work: number): number {
  const c = frac(work / PROBE_CYCLE);
  return c < 0.45 ? ease(c / 0.45) : 1 - ease((c - 0.6) / 0.4);
}

/** THE WEIGHTS of patroller `man` at his moment, one a target in
 * `PATROL_POSES`' order, written into `out` — whole bodies past the
 * stance, summing to one at most. `pace` is how fast he is moving over the
 * snow, m/s (the walk's stride is paced to it). */
export function patrolDials(man: PatrolMan, pace: number, out: Float32Array): Float32Array {
  out.fill(0);
  const t = man.work;
  switch (man.act) {
    case "ski":
      out[AT.ski] = 1;
      break;
    case "walk":
    case "search": {
      // Walking on at his pace, a stride the keys' length, so a planted
      // foot keeps its place on the snow.
      const moving = Math.max(0, Math.min(1, pace / 0.6));
      const x = frac((t * Math.max(pace, 0.6)) / RESCUE_STRIDE) * 4;
      const q = Math.floor(x) % 4;
      const f = x - Math.floor(x);
      const cyc = moving * (man.act === "search" ? 0.6 : 1);
      out[AT[`walk${q}` as PatrolTarget]] += (1 - f) * cyc;
      out[AT[`walk${(q + 1) % 4}` as PatrolTarget]] += f * cyc;
      if (man.act === "search") {
        // Stood still over the lowest reading, he is down with the unit.
        out[pace < 0.25 ? AT.searchLow : AT.search] += 1 - cyc;
      }
      break;
    }
    case "probe": {
      const k = probeIn(t);
      out[AT.probeUp] = 1 - k;
      out[AT.probeDown] = k;
      break;
    }
    case "dig": {
      // Into the scoop, lifted and thrown out of the hole, back for the
      // next (`civilian-moves.ts`' shovel).
      const c = frac(t / SHOVEL_CYCLE);
      const scoop = ease(c / 0.3) * (1 - ease((c - 0.45) / 0.15));
      const toss = ease((c - 0.45) / 0.15) * (1 - ease((c - 0.75) / 0.25));
      out[AT.shovel0] = scoop;
      out[AT.shovel1] = toss;
      out[AT.shovel2] = Math.max(0, 1 - scoop - toss);
      break;
    }
    case "stand":
      break;
  }
  return out;
}
