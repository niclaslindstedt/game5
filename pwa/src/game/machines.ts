// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S MACHINES IN THE RENDERER — the helicopter on its pad
// (`heli-scene.ts`), the snowmobile at the bottom (`sled-scene.ts`) and the
// paramotor's wing over a skier begun under it (`para-scene.ts`), the hot
// air balloon a skier is begun in (`balloon-scene.ts`), the jump plane and
// the skydive out of its door (`plane-scene.ts`, `chute-scene.ts`) and the
// piste machines working the runs after dark (`groomer-scene.ts`), and the
// village's cars, ski bus and bicycles (`traffic-view.ts`) and every
// building's door (`doors-view.ts`), held
// together so the renderer holds them by one hand: built per map with the
// rest of the world (only where a run's rules carry them), the player's
// figure seated on the skid or stood on the boards, each drawn every frame
// — the snowmobile's tracks stamped with the skiers' furrows and its roost
// thrown, the helicopter's wash blown — and the helicopter's and the
// plane's lenses while he rides them, flown onto them and off them.

import * as THREE from "three";
import { planeBoxes, stripBoxes, type GameState, type Level, type StripBox } from "@engine";

import type { Ladder } from "./camera.ts";
import { heliHull, type SolidBox } from "./camera-clear.ts";
import type { LensPose, RigPose, Vec3 } from "./camera-rigs.ts";
import { ridingSled, sledRigPose, SLED_RIGS } from "./camera-sled.ts";
import { bikeRigPose, BIKE_RIGS, ridingBike } from "./camera-bike.ts";
import { animatedStyle } from "./bike-anim.ts";
import { bikeLook } from "./bike-variant.ts";
import { createBikeView, type BikeView } from "./bike-view.ts";
import { bikeStood, createRiderHold } from "./skier-bike.ts";
import { drivenGroomer, groomerRigPose, GROOMER_RIGS } from "./camera-groomer.ts";
import { createGroomerScene, type GroomerScene } from "./groomer-scene.ts";
import type { Flood } from "./headlamp.ts";
import type { HazeUniforms } from "./haze.ts";
import { createHeliScene, type HeliScene } from "./heli-scene.ts";
import {
  CHUTE_RIGS,
  hangIn,
  PARA_RIGS,
  paraRigPose,
  CHUTE_LIFT,
  underCanopy,
  underWing,
} from "./camera-para.ts";
import { createChuteScene, type ChuteScene } from "./chute-scene.ts";
import { rigWorn } from "./chute-rig-plan.ts";
import { createSkydiveCam, skydiveFramed, skydiveLens } from "./camera-skydive.ts";
import {
  createExitCut,
  exitBar,
  exitCraftOf,
  exitWingOf,
  exitHud,
  exitLens,
  exitOwnEyes,
} from "./camera-exit.ts";
import { colourwayOf, suitOf } from "./wingsuit-look.ts";
import { createWingsuitCam, flightWay, wingsuitFramed, wingsuitLens } from "./camera-wingsuit.ts";
import { createFlightPace } from "./camera-pace.ts";
import { createPlaneScene, type PlaneScene } from "./plane-scene.ts";
import { createParaScene, type ParaScene } from "./para-scene.ts";
import { lineLightOf, type LineLight } from "./para-motor.ts";
import type { Outfit } from "./outfit.ts";
import { createBasketWalk } from "./ride-perch.ts";
import { skydiveShapeOf } from "./skier-skydive.ts";
import { wingsuitShapeOf } from "./skier-wingsuit.ts";
import { createHoverScene, type HoverScene } from "./wingsuit-hover.ts";
import { createRescueSledsScene, type RescueSledsScene } from "./rescue-sleds-view.ts";
import type { Lying, Taken } from "./police-remains.ts";
import { createRescueScene, type RescueScene } from "./rescue-view.ts";
import { createPatrolView, patrolShown, type PatrolView } from "./patrol-view.ts";
import { createBalloonScene, type BalloonScene } from "./balloon-scene.ts";
import { burnShown } from "./burn-plan.ts";
import { createBurnView, type BurnView } from "./burn-view.ts";
import { createAvalancheView, type AvalancheView } from "./avalanche-view.ts";
import { createBalloonLadder, inBasket, keepOutOfBalloon } from "./camera-balloon.ts";
import type { CameraRung } from "./renderer-api.ts";
import type { SkyLook } from "./sky.ts";
import { createSledScene, type SledScene } from "./sled-scene.ts";
import { createSledFireView, type SledFireView } from "./sled-fire-view.ts";
import { createGunfireView, type GunfireView } from "./gunfire-view.ts";
import { createArmyAirView, type ArmyAirView } from "./army-air-view.ts";
import type { Blaze } from "./camera-blast.ts";
import { TOPSHEETS } from "./ski-topsheets.ts";
import { drawnAs } from "./ski-looks.ts";
import { createTrafficScene, type TrafficScene } from "./traffic-view.ts";
import { createDoorsView, type DoorsView } from "./doors-view.ts";
import { createStripView, type StripView } from "./strip-view.ts";
import type { ViewCull } from "./view-cull.ts";
import type { SkisModel } from "./skis-body.ts";
import type { SnowCloud } from "./snow-cloud.ts";
import type { Spray } from "./spray.ts";
import type { SnowSampler, Stamp } from "./trail-stamp.ts";

