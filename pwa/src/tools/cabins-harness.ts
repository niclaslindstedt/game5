// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABIN LAB's page (driven by `scripts/cabins-preview.mjs`): every kind
// of log building the ski area keeps (`defs/cabins.ts`), built by the
// game's own builder (`cabin-shapes.ts`) and drawn through the game's own
// material (`hazeMaterial` with the windows' glow), as one labelled
// contact sheet — a row a kind, a column a view: its front and its back at
// three quarters, its side, the skier's eye from the snow below it, from
// straight above, its FAR cut, and at NIGHT with its windows lit.
//
// Every building stands TERRACED on a slope of `SLOPE` falling to its
// right, its floor set as the placer sets it (`CABIN_LAYOUT.plinth`) with
// the game's own drift banked round it — so the sheet shows the plinth
// reaching the snow on the low side and nothing floating — under a
// winter sun with shadows, a metre rule along the snow in front of it.
// `?kinds=hut,shed` draws a subset.
//
// Sets `window.__done` when the sheet is on screen, and `window.__tris`
// to every kind's triangles at each cut.

import * as THREE from "three";

import { CABINS, CABIN_LAYOUT, type Cabin, type CabinKind, type Level } from "@engine";

import { buildCabin, type CabinLod } from "../game/cabin-shapes.ts";
import { createHazeUniforms, hazeMaterial } from "../game/haze.ts";
import { driftGeometry, graftGlow } from "../game/cabins-view.ts";
import { lodgeYardGeometry } from "../game/lodge-yard.ts";
import { LUX_TO_LAMP } from "../game/piste-lights.ts";

const CELL_W = 300;
const CELL_H = 240;
/** The ground's fall across the building, rise over run. */
const SLOPE = 0.15;

const query = new URLSearchParams(location.search);
const want = query.get("kinds");
const ALL: CabinKind[] = ["hut", "cabin", "chalet", "shed", "afterski"];
const kinds = want ? ALL.filter((k) => want.split(",").includes(k)) : ALL;

/** A view: where the lens stands about the building (azimuth from its
 * front, degrees, clockwise from above; elevation, degrees; distance in
 * its sizes), which cut, and whether it is night. */
type View = {
  name: string;
  az: number;
  el: number;
  dist: number;
  lod: CabinLod;
  night?: boolean;
  fov?: number;
};
const VIEWS: View[] = [
  { name: "front 3/4", az: 35, el: 14, dist: 2.1, lod: 0 },
  { name: "back 3/4", az: 215, el: 18, dist: 2.1, lod: 0 },
  { name: "side (low)", az: 90, el: 8, dist: 2.0, lod: 0 },
  { name: "from the snow", az: -25, el: 2, dist: 1.25, lod: 0, fov: 60 },
  { name: "above", az: 20, el: 72, dist: 2.3, lod: 0 },
  { name: "far cut", az: 35, el: 14, dist: 2.1, lod: 1 },
  { name: "night", az: 35, el: 12, dist: 2.1, lod: 0, night: true },
];

const haze = createHazeUniforms();
haze.uHaze.value = 0;

