// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CORDON TAPE BROKEN — anything that goes through a span of the police's
// tape (`police-view.ts` draws it, `police-plan.ts` plans when each span is
// run out) breaks it, and the two loose halves fall onto the snow.
//
// WHAT REAL BARRIER TAPE DOES. It is a thin polyethylene film, 7–8 cm wide
// and some 50 µm thick — a few grams a metre — tied off round each stake.
// Something running into it bows it into a V; the film stretches and parts
// where it is loaded: struck fast it SNAPS at the contact, the strain too
// quick to spread along it, while a slow push spreads the pull down the whole
// span until the weakest place lets go — the knot slipping off a stake, so it
// TEARS OFF the nearer one. The stretched film released springs back: the
// loose ends whip back toward their stakes, the end it was snapped at dragged
// a little along with whatever broke it, and then, so light that the air
// holds it up (it falls at about a metre a second, fluttering and turning
// over as it goes), each half drifts down and lies limp on the snow, along
// its surface, its stretched end crumpled, a twist here and there — on the
// snow, never into it (it weighs nothing), and still tied to its stake.
//
// HOW IT IS DONE. Two halves, one pure model:
//
// - THE BREAK (`cutTape`) is decided after every step the app takes of a run
//   (`crowd-calls.ts`' `stepRun` — live, a replay's playback and its seek
//   alike), off the run's own state: everything that moves through the
//   cordon — the player on his skis, his body thrown or on a machine, the
//   rivals, the crowd, the snowmobile, the bike and the piste machines —
//   swept over the step against each span the tape has been run along, with
//   its body standing over the tape's height there. The first to cross a
//   span breaks it, and the break is written onto the call
//   (`RescueCall.tape`, a `TapeCut`) — carried from run to run by the book
//   (`rescue-book.ts`), copied with a replay's keyframes, so a seek or a
//   replay finds the same breaks at the same moments. Nothing is drawn from
//   any stream and nothing the engine reads is written: no digest moves.
// - THE ROPE (`ropeOf`, `ropeTo`) is each broken span as a chain of points
//   two to a stripe, stepped by Verlet at `ROPE.dt` from the moment of its
//   break: gravity, the air's drag (strong across the film, weak along it)
//   against the wind, the film's flutter, the snow under every point (no
//   point below it; friction once on it), slack links that hold their length
//   but not a shape (it is limp), a weak hold against folding back on
//   itself, its ends tied to the stakes. Its state at any moment is a pure
//   function of the break and the clock — stepped on from where it was, or
//   from the break again when the clock went back — and it stops being
//   stepped once it lies still (`Rope.done`): only a broken span costs
//   anything, and only while it moves. Three-free; the suite reads it.

import { TUNING, windAt, type Cordon, type GameState, type Level, type TapeCut } from "@engine";

import { POLICE } from "./police-defs.ts";
import type { PolicePlan } from "./police-plan.ts";

const C = POLICE.cordon;

/** THE TAPE: its width, m (`police-view.ts` draws it so); the length of one
 * stripe, m; its twist along an intact span (leaned off its edge, rad, by
 * up to `turn` either way, a turn every `every` m). */
export const TAPE_SHAPE = {
  width: 0.075,
  stripe: 0.3,
  lean: 0.8,
  turn: 0.6,
  every: 2.6,
} as const;

/** THE BREAK'S NUMBERS. */
export const TAPE_CUT = {
  /** Slower than this through it, m/s, and the tape only bows (a skier
   * leaning on it); slower than `snap` it is pulled off the nearer stake,
   * faster it snaps at the contact. */
  least: 0.4,
  snap: 2.5,
  /** How far the contact is carried before the film parts, m: struck fast
   * it snaps almost at once; pushed slowly it bows deep first. */
  bow: { snap: 0.22, tear: 0.6 },
  /** The CoG of a skier stood on his skis over the snow, m: his feet that
   * far under it (`SkierState.y`), so he jumps over a tape only when they
   * clear it. A body thrown is a low round thing `thrown` m tall. */
  stand: 1.0,
  thrown: 0.6,
  /** Each person's height over his feet, m (the tape at under a metre is
   * below every one's waist, a child's too). */
  person: 1.1,
} as const;

