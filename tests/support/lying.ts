// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BODY LYING ON THE SNOW GONE OVER, staged (`engine/game/lying.ts`): on
// the free ride of seed 3, an amateur or a civilian laid on the snow a few
// metres down the player's line — dead, injured or knocked and about to get
// up — his body thrown, come to rest, and turned to lie ACROSS the line or
// ALONG it; then the player on his skis or the snowmobile he rides driven
// over him at a speed, or a piste machine driven over him, and the run
// stepped on. The same run without the body beside it says what the body
// took off the rider. `tests/lying_bodies_test.ts` holds it and
// `make body-hits ARGS=--who=lying` prints its rows.

import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import {
  bodyThrown,
  centreOf,
  createGame,
  meetLying,
  standSkier,
  standSled,
  stepFoot,
  stepRagdoll,
  severityOf,
  step,
  NEUTRAL_INPUT,
  RAGDOLL,
  type Amateur,
  type CrowdBody,
  type FootDown,
  type GameEvent,
  type GameState,
  type Thrown,
} from "@engine";

import { groomerAt, HIT_SEED } from "./body-hits.ts";
import { levelFor } from "./levels.ts";

/** Who lies there, how, and what goes over him. */
export type LyingWho = "amateur" | "civilian";
export type LyingAs = "dead" | "injured" | "knocked";
export type LyingRider = "skis" | "sled" | "groomer";
/** His spine across the line with his middle on it, along it, or across
 * it with his knees on it (his legs under the tips). */
export type LyingLie = "across" | "along" | "legs";

export type LyingCase = {
  who: LyingWho;
  as: LyingAs;
  rider: LyingRider;
  kmh: number;
  gore: boolean;
  lie?: LyingLie;
  body?: CrowdBody;
};

/** How far down the line he lies, m. */
const AHEAD = 4;

/** A body thrown at (`x`, `z`), come to rest, then turned to lie with its
 * spine at `yaw` (0: along +z) and its middle — or its knees — moved to
 * (`x`, `z`). */
function laidBody(state: GameState, x: number, z: number, yaw: number, knees: boolean): Thrown {
  const y = state.level.groundAt(x, z);
  const b = bodyThrown(
    "skier",
    fromEuler(0, 0, 0),
    x,
    y + 1,
    z,
    { x: 0, y: 0, z: 2.5 },
    { x: 4, y: 0, z: 0 },
    0,
  );
  for (let i = 0; i < 6 * 120; i++) {
    b.t += 1 / 120;
    stepRagdoll(state, b);
  }
  const P = b.points;
  const hip = mid(P, RAGDOLL.hipL, RAGDOLL.hipR);
  const sh = mid(P, RAGDOLL.shoulderL, RAGDOLL.shoulderR);
  const turn = yaw - Math.atan2(sh.x - hip.x, sh.z - hip.z);
  const c = centreOf(P);
  if (knees) {
    const k = mid(P, RAGDOLL.kneeL, RAGDOLL.kneeR);
    c.x = k.x;
    c.z = k.z;
  }
  const cs = Math.cos(turn);
  const sn = Math.sin(turn);
  for (let i = 0; i < P.length; i += 3) {
    const dx = P[i] - c.x;
    const dz = P[i + 2] - c.z;
    const nx = x + dx * cs + dz * sn;
    const nz = z - dx * sn + dz * cs;
    const lift = P[i + 1] - state.level.groundAt(P[i], P[i + 2]);
    P[i] = nx;
    P[i + 2] = nz;
    P[i + 1] = state.level.groundAt(nx, nz) + lift;
    b.last[i] = P[i];
    b.last[i + 1] = P[i + 1];
    b.last[i + 2] = P[i + 2];
  }
  for (let i = 0; i < 60; i++) {
    b.t += 1 / 120;
    stepRagdoll(state, b);
  }
  const m = centreOf(P);
  b.x = m.x;
  b.y = m.y;
  b.z = m.z;
  b.vx = b.vy = b.vz = 0;
  b.heading = yaw;
  return b;
}

function mid(P: readonly number[], i: number, j: number): { x: number; z: number } {
  return { x: (P[3 * i] + P[3 * j]) / 2, z: (P[3 * i + 2] + P[3 * j + 2]) / 2 };
}

/** The run staged: the rider set going down +z at the speed, the body (or
 * none: the run to measure him against) laid ahead of him. */
