// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BODY LYING ON THE SNOW, GONE OVER — an amateur down on his ragdoll
// (knocked and about to get up, hurt, killed: `crowd-down.ts`) and a person
// on foot struck and lying (`foot.ts`' `FootDown`), met by everything
// `foot.ts`' hitters name: the player on his skis, his board or the bike,
// the snowmobile he rides, a piste machine or a car of the traffic. A man
// lying is a low hump, not a body stood up to be struck, so this is not
// `person-hit.ts`' two bodies colliding whole: the body is its ragdoll's
// thirteen points, each a sphere of its own radius with the limbs between
// them (a low capsule set), against the footprint of what goes over it —
// the skis' round the boots (`PERSON_HIT.lying.skis`), a machine's box —
// and, once a PASS (nothing of that kind touching him for `gap` s before):
//   - RIDDEN OVER: the thing going over carries along `ride` of the mass
//     under its path as its front rides up the hump, the two sharing that
//     impulse by their masses — the rider slowed by it and hopped up off
//     it, the body pushed and dragged on its points under the path;
//   - A TIP CAUGHT: on skis, a limb lying across them met in their front
//     hooks the tip — he is thrown over it (`skier`), as a skier who
//     catches a tip on anything is; so is one the push took past the
//     crowd's own threshold;
//   - THE WEIGHT ON HIM: with INJURIES on (`GameState.gore`) the body is
//     hurt on `person-hit.ts`' ladder by the push and by the weight it bore
//     as the thing went over (`hold`, `press`): a skier's own weight hurts
//     nobody, a snowmobile's breaks a man lying, a piste machine's or a
//     car wheel's kills him — a dead one crushed further, an injured one
//     killed past `kill`, a knocked one injured past `injure`. With them
//     off nobody is hurt: the bump and the push are all of it.
// The rider's legs are struck through `body-person.ts` (only his shins: the
// body lies under `top`); the snowmobile's rider and a machine's driver
// are not. Every pass is filed beside the meetings with people stood
// (`CrowdState.struck`, `FootState.struck`) and reported as a `struck`
// event marked `lying`, so the sound, the rumble and the impact cam take
// it as any meeting. Nothing here draws from any stream, and only a free
// ride has anyone lying on its snow, so no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { CROWD, CROWD_SIZE, type CrowdBody } from "./defs/crowd.ts";
import { PERSON_HIT } from "./defs/person-hit.ts";
import { TUNING } from "./defs/tuning.ts";
import { crashLimit, throwRider } from "./crash.ts";
import { HITTERS, hittersOf, type FootDown, type Hitter } from "./foot.ts";
import type { StruckPerson } from "./person-hit.ts";
import { MASS, RADIUS, RAGDOLL } from "./ragdoll-points.ts";
import type { Amateur, GameEvent, GameState } from "./state.ts";
import type { Thrown } from "./thrown-state.ts";

const K = PERSON_HIT.lying;
const dt = TUNING.dt;
const G = 9.81;

/** What goes over a body lying, by kind. */
export type LyingBy = "skier" | "sled" | "groomer" | "car";

/** When each kind of thing last touched a body lying, the run's clock. */
export type LyingOver = Partial<Record<LyingBy, number>>;

/** The ragdoll's own mass, kg — its points are a body of this weight,
 * scaled to the person's own. */
const RAGDOLL_MASS = MASS.reduce((a, m) => a + m, 0);

/** The limbs a tip can hook under, each a bone between two points. */
const R = RAGDOLL;
const LIMBS: readonly (readonly [number, number])[] = [
  [R.hipL, R.kneeL],
  [R.kneeL, R.footL],
  [R.hipR, R.kneeR],
  [R.kneeR, R.footR],
  [R.shoulderL, R.elbowL],
  [R.elbowL, R.handL],
  [R.shoulderR, R.elbowR],
  [R.elbowR, R.handR],
];

/** ONE BODY LYING as this module meets it: whose (the amateur or the
 * person on foot down, who keeps the record of what has gone over him),
 * his ragdoll and his body. */
type Lying = {
  amateur: Amateur | null;
  down: FootDown | null;
  thrown: Thrown;
  body: CrowdBody;
};

const lying: Lying[] = [];

/** Every body lying on the snow now, into `lying`: an amateur down on his
 * ragdoll (not getting up, not under an avalanche, not the lift's) and
 * every person on foot the engine has down. How many. */
function lyingOf(state: GameState): number {
  let n = 0;
  const put = (amateur: Amateur | null, down: FootDown | null, thrown: Thrown, body: CrowdBody) => {
    if (n === lying.length) lying.push({ amateur, down, thrown, body });
    else {
      const l = lying[n];
      l.amateur = amateur;
      l.down = down;
      l.thrown = thrown;
      l.body = body;
    }
    n++;
  };
  for (const a of state.crowd?.amateurs ?? []) {
    if (a.mode !== "down" || !a.thrown || a.rise > 0 || a.buried !== undefined) continue;
    put(a, null, a.thrown, a.body);
  }
  for (const d of state.foot?.down ?? []) put(null, d, d.thrown, d.body);
  return n;
}

