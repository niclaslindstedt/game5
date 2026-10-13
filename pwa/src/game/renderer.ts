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
//   camera.ts      the ladder; camera-start.ts a slalom's start, camera-skijump.ts a jump
//
// `setVideo` is the one place a PICTURE row becomes a draw call. It READS
// `GameState` and never writes it; the map is built in `load`, `draw` only
// moves things, every skier drawn `alpha` of a step on (`interp.ts`).

import * as THREE from "three";
import {
  SKIS,
  TUNING,
  totalMass,
  windAt,
  withSky,
  type GameState,
  type Level,
  type Rival,
  type SkiSpec,
  type SkyOverride,
  type Wind,
} from "@engine";

import { createBreath } from "./backdrop-hold.ts";
import { noCost, type GpuSlice, type Hideable } from "./benchmark-report.ts";
import { aimLens, createLens, lensRay, type Lens } from "./camera.ts";
import { createLineClear, createTrunksNear } from "./camera-clear.ts";
import { aboardCraft } from "./camera-aboard.ts";
import { figureShown } from "./camera-para.ts";
import { goneUnder, lensGround } from "./camera-buried.ts";
import { createReplayCamera, type ReplayView } from "./camera-replay.ts";
import { createJumpBroadcast } from "./camera-skijump.ts";
import { freshRigPose, type LensPose, type LineClear, type RigPose } from "./camera-rigs.ts";
import { compileByParts, compiled } from "./scene-compile.ts";
import { byMaterial, depthByKind } from "./shadow-depth.ts";
import { createEnvironment, type Environment } from "./environment.ts";
import { createForest, type Forest, type ForestOptions } from "./forest.ts";
import { createHurtLens } from "./xray-scene.ts";
import { wrecked } from "./impact-forecast.ts";
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
import { hideSlices, runsOf, SLICE_OF_GROUP, thrownEffects, type Rider } from "./renderer-rider.ts";
import { hideBehind } from "./rider-cull.ts";
import type { CameraRung, DevRenderer, WorldRenderer } from "./renderer-api.ts";
import { createSkisModel, pairStyle, SLOT_DRESS, type SkisModel } from "./skis-body.ts";
import { dealtKit, type SkierDress } from "./skier-dress.ts";
import { inStartGate } from "./skier-spring.ts";
import { outfitKey } from "./dress.ts";
import { suitOf } from "./wingsuit-look.ts";
import { DEFAULT_OUTFIT, type Outfit } from "./outfit.ts";
import { heightOverFar } from "./horizon.ts";
import { keyAheadAt, skyLookAt } from "./sky.ts";
import { sunNow } from "./sky-clock.ts";
import { createSnowfall } from "./snowfall.ts";
import { rideSink } from "./ride-sink.ts";
import { castInLight } from "./terrain-shade.ts";
import { createSpray, type Spray } from "./spray.ts";
import { createSnowCloud, type SnowCloud } from "./snow-cloud.ts";
import {
  NEW_COVER,
  SNOW,
  snowAt,
  snowpackOf,
  thrownAt,
  type SnowKind,
  type Snowpack,
  type SnowpackOptions,
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
import { aloftLook } from "./view-aloft.ts";
import { tallyScene } from "./scene-tally.ts";
import { createTerrain, type Terrain } from "./terrain.ts";
import { setSummerLook, summerOptions, summerShown as summer } from "./summer-terrain.ts";
import { createDeformSnow, DEFORM_LOOK, deformShown, type DeformSnow } from "./deform-snow.ts";
import { createTrailMap, type TrailMap } from "./trail-map.ts";
import { createTrailOverlay } from "./trail-overlay.ts";
import { createWildlife, type Wildlife } from "./wildlife.ts";
import { createPeopleView, type CrowdView } from "./spectators.ts";
import { loadModels as loadSkierModels } from "./skier-models.ts";
import { carveOf, createPen, stampsOf, type Stamp } from "./trail-stamp.ts";

// The modelled skis and skiers, fetched before the kit (`use-render-kit.ts`).
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
    /** Change rung; `cut` skips the flown hand-over; `chosen` whether the
     * player picked it (a ski jump's broadcast gives way to his pick). */
    setCamera(rung: CameraRung, cut?: boolean, chosen?: boolean, craft?: CameraRung): void;
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
    /** Lay ONE kind of snow (and one surface age) over the whole map for the
     * picture (`snowpack.ts`, `snow-age.ts`), or null for the map's own. */
    setSnow(kind: SnowKind | null, age?: SnowpackOptions["age"]): void;
    /** The three.js renderer, for a lab that needs to read pixels. */
    readonly gl: THREE.WebGLRenderer;
  };

