// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R33 — A SUPER-G SET OVER A BUILT MAP. The speed discipline with gates
// that TURN: one run on the downhill's hill from a START LOWERED into the
// super-G's band of vertical, its gates set every fifty metres or so
// alternately either side, so the racer carves long, fast turns between
// them at 80–100 km/h — where a downhill's gates only mark a line. What it
// sets over the map is the downhill's machinery (`speed-course.ts`,
// `course-prep.ts`): the start house over the lowered start, the kickers
// levelled, the snow groomed hard and combed, the crests shaved round for
// a super-G's speed, the trees cut, the A-nets along both edges, the speed
// trap — and its own GATES: two pairs of poles and two panels, red and blue
// in turn, their turning pole on the inside of the turn the line makes
// round it.
//
// THE LINE FIRST, the gates on it. The line that bends the least inside
// the piste (the downhill's, `racingLine`) is SWUNG either side of itself
// in turn — a gate's side a gate, a few metres across, dealt a gate off a
// stream of the course's own so the rhythm changes, no further than leaves
// the gate on the snow nor bends it tighter than `superG.bend` — the swing
// eased from one gate's apex to the next's (half a cosine), and set
// straight before a jump. Each gate's turning pole stands `superG.pass`
// metres inside the line's apex, its outside pole `superG.width` beyond.
// Everything is a pure function of the map, drawing nothing from the run's
// stream — so no digest moves and a restart stands on the very course it
// left.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { clearedTrees, prepareCourse } from "./course-prep.ts";
import { DISCIPLINE_RULES } from "./discipline-rules.ts";
import { trackPointAt } from "./query.ts";
import { lineOffset, racingLine, trapArc } from "./speed-course.ts";
import type { Checkpoint, Level, Spawn, SuperGCourse, TrackPoint } from "./types.ts";

const G = DISCIPLINE_RULES.superG;

/** What a super-G's gates are dealt off beside the map's seed. */
const SUPER_G_SALT = 0x5e9a;

/** R33 — THE COURSE A SUPER-G IS RACED ON: the id of the ski area's course
 * (R28) with the most vertical — its start lowered into the band — or null
 * on a map that is not a ski area. */
export function superGCourseOf(level: Level): string | null {
  let best: { id: string; drop: number } | null = null;
  for (const c of level.resort?.courses ?? []) {
    if (!best || c.drop > best.drop || (c.drop === best.drop && c.id < best.id)) {
      best = { id: c.id, drop: c.drop };
    }
  }
  return best?.id ?? null;
}

const pt: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** R33 — WHERE A SUPER-G STARTS on `level`'s piste: its start gate where
 * the drop to the finish has come down to `superG.target`, or the piste's
 * own start gate where it never was that high — and never on a drop's
 * lip. */
export function superGStart(level: Level): number {
  const gate = level.checkpoints[0]?.s ?? 0;
  const L = level.track.length;
  const foot = trackPointAt(level, L, pt).y;
  let from = gate;
  for (let s = gate; s < L - 400; s += 2) {
    if (trackPointAt(level, s, pt).y - foot <= G.target) {
      from = s;
      break;
    }
  }
  // Off any drop on the piste, by a jump's clearance, downhill.
  for (const c of level.cliffs ?? []) {
    if (!c.onTrack || c.s === undefined) continue;
    if (from > c.s - G.jump && from < c.s + G.jump) from = c.s + G.jump;
  }
  return from;
}

/** The arcs of the gates from the start gate at `from` to the finish at
 * `to`: as many as the vertical's direction changes ask (`superG.changes`)
 * and the spacing aimed at gives, whichever is more, each strayed off the
 * even spacing by the course's rhythm and stepped off a jump inside the
 * spacing's band. */
