// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOARD LAB's page (driven by `scripts/board-preview.mjs`): the
// snowboard as the game draws it (`board-body.ts`, off `board-look.ts`) —
// the deck, its strap bindings and the soft boots — as one labelled
// contact sheet: a row a subject, a column a view.
//
//   * THE DECK: its top and its base straight on (the topsheet's and the
//     base's graphics, the sidecut's outline), its profile edge-on (the
//     camber, the kicked nose and tail — drawn three times as tall, so the
//     millimetres read), bowed by a 55° carve, and at three quarters with
//     its bindings set at the stance's angles.
//   * A BINDING alone from behind (the highback), the side, the front and
//     at three quarters.
//   * A SOFT BOOT in its binding from the same four sides.
//   * THE DECK, BINDINGS AND BOOTS at the game's own chase distance.
//
// A 10 cm grid stands under the flat views. Sets `window.__done` when the
// sheet is on screen and `window.__tris` to each part's triangles.

import * as THREE from "three";

import { pairById } from "@engine";

import { buildBinding, buildDeck, buildSoftBoot, type Paint } from "../game/board-body.ts";
import { BINDING, boardBend, sheetOf } from "../game/board-look.ts";
import { boardOf } from "../game/board-input.ts";

const CELL_W = 420;
const CELL_H = 300;
const query = new URLSearchParams(location.search);
const spec = pairById(query.get("board") ?? "lynx");
const board = boardOf(spec);
const sheet = sheetOf(spec.id);

type Cell = {
  name: string;
  /** What is drawn: the bare deck, the deck dressed, a binding, a boot in
   * its binding. */
  subject: "deck" | "dressed" | "binding" | "boot";
  /** The lens: orthographic straight on (`ortho`, the axis it looks down
   * and the half height it spans, m), or a perspective one about the
   * subject (azimuth from its +x, deg, clockwise from above; elevation,
   * deg; distance, m). */
  ortho?: { look: "down" | "up" | "side"; span: number; stretch?: number };
  az?: number;
  el?: number;
  dist?: number;
  bend?: number;
};

const ROWS: Cell[][] = [
  [
    { name: "deck — top", subject: "deck", ortho: { look: "down", span: 0.85 } },
    { name: "deck — base", subject: "deck", ortho: { look: "up", span: 0.85 } },
    {
      name: "deck — profile ×3 tall",
      subject: "deck",
      ortho: { look: "side", span: 0.85, stretch: 3 },
    },
    {
      name: "deck — bowed by a 55° carve ×3",
      subject: "deck",
      ortho: { look: "side", span: 0.85, stretch: 3 },
      bend: boardBend(0.96, spec.sidecut),
    },
  ],
  [
    { name: "dressed — 3/4", subject: "dressed", az: 35, el: 30, dist: 1.9 },
    { name: "dressed — from above", subject: "dressed", az: 90, el: 80, dist: 1.8 },
    { name: "dressed — toe edge", subject: "dressed", az: 0, el: 12, dist: 1.8 },
    { name: "dressed — chase range", subject: "dressed", az: 270, el: 18, dist: 4.2 },
  ],
  [
    { name: "binding — back (highback)", subject: "binding", az: 0, el: 15, dist: 0.8 },
    { name: "binding — side", subject: "binding", az: 90, el: 10, dist: 0.8 },
    { name: "binding — front", subject: "binding", az: 180, el: 20, dist: 0.8 },
    { name: "binding — 3/4", subject: "binding", az: 140, el: 30, dist: 0.85 },
  ],
  [
    { name: "boot — back", subject: "boot", az: 0, el: 15, dist: 0.8 },
    { name: "boot — side", subject: "boot", az: 90, el: 10, dist: 0.8 },
    { name: "boot — front", subject: "boot", az: 180, el: 20, dist: 0.8 },
    { name: "boot — 3/4", subject: "boot", az: 140, el: 28, dist: 0.85 },
  ],
];

