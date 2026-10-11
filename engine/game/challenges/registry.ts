// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// FREE RIDE CHALLENGES: THE REGISTRY — the goals every free ride map DEALS, each with a
// bronze, a silver and a gold, and the JUDGE that watches a run for them
// (`docs/challenges.md`).
//
// THE KINDS ARE PLUG-INS. `CHALLENGE_KINDS` is a list of rows, each a
// `ChallengeKind`: an id, `deal(level, rng)` — what the kind deals off a
// map — and `watch(level, dealt, memory)` — the pure watcher that judges a
// run for them. Every kind deals off a stream of its OWN (the map's key
// hashed with the kind's id), so a kind added later — avalanches survived,
// a wingsuit line, a new ride, a ski jump's distance — is ONE NEW ROW (its
// module beside these and a line here), and every challenge the others
// deal stays exactly what it was: the app's book keys a result by the
// map's key and the challenge's id, and neither moves.
//
// PURE AND READ-ONLY. A plan is a function of the map alone — its seed,
// its face or region and its generator — off streams of its own, never
// `state.rng`; a free ride's map differs only by the course it was stood
// up on, and every kind deals off what the ski area publishes the same way
// whichever that was (runs by id, kickers by their lips). A judge reads the
// state after each step and writes nothing into it, so no digest moves.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Level } from "../../mapgen/types.ts";
import type { GameState } from "../state.ts";
import { hashText } from "./common.ts";
import { LINE_KIND } from "./line.ts";
import { SPOTS_KIND } from "./spots.ts";
import { SUMMITS_KIND } from "./summits.ts";
import { TRICK_KIND } from "./trick.ts";
import type {
  ChallengeBase,
  ChallengeEvent,
  ChallengeKind,
  ChallengeMemory,
  ChallengeWatch,
  LiveLine,
} from "./types.ts";

/** EVERY KIND OF CHALLENGE, in the order a plan lists them. A new kind is
 * a row here. */
export const CHALLENGE_KINDS: readonly ChallengeKind[] = [
  LINE_KIND as unknown as ChallengeKind,
  TRICK_KIND as unknown as ChallengeKind,
  SPOTS_KIND as unknown as ChallengeKind,
  SUMMITS_KIND as unknown as ChallengeKind,
];

/** What the challenges' streams are seeded with beside the map's key. */
const CHALLENGE_SALT = 0x6c4a11e5;

/** A MAP'S CHALLENGES: the key the app files them under, and every
 * challenge dealt, kind by kind. */
export type ChallengePlan = { key: string; challenges: ChallengeBase[] };

/** THE KEY A MAP'S CHALLENGES ARE FILED UNDER: its face (or its region),
 * its seed and its generator — the same for every course of it. */
export function challengeKey(level: Level): string {
  const where = level.face ? `face-${level.face}` : (level.region ?? "alpine");
  return `${where}:${level.seed}:v${level.version ?? 0}`;
}

const plans = new WeakMap<Level, ChallengePlan>();

/** DEAL `level`'s challenges — kept per map. A map with no ski area (a
 * race's own piste) deals none. */
export function dealChallenges(level: Level): ChallengePlan {
  const known = plans.get(level);
  if (known) return known;
  const key = challengeKey(level);
  const challenges: ChallengeBase[] = [];
  if (level.resort) {
    for (const kind of CHALLENGE_KINDS) {
      const rng = createRng(hashText(`${key}/${kind.id}`, CHALLENGE_SALT));
      challenges.push(...kind.deal(level, rng));
    }
  }
  const plan = { key, challenges };
  plans.set(level, plan);
  return plan;
}

/** A RUN'S JUDGE: `step` it with the state after every engine step the
 * player rides (never a pre-roll's) and it hands back what it saw this
 * step; `live` is the timed line under way, for the HUD. */
export type ChallengeRun = {
  plan: ChallengePlan;
  step(state: GameState): ChallengeEvent[];
  live(): LiveLine | null;
};

/** ARM A JUDGE over `level`'s challenges, with what the app's book has
 * already found (`memory`). */
export function createChallengeRun(level: Level, memory: ChallengeMemory = {}): ChallengeRun {
  const plan = dealChallenges(level);
  const watches: ChallengeWatch[] = CHALLENGE_KINDS.map((kind) =>
    kind.watch(
      level,
      plan.challenges.filter((c) => c.kind === kind.id),
      memory,
    ),
  );
  return {
    plan,
    step(state) {
      const out: ChallengeEvent[] = [];
      for (const w of watches) w.step(state, out);
      return out;
    },
    live() {
      for (const w of watches) {
        const l = w.live?.();
        if (l) return l;
      }
      return null;
    },
  };
}
