// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI-CROSS HEAT (R35) — four racers on the course at once, skied: the
// player and three of the qualification's start list (`cross-bracket.ts`),
// each a whole run of his own over the same course (`rivals.ts`), behind
// the start gate's doors in the lanes they chose in seed order, let go
// together when the doors drop, and judged by the jury on the way down.
//
// WHO THEY ARE: a rival's pace — the tuck his bot is allowed — is his skill
// on the start list (`field.ts`), his resilience his grit, and his reaction
// to the doors a racer's quick one, all off streams of the heat's own: the
// run's stream deals nothing, so the same heat is the same field every time
// it is raced.
//
// THE START: "skiers ready", then "attention", then the doors drop at a
// moment dealt off the heat's stream 1–4 s later (`SKI_CROSS.release`) — no
// word, no count a racer could anticipate.
//
// ON THE COURSE a racer holds a LANE (`crossLane`): out of the gate his
// door's, closing on the course's line over the start straight, and — when
// a slower racer is close ahead of him in it — the side with the room to
// pass. A pass is set up, not barged through.
//
// THE DRAFT (`stepDrafts`): a racer tucked in close behind a rival has a
// share of his frontal drag taken off, so the one behind pulls up on the
// straights and the pass is on.
//
// CONTACT (`judgeContact`): every shoulder is the shoulder skiers have
// always leaned on each other with (`clipRiders`), and in a heat one hard
// enough puts the racer it lands on DOWN; a racer who knocks down the one
// ahead of him FROM BEHIND is shown the red card — disqualified, the rule's
// intentional interference that changed another racer's result. Contact
// from the side is the race.
//
// THE RESULT (`heatResult`): the heat's racers in their finishing order by
// the bracket's rule (`placeOrder`) — a racer still on the course ranked by
// how far down it he is, which is where he will finish behind the ones
// already home.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { nearestTrackPoint } from "../mapgen/index.ts";
import type { TrackHit } from "../mapgen/types.ts";
import {
  CROSS_ROUNDS,
  placeOrder,
  type CrossHeat,
  type CrossPlace,
  type CrossResult,
} from "./cross-bracket.ts";
import { crashLimit, throwRider } from "./crash.ts";
import { laneAcross, outRun, standSkier } from "./course.ts";
import { RACE, SKI_CROSS } from "./defs/modes.ts";
import { skisById } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { startList } from "./field.ts";
import { gridSlot, raceProgress, rivalRun } from "./rivals.ts";
import type { GameEvent, GameState, Rival } from "./state.ts";

/** What a heat's draws are seeded with beside the race's seed. */
const HEAT_SALT = 0x5c4e47;

/** A HEAT'S RACERS AS SKIED. */
export const CROSS_HEAT = {
  /** The tuck a rival's bot is allowed: his skill on the start list
   * between these — a heat is four of the best sixteen, close. */
  pace: { min: 0.88, max: 1 },
  /** His reaction to the doors, s: a ski-cross racer's out of the gate is
   * the sharpest start in the sport. */
  react: { min: 0.12, max: 0.3 },
  /** THE LANE: how far over the start straight a racer closes from his
   * door onto the course's line, m; how far ahead a slower racer in his
   * lane makes him look for the pass, m, and how near across, m; how far
   * to the side he pulls out to pass, m; and how fast he moves across onto
   * a new lane, m a metre down the course. */
  merge: 60,
  look: 9,
  blocked: 1.4,
  pass: 2.6,
  drift: 0.08,
  /** THE CONTACT: the share of the shoulder a trunk throws him at
   * (`crash.treeShoulder`) a rival's throws him at — a racer on an edge in
   * a pack is far less steady than one meeting a trunk square — and the
   * closing speed, m/s, from behind past which the jury shows the card
   * for the knock-down — and how much more the racer behind takes before
   * he goes down himself, braced for the blow he is driving. */
  floors: 0.38,
  card: 1.5,
  braced: 1.6,
  /** THE DRAFT: the most of a racer's frontal drag a rival ahead of him
   * takes off, tucked in right behind him (`close` m), fading to none
   * `reach` m back or `width` m to the side (est. — a racer in another's
   * slipstream pulls up on him on every straight). */
  draft: { most: 0.3, close: 1, reach: 6, width: 1.2 },
} as const;

/** THE HEAT'S START SEQUENCE, s: "skiers ready", "attention" `ready` s
 * later, and the doors dropping at a moment dealt off the heat's stream. */
