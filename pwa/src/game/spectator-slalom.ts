// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SLALOM'S AUDIENCE, AS A PLAN — where the crowd stands along a slalom
// course (R31, `level.slalom`), laid through `planSpectators`' own dealer
// so it is one plan, one stream and one look with the finish arena's.
// Three-free and DOM-free.
//
// WHERE A SLALOM'S CROWD STANDS, as the organisers' plans and the fans'
// guides describe it:
//
//   * The course is short and NETTED its whole length, the safety nets
//     (`NETS`) along both edges from the start house to past the line, the
//     spectator fence two to four metres behind them. Nobody stands on the
//     course or inside the nets; the crowd is behind the fence, on BOTH
//     sides, the whole way down — every metre of a slalom is a viewpoint,
//     so there is no "inside of the turn" to it.
//   * MOST of them are at the bottom: the finish arena (its grandstands
//     either side of the line and the terraces round the finish circle,
//     `planSpectators`) and the finish slope above it, packed rows deep
//     behind the fence over the last gates and thinning up the hill — the
//     standing sectors line the course for the last hundred metres or two.
//   * Up the course they thin out, thicker the lower they stand (people
//     walk up from the arena; the top is reached on skis), and gather
//     where the racing is best to watch: the COMBINATIONS — a hairpin, a
//     vertical, where the feet flick under a still body — and the STEEPEST
//     PITCH.
//   * THE START is a restricted area: the start house, its officials, the
//     coaches and the next racers, a few who rode up — standing beside and
//     behind the house, never in front of its door, out of which the racer
//     drops onto the course. Below the house the first metres of the
//     course are quiet.
//   * Nobody stands past the finish circle, in the run-out.

import { trackPointAt, type Level } from "@engine";

import type { BankKind, FanDealer } from "./spectator-plan.ts";
import { HOUSE, startHousePlan } from "./start-house-plan.ts";

/** The numbers a slalom's crowd is laid by, m unless said. */
export const SLALOM_FANS = {
  /** THE FINISH SLOPE above the grandstands: this share of the course,
   * between `min` and `max` m of it, `top` rows deep at its top and
   * `deep` at its foot, each place taken at `fill`. */
  slope: { share: 0.32, min: 110, max: 200, top: 2, deep: 8, fill: 0.9 },
  /** The first metres below the start house nobody stands beside. */
  quiet: 30,
  /** ALONG THE COURSE between the quiet top and the finish slope: rows and
   * the share of places taken at its top and its foot, eased in by
   * `curve` so the crowd gathers toward the bottom. Each side is dealt a
   * little more or less of it (`sides`). */
  course: { rows: [1, 4], fill: [0.2, 0.78], curve: 1.6, sides: [0.85, 1.1] },
  /** A COMBINATION (a hairpin, a vertical): rows added within `reach` m of
   * its middle, both sides, and the share added. */
  combo: { rows: 2, reach: 16, fill: 0.12 },
  /** THE STEEPEST PITCH of the course (over `span` m): a row added within
   * `reach` m of its middle. */
  pitch: { rows: 1, reach: 22, span: 40, fill: 0.08 },
  /** THE START: how many stand by the house, beside it (`beside`, m out
   * past the front's edge, and `up`, m up the hill from its front — above
   * where the nets begin, `NETS` — and behind it (`behind`, m past its
   * back, and `across`, m either side). */
  start: { count: 12, beside: [1.2, 6], up: [2.5, 8], behind: [1.5, 8], across: 4 },
} as const;

/** THE CROWD along `level`'s slalom: the start's knot, the course both
 * sides, its combinations and its steepest pitch, and the finish slope —
 * the arena itself is `planSpectators`'. */
