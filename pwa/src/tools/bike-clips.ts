// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S MOTION CLIPS — the fixed moments of a ride the bike
// labs judge the rider and the bike MOVING together in, each ridden on the
// real engine by the bot (or by a scripted hand where a bot never does it)
// on a fixed map, so every lab, every candidate and every judge sees the
// same seconds of the same ride:
//
//   pedal    from a standstill at the trail's head, pedalling up to speed
//   turns    a linked pair of turns, the bike laid one way and then the other
//   berm     the hardest lean of the ride, into it and out
//   pump     the deepest compression on the ground that is not a landing
//   jump     the longest flight: the lip, the air and the landing
//   whip     the freerider's whip, through the whole flight
//   table    the freerider's table, through the whole flight
//   land     the hardest landing, the fork and shock driven deepest
//   brake    both levers pulled hard at speed, down to a stop
//   footout  the inside foot out through a slide
//   crash    the bike laid over past what the bars can hold: thrown
//   push     stepped off and walking, pushing the bike by its bars
//   lift     rolled into a chair's load zone and hooked on
//
// A clip is ridden TWICE: once to find its window (`pick`, off what the
// ride did), then again to the end of it, the caller handed every frame of
// the window — the engine is deterministic, so the second ride is the
// first. Nothing here draws: the motion lab (`scripts/bike-motion.mjs`)
// measures the frames in Node and the film lab
// (`pwa/src/tools/bike-film-harness.ts`) photographs them.
//
// DOM-free and three-free.

