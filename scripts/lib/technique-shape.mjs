// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TECHNIQUE LAB'S TURN SHAPES (`scripts/technique-preview.mjs`'s
// `turns` sheet and its `shape …` rows): how SHARP each technique turns
// when it turns its own natural turn — the slalom's 5 m arcs against the
// downhill's 50 m sweeps — measured on ONE COMMON COURSE with no gates and
// no bot, so what differs is the technique (and its pair) alone.
//
// THE COURSE is the ride lab's reference pitch (`schussStrip`: a packed
// 20° slope four kilometres long and as wide, `tests/support/synthetic.ts`'s
// `flatLevel`) — a slalom hill's grade (33–45 %, R31) and steep enough for
// every discipline's turn speed to hold, open everywhere, so nothing but the
// skier decides the line. A real piste is narrower than a downhill's swing
// and has its own bends and rollers in it.
//
// THE DRIVE is a scripted rhythm, the ride lab's `slalom-rhythm` restated
// per technique (`SHAPE_DRIVE`): the edge full to one side, cut hard, then
// full to the other, switched every turn time — the first switch half a
// turn in, so the swing is centred on the fall line — and back toward the
// fall line whenever he has come more than `GUARD` off it; the tuck held to
// the start speed (`hold`'s tuck, never the brake, which would skid him).

import { PITCH, hold, schussStrip, slideOf, turnsOf } from "./ride-helpers.mjs";

/** EACH TECHNIQUE'S NATURAL TURN: its turn time, s, and the speed it is
 * skied at, km/h — the turn times off docs/disciplines.md's "For a
 * technique row" (~0.9 / 1.45 / 2.1 / 2.5 s), the speeds its turn speeds
 * (the slalom ~40 km/h on the mean; the giant slalom 18 ± 2 m/s through the
 * turn; the super-G 24.2 ± 2.6 m/s at turn entry; the downhill 26 ± 4 m/s
 * through the turn). The free skier has no discipline: a recreational
 * carved turn of 1.3 s at 35 km/h *(est.)* — what the free row skis the
 * slalom course at (`make technique`'s table). */
export const SHAPE_DRIVE = {
  free: { turn: 1.3, kmh: 35 },
  slalom: { turn: 0.9, kmh: 40 },
  giantSlalom: { turn: 1.45, kmh: 65 },
  superG: { turn: 2.1, kmh: 87 },
  downhill: { turn: 2.5, kmh: 94 },
};

/** How far off the fall line the drive lets him come before it turns him
 * back, rad (the ride lab's `slalom-rhythm`). */
const GUARD = 0.9;
/** How many of the longest technique's turns every run lasts, after the
 * `SETTLE` s it takes the rhythm to settle — the same time for every row. */
const TURNS = 6;
const SETTLE = 2;
/** The window the line's curvature is read over, s either side. */
const BEND = 0.1;

/** How long every turn-shape run lasts, s. */
export function shapeSeconds(ids) {
  return SETTLE + TURNS * Math.max(...ids.map((id) => SHAPE_DRIVE[id].turn));
}

/** Ski one technique's natural turn down the common slope for `seconds`,
 * recording every step: the place, the velocity, the edge, the yaw. */
export function skiShape(E, S, row, seconds) {
  const drive = SHAPE_DRIVE[row.technique];
  const state = E.createGame({
    level: schussStrip(S),
    technique: row.technique,
    spec: E.SKI_CATALOG.find((s) => s.id === row.skis),
    rivals: 0,
    countdown: 0,
    quiet: true,
  });
  E.placeRun(state, { x: 2000, z: 400, heading: 0, speed: drive.kmh / 3.6 });
  const c = state.skier;
  const t0 = state.t;
  const frames = [];
  for (let i = 0; i < seconds / E.TUNING.dt; i++) {
    const t = state.t - t0;
    const side = Math.floor(t / drive.turn + 0.5) % 2 === 0 ? 1 : -1;
    const steer = Math.abs(c.heading) > GUARD ? -Math.sign(c.heading) : side;
    E.step(state, {
      steer,
      tuck: hold(state, drive.kmh).tuck,
      brake: 0,
      lean: 0,
      reset: false,
      carve: true,
    });
    frames.push({
      t: state.t - t0,
      x: c.x,
      z: c.z,
      vx: c.vx,
      vz: c.vz,
      edge: c.edge,
      incline: c.incline,
      balance: c.balance,
      airborne: c.airborne,
      wy: c.wy,
      speed: c.speed,
      slide: slideOf(c),
      thrown: c.thrown !== null,
    });
  }
  return frames;
}

