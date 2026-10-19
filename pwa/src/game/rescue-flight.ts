// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE AIR AMBULANCE'S CALL, PLANNED — the machine flown in when the run
// after an injured one starts, and every casualty it takes off the
// mountain (`rescue-book.ts` decides which casualties a machine takes and
// when each was found; `rescue-plan.ts` plans each one's scoop, carry and
// loading — a TRIP). Three-free and DOM-free, a pure function of the
// seconds since the call, so the suite reads it; `rescue-view.ts` draws it.
//
// THE CALL (`planFlight`): the machine comes in from down the valley, slows
// into a hover over the patch picked for the first casualty and sets down
// on it (`heliArriving`). Its crew climb out with the board and walk round
// him to the side he is scooped from — a LEAD walked together, the board
// between the two who carry it (`leadAt`) — and the first trip runs. A
// second casualty found while it is still on the snow, near enough and
// with a stretcher's room in its cabin (`RESCUE.flight`), is the second
// trip: once the first is slid in, the four come back out of the door and
// walk to him. It lifts after its last trip is loaded and leaves down the
// valley (`heliLeaving`). The research is `docs/rescue.md`.

import { HELI, fromEuler, rotate, type Level, type Vec3 } from "@engine";

import { RESCUE_STRIDE } from "./rescue-crew.ts";
import {
  BEARERS,
  RESCUE,
  ease,
  fwdOf,
  freshRescueFrame,
  hy,
  rightOf,
  wrap,
  type CrewPose,
  type P2,
  type RescueFrame,
  type RescuePlan,
} from "./rescue-defs.ts";
import { heliArriving, heliLeaving, planRescue, tripAt, type RescueSite } from "./rescue-plan.ts";
import { scoopAt } from "./rescue-scoop.ts";

/** A casualty a machine is called to: where he lay, and the call's clock
 * he was found at, s (the first at 0). */
export type Called = { x: number; z: number; known: number };

/** ONE TRIP: a casualty's plan (`rescue-plan.ts`, its clock from the
 * scoop's start), when he was found, when the crew set out for him from
 * the door, when the scoop starts, and the way they walk there. */
export type FlightTrip = {
  plan: RescuePlan;
  known: number;
  begin: number;
  offset: number;
  lead: { pts: P2[]; s: number[]; length: number };
};

/** THE CALL: where it sits and leaves to, when it touches down, its
 * trips, when it lifts and when it is gone, s from the call. */
export type RescueFlight = {
  site: RescueSite;
  away: number;
  down: number;
  trips: FlightTrip[];
  lift: number;
  gone: number;
};

const Q = RESCUE.scoop;
const F = RESCUE.flight;

/** The door's middle on the snow, a step out from the skin. */
export function doorStep(plan: RescuePlan, out = 1.4): P2 {
  const mid = plan.cabin;
  const off = RESCUE.door.skin + out;
  return { x: mid.x + plan.out.x * off, z: mid.z + plan.out.z * off };
}

