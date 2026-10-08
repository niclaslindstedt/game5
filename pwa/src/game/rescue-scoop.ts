// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCOOP — how the injured skier gets from the snow onto the stretcher
// before the four lift him (`rescue-plan.ts` carries him on from there).
// Three-free, a pure function of the seconds since the rescue started.
//
// He lies on his back where he fell, a knee up and an arm out, as he was
// found. Four come up to him: two of them carrying the board between them
// at its right-hand rail, two walking free. The board-carriers kneel and
// lay it down on the snow alongside him; the other two kneel at his other
// side, facing him. The doctor straightens him (`sprawl` to 0). Then THE
// LOG-ROLL: the two at his side roll him toward them onto his side, as one
// piece; the board-carriers, turned on their knees to face the board, slide
// it across against his back and under him; he is rolled back down onto it
// and strapped, one strap at a time. All four stand, step to the board's
// four corners, kneel there with the inner hand on the rail, and the plan's
// lift takes over.
//
// Nobody kneels on the board or in its way: the two who roll him kneel
// beyond him on the far side from the board, and the two who slide it kneel
// beyond the board's outer rail. Every hand is on the casualty, on a rail or
// free. `tests/rescue_plan_test.ts` measures every joint against the board.

import { fromEuler, rotate, type Level } from "@engine";

import { FACE_HANDS, HOLD_HAND, KNEEL_HAND, RESCUE_STRIDE, railOf } from "./rescue-crew.ts";
import {
  BEARERS,
  RESCUE,
  S,
  clamp,
  ease,
  fwdOf,
  rightOf,
  wrap,
  type RescueFrame,
  type RescuePlan,
} from "./rescue-defs.ts";

const Q = RESCUE.scoop;
const PUSH_SPAN = FACE_HANDS.pushFar.z - FACE_HANDS.pushNear.z;

/** Where the board's rails rest over the snow lying on it, m. */
const ON_SNOW = 0.07;

type Pose = { x: number; y: number; z: number; heading: number; pitch: number; roll: number };

/** The board lying on the snow with its middle at (x, z), heading `h`: its
 * rails' middle and the attitude the snow under its corners gives it. */
function restOn(level: Level, x: number, z: number, h: number): Pose {
  const f = fwdOf(h);
  const rt = rightOf(h);
  const L = S.length / 2 - 0.05;
  const W = S.rail;
  const g = (a: number, l: number): number =>
    level.groundAt(x + f.x * a + rt.x * l, z + f.z * a + rt.z * l);
  const lf = g(L, -W);
  const rf = g(L, W);
  const lb = g(-L, -W);
  const rb = g(-L, W);
  return {
    x,
    z,
    y: Math.max((lf + rf + lb + rb) / 4, Math.max(lf, rf, lb, rb) - 0.05) + ON_SNOW,
    heading: h,
    pitch: Math.atan2((lf + rf - lb - rb) / 2, 2 * L),
    roll: Math.atan2((lf + lb - rf - rb) / 2, 2 * W),
  };
}

/** HIM ON THE BOARD: his middle over the board's, lying as it lies. */
export function casualtyOn(st: RescueFrame["stretcher"], out: RescueFrame["casualty"]): void {
  const q = fromEuler(st.heading, st.pitch, st.roll);
  const o = rotate(q, { x: 0, y: RESCUE.lies.up, z: RESCUE.lies.along });
  out.x = st.x + o.x;
  out.y = st.y + o.y;
  out.z = st.z + o.z;
  out.heading = st.heading;
  out.pitch = st.pitch;
  out.roll = st.roll;
  out.sprawl = 0;
  out.shown = st.shown;
}

/** HIM ON THE SNOW, his middle `lat` m to the board's right of its last
 * place, rolled `roll` rad onto his left side about his left shoulder's
 * edge as it lies on the snow. */
