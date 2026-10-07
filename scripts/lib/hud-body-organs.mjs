// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD BODY LAB'S ORGANS (`make hud-body`, `scripts/hud-body.mjs`): each
// organ of `ORGANS` drawn from the same 3D body as the bones, into a depth
// buffer and a normal of its own, so it is laid down among the bones in the
// order their depths say — the ribs over the lungs, the heart in front of
// the spine, the pelvis's ring round the bladder.
//
// The lungs are the one organ this body has no surface for: only their
// airways and vessels, which branch through the whole lung. Their
// silhouette is that tree CLOSED — grown by `close` mm and shrunk back —
// and their surface a dome over it: the tree's own depth spread over the
// closed shape and smoothed, its normals read off the smoothed depth.

import { join } from "node:path";

import { ORGAN_SOURCES, elementsByName, loadObj } from "./bodyparts3d.mjs";
import { blurIn } from "./mask-trace.mjs";

/** A whole-frame box blur of a field, `passes` times `r` either side. */
function boxBlur(field, W, H, r, passes = 2) {
  let a = Float32Array.from(field);
  const pass = (src, horiz) => {
    const out = new Float32Array(W * H);
    const L = horiz ? W : H;
    for (let o = 0; o < (horiz ? H : W); o++) {
      const at = (k) => (horiz ? o * W + k : k * W + o);
      let acc = 0;
      for (let k = 0; k <= r && k < L; k++) acc += src[at(k)];
      for (let k = 0; k < L; k++) {
        out[at(k)] = acc / (2 * r + 1);
        if (k + r + 1 < L) acc += src[at(k + r + 1)];
        if (k - r >= 0) acc -= src[at(k - r)];
      }
    }
    return out;
  };
  for (let k = 0; k < passes; k++) a = pass(pass(a, true), false);
  return a;
}

/** A mask CLOSED by `r` px: grown (blurred, kept where anything reached)
 * then shrunk (blurred, kept where nearly everything is) — a smooth shape
 * round everything the mask branched through. */
function closeMask(mask, W, H, r) {
  const grown = boxBlur(mask, W, H, r).map((x) => (x > 0.04 ? 1 : 0));
  const shrunk = boxBlur(grown, W, H, r);
  return Uint8Array.from(shrunk, (x) => (x > 0.9 ? 1 : 0));
}

/** The organs' meshes and the way to draw each: `{ meshes, layerOf }`,
 * `layerOf(view, drawn)` an organ's `{ d, mask }` seen one way. */
export function createOrgans({ cache, W, H, K, MM, posed, still }) {
  const part = elementsByName(cache.table);
  const isa = elementsByName(cache.isaTable);
  const meshes = new Map(
    Object.entries(ORGAN_SOURCES).map(([organ, src]) => {
      const table = src.isa ? isa : part;
      const dir = src.isa ? cache.isaDir : cache.objDir;
      const fjs = new Set(src.names.flatMap((n) => table.get(n) ?? []));
      if (fjs.size === 0) throw new Error(`no mesh for ${organ}`);
      return [organ, [...fjs].map((fj) => posed(loadObj(join(dir, `${fj}.obj`)), still))];
    }),
  );

  /** One organ seen one way: its depth and normals, and its mask. */
  function layerOf(organ, view, drawn) {
    const d = drawn(view, meshes.get(organ), false);
    const tree = Uint8Array.from(d.depth, (x) => (Number.isFinite(x) ? 1 : 0));
    const close = ORGAN_SOURCES[organ].close;
    if (!close) return { d, mask: tree };
    const r = Math.max(2, Math.round((close / MM) * K));
    const mask = closeMask(tree, W, H, r);
    // The tree's depth spread over the shape, then smoothed into a dome
    // that bulges toward the viewer from its rim.
    const spread = blurIn(
      Float32Array.from(d.depth, (x) => (Number.isFinite(x) ? x : 0)),
      tree,
      W,
      H,
      r * 2,
    );
    const inside = boxBlur(mask, W, H, r);
    const depth = new Float32Array(W * H).fill(Infinity);
    const bulge = close * 1.6;
    const smooth = blurIn(spread, mask, W, H, r);
    for (let i = 0; i < W * H; i++)
      if (mask[i]) depth[i] = smooth[i] - bulge * Math.sqrt(Math.min(1, inside[i]));
    const px = MM / K;
    const normal = new Float32Array(W * H * 3);
    const at = (x, y) => {
      const j = Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x));
      return mask[j] ? depth[j] : null;
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i]) continue;
        const c = depth[i];
        const dx = ((at(x + 1, y) ?? c) - (at(x - 1, y) ?? c)) / (2 * px);
        const dy = ((at(x, y + 1) ?? c) - (at(x, y - 1) ?? c)) / (2 * px);
        // The surface depth(x, y) turned back into the body's frame (x his
        // left, y his back, z up): its normal faces the viewer.
        const l = Math.hypot(dx, dy, 1);
        normal[i * 3] = (view.sx * dx) / l;
        normal[i * 3 + 1] = -view.sd / l;
        normal[i * 3 + 2] = -dy / l;
      }
    return { d: { depth, normal }, mask };
  }
  return { meshes, layerOf };
}
