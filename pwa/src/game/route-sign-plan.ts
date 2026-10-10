// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE AMATEURS' SIGN STANDS AT A SKI ROUTE, AND WHAT IT IS — the
// plan `route-sign.ts` draws. Three-free and DOM-free, so the suite reads it.
//
// NOBODY OFFICIAL PUT IT THERE. A ski route (R42) is marked by the ski area
// with its stakes and its warning board; the sign that POINTS at it from the
// pad is the locals': an offcut of plank, its far end hacked to a point with
// a hand saw, nailed crooked to a stick of unbarked pine knocked into the
// snow, the words brushed on in black house paint and the orange of the
// route in two lopsided diamonds and a stripe down the point. Weathered
// silver where the sun gets it, never oiled, the paint flaking. It is
// small — a metre of plank at about chest height — and it is never square:
// the stick leans, the board is nailed on a tilt, its ends are not cut true.
//
// IT STANDS ON THE PAD AT THE ROUTE'S HEAD, on the side a rider comes from
// off the lift (`SkiRoute.from`'s top), a step up from the rim and just
// outside the route's corridor, turned to him there; its point aims down
// the route's first stretch, so the board itself says "that way". Every
// irregularity is dealt off a hash of the map's seed and the route's index —
// never the run's stream — so no digest can see it.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { liftPlans, skiRoutesOf, trackPointAt, type Level } from "@engine";

/** The sign's measure, m and radians. */
export const AMATEUR = {
  /** How far up from the route's head (back over the pad) it stands, and
   * how far outside the corridor's edge. */
  back: 1.5,
  aside: 2.4,
  /** How far down the route its point aims. */
  aim: 14,
  /** The plank: its length and height, and its thickness. */
  board: { width: 1.05, height: 0.22, thick: 0.022 },
  /** How far the hacked point reaches past the plank's square end. */
  tip: 0.2,
  /** Its middle over the snow, and how far it may wander off that. */
  y: 1.25,
  yJitter: 0.1,
  /** The board nailed off level, at most this far either way. */
  tilt: 0.09,
  /** The stick: its height over the snow, how deep it is knocked in, its
   * radius at the foot and the top, and its lean off plumb at most. */
  stick: { height: 1.55, sunk: 0.35, foot: 0.05, top: 0.036, lean: 0.07 },
  /** The board's middle stands off the stick this far, toward its tail —
   * nailed by its back end, the point free. */
  hang: 0.32,
};

/** One amateur sign. `heading` is the way the rider reading it looks
 * (heading 0 = +z, clockwise from above); the board's face is turned back
 * at him. `point` is the side of his view the board's point is cut to. */
export type AmateurSign = {
  route: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  point: "left" | "right";
  /** The board's middle over the snow, its tilt (positive: the point end
   * up), and the stick's lean along the board and toward the reader. */
  boardY: number;
  tilt: number;
  leanSide: number;
  leanBack: number;
  /** The board's outline in its own frame — x across the reader's view
   * (−½ width at its tail to the tip), y up from its middle — anticlockwise,
   * as hacked: the square end not quite square, the point lopsided, a chip
   * out of an edge. Its x runs to +½ width + tip ON THE `point` SIDE: a
   * `left` sign is the same list mirrored when drawn. */
  outline: [number, number][];
  /** A seed for the print's own scatter. */
  seed: number;
};

/** The reader's right as the picture shows it, from (x, z) looking along
 * `heading` — forward × up (`run-sign-plan.ts`'s `pointOf`). */
function rightOf(x: number, z: number, heading: number, to: { x: number; z: number }): number {
  return -(to.x - x) * Math.cos(heading) + (to.z - z) * Math.sin(heading);
}

/** The board as a hand saw leaves it: the tail end a little off square and
 * its corners knocked, the two cuts to the point meeting off the middle and
 * not quite straight, and now and then a chip out of the top edge. */
