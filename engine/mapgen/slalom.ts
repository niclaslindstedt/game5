// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R31 — A SLALOM SET OVER A BUILT MAP. The map is the mountain and stays
// it: the ground, the piste, the woods' outline, the day. What a slalom
// sets over it is a COURSE — where on the piste the start hut stands and
// where the finish line is, the pole gates down the stretch between, the
// line a racer takes through them — and what the organisers prepare for
// it: the piste's kickers on the stretch levelled away, the course groomed
// hard over any drift, and the trees cut for the course and its finish
// arena.
//
// THE STRETCH is found first and is the same for both runs: the steepest
// stretch of the piste that drops the vertical a slalom asks for, wide
// enough, clear of the piste's drops (a cliff is not levelled), with a
// gentler run-out past the line for a finish arena. THE GATES are set second, off a stream
// of the run's own (`SLALOM_SALT`, the run), so the two runs are two
// courses on one hill and neither draws anything from any other stream.
//
// A COURSE IS SET LIKE A COURSE SETTER SETS ONE: the direction changes
// counted off the vertical, a rhythm of open gates with the turning pole
// either side of the line in turn, the hairpins, verticals and delays
// spread down the middle with an easier gate before each, nothing hard
// at the start or the finish, and the last gate fast and aimed at the
// middle of the line.

