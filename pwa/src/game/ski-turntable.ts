// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI CARD'S TURNTABLE: the real in-game pair, with the real skier
// standing on it, on its own little canvas and turning.
//
// It is `createSkisModel` — the builder the race draws with — off the
// pair's own spec, in its own topsheet, stood at
// rest on a disc of snow at its own height: the skier tall on his skis at
// the sag his legs settle at, the poles hanging from his fists, so the
// downhill ski's length, the slalom ski's stubby waist and the powder
// ski's shovel are visible before a single bar beside it has been read.
// He wears the player's outfit (`outfit.ts`), because he is the player —
// and on the DRESS card the same stand, framed on HIM rather than on the
// pair (`frameOn: "skier"`), shows each piece of kit as it is picked.
//
// The eye line is a person standing beside the skier — a little above,
// looking slightly DOWN — the angle a pair is admired from on the rack,
// and the one that shows the topsheet and the sidecut at once.
//
// This module owns three.js, so it is loaded as its own chunk
// (`ski-picker.tsx` imports it dynamically): the entry script's critical
// path must not carry the render stack.

import * as THREE from "three";
import { freshSkier, type SkiSpec } from "@engine";

import { outfitKey } from "./dress.ts";
import { carriesPoles, DEFAULT_OUTFIT, type Outfit } from "./outfit.ts";
import { createSkisModel, pairStyle, REST_SAG, type SkisModel } from "./skis-body.ts";

export { loadModels } from "./skier-models.ts";

/** WHERE THE VIEWER STANDS, as a direction: the eye is this high for every
 * metre it is back. How FAR back is worked out from the skier and the
 * canvas's shape (`frame`), so a phone's tall pane and a laptop's wide one
 * are both filled with skier rather than with backdrop. */
const EYE_RISE = 0.34;
/** The air left round the skier, as a multiple of the distance the skis
 * alone would need. */
const FRAME_MARGIN = 1.3;
/** Where on the skier's height the lens aims, as a share of it. Below the
 * middle, because the plates across the head and the foot of the pane are
 * not the same height: the billing under the skier is two lines on a
 * phone, and a skier framed about his middle has his skis under him. */
const AIM = 0.35;
/** On the DRESS card: how far round the skier the frame must reach, m,
 * and where on his height it aims — the skier filling the pane, the skis'
 * tips let run out of it as they come round. */
const SKIER_REACH = 0.5;
const SKIER_AIM = 0.5;
/** One revolution every this many seconds — slow enough to read a topsheet. */
const SPIN_PERIOD = 16;
/** The pose's own heading, so a still frame (reduced motion, a screenshot)
 * shows the skier three-quarters on rather than tips to the lens. */
const START_ANGLE = 2.3;

export type SkisTurntable = {
  /** Swap the pair on the stand; the spin carries on from where it was.
   * The model is built on the next frame, not inside this call, so a skier
   * rowing through the arrows builds only the one they stop on. */
  setSkis: (spec: SkiSpec, outfit?: Outfit) => void;
  /** Match the canvas to its box after a layout change. */
  resize: () => void;
  dispose: () => void;
};

/** The card's scene has no haze, so the builder's material hook is a
 * no-op here. */
const plain = <M extends THREE.Material>(m: M): M => m;

