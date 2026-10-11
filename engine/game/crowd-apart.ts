// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// STOOD APART — the crowd's room kept when nobody is moving. Skiing, an
// amateur gives the one ahead a berth (`crowd.ts`'s room); stopped, he
// stands where his brake left him, and two who stop on one spot — a group
// pulling up together, riders off one lift's top strapping in where the
// last carrier's riders still sit — stood inside one another. Here a body
// stood still on his run that overlaps another stood still SHUFFLES ASIDE,
// across the hill and away from him, at a walking side-step until there is
// a gap between them, as people stood on a slope do.
//
// A body stood with his board or his skis across the hill reaches the
// plank's half-length either side of him (`CROWD.apart.across`); a sat
// rider's legs reach further down it (`legs`). Of an overlapping pair the
// one more stood up moves — a sat rider is not shuffled out from under
// another — and of two alike the later dealt. Nothing is drawn from any
// stream: the crowd's own (`CrowdState.rng`) is untouched, and every run
// that has no crowd is the run it always was.

import { CROWD, CROWD_SIZE } from "./defs/crowd.ts";
import { TUNING } from "./defs/tuning.ts";
import type { Amateur } from "./state.ts";

const A = CROWD.apart;

/** Whether `a` is stood still on his run, in a stop. */
const stood = (a: Amateur): boolean => a.mode === "stop" && a.speed < CROWD.crawl.speed;

/** How far across the hill he reaches either side of his middle, m. */
function acrossOf(a: Amateur): number {
  const r = CROWD_SIZE[a.body].radius;
  return a.board !== null || a.across > 0.5 ? Math.max(r, A.across) : r;
}

/** How far up and down the hill he reaches from his middle, m: up, and
 * down (a sat rider's legs out ahead of him). */
function alongOf(a: Amateur): { up: number; down: number } {
  const r = CROWD_SIZE[a.body].radius;
  return { up: r, down: r + A.legs * a.sit };
}

/** SHUFFLE APART the stood bodies on each run (`onRun`, the amateurs on
 * run k), a step's worth; `halfAt(a)` the half-width of a's run where he
 * stands, m — nobody shuffles off its side. */
export function standApart(
  onRun: readonly (readonly Amateur[])[],
  halfAt: (a: Amateur) => number,
): void {
  const step = A.shuffle * TUNING.dt;
  for (const list of onRun) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!stood(a)) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!stood(b)) continue;
        // Up the hill is −s: whose feet are below whose.
        const ds = b.s - a.s;
        const lower = ds >= 0 ? alongOf(b).up + alongOf(a).down : alongOf(a).up + alongOf(b).down;
        if (Math.abs(ds) >= lower + A.gap) continue;
        const dd = b.d - a.d;
        const wide = acrossOf(a) + acrossOf(b) + A.gap;
        if (Math.abs(dd) >= wide) continue;
        // The one more stood up moves; of two alike, the later dealt.
        const moveB = b.sit < a.sit || (b.sit === a.sit && b.id > a.id);
        const m = moveB ? b : a;
        const o = moveB ? a : b;
        const half = Math.max(0, halfAt(m) - acrossOf(m));
        // Away from him across the hill — or, with the run's side there,
        // away from him along it.
        const way = m.d > o.d || (m.d === o.d && m.id > o.id) ? 1 : -1;
        const to = m.d + way * Math.min(step, wide - Math.abs(dd));
        if (Math.abs(to) <= half) m.d = to;
        else m.s = Math.max(0, m.s + (m.s > o.s || (m.s === o.s && m.id > o.id) ? 1 : -1) * step);
      }
    }
  }
}
