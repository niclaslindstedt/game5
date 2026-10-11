// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S CHALLENGE VIEWS (`make world ARGS="--free
// --views=challenge-start,challenge-finish,challenge-gate-side,challenge-far,challenge-kicker,challenge-spot"`):
// a free ride JUDGED (`challenge-run.ts`, with a book in which the first
// kicker holds a gold and every hidden spot is found), and its challenges
// as they stand on the snow (`challenge-flags.ts`):
//
//   * challenge-start — from the chase lens, the skier riding down onto the
//     first timed line's start gate;
//   * challenge-finish — the line's finish lit gold while it runs (the
//     skier has just crossed its start), from a step up the run;
//   * challenge-gate-side — the start gate from across the run, low: both
//     flags, the timing posts and the dyed line between them;
//   * challenge-far — the start gate from 120 m down the run: can it be read;
//   * challenge-kicker — the first trick goal's kicker and its pennant;
//   * challenge-spot — the first hidden spot, found: its cairn.
//
// `ARGS=--hour=21` draws them at night.

import {
  dealChallenges,
  dealtRuns,
  isLine,
  isSpots,
  isTrick,
  NEUTRAL_INPUT,
  placeRun,
  step,
  trackPointAt,
  type GameState,
  type LineChallenge,
} from "@engine";

import type { ChallengeBook } from "../game/challenge-book.ts";
import { challengeSessionOf, createChallengeRig } from "../game/challenge-run.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import type { CameraRung } from "../game/renderer-api.ts";

/** The world lab's renderer, as far as these views drive it. */
export type ChallengeLab = {
  draw(state: GameState, alpha: number, dt: number, present: boolean): void;
  setOverride(pose: LensPose | null): void;
  setCamera(rung: CameraRung, snap?: boolean): void;
};

