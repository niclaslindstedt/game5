// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHO KNOCKS A CIVILIAN — the people on foot (`civilian-plan.ts`, and the
// village's dog walkers, `dog-walk-pose.ts`) made SOLID to everything that
// moves among them: the skier on his skis (or thrown, his body tumbling
// into them), the snowmobile, the piste machines, the village's cars, bus
// and bicycles, and another person already knocked flying into them. Every
// frame each of those is a HITTER — a round body or a box, its velocity, its
// mass and how high its front strikes — swept from where it stood a frame
// ago, and a person it overlaps while closing on him is struck: the change
// of velocity a collision of the two masses gives him (`strike`, as two
// bodies meeting with a little bounce, `KNOCK_HIT.bounce`, and a share of the
// slide across carried by friction), and the rest is his body's
// (`civilian-knock.ts`). Three-free, so the suite reads it.
//
// PRESENTATION ONLY, as the civilians are: the knocks are kept here, beside
// the plan, and step the ragdoll on the engine's clock; nothing is written
// to the game's state, so no digest moves and the hitter never notices the
// person it went through — the skier, the machines and the traffic are the
// engine's and keep the line the engine gives them.

import {
  GROOMER,
  VEHICLES,
  TUNING,
  centreOf,
  freshVehiclePose,
  onSkis,
  trafficOf,
  vehicleAt,
  type CrowdBody,
  type GameState,
  type Level,
  type VehicleKind,
} from "@engine";

import {
  civilianAt,
  civilianPlanFor,
  freshCivilianPose,
  type CivilianPose,
} from "./civilian-plan.ts";
import { knockOf, startTarget, stepKnock, strike, type Knock } from "./civilian-knock.ts";
import { CROWD_LOOKS } from "./crowd-rig.ts";
import { dogWalkerAt } from "./dog-walk-pose.ts";
import { dogPlanFor } from "./dog-walk.ts";

const dt = TUNING.dt;

/** THE HITS' NUMBERS. */
export const KNOCK_HIT = {
  /** A person's reach round his middle, m, at the reference man's height
   * (a child's is less), and his mass there, kg (a child's far less: as
   * the cube of his height). */
  radius: 0.26,
  mass: 78,
  /** How much two bodies bounce apart (a body is soft), and the share of
   * the blow across the slide friction carries. */
  bounce: 0.15,
  grip: 0.3,
  /** The skier: his reach, height, mass with his skis, and how high he
   * strikes (the hip and the shoulder), m; the throw a skier gives. */
  skier: { r: 0.36, height: 1.6, mass: 86, high: 1.05, lift: 0.22 },
  /** The skier thrown: his body a low round thing tumbling. */
  thrown: { r: 0.5, height: 0.6, mass: 80, high: 0.35, lift: 0.15 },
  /** The snowmobile: its footprint, m, its mass with its rider, kg, and
   * its front — a low hood, so a body is scooped up over it. */
  sled: { length: 3.3, width: 1.15, height: 1.3, mass: 385, high: 0.6, lift: 0.4 },
  /** The piste machine: its blade a wall; a body is pushed ahead of it. */
  groomer: { height: 2.9, high: 0.8, lift: 0.18 },
  /** The village's vehicles: a class's mass, kg, and its front's height and
   * throw (a car's bonnet scoops; the bus's flat front projects). */
  vehicle: {
    hatch: { mass: 1150, high: 0.55, lift: 0.32 },
    estate: { mass: 1450, high: 0.6, lift: 0.3 },
    suv: { mass: 1950, high: 0.8, lift: 0.24 },
    van: { mass: 2200, high: 0.95, lift: 0.16 },
    bus: { mass: 12500, high: 1.1, lift: 0.1 },
    bike: { mass: 95, high: 0.7, lift: 0.2 },
  } satisfies Record<VehicleKind, { mass: number; high: number; lift: number }>,
  /** A knocked person is a hitter himself while this fast, m/s. */
  chain: 0.6,
  /** Sweep the hitters in steps of at most this, m. */
  sweep: 0.15,
  /** At most this many people knocked at a time; past it a new blow is
   * let pass. */
  most: 24,
} as const;

/** SOMETHING THAT HITS: a round body (`r`) or a box (`front` and `back`
 * along its heading, `half` across), from `y` up `height` m, going at
 * (`vx`, `vz`), of `mass` kg, striking at `high` m and throwing up `lift`
 * of the blow; `from` a knocked person's key (he cannot hit himself). */
export type Hitter = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  r: number;
  front: number;
  back: number;
  half: number;
  height: number;
  mass: number;
  high: number;
  lift: number;
  from: number;
};