/** THE ROPE'S NUMBERS (SI). */
export const ROPE = {
  /** Its step, s; the constraint passes a step. */
  dt: 1 / 120,
  passes: 6,
  /** Its points' least height over the snow, m (the film's thickness and
   * a hair, so it lies ON the snow). */
  lie: 0.006,
  /** The film's drag on the air, 1/m (a share of `a = c·|v|·v`): across
   * its face, averaged over its tumbling (a falling ribbon's terminal speed
   * about √(g/c) ≈ 1.2 m/s), and along it. */
  across: 7,
  along: 1.4,
  /** Its flutter as it falls: a sideways pull, (m/s²) a m/s of air
   * across it, at about `rate` Hz. */
  flutter: 5,
  rate: 3.2,
  /** ...dying away over `calm` s from the break: what is left hanging off
   * a stake leans in a steady wind rather than flapping on (which would
   * keep it stepped for as long as the wind blew). */
  calm: 1.6,
  /** How it turns over as it falls, rad a metre of air across it, and how
   * fast it settles onto its face on the snow, 1/s. */
  spin: 2.4,
  settle: 9,
  /** Its twist lying on the snow: how far off flat, rad, curling over a
   * wave `curlEvery` m long. */
  curl: 0.45,
  curlEvery: 0.85,
  /** The snow under it: the film's friction on it (a slide slowed by
   * `grip`·g), and the speed it sticks below, m/s. */
  grip: 0.7,
  stick: 0.06,
  /** THE SPRING BACK at the break: how fast the released film recoils
   * toward its stake at its loose end, m/s, dying away over `recoilReach`
   * m back from it; and how much of the breaker's speed the loose end is
   * dragged on with (at most `dragMost` m/s), dying away over `dragReach` m. */
  recoil: 6,
  recoilReach: 2.2,
  drag: 0.45,
  dragMost: 5,
  dragReach: 0.6,
  /** The film stretched before it parted, slack after: its links within
   * `neck` m of the break this much longer. */
  neck: 0.6,
  necked: 1.12,
  /** The wind the film feels as a share of the wind at 10 m: the log law
   * over snow gives some 0.7 at a metre, and a film hanging off a stake
   * turns its edge to it — so it leans in a breeze, not streams. */
  wind: 0.35,
  /** It lies still once no point has moved faster than `still` m/s for
   * `quiet` s — or, whatever it does, `most` s after the break. */
  still: 0.03,
  quiet: 0.5,
  most: 15,
} as const;

type P2 = { readonly x: number; readonly z: number };

/** THE CORDON OF A PLANNED CALL, as its `RescueCall` carries it. */
export function cordonOf(plan: PolicePlan): Cordon {
  return {
    ring: plan.ring.map((p) => ({ x: p.x, z: p.z })),
    spans: plan.spans.map((s) => ({ t0: s.t0, t1: s.t1 })),
    lift: plan.flight.lift,
  };
}

/** WHERE AN INTACT SPAN from stake `a` to stake `b` hangs `u` of the way
 * along it, into `out`: at the tape's height on each stake, sagging between
 * them, never nearer the snow than a quarter metre. The one shape the view
 * draws and the rope starts from. */
export function spanPoint(
  level: Level,
  a: P2,
  b: P2,
  u: number,
  out: number[] = [0, 0, 0],
): number[] {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const ya = level.groundAt(a.x, a.z) + C.tape;
  const yb = level.groundAt(b.x, b.z) + C.tape;
  const sag = Math.min(C.sagMost, C.sag * len);
  const x = a.x + (b.x - a.x) * u;
  const z = a.z + (b.z - a.z) * u;
  out[0] = x;
  out[1] = Math.max(ya + (yb - ya) * u - 4 * sag * u * (1 - u), level.groundAt(x, z) + 0.25);
  out[2] = z;
  return out;
}

/** How far an intact span from `a` (of length `len`) is leaned off its
 * edge at `u` along it, rad — each span its own phase. */
export function leanAt(a: P2, len: number, u: number): number {
  const phase = (a.x * 0.37 + a.z * 0.71) % (Math.PI * 2);
  const S = TAPE_SHAPE;
  return S.lean + S.turn * Math.sin(((u * len) / S.every) * Math.PI * 2 + phase);
}

