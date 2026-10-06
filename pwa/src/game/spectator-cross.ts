// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI CROSS'S AUDIENCE, AS A PLAN — where the crowd stands along a
// ski-cross course (R35, `level.skiCross`), laid through `planSpectators`'
// own dealer so it is one plan, one stream and one look with the finish
// arena's. Three-free and DOM-free.
//
// WHERE A SKI CROSS'S CROWD STANDS, as its venues lay it out:
//
//   * The course is FENCED its whole length (`SkiCrossCourse.nets`), and
//     nobody stands inside the fence: the crowd is behind a spectator fence
//     a couple of metres further out, as on every race course.
//   * MOST of them are at the bottom: the finish arena (`planSpectators`'
//     grandstands and terraces) and the finish area above the line, packed
//     rows deep along the last straight and its finish jump — the course is
//     built so the last features are in sight of the stands.
//   * Up the course they gather where the racing is: at the JUMPS and the
//     STEP-DOWNS, round the lip and down the landing (the two biggest on
//     both sides), and on the OUTSIDE of the BERMS, up on the wall's top
//     where four racers come round at once and the passing is done — the
//     inside of a ski-cross turn is its turning flag and the racing line.
//   * The lower course between them is lined thinly, thicker toward the
//     bottom, where people walk up from the village; the top half is
//     reached on skis and stays quiet.
//   * THE START is a restricted area: officials, coaches and the next
//     heat's racers beside the platform's walls and behind it, never on the
//     ramp below the doors.

import { nearestTrackPoint, trackPointAt, type CrossFeature, type TrackPoint } from "@engine";

import { CROSS_GATE, crossGatePlan } from "./cross-gate-plan.ts";
import type { BankKind, FanDealer } from "./spectator-plan.ts";

/** The numbers a ski cross's crowd is laid by, m unless said. */
export const CROSS_FANS = {
  /** THE FINISH AREA above the grandstands: this share of the course,
   * between `min` and `max` m of it, `top` rows deep at its top and `deep`
   * at its foot, each place taken at `fill`. */
  slope: { share: 0.2, min: 90, max: 170, top: 2, deep: 8, fill: 0.9 },
  /** A JUMP or a STEP-DOWN: a bank from `before` m above its lip to
   * `after` m below it, `rows` deep — the `both` highest on both sides,
   * the rest on one. */
  jump: { before: 14, after: 28, rows: 3, fill: 0.8, both: 2 },
  /** A BERM: its outside lined from `ease` m before the turn to `ease` m
   * after it, `rows` deep, each place taken at `fill` — a fan every
   * `spacing` m along it and `row` m behind the next, the first `front` m
   * past the course's edge and none past `reach`: up on the wall's top
   * where it has room, or on the ground beyond it where that is no more
   * than `below` m under the course, from where the turn can be seen. */
  berm: {
    ease: 6,
    rows: 3,
    fill: 0.8,
    spacing: 0.62,
    row: 0.72,
    front: 3.5,
    reach: 16,
    below: 1.5,
  },
  /** THE LOWER COURSE: from this share of the way down to the finish area,
   * `rows` and `fill` at its top and its foot. */
  lower: { from: 0.4, rows: [1, 2], fill: [0.22, 0.6] },
  /** THE START: how many stand by it — beside the platform's walls,
   * `beside` m out past them and `up` m up the course from the doors, or
   * behind its back, `across` m either side of the middle. */
  start: { count: 16, beside: [3, 7], up: [0.5, 9], behind: [1.5, 7], across: 5 },
  /** Two banks on one side no nearer than this, m. */
  apart: 6,
} as const;

/** THE CROWD along `level`'s ski cross: the start's knot, the jumps and the
 * berms, the lower course and the finish area — the arena itself is
 * `planSpectators`'. */
