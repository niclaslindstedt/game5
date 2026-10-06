// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S MACHINES IN THE RENDERER — the helicopter on its pad
// (`heli-scene.ts`) and the snowmobile at the bottom (`sled-scene.ts`), held
// together so the renderer holds them by one hand: built per map with the
// rest of the world (only where a run's rules carry them), the player's
// figure seated on the skid or stood on the boards, each drawn every frame
// — the snowmobile's tracks stamped with the skiers' furrows and its roost
// thrown, the helicopter's wash blown — and the helicopter's lens while he
// rides it, flown onto it and off it.

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import type { Ladder } from "./camera.ts";
import type { LensPose, RigPose } from "./camera-rigs.ts";
import { ridingSled, sledRigPose, SLED_RIGS } from "./camera-sled.ts";
import type { HazeUniforms } from "./haze.ts";
import { createHeliScene, type HeliScene } from "./heli-scene.ts";
import type { CameraRung } from "./renderer-api.ts";
import { createSledScene, type SledScene } from "./sled-scene.ts";
import { TOPSHEETS } from "./ski-topsheets.ts";
import type { SkisModel } from "./skis-body.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import type { Spray } from "./spray.ts";
import type { SnowSampler, Stamp } from "./trail-stamp.ts";

export type Machines = {
  group: THREE.Group;
  /** Seat the player's figure on whichever he rides, or neither. */
  seat(model: SkisModel, state: GameState): void;
  /** One frame of both: the snowmobile drawn with its tracks (into
   * `stamps`, when the trails are drawn) and its roost, the helicopter
   * drawn and the lens it wants on `rung` worked out — a change of rung
   * flown while `flying`, as the skier's ladder flies it, else cut. */
  frame(
    state: GameState,
    alpha: number,
    dt: number,
    simDt: number,
    player: { x: number; z: number },
    rung: CameraRung,
    flying: boolean,
    stamps: Stamp[] | null,
  ): void;
  /** THE HELICOPTER'S LENS, flown in from the skier's `ladder` and back
   * out to it (`heli-scene.ts`), or null while the ladder has it whole. */
  lens(ladder: LensPose, dt: number): LensPose | null;
  /** WHILE HE RIDES THE SNOWMOBILE, the ladder the lens is framed on —
   * its own rows (`camera-sled.ts`), `pose` moved onto the machine as drawn
   * this frame (so call it after `frame`); otherwise nothing, the pose left. */
  ladder(pose: RigPose, state: GameState): Ladder | undefined;
  /** Both machines' models in the group — what the renderer waits on
   * before it compiles the run's programs, so the rotor's smear and the
   * blades' fade are linked behind the loading card, not as he boards. */
  ready: Promise<void>;
  dispose(): void;
};

/** The longest the run's load waits on the machines' models, ms: a file that
 * never comes is linked when it does, rather than holding the card up. */
const MODEL_WAIT = 5000;

/** The snow the machines throw and read: the map's spray and snow cloud,
 * and what the snow is at a point. */
export type MachineSnow = { spray: Spray; cloud: SnowCloud; snowAt: SnowSampler };

export function createMachines(
  level: Level,
  state: GameState,
  haze: HazeUniforms,
  fx: MachineSnow,
): Machines {
  const group = new THREE.Group();
  group.name = "machines";
  const heli: HeliScene | null = state.rules.heli ? createHeliScene(level, haze) : null;
  const sled: SledScene | null = state.rules.sled ? createSledScene(haze) : null;
  if (heli) group.add(heli.group);
  if (sled) {
    group.add(sled.group);
    // The rider's own pair on the rack, in its topsheet's colours.
    const top = TOPSHEETS[state.skier.spec.id];
    sled.dressRack(top.body, top.trim);
  }
  // What the snowmobile is handed a frame: the snow, and this frame's stamps.
  const sledFx: MachineSnow & { stamps: Stamp[] | null } = { ...fx, stamps: null };
  return {
    group,
    ready: Promise.race([
      Promise.all([heli?.ready, sled?.ready]).then(() => undefined),
      new Promise<void>((done) => setTimeout(done, MODEL_WAIT)),
    ]),
    seat(model, s) {
      model.setPerch(heli ? heli.perch(s) : null);
      model.setSled(sled ? sled.stand(s) : null);
    },
    frame(s, alpha, dt, simDt, player, rung, flying, stamps) {
      sledFx.stamps = stamps;
      sled?.frame(s, alpha, dt, simDt, player, sledFx);
      heli?.frame(s, alpha, dt, player, rung, flying, fx.cloud, fx.snowAt);
    },
    lens(ladder, dt) {
      return heli?.lens(ladder, dt) ?? null;
    },
    ladder(pose, s) {
      if (!ridingSled(s.sled, !!s.skier.thrown)) return undefined;
      sledRigPose(pose, s.sled, sled?.drawn() ?? null, s.skier.spec.cogHeight);
      return SLED_RIGS;
    },
    dispose() {
      heli?.dispose();
      sled?.dispose();
    },
  };
}