/** EVERYONE ON FOOT a free ride's map holds: the plan's people, then the
 * dog walkers (each household's owner and child), each with where he is at
 * a moment and the circle he stays within (his round, or his place). */
export type Person = {
  key: number;
  body: CrowdBody;
  skis: boolean;
  /** Where he lives, for the cheap cull: a circle round all his round. */
  rx: number;
  rz: number;
  rr: number;
  at: (t: number, out: CivilianPose) => CivilianPose;
};

export function peopleOf(level: Level, hour: number): Person[] {
  const plan = civilianPlanFor(level);
  const out: Person[] = plan.people.map((c, i) => {
    let rx = c.home.x;
    let rz = c.home.z;
    let rr = 0;
    if (c.leg) {
      const xs = c.leg.points.map((p) => p.x);
      const zs = c.leg.points.map((p) => p.z);
      rx = (Math.min(...xs) + Math.max(...xs)) / 2;
      rz = (Math.min(...zs) + Math.max(...zs)) / 2;
      rr = Math.max(...c.leg.points.map((p) => Math.hypot(p.x - rx, p.z - rz)));
    }
    return {
      key: i,
      body: c.body,
      skis: c.skis,
      rx,
      rz,
      rr: rr + 2,
      at: (t, o) => civilianAt(plan, i, t, hour, o),
    };
  });
  const dogs = dogPlanFor(level);
  for (const hh of dogs?.households ?? []) {
    const members: [0 | 1, CrowdBody | null][] = [
      [0, hh.walker],
      [1, hh.child],
    ];
    for (const [member, body] of members) {
      if (!body) continue;
      out.push({
        key: out.length,
        body,
        skis: false,
        // A dog walk goes round the village: no cull but the village's.
        rx: 0,
        rz: 0,
        rr: Infinity,
        at: (t, o) => dogWalkerAt(dogs!, hh.id, member, t, hour, o),
      });
    }
  }
  return out;
}

/** A person's reach and mass, by his height. */
export function personOf(body: CrowdBody): { r: number; mass: number; height: number } {
  const h = CROWD_LOOKS[body].height;
  const k = h / 1.8;
  return { r: KNOCK_HIT.radius * Math.sqrt(k), mass: KNOCK_HIT.mass * k ** 3, height: h };
}

/** The knocks a view keeps: every person knocked, by key, and the engine's
 * clock they were last stepped to. */
export type Knocks = { map: Map<number, Knock>; t: number };

export function createKnocks(): Knocks {
  return { map: new Map(), t: NaN };
}

const round = (h: Partial<Hitter>): Hitter => ({
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vz: 0,
  heading: 0,
  r: 0,
  front: 0,
  back: 0,
  half: 0,
  height: 1,
  mass: 80,
  high: 1,
  lift: 0,
  from: -1,
  ...h,
});

const vehicle = freshVehiclePose();

