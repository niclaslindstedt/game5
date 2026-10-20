// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PEOPLE ON FOOT AS BODIES — the free ride's civilians (the lift crew,
// the patrol, the guests walking the base, the terrace, the children at
// play: `pwa/src/game/civilian-plan.ts`; the village's dog walkers,
// `dog-foot.ts`) and the crews of the air ambulance, the police and the
// ski patrol on its snowmobiles (`rescue-call.ts`), met by the skier at
// speed.
// Past `PERSON_HIT.strike` it is the same collision as an amateur's
// (`person-hit.ts`): two bodies of their real masses, flesh on flesh, the
// same impulse through both — the player slowed or thrown by what it left
// him and struck on every part of him the other's body stood against
// (`body-person.ts`), the person thrown onto a ragdoll of his own with his
// share and, on a run that carries its injuries (`GameState.gore`),
// injured or killed and crushed — down for good, one of `casualtiesOf`'s
// for the rescue and the police to collect. Under it the app's knock is
// the whole of it (`pwa/src/game/civilian-hits.ts`): a shove, a stagger,
// a fall, and the skier keeps his line.
//
// WHERE EACH ONE STANDS is the app's plan, HANDED IN before the first step
// as data, the way the rescue's calls are (`withFoot`, `FootCall`): every
// civilian's place, or his route round the base (`foot-route.ts`, the
// engine's so both sides walk it the same), the share of his role out by
// the hour and his own keenness, and the sky clock's rate the hour runs at
// (`skyHourAt`); a dog walker the TRACK knotted off his walks (`FootTrack`).
// A crew member is a TRACK sampled off his call's plan (`CrewTrack`,
// carried on the `RescueCall`). Nothing is dealt here, so a replay handed
// the same call (`recipeOf` carries it) meets the same people at the same
// places; the plan stays one layout, the app's, drawn by its views.
//
// WHAT STRIKES THEM is everything that moves among them and is the
// engine's: the player on his skis; his body THROWN, tumbling into them at
// his own weight (slowed by the blow and struck on his body by it); his
// SNOWMOBILE, its mass with his, some 300 kg into a man and the machine
// barely slowed; a PISTE MACHINE's twelve tonnes and the TRAFFIC's cars,
// bus and bicycles at theirs (`VEHICLE_MASS`), which never notice. A
// machine strikes past the blow a skier gives at the strike speed
// (`PERSON_HIT.foot.blow`), so a groomer at a walking pace knocks a man
// down; the player's body is dosed only by what met it itself.
//
// Absent on a run handed no people and until a crew member is struck, so
// no digest moves; nothing here draws from any stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler, type Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { skyHourAt } from "./clock.ts";
import { crashLimit, crashOver, throwOf, throwRider } from "./crash.ts";
import type { CrowdBody } from "./defs/crowd.ts";
import { CROWD, CROWD_SIZE } from "./defs/crowd.ts";
import { PERSON_HIT as K } from "./defs/person-hit.ts";
import { SKIS, totalMass } from "./defs/skis.ts";
import { SLED, sledMass } from "./defs/sled.ts";
import { TUNING } from "./defs/tuning.ts";
import { freshRouteAt, routeAt, type Route } from "./foot-route.ts";
import { GROOMER } from "./defs/groomer.ts";
import { VEHICLES, VEHICLE_MASS } from "./defs/traffic.ts";
import { onSkis } from "./groomer.ts";
import { exchangeOf, type StruckPerson } from "./person-hit.ts";
import { stepRagdoll } from "./ragdoll.ts";
import type { RescueCall } from "./rescue-call.ts";
import type { CrashCause, GameEvent, GameState } from "./state.ts";
import type { Thrown } from "./thrown-state.ts";
import { freshVehiclePose, trafficOf, vehicleAt } from "./traffic.ts";

const dt = TUNING.dt;

/** A share by the hour: `[hour, share]` knots, 0..24 and 0..1, read in
 * straight lines between them (`shareOfHours`). */
export type Hours = readonly (readonly [number, number])[];

