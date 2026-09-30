// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREE LAB's page (driven by `scripts/trees-preview.mjs`): every kind of
// tree and every one of its ten variants, side by side, as one labelled
// contact sheet — a row a kind, a column a variant.
//
// IT EXISTS BECAUSE A WOOD HIDES ITS TREES. In a race a tree is one of a
// thousand, half behind the next, at whatever distance the lens passed it;
// whether the ten spruces are ten or one spruce copied is the one thing a
// frame of the game cannot answer. Side by side at one size, through the
// very geometry and material the game draws (`tree-shapes.ts` over
// `hazeMaterial`), under a winter noon, the ladder of silhouettes is plain.
//
// Every tree stands 14 m tall on the same crown, over snow, SEEN FROM THE
// SADDLE: a lens at the skier's head (2.2 m, the chase lens's height and
// the one the forest lab's sightlines ride at) standing `STAND` metres off
// and looking up the tree — so what the sheet shows under a crown is what a
// skier sees under it — with a metre rule along the snow at the foot. `?sketch=1` draws the far band's sketches
// instead; `?region=<id>` the region's paint; `?kinds=pine,larch` a subset;
// `?models=1` the MODELLED trees (`tree-models.ts`, the glTFs the lab copied
// beside the page) as the forest draws them, and `?models=compare` each
// kind's code-built row with its modelled row under it.
//
// Sets `window.__done` when the sheet is on screen.

import * as THREE from "three";

import { TREE_KINDS, isRegionId, type RegionId, type TreeKind } from "@engine";

import { createHazeUniforms, hazeMaterial } from "../game/haze.ts";
import { regionLookOf } from "../game/region-look.ts";
import { loadTreeModels, treeModel } from "../game/tree-models.ts";
import { buildTree, treePaint } from "../game/tree-shapes.ts";
import { TREE_VARIANTS } from "../game/tree-variants.ts";

/** One cell, px. */
const CELL_W = 170;
const CELL_H = 260;
/** The tree every cell stands up, m. */
const HEIGHT = 14;
const CROWN = 3.2;
/** The skier's head over the snow, m, how far off the tree it stands, m,
 * and the lens's vertical field, degrees. */
const EYE = 2.2;
const STAND = 14;
const FOV = 62;

const query = new URLSearchParams(location.search);
const asked = query.get("region") ?? "alpine";
const region: RegionId = isRegionId(asked) ? asked : "alpine";
const sketch = query.get("sketch") === "1";
const models = query.get("models");
const want = query.get("kinds");
const kinds: readonly TreeKind[] = want
  ? TREE_KINDS.filter((k) => want.split(",").includes(k))
  : TREE_KINDS;

const haze = createHazeUniforms();
haze.uHaze.value = 0;

function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xdfeaf6, 0x9aa8b8, 1.5));
  const key = new THREE.DirectionalLight(0xfff0dc, 2);
  key.position.set(-0.6, 0.75, 0.5);
  scene.add(key);
}

/** Each row: a kind, and whether it is drawn off its models. */
const rows: readonly { kind: TreeKind; model: boolean }[] = kinds.flatMap((kind) =>
  models === "compare"
    ? [
        { kind, model: false },
        { kind, model: true },
      ]
    : [{ kind, model: models === "1" }],
);

async function main(): Promise<void> {
  if (models) await loadTreeModels("./");
  const cols = Math.max(...kinds.map((k) => TREE_VARIANTS[k].length));
  const sheetCanvas = document.getElementById("stage") as HTMLCanvasElement;
  sheetCanvas.width = CELL_W * cols;
  sheetCanvas.height = CELL_H * rows.length;
  const sheet = sheetCanvas.getContext("2d") as CanvasRenderingContext2D;

  const cell = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas: cell, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setSize(CELL_W, CELL_H, false);
  renderer.setClearColor(new THREE.Color(0x9fb9cf));

  const paint = treePaint(regionLookOf(region));
  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    haze,
    "tree",
  );
  const snowMaterial = new THREE.MeshLambertMaterial({ color: 0xeef3f8 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x11181d });
  const pale = new THREE.MeshBasicMaterial({ color: 0x5a6670 });

  const labels = document.getElementById("labels") as HTMLDivElement;
  const addLabel = (text: string, col: number, row: number, dy: number, cls = ""): void => {
    const div = document.createElement("div");
    div.className = `label ${cls}`.trim();
    div.textContent = text;
    div.style.left = `${col * CELL_W}px`;
    div.style.top = `${row * CELL_H + dy}px`;
    labels.appendChild(div);
  };

  rows.forEach(({ kind, model }, row) => {
    TREE_VARIANTS[kind].forEach((v, col) => {
      const scene = new THREE.Scene();
      lights(scene);
      const snow = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), snowMaterial);
      snow.rotation.x = -Math.PI / 2;
      scene.add(snow);
      const modelled = model ? treeModel(v, paint, sketch) : null;
      const geometry = modelled ?? buildTree(v, paint, sketch);
      const tree = new THREE.Mesh(geometry, material);
      tree.scale.set(CROWN * 0.95, HEIGHT, CROWN * 0.95);
      tree.rotation.y = 0.6;
      scene.add(tree);
      // A metre rule along the snow at the tree's foot.
      for (let m = -4; m < 4; m++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.08), m % 2 ? pale : dark);
        band.position.set(m + 0.5, 0.04, 2);
        scene.add(band);
      }
      // The skier's head, looking up the tree: the aim is tilted so the
      // foot sits near the bottom of the cell and the top near its top.
      const camera = new THREE.PerspectiveCamera(FOV, CELL_W / CELL_H, 0.1, 800);
      const tilt = (FOV / 2 - 14) * (Math.PI / 180);
      camera.position.set(0, EYE, STAND);
      camera.lookAt(0, EYE + Math.tan(tilt) * STAND, 0);
      renderer.render(scene, camera);
      sheet.drawImage(cell, col * CELL_W, row * CELL_H);
      const tag = model ? (modelled ? " · model" : " · NO MODEL") : "";
      addLabel(`${kind} ${col}${tag}`, col, row, 4);
      const tris = (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
      addLabel(`${v.name} · ${tris}`, col, row, CELL_H - 24, "foot");
      tree.geometry.dispose();
    });
  });

  renderer.dispose();
  cell.remove();
  (window as unknown as { __done: boolean }).__done = true;
}

void main();
