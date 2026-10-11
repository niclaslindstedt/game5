// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD RENDERER — the one thing `renderer-api.ts` promises the shell,
// built here out of the modules that each own a part of the picture:
//
//   environment.ts  the sun, the sky's light, the dome and the haze
//   terrain.ts      the ground: a clipmap round the lens, shaded as snow
//   trail-map.ts    every furrow any skier has cut, lowering that snow
//   forest.ts       the snow-loaded conifers, two bands and their casters
//   gates.ts        the gates and flex poles, the start, the arena, the edge poles
//   lifts.ts        the resort's lifts, its wind tunnels and its cabins (cabins-view.ts)
//   skis-body.ts    the four pairs of skis and their skiers
//   spray.ts        the skis' sheet and wall; snow-cloud.ts, the fine powder
//   machines.ts     the free ride's helicopter, snowmobile and piste machines
//   snowfall.ts     the snow falling round the lens, the spindrift
//   ghost-model.ts  a ghost, see-through and trail-less (no mode keeps one now)
//   wildlife.ts     the birds over the woods, the animals and their prints
//   spectators.ts   the free ride's amateurs, and a race's crowd watching
//   camera.ts      the ladder of lenses; camera-start.ts, a slalom's start
//
// WHAT IT COSTS is the picture it is handed (`settings-video.ts`): `setVideo`
// is the one place a row of OPTIONS ▸ PICTURE becomes a draw call.
//
// It READS `GameState` and never writes it. Everything that depends on the
// map is built in `load`; `draw` only moves things. Every skier — the player
// and each rival — is drawn at `alpha` of a step on from the step before
// (`interp.ts`), since the engine keeps no previous pose of its own.

import * as THREE from "three";
import {
  SKIS,
  TUNING,
  sunAtRun,
  totalMass,
  weatherOf,
  windAt,
  windFromOf,
  withSky,
  type FreeRider,
  type GameState,
  type Level,
  type Rival,
  type SkiSpec,
  type SkierState,
  type SkyOverride,
  type Wind,
} from "@engine";

import { noCost, type GpuSlice, type Hideable } from "./benchmark-report.ts";
import { aimLens, createLens, lensRay, type Lens } from "./camera.ts";
import { createLineClear, createTrunksNear } from "./camera-clear.ts";
import { figureShown } from "./camera-para.ts";
import { createReplayCamera, type ReplayView } from "./camera-replay.ts";
import { freshRigPose, type LensPose, type LineClear, type RigPose } from "./camera-rigs.ts";
import { byMaterial, depthByKind } from "./shadow-depth.ts";
import { createEnvironment, type Environment } from "./environment.ts";
import { createForest, type Forest, type ForestOptions } from "./forest.ts";
import { createHurtLens } from "./xray-scene.ts";
import { frameStart, startMoment } from "./camera-start.ts";
import { createGates, type Gates } from "./gates.ts";
import { createGoreView, type GoreView } from "./gore-view.ts";
import { createLifts, type Lifts, type SeatedRider } from "./lifts.ts";
import { createThrownLens, subjectPose } from "./camera-subject.ts";
import { summitShare } from "./camera-summit.ts";
import { createRideMemory, liftCut, stepRideLook } from "./camera-lift.ts";
import { createGazeRig } from "./lift-gaze.ts";
import { createGhostModel, type GhostModel } from "./ghost-model.ts";
import { createMachines, type Machines } from "./machines.ts";
import { createGpuTimer, type GpuTimer } from "./gpu-timer.ts";
import { hazeMaterial, setRunSnow } from "./haze.ts";
import { dealLamps } from "./headlamp.ts";
import { createHeroShadow } from "./hero-shadow.ts";
import {
  createBodyTrack,
  createTrack,
  observe,
  observeBody,
  sample,
  sampleBody,
} from "./interp.ts";
import { createRegionPicture } from "./region-picture.ts";
import { createAfterskiView } from "./afterski-view.ts";
import { runsOf, SLICE_OF_GROUP, type Rider } from "./renderer-rider.ts";
import type { CameraRung, DevRenderer, WorldRenderer } from "./renderer-api.ts";
import { createSkisModel, pairStyle, SLOT_DRESS, type SkisModel } from "./skis-body.ts";
import type { SkierDress } from "./skier-dress.ts";
import { inStartGate } from "./skier-spring.ts";
import { outfitKey } from "./dress.ts";
import { DEFAULT_OUTFIT, dealtOutfit, type Outfit } from "./outfit.ts";
import { skyLookAt } from "./sky.ts";
import { createSnowfall } from "./snowfall.ts";
import { LOOSE } from "./snow-glsl.ts";
import { castInLight } from "./terrain-shade.ts";
import { createSpray, type Spray } from "./spray.ts";
import { createSnowCloud, type SnowCloud } from "./snow-cloud.ts";
import {
  NEW_COVER,
  SNOW,
  snowAt,
  snowpackOf,
  type SnowKind,
  type Snowpack,
  type SnowProps,
} from "./snowpack.ts";
import {
  DEFAULT_VIDEO,
  DISTANCE_LOOK,
  FOREST_LOOK,
  RESOLUTION_SHARE,
  SHADOW_LOOK,
  SPRAY_SHARE,
  TRAIL_LOOK,
  terrainLook,
  type ShadowLook,
  type VideoSettings,
} from "./settings-video.ts";
import { tallyScene } from "./scene-tally.ts";
import { createTerrain, type Terrain } from "./terrain.ts";
import { createTrailMap, type TrailMap } from "./trail-map.ts";
import { createTrailOverlay } from "./trail-overlay.ts";
import { createWildlife, type Wildlife } from "./wildlife.ts";
import { createPeopleView, type CrowdView } from "./spectators.ts";
import { loadModels as loadSkierModels } from "./skier-models.ts";
import { bodyStampOf, createPen, drawnDepth, stampsOf, type Stamp } from "./trail-stamp.ts";