/** THE SHARE `hours` HAS OUT at `hour` (wrapped into the day). */
export function shareOfHours(hours: Hours, hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  for (let k = 0; k + 1 < hours.length; k++) {
    const [h0, s0] = hours[k];
    const [h1, s1] = hours[k + 1];
    if (h >= h0 && h <= h1) return h1 > h0 ? s0 + ((s1 - s0) * (h - h0)) / (h1 - h0) : s1;
  }
  return 0;
}

/** ONE PERSON ON FOOT as the engine meets him: his key (the app's index of
 * him in its plan), his body, where he stands (his feet, m, and the way he
 * faces) — or the ROUTE he walks, `offset` s into it at the run's 0, or
 * the TRACK knotted off a plan of the app's (`FootTrack`: a dog walker) —
 * and, when he is out only some hours, his role's share by the hour and
 * his own keenness (out while it is under the share). `rx`, `rz`, `rr`: a
 * circle round everywhere he goes, m, for the cheap cull. */
export type FootPerson = {
  key: number;
  body: CrowdBody;
  x: number;
  y: number;
  z: number;
  heading: number;
  route?: Route;
  offset?: number;
  track?: FootTrack;
  keen?: number;
  hours?: Hours;
  rx: number;
  rz: number;
  rr: number;
};

/** THE PEOPLE A RUN IS HANDED (`CreateGameOptions.foot`): who, and the sky
 * clock's rate the hour they are out by runs at (sky s a run s). Read,
 * never written, during a run. */
export type FootCall = { people: readonly FootPerson[]; rate: number };

/** A CREW MEMBER'S WAY over his call, sampled off its plan by the app
 * (`pwa/src/game/rescue-tracks.ts`): his body, the run's clock of the first
 * sample, the step between samples, s, and where he stands at each, x then
 * z, m — NaN while he is not on the snow (in the cabin, not yet out, sat
 * on a machine). A ski patrolman's (`kind: "sled"`) names the machine he
 * rides (`k`), when it was taken as he was sampled (`taken`, the call's
 * clock, or null) and the run's clock from which the patrol's work goes on
 * differently for a machine taken (`sure`): past it his way holds only
 * while his machine is as it was. */
export type CrewTrack = {
  body: CrowdBody;
  t0: number;
  dt: number;
  xz: readonly number[];
  sled?: { k: 0 | 1; taken: number | null; sure: number };
};

/** A WAY KNOTTED OFF A PLAN by the app (`pwa/src/game/dog-foot.ts`): the
 * run's clocks of its knots, s, rising, and where he stands at each, x
 * then z, m, read in straight lines between — NaN at a knot where he is
 * not out (at home). Past its last knot he is out of it. */
export type FootTrack = { t: readonly number[]; xz: readonly number[] };

/** WHERE TRACK `tr` HAS HIM at `t`, into `out` (x and z): false while he
 * is not out on it. */
export function trackAt(tr: FootTrack, t: number, out: { x: number; z: number }): boolean {
  const ts = tr.t;
  const n = ts.length;
  if (n < 2 || !(t >= ts[0]) || t >= ts[n - 1]) return false;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const x0 = tr.xz[2 * lo];
  const x1 = tr.xz[2 * hi];
  if (Number.isNaN(x0) || Number.isNaN(x1)) return false;
  const f = (t - ts[lo]) / Math.max(1e-9, ts[hi] - ts[lo]);
  out.x = x0 + (x1 - x0) * f;
  out.z = tr.xz[2 * lo + 1] + (tr.xz[2 * hi + 1] - tr.xz[2 * lo + 1]) * f;
  return true;
}

/** The key a crew member is met by: man `j` of call `i`, past every
 * civilian's (a plan's index, a few hundred at the most). */
export const CREW_KEYS = 1_000_000;
export const crewKey = (i: number, j: number): number => CREW_KEYS + 8 * i + j;

/** ONE PERSON STRUCK and taken over by the engine: who, his body thrown
 * (a ragdoll of his own), the meeting, what it did to him, the run's clock
 * from which he is a body to meet again (Infinity: hurt, never) and
 * whether the body has come to rest. */
export type FootDown = {
  key: number;
  who: "civilian" | "crew" | "soldier";
  body: CrowdBody;
  thrown: Thrown;
  hit: StruckPerson;
  cause: CrashCause;
  dead: boolean;
  injured: boolean;
  crush: number;
  until: number;
  settled: boolean;
};

