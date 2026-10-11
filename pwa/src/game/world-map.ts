// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD MAP AS GEOMETRY — the free ride's WHERE steps (`menu-where.tsx`)
// draw a world that pans and zooms onto the range picked, with a marker on
// every ski area; everything that is decided about that picture is decided
// here, DOM-free, so the suite reads it: how a line is decoded, where a
// point of the globe lands on the screen, where the camera stands for a
// range or an area, how it flies from one to the next, how markers that
// would sit on one another are pushed apart, where each label goes, and
// how long the scale bar is.
//
// THE PROJECTION IS MERCATOR, laid on a plane WORLD units wide. Every ski
// area lies between 36° and 69° north, where Mercator is the map a reader
// expects and keeps a place's shape; the camera is then a middle (in world
// units) and a SCALE (screen pixels a world unit), so panning and zooming
// are a transform of one path built once — never the coastline projected
// again on every frame.

/** The plane's width, world units: the globe's 360° of longitude. */
export const WORLD = 1000;
/** The earth's circumference at the equator, km. */
const EARTH_KM = 40_075;
const DEG = Math.PI / 180;

/** A point of the globe, °. */
export type LatLon = { lat: number; lon: number };
/** A point on the plane (world units) or the screen (px). */
export type XY = { x: number; y: number };
/** The view's size, px. */
export type View = { w: number; h: number };
/** Where the camera stands: its middle (world units) and its scale (px a
 * world unit). */
export type Camera = { x: number; y: number; scale: number };

/** A point of the globe on the plane. */
export function project(p: LatLon): XY {
  const lat = Math.max(-85, Math.min(85, p.lat));
  return {
    x: ((p.lon + 180) / 360) * WORLD,
    y: WORLD / 2 - (WORLD / (2 * Math.PI)) * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2)),
  };
}

/** A point of the plane back on the globe. */
export function unproject(p: XY): LatLon {
  const lat =
    (2 * Math.atan(Math.exp(((WORLD / 2 - p.y) * 2 * Math.PI) / WORLD)) - Math.PI / 2) / DEG;
  return { lat, lon: (p.x / WORLD) * 360 - 180 };
}

/** How many km a world unit is at the plane's `y`. */
export function kmPerUnit(y: number): number {
  return (EARTH_KM / WORLD) * Math.cos(unproject({ x: 0, y }).lat * DEG);
}

/** A point of the plane on the screen under `cam`. */
export function toScreen(cam: Camera, view: View, p: XY): XY {
  return { x: view.w / 2 + (p.x - cam.x) * cam.scale, y: view.h / 2 + (p.y - cam.y) * cam.scale };
}

/** A point of the screen back on the plane. */
export function toPlane(cam: Camera, view: View, p: XY): XY {
  return { x: cam.x + (p.x - view.w / 2) / cam.scale, y: cam.y + (p.y - view.h / 2) / cam.scale };
}

/** The SVG transform that lays the plane on the screen under `cam`. */
export function transformOf(cam: Camera, view: View): string {
  const f = (v: number): string => String(Math.round(v * 1000) / 1000);
  return `matrix(${f(cam.scale)} 0 0 ${f(cam.scale)} ${f(view.w / 2 - cam.x * cam.scale)} ${f(view.h / 2 - cam.y * cam.scale)})`;
}

// ── THE LINES ─────────────────────────────────────────────────────────────

/** A layer of the generated module decoded: each line its points as
 * `[lon, lat, lon, lat, …]`, °. */
