// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WILDLIFE LAB's page (driven by `scripts/birds-preview.mjs`): every
// bird and every animal of the roster, side by side, as one labelled
// contact sheet.
//
// IT EXISTS BECAUSE A SCREENSHOT OF A RACE CANNOT REVIEW A ROSTER. A bird in
// a race is a dozen pixels forty metres up, and an animal is whichever one
// that stretch of wood happened to hold, at whatever point of its round the
// frame caught — so a raven whose tail is too wide and a reindeer whose legs
// are too short both come back as "there are animals". The roster is a
// LADDER of silhouettes (a raven is a wedge-tailed cross, a grouse a round
// paddle, an eagle a plank; a fox is its brush, a moose its legs) and a
// ladder is judged side by side or not at all.
//
// One cell a species, each drawn THREE times through the very geometry and
// material the game uses (the wing hinges and the legs are the shader's):
// a bird gliding, mid-downstroke and folded at rest, seen from below and
// ahead, where the snow sees a bird from; an animal stood, in full stride
// and with its head down, seen from the side a little above, over snow.
// A metre rule runs across every cell. `?models=1` draws the MODELLED
// roster (`bird-models.ts`, `beast-models.ts` — the glTFs the lab copied
// beside the page) as the game draws it, and `?models=compare` each
// species twice, the code's cell then its model's.
//
// Sets `window.__done` when the sheet is on screen.

import * as THREE from "three";

import { BEASTS, beastRarity, type BeastSpec } from "../game/beast-defs.ts";
import { beastModel, loadBeastModels } from "../game/beast-models.ts";
import { BEAST_STYLES, beastMaterial, buildBeast } from "../game/beast-shapes.ts";
import { BIRDS, birdRarity, type BirdSpec } from "../game/bird-defs.ts";
import { birdModel, loadBirdModels } from "../game/bird-models.ts";
import { BIRD_STYLES, birdMaterial, buildBird } from "../game/bird-shapes.ts";
import { createHazeUniforms } from "../game/haze.ts";

/** One cell, px, and how many a row before the sheet wraps. */
const CELL_W = 340;
const CELL_H = 280;
const COLS = 4;

type Cell = { name: string; foot: string; draw: (scene: THREE.Scene) => THREE.Camera };

const query = new URLSearchParams(location.search);
const models = query.get("models");

const haze = createHazeUniforms();
// No haze at a few metres, and a winter noon's light to judge the paint by.
haze.uHaze.value = 0;

/** Which rows this run wants, off the page's own query string. */
function chosen<T extends { id: string }>(rows: readonly T[]): readonly T[] {
  const asked = new URLSearchParams(location.search).get("rows");
  if (!asked) return rows;
  const want = new Set(asked.split(",").map((s) => s.trim().toLowerCase()));
  return rows.filter((r) => want.has(r.id));
}

/** The metre rule: alternating bands a metre long lying along the cell. */
function rule(length: number, y: number): THREE.Group {
  const group = new THREE.Group();
  const dark = new THREE.MeshBasicMaterial({ color: 0x11181d });
  const pale = new THREE.MeshBasicMaterial({ color: 0xe8eef2 });
  for (let m = 0; m < Math.ceil(length); m++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.03), m % 2 ? pale : dark);
    band.position.set(m + 0.5 - length / 2, y, 0.6);
    group.add(band);
  }
  return group;
}

function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xdfeaf6, 0x9aa8b8, 1.6));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.9);
  key.position.set(-0.55, 0.72, 0.42);
  scene.add(key);
}

function birdCell(spec: BirdSpec, model: boolean): Cell {
  const poses = [
    { flap: spec.dihedral, fold: 0 },
    { flap: -spec.stroke * 0.8, fold: 0 },
    { flap: -0.3, fold: 1 },
  ];
  return {
    name: `${spec.name}${model ? " (model)" : ""} — ${spec.regions.join(" · ")}`,
    foot:
      `span ${spec.span} m · ${spec.beatHz} Hz · glide ${spec.glide} · ` +
      (spec.home ? `${spec.home} · ${birdRarity(spec)}` : `crosses day ${spec.passage?.days.min}+`),
    draw(scene) {
      const gap = Math.max(spec.span * 0.62, 0.45);
      poses.forEach((p, k) => {
        const modelled = model ? birdModel(spec, BIRD_STYLES[spec.id]) : null;
        const geometry = modelled ?? buildBird(spec, BIRD_STYLES[spec.id]);
        geometry.setAttribute(
          "aFlap",
          new THREE.InstancedBufferAttribute(new Float32Array([p.flap]), 1),
        );
        geometry.setAttribute(
          "aFold",
          new THREE.InstancedBufferAttribute(new Float32Array([p.fold]), 1),
        );
        const mesh = new THREE.InstancedMesh(geometry, birdMaterial(spec, haze, !modelled), 1);
        mesh.setMatrixAt(0, new THREE.Matrix4());
        mesh.position.set((k - 1) * gap, k === 2 ? spec.length * 0.16 : spec.span * 0.55, 0);
        mesh.rotation.y = -0.55;
        scene.add(mesh);
      });
      scene.add(rule(Math.max(1, Math.ceil(gap * 2 + spec.span)), -0.05));
      const frameW = gap * 2 + spec.span * 1.3;
      const frameH = (frameW * CELL_H) / CELL_W;
      const dist = frameW * 4;
      const camera = new THREE.OrthographicCamera(
        -frameW / 2,
        frameW / 2,
        frameH / 2,
        -frameH / 2,
        0.1,
        dist * 3,
      );
      camera.position.set(0, spec.span * 0.3 - dist * 0.42, dist);
      camera.lookAt(0, spec.span * 0.3, 0);
      return camera;
    },
  };
}

