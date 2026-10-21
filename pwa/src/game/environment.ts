// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR: the two lights, the dome and the haze, answering to one
// `SkyLook` (`sky.ts`) read every frame — the sun stands at the run's one
// hour (`clock.ts`), but a sky picked on a card or a lab's cell can change
// under a live scene. The key light is whichever of the sun and the
// moon the look names; under a lid it is a glow with no shadow worth the
// name, and the hemisphere carries the picture.
//
// THE KEY LIGHT'S SHADOW IS ONE MAP OVER ONE PATCH. A directional light's
// shadow map has a fixed number of texels, and spread over the whole basin a
// skier's shadow would be one of them. So the map covers a circle a SHADOWS
// row's `reach` round a centre standing AHEAD of the lens (`shadow-box.ts`),
// its box snapped to whole shadow texels in the light's own frame so a
// shadow edge does not crawl as the lens moves, and every shadow fades out
// over the circle's rim instead of stopping at the map's edge. Past it the
// haze and the terrain's forest tint carry the woods.
//
// THE MOUNTAIN'S OWN SHADOW is the other half of the key's shade, over the
// whole map at once (`terrain-shade.ts`): a horizon baked once a map along
// the key's bearing, on while the SHADOWS row casts at all.

import * as THREE from "three";
import type { Level } from "@engine";

import { farFaceGrid } from "./far-faces.ts";
import { createFarRanges, type FarRanges } from "./far-ranges.ts";
import { FAR_TIER } from "./far-ranges-plan.ts";
import { createHazeUniforms, writeHaze, type HazeUniforms } from "./haze.ts";
import { horizonDip } from "./horizon.ts";
import { createClouds, type Clouds } from "./clouds.ts";
import { createSkyDome, type SkyDome } from "./sky-dome.ts";
import { createContrails, type Contrails } from "./contrails.ts";
import {
  CLOUD_TIER,
  mistFor,
  SKY_TIER,
  type DistanceLevel,
  type ShadowLook,
  type HorizonLevel,
  type SkyLevel,
} from "./settings-video.ts";
import { createSkyGpu, type SkyGpu } from "./sky-gpu.ts";
import type { AloftLook } from "./view-aloft.ts";
import {
  aimShadow,
  createSunCadence,
  SHADOW_MARGIN,
  shadowFade,
  steadyKey,
  sunDue,
  type ShadowBox,
} from "./shadow-box.ts";
import { skyLookAt, type Dir, type SkyLook } from "./sky.ts";
import { createTerrainShade } from "./terrain-shade.ts";
import { createViewCull, type ViewCull } from "./view-cull.ts";
import { SkyLight, KeyLight } from "./world-lights.ts";

/** Where the key light is parked along the sun, m (it is directional; the
 * distance only has to clear anything that casts). */
const KEY_DISTANCE = 300;

