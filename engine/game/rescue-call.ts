// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR AMBULANCE ON THE SNOW, MET AS A SOLID — a run that starts after
// one ended INJURED (`rescue.ts`) carries the rescues still under way
// (`GameState.rescue`, handed in by the app before the first step,
// `CreateGameOptions.rescue`): each a helicopter's landing site, the run's
// clock it touches down at and the one it lifts at, and the casualties it
// came for. Where it lands and what its crew do are the app's
// (`pwa/src/game/rescue-flight.ts`, which plans them off the map); the
// engine reads only the machine sat on its skids, as upright BOXES off its
// own frame — the cabin, the engine deck, the boom, the fin, the tail
// rotor's disc and the two skids — and holds a skier out of them as the
// airstrip's plane on the snow holds him (`airstrip-solids.ts`'s
// `meetBoxes`): a crawl into it held off, a run into it at speed a blow on
// steel that throws him (`crash.ts`'s `wipeoutCause`). A thrown body is
// held out of it too.
//
// A call is an air ambulance unless it says otherwise: a run that ended
// DEAD calls the POLICE (`kind: "police"`, `docs/police.md`), whose machine
// sits on the same skids and is the same solid — its `evidence` (where he
// struck, what he left on the snow, where he lay) is the app's to draw and
// never read here.
//
// A run that asked for none never reaches it, so no digest moves, and
// nothing is drawn from the stream.

import { fromEuler, rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { meetBoxes, ragdollOutOfBoxes, type StripBox } from "./airstrip-solids.ts";
import { HELI } from "./defs/heli.ts";
import { onSkis } from "./groomer.ts";
import type { CrewTrack } from "./foot.ts";
import type { GameEvent, GameState } from "./state.ts";

/** Where a rescue's machine sits: its skid datum, heading and the
 * attitude the snow under its skids leaves it at. */
export type RescueSite = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
};

/** ONE ITEM OF EVIDENCE at a fatal accident's scene, on the snow (m,
 * world): where he struck (`impact`), blood a smash left on a solid
 * (`blood`), a piece of him torn off (`piece`), a ski that went on without
 * him (`ski`), and the body (`body`). */
export type Evidence = {
  what: "impact" | "blood" | "piece" | "ski" | "body";
  x: number;
  z: number;
};

/** ONE AIR AMBULANCE called to the mountain, as a run sees it: the run's
 * clock its flight began at (its plan's 0 — negative when it set off on an
 * earlier run), where it sits, the run's clocks it touches down and lifts
 * at, and the casualties it is there for (where each lay, and the plan's
 * clock each was found at — the app's to draw). */
export type RescueCall = {
  start: number;
  site: RescueSite;
  down: number;
  up: number;
  casualties: { x: number; z: number; known: number }[];
  /** The run's clock the machine was TAKEN at by the skier (`steal.ts`),
   * from which it no longer stands there — absent while it is its crew's. */
  stolen?: number;
  /** What was called: the air ambulance (left out) or, after a death, the
   * police — and the scene's evidence, numbered from the impact to the
   * body, which only a police call carries. */
  kind?: "police";
  evidence?: Evidence[];
  /** Where each of its crew is on the snow over the call (`foot.ts`'s
   * `CrewTrack`), sampled off its plan by the app — the bodies the skier
   * meets; absent when the app sampled none. */
  crew?: CrewTrack[];
};

/** A call copied whole, so a run never shares one with its caller. */
export function copyCall(r: RescueCall): RescueCall {
  return {
    start: r.start,
    site: { ...r.site },
    down: r.down,
    up: r.up,
    casualties: r.casualties.map((c) => ({ ...c })),
    ...(r.stolen !== undefined ? { stolen: r.stolen } : {}),
    ...(r.kind ? { kind: r.kind } : {}),
    ...(r.evidence ? { evidence: r.evidence.map((e) => ({ ...e })) } : {}),
    // Never written during a run: shared, not copied.
    ...(r.crew ? { crew: r.crew } : {}),
  };
}

/** The machine's solid parts in its own frame (x right, y up, z ahead,
 * off the skid datum), m: a box's corners from (x0, y0, z0) to (x1, y1,
 * z1). Off `HELI`'s airframe. */
