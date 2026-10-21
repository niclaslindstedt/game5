// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTER AS HE FLIES IT — the machine he took from the army
// (`army-steal.ts`, `HeliState.livery` "army") drawn as the run's own
// helicopter is (`heli-scene.ts` holds it by the `HeliView` hand): the
// army's model (`army-heli-view.ts`) posed where the engine flies it, eased
// between steps on the rider's own line (`interp.ts`), its rotors spooled
// with the engine's, its doors shut and its guns stowed — and its FLIGHT
// DECK (`army-heli-cockpit.ts`) built inside it when the model arrives,
// shown while the eye is in it. Its wash is the light helicopter's own
// (`blow`, handed in), the same air under the same rotor's thrust.
//
// Built with the world on a ride that carries the army, so the model is in
// and the deck's programs linked behind the loading card. When it goes down
// the airframe is put away: the scene's fireball and fire stand where it
// was (`heli-scene.ts`). Presentation only.

import * as THREE from "three";
import { heliQuat, type GameState, type Level } from "@engine";

import { ARMY_NODES } from "./army-heli-plan.ts";
import { createArmyDeck, type ArmyDeck } from "./army-heli-cockpit.ts";
import { createArmyHeliView, type ArmyHeliPose } from "./army-heli-view.ts";
import type { HazeUniforms } from "./haze.ts";
import type { HeliView } from "./heli-view.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";

export function createArmyHeliRide(
  level: Level,
  haze: HazeUniforms,
  blow: HeliView["blow"],
): HeliView {
  const view = createArmyHeliView(haze);
  const group = new THREE.Group();
  group.name = "army-helicopter-ride";
  group.add(view.group);
  let deck: ArmyDeck | null = null;
  let disposed = false;
  const ready = view.ready.then(() => {
    if (disposed) return;
    let model: THREE.Object3D | null = null;
    view.body.traverse((o) => {
      if (o.name === ARMY_NODES.body) model = o;
    });
    view.body.updateMatrixWorld(true);
    const back = view.body.matrixWorld.clone().invert();
    deck = createArmyDeck(model, (mesh) => back.clone().multiply(mesh.matrixWorld), haze);
    view.body.add(deck.group);
  });

  const track = createTrack();
  const at: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const pose: ArmyHeliPose = {
    x: 0,
    y: 0,
    z: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    spool: 0,
    doors: { r: 0, l: 0 },
    guns: { r: { yaw: 0, pitch: -0.3 }, l: { yaw: 0, pitch: -0.3 } },
  };
  const q = new THREE.Quaternion();
  const vel = new THREE.Vector3();
  let shown: { x: number; y: number; z: number; heading: number; q: THREE.Quaternion } | null =
    null;
  return {
    group,
    update(state: GameState, alpha, dt) {
      const h = state.heli;
      group.visible = !!h;
      if (!h) return;
      const wreck = h.mode === "wreck";
      view.group.visible = !wreck;
      if (wreck) {
        shown = null;
        track.tick = -1;
        return;
      }
      observe(track, { x: h.x, y: h.y, z: h.z, q: heliQuat(h) }, state.tick);
      sample(track, alpha, at);
      pose.x = at.x;
      pose.y = at.y;
      pose.z = at.z;
      pose.q = at.q;
      pose.spool = h.spool;
      view.pose(pose, dt);
      vel.set(h.vx, h.vy, h.vz);
      q.set(at.q.x, at.q.y, at.q.z, at.q.w);
      shown = { x: at.x, y: at.y, z: at.z, heading: h.heading, q };
      deck?.update(h, level, state.t, dt);
    },
    setPace: (p) => view.setPace(p),
    drawn: () => shown,
    way: () => vel,
    inside(on, pilotEye) {
      deck?.show(on, pilotEye);
    },
    setAway() {},
    blow,
    ready,
    dispose() {
      disposed = true;
      deck?.dispose();
      view.dispose();
    },
  };
}
