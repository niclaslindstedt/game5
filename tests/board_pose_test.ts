// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER'S POSE (`board-pose.ts`, read off the engine by
// `board-input.ts`) — three-free, ridden by the real engine on the synthetic
// strips: his feet stand in the bindings, every joint is a number, he rides
// across the board with his hips and shoulders near square to it, his eyes
// go along his travel, a toeside and a heelside carve are different bodies
// (forward over the toes, sat back over the heels), the low carve's inside
// hand reaches the snow, the tuck and the air fold the knees, the one-foot
// skate takes the rear foot out, and a thrown rider keeps the board on.

import { describe, expect, it } from "vitest";
import {
  createGame,
  isBoard,
  pairById,
  placeRun,
  step,
  TUNING,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import { flatLevel } from "./support/synthetic.ts";
import { boardInputOf } from "../pwa/src/game/board-input.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { boardUnderFeet } from "../pwa/src/game/board-thrown.ts";
import {
  boardPose,
  headForward,
  kneeFlex,
  snowPlane,
  toeShare,
  type BoardPose,
  type BoardPoseInput,
} from "../pwa/src/game/board-pose.ts";
import {
  createSkierSpring,
  stepSkierSpring,
  type SkierPose,
  type V3,
} from "../pwa/src/game/skier-pose.ts";

const spec = pairById("lynx");
const IDLE: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
const PITCH = Math.tan(Math.PI / 9);

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
const unit = (a: V3): V3 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const deg = (r: number): number => (r * 180) / Math.PI;
/** The angle between two lines either way along, flattened onto a plane. */
function lineAngle(a: V3, b: V3, n: V3): number {
  const flat = (v: V3): V3 =>
    unit(sub(v, { x: n.x * dot(v, n), y: n.y * dot(v, n), z: n.z * dot(v, n) }));
  return deg(Math.acos(Math.min(1, Math.abs(dot(flat(a), flat(b))))));
}

type Ride = {
  grade?: number;
  packed?: number;
  heading?: number;
  speed?: number;
  seconds: number;
  input: (t: number) => SkierInput;
};
type Rode = { state: GameState; input: BoardPoseInput; bp: BoardPose };

/** Ride a short run down a synthetic strip and take the pose the game
 * would draw at its end. */
function ride(r: Ride): Rode {
  const level = flatLevel({
    packed: r.packed ?? 1,
    grade: r.grade ?? 0,
    slopeFrom: 200,
    size: 4000,
  });
  const state = createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 2000, z: 600, heading: r.heading ?? 0, speed: r.speed ?? 0 });
  const t0 = state.t;
  const legs = createSkierSpring(0);
  const dt = 1 / TUNING.physicsHz;
  while (state.t - t0 < r.seconds) {
    step(state, r.input(state.t - t0));
    const c = state.skier;
    if (c.thrown) continue;
    stepSkierSpring(
      legs,
      c.vy,
      c.airborne,
      dt,
      c.jumpLoad / TUNING.jump.full,
      c,
      false,
      undefined,
      0,
    );
  }
  const { input } = boardInputOf(state.skier, legs, state.skier.q);
  return { state, input, bp: boardPose(input) };
}

const PISTE = { grade: PITCH, speed: 50 / 3.6 };
const ridden = {
  straight: () => ride({ ...PISTE, speed: 40 / 3.6, seconds: 1, input: () => IDLE }),
  toe: () => ride({ ...PISTE, seconds: 1, input: (t) => ({ ...IDLE, steer: t >= 0.2 ? 1 : 0 }) }),
  heel: () => ride({ ...PISTE, seconds: 1, input: (t) => ({ ...IDLE, steer: t >= 0.2 ? -1 : 0 }) }),
  toeCut: () =>
    ride({
      ...PISTE,
      seconds: 2.1,
      input: (t) => ({ ...IDLE, steer: t >= 0.2 ? 1 : 0, carve: t >= 1.2 }),
    }),
  heelCut: () =>
    ride({
      ...PISTE,
      seconds: 2.1,
      input: (t) => ({ ...IDLE, steer: t >= 0.2 ? -1 : 0, carve: t >= 1.2 }),
    }),
  tuck: () =>
    ride({ ...PISTE, speed: 40 / 3.6, seconds: 1.3, input: () => ({ ...IDLE, tuck: 1 }) }),
  skate: () => ride({ seconds: 2, input: () => ({ ...IDLE, tuck: 1 }) }),
  wait: () => ride({ seconds: 3, input: () => IDLE }),
};
const cache = new Map<string, Rode>();
function at(id: keyof typeof ridden): Rode {
  let r = cache.get(id);
  if (!r) cache.set(id, (r = ridden[id]()));
  return r;
}

