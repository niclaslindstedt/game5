// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// IN TOWN ON FOOT — a free ride's skier who comes into the village takes
// his skis off and walks its streets with the pair on his shoulder, and
// puts them back on once he is off them (`TOWN`, `RunRules.town`):
//
//   * STOPPED (`townBrake`): skied onto a street of the village (`onStreet`:
//     a street to the back of its sidewalks, the square, the car park) he
//     is stood on his edges until he is all but stopped;
//   * OUT OF THE BINDINGS (`intoTown`, then `out`): the right pole's tip on
//     the right heel piece's lever, the heel popped and the boot stepped
//     out, then the left — and a step back off the pair;
//   * ONTO THE SHOULDER (`pick`): bent for the pair, stood on its tails in
//     front of him and clapped base to base, swung up onto his right
//     shoulder, tips forward, the bindings just behind it;
//   * WALKING (`walk`): the tuck walks him on, the edge turns him, the
//     brake stands him still; the trunks, posts and walls walked round;
//   * OFF THE STREETS (`drop`, then `clip`): once he stands past the
//     village's felled margin the pair comes off his shoulder, onto its
//     tails and down on the snow across the fall line, he steps onto it and
//     each heel is stamped into its binding — and he skis on.
//
// THE SKIS are the thrown skier's shape (`LoneSki`), so one drawing lays
// them, but nothing slides them: every step they are PLACED where his hands
// or his shoulder have them — lerped between three places (lying on the
// snow, stood on their tails, on the shoulder) by how far into a beat he
// is. The reset press stands him back on the piste as ever (`standSkier`
// forgets the walk).
//
// Only the player's run walks, only on a run whose rules ask for it, and
// nothing here draws on any stream, so no digest moves.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { clearOfSolids, onFoot } from "./buzz.ts";
import { standSkier } from "./course.ts";
import { TOWN as T } from "./defs/town.ts";
import { TUNING } from "./defs/tuning.ts";
import { MASK, onStreet, streetMaskAt } from "./village.ts";
import type { GameEvent, GameState, LoneSki, SkierInput, TownWalk } from "./state.ts";

const dt = TUNING.dt;
type Phase = TownWalk["phase"];
type Beat = "heel" | "clap" | "shoulder" | "lay" | "snap";

/** WHEN IN EACH BEAT a sound is made, shares of it: both heels popped,
 * the pair clapped and on the shoulder, laid down, both bindings shut. */
const BEATS: Partial<Record<Phase, readonly (readonly [number, Beat])[]>> = {
  out: [
    [0.26, "heel"],
    [0.6, "heel"],
  ],
  pick: [
    [0.5, "clap"],
    [0.8, "shoulder"],
  ],
  drop: [[0.8, "lay"]],
  clip: [
    [0.42, "snap"],
    [0.82, "snap"],
  ],
};

/** How long each beat takes, s (the walk is the player's). */
const LENGTH: Record<Phase, number> = {
  out: T.out,
  pick: T.pick,
  walk: Infinity,
  drop: T.drop,
  clip: T.clip,
};

/** THE SHARES OF EACH BEAT the pair moves over, from one place to the
 * next: picked up off the snow onto its tails, then up onto the shoulder;
 * and taken off it onto its tails, then laid down. The step back off the
 * pair (`out`) and onto it (`clip`) are the last and the first of theirs. */
export const TOWN_KEYS = {
  lift: [0.32, 0.52] as const,
  swing: [0.54, 0.84] as const,
  unswing: [0.16, 0.5] as const,
  lower: [0.52, 0.8] as const,
  stepBack: [0.74, 1] as const,
  stepOn: [0, 0.3] as const,
};

/** A smooth 0..1 over [a, b] of `k`. */
export function townEase(k: number, [a, b]: readonly [number, number]): number {
  const s = clamp((k - a) / (b - a), 0, 1);
  return s * s * (3 - 2 * s);
}

/** Whether this run walks its village: the rules ask for it. */
function walksTown(run: GameState): boolean {
  return !!run.rules.town;
}

/** Whether the skier is on his skis on a street of the village, nothing
 * carrying him and on the snow: where his skis come off. */
function onSkisInTown(run: GameState): boolean {
  const c = run.skier;
  if (!walksTown(run) || c.thrown || c.fetch || c.town || c.lift || c.tunnel || c.jib) return false;
  if (c.airborne) return false;
  return onStreet(run.level, c.x, c.z);
}

const STOP: SkierInput = { steer: 0, tuck: 0, brake: 1, lean: 0, reset: false };

/** THE STOP: on a street, the skis stood across his way (the brake held,
 * nothing else) until he is all but still; `input` itself anywhere else. */