import {
  bikeAim,
  bikePilot,
  bikePose,
  bikeWorldOf,
  createGame,
  fromEuler,
  generateLevel,
  liftPlans,
  NEUTRAL_INPUT,
  placeBike,
  step,
  TUNING,
  type BikeAim,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";

import { rideStyleOf } from "../game/bike-ride-style.ts";

/** THE MAP every clip is ridden on, its trails (the race line, the trail
 * most clips ride, the one the bot throws a table off and rides away from),
 * and its fair midday sky. */
export const CLIP_MAP = { seed: 38, trail: "B1", race: "DH", table: "B2", hour: 11 } as const;

/** Frames a second a clip is read at. */
export const CLIP_HZ = 60;
const FRAME = 1 / CLIP_HZ;
const STEPS = Math.round(FRAME / TUNING.dt);

/** What a ride's first pass keeps of each frame, to pick a window by. */
export type Signal = {
  t: number;
  speed: number;
  roll: number;
  airborne: boolean;
  airTime: number;
  /** The fork's and the shock's travel used, summed, 0..2. */
  squash: number;
  thrown: boolean;
  onIt: boolean;
  afoot: boolean;
  lift: boolean;
  /** The freerider's trick and how far into it, and his foot out. */
  trick: string;
  amount: number;
  footOut: number;
};

/** A clip: where it is begun, the hand on the bars, how long the first
 * pass rides, and the window it picks off what that ride did. */
export type Clip = {
  id: string;
  about: string;
  /** The map's seed where it is not `CLIP_MAP`'s. */
  seed?: number;
  /** The game begun for it (both passes call it). */
  start(level: Level): GameState;
  /** The input a frame (it may stage the state, as a lab's hand does). */
  hand(): (s: GameState, t: number) => SkierInput;
  /** Seconds the first pass rides at most. */
  limit: number;
  /** The window [from, to] in the ride's own seconds, or null where the
   * ride never did it. */
  pick(signals: readonly Signal[]): [number, number] | null;
};

function ride(level: Level, trail: string, spawn?: { x: number; z: number }): GameState {
  return createGame({
    level,
    mode: "free",
    summer: true,
    bike: true,
    bikeTrail: spawn ? undefined : trail,
    spawn,
    sky: { weather: "fair", hour: CLIP_MAP.hour },
    crowd: 0,
    quiet: true,
  });
}

/** The bot down `trail`. */
function bot(trail: string): Pick<Clip, "start" | "hand"> {
  return {
    start: (level) => ride(level, trail),
    hand: () => {
      let aim: BikeAim | null = null;
      return (s) => bikePilot(s, (aim ??= bikeAim(s, trail)));
    },
  };
}

/** The frame scoring highest by `score`, and the window `before`..`after`
 * s round it. */
function round(
  sig: readonly Signal[],
  score: (g: Signal, i: number) => number,
  before: number,
  after: number,
): [number, number] | null {
  let best = 0;
  let at = -1;
  sig.forEach((g, i) => {
    const v = score(g, i);
    if (v > best) [best, at] = [v, i];
  });
  if (at < 0) return null;
  return [Math.max(0, sig[at].t - before), sig[at].t + after];
}

/** The flight holding frame `i`: its first and last airborne frames. */
function flightAt(sig: readonly Signal[], i: number): [number, number] {
  let a = i;
  let b = i;
  while (a > 0 && sig[a - 1].airborne) a--;
  while (b + 1 < sig.length && sig[b + 1].airborne) b++;
  return [a, b];
}

/** The window of the longest flight scoring past nothing by `score`: the
 * lip `lead` s before it to `tail` s after it lands. */
function flight(
  sig: readonly Signal[],
  score: (g: Signal) => number,
  lead = 0.35,
  tail = 0.6,
  clean = true,
): [number, number] | null {
  let best = 0;
  let pick: [number, number] | null = null;
  for (let i = 0; i < sig.length; i++) {
    if (!sig[i].airborne || (i > 0 && sig[i - 1].airborne)) continue;
    const [a, b] = flightAt(sig, i);
    // A flight he does not ride away from is the crash clip's, not this.
    const away = sig.slice(b, b + CLIP_HZ * 1.5);
    if (clean && away.some((g) => g.thrown)) continue;
    let s = 0;
    for (let k = a; k <= b; k++) s = Math.max(s, score(sig[k]));
    const v = s * (sig[b].t - sig[a].t);
    if (v > best) [best, pick] = [v, [a, b]];
  }
  // None ridden away from: the best of those he was not.
  if (!pick) return clean ? flight(sig, score, lead, tail, false) : null;
  return [Math.max(0, sig[pick[0]].t - lead), sig[pick[1]].t + tail];
}

const onGround = (g: Signal) => g.onIt && !g.airborne && !g.thrown;

/** THE CLIPS, in the order every sheet lays them out. */
export const CLIPS: readonly Clip[] = [
  {
    id: "pedal",
    about: "from a standstill, pedalling up to speed",
    ...bot(CLIP_MAP.trail),
    limit: 3.2,
    pick: () => [0, 3],
  },
  {
    id: "turns",
    about: "a linked pair of turns, laid one way then the other",
    ...bot(CLIP_MAP.trail),
    limit: 60,
    pick: (sig) => {
      // The biggest swing of the lean from one side to the other inside
      // two seconds, on the ground all the way.
      let best = 0;
      let win: [number, number] | null = null;
      const span = 2 * CLIP_HZ;
      for (let i = 0; i + span < sig.length; i += 6) {
        let lo = 0;
        let hi = 0;
        let ok = true;
        for (let k = i; k < i + span; k++) {
          if (!onGround(sig[k])) {
            ok = false;
            break;
          }
          lo = Math.min(lo, sig[k].roll);
          hi = Math.max(hi, sig[k].roll);
        }
        if (ok && Math.min(-lo, hi) > best)
          [best, win] = [Math.min(-lo, hi), [sig[i].t, sig[i + span].t]];
      }
      return win;
    },
  },
  {
    id: "berm",
    about: "the hardest lean of the ride, into it and out",
    ...bot(CLIP_MAP.trail),
    limit: 60,
    pick: (sig) => round(sig, (g) => (onGround(g) ? Math.abs(g.roll) : 0), 0.8, 0.8),
  },
  {
    id: "pump",
    about: "the deepest compression on the ground that is not a landing",
    ...bot(CLIP_MAP.trail),
    limit: 60,
    pick: (sig) =>
      round(
        sig,
        (g, i) =>
          onGround(g) && !sig.slice(Math.max(0, i - 30), i).some((p) => p.airborne) ? g.squash : 0,
        0.6,
        0.6,
      ),
  },
  {
    id: "jump",
    about: "the longest flight on the race line: the lip, the air and the landing",
    ...bot(CLIP_MAP.race),
    limit: 90,
    pick: (sig) => flight(sig, () => 1),
  },
  {
    id: "whip",
    about: "the freerider's whip, through the whole flight",
    ...bot(CLIP_MAP.race),
    limit: 120,
    pick: (sig) => flight(sig, (g) => (g.trick === "whip" ? g.amount : 0)),
  },
  {
    id: "table",
    about: "the freerider's table, through the whole flight, ridden away from",
    ...bot(CLIP_MAP.table),
    limit: 120,
    pick: (sig) => flight(sig, (g) => (g.trick === "table" ? g.amount : 0)),
  },
  {
    id: "land",
    about: "the hardest landing, the fork and shock driven deepest",
    ...bot(CLIP_MAP.race),
    limit: 90,
    pick: (sig) =>
      round(
        sig,
        (g, i) =>
          onGround(g) && sig.slice(Math.max(0, i - 12), i).some((p) => p.airborne) ? g.squash : 0,
        0.5,
        0.6,
      ),
  },
  {
    id: "brake",
    about: "both levers pulled hard at speed, down to a stop",
    start: (level) => ride(level, CLIP_MAP.trail),
    hand: () => {
      let aim: BikeAim | null = null;
      return (s, t) => {
        const p = bikePilot(s, (aim ??= bikeAim(s, CLIP_MAP.trail)));
        return t < 6 ? p : { ...p, tuck: 0, brake: 1 };
      };
    },
    limit: 12,
    pick: (sig) => {
      const stop = sig.find((g) => g.t > 6.2 && g.speed < 0.3);
      return [5.6, Math.min(stop ? stop.t + 0.4 : 9, 9)];
    },
  },
  {
    id: "footout",
    about: "the inside foot out through a slide",
    ...bot(CLIP_MAP.trail),
    limit: 120,
    pick: (sig) => round(sig, (g) => g.footOut, 0.8, 0.8),
  },
  {
    id: "crash",
    about: "the bike laid over past what the bars can hold: thrown",
    start: (level) => ride(level, CLIP_MAP.trail),
    hand: () => {
      let aim: BikeAim | null = null;
      let laid = false;
      return (s, t) => {
        if (t < 5) return bikePilot(s, (aim ??= bikeAim(s, CLIP_MAP.trail)));
        if (!laid && s.bike) {
          laid = true;
          s.bike.q = fromEuler(s.bike.heading, s.bike.pitch, 1.3);
        }
        return NEUTRAL_INPUT;
      };
    },
    limit: 10,
    pick: (sig) => {
      const at = sig.find((g) => g.thrown);
      return at ? [4.7, at.t + 1.6] : null;
    },
  },
  {
    id: "push",
    about: "stepped off and walking, pushing the bike by its bars",
    start: (level) => ride(level, CLIP_MAP.trail),
    hand: () => {
      // The press once, a step long: held, it would put him back on.
      let pressed = false;
      return (s, t) => {
        if (t < 0.5) return NEUTRAL_INPUT;
        if (!pressed) {
          pressed = true;
          return { ...NEUTRAL_INPUT, machine: true };
        }
        return s.bike?.afoot ? { ...NEUTRAL_INPUT, tuck: 1, steer: 0.25 } : NEUTRAL_INPUT;
      };
    },
    limit: 4.5,
    pick: (sig) => {
      const off = sig.find((g) => g.afoot);
      return off ? [Math.max(0, off.t - 0.3), Math.min(off.t + 3, 4.5)] : null;
    },
  },
  {
    id: "lift",
    about: "rolled into a chair's load zone and hooked on",
    start: (level) => {
      const at = liftStart(level);
      const s = ride(level, CLIP_MAP.trail, at ?? undefined);
      if (at) standAt(s, at.x, at.z, at.heading, 1.5);
      return s;
    },
    hand: () => (s) => ({
      ...NEUTRAL_INPUT,
      tuck: s.bike && s.bike.mode !== "lift" && s.bike.speed < 1.6 ? 1 : 0,
    }),
    limit: 30,
    pick: (sig) => {
      const on = sig.find((g) => g.lift);
      return on ? [Math.max(0, on.t - 2.5), on.t + 2.5] : null;
    },
  },
];

/** Where the lift clip is begun: 8 m short of the map's first chair's load
 * zone, facing up its line. */
function liftStart(level: Level): { x: number; z: number; heading: number } | null {
  const plan = liftPlans(level).find((p) => p.lift.kind === "chair");
  if (!plan) return null;
  const e = plan.look.entry;
  const u = e.at - e.along - 8;
  return {
    x: plan.lift.bottom.x + u * plan.dx + e.side * plan.dz,
    z: plan.lift.bottom.z + u * plan.dz - e.side * plan.dx,
    heading: plan.heading,
  };
}

/** The bike stood at (x, z) facing `heading` rolling at `speed` m/s, the
 * rider on it. */
function standAt(s: GameState, x: number, z: number, heading: number, speed: number): void {
  const b = s.bike!;
  placeBike(b, bikeWorldOf(s.level, s.t), x, z, heading, speed);
  s.skier.x = b.rider.x;
  s.skier.y = b.rider.y;
  s.skier.z = b.rider.z;
}

function signal(s: GameState, t: number): Signal {
  const b = s.bike!;
  const st = rideStyleOf(b, s.level, s.t);
  const pose = bikePose(b);
  return {
    t,
    speed: b.speed,
    roll: b.roll,
    airborne: b.airborne,
    airTime: b.airTime,
    squash: pose.forkShare + pose.shockShare,
    thrown: !!s.skier.thrown,
    onIt: b.onIt,
    afoot: !!b.afoot,
    lift: b.mode === "lift",
    trick: st.trick,
    amount: st.amount,
    footOut: st.footOut,
  };
}

/** The summer maps the clips are ridden on (each built once). */
const summers = new Map<number, Level>();
export function clipLevel(seed: number = CLIP_MAP.seed): Level {
  let level = summers.get(seed);
  if (!level) {
    level = ride(generateLevel(seed), CLIP_MAP.trail).level;
    summers.set(seed, level);
  }
  return level;
}

/** The clip's window, off a first ride. */
export function clipWindow(clip: Clip, level = clipLevel(clip.seed)): [number, number] | null {
  const s = clip.start(level);
  const hand = clip.hand();
  const sig: Signal[] = [];
  for (let t = 0; t < clip.limit; t += FRAME) {
    for (let i = 0; i < STEPS; i++) step(s, hand(s, s.t));
    sig.push(signal(s, s.t));
  }
  return clip.pick(sig);
}

/** RIDES `clip` to the end of `window`, handing `frame` every frame inside
 * it (the state live — read it, do not keep it) with the clip's time and
 * the share of the window, 0..1. A frame that hands back a promise (the
 * film lab's draw) is waited on before the ride goes on. */
export async function rideClip(
  clip: Clip,
  window: [number, number],
  frame: (s: GameState, t: number, share: number) => void | Promise<void>,
  level = clipLevel(clip.seed),
): Promise<void> {
  const s = clip.start(level);
  const hand = clip.hand();
  const [from, to] = window;
  while (s.t <= to + 1e-9) {
    for (let i = 0; i < STEPS; i++) step(s, hand(s, s.t));
    if (s.t >= from - 1e-9) await frame(s, s.t, (s.t - from) / Math.max(1e-6, to - from));
  }
}