/** The level way out from a machine at `m` to the flyer at `at`. */
function awayFrom(m: { x: number; z: number } | null, at: Vec3): Vec3 | null {
  if (!m) return null;
  const x = at.x - m.x;
  const z = at.z - m.z;
  const n = Math.hypot(x, z);
  return n > 0.2 ? { x: x / n, y: 0, z: z / n } : null;
}

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
  /** THE POLICE'S CASUALTIES this frame (`police-remains.ts`), told where
   * the dead are left lying (`spots`), whom the call then draws not. */
  police(spots: readonly Lying[]): readonly Taken[];
  /** Whether his own figure is drawn under the lens `lens` handed back:
   * not while the skydive looks out of his own eyes. */
  figureShown(): boolean;
  /** THE FIRE'S HEAT, FLASH AND SMOKE over the picture this frame
   * (`sled-fire-view.ts`), or null — `planted` whether a planted lens has
   * the picture (none of it, unless the planted lens is the blast's own). */
  blaze(planted: boolean): Blaze | null;
  /** WHILE HE RIDES THE SNOWMOBILE (or drives a piste machine, hangs under
   * the paramotor's wing, stands in the balloon's basket), the ladder the
   * lens is framed on — its own rows (`camera-sled.ts`, `camera-groomer.ts`,
   * `camera-para.ts`, `camera-balloon.ts`), `pose` moved onto the machine as
   * drawn this frame (so call it after `frame`); otherwise nothing, the pose
   * left. `aspect`, the screen's width to its height, frames the balloon's
   * booms for a phone held upright (`camera-balloon.ts`'s `TALL`). */
  ladder(pose: RigPose, state: GameState, aspect?: number): Ladder | undefined;
  /** A FLOWN lens's `eye` put back out of the balloon's basket and
   * envelope as drawn this frame (`keepOutOfBalloon`), while one is. */
  keepOut(eye: Vec3): void;
  /** THE BALLOON'S BURNER AND FIRE and THE PISTE MACHINES' LAMPS lit at
   * `lit` and seen from `eye`, ahead of `floods` — the list the lamp slots
   * are dealt from (`dealLamps`); the balloon's fire is sorted for `eye`
   * here, once the lens has settled. The village's traffic is posed here
   * too, only what the environment's cull leaves in sight. */
  lamps(lit: number, eye: THREE.Vector3, floods: readonly Flood[]): readonly Flood[];
  /** THE HOT AIR BALLOON as drawn (`balloon-scene.ts`), on a free ride —
   * what its burner's flame, its fire and its lens hang off. */
  balloon: BalloonScene | null;
  /** The sky's light on whatever the machines draw unlit (the wing's lines). */
  light(look: SkyLook): void;
  /** THE PISTE MACHINES AS SOLIDS to the lens (`camera-clear.ts`), where
   * they were drawn this frame — and the airstrip's buildings and the jump
   * plane standing on the snow with nobody aboard. */
  solids(): readonly SolidBox[];
  /** THE AVALANCHE AS DRAWN (`avalanche-view.ts`): how far its bed and
   * debris stand the drawn snow off the engine's at (`x`, `z`), m — what a
   * skier on it is drawn on. */
  slideLift(x: number, z: number): number;
  /** Both machines' models in the group — what the renderer waits on
   * before it compiles the run's programs, so the rotor's smear and the
   * blades' fade are linked behind the loading card, not as he boards. */
  ready: Promise<void>;
  /** The pace the run is shown at, game seconds a wall second: slow
   * motion slows the eye on the rotors with it (`rotor-look.ts`). */
  setPace(pace: number): void;
  /** THE EXIT CUT's pace (`camera-exit.ts`): the run slowed for the leap out
   * of a craft's door, 1 otherwise. */
  exitPace(): number;
  /** These machines where `state` rides what they were built for
   * (`machinesKey`), else new ones built for it in their place, under the
   * same parent, these taken down. */
  refit(state: GameState): Machines;
  dispose(): void;
};

