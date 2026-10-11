// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HIDDEN SPOTS — places off the pistes a skier finds by going there:
// the highest ground on the ridge he can traverse to, a glade in the woods,
// the top of a cliff, the far corner of the valley floor and a lake's shore
// (or, on a map with no water, the tree line). Unmarked until found; the
// medals by how many of them are found, over every ride of the map.
//
// DEALT off the map's ground, woods, cliffs and water alone: every
// candidate stands on ground a skier can stop on, clear of the trunks, off
// every run and lane by `CHALLENGES.spots.offRun`, inside the map and no
// higher than a little under its highest lift top — so it is reached by
// skiing, traversing and a sidestep, never by climbing a summit.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { nearestWithin, skiRoutesOf } from "../../mapgen/index.ts";
import type { Level, TrackHit, TrackPoint, Vec3 } from "../../mapgen/types.ts";
import { CHALLENGES } from "../defs/challenges.ts";
import { treesNear } from "../upright-grid.ts";
import { onOwnSkis } from "./common.ts";
import {
  medalOf,
  type ChallengeBase,
  type ChallengeEvent,
  type ChallengeKind,
  type ChallengeMemory,
  type ChallengeWatch,
} from "./types.ts";

const S = CHALLENGES.spots;

/** What a hidden spot is. */
export type SpotKind = "ridge" | "glade" | "cliff" | "corner" | "shore" | "treeline";

/** ONE HIDDEN SPOT: its id within the challenge (`s1`…), what it is, where,
 * and how near it a skier must come, m. */
export type HiddenSpot = {
  id: string;
  what: SpotKind;
  x: number;
  y: number;
  z: number;
  radius: number;
};

/** THE SPOTS CHALLENGE: its hidden spots; its value how many are found. */
export interface SpotsChallenge extends ChallengeBase {
  kind: "spots";
  spots: HiddenSpot[];
}

export function isSpots(c: ChallengeBase): c is SpotsChallenge {
  return c.kind === "spots";
}

type Line = { track: { points: TrackPoint[]; length: number } };
const hit: TrackHit = { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };
const near: number[] = [];
const up: Vec3 = { x: 0, y: 1, z: 0 };