export function crossCountdown(seed: number, heat: CrossHeat): number {
  const rng = heatRng(seed, heat);
  return SKI_CROSS.ready + rng.range(SKI_CROSS.release.min, SKI_CROSS.release.max);
}

function heatRng(seed: number, heat: CrossHeat) {
  return createRng(
    (seed ^
      HEAT_SALT ^
      Math.imul(CROSS_ROUNDS.indexOf(heat.round) + 1, 0x27d4eb2d) ^
      Math.imul(heat.index + 1, 0x165667b1)) >>>
      0,
  );
}

/** STAND THE HEAT: the player behind the door his seed chose, and each of
 * the three others behind his own, his pace, his grit and his reaction
 * his. Called once, from `createGame`. */
export function createHeat(state: GameState, heat: CrossHeat): void {
  state.cross = heat;
  const me = Math.max(
    0,
    heat.racers.findIndex((e) => e.id === null),
  );
  const mine = gridSlot(state, me);
  standSkier(state, mine.x, mine.z, mine.heading);
  const skills = startList(state.seed, SKI_CROSS.field);
  // The countdown's stream first, so the doors drop at the same moment
  // whatever the field does with its own draws.
  const rng = heatRng(state.seed, heat);
  rng.next();
  const spec = skisById(SKI_CROSS.skis);
  const out: Rival[] = [];
  heat.racers.forEach((entry, lane) => {
    if (entry.id === null) return;
    const racer = skills[entry.id];
    const skill = racer?.skill ?? 0.5;
    const grit = racer?.grit ?? 0.5;
    const P = CROSS_HEAT.pace;
    const pace = P.min + (P.max - P.min) * skill;
    const resilience =
      RACE.resilienceBand.min + (RACE.resilienceBand.max - RACE.resilienceBand.min) * grit;
    const spot = gridSlot(state, lane);
    const run = rivalRun(state, spec, spot, rng.range(0, 2), resilience);
    run.cross = heat;
    out.push({
      id: entry.id,
      run,
      pace,
      resilience,
      react: rng.range(CROSS_HEAT.react.min, CROSS_HEAT.react.max),
      lane: laneAcross(state.level, spot.x, spot.z),
    });
  });
  state.rivals = out;
}

const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
const held = new WeakMap<Rival, number>();

/** THE LANE A RIVAL HOLDS NOW, m right of the course's line: his door's,
 * closed onto the line over the start straight — and, with a slower racer
 * close ahead of him in it, the side with the room to pass him. Moved
 * across a little a step (`CROSS_HEAT.drift` a metre down the course),
 * never jumped. */
export function crossLane(state: GameState, rival: Rival): number {
  const run = rival.run;
  const c = run.skier;
  const level = run.level;
  const H = CROSS_HEAT;
  const was = held.get(rival) ?? rival.lane;
  if (run.phase !== "racing") return was;
  nearestTrackPoint(level, c.x, c.z, hit);
  const s = hit.s;
  const lateral = hit.lateral;
  const start = level.skiCross?.from ?? 0;
  let target = rival.lane * (1 - clamp((s - start) / H.merge, 0, 1));
  // A slower racer close ahead in his lane: out to the side with room.
  const others = [state.skier, ...state.rivals.filter((r) => r !== rival).map((r) => r.run.skier)];
  for (const o of others) {
    if (o.thrown) continue;
    nearestTrackPoint(level, o.x, o.z, hit);
    const ahead = hit.s - s;
    if (ahead <= 0 || ahead > H.look) continue;
    if (Math.abs(hit.lateral - lateral) > H.blocked) continue;
    if (o.speed > c.speed + 0.5) continue;
    const half = (level.track.points[hit.index]?.width ?? 14) / 2;
    target = hit.lateral + (half - hit.lateral >= hit.lateral + half ? H.pass : -H.pass);
    break;
  }
  const most = H.drift * Math.max(1, c.speed) * TUNING.dt;
  const next = was + clamp(target - was, -most, most);
  held.set(rival, next);
  return next;
}

const at: { s: number; lateral: number }[] = [];

/** THE DRAFT this step: every racer of the heat tucked in close behind a
 * rival on the snow ahead of him has that share of his frontal drag taken
 * off (`SkierState.draft`, read by `air.ts`). */
