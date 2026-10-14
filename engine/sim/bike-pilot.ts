// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT ON THE DOWNHILL BIKE (`bike.ts`): a trail of the bike park ridden
// from its head to its foot as a rider rides it, through the player's own
// keys (`bike.ts`'s `bikeInput`, `bikeControls` turned round):
//
//   * THE LINE: the bars aimed at a point of the trail's centre line a
//     look-ahead down it (pure pursuit), the turn asked a share of the
//     tightest the speed allows;
//   * THE SPEED: the grade's cruising speed, held under what every bend
//     ahead allows (the grip's lateral g, a berm's bank more) and braked to
//     in time, and on the approach to a TABLE, a GAP or a STEP-DOWN the speed
//     its lip needs to carry the deck (the projectile's range off the lip's
//     angle, the kicker's climb added back), pedalled up to or braked down
//     to; a DROP rolled off slow;
//   * THE BODY: a pop off every kicker (the legs folded on its face, sprung
//     at the lip), the weight back off a ledge until the rear is over it,
//     and in the air the bike pitched to the ground below it — its landing's
//     slope — by his lean.
//
// Pure over the state and its memo (`BikeAim`, the arc it has got to);
// nothing here draws from any stream.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { bikeTrailById } from "../mapgen/bike-park-query.ts";
import type { BikeFeature, BikeTrail, BikeTrailPoint } from "../mapgen/bike-park-types.ts";
import { bikeInput, bikeWithin } from "../game/bike.ts";
import { bikeSteerFor, bikeTurnAsked } from "../game/bike-body.ts";
import {
  NEUTRAL_INPUT,
  type BikeControls,
  type GameState,
  type SkierInput,
} from "../game/state.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { BIKE } from "../game/defs/bike.ts";
import { summerSurfaceAt } from "../game/summer-ground.ts";

const G = 9.81;

/** THE BOT'S HAND, by the trail's grade: its cruising speed, m/s, the
 * lateral g it corners on, and how hard it brakes for what is ahead, m/s². */
export const BIKE_PILOT = {
  cruise: { green: 5, blue: 6, red: 7, black: 7.5 } as Record<string, number>,
  race: 9,
  corner: 0.22,
  /** The share of the tread's grip a bend is taken on. */
  share: 0.5,
  /** The share of the grip a bend and the brakes holding the speed down
   * its pitch are taken on together. */
  steep: 0.7,
  brake: 3,
  /** The levers: squeezed past `over` m/s over the speed wanted, by `squeeze`
   * and `gain` per m/s more, at most `most`, eased over `ease` s; pedalled
   * `under` m/s short of it. */
  speed: { over: 0.2, under: 1, squeeze: 0.15, gain: 0.3, most: 0.8, ease: 0.12 },
  /** The bars: the bend read `preview` s of way ahead, the heading's and
   * the line's errors fed back (1/s and 1/s²), and the lateral g the hands
   * are asked the share of; `ease` the time its hands take onto a new ask, s. */
  line: {
    ease: 0.15,
    preview: 0.9,
    heading: 1.2,
    lateral: 0.6,
    fix: 0.6,
    pursuit: 0,
    near: 3,
    predict: 0.7,
  },
  /** How far before a lip the approach speed is held, m, and how far past
   * its landing's end the bot rides on as it would anywhere. */
  approach: 35,
  /** A ledge rolled off at this, m/s. */
  drop: 4.5,
  /** The range a lip is aimed past its deck, m: onto the landing's top. */
  over: 1.5,
} as const;

/** A BERM ridden up its wall: the share of the half-width off the centre
 * toward its outside, and how far before and after it the line eases on
 * and off, m. */
const BERM = { up: 0.7, ease: 8 };

/** THE BOT'S MEMO: the trail it rides and the arc it has got to, m; the
 * levers' squeeze and the speed wanted; and its WARINESS — the share of
 * speed it gives up near where it last fell (`fell`, m), grown with every
 * fall there and forgotten once past, as a rider takes a section that threw
 * him slower the next time. */
export type BikeAim = {
  trail: string;
  s: number;
  brake: number;
  want: number;
  wary: number;
  fell: number;
  down: boolean;
  /** The bars it last asked, -1..1, eased toward the line's ask. */
  steer: number;
};

/** How wary a fall makes the bot: the share given up a fall, the most, how
 * far before and past the spot it rides slower, m, how wary it rolls the
 * jumps there, and the crawl it never slows below for it, m/s. */
const WARY = { step: 0.2, most: 0.8, before: 60, past: 25, roll: 0.4, crawl: 3 };

/** The length of a kicker's face the levers are left alone on, m. */
const KICKER_FACE = 10;

/** A memo for `run`'s bike: the trail it was begun on (or `trail`), from
 * its head. */