function gateArcs(
  from: number,
  to: number,
  vertical: number,
  jumps: readonly number[],
  seed: number,
): number[] {
  const S = G.spacing;
  const rng = createRng((seed ^ SUPER_G_SALT) >>> 0);
  const length = to - from;
  // The last gate stands a spacing above the finish.
  const room = length - S.target * 0.6;
  const want = Math.max(Math.ceil(G.changes * vertical), Math.round(room / S.target));
  const n = Math.max(1, Math.min(want, Math.floor(room / S.min)));
  const even = room / n;
  const arcs: number[] = [];
  let prev = from;
  for (let i = 0; i < n; i++) {
    let at = from + even * (i + 1) + even * G.rhythm * (rng.next() * 2 - 1);
    at = clamp(at, prev + S.min, Math.min(prev + S.max, to - S.min));
    const j = jumps.find((a) => at > a - G.jump && at < a + G.landing);
    if (j !== undefined) {
      const fits = [j - G.jump, j + G.landing].filter(
        (a) => a >= prev + S.min && a <= prev + S.max && to - a >= S.min,
      );
      fits.sort((a, b) => Math.abs(a - at) - Math.abs(b - at));
      // ...or past the jump, the spacing's most stretched over it.
      at = fits[0] ?? j + G.landing;
    }
    if (at <= prev || to - at < S.min) continue;
    arcs.push(at);
    prev = at;
  }
  return arcs;
}

/** THE CRESTS A RACER FLIES OFF between `from` and `to`, by arc: where the
 * piste's profile, shaved round (`superG.crest`), still bends over tighter
 * than `superG.takeoff` metres of radius — a racer at a super-G's speed
 * leaves the snow there — one a crest, the tightest of each run of them. */
function crestsOf(level: Level, from: number, to: number): number[] {
  const pts = level.track.points;
  const out: number[] = [];
  let best = 0;
  let at = -1;
  // Read over a lip's length either side, past the start drop.
  const w = Math.max(1, Math.round(G.crestSpan / Math.max(1e-6, pts[1].s - pts[0].s)));
  const head = from + G.drop.lip + G.drop.length + G.drop.ease;
  for (let k = w; k < pts.length - w; k++) {
    const p = pts[k];
    if (p.s <= head || p.s >= to) continue;
    const h = (pts[k + w].s - pts[k - w].s) / 2;
    const convex = -(pts[k - w].y - 2 * p.y + pts[k + w].y) / (h * h);
    if (convex > 1 / G.takeoff) {
      if (convex > best) {
        best = convex;
        at = p.s;
      }
    } else if (at >= 0) {
      if (out.length === 0 || at - out[out.length - 1] > G.landing) out.push(at);
      best = 0;
      at = -1;
    }
  }
  return out;
}

const set = new WeakMap<Level, Level>();

/** R33 — A SUPER-G SET OVER `level`: its piste from the lowered start as a
 * super-G course, as a map whose checkpoints are its gates and whose spawn
 * is the start house. A map that already carries a super-G is that map;
 * one carrying another race is set over the map under it. Kept per map,
 * so a restart or a replay stands on the course the renderer already
 * built. The course keeps the day and the sky of the map it was set
 * over. */
export function setSuperG(level: Level): Level {
  if (level.superG) return level;
  const original = level.slalom?.base ?? level.downhill?.base ?? level;
  let course = set.get(original);
  if (!course) {
    course = courseOver(original);
    set.set(original, course);
  }
  return course.sun === level.sun && course.weather === level.weather
    ? course
    : { ...course, sun: level.sun, weather: level.weather };
}

