// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER LAB'S SCENES (`heli-harness.ts`): every event the free
// ride's helicopter has (`docs/helicopter.md`), staged on the engine and
// photographed through the game's own renderer. A scene stands up its own
// run (`Stage.fresh`), so any one of them can be shot alone; it moves it on
// by stepping the engine — the machine flown by the bot pilot
// (`pilotInput`, to an aim), the drop the jump's press — and sets the
// machine's place and way directly (`place`) only where a frame must be
// exact (a height over the powder, a dive into the snow). Nothing reads a
// wall clock, so a seed's sheet is the same sheet twice.

import {
  HANG_AIR,
  HANG_GROUND,
  HELI,
  heliPoint,
  NEUTRAL_INPUT,
  pilotInput,
  standSkier,
  TUNING,
  type GameState,
  type HeliAim,
  type Level,
  type SkierInput,
  type SkyOverride,
} from "@engine";

import { createHeliCam, frameHeli, HELI_LOOK } from "../game/camera-heli.ts";
import type { LensPose } from "../game/camera-rigs.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import type { Hideable } from "../game/benchmark-report.ts";
import { heliMiddle, outside, type Spot, type Spots } from "./heli-spots.ts";

/** A lens for a frame: a rung of the game's own ladder (the helicopter's
 * lens while he rides it), a pose planted for it, or one worked out off
 * the state at the moment it is shot. */
export type Lens = CameraRung | LensPose | ((state: GameState) => LensPose);

/** What drives a run on, step by step. */
export type Drive = (state: GameState) => SkierInput;

/** What a scene may ask of the page. */
export type Stage = {
  level: Level;
  spots: Spots;
  /** A free ride stood up on the map: sat on the helicopter's skid on its
   * pad (`heli`), or with the skier on the start line and the machine
   * parked. */
  fresh(heli: boolean): GameState;
  /** Ride `seconds` on, drawing every frame unseen (the lens's springs, the
   * snow cloud and the fire all move as they would on screen). */
  run(state: GameState, seconds: number, drive?: Drive): void;
  /** Ride on until `test` holds, at most `limit` s; whether it did. */
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  /** One engine step with `input`, and a frame drawn unseen. */
  once(state: GameState, input: SkierInput): void;
  /** The camera rung the run is seen through from here on, cut to. */
  camera(rung: CameraRung): void;
  /** The camera rung flown to, as a press of the camera key is. */
  fly(rung: CameraRung): void;
  /** Photograph the run as it stands, as `label`, through `lens`. */
  shoot(state: GameState, label: string, lens?: Lens): void;
  /** The sky the picture is drawn under (`withSky`); null for the lab's
   * own. */
  sky(over: SkyOverride | null): Promise<void>;
  /** Draw without these subsystems (`setHidden`); [] for all. */
  hide(names: readonly Hideable[]): void;
};

const still: Drive = () => NEUTRAL_INPUT;
/** The controls let go: the collective down, the cyclic and pedals centred. */
const letGo: Drive = () => ({
  ...NEUTRAL_INPUT,
  heli: { collective: 0, pitch: 0, roll: 0, pedal: 0 },
});
const flyTo =
  (aim: HeliAim): Drive =>
  (s) =>
    pilotInput(s, aim);

/** THE MACHINE SET DOWN where a frame needs it: `height` m of skid over
 * the snow at (x, z), its nose on `heading`, going `speed` m/s along it and
 * `vy` m/s up — level, its rotor holding its weight, its clock restarted so
 * the skier on the skid moves with it from the first step. */
function place(
  state: GameState,
  at: { x: number; z: number },
  height: number,
  heading: number,
  speed = 0,
  vy = 0,
): void {
  const h = state.heli!;
  const ground = state.level.groundAt(at.x, at.z);
  Object.assign(h, {
    x: at.x,
    y: ground + height,
    z: at.z,
    vx: Math.sin(heading) * speed,
    vy,
    vz: Math.cos(heading) * speed,
    heading,
    pitch: 0,
    roll: 0,
    disc: { pitch: 0, roll: 0, pitchRate: 0, rollRate: 0 },
    yawRate: 0,
    pitchRate: 0,
    rollRate: 0,
    grounded: height <= 0.01,
    thrust: height > 0.01 ? HELI.mass * TUNING.g : 0,
    hang: height > 0.01 ? HANG_AIR : HANG_GROUND,
    t: 0,
  });
}

