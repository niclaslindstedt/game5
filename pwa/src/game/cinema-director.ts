// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FILM DIRECTOR — which shot the picture is on, and for how long, under
// the front door and on a replay's FILM angle (`camera-cinema.ts` stands the
// lens for it). Three-free and DOM-free, so `tests/cinema_camera_test.ts`
// holds the edit without a browser.
//
// The grammar is the action film's ski sequence (`docs/cinema-camera.md`):
// a HARD CUT every two to four seconds, never the same framing twice in a
// row, and the framing chosen for what is happening on the snow — the long
// lens and the helicopter on a fast straight, the boots and the camera skier
// behind him through the turns, the low lens he sprays powder at in the deep
// snow, now and then a wide aerial with him small on the mountain. And for a
// MOMENT that is coming (a flight, a crash, a pass — the replay's own list,
// `replay-shots.ts`, or under the menu the run read ahead, `cinema-ahead.ts`)
// the lens is PLANTED before he gets there: a ride-by at the lip of the
// kicker, then a cut on the action to the lens down by the landing looking
// up at him against the sky — the take-off and the landing as two shots, as
// a film cuts a jump.
//
// A TAKE is the director's whole decision: the framing, the steps it holds
// between, the side of him it is on and the moment it is for. The camera
// asks once a frame; the same take object comes back until the director
// cuts, and a new one is a cut.

import { TUNING } from "@engine";

import type { ReplayShot } from "./replay-shots.ts";

/** Every framing the director cuts between. The first eight FOLLOW him; the
 * ninth, the HANG, follows him too but only through the top of a long
 * flight; the last five are PLANTED off his line before he arrives. */
export const FRAMINGS = [
  "establish",
  "heli",
  "chase",
  "lead",
  "boots",
  "powder",
  "dutch",
  "arc",
  "hang",
  "headon",
  "rideby",
  "lip",
  "hero",
  "crash",
] as const;
export type Framing = (typeof FRAMINGS)[number];

/** The framings the snow's own pace is cut between, between the moments. */
export const FOLLOWS: readonly Framing[] = FRAMINGS.slice(0, 8);

/** THE EDIT, as numbers. Seconds of the run and metres per second. */
export const DIRECTOR = {
  /** A follow shot holds between these, s — an action scene's few seconds. */
  least: 2,
  most: 4,
  /** A planted shot opens this long before the take-off, s, so he has the
   * frame to arrive into; the landing's lens holds this long after the
   * touch-down, s. */
  lead: 1.5,
  hold: 1.1,
  /** A flight shorter than this, s, or lower than `high` m over the snow at
   * its top, is no moment: the shot on the picture follows him over it. A
   * longer one is the lip and then the landing — the cut falling `liftOff`
   * s past the take-off — and one of `hang` s or more has a third shot
   * between them, alongside him through the top of it, cut away to the
   * landing's lens `hangTo` of the way through the flight. */
  big: 0.9,
  high: 1,
  liftOff: 0.15,
  hang: 1.5,
  hangTo: 0.55,
  /** No take holds the picture longer than this of WALL time, s — a long
   * flight in slow motion is cut again rather than held. */
  wallMost: 4.2,
  /** A crash's lens opens this long before the blow and holds this long
   * after it, s. */
  crashLead: 1.1,
  crashHold: 2.4,
  /** A flight too short to frame, s. */
  airLeast: 0.5,
  /** Two finds of one kind within this are one moment, s. */
  same: 0.6,
  /** A gap shorter than this between a shot and the next moment's is
   * bridged by the shot on the picture, s — never a flash of a take. */
  bridge: 1.2,
  /** Every this-many takes off the snow's own pace is the wide aerial. */
  establishEvery: 7,
  /** What the snow and the skier read as: a straight is under `turn` rad/s
   * of yaw at over `fast` m/s; powder is under `powder` packed; a crawl is
   * under `crawl` m/s. */
  fast: 17,
  turn: 0.45,
  powder: 0.45,
  crawl: 5,
} as const;

/** THE SLOW MOTION under the menu: a flight of `least` s or more is run at
 * `rate` of real time over its middle, ramped in and out over `ramp` of it
 * — the hang at the top, never the whole jump. In a replay the replay's own
 * director slows the picture (`replay-shots.ts`) and this is not asked. */
export const CINEMA_SLOW = { least: 0.9, rate: 0.36, ramp: 0.3, peak: 0.5 } as const;

const HZ = TUNING.physicsHz;
const steps = (s: number): number => Math.round(s * HZ);

/** What the director reads of the moment: the run's step and the skier. */
export type Situation = {
  step: number;
  speed: number;
  /** Packed share under him, 0 powder .. 1 groomed. */
  packed: number;
  /** How fast his way is turning, rad/s. */
  turn: number;
  airborne: boolean;
  thrown: boolean;
  /** The wall clock, s — how long a take has truly been on the screen. */
  wall: number;
};

