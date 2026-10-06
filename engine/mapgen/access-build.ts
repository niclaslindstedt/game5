// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R29 — ACCESS AS BUILT TO: the generator's own reckoning of whether every
// piste of the area it is laying can be skied again without a harder one,
// and whether every lift is reached — read off the PLAN (the runs as
// walked, by their place in the walk; the lifts as planned; which ends lie
// on the valley floor), so the lanes and the drag lifts R29 asks for are
// laid to it. `engine/analysis/access.ts` holds the finished map to the
// same rule off what the level publishes, and shares nothing with this but
// the rule book.
//
// THE GRAPH. A skier is at a lift's bottom station, at its top, in the hub,
// or on a run at some arc down it. A bottom takes him to its top; a top to
// every run that leaves it, every run whose line passes a skate from it
// (where it passes nearest) and every bottom a skate from it; a run, from
// his arc on down it, to every lane that leaves it further down, every
// bottom its line passes a skate from, and its end — the run it merges
// into at the junction, the station a link lane runs to, or the hub, which
// is one place with every valley bottom station in it.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import type { RunKind } from "./types.ts";

type Point = { readonly x: number; readonly z: number };

/** A run as the reckoning reads it: what it is and how hard (a lane is a
 * green, 0), the lift it leaves, its line, where it ends — into a run by
 * its index, at a lift's bottom, or on the floor — and the run it leaves
 * part-way down, by index. */
export type PlanRun = {
  kind: RunKind;
  rank: number;
  from: string;
  points: readonly (Point & {
    readonly s: number;
    readonly heading: number;
    readonly width: number;
  })[];
  length: number;
  into: { run: number; s: number } | null;
  /** The arc on it where it begins closing on the run it merges into; its
   * length where it merges into none. */
  mergeStart: number;
  branch?: { run: number; s: number };
  to?: string;
  /** Whether it ends in the hub. */
  floor: boolean;
};

/** A lift as the reckoning reads it, and whether its bottom stands in the
 * hub. */
export type PlanLift = { id: string; bottom: Point; top: Point; floor: boolean };

/** Every piste's verdict by its index (a lane is always `ok`), why one is
 * not, how far its skier skis on the runs below it before a lift or the
 * hub takes him back to its top (`access.runout`, m; 0 for a lane), and
 * the lifts no skier reaches. */
export type PlanAccess = { ok: boolean[]; why: string[]; home: number[]; orphans: string[] };

/** A way off a run at or below arc `at`: to a bottom station, onto a run,
 * or into the hub. */
type Exit = { at: number; lift?: number; run?: number; s?: number; hub?: true };

/** The arc on a run nearest a point, and how near, m. */
function nearestOn(run: PlanRun, p: Point): { s: number; d: number } {
  let s = 0;
  let d = Infinity;
  for (const q of run.points) {
    const dd = hypot(q.x - p.x, q.z - p.z);
    if (dd < d) {
      d = dd;
      s = q.s;
    }
  }
  return { s, d };
}

