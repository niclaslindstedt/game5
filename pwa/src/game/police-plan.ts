// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLICE ON THE RUN AFTER A DEATH, PLANNED — what the machine called to
// a fatal accident (`rescue-book.ts` books it when a run ends DEAD) and its
// officers do at every moment of the call. Three-free and DOM-free, a pure
// function of the seconds since the call, so the suite reads it;
// `police-view.ts` draws the scene and `rescue-view.ts` the machine and the
// people. The research is `docs/police.md`.
//
// THE MACHINE is the air ambulance's (`rescue-flight.ts`): flown in and set
// down the same way, on a patch kept off the cordon. THREE OFFICERS climb
// out — the scene lead, the marker officer, the photographer — and, in
// order:
//
// 1. THE SURVEY: the lead and the marker officer walk the line between
//    the impact and the body, slowly, from whichever end is the nearer walk
//    from the door, and stand at the other end a moment.
// 2. THE CORDON: the lead walks to the first stake (the shortest walk from
//    her and, tied off, to where the recovery starts), drives it in, and
//    runs the tape stake to stake round the whole scene and back to the
//    first, where she ties it off — the tape run out as she walks.
// 3. THE MARKERS: the marker officer kneels at every item of evidence in
//    its number's order, from the impact down to the body, and stands a
//    numbered tent at each.
// 4. THE PHOTOGRAPHS: the photographer walks briskly to the cordon's four
//    corners outside it and shoots the scene whole from each, then — as the
//    markers are stood — a mid-range shot of each pair and a close-up
//    crouched over each, two exposures every one, each with a flash.
// 5. THE RECOVERY: once the last exposure is taken (the photographer walks
//    back aboard as it starts), two ski patrollers carry the body bag in
//    down the hill (`police-carry.ts`), the marker officer takes its front,
//    and the lead, the marker officer and the two roll him into it and
//    carry him out as the ambulance's crew carry a casualty
//    (`rescue-plan.ts`'s trip, its scoop and its carry, at a body bag's
//    pace), the machine lifts and is gone — and the cordon and the markers
//    with it. Landing to lift-off is two and a half to four minutes.
//
// Nobody walks through the body or the machine: every way walked is
// routed round both (`police-scene.ts`' `route`). `tests/police_plan_test.ts`
// holds it.

import { HELI, type Evidence, type Level } from "@engine";

import { CROWD_LOOKS } from "./crowd-rig.ts";
import {
  carriedAt,
  carrierAt,
  carryActs,
  liftAt,
  planCarryIn,
  strideOf,
  type CarryIn,
} from "./police-carry.ts";
import { OFFICERS, PHOTO, POLICE, freshCrewPose, freshSceneFrame } from "./police-defs.ts";
import type { Act, Marker, P2, Path, SceneFrame } from "./police-defs.ts";
import {
  clearOf,
  headingTo,
  onPath,
  outOf,
  ringOf,
  route,
  toSeg,
  type Keep,
} from "./police-scene.ts";
import { CAMERA_AT, RESCUE_STRIDE } from "./rescue-crew.ts";
import {
  BEARERS,
  RESCUE,
  ease,
  freshRescueFrame,
  fwdOf,
  wrap,
  type CrewPose,
} from "./rescue-defs.ts";
import {
  doorStep,
  flightAt,
  freshFlightFrame,
  inCabin,
  planFlight,
  type FlightFrame,
  type RescueFlight,
} from "./rescue-flight.ts";
import { scoopAt } from "./rescue-scoop.ts";

/** THE CALL, PLANNED: the evidence and its markers, the cordon's stakes
 * (each's clock driven in) and its spans (each's clock the tape is run
 * along it), his line, the walkers' keeps, every officer's stretches of
 * work by crew slot (`acts`, the four bearers then the photographer), the
 * flashes, the machine's flight (its trip's start moved to the recovery)
 * and the moments each part of it starts, s from the call. */
