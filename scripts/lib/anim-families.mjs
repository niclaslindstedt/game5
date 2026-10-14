// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMATION LAB'S FAMILIES (`make anim`): every animation of the
// player's rider, a family each, as SCENES the jolt lab's reader rides
// (`jolt-rider.mjs`: the real engine stepped, the real model posed off it
// as the renderer poses it):
//
//   skier   every move of the skier lab (`skier-moves.mjs`) and of the labs
//           beside it — the revert, the hop into switch, the double pole,
//           the climb, the loops, the air leaned forward — on the Chamois
//   board   every move of the board lab (`board-figure-moves.mjs`) and the
//           loops, on the Lynx
//   bike    the downhill bike down a real trail of a summer map, ridden by
//           the bot (`bike-pilot.ts`): pedalling off the head, the trail's
//           turns, its air, and off it walking the bike and back on
//   ride    the jolt lab's machines and seats (the lifts, the snowmobile, the
//           helicopter, the balloon, the skydive, the wingsuit, the ski
//           jump, the town, the afterski) — asked for by name
//
// A scene is the reader's (`{ id, title, seconds, game(), place?(),
// input(t, state), seat?(model, state, dt) }`), and this lab adds `window`
// ([from, to] s, the stretch its filmstrips are spread over) and `bike`
// (whether a bike stands beside him to be drawn).

import { MOVES } from "./skier-moves.mjs";
import { REVERT_MOVES } from "./revert-moves.mjs";
import { HOP_SWITCH_MOVES } from "./hop-switch-moves.mjs";
import { POLE_MOVES } from "./pole-moves.mjs";
import { CLIMB_MOVES } from "./climb-moves.mjs";
import { FLIP_MOVES } from "./flip-moves.mjs";
import { AIR_LEAN_MOVES } from "./air-lean-moves.mjs";
import { BOARD_MOVES } from "./board-figure-moves.mjs";

export const FAMILY_IDS = ["skier", "board", "bike", "ride"];
/** What `make anim` drives when no family is named: the rider's three. */
export const DEFAULT_FAMILIES = ["skier", "board", "bike"];

/** Every move a skier's scene is made of. */
export const SKI_MOVES = [
  ...MOVES,
  ...REVERT_MOVES,
  ...HOP_SWITCH_MOVES,
  ...POLE_MOVES,
  ...CLIMB_MOVES,
  ...FLIP_MOVES,
  ...AIR_LEAN_MOVES,
];

/** The families asked for, over the lab's modules `ctx`. */
export async function familiesOf(ctx, ids) {
  const all = {
    skier: () => ({
      id: "skier",
      say: "the player on skis (the Chamois) through every move of the skier labs",
      scenes: movesOf(ctx, SKI_MOVES, ctx.E.skisById("chamois")),
    }),
    board: () => ({
      id: "board",
      say: "the player on a snowboard (the Lynx) through every move of the board lab",
      scenes: movesOf(ctx, BOARD_MOVES, ctx.E.pairById("lynx")),
    }),
    bike: () => bikeFamily(ctx),
    ride: async () => {
      const { createRiderReader } = await import("./jolt-rider.mjs");
      const fam = await (await import("./jolt-ride.mjs")).rideFamily(ctx, createRiderReader(ctx));
      return { id: "ride", say: fam.say, scenes: fam.scenes };
    },
  };
  const out = [];
  for (const id of ids) out.push(await all[id]());
  return out;
}

/** The skier lab's moves as scenes, each handed the engine as its third
 * argument (the revert's and the hop's inputs read it). */
function movesOf(ctx, moves, spec) {
  const { E, S } = ctx;
  return moves.map((m) => ({
    id: m.id,
    title: m.title,
    seconds: m.seconds,
    window: m.window,
    game: () =>
      E.createGame({
        level: m.level(S),
        spec,
        rivals: 0,
        countdown: 0,
        quiet: true,
        mode: m.mode,
        snowDepth: m.snow,
        poles: m.poles !== false,
      }),
    place: m.place,
    input: (t, s) => m.input(t, s, E),
  }));
}

// ---- the bike ------------------------------------------------------------

/** The summer map the bike is ridden on, and its trail. */
const BIKE_SEED = 38;
const BIKE_TRAIL = "B1";

/** The bike's scenes: the bot down the trail from a moment `from` s into
 * it (ridden up to there before the scene is read), for `seconds`; or a
 * scripted stretch off it. */
const BIKE_SCENES = [
  {
    id: "start",
    title: "off the trail's head: pedalling up to speed, seated and stood",
    from: 0,
    seconds: 6,
  },
  {
    id: "air",
    title: "the trail's first features: a roller, a jump and its landing",
    from: 5.6,
    seconds: 4,
  },
  {
    id: "trail",
    title: "down the trail at speed: the turns, the bike laid over, the brakes",
    from: 10,
    seconds: 14,
  },
  {
    id: "berms",
    title: "further down: the attack stance through linked turns",
    from: 24,
    seconds: 14,
  },
  {
    id: "walk",
    title: "off it on the machine press, walking the bike by its bars, turning, and back on",
    from: 4,
    seconds: 8,
    script: (t, s, E, aim) => {
      const idle = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
      if (t === 0) return { ...idle, brake: 1, machine: true };
      if (t < 4.5) return { ...idle, tuck: 1, steer: t > 2.5 ? 0.6 : 0 };
      if (t < 5.4) return idle;
      if (t < 5.4 + 1 / 240) return { ...idle, machine: true };
      return E.bikePilot(s, aim);
    },
  },
];

