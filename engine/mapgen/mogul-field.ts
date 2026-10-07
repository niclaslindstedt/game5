// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MOGUL FIELD (R40) — bumps at a skier's scale, as a function of the plan
// rather than a grid. A mogul a metre high every three and a half metres
// is far finer than the 2 m grid a map is baked on: on the grid it would be
// a ripple. So the field is ANALYTIC, as R39's pipe is (`pipe.ts`): a
// venue's own profile (`yAt`, drawn every quarter metre, its air bumps in
// it) with the moguls laid over it down each LINE of the field, and a map
// carrying one answers `groundAt` and `normalAt` off it inside the venue's
// width, the grid everywhere else.
//
// A LINE is a mogul track down the venue: its centre `offset` m across
// the venue's line (right positive) and its `width`. One line is a moguls
// course (R40).
// Down a line the moguls stand every `spacing` m of plan, `height` m from
// crest to trough, and the crests SNAKE across it (a phase that swings a
// quarter wave either way every `wave` m across), so the troughs zig-zag
// down the line as a skier's turns cut them and no line straight down it
// runs flat. They fade in over `ease` m at the line's ends, its edges and
// round every GAP down it (the air bumps' run-ins and landings, which are
// smooth), so the venue's profile is all there is outside them.
//
// Pure, drawing nothing from any stream.

import { smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level, Vec3 } from "./types.ts";

/** One mogul TRACK down a field: its centre across the venue's line and
 * its width, m. */
export type MogulLine = { offset: number; width: number };

/** A MOGUL FIELD on a map: the venue's line (its origin the venue's start,
 * at `heading`) and its height `yAt` m along it, how wide the analytic
 * surface reaches either side of the line (`half`, the graded width's
 * half) and where it ends (`end`); the mogul lines, where down the line
 * they run (`from`, `to`) and the gaps in them, m along; and the bumps'
 * spacing, height, snake and ease, m. */
export type MogulField = {
  x: number;
  z: number;
  heading: number;
  yAt: (d: number) => number;
  half: number;
  end: number;
  lines: readonly MogulLine[];
  from: number;
  to: number;
  gaps: readonly (readonly [number, number])[];
  spacing: number;
  height: number;
  wave: number;
  ease: number;
};

/** A point of the plan in the field's frame: `along` its line and `across`
 * it (right of the line positive), m. */
export function fieldCoords(
  f: MogulField,
  x: number,
  z: number,
): { along: number; across: number } {
  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  const dx = x - f.x;
  const dz = z - f.z;
  return { along: dx * fx + dz * fz, across: dx * fz - dz * fx };
}

/** How much of the moguls stand `along` the field (0 off a line's ends and
 * in its gaps, 1 in the field). */
export function mogulShare(f: MogulField, along: number): number {
  const e = f.ease;
  let k = smoothstep(f.from, f.from + e, along) * (1 - smoothstep(f.to - e, f.to, along));
  for (const [a, b] of f.gaps) {
    if (along > a - e && along < b + e) {
      k *= 1 - smoothstep(a - e, a, along) * (1 - smoothstep(b, b + e, along));
    }
  }
  return k;
}

/** THE MOGULS' HEIGHT over the venue's profile at a point of the field's
 * frame, m: every line's bumps, faded at its edges. */
export function mogulsAt(f: MogulField, along: number, across: number): number {
  const k = mogulShare(f, along);
  if (k <= 0) return 0;
  let h = 0;
  for (const line of f.lines) {
    const c = across - line.offset;
    const half = line.width / 2;
    const side = 1 - smoothstep(half - f.ease / 2, half + f.ease / 2, Math.abs(c));
    if (side <= 0) continue;
    const snake = (Math.PI / 2) * Math.sin((2 * Math.PI * c) / f.wave);
    const theta = (2 * Math.PI * (along - f.from)) / f.spacing + snake;
    h += (f.height / 2) * Math.cos(theta) * side;
  }
  return h * k;
}

/** Whether a point of the field's frame is on its own surface. */
function inside(f: MogulField, along: number, across: number): boolean {
  return along > 0 && along < f.end && Math.abs(across) < f.half;
}

/** The field's surface height at a point of its frame, m. */
export function fieldHeight(f: MogulField, along: number, across: number): number {
  return f.yAt(along) + mogulsAt(f, along, across);
}

/** The surface's normal at a point of its frame, into `out` — by central
 * differences of the surface itself (a few centimetres apart: the profile
 * is drawn every quarter metre, a mogul is three). */
function normalIn(f: MogulField, along: number, across: number, out: Vec3): void {
  const e = 0.05;
  const ga = (fieldHeight(f, along + e, across) - fieldHeight(f, along - e, across)) / (2 * e);
  const gc = (fieldHeight(f, along, across + e) - fieldHeight(f, along, across - e)) / (2 * e);
  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  // across = dx·fz − dz·fx: its gradient in the plan is (fz, −fx).
  const gx = ga * fx + gc * fz;
  const gz = ga * fz - gc * fx;
  const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
  out.x = -gx * inv;
  out.y = inv;
  out.z = -gz * inv;
}

/** THE MAP WITH ITS MOGUL FIELD: `groundAt` and `normalAt` answered off the
 * field's surface inside the venue's width, and the grid under it cut to
 * the lowest that surface stands within a cell of each node, a hand under
 * it — never above the snow the physics rides, so the drawn ground is under
 * the field's own mesh (`mogul-view.ts`). */
export function withMoguls(level: Level, f: MogulField): Level {
  const base = level;
  const field = level.ground;
  const ground = { ...field, data: new Float32Array(field.data) };
  for (let r = 0; r < field.rows; r++) {
    for (let c = 0; c < field.cols; c++) {
      const x = field.originX + c * field.cell;
      const z = field.originZ + r * field.cell;
      const { along, across } = fieldCoords(f, x, z);
      if (along < -field.cell || along > f.end + field.cell) continue;
      if (Math.abs(across) > f.half + field.cell) continue;
      let low = Infinity;
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const a = along + i * field.cell * 0.25;
          const b = across + j * field.cell * 0.25;
          if (!inside(f, a, b)) continue;
          low = Math.min(low, fieldHeight(f, a, b));
        }
      }
      const i = r * field.cols + c;
      if (low < Infinity) ground.data[i] = Math.min(field.data[i], low - 0.1);
    }
  }
  const groundAt = (x: number, z: number): number => {
    const { along, across } = fieldCoords(f, x, z);
    return inside(f, along, across) ? fieldHeight(f, along, across) : base.groundAt(x, z);
  };
  const normalAt = (x: number, z: number, out: Vec3): void => {
    const { along, across } = fieldCoords(f, x, z);
    if (inside(f, along, across)) normalIn(f, along, across, out);
    else base.normalAt(x, z, out);
  };
  return { ...level, ground, groundAt, normalAt, bumps: f };
}