import {
  sampleField,
  sampleFieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { clamp, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { DISCIPLINE_RULES } from "./discipline-rules.ts";
import { kickerProfile } from "./kickers.ts";
import { LEVEL_RULES } from "./rules.ts";
import { nearestTrackPoint, trackPointAt } from "./query.ts";
import { startGateArc } from "./spawn.ts";
import type { Checkpoint, Kicker, Level, SlalomCourse, Spawn, TrackPoint, Vec3 } from "./types.ts";

const S = DISCIPLINE_RULES.slalom;

/** THE LINE A RACER TAKES, m: his body this far outside an open gate's
 * turning pole as he passes it — over it, near enough, his feet carried
 * further out by the turn — and this far either side of a closed gate's
 * poles from its top to its foot. */
const LINE = { outside: 0.6, across: 0.5 };

/** How far down the piste a combination stands from the open gates either
 * side of it, m. */
const LEAD = 8;

/** What a run's gate stream is seeded with beside the map's seed. */
const SLALOM_SALT = 0x51a10;

/** The stretch a slalom is set on (R31): the start gate's arc, the finish
 * line's, and the vertical between. */
export type SlalomStretch = { from: number; to: number; vertical: number };

const stretches = new WeakMap<Level, SlalomStretch>();

/** R31 — THE STRETCH: the steepest stretch of the piste that drops the
 * first of `slalom.drops` the piste has, wide enough, clear of its drops,
 * its finish on a gentler run-out. A pure function of the map, kept per
 * map. */
export function slalomStretch(level: Level): SlalomStretch {
  const known = stretches.get(level);
  if (known) return known;
  const pts = level.track.points;
  const n = pts.length;
  const L = level.track.length;
  const top = startGateArc() + 4;
  const blocked: [number, number][] = [];
  for (const c of level.cliffs ?? []) {
    if (!c.onTrack || c.s === undefined) continue;
    blocked.push([c.s - c.shelf - S.clearance, c.s + c.face + c.landing + S.clearance]);
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
      if (sB - sA > S.maxLength) continue;
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
  | { kind: "open"; s: number; side: number; across: number; width: number; delay?: boolean }
  | { kind: "closed"; s: number; side: number; at: number; height: number };

/** A combination the setter spreads down the middle. */
type Combo = "hairpin" | "vertical3" | "vertical4" | "delay";

/** How much of the stretch a combination takes down the piste, m, its
 * lead-in and lead-out included, and how many direction changes. */
function comboSize(combo: Combo): { length: number; gates: number } {
  const closed = (S.closed.min + S.closed.max) / 2;
  const gap = (S.gap.min + S.gap.max) / 2;
  const lead = 2 * LEAD;
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
  let extra = 0;
  let out: Laid[] = [];
  for (let pass = 0; pass < 16; pass++) {
    const laid = layAt(level, stretch, createRng(seed), first, spacing, extra);
    out = laid.gates;
    const end = out[out.length - 1].s;
    if (Math.abs(end - goal) < 0.25) break;
    const next = laid.spacing + (goal - end) / Math.max(1, laid.open - 1);
    // A spacing the rule cannot give is a gate more, or one fewer.
    if (next > S.spacing.max) {
      extra += 1;
      spacing = 0;
    } else if (next < S.spacing.min) {
      extra -= 1;
      spacing = 0;
    } else {
      spacing = next;
    }
  }
  return out.filter((g) => g.s < stretch.to - 4);
}

/** One lay of the gates from `first` at `guess` m between open gates (0:
 * the setter's own first guess off the count the vertical asks for), with
 * `extra` open gates over that count. */
function layAt(
  level: Level,
  stretch: SlalomStretch,
  rng: Rng,
  first: number,
  guess: number,
  extra: number,
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
  // (The spacing's top is what the turning poles' rule lets an open gate
  // keep with its poles a full reach apart across the hill.)
  const widest = Math.sqrt(S.turn.max ** 2 - (2 * S.across.max) ** 2);
  const most = Math.min(S.spacing.max, widest);
  open = clamp(open, Math.ceil(room / most) + 1, Math.floor(room / S.spacing.min) + 1) + extra;
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
        out.push({ kind: "open", s, side, across: wide, width: w, delay: true });
        lastTurn = { s, x: side * wide };
        side = -side;
      } else {
        // HAIRPIN or VERTICAL: closed gates in a column down the line.
        const count = combo === "hairpin" ? 2 : combo === "vertical3" ? 3 : 4;
        let top = s + LEAD;
        let foot = top;
        for (let j = 0; j < count; j++) {
          const height = rng.range(S.closed.min, S.closed.max);
          out.push({ kind: "closed", s: top, side, at: 0, height });
          foot = top + height;
          top = foot + rng.range(S.gap.min, S.gap.max);
          side = -side;
        }
        lastTurn = { s: foot, x: 0 };
        s = foot + LEAD;
        continue;
      }
    }
    // The next open gate: the rhythm's spacing, breathing a little.
    s += spacing * (1 + 0.08 * Math.sin(k * 1.7 + phase));
  }
  return { gates: out, open, spacing };
}

/** THE LINE KEPT TO A SKI'S CARVE (R31): where two open gates' racing
 * points would ask the line between them to bend tighter than
 * `slalom.bend`, both turning poles are drawn in toward the course's line
 * by the same share, no nearer it than leaves the line `LINE.outside` plus
 * a fifth of a metre across. A closed gate's line is its own. */
function fitBends(laid: Laid[]): Laid[] {
  const floor = 0.2;
  const pointOf = (g: Laid): number => (g.kind === "open" ? g.across + LINE.outside : LINE.across);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i + 1 < laid.length; i++) {
      const a = laid[i];
      const b = laid[i + 1];
      const span = b.s - (a.kind === "closed" ? a.s + a.height : a.s);
      const room = (2 * span * span) / (Math.PI * Math.PI * S.bend);
      const swing = pointOf(a) + pointOf(b);
      if (swing <= room) continue;
      const k = room / swing;
      if (a.kind === "open") a.across = Math.max(floor, a.across * k);
      if (b.kind === "open") b.across = Math.max(floor, b.across * k);
    }
  }
  return laid;
}

/** A point of the piste shifted `across` metres to the skier's right. */
function across(p: TrackPoint, by: number): { x: number; z: number } {
  return { x: p.x + Math.cos(p.heading) * by, z: p.z - Math.sin(p.heading) * by };
}

/** A cut down into the snow along the piste: how deep, m, `u` m down it
 * from `at`, between `from` and `to`, its banks `ease` m wide either side. */