/** How many stripes a span of `len` m is drawn in. */
export const stripesOf = (len: number): number => Math.max(2, Math.ceil(len / TAPE_SHAPE.stripe));

// --- THE BREAK -------------------------------------------------------------

/** Something moving through the cordon this step: where it is, its
 * velocity in plan, and the heights its body spans (world, m). */
type Mover = { x: number; z: number; vx: number; vz: number; foot: number; top: number };

/** This step's movers (a scratch pool, rewritten whole every step). */
const pool: { movers: Mover[]; used: number } = { movers: [], used: 0 };
function mover(x: number, z: number, vx: number, vz: number, foot: number, top: number): void {
  const { movers } = pool;
  const m =
    movers[pool.used] ?? (movers[pool.used] = { x: 0, z: 0, vx: 0, vz: 0, foot: 0, top: 0 });
  m.x = x;
  m.z = z;
  m.vx = vx;
  m.vz = vz;
  m.foot = foot;
  m.top = top;
  pool.used++;
}

/** A machine's front as three movers across it (`half` m either side of
 * its middle, `front` m ahead of its middle), its body from the snow up
 * `height` m. */
function front(
  level: Level,
  x: number,
  z: number,
  heading: number,
  front: number,
  half: number,
  vx: number,
  vz: number,
  height: number,
): void {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  for (const k of [-1, 0, 1]) {
    const px = x + fx * front + fz * half * k;
    const pz = z + fz * front - fx * half * k;
    const g = level.groundAt(px, pz);
    mover(px, pz, vx, vz, g, g + height);
  }
}

/** EVERYTHING THAT MOVES on the snow this step, into `movers`. */
function gather(state: GameState): void {
  pool.used = 0;
  const level = state.level;
  const skier = (s: GameState["skier"]): void => {
    if (s.thrown) {
      const b = s.thrown;
      mover(b.x, b.z, b.vx, b.vz, b.y - TAPE_CUT.thrown / 2, b.y + TAPE_CUT.thrown / 2);
    } else mover(s.x, s.z, s.vx, s.vz, s.y - TAPE_CUT.stand, s.y + 0.7);
  };
  skier(state.skier);
  for (const r of state.rivals) skier(r.run.skier);
  for (const a of state.crowd?.amateurs ?? []) {
    if (a.lift >= 0 && a.y - level.groundAt(a.x, a.z) > 1) continue;
    mover(a.x, a.z, a.vx, a.vz, a.y, a.y + TAPE_CUT.person);
  }
  const sled = state.sled;
  if (sled && sled.speed > 0.3)
    front(level, sled.x, sled.z, sled.heading, 1.65, 0.55, sled.vx, sled.vz, 1.3);
  const bike = state.bike;
  if (bike) {
    const g = level.groundAt(bike.x, bike.z);
    mover(bike.x, bike.z, bike.vx, bike.vz, Math.min(g, bike.y), g + 1.6);
  }
  for (const m of state.groomers ?? []) {
    if (Math.abs(m.speed) < 0.05) continue;
    const vx = Math.sin(m.heading) * m.speed;
    const vz = Math.cos(m.heading) * m.speed;
    front(level, m.x, m.z, m.heading, 4, 2.4, vx, vz, 2.9);
  }
}

/** Where the move from (`ax`, `az`) to (`bx`, `bz`) crosses the span from
 * `p` to `q`: how far along the span (0 … 1), or −1 when it does not. */
function crossing(ax: number, az: number, bx: number, bz: number, p: P2, q: P2): number {
  const rx = bx - ax;
  const rz = bz - az;
  const sx = q.x - p.x;
  const sz = q.z - p.z;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-12) return -1;
  const wx = p.x - ax;
  const wz = p.z - az;
  const t = (wx * sz - wz * sx) / den;
  const u = (wx * rz - wz * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : -1;
}

const at3 = [0, 0, 0];
const wind = { x: 0, z: 0, speed: 0, gust: 0 };

/**
 * THE TAPE BROKEN THIS STEP: every police call's cordon, while it stands,
 * against everything that moved through it over the step just taken — the
 * first through a span the tape has been run along breaks it, written onto
 * the call (`RescueCall.tape`). Run after every step of a run
 * (`stepRun`); a pure function of the state.
 */