export type Environment = {
  haze: HazeUniforms;
  sun: THREE.DirectionalLight;
  dome: SkyDome;
  /** THE GPU SKY (MEDIUM and HIGH, `sky-gpu.ts`): its tier rides the
   * DISTANCE row; `update` draws what is due. */
  gpu: SkyGpu;
  /** THE CLOUD FIELD on the GPU (`clouds.ts`): its tier rides the DISTANCE
   * row too. */
  clouds: Clouds;
  /** THE CONTRAILS (`contrails.ts`), drawn in the dome: their rung rides
   * the DISTANCE row with the cloud's. */
  contrails: Contrails;
  /** Apply a look, and aim the shadow ahead of `camera`, its box standing
   * at height `y` (the skier's: what the depth range is centred on);
   * `cloud` the map the cloud field stands over and the run's clock it
   * has moved to (`clouds.ts`); `steady`, that the sun's map may stand a frame (`sunDue`); `ahead`,
   * where the key will stand `TERRAIN_SHADOW.lead` s of run on (`sky.ts`'s
   * `keyAheadAt` — null while the sky's clock stands), which the
   * mountain's shadow is baked ahead to. `far` is the lens's height over
   * the far country, m (`horizon.ts`'s `heightOverFar`): where the true
   * horizon dips to. */
  update(
    look: SkyLook,
    camera: THREE.Camera,
    y: number,
    cloud?: { level: Level | null; t: number },
    steady?: boolean,
    ahead?: Dir | null,
    far?: number,
  ): void;
  /** Where the shadow stands this frame, or null while the SHADOWS row is
   * off — what `forest.ts` picks its casters by. */
  shadow(): ShadowBox | null;
  /** What the instanced views leave out of sight this frame (`view-cull.ts`):
   * aimed by `update` at its camera and the shadow's box. */
  cull: ViewCull;
  /** The SHADOWS row: the map's texels and its reach. */
  setShadow(look: ShadowLook): void;
  /** The DISTANCE row, whose mist is `mistFor`'s. */
  setDistance(distance: DistanceLevel): void;
  /** The SKY row: PLAIN draws the dome as the air's colour alone, on the
   * baked table, with no cloud pass. */
  setSky(sky: SkyLevel): void;
  /** The HORIZON row: PAINTED the far ranges as a skyline on the dome, 3D
   * the rings' own mesh. */
  setHorizon(horizon: HorizonLevel): void;
  /** The mist as a lens over the snow sees it (`view-aloft.ts`), every frame. */
  setAloft(look: Pick<AloftLook, "mist" | "aloft">): void;
  /** The map the mountain's shadow is baked off and the far ranges are
   * raised round (null: none), and the key it is baked for first;
   * resolves once that shade is drawn and the ranges stand. */
  setGround(level: Level | null, key: Dir | null): Promise<void>;
  /** THE FAR RANGES round the map (`far-ranges.ts`). */
  far: FarRanges;
  /** Resolves once the mountain's shadow for the key last seen is drawn. */
  shadeSettled(): Promise<void>;
  /** Link every program the sun's shadow pass can ask for, now, behind the
   * loading card: one pass of its map over `span` m round the scene with
   * every caster shown (`warmShadows`) — and draw every program the picture
   * can ask for once through `camera` into the target bound (`warmPicture`),
   * the clouds first drawn as the `run`'s sky at its clock stands them. */
  warm(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    span: number,
    run: { level: Level; t: number },
  ): void;
  /** The node renderer's warm-up (`warmNode`), the clouds' passes drawn
   * first as the `run`'s sky stands them, so their pipelines are built
   * behind the card too and the dome is warmed reading them. */
  warmNode(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    span: number,
    frame: NodeFrame,
    quarantine: Hider,
    run: { level: Level; t: number },
  ): void;
  dispose(): void;
};

/**
 * THE SHADOW PASS'S PROGRAMS, LINKED BEFORE THE RUN. three's `compile`
 * builds every mesh's own program but none of the depth programs its
 * shadow pass draws casters with — one a caster's side, packing and kind
 * (instanced, skinned) — so a caster of a kind not yet in the sun's box (the
 * finish arena's double-sided banners, a slalom's last gates) linked its
 * program the frame it first came in: a stall of tens of milliseconds
 * mid-run on a phone, where the driver links on the thread that draws. One
 * pass of the map, its box opened over the whole map and every caster
 * switched on for it, links them all while the card is still up; what was
 * hidden is hidden again and the box put back.
 */
function warmShadows(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  sun: THREE.DirectionalLight,
  span: number,
): void {
  if (!sun.castShadow || !gl.shadowMap.enabled) return;
  const shown: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || !o.castShadow) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) {
      if (p.visible) continue;
      p.visible = true;
      shown.push(p);
    }
  });
  const close = openBox(sun, span);
  scene.updateMatrixWorld();
  const wanted = gl.shadowMap.needsUpdate;
  gl.shadowMap.needsUpdate = true;
  sun.shadow.needsUpdate = true; // whatever the cadence (`sunDue`) last said
  gl.shadowMap.render([sun], scene, sun.shadow.camera);
  gl.shadowMap.needsUpdate = wanted;
  close();
  for (const p of shown) p.visible = false;
}

/**
 * THE PICTURE'S PROGRAMS, FIRST DRAWN BEFORE THE RUN. `compile` links every
 * program in the scene, but a driver finishes one only when it is first
 * DRAWN with (a phone's builds its pipeline there, on the thread that
 * draws): whatever the lens had not yet seen — the rotor's smear as he sits
 * on the skid, the far side of the ski area as the helicopter climbs, the
 * fire when it goes down — stalled the frame it came into view. One draw of
 * the whole scene, every mesh shown and none culled, into a single pixel of
 * the target the run is drawn into finishes them all while the card is up;
 * what was hidden is hidden again, and the next frame paints over the pixel.
 * Every texture it samples must exist on the GPU by then, or the GL refuses
 * the draw: the renderer runs the skiers' shadow pass (empty) first.
 */