export function stepDrafts(state: GameState): void {
  const D = CROSS_HEAT.draft;
  const racers = [state.skier, ...state.rivals.map((r) => r.run.skier)];
  at.length = 0;
  for (const c of racers) {
    nearestTrackPoint(state.level, c.x, c.z, hit);
    at.push({ s: hit.s, lateral: hit.lateral });
  }
  for (let i = 0; i < racers.length; i++) {
    let draft = 0;
    for (let j = 0; j < racers.length; j++) {
      const lead = racers[j];
      if (j === i || lead.thrown || lead.airborne) continue;
      const gap = at[j].s - at[i].s;
      if (gap <= 0 || gap > D.reach || Math.abs(at[j].lateral - at[i].lateral) > D.width) continue;
      const near = 1 - Math.max(0, gap - D.close) / (D.reach - D.close);
      draft = Math.max(draft, D.most * near);
    }
    racers[i].draft = draft;
  }
}

/** THE CONTACT between two racers of a heat this step: `closing` m/s along
 * the line between them, `va0` and `vb0` their velocities before the push.
 * The one it lands on hard enough goes down — the racer behind, who saw
 * it coming, braced against it (`CROSS_HEAT.braced`) — and a knock-down
 * from behind is the red card for the racer behind. */
export function judgeContact(
  a: { run: GameState; events: GameEvent[] },
  b: { run: GameState; events: GameEvent[] },
  closing: number,
  va0: { x: number; y: number; z: number },
  vb0: { x: number; y: number; z: number },
): void {
  if (closing <= 0) return;
  const ma = a.run.skier.spec.skierMass;
  const mb = b.run.skier.spec.skierMass;
  // Each one's share of the exchange, a whole closing speed each between
  // two riders of one build.
  const takenA = (2 * closing * mb) / (ma + mb);
  const takenB = (2 * closing * ma) / (ma + mb);
  // Which of them is behind, down the course from where they met.
  const level = a.run.level;
  const sA = nearestTrackPoint(level, a.run.skier.x, a.run.skier.z, hit).s;
  const sB = nearestTrackPoint(level, b.run.skier.x, b.run.skier.z, hit).s;
  const H = CROSS_HEAT;
  const downA = knock(a.run, takenA / (sA < sB ? H.braced : 1), va0, a.events);
  const downB = knock(b.run, takenB / (sB < sA ? H.braced : 1), vb0, b.events);
  if (closing < H.card || downA === downB) return;
  // The one still up, behind the one he put down: the card.
  const [up, sUp, sDown] = downA ? [b, sB, sA] : [a, sA, sB];
  if (sUp >= sDown) return;
  const p = up.run.progress;
  if (p.finished) return;
  outRun(up.run, up.events, { status: "dsq", why: "contact", gate: p.nextCheckpoint });
}

/** Whether a shoulder `taken` m/s hard puts this racer down — and, if it
 * does, throws him. */
function knock(
  run: GameState,
  taken: number,
  v0: { x: number; y: number; z: number },
  events: GameEvent[],
): boolean {
  const c = run.skier;
  if (c.thrown || run.progress.finished) return false;
  if (taken < CROSS_HEAT.floors * crashLimit(c, "treeShoulder")) return false;
  throwRider(run, "skier", v0, events);
  return true;
}

/** THE HEAT AS IT STANDS — finished, when every racer is home or out: its
 * racers in their finishing order, a racer still on the course by how far
 * down it he is. Null on a run that is not a heat. */
export function heatResult(state: GameState): CrossResult | null {
  const heat = state.cross;
  if (!heat) return null;
  const runs: { id: number | null; run: GameState }[] = [
    { id: null, run: state },
    ...state.rivals.map((r) => ({ id: r.id, run: r.run })),
  ];
  const places: (CrossPlace & { along: number })[] = heat.racers.map((entry) => {
    const run = runs.find((r) => r.id === entry.id)?.run ?? state;
    const p = run.progress;
    const home = p.finished && !p.out;
    return {
      entry,
      time: home ? p.time : null,
      out: p.out,
      gates: home ? Infinity : p.passed,
      along: raceProgress(run),
    };
  });
  // Still on the course: ahead of the racers out of it, in the order they
  // are down it.
  const order = placeOrder(
    places.map((p) => (p.out === null && p.time === null ? { ...p, gates: 1e6 + p.along } : p)),
  );
  return { heat, order: order.map(({ entry, time, out, gates }) => ({ entry, time, out, gates })) };
}
