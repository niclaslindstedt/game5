// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R44 — THE FEATURES LAID DOWN A TRAIL, the way a builder sequences them
// (`docs/bike-park.md` § Sequencing):
//
//   - a BERM through every turn the grade banks (a flow trail all of them,
//     a technical trail some, the race line none);
//   - a FILTER at the entrance: the hardest kind of feature the trail
//     carries within its first metres, where a rider can still turn back;
//   - on each straight, features at the grade's density, each seen from
//     its stopping distance (a straight of `visible` metres before it after
//     a turn), JUMPS in a line of the same size `spacing` apart behind a
//     set-up straight, and a run-out of `runout` times a jump's or a drop's
//     length clear past it — no turn and no other feature in it;
//   - GRADE REVERSALS between them: rollers on a flow trail, dips dug on a
//     red, every `reversal` metres where nothing else stands.
//
// Every size is dealt inside its grade's band off the park's stream.

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { BIKE_PARK_RULES as B, type TrailRule } from "./bike-park-rules.ts";
import type { BikeFeature, BikeFeatureKind, BikePiece, BikeTrailPoint } from "./bike-park-types.ts";
import { DROP, dropApproach, tableParts, type Turn } from "./bike-trail-shape.ts";

const dealt = (rng: Rng, [lo, hi]: readonly [number, number]): number =>
  lo + rng.next() * (hi - lo);

/** The hard kinds, hardest first: what the filter at the entrance asks. */
const HARDEST: readonly BikeFeatureKind[] = ["gap", "stepdown", "drop", "table", "rocks", "roots"];

/** What the features are laid for: the race line lays no berm, no jump
 * line and its finish jump. */
export type FeatureOptions = { race?: boolean; trees?: (x: number, z: number) => boolean };

/** An interval of the trail taken, m: a turn or a feature with the room it
 * keeps clear before (`before`) and past (`after`) it. */
type Busy = { lo: number; hi: number; turn: boolean; clearAfter: number };

/** THE FEATURES of a trail whose stations are `points` and turns `turns`,
 * labelled `id`-<letter><n>. */