function hacked(rng: ReturnType<typeof createRng>): [number, number][] {
  const { width, height } = AMATEUR.board;
  const hw = width / 2;
  const hh = height / 2;
  const tip = AMATEUR.tip * rng.range(0.75, 1.15);
  // The point's apex, off the middle, and where each cut leaves the edge.
  const apexY = hh * rng.range(-0.35, 0.35);
  const shoulder = hw + rng.range(-0.03, 0.03);
  const tailTop = -hw + rng.range(-0.02, 0.02);
  const tailFoot = -hw + rng.range(-0.035, 0.035);
  const pts: [number, number][] = [
    [tailFoot, -hh],
    [shoulder + rng.range(-0.02, 0.02), -hh],
    // A cut that wanders: a kink half way along it.
    [
      shoulder + tip * 0.5 + rng.range(-0.015, 0.015),
      apexY * 0.5 - hh * 0.5 + rng.range(-0.012, 0.012),
    ],
    [shoulder + tip, apexY],
    [
      shoulder + tip * 0.5 + rng.range(-0.015, 0.015),
      apexY * 0.5 + hh * 0.5 + rng.range(-0.012, 0.012),
    ],
    [shoulder + rng.range(-0.02, 0.02), hh],
  ];
  // A chip out of the top edge, a third of the time.
  if (rng.chance(0.35)) {
    const at = rng.range(-hw * 0.4, hw * 0.4);
    pts.push([at + 0.05, hh], [at + 0.02, hh - rng.range(0.015, 0.03)], [at - 0.02, hh]);
  }
  // The tail's top corner knocked off.
  pts.push([tailTop + 0.02, hh], [tailTop, hh - rng.range(0.008, 0.025)]);
  return pts;
}

const cache = new WeakMap<Level, readonly AmateurSign[]>();

/** The amateurs' sign at the head of every ski route of `level` — none on
 * a map with no route. Built once per map. */
export function amateurSigns(level: Level): readonly AmateurSign[] {
  const hit = cache.get(level);
  if (hit) return hit;
  const signs = skiRoutesOf(level).flatMap((r, i): AmateurSign[] => {
    if (r.points.length < 2) return [];
    const track = { track: { points: r.points, length: r.length } };
    const head = r.points[0];
    const fx = Math.sin(head.heading);
    const fz = Math.cos(head.heading);
    // The side the rider comes from: the lift's top, or the reader's left.
    const lift = liftPlans(level).find((p) => p.lift.id === r.from)?.lift.top;
    const side = lift ? Math.sign(rightOf(head.x, head.z, head.heading, lift)) || 1 : -1;
    const off = head.width / 2 + AMATEUR.aside;
    // `rightOf`'s right is (−cos h, sin h).
    const x = head.x - fx * AMATEUR.back - Math.cos(head.heading) * off * side;
    const z = head.z - fz * AMATEUR.back + Math.sin(head.heading) * off * side;
    // Turned to the rider coming off the lift — or, with no lift, to one
    // standing up the route's line.
    const from = lift ?? { x: x - fx * 8, z: z - fz * 8 };
    let heading = Math.atan2(x - from.x, z - from.z);
    if (Math.hypot(x - from.x, z - from.z) < 2) heading = head.heading;
    const to = trackPointAt(track, Math.min(r.length, AMATEUR.aim));
    const point = rightOf(x, z, heading, to) >= 0 ? "right" : "left";
    const seed =
      (Math.imul(level.seed >>> 0, 2654435761) ^ Math.imul(i + 1, 40503) ^ 0xa3a7e) >>> 0;
    const rng = createRng(seed);
    return [
      {
        route: r.id,
        x,
        z,
        y: level.groundAt(x, z),
        heading,
        point,
        boardY: AMATEUR.y + rng.range(-AMATEUR.yJitter, AMATEUR.yJitter),
        tilt: rng.range(-AMATEUR.tilt, AMATEUR.tilt),
        leanSide: rng.range(-AMATEUR.stick.lean, AMATEUR.stick.lean),
        leanBack: rng.range(-AMATEUR.stick.lean, AMATEUR.stick.lean * 0.5),
        outline: hacked(rng),
        seed,
      },
    ];
  });
  cache.set(level, signs);
  return signs;
}
