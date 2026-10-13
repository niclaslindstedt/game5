// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GEAR STAGE — the rider card and the gear card's one picture, behind
// both cards and across the whole screen: the rider stood on the snow at
// the top of a run (`stage-backdrop.ts`), lit by a low winter sun, his
// shadow on the corduroy.
//
//   * ON THE RIDER CARD he is off his skis, in his boots, waiting at ease
//     (`rider-idle.ts`): his weight from one leg to the other, his gloves
//     beaten together, a look up the hill — framed on HIM, so each piece of
//     kit is judged on him.
//   * ON THE GEAR CARD he stands on the pair picked, the poles in his
//     hands, alive on them as he waits at a start line (the pose's own
//     idle) — framed on him and the pair, three-quarters on, so the
//     pair's length and shape read beside him.
//
// Nothing turns on a disc: the lens moves between the two framings when
// the card changes, and a drag across the picture walks it round him. The
// picture is framed in the part of the screen the card leaves free
// (`setFree`), so the skier is never under the glass.
//
// This module owns three.js, so it is loaded as its own chunk
// (`menu-stage.tsx` imports it dynamically): the entry script's critical
// path must not carry the render stack.

import * as THREE from "three";
import { freshSkier, isBoard, pairById, type SkiSpec, type SkierState } from "@engine";

import { holdHands } from "./backdrop-hold.ts";
import { outfitKey } from "./dress.ts";
import { carriesPoles, DEFAULT_OUTFIT, type Outfit } from "./outfit.ts";
import { idlePose, idleRoom } from "./rider-idle.ts";
import { createSkisModel, pairStyle, REST_SAG, type SkisModel } from "./skis-body.ts";
import { createBackdrop, HAZE, SUN_DIR } from "./stage-backdrop.ts";

export { loadModels } from "./skier-models.ts";

/** Which card the stage is behind. */
export type StageShot = "rider" | "gear";

/** Where the screen is free of the card, as shares of the canvas: the
 * skier is framed inside it. */
export type FreeRect = { x: number; y: number; w: number; h: number };

/** EACH CARD'S FRAMING: the subject's turn to the lens (rad, 0 facing it),
 * the height on him the lens aims at and stands at, m, how much of him
 * must fit (the height, m, and the half width round him), and the lens. */
const SHOTS: Record<
  StageShot,
  { turn: number; aim: number; eye: number; tall: number; half: number; fov: number }
> = {
  rider: { turn: 0.45, aim: 0.95, eye: 1.1, tall: 2.35, half: 0.6, fov: 30 },
  // The gear from ABOVE and close: the lens up over his shoulder looking
  // down on the pair, so the skis' or the board's top, shape and sidecut
  // read — his head may leave the frame.
  gear: { turn: 1.3, aim: 0.18, eye: 2.6, tall: 1.35, half: 1.05, fov: 30 },
};
/** How quickly the lens settles on a new framing, 1/s. */
const SETTLE = 3.2;
/** The drag's turn, rad per pixel across, and how far either way it may
 * walk the lens round him. */
const DRAG = 0.008;
const DRAG_MOST = 2.6;
/** The world's own haze: thin near, the far range half gone. */
const FOG = 0.00009;
/** The skis' fallback when a board is the pair picked: the rider card
 * stands him off his gear, so any pair carries the figure. */
const FIGURE_PAIR = "chamois";

export type GearStage = {
  /** The card, the pair and the kit; the model is built on the next frame,
   * so a skier rowing through the arrows builds only the one they stop on. */
  set: (shot: StageShot, spec: SkiSpec, outfit?: Outfit) => void;
  /** The part of the canvas the card leaves free, as shares of it. */
  setFree: (free: FreeRect) => void;
  /** Match the canvas to its box after a layout change. */
  resize: () => void;
  /** Stop drawing (a stage stood up ahead of its card, off the page) or
   * start again; a held stage builds what it was last asked to at once
   * and draws one frame, so its shaders are compiled before it is shown. */
  hold: (held: boolean) => void;
  /** The other kind's pair on the gear card — the board where skis are
   * picked, the skis where a board is — built and compiled by a held
   * stage too, so the SKIS / SNOWBOARD switch builds nothing either. */
  spare: (spec: SkiSpec | null) => void;
  dispose: () => void;
};

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

