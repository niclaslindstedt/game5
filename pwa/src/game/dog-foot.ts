// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOG WALKERS HANDED TO THE ENGINE — the village's owners and the
// children out with them (`dog-walk.ts`) as the bodies the skier, his body
// thrown, his snowmobile, a piste machine and the traffic meet
// (`engine/game/foot.ts`), handed in with the civilians (`foot-call.ts`).
//
// A walk waits at the kerbs on the traffic and is dealt only as the clock
// comes to it (dealing one is the costly part of the plan), so the engine
// is not handed the walks but WHERE EACH ONE IS on them: a `FootTrack` a
// person, knotted off his walks — a knot at every change of leg (a stop, a
// kerb, a chat, set off again) and wherever the line he walks turns, so
// the owner read in straight lines between them is exactly where
// `dogWalkerAt` draws him (the child, eased round a corner beside the
// owner's line, within a few centimetres), and a gap while the household
// is at home. Out by the hour as the drawing has them (`DOG_HOURS`, each
// household's keenness).
//
// THE TRACKS ARE KNOTTED AHEAD OF THE CLOCK (`walkersAhead`), a minute or
// two at a time, by the one door every host steps a run through
// (`crowd-calls.ts`' `stepRun`): each a prefix of the one way that is a
// pure function of the plan, so whichever run knotted it further, the
// engine reads the same knots, and a replay handed the same call meets the
// same people. DOM-free and three-free.

import type { CrowdBody, FootCall, FootPerson, FootTrack, Level } from "@engine";

import { DOG_HOURS } from "./dog-defs.ts";
import { CHILD_AT, walkerPlace } from "./dog-walk-pose.ts";
import type { LinePoint } from "./dog-walk-route.ts";
import { dogPlanFor, walkOf, type DogPlan, type Walk } from "./dog-walk.ts";

/** THE DOG WALKERS' NUMBERS: how far ahead of the run's clock the tracks
 * are knotted, s, once they run within `again` s of their end; how far
 * round a corner the line's side is eased, m (the line's own,
 * `dog-walk-route.ts`), and the step the child's knots are laid at round
 * one, m; and the key the first walker is met by — past every civilian's
 * index and short of the crews' (`CREW_KEYS`). */
export const DOG_FOOT = { ahead: 120, again: 30, ease: 0.9, round: 0.15, keys: 900_000 } as const;

/** The key member `member` (0 the owner, 1 the child) of household `h` is
 * met by. */
export const walkerKey = (h: number, member: 0 | 1): number => DOG_FOOT.keys + 2 * h + member;

const AT: LinePoint = { x: 0, z: 0, heading: 0 };

/** The arcs round a turn of the line the child's place is knotted at. */
const ROUND = Array.from(
  { length: 2 * Math.round(DOG_FOOT.ease / DOG_FOOT.round) + 1 },
  (_, i) => (i - Math.round(DOG_FOOT.ease / DOG_FOOT.round)) * DOG_FOOT.round,
);

/** The clocks of walk `w` worth a knot for `member`, from `t0` to `t1`:
 * each change of leg and each moment his place on the line passes a turn
 * of it (and, for the child walking beside it, the moments round it its
 * side is eased over). */
function knotsOf(w: Walk, member: 0 | 1, t0: number, t1: number): number[] {
  const out = [t0, t1];
  const ahead = member === 1 ? CHILD_AT.ahead : 0;
  const around = member === 1 ? ROUND : [0];
  const s = w.line.s;
  for (const g of w.legs) {
    if (g.t1 <= t0 || g.t0 >= t1) continue;
    out.push(g.t0, g.t1);
    if (g.s1 === g.s0) continue;
    const lo = Math.min(g.s0, g.s1) + ahead;
    const hi = Math.max(g.s0, g.s1) + ahead;
    for (let k = 1; k < s.length - 1; k++) {
      if (s[k] + DOG_FOOT.ease <= lo || s[k] - DOG_FOOT.ease >= hi) continue;
      for (const d of around) {
        const at = s[k] + d;
        if (at <= lo || at >= hi) continue;
        out.push(g.t0 + ((at - ahead - g.s0) / (g.s1 - g.s0)) * (g.t1 - g.t0));
      }
    }
  }
  return out
    .filter((t) => t >= t0 && t <= t1)
    .sort((a, b) => a - b)
    .filter((t, i, a) => i === 0 || t - a[i - 1] > 1e-6);
}