/** THE PEOPLE ON FOOT ON A RUN: the call handed in (null: only crews), the
 * ones struck and down, and every meeting (`personBlows` doses the player
 * off it). */
export type FootState = { call: FootCall | null; down: FootDown[]; struck: StruckPerson[] };

/** THE PEOPLE A RUN STARTS WITH, set before its first step. */
export function withFoot<S extends { foot?: FootState }>(state: S, call: FootCall | null): S {
  if (call && call.people.length) state.foot = { call, down: [], struck: [] };
  else delete state.foot;
  return state;
}

const AT = freshRouteAt();

/** WHERE PERSON `p` STANDS at the run's clock `t`, his feet into `out`, on
 * `level` — false while he is not out. */
export function footAt(
  state: Pick<GameState, "level">,
  call: FootCall,
  p: FootPerson,
  t: number,
  out: Vec3,
): boolean {
  if (p.hours && (p.keen ?? 0) >= shareOfHours(p.hours, skyHourAt(state.level, t, call.rate))) {
    return false;
  }
  if (p.track) {
    if (!trackAt(p.track, t, out)) return false;
    out.y = state.level.groundAt(out.x, out.z);
    return true;
  }
  if (p.route) {
    const a = routeAt(p.route, t + (p.offset ?? 0), AT);
    out.x = a.x;
    out.z = a.z;
    out.y = state.level.groundAt(a.x, a.z);
    return true;
  }
  out.x = p.x;
  out.y = p.y;
  out.z = p.z;
  return true;
}

/** WHERE CREW TRACK `tr` HAS HIM at the run's clock `t`, into `out`: false
 * while he is not on the snow. */
export function crewAt(
  state: Pick<GameState, "level">,
  tr: CrewTrack,
  t: number,
  out: Vec3,
): boolean {
  const n = tr.xz.length / 2;
  const u = (t - tr.t0) / tr.dt;
  if (!(u >= 0) || n < 1) return false;
  const k = Math.min(n - 1, Math.floor(u));
  const k1 = Math.min(n - 1, k + 1);
  const x0 = tr.xz[2 * k];
  const x1 = tr.xz[2 * k1];
  if (Number.isNaN(x0) || Number.isNaN(x1)) return false;
  const f = Math.min(1, u - k);
  out.x = x0 + (x1 - x0) * f;
  out.z = tr.xz[2 * k + 1] + (tr.xz[2 * k1 + 1] - tr.xz[2 * k + 1]) * f;
  out.y = state.level.groundAt(out.x, out.z);
  return true;
}

/** A person's reach round his middle, m, by his height. */
export const footRadius = (body: CrowdBody): number =>
  K.foot.radius * Math.sqrt(K.height[body] / K.height.man);

/** WHAT STRIKES THEM this step: the player on his skis (or a board, or
 * the bike), his body THROWN and tumbling, the snowmobile he rides, a
 * piste machine or a vehicle of the village's traffic — where, how fast,
 * how heavy, its front (a round body `r` m round its middle, or a box
 * `front` and `back` m along its heading and `half` across), what it is
 * and whether the player is on it or is it. */
type Hitter = {
  x: number;
  z: number;
  feet: number;
  vx: number;
  vz: number;
  heading: number;
  mass: number;
  r: number;
  front: number;
  back: number;
  half: number;
  kind: "skier" | "thrown" | "sled" | "groomer" | "car";
  ridden: boolean;
};

const freshHitter = (): Hitter => ({
  x: 0,
  z: 0,
  feet: 0,
  vx: 0,
  vz: 0,
  heading: 0,
  mass: 0,
  r: 0,
  front: 0,
  back: 0,
  half: 0,
  kind: "skier",
  ridden: false,
});

const pool: Hitter[] = [];
const vehicle = freshVehiclePose();

/** The hitter at `pool[n]`, made when the pool is short of it. */
function slot(n: number): Hitter {
  while (pool.length <= n) pool.push(freshHitter());
  const h = pool[n];
  h.r = h.front = h.back = h.half = 0;
  h.ridden = false;
  return h;
}

