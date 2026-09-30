// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R22 — THE CLIFFS, and R24 — THE DROPS across a black piste, held on the
// finished map: read off the cliffs the level publishes and the ground under
// them, never off the plan that laid them.

import { cliffFootprint } from "../mapgen/cliffs.ts";
import { gradeRowOf } from "../mapgen/grades.ts";
import { nearestTrackPoint, trackPointAt } from "../mapgen/query.ts";
import { regionOf, scaleCount } from "../mapgen/regions.ts";
import { LEVEL_RULES as R, withinBand } from "../mapgen/rules.ts";
import type { Kicker, Level } from "../mapgen/types.ts";
import type { Severity } from "./index.ts";

type Add = (rule: string, severity: Severity, message: string) => void;

/** R22, R24 — the least share of its own drop a face must still show on the
 * ground: the two-metre grid rounds the top and the foot of a wall a couple
 * of metres high by a cell each. */
const DROP_SHOWN = 0.75;

/** Hold the cliffs to R22: how many, that each is a drop on the ground,
 * and that none comes nearer the piste than its grade lets it (R23). The
 * drops across the piste are R24's, held below. */
export function checkCliffs(level: Level, add: Add): void {
  const C = R.cliff;
  const G = gradeRowOf(level).cliffs;
  const cliffs = (level.cliffs ?? []).filter((c) => !c.onTrack);
  const clear = R.track.width.max / 2 + G.clearance;
  for (const c of cliffs) {
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    // The face read across its middle: a metre behind the edge to a metre
    // past its foot, the mountain's own fall in it too.
    const top = level.groundAt(c.x - fx, c.z - fz);
    const foot = level.groundAt(c.x + fx * (c.face + 1), c.z + fz * (c.face + 1));
    if (top - foot < c.drop * DROP_SHOWN) {
      add(
        "R22",
        "warn",
        `${c.id} drops only ${(top - foot).toFixed(1)} m of its ${c.drop.toFixed(1)}`,
      );
    }
    let nearest = Infinity;
    for (const p of cliffFootprint(c)) {
      nearest = Math.min(nearest, nearestTrackPoint(level, p.x, p.z).distance);
    }
    if (nearest < clear - 1) {
      add("R22", "error", `${c.id} comes ${nearest.toFixed(0)} m from the piste's centreline`);
    }
  }
  if (cliffs.length < scaleCount(C.count, regionOf(level).kickers * G.count).min) {
    add("R22", "warn", `only ${cliffs.length} cliff(s)`);
  }
}

/** Hold the drops to R24: as many as the grade deals, each a drop on the
 * ground ACROSS the line, off the gates, the start and the kickers, and
 * spaced down the piste. */
export function checkDrops(level: Level, kickers: readonly Kicker[], add: Add): void {
  const D = R.drop;
  const band = gradeRowOf(level).drops;
  const drops = (level.cliffs ?? []).filter((c) => c.onTrack);
  if (!withinBand(drops.length, band)) {
    add("R24", "error", `${drops.length} drop(s) across the piste (band ${band.min}–${band.max})`);
  }
  const gates = level.checkpoints.map((c) => c.s);
  for (let a = 0; a < drops.length; a++) {
    const d = drops[a];
    const s0 = d.s ?? 0;
    // The face read down the LINE: a metre above the edge to a metre past
    // its foot, less what the line itself falls over those metres.
    const above = trackPointAt(level, s0 - 1);
    const below = trackPointAt(level, s0 + d.face + 1);
    const shown = level.groundAt(above.x, above.z) - level.groundAt(below.x, below.z);
    if (shown < d.drop * DROP_SHOWN) {
      add("R24", "error", `${d.id} drops only ${shown.toFixed(1)} m of its ${d.drop.toFixed(1)}`);
    }
    if (!withinBand(d.drop, D.drop) || !withinBand(d.shelf, D.shelf)) {
      add(
        "R24",
        "error",
        `${d.id}: a ${d.drop.toFixed(1)} m drop off a ${d.shelf.toFixed(0)} m shelf`,
      );
    }
    const from = s0 - d.shelf;
    const to = s0 + d.face + d.landing;
    const gate = gates.find((g) => g > from - D.gateClear + 1 && g < to + D.gateClear - 1);
    if (gate !== undefined) {
      add(
        "R24",
        "error",
        `${d.id} at s ${s0.toFixed(0)} m stands on the gate at ${gate.toFixed(0)} m`,
      );
    }
    for (const k of kickers) {
      const ks = k.s ?? 0;
      if (from < ks + k.landing + D.kickerClear - 1 && to > ks - k.ramp - D.kickerClear + 1) {
        add("R24", "error", `${d.id} stands on ${k.id}'s ramp or landing`);
      }
    }
    for (let b = a + 1; b < drops.length; b++) {
      const ds = Math.abs((drops[b].s ?? 0) - s0);
      if (ds < D.spacing - 1)
        add("R24", "error", `${d.id} and ${drops[b].id} stand ${ds.toFixed(0)} m apart`);
    }
  }
}
