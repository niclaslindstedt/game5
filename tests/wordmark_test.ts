// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDMARK (`pwa/src/game/wordmark.ts`) is drawn, not set, so what a
// font would guarantee is held here: every letter a set of closed convex
// pieces inside its own box, the pieces tiling rather than overlapping, the
// cut one straight gap that enters and leaves the name in clear air — and,
// the rule that keeps it readable at the menu's size, no letter cut into a
// piece too small to read as part of it. The last is measured the way an
// eye meets it: the word is rasterized with the cut taken out, and every
// connected piece of ink counted.
import { describe, expect, it } from "vitest";

import {
  cutBand,
  cutSide,
  lean,
  lockup,
  WORDMARK_CAP,
  WORDMARK_FRAGMENT_MIN,
  WORDMARK_GLYPHS,
  WORDMARK_SLANT,
  type LockupKind,
  type Placed,
  type Pt,
} from "../pwa/src/game/wordmark.ts";

const KINDS: LockupKind[] = ["stacked", "inline"];
const LEAN = Math.tan((WORDMARK_SLANT * Math.PI) / 180);

/** Signed area, shoelace; positive for a clockwise ring in y-down space. */
function area(poly: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function inPolygon(poly: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The connected pieces of ink a placed letter is left in once the cut is
 * taken out of it, rasterized at `k` samples a unit: each piece's area and
 * the narrower side of its box, units. */
function pieces(letter: Placed, band: readonly Pt[], k = 4): { area: number; side: number }[] {
  const all = letter.parts.flat();
  const x0 = Math.min(...all.map((p) => p[0]));
  const y0 = Math.min(...all.map((p) => p[1]));
  const w = Math.ceil((Math.max(...all.map((p) => p[0])) - x0) * k);
  const h = Math.ceil((Math.max(...all.map((p) => p[1])) - y0) * k);
  const ink = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = x0 + (i + 0.5) / k;
      const y = y0 + (j + 0.5) / k;
      if (letter.parts.some((p) => inPolygon(p, x, y)) && !inPolygon(band, x, y))
        ink[j * w + i] = 1;
    }
  }
  const seen = new Uint8Array(w * h);
  const out: { area: number; side: number }[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!ink[s] || seen[s]) continue;
    seen[s] = 1;
    const stack = [s];
    let n = 0;
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    while (stack.length) {
      const q = stack.pop()!;
      n++;
      const i = q % w;
      const j = (q - i) / w;
      minX = Math.min(minX, i);
      maxX = Math.max(maxX, i);
      minY = Math.min(minY, j);
      maxY = Math.max(maxY, j);
      for (const [a, b] of [
        [i + 1, j],
        [i - 1, j],
        [i, j + 1],
        [i, j - 1],
      ]) {
        if (a < 0 || b < 0 || a >= w || b >= h) continue;
        const t = b * w + a;
        if (ink[t] && !seen[t]) {
          seen[t] = 1;
          stack.push(t);
        }
      }
    }
    out.push({
      area: n / k / k,
      side: Math.min(maxX - minX + 1, maxY - minY + 1) / k,
    });
  }
  return out;
}

