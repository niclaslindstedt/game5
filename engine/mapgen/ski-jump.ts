// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R43 — A SKI JUMPING HILL BUILT OVER A BUILT MAP. As R41's aerials site is,
// the hill is shaped STRAIGHT down the face: the start tower's deck, the
// IN-RUN (its straight at 35°, a transition whose curvature grows evenly
// to the table's radius, the TABLE to the EDGE), and below the edge the
// LANDING HILL — the knoll's cubic parabola to P, the landing radius from
// P through K to L, the transition onto the level OUT-RUN at U.
//
// THE PROFILE IS DESIGNED OFF THE NORM, then FITTED. Every element is the
// construction norm's formula over the hill's free choices (`hillOf`, the
// rule's `norm`), so the profile is the same on every map; then it is
// dropped onto the line of the face where it cuts and fills least
// (`straight-venue.ts`'s search and grading). The in-run is laid out along
// its own arc back from the edge (the norm states it by arc: the table's
// length, the gates' distances e₁ and e₂), the landing hill as heights
// over the horizontal from the edge (the norm states it by h, n and the
// slopes), and the whole resampled every `PEN_STEP` m of plan, as the
// other venues' pen draws them.
//
// THE SURFACE IS ANALYTIC. A table's edge with a 3 m wall under it and a
// 300 m arc are finer than the 2 m grid a map is baked on, so the hill
// answers `groundAt` and `normalAt` off its own profile inside its width
// (a moguls field with no mogul line, `withMoguls`), the grid cut beneath.
//
// Pure, drawing nothing from any stream — no digest moves and a restart
// stands on the very hill it left.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";

import { SKI_JUMP_RULE, type SkiJumpHillId, type SkiJumpHillRow } from "./trick-rules.ts";
import { gradeVenue, jumpHeightAt, originalOf, type VenueProfile } from "./straight-venue.ts";
import { withMoguls, type MogulField } from "./mogul-field.ts";
import type { Checkpoint, Kicker, Level, SkiJumpHill, Spawn } from "./types.ts";

const R = SKI_JUMP_RULE;
const N = R.norm;
const RAD = Math.PI / 180;
const G = 9.81;

/** THE HILL'S ELEMENTS as the norm derives them from its row (lengths m,
 * speeds m/s, angles rad). */
export type HillElements = {
  /** K's distance, the hill size, the height and the horizontal distance
   * from the edge to K. */
  w: number;
  hs: number;
  h: number;
  n: number;
  /** The in-run's angle, the table's, the landing slope at K, at P, at the
   * knoll's foot and at L. */
  inRun: number;
  table: number;
  slope: number;
  slopeP: number;
  slopeFoot: number;
  slopeL: number;
  /** The design speed off the edge and the speed landing at K. */
  speed: number;
  landing: number;
  /** The landing radius (P to L), the transition's radius at the table,
   * the table's length and height over the knoll's foot, and the curve's
   * length from the straight to the table. */
  rL: number;
  r1: number;
  t: number;
  s: number;
  curve: number;
  /** The arcs P–K and K–L. */
  l1: number;
  l2: number;
  /** The in-run's length from the top gate and from the lowest, along it. */
  e1: number;
  e2: number;
  /** The out-run's level length. */
  a: number;
};

