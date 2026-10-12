// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JOLT LAB'S CROWD (`make jolt ARGS=--family=crowd`): the free ride's
// amateurs as THE GAME DRAWS THEM. A free ride on the shared mountain
// (`jolt-posed.mjs`) is skied by the real engine, the whole crowd with it,
// and the real view (`crowd-view.ts`) is updated off every drawn frame —
// so whatever the view decides (the chair's sit and swing, the rise off it,
// the mirror, the dials, the ragdoll a fall throws him onto, the board) is
// in it. The view is handed a cull that sees one amateur only, so his is
// the one instance written; his matrix and his row of morph weights are
// read back out of the buffers the shader is handed, and his joints are the
// targets blended by those weights through that matrix. Down in the snow he
// is drawn off his ragdoll (`fallenPose`, placed at his body as the view
// places the mesh), so the hand-offs onto and off it are measured too.
//
// The scenes are FOUND, not staged: a first pass skis the ride and logs
// what every amateur does; a scene is the first amateur seen doing its
// thing (a carver carving, a park rat in the air, a chair loaded, a fall
// and the get-up…) and a window round it; a second pass skis the ride
// again (it is deterministic) and draws each scene's amateur through its
// window. In the WORLD frame: a skier curving at speed is a few tens of
// m/s² of his own.

import { join } from "node:path";

import {
  blendPoints,
  freeLevel,
  moved,
  posedPoints,
  stepsPerFrame,
  throughMatrix,
} from "./jolt-posed.mjs";

/** How long the ride is searched, s, and how often the log is written. */
const SEARCH = 150;
const LOG_EVERY = 0.25;
/** The run's clock the ride is started at, s. The lifts run off the clock
 * alone (`carrierAt`), so a ride begun four minutes on finds its chairs
 * four minutes round — the few the crowd was dealt onto reach their tops
 * inside the search rather than five minutes into it, the rest of the crowd
 * skiing on from where it was dealt. */
const CLOCK = 240;

/** A scene: how to find it in the log (`find(log) → { a, t0, t1 } | null`). */
function scenesOf() {
  const S = [];
  /** A kind of skier skiing his run for 8 s. */
  const skiing = (id, title, ok) =>
    S.push({
      id,
      title,
      find: (log) =>
        log.run(
          ok,
          (x) => x.mode === "ski" && !x.thrown,
          8,
          (t) => [t, t + 8],
        ),
    });
  skiing("cruiser", "a cruiser down his run", (a) => a.kind === "cruiser" && !a.board);
  skiing("carver", "a carver carving", (a) => a.kind === "carver" && !a.board);
  skiing("beginner", "a beginner in his wedge", (a) => a.kind === "beginner" && !a.board);
  skiing("zigzag", "the zigzag, wall to wall", (a) => a.kind === "zigzag" && !a.board);
  skiing("drunk", "the drunk", (a) => a.kind === "drunk" && !a.board);
  skiing("kid", "a child in a family's wedge", (a) => a.body === "child" && !a.board);
  skiing("board-cruise", "a snowboarder down his run", (a) => a.board && a.kind === "cruiser");
  /** A change of what he does, a window round it. */
  const change = (id, title, ok, before, after, lead, tail) =>
    S.push({
      id,
      title,
      find: (log) => log.change(ok, before, after, (t) => [t - lead, t + tail]),
    });
  change(
    "air-ski",
    "an amateur on skis off a kicker",
    (a) => !a.board,
    (x) => x.mode !== "air",
    (x) => x.mode === "air",
    3,
    4,
  );
  change(
    "air-board",
    "a park rat off a kicker",
    (a) => !!a.board,
    (x) => x.mode !== "air",
    (x) => x.mode === "air",
    3,
    4,
  );
  change(
    "board-sit",
    "a snowboarder sitting down in the snow",
    (a) => !!a.board,
    (x) => x.sit < 0.01,
    (x) => x.sit > 0.01,
    2,
    8,
  );
  change(
    "stop",
    "pulling up with his group",
    (a) => !a.board,
    (x) => x.mode === "ski",
    (x) => x.mode === "stop",
    3,
    5,
  );
  change(
    "queue",
    "skating into a lift's queue",
    (a) => !a.board,
    (x) => x.mode !== "queue",
    (x) => x.mode === "queue",
    2,
    6,
  );
  change(
    "chair-load",
    "loaded onto a chair",
    (a) => !a.board,
    (x) => x.mode === "queue",
    (x) => x.mode === "ride" && x.lift === "chair",
    4,
    6,
  );
  change(
    "chair-unload",
    "off a chair at its top",
    (a) => !a.board,
    (x) => x.mode === "ride" && x.lift === "chair",
    (x) => x.mode !== "ride",
    4,
    6,
  );
  change(
    "board-chair-off",
    "a snowboarder off a chair",
    (a) => !!a.board,
    (x) => x.mode === "ride" && x.lift === "chair",
    (x) => x.mode !== "ride",
    4,
    6,
  );
  change(
    "tbar-on",
    "taken by a T-bar",
    (a) => !a.board,
    (x) => x.mode !== "ride",
    (x) => x.mode === "ride" && x.lift === "drag",
    3,
    6,
  );
  change(
    "tbar-off",
    "let go at a T-bar's top",
    () => true,
    (x) => x.mode === "ride" && x.lift === "drag",
    (x) => x.mode !== "ride",
    4,
    6,
  );
  change(
    "gondola-off",
    "out of a gondola's cabin",
    () => true,
    (x) => x.mode === "ride" && x.lift === "gondola",
    (x) => x.mode !== "ride",
    3,
    6,
  );
  change(
    "fall-ski",
    "down in the snow and up again",
    (a) => !a.board,
    (x) => !x.thrown,
    (x) => x.thrown,
    1.5,
    11,
  );
  change(
    "fall-board",
    "a snowboarder down and up again",
    (a) => !!a.board,
    (x) => !x.thrown,
    (x) => x.thrown,
    1.5,
    11,
  );
  return S;
}