function onSnow(level: Level, plan: RescuePlan, lat: number, roll: number, out: Pose): void {
  const { f, rt } = axes(plan);
  const half = 0.25;
  const d = RESCUE.lies.depth;
  const at = (l: number) => ({
    x: plan.spot.x + rt.x * l + f.x * RESCUE.lies.along,
    z: plan.spot.z + rt.z * l + f.z * RESCUE.lies.along,
  });
  // The pivot: his left edge on the snow.
  const p = at(lat - half);
  const ground = restOn(level, at(lat).x, at(lat).z, axes(plan).h);
  const dl = half * Math.cos(roll) - d * Math.sin(roll);
  const du = half * Math.sin(roll) + d * Math.cos(roll);
  out.x = p.x + rt.x * dl;
  out.z = p.z + rt.z * dl;
  out.y = level.groundAt(p.x, p.z) + du;
  out.heading = axes(plan).h;
  out.pitch = ground.pitch;
  out.roll = ground.roll - roll;
}

/** The board's last place and its axes: the way the carry sets off. */
function axes(plan: RescuePlan) {
  const [a, b] = plan.path.pts;
  const h = Math.atan2(b.x - a.x, b.z - a.z);
  return { h, f: fwdOf(h), rt: rightOf(h) };
}

/** A place `lat` m to the right of the board's last middle and `along` m
 * ahead of it. */
function place(plan: RescuePlan, lat: number, along: number) {
  const { f, rt } = axes(plan);
  return {
    x: plan.spot.x + rt.x * lat + f.x * along,
    z: plan.spot.z + rt.z * lat + f.z * along,
  };
}

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const turnTo = (a: number, b: number, u: number): number => a + wrap(b - a) * u;

/** Where a bearer's hand is off him at a rise (knelt 0 … stood 1). */
function handOff(rise: number) {
  const r = ease(rise);
  return { x: lerp(KNEEL_HAND.x, HOLD_HAND.x, r), z: lerp(KNEEL_HAND.z, HOLD_HAND.z, r) };
}

