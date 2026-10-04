// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD RENDERER — the one thing `renderer-api.ts` promises the shell,
// built here out of the modules that each own a part of the picture:
//
//   environment.ts  the sun, the sky's light, the dome and the haze
//   terrain.ts      the ground: a clipmap round the lens, shaded as snow
//   trail-map.ts    every furrow any skier has cut, lowering that snow
//   forest.ts       the snow-loaded conifers, two bands and their casters
//   gates.ts        the gates (a slalom's flex poles), the start, the finish
//                   arena and its floodlights, the piste's edge poles
//   lifts.ts        the resort's lifts, and its wind tunnels (wind-tunnels.ts)
//   skis-body.ts    the four pairs of skis and their skiers
//   spray.ts        the edge's sheet, the skid's wall and the landing puff
//   snow-cloud.ts   the fine powder they raise; snowpack.ts, the kinds of snow
//   snowfall.ts     the snow falling round the lens, the spindrift
//   ghost-model.ts  the time trial's ghost, see-through and trail-less
//   wildlife.ts     the birds over the woods, the animals and their prints
//   spectators.ts   the free ride's amateurs, and a race's crowd watching
//   camera.ts      the ladder of lenses; camera-start.ts, a slalom's start
//
// WHAT IT COSTS is the picture it is handed (`settings-video.ts`): every
// module above is built or tuned off one `VideoSettings`, and `setVideo` is
// the one place a row of OPTIONS ▸ PICTURE becomes a draw call.
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
  withSky,
  type GameState,
  type Level,
  type SkiSpec,
  type SkierState,
  type SkyOverride,
  type Wind,
} from "@engine";

import { noCost, type GpuSlice, type Hideable } from "./benchmark-report.ts";
import { createLens, type Lens } from "./camera.ts";
import { createLineClear, createTrunksNear } from "./camera-clear.ts";
import { createTvCamera } from "./camera-tv.ts";
import type { LensPose, LineClear, RigPose, TrunksNear } from "./camera-rigs.ts";
import { createEnvironment, type Environment } from "./environment.ts";
import { createForest, type Forest, type ForestOptions } from "./forest.ts";
import { createDeathCam, dropDeathCam, frameDeath } from "./camera-death.ts";
import { frameStart, startMoment } from "./camera-start.ts";
import { createGates, type Gates } from "./gates.ts";
import { createLifts, type Lifts } from "./lifts.ts";
import { summitShare } from "./camera-summit.ts";
import { createRideMemory, stepRideLook } from "./camera-lift.ts";
import { createGhostModel, type GhostModel } from "./ghost-model.ts";
import { createGpuTimer, type GpuTimer } from "./gpu-timer.ts";
import { hazeMaterial } from "./haze.ts";
import { dealLamps } from "./headlamp.ts";
import { createHeroShadow } from "./hero-shadow.ts";
import {
  createBodyTrack,
  createTrack,
  observe,
  observeBody,
  sample,
  sampleBody,
  type BodyTrack,
  type Pose,
  type PoseTrack,
} from "./interp.ts";
import { createRegionPicture } from "./region-picture.ts";
import type { CameraRung, DevRenderer, WorldRenderer } from "./renderer-api.ts";
import type { ReplayShot } from "./replay-shots.ts";
import { createSkisModel, pairStyle, SLOT_DRESS, type SkisModel } from "./skis-body.ts";
import { inStartGate } from "./skier-spring.ts";
import { outfitKey } from "./dress.ts";
import { DEFAULT_OUTFIT, type Outfit } from "./outfit.ts";
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
import {
  bodyStampOf,
  createPen,
  drawnDepth,
  stampsOf,
  type Stamp,
  type TrailPen,
} from "./trail-stamp.ts";

// The modelled skis and skiers, fetched before the kit is handed out
// (`use-render-kit.ts`), when this build draws them. Everything else is
// built in code.
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

type Rider = {
  model: SkisModel;
  /** The pair the model was built off: a run on another one is a new
   * model, even on the same map and in the same slot. */
  spec: SkiSpec;
  /** The outfit the skier was dressed in (`outfitKey`). */
  kit: string;
  track: PoseTrack;
  pen: TrailPen;
  drawn: Pose;
  /** The drawn furrow's depth past the physics' own, smoothed, m. */
  sink: number;
  wasAirborne: boolean;
  vy: number;
  airTime: number;
  /** The skier thrown (`thrownEffects`): whether he was off at the last
   * frame, whether his body was on the snow, the seconds of slide since the
   * last plume, and the pen his gouge is drawn with. */
  wasThrown: boolean;
  bodyDown: boolean;
  plume: number;
  bodyPen: TrailPen;
  /** The thrown body between two steps (`interp.ts`). */
  body: BodyTrack;
};

