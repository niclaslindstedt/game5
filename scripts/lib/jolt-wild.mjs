// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JOLT LAB'S WILD THINGS (`make jolt ARGS=--family=wild`): the grimbear,
// the birds and the animals as THE GAME DRAWS THEM.
//
// The GRIMBEAR is staged as `tests/grimbear_test.ts` stages him — the SLOPE
// with one trunk beside its line, the skier glided down it by hand, the
// beast's run rigged to land or to miss off his own stream — and drawn by
// his real view (`grimbear-view.ts`): its named pivots read back in the
// world after every drawn frame, so the pose (`grimbear-pose.ts`) and the
// hand-offs between his phases are both in it.
//
// The BIRDS and the ANIMALS are pure functions of the clock (`birdPose`,
// `beastPose`), put up or run off by a skier walked at them by hand
// (`flushAt`, `spookAt` — the one memory each keeps). Their limbs move in
// the vertex shader, so their joints are the shader's own sums run on the
// processor (`bird-shapes.ts`' `wingPoint`, `beast-shapes.ts`' `gaitPoint`)
// on points read off the built figure (a wingtip, a wrist; each leg's hoof
// and hip, the nose), carried through the instance's matrix as `birds.ts`
// and `beasts.ts` compose it. The map's wildlife is dealt off its seed, so a
// species the shared mountain was not dealt is looked for on the same
// ground dealt again under another seed. In the WORLD frame.

import { join } from "node:path";

import { freeLevel, stepsPerFrame } from "./jolt-posed.mjs";

/** How far ahead of a resting flock or a calm group the skier starts, m,
 * and how fast he comes at it, m/s. */
const COME_FROM = 90;
const COME_AT = 9;
/** How many seeds the wildlife is dealt again under to find a species. */
const RESEEDS = 60;

