// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R31 — A SLALOM SET OVER A BUILT MAP. The map is the mountain and stays
// it: the ground, the piste, the woods' outline, the day. What a slalom
// sets over it is a COURSE — where on the piste the start hut stands and
// where the finish line is, the pole gates down the stretch between, the
// line a racer takes through them — and the trees the organisers cut for
// the course and its finish arena.
//
// THE STRETCH is found first and is the same for both runs: the steepest
// stretch of the piste that drops the vertical a slalom asks for, wide
// enough, clear of the piste's kickers and drops, with a gentler run-out
// past the line for a finish arena. THE GATES are set second, off a stream
// of the run's own (`SLALOM_SALT`, the run), so the two runs are two
// courses on one hill and neither draws anything from any other stream.
//
// A COURSE IS SET LIKE A COURSE SETTER SETS ONE: the direction changes
// counted off the vertical, a rhythm of open gates with the turning pole
// either side of the line in turn, the hairpins, verticals and delays
// spread down the middle with an easier gate before each, nothing hard
// at the start or the finish, and the last gate fast and aimed at the
// middle of the line.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { DISCIPLINE_RULES } from "./discipline-rules.ts";
import { nearestTrackPoint, trackPointAt } from "./query.ts";
import { startGateArc } from "./spawn.ts";
import type { Checkpoint, Level, SlalomCourse, Spawn, TrackPoint } from "./types.ts";

const S = DISCIPLINE_RULES.slalom;

/** What a run's gate stream is seeded with beside the map's seed. */
const SLALOM_SALT = 0x51a10;

/** The stretch a slalom is set on (R31): the start gate's arc, the finish
 * line's, and the vertical between. */
export type SlalomStretch = { from: number; to: number; vertical: number };

const stretches = new WeakMap<Level, SlalomStretch>();

/** R31 — THE STRETCH: the steepest stretch of the piste that drops the
 * first of `slalom.drops` the piste has, wide enough, clear of its kickers
 * and drops, its finish on a gentler run-out. A pure function of the map,
 * kept per map. */
export function slalomStretch(level: Level): SlalomStretch {
  const known = stretches.get(level);
  if (known) return known;
  const pts = level.track.points;
  const n = pts.length;
  const L = level.track.length;
  const top = startGateArc() + 4;
  const blocked: [number, number][] = [];
  for (const k of level.kickers ?? []) {
    if (!k.onTrack || k.s === undefined) continue;
    blocked.push([k.s - k.ramp - S.kickerClear, k.s + k.landing + S.kickerClear]);
  }
  for (const c of level.cliffs ?? []) {
    if (!c.onTrack || c.s === undefined) continue;
    blocked.push([c.s - c.shelf - S.kickerClear, c.s + c.face + c.landing + S.kickerClear]);
  }
  const step = L / Math.max(1, n - 1);
  const at = (s: number): number => clamp(Math.round(s / step), 0, n - 1);
  let found: SlalomStretch | null = null;
  for (const drop of S.drops) {
    let best = -Infinity;
    for (let b = n - 1; b > 0; b -= 5) {
      const sB = pts[b].s;
      const yB = pts[b].y;
      // Up the piste to where it has dropped enough.
      let a = b;
      while (a > 0 && pts[a].y - yB < drop) a--;
      const sA = pts[a].s;
      if (pts[a].y - yB < drop || sA < top) break;
      // The run-out: gentler past the line, where there is piste to read.
      const end = Math.min(L, sB + S.outrunLength);
      if (end - sB >= S.outrunLength / 2) {
        const fall = (yB - pts[at(end)].y) / (end - sB);
        if (fall > S.outrun) continue;
      }
      let narrow = false;
      for (let i = at(sA - 10); i <= at(sB + 10); i++) {
        if (pts[i].width < S.minWidth) {
          narrow = true;
          break;
        }
      }
      if (narrow) continue;
      if (blocked.some(([lo, hi]) => hi > sA - 20 && lo < sB + S.outrunLength)) continue;
      const vertical = pts[a].y - yB;
      // The steepest, to the top level's gradient; lower down the mountain
      // where two are as steep, nearer the village people walk up from.
      const score = Math.min(vertical / (sB - sA), 0.42) + 0.03 * (sB / L);
      if (score > best) {
        best = score;
        found = { from: sA, to: sB, vertical };
      }
    }
    if (found) break;
  }
  // A piste with no stretch to set one on: its last few hundred metres.
  if (!found) {
    const to = L;
    const from = Math.max(top, L - 600);
    found = {
      from,
      to,
      vertical: trackPointAt(level, from).y - trackPointAt(level, to).y,
    };
  }
  stretches.set(level, found);
  return found;
}

