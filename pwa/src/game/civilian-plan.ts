// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE EVERY CIVILIAN IS — the people on foot about the free ride's ski
// area (`civilian-roles.ts`: the lift crew, the patrol, the workers, the
// ski school, the guest desk; the terrace's partiers, the deck chairs, the
// mugs of cocoa, the walkers with their skis on a shoulder, the children
// at play) dealt over its places (`civilian-spots.ts`), and where each one
// is and what he is doing at a moment, as plain numbers. Three-free, the
// wildlife's split (`beast-plan.ts`): a view turns what comes back into
// figures, and `tests/civilians_test.ts` holds the model with no renderer
// in sight.
//
// PRESENTATION ONLY, like the wildlife: the plan is dealt off the map's
// seed on a salt of its own (`CIVILIAN_SALT`), never `state.rng`; it reads
// the map and the engine's clock and writes nothing, so no digest moves and
// a replay shows every person doing what he did. Nobody is met by a skier
// — he stands off the skiing (`civilianClear`).
//
// A PERSON IS A ROUTINE, NOT A STATE. Each holds a dealt routine of
// activities (stand, sweep, shovel, sip, dance, …), each step a dealt
// while, repeated from a dealt offset — so what he does at `t` is a closed
// form of the clock (`civilianAt`). A WALKER walks a LEG — from his place to
// another and back, at a boot's pace (`BOOT_GAIT`), pausing at each end —
// so where he is at `t` is closed-form too: he never slides, never
// teleports, and the distance he has covered (`walked`) is what his steps
// are drawn off.
//
// WHO IS OUT is the HOUR's (`shown`): each role has a share by the hour,
// each person a dealt KEENNESS, and he is out while his keenness is under
// the share — so the morning is the staff's, midday the busiest, the
// terrace fills as the lifts close, and after dark it is the partiers, the
// few staff and the odd walker. A party (a family, a class, a pair of
// children) shares its leader's keenness, so it comes and goes together;
// the first of the crew at a lift's post is out whenever any of it is.

import { TAU, createRng, type CrowdBody, type Level, type Rng, type RunRules } from "@engine";

import {
  BOOT_GAIT,
  CIVILIAN_ROLES,
  roleOf,
  shareAt,
  type Activity,
  type Carry,
  type Dress,
  type Role,
  type RoleId,
} from "./civilian-roles.ts";
import {
  civilianClear,
  frameAt,
  spotsOf,
  standable,
  type Seat,
  type Spot,
} from "./civilian-spots.ts";
import { wildGround } from "./wild-ground.ts";

/** The salt on the map's seed the civilians are dealt off. */
export const CIVILIAN_SALT = 0x5c1a;

/** How many civilians a map holds at the most. */
export const CIVILIAN_MOST = 160;

/** The places, m and s: the least room between two people stood at one
 * place; the tries a person's spot gets; a walker's leg — the shortest and
 * longest to another place, the step its line is checked at, a mill's
 * shortest and longest about his own place — and the pause at each end
 * (dealt between the two, s). */
const ROOM = 0.85;
const TRIES = 24;
const LEG = { least: 30, most: 260, check: 1, millLeast: 8, millMost: 22 } as const;
const PAUSE: readonly [number, number] = [8, 40];
/** The share of walkers out with nothing in their hands; the rest carry
 * their skis on a shoulder. */
const EMPTY_HANDED = 0.4;
/** A party walking alongside its leader: how far to his side each one
 * walks, m. */
const ALONGSIDE = 0.75;
/** A ring of people facing in: its radius, m, by how many stand on it. */
const ringRadius = (n: number): number => 0.55 + 0.22 * n;
/** A snowball fight is thrown across a wider ring, m. */
const THROW_RING = 3.2;
/** A class stands on an arc this far before its instructor, m. */
const CLASS_ARC = 2.6;

/** What a place holds besides its people: a deck chair set out for a
 * lounger, a snowman the children are building. */
export type CivilianProp = {
  kind: "deckchair" | "snowman";
  x: number;
  y: number;
  z: number;
  heading: number;
};

/** Where a still person stands (or sits), the way he faces, and the seat's
 * height over the floor when he sits on one (`null` stood, 0 sat on the
 * snow). */
type Home = { x: number; y: number; z: number; heading: number; seat: number | null };

/** A walker's LEG: from A to B and back, at `speed`, pausing `pause` s at
 * each end; walking `side` m to the right of its line (a party alongside). */
type Leg = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  length: number;
  speed: number;
  pause: number;
  side: number;
};