/** The first pass's log: every amateur's mode, lift and fall at every
 * `LOG_EVERY` s, and the questions the scenes ask of it. */
function createLog(crowd, n) {
  const who = crowd.amateurs.map((a) => ({ id: a.id, kind: a.kind, body: a.body, board: a.board }));
  const rows = crowd.amateurs.map(() => new Array(n));
  const at = (k) => k * LOG_EVERY;
  return {
    rows,
    /** The first amateur `ok` who keeps `hold` for `secs` s running. */
    run(ok, hold, secs, window) {
      const need = Math.ceil(secs / LOG_EVERY);
      for (const a of who) {
        if (!ok(a)) continue;
        const r = rows[a.id];
        let since = -1;
        for (let k = 0; k < n && r[k]; k++) {
          if (!hold(r[k])) since = -1;
          else if (since < 0) since = k;
          // A run he was already on at the start is read from its middle.
          if (since >= 0 && k - since >= need && at(since) > 1) {
            const [t0, t1] = window(at(since));
            return { a: a.id, t0, t1 };
          }
        }
      }
      return null;
    },
    /** The first amateur `ok` seen going from `before` to `after`, with
     * the window round it in the ride. */
    change(ok, before, after, window) {
      for (const a of who) {
        if (!ok(a)) continue;
        const r = rows[a.id];
        for (let k = 1; k < n && r[k]; k++) {
          if (!before(r[k - 1]) || !after(r[k])) continue;
          const [t0, t1] = window(at(k));
          if (t0 < 1 || t1 > SEARCH) continue;
          return { a: a.id, t0, t1 };
        }
      }
      return null;
    },
  };
}

