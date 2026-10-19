// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE LAB'S PERSON SHEET (`gore-scenes.ts`): the player run into one
// of the crowd's amateurs on a free ride (`engine/game/person-hit.ts`), and
// what is left of the two bodies (`crowd-broken.ts`, `crowd-gore.ts`, the
// player's own `gore-view.ts`) — a grown man stood square across the piste
// met at 30, 60 and 90 km/h with the INJURIES switch on, and at 60 and 90
// with it off (knocked down and up again). The meeting is staged as
// `tests/support/body-hits.ts` stages it: everyone else up a lift, the one
// amateur stood a body's depth in front of the player's chest, the contact
// resolved at once (`clipCrowd`, `feelBumps`, `markFall`) and then the run
// stepped on. Photographed at the moment before, through the throw, and
// over both bodies lying: wide, close over the amateur and from above.

import {
  NEUTRAL_INPUT,
  clipCrowd,
  feelBumps,
  markFall,
  placeRun,
  struckPerson,
  type Amateur,
  type GameEvent,
  type GameState,
  type Level,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { flatSpot, type Drive, type Lens, type Stage } from "./gore-scenes.ts";

const still: Drive = () => NEUTRAL_INPUT;

/** A lens `dist` m out from `at` at `yaw`, `up` m over the snow, aimed
 * `aimUp` m over it. */
function planted(
  level: Level,
  at: { x: number; z: number },
  yaw: number,
  dist: number,
  up: number,
  fov = 45,
  aimUp = 0.5,
): LensPose {
  const ex = at.x + Math.sin(yaw) * dist;
  const ez = at.z + Math.cos(yaw) * dist;
  const gy = level.groundAt(at.x, at.z);
  return {
    eye: { x: ex, y: Math.max(level.groundAt(ex, ez) + 0.4, gy + up), z: ez },
    target: { x: at.x, y: gy + aimUp, z: at.z },
    fov,
    roll: 0,
  };
}

/** Where a body lies: the player's ragdoll or his skis, the amateur's. */
const playerAt = (s: GameState) => s.skier.thrown ?? s.skier;
const amateurAt = (a: Amateur) => a.thrown ?? a;

/** BOTH BODIES in one frame, from the side `yaw` of the line between them. */
function both(a: Amateur, yaw: number, up: number): Lens {
  return (s) => {
    const p = playerAt(s);
    const q = amateurAt(a);
    const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
    const apart = Math.hypot(p.x - q.x, p.z - q.z);
    return planted(s.level, mid, yaw, Math.max(6, apart * 0.9 + 4), up, 50, 0.3);
  };
}

/** Over the amateur's body, `dist` m out at `yaw`, `up` m over it. */
function onAmateur(a: Amateur, yaw: number, dist: number, up: number, fov = 45): Lens {
  return (s) => planted(s.level, amateurAt(a), yaw, dist, up, fov, 0.15);
}

/** THE MEETING: a fresh free ride (the injuries on unless `safe`), the
 * player at `kmh` into a grown man stood across his way — then the frames. */
function runInto(st: Stage, kmh: number, safe = false): void {
  const s = st.fresh({ crowd: 30, ...(safe ? { safe: true } : {}) });
  const crowd = s.crowd!;
  for (const o of crowd.amateurs) o.mode = "lift";
  const spot = flatSpot(s.level);
  const h = spot.heading;
  placeRun(s, { x: spot.x, z: spot.z, heading: h, speed: kmh / 3.6 });
  const c = s.skier;
  const a = crowd.amateurs[0];
  a.mode = "ski";
  a.body = "man";
  a.board = null;
  a.knobs = { ...a.knobs, skill: 0.5 };
  a.vx = a.vz = a.speed = 0;
  a.x = c.x + Math.sin(h) * 0.9;
  a.z = c.z + Math.cos(h) * 0.9;
  a.y = s.level.groundAt(a.x, a.z);
  // Stood square across the piste: struck in his side.
  a.heading = h + Math.PI / 2;
  const side = h + Math.PI / 2;
  st.shoot(s, "the moment before", planted(s.level, a, side, 8, 1.6, 45, 0.9));
  const events: GameEvent[] = [];
  clipCrowd(s, events);
  feelBumps(s, events);
  markFall(s);
  const hit = struckPerson(s, a.id);
  const line = hit
    ? `${hit.killed ? "killed" : hit.injured ? "injured" : "knocked down"} · crush ${hit.crush.toFixed(2)} · given ${hit.given.toFixed(1)} m/s`
    : "a shoulder";
  st.run(s, 0.05, still);
  st.shoot(s, `blow ${line}`, planted(s.level, a, side, 9, 1.8, 50, 0.8));
  st.run(s, 0.3, still);
  st.shoot(s, "+0.35s", both(a, side, 2));
  st.run(s, 3.6, still);
  st.shoot(s, "+4s both", both(a, side, 2.6));
  st.shoot(s, "+4s close", onAmateur(a, side + 0.6, 2.6, 1.6, 45));
  st.shoot(s, "+4s above", onAmateur(a, side + 0.2, 0.8, 3.8, 55));
  st.run(s, 8, still);
  st.shoot(
    s,
    `+12s ${(a.mode as string) === "down" ? "still down" : "back up"}`,
    both(a, side + 0.4, 3.2),
  );
}

export const PERSON_VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  "person-30": (st) => runInto(st, 30),
  "person-60": (st) => runInto(st, 60),
  "person-90": (st) => runInto(st, 90),
  "person-60-safe": (st) => runInto(st, 60, true),
  "person-90-safe": (st) => runInto(st, 90, true),
};

export const PERSON_GROUPS: Record<string, readonly string[]> = {
  person: Object.keys(PERSON_VIEWS),
};
