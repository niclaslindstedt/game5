// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S MACHINES IN THE RENDERER — the helicopter on its pad
// (`heli-scene.ts`), the snowmobile at the bottom (`sled-scene.ts`) and the
// paramotor's wing over a skier begun under it (`para-scene.ts`), the hot
// air balloon a skier is begun in (`balloon-scene.ts`) and the
// piste machines working the runs after dark (`groomer-scene.ts`), held
// together so the renderer holds them by one hand: built per map with the
// rest of the world (only where a run's rules carry them), the player's
// figure seated on the skid or stood on the boards, each drawn every frame
// — the snowmobile's tracks stamped with the skiers' furrows and its roost
// thrown, the helicopter's wash blown — and the helicopter's lens while he
// rides it, flown onto it and off it.

import * as THREE from "three";
import { BALLOON, type GameState, type Level } from "@engine";

import type { Ladder } from "./camera.ts";
import type { SolidBox } from "./camera-clear.ts";
import type { LensPose, RigPose } from "./camera-rigs.ts";
import { ridingSled, sledRigPose, SLED_RIGS } from "./camera-sled.ts";
import { drivenGroomer, groomerRigPose, GROOMER_RIGS } from "./camera-groomer.ts";
import { createGroomerScene, type GroomerScene } from "./groomer-scene.ts";
import type { Flood } from "./headlamp.ts";
import type { HazeUniforms } from "./haze.ts";
import { createHeliScene, type HeliScene } from "./heli-scene.ts";
import { hangIn, PARA_RIGS, paraRigPose, underWing } from "./camera-para.ts";
import { createParaScene, type ParaScene } from "./para-scene.ts";
import { createBalloonScene, type BalloonScene } from "./balloon-scene.ts";
import { createBalloonLadder, inBasket } from "./camera-balloon.ts";
import type { CameraRung } from "./renderer-api.ts";
import type { SkyLook } from "./sky.ts";
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
  /** WHILE HE RIDES THE SNOWMOBILE (or drives a piste machine, hangs under
   * the paramotor's wing, stands in the balloon's basket), the ladder the
   * lens is framed on — its own rows (`camera-sled.ts`, `camera-groomer.ts`,
   * `camera-para.ts`, `camera-balloon.ts`), `pose` moved onto the machine as
   * drawn this frame (so call it after `frame`); otherwise nothing, the pose
   * left. */
  ladder(pose: RigPose, state: GameState): Ladder | undefined;
  /** THE BALLOON'S BURNER AND FIRE and THE PISTE MACHINES' LAMPS lit at
   * `lit` and seen from `eye`, ahead of `floods` — the list the lamp slots
   * are dealt from (`dealLamps`); the balloon's fire is sorted for `eye`
   * here, once the lens has settled. */
  lamps(lit: number, eye: THREE.Vector3, floods: readonly Flood[]): readonly Flood[];
  /** THE HOT AIR BALLOON as drawn (`balloon-scene.ts`), on a free ride —
   * what its burner's flame, its fire and its lens hang off. */
  balloon: BalloonScene | null;
  /** The sky's light on whatever the machines draw unlit (the wing's lines). */
  light(look: SkyLook): void;
  /** THE PISTE MACHINES AS SOLIDS to the lens (`camera-clear.ts`), where
   * they were drawn this frame. */
  solids(): readonly SolidBox[];
  /** Both machines' models in the group — what the renderer waits on
   * before it compiles the run's programs, so the rotor's smear and the
   * blades' fade are linked behind the loading card, not as he boards. */
  ready: Promise<void>;
  dispose(): void;
};

/** A whole stride in the basket (both boots), m, and the metres of stride
 * a radian of turning on the spot is worth. */
