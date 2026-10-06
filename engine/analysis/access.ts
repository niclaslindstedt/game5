// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R29 — ACCESS HELD: whether the lifts, the lanes and the wind tunnels reach
// the whole mountain and every piste can be skied again without a harder
// one, read off the ski area as the level publishes it — its runs (where
// each starts, ends, merges, branches and runs to), its lifts' two
// stations, its hub and its tunnels — and never off the plan that laid
// them.
//
// THE GRAPH. A skier is at a lift's bottom station, at its top, in the hub,
// at a tunnel's exit, or on a run at some arc down it. A bottom takes him to
// its top (the lift); a top to every run that leaves it, every run whose
// line passes a skate from it (where it passes nearest) and every bottom
// station a skate from it; a run, from his arc on down it, to every lane
// that leaves it further down, every bottom station its line passes a
// skate from, and its end — the run it merges into at the junction, the
// station a link lane runs to, or the hub where it finishes in it; the hub
// to every bottom station in it or a skate from it and every tunnel whose
// entrance is in it; a tunnel to the bottoms a skate from its exit, and the
// hub where it lets him go in it. A piste is REPEATABLE when, skiing it from
// its top and riding only pistes no harder than it (a lane is a green), he
// comes back to its top.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { PisteGrade } from "../mapgen/grades.ts";
import { outsideHub } from "../mapgen/query.ts";
import { RESORT_RULES as RR } from "../mapgen/resort-rules.ts";
import type { Resort, Run } from "../mapgen/types.ts";

/** One piste's verdict: repeatable, or why not — and how far its skier
 * skis on the runs below it before a lift, a tunnel or the hub takes him
 * back to its top, m (`access.runout`; Infinity where nothing does). */
export type RunAccess = { id: string; ok: boolean; why: string; home: number };

/** What R29 finds on a ski area. */
export type AccessReport = {
  /** Every piste's verdict, in the order the runs are published. */
  runs: RunAccess[];
  /** The lifts whose bottom station no skier reaches from the hub. */
  orphans: string[];
};

const RANK: Readonly<Record<PisteGrade, number>> = { green: 0, blue: 1, red: 2, black: 3 };

/** How hard a run is to ski, for R29: a lane is a green. */
function rankOf(run: Run): number {
  return run.kind === "road" ? 0 : RANK[run.grade];
}

/** A place in the graph: a lift's bottom station, the hub, a tunnel's
 * entrance, or a run at an arc. */
type Node = { lift: number } | { hub: true } | { tunnel: number } | { run: number; s: number };

/** A way off a run at or below arc `at`. */
type Exit = { at: number; to: Node };

/** The access graph of a ski area. */
type Graph = {
  runs: readonly Run[];
  /** Per run, every way off it. */
  exits: Exit[][];
  /** Per lift, where its top puts a skier. */
  tops: Node[][];
  /** Where the hub, and each tunnel's exit, puts him. */
  hub: Node[];
  tunnels: Node[][];
};

/** The arc on a run nearest a point, and how near, m. */
function nearestOn(run: Run, x: number, z: number): { s: number; d: number } {
  let s = 0;
  let d = Infinity;
  for (const p of run.points) {
    const dd = hypot(p.x - x, p.z - z);
    if (dd < d) {
      d = dd;
      s = p.s;
    }
  }
  return { s, d };
}