/** The player as a hitter into `pool[n]`: on his skis, thrown, or on the
 * snowmobile — whether he is one. */
function playerHitter(state: GameState, n: number): boolean {
  const c = state.skier;
  const s = state.sled;
  if (s?.rider) {
    const h = slot(n);
    h.x = s.x;
    h.z = s.z;
    h.feet = state.level.groundAt(s.x, s.z);
    h.vx = s.vx;
    h.vz = s.vz;
    h.heading = s.heading;
    h.mass = sledMass(totalMass(c.spec));
    h.front = h.back = SLED.length / 2;
    h.half = SLED.width / 2;
    h.kind = "sled";
    h.ridden = true;
    return true;
  }
  const b = c.thrown;
  if (b) {
    // His body tumbling, off his skis: a low round thing of his own weight.
    if (b.pin) return false;
    const h = slot(n);
    h.x = b.x;
    h.z = b.z;
    h.feet = b.y - 0.4;
    h.vx = b.vx;
    h.vz = b.vz;
    h.heading = Math.atan2(b.vx, b.vz);
    h.mass = c.spec.skierMass;
    h.r = K.foot.thrown;
    h.kind = "thrown";
    h.ridden = true;
    return true;
  }
  if (!onSkis(state)) return false;
  const h = slot(n);
  h.x = c.x;
  h.z = c.z;
  h.feet = c.y - c.spec.cogHeight;
  h.vx = c.vx;
  h.vz = c.vz;
  h.heading = c.heading;
  h.mass = totalMass(c.spec);
  h.r = K.foot.reach;
  h.kind = "skier";
  h.ridden = true;
  return true;
}

/** Whether a machine at `speed` m/s can give anyone the blow it strikes
 * at: the person's change of speed is never more than the closing speed
 * and its bounce. */
const canStrike = (speed: number): boolean => (1 + K.restitution) * Math.abs(speed) >= K.foot.blow;

/** EVERYTHING THAT STRIKES THE PEOPLE ON FOOT this step, into `pool`: the
 * player (on his skis, thrown, or on the snowmobile) and, every
 * `PERSON_HIT.foot.every` steps, every piste machine moving and every
 * vehicle of the traffic driving fast enough to. How many. */
function hittersOf(state: GameState): number {
  let n = playerHitter(state, 0) ? 1 : 0;
  // The machines only every few steps: each is longer than it goes in them.
  if (state.tick % K.foot.every !== 0) return n;
  for (const g of state.groomers ?? []) {
    if (!canStrike(g.speed)) continue;
    const h = slot(n++);
    h.x = g.x;
    h.z = g.z;
    h.feet = g.y;
    h.vx = Math.sin(g.heading) * g.speed;
    h.vz = Math.cos(g.heading) * g.speed;
    h.heading = g.heading;
    h.mass = GROOMER.mass;
    h.front = GROOMER.front;
    h.back = GROOMER.back;
    h.half = GROOMER.half;
    h.kind = "groomer";
    h.ridden = g.rider;
  }
  const plan = state.rules.traffic ? trafficOf(state.level) : null;
  for (let k = 0; k < (plan?.vehicles.length ?? 0); k++) {
    vehicleAt(plan!, k, state.t, vehicle);
    if (!vehicle.shown || !canStrike(vehicle.speed)) continue;
    const V = VEHICLES[vehicle.kind];
    const h = slot(n++);
    h.x = vehicle.x;
    h.z = vehicle.z;
    h.feet = vehicle.y;
    h.vx = Math.sin(vehicle.heading) * vehicle.speed;
    h.vz = Math.cos(vehicle.heading) * vehicle.speed;
    h.heading = vehicle.heading;
    h.mass = VEHICLE_MASS[vehicle.kind];
    h.front = h.back = V.length / 2;
    h.half = V.width / 2;
    h.kind = "car";
  }
  return n;
}

const contact = { nx: 0, nz: 0 };

/** Whether a person at (`px`, `pz`) of reach `pr` is within the hitter's
 * front: a round body, or a machine's box. The way out of it from the
 * hitter into `contact`. */
