// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER IN THE RENDERER — the one hand the renderer holds it by:
// the machine and its pad (`heli-view.ts`), its wash blown into the snow
// cloud, the airframe torn apart when it goes down (`heli-shatter.ts`),
// the fireball, the sparks and the fire on the wreck (`explosion.ts`), the
// lens it takes while the skier sits on its skid (`camera-heli.ts`) and
// the crash's (`camera-crash.ts`), and the skier sat on the skid as the
// figure is posed. Built per map with the rest of the world, on a free
// ride only.
//
// The lens is FLOWN onto the helicopter and off it, never cut: as he sits
// on the skid it is blended over from the skier's ladder, and after he
// pushes off it is held on him for a beat and blended back. Only a new run
// and the ride begun again after a crash cut to it.

import * as THREE from "three";
import { HELI, type GameState, type HeliLivery, type Level } from "@engine";
import { sunNow } from "./sky-clock.ts";

import { frameCrash, startCrashCam, wooded, type CrashCam } from "./camera-crash.ts";
import { createHeliCam, frameHeli, heliMiddleOf, orbitBlend } from "./camera-heli.ts";
import { bodyOf, COCKPIT, inCabin } from "./cockpit-plan.ts";
import { blendLens, type LensPose, type Vec3 } from "./camera-rigs.ts";
import { shelterAt, shelterOff } from "./shelter.ts";
import { createExplosion, type Explosion } from "./explosion.ts";
import type { HazeUniforms } from "./haze.ts";
import { createHeliView, type HeliLook, type HeliView, type WashPuff } from "./heli-view.ts";
import type { Perch } from "./skier-dangle.ts";
import { createHeliPerch } from "./ride-perch.ts";
import { policeModelUrl, rescueModelUrl } from "./skier-models.ts";
import type { CameraRung } from "./renderer-api.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import type { SnowProps } from "./snowpack.ts";

export type HeliScene = {
  group: THREE.Group;
  /** One frame: the machine drawn, the wash blown, the fire burning, and
   * the lens it wants on `rung` worked out (`lens` hands it over) — a
   * change of rung flown while `flying`, else cut. */
  frame(
    state: GameState,
    alpha: number,
    dt: number,
    player: { x: number; z: number },
    rung: CameraRung,
    flying: boolean,
    cloud: SnowCloud | null,
    snowAt: (x: number, z: number) => SnowProps,
    aspect?: number,
  ): void;
  /** The eye the frame is drawn from, settled: the cockpit shown while it
   * is in the cabin (`heli-cockpit.ts`). */
  seen(eye: Vec3): void;
  /** How dark the sky is (its `lamps`): the burning wreck's light on the
   * snow is a night's (`Explosion.dusk`). */
  dusk(lit: number): void;
  /** The pace the run is shown at (`HeliView.setPace`). */
  setPace(pace: number): void;
  /** THE LENS this frame, `ladder` the skier's own as framed under it: the
   * helicopter's, blended in from the ladder or out to it — or null once
   * the ladder has it whole (nobody rides it, or the orbit). */
  lens(ladder: LensPose, dt: number): LensPose | null;
  /** The figure sat on the skid (`SkisModel.setPerch`): the skid's top in
   * his body frame and what his dangling legs feel there (`skier-dangle.ts`
   * — the gravity less the seat's acceleration, the air past him, the
   * rotor), or null off it. */
  perch(state: GameState): Perch | null;
  /** The machine as drawn this frame (its skid datum and attitude), or null. */
  drawn(): { x: number; y: number; z: number; q: THREE.Quaternion } | null;
  /** The model in the group (`HeliView.ready`). */
  ready: Promise<void>;
  dispose(): void;
};

/** Each owner's look, by the livery a taken machine is drawn in: its
 * model, the air ambulance's or the police helicopter's. */
const LIVERY_LOOK: Record<HeliLivery, () => HeliLook> = {
  rescue: () => ({ pad: false, url: rescueModelUrl() }),
  police: () => ({ pad: false, url: policeModelUrl() }),
};

/** How long the drop's lens is held after the push, s, and how long its
 * look takes to come round onto him; how long the lens takes to fly onto
 * the helicopter as he sits on the skid, and back to the ladder after the
 * drop, s. */
const DROP_HOLD = 1.2;
const DROP_TURN = 0.45;
const HAND_IN = 1.1;
const HAND_OUT = 1.3;
/** THE CABIN no snow falls in, in the machine's frame, m: floor to roof,
 * side to side inside the doors, the rear bench to the windscreen. */
