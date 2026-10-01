// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE-HEAD SIGNS AS DRAWN — the boards `run-sign-plan.ts` stands at
// the head of every run and at every junction a lane leaves by, built for
// `gates.ts`, which carries them with the rest of the course's furniture.
//
// A BOARD IS PRINTED AS A SKI AREA PRINTS ONE: white enamel in a dark rim,
// the run's MARK at its left — the grade's shape in its colour
// (`grade-look.ts`: the green circle, the blue square, the red rectangle,
// the black diamond) with the run's number in white on it — then the NAME
// in heavy capitals, measured to the board, and an ARROW at the right the
// way the run goes from where the sign stands. A lane's board is the same
// print, smaller. The back is bare painted metal; the post a galvanised
// tube.
//
// THREE DRAWS FOR EVERY SIGN ON THE MAP: every board's print is one cell
// of ONE canvas atlas, and the fronts are one merged mesh whose UVs reach
// into it; the backs are a second mesh, the posts one instanced tube.
// Everything goes through `hazeMaterial`, so a far sign fades into the air
// and the mist as the stakes do.

import * as THREE from "three";
import type { Level } from "@engine";

import { GRADE_LOOK, gradePath } from "./grade-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { signPlan, type SignArrow, type SignBoard } from "./run-sign-plan.ts";

/** One board's cell in the atlas, px — the boards' own 4 : 1. */
const CELL = { w: 512, h: 128 };

/** The post, m: its radius and how far it stands above the top board. */
const POST = { radius: 0.045, over: 0.12 };

/** How far in front of the post a board's face hangs, m. */
const FACE = 0.06;

/** The arrow's angle on the board, rad from pointing up, clockwise. */
const ARROW_ANGLE: Readonly<Record<SignArrow, number>> = {
  ahead: 0,
  aheadRight: Math.PI / 4,
  right: Math.PI / 2,
  aheadLeft: -Math.PI / 4,
  left: -Math.PI / 2,
};

const INK = "#15181c";
const ENAMEL = "#f3f5f7";

/** One board's print into its cell at (x0, y0). */
function printBoard(g: CanvasRenderingContext2D, b: SignBoard, x0: number, y0: number): void {
  const { w, h } = CELL;
  const rim = 7;
  g.fillStyle = INK;
  g.fillRect(x0, y0, w, h);
  g.fillStyle = ENAMEL;
  g.fillRect(x0 + rim, y0 + rim, w - rim * 2, h - rim * 2);

  // THE MARK: the grade's shape from its 24-unit path, the number on it.
  const look = GRADE_LOOK[b.grade];
  const box = h - rim * 2 - 8;
  const mx = x0 + rim + 6;
  const my = y0 + rim + 4;
  g.save();
  g.translate(mx, my);
  g.scale(box / 24, box / 24);
  const path = new Path2D(gradePath(look.shape));
  g.fillStyle = look.paint;
  g.fill(path);
  g.lineWidth = 1.1;
  g.strokeStyle = INK;
  g.stroke(path);
  g.restore();
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const numSize = Math.round(box * (look.shape === "diamond" ? 0.36 : 0.46));
  g.font = `900 ${numSize}px sans-serif`;
  g.fillText(b.number, mx + box / 2, my + box / 2 + numSize * 0.06, box * 0.62);

  // THE ARROW at the right, turned the way the run goes.
  const ax = x0 + w - rim - h * 0.4;
  const ay = y0 + h / 2;
  const s = h * 0.3;
  g.save();
  g.translate(ax, ay);
  g.rotate(ARROW_ANGLE[b.arrow]);
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(0, -s);
  g.lineTo(s * 0.8, -s * 0.15);
  g.lineTo(s * 0.28, -s * 0.15);
  g.lineTo(s * 0.28, s);
  g.lineTo(-s * 0.28, s);
  g.lineTo(-s * 0.28, -s * 0.15);
  g.lineTo(-s * 0.8, -s * 0.15);
  g.closePath();
  g.fill();
  g.restore();

  // THE NAME between them, as big as the room lets it be.
  const left = mx + box + 14;
  const room = ax - s - 12 - left;
  const text = b.name.toUpperCase();
  let size = 80;
  g.font = `800 ${size}px sans-serif`;
  const wide = g.measureText(text).width;
  if (wide > room) {
    size = Math.max(30, Math.floor((size * room) / wide));
    g.font = `800 ${size}px sans-serif`;
  }
  g.fillStyle = INK;
  g.textAlign = "left";
  g.fillText(text, left, y0 + h / 2 + size * 0.05, room);
}

export type RunSigns = { group: THREE.Group; dispose(): void };

