// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD BODY LAB'S SHEETS (`make hud-body`, `scripts/hud-body.mjs`): one
// view of the figure as a picture — the 3D body lit as it is (left), and the
// figure traced off it (right): every part its own colour (magenta where no
// part is, white where two are), the bones flat by their bands, the crack
// marks in red — and how much flesh fell in no part or in two.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { encodePng } from "@niclaslindstedt/oss-game-framework/tooling/png";

/** The sheet painter for a figure of W × H pixels, K to a unit. */
export function createSheets({ W, H, K, root, bones: BONES, pathOf }) {
  /** A path's fill as a mask (even-odd). */
  function rasterPath(d) {
    const rings = d
      .split("Z")
      .filter((r) => r.trim())
      .map((r) =>
        r
          .replace(/^M/, "")
          .split("L")
          .map((q) => q.split(",").map((v) => Number(v) * K)),
      );
    const m = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const py = y + 0.5;
      const xs = [];
      for (const r of rings)
        for (let i = 0; i < r.length; i++) {
          const a = r[i];
          const b = r[(i + 1) % r.length];
          if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py))
            xs.push(a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      xs.sort((a, b) => a - b);
      for (let j = 0; j + 1 < xs.length; j += 2)
        for (
          let x = Math.max(0, Math.ceil(xs[j] - 0.5));
          x <= Math.min(W - 1, Math.floor(xs[j + 1] - 0.5));
          x++
        )
          m[y * W + x] ^= 1;
    }
    return m;
  }
  const HUES = Array.from({ length: 21 }, (_, i) => {
    const h = (i * 137.5) % 360;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return 255 * (0.5 - 0.3 * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return [f(0), f(8), f(4)];
  });

  function sheet(r, parts, marks, file) {
    const GAP = 24;
    const SW = W * 2 + GAP;
    const rgb = Buffer.alloc(SW * H * 3, 24);
    const put = (x, y, c, dx = 0) => {
      x += dx;
      if (x < 0 || y < 0 || x >= SW || y >= H) return;
      const o = (y * SW + x) * 3;
      rgb[o] = c[0];
      rgb[o + 1] = c[1];
      rgb[o + 2] = c[2];
    };
    // Left: the model lit, the bones over the skin as they lie.
    const top = new Int16Array(W * H).fill(-1);
    for (const [i, b] of r.order.entries()) {
      const m = r.masks.get(b);
      for (let k = 0; k < W * H; k++) if (m[k]) top[k] = i;
    }
    for (let k = 0; k < W * H; k++) {
      const x = k % W;
      const y = (k / W) | 0;
      if (top[k] >= 0) {
        const g = 70 + 175 * r.tones.get(r.order[top[k]])[k];
        put(x, y, [g, g * 0.98, g * 0.94]);
      } else if (r.skinMask[k]) {
        const t = r.skinTone[k];
        put(x, y, [120 + 90 * t, 80 + 60 * t, 60 + 40 * t]);
      }
    }
    // Right: the figure as traced — every part its own colour (magenta where
    // no part is, white where two are), the bones flat by band, the marks.
    const dx = W + GAP;
    const outline = rasterPath(r.outline.map((o) => pathOf(o)).join(""));
    const count = new Uint8Array(W * H);
    const owner = new Int8Array(W * H).fill(-1);
    for (const [i, d] of Object.values(parts).entries()) {
      const m = rasterPath(d);
      for (let k = 0; k < W * H; k++)
        if (m[k] && outline[k]) {
          count[k]++;
          owner[k] = i;
        }
    }
    let doubled = 0;
    let none = 0;
    for (let k = 0; k < W * H; k++) {
      if (!outline[k]) continue;
      const c = count[k] === 0 ? [255, 0, 255] : count[k] > 1 ? [255, 255, 255] : HUES[owner[k]];
      if (count[k] === 0) none++;
      if (count[k] > 1) doubled++;
      put(k % W, (k / W) | 0, c, dx);
    }
    for (const b of r.order) {
      const s = r.shapes[b];
      const fill = rasterPath(s.fill);
      const sh = rasterPath(s.shadow);
      const dp = rasterPath(s.deep);
      const li = rasterPath(s.light);
      for (let k = 0; k < W * H; k++) {
        if (!fill[k]) continue;
        const g = li[k] ? 236 : dp[k] ? 112 : sh[k] ? 156 : 198;
        put(k % W, (k / W) | 0, [g, g * 0.98, g * 0.94], dx);
      }
    }
    for (const b of BONES) {
      const m = marks[b];
      for (let t = -m.r; t <= m.r; t += 0.05)
        put(
          Math.round((m.x - Math.sin(m.a) * t) * K),
          Math.round((m.y + Math.cos(m.a) * t) * K),
          [230, 40, 40],
          dx,
        );
    }
    const out = join(root, "previews", file);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, encodePng(SW, H, rgb));
    return { out, doubled: doubled / K / K, none: none / K / K };
  }

  return { rasterPath, sheet };
}
