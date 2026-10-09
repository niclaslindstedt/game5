// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S SIDEWALKS AS A WALKER WALKS THEM — the network a person
// out with his dog (`dog-walk.ts`) goes round: every sidewalk of the
// village (`villageOf`'s `walks`) as a line of nodes four metres apart,
// joined at the corners where two sidewalks meet, and ACROSS the streets
// only at their CROSSINGS (a crossing's two ends, past the carriageway and
// the windrow, each joined to the nearest sidewalk); and the DOORS of the
// village's houses, each joined to the nearest sidewalk — where a walk
// begins and ends. Every link but a crossing is held off the carriageways
// (`onCarriageway`) and out of the buildings along its whole length. And
// the ROUTE a walk takes over it: out from a door, wandering round the
// network a dealt length (never straight back the way it came where there
// is another way), then home by the shortest way.
//
// Three-free and DOM-free: the suite reads it. Pure functions of the map.

import {
  besidePoint,
  buildingDoor,
  CABINS,
  onCarriageway,
  onStreet,
  streetAt,
  villageBuildingsOf,
  villageOf,
  type Level,
  type Rng,
  type StreetPoint,
} from "@engine";

import { KERB, roadY } from "./street-plan.ts";
import { wildGround } from "./wild-ground.ts";

/** A node: where it is, the way to the road from it (a unit vector in the
 * plane — the sidewalk's kerb side; zero off a sidewalk), the sidewalk's
 * half width there (0 off one) and which sidewalk it lies on (−1 for a
 * crossing's end or a door). */
export type NetNode = {
  x: number;
  z: number;
  kx: number;
  kz: number;
  half: number;
  walk: number;
};

/** A link between two nodes: its length and, across a street, the
 * crossing it is. */
export type NetEdge = { a: number; b: number; len: number; crossing: string | null };

/** A house's door on the network: its node, and the building's heading. */
export type NetDoor = { node: number; x: number; z: number; heading: number };

export type WalkNet = {
  nodes: NetNode[];
  edges: NetEdge[];
  /** Each node's edges, by index into `edges`. */
  adj: number[][];
  doors: NetDoor[];
};

/** How far a corner may reach straight between two sidewalks' ends, and
 * round it (the ends' gap, and each one's way on to the turn), a
 * crossing's end from its sidewalk, and a door from the nearest sidewalk,
 * m; how far a sidewalk is carried straight on past a gap in it; and the
 * step a link is checked clear at. */
const REACH = {
  corner: 11,
  along: 45,
  round: 45,
  elbow: 15,
  crossing: 12,
  door: 20,
  check: 0.4,
} as const;

/** WHERE A FOOT STANDS at (x, z): on a carriageway the road's drawn
 * surface (a crossing's), on the rest of a street (its sidewalk) a kerb
 * over it, and elsewhere the drawn snow. */
export function footY(level: Level, x: number, z: number): number {
  if (onCarriageway(level, x, z)) return roadY(level, x, z);
  if (onStreet(level, x, z)) return roadY(level, x, z) + KERB;
  return wildGround(level).snowY(x, z);
}

/** Whether (x, z) is inside the walls of one of `houses` (save `skip`). */
export function inHouse(
  houses: ReturnType<typeof villageBuildingsOf>,
  x: number,
  z: number,
  skip = -1,
) {
  for (let i = 0; i < houses.length; i++) {
    if (i === skip) continue;
    const c = houses[i];
    const d = CABINS[c.kind];
    const dx = x - c.x;
    const dz = z - c.z;
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const lz = dx * fx + dz * fz;
    const lx = dx * fz - dz * fx;
    if (Math.abs(lx) < d.width / 2 + 0.3 && Math.abs(lz) < d.depth / 2 + 0.3) return true;
  }
  return false;
}

/** Whether the line a–b keeps off every carriageway and out of every
 * house (save `skip`) and every trunk. */
function lineClear(
  level: Level,
  houses: ReturnType<typeof villageBuildingsOf>,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  skip = -1,
): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / REACH.check));
  const ground = wildGround(level);
  for (let i = 0; i <= n; i++) {
    const x = ax + ((bx - ax) * i) / n;
    const z = az + ((bz - az) * i) / n;
    if (onCarriageway(level, x, z) || inHouse(houses, x, z, skip)) return false;
    if (ground.nearestTree(x, z, 0.5)) return false;
  }
  return true;
}