export function cutTape(state: GameState): void {
  const calls = state.rescue;
  if (!calls) return;
  let gathered = false;
  const dt = TUNING.dt;
  for (const call of calls) {
    const cordon = call.cordon;
    if (call.kind !== "police" || !cordon) continue;
    const t = Math.min(state.t, call.stolen ?? Infinity) - call.start;
    const s0 = cordon.spans[0];
    if (!s0 || t <= s0.t0 || t >= cordon.lift) continue;
    if (!gathered) {
      gather(state);
      gathered = true;
    }
    if (pool.used === 0) return;
    // The cordon's box, and a little: what is outside it went nowhere near.
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const p of cordon.ring) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      z0 = Math.min(z0, p.z);
      z1 = Math.max(z1, p.z);
    }
    const n = cordon.ring.length;
    for (let k = 0; k < pool.used; k++) {
      const m = pool.movers[k];
      const pad = 0.5 + Math.hypot(m.vx, m.vz) * dt;
      if (m.x < x0 - pad || m.x > x1 + pad || m.z < z0 - pad || m.z > z1 + pad) continue;
      const speed = Math.hypot(m.vx, m.vz);
      if (speed < TAPE_CUT.least) continue;
      for (let i = 0; i < n; i++) {
        const span = cordon.spans[i];
        if (!span || t <= span.t0) continue;
        if (call.tape?.some((c) => c.span === i)) continue;
        const a = cordon.ring[i];
        const b = cordon.ring[(i + 1) % n];
        const u = crossing(m.x - m.vx * dt, m.z - m.vz * dt, m.x, m.z, a, b);
        if (u < 0) continue;
        // Only as far as the tape has been run out along it.
        const run = t >= span.t1 ? 1 : (t - span.t0) / (span.t1 - span.t0);
        if (u > run) continue;
        // Its body over the tape's height there: one in the air above it,
        // or sliding under it, leaves it be.
        const y = spanPoint(state.level, a, b, u, at3)[1];
        if (m.foot > y || m.top < y) continue;
        windAt(state.level, state.t, wind);
        (call.tape ??= []).push({
          span: i,
          u,
          t: state.t - call.start,
          vx: m.vx,
          vz: m.vz,
          tear: speed < TAPE_CUT.snap,
          wx: wind.x,
          wz: wind.z,
        });
      }
    }
  }
}

/** The breaks on `tape` at or before the call's clock `t`, by span. */
export function cutsAt(tape: readonly TapeCut[] | undefined, t: number): Map<number, TapeCut> {
  const out = new Map<number, TapeCut>();
  for (const c of tape ?? []) if (c.t <= t && !out.has(c.span)) out.set(c.span, c);
  return out;
}

// --- THE ROPE --------------------------------------------------------------

/** ONE BROKEN SPAN AS A ROPE: its points (x, y, z each) now and a step
 * ago, each link's length, which links still hold, which ends are tied,
 * each point's twist (rad off its edge) and its twist at rest on the snow,
 * the steps taken since the break, and whether it lies still. */
export type Rope = {
  cut: TapeCut;
  a: P2;
  b: P2;
  n: number;
  pos: Float64Array;
  prev: Float64Array;
  rest: Float64Array;
  linked: Uint8Array;
  lean: Float64Array;
  flat: Float64Array;
  /** Which way each point turns over in the air (±1, in runs). */
  turn: Int8Array;
  /** Each point's height over the snow at the last step, m. */
  over: Float64Array;
  tiedA: boolean;
  tiedB: boolean;
  /** The point the breaker carried, and where (and how fast, which way)
   * it carried it; the bow's length in steps. */
  k: number;
  apex: { x: number; y: number; z: number; dx: number; dz: number; speed: number };
  bow: number;
  steps: number;
  quiet: number;
  done: boolean;
};

/** A ROPE for span `a` → `b` broken by `cut`, at the moment of its break:
 * the intact span's own shape and twist, two points a stripe. */