export function decodeLines(text: string, precision: number): number[][] {
  const out: number[][] = [];
  for (const line of text.split(" ")) {
    if (line === "") continue;
    const pts: number[] = [];
    let i = 0;
    let lat = 0;
    let lon = 0;
    const next = (): number => {
      let shift = 0;
      let z = 0;
      let b: number;
      do {
        b = line.charCodeAt(i++) - 63;
        z |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      return z & 1 ? ~(z >> 1) : z >> 1;
    };
    while (i < line.length) {
      lat += next();
      lon += next();
      pts.push(lon / precision, lat / precision);
    }
    out.push(pts);
  }
  return out;
}

/** Lines as one SVG path on the plane (`closed` rings shut with `Z`), its
 * figures to a hundredth of a unit. */
export function pathOf(lines: readonly number[][], closed: boolean): string {
  const r = (v: number): number => Math.round(v * 100) / 100;
  let d = "";
  for (const pts of lines) {
    for (let i = 0; i < pts.length; i += 2) {
      const p = project({ lon: pts[i], lat: pts[i + 1] });
      d += `${i === 0 ? "M" : "L"}${r(p.x)} ${r(p.y)}`;
    }
    if (closed) d += "Z";
  }
  return d;
}

// ── THE CAMERA ────────────────────────────────────────────────────────────

/** The camera's reach: from the whole populated world to a view about
 * this many km across at its narrower side. */
export const CLOSEST_KM = 12;
/** The latitudes the whole-world view frames, °. */
const WORLD_FRAME = { north: 72, south: -48 } as const;

/** The most a camera at plane `y` may zoom in on `view`. */
export function maxScale(view: View, y: number): number {
  return Math.min(view.w, view.h) / (CLOSEST_KM / kmPerUnit(y));
}

/** The least: the whole populated world in the view. */
export function minScale(view: View): number {
  const n = project({ lat: WORLD_FRAME.north, lon: 0 }).y;
  const s = project({ lat: WORLD_FRAME.south, lon: 0 }).y;
  return Math.min(view.w / WORLD, view.h / (s - n));
}

/** A camera held inside its reach, its middle kept over the plane. */
export function clampCamera(cam: Camera, view: View): Camera {
  const scale = Math.max(minScale(view), Math.min(maxScale(view, cam.y), cam.scale));
  const n = project({ lat: WORLD_FRAME.north + 8, lon: 0 }).y;
  const s = project({ lat: WORLD_FRAME.south - 8, lon: 0 }).y;
  return {
    scale,
    x: Math.max(0, Math.min(WORLD, cam.x)),
    y: Math.max(n, Math.min(s, cam.y)),
  };
}

/** The camera that shows the whole populated world. */
export function worldCamera(view: View): Camera {
  const n = project({ lat: WORLD_FRAME.north, lon: 0 }).y;
  const s = project({ lat: WORLD_FRAME.south, lon: 0 }).y;
  return { x: WORLD / 2, y: (n + s) / 2, scale: minScale(view) };
}

/** The camera that frames every point of `pts` with `pad` px to spare,
 * and shows at least `leastKm` across its narrower side. */
export function fitCamera(
  pts: readonly LatLon[],
  view: View,
  pad: number,
  leastKm: number,
): Camera {
  if (pts.length === 0) return worldCamera(view);
  const xy = pts.map(project);
  const x0 = Math.min(...xy.map((p) => p.x));
  const x1 = Math.max(...xy.map((p) => p.x));
  const y0 = Math.min(...xy.map((p) => p.y));
  const y1 = Math.max(...xy.map((p) => p.y));
  const y = (y0 + y1) / 2;
  const w = Math.max(1, view.w - 2 * pad);
  const h = Math.max(1, view.h - 2 * pad);
  const most = Math.min(view.w, view.h) / (leastKm / kmPerUnit(y));
  const scale = Math.min(most, w / Math.max(1e-9, x1 - x0), h / Math.max(1e-9, y1 - y0));
  return clampCamera({ x: (x0 + x1) / 2, y, scale }, view);
}

/** How long a flight between two cameras takes, ms. */
export const FLIGHT_MS = 900;

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** THE FLIGHT from `a` to `b` at `t` (0..1): the middle eased across and
 * the scale eased in its logarithm — and when the two are far apart for
 * the zoom they are at, BOWED OUT through a view that holds both, so a
 * jump from one continent to another rises over the world and comes down again
 * rather than sliding across it at a valley's scale. */
export function flyAt(a: Camera, b: Camera, view: View, t: number): Camera {
  const e = ease(Math.max(0, Math.min(1, t)));
  const far = Math.hypot(b.x - a.x, b.y - a.y);
  const both = Math.min(view.w, view.h) / Math.max(1e-9, far * 1.2);
  const low = Math.min(a.scale, b.scale);
  const bow = both < low ? Math.log(low / both) : 0;
  const scale = Math.exp(
    Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * e - bow * Math.sin(Math.PI * e),
  );
  // The middle moves by the share of the way the SCREEN has travelled, so
  // the zoomed-in ends of the flight do not race.
  const w = bow > 0 ? (1 - Math.cos(Math.PI * e)) / 2 : e;
  return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, scale };
}