/** THE NORM'S ELEMENTS for `row` (R43, `SKI_JUMP_RULE.norm`). */
export function hillOf(row: SkiJumpHillRow): HillElements {
  const w = row.w;
  const tilt = Math.atan(row.steepness);
  const landing = N.landing[0] * row.speed + N.landing[1];
  const rL = Math.round((landing * landing * w) / N.radius / N.round) * N.round;
  const slope = row.slope * RAD;
  const slopeP = (row.slope + N.p[0] * row.table - N.p[1]) * RAD;
  const slopeL = slope - N.l / landing;
  const r1 = N.r1[0] * (row.speed + N.r1[1]) ** 2;
  const turn = (row.inRun - row.table) * RAD;
  return {
    w,
    hs: row.hs,
    h: (w * Math.sin(tilt)) / N.chord,
    n: (w * Math.cos(tilt)) / N.chord,
    inRun: row.inRun * RAD,
    table: row.table * RAD,
    slope,
    slopeP,
    slopeFoot: slopeP / N.foot,
    slopeL,
    speed: row.speed,
    landing,
    rL,
    r1,
    t: N.t[0] * (row.speed + N.t[1]),
    s: Math.max(N.s[1], N.s[0] * w),
    // A curvature growing evenly from nothing to 1/r₁ turns the in-run by
    // its length over 2·r₁.
    curve: 2 * r1 * turn,
    l1: rL * (slopeP - slope),
    l2: (N.l * rL) / landing,
    e1: N.e1[0] - N.e1[1] * row.inRun + N.e1[2] * row.hs,
    e2: N.e2[0] - N.e2[1] * row.inRun + N.e2[2] * row.hs,
    a: Math.max(N.a[3], N.a[0] + N.a[1] * w - N.a[2] * w * w),
  };
}

/** One START GATE: its number (1 the lowest), where it stands, m of plan,
 * its height on the profile, m, and its distance from the edge along the
 * in-run, m. */
export type JumpGate = { number: number; x: number; y: number; e: number };

/** THE HILL'S PROFILE: its height every `dx` m of plan from the tower's
 * deck (`y`, the edge at 0), where its parts stand, m of plan, its gates
 * and its elements. */
export type SkiJumpProfile = VenueProfile & {
  hill: SkiJumpHillId;
  elements: HillElements;
  /** The top of the in-run's straight (the roll's foot), the curve's top,
   * the table's start, the EDGE (the knoll's foot under it), P, K, L, U
   * and the out-run's end, m of plan. */
  straight: number;
  curve: number;
  table: number;
  edge: number;
  p: number;
  k: number;
  l: number;
  u: number;
  outrun: number;
  /** The gates, the lowest first. */
  gates: readonly JumpGate[];
  /** The landing hill's arc from the knoll's foot every `dx` of plan from
   * the edge, m (0 at the edge), and the scale that makes K read `w`. */
  arc: Float64Array;
  scale: number;
};

/** The pen's step, m of plan. */
const PEN_STEP = 0.05;
/** The step the curves are integrated on, m of arc. */
const ARC_STEP = 0.01;

/** A point of a profile laid out by arc: plan `x`, height `y`, slope `a`
 * (rad, down positive). */
type Pt = { x: number; y: number; a: number };

/** The IN-RUN from the edge back up to the tower's deck: its slope at `e`
 * m of arc above the edge. */
function inRunSlope(el: HillElements, e: number, top: number): number {
  if (e <= el.t) return el.table;
  if (e <= el.t + el.curve) {
    const u = e - el.t;
    return el.table + (u - (u * u) / (2 * el.curve)) / el.r1;
  }
  if (e <= top) return el.inRun;
  return Math.max(0, el.inRun - (e - top) / R.roll);
}