/** R29 — reckon the area's access off its plan. */
export function reckonAccess(runs: readonly PlanRun[], lifts: readonly PlanLift[]): PlanAccess {
  const skate = RR.access.skate;
  const liftIndex = new Map(lifts.map((l, i) => [l.id, i]));
  const exits: Exit[][] = runs.map((run) => {
    const out: Exit[] = [];
    lifts.forEach((l, li) => {
      let last = -1;
      for (const p of run.points) if (hypot(p.x - l.bottom.x, p.z - l.bottom.z) < skate) last = p.s;
      if (last >= 0) out.push({ at: last, lift: li });
    });
    if (run.into) out.push({ at: run.length, run: run.into.run, s: run.into.s });
    else if (run.to !== undefined) {
      const li = liftIndex.get(run.to);
      if (li !== undefined) out.push({ at: run.length, lift: li });
    } else if (run.floor) out.push({ at: run.length, hub: true });
    return out;
  });
  runs.forEach((lane, i) => {
    if (lane.branch) exits[lane.branch.run]?.push({ at: lane.branch.s, run: i, s: 0 });
  });
  const tops = lifts.map((l) => {
    const on: { run: number; s: number }[] = [];
    runs.forEach((r, i) => {
      if (r.from === l.id && !r.branch) on.push({ run: i, s: 0 });
      else {
        const n = nearestOn(r, l.top);
        if (n.d < skate) on.push({ run: i, s: n.s });
      }
    });
    const bottoms = lifts.flatMap((b, bi) =>
      hypot(b.bottom.x - l.top.x, b.bottom.z - l.top.z) < skate ? [bi] : [],
    );
    return { on, bottoms };
  });
  const hub = lifts.flatMap((l, i) => (l.floor ? [i] : []));

  /** The lifts a skier rides from `starts` — runs, the hub, lifts'
   * bottom stations — skiing only runs `may` lets him; the arc he first
   * comes onto each run at; and whether a lift's top put him back on run
   * `home` within a skate of its start. */
  const reach = (
    starts: readonly Exit[],
    may: (r: number) => boolean,
    home = -1,
  ): { ridden: Set<number>; best: Float64Array; back: boolean } => {
    const best = new Float64Array(runs.length).fill(Infinity);
    const ridden = new Set<number>();
    const queue: Exit[] = [...starts];
    let hubbed = false;
    let back = false;
    while (queue.length > 0) {
      const e = queue.pop() as Exit;
      if (e.hub) {
        if (hubbed) continue;
        hubbed = true;
        for (const li of hub) queue.push({ at: 0, lift: li });
      } else if (e.lift !== undefined) {
        if (ridden.has(e.lift)) continue;
        ridden.add(e.lift);
        const top = tops[e.lift];
        for (const o of top.on) {
          if (o.run === home && o.s <= skate) back = true;
          if (may(o.run)) queue.push({ at: 0, run: o.run, s: o.s });
        }
        for (const b of top.bottoms) queue.push({ at: 0, lift: b });
      } else if (e.run !== undefined) {
        const s = e.s ?? 0;
        if (!may(e.run) || s >= best[e.run]) continue;
        best[e.run] = s;
        for (const x of exits[e.run]) if (x.at >= s - 1e-6) queue.push(x);
      }
    }
    return { ridden, best, back };
  };

  /** How far a skier off piste `i` skis on the runs below it — no harder
   * than it, and its own line free — all the way back to its start, m:
   * lifts, the hub and its own line cost nothing. Infinity where nothing
   * brings him back. */
  const homeOf = (i: number): number => {
    const may = (r: number): boolean => runs[r].rank <= runs[i].rank;
    const open: { e: Exit; c: number }[] = [{ e: { at: 0, run: i, s: 0 }, c: 0 }];
    // Every way onto a run already taken: one higher up it for less is as
    // good as any after it.
    const seen: { s: number; c: number }[][] = runs.map(() => []);
    const rode = new Set<number>();
    let hubbed = false;
    while (open.length > 0) {
      open.sort((x, y) => y.c - x.c);
      const { e, c } = open.pop() as { e: Exit; c: number };
      if (e.hub) {
        if (hubbed) continue;
        hubbed = true;
        for (const li of hub) open.push({ e: { at: 0, lift: li }, c });
      } else if (e.lift !== undefined) {
        if (rode.has(e.lift)) continue;
        rode.add(e.lift);
        const top = tops[e.lift];
        for (const o of top.on) {
          if (o.run === i && o.s <= skate) return c;
          if (may(o.run)) open.push({ e: { at: 0, run: o.run, s: o.s }, c });
        }
        for (const bi of top.bottoms) open.push({ e: { at: 0, lift: bi }, c });
      } else if (e.run !== undefined && may(e.run)) {
        const s = e.s ?? 0;
        if (seen[e.run].some((v) => v.s <= s && v.c <= c)) continue;
        seen[e.run].push({ s, c });
        for (const x of exits[e.run]) {
          if (x.at >= s - 1e-6) open.push({ e: x, c: c + (e.run === i ? 0 : x.at - s) });
        }
      }
    }
    return Infinity;
  };

  const everyTop: Exit[] = lifts.map((_, li) => ({ at: 0, lift: li }));
  const ok: boolean[] = [];
  const why: string[] = [];
  const home: number[] = [];
  runs.forEach((run, i) => {
    if (run.kind !== "piste") {
      ok.push(true);
      why.push("");
      home.push(0);
      return;
    }
    const may = (r: number): boolean => runs[r].rank <= run.rank;
    // THE WAY IN: from some lift's top, onto it within a skate of its start.
    if (reach(everyTop, may).best[i] > skate) {
      ok.push(false);
      why.push("the way in: no lift's top reaches its start without a harder run");
      home.push(Infinity);
      return;
    }
    // THE WAY OUT AND BACK: down it, on from its foot, and up to it again.
    if (reach([{ at: 0, run: i, s: 0 }], may, i).back) {
      ok.push(true);
      why.push("");
      // The way home is measured off a lift whose bottom stands up the
      // mountain: off one in the hub, skiing down to it is the way back.
      const own = liftIndex.get(run.from);
      home.push(own === undefined || lifts[own].floor ? 0 : homeOf(i));
      return;
    }
    const any = reach([{ at: 0, run: i, s: 0 }], () => true, i).back;
    ok.push(false);
    home.push(Infinity);
    why.push(
      any
        ? "the way out and back: only down a harder run"
        : "the way out and back: no lift or lane brings it back",
    );
  });
  const from = reach([{ at: 0, hub: true }], () => true);
  const orphans = lifts.flatMap((l, li) => (from.ridden.has(li) ? [] : [l.id]));
  return { ok, why, home, orphans };
}
