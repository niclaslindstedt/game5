// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEGS TAKING THE MOGULS (R42) — a mogul skier's whole craft. A mogul a
// metre and less high every three and a half metres, met at nine metres a
// second, is a crest of a metre's radius: ridden as a rigid body it throws
// him into the air off every one (v²/R is eight g against one). A good
// mogul skier's hips run nearly level down the line while his knees fold
// up each face and stretch down each back — the legs ABSORB the bumps,
// actively, as no spring does.
//
// So on a map with a mogul field the body rides the snow `absorbed` of the
// way from its true surface toward the venue's smooth profile under it: the
// legs' rays, the normal they push along and the body's own contacts are
// cast against that ridden surface, while the snow itself — where the skis
// are drawn, the grooves stamped, the spray thrown — is the true one. The
// share falls with speed past the pace the legs can follow (`ABSORB`): a
// skier too fast for his legs is bucked by the moguls, and one in the back
// seat folds less.
//
// Every other map is the map itself, untouched: no digest moves.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { fieldCoords, fieldHeight, mogulsAt } from "../mapgen/mogul-field.ts";
import type { Level, Vec3 } from "../mapgen/types.ts";

/** HOW MUCH OF A MOGUL THE LEGS TAKE (est.): all of it to `easy` m/s — a
 * top run's ~10 m/s mean with the legs at their quickest — falling to
 * `floor` by `hard` m/s, where a knee folding at its fastest no longer
 * keeps up with a mogul every third of a second. */
export const ABSORB = { easy: 9.5, hard: 14, floor: 0.35 } as const;

/** The share of the moguls the legs take at `speed`, m/s. */
export function absorbedAt(speed: number): number {
  const k = clamp((speed - ABSORB.easy) / (ABSORB.hard - ABSORB.easy), 0, 1);
  return 1 - (1 - ABSORB.floor) * k;
}

/** THE SNOW THE BODY RIDES on `level` at `speed`: the map itself off a
 * mogul field, and over one its ground with the absorbed share of the
 * moguls taken out. */
export function riddenLevel(level: Level, speed: number): Level {
  const f = level.bumps;
  if (!f) return level;
  const share = absorbedAt(speed);
  const groundAt = (x: number, z: number): number => {
    const { along, across } = fieldCoords(f, x, z);
    return level.groundAt(x, z) - share * mogulsAt(f, along, across);
  };
  const normalAt = (x: number, z: number, out: Vec3): void => {
    const { along, across } = fieldCoords(f, x, z);
    if (along <= 0 || along >= f.end || Math.abs(across) >= f.half) {
      level.normalAt(x, z, out);
      return;
    }
    const e = 0.05;
    const h = (a: number, c: number): number => fieldHeight(f, a, c) - share * mogulsAt(f, a, c);
    const ga = (h(along + e, across) - h(along - e, across)) / (2 * e);
    const gc = (h(along, across + e) - h(along, across - e)) / (2 * e);
    const fx = Math.sin(f.heading);
    const fz = Math.cos(f.heading);
    const gx = ga * fx + gc * fz;
    const gz = ga * fz - gc * fx;
    const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
    out.x = -gx * inv;
    out.y = inv;
    out.z = -gz * inv;
  };
  return { ...level, groundAt, normalAt };
}