export type PolicePlan = {
  evidence: Evidence[];
  markers: Marker[];
  ring: P2[];
  stakes: number[];
  spans: { t0: number; t1: number }[];
  body: { a: P2; b: P2; heading: number };
  keeps: Keep[];
  acts: Act[][];
  flashes: { t: number; x: number; y: number; z: number }[];
  /** The bag carried in by the two patrollers (`police-carry.ts`). */
  carry: CarryIn;
  flight: RescueFlight;
  at: {
    out: number;
    survey: number;
    cordon: number;
    taped: number;
    marked: number;
    shot: number;
    recover: number;
    lift: number;
    gone: number;
  };
};

/** One officer's work being written: his stretches, where he is, which
 * way he faces, the clock, and how far he has walked. */
type Track = { acts: Act[]; x: number; z: number; heading: number; t: number; walked: number };

function track(at: P2, heading: number, t: number): Track {
  return { acts: [], x: at.x, z: at.z, heading, t, walked: 0 };
}

/** Walk `tr` to `to` at `pace` along a way kept off `keeps`. */
function walk(tr: Track, to: P2, pace: number, keeps: readonly Keep[], fromY?: number): void {
  const path: Path = route({ x: tr.x, z: tr.z }, to, keeps);
  if (path.length < 0.05) {
    tr.x = to.x;
    tr.z = to.z;
    return;
  }
  const t1 = tr.t + path.length / pace;
  tr.acts.push({ kind: "walk", t0: tr.t, t1, path, walked: tr.walked, fromY });
  const end = onPath(path, path.length);
  tr.x = end.x;
  tr.z = end.z;
  tr.heading = end.heading;
  tr.walked += path.length;
  tr.t = t1;
}

type Doing = Extract<Act, { kind: "still" }>["doing"];

/** Stand, kneel, bend or shoot where `tr` is for `dur` s, facing `heading`. */
function still(tr: Track, dur: number, doing: Doing, heading = tr.heading): void {
  if (dur <= 0) return;
  tr.acts.push({
    kind: "still",
    t0: tr.t,
    t1: tr.t + dur,
    x: tr.x,
    z: tr.z,
    heading,
    from: tr.heading,
    walked: tr.walked,
    doing,
  });
  tr.heading = heading;
  tr.t += dur;
}

/** Stand where `tr` is until `t`. */
function until(tr: Track, t: number, heading = tr.heading): void {
  still(tr, t - tr.t, "stand", heading);
}

const unit = (x: number, z: number): P2 => {
  const l = Math.hypot(x, z) || 1;
  return { x: x / l, z: z / l };
};

/** THE CALL TO A DEATH at (`x`, `z`), its evidence numbered (the body
 * last): the machine, the cordon, the markers, every officer's work. */