export function stageLying(
  k: LyingCase,
  withBody = true,
): {
  state: GameState;
  amateur: Amateur | null;
  down: FootDown | null;
} {
  const state = createGame({
    level: levelFor(HIT_SEED),
    seed: HIT_SEED,
    mode: "free",
    quiet: true,
    crowd: k.who === "amateur" ? 30 : 0,
    gore: k.gore,
    ...(k.rider === "sled" ? { sled: true } : {}),
  });
  const c = state.skier;
  const body = k.body ?? "man";
  for (const o of state.crowd?.amateurs ?? []) o.mode = "lift";
  // His line: the way he faces at the start, down the spawn's piste.
  const h0 = c.heading;
  const fx = Math.sin(h0);
  const fz = Math.cos(h0);
  const ox = c.x;
  const oz = c.z;
  const ahead = AHEAD + (k.rider === "groomer" ? 6 : 0);
  const x = ox + fx * ahead;
  const z = oz + fz * ahead;
  let amateur: Amateur | null = null;
  let down: FootDown | null = null;
  if (withBody) {
    const lie = k.lie ?? "across";
    const b = laidBody(state, x, z, h0 + (lie === "along" ? 0 : Math.PI / 2), lie === "legs");
    const dead = k.as === "dead";
    const injured = k.as === "injured";
    if (k.who === "amateur") {
      const a = state.crowd!.amateurs[0];
      a.mode = "down";
      a.body = body;
      a.board = null;
      a.thrown = b;
      a.rise = 0;
      a.timer = 30;
      a.x = b.x;
      a.z = b.z;
      a.y = state.level.groundAt(b.x, b.z);
      a.vx = a.vz = a.speed = 0;
      if (dead && k.gore) a.dead = true;
      if (injured && k.gore) a.injured = true;
      amateur = a;
    } else {
      const hurt = k.gore && (dead || injured);
      down = {
        key: 7,
        who: "civilian",
        body,
        thrown: b,
        hit: {
          amateur: -1,
          foot: 7,
          who: "civilian",
          t: -1,
          x: b.x,
          y: b.y,
          z: b.z,
          speed: 0,
          taken: 0,
          given: 0,
          height: 1.8,
          thrown: false,
          killed: dead && k.gore,
          injured: injured && k.gore,
          crush: 0,
          dosed: true,
        },
        cause: "skier",
        dead: dead && k.gore,
        injured: injured && k.gore,
        crush: 0,
        until: hurt ? Infinity : 60,
        settled: true,
      };
      state.foot = { call: null, down: [down], struck: [] };
    }
  }
  const v = k.kmh / 3.6;
  if (k.rider === "sled") {
    const s = state.sled!;
    standSled(state, s, ox, oz, h0);
    s.vx = fx * v;
    s.vz = fz * v;
    s.treadSpeed = v;
  } else if (k.rider === "groomer") {
    // The player stood out of its way; the machine driven at the body.
    standSkier(state, ox - fz * 25, oz + fx * 25, h0);
    const g = groomerAt(ox, state.level.groundAt(ox, oz), oz, v);
    g.heading = h0;
    state.groomers = [g];
  } else {
    standSkier(state, ox, oz, h0);
    c.vx = fx * v;
    c.vz = fz * v;
  }
  return { state, amateur, down };
}

/** ONE ROW: what the pass did on both sides. */
export type LyingRow = LyingCase & {
  /** The passes over him (the struck events marked lying). */
  passes: number;
  /** The rider: thrown, the speed the first pass took off him (its
   * `taken`), km/h, and what he had lost against the same run without the
   * body a quarter of a second after it (left out once thrown), km/h; his
   * worst injury's AIS and his severity score. */
  thrown: boolean;
  taken: number;
  lost: number;
  worst: number;
  iss: number;
  /** The body: how far it was pushed, m, and what it is after. */
  moved: number;
  dead: boolean;
  injured: boolean;
  crush: number;
};

/** The speed a rider has, m/s. */
function riderSpeed(state: GameState, rider: LyingRider): number {
  if (rider === "sled") return Math.hypot(state.sled!.vx, state.sled!.vz);
  if (rider === "groomer") return state.groomers![0].speed;
  const c = state.skier;
  return c.thrown ? Math.hypot(c.thrown.vx, c.thrown.vz) : Math.hypot(c.vx, c.vz);
}

/** A run stepped once: the whole game, or — a piste machine driven at the
 * body — the machine moved straight on at its speed and the bodies met and
 * stepped alone, its own driving never asked. The events of the step. */
function stepOnce(state: GameState, rider: LyingRider): readonly GameEvent[] {
  if (rider !== "groomer") return step(state, NEUTRAL_INPUT).events;
  const g = state.groomers![0];
  const dt = 1 / 120;
  state.t += dt;
  state.tick += 1;
  g.x += Math.sin(g.heading) * g.speed * dt;
  g.z += Math.cos(g.heading) * g.speed * dt;
  g.y = state.level.groundAt(g.x, g.z);
  const events: GameEvent[] = [];
  meetLying(state, events);
  stepFoot(state);
  return events;
}

/** The case run `seconds` on, beside the run without the body (`control`;
 * without it `lost` is NaN). */
export function lyingRow(
  k: LyingCase,
  seconds = k.rider === "groomer" ? 4 : 1,
  control = true,
): LyingRow {
  const one = stageLying(k);
  const two = control ? stageLying(k, false) : null;
  const b = (one.amateur?.thrown ?? one.down!.thrown)!;
  const from = centreOf(b.points);
  let passes = 0;
  let thrown = false;
  let taken = 0;
  let lost = NaN;
  let first = -1;
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    const events = stepOnce(one.state, k.rider);
    if (two) stepOnce(two.state, k.rider);
    for (const e of events) {
      if (e.kind !== "struck" || !e.lying) continue;
      if (passes++ === 0) {
        first = i;
        taken = e.taken * 3.6;
      }
      if (e.thrown) thrown = true;
    }
    if (two && first >= 0 && i === first + 30 && !thrown) {
      lost = (riderSpeed(two.state, k.rider) - riderSpeed(one.state, k.rider)) * 3.6;
    }
  }
  const to = centreOf(b.points);
  const a = one.amateur;
  const d = one.down;
  return {
    ...k,
    passes,
    thrown,
    taken,
    lost,
    worst: Math.max(0, ...one.state.skier.body.injuries.map((h) => h.ais)),
    iss: severityOf(one.state.skier.body),
    moved: Math.hypot(to.x - from.x, to.z - from.z),
    dead: a ? !!a.dead : !!d?.dead,
    injured: a ? !!a.injured : !!d?.injured,
    crush: a ? (a.crush ?? 0) : (d?.crush ?? 0),
  };
}