export function ropeOf(level: Level, a: P2, b: P2, cut: TapeCut): Rope {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const segs = 2 * stripesOf(len);
  const n = segs + 1;
  const pos = new Float64Array(3 * n);
  const lean = new Float64Array(n);
  const flat = new Float64Array(n);
  const turn = new Int8Array(n);
  const p = [0, 0, 0];
  const phase = (a.x * 0.53 + a.z * 0.29) % (Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const u = i / segs;
    spanPoint(level, a, b, u, p);
    pos.set(p, 3 * i);
    lean[i] = leanAt(a, len, u);
    const s = u * len;
    flat[i] = Math.PI / 2 + ROPE.curl * Math.sin((s / ROPE.curlEvery) * Math.PI * 2 + phase);
    turn[i] = Math.sin(s * 1.7 + phase * 3) >= 0 ? 1 : -1;
  }
  const rest = new Float64Array(segs);
  for (let i = 0; i < segs; i++) {
    const j = 3 * i;
    rest[i] = Math.hypot(pos[j + 3] - pos[j], pos[j + 4] - pos[j + 1], pos[j + 5] - pos[j + 2]);
  }
  const speed = Math.hypot(cut.vx, cut.vz) || 1;
  const k = Math.min(segs - 1, Math.max(1, Math.round(cut.u * segs)));
  const bow = cut.tear ? TAPE_CUT.bow.tear : TAPE_CUT.bow.snap;
  return {
    cut,
    a,
    b,
    n,
    pos,
    prev: pos.slice(),
    rest,
    linked: new Uint8Array(segs).fill(1),
    lean,
    flat,
    turn,
    over: new Float64Array(n).fill(1),
    tiedA: true,
    tiedB: true,
    k,
    apex: {
      x: pos[3 * k],
      y: pos[3 * k + 1],
      z: pos[3 * k + 2],
      dx: cut.vx / speed,
      dz: cut.vz / speed,
      speed,
    },
    bow: Math.max(1, Math.round(bow / speed / ROPE.dt)),
    steps: 0,
    quiet: 0,
    done: false,
  };
}

/** THE ROPE AT THE CALL'S CLOCK `t`: stepped on from where it is, or from
 * its break again when `t` is before it; left as it is once it lies still. */
export function ropeTo(level: Level, rope: Rope, t: number): Rope {
  const want = Math.floor((t - rope.cut.t) / ROPE.dt + 1e-6);
  if (want < rope.steps) {
    const fresh = ropeOf(level, rope.a, rope.b, rope.cut);
    Object.assign(rope, fresh);
  }
  while (rope.steps < want && !rope.done) stepRope(level, rope);
  return rope;
}

/** The tied ends' places: on each stake at the tape's height. */
function tie(level: Level, rope: Rope): void {
  const { pos, prev, n } = rope;
  if (rope.tiedA) {
    pos[0] = prev[0] = rope.a.x;
    pos[1] = prev[1] = level.groundAt(rope.a.x, rope.a.z) + C.tape;
    pos[2] = prev[2] = rope.a.z;
  }
  if (rope.tiedB) {
    const j = 3 * (n - 1);
    pos[j] = prev[j] = rope.b.x;
    pos[j + 1] = prev[j + 1] = level.groundAt(rope.b.x, rope.b.z) + C.tape;
    pos[j + 2] = prev[j + 2] = rope.b.z;
  }
}

/** THE MOMENT IT PARTS: snapped at the contact (the link past the carried
 * point let go) or torn off the nearer stake; the film springs back toward
 * what still holds it, the end it parted at dragged on with the breaker. */