/** The camera zoomed by `k` about the screen point `at`, which stays put. */
export function zoomAbout(cam: Camera, view: View, at: XY, k: number): Camera {
  const p = toPlane(cam, view, at);
  const scale = cam.scale * k;
  return clampCamera(
    { scale, x: p.x - (at.x - view.w / 2) / scale, y: p.y - (at.y - view.h / 2) / scale },
    view,
  );
}

/** The camera panned by `dx`, `dy` screen px. */
export function panBy(cam: Camera, view: View, dx: number, dy: number): Camera {
  return clampCamera({ ...cam, x: cam.x - dx / cam.scale, y: cam.y - dy / cam.scale }, view);
}

// ── THE MARKERS ───────────────────────────────────────────────────────────

/** Markers closer than this on the screen are pushed apart, px. */
export const MARK_GAP = 18;

/** THE DECLUTTER: screen points nudged apart until none is closer than
 * `gap` to another (a few rounds of pairwise pushes, each pair shared
 * evenly; points on one spot fanned out by their index), so two ski areas
 * a few km apart read as two at any zoom. The marker is drawn where it
 * lands, and a thin leader back to its true place when it moved. */
export function declutter(pts: readonly XY[], gap = MARK_GAP): XY[] {
  const out = pts.map((p) => ({ ...p }));
  for (let round = 0; round < 24; round++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        let dx = out[j].x - out[i].x;
        let dy = out[j].y - out[i].y;
        let d = Math.hypot(dx, dy);
        if (d >= gap - 1e-6) continue;
        if (d < 1e-6) {
          const a = ((j - i) * 2.39996) % (2 * Math.PI);
          [dx, dy, d] = [Math.cos(a), Math.sin(a), 1];
        }
        const push = (gap - d) / 2 + 0.01;
        out[i].x -= (dx / d) * push;
        out[i].y -= (dy / d) * push;
        out[j].x += (dx / d) * push;
        out[j].y += (dy / d) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}

/** A marker as drawn: one ski area (`members` of one), or a CLUSTER of
 * several standing too close together to read at this zoom. */
export type Drawn = { members: number[]; x: number; y: number };

/** Chains of up to this many markers are pushed apart; a longer chain is
 * drawn as one cluster. */
export const MOST_SPREAD = 6;

/** THE MARKERS AT A ZOOM: screen points chained wherever two are closer
 * than `gap`; a chain of at most `most` is pushed apart (`declutter`), each
 * marker its own, and a longer one is drawn as ONE CLUSTER at its middle —
 * a tap on it flies in until it comes apart. So the world's whole view
 * reads as a few counted bubbles, and a range's own as every ski area.
 * A marker `single` marks (the picked range's, which its camera framed)
 * is never gathered: it is always pushed apart on its own. */
export function groupMarks(
  pts: readonly XY[],
  gap = MARK_GAP,
  most = MOST_SPREAD,
  single: readonly boolean[] = [],
): Drawn[] {
  const root = pts.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  for (let i = 0; i < pts.length; i++) {
    if (single[i]) continue;
    for (let j = i + 1; j < pts.length; j++) {
      if (single[j]) continue;
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < gap) root[find(j)] = find(i);
    }
  }
  const chains = new Map<number, number[]>();
  pts.forEach((_, i) => chains.set(find(i), [...(chains.get(find(i)) ?? []), i]));
  const out: Drawn[] = [];
  for (const members of chains.values()) {
    if (members.length <= most) {
      for (const i of members) out.push({ members: [i], x: pts[i].x, y: pts[i].y });
    } else {
      const x = members.reduce((s, i) => s + pts[i].x, 0) / members.length;
      const y = members.reduce((s, i) => s + pts[i].y, 0) / members.length;
      out.push({ members, x, y });
    }
  }
  const moved = declutter(out, gap);
  return out.map((d, k) => ({ ...d, ...moved[k] }));
}