/** EVERYTHING THAT HITS this frame, into `out`. */
export function hittersOf(state: GameState, knocks: Knocks, out: Hitter[]): Hitter[] {
  out.length = 0;
  const c = state.skier;
  if (c.thrown) {
    const b = c.thrown;
    const H = KNOCK_HIT.thrown;
    out.push(round({ x: b.x, y: b.y - 0.3, z: b.z, vx: b.vx, vz: b.vz, ...H }));
  } else if (onSkis(state)) {
    const H = KNOCK_HIT.skier;
    out.push(round({ x: c.x, y: c.y - 0.2, z: c.z, vx: c.vx, vz: c.vz, heading: c.heading, ...H }));
  }
  const sled = state.sled;
  if (sled && sled.speed > 0.3) {
    const S = KNOCK_HIT.sled;
    out.push(
      round({
        x: sled.x,
        y: state.level.groundAt(sled.x, sled.z),
        z: sled.z,
        vx: sled.vx,
        vz: sled.vz,
        heading: sled.heading,
        front: S.length / 2,
        back: S.length / 2,
        half: S.width / 2,
        height: S.height,
        mass: S.mass,
        high: S.high,
        lift: S.lift,
      }),
    );
  }
  for (const g of state.groomers ?? []) {
    if (Math.abs(g.speed) < 0.05) continue;
    const G = KNOCK_HIT.groomer;
    out.push(
      round({
        x: g.x,
        y: g.y,
        z: g.z,
        vx: Math.sin(g.heading) * g.speed,
        vz: Math.cos(g.heading) * g.speed,
        heading: g.heading,
        front: GROOMER.front,
        back: GROOMER.back,
        half: GROOMER.half,
        height: G.height,
        mass: GROOMER.mass,
        high: G.high,
        lift: G.lift,
      }),
    );
  }
  const plan = state.rules.traffic ? trafficOf(state.level) : null;
  if (plan) {
    for (let k = 0; k < plan.vehicles.length; k++) {
      vehicleAt(plan, k, state.t, vehicle);
      if (!vehicle.shown || Math.abs(vehicle.speed) < 0.1) continue;
      const V = VEHICLES[vehicle.kind];
      const H = KNOCK_HIT.vehicle[vehicle.kind];
      out.push(
        round({
          x: vehicle.x,
          y: vehicle.y,
          z: vehicle.z,
          vx: Math.sin(vehicle.heading) * vehicle.speed,
          vz: Math.cos(vehicle.heading) * vehicle.speed,
          heading: vehicle.heading,
          front: V.length / 2,
          back: V.length / 2,
          half: V.width / 2,
          height: V.height,
          mass: H.mass,
          high: H.high,
          lift: H.lift,
        }),
      );
    }
  }
  // A person knocked into the next: on his feet staggering, or his body
  // flying or sliding.
  for (const [key, k] of knocks.map) {
    if (k.phase === "back" || k.phase === "rise") continue;
    const p = personOf(k.body);
    if (k.phase === "stagger" && !k.falling) {
      if (Math.hypot(k.vx, k.vz) < KNOCK_HIT.chain) continue;
      out.push(
        round({
          x: k.cx,
          y: state.level.groundAt(k.cx, k.cz),
          z: k.cz,
          vx: k.vx,
          vz: k.vz,
          r: p.r,
          height: p.height,
          mass: p.mass,
          high: 1.1,
          lift: 0,
          from: key,
        }),
      );
      continue;
    }
    const b = k.rag;
    if (Math.hypot(b.vx, b.vz) < KNOCK_HIT.chain * 2) continue;
    out.push(
      round({
        x: b.x,
        y: b.y - 0.4,
        z: b.z,
        vx: b.vx,
        vz: b.vz,
        r: p.r * 1.6,
        height: 1,
        mass: p.mass,
        high: 0.5,
        lift: 0.1,
        from: key,
      }),
    );
  }
  return out;
}

const contact = { nx: 0, nz: 0 };

/** Whether a person at (`px`, `pz`) of reach `pr` overlaps hitter `h`
 * stood at (`hx`, `hz`); the way out of it into `contact`. */
function overlaps(h: Hitter, hx: number, hz: number, px: number, pz: number, pr: number): boolean {
  const dx = px - hx;
  const dz = pz - hz;
  if (h.front === 0) {
    const d = Math.hypot(dx, dz);
    if (d >= h.r + pr) return false;
    contact.nx = d > 1e-6 ? dx / d : 1;
    contact.nz = d > 1e-6 ? dz / d : 0;
    return true;
  }
  const fx = Math.sin(h.heading);
  const fz = Math.cos(h.heading);
  const u = dx * fx + dz * fz;
  const v = dx * fz - dz * fx;
  const cu = Math.max(-h.back, Math.min(h.front, u));
  const cv = Math.max(-h.half, Math.min(h.half, v));
  const ou = u - cu;
  const ov = v - cv;
  const out = Math.hypot(ou, ov);
  if (out >= pr) return false;
  let nu: number;
  let nv: number;
  if (out > 1e-6) {
    nu = ou / out;
    nv = ov / out;
  } else {
    // Inside: out through the nearest face.
    const toFront = h.front - u;
    const toBack = u + h.back;
    const toSide = h.half - Math.abs(v);
    if (toSide < Math.min(toFront, toBack)) {
      nu = 0;
      nv = v >= 0 ? 1 : -1;
    } else {
      nu = toFront < toBack ? 1 : -1;
      nv = 0;
    }
  }
  // (u, v) to the world: u along (fx, fz), v along (fz, −fx).
  contact.nx = nu * fx + nv * fz;
  contact.nz = nu * fz - nv * fx;
  return true;
}

const pose = freshCivilianPose();
const hitters: Hitter[] = [];

/**
 * THE KNOCKS THIS FRAME: everything that hits (`hittersOf`) swept from a
 * frame ago against everyone it nears, then every person knocked stepped
 * on the engine's clock to `state.t`. A clock that went back (a restart)
 * forgets them all.
 */
export function updateKnocks(knocks: Knocks, state: GameState, people: readonly Person[]): void {
  const t = state.t;
  if (!(t >= knocks.t)) {
    knocks.map.clear();
    knocks.t = t;
  }
  const span = Math.min(0.2, t - knocks.t);
  collide(knocks, state, people, hittersOf(state, knocks, hitters), span);
  stepKnocks(knocks, state, people, Math.round(span / dt));
  if (span <= 0) knocks.t = t;
}