const nets = new WeakMap<Level, WalkNet | null>();

/** THE SIDEWALK NETWORK of `level`'s village, or null where it has none. */
export function walkNetOf(level: Level): WalkNet | null {
  const had = nets.get(level);
  if (had !== undefined) return had;
  const net = buildNet(level);
  nets.set(level, net);
  return net;
}

function buildNet(level: Level): WalkNet | null {
  const v = villageOf(level);
  if (!v || v.walks.length === 0) return null;
  const houses = villageBuildingsOf(level);
  const nodes: NetNode[] = [];
  const edges: NetEdge[] = [];
  const link = (a: number, b: number, crossing: string | null = null): void => {
    const len = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
    edges.push({ a, b, len, crossing });
  };
  /** Each sidewalk's nodes, first to last. */
  const lines: number[][] = [];
  v.walks.forEach((w, wi) => {
    const sign = w.side === 0 ? 1 : -1;
    const line: number[] = [];
    for (const p of w.points) {
      // The kerb side: toward the street's middle (side 0 lies on the
      // map's left, so its road is on the right of the way it runs).
      nodes.push({
        x: p.x,
        z: p.z,
        kx: Math.cos(p.heading) * sign,
        kz: -Math.sin(p.heading) * sign,
        half: w.width / 2,
        walk: wi,
      });
      line.push(nodes.length - 1);
    }
    for (let k = 0; k + 1 < line.length; k++) link(line[k], line[k + 1]);
    lines.push(line);
  });
  const onWalks = nodes.length;
  /** The nearest sidewalk node to (x, z) within `reach` whose line to it
   * is clear. */
  const nearest = (x: number, z: number, reach: number, skip = -1): number => {
    const order = [];
    for (let i = 0; i < onWalks; i++) {
      const d = Math.hypot(nodes[i].x - x, nodes[i].z - z);
      if (d < reach) order.push({ i, d });
    }
    order.sort((a, b) => a.d - b.d);
    for (const { i } of order.slice(0, 6)) {
      if (lineClear(level, houses, x, z, nodes[i].x, nodes[i].z, skip)) return i;
    }
    return -1;
  };
  // THE CORNERS: two sidewalks' ends near each other, clear between —
  // straight across, or round the corner where the two lines carried on
  // past their ends meet (the walker keeps to the kerb's line round it).
  const ends = lines.flatMap((l) => [
    { n: l[0], dx: nodes[l[0]].x - nodes[l[1]].x, dz: nodes[l[0]].z - nodes[l[1]].z },
    {
      n: l[l.length - 1],
      dx: nodes[l[l.length - 1]].x - nodes[l[l.length - 2]].x,
      dz: nodes[l[l.length - 1]].z - nodes[l[l.length - 2]].z,
    },
  ]);
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const ea = ends[i];
      const eb = ends[j];
      const a = nodes[ea.n];
      const b = nodes[eb.n];
      if (a.walk === b.walk) continue;
      const gap = Math.hypot(a.x - b.x, a.z - b.z);
      if (gap > Math.max(REACH.round, REACH.along)) continue;
      // Straight on along one street past a gap in its sidewalk (a short
      // piece of street between two others), or straight round a corner.
      const la0 = Math.hypot(ea.dx, ea.dz) || 1;
      const lb0 = Math.hypot(eb.dx, eb.dz) || 1;
      const onward = (ea.dx * eb.dx + ea.dz * eb.dz) / (la0 * lb0) < -0.95;
      if (
        (gap <= REACH.corner || (onward && gap <= REACH.along)) &&
        lineClear(level, houses, a.x, a.z, b.x, b.z)
      ) {
        link(ea.n, eb.n);
        continue;
      }
      // Where a + u·da meets b + w·db, both carried on OUT of their ends.
      const la = Math.hypot(ea.dx, ea.dz) || 1;
      const lb = Math.hypot(eb.dx, eb.dz) || 1;
      const ax = ea.dx / la;
      const az = ea.dz / la;
      const bx = eb.dx / lb;
      const bz = eb.dz / lb;
      const den = ax * bz - az * bx;
      if (Math.abs(den) < 0.3) continue;
      const u = ((b.x - a.x) * bz - (b.z - a.z) * bx) / den;
      const w = ((b.x - a.x) * az - (b.z - a.z) * ax) / den;
      if (u <= 0 || w <= 0 || u > REACH.elbow || w > REACH.elbow) continue;
      const cx = a.x + ax * u;
      const cz = a.z + az * u;
      if (!lineClear(level, houses, a.x, a.z, cx, cz)) continue;
      if (!lineClear(level, houses, cx, cz, b.x, b.z)) continue;
      nodes.push({ x: cx, z: cz, kx: 0, kz: 0, half: 0, walk: -1 });
      link(ea.n, nodes.length - 1);
      link(nodes.length - 1, eb.n);
    }
  }
  // THE CROSSINGS: each end past the carriageway and the windrow (broken
  // there), joined to its nearest sidewalk.
  const at: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  for (const c of v.crossings) {
    const st = v.streets.find((s) => s.id === c.street);
    if (!st) continue;
    streetAt(st, c.s, at);
    const S = st.section;
    const ids: number[] = [];
    for (const side of [0, 1] as const) {
      const sd = S.sides[side];
      const lat = (side === 0 ? -1 : 1) * (S.lane + sd.park + sd.bank + 0.45);
      const p = besidePoint(at, lat);
      if (onCarriageway(level, p.x, p.z)) break;
      const near = nearest(p.x, p.z, REACH.crossing);
      if (near < 0) break;
      nodes.push({ x: p.x, z: p.z, kx: 0, kz: 0, half: 0, walk: -1 });
      ids.push(nodes.length - 1);
      link(nodes.length - 1, near);
    }
    if (ids.length === 2) link(ids[0], ids[1], c.id);
  }
  // THE DOORS: each house's, joined to its nearest sidewalk.
  const doors: NetDoor[] = [];
  houses.forEach((h, hi) => {
    const d = buildingDoor(h);
    const near = nearest(d.x, d.z, REACH.door, hi);
    if (near < 0) return;
    nodes.push({ x: d.x, z: d.z, kx: 0, kz: 0, half: 0, walk: -1 });
    link(nodes.length - 1, near);
    doors.push({ node: nodes.length - 1, x: d.x, z: d.z, heading: d.heading });
  });
  const adj: number[][] = nodes.map(() => []);
  edges.forEach((e, k) => {
    adj[e.a].push(k);
    adj[e.b].push(k);
  });
  return { nodes, edges, adj, doors };
}

