// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD ON THE LIFTS — an amateur at the foot of the mountain takes a
// real lift up it: he skates to its QUEUE at the bottom station and stands
// in line in the corral, shuffling up as the line moves; the carrier that
// comes round to the load line takes the front of the queue — a quad
// chair four, a T-bar two, a cabin eight — and each rides THAT carrier up
// the rope (`carrierAt`: the lifts always run, so a chair with people on it
// is wherever its clock has it), sat on a chair, stood behind a T-bar on
// the snow, or out of sight in a cabin; at the top he is let go where the
// player is (a chair over its ramp, a drag short of its wheel, a cabin out
// of its station) and skates off onto the run his group skis off that top
// — the leader waiting at the top for the rest (`crowd.ts`'s regroup).
//
// As rough as the rest of the crowd: a queue is a list, a place in it a
// point on the corral's lane (`queueSpot`), a skate a straight line at
// `CROWD.ride.skate`. Every choice is drawn off the crowd's own stream.

import { strideRate } from "./poles.ts";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { CROWD } from "./defs/crowd.ts";
import { TUNING } from "./defs/tuning.ts";
import {
  DRAG_ARM,
  carrierAt,
  carrierCount,
  carrierPassing,
  liftPlans,
  queueSpot,
  ropeAt,
  upRope,
  type LiftPlan,
} from "./lift-line.ts";
import type { Amateur, CrowdState, GameEvent, GameState } from "./state.ts";

const R = CROWD.ride;
const dt = TUNING.dt;

/** The runs a lift's top serves, as the crowd's network numbers them, and
 * whether a skier of `skill` would choose one. */
export type LiftRuns = {
  runs: readonly {
    from: string;
    top: boolean;
    grade: string;
    pts: readonly { x: number; z: number; y: number; s: number }[];
  }[];
  weight(run: number, skill: number): number;
};

/** Where along the line a carrier takes the queue's front, m: a chair's
 * and a drag's load line, a cabin as it leaves the station. */
function loadAt(plan: LiftPlan): number {
  return plan.lift.kind === "gondola" ? 2 : plan.look.entry.at;
}

/** Where along the line a carrier lets its riders go, m. */
function offAt(plan: LiftPlan): number {
  return plan.length - Math.max(plan.look.off, plan.lift.kind === "gondola" ? 8 : 0);
}

/** AT THE FOOT OF THE MOUNTAIN: the lift his group takes — the one it is
 * already queueing for, else one whose foot is in reach, by the runs off
 * its top he would ski, how near, how short its queue — and his place at
 * the back of its queue. False where no lift is in reach. */
export function joinQueue(state: GameState, crowd: CrowdState, net: LiftRuns, a: Amateur): boolean {
  const plans = liftPlans(state.level);
  if (plans.length === 0) return false;
  while (crowd.queues.length < plans.length) crowd.queues.push([]);
  const g = crowd.groups[a.group];
  let lift = g.queue;
  if (lift < 0) {
    lift = pickLift(crowd.rng, crowd, net, plans, a);
    if (lift < 0) return false;
    g.queue = lift;
    g.next = -1;
  }
  a.mode = "queue";
  a.lift = lift;
  a.speed = 0;
  crowd.queues[lift].push(a.id);
  return true;
}

function pickLift(
  rng: Rng,
  crowd: CrowdState,
  net: LiftRuns,
  plans: readonly LiftPlan[],
  a: Amateur,
): number {
  const weights = plans.map((p, i) => {
    const d = hypot(p.lift.bottom.x - a.x, p.lift.bottom.z - a.z);
    if (d > R.reach) return 0;
    let serves = 0;
    net.runs.forEach((r, k) => {
      if (r.top && r.from === p.lift.id) serves += net.weight(k, a.knobs.skill);
    });
    // ...and the shorter ride the likelier, a lift lapped being a short one.
    return (
      serves / (1 + d / 100) / (1 + R.queued * crowd.queues[i].length) / (1 + p.length / R.lapped)
    );
  });
  const total = weights.reduce((t, w) => t + w, 0);
  if (total <= 0) return -1;
  let at = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    at -= weights[i];
    if (at <= 0 && weights[i] > 0) return i;
  }
  return weights.findIndex((w) => w > 0);
}