type Cut = { at: number; from: number; to: number; ease: number; depth: (u: number) => number };

/** R31 — THE START DROP below `stretch`'s wand (`slalom.drop`): as deep as
 * steepens its first metres to the rule's grade, or null where the hill
 * is already that steep. */
function startDrop(level: Level, stretch: SlalomStretch): Cut | null {
  const D = S.drop;
  const top = trackPointAt(level, stretch.from + D.lip).y;
  const low = trackPointAt(level, stretch.from + D.lip + D.length).y;
  const natural = (top - low) / D.length;
  // A smoothstep's steepest is 1.5 times its mean.
  const deep = Math.min(D.most, (Math.max(0, D.grade - natural) * D.length) / 1.5);
  if (deep < 0.05) return null;
  const knee = D.lip + D.length;
  return {
    at: stretch.from,
    from: D.lip,
    to: knee + D.ease,
    ease: D.shoulder,
    depth: (u) =>
      u < knee
        ? deep * smoothstep(D.lip, knee, u)
        : deep * (1 - smoothstep(knee, knee + D.ease, u)),
  };
}

/** The map with its slalom stretch prepared: every kicker on the piste
 * within `slalom.clearance` of the stretch LEVELLED — its profile taken back
 * out of the piste's line and the ground under it, across the piste and
 * eased out over the shoulders — so a racer meets the hill the piste was
 * graded on rather than a jump; and the START DROP cut out of the door the
 * same way. The rest of the mountain is the map's own.
 * Kept per map, so both runs stand on one prepared hill. */
const prepared = new WeakMap<Level, Level>();
function levelStretch(level: Level, stretch: SlalomStretch): Level {
  const known = prepared.get(level);
  if (known) return known;
  const lo = stretch.from - S.clearance;
  const hi = stretch.to + S.clearance + S.outrunLength;
  const kept: Kicker[] = [];
  const cuts: Cut[] = [];
  for (const k of level.kickers ?? []) {
    const on = k.onTrack && k.s !== undefined && k.s + k.landing > lo && k.s - k.ramp < hi;
    if (!on) kept.push(k);
    else {
      cuts.push({
        at: k.s ?? 0,
        from: -k.ramp,
        to: k.landing,
        ease: 6,
        depth: (u) => kickerProfile(k.height, k.ramp, k.landing, u, k.shape),
      });
    }
  }
  const drop = startDrop(level, stretch);
  if (drop) cuts.push(drop);
  const packed = groomStretch(level, stretch);
  if (cuts.length === 0 && !packed) {
    prepared.set(level, level);
    return level;
  }
  const snow = packed
    ? { packed, packedAt: (x: number, z: number) => sampleField(packed, x, z) }
    : {};
  if (cuts.length === 0) {
    const out: Level = { ...level, ...snow };
    prepared.set(level, out);
    return out;
  }
  const field = level.ground;
  const ground: Heightfield = { ...field, data: new Float32Array(field.data) };
  const points = level.track.points.map((p) => ({ ...p }));
  for (const cut of cuts) {
    for (const p of points) {
      const u = p.s - cut.at;
      if (u > cut.from && u < cut.to) p.y -= cut.depth(u);
    }
    // The ground under it, a cell at a time over the box round its line.
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let s = cut.at + cut.from; s <= cut.at + cut.to; s += 2) {
      const p = trackPointAt(level, s);
      const r = p.width / 2 + cut.ease + 2;
      x0 = Math.min(x0, p.x - r);
      x1 = Math.max(x1, p.x + r);
      z0 = Math.min(z0, p.z - r);
      z1 = Math.max(z1, p.z + r);
    }
    const c0 = clamp(Math.floor((x0 - field.originX) / field.cell), 0, field.cols - 1);
    const c1 = clamp(Math.ceil((x1 - field.originX) / field.cell), 0, field.cols - 1);
    const r0 = clamp(Math.floor((z0 - field.originZ) / field.cell), 0, field.rows - 1);
    const r1 = clamp(Math.ceil((z1 - field.originZ) / field.cell), 0, field.rows - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = field.originX + c * field.cell;
        const z = field.originZ + r * field.cell;
        const hit = nearestTrackPoint(level, x, z);
        const u = hit.s - cut.at;
        if (u <= cut.from || u >= cut.to) continue;
        const half = (level.track.points[hit.index]?.width ?? 0) / 2;
        const weight = 1 - smoothstep(half, half + cut.ease, hit.distance);
        if (weight <= 0) continue;
        ground.data[r * field.cols + c] -= weight * cut.depth(u);
      }
    }
  }
  const scratch = new Float64Array(3);
  const out: Level = {
    ...level,
    ground,
    groundAt: (x, z) => sampleField(ground, x, z),
    normalAt: (x: number, z: number, n: Vec3) => {
      sampleFieldGradient(ground, x, z, scratch);
      const nx = -scratch[1];
      const nz = -scratch[2];
      const inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      n.x = nx * inv;
      n.y = inv;
      n.z = nz * inv;
    },
    track: { ...level.track, points },
    kickers: kept,
    ...snow,
  };
  prepared.set(level, out);
  return out;
}

