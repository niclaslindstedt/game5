// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE LAB'S BEAST SHEET (`gore-scenes.ts`): a rider run into an
// animal on a free ride (`engine/game/beast-hit.ts`), and what is left of
// the two (`beast-crush.ts`, `beast-gore.ts`) — a moose met at 70 and at
// 110 km/h, a reindeer at 80, a roe deer at 60, a hare and a fox at 60,
// and a moose met with the injuries OFF (knocked down and up again). Each
// animal is LAID by hand (`layBeasts`, `labBeasts` below) at a spot of its
// own down the piste, standing its ground — its fright held spent — and
// the rider stood skiing square into its flank from far enough back to
// meet it a moment later. Photographed before, at the blow, and after,
// from beside the line, from the chase and close over the carcass.

import {
  NEUTRAL_INPUT,
  beastById,
  beastPlace,
  layBeasts,
  placeRun,
  type BeastGroup,
  type BeastId,
  type GameState,
  type Level,
  type Spook,
} from "@engine";

import { wreckOf } from "../game/beast-wreck.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import type { Drive, Lens, Stage } from "./gore-scenes.ts";

/** The animals the sheet lays, in its views' order, and how far down the
 * piste each stands, a share of its length. */
const LAID: readonly { species: BeastId; at: number }[] = [
  { species: "moose", at: 0.22 },
  { species: "moose", at: 0.32 },
  { species: "reindeer", at: 0.42 },
  { species: "roedeer", at: 0.52 },
  { species: "hare", at: 0.62 },
  { species: "fox", at: 0.72 },
  { species: "moose", at: 0.82 },
];

/** LAY THE SHEET'S ANIMALS onto `level` — before the renderer builds its
 * wildlife, which sizes its meshes off the plan. */
export function labBeasts(level: Level): void {
  const groups: BeastGroup[] = LAID.map((l, k) => {
    const p = level.track.points[Math.floor(level.track.points.length * l.at)];
    return {
      id: `L${k + 1}`,
      species: l.species,
      count: 1,
      home: { x: p.x, z: p.z },
      // A round too small to walk off: it stands where it is laid.
      round: { x: p.x, z: p.z, radius: 0.05, ovality: 1, heading: 0, sense: 1, length: 0.3 },
      cycle: 100,
      phase: 0.9,
      scatter: 11 + k,
    };
  });
  layBeasts(level, { seed: level.seed, groups });
  laidOn = { level, groups };
}

/** Its fright held spent, every step: it stands its ground. */
export const held = (s: GameState): void => {
  const wild = s.wild;
  if (!wild) return;
  const spent: Spook = { at: s.t - 20, dx: 0, dz: 0, ox: 0, oz: 0 };
  for (let g = 0; g < wild.spooks.length; g++) wild.spooks[g] = spent;
};
const hold: Drive = (s) => {
  held(s);
  return NEUTRAL_INPUT;
};

/** A lens planted `dist` m out from `at` at `yaw`, `up` m over the snow. */
function planted(
  level: Level,
  at: { x: number; z: number },
  yaw: number,
  dist: number,
  up: number,
  fov = 45,
): LensPose {
  const ex = at.x + Math.sin(yaw) * dist;
  const ez = at.z + Math.cos(yaw) * dist;
  const gy = level.groundAt(at.x, at.z);
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 0.4, gy + up), z: ez },
    target: { x: at.x, y: gy + 0.6, z: at.z },
    fov,
    roll: 0,
  };
}

/** Over what is left of the animal of group `g` (where the engine's slide
 * has it), `dist` m out at `yaw`, `up` m over it. */
function onCarcass(g: number, yaw: number, dist: number, up: number, fov = 45): Lens {
  return (s) => {
    const hit = s.wild?.struck.find((h) => h.group === g);
    if (!hit) return planted(s.level, s.skier, yaw, dist, up, fov);
    // Burst, nothing of it slides: what is left is where it was met.
    if (wreckOf(hit, beastById(hit.species)).burst)
      return planted(s.level, hit, yaw, dist, up, fov);
    const sl = hit.t <= s.t ? Math.min(1, (s.t - hit.t) * 1.6) : 0;
    // Near enough the slide's end once it has gone a moment.
    const x = hit.x + (hit.vx / 1.6) * sl;
    const z = hit.z + (hit.vz / 1.6) * sl;
    return planted(s.level, { x, z }, yaw, dist, up, fov);
  };
}