export async function crowdFamily(ctx) {
  const { E, THREE } = ctx;
  const R = (m) => import(join(ctx.root, `pwa/src/game/${m}.ts`));
  const [{ createCrowdView }, { createHazeUniforms }, rig, board, fall] = await Promise.all([
    R("crowd-view"),
    R("haze"),
    R("crowd-rig"),
    R("crowd-board"),
    R("crowd-fall"),
  ]);
  const level = freeLevel(ctx);
  const plans = E.liftPlans(level);
  const game = () => {
    const state = E.createGame({ level, seed: level.seed, mode: "free", quiet: true });
    state.t = CLOCK;
    return state;
  };
  const every = stepsPerFrame(ctx);

  // THE FIRST PASS: the ride skied and every amateur logged.
  const scenes = scenesOf();
  {
    const state = game();
    const n = Math.round(SEARCH / LOG_EVERY);
    const log = createLog(state.crowd, n);
    const logEvery = Math.round(LOG_EVERY * E.TUNING.physicsHz);
    for (let i = 0; i <= n * logEvery; i++) {
      if (i % logEvery === 0) {
        const k = i / logEvery;
        if (k >= n) break;
        for (const a of state.crowd.amateurs) {
          log.rows[a.id][k] = {
            mode: a.mode,
            thrown: !!a.thrown,
            sit: a.sit,
            lift: a.mode === "ride" ? (plans[a.lift]?.lift.kind ?? "") : "",
          };
        }
      }
      E.step(state, E.NEUTRAL_INPUT);
    }
    for (const s of scenes) {
      s.found = s.find(log);
      if (s.found) {
        const a = state.crowd.amateurs[s.found.a];
        s.title += ` (#${a.id}, ${a.kind}, ${a.body}${a.board ? `, ${a.board}` : ""})`;
        s.seconds = s.found.t1 - s.found.t0;
      }
    }
  }
  const found = scenes.filter((s) => s.found);

  // Each body's targets as points, on skis and on a board.
  const targetsOf = new Map();
  const targets = (body, onBoard) => {
    const key = `${body}:${onBoard}`;
    let t = targetsOf.get(key);
    if (!t) {
      const look = rig.CROWD_LOOKS[body];
      t = (onBoard ? board.boardTargets(look) : rig.crowdTargets(look)).map(posedPoints);
      targetsOf.set(key, t);
    }
    return t;
  };

  // THE SECOND PASS: the ride again, each scene's amateur drawn through
  // its window by a view of its own.
  let samples = null;
  const draw = () => {
    samples = new Map(found.map((s) => [s.id, []]));
    const state = game();
    const haze = createHazeUniforms();
    const views = found.map((s) => ({ s, view: createCrowdView(level, haze) }));
    const end = Math.max(...found.map((s) => s.found.t1));
    const eye = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const normal = { x: 0, y: 1, z: 0 };
    let steps = 0;
    while (state.t - CLOCK < end) {
      E.step(state, E.NEUTRAL_INPUT);
      if (++steps % every !== 0) continue;
      const t = state.t - CLOCK;
      for (const { s, view } of views) {
        if (t < s.found.t0 || t > s.found.t1) continue;
        const a = state.crowd.amateurs[s.found.a];
        eye.set(a.x + 4, a.y + 2, a.z);
        view.update(state, eye, { seen: (x, _y, z) => x === a.x && z === a.z });
        const phase = phaseOf(a, plans);
        let joints = null;
        // Drawn as joints — down on his ragdoll, or handed over between it
        // and his skis — the joints the view drew him at, in the world.
        const shown = view.shownOf?.(a.id);
        if (shown) joints = moved(posedPoints(shown), 0, 0, 0);
        else if (a.thrown) {
          // DOWN: hung on his ragdoll, as the view hangs him (its stand on
          // the snow's own normal — the view's after-chair upright frame
          // a fall straight off a chair would take is not read here).
          level.normalAt(a.x, a.z, normal);
          const pose = fall.fallenPose(a, fall.standFrame(a, normal), [a.x, a.y, a.z]);
          if (pose) joints = moved(posedPoints(pose), a.x, a.y, a.z);
        } else {
          const mesh = view.group.children.find(
            (c) => c.visible && c.count > 0 && !c.name.startsWith("crowd-down"),
          );
          if (mesh) {
            mesh.getMatrixAt(0, m);
            const n = mesh.morphTargetInfluences.length;
            const row = mesh.morphTexture.image.data;
            const w = Array.from(row.subarray(1, 1 + n));
            const local = blendPoints(targets(a.body, !!a.board), w);
            joints = throughMatrix(local, m.elements);
          }
        }
        if (joints)
          samples.get(s.id).push({ t: t - s.found.t0, joints, phase, info: infoOf(a, view) });
      }
    }
    for (const { view } of views) view.dispose();
  };

  return {
    id: "crowd",
    say: "the free ride's amateurs, found in a ride and drawn through the real crowd view (world frame)",
    scenes: found.map((s) => ({ id: s.id, title: s.title, seconds: s.seconds })),
    ride(scene) {
      if (!samples) draw();
      return samples.get(scene.id) ?? [];
    },
  };
}

/** What a frame was drawn off, for a probe reading a snap: the amateur's
 * own numbers and the weights the view wrote. */
function infoOf(a, view) {
  const mesh = view.group.children.find((c) => c.visible && c.count > 0);
  const w = mesh?.morphTexture
    ? Array.from(mesh.morphTexture.image.data.subarray(1, 1 + mesh.morphTargetInfluences.length))
    : [];
  const r = (v) => Math.round(v * 1000) / 1000;
  return {
    mesh: mesh?.name,
    heading: r(a.heading),
    speed: r(a.speed),
    lean: r(a.lean),
    yaw: r(a.yaw),
    push: r(a.push),
    pole: r(a.pole),
    across: r(a.across),
    plough: r(a.plough),
    fall: r(a.fall),
    w: w.map(r),
  };
}

/** The phase an amateur is drawn in, for the table. */
function phaseOf(a, plans) {
  if (a.thrown) return a.rise > 0 ? "rise" : "down";
  if (a.mode === "ride") return `ride ${plans[a.lift]?.lift.kind ?? ""}`.trim();
  return a.mode;
}