/** Every piste-head sign of `level`'s ski area; an empty group off one. */
export function createRunSigns(level: Level, haze: HazeUniforms): RunSigns {
  const group = new THREE.Group();
  const posts = signPlan(level);
  const boards = posts.flatMap((p) => p.boards.map((b) => ({ post: p, board: b })));
  if (boards.length === 0) return { group, dispose: () => {} };

  const cols = boards.length > 16 ? 4 : 2;
  const rows = Math.ceil(boards.length / cols);
  const W = CELL.w * cols;
  const H = Math.min(4096, THREE.MathUtils.ceilPowerOfTwo(rows * CELL.h));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  g.fillStyle = ENAMEL;
  g.fillRect(0, 0, W, H);

  const front = {
    pos: [] as number[],
    uv: [] as number[],
    nrm: [] as number[],
    idx: [] as number[],
  };
  const back = { pos: [] as number[], nrm: [] as number[], idx: [] as number[] };
  boards.forEach(({ post, board }, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if ((row + 1) * CELL.h > H) return;
    printBoard(g, board, col * CELL.w, row * CELL.h);
    // The reader looks along f; the board's face is turned back at him, and
    // its print runs left to right across his view — along f × up.
    const fx = Math.sin(post.heading);
    const fz = Math.cos(post.heading);
    const sx = -fz;
    const sz = fx;
    const hw = board.width / 2;
    const cx = post.x - fx * FACE;
    const cz = post.z - fz * FACE;
    const y0 = post.y + board.y;
    const y1 = y0 + board.height;
    const corners = [
      [cx - sx * hw, y0, cz - sz * hw],
      [cx + sx * hw, y0, cz + sz * hw],
      [cx + sx * hw, y1, cz + sz * hw],
      [cx - sx * hw, y1, cz - sz * hw],
    ];
    const pad = 0.5;
    const u0 = (col * CELL.w + pad) / W;
    const u1 = ((col + 1) * CELL.w - pad) / W;
    const vTop = 1 - (row * CELL.h + pad) / H;
    const vBot = 1 - ((row + 1) * CELL.h - pad) / H;
    let base = front.pos.length / 3;
    for (const c of corners) front.pos.push(c[0], c[1], c[2]);
    front.uv.push(u0, vBot, u1, vBot, u1, vTop, u0, vTop);
    for (let k = 0; k < 4; k++) front.nrm.push(-fx, 0, -fz);
    front.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    // The back, a hair behind, wound the other way.
    base = back.pos.length / 3;
    for (const c of corners) back.pos.push(c[0] + fx * 0.02, c[1], c[2] + fz * 0.02);
    for (let k = 0; k < 4; k++) back.nrm.push(fx, 0, fz);
    back.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const frontGeo = new THREE.BufferGeometry();
  frontGeo.setAttribute("position", new THREE.Float32BufferAttribute(front.pos, 3));
  frontGeo.setAttribute("normal", new THREE.Float32BufferAttribute(front.nrm, 3));
  frontGeo.setAttribute("uv", new THREE.Float32BufferAttribute(front.uv, 2));
  frontGeo.setIndex(front.idx);
  const backGeo = new THREE.BufferGeometry();
  backGeo.setAttribute("position", new THREE.Float32BufferAttribute(back.pos, 3));
  backGeo.setAttribute("normal", new THREE.Float32BufferAttribute(back.nrm, 3));
  backGeo.setIndex(back.idx);
  // The print glows a little of its own, as a reflective sign does under
  // the sky, so it reads in the shade of its own board.
  const faceMat = hazeMaterial(
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.22,
      roughness: 0.6,
    }),
    haze,
    "sign-face",
  );
  const backMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x7c848c, roughness: 0.5, metalness: 0.4 }),
    haze,
    "sign-back",
  );
  const faces = new THREE.Mesh(frontGeo, faceMat);
  const backs = new THREE.Mesh(backGeo, backMat);
  faces.castShadow = backs.castShadow = true;

  const postGeo = new THREE.CylinderGeometry(POST.radius, POST.radius, 1, 8);
  postGeo.translate(0, 0.5, 0);
  const postMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0xa9b0b6, roughness: 0.4, metalness: 0.6 }),
    haze,
    "sign-post",
  );
  const tubes = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  tubes.castShadow = true;
  const m4 = new THREE.Matrix4();
  posts.forEach((p, i) => {
    const top = p.boards[0];
    const height = top.y + top.height + POST.over + 0.3;
    m4.makeScale(1, height, 1).setPosition(p.x, p.y - 0.3, p.z);
    tubes.setMatrixAt(i, m4);
  });
  tubes.instanceMatrix.needsUpdate = true;
  group.add(faces, backs, tubes);

  return {
    group,
    dispose() {
      frontGeo.dispose();
      backGeo.dispose();
      postGeo.dispose();
      faceMat.dispose();
      backMat.dispose();
      postMat.dispose();
      tubes.dispose();
      tex.dispose();
    },
  };
}
