// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD MAP AS DRAWN — the free ride's WHERE steps' map (`menu-where.tsx`):
// the land, the lakes and the borders as one SVG laid on the screen by a
// transform, the markers over it in screen pixels, and the hands on it.
// Everything decided about it is `world-map.ts`'s (the projection, the
// camera, the flight, the declutter, the labels, the scale bar); this file
// draws that and turns a press into a camera.
//
// THE OUTLINE IS ITS OWN SMALL DOWNLOAD (`world-map-data.ts`, generated),
// fetched the first time a WHERE step is opened and decoded into three
// paths once; no face's mountain is touched until one is picked and the
// start card's chart raises it.
//
// THE HANDS: a drag pans, a pinch or the wheel zooms about where it is
// pressed, + and − zoom on the middle, and a TAP picks the marker within a
// thumb's reach of it — the hit test is ours, on the markers as drawn, so a
// marker pushed off its place is picked where it is seen. Whatever the
// hands did, a new target (a range or an area picked, on the map or on the
// rows) flies the camera to it.
//
// A PINCH MUST NEVER REPAINT THE WORLD. The outline is tens of thousands
// of points, and a phone that re-tessellates it at every finger's move (two
// fingers, 120 Hz each) falls seconds behind the hands. So the hands only
// move a camera, read once a frame (`steer`), and the outline is its own
// layer: painted at a BASE camera onto a sheet overscanned past the view
// (`SHEET_OVER`), and carried to the live camera by a CSS transform the
// compositor applies without painting (`sheetMove`). It is painted again
// only when that sheet would no longer cover the view or would be blown up
// past `SHEET_SHARP`, and once the camera has rested for `SETTLE` ms.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import { holdBackdrop } from "./backdrop-hold.ts";
import { STRINGS } from "./strings.ts";
import { tappedMark } from "./where-steps.ts";
import {
  type Camera,
  clampCamera,
  CLOSEST_KM,
  decodeLines,
  fitCamera,
  FLIGHT_MS,
  flyAt,
  groupMarks,
  kmPerUnit,
  panBy,
  pathOf,
  placeLabels,
  project,
  scaleBar,
  SHEET_OVER,
  sheetMove,
  toScreen,
  transformOf,
  type View,
  zoomAbout,
} from "./world-map.ts";

/** The three layers as paths on the plane. */
type Lines = { land: string; lakes: string; borders: string };

let loading: Promise<Lines> | null = null;
/** The outline, fetched and decoded once a visit. */
function loadLines(): Promise<Lines> {
  loading ??= import("./world-map-data.ts").then((m) => ({
    land: pathOf(decodeLines(m.WORLD_LAND, m.WORLD_PRECISION), true),
    lakes: pathOf(decodeLines(m.WORLD_LAKES, m.WORLD_PRECISION), true),
    borders: pathOf(decodeLines(m.WORLD_BORDERS, m.WORLD_PRECISION), false),
  }));
  return loading;
}

/** One marker as the map is handed it. */
export type MapMark = {
  key: string;
  lat: number;
  lon: number;
  label: string;
  /** What a cluster of markers all sharing it is called (their range). */
  group?: string;
  /** Drawn quieter: another range's area. */
  dim?: boolean;
};

/** A tap is a press that moved less than this, px. */
const TAP = 8;
/** A tap picks the marker within this, px — a thumb's reach. */
const REACH = 26;
/** The camera resting this long repaints the sheet sharp, ms. */
const SETTLE = 140;

/** A label's type, px, and roughly how wide a capital is in it. */
const LABEL = { size: 11, char: 7.4, pad: 10, h: 18 };