export function bikeAim(run: GameState, trail?: string): BikeAim {
  return {
    trail: trail ?? run.bike?.trail ?? "",
    s: 0,
    brake: 0,
    want: 0,
    wary: 0,
    fell: -1,
    down: false,
    steer: 0,
  };
}

/** The station of `t` at or before arc `s`. */
function indexAt(t: BikeTrail, s: number): number {
  const p = t.points;
  let lo = 0;
  let hi = p.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p[mid].s <= s) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The point of `t` at arc `s`, its line read between its stations. */
function pointAt(t: BikeTrail, s: number): BikeTrailPoint {
  return t.points[indexAt(t, clamp(s, 0, t.length))];
}

/** The memo's arc moved to the station nearest the bike near where it was
 * (anywhere down the trail, when it is far from there: a restart). */
function follow(t: BikeTrail, aim: BikeAim, x: number, z: number): void {
  if (seek(t, aim, x, z, indexAt(t, aim.s - 15), indexAt(t, aim.s + 25)) > 6)
    seek(t, aim, x, z, 0, t.points.length - 1);
}

/** The memo's arc moved to the nearest station from `i0` to `i1`; the
 * distance to it, m. */
function seek(t: BikeTrail, aim: BikeAim, x: number, z: number, i0: number, i1: number): number {
  const p = t.points;
  let best = Infinity;
  for (let i = i0; i <= i1 && i < p.length; i++) {
    const d = hypot(p[i].x - x, p[i].z - z);
    if (d < best) {
      best = d;
      aim.s = p[i].s;
    }
  }
  return best;
}

/** The lip speed that carries a kicker of `angle` deg `range` m onto ground
 * as high as its lip: the projectile's range, R = v² sin 2θ / g. */
function lipSpeed(angle: number, range: number): number {
  const two = Math.sin((2 * Math.max(angle, 8) * Math.PI) / 180);
  return Math.sqrt((G * range) / Math.max(0.2, two));
}

/** What a feature ahead asks of the speed at its foot, m/s: [the least, the
 * most] — or null for one that asks nothing. */
function featureSpeed(f: BikeFeature): [number, number] | null {
  if (f.lip === undefined) return null;
  if (f.kind === "drop") return [0, BIKE_PILOT.drop];
  const climb = Math.max(0, f.height);
  let lip: number;
  if (f.kind === "stepdown") lip = lipSpeed(f.angle ?? 30, 2.5 + f.height);
  else lip = lipSpeed(f.angle ?? 25, (f.knuckle ?? f.lip) - f.lip + BIKE_PILOT.over);
  const foot = Math.sqrt(lip * lip + 2 * G * climb) * 1.04;
  return [foot - 0.4, foot + 0.4];
}

/** The bend of `t` at arc `s`, 1/m, over 6 m: + to the right. */
function signedBend(t: BikeTrail, s: number): number {
  const a = pointAt(t, s - 3);
  const b = pointAt(t, s + 3);
  return angleDiff(a.heading, b.heading) / Math.max(1, b.s - a.s);
}

/** How sharply `t` bends at arc `s`, 1/m. */
function bendAt(t: BikeTrail, s: number): number {
  return Math.abs(signedBend(t, s));
}

/** The berm's bank, rad, where `s` is on one of `t`'s, else 0. */
function bankAt(t: BikeTrail, s: number): number {
  for (const f of t.features)
    if (f.kind === "berm" && s >= f.from && s <= f.to) return ((f.angle ?? 0) * Math.PI) / 180;
  return 0;
}

/** THE LINE ACROSS THE TREAD at arc `s`, m right of its centre: up the
 * bank of a berm (a berm's wall rises toward its outside edge — its middle
 * is near flat), eased onto it before it and off it after; the centre
 * anywhere else. */
function lineAt(t: BikeTrail, s: number): number {
  for (const f of t.features) {
    if (f.kind !== "berm" || s < f.from - BERM.ease || s > f.to + BERM.ease) continue;
    const into = Math.min(s - (f.from - BERM.ease), f.to + BERM.ease - s) / BERM.ease;
    const turn = Math.sign(signedBend(t, (f.from + f.to) / 2)) || 1;
    const half = pointAt(t, clamp(s, f.from, f.to)).width / 2;
    return -turn * BERM.up * half * Math.min(1, into);
  }
  return 0;
}