/** The machine press: the skier pushed off the skid, the pilot's hands on
 * the controls through the step. */
function push(st: Stage, s: GameState, aim?: HeliAim): void {
  st.once(s, { ...(s.heli?.rider ? pilotInput(s, aim) : NEUTRAL_INPUT), machine: true });
}

const bearing = (from: { x: number; z: number }, to: { x: number; z: number }): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

/** The parked machine's lens on a rung, as if he rode it. */
function parkedLens(st: Stage, s: GameState, rung: CameraRung): LensPose {
  const h = s.heli!;
  return frameHeli(
    createHeliCam(),
    h,
    { x: h.x, y: h.y, z: h.z, heading: h.heading },
    rung,
    0,
    (x, z) => st.level.groundAt(x, z),
  );
}

/** A lens at the rider on the skid: `ahead` m along the way he faces and
 * `side` m to his right, `up` m over his middle. */
function riderLens(s: GameState, ahead: number, side: number, up: number, fov = 45): LensPose {
  const c = s.skier;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const mid = { x: c.x, y: c.y - 0.15, z: c.z };
  return {
    eye: { x: mid.x + fx * ahead + fz * side, y: mid.y + up, z: mid.z + fz * ahead - fx * side },
    target: mid,
    fov,
    roll: 0,
  };
}

/** A skier stood `d` m out along the pad's approach, facing it and coming
 * in at `speed` m/s. */
function rideIn(st: Stage, d: number, speed: number): GameState {
  const s = st.fresh(false);
  const { pad, approach } = st.spots;
  const x = pad.x + Math.sin(approach.out) * d;
  const z = pad.z + Math.cos(approach.out) * d;
  const toward = approach.out + Math.PI;
  standAt(s, x, z, toward, speed);
  return s;
}

function standAt(s: GameState, x: number, z: number, heading: number, speed: number): void {
  standSkier(s, x, z, heading);
  const c = s.skier;
  c.vx = Math.sin(heading) * speed;
  c.vz = Math.cos(heading) * speed;
}

/** On the skid, hovering `height` m over `spot`, settled for `settle` s. */
function hover(st: Stage, spot: Spot, height: number, settle: number): GameState {
  const s = st.fresh(true);
  place(s, spot, height, s.heli!.heading);
  st.run(s, settle, flyTo({ x: spot.x, z: spot.z, height }));
  return s;
}

/** In forward flight from a third of the way from the pad to the flat,
 * `height` m up, flown on toward the flat for `settle` s. */
function cruising(st: Stage, height: number, settle: number): GameState {
  const { pad, flat } = st.spots;
  const s = st.fresh(true);
  const start = { x: pad.x + (flat.x - pad.x) * 0.3, z: pad.z + (flat.z - pad.z) * 0.3 };
  place(s, start, height, bearing(start, flat), 25);
  st.run(s, settle, flyTo({ x: flat.x, z: flat.z, height }));
  return s;
}

/** Down on the flat: flown in from below it and set down by the pilot
 * (`land`, asked every step). Shots as it comes over the flat and as its
 * skids come within 3 m of the snow; whether it got down. */
function landing(st: Stage, s: GameState, shots?: (stage: "approach" | "flare") => void): boolean {
  const { flat } = st.spots;
  const down = flyTo({ x: flat.x, z: flat.z, height: 30, land: true });
  const near = (q: GameState) => Math.hypot(q.heli!.x - flat.x, q.heli!.z - flat.z) < 25;
  st.until(s, (q) => near(q) || q.heli!.grounded, 60, down);
  shots?.("approach");
  const skid = (q: GameState) => q.heli!.y - q.level.groundAt(q.heli!.x, q.heli!.z);
  st.until(s, (q) => (near(q) && skid(q) < 3) || q.heli!.grounded, 60, down);
  shots?.("flare");
  return st.until(s, (q) => q.heli!.grounded || q.heli!.mode === "wreck", 30, down);
}

function approachStart(st: Stage, s: GameState): void {
  const { flat, pad } = st.spots;
  const back = bearing(flat, pad);
  const from = { x: flat.x + Math.sin(back) * 140, z: flat.z + Math.cos(back) * 140 };
  const top = Math.max(flat.y + 25 - s.level.groundAt(from.x, from.z), 25);
  place(s, from, top, back + Math.PI);
}

/** Into the snow: `height` m over the meadow, falling at `vy` m/s and
 * going `speed` m/s forward, seen through `rung` — and on until it goes
 * up. */