/** Build the graph off what the resort publishes. */
function graphOf(resort: Resort): Graph {
  const skate = RR.access.skate;
  const { runs, lifts } = resort;
  const tunnels = resort.tunnels ?? [];
  const index = new Map(runs.map((r, i) => [r.id, i]));
  const liftIndex = new Map(lifts.map((l, i) => [l.id, i]));
  const inHub = (x: number, z: number): boolean =>
    resort.hub ? outsideHub(resort.hub, x, z) <= skate : false;
  const exits: Exit[][] = runs.map((run) => {
    const out: Exit[] = [];
    lifts.forEach((l, li) => {
      let last = -1;
      for (const p of run.points) if (hypot(p.x - l.bottom.x, p.z - l.bottom.z) < skate) last = p.s;
      if (last >= 0) out.push({ at: last, to: { lift: li } });
    });
    const end = run.points[run.points.length - 1];
    if (run.into) {
      const q = index.get(run.into.run);
      if (q !== undefined) out.push({ at: run.length, to: { run: q, s: run.into.s } });
    } else if (run.to !== undefined) {
      const li = liftIndex.get(run.to);
      if (li !== undefined) out.push({ at: run.length, to: { lift: li } });
    } else if (inHub(end.x, end.z)) {
      out.push({ at: run.length, to: { hub: true } });
    }
    return out;
  });
  // The lanes that leave a run part-way down.
  runs.forEach((lane, i) => {
    if (!lane.branch) return;
    const parent = index.get(lane.branch.run);
    if (parent !== undefined) exits[parent].push({ at: lane.branch.s, to: { run: i, s: 0 } });
  });
  const near = (x: number, z: number): Node[] => [
    ...runs.flatMap((r, i) => {
      const n = nearestOn(r, x, z);
      return n.d < skate ? [{ run: i, s: n.s }] : [];
    }),
    ...lifts.flatMap((b, bi) =>
      hypot(b.bottom.x - x, b.bottom.z - z) < skate ? [{ lift: bi }] : [],
    ),
  ];
  const tops = lifts.map((l): Node[] => [
    ...runs.flatMap((r, i) => (r.from === l.id && !r.branch ? [{ run: i, s: 0 }] : [])),
    ...near(l.top.x, l.top.z),
  ]);
  const hub: Node[] = [
    ...lifts.flatMap((l, i) => (inHub(l.bottom.x, l.bottom.z) ? [{ lift: i }] : [])),
    ...tunnels.flatMap((t, i) => (inHub(t.points[0].x, t.points[0].z) ? [{ tunnel: i }] : [])),
  ];
  const exitsOf = tunnels.map((t): Node[] => {
    const p = t.points[t.points.length - 1];
    return [
      ...lifts.flatMap((b, bi) =>
        hypot(b.bottom.x - p.x, b.bottom.z - p.z) < skate ? [{ lift: bi }] : [],
      ),
      ...(inHub(p.x, p.z) ? [{ hub: true as const }] : []),
    ];
  });
  return { runs, exits, tops, hub, tunnels: exitsOf };
}

/** What a skier reaches from where he starts, skiing only runs `may` lets
 * him: the lifts he rides, the arc he first comes onto each run at, the
 * runs `may` forbids that a run he skied carries him on into, and whether
 * a lift's top put him back on run `home` within a skate of its start. */
type Reach = { lifts: Set<number>; best: Float64Array; blocked: Set<number>; back: boolean };

function reach(g: Graph, starts: readonly Node[], may: (run: number) => boolean, home = -1): Reach {
  const best = new Float64Array(g.runs.length).fill(Infinity);
  const lifts = new Set<number>();
  const tunnels = new Set<number>();
  const blocked = new Set<number>();
  let back = false;
  let hubbed = false;
  const queue: Node[] = [...starts];
  while (queue.length > 0) {
    const n = queue.pop() as Node;
    if ("hub" in n) {
      if (hubbed) continue;
      hubbed = true;
      queue.push(...g.hub);
    } else if ("tunnel" in n) {
      if (tunnels.has(n.tunnel)) continue;
      tunnels.add(n.tunnel);
      queue.push(...g.tunnels[n.tunnel]);
    } else if ("lift" in n) {
      if (lifts.has(n.lift)) continue;
      lifts.add(n.lift);
      for (const t of g.tops[n.lift]) {
        if ("run" in t && t.run === home && t.s <= RR.access.skate) back = true;
        queue.push(t);
      }
    } else if (may(n.run) && n.s < best[n.run]) {
      best[n.run] = n.s;
      for (const e of g.exits[n.run]) {
        if (e.at < n.s - 1e-6) continue;
        // A run that carries him on into a harder one blocks the way.
        if ("run" in e.to && !may(e.to.run)) blocked.add(e.to.run);
        else queue.push(e.to);
      }
    }
  }
  return { lifts, best, blocked, back };
}

/** How far a skier off piste `i` skis on the runs below it — no harder
 * than it, its own line free — all the way back to its start, m: lifts,
 * tunnels and the hub cost nothing. Infinity where nothing brings him back. */
