// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VOLUME'S PLAN — three-free, so the suite holds it
// (`tests/cloud_volume_test.ts`): how big each of HIGH's cloud pictures is,
// which of its pixels is marched this frame, when the picture cannot be
// carried over from the last one, and how each layer of the field
// (`cloud-field.ts`) is carved (`cloud-volume-glsl.ts`).
//
// THE PICTURE is kept at half the screen's width and height (a quarter of
// its pixels), and only ONE PIXEL IN EACH 4 × 4 BLOCK of it is marched a
// frame — a sixteenth, in an order that spreads each frame's pixels
// evenly (`BAYER`) — so a pixel is marched afresh every sixteen frames.
// The other fifteen are CARRIED: each pixel's view is followed out to the
// distance its cloud's light comes from (the fresh marches' own, read
// between them), and that point is found on last frame's picture through
// last frame's lens. A view the last picture never saw (the screen's new
// edge as the lens turns) takes the fresh marches round it. A CUT — the
// lens jumped, a card or a lab moved the clock or the sky — marches every
// pixel at once, so nothing of another picture is ever carried into this
// one.

import type { CloudLayer } from "./cloud-field.ts";

/** HIGH's most steps through a marched layer (each a share of its
 * distance, `cloud-volume-glsl.ts`) and its reads toward the sun; MAX
 * marches more of each and a pixel of every 2 × 2 a frame. */
export type VolumeLook = { steps: number; light: number; block: 2 | 4 };
export const VOLUME_LOOK: Record<"volume" | "volumeFine", VolumeLook> = {
  volume: { steps: 48, light: 5, block: 4 },
  volumeFine: { steps: 64, light: 6, block: 2 },
};

/** The order a block's pixels are marched in, frame after frame: each
 * frame's pixel as far from the last few as the block allows (an ordered
 * dither's matrix), `[x, y]` within the block. */
export function bayerOrder(block: 2 | 4): [number, number][] {
  const b2 = [0, 2, 3, 1];
  const order: [number, number][] = [];
  if (block === 2) {
    for (const i of [0, 3, 1, 2]) order.push([i & 1, i >> 1]);
    return order;
  }
  const m = new Array<number>(16);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++)
      m[y * 4 + x] = 4 * b2[(y & 1) * 2 + (x & 1)] + b2[(y >> 1) * 2 + (x >> 1)];
  for (let r = 0; r < 16; r++) {
    const at = m.indexOf(r);
    order.push([at % 4, Math.floor(at / 4)]);
  }
  return order;
}

/** The kept picture's size and the fresh marches' for a drawing buffer of
 * `w` × `h`. */
export function volumeSizes(
  w: number,
  h: number,
  block: number,
): { keep: [number, number]; fresh: [number, number] } {
  const kw = Math.max(1, Math.round(w / 2));
  const kh = Math.max(1, Math.round(h / 2));
  return { keep: [kw, kh], fresh: [Math.ceil(kw / block), Math.ceil(kh / block)] };
}

/** What a frame is drawn from, to tell a cut. */
export type VolumeView = {
  eye: [number, number, number];
  /** The lens's forward. */
  ahead: [number, number, number];
  t: number;
  /** Toward the sun. */
  sun: [number, number, number];
  /** Anything else that makes the last picture another sky's (the field
   * itself, the buffer's size, the tier). */
  key: string;
};

/** How far a frame may move from the last before its picture is marched
 * afresh: the lens farther than a fast skier goes in a frame (a cut, a
 * restart), turned more than a whip pan, the run's clock jumped (a lab, a
 * card), the sun moved more than the sky's clock moves it in a frame. */
export const CUT = { eye: 25, turn: 0.35, t: 0.5, sun: 0.01 } as const;

const dot = (a: readonly number[], b: readonly number[]): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Whether `next` cannot carry `last`'s picture. */
export function isCut(last: VolumeView | null, next: VolumeView): boolean {
  if (!last || last.key !== next.key) return true;
  const de = Math.hypot(
    next.eye[0] - last.eye[0],
    next.eye[1] - last.eye[1],
    next.eye[2] - last.eye[2],
  );
  if (de > CUT.eye) return true;
  if (Math.acos(Math.min(1, Math.max(-1, dot(next.ahead, last.ahead)))) > CUT.turn) return true;
  if (Math.abs(next.t - last.t) > CUT.t) return true;
  return Math.acos(Math.min(1, Math.max(-1, dot(next.sun, last.sun)))) > CUT.sun;
}

/** How a layer is carved: marched or read as a shell, the shape's and the
 * detail's tiles (m), the detail's bite, and how fast its puffs boil up
 * (m/s). */
export type LayerCarve = {
  marched: boolean;
  shapeTile: number;
  detailTile: number;
  bite: number;
  boil: number;
};

/** THE CARVE of each genus: the thin ice keeps the shell; a heap's puffs
 * are a third of a cell and boil up; a deck's are flatter and slower. */
export function carveOf(layer: Pick<CloudLayer, "kind" | "size">): LayerCarve {
  const thin = layer.kind === "cirrus" || layer.kind === "veil";
  const heap = layer.kind === "cumulus" || layer.kind === "congestus";
  const scud = layer.kind === "fractus";
  const shapeTile = Math.min(2400, Math.max(500, layer.size * (heap ? 1.6 : 0.9)));
  return {
    marched: !thin,
    shapeTile,
    detailTile: Math.min(500, Math.max(160, shapeTile * 0.2)),
    bite: heap ? 0.28 : scud ? 0.45 : layer.kind === "nimbo" ? 0.2 : 0.3,
    boil: heap ? 0.8 : scud ? 0.4 : 0.15,
  };
}

const wrap = (x: number): number => x - Math.floor(x);

/** Where layer `l`'s shape and detail stand in their tiles at run time `t`:
 * carried with the wind (the same carry the field's column has) and boiled
 * up, wrapped to the tile so a float on the GPU never holds an hour of it.
 * x, y, z periods of the shape; then the detail's. */
export function carveOffsets(
  l: Pick<CloudLayer, "speed" | "heading">,
  carve: LayerCarve,
  t: number,
): { shape: [number, number, number]; detail: [number, number, number] } {
  const cx = Math.sin(l.heading) * l.speed * t;
  const cz = Math.cos(l.heading) * l.speed * t;
  const s = 1 / carve.shapeTile;
  const d = 1 / carve.detailTile;
  return {
    shape: [wrap(-cx * s), wrap(-carve.boil * t * s), wrap(-cz * s)],
    detail: [wrap(-cx * d), wrap(-carve.boil * 2.2 * t * d), wrap(-cz * d)],
  };
}
