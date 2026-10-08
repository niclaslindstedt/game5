// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CIVILIAN'S ROUTE — the way a person on foot (or a guest skating on his
// skis along the valley floor) goes ROUND a ski area's base: from his place
// through a few stops and back the same way, pausing at every stop. A pure
// function of the clock (`routeAt`): where he is, which way he faces,
// whether he is moving and how far he has gone in all — so he never slides
// and never jumps, and a view draws his steps (or his skating strides) off
// the distance covered. Three-free and DOM-free; `civilian-plan.ts` deals
// the stops (each line held clear of the skiing) and `tests/civilians_test.ts`
// holds the walk.
//
// The route is walked OUT through its stops to the last and BACK through
// them to the first, so every line he walks is a line the plan checked
// clear, whichever way. A party walking alongside its leader (a child at a
// parent's side) is offset to one side of the line as drawn out — the same
// side both ways — and, stood at a corner, eased from one line's side to
// the next over the pause, so it steps across and never jumps.

/** A route: its stops in order (at least two), the pace, m/s, the pause at
 * every stop, s, and how far to the right of the line (as drawn out) this
 * person walks, m. */
export type Route = {
  readonly points: readonly { readonly x: number; readonly z: number }[];
  /** Each line's length, m: `lengths[k]` from stop k to k + 1. */
  readonly lengths: readonly number[];
  readonly speed: number;
  readonly pause: number;
  readonly side: number;
  /** Out and back, s. */
  readonly cycle: number;
  /** Out through the stops, m (back is the same). */
  readonly length: number;
};

/** Where a route has him at a moment — refilled by `routeAt`. `stop` is
 * the stop he stands at (−1 while moving); `paused` how long he has stood
 * there, s; `out` whether he is on the way out. */
export type RouteAt = {
  x: number;
  z: number;
  heading: number;
  moving: boolean;
  paused: number;
  stop: number;
  out: boolean;
  /** The line he is on or last walked, as drawn out, and how far along it, m. */
  line: number;
  along: number;
  walked: number;
};

export function freshRouteAt(): RouteAt {
  return {
    x: 0,
    z: 0,
    heading: 0,
    moving: false,
    paused: 0,
    stop: 0,
    out: true,
    line: 0,
    along: 0,
    walked: 0,
  };
}

/** A route through `points` at `speed`, pausing `pause` s at every stop,
 * `side` m to the right of its lines. */
export function routeOf(
  points: readonly { x: number; z: number }[],
  speed: number,
  pause: number,
  side = 0,
): Route {
  const lengths: number[] = [];
  for (let k = 0; k + 1 < points.length; k++) {
    lengths.push(Math.hypot(points[k + 1].x - points[k].x, points[k + 1].z - points[k].z));
  }
  const length = lengths.reduce((a, b) => a + b, 0);
  const legs = lengths.length;
  return {
    points: points.map((p) => ({ x: p.x, z: p.z })),
    lengths,
    speed,
    pause,
    side,
    cycle: 2 * (length / speed + legs * pause),
    length,
  };
}

/** The same route walked `side` m to the right. */
export const routeAside = (r: Route, side: number): Route => ({ ...r, side });

/** The unit right of line `k` as drawn out: (dz, −dx). */
function rightOf(r: Route, k: number): { x: number; z: number } {
  const a = r.points[k];
  const b = r.points[k + 1];
  const n = r.lengths[k] || 1;
  return { x: (b.z - a.z) / n, z: -(b.x - a.x) / n };
}

/** Line `k`'s heading as drawn out. */
function headingOf(r: Route, k: number): number {
  const a = r.points[k];
  const b = r.points[k + 1];
  return Math.atan2(b.x - a.x, b.z - a.z);
}

const ease = (u: number): number => {
  const c = Math.max(0, Math.min(1, u));
  return c * c * (3 - 2 * c);
};

/**
 * WHERE ROUTE `r` HAS HIM `u` s into it (wrapped round its cycle), written
 * into `out`. The cycle: line 0 out, a pause at stop 1, … line n−1 out, a
 * pause at the last stop, then line n−1 back, a pause at stop n−1, … line 0
 * back and a pause at the first stop.
 */
export function routeAt(r: Route, u: number, out: RouteAt = freshRouteAt()): RouteAt {
  const legs = r.lengths.length;
  const n = Math.floor(u / r.cycle);
  let w = u - n * r.cycle;
  let walked = n * 2 * r.length;
  // Out, then back: each a line and the pause at its end.
  for (let half = 0; half < 2; half++) {
    const back = half === 1;
    for (let j = 0; j < legs; j++) {
      const k = back ? legs - 1 - j : j;
      const len = r.lengths[k];
      const walk = len / r.speed;
      if (w < walk) {
        const s = w * r.speed;
        const along = back ? len - s : s;
        place(r, k, along, out);
        out.heading = headingOf(r, k) + (back ? Math.PI : 0);
        out.moving = true;
        out.paused = 0;
        out.stop = -1;
        out.out = !back;
        out.walked = walked + s;
        return out;
      }
      w -= walk;
      walked += len;
      if (w < r.pause) {
        // Stood at the stop the line ended at, eased to the next line's
        // side over the pause.
        const stop = back ? k : k + 1;
        const next = back ? k - 1 : k + 1;
        place(r, k, back ? 0 : len, out);
        if (next >= 0 && next < legs && r.side !== 0) {
          const f = ease(w / r.pause);
          const a = rightOf(r, k);
          const b = rightOf(r, next);
          const p = r.points[stop];
          out.x = p.x + r.side * (a.x + (b.x - a.x) * f);
          out.z = p.z + r.side * (a.z + (b.z - a.z) * f);
        }
        out.heading = headingOf(r, k) + (back ? Math.PI : 0);
        out.moving = false;
        out.paused = w;
        out.stop = stop;
        out.out = !back;
        out.walked = walked;
        return out;
      }
      w -= r.pause;
    }
  }
  // Round the end of the cycle to its first stop.
  place(r, 0, 0, out);
  out.heading = headingOf(r, 0) + Math.PI;
  out.moving = false;
  out.paused = r.pause;
  out.stop = 0;
  out.out = false;
  out.walked = walked;
  return out;
}

/** On line `k`, `along` m from its start, `r.side` to its right. */
function place(r: Route, k: number, along: number, out: RouteAt): void {
  const a = r.points[k];
  const b = r.points[k + 1];
  const f = r.lengths[k] > 0 ? along / r.lengths[k] : 0;
  const right = rightOf(r, k);
  out.x = a.x + (b.x - a.x) * f + right.x * r.side;
  out.z = a.z + (b.z - a.z) * f + right.z * r.side;
  out.line = k;
  out.along = along;
}