export function townBrake(run: GameState, input: SkierInput): SkierInput {
  return onSkisInTown(run) && run.skier.speed > T.stopAt ? STOP : input;
}

/** A ski laid nowhere yet, to be placed. */
export function blankSki(side: number, mount: number): LoneSki {
  return {
    side,
    held: 0,
    mount,
    ends: [0, 0, 0, 0, 0, 0],
    last: [0, 0, 0, 0, 0, 0],
    kick: [0, 0, 0, 0, 0, 0],
    up: [0, 1, 0],
    spin: 0,
    touching: 3,
    hooked: 0,
    hook: [0, 0, 0, 0, 0, 0],
    tried: 0,
  };
}

/** STOPPED IN TOWN: once he is all but still on a street, out of his skis —
 * the walk begun where the pair stands under him. */
export function intoTown(run: GameState, events: GameEvent[]): void {
  const c = run.skier;
  if (!onSkisInTown(run) || c.speed > T.stopAt) return;
  c.town = {
    phase: "out",
    phaseT: 0,
    t: 0,
    skis: [blankSki(-1, c.spec.mount), blankSki(1, c.spec.mount)],
    at: { x: c.x, z: c.z, heading: c.heading },
    walked: 0,
  };
  onFoot(run, c.x, c.z, c.heading, 0, 0);
  placeSkis(run);
  events.push({ kind: "town", t: run.t, phase: "stop" });
}

/** How far into its beat the walk is, 0..1 (0 walking). */
export function townShare(w: TownWalk): number {
  const L = LENGTH[w.phase];
  return Number.isFinite(L) ? clamp(w.phaseT / L, 0, 1) : 0;
}

/** The shoulder's dip at this point of his stride, m (≤ 0): a dip at each
 * heel strike, deeper the faster he walks — the figure's and the pair's. */
export function strideBob(walked: number, pace: number): number {
  const ph = (walked / T.stride) * Math.PI * 2 * 0.85;
  return -T.bob * pace * Math.abs(Math.cos(ph));
}

/** How full a stride he is walking, 0..1, off his speed. */
export function stridePace(speed: number): number {
  return Math.min(1, speed / T.walk + 0.2 * Math.min(1, speed * 4));
}

/** Where a lift leads him on foot (`lift-skis.ts`): the way, rad, and the
 * pace, m/s — the walk is the lift's, not the player's, and the streets
 * are not asked where he is. */
export type TownLead = { heading: number; pace: number };

/** ONE STEP IN TOWN: the beat he is in, his walk, and the pair placed —
 * or, `lead` by a lift, his walk where it takes him. */
export function stepTown(
  run: GameState,
  input: SkierInput,
  events: GameEvent[],
  lead?: TownLead,
): void {
  const c = run.skier;
  const w = c.town!;
  const was = w.phaseT;
  w.t += dt;
  w.phaseT += dt;
  const L = LENGTH[w.phase];
  for (const [at, beat] of BEATS[w.phase] ?? []) {
    if (was < at * L && w.phaseT >= at * L) {
      events.push({ kind: "town", t: run.t, phase: beat });
    }
  }
  const level = run.level;
  let heading = c.heading;
  let vx = 0;
  let vz = 0;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  if (w.phase === "out" || w.phase === "clip") {
    // The step back off the pair, or onto it: his body carried over the
    // share of the beat it takes.
    const keys = w.phase === "out" ? TOWN_KEYS.stepBack : TOWN_KEYS.stepOn;
    const moved = townEase(w.phaseT / L, keys) - townEase(was / L, keys);
    const way = (w.phase === "out" ? -T.back : T.back) * moved;
    vx = (fx * way) / dt;
    vz = (fz * way) / dt;
    if (w.phaseT >= L && w.phase === "out") next(w, "pick");
    else if (w.phaseT >= L) {
      // BACK ON HIS SKIS where the pair lies, and away.
      events.push({ kind: "town", t: run.t, phase: "away" });
      standSkier(run, w.at.x, w.at.z, w.at.heading);
      return;
    }
  } else if (w.phase === "pick") {
    if (w.phaseT >= L) next(w, "walk");
  } else if (w.phase === "drop") {
    // Turned to stand across the fall line, the way he will step in.
    const turn = angleDiff(heading, w.at.heading);
    heading += clamp(turn, -T.turn * dt, T.turn * dt);
    if (w.phaseT >= L) next(w, "clip");
  } else {
    const steer = lead ? clamp(angleDiff(heading, lead.heading) * 4, -1, 1) : input.steer;
    heading += clamp(steer, -1, 1) * T.turn * dt;
    const go = lead ? lead.pace / T.walk : input.brake > 0.15 ? 0 : clamp(input.tuck * 2, 0, 1);
    const gx = Math.sin(heading);
    const gz = Math.cos(heading);
    const rise = (level.groundAt(c.x + gx, c.z + gz) - level.groundAt(c.x - gx, c.z - gz)) / 2;
    const pace = T.walk * clamp(1 - T.climb * Math.max(0, rise), T.slowest, 1) * go;
    vx = gx * pace;
    vz = gz * pace;
    const stride = T.stride / 2;
    if (Math.floor((w.walked + pace * dt) / stride) > Math.floor(w.walked / stride)) {
      events.push({ kind: "town", t: run.t, phase: "step" });
    }
    w.walked += pace * dt;
    // OFF THE STREETS: past the village's felled margin, the pair comes off.
    if (!lead && streetMaskAt(level, c.x, c.z) < MASK.felled) leaveTown(run, w, heading);
  }
  const at = clearOfSolids(run, c.x + vx * dt, c.z + vz * dt);
  const lo = TUNING.bounds.margin;
  const hi = level.size - lo;
  onFoot(run, clamp(at.x, lo, hi), clamp(at.z, lo, hi), heading, vx, vz);
  placeSkis(run);
}