/** THE COURSE PREPARED HARD: a slalom is raced on a piste groomed and set
 * firm from the start hut to the end of the run-out, whatever drift (R17)
 * the wind laid across it — the packed field (R10) brought back to the
 * groomer's across the piste and its shoulders over that stretch, and the
 * rest of the mountain left as it lies. Null when the map carries no
 * packed field or the course already lies on the groomer. */
function groomStretch(level: Level, stretch: SlalomStretch): Heightfield | null {
  const field = level.packed;
  if (!field) return null;
  const fade = LEVEL_RULES.track.shoulder.packed;
  const lo = stretch.from - S.stand - 4;
  const hi = stretch.to + S.outrunLength;
  let data: Float32Array | null = null;
  // A box at a time down the stretch, so a long course on the skew never
  // walks the whole map's grid.
  const STEP = 16;
  for (let s0 = lo; s0 < hi; s0 += STEP) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let s = s0; s <= Math.min(hi, s0 + STEP); s += 2) {
      const p = trackPointAt(level, s);
      const r = p.width / 2 + fade + 1;
      x0 = Math.min(x0, p.x - r);
      x1 = Math.max(x1, p.x + r);
      z0 = Math.min(z0, p.z - r);
      z1 = Math.max(z1, p.z + r);
    }
    const c0 = clamp(Math.floor((x0 - field.originX) / field.cell), 0, field.cols - 1);
    const c1 = clamp(Math.ceil((x1 - field.originX) / field.cell), 0, field.cols - 1);
    const r0 = clamp(Math.floor((z0 - field.originZ) / field.cell), 0, field.rows - 1);
    const r1 = clamp(Math.ceil((z1 - field.originZ) / field.cell), 0, field.rows - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const hit = nearestTrackPoint(
          level,
          field.originX + c * field.cell,
          field.originZ + r * field.cell,
        );
        if (hit.s < lo || hit.s > hi) continue;
        const half = (level.track.points[hit.index]?.width ?? 0) / 2;
        const firm = 1 - smoothstep(half, half + fade, hit.distance);
        const i = r * field.cols + c;
        if (firm <= (data ?? field.data)[i]) continue;
        data ??= new Float32Array(field.data);
        data[i] = firm;
      }
    }
  }
  return data ? { ...field, data } : null;
}

/** R31 — A SLALOM SET OVER `level`: run `run`'s course down the slalom
 * stretch, as a map whose checkpoints are its gates and whose spawn is the
 * start hut. Setting one over a map that already carries a slalom sets it
 * over the map under that one, so a run's other course is set over the
 * same mountain and a slalom is never set twice. */