/** THE SPEED THE BOT WANTS where it is: [the least, the most], m/s. */
function speedOf(t: BikeTrail, s: number, v: number, mu: number): [number, number] {
  const P = BIKE_PILOT;
  let most = t.kind === "race" ? P.race : (P.cruise[t.grade] ?? 7);
  let least = 0;
  // Every bend ahead, braked to in time — on a steep pitch the brakes
  // fight the fall line too, so the hand reckons on less.
  const a = pointAt(t, s);
  const z = pointAt(t, s + 15);
  const grade = Math.max(0, (a.y - z.y) / Math.max(1, z.s - a.s));
  const brake = Math.max(1, Math.min(P.brake, G * (P.share * mu - grade)));
  const reach = (v * v) / (2 * brake) + 6;
  for (let d = 0; d <= reach; d += 2) {
    const k = bendAt(t, s + d);
    if (k < 1e-3) continue;
    const bank = bankAt(t, s + d);
    // On a steep pitch the brakes holding the speed take their share of
    // the grip, and the turn has what is left of it.
    const a0 = pointAt(t, s + d - 3);
    const a1 = pointAt(t, s + d + 3);
    const pitch = Math.max(0, (a0.y - a1.y) / Math.max(1, a1.s - a0.s));
    const budget = P.steep * mu;
    const left = Math.sqrt(Math.max(0.0025, budget * budget - pitch * pitch));
    const lat = G * Math.min(P.corner, P.share * mu, left) * (1 + 0.5 * bank);
    const vc = Math.sqrt(lat / k);
    most = Math.min(most, Math.sqrt(vc * vc + 2 * brake * d));
  }
  // The jump ahead, held from its approach to its lip.
  for (const f of t.features) {
    if (f.lip === undefined || s > f.lip || s < f.from - P.approach) continue;
    const want = featureSpeed(f);
    if (!want) continue;
    if (s < f.from) {
      most = Math.min(most, want[1]);
      least = Math.max(least, Math.min(want[0], most));
    }
    break;
  }
  // The trail's foot: stopped there.
  const left = t.length - s;
  most = Math.min(most, Math.sqrt(Math.max(0, 2 * P.brake * (left - 4))));
  return [Math.min(least, most), most];
}

/** The feature `s` is on or just past the lip of. */
function featureNear(t: BikeTrail, s: number): BikeFeature | null {
  for (const f of t.features)
    if (f.lip !== undefined && s >= f.from - 4 && s <= f.lip + 4) return f;
  return null;
}