function tris(o: THREE.Object3D): number {
  let n = 0;
  o.traverse((m) => {
    if (m instanceof THREE.Mesh) {
      const g = m.geometry as THREE.BufferGeometry;
      n += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return Math.round(n);
}

async function main(): Promise<void> {
  const cols = Math.max(...ROWS.map((r) => r.length));
  const out = document.getElementById("stage") as HTMLCanvasElement;
  out.width = CELL_W * cols;
  out.height = CELL_H * ROWS.length;
  const ctx = out.getContext("2d") as CanvasRenderingContext2D;
  const cell = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas: cell, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setSize(CELL_W, CELL_H, false);

  const plain = <M extends THREE.Material>(m: M): M => m;
  const paints = new Map<number, THREE.Material>();
  const paint: Paint = (c) => {
    let m = paints.get(c);
    if (!m) paints.set(c, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })));
    return m;
  };
  const keep = <G extends THREE.BufferGeometry>(g: G): G => g;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc9d3dc);
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0xd0d4d8, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(1.5, 3, 2);
  scene.add(sun);
  const back = new THREE.DirectionalLight(0xbfd4ff, 0.8);
  back.position.set(-2, 1, -2);
  scene.add(back);
  const grid = new THREE.GridHelper(2, 20, 0x8090a0, 0xa8b4c0);
  scene.add(grid);

  // THE SUBJECTS, each in its own group, shown one at a time.
  const deck = buildDeck(board, sheet, plain);
  const deckOnly = new THREE.Group();
  deckOnly.add(deck.mesh);
  const dressed = new THREE.Group();
  const deck2 = buildDeck(board, sheet, plain);
  dressed.add(deck2.mesh);
  const face = board.lead === "regular" ? 1 : -1;
  for (const [s, a] of [
    [board.stance / 2, board.front],
    [-board.stance / 2, board.back],
  ]) {
    const b = buildBinding(sheet, paint, keep);
    b.group.position.set(0, deck2.topAt(s), s);
    b.group.rotation.set(0, Math.atan2(face * Math.cos(a), Math.sin(a)), 0);
    const boot = buildSoftBoot(sheet, paint, keep);
    boot.position.y = BINDING.plate;
    b.group.add(boot);
    dressed.add(b.group);
  }
  const binding = buildBinding(sheet, paint, keep).group;
  const booted = buildBinding(sheet, paint, keep).group;
  const boot = buildSoftBoot(sheet, paint, keep);
  boot.position.y = BINDING.plate;
  booted.add(boot);
  const subjects = { deck: deckOnly, dressed, binding, boot: booted };
  for (const g of Object.values(subjects)) scene.add(g);

  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 0; c < ROWS[r].length; c++) {
      const v = ROWS[r][c];
      for (const [k, g] of Object.entries(subjects)) g.visible = k === v.subject;
      deck.setBend(v.bend ?? 0);
      deckOnly.scale.set(1, v.ortho?.stretch ?? 1, 1);
      let lens: THREE.Camera;
      const aspect = CELL_W / CELL_H;
      if (v.ortho) {
        const h = v.ortho.span / aspect;
        const o = new THREE.OrthographicCamera(-v.ortho.span, v.ortho.span, h, -h, 0.01, 20);
        // Down: the nose to the right (+z → screen x). Up: the base, the
        // nose still to the right. Side: from the toe edge, the nose right.
        if (v.ortho.look === "down") {
          o.position.set(0, 5, 0);
          o.up.set(-1, 0, 0);
        } else if (v.ortho.look === "up") {
          o.position.set(0, -5, 0);
          o.up.set(1, 0, 0);
        } else {
          o.position.set(5, 0.03, 0);
          o.up.set(0, 1, 0);
        }
        o.lookAt(0, v.ortho.look === "side" ? 0.03 : 0, 0);
        lens = o;
        grid.visible = v.ortho.look === "down";
        grid.position.y = -0.02;
      } else {
        const p = new THREE.PerspectiveCamera(32, aspect, 0.01, 50);
        const az = ((v.az ?? 0) * Math.PI) / 180;
        const el = ((v.el ?? 0) * Math.PI) / 180;
        const d = v.dist ?? 1;
        const aim = v.subject === "dressed" ? 0.08 : v.subject === "boot" ? 0.13 : 0.12;
        // A binding and a boot are seen about their own frame (az 0 behind
        // the heel, 90 from the outside); the deck about its toe edge.
        const own = v.subject === "binding" || v.subject === "boot";
        p.position.set(
          own ? Math.sin(az) * Math.cos(el) * d : Math.cos(az) * Math.cos(el) * d,
          aim + Math.sin(el) * d,
          own ? -Math.cos(az) * Math.cos(el) * d : -Math.sin(az) * Math.cos(el) * d,
        );
        p.lookAt(0, aim, 0);
        lens = p;
        grid.visible = true;
        grid.position.y = 0;
      }
      renderer.render(scene, lens);
      ctx.drawImage(cell, c * CELL_W, r * CELL_H);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(c * CELL_W, r * CELL_H, CELL_W, 20);
      ctx.fillStyle = "#fff";
      ctx.font = "12px monospace";
      ctx.fillText(v.name, c * CELL_W + 6, r * CELL_H + 14);
    }
  }
  (window as unknown as { __tris: Record<string, number> }).__tris = {
    deck: tris(deckOnly),
    binding: tris(binding),
    boot: tris(boot),
    dressed: tris(dressed),
  };
  (window as unknown as { __done: boolean }).__done = true;
}

void main();
