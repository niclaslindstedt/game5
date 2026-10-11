// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD LAB'S BOARDERS SHEET (`make crowd ARGS=--sheet=boarders`): the
// free ride's snowboarders (`crowd-board.ts`) as the crowd draws them.
//
//   * every BOARD SHAPE (a row: the riding stance and each target) at the
//     three cuts — NEAR, MID and FAR — from behind, the side and the front;
//   * the MOMENTS blended as `boardDialsOf` weighs an amateur's numbers: a
//     turn and a carve each way, the heelside stop and the falling leaf,
//     the one-foot skate, the queue, the T-bar, sat in the snow, the chair,
//     a goofy rider — from behind and a little to the side, where the chase
//     camera sees one;
//   * every BODY on a board, stood and carving.

import type * as THREE from "three";
import type { Amateur, CrowdBody } from "@engine";

import { BOARD_POSES, boardDialsOf } from "../game/crowd-board.ts";
import type { Outfit } from "../game/crowd-dress.ts";
import { CROWD_LODS, crowdTriangles, type CrowdLod } from "../game/crowd-shapes.ts";

type Cell = { name: string; foot: string; draw: (scene: THREE.Scene) => THREE.Camera };

/** What the sheet borrows from the lab's page. */
export type BoarderKit = {
  bodies: readonly CrowdBody[];
  figure: (
    body: CrowdBody,
    lod: CrowdLod,
    weights: ArrayLike<number>,
    outfit: Outfit,
    mirror: number,
    x: number,
    board?: boolean,
  ) => THREE.InstancedMesh;
  stage: (
    scene: THREE.Scene,
    w: number,
    cy: number,
    azimuth?: number,
    elev?: number,
  ) => THREE.Camera;
  sample: (body: CrowdBody, id: number) => Outfit;
  standIn: (body: CrowdBody, id: number, over?: Partial<Amateur>) => Amateur;
};

/** The sides a shape is seen from: behind (the chase camera's), his side
 * — a rider stands across his board, so this is his front or his back —
 * and the board's nose. */
const VIEWS = [
  { name: "behind", azimuth: 0.35 },
  { name: "side", azimuth: Math.PI / 2 },
  { name: "front", azimuth: Math.PI - 0.35 },
] as const;
export const BOARDER_COLUMNS = CROWD_LODS.length * VIEWS.length;

/** The moments a rider is drawn in, as an amateur's numbers. */
const MOMENTS: readonly { name: string; at: Partial<Amateur>; seat?: number; tow?: number }[] = [
  { name: "toeside turn", at: { speed: 8, lean: 0.3, crouch: 0.3 } },
  { name: "heelside turn", at: { speed: 8, lean: -0.3, crouch: 0.3 } },
  { name: "toeside carve", at: { speed: 12, lean: 0.7, crouch: 0.3 } },
  { name: "heelside carve", at: { speed: 12, lean: -0.62, crouch: 0.3 } },
  { name: "heelside stop", at: { speed: 2, across: 1, mode: "stop" } },
  { name: "falling leaf", at: { speed: 2, across: 0.85, crouch: 0.4 } },
  { name: "bomber's tuck", at: { speed: 16, crouch: 0.95 } },
  { name: "skate, push", at: { speed: 2, push: 1, pole: 0.3 } },
  { name: "skate, back", at: { speed: 2, push: 1, pole: 0.8 } },
  { name: "in the queue", at: { speed: 0, mode: "queue" } },
  { name: "on a T-bar", at: { speed: 3, mode: "ride" }, tow: 1 },
  { name: "sitting down", at: { speed: 0, mode: "stop", sit: 0.5 } },
  { name: "sat in the snow", at: { speed: 0, mode: "stop", sit: 1 } },
  { name: "on a chair", at: { speed: 3, mode: "ride" }, seat: 1 },
  { name: "off a kicker", at: { mode: "air", airAt: 0.5, airT: 1, crouch: 0.4 } },
  { name: "waiting", at: { speed: 0, mode: "stop" } },
  { name: "goofy, toeside", at: { speed: 8, lean: -0.3, crouch: 0.3, board: "goofy" } },
  { name: "goofy, sat", at: { speed: 0, mode: "stop", sit: 1, board: "goofy" } },
];

export function boarderCells(kit: BoarderKit): Cell[] {
  const body: CrowdBody = kit.bodies.length < 8 ? kit.bodies[0] : "man";
  const outfit = kit.sample(body, 5);
  const shapes = ["stance", ...BOARD_POSES];
  const cells: Cell[] = [];
  const blank: Cell = { name: "", foot: "", draw: (scene) => kit.stage(scene, 2.6, 0.85) };
  // THE SHAPES, wholly, at every cut and from every side.
  shapes.forEach((shape, row) => {
    for (const lod of CROWD_LODS) {
      for (const view of VIEWS) {
        const first = lod === "near" && view.name === "behind";
        cells.push({
          name: first ? `${body} — ${shape}` : `${lod}, ${view.name}`,
          foot: first ? `${crowdTriangles(body, "near", true)} tris near` : "",
          draw(scene) {
            const w = new Array<number>(BOARD_POSES.length).fill(0);
            if (row > 0) w[row - 1] = 1;
            scene.add(kit.figure(body, lod, w, outfit, 1, 0, true));
            const cy = shape === "chair" ? 0.2 : shape === "sit" ? 0.4 : 0.85;
            return kit.stage(scene, 2.6, cy, view.azimuth, shape === "chair" ? 0.1 : 0.32);
          },
        });
      }
    }
  });
  // THE MOMENTS, blended as the crowd weighs them.
  MOMENTS.forEach((m, k) => {
    cells.push({
      name: m.name,
      foot: k === 0 ? "the crowd's weights" : "",
      draw(scene) {
        const w = new Float32Array(BOARD_POSES.length);
        const a = kit.standIn(body, k, { board: "regular", ...m.at });
        const mirror = boardDialsOf(a, w, 1.8, m.seat ?? 0, m.tow ?? 0);
        scene.add(kit.figure(body, "near", w, kit.sample(body, k + 9), mirror, 0, true));
        const cy = m.seat ? 0.2 : (m.at.sit ?? 0) > 0.5 ? 0.4 : 0.85;
        return kit.stage(scene, 2.6, cy, 0.55, 0.32);
      },
    });
  });
  while (cells.length % BOARDER_COLUMNS) cells.push(blank);
  // EVERY BODY on a board, stood and carving toeside.
  for (const lean of [0, 0.5]) {
    for (const b of kit.bodies) {
      cells.push({
        name: `${b}${lean ? ", carving" : ""}`,
        foot: lean
          ? ""
          : `${crowdTriangles(b, "near", true)}/${crowdTriangles(b, "mid", true)}/${crowdTriangles(b, "far", true)} tris`,
        draw(scene) {
          const w = new Float32Array(BOARD_POSES.length);
          const a = kit.standIn(b, 3, { board: "regular", speed: 8, lean, crouch: 0.3 });
          const mirror = boardDialsOf(a, w);
          scene.add(kit.figure(b, "near", w, kit.sample(b, 13), mirror, 0, true));
          return kit.stage(scene, 2.6, 0.85, 0.55, 0.32);
        },
      });
    }
    while (cells.length % BOARDER_COLUMNS) cells.push(blank);
  }
  return cells;
}
