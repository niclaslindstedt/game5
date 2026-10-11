// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE CHALLENGES SHOW — the payloads the HUD's chip and plate, the
// minimap's marks and the pause card's list are drawn from, read off the
// session a free ride is judged in (`challenge-run.ts`). DOM-free like every
// HUD payload here, so the suite reads it; nothing in it decides a result.
//
// THE CHIP while a timed line runs: the clock, the medal it is still inside
// (gold while it is under gold's time, then silver, then bronze, then none)
// and that medal's time, and how far down the line the skier is. THE PLATE
// for a few seconds after a line or a trick is done. THE MARKS on the
// minimap: every line's two gates as flag pairs (the running line's finish
// lit), every trick kicker a star, every lift top not yet stood on a hollow
// triangle — and a hidden spot ONLY ONCE IT IS FOUND. THE ROWS on the pause
// card: each challenge's name, its three bars and the best held.

import {
  isLine,
  isSpots,
  isSummits,
  isTrick,
  MEDALS,
  type ChallengeBase,
  type GameState,
  type LiveLine,
  type Medal,
  type RunGrade,
} from "@engine";

import type { ChallengeEntry } from "./challenge-book.ts";
import {
  challengeName,
  challengeSessionOf,
  runLabel,
  type ChallengePlate,
} from "./challenge-run.ts";
import { STRINGS } from "./strings.ts";

/** How long the plate stays up after a finish, s of engine time. */
export const PLATE_HOLD = 4.5;

/** The best medal the clock is still inside, and its time — or none. */
export function medalInReach(
  elapsed: number,
  medals: LiveLine["medals"],
): { medal: Medal; time: number } | null {
  for (const medal of ["gold", "silver", "bronze"] as const) {
    if (elapsed <= medals[medal]) return { medal, time: medals[medal] };
  }
  return null;
}

export type ChallengeChip = {
  /** The line's run as named: `RUN 4`. */
  run: string;
  elapsed: number;
  share: number;
  /** The medal still in reach and its time, or null past bronze. */
  reach: { medal: Medal; time: number } | null;
};

export type ChallengeTile = {
  chip: ChallengeChip | null;
  plate: ChallengePlate | null;
};

/** The HUD's challenge chip and plate for `state`, or null where nothing
 * is shown (no session, or neither up). */
export function challengeTile(state: GameState): ChallengeTile | null {
  const s = challengeSessionOf(state);
  if (!s) return null;
  const live = s.run.live();
  const chip: ChallengeChip | null = live
    ? {
        run: runLabel(s.level, live.run) ?? "",
        elapsed: live.elapsed,
        share: live.share,
        reach: medalInReach(live.elapsed, live.medals),
      }
    : null;
  const plate =
    s.plate && state.t - s.plate.t >= 0 && state.t - s.plate.t < PLATE_HOLD ? s.plate : null;
  return chip || plate ? { chip, plate } : null;
}

/* ── THE MINIMAP ───────────────────────────────────────────────────────── */

/** A line's gate on the plate: its two flags, world metres. */
export type GateMark = {
  id: string;
  role: "start" | "finish";
  left: [number, number];
  right: [number, number];
  /** The finish of the line being run now. */
  live: boolean;
};

export type ChallengeMarks = {
  gates: GateMark[];
  /** A trick goal's kicker, with the best medal held there. */
  kickers: { x: number; z: number; medal: Medal | null }[];
  /** The lift tops not yet stood on. */
  summits: { x: number; z: number }[];
  /** The hidden spots FOUND — never one before. */
  spots: { x: number; z: number }[];
};

/** Everything the minimap marks for the challenges of `state`, or null. */
export function challengeMarks(state: GameState): ChallengeMarks | null {
  const s = challengeSessionOf(state);
  if (!s) return null;
  const held = s.book.maps[s.run.plan.key] ?? {};
  const running = s.run.live()?.id ?? null;
  const out: ChallengeMarks = { gates: [], kickers: [], summits: [], spots: [] };
  for (const c of s.run.plan.challenges) {
    if (isLine(c)) {
      for (const role of ["start", "finish"] as const) {
        const g = c[role];
        out.gates.push({
          id: c.id,
          role,
          left: [g.left.x, g.left.z],
          right: [g.right.x, g.right.z],
          live: role === "finish" && c.id === running,
        });
      }
    } else if (isTrick(c)) {
      out.kickers.push({ x: c.kicker.x, z: c.kicker.z, medal: held[c.id]?.medal ?? null });
    } else if (isSummits(c)) {
      const got = new Set(held[c.id]?.found ?? []);
      for (const t of c.tops) if (!got.has(t.lift)) out.summits.push({ x: t.at.x, z: t.at.z });
    } else if (isSpots(c)) {
      const got = new Set(held[c.id]?.found ?? []);
      for (const p of c.spots) if (got.has(p.id)) out.spots.push({ x: p.x, z: p.z });
    }
  }
  return out;
}

/* ── THE PAUSE CARD'S LIST ─────────────────────────────────────────────── */

export type ChallengeRow = {
  id: string;
  kind: string;
  name: string;
  /** A line's or a kicker's run colour, where it has one. */
  grade: RunGrade | null;
  /** A line's run, to ride it again. */
  run: string | null;
  /** Each medal's bar in words, gold first. */
  bars: { medal: Medal; text: string }[];
  /** The best held: its medal and its value in words, or null. */
  held: { medal: Medal | null; text: string } | null;
};

/** A challenge's value in words. */
function valueText(c: ChallengeBase, v: number): string {
  if (c.unit === "s") return STRINGS.challengeTime(v);
  if (isTrick(c)) {
    const tier = MEDALS[Math.max(0, Math.min(2, Math.round(v) - 1))];
    return STRINGS.challengeGoal(c.goals[tier]);
  }
  return STRINGS.challengeCountBar(v);
}

/** Every challenge of the session as the pause card lists it, or null off
 * a judged free ride. */
export function challengeRows(state: GameState): ChallengeRow[] | null {
  const s = challengeSessionOf(state);
  if (!s) return null;
  const held: Readonly<Record<string, ChallengeEntry>> = s.book.maps[s.run.plan.key] ?? {};
  const grades = new Map((s.level.resort?.runs ?? []).map((r) => [r.id, r.grade as RunGrade]));
  return s.run.plan.challenges.map((c) => {
    const e = held[c.id];
    const n = e?.found?.length ?? 0;
    const bars = (["gold", "silver", "bronze"] as const).map((medal) => ({
      medal,
      text: isTrick(c) ? STRINGS.challengeGoal(c.goals[medal]) : valueText(c, c.medals[medal]),
    }));
    const runId = isLine(c) || isTrick(c) ? c.run : null;
    return {
      id: c.id,
      kind: c.kind,
      name: challengeName(s.level, c, n),
      grade: isLine(c) ? c.grade : runId ? (grades.get(runId) ?? null) : null,
      run: isLine(c) ? c.run : null,
      bars,
      held: e && e.value !== undefined ? { medal: e.medal, text: valueText(c, e.value) } : null,
    };
  });
}