export function planCrossBanks(d: FanDealer): void {
  const { level, rng } = d;
  const xc = level.skiCross;
  const finishCp = level.checkpoints[level.checkpoints.length - 1];
  if (!xc || !finishCp) return;
  const C = CROSS_FANS;
  const finish = finishCp.s;
  const course = finish - xc.from;
  const slopeLen = Math.min(C.slope.max, Math.max(C.slope.min, course * C.slope.share));
  const top = finish - slopeLen;
  const end = Math.max(top + 10, d.slopeEnd);

  startKnot(d);

  // THE FINISH AREA: rows deep over the last straight, thinning up it.
  const slopeRows = (s: number): number => {
    const k = Math.max(0, Math.min(1, (s - top) / Math.max(1, end - top)));
    return Math.round(C.slope.top + (C.slope.deep - C.slope.top) * k * k);
  };
  for (const side of [-1, 1]) d.standing("finish", top, end, side, slopeRows, C.slope.fill);

  // Where a bank already stands, a side at a time.
  const busy: { from: number; to: number; side: number }[] = [];
  const free = (from: number, to: number, side: number): boolean =>
    to < top - C.apart &&
    busy.every((b) => b.side !== side || to + C.apart < b.from || from - C.apart > b.to);
  const bank = (
    kind: BankKind,
    from: number,
    to: number,
    side: number,
    rows: number,
    fill: number,
  ): void => {
    if (!free(from, to, side)) return;
    busy.push({ from, to, side });
    d.standing(kind, from, to, side, () => rows, fill);
  };

  // THE JUMPS AND THE STEP-DOWNS, the highest first.
  const jumps = xc.features
    .filter((f): f is CrossFeature & { lip: number } => f.lip !== undefined)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  jumps.forEach((f, rank) => {
    const J = C.jump;
    const sides = rank < J.both ? [-1, 1] : [rng.chance(0.5) ? 1 : -1];
    const rows = rank < J.both ? J.rows : J.rows - 1;
    for (const side of sides) bank("jump", f.lip - J.before, f.lip + J.after, side, rows, J.fill);
  });

  // THE BERMS, on their outside.
  for (const f of xc.features) {
    if (f.kind !== "berm" || f.side === undefined) continue;
    const B = C.berm;
    if (!free(f.from - B.ease, f.to + B.ease, -f.side)) continue;
    busy.push({ from: f.from - B.ease, to: f.to + B.ease, side: -f.side });
    bermBank(d, f.from - B.ease, f.to + B.ease, -f.side);
  }

  // THE LOWER COURSE, both sides, wherever nothing bigger stands.
  const head = xc.from + course * C.lower.from;
  const ease = (s: number): number =>
    Math.max(0, Math.min(1, (s - head) / Math.max(1, top - head)));
  const rowsAt = (s: number): number => {
    const [r0, r1] = C.lower.rows;
    return Math.round(r0 + (r1 - r0) * ease(s));
  };
  const fillAt = (s: number): number => {
    const [f0, f1] = C.lower.fill;
    return f0 + (f1 - f0) * ease(s);
  };
  for (const side of [-1, 1]) {
    let from = head;
    for (let s = head; s <= top; s += 2) {
      const open = s < top && free(s, s, side);
      if (open) continue;
      if (s - from >= 12) d.standing("course", from, s - 2, side, rowsAt, fillAt);
      // The next stretch opens past whatever stood here.
      from = s + 2;
    }
  }
}

/** A BERM'S CROWD on its outside, `side` of the course from arc `s0` to
 * `s1`: at each station the first standable places out from the course's
 * edge — the wall's top where it is wide enough, the ground past it where
 * that is high enough to see the turn from. */
function bermBank(d: FanDealer, s0: number, s1: number, side: number): void {
  const { level, rng } = d;
  const B = CROSS_FANS.berm;
  const from = d.fans.length;
  const p: TrackPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0, width: 0 };
  let along = 0;
  for (let s = s0; s <= s1; s += B.spacing) {
    trackPointAt(level, s, p);
    const rx = Math.cos(p.heading) * side;
    const rz = -Math.sin(p.heading) * side;
    // The crowd faces the course, a little up it.
    const facing = p.heading + Math.PI + side * -1.15;
    const edge = p.width / 2;
    let laid = 0;
    for (let out = edge + B.front; out <= edge + B.reach && laid < B.rows; out += B.row) {
      if (!rng.chance(B.fill)) continue;
      const jog = rng.range(-0.2, 0.2);
      const x = p.x + rx * (out + rng.range(-0.15, 0.2)) + Math.sin(p.heading) * jog;
      const z = p.z + rz * out + Math.cos(p.heading) * jog;
      if (level.groundAt(x, z) < p.y - B.below) continue;
      // ...and clear of every leg of the course, not just this one.
      if (nearestTrackPoint(level, x, z).distance < edge + B.front - 0.3) continue;
      if (d.put(x, z, facing, "turn", along)) laid++;
    }
    along += B.spacing;
  }
  d.close("turn", from);
}

/** THE START'S KNOT: officials, coaches and the next heat, beside the
 * platform's walls and behind its back, facing down the course — never on
 * the ramp below the doors. */
function startKnot(d: FanDealer): void {
  const gate = crossGatePlan(d.level);
  if (!gate) return;
  const { rng } = d;
  const K = CROSS_FANS.start;
  const wall = gate.half + CROSS_GATE.wall.out;
  const from = d.fans.length;
  let laid = 0;
  for (let tries = 0; tries < K.count * 5 && laid < K.count; tries++) {
    let along: number;
    let across: number;
    if (rng.chance(0.65)) {
      const side = rng.chance(0.5) ? 1 : -1;
      along = -rng.range(K.up[0], K.up[1]);
      across = side * (wall + rng.range(K.beside[0], K.beside[1]));
    } else {
      along = -(gate.back + rng.range(K.behind[0], K.behind[1]));
      across = rng.range(-K.across, K.across);
    }
    const x = gate.x + gate.fx * along + gate.rx * across;
    const z = gate.z + gate.fz * along + gate.rz * across;
    // Facing down the course, turned a little toward the doors.
    const yaw = gate.heading - Math.sign(across) * rng.range(0.1, 0.6);
    if (d.put(x, z, yaw, "start", laid)) laid++;
  }
  d.close("start", from);
}