export function planSlalomBanks(d: FanDealer): void {
  const { level, rng } = d;
  const sl = level.slalom;
  const finishCp = level.checkpoints[level.checkpoints.length - 1];
  if (!sl || !finishCp) return;
  const C = SLALOM_FANS;
  const finish = finishCp.s;
  const course = finish - sl.from;
  const slopeLen = Math.min(C.slope.max, Math.max(C.slope.min, course * C.slope.share));
  const end = Math.max(sl.from + C.quiet, d.slopeEnd);
  const top = Math.max(sl.from + C.quiet, finish - slopeLen);
  const head = sl.from + C.quiet;

  startKnot(d);

  // THE FINISH SLOPE: rows deep over the last gates, thinning up the hill.
  const slopeRows = (s: number): number => {
    const k = Math.max(0, Math.min(1, (s - top) / Math.max(1, end - top)));
    return Math.round(C.slope.top + (C.slope.deep - C.slope.top) * k * k);
  };
  for (const side of [-1, 1]) d.standing("finish", top, end, side, slopeRows, C.slope.fill);

  // THE COURSE between, both sides: thin at the top, thicker down it, and
  // crowded at the combinations and the steepest pitch.
  const combos = combinations(level);
  const pitch = steepest(level, head, top, C.pitch.span);
  const kindAt = (s: number): BankKind => {
    if (combos.some((c) => Math.abs(c - s) <= C.combo.reach)) return "combo";
    if (pitch !== null && Math.abs(pitch - s) <= C.pitch.reach) return "pitch";
    return "course";
  };
  const ease = (s: number): number =>
    Math.max(0, Math.min(1, (s - head) / Math.max(1, top - head))) ** C.course.curve;
  const rowsAt = (s: number): number => {
    const k = ease(s);
    const kind = kindAt(s);
    const [r0, r1] = C.course.rows;
    return (
      Math.round(r0 + (r1 - r0) * k) +
      (kind === "combo" ? C.combo.rows : kind === "pitch" ? C.pitch.rows : 0)
    );
  };
  const runs = stretches(head, top, kindAt);
  for (const side of [-1, 1]) {
    const share = rng.range(C.course.sides[0], C.course.sides[1]);
    const fillAt = (s: number): number => {
      const [f0, f1] = C.course.fill;
      const kind = kindAt(s);
      const extra = kind === "combo" ? C.combo.fill : kind === "pitch" ? C.pitch.fill : 0;
      return (f0 + (f1 - f0) * ease(s)) * share + extra;
    };
    for (const run of runs) d.standing(run.kind, run.from, run.to, side, rowsAt, fillAt);
  }
}

/** THE START'S KNOT: officials, coaches and the few who rode up, beside
 * the house's front and behind it, facing down the course — never in front
 * of the door. */
function startKnot(d: FanDealer): void {
  const house = startHousePlan(d.level);
  if (!house) return;
  const { rng } = d;
  const K = SLALOM_FANS.start;
  const from = d.fans.length;
  let laid = 0;
  for (let tries = 0; tries < K.count * 5 && laid < K.count; tries++) {
    let along: number;
    let across: number;
    if (rng.chance(0.6)) {
      const side = rng.chance(0.5) ? 1 : -1;
      along = -rng.range(K.up[0], K.up[1]);
      across = side * (HOUSE.front.width / 2 + rng.range(K.beside[0], K.beside[1]));
    } else {
      along = -(HOUSE.depth + rng.range(K.behind[0], K.behind[1]));
      across = rng.range(-K.across, K.across);
    }
    const x = house.x + house.fx * along + house.rx * across;
    const z = house.z + house.fz * along + house.rz * across;
    // Facing down the course, turned a little toward the door.
    const yaw = house.heading - Math.sign(across) * rng.range(0.1, 0.6);
    if (d.put(x, z, yaw, "start", laid)) laid++;
  }
  d.close("start", from);
}

/** The middle of every COMBINATION on the course — a run of closed gates,
 * a hairpin or a vertical — as an arc down the piste. */
export function combinations(level: Level): number[] {
  const out: number[] = [];
  let run: number[] = [];
  for (const cp of level.checkpoints) {
    if (cp.pole === "closed") {
      run.push(cp.s);
      continue;
    }
    if (run.length > 0) out.push(run.reduce((a, b) => a + b, 0) / run.length);
    run = [];
  }
  if (run.length > 0) out.push(run.reduce((a, b) => a + b, 0) / run.length);
  return out;
}

/** The middle of the steepest `span` m of the piste between arcs `from`
 * and `to`, or null where there is no room for one. */
export function steepest(level: Level, from: number, to: number, span: number): number | null {
  let best: number | null = null;
  let grade = -Infinity;
  for (let s = from + span / 2; s <= to - span / 2; s += 4) {
    const a = trackPointAt(level, s - span / 2);
    const b = trackPointAt(level, s + span / 2);
    const g = (a.y - b.y) / span;
    if (g > grade) {
      grade = g;
      best = s;
    }
  }
  return best;
}

/** The stretches of `from`..`to` that are each one kind of bank. */
function stretches(
  from: number,
  to: number,
  kindAt: (s: number) => BankKind,
): { kind: BankKind; from: number; to: number }[] {
  const out: { kind: BankKind; from: number; to: number }[] = [];
  for (let s = from; s < to; s += 2) {
    const kind = kindAt(s);
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.to = Math.min(to, s + 2);
    else out.push({ kind, from: s, to: Math.min(to, s + 2) });
  }
  return out;
}