function warmPicture(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
  const back = standAll(scene);
  // A target carries its own scissor; the canvas's is the renderer's.
  const target = gl.getRenderTarget();
  const scissor = target ? target.scissorTest : gl.getScissorTest();
  const box = target ? target.scissor.clone() : gl.getScissor(new THREE.Vector4());
  const auto = gl.shadowMap.autoUpdate;
  gl.shadowMap.autoUpdate = false;
  if (target) {
    target.scissorTest = true;
    target.scissor.set(0, 0, 1, 1);
    gl.setRenderTarget(target);
  } else {
    gl.setScissorTest(true);
    gl.setScissor(0, 0, 1, 1);
  }
  gl.render(scene, camera);
  if (target) {
    target.scissorTest = scissor;
    target.scissor.copy(box);
    gl.setRenderTarget(target);
  } else {
    gl.setScissorTest(scissor);
    gl.setScissor(box);
  }
  gl.shadowMap.autoUpdate = auto;
  back();
}

/** Every mesh, points and sprite under `scene` shown and none culled, as a
 * warm-up draws them (but, with `apart`, what asks to be left out); the call
 * returned puts each back as it was. */
function standAll(scene: THREE.Scene, apart = false): () => void {
  const shown: THREE.Object3D[] = [];
  const culled: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Sprite).isSprite)
      return;
    if (apart && o.userData.warmApart === true) return;
    if (o.frustumCulled) {
      o.frustumCulled = false;
      culled.push(o);
    }
    for (let p: THREE.Object3D | null = o; p; p = p.parent) {
      if (p.visible) continue;
      p.visible = true;
      shown.push(p);
    }
  });
  return () => {
    for (const o of culled) o.frustumCulled = true;
    for (const p of shown) p.visible = false;
  };
}

/** The key's shadow box opened over `span` m round the scene, for a pass
 * that has to meet every caster; the call returned closes it again. */
function openBox(sun: THREE.DirectionalLight, span: number): () => void {
  const cam = sun.shadow.camera;
  const { left, right, top, bottom, near, far } = cam;
  cam.left = cam.bottom = -span;
  cam.right = cam.top = span;
  cam.near = -2 * span;
  cam.far = 2 * span;
  cam.updateProjectionMatrix();
  return () => {
    Object.assign(cam, { left, right, top, bottom, near, far });
    cam.updateProjectionMatrix();
  };
}

/** The two ends of a node renderer's frame (`render-seam.ts`) and what it
 * hides there (`gpu-quarantine.ts`). */
type NodeFrame = { beginFrame(): void; endFrame(): void };
type Hider = { hide(scene: THREE.Object3D): void; restore(): void };

/**
 * THE NODE RENDERER'S PIPELINES, BUILT BEFORE THE RUN (`docs/webgpu.md`,
 * part 6). The node renderer builds a pipeline the frame it first draws
 * with it, on the thread that draws: a frame that meets a new material
 * stalls for as long as the device takes to compile it — seconds on a
 * software device, and a visible hitch on a phone. So, behind the card,
 * the whole scene is drawn once through a single pixel of the target it
 * will be drawn into — the grade's (part 7) when the region is graded, the
 * canvas when not, the target the caller set — every mesh shown and none
 * culled (what the quarantine hides left out), with the
 * key's shadow pass drawn into it, its box opened over the whole map: every
 * pipeline the picture and the sun's map can ask for is built there. What
 * it showed is hidden again and the box put back; the next frame paints
 * over the pixel.
 *
 * WHAT IS LEFT HIDDEN (`userData.warmApart`): the deformable snow's mesh,
 * hidden until the field is on and the lens over it. Drawn here, it left
 * the clipmap's far levels grey and unhazed for the rest of the run (the
 * cause is not pinned: `docs/webgpu.md`, part 6). It is left for the frame
 * that first needs it, as before part 6.
 *
 * NOT THREE'S `compileAsync`: it skips the shadow pass, and it builds each
 * object's nodes after the overrides it applied are gone (r186). The draw
 * builds both as a frame would.
 */