function dealSpots(level: Level, rng: Rng): SpotsChallenge[] {
  const lifts = level.resort?.lifts ?? [];
  if (lifts.length === 0) return [];
  const lines: Line[] = [
    ...(level.resort?.runs ?? []).map((r) => ({ track: { points: r.points, length: r.length } })),
    ...skiRoutesOf(level).map((r) => ({ track: { points: r.points, length: r.length } })),
  ].filter((l) => l.track.points.length >= 2);
  const top = Math.max(...lifts.map((l) => l.top.y)) - S.under;
  const low = Math.min(...lifts.map((l) => l.bottom.y)) + S.low;
  const offRuns = (x: number, z: number): boolean => {
    for (const l of lines) {
      nearestWithin(l, x, z, 80 + S.offRun, hit);
      if (
        hit.distance !== Infinity &&
        hit.distance - l.track.points[hit.index].width / 2 < S.offRun
      )
        return false;
    }
    return true;
  };
  const inside = (x: number, z: number) =>
    x >= S.margin && z >= S.margin && x <= level.size - S.margin && z <= level.size - S.margin;
  const standable = (x: number, z: number, y: number, flat = true): boolean => {
    if (!inside(x, z) || y > top) return false;
    if (flat) {
      level.normalAt(x, z, up);
      if (up.y < S.flat) return false;
    }
    if (treesNear(level, x, z, S.clear, near).length > 0) return false;
    return offRuns(x, z);
  };
  // The candidates: the map sampled on a grid, every one a skier could
  // stop at.
  const cands: { x: number; y: number; z: number }[] = [];
  for (let z = S.margin; z <= level.size - S.margin; z += S.sample) {
    for (let x = S.margin; x <= level.size - S.margin; x += S.sample) {
      const y = level.groundAt(x, z);
      if (standable(x, z, y)) cands.push({ x, y, z });
    }
  }
  const chosen: HiddenSpot[] = [];
  const apart = (x: number, z: number) => chosen.every((s) => hypot(s.x - x, s.z - z) >= S.apart);
  const add = (what: SpotKind, p: { x: number; y: number; z: number } | undefined) => {
    if (!p || !apart(p.x, p.z) || chosen.length >= S.count) return;
    chosen.push({ id: `s${chosen.length + 1}`, what, x: p.x, y: p.y, z: p.z, radius: S.radius });
  };
  // THE RIDGE: the highest of them.
  add(
    "ridge",
    cands.reduce<(typeof cands)[number] | undefined>(
      (b, c) => (!b || c.y > b.y ? c : b),
      undefined,
    ),
  );
  // A GLADE: an opening in the woods below the tree line.
  const m = level.mountain;
  const treeY = m ? m.treeLine + m.sea : Infinity;
  const glades = cands.filter(
    (c) =>
      c.y < treeY &&
      apart(c.x, c.z) &&
      treesNear(level, c.x, c.z, S.glade.open, near).length === 0 &&
      treesNear(level, c.x, c.z, S.glade.ring, near).length >= S.glade.woods,
  );
  if (glades.length > 0) add("glade", rng.pick(glades));
  // A CLIFF'S TOP: one of the three highest faces off the pistes.
  const cliffs = (level.cliffs ?? [])
    .filter((c) => !c.onTrack && !c.run && c.drop >= S.cliff)
    .map((c) => {
      const x = c.x - Math.sin(c.heading) * S.cliffBack;
      const z = c.z - Math.cos(c.heading) * S.cliffBack;
      return { x, z, y: level.groundAt(x, z), drop: c.drop };
    })
    .filter((c) => apart(c.x, c.z) && standable(c.x, c.z, c.y, false))
    .sort((a, b) => b.drop - a.drop || a.x - b.x || a.z - b.z)
    .slice(0, 3);
  if (cliffs.length > 0) add("cliff", rng.pick(cliffs));
  // THE FAR CORNER: the low ground farthest from the village.
  const village = level.resort?.village ?? level.mountain?.base ?? { x: 0, z: 0 };
  const far = (c: { x: number; z: number }) => hypot(c.x - village.x, c.z - village.z);
  add(
    "corner",
    cands
      .filter((c) => c.y <= low && apart(c.x, c.z))
      .reduce<(typeof cands)[number] | undefined>(
        (b, c) => (!b || far(c) > far(b) ? c : b),
        undefined,
      ),
  );
  // A SHORE: a point on the biggest water's shore — or, with none, the
  // tree line.
  const shore: { x: number; y: number; z: number }[] = [];
  const water = [...(level.water ?? [])].sort((a, b) => b.area - a.area)[0];
  if (water) {
    const ring = water.rings[0];
    for (let i = 0; i + 1 < ring.length; i += 2) {
      const x = ring[i];
      const z = ring[i + 1];
      if (apart(x, z) && standable(x, z, water.y, false)) shore.push({ x, y: water.y, z });
    }
  }
  if (shore.length > 0) add("shore", rng.pick(shore));
  else {
    const line = cands.filter((c) => Math.abs(c.y - treeY) < 40 && apart(c.x, c.z));
    if (line.length > 0) add("treeline", rng.pick(line));
  }
  if (chosen.length < 2) return [];
  const n = chosen.length;
  return [
    {
      id: "spots",
      kind: "spots",
      spots: chosen,
      medals: {
        bronze: Math.ceil(n * S.medals.bronze),
        silver: Math.ceil(n * S.medals.silver),
        gold: Math.ceil(n * S.medals.gold),
      },
      better: "higher",
      unit: "count",
    },
  ];
}

function watchSpots(dealt: readonly SpotsChallenge[], memory: ChallengeMemory): ChallengeWatch {
  const found = new Map(dealt.map((c) => [c, new Set(memory.found?.[c.id] ?? [])]));
  return {
    step(state, out: ChallengeEvent[]) {
      if (!onOwnSkis(state)) return;
      const k = state.skier;
      for (const c of dealt) {
        const got = found.get(c)!;
        for (const s of c.spots) {
          if (got.has(s.id) || hypot(k.x - s.x, k.z - s.z) > s.radius) continue;
          got.add(s.id);
          out.push({
            kind: "found",
            id: c.id,
            t: state.t,
            what: s.id,
            value: got.size,
            medal: medalOf(c, got.size),
          });
        }
      }
    },
  };
}

export const SPOTS_KIND: ChallengeKind<SpotsChallenge> = {
  id: "spots",
  deal: dealSpots,
  watch: (_level, dealt, memory) => watchSpots(dealt, memory),
};