const NEAR = 0.1;
const FAR = 6000;
/** How much of the player's own snow cloud the chase lens sees between
 * itself and him (`snow-cloud.ts`'s veil). */
const CLOUD_VEIL = 0.12;

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
  const broadcast = createJumpBroadcast(); // a ski jump's director (`camera-skijump.ts`)
  let watched: ReplayView | null = null;
  const env: Environment = createEnvironment(scene, shadowLook(), FAR * 0.9, gl);
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
  let deform: DeformSnow | null = null; // the snow round him as a volume (`deform-snow.ts`)
  let spray: Spray | null = null;
  let cloud: SnowCloud | null = null;
  /** His body torn apart (`gore-view.ts`), built on the first run that deals it. */
  let gore: GoreView | null = null;
  /** WHAT SNOW LIES WHERE (`snowpack.ts`), a lab's forced kind, and its samples. */
  let pack: Snowpack | null = null;
  let packSun = 0;
  let snowForce: Pick<SnowpackOptions, "force" | "age"> = {};
  const sampled: SnowProps = { ...SNOW.soft };
  const sampleSnow = (x: number, z: number): SnowProps =>
    pack ? snowAt(pack, x, z, sampled) : SNOW.soft;
  const thrownSnow = (x: number, z: number) => thrownAt(pack, x, z);
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
  // SPLIT cuts the scene's pass between subsystems; the sun's map is a slice of its own.
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
    deform?.dispose();
    deform = null;
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
      if (!o) continue;
      o.traverse((n) => n instanceof THREE.InstancedMesh && n.dispose()); // its buffers too
      scene.remove(o);
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

  /** Loads begun: one superseded stops at its next breath, adding nothing. */
  let loads = 0;
  const breathe = createBreath(() => !warmed);
  /** A breath between two heavy builders (paced while cold); false once superseded. */
  const rest = (mine: number): Promise<boolean> => breathe().then(() => mine === loads);
  /** Whether the world standing has had its shaders compiled. */
  let warmed = true;
  /** The trail maps and the ground that reads them, built for the picture in
   * force. One step, because the ground's shader holds the maps' uniforms by
   * reference: new maps are a new ground. */
  function buildTrail(lv: Level): TrailMap {
    const map = createTrailMap(lv.size, TRAIL_LOOK[video.trails]);
    map.clear(gl);
    return map;
  }
  function buildTerrain(lv: Level, map: TrailMap): Terrain {
    const look = terrainLook(video.terrain); // the whole reach: aloft draws past the stop's view
    deform?.dispose();
    const on = TRAIL_LOOK[video.trails].stamp && !summer() && deformShown();
    deform = on ? createDeformSnow(DEFORM_LOOK[video.terrain], map.uniforms) : null;
    const options = { ...summerOptions(look, lv, video), deform: deform?.look };
    const ground = createTerrain(lv, env.haze, map.uniforms, options);
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
  let suited = false; // A wingsuit's run: the player in his suit.
  const dressOf = (i: number): SkierDress => {
    if (i === 0) return suited ? { outfit, suit: suitOf(outfit) } : { outfit };
    const free = field[i - 1]?.free;
    return free
      ? dealtKit(dealtKits, free.look, free.rider)
      : SLOT_DRESS[1 + ((i - 1) % (SLOT_DRESS.length - 1))];
  };
  const kitOf = (i: number): string => {
    const d = dressOf(i);
    return `${outfitKey(d.outfit, d.tone)}${d.suit ?? ""}`;
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

  /** THE RUN'S SNOWPACK: the map under its sky, the dial, the new snow, the day. */
  function packFor(state: GameState): Snowpack {
    const sky = skyLevel ?? state.level;
    packSun = sunNow(sky, state.t).elevation; // re-packed as the sky's clock moves it
    return snowpackOf(sky, {
      elevation: packSun,
      fresh: state.fresh,
      depth: state.snowDepth,
      ...snowForce,
      piste: state.piste,
    });
  }

  /** THE FIRST DRAW'S WORK, done ahead of it: every program compiled, the
   * mountain's shadow baked, the picture's targets made. */
  async function warm(state: GameState, mine: number): Promise<void> {
    const lv = state.level;
    if (!terrain || !trail || !skyLevel) return;
    // Compile every program now, models and all, not on the run's first frame.
    const skier = state.skier;
    lens.camera.position.set(skier.x, skier.y + 3, skier.z - 6);
    lens.camera.lookAt(skier.x, skier.y, skier.z);
    terrain.follow(skier.x, skier.z);
    // A part of the scene at a time (`scene-compile.ts`), its trail maps' passes beside it.
    gl.setRenderTarget(picture.load(lv));
    // THE MOUNTAIN'S SHADOW, baked off the thread meanwhile for the run's key.
    const shade = env.setGround(lv, skyLookAt(skyLevel, state.t).key);
    const parts = compileByParts(gl, scene, lens.camera, () => mine === loads);
    await Promise.all([parts, compiled(gl, trail.compile(gl)), shade]);
    if (mine === loads) hero.render(gl, scene, [], null);
    if (mine === loads) env.warm(gl, scene, lens.camera, lv.size);
    gl.setRenderTarget(null);
  }

  const api: WorldRendererExt = {
    gl,
    async load(state, cold = false) {
      const mine = ++loads;
      unload();
      warmed = !cold;
      level = state.level;
      setSummerLook(!!state.summer); // the ground green, the snow shed, nothing thrown
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
      if (!(await rest(mine))) return;
      gates = createGates(lv, env.haze, state.rules.course);
      castInLight(gates.group, env.haze);
      gates.group.name = "checkpoints";
      clear = createLineClear(lv, { movers: () => machines?.solids() ?? [] });
      boomClear = createLineClear(lv, { trees: false, movers: () => machines?.solids() ?? [] });
      trunks = createTrunksNear(lv);
      scene.add(gates.group);
      if (gates.water) scene.add(gates.water.group);
      if (!(await rest(mine))) return;
      lifts = createLifts(lv, env.haze, SPRAY_SHARE[video.spray], state.rules.lifts, env.cull);
      castInLight(lifts.group, env.haze);
      lifts.group.name = "lifts";
      scene.add(lifts.group);
      if (!(await rest(mine))) return;
      pack = packFor(state);
      wildlife = createWildlife(lv, env.haze, FOREST_LOOK[video.forest].wild, {
        at: sampleSnow,
        // A snowing sky has been filling last night's prints for hours.
        soften: () => (pack ? Math.min(0.75, (pack.laid / NEW_COVER) * 0.6) : 0),
      });
      wildlife.group.name = "wildlife";
      scene.add(wildlife.group);
      if (!(await rest(mine))) return;
      crowd = createPeopleView(lv, env.haze, state.rules, env.cull, !!state.summer);
      scene.add(crowd.group);
      if (!(await rest(mine))) return;
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
      suited = !!state.wingsuit;
      riders = runsOf(state).map((run, i) => riderFor(i, run.skier.spec));
      ghost = createGhostModel(scene, wrap);
      lastTick = -1;
      lastState = null;
      lens.snap();
      await Promise.all([breathe(), machines.ready]);
      if (mine !== loads || cold) return;
      await warm(state, mine);
    },

    // A world built COLD (`load(state, true)`, behind the free ride's cards)
    // has its shaders compiled here, under the loading card; any other is built.
    async finish(state) {
      if (state.level !== level) return api.load(state);
      if (warmed) return;
      warmed = true;
      await warm(state, loads);
    },

    clear() {
      loads++;
      unload();
    },

    draw(state: GameState, alpha: number, dt: number, present = true) {
      if (!level || state.level !== level || !terrain || !trail || !spray || !cloud) return;
      const opened = performance.now();
      const runs = runsOf(state);
      field = state.rivals;
      suited = !!state.wingsuit;
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
          deform?.clear();
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
      if (pack && Math.abs(sunNow(skyLevel ?? state.level, state.t).elevation - packSun) > 0.005) {
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
        const want =
          (level
            ? rideSink(
                skier,
                level,
                run.snowDepth,
                TRAIL_LOOK[video.trails].stamp,
                pack ? sampleSnow : undefined,
              )
            : 0) - (skier.thrown ? 0 : (machines?.slideLift(skier.x, skier.z) ?? 0));
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
          run.tricks,
        );
        const own = i === 0 ? stamps.length : -1; // where his own stamps begin
        if ((stepped > 0 || lastTick < 0) && TRAIL_LOOK[video.trails].stamp && !summer()) {
          stampsOf(
            skier.contacts,
            r.pen,
            level.packedAt,
            nominalLoad,
            stamps,
            run.snowDepth,
            sampleSnow,
            carveOf(skier),
          );
        }
        // The landing puff (none off a lift's rope: that is steel, not snow).
        const onRope = !!skier.grind;
        let landed = 0;
        if (r.wasAirborne && !skier.airborne && r.airTime > 0.25 && !onRope) {
          landed = Math.abs(r.vy) + r.airTime * 2;
        }
        if ((simDt > 0 || landed > 0) && !run.plane?.rider && !onRope && !summer()) {
          const sheet = own >= 0 && deform ? 0 : simDt; // his is his cut's (`deform-snow.ts`)
          spray.emit(skier, level, sheet, landed, thrownSnow(skier.x, skier.z));
          cloud.emit(skier, simDt, landed, thrownSnow);
        }
        const skis = own >= 0 ? stamps.slice(own) : null;
        if (level && spray && cloud && !summer()) {
          const stamp = TRAIL_LOOK[video.trails].stamp ? stamps : null;
          const off = skier.thrown;
          const at = thrownSnow(off ? off.x : skier.x, off ? off.z : skier.z);
          thrownEffects(r, skier, simDt, {
            level,
            spray,
            cloud,
            snow: at,
            stamps: stamp,
            sampleSnow,
          });
        }
        if (skis && deform && simDt > 0) {
          const body = stamps.slice(own + skis.length);
          deform.press(skier, level, skis, body, thrownSnow, spray.fling);
        }
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
      lens.aboard(aboardCraft(state)); // THE MACHINES (`machines.ts`): a craft's rung or his own
      const marks = stepped > 0 && TRAIL_LOOK[video.trails].stamp ? stamps : null;
      machines?.setPace(pace);
      machines?.frame(state, alpha, dt, simDt, d, lens.rung(), lens.flying(), marks);
      const own = machines?.ladder(rigPose, state, lens.camera.aspect);
      const under = goneUnder(state); // gone under an avalanche: nothing to draw
      player.model.setSkierVisible(!under && figureShown(lens.rung(), own, rigPose.airborne));
      const over = lensGround(state, level.groundAt); // over an avalanche's snow
      const ladder = lens.frame(rigPose, Math.min(dt, 0.1), over, boomClear, trunks, own);
      hurt.update(state, player.model.skin());
      // THE LENS ON A HURT BODY (`xray-scene.ts`); a wreck he was on is `camera-crash.ts`'s.
      const allowed = !override && !watched && lens.rung() !== "orbit" && !wrecked(state);
      const dead = hurt.lens(
        allowed,
        body,
        ladder,
        Math.min(dt / pace, 0.1), // its lens flies on the WALL clock
        over,
        clear,
        () => lens.snap(),
      );
      // The ladder is framed underneath either way: a planted lens hands back to a boom in place.
      const planted =
        override ??
        broadcast.lens(state, rigPose, watched, clear) ??
        (watched ? replayCam.update(watched, rigPose, body, state.t, dt) : null) ??
        (hurt.active() ? dead : null) ??
        machines?.lens(ladder, Math.min(dt, 0.1)) ??
        dead ??
        frameStart(startMoment(state, d), ladder);
      if (planted) {
        aimLens(lens.camera, planted);
        player.model.setSkierVisible(!under && (machines?.figureShown() ?? true));
      }
      // LOOKING ROUND FROM THE LIFT: the lift's lens swung about him by the drags.
      const looked = gaze.frame(ladder, rigPose, skier.lift, dt, box.height, level);
      if (looked && !planted && lens.rung() !== "orbit") aimLens(lens.camera, looked);
      afterski.sway(lens.camera, state, lens.rung(), planted !== null);

      const eye = lens.camera.position;
      hideBehind(riders, lens.camera); // a rival clear behind the lens is left out

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
      deform?.update(skier, !hidden.has("trail"));
      // THE NEW SNOW: it settles into every trail and buries the groomer.
      if (state.fresh > filled && !hidden.has("trail")) {
        trail.fill(gl, state.fresh - filled);
        filled = state.fresh;
      }
      timer.pop();
      setRunSnow(env.haze, state.fresh, state.piste, pack?.age, pack?.tracks);
      const trailed = performance.now();
      // THE VIEW ALOFT (`view-aloft.ts`): the reach grows with the height over the snow.
      const eyeAt = lens.camera.position;
      const aloft = aloftLook(video.distance, eyeAt.y - level.groundAt(eyeAt.x, eyeAt.z));
      env.setAloft(aloft);
      forest?.setAloft(aloft.trees, aloft.lift, aloft.view);
      gates?.guns?.setReach(aloft.trees, aloft.lift); // the guns as far as the woods
      terrain.tick(state.t);
      terrain.follow(eyeAt.x, eyeAt.z, lens.camera, aloft.reach, aloft.lift);
      const sky = skyLevel ?? level;
      const look = skyLookAt(sky, state.t, undefined, eyeAt.y); // over a valley fog, its sea
      windAt(sky, state.t, wind);
      // The sun's map may stand a frame while only he moves under the lens (`sunDue`).
      const lone = !hidden.has("hero") && !own && !planted && !skier.thrown;
      const far = heightOverFar(level, eyeAt.x, eyeAt.y, eyeAt.z); // the true horizon's
      const overMap = { level: sky, t: state.t }; // the cloud field over the map, at the run's clock
      env.update(look, lens.camera, d.y, overMap, lone, keyAheadAt(sky, state.t), far);
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
        skier.spec.board !== undefined,
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
        hideSlices(scene, hidden, hid);
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
    sceneTally: () => tallyScene(scene, lens.camera),
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
    exitPace: () => machines?.exitPace() ?? 1,
    setOverride: (view) => void (override = view),

    lookAround: gaze.drag,
    holdLook: gaze.hold,
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
    setSnow(kind, age) {
      snowForce = { force: kind, age };
      if (lastState && level) pack = packFor(lastState);
    },

    setCamera(rung: CameraRung, cut: boolean = false, chosen?: boolean, craft?: CameraRung) {
      lens.set(rung, cut, craft);
      if (chosen !== undefined) broadcast.pick(chosen);
    },
    camera: () => lens.chosen(),
    riding: () => lens.riding(),
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
      // THE GROUND AND ITS TRAILS ARE REBUILT (their buffers are sized to them); new trail
      // maps lose the trails cut so far, so only a TRAILS move pays. Grass rides FOREST.
      const retrail = was.trails !== video.trails;
      const regrass = summer() && was.forest !== video.forest;
      const regrid = retrail || was.terrain !== video.terrain || regrass;
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
      gl.forceContextLoss(); // a phone keeps only a few contexts alive at once
    },
  };
  return api;
}
