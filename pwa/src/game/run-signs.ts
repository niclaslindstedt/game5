// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE-HEAD SIGNS AS DRAWN — the boards `run-sign-plan.ts` stands at
// the head of every run and at every junction a lane leaves by, built for
// `gates.ts`, which carries them with the rest of the course's furniture.
//
// A BOARD IS A PLANK WITH ITS WORDS BURNED IN: the grain of the country's
// wood (`sign-look.ts`), its edges scorched dark, the run's MARK painted at
// its left — the grade's shape in its colour (`grade-look.ts`: the green
// circle, the blue square, the red rectangle, the black diamond) with the
// run's number in white on it, outlined with the iron — then the NAME burned
// black in the country's own hand, measured to the board — and no arrow:
// a sign down on the runs is a plain plank. A ski route's WARNING board
// (R42) has a yellow warning triangle with a burned "!" for its mark. A lane's board is the same
// plank, smaller. The board has a thickness of end grain round it and a
// bare back; the post is a square timber. A lift top's board is CUT AS AN
// ARROW (`SignBoard.point`): the plank pointed at one end and standing off
// its post that way, the board itself the arrow, so nothing is burned on it.
//
// LIT AS WOOD IS LIT: nothing on a board glows. The print is the albedo and,
// read again by its red channel, the BUMP — the burned letters and the grain
// sunk into the plank — so the sun rakes across the letters by day and a
// headlamp or a floodlight finds them by night (`hazeMaterial`'s lamp term),
// and in the dark with no lamp on it a sign is as dark as the wood it is.
//
// THREE DRAWS FOR EVERY SIGN ON THE MAP: every board's print is one cell
// of ONE canvas atlas, and the fronts are one merged mesh whose UVs reach
// into it; the backs and edges are a second mesh, the posts one instanced
// timber. The atlas is printed at once in a fallback hand and printed again
// when the country's face has loaded.

import * as THREE from "three";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Level } from "@engine";

import { GRADE_LOOK, gradePath } from "./grade-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { SIGN, signPlan, summitSigns, type SignBoard } from "./run-sign-plan.ts";
import { SIGN_FALLBACK, signLookOf, type SignLook } from "./sign-look.ts";

/** One board's cell in the atlas, px — the boards' own 4 : 1. */
const CELL = { w: 512, h: 128 };

/** The post, m: its half-width and how far it stands above the top board. */
const POST = { half: 0.055, over: 0.12 };

/** How far in front of the post's centre a board's face hangs, and the
 * plank's thickness, m. */
const FACE = 0.1;
const THICK = 0.035;

/** The burn: the char at the heart of a stroke, and the scorch it browns
 * the wood with round it. */
const CHAR = "#120a05";
const SCORCH = "rgba(62, 26, 6, 0.85)";

/** How far the wood's tone soaks through the grade's paint, 0..1, and the
 * number's paint — an old white, never the enamel's. */
const SOAK = 0.75;
const NUMBER = "#ddd0b6";

/** A WARNING board's mark (R42): a triangle on its 24-unit box, painted a
 * sign-shop yellow that soaks into the wood less than a mark, so it reads
 * from up the pad, its "!" burned in. */
const WARN_PATH = "M12 2.5 L23 21.5 L1 21.5 Z";
const WARN_PAINT = "#f2c21e";
const WARN_SOAK = 0.3;

/** The faces loaded on this page, by family. */
const loaded = new Map<string, Promise<boolean>>();

function loadFace(look: SignLook): Promise<boolean> {
  let p = loaded.get(look.family);
  if (!p) {
    p =
      typeof FontFace === "undefined"
        ? Promise.resolve(false)
        : new FontFace(look.family, `url(${look.url})`).load().then(
            (face) => {
              document.fonts.add(face);
              return true;
            },
            () => false,
          );
    loaded.set(look.family, p);
  }
  return p;
}

/** Draw `shape` burned into the wood: a soft scorch round it, the char on it. */
function burn(g: CanvasRenderingContext2D, shape: () => void): void {
  g.save();
  g.shadowColor = SCORCH;
  g.shadowBlur = 9;
  g.fillStyle = g.strokeStyle = "#2a1408";
  shape();
  g.shadowBlur = 0;
  g.fillStyle = g.strokeStyle = CHAR;
  shape();
  g.restore();
}

/** The grain over (x0, y0, w, h): long lines along the board, each
 * wandering on its own wave, `alpha` of their full strength. */