function next(w: TownWalk, phase: Phase): void {
  w.phase = phase;
  w.phaseT = 0;
}

/** THE PAIR COMES OFF: where it will lie — a step ahead of him, across the
 * fall line the way he faces (a skier steps in standing across the slope;
 * on the flat, the way he walks). */
function leaveTown(run: GameState, w: TownWalk, heading: number): void {
  const c = run.skier;
  const level = run.level;
  const gx = level.groundAt(c.x + 1, c.z) - level.groundAt(c.x - 1, c.z);
  const gz = level.groundAt(c.x, c.z + 1) - level.groundAt(c.x, c.z - 1);
  const down = Math.atan2(-gx, -gz);
  const across = angleDiff(down, heading) >= 0 ? down + Math.PI / 2 : down - Math.PI / 2;
  const to = hypot(gx, gz) > 0.02 ? across : heading;
  w.at = { x: c.x + Math.sin(to) * T.back, z: c.z + Math.cos(to) * T.back, heading: to };
  next(w, "drop");
}

/** A place for a ski: where its boot's middle is on its base (`b`), the
 * way its tip points (`d`) and out of its topsheet (`u`), world frame. */
export type Place = { b: number[]; d: number[]; u: number[] };
const places: Place[][] = [0, 1, 2].map(() =>
  [0, 1].map(() => ({ b: [0, 0, 0], d: [0, 0, 1], u: [0, 1, 0] })),
);

export function unit(v: number[]): number[] {
  const n = hypot3(v[0], v[1], v[2]) || 1;
  v[0] /= n;
  v[1] /= n;
  v[2] /= n;
  return v;
}

/** The pair LYING on the snow where `at` has it, base down. */
function lying(run: GameState, at: TownWalk["at"], out: Place[]): void {
  const c = run.skier;
  const level = run.level;
  const fx = Math.sin(at.heading);
  const fz = Math.cos(at.heading);
  const fore = c.spec.length * (1 - c.spec.mount);
  const aft = c.spec.length * c.spec.mount;
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const bx = at.x + fz * side * (c.spec.stance / 2);
    const bz = at.z - fx * side * (c.spec.stance / 2);
    const tip = level.groundAt(bx + fx * fore, bz + fz * fore);
    const tail = level.groundAt(bx - fx * aft, bz - fz * aft);
    const p = out[i];
    p.b[0] = bx;
    p.b[1] = level.groundAt(bx, bz);
    p.b[2] = bz;
    p.d[0] = fx * (fore + aft);
    p.d[1] = tip - tail;
    p.d[2] = fz * (fore + aft);
    unit(p.d);
    p.u[0] = 0;
    p.u[1] = 1;
    p.u[2] = 0;
  }
}

/** The pair STOOD ON ITS TAILS in front of him, base to base, on his right. */
export function upright(run: GameState, out: Place[]): void {
  const c = run.skier;
  const U = T.upright;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const ground = run.level.groundAt(c.x, c.z);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const across = U.out + (side * U.gap) / 2;
    const p = out[i];
    p.b[0] = c.x + fz * across + fx * U.ahead;
    p.b[1] = ground + 0.02 + c.spec.length * c.spec.mount;
    p.b[2] = c.z - fx * across + fz * U.ahead;
    p.d[0] = 0;
    p.d[1] = 1;
    p.d[2] = 0;
    p.u[0] = fz * side;
    p.u[1] = 0;
    p.u[2] = -fx * side;
  }
}