export function warmNode(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  sun: THREE.DirectionalLight,
  span: number,
  frame: NodeFrame,
  quarantine: Hider,
): void {
  const back = standAll(scene, true);
  const close = openBox(sun, span);
  if (sun.castShadow && gl.shadowMap.enabled) sun.shadow.needsUpdate = true;
  const scissor = gl.getScissorTest();
  const box = gl.getScissor(new THREE.Vector4());
  // A target's own scissor is the one the node renderer applies to it (with
  // the canvas's test on): a pipeline is built for its format and samples.
  const target = gl.getRenderTarget();
  const own = target?.scissor.clone();
  target?.scissor.set(0, 0, 1, 1);
  gl.setScissorTest(true);
  gl.setScissor(0, 0, 1, 1);
  frame.beginFrame();
  quarantine.hide(scene);
  gl.render(scene, camera);
  quarantine.restore();
  frame.endFrame();
  gl.setScissorTest(scissor);
  gl.setScissor(box);
  if (target && own) target.scissor.copy(own);
  close();
  back();
}

export function createEnvironment(
  scene: THREE.Scene,
  shadowLook: ShadowLook,
  domeRadius: number,
  gl: THREE.WebGLRenderer | null = null,
  /** Drawn by the node renderer (`render-seam.ts`): its shadow keeps its own
   * map, and its sky's and its clouds' passes are drawn by their node twins
   * (`sky-atmo-tsl.ts`, `cloud-pass-tsl.ts`, `cloud-volume-tsl.ts`). */
  node = false,
): Environment {
  const haze = createHazeUniforms();
  const gpu = createSkyGpu(gl, haze, node);
  const terrain = createTerrainShade(haze);
  const clouds = createClouds(gl, haze, node);
  const contrails = createContrails();
  const dome = createSkyDome(haze, domeRadius, clouds, contrails);
  dome.mesh.name = "sky";
  scene.add(dome.mesh);
  const ranges = createFarRanges(haze);
  scene.add(ranges.group);

  // Classes of their own, so the node renderer can hang its nodes on them
  // (`world-lights.ts`); on WebGL they are three's two lights.
  const hemi = new SkyLight(haze, 0x88aaff, 0xffffff, 1);
  scene.add(hemi);

  const sun = new KeyLight(haze, 0xffffff, 3);
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = KEY_DISTANCE * 2;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  /** The box's centre snaps to this, so shadow edges do not crawl. */
  let texel = 1;
  const box: ShadowBox = { x: 0, y: 0, z: 0, reach: 0, sx: 0, sy: 1, sz: 0 };
  let hero = false;
  const setShadow = ({ size, reach, hero: own }: ShadowLook): void => {
    sun.castShadow = size > 0;
    hero = own > 0; // the riders in a map of their own: the sun's may stand (`sunDue`)
    box.reach = reach;
    const half = reach + SHADOW_MARGIN;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();
    texel = (2 * half) / Math.max(size, 1);
    // Off the surface by most of a texel, in metres: the map's own grain is
    // what raises acne on snow the low sun grazes, so the offset scales
    // with it rather than being one number for every stop.
    sun.shadow.normalBias = texel * 0.7;
    const [inner, outer] = shadowFade(reach);
    haze.uShadowFade.value.z = inner;
    haze.uShadowFade.value.w = outer;
    if (size > 0 && sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      // WebGL allocates the map on first use at the size it finds; a map
      // already standing at another size has to go for the new one to come.
      // The node renderer's shadow resizes its own map to `mapSize` and
      // keeps drawing into the one it made: disposed under it, every frame
      // after is refused by the device.
      if (!node) {
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    }
  };
  setShadow(shadowLook);
  const lightSpace = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const look = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const cull = createViewCull();
  const px = new THREE.Vector2();
  const cadence = createSunCadence();
  let distance: DistanceLevel = "medium";
  let plain = false;
  /** The GPU sky and the cloud by the DISTANCE row — or, under a PLAIN sky,
   * the baked table and the shell, whose layers the dome no longer reads. */
  const skyTiers = (): void => {
    gpu.setTier(plain ? "low" : SKY_TIER[distance]);
    clouds.setTier(plain ? "shell" : CLOUD_TIER[distance]);
  };

  return {
    haze,
    sun,
    dome,
    gpu,
    clouds,
    contrails,
    update(sky, camera, y, cloud, steady = false, ahead = null, far = 0) {
      writeHaze(haze, sky);
      haze.uFar.value.set(horizonDip(far), far);
      gpu.update(sky, camera);
      clouds.update(sky, cloud?.level ?? null, cloud?.t ?? 0, camera);
      contrails.update(
        sky,
        cloud?.level ?? null,
        cloud?.t ?? 0,
        camera,
        gl ? gl.getDrawingBufferSize(px).y : 720,
      );
      dome.update(sky);
      ranges.update(sky);
      // The key is the sun by day and the moon by night (`sky.ts`).
      sun.color.setRGB(...sky.keyColour);
      sun.intensity = sky.keyIntensity;
      hemi.color.setRGB(...sky.skyLight);
      hemi.groundColor.setRGB(...sky.groundLight);
      hemi.intensity = sky.ambient;
      camera.getWorldDirection(look);
      aimShadow(box, camera.position.x, camera.position.z, look.x, look.z, box.reach);
      box.y = y;
      // The key's direction, kept a hair over the horizon so the box has a
      // light to stand under, and STEPPED as it turns with the sky's clock
      // (`steadyKey`), so the box's frame stands between steps and its
      // texel snap holds the shadows' edges still.
      steadyKey(sky.key, dir);
      box.sx = dir.x;
      box.sy = dir.y;
      box.sz = dir.z;
      // Drawn every other frame while it can stand (`sunDue`): its matrix stands with it.
      sun.shadow.autoUpdate = !sun.castShadow || sunDue(cadence, box, steady && hero);
      haze.uShadowFade.value.x = box.x;
      haze.uShadowFade.value.y = box.z;
      // Snap the box's centre to whole texels in the light's own frame.
      lightSpace.lookAt(dir, origin, up);
      inv.copy(lightSpace).invert();
      at.set(box.x, box.y, box.z).applyMatrix4(inv);
      at.x = Math.round(at.x / texel) * texel;
      at.y = Math.round(at.y / texel) * texel;
      at.applyMatrix4(lightSpace);
      sun.target.position.copy(at);
      sun.position.copy(at).addScaledVector(dir, KEY_DISTANCE);
      sun.target.updateMatrixWorld();
      terrain.update(sky.key, sun.castShadow, ahead);
      dome.follow(camera);
      cull.aim(camera, sun.castShadow ? box : null);
    },
    cull,
    shadow() {
      return sun.castShadow ? box : null;
    },
    setShadow,
    setDistance(next) {
      distance = next;
      haze.uMist.value = mistFor(next);
      skyTiers();
      contrails.setTier(next);
      ranges.setTier(FAR_TIER[next]);
    },
    setSky(next) {
      plain = next === "plain";
      dome.setPlain(plain);
      skyTiers();
    },
    setHorizon(next) {
      ranges.setPainted(next === "painted");
      dome.setSkyline(ranges.silhouette());
    },
    setAloft(look) {
      haze.uMist.value = look.mist;
      haze.uMistAloft.value = look.aloft;
    },
    far: ranges,
    async setGround(level, key) {
      const ground = level?.ground ?? null;
      gpu.setGround(ground);
      const shade = terrain.setGround(ground, key, sun.castShadow);
      ranges.setLevel(level, key, level ? await farFaceGrid(level) : null);
      dome.setSkyline(ranges.silhouette());
      // The cloud volume's noise too, so the warm that follows finds it.
      await Promise.all([shade, clouds.prepare()]);
    },
    shadeSettled: () => terrain.settled(),
    warm(gl, scene, camera, span, run) {
      // The sky as the run's first frame will stand it, so the dome is
      // warmed reading the clouds the way it will.
      const look = skyLookAt(run.level, run.t, undefined, camera.position.y);
      // The shadows first: three's pass reads the render state the last
      // whole render left, and the clouds' passes leave none.
      warmShadows(gl, scene, sun, span);
      clouds.warm(look, run.level, run.t, camera);
      dome.syncClouds();
      warmPicture(gl, scene, camera);
    },
    warmNode(gl, scene, camera, span, frame, quarantine, run) {
      const look = skyLookAt(run.level, run.t, undefined, camera.position.y);
      clouds.warm(look, run.level, run.t, camera);
      dome.syncClouds();
      warmNode(gl, scene, camera, sun, span, frame, quarantine);
    },
    dispose() {
      gpu.dispose();
      clouds.dispose();
      terrain.dispose();
      dome.dispose();
      ranges.dispose();
      sun.shadow.map?.dispose();
    },
  };
}