const B = HELI.body;
const S = HELI.skid;
const T = HELI.tail;
export const RESCUE_PARTS: readonly (readonly [number, number, number, number, number, number])[] =
  [
    // The cabin, nose to the engine deck's end.
    [-B.width / 2, B.floor, -1.6, B.width / 2, B.roof, B.nose],
    // The engine deck and the mast under the hub.
    [-0.62, B.roof, -2.4, 0.62, HELI.rotor.hub - 0.2, 0.9],
    // The boom.
    [-0.28, B.boom - 0.36, B.tail + 0.6, 0.28, B.boom + 0.28, -1.6],
    // The fin.
    [-0.1, 1.1, B.tail, 0.1, 3.37, B.tail + 0.85],
    // The tail rotor's disc, on the boom's right.
    [
      T.hub.x - 0.08,
      T.hub.y - T.radius,
      T.hub.z - T.radius,
      T.hub.x + 0.08,
      T.hub.y + T.radius,
      T.hub.z + T.radius,
    ],
    // The skids and their cross tubes up to the belly, either side.
    [S.track / 2 - 0.08, 0, S.back, S.track / 2 + 0.08, B.floor, S.front],
    [-S.track / 2 - 0.08, 0, S.back, -S.track / 2 + 0.08, B.floor, S.front],
  ];

/** THE MACHINE SAT AT `site` as boxes into `out` (appended). */
export function rescueBoxes(site: RescueSite, out: StripBox[]): StripBox[] {
  const q = fromEuler(site.heading, site.pitch, site.roll);
  const fx = Math.sin(site.heading);
  const fz = Math.cos(site.heading);
  const rx = fz;
  const rz = -fx;
  for (const [x0, y0, z0, x1, y1, z1] of RESCUE_PARTS) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of [x0, x1]) {
      for (const y of [y0, y1]) {
        for (const z of [z0, z1]) {
          const w = rotate(q, { x, y, z });
          lo = Math.min(lo, w.y);
          hi = Math.max(hi, w.y);
        }
      }
    }
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    out.push({
      x: site.x + rx * mx + fx * mz,
      z: site.z + rz * mx + fz * mz,
      dx: fx,
      dz: fz,
      halfLength: (z1 - z0) / 2,
      halfWidth: (x1 - x0) / 2,
      base: site.y + lo,
      top: site.y + hi,
      stuff: "steel",
    });
  }
  return out;
}

/** How near the machine's middle a body must be to meet it at all, m. */
const NEAR = 14;

const boxes: StripBox[] = [];

/** Every rescue machine on its skids at the run's clock and near (`x`,
 * `z`), as boxes (shared; read before the next call). */
function landedNear(state: GameState, x: number, z: number): readonly StripBox[] {
  boxes.length = 0;
  for (const r of state.rescue ?? []) {
    if (state.t < r.down || state.t >= r.up || r.stolen !== undefined) continue;
    if (hypot(x - r.site.x, z - r.site.z) > NEAR) continue;
    rescueBoxes(r.site, boxes);
  }
  return boxes;
}

/** THE SKIER HELD OUT OF EVERY LANDED AIR AMBULANCE this step, after the
 * trees and the airstrip — the worst blow a `hit` on steel. */
export function meetRescue(state: GameState, events: GameEvent[]): void {
  if (!state.rescue?.length || !onSkis(state)) return;
  const near = landedNear(state, state.skier.x, state.skier.z);
  if (near.length) meetBoxes(state, near, events);
}

/** THE THROWN BODY HELD OUT OF THEM (`ragdoll.ts`, beside the strip's). */
export function ragdollOutOfRescue(
  state: GameState,
  P: number[],
  L: number[],
  radius: ArrayLike<number>,
  struck: number[],
  dt: number,
): void {
  if (!state.rescue?.length) return;
  const near = landedNear(state, P[0], P[2]);
  if (near.length) ragdollOutOfBoxes(P, L, radius, struck, dt, near);
}

/** THE CALLS A RUN STARTS WITH, set before its first step (a run stood up
 * by a caller that does not take `CreateGameOptions.rescue`). */
export function withRescue<S extends { rescue?: RescueCall[] }>(
  state: S,
  calls: readonly RescueCall[],
): S {
  if (calls.length) state.rescue = calls.map(copyCall);
  else delete state.rescue;
  return state;
}
