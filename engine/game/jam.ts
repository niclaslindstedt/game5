// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A KNUCKLE HUCK'S JAM (R38) — the session the format is, from
// `docs/freestyle.md` § *Knuckle huck*: about eight riders share the
// knuckle for a set time and hit it as often as the clock allows, and the
// panel ranks each on ONE OVERALL IMPRESSION of his whole session — style,
// invention, variety, the best of what he landed — never a score a hit.
//
// THE HITS. A jam run (`RunRules.jam`) owes no course: each HIT is a ride
// from the start platform over the deck and off the knuckle, ended at the
// finish line or by a fall, and the rider is stood back on the platform
// for the next (`stepJam`, stepped after the tricks have filed the
// flight). A rider stood up before he ever left the platform has taken no
// hit. The buzzer (`RunRules.limit`) ends the session; a hit already off
// the knuckle when it goes counts.
//
// THE SESSION'S IMPRESSION. Each hit is read off its longest flight as the
// trick it was (`judge.ts`'s `readTrick` — the press, the butter's turn
// counted into the spin, the flips, the grabs) and given an impression of
// its own: the trick's difficulty sets the ceiling a clean landing reaches
// and the landing takes from it, as a big air jump's does, with a butter or
// a press worth a step of its own — the judges favour using the knuckle. The
// SESSION is the mean of the best `counting` hits (a short session's
// missing hits counting nothing: three good tricks beat one perfect one),
// a little more for each different kind of trick among them, and a little
// less for each fall — a fall costs little in a jam. The panel scores that
// as it scores a jump (`panelScore`): six eyes, the high and the low out.
//
// THE FIELD is dealt, never skied, as big air's is: each rival's hits — when
// each comes, how good, a fall or not, its kind — a pure function of the
// run's seed, his number and the hit, so the board as it stands at any
// moment of the clock is too, and nothing here draws from `state.rng`.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { KNUCKLE_HUCK } from "./defs/modes.ts";
import { jumpOf } from "./big-air-contest.ts";
import { standSkier } from "./course.ts";
import { difficultyOf, JUDGING, panelScore, readTrick, type TrickRead } from "./judge.ts";
import type { FlightRecord, GameEvent, GameState } from "./state.ts";

/** ONE HIT OF A SESSION: the trick it was judged on (null for none), when
 * it ended, s of run clock, whether it was a fall, its impression and its
 * kind (`jamKind`, null for none). */
export type JamHit = {
  trick: FlightRecord | null;
  t: number;
  fell: boolean;
  impression: number;
  kind: string | null;
};

/** THE JAM SO FAR: the hits ridden; where the hit under way began in the
 * run's flights; whether it has left the platform yet, and gone down; and
 * whether the session is closed. */
export type JamState = {
  hits: JamHit[];
  from: number;
  left: boolean;
  down: boolean;
  closed: boolean;
};

/** A ROW OF THE SESSION'S BOARD: the player (`id` −1) or a rival, his hits
 * so far, his falls, and the panel's mark for his session. */
export type JamRow = { id: number; hits: number; falls: number; score: number };

/** How a knuckle hit and a session are marked. */
export const KNUCKLE_JUDGING = {
  /** A press or a butter ridden off the knuckle, steps of difficulty — the
   * judges reward using the knuckle — and a step for each 360 the butter
   * wound on the snow. */
  press: 1.5,
  wound: 1,
  /** A clean hit scores `floor` plus `span` of the `top` steps it reaches —
   * a nose butter 720 or a double flip off a knuckle near the top. */
  floor: 30,
  span: 62,
  top: 9,
  /** The hits a session's impression is the mean of, the points for each
   * DIFFERENT kind of trick among them past the first, and the points off
   * each fall, to `fallsMost`. */
  counting: 3,
  variety: 2,
  fall: 1,
  fallsMost: 5,
  /** Past the platform, m down the line, a ride is a hit. */
  away: 1,
} as const;

/** A new jam, before the first hit. */
export function freshJam(): JamState {
  return { hits: [], from: 0, left: false, down: false, closed: false };
}

/** WHAT KIND OF TRICK a hit was, for the session's variety: the press it
 * came off (or none), and the way it spun or flipped. */
export function jamKind(r: TrickRead): string {
  const way = r.dir ?? r.flipDir ?? "straight";
  return `${r.butter?.end ?? "air"} ${way}${r.flips > 0 ? " flip" : ""}`;
}

/** THE IMPRESSION OF ONE HIT, 0–100: its trick's difficulty — the big air
 * judge's steps (`difficultyOf`) with the press and the butter's winding
 * on top — the landing taken from a clean one's, a sketchy landing capped,
 * a fall low whatever was thrown. */
export function hitImpression(f: FlightRecord, fell: boolean): number {
  const J = JUDGING;
  const K = KNUCKLE_JUDGING;
  const r = readTrick(f);
  const steps = difficultyOf(r) + (r.butter ? K.press + (K.wound * r.butter.wound) / 360 : 0);
  const d = Math.min(1, steps / K.top);
  if (fell || f.outcome === "fell") return J.fall + J.fallSpan * d;
  let score = K.floor + K.span * d;
  score -= J.landing * Math.min(1, f.landing ?? 1);
  if (f.outcome === "sketchy") score = Math.min(J.sketchyMost, score - J.sketchy);
  return Math.max(1, Math.min(99, score));
}