/** One step of a dealt routine: the activity, how long, what is held. */
type Held = { act: Activity; seconds: number; carry: Carry };

export type Civilian = {
  readonly id: string;
  readonly role: RoleId;
  readonly body: CrowdBody;
  readonly dress: Dress;
  /** A guest's own colours are dealt off this (0..1); staff wear theirs. */
  readonly tint: number;
  /** Out while this is under his role's share for the hour. */
  readonly keen: number;
  /** The place he was dealt at. */
  readonly spot: string;
  readonly home: Home;
  /** On a deck: his feet on its boards, never the snow's. */
  readonly deck: boolean;
  readonly leg: Leg | null;
  readonly routine: readonly Held[];
  /** The routine's whole length, s, and where in it he starts. */
  readonly total: number;
  readonly offset: number;
};

export type CivilianPlan = {
  /** The map it was dealt over — a walker's feet are read off its snow. */
  readonly level: Level;
  readonly seed: number;
  readonly people: readonly Civilian[];
  readonly props: readonly CivilianProp[];
};

/** Where a civilian is and what he is doing at a moment — refilled by
 * `civilianAt`. `y` is his feet (the snow's drawn surface, or a deck's
 * boards). `clock` is how far into the activity he is, s, and `span` how
 * long it lasts (a dance's clock is the run's own, so a terrace keeps one
 * beat); `walked` how far he has walked in all, m — his steps are drawn
 * off it (`BOOT_GAIT.step`); `seat` the height of what he sits on over his
 * feet (`null` stood, 0 sat on the snow). */
export type CivilianPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  activity: Activity;
  clock: number;
  span: number;
  walked: number;
  carry: Carry;
  seat: number | null;
  shown: boolean;
};

export function freshCivilianPose(): CivilianPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    activity: "stand",
    clock: 0,
    span: 1,
    walked: 0,
    carry: "none",
    seat: null,
    shown: false,
  };
}

/** WHETHER A RUN HAS CIVILIANS: a run with the ski area's people on it —
 * the free ride's amateurs (`RunRules.crowd`) or, after dark when the
 * amateurs have gone in, its lodges' afterski (`RunRules.afterski`): the
 * terraces party on and the lift crew stays on at the lifts that run. */
export function hasCivilians(rules: Pick<RunRules, "crowd" | "afterski">): boolean {
  return rules.crowd > 0 || rules.afterski === true;
}

/** The hour a map's civilians live at: the map's own (the sun stands at it
 * for the whole run). */
export function civilianHour(level: Pick<Level, "sun">): number {
  return level.sun.hour;
}

function dealRoutine(rng: Rng, role: Role): { routine: Held[]; total: number } {
  const routine = role.routine.map((s) => ({
    act: s.act,
    seconds: rng.range(s.seconds[0], s.seconds[1]),
    carry: s.carry ?? role.carry,
  }));
  return { routine, total: routine.reduce((n, s) => n + s.seconds, 0) };
}

/** The snow's drawn surface, or a deck's boards. */
function floorAt(level: Level, spot: Spot, x: number, z: number): number {
  return spot.deck ?? wildGround(level).snowY(x, z);
}

/** A free point of a place's area, held `ROOM` off everyone at it already,
 * or null. */
function freePoint(
  rng: Rng,
  level: Level,
  spot: Spot,
  taken: readonly { x: number; z: number }[],
): { x: number; z: number } | null {
  for (let k = 0; k < TRIES; k++) {
    const lx = rng.range(spot.area.x0, spot.area.x1);
    const lz = rng.range(spot.area.z0, spot.area.z1);
    if (!standable(level, spot, lx, lz)) continue;
    const p = frameAt(spot.x, spot.z, spot.heading, lx, lz);
    if (taken.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < ROOM)) continue;
    return p;
  }
  return null;
}

/** Whether a walk along a–b stays on clear snow all the way: sampled every
 * `LEG.check` m, each sample held half that more off everything, so the
 * snow between two samples is clear too. */
function legClear(level: Level, ax: number, az: number, bx: number, bz: number): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / LEG.check));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!civilianClear(level, ax + (bx - ax) * t, az + (bz - az) * t, false, LEG.check / 2)) {
      return false;
    }
  }
  return true;
}

/** A walker's leg from (x, z): to another place of the walking kinds in
 * reach whose line is clear, else a mill about his own place, else none. */