/** THE LIFTS' STEP: every queue shuffled up and its front taken by the
 * carrier passing the load line, every rider carried, every one let go at
 * the top skating off to his run. */
export function stepCrowdLifts(state: GameState, crowd: CrowdState, net: LiftRuns): void {
  const plans = liftPlans(state.level);
  for (let i = 0; i < crowd.queues.length && i < plans.length; i++) {
    const plan = plans[i];
    const q = crowd.queues[i];
    // The queue: each skates up to his place in the line.
    q.forEach((id, slot) => standInLine(state, crowd.amateurs[id], plan, slot));
    // The carrier at the load line takes the front of the line — those
    // who are there — but for the T-bar the player stood waiting for on
    // its track: that one is his.
    const k = carrierPassing(plan, loadAt(plan), state.t, dt);
    if (k < 0) continue;
    const mine = state.skier.lift;
    if (
      mine &&
      mine.index === i &&
      (mine.phase === "wait" || (mine.phase === "ride" && mine.t < 2 * dt))
    )
      continue;
    let seat = taken(crowd, i, k);
    while (q.length > 0 && seat < R.seats[plan.lift.kind]) {
      const a = crowd.amateurs[q[0]];
      const spot = queueSpot(plan, seat);
      if (hypot(a.x - spot.x, a.z - spot.z) > 2.5) break;
      q.shift();
      a.mode = "ride";
      a.carrier = k;
      a.seat = seat++;
      a.timer = 0;
    }
  }
  for (const a of crowd.amateurs) {
    if (a.mode === "ride") ride(state, crowd, net, plans, a);
    else if (a.mode === "skate") skate(state, a);
  }
}

/** How many already ride carrier `k` of lift `lift` — the next free seat. */
function taken(crowd: CrowdState, lift: number, k: number): number {
  let n = 0;
  for (const a of crowd.amateurs) if (a.mode === "ride" && a.lift === lift && a.carrier === k) n++;
  return n;
}

/** WHERE A GONDOLA'S RIDERS GO IN: through the door in the back of its
 * station, and `INSIDE` m on into the house, where he is out of sight. */
const INSIDE = 2.5;
function doorWay(plan: LiftPlan): { x: number; z: number } {
  const u = plan.look.entry.at + INSIDE;
  return { x: plan.lift.bottom.x + plan.dx * u, z: plan.lift.bottom.z + plan.dz * u };
}
function walkInWay(plan: LiftPlan, seat: number): number {
  const from = queueSpot(plan, seat);
  const door = doorWay(plan);
  return Math.max(0.1, hypot(door.x - from.x, door.z - from.z));
}
function walkInTime(plan: LiftPlan, seat: number): number {
  return walkInWay(plan, seat) / R.skate;
}

/** WHETHER AN AMATEUR RIDING A LIFT IS OUT OF SIGHT: in a gondola's cabin
 * — through its station's door and into the house — he is. */
export function inCabin(a: Amateur, plan: LiftPlan | undefined): boolean {
  return a.mode === "ride" && plan?.lift.kind === "gondola" && a.timer >= walkInTime(plan, a.seat);
}

/** In the line: skating up to his place, then stood in it facing the load
 * line. */
function standInLine(state: GameState, a: Amateur, plan: LiftPlan, slot: number): void {
  const spot = queueSpot(plan, slot);
  // Shouldered aside: put off his place, and shuffling back to it as the
  // stagger settles.
  const sh = a.shove;
  if (sh) {
    sh.stagger = Math.max(0, sh.stagger - dt / BRUSH.settle);
    const back = Math.min(1, (BRUSH.home * dt) / (hypot(sh.x, sh.z) || 1));
    if (sh.stagger < 0.5) {
      sh.x -= sh.x * back;
      sh.z -= sh.z * back;
    }
    spot.x += sh.x;
    spot.z += sh.z;
    if (sh.stagger <= 0 && hypot(sh.x, sh.z) < 0.02) delete a.shove;
  }
  const dx = spot.x - a.x;
  const dz = spot.z - a.z;
  const d = hypot(dx, dz);
  const step = R.skate * dt;
  if (d > step) {
    a.x += (dx / d) * step;
    a.z += (dz / d) * step;
    a.heading = Math.atan2(dx, dz);
    a.speed = R.skate;
    a.push = 1;
    a.pole += strideRate(a.speed) * dt;
  } else {
    a.x = spot.x;
    a.z = spot.z;
    a.heading = spot.heading;
    a.speed = 0;
    a.push = 0;
  }
  a.y = state.level.groundAt(a.x, a.z);
  a.vx = a.speed * Math.sin(a.heading);
  a.vz = a.speed * Math.cos(a.heading);
  stood(a);
  if (a.shove) {
    // The stagger: thrown off his balance to the side he was pushed, his
    // arms out, caught and stood straight again.
    const k = a.shove.stagger;
    const wobble = Math.sin((1 - k) * Math.PI * 3) * k;
    a.lean = a.shove.side * BRUSH.lean * (0.6 * k + 0.4 * wobble);
    a.crouch = 0.15 + 0.25 * k;
    a.push = Math.max(a.push, k);
    a.pole += dt * 6 * k;
  }
}