export function WorldMapView({
  marks,
  selected,
  target,
  targetKey,
  haloKm,
  onPick,
}: {
  marks: readonly MapMark[];
  selected: string | null;
  /** Where the camera should stand in a view of a size. */
  target: (view: View) => Camera;
  /** A new key is a new target, and a flight to it. */
  targetKey: string;
  /** A soft ring this wide round each marker (km): ROUGHLY here. */
  haloKm?: number;
  onPick: (key: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View | null>(null);
  const [cam, setCam] = useState<Camera | null>(null);
  /** The camera the hands last asked for — ahead of `cam` until the next
   * frame draws it. */
  const camRef = useRef<Camera | null>(null);
  const flight = useRef(0);
  const frame = useRef(0);
  /** Where the outline's sheet was last painted. */
  const [base, setBase] = useState<Camera | null>(null);
  const baseRef = useRef(base);
  baseRef.current = base;
  /** The fingers on the map, where each last was. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  /** Whether this map is holding the title scene behind it still. */
  const holding = useRef(false);
  const hold = (on: boolean): void => {
    if (holding.current === on) return;
    holding.current = on;
    holdBackdrop(on);
  };
  const holdRef = useRef(hold);

  /** Stand the camera at `c` now. */
  const showNow = (c: Camera): void => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    camRef.current = c;
    hold(true);
    setCam(c);
  };
  /** Stand the camera at `c` on the next frame: however many moves the
   * hands make before it, the map is drawn once. */
  const steer = (c: Camera): void => {
    camRef.current = c;
    hold(true);
    frame.current ||= requestAnimationFrame(() => {
      frame.current = 0;
      setCam(camRef.current);
    });
  };
  const steerRef = useRef(steer);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      holdRef.current(false);
    },
    [],
  );

  // The outline repainted where the sheet no longer serves, and once the
  // camera rests.
  useEffect(() => {
    if (!cam || !view) return;
    if (!base || !sheetMove(base, cam, view)) {
      setBase(cam);
      return;
    }
    if (base === cam) {
      // At rest and painted sharp: the backdrop behind may move again.
      if (pointers.current.size === 0) holdRef.current(false);
      return;
    }
    const rest = setTimeout(() => setBase(cam), SETTLE);
    return () => clearTimeout(rest);
  }, [cam, view, base]);
  const [lines, setLines] = useState<Lines | null>(null);

  useEffect(() => {
    let live = true;
    void loadLines().then((l) => live && setLines(l));
    return () => {
      live = false;
    };
  }, []);

  // The view's size, read before the first paint and on every resize.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const read = (): void => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setView((v) =>
          v && Math.abs(v.w - r.width) < 0.5 && Math.abs(v.h - r.height) < 0.5
            ? v
            : { w: r.width, h: r.height },
        );
      }
    };
    read();
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  /** Fly the camera to `to` (or stand it there, the first time). */
  const flyTo = (to: Camera, at: View): void => {
    const from = camRef.current;
    cancelAnimationFrame(flight.current);
    if (!from || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      showNow(to);
      return;
    }
    const begun = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - begun) / FLIGHT_MS);
      showNow(flyAt(from, to, at, t));
      if (t < 1) flight.current = requestAnimationFrame(tick);
    };
    flight.current = requestAnimationFrame(tick);
  };

  // A new target or a new size: fly there.
  const targetRef = useRef(target);
  targetRef.current = target;
  const flyRef = useRef(flyTo);
  flyRef.current = flyTo;
  useEffect(() => {
    if (!view) return;
    flyRef.current(targetRef.current(view), view);
    return () => cancelAnimationFrame(flight.current);
  }, [targetKey, view]);

  // + and − zoom on the middle, from the keyboard.
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      const k = e.key === "+" || e.key === "=" ? 1.6 : e.key === "-" || e.key === "_" ? 1 / 1.6 : 0;
      const c = camRef.current;
      if (!k || !c || !view) return;
      cancelAnimationFrame(flight.current);
      steerRef.current(zoomAbout(c, view, { x: view.w / 2, y: view.h / 2 }, k));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [view]);

  // The markers on the screen — pushed apart, or gathered into a cluster
  // where too many stand together — and their labels placed.
  const drawn = useMemo(() => {
    if (!cam || !view) return [];
    const at = marks.map((m) => toScreen(cam, view, project(m)));
    const groups = groupMarks(
      at,
      undefined,
      undefined,
      marks.map((m) => !m.dim),
    );
    const items = groups.map((g) => {
      const ms = g.members.map((i) => marks[i]);
      const one = ms.length === 1;
      const shared = ms.every((m) => m.group === ms[0].group) ? ms[0].group : undefined;
      return {
        key: one ? ms[0].key : `c:${ms.map((m) => m.key).join(",")}`,
        members: ms,
        at: { x: g.x, y: g.y },
        true: one ? at[g.members[0]] : { x: g.x, y: g.y },
        text: one ? ms[0].label : (shared ?? ""),
        on: ms.some((m) => m.key === selected),
        dim: ms.every((m) => m.dim),
      };
    });
    const sizes = items.map((d) => ({
      w: d.text.length * LABEL.char + LABEL.pad + (d.members.length > 1 ? 6 : 0),
      h: LABEL.h,
    }));
    const idx = items.map((_, i) => i).filter((i) => items[i].text !== "");
    const order = [
      ...idx.filter((i) => items[i].on),
      ...idx.filter((i) => !items[i].on && !items[i].dim),
      ...idx.filter((i) => !items[i].on && items[i].dim),
    ];
    const labels = placeLabels(
      items.map((d) => d.at),
      sizes,
      order,
      view,
      items.some((d) => d.members.length > 1) ? 11 : 6,
    );
    return items.map((d, i) => ({ ...d, label: labels[i] }));
  }, [cam, view, marks, selected]);

  // THE HANDS.
  const travel = useRef(0);
  const local = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
    const r = host.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: PointerEvent): void => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) travel.current = 0;
    cancelAnimationFrame(flight.current);
  };
  const move = (e: PointerEvent): void => {
    const was = pointers.current.get(e.pointerId);
    const c = camRef.current;
    if (!was || !c || !view) return;
    const now = local(e);
    if (pointers.current.size === 1) {
      travel.current += Math.hypot(now.x - was.x, now.y - was.y);
      pointers.current.set(e.pointerId, now);
      steer(panBy(c, view, now.x - was.x, now.y - was.y));
      return;
    }
    // Two fingers: the pinch zooms about their middle, which pans with them.
    const [a, b] = [...pointers.current.entries()];
    const other = a[0] === e.pointerId ? b[1] : a[1];
    const before = Math.hypot(was.x - other.x, was.y - other.y);
    const after = Math.hypot(now.x - other.x, now.y - other.y);
    pointers.current.set(e.pointerId, now);
    travel.current += TAP;
    const midBefore = { x: (was.x + other.x) / 2, y: (was.y + other.y) / 2 };
    const midAfter = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
    const zoomed = zoomAbout(c, view, midBefore, before > 1 ? after / before : 1);
    steer(panBy(zoomed, view, midAfter.x - midBefore.x, midAfter.y - midBefore.y));
  };
  const up = (e: PointerEvent): void => {
    const had = pointers.current.get(e.pointerId);
    const single = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0 && baseRef.current === camRef.current) hold(false);
    if (!had || !single || travel.current > TAP) return;
    const i = tappedMark(local(e), drawn, REACH);
    if (i < 0) return;
    const hit = drawn[i];
    if (hit.members.length === 1) return onPick(hit.members[0].key);
    // A cluster tapped flies in until it comes apart.
    flyTo(fitCamera(hit.members, view!, 48, CLOSEST_KM * 3), view!);
  };
  const wheel = (e: WheelEvent): void => {
    const c = camRef.current;
    if (!c || !view) return;
    e.preventDefault();
    cancelAnimationFrame(flight.current);
    steer(zoomAbout(c, view, local(e), Math.exp(-e.deltaY * 0.0016)));
  };

  const bar = cam && view ? scaleBar(clampCamera(cam, view), Math.min(110, view.w / 4)) : null;
  return (
    <div
      ref={host}
      class={`where-map${lines ? "" : " where-map-waiting"}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size === 0 && baseRef.current === camRef.current) hold(false);
      }}
      onWheel={wheel}
    >
      {view && lines && base && (
        <OutlineSheet
          lines={lines}
          base={base}
          view={view}
          move={cam && sheetMove(base, cam, view)}
        />
      )}
      {view && cam && (
        <svg class="where-map-svg" width={view.w} height={view.h} aria-hidden="true">
          {haloKm &&
            drawn.map((d) => (
              <circle
                key={`h${d.key}`}
                class="where-halo"
                cx={d.true.x}
                cy={d.true.y}
                r={(haloKm * cam.scale) / kmPerUnit(cam.y)}
              />
            ))}
          {drawn.map((d) =>
            Math.hypot(d.at.x - d.true.x, d.at.y - d.true.y) > 1 ? (
              <line
                key={`l${d.key}`}
                class="where-leader"
                x1={d.true.x}
                y1={d.true.y}
                x2={d.at.x}
                y2={d.at.y}
              />
            ) : null,
          )}
          {drawn.map(({ key, at: p, label, text, on, dim, members }) => {
            if (p.x < -40 || p.y < -40 || p.x > view.w + 40 || p.y > view.h + 40) return null;
            const many = members.length > 1;
            return (
              <g
                key={key}
                class={`where-mark${on ? " where-mark-on" : ""}${dim ? " where-mark-dim" : ""}${many ? " where-mark-many" : ""}`}
              >
                {on && <circle class="where-mark-ring" cx={p.x} cy={p.y} r={many ? 15 : 11} />}
                <circle class="where-mark-dot" cx={p.x} cy={p.y} r={many ? 10 : on ? 6 : 4.5} />
                {many && (
                  <text class="where-mark-count" x={p.x} y={p.y + 3.8}>
                    {members.length}
                  </text>
                )}
                {label && (
                  <g class="where-label">
                    <rect x={label.x} y={label.y} width={label.w} height={label.h} rx={3} />
                    <text x={label.x + label.w / 2} y={label.y + label.h / 2 + LABEL.size * 0.36}>
                      {text}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          {bar && (
            <g class="where-scale" transform={`translate(10 ${view.h - 12})`}>
              <path d={`M0 -4V0H${bar.px.toFixed(1)}V-4`} />
              <text x={bar.px + 6} y={1}>
                {STRINGS.whereKm(bar.km)}
              </text>
            </g>
          )}
        </svg>
      )}
      {!lines && <p class="where-map-word">{STRINGS.whereLoading}</p>}
    </div>
  );
}

/** The outline painted under `base` on a sheet `SHEET_OVER` past the view's every
 * edge, carried to the live camera by `move`. Its paths only change when
 * `base` does, so a frame that moves the camera paints nothing here. */
function OutlineSheet({
  lines,
  base,
  view,
  move,
}: {
  lines: Lines;
  base: Camera;
  view: View;
  move: string | null;
}) {
  const sheet = useMemo(
    () => ({ w: view.w * (1 + 2 * SHEET_OVER), h: view.h * (1 + 2 * SHEET_OVER) }),
    [view.w, view.h],
  );
  const d = useMemo(() => transformOf(base, sheet), [base, sheet]);
  return (
    <svg
      class="where-map-sheet"
      width={sheet.w}
      height={sheet.h}
      style={{
        left: `${-view.w * SHEET_OVER}px`,
        top: `${-view.h * SHEET_OVER}px`,
        transform: move ?? "none",
      }}
      aria-hidden="true"
    >
      <g transform={d}>
        <path class="where-land" d={lines.land} vector-effect="non-scaling-stroke" />
        <path class="where-lake" d={lines.lakes} vector-effect="non-scaling-stroke" />
        <path class="where-border" d={lines.borders} vector-effect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
