// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R11, R24, R28 — THE GATES DOWN A RESORT'S COURSE, set once its map is
// stood up (`resortLevel`): the start gate, the slalom gates down it, the
// finish — off the course's own hash, drawing nothing from any stream.

import { LEVEL_RULES as R, bendFloor } from "./rules.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { startGateArc } from "./spawn.ts";
import { trackPointAt } from "./query.ts";
import { courseGrade, type PisteGrade, type RunGrade } from "./grades.ts";
import type { Checkpoint, Cliff, Kicker, TrackPoint } from "./types.ts";
import type { BuiltResort } from "./resort-build.ts";

/** R11, R24, R28 — THE GATES DOWN A COURSE: the start gate across the
 * piste, the finish line across the arena, and between them SLALOM GATES
 * every `course.gates.spacing` metres or so, each as wide as its colour's
 * row asks (narrower than the piste), set alternately left and right of the
 * line by most of the room the piste leaves — no further than the turn a
 * skier makes between two of them at that pitch can carry (a weave of
 * radius `course.gates.radius` or R6's floor half again), and on the line
 * over a kicker or a drop, where a skier goes straight. A gate the spacing
 * would stand on a drop, or on a kicker of a `park` (R20), moves off it,
 * inside the spacing's band where it can. */
export function courseGates(
  track: { track: { points: TrackPoint[]; length: number } },
  drops: readonly Cliff[],
  kickers: readonly Kicker[],
  grade: PisteGrade,
  salt: number,
  park: readonly Kicker[] = [],
): Checkpoint[] {
  const G = RR.course.gates;
  const L = track.track.length;
  const s0 = startGateArc();
  // Down the course a gate at a time, the room left shared out evenly, and
  // a gate that would stand on a drop's approach, face or landing (R24)
  // stepped out of it to whichever side keeps the spacing.
  const D = R.drop;
  // A park's kicker (R20) is kept clear the same way: no gate on its ramp,
  // deck, landing or run-out, and a run-in from the gate before it.
  const T = R.trick.gateClear;
  const zones = drops
    .map((d) => ({
      from: (d.s ?? 0) - d.shelf - D.gateClear,
      to: (d.s ?? 0) + d.face + d.landing + D.gateClear,
    }))
    .concat(
      park.map((k) => ({
        from: (k.s ?? 0) - k.ramp - T.before,
        to: (k.s ?? 0) + k.landing + T.after,
      })),
    );
  const arcs = [s0];
  for (let prev = s0; ;) {
    const left = L - prev;
    if (left <= G.spacing.max) break;
    const near = prev + G.spacing.min;
    const far = prev + G.spacing.max;
    let at = prev + left / Math.max(1, Math.round(left / G.spacing.target));
    const z = zones.find((zz) => at > zz.from && at < zz.to);
    if (z) {
      const fits = [z.from - 1, z.to + 1].filter(
        (a) => a >= near && a <= far && L - a >= G.spacing.min,
      );
      fits.sort((a, b) => Math.abs(a - at) - Math.abs(b - at));
      at = fits[0] ?? z.to + 1;
      // No room either side: the gate before steps back up the course so
      // the next can stand past the zone.
      const back = arcs.length - 1;
      if (fits.length === 0 && back > 0 && at - prev > G.spacing.max) {
        const moved = at - G.spacing.max;
        if (
          moved - arcs[back - 1] >= G.spacing.min &&
          !zones.some((zz) => moved > zz.from && moved < zz.to)
        ) {
          arcs[back] = moved;
        }
      }
    }
    arcs.push(at);
    prev = at;
  }
  arcs.push(L);
  // Which side the first slalom gate stands, and how much of its room each
  // takes — off the course's own hash, so no stream is drawn.
  const pick = (k: number, j: number): number => hashPick(salt + j * 7919, k);
  const first = pick(0, 1) < 0.5 ? -1 : 1;
  const straight = (at: number): boolean =>
    kickers.some((k) => at > (k.s ?? 0) - k.ramp - 20 && at < (k.s ?? 0) + k.landing + 20) ||
    drops.some((d) => at > (d.s ?? 0) - d.shelf - 20 && at < (d.s ?? 0) + d.face + d.landing + 20);
  return arcs.map((at, k) => {
    const p = trackPointAt(track, at);
    const gate: Checkpoint = {
      x: p.x,
      z: p.z,
      y: p.y,
      heading: p.heading,
      width: p.width + 2 * R.checkpoint.margin,
      s: p.s,
      colour: k % 2 === 0 ? "red" : "blue",
    };
    if (k === 0 || k === arcs.length - 1) return gate;
    // A gate in a neck (R27) closes to fit it, its margins kept.
    const width = Math.min(G.width[grade], p.width - 2 * G.margin);
    const room = Math.max(0, p.width / 2 - width / 2 - G.margin);
    // The weave between this gate and its neighbours, at the pitch here.
    const a = trackPointAt(track, at - 30);
    const b = trackPointAt(track, at + 30);
    const pitch = Math.max(0, (a.y - b.y) / 60);
    const radius = Math.max(G.radius, bendFloor(pitch) * 1.5);
    const gap = Math.min(at - arcs[k - 1], arcs[k + 1] - at);
    const carry = (gap * gap) / (Math.PI * Math.PI * radius);
    const share = G.share.min + (G.share.max - G.share.min) * pick(k, 2);
    const side = k % 2 === 1 ? first : -first;
    const offset = straight(at) ? 0 : side * Math.min(room, carry) * share;
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    gate.x = p.x + rx * offset;
    gate.z = p.z + rz * offset;
    gate.y = trackPointAt(track, at).y;
    gate.width = width;
    gate.offset = offset;
    gate.span = p.width;
    return gate;
  });
}

/** A share in 0..1 off a seed and an index, for a pick that must draw
 * nothing from any stream. */
export function hashPick(seed: number, i: number): number {
  let v = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35);
  v ^= v >>> 15;
  return (v >>> 0) / 4294967296;
}

/** R28 — which course a map asks for: by id, else of the colour asked (or
 * the nearest colour there is), else the seed's. */
export function chooseCourse(
  b: BuiltResort,
  ask: { course?: string; grade?: RunGrade; dealt: PisteGrade },
): number {
  if (ask.course !== undefined) {
    const i = b.courses.findIndex((c) => c.course.id === ask.course);
    if (i >= 0) return i;
  }
  const want = courseGrade(ask.grade ?? ask.dealt);
  const order = ["green", "blue", "red", "black"] as const;
  const wi = order.indexOf(want);
  let best = 0;
  let bestScore = Infinity;
  b.courses.forEach((c, i) => {
    const d = Math.abs(order.indexOf(c.course.grade) - wi);
    // Nearest colour, the harder on a tie, then the seed's own pick.
    const score = d * 4 - (order.indexOf(c.course.grade) > wi ? 1 : 0) + hashPick(b.seed, i) * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
