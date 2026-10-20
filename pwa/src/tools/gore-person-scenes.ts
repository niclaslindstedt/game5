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
//
// The CIVILIAN sheet (`civilian`) is the same over a person on foot of the
// ski area's own plan (`engine/game/foot.ts`, handed in by `peopled`): a
// grown civilian stood on open snow, the player sent at him down the fall
// line at 60 and 90 km/h, the injuries on and off — the blow, the throw and
// both bodies lying, his figure drawn off the engine's body (broken and
// flattened when it hurt him, `civilians-view.ts`), the snow's blood the
// crowd's (`crowd-gore.ts`). Its `civilian-walker-` views are the same
// over a dog walker on the village's sidewalks (`dog-foot.ts`), met at the
// first moment of the run one is out where the player meets him square.
//
// The LYING sheet (`lying`) is a grown man laid dead on the snow and gone
// over at 60 km/h on skis and on the snowmobile (`engine/game/lying.ts`):
// the moment before, the pass, and his body pushed on.

import {
  NEUTRAL_INPUT,
  clipCrowd,
  footAt,
  feelBumps,
  markFall,
  placeRun,
  standSled,
  step,
  struckPerson,
  throwAmateur,
  type Amateur,
  type GameEvent,
  type GameState,
  type Level,
  type Vec3,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { civilianAt, civilianHour, civilianPlanFor } from "../game/civilian-plan.ts";
import { walkersAhead } from "../game/dog-foot.ts";
import { peopled } from "../game/foot-call.ts";
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
  // Within the two bodies of him (`PERSON_HIT.foot`): they meet this step.
  a.x = c.x + Math.sin(h) * 0.4;
  a.z = c.z + Math.cos(h) * 0.4;
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

/** Every civilian of the plan but a child stood at `t` on open, nearly
 * level snow, nobody else of it within `room` m: his index, and the way
 * down the fall line toward him. */
function* standingCivilians(s: GameState, room = 7): Generator<{ i: number; heading: number }> {
  const call = s.foot!.call!;
  const plan = civilianPlanFor(s.level);
  const at = { x: 0, y: 0, z: 0 };
  const there = { x: 0, y: 0, z: 0 };
  const n = { x: 0, y: 1, z: 0 };
  for (let i = 0; i < call.people.length; i++) {
    const p = call.people[i];
    if (p.route || p.body === "child") continue;
    if (!footAt(s, call, p, s.t, at)) continue;
    if (Math.abs(at.y - s.level.groundAt(at.x, at.z)) > 0.05) continue;
    const pose = civilianAt(plan, i, s.t, civilianHour(s.level, s.t));
    if (pose.seat !== null || pose.activity === "lounge") continue;
    s.level.normalAt(at.x, at.z, n);
    if (n.y < 0.95) continue;
    const crowded = call.people.some(
      (q, j) =>
        j !== i &&
        footAt(s, call, q, s.t, there) &&
        Math.hypot(there.x - at.x, there.z - at.z) < room,
    );
    if (crowded) continue;
    yield { i, heading: Math.hypot(n.x, n.z) > 1e-3 ? Math.atan2(n.x, n.z) : p.heading };
  }
}

/** The skier stood 1.2 m short of civilian `i` of `s`, sent at him at `kmh`. */
function sendAt(s: GameState, i: number, heading: number, kmh: number): Vec3 {
  const at = { x: 0, y: 0, z: 0 };
  footAt(s, s.foot!.call!, s.foot!.call!.people[i], s.t, at);
  placeRun(s, {
    x: at.x - Math.sin(heading) * 1.2,
    z: at.z - Math.cos(heading) * 1.2,
    heading,
    speed: kmh / 3.6,
  });
  return at;
}

/** The first standing civilian a run-in at `kmh` actually meets — tried on
 * a fresh run with the injuries on, stepped headless, since a lift's
 * queue posts or its hut can take the skier before he reaches a man stood by
 * them, whichever way round him he is met from. */
function metCivilian(st: Stage, kmh: number): { i: number; heading: number } | null {
  const fresh = () => {
    const s = peopled(st.fresh({ crowd: 30 }));
    for (const o of s.crowd!.amateurs) o.mode = "lift";
    return s;
  };
  for (const found of standingCivilians(fresh(), 2.5)) {
    // Down the fall line first, then round him a quarter at a time.
    for (const turn of [0, 0.5, -0.5, 1, 0.25, -0.25]) {
      const pick = { i: found.i, heading: found.heading + turn * Math.PI };
      const trial = fresh();
      sendAt(trial, pick.i, pick.heading, kmh);
      for (let k = 0; k < 60 && !trial.foot!.struck.length; k++) step(trial, NEUTRAL_INPUT);
      // Met square on — not grazed after a post or a hut took him first.
      const square = (h: { foot?: number; speed: number }) =>
        h.foot === pick.i && h.speed > (kmh / 3.6) * 0.8;
      if (trial.foot!.struck.some(square)) return pick;
    }
  }
  return null;
}

/** THE MEETING WITH A CIVILIAN: a fresh free ride with its people handed
 * in, the player sent at `kmh` at a grown civilian of the plan — then the
 * frames over him and the player. */
function civilianInto(st: Stage, kmh: number, safe = false): void {
  const s = peopled(st.fresh({ crowd: 30, ...(safe ? { safe: true } : {}) }));
  for (const o of s.crowd!.amateurs) o.mode = "lift";
  const pick = metCivilian(st, kmh);
  if (!pick) {
    st.shoot(s, "nobody-met-on-this-map", "chase");
    return;
  }
  shootMeeting(st, s, pick, kmh, safe);
}

/** The first dog walker out on the village's sidewalks a run-in at `kmh`
 * actually meets square, and when — tried on fresh runs with the injuries
 * on, the clock set to the moment, his way knotted on to it. */
function metWalker(st: Stage, kmh: number): { i: number; heading: number; t: number } | null {
  const fresh = (t: number) => {
    const s = peopled(st.fresh({ crowd: 30 }));
    for (const o of s.crowd!.amateurs) o.mode = "lift";
    s.t = t;
    walkersAhead(s.foot!.call, t);
    return s;
  };
  const at = { x: 0, y: 0, z: 0 };
  for (let t = 20; t < 900; t += 20) {
    const probe = fresh(t);
    const call = probe.foot!.call!;
    for (let i = 0; i < call.people.length; i++) {
      const p = call.people[i];
      if (!p.track || p.body === "child" || !footAt(probe, call, p, t, at)) continue;
      for (const heading of [0, 0.5, 1, 1.5].map((k) => k * Math.PI)) {
        const trial = fresh(t);
        sendAt(trial, i, heading, kmh);
        for (let k = 0; k < 60 && !trial.foot!.struck.length; k++) step(trial, NEUTRAL_INPUT);
        const square = (h: { foot?: number; speed: number }) =>
          h.foot === p.key && h.speed > (kmh / 3.6) * 0.8;
        if (trial.foot!.struck.some(square)) return { i, heading, t };
      }
    }
  }
  return null;
}

/** THE MEETING WITH A DOG WALKER (`dog-foot.ts`): the player sent at `kmh`
 * at the first owner out on the village's sidewalks he meets square — then
 * the frames over him and the player. */
function walkerInto(st: Stage, kmh: number, safe = false): void {
  const s = peopled(st.fresh({ crowd: 30, ...(safe ? { safe: true } : {}) }));
  for (const o of s.crowd!.amateurs) o.mode = "lift";
  const pick = metWalker(st, kmh);
  if (!pick) {
    st.shoot(s, "nobody-met-on-this-map", "chase");
    return;
  }
  s.t = pick.t;
  walkersAhead(s.foot!.call, pick.t);
  shootMeeting(st, s, pick, kmh, safe);
}

/** The player sent at person `pick.i` of `s`'s people on foot along
 * `pick.heading` at `kmh`, and the frames: the moment before, the blow,
 * the throw and both bodies lying. */
function shootMeeting(
  st: Stage,
  s: GameState,
  pick: { i: number; heading: number },
  kmh: number,
  safe: boolean,
): void {
  const h = pick.heading;
  const at = sendAt(s, pick.i, h, kmh);
  const side = h + Math.PI / 2;
  st.shoot(s, "the moment before", planted(s.level, at, side, 8, 1.6, 45, 0.9));
  st.until(s, (q) => (q.foot?.struck.length ?? 0) > 0, 0.5, still);
  const hit = s.foot!.struck[0];
  const line = hit
    ? `${hit.killed ? "killed" : hit.injured ? "injured" : "knocked down"} · crush ${hit.crush.toFixed(2)} · given ${hit.given.toFixed(1)} m/s`
    : safe
      ? "knocked down (the app's knock)"
      : "not met";
  const him = (q: GameState) => q.foot?.down[0]?.thrown ?? at;
  const bothOf =
    (yaw: number, up: number): Lens =>
    (q) => {
      const a = playerAt(q);
      const b = him(q);
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const apart = Math.hypot(a.x - b.x, a.z - b.z);
      return planted(q.level, mid, yaw, Math.max(6, apart * 0.9 + 4), up, 50, 0.3);
    };
  st.run(s, 0.05, still);
  st.shoot(s, `blow ${line}`, (q) => planted(q.level, him(q), side, 9, 1.8, 50, 0.8));
  st.run(s, 0.3, still);
  st.shoot(s, "+0.35s", bothOf(side, 2));
  st.run(s, 3.6, still);
  st.shoot(s, "+4s both", bothOf(side, 2.6));
  st.shoot(s, "+4s close", (q) => planted(q.level, him(q), side + 0.6, 2.6, 1.6, 45, 0.15));
  st.shoot(s, "+4s above", (q) => planted(q.level, him(q), side + 0.2, 0.8, 3.8, 55, 0.15));
}

/** A BODY LYING GONE OVER (`engine/game/lying.ts`): a grown man laid dead
 * on the snow of the flat spot (thrown over and come to rest while the
 * player waits well up the line), then the player sent over him at `kmh`
 * on his skis or on the snowmobile — the moment before, the pass, and the
 * body pushed on, from the side and from above. */
function overLying(st: Stage, kmh: number, sled: boolean): void {
  const s = st.fresh({ crowd: 30, ...(sled ? { sled: true } : {}) });
  const crowd = s.crowd!;
  for (const o of crowd.amateurs) o.mode = "lift";
  const spot = flatSpot(s.level);
  const h = spot.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const a = crowd.amateurs[0];
  a.body = "man";
  a.board = null;
  a.x = spot.x + fx * 30;
  a.z = spot.z + fz * 30;
  a.y = s.level.groundAt(a.x, a.z);
  a.heading = h + Math.PI / 2;
  throwAmateur(a, 1, "skier", 0, 0, 0);
  a.dead = true;
  a.timer = 600;
  const from = (back: number) => ({ x: a.x - fx * back, z: a.z - fz * back });
  const park = from(40);
  if (sled) standSled(s, s.sled!, park.x, park.z, h);
  else placeRun(s, { x: park.x, z: park.z, heading: h, speed: 0 });
  st.run(s, 4, still);
  const b = a.thrown!;
  const start = from(7);
  if (sled) {
    const m = s.sled!;
    standSled(s, m, start.x, start.z, h);
    m.vx = fx * (kmh / 3.6);
    m.vz = fz * (kmh / 3.6);
    m.treadSpeed = kmh / 3.6;
  } else placeRun(s, { x: start.x, z: start.z, heading: h, speed: kmh / 3.6 });
  const side = h + Math.PI / 2;
  const lying = { x: b.x, z: b.z };
  st.shoot(s, "the moment before", planted(s.level, lying, side, 7, 1.4, 50, 0.3));
  const over = (q: GameState) => q.events.some((e) => e.kind === "struck" && e.lying);
  st.until(s, over, 1.5, still);
  const e = s.events.find((x) => x.kind === "struck");
  const line =
    e?.kind === "struck"
      ? `taken ${(e.taken * 3.6).toFixed(1)} km/h${e.thrown ? " · thrown" : ""} · crush ${(a.crush ?? 0).toFixed(2)}`
      : "not met";
  st.shoot(s, `the pass ${line}`, planted(s.level, lying, side, 7, 1.6, 50, 0.3));
  st.run(s, 1.5, still);
  st.shoot(s, "+1.5s pushed on", onAmateur(a, side + 0.5, 4, 2.2, 50));
  st.shoot(s, "+1.5s above", onAmateur(a, side + 0.2, 0.8, 3.8, 55));
}

export const PERSON_VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  "lying-skis-60": (st) => overLying(st, 60, false),
  "lying-sled-60": (st) => overLying(st, 60, true),
  "civilian-60": (st) => civilianInto(st, 60),
  "civilian-90": (st) => civilianInto(st, 90),
  "civilian-60-safe": (st) => civilianInto(st, 60, true),
  "civilian-90-safe": (st) => civilianInto(st, 90, true),
  "civilian-walker-60": (st) => walkerInto(st, 60),
  "civilian-walker-60-safe": (st) => walkerInto(st, 60, true),
  "person-30": (st) => runInto(st, 30),
  "person-60": (st) => runInto(st, 60),
  "person-90": (st) => runInto(st, 90),
  "person-60-safe": (st) => runInto(st, 60, true),
  "person-90-safe": (st) => runInto(st, 90, true),
};

export const PERSON_GROUPS: Record<string, readonly string[]> = {
  person: Object.keys(PERSON_VIEWS).filter((v) => v.startsWith("person-")),
  civilian: Object.keys(PERSON_VIEWS).filter((v) => v.startsWith("civilian-")),
  lying: Object.keys(PERSON_VIEWS).filter((v) => v.startsWith("lying-")),
};