export function setSlalom(level: Level, run: 1 | 2 = 1): Level {
  const original = level.slalom?.base ?? level;
  const stretch = slalomStretch(original);
  const base = levelStretch(original, stretch);
  const laid = fitBends(layGates(base, stretch, run));
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
      line.push({ s: g.s, x: g.side * (g.across + LINE.outside) });
      if (g.delay) delays += 1;
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
        { s: g.s, x: g.at - g.side * LINE.across },
        { s: g.s + g.height, x: g.at + g.side * LINE.across },
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
    base: original,
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
  // The box round the course and its arena: a tree outside it is kept
  // without asking where the piste is.
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let s = stretch.from - 20; s <= stretch.to + A.past; s += 4) {
    const p = trackPointAt(level, s);
    const r = Math.max(p.width / 2 + S.clear, A.half) + 4;
    x0 = Math.min(x0, p.x - r);
    x1 = Math.max(x1, p.x + r);
    z0 = Math.min(z0, p.z - r);
    z1 = Math.max(z1, p.z + r);
  }
  const kept = level.trees.filter((t) => {
    if (t.x < x0 || t.x > x1 || t.z < z0 || t.z > z1) return true;
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
 * right of the piste's centreline, m, how sharply it bends there, 1/m, and
 * — for a racer steering along it — its slope across the piste, m/m, and
 * its bend signed, positive to the right: a cosine from each of the line's
 * points to the next (`SlalomCourse.line`), so it rounds every turning pole
 * and crosses every closed gate at its middle. Null on a map with no slalom
 * set. */
export function slalomLineAt(
  level: Level,
  s: number,
): { offset: number; curvature: number; slope: number; bend: number } | null {
  const line = level.slalom?.line;
  if (!line || line.length < 2) return null;
  let lo = 0;
  let hi = line.length - 1;
  if (s <= line[0].s) return { offset: line[0].x, curvature: 0, slope: 0, bend: 0 };
  if (s >= line[hi].s) return { offset: line[hi].x, curvature: 0, slope: 0, bend: 0 };
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
  const bend = ((b.x - a.x) * w * w * Math.cos(Math.PI * t)) / 2;
  return {
    offset: a.x + ((b.x - a.x) * (1 - Math.cos(Math.PI * t))) / 2,
    curvature: Math.abs(bend),
    slope: ((b.x - a.x) * w * Math.sin(Math.PI * t)) / 2,
    bend,
  };
}

/** THE LINE BAKED (`slalomLineAt`) every `LINE_STEP` metres down the course,
 * its offset and its bend's size, for a reader that asks of it many times a
 * step: the bot's model and its speed. Kept per map. */
const LINE_STEP = 0.25;
type LineTable = { from: number; offset: Float32Array; curvature: Float32Array };
const tables = new WeakMap<Level, LineTable | null>();

function lineTable(level: Level): LineTable | null {
  if (tables.has(level)) return tables.get(level) ?? null;
  const line = level.slalom?.line;
  let table: LineTable | null = null;
  if (line && line.length >= 2) {
    const from = line[0].s;
    const n = Math.ceil((line[line.length - 1].s - from) / LINE_STEP) + 1;
    const offset = new Float32Array(n);
    const curvature = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const at = slalomLineAt(level, from + i * LINE_STEP);
      offset[i] = at?.offset ?? 0;
      curvature[i] = at?.curvature ?? 0;
    }
    table = { from, offset, curvature };
  }
  tables.set(level, table);
  return table;
}

/** The racing line's offset and bend `s` metres down the piste, off the
 * baked table (to its quarter metre) — the cheap read of `slalomLineAt`.
 * Null on a map with no slalom set. */
export function slalomLineFast(
  level: Level,
  s: number,
): { offset: number; curvature: number } | null {
  const t = lineTable(level);
  if (!t) return null;
  const i = clamp(Math.round((s - t.from) / LINE_STEP), 0, t.offset.length - 1);
  scratchLine.offset = t.offset[i];
  scratchLine.curvature = t.curvature[i];
  return scratchLine;
}
const scratchLine = { offset: 0, curvature: 0 };