/** To the centimetre. */
const cm = (v: number): number => Math.round(v * 100) / 100;

/** One walker's track being knotted: his household and place in it, the
 * next of its walks to knot, and the clock it is knotted to. */
type Knotting = {
  track: { t: number[]; xz: number[] };
  h: number;
  member: 0 | 1;
  next: number;
  upTo: number;
};

/** Walker `k`'s track knotted on to the run's clock `until`: every walk
 * that begins before it, whole (a walk is dealt whole). */
function knotTo(plan: DogPlan, k: Knotting, until: number): void {
  const { t, xz } = k.track;
  const gap = (at: number): void => {
    t.push(at);
    xz.push(NaN, NaN);
  };
  for (; ; k.next++) {
    const w = walkOf(plan, k.h, k.next);
    if (w.t0 >= until) break;
    if (w.t1 <= 0) continue;
    const t0 = Math.max(0, w.t0);
    gap(t0);
    for (const at of knotsOf(w, k.member, t0, w.t1)) {
      walkerPlace(plan, k.h, k.member, w, at, AT);
      t.push(at);
      xz.push(cm(AT.x), cm(AT.z));
    }
    gap(w.t1);
    k.upTo = w.t1;
  }
  // Home till the next walk: a gap he is out of to its start.
  const w = walkOf(plan, k.h, k.next);
  if (w.t0 > k.upTo) {
    gap(w.t0);
    k.upTo = w.t0;
  }
}

/** Each call's walkers being knotted, and the plan they walk. */
const knotting = new WeakMap<FootCall, { plan: DogPlan; walkers: Knotting[]; upTo: number }>();

/** EVERY DOG WALKER of `level`'s village (in summer's when `summer`) as
 * the engine meets him, keyed by `walkerKey`, each track knotted to the
 * run's first `DOG_FOOT.ahead` s — and the knotting to carry on from,
 * kept for the call they are handed in with (`walkersFor`). */
export function dogWalkersOf(
  level: Level,
  summer: boolean,
): { people: FootPerson[]; plan: DogPlan | null; walkers: Knotting[] } {
  const plan = dogPlanFor(level, summer);
  if (!plan) return { people: [], plan: null, walkers: [] };
  // The cull's circle: the village's sidewalks, all of them.
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const n of plan.net.nodes) {
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    z0 = Math.min(z0, n.z);
    z1 = Math.max(z1, n.z);
  }
  const rx = (x0 + x1) / 2;
  const rz = (z0 + z1) / 2;
  const rr = Math.hypot(x1 - x0, z1 - z0) / 2 + 3;
  const people: FootPerson[] = [];
  const walkers: Knotting[] = [];
  for (const hh of plan.households) {
    const members: [0 | 1, CrowdBody | null][] = [
      [0, hh.walker],
      [1, hh.child],
    ];
    for (const [member, body] of members) {
      if (!body) continue;
      const k: Knotting = { track: { t: [], xz: [] }, h: hh.id, member, next: 0, upTo: 0 };
      knotTo(plan, k, DOG_FOOT.ahead);
      walkers.push(k);
      const track: FootTrack = k.track;
      people.push({
        key: walkerKey(hh.id, member),
        body,
        x: hh.door.x,
        y: level.groundAt(hh.door.x, hh.door.z),
        z: hh.door.z,
        heading: hh.door.heading,
        track,
        keen: hh.keen,
        hours: DOG_HOURS,
        rx,
        rz,
        rr,
      });
    }
  }
  return { people, plan, walkers };
}

/** The walkers of `call` (`dogWalkersOf`) kept to be knotted on. */
export function walkersFor(call: FootCall, of: ReturnType<typeof dogWalkersOf>): void {
  if (!of.plan || !of.walkers.length) return;
  knotting.set(call, { plan: of.plan, walkers: of.walkers, upTo: DOG_FOOT.ahead });
}

/** THE DOG WALKERS' TRACKS KNOTTED AHEAD of the run's clock `t`: once it
 * runs within `DOG_FOOT.again` s of where they are knotted to, every one
 * on to `DOG_FOOT.ahead` s past it. */
export function walkersAhead(call: FootCall | null | undefined, t: number): void {
  const k = call ? knotting.get(call) : undefined;
  if (!k || t + DOG_FOOT.again < k.upTo) return;
  const until = t + DOG_FOOT.ahead;
  for (const w of k.walkers) if (w.upTo < until) knotTo(k.plan, w, until);
  k.upTo = until;
}
