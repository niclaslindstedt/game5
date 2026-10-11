// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE CHALLENGES STAND ON THE SNOW — the plan `challenge-flags.ts`
// draws off: a free ride's dealt challenges (`dealChallenges`,
// `docs/challenges.md`) turned into things planted in the ground.
//
//   * A TIMED LINE'S GATES: at each end of its start and its finish a tall
//     FEATHER FLAG planted a step outside the run's edge, and between the
//     flag and the edge a knee-high TIMING POST — the photocell on one side
//     of the line, its reflector on the other, the beam across the run
//     between them. Across the run, the line itself DYED into the snow,
//     blue at a start and red at a finish, as a course crew sprays one.
//   * A TRICK GOAL'S KICKER: a PENNANT on a short pole beside its lip, a
//     step out from its side and a little up from the lip, clear of the
//     take-off and the landing.
//   * A HIDDEN SPOT, ONCE FOUND: a small CAIRN with a cyan pennant on a
//     stake stuck in it. Never before — the view hides a spot not found.
//
// Three-free and DOM-free, so the suite reads it. Every height is the
// ground's under the thing, sunk a few centimetres so nothing floats.

import {
  isLine,
  isSpots,
  isTrick,
  type ChallengeGate,
  type ChallengePlan,
  type Level,
} from "@engine";

/** The measures, m: the feather flag (its pole, the cloth's foot and top,
 * its widest), how far outside the run's edge it is planted; the timing
 * post's height and its place inside the flag; the dyed line's width; the
 * kicker's pennant pole and where it stands; the cairn's height and its
 * stake. */
export const CHALLENGE_FLAG = {
  flag: { pole: 4.6, foot: 1.05, top: 4.45, wide: 0.82, out: 1.1, radius: 0.028 },
  sensor: { height: 1.0, out: 0.35 },
  dye: { width: 0.45, step: 1.5 },
  pennant: { pole: 2.1, long: 0.95, deep: 0.55, out: 1.4, up: 1.5, radius: 0.022 },
  cairn: { height: 0.85, stake: 2.3 },
  /** How far into the snow a planted thing is sunk. */
  sink: 0.06,
} as const;

/** One thing planted: where its foot is, which way it faces (heading,
 * the engine's convention: 0 along +z, clockwise from above) — a flag's
 * cloth and a pennant fly toward its +x at rest, which is the heading's
 * RIGHT — and what it belongs to. */
export type Planted = { x: number; y: number; z: number; heading: number; id: string };

export type GateFlag = Planted & { role: "start" | "finish" };

/** A line dyed across the snow: its points, world metres, left to right. */
export type DyeLine = { role: "start" | "finish"; points: [number, number, number][] };

export type FlagPlan = {
  flags: GateFlag[];
  sensors: (Planted & { role: "start" | "finish"; side: -1 | 1 })[];
  dyes: DyeLine[];
  kickers: Planted[];
  /** Every hidden spot of the plan, found or not: `id` the spots
   * challenge's and `spot` the spot's own. */
  spots: (Planted & { spot: string })[];
};

/** The heading whose right is the unit (dx, dz): right of heading h is
 * (cos h, −sin h). */
const facing = (dx: number, dz: number): number => Math.atan2(-dz, dx);

/** WHAT `plan` PLANTS ON `level`. */
export function planFlags(level: Level, plan: ChallengePlan): FlagPlan {
  const F = CHALLENGE_FLAG;
  const ground = (x: number, z: number): number => level.groundAt(x, z) - F.sink;
  const out: FlagPlan = { flags: [], sensors: [], dyes: [], kickers: [], spots: [] };
  const gate = (id: string, role: "start" | "finish", g: ChallengeGate): void => {
    // The run's right going down, unit.
    const rx = Math.cos(g.heading);
    const rz = -Math.sin(g.heading);
    for (const side of [-1, 1] as const) {
      const edge = side < 0 ? g.left : g.right;
      const ox = rx * side;
      const oz = rz * side;
      const fx = edge.x + ox * F.flag.out;
      const fz = edge.z + oz * F.flag.out;
      // At rest the cloth flies outward, off the run.
      out.flags.push({ x: fx, y: ground(fx, fz), z: fz, heading: facing(ox, oz), id, role });
      const sx = edge.x + ox * F.sensor.out;
      const sz = edge.z + oz * F.sensor.out;
      // The post's face (its +z) turned across the run, at the other post.
      out.sensors.push({
        x: sx,
        y: ground(sx, sz),
        z: sz,
        heading: Math.atan2(-ox, -oz),
        id,
        role,
        side,
      });
    }
    const span = Math.hypot(g.right.x - g.left.x, g.right.z - g.left.z);
    const n = Math.max(2, Math.ceil(span / F.dye.step));
    const points: [number, number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const x = g.left.x + (g.right.x - g.left.x) * k;
      const z = g.left.z + (g.right.z - g.left.z) * k;
      points.push([x, level.groundAt(x, z), z]);
    }
    out.dyes.push({ role, points });
  };
  for (const c of plan.challenges) {
    if (isLine(c)) {
      gate(c.id, "start", c.start);
      gate(c.id, "finish", c.finish);
    } else if (isTrick(c)) {
      const k = c.kicker;
      const fx = Math.sin(k.heading);
      const fz = Math.cos(k.heading);
      const rx = Math.cos(k.heading);
      const rz = -Math.sin(k.heading);
      // On the kicker's right, back up the in-run from the lip.
      const reach = k.width / 2 + F.pennant.out;
      const x = k.x + rx * reach - fx * F.pennant.up;
      const z = k.z + rz * reach - fz * F.pennant.up;
      // Flying outward, away from the kicker.
      out.kickers.push({ x, y: ground(x, z), z, heading: facing(rx, rz), id: c.id });
    } else if (isSpots(c)) {
      for (const s of c.spots) {
        out.spots.push({ x: s.x, y: ground(s.x, s.z), z: s.z, heading: 0, id: c.id, spot: s.id });
      }
    }
  }
  return out;
}