/** THE PLAYER SHOULDERING PAST A QUEUE: how near he comes before someone
 * stood in it is pushed out of his way, m (the two of them side by side);
 * how much further he is put, m; the stagger's lean at its worst, rad;
 * how long it takes to settle, s; and how fast he shuffles back to his
 * place once it has, m/s. */
const BRUSH = { reach: 0.85, extra: 0.25, lean: 0.35, settle: 1.4, home: 0.6 };

/** THE PLAYER SKATING UP A QUEUE (`lift-ride.ts`'s boarding) or stood
 * waiting on a drag's track: everyone stood in a queue that he comes
 * within `BRUSH.reach` of is shouldered aside — pushed off across his way
 * and staggered — and a `bump` reported for the first touch of each. Run
 * each step the lift has him on the snow. */
export function brushQueue(state: GameState, crowd: CrowdState, events: GameEvent[]): void {
  const c = state.skier;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  for (const a of crowd.amateurs) {
    if (a.mode !== "queue") continue;
    const dx = a.x - c.x;
    const dz = a.z - c.z;
    if (Math.abs(dx) > 2 || Math.abs(dz) > 2) continue;
    const d = hypot(dx, dz);
    if (d >= BRUSH.reach) continue;
    // Pushed across his way, to whichever side of it he stands.
    const right = dx * fz - dz * fx;
    const side = right >= 0 ? 1 : -1;
    const nx = fz * side;
    const nz = -fx * side;
    const need = BRUSH.reach - d + BRUSH.extra;
    const sh = a.shove ?? { x: 0, z: 0, stagger: 0, side: 0 };
    if (!a.shove || a.shove.stagger < 0.3)
      events.push({
        kind: "bump",
        t: state.t,
        rival: -1,
        speed: Math.max(0.5, c.speed),
        amateur: a.id,
      });
    sh.x += nx * need;
    sh.z += nz * need;
    sh.stagger = 1;
    // Seen from his own facing: pushed to his right or his left.
    sh.side = nx * Math.cos(a.heading) - nz * Math.sin(a.heading) >= 0 ? 1 : -1;
    a.shove = sh;
    a.x += nx * need;
    a.z += nz * need;
  }
}

/** The figure stood on his skis, going nowhere fast. */
function stood(a: Amateur): void {
  a.lean = 0;
  a.crouch = 0.15;
  a.plough = 0;
  a.across = 0;
  a.fall = 0;
}

/** On his carrier, where its clock has it: sat on a chair's seat, stood
 * behind a T-bar on the snow under it, in a cabin; and at the top let go. */