function dealLeg(
  rng: Rng,
  level: Level,
  spots: readonly Spot[],
  from: Spot,
  x: number,
  z: number,
  speed: number,
): Leg | null {
  const ends = spots.filter(
    (s) =>
      s !== from &&
      s.deck === undefined &&
      (s.kind === "base" || s.kind === "yard" || s.kind === "porch") &&
      Math.hypot(s.x - x, s.z - z) > LEG.least &&
      Math.hypot(s.x - x, s.z - z) < LEG.most,
  );
  const pause = rng.range(PAUSE[0], PAUSE[1]);
  for (let k = 0; k < Math.min(6, ends.length * 2); k++) {
    const to = rng.pick(ends);
    const b = freePoint(rng, level, to, []);
    if (!b || !legClear(level, x, z, b.x, b.z)) continue;
    return leg(x, z, b.x, b.z, speed, pause);
  }
  for (let k = 0; k < 8; k++) {
    const a = rng.range(0, TAU);
    const r = rng.range(LEG.millLeast, LEG.millMost);
    const bx = x + Math.sin(a) * r;
    const bz = z + Math.cos(a) * r;
    if (legClear(level, x, z, bx, bz)) return leg(x, z, bx, bz, speed, pause);
  }
  return null;
}

function leg(ax: number, az: number, bx: number, bz: number, speed: number, pause: number): Leg {
  return { ax, az, bx, bz, length: Math.hypot(bx - ax, bz - az), speed, pause, side: 0 };
}

/** A boot's pace for a body, m/s: the old and the children at the slow end. */
function paceOf(rng: Rng, body: CrowdBody): number {
  const [lo, hi] = BOOT_GAIT.speed;
  const slow = body === "oldMan" || body === "oldWoman" || body === "child";
  return slow ? rng.range(lo * 0.85, (lo + hi) / 2) : rng.range(lo, hi);
}

/** LAY EVERY CIVILIAN OVER THE MAP. Deterministic in the map's seed on a
 * generator of its own; reads the map and never writes it. */