/** One gate as the setter lays it, before it is a checkpoint. */
type Laid =
  | { kind: "open"; s: number; side: number; across: number; width: number }
  | { kind: "closed"; s: number; side: number; at: number; height: number };

/** A combination the setter spreads down the middle. */
type Combo = "hairpin" | "vertical3" | "vertical4" | "delay";

/** How much of the stretch a combination takes down the piste, m, its
 * lead-in and lead-out included, and how many direction changes. */
function comboSize(combo: Combo): { length: number; gates: number } {
  const closed = (S.closed.min + S.closed.max) / 2;
  const gap = (S.gap.min + S.gap.max) / 2;
  const lead = 7 + 7;
  if (combo === "delay") return { length: (S.delayed.min + S.delayed.max) / 2, gates: 1 };
  const k = combo === "hairpin" ? 2 : combo === "vertical3" ? 3 : 4;
  return { length: lead + k * closed + (k - 1) * gap, gates: k };
}

/** The combinations one run carries, in the order they are skied. */
function dealCombos(rng: Rng): Combo[] {
  const out: Combo[] = [];
  const hairpins = rng.int(S.hairpins.min, S.hairpins.max);
  const verticals = rng.int(S.verticals.min, S.verticals.max);
  const delays = rng.int(S.delays.min, S.delays.max);
  for (let i = 0; i < hairpins; i++) out.push("hairpin");
  for (let i = 0; i < verticals; i++) out.push(rng.chance(0.5) ? "vertical3" : "vertical4");
  for (let i = 0; i < delays; i++) out.push("delay");
  // Shuffled, then no two of a kind together where another can go between.
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i] !== out[i - 1]) continue;
    const j = out.findIndex((c, k) => k > i && c !== out[i]);
    if (j > 0) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** R31 — the gates of run `run` down `stretch`, top to bottom: laid at a
 * guessed spacing, then laid again at a spacing corrected by how far the
 * last gate missed its place, until it stands there — every lay off the
 * same stream, so the course is a pure function of the map and the run. */
function layGates(level: Level, stretch: SlalomStretch, run: 1 | 2): Laid[] {
  const seed = (level.seed ^ SLALOM_SALT ^ Math.imul(run, 0x9e3779b1)) >>> 0;
  const first = stretch.from + 9;
  const goal = stretch.to - S.last;
  let spacing = 0;
  let out: Laid[] = [];
  for (let pass = 0; pass < 6; pass++) {
    const laid = layAt(level, stretch, createRng(seed), first, spacing);
    out = laid.gates;
    spacing = laid.spacing;
    const end = out[out.length - 1].s;
    if (Math.abs(end - goal) < 0.25) break;
    spacing = clamp(
      spacing + (goal - end) / Math.max(1, laid.open - 1),
      S.spacing.min * 0.85,
      S.spacing.max * 1.1,
    );
  }
  return out.filter((g) => g.s < stretch.to - 4);
}

/** One lay of the gates from `first` at `spacing` m between open gates (0:
 * the setter's own first guess off the count the vertical asks for). */