export async function wildFamily(ctx) {
  const { E, S, THREE } = ctx;
  const R = (m) => import(join(ctx.root, `pwa/src/game/${m}.ts`));
  const [
    gview,
    { createHazeUniforms },
    birdPlan,
    birdRoost,
    birdDefs,
    birdShapes,
    beastPlan,
    beastDefs,
    beastShapes,
    traits,
    wild,
  ] = await Promise.all([
    R("grimbear-view"),
    R("haze"),
    R("bird-plan"),
    R("bird-roost"),
    R("bird-defs"),
    R("bird-shapes"),
    R("beast-plan"),
    R("beast-defs"),
    R("beast-shapes"),
    R("wild-traits"),
    R("wild-ground"),
  ]);
  const level = freeLevel(ctx);
  const frame = 1 / ctx.hz;
  const scenes = [];

  // --- the grimbear ---------------------------------------------------------
  const TREE = { x: S.SLOPE.x + 9, z: 700 };
  const woods = () => {
    const l = S.syntheticLevel({ noTrees: true });
    l.trees = [
      { x: TREE.x, z: TREE.z, y: l.groundAt(TREE.x, TREE.z), height: 12, radius: 0.35, crown: 3 },
    ];
    return l;
  };
  /** A ride with him in it (`ask` a hunt or a roam), his run rigged to
   * land or to miss, the wait over. */
  const ride = (ask, lands) => {
    const state = E.createGame({
      level: woods(),
      mode: "free",
      quiet: true,
      grimbear: ask,
      crowd: 0,
    });
    if (lands !== undefined) state.grimbear.rng.chance = () => !lands;
    state.grimbear.wait = 0;
    return state;
  };
  /** His joints as drawn: every named pivot of his view, in the world. */
  const bearJoints = (view, state) => {
    view.update(state);
    if (!view.group.visible) return null;
    view.group.updateMatrixWorld(true);
    const out = {};
    const p = new THREE.Vector3();
    view.group.traverse((o) => {
      if (!o.name || o === view.group) return;
      o.getWorldPosition(p);
      out[o.name] = { x: p.x, y: p.y, z: p.z };
    });
    return out;
  };
  /** The skier glided down the line at `speed` from `fromZ` for `seconds`,
   * the beast stepped beside him; then, if `after`, the whole run stepped
   * on for that long (the catch, the lie and the walk off). */
  const bear = (id, title, ask, lands, fromZ, speed, seconds, after = 0) =>
    scenes.push({
      id,
      title,
      seconds: seconds + after,
      draw: () => {
        const state = ride(ask, lands);
        const view = gview.createGrimbearView(state.level, createHazeUniforms());
        const c = state.skier;
        c.x = S.SLOPE.x;
        c.z = fromZ;
        c.vx = 0;
        c.vz = speed;
        const every = stepsPerFrame(ctx);
        const dt = E.TUNING.dt;
        const out = [];
        const take = (s, t) => {
          if (s % every) return;
          const joints = bearJoints(view, state);
          if (joints) out.push({ t, joints, phase: state.grimbear.phase });
        };
        const glide = Math.round(seconds / dt);
        for (let s = 0; s < glide; s++) {
          state.t += dt;
          state.events.length = 0;
          if (!c.thrown) c.z += speed * dt;
          E.stepGrimbear(state, state.events);
          take(s, s * dt);
        }
        for (let s = 0; s < Math.round(after / dt); s++) {
          E.step(state, E.NEUTRAL_INPUT);
          take(glide + s, (glide + s) * dt);
        }
        view.dispose();
        return out;
      },
    });
  bear(
    "bear-miss",
    "the grimbear out of cover and diving past",
    "hunt",
    false,
    TREE.z - 75,
    15,
    10,
  );
  bear("bear-miss-fast", "diving past a skier flat out", "hunt", false, TREE.z - 120, 30, 7);
  bear(
    "bear-maul",
    "the catch, the skier down and the walk off",
    "hunt",
    true,
    620,
    15,
    6,
    E.GRIMBEAR.lieFor + 2,
  );
  bear("bear-chase", "a chase after the catch, pulling up short", "roam", undefined, 620, 15, 10);

  // --- a skier walked at a group by hand -----------------------------------
  /** The state `flushAt` and `spookAt` read: the clock and the skier. */
  const walker = (x0, z0, x1, z1, t0) => {
    const d = Math.hypot(x1 - x0, z1 - z0) || 1;
    const state = { t: t0, skier: { x: x0, z: z0 }, rivals: [] };
    return {
      state,
      at(t) {
        const k = Math.min(d, (t - t0) * COME_AT) / d;
        state.t = t;
        state.skier.x = x0 + (x1 - x0) * k;
        state.skier.z = z0 + (z1 - z0) * k;
      },
    };
  };

  // --- the birds -----------------------------------------------------------
  const who = traits.freshIndividual();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  /** A bird's points in its own frame: the body, the bill, the tail, each
   * wrist and wingtip folded and flapped by the shader's sums. */
  const birdPoints = (spec, pose) => {
    const wrist = birdShapes.wristOf(spec);
    const half = spec.span / 2;
    const w = (x) => birdShapes.wingPoint(x, 0, 0, wrist, pose.flap, pose.fold);
    return {
      body: [0, 0, 0],
      bill: [0, 0, spec.length * spec.neck],
      tail: [0, 0, -spec.length * (1 - spec.neck)],
      wrist_l: w(wrist),
      wrist_r: w(-wrist),
      tip_l: w(half),
      tip_r: w(-half),
    };
  };
  /** Points carried through an instance: at (`x`, `y`, `z`), turned by
   * `quat`, scaled by `scale` — `m.compose(pos, quat, scale)`. */
  const placed = (points, pose, scale, into, who) => {
    q.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
    for (const [name, p] of Object.entries(points)) {
      v.set(p[0] * scale, p[1] * scale, p[2] * scale).applyQuaternion(q);
      into[`${who}.${name}`] = { x: pose.x + v.x, y: pose.y + v.y, z: pose.z + v.z };
    }
    return into;
  };
  /** The flocks of the map, and of the same ground dealt again, `want`ed. */
  const flockOf = (want) => {
    for (let k = 0; k < RESEEDS; k++) {
      const l = k === 0 ? level : { ...level, seed: level.seed + k * 7919 };
      const plan = k === 0 ? birdPlan.birdPlanFor(level) : birdRoost.planBirds(l);
      const f = plan.flocks.find(want);
      if (f) return f;
    }
    return null;
  };
  const activity = birdPlan.activityAt(level);
  const birdsDrawn = 3;
  const bpose = birdPlan.freshBirdPose();
  /** The first `birdsDrawn` birds of `flock` over [`t0`, `t1`], a skier
   * walked at the flock from `from` if one is. */
  const flockScene = (id, title, flock, t0, t1, come) =>
    scenes.push({
      id,
      title,
      seconds: t1 - t0,
      draw: () => {
        const spec = birdDefs.birdById(flock.species);
        let flushed = -Infinity;
        const out = [];
        for (let t = t0; t <= t1; t += frame) {
          if (come) {
            come.at(t);
            flushed = birdPlan.flushAt(flock, come.state, flushed);
          }
          const joints = {};
          let air = 0;
          for (let i = 0; i < Math.min(birdsDrawn, flock.count); i++) {
            birdPlan.birdPose(flock, i, t, bpose, activity, flushed);
            traits.birdIndividual(flock.species, flock.scatter, i, who);
            placed(birdPoints(spec, bpose), bpose, who.scale, joints, `b${i}`);
            if (i === 0) air = bpose.airborne;
          }
          out.push({
            t: t - t0,
            joints,
            phase: air <= 0 ? "rest" : air >= 1 ? "air" : "taking off",
          });
        }
        return out;
      },
    });
  /** The first moment past `from` bird 0 of `flock` goes from `was` to `is`. */
  const airChange = (flock, was, is, from = 2) => {
    let prev = null;
    for (let t = from; t < 1800; t += 0.25) {
      birdPlan.birdPose(flock, 0, t, bpose, activity, -Infinity);
      const now = bpose.airborne;
      if (prev !== null && was(prev) && is(now)) return t;
      prev = now;
    }
    return null;
  };
  const flusher = flockOf((f) => birdPlan.flushable(f));
  if (flusher) {
    // At rest a good while, then a skier comes at it from up the hill.
    const rest =
      airChange(
        flusher,
        (a) => a > 0,
        (a) => a <= 0,
      ) ?? 2;
    const t0 = rest + 2;
    const h = flusher.home;
    const come = walker(h.x, h.z - COME_FROM, h.x, h.z + COME_FROM, t0);
    flockScene(
      "birds-flush",
      `a covey of ${flusher.species} put up by a skier`,
      flusher,
      t0,
      t0 + 16,
      come,
    );
  }
  const flyer = flockOf((f) => !birdPlan.flushable(f));
  if (flyer) {
    const up = airChange(
      flyer,
      (a) => a <= 0,
      (a) => a > 0,
    );
    if (up !== null)
      flockScene("birds-off", `a flock of ${flyer.species} taking off`, flyer, up - 2, up + 8);
    const down = airChange(
      flyer,
      (a) => a > 0,
      (a) => a <= 0,
      (up ?? 0) + 1,
    );
    if (down !== null)
      flockScene(
        "birds-down",
        `a flock of ${flyer.species} coming down`,
        flyer,
        down - 8,
        down + 2,
      );
  }

  // --- the animals ---------------------------------------------------------
  const marks = new Map();
  /** A built figure's measuring points in its own frame, each with its
   * `aPart` mark: each leg's hip and hoof, the nose, the poll, the withers
   * and the rump. */
  const beastMarks = (spec, form) => {
    const key = `${spec.id}:${form}`;
    if (marks.has(key)) return marks.get(key);
    const { geometry, pivot } = beastShapes.buildBeast(
      spec,
      beastShapes.BEAST_STYLES[spec.id],
      form,
      "near",
    );
    const p = geometry.getAttribute("position");
    const part = geometry.getAttribute("aPart");
    const legs = new Map();
    let nose = null;
    let poll = null;
    let withers = null;
    let rump = null;
    const at = (i) => ({
      x: p.getX(i),
      y: p.getY(i),
      z: p.getZ(i),
      leg: part.getX(i),
      hip: part.getY(i),
      head: part.getZ(i),
    });
    for (let i = 0; i < p.count; i++) {
      const a = at(i);
      if (a.leg > 0.5) {
        const k = a.leg.toFixed(4);
        const g = legs.get(k) ?? { hoof: a, top: a };
        if (a.y < g.hoof.y) g.hoof = a;
        if (a.y > g.top.y) g.top = a;
        legs.set(k, g);
      } else if (a.head > 0.5) {
        if (!nose || a.z > nose.z) nose = a;
        if (!poll || a.y > poll.y) poll = a;
      } else {
        if (!withers || a.y > withers.y) withers = a;
        if (!rump || a.z < rump.z) rump = a;
      }
    }
    geometry.dispose();
    const out = { pivot, points: { nose, poll, withers, rump } };
    for (const g of legs.values()) {
      const name = `${g.hoof.z > 0 ? "fore" : "hind"}_${g.hoof.x > 0 ? "l" : "r"}`;
      out.points[`${name}.hoof`] = g.hoof;
      out.points[`${name}.top`] = g.top;
    }
    marks.set(key, out);
    return out;
  };
  /** A group of the map's, or of the same ground dealt again, `want`ed. */
  const groupOf = (want) => {
    for (let k = 0; k < RESEEDS; k++) {
      const l = k === 0 ? level : { ...level, seed: level.seed + k * 7919 };
      const plan = k === 0 ? beastPlan.beastPlanFor(level) : beastPlan.planBeasts(l);
      const g = plan.groups.find(want);
      if (g) return g;
    }
    return null;
  };
  const ground = wild.wildGround(level);
  const apose = beastPlan.freshBeastPose();
  const herdDrawn = 2;
  const herdScene = (id, title, group, t0, t1, come) =>
    scenes.push({
      id,
      title,
      seconds: t1 - t0,
      draw: () => {
        const spec = beastDefs.beastById(group.species);
        const forms = traits.BEAST_FORMS[group.species];
        let spook = beastPlan.CALM;
        const out = [];
        for (let t = t0; t <= t1; t += frame) {
          if (come) {
            come.at(t);
            spook = beastPlan.spookAt(group, come.state, spook, ground);
          }
          const joints = {};
          let phase = "";
          for (let i = 0; i < Math.min(herdDrawn, group.count); i++) {
            beastPlan.beastPose(group, i, t, ground, apose, spook);
            traits.beastIndividual(group.species, group.scatter, i, group.count, who);
            const m = beastMarks(spec, forms[traits.drawnForm(who.form, forms.length)]);
            const g = beastShapes.gaitOf(spec, m.pivot);
            const points = {};
            for (const [name, a] of Object.entries(m.points)) {
              if (!a) continue;
              points[name] = beastShapes.gaitPoint(
                a.x,
                a.y,
                a.z,
                a.leg,
                a.hip,
                a.head,
                apose.gait,
                apose.stride,
                apose.graze,
                g,
              );
            }
            placed(points, apose, who.scale, joints, `a${i}`);
            if (i === 0)
              phase =
                spook.at > -Infinity && t - spook.at < 30
                  ? "fleeing"
                  : apose.stride > 0.05
                    ? "walking"
                    : apose.graze > 0.1
                      ? "grazing"
                      : "stood";
          }
          out.push({ t: t - t0, joints, phase });
        }
        return out;
      },
    });
  /** The first moment past 2 s the leader of `group` goes from `was` to `is`. */
  const herdChange = (group, was, is) => {
    let prev = null;
    for (let t = 2; t < 1800; t += 0.25) {
      beastPlan.beastPose(group, 0, t, ground, apose, beastPlan.CALM);
      if (prev && was(prev) && is(apose)) return t;
      prev = { stride: apose.stride, graze: apose.graze };
    }
    return null;
  };
  const herd = (species) => {
    const group = groupOf((g) => g.species === species);
    if (!group) return;
    const off = herdChange(
      group,
      (a) => a.stride < 0.05,
      (a) => a.stride >= 0.05,
    );
    if (off !== null)
      herdScene(
        `${species}-walk`,
        `a ${species} setting off on its round`,
        group,
        off - 2,
        off + 8,
      );
    const graze = herdChange(
      group,
      (a) => a.graze < 0.1,
      (a) => a.graze >= 0.1,
    );
    if (graze !== null)
      herdScene(
        `${species}-graze`,
        `a ${species} putting its head down`,
        group,
        graze - 2,
        graze + 6,
      );
    // Calm, then a skier comes at it.
    const t0 = 5;
    beastPlan.beastPose(group, 0, t0, ground, apose, beastPlan.CALM);
    const come = walker(apose.x, apose.z - COME_FROM, apose.x, apose.z + COME_FROM, t0);
    herdScene(`${species}-spook`, `a ${species} run off by a skier`, group, t0, t0 + 18, come);
  };
  herd("chamois");
  herd("roedeer");
  herd("hare");

  const drawn = new Map();
  return {
    id: "wild",
    say: "the grimbear through his own view, the birds put up and the animals run off, their wings and legs moved by the shader's own sums (world frame)",
    scenes: scenes.map((s) => ({ id: s.id, title: s.title, seconds: s.seconds })),
    ride(scene) {
      if (!drawn.has(scene.id))
        drawn.set(scene.id, scenes.find((s) => s.id === scene.id)?.draw() ?? []);
      return drawn.get(scene.id);
    },
  };
}