/** The GPU timer's slice for each named group the scene is built of
 * (`gpu-timer.ts`); anything under none of them is the scene's own. */
const SLICE_OF_GROUP: Readonly<Record<string, GpuSlice & Hideable>> = {
  sky: "sky",
  terrain: "terrain",
  forest: "forest",
  field: "field",
  ghost: "field",
  checkpoints: "checkpoints",
  "snow-cloud": "cloud",
  spray: "spray",
  snowfall: "snowfall",
  wildlife: "wildlife",
  crowd: "field",
};

/** The runs a frame draws: the player's first, then the field's. */
function runsOf(state: GameState): GameState[] {
  return [state, ...state.rivals.map((r) => r.run)];
}

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

  /** The SHADOWS row's stop, its map no bigger than this GPU can hold. */
  const shadowLook = (): ShadowLook => {
    const look = SHADOW_LOOK[video.shadows];
    const most = gl.capabilities.maxTextureSize;
    return { ...look, size: Math.min(look.size, most), hero: Math.min(look.hero, most) };
  };

  const scene = new THREE.Scene();
  // THE REGION'S GRADE (R21, `region-picture.ts`): the frame straight onto
  // the canvas, or through the region's grade; the samples go with it.
  const picture = createRegionPicture(gl, video.antialias ? 4 : 0);
  const lens: Lens = createLens(NEAR, FAR);
  scene.add(lens.camera);
  /** THE BROADCAST (`camera-tv.ts`): the moment a replay is cut to, or null
   * for the ladder's own rung. */
  const tv = createTvCamera();
  let shot: ReplayShot | null = null;
  const env: Environment = createEnvironment(scene, shadowLook(), FAR * 0.9);
  env.setDistance(video.distance);
  /** Under SHADOWS HIGH every skier casts into a map of his own. */
  const hero = createHeroShadow(env.haze, shadowLook().hero);
  const heroModels: SkisModel[] = [];
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
  let clear: LineClear | undefined;
  /** The ridden booms' clear: the course's marks, never the trees — they
   * are pushed off the trunks instead (`trunks`, `camera-rigs.ts`). */
  let boomClear: LineClear | undefined;
  let trunks: TrunksNear | undefined;
  let riders: Rider[] = [];
  let ghost: GhostModel | null = null;
  let ghostRun: GameState | null = null;
  const stamps: Stamp[] = [];
  let lastTick = -1;
  let lastState: GameState | null = null;
  /** The new snow the trail maps have been filled by, m (`trail.fill`). */
  let filled = 0;
  let override: LensPose | null = null;
  /** THE DEATH CAM: its state, and whether the app lets it take the lens. */
  const death = createDeathCam();
  let deathOn = false;
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
  const shadowPass = gl.shadowMap.render.bind(gl.shadowMap);
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
  const rigPose: RigPose = {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    speed: 0,
    airborne: false,
    packed: 1,
    q: { x: 0, y: 0, z: 0, w: 1 },
  };
  const rideMem = createRideMemory();
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
    for (const r of riders) r.model.dispose();
    for (const o of [
      terrain?.group,
      forest?.group,
      gates?.group,
      lifts?.group,
      spray?.points,
      cloud?.mesh,
      wildlife?.group,
      crowd?.group,
    ]) {
      if (o) scene.remove(o);
    }
    for (const r of riders) scene.remove(r.model.root);
    ghost?.dispose();
    ghost = null;
    terrain = forest = gates = lifts = trail = spray = null;
    cloud = null;
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
    casters: SHADOW_LOOK[video.shadows].trees ? FOREST_LOOK[video.forest].casters : "none",
  });

  /** The player's outfit: slot 0 wears it, the field its slots' own. */
  let outfit: Outfit = DEFAULT_OUTFIT;
  const dressOf = (i: number) =>
    i === 0 ? { outfit } : SLOT_DRESS[1 + ((i - 1) % (SLOT_DRESS.length - 1))];
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
      // The drawn surface under the probe is the loose cover's height over
      // the ground less the furrow; the physics has it at the ground less
      // its own sink.
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

  /** THE RUN'S SNOWPACK: the map's snow under the sky it is ridden under
   * (a lab's `setSky` too), the run's dial and its new snow. */
  function packFor(state: GameState): Snowpack {
    const sky = skyLevel ?? state.level;
    return snowpackOf(sky, {
      elevation: sunAtRun(sky).elevation,
      fresh: state.fresh,
      depth: state.snowDepth,
      force: snowForce,
    });
  }

  const api: WorldRendererExt = {
    gl,
    async load(state) {
      unload();
      level = state.level;
      skyLevel = skyOverride ? withSky(level, skyOverride) : level;
      const lv = level;
      trail = buildTrail(lv);
      await breathe();
      terrain = buildTerrain(lv, trail);
      await breathe();
      forest = createForest(lv, env.haze, forestOptions());
      forest.group.name = "forest";
      scene.add(forest.group);
      gates = createGates(lv, env.haze);
      castInLight(gates.group, env.haze);
      gates.group.name = "checkpoints";
      clear = createLineClear(lv);
      boomClear = createLineClear(lv, { trees: false });
      trunks = createTrunksNear(lv);
      scene.add(gates.group);
      lifts = createLifts(lv, env.haze, SPRAY_SHARE[video.spray]);
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
      crowd = createPeopleView(lv, env.haze, state.rules);
      scene.add(crowd.group);
      spray = createSpray(env.haze);
      spray.points.name = "spray";
      spray.setBudget(SPRAY_SHARE[video.spray]);
      scene.add(spray.points);
      cloud = createSnowCloud(env.haze);
      cloud.mesh.name = "snow-cloud";
      cloud.setBudget(SPRAY_SHARE[video.spray]);
      scene.add(cloud.mesh);
      riders = runsOf(state).map((run, i) => riderFor(i, run.skier.spec));
      ghost = createGhostModel(scene, wrap);
      lastTick = -1;
      lastState = null;
      lens.snap();
      await breathe();
      // Compile every program now rather than on the first frame of the run.
      const skier = state.skier;
      lens.camera.position.set(skier.x, skier.y + 3, skier.z - 6);
      lens.camera.lookAt(skier.x, skier.y, skier.z);
      terrain.follow(skier.x, skier.z);
      // Asynchronously where the driver can; three warns and falls back to
      // a blocking compile anyway where it cannot, so ask first. Against the
      // target the frame will be drawn into: a graded region's programs are
      // compiled for linear output, not the canvas's.
      // The trail maps' passes are compiled beside the scene: they are drawn
      // on the first frame too, and are not in it.
      gl.setRenderTarget(picture.load(lv));
      // THE MOUNTAIN'S SHADOW is baked off the thread meanwhile, for the
      // key the run opens under.
      const shade = env.setGround(lv.ground, skyLookAt(skyLevel, state.t).key);
      if (gl.extensions.has("KHR_parallel_shader_compile")) {
        await Promise.all([gl.compileAsync(scene, lens.camera), trail.compile(gl), shade]);
      } else {
        gl.compile(scene, lens.camera);
        await Promise.all([trail.compile(gl), shade]);
      }
      gl.setRenderTarget(null);
    },

    draw(state: GameState, alpha: number, dt: number, present = true) {
      if (!level || state.level !== level || !terrain || !trail || !spray || !cloud) return;
      const opened = performance.now();
      const runs = runsOf(state);
      while (riders.length < runs.length) {
        riders.push(riderFor(riders.length, runs[riders.length].skier.spec));
      }
      // A slot on another pair than the one it was drawn as — the player
      // chose different skis for a race on the same map — is rebuilt.
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
        r.model.pose(
          skier,
          r.drawn,
          r.sink,
          run.tricks.pose,
          dt,
          sampleBody(r.body, alpha),
          inStartGate(run),
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
      lastTick = state.tick;
      // The ghost is posed and drawn, and nothing more: no furrow, no spray.
      ghost?.draw(ghostRun?.level === level ? ghostRun : null, alpha);

      const player = riders[0];
      const skier = state.skier;
      const d = player.drawn;
      rigPose.x = d.x;
      rigPose.y = d.y - player.sink;
      rigPose.z = d.z;
      rigPose.q = d.q;
      rigPose.heading = skier.heading;
      rigPose.pitch = skier.pitch;
      rigPose.roll = skier.roll;
      rigPose.vx = skier.vx;
      rigPose.vy = skier.vy;
      rigPose.vz = skier.vz;
      rigPose.speed = skier.speed;
      rigPose.airborne = skier.airborne;
      rigPose.packed = skier.packed;
      rigPose.summit = summitShare(level, d.x, d.z);
      rigPose.ride = stepRideLook(rideMem, skier.lift, Math.min(dt, 0.1), state.tick < 3);
      const inside = lens.rung() === "tips" || lens.rung() === "helmet";
      player.model.setSkierVisible(!inside);
      const ladder = lens.frame(rigPose, Math.min(dt, 0.1), level.groundAt, boomClear, trunks);
      // THE DEATH CAM (`camera-death.ts`) takes the lens off the ladder while
      // the player is off his skis — at full speed, the run never slowed.
      let dead: LensPose | null = null;
      if (deathOn && !override && !shot && lens.rung() !== "orbit") {
        dead = frameDeath(
          death,
          sampleBody(player.body, alpha),
          ladder,
          Math.min(dt, 0.1),
          level.groundAt,
          clear,
        );
        if (death.ended) lens.snap();
      } else if (death.active) {
        dropDeathCam(death);
      }
      // The ladder is framed underneath either way, so a lens planted for a
      // moment hands back to a boom that is already where it should be.
      const planted =
        override ??
        (shot && clear ? tv.update(shot, rigPose, level, clear, Math.min(dt, 0.1)) : null) ??
        dead ??
        frameStart(startMoment(state, d), ladder);
      if (planted) {
        const cam = lens.camera;
        cam.position.set(planted.eye.x, planted.eye.y, planted.eye.z);
        cam.up.set(0, 1, 0);
        cam.lookAt(planted.target.x, planted.target.y, planted.target.z);
        if (planted.roll !== 0) cam.rotateZ(-planted.roll);
        cam.fov = planted.fov;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
        player.model.setSkierVisible(true);
      }

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
      crowd?.update(state, lens.camera.position);
      timer.push("trail");
      if (!hidden.has("trail")) trail.update(gl, stamps, skier.x, skier.z);
      // THE NEW SNOW: it settles into every trail and buries the groomer.
      if (state.fresh > filled && !hidden.has("trail")) {
        trail.fill(gl, state.fresh - filled);
        filled = state.fresh;
      }
      timer.pop();
      env.haze.uFresh.value = state.fresh;
      const trailed = performance.now();
      terrain.follow(lens.camera.position.x, lens.camera.position.z);
      const sky = skyLevel ?? level;
      const look = skyLookAt(sky, state.t);
      windAt(sky, state.t, wind);
      // The cloud goes with the MEAN wind — its gusts are the air down here.
      const weather = weatherOf(sky);
      const carried = (weather.wind * state.t) / CLOUD_HEIGHT;
      env.update(look, lens.camera, d.y, {
        x: -Math.sin(weather.windFrom) * carried,
        z: -Math.cos(weather.windFrom) * carried,
      });
      if (present) forest?.update(lens.camera, env.shadow());
      if (present) {
        heroModels.length = 0;
        for (const r of riders) heroModels.push(r.model);
        timer.push("hero");
        if (!hidden.has("hero")) hero.render(gl, scene, heroModels, env.shadow());
        timer.pop();
      }
      gates?.update(state);
      lifts?.update(state.t, skier.lift, player.drawn, lens.camera.position);
      // THE NIGHT'S LIGHTS: every headlamp, the arena's floods, the piste's masts.
      dealLamps(env.haze, look.lamps, riders, gates?.floods ?? [], lens.camera.position);
      const h = gl.domElement.height;
      const pixels = h / (2 * Math.tan(THREE.MathUtils.degToRad(lens.camera.fov) / 2));
      gates?.setLamps(look.lamps, pixels);
      spray.setScale(pixels);
      spray.update(Math.min(dt, 0.1), look, level);
      // The ladder's lens looks through the player's own tail at him; a
      // planted one (a replay's broadcast, a lab) sees the cloud whole.
      cloud.setFocus(d.x, d.y + 0.6, d.z, planted ? 1 : CLOUD_VEIL);
      cloud.update(Math.min(dt, 0.1), look, level, wind, lens.camera.position);
      snowfall.setScale(pixels);
      snowfall.update(look, wind, lens.camera, level, dt);

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
        picture.draw(scene, lens.camera, timer);
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

    setDeathCam(on) {
      deathOn = on;
    },

    setShot(next) {
      if (!next) tv.drop();
      shot = next;
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
    camera() {
      return lens.rung();
    },
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
      overlay.dispose();
      snowfall.dispose();
      picture.dispose();
      env.dispose();
      hero.dispose();
      timer.dispose();
      gl.dispose();
    },
  };
  return api;
}