/** The footprint of hitter `h` round its middle, m: the skis' for the
 * player on them, a machine's own box. */
const box = { front: 0, back: 0, half: 0 };
function footprintOf(h: Hitter): typeof box {
  if (h.kind === "skier") {
    box.front = K.skis.front;
    box.back = K.skis.back;
    box.half = K.skis.half;
  } else {
    box.front = h.front;
    box.back = h.back;
    box.half = h.half;
  }
  return box;
}

/** What a pass found of the body under a footprint: whether it touches,
 * the ragdoll's mass under its path ahead (kg of the ragdoll's own), and
 * whether a limb lies across it in its tips. */
const found = { touch: false, under: 0, caught: false };

/** Whether a point at (`x`, `y`, `z`) of radius `r` is in the footprint
 * (or its tips), read off where it stands from the hitter. */
function inBox(h: Hitter, fx: number, fz: number, x: number, y: number, z: number, r: number) {
  const dy = y - h.feet;
  if (dy < -0.5 || dy > 0.7) return 0;
  const dx = x - h.x;
  const dz = z - h.z;
  const u = dx * fx + dz * fz;
  const v = dx * fz - dz * fx;
  if (Math.abs(v) > box.half + r || u < -box.back - r) return 0;
  if (u > box.front + r) return 1;
  return u >= box.front - K.tip - r ? 3 : 2;
}

/** The body `b` against hitter `h`'s footprint along (`fx`, `fz`), into
 * `found`. */
function overlap(h: Hitter, b: Thrown, fx: number, fz: number): void {
  const P = b.points;
  found.touch = false;
  found.under = 0;
  found.caught = false;
  for (let i = 0; i < R.count; i++) {
    const w = inBox(h, fx, fz, P[3 * i], P[3 * i + 1], P[3 * i + 2], RADIUS[i]);
    if (w === 0) continue;
    found.under += MASS[i];
    if (w >= 2) found.touch = true;
  }
  // The limbs between their points: the middle of each bone fills the
  // capsule; a bone lying across the skis with its middle or its far end
  // in their tips is a limb for a tip to hook under.
  for (const [i, j] of LIMBS) {
    const x = (P[3 * i] + P[3 * j]) / 2;
    const y = (P[3 * i + 1] + P[3 * j + 1]) / 2;
    const z = (P[3 * i + 2] + P[3 * j + 2]) / 2;
    const w = inBox(h, fx, fz, x, y, z, RADIUS[j]);
    if (w >= 2) found.touch = true;
    if (h.kind !== "skier" || found.caught) continue;
    const bx = P[3 * j] - P[3 * i];
    const bz = P[3 * j + 2] - P[3 * i + 2];
    const len = hypot(bx, bz);
    if (len < 1e-3 || Math.abs(bx * fz - bz * fx) / len < K.across) continue;
    const end = inBox(h, fx, fz, P[3 * j], P[3 * j + 1], P[3 * j + 2], RADIUS[j]);
    if (w === 3 || end === 3) found.caught = true;
  }
}

/** The weight the body bears as hitter `h` goes over it, kg. */
function bearOf(h: Hitter): number {
  switch (h.kind) {
    case "skier":
      return h.mass;
    case "sled":
    case "groomer": {
      const t = K.tracks[h.kind];
      return Math.min(h.mass, (t.kpa * 1000 * t.width * K.bridge) / G);
    }
    case "car":
      return h.mass / Math.max(1, h.wheels);
    default:
      return 0;
  }
}

/** EVERYTHING THAT GOES OVER A BODY LYING ON THE SNOW, this step: each
 * hitter against each body near it — a new pass ridden over or caught. */
export function meetLying(state: GameState, events: GameEvent[]): void {
  const m = lyingOf(state);
  if (m === 0) return;
  const n = hittersOf(state, (speed) => Math.abs(speed) >= K.slow);
  for (let k = 0; k < n; k++) {
    const h = HITTERS[k];
    if (h.kind === "thrown") continue;
    const fast = hypot(h.vx, h.vz);
    if (fast < K.slow) continue;
    footprintOf(h);
    const reach = 2 + Math.max(box.front, box.back, box.half);
    const fx = Math.sin(h.heading);
    const fz = Math.cos(h.heading);
    for (let i = 0; i < m; i++) {
      const l = lying[i];
      const b = l.thrown;
      if (Math.abs(b.x - h.x) > reach || Math.abs(b.z - h.z) > reach) continue;
      overlap(h, b, fx, fz);
      if (!found.touch) continue;
      const holder = l.amateur ?? l.down!;
      const over = (holder.over ??= {});
      const kind = h.kind as LyingBy;
      const last = over[kind];
      over[kind] = state.t;
      if (last !== undefined && state.t - last <= K.gap) continue;
      const closing = (h.vx - b.vx) * fx + (h.vz - b.vz) * fz;
      if (closing < K.slow) continue;
      goneOver(state, events, h, l, fx, fz, closing);
      // One body a hitter a step: the next is met on the next.
      break;
    }
  }
}