/** The other end of edge `k` from node `n`. */
const across = (net: WalkNet, k: number, n: number): number =>
  net.edges[k].a === n ? net.edges[k].b : net.edges[k].a;

/** The shortest way from node `from` to node `to`, as nodes (Dijkstra). */
export function shortestWay(net: WalkNet, from: number, to: number): number[] | null {
  const n = net.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from] = 0;
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u < 0) return null;
    if (u === to) break;
    done[u] = 1;
    for (const k of net.adj[u]) {
      const w = across(net, k, u);
      const d = dist[u] + net.edges[k].len;
      if (d < dist[w]) {
        dist[w] = d;
        prev[w] = u;
      }
    }
  }
  const way = [to];
  while (way[way.length - 1] !== from) way.push(prev[way[way.length - 1]]);
  return way.reverse();
}

/** A WALK'S ROUTE, as nodes: from `door` out onto the sidewalks, round
 * them about `length` m — on at every branch, never straight back the way
 * it came where there is another way, the less-walked links first — then
 * home to the door the shortest way. */
export function wanderFrom(net: WalkNet, door: NetDoor, length: number, rng: Rng): number[] {
  const path = [door.node];
  const used = new Map<number, number>();
  let walked = 0;
  let here = door.node;
  let came = -1;
  for (let guard = 0; guard < 2000 && walked < length; guard++) {
    const out = net.adj[here].filter((k) => k !== came && across(net, k, here) !== door.node);
    const choices = out.length > 0 ? out : net.adj[here];
    // The least walked of the ways on, one of them dealt.
    const least = Math.min(...choices.map((k) => used.get(k) ?? 0));
    const fresh = choices.filter((k) => (used.get(k) ?? 0) === least);
    const k = fresh.length === 1 ? fresh[0] : rng.pick(fresh);
    used.set(k, (used.get(k) ?? 0) + 1);
    walked += net.edges[k].len;
    came = k;
    here = across(net, k, here);
    path.push(here);
  }
  const home = shortestWay(net, here, door.node) ?? [here, door.node];
  return path.concat(home.slice(1));
}
