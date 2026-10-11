// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEARCH AND THE PATROL's views of the avalanche lab
// (`avalanche-harness.ts`, `scripts/avalanche-preview.mjs`): a slab let go
// over an amateur lying in its way, the engine left to carry and bury him
// (`avalanche-rescue.ts`), and then —
//
//   hud      the player's transceiver at every phase of the search, over
//            the game's own frame: sending, the signal search, the coarse
//            search far and near, the fine search over him, the probe's
//            strike and the dig;
//   probe    a probe that misses and one that strikes, the probe left in;
//   hole     the hole dug from downhill, a third, two thirds and out;
//   patrol   the patrol skiing in, searching, probing, digging, done;
//   buried   the player himself under the snow: the dark and his air, the
//            patrol's search over him, the lens pulled up out of the hole
//            as they dig, and stood up again.
//
// Staged as `test-scenario` stages a moment: the amateur placed and thrown
// before the flow reaches him, the player stood where each frame wants
// him, the clock run headless between frames.

import { h, type ComponentChild } from "preact";
import {
  NEUTRAL_INPUT,
  patrolMan,
  placeRun,
  releaseAvalanche,
  step,
  throwAmateur,
  TUNING,
  type Burial,
  type GameState,
  type SkierInput,
} from "@engine";

import { beaconRead, buriedRead } from "../game/beacon-read.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import { BeaconUnit, BuriedVeil } from "../game/hud-beacon.tsx";
import type { CameraRung } from "../game/renderer-api.ts";

type Spot = { x: number; z: number };
type Lens = CameraRung | LensPose;

/** What the views are handed by the harness. */
export type RescueLab = {
  /** A free ride on the lab's map, `crowd` amateurs out. */
  fresh(crowd?: number): GameState;
  face(): Spot;
  safe(): { x: number; z: number; heading: number };
  /** Drawn for `seconds` at the lab's frame, stepping with `input`. */
  play(s: GameState, seconds: number, input?: SkierInput): void;
  shoot(s: GameState, label: string, lens: Lens, hud?: ComponentChild): void;
};

export const RESCUE_GROUPS: Record<string, readonly string[]> = {
  search: ["hud", "probe"],
  hole: ["hole"],
  patrol: ["patrol"],
  buried: ["buried"],
};

const STEP = TUNING.dt;

/** The clock run `seconds` without drawing, stepping with `input`, until
 * `until` says stop. */
function skip(
  s: GameState,
  seconds: number,
  input: SkierInput = NEUTRAL_INPUT,
  until?: () => boolean,
): void {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    step(s, input);
    if (until?.()) return;
  }
}

const lensOf = (
  eye: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  fov = 55,
): LensPose => ({ eye, target, fov, roll: 0 });

/** The fall line at (`x`, `z`), a unit vector in plan. */
function fallAt(s: GameState, x: number, z: number): { x: number; z: number } {
  const n = { x: 0, y: 1, z: 0 };
  s.level.normalAt(x, z, n);
  const l = Math.hypot(n.x, n.z) || 1;
  return { x: n.x / l, z: n.z / l };
}

/** A lens `back` m up the fall line from `at` and `side` m across it, `up`
 * m over the snow there, on `at` raised `rise` m. */
function standOff(
  s: GameState,
  at: Spot,
  back: number,
  side: number,
  up: number,
  rise = 0.4,
  fov = 55,
): LensPose {
  const f = fallAt(s, at.x, at.z);
  const x = at.x - f.x * back + f.z * side;
  const z = at.z - f.z * back - f.x * side;
  return lensOf(
    { x, y: s.level.groundAt(x, z) + up, z },
    { x: at.x, y: s.level.groundAt(at.x, at.z) + rise, z: at.z },
    fov,
  );
}

/** AN AMATEUR BURIED: a slab let go on the lab's face with one of the
 * crowd lying in its track a little below it, the clock run until it has
 * him under (tried down the track until one is). The player stood well
 * clear. */