/** THE SESSION'S IMPRESSION off its hits (`KNUCKLE_JUDGING`), 0–100. */
export function sessionImpression(hits: readonly JamHit[]): number {
  const K = KNUCKLE_JUDGING;
  const landed = hits.filter((h) => !h.fell).sort((a, b) => b.impression - a.impression);
  const best = landed.slice(0, K.counting);
  if (best.length === 0) return hits.length > 0 ? 1 : 0;
  const mean = best.reduce((s, h) => s + h.impression, 0) / K.counting;
  const kinds = new Set(best.map((h) => h.kind)).size;
  const falls = Math.min(K.fallsMost, hits.filter((h) => h.fell).length);
  return Math.max(1, Math.min(99, mean + K.variety * (kinds - 1) - K.fall * falls));
}

/** THE PANEL'S MARK for a session: `seed` the run's, `id` the rider's. */
export function sessionScore(seed: number, id: number, hits: readonly JamHit[]): number {
  if (hits.length === 0) return 0;
  return panelScore(sessionImpression(hits), seed, 2000 + id);
}

/** The salt a jam's field is dealt off. */
const FIELD_SALT = 0x6b1c7e;

/** THE DEALT FIELD's knobs: when the first hit comes and the gap between
 * hits, s; how often a hit is a fall, the weakest rider's to the best's;
 * and the impression a landed hit draws. */
export const JAM_FIELD = {
  first: [6, 16],
  gap: [13, 21],
  fallMost: 0.35,
  fallLeast: 0.15,
  floor: 38,
  span: 40,
  wobble: 9,
  kinds: ["nose left", "nose right", "tail left", "tail right", "air back flip", "air front flip"],
} as const;

/** RIVAL `id`'s hits that have ended by `t` s of the jam, dealt. */
export function rivalHits(seed: number, id: number, t: number): JamHit[] {
  const F = JAM_FIELD;
  const base = (seed ^ FIELD_SALT) + id * 7919;
  const level = createRng(base).next();
  const hits: JamHit[] = [];
  const rng = createRng(base + 1);
  let at = rng.range(F.first[0], F.first[1]);
  while (at <= Math.min(t, KNUCKLE_HUCK.jam)) {
    const fell = rng.chance(F.fallMost - (F.fallMost - F.fallLeast) * level);
    const kind = F.kinds[Math.floor(rng.next() * F.kinds.length)];
    const impression = fell
      ? rng.range(6, 15)
      : Math.min(95, F.floor + F.span * level + rng.range(-F.wobble, F.wobble));
    hits.push({ trick: null, t: at, fell, impression, kind });
    at += rng.range(F.gap[0], F.gap[1]);
  }
  return hits;
}

/** THE SESSION'S BOARD at `t` s of the jam — the player's hits and every
 * rival's that have ended by then — best first; a tie keeps the player
 * first. */
export function jamBoard(seed: number, mine: readonly JamHit[], t: number): JamRow[] {
  const row = (id: number, hits: readonly JamHit[]): JamRow => ({
    id,
    hits: hits.length,
    falls: hits.filter((h) => h.fell).length,
    score: sessionScore(seed, id, hits),
  });
  const rows = [row(-1, mine)];
  for (let id = 0; id < KNUCKLE_HUCK.field; id++) rows.push(row(id, rivalHits(seed, id, t)));
  return rows.sort((a, b) => b.score - a.score);
}

/** The player's place on the board at the jam's clock now, 1-based. */
export function jamPlace(state: GameState): number {
  const j = state.jam;
  if (!j) return 0;
  return jamBoard(state.seed, j.hits, state.progress.time).findIndex((r) => r.id === -1) + 1;
}

/** How far down the jump's line the skier stands, m. */
function along(state: GameState): number {
  const p = state.level.track.points[0];
  const c = state.skier;
  return (c.x - p.x) * Math.sin(p.heading) + (c.z - p.z) * Math.cos(p.heading);
}

/** File the hit under way: its longest flight judged. */
function fileHit(state: GameState, j: JamState, fell: boolean, events: GameEvent[]): void {
  const f = jumpOf(state.tricks.flights.slice(j.from));
  const down = fell || f?.outcome === "fell";
  j.hits.push({
    trick: f,
    t: state.progress.time,
    fell: down,
    impression: f ? hitImpression(f, down) : 0,
    kind: f && !down ? jamKind(readTrick(f)) : null,
  });
  events.push({ kind: "jam", t: state.t, hit: j.hits.length, fell: down });
}

/** The next hit begun: the flights so far behind it. */
function nextHit(state: GameState, j: JamState): void {
  j.from = state.tricks.flights.length;
  j.left = false;
  j.down = false;
}

/** One step of the jam, after the tricks have filed this step's flight
 * (`step.ts`). */
export function stepJam(state: GameState, events: GameEvent[]): void {
  const j = state.jam;
  const course = state.level.knuckleHuck;
  if (!j || !course || j.closed) return;
  const c = state.skier;
  // THE BUZZER: a hit already off the knuckle counts.
  if (state.progress.finished) {
    if (j.left && state.tricks.flights.length > j.from) fileHit(state, j, j.down, events);
    j.closed = true;
    return;
  }
  if (state.phase !== "racing") return;
  if (c.thrown !== null) j.down = true;
  const s = along(state);
  // STOOD UP (a fall, a stop, the reset pressed): a hit if he had left.
  if (events.some((e) => e.kind === "reset")) {
    if (j.left) fileHit(state, j, j.down, events);
    nextHit(state, j);
    return;
  }
  if (!j.left && s > course.from + KNUCKLE_JUDGING.away) j.left = true;
  // HOME: over the finish line on his skis, and back up to the platform.
  if (j.left && c.thrown === null && s >= course.to) {
    fileHit(state, j, j.down, events);
    const spawn = state.level.spawn;
    standSkier(state, spawn.x, spawn.z, spawn.heading);
    nextHit(state, j);
  }
}

/** The seconds left on the jam's clock. */
export function jamLeft(state: GameState): number {
  return Math.max(0, state.rules.limit - state.progress.time);
}
