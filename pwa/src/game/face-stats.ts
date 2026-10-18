// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A REAL SKI AREA OFFERS, as the WHERE steps bill it: how far its
// pistes drop, how steep they are at their steepest and on the whole, and
// how many mountainsides it has. Read off the real face's
// heights and its real pistes (`real-face.ts`, `real-hints.ts`), loaded
// for the reading when the area is picked — the same small downloads a
// map raised on the face fetches anyway. DOM-free.

import { faceHeight, loadRealFace, realFace, realHints } from "@engine";

/** One face's or one area's figures: the drop from its highest piste to its
 * lowest, m; the steepest hundred metres of any piste and the pistes' mean
 * pitch, both as a gradient (rise over run) of the snow UNDER the piste,
 * down its fall line — how a ski area grades a slope, never the line a
 * piste takes across it, which traverses a steep face at a gentle angle;
 * the lines read (the weight of its mean in an area's). A face with no
 * real pistes reads its relief as its drop and no pitch. */
export type FaceStats = {
  readonly drop: number;
  readonly steepest: number | null;
  readonly mean: number | null;
  readonly pistes: number;
  readonly faces: number;
};

/** A set of runs' figures, as `profileStats` reads them. */
export type RunFigures = Omit<FaceStats, "faces">;

/** One run read every STEP m along its bends: the snow's height there and
 * its fall-line gradient. */
export type Profile = { readonly heights: readonly number[]; readonly pitches: readonly number[] };

/** The pistes are read every `step` m along their bends, and the steepest
 * pitch over `reach` m of run — the grades' own steepest hundred metres. */
const STEP = 10;
const REACH = 100;

/** The figures of a set of runs, each a profile read every STEP m down it:
 * the drop from the highest to the lowest, the steepest REACH m of any
 * (the mean fall line over that stretch) and the mean pitch of all. Null
 * where no profile has two points. */
export function profileStats(profiles: readonly Profile[]): RunFigures | null {
  let top = -Infinity;
  let bottom = Infinity;
  let steepest = 0;
  let sum = 0;
  let count = 0;
  let pistes = 0;
  for (const { heights, pitches } of profiles) {
    if (heights.length < 2) continue;
    pistes++;
    for (const h of heights) {
      top = Math.max(top, h);
      bottom = Math.min(bottom, h);
    }
    const span = Math.min(REACH / STEP, pitches.length);
    let window = 0;
    for (let k = 0; k < pitches.length; k++) {
      window += pitches[k];
      if (k >= span) window -= pitches[k - span];
      if (k >= span - 1) steepest = Math.max(steepest, window / span);
      sum += pitches[k];
      count++;
    }
  }
  if (count === 0) return null;
  return { drop: top - bottom, steepest, mean: sum / count, pistes };
}

/** A line of points resampled every STEP m of its run: the height as
 * `height` reads it (the points' own heights where they carry them) and
 * the fall-line gradient as `pitch` reads it. */
export function profileOf(
  points: readonly { x: number; z: number; y?: number }[],
  pitch: (x: number, z: number) => number,
  height: (x: number, z: number, y: number) => number = (_x, _z, y) => y,
): Profile {
  const heights: number[] = [];
  const pitches: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.round(len / STEP));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const ay = a.y ?? 0;
      const by = b.y ?? 0;
      heights.push(height(x, z, ay + (by - ay) * t));
      pitches.push(pitch(x, z));
    }
  }
  return { heights, pitches };
}

/** The fall-line gradient of a height field at a point, off its heights
 * `d` m to either side. */
export function pitchOf(height: (x: number, z: number) => number, d: number) {
  return (x: number, z: number): number =>
    Math.hypot(height(x + d, z) - height(x - d, z), height(x, z + d) - height(x, z - d)) / (2 * d);
}

/** A loaded face's figures; null for an id no face has. Its `pistes` are
 * the real piste map's WAYS — a piste is drawn there in many short pieces —
 * so they weigh the area's mean and are never billed as its slopes: the
 * slopes a ride has are the runs its built map lays (`seed-maps.ts`). */
export function faceStats(id: string): FaceStats | null {
  const face = realFace(id);
  if (!face) return null;
  const pistes = realHints(id)?.pistes ?? [];
  const at = (x: number, z: number): number => faceHeight(face, x, z);
  const read = profileStats(pistes.map((p) => profileOf(p.points, pitchOf(at, STEP), at)));
  if (read === null) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const h of face.heights) {
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    return { drop: hi - lo, steepest: null, mean: null, pistes: 0, faces: 1 };
  }
  return { ...read, faces: 1 };
}

/** Several faces' figures as one area's: the biggest drop and the
 * steepest pitch of any, the mean weighted by its pistes, the pistes
 * summed. Null for none. */
export function areaStats(all: readonly FaceStats[]): FaceStats | null {
  if (all.length === 0) return null;
  const pitched = all.filter((s) => s.mean !== null && s.pistes > 0);
  const pistes = all.reduce((n, s) => n + s.pistes, 0);
  return {
    drop: Math.max(...all.map((s) => s.drop)),
    steepest: pitched.length ? Math.max(...pitched.map((s) => s.steepest ?? 0)) : null,
    mean: pitched.length
      ? pitched.reduce((m, s) => m + (s.mean ?? 0) * s.pistes, 0) /
        pitched.reduce((n, s) => n + s.pistes, 0)
      : null,
    pistes,
    faces: all.length,
  };
}

const kept = new Map<string, Promise<FaceStats | null>>();

/** A face's figures, its heights and pistes fetched first, read once. */
export function loadFaceStats(id: string): Promise<FaceStats | null> {
  let pending = kept.get(id);
  if (!pending) {
    pending = loadRealFace(id).then(
      (ok) => (ok ? faceStats(id) : null),
      () => null,
    );
    kept.set(id, pending);
  }
  return pending;
}