/** Every person knocked stepped `steps` of the engine's: back home, or on. */
export function stepKnocks(
  knocks: Knocks,
  state: GameState,
  people: readonly Person[],
  steps: number,
): void {
  for (let s = 0; s < steps; s++) {
    const at = knocks.t + (s + 1) * dt;
    for (const [key, k] of knocks.map) {
      let home: { x: number; z: number } | null = null;
      if (k.phase === "back") {
        people[key].at(at, pose);
        home = pose.shown ? { x: pose.x, z: pose.z } : null;
      }
      if (!stepKnock(state, k, home)) knocks.map.delete(key);
    }
  }
  knocks.t += steps * dt;
}

/**
 * THE BLOWS: each of `hitters`, swept back over the last `span` s from
 * where it stands, against everyone on foot it nears — and each person it
 * overlaps while closing on him struck.
 */
export function collide(
  knocks: Knocks,
  state: GameState,
  people: readonly Person[],
  hitters: readonly Hitter[],
  span: number,
): void {
  const t = state.t;
  for (const h of hitters) {
    const reach = Math.max(h.r, Math.hypot(Math.max(h.front, h.back), h.half)) + 1;
    const sweep = Math.hypot(h.vx, h.vz) * span;
    const n = Math.max(1, Math.ceil(sweep / KNOCK_HIT.sweep));
    for (const person of people) {
      if (person.key === h.from) continue;
      if (Math.hypot(person.rx - h.x, person.rz - h.z) > person.rr + reach + sweep) continue;
      const k = knocks.map.get(person.key);
      const me = personOf(person.body);
      let px: number;
      let pz: number;
      let py: number;
      let height = me.height;
      let vx = 0;
      let vz = 0;
      if (k && k.phase !== "back") {
        if (k.phase === "stagger" && !k.falling) {
          px = k.cx;
          pz = k.cz;
          vx = k.vx;
          vz = k.vz;
        } else {
          px = k.rag.x;
          pz = k.rag.z;
          vx = k.rag.vx;
          vz = k.rag.vz;
          height = 0.6;
        }
        py = state.level.groundAt(px, pz);
      } else if (k) {
        px = k.bx;
        pz = k.bz;
        py = state.level.groundAt(px, pz);
      } else {
        person.at(t, pose);
        if (!pose.shown) continue;
        px = pose.x;
        pz = pose.z;
        py = pose.y;
      }
      if (h.y > py + height || h.y + h.height < py) continue;
      // Swept back over the frame from where the hitter stands now.
      let hit = false;
      for (let j = n; j >= 0 && !hit; j--) {
        const back = (span * j) / n;
        hit = overlaps(h, h.x - h.vx * back, h.z - h.vz * back, px, pz, me.r);
      }
      if (!hit) continue;
      const nx = contact.nx;
      const nz = contact.nz;
      const rvx = h.vx - vx;
      const rvz = h.vz - vz;
      const closing = rvx * nx + rvz * nz;
      if (closing <= 0) continue;
      const share = h.mass / (h.mass + me.mass);
      const dn = (1 + KNOCK_HIT.bounce) * share * closing;
      // Across: the slide dragged by friction, no more than the slide.
      const tx = rvx - closing * nx;
      const tz = rvz - closing * nz;
      const tl = Math.hypot(tx, tz);
      const dt0 = Math.min(tl * share, KNOCK_HIT.grip * dn);
      const dvx = dn * nx + (tl > 1e-6 ? (tx / tl) * dt0 : 0);
      const dvz = dn * nz + (tl > 1e-6 ? (tz / tl) * dt0 : 0);
      let knock = k;
      if (!knock) {
        if (knocks.map.size >= KNOCK_HIT.most || Math.hypot(dvx, dvz) < 0.05) continue;
        knock = knockOf(
          state,
          px,
          pz,
          pose.heading,
          startTarget(pose.activity, pose.seat),
          person.skis,
          person.body,
        );
        knocks.map.set(person.key, knock);
      }
      strike(knock, dvx, dvz, h.high, h.lift);
      // A person knocked into another gives up his own share of it.
      if (h.from >= 0) {
        const o = knocks.map.get(h.from);
        if (o) {
          const back = me.mass / h.mass;
          if (o.phase === "stagger" && !o.falling) {
            o.vx -= dvx * back;
            o.vz -= dvz * back;
          }
        }
      }
    }
  }
}

/** Where a knocked person's body is now, m (`centreOf` its points) — the
 * camera's and the labs'. */
export function knockCentre(k: Knock): { x: number; y: number; z: number } {
  return centreOf(k.rag.points);
}
