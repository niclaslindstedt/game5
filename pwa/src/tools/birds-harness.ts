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
// material the game uses (the wing hinges, the legs and the rack are the
// shader's): a bird gliding, mid-downstroke and folded at rest, seen from
// below and ahead, where the snow sees a bird from — each pose in the next
// of the species' FORMS (the cock, the hen, a first-winter bird); an animal
// stood (an old male, his rack full-grown), in full stride (a female) and
// with its head down (a youngster, where the species has one, at its own
// size), seen from the side a little above, over snow. A metre rule runs
// across every cell. `?lod=far` draws the FAR cut of every one, and
// `?lod=both` each species twice, its near cell then its far.
//
// Sets `window.__done` when the sheet is on screen.

import * as THREE from "three";

import { BEASTS, beastRarity, type BeastSpec } from "../game/beast-defs.ts";
import { BEAST_STYLES, beastMaterial, buildBeast, type BeastLod } from "../game/beast-shapes.ts";
import { BIRDS, birdRarity, type BirdSpec } from "../game/bird-defs.ts";
import { BIRD_STYLES, birdMaterial, buildBird, type BirdLod } from "../game/bird-shapes.ts";
import { createHazeUniforms } from "../game/haze.ts";
import { BEAST_FORMS, BIRD_FORMS, rackOf } from "../game/wild-traits.ts";

/** One cell, px, and how many a row before the sheet wraps. */
const CELL_W = 340;
const CELL_H = 280;
const COLS = 4;

type Cell = { name: string; foot: string; draw: (scene: THREE.Scene) => THREE.Camera };

const query = new URLSearchParams(location.search);
const lods =
  query.get("lod") === "far" ? ["far"] : query.get("lod") === "both" ? ["near", "far"] : ["near"];

/** A one-instance attribute. */
const one = (v: number): THREE.InstancedBufferAttribute =>
  new THREE.InstancedBufferAttribute(new Float32Array([v]), 1);

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

function birdCell(spec: BirdSpec, lod: BirdLod): Cell {
  const poses = [
    { flap: spec.dihedral, fold: 0 },
    { flap: -spec.stroke * 0.8, fold: 0 },
    { flap: -0.3, fold: 1 },
  ];
  return {
    name: `${spec.name}${lod === "far" ? " (far)" : ""} — ${spec.regions.join(" · ")}`,
    foot:
      `${BIRD_FORMS[spec.id].join(" · ")} · span ${spec.span} m · ${spec.beatHz} Hz · glide ${spec.glide} · ` +
      (spec.home ? `${spec.home} · ${birdRarity(spec)}` : `crosses day ${spec.passage?.days.min}+`),
    draw(scene) {
      const gap = Math.max(spec.span * 0.62, 0.45);
      const forms = BIRD_FORMS[spec.id];
      poses.forEach((p, k) => {
        const geometry = buildBird(spec, BIRD_STYLES[spec.id], forms[k % forms.length], lod);
        geometry.setAttribute("aFlap", one(p.flap));
        geometry.setAttribute("aFold", one(p.fold));
        const mesh = new THREE.InstancedMesh(geometry, birdMaterial(spec, haze), 1);
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

function beastCell(spec: BeastSpec, lod: BeastLod): Cell {
  const young = BEAST_FORMS[spec.id].includes("young");
  const poses = [
    { gait: 0, stride: 0, graze: 0, young: false, rack: rackOf(spec.id, true, false, 1), size: 1 },
    {
      gait: 1.2,
      stride: 1,
      graze: 0,
      young: false,
      rack: rackOf(spec.id, false, false, 0.6),
      size: 0.95,
    },
    {
      gait: 0,
      stride: 0,
      graze: 1,
      young,
      rack: rackOf(spec.id, false, young, 0.3),
      size: young ? 0.64 : 1,
    },
  ];
  return {
    name: `${spec.name}${lod === "far" ? " (far)" : ""} — ${spec.regions.join(" · ")}`,
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
        const form = p.young ? "young" : "adult";
        const { geometry, pivot } = buildBeast(spec, BEAST_STYLES[spec.id], form, lod);
        geometry.setAttribute(
          "aMotion",
          new THREE.InstancedBufferAttribute(
            new Float32Array([p.gait, p.stride, p.graze, p.rack]),
            4,
          ),
        );
        const mesh = new THREE.InstancedMesh(geometry, beastMaterial(spec, pivot, haze), 1);
        mesh.setMatrixAt(0, new THREE.Matrix4());
        mesh.position.set((k - 1) * gap, 0, 0);
        mesh.scale.setScalar(p.size);
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

function main(): void {
  /** Each species at every cut asked for. */
  const cuts = <T>(rows: readonly T[], cell: (r: T, lod: "near" | "far") => Cell): Cell[] =>
    rows.flatMap((r) => lods.map((lod) => cell(r, lod as "near" | "far")));
  const cells: Cell[] = [...cuts(chosen(BIRDS), birdCell), ...cuts(chosen(BEASTS), beastCell)];
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

main();