function touches(h: Hitter, px: number, pz: number, pr: number): boolean {
  const dx = px - h.x;
  const dz = pz - h.z;
  if (h.half === 0) {
    const d = hypot(dx, dz);
    if (d >= pr + h.r) return false;
    contact.nx = d > 1e-6 ? dx / d : Math.sin(h.heading);
    contact.nz = d > 1e-6 ? dz / d : Math.cos(h.heading);
    return true;
  }
  const fx = Math.sin(h.heading);
  const fz = Math.cos(h.heading);
  const u = dx * fx + dz * fz;
  const v = dx * fz - dz * fx;
  const ou = u - Math.max(-h.back, Math.min(h.front, u));
  const ov = v - Math.max(-h.half, Math.min(h.half, v));
  const out = hypot(ou, ov);
  if (out >= pr) return false;
  // Out of the machine square to its nearest face — met by its front, out
  // along its heading.
  const nu = out > 1e-6 ? ou / out : u >= 0 ? 1 : 0;
  const nv = out > 1e-6 ? ov / out : u >= 0 ? 0 : v >= 0 ? 1 : -1;
  contact.nx = nu * fx + nv * fz;
  contact.nz = nu * fz - nv * fx;
  return true;
}

const at: Vec3 = { x: 0, y: 0, z: 0 };
const STILL = { x: 0, y: 0, z: 0 };

/** Whether the person keyed `key` is down (not a body to meet). */
function isDown(foot: FootState | undefined, key: number): boolean {
  if (!foot) return false;
  for (const d of foot.down) if (d.key === key) return true;
  return false;
}

/** Whether a sampled patrolman's way still holds at `t`: past the moment
 * the patrol's work goes on differently for a machine taken
 * (`CrewTrack.sled`), only while his machine is as it was sampled. */
function trackHolds(r: RescueCall, tr: CrewTrack, t: number): boolean {
  const s = tr.sled;
  if (!s || t < s.sure) return true;
  return (r.sledsTaken?.[s.k] ?? null) === s.taken;
}

/** Whether hitter `h` is the player's own body, skis or snowmobile: struck
 * past the closing speed. */
const mine = (h: Hitter): boolean => h.kind === "skier" || h.kind === "thrown" || h.kind === "sled";

/** EVERYTHING THAT STRIKES, MEETING THE PEOPLE ON FOOT this step: for
 * each hitter the first one it strikes, struck — at most one a hitter a
 * step, as the crowd's. */
export function meetFoot(state: GameState, events: GameEvent[]): void {
  const call = state.foot?.call ?? null;
  const calls = state.rescue;
  if (!call && !calls?.some((r) => r.crew?.length)) return;
  const n = hittersOf(state);
  for (let k = 0; k < n; k++) meetAll(state, events, pool[k], call, calls);
}

/** Where each person of the call was last asked for, at which clock, and
 * whether he was out — so the hitters of one step place each person once. */
const placing = {
  call: null as FootCall | null,
  t: new Float64Array(0),
  out: new Uint8Array(0),
  xyz: new Float64Array(0),
};

/** Person `i` of `call` at `t` into `at`: whether he is out. */
function placed(state: GameState, call: FootCall, i: number, t: number): boolean {
  const m = placing;
  if (m.call !== call) {
    const n = call.people.length;
    m.call = call;
    m.t = new Float64Array(n).fill(NaN);
    m.out = new Uint8Array(n);
    m.xyz = new Float64Array(3 * n);
  }
  if (m.t[i] !== t) {
    m.t[i] = t;
    m.out[i] = footAt(state, call, call.people[i], t, at) ? 1 : 0;
    m.xyz[3 * i] = at.x;
    m.xyz[3 * i + 1] = at.y;
    m.xyz[3 * i + 2] = at.z;
    return m.out[i] === 1;
  }
  at.x = m.xyz[3 * i];
  at.y = m.xyz[3 * i + 1];
  at.z = m.xyz[3 * i + 2];
  return m.out[i] === 1;
}

