// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMP LAB'S SCENES (`skijump-harness.ts`): the ski jumping hill
// (R43) and a jump off it, staged on the engine and photographed through
// the game's own renderer — the hill from where a broadcast and a crowd
// see it, the jumper on the bar, in the tracks and at the edge, in the air
// over the landing hill and coming down at K among the distance boards.
// Every lens is planted off the hill's own frame (`ski-jump-frame.ts`), so
// a shot stands at the same place on the hill on any map. A scene stands
// up its own jump (`Stage.fresh`) and moves it on the bot's hands; nothing
// reads a wall clock, so a seed's sheet is the same sheet twice.

import { botInput, type GameState, type SkierInput } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import { hillFrame, hillPoint, type HillFrame } from "../game/ski-jump-frame.ts";

/** A lens for a frame: a rung of the game's own ladder (picked, as the
 * player picks one), the BROADCAST director the game opens a jump on, a
 * pose planted for it, or one worked out off the state when it is shot. */
export type Lens = CameraRung | "broadcast" | LensPose | ((state: GameState) => LensPose);
export type Drive = (state: GameState) => SkierInput;

export type Stage = {
  /** A jump stood up on the bar of the jury's gate, its contest dealt. */
  fresh(): GameState;
  run(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  shoot(state: GameState, label: string, lens?: Lens): void;
  /** The hour every frame after is drawn at (null: the map's own). */
  hour(h: number | null): Promise<void>;
};

const bot: Drive = (s) => botInput(s);

const frameOf = (s: GameState): HillFrame => {
  const f = hillFrame(s.level);
  if (!f) throw new Error("no ski jumping hill on this map");
  return f;
};

/** A lens at `(d, a, h)` of the hill's frame looking at `(td, ta, th)`. */
function planted(
  d: number,
  a: number,
  h: number,
  td: number,
  ta: number,
  th: number,
  fov = 50,
): (s: GameState) => LensPose {
  return (state) => {
    const f = frameOf(state);
    const eye = hillPoint(f, d, a, h);
    const ground = state.level.groundAt(eye.x, eye.z) + 1.2;
    return {
      eye: { ...eye, y: Math.max(ground, eye.y) },
      target: hillPoint(f, td, ta, th),
      fov,
      roll: 0,
    };
  };
}

/** A lens `a` m off the hill beside the jumper, `h` m over the snow at his
 * place along it, `lead` m ahead, looking at him. */
function beside(a: number, h: number, lead = 0, fov = 40): (s: GameState) => LensPose {
  return (state) => {
    const f = frameOf(state);
    const c = state.skier;
    const d = (c.x - f.x) * f.fx + (c.z - f.z) * f.fz;
    const eye = hillPoint(f, d + lead, a, h);
    const ground = state.level.groundAt(eye.x, eye.z) + 1.2;
    return {
      eye: { ...eye, y: Math.max(ground, eye.y) },
      target: { x: c.x, y: c.y, z: c.z },
      fov,
      roll: 0,
    };
  };
}

const stage = (s: GameState) => s.jump?.stage ?? "down";
/** The jumper `d` m of plan down the hill or further. */
const past = (d: number) => (s: GameState) => {
  const f = frameOf(s);
  return (s.skier.x - f.x) * f.fx + (s.skier.z - f.z) * f.fz >= d;
};

type Scene = (stage: Stage) => Promise<void> | void;

/** A lens CLOSE ON THE JUMPER, `dist` m off him: from his left side, ahead
 * of him, behind him or over him — read along the way he is going (the
 * hill's line at a crawl), so a flight is seen square to its path. */
function close(from: "side" | "front" | "behind" | "above", dist = 4.6, fov = 38) {
  return (state: GameState): LensPose => {
    const f = frameOf(state);
    const c = state.skier;
    const v = Math.hypot(c.vx, c.vy, c.vz);
    const al = v > 2 ? { x: c.vx / v, y: c.vy / v, z: c.vz / v } : { x: f.fx, y: 0, z: f.fz };
    const r = { x: f.rx, y: 0, z: f.rz };
    const up = {
      x: al.y * r.z - al.z * r.y,
      y: al.z * r.x - al.x * r.z,
      z: al.x * r.y - al.y * r.x,
    };
    // In the in-run's trough the side lens stands up over its wall; after
    // the touch a little ahead, out of the spray he trails.
    const inRun = stage(state) === "bar" || stage(state) === "tracks";
    const down = stage(state) === "down";
    const off =
      from === "side"
        ? { a: down ? 4 : 0, r: -dist, u: inRun ? 1.7 : down ? 1.2 : 0.25 }
        : from === "front"
          ? { a: dist * 1.35, r: -0.6, u: 0.35 }
          : from === "behind"
            ? { a: -dist, r: 0.6, u: 0.6 }
            : { a: -1.2, r: -0.3, u: stage(state) === "bar" ? dist * 0.55 : dist };
    const eye = {
      x: c.x + al.x * off.a + r.x * off.r + up.x * off.u,
      y: c.y + al.y * off.a + r.y * off.r + up.y * off.u,
      z: c.z + al.z * off.a + r.z * off.r + up.z * off.u,
    };
    eye.y = Math.max(eye.y, state.level.groundAt(eye.x, eye.z) + 0.3);
    return { eye, target: { x: c.x, y: c.y - 0.2, z: c.z }, fov, roll: 0 };
  };
}

/** A PHASE OF THE JUMPER (`skier-jumper.ts`), shot close from four sides. */
function phase(get: (st: Stage, s: GameState) => void): Scene {
  return (st) => {
    const s = st.fresh();
    get(st, s);
    for (const from of ["side", "front", "behind", "above"] as const) {
      st.shoot(s, from, close(from));
    }
  };
}
const toAir = (st: Stage, s: GameState) => st.until(s, (x) => stage(x) === "air", 40, bot);
const toTouch = (st: Stage, s: GameState) =>
  st.until(s, (x) => x.jump?.record.landing != null, 60, bot);

/** The jumper's phases, bar to out-run (`make skijump ARGS=--sheet=jumper`). */
const JUMPER_VIEWS: Record<string, Scene> = {
  "jumper-bar": phase((st, s) => st.run(s, 1.2)),
  "jumper-crouch": phase((st, s) => {
    st.until(s, (x) => stage(x) === "tracks", 30, bot);
    st.until(s, past((frameOf(s).hill.from + frameOf(s).hill.table) / 2), 20, bot);
  }),
  "jumper-takeoff": phase((st, s) => {
    st.until(s, (x) => (x.jump?.pressAt ?? -1) >= 0, 40, bot);
    st.run(s, 0.2, bot);
  }),
  "jumper-early": phase((st, s) => {
    toAir(st, s);
    st.run(s, 0.3, bot);
  }),
  "jumper-vee": phase((st, s) => {
    toAir(st, s);
    st.run(s, 1.8, bot);
  }),
  "jumper-prep": phase((st, s) => {
    st.until(s, (x) => (x.jump?.prepAt ?? -1) >= 0, 60, bot);
    st.run(s, 0.3, bot);
  }),
  "jumper-telemark": phase((st, s) => {
    toTouch(st, s);
    st.run(s, 0.75, bot);
  }),
  "jumper-outrun": phase((st, s) => {
    toTouch(st, s);
    st.run(s, 2.3, bot);
  }),
};

/** Where on the hill a still of the empty hill is shot from, each a lens
 * reading the hill's own places. */
const hillShots = (st: Stage, s: GameState): void => {
  const h = frameOf(s).hill;
  const mid = (h.edge + h.k) / 2;
  // The broadcast's main side camera: two thirds of the way to K, in the
  // clearing beside the landing hill, at the flight's height.
  st.shoot(s, "broadcast side", planted(h.k - 40, -27, 14, mid + 10, 0, -2, 62));
  st.shoot(s, "from the out-run", planted(h.outrun + 25, 4, 5, h.edge - 10, 0, 8, 55));
  st.shoot(s, "down the in-run", planted(1, 0, 2.4, h.edge + 30, 0, -12, 70));
  st.shoot(s, "judges' tower", planted(h.k - 45, -23, 9, h.k + 5, 0, -2, 62));
  st.shoot(s, "aerial", planted(h.k + 120, -150, 150, h.k - 30, 0, 0, 50));
  st.shoot(s, "silhouette", planted(h.u - 30, -22, 1.2, h.from, 0, 4, 55));
};

export const VIEWS: Record<string, Scene> = {
  /** THE RAISED IN-RUN (`ski-jump-raised.ts`): the deck on its truss and
   * piers from the side and from below, the tower, and the jumper on it. */
  structure(st) {
    const s = st.fresh();
    st.run(s, 0.3);
    const h = frameOf(s).hill;
    const mid = h.edge / 2;
    st.shoot(s, "side, high", planted(mid, -70, 30, mid, 0, -14, 52));
    st.shoot(s, "side, three-quarter", planted(h.edge + 40, -55, 22, mid - 10, 0, -14, 52));
    st.shoot(s, "from below", planted(mid + 6, -9, -40, mid - 6, 0, -4, 70));
    st.shoot(s, "piers, up the line", planted(h.edge - 6, 7, -2, mid - 20, 0, -22, 62));
    st.shoot(s, "tower", planted(-34, -26, -14, -4, 0, -12, 55));
    st.shoot(s, "tower, behind", planted(-45, 14, 6, -4, 0, -6, 55));
    st.until(s, (x) => stage(x) === "tracks", 30, bot);
    st.until(s, past(mid), 20, bot);
    st.shoot(s, "on the deck, side", beside(-14, 1, 0, 40));
    st.shoot(s, "on the deck, chase", "chase");
    st.shoot(s, "on the deck, below", beside(-10, -18, -4, 55));
  },
  /** A WHOLE JUMP THROUGH THE BROADCAST (`camera-skijump.ts`): the frames
   * the game shows a jump in by default, bar to out-run. */
  broadcast(st) {
    const s = st.fresh();
    const h = frameOf(s).hill;
    st.run(s, 1);
    st.shoot(s, "on the bar, opening", "broadcast");
    st.run(s, 1.6);
    st.shoot(s, "on the bar", "broadcast");
    st.until(s, (x) => stage(x) === "tracks", 30, bot);
    st.run(s, 0.6, bot);
    st.shoot(s, "off the bar", "broadcast");
    st.until(s, past(h.edge * 0.6), 20, bot);
    st.shoot(s, "in the tracks", "broadcast");
    st.until(s, past(h.edge - 12), 20, bot);
    st.shoot(s, "to the edge", "broadcast");
    st.until(s, (x) => stage(x) === "air", 20, bot);
    st.run(s, 0.25, bot);
    st.shoot(s, "take-off", "broadcast");
    st.run(s, 0.8, bot);
    st.shoot(s, "early flight", "broadcast");
    st.run(s, 1.2, bot);
    st.shoot(s, "mid flight", "broadcast");
    st.until(s, (x) => x.jump?.record.landing != null, 20, bot);
    st.shoot(s, "touch", "broadcast");
    st.run(s, 1, bot);
    st.shoot(s, "telemark", "broadcast");
    st.run(s, 1.5, bot);
    st.shoot(s, "out-run", "broadcast");
    st.run(s, 2.5, bot);
    st.shoot(s, "stopping", "broadcast");
  },
  hill(st) {
    const s = st.fresh();
    st.run(s, 0.3);
    hillShots(st, s);
  },
  async night(st) {
    await st.hour(21);
    const s = st.fresh();
    st.run(s, 0.3);
    hillShots(st, s);
    await st.hour(null);
  },
  inrun(st) {
    const s = st.fresh();
    st.run(s, 0.5);
    st.shoot(s, "on the bar", "chase");
    st.shoot(s, "on the bar, close", beside(3, 1.5, 3, 45));
    st.until(s, (x) => stage(x) === "tracks", 30, bot);
    st.until(s, past((frameOf(s).hill.from + frameOf(s).hill.table) / 2), 20, bot);
    st.shoot(s, "in the tracks", "chase");
    st.shoot(s, "tips", "tips");
    st.shoot(s, "in the tracks, beside", beside(5, 2.5, 2, 40));
    st.until(s, past(frameOf(s).hill.edge - 6), 20, bot);
    st.shoot(s, "at the edge", "chase");
    st.shoot(s, "at the edge, profile", beside(7, 1.5, 0, 40));
  },
  flight(st) {
    const s = st.fresh();
    st.until(s, (x) => stage(x) === "air", 40, bot);
    st.run(s, 0.6, bot);
    st.shoot(s, "early, side", beside(28, 4, 10, 45));
    st.shoot(s, "early, chase", "chase");
    st.run(s, 1.4, bot);
    st.shoot(s, "mid, side", beside(48, 3, 8, 42));
    st.shoot(s, "mid, chase", "chase");
    st.shoot(s, "mid, far", "far");
    st.run(s, 1.2, bot);
    st.shoot(s, "late, side", beside(32, 2, 6, 42));
  },
  landing(st) {
    const s = st.fresh();
    st.until(s, (x) => x.jump?.record.landing != null, 60, bot);
    st.shoot(s, "touch, side", beside(-30, 2, 0, 50));
    st.shoot(s, "touch, chase", "chase");
    st.shoot(s, "touch, boards", beside(-14, 1.6, -6, 55));
    st.run(s, 1.5, bot);
    st.shoot(s, "telemark held", beside(-25, 2, 2, 45));
    st.run(s, 3, bot);
    st.shoot(s, "out-run", "chase");
    const h = frameOf(s).hill;
    st.shoot(s, "K and HS lines", planted(h.k - 14, -15, 3, h.l + 5, 6, 0, 60));
  },
  ...JUMPER_VIEWS,
};

export const GROUPS: Record<string, readonly string[]> = {
  hill: ["hill", "night"],
  structure: ["structure"],
  broadcast: ["broadcast"],
  inrun: ["inrun"],
  flight: ["flight"],
  landing: ["landing"],
  jumper: Object.keys(JUMPER_VIEWS),
};