function joints(p: SkierPose): V3[] {
  return [
    p.hips,
    p.waist,
    p.neck,
    p.head,
    ...p.hipJoints,
    ...p.knees,
    ...p.feet,
    ...p.shoulders,
    ...p.elbows,
    ...p.hands,
  ];
}

describe("the snowboarder's pose", () => {
  it("rides the board the engine rides", () => {
    expect(isBoard(spec)).toBe(true);
  });

  it("every joint of every move is a finite point near the board", () => {
    for (const id of Object.keys(ridden) as (keyof typeof ridden)[]) {
      const { bp } = at(id);
      for (const j of joints(bp.pose)) {
        expect(Number.isFinite(j.x) && Number.isFinite(j.y) && Number.isFinite(j.z), id).toBe(true);
        expect(len(sub(j, bp.board.centre)), id).toBeLessThan(2.2);
      }
    }
  });

  it("stands both feet in the bindings while riding, the rear one out in the skate", () => {
    for (const id of ["straight", "toe", "heel", "tuck"] as const) {
      const { bp } = at(id);
      expect(bp.free, id).toBeNull();
      // Each ankle stands over the deck's top in its boot.
      for (const f of bp.pose.feet) {
        const over = dot(sub(f, bp.board.centre), bp.board.normal);
        expect(over, id).toBeGreaterThan(0.05);
        expect(over, id).toBeLessThan(0.4);
      }
      // ...the stance's width apart along the board.
      const apart = Math.abs(dot(sub(bp.pose.feet[1], bp.pose.feet[0]), bp.board.along));
      expect(apart, id).toBeGreaterThan(0.8 * at(id).input.board.stance);
      expect(apart, id).toBeLessThan(1.2 * at(id).input.board.stance);
    }
    expect(at("skate").bp.free).not.toBeNull();
  });

  it("rides across the board, the hips and shoulders near square to it", () => {
    for (const id of ["straight", "toe", "heel", "tuck", "wait"] as const) {
      const { pose: p, board: f } = at(id).bp;
      expect(lineAngle(sub(p.hipJoints[1], p.hipJoints[0]), f.along, f.normal), id).toBeLessThan(
        25,
      );
      expect(lineAngle(sub(p.shoulders[1], p.shoulders[0]), f.along, f.normal), id).toBeLessThan(
        45,
      );
    }
  });

  it("looks along his travel once he is moving", () => {
    for (const id of ["straight", "toe", "heel", "tuck"] as const) {
      const { input, bp } = at(id);
      const up = unit(input.worldUp);
      const flat = (v: V3): V3 =>
        sub(v, { x: up.x * dot(v, up), y: up.y * dot(v, up), z: up.z * dot(v, up) });
      const look = unit(flat(headForward(bp.pose)));
      const way = unit(flat(input.travel));
      expect(deg(Math.acos(Math.max(-1, Math.min(1, dot(look, way))))), id).toBeLessThan(50);
    }
  });

  it("carves a toeside turn low over his toes and a heelside one sat behind his heels", () => {
    const toe = at("toe");
    const heel = at("heel");
    expect(toeShare(toe.input.edge, toe.input.board.lead)).toBeGreaterThan(0.3);
    expect(toeShare(heel.input.edge, heel.input.board.lead)).toBeLessThan(-0.3);
    const face = (r: Rode): number => (r.input.board.lead === "regular" ? 1 : -1);
    // The hips across the board as seen from above the snow.
    const across = (r: Rode): number => {
      const n = snowPlane(r.input, r.bp.board).normal;
      const k = dot(r.bp.board.right, n);
      const right = unit(sub(r.bp.board.right, { x: n.x * k, y: n.y * k, z: n.z * k }));
      return dot(sub(r.bp.pose.hips, r.bp.board.centre), right) * face(r);
    };
    expect(across(toe)).toBeGreaterThan(0.1);
    expect(across(heel)).toBeLessThan(-0.1);
    // On the toe edge BOTH knees bend deep down it — the rear one never
    // left straight behind — and deeper cut hard.
    for (const id of ["toe", "toeCut"] as const) {
      const k = [0, 1].map((i) => deg(kneeFlex(at(id).bp.pose, i as 0 | 1)));
      expect(Math.min(...k), id).toBeGreaterThan(65);
      expect(Math.abs(k[0] - k[1]), id).toBeLessThan(20);
    }
    expect(kneeFlex(at("toeCut").bp.pose, 0)).toBeGreaterThan(kneeFlex(toe.bp.pose, 0));
    // On the heels he sits lower over the snow than on his toes.
    const hipsOver = (r: Rode): number => {
      const plane = snowPlane(r.input, r.bp.board);
      return dot(sub(r.bp.pose.hips, plane.point), plane.normal);
    };
    expect(hipsOver(heel)).toBeLessThan(hipsOver(toe));
    // No shin leans further off the deck than a soft boot lets it: a shin
    // laid toward the deck is a rider kneeling on his board.
    for (const id of ["toe", "toeCut", "heel", "heelCut", "tuck"] as const) {
      const { bp } = at(id);
      for (const i of [0, 1]) {
        const shin = unit(sub(bp.pose.knees[i], bp.pose.feet[i]));
        expect(deg(Math.asin(dot(shin, bp.board.normal))), id).toBeGreaterThan(40);
      }
    }
  });

  it("carves compact: low on bent legs, folded over his toes cut hard, a hand at the snow", () => {
    for (const id of ["toe", "heel", "toeCut", "heelCut"] as const) {
      const { input, bp } = at(id);
      expect(Math.abs(input.incline), id).toBeGreaterThan(0.6);
      const p = bp.pose;
      // The spine within ~30° of the line he is rolled onto (the body
      // frame's up) — but cut hard on his toes he folds down over his
      // knees toward the snow.
      const spine = deg(Math.acos(unit(sub(p.neck, p.hips)).y));
      if (id === "toeCut") {
        expect(spine, id).toBeGreaterThan(25);
        expect(spine, id).toBeLessThan(60);
      } else expect(spine, id).toBeLessThan(30);
      // The hips low, yet up off the deck: no sitting on the snow.
      const hipsUp = dot(sub(p.hips, bp.board.centre), bp.board.normal);
      expect(hipsUp, id).toBeGreaterThan(0.3);
      expect(hipsUp, id).toBeLessThan(0.85);
      const plane = snowPlane(input, bp.board);
      const over = (q: V3): number => dot(sub(q, plane.point), plane.normal);
      const down = p.hands.filter((h) => over(h) < 0.08).length;
      // Never both hands on the snow; neither but in a turn cut hard.
      expect(down, id).toBeLessThanOrEqual(id === "toe" || id === "heel" ? 0 : 1);
      for (const h of p.hands) expect(over(h), id).toBeGreaterThan(0);
    }
    // Cut hard, the lower hand comes to the snow.
    for (const id of ["toeCut", "heelCut"] as const) {
      const cut = at(id);
      const plane = snowPlane(cut.input, cut.bp.board);
      const lowest = Math.min(
        ...cut.bp.pose.hands.map((h) => dot(sub(h, plane.point), plane.normal)),
      );
      expect(lowest, id).toBeLessThan(id === "toeCut" ? 0.15 : 0.25);
    }
  });

  it("folds the knees into the tuck, and stands taller waiting than riding", () => {
    const k = (id: keyof typeof ridden): number => deg(kneeFlex(at(id).bp.pose, 0));
    expect(k("tuck")).toBeGreaterThan(k("straight") + 25);
    expect(k("wait")).toBeLessThan(k("straight"));
    for (const id of ["straight", "toe"] as const) {
      expect(k(id), id).toBeGreaterThan(30);
      expect(k(id), id).toBeLessThan(95);
    }
  });

  it("keeps the board on a thrown rider's feet", () => {
    const { bp } = at("straight");
    const thrown: SkierPose = structuredClone(bp.pose);
    // Throw the feet anywhere: the deck comes back under them.
    thrown.feet = [
      { x: 0.4, y: 0.3, z: -0.5 },
      { x: 0.5, y: 0.2, z: 0.1 },
    ];
    const deck = boardUnderFeet(thrown, at("straight").input.board);
    const apart = len(sub(thrown.feet[1], thrown.feet[0]));
    expect(Math.abs(apart - at("straight").input.board.stance)).toBeLessThan(0.12);
    for (const f of thrown.feet) expect(len(sub(f, deck.centre))).toBeLessThan(0.5);
  });

  it("says a board's fall is a wipeout, never a yard sale", () => {
    const { state } = at("straight");
    const line = newsFor({ kind: "wipeout", cause: "tree" } as GameEvent, state);
    expect(line?.text).not.toContain("YARD SALE");
    expect(line?.text).toContain(STRINGS.newsBoardDown);
  });
});