/** The way the scoop's first step points (the carry's first heading). */
function scoopHeading(plan: RescuePlan): number {
  const [a, b] = plan.path.pts;
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Where the scoop's walk-up starts: its formation's origin. */
function scoopOrigin(plan: RescuePlan): P2 {
  const f = fwdOf(scoopHeading(plan));
  return { x: plan.spot.x - f.x * Q.approach, z: plan.spot.z - f.z * Q.approach };
}

/** A polyline resampled every `STEP` m and smoothed by a running mean
 * `reach` m either side (`REACH` unless asked; narrowed at its ends, which stay where they are),
 * so no corner on it is tighter than a walker's turn. */
const STEP = 0.25;
const REACH = 2;

export function smoothPath(raw: P2[], reach = REACH): FlightTrip["lead"] {
  let pts: P2[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i];
    const n = Math.max(1, Math.ceil(hy(b.x - a.x, b.z - a.z) / STEP));
    for (let k = 1; k <= n; k++)
      pts.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  const w = Math.round(reach / STEP);
  for (let it = 0; it < 3; it++) {
    const next: P2[] = [];
    for (let i = 0; i < pts.length; i++) {
      const r = Math.min(w, i, pts.length - 1 - i);
      let x = 0;
      let z = 0;
      for (let k = i - r; k <= i + r; k++) {
        x += pts[k].x;
        z += pts[k].z;
      }
      next.push({ x: x / (2 * r + 1), z: z / (2 * r + 1) });
    }
    pts = next;
  }
  const s: number[] = [0];
  for (let i = 1; i < pts.length; i++)
    s.push(s[i - 1] + hy(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, s, length: s[s.length - 1] };
}

/** How wide the lead's turn behind him is, m (its radius). */
const ROUND = 4.5;

/** THE LEAD: from the door, out, past him on the door's side, round
 * behind him in a wide turn and in on the way the scoop's walk-up comes,
 * straight for its last metres. */
function leadOf(plan: RescuePlan): FlightTrip["lead"] {
  const h = scoopHeading(plan);
  const f = fwdOf(h);
  const rt = rightOf(h);
  const o = scoopOrigin(plan);
  const d = doorStep(plan);
  const d2 = doorStep(plan, 4.5);
  const side = (d.x - plan.spot.x) * rt.x + (d.z - plan.spot.z) * rt.z >= 0 ? 1 : -1;
  const at = (ahead: number, across: number): P2 => ({
    x: o.x + f.x * ahead + rt.x * side * across,
    z: o.z + f.z * ahead + rt.z * side * across,
  });
  const out: P2[] = [d, d2, at(Q.approach - 1, 2 * ROUND)];
  // The turn: a half circle from walking away down his side to walking in.
  const back = -6;
  for (let k = 0; k <= 8; k++) {
    const th = (k / 8) * Math.PI;
    out.push(at(back - ROUND * Math.sin(th), ROUND + ROUND * Math.cos(th)));
  }
  out.push(at(-1.5, 0), o);
  return smoothPath(out);
}

/** THE CALL to `casualties` (the first at the call's 0), the machine set
 * down for the first — off a cordon's ring (`avoid`) where one is given. */
export function planFlight(
  level: Level,
  casualties: readonly Called[],
  avoid: readonly P2[] | null = null,
): RescueFlight {
  const first = planRescue(level, casualties[0], null, avoid);
  const site: RescueSite = { ...first.site };
  delete (site as Partial<RescuePlan["site"]>).side;
  const trips: FlightTrip[] = [];
  for (let k = 0; k < casualties.length; k++) {
    const c = casualties[k];
    const plan = k === 0 ? first : planRescue(level, c, site);
    const lead = leadOf(plan);
    const prev = trips[k - 1];
    const begin = prev
      ? Math.max(prev.offset + prev.plan.at.slide + RESCUE.time.slide + 0.4, c.known + 1)
      : F.arrive + F.out;
    const offset = begin + F.gather + lead.length / Q.pace;
    trips.push({ plan, known: c.known, begin, offset, lead });
  }
  const last = trips[trips.length - 1];
  const lift = last.offset + last.plan.at.lift;
  return { site, away: first.away, down: F.arrive, trips, lift, gone: lift + RESCUE.time.away };
}

/** THE MOMENT: the machine, the four, and each trip's stretcher and
 * casualty (`trips[k]`, its crew unread). */
export type FlightFrame = {
  heli: RescueFrame["heli"];
  crew: CrewPose[];
  trips: RescueFrame[];
  /** The trip the four are on, or −1 while they are in the cabin. */
  active: number;
};

export function freshFlightFrame(): FlightFrame {
  const f = freshRescueFrame();
  return { heli: f.heli, crew: f.crew, trips: [], active: -1 };
}

const scratch = freshRescueFrame();
const formation = freshRescueFrame();

/** Where the lead is at arc `d`: its point and its heading — past either
 * end, straight on along that end's way. */
export function leadAt(
  lead: FlightTrip["lead"],
  d: number,
): { x: number; z: number; heading: number } {
  const { pts, s, length } = lead;
  const at = Math.max(0, Math.min(length, d));
  let i = 0;
  while (i < s.length - 2 && s[i + 1] < at) i++;
  const u = (d - s[i]) / (s[i + 1] - s[i] || 1);
  const a = pts[i];
  const b = pts[i + 1];
  return {
    x: a.x + (b.x - a.x) * u,
    z: a.z + (b.z - a.z) * u,
    heading: Math.atan2(b.x - a.x, b.z - a.z),
  };
}

/** A place in the scoop's first moment (`slot`) carried down the lead:
 * as far ahead of the formation's origin and as far to its side, at arc
 * `d` of it — each of them walks his own line beside the lead, never
 * swung round it as a rigid frame. */
export function onLead(
  lead: FlightTrip["lead"],
  d: number,
  o: P2,
  h: number,
  slot: P2,
): { x: number; z: number; turn: number } {
  const f = fwdOf(h);
  const rt = rightOf(h);
  const dx = slot.x - o.x;
  const dz = slot.z - o.z;
  const p = leadAt(lead, d + dx * f.x + dz * f.z);
  const r = rightOf(p.heading);
  const across = dx * rt.x + dz * rt.z;
  return { x: p.x + r.x * across, z: p.z + r.z * across, turn: wrap(p.heading - h) };
}

/** How far down the lead its origin starts: the hindmost of them out of
 * the door, not still in the cabin. */
function leadStart(o: P2, h: number, slots: readonly P2[]): number {
  const f = fwdOf(h);
  let least = 0;
  for (const p of slots) least = Math.min(least, (p.x - o.x) * f.x + (p.z - o.z) * f.z);
  return -least + 0.5;
}

/** Where a man is in the cabin, sat behind the door: his step out of it. */
export function inCabin(
  flight: RescueFlight,
  plan: RescuePlan,
  j: number,
): Vec3 & { heading: number } {
  const q = fromEuler(flight.site.heading, flight.site.pitch, flight.site.roll);
  const w = rotate(q, {
    x: RESCUE.door.skin - 0.35,
    y: HELI.body.floor,
    z: RESCUE.door.z + 0.45 - 0.3 * j,
  });
  return {
    x: flight.site.x + w.x,
    y: flight.site.y + w.y,
    z: flight.site.z + w.z,
    heading: Math.atan2(plan.out.x, plan.out.z),
  };
}

/** THE CALL `t` s after it was made, written into `out`. */
export function flightAt(
  level: Level,
  flight: RescueFlight,
  t: number,
  out: FlightFrame,
): FlightFrame {
  // THE MACHINE: in, sat, away.
  const h = out.heli;
  h.spool = 1;
  h.shown = t < flight.gone;
  if (t < flight.down) heliArriving(level, flight.site, flight.away, flight.down - t, h);
  else if (t < flight.lift) {
    heliLeaving(level, flight.site, flight.away, -1, h);
    // Settled onto its skids, the pitch on the blades let down.
    h.thrust = 1 - 0.85 * ease((t - flight.down) / RESCUE.time.spool);
  } else heliLeaving(level, flight.site, flight.away, t - flight.lift, h);
  // EACH TRIP'S STRETCHER AND CASUALTY.
  while (out.trips.length < flight.trips.length) out.trips.push(freshRescueFrame());
  out.trips.length = flight.trips.length;
  let active = -1;
  for (let k = 0; k < flight.trips.length; k++) if (t >= flight.trips[k].begin) active = k;
  for (let k = 0; k < flight.trips.length; k++) {
    const trip = flight.trips[k];
    const f = out.trips[k];
    if (t >= trip.offset) tripAt(level, trip.plan, t - trip.offset, f);
    else {
      // Lying as he was found, until they come for him.
      scoopAt(level, trip.plan, -1, f);
      f.stretcher.shown = false;
    }
    f.casualty.shown = t >= trip.known && f.casualty.shown;
    f.stretcher.shown &&= t >= trip.known;
  }
  out.active = active;
  // THE FOUR: in the cabin, on the lead, or on their trip.
  if (active < 0) {
    for (const c of out.crew) c.shown = false;
    return out;
  }
  const trip = flight.trips[active];
  if (t >= trip.offset) {
    const f = out.trips[active];
    for (let j = 0; j < BEARERS.length; j++) copyCrew(f.crew[j], out.crew[j]);
    return out;
  }
  leadInto(level, flight, active, t, out);
  return out;
}

function copyCrew(from: CrewPose, to: CrewPose): void {
  to.x = from.x;
  to.y = from.y;
  to.z = from.z;
  to.heading = from.heading;
  to.shown = from.shown;
  to.move = { ...from.move };
}

/** THE FOUR on trip `k`'s lead at `t`: gathered at the door (out of the
 * cabin, or back from where the last trip left them), then walked round to
 * the scoop's start as one, the board between its two. */
function leadInto(
  level: Level,
  flight: RescueFlight,
  k: number,
  t: number,
  out: FlightFrame,
): void {
  const trip = flight.trips[k];
  const plan = trip.plan;
  // The scoop's first moment: where each of them stands, the board.
  scoopAt(level, plan, 0, formation);
  const h = scoopHeading(plan);
  const o = scoopOrigin(plan);
  const L = trip.lead.length;
  const into = t - trip.begin;
  const gather = Math.min(1, into / F.gather);
  const walked = Math.min(L, Math.max(0, into - F.gather) * Q.pace);
  const pre = Math.min(L, leadStart(o, h, [...formation.crew, formation.stretcher]));
  const arc = pre + (walked * (L - pre)) / L;
  // Where each of them came from: the cabin, or the last trip.
  let from: CrewPose[] | null = null;
  if (k > 0) {
    const prev = flight.trips[k - 1];
    tripAt(level, prev.plan, trip.begin - prev.offset, scratch);
    from = scratch.crew;
  }
  const st = out.trips[k].stretcher;
  let carriedX = 0;
  let carriedZ = 0;
  let carriers = 0;
  for (let j = 0; j < BEARERS.length; j++) {
    const slot = formation.crew[j];
    const at = onLead(trip.lead, arc, o, h, slot);
    const x = at.x;
    const z = at.z;
    const heading = slot.heading + at.turn;
    const c = out.crew[j];
    c.shown = true;
    let sx: number;
    let sz: number;
    let sy: number;
    let sh: number;
    const src = from?.[j];
    if (src && src.shown) {
      sx = src.x;
      sz = src.z;
      sy = src.y;
      sh = src.heading;
    } else {
      const cab = inCabin(flight, plan, j);
      sx = cab.x;
      sz = cab.z;
      sy = cab.y;
      sh = cab.heading;
    }
    const u = ease(gather);
    c.x = sx + (x - sx) * u;
    c.z = sz + (z - sz) * u;
    const ground = level.groundAt(c.x, c.z);
    // Down out of the door onto the snow in the first part of it.
    c.y = sy + (ground - sy) * ease(gather / 0.4);
    c.heading = sh + wrap(heading - sh) * u;
    const gap = hy(x - sx, z - sz);
    c.move = {
      ...slot.move,
      walking: gather < 1 ? (gap > 0.2 ? 1 : 0) : 1,
      stride: slot.move.stride + (walked - L - (1 - gather) * gap) / RESCUE_STRIDE,
    };
    if (BEARERS[j].across > 0) {
      carriedX += c.x - x;
      carriedZ += c.z - z;
      carriers++;
    }
  }
  // THE BOARD, at its rail in the two carriers' hands.
  const fs = formation.stretcher;
  const at = onLead(trip.lead, arc, o, h, fs);
  st.x = at.x + carriedX / Math.max(1, carriers);
  st.z = at.z + carriedZ / Math.max(1, carriers);
  const lift = fs.y - level.groundAt(fs.x, fs.z);
  st.y = level.groundAt(st.x, st.z) + lift;
  st.heading = fs.heading + at.turn;
  st.pitch = fs.pitch;
  st.roll = fs.roll;
  st.straps = 0;
  st.shown = true;
}

/** A second casualty at (`x`, `z`), found at the call's clock `known`:
 * whether this call's machine can take him — still on the snow when he
 * is found, near enough to carry him to, and a stretcher's room aboard. */
export function canTake(flight: RescueFlight, x: number, z: number, known: number): boolean {
  if (flight.trips.length >= F.seats) return false;
  if (known >= flight.lift - 1) return false;
  return hy(x - flight.site.x, z - flight.site.z) <= F.reach;
}