/** One hitter against everyone on foot: the first it strikes, struck. */
function meetAll(
  state: GameState,
  events: GameEvent[],
  h: Hitter,
  call: FootCall | null,
  calls: readonly RescueCall[] | undefined,
): void {
  const fast = hypot(h.vx, h.vz);
  if (mine(h) ? fast < K.strike : !canStrike(fast)) return;
  const t = state.t;
  const near = 3 + Math.max(h.r, h.front, h.back);
  if (call) {
    for (let i = 0; i < call.people.length; i++) {
      const p = call.people[i];
      const far = p.rr + near;
      if (Math.abs(p.rx - h.x) > far || Math.abs(p.rz - h.z) > far) continue;
      if (isDown(state.foot, p.key) || !placed(state, call, i, t)) continue;
      if (meet(state, events, h, p.key, "civilian", p.body, p.heading)) return;
    }
  }
  for (let i = 0; i < (calls?.length ?? 0); i++) {
    const r = calls![i];
    // A machine stolen leaves its crew where they stood as it went.
    const when = r.stolen !== undefined ? Math.min(t, r.stolen) : t;
    const crew = r.crew ?? [];
    for (let j = 0; j < crew.length; j++) {
      const key = crewKey(i, j);
      if (isDown(state.foot, key) || !trackHolds(r, crew[j], t)) continue;
      if (!crewAt(state, crew[j], when, at)) continue;
      if (meet(state, events, h, key, "crew", crew[j].body, Math.atan2(-h.vx, -h.vz))) return;
    }
  }
}

/** THE PLAYER MEETING ONE PERSON stood at (x, y, z) whom another part
 * keeps — a soldier (`army-ground.ts`), `mass` kg with his kit: struck as
 * a person on foot is, past `PERSON_HIT.strike`, and taken over as one of
 * `FootState.down` under `key`. Whether he was. */
export function meetPerson(
  state: GameState,
  events: GameEvent[],
  key: number,
  who: FootDown["who"],
  body: CrowdBody,
  x: number,
  y: number,
  z: number,
  heading: number,
  mass?: number,
): boolean {
  if (!playerHitter(state, 0)) return false;
  const h = pool[0];
  if (hypot(h.vx, h.vz) < K.strike || isDown(state.foot, key)) return false;
  at.x = x;
  at.y = y;
  at.z = z;
  return meet(state, events, h, key, who, body, heading, mass);
}

/** One person stood at `at` met: struck if the hitter's front is on him
 * and closing hard enough — the player past the strike speed, a machine
 * past the blow it gives him. Whether he was. */
function meet(
  state: GameState,
  events: GameEvent[],
  h: Hitter,
  key: number,
  who: FootDown["who"],
  body: CrowdBody,
  heading: number,
  mass = CROWD_SIZE[body].mass,
): boolean {
  const height = K.height[body];
  if (at.y > h.feet + 1.6 || at.y + height < h.feet - 0.3) return false;
  if (!touches(h, at.x, at.z, footRadius(body))) return false;
  const nx = contact.nx;
  const nz = contact.nz;
  const closing = h.vx * nx + h.vz * nz;
  if (mine(h)) {
    if (closing < K.strike) return false;
  } else if (((1 + K.restitution) * closing) / (1 + mass / h.mass) < K.foot.blow) {
    return false;
  }
  strikeFoot(state, events, h, key, who, body, heading, nx, nz, closing, mass);
  return true;
}

/** What each hitter throws a person by (`CRASH.over`'s rows). */
const CAUSE: Record<Hitter["kind"], CrashCause> = {
  skier: "skier",
  thrown: "skier",
  sled: "sled",
  groomer: "groomer",
  car: "car",
};

/** A body thrown slowed by (`dvx`, `dvz`) m/s: every point's last place
 * moved on with it, as its velocity is the difference (`ragdoll.ts`). */
function slowBody(b: Thrown, dvx: number, dvz: number): void {
  for (let i = 0; i < b.last.length; i += 3) {
    b.last[i] += dvx * dt;
    b.last[i + 2] += dvz * dt;
  }
  b.vx -= dvx;
  b.vz -= dvz;
}

/** THE COLLISION with a person on foot: the exchange at the two masses,
 * the person taken over onto a ragdoll of his own, the meeting filed and
 * reported, and the hitter slowed — the skier thrown past the crowd's own
 * threshold, his body thrown slowed by it, the snowmobile only slowed; a
 * piste machine and a car never notice. */