export function layFeatures(
  id: string,
  points: readonly BikeTrailPoint[],
  turns: readonly Turn[],
  rule: TrailRule,
  rng: Rng,
  opt: FeatureOptions = {},
): BikeFeature[] {
  const L = points[points.length - 1].s;
  const out: BikeFeature[] = [];
  const busy: Busy[] = [];
  const count: Record<string, number> = {};
  const label = (kind: BikeFeatureKind): string => {
    const letter = LETTER[kind];
    count[letter] = (count[letter] ?? 0) + 1;
    return `${id}-${letter}${count[letter]}`;
  };
  // THE TURNS, bermed or not.
  for (const t of turns) {
    const lo = points[t.from].s;
    const hi = points[t.to].s;
    const deg = (Math.abs(t.angle) * 180) / Math.PI;
    busy.push({ lo: lo - 2, hi: hi + 2, turn: true, clearAfter: 0 });
    if (opt.race || deg < B.berm.turn || !rng.chance(rule.bermShare)) continue;
    out.push({
      id: label("berm"),
      kind: "berm",
      from: lo - 1,
      to: hi + 1,
      height: dealt(rng, rule.berm.height),
      angle: dealt(rng, rule.berm.bank),
      side: t.angle > 0 ? 1 : -1,
      radius: t.radius,
    });
  }
  busy.sort((a, b) => a.lo - b.lo);
  const head = B.head;
  const tail = opt.race ? 0 : B.tail;

  /** The bench's grade at arc s, m/m. */
  const gradeAt = (s: number): number => {
    const i = Math.min(points.length - 11, Math.max(0, Math.round(s)));
    const j = Math.min(points.length - 1, i + 10);
    return (points[i].y - points[j].y) / Math.max(1, points[j].s - points[i].s);
  };
  const stationAt = (s: number): BikeTrailPoint =>
    points[Math.min(points.length - 1, Math.max(0, Math.round(s)))];

  /** Whether [lo, hi] (with `before` clear ahead of it and `after` past it)
   * is free; `afterTurn` the straight it needs after a turn. */
  const free = (lo: number, hi: number, before: number, after: number, afterTurn: number) => {
    if (lo < head || hi + after > L - tail) return false;
    for (const b of busy) {
      if (b.hi + b.clearAfter > lo - before && b.lo < hi + after) return false;
      if (b.turn && b.hi <= lo && lo - b.hi < afterTurn) return false;
    }
    return true;
  };
  const take = (f: BikeFeature, after: number): Busy => {
    out.push(f);
    const b: Busy = { lo: f.from, hi: f.to, turn: false, clearAfter: after };
    busy.push(b);
    busy.sort((x, y) => x.lo - y.lo);
    return b;
  };

  /** A feature of `kind` dealt at arc `s`, or null where the trail has none. */
  const make = (kind: BikeFeatureKind, s: number): { f: BikeFeature; after: number } | null => {
    const half = stationAt(s).width / 2;
    switch (kind) {
      case "table":
      case "gap": {
        const T = rule.table;
        if (!T || (kind === "gap" && !rule.gap)) return null;
        const f: BikeFeature = {
          id: "",
          kind,
          from: s,
          to: s,
          height: dealt(rng, T.height),
          angle: dealt(rng, T.angle),
          land: dealt(rng, T.land),
          length: kind === "gap" && rule.gap ? dealt(rng, rule.gap) : dealt(rng, T.deck),
        };
        const p = tableParts(f);
        f.lip = s + p.ramp;
        f.knuckle = f.lip + p.deck;
        f.to = f.knuckle + p.landing;
        return { f, after: rule.runout * (f.to - f.from) };
      }
      case "drop":
      case "stepdown": {
        if (kind === "stepdown" && !rule.step) return null;
        const band = kind === "drop" ? rule.drop : rule.step;
        if (!band) return null;
        const h = dealt(rng, band);
        const lip = s + dropApproach(h, gradeAt(s));
        const f: BikeFeature = {
          id: "",
          kind,
          from: s,
          to: lip + DROP.face,
          lip,
          height: h,
          ...(kind === "stepdown" ? { angle: dealt(rng, rule.table?.angle ?? [20, 30]) } : {}),
        };
        return { f, after: rule.runout * (3 * h + 2) };
      }
      case "rocks":
      case "roots": {
        const R = kind === "rocks" ? rule.rocks : rule.roots;
        if (!R) return null;
        const len = dealt(rng, R.length);
        const tallest = R.height[1] - rng.next() * (R.height[1] - R.height[0]) * 0.5;
        const pieces =
          kind === "rocks" ? rocksOf(rng, len, half, tallest) : rootsOf(rng, len, half, tallest);
        return {
          f: { id: "", kind, from: s, to: s + len, height: tallest, pieces },
          after: 4,
        };
      }
      default:
        return null;
    }
  };

  const kinds = HARDEST.filter(
    (k) => hasKind(rule, k) && !(opt.race && (k === "table" || k === "gap")),
  );
  const tryAt = (kind: BikeFeatureKind, s: number, before: number, inLine = false): Busy | null => {
    const m = make(kind, s);
    if (!m) return null;
    const seen = kind === "rocks" || kind === "roots" ? rule.visible * 0.5 : rule.visible;
    // A jump inside a line is checked for its run-out as the line's last;
    // the next jump of the line then stands in it.
    if (!free(m.f.from, m.f.to, before, m.after, inLine ? 0 : seen)) return null;
    if (kind === "roots" && opt.trees) {
      const p = stationAt((m.f.from + m.f.to) / 2);
      if (!opt.trees(p.x, p.z)) return null;
    }
    m.f.id = label(kind);
    return take(m.f, m.after);
  };

  // THE FILTER: the hardest kind, early.
  if (kinds.length > 0) {
    const k = kinds[0];
    for (let s = B.filter.from; s <= B.filter.to; s += 2) if (tryAt(k, s, 4)) break;
  }

  // THE FINISH JUMP on the race line: a black's table near its end.
  if (opt.race && rule.table) {
    const f0 = L - B.race.jump;
    for (let s = L - 60; s >= f0; s -= 2) if (tryAtTable(s)) break;
  }
  function tryAtTable(s: number): boolean {
    const m = make("table", s);
    if (!m) return false;
    if (!free(m.f.from, m.f.to, 6, Math.min(m.after, L - m.f.to - 1), rule.setup * 0.5))
      return false;
    m.f.id = label("table");
    take(m.f, m.after);
    return true;
  }

  // THE STRAIGHTS: jump lines and features at the grade's density.
  const gaps = straights(busy, head, L - tail);
  for (const [a, b] of gaps) {
    const len = b - a;
    if (len < 15) continue;
    let s = a;
    // A JUMP LINE on a long straight.
    const T = rule.table;
    if (T && !opt.race && len > rule.setup + 25 && rng.chance(0.55)) {
      const n = Math.round(dealt(rng, T.line));
      let at = a + rule.setup;
      const gap = rule.gap && rng.chance(0.35);
      let prev: Busy | null = null;
      for (let k = 0; k < n; k++) {
        const kind: BikeFeatureKind = gap && k === n - 1 ? "gap" : "table";
        // The line's jumps stand in each other's run-outs: the one before
        // keeps none until the line ends.
        const held = prev ? prev.clearAfter : 0;
        if (prev) prev.clearAfter = 0;
        const b = tryAt(kind, at, 4, k > 0);
        if (!b) {
          if (prev) prev.clearAfter = held;
          break;
        }
        prev = b;
        const last = out[out.length - 1];
        const lip = last.lip ?? last.from;
        at = lip + dealt(rng, T.spacing) - (lip - last.from);
        s = last.to;
      }
    }
    const want = (len * rule.every) / 100;
    let placed = 0;
    for (let tries = 0; tries < 8 && placed < want; tries++) {
      const kind = pickKind(rng, kinds);
      if (!kind) break;
      const at = s + 6 + rng.next() * Math.max(1, b - s - 20);
      if (tryAt(kind, at, 6)) placed++;
    }
  }

  // GRADE REVERSALS: rollers (a flow trail's) or dips (a red's) between.
  const rev = rule.reversal;
  const bump = rule.roller ?? rule.dip;
  if (rev && bump) {
    const kind: BikeFeatureKind = rule.roller ? "roller" : "dip";
    for (const [a, b] of straights(busy, head, L - tail)) {
      let at = a + dealt(rng, rev) * 0.5;
      while (at < b) {
        const len = dealt(rng, bump.length);
        const h = dealt(rng, rule.roller ? rule.roller.height : (rule.dip?.depth ?? [0.2, 0.3]));
        if (at + len > b - 1) break;
        const f: BikeFeature = { id: label(kind), kind, from: at, to: at + len, height: h };
        take(f, 0);
        at += len + dealt(rng, rev) - len * 0.5;
      }
    }
  }
  out.sort((x, y) => x.from - y.from);
  return out;
}