function ride(
  state: GameState,
  crowd: CrowdState,
  net: LiftRuns,
  plans: readonly LiftPlan[],
  a: Amateur,
): void {
  const plan = plans[a.lift];
  if (!plan) {
    a.mode = "ski";
    return;
  }
  a.timer += dt;
  const kind = plan.lift.kind;
  if (kind === "gondola" && a.timer < walkInTime(plan, a.seat)) {
    // In at the station's door from his place in the line, and on into
    // the house — out of sight once he is through it.
    const from = queueSpot(plan, a.seat);
    const way = walkInWay(plan, a.seat);
    const k = Math.min(1, (a.timer * R.skate) / way);
    const door = doorWay(plan);
    a.x = from.x + (door.x - from.x) * k;
    a.z = from.z + (door.z - from.z) * k;
    a.y = state.level.groundAt(a.x, a.z);
    a.heading = Math.atan2(door.x - from.x, door.z - from.z);
    a.speed = R.skate;
    a.vx = Math.sin(a.heading) * a.speed;
    a.vz = Math.cos(a.heading) * a.speed;
    stood(a);
    a.push = 1;
    a.pole += dt * 3;
    return;
  }
  const at = carrierAt(plan, a.carrier, state.t);
  const seats = R.seats[kind];
  const across = (a.seat - (seats - 1) / 2) * (kind === "drag" ? 2 * R.tee : R.seat);
  const side = (kind === "drag" ? DRAG_ARM : upRope(plan)) + (kind === "gondola" ? 0 : across);
  a.x = plan.lift.bottom.x + plan.dx * at.u + plan.dz * side;
  a.z = plan.lift.bottom.z + plan.dz * at.u - plan.dx * side;
  a.y =
    kind === "drag"
      ? state.level.groundAt(a.x, a.z)
      : ropeAt(plan, at.u) - (kind === "gondola" ? R.under + 2 : R.under);
  a.heading = plan.heading;
  a.speed = plan.look.speed;
  a.vx = plan.dx * a.speed;
  a.vz = plan.dz * a.speed;
  stood(a);
  if (kind === "drag") a.crouch = 0.3;
  if (at.side === 0 && at.u < offAt(plan)) return;
  // AT THE TOP: off onto the run his group skis off this top.
  letGo(state, crowd, net, plan, a);
}

/** Let go at a lift's top: stood where the carrier lets him go, and set to
 * skate to where he joins the run his group chose off this top. */
function letGo(
  state: GameState,
  crowd: CrowdState,
  net: LiftRuns,
  plan: LiftPlan,
  a: Amateur,
): void {
  const g = crowd.groups[a.group];
  const off = offAt(plan);
  const sx = plan.lift.bottom.x + plan.dx * off;
  const sz = plan.lift.bottom.z + plan.dz * off;
  a.x = sx;
  a.z = sz;
  a.y = state.level.groundAt(sx, sz);
  if (g.next < 0 || net.runs[g.next]?.from !== plan.lift.id) {
    let skill = 1;
    for (const m of g.members) skill = Math.min(skill, crowd.amateurs[m].knobs.skill);
    g.next = pickTop(crowd.rng, net, plan.lift.id, skill);
  }
  // Everyone of the group up: the next time it comes down, it chooses again.
  if (g.members.every((m) => crowd.amateurs[m].mode !== "queue")) g.queue = -1;
  a.lift = -1;
  if (g.next < 0) {
    a.mode = "lift";
    return;
  }
  // Where he joins it: its nearest point below him, a little way down.
  const r = net.runs[g.next];
  let best = Infinity;
  let at = r.pts[0];
  for (const p of r.pts) {
    if (p.y > a.y - 1 && p.s > 0) continue;
    const d = hypot(p.x - sx, p.z - sz);
    if (d < best) {
      best = d;
      at = p;
    }
  }
  a.mode = "skate";
  a.run = g.next;
  a.tx = at.x;
  a.tz = at.z;
  a.ts = at.s;
}

function pickTop(rng: Rng, net: LiftRuns, lift: string, skill: number): number {
  let total = 0;
  net.runs.forEach((r, k) => {
    if (r.top && r.from === lift) total += net.weight(k, skill);
  });
  if (total <= 0) return -1;
  let at = rng.next() * total;
  for (let k = 0; k < net.runs.length; k++) {
    const r = net.runs[k];
    if (!r.top || r.from !== lift) continue;
    at -= net.weight(k, skill);
    if (at <= 0) return k;
  }
  return -1;
}

/** Off the top, skating to his run: on it, he skis it from where he
 * joined it. True once he is on it. */
