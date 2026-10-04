// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BANNER a race hangs its word on — the finish arch's span, the start
// house's fascia: the word on the organiser's red, a checkered block at
// each end, a white rule top and bottom.

import * as THREE from "three";

import { PALETTE } from "../identity.ts";
import { STRINGS } from "./strings.ts";

/** The banner printed across the span: the word on the arch's own red,
 * a checkered block at each end, a white rule top and bottom — and the
 * word SIZED TO THE PANEL, measured, never a guessed font over a guessed
 * box. `aspect` is the panel's width over its height. */
export function bannerTexture(
  aspect: number,
  word: string = STRINGS.archLine,
): THREE.CanvasTexture {
  const h = 128;
  const w = Math.min(2048, Math.round(h * aspect));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = PALETTE.flag;
  g.fillRect(0, 0, w, h);
  const rule = 8;
  const sq = (h - rule * 2) / 3;
  const cols = 4;
  for (const x0 of [rule, w - rule - sq * cols]) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle = (r + c) % 2 === 0 ? "#15181c" : "#f6f8fa";
        g.fillRect(x0 + c * sq, rule + r * sq, sq, sq);
      }
    }
  }
  g.fillStyle = "#f6f8fa";
  g.fillRect(0, 0, w, rule * 0.6);
  g.fillRect(0, h - rule * 0.6, w, rule * 0.6);
  const room = w - 2 * (rule + sq * cols) - 2 * sq;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = 84;
  g.font = `900 ${size}px sans-serif`;
  const wide = g.measureText(word).width;
  if (wide > room) {
    size = Math.floor((size * room) / wide);
    g.font = `900 ${size}px sans-serif`;
  }
  g.fillText(word, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