/** THE LINE'S RADIUS at every frame, m: the way he goes (his velocity's
 * heading, not the skis') turned over `BEND` s either side, against the
 * ground covered — the path's own curvature, so a skid that slews the skis
 * round without turning the line reads as the straight line it is. */
function lineRadii(frames) {
  const k = Math.max(1, Math.round(BEND / (frames[1].t - frames[0].t)));
  return frames.map((f, i) => {
    const a = frames[Math.max(0, i - k)];
    const b = frames[Math.min(frames.length - 1, i + k)];
    let turn = Math.atan2(b.vx, b.vz) - Math.atan2(a.vx, a.vz);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const ground = Math.hypot(f.vx, f.vz) * (b.t - a.t);
    return Math.abs(turn) > 1e-6 ? Math.min(9999, ground / Math.abs(turn)) : 9999;
  });
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** A TURN-SHAPE RUN read: the line (every few frames, with its radius),
 * each turn after the rhythm has settled — its apex (the line's tightest
 * point in it), the radius there, the turn's time, its peak edge, the speed
 * at the apex and which way the line bent there — and the medians the table
 * prints. */
export function shapeOf(frames) {
  const radii = lineRadii(frames);
  const line = [];
  for (let i = 0; i < frames.length; i += 3) line.push([frames[i].x, frames[i].z, radii[i]]);
  const turns = turnsOf(frames)
    .filter((t) => t.t0 >= SETTLE)
    .map((t) => {
      let apex = t.from;
      for (let i = t.from; i < t.to; i++) if (radii[i] < radii[apex]) apex = i;
      const f = frames[apex];
      const way = Math.hypot(f.vx, f.vz) || 1;
      // Which way the line bends there: +1 the way he goes turning from
      // +z toward +x (its centre along (dz, −dx) of him), −1 the other.
      const a = frames[Math.max(0, apex - 6)];
      const b = frames[Math.min(frames.length - 1, apex + 6)];
      const turn = Math.atan2(b.vx, b.vz) - Math.atan2(a.vx, a.vz);
      return {
        x: f.x,
        z: f.z,
        // The way he goes at the apex, and the side the turn's centre is.
        dx: f.vx / way,
        dz: f.vz / way,
        bend: Math.sin(turn) >= 0 ? 1 : -1,
        radius: radii[apex],
        time: t.t1 - t.t0,
        edge: (t.peak * 180) / Math.PI,
        // How far he is laid over there, and the lean the turn he is making
        // balances (`SkierState.incline`, `.balance`), °.
        incline: (Math.abs(f.incline) * 180) / Math.PI,
        balance: (Math.abs(f.balance) * 180) / Math.PI,
        kmh: f.speed * 3.6,
      };
    });
  const after = frames.filter((f) => f.t >= SETTLE);
  return {
    line,
    turns,
    thrown: frames.some((f) => f.thrown),
    stats: {
      shapeRadius: median(turns.map((t) => t.radius)),
      shapeTurn: median(turns.map((t) => t.time)),
      shapeEdge: median(turns.map((t) => t.edge)),
      shapeIncline: median(turns.map((t) => t.incline)),
      shapeBalance: median(turns.map((t) => t.balance)),
      shapeSpeed: (after.reduce((s, f) => s + f.speed, 0) / Math.max(1, after.length)) * 3.6,
    },
  };
}

/** What the sheet says about the slope it was skied on. */
export const SHAPE_COURSE = `the open 20° groomed slope (${(PITCH * 100).toFixed(0)} %), no gates, a scripted rhythm`;