function beastCell(spec: BeastSpec, model: boolean): Cell {
  const poses = [
    { gait: 0, stride: 0, graze: 0 },
    { gait: 1.2, stride: 1, graze: 0 },
    { gait: 0, stride: 0, graze: 1 },
  ];
  return {
    name: `${spec.name}${model ? " (model)" : ""} — ${spec.regions.join(" · ")}`,
    foot:
      `${spec.length} m · ${spec.height} m at the shoulder · ${spec.gait} · ` +
      `${spec.home} · ${beastRarity(spec)}`,
    draw(scene) {
      const gap = spec.length * 1.35;
      const snow = new THREE.Mesh(
        new THREE.PlaneGeometry(gap * 6, gap * 4),
        new THREE.MeshLambertMaterial({ color: 0xeef3f8 }),
      );
      snow.rotation.x = -Math.PI / 2;
      scene.add(snow);
      poses.forEach((p, k) => {
        const modelled = model ? beastModel(spec, BEAST_STYLES[spec.id]) : null;
        const { geometry, pivot } = modelled ?? buildBeast(spec, BEAST_STYLES[spec.id]);
        const attr = (v: number) => new THREE.InstancedBufferAttribute(new Float32Array([v]), 1);
        geometry.setAttribute("aGait", attr(p.gait));
        geometry.setAttribute("aStride", attr(p.stride));
        geometry.setAttribute("aGraze", attr(p.graze));
        const mesh = new THREE.InstancedMesh(
          geometry,
          beastMaterial(spec, pivot, haze, !modelled),
          1,
        );
        mesh.setMatrixAt(0, new THREE.Matrix4());
        mesh.position.set((k - 1) * gap, 0, 0);
        // Side on, a little toward the lens: the silhouette and the face.
        mesh.rotation.y = Math.PI / 2 - 0.35;
        scene.add(mesh);
      });
      scene.add(rule(Math.ceil(gap * 3), 0.01));
      const frameW = gap * 3.2;
      const frameH = (frameW * CELL_H) / CELL_W;
      const dist = frameW * 4;
      const camera = new THREE.OrthographicCamera(
        -frameW / 2,
        frameW / 2,
        frameH / 2,
        -frameH / 2,
        0.1,
        dist * 3,
      );
      camera.position.set(0, spec.height * 0.6 + dist * 0.25, dist);
      camera.lookAt(0, spec.height * 0.6, 0);
      return camera;
    },
  };
}

async function main(): Promise<void> {
  if (models) await Promise.all([loadBirdModels("./"), loadBeastModels("./")]);
  /** Each species once, or twice under `compare`: the code's, then the model's. */
  const twice = <T>(rows: readonly T[], cell: (r: T, model: boolean) => Cell): Cell[] =>
    rows.flatMap((r) =>
      models === "compare" ? [cell(r, false), cell(r, true)] : [cell(r, models === "1")],
    );
  const cells: Cell[] = [...twice(chosen(BIRDS), birdCell), ...twice(chosen(BEASTS), beastCell)];
  const rows = Math.ceil(cells.length / COLS);
  const sheetCanvas = document.getElementById("stage") as HTMLCanvasElement;
  sheetCanvas.width = CELL_W * Math.min(COLS, cells.length);
  sheetCanvas.height = CELL_H * rows;
  const sheet = sheetCanvas.getContext("2d") as CanvasRenderingContext2D;

  const cell = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas: cell, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setSize(CELL_W, CELL_H, false);
  // A pale winter sky behind every cell.
  renderer.setClearColor(new THREE.Color(0x9fb9cf));

  const labels = document.getElementById("labels") as HTMLDivElement;
  const addLabel = (text: string, col: number, row: number, dy: number, cls = ""): void => {
    const div = document.createElement("div");
    div.className = `label ${cls}`.trim();
    div.textContent = text;
    div.style.left = `${col * CELL_W}px`;
    div.style.top = `${row * CELL_H + dy}px`;
    labels.appendChild(div);
  };

  cells.forEach((c, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const scene = new THREE.Scene();
    lights(scene);
    const camera = c.draw(scene);
    renderer.render(scene, camera);
    sheet.drawImage(cell, col * CELL_W, row * CELL_H);
    addLabel(c.name, col, row, 6);
    addLabel(c.foot, col, row, CELL_H - 40, "foot");
  });

  renderer.dispose();
  cell.remove();
  (window as unknown as { __done: boolean }).__done = true;
}

void main();
