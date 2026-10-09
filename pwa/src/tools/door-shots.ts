// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S DOOR VIEWS (`make world ARGS="--free --views=doors,door-walk"`):
//
//   * `doors` — every kind's door from a skier's eye off its front, the
//     leaf shut, at 30°, at 60° and swung right open (a roller door at a
//     third, two thirds and all the way up): the leaf the kind hangs, the
//     way it swings, the dark of the room behind it.
//   * `door-walk` — the skier's whole move through a door that swings in
//     (he pushes it) and one that swings out (he draws it and steps back),
//     frame by frame off the engine's own step after the machine press:
//     the shuffle to the handle, the hand to the lever, the leaf swinging
//     with his hand on it, the step through, the closer bringing it back —
//     each from behind him (the chase lens) and from beside.
//
// The run is the lab's own (`lab.state`), stepped with the engine's step,
// so the picture is where the engine has him and the leaf.

import {
  DOOR,
  NEUTRAL_INPUT,
  TUNING,
  activeLeaf,
  buildingDoors,
  doorFrame,
  doorPoint,
  moveLength,
  offDoorway,
  placeRun,
  step,
  type BuildingDoor,
  type GameState,
  type Level,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

/** Stood still: the brake held. */
const HOLD = { ...NEUTRAL_INPUT, brake: 1 };

/** The views this module answers for the world lab. */
export const DOOR_VIEWS = ["doors", "door-walk"] as const;

type Lab = {
  level: Level;
  state: GameState;
  still(): void;
  setOverride(p: LensPose | null): void;
  canvas: HTMLCanvasElement;
};

/** A lens `back` m off the door's face on its outside and `side` m to its
 * right as seen from there, at `up` m over the floor, on the doorway. */
function lensAt(door: BuildingDoor, back: number, side: number, up: number, fov = 50): LensPose {
  const f = doorFrame(door);
  const e = doorPoint(f, side, back);
  const t = doorPoint(f, 0, 0);
  return {
    eye: { x: e.x, y: f.y + up, z: e.z },
    target: { x: t.x, y: f.y + Math.min(1.3, door.height * 0.5), z: t.z },
    fov,
    roll: 0,
  };
}

/** A sheet of cells `w` × `h`, drawn into by `cell(row, col)`. */
function sheet(
  lab: Lab,
  rows: string[],
  cols: string[],
  cell: (row: number, col: number) => string | null,
): string {
  // The page is 1280 wide: the cells fit it.
  const w = Math.floor(1280 / cols.length);
  const h = Math.round(w * 0.68);
  const out = document.createElement("canvas");
  out.width = w * cols.length;
  out.height = h * rows.length;
  const g = out.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#0b1116";
  g.fillRect(0, 0, out.width, out.height);
  g.font = "13px monospace";
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      const note = cell(r, c);
      if (note === null) continue;
      lab.still();
      g.drawImage(lab.canvas, c * w, r * h, w, h);
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(c * w, r * h, w, 20);
      g.fillStyle = "#fff";
      g.fillText([rows[r], cols[c], note].filter((x) => x).join(" · "), c * w + 6, r * h + 14);
    }
  }
  lab.setOverride(null);
  lab.canvas.style.display = "none";
  out.id = "sheet";
  document.body.prepend(out);
  document.body.style.overflow = "visible";
  document.documentElement.style.height = "auto";
  document.body.style.height = "auto";
  return `${rows.length} rows`;
}

/** Hold leaf `leaf` of `door` at `share` of its opening on `state` — as a
 * swing let go at that share this very moment. */
function hold(state: GameState, door: BuildingDoor, share: number): void {
  const leaf = activeLeaf(door);
  const swings =
    share > 0 ? [{ id: door.id, leaf, at: state.t - 100, shut: state.t, from: share }] : [];
  state.doorway = { swings, move: null };
}

/** The first door of each kind on the map, in `cabinsOf`'s order. */
function oneOfEach(level: Level): BuildingDoor[] {
  const seen = new Map<string, BuildingDoor>();
  for (const d of buildingDoors(level)) if (!seen.has(d.kind)) seen.set(d.kind, d);
  return [...seen.values()];
}