/** THE SCOOP at `t` (before the lift), written into `out`. */
export function scoopAt(level: Level, plan: RescuePlan, t: number, out: RescueFrame): RescueFrame {
  const A = plan.at.scoop;
  const T = Q.time;
  const { h } = axes(plan);
  const walkFor = Q.approach / Q.pace;
  const walked = clamp(t, 0, walkFor) * Q.pace;
  const walking = t > 0 && t < walkFor ? 1 : 0;
  const u = (from: number, span: number): number => clamp((t - from) / span, 0, 1);
  const beside = RESCUE.scoop.lies + Q.beside;
  // THE BOARD's lateral place: beside him, then slid under him.
  // Slid a little past its last place, against his back, then drawn back
  // under him with him as he is laid down on it.
  const slid = ease(u(A.slide, T.slide));
  const boardLat = lerp(lerp(beside, Q.under, slid), 0, ease(u(A.back, T.back)));
  const boardAt = place(plan, boardLat, 0);
  const rest = restOn(level, boardAt.x, boardAt.z, h);
  const lowered = ease(u(A.down, T.down));
  // The board-carriers' hands while they hold it (walking up, laying it down).
  const carryRise = 1 - lowered;
  const hand = handOff(carryRise);
  const railYs: number[] = [];
  for (let j = 0; j < BEARERS.length; j++) {
    const b = BEARERS[j];
    const c = out.crew[j];
    c.shown = true;
    const k = b.along > 0 ? 0 : 1;
    // The corner he finally kneels at, hand on the rail.
    const cornerLat = b.across * (S.rail + KNEEL_HAND.x);
    const cornerAlong = b.along * S.along - KNEEL_HAND.z;
    const stoodUp = ease(u(A.stand, T.stand));
    const stepped = ease(u(A.step, T.step));
    const knelt = ease(u(A.kneel, T.kneel));
    let lat: number;
    let along: number;
    let heading: number;
    const move = c.move;
    move.raise = 0;
    move.reach = 0;
    if (b.across < 0) {
      // THE TWO WHO ROLL HIM: walk up free, kneel at his far side facing
      // him, straighten him, roll him, lay him back, strap him.
      const sLat = RESCUE.scoop.lies - Q.tend.out;
      const sAlong = Q.tend.along[k];
      const down = ease(u(walkFor, T.down));
      lat = sLat;
      along = sAlong - Q.approach + walked;
      heading = turnTo(h, h + Math.PI / 2, down);
      const rolled = ease(u(A.roll, T.roll)) - ease(u(A.back, T.back));
      const strapping = u(A.strap, T.strap) > 0 ? 0.3 : 0;
      Object.assign(move, {
        rise: 1,
        stride: (walked + stepped * 0.6) / RESCUE_STRIDE + k * 0.5,
        walking,
        hand: null,
        face: down * (1 - stoodUp),
        work: "tend",
        reach: Math.max(rolled, strapping * u(A.strap, 0.3)),
      });
    } else {
      // THE TWO WITH THE BOARD: carry it up at its right-hand rail, kneel and
      // lay it down, turn on their knees to face it, slide it under him.
      const turned = ease(u(A.turn, T.turn));
      const holdLat = beside + b.across * (S.rail + hand.x);
      const holdAlong = b.along * S.along - hand.z - Q.approach + walked;
      // Shuffled forward on their knees as they push it away from them.
      const pLat = beside + S.rail + FACE_HANDS.pushNear.z - Q.shuffle * slid;
      const pAlong = Q.push.along[k];
      lat = lerp(holdLat, pLat, turned);
      along = lerp(holdAlong, pAlong, turned);
      heading = turnTo(h, h - Math.PI / 2, turned);
      // The hands follow the rail as it slides away from them.
      const reach = clamp((pLat - (boardLat + S.rail) - FACE_HANDS.pushNear.z) / PUSH_SPAN, 0, 1);
      Object.assign(move, {
        rise: carryRise,
        stride: (walked + stepped * 0.6) / RESCUE_STRIDE + k * 0.5,
        walking: walking,
        hand: stoodUp > 0 ? null : b.hand,
        face: turned * (1 - stoodUp),
        work: "push",
        reach,
      });
      if (t < A.turn) {
        const at = place(plan, lat, along);
        railYs.push(level.groundAt(at.x, at.z) + railOf(b.body, carryRise, 0));
      }
    }
    // ALL FOUR to the corners: stood, stepped there, knelt with the inner
    // hand down on the rail.
    if (t >= A.stand) {
      lat = lerp(lat, cornerLat, stepped);
      along = lerp(along, cornerAlong, stepped);
      heading = turnTo(heading, h, stepped);
      move.walking = t >= A.step && t < A.kneel ? 1 : 0;
      if (t >= A.kneel) {
        Object.assign(move, { hand: b.hand, rise: 1 - knelt, face: 0, walking: 0 });
      }
    }
    const at = place(plan, lat, along);
    c.x = at.x;
    c.z = at.z;
    c.y = level.groundAt(at.x, at.z);
    c.heading = heading;
  }
  // THE BOARD: held up at its rail by the two bringing it, then on the snow.
  const st = out.stretcher;
  if (t < A.turn && railYs.length === 2) {
    const carried = place(plan, beside, -Q.approach + walked);
    const mean = (railYs[0] + railYs[1]) / 2;
    const y = lerp(mean, restOn(level, carried.x, carried.z, h).y, lowered);
    Object.assign(st, {
      x: carried.x,
      z: carried.z,
      y,
      heading: h,
      pitch: lerp(Math.atan2(railYs[0] - railYs[1], 2 * S.along), rest.pitch, lowered),
      roll: lerp(0, rest.roll, lowered),
    });
  } else Object.assign(st, rest);
  st.shown = true;
  st.straps = Math.min(Q.straps, Math.floor(u(A.strap, T.strap) * Q.straps + 0.34));
  // HIM: as found, straightened, rolled onto his side, laid back on it.
  const cas = out.casualty;
  const sprawl = 1 - ease(u(A.assess, T.assess));
  const back = ease(u(A.back, T.back));
  const rollBy = Q.roll * (ease(u(A.roll, T.roll)) - back);
  const snow: Pose = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 };
  onSnow(level, plan, RESCUE.scoop.lies * (1 - back), Math.max(0, rollBy), snow);
  if (back > 0) {
    const on: RescueFrame["casualty"] = { ...cas };
    casualtyOn(st, on);
    for (const k of ["x", "y", "z", "pitch", "roll"] as const) snow[k] = lerp(snow[k], on[k], back);
  }
  Object.assign(cas, snow, { sprawl, shown: true });
  return out;
}
