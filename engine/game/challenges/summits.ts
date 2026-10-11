// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY SUMMIT — every lift of the ski area ridden to its top and stood off
// there (the `lift` event's `off`), over every ride of the map; the medals
// by the share of the lifts' tops reached (`CHALLENGES.summits`).

import type { Level, Vec3 } from "../../mapgen/types.ts";
import { CHALLENGES } from "../defs/challenges.ts";
import { byId } from "./common.ts";
import {
  medalOf,
  type ChallengeBase,
  type ChallengeEvent,
  type ChallengeKind,
  type ChallengeMemory,
  type ChallengeWatch,
} from "./types.ts";

/** THE SUMMITS CHALLENGE: every lift's top, by the lift's id; its value
 * how many are stood off. */
export interface SummitsChallenge extends ChallengeBase {
  kind: "summits";
  tops: { lift: string; kind: "gondola" | "chair" | "drag"; at: Vec3 }[];
}

export function isSummits(c: ChallengeBase): c is SummitsChallenge {
  return c.kind === "summits";
}

function dealSummits(level: Level): SummitsChallenge[] {
  const lifts = [...(level.resort?.lifts ?? [])].sort((a, b) => byId(a.id, b.id));
  if (lifts.length === 0) return [];
  const n = lifts.length;
  const S = CHALLENGES.summits;
  return [
    {
      id: "summits",
      kind: "summits",
      tops: lifts.map((l) => ({ lift: l.id, kind: l.kind, at: { ...l.top } })),
      medals: {
        bronze: Math.max(1, Math.ceil(n * S.bronze)),
        silver: Math.max(1, Math.ceil(n * S.silver)),
        gold: Math.ceil(n * S.gold),
      },
      better: "higher",
      unit: "count",
    },
  ];
}

function watchSummits(dealt: readonly SummitsChallenge[], memory: ChallengeMemory): ChallengeWatch {
  const found = new Map(dealt.map((c) => [c, new Set(memory.found?.[c.id] ?? [])]));
  return {
    step(state, out: ChallengeEvent[]) {
      for (const e of state.events) {
        if (e.kind !== "lift" || e.phase !== "off") continue;
        for (const c of dealt) {
          const got = found.get(c)!;
          if (got.has(e.id) || !c.tops.some((t) => t.lift === e.id)) continue;
          got.add(e.id);
          out.push({
            kind: "found",
            id: c.id,
            t: state.t,
            what: e.id,
            value: got.size,
            medal: medalOf(c, got.size),
          });
        }
      }
    },
  };
}

export const SUMMITS_KIND: ChallengeKind<SummitsChallenge> = {
  id: "summits",
  deal: (level) => dealSummits(level),
  watch: (_level, dealt, memory) => watchSummits(dealt, memory),
};