describe("the wordmark's letters", () => {
  for (const [char, glyph] of Object.entries(WORDMARK_GLYPHS)) {
    it(`${char} is closed convex pieces inside its own box`, () => {
      expect(glyph.parts.length).toBeGreaterThan(0);
      for (const part of glyph.parts) {
        expect(part.length).toBeGreaterThanOrEqual(3);
        // Closed and wound one way: a real area, every corner turning the
        // same way round.
        expect(Math.abs(area(part))).toBeGreaterThan(1);
        const signs = new Set<number>();
        for (let i = 0; i < part.length; i++) {
          const [ax, ay] = part[i];
          const [bx, by] = part[(i + 1) % part.length];
          const [cx, cy] = part[(i + 2) % part.length];
          const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
          if (Math.abs(cross) > 1e-9) signs.add(Math.sign(cross));
        }
        expect(signs.size, `${char}: a piece is not convex`).toBe(1);
        for (const [x, y] of part) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(glyph.advance);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(WORDMARK_CAP);
        }
      }
    });

    it(`${char}'s pieces tile rather than overlap`, () => {
      // Every sample point is inside at most one piece.
      for (let y = 0.5; y < WORDMARK_CAP; y += 1) {
        for (let x = 0.5; x < glyph.advance; x += 1) {
          const hits = glyph.parts.filter((p) => inPolygon(p, x, y)).length;
          expect(hits, `${char} at ${x},${y}`).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  it("leans forward: the cap line further right than the baseline", () => {
    expect(lean([0, 0])[0]).toBeGreaterThan(lean([0, WORDMARK_CAP])[0]);
    expect(lean([0, WORDMARK_CAP])).toEqual([0, WORDMARK_CAP]);
  });
});

describe("the lockups", () => {
  for (const kind of KINDS) {
    const L = lockup(kind);
    const band = cutBand(L.cut);

    it(`${kind} spells the name`, () => {
      expect(L.letters.map((g) => g.char).join("")).toBe("FALLLINE");
    });

    it(`${kind} keeps every letter inside its box and clear of the mark`, () => {
      for (const g of L.letters) {
        for (const part of g.parts) {
          for (const [x, y] of part) {
            expect(x).toBeLessThanOrEqual(L.width + 1e-9);
            expect(y).toBeGreaterThanOrEqual(-1e-9);
            expect(y).toBeLessThanOrEqual(L.height + 1e-9);
            // The mark's right edge, leant like a stem: at a height `y` it
            // stands `(height − y)` up its foot.
            const edge = L.mark.x + L.mark.size + (L.height - y) * LEAN;
            expect(x, `${g.char} into the mark`).toBeGreaterThan(edge + 10);
          }
        }
      }
    });

    it(`${kind}'s cut enters and leaves the name in clear air`, () => {
      for (const end of [L.cut.from, L.cut.to]) {
        for (const g of L.letters) {
          for (const part of g.parts) expect(inPolygon(part, end[0], end[1])).toBe(false);
        }
      }
      expect(L.cut.width).toBeGreaterThan(0);
    });

    it(`${kind}'s cut is one straight gap through the name, crossing several letters`, () => {
      // A letter is crossed when its corners lie on both sides of the line
      // AND the gap actually takes ink out of it.
      const crossed = L.letters.filter((g) => {
        const sides = new Set(g.parts.flat().map((p) => Math.sign(cutSide(L.cut, p))));
        return sides.size > 1 && pieces(g, band).length > 1;
      });
      expect(crossed.length).toBeGreaterThanOrEqual(4);
      // It runs DOWN the way it goes, at a fall line's angle, not flat.
      const angle =
        (Math.atan2(L.cut.to[1] - L.cut.from[1], L.cut.to[0] - L.cut.from[0]) * 180) / Math.PI;
      expect(angle).toBeGreaterThan(12);
      expect(angle).toBeLessThan(40);
    });

    it(`${kind}'s cut leaves no fragment too small to read`, () => {
      const least = WORDMARK_FRAGMENT_MIN * WORDMARK_CAP;
      for (const g of L.letters) {
        for (const p of pieces(g, band)) {
          expect(p.side, `${kind} ${g.char}: a sliver`).toBeGreaterThanOrEqual(least);
          expect(p.area, `${kind} ${g.char}: a speck`).toBeGreaterThanOrEqual(least * least * 2);
        }
      }
    });
  }

  it("the inline cut runs from over the first L's top to under the N's foot", () => {
    const L = lockup("inline");
    const firstL = L.letters[2];
    const n = L.letters[6];
    expect(firstL.char).toBe("L");
    expect(n.char).toBe("N");
    expect(L.cut.from[1]).toBeLessThanOrEqual(Math.min(...firstL.parts.flat().map((p) => p[1])));
    expect(L.cut.to[1]).toBeGreaterThan(Math.max(...n.parts.flat().map((p) => p[1])));
  });
});