function layAt(
  level: Level,
  stretch: SlalomStretch,
  rng: Rng,
  first: number,
  guess: number,
): { gates: Laid[]; open: number; spacing: number } {
  const combos = dealCombos(rng);
  const len = stretch.to - S.last - first;
  // The direction changes the vertical asks for, and the open gates that
  // leaves once the combinations have theirs.
  const share = rng.range(S.changes.min, S.changes.max);
  const asked = Math.round(stretch.vertical * share);
  let comboLength = 0;
  let comboGates = 0;
  for (const c of combos) {
    const size = comboSize(c);
    comboLength += size.length;
    comboGates += size.gates;
  }
  const room = Math.max(40, len - comboLength);
  // The spacing wins where the count and the hill disagree.
  let open = Math.max(2 * S.clean + combos.length + 1, asked - comboGates);
  open = clamp(open, Math.ceil(room / S.spacing.max) + 1, Math.floor(room / S.spacing.min) + 1);
  const spacing = guess > 0 ? guess : room / Math.max(1, open - 1);
  // Where each combination goes: after which open gate, spread evenly down
  // the middle, never within `clean` of either end.
  const slots: number[] = combos.map((_, i) =>
    Math.round(S.clean + ((i + 0.5) * (open - 2 * S.clean)) / combos.length),
  );
  const out: Laid[] = [];
  let side = rng.chance(0.5) ? 1 : -1;
  let s = first;
  const phase = rng.range(0, Math.PI * 2);
  // The rhythm: the turning poles' reach across breathes slowly down the
  // course, a section tight and a section open.
  const reach = (k: number): number =>
    S.across.min +
    (S.across.max - S.across.min) *
      clamp(0.5 + 0.35 * Math.sin(k * 0.45 + phase) + rng.range(-0.15, 0.15), 0, 1);
  let lastTurn = { s: s - spacing, x: -side * 2 };
  for (let k = 0; k < open; k++) {
    const final = k === open - 1;
    const p = trackPointAt(level, s);
    const half = p.width / 2 - S.inside;
    const width = clamp(
      rng.range(S.width.min, S.width.max),
      S.width.min,
      Math.max(S.width.min, half - S.across.min),
    );
    const across = final
      ? S.across.min
      : clamp(reach(k), S.across.min, Math.max(S.across.min, half - width));
    // Turning pole to turning pole within the rule: closer down the piste
    // where the poles stand far apart across it.
    const dx = side * across - lastTurn.x;
    const most = Math.sqrt(Math.max(1, S.turn.max * S.turn.max - dx * dx));
    if (s - lastTurn.s > most) s = lastTurn.s + most;
    out.push({ kind: "open", s, side, across, width });
    lastTurn = { s, x: side * across };
    side = -side;
    if (final) break;
    const slot = slots.indexOf(k);
    if (slot >= 0) {
      const combo = combos[slot];
      if (combo === "delay") {
        // THE DELAY: the next turning pole far on and well across — a turn
        // held long, the rhythm broken.
        const on = rng.range(S.delayed.min, S.delayed.max);
        const q = trackPointAt(level, s + on);
        const w = S.width.min;
        const wide = clamp(
          rng.range(S.delayAcross.min, S.delayAcross.max),
          S.across.min,
          Math.max(S.across.min, q.width / 2 - S.inside - w),
        );
        s += on;
        out.push({ kind: "open", s, side, across: wide, width: w });
        lastTurn = { s, x: side * wide };
        side = -side;
      } else {
        // HAIRPIN or VERTICAL: closed gates in a column down the line.
        const count = combo === "hairpin" ? 2 : combo === "vertical3" ? 3 : 4;
        let top = s + 7;
        let foot = top;
        for (let j = 0; j < count; j++) {
          const height = rng.range(S.closed.min, S.closed.max);
          out.push({ kind: "closed", s: top, side, at: 0, height });
          foot = top + height;
          top = foot + rng.range(S.gap.min, S.gap.max);
          side = -side;
        }
        lastTurn = { s: foot, x: 0 };
        s = foot + 7;
        continue;
      }
    }
    // The next open gate: the rhythm's spacing, breathing a little.
    s += spacing * (1 + 0.08 * Math.sin(k * 1.7 + phase));
  }
  return { gates: out, open, spacing };
}

/** A point of the piste shifted `across` metres to the skier's right. */
function across(p: TrackPoint, by: number): { x: number; z: number } {
  return { x: p.x + Math.cos(p.heading) * by, z: p.z - Math.sin(p.heading) * by };
}

/** R31 — A SLALOM SET OVER `level`: run `run`'s course down the slalom
 * stretch, as a map whose checkpoints are its gates and whose spawn is the
 * start hut. Setting one over a map that already carries a slalom sets it
 * over the map under that one, so a run's other course is set over the
 * same mountain and a slalom is never set twice. */