function build(hill: SkiJumpHillId): SkiJumpProfile {
  const row = R.hills[hill];
  const el = hillOf(row);
  // THE IN-RUN, by arc up from the edge (at plan 0, height 0, for now).
  const top = el.e1 + R.above;
  const back: Pt[] = [{ x: 0, y: 0, a: el.table }];
  let e = 0;
  let x = 0;
  let y = 0;
  let platform = 0;
  const marks = { curve: 0, straight: 0, table: 0 };
  const gateArcs: number[] = [];
  for (;;) {
    const a = inRunSlope(el, e + ARC_STEP / 2, top);
    e += ARC_STEP;
    x -= Math.cos(a) * ARC_STEP;
    y += Math.sin(a) * ARC_STEP;
    if (e >= el.t && marks.table === 0) marks.table = x;
    if (e >= el.t + el.curve && marks.curve === 0) marks.curve = x;
    if (e >= top && marks.straight === 0) marks.straight = x;
    back.push({ x, y, a });
    if (a <= 0) platform += ARC_STEP;
    if (platform >= R.platform) break;
  }
  // THE GATES: equally spaced from e₂ to e₁, never past the most height
  // apart (read on the straight's angle, the steepest they stand on).
  const span = el.e1 - el.e2;
  const count = Math.ceil((span * Math.sin(el.inRun)) / R.gateHeight) + 1;
  for (let i = 0; i < count; i++) gateArcs.push(el.e2 + (span * i) / (count - 1));
  // THE LANDING HILL, over the horizontal from the edge.
  const centre = { x: el.n + el.rL * Math.sin(el.slope), y: -el.h + el.rL * Math.cos(el.slope) };
  const onArc = (a: number): { x: number; y: number } => ({
    x: centre.x - el.rL * Math.sin(a),
    y: centre.y - el.rL * Math.cos(a),
  });
  const P = onArc(el.slopeP);
  const L = onArc(el.slopeL);
  // The knoll: a cubic from the foot (0, −s) at the foot's slope to P at P's.
  const k0 = -el.s;
  const m0 = -Math.tan(el.slopeFoot);
  const m1 = -Math.tan(el.slopeP);
  const knoll = (q: number): number => {
    const u = q / P.x;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
    const h10 = u ** 3 - 2 * u ** 2 + u;
    const h01 = -2 * u ** 3 + 3 * u ** 2;
    const h11 = u ** 3 - u ** 2;
    return h00 * k0 + h10 * P.x * m0 + h01 * P.y + h11 * P.x * m1;
  };
  // L to U: the radius growing evenly from r2l to r2 over the arc.
  const turnLU = el.slopeL;
  const lengthLU = (turnLU * (row.r2 - row.r2l)) / Math.log(row.r2 / row.r2l);
  const fore: Pt[] = [];
  {
    let u = 0;
    let fx = L.x;
    let fy = L.y;
    while (u < lengthLU) {
      // Turned by ∫ du / r(u) = (l / (r₂ − r₂L))·ln(r / r₂L) so far.
      const radius = row.r2l + ((row.r2 - row.r2l) * (u + ARC_STEP / 2)) / lengthLU;
      const a = Math.max(0, turnLU - (lengthLU / (row.r2 - row.r2l)) * Math.log(radius / row.r2l));
      u += ARC_STEP;
      fx += Math.cos(a) * ARC_STEP;
      fy -= Math.sin(a) * ARC_STEP;
      fore.push({ x: fx, y: fy, a });
    }
  }
  const U = fore[fore.length - 1];
  const landingAt = (q: number): number => {
    if (q <= 0) return k0;
    if (q <= P.x) return knoll(q);
    if (q <= L.x) return centre.y - Math.sqrt(el.rL * el.rL - (q - centre.x) ** 2);
    if (q >= U.x) return U.y;
    // Within the transition: the laid-out points, by plan.
    let lo = 0;
    let hi = fore.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (fore[mid].x < q) lo = mid;
      else hi = mid;
    }
    const a = fore[lo];
    const b = fore[hi];
    const f = b.x > a.x ? (q - a.x) / (b.x - a.x) : 0;
    return a.y + (b.y - a.y) * f;
  };
  // RESAMPLED every PEN_STEP of plan from the tower's deck.
  // The edge stands on a sample, so the wall under it is one step wide.
  const deck = back[back.length - 1];
  const start = -Math.ceil(-deck.x / PEN_STEP) * PEN_STEP;
  const edge = -start;
  const end = edge + U.x + el.a + R.past;
  const n = Math.ceil(end / PEN_STEP) + 1;
  const ys = new Float64Array(n);
  let j = back.length - 1;
  for (let i = 0; i < n; i++) {
    const q = i * PEN_STEP + start;
    if (q <= deck.x) {
      ys[i] = deck.y;
    } else if (q < -PEN_STEP / 2) {
      while (j > 0 && back[j - 1].x <= q) j--;
      const a = back[j];
      const b = back[Math.max(0, j - 1)];
      const f = b.x > a.x ? (q - a.x) / (b.x - a.x) : 0;
      ys[i] = a.y + (b.y - a.y) * f;
    } else if (q < PEN_STEP / 2) {
      ys[i] = 0;
    } else {
      ys[i] = landingAt(q);
    }
  }
  // THE DISTANCE: the arc along the landing profile from the knoll's foot.
  const steps = Math.ceil((end - edge) / PEN_STEP) + 1;
  const arc = new Float64Array(steps);
  let prevY = k0;
  for (let i = 1; i < steps; i++) {
    const q = i * PEN_STEP;
    const yq = landingAt(q);
    arc[i] = arc[i - 1] + hypot(PEN_STEP, yq - prevY);
    prevY = yq;
  }
  const arcK = sampleArc(arc, el.n);
  const gates: JumpGate[] = gateArcs.map((ge, i) => {
    const at = pointAt(back, ge);
    return { number: i + 1, x: at.x - start, y: at.y, e: ge };
  });
  return {
    hill,
    elements: el,
    dx: PEN_STEP,
    y: ys,
    straight: marks.straight - start,
    curve: marks.curve - start,
    table: marks.table - start,
    edge,
    p: edge + P.x,
    k: edge + el.n,
    l: edge + L.x,
    u: edge + U.x,
    outrun: edge + U.x + el.a,
    finish: edge + U.x + R.fallLine,
    end,
    gates,
    arc,
    scale: el.w / arcK,
  };
}