// The modelled skis and skiers, fetched before the kit is handed out
// (`use-render-kit.ts`), when this build draws them; the rest is code.
export async function loadModels(): Promise<void> {
  await loadSkierModels();
}

export type RendererOptions = {
  /** The picture to open on (`settings-video.ts`); `setVideo` moves it. Its
   * ANTIALIAS row is read here and only here — a canvas's multisampling is
   * fixed when its context is made. */
  video?: VideoSettings;
  /** Keep the last frame in the canvas after it is shown (a lab that reads
   * the pixels back). */
  preserveDrawingBuffer?: boolean;
};

/** What the renderer can say about its own last frame. */
export type FrameInfo = { calls: number; triangles: number; points: number };

/** The seam, plus what a lab, the developer page and the benchmark may also
 * ask. */
export type WorldRendererExt = WorldRenderer &
  DevRenderer & {
    /** Change rung; `cut` skips the flown hand-over. */
    setCamera(rung: CameraRung, cut?: boolean): void;
    /** `present` false does everything a frame does — the trails stamped,
     * the spray flown, the lens moved — except draw the picture: how a lab
     * fast-forwards a run without losing the furrows it cut. */
    draw(state: GameState, alpha: number, dt: number, present?: boolean): void;
    info(): FrameInfo;
    /** Ride the map under another sky, or from another hour, without loading
     * it again (`withSky`) — a lab's sheet; null hands it back to the map's. */
    setSky(sky: SkyOverride | null): void;
    /** Resolves once the mountain's shadow under the sky last drawn is. */
    shadeSettled(): Promise<void>;
    /** Lay ONE kind of snow over the whole map for the picture — the
     * cloud, the spray, the furrows and the prints (`snowpack.ts`) — or
     * null for the map's own: a lab's sheet. */
    setSnow(kind: SnowKind | null): void;
    /** The three.js renderer, for a lab that needs to read pixels. */
    readonly gl: THREE.WebGLRenderer;
  };

const NEAR = 0.1;
const FAR = 6000;
/** The cloud layer's height over the lens, m: the wind carries the dome's
 * cloud this many metres for one unit of its plane. */
const CLOUD_HEIGHT = 1400;
/** How much of the player's own snow cloud the chase lens sees between
 * itself and him (`snow-cloud.ts`'s veil). */
const CLOUD_VEIL = 0.12;
/** A RIVAL nearer the lens's eye than this share of the eye's reach to the
 * player is not drawn that frame where the lens TRAILS him: the field
 * bunched behind puts one in the boom's own spot, his helmet filling the
 * picture. A lens circling him or planted by the piste sees the field ski
 * PAST in plain view, so it drops only one within `LENS_TOUCH` m of it. */
const LENS_CROWD = 0.55;
const LENS_TOUCH = 1.5;