/** Where a label stands beside its marker. */
export type LabelSide = "right" | "left" | "above" | "below";
/** A label placed: its side and its box on the screen. */
export type Placed = { side: LabelSide; x: number; y: number; w: number; h: number } | null;

/** A label's box on `side` of a marker at `p`. */
function boxOf(p: XY, side: LabelSide, w: number, h: number, off: number) {
  switch (side) {
    case "right":
      return { x: p.x + off, y: p.y - h / 2, w, h };
    case "left":
      return { x: p.x - off - w, y: p.y - h / 2, w, h };
    case "above":
      return { x: p.x - w / 2, y: p.y - off - h, w, h };
    default:
      return { x: p.x - w / 2, y: p.y + off, w, h };
  }
}

const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** THE LABELS, placed greedily in `order` (the picked one first): each on
 * the first side that stays inside the view and clear of every marker and
 * every label already placed, or left off (null) where none is — the
 * marker still reads, and its name comes up when it is zoomed to. The
 * FIRST in `order` (the one picked) is never left off: with no clear side
 * it takes the first that stays inside the view, and the rest keep clear
 * of it. `sizes` are each label's box, px. */
export function placeLabels(
  marks: readonly XY[],
  sizes: readonly { w: number; h: number }[],
  order: readonly number[],
  view: View,
  radius = 6,
): Placed[] {
  const out: Placed[] = marks.map(() => null);
  const taken = marks.map((p) => ({
    x: p.x - radius,
    y: p.y - radius,
    w: 2 * radius,
    h: 2 * radius,
  }));
  const sides: LabelSide[] = ["right", "left", "above", "below"];
  for (const i of order) {
    const { w, h } = sizes[i];
    for (const side of sides) {
      const box = boxOf(marks[i], side, w, h, radius + 3);
      const inside = box.x >= 2 && box.y >= 2 && box.x + w <= view.w - 2 && box.y + h <= view.h - 2;
      const clear = taken.every((t, k) => k === i || !overlaps(box, t));
      if (inside && clear) {
        out[i] = { side, ...box };
        taken.push(box);
        break;
      }
    }
    if (out[i] === null && i === order[0]) {
      for (const side of sides) {
        const box = boxOf(marks[i], side, w, h, radius + 3);
        if (box.x >= 2 && box.y >= 2 && box.x + w <= view.w - 2 && box.y + h <= view.h - 2) {
          out[i] = { side, ...box };
          taken.push(box);
          break;
        }
      }
    }
  }
  return out;
}

/** THE SCALE BAR under `cam`: the roundest length (1, 2 or 5 a power of
 * ten, km) that is at most `most` px long, and its length in px. */
export function scaleBar(cam: Camera, most: number): { km: number; px: number } {
  const kmPx = kmPerUnit(cam.y) / cam.scale;
  const raw = most * kmPx;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const km = [5, 2, 1].map((m) => m * pow).find((v) => v <= raw) ?? pow;
  return { km, px: km / kmPx };
}