function homeOf(g: Graph, i: number, may: (run: number) => boolean): number {
  const open: { n: Node; c: number }[] = [{ n: { run: i, s: 0 }, c: 0 }];
  const seen: { s: number; c: number }[][] = g.runs.map(() => []);
  const done = new Set<string>();
  while (open.length > 0) {
    open.sort((x, y) => y.c - x.c);
    const { n, c } = open.pop() as { n: Node; c: number };
    if ("run" in n) {
      if (!may(n.run) || seen[n.run].some((v) => v.s <= n.s && v.c <= c)) continue;
      seen[n.run].push({ s: n.s, c });
      for (const e of g.exits[n.run]) {
        if (e.at >= n.s - 1e-6) open.push({ n: e.to, c: c + (n.run === i ? 0 : e.at - n.s) });
      }
      continue;
    }
    const key = JSON.stringify(n);
    if (done.has(key)) continue;
    done.add(key);
    if ("hub" in n) for (const m of g.hub) open.push({ n: m, c });
    else if ("tunnel" in n) for (const m of g.tunnels[n.tunnel]) open.push({ n: m, c });
    else {
      for (const t of g.tops[n.lift]) {
        if ("run" in t && t.run === i && t.s <= RR.access.skate) return c;
        open.push({ n: t, c });
      }
    }
  }
  return Infinity;
}

/** The runs a skier would have had to ski, named for a finding. */
function named(resort: Resort, runs: Set<number>): string {
  const list = [...runs].slice(0, 3).map((r) => {
    const run = resort.runs[r];
    return `run ${run.id} (${run.kind === "road" ? "lane" : run.grade})`;
  });
  return list.join(", ");
}

/** R29 — every piste's verdict and the island lifts, off the published
 * ski area. Each piste P holds both halves on runs no harder than it,
 * lanes, tunnels and lifts: THE WAY IN — from some lift's top a skier
 * comes onto P within a skate of its start — and THE WAY OUT AND BACK —
 * from P, down it and on from its foot, a lift's top puts him back there. */
export function accessOf(resort: Resort): AccessReport {
  const g = graphOf(resort);
  const runs: RunAccess[] = [];
  const everyTop: Node[] = resort.lifts.map((_, i) => ({ lift: i }));
  resort.runs.forEach((run, i) => {
    if (run.kind !== "piste") return;
    const rank = rankOf(run);
    const may = (r: number): boolean => rankOf(resort.runs[r]) <= rank;
    const inn = reach(g, everyTop, may);
    if (inn.best[i] > RR.access.skate) {
      const why = inn.blocked.size > 0 ? ` without skiing ${named(resort, inn.blocked)}` : "";
      runs.push({
        id: run.id,
        ok: false,
        why: `the way in: no lift's top reaches its start${why}`,
        home: Infinity,
      });
      return;
    }
    const out = reach(g, [{ run: i, s: 0 }], may, i);
    if (out.back) {
      // The way home is measured off a lift whose bottom stands up the
      // mountain: off one in the hub, skiing down to it is the way back.
      const own = resort.lifts.find((l) => l.id === run.from);
      const up =
        own &&
        !(resort.hub && outsideHub(resort.hub, own.bottom.x, own.bottom.z) <= RR.access.skate);
      runs.push({ id: run.id, ok: true, why: "", home: up ? homeOf(g, i, may) : 0 });
      return;
    }
    const why =
      out.blocked.size > 0
        ? `the way out and back: from its foot only down ${named(resort, out.blocked)}, harder than it`
        : "the way out and back: no lift, lane or tunnel from its foot brings a skier back to its start";
    runs.push({ id: run.id, ok: false, why, home: Infinity });
  });
  // The lifts every skier can come to from the hub.
  const reached = reach(g, [{ hub: true }], () => true);
  const orphans = resort.lifts.flatMap((l, i) => (reached.lifts.has(i) ? [] : [l.id]));
  return { runs, orphans };
}

/** R29 — `accessOf` the level's ski area; an empty report on a map with
 * none. */
export function accessReport(level: { resort?: Resort }): AccessReport {
  return level.resort ? accessOf(level.resort) : { runs: [], orphans: [] };
}
