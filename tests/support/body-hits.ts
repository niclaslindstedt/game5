// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PERSON RUN INTO, staged (`engine/game/person-hit.ts`): the player on a
// free ride of seed 3 driven at a closing speed into one amateur stood
// still in front of him, everyone else up a lift — the meeting
// `tests/body_hits_test.ts` holds and `make body-hits` prints a row of —
// and a person on foot met by the player, his body thrown, his snowmobile,
// a piste machine or a car (`tests/civilian_body_hits_test.ts`).

import {
  casualtiesOf,
  clipCrowd,
  createGame,
  feelBumps,
  freshVehiclePose,
  markFall,
  meetFoot,
  severityOf,
  stepFoot,
  throwRider,
  trafficOf,
  vehicleAt,
  withFoot,
  NEUTRAL_INPUT,
  VEHICLES,
  step,
  type Amateur,
  type CrowdBody,
  type GameEvent,
  type GameState,
  type GroomerState,
  type VehicleKind,
} from "@engine";

import { levelFor } from "./levels.ts";

export const HIT_SEED = 3;

/** The meeting staged and stepped once: the player at `kmh` into a
 * standing amateur of `body`, on a run with its INJURIES on or off — the
 * amateur `ahead` m in front of the player's middle and `aside` m to his
 * right (by default within the two bodies, so they meet this step). */
export function stageMeeting(
  kmh: number,
  body: CrowdBody,
  gore: boolean,
  ahead = 0.4,
  aside = 0,
): { state: GameState; a: Amateur; events: GameEvent[] } {
  const state = createGame({
    level: levelFor(HIT_SEED),
    seed: HIT_SEED,
    mode: "free",
    quiet: true,
    crowd: 30,
    gore,
  });
  const crowd = state.crowd!;
  for (const o of crowd.amateurs) o.mode = "lift";
  const a = crowd.amateurs[0];
  a.mode = "ski";
  a.body = body;
  a.board = null;
  a.knobs = { ...a.knobs, skill: 0.5 };
  a.vx = a.vz = a.speed = 0;
  const c = state.skier;
  a.x = c.x + aside;
  a.z = c.z + ahead;
  a.y = c.y - c.spec.cogHeight;
  c.heading = 0;
  c.vx = 0;
  c.vz = kmh / 3.6;
  const events: GameEvent[] = [];
  clipCrowd(state, events);
  feelBumps(state, events);
  markFall(state);
  return { state, a, events };
}

/** Steps the run on `seconds` under the neutral input. */
export function rideOn(state: GameState, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 120); i++) step(state, NEUTRAL_INPUT);
}

/** ONE ROW: the meeting staged, ridden on `seconds`, and what came of it
 * on both sides. */
export type HitRow = {
  kmh: number;
  body: CrowdBody;
  gore: boolean;
  /** The player: thrown by it, every injury (kind@part:AIS), the worst
   * AIS, the injury severity score, dead, down hurt. */
  thrown: boolean;
  injuries: string[];
  worst: number;
  iss: number;
  dead: boolean;
  down: boolean;
  /** The amateur: knocked down, killed, injured past getting up, crushed
   * 0..1, back up on his skis by the end. */
  knocked: boolean;
  killed: boolean;
  injured: boolean;
  crush: number;
  up: boolean;
  /** Who `casualtiesOf` lists at the end. */
  casualties: string[];
};

export function hitRow(kmh: number, body: CrowdBody, gore: boolean, seconds = 8): HitRow {
  const { state, a } = stageMeeting(kmh, body, gore);
  const thrown = !!state.skier.thrown;
  const knocked = a.mode === "down";
  rideOn(state, seconds);
  const b = state.skier.body;
  const g = state.gore;
  return {
    kmh,
    body,
    gore,
    thrown,
    injuries: b.injuries.map((h) => `${h.kind}@${h.part}:${h.ais}`),
    worst: Math.max(0, ...b.injuries.map((h) => h.ais)),
    iss: severityOf(b),
    dead: !!g && g.dead >= 0,
    down: !!g && g.injured >= 0,
    knocked,
    killed: !!a.dead,
    injured: !!a.injured,
    crush: a.crush ?? 0,
    up: a.mode !== "down",
    casualties: casualtiesOf(state).map((k) => `${k.who}${k.dead ? " dead" : " hurt"}`),
  };
}