function bikeFamily(ctx) {
  const { E, BIKE } = ctx;
  let level = null;
  const levelOf = () => (level ??= E.generateLevel(BIKE_SEED));
  const scenes = BIKE_SCENES.map((sc) => ({
    id: sc.id,
    title: sc.title,
    seconds: sc.seconds,
    window: [0.2, sc.seconds - 0.05],
    bike: true,
    game: () => {
      const state = E.createGame({
        level: levelOf(),
        mode: "free",
        summer: true,
        bike: true,
        bikeTrail: BIKE_TRAIL,
        quiet: true,
      });
      const aim = E.bikeAim(state, BIKE_TRAIL);
      const steps = Math.round(sc.from * E.TUNING.physicsHz);
      for (let i = 0; i < steps; i++) E.step(state, E.bikePilot(state, aim));
      sc.aim = aim;
      sc.hold = BIKE.createRiderHold();
      return state;
    },
    input: (t, s) => (sc.script ? sc.script(t, s, E, sc.aim) : E.bikePilot(s, sc.aim)),
    // The renderer's own seat (`machines.ts`): on the bike in the attack
    // stance, or walking it, his skis and poles put away all ride long.
    seat: (model, s) => {
      const b = s.bike;
      if (!b) return;
      model.setBiking?.(true);
      const style =
        ctx.bikeLook === "freeride" && b.onIt && !s.skier.thrown
          ? ctx.ANIM.animatedStyle(b, s.level, s.t)
          : undefined;
      const stood = BIKE.bikeStood(s, sc.hold, style);
      model.setStood?.(stood?.pose ?? null, stood?.way);
    },
  }));
  return {
    id: "bike",
    say: `the rider on the downhill bike, seed ${BIKE_SEED}'s trail ${BIKE_TRAIL}, ridden by the bot`,
    scenes,
  };
}

/**
 * THE BIKE AS A STICK beside him, in his body frame (`at`, the frame the
 * reader reads in): the frame's tubes, the fork, the bars, the cranks and
 * both wheels, off the engine's pose and the drawing's own geometry
 * (`bike-look.ts`) — so the hands can be read against the grips and the
 * feet against the pedals.
 */
export function bikeSticks(ctx, state, at) {
  const { E, LOOK, THREE } = ctx;
  const b = state.bike;
  if (!b) return null;
  const pose = E.bikePose(b);
  const qb = new THREE.Quaternion(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
  const qi = new THREE.Quaternion(at.q.x, at.q.y, at.q.z, at.q.w).invert();
  const v = new THREE.Vector3();
  const BB = E.BIKE_BB;
  /** A point from the bottom bracket, in the bike's frame, into his. */
  // Moved as the drawing moves it under a rider held through a jolt
  // (`rider-follow.ts`, `bike-view.ts`).
  const ridden = b.onIt && b.mode === "ridden" && !state.skier.thrown;
  const slack = ridden ? ctx.FOLLOW.riderSlack(pose, ctx.FOLLOW.drawnBikePose(b, state.t)) : null;
  const put = (p) => {
    v.set(
      BB.x + p.x + (slack?.x ?? 0),
      BB.y + p.y + (slack?.y ?? 0),
      BB.z + p.z + (slack?.z ?? 0),
    ).applyQuaternion(qb);
    v.x += pose.x - at.x;
    v.y += pose.y - at.y;
    v.z += pose.z - at.z;
    v.applyQuaternion(qi);
    return { x: v.x, y: v.y, z: v.z };
  };
  const front = LOOK.frontAxle(pose.steer, pose.fork);
  const rear = LOOK.rearAxle(pose.shock);
  const [gl, gr] = LOOK.gripsAt(pose.steer);
  const [pl, pr] = LOOK.pedalsAt(pose.crank);
  const O = { x: 0, y: 0, z: 0 };
  const lines = [
    [O, LOOK.HEAD_BOTTOM],
    [LOOK.HEAD_BOTTOM, LOOK.HEAD_TOP],
    [LOOK.HEAD_TOP, LOOK.SADDLE_TOP],
    [O, LOOK.SADDLE_TOP],
    [O, LOOK.BIKE_LOOK.pivot],
    [LOOK.BIKE_LOOK.pivot, rear],
    [LOOK.HEAD_BOTTOM, front],
    [gl, gr],
    [LOOK.HEAD_TOP, LOOK.BAR_MIDDLE],
    [pl, pr],
  ].map(([a, c]) => [put(a), put(c)]);
  // Each wheel a ring in the bike's own plane.
  const ring = (axle, r) => {
    const out = [];
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      out.push(put({ x: axle.x, y: axle.y + Math.sin(a) * r, z: axle.z + Math.cos(a) * r }));
    }
    return out;
  };
  return {
    lines,
    rings: [ring(front, ctx.E.BIKE.front.radius), ring(rear, ctx.E.BIKE.rear.radius)],
    grips: [put(gl), put(gr)],
    pedals: [put(pl), put(pr)],
  };
}
