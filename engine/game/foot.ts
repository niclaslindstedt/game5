// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PEOPLE ON FOOT AS BODIES — the free ride's civilians (the lift crew,
// the patrol, the guests walking the base, the terrace, the children at
// play: `pwa/src/game/civilian-plan.ts`) and the crews of the air
// ambulance and the police (`rescue-call.ts`), met by the skier at speed.
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
// (`skyHourAt`). A crew member is a TRACK sampled off his call's plan
// (`CrewTrack`, carried on the `RescueCall`). Nothing is dealt here, so a
// replay handed the same call (`recipeOf` carries it) meets the same
// people at the same places; the plan stays one layout, the app's, drawn
// by its views. On a SNOWMOBILE the machine strikes: its mass with its
// rider's, so a man is hit by some 300 kg and the machine barely slows.
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
import { onSkis } from "./groomer.ts";
import { exchangeOf, type StruckPerson } from "./person-hit.ts";
import { stepRagdoll } from "./ragdoll.ts";
import type { CrashCause, GameEvent, GameState } from "./state.ts";
import type { Thrown } from "./thrown-state.ts";

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
 * faces) — or the ROUTE he walks, `offset` s into it at the run's 0 — and,
 * when he is out only some hours, his role's share by the hour and his own
 * keenness (out while it is under the share). `rx`, `rz`, `rr`: a circle
 * round everywhere he goes, m, for the cheap cull. */
export type FootPerson = {
  key: number;
  body: CrowdBody;
  x: number;
  y: number;
  z: number;
  heading: number;
  route?: Route;
  offset?: number;
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
 * z, m — NaN while he is not on the snow (in the cabin, not yet out). */
export type CrewTrack = { body: CrowdBody; t0: number; dt: number; xz: readonly number[] };

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

/** WHAT STRIKES THEM this step: the skier on his skis (or a board, or the
 * bike), or the snowmobile he rides — where, how fast, how heavy, how far
 * its front reaches round it — or null. */
type Hitter = {
  x: number;
  z: number;
  feet: number;
  vx: number;
  vz: number;
  heading: number;
  mass: number;
  sled: boolean;
};

const hitter: Hitter = { x: 0, z: 0, feet: 0, vx: 0, vz: 0, heading: 0, mass: 0, sled: false };

function hitterOf(state: GameState): Hitter | null {
  const c = state.skier;
  const s = state.sled;
  if (s?.rider) {
    hitter.x = s.x;
    hitter.z = s.z;
    hitter.feet = state.level.groundAt(s.x, s.z);
    hitter.vx = s.vx;
    hitter.vz = s.vz;
    hitter.heading = s.heading;
    hitter.mass = sledMass(totalMass(c.spec));
    hitter.sled = true;
    return hitter;
  }
  if (!onSkis(state)) return null;
  hitter.x = c.x;
  hitter.z = c.z;
  hitter.feet = c.y - c.spec.cogHeight;
  hitter.vx = c.vx;
  hitter.vz = c.vz;
  hitter.heading = c.heading;
  hitter.mass = totalMass(c.spec);
  hitter.sled = false;
  return hitter;
}

const contact = { nx: 0, nz: 0 };

/** Whether a person at (`px`, `pz`) of reach `pr` is within the hitter's
 * front: a round skier, or the machine's box. The way out of it from the
 * hitter into `contact`. */
function touches(h: Hitter, px: number, pz: number, pr: number): boolean {
  const dx = px - h.x;
  const dz = pz - h.z;
  if (!h.sled) {
    const d = hypot(dx, dz);
    if (d >= pr + K.foot.reach) return false;
    contact.nx = d > 1e-6 ? dx / d : Math.sin(h.heading);
    contact.nz = d > 1e-6 ? dz / d : Math.cos(h.heading);
    return true;
  }
  const fx = Math.sin(h.heading);
  const fz = Math.cos(h.heading);
  const u = dx * fx + dz * fz;
  const v = dx * fz - dz * fx;
  const hl = SLED.length / 2;
  const hw = SLED.width / 2;
  const ou = u - Math.max(-hl, Math.min(hl, u));
  const ov = v - Math.max(-hw, Math.min(hw, v));
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

/** THE SKIER (or his machine) MEETING THE PEOPLE ON FOOT this step: the
 * first one he strikes past `PERSON_HIT.strike`, struck — at most one a
 * step, as the crowd's. */
export function meetFoot(state: GameState, events: GameEvent[]): void {
  const call = state.foot?.call ?? null;
  const calls = state.rescue;
  if (!call && !calls?.some((r) => r.crew?.length)) return;
  const h = hitterOf(state);
  if (!h) return;
  const fast = hypot(h.vx, h.vz);
  if (fast < K.strike) return;
  const t = state.t;
  const near = 3 + (h.sled ? SLED.length : 0);
  if (call) {
    for (const p of call.people) {
      const far = p.rr + near;
      if (Math.abs(p.rx - h.x) > far || Math.abs(p.rz - h.z) > far) continue;
      if (isDown(state.foot, p.key) || !footAt(state, call, p, t, at)) continue;
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
      if (isDown(state.foot, key) || !crewAt(state, crew[j], when, at)) continue;
      if (meet(state, events, h, key, "crew", crew[j].body, Math.atan2(-h.vx, -h.vz))) return;
    }
  }
}

/** THE SKIER (or his machine) MEETING ONE PERSON stood at (x, y, z) whom
 * another part keeps — a soldier (`army-ground.ts`), `mass` kg with his
 * kit: struck as a person on foot is, past `PERSON_HIT.strike`, and
 * taken over as one of `FootState.down` under `key`. Whether he was. */
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
  const h = hitterOf(state);
  if (!h || hypot(h.vx, h.vz) < K.strike || isDown(state.foot, key)) return false;
  at.x = x;
  at.y = y;
  at.z = z;
  return meet(state, events, h, key, who, body, heading, mass);
}

/** One person stood at `at` met: struck if the hitter's front is on him
 * and closing past the strike. Whether he was. */
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
  if (closing < K.strike) return false;
  strikeFoot(state, events, h, key, who, body, heading, nx, nz, closing, mass);
  return true;
}

/** THE COLLISION with a person on foot: the exchange at the two masses,
 * the person taken over onto a ragdoll of his own, the meeting filed and
 * reported, and the hitter slowed — the skier thrown past the crowd's own
 * threshold, the machine only slowed. */
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
  };
  // The machine's hood and bars take the blow, not the rider's body.
  const hit: StruckPerson = { ...said, dosed: h.sled };
  const v = { x: ex.given * nx, y: ex.given * K.lift, z: ex.given * nz };
  // Flown off the hitter's front: turned onto the side it struck from.
  const across = nx * Math.cos(heading) - nz * Math.sin(heading);
  const thrown = throwOf(
    h.sled ? "sled" : "skier",
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
  if (h.sled) {
    const s = state.sled!;
    s.vx = player.x;
    s.vz = player.z;
  } else {
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
    cause: h.sled ? "sled" : "skier",
    dead: ex.killed,
    injured: ex.injured,
    crush: ex.crush,
    until: ex.killed || ex.injured ? Infinity : state.t + K.foot.back,
    settled: false,
  });
  events.push({ kind: "struck", ...said, thrown: hit.thrown });
  if (h.sled) return;
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