const CABIN = (() => {
  const B = HELI.body;
  const lo = { y: B.floor - 0.15, z: -0.2 };
  const hi = { y: B.roof, z: B.nose - 0.25 };
  return {
    centre: { x: 0, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 },
    half: { x: B.width / 2 - 0.04, y: (hi.y - lo.y) / 2, z: (hi.z - lo.z) / 2 },
  };
})();

export function createHeliScene(level: Level, haze: HazeUniforms): HeliScene {
  const group = new THREE.Group();
  group.name = "helicopter";
  const home: HeliView = createHeliView(level, haze);
  /** THE MACHINE TAKEN FROM ITS OWNERS (`steal.ts`), drawn in their
   * livery off their model (each built with the world, below), and the
   * view drawing the run's machine this frame. */
  const takenBy = new Map<HeliLivery, HeliView>();
  let view = home;
  const lookOf = (livery: HeliLivery): HeliView => {
    let v = takenBy.get(livery);
    if (!v) {
      v = createHeliView(level, haze, LIVERY_LOOK[livery]());
      v.group.visible = false;
      takenBy.set(livery, v);
      group.add(v.group);
    }
    return v;
  };
  // Both owners' machines built with the world, behind the loading card:
  // their models in and every program linked before he can take one,
  // never on the frame he climbs in.
  const takenReady = (Object.keys(LIVERY_LOOK) as HeliLivery[]).map((l) => lookOf(l).ready);
  const viewFor = (state: GameState): HeliView => {
    const livery = state.heli?.livery;
    home.setAway(!!livery);
    for (const [k, v] of takenBy) if (k !== livery) v.group.visible = false;
    if (!livery) return home;
    const taken = lookOf(livery);
    taken.group.visible = true;
    return taken;
  };
  const boom: Explosion = createExplosion();
  group.add(home.group, boom.group);
  const cam = createHeliCam();
  let wasWreck = false;
  /** THE CRASH'S LENS: from the lens on screen the moment it goes up,
   * pulled back to see it whole, for as long as it burns. */
  let crash: CrashCam | null = null;
  /** THE DROP'S LENS: the helicopter's last, held where it was for a beat
   * after he pushes off and turned down after him as he falls — the
   * ladder's boom, which framed him sat on the skid, would be inside the
   * airframe — and the seconds since the push. */
  let lastLens: LensPose | null = null;
  let worn = false;
  let since = Infinity;
  /** THE HAND-OVER: what the helicopter wants on screen this frame (null:
   * the ladder), whether it is cut to rather than flown, the share of it
   * on screen, the last lens it asked for (flown out from once it stops)
   * and the lens on screen last frame (what a crash starts from). */
  let own: LensPose | null = null;
  let cut = false;
  let share = 0;
  let held: LensPose | null = null;
  let shown: LensPose | null = null;
  let lastState: GameState | null = null;
  /** Where the eye stood last frame, which the fire and smoke are sorted
   * back to front for. */
  const eyeWas = { x: 0, y: 0, z: 0 };
  const hooks = {
    flame: (x: number, y: number, z: number, heat: number, dt: number) =>
      boom.flame(x, y, z, heat, dt),
    strike: (x: number, y: number, z: number, speed: number) => {
      boom.strike(x, y, z, speed);
      strikeCloud?.(x, y, z, speed);
    },
  };
  let strikeCloud: ((x: number, y: number, z: number, speed: number) => void) | null = null;
  // THE SEAT'S ACCELERATION, world frame, m/s²: its velocity differenced
  // between the engine's steps (the tick it was read at, and the velocity).
  return {
    group,
    ready: Promise.all([home.ready, ...takenReady]).then(() => undefined),
    frame(state, alpha, dt, player, rung, flying, cloud, snowAt, aspect = 16 / 9) {
      const h = state.heli;
      cam.cut = !flying;
      own = null;
      cut = state !== lastState;
      lastState = state;
      if (!h) return;
      strikeCloud = (x, y, z, speed) =>
        cloud?.burst(x, y + 0.3, z, 0, 0, Math.min(1.5, speed / 15), snowAt(x, z));
      view = viewFor(state);
      if (view !== home) home.update(state, alpha, dt, player, hooks);
      view.update(state, alpha, dt, player, hooks);
      const puff: WashPuff = (x, y, z, vx, vy, vz, size) => cloud?.blow(x, y, z, vx, vy, vz, size);
      view.blow(state, dt, puff, (x, z) => snowAt(x, z).loose);
      const wreck = h.mode === "wreck";
      const groundAt = (x: number, z: number) => state.level.groundAt(x, z);
      if (wreck && !wasWreck && h.wreck) {
        // IT GOES UP: the fireball, the spray of fuel lit along the way it
        // was going, and the snow round it thrown up and out by the shock.
        const way = view.way();
        boom.burst(h.wreck.x, h.wreck.y, h.wreck.z, h.wreck.speed, way.x, way.z);
        const { x, y, z } = h.wreck;
        const snow = snowAt(x, z);
        for (let i = 0; i < 4; i++)
          cloud?.burst(x, y + 0.5, z, way.x * 0.3, way.z * 0.3, 2.5, snow);
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2;
          const sx = Math.sin(a);
          const sz = Math.cos(a);
          cloud?.blow(x + sx * 4, y + 1, z + sz * 4, sx * 22, 2.5, sz * 22, 2.4);
        }
        crash =
          h.wreck.aboard && shown && rung !== "orbit"
            ? startCrashCam(shown, { x, y, z }, groundAt, (e, a) => wooded(state.level, e, a), {
                sun: sunNow(state.level, state.t),
              })
            : null;
      }
      if (!wreck && wasWreck) {
        boom.clear();
        crash = null;
        // The ride begun again on the pad: cut to it.
        cut = true;
        cam.fresh = true;
      }
      wasWreck = wreck;
      boom.burning(wreck, h.x, h.y, h.z);
      boom.update(dt, groundAt, eyeWas);
      const step = Math.min(dt, 0.1);
      if (wreck && crash && h.wreck && rung !== "orbit") {
        const w = h.wreck;
        own = frameCrash(crash, { x: w.x, y: w.y, z: w.z }, step, groundAt);
        cut = true;
        return;
      }
      const at = view.drawn();
      if (!h.rider || !at || rung === "orbit") {
        cam.fresh = true;
        if (lastLens && h.mode === "home" && since < DROP_HOLD && rung !== "orbit" && !worn) {
          // THE DROP: held where it was, its look coming round onto him as
          // he falls away.
          since += dt;
          const c = state.skier;
          const k = Math.min(1, since / DROP_TURN);
          const s = k * k * (3 - 2 * k);
          const f = lastLens.target;
          own = {
            ...lastLens,
            target: {
              x: f.x + (c.x - f.x) * s,
              y: f.y + (c.y - f.y) * s,
              z: f.z + (c.z - f.z) * s,
            },
            roll: lastLens.roll * (1 - s),
          };
          return;
        }
        // Out of the cockpit, let go at once: the ladder flies out from his head.
        if (worn && lastLens) cut = true;
        lastLens = null;
        return;
      }
      since = 0;
      // From the cockpit or the nose the drop is not held: the lens is in
      // the airframe and would look at him through it — the camera's own
      // stand-in (`camera.ts`'s `bail`) flies it out to the chase.
      worn = rung === "tips" || rung === "helmet";
      lastLens = frameHeli(cam, h, at, rung, step, groundAt, aspect);
      own = lastLens;
    },
    lens(ladder, dt) {
      if (own) {
        share = cut ? 1 : Math.min(1, share + dt / HAND_IN);
        held = own;
      } else {
        share = cut ? 0 : Math.max(0, share - dt / HAND_OUT);
      }
      // Flown onto it round the machine as it is drawn, never through
      // it; off it, straight back to the skier falling away from it.
      const at = view.drawn();
      shown =
        !held || share <= 0
          ? null
          : share >= 1
            ? held
            : own && at
              ? orbitBlend(ladder, held, share, heliMiddleOf(at))
              : blendLens(ladder, held, share);
      if (!shown) held = null;
      const out = shown;
      // What a crash starts from: the lens on screen, whoever framed it.
      shown = shown ?? ladder;
      Object.assign(eyeWas, shown.eye);
      return out;
    },
    setPace(pace) {
      home.setPace(pace);
      for (const v of takenBy.values()) v.setPace(pace);
    },
    dusk(lit) {
      boom.dusk(lit);
    },
    seen(eye) {
      const at = view.drawn();
      const h = lastState?.heli;
      if (!at || !h || h.mode === "wreck") {
        view.inside(false, false);
        shelterOff();
        return;
      }
      const local = new THREE.Vector3(eye.x - at.x, eye.y - at.y, eye.z - at.z).applyQuaternion(
        new THREE.Quaternion().copy(at.q).invert(),
      );
      const pilot = bodyOf(COCKPIT.eye);
      const own = Math.hypot(local.x - pilot.x, local.y - pilot.y, local.z - pilot.z) < 0.05;
      const inside = inCabin(local);
      view.inside(inside, own);
      // No snow falls inside the cabin the lens is in (`shelter.ts`).
      if (inside) shelterAt(at, CABIN.centre, CABIN.half);
      else shelterOff();
    },
    drawn: () => view.drawn(),
    perch: createHeliPerch(),
    dispose() {
      home.dispose();
      for (const v of takenBy.values()) v.dispose();
      boom.dispose();
    },
  };
}
