// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A REAL SKI AREA OFFERS, as the WHERE steps bill it: how far its
// pistes drop, how steep they are at their steepest and on the whole, how
// many mountainsides it has and how many pistes. Read off the real face's
// heights and its real pistes (`real-face.ts`, `real-hints.ts`), loaded
// for the reading when the area is picked — the same small downloads a
// map raised on the face fetches anyway. DOM-free.

import { faceHeight, loadRealFace, realFace, realHints } from "@engine";

/** One face's or one area's figures: the drop from its highest piste to its
 * lowest, m; the steepest hundred metres of any piste and the pistes' mean
 * pitch, both as a gradient (rise over run); the pistes counted. A face
 * with no real pistes reads its relief as its drop and no pitch. */
export type FaceStats = {
  readonly drop: number;
  readonly steepest: number | null;
  readonly mean: number | null;
  readonly pistes: number;
  readonly faces: number;
};

/** The pistes are read every `step` m along their bends, and the steepest
 * pitch over `reach` m of run — the grades' own steepest hundred metres. */
const STEP = 10;
const REACH = 100;

/** A loaded face's figures; null for an id no face has. */
export function faceStats(id: string): FaceStats | null {
  const face = realFace(id);
  if (!face) return null;
  const pistes = realHints(id)?.pistes ?? [];
  let top = -Infinity;
  let bottom = Infinity;
  let steepest = 0;
  let rise = 0;
  let run = 0;
  for (const piste of pistes) {
    // The piste resampled every STEP m of its run, as heights.
    const hs: number[] = [];
    for (let i = 0; i + 1 < piste.points.length; i++) {
      const a = piste.points[i];
      const b = piste.points[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.round(len / STEP));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n;
        hs.push(faceHeight(face, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t));
      }
    }
    if (hs.length < 2) continue;
    for (const h of hs) {
      top = Math.max(top, h);
      bottom = Math.min(bottom, h);
    }
    for (let k = 1; k < hs.length; k++) rise += Math.abs(hs[k] - hs[k - 1]);
    run += STEP * (hs.length - 1);
    const span = Math.min(REACH / STEP, hs.length - 1);
    for (let k = span; k < hs.length; k++) {
      steepest = Math.max(steepest, Math.abs(hs[k] - hs[k - span]) / (span * STEP));
    }
  }
  if (run === 0) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const h of face.heights) {
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    return { drop: hi - lo, steepest: null, mean: null, pistes: 0, faces: 1 };
  }
  return { drop: top - bottom, steepest, mean: rise / run, pistes: pistes.length, faces: 1 };
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
