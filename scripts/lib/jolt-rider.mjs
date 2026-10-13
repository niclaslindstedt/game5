// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JOLT LAB'S RIDER (`make jolt`): the player's own figure — on skis and
// on a board, and every rival and enthusiast drawn by the same model — as
// THE GAME DRAWS HIM. Each scene is skied by the real engine step by step,
// and after every step the real model (`createSkisModel`, the code-built
// figure the renderer posts the state to) is posed off it exactly as the
// renderer poses it, the dressed skin's bones read back out of the three.js
// tree. So every way of drawing him is in it — the legs' spring, the
// technique's stand, a trick's grab, the start house, the somersault's
// tuck, the ragdoll a wipeout throws him onto, a seat, the boards, a skid,
// a skydive's shapes — and every hand-off between them.
//
// Each bone's place is read in the SKIER'S BODY FRAME — the engine's own
// place and turn taken off — so a spin, a carve's lean and a fall through
// the air (the physics) are not jolts, and whatever the drawing does over
// them is.

/** The bones whose far end is read too (the tips of him). */
/** The seconds a staged scene is left to settle before it is read. */
const SETTLE = 0.15;

const TIPS = new Set(["head", "hand_l", "hand_r", "boot_l", "boot_r"]);

/** A scene of the rider's: how it is stood up and skied. */
export function createRiderReader(ctx) {
  const { THREE, E, G } = ctx;
  const world = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const back = new THREE.Matrix4();
  /** A model of its own a scene, nothing eased over from the last — in
   * the player's dress, or the scene's (a wingsuit's run dresses him in
   * his suit). */
  const modelOf = (spec, dress) =>
    G.createSkisModel(spec, G.pairStyle(spec, dress ?? G.SLOT_DRESS[0]), (x) => x);
  /** Every bone of his drawn skin, in the frame `c` stands in (his body's). */
  const read = (model, c, inWorld) => {
    const sk = model.skin();
    sk.group.updateWorldMatrix(true, false);
    const mw = sk.group.matrixWorld;
    q.set(c.q.x, c.q.y, c.q.z, c.q.w).invert();
    const out = {};
    const put = (name, x, y, z) => {
      world.set(x, y, z).applyMatrix4(mw);
      if (!inWorld) {
        world.x -= c.x;
        world.y -= c.y;
        world.z -= c.z;
        world.applyQuaternion(q);
      }
      out[name] = { x: world.x, y: world.y, z: world.z };
    };
    // THE POLES, where he holds them: the basket and a metre up the shaft.
    for (const name of ["pole_l", "pole_r"]) {
      const g = model.root.getObjectByName(name);
      if (!g || !g.visible) continue;
      g.updateWorldMatrix(true, false);
      for (const [end, up] of [
        ["", 0],
        [".top", 1],
      ]) {
        world.set(0, up, 0).applyMatrix4(g.matrixWorld);
        world.applyMatrix4(back.copy(mw).invert());
        put(`${name}${end}`, world.x, world.y, world.z);
      }
    }
    for (const [name, f] of Object.entries(sk.frames)) {
      put(name, f.head.x, f.head.y, f.head.z);
      if (TIPS.has(name)) {
        const l = f.length;
        put(`${name}.tip`, f.head.x + f.y.x * l, f.head.y + f.y.y * l, f.head.z + f.y.z * l);
      }
    }
    return out;
  };
  /** The phase he is drawn in, for the table. */
  const phaseOf = (state) => {
    const c = state.skier;
    if (c.thrown) return "thrown";
    if (c.lift) return `lift ${c.lift.phase ?? ""}`.trim();
    if (state.sled?.rider) return "sled";
    if (state.heli?.rider) return "heli";
    if (state.plane?.rider) return "plane";
    if (state.balloon?.aboard) return "basket";
    if (state.para && state.para.mode === "flown" && state.para.flying) return "para";
    if (state.chute) return `${state.wingsuit ? "suit" : "chute"} ${state.chute.mode}`;
    if (c.town) return "town";
    if (c.fetch) return "fetch";
    if (state.afterski?.inside) return "afterski";
    if (state.jump) return `jump ${state.jump.stage}`;
    if (c.airborne) return "air";
    if (c.switched) return "switch";
    return "snow";
  };
  /**
   * Ride `scene` — `{ game(), seconds, input(t, state), place?(), setup?(model, state),
   * each?(model, state), seat?(model, state, dt), dress?(G) }` — and the
   * samples of his drawn bones, one a frame at `hz` (the game draws at the
   * display's rate, posing him off the last state stepped). `seat` is the
   * renderer's `machines.seat`, called just before each frame is posed;
   * `dress` the dress his model is cut in, when not the player's own. The
   * first `SETTLE` s are the model finding its feet on a moment staged out
   * of nothing, and are not read.
   */
  return function ride(scene) {
    const state = scene.game();
    if (scene.place) E.placeRun(state, scene.place());
    const model = modelOf(state.skier.spec, scene.dress?.(G));
    model.setRun(state);
    model.setGround(state.level, E.flightGravity(state.rules));
    for (const k of ["setPerch", "setSled", "setSkydive", "setWingsuit"]) model[k]?.(null);
    model.setBasket(false);
    scene.setup?.(model, state);
    const t0 = state.t;
    const samples = [];
    const ref = { x: 0, y: 0, z: 0, q: state.skier.q, vx: 0, vy: 0, vz: 0, t: 0 };
    // A frame every so many steps, counted (a clock added up in floats
    // would sample one step late now and then, a jolt of its own).
    const every = Math.max(1, Math.round(E.TUNING.physicsHz / ctx.hz));
    let steps = 0;
    let last = null;
    while (state.t - t0 < scene.seconds) {
      E.step(state, scene.input(state.t - t0, state));
      scene.each?.(model, state);
      const t = state.t - t0;
      if (steps++ % every !== 0) continue;
      const c = state.skier;
      scene.seat?.(model, state, last === null ? 1 / ctx.hz : t - last);
      model.pose(
        c,
        c,
        0,
        state.tricks?.pose ?? null,
        last === null ? 0 : t - last,
        c.thrown ?? null,
        state.plane?.rider ? true : ctx.P.inStartGate(state),
        state.tricks,
      );
      last = t;
      if (t < SETTLE) continue;
      // Thrown, he is read at the engine's own place (which goes with his
      // body) turned as his body frame was at the throw — so the ragdoll's
      // own tumble is read as it moves and nothing of the engine's turn of
      // a skier no longer on his skis is.
      if (!c.thrown) {
        Object.assign(ref, { x: c.x, y: c.y, z: c.z, q: c.q, vx: c.vx, vy: c.vy, vz: c.vz, t });
      }
      const at = c.thrown ? { x: c.x, y: c.y, z: c.z, q: ref.q } : c;
      samples.push({
        t,
        joints: read(model, at, ctx.world || scene.world === true),
        phase: phaseOf(state),
      });
    }
    return samples;
  };
}

/** The skier lab's moves (`skier-moves.mjs`) and the board's
 * (`board-figure-moves.mjs`), each a scene. */
export function movesOf(ctx, moves, spec) {
  const { E, S } = ctx;
  return moves.map((m) => ({
    id: m.id,
    title: m.title,
    seconds: m.seconds,
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
    input: m.input,
  }));
}