export function createGearStage(canvas: HTMLCanvasElement): GearStage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(HAZE.getHex(), FOG);
  const backdrop = createBackdrop();
  scene.add(backdrop.group);

  // THE LIGHT: the low sun, its shadow cut close round the skier so his
  // own is sharp on the corduroy, and the sky's blue fill over the snow's
  // bounce.
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.6);
  sun.position.copy(SUN_DIR).multiplyScalar(30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -4;
  sc.right = 4;
  sc.top = 4;
  sc.bottom = -4;
  sc.near = 10;
  sc.far = 60;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x9cc4ee, 0xdfe7f0, 1.0));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60000);
  const pivot = new THREE.Group();
  scene.add(pivot);

  let model: SkisModel | null = null;
  let rest: SkierState | null = null;
  let shown: string | null = null;
  /** The kit last asked for, so a held stage can stand it up on the other
   * card too. */
  let kit: Outfit = DEFAULT_OUTFIT;
  let pick: SkiSpec | null = null;
  /** A model built for the OTHER card and kept for it — a board's rider
   * stands on a pair of skis on the rider card and on his board on the
   * gear card, two models; the one waiting is built ahead (`hold`), so
   * NEXT never builds a skier. */
  const kept = new Map<string, { model: SkisModel; rest: SkierState }>();
  /** The other kind's pair for the gear card, and the keys built for it —
   * kept through every build until the stage goes (`spare`). */
  let other: SkiSpec | null = null;
  const spares = new Set<string>();
  let pending: { shot: StageShot; spec: SkiSpec; outfit: Outfit } | null = null;
  let shot: StageShot = "rider";
  let free: FreeRect = { x: 0, y: 0, w: 1, h: 1 };
  let clock = 0;

  const clear = (): void => {
    if (!model) return;
    pivot.remove(model.root);
    model.dispose();
    model = null;
  };
  /** The model on show put by, under its key, rather than thrown away. */
  const putBy = (): void => {
    if (!model || !rest || shown === null) return;
    pivot.remove(model.root);
    kept.set(shown, { model, rest });
    model = null;
  };
  const dropKept = (...but: string[]): void => {
    for (const [k, m] of kept) {
      if (but.includes(k) || spares.has(k)) continue;
      m.model.dispose();
      kept.delete(k);
    }
  };

  /** What is drawn: off his gear on the rider card (a board's rider on a
   * pair of skis, which are put away), on the pair picked on the gear
   * card. */
  const drawnSpec = (s: StageShot, spec: SkiSpec): SkiSpec =>
    s === "rider" && isBoard(spec) ? pairById(FIGURE_PAIR) : spec;
  const keyOf = (s: StageShot, spec: SkiSpec, outfit: Outfit): string =>
    `${drawnSpec(s, spec).id}:${outfitKey(outfit)}`;

  /** Stood off his gear or on it, the poles in his hands or not — the
   * same model either way, so the card changing never rebuilds it. */
  const dress = (s: StageShot, outfit: Outfit): void => {
    if (!model || !rest) return;
    rest.poles = s === "gear" && carriesPoles(outfit);
    const room = idleRoom(outfit);
    model.setStood?.(
      s === "rider" ? (ground, frame) => idlePose(clock, ground, frame, room) : null,
    );
  };

  const build = (s: StageShot, given: SkiSpec, outfit: Outfit): void => {
    const key = keyOf(s, given, outfit);
    const other = s === "rider" ? keyOf("gear", given, outfit) : keyOf("rider", given, outfit);
    // The other card's model is kept only while it is the same pick's.
    if (other !== key && shown === other) putBy();
    else clear();
    dropKept(other, key);
    shown = key;
    const waiting = kept.get(key);
    if (waiting) {
      kept.delete(key);
      model = waiting.model;
      rest = waiting.rest;
      dress(s, outfit);
      pivot.add(model.root);
      return;
    }
    ({ model, rest } = make(s, given, outfit));
    dress(s, outfit);
    pivot.add(model.root);
  };
  /** A model of `given` for card `s`, stood at rest, not yet on the stage. */
  function make(s: StageShot, given: SkiSpec, outfit: Outfit) {
    const spec = drawnSpec(s, given);
    const made = createSkisModel(spec, pairStyle(spec, { outfit, model: true }), (m) => m);
    const fresh = freshSkier(spec);
    fresh.skiCompression[0] = REST_SAG;
    fresh.skiCompression[1] = REST_SAG;
    for (const m of made.casters) m.castShadow = true;
    made.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return { model: made, rest: fresh };
  }

  // THE LENS: eased toward the framing the card asks for, round him by the
  // drag.
  const lens = { turn: SHOTS.rider.turn, aim: SHOTS.rider.aim, eye: SHOTS.rider.eye, dist: 5 };
  let drag = 0;
  let dragTo = 0;
  const target = { turn: 0, aim: 0, eye: 0, dist: 0 };

  /** How far back the lens must stand to fit the shot into the free part
   * of the canvas. */
  const distanceFor = (s: StageShot): number => {
    const f = SHOTS[s];
    camera.fov = f.fov;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const vHalf = Math.atan(Math.tan((f.fov * Math.PI) / 360) * free.h);
    const aspect = (free.w * w) / Math.max(1, free.h * h);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const margin = 1.12;
    return margin * Math.max(f.tall / 2 / Math.tan(vHalf), f.half / Math.tan(hHalf));
  };

  const place = (dt: number): void => {
    const f = SHOTS[shot];
    target.turn = f.turn;
    target.aim = f.aim;
    target.eye = f.eye;
    target.dist = distanceFor(shot);
    const k = dt <= 0 ? 1 : 1 - Math.exp(-SETTLE * dt);
    lens.turn += (target.turn - lens.turn) * k;
    lens.aim += (target.aim - lens.aim) * k;
    lens.eye += (target.eye - lens.eye) * k;
    lens.dist += (target.dist - lens.dist) * k;
    drag += (dragTo - drag) * (dt <= 0 ? 1 : 1 - Math.exp(-8 * dt));
    // He faces the lens down the run's fall line (−z), turned by the
    // framing; the drag walks the lens round him.
    pivot.rotation.y = Math.PI - lens.turn;
    const a = drag;
    // A slow breath in the lens, so a still frame is never a photograph.
    const sway = 0.02 * Math.sin(clock * 0.4);
    const flat = Math.sqrt(Math.max(0.01, lens.dist ** 2 - (lens.eye - lens.aim) ** 2));
    camera.position.set(Math.sin(a) * flat + sway, lens.eye, -Math.cos(a) * flat);
    camera.lookAt(0, lens.aim, 0);
    // The subject in the middle of the FREE part of the canvas: the
    // projection shifted by the difference.
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const cx = (free.x + free.w / 2) * w;
    const cy = (free.y + free.h / 2) * h;
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    camera.updateProjectionMatrix();
  };

  const cut = new THREE.Vector2();
  const resize = (): void => {
    // Off the page (held ahead of its card) it keeps the size it was given.
    if (canvas.clientWidth === 0) return;
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
  };

  // THE DRAG: a pointer across the picture walks the lens round him.
  let downX: number | null = null;
  const onDown = (e: PointerEvent): void => {
    if (downX === null) holdHands(true);
    downX = e.clientX;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent): void => {
    if (downX === null) return;
    dragTo = Math.max(-DRAG_MOST, Math.min(DRAG_MOST, dragTo + (e.clientX - downX) * DRAG));
    downX = e.clientX;
  };
  const onUp = (): void => {
    if (downX !== null) holdHands(false);
    downX = null;
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  const still =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let last = performance.now();
  let first = true;
  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick);
    frame(now);
  };
  const frame = (now: number): void => {
    resize();
    if (pending) {
      const p = pending;
      pending = null;
      build(p.shot, p.spec, p.outfit);
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const step = still ? 0 : dt;
    clock += step;
    place(first ? 0 : dt);
    first = false;
    if (model && rest) {
      // On his skis he is stood still at the legs' rest: the spring's own
      // idle sinks him into a crouch a skier at a standstill never holds.
      model.pose(
        rest,
        { x: 0, y: rest.spec.cogHeight, z: 0, q: IDENTITY },
        0,
        null,
        shot === "rider" ? step : 0,
      );
    }
    renderer.render(scene, camera);
  };
  resize();
  raf = requestAnimationFrame(tick);

  /** THE WARM-UP, for a stage held off the page ahead of its card: every
   * cost the cards would otherwise pay on the frames the player is turning
   * the rider round — the drawing buffer at the screen's size, the model
   * for each card (a board's rider is two), and every program either card
   * draws, his poles in hand or not, compiled whether or not it is in the
   * lens (`compile` reaches what a framing would cull). It ends stood on
   * the card it was asked for. */
  const warmUp = (): void => {
    if (canvas.clientWidth === 0) {
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / Math.max(1, innerHeight);
    }
    const now = performance.now();
    frame(now);
    if (!pick) return;
    const asked = shot;
    for (const s of [asked === "rider" ? "gear" : "rider", asked] as const) {
      shot = s;
      if (shown !== keyOf(s, pick, kit)) build(s, pick, kit);
      else dress(s, kit);
      frame(now);
      renderer.compile(scene, camera);
    }
    // The other kind's pair, built and compiled beside him, then put by.
    if (!other) return;
    const key = keyOf("gear", other, kit);
    if (key === shown || kept.has(key)) return;
    const made = make("gear", other, kit);
    made.rest.poles = carriesPoles(kit);
    pivot.add(made.model.root);
    renderer.compile(scene, camera);
    pivot.remove(made.model.root);
    kept.set(key, made);
    spares.add(key);
  };

  return {
    set: (next, spec, outfit = DEFAULT_OUTFIT) => {
      shot = next;
      kit = outfit;
      pick = spec;
      if (shown === keyOf(next, spec, outfit)) {
        pending = null;
        dress(next, outfit);
      } else pending = { shot: next, spec, outfit };
    },
    setFree: (f) => {
      free = f;
    },
    resize,
    hold: (held) => {
      cancelAnimationFrame(raf);
      if (held) {
        warmUp();
        return;
      }
      // Shown at last: the lens stands on its framing for the real canvas
      // at once rather than easing in from the off-page one.
      first = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    spare: (spec) => {
      other = spec;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      spares.clear();
      onUp();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      clear();
      dropKept();
      backdrop.dispose();
      renderer.dispose();
      // The CONTEXT goes too, now rather than whenever the canvas is
      // collected: RIDE stands a whole mountain up next, and a phone
      // browser counts this context against the tab.
      renderer.forceContextLoss();
    },
  };
}