function buriedAmateur(lab: RescueLab, hold = true): { s: GameState; b: Burial } {
  const face = lab.face();
  let best: { s: GameState; b: Burial } | null = null;
  for (const down of [25, 40, 15, 60, 80, 8]) {
    for (const across of [0, -8, 8]) {
      const s = lab.fresh(1);
      placeRun(s, lab.safe());
      const am = s.crowd?.amateurs[0];
      if (!am) throw new Error("the lab's map deals no crowd");
      releaseAvalanche(s, s.avalanche!, face.x, face.z, []);
      const f = fallAt(s, face.x, face.z);
      am.x = face.x + f.x * down + f.z * across;
      am.z = face.z + f.z * down - f.x * across;
      am.y = s.level.groundAt(am.x, am.z);
      am.heading = Math.atan2(f.x, f.z);
      throwAmateur(am, 1, "slam", 0, 0);
      // Down until the flow takes him.
      am.timer = 1e6;
      let b: Burial | undefined;
      skip(s, 70, NEUTRAL_INPUT, () => {
        b = s.avalanche!.burials.find((x) => x.who === "amateur");
        return b?.phase === "buried" || b?.phase === "out";
      });
      if (b?.phase !== "buried") continue;
      // Air enough for every view to come; the slide run to a stop and the
      // patrol, when the view wants the player alone, kept at the base.
      const found = b;
      found.air = 1e6;
      skip(s, 90, NEUTRAL_INPUT, () => {
        if (hold) holdPatrol(s);
        return (s.avalanche!.slide?.moving ?? 0) === 0;
      });
      if (hold) holdPatrol(s);
      // The usual burial is a metre or so down: the first one near that.
      if (found.depth >= 0.5 && found.depth <= 1.5) return { s, b: found };
      if (!best || Math.abs(found.depth - 1) < Math.abs(best.b.depth - 1)) best = { s, b: found };
    }
  }
  if (best) return best;
  throw new Error("no amateur buried on the lab's face");
}

/** The patrol kept at the base: a call answered never. */
function holdPatrol(s: GameState): void {
  const p = s.avalanche?.patrol;
  if (p?.phase === "called") p.eta = 1e6;
}

/** The lens over the player's shoulder: `back` m behind him and `up` m
 * over the snow, looking past him `ahead` m. */
function behind(s: GameState, back = 4.5, up = 2.3, ahead = 3): LensPose {
  const c = s.skier;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const ex = c.x - fx * back + fz * 0.8;
  const ez = c.z - fz * back - fx * 0.8;
  const tx = c.x + fx * ahead;
  const tz = c.z + fz * ahead;
  return lensOf(
    { x: ex, y: Math.max(s.level.groundAt(ex, ez), c.y) + up, z: ez },
    { x: tx, y: s.level.groundAt(tx, tz) + 0.4, z: tz },
    58,
  );
}

/** A lens on the first patroller where he is now: `back` m behind him,
 * `side` m to his right, `up` m over the snow there. */
function onMan(s: GameState, back: number, side: number, up: number): LensPose {
  const p = s.avalanche!.patrol!;
  const m = patrolMan(p, 0, { shown: true, x: 0, z: 0, heading: 0, act: "stand", work: 0 });
  const fx = Math.sin(m.heading);
  const fz = Math.cos(m.heading);
  const x = m.x - fx * back + fz * side;
  const z = m.z - fz * back - fx * side;
  return lensOf(
    { x, y: s.level.groundAt(x, z) + up, z },
    { x: m.x, y: s.level.groundAt(m.x, m.z) + 1, z: m.z },
    55,
  );
}

/** The transceiver's face over this frame. */
function unit(s: GameState): ComponentChild {
  const read = beaconRead(s, s.t);
  return read
    ? h(BeaconUnit, {
        read,
        touch: false,
        beaconKey: "T",
        rescueKey: "G",
        onBeacon: () => {},
        onRescue: () => {},
      })
    : null;
}

/** The player stood `d` m from `b` on the bearing `bearing`, facing
 * `turn` off straight at him, still. */
function standAt(s: GameState, b: Burial, d: number, bearing: number, turn: number): void {
  const x = b.x + Math.sin(bearing) * d;
  const z = b.z + Math.cos(bearing) * d;
  placeRun(s, { x, z, heading: Math.atan2(b.x - x, b.z - z) + turn, speed: 0 });
  settle(s, x, z);
}