export function planCivilians(level: Level): CivilianPlan {
  const rng = createRng((level.seed ^ CIVILIAN_SALT) >>> 0);
  const spots = spotsOf(level);
  const people: Civilian[] = [];
  const props: CivilianProp[] = [];
  /** Who stands at each place already. */
  const at = new Map<string, { x: number; z: number }[]>();
  const takenAt = (s: Spot) => {
    let list = at.get(s.id);
    if (!list) at.set(s.id, (list = []));
    return list;
  };
  const seatsUsed = new Set<Seat>();
  const full = () => people.length >= CIVILIAN_MOST;

  const add = (
    role: Role,
    spot: Spot,
    home: Home,
    deck: boolean,
    keen: number,
    leg: Leg | null,
    body: CrowdBody = rng.pick(role.bodies),
    carry?: Carry,
  ): Civilian => {
    const dealt = dealRoutine(rng, role);
    const routine = carry ? dealt.routine.map((h) => ({ ...h, carry })) : dealt.routine;
    const total = dealt.total;
    const c: Civilian = {
      id: `C${people.length + 1}`,
      role: role.id,
      body,
      dress: role.dress,
      tint: rng.next(),
      keen,
      spot: spot.id,
      home,
      deck,
      leg,
      routine,
      total,
      offset: rng.range(0, total),
    };
    people.push(c);
    takenAt(spot).push({ x: home.x, z: home.z });
    return c;
  };

  const standAt = (
    spot: Spot,
    x: number,
    z: number,
    heading: number,
    seat: number | null = null,
  ): Home => ({
    x,
    z,
    y: floorAt(level, spot, x, z),
    heading,
    seat,
  });

  /** A ring of `n` about (cx, cz), radius `r`, every one facing in, those
   * that stand clear. */
  const ring = (spot: Spot, cx: number, cz: number, n: number, r: number): Home[] => {
    const out: Home[] = [];
    const a0 = rng.range(0, TAU);
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * TAU;
      const x = cx + Math.sin(a) * r;
      const z = cz + Math.cos(a) * r;
      const local = intoLocal(spot, x, z);
      if (!standable(level, spot, local.lx, local.lz)) continue;
      out.push(standAt(spot, x, z, a + Math.PI));
    }
    return out;
  };

  for (const role of CIVILIAN_ROLES) {
    for (const spot of spots) {
      if (full()) break;
      if (!role.at.includes(spot.kind)) continue;
      if (!rng.chance(role.chance)) continue;
      const want = rng.int(role.count[0], role.count[1]);
      const taken = takenAt(spot);
      for (let n = 0; n < want && !full(); n++) {
        // The first of the staff at a post is out whenever it is manned.
        const keen = role.staff && n === 0 ? 0 : rng.next();
        if (role.moves === "post") {
          const post = spot.post;
          if (!post) break;
          // A second hand stands a step aside of the first.
          const p = n === 0 ? post : frameAt(post.x, post.z, post.heading, 1.4 * n, -0.4);
          add(role, spot, standAt(spot, p.x, p.z, post.heading), false, keen, null);
          continue;
        }
        if (role.moves === "seat") {
          const free = spot.seats.filter((s) => !seatsUsed.has(s));
          if (free.length > 0) {
            const seat = rng.pick(free);
            seatsUsed.add(seat);
            add(
              role,
              spot,
              { ...standAt(spot, seat.x, seat.z, seat.heading), seat: seat.height },
              true,
              keen,
              null,
            );
            continue;
          }
        }
        const p = freePoint(rng, level, spot, taken);
        if (!p) break;
        const facing = spot.heading + rng.range(-1.2, 1.2);
        const deck = spot.deck !== undefined;
        if (role.moves === "chair") {
          // The chair set out facing the place's way (a lodge's front is
          // its sunny side), the lounger laid in it.
          const home = { ...standAt(spot, p.x, p.z, spot.heading), seat: 0.32 };
          props.push({ kind: "deckchair", x: p.x, y: home.y, z: p.z, heading: spot.heading });
          add(role, spot, home, deck, keen, null);
          continue;
        }
        if (role.moves === "walk") {
          const body = rng.pick(role.bodies);
          const companions =
            role.party && rng.chance(role.party.chance)
              ? rng.int(role.party.count[0], role.party.count[1])
              : 0;
          const speed =
            companions > 0 ? Math.min(paceOf(rng, body), paceOf(rng, "child")) : paceOf(rng, body);
          const l = dealLeg(rng, level, spots, spot, p.x, p.z, speed);
          const home = standAt(spot, p.x, p.z, facing);
          if (!l) {
            // Nowhere clear to walk to: he stands about his place instead.
            add(role, spot, home, deck, keen, null, body);
            continue;
          }
          // Skis on a shoulder for most, empty hands for the rest.
          add(role, spot, home, deck, keen, l, body, rng.chance(EMPTY_HANDED) ? "none" : undefined);
          if (companions > 0 && role.party) {
            const kid = roleOf(role.party.role);
            // To the right of the way out is (cos h, −sin h).
            const rx = (l.bz - l.az) / (l.length || 1);
            const rz = -(l.bx - l.ax) / (l.length || 1);
            for (let k = 0; k < companions && !full(); k++) {
              const side = (k % 2 === 0 ? 1 : -1) * ALONGSIDE * (1 + Math.floor(k / 2));
              const ox = rx * side;
              const oz = rz * side;
              if (!legClear(level, l.ax + ox, l.az + oz, l.bx + ox, l.bz + oz)) continue;
              add(kid, spot, standAt(spot, p.x + ox, p.z + oz, facing), deck, keen, { ...l, side });
            }
          }
          continue;
        }
        if (role.moves === "ring") {
          // The party and the leader on one ring, facing in: a knot with
          // mugs, the patrol's word, a snowball fight across a wide one,
          // children round their snowman.
          const extra =
            role.party && rng.chance(role.party.chance)
              ? rng.int(role.party.count[0], role.party.count[1])
              : 0;
          const size = Math.max(2, want - n + extra);
          const r =
            role.id === "snowballer" ? THROW_RING : role.id === "builder" ? 0.75 : ringRadius(size);
          const homes = ring(spot, p.x, p.z, size, r);
          // A ring of one is nobody's company: a lone patrolman stands.
          if (homes.length < Math.min(2, size)) break;
          if (role.id === "builder") {
            props.push({
              kind: "snowman",
              x: p.x,
              y: floorAt(level, spot, p.x, p.z),
              z: p.z,
              heading: rng.range(0, TAU),
            });
          }
          const mate = role.party ? roleOf(role.party.role) : role;
          homes.forEach((h, k) => {
            if (!full()) add(k < want - n ? role : mate, spot, h, deck, keen, null);
          });
          break;
        }
        // About the place, stood or sat as the routine has it; a rester
        // sits on the snow.
        const seat = role.id === "rester" ? 0 : null;
        const leader = add(role, spot, standAt(spot, p.x, p.z, facing, seat), deck, keen, null);
        if (role.party && rng.chance(role.party.chance)) {
          // A class on an arc before its instructor, facing him.
          const kids = rng.int(role.party.count[0], role.party.count[1]);
          const mate = roleOf(role.party.role);
          for (let k = 0; k < kids && !full(); k++) {
            const a = facing + ((k + 0.5) / kids - 0.5) * 1.8;
            const x = leader.home.x + Math.sin(a) * CLASS_ARC;
            const z = leader.home.z + Math.cos(a) * CLASS_ARC;
            const local = intoLocal(spot, x, z);
            if (!standable(level, spot, local.lx, local.lz)) continue;
            add(mate, spot, standAt(spot, x, z, a + Math.PI), deck, keen, null);
          }
        }
      }
    }
  }
  return { level, seed: level.seed, people, props };
}