export function createSkisTurntable(
  canvas: HTMLCanvasElement,
  frameOn: "pair" | "skier" = "pair",
): SkisTurntable {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  // No sky in this scene, so a rig of its own: a low winter key from over
  // one shoulder, and a hemisphere of sky blue over snow white.
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(0.5, 0.8, 0.6).normalize().multiplyScalar(10);
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0xbcd8f2, 0xf4f8fb, 1.3));

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

  // THE SNOW: a disc at y = 0, which is where the machine's own snow line
  // is stood (the model's origin is the CoG, `spec.cogHeight` up).
  const snow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.9 }),
  );
  snow.rotation.x = -Math.PI / 2;
  scene.add(snow);

  // The skier turns; the snow does not.
  const pivot = new THREE.Group();
  scene.add(pivot);

  let model: SkisModel | null = null;
  let shown: string | null = null;
  let pending: { spec: SkiSpec; outfit: Outfit } | null = null;
  /** How far the skier reaches from the spin axis, and how tall he
   * stands — measured off the model that was built. */
  let radius = 2;
  let top = 1.4;
  const box = new THREE.Box3();

  const clear = (): void => {
    if (!model) return;
    pivot.remove(model.root);
    model.dispose();
    model = null;
  };

  const frame = (): void => {
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const pitch = Math.atan(EYE_RISE);
    const middle = top / 2;
    const vNeed = middle * Math.cos(pitch) + radius * Math.sin(pitch);
    const dist = FRAME_MARGIN * Math.max(vNeed / Math.tan(vHalf), radius / Math.tan(hHalf));
    const back = dist / Math.hypot(1, EYE_RISE);
    const aim = top * (frameOn === "skier" ? SKIER_AIM : AIM);
    camera.position.set(0, aim + back * EYE_RISE, -back);
    camera.lookAt(0, aim, 0);
  };

  const keyOf = (spec: SkiSpec, outfit: Outfit) => `${spec.id}:${outfitKey(outfit)}`;
  const build = (spec: SkiSpec, outfit: Outfit): void => {
    clear();
    shown = keyOf(spec, outfit);
    model = createSkisModel(spec, pairStyle(spec, { outfit }), plain);
    // ...with his poles in his hands, or none (`carriesPoles`).
    const rest = { ...freshSkier(spec), poles: carriesPoles(outfit) };
    rest.skiCompression[0] = REST_SAG;
    rest.skiCompression[1] = REST_SAG;
    model.pose(rest, { x: 0, y: spec.cogHeight, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } }, 0);
    pivot.add(model.root);
    // The pose moved the root; its world matrices are not refreshed until a
    // render, and a box measured off stale ones frames the skier where he
    // was built rather than where it stands.
    pivot.rotation.y = 0;
    pivot.updateMatrixWorld(true);
    box.setFromObject(model.root);
    // It TURNS, so what has to fit is the circle its plan sweeps, not the
    // box: the far corner is the constraint at every angle.
    radius = Math.max(
      Math.hypot(box.min.x, box.min.z),
      Math.hypot(box.min.x, box.max.z),
      Math.hypot(box.max.x, box.min.z),
      Math.hypot(box.max.x, box.max.z),
    );
    if (frameOn === "skier") radius = SKIER_REACH;
    top = box.max.y;
    snow.scale.setScalar(Math.max(radius, 1.1) * 1.2);
    frame();
  };

  const cut = new THREE.Vector2();
  /** Match the buffer to the canvas box, unless it already is — checked in
   * device pixels too, because a backing store a mobile browser reclaimed
   * still reports the size three last asked for. */
  const resize = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const ratio = renderer.getPixelRatio();
    renderer.getSize(cut);
    if (
      cut.x === w &&
      cut.y === h &&
      canvas.width === Math.floor(w * ratio) &&
      canvas.height === Math.floor(h * ratio)
    ) {
      return;
    }
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frame();
    camera.updateProjectionMatrix();
  };

  const still =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let last = performance.now();
  let angle = START_ANGLE;
  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick);
    // Every frame: a resize EVENT is not the only way a canvas changes size.
    resize();
    if (pending) {
      const { spec, outfit } = pending;
      pending = null;
      build(spec, outfit);
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!still) angle += (dt * Math.PI * 2) / SPIN_PERIOD;
    pivot.rotation.y = angle;
    renderer.render(scene, camera);
  };
  resize();
  raf = requestAnimationFrame(tick);

  return {
    setSkis: (spec, outfit = DEFAULT_OUTFIT) => {
      pending = shown === keyOf(spec, outfit) ? null : { spec, outfit };
    },
    resize,
    dispose: () => {
      cancelAnimationFrame(raf);
      clear();
      snow.geometry.dispose();
      (snow.material as THREE.Material).dispose();
      renderer.dispose();
    },
  };
}