function strikeFoot(
  state: GameState,
  events: GameEvent[],
  h: Hitter,
  key: number,
  who: FootDown["who"],
  body: CrowdBody,
  heading: number,
  nx: number,
  nz: number,
  closing: number,
  mass: number,
): void {
  const c = state.skier;
  const ex = exchangeOf(state, h.mass, mass, closing);
  const height = K.height[body];
  const cause = CAUSE[h.kind];
  const said: Omit<StruckPerson, "dosed"> = {
    amateur: -1,
    foot: key,
    who,
    t: state.t,
    x: (h.x + at.x) / 2,
    y: at.y + height * 0.55,
    z: (h.z + at.z) / 2,
    speed: closing,
    taken: ex.taken,
    given: ex.given,
    height,
    thrown: false,
    killed: ex.killed,
    injured: ex.injured,
    crush: ex.crush,
    ...(h.kind === "thrown" || h.kind === "groomer" || h.kind === "car" ? { by: h.kind } : {}),
    ...(h.ridden ? {} : { away: true as const }),
  };
  // The player's body is struck only by what it met itself: a machine's
  // hood, cab or bodywork takes the blow, not its rider's body.
  const hit: StruckPerson = { ...said, dosed: !(h.kind === "skier" || h.kind === "thrown") };
  const v = { x: ex.given * nx, y: ex.given * K.lift, z: ex.given * nz };
  // Flown off the hitter's front: turned onto the side it struck from.
  const across = nx * Math.cos(heading) - nz * Math.sin(heading);
  const thrown = throwOf(
    cause,
    fromEuler(heading, 0, 0),
    at.x,
    at.y + SKIS.cogHeight,
    at.z,
    v,
    heading,
    across >= 0 ? 1 : -1,
    STILL,
  );
  const player: Vec3 = { x: h.vx - ex.taken * nx, y: 0, z: h.vz - ex.taken * nz };
  if (h.kind === "sled") {
    const s = state.sled!;
    s.vx = player.x;
    s.vz = player.z;
  } else if (h.kind === "thrown") {
    slowBody(c.thrown!, ex.taken * nx, ex.taken * nz);
  } else if (h.kind === "skier") {
    hit.thrown = ex.taken >= CROWD.floors * crashLimit(c, "treeShoulder");
  }
  const foot = (state.foot ??= { call: null, down: [], struck: [] });
  foot.struck.push(hit);
  foot.down.push({
    key,
    who,
    body,
    thrown,
    hit,
    cause,
    dead: ex.killed,
    injured: ex.injured,
    crush: ex.crush,
    until: ex.killed || ex.injured ? Infinity : state.t + K.foot.back,
    settled: false,
  });
  events.push({ kind: "struck", ...said, thrown: hit.thrown });
  if (h.kind !== "skier") return;
  if (hit.thrown) {
    throwRider(state, "skier", { x: player.x, y: c.vy, z: player.z }, events);
  } else {
    c.vx = player.x;
    c.vz = player.z;
  }
}

/** THE PEOPLE DOWN, stepped: each body tumbling until it lies still, and
 * a person knocked and not hurt let go to his plan once he has had the
 * time to get up and walk back. */
export function stepFoot(state: GameState): void {
  const foot = state.foot;
  if (!foot?.down.length) return;
  for (let k = foot.down.length - 1; k >= 0; k--) {
    const d = foot.down[k];
    if (state.t >= d.until) {
      foot.down.splice(k, 1);
      continue;
    }
    if (d.settled) continue;
    d.thrown.t += dt;
    stepRagdoll(state, d.thrown);
    if (crashOver(d.thrown)) d.settled = true;
  }
}

/** The person down keyed `key`, if the engine has him. */
export function footDown(state: GameState, key: number): FootDown | undefined {
  for (const d of state.foot?.down ?? []) if (d.key === key) return d;
  return undefined;
}

/** EVERY MEETING WITH A PERSON this run — the crowd's amateurs and the
 * people on foot — for the app's blood and broken bodies. */
export function allStruck(state: GameState): StruckPerson[] {
  return [...(state.crowd?.struck ?? []), ...(state.foot?.struck ?? [])];
}
