// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DUAL'S VOTES (R43) — how a panel decides a dual, the classic way the
// championships judge it (`docs/freestyle.md` § *Dual moguls*): never a
// score for one skier alone, but each judge COMPARING the two runs and
// splitting his FIVE votes between them — 3–2 for a close call, 4–1 for a
// clear one, 5–0 for no contest. Seven judges, 35 votes: four TURN judges
// (20), two AIR judges (10) and one SPEED judge (5), whose split is read
// off the gap at the line — under 0.75 s a 3–2, under 1.5 s a 4–1, past it
// a 5–0. A repeated identical jump moves two votes of each air judge to the
// other skier. The winner has the majority: 35 is odd, so there always is
// one.
//
// What each judge compares is what the moguls' panel reads of a run
// (`moguls-judge.ts`'s `scoreMoguls`): the turns out of 60, the air out of
// 20 with every jump's code. Each judge's EYE — a few tenths either way
// on what he sees — is dealt off a stream of the dual's own, never
// `state.rng`.
//
// A DID NOT FINISH loses: the other skier takes every vote. Both out, the
// one who went out LATER goes through, with no votes either way.

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { DUAL_MOGULS } from "./defs/dual-moguls.ts";

/** ONE SKIER'S RUN as the panel compares it: his turns (0–60), his air
 * (0–20) and his jumps' codes, whether he was out, and when his run
 * ended — over the line or out — s on the race clock. */
export type DualRead = {
  turns: number;
  air: number;
  codes: string[];
  out: boolean;
  at: number;
};

/** A DUAL DECIDED: the votes of each kind for each skier (blue first), the
 * total, the gap at the line (null unless both finished) and the winner's
 * lane. */
export type DualVotes = {
  turns: [number, number];
  air: [number, number];
  speed: [number, number];
  votes: [number, number];
  gap: number | null;
  winner: 0 | 1;
};

/** THE JUDGES' EYES (est.): how far a turn judge's view of the turns
 * wanders, points of 20, and the margins he splits at; and an air judge's,
 * points of 10. */
export const DUAL_PANEL = {
  turnEye: 0.6,
  turnClose: 1,
  turnClear: 2.5,
  airEye: 0.4,
  airClose: 0.6,
  airClear: 1.8,
} as const;

/** One judge's five votes for the first skier off a margin `d` in his
 * favour: 3, 4 or 5 past the margins; 2, 1 or 0 against. */
function split(d: number, close: number, clear: number): number {
  const m = Math.abs(d);
  const won = m < close ? 3 : m < clear ? 4 : 5;
  return d >= 0 ? won : DUAL_MOGULS.votes - won;
}

const repeats = (codes: readonly string[]): boolean => new Set(codes).size < codes.length;

/** THE DUAL VOTED, blue `a` against red `b`, the judges' eyes off `rng`. */
export function voteDual(a: DualRead, b: DualRead, rng: Rng): DualVotes {
  const V = DUAL_MOGULS.votes;
  const J = DUAL_MOGULS.judges;
  const all = V * (J.turns + J.air + J.speed);
  if (a.out || b.out) {
    // Out: the other takes it; both out, the one out later.
    const winner: 0 | 1 = a.out && b.out ? (a.at >= b.at ? 0 : 1) : a.out ? 1 : 0;
    const take = a.out && b.out ? 0 : all;
    const votes: [number, number] = winner === 0 ? [take, 0] : [0, take];
    return { turns: [0, 0], air: [0, 0], speed: [0, 0], votes, gap: null, winner };
  }
  const P = DUAL_PANEL;
  let turns = 0;
  for (let j = 0; j < J.turns; j++) {
    const d = (a.turns - b.turns) / 3 + rng.range(-P.turnEye, P.turnEye);
    turns += split(d, P.turnClose, P.turnClear);
  }
  let air = 0;
  for (let j = 0; j < J.air; j++) {
    const d = (a.air - b.air) / 2 + rng.range(-P.airEye, P.airEye);
    let mine = split(d, P.airClose, P.airClear);
    if (repeats(a.codes)) mine -= DUAL_MOGULS.repeat;
    if (repeats(b.codes)) mine += DUAL_MOGULS.repeat;
    air += Math.max(0, Math.min(V, mine));
  }
  // The speed judge: off the gap at the line; a dead heat to the better
  // turns, which he scores too.
  const gap = Math.abs(a.at - b.at);
  const faster = gap < 0.005 ? a.turns - b.turns : b.at - a.at;
  const G = DUAL_MOGULS.gap;
  const speed = J.speed * split(faster >= 0 ? gap : -gap, G.close, G.clear);
  const mine = turns + air + speed;
  const theirs = all - mine;
  return {
    turns: [turns, V * J.turns - turns],
    air: [air, V * J.air - air],
    speed: [speed, V * J.speed - speed],
    votes: [mine, theirs],
    gap,
    winner: mine > theirs ? 0 : 1,
  };
}