/** The pair ON HIS RIGHT SHOULDER, the right ski under (its topsheet on the
 * shoulder), the left on it base to base; `bob` his stride's dip, m. */
export function shouldered(run: GameState, bob: number, out: Place[]): void {
  const c = run.skier;
  const K = T.carry;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const cd = Math.cos(K.tipDown);
  const sd = Math.sin(K.tipDown);
  // Along the pair (forward and down), and square to it upward.
  const dx = fx * cd;
  const dy = -sd;
  const dz = fz * cd;
  const nx = fx * sd;
  const ny = cd;
  const nz = fz * sd;
  const sx = c.x + fz * K.out;
  const sy = run.level.groundAt(c.x, c.z) + K.shoulder + bob;
  const sz = c.z - fx * K.out;
  for (let i = 0; i < 2; i++) {
    const lower = i === 1;
    const lift = K.thick + (lower ? 0 : 0.004);
    const p = out[i];
    p.b[0] = sx - dx * K.behind + nx * lift;
    p.b[1] = sy - dy * K.behind + ny * lift;
    p.b[2] = sz - dz * K.behind + nz * lift;
    p.d[0] = dx;
    p.d[1] = dy;
    p.d[2] = dz;
    const s = lower ? -1 : 1;
    p.u[0] = nx * s;
    p.u[1] = ny * s;
    p.u[2] = nz * s;
  }
}

/** `out` = `a` toward `b` by `k`, the directions kept unit and square. */
export function mixPlace(a: Place, b: Place, k: number, out: Place): void {
  for (let j = 0; j < 3; j++) {
    out.b[j] = a.b[j] + (b.b[j] - a.b[j]) * k;
    out.d[j] = a.d[j] + (b.d[j] - a.d[j]) * k;
    out.u[j] = a.u[j] + (b.u[j] - a.u[j]) * k;
  }
  unit(out.d);
  const along = out.u[0] * out.d[0] + out.u[1] * out.d[1] + out.u[2] * out.d[2];
  for (let j = 0; j < 3; j++) out.u[j] -= out.d[j] * along;
  unit(out.u);
}

/** The ski laid at its place. */
export function setSki(ski: LoneSki, p: Place, length: number, onSnow: boolean): void {
  const fore = length * (1 - ski.mount);
  const aft = length * ski.mount;
  const E = ski.ends;
  for (let j = 0; j < 3; j++) {
    E[j] = p.b[j] + p.d[j] * fore;
    E[3 + j] = p.b[j] - p.d[j] * aft;
    ski.up[j] = p.u[j];
  }
  for (let j = 0; j < 6; j++) ski.last[j] = E[j];
  ski.touching = onSnow ? 3 : 0;
  ski.spin = 0;
}

const mixed: Place[] = [0, 1].map(() => ({ b: [0, 0, 0], d: [0, 0, 1], u: [0, 1, 0] }));

/** THE PAIR WHERE THE BEAT HAS IT: on the snow, on its tails, on the
 * shoulder, or between two of them. */
export function placeSkis(run: GameState): void {
  const c = run.skier;
  const w = c.town;
  if (!w) return;
  const k = townShare(w);
  const [lie, stood, carried] = places;
  let from = lie;
  let to = lie;
  let share = 0;
  const shoulder = (): void => shouldered(run, strideBob(w.walked, stridePace(c.speed)), carried);
  if (w.phase === "out" || w.phase === "clip") lying(run, w.at, lie);
  else if (w.phase === "pick") {
    lying(run, w.at, lie);
    upright(run, stood);
    shoulder();
    if (k < TOWN_KEYS.swing[0]) {
      to = stood;
      share = townEase(k, TOWN_KEYS.lift);
    } else {
      from = stood;
      to = carried;
      share = townEase(k, TOWN_KEYS.swing);
    }
  } else if (w.phase === "drop") {
    lying(run, w.at, lie);
    upright(run, stood);
    shoulder();
    if (k < TOWN_KEYS.lower[0]) {
      from = carried;
      to = stood;
      share = townEase(k, TOWN_KEYS.unswing);
    } else {
      from = stood;
      share = townEase(k, TOWN_KEYS.lower);
    }
  } else {
    shoulder();
    from = to = carried;
  }
  for (let i = 0; i < 2; i++) {
    mixPlace(from[i], to[i], share, mixed[i]);
    setSki(w.skis[i], mixed[i], c.spec.length, from === lie && to === lie);
  }
}