async function main(): Promise<void> {
  const sheetCanvas = document.getElementById("stage") as HTMLCanvasElement;
  sheetCanvas.width = CELL_W * VIEWS.length;
  sheetCanvas.height = CELL_H * kinds.length;
  const sheet = sheetCanvas.getContext("2d") as CanvasRenderingContext2D;
  const cell = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas: cell, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setSize(CELL_W, CELL_H, false);
  // The skiers' own shadow atlas the world material reads beside the key's
  // map: none here, so an empty depth target stands in for it.
  const hero = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) });
  hero.depthTexture!.compareFunction = THREE.LessEqualCompare;
  renderer.setRenderTarget(hero);
  renderer.clear();
  renderer.setRenderTarget(null);
  haze.uHeroMap.value = hero.depthTexture;

  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }),
    haze,
    "cabin-lab",
    graftGlow,
  );
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xeef3f8, roughness: 0.95 });
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
  const tris: Record<string, number[]> = {};

  kinds.forEach((kind, row) => {
    const d = CABINS[kind];
    const geos = [buildCabin(kind, 0), buildCabin(kind, 1)];
    tris[kind] = geos.map((g) => g.getAttribute("position").count / 3);
    // The ground falls to +x: the floor stands at the high side's height.
    const groundAt = (x: number): number => -x * SLOPE;
    const P = CABIN_LAYOUT.plinth;
    const hi = groundAt(-d.width / 2);
    const lo = groundAt(d.width / 2);
    const floor = Math.max(lo + P.least, hi - P.cut);
    const stood = {
      id: "H1",
      kind,
      x: 0,
      z: 0,
      y: floor,
      base: lo,
      heading: 0,
      run: "",
      s: 0,
      group: 0,
    } as Cabin;
    const drift = driftGeometry({ groundAt: (x: number) => groundAt(x) } as unknown as Level, [
      stood,
    ]);
    // A lodge's steps and racks on the snow before it.
    const yard =
      kind === "afterski"
        ? lodgeYardGeometry({ groundAt: (x: number) => groundAt(x) } as unknown as Level, [stood])
        : null;
    const size = Math.max(d.width, d.depth, d.ridge);
    VIEWS.forEach((v, col) => {
      const scene = new THREE.Scene();
      const night = !!v.night;
      scene.background = new THREE.Color(night ? 0x0b1220 : 0x9fb9cf);
      scene.add(
        new THREE.HemisphereLight(
          night ? 0x2a3a5a : 0xdfeaf6,
          night ? 0x10141c : 0x9aa8b8,
          night ? 0.35 : 1.4,
        ),
      );
      const key = new THREE.DirectionalLight(night ? 0x8fa8d8 : 0xfff0dc, night ? 0.25 : 2.2);
      key.position.set(-14, 18, 16);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      const sc = key.shadow.camera as THREE.OrthographicCamera;
      sc.left = sc.bottom = -14;
      sc.right = sc.top = 14;
      key.shadow.bias = -0.0008;
      scene.add(key);
      haze.uPisteOn.value.x = night ? LUX_TO_LAMP : 0;
      const plane = new THREE.PlaneGeometry(200, 200);
      plane.rotateX(-Math.PI / 2);
      plane.rotateZ(-Math.atan(SLOPE));
      const ground = new THREE.Mesh(plane, snowMat);
      ground.receiveShadow = true;
      scene.add(ground);
      const house = new THREE.Mesh(geos[v.lod], material);
      house.position.set(0, floor, 0);
      house.castShadow = true;
      house.receiveShadow = true;
      scene.add(house);
      const bank = new THREE.Mesh(drift, material);
      bank.receiveShadow = true;
      scene.add(bank);
      if (yard) {
        const racks = new THREE.Mesh(yard, material);
        racks.castShadow = true;
        racks.receiveShadow = true;
        scene.add(racks);
      }
      for (let m = -3; m < 3; m++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.08), m % 2 ? pale : dark);
        const x = m + 0.5;
        band.position.set(x, groundAt(x) + 0.04, d.depth / 2 + d.reach.front + 1.2);
        scene.add(band);
      }
      const camera = new THREE.PerspectiveCamera(v.fov ?? 40, CELL_W / CELL_H, 0.1, 500);
      const az = (v.az * Math.PI) / 180;
      const el = (v.el * Math.PI) / 180;
      const r = size * v.dist + 3;
      const cx = Math.sin(az) * Math.cos(el) * r;
      const cz = Math.cos(az) * Math.cos(el) * r;
      const cy = Math.max(groundAt(cx) + 1.6, floor + Math.sin(el) * r + 1.5);
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, floor + d.ridge * (v.el > 60 ? 0 : 0.42), 0);
      renderer.render(scene, camera);
      sheet.drawImage(cell, col * CELL_W, row * CELL_H);
      addLabel(`${kind} · ${v.name}`, col, row, 4);
      if (col === 0 || col === 5)
        addLabel(`${tris[kind][v.lod]} tris`, col, row, CELL_H - 24, "foot");
      ground.geometry.dispose();
    });
    for (const g of geos) g.dispose();
    drift.dispose();
    yard?.dispose();
  });
  renderer.dispose();
  cell.remove();
  const w = window as unknown as { __done: boolean; __tris: Record<string, number[]> };
  w.__tris = tris;
  w.__done = true;
}

void main();
