// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START HOUSE, DRAWN — a slalom's start over the top of its course
// (`start-house-plan.ts` says where and how big): a house standing on the
// slope, and across its front a tall flat WALL wider than it — a band of
// the race's red along the top carrying the word, panels of the woods'
// green either side, white boards flanking a narrow DOORWAY that is dark
// inside — the racer in it on the snow; at the door's foot the WAND
// between its two short posts, and just outside them on the snow the two
// holes trodden where every racer plants his poles; inside the door's left jamb, facing him,
// the START CLOCK, its light red until GO and green after, its digits
// counting the starter's word down.
//
// Built in code, in the marks' faceted look (`tree-mesh.ts`'s bench), in
// the house's own frame: x across to the racer's right, z down the course,
// y up from the snow under the wand. The printed faces are canvases.

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import { APP_NAME, PALETTE } from "../identity.ts";
import { bannerTexture } from "./banner-texture.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { HOUSE, startHousePlan } from "./start-house-plan.ts";
import { STRINGS } from "./strings.ts";
import { Shape, type V3 } from "./tree-mesh.ts";

/** THE WAND'S SWING, rad about its hinge, `t` s after his shins opened it:
 * thrown round a quarter turn in a tenth of a second or so, rocking once on
 * its stop and then standing out down the course. */
function wandOpen(t: number): number {
  const k = Math.min(1, t / 0.12);
  const settle = t > 0.12 ? 0.12 * Math.sin((t - 0.12) * 28) * Math.exp(-(t - 0.12) * 9) : 0;
  return (Math.PI / 2) * (1 - (1 - k) * (1 - k)) - settle;
}

const colour = (hex: THREE.ColorRepresentation): THREE.Color => new THREE.Color(hex);
const PANEL = colour(PALETTE.pine);
const SHELL = colour(0x3a4048);
const DARK = colour(0x0c0e11);
const INSIDE = colour(0xb9b4aa);
const ROOF = colour(0x2a2f36);
const SNOW = colour(0xf1f4f7);
const POST = colour(0x15181c);
const ALLOY = colour(0xc4cacf);
const TRODDEN = colour(0xd5dde6);
const PIT = colour(0xbfcad6);

export type StartHouse = {
  group: THREE.Group;
  /** The clock's face to the run's moment. */
  update(state: GameState): void;
  dispose(): void;
};

/** The white boards either side of the door: the game's name down them
 * again and again, as a race's boards carry its own. */
function boardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#f6f8fa";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#2a3038";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "700 18px sans-serif";
  const word = APP_NAME.toUpperCase();
  for (let k = 0; k < 8; k++) g.fillText(word, 64, 32 + k * 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** THE START HOUSE of `level`'s slalom, or null on a map with none. */
export function createStartHouse(level: Level, haze: HazeUniforms): StartHouse | null {
  const plan = startHousePlan(level);
  if (!plan) return null;
  const group = new THREE.Group();
  group.name = "start-house";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const std = (p: THREE.MeshStandardMaterialParameters, name: string): THREE.Material => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name);
    mats.push(m);
    return m;
  };
  /** The snow under a point of the house's frame, in that frame. */
  const snowAt = (x: number, z: number): number =>
    level.groundAt(plan.x + plan.rx * x + plan.fx * z, plan.z + plan.rz * x + plan.fz * z) - plan.y;
  const F = HOUSE.front;
  const D = HOUSE.door;
  const roof = plan.eaves - plan.y;
  const top = Math.max(roof, F.height);
  const hw = HOUSE.width / 2;
  const back = -HOUSE.depth;
  const s = new Shape(0, { stems: false, wind: true });
  s.facet = 0.8;

  /** A face of the house, its foot on the snow wherever the snow is. */
  const wall = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    upTo: number,
    c: THREE.Color,
    out: V3,
  ): void => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.5));
    for (let k = 0; k < n; k++) {
      const a = k / n;
      const b = (k + 1) / n;
      const xa = x0 + (x1 - x0) * a;
      const za = z0 + (z1 - z0) * a;
      const xb = x0 + (x1 - x0) * b;
      const zb = z0 + (z1 - z0) * b;
      s.quad(
        [xa, snowAt(xa, za) - 0.2, za],
        [xb, snowAt(xb, zb) - 0.2, zb],
        [xb, upTo, zb],
        [xa, upTo, za],
        c,
        out,
      );
    }
  };
  // THE HOUSE behind the front: its sides and back, a roof with snow on it,
  // and dark inside — the doorway shows the dark.
  wall(-hw, -0.1, -hw, back, roof, SHELL, [-1, 0, 0]);
  wall(hw, back, hw, -0.1, roof, SHELL, [1, 0, 0]);
  wall(hw, back, -hw, back, roof, SHELL, [0, 0, -1]);
  wall(-hw + 0.08, back + 0.08, hw - 0.08, back + 0.08, roof, INSIDE, [0, 0, 1]);
  wall(-hw + 0.08, -0.1, -hw + 0.08, back + 0.08, roof, INSIDE, [1, 0, 0]);
  wall(hw - 0.08, back + 0.08, hw - 0.08, -0.1, roof, INSIDE, [-1, 0, 0]);
  s.quad(
    [-hw, roof - 0.02, 0],
    [hw, roof - 0.02, 0],
    [hw, roof - 0.02, back],
    [-hw, roof - 0.02, back],
    INSIDE,
    [0, -1, 0],
  );
  s.quad(
    [-hw - 0.2, roof, back - 0.2],
    [hw + 0.2, roof, back - 0.2],
    [hw + 0.2, roof, 0],
    [-hw - 0.2, roof, 0],
    ROOF,
    [0, -1, 0],
  );
  s.quad(
    [-hw - 0.2, roof + 0.2, 0],
    [hw + 0.2, roof + 0.2, 0],
    [hw + 0.2, roof + 0.2, back - 0.2],
    [-hw - 0.2, roof + 0.2, back - 0.2],
    SNOW,
    [0, 1, 0],
  );

  // THE FRONT WALL: the green panels round the doorway, to the snow
  // wherever it is; the band and the boards are printed planes over it.
  const fw = F.width / 2;
  const door = D.width / 2;
  const lintel = snowAt(0, 0) + D.height;
  const panel = (x0: number, x1: number, y0: (x: number) => number, y1: number): void => {
    const n = Math.max(1, Math.round((x1 - x0) / 0.6));
    for (let k = 0; k < n; k++) {
      const xa = x0 + ((x1 - x0) * k) / n;
      const xb = x0 + ((x1 - x0) * (k + 1)) / n;
      s.quad([xa, y0(xa), 0], [xb, y0(xb), 0], [xb, y1, 0], [xa, y1, 0], PANEL, [0, 0, 1]);
    }
  };
  const foot = (x: number): number => snowAt(x, 0) - 0.2;
  panel(-fw, -door, foot, top);
  panel(door, fw, foot, top);
  panel(-door, door, () => lintel, top);
  // Its back, inside the house: plain, and light.
  for (const [x0, x1] of [
    [-fw, -door],
    [door, fw],
  ] as const) {
    s.quad(
      [x1, foot(x1), -0.06],
      [x0, foot(x0), -0.06],
      [x0, top, -0.06],
      [x1, top, -0.06],
      INSIDE,
      [0, 0, -1],
    );
  }
  // The doorway's jambs and head, dark.
  for (const x of [-door, door]) {
    s.quad([x, foot(x), 0], [x, foot(x), -0.3], [x, lintel, -0.3], [x, lintel, 0], DARK, [
      -Math.sign(x),
      0,
      0,
    ]);
  }
  s.quad(
    [-door, lintel, 0],
    [door, lintel, 0],
    [door, lintel, -0.3],
    [-door, lintel, -0.3],
    DARK,
    [0, -1, 0],
  );
  // THE WAND between its two posts at the door's foot.
  const W = HOUSE.wand;
  const wy = snowAt(0, 0);
  for (const x of [-door + 0.12, door - 0.12]) {
    s.tube(
      [x, snowAt(x, 0.05) - 0.1, 0.05],
      [x, snowAt(x, 0.05) + W.post, 0.05],
      0.05,
      0.045,
      5,
      POST,
    );
  }
  // THE POLE HOLES outside the posts: the snow trodden down into a dish,
  // a shade greyer than the snow round it — a rim and a floor.
  const H = HOUSE.holes;
  const ring = 8;
  for (const side of [-1, 1]) {
    const cx = (side * H.apart) / 2;
    const cz = H.out;
    const rim = (k: number, f: number): V3 => {
      const a = (k / ring) * Math.PI * 2;
      const x = cx + Math.cos(a) * (H.width / 2) * f;
      const z = cz + Math.sin(a) * (H.length / 2) * f;
      return [x, snowAt(x, z) + 0.015 - H.depth * (1 - f), z];
    };
    const floor: V3 = [cx, snowAt(cx, cz) + 0.015 - H.depth, cz];
    for (let k = 0; k < ring; k++) {
      s.quad(rim(k, 1), rim(k, 0.55), rim(k + 1, 0.55), rim(k + 1, 1), TRODDEN, [0, 1, 0]);
      s.tri(rim(k, 0.55), floor, rim(k + 1, 0.55), PIT, [0, 1, 0]);
    }
  }
  const body = s.geometry();
  geos.push(body);
  const house = new THREE.Mesh(body, std({ vertexColors: true, roughness: 0.8 }, "start-house"));
  house.castShadow = true;
  house.receiveShadow = true;
  group.add(house);

  // THE BAND along the front's top, and the white boards beside the door.
  const banner = bannerTexture(F.width / F.band, STRINGS.startLine);
  texs.push(banner);
  const bandGeo = new THREE.PlaneGeometry(F.width, F.band);
  geos.push(bandGeo);
  const band = new THREE.Mesh(bandGeo, std({ map: banner, roughness: 0.6 }, "start-band"));
  band.position.set(0, top - F.band / 2 - 0.1, 0.03);
  group.add(band);
  const boards = boardTexture();
  texs.push(boards);
  const boardGeo = new THREE.PlaneGeometry(F.board, lintel + 0.2 - snowAt(0, 0) + 0.2);
  geos.push(boardGeo);
  const boardMat = std({ map: boards, roughness: 0.6 }, "start-boards");
  // Outside the door, and inside it — what the lens behind him looks out
  // between.
  for (const side of [-1, 1]) {
    const x = side * (door + F.board / 2 + 0.05);
    for (const inside of [false, true]) {
      const b = new THREE.Mesh(boardGeo, boardMat);
      b.position.set(x, (snowAt(x, 0) + lintel + 0.2) / 2, inside ? -0.09 : 0.03);
      if (inside) b.rotation.y = Math.PI;
      group.add(b);
    }
  }

  // THE WAND: one bar hinged on the post at his left as drawn, across the
  // door at shin height. His shins push it open as he goes — it swings out
  // down the course and stays there, standing out forward (`update`).
  const reach = 2 * (door - 0.12);
  const barGeo = new THREE.CylinderGeometry(0.014, 0.014, reach, 6);
  barGeo.rotateZ(Math.PI / 2);
  barGeo.translate(-reach / 2, 0, 0);
  geos.push(barGeo);
  const wand = new THREE.Group();
  wand.add(new THREE.Mesh(barGeo, std({ color: ALLOY, roughness: 0.35, metalness: 0.6 }, "wand")));
  wand.position.set(door - 0.12, wy + W.height, 0.05);
  group.add(wand);

  // THE START CLOCK inside the left jamb, facing the racer: a box with a
  // face drawn on a canvas, redrawn when the figure on it changes.
  const C = HOUSE.clock;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 176;
  const face = new THREE.CanvasTexture(canvas);
  face.colorSpace = THREE.SRGBColorSpace;
  texs.push(face);
  const box = new THREE.BoxGeometry(0.12, C.tall + 0.06, C.width + 0.06);
  geos.push(box);
  const shell = new THREE.Mesh(box, std({ color: 0x1b1e23, roughness: 0.5 }, "start-clock"));
  const glass = new THREE.PlaneGeometry(C.width, C.tall);
  geos.push(glass);
  const screen = new THREE.Mesh(
    glass,
    std(
      { map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.9, roughness: 0.3 },
      "start-clock-face",
    ),
  );
  screen.position.x = 0.061;
  screen.rotation.y = Math.PI / 2;
  const clock = new THREE.Group();
  clock.add(shell, screen);
  clock.position.set(-hw + 0.2, snowAt(-hw + 0.2, -0.6) + C.height, -0.9);
  group.add(clock);
  let shown = "";
  const draw = (figure: string, go: boolean): void => {
    const key = `${figure}|${go}`;
    if (key === shown) return;
    shown = key;
    const g = canvas.getContext("2d");
    if (!g) return;
    g.fillStyle = "#0b0d10";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = go ? "#2bd46a" : "#e0312b";
    g.beginPath();
    g.arc(canvas.width / 2, 34, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = go ? "#9af5b9" : "#ff9a3c";
    g.font = "700 92px monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(figure, canvas.width / 2, 118);
    face.needsUpdate = true;
  };
  draw("", false);

  group.position.set(plan.x, plan.y, plan.z);
  group.rotation.y = plan.heading;
  return {
    group,
    update(state) {
      const counting = state.phase === "countdown";
      const left = Math.min(9, Math.ceil(state.countdown));
      draw(counting ? `0:0${left}` : state.progress.started ? "" : STRINGS.go, !counting);
      wand.rotation.y = state.progress.started ? wandOpen(state.progress.time) : 0;
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
    },
  };
}