export function setSlalom(level: Level, run: 1 | 2 = 1): Level {
  const base = level.slalom?.base ?? level;
  const stretch = slalomStretch(base);
  const laid = layGates(base, stretch, run);
  const checkpoints: Checkpoint[] = [];
  const line: { s: number; x: number }[] = [];
  const startAt = trackPointAt(base, stretch.from);
  checkpoints.push({
    x: startAt.x,
    z: startAt.z,
    y: startAt.y,
    heading: startAt.heading,
    width: 2,
    s: stretch.from,
    colour: "red",
  });
  line.push({ s: stretch.from, x: 0 });
  let hairpins = 0;
  let verticals = 0;
  let delays = 0;
  let column = 0;
  for (let i = 0; i < laid.length; i++) {
    const g = laid[i];
    const colour = checkpoints.length % 2 === 0 ? "red" : "blue";
    if (g.kind === "open") {
      const p = trackPointAt(base, g.s);
      const centre = across(p, g.side * (g.across + g.width / 2));
      checkpoints.push({
        x: centre.x,
        z: centre.z,
        y: base.groundAt(centre.x, centre.z),
        heading: p.heading,
        width: g.width,
        s: g.s,
        colour,
        pole: "open",
        turn: g.side > 0 ? -1 : 1,
      });
      // Just outside the turning pole: the racer's body over it, his feet
      // on the gate's side.
      line.push({ s: g.s, x: g.side * (g.across + 0.45) });
      const prev = laid[i - 1];
      if (prev?.kind === "open" && g.s - prev.s > S.delayed.min - 0.5) delays += 1;
      column = 0;
    } else {
      const mid = g.s + g.height / 2;
      const p = trackPointAt(base, mid);
      const centre = across(p, g.at);
      checkpoints.push({
        x: centre.x,
        z: centre.z,
        y: base.groundAt(centre.x, centre.z),
        heading: p.heading + (g.side * Math.PI) / 2,
        width: g.height,
        s: mid,
        colour,
        pole: "closed",
      });
      // Across the middle of it: from the side he comes from at its top to
      // the side he goes to at its foot.
      line.push(
        { s: g.s, x: g.at - g.side * 0.55 },
        { s: g.s + g.height, x: g.at + g.side * 0.55 },
      );
      column += 1;
      const next = laid[i + 1];
      if (next?.kind !== "closed") {
        if (column === 2) hairpins += 1;
        else verticals += 1;
        column = 0;
      }
    }
  }
  const finishAt = trackPointAt(base, stretch.to);
  checkpoints.push({
    x: finishAt.x,
    z: finishAt.z,
    y: finishAt.y,
    heading: finishAt.heading,
    width: Math.max(S.finishWidth, finishAt.width + 6),
    s: stretch.to,
    colour: checkpoints.length % 2 === 0 ? "red" : "blue",
  });
  line.push({ s: stretch.to, x: 0 });
  // THE START HUT: the racer stood just above the wand, facing down.
  const hut = trackPointAt(base, stretch.from - S.stand);
  const spawn: Spawn = { x: hut.x, z: hut.z, heading: startAt.heading };
  const slalom: SlalomCourse = {
    run,
    base,
    from: stretch.from,
    to: stretch.to,
    vertical: stretch.vertical,
    hairpins,
    verticals,
    delays,
    line,
  };
  return {
    ...base,
    checkpoints,
    spawn,
    grid: [spawn],
    trees: clearedTrees(base, stretch),
    slalom,
  };
}

const cleared = new WeakMap<Level, Level["trees"]>();

/** The woods with the course and its finish arena cut out of them (R31). */
function clearedTrees(level: Level, stretch: SlalomStretch): Level["trees"] {
  const known = cleared.get(level);
  if (known) return known;
  const A = S.arena;
  const fin = trackPointAt(level, stretch.to);
  const fx = Math.sin(fin.heading);
  const fz = Math.cos(fin.heading);
  const kept = level.trees.filter((t) => {
    const dx = t.x - fin.x;
    const dz = t.z - fin.z;
    const along = dx * fx + dz * fz;
    const side = dx * fz - dz * fx;
    if (along > -A.before && along < A.past && Math.abs(side) < A.half) return false;
    const hit = nearestTrackPoint(level, t.x, t.z);
    if (hit.s < stretch.from - 20 || hit.s > stretch.to + 10) return true;
    const width = level.track.points[hit.index]?.width ?? 20;
    return hit.distance > width / 2 + S.clear;
  });
  cleared.set(level, kept);
  return kept;
}

/** THE LINE A RACER TAKES down a slalom, `s` metres down the piste: how far
 * right of the piste's centreline, m, and how sharply it bends there, 1/m —
 * a cosine from each of the line's points to the next (`SlalomCourse.line`),
 * so it rounds every turning pole and crosses every closed gate at its
 * middle. Null on a map with no slalom set. */
export function slalomLineAt(
  level: Level,
  s: number,
): { offset: number; curvature: number } | null {
  const line = level.slalom?.line;
  if (!line || line.length < 2) return null;
  let lo = 0;
  let hi = line.length - 1;
  if (s <= line[0].s) return { offset: line[0].x, curvature: 0 };
  if (s >= line[hi].s) return { offset: line[hi].x, curvature: 0 };
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (line[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const a = line[lo];
  const b = line[hi];
  const span = Math.max(0.5, b.s - a.s);
  const t = clamp((s - a.s) / span, 0, 1);
  const w = Math.PI / span;
  return {
    offset: a.x + ((b.x - a.x) * (1 - Math.cos(Math.PI * t))) / 2,
    curvature: Math.abs(((b.x - a.x) * w * w * Math.cos(Math.PI * t)) / 2),
  };
}