export function createWorldRenderer(
  canvas: HTMLCanvasElement,
  options: RendererOptions = {},
): WorldRendererExt {
  let video: VideoSettings = { ...(options.video ?? DEFAULT_VIDEO) };
  const gl = new THREE.WebGLRenderer({
    canvas,
    antialias: video.antialias,
    powerPreference: "high-performance",
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.05;
  gl.shadowMap.enabled = SHADOW_LOOK[video.shadows].size > 0;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.setOpaqueSort(byMaterial);

  /** The SHADOWS row's stop, its map no bigger than this GPU can hold. */
  const shadowLook = (): ShadowLook => {
    const look = SHADOW_LOOK[video.shadows];
    const most = gl.capabilities.maxTextureSize;
    return { ...look, size: Math.min(look.size, most), hero: Math.min(look.hero, most) };
  };

  const scene = new THREE.Scene();
  // THE REGION'S GRADE (R21, `region-picture.ts`): the frame through it or straight on.
  const picture = createRegionPicture(gl, video.antialias ? 4 : 0);
  const afterski = createAfterskiView(picture);
  const lens: Lens = createLens(NEAR, FAR, (eye) => machines?.keepOut(eye));
  scene.add(lens.camera);
  /** THE REPLAY'S LENSES (`camera-replay.ts`), or null for the ladder's own rung. */
  const replayCam = createReplayCamera(() => (level && clear ? { level, clear } : null));
  let watched: ReplayView | null = null;
  const env: Environment = createEnvironment(scene, shadowLook(), FAR * 0.9);
  env.setDistance(video.distance);
  /** Under SHADOWS HIGH every skier casts into a map of his own. */
  const hero = createHeroShadow(env.haze, shadowLook().hero);
  const heroModels: SkisModel[] = [];
  /** The other skiers sat on chairs this frame (`lifts.ts`). */
  const seated: SeatedRider[] = [];
  const wrap = <M extends THREE.Material>(m: M, name: string): M => hazeMaterial(m, env.haze, name);
  const snowfall = createSnowfall(env.haze);
  snowfall.setBudget(SPRAY_SHARE[video.spray]);
  snowfall.group.name = "snowfall";
  scene.add(snowfall.group);
  let skyOverride: SkyOverride | null = null;
  let skyLevel: Level | null = null;
  const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

  let level: Level | null = null;
  let terrain: Terrain | null = null;
  let forest: Forest | null = null;
  let gates: Gates | null = null;
  let lifts: Lifts | null = null;
  let trail: TrailMap | null = null;
  let spray: Spray | null = null;
  let cloud: SnowCloud | null = null;
  /** His body torn apart (`gore-view.ts`), built on the first run that deals it. */
  let gore: GoreView | null = null;
  /** WHAT SNOW LIES WHERE for this run (`snowpack.ts`), a lab's forced
   * kind, and the samples every reader takes of it — each read at once. */
  let pack: Snowpack | null = null;
  let snowForce: SnowKind | null = null;
  const sampled: SnowProps = { ...SNOW.soft };
  const skierSnow: SnowProps = { ...SNOW.soft };
  const sampleSnow = (x: number, z: number): SnowProps =>
    pack ? snowAt(pack, x, z, sampled) : SNOW.soft;
  let wildlife: Wildlife | null = null;
  let crowd: CrowdView | null = null;
  let machines: Machines | null = null;
  let clear: LineClear | undefined;
  /** The ridden booms' clear: the course's marks, never the trees — they
   * are pushed off the trunks instead (`trunks`, `camera-rigs.ts`). */
  let boomClear: LineClear | undefined;
  let trunks: ReturnType<typeof createTrunksNear> | undefined;
  let riders: Rider[] = [];
  let ghost: GhostModel | null = null;
  let ghostRun: GameState | null = null;
  const stamps: Stamp[] = [];
  let lastTick = -1;
  let lastState: GameState | null = null;
  /** The new snow the trail maps have been filled by, m (`trail.fill`). */
  let filled = 0;
  let override: LensPose | null = null;
  /** THE DEATH CAM and THE X-RAY CAM (`xray-scene.ts`), and his skeleton. */
  const hurt = createHurtLens();
  let pace = 1; // game seconds a wall second (`setPace`)
  scene.add(hurt.group);
  /** The box the canvas was last given, so a RESOLUTION press can re-apply
   * it at the new share. */
  let box = { width: 1, height: 1, pixelRatio: 1 };
  /** The one pixel `drain` reads back. */
  const drained = new Uint8Array(4);
  /** What the last frame cost (`DevRenderer.cost`), rewritten every frame. */
  const cost = noCost();
  const overlay = createTrailOverlay();
  let overlayOn = false;
  /** THE GPU'S TIMER and the A/B reading's hidden subsystems — instruments,
   * both off unless the benchmark asks (`bench-run.ts`). */
  const ctx = gl.getContext() as WebGL2RenderingContext;
  let timer: GpuTimer = createGpuTimer(ctx, "off");
  let hidden: ReadonlySet<Hideable> = new Set();
  let hiddenTag = "";
  const hid: THREE.Object3D[] = [];
  const sliceOf = new WeakMap<THREE.Object3D, GpuSlice>();
  const bucket = (object: THREE.Object3D): GpuSlice => {
    let slice = sliceOf.get(object);
    if (slice !== undefined) return slice;
    slice = "scene";
    for (let o: THREE.Object3D | null = object; o; o = o.parent) {
      const named = SLICE_OF_GROUP[o.name];
      if (named !== undefined) {
        slice = named;
        break;
      }
    }
    sliceOf.set(object, slice);
    return slice;
  };
  // SPLIT cuts the scene's pass wherever its draw calls pass from one
  // subsystem to the next; the sun's map is a slice of its own either way.
  const direct = gl.renderBufferDirect.bind(gl);
  gl.renderBufferDirect = (camera, sc, geometry, material, object, group) => {
    if (timer.mode === "split" && timer.inScene()) timer.enter(bucket(object));
    direct(camera, sc, geometry, material, object, group);
  };
  const shadowPass = depthByKind(gl.shadowMap.render.bind(gl.shadowMap));
  gl.shadowMap.render = (lights, sc, camera) => {
    const map = gl.shadowMap;
    const live =
      timer.mode !== "off" &&
      map.enabled &&
      (map.autoUpdate || map.needsUpdate) &&
      lights.length > 0;
    if (live) timer.push("shadow");
    shadowPass(lights, sc, camera);
    if (live) timer.pop();
  };
  const lensDir = new THREE.Vector3();
  const rigPose: RigPose = freshRigPose();
  const rideMem = createRideMemory();
  const thrownLens = createThrownLens();
  const gaze = createGazeRig(); // looking round from the lift (`lift-gaze.ts`)
  const nominalLoad = (totalMass(SKIS) * 9.81) / 6;

  function unload() {
    terrain?.dispose();
    forest?.dispose();
    gates?.dispose();
    lifts?.dispose();
    trail?.dispose();
    spray?.dispose();
    cloud?.dispose();
    wildlife?.dispose();
    crowd?.dispose();
    machines?.dispose();
    gore?.dispose();
    for (const r of riders) r.model.dispose();
    for (const o of [
      terrain?.group,
      forest?.group,
      gates?.group,
      gates?.water?.group,
      lifts?.group,
      spray?.points,
      cloud?.mesh,
      wildlife?.group,
      crowd?.group,
      machines?.group,
      gore?.group,
    ]) {
      if (o) scene.remove(o);
    }
    for (const r of riders) scene.remove(r.model.root);
    ghost?.dispose();
    ghost = null;
    terrain = forest = gates = lifts = trail = spray = null;
    cloud = machines = gore = null;
    pack = null;
    wildlife = crowd = null;
    clear = undefined;
    boomClear = undefined;
    trunks = undefined;
    riders = [];
    level = null;
    skyLevel = null;
    void env.setGround(null, null);
    snowfall.clear();
  }

  const breathe = () => new Promise<void>((done) => setTimeout(done, 0));
  /** Loads begun: one superseded stops at its next breath, adding nothing. */
  let loads = 0;

  /** The trail maps and the ground that reads them, built for the picture in
   * force. One step, because the ground's shader holds the maps' uniforms by
   * reference: new maps are a new ground. */
  function buildTrail(lv: Level): TrailMap {
    const map = createTrailMap(lv.size, TRAIL_LOOK[video.trails]);
    map.clear(gl);
    return map;
  }
  function buildTerrain(lv: Level, map: TrailMap): Terrain {
    const look = terrainLook(video.terrain, DISTANCE_LOOK[video.distance].view);
    const ground = createTerrain(lv, env.haze, map.uniforms, look);
    ground.group.name = "terrain";
    scene.add(ground.group);
    return ground;
  }
  const forestOptions = (): ForestOptions => ({
    ...FOREST_LOOK[video.forest],
    far: DISTANCE_LOOK[video.distance].trees,
    view: DISTANCE_LOOK[video.distance].view,
    casters: SHADOW_LOOK[video.shadows].trees ? FOREST_LOOK[video.forest].casters : "none",
  });

  /** The player's outfit: slot 0 wears it, the field its slots' own. */
  let outfit: Outfit = DEFAULT_OUTFIT;
  const wearing = (): Outfit => outfit;
  /** The run's rivals, read for an enthusiast's own kit. */
  let field: readonly Rival[] = [];
  const dealtKits = new Map<string, SkierDress>();
  /** An enthusiast's kit, dealt off his look (`dealtOutfit`), kept. */
  const kitOfFree = (free: FreeRider): SkierDress => {
    const key = `${free.look}:${free.rider}`;
    let kit = dealtKits.get(key);
    if (!kit) {
      const { tone, ...dressed } = dealtOutfit(free.look, free.rider);
      kit = { outfit: dressed, tone };
      dealtKits.set(key, kit);
    }
    return kit;
  };
  const dressOf = (i: number): SkierDress => {
    if (i === 0) return { outfit };
    const free = field[i - 1]?.free;
    return free ? kitOfFree(free) : SLOT_DRESS[1 + ((i - 1) % (SLOT_DRESS.length - 1))];
  };
  const kitOf = (i: number): string => {
    const d = dressOf(i);
    return outfitKey(d.outfit, d.tone);
  };
  function riderFor(i: number, spec: SkiSpec): Rider {
    const model = createSkisModel(spec, pairStyle(spec, dressOf(i)), wrap);
    castInLight(model.root, env.haze);
    model.root.name = "field";
    scene.add(model.root);
    return {
      model,
      spec,
      kit: kitOf(i),
      track: createTrack(),
      pen: createPen(16),
      drawn: { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } },
      sink: 0,
      wasAirborne: false,
      vy: 0,
      airTime: 0,
      wasThrown: false,
      bodyDown: false,
      plume: 0,
      bodyPen: createPen(1),
      body: createBodyTrack(),
    };
  }

  /** How much deeper the drawn furrow is than the physics' sink under the
   * boots — the skier is drawn that much lower, so he stands IN the
   * trough his skis are cutting rather than hovering over it. */
  function extraSink(skier: SkierState, depth: number): number {
    if (!level) return 0;
    let sum = 0;
    let n = 0;
    for (const c of skier.contacts) {
      if (c.station !== "mid" || !c.touching) continue;
      const packed = level.packedAt(c.x, c.z);
      // The drawn surface under the probe is the loose cover over the ground
      // less the furrow; the physics has it at the ground less its own sink.
      const snow = pack ? sampleSnow(c.x, c.z) : undefined;
      sum += drawnDepth(c, packed, 1, depth, snow) - c.sink - LOOSE * (1 - packed);
      n++;
    }
    return n > 0 ? Math.max(-0.1, Math.min(0.2, (sum / n) * 0.85)) : 0;
  }

  /** THE WIPEOUT, as it reads in the snow (`crash.ts`): the burst the
   * moment he leaves his skis, a puff every time his body comes down on
   * the snow and a plume while it slides, and the gouge it leaves
   * (`bodyStampOf`). Presentation only: every figure is the engine's. */
  function thrownEffects(r: Rider, skier: SkierState, simDt: number): void {
    const off = skier.thrown;
    if (!off || !level || !spray) {
      r.wasThrown = false;
      r.bodyPen.down[0] = 0;
      return;
    }
    const snow = snowAt(pack ?? snowpackOf(level), off.x, off.z, skierSnow);
    const puff = (y: number, size: number) => {
      spray?.burst(off.x, off.y - y, off.z, off.vx, off.vz, size, snow);
      cloud?.burst(off.x, off.y - y, off.z, off.vx, off.vz, size, snow);
    };
    if (!r.wasThrown) puff(0.4, 1);
    const sliding = Math.hypot(off.vx, off.vz);
    if (off.touching && !r.bodyDown && sliding > 2) puff(0.3, Math.min(0.6, sliding / 20));
    r.plume = off.touching && sliding > 3 ? r.plume + simDt : 0;
    if (r.plume > 0.15) {
      r.plume = 0;
      puff(0.3, 0.02);
    }
    r.bodyDown = off.touching;
    r.wasThrown = true;
    if (TRAIL_LOOK[video.trails].stamp) {
      bodyStampOf(off, r.bodyPen, level.packedAt, stamps, sampleSnow);
    }
  }

  /** THE RUN'S SNOWPACK: the map under its sky, the dial, the new snow, the day. */
  function packFor(state: GameState): Snowpack {
    const sky = skyLevel ?? state.level;
    return snowpackOf(sky, {
      elevation: sunAtRun(sky).elevation,
      fresh: state.fresh,
      depth: state.snowDepth,
      force: snowForce,
      piste: state.piste,
    });
  }

  const api: WorldRendererExt = {
    gl,
    async load(state) {
      const mine = ++loads;
      unload();
      level = state.level;
      skyLevel = skyOverride ? withSky(level, skyOverride) : level;
      const lv = level;
      trail = buildTrail(lv);
      await breathe();
      if (mine !== loads) return;
      terrain = buildTerrain(lv, trail);
      await breathe();
      if (mine !== loads) return;
      forest = createForest(lv, env.haze, forestOptions());
      forest.group.name = "forest";
      scene.add(forest.group);
      gates = createGates(lv, env.haze, state.rules.course);
      castInLight(gates.group, env.haze);
      gates.group.name = "checkpoints";
      clear = createLineClear(lv, { movers: () => machines?.solids() ?? [] });
      boomClear = createLineClear(lv, { trees: false, movers: () => machines?.solids() ?? [] });
      trunks = createTrunksNear(lv);
      scene.add(gates.group);
      if (gates.water) scene.add(gates.water.group);
      lifts = createLifts(lv, env.haze, SPRAY_SHARE[video.spray], state.rules.lifts, env.cull);
      castInLight(lifts.group, env.haze);
      lifts.group.name = "lifts";
      scene.add(lifts.group);
      pack = packFor(state);
      wildlife = createWildlife(lv, env.haze, FOREST_LOOK[video.forest].wild, {
        at: sampleSnow,
        // A snowing sky has been filling last night's prints for hours.
        soften: () => (pack ? Math.min(0.75, (pack.laid / NEW_COVER) * 0.6) : 0),
      });
      wildlife.group.name = "wildlife";
      scene.add(wildlife.group);
      crowd = createPeopleView(lv, env.haze, state.rules, env.cull);
      scene.add(crowd.group);
      spray = createSpray(env.haze);
      spray.points.name = "spray";
      spray.setBudget(SPRAY_SHARE[video.spray]);
      scene.add(spray.points);
      cloud = createSnowCloud(env.haze);
      cloud.mesh.name = "snow-cloud";
      cloud.setBudget(SPRAY_SHARE[video.spray]);
      scene.add(cloud.mesh);
      machines = createMachines(lv, state, env, { spray, cloud, snowAt: sampleSnow, wearing });
      scene.add(machines.group);
      field = state.rivals;
      riders = runsOf(state).map((run, i) => riderFor(i, run.skier.spec));
      ghost = createGhostModel(scene, wrap);
      lastTick = -1;
      lastState = null;
      lens.snap();
      await Promise.all([breathe(), machines.ready]);
      if (mine !== loads) return;
      // Compile every program now, models and all, not on the run's first frame.
      const skier = state.skier;
      lens.camera.position.set(skier.x, skier.y + 3, skier.z - 6);
      lens.camera.lookAt(skier.x, skier.y, skier.z);
      terrain.follow(skier.x, skier.z);
      // Asynchronously where the driver can (three blocks where it cannot),
      // against the target the frame is drawn into (a graded region's are
      // linear), and the trail maps' passes, not in the scene, beside it.
      gl.setRenderTarget(picture.load(lv));
      // THE MOUNTAIN'S SHADOW, baked off the thread meanwhile for the run's key.
      const shade = env.setGround(lv.ground, skyLookAt(skyLevel, state.t).key);
      if (gl.extensions.has("KHR_parallel_shader_compile")) {
        await Promise.all([gl.compileAsync(scene, lens.camera), trail.compile(gl), shade]);
      } else {
        gl.compile(scene, lens.camera);
        await Promise.all([trail.compile(gl), shade]);
      }
      if (mine === loads) hero.render(gl, scene, [], null);
      if (mine === loads) env.warm(gl, scene, lens.camera, lv.size);
      gl.setRenderTarget(null);
    },

    draw(state: GameState, alpha: number, dt: number, present = true) {
      if (!level || state.level !== level || !terrain || !trail || !spray || !cloud) return;
      const opened = performance.now();
      const runs = runsOf(state);
      field = state.rivals;
      while (riders.length < runs.length) {
        riders.push(riderFor(riders.length, runs[riders.length].skier.spec));
      }
      // THE DEAD LEFT LYING (a new run after a death), off the body as last drawn.
      if (state !== lastState) gore?.leave(riders[0].model);
      // A slot drawn on another pair than its run's (the skis picked anew) is rebuilt.
      for (let i = 0; i < runs.length; i++) {
        const spec = runs[i].skier.spec;
        if (riders[i].spec === spec && riders[i].kit === kitOf(i)) continue;
        scene.remove(riders[i].model.root);
        riders[i].model.dispose();
        riders[i] = riderFor(i, runs[i].skier.spec);
      }
      const fresh = state !== lastState || state.tick < lastTick;
      if (fresh) {
        // A new run on the same map: the trails and the spray start clean.
        filled = state.fresh;
        if (lastState !== null) {
          trail.clear(gl);
          spray.clear();
          cloud.clear();
          wildlife?.reset();
        }
        for (const r of riders) {
          r.track = createTrack();
          r.pen = createPen(16);
          r.bodyPen = createPen(1);
          r.body = createBodyTrack();
        }
        lens.snap();
        lastTick = -1;
        lastState = state;
        pack = packFor(state);
      }
      if (pack) pack.fresh = state.fresh;
      const stepped = lastTick < 0 ? 0 : Math.max(0, state.tick - lastTick);
      const simDt = Math.min(stepped * TUNING.dt, 0.25);
      stamps.length = 0;
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        const r = riders[i];
        const skier = run.skier;
        observe(r.track, skier, run.tick);
        sample(r.track, alpha, r.drawn);
        // With the trails off there is no furrow to sit in.
        const want = TRAIL_LOOK[video.trails].stamp ? extraSink(skier, run.snowDepth) : 0;
        r.sink += (want - r.sink) * (1 - Math.exp(-dt * 10));
        observeBody(r.body, skier.thrown, run.tick);
        r.model.setRun(run);
        if (i === 0) machines?.seat(r.model, state);
        r.model.pose(
          skier,
          r.drawn,
          r.sink,
          run.tricks.pose,
          dt,
          sampleBody(r.body, alpha),
          // In the jump plane's door he stands poised for the exit, crouched
          // under its lintel as a racer in the start gate is.
          run.plane?.rider ? true : inStartGate(run),
        );
        if ((stepped > 0 || lastTick < 0) && TRAIL_LOOK[video.trails].stamp) {
          stampsOf(
            skier.contacts,
            r.pen,
            level.packedAt,
            nominalLoad,
            stamps,
            run.snowDepth,
            sampleSnow,
            { edge: Math.abs(skier.edge) / Math.max(0.3, skier.spec.edgeMax), skid: skier.skid },
          );
        }
        // The landing puff: grounded now, in the air at the last frame.
        let landed = 0;
        if (r.wasAirborne && !skier.airborne && r.airTime > 0.25) {
          landed = Math.abs(r.vy) + r.airTime * 2;
        }
        if (simDt > 0 || landed > 0) {
          spray.emit(skier, level, simDt, landed, snowAt(pack!, skier.x, skier.z, skierSnow));
          cloud.emit(skier, simDt, landed, sampleSnow);
        }
        thrownEffects(r, skier, simDt);
        r.wasAirborne = skier.airborne;
        r.airTime = skier.airborne ? skier.airTime : r.airTime * (skier.airborne ? 1 : 0);
        if (skier.airborne) r.vy = skier.vy;
      }
      if (state.gore && !gore) {
        gore = createGoreView(level, wrap);
        scene.add(gore.group);
      }
      gore?.setPace(pace);
      gore?.update(state, riders[0].model, simDt, dt, hurt.veil());
      lastTick = state.tick;
      // The ghost is posed and drawn, and nothing more: no furrow, no spray.
      ghost?.draw(ghostRun?.level === level ? ghostRun : null, alpha);
      const player = riders[0];
      const skier = state.skier;
      const d = player.drawn;
      // THE LADDER'S SUBJECT (`camera-subject.ts`): him, and his body once he is thrown.
      const body = sampleBody(player.body, alpha);
      subjectPose(rigPose, skier, d, player.sink, body, level.groundAt, thrownLens);
      rigPose.summit = summitShare(level, rigPose.x, rigPose.z);
      rigPose.ride = stepRideLook(rideMem, skier.lift, Math.min(dt, 0.1), state.tick < 3);
      if (liftCut(skier.lift)) lens.snap(); // cut to his carrier under the station's fade
      // THE MACHINES (`machines.ts`): the helicopter's lens; the snowmobile's own ladder.
      lens.bail(
        !!(state.heli?.rider || state.plane?.rider),
        skier.airborne,
        skier.thrown !== null,
        Math.min(dt, 0.1),
      );
      const marks = stepped > 0 && TRAIL_LOOK[video.trails].stamp ? stamps : null;
      machines?.setPace(pace);
      machines?.frame(state, alpha, dt, simDt, d, lens.rung(), lens.flying(), marks);
      const own = machines?.ladder(rigPose, state, lens.camera.aspect);
      player.model.setSkierVisible(figureShown(lens.rung(), own, rigPose.airborne));
      const ladder = lens.frame(rigPose, Math.min(dt, 0.1), level.groundAt, boomClear, trunks, own);
      hurt.update(state, player.model.skin());
      // THE LENS ON A HURT BODY (`xray-scene.ts`); a wreck he was on is `camera-crash.ts`'s.
      const allowed =
        !override && !watched && lens.rung() !== "orbit" && !state.heli?.wreck?.aboard;
      const dead = hurt.lens(
        allowed,
        body,
        ladder,
        Math.min(dt / pace, 0.1), // its lens flies on the WALL clock
        level.groundAt,
        clear,
        () => lens.snap(),
      );
      // The ladder is framed underneath either way: a planted lens hands back to a boom in place.
      const planted =
        override ??
        (watched ? replayCam.update(watched, rigPose, body, state.t, dt) : null) ??
        (hurt.active() ? dead : null) ??
        machines?.lens(ladder, Math.min(dt, 0.1)) ??
        dead ??
        frameStart(startMoment(state, d), ladder);
      if (planted) {
        aimLens(lens.camera, planted);
        player.model.setSkierVisible(true);
      }
      // LOOKING ROUND FROM THE LIFT: the lift's lens swung about him by the drags.
      const looked = gaze.frame(ladder, rigPose, skier.lift, dt, box.height, level);
      if (looked && !planted && lens.rung() !== "orbit") aimLens(lens.camera, looked);
      afterski.sway(lens.camera, state, lens.rung(), planted !== null);

      // A rival standing in the lens's own spot is left out of this frame.
      const eye = lens.camera.position;
      const me = player.drawn;
      const far = Math.hypot(me.x - eye.x, me.y - eye.y, me.z - eye.z) * LENS_CROWD;
      const reach = !planted && lens.rung() !== "orbit" ? Math.max(LENS_TOUCH, far) : LENS_TOUCH;
      for (let i = 1; i < riders.length; i++) {
        const at = riders[i].drawn;
        riders[i].model.root.visible = Math.hypot(at.x - eye.x, at.y - eye.y, at.z - eye.z) > reach;
      }

      const posed = performance.now();
      const fine = trail.uniforms;
      wildlife?.update(
        state,
        lens.camera.position.x,
        lens.camera.position.z,
        TRAIL_LOOK[video.trails].stamp ? stamps : null,
        { x: fine.uFineOrigin.value.x, z: fine.uFineOrigin.value.y, span: fine.uFineSpan.value },
      );
      timer.push("trail");
      if (!hidden.has("trail")) trail.update(gl, stamps, skier.x, skier.z);
      // THE NEW SNOW: it settles into every trail and buries the groomer.
      if (state.fresh > filled && !hidden.has("trail")) {
        trail.fill(gl, state.fresh - filled);
        filled = state.fresh;
      }
      timer.pop();
      setRunSnow(env.haze, state.fresh, state.piste);
      const trailed = performance.now();
      terrain.follow(lens.camera.position.x, lens.camera.position.z, lens.camera);
      const sky = skyLevel ?? level;
      const look = skyLookAt(sky, state.t);
      windAt(sky, state.t, wind);
      // The cloud goes with the MEAN wind — its gusts are the air down here.
      const carried = (weatherOf(sky).wind * state.t) / CLOUD_HEIGHT;
      const from = windFromOf(sky);
      env.update(look, lens.camera, d.y, {
        x: -Math.sin(from) * carried,
        z: -Math.cos(from) * carried,
      });
      crowd?.update(state, lens.camera.position); // after the lens and the sun's box (`env.cull`)
      if (present) forest?.update(lens.camera, env.shadow());
      if (present) {
        heroModels.length = 0;
        for (const r of riders) heroModels.push(r.model);
        timer.push("hero");
        hero.render(gl, scene, heroModels, hidden.has("hero") ? null : env.shadow());
        timer.pop();
      }
      gates?.update(state);
      seated.length = 0;
      for (let i = 1; i < runs.length; i++) {
        const ride = runs[i].skier.lift;
        if (ride) seated.push({ ride, drawn: riders[i].drawn });
      }
      lifts?.update(
        state.t - (1 - alpha) * TUNING.dt,
        skier.lift,
        player.drawn,
        lens.camera.position,
        seated,
        state.crowd?.amateurs,
      );
      // THE NIGHT'S LIGHTS: every headlamp, the machines' lamps, the arena's floods.
      machines?.light(look);
      const floods = machines?.lamps(look.lamps, eye, gates?.floods ?? []) ?? gates?.floods;
      dealLamps(env.haze, look.lamps, riders, floods ?? [], eye, video.lamps);
      const h = gl.domElement.height;
      const pixels = h / (2 * Math.tan(THREE.MathUtils.degToRad(lens.camera.fov) / 2));
      gates?.setLamps(look.lamps, pixels);
      spray.setScale(pixels);
      spray.update(Math.min(dt, 0.1), look, level);
      // The ladder's lens looks through his own tail; a planted one sees it whole.
      cloud.setFocus(d.x, d.y + 0.6, d.z, planted ? 1 : CLOUD_VEIL);
      cloud.update(Math.min(dt, 0.1), look, level, wind, lens.camera.position);
      snowfall.setScale(pixels);
      snowfall.update(look, wind, lens.camera, level, dt);
      gates?.air(state, look, wind, lens.camera.position, pixels);

      const built = performance.now();
      if (present) {
        for (const child of scene.children) {
          const slice = SLICE_OF_GROUP[child.name];
          if (slice !== undefined && hidden.has(slice) && child.visible) {
            child.visible = false;
            hid.push(child);
          }
        }
        const autoShadow = gl.shadowMap.autoUpdate;
        if (hidden.has("shadow")) gl.shadowMap.autoUpdate = false;
        timer.push("scene");
        const w = gl.domElement;
        const room = afterski.inside(state, outfit, outfitKey(outfit), w.width / w.height);
        picture.draw(room?.scene ?? scene, room?.camera ?? lens.camera, timer);
        timer.pop();
        gl.shadowMap.autoUpdate = autoShadow;
        for (const o of hid) o.visible = true;
        hid.length = 0;
      }
      const closed = performance.now();
      const r = picture.info();
      cost.poseMs = posed - opened;
      cost.trailMs = trailed - posed;
      cost.worldMs = built - trailed;
      cost.submitMs = closed - built;
      cost.frameMs = closed - opened;
      cost.calls = r.calls;
      cost.triangles = r.triangles;
      cost.programs = gl.info.programs?.length ?? 0;
      cost.geometries = gl.info.memory.geometries;
      cost.textures = gl.info.memory.textures;
      if (present && overlayOn) {
        timer.push("overlay");
        overlay.draw(gl, trail.uniforms);
        timer.pop();
      }
      if (present) timer.frame(hiddenTag);
    },

    cost: () => cost,
    sceneTally: () => tallyScene(scene),
    bufferSize: () => ({ w: gl.domElement.width, h: gl.domElement.height }),
    setTrailOverlay(on) {
      overlayOn = on;
    },
    setGpuTimer(mode) {
      timer.dispose();
      timer = createGpuTimer(ctx, mode);
    },
    gpuTotals: () => timer.totals(),
    resetGpu() {
      timer.reset();
    },
    setHidden(names, tag = "") {
      hidden = new Set(names);
      hiddenTag = tag;
    },
    lensPose() {
      const cam = lens.camera;
      cam.getWorldDirection(lensDir);
      return {
        x: cam.position.x,
        y: cam.position.y,
        z: cam.position.z,
        yaw: Math.atan2(lensDir.x, lensDir.z),
        pitch: Math.asin(Math.max(-1, Math.min(1, lensDir.y))),
      };
    },

    dress(kit) {
      outfit = kit;
    },
    setGhost(run) {
      ghostRun = run;
    },

    setOverride(view) {
      override = view;
    },

    lookAround: gaze.drag,
    setDeathCam: hurt.setDeathCam,
    clearBodies: () => gore?.clearRemains(),
    setXray: hurt.setXray,
    setPace: (p) => void (pace = p > 0 ? p : 1),

    setReplayCam(next) {
      if (!next) replayCam.drop();
      watched = next;
    },

    setSky(sky) {
      skyOverride = sky;
      skyLevel = level && sky ? withSky(level, sky) : level;
      if (lastState && level) pack = packFor(lastState);
    },
    shadeSettled: () => env.shadeSettled(),
    setSnow(kind) {
      snowForce = kind;
      if (lastState && level) pack = packFor(lastState);
    },

    setCamera(rung: CameraRung, cut: boolean = false) {
      lens.set(rung, cut);
    },
    camera: () => lens.chosen(),
    pickRay: (x, y) => lensRay(lens.camera, x, y),
    resize(width, height, pixelRatio) {
      box = { width, height, pixelRatio };
      gl.setPixelRatio(pixelRatio * RESOLUTION_SHARE[video.resolution]);
      gl.setSize(width, height, false);
      lens.camera.aspect = width / Math.max(1, height);
      lens.camera.updateProjectionMatrix();
      forest?.invalidate();
    },
    setVideo(next) {
      const was = video;
      video = { ...next };
      if (was.resolution !== video.resolution) api.resize(box.width, box.height, box.pixelRatio);
      gl.shadowMap.enabled = SHADOW_LOOK[video.shadows].size > 0;
      env.setShadow(shadowLook());
      hero.setSize(shadowLook().hero);
      env.setDistance(video.distance);
      spray?.setBudget(SPRAY_SHARE[video.spray]);
      cloud?.setBudget(SPRAY_SHARE[video.spray]);
      lifts?.setBudget(SPRAY_SHARE[video.spray]);
      snowfall.setBudget(SPRAY_SHARE[video.spray]);
      forest?.setOptions(forestOptions());
      wildlife?.setLook(FOREST_LOOK[video.forest].wild);
      // THE GROUND AND ITS TRAILS ARE REBUILT, not adjusted: a grid's pitch,
      // its reach and a map's size are what their buffers were allocated
      // at. New trail maps lose the trails cut so far — this is pressed over
      // a card, where the race behind it is scenery — so only a TRAILS move
      // pays that; a new ground reads the maps standing.
      const retrail = was.trails !== video.trails;
      const regrid = retrail || was.terrain !== video.terrain || was.distance !== video.distance;
      if (level && regrid) {
        if (terrain) {
          scene.remove(terrain.group);
          terrain.dispose();
        }
        if (retrail || !trail) {
          trail?.dispose();
          trail = buildTrail(level);
          wildlife?.retrack();
        }
        terrain = buildTerrain(level, trail);
        terrain.follow(lens.camera.position.x, lens.camera.position.z);
      }
    },
    drain() {
      const at = performance.now();
      const ctx = gl.getContext();
      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, drained);
      return performance.now() - at;
    },
    info() {
      return picture.info();
    },
    dispose() {
      unload();
      hurt.dispose();
      overlay.dispose();
      snowfall.dispose();
      picture.dispose();
      afterski.dispose();
      env.dispose();
      hero.dispose();
      timer.dispose();
      gl.dispose();
    },
  };
  return api;
}