function crashed(
  st: Stage,
  rung: CameraRung = "chase",
  speed = 6,
  vy = -15,
  height = 6,
): GameState {
  const s = st.fresh(true);
  st.camera(rung);
  place(s, st.spots.meadow, height, s.heli!.heading, speed, vy);
  st.run(s, 0.5, (q) => ({
    ...letGo(q),
    heli: { collective: 0.35, pitch: 0.1, roll: 0, pedal: 0 },
  }));
  st.until(s, (q) => q.heli!.mode === "wreck", 4, letGo);
  return s;
}

/** The crash seen through the game's own lens at each of `times` s. */
function crashFrames(st: Stage, s: GameState, rung: CameraRung, times: readonly number[]): void {
  let t = 0;
  for (const at of times) {
    st.run(s, at - t, still);
    t = at;
    st.shoot(s, `${at}s`, rung);
  }
}

/** The skier pushed off over `spot` from `height` m; the step of the push. */
function dropped(st: Stage, spot: Spot, height: number): GameState {
  const s = hover(st, spot, height, 3);
  push(st, s, { x: spot.x, z: spot.z, height });
  return s;
}

const skierAt = (s: GameState): Spot => ({ x: s.skier.x, y: s.skier.y + 0.6, z: s.skier.z });

/** Every view, by name: each stages its run and shoots its frames. */
export const VIEWS: Record<string, (st: Stage) => Promise<void> | void> = {
  pad(st) {
    const s = st.fresh(false);
    st.run(s, 0.3);
    const h = s.heli!;
    const mid = heliMiddle(s);
    st.shoot(s, "chase", parkedLens(st, s, "chase"));
    st.shoot(s, "far", parkedLens(st, s, "far"));
    st.shoot(s, "high", parkedLens(st, s, "high"));
    st.shoot(s, "front-quarter", outside(st.level, mid, h.heading + Math.PI / 4, 16));
    st.shoot(s, "rear-quarter", outside(st.level, mid, h.heading + Math.PI * 1.22, 16));
  },

  call(st) {
    st.camera("chase");
    for (const d of [130, 85, 40, 14]) {
      const s = rideIn(st, d, 4);
      st.run(s, 0.6);
      st.shoot(s, `${d}m`, "chase");
    }
    // Lit for him, from beside the pad.
    const s = rideIn(st, 30, 0);
    st.run(s, 0.4);
    st.shoot(s, "lit-quarter", outside(st.level, heliMiddle(s), s.heli!.heading - Math.PI / 4, 18));
    // Ridden in beside the seat, slow, and the machine press: taken on.
    const b = st.fresh(false);
    const h = b.heli!;
    const seat = heliPoint(h, { x: -HELI.seat.x, y: 0, z: HELI.seat.z });
    const out = bearing(h, seat);
    standAt(b, seat.x + Math.sin(out) * 1.4, seat.z + Math.cos(out) * 1.4, out + Math.PI, 1);
    st.run(b, 0.3);
    st.once(b, { ...NEUTRAL_INPUT, machine: true });
    st.run(b, 0.5);
    st.shoot(b, "boarded", "chase");
  },

  board(st) {
    const s = st.fresh(true);
    st.camera("chase");
    s.heli!.spool = 0;
    s.heli!.thrust = 0;
    st.run(s, 0.3, still);
    st.shoot(s, "spool-0.07", "chase");
    st.run(s, 1.2, still);
    st.shoot(s, "spool-0.33", "chase");
    st.run(s, 3.2, still);
    st.shoot(s, "spool-1", "chase");
    st.shoot(s, "rider-side", riderLens(s, 1.0, 3.2, 0.25));
    st.shoot(s, "rider-front", riderLens(s, 3.4, 0, 0.35));
    st.shoot(s, "rider-quarter", riderLens(s, 2.4, -2.4, 1.2));
    st.shoot(s, "helmet", "helmet");
  },

  spool(st) {
    // THE ROTOR SPOOLING UP, from above the machine's quarter where the
    // whole disc shows: the blades turning, smeared, gone to a haze, and
    // the strobed ghost drifting back. Three frames a moment, 1/60 s apart,
    // so the way the pattern moves can be read off the sheet.
    const s = st.fresh(true);
    s.heli!.spool = 0;
    s.heli!.thrust = 0;
    const h = s.heli!;
    const mid = { ...heliMiddle(s), y: h.y + HELI.rotor.hub };
    const lens = outside(st.level, mid, h.heading + Math.PI * 0.75, 8, 0, 6, 60);
    let t = 0;
    for (const at of [0.4, 1, 1.6, 2.2, 2.8, 3.6, 5]) {
      st.run(s, at - t, still);
      t = at;
      for (let k = 0; k < 3; k++) {
        if (k) st.run(s, 1 / 60, still);
        st.shoot(s, `${at}s-${k}`, lens);
      }
      t += 2 / 60;
    }
  },

  liftoff(st) {
    const s = st.fresh(true);
    const { pad } = st.spots;
    st.camera("chase");
    const up = flyTo({ x: pad.x, z: pad.z, height: 8 });
    let t = 0;
    for (const at of [0.5, 1.5, 3, 5, 8]) {
      st.run(s, at - t, up);
      t = at;
      st.shoot(s, `${at}s`, "chase");
      if (at === 3) {
        st.shoot(s, "3s-outside", outside(st.level, heliMiddle(s), s.heli!.heading + 1.75, 30));
      }
    }
  },

  wash(st) {
    const { meadow } = st.spots;
    st.camera("chase");
    for (const height of [3, 8, 15, 30]) {
      const s = st.fresh(true);
      place(s, meadow, height, s.heli!.heading);
      const hold = flyTo({ x: meadow.x, z: meadow.z, height });
      if (height === 3) {
        st.run(s, 0.5, hold);
        st.shoot(s, "h3-0.5s", "chase");
        st.run(s, 1, hold);
        st.shoot(s, "h3-1.5s", "chase");
        st.run(s, 1.5, hold);
      } else st.run(s, 3, hold);
      st.shoot(s, `h${height}-chase`, "chase");
      // From the snow, framed on the snow and the machine both.
      const mid = { ...heliMiddle(s), y: (heliMiddle(s).y + meadow.y) / 2 + 1 };
      const off = 32 + height;
      st.shoot(
        s,
        `h${height}-outside`,
        outside(st.level, mid, s.heli!.heading + Math.PI / 2, off, 1.7, -Infinity, 55),
      );
    }
  },

  cruise(st) {
    st.camera("chase");
    const s = cruising(st, 45, 5);
    for (const rung of ["chase", "far", "high"] as const) st.shoot(s, rung, rung);
  },

  turn(st) {
    st.camera("chase");
    const s = cruising(st, 45, 5);
    const h = s.heli!;
    const right = h.heading + Math.PI / 2;
    const aim = { x: h.x + Math.sin(right) * 400, z: h.z + Math.cos(right) * 400, height: 45 };
    st.run(s, 1.2, flyTo(aim));
    st.shoot(s, "in-chase", "chase");
    st.shoot(s, "in-far", "far");
    st.run(s, 1.5, flyTo(aim));
    st.shoot(s, "through-chase", "chase");
    st.shoot(s, "through-far", "far");
  },

  eye(st) {
    const s = cruising(st, 45, 5);
    st.camera("helmet");
    st.shoot(s, "cruise-helmet", "helmet");
    st.shoot(s, "cruise-tips", "tips");
    const o = hover(st, st.spots.steep, 25, 3);
    st.shoot(o, "hover-steep-helmet", "helmet");
    st.camera("chase");
  },

  land(st) {
    const s = st.fresh(true);
    st.camera("chase");
    approachStart(st, s);
    const side = (q: GameState) => bearing(st.spots.flat, q.heli!) + Math.PI / 2;
    const look = (q: GameState) =>
      outside(st.level, heliMiddle(q), side(q), 38, 1.7, st.spots.flat.y + 3 - heliMiddle(q).y);
    const down = landing(st, s, (stage) => {
      st.shoot(s, `${stage}-chase`, "chase");
      st.shoot(s, `${stage}-outside`, look);
    });
    st.shoot(s, down ? "touchdown-chase" : "not-down", "chase");
    st.shoot(s, "touchdown-outside", look);
  },

  landed(st) {
    const s = st.fresh(true);
    st.camera("chase");
    approachStart(st, s);
    landing(st, s);
    const { flat } = st.spots;
    const sit = flyTo({ x: flat.x, z: flat.z, height: 30, land: true });
    st.run(s, 2, sit);
    const side = bearing(flat, s.heli!) + Math.PI / 2;
    const near = (q: GameState) => outside(st.level, heliMiddle(q), side, 22, 1.7);
    st.shoot(s, "rotor-chase", "chase");
    st.shoot(s, "rotor-outside", near(s));
    push(st, s, { x: flat.x, z: flat.z, height: 30, land: true });
    st.run(s, 0.3, still);
    st.shoot(s, "off-0.3s", "chase");
    st.run(s, 0.7, still);
    st.shoot(s, "off-1s", "chase");
    st.shoot(s, "off-1s-outside", outside(st.level, skierAt(s), side, 22, 1.7));
    st.run(s, 1.5, still);
    st.shoot(s, "off-2.5s", "chase");
  },

  drop(st) {
    const { steep } = st.spots;
    st.camera("chase");
    const s = hover(st, steep, 14, 3);
    st.shoot(s, "hover", "chase");
    push(st, s, { x: steep.x, z: steep.z, height: 14 });
    st.shoot(s, "0s", "chase");
    let t = 0;
    for (const at of [0.5, 1, 2]) {
      st.run(s, at - t, still);
      t = at;
      st.shoot(s, `${at}s`, "chase");
    }
  },

  fall(st) {
    st.camera("chase");
    const s = dropped(st, st.spots.meadow, 40);
    st.run(s, 1, still);
    st.shoot(s, "1s", "chase");
    st.run(s, 1, still);
    st.shoot(s, "2s", "chase");
    st.shoot(s, "2s-outside", outside(st.level, skierAt(s), s.skier.heading + Math.PI / 2, 30));
  },

  impact(st) {
    st.camera("chase");
    const s = dropped(st, st.spots.meadow, 40);
    st.until(s, (q) => !q.skier.airborne || !!q.skier.thrown, 10, still);
    st.shoot(s, "0s", "chase");
    st.run(s, 0.3, still);
    st.shoot(s, "0.3s", "chase");
    st.shoot(s, "0.3s-outside", outside(st.level, skierAt(s), s.skier.heading + Math.PI / 2, 14));
    st.run(s, 0.7, still);
    st.shoot(s, "1s", "chase");
    st.run(s, 1.5, still);
    st.shoot(s, "2.5s", "chase");
  },

  home(st) {
    st.camera("chase");
    const s = dropped(st, st.spots.meadow, 6);
    const watch = (q: GameState): LensPose => {
      const c = q.skier;
      const eye = { x: c.x, y: q.level.groundAt(c.x, c.z) + 1.7, z: c.z };
      return { eye, target: heliMiddle(q), fov: 45, roll: 0 };
    };
    let t = 0;
    for (const at of [3, 6, 10, 16]) {
      st.run(s, at - t, still);
      t = at;
      st.shoot(s, `${at}s`, watch);
    }
    st.shoot(s, "16s-chase", "chase");
  },

  crash(st) {
    const s = crashed(st);
    crashFrames(st, s, "chase", [0, 0.1, 0.25, 0.5, 0.8, 1.2, 1.8, 2.6, 4, 6]);
  },

  thrown(st) {
    // The rider the blast throws, followed from the side of his flight.
    const s = crashed(st);
    const w = s.heli!.wreck!;
    const c = s.skier;
    const side = Math.atan2(c.vx, c.vz) + Math.PI / 2;
    const rider = (q: GameState): Spot => {
      const t = q.skier.thrown;
      return t ? { x: t.x, y: t.y, z: t.z } : skierAt(q);
    };
    const mid = (q: GameState): Spot => {
      const r = rider(q);
      return { x: (r.x + w.x) / 2, y: (r.y + w.y) / 2 + 2, z: (r.z + w.z) / 2 };
    };
    let t = 0;
    for (const at of [0.3, 0.8, 1.4, 2.2]) {
      st.run(s, at - t, still);
      t = at;
      st.shoot(s, `${at}s`, (q) => outside(st.level, mid(q), side, 45, 4, -Infinity, 55));
    }
    st.shoot(s, "2.2s-close", (q) => outside(st.level, rider(q), side, 9, 1.5, -Infinity, 45));
  },

  "crash-nose"(st) {
    const s = crashed(st, "tips");
    crashFrames(st, s, "tips", [0, 0.15, 0.5, 1, 2, 4]);
  },

  "crash-fast"(st) {
    const s = crashed(st, "far", 32, -6, 5);
    crashFrames(st, s, "far", [0, 0.3, 0.8, 1.5, 3, 6]);
  },

  handover(st) {
    // A press of the camera key mid-flight: chase to the nose, and on to
    // the far lens — each flown, never cut.
    st.camera("chase");
    const s = cruising(st, 45, 5);
    const { flat } = st.spots;
    const on = flyTo({ x: flat.x, z: flat.z, height: 45 });
    st.shoot(s, "chase", "chase");
    st.fly("tips");
    let t = 0;
    for (const at of [0.1, 0.25, 0.4, 0.6]) {
      st.run(s, at - t, on);
      t = at;
      st.shoot(s, `to-tips-${at}s`, "tips");
    }
    st.fly("far");
    st.run(s, 0.3, on);
    st.shoot(s, "to-far-0.3s", "far");
  },

  wreck(st) {
    const s = crashed(st);
    const w = s.heli!.wreck!;
    const at = { x: w.x, y: w.y + 1.5, z: w.z };
    st.run(s, 2.5, still);
    st.shoot(s, "2.5s-near", outside(st.level, at, s.heli!.heading + 1, 16, 2));
    st.run(s, 1, still);
    st.shoot(s, "3.5s-far", outside(st.level, at, s.heli!.heading + 3.5, 55, 6));
    st.shoot(s, "3.5s-lens", "chase");
  },

  restart(st) {
    const s = crashed(st);
    st.until(s, (q) => q.heli!.mode !== "wreck", 8, still);
    st.run(s, 0.1, still);
    st.shoot(s, "0.1s", "chase");
    st.run(s, 0.9, still);
    st.shoot(s, "1s-chase", "chase");
    st.shoot(s, "1s-far", "far");
  },

  async night(st) {
    await st.sky({ hour: 21 });
    st.camera("chase");
    const p = rideIn(st, 45, 3);
    st.run(p, 0.6);
    st.shoot(p, "call", "chase");
    st.shoot(p, "pad-quarter", outside(st.level, heliMiddle(p), p.heli!.heading + Math.PI / 4, 18));
    const { pad } = st.spots;
    const s = st.fresh(true);
    st.run(s, 6, flyTo({ x: pad.x, z: pad.z, height: 10 }));
    const side = s.heli!.heading + 2.1;
    st.shoot(s, "hover-chase", "chase");
    st.shoot(s, "hover-outside", outside(st.level, heliMiddle(s), side, 26));
    // The beacon flashes a tenth of a second in each: a burst to catch it.
    for (let k = 0; k < 10; k++) {
      st.run(s, 0.1, flyTo({ x: pad.x, z: pad.z, height: 10 }));
      st.shoot(s, `beacon-${k}`, outside(st.level, heliMiddle(s), side, 14, 4));
    }
    const c = cruising(st, 45, 5);
    st.shoot(c, "cruise-chase", "chase");
    st.shoot(c, "cruise-far", "far");
    await st.sky(null);
  },

  turntable(st) {
    const s = st.fresh(false);
    st.run(s, 0.3);
    st.hide(["forest"]);
    const h = s.heli!;
    const mid = { ...heliMiddle(s), y: h.y + 1.3 };
    const C = HELI_LOOK.chase;
    for (let k = 0; k < 8; k++) {
      const b = h.heading + (k / 8) * Math.PI * 2;
      st.shoot(s, `close-${k * 45}`, outside(st.level, mid, b, 12, 0, 0.9, 50));
    }
    for (let k = 0; k < 8; k++) {
      const b = h.heading + Math.PI + (k / 8) * Math.PI * 2;
      st.shoot(s, `chase-${k * 45}`, outside(st.level, mid, b, C.dist, 0, C.height, C.fov));
    }
    h.spool = 1;
    h.rotor = 0.7;
    st.shoot(s, "spin-side", outside(st.level, mid, h.heading + Math.PI / 2, 14, 0, 1.5, 50));
    st.shoot(s, "spin-top", outside(st.level, mid, h.heading + Math.PI * 0.8, 6, 0, 16, 60));
    h.spool = 0;
    st.hide([]);
  },
};

/** The sheets, each a group of views shot onto one page. */
export const GROUPS: Record<string, readonly string[]> = {
  pad: ["pad", "call"],
  board: ["board", "spool"],
  lift: ["liftoff", "wash"],
  flight: ["cruise", "turn", "eye"],
  land: ["land", "landed"],
  drop: ["drop", "fall", "impact", "home"],
  crash: ["crash", "thrown", "crash-nose", "crash-fast", "wreck", "restart"],
  handover: ["handover"],
  night: ["night"],
  turntable: ["turntable"],
};