function grain(
  g: CanvasRenderingContext2D,
  look: SignLook,
  rng: Rng,
  x0: number,
  y0: number,
  w: number,
  h: number,
  alpha: number,
): void {
  g.strokeStyle = look.grain;
  const lines = Math.round((26 * h) / CELL.h);
  for (let i = 0; i < lines; i++) {
    const y = y0 + rng.range(-4, h + 4);
    const amp = rng.range(1, 4);
    const len = rng.range(60, 160);
    const ph = rng.range(0, Math.PI * 2);
    g.globalAlpha = rng.range(0.08, 0.32) * alpha;
    g.lineWidth = rng.range(0.6, 2.4);
    g.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin(x / len + ph) * amp + Math.sin(x / 23 + ph * 3) * 0.6;
      if (x === 0) g.moveTo(x0 + x, yy);
      else g.lineTo(x0 + x, yy);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** How far into a board's cell its point reaches, px — none on a plank. */
function tipPx(b: SignBoard): number {
  return b.point ? (CELL.w * SIGN.tip) / b.width : 0;
}

/** A board's outline in its cell at (x0, y0): the plank, or the plank cut
 * to a point at its `point` end. */
function outline(b: SignBoard, x0: number, y0: number): Path2D {
  const { w, h } = CELL;
  const t = tipPx(b);
  const p = new Path2D();
  if (b.point === "right") {
    p.moveTo(x0, y0);
    p.lineTo(x0 + w - t, y0);
    p.lineTo(x0 + w, y0 + h / 2);
    p.lineTo(x0 + w - t, y0 + h);
    p.lineTo(x0, y0 + h);
  } else if (b.point === "left") {
    p.moveTo(x0 + t, y0);
    p.lineTo(x0 + w, y0);
    p.lineTo(x0 + w, y0 + h);
    p.lineTo(x0 + t, y0 + h);
    p.lineTo(x0, y0 + h / 2);
  } else p.rect(x0, y0, w, h);
  p.closePath();
  return p;
}

/** The plank: its tone, the grain wandering along it, a knot or two, and
 * the edges browned where the iron went round them — round its point too,
 * on an arrow board. */
function plank(
  g: CanvasRenderingContext2D,
  look: SignLook,
  rng: Rng,
  b: SignBoard,
  x0: number,
  y0: number,
): void {
  const { w, h } = CELL;
  const shape = outline(b, x0, y0);
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  g.fillStyle = look.wood;
  g.fillRect(x0, y0, w, h);
  g.clip(shape);
  grain(g, look, rng, x0, y0, w, h, 1);
  g.strokeStyle = look.grain;
  // A knot, its rings, now and then.
  if (rng.chance(0.6)) {
    const kx = x0 + rng.range(w * 0.25, w * 0.75);
    const ky = y0 + rng.range(h * 0.15, h * 0.85);
    for (let r = 1; r <= 4; r++) {
      g.globalAlpha = 0.5 / r;
      g.lineWidth = r === 1 ? 3 : 1.2;
      g.beginPath();
      g.ellipse(kx, ky, 3 + r * 5, 2 + r * 2.2, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  // The scorched rim: a dark stroke along the edge, its blur browning the
  // plank inwards — just outside the cell on a plank, on the outline itself
  // where it is cut to a point.
  g.shadowColor = SCORCH;
  g.shadowBlur = 16;
  g.strokeStyle = "#3a1c0a";
  if (b.point) {
    g.lineWidth = 4;
    g.stroke(shape);
  } else {
    g.lineWidth = 10;
    g.strokeRect(x0 - 4, y0 - 4, w + 8, h + 8);
  }
  g.restore();
}

/** One board's print into its cell at (x0, y0). */
function printBoard(
  g: CanvasRenderingContext2D,
  b: SignBoard,
  look: SignLook,
  font: string,
  seed: number,
  x0: number,
  y0: number,
): void {
  const { w, h } = CELL;
  plank(g, look, createRng(seed), b, x0, y0);
  // An arrow board's print keeps off its point.
  const t = tipPx(b);
  const lo = x0 + (b.point === "left" ? t * 0.75 : 0);
  const hi = x0 + w - (b.point === "right" ? t * 0.75 : 0);

  // THE MARK: the grade's shape painted from its 24-unit path, ringed with
  // the iron, the number on it in white.
  const pad = 12;
  const grade = GRADE_LOOK[b.grade];
  const box = h - pad * 2;
  const mx = lo + pad + 2;
  const my = y0 + pad;
  const path = new Path2D(b.warning ? WARN_PATH : gradePath(grade.shape));
  const onMark = (draw: () => void): void => {
    g.save();
    g.translate(mx, my);
    g.scale(box / 24, box / 24);
    draw();
    g.restore();
  };
  // Paint brushed onto bare wood soaks in: the wood's own tone multiplied
  // through it darkens and warms it, and the grain shows through.
  onMark(() => {
    g.clip(path);
    g.fillStyle = b.warning ? WARN_PAINT : grade.paint;
    g.fillRect(0, 0, 24, 24);
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = b.warning ? WARN_SOAK : SOAK;
    g.fillStyle = look.wood;
    g.fillRect(0, 0, 24, 24);
  });
  g.save();
  g.beginPath();
  g.rect(mx, my, box, box);
  g.clip();
  g.globalCompositeOperation = "multiply";
  grain(g, look, createRng(seed ^ 0x5eed), mx, my, box, box, 0.6);
  g.restore();
  burn(g, () =>
    onMark(() => {
      g.lineWidth = 1.3;
      g.stroke(path);
    }),
  );
  if (b.warning) {
    // The "!" burned black into the yellow, low in the triangle.
    const bang = Math.round(box * 0.55);
    burn(g, () => {
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `bold ${bang}px ${font}`;
      g.fillText("!", mx + box / 2, my + box * 0.62);
    });
  }
  g.save();
  g.fillStyle = NUMBER;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const numSize = Math.round(
    box * (grade.shape === "double" ? 0.3 : grade.shape === "diamond" ? 0.4 : 0.52),
  );
  g.font = `${numSize}px ${font}`;
  if (!b.warning) g.fillText(b.number, mx + box / 2, my + box / 2 + numSize * 0.04, box * 0.62);
  g.restore();

  // THE NAME after it, as big as the room lets it be, centred on its own
  // ink rather than on the face's em box — each hand sits differently.
  const left = mx + box + 16;
  const room = hi - pad - left;
  const text = look.caps ? b.name.toUpperCase() : b.name;
  let size = h * 0.9;
  g.font = `${size}px ${font}`;
  let m = g.measureText(text);
  const tall = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  size *= Math.min(
    1,
    room / Math.max(1, m.width),
    (h * (look.caps ? 0.62 : 0.72)) / Math.max(1, tall),
  );
  g.font = `${size}px ${font}`;
  m = g.measureText(text);
  const cy = y0 + h / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  burn(g, () => {
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.font = `${size}px ${font}`;
    g.fillText(text, left + Math.max(0, (room - m.width) / 2), cy);
  });
}

export type RunSigns = { group: THREE.Group; dispose(): void };

/** Every piste-head sign of `level`'s ski area; an empty group off one. */
export function createRunSigns(level: Level, haze: HazeUniforms): RunSigns {
  const group = new THREE.Group();
  const posts = [...signPlan(level), ...summitSigns(level)];
  const boards = posts.flatMap((p) => p.boards.map((b) => ({ post: p, board: b })));
  if (boards.length === 0) return { group, dispose: () => {} };
  const look = signLookOf(level.region);

  const cols = boards.length > 16 ? 4 : 2;
  const rows = Math.ceil(boards.length / cols);
  const W = CELL.w * cols;
  const H = Math.min(4096, THREE.MathUtils.ceilPowerOfTwo(rows * CELL.h));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const printed = boards.filter((_, i) => (Math.floor(i / cols) + 1) * CELL.h <= H);
  const print = (font: string): void => {
    g.fillStyle = look.wood;
    g.fillRect(0, 0, W, H);
    printed.forEach(({ board }, i) => {
      const seed = (level.seed * 31 + i * 7919) >>> 0;
      printBoard(g, board, look, font, seed, (i % cols) * CELL.w, Math.floor(i / cols) * CELL.h);
    });
  };
  print(SIGN_FALLBACK);

  const front = {
    pos: [] as number[],
    uv: [] as number[],
    nrm: [] as number[],
    idx: [] as number[],
  };
  const wood = { pos: [] as number[], nrm: [] as number[], idx: [] as number[] };
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]): void => {
    const base = wood.pos.length / 3;
    wood.pos.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) wood.nrm.push(n[0], n[1], n[2]);
    wood.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  printed.forEach(({ post, board }, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // The reader looks along f; the board's face is turned back at him, and
    // its print runs left to right across his view — along f × up.
    const fx = Math.sin(post.heading);
    const fz = Math.cos(post.heading);
    const sx = -fz;
    const sz = fx;
    const hw = board.width / 2;
    const y0 = post.y + board.y;
    const y1 = y0 + board.height;
    // An arrow board stands off its post the way it points.
    const shift = board.point ? (board.point === "right" ? 1 : -1) * (hw - POST.half * 2) : 0;
    const at = (depth: number, side: number, y: number): number[] => [
      post.x - fx * depth + sx * (side + shift),
      y,
      post.z - fz * depth + sz * (side + shift),
    ];
    const pad = 0.5;
    const u0 = (col * CELL.w + pad) / W;
    const u1 = ((col + 1) * CELL.w - pad) / W;
    const vTop = 1 - (row * CELL.h + pad) / H;
    const vBot = 1 - ((row + 1) * CELL.h - pad) / H;
    // The board's outline across his view, (side, y), anticlockwise from
    // its foot at the left — cut to a point at its `point` end.
    const tip = board.point ? SIGN.tip : 0;
    const ym = (y0 + y1) / 2;
    const shape: [number, number][] =
      board.point === "right"
        ? [
            [-hw, y0],
            [hw - tip, y0],
            [hw, ym],
            [hw - tip, y1],
            [-hw, y1],
          ]
        : board.point === "left"
          ? [
              [-hw + tip, y0],
              [hw, y0],
              [hw, y1],
              [-hw + tip, y1],
              [-hw, ym],
            ]
          : [
              [-hw, y0],
              [hw, y0],
              [hw, y1],
              [-hw, y1],
            ];
    const base = front.pos.length / 3;
    for (const [side, y] of shape) {
      front.pos.push(...at(FACE, side, y));
      front.uv.push(
        u0 + ((side + hw) / (2 * hw)) * (u1 - u0),
        vBot + ((y - y0) / (y1 - y0)) * (vTop - vBot),
      );
      front.nrm.push(-fx, 0, -fz);
    }
    for (let k = 1; k + 1 < shape.length; k++) front.idx.push(base, base + k, base + k + 1);
    // The back, and the edges of end grain all round.
    const b = FACE - THICK;
    const back = wood.pos.length / 3;
    for (const [side, y] of shape) {
      wood.pos.push(...at(b, side, y));
      wood.nrm.push(fx, 0, fz);
    }
    for (let k = 1; k + 1 < shape.length; k++) wood.idx.push(back, back + k + 1, back + k);
    shape.forEach(([sa, ya], k) => {
      const [sb, yb] = shape[(k + 1) % shape.length];
      const len = Math.hypot(sb - sa, yb - ya) || 1;
      const ns = (yb - ya) / len;
      const ny = -(sb - sa) / len;
      quad(at(FACE, sb, yb), at(FACE, sa, ya), at(b, sa, ya), at(b, sb, yb), [
        sx * ns,
        ny,
        sz * ns,
      ]);
    });
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // The bump reads the same print as linear data — its red channel is the
  // height, the char deepest — so it gets its own view of the canvas.
  const bump = new THREE.CanvasTexture(canvas);
  bump.colorSpace = THREE.NoColorSpace;
  bump.anisotropy = 8;
  const frontGeo = new THREE.BufferGeometry();
  frontGeo.setAttribute("position", new THREE.Float32BufferAttribute(front.pos, 3));
  frontGeo.setAttribute("normal", new THREE.Float32BufferAttribute(front.nrm, 3));
  frontGeo.setAttribute("uv", new THREE.Float32BufferAttribute(front.uv, 2));
  frontGeo.setIndex(front.idx);
  const woodGeo = new THREE.BufferGeometry();
  woodGeo.setAttribute("position", new THREE.Float32BufferAttribute(wood.pos, 3));
  woodGeo.setAttribute("normal", new THREE.Float32BufferAttribute(wood.nrm, 3));
  woodGeo.setIndex(wood.idx);
  const faceMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ map: tex, bumpMap: bump, bumpScale: 2, roughness: 0.85 }),
    haze,
    "sign-face",
  );
  const woodMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: look.edge, roughness: 0.9 }),
    haze,
    "sign-back",
  );
  const faces = new THREE.Mesh(frontGeo, faceMat);
  const backs = new THREE.Mesh(woodGeo, woodMat);
  faces.castShadow = backs.castShadow = true;

  const postGeo = new THREE.BoxGeometry(POST.half * 2, 1, POST.half * 2);
  postGeo.translate(0, 0.5, 0);
  const postMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: look.edge, roughness: 0.9 }),
    haze,
    "sign-post",
  );
  const timbers = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  timbers.castShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  posts.forEach((p, i) => {
    const top = p.boards[0];
    const height = top.y + top.height + POST.over + 0.3;
    q.setFromAxisAngle(up, p.heading);
    m4.compose(new THREE.Vector3(p.x, p.y - 0.3, p.z), q, new THREE.Vector3(1, height, 1));
    timbers.setMatrixAt(i, m4);
  });
  timbers.instanceMatrix.needsUpdate = true;
  group.add(faces, backs, timbers);

  let disposed = false;
  void loadFace(look).then((ok) => {
    if (!ok || disposed) return;
    print(`"${look.family}", ${SIGN_FALLBACK}`);
    tex.needsUpdate = bump.needsUpdate = true;
  });

  return {
    group,
    dispose() {
      disposed = true;
      frontGeo.dispose();
      woodGeo.dispose();
      postGeo.dispose();
      faceMat.dispose();
      woodMat.dispose();
      postMat.dispose();
      timbers.dispose();
      tex.dispose();
      bump.dispose();
    },
  };
}