/** The super-G set over `original`, a map with no course on it. */
function courseOver(original: Level): Level {
  const to = original.track.length;
  const from = superGStart(original);
  const stretch = { from, to };
  const base = prepareCourse(original, stretch, G);
  const startAt = trackPointAt(base, from);
  const finishAt = trackPointAt(base, to);
  const vertical = startAt.y - finishAt.y;
  // The jumps the course keeps: its drops (R24) and the crests a racer
  // flies off, by arc.
  const jumps = [
    ...(base.cliffs ?? [])
      .filter((c) => c.onTrack && c.s !== undefined && c.s > from && c.s < to)
      .map((c) => c.s ?? 0),
    ...crestsOf(base, from, to),
  ]
    .sort((a, b) => a - b)
    // A drop's edge is a crest too: one jump.
    .filter((s, i, all) => i === 0 || s - all[i - 1] > G.jump);
  const step = G.line.step;
  const centre = racingLine(base, from, to, G.line);
  const arcs = gateArcs(from, to, vertical, jumps, original.seed);
  // THE SWING at each gate: its side in turn, its size dealt, held to the
  // snow the gate needs beside the line and to the tightest bend the
  // spacing either side allows; straight before a jump.
  const rng = createRng((original.seed ^ SUPER_G_SALT ^ 0x7a) >>> 0);
  const swing: number[] = [];
  const side: (1 | -1)[] = [];
  const first: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
  for (let i = 0; i < arcs.length; i++) {
    const at = arcs[i];
    const sigma: 1 | -1 = i % 2 === 0 ? first : first === 1 ? -1 : 1;
    const before = i === 0 ? at - from : at - arcs[i - 1];
    const after = (i === arcs.length - 1 ? to : arcs[i + 1]) - at;
    const span = Math.min(before, after);
    // The swing a half cosine over `span` bends at most (a·π²/span²).
    const most = (span * span) / (Math.PI * Math.PI * G.bend);
    let a = G.swing.min + (G.swing.max - G.swing.min) * rng.next();
    a = Math.min(a, most);
    if (jumps.some((j) => j > at && j - at < G.approach)) a *= G.straight;
    a *= G.opening[i] ?? 1;
    // ...and straighter on a gentle stretch, where the racer comes slowly.
    const fall =
      (trackPointAt(base, at - G.flat.over, pt).y - trackPointAt(base, at, pt).y) / G.flat.over;
    a *= clamp((fall - G.flat.from) / (G.flat.to - G.flat.from), G.flat.least, 1);
    const p = trackPointAt(base, at, pt);
    const o = lineOffset(centre, from, at, step);
    // The line's apex no further toward the gate's side than leaves its
    // outside pole on the snow, nor further the other way than its turning
    // pole.
    const reach = p.width / 2 - G.inside - G.width + G.pass;
    const apex = clamp(o + sigma * a, -Math.max(0, reach), Math.max(0, reach));
    swing.push(apex - o);
    side.push(sigma);
  }
  // The line: the centre swung, the swing eased from apex to apex.
  const knots = [from, ...arcs, to];
  const values = [0, ...swing, 0];
  const line = new Float64Array(centre.length);
  let k = 0;
  for (let i = 0; i < centre.length; i++) {
    const s = from + i * step;
    while (k < knots.length - 2 && s > knots[k + 1]) k++;
    const u = clamp((s - knots[k]) / Math.max(1e-6, knots[k + 1] - knots[k]), 0, 1);
    const w = values[k] + ((values[k + 1] - values[k]) * (1 - Math.cos(Math.PI * u))) / 2;
    const half = trackPointAt(base, s, pt).width / 2 - G.inside;
    line[i] = clamp(centre[i] + w, -half, half);
  }
  const checkpoints: Checkpoint[] = [];
  checkpoints.push({
    x: startAt.x,
    z: startAt.z,
    y: startAt.y,
    heading: startAt.heading,
    width: 2,
    s: from,
    colour: "red",
  });
  for (let i = 0; i < arcs.length; i++) {
    const at = arcs[i];
    const p = trackPointAt(base, at);
    const sigma = side[i];
    // The gate stands outward of the line's apex: its turning pole `pass`
    // inside it, its outside pole `width` beyond that.
    const offset = lineOffset(line, from, at, step) + sigma * (G.width / 2 - G.pass);
    const x = p.x + Math.cos(p.heading) * offset;
    const z = p.z - Math.sin(p.heading) * offset;
    checkpoints.push({
      x,
      z,
      y: base.groundAt(x, z),
      heading: p.heading,
      width: G.width,
      s: at,
      colour: i % 2 === 0 ? "red" : "blue",
      offset,
      span: p.width,
      panels: true,
      turn: sigma === 1 ? -1 : 1,
    });
  }
  checkpoints.push({
    x: finishAt.x,
    z: finishAt.z,
    y: finishAt.y,
    heading: finishAt.heading,
    width: Math.max(G.finishWidth, finishAt.width + 6),
    s: to,
    colour: "red",
  });
  const house = trackPointAt(base, from - G.stand);
  const spawn: Spawn = { x: house.x, z: house.z, heading: startAt.heading };
  const trapS = trapArc(base, from, to, G.trap);
  const trapAt = trackPointAt(base, trapS);
  const superG: SuperGCourse = {
    base: original,
    from,
    to,
    vertical,
    trap: {
      s: trapS,
      x: trapAt.x,
      z: trapAt.z,
      heading: trapAt.heading,
      width: trapAt.width + 2 * G.nets.gap,
    },
    nets: { gap: G.nets.gap, height: G.nets.height, from: from - G.stand - 6, to: to - 10 },
    jumps,
    line: Array.from(line, (x, i) => ({ s: from + i * step, x })),
    turns: arcs.length,
  };
  return {
    ...base,
    checkpoints,
    spawn,
    grid: [spawn],
    trees: clearedTrees(base, stretch, G),
    superG,
  };
}