export function planPolice(
  level: Level,
  call: { x: number; z: number; evidence: Evidence[] },
): PolicePlan {
  const evidence = call.evidence.length
    ? call.evidence
    : [{ what: "body" as const, x: call.x, z: call.z }];
  const ring = ringOf(evidence);
  const flight = planFlight(
    level,
    [{ x: call.x, z: call.z, known: 0 }],
    ring,
    RESCUE.bagWalk,
    RESCUE.bagBeside,
  );
  const trip = flight.trips[0];
  const plan = trip.plan;
  const site = flight.site;
  // HIS LINE: as the ambulance's plan lays him, his head along the way its
  // carry first goes.
  const [p0, p1] = plan.path.pts;
  const bh = headingTo(p0, p1);
  const bf = fwdOf(bh);
  const spot = { x: plan.spot.x, z: plan.spot.z };
  const B = POLICE.body.half;
  const body = {
    a: { x: spot.x - bf.x * B, z: spot.z - bf.z * B },
    b: { x: spot.x + bf.x * B, z: spot.z + bf.z * B },
    heading: bh,
  };
  // THE KEEPS: his line, the cabin, the boom.
  const mf = fwdOf(site.heading);
  const on = (z: number): P2 => ({ x: site.x + mf.x * z, z: site.z + mf.z * z });
  const keeps: Keep[] = [
    { a: body.a, b: body.b, r: POLICE.body.room },
    { a: on(HELI.body.nose), b: on(-1.6), r: HELI.body.width / 2 + POLICE.machine.cabin },
    { a: on(-1.6), b: on(HELI.body.tail), r: POLICE.machine.boom },
  ];
  const clear = (p: P2): P2 => outOf(p, keeps);
  // THE LINE OF THE SCENE: from the impact (or his feet) to him, and the
  // side of it the machine is on.
  const first = evidence[0];
  const axis =
    first.what !== "body" ? unit(spot.x - first.x, spot.z - first.z) : { x: bf.x, z: bf.z };
  let side = { x: -axis.z, z: axis.x };
  if ((site.x - spot.x) * side.x + (site.z - spot.z) * side.z < 0)
    side = { x: -side.x, z: -side.z };
  // THE MARKERS: at each item (the body's beyond his head), each with the
  // way the officer and the camera come to it from — off him where it is
  // near him, else from the machine's side of the line.
  const markers: Marker[] = [];
  const spots: { kneel: P2; mid: P2; close: P2 }[] = [];
  evidence.forEach((e, i) => {
    const at =
      e.what === "body"
        ? { x: spot.x + bf.x * POLICE.marker.head, z: spot.z + bf.z * POLICE.marker.head }
        : clear({ x: e.x, z: e.z });
    const off = toSeg(at, body.a, body.b);
    let u: P2;
    if (e.what === "body") u = bf;
    else if (off < 3) {
      const mx = (body.a.x + body.b.x) / 2;
      const mz = (body.a.z + body.b.z) / 2;
      u = unit(at.x - mx, at.z - mz);
    } else u = side;
    const out = (d: number, turn = 0): P2 => {
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      return clear({ x: at.x + (u.x * c - u.z * s) * d, z: at.z + (u.x * s + u.z * c) * d });
    };
    const close = out(POLICE.close);
    spots.push({ kneel: out(POLICE.marker.off), mid: out(POLICE.mid, 0.6), close });
    markers.push({ ...e, x: at.x, z: at.z, n: i + 1, facing: headingTo(at, close), placed: 0 });
  });

  // OUT OF THE DOOR, one behind the other.
  const t0 = flight.down + RESCUE.flight.out;
  const door = doorStep(plan, 1.4);
  const doorAt = (k: number): P2 => clear({ x: door.x + mf.x * k, z: door.z + mf.z * k });
  const out = (j: number, k: number): Track => {
    const cab = inCabin(flight, plan, j);
    const tr = track(cab, cab.heading, t0 + 0.8 * j);
    walk(tr, doorAt(k), POLICE.pace, [], cab.y);
    return tr;
  };
  const lead = out(0, 0.7);
  const mark = out(1, -0.1);
  const photo = out(2, -0.9);
  // 1. THE SURVEY: the two walk the line between the impact and him, a pace
  // apart — from whichever end is the nearer walk from the door, and stand
  // a moment at the far end looking back along it.
  const near = (k: number): P2 =>
    clear({
      x: spot.x - axis.x * 2.4 + side.x * k,
      z: spot.z - axis.z * 2.4 + side.z * k,
    });
  const atImpact = (k: number): P2 => clear({ x: first.x + side.x * k, z: first.z + side.z * k });
  const pair = [
    [lead, 0.7],
    [mark, -0.7],
  ] as const;
  const struck = first.what !== "body";
  const up =
    struck && route(lead, near(0.7), keeps).length + 4 < route(lead, atImpact(0.7), keeps).length;
  const [from, to] = up ? [near, atImpact] : [atImpact, near];
  const [fromP, toP] = up ? [spot, first] : [first, spot];
  if (struck) {
    for (const [tr, k] of pair) walk(tr, from(k), POLICE.pace, keeps);
    const met = Math.max(lead.t, mark.t) + 2;
    for (const [tr] of pair) until(tr, met, headingTo(fromP, toP));
  }
  const surveyAt = Math.max(lead.t, mark.t);
  for (const [tr, k] of pair) walk(tr, to(k), POLICE.survey, keeps);
  const briefed = Math.max(lead.t, mark.t) + POLICE.brief;
  for (const [tr] of pair) until(tr, briefed, headingTo(tr, up ? spot : toP));

  // 2. THE CORDON: stake by stake round the ring and back to the first —
  // the one that is the shortest walk from her and, tied off, to where the
  // recovery will start (`scoopAt`'s first moment).
  const form = scoopAt(level, plan, 0, freshRescueFrame()).crew;
  const n = ring.length;
  const stakes: number[] = new Array<number>(n).fill(Infinity);
  const spans = ring.map(() => ({ t0: Infinity, t1: Infinity }));
  const cost = (p: P2): number =>
    Math.hypot(p.x - lead.x, p.z - lead.z) + Math.hypot(p.x - form[0].x, p.z - form[0].z);
  let i0 = 0;
  for (let i = 1; i < n; i++) if (cost(ring[i]) < cost(ring[i0])) i0 = i;
  const cordon = lead.t;
  const stakeAt = (i: number): P2 => ring[i % n];
  walk(lead, stakeAt(i0), POLICE.pace, keeps);
  for (let k = 0; k <= n; k++) {
    const i = (i0 + k) % n;
    if (k > 0) {
      const from = lead.t;
      walk(lead, stakeAt(i), POLICE.tape, keeps);
      spans[(i - 1 + n) % n] = { t0: from, t1: lead.t };
    }
    const along = headingTo(stakeAt(i), stakeAt(i + 1));
    if (k < n) {
      still(lead, POLICE.cordon.plant, "bend", along);
      stakes[i] = lead.t - POLICE.cordon.plant * 0.4;
    } else still(lead, POLICE.cordon.tie, "bend", lead.heading);
  }
  const taped = lead.t;
  // Then out of the way, outside the ring where the recovery will start.
  const waitBy = { x: (form[0].x + form[1].x) / 2, z: (form[0].z + form[1].z) / 2 };
  const outside = (k: number): P2 => {
    let best = ring[0];
    for (const p of ring)
      if (
        Math.hypot(p.x - waitBy.x, p.z - waitBy.z) <
        Math.hypot(best.x - waitBy.x, best.z - waitBy.z)
      )
        best = p;
    const o = unit(best.x - spot.x, best.z - spot.z);
    return clear({ x: best.x + o.x * 1.6 - o.z * k, z: best.z + o.z * 1.6 + o.x * k });
  };
  // (She waits by the stake she tied off at, outside the ring.)

  // 3. THE MARKERS, in their order.
  for (let k = 0; k < markers.length; k++) {
    walk(mark, spots[k].kneel, POLICE.pace, keeps);
    const face = headingTo(spots[k].kneel, markers[k]);
    still(mark, POLICE.marker.kneel, "kneel", face);
    markers[k].placed = mark.t - POLICE.marker.kneel / 2;
  }
  const marked = mark.t;
  walk(mark, outside(-1.2), POLICE.pace, keeps);

  // 4. THE PHOTOGRAPHS: the four corners of the cordon's box, outside it.
  const flashes: PolicePlan["flashes"] = [];
  const k = CROWD_LOOKS[OFFICERS[2].body].height / 1.8;
  const shoot = (tr: Track, at: P2, low: boolean): void => {
    const heading = headingTo(tr, at);
    still(tr, POLICE.shot.raise * 0.5, "stand", heading);
    const begin = tr.t;
    still(tr, POLICE.shot.hold, low ? "shootLow" : "shoot", heading);
    const c = low ? CAMERA_AT.low : CAMERA_AT.high;
    const f = fwdOf(heading);
    const x = tr.x + f.x * c.z * k;
    const z = tr.z + f.z * c.z * k;
    for (const dt of POLICE.shot.flashes)
      flashes.push({ t: begin + dt, x, y: level.groundAt(x, z) + c.y * k, z });
  };
  const ax = axis;
  const ac = { x: -ax.z, z: ax.x };
  let lo = [Infinity, Infinity];
  let hi = [-Infinity, -Infinity];
  for (const p of ring) {
    const a = (p.x - spot.x) * ax.x + (p.z - spot.z) * ax.z;
    const c = (p.x - spot.x) * ac.x + (p.z - spot.z) * ac.z;
    lo = [Math.min(lo[0], a), Math.min(lo[1], c)];
    hi = [Math.max(hi[0], a), Math.max(hi[1], c)];
  }
  const G = POLICE.corner;
  const box = (a: number, c: number): P2 =>
    clear({ x: spot.x + ax.x * a + ac.x * c, z: spot.z + ax.z * a + ac.z * c });
  const corners = [
    box(lo[0] - G, lo[1] - G),
    box(hi[0] + G, lo[1] - G),
    box(hi[0] + G, hi[1] + G),
    box(lo[0] - G, hi[1] + G),
  ];
  const middle = box((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2);
  let c0 = 0;
  for (let i = 1; i < 4; i++)
    if (
      Math.hypot(corners[i].x - photo.x, corners[i].z - photo.z) <
      Math.hypot(corners[c0].x - photo.x, corners[c0].z - photo.z)
    )
      c0 = i;
  // Round the outside of the box: the next corner along its edge.
  for (let i = 0; i < 4; i++) {
    const cnr = corners[(c0 + i) % 4];
    walk(photo, cnr, POLICE.brisk, keeps);
    shoot(photo, middle, false);
  }
  // ...then the markers as they are stood: a mid-range shot relating each
  // pair (a marker and the next), and a close-up of each.
  for (let m = 0; m < markers.length; m++) {
    if (m % 2 === 0) {
      const next = markers[Math.min(m + 1, markers.length - 1)];
      const both = { x: (markers[m].x + next.x) / 2, z: (markers[m].z + next.z) / 2 };
      walk(photo, spots[m].mid, POLICE.brisk, keeps);
      until(photo, Math.max(photo.t, next.placed + 1.2), headingTo(photo, both));
      shoot(photo, both, false);
    }
    walk(photo, spots[m].close, POLICE.pace, keeps);
    until(photo, Math.max(photo.t, markers[m].placed + 1.2), headingTo(photo, markers[m]));
    shoot(photo, markers[m], true);
  }
  const shot = photo.t;
  // 5. THE RECOVERY: the photographer back aboard (walking there as it
  // starts); the lead, the marker officer and the two patrollers (down the
  // hill with the bag) gathered where the ambulance's crew start their
  // scoop (`scoopAt`'s first moment).
  const cab = (() => {
    const c = inCabin(flight, plan, 2);
    return clear({ x: c.x + plan.out.x * 1.3, z: c.z + plan.out.z * 1.3 });
  })();
  walk(photo, cab, POLICE.pace, keeps);
  const travel = (tr: Track, j: number): number => route(tr, form[j], keeps).length / POLICE.pace;
  const recover =
    Math.max(
      lead.t + travel(lead, 0),
      mark.t + travel(mark, 1) + 1.5,
      taped + 1,
      marked + 1,
      shot + 1,
    ) + POLICE.gather;
  // The lead to her place for the roll; the marker officer to the bag's
  // front right, there before it is carried in, to take it from the
  // patroller who brings it.
  const arrive = recover - POLICE.gather;
  const gather = (tr: Track, j: number, by: number): void => {
    until(tr, by - travel(tr, j), headingTo(tr, spot));
    walk(tr, form[j], POLICE.pace, keeps);
    until(tr, by, form[j].heading);
  };
  gather(lead, 0, recover);
  still(lead, 600, "stand");
  gather(mark, 1, arrive - 1.5);
  until(mark, arrive + POLICE.handover);
  still(mark, recover - mark.t, "hold");
  still(mark, 600, "hold");
  still(photo, POLICE.board, "stand", headingTo(photo, cab));
  still(photo, Math.max(recover, photo.t) + 600 - photo.t, "gone");
  // THE BAG CARRIED IN by the two patrollers, down the hill; then the front
  // one lets go to the marker officer and steps round to his own place.
  const fall = downhill(level, form[2].x, form[2].z);
  const carry = planCarryIn(plan, keeps, ring, fall, arrive, POLICE.pace, POLICE.handover, recover);
  const patrols = carryActs(carry).map((acts, k) => {
    const p = carrierAt(carry, k, arrive);
    const tr: Track = { acts, x: p.x, z: p.z, heading: p.heading, t: arrive, walked: p.walked };
    if (k === 0) {
      until(tr, arrive + POLICE.handover);
      walk(tr, form[2], POLICE.pace, []);
    }
    until(tr, recover, form[2 + k].heading);
    still(tr, 600, "stand");
    return tr;
  });

  // THE MACHINE'S TRIP, from them gathered: its scoop at once.
  const shift = recover - trip.offset;
  trip.begin = recover;
  trip.offset = recover;
  flight.lift += shift;
  flight.gone += shift;
  return {
    evidence,
    markers,
    ring,
    stakes,
    spans,
    body,
    keeps,
    acts: [lead.acts, mark.acts, patrols[0].acts, patrols[1].acts, photo.acts],
    flashes,
    carry,
    flight,
    at: {
      out: t0,
      survey: surveyAt,
      cordon,
      taped,
      marked,
      shot,
      recover,
      lift: flight.lift,
      gone: flight.gone,
    },
  };
}

/** The way down the hill at (x, z), horizontal, unit (+z on the flat). */
function downhill(level: Level, x: number, z: number): P2 {
  const d = 8;
  const gx = level.groundAt(x - d, z) - level.groundAt(x + d, z);
  const gz = level.groundAt(x, z - d) - level.groundAt(x, z + d);
  return Math.hypot(gx, gz) < 1e-3 ? { x: 0, z: 1 } : unit(gx, gz);
}

/** THE MOMENT: the machine, the four bearers and the photographer (crew
 * slot `PHOTO`), the trip's stretcher and him, and the scene. */
export type PoliceFrame = FlightFrame & { scene: SceneFrame };

export function freshPoliceFrame(): PoliceFrame {
  const f = freshFlightFrame() as PoliceFrame;
  f.crew.push(freshCrewPose());
  f.scene = freshSceneFrame();
  return f;
}

/** ONE OFFICER (or patroller) at `t` off his stretches of work. */
function actAt(level: Level, acts: readonly Act[], t: number, c: CrewPose): void {
  if (!acts.length || t < acts[0].t0) {
    c.shown = false;
    return;
  }
  let a = acts[acts.length - 1];
  for (const act of acts) {
    if (t < act.t1) {
      a = act;
      break;
    }
  }
  c.shown = true;
  if (a.kind === "carry") {
    const p = carrierAt(a.carry, a.k, t);
    c.x = p.x;
    c.z = p.z;
    c.y = level.groundAt(p.x, p.z);
    c.heading = p.heading;
    c.move = {
      rise: 1,
      stride: strideOf(p.walked) + a.k * 0.5,
      walking: p.walking,
      hand: p.hand,
      raise: 0,
    };
    return;
  }
  if (a.kind === "walk") {
    const u = Math.max(0, Math.min(1, (t - a.t0) / (a.t1 - a.t0 || 1)));
    const d = u * a.path.length;
    const p = onPath(a.path, d);
    c.x = p.x;
    c.z = p.z;
    const g = level.groundAt(p.x, p.z);
    c.y = a.fromY === undefined ? g : a.fromY + (g - a.fromY) * ease(u / 0.4);
    c.heading = p.heading;
    c.move = {
      rise: 1,
      stride: (a.walked + d) / RESCUE_STRIDE,
      walking: u < 1 ? 1 : 0,
      hand: null,
      raise: 0,
    };
    return;
  }
  c.x = a.x;
  c.z = a.z;
  c.y = level.groundAt(a.x, a.z);
  c.heading = a.from + wrap(a.heading - a.from) * ease((t - a.t0) / 0.7);
  const k = ease((t - a.t0) / 0.7) * ease((a.t1 - t) / 0.6);
  c.shown = a.doing !== "gone";
  c.move = { rise: 1, stride: a.walked / RESCUE_STRIDE, walking: 0, hand: null, raise: 0 };
  if (a.doing === "hold") c.move.hand = BEARERS[1].hand;
  if (a.doing === "kneel") Object.assign(c.move, { face: k, work: "tend", reach: 0 });
  if (a.doing === "bend") c.move.bend = k;
  if (a.doing === "shoot" || a.doing === "shootLow")
    Object.assign(c.move, { shoot: k, low: a.doing === "shootLow" ? 1 : 0 });
}

/** The flash at `t`: its share of full and where it fires. */
export function flashAt(
  plan: PolicePlan,
  t: number,
  out: SceneFrame["flash"],
): SceneFrame["flash"] {
  out.power = 0;
  for (const f of plan.flashes) {
    const dt = t - f.t;
    if (dt < 0 || dt >= POLICE.flash.life) continue;
    const p = Math.exp(-dt / POLICE.flash.decay);
    if (p > out.power) {
      out.power = p;
      out.x = f.x;
      out.y = f.y;
      out.z = f.z;
    }
  }
  return out;
}

/** THE CALL `t` s after it was made, written into `out`. */
export function policeAt(level: Level, plan: PolicePlan, t: number, out: PoliceFrame): PoliceFrame {
  flightAt(level, plan.flight, t, out);
  if (t < plan.at.recover) {
    for (let j = 0; j < plan.acts.length; j++) actAt(level, plan.acts[j], t, out.crew[j]);
    // The bag on its frame in the patrollers' hands, and set where the
    // scoop takes it up.
    if (t >= plan.carry.t0) carriedAt(level, plan.carry, t, out.trips[0].stretcher);
  } else actAt(level, plan.acts[PHOTO], t, out.crew[PHOTO]);
  const sc = out.scene;
  sc.up = t >= plan.at.out && t < plan.flight.lift;
  sc.planted.length = plan.stakes.length;
  for (let i = 0; i < plan.stakes.length; i++) sc.planted[i] = plan.stakes[i] <= t;
  sc.stakes = sc.planted.filter(Boolean).length;
  sc.tape.length = plan.spans.length;
  sc.lift.length = plan.spans.length;
  for (let i = 0; i < plan.spans.length; i++) {
    const s = plan.spans[i];
    sc.tape[i] = t <= s.t0 ? 0 : t >= s.t1 ? 1 : (t - s.t0) / (s.t1 - s.t0);
    sc.lift[i] = liftAt(plan.carry, i, t, POLICE.pace);
  }
  sc.markers = plan.markers.filter((m) => m.placed <= t).length;
  flashAt(plan, t, sc.flash);
  return out;
}

/** Whether a point is clear of the scene's keeps (the suite's). */
export const clearOfScene = (plan: PolicePlan, p: P2, slack = 0): boolean =>
  clearOf(p, plan.keeps, slack);