/** A world point in a place's frame. */
function intoLocal(spot: Spot, x: number, z: number): { lx: number; lz: number } {
  const fx = Math.sin(spot.heading);
  const fz = Math.cos(spot.heading);
  const dx = x - spot.x;
  const dz = z - spot.z;
  return { lx: dx * fz - dz * fx, lz: dx * fx + dz * fz };
}

const plans = new WeakMap<Level, CivilianPlan>();

/** THE PLAN FOR A MAP, laid once and kept against it. */
export function civilianPlanFor(level: Level): CivilianPlan {
  let hit = plans.get(level);
  if (hit === undefined) {
    hit = planCivilians(level);
    plans.set(level, hit);
  }
  return hit;
}

/** The step of a routine `u` s into it (wrapped), and how far into it. */
function stepAt(c: Civilian, u: number): { held: Held; into: number } {
  let left = ((u % c.total) + c.total) % c.total;
  for (const held of c.routine) {
    if (left < held.seconds) return { held, into: left };
    left -= held.seconds;
  }
  const last = c.routine[c.routine.length - 1];
  return { held: last, into: last.seconds };
}

/**
 * WHERE CIVILIAN `i` OF `plan` IS AT `t`, and what he is doing, at the
 * map's `hour` (`civilianHour`), written into `out`. A pure function of
 * its arguments: the same moment is the same pose, step for step and frame
 * for frame.
 */
export function civilianAt(
  plan: CivilianPlan,
  i: number,
  t: number,
  hour: number,
  out: CivilianPose = freshCivilianPose(),
): CivilianPose {
  const c = plan.people[i];
  out.shown = c.keen < shareAt(roleOf(c.role).hours, hour);
  const u = t + c.offset;
  const { held, into } = stepAt(c, u);
  out.carry = held.carry;
  out.seat = c.home.seat;
  out.walked = 0;
  if (c.leg) {
    const L = c.leg;
    const walk = L.length / L.speed;
    const cycle = 2 * (walk + L.pause);
    const n = Math.floor(u / cycle);
    const w = u - n * cycle;
    // Out, a pause, back, a pause: the distance in closed form.
    let s: number;
    let back = false;
    let moving = true;
    if (w < walk) s = w * L.speed;
    else if (w < walk + L.pause) {
      s = L.length;
      moving = false;
    } else if (w < 2 * walk + L.pause) {
      s = L.length - (w - walk - L.pause) * L.speed;
      back = true;
    } else {
      s = 0;
      back = true;
      moving = false;
    }
    const dx = (L.bx - L.ax) / (L.length || 1);
    const dz = (L.bz - L.az) / (L.length || 1);
    // Alongside: to the right of the way out (cos h, −sin h).
    out.x = L.ax + dx * s + dz * L.side;
    out.z = L.az + dz * s - dx * L.side;
    out.y = wildGround(plan.level).snowY(out.x, out.z);
    out.heading = back ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
    const covered = n * 2 * L.length + (w < walk + L.pause ? s : L.length + (L.length - s));
    out.walked = covered;
    if (moving) {
      out.activity = "walk";
      out.clock = covered / L.speed;
      out.span = walk;
      return out;
    }
    // Stood at an end, as the routine has it.
    const pausedFor = w < walk + L.pause ? w - walk : w - 2 * walk - L.pause;
    out.activity = held.act === "walk" ? "stand" : held.act;
    out.clock = pausedFor;
    out.span = L.pause;
    return out;
  }
  out.x = c.home.x;
  out.y = c.home.y;
  out.z = c.home.z;
  out.heading = c.home.heading;
  out.activity = held.act;
  // The terrace dances to one beat: the run's own clock.
  out.clock = held.act === "dance" ? t : into;
  out.span = held.seconds;
  return out;
}

/** How many of a plan are out at `hour` — an instance budget. */
export function civiliansOut(plan: CivilianPlan, hour: number): number {
  let n = 0;
  for (const c of plan.people) if (c.keen < shareAt(roleOf(c.role).hours, hour)) n++;
  return n;
}
