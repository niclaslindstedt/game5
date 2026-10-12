// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE LAB'S SCENES (`skydive-harness.ts`): the free ride's skydive
// (`engine/game/chute.ts`, drawn by `chute-scene.ts`, the body posed by
// `skier-skydive.ts`) staged on the engine and photographed through the
// game's own renderer — stood up in freefall, under the canopy or in the
// plane's door off `skydiveAt`, and flown on by the jumper's own keys (the
// machine press the pull, the cut-away and the reserve, the edge the toggles, the back
// key the flare, the lean the track and the risers, the tuck head down) or
// on the bot's hands (`chutePilot`, `skydiveInput`). A scene stands up its
// own run (`Stage.fresh`), so any one of them can be shot alone. Nothing
// reads a wall clock, so a seed's sheet is the same sheet twice.

import {
  CHUTE,
  NEUTRAL_INPUT,
  chutePilot,
  liftPlans,
  paraPilot,
  pilotInput,
  ropeAt,
  skydiveAt,
  skydiveInput,
  trackPointAt,
  upRope,
  type GameState,
  type Level,
  type SkierInput,
  type SkyOverride,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import type { CameraRung } from "../game/renderer-api.ts";

/** A lens for a frame: a rung of the game's own ladder, a pose planted for
 * it, or one worked out off the state at the moment it is shot. */
export type Lens = CameraRung | LensPose | ((state: GameState) => LensPose);

/** The craft a run is stood up in. */
export type Ride = "plane" | "heli" | "balloon" | "para";

/** What drives a run on, step by step. */
export type Drive = (state: GameState) => SkierInput;

/** What a scene may ask of the page. */
export type Stage = {
  level: Level;
  /** A free ride stood up in the jump plane's door on its strip — or, with
   * a `ride`, on the helicopter's skid on its pad, in the balloon's basket
   * or under the paramotor's wing on the summit. */
  fresh(ride?: Ride): GameState;
  /** Stepped and drawn every sixtieth of a second. */
  run(state: GameState, seconds: number, drive?: Drive): void;
  /** Stepped and not drawn, then `run` a moment so the drawing catches up. */
  skip(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  camera(rung: CameraRung): void;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
};

const RUNGS = ["tips", "helmet", "chase", "far", "high", "orbit"] as const;
const still: Drive = () => NEUTRAL_INPUT;
const keys =
  (o: Partial<SkierInput>): Drive =>
  () => ({ ...NEUTRAL_INPUT, ...o });
const bot: Drive = (s) => chutePilot(s);
/** THE MACHINE PRESS taken once — on the first step of a frame, as the
 * app's input hands it over a step at a time, never held over the frame's
 * two steps (the second would be the next press: a cut-away and the
 * reserve's pull in one frame). */
const press = (): Drive => {
  let done = false;
  return () => {
    if (done) return NEUTRAL_INPUT;
    done = true;
    return { ...NEUTRAL_INPUT, machine: true };
  };
};

/** A lens planted off the jumper where he is: `right` m to the right of
 * his heading, `up` m over him, `back` m behind him, looking at a point
 * `over` m up from his middle (the canopy over him is some 4 m up). */
function around(
  right: number,
  up: number,
  back: number,
  fov = 45,
  over = 0,
): (s: GameState) => LensPose {
  return (state) => {
    const c = state.skier;
    const h = state.chute?.heading ?? c.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const ex = c.x + fz * right - fx * back;
    const ez = c.z - fx * right - fz * back;
    const ey = Math.max(state.level.groundAt(ex, ez) + 0.5, c.y + up);
    return {
      eye: { x: ex, y: ey, z: ez },
      target: { x: c.x, y: c.y + over, z: c.z },
      fov,
      roll: 0,
    };
  };
}

/** A lens off a point: `at` the point (or worked out off the state), the
 * eye `right`, `up`, `back` of it along the world's x, y, z. */
function overPoint(
  at: (s: GameState) => { x: number; y: number; z: number },
  dx: number,
  dy: number,
  dz: number,
  fov = 45,
): (s: GameState) => LensPose {
  return (state) => {
    const p = at(state);
    const ex = p.x + dx;
    const ez = p.z + dz;
    return {
      eye: { x: ex, y: Math.max(state.level.groundAt(ex, ez) + 0.5, p.y + dy), z: ez },
      target: { ...p },
      fov,
      roll: 0,
    };
  };
}

/** Over the middle of the ski area's piste, heading down it. */
function overPiste(level: Level): { x: number; z: number; heading: number } {
  const p = trackPointAt(level, level.track.length * 0.45);
  return { x: p.x, z: p.z, heading: p.heading };
}

/** A ride stood up `agl` m over the piste: in freefall, or under the open
 * canopy. */
function dive(st: Stage, agl: number, mode: "freefall" | "open" = "freefall"): GameState {
  const s = st.fresh();
  const at = overPiste(st.level);
  skydiveAt(s, { ...at, agl, fall: mode === "freefall" ? 52 : undefined, mode });
  st.run(s, 0.6, still);
  return s;
}

/** The opening from freefall at 1,100 m, stepped to `t` s after the pull. */
function opening(st: Stage): GameState {
  const s = dive(st, 1100);
  st.run(s, 0.4, still);
  st.run(s, 1 / 60, press());
  return s;
}

/** Run on until the opening is `t` s old. */
function openTo(st: Stage, s: GameState, t: number): void {
  st.until(s, (x) => (x.chute?.deploy?.t ?? 0) >= t || x.chute?.mode === "open", 8, still);
}

const DEPLOY_SHOTS = [0.2, 0.36, 0.55, 0.85, 1.1, 1.32, 1.8, 2.4, 2.9, 3.25, 3.5];

export const VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // ── THE RIG ON HIM: from behind, the side and the front ───────────────
  gear(st) {
    const s = dive(st, 1800);
    st.shoot(s, "back", around(0.6, 3.6, 0.6, 40));
    st.shoot(s, "side", around(3.6, 0.8, 0.2, 40));
    st.shoot(s, "front", around(0.4, -2.4, -2.4, 40));
    st.shoot(s, "under", around(1.8, -3.2, 0.8, 42));
    const d = st.fresh();
    st.run(d, 0.5, still);
    st.shoot(d, "door close", around(-1.8, 0.6, 1.6, 36, 0.2));
    st.shoot(d, "door back", around(-0.4, 1, 1.8, 36, 0.2));
  },
  // ── THE RIG WORN CLOSE: on the snow after a landing, riding on, and
  // under the canopy — where it is seen longest, from every side ────────
  worn(st) {
    // Landed low over the open piste on the bot's hands, the canopy let go.
    const s = dive(st, 12, "open");
    st.until(s, (x) => x.chute?.mode === "landed" || !x.skier.airborne, 30, bot);
    st.run(s, 3, still);
    const o = 0.35;
    st.shoot(s, "back", around(0, 0.5, 1.9, 34, o));
    st.shoot(s, "back left", around(-1.3, 0.4, 1.4, 34, o));
    st.shoot(s, "back right", around(1.3, 0.4, 1.4, 34, o));
    st.shoot(s, "side left", around(-1.9, 0.2, 0, 34, o));
    st.shoot(s, "side right", around(1.9, 0.2, 0, 34, o));
    st.shoot(s, "front", around(0.5, 0.3, -1.9, 34, o));
    st.shoot(s, "above", around(0.2, 1.6, 0.8, 34, o));
    st.shoot(s, "chase", "chase");
    st.run(s, 1.2, keys({ tuck: 0.5 }));
    st.shoot(s, "riding", around(0.5, 0.9, 3, 36, o));
    st.shoot(s, "riding chase", "chase");
    const c = dive(st, 600, "open");
    st.run(c, 1.5, still);
    st.shoot(c, "canopy back", around(0.4, 0.4, 2.2, 36, 0.2));
    const f = dive(st, 1800);
    st.shoot(f, "freefall above", around(1.0, 2.4, 0.2, 36));
  },
  // ── THE DOOR AND THE EXIT, frame by frame ─────────────────────────────
  exit(st) {
    // Climbed to the jump run on the pilot's hands, held in the door the
    // moment the bot would go.
    const t = st.fresh();
    const held: Drive = (x) => ({ ...skydiveInput(x), machine: false });
    for (let i = 0; i < 400 && !skydiveInput(t).machine; i++) st.skip(t, 2.5, held);
    st.run(t, 1, held);
    const door = around(-6, 1.2, 1.5, 42, 0.4);
    st.shoot(t, "poised", door);
    st.shoot(t, "poised close", around(-2.6, 0.5, 0.4, 38, 0.3));
    st.shoot(t, "poised helmet", "helmet");
    st.until(t, (x) => !x.plane?.rider, 6, skydiveInput);
    for (const k of [0.15, 0.35, 0.6, 1.0, 1.6, 2.6]) {
      st.until(t, (x) => (x.chute?.since ?? 0) >= k, 4, still);
      st.shoot(t, `+${k}s`, around(-5, 1.5, 3, 48));
    }
    st.shoot(t, "game lens", "chase");
  },
  // ── FREEFALL: the box, the turns, the track, head down ────────────────
  freefall(st) {
    const s = dive(st, 2600);
    st.shoot(s, "box side", around(4, 1.2, 0, 44));
    st.shoot(s, "box above", around(0.6, 6, 1.5, 44));
    st.run(s, 1.2, keys({ steer: 1 }));
    st.shoot(s, "turn right", around(0.6, 6, 1.5, 44));
    st.run(s, 1.6, keys({ steer: -1 }));
    st.shoot(s, "turn left", around(0.6, 6, 1.5, 44));
    st.run(s, 3, keys({ lean: -1 }));
    st.shoot(s, "track side", around(4, 1.2, 0, 44));
    st.shoot(s, "track above", around(0.6, 6, 1.5, 44));
    st.run(s, 4, keys({ tuck: 1 }));
    st.shoot(s, "head down side", around(4, 0.5, 0, 44));
    st.shoot(s, "head down front", around(0.5, -1, -4, 44));
  },
  // ── THE OPENING, frame by frame ───────────────────────────────────────
  deploy(st) {
    const s = opening(st);
    for (const t of DEPLOY_SHOTS) {
      openTo(st, s, t);
      st.shoot(s, `${t.toFixed(2)}s`, around(9, 1, 2, 50, 2.5));
    }
    openTo(st, s, 9);
    st.shoot(s, "full", around(9, 2, 4, 50, 2.5));
  },
  "deploy-game"(st) {
    const s = opening(st);
    for (const t of [0.3, 0.9, 1.4, 2.2, 3.0, 3.5]) {
      openTo(st, s, t);
      st.shoot(s, `chase ${t.toFixed(1)}s`, "chase");
    }
  },
  // ── THE CANOPY: hands off, the toggles, the risers, the flare ─────────
  canopy(st) {
    const s = dive(st, 600, "open");
    st.run(s, 2, still);
    st.shoot(s, "hands off", around(8, 2, 4, 48, 2.5));
    st.shoot(s, "under", around(0.5, 0.6, 0.8, 70, 4));
    st.run(s, 1.5, keys({ steer: -1 }));
    st.shoot(s, "left toggle", around(-7, 1, 6, 48, 2.5));
    st.run(s, 2.5, keys({ steer: 1 }));
    st.shoot(s, "right toggle", around(7, 1, 6, 48, 2.5));
    st.run(s, 2, keys({ lean: 1 }));
    st.shoot(s, "front risers", around(8, 1, 0, 48, 2.5));
    st.run(s, 2, keys({ brake: 1 }));
    st.shoot(s, "brakes", around(6, 0.5, -4, 48, 2.5));
    st.shoot(s, "hands", around(0.8, 1.2, -1.4, 40, 0.8));
  },
  // The sport main's own shape against a 9-cell main's photographs: from
  // behind, the side, below, the front and over its top skin (the bridle,
  // the bag and the pilot chute on it), and in a turn.
  shape(st) {
    const s = dive(st, 700, "open");
    st.run(s, 3, still);
    st.shoot(s, "behind", around(0, 4.4, 11, 40, 4.4));
    st.shoot(s, "side", around(11, 4.4, 0, 40, 4.2));
    st.shoot(s, "below", around(0.4, -5, 2.5, 52, 4.2));
    st.shoot(s, "front", around(0, 4.6, -11, 40, 4.4));
    st.shoot(s, "top", around(2.5, 9.5, 6, 40, 4.6));
    st.shoot(s, "top side", around(7, 7, 0.5, 40, 4.6));
    st.run(s, 2.2, keys({ steer: 1 }));
    st.shoot(s, "turn behind", around(0, 4.4, 11, 40, 4.4));
    st.shoot(s, "turn side", around(-10, 3, 3, 44, 4));
  },
  landing(st) {
    const s = dive(st, 260, "open");
    st.until(s, (x) => (x.chute?.agl ?? 0) < 12, 90, bot);
    st.shoot(s, "final", around(6, 1, 12, 45, 2));
    st.until(s, (x) => (x.chute?.agl ?? 0) < 2.5, 10, bot);
    st.shoot(s, "flare", around(6, 0.5, -3, 45, 2));
    st.until(s, (x) => x.chute?.mode === "landed" || !x.skier.airborne, 10, bot);
    st.run(s, 0.6, still);
    st.shoot(s, "down", around(7, 2, 3, 48, 1));
    st.run(s, 2.5, still);
    st.shoot(s, "let go", around(8, 4, 6, 48, 0));
  },
  // ── THE CUT-AWAY ──────────────────────────────────────────────────────
  cutaway(st) {
    const piece = (x: GameState) => {
      const p = x.chute?.piece;
      return p ? { x: p.x, y: p.y, z: p.z } : { x: x.skier.x, y: x.skier.y, z: x.skier.z };
    };
    const s = dive(st, 500, "open");
    st.run(s, 1.5, still);
    st.shoot(s, "before", around(9, 3, 3, 50, 3));
    st.run(s, 1 / 60, press());
    for (const k of [0.15, 0.4]) {
      st.until(s, (x) => (x.chute?.t ?? 0) >= k, 4, still);
      st.shoot(s, `+${k}s`, around(9, 3, 3, 50, 3));
    }
    for (const k of [0.9, 1.6, 3]) {
      st.until(s, (x) => (x.chute?.t ?? 0) >= k, 4, still);
      st.shoot(s, `+${k}s cloth`, overPoint(piece, 9, 3, 7, 46));
    }
    // Cut away a few metres over the snow, so he lands on his skis and the
    // cloth comes down beside him and lies there.
    const low = dive(st, 6, "open");
    st.run(low, 0.2, still);
    st.run(low, 1 / 60, press());
    st.until(low, (x) => !!x.chute?.piece?.down, 60, still);
    st.run(low, 1, still);
    st.shoot(low, "on the snow", overPoint(piece, 7, 6, 7, 50));
    st.shoot(low, "on the snow low", overPoint(piece, 6, 1.6, -4, 50));
  },
  // ── THE RESERVE: pulled after the cut-away, frame by frame, and flown ──
  reserve(st) {
    const s = dive(st, 900, "open");
    st.run(s, 1.5, still);
    st.run(s, 1 / 60, press());
    st.until(s, (x) => (x.chute?.t ?? 0) >= 1.4, 4, still);
    st.shoot(s, "cut away", around(9, 2, 3, 50, 1));
    st.run(s, 1 / 60, press());
    openTo(st, s, 0.06);
    st.shoot(s, "handle close", around(-1.8, 0.6, -1.6, 42, 0.2));
    openTo(st, s, 0.2);
    st.shoot(s, "pulled close", around(-1.8, 0.6, -1.6, 42, 0.2));
    for (const t of [0.3, 0.6, 0.95, 1.3, 1.7, 2.1, 2.5]) {
      openTo(st, s, t);
      st.shoot(s, `${t.toFixed(2)}s`, around(9, 1, 2, 50, 2.5));
    }
    openTo(st, s, 9);
    st.run(s, 3, still);
    st.shoot(s, "behind", around(0, 4.2, 10, 40, 4.2));
    st.shoot(s, "side", around(10, 4.2, 0, 40, 4));
    st.shoot(s, "below", around(0.4, -5, 2.5, 52, 4));
    st.shoot(s, "top", around(2.5, 9, 6, 40, 4.4));
    const main = (x: GameState) => {
      const p = x.chute?.piece;
      return p ? { x: p.x, y: p.y, z: p.z } : { x: x.skier.x, y: x.skier.y, z: x.skier.z };
    };
    st.shoot(s, "the main away", overPoint(main, 10, 4, 10, 50));
    // The two canopies side by side in the sky: the main and the reserve.
    const a = dive(st, 700, "open");
    const b = st.fresh();
    const at = overPiste(st.level);
    skydiveAt(b, { ...at, agl: 700, mode: "open", reserve: true });
    st.run(b, 3.6, still);
    st.run(a, 3, still);
    st.shoot(a, "main behind", around(0, 4.2, 10, 40, 4.2));
    st.shoot(b, "reserve behind", around(0, 4.2, 10, 40, 4.2));
    // Down on the skis under it, on the bot's hands.
    const l = st.fresh();
    skydiveAt(l, { ...at, agl: 260, mode: "open", reserve: true });
    st.until(l, (x) => (x.chute?.agl ?? 0) < 2.5, 90, bot);
    st.shoot(l, "flare", around(6, 0.5, -3, 45, 2));
    st.until(l, (x) => x.chute?.mode === "landed" || !x.skier.airborne, 10, bot);
    st.run(l, 2.5, still);
    const spare = (x: GameState) => {
      const p = x.chute?.sparePiece;
      return p ? { x: p.x, y: p.y, z: p.z } : { x: x.skier.x, y: x.skier.y, z: x.skier.z };
    };
    st.shoot(l, "let go", overPoint(spare, 7, 5, 7, 50));
  },
  // ── MALFUNCTIONS (`mishaps.ts`): line twists and a line over ─────────
  // The main given each by hand, as a mishap stream would deal it: three
  // turns of twist kicked out on the edge, then a line over the right tip
  // spiralling him round, seen from behind, below, the side and the front.
  malfunction(st) {
    const s = dive(st, 900, "open");
    st.run(s, 1, still);
    s.chute!.mal = "twist";
    s.chute!.twist = 3 * 2 * Math.PI;
    st.run(s, 0.5, still);
    st.shoot(s, "twists behind", around(0, 3.2, 8, 44, 3));
    st.shoot(s, "twists close", around(3.5, 1.4, 3.5, 40, 1.4));
    st.run(s, 1.2, keys({ steer: 1 }));
    st.shoot(s, "kicking", around(6, 2, 5, 48, 2.5));
    const o = dive(st, 900, "open");
    st.run(o, 1, still);
    o.chute!.mal = "lineover";
    o.chute!.over = 1;
    st.run(o, 2.5, still);
    st.shoot(o, "line over behind", around(0, 4.4, 11, 40, 4.4));
    st.shoot(o, "line over below", around(0.4, -5, 2.5, 52, 4.2));
    st.shoot(o, "line over side", around(11, 4.4, 0, 40, 4.2));
    st.shoot(o, "line over front", around(0, 4.6, -11, 40, 4.4));
  },
  // ── CAUGHT: a crown and a lift's rope ─────────────────────────────────
  snag(st) {
    const level = st.level;
    // The tallest tree near the piste's middle.
    const mid = overPiste(level);
    let tree = level.trees[0];
    let best = -Infinity;
    for (const t of level.trees) {
      const d = Math.hypot(t.x - mid.x, t.z - mid.z);
      const score = t.height * 4 - d * 0.02;
      if (d < 900 && score > best) {
        best = score;
        tree = t;
      }
    }
    const s = st.fresh();
    const back = 40;
    const over = back * (CHUTE.flies.sink / CHUTE.flies.forward);
    const sx = tree.x;
    const sz = tree.z - back;
    const top = tree.y + tree.height - 2;
    const agl = top + over - CHUTE.canopy.lines - level.groundAt(sx, sz) - s.skier.spec.cogHeight;
    skydiveAt(s, { x: sx, z: sz, agl, heading: 0, mode: "open" });
    st.until(s, (x) => x.chute?.mode === "snagged", 20, still);
    st.run(s, 2, still);
    const caught = (q: GameState) => {
      const n = q.chute?.snag;
      return n ? { x: n.x, y: n.y - 3, z: n.z } : { x: q.skier.x, y: q.skier.y, z: q.skier.z };
    };
    // Framed on the crown's top and him under it: the cloth over the tree.
    const crown = (q: GameState) => {
      const n = q.chute?.snag;
      const t = n?.on === "tree" ? level.trees[n.index] : null;
      if (!t) return caught(q);
      const top = t.y + t.height;
      return { x: (t.x + q.skier.x) / 2, y: (top + q.skier.y) / 2, z: (t.z + q.skier.z) / 2 };
    };
    st.shoot(s, "crown", overPoint(caught, 13, 1, -9, 50));
    st.shoot(s, "crown side", overPoint(caught, -12, 3, 8, 50));
    st.shoot(s, "crown over", overPoint(crown, 15, 6, -13, 48));
    st.shoot(s, "crown round", overPoint(crown, -17, 4, -6, 48));
    // The rope: flown down across the longest chair's.
    const plans = liftPlans(level).filter((p) => p.lift.kind !== "drag");
    if (plans.length === 0) return;
    const plan = plans.reduce((a, b) => (b.length > a.length ? b : a));
    const u = plan.length * 0.5;
    const r = upRope(plan);
    const rx = plan.lift.bottom.x + plan.dx * u + plan.dz * r;
    const rz = plan.lift.bottom.z + plan.dz * u - plan.dx * r;
    const rope = ropeAt(plan, u);
    const across = Math.atan2(-plan.dz, plan.dx);
    const t = st.fresh();
    const up = 12;
    const away = up * (CHUTE.flies.forward / CHUTE.flies.sink);
    const x = rx - Math.sin(across) * away;
    const z = rz - Math.cos(across) * away;
    const h = rope + up - CHUTE.canopy.lines - level.groundAt(x, z) - t.skier.spec.cogHeight;
    skydiveAt(t, { x, z, agl: h, heading: across, mode: "open" });
    st.until(t, (q) => q.chute?.mode === "snagged", 14, still);
    st.run(t, 2, still);
    const held = (q: GameState) => {
      const n = q.chute?.snag;
      return n ? { x: n.x, y: n.y - 2, z: n.z } : { x: q.skier.x, y: q.skier.y, z: q.skier.z };
    };
    st.shoot(t, "rope", overPoint(held, 10, 1, 8, 45));
    st.shoot(t, "rope along", overPoint(held, plan.dx * 14, 2, plan.dz * 14, 50));
  },
  // ── EVERY RUNG of the camera ──────────────────────────────────────────
  lenses(st) {
    const s = dive(st, 2200);
    for (const r of RUNGS) {
      st.camera(r);
      st.run(s, 1.6, still);
      st.shoot(s, `freefall ${r}`, r);
    }
    const o = opening(st);
    for (const [r, t] of [
      ["chase", 1.2],
      ["far", 2.2],
      ["helmet", 3.0],
    ] as const) {
      st.camera(r);
      openTo(st, o, t);
      st.shoot(o, `opening ${r}`, r);
    }
    const c = dive(st, 700, "open");
    for (const r of RUNGS) {
      st.camera(r);
      st.run(c, 1.2, still);
      st.shoot(c, `canopy ${r}`, r);
    }
    st.camera("chase");
  },
  // ── EVERY STAGE OF THE BODY on one sheet, close — what `--skis=lynx`
  // looks at for the snowboarder: the door, the exit, the freefall's
  // bodies from the side, behind and below, the pull, the canopy, the
  // cut-away, the reserve, the flare and the landing ──────────────────
  stages(st) {
    const side = around(3.2, 0.6, 0.3, 42);
    const t = st.fresh();
    st.run(t, 0.5, still);
    st.shoot(t, "door", around(-2.6, 0.5, 0.4, 38, 0.3));
    st.shoot(t, "door outside", around(-3.4, 0.2, -1.2, 40, 0.1));
    const held: Drive = (x) => ({ ...skydiveInput(x), machine: false });
    for (let i = 0; i < 400 && !skydiveInput(t).machine; i++) st.skip(t, 2.5, held);
    st.run(t, 1, held);
    st.until(t, (x) => !x.plane?.rider, 6, skydiveInput);
    st.until(t, (x) => (x.chute?.since ?? 0) >= 0.25, 4, still);
    st.shoot(t, "exit", around(-4, 1.2, 2.4, 44));
    const s = dive(st, 2600);
    st.shoot(s, "box side", side);
    st.shoot(s, "box behind", around(0.3, 1.6, 3.4, 42));
    st.shoot(s, "box below", around(1.2, -3.4, 0.6, 42));
    st.run(s, 3, keys({ lean: -1 }));
    st.shoot(s, "track side", side);
    st.shoot(s, "track behind", around(0.3, 1.6, 3.4, 42));
    st.run(s, 4, keys({ tuck: 1 }));
    st.shoot(s, "head down side", side);
    const o = opening(st);
    openTo(st, o, 0.12);
    st.shoot(o, "reach", around(3.2, 0.8, 1.2, 42));
    openTo(st, o, 0.4);
    st.shoot(o, "throw", around(3.2, 0.8, 1.2, 42));
    const c = dive(st, 700, "open");
    st.run(c, 2, still);
    st.shoot(c, "canopy side", around(3.8, 0.2, 0.4, 46, 0));
    st.shoot(c, "canopy behind", around(0.4, 0.8, 3.8, 44, 0.6));
    st.shoot(c, "canopy below", around(1.2, -3.2, 1, 44, 0.4));
    st.run(c, 1 / 60, press());
    st.until(c, (x) => (x.chute?.t ?? 0) >= 0.4, 4, still);
    st.shoot(c, "cut away", around(3.4, 0.6, 1.2, 44));
    st.until(c, (x) => (x.chute?.t ?? 0) >= 1.4, 4, still);
    st.run(c, 1 / 60, press());
    openTo(st, c, 0.08);
    st.shoot(c, "reserve handle", around(-2.6, 0.6, -1.6, 42, 0.2));
    openTo(st, c, 0.22);
    st.shoot(c, "reserve pulled", around(-2.6, 0.6, -1.6, 42, 0.2));
    const at = overPiste(st.level);
    const r = st.fresh();
    skydiveAt(r, { ...at, agl: 600, mode: "open", reserve: true });
    st.run(r, 3, still);
    st.shoot(r, "under the reserve", around(3.8, 0.2, 0.4, 46, 0));
    // Set down a few metres over the piste, flared by hand.
    const l = st.fresh();
    const p = trackPointAt(st.level, st.level.track.length * 0.62);
    skydiveAt(l, { x: p.x, z: p.z, heading: p.heading, agl: 8, mode: "open" });
    st.until(l, (x) => (x.chute?.agl ?? 0) < 2.2, 10, still);
    st.until(l, (x) => (x.chute?.agl ?? 0) < 1.6, 4, keys({ brake: 1 }));
    st.shoot(l, "flare", around(3.6, 0.4, -1.4, 44, 0.4));
    st.shoot(l, "flare behind", around(0.4, 0.6, 3.6, 44, 0.4));
    st.until(l, (x) => x.chute?.mode === "landed" || !x.skier.airborne, 10, keys({ brake: 1 }));
    st.run(l, 0.4, still);
    st.shoot(l, "landed", around(3.6, 0.8, 1, 44));
  },
  // ── OUT OF ANOTHER CRAFT (`craftFreefall`) ─────────────────────────────
  // The same skydive out of the paramotor's dropped rig (the motor and the
  // wing falling away on their own), off the helicopter's skid and over the
  // balloon's side: the rig on him in the craft, out into freefall, the main
  // pulled on the bot's hands and flown.
  craft(st) {
    const pilot: Drive = (x) => chutePilot(x);
    const out = (s: GameState, tag: string): void => {
      if ((s.chute?.since ?? 0) < 0.8) {
        st.until(s, (x) => (x.chute?.since ?? 0) >= 0.8, 4, still);
        st.shoot(s, `${tag} out`, around(5, 2, 7, 50, -1));
      }
      st.run(s, 1.2, still);
      st.shoot(s, `${tag} freefall`, around(4, 1.5, 3, 46));
      st.until(s, (x) => x.chute?.mode === "open" || !x.chute, 15, pilot);
      st.run(s, 1.5, pilot);
      st.shoot(s, `${tag} canopy`, around(4, 0.6, 3, 46, 0.6));
    };
    // The paramotor: 24 s up on the bot's hands, then the rig let go.
    const p = st.fresh("para");
    st.skip(p, 24, (x) => paraPilot(x));
    st.run(p, 0.6, (x) => paraPilot(x));
    st.shoot(p, "para flown", around(5, 1, 8, 50, 1.5));
    st.run(p, 1 / 60, press());
    st.until(p, (x) => (x.chute?.since ?? 0) >= 1.5, 4, still);
    st.shoot(p, "para motor falling away", around(6, 6, 6, 60, -3));
    out(p, "para");
    // The helicopter: flown 300 m up off its pad by its pilot, then off the skid.
    const h = st.fresh("heli");
    const aim = h.heli ? { x: h.heli.x, z: h.heli.z - 100, height: 300 } : undefined;
    st.skip(h, 40, (x) => pilotInput(x, aim));
    st.run(h, 0.6, (x) => pilotInput(x, aim));
    st.shoot(h, "heli on the skid", around(6, 1, 6, 50, 0.5));
    st.run(h, 1 / 60, press());
    out(h, "heli");
    // The balloon: let go 300 m over the snow, then over the side.
    const b = st.fresh("balloon");
    const bal = b.balloon;
    if (bal) {
      bal.mode = "flown";
      bal.grounded = false;
      bal.y = st.level.groundAt(bal.x, bal.z) + 300;
      bal.vx = bal.vy = bal.vz = 0;
    }
    st.run(b, 0.6, still);
    st.shoot(b, "balloon in the basket", around(4, 1.5, 5, 50, 0.5));
    st.run(b, 1 / 60, press());
    out(b, "balloon");
  },
  // ── AFTER DARK ────────────────────────────────────────────────────────
  async night(st) {
    await st.sky({ hour: 21 });
    const s = dive(st, 2000);
    st.shoot(s, "freefall", around(4, 1.5, 1, 46));
    const o = opening(st);
    openTo(st, o, 2.6);
    st.shoot(o, "opening", around(9, 1, 2, 50, 2.5));
    const c = dive(st, 400, "open");
    st.run(c, 1, still);
    st.shoot(c, "canopy", around(8, 2, 4, 48, 2.5));
    st.shoot(c, "canopy chase", "chase");
    // ...and under a lid of cloud, no moon or stars: the lines as dark as the cloth.
    await st.sky({ hour: 21, weather: "overcast" });
    const d = dive(st, 400, "open");
    st.run(d, 1, still);
    st.shoot(d, "overcast canopy", around(8, 2, 4, 48, 2.5));
    st.shoot(d, "overcast chase", "chase");
    await st.sky(null);
  },
};

/** The sheets and the views each is made of. */
export const GROUPS: Record<string, readonly string[]> = {
  gear: ["gear"],
  worn: ["worn"],
  exit: ["exit"],
  freefall: ["freefall"],
  deploy: ["deploy", "deploy-game"],
  canopy: ["canopy", "landing"],
  shape: ["shape"],
  cutaway: ["cutaway"],
  reserve: ["reserve"],
  snag: ["snag"],
  malfunction: ["malfunction"],
  lenses: ["lenses"],
  night: ["night"],
  stages: ["stages"],
  craft: ["craft"],
};