const LETTER: Record<BikeFeatureKind, string> = {
  berm: "B",
  roller: "R",
  dip: "W",
  table: "T",
  gap: "G",
  drop: "D",
  stepdown: "S",
  rocks: "K",
  roots: "O",
};

function hasKind(rule: TrailRule, k: BikeFeatureKind): boolean {
  switch (k) {
    case "gap":
      return rule.gap !== null;
    case "stepdown":
      return rule.step !== null;
    case "table":
      return rule.table !== null;
    case "rocks":
      return rule.rocks !== null;
    case "roots":
      return rule.roots !== null;
    case "drop":
      return rule.drop !== null;
    default:
      return false;
  }
}

/** A kind off the stream, the gentler kinds commoner. */
function pickKind(rng: Rng, kinds: readonly BikeFeatureKind[]): BikeFeatureKind | null {
  const pool = kinds.filter((k) => k !== "gap" && k !== "table");
  if (pool.length === 0) return null;
  const w = pool.map((k) => (k === "rocks" || k === "roots" ? 3 : k === "drop" ? 2 : 1.5));
  let r = rng.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** The free stretches between what is taken, m, inside [lo, hi]. */
function straights(busy: readonly Busy[], lo: number, hi: number): [number, number][] {
  const out: [number, number][] = [];
  let at = lo;
  const sorted = [...busy].sort((a, b) => a.lo - b.lo);
  for (const b of sorted) {
    if (b.lo > at + 2) out.push([at, Math.min(b.lo, hi)]);
    at = Math.max(at, b.hi + b.clearAfter);
    if (at >= hi) break;
  }
  if (at < hi - 2) out.push([at, hi]);
  return out.filter(([a, b]) => b - a > 2);
}

/** A rock garden `len` m long over a tread `half` m either side: rocks a
 * square metre, the tallest `tallest` m, the rest smaller. */
function rocksOf(rng: Rng, len: number, half: number, tallest: number): BikePiece[] {
  const n = Math.max(4, Math.round(len * half * 2 * 0.9));
  const out: BikePiece[] = [];
  for (let k = 0; k < n; k++) {
    const t = k === 0 ? 1 : 0.25 + 0.75 * rng.next() ** 2;
    const h = tallest * t;
    out.push({
      u: 0.6 + rng.next() * (len - 1.2),
      a: (rng.next() * 2 - 1) * half * 0.95,
      r: Math.min(0.7, Math.max(0.18, h * 1.7 + 0.08)),
      h,
    });
  }
  return out;
}

/** A root section: a root every 0.6–1.2 m, across at an angle. */
function rootsOf(rng: Rng, len: number, half: number, tallest: number): BikePiece[] {
  const out: BikePiece[] = [];
  for (let u = 0.5 + rng.next(); u < len - 0.5; u += 0.6 + rng.next() * 0.6) {
    out.push({
      u,
      a: (rng.next() * 2 - 1) * half * 0.3,
      r: 0.04 + rng.next() * 0.06,
      h: tallest * (0.4 + 0.6 * rng.next()),
      ang: (rng.next() * 2 - 1) * 0.7,
      len: half * 2.4 + 0.4,
    });
  }
  return out;
}