/** ONE PASS over body `l` by hitter `h` along (`fx`, `fz`) at `closing`
 * m/s: the rider slowed and hopped (or thrown), the body pushed, hurt with
 * the injuries on, the pass filed and reported. */
function goneOver(
  state: GameState,
  events: GameEvent[],
  h: Hitter,
  l: Lying,
  fx: number,
  fz: number,
  closing: number,
): void {
  const c = state.skier;
  const mass = CROWD_SIZE[l.body].mass;
  const scale = mass / RAGDOLL_MASS;
  const carried = found.under * scale * K.ride;
  const taken = (closing * carried) / (h.mass + carried);
  const j = taken * h.mass;
  const given = j / mass;
  const b = l.thrown;
  pushBody(b, found.under > 0 ? j / (found.under * scale) : 0, h, fx, fz);
  b.vx += given * fx;
  b.vz += given * fz;
  if (l.down) {
    l.down.settled = false;
    l.down.stir = state.t + K.settle;
  }
  const hurt = hurtLying(state, l, given, h, mass);
  const thrown =
    h.kind === "skier" &&
    ((found.caught && closing >= K.catchAt) ||
      taken >= CROWD.floors * crashLimit(c, "treeShoulder"));
  const said: Omit<StruckPerson, "dosed"> = {
    amateur: l.amateur ? l.amateur.id : -1,
    ...(l.down ? { foot: l.down.key, who: l.down.who } : {}),
    ...(h.kind === "groomer" || h.kind === "car" ? { by: h.kind } : {}),
    ...(h.ridden ? {} : { away: true as const }),
    lying: true,
    t: state.t,
    x: b.x,
    y: b.y,
    z: b.z,
    speed: closing,
    taken,
    given,
    height: PERSON_HIT.height[l.body],
    thrown,
    killed: hurt.killed,
    injured: hurt.injured,
    crush: hurt.crush,
  };
  const filed: StruckPerson = { ...said, dosed: h.kind !== "skier" };
  if (l.amateur) (state.crowd!.struck ??= []).push(filed);
  else state.foot!.struck.push(filed);
  events.push({ kind: "struck", ...said });
  const hop = Math.min(h.kind === "sled" ? K.hop.sled : K.hop.skis, closing * K.hop.share);
  if (h.kind === "sled") {
    const s = state.sled!;
    s.vx -= taken * fx;
    s.vz -= taken * fz;
    s.vy += hop;
  } else if (h.kind === "skier") {
    const v = { x: c.vx - taken * fx, y: c.vy + hop, z: c.vz - taken * fz };
    if (thrown) throwRider(state, "skier", v, events);
    else {
      c.vx = v.x;
      c.vy = v.y;
      c.vz = v.z;
    }
  }
}

/** The body pushed on along (`fx`, `fz`): every point under the path ahead
 * of the hitter's back given `dv` m/s (its last place moved back by it, as
 * the ragdoll's velocity is the difference), the joints dragging the rest. */
function pushBody(b: Thrown, dv: number, h: Hitter, fx: number, fz: number): void {
  const P = b.points;
  const L = b.last;
  for (let i = 0; i < R.count; i++) {
    if (inBox(h, fx, fz, P[3 * i], P[3 * i + 1], P[3 * i + 2], RADIUS[i]) === 0) continue;
    L[3 * i] -= dv * fx * dt;
    L[3 * i + 2] -= dv * fz * dt;
  }
  b.still = 0;
}

/** What a pass did to the body, with the injuries on: newly killed, newly
 * injured, and how crushed it left him when it crushed him further (0
 * otherwise). */
const hurt = { killed: false, injured: false, crush: 0 };
function hurtLying(
  state: GameState,
  l: Lying,
  given: number,
  h: Hitter,
  mass: number,
): typeof hurt {
  hurt.killed = hurt.injured = false;
  hurt.crush = 0;
  if (state.gore === undefined) return hurt;
  const P = PERSON_HIT;
  const press =
    ((K.press * Math.max(0, bearOf(h) - K.hold)) / 100) * Math.sqrt(CROWD_SIZE.man.mass / mass);
  const blow = given + press;
  const a = l.amateur;
  const d = l.down;
  const dead = a ? !!a.dead : d!.dead;
  const injured = a ? !!a.injured || !!a.hurt : d!.injured;
  const was = a ? (a.crush ?? 0) : d!.crush;
  const killed = !dead && blow >= P.kill;
  const hurtNow = !dead && !killed && !injured && blow >= P.injure;
  const crush = dead || killed ? Math.min(1, Math.max(0, (blow - P.kill) / (P.crush - P.kill))) : 0;
  const crushed = crush > was ? crush : 0;
  if (a) {
    if (killed) a.dead = true;
    if (hurtNow) a.injured = true;
    if (crushed > 0) a.crush = crushed;
  } else {
    if (killed) d!.dead = true;
    if (hurtNow) d!.injured = true;
    if (crushed > 0) d!.crush = crushed;
    if (killed || hurtNow) d!.until = Infinity;
  }
  hurt.killed = killed;
  hurt.injured = hurtNow;
  hurt.crush = crushed;
  return hurt;
}