/** The lab's sweep: every speed into a grown man and a child, both ways
 * of the switch. */
export const HIT_SPEEDS = [10, 20, 30, 45, 60, 90] as const;
export const HIT_BODIES: readonly CrowdBody[] = ["man", "child"];

/** WHO ON FOOT is run into (`engine/game/foot.ts`), and by what: a
 * civilian of the plan handed in, a rescue crew member off his call's
 * track, a dog walker off his (`walker`), a ski patrolman off his
 * (`patrol`) — each by the player on his skis — or a civilian met by the
 * snowmobile the player rides (`sled`), by the player's body thrown and
 * tumbling (`thrown`), by a piste machine (`groomer`) or by a car of the
 * village's traffic (`car`, `stageCar`). */
export type FootWho =
  "civilian" | "crew" | "sled" | "walker" | "patrol" | "thrown" | "groomer" | "car";

/** The key a staged dog walker is handed in by (`dog-foot.ts`' first). */
export const WALKER_KEY = 900_000;

/** A piste machine stood at (`x`, `y`, `z`) heading +z at `speed` m/s. */
export function groomerAt(x: number, y: number, z: number, speed: number): GroomerState {
  return {
    id: 0,
    mode: "groom",
    run: 0,
    lanes: 1,
    lane: 0,
    step: 1,
    dir: 1,
    s: 0,
    x,
    y,
    z,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed,
    tiller: true,
    swath: [],
    swathFrom: 0,
    lastX: Number.NaN,
    lastZ: Number.NaN,
    turn: { x0: 0, z0: 0, h0: 0, x1: 0, z1: 0, h1: 0, k: 0 },
    rider: false,
    drive: 0,
    steer: 0,
    t: 0,
  };
}

/** A person on foot met, staged and stepped once: the player at `kmh` into
 * him stood still just in front — or the thing `who` names driven into
 * him — on the same free ride with nobody else out: no amateur, and the
 * person the only one handed in. */
export function stageFoot(
  kmh: number,
  body: CrowdBody,
  gore: boolean,
  who: FootWho = "civilian",
): { state: GameState; events: GameEvent[] } {
  if (who === "car") {
    const car = stageCar(kmh, body, gore);
    if (!car) throw new Error(`no vehicle drives at ${kmh} km/h on seed ${CAR_SEED}`);
    return car;
  }
  const state = createGame({
    level: levelFor(HIT_SEED),
    seed: HIT_SEED,
    mode: "free",
    quiet: true,
    crowd: 0,
    gore,
  });
  const c = state.skier;
  const x = c.x;
  const ahead = { sled: 1.75, groomer: 4.2, thrown: 0.7 } as Partial<Record<FootWho, number>>;
  const z = c.z + (ahead[who] ?? 0.4);
  const y = state.level.groundAt(x, z);
  if (who === "crew" || who === "patrol") {
    const patrol = who === "patrol";
    state.rescue = [
      {
        start: -30,
        site: { x: x + 60, y: state.level.groundAt(x + 60, z), z, heading: 0, pitch: 0, roll: 0 },
        down: -20,
        up: 600,
        casualties: [],
        ...(patrol ? { kind: "sled" as const, sledsTaken: [null, null] } : {}),
        crew: [
          {
            body,
            t0: 0,
            dt: 0.25,
            xz: [x, z, x, z],
            ...(patrol ? { sled: { k: 0 as const, taken: null, sure: 600 } } : {}),
          },
        ],
      },
    ];
  } else if (who === "walker") {
    const track = { t: [0, 600], xz: [x, z, x, z] };
    const person = { key: WALKER_KEY, body, x, y, z, heading: Math.PI, track, rx: x, rz: z, rr: 1 };
    withFoot(state, { people: [person], rate: 0 });
  } else {
    const person = { key: 7, body, x, y, z, heading: Math.PI, rx: x, rz: z, rr: 1 };
    withFoot(state, { people: [person], rate: 0 });
  }
  c.heading = 0;
  c.vx = 0;
  c.vz = kmh / 3.6;
  const events: GameEvent[] = [];
  if (who === "sled") {
    const s = state.sled!;
    s.rider = true;
    s.x = c.x;
    s.z = c.z;
    s.heading = 0;
    s.vx = 0;
    s.vz = kmh / 3.6;
  } else if (who === "groomer") {
    // The player stood out of it; the machine driven into the person.
    c.vz = 0;
    state.groomers = [groomerAt(x, y, c.z, kmh / 3.6)];
  } else if (who === "thrown") {
    // Thrown, his body tumbling on into the person at the speed: every
    // point of it going so (its velocity is where it was a step ago).
    const b = throwRider(state, "tree", { x: 0, y: 0, z: kmh / 3.6 }, events);
    for (let i = 0; i < b.points.length; i += 3) {
      b.last[i] = b.points[i];
      b.last[i + 1] = b.points[i + 1];
      b.last[i + 2] = b.points[i + 2] - kmh / 3.6 / 120;
    }
    b.vx = b.vy = 0;
    b.vz = kmh / 3.6;
    events.length = 0;
  }
  meetFoot(state, events);
  return { state, events };
}

