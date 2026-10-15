// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK EVAL LAB's LENSES (`rock-eval-harness.ts` draws them): every
// scene a pure function of the map — where its rock lies (`rockShare`), its
// rocky cliffs (`cliffWalls`), its mountain and its piste — never of a ride
// and never of the renderer, so a scene is the same picture on every branch
// that draws the same map, and a candidate that redraws the rock (but never
// moves where the engine lays it) is photographed from the same spot.
//
// The round-1 scenes keep their names (`foot`, `face-40` … `valley`) so an
// old run's JSON still compares; the rest were added for the second round:
// the mid band (`face-250`), the cliff walls close and slanting (`cliff-20`,
// `cliff-60`, each `-oblique` too), a GULLY and a BUTTRESS (the most concave
// and most convex rock across the slope near the rockiest face), the WALL
// FOOT looked along and the TALUS ground below the tallest cliff, and a
// skier-height CHASE down the piste where it runs nearest the rock.

import { cliffWalls, rockShare, type Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

type P3 = { x: number; y: number; z: number };

/** The scenes of one map: each lens (null where the map has none) and the
 * line its caption carries. */
export type RockScenes = {
  readonly scenes: Record<string, () => LensPose | null>;
  readonly notes: Record<string, string>;
  /** The lens the approach walks in along: the rockiest face from `off` m
   * out past its heart, `high` m over the snow. */
  faceView(off: number, high: number, fov: number, fromFoot?: boolean): LensPose;
  /** Rock cells of 12 m (share past 0.15). */
  readonly rockCells: number;
};

/** The scenes on `level` (`bed` the map under the rock, `ridden` the map a
 * body meets). */
export function rockScenes(level: Level, bed: Level, ridden: Level): RockScenes {
  /** Rock on a 12 m lattice: each cell's share (`rockShare`), and its point. */
  const STEP = 12;
  const N = Math.floor(bed.size / STEP);
  const share = new Float32Array(N * N);
  let rockCells = 0;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const s = rockShare(bed, (i + 0.5) * STEP, (j + 0.5) * STEP);
      share[j * N + i] = s;
      if (s > 0.15) rockCells++;
    }
  const at = (i: number, j: number) => ({ x: (i + 0.5) * STEP, z: (j + 0.5) * STEP });
  const shareAt = (x: number, z: number): number => {
    const i = Math.floor(x / STEP);
    const j = Math.floor(z / STEP);
    return i < 0 || j < 0 || i >= N || j >= N ? 0 : share[j * N + i];
  };

  /** The way the ground falls at a point, a unit vector in plan. */
  function downhill(x: number, z: number): { x: number; z: number } {
    const n = { x: 0, y: 1, z: 0 };
    bed.normalAt(x, z, n);
    const l = Math.hypot(n.x, n.z) || 1;
    return { x: n.x / l, z: n.z / l };
  }

  /** THE ROCKIEST FACE: the 60 m patch with the most of its ground in the
   * rock skin (the shimmer lab's), and the way it falls. */
  const fall = (() => {
    let best = { i: N >> 1, j: N >> 1, sum: -1 };
    const r = 2;
    for (let j = r; j < N - r; j++)
      for (let i = r; i < N - r; i++) {
        let sum = 0;
        for (let dj = -r; dj <= r; dj++)
          for (let di = -r; di <= r; di++) sum += share[(j + dj) * N + i + di];
        if (sum > best.sum) best = { i, j, sum };
      }
    return at(best.i, best.j);
  })();
  const { x: fx, z: fz } = downhill(fall.x, fall.z);
  /** Across the face, a unit vector in plan. */
  const lx = -fz;
  const lz = fx;

  /** Whether the line from `e` to `t` clears the snow by half a metre. */
  function sees(e: P3, t: P3): boolean {
    for (let k = 1; k < 32; k++) {
      const u = k / 32;
      const x = e.x + (t.x - e.x) * u;
      const z = e.z + (t.z - e.z) * u;
      if (ridden.groundAt(x, z) + 0.5 > e.y + (t.y - e.y) * u) return false;
    }
    return true;
  }
  /** A lens from `eye` at `target`, lifted until it sees it over any rise. */
  function look(eye: P3, target: P3, fov: number): LensPose {
    let e = eye;
    for (let k = 0; k < 20 && !sees(e, target); k++) e = { ...e, y: e.y + 3 };
    return { eye: e, target, fov, roll: 0 };
  }
  /** A point on the snow a body meets, `high` m over it. */
  const over = (x: number, z: number, high: number): P3 => ({
    x,
    y: ridden.groundAt(x, z) + high,
    z,
  });

  /** THE FOOT of the rockiest face: down the way it falls from its heart
   * until the rock has given out for 6 m running (the snow under the wall),
   * m from the heart. */
  const footOff = (() => {
    let run = 0;
    for (let d = 0; d < 400; d += 2) {
      run = rockShare(bed, fall.x + fx * d, fall.z + fz * d) > 0 ? 0 : run + 2;
      if (run >= 6) return d - 6;
    }
    return 0;
  })();
  const foot = { x: fall.x + fx * footOff, z: fall.z + fz * footOff };

  /** The rockiest face from `off` m out along the way it falls (past its
   * FOOT with `fromFoot`, else past its heart), `high` m over the snow
   * there — lifted until it sees the face over any rise. */
  function faceView(off: number, high: number, fov: number, fromFoot = false): LensPose {
    const ex = fall.x + fx * (off + (fromFoot ? footOff : 0));
    const ez = fall.z + fz * (off + (fromFoot ? footOff : 0));
    const target = { x: fall.x, y: bed.groundAt(fall.x, fall.z) + 4, z: fall.z };
    let eye = { x: ex, y: ridden.groundAt(ex, ez) + high, z: ez };
    for (let k = 0; k < 20 && !sees(eye, target); k++) eye = { ...eye, y: eye.y + 5 };
    return { eye, target, fov, roll: 0 };
  }

  /** The highest rock on the map from 120 m under it, a skier's eye — the
   * crag's edge against the sky. */
  function skylineView(): LensPose {
    let best = at(N >> 1, N >> 1);
    let top = -Infinity;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        if (share[j * N + i] < 0.5) continue;
        const p = at(i, j);
        const y = bed.groundAt(p.x, p.z);
        if (y > top) {
          top = y;
          best = p;
        }
      }
    const d = downhill(best.x, best.z);
    const ex = best.x + d.x * 120;
    const ez = best.z + d.z * 120;
    return {
      eye: { x: ex, y: ridden.groundAt(ex, ez) + 1.8, z: ez },
      target: { x: best.x, y: top + 6, z: best.z },
      fov: 55,
      roll: 0,
    };
  }

  /** THE TALLEST ROCKY CLIFF: its wall's middle, its foot's middle, and
   * the way out of it (unit, in plan) — or null on a map that lays none. */
  const tallest = (() => {
    const walls = cliffWalls(level);
    if (!walls.length) return null;
    let best = walls[0];
    let most = -1;
    for (const w of walls) {
      const lip = w.pos[(1 * w.cols + (w.cols >> 1)) * 3 + 1];
      const low = w.pos[((w.rows - 1) * w.cols + (w.cols >> 1)) * 3 + 1];
      if (lip - low > most) {
        most = lip - low;
        best = w;
      }
    }
    const mid = ((best.rows >> 1) * best.cols + (best.cols >> 1)) * 3;
    const bot = ((best.rows - 1) * best.cols + (best.cols >> 1)) * 3;
    return {
      mid: { x: best.pos[mid], y: best.pos[mid + 1], z: best.pos[mid + 2] },
      foot: { x: best.pos[bot], y: best.pos[bot + 1], z: best.pos[bot + 2] },
      ox: Math.sin(best.heading),
      oz: Math.cos(best.heading),
    };
  })();

  /** The tallest rocky cliff's wall from `dist` m out, turned `turn` rad
   * off square, a skier's eye on the snow below — the round-1 `cliff` is
   * 28 m square on. */
  function cliffView(dist: number, turn: number, fov: number): LensPose | null {
    if (!tallest) return null;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const ox = tallest.ox * c - tallest.oz * s;
    const oz = tallest.ox * s + tallest.oz * c;
    const ex = tallest.mid.x + ox * dist;
    const ez = tallest.mid.z + oz * dist;
    if (turn === 0 && dist === 28)
      // Round 1's lens, exactly: never lifted.
      return { eye: over(ex, ez, 1.8), target: tallest.mid, fov, roll: 0 };
    return look(over(ex, ez, 1.8), tallest.mid, fov);
  }

  /** The ground below the tallest cliff (or, on a map with none, below the
   * rockiest face's foot) from 45 m out and 20 m aside, 3 m up — where the
   * fallen blocks lie: a talus apron or cone. */
  function talusView(): LensPose {
    const base = tallest
      ? { x: tallest.foot.x, z: tallest.foot.z, ox: tallest.ox, oz: tallest.oz }
      : { x: foot.x, z: foot.z, ox: fx, oz: fz };
    const ex = base.x + base.ox * 45 - base.oz * 20;
    const ez = base.z + base.oz * 45 + base.ox * 20;
    const target = over(base.x + base.ox * 8, base.z + base.oz * 8, 1);
    return look(over(ex, ez, 3), target, 50);
  }

  /** Along the foot of the rockiest face from 40 m aside, a skier's eye —
   * where the wall meets the snow. */
  function wallFootView(): LensPose {
    const ex = foot.x + lx * 40 + fx * 4;
    const ez = foot.z + lz * 40 + fz * 4;
    const target = over(foot.x - lx * 10, foot.z - lz * 10, 2);
    return look(over(ex, ez, 1.8), target, 55);
  }

  /** THE GULLY and THE BUTTRESS: among the rock within 400 m of the
   * rockiest face, the cell most hollow across the slope (the ground 18 m
   * either side of it standing over it) and the one most proud. */
  const ribs = (() => {
    let gully = { ...fall, c: -Infinity };
    let buttress = { ...fall, c: Infinity };
    const S = 18;
    for (let j = 2; j < N - 2; j++)
      for (let i = 2; i < N - 2; i++) {
        if (share[j * N + i] < 0.3) continue;
        const p = at(i, j);
        if (Math.hypot(p.x - fall.x, p.z - fall.z) > 400) continue;
        const d = downhill(p.x, p.z);
        const h = bed.groundAt(p.x, p.z);
        const c =
          bed.groundAt(p.x - d.z * S, p.z + d.x * S) +
          bed.groundAt(p.x + d.z * S, p.z - d.x * S) -
          2 * h;
        if (c > gully.c) gully = { ...p, c };
        if (c < buttress.c) buttress = { ...p, c };
      }
    return { gully, buttress };
  })();
  /** Up the gully from 90 m below it. */
  function gullyView(): LensPose {
    const g = ribs.gully;
    const d = downhill(g.x, g.z);
    const target = { x: g.x, y: bed.groundAt(g.x, g.z) + 4, z: g.z };
    return look(over(g.x + d.x * 90, g.z + d.z * 90, 6), target, 50);
  }
  /** The buttress raked from 60 m down and 60 m aside. */
  function buttressView(): LensPose {
    const b = ribs.buttress;
    const d = downhill(b.x, b.z);
    const target = { x: b.x, y: bed.groundAt(b.x, b.z) + 4, z: b.z };
    return look(over(b.x + d.x * 60 - d.z * 60, b.z + d.z * 60 + d.x * 60, 6), target, 50);
  }

  /** The piste's point with the most rock within 60 m of it (sampled every
   * 10 m of it, never in its last 50 m). */
  const rockyPiste = (() => {
    const pts = level.track.points;
    let best = 0;
    let most = -1;
    for (let k = 0; k + 25 < pts.length; k += 5) {
      const p = pts[k];
      let sum = 0;
      for (let dz = -60; dz <= 60; dz += STEP)
        for (let dx = -60; dx <= 60; dx += STEP)
          if (dx * dx + dz * dz <= 3600) sum += shareAt(p.x + dx, p.z + dz);
      if (sum > most) {
        most = sum;
        best = k;
      }
    }
    return best;
  })();
  /** A skier's eye on the piste where the rock is nearest it, looking 40 m
   * down it — the rock beside a run at riding height. */
  function chaseView(): LensPose {
    const pts = level.track.points;
    const p = pts[rockyPiste];
    const q = pts[Math.min(pts.length - 1, rockyPiste + 20)];
    return {
      eye: over(p.x, p.z, 1.8),
      target: over(q.x, q.z, 1),
      fov: 70,
      roll: 0,
    };
  }

  /** On the piste where it passes nearest the rockiest face, a skier's eye
   * looking at the face — the rock as a run past it sees it. */
  function pisteView(): LensPose {
    const pts = level.track.points;
    let best = pts[0];
    let near = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.x - fall.x, p.z - fall.z);
      if (d < near) {
        near = d;
        best = p;
      }
    }
    return {
      eye: { x: best.x, y: ridden.groundAt(best.x, best.z) + 1.8, z: best.z },
      target: { x: fall.x, y: bed.groundAt(fall.x, fall.z) + 4, z: fall.z },
      fov: 62,
      roll: 0,
    };
  }

  /** 150 m over the rockiest face and 200 m out from it, looking down — the
   * crags as the helicopter, the plane and the paramotor see them. */
  function aerialView(): LensPose {
    const ex = fall.x + fx * 200;
    const ez = fall.z + fz * 200;
    const y = bed.groundAt(fall.x, fall.z);
    return {
      eye: { x: ex, y: Math.max(y + 150, ridden.groundAt(ex, ez) + 60), z: ez },
      target: { x: fall.x, y, z: fall.z },
      fov: 60,
      roll: 0,
    };
  }

  /** From the valley floor up the face toward the rockiest crag. */
  function valleyView(): LensPose {
    const b = level.mountain?.base ?? { x: bed.size / 2, z: bed.size * 0.92 };
    return {
      eye: { x: b.x, y: ridden.groundAt(b.x, b.z) + 2, z: b.z },
      target: { x: fall.x, y: bed.groundAt(fall.x, fall.z), z: fall.z },
      fov: 55,
      roll: 0,
    };
  }

  const OBLIQUE = Math.PI / 4;
  /** THE SCENES, in order. The face's field of view narrows with range so
   * the crag fills about as much of the frame. */
  const scenes: Record<string, () => LensPose | null> = {
    foot: () => faceView(14, 1.8, 70, true),
    "face-40": () => faceView(40, 2, 62, true),
    "face-150": () => faceView(150, 6, 45),
    "face-250": () => faceView(250, 12, 36),
    "face-400": () => faceView(400, 20, 28),
    "face-1200": () => faceView(1200, 40, 12),
    skyline: skylineView,
    cliff: () => cliffView(28, 0, 60),
    "cliff-20": () => cliffView(20, 0, 70),
    "cliff-20-oblique": () => cliffView(20, OBLIQUE, 70),
    "cliff-60": () => cliffView(60, 0, 50),
    "cliff-60-oblique": () => cliffView(60, OBLIQUE, 50),
    gully: gullyView,
    buttress: buttressView,
    "wall-foot": wallFootView,
    talus: talusView,
    chase: chaseView,
    piste: pisteView,
    aerial: aerialView,
    valley: valleyView,
  };
  const notes: Record<string, string> = {
    foot: "14 m out from the foot of the rockiest face, a skier's eye",
    "face-40": "the rockiest face from 40 m out past its foot",
    "face-150": "the rockiest face from 150 m",
    "face-250": "the rockiest face from 250 m (the mid band)",
    "face-400": "the rockiest face from 400 m",
    "face-1200": "the rockiest face from 1200 m (the far cut)",
    skyline: "the highest rock against the sky, from 120 m under it",
    cliff: "the tallest rocky cliff's wall from 28 m",
    "cliff-20": "the tallest rocky cliff's wall from 20 m, square on",
    "cliff-20-oblique": "the tallest rocky cliff's wall from 20 m, 45° off square",
    "cliff-60": "the tallest rocky cliff's wall from 60 m, square on",
    "cliff-60-oblique": "the tallest rocky cliff's wall from 60 m, 45° off square",
    gully: "up the most hollow rock near the rockiest face, from 90 m below",
    buttress: "the most proud rock near the rockiest face, raked from 60 m down and aside",
    "wall-foot": "along the foot of the rockiest face from 40 m aside, a skier's eye",
    talus: tallest
      ? "the ground below the tallest cliff, where talus lies, from 45 m"
      : "the ground below the rockiest face's foot (no rocky cliff), from 45 m",
    chase: "a skier's eye on the piste where rock is nearest it, looking 40 m down it",
    piste: "from the piste where it passes nearest the rockiest face",
    aerial: "150 m over the rockiest face, 200 m out",
    valley: "from the valley floor up toward the crags",
  };
  return { scenes, notes, faceView, rockCells };
}