/** The in-run's point `e` m of arc above the edge. */
function pointAt(back: readonly Pt[], e: number): Pt {
  const i = Math.min(back.length - 1, Math.max(0, Math.round(e / ARC_STEP)));
  return back[i];
}

function sampleArc(arc: Float64Array, q: number): number {
  const f = Math.max(0, Math.min(arc.length - 1, q / PEN_STEP));
  const i = Math.min(arc.length - 2, Math.floor(f));
  return arc[i] + (arc[i + 1] - arc[i]) * (f - i);
}

const designed = new Map<SkiJumpHillId, SkiJumpProfile>();

/** THE HILL (R43) as designed: the same on every map. */
export function skiJumpProfile(hill: SkiJumpHillId = "large"): SkiJumpProfile {
  let p = designed.get(hill);
  if (!p) {
    p = build(hill);
    designed.set(hill, p);
  }
  return p;
}

/** The hill's height `x` m of plan along it, m (the edge at 0). */
export function skiJumpHeightAt(p: SkiJumpProfile, x: number): number {
  return jumpHeightAt(p, x);
}

/** THE DISTANCE a landing `x` m of plan along the hill is credited, m:
 * along the landing profile from the knoll's foot, scaled so K reads w
 * (R43) — 0 above the edge. Unrounded; the judge reads it down to the half
 * metre (`measuredDistance`). */
export function jumpDistanceAt(p: SkiJumpProfile, x: number): number {
  if (x <= p.edge) return 0;
  return sampleArc(p.arc, x - p.edge) * p.scale;
}

/** A distance as the measurers mark it: down to the half metre, m. */
export function measuredDistance(d: number): number {
  return Math.floor(d * 2 + 1e-9) / 2;
}

/** THE SPEED AT THE EDGE from gate `gate` (an index into `p.gates`, the
 * lowest 0) in calm air: the rule's jumper as a point mass down the
 * in-run's arc — the drop, the tracks' friction on his weight and the
 * curve's load, and his crouch's drag (`SKI_JUMP_RULE.skier`), m/s. A
 * head wind along the in-run of `head` m/s adds to the air past him. */
export function edgeSpeed(p: SkiJumpProfile, gate: number, head = 0): number {
  const el = p.elements;
  const S = R.skier;
  const mu = Math.tan(R.tracks * RAD);
  const k = (0.5 * S.air * S.crouch) / S.mass;
  const top = el.e1 + R.above;
  let e = p.gates[Math.max(0, Math.min(p.gates.length - 1, gate))].e;
  let v = 0;
  const de = 0.02;
  while (e > 0) {
    const a = inRunSlope(el, e - de / 2, top);
    // Curvature where the in-run bends (it turns him up into the table).
    const u = e - el.t;
    const kappa = u > 0 && u < el.curve ? (1 - u / el.curve) / el.r1 : 0;
    const air = v + head;
    const acc = G * Math.sin(a) - mu * (G * Math.cos(a) + v * v * kappa) - k * air * air;
    v = Math.sqrt(Math.max(0, v * v + 2 * acc * de));
    e -= de;
  }
  return v;
}