/** ONE TAKE: the framing, the steps it holds between, the side of him (±1)
 * and the moment it was planted for, or null. */
export type Take = {
  framing: Framing;
  from: number;
  until: number;
  side: 1 | -1;
  moment: ReplayShot | null;
  /** The take's number in the edit — the hash every choice is dealt off. */
  n: number;
  /** The wall clock it opened on, s. */
  wall: number;
};

export type Director = {
  /** The take for this frame: the same object until a cut. */
  call: (sit: Situation, shots: readonly ReplayShot[]) => Take;
  /** The camera gave the take up (no open line): cut on the next call,
   * and never back to its moment. */
  end: () => void;
  /** Forget the edit: a new run or a seek. */
  drop: () => void;
};

/** A hash of two integers to 0..1 — the director's dice, never the run's. */
export function dice(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The FOLLOW framings that suit the moment, best first. */
export function framingsFor(sit: Situation): readonly Framing[] {
  if (sit.thrown) return ["arc", "establish", "heli"];
  if (sit.airborne) return ["heli", "arc", "chase", "dutch"];
  if (sit.speed < DIRECTOR.crawl) return ["arc", "lead", "establish"];
  if (sit.packed < DIRECTOR.powder) return ["powder", "lead", "boots", "heli", "dutch"];
  if (sit.turn > DIRECTOR.turn) return ["boots", "chase", "lead", "dutch", "arc"];
  if (sit.speed > DIRECTOR.fast) return ["headon", "heli", "rideby", "chase", "dutch", "lead"];
  return ["chase", "lead", "heli", "rideby", "dutch", "arc", "boots"];
}

/** The window a moment holds the picture over, steps: [from, until). */
export function momentWindow(m: ReplayShot): { from: number; until: number } {
  if (m.kind === "wipeout" || m.kind === "hit")
    return { from: m.at - steps(DIRECTOR.crashLead), until: m.at + steps(DIRECTOR.crashHold) };
  return { from: m.at - steps(DIRECTOR.lead), until: m.at + m.runs + steps(DIRECTOR.hold) };
}

/** Whether two finds are the SAME moment: the read ahead finds a moment
 * again on every fresh read, a step or two either side of where it was. */
export function sameMoment(a: ReplayShot, b: ReplayShot): boolean {
  return a.kind === b.kind && Math.abs(a.at - b.at) <= steps(DIRECTOR.same);
}

/** Whether a moment is one the film frames: a small air is not. */
function framed(m: ReplayShot): boolean {
  if (m.kind === "air") return m.runs >= steps(DIRECTOR.big);
  return m.kind === "wipeout" || m.kind === "hit" || m.kind === "finish" || m.kind === "pass";
}

/** The framing a moment is shot in at `step`, given the framing before
 * it. A big flight is two shots — the lip, then the landing — and a long
 * one three: the lip, alongside him through the hang, the landing. */
export function momentFraming(m: ReplayShot, step: number, last: Framing | null): Framing {
  if (m.kind === "wipeout" || m.kind === "hit") return last === "crash" ? "hero" : "crash";
  if (m.kind !== "air") return last === "rideby" ? "lip" : "rideby";
  if (step < m.at + steps(DIRECTOR.liftOff)) return "lip";
  if (m.runs >= steps(DIRECTOR.hang) && step < m.at + Math.round(m.runs * DIRECTOR.hangTo))
    return "hang";
  return "hero";
}

/** The order a flight's shots come in: a cut on the action only forward. */
const FLIGHT: readonly Framing[] = ["lip", "hang", "hero"];

export function createDirector(): Director {
  let take: Take | null = null;
  let n = 0;
  /** The framings of the last takes, newest last. */
  const recent: Framing[] = [];
  /** Moments given up or shot through. */
  const spent: ReplayShot[] = [];
  const isSpent = (m: ReplayShot): boolean => spent.some((x) => sameMoment(x, m));
  let ended = false;

  let wall = 0;
  const open = (t: Omit<Take, "n" | "wall">): Take => {
    take = { ...t, n: n++, wall };
    recent.push(t.framing);
    if (recent.length > 3) recent.shift();
    ended = false;
    return take;
  };

  const follow = (sit: Situation, soon: number): Take => {
    const last = recent[recent.length - 1] ?? null;
    let pool: readonly Framing[] = framingsFor(sit);
    const wide = n === 0 || (n % DIRECTOR.establishEvery === 0 && !sit.airborne);
    if (wide && last !== "establish") pool = ["establish"];
    let fresh = pool.filter((f) => f !== last && !recent.includes(f));
    if (fresh.length === 0) fresh = pool.filter((f) => f !== last);
    if (fresh.length === 0) fresh = FOLLOWS.filter((f) => f !== last);
    // The first of the pool is the likeliest: the framing that suits best.
    const roll = dice(n, 11);
    const pick = fresh[Math.min(fresh.length - 1, Math.floor(roll * roll * fresh.length))];
    let hold = DIRECTOR.least + (DIRECTOR.most - DIRECTOR.least) * dice(n, 7);
    // Held through to a moment that opens soon after, rather than cut a
    // beat before it.
    if (soon - sit.step < steps(hold + DIRECTOR.bridge) && soon > sit.step)
      hold = (soon - sit.step) / HZ;
    return open({
      framing: pick,
      from: sit.step,
      until: sit.step + steps(hold),
      side: dice(n, 5) < 0.5 ? 1 : -1,
      moment: null,
    });
  };

  return {
    end: () => {
      ended = true;
      if (take?.moment) spent.push(take.moment);
    },
    drop: () => {
      take = null;
      ended = false;
      recent.length = 0;
      spent.length = 0;
    },
    call: (sit, shots) => {
      const now = sit.step;
      wall = sit.wall;
      // HELD TOO LONG on the screen (a slow motion under it): cut, and a
      // moment's take gives its moment up.
      if (take && !ended && wall - take.wall > DIRECTOR.wallMost) {
        ended = true;
        if (take.moment) spent.push(take.moment);
      }
      // THE MOMENT whose window is open, the first one not given up.
      let moment: ReplayShot | null = null;
      for (const m of shots) {
        if (!framed(m) || isSpent(m)) continue;
        const w = momentWindow(m);
        if (now >= w.from && now < w.until) {
          moment = m;
          break;
        }
      }
      const last = take && take.framing;
      if (moment) {
        const w = momentWindow(moment);
        if (take && !ended && take.moment && sameMoment(take.moment, moment)) {
          take.moment = moment; // the latest read of it
          // The same moment: a cut only ON THE ACTION, the lip to the hang
          // to the landing, and on the same side of him (the 180° rule).
          const phase = momentFraming(moment, now, null);
          const was = FLIGHT.indexOf(take.framing);
          if (was < 0 || FLIGHT.indexOf(phase) <= was) return take;
          return open({ framing: phase, from: now, until: w.until, side: take.side, moment });
        }
        let want = momentFraming(moment, now, last);
        if (want === last) want = want === "lip" ? "hero" : "lip";
        // A small flight straight after another moment is followed rather
        // than planted for: the cut is the variety.
        if (want !== "crash" && moment.runs < steps(DIRECTOR.big) && take?.moment) {
          const pool = (["heli", "chase", "dutch", "arc"] as const).filter((f) => f !== last);
          want = pool[Math.floor(dice(moment.at, 13) * pool.length)];
        } else if (want !== "crash" && moment.kind === "air" && recent.includes("hero")) {
          // A BIG AIR AGAIN so soon: never the same pair twice running — the
          // flight seen from the air, from beside its line or round it.
          const pool = (["heli", "rideby", "arc"] as const).filter((f) => f !== last);
          want = pool[Math.floor(dice(moment.at, 17) * pool.length)];
        }
        return open({
          framing: want,
          from: now,
          until: w.until,
          side: dice(moment.at, 9) < 0.5 ? 1 : -1,
          moment,
        });
      }
      // A SHORT GAP before the next moment is held on the shot up, never cut
      // to a flash of another.
      let opens = Infinity;
      for (const m of shots) {
        if (!framed(m) || isSpent(m) || (take?.moment && sameMoment(take.moment, m))) continue;
        const from = momentWindow(m).from;
        if (from > now) opens = Math.min(opens, from);
      }
      if (take && !ended && opens - now < steps(DIRECTOR.bridge)) {
        take.until = Math.max(take.until, opens);
        return take;
      }
      if (take?.moment && !isSpent(take.moment)) spent.push(take.moment);
      if (spent.length > 32) spent.shift();
      if (take && !ended && !take.moment && now < take.until && now >= take.from) return take;
      return follow(sit, opens);
    },
  };
}

/** THE MENU'S SLOW MOTION at `step`: 1, or less over the middle of a long
 * flight read ahead. */
export function cinemaRate(shots: readonly ReplayShot[], step: number): number {
  const S = CINEMA_SLOW;
  for (const m of shots) {
    if (m.kind !== "air" || m.runs < steps(S.least)) continue;
    const f = (step - m.at) / m.runs;
    if (f <= 0 || f >= 1) continue;
    // Full slow at the peak, eased to full speed `ramp` of the flight off it.
    const off = Math.abs(f - S.peak);
    const reach = S.peak - S.ramp / 2;
    const k = off <= S.ramp / 2 ? 1 : Math.max(0, 1 - (off - S.ramp / 2) / Math.max(1e-6, reach));
    const e = k * k * (3 - 2 * k);
    return 1 + (S.rate - 1) * e;
  }
  return 1;
}