export function challengeShots(
  state: GameState,
  renderer: ChallengeLab,
): Record<string, () => string> {
  const lab = {
    draw: (present: boolean) => renderer.draw(state, 0, 1 / 60, present),
    setOverride: (p: LensPose | null) => renderer.setOverride(p),
    setCamera: (rung: CameraRung) => renderer.setCamera(rung, true),
  };
  const level = state.level;
  // A free ride alone is judged (`--free`).
  if (!level.resort || state.rules.course || state.rules.tricks) return {};
  const plan = dealChallenges(level);
  const entries: Record<
    string,
    { medal: "gold" | null; value?: number; found?: string[]; at: number }
  > = {};
  const trick = plan.challenges.find(isTrick);
  if (trick) entries[trick.id] = { medal: "gold", value: 3, at: 0 };
  const spots = plan.challenges.find(isSpots);
  if (spots) entries[spots.id] = { medal: null, found: spots.spots.map((s) => s.id), at: 0 };
  const book: ChallengeBook = { v: 1, maps: { [plan.key]: entries } };
  const rig = createChallengeRig({ load: () => book, save: () => {}, now: () => 0 });
  // Armed lazily, once a challenge view is asked for, so no other view's
  // picture carries the marks.
  let armed = false;
  const arm = () => {
    if (!armed) rig.arm(state, "free", true);
    armed = true;
  };
  const line = plan.challenges.find(isLine) as LineChallenge | undefined;
  const run = line ? dealtRuns(level).find((r) => r.id === line.run) : undefined;
  const ground = (x: number, z: number) => level.groundAt(x, z);
  /** Ride the skier `steps` engine steps, the judge stepped with him. */
  const ride = (steps: number, tuck: number): void => {
    for (let i = 0; i < steps; i++) {
      step(state, { ...NEUTRAL_INPUT, tuck });
      rig.step(state);
      if (i % 2 === 1) lab.draw(false);
    }
  };
  /** The skier stood `back` m up the run from the start gate, moving, a
   * few metres in from its left flag — a gate is as wide as its run, so
   * from its middle neither flag is in the chase lens's frame. */
  const above = (back: number, speed: number, aside = true): void => {
    const p = trackPointAt(run!, line!.start.s - back);
    const off = aside ? -(p.width / 2 - 7) : 0;
    const x = p.x + Math.cos(p.heading) * off;
    const z = p.z - Math.sin(p.heading) * off;
    placeRun(state, { x, z, heading: p.heading, speed });
  };
  /** A lens `back` m up the run from gate `g` and `aside` m in from its
   * left flag, `up` m over the snow, looking at the flag's head. */
  const atFlag = (g: LineChallenge["start"], back: number, aside: number, up: number): LensPose => {
    const fx = Math.sin(g.heading);
    const fz = Math.cos(g.heading);
    const rx = Math.cos(g.heading);
    const rz = -Math.sin(g.heading);
    const ex = g.left.x - fx * back + rx * aside;
    const ez = g.left.z - fz * back + rz * aside;
    const tx = g.left.x - rx * 1.1;
    const tz = g.left.z - rz * 1.1;
    return {
      eye: { x: ex, y: ground(ex, ez) + up, z: ez },
      target: { x: tx, y: ground(tx, tz) + 2.4, z: tz },
      fov: 55,
      roll: 0,
    };
  };
  const shoot = (pose: LensPose, note: string): string => {
    lab.setOverride(pose);
    for (let i = 0; i < 4; i++) lab.draw(false);
    lab.draw(true);
    lab.setOverride(null);
    return note;
  };
  const said = line
    ? `${line.id} (${line.grade}, ${Math.round(line.length)} m, ${Math.round(line.drop)} m drop, gate ${Math.round(line.start.width)} m wide)`
    : "";
  return {
    "challenge-start"() {
      arm();
      if (!line || !run) return "no timed line on this map";
      above(30, 8);
      ride(90, 0);
      // Behind him and over his shoulder, aimed at the flag he rides to.
      const k = state.skier;
      const f = line.start.left;
      const to = Math.hypot(f.x - k.x, f.z - k.z) || 1;
      const ex = k.x - ((f.x - k.x) / to) * 7;
      const ez = k.z - ((f.z - k.z) / to) * 7;
      return shoot(
        {
          eye: { x: ex, y: ground(ex, ez) + 2.6, z: ez },
          target: { x: f.x, y: ground(f.x, f.z) + 1.6, z: f.z },
          fov: 55,
          roll: 0,
        },
        `riding onto the start of ${said}, ${to.toFixed(0)} m from its left flag`,
      );
    },
    "challenge-finish"() {
      arm();
      if (!line || !run) return "no timed line on this map";
      above(6, 8, false);
      ride(240, 0.5);
      const live = challengeSessionOf(state)?.run.live()?.id === line.id;
      return shoot(
        atFlag(line.finish, 24, 12, 1.8),
        `the finish of ${said}${live ? ", the line running" : ""}`,
      );
    },
    "challenge-gate-side"() {
      arm();
      if (!line || !run) return "no timed line on this map";
      // From below the gate and across it, low: the flag, its post and
      // the dyed line running away across the run.
      return shoot(atFlag(line.start, -9, 7, 1.3), `the start of ${said} from below`);
    },
    "challenge-far"() {
      arm();
      if (!line || !run) return "no timed line on this map";
      // From the run's middle 120 m below it (a gate stood under a rollover
      // hides from above), at a skier's eye, at its left flag.
      const p = trackPointAt(run, line.start.s + 120);
      const f = line.start.left;
      return shoot(
        {
          eye: { x: p.x, y: ground(p.x, p.z) + 1.7, z: p.z },
          target: { x: f.x, y: ground(f.x, f.z) + 2, z: f.z },
          fov: 50,
          roll: 0,
        },
        `120 m down from the start of ${said}`,
      );
    },
    "challenge-kicker"() {
      arm();
      if (!trick) return "no trick goal on this map";
      const k = trick.kicker;
      const fx = Math.sin(k.heading);
      const fz = Math.cos(k.heading);
      const rx = Math.cos(k.heading);
      const rz = -Math.sin(k.heading);
      // From below the lip, off its pennant's side, looking up at the roll
      // and the pennant beside it.
      const ex = k.x + fx * 22 + rx * (k.width / 2 + 3);
      const ez = k.z + fz * 22 + rz * (k.width / 2 + 3);
      const px = k.x + rx * (k.width / 2);
      const pz = k.z + rz * (k.width / 2);
      return shoot(
        {
          eye: { x: ex, y: ground(ex, ez) + 1.7, z: ez },
          target: { x: px, y: ground(px, pz) + 1.2, z: pz },
          fov: 55,
          roll: 0,
        },
        `${trick.id} (${trick.size}), held gold`,
      );
    },
    "challenge-spot"() {
      arm();
      const p = spots?.spots[0];
      if (!p) return "no hidden spot on this map";
      const ex = p.x + 6;
      const ez = p.z + 3;
      return shoot(
        {
          eye: { x: ex, y: ground(ex, ez) + 1.7, z: ez },
          target: { x: p.x, y: ground(p.x, p.z) + 0.9, z: p.z },
          fov: 55,
          roll: 0,
        },
        `hidden spot ${p.id} (${p.what}), found`,
      );
    },
  };
}