const STRIDE = 0.7;
const TURN_STEP = 0.25;

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
  // The paramotor rides every free ride's rules: drawn only while a run
  // carries the rig (`GameState.para`).
  const para: ParaScene | null = state.rules.heli ? createParaScene(haze) : null;
  // ...and the hot air balloon, drawn while a run carries one
  // (`GameState.balloon`).
  const balloon: BalloonScene | null = state.rules.heli ? createBalloonScene(haze) : null;
  if (heli) group.add(heli.group);
  if (para) group.add(para.group);
  if (balloon) group.add(balloon.group);
  // The balloon's own ladder while he stands in its basket.
  const basketLens = balloon ? createBalloonLadder() : null;
  let lastDt = 1 / 60;
  // His steps about the basket, as last seen (`seat`).
  const walk = { x: Number.NaN, z: Number.NaN, face: 0, strides: 0, pace: 0 };
  const groomers: GroomerScene | null = state.rules.groomer ? createGroomerScene(haze) : null;
  if (groomers) group.add(groomers.group);
  // The player's figure, hidden while he sits in a cab (`seat`, `frame`).
  let seated: SkisModel | null = null;
  let current: GameState = state;
  // How far into the flight the pilot's own cameras are (`hangIn`), 0..1.
  let hung = 0;
  const floods: Flood[] = [];
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
    balloon,
    ready: Promise.race([
      Promise.all([heli?.ready, sled?.ready, groomers?.ready]).then(() => undefined),
      new Promise<void>((done) => setTimeout(done, MODEL_WAIT)),
    ]),
    seat(model, s) {
      seated = model;
      model.setPerch(heli?.perch(s) ?? para?.perch(s) ?? null);
      model.setSled(sled ? sled.stand(s) : null);
      // In the balloon's basket his pair is racked in its corner, and he
      // steps as he walks about it (or turns where he stands).
      const b = s.balloon;
      if (b?.aboard) {
        const moved = Number.isNaN(walk.x)
          ? 0
          : Math.hypot(b.walkX - walk.x, b.walkZ - walk.z) +
            TURN_STEP *
              Math.abs(Math.atan2(Math.sin(b.face - walk.face), Math.cos(b.face - walk.face)));
        walk.x = b.walkX;
        walk.z = b.walkZ;
        walk.face = b.face;
        walk.strides += moved / STRIDE;
        const pace = Math.min(1, moved / Math.max(1e-3, lastDt) / BALLOON.walk.speed);
        walk.pace += (pace - walk.pace) * Math.min(1, lastDt * 10);
        model.setBasket(true, walk);
      } else {
        walk.x = Number.NaN;
        walk.pace = 0;
        model.setBasket(false);
      }
    },
    frame(s, alpha, dt, simDt, player, rung, flying, stamps) {
      sledFx.stamps = stamps;
      sled?.frame(s, alpha, dt, simDt, player, sledFx);
      heli?.frame(s, alpha, dt, player, rung, flying, fx.cloud, fx.snowAt);
      para?.frame(s, alpha);
      balloon?.frame(s, alpha, dt);
      hung = s.para?.flying ? hangIn(hung, dt) : 0;
      lastDt = dt;
      current = s;
      groomers?.frame(s, dt, stamps, fx.cloud);
      // In the cab he is out of sight: the machine is his figure now — and
      // back in sight the moment he is let down out of it.
      if (seated && groomers) seated.root.visible = !drivenGroomer(s);
    },
    light(look) {
      para?.light(look);
      balloon?.light(look);
    },
    lamps(lit, eye, others) {
      floods.length = 0;
      // The balloon's burner and its fire first: the nearest, brightest
      // light a skier in its basket has.
      balloon?.lamps(eye, floods);
      if (groomers && current.groomers) groomers.lamps(current, lit, eye, floods);
      if (floods.length === 0) return others;
      floods.push(...others);
      return floods;
    },
    lens(ladder, dt) {
      return heli?.lens(ladder, dt) ?? null;
    },
    ladder(pose, s) {
      pose.lift = null;
      const g = drivenGroomer(s);
      if (g) {
        groomerRigPose(pose, g, groomers?.drawn(g) ?? null);
        return GROOMER_RIGS;
      }
      if (balloon && basketLens && inBasket(s.balloon, !!s.skier.thrown)) {
        basketLens.pose(pose, s.balloon, balloon.at(), lastDt);
        return basketLens.rigs;
      }
      basketLens?.snap();
      if (para && underWing(s)) {
        paraRigPose(pose, para.wing(), hung);
        return PARA_RIGS;
      }
      if (!ridingSled(s.sled, !!s.skier.thrown)) return undefined;
      sledRigPose(pose, s.sled, sled?.drawn() ?? null, s.skier.spec.cogHeight);
      return SLED_RIGS;
    },
    solids: () => groomers?.solids() ?? [],
    dispose() {
      heli?.dispose();
      sled?.dispose();
      groomers?.dispose();
      para?.dispose();
      balloon?.dispose();
    },
  };
}
