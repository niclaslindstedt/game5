// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R5 — DOES THE PISTE CROSS ITSELF: every pair of non-adjacent segments
// tested for a proper intersection, off a spatial hash so the test is a few
// thousand pairs rather than a few million. Independent of how the line was
// drawn: the generator's walk only ever goes down the map and cannot cross,
// and this is the check that would say so if that ever stopped being true.

type Point = { readonly x: number; readonly z: number };

const CELL = 16;

function orient(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** How many times an open polyline crosses itself. */
export function selfCrossings(points: readonly Point[]): number {
  const n = points.length;
  const cells = new Map<number, number[]>();
  for (let i = 0; i + 1 < n; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (
      let c = Math.floor(Math.min(a.x, b.x) / CELL);
      c <= Math.floor(Math.max(a.x, b.x) / CELL);
      c++
    ) {
      for (
        let r = Math.floor(Math.min(a.z, b.z) / CELL);
        r <= Math.floor(Math.max(a.z, b.z) / CELL);
        r++
      ) {
        const key = c * 8192 + r;
        const list = cells.get(key);
        if (list) list.push(i);
        else cells.set(key, [i]);
      }
    }
  }
  const seen = new Set<number>();
  let count = 0;
  for (const list of cells.values()) {
    for (let p = 0; p < list.length; p++) {
      for (let q = p + 1; q < list.length; q++) {
        const i = Math.min(list[p], list[q]);
        const j = Math.max(list[p], list[q]);
        if (j - i <= 1) continue;
        const key = i * n + j;
        if (seen.has(key)) continue;
        seen.add(key);
        if (crosses(points[i], points[i + 1], points[j], points[j + 1])) count++;
      }
    }
  }
  return count;
}