/** The door views, keyed by name. */
export function doorShots(lab: Lab): Record<string, () => string> {
  return {
    doors: () => {
      const doors = oneOfEach(lab.level);
      if (doors.length === 0) return "no doors on this map";
      const state = lab.state;
      // The skier stood out of the way, far off.
      const shares = [0, 30 / 94.5, 60 / 94.5, 1];
      const cols = ["shut", "30°", "60°", "open"];
      const note = sheet(
        lab,
        doors.map((d) => `${d.kind} ${d.swing}${d.leaves === 2 ? " pair" : ""}`),
        cols,
        (r, c) => {
          const d = doors[r];
          hold(state, d, shares[c]);
          const far = Math.max(4.5, d.width * 1.6, d.height * 1.3);
          lab.setOverride(lensAt(d, far, d.width * 0.35, 1.6));
          return "";
        },
      );
      delete state.doorway;
      return `${doors.length} kinds · ${note}`;
    },
    "door-walk": () => {
      const all = buildingDoors(lab.level);
      const push = all.find((d) => d.swing === "in");
      const pull = all.find((d) => d.swing === "out" && d.leaves === 2);
      const picks = [push, pull].filter((d): d is BuildingDoor => !!d);
      if (picks.length === 0) return "no doors on this map";
      const state = lab.state;
      delete state.crowd;
      // Each door's frames: the moments of the move, s after the press.
      const frames = (d: BuildingDoor): { t: number; name: string }[] => {
        // A dry run, to read the move's own moments.
        start(state, d);
        const move = state.doorway!.move!;
        const a = move.keys[1].t;
        const end = moveLength(move);
        return [
          { t: 0.25, name: "shuffle" },
          { t: a, name: "at the handle" },
          { t: a + DOOR.time.reach * 0.9, name: "hand on lever" },
          { t: move.open - 0.02, name: "lever down" },
          { t: move.open + 0.45, name: "leaf ~30°" },
          { t: move.open + 0.8, name: "leaf ~60°" },
          { t: move.open + 1.5, name: "open, stepping" },
          { t: (move.open + 1.5 + end) / 2, name: "through" },
          { t: end + 0.2, name: "inside" },
          { t: end + 5, name: "closing" },
        ];
      };
      const plans = picks.map((d) => ({ d, f: frames(d) }));
      // Each door's two lenses, its ten moments over two rows of five.
      const rows: string[] = [];
      for (const p of plans) {
        for (const lens of ["chase", "side"]) rows.push(`${p.d.kind} (${p.d.swing}) ${lens}`, "");
      }
      const cols = ["", "", "", "", ""];
      let at = -1;
      return sheet(lab, rows, cols, (r, c) => {
        const p = plans[Math.floor(r / 4)];
        const k = (r % 2) * 5 + c;
        const fr = p.f[k];
        if (!fr) return null;
        // Each lens is one run of the move, stepped to its moments.
        if (k === 0) {
          start(state, p.d);
          at = 0;
        }
        const n = Math.round((fr.t - at) * TUNING.physicsHz);
        // Once through, he holds himself still on the floor.
        for (let i = 0; i < n; i++) step(state, state.doorway?.move ? NEUTRAL_INPUT : HOLD);
        at += n / TUNING.physicsHz;
        const chase = Math.floor(r / 2) % 2 === 0;
        const f = doorFrame(p.d);
        if (chase) {
          // Behind him on his way in, over his shoulder at chase height —
          // held outside, so it never stands in the wall as he goes in.
          const e = doorPoint(f, -0.5, 4.4);
          const t = doorPoint(f, 0, 0.2);
          lab.setOverride({
            eye: { x: e.x, y: f.y + 1.9, z: e.z },
            target: { x: t.x, y: f.y + 1.0, z: t.z },
            fov: 55,
            roll: 0,
          });
        } else {
          // From beside the doorway, out on the snow on its latch side.
          const e = doorPoint(f, 3.2, 3.6);
          const t = doorPoint(f, 0, 0.5);
          lab.setOverride({
            eye: { x: e.x, y: f.y + 1.6, z: e.z },
            target: { x: t.x, y: f.y + 1.0, z: t.z },
            fov: 50,
            roll: 0,
          });
        }
        return `${fr.name} ${state.t.toFixed(2)}`;
      });
    },
  };
}

/** Stand the skier 2.2 m off `door`, a little to its side, facing it, and
 * press. */
function start(state: GameState, door: BuildingDoor): void {
  delete state.doorway;
  const f = doorFrame(door);
  const p = doorPoint(f, -0.4, 2.2);
  placeRun(state, { x: p.x, z: p.z, heading: Math.atan2(f.x - p.x, f.z - p.z) });
  // Off whatever the lab's run had him on.
  state.skier.lift = null;
  state.skier.thrown = null;
  state.skier.fetch = null;
  if (state.afterski) state.afterski.inside = null;
  state.skier.vx = state.skier.vy = state.skier.vz = 0;
  step(state, { ...NEUTRAL_INPUT, machine: true });
  if (!(state as GameState).doorway?.move) {
    const c = state.skier;
    const why = {
      dy: c.y - c.spec.cogHeight - f.y,
      v: Math.hypot(c.vx, c.vy, c.vz),
      head: c.heading,
      off: offDoorway(door, c.x, c.z),
      tunnel: !!c.tunnel,
      jib: !!c.jib,
      inside: state.afterski?.inside,
      heli: !!state.heli?.rider,
      sled: !!state.sled?.rider,
      para: state.para?.mode,
      balloon: !!state.balloon?.aboard,
      events: state.events.map((e) => e.kind),
    };
    throw new Error(`no move at ${door.kind} ${door.id}: ${JSON.stringify(why)}`);
  }
}
