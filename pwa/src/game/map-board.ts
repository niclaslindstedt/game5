// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE MAP BOARD AT A LIFT'S TOP — the face of the board `station-
// plan.ts` stands at every chair's and gondola's top, painted as the free
// ride's start card paints the ski area (`panorama.ts`): the mountain from
// out over the valley, every run in its colour on a white casing, the lifts
// between their stations, each run's number in its grade's sign — under a
// header that says what it is, with a YOU ARE HERE mark at the top the board
// stands on and the four signs read along its foot.
//
// THE PICTURE IS PAINTED ONCE A MAP, and usually not here at all: the start
// card's worker has already painted it to show the map being picked, and
// the card hands its answer over (`map-board-picture.ts`), so a free ride begun
// off the card puts that same picture on its boards. A map the card never
// showed — a link, a lab — is painted here as the scene is built, under the
// loading card. Each board gets its own copy, since its mark is its own.

import * as THREE from "three";
import type { Level } from "@engine";

import { GRADE_LOOK, gradePath } from "./grade-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import {
  PANORAMA_VIEW,
  fitPanorama,
  panoramaSchematic,
  renderPanorama,
  toPanorama,
  type PanoramaLevel,
  type PanoramaSchematic,
  type PanoramaView,
} from "./panorama.ts";
import { boardKey, keptBoard, type BoardPicture } from "./map-board-picture.ts";
import type { Part } from "./station-plan.ts";
import { STRINGS } from "./strings.ts";

/** The board's face, m: its width and height, its foot over the snow and
 * how far in front of its posts' line it hangs — `station-parts.ts`'s
 * frame is built round it. */
export const BOARD_FACE = { width: 2.6, height: 3.09, foot: 1.0, front: 0.1 } as const;

/** The face as painted, px: the panorama square, the header over it and
 * the legend under it. */
const PX = { w: 512, head: 64, foot: 32 } as const;
const PX_H = PX.head + PX.w + PX.foot;

/** The panorama to paint a board with: the card's, or painted here. */
async function pictureOf(
  level: Level,
): Promise<{ image: CanvasImageSource; view: PanoramaView; schematic: PanoramaSchematic }> {
  const hit = keptBoard(boardKey(level));
  if (hit) return { image: await imageOf(hit.picture), view: hit.view, schematic: hit.schematic };
  const map = level as unknown as PanoramaLevel;
  const view = fitPanorama(map);
  const painted = renderPanorama(map, view);
  const image = await imageOf({ px: view.px, rgba: painted.rgba });
  return { image, view, schematic: panoramaSchematic(map, view, painted.depth) };
}

/** A picture as something a canvas draws. */
async function imageOf(picture: BoardPicture["picture"]): Promise<CanvasImageSource> {
  if (picture instanceof Blob) return createImageBitmap(picture);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = picture.px;
  canvas.getContext("2d")!.putImageData(new ImageData(picture.rgba, picture.px, picture.px), 0, 0);
  return canvas;
}

/** The board's paints: its enamel, its header, its lettering. */
const PAINT = {
  face: "#f1efe8",
  head: "#24442b",
  ink: "#f4f1e6",
  dark: "#16181b",
  here: "#d42a2f",
};

/** One board's face painted: the header, the panorama with the schematic
 * laid over it as the start card lays it (`seed-preview.tsx`'s classes,
 * restated as strokes), the YOU ARE HERE mark at `here`, and the legend. */