/** The longest the run's load waits on the machines' models, ms: a file that
 * never comes is linked when it does, rather than holding the card up. */
const MODEL_WAIT = 5000;

/** The snow the machines throw and read: the map's spray and snow cloud,
 * and what the snow is at a point. */
export type MachineSnow = {
  spray: Spray;
  cloud: SnowCloud;
  snowAt: SnowSampler;
  /** The player's outfit — the injured skier's on the next run's stretcher. */
  wearing?: () => Outfit;
};

/** WHAT THE MACHINES ARE BUILT FOR: everything `createMachines` reads off
 * the run it is built with to decide what it builds — the craft the rules
 * allow, the bike, the wingsuit and its colourway. A new run on the map
 * standing (the pause card's PISTE MAP, PLAY again) that differs here is
 * built anew (`refit`, `renderer.ts`): a wingsuit stood up on a world built for a
 * ride on skis would hang on its hover with no helicopter drawn under him. */
function machinesKey(state: GameState, wearing?: () => Outfit): string {
  const r = state.rules;
  const suit = state.wingsuit && wearing ? suitOf(wearing()) : null;
  return [r.heli, r.sled, r.groomer, !!state.bike, !!state.wingsuit, suit].join("|");
}

export function createMachines(
  level: Level,
  state: GameState,
  env: { haze: HazeUniforms; cull?: ViewCull },
  fx: MachineSnow,
): Machines {
  const haze = env.haze;
  const builtFor = machinesKey(state, fx.wearing);
  const group = new THREE.Group();
  group.name = "machines";
  const heli: HeliScene | null = state.rules.heli ? createHeliScene(level, haze) : null;
  const sled: SledScene | null = state.rules.sled ? createSledScene(haze) : null;
  // THE DOWNHILL BIKE (`bike-view.ts`), on a summer ride begun on it.
  const bike: BikeView | null = state.bike ? createBikeView(haze, bikeLook()) : null;
  if (bike) group.add(bike.group);
  // The paramotor rides every free ride's rules, drawn only while a run
  // carries the rig (`GameState.para`) — and the hot air balloon while a
  // run carries one (`GameState.balloon`). A run begun with neither never
  // builds them (their meshes, cloth and sixty-odd materials): each is
  // built for a run stood up with it, behind the loading card, or at the
  // first frame of one on a map already standing (`carried`).
  let para: ParaScene | null = null;
  let balloon: BalloonScene | null = null;
  const carried = (s: GameState): void => {
    if (!s.rules.heli) return;
    if (!para && s.para) {
      para = createParaScene(haze);
      group.add(para.group);
    }
    if (!balloon && s.balloon) {
      balloon = createBalloonScene(haze);
      group.add(balloon.group);
    }
  };
  // ...and the jump plane and the skydive out of its door, drawn while a
  // run carries them (`GameState.plane`, `.chute`).
  const plane: PlaneScene | null = state.rules.heli ? createPlaneScene(haze) : null;
  const chuteLight: LineLight = { value: new THREE.Color(1, 1, 1) };
  const chute: ChuteScene | null = state.rules.heli
    ? createChuteScene(
        haze,
        level,
        !!state.wingsuit,
        state.wingsuit && fx.wearing ? colourwayOf(suitOf(fx.wearing())) : null,
        chuteLight,
      )
    : null;
  // ...and a wingsuit's hover exit: the helicopter it steps off.
  const hover: HoverScene | null = state.wingsuit ? createHoverScene(level, haze) : null;
  if (hover) group.add(hover.group);
  if (plane) group.add(plane.group);
  if (chute) group.add(chute.group);
  // ...and the strip it flies from: its snow, markers, buildings and sock.
  const strip: StripView | null = state.rules.heli ? createStripView(level, haze) : null;
  if (strip) group.add(strip.group);
  // What stands there, as solids to the lens: the buildings, and the
  // plane on the snow with its wing.
  const stripSolids: readonly StripBox[] = strip ? stripBoxes(level) : [];
  const planeSolids: StripBox[] = [];
  // The skydive's own lens out of the door and through the opening.
  const skyCam = chute ? createSkydiveCam() : null;
  // ...and the leap out of a craft shot as a film shoots it, before that
  // (a wingsuit's exit is its own lens's, below).
  const exitCut = chute && !state.wingsuit ? createExitCut() : null;
  let exitEyes = false;
  // ...and a wingsuit's (`camera-wingsuit.ts`), its changes flown round him.
  const suitCam = chute && state.wingsuit ? createWingsuitCam() : null;
  // ...and the sense of speed both fold in (`camera-pace.ts`).
  const pace = chute ? createFlightPace() : null;
  let suitRung: CameraRung | null = null;
  let skyState: GameState | null = null;
  // Looking out of his own eyes (TIPS, HELMET): this frame's ask, and
  // whether the lens handed back was it.
  let ownEyes = false;
  let doorEyes = false;
  let ownLook = false;
  if (heli) group.add(heli.group);
  carried(state);
  // The balloon's own ladder while he stands in its basket.
  const basketLens = state.rules.heli ? createBalloonLadder() : null;
  let lastDt = 1 / 60;
  const hullBox: SolidBox = {
    x: 0,
    z: 0,
    dx: 0,
    dz: 1,
    halfLength: 0,
    halfWidth: 0,
    base: 0,
    top: 0,
  };
  let hull: SolidBox | null = null;
  // The screen's width to its height, as the last frame was framed for:
  // the cockpit's lens is widened on a tall one.
  let aspect = 16 / 9;
  // His steps about the basket, as last seen (`seat`).
  const walk = createBasketWalk();
  const groomers: GroomerScene | null = state.rules.groomer ? createGroomerScene(haze) : null;
  if (groomers) group.add(groomers.group);
  // THE VILLAGE'S TRAFFIC (`traffic-view.ts`), on every run whose map has
  // a village: drawn where the engine has it, from the lens (`lamps`).
  const traffic: TrafficScene | null = createTrafficScene(level, haze);
  if (traffic) group.add(traffic.group);
  // EVERY BUILDING'S DOOR (`doors-view.ts`), on every run whose map has a
  // building: swung where the engine has it.
  const doors: DoorsView | null = createDoorsView(level, haze);
  if (doors) group.add(doors.group);
  // The player's figure, hidden while he sits in a cab (`seat`, `frame`).
  let seated: SkisModel | null = null;
  // The bike's rider's body carried between steps (`holdRider`).
  const riderHold = createRiderHold();
  let current: GameState = state;
  // How far into the flight the pilot's own cameras are (`hangIn`), 0..1.
  let hung = 0;
  const floods: Flood[] = [];
  if (sled) {
    group.add(sled.group);
    // The rider's own pair on the rack, in its topsheet's colours, his
    // poles with it if he carries them — or his board.
    const top = TOPSHEETS[drawnAs(state.skier.spec)];
    const k = state.skier;
    sled.stowRack({ spec: k.spec, poles: k.poles, body: top.body, trim: top.trim });
  }
  // THE AIR AMBULANCE on the run after an injured one (`rescue-view.ts`),
  // built with the first run that carries its injuries — or a crowd it may
  // be called to mid-run, injuries on or off (`crowd-calls.ts`).
  let rescue: RescueScene | null = null;
  let rescueSleds: RescueSledsScene | null = null;
  // THE AVALANCHE (`avalanche-view.ts`), built with the run's first slab.
  let slide: AvalancheView | null = null;
  // THE SKI PATROL AND THE SEARCH (`patrol-view.ts`), built when the first
  // patrol skis in or the first body is struck.
  let patrol: PatrolView | null = null;
  // HIM ON FIRE (`burn-view.ts`), built the first time a run sets him alight.
  let burn: BurnView | null = null;
  // A SNOWMOBILE ON FIRE (`sled-fire-view.ts`), built the first time one catches.
  let sledFire: SledFireView | null = null;
  // THE ARMY'S GUNS (`gunfire-view.ts`), built the first time a gun is armed.
  let gunfire: GunfireView | null = null;
  // THE ARMY'S MACHINES (`army-air-view.ts`), built the first time one is out.
  let army: ArmyAirView | null = null;
  let armyPace = 1;
  let blastLensed = false;
  // What the snowmobile is handed a frame: the snow, and this frame's stamps.
  const sledFx: MachineSnow & { stamps: Stamp[] | null } = { ...fx, stamps: null };
  return {
    group,
    get balloon() {
      return balloon;
    },
    ready: Promise.race([
      Promise.all([heli?.ready, sled?.ready, groomers?.ready, plane?.ready, hover?.ready]).then(
        () => undefined,
      ),
      new Promise<void>((done) => setTimeout(done, MODEL_WAIT)),
    ]),
    seat(model, s) {
      carried(s);
      seated = model;
      model.setPerch(heli?.perch(s) ?? para?.perch(s) ?? null);
      model.setSled(sled ? sled.stand(s) : null);
      // ON THE BIKE (`skier-bike.ts`): on it in the attack stance, or
      // walking beside it — his skis and poles put away all ride long.
      const b = s.bike;
      if (b) {
        model.setBiking?.(true);
        const stood = bikeStood(
          s,
          riderHold,
          b.onIt && !s.skier.thrown && bikeLook() === "freeride"
            ? animatedStyle(b, s.level, s.t)
            : undefined,
        );
        model.setStood?.(stood?.pose ?? null, stood?.way);
      }
      // Out of the plane's door and under the canopy, every stage of the
      // jump is a shape of his limbs (`skier-skydive.ts`).
      // ...or in a WINGSUIT, no skis on: the flyer's own (`skier-wingsuit.ts`).
      const suit = !!s.wingsuit;
      model.setSkydive(chute && !suit ? skydiveShapeOf(s.chute ?? null, !!s.plane?.rider) : null);
      model.setWingsuit?.(
        suit
          ? wingsuitShapeOf(s.chute ?? null, !!s.plane?.rider, (s.wingsuit?.hover ?? 0) > 0)
          : null,
      );
      // In the balloon's basket his pair is racked in its corner, and he
      // steps as he walks about it (or turns where he stands).
      const walked = walk(s.balloon, lastDt);
      if (walked) model.setBasket(true, walked);
      else model.setBasket(false);
    },
    frame(s, alpha, dt, simDt, player, rung, flying, stamps) {
      carried(s);
      // The helicopter as a solid to the booms while nobody rides it.
      const h = s.heli;
      hull = h && !h.rider && h.mode !== "wreck" ? heliHull(h, hullBox) : null;
      sledFx.stamps = stamps;
      bike?.update(s, alpha, dt, player);
      sled?.frame(s, alpha, dt, simDt, player, sledFx, {
        shown: rung === "helmet" && ridingSled(s.sled, !!s.skier.thrown),
        outfit: fx.wearing?.(),
      });
      // In summer nothing lies loose to be blown up: no wash cloud, no puff.
      const cloud = s.summer ? null : fx.cloud;
      if (!sledFire && s.sled?.burn && !s.rules.sfw) {
        sledFire = createSledFireView();
        group.add(sledFire.group);
      }
      blastLensed = false;
      sledFire?.frame(
        s,
        dt,
        alpha,
        sled?.drawn() ?? null,
        rung === "tips" || rung === "helmet",
        (k, e) => sled?.char(k, e),
        cloud,
        fx.snowAt,
      );
      if (!gunfire && s.gunfire) {
        gunfire = createGunfireView();
        group.add(gunfire.group);
      }
      gunfire?.frame(s, alpha, dt, simDt, cloud, fx.snowAt, stamps);
      if (
        !army &&
        s.army &&
        (s.army.helis.some((h) => h.phase !== "due") ||
          s.army.troops.length > 0 ||
          s.army.sleds.length > 0 ||
          s.army.vehicles.length > 0)
      ) {
        army = createArmyAirView(haze);
        army.setPace(armyPace);
        group.add(army.group);
      }
      army?.frame(s, alpha, dt, simDt, stamps, cloud);
      heli?.frame(s, alpha, dt, player, rung, flying, cloud, fx.snowAt, aspect);
      para?.frame(s, alpha);
      plane?.frame(s, alpha, dt, rung, flying, aspect, cloud, fx.snowAt);
      chute?.frame(s, alpha, chute && rigWorn(s) ? seated?.skin() : null);
      hover?.frame(
        s,
        dt,
        (x, y, z, vx, vy, vz, size) => cloud?.blow(x, y, z, vx, vy, vz, size),
        (x, z) => fx.snowAt(x, z).loose,
      );
      const at = chute?.jumper();
      const thrown = s.skier.thrown !== null;
      const framed = !!chute && !!at && !!s.chute && skydiveFramed(s.chute, thrown);
      // In a wingsuit, its own lenses from the exit through the opening.
      const suited =
        !!suitCam &&
        !!at &&
        !!s.chute &&
        (wingsuitFramed(s.chute, s.wingsuit?.from, thrown) ||
          (framed && s.chute.mode === "deploying"));
      // In the plane's door HELMET is his own eyes too (`camera-plane.ts`).
      doorEyes = !!s.plane?.rider && rung === "helmet";
      let want: LensPose | null = null;
      if (suited && chute && at && s.chute && suitCam) {
        const opening = s.chute.mode === "deploying";
        const first = rung === "helmet" || (opening && rung === "tips");
        const lens = opening
          ? skydiveLens(rung, s.chute, at, chute.opening(), level.groundAt, chute.eyes(), aspect)
          : wingsuitLens(rung, s.chute, {
              at,
              v: { x: s.skier.vx, y: s.skier.vy, z: s.skier.vz },
              ground: level.groundAt,
              eyes: chute.eyes(),
              hover: (s.wingsuit?.hover ?? 0) > 0,
              away: awayFrom(hover?.at() ?? null, at),
              aspect,
            });
        const key = opening ? `${rung}:open` : rung;
        // A rung changed with nothing flying it (a lab's, a restart's) is cut.
        const cut = s !== skyState || (!flying && rung !== suitRung);
        want = suitCam.frame(key, first, at, lens, cut, dt);
        ownEyes = suitCam.inside();
      } else {
        if (framed && chute && at && s.chute)
          want = skydiveLens(
            rung,
            s.chute,
            at,
            chute.opening(),
            level.groundAt,
            chute.eyes(),
            aspect,
          );
        ownEyes = (framed && (rung === "tips" || rung === "helmet")) || doorEyes;
      }
      if (want && pace && at && s.chute) {
        const v = { x: s.skier.vx, y: s.skier.vy, z: s.skier.vz };
        want = pace.apply(
          want,
          {
            at,
            way: flightWay(s.chute.heading, v),
            speed: Math.hypot(v.x, v.y, v.z),
            bank: s.chute.wing?.bank ?? 0,
            worn: ownEyes || rung === "tips" || rung === "helmet",
          },
          dt,
          s !== skyState,
        );
      }
      suitRung = rung;
      ownLook = false;
      chute?.setOwnEyes(ownEyes);
      skyCam?.want(want, s !== skyState);
      skyState = s;
      // THE EXIT CUT: the craft he left as drawn, and the shot it wants.
      const cut = exitCut?.want(s.chute, s.skier.thrown !== null, rung) ?? null;
      const from = s.chute?.from;
      const pose =
        from === "plane"
          ? plane?.drawn()
          : from === "heli"
            ? heli?.drawn()
            : from === "balloon"
              ? balloon?.at()
              : null;
      const wing = from === "para" ? para?.wing() : null;
      const craft =
        !cut || !from
          ? null
          : wing
            ? exitWingOf(wing, s.chute?.heading ?? 0)
            : pose
              ? exitCraftOf(from, pose)
              : null;
      exitEyes = exitOwnEyes(cut?.shot ?? null, craft !== null);
      exitCut?.frame(
        cut && s.chute && at
          ? exitLens(
              cut.shot,
              cut.k,
              s.chute.since,
              s.chute,
              at,
              chute?.eyes() ?? null,
              craft,
              level.groundAt,
              aspect,
            )
          : null,
      );
      if (exitEyes) chute?.setOwnEyes(true);
      balloon?.frame(s, alpha, dt);
      hung = s.para?.flying ? hangIn(hung, dt) : 0;
      lastDt = dt;
      current = s;
      groomers?.frame(s, dt, stamps, fx.cloud);
      doors?.update(s);
      if ((s.gore || (s.crowd && s.rules.heli) || s.rescue?.length) && !rescue) {
        rescue = createRescueScene(level, haze);
        group.add(rescue.group);
      }
      if (rescue && fx.wearing) rescue.dress(fx.wearing());
      rescue?.frame(s, dt, fx.cloud, fx.snowAt);
      // THE SKI PATROL on snowmobiles where no machine could land
      // (`rescue-sleds-view.ts`), built with the air ambulance's.
      if ((s.gore || (s.crowd && s.rules.heli) || s.rescue?.length) && !rescueSleds) {
        rescueSleds = createRescueSledsScene(level, haze);
        group.add(rescueSleds.group);
      }
      if (rescueSleds && fx.wearing) rescueSleds.dress(fx.wearing());
      rescueSleds?.frame(s);
      if (s.avalanche?.slide && !slide) {
        slide = createAvalancheView(level, haze);
        group.add(slide.group);
      }
      slide?.frame(s, dt, simDt, fx.cloud);
      if (slide && !patrol && patrolShown(s.avalanche)) {
        patrol = createPatrolView(level, haze);
        group.add(patrol.group);
      }
      patrol?.frame(s, dt, slide ? slide.liftAt : () => 0);
      if (!burn && burnShown(s)) {
        burn = createBurnView(haze);
        group.add(burn.group);
      }
      burn?.frame(s, seated, simDt);
      // In the cab he is out of sight: the machine is his figure now — and
      // back in sight the moment he is let down out of it.
      if (seated && groomers) seated.root.visible = !drivenGroomer(s);
    },
    light(look) {
      para?.light(look);
      balloon?.light(look);
      burn?.light(look);
      if (chute) lineLightOf(look, chuteLight.value);
    },
    lamps(lit, eye, others) {
      // The eye settled for this frame: the helicopter's and the jump
      // plane's cockpits shown while it is in their cabins.
      heli?.seen(eye);
      heli?.dusk(lit);
      plane?.seen(eye);
      doors?.seen(eye);
      floods.length = 0;
      // The balloon's burner and its fire first: the nearest, brightest
      // light a skier in its basket has.
      balloon?.lamps(eye, floods);
      // ...and a skier alight, his own, and a snowmobile burning.
      burn?.lamps(lit, floods);
      sledFire?.lamps(lit, eye, floods);
      gunfire?.lamps(lit, eye, floods);
      army?.lamps(lit, eye);
      rescue?.lamps(lit, floods);
      rescueSleds?.lamps(lit, eye, floods);
      plane?.lamps(lit, floods);
      strip?.frame(current, lit, eye);
      strip?.lamps(lit, eye, floods);
      if (groomers && current.groomers) groomers.lamps(current, lit, eye, floods);
      traffic?.update(current, lit, eye, floods, env.cull);
      if (floods.length === 0) return others;
      floods.push(...others);
      return floods;
    },
    lens(ladder, dt) {
      // THE BLAST THROUGH HIS OWN EYES, over all of them while it holds.
      const blast = sledFire?.lens() ?? null;
      if (blast) {
        blastLensed = true;
        ownLook = true;
        return blast;
      }
      // Both asked every frame, so each hands its own lens in and out.
      const h = heli?.lens(ladder, dt) ?? null;
      const p = plane?.lens(ladder, dt) ?? null;
      // The skydive's flown in from whatever is on screen: the door's
      // lens holding him as he falls away, or the ladder.
      const c = skyCam?.lens(p ?? ladder, dt) ?? null;
      ownLook = !h && ((c !== null && ownEyes) || (c === null && p !== null && doorEyes));
      // The exit cut over all of them, flown back out to whichever is next.
      const x = exitCut?.lens(h ?? c ?? p ?? ladder, dt) ?? null;
      if (exitCut) exitHud(exitBar(aspect, exitCut.share()));
      if (x) ownLook = exitEyes;
      return x ?? h ?? c ?? p;
    },
    police: (spots) => rescue?.police(spots) ?? [],
    figureShown: () => !ownLook,
    blaze: (planted) => sledFire?.blaze(!planted || blastLensed) ?? null,
    ladder(pose, s, screen = 16 / 9) {
      aspect = screen;
      pose.lift = null;
      // The ground under him shaking as a slide runs near (`camera-rigs.ts`).
      pose.quake = slide && !s.skier.thrown ? slide.quake(pose.x, pose.z) : 0;
      const g = drivenGroomer(s);
      if (g) {
        groomerRigPose(pose, g, groomers?.drawn(g) ?? null);
        return GROOMER_RIGS;
      }
      if (balloon && basketLens && inBasket(s.balloon, !!s.skier.thrown)) {
        basketLens.fit(aspect);
        basketLens.pose(pose, s.balloon, balloon.at(), lastDt);
        return basketLens.rigs;
      }
      basketLens?.snap();
      if (para && underWing(s)) {
        paraRigPose(pose, para.wing(), hung);
        return PARA_RIGS;
      }
      if (chute && underCanopy(s)) {
        paraRigPose(pose, chute.canopy(), 1, CHUTE_LIFT);
        return CHUTE_RIGS;
      }
      if (bike && ridingBike(s.bike, !!s.skier.thrown)) {
        bikeRigPose(pose, s.bike, bike.drawn());
        return BIKE_RIGS;
      }
      if (!ridingSled(s.sled, !!s.skier.thrown)) return undefined;
      sledRigPose(pose, s.sled, sled?.drawn() ?? null, s.skier.spec.cogHeight);
      return SLED_RIGS;
    },
    keepOut(eye) {
      const at = balloon?.at();
      if (at) keepOutOfBalloon(eye, at);
    },
    solids: () => {
      const g = groomers?.solids() ?? [];
      const t = traffic?.solids() ?? [];
      const all = t.length === 0 ? g : g.length === 0 ? t : [...g, ...t];
      // ...never while he rides it: the lens is in it with him.
      if (current.plane && !current.plane.rider) planeBoxes(current.plane, planeSolids, true);
      else planeSolids.length = 0;
      const more = stripSolids.length + planeSolids.length > 0;
      const out = more ? [...all, ...stripSolids, ...planeSolids] : all;
      const over = hover?.hull();
      const withHull = hull ? [...out, hull] : out;
      return over ? [...withHull, over] : withHull;
    },
    setPace(next) {
      armyPace = next;
      army?.setPace(next);
      heli?.setPace(next);
      hover?.setPace(next);
    },
    slideLift: (x, z) => slide?.liftAt(x, z) ?? 0,
    exitPace: () => exitCut?.pace() ?? 1,
    refit(s) {
      if (machinesKey(s, fx.wearing) === builtFor) return this;
      const parent = group.parent;
      group.removeFromParent();
      this.dispose();
      const made = createMachines(level, s, env, fx);
      parent?.add(made.group);
      return made;
    },
    dispose() {
      if (exitCut) exitHud(0);
      haze.uMistAloft.value = 0;
      heli?.dispose();
      sled?.dispose();
      bike?.dispose();
      groomers?.dispose();
      traffic?.dispose();
      doors?.dispose();
      para?.dispose();
      plane?.dispose();
      chute?.dispose();
      strip?.dispose();
      balloon?.dispose();
      rescue?.dispose();
      rescueSleds?.dispose();
      hover?.dispose();
      slide?.dispose();
      patrol?.dispose();
      burn?.dispose();
      sledFire?.dispose();
      gunfire?.dispose();
      army?.dispose();
    },
  };
}
