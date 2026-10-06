// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE MOVE SKIED AND POSED, frame by frame — the loop the gait labs
// (`make poleless`, `make skate-turns`) read their numbers off. A move of
// `skier-moves.mjs` is skied by the real engine at 120 Hz, and every other
// step the game's own pose is taken the way the game takes it: the body's
// spring stepped at 60 Hz (`stepSkierSpring`), the pair laid on the snow
// (`standOf`), the pose input read off the skier (`poseInputOf`) and solved
// (`skierPose`). `make skier-metrics` keeps a loop of its own because it
// measures far more than a gait lab needs; this one hands back the pose,
// the skier and his joints in the world, nothing judged.
//
// The caller passes the modules (`E` the engine, `S` the synthetic maps,
// `P` the pose, `G` the skis' body, `ST` the stand, `FL` the fall) — loaded
// once behind `aliasEngine` — so a lab imports the game exactly once.

/** The vector `v` turned by the quaternion `q`. */
export function rot(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** A pose's joints carried into the world off the skier's place and turn. */
export function inWorld(pose, c) {
  const at = (v) => {
    const r = rot(c.q, v);
    return { x: c.x + r.x, y: c.y + r.y, z: c.z + r.z };
  };
  const out = { hips: at(pose.hips), neck: at(pose.neck), head: at(pose.head) };
  for (const k of ["knees", "feet", "shoulders", "elbows", "hands"]) out[k] = pose[k].map(at);
  return out;
}

/** Skis `move` on `spec` (with its `poles` unless `poles` says otherwise)
 * and returns every posed frame inside its window: `{ t, c, input, pose,
 * world }` — `c` a copy of the skier, `pose` in his body frame, `world`
 * its joints in the world. `all` keeps the frames outside the window too. */
export function traceMove(mods, move, spec, opts = {}) {
  const { E, S, P, G, ST, FL } = mods;
  const state = E.createGame({
    level: move.level(S),
    spec,
    rivals: 0,
    countdown: 0,
    quiet: true,
    mode: move.mode,
    snowDepth: move.snow,
    poles: opts.poles ?? move.poles !== false,
  });
  E.placeRun(state, move.place());
  const t0 = state.t;
  const mounts = G.mountsOf(spec);
  const steps = Math.round(move.seconds * E.TUNING.physicsHz);
  const legs = P.createSkierSpring();
  const frames = [];
  let lastT = null;
  for (let i = 0; i < steps; i++) {
    E.step(state, move.input(state.t - t0, state));
    if (i % 2 === 0) continue;
    const c = state.skier;
    const now = state.t - t0;
    const gravity = E.flightGravity(state.rules);
    P.stepSkierSpring(
      legs,
      c.vy,
      c.airborne,
      lastT === null ? 0 : now - lastT,
      c.jumpLoad / E.TUNING.jump.full,
      c,
      P.inStartGate(state),
      {
        read: c.airborne ? FL.flightRead(state.level, c, c.spec.cogHeight, gravity) : null,
        gravity,
      },
      G.legsLift(c),
    );
    lastT = now;
    if (c.thrown) continue;
    if (!opts.all && (now < move.window[0] || now > move.window[1])) continue;
    const stand = ST.standOf(
      c,
      G.groundOf(c, legs),
      undefined,
      undefined,
      P.drawnSkiAngle(legs, c),
    );
    const input = G.poseInputOf(
      c,
      legs,
      mounts,
      state.tricks?.pose ?? null,
      P.inStartGate(state),
      stand,
    );
    const pose = P.skierPose(input);
    const copy = { ...c, q: { ...c.q } };
    frames.push({ t: now, c: copy, input, pose, world: inWorld(pose, copy) });
  }
  return frames;
}