function paintFace(
  g: CanvasRenderingContext2D,
  image: CanvasImageSource | null,
  schematic: PanoramaSchematic | null,
  here: [number, number] | null,
): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = PAINT.face;
  g.fillRect(0, 0, PX.w, PX_H);
  g.fillStyle = PAINT.head;
  g.fillRect(0, 0, PX.w, PX.head);
  g.fillStyle = PAINT.ink;
  g.font = "700 34px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(STRINGS.mapBoardTitle, PX.w / 2, PX.head / 2 + 2);
  // The legend: the four signs and their colours' names along the foot.
  const grades = Object.keys(GRADE_LOOK) as (keyof typeof GRADE_LOOK)[];
  grades.forEach((grade, i) => {
    const x = (PX.w / grades.length) * (i + 0.5) - 26;
    const y = PX.head + PX.w + 4;
    badge(g, grade, x, y, 24);
    g.fillStyle = PAINT.dark;
    g.font = "600 15px system-ui, sans-serif";
    g.textAlign = "left";
    g.fillText(STRINGS.gradeNames[grade], x + 28, y + 13);
  });
  if (!image || !schematic) return;
  g.drawImage(image, 0, PX.head, PX.w, PX.w);
  // The schematic, in the card's user space.
  const k = PX.w / PANORAMA_VIEW;
  g.setTransform(k, 0, 0, k, 0, PX.head);
  g.lineJoin = g.lineCap = "round";
  const stroke = (d: string, colour: string, width: number, dash: number[] = [], alpha = 1) => {
    g.globalAlpha = alpha;
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.setLineDash(dash);
    g.stroke(new Path2D(d));
  };
  for (const r of schematic.runs) stroke(r.hidden, GRADE_LOOK[r.grade].paint, 0.5, [0.6, 1.1], 0.5);
  for (const r of schematic.runs) {
    const road = r.kind === "road";
    stroke(r.seen, "#fff", road ? 1 : r.raced ? 2.3 : 1.6, [], road ? 0.75 : 0.9);
  }
  for (const r of schematic.runs) {
    const road = r.kind === "road";
    stroke(
      r.seen,
      GRADE_LOOK[r.grade].paint,
      road ? 0.45 : r.raced ? 1.35 : 0.8,
      road ? [0.9, 0.7] : [],
    );
  }
  for (const l of schematic.lifts) {
    const d = `M${l.from[0]} ${l.from[1]}L${l.to[0]} ${l.to[1]}`;
    stroke(d, "#fff", 1, [], 0.75);
    stroke(d, PAINT.dark, 0.4, l.kind === "drag" ? [1.2, 0.6] : []);
    for (const [x, y] of [l.from, l.to]) {
      g.globalAlpha = 1;
      g.setLineDash([]);
      g.beginPath();
      g.arc(x, y, 0.9, 0, Math.PI * 2);
      g.fillStyle = PAINT.dark;
      g.fill();
      g.lineWidth = 0.3;
      g.strokeStyle = "#fff";
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.setLineDash([]);
  for (const r of schematic.runs) {
    if (!r.badge) continue;
    badge(g, r.grade, r.badge[0] - BADGE / 2, r.badge[1] - BADGE / 2, BADGE, r.number);
  }
  if (here) {
    g.beginPath();
    g.arc(here[0], here[1], 2.2, 0, Math.PI * 2);
    g.fillStyle = PAINT.here;
    g.fill();
    g.lineWidth = 0.7;
    g.strokeStyle = "#fff";
    g.stroke();
    g.font = "700 3.4px system-ui, sans-serif";
    g.textAlign = here[0] > PANORAMA_VIEW * 0.7 ? "right" : "left";
    g.textBaseline = "middle";
    const x = here[0] + (g.textAlign === "right" ? -3.4 : 3.4);
    g.lineWidth = 0.9;
    g.strokeStyle = "#fff";
    g.strokeText(STRINGS.mapBoardHere, x, here[1]);
    g.fillStyle = PAINT.here;
    g.fillText(STRINGS.mapBoardHere, x, here[1]);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

/** A run's number badge on the panorama, user units across. */
const BADGE = 7;

/** A grade's sign `size` across at (x, y), its number on it where given. */
function badge(
  g: CanvasRenderingContext2D,
  grade: keyof typeof GRADE_LOOK,
  x: number,
  y: number,
  size: number,
  number?: string,
): void {
  const look = GRADE_LOOK[grade];
  g.save();
  g.translate(x, y);
  g.scale(size / 24, size / 24);
  const path = new Path2D(gradePath(look.shape));
  g.fillStyle = look.paint;
  g.fill(path);
  g.lineWidth = 1.6;
  g.strokeStyle = look.rim;
  g.stroke(path);
  g.restore();
  if (number === undefined) return;
  g.fillStyle = "#fff";
  g.font = `700 ${size * 0.51}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(number, x + size / 2, y + size / 2 + size * 0.04);
}

export type MapBoards = { group: THREE.Group; dispose(): void };

/** The faces of `boards` (the layout's `board` parts), each its own canvas
 * — blank enamel under its header at once, the panorama on it once painted. */
export function createMapBoards(
  level: Level,
  boards: readonly Part[],
  tops: readonly { x: number; y: number; z: number }[],
  haze: HazeUniforms,
): MapBoards {
  const group = new THREE.Group();
  if (boards.length === 0) return { group, dispose: () => {} };
  const geo = new THREE.PlaneGeometry(BOARD_FACE.width, BOARD_FACE.height);
  const made: { tex: THREE.CanvasTexture; mat: THREE.Material }[] = [];
  const faces = boards.map((b) => {
    const canvas = document.createElement("canvas");
    canvas.width = PX.w;
    canvas.height = PX_H;
    paintFace(canvas.getContext("2d")!, null, null, null);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = hazeMaterial(
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
      haze,
      "map-board",
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      b.x + Math.sin(b.yaw) * BOARD_FACE.front,
      b.y + BOARD_FACE.foot + BOARD_FACE.height / 2,
      b.z + Math.cos(b.yaw) * BOARD_FACE.front,
    );
    mesh.rotation.y = b.yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    made.push({ tex, mat });
    // The top it stands on: the nearest.
    let top = tops[0];
    for (const t of tops)
      if (Math.hypot(t.x - b.x, t.z - b.z) < Math.hypot(top.x - b.x, top.z - b.z)) top = t;
    return { canvas, tex, top };
  });
  let disposed = false;
  void pictureOf(level).then(({ image, view, schematic }) => {
    if (disposed) return;
    for (const f of faces) {
      const here = f.top ? toPanorama(view, f.top.x, f.top.y, f.top.z) : null;
      paintFace(f.canvas.getContext("2d")!, image, schematic, here);
      f.tex.needsUpdate = true;
    }
  });
  return {
    group,
    dispose() {
      disposed = true;
      geo.dispose();
      for (const m of made) {
        m.tex.dispose();
        m.mat.dispose();
      }
    },
  };
}