/** Half a second for his legs to take his weight where he was put, held
 * there as a skier stopped on the debris holds himself (the slope would
 * otherwise have him sliding off before the frame). */
function settle(s: GameState, x: number, z: number): void {
  const c = s.skier;
  for (let i = 0; i < Math.round(0.5 / STEP); i++) {
    step(s, NEUTRAL_INPUT);
    c.x = x;
    c.z = z;
    c.vx = 0;
    c.vz = 0;
  }
  c.vy = 0;
  c.speed = 0;
}

const DIG: SkierInput = { ...NEUTRAL_INPUT, dig: true };

export function rescueViews(lab: RescueLab): Record<string, () => Promise<void>> {
  return {
    async hud() {
      const { s, b } = buriedAmateur(lab);
      const f = fallAt(s, b.x, b.z);
      const up = Math.atan2(-f.x, -f.z);
      lab.play(s, 0.2);
      const B = s.avalanche!.beacon;
      B.search = false;
      standAt(s, b, 60, up + 0.6, 0.2);
      B.search = false;
      lab.shoot(s, "sending — somebody under, a press to search", behind(s), unit(s));
      B.search = true;
      standAt(s, b, 140, up + 0.6, 0.2);
      lab.play(s, 0.05);
      lab.shoot(s, "signal search, out of range", behind(s), unit(s));
      standAt(s, b, 30, up + 0.6, 0.5);
      lab.play(s, 0.05);
      lab.shoot(s, "coarse search, 30 m: the arrow on the flux line", behind(s), unit(s));
      standAt(s, b, 8, up - 0.4, -0.3);
      lab.play(s, 0.05);
      lab.shoot(s, "coarse search, 8 m: slow down", behind(s), unit(s));
      standAt(s, b, 1.4, up, 0);
      lab.play(s, 0.05);
      lab.shoot(s, "fine search, over him: the depth", behind(s), unit(s));
      standAt(s, b, 0.3, up, 0);
      step(s, DIG);
      step(s, NEUTRAL_INPUT);
      lab.play(s, 1 / 60);
      lab.shoot(s, "a probe strike: dig", behind(s), unit(s));
      standAt(s, b, 1.6, Math.atan2(f.x, f.z), 0);
      skip(s, (b.depth * 0.45) / 0.05, DIG);
      lab.play(s, 0.2, DIG);
      lab.shoot(s, "digging", behind(s), unit(s));
    },
    async probe() {
      const { s, b } = buriedAmateur(lab);
      const f = fallAt(s, b.x, b.z);
      const near = standOff(s, b, 4, 5, 2.2, 0.5, 60);
      standAt(s, b, 1.8, Math.atan2(f.z, -f.x), 0);
      step(s, DIG);
      step(s, NEUTRAL_INPUT);
      lab.play(s, 0.2);
      lab.shoot(s, `a probe 1.8 m off: a miss (${s.avalanche!.beacon.holes.length} stroke)`, near);
      standAt(s, b, 0.25, Math.atan2(f.z, -f.x), 0);
      skip(s, 0.7);
      step(s, DIG);
      step(s, NEUTRAL_INPUT);
      lab.play(s, 0.2);
      lab.shoot(s, `on him: a strike at ${b.depth.toFixed(2)} m, the probe left in`, near);
      placeRun(s, { ...lab.safe(), speed: 0 });
      lab.play(s, 0.1);
      lab.shoot(s, "the probe left in, from further off", standOff(s, b, 12, 9, 5, 0.6, 50));
    },
    async hole() {
      const { s, b } = buriedAmateur(lab);
      const f = fallAt(s, b.x, b.z);
      b.struck = true;
      holdPatrol(s);
      const look = standOff(s, b, 4.5, 2.5, 3.6, -0.3, 58);
      const shovel = (to: number): void => {
        const x = b.x + f.x * 1.6;
        const z = b.z + f.z * 1.6;
        placeRun(s, { x, z, heading: Math.atan2(-f.x, -f.z), speed: 0 });
        settle(s, x, z);
        skip(s, 200, DIG, () => {
          holdPatrol(s);
          return b.dug >= to * b.depth || b.phase !== "buried";
        });
        lab.play(s, 0.15, DIG);
      };
      lab.shoot(s, `struck: ${b.depth.toFixed(2)} m under`, look);
      for (const share of [0.33, 0.66]) {
        shovel(share);
        lab.shoot(s, `dug ${Math.round(share * 100)} %`, look);
      }
      shovel(1);
      lab.play(s, 0.3);
      lab.shoot(s, `out: ${b.alive ? "alive" : "dead"}`, look);
    },
    async patrol() {
      const { s, b } = buriedAmateur(lab);
      const a = s.avalanche!;
      if (a.patrol?.phase === "called") a.patrol.eta = 2;
      const look = standOff(s, b, 6, 6.5, 4, 0.4, 55);
      const close = standOff(s, b, 5, 4.5, 3, 0.4, 58);
      const until = (want: string, share = 0): void => {
        skip(s, 200, NEUTRAL_INPUT, () => {
          const p = a.patrol;
          if (!p || p.phase !== want) return false;
          if (want === "coming") return p.t > share;
          if (want === "dig") return p.dug >= share * p.depth;
          return p.t >= share;
        });
        lab.play(s, 0.4);
      };
      until("coming", 4);
      lab.shoot(s, "skiing in", onMan(s, -11, 3, 2.4));
      until("search", 2);
      lab.shoot(s, "the coarse search on the flux line", onMan(s, 7, 4, 3));
      until("search", 5);
      lab.shoot(s, "bracketing over him", close);
      until("probe", 1.4);
      lab.shoot(s, "the probe spiral", close);
      until("dig", 0.35);
      lab.shoot(s, "digging from downhill", close);
      until("dig", 0.8);
      lab.shoot(s, "almost down to him", look);
      until("leave", 3);
      lab.shoot(s, `out ${b.alive ? "alive" : "dead"}, standing by`, look);
    },
    async buried() {
      const face = lab.face();
      let s: GameState | null = null;
      for (const down of [6, 0, 12, 20, 30]) {
        const t = lab.fresh(0);
        const f = fallAt(t, face.x, face.z);
        placeRun(t, {
          x: face.x + f.x * down,
          z: face.z + f.z * down,
          heading: Math.atan2(f.z, -f.x),
          speed: 0,
        });
        releaseAvalanche(t, t.avalanche!, t.skier.x, t.skier.z, []);
        skip(t, 60, { ...NEUTRAL_INPUT, brake: 1 }, () => t.avalanche!.victim?.phase === "buried");
        if (t.avalanche!.victim?.phase === "buried") {
          s = t;
          break;
        }
      }
      if (!s) throw new Error("the player was never buried on the lab's face");
      const a = s.avalanche!;
      // Air enough for the patrol to come in time, his bar draining as it does.
      a.victim!.air = 130;
      const veil = (): ComponentChild => {
        const r = buriedRead(s!);
        return r ? h(BuriedVeil, { buried: r }) : null;
      };
      lab.play(s, 0.4);
      lab.shoot(s, `under ${a.victim!.depth.toFixed(2)} m: the patrol called`, "chase", veil());
      const until = (want: string, share: number): void => {
        skip(s!, 200, NEUTRAL_INPUT, () => {
          const p = a.patrol;
          if (!p || p.phase !== want) return false;
          return want === "dig" ? p.dug >= share * p.depth : p.t >= share;
        });
        lab.play(s!, 0.3);
      };
      until("search", 3);
      lab.shoot(s, "they are searching over him", "chase", veil());
      until("dig", 0.3);
      lab.shoot(s, "the shovels coming down: the lens pulled up", "chase", veil());
      until("dig", 0.7);
      lab.shoot(s, "nearly out", "chase", veil());
      skip(s, 60, NEUTRAL_INPUT, () => !s!.skier.thrown);
      lab.play(s, 1);
      lab.shoot(s, "dug out and stood up", "chase", veil());
    },
  };
}