/** THE INPUT THE BOT RIDES `run`'s bike with, its memo `aim` moved on. */
export function bikePilot(run: GameState, aim: BikeAim): SkierInput {
  const b = run.bike;
  const c = run.skier;
  if (c.thrown && !aim.down && b) {
    // Thrown: wary of this spot the next time.
    const again = aim.fell >= 0 && Math.abs(aim.s - aim.fell) < WARY.before;
    aim.wary = again ? Math.min(WARY.most, aim.wary + WARY.step) : WARY.step;
    aim.fell = aim.s;
  }
  aim.down = !!c.thrown;
  if (!b || c.thrown || b.mode === "lift") return { ...NEUTRAL_INPUT };
  if (!b.onIt) {
    if (!b.afoot) return { ...NEUTRAL_INPUT };
    if (bikeWithin(run)) return { ...NEUTRAL_INPUT, machine: true };
    // Walked back to it.
    const off = angleDiff(c.heading, Math.atan2(b.x - c.x, b.z - c.z));
    return { ...NEUTRAL_INPUT, steer: clamp(off * 2, -1, 1), tuck: 1 };
  }
  const t = bikeTrailById(run.level, aim.trail);
  if (!t) return { ...NEUTRAL_INPUT, brake: 1 };
  follow(t, aim, b.x, b.z);
  const v = Math.max(0, b.way);
  const ctl: BikeControls = { pedal: 0, front: 0, rear: 0, steer: 0, lean: 0, crouch: 0 };
  // THE LINE: the bend the trail takes a breath ahead (the lean builds
  // that long), and the bike brought back onto the centre line and onto its
  // heading — the turn asked as a share of the tightest the hands ask at
  // this speed.
  const P = BIKE_PILOT.line;
  const here = pointAt(t, aim.s);
  // The bend read over the next `preview` s of way: the lean takes that
  // long to build, and as long to come off again at the bend's end.
  const ff = P.preview * v + 1;
  const kff =
    (signedBend(t, aim.s + 1 + ff * 0.25) +
      signedBend(t, aim.s + 1 + ff * 0.6) +
      signedBend(t, aim.s + 1 + ff)) /
    3;
  const rx = Math.cos(here.heading);
  const rz = -Math.sin(here.heading);
  const lateral = (b.x - here.x) * rx + (b.z - here.z) * rz;
  const psi = angleDiff(b.heading, pointAt(t, aim.s + 0.5).heading);
  const ve = Math.max(v, 2);
  // Both errors read where they will be once the lean the bars are asking
  // now has come (`predict` s on): the turn the bike is making carried on.
  const turning = b.wy - v * signedBend(t, aim.s);
  const psiP = psi - turning * P.predict;
  const latP = lateral - v * Math.sin(psi) * P.predict;
  const fix = (P.heading * psiP) / ve - (P.lateral * (latP - lineAt(t, aim.s))) / (ve * ve);
  // The hands lay it over inside what the tread holds (`bike-body.ts`): the
  // turn asked as a share of that.
  const mu = summerSurfaceAt(run.level, b.x, b.z).grip;
  const most = bikeTurnAsked(BIKE.hands.knee, ve, mu, run.assist.yaw);
  // The way back onto the line asks at most `P.fix` of what the bars can.
  let kappa = kff + clamp(fix, -P.fix * most, P.fix * most);
  if (P.pursuit > 0) {
    // PURE PURSUIT: the arc through a point on the line a lean's time and
    // more ahead — the bend, the heading and the offset in one.
    const L = Math.max(P.near, P.pursuit * v);
    const ahead = pointAt(t, aim.s + L);
    const off = lineAt(t, ahead.s);
    const tx = ahead.x + Math.cos(ahead.heading) * off - b.x;
    const tz = ahead.z - Math.sin(ahead.heading) * off - b.z;
    const alpha = angleDiff(b.heading, Math.atan2(tx, tz));
    kappa = (2 * Math.sin(alpha)) / Math.max(1, hypot(tx, tz));
  }
  // Its hands ease the bars onto the line's ask: the line's read jumps a
  // little station to station, a rider's hands do not.
  const bars = b.airborne ? 0 : bikeSteerFor(clamp(kappa, -most, most), ve, mu, run.assist.yaw);
  aim.steer += (bars - aim.steer) * Math.min(1, TUNING.dt / P.ease);
  ctl.steer = aim.steer;
  // THE SPEED.
  if (aim.wary > 0 && aim.s > aim.fell + WARY.past) aim.wary = 0;
  const near = aim.wary > 0 && aim.s > aim.fell - WARY.before;
  // Wary enough, it ROLLS the jumps there rather than taking them: no
  // approach speed held, no pop, the levers free on the kicker.
  const rolling = near && aim.wary >= WARY.roll;
  const [held, fast] = speedOf(t, aim.s, v, mu);
  const least = rolling ? 0 : held;
  const want = near ? Math.min(fast, Math.max(WARY.crawl, fast * (1 - aim.wary))) : fast;
  aim.want = want;
  const f = featureNear(t, aim.s);
  // Hands off the levers only on the kicker's face itself (its last
  // `face` m): a long run-in is ridden as any other ground.
  const lip = f?.lip ?? 0;
  const onKicker =
    !rolling &&
    f !== null &&
    f.kind !== "drop" &&
    aim.s >= Math.max(f.from, lip - KICKER_FACE) &&
    aim.s <= lip;
  // The way read off the rider and the bike together — the frame alone
  // rocks fore and aft under him on his arms and legs.
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  const rider = b.rider.vx * fx + b.rider.vz * fz;
  const vs = Math.max(0, (rider * b.riderMass + b.way * BIKE.mass) / (b.riderMass + BIKE.mass));
  // The levers squeezed and let off smoothly, braked in what the turn
  // leaves of the grip (hardest straight up).
  const S = BIKE_PILOT.speed;
  let lever = 0;
  if (!b.airborne && !onKicker && vs > want + S.over) {
    const used = Math.min(1, Math.abs(kappa) / most);
    lever = clamp(S.squeeze + (vs - want) * S.gain, 0, S.most) * Math.max(0.5, 1 - used * used);
  }
  aim.brake += (lever - aim.brake) * Math.min(1, TUNING.dt / S.ease);
  if (aim.brake > 0.02) {
    ctl.front = aim.brake;
    ctl.rear = aim.brake;
    ctl.lean = 0.25 + aim.brake * 0.5;
  } else if (!b.airborne && !onKicker && vs < Math.max(least, want - S.under)) ctl.pedal = 1;
  // THE BODY.
  if (f && f.lip !== undefined && !b.airborne) {
    const to = f.lip - aim.s;
    if (f.kind === "drop") {
      if (to < 1 && to > -1.6) ctl.lean = 1;
    } else if (to < 3 && to > 0.6 && !rolling) ctl.crouch = 1;
  }
  if (b.airborne) {
    // The bike pitched to the ground ahead of it: the landing's slope.
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const ahead = run.level.groundAt(b.x + fx * 2, b.z + fz * 2);
    const behind = run.level.groundAt(b.x, b.z);
    const slope = Math.atan2(ahead - behind, 2);
    ctl.lean = clamp(-4 * (b.pitch - slope) + 0.1, -1, 1);
  }
  return bikeInput(ctl);
}