function part(rope: Rope): void {
  const { pos, prev, n, k, apex } = rope;
  const h = ROPE.dt;
  const cut = rope.cut;
  // Where it parted, and on which side each point is held from.
  let cutAt: number;
  if (cut.tear) {
    if (cut.u < 0.5) rope.tiedA = false;
    else rope.tiedB = false;
    cutAt = cut.u < 0.5 ? 0 : n - 1;
  } else {
    rope.linked[k] = 0;
    cutAt = k + 0.5;
  }
  // The film stretched near the break, slack now.
  for (let i = 0; i < n - 1; i++) {
    const d = Math.abs(i + 0.5 - cutAt) * rope.rest[i];
    if (d < ROPE.neck) rope.rest[i] *= ROPE.necked;
  }
  const drag = Math.min(ROPE.dragMost, ROPE.drag * apex.speed);
  for (let i = 0; i < n; i++) {
    // Toward its stake (the far one, torn): along the rope from the break.
    const away = (cut.tear ? cutAt === n - 1 : i < cutAt) ? -1 : 1;
    const j0 = 3 * Math.max(0, Math.min(n - 1, i - away));
    const j1 = 3 * Math.max(0, Math.min(n - 1, i + away));
    const tx = pos[j0] - pos[j1];
    const ty = pos[j0 + 1] - pos[j1 + 1];
    const tz = pos[j0 + 2] - pos[j1 + 2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    const d = Math.abs(i - cutAt) * rope.rest[0];
    const r = ROPE.recoil * Math.exp(-d / ROPE.recoilReach);
    const g = drag * Math.exp(-d / ROPE.dragReach);
    const vx = (-tx / tl) * r + apex.dx * g;
    const vy = (-ty / tl) * r;
    const vz = (-tz / tl) * r + apex.dz * g;
    const j = 3 * i;
    prev[j] = pos[j] - vx * h;
    prev[j + 1] = pos[j + 1] - vy * h;
    prev[j + 2] = pos[j + 2] - vz * h;
  }
}

const NRM = { x: 0, y: 1, z: 0 };

/** ONE STEP OF THE ROPE. */
export function stepRope(level: Level, rope: Rope): void {
  const { pos, prev, rest, linked, n } = rope;
  const h = ROPE.dt;
  const s = rope.steps;
  // THE BOW: the struck point carried on with the breaker, the rest of the
  // span drawn after it, until it parts.
  if (s < rope.bow) {
    const ap = rope.apex;
    const d = ap.speed * h * (s + 1);
    const j = 3 * rope.k;
    pos[j] = prev[j] = ap.x + ap.dx * d;
    pos[j + 2] = prev[j + 2] = ap.z + ap.dz * d;
    pos[j + 1] = prev[j + 1] = Math.max(ap.y, level.groundAt(pos[j], pos[j + 2]) + 0.25);
  } else if (s === rope.bow) part(rope);
  const free = s >= rope.bow;
  const t = rope.cut.t + s * h;
  const wx = rope.cut.wx * ROPE.wind;
  const wz = rope.cut.wz * ROPE.wind;
  let fastest = 0;
  for (let i = 0; i < n; i++) {
    if ((i === 0 && rope.tiedA) || (i === n - 1 && rope.tiedB)) continue;
    if (!free && i === rope.k) continue;
    const j = 3 * i;
    const vx = (pos[j] - prev[j]) / h;
    const vy = (pos[j + 1] - prev[j + 1]) / h;
    const vz = (pos[j + 2] - prev[j + 2]) / h;
    fastest = Math.max(fastest, Math.hypot(vx, vy, vz));
    // Along the film here.
    const a = 3 * Math.max(0, i - 1);
    const b = 3 * Math.min(n - 1, i + 1);
    let tx = pos[b] - pos[a];
    let ty = pos[b + 1] - pos[a + 1];
    let tz = pos[b + 2] - pos[a + 2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // THE AIR: across the film and along it, against the wind — which
    // fades out over the last ten centimetres to a film lying on the snow
    // (a sharp edge there would set a point on it rocking between the two).
    const air = rope.over[i] > 0.02;
    const felt = Math.min(1, Math.max(0, (rope.over[i] - 0.01) / 0.1));
    const rx = vx - wx * felt;
    const ry = vy;
    const rz = vz - wz * felt;
    const along = rx * tx + ry * ty + rz * tz;
    const ax = rx - along * tx;
    const ay = ry - along * ty;
    const az = rz - along * tz;
    const across = Math.hypot(ax, ay, az);
    let fx = -ROPE.across * across * ax - ROPE.along * Math.abs(along) * along * tx;
    let fy = -9.81 - ROPE.across * across * ay - ROPE.along * Math.abs(along) * along * ty;
    let fz = -ROPE.across * across * az - ROPE.along * Math.abs(along) * along * tz;
    if (air && across > 0.2) {
      // THE FLUTTER: a sideways pull across both the film and the air
      // through it, its sign wandering down the tape and in time.
      let bx = ty * az - tz * ay;
      let by = tz * ax - tx * az;
      let bz = tx * ay - ty * ax;
      const bl = Math.hypot(bx, by, bz) || 1;
      const w =
        ROPE.flutter *
        across *
        Math.exp(-(s * h) / ROPE.calm) *
        Math.sin(2 * Math.PI * ROPE.rate * t + i * 0.9);
      bx /= bl;
      by /= bl;
      bz /= bl;
      fx += bx * w;
      fy += by * w;
      fz += bz * w;
    }
    // Its twist: turned over by the air, laid onto its face by the snow.
    if (air) rope.lean[i] += rope.turn[i] * ROPE.spin * across * h;
    else {
      const to = rope.flat[i] + Math.PI * Math.round((rope.lean[i] - rope.flat[i]) / Math.PI);
      rope.lean[i] += (to - rope.lean[i]) * Math.min(1, ROPE.settle * h);
    }
    // Verlet.
    const nx = pos[j] + vx * h + fx * h * h;
    const ny = pos[j + 1] + vy * h + fy * h * h;
    const nz = pos[j + 2] + vz * h + fz * h * h;
    prev[j] = pos[j];
    prev[j + 1] = pos[j + 1];
    prev[j + 2] = pos[j + 2];
    pos[j] = nx;
    pos[j + 1] = ny;
    pos[j + 2] = nz;
  }
  // THE LINKS: each held to no more than its length (slack is free: it is
  // limp), a weak hold against folding flat back on itself; the snow.
  for (let pass = 0; pass < ROPE.passes; pass++) {
    for (let i = 0; i < n - 1; i++) {
      if (!linked[i]) continue;
      link(rope, i, i + 1, rest[i], 1, false);
    }
    for (let i = 0; i < n - 2; i++) {
      if (!linked[i] || !linked[i + 1]) continue;
      link(rope, i, i + 2, 0.5 * (rest[i] + rest[i + 1]), 0.25, true);
    }
    tie(level, rope);
    if (!free) {
      const j = 3 * rope.k;
      const ap = rope.apex;
      const d = ap.speed * h * (s + 1);
      pos[j] = ap.x + ap.dx * d;
      pos[j + 2] = ap.z + ap.dz * d;
      pos[j + 1] = Math.max(ap.y, level.groundAt(pos[j], pos[j + 2]) + 0.25);
    }
    ground(level, rope, pass === ROPE.passes - 1);
  }
  rope.steps++;
  // STILL: no point moving for a while, and well after it parted.
  if (free && fastest < ROPE.still) rope.quiet += h;
  else rope.quiet = 0;
  if ((free && rope.quiet >= ROPE.quiet) || rope.steps * h >= ROPE.most) rope.done = true;
}

/** Points `i` and `j` held to at most `len` apart (or, `least`, to at
 * least it), by `k` of the way, a tied end never moved. */
function link(rope: Rope, i: number, j: number, len: number, k: number, least: boolean): void {
  const { pos, n } = rope;
  const a = 3 * i;
  const b = 3 * j;
  const dx = pos[b] - pos[a];
  const dy = pos[b + 1] - pos[a + 1];
  const dz = pos[b + 2] - pos[a + 2];
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-9 || (least ? d >= len : d <= len)) return;
  const fixA = (i === 0 && rope.tiedA) || (i === n - 1 && rope.tiedB);
  const fixB = (j === 0 && rope.tiedA) || (j === n - 1 && rope.tiedB);
  if (fixA && fixB) return;
  const e = ((d - len) / d) * k;
  const wa = fixA ? 0 : fixB ? 1 : 0.5;
  const wb = fixB ? 0 : fixA ? 1 : 0.5;
  pos[a] += dx * e * wa;
  pos[a + 1] += dy * e * wa;
  pos[a + 2] += dz * e * wa;
  pos[b] -= dx * e * wb;
  pos[b + 1] -= dy * e * wb;
  pos[b + 2] -= dz * e * wb;
}

/** THE SNOW under every point: none below it; on it, the step's slide
 * mostly kept and a slow one stopped (`last`: the step's last pass, which
 * also notes each point's height over the snow). */
function ground(level: Level, rope: Rope, last: boolean): void {
  const { pos, prev, n } = rope;
  const h = ROPE.dt;
  for (let i = 0; i < n; i++) {
    const j = 3 * i;
    const g = level.groundAt(pos[j], pos[j + 2]) + ROPE.lie;
    if (pos[j + 1] < g + (last ? 1e-4 : 0)) {
      pos[j + 1] = Math.max(pos[j + 1], g);
      if (last) {
        prev[j + 1] = Math.max(prev[j + 1], g);
        // Coulomb's friction: the step's slide less what the snow takes
        // of it, a slow one stopped dead where it was — held there against
        // the creep a pull through the links would otherwise give it.
        const sx = pos[j] - prev[j];
        const sz = pos[j + 2] - prev[j + 2];
        const sl = Math.hypot(sx, sz);
        if (sl < ROPE.stick * h) {
          pos[j] = prev[j];
          pos[j + 2] = prev[j + 2];
          pos[j + 1] = Math.max(pos[j + 1], level.groundAt(pos[j], pos[j + 2]) + ROPE.lie);
          prev[j + 1] = pos[j + 1];
          rope.over[i] = 0;
          continue;
        }
        const keep = Math.max(0, sl - ROPE.grip * 9.81 * h * h) / (sl || 1);
        prev[j] = pos[j] - sx * keep;
        prev[j + 2] = pos[j + 2] - sz * keep;
      }
    }
    if (last) rope.over[i] = pos[j + 1] - g;
  }
}

/** THE ROPE AS A RIBBON: each point's middle and the half-width across the
 * film there (its lean off its edge about the way the rope runs, laid
 * against the snow's own slope where it lies on it), each written as
 * (x, y, z) into `mid` and `half` (3 × `rope.n`), the middle lifted where an
 * edge would go into the snow. */
export function ribbonOf(level: Level, rope: Rope, mid: Float32Array, half: Float32Array): void {
  const { pos, n } = rope;
  const w = TAPE_SHAPE.width / 2;
  let sx0 = 0;
  let sy0 = 0;
  let sz0 = 0;
  for (let i = 0; i < n; i++) {
    const j = 3 * i;
    const a = 3 * Math.max(0, i - 1);
    const b = 3 * Math.min(n - 1, i + 1);
    let tx = pos[b] - pos[a];
    let ty = pos[b + 1] - pos[a + 1];
    let tz = pos[b + 2] - pos[a + 2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // The way "up" the film leans from: the snow's normal under it as it
    // lies, the sky's as it hangs.
    const on = Math.max(0, Math.min(1, 1 - rope.over[i] / 0.05));
    level.normalAt(pos[j], pos[j + 2], NRM);
    const ux = NRM.x * on;
    const uy = NRM.y * on + (1 - on);
    const uz = NRM.z * on;
    // Across the run of the film, in that up's plane.
    let sx = uy * tz - uz * ty;
    let sy = uz * tx - ux * tz;
    let sz = ux * ty - uy * tx;
    let sl = Math.hypot(sx, sy, sz);
    if (sl < 0.2 && i > 0) {
      sx = sx0;
      sy = sy0;
      sz = sz0;
      sl = 1;
    }
    sx /= sl || 1;
    sy /= sl || 1;
    sz /= sl || 1;
    if (i > 0 && sx * sx0 + sy * sy0 + sz * sz0 < 0) {
      sx = -sx;
      sy = -sy;
      sz = -sz;
    }
    sx0 = sx;
    sy0 = sy;
    sz0 = sz;
    // Up off the film: across × along.
    const vx = sy * tz - sz * ty;
    const vy = sz * tx - sx * tz;
    const vz = sx * ty - sy * tx;
    const c = Math.cos(rope.lean[i]) * w;
    const k = Math.sin(rope.lean[i]) * w;
    const hx = vx * c + sx * k;
    const hy = vy * c + sy * k;
    const hz = vz * c + sz * k;
    // Neither edge into the snow.
    let y = pos[j + 1];
    for (const e of [1, -1]) {
      const ex = pos[j] + hx * e;
      const ez = pos[j + 2] + hz * e;
      const g = level.groundAt(ex, ez) + ROPE.lie;
      const ey = y + hy * e;
      if (ey < g) y += g - ey;
    }
    mid[j] = pos[j];
    mid[j + 1] = y;
    mid[j + 2] = pos[j + 2];
    half[j] = hx;
    half[j + 1] = hy;
    half[j + 2] = hz;
  }
}