/** THE RUN-IN: a fresh free ride (the injuries on unless `safe`), the
 * rider stood square across the animal of group `g` at `speed` m/s, `lead`
 * s short of it — then the frames. */
function runInto(st: Stage, g: number, speed: number, safe = false): void {
  const s = st.fresh(safe ? { safe: true } : false);
  held(s);
  // The plan's own step fills the frights: one held step first.
  st.run(s, 1 / 60, hold);
  const group = groupOf(s, g);
  if (!group) {
    // Drawn among every sheet: the animals are laid only for this one.
    st.shoot(s, "not laid: draw it with --sheet=beast", "chase");
    return;
  }
  const p = standInto(s, group, g, speed);
  const side = p.heading + Math.PI;
  st.shoot(s, "coming", planted(st.level, p, side, 11, 2.2, 50));
  st.until(s, (q) => q.events.some((e) => e.kind === "beast"), 2, hold);
  const met = s.wild!.struck.find((h) => h.group === g);
  const line = met
    ? `${met.killed ? "killed" : met.knocked ? "knocked down" : "brushed"} · crush ${met.crush.toFixed(2)}`
    : "missed";
  st.shoot(s, `blow ${line}`, planted(st.level, p, side, 9, 2, 50));
  st.run(s, 0.12, hold);
  st.shoot(s, "+0.12s", planted(st.level, p, side, 9, 2, 50));
  st.run(s, 0.4, hold);
  st.shoot(s, "+0.5s", planted(st.level, p, side, 10, 2.6, 50));
  st.shoot(s, "+0.5s chase", "chase");
  st.run(s, 2.5, hold);
  st.shoot(s, "+3s", onCarcass(g, side, 7, 3, 50));
  st.shoot(s, "+3s close", onCarcass(g, side + 0.7, 3.2, 2.4, 50));
  st.shoot(s, "+3s above", onCarcass(g, side + 0.2, 1.2, 5.5, 55));
}

/** STOOD TO MEET IT: the rider of `s` placed square across the animal of
 * `group` (the plan's `g`) at `speed` m/s, a moment short of its left
 * flank. Where the animal will stand then, and the way it faces. */
export function standInto(
  s: GameState,
  group: BeastGroup,
  g: number,
  speed: number,
): { x: number; z: number; heading: number } {
  const spec = beastById(group.species);
  const lead = 0.7;
  const p = beastPlace(group, spec, 0, s.t + lead, s.wild!.spooks[g]);
  // Into its left flank, square across it.
  const a = p.heading + Math.PI / 2;
  const back = speed * lead;
  placeRun(s, { x: p.x - Math.sin(a) * back, z: p.z - Math.cos(a) * back, heading: a, speed });
  return { x: p.x, z: p.z, heading: a - Math.PI / 2 };
}

/** The plan the sheet laid, and the map it laid it on. */
let laidOn: { level: Level; groups: BeastGroup[] } | null = null;

export function groupOf(s: GameState, g: number): BeastGroup | null {
  return laidOn && laidOn.level === s.level ? laidOn.groups[g] : null;
}

export const BEAST_VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  "moose-70": (st) => runInto(st, 0, 70 / 3.6),
  "moose-110": (st) => runInto(st, 1, 110 / 3.6),
  "reindeer-80": (st) => runInto(st, 2, 80 / 3.6),
  "roe-60": (st) => runInto(st, 3, 60 / 3.6),
  "hare-60": (st) => runInto(st, 4, 60 / 3.6),
  "fox-60": (st) => runInto(st, 5, 60 / 3.6),
  "moose-safe": (st) => runInto(st, 6, 60 / 3.6, true),
};

export const BEAST_GROUPS: Record<string, readonly string[]> = {
  beast: Object.keys(BEAST_VIEWS),
};