/** A free ride whose village's traffic drives at the street's and the
 * road's pace (`stageCar`). */
export const CAR_SEED = HIT_SEED;

/** A CAR OF THE TRAFFIC at `kmh`: the first moment of the free ride on
 * `seed` some car drives within a km/h of it, the person stood just ahead
 * of its front and met that step, the player stood still away from it.
 * Null when none drives so. */
export function stageCar(
  kmh: number,
  body: CrowdBody,
  gore: boolean,
  seed = CAR_SEED,
): { state: GameState; events: GameEvent[]; kind: VehicleKind } | null {
  const level = levelFor(seed);
  const plan = trafficOf(level);
  if (!plan) return null;
  const pose = freshVehiclePose();
  for (let t = 1; t < 900; t += 0.5) {
    for (let k = 0; k < plan.vehicles.length; k++) {
      vehicleAt(plan, k, t, pose);
      if (!pose.shown || pose.kind === "bike" || Math.abs(pose.speed * 3.6 - kmh) > 1) continue;
      const state = createGame({ level, seed, mode: "free", quiet: true, crowd: 0, gore });
      state.t = t;
      const ahead = VEHICLES[pose.kind].length / 2 + 0.2;
      const x = pose.x + Math.sin(pose.heading) * ahead;
      const z = pose.z + Math.cos(pose.heading) * ahead;
      const heading = pose.heading + Math.PI;
      const person = { key: 7, body, x, y: pose.y, z, heading, rx: x, rz: z, rr: 1 };
      withFoot(state, { people: [person], rate: 0 });
      state.skier.vx = state.skier.vz = 0;
      const events: GameEvent[] = [];
      meetFoot(state, events);
      return { state, events, kind: pose.kind };
    }
  }
  return null;
}

/** The people down stepped on `seconds` alone (the run held still), so
 * the machine that struck one is not driven on into him again. */
export function stepPeople(state: GameState, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    state.t += 1 / 120;
    stepFoot(state);
  }
}

/** Who is run into by the player himself, so his own run goes on after. */
const RIDDEN: readonly FootWho[] = ["civilian", "crew", "walker", "patrol", "thrown"];

/** ONE ROW of a person on foot run into: the meeting staged, ridden on
 * `seconds`, and what came of it on both sides (`HitRow`'s columns; the
 * person "up" once the engine has let him go back to his plan). */
export function footRow(
  kmh: number,
  body: CrowdBody,
  gore: boolean,
  who: FootWho = "civilian",
  seconds = 8,
): HitRow {
  const { state } = stageFoot(kmh, body, gore, who);
  const thrown = !!state.skier.thrown && who !== "thrown";
  const d = state.foot?.down[0];
  if (RIDDEN.includes(who)) rideOn(state, seconds);
  else stepPeople(state, seconds);
  const b = state.skier.body;
  const g = state.gore;
  return {
    kmh,
    body,
    gore,
    thrown,
    injuries: b.injuries.map((h) => `${h.kind}@${h.part}:${h.ais}`),
    worst: Math.max(0, ...b.injuries.map((h) => h.ais)),
    iss: severityOf(b),
    dead: !!g && g.dead >= 0,
    down: !!g && g.injured >= 0,
    knocked: !!d,
    killed: !!d?.dead,
    injured: !!d?.injured,
    crush: d?.crush ?? 0,
    up: !!d && !d.dead && !d.injured && d.settled,
    casualties: casualtiesOf(state).map((k) => `${k.who}${k.dead ? " dead" : " hurt"}`),
  };
}