function skate(state: GameState, a: Amateur): boolean {
  const dx = a.tx - a.x;
  const dz = a.tz - a.z;
  const d = hypot(dx, dz);
  const step = R.skate * dt;
  a.heading = Math.atan2(dx, dz);
  if (d > step) {
    a.x += (dx / d) * step;
    a.z += (dz / d) * step;
    a.y = state.level.groundAt(a.x, a.z);
    a.speed = R.skate;
    a.vx = a.speed * Math.sin(a.heading);
    a.vz = a.speed * Math.cos(a.heading);
    a.push = 1;
    a.pole += strideRate(a.speed) * dt;
    return false;
  }
  a.mode = "ski";
  a.s = a.ts;
  a.d = 0;
  a.centre = 0;
  a.yaw = 0;
  a.speed = R.skate;
  a.push = 0;
  a.wander = 0;
  a.kickerAt = NaN;
  return true;
}

/** Whether an amateur is the lifts' just now — in a queue, riding, or
 * skating off the top — rather than on his run. */
export function onLift(a: Amateur): boolean {
  return a.mode === "queue" || a.mode === "ride" || a.mode === "skate" || a.mode === "lift";
}

/** A RIDE AT THE START: a group dealt onto a lift rather than the snow —
 * stood in its queue at its foot. False with no lift to stand at. */
export function dealQueued(
  state: GameState,
  crowd: CrowdState,
  net: LiftRuns,
  members: readonly number[],
): boolean {
  const plans = liftPlans(state.level);
  if (plans.length === 0) return false;
  while (crowd.queues.length < plans.length) crowd.queues.push([]);
  const lead = crowd.amateurs[members[0]];
  // As if at the foot: anywhere along the floor the lifts stand on.
  const p = plans[crowd.rng.int(0, plans.length - 1)];
  lead.x = p.lift.bottom.x;
  lead.z = p.lift.bottom.z;
  for (const m of members) {
    const a = crowd.amateurs[m];
    a.x = lead.x;
    a.z = lead.z;
    if (!joinQueue(state, crowd, net, a)) return false;
    const plan = plans[a.lift];
    const spot = queueSpot(plan, crowd.queues[a.lift].length - 1);
    a.x = spot.x;
    a.z = spot.z;
    a.y = state.level.groundAt(spot.x, spot.z);
    a.heading = spot.heading;
    stood(a);
  }
  return true;
}

/** A RIDE ALREADY UNDER WAY AT THE START: a group dealt onto a lift's
 * carriers part-way up — the chairs full from the first frame, as on a
 * mountain that has been open all morning. False with no lift to ride. */
export function dealRiding(
  state: GameState,
  crowd: CrowdState,
  net: LiftRuns,
  members: readonly number[],
): boolean {
  const plans = liftPlans(state.level);
  if (plans.length === 0) return false;
  while (crowd.queues.length < plans.length) crowd.queues.push([]);
  const rng = crowd.rng;
  const skill = Math.min(...members.map((m) => crowd.amateurs[m].knobs.skill));
  const weights = plans.map((p) => {
    let serves = 0;
    net.runs.forEach((r, k) => {
      if (r.top && r.from === p.lift.id) serves += net.weight(k, skill);
    });
    return serves / (1 + p.length / R.lapped);
  });
  const total = weights.reduce((t, w) => t + w, 0);
  if (total <= 0) return false;
  let at = rng.next() * total;
  let lift = 0;
  for (; lift < plans.length - 1; lift++) {
    at -= weights[lift];
    if (at <= 0) break;
  }
  const plan = plans[lift];
  const n = carrierCount(plan);
  // A carrier on the way up, somewhere along the line.
  let k = rng.int(0, n - 1);
  for (let tries = 0; tries < n; tries++, k = (k + 1) % n) {
    const c = carrierAt(plan, k, state.t);
    if (c.side === 0 && c.u > 0.1 * plan.length && c.u < 0.85 * plan.length) break;
  }
  const seats = R.seats[plan.lift.kind];
  // Filling the free seats of one carrier and then the one below it.
  let seat = taken(crowd, lift, k);
  for (const m of members) {
    for (let tries = 0; seat >= seats && tries < n; tries++) {
      k = (k - 1 + n) % n;
      seat = taken(crowd, lift, k);
    }
    const a = crowd.amateurs[m];
    a.mode = "ride";
    a.lift = lift;
    a.carrier = k;
    a.seat = seat++;
    a.timer = R.sit;
  }
  const g = crowd.groups[crowd.amateurs[members[0]].group];
  g.queue = lift;
  g.next = -1;
  return true;
}