/** THE DESIGN GATE: the lowest gate whose jumper reaches the edge at the
 * hill's design speed in calm air (an index into `p.gates`). */
export function designGate(p: SkiJumpProfile): number {
  for (let i = 0; i < p.gates.length; i++) {
    if (edgeSpeed(p, i) >= p.elements.speed) return i;
  }
  return p.gates.length - 1;
}

const built = new Map<SkiJumpHillId, WeakMap<Level, Level>>();

/** R43 — A SKI JUMPING HILL BUILT OVER `level`: the hill shaped down the
 * face as the map's own `track`, its checkpoints the start gate (the top
 * gate) and the finish line (the fall line), its spawn on the top gate,
 * its take-off the map's one kicker (`SJ`) and its surface the map's
 * ground inside its width. Kept per map and hill; the hill keeps the day
 * and the sky of the map it was built over. */
export function setSkiJump(level: Level, hill: SkiJumpHillId = "large"): Level {
  if (level.skiJump?.hill === hill) return level;
  const original = originalOf(level);
  let kept = built.get(hill);
  if (!kept) {
    kept = new WeakMap();
    built.set(hill, kept);
  }
  let site = kept.get(original);
  if (!site) {
    site = buildOver(original, hill);
    kept.set(original, site);
  }
  return site.sun === level.sun && site.weather === level.weather
    ? site
    : { ...site, sun: level.sun, weather: level.weather };
}

function buildOver(original: Level, hill: SkiJumpHillId): Level {
  const p = skiJumpProfile(hill);
  const el = p.elements;
  const v = gradeVenue(original, p, R, ({ fit, fx, fz, yAt }): Kicker[] => [
    {
      id: "SJ",
      x: fit.x + fx * p.edge,
      z: fit.z + fz * p.edge,
      y: yAt(p.edge),
      heading: fit.heading,
      height: el.s,
      ramp: p.edge - p.table,
      landing: p.l - p.edge,
      width: N.widths.inRun,
      onTrack: true,
      s: p.edge,
      trick: true,
    },
  ]);
  const { fit, fx, fz, yAt, level } = v;
  const across = (s: number, width: number): Checkpoint => ({
    x: fit.x + fx * s,
    z: fit.z + fz * s,
    y: yAt(s),
    heading: fit.heading,
    width,
    s,
    colour: "red",
  });
  const topGate = p.gates[p.gates.length - 1];
  const start = across(topGate.x, 4);
  const finish = across(p.finish, R.width);
  const spawn: Spawn = {
    x: fit.x + fx * topGate.x,
    z: fit.z + fz * topGate.x,
    heading: fit.heading,
  };
  const field: MogulField = {
    x: fit.x,
    z: fit.z,
    heading: fit.heading,
    yAt,
    half: R.width / 2,
    end: p.end,
    lines: [],
    from: 0,
    to: 0,
    gaps: [],
    spacing: 1,
    height: 0,
    wave: 1,
    ease: 1,
  };
  const course: SkiJumpHill = {
    base: original,
    hill,
    w: el.w,
    hs: el.hs,
    from: topGate.x,
    to: p.finish,
    vertical: start.y - finish.y,
    straight: p.straight,
    curve: p.curve,
    table: p.table,
    edge: p.edge,
    p: p.p,
    k: p.k,
    l: p.l,
    u: p.u,
    outrun: p.outrun,
    takeOff: el.table,
    lip: el.s,
    gates: p.gates.map((g) => ({ ...g, y: yAt(g.x) })),
    design: designGate(p),
    speed: el.speed,
    metre: R.hills[hill].metre,
    gateFactor: R.hills[hill].gate,
    headFactor: R.hills[hill].head,
    tailFactor: R.hills[hill].tail,
    width: R.width,
    yAt,
    distanceAt: (x: number) => jumpDistanceAt(p, x),
  };
  return {
    ...withMoguls(level, field),
    checkpoints: [start, finish],
    spawn,
    grid: [spawn],
    skiJump: course,
  };
}
